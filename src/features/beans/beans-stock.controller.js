import { createBeansStockRepoModule } from './beans-stock.repo.js';

export const createBeansStockControllerModule = ({
    dataService,
    getCurrentUser,
    getBeans,
    setBeansState,
    getCoffees,
    getHasLoadedBeans,
    getHasLoadedBrews,
    getCurrentBeanCardId,
    renderBeansTable,
    openBeanCard,
    computeBeansLeft,
    getRemainingStockAfterBrew,
    autoUnpinClosedBagsIfEnabled,
    makeBeanSignature,
    showAutoArchiveToast
}) => {
    const repo = createBeansStockRepoModule({ dataService });

    const updateBeansLeftForBean = async (beanId, extraBrews = []) => {
        const currentUser = getCurrentUser();
        if (!currentUser || !beanId) return;

        const beans = getBeans();
        const bean = beans.find((b) => b.id === beanId);
        if (!bean) return;

        let combined = getCoffees();
        if (extraBrews && extraBrews.length) {
            const relevantExtraBrews = extraBrews.filter((b) => b && b.beanId === beanId);
            if (relevantExtraBrews.length) {
                combined = [...getCoffees()];
                relevantExtraBrews.forEach((extra) => {
                    if (extra.id) {
                        const existingIdx = combined.findIndex((c) => c.id === extra.id);
                        if (existingIdx !== -1) combined[existingIdx] = { ...combined[existingIdx], ...extra };
                        else combined.push(extra);
                    } else {
                        combined.push(extra);
                    }
                });
            }
        }

        const beansLeft = computeBeansLeft(bean, combined);
        if (beansLeft === null || isNaN(beansLeft)) return;
        const nowIso = new Date().toISOString();

        try {
            await repo.updateBeansLeft({ uid: currentUser.uid, beanId, beansLeft, updatedAt: nowIso });
            setBeansState(
                beans.map((b) => (b.id === beanId ? { ...b, beansLeft, updatedAt: nowIso } : b))
            );
        } catch (err) {
            console.error('Update beans left failed', err);
        }
    };

    const maybeMigrateBeansLeft = async () => {
        const currentUser = getCurrentUser();
        if (!currentUser) return;
        if (!getHasLoadedBeans() || !getHasLoadedBrews()) return;

        const key = `beansLeftMigrated_${currentUser.uid}`;
        if (localStorage.getItem(key) === 'true') return;

        const beans = getBeans();
        const coffees = getCoffees();
        const toUpdate = beans.filter((bean) => {
            const hasWeight = bean.stock !== undefined && bean.stock !== null && bean.stock !== '';
            const hasBeansLeft = bean.beansLeft !== undefined && bean.beansLeft !== null && bean.beansLeft !== '';
            return hasWeight && !hasBeansLeft;
        });

        if (!toUpdate.length) {
            localStorage.setItem(key, 'true');
            return;
        }

        const nowIso = new Date().toISOString();
        const updates = toUpdate
            .map((bean) => ({ beanId: bean.id, beansLeft: computeBeansLeft(bean, coffees) }))
            .filter((u) => u.beansLeft !== null && !isNaN(u.beansLeft));

        if (!updates.length) {
            localStorage.setItem(key, 'true');
            return;
        }

        try {
            await repo.batchUpdateBeansLeft({ uid: currentUser.uid, updates, updatedAt: nowIso });
            const updatesMap = new Map(updates.map((u) => [u.beanId, u.beansLeft]));
            setBeansState(
                beans.map((bean) => {
                    if (!updatesMap.has(bean.id)) return bean;
                    return { ...bean, beansLeft: updatesMap.get(bean.id), updatedAt: nowIso };
                })
            );
            localStorage.setItem(key, 'true');
            renderBeansTable();
            const currentBeanCardId = getCurrentBeanCardId();
            if (currentBeanCardId) openBeanCard(currentBeanCardId);
        } catch (err) {
            console.error('Beans left migration failed', err);
        }
    };

    const recalculateAllBeanStockLeft = async () => {
        const currentUser = getCurrentUser();
        if (!currentUser) return;

        const beans = getBeans();
        const coffees = getCoffees();
        const nowIso = new Date().toISOString();

        const updates = beans
            .map((bean) => ({ beanId: bean.id, beansLeft: computeBeansLeft(bean, coffees) }))
            .filter((u) => u.beansLeft !== null && !isNaN(u.beansLeft));

        if (!updates.length) return;

        try {
            await repo.batchUpdateBeansLeft({ uid: currentUser.uid, updates, updatedAt: nowIso });
            const updatesMap = new Map(updates.map((u) => [u.beanId, u.beansLeft]));
            setBeansState(
                beans.map((bean) => {
                    if (!updatesMap.has(bean.id)) return bean;
                    return { ...bean, beansLeft: updatesMap.get(bean.id), updatedAt: nowIso };
                })
            );
            renderBeansTable();
            const currentBeanCardId = getCurrentBeanCardId();
            if (currentBeanCardId) openBeanCard(currentBeanCardId);
        } catch (err) {
            console.error('Recalculate beans left failed', err);
        }
    };

    const archiveBeanIfStockDepleted = async ({ beanId, brew, existingBrewId = null }) => {
        const currentUser = getCurrentUser();
        if (!currentUser || !beanId) return;

        const beans = getBeans();
        const bean = beans.find((b) => b.id === beanId);
        if (!bean || bean.archived || bean.frozen) return;

        const remaining = getRemainingStockAfterBrew(bean, brew, existingBrewId, getCoffees());
        if (remaining === null || isNaN(remaining) || remaining > 0) return;

        const nowIso = new Date().toISOString();
        try {
            await repo.updateBeanArchive({
                uid: currentUser.uid,
                beanId,
                archived: true,
                archivedDate: nowIso,
                updatedAt: nowIso
            });
            setBeansState(
                beans.map((b) => (b.id === beanId ? { ...b, archived: true, archivedDate: nowIso, updatedAt: nowIso } : b))
            );
            await autoUnpinClosedBagsIfEnabled({
                beanIds: [beanId],
                beanSignatures: [makeBeanSignature(bean)]
            });
            showAutoArchiveToast(beanId);
        } catch (err) {
            console.error('Auto-archive failed:', err);
        }
    };

    return {
        updateBeansLeftForBean,
        maybeMigrateBeansLeft,
        recalculateAllBeanStockLeft,
        archiveBeanIfStockDepleted
    };
};
