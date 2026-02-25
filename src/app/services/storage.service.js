export const createStorageService = ({
    getStorageInstance,
    loadStorageApi
}) => {
    if (typeof getStorageInstance !== 'function' || typeof loadStorageApi !== 'function') {
        throw new Error('createStorageService requires getStorageInstance and loadStorageApi');
    }

    const STORAGE_REF_MARKER = '__coffeeDialStorageRef';
    const storage = {};
    let storageCorePromise = null;

    const resolveStorageCore = async () => {
        if (!storageCorePromise) {
            storageCorePromise = Promise.all([
                getStorageInstance(),
                loadStorageApi()
            ]).then(([storageInstance, storageApi]) => ({
                storageInstance,
                refFn: storageApi.ref,
                uploadBytesFn: storageApi.uploadBytes,
                getDownloadURLFn: storageApi.getDownloadURL,
                deleteObjectFn: storageApi.deleteObject
            }));
        }
        return storageCorePromise;
    };

    const ref = (_storage, pathOrUrl) => ({
        [STORAGE_REF_MARKER]: true,
        pathOrUrl
    });

    const resolveRef = async (targetRef) => {
        const { storageInstance, refFn } = await resolveStorageCore();
        if (targetRef && targetRef[STORAGE_REF_MARKER]) {
            return refFn(storageInstance, targetRef.pathOrUrl);
        }
        return targetRef;
    };

    const uploadBytes = async (targetRef, data, metadata) => {
        const { uploadBytesFn } = await resolveStorageCore();
        const realRef = await resolveRef(targetRef);
        return uploadBytesFn(realRef, data, metadata);
    };

    const getDownloadURL = async (targetRef) => {
        const { getDownloadURLFn } = await resolveStorageCore();
        const realRef = await resolveRef(targetRef);
        return getDownloadURLFn(realRef);
    };

    const deleteObject = async (targetRef) => {
        const { deleteObjectFn } = await resolveStorageCore();
        const realRef = await resolveRef(targetRef);
        return deleteObjectFn(realRef);
    };

    return {
        storage,
        ref,
        uploadBytes,
        getDownloadURL,
        deleteObject
    };
};
