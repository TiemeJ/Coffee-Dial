export const createBeansRepoModule = ({ dataService } = {}) => {
    const { db, doc, updateDoc, addDoc, collection, deleteDoc } = dataService || {};
    if (!db || !doc || !updateDoc || !addDoc || !collection || !deleteDoc) {
        throw new Error('createBeansRepoModule requires dataService { db, doc, updateDoc, addDoc, collection, deleteDoc }');
    }

    const updateBean = ({ uid, beanId, patch }) =>
        updateDoc(doc(db, 'users', uid, 'beans', beanId), patch);

    const createBean = ({ uid, data }) =>
        addDoc(collection(db, 'users', uid, 'beans'), data);

    const removeBean = ({ uid, beanId }) =>
        deleteDoc(doc(db, 'users', uid, 'beans', beanId));

    return {
        createBean,
        removeBean,
        updateBean
    };
};

