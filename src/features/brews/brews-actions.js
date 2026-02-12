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
    db,
    doc,
    updateDoc,
    addDoc,
    deleteDoc,
    collection,
    openAppConfirm,
    parseNum,
    setTempMode,
    setNotesMode,
    resetSca,
    setRating,
    toggleForm,
    populateForm,
    updateBeanDropdown,
    changeView,
    closeCoffeeCard,
    openCoffeeCard,
    closeCoffeeCardMenu,
    handleQuickEditRecipeInput,
    archiveBeanIfStockDepleted,
    updateBeansLeftForBean,
    autoPinOpenBagsIfEnabled,
    getFirstBrewDateForBean,
    showCoffeeTypeCreatedToast,
    uploadPendingBeanImage,
    clearPendingAIBeanImageFile,
    getCoffeeScale,
    getSelectedBrewGearIds,
    setSelectedBrewGearIds
}) => {
    const clean = (value) => (value || '').toString().toLowerCase().trim();
    const scale = () => getCoffeeScale?.();
    const closeAllActionMenus = () => {
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
    };
    const scrollBrewFormToTop = () => {
        const formWrapper = document.getElementById('formWrapper');
        if (!formWrapper) return;
        const top = formWrapper.getBoundingClientRect().top + window.pageYOffset;
        window.scrollTo({ top, behavior: 'smooth' });
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
        delete d.swirlCount;
        delete d.pourCount;
        delete d.bloomTime;
        delete d.recipeSteps;
        return d;
    };

    const buildDuplicateBrewData = (brew) => {
        const d = stripBrewGraphFields(brew);
        delete d.id;
        d.isActive = false;
        d.createdAt = new Date().toISOString();
        d.updatedAt = d.createdAt;
        let newOrder = 0;
        const coffees = getCoffees();
        if (coffees.length > 0) {
            const minOrder = Math.min(...coffees.map((item) => item.customOrder || 0));
            newOrder = minOrder - 1;
        }
        d.customOrder = newOrder;
        return d;
    };

    const saveRepeatedBrew = async ({ sourceBrew, successMessage, errorMessage, closeCardAfter = false }) => {
        const user = getCurrentUser();
        if (!user || !sourceBrew) return;

        const d = buildDuplicateBrewData(sourceBrew);
        try {
            const col = collection(db, 'users', user.uid, 'coffees');
            const newRef = await addDoc(col, d);
            if (d.beanId) {
                await archiveBeanIfStockDepleted({
                    beanId: d.beanId,
                    brew: d
                });
                await updateBeansLeftForBean(d.beanId, [{ ...d, id: newRef.id, beanId: d.beanId }]);
            }
            const brewForPin = { ...d, id: newRef.id };
            await autoPinOpenBagsIfEnabled({ beanId: d.beanId, brewId: newRef.id, brewData: brewForPin });
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
        const d = stripBrewGraphFields(brew);
        document.getElementById('editId').value = '';
        populateForm(d);
        toggleForm(true);
        document.getElementById('formContainer').classList.remove('editing-mode');
        document.getElementById('formTitle').innerHTML = `<span>${title}</span>`;
        document.getElementById('submitBtn').innerHTML = '<span>Save Copy</span>';
        scrollBrewFormToTop();
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
        document.getElementById('formTitle').innerHTML = '<span>Add New Brew</span>';
        document.getElementById('submitBtn').innerHTML = '<span>Save Brew</span>';
        document.getElementById('submitBtn').className =
            'bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] dark:hover:bg-[#44403c] text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2';
        document.getElementById('isActiveToggle').checked = false;
        updateBeanDropdown();
        document.getElementById('drinkOther').classList.add('hidden');
        document.getElementById('methodOther').classList.add('hidden');
        setSelectedBrewGearIds([]);
        clearPendingAIBeanImageFile();
        if (scale()?.resetCaptureData) scale().resetCaptureData();
        if (scale()?.setRecipeSteps) scale().setRecipeSteps([]);
        if (scale()?.syncGraphFormFields) scale().syncGraphFormFields();
        if (scale()?.applyGraphTogglePrefsForMethod) scale().applyGraphTogglePrefsForMethod();
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
        const isActiveChecked = f.get('isActive') === 'on';
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
            isActive: isActiveChecked,
            gearIds: getSelectedBrewGearIds(),
            updatedAt: new Date().toISOString()
        };
        const grinderNameFromGear = resolveGrinderNameFromGearIds(d.gearIds);
        if (grinderNameFromGear) d.grinder = grinderNameFromGear;

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
                const typeData = {
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
                };
                const typeRef = await addDoc(collection(db, 'users', user.uid, 'coffeeTypes'), typeData);
                if (!coffeeTypes.find((ct) => ct.id === typeRef.id)) {
                    coffeeTypes.push({ id: typeRef.id, ...typeData });
                }
                return { id: typeRef.id, created: true };
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
                        if (coffeeTypeInfo?.created) showCoffeeTypeCreatedToast(coffeeTypeId);
                    }
                    const updates = { updatedAt: beanData.updatedAt };
                    if (!existingBean.coffeeTypeId && coffeeTypeId) updates.coffeeTypeId = coffeeTypeId;
                    await updateDoc(doc(db, 'users', user.uid, 'beans', selectedBeanId), updates);
                    await uploadPendingBeanImage(selectedBeanId);
                } else {
                    const coffeeTypeInfo = await ensureCoffeeTypeId();
                    const coffeeTypeId = coffeeTypeInfo?.id || null;
                    if (coffeeTypeInfo?.created) showCoffeeTypeCreatedToast(coffeeTypeId);
                    if (beanData.roaster || beanData.origin) {
                        const nowIso = new Date().toISOString();
                        beanData.createdAt = nowIso;
                        beanData.updatedAt = nowIso;
                        beanData.archived = false;
                        beanData.frozen = false;
                        beanData.stock = 250;
                        beanData.beansLeft = 250;
                        beanData.openedDate = nowIso;
                        beanData.archivedDate = null;
                        if (coffeeTypeId) beanData.coffeeTypeId = coffeeTypeId;
                        const newBeanRef = await addDoc(collection(db, 'users', user.uid, 'beans'), beanData);
                        selectedBeanId = newBeanRef.id;
                        await uploadPendingBeanImage(selectedBeanId);
                    }
                }
            } else {
                await updateDoc(doc(db, 'users', user.uid, 'beans', selectedBeanId), { updatedAt: beanData.updatedAt });
                await uploadPendingBeanImage(selectedBeanId);
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

            const col = collection(db, 'users', user.uid, 'coffees');
            let didSaveBrew = false;
            let savedBrewId = null;
            if (eid) {
                await updateDoc(doc(col, eid), d);
                didSaveBrew = true;
                savedBrewId = eid;
            } else if (hasBrewData) {
                d.customOrder = newOrder;
                d.createdAt = new Date().toISOString();
                const newBrewRef = await addDoc(col, d);
                savedBrewId = newBrewRef.id;
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
                        await updateDoc(doc(db, 'users', user.uid, 'beans', selectedBeanId), {
                            openedDate: firstBrewDate,
                            updatedAt: nowIso
                        });
                        const beanIdx = beans.findIndex((b) => b.id === selectedBeanId);
                        if (beanIdx !== -1) {
                            beans[beanIdx] = { ...beans[beanIdx], openedDate: firstBrewDate, updatedAt: nowIso };
                        }
                    }
                }

                await archiveBeanIfStockDepleted({
                    beanId: selectedBeanId,
                    brew: d,
                    existingBrewId: savedBrewId
                });
                await updateBeansLeftForBean(selectedBeanId, [{ ...d, id: savedBrewId, beanId: selectedBeanId }]);
                const previousBeanId = existingBrewForUpdate?.beanId;
                if (previousBeanId && previousBeanId !== selectedBeanId) {
                    await updateBeansLeftForBean(previousBeanId);
                }
                const existingBrew = savedBrewId ? coffees.find((c) => c.id === savedBrewId) : null;
                const brewForPin = { ...existingBrew, ...d, id: savedBrewId, beanId: selectedBeanId };
                await autoPinOpenBagsIfEnabled({ beanId: selectedBeanId, brewId: savedBrewId, brewData: brewForPin });
            }

            resetFormState();
            toggleForm(false);
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

    const toggleActive = async (id, ev) => {
        if (ev) ev.stopPropagation();
        if (getCurrentView() !== 'mine') return;
        const user = getCurrentUser();
        if (!user) return;
        const c = getCoffees().find((x) => x.id === id);
        if (!c) return;
        try {
            await updateDoc(doc(db, 'users', user.uid, 'coffees', id), { isActive: !c.isActive });
        } catch (e) {
            console.error(e);
        }
    };

    const getBeanLabelForBrew = (bean) => {
        if (!bean) return 'Unknown bean';
        const display = getBeanCoffeeTypeDisplay ? getBeanCoffeeTypeDisplay(bean) : bean;
        const farmer = display?.farmer && display.farmer !== '-' ? display.farmer : '';
        const roaster = display?.roaster && display.roaster !== '-' ? display.roaster : '';
        if (farmer && roaster) return `${farmer} - ${roaster}`;
        return farmer || roaster || 'Unknown bean';
    };

    const populateBrewQuickEditBeanOptions = (selectedBeanId = '') => {
        const select = document.getElementById('quickEditBeanId');
        if (!select) return;
        const beans = getBeans();
        let options = '<option value="">-- no bean --</option>';
        const beanOptions = [...beans]
            .sort((a, b) => {
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
        document.getElementById('quickEditIsActive').checked = !!brew.isActive;
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
            isActive: !!document.getElementById('quickEditIsActive').checked,
            beanId: selectedBeanId,
            updatedAt: nowIso
        };

        try {
            await updateDoc(doc(db, 'users', user.uid, 'coffees', currentCardId), updates);

            if (selectedBeanId) {
                const selectedBean = beans.find((b) => b.id === selectedBeanId);
                if (selectedBean && !selectedBean.openedDate) {
                    const firstBrewDate = getFirstBrewDateForBean(
                        selectedBeanId,
                        { ...brew, ...updates, id: currentCardId, beanId: selectedBeanId },
                        currentCardId
                    );
                    if (firstBrewDate) {
                        await updateDoc(doc(db, 'users', user.uid, 'beans', selectedBeanId), {
                            openedDate: firstBrewDate,
                            updatedAt: nowIso
                        });
                        const beanIdx = beans.findIndex((b) => b.id === selectedBeanId);
                        if (beanIdx !== -1) {
                            beans[beanIdx] = { ...beans[beanIdx], openedDate: firstBrewDate, updatedAt: nowIso };
                        }
                    }
                }
                await archiveBeanIfStockDepleted({
                    beanId: selectedBeanId,
                    brew: updates,
                    existingBrewId: currentCardId
                });
                await updateBeansLeftForBean(selectedBeanId, [{ ...brew, ...updates, id: currentCardId, beanId: selectedBeanId }]);
                await autoPinOpenBagsIfEnabled({
                    beanId: selectedBeanId,
                    brewId: currentCardId,
                    brewData: { ...brew, ...updates, id: currentCardId, beanId: selectedBeanId }
                });
            }

            if (brew.beanId && brew.beanId !== selectedBeanId) {
                await updateBeansLeftForBean(brew.beanId);
            }

            const idx = coffees.findIndex((c) => c.id === currentCardId);
            if (idx !== -1) coffees[idx] = { ...coffees[idx], ...updates };
            openCoffeeCard(currentCardId);
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
        setTimeout(() => {
            updateBeanDropdown({ includeAll: true });
            document.getElementById('editId').value = c.id;
            populateForm(c);
            document.getElementById('formContainer').classList.add('editing-mode');
            toggleForm(true);
            document.getElementById('formTitle').innerHTML = '<span class="text-orange-500">Edit Brew</span>';
            document.getElementById('submitBtn').innerHTML = '<span>Update</span>';
            document.getElementById('submitBtn').className =
                'bg-orange-600 hover:bg-orange-700 text-white px-6 py-2.5 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2';
            scrollBrewFormToTop();
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
            document.getElementById('viewSelect').value = 'mine';
            changeView('mine');
            setTimeout(() => {
                document.getElementById('editId').value = '';
                updateBeanDropdown();
                const d = stripBrewGraphFields(c);
                populateForm(d);
                toggleForm(true);
                document.getElementById('formContainer').classList.remove('editing-mode');
                document.getElementById('formTitle').innerHTML = '<span>Add Friend\'s Brew</span>';
                document.getElementById('submitBtn').innerHTML = '<span>Save Brew</span>';
                scrollBrewFormToTop();
            }, 500);
            return;
        }

        setTimeout(() => {
            showDuplicateInForm({ brew: c, title: 'Duplicate Brew' });
        }, 200);
    };

    const duplicateCoffee = (id) => {
        closeAllActionMenus();
        const c = getCoffees().find((x) => x.id === id);
        if (!c) return;

        if (getCurrentView() !== 'mine') {
            const d = stripBrewGraphFields(c);
            document.getElementById('viewSelect').value = 'mine';
            changeView('mine');
            setTimeout(() => {
                showDuplicateInForm({ brew: d, title: 'Duplicate Brew' });
            }, 500);
            return;
        }

        setTimeout(() => {
            showDuplicateInForm({ brew: c, title: 'Duplicate Brew' });
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
            await deleteDoc(doc(db, 'users', user.uid, 'coffees', id));

            const idx = coffees.findIndex((c) => c.id === id);
            if (idx !== -1) coffees.splice(idx, 1);

            if (beanId) {
                await updateBeansLeftForBean(beanId);
                await autoPinOpenBagsIfEnabled({ beanId });
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
        toggleActive,
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
