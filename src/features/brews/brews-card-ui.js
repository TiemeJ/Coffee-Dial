import { createBrewsVmModule } from './brews.vm.js';

export const createBrewsCardUiModule = ({
    getCurrentView,
    getCoffees,
    getBeans,
    getBrewTableOrderIds,
    getCoffeeTypeForBrew,
    getCoffeeTypeDisplay,
    getPinnedBrewsPreferences,
    getStarDisplay,
    formatTime,
    getTempBadge,
    setCurrentCardCoffee,
    getCurrentCoffeeCardId,
    setCurrentCoffeeCardId,
    setCurrentCardGraphData,
    updateCoffeeCardActionMenu,
    dispatchCommand,
    cancelBrewQuickEditMode,
    resetCardPhotoState,
    toggleCardMode
}) => {
    const brewsVm = createBrewsVmModule();
    let navigationOrderOverride = null;
    let pinnedNavigationAccent = false;

    const getCardOrder = () =>
        Array.isArray(navigationOrderOverride) && navigationOrderOverride.length
            ? navigationOrderOverride
            : getBrewTableOrder();

    const updatePinnedNavAccent = () => {
        const prevBtn = document.getElementById('coffeeCardPrevBtn');
        const nextBtn = document.getElementById('coffeeCardNextBtn');
        if (!prevBtn || !nextBtn) return;
        [prevBtn, nextBtn].forEach((btn) => {
            btn.classList.toggle('text-emerald-600', pinnedNavigationAccent);
            btn.classList.toggle('dark:text-emerald-400', pinnedNavigationAccent);
            btn.classList.toggle('border-emerald-300', pinnedNavigationAccent);
            btn.classList.toggle('dark:border-emerald-700', pinnedNavigationAccent);
        });
    };

    const populateCardData = (c) => {
        setCurrentCardCoffee(c);

        const graphVm = brewsVm.buildCardGraphData(c);
        const hasGraph = graphVm.hasGraph;

        const graphBtn = document.getElementById('cardGraphBtn');
        if (graphBtn) graphBtn.classList.toggle('hidden', !hasGraph);

        setCurrentCardGraphData(graphVm.graphData);

        const coffeeType = getCoffeeTypeDisplay(c);
        const cardVm = brewsVm.buildCardDisplayViewModel({ brew: c, coffeeType });
        updateCoffeeCardActionMenu(c);

        document.getElementById('cardRoaster').textContent = cardVm.titlePrimary;
        document.getElementById('cardSubtitle').textContent = cardVm.titleSecondary;
        document.getElementById('cardRating').innerHTML = getStarDisplay(c.rating || 0);
        document.getElementById('cardOrigin').textContent = cardVm.origin;
        document.getElementById('cardProcess').textContent = cardVm.processing;
        document.getElementById('cardRoastType').textContent = cardVm.roastType;
        document.getElementById('cardMethod').textContent = cardVm.method;
        document.getElementById('cardWeight').textContent = cardVm.weightText;
        document.getElementById('cardRatio').textContent = cardVm.ratioText;
        document.getElementById('cardOut').textContent = cardVm.outText;

        const titleEl = document.getElementById('cardGrindTitle');
        const valEl = document.getElementById('cardGrindValue');
        if (titleEl) titleEl.textContent = cardVm.grinderTitle;
        if (valEl) valEl.textContent = cardVm.grinderValue;

        document.getElementById('cardTime').textContent = formatTime(c.time);
        document.getElementById('cardTemp').innerHTML = getTempBadge(c.temp);
        document.getElementById('cardDrink').textContent = cardVm.drink;

        const hideCoffeeImageInCard = !!getPinnedBrewsPreferences?.()?.hideCoffeeImageInBrewCard;
        const showCoffeeImageInCard = !hideCoffeeImageInCard;
        const cardOriginField = document.getElementById('cardOriginField');
        const cardProcessField = document.getElementById('cardProcessField');
        const cardRoastField = document.getElementById('cardRoastField');
        const cardDrinkField = document.getElementById('cardDrinkField');
        const cardMethodField = document.getElementById('cardMethodField');
        const imageSection = document.getElementById('cardCoffeeImageSection');
        const imageEl = document.getElementById('cardCoffeeImage');
        const placeholderEl = document.getElementById('cardCoffeeImagePlaceholder');
        const linkedBeanId = c.beanId || null;
        const bean = linkedBeanId ? getBeans().find((b) => b.id === linkedBeanId) : null;
        const coffeeTypeForBrew = getCoffeeTypeForBrew?.(c) || null;
        const coffeeImageUrl = coffeeTypeForBrew?.imageUrl || coffeeTypeForBrew?.imageURL || '';

        if (cardOriginField) cardOriginField.classList.toggle('hidden', showCoffeeImageInCard);
        if (cardProcessField) cardProcessField.classList.toggle('hidden', showCoffeeImageInCard);
        if (cardRoastField) cardRoastField.classList.toggle('hidden', showCoffeeImageInCard);
        if (cardDrinkField) cardDrinkField.classList.toggle('col-span-2', showCoffeeImageInCard);
        if (cardMethodField) cardMethodField.classList.toggle('col-span-2', showCoffeeImageInCard);

        if (imageSection) imageSection.classList.toggle('hidden', !showCoffeeImageInCard);

        if (showCoffeeImageInCard && imageEl && placeholderEl) {
            if (coffeeImageUrl) {
                imageEl.src = coffeeImageUrl;
                imageEl.classList.remove('hidden');
                placeholderEl.classList.add('hidden');
            } else {
                imageEl.src = '';
                imageEl.classList.add('hidden');
                placeholderEl.classList.remove('hidden');
            }

            if (bean?.id) {
                imageEl.classList.add('cursor-pointer');
                placeholderEl.classList.add('cursor-pointer');
                imageEl.onclick = (event) => {
                    event.stopPropagation();
                    dispatchCommand?.('beans.openCard', { beanId: bean.id, event: null, keepNavigationOrder: false });
                };
                placeholderEl.onclick = (event) => {
                    event.stopPropagation();
                    dispatchCommand?.('beans.openCard', { beanId: bean.id, event: null, keepNavigationOrder: false });
                };
            } else {
                imageEl.classList.remove('cursor-pointer');
                placeholderEl.classList.remove('cursor-pointer');
                imageEl.onclick = null;
                placeholderEl.onclick = null;
            }
        } else if (imageEl && placeholderEl) {
            imageEl.onclick = null;
            placeholderEl.onclick = null;
            imageEl.classList.remove('cursor-pointer');
            placeholderEl.classList.remove('cursor-pointer');
        }

        const notesEl = document.getElementById('cardNotes');
        if (notesEl) {
            if (cardVm.hasNotes) {
                notesEl.textContent = cardVm.notesText;
                notesEl.classList.remove('hidden');
            } else {
                notesEl.classList.add('hidden');
            }
        }

        const improveEl = document.getElementById('cardImprove');
        const improveCon = document.getElementById('cardImproveContainer');
        if (improveEl && improveCon) {
            if (cardVm.hasImprove) {
                improveEl.textContent = cardVm.improveText;
                improveCon.classList.remove('hidden');
            } else {
                improveCon.classList.add('hidden');
            }
        }

        const cardDateEl = document.getElementById('cardDate');
        if (cardDateEl) {
            cardDateEl.innerHTML = cardVm.dateHtml;
        }
    };

    const getBrewTableOrder = () => getBrewTableOrderIds();

    const updateCoffeeCardNav = () => {
        const order = getCardOrder();
        const idx = order.indexOf(getCurrentCoffeeCardId());
        const prevBtn = document.getElementById('coffeeCardPrevBtn');
        const nextBtn = document.getElementById('coffeeCardNextBtn');
        if (!prevBtn || !nextBtn) return;
        updatePinnedNavAccent();
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx === -1 || idx >= order.length - 1;
        prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
        prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-40', nextBtn.disabled);
        nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
    };

    const openBrewCard = (id, e, options = {}) => {
        const keepNavigationOrder = !!options.keepNavigationOrder;
        if (window.getSelection().toString().length > 0) return;
        if (e) e.stopPropagation();
        if (!keepNavigationOrder) {
            navigationOrderOverride = null;
            pinnedNavigationAccent = false;
        }
        const c = getCoffees().find((x) => x.id === id);
        if (!c) return;

        setCurrentCoffeeCardId(id);
        cancelBrewQuickEditMode();
        resetCardPhotoState();
        toggleCardMode('stats');
        document.getElementById('shareControls')?.classList.add('hidden');
        populateCardData(c);
        document.getElementById('coffeeCardOverlay')?.classList.remove('hidden');
        updateCoffeeCardNav();
    };

    const openBrewCardWithOrder = (id, order = [], e = null, options = {}) => {
        const cleanedOrder = Array.from(new Set((order || []).filter(Boolean)));
        navigationOrderOverride = cleanedOrder.length ? cleanedOrder : null;
        pinnedNavigationAccent = !!options.pinnedNavigationAccent;
        openBrewCard(id, e, { keepNavigationOrder: true });
    };

    const navigateCoffeeCard = (direction) => {
        const order = getCardOrder();
        const idx = order.indexOf(getCurrentCoffeeCardId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        openBrewCard(order[nextIdx], null, { keepNavigationOrder: true });
    };

    const closeCoffeeCard = (e) => {
        if (!e || e.target.id === 'coffeeCardOverlay') {
            navigationOrderOverride = null;
            pinnedNavigationAccent = false;
            cancelBrewQuickEditMode();
            document.getElementById('coffeeCardOverlay')?.classList.add('hidden');
            const graphModal = document.getElementById('cardGraphModal');
            if (graphModal) graphModal.classList.add('hidden');
        }
    };

    return {
        populateCardData,
        getBrewTableOrder,
        openCard: openBrewCard,
        openCardWithOrder: openBrewCardWithOrder,
        updateCoffeeCardNav,
        navigateCoffeeCard,
        closeCoffeeCard
    };
};
