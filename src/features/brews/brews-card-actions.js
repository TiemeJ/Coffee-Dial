export const createBrewsCardActionsModule = ({
    getCurrentUser,
    getCurrentView,
    getCurrentCoffeeCardId,
    getCoffees,
    getBeans,
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
        const display = getBeanCoffeeTypeDisplay(bean);
        const farmer = display?.farmer && display.farmer !== '-' ? display.farmer : '';
        const roaster = display?.roaster && display.roaster !== '-' ? display.roaster : '';
        if (farmer && roaster) return `${farmer} - ${roaster}`;
        return farmer || roaster || 'Unknown bean';
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
        document.getElementById('quickEditMethod').value = brew.method || '';
        document.getElementById('quickEditDrink').value = brew.drink || '';
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
        const ratioVal = Number.isFinite(weightVal) && weightVal > 0 && Number.isFinite(yieldVal)
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
        updateCoffeeCardActionMenu
    };
};
