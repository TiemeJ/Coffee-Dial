export const createBrewsCardGraphModule = ({
    getCurrentCardGraphData,
    getCurrentCardCoffee,
    getCurrentCoffeeCardId,
    getBrewTableOrder,
    getCoffeeTypeDisplay,
    dispatchCommand,
    getCoffeeScale,
    ensureScalesFeature
}) => {
    const updateCoffeeGraphNav = () => {
        const order = getBrewTableOrder();
        const idx = order.indexOf(getCurrentCoffeeCardId());
        const prevBtn = document.getElementById('cardGraphPrevBtn');
        const nextBtn = document.getElementById('cardGraphNextBtn');
        if (!prevBtn || !nextBtn) return;
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx === -1 || idx >= order.length - 1;
        prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
        prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-40', nextBtn.disabled);
        nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
    };

    const openCardGraphModal = async (e, forceOpen = false) => {
        if (e) e.stopPropagation();
        const currentGraphData = getCurrentCardGraphData();
        if (!currentGraphData && !forceOpen) return;

        if (typeof ensureScalesFeature === 'function') {
            try {
                await ensureScalesFeature();
            } catch (error) {
                console.error('Failed to initialize scales feature for card graph modal:', error);
            }
        }

        const modal = document.getElementById('cardGraphModal');
        if (!modal) return;
        modal.classList.remove('hidden');

        const canvas = document.getElementById('cardGraphCanvas');
        const emptyEl = document.getElementById('cardGraphEmpty');
        const subtitleEl = document.getElementById('cardGraphSubtitle');
        const dateEl = document.getElementById('cardGraphDate');
        const inputWeightEl = document.getElementById('cardGraphInputWeight');
        const inputRatioEl = document.getElementById('cardGraphInputRatio');
        const inputYieldEl = document.getElementById('cardGraphInputYield');
        const firstDripEl = document.getElementById('cardGraphFirstDrip');
        const maxFlowEl = document.getElementById('cardGraphMaxFlow');
        const avgFlowEl = document.getElementById('cardGraphAvgFlow');

        const c = getCurrentCardCoffee() || {};

        if (subtitleEl) {
            const typeDisplay = getCoffeeTypeDisplay(c);
            const roaster = typeDisplay.roaster !== '-' ? typeDisplay.roaster : 'Unknown Roaster';
            const farmer = typeDisplay.farmer !== '-' ? typeDisplay.farmer : '-';
            const method = c.method || '-';
            subtitleEl.textContent = `${roaster} ${farmer} (${method})`;
        }

        if (dateEl) {
            const formatDateTime = (value) => {
                if (!value) return '-';
                const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
                if (isNaN(dateObj)) return '-';
                const dd = String(dateObj.getDate()).padStart(2, '0');
                const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
                const yy = String(dateObj.getFullYear()).slice(-2);
                const hh = String(dateObj.getHours()).padStart(2, '0');
                const min = String(dateObj.getMinutes()).padStart(2, '0');
                return `${dd}-${mm}-${yy} ${hh}:${min}`;
            };
            dateEl.textContent = formatDateTime(c.createdAt);
        }

        const weightVal = parseFloat(c.weight);
        const ratioVal = parseFloat(c.ratio);
        if (inputWeightEl) inputWeightEl.value = !isNaN(weightVal) ? weightVal : '';
        if (inputRatioEl) inputRatioEl.value = !isNaN(ratioVal) ? ratioVal : '';
        if (inputYieldEl) inputYieldEl.value = !isNaN(weightVal) && !isNaN(ratioVal) ? (weightVal * ratioVal).toFixed(1) : '';
        if (firstDripEl) firstDripEl.value = c.firstDrip ?? '';
        if (maxFlowEl) maxFlowEl.value = c.maxFlow ?? '';
        if (avgFlowEl) avgFlowEl.value = c.avgFlow ?? '';

        const coffeeScale = getCoffeeScale?.();
        if (coffeeScale?.renderGraphTo && currentGraphData) {
            if (emptyEl) emptyEl.classList.add('hidden');
            coffeeScale.renderGraphTo(canvas, currentGraphData);
        } else {
            if (emptyEl) emptyEl.classList.remove('hidden');
            const ctx = canvas?.getContext?.('2d');
            if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        updateCoffeeGraphNav();
    };

    const closeCardGraphModal = (e) => {
        if (!e || e.target.id === 'cardGraphModal' || e.target.closest('button')) {
            const modal = document.getElementById('cardGraphModal');
            if (modal) modal.classList.add('hidden');
        }
    };

    const navigateCoffeeCardFromGraph = async (direction) => {
        const order = getBrewTableOrder();
        const idx = order.indexOf(getCurrentCoffeeCardId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        dispatchCommand?.('brews.openCard', { id: order[nextIdx], event: null, options: { keepNavigationOrder: true } });
        await openCardGraphModal(null, true);
    };

    return {
        openCardGraphModal,
        closeCardGraphModal,
        updateCoffeeGraphNav,
        navigateCoffeeCardFromGraph
    };
};
