export const createOpenAddBrewFromPinned = ({
    isLegacyBrewFormEnabled,
    openBrewFormModal,
    changeView,
    resetFormState,
    toggleForm,
    getCurrentView
}) => {
    return (event = null) => {
        if (!isLegacyBrewFormEnabled()) {
            openBrewFormModal(event, { reset: true, title: 'Add new brew' });
            return;
        }
        if (event?.stopPropagation) event.stopPropagation();
        if (getCurrentView() !== 'mine') changeView('mine');
        resetFormState(null);
        toggleForm(true);
        const formWrapper = document.getElementById('formWrapper');
        if (!formWrapper) return;
        const headerHeight = document.getElementById('appHeader')?.offsetHeight || 72;
        const top = formWrapper.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top: Math.max(0, top - headerHeight - 8), behavior: 'smooth' });
    };
};
