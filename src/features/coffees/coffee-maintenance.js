export const createCoffeeMaintenanceModule = ({
    getCurrentUser,
    getCoffeeTypes,
    setCoffeeTypesState,
    getBeans,
    getCoffees,
    dataService,
    renderCoffeeTypesTable,
    renderPinnedTiles,
    dispatchCommand
}) => {
    const { db, writeBatch, doc } = dataService || {};
    if (!db || !writeBatch || !doc) {
        throw new Error('createCoffeeMaintenanceModule requires dataService { db, writeBatch, doc }');
    }

    // TODO(admin-script): replace with scripts/backfill-coffee-type-decaf-from-scan.mjs and remove this UI migration after rollout.
    const backfillCoffeeTypeDecafFromScan = async () => {
        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('backfillCoffeeTypeDecafBtn');
        const originalText = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Scanning...';
        }

        try {
            const coffeeTypes = getCoffeeTypes();
            const beans = getBeans();
            const brews = getCoffees();
            const nowIso = new Date().toISOString();

            const beanIdsByCoffeeTypeId = new Map();
            beans.forEach((bean) => {
                if (!bean?.coffeeTypeId) return;
                if (!beanIdsByCoffeeTypeId.has(bean.coffeeTypeId)) beanIdsByCoffeeTypeId.set(bean.coffeeTypeId, []);
                beanIdsByCoffeeTypeId.get(bean.coffeeTypeId).push(bean.id);
            });

            const brewsByBeanId = new Map();
            brews.forEach((brew) => {
                if (!brew?.beanId) return;
                if (!brewsByBeanId.has(brew.beanId)) brewsByBeanId.set(brew.beanId, []);
                brewsByBeanId.get(brew.beanId).push(brew);
            });

            const containsDecaf = (value) => (value || '').toString().toLowerCase().includes('decaf');
            const updatesByCoffeeTypeId = new Map();

            coffeeTypes.forEach((coffeeType) => {
                if (coffeeType?.decaf) return;

                const typeFields = [
                    coffeeType?.roaster,
                    coffeeType?.farmer,
                    coffeeType?.origin,
                    coffeeType?.variety,
                    coffeeType?.processing,
                    coffeeType?.roast,
                    coffeeType?.roastType,
                    coffeeType?.tasteNotes,
                    coffeeType?.name
                ];

                const linkedBeanIds = beanIdsByCoffeeTypeId.get(coffeeType.id) || [];
                const linkedBeans = linkedBeanIds
                    .map((beanId) => beans.find((bean) => bean.id === beanId))
                    .filter(Boolean);

                const beanFields = linkedBeans.flatMap((bean) => [
                    bean?.roaster,
                    bean?.farmer,
                    bean?.origin,
                    bean?.variety,
                    bean?.processing,
                    bean?.roastType
                ]);

                const brewFields = linkedBeanIds
                    .flatMap((beanId) => brewsByBeanId.get(beanId) || [])
                    .flatMap((brew) => [
                        brew?.roaster,
                        brew?.farmer,
                        brew?.origin,
                        brew?.variety,
                        brew?.processing,
                        brew?.roastType,
                        brew?.notes,
                        brew?.name
                    ]);

                const isDecaf = [...typeFields, ...beanFields, ...brewFields].some(containsDecaf);
                if (!isDecaf) return;

                updatesByCoffeeTypeId.set(coffeeType.id, {
                    decaf: true,
                    updatedAt: nowIso
                });
            });

            if (!updatesByCoffeeTypeId.size) {
                alert('No coffee types needed decaf backfill.');
                return;
            }

            const batch = writeBatch(db);
            updatesByCoffeeTypeId.forEach((payload, coffeeTypeId) => {
                batch.update(doc(db, 'users', user.uid, 'coffeeTypes', coffeeTypeId), payload);
            });
            await batch.commit();

            setCoffeeTypesState(
                coffeeTypes.map((coffeeType) => {
                    const patch = updatesByCoffeeTypeId.get(coffeeType.id);
                    return patch ? { ...coffeeType, ...patch } : coffeeType;
                })
            );

            renderCoffeeTypesTable?.();
            renderPinnedTiles?.();
            await dispatchCommand?.('brews.refreshTable', { source: 'coffees.backfillCoffeeTypeDecafFromScan' });

            alert(`Decaf backfill complete for ${updatesByCoffeeTypeId.size} coffee type${updatesByCoffeeTypeId.size === 1 ? '' : 's'}.`);
        } catch (err) {
            console.error('Error backfilling coffee decaf:', err);
            alert(`Decaf backfill failed: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    };

    return {
        backfillCoffeeTypeDecafFromScan
    };
};
