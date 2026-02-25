// SERVICE WORKER VERSION MARKER
// IMPORTANT: bump this when editing this file, and keep it in sync with
// `SW_VERSION` in `src/app/pwa.js`.
const SW_VERSION = '2026-02-25.3';
self.__COFFEE_DIAL_SW_VERSION = SW_VERSION;

const MOMENTS_FALLBACK_LINK = '/Coffee-Dial/?moments';
const SW_DIAG_MESSAGE_TYPE = 'coffee-dial-sw-diagnostic';
const SW_DIAG_LOG_PREFIX = '[CoffeeDial SW]';

const createDiagEntry = (eventType, details = {}) => ({
    ts: new Date().toISOString(),
    swVersion: SW_VERSION,
    eventType,
    details
});

const publishDiagnostics = async (entry) => {
    try {
        console.info(`${SW_DIAG_LOG_PREFIX} ${entry.eventType}`, entry);
    } catch (_) {}
    try {
        const targets = await clients.matchAll({ type: 'window', includeUncontrolled: true });
        targets.forEach((client) => {
            try {
                client.postMessage({
                    type: SW_DIAG_MESSAGE_TYPE,
                    payload: entry
                });
            } catch (_) {}
        });
    } catch (_) {}
};

const logDiagnostics = (eventType, details = {}) => publishDiagnostics(createDiagEntry(eventType, details));

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

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

self.addEventListener('install', (event) => {
    event.waitUntil(logDiagnostics('install', { scope: self.registration?.scope || '' }));
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        try {
            await self.clients.claim();
        } catch (_) {}
        await logDiagnostics('activate', {
            scope: self.registration?.scope || '',
            clientsClaimed: true
        });
    })());
});

self.addEventListener('message', (event) => {
    const type = event?.data?.type || '';
    if (type !== 'SKIP_WAITING') return;
    event.waitUntil((async () => {
        await logDiagnostics('message_skip_waiting_received');
        try {
            await self.skipWaiting();
            await logDiagnostics('message_skip_waiting_ok');
        } catch (error) {
            await logDiagnostics('message_skip_waiting_error', {
                error: error?.message || String(error)
            });
        }
    })());
});

self.addEventListener('push', (event) => {
    const payload = parsePushPayload(event);
    if (!payload) {
        event.waitUntil(logDiagnostics('push_payload_missing_or_invalid'));
        return;
    }

    const title = payload?.notification?.title || payload?.data?.title || 'Coffee Dial';
    const body = payload?.notification?.body || payload?.data?.body || '';
    const link = normalizeLink(payload?.data?.link || payload?.fcmOptions?.link || MOMENTS_FALLBACK_LINK);

    event.waitUntil((async () => {
        await logDiagnostics('push_received', {
            hasNotification: !!payload?.notification,
            hasData: !!payload?.data,
            hasWebPushFlag: payload?.web_push === 8030,
            link,
            payloadKeys: Object.keys(payload || {})
        });
        await self.registration.showNotification(title, {
            body,
            icon: '/img/icon-192.png',
            data: { link }
        });
        await logDiagnostics('push_show_notification_ok', { link, title });
    })());
});

self.addEventListener('notificationclick', (event) => {
    const link = normalizeLink(event?.notification?.data?.link || MOMENTS_FALLBACK_LINK);
    event.notification.close();
    event.waitUntil((async () => {
        const existingClients = await clients.matchAll({ type: 'window', includeUncontrolled: true }).catch(() => []);
        await logDiagnostics('notification_click', {
            link,
            existingClientCount: existingClients.length,
            existingClientUrls: existingClients.map((client) => client.url || '')
        });
        try {
            const appClient = existingClients.find((client) => {
                const url = `${client?.url || ''}`;
                return url.includes('/Coffee-Dial/');
            }) || null;
            if (appClient && typeof appClient.navigate === 'function') {
                let navigated = null;
                try {
                    navigated = await appClient.navigate(link);
                } catch (_) {
                    navigated = appClient;
                }
                try {
                    await (navigated || appClient).focus();
                } catch (_) {}
                await logDiagnostics('notification_navigate_existing_client_ok', {
                    link,
                    targetClientUrl: (navigated || appClient)?.url || null
                });
                return;
            }
            const opened = await clients.openWindow(link);
            await logDiagnostics('notification_open_window_ok', { link, openedClientUrl: opened?.url || null });
        } catch (error) {
            await logDiagnostics('notification_open_window_error', {
                link,
                error: error?.message || String(error)
            });
        }
    })());
});
