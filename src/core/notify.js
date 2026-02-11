let autoPinToastTimer = null;

export const showAutoPinToast = (message) => {
    const toast = document.getElementById('autoPinToast');
    if (!toast) return;
    const textEl = document.getElementById('autoPinToastText');
    if (textEl) textEl.textContent = message || 'Autopin updated.';
    toast.classList.remove('hidden');
    if (autoPinToastTimer) clearTimeout(autoPinToastTimer);
    autoPinToastTimer = setTimeout(() => {
        closeAutoPinToast();
    }, 3000);
};

export const closeAutoPinToast = () => {
    const toast = document.getElementById('autoPinToast');
    if (toast) toast.classList.add('hidden');
    if (autoPinToastTimer) {
        clearTimeout(autoPinToastTimer);
        autoPinToastTimer = null;
    }
};

export const showToast = (message) => {
    showAutoPinToast(String(message || 'Done.'));
};

export const createNotificationUxModule = ({
    getCoffeeTypes,
    onAutoArchiveUnarchive,
    onAutoArchiveOpen
}) => {
    let autoArchiveToastBeanId = null;
    let coffeeTypeToastTimer = null;

    const showAutoArchiveToast = (beanId) => {
        const toast = document.getElementById('autoArchiveToast');
        if (!toast) return;
        autoArchiveToastBeanId = beanId || null;
        toast.classList.remove('hidden');
    };

    const closeAutoArchiveToast = () => {
        const toast = document.getElementById('autoArchiveToast');
        if (toast) toast.classList.add('hidden');
        autoArchiveToastBeanId = null;
    };

    const handleAutoArchiveToastAction = async (action) => {
        const beanId = autoArchiveToastBeanId;
        if (!beanId) {
            closeAutoArchiveToast();
            return;
        }

        if (action === 'unarchive') {
            await onAutoArchiveUnarchive?.(beanId);
            closeAutoArchiveToast();
            return;
        }

        if (action === 'open') {
            await onAutoArchiveOpen?.(beanId);
            closeAutoArchiveToast();
            return;
        }

        closeAutoArchiveToast();
    };

    const showCoffeeTypeCreatedToast = (coffeeTypeId = null) => {
        const toast = document.getElementById('autoCoffeeTypeToast');
        if (!toast) return;
        const textEl = document.getElementById('autoCoffeeTypeToastText');
        if (textEl) {
            const type = getCoffeeTypes()?.find((ct) => ct.id === coffeeTypeId);
            const name = type ? `${type.roaster || 'New coffee'}${type.farmer ? ` - ${type.farmer}` : ''}` : 'New coffee';
            textEl.textContent = `Coffee created: ${name}.`;
        }
        toast.classList.remove('hidden');
        if (coffeeTypeToastTimer) clearTimeout(coffeeTypeToastTimer);
        coffeeTypeToastTimer = setTimeout(() => {
            closeCoffeeTypeCreatedToast();
        }, 3500);
    };

    const closeCoffeeTypeCreatedToast = () => {
        const toast = document.getElementById('autoCoffeeTypeToast');
        if (toast) toast.classList.add('hidden');
        if (coffeeTypeToastTimer) {
            clearTimeout(coffeeTypeToastTimer);
            coffeeTypeToastTimer = null;
        }
    };

    return {
        showAutoArchiveToast,
        closeAutoArchiveToast,
        handleAutoArchiveToastAction,
        showCoffeeTypeCreatedToast,
        closeCoffeeTypeCreatedToast
    };
};
