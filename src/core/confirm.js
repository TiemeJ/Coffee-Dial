let appConfirmResolver = null;

export const resolveAppConfirm = (result) => {
    const overlay = document.getElementById('appConfirmOverlay');
    if (overlay) overlay.classList.add('hidden');
    if (appConfirmResolver) {
        const resolve = appConfirmResolver;
        appConfirmResolver = null;
        resolve(!!result);
    }
};

export const closeAppConfirm = (event) => {
    if (!event || event.target.id === 'appConfirmOverlay') {
        resolveAppConfirm(false);
    }
};

export const openAppConfirm = ({
    title = 'Confirm action',
    message = '',
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    danger = true
} = {}) => {
    const overlay = document.getElementById('appConfirmOverlay');
    const titleEl = document.getElementById('appConfirmTitle');
    const messageEl = document.getElementById('appConfirmMessage');
    const confirmBtn = document.getElementById('appConfirmConfirmBtn');
    const cancelBtn = document.getElementById('appConfirmCancelBtn');
    if (!overlay || !titleEl || !messageEl || !confirmBtn || !cancelBtn) return Promise.resolve(false);

    titleEl.textContent = title;
    messageEl.textContent = message;
    confirmBtn.textContent = confirmLabel;
    cancelBtn.textContent = cancelLabel;
    confirmBtn.className = danger
        ? 'px-3 py-1.5 text-sm font-semibold rounded bg-red-600 hover:bg-red-700 text-white'
        : 'px-3 py-1.5 text-sm font-semibold rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white';

    overlay.classList.remove('hidden');
    return new Promise((resolve) => {
        appConfirmResolver = resolve;
    });
};

export const installDialogAdapters = (showToast) => {
    window.alert = (message) => {
        showToast(message);
    };
    window.confirm = () => false;
    window.prompt = () => null;
};
