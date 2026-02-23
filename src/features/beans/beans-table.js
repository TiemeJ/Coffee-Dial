import {
    createDefaultBeansFilters,
    selectBeansCoffeeTypeValues,
    selectFilteredBeans
} from '../../app/stores/beans-table.selectors.js';

export const createBeansTableModule = ({
    getCurrentUser,
    getCurrentView,
    getBeans,
    getCoffees,
    getCoffeeTypes,
    getPinnedBrewsPreferences,
    getBeansSearch,
    setBeansSearchState,
    getBeansFilters,
    setBeansFiltersState,
    getBeansSortKey,
    setBeansSortKeyState,
    getBeansSortDir,
    setBeansSortDirState,
    getBeanCalculatedStock,
    getBeanCoffeeTypeDisplay,
    getRoastBadge,
    dispatchCommand,
    updateCoffeeTypeSelectors
}) => {
    let quickFilterActiveTab = 'sort';
    let beansSortChain = null;
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
        if (!beansSortChain) {
            beansSortChain = normalizeSortChain({
                key: getBeansSortKey?.(),
                direction: getBeansSortDir?.()
            });
        }
        return [...beansSortChain];
    };
    const setSortChain = (nextChain = []) => {
        const normalized = normalizeSortChain(nextChain);
        beansSortChain = normalized;
        const primary = normalized[0] || { key: 'createdAt', direction: 'desc' };
        setBeansSortKeyState?.(primary.key);
        setBeansSortDirState?.(primary.direction);
    };
    const getSortableFields = () => ([
        { key: 'farmer', label: 'Farmer' },
        { key: 'roaster', label: 'Roaster' },
        { key: 'origin', label: 'Origin' },
        { key: 'processing', label: 'Process' },
        { key: 'variety', label: 'Variety' },
        { key: 'decaf', label: 'Decaf' },
        { key: 'roastType', label: 'Roast' },
        { key: 'price', label: 'Price' },
        { key: 'stock', label: 'Weight' },
        { key: 'brews', label: 'Brews' },
        { key: 'beansLeft', label: 'Beans left' },
        { key: 'roastDate', label: 'Roast date' },
        { key: 'frozenDate', label: 'Frozen date' },
        { key: 'openedDate', label: 'Opened date' },
        { key: 'archivedDate', label: 'Archived date' },
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
                renderBeansTable();
            });
        };
        if (typeof media.addEventListener === 'function') media.addEventListener('change', scheduleCheck);
        else if (typeof media.addListener === 'function') media.addListener(scheduleCheck);
        window.addEventListener('resize', scheduleCheck);
        window.addEventListener('orientationchange', scheduleCheck);
    };
    const buildBeanPhotoHtml = (coffeeType = null) => {
        const imageUrl = coffeeType?.imageURL || coffeeType?.imageUrl || '';
        if (imageUrl) {
            return `<img src="${imageUrl}" alt="Coffee image" class="w-12 h-12 rounded-lg object-cover border border-coffee-200 dark:border-[#44403c]" loading="lazy">`;
        }
        return '<div class="w-12 h-12 rounded-lg bg-coffee-100 dark:bg-[#34302e] border border-coffee-200 dark:border-[#44403c] flex items-center justify-center text-coffee-400 dark:text-[#78716c]"><i class="fa-solid fa-seedling text-sm"></i></div>';
    };
    const formatBeanDateLabel = (value) => {
        if (!value) return '-';
        const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        if (isNaN(dateObj)) return '-';
        return dateObj.toLocaleDateString();
    };
    const openBeanCardViaCommand = (beanId, event = null, keepNavigationOrder = false) => {
        if (!beanId) return;
        dispatchCommand?.('beans.openCard', { beanId, event, keepNavigationOrder });
    };
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
        if (!dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            return;
        }

        const filterCategories = [
            { key: 'coffeeType', label: 'Coffee' },
            { key: 'decaf', label: 'Decaf' }
        ];
        const filters = getBeansFilters();
        const sortOptions = getSortableFields();
        const sortChain = getSortChain();

        let html = '<div class="px-3 py-2 border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between gap-2">';
        html += '<div class="inline-flex items-center gap-1 bg-coffee-100 dark:bg-[#1c1917] rounded p-0.5">';
        html += '<button type="button" data-quick-tab="sort" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold bg-white dark:bg-[#292524] text-coffee-800 dark:text-white">Sort</button>';
        html += '<button type="button" data-quick-tab="filter" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold text-coffee-600 dark:text-[#a8a29e]">Filter</button>';
        html += '</div>';
        html += '<button type="button" data-action-click="toggleBeansQuickFilter(event)" class="w-7 h-7 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-coffee-600 dark:text-[#a8a29e] hover:bg-coffee-50 dark:hover:bg-[#34302e] flex items-center justify-center" title="Close"><i class="fa-solid fa-xmark text-[11px]"></i></button>';
        html += '</div>';

        html += '<div id="beansQuickSortPanel" class="px-3 py-2 grid grid-cols-2 gap-1.5">';
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
                    <button type="button" data-quick-sort-up="${escapeHtml(item.key)}" class="w-6 h-6 rounded border border-coffee-200 dark:border-[#44403c] text-[10px] ${idx === 0 ? 'opacity-40 cursor-not-allowed' : ''}" ${idx === 0 ? 'disabled' : ''}><i class="fa-solid fa-arrow-up"></i></button>
                    <button type="button" data-quick-sort-down="${escapeHtml(item.key)}" class="w-6 h-6 rounded border border-coffee-200 dark:border-[#44403c] text-[10px] ${idx === sortChain.length - 1 ? 'opacity-40 cursor-not-allowed' : ''}" ${idx === sortChain.length - 1 ? 'disabled' : ''}><i class="fa-solid fa-arrow-down"></i></button>
                    <button type="button" data-quick-sort-remove="${escapeHtml(item.key)}" class="w-6 h-6 rounded border border-coffee-200 dark:border-[#44403c] text-red-500 text-[10px]"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
            });
        }
        html += '</div>';
        const availableToAdd = sortOptions.filter((option) => !sortChain.some((item) => item.key === option.key));
        html += '<div class="col-span-2 grid grid-cols-[1fr_auto] gap-1.5 pt-1">';
        html += '<select id="beansQuickSortAddSelect" class="w-full px-2 py-1.5 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-xs text-coffee-900 dark:text-white">';
        html += '<option value="">Add field...</option>';
        availableToAdd.forEach((option) => {
            html += `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`;
        });
        html += '</select>';
        html += '<button type="button" id="beansQuickSortAddBtn" class="px-2 py-1.5 rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white text-xs font-bold">Add</button>';
        html += '</div>';
        html += '</div>';

        html += '<div id="beansQuickFilterPanel" class="hidden pb-2">';
        filterCategories.forEach((cat) => {
            const isActive = filters[cat.key] !== null;
            const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
            html += `<button data-action-click="openBeansQuickFilterValues(event, '${cat.key}', '${cat.label}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] flex items-center justify-between ${activeClass}">
                <span>${cat.label}</span>
                ${isActive ? '<i class="fa-solid fa-check text-coffee-600 dark:text-[#a8a29e] text-xs"></i>' : '<i class="fa-solid fa-chevron-right text-coffee-300 dark:text-[#57534e] text-xs"></i>'}
            </button>`;
        });
        html += '</div>';
        dropdown.innerHTML = html;

        const tabButtons = Array.from(dropdown.querySelectorAll('[data-quick-tab]'));
        const tabPanels = {
            sort: document.getElementById('beansQuickSortPanel'),
            filter: document.getElementById('beansQuickFilterPanel')
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
            toggleBeansQuickFilter(syntheticEvent);
        };
        const sortAddBtn = document.getElementById('beansQuickSortAddBtn');
        const sortAddSelect = document.getElementById('beansQuickSortAddSelect');
        sortAddBtn?.addEventListener('click', (event) => {
            event.stopPropagation();
            const key = sortAddSelect?.value || '';
            if (!key) return;
            setSortChain([...sortChain, { key, direction: 'asc' }]);
            renderBeansTable();
            rerenderOpenPanel();
        });
        dropdown.querySelectorAll('[data-quick-sort-toggle]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-toggle') || '';
                if (!key) return;
                const next = sortChain.map((item) => item.key === key ? { ...item, direction: item.direction === 'asc' ? 'desc' : 'asc' } : item);
                setSortChain(next);
                renderBeansTable();
                rerenderOpenPanel();
            });
        });
        dropdown.querySelectorAll('[data-quick-sort-remove]').forEach((btn) => {
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-remove') || '';
                if (!key) return;
                setSortChain(sortChain.filter((item) => item.key !== key));
                renderBeansTable();
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
                renderBeansTable();
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
                renderBeansTable();
                rerenderOpenPanel();
            });
        });

        activateTab(quickFilterActiveTab);
        dropdown.classList.remove('hidden');
    };

    const openBeansQuickFilterValues = (e, key, label) => {
        e.stopPropagation();
        const valuesDropdown = document.getElementById('beansQuickFilterValuesDropdown');
        const mainDropdown = document.getElementById('beansQuickFilterDropdown');
        if (!valuesDropdown || !mainDropdown) return;

        let uniqueVals = [];
        if (key === 'coffeeType') {
            uniqueVals = selectBeansCoffeeTypeValues(getCoffeeTypes());
        } else if (key === 'decaf') {
            const hasDecaf = getBeans().some((bean) => !!getBeanCoffeeTypeDisplay(bean).decaf);
            const hasRegular = getBeans().some((bean) => !getBeanCoffeeTypeDisplay(bean).decaf);
            uniqueVals = [hasDecaf ? 'Decaf' : null, hasRegular ? 'Regular' : null].filter(Boolean);
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
            if (key === 'coffeeType') {
                uniqueVals.forEach((val) => {
                    const isActive = filters[key] === val.id;
                    const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e]' : '';
                    const escapedId = String(val.id).replace(/'/g, "\\'");
                    html += `<button data-action-click="applyBeansFilterFromQuick('${key}', '${escapedId}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-600 dark:text-[#a8a29e] ${activeClass}">
                        ${val.display}
                    </button>`;
                });
            } else {
                uniqueVals.forEach((val) => {
                    const isActive = filters[key] === val;
                    const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e]' : '';
                    const escapedVal = String(val).replace(/'/g, "\\'");
                    html += `<button data-action-click="applyBeansFilterFromQuick('${key}', '${escapedVal}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-600 dark:text-[#a8a29e] ${activeClass}">
                        ${val}
                    </button>`;
                });
            }
            valuesDropdown.innerHTML = html;
        }

        mainDropdown.classList.add('hidden');
        valuesDropdown.classList.remove('hidden');
    };

    const applyBeansFilterFromQuick = (key, value) => {
        setBeansFiltersState({ ...getBeansFilters(), [key]: value });
        const dropdown = document.getElementById('beansQuickFilterDropdown');
        const valuesDropdown = document.getElementById('beansQuickFilterValuesDropdown');
        if (dropdown) dropdown.classList.add('hidden');
        if (valuesDropdown) valuesDropdown.classList.add('hidden');
        renderBeansActiveFilters();
        renderBeansTable();
        quickFilterActiveTab = 'filter';
        const syntheticEvent = { stopPropagation: () => {} };
        toggleBeansQuickFilter(syntheticEvent);
    };

    const clearBeansFilters = () => {
        setBeansFiltersState(createDefaultBeansFilters());
        setBeansSearchState('');
        const input = document.getElementById('beansSearch');
        if (input) input.value = '';
        document.getElementById('beansSearchClearBtn')?.classList.add('hidden');
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
        if (filters.decaf) {
            hasFilters = true;
            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>Decaf:</span><b>${filters.decaf}</b><button data-action-click="applyBeansFilterFromQuick('decaf', null)" class="ml-1 hover:text-red-200">x</button></div>`;
        }
        container.classList.toggle('hidden', !hasFilters);
    };

    const setBeansSort = (key) => {
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
        renderBeansTable();
    };

    const updateBeansSortIcons = () => {
        const keys = ['farmer', 'origin', 'processing', 'decaf', 'roastType', 'price', 'stock', 'brews', 'beansLeft', 'roastDate', 'frozenDate', 'openedDate', 'archivedDate'];
        const sortChain = getSortChain();
        keys.forEach((key) => {
            const el = document.getElementById(`beansSortIcon-${key}`);
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

    const getFilteredSortedBeans = () => {
        const normalized = selectFilteredBeans({
            beans: getBeans(),
            searchTerm: getBeansSearch(),
            coffeeTypeFilter: getBeansFilters().coffeeType,
            decafFilter: getBeansFilters().decaf,
            getBeanCoffeeTypeDisplay
        });
        const brewCountByBeanId = new Map();
        getCoffees().forEach((brew) => {
            if (!brew?.beanId) return;
            brewCountByBeanId.set(brew.beanId, (brewCountByBeanId.get(brew.beanId) || 0) + 1);
        });
        const withStock = normalized.map((bean) => ({
            ...bean,
            calculatedStock: getBeanCalculatedStock(bean),
            brewsCount: brewCountByBeanId.get(bean.id) || 0
        }));
        const normalizeText = (value) => (value || '').toString().toLowerCase().trim();
        const normalizeDate = (value) => {
            if (!value) return 0;
            const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            const timestamp = dateObj instanceof Date ? dateObj.getTime() : 0;
            return Number.isFinite(timestamp) ? timestamp : 0;
        };
        const getSortValue = (bean, key) => {
            const coffeeDisplay = getBeanCoffeeTypeDisplay(bean);
            if (key === 'farmer') return coffeeDisplay.farmer || '';
            if (key === 'roaster') return coffeeDisplay.roaster || '';
            if (key === 'origin') return coffeeDisplay.origin || '';
            if (key === 'processing') return coffeeDisplay.processing || '';
            if (key === 'variety') return coffeeDisplay.variety || '';
            if (key === 'decaf') return coffeeDisplay.decaf ? '1' : '0';
            if (key === 'roastType') return coffeeDisplay.roastType || '';
            if (key === 'price') return Number(bean.price);
            if (key === 'stock') return Number(bean.stock);
            if (key === 'brews') return Number(bean.brewsCount) || 0;
            if (key === 'beansLeft') return Number(bean.calculatedStock);
            if (key === 'roastDate') return normalizeDate(bean.roastDate);
            if (key === 'frozenDate') return normalizeDate(bean.frozenDate);
            if (key === 'openedDate') return normalizeDate(bean.openedDate);
            if (key === 'archivedDate') return normalizeDate(bean.archivedDate);
            if (key === 'createdAt') return normalizeDate(bean.createdAt);
            return '';
        };
        const compareByKey = (a, b, key, direction = 'asc') => {
            const dir = direction === 'desc' ? -1 : 1;
            const numericKeys = new Set(['price', 'stock', 'brews', 'beansLeft', 'decaf', 'roastDate', 'frozenDate', 'openedDate', 'archivedDate', 'createdAt']);
            const aVal = getSortValue(a, key);
            const bVal = getSortValue(b, key);
            let delta = 0;
            if (numericKeys.has(key)) {
                const aNum = Number(aVal);
                const bNum = Number(bVal);
                delta = (Number.isFinite(aNum) ? aNum : -Infinity) - (Number.isFinite(bNum) ? bNum : -Infinity);
            } else {
                delta = normalizeText(aVal).localeCompare(normalizeText(bVal));
            }
            return delta * dir;
        };
        const sortChain = getSortChain();
        const chain = sortChain.length ? sortChain : [{ key: 'createdAt', direction: 'desc' }];
        return [...withStock].sort((a, b) => {
            for (const item of chain) {
                const delta = compareByKey(a, b, item.key, item.direction);
                if (delta !== 0) return delta;
            }
            return normalizeText(a.id).localeCompare(normalizeText(b.id));
        });
    };

    const renderBeansTable = () => {
        ensureResponsiveTableListener();
        const tbody = document.getElementById('beansTableBody');
        const empty = document.getElementById('beansEmpty');
        if (!tbody || !empty) return;

        tbody.innerHTML = '';
        renderBeansActiveFilters();
        const isMine = getCurrentView() === 'mine';
        const finalBeans = getFilteredSortedBeans();
        const mobileAccordionMode = isCompactMobileTableMode();
        lastCompactMobileMode = mobileAccordionMode;
        const tableHead = document.querySelector('#beansModal thead');
        if (tableHead) tableHead.classList.toggle('hidden', mobileAccordionMode);

        if (finalBeans.length === 0) {
            empty.classList.remove('hidden');
            updateBeansSortIcons();
            return;
        }
        empty.classList.add('hidden');

        const inStockBeans = finalBeans.filter((bean) => !bean.archived && !bean.frozen && bean.calculatedStock !== null && bean.calculatedStock > 0);
        const frozenBeans = finalBeans.filter((bean) => !bean.archived && bean.frozen);
        const otherBeans = finalBeans.filter((bean) => bean.archived || (!bean.frozen && (bean.calculatedStock === null || bean.calculatedStock <= 0)));

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
            const decafIcon = coffeeDisplay.decaf
                ? '<i class="fa-solid fa-moon text-[11px] text-coffee-500 dark:text-[#a8a29e]" title="Decaf"></i>'
                : '';
            const brewCount = Number(bean.brewsCount) || 0;
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
            const actionsHtml = `
                <div class="relative inline-block">
                    <button data-action-click="beansToggleActionMenu('${menuId}', event)" class="p-1.5 text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]">
                        <i class="fa-solid fa-ellipsis-vertical text-lg"></i>
                    </button>
                    <div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden">
                        <button data-action-click="beansOpenCard('${bean.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
                            <i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card
                        </button>
                        ${isMine ? `<button data-action-click="beansOpenCardForEdit('${bean.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3">
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
            `;

            if (mobileAccordionMode) {
                const row = document.createElement('tr');
                row.setAttribute('data-id', bean.id);
                row.className = 'relative bg-white dark:bg-[#292524] border-b border-coffee-100 dark:border-[#44403c] align-top';
                const coffeeType = getCoffeeTypes().find((entry) => entry.id === bean.coffeeTypeId) || null;
                const roastDateLabel = formatBeanDateLabel(bean.roastDate);
                const openedDateLabel = formatBeanDateLabel(bean.openedDate);
                const frozenDateLabel = formatBeanDateLabel(bean.frozenDate);
                const archivedDateLabel = formatBeanDateLabel(bean.archivedDate);
                const summaryHtml = [
                    roastDateLabel && roastDateLabel !== '-' ? roastDateLabel : null,
                    Number.isFinite(brewCount) ? `${brewCount} brews` : null,
                    stockLeftDisplay && stockLeftDisplay !== '-' ? stockLeftDisplay : null
                ]
                    .filter(Boolean)
                    .map((value) => `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-coffee-100 dark:bg-[#34302e] text-[10px] text-coffee-700 dark:text-[#d6ccc2]">${value}</span>`)
                    .join('');
                const detailsHtml = `
                    <div class="pt-2 space-y-3 text-sm">
                        <div class="grid grid-cols-2 gap-3">
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Origin</span><span>${origin}</span></div>
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Process</span><span>${process}</span></div>
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Variety</span><span>${coffeeDisplay.variety || '-'}</span></div>
                            <div><span class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase">Roast</span><span>${coffeeDisplay.roastType || '-'}</span></div>
                        </div>
                        <div class="grid grid-cols-3 gap-2 text-center">
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Price</div><div class="font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${bean.price ?? '-'}</div></div>
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Weight</div><div class="font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${bean.stock ?? '-'}</div></div>
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Brews</div><div class="font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${brewCount}</div></div>
                        </div>
                        <div class="grid grid-cols-2 gap-2 text-center">
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Roast date</div><div class="font-mono text-xs font-bold text-coffee-700 dark:text-[#d6ccc2]">${roastDateLabel}</div></div>
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Opened date</div><div class="font-mono text-xs font-bold text-coffee-700 dark:text-[#d6ccc2]">${openedDateLabel}</div></div>
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Frozen date</div><div class="font-mono text-xs font-bold text-coffee-700 dark:text-[#d6ccc2]">${frozenDateLabel}</div></div>
                            <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Archived date</div><div class="font-mono text-xs font-bold text-coffee-700 dark:text-[#d6ccc2]">${archivedDateLabel}</div></div>
                        </div>
                    </div>
                `;
                row.innerHTML = `
                    <td colspan="99" class="relative overflow-visible px-2 py-1.5">
                        <div class="relative overflow-visible rounded-lg border border-coffee-100 dark:border-[#44403c] bg-coffee-50 dark:bg-[#1c1917]">
                            <div role="button" tabindex="0" data-mobile-accordion-header="true" class="w-full text-left px-2 py-2 cursor-pointer">
                                <div class="flex items-start gap-2">
                                    <div class="flex-shrink-0">${buildBeanPhotoHtml(coffeeType)}</div>
                                    <div class="min-w-0 flex-1">
                                        <div class="text-sm font-semibold text-coffee-900 dark:text-white truncate inline-flex items-center gap-1">${farmer}${coffeeDisplay.decaf ? '<i class="fa-solid fa-moon text-[10px] text-coffee-500 dark:text-[#a8a29e]" title="Decaf"></i>' : ''}</div>
                                        <div class="text-xs text-coffee-600 dark:text-[#a8a29e] truncate">${roaster}</div>
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
                        openBeanCardViaCommand(bean.id, event);
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

            const tr = document.createElement('tr');
            tr.setAttribute('data-id', bean.id);
            tr.className = 'bg-white dark:bg-[#292524] border-b border-coffee-50 dark:border-[#34302e] hover:bg-coffee-50 dark:hover:bg-[#1c1917] transition-colors';
            tr.ondblclick = (e) => openBeanCardViaCommand(bean.id, e);
            tr.innerHTML = `
                <td class="px-4 py-3 font-medium text-coffee-900 dark:text-white">${farmer}<br><span class="text-xs text-coffee-500">${roaster}</span></td>
                <td class="px-4 py-3">${origin}</td>
                <td class="px-4 py-3">${process}${variety}</td>
                <td class="px-4 py-3 text-center">${decafIcon}</td>
                <td class="px-4 py-3 text-center">${getRoastBadge(coffeeDisplay.roastType)}</td>
                <td class="px-4 py-3 text-center">
                    <input type="number" step="0.01" min="0" value="${bean.price ?? ''}"
                        ${isMine ? `data-action-change="saveBeanPrice('${bean.id}', this.value)"` : 'disabled'}
                        class="w-20 text-center text-sm border border-coffee-200 dark:border-[#44403c] rounded p-1 bg-coffee-50 dark:bg-[#1c1917] text-coffee-900 dark:text-white focus:ring-1 focus:ring-coffee-500 disabled:opacity-50 disabled:cursor-not-allowed" placeholder="-">
                </td>
                <td class="px-4 py-3 text-center">
                    <input type="number" step="1" value="${bean.stock || ''}"
                        ${isMine ? `data-action-change="saveBeanStock('${bean.id}', this.value)"` : 'disabled'}
                        class="w-20 text-center text-sm border border-coffee-200 dark:border-[#44403c] rounded p-1 bg-coffee-50 dark:bg-[#1c1917] text-coffee-900 dark:text-white focus:ring-1 focus:ring-coffee-500 disabled:opacity-50 disabled:cursor-not-allowed" placeholder="-">
                </td>
                <td class="px-4 py-3 text-center font-mono font-bold text-coffee-700 dark:text-[#d6ccc2]">${brewCount}</td>
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
                    ${actionsHtml}
                </td>
            `;
            return tr;
        };

        if (inStockBeans.length > 0) {
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-green-50 dark:bg-green-900/20';
            headerRow.innerHTML = '<td colspan="99" class="px-4 py-2 text-xs font-bold text-green-700 dark:text-green-300 uppercase tracking-wide"><i class="fa-solid fa-box-open mr-2"></i>Open Bags</td>';
            tbody.appendChild(headerRow);
            inStockBeans.forEach((bean) => tbody.appendChild(createRow(bean)));
        }

        if (frozenBeans.length > 0) {
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-blue-50 dark:bg-blue-900/20';
            headerRow.innerHTML = '<td colspan="99" class="px-4 py-2 text-xs font-bold text-blue-700 dark:text-blue-300 uppercase tracking-wide"><i class="fa-solid fa-snowflake mr-2"></i>Frozen</td>';
            tbody.appendChild(headerRow);
            frozenBeans.forEach((bean) => tbody.appendChild(createRow(bean)));
        }

        if (otherBeans.length > 0) {
            const headerRow = document.createElement('tr');
            headerRow.className = 'bg-gray-50 dark:bg-[#34302e]';
            headerRow.innerHTML = '<td colspan="99" class="px-4 py-2 text-xs font-bold text-gray-500 dark:text-[#a8a29e] uppercase tracking-wide"><i class="fa-solid fa-archive mr-2"></i>Finished / Archive</td>';
            tbody.appendChild(headerRow);
            otherBeans.forEach((bean) => tbody.appendChild(createRow(bean)));
        }
        updateBeansSortIcons();
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
        setBeansSort,
        updateBeansSortIcons,
        getFilteredSortedBeans,
        renderBeansTable,
        createDefaultBeansFilters
    };
};
