import {
    createDefaultGasFilters,
    getGasMethodsLabel,
    normalizeGasType,
    selectFilteredSortedGasItems,
    selectGasQuickFilterValues
} from '../../app/stores/gas-table.selectors.js';

export const createGasTableModule = ({
    getGasItems,
    getCoffees,
    getPinnedBrewsPreferences,
    getCurrentView,
    getGasSearch,
    setGasSearchState,
    getGasFilters,
    setGasFiltersState,
    getGasSortKey,
    setGasSortKeyState,
    getGasSortDir,
    setGasSortDirState,
    dispatchCommand
}) => {
    if (typeof dispatchCommand !== 'function') {
        throw new Error('createGasTableModule requires dispatchCommand');
    }
    let quickFilterActiveTab = 'sort';
    let gasSortChain = null;
    let hasBoundResponsiveTableListener = false;
    let lastCompactMobileMode = null;
    let resizeRafId = null;
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
        if (!gasSortChain) {
            gasSortChain = normalizeSortChain({
                key: getGasSortKey(),
                direction: getGasSortDir()
            });
        }
        return [...gasSortChain];
    };
    const setSortChain = (nextChain = []) => {
        const normalized = normalizeSortChain(nextChain);
        gasSortChain = normalized;
        const primary = normalized[0] || { key: 'purchasedDate', direction: 'desc' };
        setGasSortKeyState(primary.key);
        setGasSortDirState(primary.direction);
    };
    const getSortableFields = () => ([
        { key: 'name', label: 'Name' },
        { key: 'type', label: 'Type' },
        { key: 'methods', label: 'Methods' },
        { key: 'brews', label: 'Brews' },
        { key: 'price', label: 'Price' },
        { key: 'purchasedDate', label: 'Purchased Date' }
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
                renderGasTable();
            });
        };

        if (typeof media.addEventListener === 'function') media.addEventListener('change', scheduleCheck);
        else if (typeof media.addListener === 'function') media.addListener(scheduleCheck);
        window.addEventListener('resize', scheduleCheck);
        window.addEventListener('orientationchange', scheduleCheck);
    };

    const buildGasPhotoHtml = (item) => {
        const imageUrl = item?.imageUrl || item?.imageURL || '';
        if (imageUrl) {
            return `<img src="${imageUrl}" alt="Gear image" class="w-12 h-12 rounded-lg object-cover border border-coffee-200 dark:border-[#44403c]" loading="lazy">`;
        }
        return '<div class="w-12 h-12 rounded-lg bg-coffee-100 dark:bg-[#34302e] border border-coffee-200 dark:border-[#44403c] flex items-center justify-center text-coffee-400 dark:text-[#78716c]"><i class="fa-solid fa-screwdriver-wrench text-sm"></i></div>';
    };
    const getHeaderMethodsLabel = (methods) => {
        if (!Array.isArray(methods) || methods.length === 0) return '-';
        const normalized = methods.map((method) => (method || '').toString().trim()).filter(Boolean);
        if (!normalized.length) return '-';
        const capped = normalized.slice(0, 3).join(', ');
        return normalized.length > 3 ? `${capped} ...` : capped;
    };
    const getCappedHeaderTitle = (value, maxLength = 25) => {
        const text = (value || '').toString().trim();
        if (!text) return '-';
        return text.length > maxLength ? `${text.slice(0, maxLength)}...` : text;
    };
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

        if (!dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            return;
        }

        const sortOptions = getSortableFields();
        const sortChain = getSortChain();
        const filters = getGasFilters();
        const categories = [
            { key: 'archived', label: 'State' },
            { key: 'type', label: 'Type' },
            { key: 'method', label: 'Method' }
        ];

        let html = '<div class="px-3 py-2 border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between gap-2">';
        html += '<div class="inline-flex items-center gap-1 bg-coffee-100 dark:bg-[#1c1917] rounded p-0.5">';
        html += '<button type="button" data-quick-tab="sort" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold bg-white dark:bg-[#292524] text-coffee-800 dark:text-white">Sort</button>';
        html += '<button type="button" data-quick-tab="filter" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold text-coffee-600 dark:text-[#a8a29e]">Filter</button>';
        html += '</div>';
        html += '<button type="button" data-action-click="toggleGasQuickFilter(event)" class="w-11 h-11 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-coffee-600 dark:text-[#a8a29e] hover:bg-coffee-50 dark:hover:bg-[#34302e] flex items-center justify-center" title="Close"><i class="fa-solid fa-xmark text-[11px]"></i></button>';
        html += '</div>';

        html += '<div id="gasQuickSortPanel" class="px-3 py-2 grid grid-cols-2 gap-1.5">';
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
        html += '<select id="gasQuickSortAddSelect" aria-label="Add gear sort field" class="w-full px-2 py-1.5 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-xs text-coffee-900 dark:text-white">';
        html += '<option value="">Add field...</option>';
        availableToAdd.forEach((option) => {
            html += `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`;
        });
        html += '</select>';
        html += '<button type="button" id="gasQuickSortAddBtn" class="px-2 py-1.5 rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white text-xs font-bold">Add</button>';
        html += '</div>';
        html += '</div>';

        html += '<div id="gasQuickFilterPanel" class="hidden pb-2">';
        categories.forEach((cat) => {
            const isActive = filters[cat.key] !== null;
            const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
            html += `<button data-action-click="openGasQuickFilterValues(event, '${cat.key}', '${cat.label}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] flex items-center justify-between ${activeClass}">
                <span>${cat.label}</span>
                ${isActive ? '<i class="fa-solid fa-check text-coffee-600 dark:text-[#a8a29e] text-xs"></i>' : '<i class="fa-solid fa-chevron-right text-coffee-300 dark:text-[#57534e] text-xs"></i>'}
            </button>`;
        });
        html += '</div>';
        dropdown.innerHTML = html;

        const tabButtons = Array.from(dropdown.querySelectorAll('[data-quick-tab]'));
        const tabPanels = {
            sort: document.getElementById('gasQuickSortPanel'),
            filter: document.getElementById('gasQuickFilterPanel')
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
            toggleGasQuickFilter(syntheticEvent);
        };
        const sortAddBtn = document.getElementById('gasQuickSortAddBtn');
        const sortAddSelect = document.getElementById('gasQuickSortAddSelect');
        sortAddBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            const key = sortAddSelect?.value || '';
            if (!key) return;
            setSortChain([...sortChain, { key, direction: 'asc' }]);
            renderGasTable();
            rerenderOpenPanel();
        });
        dropdown.querySelectorAll('[data-quick-sort-toggle]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-toggle') || '';
                if (!key) return;
                const next = sortChain.map((item) => item.key === key ? { ...item, direction: item.direction === 'asc' ? 'desc' : 'asc' } : item);
                setSortChain(next);
                renderGasTable();
                rerenderOpenPanel();
            });
        });
        dropdown.querySelectorAll('[data-quick-sort-remove]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-remove') || '';
                if (!key) return;
                setSortChain(sortChain.filter((item) => item.key !== key));
                renderGasTable();
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
                renderGasTable();
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
                renderGasTable();
                rerenderOpenPanel();
            });
        });

        activateTab(quickFilterActiveTab);
        dropdown.classList.remove('hidden');
    };

    const openGasQuickFilterValues = (e, key, label) => {
        e.stopPropagation();
        const valuesDropdown = document.getElementById('gasQuickFilterValuesDropdown');
        const mainDropdown = document.getElementById('gasQuickFilterDropdown');
        if (!valuesDropdown || !mainDropdown) return;

        const filters = getGasFilters();
        const values = selectGasQuickFilterValues({ key, gasItems: getGasItems() });

        let html = `<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between">
            <span>${label}</span>
            <button data-action-click="toggleGasQuickFilter(event)" class="w-11 h-11 flex items-center justify-center text-coffee-400 hover:text-coffee-600 dark:hover:text-white">
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
        quickFilterActiveTab = 'filter';
        const syntheticEvent = { stopPropagation: () => {} };
        toggleGasQuickFilter(syntheticEvent);
    };

    const clearGasFilters = () => {
        setGasFiltersState(createDefaultGasFilters());
        setGasSearchState('');
        const input = document.getElementById('gasSearch');
        if (input) input.value = '';
        document.getElementById('gasSearchClearBtn')?.classList.add('hidden');
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
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>State:</span><b>${label}</b><button data-action-click="applyGasFilterFromQuick('archived', null)" aria-label="Remove filter" title="Remove filter" class="ml-1 hover:text-red-200">x</button></div>`;
        }
        if (type) {
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>Type:</span><b>${type}</b><button data-action-click="applyGasFilterFromQuick('type', null)" aria-label="Remove filter" title="Remove filter" class="ml-1 hover:text-red-200">x</button></div>`;
        }
        if (method) {
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>Method:</span><b>${method}</b><button data-action-click="applyGasFilterFromQuick('method', null)" aria-label="Remove filter" title="Remove filter" class="ml-1 hover:text-red-200">x</button></div>`;
        }
        container.classList.remove('hidden');
    };

    const setGasSort = (key) => {
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
        renderGasTable();
    };

    const updateGasSortIcons = () => {
        const keys = ['name', 'type', 'methods', 'brews', 'price', 'purchasedDate'];
        const sortChain = getSortChain();
        keys.forEach((key) => {
            const el = document.getElementById(`gasSortIcon-${key}`);
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

    const getFilteredSortedGasItems = () => {
        const normalizeText = (value) => (value || '').toString().toLowerCase().trim();
        const getSortValue = (item, key) => {
            if (key === 'price') {
                const num = Number(item.price);
                return Number.isFinite(num) ? num : null;
            }
            if (key === 'brews') return Number(item.brewsCount) || 0;
            if (key === 'type') return normalizeGasType(item.type);
            if (key === 'methods') return normalizeGasMethods(item.methods).join(', ');
            if (key === 'purchasedDate') return item.purchasedDate || '';
            return item.name || '';
        };
        const compareByKey = (a, b, key, direction = 'asc') => {
            const dir = direction === 'desc' ? -1 : 1;
            const aVal = getSortValue(a, key);
            const bVal = getSortValue(b, key);
            let delta = 0;
            if (key === 'price' || key === 'brews') {
                const aNum = Number(aVal);
                const bNum = Number(bVal);
                delta = (Number.isFinite(aNum) ? aNum : -Infinity) - (Number.isFinite(bNum) ? bNum : -Infinity);
            } else {
                delta = normalizeText(aVal).localeCompare(normalizeText(bVal));
            }
            return delta * dir;
        };
        const brewCountByGearId = new Map();
        getCoffees().forEach((brew) => {
            const ids = Array.isArray(brew?.gearIds) ? brew.gearIds : [];
            ids.forEach((gearId) => {
                if (!gearId) return;
                brewCountByGearId.set(gearId, (brewCountByGearId.get(gearId) || 0) + 1);
            });
        });
        const gasItemsWithCounts = getGasItems().map((item) => ({
            ...item,
            brewsCount: brewCountByGearId.get(item.id) || 0
        }));
        const sortChain = getSortChain();
        const primarySort = sortChain[0] || { key: 'purchasedDate', direction: 'desc' };
        const primarySorted = selectFilteredSortedGasItems({
            gasItems: gasItemsWithCounts,
            searchValue: getGasSearch(),
            filters: getGasFilters(),
            sortKey: primarySort.key,
            sortDir: primarySort.direction
        });
        if (sortChain.length <= 1) return primarySorted;
        return [...primarySorted].sort((a, b) => {
            for (const item of sortChain) {
                const delta = compareByKey(a, b, item.key, item.direction);
                if (delta !== 0) return delta;
            }
            return normalizeText(a.name).localeCompare(normalizeText(b.name));
        });
    };

    const renderGasTable = () => {
        ensureResponsiveTableListener();
        const tbody = document.getElementById('gasTableBody');
        const empty = document.getElementById('gasEmpty');
        if (!tbody || !empty) return;

        tbody.innerHTML = '';
        renderGasActiveFilters();

        const items = getGasItems();
        const mobileAccordionMode = isCompactMobileTableMode();
        lastCompactMobileMode = mobileAccordionMode;
        const tableHead = document.querySelector('#gasModal thead');
        if (tableHead) tableHead.classList.toggle('hidden', mobileAccordionMode);
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
            const brewsCount = Number(item.brewsCount) || 0;
            const archiveLabel = item.archived ? 'Unarchive' : 'Archive';
            const actionsHtml = `
                <div class="relative inline-block">
                    <button data-action-click="gasToggleActionMenu('${menuId}', event)" class="p-1.5 text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]">
                        <i class="fa-solid fa-ellipsis-vertical text-lg"></i>
                    </button>
                    <div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden">
                        <button data-action-click="openGasCard('${item.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                            <i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card
                        </button>
                        ${isMine ? `<button data-action-click="openGasFromTableEdit('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-pen-to-square text-blue-500 w-4"></i> Edit</button>` : ''}
                        ${isMine ? `<button data-action-click="showBrewsForGear('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-mug-saucer text-indigo-600 w-4"></i> Go to brews</button>` : ''}
                        ${isMine ? `<button data-action-click="openGasBulkAddFromTable('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-teal-600 w-4"></i> Bulk add to</button>` : ''}
                        ${isMine ? `<button data-action-click="openGasMergeFromTable('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-code-merge text-purple-500 w-4"></i> Merge</button>` : ''}
                        ${isMine ? `<button data-action-click="toggleGasArchiveFromTable('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-box-archive text-amber-600 w-4"></i> ${archiveLabel}</button>` : ''}
                        ${isMine ? `<hr class="border-coffee-100 dark:border-[#44403c]"><button data-action-click="deleteGasFromTable('${item.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3"><i class="fa-solid fa-trash w-4"></i> Delete</button>` : ''}
                    </div>
                </div>
            `;

            if (mobileAccordionMode) {
                const row = document.createElement('tr');
                row.setAttribute('data-id', item.id);
                row.className = 'relative bg-white dark:bg-[#292524] border-b border-coffee-100 dark:border-[#44403c] align-top';
                const typeLabel = normalizeGasType(item.type);
                const methodsLabel = getGasMethodsLabel(item.methods);
                const methodsHeaderLabel = getHeaderMethodsLabel(item.methods);
                const cappedTitle = getCappedHeaderTitle(item.name, 25);
                const detailsHtml = `
                    <div class="pt-2 space-y-3 text-sm">
                        <div class="grid grid-cols-2 gap-3">
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Type</span><span>${typeLabel}</span></div>
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Methods</span><span>${methodsLabel}</span></div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-center">
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Brews</div><div class="font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${brewsCount}</div></div>
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Purchased</div><div class="font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${purchasedDateLabel}</div></div>
                        </div>
                    </div>
                `;
                row.innerHTML = `
                    <td colspan="99" class="relative overflow-visible px-2 py-1.5">
                        <div class="relative overflow-visible rounded-lg border border-coffee-100 dark:border-[#44403c] bg-coffee-50 dark:bg-[#1c1917]">
                            <div role="button" tabindex="0" data-mobile-accordion-header="true" class="w-full text-left px-2 py-2 cursor-pointer">
                                <div class="flex items-start gap-2">
                                    <div class="flex-shrink-0">${buildGasPhotoHtml(item)}</div>
                                    <div class="min-w-0 flex-1">
                                        <div class="text-sm font-semibold text-coffee-900 dark:text-white truncate">${cappedTitle}</div>
                                        <div class="text-xs text-coffee-600 dark:text-[#a8a29e] truncate">${typeLabel}</div>
                                    </div>
                                    <div class="ml-auto flex-shrink-0 self-start pl-1">
                                        <div data-action-click="event.stopPropagation()" class="relative z-20 flex items-center gap-2">
                                            ${actionsHtml}
                                        </div>
                                    </div>
                                </div>
                                <div class="mt-2 flex items-end justify-between gap-2">
                                    <div class="flex flex-wrap gap-1 min-w-0">
                                        ${methodsHeaderLabel && methodsHeaderLabel !== '-' ? `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-coffee-100 dark:bg-[#34302e] text-[10px] text-coffee-700 dark:text-[#d6ccc2]">${methodsHeaderLabel}</span>` : ''}
                                    </div>
                                    <div class="text-[10px] leading-tight text-right text-coffee-500 dark:text-[#a8a29e] font-mono whitespace-nowrap">${purchasedDateLabel}</div>
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
                        dispatchCommand('gas.openCard', { id: item.id, event });
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
                return row;
            }

            const row = document.createElement('tr');
            row.setAttribute('data-id', item.id);
            row.className = 'bg-white dark:bg-[#292524] border-b border-coffee-100 dark:border-[#44403c] last:border-b-0';
            row.ondblclick = (event) => dispatchCommand('gas.openCard', { id: item.id, event });
            row.innerHTML = `
                <td class="px-4 py-3 font-semibold">${item.name || '-'}</td>
                <td class="px-4 py-3">${normalizeGasType(item.type)}</td>
                <td class="px-4 py-3 text-xs">${getGasMethodsLabel(item.methods)}</td>
                <td class="px-4 py-3 text-center font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${brewsCount}</td>
                <td class="px-4 py-3 text-center text-xs font-mono text-coffee-500">${purchasedDateLabel}</td>
                <td class="px-4 py-3 text-center">${actionsHtml}</td>
            `;
            return row;
        };

        const activeItems = sortedItems.filter((item) => !item.archived);
        const archivedItems = sortedItems.filter((item) => item.archived);

        if (activeItems.length > 0) {
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-green-50 dark:bg-green-900/20';
            headerRow.innerHTML = '<td colspan="99" class="px-4 py-2 text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide"><i class="fa-solid fa-box-open mr-2"></i>Active</td>';
            tbody.appendChild(headerRow);
            activeItems.forEach((item) => tbody.appendChild(createRow(item)));
        }

        if (archivedItems.length > 0) {
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-gray-50 dark:bg-[#34302e]';
            headerRow.innerHTML = '<td colspan="99" class="px-4 py-2 text-xs font-bold text-gray-500 dark:text-[#a8a29e] uppercase tracking-wide"><i class="fa-solid fa-archive mr-2"></i>Archived</td>';
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
        createDefaultGasFilters
    };
};
