import { withDetectedDecaf } from '../../core/coffee-decaf.js';

export const createCoffeeTypesExtractModule = ({
    getCurrentUser,
    getBeans,
    getCoffeeTypes,
    setBeansState,
    dataService
}) => {
    const { db, writeBatch, doc, collection } = dataService || {};
    if (!db || !writeBatch || !doc || !collection) {
        throw new Error('createCoffeeTypesExtractModule requires dataService { db, writeBatch, doc, collection }');
    }
    const extractCoffeeTypesFromBeans = async () => {
        const currentUser = getCurrentUser();
        const beans = getBeans();
        const coffeeTypes = getCoffeeTypes();

        if (!currentUser) {
            alert('Please sign in to extract coffees.');
            return;
        }
        if (!beans.length) {
            alert('No coffee bags found to extract.');
            return;
        }

        const normalize = (v) => (v || '').toLowerCase().trim();
        const makeKey = (obj) => [
            normalize(obj.roaster),
            normalize(obj.farmer),
            normalize(obj.processing),
            normalize(obj.origin),
            normalize(obj.roast || obj.roastType)
        ].join('|');

        const existingTypeByKey = new Map(coffeeTypes.map((ct) => [makeKey(ct), ct]));
        const newTypeByKey = new Map();
        const nowIso = new Date().toISOString();

        beans.forEach((bean) => {
            const key = makeKey(bean);
            if (existingTypeByKey.has(key) || newTypeByKey.has(key)) return;
            newTypeByKey.set(key, withDetectedDecaf({
                uid: currentUser.uid,
                roaster: bean.roaster || '',
                farmer: bean.farmer || '',
                processing: bean.processing || '',
                origin: bean.origin || '',
                rating: 0,
                tasteNotes: bean.tasteNotes || bean.notes || '',
                roast: bean.roastType || '',
                webshopUrl: bean.shopUrl || '',
                imageUrl: bean.imageURL || '',
                variety: bean.variety || '',
                createdAt: nowIso,
                updatedAt: nowIso
            }));
        });

        if (!newTypeByKey.size && !coffeeTypes.length) {
            alert('No coffees found to extract.');
            return;
        }

        try {
            const batch = writeBatch(db);
            const typeIdByKey = new Map();

            existingTypeByKey.forEach((type, key) => {
                if (type?.id) typeIdByKey.set(key, type.id);
            });

            newTypeByKey.forEach((typeData, key) => {
                const ref = doc(collection(db, 'users', currentUser.uid, 'coffeeTypes'));
                batch.set(ref, typeData);
                typeIdByKey.set(key, ref.id);
            });

            beans.forEach((bean) => {
                const key = makeKey(bean);
                const typeId = typeIdByKey.get(key);
                if (!typeId || bean.coffeeTypeId === typeId) return;
                batch.update(doc(db, 'users', currentUser.uid, 'beans', bean.id), {
                    coffeeTypeId: typeId,
                    updatedAt: nowIso
                });
            });

            await batch.commit();

            setBeansState(
                beans.map((bean) => {
                    const key = makeKey(bean);
                    const typeId = typeIdByKey.get(key);
                    return typeId ? { ...bean, coffeeTypeId: typeId } : bean;
                })
            );

            const addedCount = newTypeByKey.size;
            alert(`Saved ${addedCount} coffee${addedCount === 1 ? '' : 's'} and linked bags.`);
        } catch (error) {
            console.error(error);
            alert(`Error saving coffees: ${error.message}`);
        }
    };

    return {
        extractCoffeeTypesFromBeans
    };
};
