// This is a "Dummy" Service Worker to satisfy Chrome's PWA requirements.
self.addEventListener('fetch', function(event) {
    // It doesn't need to do anything, just exist.
    event.respondWith(fetch(event.request));
});
