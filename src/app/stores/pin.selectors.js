const resolveLinkedBeanId = ({ brew, beans = [] }) => {
    if (!brew) return null;
    if (brew.beanId) return brew.beanId;
    const clean = (value) => (value || '').toString().toLowerCase().trim();
    const linkedBean = beans.find(
        (bean) =>
            clean(bean.roaster) === clean(brew.roaster) &&
            clean(bean.farmer) === clean(brew.farmer) &&
            clean(bean.origin) === clean(brew.origin) &&
            clean(bean.processing) === clean(brew.processing) &&
            clean(bean.variety) === clean(brew.variety) &&
            clean(bean.roastType) === clean(brew.roastType)
    );
    return linkedBean?.id || null;
};

const sortByPinnedOrder = (a, b) => {
    const orderDelta = (a.customOrder || 0) - (b.customOrder || 0);
    if (orderDelta !== 0) return orderDelta;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
};

export const selectVisiblePinnedBrewOrderIds = ({
    coffees = [],
    beans = [],
    organizeByBeans = false
} = {}) => {
    const activeBrewsSorted = [...(Array.isArray(coffees) ? coffees : [])]
        .filter((brew) => brew?.isActive)
        .sort(sortByPinnedOrder);

    if (!organizeByBeans) {
        return activeBrewsSorted.map((brew) => brew.id);
    }

    const grouped = new Map();
    activeBrewsSorted.forEach((brew) => {
        const beanId = resolveLinkedBeanId({ brew, beans });
        const beanKey = beanId || `no-bean-${brew.id}`;
        if (!grouped.has(beanKey)) grouped.set(beanKey, []);
        grouped.get(beanKey).push(brew.id);
    });

    return Array.from(grouped.values()).flat();
};
