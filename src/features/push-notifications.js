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
    const { db, doc, setDoc } = dataService || {};
    const {
        getMessaging,
        getToken,
        deleteToken,
        onMessage,
        isSupported,
        app
    } = messagingApi || {};
    if (!db || !doc || !setDoc) {
        throw new Error('createPushNotificationsModule requires dataService { db, doc, setDoc }');
    }
    if (!getMessaging || !getToken || !deleteToken || !isSupported || !app) {
        throw new Error('createPushNotificationsModule requires messagingApi { getMessaging, getToken, deleteToken, isSupported, app }');
    }

    let messagingInstance = null;
    let foregroundUnsubscribe = null;
    let lastKnownToken = '';

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
        if (!uid) return;
        const deviceId = getDeviceId();
        const payload = {
            token: token || '',
            enabled: !!enabled,
            permission: permission || 'default',
            platform: 'web',
            userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent || '') : '',
            updatedAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'users', uid, 'devices', deviceId), payload, { merge: true });
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
        if (!user?.uid) return;
        const permission = getNotificationPermission();
        const messaging = await resolveMessaging();
        if (messaging && lastKnownToken) {
            try { await deleteToken(messaging); } catch (_) {}
            lastKnownToken = '';
        }
        await upsertDevice({
            uid: user.uid,
            enabled: false,
            permission,
            token: ''
        });
        stopForegroundListener();
    };

    const initForCurrentUser = async () => {
        const user = getCurrentUser?.();
        if (!user?.uid) return;
        const prefs = normalizeNotificationPreferences(getNotificationPreferences?.());
        const permissionBefore = getNotificationPermission();
        if (!prefs.pushEnabled) {
            await upsertDevice({
                uid: user.uid,
                enabled: false,
                permission: permissionBefore,
                token: ''
            });
            stopForegroundListener();
            return;
        }
        if (!vapidKey) {
            console.warn('Push enabled but no VAPID key configured.');
            if (typeof showToast === 'function') {
                showToast('Push setup incomplete: missing VAPID key.');
            }
            return;
        }
        const messaging = await resolveMessaging();
        if (!messaging) return;

        let permission = permissionBefore;
        if (permission === 'default' && typeof Notification !== 'undefined' && typeof Notification.requestPermission === 'function') {
            permission = await Notification.requestPermission();
        }
        if (permission !== 'granted') {
            await upsertDevice({
                uid: user.uid,
                enabled: false,
                permission,
                token: ''
            });
            stopForegroundListener();
            return;
        }

        const swRegistration = (typeof navigator !== 'undefined' && navigator.serviceWorker)
            ? await navigator.serviceWorker.ready.catch(() => null)
            : null;
        const token = await getToken(messaging, {
            vapidKey,
            serviceWorkerRegistration: swRegistration || undefined
        });
        lastKnownToken = token || '';
        await upsertDevice({
            uid: user.uid,
            enabled: !!token,
            permission,
            token: token || ''
        });
        await registerForegroundListener();
    };

    const handlePreferencesChanged = async () => {
        const prefs = normalizeNotificationPreferences(getNotificationPreferences?.());
        if (prefs.pushEnabled) return initForCurrentUser();
        return disableForCurrentUser();
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
