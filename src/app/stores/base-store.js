export const createBaseStore = (initialState = {}) => {
    let state = { ...initialState };

    const getState = () => state;

    const setState = (nextState = {}) => {
        state = { ...nextState };
        return state;
    };

    const patchState = (patch = {}) => {
        state = { ...state, ...patch };
        return state;
    };

    return {
        getState,
        patchState,
        setState
    };
};
