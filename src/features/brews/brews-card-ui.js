export const createBrewsCardUiModule = ({
    getCurrentView,
    getCoffees,
    getBeans,
    getFilteredCoffees,
    getDisplayedBrewsCount,
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
    openBeanCard,
    cancelBrewQuickEditMode,
    resetCardPhotoState,
    toggleCardMode
}) => {
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

        const hasGraph = !!(
            (c.scaleCapture && c.scaleCapture.samples && c.scaleCapture.samples.length) ||
            (c.scaleFlowCapture && c.scaleFlowCapture.samples && c.scaleFlowCapture.samples.length) ||
            (c.scaleRawCapture && c.scaleRawCapture.samples && c.scaleRawCapture.samples.length)
        );

        const graphBtn = document.getElementById('cardGraphBtn');
        if (graphBtn) graphBtn.classList.toggle('hidden', !hasGraph);

        setCurrentCardGraphData(
            hasGraph
                ? {
                      capture: c.scaleCapture || { startAt: null, samples: [] },
                      flowCapture: c.scaleFlowCapture || { startAt: (c.scaleCapture && c.scaleCapture.startAt) || null, samples: [] },
                      rawCapture: c.scaleRawCapture || { startAt: (c.scaleCapture && c.scaleCapture.startAt) || null, samples: [] },
                      firstDrip: Number.isFinite(Number(c.firstDrip)) ? Number(c.firstDrip) : null,
                      elapsedSeconds: Number.isFinite(Number(c.time)) ? Number(c.time) : null,
                      recipeSteps: Array.isArray(c.recipeSteps) ? c.recipeSteps : []
                  }
                : null
        );

        const coffeeType = getCoffeeTypeDisplay(c);
        updateCoffeeCardActionMenu(c);

        document.getElementById('cardRoaster').textContent = coffeeType.farmer !== '-' ? coffeeType.farmer : (coffeeType.roaster !== '-' ? coffeeType.roaster : 'Unknown Blend');
        document.getElementById('cardSubtitle').textContent = coffeeType.roaster !== '-' ? coffeeType.roaster : 'Unknown Roaster';
        document.getElementById('cardRating').innerHTML = getStarDisplay(c.rating || 0);
        document.getElementById('cardOrigin').textContent = coffeeType.origin;
        document.getElementById('cardProcess').textContent = coffeeType.processing;
        document.getElementById('cardRoastType').textContent = coffeeType.roastType;
        document.getElementById('cardMethod').textContent = c.method || '-';
        document.getElementById('cardWeight').textContent = c.weight ? `${c.weight}g` : '-';
        document.getElementById('cardRatio').textContent = c.ratio ? `1:${c.ratio}` : '-';

        const outWeight = c.weight && c.ratio ? (c.weight * c.ratio).toFixed(1) : '-';
        document.getElementById('cardOut').textContent = outWeight !== '-' ? `${outWeight.endsWith('.0') ? parseInt(outWeight, 10) : outWeight}g` : '-';

        const grinderVal = c.grinder || '';
        const grindVal = c.grind || '-';
        const titleEl = document.getElementById('cardGrindTitle');
        const valEl = document.getElementById('cardGrindValue');
        if (titleEl) titleEl.textContent = grinderVal || 'Grind';
        if (valEl) valEl.textContent = grindVal;

        document.getElementById('cardTime').textContent = formatTime(c.time);
        document.getElementById('cardTemp').innerHTML = getTempBadge(c.temp);
        document.getElementById('cardDrink').textContent = c.drink || '-';

        const showCoffeeImageInCard = !!getPinnedBrewsPreferences?.()?.showCoffeeImageInBrewCard;
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
                    openBeanCard(bean.id);
                };
                placeholderEl.onclick = (event) => {
                    event.stopPropagation();
                    openBeanCard(bean.id);
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
            if (c.notes) {
                notesEl.textContent = `"${c.notes}"`;
                notesEl.classList.remove('hidden');
            } else {
                notesEl.classList.add('hidden');
            }
        }

        const improveEl = document.getElementById('cardImprove');
        const improveCon = document.getElementById('cardImproveContainer');
        if (improveEl && improveCon) {
            if (c.improve) {
                improveEl.textContent = `"${c.improve}"`;
                improveCon.classList.remove('hidden');
            } else {
                improveCon.classList.add('hidden');
            }
        }

        const cardDateEl = document.getElementById('cardDate');
        if (cardDateEl) {
            if (c.createdAt) {
                const cardDate = new Date(c.createdAt);
                const cardTimeText = cardDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
                const cardDateText = cardDate.toLocaleDateString();
                cardDateEl.innerHTML = `<span class="block text-[11px]">${cardTimeText}</span><span class="block">${cardDateText}</span>`;
            } else {
                cardDateEl.textContent = '-';
            }
        }
    };

    const getBrewTableOrder = () => {
        const filteredCoffees = getFilteredCoffees();
        const displayLimit = Math.min(getDisplayedBrewsCount(), filteredCoffees.length);
        return filteredCoffees.slice(0, displayLimit).map((c) => c.id);
    };

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

    const openCoffeeCard = (id, e, options = {}) => {
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

    const openCoffeeCardWithOrder = (id, order = [], e = null, options = {}) => {
        const cleanedOrder = Array.from(new Set((order || []).filter(Boolean)));
        navigationOrderOverride = cleanedOrder.length ? cleanedOrder : null;
        pinnedNavigationAccent = !!options.pinnedNavigationAccent;
        openCoffeeCard(id, e, { keepNavigationOrder: true });
    };

    const navigateCoffeeCard = (direction) => {
        const order = getCardOrder();
        const idx = order.indexOf(getCurrentCoffeeCardId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        openCoffeeCard(order[nextIdx], null, { keepNavigationOrder: true });
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
        openCoffeeCard,
        openCoffeeCardWithOrder,
        updateCoffeeCardNav,
        navigateCoffeeCard,
        closeCoffeeCard
    };
};
