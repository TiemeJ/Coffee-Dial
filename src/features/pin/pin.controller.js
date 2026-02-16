import { createPinRepoModule } from './pin.repo.js';
import { createPinViewModule } from './pin.view.js';
import { createBrewPinArtModule } from './brew-pin-art.js';

export const createPinControllerModule = ({
    dataService,
    appCommands,
    appEvents,
    autoPinOpenBagsIfEnabled,
    autoUnpinClosedBagsIfEnabled,
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
}) => {
    if (!appCommands?.dispatch || !appCommands?.registerCommand) {
        throw new Error('createPinControllerModule requires appCommands.dispatch and appCommands.registerCommand');
    }
    if (!appEvents?.publish) {
        throw new Error('createPinControllerModule requires appEvents.publish');
    }
    if (typeof autoPinOpenBagsIfEnabled !== 'function') {
        throw new Error('createPinControllerModule requires autoPinOpenBagsIfEnabled');
    }
    if (typeof autoUnpinClosedBagsIfEnabled !== 'function') {
        throw new Error('createPinControllerModule requires autoUnpinClosedBagsIfEnabled');
    }
    const repo = createPinRepoModule({ dataService });
    const dispatchCommand = (commandName, payload) => {
        return appCommands.dispatch(commandName, payload, { source: 'pin.controller' });
    };
    const publishEvent = (eventName, payload) => {
        appEvents.publish(eventName, payload, { source: 'pin.controller' });
    };
    const view = createPinViewModule({ getBeanCalculatedStock, getCoffeeTypeDisplay });
    const artView = createBrewPinArtModule({
        resolveLinkedBean: (...args) => view.resolveLinkedBean(...args),
        getCoffeeTypeForBrew: (...args) => getCoffeeTypeForBrew(...args),
        getBeanCalculatedStock: (...args) => getBeanCalculatedStock(...args),
        openPinnedBrewCard: (...args) => openPinnedBrewCard(...args),
        openPinnedBeanCardWithOrder: (beanId, order = [], event = null) => {
            dispatchCommand('beans.openCardWithOrder', { beanId, order, event });
            publishEvent('pin.beanCardOpened', { beanId, order });
        }
    });

    let expandedBeans = new Set();
    let lastPinnedBeanKeys = [];
    let sortableInstances = [];

    const getPinnedBrewOrderIds = () =>
        getCoffees()
            .filter((c) => c.isActive)
            .sort((a, b) => {
                const orderDelta = (a.customOrder || 0) - (b.customOrder || 0);
                if (orderDelta !== 0) return orderDelta;
                return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
            })
            .map((brew) => brew.id);

    const getVisiblePinnedBrewOrderIds = () => {
        const activeBrewsSorted = getCoffees()
            .filter((c) => c.isActive)
            .sort((a, b) => {
                const orderDelta = (a.customOrder || 0) - (b.customOrder || 0);
                if (orderDelta !== 0) return orderDelta;
                return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
            });
        const resolveBeanKeyForBrew = (brew) => {
            const linkedBean = view.resolveLinkedBean({ brew, beans: getBeans() });
            return linkedBean ? linkedBean.id : `no-bean-${brew.id}`;
        };
        const brewIdsByBeanKey = new Map();
        activeBrewsSorted.forEach((brew) => {
            const beanKey = resolveBeanKeyForBrew(brew);
            if (!brewIdsByBeanKey.has(beanKey)) brewIdsByBeanKey.set(beanKey, []);
            brewIdsByBeanKey.get(beanKey).push(brew.id);
        });

        const artRoot = document.getElementById('brewPinArtRoot');
        const artGrid = document.getElementById('brewPinArtGrid');
        if (artRoot && artGrid && !artRoot.classList.contains('hidden')) {
            const seen = new Set();
            const ids = [];
            Array.from(artGrid.children).forEach((card) => {
                const raw = card.getAttribute('data-brew-ids') || '';
                raw
                    .split(',')
                    .map((id) => id.trim())
                    .filter(Boolean)
                    .forEach((id) => {
                        if (seen.has(id)) return;
                        seen.add(id);
                        ids.push(id);
                    });
            });
            return ids;
        }

        const pinnedGrid = document.getElementById('pinnedGrid');
        if (!pinnedGrid || pinnedGrid.classList.contains('hidden')) return [];
        const seen = new Set();
        const ids = [];
        Array.from(pinnedGrid.children).forEach((child) => {
            const brewId = child.getAttribute('data-id');
            if (brewId) {
                if (seen.has(brewId)) return;
                seen.add(brewId);
                ids.push(brewId);
                return;
            }
            const beanKey = child.getAttribute('data-bean-key');
            if (!beanKey) return;
            const groupIds = brewIdsByBeanKey.get(beanKey) || [];
            groupIds.forEach((id) => {
                if (seen.has(id)) return;
                seen.add(id);
                ids.push(id);
            });
        });
        return ids;
    };

    const openPinnedBrewCard = (brewId, event = null) => {
        const visibleOrder = getVisiblePinnedBrewOrderIds();
        const order = visibleOrder.includes(brewId) ? visibleOrder : getPinnedBrewOrderIds();
        dispatchCommand('brews.openCardWithOrder', {
            id: brewId,
            order,
            event,
            options: { pinnedNavigationAccent: true }
        });
        publishEvent('pin.brewCardOpened', { brewId, order });
    };

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
                    dispatchCommand('brews.refreshTable', {});
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
            openPinnedBrewCard: (...args) => openPinnedBrewCard(...args)
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

    appCommands.registerCommand(
        'pin.autoPinOpenBagsIfEnabled',
        ({ beanId = null, brewId = null, brewData = null } = {}) =>
            autoPinOpenBagsIfEnabled({ beanId, brewId, brewData }),
        {
            owner: 'pin',
            schema: {
                beanId: 'string|null?',
                brewId: 'string|null?',
                brewData: 'object|null?'
            }
        }
    );

    appCommands.registerCommand(
        'pin.autoUnpinClosedBagsIfEnabled',
        ({ beanIds = [] } = {}) => autoUnpinClosedBagsIfEnabled({ beanIds }),
        {
            owner: 'pin',
            schema: {
                beanIds: 'array?'
            }
        }
    );

    return {
        renderPinnedTiles,
        togglePinnedTiles,
        toggleBeanExpansion
    };
};
