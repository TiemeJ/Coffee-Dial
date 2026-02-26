import { getApp, getApps, initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const firebaseConfig = {
    apiKey: 'AIzaSyAjKRgCrNuwaAvjOJPzTrmippI2sv5QG6M',
    authDomain: 'coffee-dial-app-9db38.firebaseapp.com',
    projectId: 'coffee-dial-app-9db38',
    storageBucket: 'coffee-dial-app-9db38.firebasestorage.app',
    messagingSenderId: '513325852224',
    appId: '1:513325852224:web:0af5f15c4968a5bfad61a5'
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
