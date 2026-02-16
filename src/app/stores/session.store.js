import { createBaseStore } from './base-store.js';

export const createSessionStore = ({ currentUser = null, currentView = 'mine' } = {}) => {
    const store = createBaseStore({ currentUser, currentView });

    return {
        getCurrentUser: () => store.getState().currentUser,
        setCurrentUser: (value) => store.patchState({ currentUser: value }),
        getCurrentView: () => store.getState().currentView,
        setCurrentView: (value) => store.patchState({ currentView: value }),
        getState: store.getState
    };
};
