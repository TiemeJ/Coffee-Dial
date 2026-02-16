export const createBrewsRepo = ({ dataService, getCurrentUser }) => {
    const { db, doc, collection, addDoc, updateDoc, deleteDoc } = dataService || {};
    if (!db || !doc || !collection || !addDoc || !updateDoc || !deleteDoc) {
        throw new Error('createBrewsRepo requires dataService { db, doc, collection, addDoc, updateDoc, deleteDoc }');
    }
    if (typeof getCurrentUser !== 'function') {
        throw new Error('createBrewsRepo requires getCurrentUser');
    }

    const requireUid = () => {
        const uid = getCurrentUser()?.uid;
        if (!uid) throw new Error('User not signed in');
        return uid;
    };

    const addCoffee = async (payload) => {
        const uid = requireUid();
        const ref = await addDoc(collection(db, 'users', uid, 'coffees'), payload);
        return ref.id;
    };

    const updateCoffee = async (id, payload) => {
        const uid = requireUid();
        await updateDoc(doc(db, 'users', uid, 'coffees', id), payload);
    };

    const deleteCoffee = async (id) => {
        const uid = requireUid();
        await deleteDoc(doc(db, 'users', uid, 'coffees', id));
    };

    const addBean = async (payload) => {
        const uid = requireUid();
        const ref = await addDoc(collection(db, 'users', uid, 'beans'), payload);
        return ref.id;
    };

    const updateBean = async (id, payload) => {
        const uid = requireUid();
        await updateDoc(doc(db, 'users', uid, 'beans', id), payload);
    };

    const addCoffeeType = async (payload) => {
        const uid = requireUid();
        const ref = await addDoc(collection(db, 'users', uid, 'coffeeTypes'), payload);
        return ref.id;
    };

    return {
        addBean,
        addCoffee,
        addCoffeeType,
        deleteCoffee,
        updateBean,
        updateCoffee
    };
};
