import {
    sendSignInLinkToEmail,
    isSignInWithEmailLink,
    signInWithEmailLink,
    linkWithCredential,
    EmailAuthProvider,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const EMAIL_LINK_STORAGE_KEY = 'emailLinkSignInEmail';
const EMAIL_LINK_ACTIVATION_KEY = 'emailLinkActivation';

const getInputValue = (id) => {
    const el = document.getElementById(id);
    if (!el) return '';
    return (el.value || '').trim();
};

const setInputValue = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.value = value || '';
};

const setDisabled = (id, disabled) => {
    const el = document.getElementById(id);
    if (el) el.disabled = disabled;
};

const setStatus = (id, message, tone = 'info') => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!message) {
        el.classList.add('hidden');
        el.textContent = '';
        return;
    }
    el.classList.remove('hidden');
    el.textContent = message;
    el.classList.remove('text-red-500', 'text-green-600', 'text-coffee-600', 'dark:text-[#a8a29e]');
    if (tone === 'error') {
        el.classList.add('text-red-500');
    } else if (tone === 'success') {
        el.classList.add('text-green-600');
    } else {
        el.classList.add('text-coffee-600', 'dark:text-[#a8a29e]');
    }
};

const clearEmailLinkQueryParam = () => {
    if (!window.location.search.includes('emailLink=1')) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('emailLink');
    window.history.replaceState({}, document.title, url.toString());
};

export const initEmailLinkAuth = ({ auth }) => {
    if (!auth) return;

    const actionCodeSettings = {
        url: `${window.location.origin}${window.location.pathname}?emailLink=1`,
        handleCodeInApp: true
    };

    const updateActivationUi = (user) => {
        const email = user?.email || '';
        setInputValue('emailLinkActivationEmail', email);
        setDisabled('emailLinkActivationEmail', !email);
        setDisabled('emailLinkActivationBtn', !email);
        setStatus('emailLinkActivationStatus', '');
    };

    const sendActivationLink = async () => {
        const user = auth.currentUser;
        if (!user) {
            alert('Please sign in first.');
            return;
        }
        const email = getInputValue('emailLinkActivationEmail') || user.email;
        if (!email) {
            alert('Email is missing.');
            return;
        }
        try {
            setDisabled('emailLinkActivationBtn', true);
            setStatus('emailLinkActivationStatus', 'Sending link...');
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
            localStorage.setItem(EMAIL_LINK_ACTIVATION_KEY, '1');
            setStatus('emailLinkActivationStatus', 'Link sent. Check your inbox.', 'success');
        } catch (err) {
            console.error(err);
            setStatus('emailLinkActivationStatus', err.message || 'Failed to send link.', 'error');
        } finally {
            setDisabled('emailLinkActivationBtn', false);
        }
    };

    const sendLoginLink = async () => {
        const email = getInputValue('emailLinkLoginEmail');
        if (!email) {
            alert('Please enter your email.');
            return;
        }
        try {
            setDisabled('emailLinkLoginBtn', true);
            setStatus('emailLinkLoginStatus', 'Sending link...');
            await sendSignInLinkToEmail(auth, email, actionCodeSettings);
            localStorage.setItem(EMAIL_LINK_STORAGE_KEY, email);
            localStorage.removeItem(EMAIL_LINK_ACTIVATION_KEY);
            setStatus('emailLinkLoginStatus', 'Link sent. Check your inbox.', 'success');
        } catch (err) {
            console.error(err);
            setStatus('emailLinkLoginStatus', err.message || 'Failed to send link.', 'error');
        } finally {
            setDisabled('emailLinkLoginBtn', false);
        }
    };

    const handleEmailLink = async () => {
        if (!isSignInWithEmailLink(auth, window.location.href)) return;

        let email = localStorage.getItem(EMAIL_LINK_STORAGE_KEY);
        if (!email) {
            email = window.prompt('Confirm your email to finish sign-in');
        }
        if (!email) {
            setStatus('emailLinkLoginStatus', 'Email confirmation was cancelled.', 'error');
            return;
        }

        const isActivation = localStorage.getItem(EMAIL_LINK_ACTIVATION_KEY) === '1';

        try {
            if (auth.currentUser && isActivation) {
                const credential = EmailAuthProvider.credentialWithLink(email, window.location.href);
                await linkWithCredential(auth.currentUser, credential);
            } else {
                await signInWithEmailLink(auth, email, window.location.href);
            }
            localStorage.removeItem(EMAIL_LINK_STORAGE_KEY);
            localStorage.removeItem(EMAIL_LINK_ACTIVATION_KEY);
            clearEmailLinkQueryParam();
        } catch (err) {
            console.error(err);
            setStatus('emailLinkLoginStatus', err.message || 'Email sign-in failed.', 'error');
        }
    };

    window.sendEmailLinkActivation = sendActivationLink;
    window.sendEmailLinkLogin = sendLoginLink;

    onAuthStateChanged(auth, (user) => {
        updateActivationUi(user);
    });

    handleEmailLink();
};
