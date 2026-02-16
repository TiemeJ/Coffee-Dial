export const createBeansCardActionsModule = ({
    getCurrentView,
    getCurrentBeanCardId,
    getBeans,
    closeBeanCard,
    closeBeanCardMenu,
    closeBeans,
    dispatchCommand,
    publishEvent
}) => {
    const showBrewsForBean = (beanId = null) => {
        const targetId = beanId || getCurrentBeanCardId();
        if (!targetId) return;
        closeBeanCardMenu?.();
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeBeanCard?.(null);
        closeBeans?.();
        dispatchCommand?.('brews.showForBean', { beanId: targetId });
        publishEvent?.('beans.brewsRequested', { beanId: targetId });
    };

    const showCoffeeForBean = (coffeeTypeId = null) => {
        const bean = getBeans().find((b) => b.id === getCurrentBeanCardId());
        const targetId = coffeeTypeId || bean?.coffeeTypeId;
        if (!targetId) return;
        dispatchCommand?.(
            'coffees.openCard',
            { id: targetId, source: 'beans' }
        );
        publishEvent?.('beans.coffeeRequested', { coffeeTypeId: targetId });
    };

    const openBrewWithBean = (beanId) => {
        if (getCurrentView() !== 'mine') return;
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeBeans();
        dispatchCommand?.('brews.openFormForBean', { beanId, event: null });
        publishEvent?.('beans.brewFormRequested', { beanId });
    };

    return {
        showBrewsForBean,
        showCoffeeForBean,
        openBrewWithBean
    };
};
