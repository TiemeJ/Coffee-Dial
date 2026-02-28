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
    selectPinnedBrewOrderIds = (coffees = []) => coffees.filter((brew) => brew?.isActive).map((brew) => brew.id),
    selectVisiblePinnedBrewOrderIds = ({ coffees = [] } = {}) => coffees.filter((brew) => brew?.isActive).map((brew) => brew.id)
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

    let sortableInstances = [];

    const getPinnedBrewOrderIds = () => selectPinnedBrewOrderIds(getCoffees());

    const openPinnedBrewCard = (brewId, event = null) => {
        const prefs = getPinnedBrewsPreferences() || {};
        const visibleOrder = selectVisiblePinnedBrewOrderIds({
            coffees: getCoffees(),
            beans: getBeans()
        });
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
        const SortableCtor = typeof window !== 'undefined' ? window.Sortable : null;
        if (typeof SortableCtor !== 'function') return;

        const sortable = new SortableCtor(pinnedGrid, {
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

    const renderPinnedTiles = (options = {}) => {
        const {
            progressiveHydration = false,
            activeBeansOnly = false,
            suppressCoffeeDetails = false,
            suppressCoffeeImages = false
        } = options || {};
        const pinnedPrefs = getPinnedBrewsPreferences();
        const pinnedGrid = document.getElementById('pinnedGrid');
        const isCoffeeArtEnabled = pinnedPrefs.showTilesInsteadOfCoffeeArt === false;

        if (isCoffeeArtEnabled) {
            destroySortable();
            if (pinnedGrid) pinnedGrid.classList.add('hidden');
            const result = artView.renderPinnedArtView({
                coffees: getCoffees(),
                beans: getBeans(),
                pinnedBrewsPreferences: pinnedPrefs,
                progressiveHydration,
                activeBeansOnly,
                suppressCoffeeDetails,
                suppressCoffeeImages
            });
            const section = document.getElementById('pinnedSection');
            if (section) section.classList.toggle('hidden', !result.hasArt);
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
            openPinnedBrewCard: (...args) => openPinnedBrewCard(...args),
            openPinnedBeanCardWithOrder: (beanId, order = [], event = null) => {
                dispatchCommand('beans.openCardWithOrder', { beanId, order, event });
                publishEvent('pin.beanCardOpened', { beanId, order });
            },
            progressiveHydration,
            activeBeansOnly,
            suppressCoffeeDetails,
            suppressCoffeeImages
        });

        if (result.hasTiles) initSortable();
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
        renderPinnedTiles
    };
};
