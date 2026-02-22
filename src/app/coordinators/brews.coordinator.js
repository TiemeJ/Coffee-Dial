import { createBrewsFormModule } from '../../features/brews/brews-form.js';
import { createBrewsActionsModule } from '../../features/brews/brews-actions.js';
import { createBrewsTablePrefModule } from '../../features/brews/brews-table-pref.js';
import { createBrewsTableModule } from '../../features/brews/brews-table.js';

export const createBrewsTableCoordinator = ({ tableDeps, tablePrefDeps }) => {
    const {
        clearSearch,
        getFilterLabel,
        updateBrewSortIcons,
        sortBy,
        openFilterMenu,
        applyFilter,
        clearAllFilters,
        renderActiveFilters,
        toggleQuickFilter,
        setBrewsTableStatePresetApi,
        openQuickFilterValues,
        applyFilterFromQuick,
        getFilteredCoffees,
        getTempBadge,
        refreshTableData,
        renderTable,
        loadMoreBrews
    } = createBrewsTableModule(tableDeps);

    const {
        columnPreferencesKey,
        loadColumnPreferencesFromStorage,
        saveColumnPreferencesToStorage,
        openBrewsTablePrefs,
        hideBrewsTablePrefsModal
    } = createBrewsTablePrefModule({
        ...tablePrefDeps,
        renderTable: (...args) => renderTable(...args)
    });

    return {
        clearSearch,
        getFilterLabel,
        updateBrewSortIcons,
        sortBy,
        openFilterMenu,
        applyFilter,
        clearAllFilters,
        renderActiveFilters,
        toggleQuickFilter,
        setBrewsTableStatePresetApi,
        openQuickFilterValues,
        applyFilterFromQuick,
        getFilteredCoffees,
        getTempBadge,
        refreshTableData,
        renderTable,
        loadMoreBrews,
        columnPreferencesKey,
        loadColumnPreferencesFromStorage,
        saveColumnPreferencesToStorage,
        openBrewsTablePrefs,
        hideBrewsTablePrefsModal
    };
};

export const createBrewsCoordinator = ({
    formDeps,
    actionsDeps,
    refreshQuickEditGearFieldVisibility,
    setRefreshBrewGearSelectors
}) => {
    const {
        populateForm,
        refreshBrewGearField,
        setBrewGearScope,
        getSelectedBrewGearIds,
        setSelectedBrewGearIds
    } = createBrewsFormModule(formDeps);

    const {
        handleFormSubmit,
        discardForm,
        toggleActive,
        editCoffee,
        fastDuplicateFromCard,
        fastRepeatCoffee,
        duplicateFromCard,
        duplicateCoffee,
        cloneBrew,
        deleteCoffee,
        resetFormState,
        refreshManualPinningVisibility
    } = createBrewsActionsModule({
        ...actionsDeps,
        populateForm: (...args) => populateForm(...args),
        setBrewGearScope: (...args) => setBrewGearScope(...args),
        getSelectedBrewGearIds: () => getSelectedBrewGearIds(),
        setSelectedBrewGearIds: (...args) => setSelectedBrewGearIds(...args)
    });

    refreshManualPinningVisibility();

    const refreshBrewGearSelectors = () => {
        refreshBrewGearField();
        refreshQuickEditGearFieldVisibility?.();
    };
    setRefreshBrewGearSelectors?.(refreshBrewGearSelectors);
    refreshBrewGearSelectors();

    return {
        populateForm,
        refreshBrewGearField,
        setBrewGearScope,
        getSelectedBrewGearIds,
        setSelectedBrewGearIds,
        handleFormSubmit,
        discardForm,
        toggleActive,
        editCoffee,
        fastDuplicateFromCard,
        fastRepeatCoffee,
        duplicateFromCard,
        duplicateCoffee,
        cloneBrew,
        deleteCoffee,
        resetFormState,
        refreshManualPinningVisibility
    };
};
