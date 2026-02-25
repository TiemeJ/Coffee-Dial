export const createFunctionsService = ({
    getFunctionsInstance,
    loadFunctionsApi
}) => {
    if (typeof getFunctionsInstance !== 'function' || typeof loadFunctionsApi !== 'function') {
        throw new Error('createFunctionsService requires getFunctionsInstance and loadFunctionsApi');
    }

    let callableFactoryPromise = null;
    const getCallableFactory = async () => {
        if (!callableFactoryPromise) {
            callableFactoryPromise = Promise.all([
                getFunctionsInstance(),
                loadFunctionsApi()
            ]).then(([functionsInstance, functionsApi]) => ({
                functionsInstance,
                httpsCallable: functionsApi.httpsCallable
            }));
        }
        return callableFactoryPromise;
    };

    // Keep API shape compatible with existing callers.
    const functions = {};
    const httpsCallable = (_functions, name) => {
        return async (payload) => {
            const { functionsInstance, httpsCallable: realHttpsCallable } = await getCallableFactory();
            const callable = realHttpsCallable(functionsInstance, name);
            return callable(payload);
        };
    };

    return {
        functions,
        httpsCallable
    };
};
