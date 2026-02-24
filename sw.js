// SERVICE WORKER VERSION MARKER
// IMPORTANT: bump this when editing this file, and keep it in sync with
// `SW_VERSION` in `src/app/pwa.js`.
const SW_VERSION = '2026-02-24.2';
self.__COFFEE_DIAL_SW_VERSION = SW_VERSION;

const MOMENTS_FALLBACK_LINK = '/Coffee-Dial/?moments';

const normalizeLink = (value) => {
    const raw = typeof value === 'string' && value.trim() ? value.trim() : MOMENTS_FALLBACK_LINK;
    try {
        return new URL(raw, self.location.origin).toString();
    } catch (_) {
        return `${self.location.origin}${MOMENTS_FALLBACK_LINK}`;
    }
};

const parsePushPayload = (event) => {
    if (!event?.data) return null;
    try {
        return event.data.json();
    } catch (_) {
        return null;
    }
};

const isIOSWebKit = () => {
    const ua = self.navigator?.userAgent || '';
    if (!ua) return false;
    const isAppleMobile = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && /Mobile/i.test(ua));
    return isAppleMobile && /AppleWebKit/i.test(ua);
};

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

self.addEventListener('push', (event) => {
    const payload = parsePushPayload(event);
    if (!payload) return;

    const hasNotificationPayload = !!payload.notification;
    const shouldManuallyShow = isIOSWebKit() || !hasNotificationPayload;
    if (!shouldManuallyShow) return;

    const title = payload?.notification?.title || payload?.data?.title || 'Coffee Dial';
    const body = payload?.notification?.body || payload?.data?.body || '';
    const link = normalizeLink(payload?.data?.link || payload?.fcmOptions?.link || MOMENTS_FALLBACK_LINK);

    event.waitUntil(
        self.registration.showNotification(title, {
            body,
            icon: '/img/icon-192.png',
            data: { link }
        })
    );
});

self.addEventListener('notificationclick', (event) => {
    const link = normalizeLink(event?.notification?.data?.link || MOMENTS_FALLBACK_LINK);
    event.notification.close();
    event.waitUntil(
        clients.openWindow(link).catch(() => null)
    );
});
