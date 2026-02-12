const DEFAULT_GAS_FILTERS = {
    archived: null
};

const createDefaultFilters = () => ({ ...DEFAULT_GAS_FILTERS });

const normalizeText = (value) => (value || '').toString().toLowerCase().trim();

const formatCurrency = (value) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return '-';
    return `EUR ${num.toFixed(2)}`;
};

const parsePrice = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
};

const GAS_TYPE_OPTIONS = ['Coffee maker', 'Grinder', 'Other'];
const GAS_METHOD_OPTIONS = ['Espresso', 'V60', 'Hario Switch', 'Clever Dripper', 'Aeropress', 'OXO Rapid Brewer', 'French Press', 'Chemex'];
const normalizeType = (type) => (GAS_TYPE_OPTIONS.includes(type) ? type : 'Other');
const normalizeMethods = (methods) => {
    if (!Array.isArray(methods)) return [];
    return [...new Set(methods.filter((method) => GAS_METHOD_OPTIONS.includes(method)))];
};
const getMethodsLabel = (methods) => {
    const list = normalizeMethods(methods);
    return list.length ? list.join(', ') : '-';
};

export const createGasTableModule = ({
    getGasItems,
    getCurrentView,
    getGasSearch,
    setGasSearchState,
    getGasFilters,
    setGasFiltersState,
    getGasSortKey,
    setGasSortKeyState,
    getGasSortDir,
    setGasSortDirState,
    openGasCard
}) => {
    const openGasList = () => {
        document.getElementById('gasModal')?.classList.remove('hidden');
        renderGasTable();
    };

    const closeGasList = () => {
        document.getElementById('gasModal')?.classList.add('hidden');
    };

    const setGasSearch = (value) => {
        setGasSearchState(value || '');
        const clearBtn = document.getElementById('gasSearchClearBtn');
        if (clearBtn) clearBtn.classList.toggle('hidden', getGasSearch().length === 0);
        renderGasTable();
    };

    const clearGasSearch = () => {
        const input = document.getElementById('gasSearch');
        if (input) input.value = '';
        setGasSearch('');
        input?.focus();
    };

    const toggleGasQuickFilter = (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('gasQuickFilterDropdown');
        const valuesDropdown = document.getElementById('gasQuickFilterValuesDropdown');
        if (!dropdown || !valuesDropdown) return;

        valuesDropdown.classList.add('hidden');

        if (dropdown.classList.contains('hidden')) {
            const filters = getGasFilters();
            const categories = [
                { key: 'archived', label: 'State' },
                { key: 'type', label: 'Type' },
                { key: 'method', label: 'Method' }
            ];
            let html = '<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c]">Filter by</div>';
            categories.forEach((cat) => {
                const isActive = filters[cat.key] !== null;
                const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                html += `<button data-action-click="openGasQuickFilterValues(event, '${cat.key}', '${cat.label}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] flex items-center justify-between ${activeClass}">
                    <span>${cat.label}</span>
                    ${isActive ? '<i class="fa-solid fa-check text-coffee-600 dark:text-[#a8a29e] text-xs"></i>' : '<i class="fa-solid fa-chevron-right text-coffee-300 dark:text-[#57534e] text-xs"></i>'}
                </button>`;
            });
            dropdown.innerHTML = html;
            dropdown.classList.remove('hidden');
        } else {
            dropdown.classList.add('hidden');
        }
    };

    const openGasQuickFilterValues = (e, key, label) => {
        e.stopPropagation();
        const valuesDropdown = document.getElementById('gasQuickFilterValuesDropdown');
        const mainDropdown = document.getElementById('gasQuickFilterDropdown');
        if (!valuesDropdown || !mainDropdown) return;

        const filters = getGasFilters();
        let values = [];
        if (key === 'archived') {
            values = [
                { value: 'active', label: 'Active' },
                { value: 'archived', label: 'Archived' }
            ];
        } else if (key === 'type') {
            values = [...new Set(getGasItems().map((item) => normalizeType(item.type)))].sort()
                .map((value) => ({ value, label: value }));
        } else if (key === 'method') {
            values = [...new Set(getGasItems().flatMap((item) => normalizeMethods(item.methods)))].sort()
                .map((value) => ({ value, label: value }));
        }

        let html = `<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between">
            <span>${label}</span>
            <button data-action-click="toggleGasQuickFilter(event)" class="text-coffee-400 hover:text-coffee-600 dark:hover:text-white">
                <i class="fa-solid fa-arrow-left"></i>
            </button>
        </div>`;

        html += `<button data-action-click="applyGasFilterFromQuick('${key}', null)" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] font-bold text-coffee-700 dark:text-[#d6ccc2]">All</button>`;

        values.forEach((entry) => {
            const isActive = filters[key] === entry.value;
            const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e]' : '';
            html += `<button data-action-click="applyGasFilterFromQuick('${key}', '${entry.value}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-600 dark:text-[#a8a29e] ${activeClass}">${entry.label}</button>`;
        });

        valuesDropdown.innerHTML = html;
        mainDropdown.classList.add('hidden');
        valuesDropdown.classList.remove('hidden');
    };

    const applyGasFilterFromQuick = (key, value) => {
        setGasFiltersState({ ...getGasFilters(), [key]: value });
        const dropdown = document.getElementById('gasQuickFilterDropdown');
        const valuesDropdown = document.getElementById('gasQuickFilterValuesDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        if (valuesDropdown) valuesDropdown.classList.add('hidden');
        renderGasActiveFilters();
        renderGasTable();
    };

    const clearGasFilters = () => {
        setGasFiltersState(createDefaultFilters());
        renderGasActiveFilters();
        renderGasTable();
    };

    const renderGasActiveFilters = () => {
        const container = document.getElementById('gasActiveFiltersContainer');
        const list = document.getElementById('gasActiveFiltersList');
        if (!container || !list) return;

        const filters = getGasFilters();
        const status = filters.archived;
        const type = filters.type;
        const method = filters.method;
        list.innerHTML = '';
        if (!status && !type && !method) {
            container.classList.add('hidden');
            return;
        }

        if (status) {
            const label = status === 'archived' ? 'Archived' : 'Active';
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>State:</span><b>${label}</b><button data-action-click="applyGasFilterFromQuick('archived', null)" class="ml-1 hover:text-red-200">x</button></div>`;
        }
        if (type) {
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>Type:</span><b>${type}</b><button data-action-click="applyGasFilterFromQuick('type', null)" class="ml-1 hover:text-red-200">x</button></div>`;
        }
        if (method) {
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>Method:</span><b>${method}</b><button data-action-click="applyGasFilterFromQuick('method', null)" class="ml-1 hover:text-red-200">x</button></div>`;
        }
        container.classList.remove('hidden');
    };

    const setGasSort = (key) => {
        if (getGasSortKey() === key) {
            setGasSortDirState(getGasSortDir() === 'asc' ? 'desc' : 'asc');
        } else {
            setGasSortKeyState(key);
            setGasSortDirState('asc');
        }
        renderGasTable();
    };

    const updateGasSortIcons = () => {
        const keys = ['name', 'type', 'methods', 'price', 'purchasedDate'];
        const sortKey = getGasSortKey();
        const sortDir = getGasSortDir();
        keys.forEach((key) => {
            const el = document.getElementById(`gasSortIcon-${key}`);
            if (!el) return;
            if (sortKey !== key) {
                el.textContent = '';
                return;
            }
            el.textContent = sortDir === 'asc' ? '▲' : '▼';
        });
    };

    const getFilteredSortedGasItems = () => {
        const searchValue = normalizeText(getGasSearch());
        const hasSearch = searchValue.length > 0;
        const filters = getGasFilters();

        const filtered = getGasItems().filter((item) => {
            const methods = normalizeMethods(item.methods);
            const isArchived = !!item.archived;
            if (filters.archived === 'archived' && !isArchived) return false;
            if (filters.archived === 'active' && isArchived) return false;
            if (filters.type && normalizeType(item.type) !== filters.type) return false;
            if (filters.method && !methods.includes(filters.method)) return false;
            if (!hasSearch) return true;
            const haystack = [item.name, normalizeType(item.type), methods.join(' ')].map(normalizeText).join(' ');
            return haystack.includes(searchValue);
        });

        const getSortValue = (item, key) => {
            if (key === 'price') return parsePrice(item.price);
            if (key === 'type') return normalizeType(item.type);
            if (key === 'methods') return normalizeMethods(item.methods).join(', ');
            if (key === 'purchasedDate') return item.purchasedDate || '';
            return item.name || '';
        };

        return [...filtered].sort((a, b) => {
            const dir = getGasSortDir() === 'asc' ? 1 : -1;
            const sortKey = getGasSortKey();
            const aVal = getSortValue(a, sortKey);
            const bVal = getSortValue(b, sortKey);
            let primary = 0;

            if (sortKey === 'price') {
                const aNum = Number(aVal);
                const bNum = Number(bVal);
                primary = (Number.isFinite(aNum) ? aNum : -Infinity) - (Number.isFinite(bNum) ? bNum : -Infinity);
            } else if (sortKey === 'purchasedDate') {
                primary = normalizeText(aVal).localeCompare(normalizeText(bVal));
            } else {
                primary = normalizeText(aVal).localeCompare(normalizeText(bVal));
            }

            if (primary === 0) {
                primary = normalizeText(a.name).localeCompare(normalizeText(b.name));
            }
            return primary * dir;
        });
    };

    const renderGasTable = () => {
        const tbody = document.getElementById('gasTableBody');
        const empty = document.getElementById('gasEmpty');
        if (!tbody || !empty) return;

        tbody.innerHTML = '';
        renderGasActiveFilters();

        const items = getGasItems();
        if (!items.length) {
            empty.classList.remove('hidden');
            return;
        }

        const sortedItems = getFilteredSortedGasItems();
        if (!sortedItems.length) {
            empty.classList.remove('hidden');
            updateGasSortIcons();
            return;
        }
        empty.classList.add('hidden');

        const isMine = getCurrentView() === 'mine';

        const createRow = (item) => {
            const menuId = `gas-action-menu-${item.id}`;
            const purchasedDate = item.purchasedDate;
            const purchasedDateLabel = purchasedDate ? new Date(purchasedDate).toLocaleDateString() : '-';
            const archiveLabel = item.archived ? 'Unarchive' : 'Archive';

            const row = document.createElement('tr');
            row.className = 'bg-white dark:bg-[#292524] border-b border-coffee-100 dark:border-[#44403c] last:border-b-0';
            row.ondblclick = (event) => openGasCard(item.id, event);
            row.innerHTML = `
                <td class="px-4 py-3 font-semibold">${item.name || '-'}</td>
                <td class="px-4 py-3">${normalizeType(item.type)}</td>
                <td class="px-4 py-3 text-xs">${getMethodsLabel(item.methods)}</td>
                <td class="px-4 py-3 text-right font-mono">${formatCurrency(item.price)}</td>
                <td class="px-4 py-3 text-center text-xs font-mono text-coffee-500">${purchasedDateLabel}</td>
                <td class="px-4 py-3 text-center">
                    <div class="relative inline-block">
                        <button data-action-click="toggleActionMenu('${menuId}', event)" class="p-1.5 text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]">
                            <i class="fa-solid fa-ellipsis-vertical text-lg"></i>
                        </button>
                        <div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden">
                            <button data-action-click="openGasCard('${item.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                <i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card
                            </button>
                            ${isMine ? `<button data-action-click="openGasFromTableEdit('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-pen-to-square text-blue-500 w-4"></i> Edit</button>` : ''}
                            ${isMine ? `<button data-action-click="toggleGasArchiveFromTable('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-box-archive text-amber-600 w-4"></i> ${archiveLabel}</button>` : ''}
                            ${isMine ? `<hr class="border-coffee-100 dark:border-[#44403c]"><button data-action-click="deleteGasFromTable('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3"><i class="fa-solid fa-trash w-4"></i> Delete</button>` : ''}
                        </div>
                    </div>
                </td>
            `;
            return row;
        };

        const activeItems = sortedItems.filter((item) => !item.archived);
        const archivedItems = sortedItems.filter((item) => item.archived);

        if (activeItems.length > 0) {
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-green-50 dark:bg-green-900/20';
            headerRow.innerHTML = '<td colspan="6" class="px-4 py-2 text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide"><i class="fa-solid fa-box-open mr-2"></i>Active</td>';
            tbody.appendChild(headerRow);
            activeItems.forEach((item) => tbody.appendChild(createRow(item)));
        }

        if (archivedItems.length > 0) {
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-gray-50 dark:bg-[#34302e]';
            headerRow.innerHTML = '<td colspan="6" class="px-4 py-2 text-xs font-bold text-gray-500 dark:text-[#a8a29e] uppercase tracking-wide"><i class="fa-solid fa-archive mr-2"></i>Archived</td>';
            tbody.appendChild(headerRow);
            archivedItems.forEach((item) => tbody.appendChild(createRow(item)));
        }

        updateGasSortIcons();
    };

    return {
        openGasList,
        closeGasList,
        setGasSearch,
        clearGasSearch,
        toggleGasQuickFilter,
        openGasQuickFilterValues,
        applyGasFilterFromQuick,
        clearGasFilters,
        renderGasActiveFilters,
        setGasSort,
        updateGasSortIcons,
        getFilteredSortedGasItems,
        renderGasTable,
        createDefaultGasFilters: createDefaultFilters
    };
};
