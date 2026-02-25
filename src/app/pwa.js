// IMPORTANT:
// Bump this value every time `sw.js` changes.
// This forces service-worker update pickup across browsers/PWAs.
const SW_VERSION = '2026-02-25.1';
const SW_DIAG_MESSAGE_TYPE = 'coffee-dial-sw-diagnostic';
const SW_DIAG_PREFIX = '[CoffeeDial SW Diag]';

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

    window.addEventListener('focus', () => {
        pushSwDiagnosticEntry({
            eventType: 'client_focus',
            visibilityState: document.visibilityState
        });
    });
    window.addEventListener('pageshow', () => {
        pushSwDiagnosticEntry({
            eventType: 'client_pageshow',
            visibilityState: document.visibilityState
        });
    });
    document.addEventListener('visibilitychange', () => {
        pushSwDiagnosticEntry({
            eventType: 'client_visibilitychange',
            visibilityState: document.visibilityState
        });
    });

    if (document.readyState === 'complete') {
        register();
        return;
    }
    window.addEventListener('load', register, { once: true });
};
