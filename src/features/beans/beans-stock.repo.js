export const createBeansStockRepoModule = ({ db, doc, updateDoc, writeBatch }) => {
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

    const updateBeanArchive = async ({ uid, beanId, archived, updatedAt }) => {
        await updateDoc(doc(db, 'users', uid, 'beans', beanId), {
            archived,
            updatedAt
        });
    };

    return {
        updateBeansLeft,
        batchUpdateBeansLeft,
        updateBeanArchive
    };
};
