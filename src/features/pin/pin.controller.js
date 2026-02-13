import { createPinRepoModule } from './pin.repo.js';
import { createPinViewModule } from './pin.view.js';
import { createBrewPinArtModule } from './brew-pin-art.js';

export const createPinControllerModule = ({
    db,
    doc,
    writeBatch,
    getCurrentUser,
    getCurrentView,
    getCurrentSort,
    getActiveFilters,
    getCoffees,
    setCoffees,
    getBeans,
    getPinnedBrewsPreferences,
    getBeanCalculatedStock,
    getCoffeeTypeForBrew,
    getCoffeeTypeDisplay,
    openCoffeeCard,
    renderTable
}) => {
    const repo = createPinRepoModule({ db, doc, writeBatch });
    const view = createPinViewModule({ getBeanCalculatedStock, getCoffeeTypeDisplay });
    const artView = createBrewPinArtModule({
        resolveLinkedBean: (...args) => view.resolveLinkedBean(...args),
        getCoffeeTypeForBrew: (...args) => getCoffeeTypeForBrew(...args),
        getBeanCalculatedStock: (...args) => getBeanCalculatedStock(...args),
        openCoffeeCard: (...args) => openCoffeeCard(...args)
    });

    let expandedBeans = new Set();
    let lastPinnedBeanKeys = [];
    let sortableInstances = [];

    const destroySortable = () => {
        sortableInstances.forEach((instance) => instance.destroy());
        sortableInstances = [];
    };

    const resolveBeanKey = (brew) => {
        const linkedBean = view.resolveLinkedBean({ brew, beans: getBeans() });
        return linkedBean ? linkedBean.id : `no-bean-${brew.id}`;
    };

    const updatePinnedHeaderToggleIcon = (beanKeys = [], organizeByBeans = true, coffeeArtEnabled = false) => {
        lastPinnedBeanKeys = organizeByBeans ? beanKeys : [];
        const icon = document.getElementById('pinnedToggleIcon');
        const header = document.getElementById('pinnedHeaderToggle');
        if (!icon || !header) return;
        header.classList.toggle('hidden', !!coffeeArtEnabled);
        if (coffeeArtEnabled) {
            icon.classList.add('hidden');
            header.classList.remove('cursor-pointer');
            return;
        }
        if (!organizeByBeans || coffeeArtEnabled || !beanKeys.length) {
            icon.classList.add('hidden');
            header.classList.remove('cursor-pointer');
            return;
        }
        icon.classList.remove('hidden');
        header.classList.add('cursor-pointer');
        const allExpanded = beanKeys.every((key) => expandedBeans.has(key));
        icon.classList.toggle('fa-plus', !allExpanded);
        icon.classList.toggle('fa-minus', allExpanded);
    };

    const initSortable = () => {
        destroySortable();

        const currentSort = getCurrentSort();
        const activeFilters = getActiveFilters();
        const isDraggable =
            getCurrentView() === 'mine' &&
            currentSort.key === null &&
            !activeFilters.method &&
            !Object.values(activeFilters).some((v) => v !== null);

        if (!isDraggable) return;
        const pinnedGrid = document.getElementById('pinnedGrid');
        if (!pinnedGrid) return;

        const sortable = new Sortable(pinnedGrid, {
            handle: '.drag-handle',
            animation: 200,
            ghostClass: 'sortable-ghost',
            dragClass: 'sortable-drag',
            delay: 100,
            delayOnTouchOnly: true,
            forceFallback: false,
            fallbackClass: 'sortable-drag',
            onEnd: async (evt) => {
                if (evt.oldIndex === evt.newIndex) return;
                const coffees = getCoffees();
                const tiles = Array.from(pinnedGrid.children);
                const updates = [];
                let orderIndex = 0;

                tiles.forEach((tile) => {
                    const brewId = tile.getAttribute('data-id');
                    const beanKey = tile.getAttribute('data-bean-key');
                    if (brewId) {
                        updates.push({ id: brewId, customOrder: orderIndex });
                        orderIndex += 1;
                        return;
                    }
                    if (beanKey) {
                        const groupBrews = coffees.filter((c) => c.isActive && resolveBeanKey(c) === beanKey);
                        groupBrews.forEach((brew) => {
                            updates.push({ id: brew.id, customOrder: orderIndex });
                            orderIndex += 1;
                        });
                    }
                });

                if (!updates.length) return;

                try {
                    await repo.saveCustomOrder({ uid: getCurrentUser()?.uid, updates });
                    const map = new Map(updates.map((u) => [u.id, u.customOrder]));
                    setCoffees(coffees.map((c) => (map.has(c.id) ? { ...c, customOrder: map.get(c.id) } : c)));
                    renderPinnedTiles();
                } catch (err) {
                    console.error('Reorder failed', err);
                    alert('Failed to save new order.');
                    renderTable();
                }
            }
        });

        sortableInstances.push(sortable);
    };

    const renderPinnedTiles = () => {
        const pinnedPrefs = getPinnedBrewsPreferences();
        const pinnedGrid = document.getElementById('pinnedGrid');
        const isCoffeeArtEnabled = !!pinnedPrefs.organizeByBeans && !!pinnedPrefs.coffeeArtEnabled;

        if (isCoffeeArtEnabled) {
            destroySortable();
            if (pinnedGrid) pinnedGrid.classList.add('hidden');
            const result = artView.renderPinnedArtView({
                coffees: getCoffees(),
                beans: getBeans(),
                pinnedBrewsPreferences: pinnedPrefs
            });
            const section = document.getElementById('pinnedSection');
            if (section) section.classList.toggle('hidden', !result.hasArt);
            updatePinnedHeaderToggleIcon([], !!pinnedPrefs.organizeByBeans, true);
            return;
        }

        artView.closeChooser();
        const artRoot = document.getElementById('brewPinArtRoot');
        if (artRoot) artRoot.classList.add('hidden');
        if (pinnedGrid) pinnedGrid.classList.remove('hidden');

        const result = view.renderPinnedTilesView({
            coffees: getCoffees(),
            beans: getBeans(),
            pinnedBrewsPreferences: pinnedPrefs,
            currentView: getCurrentView(),
            currentSort: getCurrentSort(),
            activeFilters: getActiveFilters(),
            expandedBeans,
            onToggleBeanExpansion: (beanKey) => {
                toggleBeanExpansion(beanKey);
            },
            openCoffeeCard
        });

        updatePinnedHeaderToggleIcon(result.beanKeys, !!pinnedPrefs.organizeByBeans, false);
        if (result.hasTiles) initSortable();
    };

    const toggleBeanExpansion = (beanKey) => {
        if (expandedBeans.has(beanKey)) expandedBeans.delete(beanKey);
        else expandedBeans.add(beanKey);
        renderPinnedTiles();
    };

    const togglePinnedTiles = () => {
        if (!lastPinnedBeanKeys.length) return;
        const allExpanded = lastPinnedBeanKeys.every((key) => expandedBeans.has(key));
        if (allExpanded) expandedBeans.clear();
        else expandedBeans = new Set(lastPinnedBeanKeys);
        renderPinnedTiles();
    };

    return {
        renderPinnedTiles,
        togglePinnedTiles,
        toggleBeanExpansion
    };
};
