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
const MIN_DECLARATIVE_IOS_VERSION = { major: 18, minor: 4 };

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
    let vapidKeyBytesCache = null;

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

    const parseIosVersionFromUserAgent = (userAgent) => {
        const ua = (userAgent || '').toString();
        const match = ua.match(/OS (\d+)[._](\d+)(?:[._](\d+))?/i);
        if (!match) return null;
        return {
            major: parseInt(match[1], 10) || 0,
            minor: parseInt(match[2], 10) || 0,
            patch: parseInt(match[3] || '0', 10) || 0
        };
    };

    const compareVersions = (left, right) => {
        if ((left?.major || 0) !== (right?.major || 0)) return (left?.major || 0) - (right?.major || 0);
        if ((left?.minor || 0) !== (right?.minor || 0)) return (left?.minor || 0) - (right?.minor || 0);
        return (left?.patch || 0) - (right?.patch || 0);
    };

    const isDeclarativeWebPushCapableEnvironment = () => {
        if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
        const ua = (navigator.userAgent || '').toString();
        const isAppleMobile = /\b(iPhone|iPad|iPod)\b/i.test(ua);
        if (!isAppleMobile) return false;
        const iosVersion = parseIosVersionFromUserAgent(ua);
        if (!iosVersion) return false;
        return compareVersions(iosVersion, MIN_DECLARATIVE_IOS_VERSION) >= 0;
    };

    const base64UrlToUint8Array = (value) => {
        if (vapidKeyBytesCache) return vapidKeyBytesCache;
        const normalized = (value || '').replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
        const decoded = atob(padded);
        const bytes = new Uint8Array(decoded.length);
        for (let idx = 0; idx < decoded.length; idx += 1) {
            bytes[idx] = decoded.charCodeAt(idx);
        }
        vapidKeyBytesCache = bytes;
        return bytes;
    };

    const normalizeSubscription = (subscription = null) => {
        if (!subscription || typeof subscription !== 'object') return null;
        const endpoint = typeof subscription.endpoint === 'string' ? subscription.endpoint.trim() : '';
        if (!endpoint) return null;
        const keys = {};
        if (typeof subscription.getKey === 'function') {
            const p256dhRaw = subscription.getKey('p256dh');
            const authRaw = subscription.getKey('auth');
            if (p256dhRaw) {
                const bytes = new Uint8Array(p256dhRaw);
                keys.p256dh = btoa(String.fromCharCode(...bytes));
            }
            if (authRaw) {
                const bytes = new Uint8Array(authRaw);
                keys.auth = btoa(String.fromCharCode(...bytes));
            }
        } else if (subscription.keys && typeof subscription.keys === 'object') {
            if (typeof subscription.keys.p256dh === 'string') keys.p256dh = subscription.keys.p256dh;
            if (typeof subscription.keys.auth === 'string') keys.auth = subscription.keys.auth;
        }
        if (!keys.p256dh || !keys.auth) return null;
        return {
            endpoint,
            expirationTime: typeof subscription.expirationTime === 'number' ? subscription.expirationTime : null,
            keys
        };
    };

    const ensureDeclarativeSubscription = async ({ swRegistration, requestIfMissing = false } = {}) => {
        if (!swRegistration?.pushManager) return null;
        let subscription = await swRegistration.pushManager.getSubscription().catch(() => null);
        if (!subscription && requestIfMissing) {
            try {
                subscription = await swRegistration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: base64UrlToUint8Array(vapidKey)
                });
            } catch (error) {
                return {
                    ok: false,
                    reason: 'subscription-error',
                    error: error?.message || String(error),
                    subscription: null
                };
            }
        }
        return {
            ok: true,
            reason: subscription ? 'subscription-ready' : 'subscription-missing',
            subscription: normalizeSubscription(subscription)
        };
    };

    const upsertDevice = async ({
        uid,
        enabled,
        permission,
        token = '',
        webPushSubscription = null,
        channel = ''
    }) => {
        if (!uid) return;
        if (!token && !webPushSubscription) return;
        const deviceId = getDeviceId();
        const payload = {
            token: token || '',
            enabled: !!enabled,
            permission: permission || 'default',
            platform: 'web',
            userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '',
            webPushSubscription: webPushSubscription || null,
            pushChannel: channel || (webPushSubscription ? 'declarative-web-push' : 'fcm'),
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
            const sub = data.webPushSubscription && typeof data.webPushSubscription === 'object'
                ? data.webPushSubscription
                : null;
            return {
                id: deviceId,
                token,
                hasToken: !!token,
                hasWebPushSubscription: !!normalizeSubscription(sub),
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
        const declarativeSupported = isDeclarativeWebPushCapableEnvironment();
        const messaging = await resolveMessaging();
        if (!declarativeSupported && !messaging) return { ok: false, reason: 'unsupported' };
        if (!allowRegistration) {
            const currentDevice = await getCurrentDeviceRegistration(user.uid);
            if (currentDevice?.enabled && (currentDevice?.hasToken || currentDevice?.hasWebPushSubscription)) {
                if (currentDevice?.hasToken) await registerForegroundListener();
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
        let declarativeSubscription = null;
        if (declarativeSupported && effectiveSwRegistration) {
            const declarativeResult = await ensureDeclarativeSubscription({
                swRegistration: effectiveSwRegistration,
                requestIfMissing: allowRegistration
            });
            if (declarativeResult?.ok && declarativeResult.subscription) {
                declarativeSubscription = declarativeResult.subscription;
            }
        }

        let token = '';
        if (messaging && !declarativeSubscription) {
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
        }
        if (token === '__TOKEN_TIMEOUT__') {
            return { ok: false, reason: 'token-timeout' };
        }
        lastKnownToken = token || '';
        if (!token && !declarativeSubscription) {
            await removeCurrentDevice(user.uid);
            stopForegroundListener();
            return { ok: false, reason: 'token-empty' };
        }
        await upsertDevice({
            uid: user.uid,
            enabled: true,
            permission,
            token,
            webPushSubscription: declarativeSubscription,
            channel: declarativeSubscription ? 'declarative-web-push' : 'fcm'
        });
        if (token) await registerForegroundListener();
        return {
            ok: true,
            reason: declarativeSubscription ? 'registered-declarative' : 'registered',
            token
        };
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
