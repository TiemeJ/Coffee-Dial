import { mountShellHeader } from '../features/shell/shell.controller.js';
import { mountSignedOutAuth } from '../features/auth/auth.controller.js';
import { mountUiShellView } from '../features/ui-shell/ui-shell.mount.js';

const T0 = performance.now();
const logTime = (label) => console.log(`[PERF] ${label}: ${(performance.now() - T0).toFixed(0)}ms`);
logTime('bootstrap.js loaded');

const shouldAutoLoadFullAppByUrl = () => {
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    if (search.get('e2eSeed') === '1') return true;
    const mode = search.get('mode');
    const oobCode = search.get('oobCode');
    return mode === 'signIn' && !!oobCode;
};

const startFullApp = async ({ actionName = null } = {}) => {
    const { startFullApp: runFullBootstrap } = await import('./full-bootstrap.js');
    return runFullBootstrap({ actionName });
};

const startGoogleSignIn = async () => {
    const [{ auth, provider }, { signInWithPopup, signInWithRedirect }] = await Promise.all([
        import('../config/firebase-session.js'),
        import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js')
    ]);

    try {
        await signInWithPopup(auth, provider);
        await startFullApp();
    } catch (error) {
        const code = error?.code || '';
        const shouldFallbackToRedirect =
            code === 'auth/popup-blocked' ||
            code === 'auth/popup-closed-by-user' ||
            code === 'auth/cancelled-popup-request';
        if (!shouldFallbackToRedirect) throw error;

        try {
            sessionStorage.setItem('coffeeDialPendingAuthRedirect', '1');
        } catch (_) {
            // no-op
        }
        await signInWithRedirect(auth, provider);
    }
};

const hasActiveSession = async () => {
    logTime('hasActiveSession: start');
    const [{ auth }, { onAuthStateChanged }] = await Promise.all([import('../config/firebase-session.js'), import('https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js')]);
    logTime('hasActiveSession: firebase imports done');

    if (typeof auth.authStateReady === 'function') {
        await auth.authStateReady();
        return !!auth.currentUser;
    }

    return new Promise((resolve) => {
        const unsubscribe = onAuthStateChanged(
            auth,
            (user) => {
                unsubscribe();
                logTime(`hasActiveSession: resolved (user=${!!user})`);
                resolve(!!user);
            },
            () => resolve(false)
        );
    });
};

const wireSignedOutActions = () => {
    const signInBtn = document.querySelector('[data-action-click="googleLogin()"]');
    if (signInBtn && !signInBtn.dataset.fullBootstrapBound) {
        signInBtn.dataset.fullBootstrapBound = '1';
        signInBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await startGoogleSignIn();
        });
    }

    const emailLinkBtn = document.getElementById('emailLinkLoginBtn');
    if (emailLinkBtn && !emailLinkBtn.dataset.fullBootstrapBound) {
        emailLinkBtn.dataset.fullBootstrapBound = '1';
        emailLinkBtn.addEventListener('click', async (event) => {
            event.preventDefault();
            event.stopPropagation();
            await startFullApp({ actionName: 'sendEmailLinkLogin' });
        });
    }
};

const mountSignedOutShell = async () => {
    await mountShellHeader();
    await mountUiShellView();
    await mountSignedOutAuth();
    const authContainer = document.getElementById('authContainer');
    if (authContainer) {
        authContainer.classList.remove('invisible');
        authContainer.innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center gap-2"><button id="headerGoogleLoginBtn" class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.5-1.76 4.4-5.27 4.4-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.8 0 3 .77 3.69 1.43l2.52-2.43C16.84 4.28 14.7 3.4 12.18 3.4 7.23 3.4 3.2 7.47 3.2 12.57s4.03 9.17 8.98 9.17c5.18 0 8.61-3.64 8.61-8.76 0-.59-.06-1.04-.14-1.48z"></path></svg><span>Sign in</span></button></div>`;
        const headerGoogleLoginBtn = document.getElementById('headerGoogleLoginBtn');
        if (headerGoogleLoginBtn) {
            headerGoogleLoginBtn.addEventListener('click', async (event) => {
                event.preventDefault();
                event.stopPropagation();
                await startGoogleSignIn();
            });
        }
    }
    document.getElementById('signedOutAuthBody')?.classList.remove('hidden');
    document.getElementById('appBootstrapLoading')?.classList.add('hidden');
    wireSignedOutActions();
};

let hasPendingAuthRedirect = false;
try {
    hasPendingAuthRedirect = sessionStorage.getItem('coffeeDialPendingAuthRedirect') === '1';
} catch (_) {
    // no-op
}

const shouldStartFullApp = shouldAutoLoadFullAppByUrl() || hasPendingAuthRedirect || (await hasActiveSession());
logTime(`shouldStartFullApp=${shouldStartFullApp}`);
if (shouldStartFullApp) {
    try {
        sessionStorage.removeItem('coffeeDialPendingAuthRedirect');
    } catch (_) {
        // no-op
    }
    logTime('startFullApp: calling');
    await startFullApp();
    logTime('startFullApp: done');
} else {
    await mountSignedOutShell();
}
