import { createBeansStockRepoModule } from './beans-stock.repo.js';

export const createBeansStockControllerModule = ({
    dataService,
    getCurrentUser,
    getBeans,
    setBeansState,
    getCoffees,
    dispatchCommand,
    computeBeansLeft,
    getRemainingStockAfterBrew,
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
            await dispatchCommand?.('pin.autoUnpinClosedBagsIfEnabled', { beanIds: [beanId] });
            showAutoArchiveToast(beanId);
        } catch (err) {
            console.error('Auto-archive failed:', err);
        }
    };

    return {
        updateBeansLeftForBean,
        archiveBeanIfStockDepleted
    };
};
