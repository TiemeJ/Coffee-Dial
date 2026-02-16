export const installCardNavigationHandlers = ({
    navigateBeanCard,
    navigateCoffeeCard,
    navigateCoffeeCardFromGraph,
    navigateCoffeeTypeCard,
    navigateGasCard,
    handleEscapeKey
}) => {
    const isVisible = (id) => {
        const el = document.getElementById(id);
        return el && !el.classList.contains('hidden');
    };

    const isTextInputTarget = (target) => {
        return target && (
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.tagName === 'SELECT' ||
            target.isContentEditable
        );
    };

    const tryNavigate = (btnId, action) => {
        const btn = document.getElementById(btnId);
        if (!btn || btn.disabled || btn.classList.contains('hidden')) return false;
        action();
        return true;
    };

    const handleCardKeyNav = (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        const target = event.target;
        if (isTextInputTarget(target)) return;

        const dir = event.key === 'ArrowLeft' ? -1 : 1;

        if (isVisible('cardGraphModal')) {
            if (tryNavigate(dir < 0 ? 'cardGraphPrevBtn' : 'cardGraphNextBtn', () => navigateCoffeeCardFromGraph(dir))) {
                event.preventDefault();
            }
            return;
        }

        if (isVisible('coffeeCardOverlay')) {
            if (tryNavigate(dir < 0 ? 'coffeeCardPrevBtn' : 'coffeeCardNextBtn', () => navigateCoffeeCard(dir))) {
                event.preventDefault();
            }
            return;
        }

        if (isVisible('beanCardOverlay')) {
            if (tryNavigate(dir < 0 ? 'beanCardPrevBtn' : 'beanCardNextBtn', () => navigateBeanCard(dir))) {
                event.preventDefault();
            }
            return;
        }

        if (isVisible('coffeeTypeCardOverlay')) {
            if (tryNavigate(dir < 0 ? 'coffeeTypeCardPrevBtn' : 'coffeeTypeCardNextBtn', () => navigateCoffeeTypeCard(dir))) {
                event.preventDefault();
            }
            return;
        }

        if (isVisible('gasCardOverlay')) {
            if (tryNavigate(dir < 0 ? 'gasCardPrevBtn' : 'gasCardNextBtn', () => navigateGasCard(dir))) {
                event.preventDefault();
            }
        }
    };

    const bindSwipeNavigation = ({ overlayId, panelId, prevBtnId, nextBtnId, onNavigate }) => {
        const overlay = document.getElementById(overlayId);
        if (!overlay) return;
        const panel = panelId ? document.getElementById(panelId) : overlay.firstElementChild;
        if (!panel || panel.dataset.swipeNavBound === 'true') return;

        const state = {
            startX: 0,
            startY: 0,
            active: false,
            blocked: false
        };
        const SWIPE_MIN_DISTANCE = 40;

        const isSwipeBlockedTarget = (target) => {
            if (!(target instanceof Element)) return false;
            if (isTextInputTarget(target)) return true;
            return !!target.closest('button, a, label, .action-menu, .action-menu-toggle, [data-no-swipe]');
        };

        panel.addEventListener('touchstart', (event) => {
            if (!isVisible(overlayId)) {
                state.active = false;
                return;
            }
            if (!event.touches || event.touches.length !== 1) {
                state.active = false;
                return;
            }

            const touch = event.touches[0];
            state.startX = touch.clientX;
            state.startY = touch.clientY;
            state.blocked = isSwipeBlockedTarget(event.target);
            state.active = !state.blocked;
        }, { passive: true });

        panel.addEventListener('touchend', (event) => {
            if (!state.active || state.blocked || !isVisible(overlayId)) return;
            if (!event.changedTouches || event.changedTouches.length !== 1) return;

            const touch = event.changedTouches[0];
            const deltaX = touch.clientX - state.startX;
            const deltaY = touch.clientY - state.startY;
            if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE) return;
            if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

            const direction = deltaX < 0 ? 1 : -1;
            const btnId = direction < 0 ? prevBtnId : nextBtnId;
            tryNavigate(btnId, () => onNavigate(direction));
        }, { passive: true });

        panel.dataset.swipeNavBound = 'true';
    };

    document.addEventListener('keydown', handleCardKeyNav);
    bindSwipeNavigation({
        overlayId: 'coffeeCardOverlay',
        panelId: 'coffeeCardContent',
        prevBtnId: 'coffeeCardPrevBtn',
        nextBtnId: 'coffeeCardNextBtn',
        onNavigate: navigateCoffeeCard
    });
    bindSwipeNavigation({
        overlayId: 'beanCardOverlay',
        prevBtnId: 'beanCardPrevBtn',
        nextBtnId: 'beanCardNextBtn',
        onNavigate: navigateBeanCard
    });
    bindSwipeNavigation({
        overlayId: 'coffeeTypeCardOverlay',
        prevBtnId: 'coffeeTypeCardPrevBtn',
        nextBtnId: 'coffeeTypeCardNextBtn',
        onNavigate: navigateCoffeeTypeCard
    });
    bindSwipeNavigation({
        overlayId: 'gasCardOverlay',
        panelId: 'gasCardPanel',
        prevBtnId: 'gasCardPrevBtn',
        nextBtnId: 'gasCardNextBtn',
        onNavigate: navigateGasCard
    });
    bindSwipeNavigation({
        overlayId: 'cardGraphModal',
        prevBtnId: 'cardGraphPrevBtn',
        nextBtnId: 'cardGraphNextBtn',
        onNavigate: navigateCoffeeCardFromGraph
    });

    document.addEventListener('keydown', handleEscapeKey);
};
