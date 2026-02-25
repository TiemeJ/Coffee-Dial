// IMPORTANT:
// Bump this value every time `sw.js` changes.
// This forces service-worker update pickup across browsers/PWAs.
const SW_VERSION = '2026-02-25.6';
const SW_DIAG_MESSAGE_TYPE = 'coffee-dial-sw-diagnostic';
const SW_DIAG_PREFIX = '[CoffeeDial SW Diag]';
const PUSH_INTENT_CACHE = 'coffee-dial-push-intent-v1';
const PUSH_INTENT_CACHE_KEY = '/__coffee_dial_push_intent__';
const PUSH_INTENT_MAX_AGE_MS = 3 * 60 * 1000;

const pushSwDiagnosticEntry = (entry) => {
    if (typeof window === 'undefined') return;
    const next = {
        tsClient: new Date().toISOString(),
        href: window.location?.href || '',
        ...(entry || {})
    };
    const list = Array.isArray(window.__coffeeDialPushDiagnostics)
        ? window.__coffeeDialPushDiagnostics
        : [];
    list.push(next);
    while (list.length > 200) list.shift();
    window.__coffeeDialPushDiagnostics = list;
    try {
        console.info(`${SW_DIAG_PREFIX} ${next.eventType || 'event'}`, next);
    } catch (_) {}
};

const readPendingPushIntent = async () => {
    if (typeof caches === 'undefined') return null;
    try {
        const cache = await caches.open(PUSH_INTENT_CACHE);
        const res = await cache.match(new Request(PUSH_INTENT_CACHE_KEY, { cache: 'no-store' }));
        if (!res) return null;
        const data = await res.json().catch(() => null);
        if (!data || typeof data !== 'object') return null;
        return data;
    } catch (_) {
        return null;
    }
};

const writePendingPushIntent = async (intent) => {
    if (typeof caches === 'undefined') return;
    try {
        const cache = await caches.open(PUSH_INTENT_CACHE);
        await cache.put(
            new Request(PUSH_INTENT_CACHE_KEY, { cache: 'no-store' }),
            new Response(JSON.stringify(intent || {}), {
                headers: { 'content-type': 'application/json' }
            })
        );
    } catch (_) {}
};

const consumePendingPushIntent = async (intent = null) => {
    const current = intent || await readPendingPushIntent();
    if (!current) return;
    await writePendingPushIntent({
        ...current,
        consumed: true,
        consumedAt: new Date().toISOString()
    });
};

const applyPendingPushIntentIfNeeded = async (reason = 'unknown') => {
    const intent = await readPendingPushIntent();
    if (!intent) return;
    const link = `${intent.link || ''}`.trim();
    const tsMs = Date.parse(intent.ts || '');
    const ageMs = Number.isFinite(tsMs) ? (Date.now() - tsMs) : Number.POSITIVE_INFINITY;
    if (!link || intent.consumed === true || ageMs > PUSH_INTENT_MAX_AGE_MS) return;

    let targetUrl = null;
    try {
        targetUrl = new URL(link, window.location.origin);
    } catch (_) {
        return;
    }
    if (!targetUrl.searchParams.has('moments')) return;

    const current = new URL(window.location.href);
    const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    const currentPath = `${current.pathname}${current.search}${current.hash}`;
    if (currentPath === targetPath) {
        await consumePendingPushIntent(intent);
        pushSwDiagnosticEntry({
            eventType: 'client_pending_push_intent_already_at_target',
            reason,
            link: targetUrl.toString()
        });
        return;
    }
    try {
        window.history.replaceState(window.history.state || {}, document.title, targetPath);
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state || {} }));
        await consumePendingPushIntent(intent);
        pushSwDiagnosticEntry({
            eventType: 'client_pending_push_intent_applied',
            reason,
            link: targetUrl.toString()
        });
    } catch (_) {}
};

