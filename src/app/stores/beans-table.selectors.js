export const DEFAULT_BEANS_FILTERS = { coffeeType: null, decaf: null };

export const createDefaultBeansFilters = () => ({ ...DEFAULT_BEANS_FILTERS });

const normalizeText = (value) => (value || '').toString().toLowerCase().trim();

export const selectBeansCoffeeTypeValues = (coffeeTypes = []) => {
    return coffeeTypes.map((type) => ({
        id: type.id,
        display: `${type.roaster || 'Unknown'}${type.farmer ? ' - ' + type.farmer : ''}`
    }));
};

export const selectFilteredBeans = ({
    beans = [],
    searchTerm = '',
    coffeeTypeFilter = null,
    decafFilter = null,
    getBeanCoffeeTypeDisplay
}) => {
    const normalizedSearch = normalizeText(searchTerm);
    const bySearch = !normalizedSearch
        ? [...beans]
        : beans.filter((bean) => {
            const coffeeDisplay = getBeanCoffeeTypeDisplay(bean);
            const haystack = [
                coffeeDisplay.roaster,
                coffeeDisplay.farmer,
                coffeeDisplay.origin,
                coffeeDisplay.processing,
                coffeeDisplay.variety,
                coffeeDisplay.roastType
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();
            return haystack.includes(normalizedSearch);
        });

    const byCoffeeType = !coffeeTypeFilter ? bySearch : bySearch.filter((bean) => bean.coffeeTypeId === coffeeTypeFilter);
    if (!decafFilter) return byCoffeeType;
    return byCoffeeType.filter((bean) => {
        const coffeeDisplay = getBeanCoffeeTypeDisplay(bean);
        const status = coffeeDisplay.decaf ? 'Decaf' : 'Regular';
        return normalizeText(status) === normalizeText(decafFilter);
    });
};

export const selectBeansByStockGroups = ({ beans = [], getBeanCalculatedStock }) => {
    const beansWithStock = beans.map((bean) => ({ ...bean, calculatedStock: getBeanCalculatedStock(bean) }));

    const inStockBeans = beansWithStock
        .filter((bean) => !bean.archived && !bean.frozen && bean.calculatedStock !== null && bean.calculatedStock > 0)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const frozenBeans = beansWithStock
        .filter((bean) => !bean.archived && bean.frozen)
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    const otherBeans = beansWithStock
        .filter((bean) => bean.archived || (!bean.frozen && (bean.calculatedStock === null || bean.calculatedStock <= 0)))
        .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return {
        beansWithStock,
        inStockBeans,
        frozenBeans,
        otherBeans
    };
};

export const selectBeanTableOrderIds = ({ beans = [], getBeanCalculatedStock }) => {
    const { inStockBeans, frozenBeans, otherBeans } = selectBeansByStockGroups({
        beans,
        getBeanCalculatedStock
    });
    return [...inStockBeans, ...frozenBeans, ...otherBeans].map((bean) => bean.id);
};
