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
    toggleForm
}) => {
    const openBeanShopUrl = (beanId, ev) => {
        if (ev) ev.stopPropagation();
        const bean = getBeans().find((b) => b.id === beanId);
        if (bean && bean.shopUrl) window.open(bean.shopUrl, '_blank');
    };

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
        document.getElementById('formWrapper')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return {
        openBeanShopUrl,
        showBrewsForBean,
        showCoffeeForBean,
        openBrewWithBean
    };
};
