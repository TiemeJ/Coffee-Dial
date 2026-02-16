import { createBaseStore } from './base-store.js';

export const createRuntimeStore = (initialState = {}) => {
    const store = createBaseStore(initialState);

    return {
        get: (key) => store.getState()[key],
        set: (key, value) => store.patchState({ [key]: value }),
        patch: (patch = {}) => store.patchState(patch),
        getState: store.getState
    };
};
