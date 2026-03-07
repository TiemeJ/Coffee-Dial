import { DeviceManager } from '../devices/device-manager.js';

export const createBrewsFormModule = ({ setTempMode, setRating, setNotesMode, getCoffeeScale, getGasItems, fillBeanDetails }) => {
    let brewGearSelection = new Set();
    let brewGearFilter = '';
    let hasBoundBrewGearUi = false;
    let includeArchivedGearInForm = false;

    const getBrewGearOptions = () => {
        const items = Array.isArray(getGasItems?.()) ? getGasItems() : [];
        return items
            .filter((item) => includeArchivedGearInForm || !item?.archived)
            .map((item) => ({ id: item.id, label: (item.name || 'Untitled gear').toString().trim() || 'Untitled gear' }))
            .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    };

    const getBrewGearUi = () => ({
        wrap: document.getElementById('brewGearMultiSelectWrap'),
        root: document.getElementById('brewGearMultiSelect'),
        control: document.getElementById('brewGearControl'),
        pills: document.getElementById('brewGearPills'),
        search: document.getElementById('brewGearSearch'),
        dropdown: document.getElementById('brewGearDropdown')
    });
    const getBrewGrinderFieldWrap = () => document.getElementById('brewGrinderFieldWrap');

    const isGrinderGear = (item) => (item?.type || '').toString().toLowerCase() === 'grinder';
    const hasActiveGrinderGear = () =>
        (Array.isArray(getGasItems?.()) ? getGasItems() : []).some((item) => !item?.archived && isGrinderGear(item));

    const normalizeBrewGearSelection = (ids) => {
        if (!Array.isArray(ids)) return [];
        const validIds = new Set(getBrewGearOptions().map((option) => option.id));
        return [...new Set(ids.filter((id) => validIds.has(id)))];
    };

    const renderBrewGearPills = () => {
        const { pills, search } = getBrewGearUi();
        if (!pills || !search) return;
        const optionMap = new Map(getBrewGearOptions().map((option) => [option.id, option.label]));
        const selectedIds = [...brewGearSelection];
        pills.innerHTML = selectedIds
            .map((id) => {
                const label = optionMap.get(id) || 'Unknown gear';
                return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-coffee-100 dark:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2]">${label}<button type="button" data-brew-gear-remove="${id}" aria-label="Remove gear" title="Remove gear" class="text-coffee-500 dark:text-[#a8a29e] hover:text-red-500">&times;</button></span>`;
            })
            .join('');
        search.placeholder = selectedIds.length ? '' : 'Search gear...';
    };

    const renderBrewGearDropdown = () => {
        const { dropdown } = getBrewGearUi();
        if (!dropdown) return;
        const q = (brewGearFilter || '').toLowerCase().trim();
        const options = getBrewGearOptions().filter((option) => option.label.toLowerCase().includes(q));
        if (!options.length) {
            dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-coffee-500 dark:text-[#a8a29e]">No matching gear</div>';
            return;
        }
        dropdown.innerHTML = options
            .map((option) => {
                const selected = brewGearSelection.has(option.id);
                const selectedCls = selected ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                const icon = selected ? '<i class="fa-solid fa-check text-coffee-700 dark:text-[#d6ccc2]"></i>' : '';
                return `<button type="button" data-brew-gear-option="${option.id}" class="w-full text-left px-3 py-2 text-xs hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2] flex items-center justify-between ${selectedCls}"><span>${option.label}</span>${icon}</button>`;
            })
            .join('');
    };

    const closeBrewGearDropdown = () => {
        const { dropdown } = getBrewGearUi();
        if (dropdown) dropdown.classList.add('hidden');
    };

    const openBrewGearDropdown = () => {
        const { dropdown } = getBrewGearUi();
        if (!dropdown) return;
        renderBrewGearDropdown();
        dropdown.classList.remove('hidden');
    };

    const setSelectedBrewGearIds = (ids) => {
        brewGearSelection = new Set(normalizeBrewGearSelection(ids));
        renderBrewGearPills();
        renderBrewGearDropdown();
    };

    const getSelectedBrewGearIds = () => [...brewGearSelection];

    const toggleBrewGearSelection = (id) => {
        if (!id) return;
        if (brewGearSelection.has(id)) brewGearSelection.delete(id);
        else brewGearSelection.add(id);
        renderBrewGearPills();
        renderBrewGearDropdown();
    };

    const bindBrewGearUi = () => {
        if (hasBoundBrewGearUi) return;
        const { root, control, search, dropdown } = getBrewGearUi();
        if (!root || !control || !search || !dropdown) return;
        hasBoundBrewGearUi = true;

        control.addEventListener('click', () => {
            search.focus();
            openBrewGearDropdown();
        });

        control.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-brew-gear-remove]');
            if (!removeBtn) return;
            event.stopPropagation();
            toggleBrewGearSelection(removeBtn.getAttribute('data-brew-gear-remove'));
            search.focus();
        });

        search.addEventListener('focus', () => openBrewGearDropdown());
        search.addEventListener('input', () => {
            brewGearFilter = search.value || '';
            openBrewGearDropdown();
        });

        dropdown.addEventListener('click', (event) => {
            const optionBtn = event.target.closest('[data-brew-gear-option]');
            if (!optionBtn) return;
            toggleBrewGearSelection(optionBtn.getAttribute('data-brew-gear-option'));
            search.focus();
        });

        // Use capture so modal-level stopPropagation handlers do not block outside-click close.
        document.addEventListener('click', (event) => {
            if (!root.contains(event.target)) closeBrewGearDropdown();
        }, true);
    };

    const refreshBrewGearField = () => {
        bindBrewGearUi();
        const { wrap, search } = getBrewGearUi();
        const grinderWrap = getBrewGrinderFieldWrap();
        if (grinderWrap) grinderWrap.classList.toggle('hidden', hasActiveGrinderGear());
        if (!wrap) return;
        const hasGear = getBrewGearOptions().length > 0;
        wrap.classList.toggle('hidden', !hasGear);
        if (!hasGear) {
            brewGearFilter = '';
            setSelectedBrewGearIds([]);
            if (search) search.value = '';
            closeBrewGearDropdown();
        } else {
            setSelectedBrewGearIds([...brewGearSelection]);
        }
    };

    const setBrewGearScope = ({ includeAll = false } = {}) => {
        includeArchivedGearInForm = !!includeAll;
        refreshBrewGearField();
    };

    const populateForm = (c) => {
        refreshBrewGearField();
        document.getElementById('roaster').value = c.roaster || c.name || '';
        document.getElementById('farmer').value = c.farmer || '';
        document.getElementById('origin').value = c.origin || c.beanType || '';
        document.getElementById('variety').value = c.variety || '';
        document.getElementById('processing').value = c.processing || '';
        document.getElementById('roastType').value = c.roastType || '';
        document.getElementById('grinder').value = c.grinder || '';
        document.getElementById('grind').value = c.grind || '';
        document.getElementById('inputWeight').value = c.weight || '';
        document.getElementById('inputRatio').value = c.ratio || '';
        document.getElementById('inputYield').value = c.weight && c.ratio ? (c.weight * c.ratio).toFixed(1) : '';
        document.getElementById('time').value = c.time || '';
        document.getElementById('notes').value = c.notes || '';
        document.getElementById('improve').value = c.improve || '';
        setSelectedBrewGearIds(c.gearIds || []);

        if (!isNaN(parseFloat(c.temp)) && isFinite(c.temp)) {
            setTempMode('numeric');
            document.getElementById('tempNumeric').value = c.temp;
        } else {
            setTempMode('profile');
            document.getElementById('tempProfile').value = c.temp || '';
        }

        const stdDrinks = [
            'Espresso',
            'Lungo',
            'Americano',
            'Cappuccino',
            'Flat White',
            'Macchiato',
            'Latte Macchiato',
            'Filter Coffee',
            'Soup',
            'Soup americano',
            'Soup lungo',
            'Soup flat white'
        ];
        const dValRaw = c.drink || '';
        const dVal = dValRaw === 'Long Soup' || dValRaw === 'Long soup' ? 'Soup lungo' : dValRaw;
        if (stdDrinks.includes(dVal)) {
            document.getElementById('drinkType').value = dVal;
            document.getElementById('drinkOther').classList.add('hidden');
        } else if (dVal) {
            document.getElementById('drinkType').value = 'Other';
            document.getElementById('drinkOther').value = dVal;
            document.getElementById('drinkOther').classList.remove('hidden');
        } else {
            document.getElementById('drinkType').value = '';
            document.getElementById('drinkOther').classList.add('hidden');
        }

        const stdMethods = ['Espresso', 'V60', 'Hario Switch', 'Clever Dripper', 'Aeropress', 'OXO Rapid Brewer', 'French Press', 'Chemex'];
        const mVal = c.method || '';
        if (stdMethods.includes(mVal)) {
            document.getElementById('method').value = mVal;
            document.getElementById('methodOther').classList.add('hidden');
        } else if (mVal) {
            document.getElementById('method').value = 'Other';
            document.getElementById('methodOther').value = mVal;
            document.getElementById('methodOther').classList.remove('hidden');
        } else {
            document.getElementById('method').value = '';
            document.getElementById('methodOther').classList.add('hidden');
        }

        const coffeeScale = getCoffeeScale?.();
        if (coffeeScale?.applyGraphTogglePrefsForMethod) coffeeScale.applyGraphTogglePrefsForMethod(mVal);
        setRating(c.rating || 0);
        setNotesMode('manual');
        if (c.beanId) {
            document.getElementById('savedBeanSelect').value = c.beanId;
            if (fillBeanDetails) fillBeanDetails(c.beanId);
        } else {
            document.getElementById('savedBeanSelect').value = '';
            if (fillBeanDetails) fillBeanDetails('');
        }

        if (coffeeScale?.setCaptureData) {
            const graphData = c.scaleCapture || c.scaleFlowCapture || c.scaleRawCapture
                ? {
                      capture: c.scaleCapture || { startAt: null, samples: [] },
                      flowCapture: c.scaleFlowCapture || { startAt: (c.scaleCapture && c.scaleCapture.startAt) || null, samples: [] },
                      rawCapture: c.scaleRawCapture || { startAt: (c.scaleCapture && c.scaleCapture.startAt) || null, samples: [] },
                      firstDrip: c.firstDrip
                  }
                : null;
            coffeeScale.setCaptureData(graphData);
        }

        if (c.scale2Capture?.samples?.length) {
            const scale2Device = DeviceManager.getDevice('scale2');
            if (scale2Device) {
                scale2Device.setCaptureData(c.scale2Capture);
            }
        } else {
            DeviceManager.getDevice('scale2')?.resetCapture?.();
        }

        if (coffeeScale?.setRecipeSteps) coffeeScale.setRecipeSteps(c.recipeSteps || []);
        if (coffeeScale?.syncGraphFormFields) coffeeScale.syncGraphFormFields();

        const firstDripEl = document.getElementById('graphFirstDrip');
        const maxFlowEl = document.getElementById('graphMaxFlow');
        const avgFlowEl = document.getElementById('graphAvgFlow');
        if (coffeeScale?.setFirstDripSeconds) coffeeScale.setFirstDripSeconds(c.firstDrip ?? null);
        else if (firstDripEl) firstDripEl.value = c.firstDrip ?? '';
        if (maxFlowEl) maxFlowEl.value = c.maxFlow ?? '';
        if (avgFlowEl) avgFlowEl.value = c.avgFlow ?? '';
    };

    return {
        populateForm,
        refreshBrewGearField,
        setBrewGearScope,
        getSelectedBrewGearIds,
        setSelectedBrewGearIds
    };
};
