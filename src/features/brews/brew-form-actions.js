export const createBrewFormActionsModule = ({
    dispatchCommand,
    applyGraphTogglePrefsForMethod
}) => {
    const openSelectedBeanForEdit = () => {
        const select = document.getElementById('savedBeanSelect');
        const beanId = select?.value;
        if (!beanId) return;
        dispatchCommand?.(
            'beans.openCardForEdit',
            { beanId, event: null },
            { source: 'brew-form-actions.openSelectedBeanForEdit' }
        );
    };

    const toggleDrinkOther = () => {
        const value = document.getElementById('drinkType')?.value;
        const input = document.getElementById('drinkOther');
        if (!input) return;
        if (value === 'Other') input.classList.remove('hidden');
        else input.classList.add('hidden');
    };

    const toggleMethodOther = () => {
        const value = document.getElementById('method')?.value;
        const input = document.getElementById('methodOther');
        if (input) {
            if (value === 'Other') input.classList.remove('hidden');
            else input.classList.add('hidden');
        }
        applyGraphTogglePrefsForMethod?.();
    };

    const bindMethodOtherChangeListener = () => {
        const methodOtherInput = document.getElementById('methodOther');
        if (!methodOtherInput) return;
        if (methodOtherInput.dataset.graphMethodBound === 'true') return;
        methodOtherInput.dataset.graphMethodBound = 'true';
        methodOtherInput.addEventListener('change', () => {
            applyGraphTogglePrefsForMethod?.();
        });
    };

    return {
        bindMethodOtherChangeListener,
        openSelectedBeanForEdit,
        toggleDrinkOther,
        toggleMethodOther
    };
};
