export const createUiShellModule = ({
    persistOnboardingSeen,
    closeModal,
    closeCardGraphModal,
    closeGraphModal,
    closeCoffeeCard,
    closeStats,
    closeImportExportModal,
    closeUploadModal,
    closeCoffeeTypeCard,
    closeBeanCard,
    closeGasCard,
    closeImageModal,
    closeCoffeeTypes,
    closeBeans,
    closeGasList,
    closeCoffeeScaleModal,
    closeConnectScaleModal
}) => {
    let hasRegisteredGlobalCloseHandler = false;
    let hasRegisteredModalGuardHandlers = false;
    const scrollLockState = {
        htmlOverflow: '',
        bodyOverflow: ''
    };
    let lastTouchY = null;
    const getMainMenuDropdown = () => document.getElementById('mainMenuDropdown');
    const getMainMenuBtn = () => document.getElementById('mainMenuBtn');
    const setMainMenuButtonActive = (isActive) => {
        const btn = getMainMenuBtn();
        if (!btn) return;
        btn.classList.toggle('bg-coffee-100', isActive);
        btn.classList.toggle('dark:bg-[#44403c]', isActive);
    };
    const setMainMenuOpen = (isOpen) => {
        const dropdown = getMainMenuDropdown();
        if (!dropdown) return;
        dropdown.classList.toggle('hidden', !isOpen);
        setMainMenuButtonActive(isOpen);
        if (!isOpen) getMainMenuBtn()?.blur();
    };

    const FOCUSABLE_SELECTOR = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled]):not([type="hidden"])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
        '[contenteditable="true"]'
    ].join(',');

    const getVisibleModals = () =>
        Array.from(document.querySelectorAll('[id$="Modal"], [id$="Overlay"]')).filter((el) => {
            if (!el || el.classList.contains('hidden')) return false;
            if (!(el instanceof HTMLElement)) return false;
            const style = window.getComputedStyle(el);
            return style.display !== 'none' && style.visibility !== 'hidden' && style.position === 'fixed';
        });

    const getModalZIndex = (el) => {
        const z = Number.parseInt(window.getComputedStyle(el).zIndex, 10);
        return Number.isFinite(z) ? z : 0;
    };

    const getTopModal = () => {
        const modals = getVisibleModals();
        if (!modals.length) return null;
        modals.sort((a, b) => {
            const zDiff = getModalZIndex(a) - getModalZIndex(b);
            if (zDiff !== 0) return zDiff;
            const pos = a.compareDocumentPosition(b);
            return (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? -1 : 1;
        });
        return modals[modals.length - 1];
    };

    const lockBackgroundScroll = () => {
        if (document.body.dataset.modalScrollLocked === 'true') return;
        scrollLockState.htmlOverflow = document.documentElement.style.overflow;
        scrollLockState.bodyOverflow = document.body.style.overflow;
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        document.body.dataset.modalScrollLocked = 'true';
    };

    const unlockBackgroundScroll = () => {
        if (document.body.dataset.modalScrollLocked !== 'true') return;
        document.documentElement.style.overflow = scrollLockState.htmlOverflow;
        document.body.style.overflow = scrollLockState.bodyOverflow;
        delete document.body.dataset.modalScrollLocked;
    };

    const getFocusableElements = (container) =>
        Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
            const element = el;
            if (!(element instanceof HTMLElement)) return false;
            if (element.hasAttribute('disabled')) return false;
            if (element.getAttribute('aria-hidden') === 'true') return false;
            return element.offsetParent !== null || window.getComputedStyle(element).position === 'fixed';
        });

    const focusModal = (modal) => {
        if (!modal) return;
        const focusables = getFocusableElements(modal);
        const target = focusables[0] || modal;
        if (!modal.hasAttribute('tabindex')) modal.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    };

    const hasVerticalScroll = (el) => {
        const style = window.getComputedStyle(el);
        if (!/(auto|scroll)/.test(style.overflowY)) return false;
        return el.scrollHeight > el.clientHeight;
    };

    const findScrollableAncestorWithin = (start, boundary) => {
        let current = start instanceof Element ? start : null;
        while (current && boundary.contains(current)) {
            if (current instanceof HTMLElement && hasVerticalScroll(current)) return current;
            current = current.parentElement;
        }
        if (boundary instanceof HTMLElement && hasVerticalScroll(boundary)) return boundary;
        return null;
    };

    const enforceTopModalGuards = () => {
        const topModal = getTopModal();
        if (!topModal) {
            unlockBackgroundScroll();
            return;
        }
        lockBackgroundScroll();
        if (!topModal.contains(document.activeElement)) {
            focusModal(topModal);
        }
    };

    const openHelp = () => document.getElementById('helpModal')?.classList.remove('hidden');

    const closeHelp = async () => {
        document.getElementById('helpModal')?.classList.add('hidden');
        if (typeof persistOnboardingSeen === 'function') {
            await persistOnboardingSeen();
        }
    };

    const openAbout = () => document.getElementById('aboutModal')?.classList.remove('hidden');

    const closeAbout = () => document.getElementById('aboutModal')?.classList.add('hidden');

    const openEasterEgg = () => {
        const modal = document.getElementById('easterEggModal');
        const video = document.getElementById('easterEggVideo');
        if (!modal || !video) return;
        modal.classList.remove('hidden');
        video.currentTime = 0;
        video.play().catch((e) => console.log('Autoplay failed', e));
    };

    const closeEasterEgg = (e) => {
        if (!e || e.target.id === 'easterEggModal' || e.target.closest('button')) {
            const modal = document.getElementById('easterEggModal');
            const video = document.getElementById('easterEggVideo');
            if (!modal || !video) return;
            modal.classList.add('hidden');
            video.pause();
        }
    };

    const closeMenus = (e) => {
        enforceTopModalGuards();
        const modalOverlay = document.getElementById('modalOverlay');
        if (
            modalOverlay &&
            !modalOverlay.contains(e.target) &&
            !modalOverlay.classList.contains('hidden') &&
            e.target.id === 'modalOverlay'
        ) {
            closeModal();
        }

        if (!document.getElementById('filterDropdown')?.contains(e.target)) {
            document.getElementById('filterDropdown')?.classList.add('hidden');
        }

        if (
            !document.getElementById('mainMenuDropdown')?.contains(e.target) &&
            !e.target.closest('[data-action-click*="toggleMainMenu"]')
        ) {
            setMainMenuOpen(false);
        }

        if (
            !document.getElementById('aiMenuDropdown')?.contains(e.target) &&
            !e.target.closest('[data-action-click*="toggleAiMenu"]')
        ) {
            document.getElementById('aiMenuDropdown')?.classList.add('hidden');
        }

        if (
            !e.target.closest('.action-menu') &&
            !e.target.closest('.action-menu-toggle') &&
            !e.target.closest('[data-action-click*="toggleActionMenu"]')
        ) {
            document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        }

        if (
            !e.target.closest('#quickFilterDropdown') &&
            !e.target.closest('#quickFilterValuesDropdown') &&
            !e.target.closest('[data-action-click*="toggleQuickFilter"]')
        ) {
            document.getElementById('quickFilterDropdown')?.classList.add('hidden');
            document.getElementById('quickFilterValuesDropdown')?.classList.add('hidden');
        }

        if (
            !e.target.closest('#beansQuickFilterDropdown') &&
            !e.target.closest('#beansQuickFilterValuesDropdown') &&
            !e.target.closest('[data-action-click*="toggleBeansQuickFilter"]')
        ) {
            document.getElementById('beansQuickFilterDropdown')?.classList.add('hidden');
            document.getElementById('beansQuickFilterValuesDropdown')?.classList.add('hidden');
        }

        if (
            !e.target.closest('#coffeeTypesQuickFilterDropdown') &&
            !e.target.closest('#coffeeTypesQuickFilterValuesDropdown') &&
            !e.target.closest('[data-action-click*="toggleCoffeeTypesQuickFilter"]')
        ) {
            document.getElementById('coffeeTypesQuickFilterDropdown')?.classList.add('hidden');
            document.getElementById('coffeeTypesQuickFilterValuesDropdown')?.classList.add('hidden');
        }

        if (
            !e.target.closest('#gasQuickFilterDropdown') &&
            !e.target.closest('#gasQuickFilterValuesDropdown') &&
            !e.target.closest('[data-action-click*="toggleGasQuickFilter"]')
        ) {
            document.getElementById('gasQuickFilterDropdown')?.classList.add('hidden');
            document.getElementById('gasQuickFilterValuesDropdown')?.classList.add('hidden');
        }
    };

    const initGlobalCloseHandlers = () => {
        if (hasRegisteredGlobalCloseHandler) return;
        hasRegisteredGlobalCloseHandler = true;
        document.addEventListener('click', closeMenus);

        if (hasRegisteredModalGuardHandlers) return;
        hasRegisteredModalGuardHandlers = true;

        document.addEventListener(
            'focusin',
            (event) => {
                const topModal = getTopModal();
                if (!topModal) return;
                if (topModal.contains(event.target)) return;
                focusModal(topModal);
            },
            true
        );

        document.addEventListener(
            'keydown',
            (event) => {
                if (event.key !== 'Tab') return;
                const topModal = getTopModal();
                if (!topModal) return;

                const focusables = getFocusableElements(topModal);
                if (!focusables.length) {
                    event.preventDefault();
                    focusModal(topModal);
                    return;
                }

                const first = focusables[0];
                const last = focusables[focusables.length - 1];
                const active = document.activeElement;
                const insideModal = topModal.contains(active);

                if (event.shiftKey) {
                    if (!insideModal || active === first) {
                        event.preventDefault();
                        last.focus({ preventScroll: true });
                    }
                    return;
                }

                if (!insideModal || active === last) {
                    event.preventDefault();
                    first.focus({ preventScroll: true });
                }
            },
            true
        );

        document.addEventListener(
            'wheel',
            (event) => {
                const topModal = getTopModal();
                if (!topModal) return;
                if (!topModal.contains(event.target)) {
                    event.preventDefault();
                    return;
                }

                const scrollable = findScrollableAncestorWithin(event.target, topModal);
                if (!scrollable) {
                    event.preventDefault();
                    return;
                }

                const deltaY = event.deltaY;
                if (!deltaY) return;
                const atTop = scrollable.scrollTop <= 0;
                const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
                if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
                    event.preventDefault();
                }
            },
            { passive: false, capture: true }
        );

        document.addEventListener(
            'touchstart',
            (event) => {
                if (event.touches && event.touches.length > 0) {
                    lastTouchY = event.touches[0].clientY;
                }
            },
            { passive: true, capture: true }
        );

        document.addEventListener(
            'touchmove',
            (event) => {
                const topModal = getTopModal();
                if (!topModal) return;
                if (!topModal.contains(event.target)) {
                    event.preventDefault();
                    return;
                }

                const scrollable = findScrollableAncestorWithin(event.target, topModal);
                if (!scrollable) {
                    event.preventDefault();
                    return;
                }

                if (!event.touches || event.touches.length === 0 || lastTouchY === null) return;
                const currentY = event.touches[0].clientY;
                const deltaY = lastTouchY - currentY;
                lastTouchY = currentY;

                if (!deltaY) return;
                const atTop = scrollable.scrollTop <= 0;
                const atBottom = scrollable.scrollTop + scrollable.clientHeight >= scrollable.scrollHeight - 1;
                if ((deltaY < 0 && atTop) || (deltaY > 0 && atBottom)) {
                    event.preventDefault();
                }
            },
            { passive: false, capture: true }
        );

        const modalObserver = new MutationObserver(() => enforceTopModalGuards());
        modalObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['class', 'style']
        });

        enforceTopModalGuards();
    };

    const toggleMainMenu = (e) => {
        if (e) e.stopPropagation();
        const dropdown = getMainMenuDropdown();
        if (!dropdown) return;
        const willOpen = dropdown.classList.contains('hidden');
        setMainMenuOpen(willOpen);
    };

    const handleEscapeKey = (event) => {
        if (event.key !== 'Escape') return;
        const target = event.target;
        if (
            target &&
            (target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.tagName === 'SELECT' ||
                target.isContentEditable)
        ) {
            return;
        }

        const closeIfVisible = (id, closeFn) => {
            const el = document.getElementById(id);
            if (!el || el.classList.contains('hidden')) return false;
            closeFn();
            return true;
        };

        const closed =
            closeIfVisible('connectScaleModal', () => closeConnectScaleModal?.()) ||
            closeIfVisible('cardGraphModal', () => closeCardGraphModal(null)) ||
            closeIfVisible('graphModal', () => closeGraphModal()) ||
            closeIfVisible('coffeeCardOverlay', () => closeCoffeeCard(null)) ||
            closeIfVisible('easterEggModal', () => closeEasterEgg(null)) ||
            closeIfVisible('statsModal', () => closeStats()) ||
            closeIfVisible('helpModal', () => closeHelp()) ||
            closeIfVisible('aboutModal', () => closeAbout()) ||
            closeIfVisible('importExportModal', () => closeImportExportModal()) ||
            closeIfVisible('preferencesModal', () => document.getElementById('preferencesModal')?.classList.add('hidden')) ||
            closeIfVisible('brewsTablePrefsModal', () => document.getElementById('brewsTablePrefsModal')?.classList.add('hidden')) ||
            closeIfVisible('coffeeScaleModal', () => closeCoffeeScaleModal?.()) ||
            closeIfVisible('uploadPhotoModal', () => closeUploadModal()) ||
            closeIfVisible('coffeeTypeCardOverlay', () => closeCoffeeTypeCard(null)) ||
            closeIfVisible('galleryModal', () => document.getElementById('galleryModal')?.classList.add('hidden')) ||
            closeIfVisible('gasCardOverlay', () => closeGasCard(null)) ||
            closeIfVisible('beanCardOverlay', () => closeBeanCard(null)) ||
            closeIfVisible('imageModalOverlay', () => closeImageModal(null)) ||
            closeIfVisible('coffeeTypesModal', () => closeCoffeeTypes()) ||
            closeIfVisible('gasModal', () => closeGasList()) ||
            closeIfVisible('beansModal', () => closeBeans()) ||
            closeIfVisible('modalOverlay', () => closeModal());

        if (closed) event.preventDefault();
    };

    return {
        openHelp,
        closeHelp,
        openAbout,
        closeAbout,
        openEasterEgg,
        closeEasterEgg,
        closeMenus,
        initGlobalCloseHandlers,
        toggleMainMenu,
        handleEscapeKey
    };
};
