const normalizeNotificationPreferences = (value = null) => {
    const source = (value && typeof value === 'object') ? value : {};
    return {
        pushEnabled: !!source.pushEnabled,
        friendMoments: source.friendMoments !== false,
        commentsOnMyMoments: source.commentsOnMyMoments !== false,
        commentsOnFollowedOrCommentedMoments: source.commentsOnFollowedOrCommentedMoments !== false
    };
};

export const PUSH_DEVICE_ID_STORAGE_KEY = 'coffeeDialPushDeviceId:v1';

const createStableDeviceId = () => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `device_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
};

const getDeviceId = () => {
    try {
        const existing = localStorage.getItem(PUSH_DEVICE_ID_STORAGE_KEY);
        if (existing) return existing;
        const created = createStableDeviceId();
        localStorage.setItem(PUSH_DEVICE_ID_STORAGE_KEY, created);
        return created;
    } catch (_) {
        return createStableDeviceId();
    }
};

export const readPushDeviceId = () => {
    try {
        return localStorage.getItem(PUSH_DEVICE_ID_STORAGE_KEY) || '';
    } catch (_) {
        return '';
    }
};

export const createPushNotificationsModule = ({
    dataService,
    messagingApi,
    getCurrentUser,
    getNotificationPreferences,
    vapidKey = '',
    showToast
}) => {
    const { db, doc, setDoc, deleteDoc, getDoc } = dataService || {};
    const {
        getMessaging,
        getToken,
        deleteToken,
        onMessage,
        isSupported,
        app
    } = messagingApi || {};
    if (!db || !doc || !setDoc || !deleteDoc) {
        throw new Error('createPushNotificationsModule requires dataService { db, doc, setDoc, deleteDoc }');
    }
    if (!getMessaging || !getToken || !deleteToken || !isSupported || !app) {
        throw new Error('createPushNotificationsModule requires messagingApi { getMessaging, getToken, deleteToken, isSupported, app }');
    }

    let messagingInstance = null;
    let foregroundUnsubscribe = null;
    let lastKnownToken = '';
    const SERVICE_WORKER_READY_TIMEOUT_MS = 8000;
    const GET_TOKEN_TIMEOUT_MS = 15000;

    const withTimeout = async (promise, timeoutMs, onTimeoutValue = null) => {
        let timeoutId = null;
        try {
            return await Promise.race([
                promise,
                new Promise((resolve) => {
                    timeoutId = setTimeout(() => resolve(onTimeoutValue), timeoutMs);
                })
            ]);
        } finally {
            if (timeoutId) clearTimeout(timeoutId);
        }
    };

    const resolveSwScriptUrl = () => {
        if (typeof window === 'undefined') return '/sw.js';
        const pathname = window.location?.pathname || '/';
        const basePath = pathname === '/Coffee-Dial' || pathname.startsWith('/Coffee-Dial/')
            ? '/Coffee-Dial'
            : '';
        return `${basePath}/sw.js`;
    };

    const resolveServiceWorkerRegistration = async () => {
        if (typeof navigator === 'undefined' || !navigator.serviceWorker) return null;
        const existing = await navigator.serviceWorker.getRegistration().catch(() => null);
        if (existing) return existing;
        try {
            const swUrl = resolveSwScriptUrl();
            return await navigator.serviceWorker.register(swUrl).catch(() => null);
        } catch (_) {
            return null;
        }
    };

    const resolveMessaging = async () => {
        if (messagingInstance) return messagingInstance;
        const supported = await isSupported().catch(() => false);
        if (!supported) return null;
        messagingInstance = getMessaging(app);
        return messagingInstance;
    };

    const getNotificationPermission = () => {
        if (typeof Notification === 'undefined') return 'unsupported';
        return Notification.permission || 'default';
    };

    const upsertDevice = async ({ uid, enabled, permission, token = '' }) => {
        if (!uid || !token) return;
        const deviceId = getDeviceId();
        const payload = {
            token,
            enabled: !!enabled,
            permission: permission || 'default',
            platform: 'web',
            userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '',
            updatedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', uid, 'devices', deviceId), payload, { merge: true });
    };

    const removeCurrentDevice = async (uid) => {
        if (!uid) return;
        const deviceId = readPushDeviceId() || getDeviceId();
        if (!deviceId) return;
        try {
            await deleteDoc(doc(db, 'users', uid, 'devices', deviceId));
        } catch (_) {
            // Ignore missing-doc/permission edge cases.
        }
    };

    const getCurrentDeviceRegistration = async (uid) => {
        if (!uid || typeof getDoc !== 'function') return null;
        const deviceId = readPushDeviceId();
        if (!deviceId) return null;
        try {
            const snap = await getDoc(doc(db, 'users', uid, 'devices', deviceId));
            if (!snap?.exists?.()) return null;
            const data = snap.data?.() || {};
            const token = typeof data.token === 'string' ? data.token.trim() : '';
            return {
                id: deviceId,
                token,
                hasToken: !!token,
                enabled: !!data.enabled
            };
        } catch (_) {
            return null;
        }
    };

    const registerForegroundListener = async () => {
        if (foregroundUnsubscribe) return;
        const messaging = await resolveMessaging();
        if (!messaging || typeof onMessage !== 'function') return;
        foregroundUnsubscribe = onMessage(messaging, (payload) => {
            const title = payload?.notification?.title || 'Coffee Dial';
            const body = payload?.notification?.body || '';
            if (body && typeof showToast === 'function') showToast(`${title}: ${body}`);
        });
    };

    const stopForegroundListener = () => {
        if (!foregroundUnsubscribe) return;
        try { foregroundUnsubscribe(); } catch (_) {}
        foregroundUnsubscribe = null;
    };

    const disableForCurrentUser = async () => {
        const user = getCurrentUser?.();
        if (!user?.uid) return { ok: false, reason: 'no-user' };
        const messaging = await resolveMessaging();
        if (messaging && lastKnownToken) {
            try { await deleteToken(messaging); } catch (_) {}
            lastKnownToken = '';
        }
        await removeCurrentDevice(user.uid);
        stopForegroundListener();
        return { ok: true, reason: 'disabled' };
    };

    const initForCurrentUser = async ({ allowRegistration = true } = {}) => {
        const user = getCurrentUser?.();
        if (!user?.uid) return { ok: false, reason: 'no-user' };
        const prefs = normalizeNotificationPreferences(getNotificationPreferences?.());
        const permissionBefore = getNotificationPermission();
        if (!prefs.pushEnabled) {
            await removeCurrentDevice(user.uid);
            stopForegroundListener();
            return { ok: false, reason: 'push-disabled' };
        }
        if (!vapidKey) {
            console.warn('Push enabled but no VAPID key configured.');
            if (typeof showToast === 'function') {
                showToast('Push setup incomplete: missing VAPID key.');
            }
            return { ok: false, reason: 'missing-vapid-key' };
        }
        const messaging = await resolveMessaging();
        if (!messaging) return { ok: false, reason: 'unsupported' };
        if (!allowRegistration) {
            const currentDevice = await getCurrentDeviceRegistration(user.uid);
            if (currentDevice?.enabled && currentDevice?.hasToken) {
                await registerForegroundListener();
                return { ok: true, reason: 'already-registered' };
            }
            stopForegroundListener();
            return { ok: false, reason: 'registration-not-requested' };
        }

        let permission = permissionBefore;
        if (permission === 'default' && typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
            permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
            await removeCurrentDevice(user.uid);
            stopForegroundListener();
            return { ok: false, reason: 'permission-not-granted', permission };
        }

        const swRegistration = await resolveServiceWorkerRegistration();
        const swReady = (typeof navigator !== 'undefined' && navigator.serviceWorker)
            ? await withTimeout(
                navigator.serviceWorker.ready.catch(() => null),
                SERVICE_WORKER_READY_TIMEOUT_MS,
                null
            )
            : null;
        const effectiveSwRegistration = swReady || swRegistration || null;
        let token = '';
        try {
            token = await withTimeout(
                getToken(messaging, {
                    vapidKey,
                    serviceWorkerRegistration: effectiveSwRegistration || undefined
                }),
                GET_TOKEN_TIMEOUT_MS,
                '__TOKEN_TIMEOUT__'
            );
        } catch (error) {
            return {
                ok: false,
                reason: 'token-error',
                error: error?.message || String(error)
            };
        }
        if (token === '__TOKEN_TIMEOUT__') {
            return { ok: false, reason: 'token-timeout' };
        }
        lastKnownToken = token || '';
        if (!token) {
            await removeCurrentDevice(user.uid);
            stopForegroundListener();
            return { ok: false, reason: 'token-empty' };
        }
        await upsertDevice({
            uid: user.uid,
            enabled: true,
            permission,
            token
        });
        await registerForegroundListener();
        return { ok: true, reason: 'registered', token };
    };

    const handlePreferencesChanged = async (nextPrefs = null, options = {}) => {
        const prefs = normalizeNotificationPreferences(nextPrefs || getNotificationPreferences?.());
        const trigger = typeof options?.trigger === 'string' ? options.trigger : 'unknown';
        if (!prefs.pushEnabled || trigger === 'toggle-disable') return disableForCurrentUser();

        if (trigger === 'register-button') {
            return initForCurrentUser({ allowRegistration: true });
        }

        if (trigger === 'toggle-enable') {
            const user = getCurrentUser?.();
            if (!user?.uid) return { ok: false, reason: 'no-user' };
            const currentDevice = await getCurrentDeviceRegistration(user.uid);
            if (currentDevice?.enabled && currentDevice?.hasToken) {
                await registerForegroundListener();
                return { ok: true, reason: 'already-registered' };
            }
            return initForCurrentUser({ allowRegistration: true });
        }

        return initForCurrentUser({ allowRegistration: false });
    };

    const cleanupOnLogout = async () => {
        stopForegroundListener();
        const messaging = await resolveMessaging();
        if (messaging && lastKnownToken) {
            try { await deleteToken(messaging); } catch (_) {}
            lastKnownToken = '';
        }
    };

    return {
        initForCurrentUser,
        handlePreferencesChanged,
        disableForCurrentUser,
        cleanupOnLogout
    };
};
