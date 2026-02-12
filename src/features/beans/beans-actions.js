export const createBeansActionsModule = ({
    getCurrentUser,
    getCurrentBeanCardId,
    getBeans,
    setBeansState,
    computeBeansLeft,
    db,
    doc,
    updateDoc,
    addDoc,
    collection,
    deleteDoc,
    autoUnpinClosedBagsIfEnabled,
    autoPinOpenBagsIfEnabled,
    makeBeanSignature,
    openBeanCard,
    enterBeanEditMode,
    openAppConfirm
}) => {
    const saveBeanStock = async (beanId, amount) => {
        const user = getCurrentUser();
        if (!user) return;
        try {
            const stockVal = amount === '' ? null : parseFloat(amount);
            const bean = getBeans().find((b) => b.id === beanId);
            const beansLeft = stockVal === null ? null : computeBeansLeft({ ...bean, stock: stockVal });
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanId), {
                stock: stockVal,
                beansLeft,
                updatedAt: new Date().toISOString()
            });
            if (stockVal !== null && stockVal <= 0) {
                await autoUnpinClosedBagsIfEnabled({
                    beanIds: [beanId],
                    beanSignatures: [makeBeanSignature(bean)]
                });
            }
            await autoPinOpenBagsIfEnabled();
        } catch (err) {
            console.error('Error saving stock:', err);
            alert('Failed to save stock.');
        }
    };

    const toggleBeanArchive = async (beanId, isArchived) => {
        const user = getCurrentUser();
        if (!user) return;
        const targetBean = getBeans().find((b) => b.id === beanId);
        try {
            const nowIso = new Date().toISOString();
            const nextArchived = !isArchived;
            const nextArchivedDate = nextArchived ? nowIso : (targetBean?.archivedDate || null);
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanId), {
                archived: nextArchived,
                archivedDate: nextArchivedDate,
                updatedAt: nowIso
            });
            let updatedBean = null;
            setBeansState(
                getBeans().map((bean) => {
                    if (bean.id !== beanId) return bean;
                    updatedBean = { ...bean, archived: nextArchived, archivedDate: nextArchivedDate };
                    return updatedBean;
                })
            );
            if (updatedBean && getCurrentBeanCardId() === beanId) openBeanCard(beanId);
            if (!isArchived) {
                await autoUnpinClosedBagsIfEnabled({
                    beanIds: [beanId],
                    beanSignatures: [makeBeanSignature(targetBean)]
                });
            }
            if (isArchived) {
                await autoPinOpenBagsIfEnabled();
            }
        } catch (err) {
            console.error('Error updating archive state:', err);
            alert('Failed to update archive state.');
        }
    };

    const toggleBeanFrozen = async (beanId, isFrozen) => {
        const user = getCurrentUser();
        if (!user) return;
        const targetBean = getBeans().find((b) => b.id === beanId);
        try {
            const nowIso = new Date().toISOString();
            const nextFrozen = !isFrozen;
            const nextFrozenDate = nextFrozen ? nowIso : (targetBean?.frozenDate || null);
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanId), {
                frozen: nextFrozen,
                frozenDate: nextFrozenDate,
                updatedAt: nowIso
            });
            let updatedBean = null;
            setBeansState(
                getBeans().map((bean) => {
                    if (bean.id !== beanId) return bean;
                    updatedBean = { ...bean, frozen: nextFrozen, frozenDate: nextFrozenDate };
                    return updatedBean;
                })
            );
            if (updatedBean && getCurrentBeanCardId() === beanId) openBeanCard(beanId);
            if (!isFrozen) {
                await autoUnpinClosedBagsIfEnabled({
                    beanIds: [beanId],
                    beanSignatures: [makeBeanSignature(targetBean)]
                });
            }
            if (isFrozen) {
                await autoPinOpenBagsIfEnabled();
            }
        } catch (err) {
            console.error('Error updating frozen state:', err);
            alert('Failed to update frozen state.');
        }
    };

    const openNewBag = async (beanId, options = {}) => {
        const user = getCurrentUser();
        if (!user) return;
        const sourceBean = getBeans().find((b) => b.id === beanId);
        if (!sourceBean) return;

        const { openCard = false, editAfter = false } = options;

        const newBeanData = { ...sourceBean };
        delete newBeanData.id;
        delete newBeanData.stock;
        delete newBeanData.beansLeft;
        delete newBeanData.openedDate;
        delete newBeanData.frozenDate;
        delete newBeanData.roastDate;
        delete newBeanData.archivedDate;
        delete newBeanData.frozen;
        delete newBeanData.archived;
        delete newBeanData.calculatedStock;

        newBeanData.stock = 250;
        newBeanData.beansLeft = 250;
        newBeanData.frozen = false;
        newBeanData.archived = false;
        newBeanData.frozenDate = null;
        newBeanData.archivedDate = null;
        newBeanData.openedDate = null;
        newBeanData.createdAt = new Date().toISOString();
        newBeanData.updatedAt = newBeanData.createdAt;

        try {
            const refObj = await addDoc(collection(db, 'users', user.uid, 'beans'), newBeanData);
            const newBean = { id: refObj.id, ...newBeanData };
            setBeansState([...getBeans(), newBean]);
            await autoPinOpenBagsIfEnabled();
            if (openCard) {
                openBeanCard(refObj.id);
                if (editAfter) enterBeanEditMode();
            }
            return refObj.id;
        } catch (err) {
            console.error('Error opening new bag:', err);
            alert('Failed to open new bag.');
        }
    };

    const deleteBean = async (beanId) => {
        const user = getCurrentUser();
        if (!user) return;

        const shouldDelete = await openAppConfirm({
            title: 'Delete bean?',
            message: 'This will not delete brews, but it will unlink them from this bean.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!shouldDelete) return;

        const targetBean = getBeans().find((b) => b.id === beanId);
        try {
            await autoUnpinClosedBagsIfEnabled({
                beanIds: [beanId],
                beanSignatures: [makeBeanSignature(targetBean)]
            });
            await deleteDoc(doc(db, 'users', user.uid, 'beans', beanId));
        } catch (e) {
            alert(e.message);
        }
    };

    return {
        saveBeanStock,
        toggleBeanArchive,
        toggleBeanFrozen,
        openNewBag,
        deleteBean
    };
};
