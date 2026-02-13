let autoPinToastTimer = null;
const showToastInStack = (toast) => {
    if (!toast) return;
    const stack = document.getElementById('toastStack');
    if (stack && toast.parentElement === stack) {
        stack.prepend(toast);
    }
    toast.classList.remove('hidden');
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px)';
    toast.style.transition = 'opacity 180ms ease, transform 180ms ease';
    requestAnimationFrame(() => {
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';
    });
};

export const showAutoPinToast = (message) => {
    const toast = document.getElementById('autoPinToast');
    if (!toast) return;
    const textEl = document.getElementById('autoPinToastText');
    if (textEl) textEl.textContent = message || 'Autopin updated.';
    showToastInStack(toast);
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
    onAutoArchiveOpen,
    onBeanCreatedEdit
}) => {
    let autoArchiveToastBeanId = null;
    let beanCreatedToastBeanId = null;
    let coffeeTypeToastTimer = null;

    const showAutoArchiveToast = (beanId) => {
        const toast = document.getElementById('autoArchiveToast');
        if (!toast) return;
        autoArchiveToastBeanId = beanId || null;
        showToastInStack(toast);
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
        showToastInStack(toast);
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

    const showBeanCreatedToast = ({ beanId = null, roaster = '', farmer = '' } = {}) => {
        const toast = document.getElementById('autoBeanCreatedToast');
        if (!toast) return;
        beanCreatedToastBeanId = beanId || null;
        const textEl = document.getElementById('autoBeanCreatedToastText');
        if (textEl) {
            const roasterPart = (roaster || '').toString().trim();
            const farmerPart = (farmer || '').toString().trim();
            const suffix = `${roasterPart}${roasterPart && farmerPart ? ' ' : ''}${farmerPart}`.trim();
            textEl.textContent = suffix
                ? `Added a coffee bag of 250 gr for ${suffix}.`
                : 'Added a coffee bag of 250 gr.';
        }
        showToastInStack(toast);
    };

    const closeBeanCreatedToast = () => {
        const toast = document.getElementById('autoBeanCreatedToast');
        if (toast) toast.classList.add('hidden');
        beanCreatedToastBeanId = null;
    };

    const handleBeanCreatedToastAction = async (action) => {
        const beanId = beanCreatedToastBeanId;
        if (action === 'edit' && beanId) {
            await onBeanCreatedEdit?.(beanId);
            closeBeanCreatedToast();
            return;
        }
        closeBeanCreatedToast();
    };

    return {
        showAutoArchiveToast,
        closeAutoArchiveToast,
        handleAutoArchiveToastAction,
        showCoffeeTypeCreatedToast,
        closeCoffeeTypeCreatedToast,
        showBeanCreatedToast,
        closeBeanCreatedToast,
        handleBeanCreatedToastAction
    };
};
