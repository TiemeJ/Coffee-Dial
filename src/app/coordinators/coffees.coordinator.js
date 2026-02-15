import { createCoffeeTypeCardModule } from '../../features/coffees/coffee-type-card.js';
import { createCoffeeTypesTableModule } from '../../features/coffees/coffee-types-table.js';

export const createCoffeesCoordinator = ({
    db,
    storage,
    doc,
    updateDoc,
    writeBatch,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    addDoc,
    collection,
    getCurrentUser,
    getCurrentView,
    getCurrentCoffeeTypeId,
    setCurrentCoffeeTypeId,
    getCoffeeTypes,
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
    renderTable,
    renderActiveFilters,
    clearSearch,
    clearAllFilters,
    getBrewsPerPage,
    setDisplayedBrewsCount,
    setActiveCoffeeTypeFilter,
    openBeans,
    renderBeansTable,
    clearBeansSearch,
    clearBeansFilters,
    applyBeansFilterFromQuick,
    openBeanCard,
    enterBeanEditMode,
    autoPinOpenBagsIfEnabled
}) => {
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
        const typeData = {
            uid: user.uid,
            roaster: '',
            farmer: '',
            origin: '',
            processing: '',
            variety: '',
            roast: '',
            rating: 0,
            tasteNotes: '',
            webshopUrl: '',
            imageUrl: '',
            createdAt: nowIso,
            updatedAt: nowIso
        };

        try {
            const typeRef = await addDoc(collection(db, 'users', user.uid, 'coffeeTypes'), typeData);
            const newType = { id: typeRef.id, ...typeData };
            if (!getCoffeeTypes().find((ct) => ct.id === newType.id)) setCoffeeTypesState([...getCoffeeTypes(), newType]);
            openCoffeeTypeCard(newType.id);
            enterCoffeeTypeEditMode();
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
            const newBeanRef = await addDoc(collection(db, 'users', user.uid, 'beans'), newBeanData);
            const newBean = { id: newBeanRef.id, ...newBeanData };
            setBeansState([...getBeans(), newBean]);
            renderBeansTable();
            await autoPinOpenBagsIfEnabled();
            openBeanCard(newBeanRef.id);
            enterBeanEditMode();
            closeCoffeeTypeCard(null);
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
        openBeans();
        clearBeansSearch();
        clearBeansFilters();
        applyBeansFilterFromQuick('coffeeType', typeId);
    };

    const showBrewsForCoffeeType = () => {
        const typeId = getCurrentCoffeeTypeId();
        if (!typeId) return;
        closeCoffeeTypeCard(null);
        closeCoffeeTypes();
        clearSearch();
        clearAllFilters();
        setActiveCoffeeTypeFilter(typeId);
        setDisplayedBrewsCount(getBrewsPerPage());
        renderTable();
        renderActiveFilters();
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
        getCurrentUser,
        getCurrentView,
        getCurrentCoffeeTypeId,
        setCurrentCoffeeTypeId,
        getCoffeeTypes,
        setCoffeeTypesState,
        getBeans,
        setBeansState,
        db,
        storage,
        doc,
        updateDoc,
        writeBatch,
        ref,
        uploadBytes,
        getDownloadURL,
        deleteObject,
        openAppConfirm,
        getStarDisplay,
        renderCoffeeTypesTable: () => renderCoffeeTypesTable(),
        updateCoffeeTypeSelectors,
        renderPinnedTiles,
        renderTable,
        openCoffeeTypeShopUrl,
        showBeansForCoffeeType,
        showBrewsForCoffeeType,
        openNewBagForCoffeeType,
        updateCoffeeTypeCardNav
    });
    openCoffeeTypeCard = coffeeTypeCard.openCoffeeTypeCard;
    closeCoffeeTypeCard = coffeeTypeCard.closeCoffeeTypeCard;
    const enterCoffeeTypeEditMode = coffeeTypeCard.enterCoffeeTypeEditMode;

    const coffeeTypesTable = createCoffeeTypesTableModule({
        getCoffeeTypes,
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
        openCoffeeTypeCard
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
        showBeansForCoffeeTypeFromTable: coffeeTypeCard.showBeansForCoffeeTypeFromTable,
        showBrewsForCoffeeTypeFromTable: coffeeTypeCard.showBrewsForCoffeeTypeFromTable,
        openNewBagForCoffeeTypeFromTable: coffeeTypeCard.openNewBagForCoffeeTypeFromTable,
        openCoffeeTypeFromTableEdit: coffeeTypeCard.openCoffeeTypeFromTableEdit,
        deleteCoffeeTypeFromTable: coffeeTypeCard.deleteCoffeeTypeFromTable,
        deleteCoffeeType: coffeeTypeCard.deleteCoffeeType,
        triggerCoffeeTypePhoto: coffeeTypeCard.triggerCoffeeTypePhoto,
        openCoffeeTypePhoto: coffeeTypeCard.openCoffeeTypePhoto,
        removeCoffeeTypePhoto: coffeeTypeCard.removeCoffeeTypePhoto,
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
