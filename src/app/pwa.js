// IMPORTANT:
// Bump this value every time `sw.js` changes.
// This forces service-worker update pickup across browsers/PWAs.
const SW_VERSION = '2026-02-24.1';

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
            .then(() => console.log('Service Worker Registered'))
            .catch((err) => console.log('Service Worker Failed', err));
    };

    if (document.readyState === 'complete') {
        register();
        return;
    }
    window.addEventListener('load', register, { once: true });
};
