export const createBeansMaintenanceModule = ({
    getCurrentUser,
    getBeans,
    setBeansState,
    getCoffees,
    db,
    doc,
    updateDoc,
    writeBatch,
    collection,
    autoPinOpenBagsIfEnabled
}) => {
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
            await autoPinOpenBagsIfEnabled();
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

    const syncLegacyBeans = async () => {
        const user = getCurrentUser();
        if (!user) return;

        const btn = document.querySelector('#beansModal button i.fa-sync-alt')?.parentNode;
        const originalText = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Scanning...';
        }

        try {
            const batchLimit = 450;
            const batches = [];
            let currentBatch = writeBatch(db);
            let opCount = 0;

            const uniqueMap = new Map();
            const beans = getBeans();
            const coffees = getCoffees();

            coffees.forEach((c) => {
                const clean = (s) => (s || '').toLowerCase().trim();
                const key = `${clean(c.roaster)}|${clean(c.farmer)}|${clean(c.origin)}|${clean(c.processing)}|${clean(c.variety)}|${clean(c.roastType)}`;

                if (!uniqueMap.has(key)) {
                    const existingBean = beans.find(
                        (b) =>
                            clean(b.roaster) === clean(c.roaster) &&
                            clean(b.farmer) === clean(c.farmer) &&
                            clean(b.origin) === clean(c.origin) &&
                            clean(b.processing) === clean(c.processing) &&
                            clean(b.variety) === clean(c.variety) &&
                            clean(b.roastType) === clean(c.roastType)
                    );

                    const beanData = {};
                    if (c.roaster) beanData.roaster = c.roaster;
                    if (c.farmer) beanData.farmer = c.farmer;
                    if (c.origin || c.beanType) beanData.origin = c.origin || c.beanType;
                    if (c.variety) beanData.variety = c.variety;
                    if (c.processing) beanData.processing = c.processing;
                    if (c.roastType) beanData.roastType = c.roastType;

                    uniqueMap.set(key, {
                        data: beanData,
                        id: existingBean ? existingBean.id : null,
                        isNew: !existingBean
                    });
                }
            });

            for (const [, val] of uniqueMap.entries()) {
                if (val.isNew && (val.data.roaster || val.data.origin)) {
                    const newRef = doc(collection(db, 'users', user.uid, 'beans'));
                    val.id = newRef.id;
                    currentBatch.set(newRef, {
                        ...val.data,
                        createdAt: new Date().toISOString(),
                        archived: false,
                        archivedDate: null,
                        frozen: false
                    });
                    opCount++;
                    if (opCount >= batchLimit) {
                        batches.push(currentBatch);
                        currentBatch = writeBatch(db);
                        opCount = 0;
                    }
                }
            }

            coffees.forEach((c) => {
                if (!c.beanId) {
                    const clean = (s) => (s || '').toLowerCase().trim();
                    const key = `${clean(c.roaster)}|${clean(c.farmer)}|${clean(c.origin)}|${clean(c.processing)}|${clean(c.variety)}|${clean(c.roastType)}`;
                    const mapEntry = uniqueMap.get(key);

                    if (mapEntry && mapEntry.id) {
                        const brewRef = doc(db, 'users', user.uid, 'coffees', c.id);
                        currentBatch.update(brewRef, { beanId: mapEntry.id });
                        opCount++;
                        if (opCount >= batchLimit) {
                            batches.push(currentBatch);
                            currentBatch = writeBatch(db);
                            opCount = 0;
                        }
                    }
                }
            });

            batches.push(currentBatch);
            await Promise.all(batches.map((b) => b.commit()));
            alert('Legacy scan complete! Brews linked to Beans.');
        } catch (err) {
            console.error(err);
            alert(`Scan failed: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    };

    const backfillBeanDatesFromBrews = async () => {
        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('backfillBeanDatesBtn');
        const originalText = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Backfilling...';
        }

        try {
            const beans = getBeans();
            const coffees = getCoffees();
            const nowIso = new Date().toISOString();
            const parseMs = (value) => {
                if (!value) return NaN;
                const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
                return dateObj instanceof Date ? dateObj.getTime() : NaN;
            };

            const brewsByBeanId = new Map();
            coffees.forEach((brew) => {
                if (!brew?.beanId) return;
                const createdMs = parseMs(brew.createdAt);
                if (!Number.isFinite(createdMs)) return;
                if (!brewsByBeanId.has(brew.beanId)) brewsByBeanId.set(brew.beanId, []);
                brewsByBeanId.get(brew.beanId).push(createdMs);
            });

            const updatesByBeanId = new Map();
            beans.forEach((bean) => {
                const brewTimes = brewsByBeanId.get(bean.id);
                if (!brewTimes || !brewTimes.length) return;

                const needsOpenedDate = !bean.openedDate;
                const needsArchivedDate = !!bean.archived && !bean.archivedDate;
                if (!needsOpenedDate && !needsArchivedDate) return;

                const sortedTimes = [...brewTimes].sort((a, b) => a - b);
                const payload = { updatedAt: nowIso };
                if (needsOpenedDate) payload.openedDate = new Date(sortedTimes[0]).toISOString();
                if (needsArchivedDate) payload.archivedDate = new Date(sortedTimes[sortedTimes.length - 1]).toISOString();
                updatesByBeanId.set(bean.id, payload);
            });

            if (!updatesByBeanId.size) {
                alert('No beans needed date backfill.');
                return;
            }

            const batch = writeBatch(db);
            updatesByBeanId.forEach((payload, beanId) => {
                batch.update(doc(db, 'users', user.uid, 'beans', beanId), payload);
            });
            await batch.commit();

            setBeansState(
                beans.map((bean) => {
                    const patch = updatesByBeanId.get(bean.id);
                    return patch ? { ...bean, ...patch } : bean;
                })
            );

            await autoPinOpenBagsIfEnabled();
            alert(`Backfilled dates for ${updatesByBeanId.size} bean${updatesByBeanId.size === 1 ? '' : 's'}.`);
        } catch (err) {
            console.error('Error backfilling bean dates:', err);
            alert(`Date backfill failed: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = originalText;
            }
        }
    };

    return {
        saveBeanRoastDate,
        saveBeanOpenedDate,
        saveBeanFrozenDate,
        syncLegacyBeans,
        backfillBeanDatesFromBrews
    };
};
