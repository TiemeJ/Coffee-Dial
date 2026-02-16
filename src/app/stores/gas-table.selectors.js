export const DEFAULT_GAS_FILTERS = {
    archived: null
};

export const createDefaultGasFilters = () => ({ ...DEFAULT_GAS_FILTERS });

export const GAS_TYPE_OPTIONS = ['Coffee maker', 'Grinder', 'Other'];
export const GAS_METHOD_OPTIONS = ['Espresso', 'V60', 'Hario Switch', 'Clever Dripper', 'Aeropress', 'OXO Rapid Brewer', 'French Press', 'Chemex'];

export const normalizeGasText = (value) => (value || '').toString().toLowerCase().trim();

export const normalizeGasType = (type) => (GAS_TYPE_OPTIONS.includes(type) ? type : 'Other');

export const normalizeGasMethods = (methods) => {
    if (!Array.isArray(methods)) return [];
    return [...new Set(methods.filter((method) => GAS_METHOD_OPTIONS.includes(method)))];
};

export const getGasMethodsLabel = (methods) => {
    const list = normalizeGasMethods(methods);
    return list.length ? list.join(', ') : '-';
};

const parsePrice = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

export const selectGasQuickFilterValues = ({ key, gasItems = [] }) => {
    if (key === 'archived') {
        return [
            { value: 'active', label: 'Active' },
            { value: 'archived', label: 'Archived' }
        ];
    }
    if (key === 'type') {
        return [...new Set(gasItems.map((item) => normalizeGasType(item.type)))].sort()
            .map((value) => ({ value, label: value }));
    }
    if (key === 'method') {
        return [...new Set(gasItems.flatMap((item) => normalizeGasMethods(item.methods)))].sort()
            .map((value) => ({ value, label: value }));
    }
    return [];
};

export const selectFilteredSortedGasItems = ({ gasItems = [], searchValue = '', filters = {}, sortKey = 'purchasedDate', sortDir = 'desc' }) => {
    const normalizedSearch = normalizeGasText(searchValue);
    const hasSearch = normalizedSearch.length > 0;

    const filtered = gasItems.filter((item) => {
        const methods = normalizeGasMethods(item.methods);
        const isArchived = !!item.archived;
        if (filters.archived === 'archived' && !isArchived) return false;
        if (filters.archived === 'active' && isArchived) return false;
        if (filters.type && normalizeGasType(item.type) !== filters.type) return false;
        if (filters.method && !methods.includes(filters.method)) return false;
        if (!hasSearch) return true;
        const haystack = [item.name, normalizeGasType(item.type), methods.join(' ')].map(normalizeGasText).join(' ');
        return haystack.includes(normalizedSearch);
    });

    const getSortValue = (item, key) => {
        if (key === 'price') return parsePrice(item.price);
        if (key === 'type') return normalizeGasType(item.type);
        if (key === 'methods') return normalizeGasMethods(item.methods).join(', ');
        if (key === 'purchasedDate') return item.purchasedDate || '';
        return item.name || '';
    };

    return [...filtered].sort((a, b) => {
        const dir = sortDir === 'asc' ? 1 : -1;
        const aVal = getSortValue(a, sortKey);
        const bVal = getSortValue(b, sortKey);
        let primary = 0;

        if (sortKey === 'price') {
            const aNum = Number(aVal);
            const bNum = Number(bVal);
            primary = (Number.isFinite(aNum) ? aNum : -Infinity) - (Number.isFinite(bNum) ? bNum : -Infinity);
        } else {
            primary = normalizeGasText(aVal).localeCompare(normalizeGasText(bVal));
        }

        if (primary === 0) {
            primary = normalizeGasText(a.name).localeCompare(normalizeGasText(b.name));
        }
        return primary * dir;
    });
};
