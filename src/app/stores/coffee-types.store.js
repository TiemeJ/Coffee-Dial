import { createBaseStore } from './base-store.js';

export const createCoffeeTypesStore = ({ items = [] } = {}) => {
    const store = createBaseStore({ items: Array.isArray(items) ? items : [] });

    return {
        getItems: () => store.getState().items,
        setItems: (value) => store.patchState({ items: Array.isArray(value) ? value : [] }),
        updateItems: (updater) => {
            const current = store.getState().items;
            const next = typeof updater === 'function' ? updater(current) : current;
            return store.patchState({ items: Array.isArray(next) ? next : current });
        },
        getState: store.getState
    };
};
