export const DEFAULT_ACTIVE_FILTERS = {
    bean: null,
    coffeeType: null,
    gear: null,
    hasGraph: null,
    method: null,
    temp: null,
    roastType: null,
    roaster: null,
    origin: null,
    farmer: null,
    variety: null,
    processing: null,
    decaf: null,
    drink: null,
    grinder: null
};

export const createDefaultActiveFilters = () => ({ ...DEFAULT_ACTIVE_FILTERS });

const normalizeText = (value) => (value || '').toString().toLowerCase();

const normalizeSortChain = (currentSort) => {
    if (Array.isArray(currentSort)) {
        return currentSort
            .map((item) => ({
                key: item?.key || null,
                direction: item?.direction === 'desc' ? 'desc' : 'asc'
            }))
            .filter((item) => !!item.key);
    }
    if (currentSort && typeof currentSort === 'object' && currentSort.key) {
        return [{
            key: currentSort.key,
            direction: currentSort.direction === 'desc' ? 'desc' : 'asc'
        }];
    }
    return [];
};

const getSortValue = (brew, key, getCoffeeTypeDisplay) => {
    if (key === 'date') key = 'createdAt';
    const typeDisplay = typeof getCoffeeTypeDisplay === 'function' ? getCoffeeTypeDisplay(brew) : null;
    if (key === 'roaster') return typeDisplay?.roaster || brew.roaster || brew.name;
    if (key === 'origin') return typeDisplay?.origin || brew.origin || brew.beanType;
    if (key === 'farmer') return typeDisplay?.farmer || brew.farmer;
    if (key === 'variety') return typeDisplay?.variety || brew.variety;
    if (key === 'processing') return typeDisplay?.processing || brew.processing;
    if (key === 'roastType') return typeDisplay?.roastType || brew.roastType;
    if (key === 'recipe') return Number(brew.ratio) || 0;
    if (key === 'decaf') {
        return typeDisplay?.decaf || brew?.decaf ? 1 : 0;
    }
    return brew[key];
};

const NUMERIC_SORT_KEYS = new Set(['rating', 'time', 'temp', 'grind', 'recipe', 'ratio', 'weight']);
const DATE_SORT_KEYS = new Set(['createdAt', 'date', 'updatedAt', 'openedDate', 'roastDate']);
const normalizeSortPrimitive = (value, key) => {
    if (value === null || typeof value === 'undefined') return null;
    if (typeof value === 'object') {
        if (typeof value.toDate === 'function') {
            const date = value.toDate();
            return Number.isNaN(date?.getTime?.()) ? null : date.getTime();
        }
        if (value instanceof Date) {
            return Number.isNaN(value.getTime()) ? null : value.getTime();
        }
    }
    if (DATE_SORT_KEYS.has(key)) {
        const parsedDate = new Date(value);
        if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getTime();
    }
    if (NUMERIC_SORT_KEYS.has(key)) {
        const numeric = Number(value);
        if (!Number.isNaN(numeric)) return numeric;
    }
    return typeof value === 'string' ? value.toLowerCase() : value;
};

export const selectBrewsUniqueValuesForKey = ({ coffees = [], key }) => {
    const values = coffees.map((brew) =>
        key === 'roaster' ? (brew.roaster || brew.name) : key === 'origin' ? (brew.origin || brew.beanType) : brew[key]
    );
    return [...new Set(values)].filter(Boolean).sort();
};

export const selectBrewsQuickFilterValues = ({ key, coffees = [], beans = [], coffeeTypes = [], gasItems = [], formatBeanOpenedDate }) => {
    if (key === 'decaf') {
        const beanById = new Map(beans.map((bean) => [bean.id, bean]));
        const typeById = new Map(coffeeTypes.map((type) => [type.id, type]));
        let hasDecaf = false;
        let hasRegular = false;
        coffees.forEach((brew) => {
            const bean = beanById.get(brew.beanId);
            const type = bean?.coffeeTypeId ? typeById.get(bean.coffeeTypeId) : null;
            const isDecaf = !!(type?.decaf || brew?.decaf);
            if (isDecaf) hasDecaf = true;
            else hasRegular = true;
        });
        return [hasDecaf ? 'Decaf' : null, hasRegular ? 'Regular' : null].filter(Boolean);
    }
    if (key === 'hasGraph') {
        return ['Has graph'];
    }
    if (key === 'bean') {
        return beans.map((bean) => {
            const opened = formatBeanOpenedDate(bean.openedDate);
            const suffix = opened ? ` (${opened})` : '';
            return {
                id: bean.id,
                display: `${bean.roaster || 'Unknown'}${bean.farmer ? ` - ${bean.farmer}` : ''}${suffix}`
            };
        });
    }
    if (key === 'coffeeType') {
        return coffeeTypes.map((type) => ({
            id: type.id,
            display: `${type.roaster || 'Unknown'}${type.farmer ? ` - ${type.farmer}` : ''}`
        }));
    }
    if (key === 'gear') {
        const usedGearIds = new Set();
        coffees.forEach((brew) => {
            const gearIds = Array.isArray(brew.gearIds) ? brew.gearIds : [];
            gearIds.forEach((gearId) => {
                if (gearId) usedGearIds.add(gearId);
            });
        });
        return gasItems
            .filter((item) => usedGearIds.has(item.id))
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }))
            .map((item) => ({ id: item.id, display: item.name || 'Unnamed gear' }));
    }
    return selectBrewsUniqueValuesForKey({ coffees, key });
};

