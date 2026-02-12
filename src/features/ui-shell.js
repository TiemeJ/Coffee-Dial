export const createUiShellModule = ({
    persistOnboardingSeen,
    closeModal,
    closeCardGraphModal,
    closeGraphModal,
    closeCoffeeCard,
    closeStats,
    closeExportModal,
    closeImportModal,
    closeUploadModal,
    closeCoffeeTypeCard,
    closeBeanCard,
    closeImageModal,
    closeCoffeeTypes,
    closeBeans,
    closeCoffeeScaleModal,
    closeConnectScaleModal
}) => {
    let hasRegisteredGlobalCloseHandler = false;

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
            document.getElementById('mainMenuDropdown')?.classList.add('hidden');
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
    };

    const initGlobalCloseHandlers = () => {
        if (hasRegisteredGlobalCloseHandler) return;
        hasRegisteredGlobalCloseHandler = true;
        document.addEventListener('click', closeMenus);
    };

    const toggleMainMenu = (e) => {
        if (e) e.stopPropagation();
        document.getElementById('mainMenuDropdown')?.classList.toggle('hidden');
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
            closeIfVisible('exportModal', () => closeExportModal()) ||
            closeIfVisible('importModal', () => closeImportModal()) ||
            closeIfVisible('preferencesModal', () => document.getElementById('preferencesModal')?.classList.add('hidden')) ||
            closeIfVisible('coffeeScaleModal', () => closeCoffeeScaleModal?.()) ||
            closeIfVisible('uploadPhotoModal', () => closeUploadModal()) ||
            closeIfVisible('coffeeTypeCardOverlay', () => closeCoffeeTypeCard(null)) ||
            closeIfVisible('galleryModal', () => document.getElementById('galleryModal')?.classList.add('hidden')) ||
            closeIfVisible('beanCardOverlay', () => closeBeanCard(null)) ||
            closeIfVisible('imageModalOverlay', () => closeImageModal(null)) ||
            closeIfVisible('coffeeTypesModal', () => closeCoffeeTypes()) ||
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
