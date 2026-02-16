export const DEFAULT_ACTIVE_FILTERS = {
    bean: null,
    coffeeType: null,
    gear: null,
    method: null,
    temp: null,
    roastType: null,
    roaster: null,
    origin: null,
    farmer: null,
    variety: null,
    processing: null,
    drink: null,
    grinder: null
};

export const createDefaultActiveFilters = () => ({ ...DEFAULT_ACTIVE_FILTERS });

const normalizeText = (value) => (value || '').toString().toLowerCase();

const getSortValue = (brew, key) => {
    if (key === 'roaster') return brew.roaster || brew.name;
    if (key === 'origin') return brew.origin || brew.beanType;
    return brew[key];
};

export const selectBrewsUniqueValuesForKey = ({ coffees = [], key }) => {
    const values = coffees.map((brew) =>
        key === 'roaster' ? (brew.roaster || brew.name) : key === 'origin' ? (brew.origin || brew.beanType) : brew[key]
    );
    return [...new Set(values)].filter(Boolean).sort();
};

export const selectBrewsQuickFilterValues = ({ key, coffees = [], beans = [], coffeeTypes = [], gasItems = [], formatBeanOpenedDate }) => {
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

export const selectFilteredSortedBrews = ({
    coffees = [],
    searchTerm = '',
    activeFilters = {},
    currentSort = { key: null, direction: 'asc' },
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
        const typeId = getCoffeeTypeForBrew(brew)?.id || null;

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
        const gearMatch = !activeFilters.gear || (Array.isArray(brew.gearIds) && brew.gearIds.includes(activeFilters.gear));
        const beanMatch = !activeFilters.bean || brew.beanId === activeFilters.bean;
        const typeMatch = !activeFilters.coffeeType || typeId === activeFilters.coffeeType;

        return m && t && r && rost && orig && farm && varr && proc && dr && gri && gearMatch && beanMatch && typeMatch;
    });

    if (currentSort?.key) {
        filtered.sort((a, b) => {
            let va = getSortValue(a, currentSort.key);
            let vb = getSortValue(b, currentSort.key);
            if (currentSort.key === 'temp') {
                const na = parseFloat(va);
                const nb = parseFloat(vb);
                if (!isNaN(na) && !isNaN(nb)) {
                    va = na;
                    vb = nb;
                }
            }
            if (typeof va === 'string') va = va.toLowerCase();
            if (typeof vb === 'string') vb = vb.toLowerCase();
            if (va < vb) return currentSort.direction === 'asc' ? -1 : 1;
            if (va > vb) return currentSort.direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    return filtered;
};

export const selectVisibleBrewOrderIds = ({ filteredSortedBrews = [], displayedCount = 0 }) => {
    const limit = Math.min(Math.max(0, displayedCount || 0), filteredSortedBrews.length);
    return filteredSortedBrews.slice(0, limit).map((brew) => brew.id);
};
