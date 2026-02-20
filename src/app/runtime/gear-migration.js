export const createGearMigrationModule = ({
    dataService,
    getCurrentUser,
    getGasItems,
    getCoffees,
    setCoffees,
    refreshBrewGearSelectors
}) => {
    const { db, collection, doc, setDoc, writeBatch } = dataService || {};
    if (!db || !collection || !doc || !setDoc || !writeBatch) {
        throw new Error('createGearMigrationModule requires dataService { db, collection, doc, setDoc, writeBatch }');
    }

    const normalizeName = (value) =>
        (value || '')
            .toString()
            .trim()
            .replace(/\s+/g, ' ')
            .toLowerCase();

    const denormalizeName = (value) => (value || '').toString().trim().replace(/\s+/g, ' ');

    // TODO(admin-script): replace with scripts/migrate-grinder-to-gear.mjs and remove this UI migration after rollout.
    const migrateGrinderToGear = async () => {
        const currentUser = getCurrentUser();
        if (!currentUser) return alert('Please sign in.');

        const btn = document.getElementById('migrateGrinderToGearBtn');
        const originalHtml = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Migrating...';
        }

        try {
            const gasItems = getGasItems();
            const coffees = getCoffees();
            const grinderIdByName = new Map();
            const discoveredGrinderNameByNorm = new Map();

            gasItems.forEach((item) => {
                if (!item) return;
                if ((item.type || '').toString().toLowerCase() !== 'grinder') return;
                const norm = normalizeName(item.name);
                if (!norm || grinderIdByName.has(norm)) return;
                grinderIdByName.set(norm, item.id);
            });

            coffees.forEach((brew) => {
                const norm = normalizeName(brew?.grinder);
                if (!norm || discoveredGrinderNameByNorm.has(norm)) return;
                discoveredGrinderNameByNorm.set(norm, denormalizeName(brew.grinder));
            });

            const missingNorms = [...discoveredGrinderNameByNorm.keys()].filter((norm) => !grinderIdByName.has(norm));
            const nowIso = new Date().toISOString();
            const newGearItems = [];

            for (const norm of missingNorms) {
                const name = discoveredGrinderNameByNorm.get(norm);
                if (!name) continue;
                const newRef = doc(collection(db, 'users', currentUser.uid, 'gear'));
                const gearData = {
                    uid: currentUser.uid,
                    name,
                    price: null,
                    type: 'Grinder',
                    methods: [],
                    imageUrl: '',
                    purchasedDate: nowIso,
                    archived: false,
                    createdAt: nowIso,
                    updatedAt: nowIso
                };
                newGearItems.push({ id: newRef.id, ...gearData });
                grinderIdByName.set(norm, newRef.id);
                await setDoc(newRef, gearData);
            }

            const batchLimit = 400;
            let currentBatch = writeBatch(db);
            let opCount = 0;
            let updatedBrewsCount = 0;
            const commitJobs = [];
            const nextCoffees = [...coffees];

            coffees.forEach((brew) => {
                const norm = normalizeName(brew?.grinder);
                const grinderGearId = norm ? grinderIdByName.get(norm) : null;
                if (!grinderGearId) return;

                const currentGearIds = Array.isArray(brew.gearIds) ? brew.gearIds.filter(Boolean) : [];
                if (currentGearIds.includes(grinderGearId)) return;

                const nextGearIds = [...new Set([...currentGearIds, grinderGearId])];
                const brewRef = doc(db, 'users', currentUser.uid, 'coffees', brew.id);
                currentBatch.update(brewRef, {
                    gearIds: nextGearIds,
                    updatedAt: new Date().toISOString()
                });
                opCount++;
                updatedBrewsCount++;
                const idx = nextCoffees.findIndex((c) => c.id === brew.id);
                if (idx !== -1) nextCoffees[idx] = { ...nextCoffees[idx], gearIds: nextGearIds };

                if (opCount >= batchLimit) {
                    commitJobs.push(currentBatch.commit());
                    currentBatch = writeBatch(db);
                    opCount = 0;
                }
            });

            if (opCount > 0) {
                commitJobs.push(currentBatch.commit());
            }
            if (commitJobs.length) await Promise.all(commitJobs);
            setCoffees(nextCoffees);

            if (newGearItems.length > 0) {
                refreshBrewGearSelectors();
            }

            alert(`Migration complete. Added ${newGearItems.length} grinder gear item(s) and linked ${updatedBrewsCount} brew(s).`);
        } catch (err) {
            console.error('Migrate grinder to gear failed:', err);
            alert(`Migration failed: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    // TODO(admin-script): replace with scripts/fill-legacy-grinder-from-gear.mjs and remove this UI migration after rollout.
    const fillLegacyGrinderFromGear = async () => {
        const currentUser = getCurrentUser();
        if (!currentUser) return alert('Please sign in.');

        const btn = document.getElementById('fillLegacyGrinderFromGearBtn');
        const originalHtml = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Filling...';
        }

        try {
            const gasItems = getGasItems();
            const coffees = getCoffees();
            const grinderNameByGearId = new Map(
                gasItems
                    .filter((item) => (item?.type || '').toString().toLowerCase() === 'grinder')
                    .map((item) => [item.id, (item.name || '').toString().trim()])
            );

            const updates = [];
            coffees.forEach((brew) => {
                const gearIds = Array.isArray(brew?.gearIds) ? brew.gearIds : [];
                const firstAssociatedGrinderName = gearIds
                    .map((gearId) => grinderNameByGearId.get(gearId))
                    .find((name) => !!name);
                if (!firstAssociatedGrinderName) return;
                if ((brew.grinder || '') === firstAssociatedGrinderName) return;
                updates.push({
                    brewId: brew.id,
                    grinder: firstAssociatedGrinderName,
                    updatedAt: new Date().toISOString()
                });
            });

            if (!updates.length) {
                alert('No brews needed legacy grinder updates.');
                return;
            }

            const batchLimit = 400;
            let currentBatch = writeBatch(db);
            let opCount = 0;
            const commitJobs = [];

            for (const update of updates) {
                const brewRef = doc(db, 'users', currentUser.uid, 'coffees', update.brewId);
                currentBatch.update(brewRef, {
                    grinder: update.grinder,
                    updatedAt: update.updatedAt
                });
                opCount += 1;
                if (opCount >= batchLimit) {
                    commitJobs.push(currentBatch.commit());
                    currentBatch = writeBatch(db);
                    opCount = 0;
                }
            }

            if (opCount > 0) commitJobs.push(currentBatch.commit());
            if (commitJobs.length) await Promise.all(commitJobs);

            const updateByBrewId = new Map(updates.map((entry) => [entry.brewId, entry]));
            setCoffees(
                coffees.map((brew) => {
                    const patch = updateByBrewId.get(brew.id);
                    return patch ? { ...brew, grinder: patch.grinder, updatedAt: patch.updatedAt } : brew;
                })
            );

            alert(`Legacy grinder field updated for ${updates.length} brew(s).`);
        } catch (err) {
            console.error('Fill legacy grinder from gear failed:', err);
            alert(`Legacy grinder fill failed: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalHtml;
            }
        }
    };

    return {
        fillLegacyGrinderFromGear,
        migrateGrinderToGear
    };
};
