export const createBrewFormLookupModule = ({
    getBeans,
    getCoffeeTypes,
    getCoffees,
    getBeanCoffeeTypeDisplay,
    updateCoffeeDetailsTitle
}) => {
    const setCoffeeTypeFieldState = (locked) => {
        const fieldIds = ['roaster', 'farmer', 'origin', 'variety', 'processing', 'roastType'];
        fieldIds.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = locked;
            el.classList.toggle('cursor-not-allowed', locked);
            el.classList.toggle('opacity-70', locked);
        });
    };

    const updateBeanDropdown = () => {
        const select = document.getElementById('savedBeanSelect');
        if (!select) return;

        const formatRoastDate = (value) => {
            if (!value) return '';
            const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            if (isNaN(dateObj)) return '';
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yy = String(dateObj.getFullYear()).slice(-2);
            return `${dd}-${mm}-${yy}`;
        };

        const currentValue = select.value;
        select.innerHTML = '<option value="">-- create new bean and coffee --</option>';

        getBeans()
            .filter((bean) => !bean.archived && !bean.frozen)
            .sort((a, b) => {
                const aDisplay = getBeanCoffeeTypeDisplay(a);
                const bDisplay = getBeanCoffeeTypeDisplay(b);
                return (aDisplay.roaster || '').localeCompare(bDisplay.roaster || '');
            })
            .forEach((bean) => {
                const option = document.createElement('option');
                option.value = bean.id;
                const display = getBeanCoffeeTypeDisplay(bean);
                const roaster = display.roaster !== '-' ? display.roaster : 'Unknown';
                const farmer = display.farmer !== '-' ? ` - ${display.farmer}` : '';
                const roastDate = formatRoastDate(bean.openedDate);
                const roastDateLabel = roastDate ? ` (${roastDate})` : '';
                option.text = `${roaster}${farmer}${roastDateLabel}`;
                select.appendChild(option);
            });

        if (currentValue) {
            const existing = [...select.options].some((opt) => opt.value === currentValue);
            if (existing) select.value = currentValue;
        }
    };

    const updateCoffeeTypeSelectors = () => {
        const select = document.getElementById('beanEditCoffeeType');
        if (!select) return;

        const currentValue = select.value;
        select.innerHTML = '<option value="__new__">-- create new coffee --</option>';

        const uniqueTypes = new Map();
        getCoffeeTypes().forEach((type) => {
            if (type?.id && !uniqueTypes.has(type.id)) uniqueTypes.set(type.id, type);
        });

        [...uniqueTypes.values()]
            .sort((a, b) => (a.roaster || '').localeCompare(b.roaster || ''))
            .forEach((type) => {
                const option = document.createElement('option');
                option.value = type.id;
                const roaster = type.roaster || 'Unknown';
                const farmer = type.farmer ? ` - ${type.farmer}` : '';
                const roast = type.roast ? ` (${type.roast})` : '';
                option.text = `${roaster}${farmer}${roast}`;
                select.appendChild(option);
            });

        if (currentValue) select.value = currentValue;
    };

    const fillBeanDetails = (beanId) => {
        const editBtn = document.getElementById('savedBeanEditBtn');
        if (!beanId) {
            const roaster = document.getElementById('roaster');
            const farmer = document.getElementById('farmer');
            const origin = document.getElementById('origin');
            const variety = document.getElementById('variety');
            const processing = document.getElementById('processing');
            const roastType = document.getElementById('roastType');

            if (roaster) roaster.value = '';
            if (farmer) farmer.value = '';
            if (origin) origin.value = '';
            if (variety) variety.value = '';
            if (processing) processing.value = '';
            if (roastType) roastType.value = '';

            setCoffeeTypeFieldState(false);
            updateCoffeeDetailsTitle();
            if (editBtn) editBtn.disabled = true;
            return;
        }

        const beans = getBeans();
        const bean = beans.find((b) => b.id === beanId);
        if (!bean) {
            if (editBtn) editBtn.disabled = true;
            return;
        }

        const coffeeTypes = getCoffeeTypes();
        const type = bean.coffeeTypeId ? coffeeTypes.find((ct) => ct.id === bean.coffeeTypeId) : null;
        const source =
            type ||
            {
                roaster: bean.roaster || '',
                farmer: bean.farmer || '',
                origin: bean.origin || '',
                variety: bean.variety || '',
                processing: bean.processing || '',
                roast: bean.roastType || ''
            };

        const roaster = document.getElementById('roaster');
        const farmer = document.getElementById('farmer');
        const origin = document.getElementById('origin');
        const variety = document.getElementById('variety');
        const processing = document.getElementById('processing');
        const roastType = document.getElementById('roastType');

        if (roaster) roaster.value = source.roaster || '';
        if (farmer) farmer.value = source.farmer || '';
        if (origin) origin.value = source.origin || '';
        if (variety) variety.value = source.variety || '';
        if (processing) processing.value = source.processing || '';
        if (roastType) roastType.value = source.roast || source.roastType || '';

        setCoffeeTypeFieldState(!!type);
        updateCoffeeDetailsTitle();
        if (editBtn) editBtn.disabled = false;

        ['roaster', 'farmer', 'origin', 'variety', 'processing', 'roastType'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.classList.add('ai-flash-effect');
            setTimeout(() => el.classList.remove('ai-flash-effect'), 1000);
        });
    };

    const updateAutocompleteLists = () => {
        const coffees = getCoffees();
        const uniqueRoasters = [...new Set(coffees.map((c) => c.roaster || c.name).filter(Boolean))].sort();
        const uniqueFarmers = [...new Set(coffees.map((c) => c.farmer).filter(Boolean))].sort();
        const uniqueOrigins = [...new Set(coffees.map((c) => c.origin || c.beanType).filter(Boolean))].sort();
        const uniqueGrinders = [...new Set(coffees.map((c) => c.grinder).filter(Boolean))].sort();

        const populate = (id, values) => {
            const list = document.getElementById(id);
            if (list) list.innerHTML = values.map((v) => `<option value="${v}"></option>`).join('');
        };

        populate('roasterList', uniqueRoasters);
        populate('farmerList', uniqueFarmers);
        populate('originList', uniqueOrigins);
        populate('grinderList', uniqueGrinders);
    };

    return {
        updateBeanDropdown,
        updateCoffeeTypeSelectors,
        fillBeanDetails,
        updateAutocompleteLists
    };
};
