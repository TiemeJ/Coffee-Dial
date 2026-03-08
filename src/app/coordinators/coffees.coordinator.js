import { createCoffeeTypeCardModule } from '../../features/coffees/coffee-type-card.js';
import { createCoffeeTypesTableModule } from '../../features/coffees/coffee-types-table.js';
import { createCoffeesRepoModule } from '../../features/coffees/coffees.repo.js';
import { withDetectedDecaf } from '../../core/coffee-decaf.js';

export const createCoffeesCoordinator = ({
    dataService,
    storageService,
    imageCompression,
    removeCoffeeImageBackground,
    getCurrentUser,
    getCurrentView,
    getCurrentCoffeeTypeId,
    setCurrentCoffeeTypeId,
    getCoffees,
    getCoffeeTypes,
    getPinnedBrewsPreferences,
    setCoffeeTypesState,
    getCoffeeTypesSearch,
    setCoffeeTypesSearchState,
    getCoffeeTypesFilters,
    setCoffeeTypesFiltersState,
    getCoffeeTypesSortKey,
    setCoffeeTypesSortKeyState,
    getCoffeeTypesSortDir,
    setCoffeeTypesSortDirState,
    getBeans,
    setBeansState,
    getStarDisplay,
    openAppConfirm,
    updateCoffeeTypeSelectors,
    renderPinnedTiles,
    openLightbox,
    appCommands = null,
    appEvents = null
}) => {
    const repo = createCoffeesRepoModule({ dataService });
    const dispatchCommand = (commandName, payload) => {
        if (!appCommands?.dispatch) return undefined;
        return appCommands.dispatch(commandName, payload, { source: 'coffees.coordinator' });
    };
    const publishEvent = (eventName, payload) => {
        if (!appEvents?.publish) return;
        appEvents.publish(eventName, payload, { source: 'coffees.coordinator' });
    };
    const dispatchOnly = (commandName, payload) => {
        try {
            return dispatchCommand(commandName, payload);
        } catch (error) {
            console.warn(`[Coffees] Command "${commandName}" failed`, error);
            return undefined;
        }
    };
    let getFilteredSortedCoffeeTypes = () => [];
    let renderCoffeeTypesTable = () => {};
    let openCoffeeTypeCard = () => {};
    let closeCoffeeTypeCard = () => {};

    const openCoffeeTypes = () => {
        if (!getCurrentUser()) return alert('Please sign in.');
        document.getElementById('coffeeTypesModal').classList.remove('hidden');
        renderCoffeeTypesTable();
    };

    const closeCoffeeTypes = () => {
        document.getElementById('coffeeTypesModal').classList.add('hidden');
    };

    const createCoffeeTypeFromModal = async () => {
        const user = getCurrentUser();
        if (!user) return alert('Please sign in.');
        const nowIso = new Date().toISOString();
        const typeData = withDetectedDecaf({
            uid: user.uid,
            roaster: '',
            farmer: '',
            origin: '',
            processing: '',
            variety: '',
            roast: '',
            decaf: false,
            rating: 0,
            tasteNotes: '',
            webshopUrl: '',
            imageUrl: '',
            createdAt: nowIso,
            updatedAt: nowIso
        });

        try {
            const typeRef = await repo.createCoffeeType({ uid: user.uid, data: typeData });
            const newType = { id: typeRef.id, ...typeData };
            if (!getCoffeeTypes().find((ct) => ct.id === newType.id)) setCoffeeTypesState([...getCoffeeTypes(), newType]);
            dispatchOnly('coffees.openCard', { id: newType.id, event: null });
            enterCoffeeTypeEditMode();
            publishEvent('coffees.created', { coffeeTypeId: newType.id });
        } catch (err) {
            console.error('Error creating coffee:', err);
            alert('Failed to create coffee.');
        }
    };

    const openCoffeeTypeShopUrl = (typeId, ev) => {
        if (ev) ev.stopPropagation();
        const type = getCoffeeTypes().find((ct) => ct.id === typeId);
        const url = type?.webshopUrl || type?.shopUrl;
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const openNewBagForCoffeeType = async () => {
        const user = getCurrentUser();
        const typeId = getCurrentCoffeeTypeId();
        if (!user || !typeId) return;

        const type = getCoffeeTypes().find((ct) => ct.id === typeId);
        if (!type) return;

        const nowIso = new Date().toISOString();
        const newBeanData = {
            coffeeTypeId: type.id,
            roaster: type.roaster || '',
            farmer: type.farmer || '',
            origin: type.origin || '',
            processing: type.processing || '',
            variety: type.variety || '',
            roastType: type.roast || type.roastType || '',
            shopUrl: type.webshopUrl || type.shopUrl || '',
            archived: false,
            frozen: false,
            price: null,
            stock: 250,
            beansLeft: 250,
            openedDate: null,
            frozenDate: null,
            archivedDate: null,
            roastDate: null,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        try {
            const newBeanRef = await repo.createBean({ uid: user.uid, data: newBeanData });
            const newBean = { id: newBeanRef.id, ...newBeanData };
            setBeansState([...getBeans(), newBean]);
            await dispatchOnly('pin.autoPinOpenBagsIfEnabled', {});
            dispatchOnly('beans.openCardForEdit', { beanId: newBeanRef.id, event: null });
            closeCoffeeTypeCard(null);
            publishEvent('coffees.beanOpened', { beanId: newBeanRef.id, coffeeTypeId: typeId });
        } catch (err) {
            console.error('Error creating bean from coffee type:', err);
            alert('Failed to create bean.');
        }
    };

    const showBeansForCoffeeType = () => {
        const typeId = getCurrentCoffeeTypeId();
        if (!typeId) return;
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        dispatchOnly(
            'beans.showForCoffeeType',
            { coffeeTypeId: typeId, source: 'coffees' }
        );
        publishEvent('coffees.beansRequested', { coffeeTypeId: typeId });
    };

    const showBeansForCoffeeTypeFromTable = (typeId) => {
        if (!typeId) return;
        coffeeTypeCard.closeCoffeeTypeCardMenu();
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        dispatchOnly(
            'beans.showForCoffeeType',
            { coffeeTypeId: typeId, source: 'coffees.table' }
        );
        publishEvent('coffees.beansRequested', { coffeeTypeId: typeId });
    };

    const showBrewsForCoffeeType = () => {
        const typeId = getCurrentCoffeeTypeId();
        if (!typeId) return;
        coffeeTypeCard.closeCoffeeTypeCardMenu();
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        dispatchOnly(
            'brews.showForCoffeeType',
            { coffeeTypeId: typeId, source: 'coffees' }
        );
        publishEvent('coffees.brewsRequested', { coffeeTypeId: typeId });
    };

    const showBrewsForCoffeeTypeFromTable = (typeId) => {
        if (!typeId) return;
        coffeeTypeCard.closeCoffeeTypeCardMenu();
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        dispatchOnly('brews.showForCoffeeType', { coffeeTypeId: typeId, source: 'coffees.table' });
        publishEvent('coffees.brewsRequested', { coffeeTypeId: typeId });
    };

    const updateCoffeeTypeCardNav = () => {
        const order = getFilteredSortedCoffeeTypes().map((type) => type.id);
        const idx = order.indexOf(getCurrentCoffeeTypeId());
        const prevBtn = document.getElementById('coffeeTypeCardPrevBtn');
        const nextBtn = document.getElementById('coffeeTypeCardNextBtn');
        if (!prevBtn || !nextBtn) return;
        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx === -1 || idx >= order.length - 1;
        prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
        prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-40', nextBtn.disabled);
        nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
    };

    const navigateCoffeeTypeCard = (direction) => {
        const order = getFilteredSortedCoffeeTypes().map((type) => type.id);
        const idx = order.indexOf(getCurrentCoffeeTypeId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        openCoffeeTypeCard(order[nextIdx]);
    };

    const coffeeTypeCard = createCoffeeTypeCardModule({
        dataService,
        storageService,
        imageCompression,
        removeCoffeeImageBackground,
        getCurrentUser,
        getCurrentView,
        getCurrentCoffeeTypeId,
        setCurrentCoffeeTypeId,
        getCoffeeTypes,
        setCoffeeTypesState,
        getBeans,
        setBeansState,
        openAppConfirm,
        getStarDisplay,
        renderCoffeeTypesTable: () => renderCoffeeTypesTable(),
        updateCoffeeTypeSelectors,
        renderPinnedTiles,
        dispatchCommand,
        openCoffeeTypeShopUrl,
        openNewBagForCoffeeType,
        updateCoffeeTypeCardNav,
        openLightbox
    });
    openCoffeeTypeCard = coffeeTypeCard.openCoffeeTypeCard;
    closeCoffeeTypeCard = coffeeTypeCard.closeCoffeeTypeCard;
    const enterCoffeeTypeEditMode = coffeeTypeCard.enterCoffeeTypeEditMode;

    const coffeeTypesTable = createCoffeeTypesTableModule({
        getCoffeeTypes,
        getBeans,
        getCoffees,
        getPinnedBrewsPreferences,
        getCurrentView,
        getCoffeeTypesSearch,
        setCoffeeTypesSearchState,
        getCoffeeTypesFilters,
        setCoffeeTypesFiltersState,
        getCoffeeTypesSortKey,
        setCoffeeTypesSortKeyState,
        getCoffeeTypesSortDir,
        setCoffeeTypesSortDirState,
        getStarDisplay,
        dispatchCommand
    });
    getFilteredSortedCoffeeTypes = coffeeTypesTable.getFilteredSortedCoffeeTypes;
    renderCoffeeTypesTable = coffeeTypesTable.renderCoffeeTypesTable;
    return {
        openCoffeeTypes,
        closeCoffeeTypes,
        createCoffeeTypeFromModal,
        openCoffeeTypeShopUrl,
        openNewBagForCoffeeType,
        showBeansForCoffeeType,
        showBrewsForCoffeeType,
        updateCoffeeTypeCardNav,
        navigateCoffeeTypeCard,
        showBeansForCoffeeTypeFromTable,
        showBrewsForCoffeeTypeFromTable,
        openNewBagForCoffeeTypeFromTable: coffeeTypeCard.openNewBagForCoffeeTypeFromTable,
        openCoffeeTypeFromTableEdit: coffeeTypeCard.openCoffeeTypeFromTableEdit,
        deleteCoffeeTypeFromTable: coffeeTypeCard.deleteCoffeeTypeFromTable,
        deleteCoffeeType: coffeeTypeCard.deleteCoffeeType,
        triggerCoffeeTypePhoto: coffeeTypeCard.triggerCoffeeTypePhoto,
        openCoffeeTypePhoto: coffeeTypeCard.openCoffeeTypePhoto,
        removeCoffeeTypePhoto: coffeeTypeCard.removeCoffeeTypePhoto,
        replaceCoffeeTypePhotoWithBackgroundRemoved: coffeeTypeCard.replaceCoffeeTypePhotoWithBackgroundRemoved,
        handleCoffeeTypePhoto: coffeeTypeCard.handleCoffeeTypePhoto,
        openCoffeeTypeCard: coffeeTypeCard.openCoffeeTypeCard,
        closeCoffeeTypeCard: coffeeTypeCard.closeCoffeeTypeCard,
        enterCoffeeTypeEditMode: coffeeTypeCard.enterCoffeeTypeEditMode,
        cancelCoffeeTypeEditMode: coffeeTypeCard.cancelCoffeeTypeEditMode,
        saveCoffeeTypeEdits: coffeeTypeCard.saveCoffeeTypeEdits,
        closeCoffeeTypeCardMenu: coffeeTypeCard.closeCoffeeTypeCardMenu,
        setCoffeeTypesSearch: coffeeTypesTable.setCoffeeTypesSearch,
        clearCoffeeTypesSearch: coffeeTypesTable.clearCoffeeTypesSearch,
        toggleCoffeeTypesQuickFilter: coffeeTypesTable.toggleCoffeeTypesQuickFilter,
        openCoffeeTypesQuickFilterValues: coffeeTypesTable.openCoffeeTypesQuickFilterValues,
        applyCoffeeTypesFilterFromQuick: coffeeTypesTable.applyCoffeeTypesFilterFromQuick,
        clearCoffeeTypesFilters: coffeeTypesTable.clearCoffeeTypesFilters,
        renderCoffeeTypesActiveFilters: coffeeTypesTable.renderCoffeeTypesActiveFilters,
        setCoffeeTypesSort: coffeeTypesTable.setCoffeeTypesSort,
        updateCoffeeTypesSortIcons: coffeeTypesTable.updateCoffeeTypesSortIcons,
        getFilteredSortedCoffeeTypes: coffeeTypesTable.getFilteredSortedCoffeeTypes,
        renderCoffeeTypesTable: coffeeTypesTable.renderCoffeeTypesTable
    };
};
