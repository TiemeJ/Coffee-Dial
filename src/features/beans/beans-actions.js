import { createBeansRepoModule } from './beans.repo.js';

export const createBeansActionsModule = ({
    getCurrentUser,
    getCurrentBeanCardId,
    getBeans,
    setBeansState,
    renderBeansTable,
    computeBeansLeft,
    dataService,
    dispatchCommand,
    openAppConfirm
}) => {
    const repo = createBeansRepoModule({ dataService });
    const saveBeanStock = async (beanId, amount) => {
        const user = getCurrentUser();
        if (!user) return;
        try {
            const stockVal = amount === '' ? null : parseFloat(amount);
            const bean = getBeans().find((b) => b.id === beanId);
            const beansLeft = stockVal === null ? null : computeBeansLeft({ ...bean, stock: stockVal });
            await repo.updateBean({ uid: user.uid, beanId, patch: {
                stock: stockVal,
                beansLeft,
                updatedAt: new Date().toISOString()
            } });
            if (stockVal !== null && stockVal <= 0) {
                await dispatchCommand?.('pin.autoUnpinClosedBagsIfEnabled', { beanIds: [beanId] });
            }
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
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
            await repo.updateBean({ uid: user.uid, beanId, patch: {
                archived: nextArchived,
                archivedDate: nextArchivedDate,
                updatedAt: nowIso
            } });
            let updatedBean = null;
            setBeansState(
                getBeans().map((bean) => {
                    if (bean.id !== beanId) return bean;
                    updatedBean = { ...bean, archived: nextArchived, archivedDate: nextArchivedDate };
                    return updatedBean;
                })
            );
            if (updatedBean && getCurrentBeanCardId() === beanId) {
                dispatchCommand?.('beans.openCard', { beanId, event: null, keepNavigationOrder: false });
            }
            if (!isArchived) {
                await dispatchCommand?.('pin.autoUnpinClosedBagsIfEnabled', { beanIds: [beanId] });
            }
            if (isArchived) {
                await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
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
            await repo.updateBean({ uid: user.uid, beanId, patch: {
                frozen: nextFrozen,
                frozenDate: nextFrozenDate,
                updatedAt: nowIso
            } });
            let updatedBean = null;
            setBeansState(
                getBeans().map((bean) => {
                    if (bean.id !== beanId) return bean;
                    updatedBean = { ...bean, frozen: nextFrozen, frozenDate: nextFrozenDate };
                    return updatedBean;
                })
            );
            if (updatedBean && getCurrentBeanCardId() === beanId) {
                dispatchCommand?.('beans.openCard', { beanId, event: null, keepNavigationOrder: false });
            }
            if (!isFrozen) {
                await dispatchCommand?.('pin.autoUnpinClosedBagsIfEnabled', { beanIds: [beanId] });
            }
            if (isFrozen) {
                await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
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
            const refObj = await repo.createBean({ uid: user.uid, data: newBeanData });
            const newBean = { id: refObj.id, ...newBeanData };
            setBeansState([...getBeans(), newBean]);
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
            if (openCard) {
                if (editAfter) dispatchCommand?.('beans.openCardForEdit', { beanId: refObj.id, event: null });
                else dispatchCommand?.('beans.openCard', { beanId: refObj.id, event: null, keepNavigationOrder: false });
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

        try {
            await dispatchCommand?.('pin.autoUnpinClosedBagsIfEnabled', { beanIds: [beanId] });
            await repo.removeBean({ uid: user.uid, beanId });
        } catch (e) {
            alert(e.message);
        }
    };

    const createBeanFromModal = async () => {
        const user = getCurrentUser();
        if (!user) {
            alert('Please sign in.');
            return;
        }
        const nowIso = new Date().toISOString();
        const beanData = {
            roaster: '',
            farmer: '',
            origin: '',
            processing: '',
            variety: '',
            roastType: '',
            shopUrl: '',
            archived: false,
            frozen: false,
            stock: 250,
            beansLeft: 250,
            openedDate: null,
            frozenDate: null,
            archivedDate: null,
            roastDate: null,
            createdAt: nowIso,
            updatedAt: nowIso
        };

        try {
            const refObj = await repo.createBean({ uid: user.uid, data: beanData });
            const newBean = { id: refObj.id, ...beanData };
            setBeansState([...getBeans(), newBean]);
            renderBeansTable?.();
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
            dispatchCommand?.('beans.openCardForEdit', { beanId: refObj.id, event: null });
        } catch (err) {
            console.error('Error creating bean:', err);
            alert('Failed to create bean.');
        }
    };

    return {
        createBeanFromModal,
        saveBeanStock,
        toggleBeanArchive,
        toggleBeanFrozen,
        openNewBag,
        deleteBean
    };
};
