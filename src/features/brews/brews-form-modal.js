export const createBrewsFormModalModule = ({
    getCurrentView,
    changeView,
    resetFormState,
    toggleForm,
    openAppConfirm
}) => {
    let originalParent = null;
    let originalNextSibling = null;
    let initialSnapshot = null;
    let beforeUnloadAttached = false;
    const modalWrapperStripClasses = [
        'bg-white',
        'dark:bg-[#292524]',
        'rounded-xl',
        'shadow-lg',
        'border',
        'border-coffee-100',
        'dark:border-[#44403c]'
    ];

    const getModal = () => document.getElementById('brewFormModal');
    const getModalBody = () => document.getElementById('brewFormModalBody');
    const getFormWrapper = () => document.getElementById('formWrapper');
    const getFormContainerHeader = () => document.getElementById('formContainerHeader');
    const getFormContainer = () => document.getElementById('formContainer');
    const getFormContent = () => document.getElementById('formContent');
    const getCoffeeForm = () => document.getElementById('coffeeForm');
    const getFormActionButtons = () => document.getElementById('formActionButtons');
    const getFormMount = () => document.getElementById('brewsFormMount');
    const getModalTitle = () => document.getElementById('brewFormModalTitle');
    const getFormTitle = () => document.getElementById('formTitle');
    const isModalOpen = () => {
        const modal = getModal();
        return !!modal && !modal.classList.contains('hidden');
    };

    const snapshotFormState = () => {
        const form = getCoffeeForm();
        if (!form) return '';

        const rows = [];
        for (const field of Array.from(form.elements || [])) {
            if (!field || !field.name || field.disabled) continue;
            if (field.type === 'button' || field.type === 'submit' || field.type === 'reset' || field.type === 'file') continue;

            if (field.type === 'checkbox' || field.type === 'radio') {
                rows.push(`${field.name}::checked=${field.checked ? '1' : '0'}::value=${field.value ?? ''}`);
                continue;
            }
            rows.push(`${field.name}::value=${field.value ?? ''}`);
        }
        return rows.join('|');
    };

    const hasUnsavedChanges = () => isModalOpen() && initialSnapshot !== null && snapshotFormState() !== initialSnapshot;

    const handleBeforeUnload = (event) => {
        if (!hasUnsavedChanges()) return;
        event.preventDefault();
        event.returnValue = '';
    };

    const attachBeforeUnload = () => {
        if (beforeUnloadAttached) return;
        window.addEventListener('beforeunload', handleBeforeUnload);
        beforeUnloadAttached = true;
    };

    const detachBeforeUnload = () => {
        if (!beforeUnloadAttached) return;
        window.removeEventListener('beforeunload', handleBeforeUnload);
        beforeUnloadAttached = false;
    };

    const confirmDiscardIfNeeded = async () => {
        if (!hasUnsavedChanges()) return true;
        const shouldDiscard = await openAppConfirm({
            title: 'Discard changes?',
            message: 'This will discard unsaved changes in the form.',
            confirmLabel: 'Discard',
            cancelLabel: 'Keep editing',
            danger: true
        });
        if (!shouldDiscard) return false;
        resetFormState();
        return true;
    };

    const setModalTitleFromForm = () => {
        const modalTitle = getModalTitle();
        if (!modalTitle) return;
        const iconHtml = '<i class="fa-solid fa-plus-circle text-coffee-700 dark:text-[#d6ccc2]"></i>';
        const titleText = (getFormTitle()?.textContent || 'Add new brew').trim();
        modalTitle.innerHTML = `${iconHtml} ${titleText}`;
    };

    const setModalTitle = (title) => {
        const modalTitle = getModalTitle();
        if (!modalTitle) return;
        const iconHtml = '<i class="fa-solid fa-plus-circle text-coffee-700 dark:text-[#d6ccc2]"></i>';
        const titleText = (title || 'Add new brew').toString().trim();
        modalTitle.innerHTML = `${iconHtml} ${titleText}`;
    };

    const moveFormToModal = () => {
        const body = getModalBody();
        const formWrapper = getFormWrapper();
        if (!body || !formWrapper) return false;

        if (!originalParent) {
            originalParent = formWrapper.parentElement;
            originalNextSibling = formWrapper.nextSibling;
        }

        if (formWrapper.parentElement !== body) body.appendChild(formWrapper);
        formWrapper.classList.remove('mb-8');
        formWrapper.classList.add('mb-0');
        formWrapper.classList.add('bg-transparent', 'shadow-none', 'border-0', 'rounded-none');
        modalWrapperStripClasses.forEach((className) => formWrapper.classList.remove(className));
        const formContainerHeader = getFormContainerHeader();
        if (formContainerHeader) formContainerHeader.classList.add('hidden');
        const formContent = getFormContent();
        if (formContent) {
            formContent.classList.remove('border-t');
            formContent.classList.add('pt-0');
        }
        const coffeeForm = getCoffeeForm();
        if (coffeeForm) {
            coffeeForm.classList.remove('mt-4');
            coffeeForm.classList.add('mt-1');
        }
        const formActionButtons = getFormActionButtons();
        if (formActionButtons) formActionButtons.classList.add('hidden');
        return true;
    };

    const moveFormBack = () => {
        const formWrapper = getFormWrapper();
        const fallbackMount = getFormMount();
        if (!formWrapper) return;

        if (originalParent) {
            if (originalNextSibling && originalNextSibling.parentNode === originalParent) {
                originalParent.insertBefore(formWrapper, originalNextSibling);
            } else {
                originalParent.appendChild(formWrapper);
            }
        } else if (fallbackMount && formWrapper.parentElement !== fallbackMount) {
            fallbackMount.appendChild(formWrapper);
        }

        formWrapper.classList.remove('mb-0');
        if (!formWrapper.classList.contains('mb-8')) formWrapper.classList.add('mb-8');
        formWrapper.classList.remove('bg-transparent', 'shadow-none', 'border-0', 'rounded-none');
        modalWrapperStripClasses.forEach((className) => formWrapper.classList.add(className));
        const formContainerHeader = getFormContainerHeader();
        if (formContainerHeader) formContainerHeader.classList.remove('hidden');
        const formContent = getFormContent();
        if (formContent) {
            formContent.classList.add('border-t');
            formContent.classList.remove('pt-0');
        }
        const coffeeForm = getCoffeeForm();
        if (coffeeForm) {
            coffeeForm.classList.remove('mt-1');
            coffeeForm.classList.add('mt-4');
        }
        const formActionButtons = getFormActionButtons();
        if (formActionButtons) formActionButtons.classList.remove('hidden');
        originalParent = null;
        originalNextSibling = null;
    };

    const openBrewFormModal = (event = null, options = {}) => {
        if (event?.stopPropagation) event.stopPropagation();
        if (getCurrentView() !== 'mine') changeView('mine');
        const {
            reset = true,
            title = null,
            syncTitleFromForm = false
        } = options;

        const modal = getModal();
        if (!modal) return;
        if (!moveFormToModal()) return;
        const formContainer = getFormContainer();
        if (formContainer) formContainer.classList.remove('hidden');

        if (reset) resetFormState(null);
        toggleForm(true);
        if (syncTitleFromForm) setModalTitleFromForm();
        else if (title !== null) setModalTitle(title);
        else if (reset) setModalTitle('Add new brew');
        initialSnapshot = snapshotFormState();
        attachBeforeUnload();

        if (document.activeElement && typeof document.activeElement.blur === 'function') {
            document.activeElement.blur();
        }

        modal.classList.remove('hidden');
        document.body.classList.add('overflow-hidden');
    };

    const closeBrewFormModal = async (event = null, { force = false } = {}) => {
        if (event?.stopPropagation) event.stopPropagation();
        const modal = getModal();
        if (!modal || modal.classList.contains('hidden')) return;
        if (!force) {
            const canClose = await confirmDiscardIfNeeded();
            if (!canClose) return;
        }

        toggleForm(false);
        modal.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
        moveFormBack();
        initialSnapshot = null;
        detachBeforeUnload();
    };

    const discardBrewFormModal = async (event = null) => {
        if (event?.stopPropagation) event.stopPropagation();
        const modal = getModal();
        if (!modal || modal.classList.contains('hidden')) return;
        const canDiscard = await confirmDiscardIfNeeded();
        if (!canDiscard) return;
        if (!hasUnsavedChanges()) {
            resetFormState();
        }
        await closeBrewFormModal(null, { force: true });
    };

    const submitBrewFormModal = (event = null) => {
        if (event?.stopPropagation) event.stopPropagation();
        const form = getCoffeeForm();
        if (!form) return;
        form.requestSubmit();
    };

    document.addEventListener('brew:form-saved', () => {
        if (!isModalOpen()) return;
        closeBrewFormModal(null, { force: true });
    });

    return {
        openBrewFormModal,
        closeBrewFormModal,
        discardBrewFormModal,
        submitBrewFormModal,
        setModalTitleFromForm
    };
};
