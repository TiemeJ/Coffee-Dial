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
    setColumnPreferences,
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
    let hasBoundResponsiveTableListener = false;
    let lastCompactMobileMode = null;
    let resizeRafId = null;
    let brewsTableStatePresetApi = {
        list: async () => [],
        saveByName: async () => false,
        load: async () => {},
        remove: async () => {}
    };
    let quickFilterActiveTab = 'save';
    const escapeHtml = (value) =>
        String(value ?? '')
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
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
    const MOBILE_ACCORDION_HEADER_FIELDS_KEY = 'mobileAccordionHeaderFields';
    const DEFAULT_MOBILE_ACCORDION_HEADER_FIELDS = ['method', 'drink', 'grind'];
    const getMobileAccordionHeaderFieldOptions = () => ([
        { key: 'method', label: 'Method' },
        { key: 'drink', label: 'Drink' },
        { key: 'grind', label: 'Grind' },
        { key: 'grinder', label: 'Grinder' },
        { key: 'recipe', label: 'Recipe' },
        { key: 'time', label: 'Time' },
        { key: 'temp', label: 'Temp' },
        { key: 'rating', label: 'Rating' },
        { key: 'date', label: 'Date' },
        { key: 'roastType', label: 'Roast' },
        { key: 'origin', label: 'Origin' }
    ]);
    const sanitizeMobileAccordionHeaderFields = (rawValue) => {
        const allowed = new Set(getMobileAccordionHeaderFieldOptions().map((item) => item.key));
        const items = Array.isArray(rawValue) ? rawValue : [];
        const normalized = [];
        items.forEach((item) => {
            const key = typeof item === 'string' ? item.trim() : '';
            if (!key || !allowed.has(key) || normalized.includes(key)) return;
            normalized.push(key);
        });
        const fallback = DEFAULT_MOBILE_ACCORDION_HEADER_FIELDS.filter((key) => allowed.has(key));
        fallback.forEach((key) => {
            if (normalized.length >= 3) return;
            if (!normalized.includes(key)) normalized.push(key);
        });
        while (normalized.length < 3) {
            const next = getMobileAccordionHeaderFieldOptions().find((item) => !normalized.includes(item.key));
            if (!next) break;
            normalized.push(next.key);
        }
        return normalized.slice(0, 3);
    };
    const getMobileAccordionHeaderFields = () => {
        try {
            const raw = localStorage.getItem(MOBILE_ACCORDION_HEADER_FIELDS_KEY);
            if (!raw) return [...DEFAULT_MOBILE_ACCORDION_HEADER_FIELDS];
            return sanitizeMobileAccordionHeaderFields(JSON.parse(raw));
        } catch (error) {
            return [...DEFAULT_MOBILE_ACCORDION_HEADER_FIELDS];
        }
    };
    const saveMobileAccordionHeaderFields = (fields) => {
        const normalized = sanitizeMobileAccordionHeaderFields(fields);
        try {
            localStorage.setItem(MOBILE_ACCORDION_HEADER_FIELDS_KEY, JSON.stringify(normalized));
        } catch (error) {
            // Ignore storage errors
        }
        return normalized;
    };
    const getHeaderFieldValue = ({ key, brew, typeDisplay, rowDisplay }) => {
        const outText = `${brew.weight || '-'}g -> ${brewsVm.formatOutWeightWithUnit(brew.weight, brew.ratio)} (1:${brew.ratio || '-'})`;
        const map = {
            method: brew.method || '-',
            drink: brew.drink || '-',
            grind: brew.grind || '-',
            grinder: brew.grinder || '-',
            recipe: outText,
            time: formatTime(brew.time) || '-',
            temp: (typeof brew.temp === 'number' || typeof brew.temp === 'string') ? `${brew.temp}` : '-',
            rating: brew.rating ? `${brew.rating}/5` : '-',
            date: `${rowDisplay.displayTime} ${rowDisplay.displayDate}`.trim(),
            roastType: typeDisplay.roastType || '-',
            origin: typeDisplay.origin || '-'
        };
        return map[key] || '-';
    };
    const formatAccordionHeaderDateTime = (value) => {
        if (!value) return { time: '--:--', date: '--.--.--' };
        const date = typeof value?.toDate === 'function' ? value.toDate() : new Date(value);
        if (Number.isNaN(date.getTime())) return { time: '--:--', date: '--.--.--' };
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        return {
            time: `${hh}:${mm}`,
            date: `${dd}.${month}.${yy}`
        };
    };
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
    const setSortChain = (nextChain = []) => {
        setCurrentSort(normalizeSortChain(nextChain));
    };
    const getSortableFields = () => {
        const preferredOrder = [
            'roaster', 'origin', 'farmer', 'variety', 'processing', 'decaf', 'roastType',
            'method', 'grinder', 'grind', 'recipe', 'time', 'temp', 'drink', 'notes', 'improve', 'rating', 'date'
        ];
        const fromDefs = (getColumnDefs() || []).map((col) => ({
            key: col.id === 'date' ? 'createdAt' : col.id,
            label: col.label || getFilterLabel(col.id)
        }));
        const dedup = new Map();
        fromDefs.forEach((item) => {
            if (!item.key || dedup.has(item.key)) return;
            dedup.set(item.key, item);
        });
        preferredOrder.forEach((id) => {
            const key = id === 'date' ? 'createdAt' : id;
            if (dedup.has(key)) return;
            dedup.set(key, { key, label: getFilterLabel(id) });
        });
        return Array.from(dedup.values());
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
        const sortChain = normalizeSortChain(getCurrentSort());
        keys.forEach((key) => {
            const el = document.getElementById(`brewSortIcon-${key}`);
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

    const clearSearch = () => {
        const input = document.getElementById('globalSearch');
        if (input) input.value = '';
        setDisplayedBrewsCount(getBrewsPerPage());
        renderTable();
        document.getElementById('searchClearBtn')?.classList.add('hidden');
        input?.focus();
    };

    const sortBy = (key) => {
        const sortChain = normalizeSortChain(getCurrentSort());
        const existingIndex = sortChain.findIndex((item) => item.key === key);
        if (existingIndex < 0) {
            setSortChain([{ key, direction: 'asc' }, ...sortChain]);
        } else if (existingIndex === 0) {
            const next = [...sortChain];
            if (next[0].direction === 'asc') {
                next[0] = { ...next[0], direction: 'desc' };
                setSortChain(next);
            } else {
                // Third state: remove this sort key; keep remaining multi-sort keys.
                setSortChain(next.slice(1));
            }
        } else {
            // Clicking a non-primary sorted column promotes it as primary (starts at asc).
            const withoutKey = sortChain.filter((item) => item.key !== key);
            setSortChain([{ key, direction: 'asc' }, ...withoutKey]);
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
        const input = document.getElementById('globalSearch');
        if (input) input.value = '';
        document.getElementById('searchClearBtn')?.classList.add('hidden');
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

            list.innerHTML += `<div class="flex items-center gap-2 bg-coffee-700 dark:bg-[#57534e] text-white text-xs px-3 py-1 rounded-full shadow-sm"><span>${label}:</span><b>${displayValue}</b><button data-action-click="applyFilter('${key}',null)" aria-label="Remove filter" title="Remove filter" class="ml-1 hover:text-red-200">x</button></div>`;
        });

        container.classList.toggle('hidden', !hasFilters);
    };

    const toggleQuickFilter = async (e) => {
        e.stopPropagation();
        const dropdown = document.getElementById('quickFilterDropdown');
        const valuesDropdown = document.getElementById('quickFilterValuesDropdown');
        const stateDropdown = document.getElementById('brewsTableStateDropdown');
        if (!dropdown || !valuesDropdown) return;

        valuesDropdown.classList.add('hidden');
        if (stateDropdown) stateDropdown.classList.add('hidden');
        if (!dropdown.classList.contains('hidden')) {
            dropdown.classList.add('hidden');
            return;
        }

        const presets = await brewsTableStatePresetApi.list();
        const sortOptions = getSortableFields();
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
        const sortChain = normalizeSortChain(getCurrentSort());

        const presetRows = presets.length
            ? presets.map((preset) => {
                const presetId = escapeHtml(preset?.id || '');
                const presetName = escapeHtml(preset?.name || 'Untitled');
                const updatedAt = new Date(preset?.updatedAt || Date.now()).toLocaleDateString();
                return `<div class="flex items-center gap-1">
                    <button type="button" data-quick-preset-load="${presetId}" class="flex-1 text-left px-2 py-1.5 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] hover:bg-coffee-50 dark:hover:bg-[#34302e]">
                        <div class="text-[11px] font-semibold text-coffee-800 dark:text-white truncate">${presetName}</div>
                        <div class="text-[10px] text-coffee-400 dark:text-[#78716c]">Saved ${updatedAt}</div>
                    </button>
                    <button type="button" data-quick-preset-delete="${presetId}" class="w-11 h-11 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center" title="Delete">
                        <i class="fa-solid fa-trash text-[10px]"></i>
                    </button>
                </div>`;
            }).join('')
            : '<div class="text-[11px] text-coffee-500 dark:text-[#78716c] italic">No saved states yet.</div>';

        const columnPreferences = getColumnPreferences() || {};
        const accordionHeaderFields = getMobileAccordionHeaderFields();
        const isAccordionSettingsMode = isCompactMobileTableMode();
        let html = '<div class="px-3 py-2 border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between gap-2">';
        html += '<div class="inline-flex items-center gap-1 bg-coffee-100 dark:bg-[#1c1917] rounded p-0.5">';
        html += '<button type="button" data-quick-tab="save" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold bg-white dark:bg-[#292524] text-coffee-800 dark:text-white">Presets</button>';
        html += '<button type="button" data-quick-tab="filter" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold text-coffee-600 dark:text-[#a8a29e]">Filter</button>';
        html += '<button type="button" data-quick-tab="sort" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold text-coffee-600 dark:text-[#a8a29e]">Sort</button>';
        html += '<button type="button" data-quick-tab="settings" class="quick-tab-btn px-2 py-1 rounded text-xs font-semibold text-coffee-600 dark:text-[#a8a29e]" title="Settings" aria-label="Open quick filter settings"><i class="fa-solid fa-gear"></i></button>';
        html += '</div>';
        html += '<button type="button" data-action-click="toggleQuickFilter(event)" class="w-11 h-11 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-coffee-600 dark:text-[#a8a29e] hover:bg-coffee-50 dark:hover:bg-[#34302e] flex items-center justify-center" title="Close"><i class="fa-solid fa-xmark text-[11px]"></i></button>';
        html += '</div>';

        html += '<div id="quickFilterSavePanel" class="px-3 py-2 space-y-2">';
        html += '<div class="grid grid-cols-[1fr_auto] gap-1.5">';
        html += '<input id="quickFilterStateNameInput" type="text" maxlength="40" placeholder="Name this state" class="w-full px-2 py-1.5 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-xs text-coffee-900 dark:text-white" />';
        html += '<button type="button" id="quickFilterSaveStateBtn" class="px-2 py-1.5 rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white text-xs font-bold">Save</button>';
        html += '</div>';
        html += `<div class="max-h-44 overflow-y-auto space-y-1">${presetRows}</div>`;
        html += '</div>';

        html += '<div id="quickFilterFilterPanel" class="hidden pb-2">';
        filterCategories.forEach((cat) => {
            const isActive = activeFilters[cat.key] !== null;
            const activeClass = isActive ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
            html += `<button data-action-click="openQuickFilterValues(event, '${cat.key}', '${cat.label}')" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] flex items-center justify-between ${activeClass}"><span>${cat.label}</span>${
                isActive
                    ? '<i class="fa-solid fa-check text-coffee-600 dark:text-[#a8a29e] text-xs"></i>'
                    : '<i class="fa-solid fa-chevron-right text-coffee-300 dark:text-[#57534e] text-xs"></i>'
            }</button>`;
        });
        html += '</div>';

        html += '<div id="quickFilterSortPanel" class="hidden px-3 py-2 grid grid-cols-2 gap-1.5">';
        html += '<div class="col-span-2 text-[10px] font-bold text-coffee-400 dark:text-[#78716c] uppercase">Sort chain</div>';
        html += '<div id="quickFilterSortChain" class="col-span-2 space-y-1">';
        if (!sortChain.length) {
            html += '<div class="text-[11px] text-coffee-500 dark:text-[#78716c] italic">No sort fields selected.</div>';
        } else {
            sortChain.forEach((item, idx) => {
                const field = sortOptions.find((option) => option.key === item.key);
                const label = field?.label || getFilterLabel(item.key === 'createdAt' ? 'date' : item.key);
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
        html += '<select id="quickFilterSortAddSelect" aria-label="Add sort field" class="w-full px-2 py-1.5 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-xs text-coffee-900 dark:text-white">';
        html += '<option value="">Add field...</option>';
        availableToAdd.forEach((option) => {
            html += `<option value="${escapeHtml(option.key)}">${escapeHtml(option.label)}</option>`;
        });
        html += '</select>';
        html += '<button type="button" id="quickFilterSortAddBtn" class="px-2 py-1.5 rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white text-xs font-bold">Add</button>';
        html += '</div>';
        html += '</div>';

        html += '<div id="quickFilterSettingsPanel" class="hidden px-3 py-2 space-y-2">';
        if (isAccordionSettingsMode) {
            const fieldOptions = getMobileAccordionHeaderFieldOptions();
            html += '<div class="text-[10px] font-bold text-coffee-400 dark:text-[#78716c] uppercase">Accordion header fields</div>';
            html += '<p class="text-[11px] text-coffee-500 dark:text-[#78716c]">Choose the 3 fields shown under farmer and roaster.</p>';
            for (let index = 0; index < 3; index += 1) {
                html += `<div class="grid grid-cols-[70px_1fr] items-center gap-2">
                    <span class="text-[11px] font-semibold text-coffee-600 dark:text-[#a8a29e]">Field ${index + 1}</span>
                    <select data-quick-accordion-field-index="${index}" aria-label="Accordion header field" class="w-full px-2 py-1.5 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-xs text-coffee-900 dark:text-white">`;
                fieldOptions.forEach((option) => {
                    const selected = accordionHeaderFields[index] === option.key ? 'selected' : '';
                    html += `<option value="${escapeHtml(option.key)}" ${selected}>${escapeHtml(option.label)}</option>`;
                });
                html += '</select></div>';
            }
        } else {
            html += '<div class="text-[10px] font-bold text-coffee-400 dark:text-[#78716c] uppercase">Table columns</div>';
            getColumnDefs().forEach((col) => {
                const isChecked = columnPreferences[col.id] !== false;
                html += `<label class="flex items-center justify-between p-2 rounded bg-coffee-50 dark:bg-[#1c1917] border border-coffee-100 dark:border-[#44403c]">
                    <span class="text-xs font-medium text-coffee-800 dark:text-[#d6ccc2]">${escapeHtml(col.label)}</span>
                    <div class="relative inline-block w-10 align-middle select-none">
                        <input type="checkbox" data-quick-setting-col="${escapeHtml(col.id)}" ${isChecked ? 'checked' : ''} class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 dark:border-gray-600" />
                        <span class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 dark:bg-gray-700"></span>
                    </div>
                </label>`;
            });
        }
        html += '</div>';
        dropdown.innerHTML = html;

        const rerenderOpenPanel = async (event) => {
            event.stopPropagation();
            dropdown.classList.add('hidden');
            await toggleQuickFilter(event);
        };

        const saveBtn = document.getElementById('quickFilterSaveStateBtn');
        const saveInput = document.getElementById('quickFilterStateNameInput');
        const tabButtons = Array.from(dropdown.querySelectorAll('[data-quick-tab]'));
        const tabPanels = {
            save: document.getElementById('quickFilterSavePanel'),
            filter: document.getElementById('quickFilterFilterPanel'),
            sort: document.getElementById('quickFilterSortPanel'),
            settings: document.getElementById('quickFilterSettingsPanel')
        };
        const activateTab = (tabId) => {
            const normalizedTabId = (tabId === 'filter' || tabId === 'sort' || tabId === 'settings') ? tabId : 'save';
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
                activateTab(btn.getAttribute('data-quick-tab') || 'save');
            });
        });
        const rerenderOpenPanelNoToggle = async () => {
            const syntheticEvent = { stopPropagation: () => {} };
            dropdown.classList.add('hidden');
            quickFilterActiveTab = 'sort';
            await toggleQuickFilter(syntheticEvent);
        };
        const sortAddBtn = document.getElementById('quickFilterSortAddBtn');
        const sortAddSelect = document.getElementById('quickFilterSortAddSelect');
        sortAddBtn?.addEventListener('click', async (event) => {
            event.stopPropagation();
            const key = sortAddSelect?.value || '';
            if (!key) return;
            const next = [...sortChain, { key, direction: 'asc' }];
            setSortChain(next);
            setDisplayedBrewsCount(getBrewsPerPage());
            renderTable();
            updateBrewSortIcons();
            await rerenderOpenPanelNoToggle();
        });
        dropdown.querySelectorAll('[data-quick-sort-toggle]').forEach((btn) => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-toggle') || '';
                if (!key) return;
                const next = sortChain.map((item) => item.key === key ? { ...item, direction: item.direction === 'asc' ? 'desc' : 'asc' } : item);
                setSortChain(next);
                setDisplayedBrewsCount(getBrewsPerPage());
                renderTable();
                updateBrewSortIcons();
                await rerenderOpenPanelNoToggle();
            });
        });
        dropdown.querySelectorAll('[data-quick-sort-remove]').forEach((btn) => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-remove') || '';
                if (!key) return;
                const next = sortChain.filter((item) => item.key !== key);
                setSortChain(next);
                setDisplayedBrewsCount(getBrewsPerPage());
                renderTable();
                updateBrewSortIcons();
                await rerenderOpenPanelNoToggle();
            });
        });
        dropdown.querySelectorAll('[data-quick-sort-up]').forEach((btn) => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-up') || '';
                const idx = sortChain.findIndex((item) => item.key === key);
                if (idx <= 0) return;
                const next = [...sortChain];
                const tmp = next[idx - 1];
                next[idx - 1] = next[idx];
                next[idx] = tmp;
                setSortChain(next);
                setDisplayedBrewsCount(getBrewsPerPage());
                renderTable();
                updateBrewSortIcons();
                await rerenderOpenPanelNoToggle();
            });
        });
        dropdown.querySelectorAll('[data-quick-sort-down]').forEach((btn) => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const key = btn.getAttribute('data-quick-sort-down') || '';
                const idx = sortChain.findIndex((item) => item.key === key);
                if (idx < 0 || idx >= sortChain.length - 1) return;
                const next = [...sortChain];
                const tmp = next[idx + 1];
                next[idx + 1] = next[idx];
                next[idx] = tmp;
                setSortChain(next);
                setDisplayedBrewsCount(getBrewsPerPage());
                renderTable();
                updateBrewSortIcons();
                await rerenderOpenPanelNoToggle();
            });
        });
        dropdown.querySelectorAll('[data-quick-setting-col]').forEach((checkbox) => {
            checkbox.addEventListener('change', (event) => {
                event.stopPropagation();
                const target = event.currentTarget;
                const colId = target?.getAttribute('data-quick-setting-col') || '';
                if (!colId) return;
                const nextPrefs = {
                    ...getColumnPreferences(),
                    [colId]: !!target.checked
                };
                setColumnPreferences(nextPrefs);
                localStorage.setItem('columnPreferences', JSON.stringify(nextPrefs));
                renderTable();
            });
        });
        dropdown.querySelectorAll('[data-quick-accordion-field-index]').forEach((selectEl) => {
            selectEl.addEventListener('change', (event) => {
                event.stopPropagation();
                const selects = Array.from(dropdown.querySelectorAll('[data-quick-accordion-field-index]'));
                const next = selects.map((el) => el.value);
                const normalized = saveMobileAccordionHeaderFields(next);
                selects.forEach((el, idx) => {
                    if (normalized[idx]) el.value = normalized[idx];
                });
                renderTable();
            });
        });
        saveBtn?.addEventListener('click', async (event) => {
            event.stopPropagation();
            const name = saveInput?.value?.trim() || '';
            if (!name) return;
            const saved = await brewsTableStatePresetApi.saveByName(name);
            if (!saved) return;
            await rerenderOpenPanel(event);
        });
        dropdown.querySelectorAll('[data-quick-preset-load]').forEach((btn) => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const presetId = btn.getAttribute('data-quick-preset-load') || '';
                if (!presetId) return;
                await brewsTableStatePresetApi.load(presetId);
                dropdown.classList.add('hidden');
            });
        });
        dropdown.querySelectorAll('[data-quick-preset-delete]').forEach((btn) => {
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const presetId = btn.getAttribute('data-quick-preset-delete') || '';
                if (!presetId) return;
                await brewsTableStatePresetApi.remove(presetId);
                await rerenderOpenPanel(event);
            });
        });

        activateTab(quickFilterActiveTab);
        dropdown.classList.remove('hidden');
    };

    const setBrewsTableStatePresetApi = (api = {}) => {
        brewsTableStatePresetApi = {
            list: typeof api.list === 'function' ? api.list : brewsTableStatePresetApi.list,
            saveByName: typeof api.saveByName === 'function' ? api.saveByName : brewsTableStatePresetApi.saveByName,
            load: typeof api.load === 'function' ? api.load : brewsTableStatePresetApi.load,
            remove: typeof api.remove === 'function' ? api.remove : brewsTableStatePresetApi.remove
        };
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
            let html = `<div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c] flex items-center justify-between"><span>${label}</span><button data-action-click="toggleQuickFilter(event)" class="w-11 h-11 flex items-center justify-center text-coffee-400 hover:text-coffee-600 dark:hover:text-white" aria-label="Back to quick filter" title="Back"><i class="fa-solid fa-arrow-left"></i></button></div>`;
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
        quickFilterActiveTab = 'filter';
        const quickMain = document.getElementById('quickFilterDropdown');
        const quickValues = document.getElementById('quickFilterValuesDropdown');
        if (quickMain) quickMain.classList.add('hidden');
        if (quickValues) quickValues.classList.add('hidden');
        const syntheticEvent = { stopPropagation: () => {} };
        toggleQuickFilter(syntheticEvent);
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
        setSortChain([{ key: 'createdAt', direction: 'desc' }]);
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
        const typeDisplay = getCoffeeTypeDisplay(brew);
        const rowDisplay = brewsVm.buildTableRowDisplayModel({
            brew,
            typeDisplay
        });

        const menuId = `action-menu-${brew.id}`;
        let actions = '';

        if (getCurrentView() === 'mine') {
            actions = `<div class="relative"><button data-action-click="brewsToggleActionMenu('${menuId}', event)" class="w-12 h-12 flex items-center justify-center text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]" aria-label="Open brew actions" title="Actions"><i class="fa-solid fa-ellipsis-vertical text-lg"></i></button><div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden"><button data-action-click="brewsOpenCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card</button><button data-action-click="editCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-pencil text-blue-500 w-4"></i> Edit</button><button data-action-click="fastRepeatCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-bolt text-amber-500 w-4"></i> Fast repeat</button><button data-action-click="duplicateCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-regular fa-copy text-green-500 w-4"></i> Repeat</button><button data-action-click="showBeanForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button><button data-action-click="showCoffeeForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button><button data-action-click="openUploadModal('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-camera text-purple-500 w-4"></i> Share moment</button><hr class="border-coffee-100 dark:border-[#44403c]"><button data-action-click="deleteCoffee('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3"><i class="fa-solid fa-trash w-4"></i> Delete</button></div></div>`;
        } else {
            actions = `<div class="relative"><button data-action-click="brewsToggleActionMenu('${menuId}', event)" class="w-12 h-12 flex items-center justify-center text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]" aria-label="Open brew actions" title="Actions"><i class="fa-solid fa-ellipsis-vertical text-lg"></i></button><div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden"><button data-action-click="brewsOpenCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card</button><button data-action-click="showBeanForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button><button data-action-click="showCoffeeForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button><button data-action-click="cloneBrew('${brew.id}'); event.stopPropagation();" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-file-import text-green-500 w-4"></i> Clone to my brews</button></div></div>`;
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
                renderTable();
            });
        };

        if (typeof media.addEventListener === 'function') media.addEventListener('change', scheduleCheck);
        else if (typeof media.addListener === 'function') media.addListener(scheduleCheck);
        window.addEventListener('resize', scheduleCheck);
        window.addEventListener('orientationchange', scheduleCheck);
    };

    const getMobileHeaderSummaryItems = ({ brew, typeDisplay, rowDisplay }) => {
        const configured = getMobileAccordionHeaderFields();
        return configured.map((key) => ({
            id: key,
            label: getFilterLabel(key === 'date' ? 'createdAt' : key),
            value: getHeaderFieldValue({ key, brew, typeDisplay, rowDisplay })
        }));
    };
    const renderTinyHeaderStars = (rating) => {
        const count = Math.max(0, Math.min(5, Number(rating) || 0));
        if (!count) return '';
        let html = '';
        for (let i = 0; i < count; i += 1) {
            html += '<i class="fa-solid fa-star text-[7px] text-yellow-400"></i>';
        }
        return html;
    };

    const buildMobilePhotoHtml = (brew) => {
        const type = getCoffeeTypeForBrew?.(brew) || null;
        const imageUrl = type?.imageUrl || type?.imageURL || '';
        if (imageUrl) {
            return `<img src="${imageUrl}" alt="Coffee image" class="w-12 h-12 rounded-lg object-cover border border-coffee-200 dark:border-[#44403c]" loading="lazy">`;
        }
        return '<div class="w-12 h-12 rounded-lg bg-coffee-100 dark:bg-[#34302e] border border-coffee-200 dark:border-[#44403c] flex items-center justify-center text-coffee-400 dark:text-[#78716c]"><i class="fa-solid fa-mug-saucer text-sm"></i></div>';
    };

    const generateMobileAccordionRow = (brew) => {
        const typeDisplay = getCoffeeTypeDisplay(brew);
        const rowDisplay = brewsVm.buildTableRowDisplayModel({
            brew,
            typeDisplay
        });

        const menuId = `action-menu-${brew.id}`;
        let actions = '';
        if (getCurrentView() === 'mine') {
            actions = `<div class="relative"><button data-action-click="brewsToggleActionMenu('${menuId}', event)" class="w-12 h-12 flex items-center justify-center text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]" aria-label="Open brew actions" title="Actions"><i class="fa-solid fa-ellipsis-vertical text-lg"></i></button><div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden"><button data-action-click="brewsOpenCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card</button><button data-action-click="editCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-pencil text-blue-500 w-4"></i> Edit</button><button data-action-click="fastRepeatCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-bolt text-amber-500 w-4"></i> Fast repeat</button><button data-action-click="duplicateCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-regular fa-copy text-green-500 w-4"></i> Repeat</button><button data-action-click="showBeanForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button><button data-action-click="showCoffeeForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button><button data-action-click="openUploadModal('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-camera text-purple-500 w-4"></i> Share moment</button><hr class="border-coffee-100 dark:border-[#44403c]"><button data-action-click="deleteCoffee('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3"><i class="fa-solid fa-trash w-4"></i> Delete</button></div></div>`;
        } else {
            actions = `<div class="relative"><button data-action-click="brewsToggleActionMenu('${menuId}', event)" class="w-12 h-12 flex items-center justify-center text-coffee-500 hover:text-coffee-800 dark:text-[#a8a29e] dark:hover:text-white transition-colors rounded-full hover:bg-coffee-50 dark:hover:bg-[#34302e]" aria-label="Open brew actions" title="Actions"><i class="fa-solid fa-ellipsis-vertical text-lg"></i></button><div id="${menuId}" class="action-menu hidden absolute right-0 mt-1 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] z-[70] overflow-hidden"><button data-action-click="brewsOpenCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-id-card text-indigo-500 w-4"></i> View card</button><button data-action-click="showBeanForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button><button data-action-click="showCoffeeForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button><button data-action-click="cloneBrew('${brew.id}'); event.stopPropagation();" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-file-import text-green-500 w-4"></i> Clone to my brews</button></div></div>`;
        }

        const summaryItems = getMobileHeaderSummaryItems({ brew, typeDisplay, rowDisplay });
        const summaryHtml = summaryItems.length
            ? summaryItems.map((item) => `<span class="inline-flex items-center px-1.5 py-0.5 rounded bg-coffee-100 dark:bg-[#34302e] text-[10px] text-coffee-700 dark:text-[#d6ccc2]">${item.value}</span>`).join('')
            : '<span class="text-[11px] text-coffee-500 dark:text-[#a8a29e] italic">Tap to view details</span>';
        const headerFieldSet = new Set(getMobileAccordionHeaderFields());
        const headerDateTime = formatAccordionHeaderDateTime(brew.createdAt);
        const ratingValue = Number(brew.rating);
        const headerRatingHtml = ratingValue > 0
            ? `<div class="mt-0.5 leading-none">${renderTinyHeaderStars(ratingValue)}</div>`
            : '';
        const cardVm = brewsVm.buildCardDisplayViewModel({ brew, coffeeType: typeDisplay });
        const graphVm = brewsVm.buildCardGraphData(brew);
        const hasGraph = !!graphVm.hasGraph;
        const weightVal = parseFloat(brew.weight);
        const ratioVal = parseFloat(brew.ratio);
        const outVal = !isNaN(weightVal) && !isNaN(ratioVal) ? (weightVal * ratioVal).toFixed(1) : '';
        const formatMetric = (value) => {
            if (value === null || typeof value === 'undefined' || value === '') return '-';
            const numeric = Number(value);
            if (!Number.isFinite(numeric)) return '-';
            return `${numeric}`;
        };
        const graphSummaryCardOne = `
            <div class="bg-coffee-50/50 dark:bg-[#201d1b] p-3 rounded-lg border border-coffee-100 dark:border-[#44403c]">
                <div class="grid grid-cols-3 gap-2">
                    <div>
                        <label class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] mb-1 uppercase text-center">In (g)</label>
                        <div class="w-full text-center font-mono bg-white dark:bg-[#1c1917] border border-coffee-200 dark:border-[#44403c] rounded px-2 py-1.5 text-sm text-coffee-900 dark:text-white">${!isNaN(weightVal) ? weightVal : '-'}</div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] mb-1 uppercase text-center">Ratio 1:X</label>
                        <div class="w-full text-center font-mono bg-coffee-50 dark:bg-[#1c1917] border border-coffee-200 dark:border-[#44403c] rounded px-2 py-1.5 text-sm text-coffee-900 dark:text-white">${!isNaN(ratioVal) ? ratioVal : '-'}</div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] mb-1 uppercase text-center">Out (g)</label>
                        <div class="w-full text-center font-mono bg-white dark:bg-[#1c1917] border border-coffee-200 dark:border-[#44403c] rounded px-2 py-1.5 text-sm text-coffee-900 dark:text-white">${outVal || '-'}</div>
                    </div>
                </div>
            </div>
        `;
        const graphSummaryCardTwo = `
            <div class="bg-coffee-50/50 dark:bg-[#201d1b] p-3 rounded-lg border border-coffee-100 dark:border-[#44403c]">
                <div class="grid grid-cols-3 gap-2">
                    <div>
                        <label class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] mb-1 uppercase text-center">First drip</label>
                        <div class="w-full text-center font-mono bg-white dark:bg-[#1c1917] border border-coffee-200 dark:border-[#44403c] rounded px-2 py-1.5 text-sm text-coffee-900 dark:text-white">${formatMetric(brew.firstDrip)}</div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] mb-1 uppercase text-center">Max flow</label>
                        <div class="w-full text-center font-mono bg-white dark:bg-[#1c1917] border border-coffee-200 dark:border-[#44403c] rounded px-2 py-1.5 text-sm text-coffee-900 dark:text-white">${formatMetric(brew.maxFlow)}</div>
                    </div>
                    <div>
                        <label class="block text-[10px] font-bold text-coffee-500 dark:text-[#78716c] mb-1 uppercase text-center">Avg flow</label>
                        <div class="w-full text-center font-mono bg-white dark:bg-[#1c1917] border border-coffee-200 dark:border-[#44403c] rounded px-2 py-1.5 text-sm text-coffee-900 dark:text-white">${formatMetric(brew.avgFlow)}</div>
                    </div>
                </div>
            </div>
        `;
        const bodyTextFields = [
            { key: 'origin', label: 'Origin', value: cardVm.origin },
            { key: 'processing', label: 'Process', value: cardVm.processing },
            { key: 'roastType', label: 'Roast', value: cardVm.roastType },
            { key: 'drink', label: 'Drink', value: cardVm.drink },
            { key: 'method', label: 'Method', value: cardVm.method }
        ]
            .filter((item) => !headerFieldSet.has(item.key))
            .filter((item) => (item.value || '').toString().trim() && item.value !== '-');
        const bodyTextFieldsHtml = bodyTextFields.length
            ? `<div class="grid grid-cols-2 gap-y-3 gap-x-4 text-sm">${bodyTextFields
                .map((item) => `<div class="${item.key === 'method' ? 'col-span-2' : ''}"><span class="block text-xs font-bold text-coffee-500 dark:text-[#78716c] uppercase mb-0.5">${item.label}</span><span class="font-medium text-coffee-800 dark:text-[#d6ccc2]">${item.value}</span></div>`)
                .join('')}</div>`
            : '';
        const detailsHtml = `
            <div class="pt-2 space-y-3">
                ${bodyTextFieldsHtml}
                <div class="bg-coffee-50 dark:bg-[#1c1917] rounded-xl p-4 border border-coffee-100 dark:border-[#44403c]">
                    <div class="flex justify-between items-center mb-3">
                        <span class="text-xs font-bold text-coffee-500 dark:text-[#78716c] uppercase"><i class="fa-solid fa-flask mr-1"></i> Brew Stats</span>
                        ${hasGraph
                            ? `<button data-action-click="openBrewCardGraph('${brew.id}', event)" class="text-coffee-400 hover:text-coffee-700 dark:text-[#78716c] dark:hover:text-white transition-colors" title="View Graph" aria-label="View brew graph"><i class="fa-solid fa-chart-line"></i></button>`
                            : ''}
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-center mb-3">
                        <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">In</div><div class="font-mono font-bold text-coffee-900 dark:text-white">${cardVm.weightText}</div></div>
                        <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Ratio</div><div class="font-mono font-bold text-coffee-900 dark:text-white">${cardVm.ratioText}</div></div>
                        <div class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Out</div><div class="font-mono font-bold text-coffee-900 dark:text-white">${cardVm.outText}</div></div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-center border-t border-coffee-200 dark:border-[#44403c] pt-2">
                        <div><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase truncate px-1">${cardVm.grinderTitle}</div><div class="font-bold text-coffee-800 dark:text-[#d6ccc2]">${cardVm.grinderValue}</div></div>
                        <div><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Time</div><div class="font-bold text-coffee-800 dark:text-[#d6ccc2]">${formatTime(brew.time)}</div></div>
                        <div><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Temp</div><div class="font-bold text-coffee-800 dark:text-[#d6ccc2]">${getTempBadge(brew.temp)}</div></div>
                    </div>
                </div>
                ${graphSummaryCardOne}
                ${graphSummaryCardTwo}
                ${cardVm.hasNotes ? `<div><span class="block text-xs font-bold text-coffee-500 dark:text-[#78716c] uppercase mb-1">Notes</span><p class="text-sm text-coffee-800 dark:text-[#d6ccc2] italic bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/20">${cardVm.notesText}</p></div>` : ''}
                ${cardVm.hasImprove ? `<div><span class="block text-xs font-bold text-red-500 dark:text-red-400 uppercase mb-1">To Improve</span><p class="text-sm text-coffee-800 dark:text-[#d6ccc2] bg-red-50 dark:bg-red-900/10 p-2 rounded-lg border border-red-100 dark:border-red-900/20">${cardVm.improveText}</p></div>` : ''}
            </div>
        `;

        const row = document.createElement('tr');
        row.className = 'relative bg-white dark:bg-[#292524] border-b border-coffee-100 dark:border-[#44403c] align-top';
        row.setAttribute('data-id', brew.id);
        row.innerHTML = `
            <td colspan="99" class="relative overflow-visible px-2 py-1.5">
                <div class="relative overflow-visible rounded-lg border border-coffee-100 dark:border-[#44403c] bg-coffee-50 dark:bg-[#1c1917]">
                    <div role="button" tabindex="0" data-mobile-accordion-header="true" class="w-full text-left px-2 py-2 cursor-pointer">
                        <div class="flex items-start gap-2">
                            <div class="flex-shrink-0">${buildMobilePhotoHtml(brew)}</div>
                            <div class="min-w-0 flex-1">
                                <div class="text-sm font-semibold text-coffee-900 dark:text-white truncate inline-flex items-center gap-1">${typeDisplay.farmer || '-'}${typeDisplay.decaf ? '<i class="fa-solid fa-moon text-[10px] text-coffee-500 dark:text-[#a8a29e]" title="Decaf"></i>' : ''}</div>
                                <div class="text-xs text-coffee-600 dark:text-[#a8a29e] truncate">${rowDisplay.displayRoaster || '-'}</div>
                                ${headerRatingHtml}
                            </div>
                            <div class="ml-auto flex-shrink-0 self-start pl-1">
                                <div data-action-click="event.stopPropagation()" class="relative z-20 flex items-center gap-2">
                                    ${actions}
                                </div>
                            </div>
                        </div>
                        <div class="mt-2 flex items-end justify-between gap-2">
                            <div class="flex flex-wrap gap-1 min-w-0">
                                ${summaryHtml}
                            </div>
                            <div class="text-[10px] leading-tight text-right text-coffee-500 dark:text-[#a8a29e] font-mono whitespace-nowrap">
                                <div>${headerDateTime.time}</div>
                                <div>${headerDateTime.date}</div>
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
                openBrewCard(brew.id, event);
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
    };

    const renderTable = () => {
        ensureResponsiveTableListener();
        const tableBody = document.getElementById('coffeeTableBody');
        const empty = document.getElementById('emptyState');
        const loadMoreContainer = document.getElementById('loadMoreContainer');
        if (!tableBody || !empty) return;

        const tableHead = document.querySelector('#brewsTableMount thead');
        const mobileAccordionMode = isCompactMobileTableMode();
        lastCompactMobileMode = mobileAccordionMode;
        if (tableHead) tableHead.classList.toggle('hidden', mobileAccordionMode);

        updateBrewSortIcons();
        if (mobileAccordionMode) {
            getColumnDefs().forEach((col) => {
                const th = document.getElementById(`th-${col.id}`);
                if (!th) return;
                th.classList.remove('hidden');
            });
        } else {
            getColumnDefs().forEach((col) => {
                const th = document.getElementById(`th-${col.id}`);
                if (!th) return;
                if (getColumnPreferences()[col.id] === false) th.classList.add('hidden');
                else th.classList.remove('hidden');
            });
        }

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
                tableBody.appendChild(mobileAccordionMode ? generateMobileAccordionRow(historyBrews[i]) : generateRow(historyBrews[i]));
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
        setBrewsTableStatePresetApi,
        openQuickFilterValues,
        applyFilterFromQuick,
        getFilteredCoffees,
        getTempBadge,
        refreshTableData,
        renderTable,
        loadMoreBrews
    };
};
