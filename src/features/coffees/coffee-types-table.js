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
    getPinnedBrewsPreferences,
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
    dispatchCommand
}) => {
    const coffeesVm = createCoffeesVmModule();
    let hasBoundResponsiveTableListener = false;
    let lastCompactMobileMode = null;
    let resizeRafId = null;
    let quickFilterActiveTab = 'sort';
    let coffeeTypesSortChain = null;
    const escapeHtml = (value) =>
        String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
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
    const getSortChain = () => {
        if (!coffeeTypesSortChain) {
            coffeeTypesSortChain = normalizeSortChain({
                key: getCoffeeTypesSortKey(),
                direction: getCoffeeTypesSortDir()
            });
        }
        return [...coffeeTypesSortChain];
    };
    const setSortChain = (nextChain = []) => {
        const normalized = normalizeSortChain(nextChain);
        coffeeTypesSortChain = normalized;
        const primary = normalized[0] || { key: 'createdAt', direction: 'desc' };
        setCoffeeTypesSortKeyState(primary.key);
        setCoffeeTypesSortDirState(primary.direction);
    };
    const getSortableFields = () => ([
        { key: 'farmer', label: 'Farmer' },
        { key: 'roaster', label: 'Roaster' },
        { key: 'origin', label: 'Origin' },
        { key: 'processing', label: 'Process' },
        { key: 'decaf', label: 'Decaf' },
        { key: 'variety', label: 'Variety' },
        { key: 'roast', label: 'Roast' },
        { key: 'brews', label: 'Brews' },
        { key: 'bags', label: 'Bags' },
        { key: 'ground', label: 'Ground' },
        { key: 'rating', label: 'Rating' },
        { key: 'createdAt', label: 'Created' }
    ]);

    const isCompactMobileTableMode = () => {
        const prefersLegacyMobile = getPinnedBrewsPreferences?.()?.useLegacyMobileTable === true;
        const isMobileViewport = typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
        return !prefersLegacyMobile && isMobileViewport;
    };

    const ensureResponsiveTableListener = () => {
        if (hasBoundResponsiveTableListener || typeof window === 'undefined') return;
        hasBoundResponsiveTableListener = true;
        const media = window.matchMedia('(max-width: 767px)');
        lastCompactMobileMode = isCompactMobileTableMode();

        const scheduleCheck = () => {
            if (resizeRafId !== null) window.cancelAnimationFrame(resizeRafId);
            resizeRafId = window.requestAnimationFrame(() => {
                resizeRafId = null;
                const nextMode = isCompactMobileTableMode();
                if (nextMode === lastCompactMobileMode) return;
                lastCompactMobileMode = nextMode;
                renderCoffeeTypesTable();
            });
        };

        if (typeof media.addEventListener === 'function') media.addEventListener('change', scheduleCheck);
        else if (typeof media.addListener === 'function') media.addListener(scheduleCheck);
        window.addEventListener('resize', scheduleCheck);
        window.addEventListener('orientationchange', scheduleCheck);
    };

    const buildTypePhotoHtml = (type) => {
        const imageUrl = type?.imageUrl || type?.imageURL || '';
        if (imageUrl) {
            return `<img src="${imageUrl}" alt="Coffee image" class="w-12 h-12 rounded-lg object-cover border border-coffee-200 dark:border-[#44403c]" loading="lazy">`;
        }
        return '<div class="w-12 h-12 rounded-lg bg-coffee-100 dark:bg-[#34302e] border border-coffee-200 dark:border-[#44403c] flex items-center justify-center text-coffee-400 dark:text-[#78716c]"><i class="fa-solid fa-mug-saucer text-sm"></i></div>';
    };

    const buildTypeActionsMenuHtml = ({ type, menuId, isMine, buyBtn }) => `
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
    `;
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
        if (!dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            return;
        }

        const sortOptions = getSortableFields();
        const filterCategories = [
            { key: 'farmer', label: 'Farmer' },
            { key: 'roaster', label: 'Roaster' },
            { key: 'origin', label: 'Origin' },
            { key: 'processing', label: 'Process' },
            { key: 'decaf', label: 'Decaf' },
            { key: 'variety', label: 'Variety' },
            { key: 'roast', label: 'Roast' }
        ];
        const sortChain = getSortChain();
        const filters = getCoffeeTypesFilters();
        let html = '<div class="px-3 py-2 border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between gap-2">';
        html += '<div class="inline-flex items-center gap-1 bg-coffee-100 dark:bg-[#1c1917] rounded p-0.5">';
        html += '<button type="button" data-quick-tab="sort" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold bg-white dark:bg-[#292524] text-coffee-800 dark:text-white">Sort</button>';
        html += '<button type="button" data-quick-tab="filter" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold text-coffee-600 dark:text-[#a8a29e]">Filter</button>';
        html += '</div>';
        html += '<button type="button" data-action-click="toggleCoffeeTypesQuickFilter(event)" class="w-11 h-11 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-coffee-600 dark:text-[#a8a29e] hover:bg-coffee-50 dark:hover:bg-[#34302e] flex items-center justify-center" title="Close"><i class="fa-solid fa-xmark text-[11px]"></i></button>';
        html += '</div>';

        html += '<div id="coffeeTypesQuickSortPanel" class="px-3 py-2 grid grid-cols-2 gap-1.5">';
        html += '<div class="col-span-2 text-[10px] font-bold text-coffee-400 dark:text-[#78716c] uppercase">Sort chain</div>';
        html += '<div class="col-span-2 space-y-1">';
        if (!sortChain.length) {
            html += '<div class="text-[11px] text-coffee-500 dark:text-[#78716c] italic">No sort fields selected.</div>';
        } else {
            sortChain.forEach((item, idx) => {
                const field = sortOptions.find((option) => option.key === item.key);
                const label = field?.label || item.key;
                const dirLabel = item.direction === 'asc' ? 'Asc' : 'Desc';
                html += `<div class="flex items-center gap-1 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] px-2 py-1.5">
                    <span class="text-[10px] w-4 text-center text-coffee-400 dark:text-[#78716c]">${idx + 1}</span>
                    <span class="flex-1 text-xs text-coffee-800 dark:text-[#d6ccc2] truncate">${escapeHtml(label)}</span>
                    <button type="button" data-quick-sort-toggle="${escapeHtml(item.key)}" class="px-1.5 py-0.5 rounded border border-coffee-200 dark:border-[#44403c] text-[10px]">${dirLabel}</button>
                    <button type="button" data-quick-sort-up="${escapeHtml(item.key)}" aria-label="Move sort field up" title="Move up" class="w-11 h-11 rounded border border-coffee-200 dark:border-[#44403c] text-[10px] ${idx === 0 ? 'opacity-40 cursor-not-allowed' : ''}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" data-quick-sort-down="${escapeHtml(item.key)}" aria-label="Move sort field down" title="Move down" class="w-11 h-11 rounded border border-coffee-200 dark:border-[#44403c] text-[10px] ${idx === sortChain.length - 1 ? 'opacity-40 cursor-not-allowed' : ''}" ${idx === sortChain.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" data-quick-sort-remove="${escapeHtml(item.key)}" aria-label="Remove sort field" title="Remove" class="w-11 h-11 rounded border border-coffee-200 dark:border-[#44403c] text-red-500 text-[10px]"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
            });
        }
        html += '</div>';
        const availableToAdd = sortOptions.filter((option) => !sortChain.some((item) => item.key === option.key));
        html += '<div class="col-span-2 grid grid-cols-[1fr_auto] gap-1.5 pt-1">';
        html += '<select id="coffeeTypesQuickSortAddSelect" aria-label="Add coffee sort field" class="w-full px-2 py-1.5 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-xs text-coffee-900 dark:text-white">';
        html += '<option value="">Add field...</option>';
        availableToAdd.forEach((option) => {
            html += `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`;
        });
        html += '</select>';
        html += '<button type="button" id="coffeeTypesQuickSortAddBtn" class="px-2 py-1.5 rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white text-xs font-bold">Add</button>';
        html += '</div>';
        html += '</div>';

        html += '<div id="coffeeTypesQuickFilterPanel" class="hidden pb-2">';
        filterCategories.forEach((cat) => {
            const isActive = filters[cat.key] !== null;
            const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
            html += `<button data-action-click="openCoffeeTypesQuickFilterValues(event, '${cat.key}', '${cat.label}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] flex items-center justify-between ${activeClass}">
                <span>${cat.label}</span>
                ${isActive ? '<i class="fa-solid fa-check text-coffee-600 dark:text-[#a8a29e] text-xs"></i>' : '<i class="fa-solid fa-chevron-right text-coffee-300 dark:text-[#57534e] text-xs"></i>'}
            </button>`;
        });
        html += '</div>';
        dropdown.innerHTML = html;

        const tabButtons = Array.from(dropdown.querySelectorAll('[data-quick-tab]'));
        const tabPanels = {
            sort: document.getElementById('coffeeTypesQuickSortPanel'),
            filter: document.getElementById('coffeeTypesQuickFilterPanel')
        };
        const activateTab = (tabId) => {
            const normalizedTabId = tabId === 'filter' ? 'filter' : 'sort';
            quickFilterActiveTab = normalizedTabId;
            Object.entries(tabPanels).forEach(([id, panel]) => {
                if (!panel) return;
                panel.classList.toggle('hidden', id !== normalizedTabId);
            });
            tabButtons.forEach((btn) => {
                const isActive = btn.getAttribute('data-quick-tab') === normalizedTabId;
                btn.classList.toggle('bg-white', isActive);
                btn.classList.toggle('dark:bg-[#292524]', isActive);
                btn.classList.toggle('text-coffee-800', isActive);
                btn.classList.toggle('dark:text-white', isActive);
                btn.classList.toggle('text-coffee-600', !isActive);
                btn.classList.toggle('dark:text-[#a8a29e]', !isActive);
            });
        };
        tabButtons.forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                activateTab(btn.getAttribute('data-quick-tab') || 'sort');
            });
        });

        const rerenderOpenPanel = () => {
            const syntheticEvent = { stopPropagation: () => {} };
            dropdown.classList.add('hidden');
            toggleCoffeeTypesQuickFilter(syntheticEvent);
        };

        const sortAddBtn = document.getElementById('coffeeTypesQuickSortAddBtn');
        const sortAddSelect = document.getElementById('coffeeTypesQuickSortAddSelect');
        sortAddBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            const key = sortAddSelect?.value || '';
            if (!key) return;
            setSortChain([...sortChain, { key, direction: 'asc' }]);
            renderCoffeeTypesTable();
            rerenderOpenPanel();
        });
        dropdown.querySelectorAll('[data-quick-sort-toggle]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-toggle') || '';
                if (!key) return;
                const next = sortChain.map((item) => item.key === key ? { ...item, direction: item.direction === 'asc' ? 'desc' : 'asc' } : item);
                setSortChain(next);
                renderCoffeeTypesTable();
                rerenderOpenPanel();
            });
        });
        dropdown.querySelectorAll('[data-quick-sort-remove]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-remove') || '';
                if (!key) return;
                setSortChain(sortChain.filter((item) => item.key !== key));
                renderCoffeeTypesTable();
                rerenderOpenPanel();
            });
        });
        dropdown.querySelectorAll('[data-quick-sort-up]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-up') || '';
                const idx = sortChain.findIndex((item) => item.key === key);
                if (idx <= 0) return;
                const next = [...sortChain];
                const tmp = next[idx - 1];
                next[idx - 1] = next[idx];
                next[idx] = tmp;
                setSortChain(next);
                renderCoffeeTypesTable();
                rerenderOpenPanel();
            });
        });
        dropdown.querySelectorAll('[data-quick-sort-down]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-down') || '';
                const idx = sortChain.findIndex((item) => item.key === key);
                if (idx < 0 || idx >= sortChain.length - 1) return;
                const next = [...sortChain];
                const tmp = next[idx + 1];
                next[idx + 1] = next[idx];
                next[idx] = tmp;
                setSortChain(next);
                renderCoffeeTypesTable();
                rerenderOpenPanel();
            });
        });

        activateTab(quickFilterActiveTab);
        dropdown.classList.remove('hidden');
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
                <button data-action-click="toggleCoffeeTypesQuickFilter(event)" class="w-11 h-11 flex items-center justify-center text-coffee-400 hover:text-coffee-600 dark:hover:text-white">
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
        quickFilterActiveTab = 'filter';
        const syntheticEvent = { stopPropagation: () => {} };
        toggleCoffeeTypesQuickFilter(syntheticEvent);
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
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>${label}:</span><b>${value}</b><button data-action-click="applyCoffeeTypesFilterFromQuick('${key}', null)" aria-label="Remove filter" title="Remove filter" class="ml-1 hover:text-red-200">x</button></div>`;
        });
        container.classList.toggle('hidden', !hasFilters);
    };

    const setCoffeeTypesSort = (key) => {
        const sortChain = getSortChain();
        const existingIndex = sortChain.findIndex((item) => item.key === key);
        if (existingIndex < 0) {
            setSortChain([{ key, direction: 'asc' }, ...sortChain]);
        } else if (existingIndex === 0) {
            const next = [...sortChain];
            if (next[0].direction === 'asc') {
                next[0] = { ...next[0], direction: 'desc' };
                setSortChain(next);
            } else {
                setSortChain(next.slice(1));
            }
        } else {
            const withoutKey = sortChain.filter((item) => item.key !== key);
            setSortChain([{ key, direction: 'asc' }, ...withoutKey]);
        }
        renderCoffeeTypesTable();
    };

    const updateCoffeeTypesSortIcons = () => {
        const keys = ['farmer', 'roaster', 'origin', 'processing', 'decaf', 'variety', 'roast', 'brews', 'bags', 'ground', 'rating', 'createdAt'];
        const sortChain = getSortChain();
        keys.forEach((key) => {
            const el = document.getElementById(`coffeeTypesSortIcon-${key}`);
            if (!el) return;
            const index = sortChain.findIndex((item) => item.key === key);
            if (index < 0) {
                el.textContent = '';
                return;
            }
            const dir = sortChain[index].direction === 'asc' ? '▲' : '▼';
            el.textContent = index === 0 ? dir : `${index + 1}${dir}`;
        });
    };

    const getFilteredSortedCoffeeTypes = () => {
        const normalizeText = (value) => (value || '').toString().toLowerCase().trim();
        const getSortValue = (type, key) => {
            if (key === 'decaf') return type.decaf ? 1 : 0;
            if (key === 'roast') return type.roast || type.roastType || '';
            if (key === 'brews') return Number(type.brewsCount) || 0;
            if (key === 'bags') return Number(type.bagsCount) || 0;
            if (key === 'ground') return Number(type.groundKg) || 0;
            if (key === 'rating') return parseInt(type.rating, 10) || 0;
            if (key === 'createdAt') return type.createdAt || '';
            return type[key] || '';
        };
        const compareByKey = (a, b, key, direction = 'asc') => {
            const dir = direction === 'desc' ? -1 : 1;
            const aVal = getSortValue(a, key);
            const bVal = getSortValue(b, key);
            let delta;
            if (key === 'rating' || key === 'brews' || key === 'bags' || key === 'ground' || key === 'decaf') {
                delta = (Number(aVal) || 0) - (Number(bVal) || 0);
            } else {
                delta = normalizeText(aVal).localeCompare(normalizeText(bVal));
            }
            return delta * dir;
        };
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
        const sortChain = getSortChain();
        const primarySort = sortChain[0] || { key: 'createdAt', direction: 'desc' };
        const primarySorted = selectFilteredSortedCoffeeTypes({
            coffeeTypes: coffeeTypesWithCounts,
            searchValue: getCoffeeTypesSearch(),
            filters: getCoffeeTypesFilters(),
            sortKey: primarySort.key,
            sortDir: primarySort.direction
        });
        if (sortChain.length <= 1) return primarySorted;
        return [...primarySorted].sort((a, b) => {
            for (const item of sortChain) {
                const delta = compareByKey(a, b, item.key, item.direction);
                if (delta !== 0) return delta;
            }
            const roasterDelta = normalizeText(a.roaster).localeCompare(normalizeText(b.roaster));
            if (roasterDelta !== 0) return roasterDelta;
            return normalizeText(a.farmer).localeCompare(normalizeText(b.farmer));
        });
    };

    const renderCoffeeTypesTable = () => {
        ensureResponsiveTableListener();
        const tbody = document.getElementById('coffeeTypesTableBody');
        const empty = document.getElementById('coffeeTypesEmpty');
        if (!tbody || !empty) return;

        tbody.innerHTML = '';
        renderCoffeeTypesActiveFilters();
        const isMine = getCurrentView() === 'mine';
        const mobileAccordionMode = isCompactMobileTableMode();
        lastCompactMobileMode = mobileAccordionMode;
        const tableHead = document.querySelector('#coffeeTypesModal thead');
        if (tableHead) tableHead.classList.toggle('hidden', mobileAccordionMode);
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
            const ratingHtml = rating > 0 ? getStarDisplay(rating) : '';
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
            const actionsHtml = buildTypeActionsMenuHtml({ type, menuId, isMine, buyBtn });
            const tasteNotesText = (type.tasteNotes || '').trim();

            if (mobileAccordionMode) {
                const row = document.createElement('tr');
                row.setAttribute('data-id', type.id);
                row.className = 'relative bg-white dark:bg-[#292524] border-b border-coffee-100 dark:border-[#44403c] align-top';
                const summaryHtml = [
                    { label: 'Origin', value: origin },
                    { label: 'Process', value: processing },
                    { label: 'Roast', value: roast }
                ]
                    .filter((item) => item.value && item.value !== '-')
                    .map((item) => `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-coffee-100 dark:bg-[#34302e] text-[10px] text-coffee-700 dark:text-[#d6ccc2]">${item.value}</span>`)
                    .join('');
                const detailsHtml = `
                    <div class="pt-2 space-y-3 text-sm">
                        <div class="grid grid-cols-2 gap-3">
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Origin</span><span>${origin}</span></div>
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Process</span><span>${processing}</span></div>
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Variety</span><span>${variety}</span></div>
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Roast</span><span>${roast}</span></div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-center">
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Brews</div><div class="font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${brewsCount}</div></div>
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Bags</div><div class="font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${bagsCount}</div></div>
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Ground</div><div class="font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${groundKg.toFixed(2)} kg</div></div>
                        </div>
                        ${tasteNotesText
                            ? `<div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase mb-1">Taste notes</span><p class="text-sm text-coffee-800 dark:text-[#d6ccc2] italic bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/20">${tasteNotesText}</p></div>`
                            : ''}
                    </div>
                `;
                row.innerHTML = `
                    <td colspan="99" class="relative overflow-visible px-2 py-1.5">
                        <div class="relative overflow-visible rounded-lg border border-coffee-100 dark:border-[#44403c] bg-coffee-50 dark:bg-[#1c1917]">
                            <div role="button" tabindex="0" data-mobile-accordion-header="true" class="w-full text-left px-2 py-2 cursor-pointer">
                                <div class="flex items-start gap-2">
                                    <div class="flex-shrink-0">${buildTypePhotoHtml(type)}</div>
                                    <div class="min-w-0 flex-1">
                                        <div class="text-sm font-semibold text-coffee-900 dark:text-white truncate inline-flex items-center gap-1">${farmer || '-'}${decaf ? '<i class="fa-solid fa-moon text-[10px] text-coffee-500 dark:text-[#a8a29e]" title="Decaf"></i>' : ''}</div>
                                        <div class="text-xs text-coffee-600 dark:text-[#a8a29e] truncate">${roaster || '-'}</div>
                                        <div class="mt-0.5 leading-none">${ratingHtml}</div>
                                    </div>
                                    <div class="ml-auto flex-shrink-0 self-start pl-1">
                                        <div data-action-click="event.stopPropagation()" class="relative z-20 flex items-center gap-2">
                                            ${actionsHtml}
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-2 flex items-end justify-between gap-2">
                                    <div class="flex flex-wrap gap-1 min-w-0">
                                        ${summaryHtml || '<span class="text-[11px] text-coffee-500 dark:text-[#a8a29e] italic">Tap to view details</span>'}
                                    </div>
                                    <div class="text-[10px] leading-tight text-right text-coffee-500 dark:text-[#a8a29e] font-mono whitespace-nowrap">${createdAt}</div>
                                </div>
                            </div>
                            <div data-mobile-accordion-panel="true" class="hidden px-3 pb-3 pt-1 border-t border-coffee-100 dark:border-[#34302e]">
                                ${detailsHtml}
                            </div>
                        </div>
                    </td>
                `;
                const headerBtn = row.querySelector('[data-mobile-accordion-header="true"]');
                const panel = row.querySelector('[data-mobile-accordion-panel="true"]');
                let lastTapAt = 0;
                headerBtn?.addEventListener('click', (event) => {
                    if (event.target && event.target.closest?.('[data-action-click]')) return;
                    const now = Date.now();
                    if (now - lastTapAt < 300) {
                        dispatchCommand('coffees.openCard', { id: type.id, event });
                        lastTapAt = 0;
                        return;
                    }
                    lastTapAt = now;
                    const willOpen = panel?.classList.contains('hidden');
                    panel?.classList.toggle('hidden', !willOpen);
                });
                headerBtn?.addEventListener('keydown', (event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return;
                    event.preventDefault();
                    headerBtn.click();
                });
                tbody.appendChild(row);
                return;
            }

            const row = document.createElement('tr');
            row.setAttribute('data-id', type.id);
            row.className = 'bg-white dark:bg-[#292524] border-b border-coffee-100 dark:border-[#44403c] last:border-b-0';
            row.ondblclick = (event) => dispatchCommand('coffees.openCard', { id: type.id, event });
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
                <td class="px-4 py-3 text-center whitespace-nowrap">${ratingHtml}</td>
                <td class="px-4 py-3 text-center text-xs font-mono text-coffee-500">${createdAt}</td>
                <td class="px-4 py-3 text-center">${actionsHtml}</td>
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
