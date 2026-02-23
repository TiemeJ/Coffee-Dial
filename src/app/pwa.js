export const registerServiceWorker = () => {
    if (!('serviceWorker' in navigator)) return;

    const register = () => {
        navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker Registered'))
            .catch((err) => console.log('Service Worker Failed', err));
    };

    if (document.readyState === 'complete') {
        register();
        return;
    }
    window.addEventListener('load', register, { once: true });
};
