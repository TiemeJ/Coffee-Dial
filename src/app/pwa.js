// IMPORTANT:
// Bump this value every time `sw.js` changes.
// This forces service-worker update pickup across browsers/PWAs.
const SW_VERSION = '2026-03-06.1';
const PUSH_INTENT_CACHE = 'coffee-dial-push-intent-v1';
const PUSH_INTENT_CACHE_KEY = '/__coffee_dial_push_intent__';
const PUSH_INTENT_MAX_AGE_MS = 3 * 60 * 1000;

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
        return;
    }
    try {
        window.history.replaceState(window.history.state || {}, document.title, targetPath);
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state || {} }));
        await consumePendingPushIntent(intent);
    } catch (_) {}
};

const applyLaunchTargetUrlIfNeeded = async (rawTargetUrl, reason = 'launchQueue') => {
    const target = `${rawTargetUrl || ''}`.trim();
    if (!target) return false;
    let targetUrl = null;
    try {
        targetUrl = new URL(target, window.location.origin);
    } catch (_) {
        return false;
    }
    if (!targetUrl.searchParams.has('moments')) return false;
    const targetPath = `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`;
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    if (targetPath === current) return true;
    try {
        window.history.replaceState(window.history.state || {}, document.title, targetPath);
        window.dispatchEvent(new PopStateEvent('popstate', { state: window.history.state || {} }));
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
            .then(() => {
                console.log('Service Worker Registered');
            })
            .catch((err) => console.log('Service Worker Failed', err));
    };

    window.addEventListener('focus', () => {
        applyPendingPushIntentIfNeeded('focus');
    });
    window.addEventListener('pageshow', () => {
        applyPendingPushIntentIfNeeded('pageshow');
    });
    document.addEventListener('visibilitychange', () => {
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
                applyLaunchTargetUrlIfNeeded(targetUrl, 'launchQueue');
            });
        } catch (_) {}
    }

    if (document.readyState === 'complete') {
        register();
        return;
    }
    window.addEventListener('load', register, { once: true });
};
