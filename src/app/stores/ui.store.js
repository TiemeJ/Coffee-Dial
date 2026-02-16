import { createBaseStore } from './base-store.js';

export const createUiStore = ({
    pinnedBrewsPreferences,
    currentSort,
    activeFilters,
    displayedBrewsCount
} = {}) => {
    const store = createBaseStore({
        pinnedBrewsPreferences,
        currentSort,
        activeFilters,
        displayedBrewsCount
    });

    return {
        getPinnedBrewsPreferences: () => store.getState().pinnedBrewsPreferences,
        setPinnedBrewsPreferences: (value) => store.patchState({ pinnedBrewsPreferences: value }),
        getCurrentSort: () => store.getState().currentSort,
        setCurrentSort: (value) => store.patchState({ currentSort: value }),
        getActiveFilters: () => store.getState().activeFilters,
        setActiveFilters: (value) => store.patchState({ activeFilters: value }),
        getDisplayedBrewsCount: () => store.getState().displayedBrewsCount,
        setDisplayedBrewsCount: (value) => store.patchState({ displayedBrewsCount: value }),
        getState: store.getState
    };
};