const applyLaunchTargetUrlIfNeeded = async (rawTargetUrl, reason = 'launchQueue') => {
    const target = `${rawTargetUrl || ''}`.trim();
    if (!target) {
        pushSwDiagnosticEntry({
            eventType: 'client_launch_target_empty',
            reason
        });
        return false;
    }
    let targetUrl = null;
    try {
        targetUrl = new URL(target, window.location.origin);
    } catch (_) {
        pushSwDiagnosticEntry({
            eventType: 'client_launch_target_invalid',
            reason,
            link: target
        });
        return false;
    }
    if (!targetUrl.searchParams.has('moments')) {
        pushSwDiagnosticEntry({
            eventType: 'client_launch_target_ignored',
            reason,
            link: targetUrl.toString()
        });
        return false;
    }
    const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (targetPath === current) {
        pushSwDiagnosticEntry({
            eventType: 'client_launch_target_already_active',
            reason,
            link: targetUrl.toString()
        });
        return true;
    }
    try {
        window.history.replaceState(window.history.state || {}, document.title, targetPath);
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state || {} }));
        pushSwDiagnosticEntry({
            eventType: 'client_launch_target_applied',
            reason,
            link: targetUrl.toString()
        });
        return true;
    } catch (_) {
        return false;
    }
};

const resolveSwScriptUrl = () => {
    const pathname = window.location?.pathname || '/';
    const isGithubPages = (window.location?.hostname || '').endsWith('github.io');
    const basePath = pathname === '/Coffee-Dial' || pathname.startsWith('/Coffee-Dial/') || isGithubPages
        ? '/Coffee-Dial'
        : '';
    return `${basePath}/sw.js?v=${encodeURIComponent(SW_VERSION)}`;
};

export const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
        navigator.serviceWorker.register(resolveSwScriptUrl())
            .then((registration) => {
                console.log('Service Worker Registered');
                pushSwDiagnosticEntry({
                    eventType: 'client_sw_registered',
                    swVersion: SW_VERSION,
                    scope: registration?.scope || ''
                });
            })
            .catch((err) => console.log('Service Worker Failed', err));
    };

    navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event?.data || null;
        if (!data || data.type !== SW_DIAG_MESSAGE_TYPE) return;
        pushSwDiagnosticEntry(data.payload || {});
    });
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        pushSwDiagnosticEntry({
            eventType: 'client_controllerchange',
            visibilityState: document.visibilityState
        });
    });

    window.addEventListener('focus', () => {
        pushSwDiagnosticEntry({
            eventType: 'client_focus',
            visibilityState: document.visibilityState
        });
        applyPendingPushIntentIfNeeded('focus');
    });
    window.addEventListener('pageshow', () => {
        pushSwDiagnosticEntry({
            eventType: 'client_pageshow',
            visibilityState: document.visibilityState
        });
        applyPendingPushIntentIfNeeded('pageshow');
    });
    document.addEventListener('visibilitychange', () => {
        pushSwDiagnosticEntry({
            eventType: 'client_visibilitychange',
            visibilityState: document.visibilityState
        });
        if (!document.hidden) applyPendingPushIntentIfNeeded('visibilitychange-visible');
    });
    if (typeof window !== 'undefined' && 'launchQueue' in window) {
        try {
            window.launchQueue.setConsumer((launchParams) => {
                const targetUrl =
                    launchParams?.targetURL ||
                    launchParams?.url ||
                    launchParams?.targetUrl ||
                    '';
                pushSwDiagnosticEntry({
                    eventType: 'client_launch_queue',
                    link: targetUrl || '-'
                });
                applyLaunchTargetUrlIfNeeded(targetUrl, 'launchQueue');
            });
            pushSwDiagnosticEntry({
                eventType: 'client_launch_queue_registered'
            });
        } catch (_) {}
    } else {
        pushSwDiagnosticEntry({
            eventType: 'client_launch_queue_unavailable'
        });
    }

    if (document.readyState === 'complete') {
        register();
        return;
    }
    window.addEventListener('load', register, { once: true });
};
