export const createGasCardModule = ({
    getCurrentUser,
    getCurrentView,
    getCurrentGasId,
    setCurrentGasId,
    getGasItems,
    setGasItemsState,
    getCoffees,
    setCoffeesState,
    getFilteredSortedGasItems,
    dataService,
    storageService,
    imageCompression,
    openAppConfirm,
    renderGasTable
}) => {
    const { db, doc, collection, updateDoc, deleteDoc, writeBatch } = dataService || {};
    const { storage, ref, uploadBytes, getDownloadURL, deleteObject } = storageService || {};
    if (!db || !doc || !collection || !updateDoc || !deleteDoc || !writeBatch) {
        throw new Error('createGasCardModule requires dataService { db, doc, collection, updateDoc, deleteDoc, writeBatch }');
    }
    if (!storage || !ref || !uploadBytes || !getDownloadURL || !deleteObject) {
        throw new Error('createGasCardModule requires storageService { storage, ref, uploadBytes, getDownloadURL, deleteObject }');
    }
    const GAS_METHOD_OPTIONS = [
        'Espresso',
        'V60',
        'Hario Switch',
        'Clever Dripper',
        'Aeropress',
        'OXO Rapid Brewer',
        'French Press',
        'Chemex'
    ];
    const GAS_TYPE_OPTIONS = [
        'Basket',
        'Burrs',
        'Coffee maker',
        'Distributor',
        'Dripper',
        'Filter',
        'Grinder',
        'Other',
        'Tamper',
        'Water'
    ];

    let gasMethodsSelection = new Set();
    let gasMethodsFilter = '';
    let hasBoundGasMethodsUi = false;
    let gasMergeTargetId = null;
    let hasBoundGasMergeUi = false;
    let gasBulkFilterGearSelection = new Set();
    let gasBulkFilterGearSearch = '';
    let hasBoundGasBulkUi = false;

    const formatCurrency = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return '-';
        return `EUR ${num.toFixed(2)}`;
    };

    const normalizeMethods = (methods) => {
        if (!Array.isArray(methods)) return [];
        return [...new Set(methods.filter((method) => GAS_METHOD_OPTIONS.includes(method)))];
    };

    const normalizeType = (type) => (GAS_TYPE_OPTIONS.includes(type) ? type : 'Other');
    const closeAllActionMenus = () => {
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
    };
    const toInputDate = (value) => {
        if (!value) return '';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '';
        return date.toISOString().slice(0, 10);
    };

    const getCurrentGasItem = () => getGasItems().find((item) => item.id === getCurrentGasId());

    const getGasMethodsUi = () => ({
        root: document.getElementById('gasMethodsMultiSelect'),
        control: document.getElementById('gasMethodsControl'),
        pills: document.getElementById('gasMethodsPills'),
        search: document.getElementById('gasMethodsSearch'),
        dropdown: document.getElementById('gasMethodsDropdown')
    });
    const setGasCardHeightForMode = (mode = 'view') => {
        const panel = document.getElementById('gasCardPanel');
        if (!panel) return;
        panel.style.maxHeight = '85vh';
        panel.style.minHeight = '48vh';
    };

    const renderGasMethodsDropdown = () => {
        const { dropdown } = getGasMethodsUi();
        if (!dropdown) return;

        const q = (gasMethodsFilter || '').toLowerCase().trim();
        const visibleOptions = GAS_METHOD_OPTIONS.filter((option) => option.toLowerCase().includes(q));

        if (!visibleOptions.length) {
            dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-coffee-500 dark:text-[#a8a29e]">No matching methods</div>';
            return;
        }

        dropdown.innerHTML = visibleOptions
            .map((option) => {
                const selected = gasMethodsSelection.has(option);
                const selectedCls = selected ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                const icon = selected ? '<i class="fa-solid fa-check text-coffee-700 dark:text-[#d6ccc2]"></i>' : '';
                return `<button type="button" data-gas-method-option="${option}" class="w-full text-left px-3 py-2 text-xs hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2] flex items-center justify-between ${selectedCls}"><span>${option}</span>${icon}</button>`;
            })
            .join('');
    };

    const renderGasMethodsPills = () => {
        const { pills, search } = getGasMethodsUi();
        if (!pills || !search) return;

        const selected = [...gasMethodsSelection];
        pills.innerHTML = selected
            .map((method) => `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-coffee-100 dark:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2]">${method}<button type="button" data-gas-method-remove="${method}" class="text-coffee-500 dark:text-[#a8a29e] hover:text-red-500">&times;</button></span>`)
            .join('');

        search.placeholder = selected.length ? '' : 'Search methods...';
    };

    const openGasMethodsDropdown = () => {
        const { dropdown } = getGasMethodsUi();
        if (!dropdown) return;
        renderGasMethodsDropdown();
        dropdown.classList.remove('hidden');
    };

    const closeGasMethodsDropdown = () => {
        const { dropdown } = getGasMethodsUi();
        if (!dropdown) return;
        dropdown.classList.add('hidden');
    };

    const setGasMethodsSelection = (methods) => {
        gasMethodsSelection = new Set(normalizeMethods(methods));
        renderGasMethodsPills();
        renderGasMethodsDropdown();
    };

    const toggleGasMethodSelection = (method) => {
        if (!GAS_METHOD_OPTIONS.includes(method)) return;
        if (gasMethodsSelection.has(method)) gasMethodsSelection.delete(method);
        else gasMethodsSelection.add(method);
        renderGasMethodsPills();
        renderGasMethodsDropdown();
    };

    const bindGasMethodsUi = () => {
        if (hasBoundGasMethodsUi) return;
        const { root, control, search, dropdown } = getGasMethodsUi();
        if (!root || !control || !search || !dropdown) return;

        hasBoundGasMethodsUi = true;

        control.addEventListener('click', () => {
            search.focus();
            openGasMethodsDropdown();
        });

        control.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-gas-method-remove]');
            if (!removeBtn) return;
            event.stopPropagation();
            toggleGasMethodSelection(removeBtn.getAttribute('data-gas-method-remove'));
            search.focus();
        });

        search.addEventListener('focus', () => openGasMethodsDropdown());
        search.addEventListener('input', () => {
            gasMethodsFilter = search.value || '';
            openGasMethodsDropdown();
        });

        dropdown.addEventListener('click', (event) => {
            const optionBtn = event.target.closest('[data-gas-method-option]');
            if (!optionBtn) return;
            toggleGasMethodSelection(optionBtn.getAttribute('data-gas-method-option'));
            search.focus();
        });

        // Use capture so modal-level stopPropagation handlers do not block outside-click close.
        document.addEventListener('click', (event) => {
            if (!root.contains(event.target)) closeGasMethodsDropdown();
        }, true);
    };

    const getGasMergeUi = () => ({
        overlay: document.getElementById('gasMergeModal'),
        input: document.getElementById('gasMergeTargetSearch'),
        dropdown: document.getElementById('gasMergeTargetDropdown'),
        mergeBtn: document.getElementById('gasMergeConfirmBtn')
    });
    const getGasBulkUi = () => ({
        overlay: document.getElementById('gasBulkAddModal'),
        sourceLabel: document.getElementById('gasBulkSourceLabel'),
        methodSelect: document.getElementById('gasBulkMethodSelect'),
        drinkSelect: document.getElementById('gasBulkDrinkSelect'),
        gearRoot: document.getElementById('gasBulkGearFilterMultiSelect'),
        gearControl: document.getElementById('gasBulkGearFilterControl'),
        gearPills: document.getElementById('gasBulkGearFilterPills'),
        gearSearch: document.getElementById('gasBulkGearFilterSearch'),
        gearDropdown: document.getElementById('gasBulkGearFilterDropdown'),
        addBtn: document.getElementById('gasBulkAddConfirmBtn')
    });

    const getMergeSourceItem = () => getGasItems().find((item) => item.id === getCurrentGasId());

    const getGasMergeCandidates = () => {
        const sourceId = getCurrentGasId();
        return getGasItems()
            .filter((item) => item.id !== sourceId)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    };

    const updateGasMergeConfirmState = () => {
        const { mergeBtn } = getGasMergeUi();
        if (!mergeBtn) return;
        mergeBtn.disabled = !gasMergeTargetId;
        mergeBtn.classList.toggle('opacity-50', !gasMergeTargetId);
        mergeBtn.classList.toggle('cursor-not-allowed', !gasMergeTargetId);
    };

    const renderGasMergeDropdown = () => {
        const { dropdown, input } = getGasMergeUi();
        if (!dropdown) return;

        const q = (input?.value || '').toLowerCase().trim();
        const candidates = getGasMergeCandidates().filter((item) => (item.name || '').toLowerCase().includes(q));

        if (!candidates.length) {
            dropdown.innerHTML = '<div class="px-3 py-2 text-xs text-coffee-500 dark:text-[#a8a29e]">No matching gear</div>';
            return;
        }

        dropdown.innerHTML = candidates
            .map((item) => {
                const selected = item.id === gasMergeTargetId;
                const selectedCls = selected ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                const icon = selected ? '<i class="fa-solid fa-check text-coffee-700 dark:text-[#d6ccc2]"></i>' : '';
                return `<button type="button" data-gas-merge-target-id="${item.id}" class="w-full text-left px-3 py-2 text-xs hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2] flex items-center justify-between ${selectedCls}"><span class="truncate pr-2">${item.name || 'Untitled gear'}</span>${icon}</button>`;
            })
            .join('');
    };

    const selectGasMergeTarget = (targetId) => {
        gasMergeTargetId = targetId || null;
        const { input } = getGasMergeUi();
        if (input) {
            const selected = getGasItems().find((item) => item.id === gasMergeTargetId);
            input.value = selected?.name || '';
        }
        updateGasMergeConfirmState();
        renderGasMergeDropdown();
    };

    const openGasMergeModal = () => {
        const source = getMergeSourceItem();
        const { overlay, input, dropdown } = getGasMergeUi();
        if (!source || !overlay || !input || !dropdown) return;
        document.getElementById('gasCardActionMenu')?.classList.add('hidden');

        const title = document.getElementById('gasMergeSourceLabel');
        if (title) title.textContent = source.name || 'this gear item';

        gasMergeTargetId = null;
        input.value = '';
        updateGasMergeConfirmState();
        renderGasMergeDropdown();
        dropdown.classList.remove('hidden');
        overlay.classList.remove('hidden');
        input.focus();
    };

    const closeGasMergeModal = (event = null) => {
        const { overlay, dropdown } = getGasMergeUi();
        if (!overlay) return;
        if (event && event.target !== overlay) return;
        overlay.classList.add('hidden');
        dropdown?.classList.add('hidden');
        gasMergeTargetId = null;
    };

    const bindGasMergeUi = () => {
        if (hasBoundGasMergeUi) return;
        const { input, dropdown } = getGasMergeUi();
        if (!input || !dropdown) return;
        hasBoundGasMergeUi = true;

        input.addEventListener('focus', () => {
            renderGasMergeDropdown();
            dropdown.classList.remove('hidden');
        });

        input.addEventListener('input', () => {
            gasMergeTargetId = null;
            updateGasMergeConfirmState();
            renderGasMergeDropdown();
            dropdown.classList.remove('hidden');
        });

        dropdown.addEventListener('click', (event) => {
            const optionBtn = event.target.closest('[data-gas-merge-target-id]');
            if (!optionBtn) return;
            selectGasMergeTarget(optionBtn.getAttribute('data-gas-merge-target-id'));
            dropdown.classList.add('hidden');
        });
    };

    const getBulkSourceItem = () => getGasItems().find((item) => item.id === getCurrentGasId());

    const getBrewMethodOptions = () =>
        [...new Set(getCoffees().map((brew) => (brew?.method || '').toString().trim()).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    const getBrewDrinkOptions = () =>
        [...new Set(getCoffees().map((brew) => (brew?.drink || '').toString().trim()).filter(Boolean))].sort((a, b) =>
            a.localeCompare(b, undefined, { sensitivity: 'base' })
        );
    const getBulkGearFilterCandidates = () => {
        const sourceId = getCurrentGasId();
        return getGasItems()
            .filter((item) => item.id !== sourceId)
            .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }));
    };

    const renderBulkGearFilterPills = () => {
        const { gearPills, gearSearch } = getGasBulkUi();
        if (!gearPills || !gearSearch) return;
        const selectedIds = [...gasBulkFilterGearSelection];
        const gearById = new Map(getGasItems().map((item) => [item.id, item]));
        gearPills.innerHTML = selectedIds
            .map((id) => gearById.get(id))
            .filter(Boolean)
            .map(
                (item) =>
                    `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-coffee-100 dark:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2]">${item.name || 'Untitled gear'}<button type="button" data-gas-bulk-gear-remove="${item.id}" class="text-coffee-500 dark:text-[#a8a29e] hover:text-red-500">&times;</button></span>`
            )
            .join('');
        gearSearch.placeholder = selectedIds.length ? '' : 'Search gear...';
    };

    const renderBulkGearFilterDropdown = () => {
        const { gearDropdown } = getGasBulkUi();
        if (!gearDropdown) return;
        const q = (gasBulkFilterGearSearch || '').toLowerCase().trim();
        const visible = getBulkGearFilterCandidates().filter((item) => (item.name || '').toLowerCase().includes(q));
        if (!visible.length) {
            gearDropdown.innerHTML = '<div class="px-3 py-2 text-xs text-coffee-500 dark:text-[#a8a29e]">No matching gear</div>';
            return;
        }
        gearDropdown.innerHTML = visible
            .map((item) => {
                const selected = gasBulkFilterGearSelection.has(item.id);
                const selectedCls = selected ? 'bg-coffee-100 dark:bg-[#34302e] font-semibold' : '';
                const icon = selected ? '<i class="fa-solid fa-check text-coffee-700 dark:text-[#d6ccc2]"></i>' : '';
                return `<button type="button" data-gas-bulk-gear-option="${item.id}" class="w-full text-left px-3 py-2 text-xs hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-800 dark:text-[#d6ccc2] flex items-center justify-between ${selectedCls}"><span class="truncate pr-2">${item.name || 'Untitled gear'}</span>${icon}</button>`;
            })
            .join('');
    };

    const openBulkGearFilterDropdown = () => {
        const { gearDropdown } = getGasBulkUi();
        if (!gearDropdown) return;
        renderBulkGearFilterDropdown();
        gearDropdown.classList.remove('hidden');
    };

    const closeBulkGearFilterDropdown = () => {
        const { gearDropdown } = getGasBulkUi();
        if (!gearDropdown) return;
        gearDropdown.classList.add('hidden');
    };

    const toggleBulkGearFilterSelection = (gearId) => {
        if (!gearId) return;
        if (gasBulkFilterGearSelection.has(gearId)) gasBulkFilterGearSelection.delete(gearId);
        else gasBulkFilterGearSelection.add(gearId);
        renderBulkGearFilterPills();
        renderBulkGearFilterDropdown();
    };

    const openGasBulkAddModal = () => {
        const source = getBulkSourceItem();
        const { overlay, sourceLabel, methodSelect, drinkSelect, gearSearch, addBtn } = getGasBulkUi();
        if (!source || !overlay || !methodSelect || !drinkSelect || !gearSearch || !addBtn) return;
        document.getElementById('gasCardActionMenu')?.classList.add('hidden');

        if (sourceLabel) sourceLabel.textContent = source.name || 'this gear item';
        gasBulkFilterGearSelection = new Set();
        gasBulkFilterGearSearch = '';
        gearSearch.value = '';

        const methods = getBrewMethodOptions();
        methodSelect.innerHTML = '<option value="">Any method</option>' + methods.map((value) => `<option value="${value}">${value}</option>`).join('');
        methodSelect.value = '';

        const drinks = getBrewDrinkOptions();
        drinkSelect.innerHTML = '<option value="">Any drink</option>' + drinks.map((value) => `<option value="${value}">${value}</option>`).join('');
        drinkSelect.value = '';

        renderBulkGearFilterPills();
        renderBulkGearFilterDropdown();
        closeBulkGearFilterDropdown();

        addBtn.disabled = false;
        addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
        addBtn.innerHTML = 'Bulk add';

        overlay.classList.remove('hidden');
        methodSelect.focus();
    };

    const closeGasBulkAddModal = (event = null) => {
        const { overlay } = getGasBulkUi();
        if (!overlay) return;
        if (event && event.target !== overlay) return;
        overlay.classList.add('hidden');
        closeBulkGearFilterDropdown();
        gasBulkFilterGearSelection = new Set();
        gasBulkFilterGearSearch = '';
    };

    const bindGasBulkUi = () => {
        if (hasBoundGasBulkUi) return;
        const { gearRoot, gearControl, gearSearch, gearDropdown } = getGasBulkUi();
        if (!gearRoot || !gearControl || !gearSearch || !gearDropdown) return;
        hasBoundGasBulkUi = true;

        gearControl.addEventListener('click', () => {
            gearSearch.focus();
            openBulkGearFilterDropdown();
        });

        gearControl.addEventListener('click', (event) => {
            const removeBtn = event.target.closest('[data-gas-bulk-gear-remove]');
            if (!removeBtn) return;
            event.stopPropagation();
            toggleBulkGearFilterSelection(removeBtn.getAttribute('data-gas-bulk-gear-remove'));
            gearSearch.focus();
        });

        gearSearch.addEventListener('focus', () => openBulkGearFilterDropdown());
        gearSearch.addEventListener('input', () => {
            gasBulkFilterGearSearch = gearSearch.value || '';
            openBulkGearFilterDropdown();
        });

        gearDropdown.addEventListener('click', (event) => {
            const optionBtn = event.target.closest('[data-gas-bulk-gear-option]');
            if (!optionBtn) return;
            toggleBulkGearFilterSelection(optionBtn.getAttribute('data-gas-bulk-gear-option'));
            gearSearch.focus();
        });

        // Use capture so modal-level stopPropagation handlers do not block outside-click close.
        document.addEventListener('click', (event) => {
            if (!gearRoot.contains(event.target)) closeBulkGearFilterDropdown();
        }, true);
    };

    const triggerGasPhoto = (e) => {
        if (e) e.stopPropagation();
        if (!getCurrentGasId()) return;
        document.getElementById('gasPhotoInput')?.click();
    };

    const openGasPhoto = (e) => {
        if (e) e.stopPropagation();
        const item = getCurrentGasItem();
        const url = item?.imageUrl || item?.imageURL;
        if (url) window.open(url, '_blank');
    };

    const removeGasPhoto = async (e) => {
        if (e) e.stopPropagation();
        const user = getCurrentUser();
        const gasId = getCurrentGasId();
        if (!user || !gasId) return;

        const item = getCurrentGasItem();
        const url = item?.imageUrl || item?.imageURL;
        if (!url) return;

        try {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
            await updateDoc(doc(db, 'users', user.uid, 'gear', gasId), {
                imageUrl: null,
                updatedAt: new Date().toISOString()
            });
            setGasItemsState(
                getGasItems().map((entry) =>
                    entry.id === gasId ? { ...entry, imageUrl: null, imageURL: null, updatedAt: new Date().toISOString() } : entry
                )
            );
            openGasCard(gasId);
        } catch (err) {
            console.error('Remove gear photo failed:', err);
            alert('Failed to remove image.');
        }
    };

    const handleGasPhoto = async (event) => {
        const file = event.target.files?.[0];
        const user = getCurrentUser();
        const gasId = getCurrentGasId();
        if (!file || !user || !gasId) return;

        const cardView = document.getElementById('gasCardView');
        const originalClasses = cardView?.className;

        try {
            if (cardView) cardView.classList.add('ai-loading-pulse');
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            const timestamp = Date.now();
            const storageRef = ref(storage, `photos/${user.uid}/gear_${gasId}_${timestamp}`);
            const snapshot = await uploadBytes(storageRef, compressedFile);
            const downloadURL = await getDownloadURL(snapshot.ref);
            const nowIso = new Date().toISOString();
            await updateDoc(doc(db, 'users', user.uid, 'gear', gasId), {
                imageUrl: downloadURL,
                updatedAt: nowIso
            });
            setGasItemsState(
                getGasItems().map((entry) =>
                    entry.id === gasId ? { ...entry, imageUrl: downloadURL, updatedAt: nowIso } : entry
                )
            );
            openGasCard(gasId);
        } catch (err) {
            console.error('Gear photo upload failed:', err);
            alert('Failed to upload image.');
        } finally {
            if (cardView && originalClasses) cardView.className = originalClasses;
            event.target.value = '';
        }
    };

    const updateGasCardNav = () => {
        const order = getFilteredSortedGasItems().map((item) => item.id);
        const idx = order.indexOf(getCurrentGasId());
        const prevBtn = document.getElementById('gasCardPrevBtn');
        const nextBtn = document.getElementById('gasCardNextBtn');
        if (!prevBtn || !nextBtn) return;

        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx === -1 || idx >= order.length - 1;
        prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
        prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-40', nextBtn.disabled);
        nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
    };

    const openGasCard = (gasId, ev) => {
        if (ev) ev.stopPropagation();
        closeAllActionMenus();
        const item = getGasItems().find((entry) => entry.id === gasId);
        if (!item) return;
        bindGasMergeUi();
        bindGasBulkUi();

        setCurrentGasId(item.id);
        const isMine = getCurrentView() === 'mine';

        document.getElementById('gasCardTitle').textContent = item.name || 'Untitled gear';
        document.getElementById('gasCardSubtitle').textContent = item.archived ? 'Archived item' : 'Active item';
        document.getElementById('gasCardType').textContent = normalizeType(item.type);
        document.getElementById('gasCardPrice').textContent = formatCurrency(item.price);
        document.getElementById('gasCardArchived').textContent = item.archived ? 'Yes' : 'No';
        const purchasedDate = item.purchasedDate;
        document.getElementById('gasCardCreated').textContent = purchasedDate ? new Date(purchasedDate).toLocaleDateString() : '-';
        const methods = normalizeMethods(item.methods);
        document.getElementById('gasCardMethods').textContent = methods.length ? methods.join(', ') : '-';
        const imageUrl = item.imageUrl || item.imageURL;
        const imageEl = document.getElementById('gasCardImage');
        const imagePlaceholder = document.getElementById('gasCardImagePlaceholder');
        if (imageUrl) {
            imageEl.src = imageUrl;
            imageEl.classList.remove('hidden');
            imagePlaceholder.classList.add('hidden');
        } else {
            imageEl.src = '';
            imageEl.classList.add('hidden');
            imagePlaceholder.classList.remove('hidden');
        }

        const archiveBtn = document.getElementById('gasCardActionArchiveBtn');
        if (archiveBtn) archiveBtn.innerHTML = `<i class="fa-solid fa-box-archive text-amber-600 w-4"></i> ${item.archived ? 'Unarchive' : 'Archive'}`;

        document.getElementById('gasCardView').classList.remove('hidden');
        document.getElementById('gasCardEdit').classList.add('hidden');
        document.getElementById('gasCardEditBtn').classList.toggle('hidden', !isMine);
        document.getElementById('gasCardMenuBtn').classList.toggle('hidden', !isMine);
        setGasCardHeightForMode('view');

        updateGasCardNav();
        document.getElementById('gasCardOverlay').classList.remove('hidden');
    };

    const closeGasCard = (event) => {
        if (event && event.target !== event.currentTarget) return;
        closeGasMergeModal();
        closeGasBulkAddModal();
        document.getElementById('gasCardEdit').classList.add('hidden');
        document.getElementById('gasCardView').classList.remove('hidden');
        document.getElementById('gasCardEditBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('gasCardMenuBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        closeGasMethodsDropdown();
        setGasCardHeightForMode('view');
        document.getElementById('gasCardOverlay').classList.add('hidden');
    };

    const enterGasEditMode = () => {
        const item = getCurrentGasItem();
        if (!item) return;

        bindGasMethodsUi();
        document.getElementById('gasEditName').value = item.name || '';
        document.getElementById('gasEditPrice').value = item.price ?? '';
        document.getElementById('gasEditPurchasedDate').value = toInputDate(item.purchasedDate);
        document.getElementById('gasEditType').value = normalizeType(item.type);
        gasMethodsFilter = '';
        const { search } = getGasMethodsUi();
        if (search) search.value = '';
        setGasMethodsSelection(item.methods);

        document.getElementById('gasCardView').classList.add('hidden');
        document.getElementById('gasCardEdit').classList.remove('hidden');
        document.getElementById('gasCardEditBtn').classList.add('hidden');
        document.getElementById('gasCardMenuBtn').classList.add('hidden');
        document.getElementById('gasCardActionMenu').classList.add('hidden');
        setGasCardHeightForMode('edit');
    };

    const cancelGasEditMode = () => {
        document.getElementById('gasCardEdit').classList.add('hidden');
        document.getElementById('gasCardView').classList.remove('hidden');
        document.getElementById('gasCardEditBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('gasCardMenuBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        closeGasMethodsDropdown();
        setGasCardHeightForMode('view');
    };

    const saveGasEdits = async () => {
        const user = getCurrentUser();
        const gasId = getCurrentGasId();
        if (!user || !gasId) return;

        const nowIso = new Date().toISOString();
        const rawPrice = document.getElementById('gasEditPrice').value;
        const parsedPrice = rawPrice === '' ? null : Number(rawPrice);
        const purchasedDateVal = document.getElementById('gasEditPurchasedDate').value;
        const methods = normalizeMethods([...gasMethodsSelection]);

        const updates = {
            name: document.getElementById('gasEditName').value || '',
            price: Number.isFinite(parsedPrice) ? parsedPrice : null,
            purchasedDate: purchasedDateVal ? new Date(purchasedDateVal).toISOString() : null,
            type: normalizeType(document.getElementById('gasEditType').value),
            methods,
            updatedAt: nowIso
        };

        try {
            await updateDoc(doc(db, 'users', user.uid, 'gear', gasId), updates);
            setGasItemsState(getGasItems().map((item) => (item.id === gasId ? { ...item, ...updates } : item)));
            renderGasTable();
            closeGasMethodsDropdown();
            openGasCard(gasId);
        } catch (err) {
            console.error('Error saving gear edits:', err);
            alert('Failed to save changes.');
        }
    };

    const toggleGasArchive = async (gasId = null, options = {}) => {
        const user = getCurrentUser();
        const targetId = gasId || getCurrentGasId();
        const { reopenCard = true } = options;
        if (!user || !targetId) return;

        const item = getGasItems().find((entry) => entry.id === targetId);
        if (!item) return;

        const nowIso = new Date().toISOString();
        const updates = {
            archived: !item.archived,
            updatedAt: nowIso
        };

        try {
            await updateDoc(doc(db, 'users', user.uid, 'gear', targetId), updates);
            setGasItemsState(getGasItems().map((entry) => (entry.id === targetId ? { ...entry, ...updates } : entry)));
            renderGasTable();
            if (reopenCard && getCurrentGasId() === targetId) openGasCard(targetId);
        } catch (err) {
            console.error('Error updating archive state:', err);
            alert('Failed to update archive state.');
        }
    };

    const deleteGasItem = async (gasId = null) => {
        const user = getCurrentUser();
        const targetId = gasId || getCurrentGasId();
        if (!user || !targetId) return;

        const shouldDelete = await openAppConfirm({
            title: 'Delete gear item?',
            message: 'This action cannot be undone.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!shouldDelete) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'gear', targetId));
            setGasItemsState(getGasItems().filter((item) => item.id !== targetId));
            renderGasTable();
            if (getCurrentGasId() === targetId) closeGasCard(null);
        } catch (err) {
            console.error('Error deleting gear item:', err);
            alert('Failed to delete gear item.');
        }
    };

    const navigateGasCard = (direction) => {
        const order = getFilteredSortedGasItems().map((item) => item.id);
        const idx = order.indexOf(getCurrentGasId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        openGasCard(order[nextIdx]);
    };

    const openGasFromTableEdit = (gasId) => {
        closeAllActionMenus();
        openGasCard(gasId);
        enterGasEditMode();
    };

    const toggleGasArchiveFromTable = (gasId) => {
        toggleGasArchive(gasId, { reopenCard: false });
    };

    const deleteGasFromTable = (gasId) => {
        closeAllActionMenus();
        deleteGasItem(gasId);
    };

    const openGasMergeFromTable = (gasId) => {
        closeAllActionMenus();
        openGasCard(gasId);
        openGasMergeModal();
    };

    const openGasBulkAddFromTable = (gasId) => {
        closeAllActionMenus();
        openGasCard(gasId);
        openGasBulkAddModal();
    };

    const bulkAddGearToBrews = async () => {
        const user = getCurrentUser();
        const source = getBulkSourceItem();
        const { methodSelect, drinkSelect, addBtn } = getGasBulkUi();
        if (!user || !source || !methodSelect || !drinkSelect || !addBtn) return;

        const filterMethod = (methodSelect.value || '').toString();
        const filterDrink = (drinkSelect.value || '').toString();
        const requiredGearIds = [...gasBulkFilterGearSelection];
        const isSourceGrinder = normalizeType(source.type) === 'Grinder';
        const sourceName = (source.name || '').toString();

        const originalLabel = addBtn.innerHTML;
        addBtn.disabled = true;
        addBtn.classList.add('opacity-50', 'cursor-not-allowed');
        addBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Bulk adding...';

        try {
            const coffees = getCoffees();
            const nowIso = new Date().toISOString();
            const updates = [];

            coffees.forEach((brew) => {
                if (filterMethod && (brew.method || '') !== filterMethod) return;
                if (filterDrink && (brew.drink || '') !== filterDrink) return;

                const currentGearIds = Array.isArray(brew.gearIds) ? [...new Set(brew.gearIds.filter(Boolean))] : [];
                const hasAllRequiredGear = requiredGearIds.every((gearId) => currentGearIds.includes(gearId));
                if (!hasAllRequiredGear) return;

                const nextGearIds = currentGearIds.includes(source.id) ? currentGearIds : [...currentGearIds, source.id];
                const grinderValue = isSourceGrinder ? sourceName : brew.grinder;
                const gearChanged =
                    nextGearIds.length !== currentGearIds.length ||
                    nextGearIds.some((id, idx) => id !== currentGearIds[idx]);
                const grinderChanged = isSourceGrinder && (brew.grinder || '') !== sourceName;
                if (!gearChanged && !grinderChanged) return;

                updates.push({
                    brewId: brew.id,
                    gearIds: nextGearIds,
                    grinder: grinderValue,
                    updatedAt: nowIso
                });
            });

            if (!updates.length) {
                alert('No matching brews to update.');
                return;
            }

            const batchLimit = 450;
            let batch = writeBatch(db);
            let opCount = 0;
            for (const update of updates) {
                const payload = {
                    gearIds: update.gearIds,
                    updatedAt: update.updatedAt
                };
                if (isSourceGrinder) payload.grinder = update.grinder;
                batch.update(doc(collection(db, 'users', user.uid, 'coffees'), update.brewId), payload);
                opCount += 1;
                if (opCount >= batchLimit) {
                    await batch.commit();
                    batch = writeBatch(db);
                    opCount = 0;
                }
            }
            if (opCount > 0) await batch.commit();

            const updateMap = new Map(updates.map((entry) => [entry.brewId, entry]));
            setCoffeesState(
                coffees.map((brew) => {
                    const patch = updateMap.get(brew.id);
                    if (!patch) return brew;
                    return {
                        ...brew,
                        gearIds: patch.gearIds,
                        grinder: isSourceGrinder ? patch.grinder : brew.grinder,
                        updatedAt: patch.updatedAt
                    };
                })
            );

            closeGasBulkAddModal();
            alert(`Bulk add complete. Updated ${updates.length} brew(s).`);
        } catch (err) {
            console.error('Bulk add gear to brews failed:', err);
            alert(`Bulk add failed: ${err.message}`);
        } finally {
            addBtn.disabled = false;
            addBtn.classList.remove('opacity-50', 'cursor-not-allowed');
            addBtn.innerHTML = originalLabel || 'Bulk add';
        }
    };

    const mergeGasItem = async () => {
        const user = getCurrentUser();
        const sourceId = getCurrentGasId();
        const targetId = gasMergeTargetId;
        if (!user || !sourceId || !targetId || sourceId === targetId) return;

        const sourceItem = getGasItems().find((item) => item.id === sourceId);
        const targetItem = getGasItems().find((item) => item.id === targetId);
        if (!sourceItem || !targetItem) return;
        const isTargetGrinder = normalizeType(targetItem.type) === 'Grinder';
        const targetGrinderName = (targetItem.name || '').toString();

        const { mergeBtn } = getGasMergeUi();
        const originalLabel = mergeBtn?.innerHTML;
        if (mergeBtn) {
            mergeBtn.disabled = true;
            mergeBtn.classList.add('opacity-50', 'cursor-not-allowed');
            mergeBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Merging...';
        }

        try {
            const coffees = getCoffees();
            const updates = [];
            const nowIso = new Date().toISOString();
            coffees.forEach((brew) => {
                const gearIds = Array.isArray(brew.gearIds) ? brew.gearIds : [];
                if (!gearIds.includes(sourceId)) return;
                const nextIds = [];
                gearIds.forEach((id) => {
                    const mapped = id === sourceId ? targetId : id;
                    if (!nextIds.includes(mapped)) nextIds.push(mapped);
                });
                updates.push({
                    brewId: brew.id,
                    gearIds: nextIds,
                    grinder: isTargetGrinder ? targetGrinderName : brew.grinder,
                    updatedAt: nowIso
                });
            });

            if (updates.length) {
                const batchLimit = 450;
                let batch = writeBatch(db);
                let opCount = 0;
                for (const update of updates) {
                    const payload = {
                        gearIds: update.gearIds,
                        updatedAt: update.updatedAt
                    };
                    if (isTargetGrinder) payload.grinder = targetGrinderName;
                    batch.update(doc(collection(db, 'users', user.uid, 'coffees'), update.brewId), payload);
                    opCount += 1;
                    if (opCount >= batchLimit) {
                        await batch.commit();
                        batch = writeBatch(db);
                        opCount = 0;
                    }
                }
                if (opCount > 0) await batch.commit();

                const updateMap = new Map(updates.map((entry) => [entry.brewId, entry.gearIds]));
                const grinderMap = new Map(updates.map((entry) => [entry.brewId, entry.grinder]));
                const updatedAtMap = new Map(updates.map((entry) => [entry.brewId, entry.updatedAt]));
                setCoffeesState(
                    coffees.map((brew) =>
                        updateMap.has(brew.id)
                            ? {
                                  ...brew,
                                  gearIds: updateMap.get(brew.id),
                                  grinder: isTargetGrinder ? grinderMap.get(brew.id) : brew.grinder,
                                  updatedAt: updatedAtMap.get(brew.id)
                              }
                            : brew
                    )
                );
            }

            await deleteDoc(doc(db, 'users', user.uid, 'gear', sourceId));
            setGasItemsState(getGasItems().filter((item) => item.id !== sourceId));
            renderGasTable();
            closeGasMergeModal();
            openGasCard(targetId);
        } catch (err) {
            console.error('Error merging gear item:', err);
            alert('Failed to merge gear item.');
        } finally {
            if (mergeBtn) {
                mergeBtn.disabled = !gasMergeTargetId;
                mergeBtn.classList.toggle('opacity-50', mergeBtn.disabled);
                mergeBtn.classList.toggle('cursor-not-allowed', mergeBtn.disabled);
                mergeBtn.innerHTML = originalLabel || 'Merge';
            }
        }
    };

    const closeGasCardMenu = () => {
        const menu = document.getElementById('gasCardActionMenu');
        if (menu) menu.classList.add('hidden');
    };

    return {
        updateGasCardNav,
        openGasCard,
        closeGasCard,
        enterGasEditMode,
        cancelGasEditMode,
        saveGasEdits,
        toggleGasArchive,
        deleteGasItem,
        navigateGasCard,
        openGasFromTableEdit,
        openGasMergeFromTable,
        openGasBulkAddModal,
        closeGasBulkAddModal,
        openGasBulkAddFromTable,
        bulkAddGearToBrews,
        toggleGasArchiveFromTable,
        deleteGasFromTable,
        openGasMergeModal,
        closeGasMergeModal,
        mergeGasItem,
        triggerGasPhoto,
        openGasPhoto,
        removeGasPhoto,
        handleGasPhoto,
        closeGasCardMenu
    };
};
