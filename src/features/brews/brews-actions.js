import { createBrewsVmModule } from './brews.vm.js';
import { withDetectedDecaf } from '../../core/coffee-decaf.js';
import { createBrewGrinderGearSyncModule } from './brew-grinder-gear-sync.js';

export const createBrewsActionsModule = ({
    getCurrentUser,
    getCurrentView,
    getCurrentCoffeeCardId,
    getCurrentCardCoffee,
    getCoffees,
    getBeans,
    getCoffeeTypes,
    getGasItems,
    getBeanCoffeeTypeDisplay,
    brewsRepo,
    openAppConfirm,
    parseNum,
    setTempMode,
    setNotesMode,
    resetSca,
    setRating,
    toggleForm,
    populateForm,
    updateBeanDropdown,
    setBrewGearScope,
    setCoffeeDetailsCollapsed,
    changeView,
    closeCoffeeCard,
    closeCoffeeCardMenu,
    handleQuickEditRecipeInput,
    dispatchCommand,
    getFirstBrewDateForBean,
    uploadPendingCoffeeTypeImage,
    clearPendingAIBeanImageFile,
    getCoffeeScale,
    showToast,
    getPinnedBrewsPreferences,
    getSelectedBrewGearIds,
    setSelectedBrewGearIds,
    openBrewFormModal
}) => {
    const brewsVm = createBrewsVmModule();
    const {
        addBean,
        addCoffee,
        addCoffeeType,
        addGear,
        deleteCoffee: deleteCoffeeInRepo,
        updateBean,
        updateCoffee
    } = brewsRepo || {};
    if (!addBean || !addCoffee || !addCoffeeType || !deleteCoffeeInRepo || !updateBean || !updateCoffee) {
        throw new Error('createBrewsActionsModule requires brewsRepo');
    }
    const clean = (value) => (value || '').toString().toLowerCase().trim();
    const shouldKeepRepeatCuppingFields = () => getPinnedBrewsPreferences?.()?.keepCuppingNotesWhenRepeatingBrew === true;
    const grinderGearSync = createBrewGrinderGearSyncModule({
        getGasItems,
        addGear
    });
    const scale = () => getCoffeeScale?.();
    const setAiAddVisibility = (visible) => {
        const btn = document.getElementById('aiScanBtn');
        if (!btn) return;
        btn.classList.toggle('hidden', !visible);
    };
    const setCoffeeTypeFieldsLocked = (locked) => {
        ['roaster', 'farmer', 'origin', 'variety', 'processing', 'roastType'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.disabled = !!locked;
            el.classList.toggle('cursor-not-allowed', !!locked);
            el.classList.toggle('opacity-70', !!locked);
        });
    };
    const closeAllActionMenus = () => {
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
    };
    const presentPreparedForm = ({ title = null, syncTitleFromForm = true } = {}) => {
        openBrewFormModal?.(null, {
            reset: false,
            title,
            syncTitleFromForm
        });
    };
    const fillCoffeeDetailsForNewBeanFromBrew = (brew) => {
        const source = brew || {};
        const normalizeValue = (value) => (value === '-' ? '' : value || '');
        const bean = source.beanId ? getBeans().find((item) => item.id === source.beanId) : null;
        const beanDisplay = bean && getBeanCoffeeTypeDisplay ? getBeanCoffeeTypeDisplay(bean) : null;
        const resolved = {
            roaster: normalizeValue(beanDisplay?.roaster) || source.roaster || source.name || '',
            farmer: normalizeValue(beanDisplay?.farmer) || source.farmer || '',
            origin: normalizeValue(beanDisplay?.origin) || source.origin || source.beanType || '',
            variety: normalizeValue(beanDisplay?.variety) || source.variety || '',
            processing: normalizeValue(beanDisplay?.processing) || source.processing || '',
            roastType: normalizeValue(beanDisplay?.roastType) || source.roastType || source.roast || ''
        };
        const setValue = (id, value) => {
            const el = document.getElementById(id);
            if (el) el.value = value || '';
        };
        setCoffeeTypeFieldsLocked(false);
        setValue('roaster', resolved.roaster);
        setValue('farmer', resolved.farmer);
        setValue('origin', resolved.origin);
        setValue('variety', resolved.variety);
        setValue('processing', resolved.processing);
        setValue('roastType', resolved.roastType);
        const savedBeanSelect = document.getElementById('savedBeanSelect');
        if (savedBeanSelect) savedBeanSelect.value = '';
        const savedBeanEditBtn = document.getElementById('savedBeanEditBtn');
        if (savedBeanEditBtn) savedBeanEditBtn.disabled = true;
        ['roaster', 'farmer'].forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        });
    };
    const buildFriendRepeatSource = (brew) => {
        const base = stripBrewGraphFields(brew || {});
        const normalizeValue = (value) => (value === '-' ? '' : value || '');
        const linkedBean = base.beanId ? getBeans().find((item) => item.id === base.beanId) : null;
        const beanDisplay = linkedBean && getBeanCoffeeTypeDisplay ? getBeanCoffeeTypeDisplay(linkedBean) : null;
        const keepCuppingFields = shouldKeepRepeatCuppingFields();
        return {
            ...base,
            roaster: normalizeValue(base.roaster) || normalizeValue(base.name) || normalizeValue(beanDisplay?.roaster),
            farmer: normalizeValue(base.farmer) || normalizeValue(beanDisplay?.farmer),
            origin: normalizeValue(base.origin) || normalizeValue(base.beanType) || normalizeValue(beanDisplay?.origin),
            variety: normalizeValue(base.variety) || normalizeValue(beanDisplay?.variety),
            processing: normalizeValue(base.processing) || normalizeValue(beanDisplay?.processing),
            roastType: normalizeValue(base.roastType) || normalizeValue(base.roast) || normalizeValue(beanDisplay?.roastType),
            notes: keepCuppingFields ? (base.notes || '') : '',
            improve: keepCuppingFields ? (base.improve || '') : '',
            rating: keepCuppingFields ? (parseInt(base.rating, 10) || 0) : 0
        };
    };
    const isGrinderGear = (item) => (item?.type || '').toString().toLowerCase() === 'grinder';
    const resolveGrinderNameFromGearIds = (gearIds) => {
        if (!Array.isArray(gearIds) || !gearIds.length) return '';
        const gearMap = new Map((Array.isArray(getGasItems?.()) ? getGasItems() : []).map((item) => [item.id, item]));
        for (const gearId of gearIds) {
            const item = gearMap.get(gearId);
            if (!item || !isGrinderGear(item)) continue;
            const name = (item.name || '').toString().trim();
            if (name) return name;
        }
        return '';
    };

    const stripBrewGraphFields = (brew) => {
        const d = { ...brew };
        delete d.scaleCapture;
        delete d.scaleFlowCapture;
        delete d.scaleRawCapture;
        delete d.scale2Capture;
        delete d.scale2FlowCapture;
        delete d.scale2RawCapture;
        delete d.swirlCount;
        delete d.pourCount;
        delete d.bloomTime;
        delete d.recipeSteps;
        return d;
    };

    const buildDuplicateBrewData = (brew) => {
        const d = stripBrewGraphFields(brew);
        const keepCuppingFields = shouldKeepRepeatCuppingFields();
        delete d.id;
        d.createdAt = new Date().toISOString();
        d.updatedAt = d.createdAt;
        let newOrder = 0;
        const coffees = getCoffees();
        if (coffees.length > 0) {
            const minOrder = Math.min(...coffees.map((item) => item.customOrder || 0));
            newOrder = minOrder - 1;
        }
        d.customOrder = newOrder;
        if (!keepCuppingFields) {
            d.notes = '';
            d.improve = '';
            d.rating = 0;
        } else {
            d.notes = d.notes || '';
            d.improve = d.improve || '';
            d.rating = parseInt(d.rating, 10) || 0;
        }
        return d;
    };

    const saveRepeatedBrew = async ({ sourceBrew, successMessage, errorMessage, closeCardAfter = false }) => {
        const user = getCurrentUser();
        if (!user || !sourceBrew) return;

        const d = buildDuplicateBrewData(sourceBrew);
        const grinderNameFromGear = resolveGrinderNameFromGearIds(d.gearIds);
        if (grinderNameFromGear) d.grinder = grinderNameFromGear;
        else {
            const syncResult = await grinderGearSync.ensureGrinderGearAssociation(d);
            if (syncResult?.createdGearName) showToast?.(`Added grinder to gear: ${syncResult.createdGearName}.`);
        }
        try {
            const newId = await addCoffee(d);
            if (d.beanId) {
                await dispatchCommand?.('beans.archiveIfStockDepleted', {
                    beanId: d.beanId,
                    brew: d
                });
                await dispatchCommand?.('beans.updateStockForBean', {
                    beanId: d.beanId,
                    extraBrews: [{ ...d, id: newId, beanId: d.beanId }]
                });
            }
            const brewForPin = { ...d, id: newId };
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', { beanId: d.beanId, brewId: newId, brewData: brewForPin });
            if (closeCardAfter) closeCoffeeCard(null);
            alert(successMessage);
        } catch (err) {
            console.error(err);
            alert(`${errorMessage}: ${err.message}`);
        }
    };

    const showDuplicateInForm = ({ brew, title }) => {
        closeAllActionMenus();
        updateBeanDropdown();
        setBrewGearScope({ includeAll: false });
        const d = stripBrewGraphFields(brew);
        const sourceForCoffeeFields = { ...d };
        const shouldUseNewBeanForRepeat = () => {
            if (title !== 'Repeat brew') return false;
            const sourceBeanId = d?.beanId;
            if (!sourceBeanId) return false;
            const sourceBean = getBeans().find((item) => item.id === sourceBeanId);
            if (!sourceBean) return true;
            if (sourceBean.archived || sourceBean.frozen) return true;
            const select = document.getElementById('savedBeanSelect');
            if (!select) return false;
            return !Array.from(select.options || []).some((option) => option.value === sourceBeanId);
        };
        const forceCreateNewBeanMode = shouldUseNewBeanForRepeat();
        if (forceCreateNewBeanMode) delete d.beanId;
        const clearRepeatOnlyFields = () => {
            if (title !== 'Repeat brew') return;
            const keepCuppingFields = shouldKeepRepeatCuppingFields();
            const setValue = (id, value = '') => {
                const el = document.getElementById(id);
                if (el) el.value = value;
            };
            setValue('inputYield', '');
            setValue('time', '');
            if (!keepCuppingFields) {
                setValue('notes', '');
                setValue('improve', '');
            }
            setValue('graphMaxFlow', '');
            setValue('graphAvgFlow', '');
            setValue('graphFirstDrip', '');
            if (!keepCuppingFields) {
                setRating(0);
                setNotesMode('manual');
                resetSca();
            }
            const coffeeScale = scale();
            document.getElementById('inputYield')?.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('time')?.dispatchEvent(new Event('input', { bubbles: true }));
            if (coffeeScale?.syncGraphFormFields) coffeeScale.syncGraphFormFields();
            if (coffeeScale?.setFirstDripSeconds) coffeeScale.setFirstDripSeconds(null);
        };
        document.getElementById('editId').value = '';
        populateForm(d);
        clearRepeatOnlyFields();
        if (forceCreateNewBeanMode) fillCoffeeDetailsForNewBeanFromBrew(sourceForCoffeeFields);
        toggleForm(true);
        setCoffeeDetailsCollapsed(true);
        document.getElementById('formContainer').classList.remove('editing-mode');
        document.getElementById('formTitle').innerHTML = `<span>${title}</span>`;
        document.getElementById('submitBtn').innerHTML = '<span>Save copy</span>';
        setAiAddVisibility(false);
        presentPreparedForm({ title, syncTitleFromForm: true });
    };
    const showFriendRepeatInForm = ({ brew, title }) => {
        closeAllActionMenus();
        updateBeanDropdown();
        setBrewGearScope({ includeAll: false });
        const d = stripBrewGraphFields(brew);
        const clearRepeatOnlyFields = () => {
            if (title !== 'Repeat brew') return;
            const keepCuppingFields = shouldKeepRepeatCuppingFields();
            const setValue = (id, value = '') => {
                const el = document.getElementById(id);
                if (el) el.value = value;
            };
            setValue('inputYield', '');
            setValue('time', '');
            if (!keepCuppingFields) {
                setValue('notes', '');
                setValue('improve', '');
            }
            setValue('graphMaxFlow', '');
            setValue('graphAvgFlow', '');
            setValue('graphFirstDrip', '');
            if (!keepCuppingFields) {
                setRating(0);
                setNotesMode('manual');
                resetSca();
            }
            const coffeeScale = scale();
            document.getElementById('inputYield')?.dispatchEvent(new Event('input', { bubbles: true }));
            document.getElementById('time')?.dispatchEvent(new Event('input', { bubbles: true }));
            if (coffeeScale?.syncGraphFormFields) coffeeScale.syncGraphFormFields();
            if (coffeeScale?.setFirstDripSeconds) coffeeScale.setFirstDripSeconds(null);
        };
        delete d.beanId;
        document.getElementById('editId').value = '';
        populateForm(d);
        clearRepeatOnlyFields();
        fillCoffeeDetailsForNewBeanFromBrew(d);
        toggleForm(true);
        setCoffeeDetailsCollapsed(true);
        document.getElementById('formContainer').classList.remove('editing-mode');
        document.getElementById('formTitle').innerHTML = `<span>${title}</span>`;
        document.getElementById('submitBtn').innerHTML = '<span>Save copy</span>';
        setAiAddVisibility(false);
        presentPreparedForm({ title, syncTitleFromForm: true });
    };

    const resetFormState = (e) => {
        if (e) e.stopPropagation();
        document.getElementById('coffeeForm').reset();
        document.getElementById('editId').value = '';
        setTempMode('numeric');
        setNotesMode('manual');
        resetSca();
        setRating(0);
        document.getElementById('formContainer').classList.remove('editing-mode');
        document.getElementById('formTitle').innerHTML = '<span>Add new brew</span>';
        document.getElementById('submitBtn').innerHTML = '<span>Save brew</span>';
        document.getElementById('submitBtn').className =
            'bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] dark:hover:bg-[#44403c] text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2';
        updateBeanDropdown();
        setCoffeeTypeFieldsLocked(false);
        const beanSelect = document.getElementById('savedBeanSelect');
        if (beanSelect) beanSelect.value = '';
        const savedBeanEditBtn = document.getElementById('savedBeanEditBtn');
        if (savedBeanEditBtn) savedBeanEditBtn.disabled = true;
        setBrewGearScope({ includeAll: false });
        setCoffeeDetailsCollapsed(false);
        document.getElementById('drinkOther').classList.add('hidden');
        document.getElementById('methodOther').classList.add('hidden');
        setSelectedBrewGearIds([]);
        clearPendingAIBeanImageFile();
        if (scale()?.resetCaptureData) scale().resetCaptureData();
        if (scale()?.setRecipeSteps) scale().setRecipeSteps([]);
        if (scale()?.syncGraphFormFields) scale().syncGraphFormFields();
        if (scale()?.applyGraphTogglePrefsForMethod) scale().applyGraphTogglePrefsForMethod();
        setAiAddVisibility(true);
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (getCurrentView() !== 'mine') return;

        const user = getCurrentUser();
        if (!user) return;

        const coffees = getCoffees();
        const beans = getBeans();
        const coffeeTypes = getCoffeeTypes();

        const f = new FormData(e.target);
        const eid = f.get('editId');
        const tMode = f.get('tempMode');
        const finalTemp = tMode === 'profile' ? f.get('tempProfile') : f.get('tempNumeric') || 'M';
        const finalNotes = f.get('notes') || '';
        const rawDrinkType = f.get('drinkType');
        const rawDrinkOther = f.get('drinkOther');
        const finalDrink = rawDrinkType === 'Other' ? rawDrinkOther || 'Other' : rawDrinkType;
        const rawMethod = f.get('method');
        const rawMethodOther = f.get('methodOther');
        const finalMethod = rawMethod === 'Other' ? rawMethodOther || 'Other' : rawMethod;

        let newOrder = 0;
        if (coffees.length > 0) {
            const minOrder = Math.min(...coffees.map((c) => c.customOrder || 0));
            newOrder = minOrder - 1;
        }

        let selectedBeanId = document.getElementById('savedBeanSelect').value;

        const d = {
            roaster: f.get('roaster'),
            farmer: f.get('farmer'),
            origin: f.get('origin'),
            variety: f.get('variety'),
            processing: f.get('processing'),
            roastType: f.get('roastType'),
            method: finalMethod,
            grinder: f.get('grinder'),
            grind: parseNum(f.get('grind')),
            weight: parseNum(f.get('weight')),
            ratio: parseNum(f.get('ratio')),
            time: parseNum(f.get('time')),
            temp: finalTemp,
            drink: finalDrink,
            notes: finalNotes,
            improve: f.get('improve') || '',
            rating: parseInt(f.get('rating'), 10) || 0,
            gearIds: getSelectedBrewGearIds(),
            updatedAt: new Date().toISOString()
        };
        const grinderNameFromGear = resolveGrinderNameFromGearIds(d.gearIds);
        if (grinderNameFromGear) d.grinder = grinderNameFromGear;
        else {
            const syncResult = await grinderGearSync.ensureGrinderGearAssociation(d);
            if (syncResult?.createdGearName) showToast?.(`Added grinder to gear: ${syncResult.createdGearName}.`);
        }

        const firstDripEl = document.getElementById('graphFirstDrip');
        const maxFlowEl = document.getElementById('graphMaxFlow');
        const avgFlowEl = document.getElementById('graphAvgFlow');
        const firstDripFromState = scale()?.getFirstDripSeconds?.();
        d.firstDrip = Number.isFinite(Number(firstDripFromState))
            ? Number(firstDripFromState)
            : parseNum(firstDripEl ? firstDripEl.value : null);
        d.maxFlow = parseNum(maxFlowEl ? maxFlowEl.value : null);
        d.avgFlow = parseNum(avgFlowEl ? avgFlowEl.value : null);

        const scaleCaptureData = scale()?.getCaptureData?.();
        if (scaleCaptureData) {
            d.scaleCapture = scaleCaptureData.capture;
            d.scaleFlowCapture = scaleCaptureData.flowCapture;
            d.scaleRawCapture = scaleCaptureData.rawCapture;
            if (d.firstDrip === null) {
                const firstDripThreshold = 0;
                const samples = Array.isArray(scaleCaptureData.capture?.samples) ? scaleCaptureData.capture.samples : [];
                const firstDripSample = samples.find(
                    (sample) => Number.isFinite(sample?.w) && sample.w > firstDripThreshold && Number.isFinite(sample?.tMs)
                );
                if (firstDripSample) d.firstDrip = Math.round(firstDripSample.tMs / 1000);
            }
        }

        if (scaleCaptureData?.scale2Capture?.samples?.length) {
            d.scale2Capture = scaleCaptureData.scale2Capture;
            if (scaleCaptureData.scale2FlowCapture?.samples?.length)
                d.scale2FlowCapture = scaleCaptureData.scale2FlowCapture;
            if (scaleCaptureData.scale2RawCapture?.samples?.length)
                d.scale2RawCapture = scaleCaptureData.scale2RawCapture;
        }

        const graphStats = scale()?.getGraphEventStats?.();
        if (graphStats) {
            d.swirlCount = Number.isFinite(graphStats.swirlCount) ? graphStats.swirlCount : null;
            d.pourCount = Number.isFinite(graphStats.pourCount) ? graphStats.pourCount : null;
            d.bloomTime = Number.isFinite(graphStats.bloomTime) ? Number(graphStats.bloomTime.toFixed(1)) : null;
        }

        const recipeSteps = scale()?.getRecipeSteps?.();
        d.recipeSteps = recipeSteps && recipeSteps.length ? recipeSteps : [];

        const beanData = {
            roaster: d.roaster,
            farmer: d.farmer,
            origin: d.origin,
            variety: d.variety,
            processing: d.processing,
            roastType: d.roastType,
            updatedAt: new Date().toISOString()
        };

        try {
            const existingBrewForUpdate = eid ? coffees.find((c) => c.id === eid) : null;

            const makeCoffeeTypeKey = (obj) =>
                [
                    clean(obj?.roaster),
                    clean(obj?.farmer),
                    clean(obj?.processing),
                    clean(obj?.origin),
                    clean(obj?.roastType || obj?.roast)
                ].join('|');

            const ensureCoffeeTypeId = async () => {
                const key = makeCoffeeTypeKey(beanData);
                if (!key || key.replace(/\|/g, '') === '') return null;
                const existingType = coffeeTypes.find((ct) => makeCoffeeTypeKey(ct) === key);
                if (existingType?.id) return { id: existingType.id, created: false };

                const nowIso = new Date().toISOString();
                const typeData = withDetectedDecaf({
                    uid: user.uid,
                    roaster: beanData.roaster || '',
                    farmer: beanData.farmer || '',
                    origin: beanData.origin || '',
                    processing: beanData.processing || '',
                    variety: beanData.variety || '',
                    roast: beanData.roastType || '',
                    rating: 0,
                    tasteNotes: '',
                    webshopUrl: '',
                    imageUrl: '',
                    createdAt: nowIso,
                    updatedAt: nowIso
                });
                const typeId = await addCoffeeType(typeData);
                if (!coffeeTypes.find((ct) => ct.id === typeId)) {
                    coffeeTypes.push({ id: typeId, ...typeData });
                }
                return { id: typeId, created: true };
            };

            if (!selectedBeanId) {
                const existingBean = beans.find(
                    (b) =>
                        clean(b.roaster) === clean(beanData.roaster) &&
                        clean(b.farmer) === clean(beanData.farmer) &&
                        clean(b.origin) === clean(beanData.origin) &&
                        clean(b.processing) === clean(beanData.processing) &&
                        clean(b.variety) === clean(beanData.variety) &&
                        clean(b.roastType) === clean(beanData.roastType)
                );

                if (existingBean) {
                    selectedBeanId = existingBean.id;
                    let coffeeTypeId = existingBean.coffeeTypeId || null;
                    if (!coffeeTypeId) {
                        const coffeeTypeInfo = await ensureCoffeeTypeId();
                        coffeeTypeId = coffeeTypeInfo?.id || null;
                        if (coffeeTypeInfo?.created) dispatchCommand?.('beans.showCoffeeTypeCreatedToast', { coffeeTypeId });
                    }
                    const updates = { updatedAt: beanData.updatedAt };
                    if (!existingBean.coffeeTypeId && coffeeTypeId) updates.coffeeTypeId = coffeeTypeId;
                    await updateBean(selectedBeanId, updates);
                    await uploadPendingCoffeeTypeImage(coffeeTypeId);
                } else {
                    const coffeeTypeInfo = await ensureCoffeeTypeId();
                    const coffeeTypeId = coffeeTypeInfo?.id || null;
                    if (coffeeTypeInfo?.created) dispatchCommand?.('beans.showCoffeeTypeCreatedToast', { coffeeTypeId });
                    if (beanData.roaster || beanData.origin) {
                        const nowIso = new Date().toISOString();
                        beanData.createdAt = nowIso;
                        beanData.updatedAt = nowIso;
                        beanData.archived = false;
                        beanData.frozen = false;
                        beanData.price = null;
                        beanData.stock = 250;
                        beanData.beansLeft = 250;
                        beanData.openedDate = nowIso;
                        beanData.archivedDate = null;
                        if (coffeeTypeId) beanData.coffeeTypeId = coffeeTypeId;
                        selectedBeanId = await addBean(beanData);
                        dispatchCommand?.('beans.showBeanCreatedToast', {
                            beanId: selectedBeanId,
                            roaster: beanData.roaster,
                            farmer: beanData.farmer
                        });
                        await uploadPendingCoffeeTypeImage(coffeeTypeId);
                    }
                }
            } else {
                const selectedBean = beans.find((b) => b.id === selectedBeanId);
                let coffeeTypeId = selectedBean?.coffeeTypeId || null;
                if (!coffeeTypeId) {
                    const coffeeTypeInfo = await ensureCoffeeTypeId();
                    coffeeTypeId = coffeeTypeInfo?.id || null;
                    if (coffeeTypeInfo?.created) dispatchCommand?.('beans.showCoffeeTypeCreatedToast', { coffeeTypeId });
                }
                const updates = { updatedAt: beanData.updatedAt };
                if (!selectedBean?.coffeeTypeId && coffeeTypeId) updates.coffeeTypeId = coffeeTypeId;
                await updateBean(selectedBeanId, updates);
                await uploadPendingCoffeeTypeImage(coffeeTypeId);
            }

            if (selectedBeanId) d.beanId = selectedBeanId;

            const hasBrewData =
                d.method ||
                d.grinder ||
                d.grind ||
                d.weight ||
                d.ratio ||
                d.time ||
                (d.temp && d.temp !== 'M') ||
                d.notes ||
                d.improve ||
                d.rating > 0 ||
                (Array.isArray(d.gearIds) && d.gearIds.length > 0);

            let didSaveBrew = false;
            let savedBrewId = null;
            if (eid) {
                await updateCoffee(eid, d);
                didSaveBrew = true;
                savedBrewId = eid;
            } else if (hasBrewData) {
                d.customOrder = newOrder;
                d.createdAt = new Date().toISOString();
                savedBrewId = await addCoffee(d);
                didSaveBrew = true;
            }

            if (didSaveBrew && selectedBeanId) {
                const selectedBean = beans.find((b) => b.id === selectedBeanId);
                if (selectedBean && !selectedBean.openedDate) {
                    const firstBrewDate = getFirstBrewDateForBean(
                        selectedBeanId,
                        { ...d, id: savedBrewId, beanId: selectedBeanId },
                        savedBrewId
                    );
                    if (firstBrewDate) {
                        const nowIso = new Date().toISOString();
                        await updateBean(selectedBeanId, {
                            openedDate: firstBrewDate,
                            updatedAt: nowIso
                        });
                        const beanIdx = beans.findIndex((b) => b.id === selectedBeanId);
                        if (beanIdx !== -1) {
                            beans[beanIdx] = { ...beans[beanIdx], openedDate: firstBrewDate, updatedAt: nowIso };
                        }
                    }
                }

                await dispatchCommand?.('beans.archiveIfStockDepleted', {
                    beanId: selectedBeanId,
                    brew: d,
                    existingBrewId: savedBrewId
                });
                await dispatchCommand?.('beans.updateStockForBean', {
                    beanId: selectedBeanId,
                    extraBrews: [{ ...d, id: savedBrewId, beanId: selectedBeanId }]
                });
                const previousBeanId = existingBrewForUpdate?.beanId;
                if (previousBeanId && previousBeanId !== selectedBeanId) {
                    await dispatchCommand?.('beans.updateStockForBean', { beanId: previousBeanId });
                }
                const existingBrew = savedBrewId ? coffees.find((c) => c.id === savedBrewId) : null;
                const brewForPin = { ...existingBrew, ...d, id: savedBrewId, beanId: selectedBeanId };
                await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', { beanId: selectedBeanId, brewId: savedBrewId, brewData: brewForPin });
            }

            resetFormState();
            toggleForm(false);
            document.dispatchEvent(
                new CustomEvent('brew:form-saved', {
                    detail: { editId: eid || null }
                })
            );
        } catch (err) {
            alert(err.message);
        }
    };

    const discardForm = async () => {
        const shouldDiscard = await openAppConfirm({
            title: 'Discard changes?',
            message: 'This will discard unsaved changes in the form.',
            confirmLabel: 'Discard',
            cancelLabel: 'Keep editing',
            danger: true
        });
        if (shouldDiscard) {
            resetFormState();
            toggleForm(false);
        }
    };

    const getBeanLabelForBrew = (bean) => {
        const display = getBeanCoffeeTypeDisplay ? getBeanCoffeeTypeDisplay(bean) : bean;
        return brewsVm.buildBeanLabel(bean, display);
    };

    const populateBrewQuickEditBeanOptions = (selectedBeanId = '') => {
        const select = document.getElementById('quickEditBeanId');
        if (!select) return;
        const getOpenedAtMs = (bean) => {
            const raw = bean?.openedDate;
            if (!raw) return Number.NEGATIVE_INFINITY;
            const dateObj = typeof raw.toDate === 'function' ? raw.toDate() : new Date(raw);
            const ms = dateObj instanceof Date ? dateObj.getTime() : NaN;
            return Number.isFinite(ms) ? ms : Number.NEGATIVE_INFINITY;
        };
        const beans = getBeans();
        let options = '<option value="">-- no bean --</option>';
        const beanOptions = [...beans]
            .sort((a, b) => {
                const openedDelta = getOpenedAtMs(b) - getOpenedAtMs(a);
                if (openedDelta !== 0) return openedDelta;
                const aLabel = getBeanLabelForBrew(a).toLowerCase();
                const bLabel = getBeanLabelForBrew(b).toLowerCase();
                return aLabel.localeCompare(bLabel);
            })
            .map((bean) => {
                const selected = bean.id === selectedBeanId ? 'selected' : '';
                return `<option value="${bean.id}" ${selected}>${getBeanLabelForBrew(bean)}</option>`;
            });
        select.innerHTML = options + beanOptions.join('');
        select.value = selectedBeanId || '';
    };

    const enterBrewQuickEditMode = () => {
        if (!getCurrentCoffeeCardId() || getCurrentView() !== 'mine') return;
        const brew = getCoffees().find((c) => c.id === getCurrentCoffeeCardId());
        if (!brew) return;

        populateBrewQuickEditBeanOptions(brew.beanId || '');
        document.getElementById('quickEditMethod').value = brew.method || '';
        document.getElementById('quickEditDrink').value = brew.drink || '';
        document.getElementById('quickEditGrinder').value = brew.grinder || '';
        document.getElementById('quickEditGrind').value = brew.grind ?? '';
        document.getElementById('quickEditWeight').value = brew.weight ?? '';
        const outWeight =
            Number.isFinite(Number(brew.weight)) && Number.isFinite(Number(brew.ratio))
                ? (Number(brew.weight) * Number(brew.ratio)).toFixed(1)
                : '';
        document.getElementById('quickEditYield').value = outWeight;
        document.getElementById('quickEditRatio').value = brew.ratio ?? '';
        document.getElementById('quickEditTime').value = brew.time ?? '';
        document.getElementById('quickEditTemp').value = brew.temp || '';
        document.getElementById('quickEditRating').value = String(parseInt(brew.rating, 10) || 0);
        document.getElementById('quickEditNotes').value = brew.notes || '';
        document.getElementById('quickEditImprove').value = brew.improve || '';
        handleQuickEditRecipeInput('yield');

        document.getElementById('coffeeCardView').classList.add('hidden');
        document.getElementById('coffeeCardQuickEdit').classList.remove('hidden');
        document.getElementById('coffeeCardEditBtn').classList.add('hidden');
        document.getElementById('coffeeCardMenuBtn').classList.add('hidden');
        closeCoffeeCardMenu();
    };

    const cancelBrewQuickEditMode = () => {
        const viewEl = document.getElementById('coffeeCardView');
        const editEl = document.getElementById('coffeeCardQuickEdit');
        if (!viewEl || !editEl) return;
        editEl.classList.add('hidden');
        viewEl.classList.remove('hidden');
        document.getElementById('coffeeCardEditBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('coffeeCardMenuBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
    };

    const saveBrewQuickEdits = async () => {
        const user = getCurrentUser();
        const currentCardId = getCurrentCoffeeCardId();
        if (!user || !currentCardId || getCurrentView() !== 'mine') return;

        const coffees = getCoffees();
        const beans = getBeans();
        const brew = coffees.find((c) => c.id === currentCardId);
        if (!brew) return;

        const selectedBeanIdRaw = document.getElementById('quickEditBeanId').value;
        const selectedBeanId = selectedBeanIdRaw || null;
        const nowIso = new Date().toISOString();
        const weightVal = parseNum(document.getElementById('quickEditWeight').value);
        const yieldVal = parseNum(document.getElementById('quickEditYield').value);
        const ratioVal =
            Number.isFinite(weightVal) && weightVal > 0 && Number.isFinite(yieldVal)
                ? Number((yieldVal / weightVal).toFixed(2))
                : parseNum(document.getElementById('quickEditRatio').value);

        const updates = {
            method: document.getElementById('quickEditMethod').value || '',
            drink: document.getElementById('quickEditDrink').value || '',
            grinder: document.getElementById('quickEditGrinder').value || '',
            grind: parseNum(document.getElementById('quickEditGrind').value),
            weight: weightVal,
            ratio: ratioVal,
            time: parseNum(document.getElementById('quickEditTime').value),
            temp: (document.getElementById('quickEditTemp').value || '').trim() || 'M',
            rating: parseInt(document.getElementById('quickEditRating').value, 10) || 0,
            notes: document.getElementById('quickEditNotes').value || '',
            improve: document.getElementById('quickEditImprove').value || '',
            gearIds: Array.isArray(brew.gearIds) ? [...new Set(brew.gearIds.filter(Boolean))] : [],
            beanId: selectedBeanId,
            updatedAt: nowIso
        };
        const quickEditSync = await grinderGearSync.ensureGrinderGearAssociation(updates);
        if (quickEditSync?.createdGearName) showToast?.(`Added grinder to gear: ${quickEditSync.createdGearName}.`);

        try {
            await updateCoffee(currentCardId, updates);

            if (selectedBeanId) {
                const selectedBean = beans.find((b) => b.id === selectedBeanId);
                if (selectedBean && !selectedBean.openedDate) {
                    const firstBrewDate = getFirstBrewDateForBean(
                        selectedBeanId,
                        { ...brew, ...updates, id: currentCardId, beanId: selectedBeanId },
                        currentCardId
                    );
                    if (firstBrewDate) {
                        await updateBean(selectedBeanId, {
                            openedDate: firstBrewDate,
                            updatedAt: nowIso
                        });
                        const beanIdx = beans.findIndex((b) => b.id === selectedBeanId);
                        if (beanIdx !== -1) {
                            beans[beanIdx] = { ...beans[beanIdx], openedDate: firstBrewDate, updatedAt: nowIso };
                        }
                    }
                }
                await dispatchCommand?.('beans.archiveIfStockDepleted', {
                    beanId: selectedBeanId,
                    brew: updates,
                    existingBrewId: currentCardId
                });
                await dispatchCommand?.('beans.updateStockForBean', {
                    beanId: selectedBeanId,
                    extraBrews: [{ ...brew, ...updates, id: currentCardId, beanId: selectedBeanId }]
                });
                await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {
                    beanId: selectedBeanId,
                    brewId: currentCardId,
                    brewData: { ...brew, ...updates, id: currentCardId, beanId: selectedBeanId }
                });
            }

            if (brew.beanId && brew.beanId !== selectedBeanId) {
                await dispatchCommand?.('beans.updateStockForBean', { beanId: brew.beanId });
            }

            const idx = coffees.findIndex((c) => c.id === currentCardId);
            if (idx !== -1) coffees[idx] = { ...coffees[idx], ...updates };
            dispatchCommand?.('brews.openCard', { id: currentCardId, event: null, options: {} });
        } catch (err) {
            console.error('Error saving quick edits:', err);
            alert('Failed to save quick edits.');
        }
    };

    const editBrewFromCard = () => {
        if (!getCurrentCoffeeCardId()) return;
        enterBrewQuickEditMode();
    };

    const editCoffee = (id) => {
        closeAllActionMenus();
        const c = getCoffees().find((x) => x.id === id);
        if (!c) return;
        setTimeout(async () => {
            await openBrewFormModal?.(null, {
                reset: false,
                syncTitleFromForm: false
            });
            updateBeanDropdown({ includeAll: true });
            setBrewGearScope({ includeAll: true });
            document.getElementById('editId').value = c.id;
            populateForm(c);
            document.getElementById('formContainer').classList.add('editing-mode');
            setCoffeeDetailsCollapsed(true);
            document.getElementById('formTitle').innerHTML = '<span class="text-orange-500">Edit brew</span>';
            document.getElementById('submitBtn').innerHTML = '<span>Update</span>';
            document.getElementById('submitBtn').className =
                'bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2';
            setAiAddVisibility(false);
        }, 0);
    };

    const fastDuplicateFromCard = async () => {
        const c = getCurrentCardCoffee();
        if (!c) return;

        if (getCurrentView() !== 'mine') {
            closeCoffeeCard(null);
            document.getElementById('viewSelect').value = 'mine';
            changeView('mine');

            setTimeout(async () => {
                await saveRepeatedBrew({
                    sourceBrew: c,
                    successMessage: 'Brew added to your collection!',
                    errorMessage: 'Error adding brew'
                });
            }, 500);
            return;
        }

        await saveRepeatedBrew({
            sourceBrew: c,
            successMessage: 'Brew duplicated successfully!',
            errorMessage: 'Error duplicating',
            closeCardAfter: true
        });
    };

    const fastRepeatCoffee = async (id) => {
        closeAllActionMenus();
        const c = getCoffees().find((x) => x.id === id);
        if (!c) return;

        if (getCurrentView() !== 'mine') {
            document.getElementById('viewSelect').value = 'mine';
            changeView('mine');
            setTimeout(async () => {
                await saveRepeatedBrew({
                    sourceBrew: c,
                    successMessage: 'Brew added to your collection!',
                    errorMessage: 'Error adding brew'
                });
            }, 500);
            return;
        }

        await saveRepeatedBrew({
            sourceBrew: c,
            successMessage: 'Brew repeated successfully!',
            errorMessage: 'Error repeating'
        });
    };

    const duplicateFromCard = () => {
        const c = getCurrentCardCoffee();
        if (!c) return;
        closeCoffeeCard(null);

        if (getCurrentView() !== 'mine') {
            const friendDraft = buildFriendRepeatSource(c);
            document.getElementById('viewSelect').value = 'mine';
            changeView('mine');
            setTimeout(() => {
                showFriendRepeatInForm({ brew: friendDraft, title: 'Repeat brew' });
            }, 500);
            return;
        }

        setTimeout(() => {
            showDuplicateInForm({ brew: c, title: 'Repeat brew' });
        }, 200);
    };

    const duplicateCoffee = (id) => {
        closeAllActionMenus();
        const c = getCoffees().find((x) => x.id === id);
        if (!c) return;

        if (getCurrentView() !== 'mine') {
            const friendDraft = buildFriendRepeatSource(c);
            document.getElementById('viewSelect').value = 'mine';
            changeView('mine');
            setTimeout(() => {
                showFriendRepeatInForm({ brew: friendDraft, title: 'Repeat brew' });
            }, 500);
            return;
        }

        setTimeout(() => {
            showDuplicateInForm({ brew: c, title: 'Repeat brew' });
        }, 0);
    };

    const cloneBrew = (id) => duplicateCoffee(id);

    const deleteCoffee = async (id, ev) => {
        if (ev) ev.stopPropagation();
        if (getCurrentView() !== 'mine') return;
        const user = getCurrentUser();
        if (!user) return;
        const coffees = getCoffees();
        const brewToDelete = coffees.find((x) => x.id === id);
        const beanId = brewToDelete?.beanId || null;

        const shouldDelete = await openAppConfirm({
            title: 'Delete brew?',
            message: 'This action cannot be undone.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!shouldDelete) return;

        try {
            await deleteCoffeeInRepo(id);

            const idx = coffees.findIndex((c) => c.id === id);
            if (idx !== -1) coffees.splice(idx, 1);

            if (beanId) {
                await dispatchCommand?.('beans.updateStockForBean', { beanId });
                await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', { beanId });
            }

            if (getCurrentCoffeeCardId() === id) closeCoffeeCard(null);
            if (document.getElementById('editId').value === id) resetFormState();
        } catch (err) {
            console.error('Error deleting brew:', err);
            alert('Failed to delete brew.');
        }
    };

    return {
        handleFormSubmit,
        discardForm,
        getBeanLabelForBrew,
        populateBrewQuickEditBeanOptions,
        enterBrewQuickEditMode,
        cancelBrewQuickEditMode,
        saveBrewQuickEdits,
        editBrewFromCard,
        editCoffee,
        fastDuplicateFromCard,
        fastRepeatCoffee,
        duplicateFromCard,
        duplicateCoffee,
        cloneBrew,
        deleteCoffee,
        resetFormState
    };
};
