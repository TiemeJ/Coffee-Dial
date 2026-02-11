export const createPinRepoModule = ({ db, doc, writeBatch }) => {
    const saveCustomOrder = async ({ uid, updates }) => {
        if (!uid || !Array.isArray(updates) || updates.length === 0) return;
        const batch = writeBatch(db);
        updates.forEach((u) => {
            if (!u?.id || !Number.isFinite(u?.customOrder)) return;
            batch.update(doc(db, 'users', uid, 'coffees', u.id), { customOrder: u.customOrder });
        });
        await batch.commit();
    };

    return { saveCustomOrder };
};
