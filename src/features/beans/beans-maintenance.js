export const createBeansMaintenanceModule = ({
    getCurrentUser,
    dataService,
    dispatchCommand
}) => {
    const { db, doc, updateDoc } = dataService || {};
    if (!db || !doc || !updateDoc) {
        throw new Error('createBeansMaintenanceModule requires dataService { db, doc, updateDoc }');
    }
    const saveBeanRoastDate = async (beanId, dateValue) => {
        const user = getCurrentUser();
        if (!user) return;
        try {
            const roastDateVal = dateValue ? new Date(dateValue).toISOString() : null;
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanId), {
                roastDate: roastDateVal,
                updatedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error saving roast date:', err);
            alert('Failed to save roast date.');
        }
    };

    const saveBeanOpenedDate = async (beanId, dateValue) => {
        const user = getCurrentUser();
        if (!user) return;
        try {
            const openedDateVal = dateValue ? new Date(dateValue).toISOString() : null;
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanId), {
                openedDate: openedDateVal,
                updatedAt: new Date().toISOString()
            });
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
        } catch (err) {
            console.error('Error saving opened date:', err);
            alert('Failed to save opened date.');
        }
    };

    const saveBeanFrozenDate = async (beanId, dateValue) => {
        const user = getCurrentUser();
        if (!user) return;
        try {
            const frozenDateVal = dateValue ? new Date(dateValue).toISOString() : null;
            await updateDoc(doc(db, 'users', user.uid, 'beans', beanId), {
                frozenDate: frozenDateVal,
                updatedAt: new Date().toISOString()
            });
        } catch (err) {
            console.error('Error saving frozen date:', err);
            alert('Failed to save frozen date.');
        }
    };

    return {
        saveBeanRoastDate,
        saveBeanOpenedDate,
        saveBeanFrozenDate
    };
};
