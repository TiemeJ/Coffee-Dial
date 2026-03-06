import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

export const firebaseConfig = {
    apiKey: 'AIzaSyAjKRgCrNuwaAvjOJPzTrmippI2sv5QG6M',
    authDomain: 'coffee-dial-app-9db38.firebaseapp.com',
    projectId: 'coffee-dial-app-9db38',
    storageBucket: 'coffee-dial-app-9db38.firebasestorage.app',
    messagingSenderId: '513325852224',
    appId: '1:513325852224:web:0af5f15c4968a5bfad61a5'
};

export const BAG_AI_URL = 'https://analyzecoffeebag-p522o3qtpa-uc.a.run.app';
export const STATS_AI_URL = 'https://analyzebrewprofile-p522o3qtpa-uc.a.run.app';
export const WEB_PUSH_VAPID_KEY = 'BEyGyjZoS52SNCQedvEPYEWht5Kuk_N2lZbVrtLbWUNX5tA1US6Us2XeE9WhMsTLTW_BEkHAzWKXc9loPkGtoK0';

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Enable IndexedDB persistence for offline support and faster repeat visits
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});
export const provider = new GoogleAuthProvider();

let functionsInstancePromise = null;
let functionsApiPromise = null;
let messagingApiPromise = null;
let storageInstancePromise = null;
let storageApiPromise = null;

export const loadFunctionsApi = () => {
    if (!functionsApiPromise) {
        functionsApiPromise = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js');
    }
    return functionsApiPromise;
};

export const getFunctionsInstance = async () => {
    if (!functionsInstancePromise) {
        functionsInstancePromise = loadFunctionsApi().then(({ getFunctions }) => getFunctions(app, 'us-central1'));
    }
    return functionsInstancePromise;
};

export const loadMessagingApi = () => {
    if (!messagingApiPromise) {
        messagingApiPromise = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js');
    }
    return messagingApiPromise;
};

export const loadStorageApi = () => {
    if (!storageApiPromise) {
        storageApiPromise = import('https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js');
    }
    return storageApiPromise;
};

export const getStorageInstance = async () => {
    if (!storageInstancePromise) {
        storageInstancePromise = loadStorageApi().then(({ getStorage }) => getStorage(app));
    }
    return storageInstancePromise;
};
