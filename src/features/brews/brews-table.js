import { createBrewsVmModule } from './brews.vm.js';
import {
    createDefaultActiveFilters,
    selectBrewsQuickFilterValues,
    selectBrewsUniqueValuesForKey,
    selectFilteredSortedBrews
} from '../../app/stores/brews-table.selectors.js';

export const createBrewsTableModule = ({
    getCoffees,
    getBeans,
    getCoffeeTypes,
    getGasItems,
    getCurrentView,
    getCurrentSort,
    setCurrentSort,
    getActiveFilters,
    setActiveFilters,
    getDisplayedBrewsCount,
    setDisplayedBrewsCount,
    getBrewsPerPage,
    getColumnDefs,
    getColumnPreferences,
    getPinnedBrewsPreferences,
    getCoffeeTypeDisplay,
    getCoffeeTypeForBrew,
    getStarDisplay,
    formatBeanOpenedDate,
    formatTime,
    dispatchCommand,
    changeView
}) => {
    const brewsVm = createBrewsVmModule();
    const openBrewCard = (id, event = null) => {
        if (!id) return;
        dispatchCommand?.('brews.openCard', { id, event, options: {} });
    };
    const getFilterLabel = (key) => {
        const labelMap = {
            bean: 'Bean',
            coffeeType: 'Coffee',
            gear: 'Gear',
            hasGraph: 'Graph',
            method: 'Method',
            temp: 'Temperature',
            roastType: 'Roast',
            roaster: 'Roaster',
            origin: 'Origin',
            farmer: 'Blend/Farmer',
            variety: 'Variety',
            processing: 'Process',
            decaf: 'Decaf',
            drink: 'Drink',
            grinder: 'Grinder'
        };
        return labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
    };

    const updateBrewSortIcons = () => {
        const keys = [
            'roaster',
            'origin',
            'farmer',
            'variety',
            'processing',
            'decaf',
            'roastType',
            'method',
            'grinder',
            'grind',
            'time',
            'temp',
            'drink',
            'rating',
            'createdAt'
        ];
        const currentSort = getCurrentSort();
        keys.forEach((key) => {
            const el = document.getElementById(`brewSortIcon-${key}`);
            if (!el) return;
            if (currentSort.key !== key) {
                el.textContent = '';
                return;
            }
            el.textContent = currentSort.direction === 'asc' ? '▲' : '▼';
        });
    };

    const clearSearch = () => {
        const input = document.getElementById('globalSearch');
        if (input) input.value = '';
        setDisplayedBrewsCount(getBrewsPerPage());
        renderTable();
        document.getElementById('searchClearBtn')?.classList.add('hidden');
        input?.focus();
    };

    const sortBy = (key) => {
        const currentSort = getCurrentSort();
        if (currentSort.key === key) {
            setCurrentSort({ key, direction: currentSort.direction === 'asc' ? 'desc' : 'asc' });
        } else {
            setCurrentSort({ key, direction: 'asc' });
        }
        setDisplayedBrewsCount(getBrewsPerPage());
        renderTable();
        updateBrewSortIcons();
    };

    const openFilterMenu = (e, key) => {
        e.stopPropagation();
        const menu = document.getElementById('filterDropdown');
        if (!menu) return;
        const uniqueValues = selectBrewsUniqueValuesForKey({
            coffees: getCoffees(),
            key
        });
        if (!uniqueValues.length) return;

        const label = getFilterLabel(key);
        let html = `<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c] mb-1">Filter ${label}</div><button data-action-click="applyFilter('${key}',null)" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] font-bold text-coffee-700 dark:text-[#d6ccc2]">All</button>`;
        uniqueValues.forEach((value) => {
            html += `<button data-action-click="applyFilter('${key}','${value}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-600 dark:text-[#a8a29e]">${value}</button>`;
        });

        menu.innerHTML = html;
        const rect = e.currentTarget.getBoundingClientRect();
        const containerRect = e.currentTarget.closest('.relative').getBoundingClientRect();
        menu.style.top = `${rect.bottom - containerRect.top + 5}px`;
        menu.style.left = `${rect.left - containerRect.left}px`;
        menu.classList.remove('hidden');
    };

    const applyFilter = (key, value) => {
        setActiveFilters({ ...getActiveFilters(), [key]: value });
        document.getElementById('filterDropdown')?.classList.add('hidden');
        setDisplayedBrewsCount(getBrewsPerPage());
        renderTable();
        renderActiveFilters();
    };

    const clearAllFilters = () => {
        setActiveFilters(createDefaultActiveFilters());
        setDisplayedBrewsCount(getBrewsPerPage());
        renderTable();
        renderActiveFilters();
    };

    const renderActiveFilters = () => {
        const container = document.getElementById('activeFiltersContainer');
        const list = document.getElementById('activeFiltersList');
        if (!container || !list) return;

        list.innerHTML = '';
        let hasFilters = false;
        const activeFilters = getActiveFilters();
        const beans = getBeans();
        const coffeeTypes = getCoffeeTypes();
        const gasItems = getGasItems();

        Object.entries(activeFilters).forEach(([key, value]) => {
            if (!value) return;
            hasFilters = true;
            let displayValue = value;
            const label = getFilterLabel(key);

            if (key === 'bean') {
                const bean = beans.find((b) => b.id === value);
                if (bean) {
                    const opened = formatBeanOpenedDate(bean.openedDate);
                    const suffix = opened ? ` (${opened})` : '';
                    displayValue = `${bean.roaster || 'Unknown'}${bean.farmer ? ` - ${bean.farmer}` : ''}${suffix}`;
                }
            }

            if (key === 'coffeeType') {
                const type = coffeeTypes.find((ct) => ct.id === value);
                if (type) displayValue = `${type.roaster || 'Unknown'}${type.farmer ? ` - ${type.farmer}` : ''}`;
            }

            if (key === 'gear') {
                const gear = gasItems.find((item) => item.id === value);
                if (gear) displayValue = gear.name || 'Unnamed gear';
            }

            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>${label}:</span><b>${displayValue}</b><button data-action-click="applyFilter('${key}',null)" class="ml-1 hover:text-red-200">x</button></div>`;
        });

        container.classList.toggle('hidden', !hasFilters);
    };

    const toggleQuickFilter = (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('quickFilterDropdown');
        const valuesDropdown = document.getElementById('quickFilterValuesDropdown');
        if (!dropdown || !valuesDropdown) return;

        valuesDropdown.classList.add('hidden');
        if (dropdown.classList.contains('hidden')) {
            const filterCategories = [
                { key: 'bean', label: 'Bean' },
                { key: 'coffeeType', label: 'Coffee' },
                { key: 'gear', label: 'Gear' },
                { key: 'hasGraph', label: 'Graph' },
                { key: 'method', label: 'Method' },
                { key: 'drink', label: 'Drink' },
                { key: 'roaster', label: 'Roaster' },
                { key: 'origin', label: 'Origin' },
                { key: 'farmer', label: 'Blend/Farmer' },
                { key: 'variety', label: 'Variety' },
                { key: 'processing', label: 'Process' },
                { key: 'decaf', label: 'Decaf' },
                { key: 'roastType', label: 'Roast type' },
                { key: 'grinder', label: 'Grinder' },
                { key: 'temp', label: 'Temperature' }
            ];
            const activeFilters = getActiveFilters();
            let html = '<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c]">Filter by</div>';
            filterCategories.forEach((cat) => {
                const isActive = activeFilters[cat.key] !== null;
                const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                html += `<button data-action-click="openQuickFilterValues(event, '${cat.key}', '${cat.label}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] flex items-center justify-between ${activeClass}"><span>${cat.label}</span>${
                    isActive
                        ? '<i class="fa-solid fa-check text-coffee-600 dark:text-[#a8a29e] text-xs"></i>'
                        : '<i class="fa-solid fa-chevron-right text-coffee-300 dark:text-[#57534e] text-xs"></i>'
                }</button>`;
            });
            dropdown.innerHTML = html;
            dropdown.classList.remove('hidden');
        } else {
            dropdown.classList.add('hidden');
        }
    };

    const openQuickFilterValues = (e, key, label) => {
        e.stopPropagation();
        const valuesDropdown = document.getElementById('quickFilterValuesDropdown');
        const mainDropdown = document.getElementById('quickFilterDropdown');
        if (!valuesDropdown || !mainDropdown) return;

        const uniqueValues = selectBrewsQuickFilterValues({
            key,
            coffees: getCoffees(),
            beans: getBeans(),
            coffeeTypes: getCoffeeTypes(),
            gasItems: getGasItems(),
            formatBeanOpenedDate
        });

        if (!uniqueValues.length) {
            valuesDropdown.innerHTML = '<div class="px-4 py-3 text-sm text-coffee-400 dark:text-[#78716c] italic">No values available</div>';
        } else {
            let html = `<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between"><span>${label}</span><button data-action-click="toggleQuickFilter(event)" class="text-coffee-400 hover:text-coffee-600 dark:hover:text-white"><i class="fa-solid fa-arrow-left"></i></button></div>`;
            html += `<button data-action-click="applyFilterFromQuick('${key}', null)" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] font-bold text-coffee-700 dark:text-[#d6ccc2]">All</button>`;
            if (key === 'bean' || key === 'coffeeType' || key === 'gear') {
                uniqueValues.forEach((item) => {
                    const isActive = getActiveFilters()[key] === item.id;
                    const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e]' : '';
                    const escapedId = String(item.id).replace(/'/g, "\\'");
                    html += `<button data-action-click="applyFilterFromQuick('${key}', '${escapedId}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-600 dark:text-[#a8a29e] ${activeClass}">${item.display}</button>`;
                });
            } else {
                uniqueValues.forEach((value) => {
                    const isActive = getActiveFilters()[key] === value;
                    const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e]' : '';
                    const escapedValue = String(value).replace(/'/g, "\\'");
                    html += `<button data-action-click="applyFilterFromQuick('${key}', '${escapedValue}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-600 dark:text-[#a8a29e] ${activeClass}">${value}</button>`;
                });
            }
            valuesDropdown.innerHTML = html;
        }

        mainDropdown.classList.add('hidden');
        valuesDropdown.classList.remove('hidden');
    };

    const applyFilterFromQuick = (key, value) => {
        applyFilter(key, value);
        document.getElementById('quickFilterDropdown')?.classList.add('hidden');
        document.getElementById('quickFilterValuesDropdown')?.classList.add('hidden');
    };

    const getFilteredCoffees = () => {
        const searchInput = document.getElementById('globalSearch');
        return selectFilteredSortedBrews({
            coffees: getCoffees(),
            searchTerm: searchInput?.value || '',
            activeFilters: getActiveFilters(),
            currentSort: getCurrentSort(),
            getCoffeeTypeDisplay,
            getCoffeeTypeForBrew
        });
    };

    const getTempBadge = (temp) => {
        if (!temp) return '-';
        if (!isNaN(parseFloat(temp)) && isFinite(temp)) {
            let cls = 'bg-gray-100 dark:bg-gray-800';
            if (temp < 90) cls = 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300';
            else if (temp < 94) cls = 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300';
            else cls = 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300';
            return `<span class="inline-flex items-center justify-center px-2 py-1 rounded-md ${cls} text-xs font-bold shadow-sm pointer-events-none select-none font-mono">${temp}°C</span>`;
        }
        const map = {
            L4: 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-300',
            L3: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300',
            L2: 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/20 dark:text-blue-200',
            L1: 'bg-cyan-50 text-cyan-600 border-cyan-100 dark:bg-cyan-900/20 dark:text-cyan-200',
            M: 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-200',
            H1: 'bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/20 dark:text-orange-200',
            H2: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-200',
            H3: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300',
            H4: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300'
        };
        return `<span class="inline-flex items-center justify-center w-8 h-8 rounded-full ${map[temp] || 'bg-gray-100'} text-xs font-bold shadow-sm pointer-events-none select-none">${temp}</span>`;
    };

    const refreshTableData = (el) => {
        const icon = el?.querySelector('i');
        if (icon) icon.classList.add('fa-spin');
        setCurrentSort({ key: null, direction: 'asc' });
        updateBrewSortIcons();
        setActiveFilters({
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
        });
        const searchInput = document.getElementById('globalSearch');
        if (searchInput) {
            searchInput.value = '';
            document.getElementById('searchClearBtn')?.classList.add('hidden');
        }
        renderActiveFilters();
        setDisplayedBrewsCount(getBrewsPerPage());
        changeView(getCurrentView());
        setTimeout(() => {
            if (icon) icon.classList.remove('fa-spin');
        }, 800);
    };

    const generateRow = (brew) => {
        const showManualPinning = !getPinnedBrewsPreferences?.()?.pinOpenBags;
        const typeDisplay = getCoffeeTypeDisplay(brew);
        const rowDisplay = brewsVm.buildTableRowDisplayModel({
            brew,
            typeDisplay,
            showManualPinning
        });

        const menuId = `action-menu-${brew.id}`;
        let actions = '';

        if (getCurrentView() === 'mine') {
            const pinLabel = brew.isActive ? 'Unpin' : 'Pin to active';
            const pinIcon = brew.isActive ? 'fa-thumbtack text-green-600' : 'fa-thumbtack text-gray-400';
            const pinAction = showManualPinning
                ? `<button data-action-click="toggleActive('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid ${pinIcon} w-4"></i> ${pinLabel}</button>`
                : '';
            actions = `<div class="relative"><button data-action-click="brewsToggleActionMenu('${menuId}', event)" class="p-0 text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]"><i class="fa-solid fa-ellipsis-vertical text-lg"></i></button><div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden"><button data-action-click="brewsOpenCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card</button><button data-action-click="editCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-pencil text-blue-500 w-4"></i> Edit</button><button data-action-click="fastRepeatCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-bolt text-amber-500 w-4"></i> Fast repeat</button><button data-action-click="duplicateCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-regular fa-copy text-green-500 w-4"></i> Repeat</button>${pinAction}<button data-action-click="openUploadModal('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-camera text-purple-500 w-4"></i> Upload photo</button><button data-action-click="showBeanForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button><button data-action-click="showCoffeeForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button><button data-action-click="shareCoffeeCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-share-nodes text-purple-500 w-4"></i> Share card</button><hr class="border-coffee-100 dark:border-[#44403c]"><button data-action-click="deleteCoffee('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3"><i class="fa-solid fa-trash w-4"></i> Delete</button></div></div>`;
        } else {
            actions = `<div class="relative"><button data-action-click="brewsToggleActionMenu('${menuId}', event)" class="p-0 text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]"><i class="fa-solid fa-ellipsis-vertical text-lg"></i></button><div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden"><button data-action-click="brewsOpenCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card</button><button data-action-click="shareCoffeeCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-share-nodes text-purple-500 w-4"></i> Share card</button><button data-action-click="showBeanForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button><button data-action-click="showCoffeeForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button><button data-action-click="cloneBrew('${brew.id}'); event.stopPropagation();" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-file-import text-green-500 w-4"></i> Clone to my brews</button></div></div>`;
        }

        const columnPreferences = getColumnPreferences();
        const rowHtml = brewsVm.buildTableRowHtml({
            brew,
            typeDisplay,
            rowDisplay,
            columnPreferences,
            timeText: formatTime(brew.time),
            tempBadgeHtml: getTempBadge(brew.temp),
            ratingHtml: getStarDisplay(brew.rating),
            actionsHtml: actions
        });

        const row = document.createElement('tr');
        row.className = 'bg-white dark:bg-[#292524] hover:bg-coffee-50 dark:hover:bg-[#1c1917] border-b border-coffee-100 dark:border-[#44403c] last:border-b-0 cursor-pointer';
        row.ondblclick = (e) => openBrewCard(brew.id, e);
        row.setAttribute('data-id', brew.id);
        row.innerHTML = rowHtml;
        return row;
    };

    const renderTable = () => {
        const tableBody = document.getElementById('coffeeTableBody');
        const empty = document.getElementById('emptyState');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (!tableBody || !empty) return;

        updateBrewSortIcons();
        const showManualPinning = !getPinnedBrewsPreferences?.()?.pinOpenBags;
        const manualPinHeader = document.getElementById('th-manualPin');
        if (manualPinHeader) manualPinHeader.classList.toggle('hidden', !showManualPinning);
        getColumnDefs().forEach((col) => {
            const th = document.getElementById(`th-${col.id}`);
            if (!th) return;
            if (getColumnPreferences()[col.id] === false) th.classList.add('hidden');
            else th.classList.remove('hidden');
        });

        tableBody.innerHTML = '';
        const filteredCoffees = getFilteredCoffees();
        if (filteredCoffees.length === 0) {
            loadMoreContainer?.classList.add('hidden');
            empty.classList.remove('hidden');
            return;
        }
        empty.classList.add('hidden');

        const historyBrews = [...filteredCoffees];
        if (historyBrews.length > 0) {
            const displayLimit = Math.min(getDisplayedBrewsCount(), historyBrews.length);
            for (let i = 0; i < displayLimit; i += 1) {
                tableBody.appendChild(generateRow(historyBrews[i]));
            }
            const remainingCount = historyBrews.length - displayLimit;
            if (loadMoreContainer) {
                if (remainingCount > 0) {
                    loadMoreContainer.classList.remove('hidden');
                    const remainingEl = document.getElementById('remainingCount');
                    if (remainingEl) remainingEl.textContent = remainingCount;
                } else {
                    loadMoreContainer.classList.add('hidden');
                }
            }
        } else {
            document.getElementById('loadMoreContainer')?.classList.add('hidden');
        }
    };

    const loadMoreBrews = () => {
        setDisplayedBrewsCount(getDisplayedBrewsCount() + getBrewsPerPage());
        renderTable();
    };

    return {
        clearSearch,
        getFilterLabel,
        updateBrewSortIcons,
        sortBy,
        openFilterMenu,
        applyFilter,
        clearAllFilters,
        renderActiveFilters,
        toggleQuickFilter,
        openQuickFilterValues,
        applyFilterFromQuick,
        getFilteredCoffees,
        getTempBadge,
        refreshTableData,
        renderTable,
        loadMoreBrews
    };
};