const hasBrewGraphData = (brew) =>
    !!(
        (brew?.scaleCapture && Array.isArray(brew.scaleCapture.samples) && brew.scaleCapture.samples.length) ||
        (brew?.scaleFlowCapture && Array.isArray(brew.scaleFlowCapture.samples) && brew.scaleFlowCapture.samples.length) ||
        (brew?.scaleRawCapture && Array.isArray(brew.scaleRawCapture.samples) && brew.scaleRawCapture.samples.length)
    );

export const selectFilteredSortedBrews = ({
    coffees = [],
    searchTerm = '',
    activeFilters = {},
    currentSort = [],
    getCoffeeTypeDisplay,
    getCoffeeTypeForBrew
}) => {
    let filtered = [...coffees];
    const term = normalizeText(searchTerm).trim();

    if (term) {
        filtered = filtered.filter((brew) => {
            const typeDisplay = getCoffeeTypeDisplay(brew);
            const searchable = [
                brew.roaster || brew.name || '',
                brew.origin || brew.beanType || '',
                brew.farmer || '',
                brew.variety || '',
                brew.processing || '',
                brew.method || '',
                brew.drink || '',
                brew.notes || '',
                brew.improve || '',
                brew.grinder || '',
                typeDisplay.roaster || '',
                typeDisplay.farmer || '',
                typeDisplay.origin || '',
                typeDisplay.variety || '',
                typeDisplay.processing || '',
                typeDisplay.roastType || ''
            ]
                .join(' ')
                .toLowerCase();
            return searchable.includes(term);
        });
    }

    filtered = filtered.filter((brew) => {
        const cRoaster = brew.roaster || brew.name;
        const cOrigin = brew.origin || brew.beanType;
        const coffeeType = getCoffeeTypeForBrew(brew);
        const typeId = coffeeType?.id || null;

        const m = !activeFilters.method || brew.method === activeFilters.method;
        const t = !activeFilters.temp || String(brew.temp) === String(activeFilters.temp);
        const r = !activeFilters.roastType || brew.roastType === activeFilters.roastType;
        const rost = !activeFilters.roaster || cRoaster === activeFilters.roaster;
        const orig = !activeFilters.origin || cOrigin === activeFilters.origin;
        const farm = !activeFilters.farmer || brew.farmer === activeFilters.farmer;
        const varr = !activeFilters.variety || brew.variety === activeFilters.variety;
        const proc = !activeFilters.processing || brew.processing === activeFilters.processing;
        const dr = !activeFilters.drink || brew.drink === activeFilters.drink;
        const gri = !activeFilters.grinder || brew.grinder === activeFilters.grinder;
        const decafStatus = typeId ? (coffeeType?.decaf ? 'Decaf' : 'Regular') : (brew?.decaf ? 'Decaf' : 'Regular');
        const decafMatch = !activeFilters.decaf || normalizeText(decafStatus) === normalizeText(activeFilters.decaf);
        const gearMatch = !activeFilters.gear || (Array.isArray(brew.gearIds) && brew.gearIds.includes(activeFilters.gear));
        const graphMatch = !activeFilters.hasGraph || hasBrewGraphData(brew);
        const beanMatch = !activeFilters.bean || brew.beanId === activeFilters.bean;
        const typeMatch = !activeFilters.coffeeType || typeId === activeFilters.coffeeType;

        return m && t && r && rost && orig && farm && varr && proc && decafMatch && dr && gri && gearMatch && graphMatch && beanMatch && typeMatch;
    });

    const sortChain = normalizeSortChain(currentSort);
    if (sortChain.length) {
        filtered.sort((a, b) => {
            for (const sortItem of sortChain) {
                const va = normalizeSortPrimitive(getSortValue(a, sortItem.key, getCoffeeTypeDisplay), sortItem.key);
                const vb = normalizeSortPrimitive(getSortValue(b, sortItem.key, getCoffeeTypeDisplay), sortItem.key);
                if (va === null && vb !== null) return sortItem.direction === 'asc' ? -1 : 1;
                if (va !== null && vb === null) return sortItem.direction === 'asc' ? 1 : -1;
                if (va < vb) return sortItem.direction === 'asc' ? -1 : 1;
                if (va > vb) return sortItem.direction === 'asc' ? 1 : -1;
            }
            return 0;
        });
    }

    return filtered;
};

export const selectVisibleBrewOrderIds = ({ filteredSortedBrews = [], displayedCount = 0 }) => {
    const limit = Math.min(Math.max(0, displayedCount || 0), filteredSortedBrews.length);
    return filteredSortedBrews.slice(0, limit).map((brew) => brew.id);
};
