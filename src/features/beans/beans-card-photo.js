export const createBeansCardPhotoModule = ({
    getCurrentUser,
    getCurrentBeanCardId,
    getBeans,
    setBeansState,
    storage,
    ref,
    deleteObject,
    db,
    doc,
    updateDoc,
    imageCompression,
    uploadBytes,
    getDownloadURL,
    openBeanCard
}) => {
    const triggerBeanPhoto = (e) => {
        if (e) e.stopPropagation();
        if (!getCurrentBeanCardId()) return;
        document.getElementById('beanPhotoInput')?.click();
    };

    const openBeanPhoto = (e) => {
        if (e) e.stopPropagation();
        const bean = getBeans().find((b) => b.id === getCurrentBeanCardId());
        if (bean && bean.imageURL) window.open(bean.imageURL, '_blank');
    };

    const removeBeanPhoto = async (e) => {
        if (e) e.stopPropagation();
        const user = getCurrentUser();
        const beanCardId = getCurrentBeanCardId();
        if (!user || !beanCardId) return;
        const bean = getBeans().find((b) => b.id === beanCardId);
        if (!bean || !bean.imageURL) return;

        try {
            const photoRef = ref(storage, bean.imageURL);
            await deleteObject(photoRef);
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanCardId), {
                imageURL: null,
                updatedAt: new Date().toISOString()
            });
            setBeansState(getBeans().map((b) => (b.id === beanCardId ? { ...b, imageURL: null } : b)));
            openBeanCard(beanCardId);
        } catch (err) {
            console.error('Remove bean photo failed:', err);
            alert('Failed to remove image.');
        }
    };

    const handleBeanPhoto = async (event) => {
        const file = event.target.files?.[0];
        const user = getCurrentUser();
        const beanCardId = getCurrentBeanCardId();
        if (!file || !user || !beanCardId) return;

        const btn = document.getElementById('beanCardImageSection');
        const originalClasses = btn?.className;

        try {
            if (btn) btn.classList.add('ai-loading-pulse');
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            const timestamp = Date.now();
            const storageRef = ref(storage, `photos/${user.uid}/bean_${beanCardId}_${timestamp}`);
            const snapshot = await uploadBytes(storageRef, compressedFile);
            const downloadURL = await getDownloadURL(snapshot.ref);

            await updateDoc(doc(db, 'users', user.uid, 'beans', beanCardId), {
                imageURL: downloadURL,
                updatedAt: new Date().toISOString()
            });

            setBeansState(getBeans().map((b) => (b.id === beanCardId ? { ...b, imageURL: downloadURL } : b)));
            openBeanCard(beanCardId);
        } catch (err) {
            console.error('Bean photo upload failed:', err);
            alert('Failed to upload image.');
        } finally {
            if (btn && typeof originalClasses === 'string') btn.className = originalClasses;
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
