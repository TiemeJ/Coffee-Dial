// SERVICE WORKER VERSION MARKER
// IMPORTANT: bump this when editing this file, and keep it in sync with
// `SW_VERSION` in `src/app/pwa.js`.
const SW_VERSION = '2026-02-24.1';
self.__COFFEE_DIAL_SW_VERSION = SW_VERSION;

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});
