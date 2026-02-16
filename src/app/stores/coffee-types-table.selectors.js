export const DEFAULT_COFFEE_TYPES_FILTERS = {
    roaster: null,
    farmer: null,
    origin: null,
    processing: null,
    decaf: null,
    variety: null,
    roast: null
};

export const createDefaultCoffeeTypeFilters = () => ({ ...DEFAULT_COFFEE_TYPES_FILTERS });

const normalizeText = (value) => (value || '').toString().toLowerCase().trim();

export const selectCoffeeTypesQuickFilterValues = ({ key, coffeeTypes = [] }) => {
    if (key === 'decaf') {
        const hasDecaf = coffeeTypes.some((type) => !!type.decaf);
        const hasRegular = coffeeTypes.some((type) => !type.decaf);
        return [hasDecaf ? 'Decaf' : null, hasRegular ? 'Regular' : null].filter(Boolean);
    }
    const valueSource = coffeeTypes
        .map((type) => (key === 'roast' ? (type.roast || type.roastType) : type[key]))
        .filter(Boolean);
    return [...new Set(valueSource)].sort();
};

export const selectFilteredSortedCoffeeTypes = ({
    coffeeTypes = [],
    searchValue = '',
    filters = {},
    sortKey = 'createdAt',
    sortDir = 'desc'
}) => {
    const normalizedSearch = normalizeText(searchValue);
    const hasSearch = normalizedSearch.length > 0;
    const uniqueCoffeeTypes = [...new Map(coffeeTypes.map((type, idx) => [type?.id || `__idx_${idx}`, type])).values()];

    const matchesQuickFilters = (type) => {
        return Object.entries(filters).every(([key, value]) => {
            if (!value) return true;
            if (key === 'decaf') {
                const status = type.decaf ? 'Decaf' : 'Regular';
                return normalizeText(status) === normalizeText(value);
            }
            const targetValue = key === 'roast' ? (type.roast || type.roastType || '') : (type[key] || '');
            return normalizeText(targetValue) === normalizeText(value);
        });
    };

    const filteredTypes = uniqueCoffeeTypes.filter((type) => {
        const roaster = normalizeText(type.roaster);
        const farmer = normalizeText(type.farmer);
        const origin = normalizeText(type.origin);
        const processing = normalizeText(type.processing);
        const variety = normalizeText(type.variety);
        const roast = normalizeText(type.roast || type.roastType);

        if (!matchesQuickFilters(type)) return false;
        if (!hasSearch) return true;
        return [roaster, farmer, origin, processing, variety, roast].join(' ').includes(normalizedSearch);
    });

    const getSortValue = (type, key) => {
        if (key === 'decaf') return type.decaf ? 1 : 0;
        if (key === 'roast') return type.roast || type.roastType || '';
        if (key === 'rating') return parseInt(type.rating, 10) || 0;
        if (key === 'createdAt') return type.createdAt || '';
        return type[key] || '';
    };

    return [...filteredTypes].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const aVal = getSortValue(a, sortKey);
        const bVal = getSortValue(b, sortKey);

        let primary;
        if (sortKey === 'rating') {
            primary = (Number(aVal) || 0) - (Number(bVal) || 0);
        } else {
            primary = normalizeText(aVal).localeCompare(normalizeText(bVal));
        }

        if (primary === 0) {
            const aRoaster = normalizeText(a.roaster);
            const bRoaster = normalizeText(b.roaster);
            const aFarmer = normalizeText(a.farmer);
            const bFarmer = normalizeText(b.farmer);
            if (sortKey === 'roaster') {
                primary = aFarmer.localeCompare(bFarmer);
            } else if (sortKey === 'farmer') {
                primary = aRoaster.localeCompare(bRoaster);
            } else {
                primary = aRoaster.localeCompare(bRoaster) || aFarmer.localeCompare(bFarmer);
            }
        }
        return primary * dir;
    });
};
