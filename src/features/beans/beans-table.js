const DEFAULT_BEANS_FILTERS = { coffeeType: null };

const createDefaultFilters = () => ({ ...DEFAULT_BEANS_FILTERS });

export const createBeansTableModule = ({
    getCurrentUser,
    getCurrentView,
    getBeans,
    getCoffeeTypes,
    getBeansSearch,
    setBeansSearchState,
    getBeansFilters,
    setBeansFiltersState,
    getBeanCalculatedStock,
    getBeanCoffeeTypeDisplay,
    getRoastBadge,
    openBeanCard,
    updateCoffeeTypeSelectors
}) => {
    const openBeans = () => {
        if (!getCurrentUser()) return alert('Please sign in.');
        document.getElementById('beansModal')?.classList.remove('hidden');
        renderBeansTable();
        updateCoffeeTypeSelectors();
    };

    const closeBeans = () => {
        document.getElementById('beansModal')?.classList.add('hidden');
    };

    const setBeansSearch = (value) => {
        setBeansSearchState(value || '');
        const clearBtn = document.getElementById('beansSearchClearBtn');
        if (clearBtn) clearBtn.classList.toggle('hidden', getBeansSearch().length === 0);
        renderBeansTable();
    };

    const clearBeansSearch = () => {
        const input = document.getElementById('beansSearch');
        if (input) input.value = '';
        setBeansSearch('');
        input?.focus();
    };

    const toggleBeansQuickFilter = (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('beansQuickFilterDropdown');
        const valuesDropdown = document.getElementById('beansQuickFilterValuesDropdown');
        if (!dropdown || !valuesDropdown) return;

        valuesDropdown.classList.add('hidden');
        if (dropdown.classList.contains('hidden')) {
            const filterCategories = [{ key: 'coffeeType', label: 'Coffee' }];
            const filters = getBeansFilters();
            let html = '<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c]">Filter by</div>';
            filterCategories.forEach((cat) => {
                const isActive = filters[cat.key] !== null;
                const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                html += `<button data-action-click="openBeansQuickFilterValues(event, '${cat.key}', '${cat.label}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] flex items-center justify-between ${activeClass}">
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

    const openBeansQuickFilterValues = (e, key, label) => {
        e.stopPropagation();
        const valuesDropdown = document.getElementById('beansQuickFilterValuesDropdown');
        const mainDropdown = document.getElementById('beansQuickFilterDropdown');
        if (!valuesDropdown || !mainDropdown) return;

        let uniqueVals = [];
        if (key === 'coffeeType') {
            uniqueVals = getCoffeeTypes().map((type) => ({
                id: type.id,
                display: `${type.roaster || 'Unknown'}${type.farmer ? ' - ' + type.farmer : ''}`
            }));
        }

        if (!uniqueVals.length) {
            valuesDropdown.innerHTML = '<div class="px-4 py-3 text-sm text-coffee-400 dark:text-[#78716c] italic">No values available</div>';
        } else {
            const filters = getBeansFilters();
            let html = `<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between">
                <span>${label}</span>
                <button data-action-click="toggleBeansQuickFilter(event)" class="text-coffee-400 hover:text-coffee-600 dark:hover:text-white">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
            </div>`;
            html += `<button data-action-click="applyBeansFilterFromQuick('${key}', null)" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] font-bold text-coffee-700 dark:text-[#d6ccc2]">All</button>`;
            uniqueVals.forEach((val) => {
                const isActive = filters[key] === val.id;
                const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e]' : '';
                const escapedId = String(val.id).replace(/'/g, "\\'");
                html += `<button data-action-click="applyBeansFilterFromQuick('${key}', '${escapedId}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-600 dark:text-[#a8a29e] ${activeClass}">
                    ${val.display}
                </button>`;
            });
            valuesDropdown.innerHTML = html;
        }

        mainDropdown.classList.add('hidden');
        valuesDropdown.classList.remove('hidden');
    };

    const applyBeansFilterFromQuick = (key, value) => {
        setBeansFiltersState({ ...getBeansFilters(), [key]: value });
        document.getElementById('beansQuickFilterDropdown')?.classList.add('hidden');
        document.getElementById('beansQuickFilterValuesDropdown')?.classList.add('hidden');
        renderBeansActiveFilters();
        renderBeansTable();
    };

    const clearBeansFilters = () => {
        setBeansFiltersState(createDefaultFilters());
        renderBeansActiveFilters();
        renderBeansTable();
    };

    const renderBeansActiveFilters = () => {
        const container = document.getElementById('beansActiveFiltersContainer');
        const list = document.getElementById('beansActiveFiltersList');
        if (!container || !list) return;

        list.innerHTML = '';
        let hasFilters = false;
        const filters = getBeansFilters();
        if (filters.coffeeType) {
            hasFilters = true;
            const type = getCoffeeTypes().find((ct) => ct.id === filters.coffeeType);
            const label = type ? `${type.roaster || 'Unknown'}${type.farmer ? ' - ' + type.farmer : ''}` : filters.coffeeType;
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>Coffee:</span><b>${label}</b><button data-action-click="applyBeansFilterFromQuick('coffeeType', null)" class="ml-1 hover:text-red-200">x</button></div>`;
        }
        container.classList.toggle('hidden', !hasFilters);
    };

    const renderBeansTable = () => {
        const tbody = document.getElementById('beansTableBody');
        const empty = document.getElementById('beansEmpty');
        if (!tbody || !empty) return;

        tbody.innerHTML = '';
        renderBeansActiveFilters();
        const isMine = getCurrentView() === 'mine';
        const searchTerm = getBeansSearch().trim().toLowerCase();

        const filteredBeans = getBeans().filter((bean) => {
            if (!searchTerm) return true;
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
            return haystack.includes(searchTerm);
        });

        const coffeeTypeFilter = getBeansFilters().coffeeType;
        const finalBeans = coffeeTypeFilter
            ? filteredBeans.filter((bean) => bean.coffeeTypeId === coffeeTypeFilter)
            : filteredBeans;

        if (finalBeans.length === 0) {
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        const beansWithStock = finalBeans.map((bean) => ({ ...bean, calculatedStock: getBeanCalculatedStock(bean) }));

        const inStockBeans = beansWithStock
            .filter((b) => !b.archived && !b.frozen && b.calculatedStock !== null && b.calculatedStock > 0)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const frozenBeans = beansWithStock
            .filter((b) => !b.archived && b.frozen)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const otherBeans = beansWithStock
            .filter((b) => b.archived || (!b.frozen && (b.calculatedStock === null || b.calculatedStock <= 0)))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

        const formatBeanDateForInput = (value) => {
            if (!value) return '';
            const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            if (isNaN(dateObj)) return '';
            const yyyy = dateObj.getFullYear();
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dd = String(dateObj.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
        };

        const createRow = (bean) => {
            const tr = document.createElement('tr');
            tr.className = 'bg-white dark:bg-[#292524] border-b border-coffee-50 dark:border-[#34302e] hover:bg-coffee-50 dark:hover:bg-[#1c1917] transition-colors';
            tr.ondblclick = (e) => openBeanCard(bean.id, e);
            const coffeeDisplay = getBeanCoffeeTypeDisplay(bean);

            let stockLeftDisplay = '-';
            if (bean.calculatedStock !== null) {
                stockLeftDisplay = `${bean.calculatedStock.toFixed(1)}g`;
            }

            const roaster = coffeeDisplay.roaster !== '-' ? coffeeDisplay.roaster : 'Unknown';
            const farmer = coffeeDisplay.farmer;
            const origin = coffeeDisplay.origin;
            const process = coffeeDisplay.processing;
            const variety = coffeeDisplay.variety !== '-' ? `<br><span class="text-xs text-coffee-500">${coffeeDisplay.variety}</span>` : '';
            const openedDateInputValue = formatBeanDateForInput(bean.openedDate);
            const frozenDateInputValue = formatBeanDateForInput(bean.frozenDate);
            const roastDateInputValue = formatBeanDateForInput(bean.roastDate);
            const archivedDateInputValue = formatBeanDateForInput(bean.archivedDate);
            const menuId = `beans-action-menu-${bean.id}`;
            const freezeLabel = bean.frozen ? 'Unfreeze' : 'Freeze';
            const freezeIcon = bean.frozen ? 'fa-sun text-amber-500' : 'fa-snowflake text-sky-500';
            const archiveLabel = bean.archived ? 'Unarchive' : 'Archive';
            const archiveIcon = bean.archived ? 'fa-box-open text-amber-600' : 'fa-box-archive text-amber-600';
            const goToCoffeeBtn = bean.coffeeTypeId
                ? `<button data-action-click="showCoffeeForBean('${bean.coffeeTypeId}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                    <i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee
                </button>`
                : '';

            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-coffee-900 dark:text-white">${farmer}<br><span class="text-xs text-coffee-500">${roaster}</span></td>
                <td class="px-4 py-3">${origin}</td>
                <td class="px-4 py-3">${process}${variety}</td>
                <td class="px-4 py-3 text-center">${getRoastBadge(coffeeDisplay.roastType)}</td>
                <td class="px-4 py-3 text-center">
                    <input type="number" step="1" value="${bean.stock || ''}"
                        ${isMine ? `data-action-change="saveBeanStock('${bean.id}', this.value)"` : 'disabled'}
                        class="w-20 text-center text-sm border border-coffee-200 dark:border-[#44403c] rounded p-1 bg-coffee-50 dark:bg-[#1c1917] text-coffee-900 dark:text-white focus:ring-1 focus:ring-coffee-500 disabled:opacity-50 disabled:cursor-not-allowed" placeholder="-">
                </td>
                <td class="px-4 py-3 text-center font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${stockLeftDisplay}</td>
                <td class="px-4 py-3 text-center">
                    <input type="date" value="${roastDateInputValue}"
                        ${isMine ? `data-action-change="saveBeanRoastDate('${bean.id}', this.value)"` : 'disabled'}
                        class="w-28 text-center text-xs border border-coffee-200 dark:border-[#44403c] rounded p-1 bg-coffee-50 dark:bg-[#1c1917] text-coffee-900 dark:text-white focus:ring-1 focus:ring-coffee-500 disabled:opacity-50 disabled:cursor-not-allowed">
                </td>
                <td class="px-4 py-3 text-center">
                    <input type="date" value="${frozenDateInputValue}"
                        ${isMine ? `data-action-change="saveBeanFrozenDate('${bean.id}', this.value)"` : 'disabled'}
                        class="w-28 text-center text-xs border border-coffee-200 dark:border-[#44403c] rounded p-1 bg-coffee-50 dark:bg-[#1c1917] text-coffee-900 dark:text-white focus:ring-1 focus:ring-coffee-500 disabled:opacity-50 disabled:cursor-not-allowed">
                </td>
                <td class="px-4 py-3 text-center">
                    <input type="date" value="${openedDateInputValue}"
                        ${isMine ? `data-action-change="saveBeanOpenedDate('${bean.id}', this.value)"` : 'disabled'}
                        class="w-28 text-center text-xs border border-coffee-200 dark:border-[#44403c] rounded p-1 bg-coffee-50 dark:bg-[#1c1917] text-coffee-900 dark:text-white focus:ring-1 focus:ring-coffee-500 disabled:opacity-50 disabled:cursor-not-allowed">
                </td>
                <td class="px-4 py-3 text-center">
                    <input type="date" value="${archivedDateInputValue}" disabled
                        class="w-28 text-center text-xs border border-coffee-200 dark:border-[#44403c] rounded p-1 bg-coffee-50 dark:bg-[#1c1917] text-coffee-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed">
                </td>
                <td class="px-4 py-3 text-center">
                     <div class="relative inline-block">
                         <button data-action-click="toggleActionMenu('${menuId}', event)" class="p-1.5 text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]">
                             <i class="fa-solid fa-ellipsis-vertical text-lg"></i>
                         </button>
                         <div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden">
                             <button data-action-click="openBeanCard('${bean.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                 <i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card
                             </button>
                             ${isMine ? `<button data-action-click="openBeanCard('${bean.id}', event); enterBeanEditMode();" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                 <i class="fa-solid fa-pen-to-square text-blue-500 w-4"></i> Edit
                             </button>` : ''}
                             ${isMine ? `<button data-action-click="openBrewWithBean('${bean.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                 <i class="fa-solid fa-mug-saucer text-coffee-600 w-4"></i> Brew
                             </button>` : ''}
                             ${isMine ? `<button data-action-click="toggleBeanFrozen('${bean.id}', ${bean.frozen ? 'true' : 'false'});" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                 <i class="fa-solid ${freezeIcon} w-4"></i> ${freezeLabel}
                             </button>
                             <button data-action-click="toggleBeanArchive('${bean.id}', ${bean.archived ? 'true' : 'false'});" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                 <i class="fa-solid ${archiveIcon} w-4"></i> ${archiveLabel}
                             </button>` : ''}
                             <button data-action-click="showBrewsForBean('${bean.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                 <i class="fa-solid fa-mug-saucer text-indigo-600 w-4"></i> Go to brews
                             </button>
                             ${goToCoffeeBtn}
                             ${isMine ? `<hr class="border-coffee-100 dark:border-[#44403c]">
                             <button data-action-click="deleteBean('${bean.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3">
                                 <i class="fa-solid fa-trash w-4"></i> Delete
                             </button>` : ''}
                         </div>
                     </div>
                </td>
            `;
            return tr;
        };

        if (inStockBeans.length > 0) {
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-green-50 dark:bg-green-900/20';
            headerRow.innerHTML = '<td colspan="11" class="px-4 py-2 text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide"><i class="fa-solid fa-box-open mr-2"></i>Open Bags</td>';
            tbody.appendChild(headerRow);
            inStockBeans.forEach((bean) => tbody.appendChild(createRow(bean)));
        }

        if (frozenBeans.length > 0) {
            if (inStockBeans.length > 0) {
                const headerRow = document.createElement('tr');
                headerRow.className = 'bg-blue-50 dark:bg-blue-900/20';
                headerRow.innerHTML = '<td colspan="11" class="px-4 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide"><i class="fa-solid fa-snowflake mr-2"></i>Frozen</td>';
                tbody.appendChild(headerRow);
            }
            frozenBeans.forEach((bean) => tbody.appendChild(createRow(bean)));
        }

        if (otherBeans.length > 0) {
            if (inStockBeans.length > 0 || frozenBeans.length > 0) {
                const headerRow = document.createElement('tr');
                headerRow.className = 'bg-gray-50 dark:bg-[#34302e]';
                headerRow.innerHTML = '<td colspan="11" class="px-4 py-2 text-xs font-bold text-gray-500 dark:text-[#a8a29e] uppercase tracking-wide"><i class="fa-solid fa-archive mr-2"></i>Finished / Archive</td>';
                tbody.appendChild(headerRow);
            }
            otherBeans.forEach((bean) => tbody.appendChild(createRow(bean)));
        }
    };

    return {
        openBeans,
        closeBeans,
        setBeansSearch,
        clearBeansSearch,
        toggleBeansQuickFilter,
        openBeansQuickFilterValues,
        applyBeansFilterFromQuick,
        clearBeansFilters,
        renderBeansActiveFilters,
        renderBeansTable,
        createDefaultBeansFilters: createDefaultFilters
    };
};
