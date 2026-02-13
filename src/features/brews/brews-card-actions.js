export const createBrewsCardActionsModule = ({
    getCurrentUser,
    getCurrentView,
    getCurrentCoffeeCardId,
    getCoffees,
    getBeans,
    getGasItems,
    getCoffeeTypes,
    getCurrentCoffeeCard,
    db,
    doc,
    updateDoc,
    parseNum,
    handleQuickEditRecipeInput,
    openCoffeeCard,
    closeCoffeeCard,
    closeBeans,
    closeCoffeeTypes,
    openBeans,
    openCoffeeTypes,
    clearBeansSearch,
    clearBeansFilters,
    clearCoffeeTypesSearch,
    clearCoffeeTypesFilters,
    openBeanCard,
    openCoffeeTypeCard,
    getBeanCoffeeTypeDisplay,
    getFirstBrewDateForBean,
    archiveBeanIfStockDepleted,
    updateBeansLeftForBean,
    autoPinOpenBagsIfEnabled
}) => {
    const QUICK_EDIT_METHODS = ['Espresso', 'V60', 'Hario Switch', 'Clever Dripper', 'Aeropress', 'OXO Rapid Brewer', 'French Press', 'Chemex'];
    const QUICK_EDIT_DRINKS = [
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
    let quickEditGearSelection = new Set();
    let quickEditGearFilter = '';
    let hasBoundQuickEditGearUi = false;
    const isGrinderGear = (item) => (item?.type || '').toString().toLowerCase() === 'grinder';

    const getQuickEditGearOptions = () => {
        const items = Array.isArray(getGasItems?.()) ? getGasItems() : [];
        return items
            .map((item) => ({ id: item.id, label: (item.name || 'Untitled gear').toString().trim() || 'Untitled gear' }))
            .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
    };

    const getQuickEditGearUi = () => ({
        wrap: document.getElementById('quickEditGearMultiSelectWrap'),
        root: document.getElementById('quickEditGearMultiSelect'),
        control: document.getElementById('quickEditGearControl'),
        pills: document.getElementById('quickEditGearPills'),
        search: document.getElementById('quickEditGearSearch'),
        dropdown: document.getElementById('quickEditGearDropdown')
    });
    const getQuickEditGrinderFieldWrap = () => document.getElementById('quickEditGrinderFieldWrap');
    const hasActiveGrinderGear = () =>
        (Array.isArray(getGasItems?.()) ? getGasItems() : []).some((item) => !item?.archived && isGrinderGear(item));
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

    const normalizeQuickEditGearIds = (ids) => {
        if (!Array.isArray(ids)) return [];
        const validIds = new Set(getQuickEditGearOptions().map((option) => option.id));
        return [...new Set(ids.filter((id) => validIds.has(id)))];
    };

    const renderQuickEditGearPills = () => {
        const { pills, search } = getQuickEditGearUi();
        if (!pills || !search) return;
        const optionMap = new Map(getQuickEditGearOptions().map((option) => [option.id, option.label]));
        const selectedIds = [...quickEditGearSelection];
        pills.innerHTML = selectedIds
            .map((id) => {
                const label = optionMap.get(id) || 'Unknown gear';
                return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-coffee-100 dark:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2]">${label}<button type="button" data-quick-gear-remove="${id}" class="text-coffee-500 dark:text-[#a8a29e] hover:text-red-500">&times;</button></span>`;
            })
            .join('');
        search.placeholder = selectedIds.length ? '' : 'Search gear...';
    };

    const renderQuickEditGearDropdown = () => {
        const { dropdown } = getQuickEditGearUi();
        if (!dropdown) return;
        const q = (quickEditGearFilter || '').toLowerCase().trim();
        const options = getQuickEditGearOptions().filter((option) => option.label.toLowerCase().includes(q));
        if (!options.length) {
            dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-coffee-500 dark:text-[#a8a29e]">No matching gear</div>';
            return;
        }
        dropdown.innerHTML = options
            .map((option) => {
                const selected = quickEditGearSelection.has(option.id);
                const selectedCls = selected ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                const icon = selected ? '<i class="fa-solid fa-check text-coffee-700 dark:text-[#d6ccc2]"></i>' : '';
                return `<button type="button" data-quick-gear-option="${option.id}" class="w-full text-left px-3 py-2 text-xs hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2] flex items-center justify-between ${selectedCls}"><span>${option.label}</span>${icon}</button>`;
            })
            .join('');
    };

    const closeQuickEditGearDropdown = () => {
        const { dropdown } = getQuickEditGearUi();
        if (dropdown) dropdown.classList.add('hidden');
    };

    const openQuickEditGearDropdown = () => {
        const { dropdown } = getQuickEditGearUi();
        if (!dropdown) return;
        renderQuickEditGearDropdown();
        dropdown.classList.remove('hidden');
    };

    const setQuickEditGearSelection = (ids) => {
        quickEditGearSelection = new Set(normalizeQuickEditGearIds(ids));
        renderQuickEditGearPills();
        renderQuickEditGearDropdown();
    };

    const getQuickEditSelectedGearIds = () => [...quickEditGearSelection];

    const toggleQuickEditGearSelection = (id) => {
        if (!id) return;
        if (quickEditGearSelection.has(id)) quickEditGearSelection.delete(id);
        else quickEditGearSelection.add(id);
        renderQuickEditGearPills();
        renderQuickEditGearDropdown();
    };

    const bindQuickEditGearUi = () => {
        if (hasBoundQuickEditGearUi) return;
        const { root, control, search, dropdown } = getQuickEditGearUi();
        if (!root || !control || !search || !dropdown) return;
        hasBoundQuickEditGearUi = true;

        control.addEventListener('click', () => {
            search.focus();
            openQuickEditGearDropdown();
        });

        control.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-quick-gear-remove]');
            if (!removeBtn) return;
            event.stopPropagation();
            toggleQuickEditGearSelection(removeBtn.getAttribute('data-quick-gear-remove'));
            search.focus();
        });

        search.addEventListener('focus', () => openQuickEditGearDropdown());
        search.addEventListener('input', () => {
            quickEditGearFilter = search.value || '';
            openQuickEditGearDropdown();
        });

        dropdown.addEventListener('click', (event) => {
            const optionBtn = event.target.closest('[data-quick-gear-option]');
            if (!optionBtn) return;
            toggleQuickEditGearSelection(optionBtn.getAttribute('data-quick-gear-option'));
            search.focus();
        });

        document.addEventListener('click', (event) => {
            if (!root.contains(event.target)) closeQuickEditGearDropdown();
        });
    };

    const refreshQuickEditGearFieldVisibility = () => {
        bindQuickEditGearUi();
        const { wrap, search } = getQuickEditGearUi();
        const grinderWrap = getQuickEditGrinderFieldWrap();
        if (grinderWrap) grinderWrap.classList.toggle('hidden', hasActiveGrinderGear());
        if (!wrap) return;
        const hasGear = getQuickEditGearOptions().length > 0;
        wrap.classList.toggle('hidden', !hasGear);
        if (!hasGear) {
            quickEditGearFilter = '';
            setQuickEditGearSelection([]);
            if (search) search.value = '';
            closeQuickEditGearDropdown();
        } else {
            setQuickEditGearSelection([...quickEditGearSelection]);
        }
    };

    const showBeanForBrew = (brewId = null) => {
        const targetId = brewId || getCurrentCoffeeCardId();
        if (!targetId) return;
        const brew = getCoffees().find((c) => c.id === targetId);
        if (!brew || !brew.beanId) return;
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeCoffeeCard(null);
        closeBeans();
        closeCoffeeTypes();
        openBeans();
        clearBeansSearch();
        clearBeansFilters();
        openBeanCard(brew.beanId);
    };

    const showCoffeeForBrew = (brewId = null) => {
        const targetId = brewId || getCurrentCoffeeCardId();
        if (!targetId) return;
        const brew = getCoffees().find((c) => c.id === targetId);
        if (!brew || !brew.beanId) return;
        const bean = getBeans().find((b) => b.id === brew.beanId);
        if (!bean || !bean.coffeeTypeId) return;
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        closeCoffeeCard(null);
        closeBeans();
        closeCoffeeTypes();
        openCoffeeTypes();
        clearCoffeeTypesSearch();
        clearCoffeeTypesFilters();
        openCoffeeTypeCard(bean.coffeeTypeId);
    };

    const closeCoffeeCardMenu = () => {
        const menu = document.getElementById('coffeeCardActionMenu');
        if (menu) menu.classList.add('hidden');
    };

    const getBeanLabelForBrew = (bean) => {
        if (!bean) return 'Unknown bean';
        const formatOpenedDate = (value) => {
            if (!value) return '';
            const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
            if (isNaN(dateObj)) return '';
            const dd = String(dateObj.getDate()).padStart(2, '0');
            const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
            const yy = String(dateObj.getFullYear()).slice(-2);
            return `${dd}-${mm}-${yy}`;
        };
        const display = getBeanCoffeeTypeDisplay(bean);
        const farmer = display?.farmer && display.farmer !== '-' ? display.farmer : '';
        const roaster = display?.roaster && display.roaster !== '-' ? display.roaster : '';
        const baseLabel = farmer && roaster ? `${farmer} - ${roaster}` : farmer || roaster || 'Unknown bean';
        const openedDate = formatOpenedDate(bean.openedDate);
        return openedDate ? `${baseLabel} (${openedDate})` : baseLabel;
    };

    const populateBrewQuickEditBeanOptions = (selectedBeanId = '') => {
        const select = document.getElementById('quickEditBeanId');
        if (!select) return;
        let options = '<option value="">-- no bean --</option>';
        const beanOptions = [...getBeans()]
            .sort((a, b) => getBeanLabelForBrew(a).toLowerCase().localeCompare(getBeanLabelForBrew(b).toLowerCase()))
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
        const methodSelect = document.getElementById('quickEditMethod');
        const methodOtherInput = document.getElementById('quickEditMethodOther');
        const drinkSelect = document.getElementById('quickEditDrink');
        const drinkOtherInput = document.getElementById('quickEditDrinkOther');
        const methodVal = brew.method || '';
        const drinkVal = brew.drink || '';

        const applyMethodValue = () => {
            if (!methodSelect || !methodOtherInput) return;
            if (QUICK_EDIT_METHODS.includes(methodVal)) {
                methodSelect.value = methodVal;
                methodOtherInput.value = '';
                methodOtherInput.classList.add('hidden');
            } else if (methodVal) {
                methodSelect.value = 'Other';
                methodOtherInput.value = methodVal;
                methodOtherInput.classList.remove('hidden');
            } else {
                methodSelect.value = '';
                methodOtherInput.value = '';
                methodOtherInput.classList.add('hidden');
            }
        };

        const applyDrinkValue = () => {
            if (!drinkSelect || !drinkOtherInput) return;
            if (QUICK_EDIT_DRINKS.includes(drinkVal)) {
                drinkSelect.value = drinkVal;
                drinkOtherInput.value = '';
                drinkOtherInput.classList.add('hidden');
            } else if (drinkVal) {
                drinkSelect.value = 'Other';
                drinkOtherInput.value = drinkVal;
                drinkOtherInput.classList.remove('hidden');
            } else {
                drinkSelect.value = '';
                drinkOtherInput.value = '';
                drinkOtherInput.classList.add('hidden');
            }
        };

        if (methodSelect && methodOtherInput) {
            methodSelect.onchange = () => {
                const isOther = methodSelect.value === 'Other';
                methodOtherInput.classList.toggle('hidden', !isOther);
                if (!isOther) methodOtherInput.value = '';
            };
        }
        if (drinkSelect && drinkOtherInput) {
            drinkSelect.onchange = () => {
                const isOther = drinkSelect.value === 'Other';
                drinkOtherInput.classList.toggle('hidden', !isOther);
                if (!isOther) drinkOtherInput.value = '';
            };
        }

        applyMethodValue();
        applyDrinkValue();
        refreshQuickEditGearFieldVisibility();
        setQuickEditGearSelection(brew.gearIds || []);
        document.getElementById('quickEditGrinder').value = brew.grinder || '';
        document.getElementById('quickEditGrind').value = brew.grind ?? '';
        document.getElementById('quickEditWeight').value = brew.weight ?? '';
        const outWeight = Number.isFinite(Number(brew.weight)) && Number.isFinite(Number(brew.ratio)) ? (Number(brew.weight) * Number(brew.ratio)).toFixed(1) : '';
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
        closeQuickEditGearDropdown();
    };

    const saveBrewQuickEdits = async () => {
        const user = getCurrentUser();
        const cardId = getCurrentCoffeeCardId();
        if (!user || !cardId || getCurrentView() !== 'mine') return;
        const brew = getCoffees().find((c) => c.id === cardId);
        if (!brew) return;

        const selectedBeanIdRaw = document.getElementById('quickEditBeanId').value;
        const selectedBeanId = selectedBeanIdRaw || null;
        const nowIso = new Date().toISOString();
        const weightVal = parseNum(document.getElementById('quickEditWeight').value);
        const yieldVal = parseNum(document.getElementById('quickEditYield').value);
        const rawMethod = document.getElementById('quickEditMethod').value || '';
        const rawMethodOther = (document.getElementById('quickEditMethodOther')?.value || '').trim();
        const finalMethod = rawMethod === 'Other' ? (rawMethodOther || 'Other') : rawMethod;
        const rawDrink = document.getElementById('quickEditDrink').value || '';
        const rawDrinkOther = (document.getElementById('quickEditDrinkOther')?.value || '').trim();
        const finalDrink = rawDrink === 'Other' ? (rawDrinkOther || 'Other') : rawDrink;
        const ratioVal = Number.isFinite(weightVal) && weightVal > 0 && Number.isFinite(yieldVal)
            ? Number((yieldVal / weightVal).toFixed(2))
            : parseNum(document.getElementById('quickEditRatio').value);

        const updates = {
            method: finalMethod,
            drink: finalDrink,
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
            gearIds: getQuickEditSelectedGearIds(),
            beanId: selectedBeanId,
            updatedAt: nowIso
        };
        const grinderNameFromGear = resolveGrinderNameFromGearIds(updates.gearIds);
        if (grinderNameFromGear) updates.grinder = grinderNameFromGear;

        try {
            await updateDoc(doc(db, 'users', user.uid, 'coffees', cardId), updates);

            if (selectedBeanId) {
                const selectedBean = getBeans().find((b) => b.id === selectedBeanId);
                if (selectedBean && !selectedBean.openedDate) {
                    const firstBrewDate = getFirstBrewDateForBean(
                        selectedBeanId,
                        { ...brew, ...updates, id: cardId, beanId: selectedBeanId },
                        cardId
                    );
                    if (firstBrewDate) {
                        await updateDoc(doc(db, 'users', user.uid, 'beans', selectedBeanId), { openedDate: firstBrewDate, updatedAt: nowIso });
                        const beanIdx = getBeans().findIndex((b) => b.id === selectedBeanId);
                        if (beanIdx !== -1) getBeans()[beanIdx] = { ...getBeans()[beanIdx], openedDate: firstBrewDate, updatedAt: nowIso };
                    }
                }

                await archiveBeanIfStockDepleted({ beanId: selectedBeanId, brew: updates, existingBrewId: cardId });
                await updateBeansLeftForBean(selectedBeanId, [{ ...brew, ...updates, id: cardId, beanId: selectedBeanId }]);
                await autoPinOpenBagsIfEnabled({ beanId: selectedBeanId, brewId: cardId, brewData: { ...brew, ...updates, id: cardId, beanId: selectedBeanId } });
            }

            if (brew.beanId && brew.beanId !== selectedBeanId) {
                await updateBeansLeftForBean(brew.beanId);
            }

            const idx = getCoffees().findIndex((c) => c.id === cardId);
            if (idx !== -1) getCoffees()[idx] = { ...getCoffees()[idx], ...updates };
            closeQuickEditGearDropdown();
            openCoffeeCard(cardId);
        } catch (err) {
            console.error('Error saving quick edits:', err);
            alert('Failed to save quick edits.');
        }
    };

    const editBrewFromCard = () => {
        if (!getCurrentCoffeeCardId()) return;
        enterBrewQuickEditMode();
    };

    const updateCoffeeCardActionMenu = (c) => {
        const menu = document.getElementById('coffeeCardActionMenu');
        const btn = document.getElementById('coffeeCardMenuBtn');
        const editBtn = document.getElementById('coffeeCardEditBtn');
        if (!menu || !btn) return;

        if (editBtn) editBtn.classList.toggle('hidden', getCurrentView() !== 'mine');
        menu.classList.add('hidden');
        if (!c) return;

        if (getCurrentView() === 'mine') {
            const pinLabel = c.isActive ? 'Unpin' : 'Pin to Active';
            const pinIcon = c.isActive ? 'fa-thumbtack text-green-600' : 'fa-thumbtack text-gray-400';
            menu.innerHTML = `
                <button data-action-click="enterBrewQuickEditMode();" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-wand-magic-sparkles text-blue-500 w-4"></i> Quick edit</button>
                <button data-action-click="closeCoffeeCard(null); editCoffee('${c.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-pencil text-blue-500 w-4"></i> Edit</button>
                <button data-action-click="fastDuplicateFromCard();" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-bolt text-amber-500 w-4"></i> Fast repeat</button>
                <button data-action-click="duplicateFromCard();" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-regular fa-copy text-green-500 w-4"></i> Repeat</button>
                <button data-action-click="toggleActive('${c.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid ${pinIcon} w-4"></i> ${pinLabel}</button>
                <button data-action-click="openUploadModal('${c.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-camera text-purple-500 w-4"></i> Upload Photo</button>
                <button data-action-click="showBeanForBrew('${c.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button>
                <button data-action-click="showCoffeeForBrew('${c.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button>
                <button data-action-click="shareCoffeeCard('${c.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-share-nodes text-purple-500 w-4"></i> Share Card</button>
                <hr class="border-coffee-100 dark:border-[#44403c]">
                <button data-action-click="deleteCoffee('${c.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3"><i class="fa-solid fa-trash w-4"></i> Delete</button>
            `;
        } else {
            menu.innerHTML = `
                <button data-action-click="shareCoffeeCard('${c.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-share-nodes text-purple-500 w-4"></i> Share Card</button>
                <button data-action-click="showBeanForBrew('${c.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button>
                <button data-action-click="showCoffeeForBrew('${c.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button>
                <button data-action-click="cloneBrew('${c.id}'); event.stopPropagation();" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-file-import text-green-500 w-4"></i> Clone to My Brews</button>
            `;
        }
    };

    return {
        showBeanForBrew,
        showCoffeeForBrew,
        closeCoffeeCardMenu,
        getBeanLabelForBrew,
        populateBrewQuickEditBeanOptions,
        enterBrewQuickEditMode,
        cancelBrewQuickEditMode,
        saveBrewQuickEdits,
        editBrewFromCard,
        updateCoffeeCardActionMenu,
        refreshQuickEditGearFieldVisibility
    };
};
