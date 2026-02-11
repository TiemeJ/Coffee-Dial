export const createBeansStockServiceModule = () => {
    const computeBeansLeft = (bean, brews = []) => {
        if (!bean || bean.stock === undefined || bean.stock === null || bean.stock === '') return null;
        const baseWeight = parseFloat(bean.stock);
        if (isNaN(baseWeight)) return null;
        const totalIn = brews
            .filter((c) => c.beanId === bean.id)
            .reduce((sum, c) => {
                const weight = parseFloat(c.weight);
                return sum + (isNaN(weight) ? 0 : weight);
            }, 0);
        return baseWeight - totalIn;
    };

    const getBeanCalculatedStock = (bean, brews = []) => {
        if (!bean) return null;
        if (bean.beansLeft !== undefined && bean.beansLeft !== null && bean.beansLeft !== '') {
            const left = parseFloat(bean.beansLeft);
            return isNaN(left) ? null : left;
        }
        return computeBeansLeft(bean, brews);
    };

    const getRemainingStockAfterBrew = (bean, brew, existingBrewId = null, coffees = []) => {
        if (!bean || bean.stock === undefined || bean.stock === null || bean.stock === '') return null;
        const stockBase = parseFloat(bean.stock);
        if (isNaN(stockBase)) return null;

        let brewsForBean = coffees.filter((c) => c.beanId === bean.id);
        if (brew) {
            const existing = existingBrewId ? coffees.find((c) => c.id === existingBrewId) : null;
            const createdAt = brew.createdAt || existing?.createdAt || new Date().toISOString();
            const brewForCalc = { ...existing, ...brew, createdAt, beanId: bean.id };

            if (existingBrewId) {
                const hadExisting = brewsForBean.some((c) => c.id === existingBrewId);
                brewsForBean = hadExisting
                    ? brewsForBean.map((c) => (c.id === existingBrewId ? brewForCalc : c))
                    : [...brewsForBean, brewForCalc];
            } else {
                brewsForBean = [...brewsForBean, brewForCalc];
            }
        }

        const totalIn = brewsForBean.reduce((sum, c) => {
            const weight = parseFloat(c.weight);
            return sum + (isNaN(weight) ? 0 : weight);
        }, 0);
        return stockBase - totalIn;
    };

    const getFirstBrewDateForBean = (beanId, brew = null, existingBrewId = null, coffees = []) => {
        if (!beanId) return null;

        let brewsForBean = coffees.filter((c) => c.beanId === beanId);
        if (brew) {
            const existing = existingBrewId ? coffees.find((c) => c.id === existingBrewId) : null;
            const createdAt = brew.createdAt || existing?.createdAt || new Date().toISOString();
            const brewForDate = { ...existing, ...brew, beanId, createdAt };

            if (existingBrewId) {
                const hadExisting = brewsForBean.some((c) => c.id === existingBrewId);
                brewsForBean = hadExisting
                    ? brewsForBean.map((c) => (c.id === existingBrewId ? brewForDate : c))
                    : [...brewsForBean, brewForDate];
            } else {
                brewsForBean = [...brewsForBean, brewForDate];
            }
        }

        const brewTimes = brewsForBean
            .map((c) => {
                const time = new Date(c.createdAt || '').getTime();
                return Number.isFinite(time) ? time : null;
            })
            .filter((time) => time !== null);

        if (!brewTimes.length) return null;
        return new Date(Math.min(...brewTimes)).toISOString();
    };

    return {
        computeBeansLeft,
        getBeanCalculatedStock,
        getRemainingStockAfterBrew,
        getFirstBrewDateForBean
    };
};
