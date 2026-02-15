export const createBeansStockRepoModule = ({ dataService }) => {
    const { db, doc, updateDoc, writeBatch } = dataService || {};
    if (!db || !doc || !updateDoc || !writeBatch) {
        throw new Error('createBeansStockRepoModule requires dataService { db, doc, updateDoc, writeBatch }');
    }
    const updateBeansLeft = async ({ uid, beanId, beansLeft, updatedAt }) => {
        await updateDoc(doc(db, 'users', uid, 'beans', beanId), {
            beansLeft,
            updatedAt
        });
    };

    const batchUpdateBeansLeft = async ({ uid, updates, updatedAt }) => {
        const batch = writeBatch(db);
        updates.forEach(({ beanId, beansLeft }) => {
            batch.update(doc(db, 'users', uid, 'beans', beanId), {
                beansLeft,
                updatedAt
            });
        });
        await batch.commit();
    };

    const updateBeanArchive = async ({ uid, beanId, archived, archivedDate, updatedAt }) => {
        const payload = { archived, updatedAt };
        if (archivedDate !== undefined) payload.archivedDate = archivedDate;
        await updateDoc(doc(db, 'users', uid, 'beans', beanId), payload);
    };

    return {
        updateBeansLeft,
        batchUpdateBeansLeft,
        updateBeanArchive
    };
};
