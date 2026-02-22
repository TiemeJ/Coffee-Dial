const MAX_PRESETS = 25;
const CLOUD_FIELD = 'brewsTableStatePresets';

const escapeHtml = (value) =>
    String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

export const createBrewsTableStatePresetsModule = ({
    getCurrentUser,
    dataService,
    getCurrentSort,
    setCurrentSort,
    getActiveFilters,
    setActiveFilters,
    getCurrentView,
    setDisplayedBrewsCount,
    getBrewsPerPage,
    renderTable,
    renderActiveFilters,
    updateBrewSortIcons
} = {}) => {
    const requireFn = (fn, name) => {
        if (typeof fn !== 'function') throw new Error(`createBrewsTableStatePresetsModule requires ${name}`);
    };
    requireFn(getCurrentSort, 'getCurrentSort');
    requireFn(setCurrentSort, 'setCurrentSort');
    requireFn(getActiveFilters, 'getActiveFilters');
    requireFn(setActiveFilters, 'setActiveFilters');
    requireFn(setDisplayedBrewsCount, 'setDisplayedBrewsCount');
    requireFn(getBrewsPerPage, 'getBrewsPerPage');
    requireFn(renderTable, 'renderTable');
    requireFn(renderActiveFilters, 'renderActiveFilters');
    requireFn(updateBrewSortIcons, 'updateBrewSortIcons');
    const { db, doc, getDoc, updateDoc } = dataService || {};
    if (!db || !doc || !getDoc || !updateDoc) {
        throw new Error('createBrewsTableStatePresetsModule requires dataService { db, doc, getDoc, updateDoc }');
    }

    let presetsCache = null;
    let presetsCacheUid = null;

    const readPresets = async () => {
        const user = getCurrentUser?.();
        const uid = user?.uid || null;
        if (!uid) return [];
        if (presetsCache && presetsCacheUid === uid) return presetsCache;
        try {
            const snap = await getDoc(doc(db, 'users', uid));
            const fromCloud = snap.exists() ? snap.data()?.[CLOUD_FIELD] : null;
            const normalized = Array.isArray(fromCloud) ? fromCloud : [];
            presetsCache = normalized;
            presetsCacheUid = uid;
            return normalized;
        } catch (err) {
            console.error('Failed to load brew table state presets from cloud', err);
            return [];
        }
    };

    const writePresets = async (presets = []) => {
        const normalized = presets.slice(0, MAX_PRESETS);
        const user = getCurrentUser?.();
        const uid = user?.uid || null;
        if (!uid) return;
        try {
            await updateDoc(doc(db, 'users', uid), { [CLOUD_FIELD]: normalized });
            presetsCache = normalized;
            presetsCacheUid = uid;
        } catch (err) {
            console.error('Failed to save brew table state presets to cloud', err);
        }
    };

    const getStateDropdown = () => document.getElementById('brewsTableStateDropdown');
    const getSearchInput = () => document.getElementById('globalSearch');

    const closeBrewsTableStateMenu = () => {
        getStateDropdown()?.classList.add('hidden');
    };

    const buildPresetRowHtml = (preset) => {
        const escapedId = escapeHtml(preset.id);
        const escapedName = escapeHtml(preset.name || 'Untitled');
        const updatedAt = new Date(preset.updatedAt || Date.now()).toLocaleDateString();
        return `
            <div class="flex items-center justify-between gap-2 px-3 py-2 border-b border-coffee-100 dark:border-[#44403c] last:border-b-0">
                <button
                    type="button"
                    data-action-click="loadBrewsTableStatePreset('${escapedId}')"
                    class="text-left flex-1 min-w-0 hover:text-coffee-800 dark:hover:text-white"
                >
                    <div class="text-xs font-bold text-coffee-800 dark:text-white truncate">${escapedName}</div>
                    <div class="text-[10px] text-coffee-400 dark:text-[#78716c]">Saved ${updatedAt}</div>
                </button>
                <button
                    type="button"
                    data-action-click="deleteBrewsTableStatePreset('${escapedId}')"
                    class="w-6 h-6 rounded text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center justify-center"
                    title="Delete saved state"
                >
                    <i class="fa-solid fa-trash text-[11px]"></i>
                </button>
            </div>
        `;
    };

    const renderBrewsTableStateMenu = async () => {
        const dropdown = getStateDropdown();
        if (!dropdown) return;
        const presets = await readPresets();
        const listHtml = presets.length
            ? presets.map(buildPresetRowHtml).join('')
            : '<div class="px-3 py-3 text-xs text-coffee-500 dark:text-[#78716c] italic">No saved states yet.</div>';

        dropdown.innerHTML = `
            <div class="px-3 py-2 text-xs font-bold text-coffee-400 dark:text-[#78716c] uppercase border-b border-coffee-100 dark:border-[#44403c]">
                Table states
            </div>
            <div class="p-3 border-b border-coffee-100 dark:border-[#44403c]">
                <input
                    id="brewsStatePresetNameInput"
                    type="text"
                    maxlength="40"
                    placeholder="Name this state"
                    class="w-full p-2 text-xs rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#1c1917] text-coffee-900 dark:text-white"
                />
                <button
                    type="button"
                    data-action-click="saveCurrentBrewsTableState()"
                    class="mt-2 w-full px-2 py-1.5 rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white text-xs font-bold"
                >
                    Save current state
                </button>
            </div>
            <div class="max-h-56 overflow-y-auto">${listHtml}</div>
        `;
    };

    const getCurrentState = () => {
        const searchInput = getSearchInput();
        return {
            search: searchInput?.value || '',
            sort: { ...(getCurrentSort?.() || { key: null, direction: 'asc' }) },
            filters: { ...(getActiveFilters?.() || {}) },
            view: getCurrentView?.() || 'mine'
        };
    };

    const toggleBrewsTableStateMenu = async (event) => {
        event?.stopPropagation?.();
        const dropdown = getStateDropdown();
        if (!dropdown) return;
        const hidden = dropdown.classList.contains('hidden');
        if (hidden) {
            await renderBrewsTableStateMenu();
            dropdown.classList.remove('hidden');
        } else {
            dropdown.classList.add('hidden');
        }
    };

    const saveCurrentBrewsTableState = async () => {
        const nameInput = document.getElementById('brewsStatePresetNameInput');
        const name = nameInput?.value?.trim();
        if (!name) return false;

        const saved = await saveBrewsTableStatePresetByName(name);
        if (!saved) return false;
        await renderBrewsTableStateMenu();
        return true;
    };

    const saveBrewsTableStatePresetByName = async (nameRaw) => {
        const name = (nameRaw || '').trim();
        if (!name) return false;

        const next = {
            id: `preset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            name,
            updatedAt: new Date().toISOString(),
            state: getCurrentState()
        };
        const presets = await readPresets();
        const existingIndex = presets.findIndex((preset) => preset.name.toLowerCase() === name.toLowerCase());
        if (existingIndex >= 0) presets.splice(existingIndex, 1);
        presets.unshift(next);
        await writePresets(presets);
        return true;
    };

    const applyBrewTableState = (state) => {
        if (!state || typeof state !== 'object') return;
        const searchInput = getSearchInput();
        if (searchInput) searchInput.value = state.search || '';
        document.getElementById('searchClearBtn')?.classList.toggle('hidden', !(state.search || '').length);

        const nextSort = Array.isArray(state.sort)
            ? state.sort
            : (state.sort && typeof state.sort === 'object' ? state.sort : []);
        setCurrentSort(nextSort);
        setActiveFilters(state.filters && typeof state.filters === 'object' ? state.filters : {});
        setDisplayedBrewsCount(getBrewsPerPage());
        updateBrewSortIcons();
        renderTable();
        renderActiveFilters();
    };

    const loadBrewsTableStatePreset = async (presetId) => {
        if (!presetId) return;
        const preset = (await readPresets()).find((item) => item.id === presetId);
        if (!preset) return;
        applyBrewTableState(preset.state);
        closeBrewsTableStateMenu();
    };

    const deleteBrewsTableStatePreset = async (presetId) => {
        if (!presetId) return;
        const next = (await readPresets()).filter((item) => item.id !== presetId);
        await writePresets(next);
        await renderBrewsTableStateMenu();
    };

    const listBrewsTableStatePresets = async () => {
        const presets = await readPresets();
        return Array.isArray(presets) ? [...presets] : [];
    };

    document.addEventListener(
        'click',
        (event) => {
            const dropdown = getStateDropdown();
            if (!dropdown || dropdown.classList.contains('hidden')) return;
            if (event.target.closest('#brewsStateMenuBtn') || event.target.closest('#brewsTableStateDropdown')) return;
            closeBrewsTableStateMenu();
        },
        true
    );

    return {
        toggleBrewsTableStateMenu,
        closeBrewsTableStateMenu,
        saveCurrentBrewsTableState,
        saveBrewsTableStatePresetByName,
        loadBrewsTableStatePreset,
        deleteBrewsTableStatePreset,
        listBrewsTableStatePresets
    };
};
