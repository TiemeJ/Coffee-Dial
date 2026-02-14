export const createBeansCardActionsModule = ({
    getCurrentView,
    getCurrentBeanCardId,
    getBeans,
    closeBeanCard,
    closeBeans,
    clearSearch,
    clearAllFilters,
    setActiveBeanFilter,
    getBrewsPerPage,
    setDisplayedBrewsCount,
    renderTable,
    renderActiveFilters,
    openCoffeeTypes,
    clearCoffeeTypesSearch,
    clearCoffeeTypesFilters,
    openCoffeeTypeCard,
    fillBeanDetails,
    toggleForm,
    shouldUseLegacyBrewForm,
    openBrewFormModal
}) => {
    const isLegacyBrewFormEnabled = () => shouldUseLegacyBrewForm?.() !== false;
    const showBrewsForBean = (beanId = null) => {
        const targetId = beanId || getCurrentBeanCardId();
        if (!targetId) return;
        closeBeanCard(null);
        closeBeans();
        clearSearch();
        clearAllFilters();
        setActiveBeanFilter(targetId);
        setDisplayedBrewsCount(getBrewsPerPage());
        renderTable();
        renderActiveFilters();
    };

    const showCoffeeForBean = (coffeeTypeId = null) => {
        const bean = getBeans().find((b) => b.id === getCurrentBeanCardId());
        const targetId = coffeeTypeId || bean?.coffeeTypeId;
        if (!targetId) return;
        closeBeanCard(null);
        closeBeans();
        openCoffeeTypes();
        clearCoffeeTypesSearch();
        clearCoffeeTypesFilters();
        openCoffeeTypeCard(targetId);
    };

    const openBrewWithBean = (beanId) => {
        if (getCurrentView() !== 'mine') return;
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeBeans();
        const select = document.getElementById('savedBeanSelect');
        if (select) {
            select.value = beanId;
            fillBeanDetails(beanId);
        }
        toggleForm(true);
        if (!isLegacyBrewFormEnabled()) {
            openBrewFormModal?.(null, { reset: false, syncTitleFromForm: true });
            return;
        }
        const formWrapper = document.getElementById('formWrapper');
        if (!formWrapper) return;
        const scrollToFormTop = (behavior = 'smooth') => {
            const headerHeight = document.getElementById('appHeader')?.offsetHeight || 72;
            const top = formWrapper.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({ top: Math.max(0, top - headerHeight - 8), behavior });
        };
        scrollToFormTop('smooth');
        requestAnimationFrame(() => scrollToFormTop('auto'));
        setTimeout(() => scrollToFormTop('auto'), 140);
    };

    return {
        showBrewsForBean,
        showCoffeeForBean,
        openBrewWithBean
    };
};
