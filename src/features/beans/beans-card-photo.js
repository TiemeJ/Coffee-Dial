export const createBeansCardPhotoModule = ({
    getCurrentUser,
    getCurrentView,
    getCurrentBeanCardId,
    getBeans,
    setBeansState,
    dataService,
    storageService,
    imageCompression,
    dispatchCommand,
    openLightbox
}) => {
    const { db, doc, updateDoc } = dataService || {};
    const { storage, ref, uploadBytes, getDownloadURL, deleteObject } = storageService || {};
    if (!db || !doc || !updateDoc) {
        throw new Error('createBeansCardPhotoModule requires dataService { db, doc, updateDoc }');
    }
    if (!storage || !ref || !uploadBytes || !getDownloadURL || !deleteObject) {
        throw new Error('createBeansCardPhotoModule requires storageService { storage, ref, uploadBytes, getDownloadURL, deleteObject }');
    }
    const getCurrentBean = () => getBeans().find((bean) => bean.id === getCurrentBeanCardId());

    const triggerBeanPhoto = (event) => {
        if (event) event.stopPropagation();
        if (getCurrentView() !== 'mine') return;
        if (!getCurrentBeanCardId()) return;
        document.getElementById('beanPhotoInput')?.click();
    };

    const openBeanPhoto = (event) => {
        if (event) event.stopPropagation();
        const bean = getCurrentBean();
        const url = bean?.imageURL || bean?.imageUrl;
        if (!url) return;
        if (typeof openLightbox === 'function') {
            openLightbox({
                items: [{ url, alt: 'Bean photo' }],
                startIndex: 0
            });
            return;
        }
        window.open(url, '_blank');
    };

    const removeBeanPhoto = async (event) => {
        if (event) event.stopPropagation();
        if (getCurrentView() !== 'mine') return;

        const user = getCurrentUser();
        const beanId = getCurrentBeanCardId();
        const bean = getCurrentBean();
        const url = bean?.imageURL || bean?.imageUrl;
        if (!user || !beanId || !url) return;

        try {
            await deleteObject(ref(storage, url));
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanId), {
                imageURL: null,
                imageUrl: null,
                updatedAt: new Date().toISOString()
            });
            setBeansState(
                getBeans().map((entry) =>
                    entry.id === beanId ? { ...entry, imageURL: null, imageUrl: null } : entry
                )
            );
            dispatchCommand?.('beans.openCard', { beanId, event: null, keepNavigationOrder: false });
        } catch (err) {
            console.error('Remove bean image failed:', err);
            alert('Failed to remove image.');
        }
    };

    const handleBeanPhoto = async (event) => {
        if (getCurrentView() !== 'mine') {
            event.target.value = '';
            return;
        }

        const file = event.target.files?.[0];
        const user = getCurrentUser();
        const beanId = getCurrentBeanCardId();
        if (!file || !user || !beanId) return;

        const targetEl = document.getElementById('beanCardBeanImageSection') || document.getElementById('beanCardView');
        const originalClasses = targetEl?.className;

        try {
            if (targetEl) targetEl.classList.add('ai-loading-pulse');
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            const timestamp = Date.now();
            const storageRef = ref(storage, `photos/${user.uid}/bean_${beanId}_${timestamp}`);
            const snapshot = await uploadBytes(storageRef, compressedFile);
            const downloadURL = await getDownloadURL(snapshot.ref);
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanId), {
                imageURL: downloadURL,
                imageUrl: downloadURL,
                updatedAt: new Date().toISOString()
            });
            setBeansState(
                getBeans().map((entry) =>
                    entry.id === beanId ? { ...entry, imageURL: downloadURL, imageUrl: downloadURL } : entry
                )
            );
            dispatchCommand?.('beans.openCard', { beanId, event: null, keepNavigationOrder: false });
        } catch (err) {
            console.error('Bean image upload failed:', err);
            alert('Failed to upload image.');
        } finally {
            if (targetEl && originalClasses) targetEl.className = originalClasses;
            event.target.value = '';
        }
    };

    return {
        triggerBeanPhoto,
        openBeanPhoto,
        removeBeanPhoto,
        handleBeanPhoto
    };
};
