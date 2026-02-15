import { createGasTableModule } from '../../features/gas/gas-table.js';
import { createGasCardModule } from '../../features/gas/gas-card.js';

export const createGasCoordinator = ({
    db,
    storage,
    doc,
    collection,
    updateDoc,
    deleteDoc,
    writeBatch,
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject,
    imageCompression,
    addDoc,
    getCurrentUser,
    getCurrentView,
    getCurrentGasId,
    setCurrentGasId,
    getGasItems,
    setGasItemsState,
    getGasSearch,
    setGasSearchState,
    getGasFilters,
    setGasFiltersState,
    getGasSortKey,
    setGasSortKeyState,
    getGasSortDir,
    setGasSortDirState,
    getCoffees,
    setCoffeesState,
    openAppConfirm,
    getRefreshBrewGearSelectors
}) => {
    let openGasCard = () => {};
    let enterGasEditMode = () => {};
    let renderGasTable = () => {};
    let getFilteredSortedGasItems = () => [];

    const createGasItemFromModal = async () => {
        const user = getCurrentUser();
        if (!user) return alert('Please sign in.');
        const nowIso = new Date().toISOString();
        const gasData = {
            uid: user.uid,
            name: '',
            price: null,
            type: 'Other',
            methods: [],
            imageUrl: '',
            purchasedDate: nowIso,
            archived: false,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        try {
            const gasRef = await addDoc(collection(db, 'users', user.uid, 'gear'), gasData);
            const newGas = { id: gasRef.id, ...gasData };
            if (!getGasItems().find((item) => item.id === newGas.id)) {
                setGasItemsState([...getGasItems(), newGas]);
            }
            getRefreshBrewGearSelectors()?.();
            openGasCard(newGas.id);
            enterGasEditMode();
        } catch (err) {
            console.error('Error creating gear item:', err);
            alert('Failed to create gear item.');
        }
    };

    const gasTable = createGasTableModule({
        getGasItems,
        getCurrentView,
        getGasSearch,
        setGasSearchState,
        getGasFilters,
        setGasFiltersState,
        getGasSortKey,
        setGasSortKeyState,
        getGasSortDir,
        setGasSortDirState,
        openGasCard: (...args) => openGasCard(...args)
    });
    renderGasTable = gasTable.renderGasTable;
    getFilteredSortedGasItems = gasTable.getFilteredSortedGasItems;

    const gasCard = createGasCardModule({
        getCurrentUser,
        getCurrentView,
        getCurrentGasId,
        setCurrentGasId,
        getGasItems,
        setGasItemsState,
        getCoffees,
        setCoffeesState,
        getFilteredSortedGasItems: (...args) => getFilteredSortedGasItems(...args),
        db,
        storage,
        doc,
        collection,
        updateDoc,
        deleteDoc,
        writeBatch,
        ref,
        uploadBytes,
        getDownloadURL,
        deleteObject,
        imageCompression,
        openAppConfirm,
        renderGasTable: (...args) => renderGasTable(...args)
    });
    openGasCard = gasCard.openGasCard;
    enterGasEditMode = gasCard.enterGasEditMode;

    return {
        createGasItemFromModal,
        openGasList: gasTable.openGasList,
        closeGasList: gasTable.closeGasList,
        setGasSearch: gasTable.setGasSearch,
        clearGasSearch: gasTable.clearGasSearch,
        toggleGasQuickFilter: gasTable.toggleGasQuickFilter,
        openGasQuickFilterValues: gasTable.openGasQuickFilterValues,
        applyGasFilterFromQuick: gasTable.applyGasFilterFromQuick,
        clearGasFilters: gasTable.clearGasFilters,
        renderGasActiveFilters: gasTable.renderGasActiveFilters,
        setGasSort: gasTable.setGasSort,
        updateGasSortIcons: gasTable.updateGasSortIcons,
        getFilteredSortedGasItems: gasTable.getFilteredSortedGasItems,
        renderGasTable: gasTable.renderGasTable,
        updateGasCardNav: gasCard.updateGasCardNav,
        openGasCard: gasCard.openGasCard,
        closeGasCard: gasCard.closeGasCard,
        enterGasEditMode: gasCard.enterGasEditMode,
        cancelGasEditMode: gasCard.cancelGasEditMode,
        saveGasEdits: gasCard.saveGasEdits,
        toggleGasArchive: gasCard.toggleGasArchive,
        deleteGasItem: gasCard.deleteGasItem,
        navigateGasCard: gasCard.navigateGasCard,
        openGasFromTableEdit: gasCard.openGasFromTableEdit,
        openGasMergeFromTable: gasCard.openGasMergeFromTable,
        toggleGasArchiveFromTable: gasCard.toggleGasArchiveFromTable,
        deleteGasFromTable: gasCard.deleteGasFromTable,
        triggerGasPhoto: gasCard.triggerGasPhoto,
        openGasPhoto: gasCard.openGasPhoto,
        removeGasPhoto: gasCard.removeGasPhoto,
        handleGasPhoto: gasCard.handleGasPhoto,
        closeGasCardMenu: gasCard.closeGasCardMenu,
        openGasMergeModal: gasCard.openGasMergeModal,
        closeGasMergeModal: gasCard.closeGasMergeModal,
        mergeGasItem: gasCard.mergeGasItem,
        openGasBulkAddModal: gasCard.openGasBulkAddModal,
        closeGasBulkAddModal: gasCard.closeGasBulkAddModal,
        openGasBulkAddFromTable: gasCard.openGasBulkAddFromTable,
        bulkAddGearToBrews: gasCard.bulkAddGearToBrews
    };
};
