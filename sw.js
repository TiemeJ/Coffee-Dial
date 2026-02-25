// SERVICE WORKER VERSION MARKER
// IMPORTANT: bump this when editing this file, and keep it in sync with
// `SW_VERSION` in `src/app/pwa.js`.
const SW_VERSION = '2026-02-25.6';
self.__COFFEE_DIAL_SW_VERSION = SW_VERSION;

const MOMENTS_FALLBACK_LINK = '/Coffee-Dial/?moments';
const SW_DIAG_MESSAGE_TYPE = 'coffee-dial-sw-diagnostic';
const SW_DIAG_LOG_PREFIX = '[CoffeeDial SW]';
const PUSH_INTENT_CACHE = 'coffee-dial-push-intent-v1';
const PUSH_INTENT_CACHE_KEY = '/__coffee_dial_push_intent__';
const STATIC_ASSET_CACHE_PREFIX = 'coffee-dial-static-assets-';
const STATIC_ASSET_CACHE = `${STATIC_ASSET_CACHE_PREFIX}${SW_VERSION}`;
const STATIC_ASSET_EXTENSIONS = /\.(?:js|css|woff2?|ttf|otf|eot|svg|png|jpe?g|webp|gif|ico|mp4|webm|json)$/i;

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

const savePushIntent = async ({ link = '', source = '' } = {}) => {
    try {
        const cache = await caches.open(PUSH_INTENT_CACHE);
        const payload = {
            ts: new Date().toISOString(),
            link,
            source: source || 'push',
            consumed: false,
            swVersion: SW_VERSION
        };
        await cache.put(
            new Request(PUSH_INTENT_CACHE_KEY, { cache: 'no-store' }),
            new Response(JSON.stringify(payload), {
                headers: { 'content-type': 'application/json' }
            })
        );
    } catch (_) {}
};

const markPushIntentConsumed = async () => {
    try {
        const cache = await caches.open(PUSH_INTENT_CACHE);
        const req = new Request(PUSH_INTENT_CACHE_KEY, { cache: 'no-store' });
        const existing = await cache.match(req);
        if (!existing) return;
        const data = await existing.json().catch(() => ({}));
        const next = {
            ...(data || {}),
            consumed: true,
            consumedAt: new Date().toISOString()
        };
        await cache.put(
            req,
            new Response(JSON.stringify(next), {
                headers: { 'content-type': 'application/json' }
            })
        );
    } catch (_) {}
};

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

const isStaticAssetRequest = (request) => {
    if (!request || request.method !== 'GET') return false;
    let url = null;
    try {
        url = new URL(request.url);
    } catch (_) {
        return false;
    }
    if (url.origin !== self.location.origin) return false;
    if (request.mode === 'navigate') return false;
    return STATIC_ASSET_EXTENSIONS.test(url.pathname);
};

const putInStaticCache = async (request, response) => {
    if (!response || !response.ok || response.type !== 'basic') return;
    try {
        const cache = await caches.open(STATIC_ASSET_CACHE);
        await cache.put(request, response.clone());
    } catch (_) {}
};

const serveWithStaticCache = async (event) => {
    const request = event.request;
    const cache = await caches.open(STATIC_ASSET_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;

    try {
        const networkResponse = await fetch(request);
        await putInStaticCache(request, networkResponse);
        return networkResponse;
    } catch (_) {
        const fallback = await cache.match(request);
        if (fallback) return fallback;
        throw _;
    }
};

self.addEventListener('fetch', (event) => {
    if (isStaticAssetRequest(event.request)) {
        event.respondWith(serveWithStaticCache(event));
        return;
    }
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
        try {
            const keys = await caches.keys();
            await Promise.all(
                keys
                    .filter((key) => key.startsWith(STATIC_ASSET_CACHE_PREFIX) && key !== STATIC_ASSET_CACHE)
                    .map((key) => caches.delete(key))
            );
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
        await savePushIntent({
            link,
            source: payload?.web_push === 8030 ? 'declarative' : 'fcm'
        });
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
        await markPushIntentConsumed();
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
