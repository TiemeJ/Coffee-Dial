export const createBrewsFormModalModule = ({
    getCurrentView,
    changeView,
    resetFormState,
    toggleForm,
    openAppConfirm
}) => {
    let initialSnapshot = null;
    let beforeUnloadAttached = false;

    const getModal = () => document.getElementById('brewFormModal');
    const getFormContainer = () => document.getElementById('formContainer');
    const getCoffeeForm = () => document.getElementById('coffeeForm');
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
        const formContainer = getFormContainer();
        if (formContainer) formContainer.classList.remove('hidden');
        const isExpanded = formContainer?.getAttribute('aria-expanded') === 'true';

        if (reset) resetFormState(null);
        if (reset || !isExpanded) toggleForm(true);
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
