/* global firebase */

self.addEventListener('fetch', (event) => {
    event.respondWith(fetch(event.request));
});

try {
    importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
    importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

    firebase.initializeApp({
        apiKey: 'AIzaSyAjKRgCrNuwaAvjOJPzTrmippI2sv5QG6M',
        authDomain: 'coffee-dial-app-9db38.firebaseapp.com',
        projectId: 'coffee-dial-app-9db38',
        storageBucket: 'coffee-dial-app-9db38.firebasestorage.app',
        messagingSenderId: '513325852224',
        appId: '1:513325852224:web:0af5f15c4968a5bfad61a5'
    });

    const normalizeLink = (value) => {
        const raw = typeof value === 'string' && value.trim() ? value.trim() : '/Coffee-Dial/moments';
        try {
            return new URL(raw, self.location.origin).toString();
        } catch (_) {
            return `${self.location.origin}/Coffee-Dial/moments`;
        }
    };

    const messaging = firebase.messaging();
    messaging.onBackgroundMessage((payload) => {
        const title = payload?.data?.title || payload?.notification?.title || 'Coffee Dial';
        const body = payload?.data?.body || payload?.notification?.body || '';
        const link = normalizeLink(payload?.data?.link || payload?.fcmOptions?.link || '/Coffee-Dial/moments');
        self.registration.showNotification(title, {
            body,
            icon: '/img/icon-192.png',
            data: { link }
        });
    });
} catch (error) {
    console.warn('Push service worker init skipped', error);
}

self.addEventListener('notificationclick', (event) => {
    const normalizeLink = (value) => {
        const raw = typeof value === 'string' && value.trim() ? value.trim() : '/Coffee-Dial/moments';
        try {
            return new URL(raw, self.location.origin).toString();
        } catch (_) {
            return `${self.location.origin}/Coffee-Dial/moments`;
        }
    };
    const link = normalizeLink(event?.notification?.data?.link || '/Coffee-Dial/moments');
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if ('focus' in client) {
                    client.navigate(link);
                    return client.focus();
                }
            }
            if (clients.openWindow) return clients.openWindow(link);
            return null;
        })
    );
});
