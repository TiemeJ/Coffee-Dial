export const createCoffeesRepoModule = ({ dataService } = {}) => {
    const { db, addDoc, collection } = dataService || {};
    if (!db || !addDoc || !collection) {
        throw new Error('createCoffeesRepoModule requires dataService { db, addDoc, collection }');
    }

    const createCoffeeType = ({ uid, data }) =>
        addDoc(collection(db, 'users', uid, 'coffeeTypes'), data);

    const createBean = ({ uid, data }) =>
        addDoc(collection(db, 'users', uid, 'beans'), data);

    return {
        createBean,
        createCoffeeType
    };
};

