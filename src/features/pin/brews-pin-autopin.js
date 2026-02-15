export const createBrewsPinAutopinModule = ({
    getCurrentUser,
    getBeans,
    getCoffees,
    getBeanCalculatedStock,
    getPinnedBrewsPreferences,
    db,
    doc,
    writeBatch
}) => {
    const makeBeanSignature = (data) => {
        const normalize = (value) => (value || '').toString().toLowerCase().trim();
        const parts = [
            data?.roaster,
            data?.farmer,
            data?.origin,
            data?.processing,
            data?.variety,
            data?.roastType || data?.roast
        ].map(normalize);
        if (parts.every((part) => part === '')) return null;
        return parts.join('|');
    };

    const isPinOpenBagsEnabled = () => !!getPinnedBrewsPreferences().pinOpenBags;
    const isPinOpenBagsBestOnlyEnabled = () => !!getPinnedBrewsPreferences().pinOpenBagsBestOnly;
    const isBestPerMethodDrinkEnabled = () => getPinnedBrewsPreferences().pinBestPerMethodDrink !== false;

    const getBrewSortScore = (brew) => {
        const ratingRaw = brew?.rating;
        const rating = Number.isFinite(ratingRaw) ? ratingRaw : parseInt(ratingRaw, 10) || 0;
        const dateVal = brew?.createdAt || brew?.updatedAt || 0;
        const time = Number.isFinite(dateVal) ? dateVal : Date.parse(dateVal) || 0;
        return { rating, time };
    };

    const getBrewMethodKey = (brew) => {
        const raw = (brew?.method || '').toString().trim();
        return raw || 'Unknown';
    };

    const getBrewMethodDrinkKey = (brew) => {
        const method = getBrewMethodKey(brew);
        const drinkRaw = (brew?.drink || '').toString().trim();
        const drink = drinkRaw || 'Unknown';
        return `${method}||${drink}`;
    };

    const getBestSelectionKey = (brew) => (isBestPerMethodDrinkEnabled() ? getBrewMethodDrinkKey(brew) : getBrewMethodKey(brew));

    const getOpenBeansForAutoPin = () => {
        return getBeans().filter((bean) => {
            const remaining = getBeanCalculatedStock(bean);
            return !bean.archived && !bean.frozen && remaining !== null && remaining > 0;
        });
    };

    const pinBrewsFromOpenBags = async () => {
        const user = getCurrentUser();
        if (!user) return;

        const openBeans = getOpenBeansForAutoPin();
        if (!openBeans.length) return;

        const openBeanIds = new Set(openBeans.map((bean) => bean.id));
        const brewsToPin = getCoffees().filter((brew) => !brew.isActive && !!(brew.beanId && openBeanIds.has(brew.beanId)));
        if (!brewsToPin.length) return;

        const batch = writeBatch(db);
        brewsToPin.forEach((brew) => {
            batch.update(doc(db, 'users', user.uid, 'coffees', brew.id), { isActive: true });
        });

        try {
            await batch.commit();
        } catch (err) {
            console.error('Pin open bags failed', err);
        }
    };

    const pinBestBrewsForBean = async ({ beanId, brewId = null, brewData = null } = {}) => {
        const user = getCurrentUser();
        if (!user || !beanId) return;

        const bean = getBeans().find((b) => b.id === beanId);
        if (!bean) return;
        const remaining = getBeanCalculatedStock(bean);
        if (bean.archived || bean.frozen || remaining === null || remaining <= 0) return;

        let brewsForBean = getCoffees().filter((brew) => brew.beanId === beanId);
        if (brewData && (brewData.beanId || beanId) === beanId) {
            const normalized = { ...brewData, id: brewId || brewData.id, beanId };
            if (normalized.id) {
                const existingIndex = brewsForBean.findIndex((brew) => brew.id === normalized.id);
                if (existingIndex >= 0) {
                    brewsForBean[existingIndex] = { ...brewsForBean[existingIndex], ...normalized };
                } else {
                    brewsForBean = [...brewsForBean, normalized];
                }
            }
        }

        if (!brewsForBean.length) return;

        const bestByMethod = new Map();
        brewsForBean.forEach((brew) => {
            if (!brew?.id) return;
            const methodKey = getBestSelectionKey(brew);
            const { rating, time } = getBrewSortScore(brew);
            const current = bestByMethod.get(methodKey);
            if (!current || rating > current.rating || (rating === current.rating && time > current.time)) {
                bestByMethod.set(methodKey, { brew, rating, time });
            }
        });

        const bestIds = new Set(Array.from(bestByMethod.values()).map((entry) => entry.brew.id));
        const batch = writeBatch(db);
        let updates = 0;

        brewsForBean.forEach((brew) => {
            if (!brew?.id) return;
            const shouldBeActive = bestIds.has(brew.id);
            if (!!brew.isActive !== shouldBeActive) {
                batch.update(doc(db, 'users', user.uid, 'coffees', brew.id), { isActive: shouldBeActive });
                updates++;
            }
        });

        if (!updates) return;
        try {
            await batch.commit();
        } catch (err) {
            console.error('Pin best brews failed', err);
        }
    };

    const pinBestBrewsForAllOpenBags = async () => {
        const user = getCurrentUser();
        if (!user) return;

        const openBeans = getOpenBeansForAutoPin();
        const bestIds = new Set();

        openBeans.forEach((bean) => {
            const brewsForBean = getCoffees().filter((brew) => brew.beanId === bean.id);
            if (!brewsForBean.length) return;
            const bestByMethod = new Map();

            brewsForBean.forEach((brew) => {
                if (!brew?.id) return;
                const methodKey = getBestSelectionKey(brew);
                const { rating, time } = getBrewSortScore(brew);
                const current = bestByMethod.get(methodKey);
                if (!current || rating > current.rating || (rating === current.rating && time > current.time)) {
                    bestByMethod.set(methodKey, { brew, rating, time });
                }
            });

            bestByMethod.forEach((entry) => bestIds.add(entry.brew.id));
        });

        const batch = writeBatch(db);
        let updates = 0;

        getCoffees().forEach((brew) => {
            if (!brew?.id) return;
            const shouldBeActive = bestIds.has(brew.id);
            if (!!brew.isActive !== shouldBeActive) {
                batch.update(doc(db, 'users', user.uid, 'coffees', brew.id), { isActive: shouldBeActive });
                updates++;
            }
        });

        if (!updates) return;
        try {
            await batch.commit();
        } catch (err) {
            console.error('Pin best brews for open bags failed', err);
        }
    };

    const autoPinOpenBagsIfEnabled = async ({ beanId = null, brewId = null, brewData = null } = {}) => {
        if (!isPinOpenBagsEnabled()) return;
        if (isPinOpenBagsBestOnlyEnabled() && beanId) {
            await pinBestBrewsForBean({ beanId, brewId, brewData });
            return;
        }
        if (isPinOpenBagsBestOnlyEnabled()) {
            await pinBestBrewsForAllOpenBags();
            return;
        }
        await pinBrewsFromOpenBags();
    };

    const unpinBrewsForBeans = async ({ beanIds = [], beanSignatures = [] } = {}) => {
        const user = getCurrentUser();
        if (!user) return;

        const idSet = new Set(beanIds.filter(Boolean));
        if (!idSet.size) return;

        const brewsToUnpin = getCoffees().filter((brew) => brew.isActive && !!(brew.beanId && idSet.has(brew.beanId)));
        if (!brewsToUnpin.length) return;

        const batch = writeBatch(db);
        brewsToUnpin.forEach((brew) => {
            batch.update(doc(db, 'users', user.uid, 'coffees', brew.id), { isActive: false });
        });

        try {
            await batch.commit();
        } catch (err) {
            console.error('Unpin closed bags failed', err);
        }
    };

    const autoUnpinClosedBagsIfEnabled = async ({ beanIds = [], beanSignatures = [] } = {}) => {
        if (!isPinOpenBagsEnabled()) return;
        await unpinBrewsForBeans({ beanIds, beanSignatures });
    };

    return {
        makeBeanSignature,
        pinBrewsFromOpenBags,
        pinBestBrewsForBean,
        pinBestBrewsForAllOpenBags,
        autoPinOpenBagsIfEnabled,
        unpinBrewsForBeans,
        autoUnpinClosedBagsIfEnabled
    };
};
