export const createGasCardModule = ({
    getCurrentUser,
    getCurrentView,
    getCurrentGasId,
    setCurrentGasId,
    getGasItems,
    setGasItemsState,
    getFilteredSortedGasItems,
    db,
    doc,
    updateDoc,
    deleteDoc,
    openAppConfirm,
    renderGasTable
}) => {
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
    const GAS_TYPE_OPTIONS = ['Coffee maker', 'Grinder', 'Other'];

    const formatCurrency = (value) => {
        const num = Number(value);
        if (!Number.isFinite(num)) return '-';
        return `EUR ${num.toFixed(2)}`;
    };

    const getCurrentGasItem = () => getGasItems().find((item) => item.id === getCurrentGasId());

    const normalizeMethods = (methods) => {
        if (!Array.isArray(methods)) return [];
        return [...new Set(methods.filter((method) => GAS_METHOD_OPTIONS.includes(method)))];
    };
    const normalizeType = (type) => (GAS_TYPE_OPTIONS.includes(type) ? type : 'Other');

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
        const item = getGasItems().find((entry) => entry.id === gasId);
        if (!item) return;

        setCurrentGasId(item.id);
        const isMine = getCurrentView() === 'mine';

        document.getElementById('gasCardTitle').textContent = item.name || 'Untitled gear';
        document.getElementById('gasCardSubtitle').textContent = item.archived ? 'Archived item' : 'Active item';
        document.getElementById('gasCardType').textContent = normalizeType(item.type);
        document.getElementById('gasCardPrice').textContent = formatCurrency(item.price);
        document.getElementById('gasCardArchived').textContent = item.archived ? 'Yes' : 'No';
        document.getElementById('gasCardCreated').textContent = item.createdAt ? new Date(item.createdAt).toLocaleDateString() : '-';
        document.getElementById('gasCardUpdated').textContent = item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-';
        const methods = normalizeMethods(item.methods);
        document.getElementById('gasCardMethods').textContent = methods.length ? methods.join(', ') : '-';

        const archiveBtn = document.getElementById('gasCardActionArchiveBtn');
        if (archiveBtn) archiveBtn.innerHTML = `<i class="fa-solid fa-box-archive text-amber-600 w-4"></i> ${item.archived ? 'Unarchive' : 'Archive'}`;

        document.getElementById('gasCardView').classList.remove('hidden');
        document.getElementById('gasCardEdit').classList.add('hidden');
        document.getElementById('gasCardEditBtn').classList.toggle('hidden', !isMine);
        document.getElementById('gasCardMenuBtn').classList.toggle('hidden', !isMine);

        updateGasCardNav();
        document.getElementById('gasCardOverlay').classList.remove('hidden');
    };

    const closeGasCard = (event) => {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('gasCardEdit').classList.add('hidden');
        document.getElementById('gasCardView').classList.remove('hidden');
        document.getElementById('gasCardEditBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('gasCardMenuBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('gasCardOverlay').classList.add('hidden');
    };

    const enterGasEditMode = () => {
        const item = getCurrentGasItem();
        if (!item) return;

        document.getElementById('gasEditName').value = item.name || '';
        document.getElementById('gasEditPrice').value = item.price ?? '';
        document.getElementById('gasEditType').value = normalizeType(item.type);
        const selectedMethods = new Set(normalizeMethods(item.methods));
        document.querySelectorAll('input[name="gasEditMethods"]').forEach((input) => {
            input.checked = selectedMethods.has(input.value);
        });

        document.getElementById('gasCardView').classList.add('hidden');
        document.getElementById('gasCardEdit').classList.remove('hidden');
        document.getElementById('gasCardEditBtn').classList.add('hidden');
        document.getElementById('gasCardMenuBtn').classList.add('hidden');
        document.getElementById('gasCardActionMenu').classList.add('hidden');
    };

    const cancelGasEditMode = () => {
        document.getElementById('gasCardEdit').classList.add('hidden');
        document.getElementById('gasCardView').classList.remove('hidden');
        document.getElementById('gasCardEditBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('gasCardMenuBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
    };

    const saveGasEdits = async () => {
        const user = getCurrentUser();
        const gasId = getCurrentGasId();
        if (!user || !gasId) return;

        const nowIso = new Date().toISOString();
        const rawPrice = document.getElementById('gasEditPrice').value;
        const parsedPrice = rawPrice === '' ? null : Number(rawPrice);
        const methods = normalizeMethods(
            Array.from(document.querySelectorAll('input[name="gasEditMethods"]:checked')).map((input) => input.value)
        );
        const updates = {
            name: document.getElementById('gasEditName').value || '',
            price: Number.isFinite(parsedPrice) ? parsedPrice : null,
            type: normalizeType(document.getElementById('gasEditType').value),
            methods,
            updatedAt: nowIso
        };

        try {
            await updateDoc(doc(db, 'users', user.uid, 'gear', gasId), updates);
            setGasItemsState(getGasItems().map((item) => (item.id === gasId ? { ...item, ...updates } : item)));
            renderGasTable();
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
        openGasCard(gasId);
        enterGasEditMode();
    };

    const toggleGasArchiveFromTable = (gasId) => {
        toggleGasArchive(gasId, { reopenCard: false });
    };

    const deleteGasFromTable = (gasId) => {
        deleteGasItem(gasId);
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
        toggleGasArchiveFromTable,
        deleteGasFromTable,
        closeGasCardMenu
    };
};
