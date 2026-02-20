import { createCoffeesVmModule } from './coffees.vm.js';
import {
    createDefaultCoffeeTypeFilters,
    selectCoffeeTypesQuickFilterValues,
    selectFilteredSortedCoffeeTypes
} from '../../app/stores/coffee-types-table.selectors.js';

export const createCoffeeTypesTableModule = ({
    getCoffeeTypes,
    getBeans,
    getCoffees,
    getCurrentView,
    getCoffeeTypesSearch,
    setCoffeeTypesSearchState,
    getCoffeeTypesFilters,
    setCoffeeTypesFiltersState,
    getCoffeeTypesSortKey,
    setCoffeeTypesSortKeyState,
    getCoffeeTypesSortDir,
    setCoffeeTypesSortDirState,
    getStarDisplay,
    openCoffeeTypeCard
}) => {
    const coffeesVm = createCoffeesVmModule();
    const setCoffeeTypesSearch = (value) => {
        setCoffeeTypesSearchState(value || '');
        const clearBtn = document.getElementById('coffeeTypesSearchClearBtn');
        if (clearBtn) clearBtn.classList.toggle('hidden', getCoffeeTypesSearch().length === 0);
        renderCoffeeTypesTable();
    };

    const clearCoffeeTypesSearch = () => {
        const input = document.getElementById('coffeeTypesSearch');
        if (input) input.value = '';
        setCoffeeTypesSearch('');
        input?.focus();
    };

    const toggleCoffeeTypesQuickFilter = (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('coffeeTypesQuickFilterDropdown');
        const valuesDropdown = document.getElementById('coffeeTypesQuickFilterValuesDropdown');
        if (!dropdown || !valuesDropdown) return;

        valuesDropdown.classList.add('hidden');

        if (dropdown.classList.contains('hidden')) {
            const filterCategories = [
                { key: 'farmer', label: 'Farmer' },
                { key: 'roaster', label: 'Roaster' },
                { key: 'origin', label: 'Origin' },
                { key: 'processing', label: 'Process' },
                { key: 'decaf', label: 'Decaf' },
                { key: 'variety', label: 'Variety' },
                { key: 'roast', label: 'Roast' }
            ];
            const filters = getCoffeeTypesFilters();
            let html = '<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c]">Filter by</div>';
            filterCategories.forEach((cat) => {
                const isActive = filters[cat.key] !== null;
                const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                html += `<button data-action-click="openCoffeeTypesQuickFilterValues(event, '${cat.key}', '${cat.label}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] flex items-center justify-between ${activeClass}">
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

    const openCoffeeTypesQuickFilterValues = (e, key, label) => {
        e.stopPropagation();
        const valuesDropdown = document.getElementById('coffeeTypesQuickFilterValuesDropdown');
        const mainDropdown = document.getElementById('coffeeTypesQuickFilterDropdown');
        if (!valuesDropdown || !mainDropdown) return;

        const uniqueVals = selectCoffeeTypesQuickFilterValues({
            key,
            coffeeTypes: getCoffeeTypes()
        });

        if (!uniqueVals.length) {
            valuesDropdown.innerHTML = '<div class="px-4 py-3 text-sm text-coffee-400 dark:text-[#78716c] italic">No values available</div>';
        } else {
            const filters = getCoffeeTypesFilters();
            let html = `<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between">
                <span>${label}</span>
                <button data-action-click="toggleCoffeeTypesQuickFilter(event)" class="text-coffee-400 hover:text-coffee-600 dark:hover:text-white">
                    <i class="fa-solid fa-arrow-left"></i>
                </button>
            </div>`;
            html += `<button data-action-click="applyCoffeeTypesFilterFromQuick('${key}', null)" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] font-bold text-coffee-700 dark:text-[#d6ccc2]">All</button>`;
            uniqueVals.forEach((val) => {
                const isActive = filters[key] === val;
                const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e]' : '';
                const escapedVal = String(val).replace(/'/g, "\\'");
                html += `<button data-action-click="applyCoffeeTypesFilterFromQuick('${key}', '${escapedVal}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-600 dark:text-[#a8a29e] ${activeClass}">
                    ${val}
                </button>`;
            });
            valuesDropdown.innerHTML = html;
        }

        mainDropdown.classList.add('hidden');
        valuesDropdown.classList.remove('hidden');
    };

    const applyCoffeeTypesFilterFromQuick = (key, value) => {
        setCoffeeTypesFiltersState({ ...getCoffeeTypesFilters(), [key]: value });
        const dropdown = document.getElementById('coffeeTypesQuickFilterDropdown');
        const valuesDropdown = document.getElementById('coffeeTypesQuickFilterValuesDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        if (valuesDropdown) valuesDropdown.classList.add('hidden');
        renderCoffeeTypesActiveFilters();
        renderCoffeeTypesTable();
    };

    const clearCoffeeTypesFilters = () => {
        setCoffeeTypesFiltersState(createDefaultCoffeeTypeFilters());
        setCoffeeTypesSearchState('');
        const input = document.getElementById('coffeeTypesSearch');
        if (input) input.value = '';
        document.getElementById('coffeeTypesSearchClearBtn')?.classList.add('hidden');
        renderCoffeeTypesActiveFilters();
        renderCoffeeTypesTable();
    };

    const renderCoffeeTypesActiveFilters = () => {
        const container = document.getElementById('coffeeTypesActiveFiltersContainer');
        const list = document.getElementById('coffeeTypesActiveFiltersList');
        if (!container || !list) return;

        list.innerHTML = '';
        let hasFilters = false;
        const labelMap = {
            farmer: 'Farmer',
            roaster: 'Roaster',
            origin: 'Origin',
            processing: 'Process',
            decaf: 'Decaf',
            variety: 'Variety',
            roast: 'Roast'
        };
        Object.entries(getCoffeeTypesFilters()).forEach(([key, value]) => {
            if (!value) return;
            hasFilters = true;
            const label = labelMap[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase());
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>${label}:</span><b>${value}</b><button data-action-click="applyCoffeeTypesFilterFromQuick('${key}', null)" class="ml-1 hover:text-red-200">x</button></div>`;
        });
        container.classList.toggle('hidden', !hasFilters);
    };

    const setCoffeeTypesSort = (key) => {
        if (getCoffeeTypesSortKey() === key) {
            setCoffeeTypesSortDirState(getCoffeeTypesSortDir() === 'asc' ? 'desc' : 'asc');
        } else {
            setCoffeeTypesSortKeyState(key);
            setCoffeeTypesSortDirState('asc');
        }
        renderCoffeeTypesTable();
    };

    const updateCoffeeTypesSortIcons = () => {
        const keys = ['farmer', 'roaster', 'origin', 'processing', 'decaf', 'variety', 'roast', 'brews', 'bags', 'ground', 'rating', 'createdAt'];
        const sortKey = getCoffeeTypesSortKey();
        const sortDir = getCoffeeTypesSortDir();
        keys.forEach((key) => {
            const el = document.getElementById(`coffeeTypesSortIcon-${key}`);
            if (!el) return;
            if (sortKey !== key) {
                el.textContent = '';
                return;
            }
            el.textContent = sortDir === 'asc' ? '▲' : '▼';
        });
    };

    const getFilteredSortedCoffeeTypes = () => {
        const beanToCoffeeTypeId = new Map();
        const bagCountByCoffeeTypeId = new Map();
        const groundKgByCoffeeTypeId = new Map();
        getBeans().forEach((bean) => {
            if (!bean?.id || !bean?.coffeeTypeId) return;
            beanToCoffeeTypeId.set(bean.id, bean.coffeeTypeId);
            bagCountByCoffeeTypeId.set(bean.coffeeTypeId, (bagCountByCoffeeTypeId.get(bean.coffeeTypeId) || 0) + 1);
            const stockGrams = Number.parseFloat(bean.stock);
            if (Number.isFinite(stockGrams)) {
                groundKgByCoffeeTypeId.set(bean.coffeeTypeId, (groundKgByCoffeeTypeId.get(bean.coffeeTypeId) || 0) + (stockGrams / 1000));
            }
        });
        const brewCountByCoffeeTypeId = new Map();
        getCoffees().forEach((brew) => {
            let coffeeTypeId = brew?.coffeeTypeId || null;
            if (!coffeeTypeId && brew?.beanId) {
                coffeeTypeId = beanToCoffeeTypeId.get(brew.beanId) || null;
            }
            if (!coffeeTypeId) return;
            brewCountByCoffeeTypeId.set(coffeeTypeId, (brewCountByCoffeeTypeId.get(coffeeTypeId) || 0) + 1);
        });
        const coffeeTypesWithCounts = getCoffeeTypes().map((type) => ({
            ...type,
            brewsCount: brewCountByCoffeeTypeId.get(type.id) || 0,
            bagsCount: bagCountByCoffeeTypeId.get(type.id) || 0,
            groundKg: groundKgByCoffeeTypeId.get(type.id) || 0
        }));
        return selectFilteredSortedCoffeeTypes({
            coffeeTypes: coffeeTypesWithCounts,
            searchValue: getCoffeeTypesSearch(),
            filters: getCoffeeTypesFilters(),
            sortKey: getCoffeeTypesSortKey(),
            sortDir: getCoffeeTypesSortDir()
        });
    };

    const renderCoffeeTypesTable = () => {
        const tbody = document.getElementById('coffeeTypesTableBody');
        const empty = document.getElementById('coffeeTypesEmpty');
        if (!tbody || !empty) return;

        tbody.innerHTML = '';
        renderCoffeeTypesActiveFilters();
        const isMine = getCurrentView() === 'mine';
        const coffeeTypes = getCoffeeTypes();

        if (!coffeeTypes.length) {
            empty.classList.remove('hidden');
            return;
        }

        const sortedTypes = getFilteredSortedCoffeeTypes();
        if (!sortedTypes.length) {
            empty.classList.remove('hidden');
            updateCoffeeTypesSortIcons();
            return;
        }
        empty.classList.add('hidden');

        sortedTypes.forEach((type) => {
            const rowVm = coffeesVm.toTableRow(type);
            const roaster = rowVm.roaster;
            const farmer = rowVm.farmer;
            const origin = rowVm.origin;
            const processing = rowVm.processing;
            const variety = rowVm.variety;
            const roast = rowVm.roast;
            const rating = rowVm.rating;
            const createdAt = rowVm.createdAt;
            const decaf = rowVm.decaf;
            const brewsCount = Number(type.brewsCount) || 0;
            const bagsCount = Number(type.bagsCount) || 0;
            const groundKg = Number(type.groundKg) || 0;
            const decafIcon = decaf
                ? '<i class="fa-solid fa-moon text-[11px] text-coffee-500 dark:text-[#a8a29e]" title="Decaf"></i>'
                : '';
            const menuId = `coffee-types-action-menu-${type.id}`;
            const buyBtn = (type.webshopUrl || type.shopUrl)
                ? `<button data-action-click="openCoffeeTypeShopUrl('${type.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                        <i class="fa-solid fa-cart-shopping text-emerald-600 w-4"></i> Buy
                   </button>`
                : '';

            const row = document.createElement('tr');
            row.setAttribute('data-id', type.id);
            row.className = 'bg-white dark:bg-[#292524] border-b border-coffee-100 dark:border-[#44403c] last:border-b-0';
            row.ondblclick = (event) => openCoffeeTypeCard(type.id, event);
            row.innerHTML = `
                <td class="px-4 py-3 text-sm">${farmer}</td>
                <td class="px-4 py-3 font-semibold">${roaster}</td>
                <td class="px-4 py-3 text-sm">${origin}</td>
                <td class="px-4 py-3 text-sm">${processing}</td>
                <td class="px-4 py-3 text-center">${decafIcon}</td>
                <td class="px-4 py-3 text-sm">${variety}</td>
                <td class="px-4 py-3 text-center text-sm">${roast}</td>
                <td class="px-4 py-3 text-center font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${brewsCount}</td>
                <td class="px-4 py-3 text-center font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${bagsCount}</td>
                <td class="px-4 py-3 text-center font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${groundKg.toFixed(2)} kg</td>
                <td class="px-4 py-3 text-center whitespace-nowrap">${getStarDisplay(rating)}</td>
                <td class="px-4 py-3 text-center text-xs font-mono text-coffee-500">${createdAt}</td>
                <td class="px-4 py-3 text-center">
                    <div class="relative inline-block">
                        <button data-action-click="coffeesToggleActionMenu('${menuId}', event)" class="p-1.5 text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]">
                            <i class="fa-solid fa-ellipsis-vertical text-lg"></i>
                        </button>
                        <div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden">
                            <button data-action-click="openCoffeeTypeCard('${type.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                <i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card
                            </button>
                            ${isMine ? `<button data-action-click="openCoffeeTypeFromTableEdit('${type.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                <i class="fa-solid fa-pen-to-square text-blue-500 w-4"></i> Edit
                            </button>` : ''}
                            ${buyBtn}
                            ${isMine ? `<button data-action-click="openNewBagForCoffeeTypeFromTable('${type.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                <i class="fa-solid fa-bag-shopping text-sky-600 w-4"></i> Open bag
                            </button>` : ''}
                            <button data-action-click="showBeansForCoffeeTypeFromTable('${type.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                <i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to beans
                            </button>
                            <button data-action-click="showBrewsForCoffeeTypeFromTable('${type.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                                <i class="fa-solid fa-mug-saucer text-indigo-600 w-4"></i> Go to brews
                            </button>
                            ${isMine ? `<hr class="border-coffee-100 dark:border-[#44403c]">
                            <button data-action-click="deleteCoffeeTypeFromTable('${type.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3">
                                <i class="fa-solid fa-trash w-4"></i> Delete
                            </button>` : ''}
                        </div>
                    </div>
                </td>
            `;
            tbody.appendChild(row);
        });
        updateCoffeeTypesSortIcons();
    };

    return {
        setCoffeeTypesSearch,
        clearCoffeeTypesSearch,
        toggleCoffeeTypesQuickFilter,
        openCoffeeTypesQuickFilterValues,
        applyCoffeeTypesFilterFromQuick,
        clearCoffeeTypesFilters,
        renderCoffeeTypesActiveFilters,
        setCoffeeTypesSort,
        updateCoffeeTypesSortIcons,
        getFilteredSortedCoffeeTypes,
        renderCoffeeTypesTable,
        createDefaultCoffeeTypesFilters: createDefaultCoffeeTypeFilters
    };
};
