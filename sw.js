/* global firebase */

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

const MOMENTS_FALLBACK_PATH = '/Coffee-Dial/moments';
const recentlyHandledNotifications = new Map();

const normalizeLink = (value) => {
    const raw = typeof value === 'string' && value.trim() ? value.trim() : MOMENTS_FALLBACK_PATH;
    try {
        return new URL(raw, self.location.origin).toString();
    } catch (_) {
        return `${self.location.origin}${MOMENTS_FALLBACK_PATH}`;
    }
};

const normalizePayload = (payload) => {
    const source = payload || {};
    const data = source.data && typeof source.data === 'object' ? source.data : {};
    const notification = source.notification && typeof source.notification === 'object' ? source.notification : {};
    const title = data.title || notification.title || 'Coffee Dial';
    const body = data.body || notification.body || '';
    const link = normalizeLink(data.link || source?.fcmOptions?.link || MOMENTS_FALLBACK_PATH);
    const messageKey = data.messageId ||
        data.googleMessageId ||
        source.messageId ||
        source.fcmMessageId ||
        `${title}|${body}|${link}`;
    return { title, body, link, messageKey };
};

const shouldHandleMessage = (messageKey) => {
    if (!messageKey) return true;
    const now = Date.now();
    const seenAt = recentlyHandledNotifications.get(messageKey);
    if (seenAt && now - seenAt < 10000) return false;
    recentlyHandledNotifications.set(messageKey, now);
    for (const [key, ts] of recentlyHandledNotifications.entries()) {
        if (now - ts > 60000) recentlyHandledNotifications.delete(key);
    }
    return true;
};

const showMomentNotification = async (payload) => {
    const normalized = normalizePayload(payload);
    if (!shouldHandleMessage(normalized.messageKey)) return;
    await self.registration.showNotification(normalized.title, {
        body: normalized.body,
        icon: '/img/icon-192.png',
        tag: normalized.messageKey,
        data: {
            link: normalized.link,
            route: '/moments'
        }
    });
};

const extractPushPayload = (event) => {
    if (!event || !event.data) return null;
    try {
        return event.data.json();
    } catch (_) {
        try {
            const text = event.data.text();
            return text ? JSON.parse(text) : null;
        } catch (_) {
            return null;
        }
    }
};

try {
    importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

    firebase.initializeApp({
        apiKey: 'AIzaSyAjKRgCrNuwaAvjOJPzTrmippI2sv5QG6M',
        authDomain: 'coffee-dial-app-9db38.firebaseapp.com',
        projectId: 'coffee-dial-app-9db38',
        storageBucket: 'coffee-dial-app-9db38.firebasestorage.app',
        messagingSenderId: '513325852224',
        appId: '1:513325852224:web:0af5f15c4968a5bfad61a5'
    });

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
        showMomentNotification(payload).catch((error) => {
            console.warn('Background message notification display failed', error);
        });
    });
} catch (error) {
    console.warn('Push service worker init skipped', error);
}

self.addEventListener('push', (event) => {
    const payload = extractPushPayload(event);
    if (!payload) return;
    event.waitUntil(
        showMomentNotification(payload).catch((error) => {
            console.warn('Push event notification display failed', error);
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    const link = normalizeLink(event?.notification?.data?.link || MOMENTS_FALLBACK_PATH);
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client) {
                    try { await client.navigate(link); } catch (_) {}
                    try {
                        client.postMessage({
                            type: 'coffee-dial-open-route',
                            route: '/moments',
                            url: link
                        });
                    } catch (_) {}
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(link);
            return null;
        })
    );
});
