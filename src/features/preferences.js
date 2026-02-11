export const DEFAULT_PINNED_BREWS_PREFERENCES = {
    animationsEnabled: true,
    organizeByBeans: true,
    pinOpenBags: false,
    pinOpenBagsBestOnly: false,
    swapRoasterFarmer: false
};

export const createBrewsPreferencesModule = ({
    columnDefs,
    getColumnPreferences,
    setColumnPreferences,
    getPinnedBrewsPreferences,
    setPinnedBrewsPreferences,
    getCurrentUser,
    db,
    doc,
    updateDoc,
    applyAnimationClass,
    renderTable,
    renderPinnedTiles,
    pinBrewsFromOpenBags,
    pinBestBrewsForAllOpenBags,
    showAutoPinToast
}) => {
    const columnPreferencesKey = 'columnPreferences';

    const loadColumnPreferencesFromStorage = () => {
        const raw = localStorage.getItem(columnPreferencesKey);
        if (!raw) return;
        try {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') {
                setColumnPreferences({ ...getColumnPreferences(), ...parsed });
            }
        } catch (err) {
            console.error('Failed to parse column preferences', err);
        }
    };

    const saveColumnPreferencesToStorage = (prefs) => {
        localStorage.setItem(columnPreferencesKey, JSON.stringify(prefs));
    };

    const loadLegacyPinnedBrewsPreferences = () => {
        const animationsRaw = localStorage.getItem('animationsEnabled');
        const organizeRaw = localStorage.getItem('organizeByBeans');
        const pinOpenRaw = localStorage.getItem('pinOpenBags');
        const hasLegacy = animationsRaw !== null || organizeRaw !== null || pinOpenRaw !== null;
        if (!hasLegacy) return null;
        return {
            animationsEnabled: animationsRaw !== 'false',
            organizeByBeans: organizeRaw !== 'false',
            pinOpenBags: pinOpenRaw === 'true'
        };
    };

    const applyAnimationPreference = () => {
        applyAnimationClass(!!getPinnedBrewsPreferences().animationsEnabled);
    };

    const updateBestOnlyToggleState = (pinOpenBagsEnabled = null) => {
        const row = document.getElementById('pinOpenBagsBestOnlyRow');
        const toggle = document.getElementById('pinOpenBagsBestOnlyToggle');
        if (!row || !toggle) return;

        const enabled =
            typeof pinOpenBagsEnabled === 'boolean'
                ? pinOpenBagsEnabled
                : !!document.getElementById('pinOpenBagsToggle')?.checked;

        toggle.disabled = !enabled;
        if (!enabled) toggle.checked = false;
        row.classList.toggle('opacity-50', !enabled);
        row.classList.toggle('cursor-not-allowed', !enabled);
    };

    const openPreferences = () => {
        const list = document.getElementById('preferencesList');
        list.innerHTML = '';

        const columnPreferences = getColumnPreferences();
        columnDefs.forEach((col) => {
            const isChecked = columnPreferences[col.id] !== false;
            const div = document.createElement('div');
            div.className =
                'flex items-center justify-between p-2 rounded bg-coffee-50 dark:bg-[#1c1917] border border-coffee-100 dark:border-[#44403c]';
            div.innerHTML = `<span class="text-sm font-medium text-coffee-800 dark:text-[#d6ccc2]">${col.label}</span><div class="relative inline-block w-10 align-middle select-none"><input type="checkbox" id="pref_${col.id}" ${isChecked ? 'checked' : ''} class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 dark:border-gray-600"/><label for="pref_${col.id}" class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 dark:bg-gray-700 cursor-pointer"></label></div>`;
            list.appendChild(div);
        });

        const pinnedPrefs = getPinnedBrewsPreferences();
        const pinOpenBagsEnabled = !!pinnedPrefs.pinOpenBags;

        document.getElementById('animationsToggle').checked = !!pinnedPrefs.animationsEnabled;
        document.getElementById('organizeByBeansToggle').checked = !!pinnedPrefs.organizeByBeans;
        document.getElementById('pinOpenBagsToggle').checked = pinOpenBagsEnabled;
        document.getElementById('pinOpenBagsBestOnlyToggle').checked = !!pinnedPrefs.pinOpenBagsBestOnly;
        document.getElementById('swapRoasterFarmerToggle').checked = !!pinnedPrefs.swapRoasterFarmer;

        updateBestOnlyToggleState(pinOpenBagsEnabled);

        const pinOpenToggle = document.getElementById('pinOpenBagsToggle');
        if (pinOpenToggle && !pinOpenToggle.dataset.bound) {
            pinOpenToggle.addEventListener('change', () => updateBestOnlyToggleState());
            pinOpenToggle.dataset.bound = 'true';
        }

        document.getElementById('preferencesModal').classList.remove('hidden');
    };

    const savePreferences = async () => {
        const newPrefs = {};
        columnDefs.forEach((col) => {
            const cb = document.getElementById(`pref_${col.id}`);
            newPrefs[col.id] = !!cb?.checked;
        });

        setColumnPreferences(newPrefs);
        saveColumnPreferencesToStorage(newPrefs);

        const pinOpenBagsEnabled = !!document.getElementById('pinOpenBagsToggle')?.checked;
        const pinOpenBagsBestOnlyEnabled =
            pinOpenBagsEnabled && !!document.getElementById('pinOpenBagsBestOnlyToggle')?.checked;

        const currentPrefs = getPinnedBrewsPreferences();
        const pinOpenBagsWasEnabled = !!currentPrefs.pinOpenBags;
        const pinOpenBagsBestOnlyWasEnabled = !!currentPrefs.pinOpenBagsBestOnly;

        const nextPinnedPrefs = {
            ...currentPrefs,
            animationsEnabled: !!document.getElementById('animationsToggle')?.checked,
            organizeByBeans: !!document.getElementById('organizeByBeansToggle')?.checked,
            pinOpenBags: pinOpenBagsEnabled,
            pinOpenBagsBestOnly: pinOpenBagsBestOnlyEnabled,
            swapRoasterFarmer: !!document.getElementById('swapRoasterFarmerToggle')?.checked
        };

        setPinnedBrewsPreferences(nextPinnedPrefs);
        applyAnimationPreference();

        if (pinOpenBagsEnabled && !pinOpenBagsWasEnabled) {
            if (pinOpenBagsBestOnlyEnabled) {
                await pinBestBrewsForAllOpenBags();
                showAutoPinToast('Autopin set to best brews only.');
            } else {
                await pinBrewsFromOpenBags();
                showAutoPinToast('Autopin enabled. All brews of all open bags pinned.');
            }
        } else if (pinOpenBagsEnabled && pinOpenBagsBestOnlyEnabled && !pinOpenBagsBestOnlyWasEnabled) {
            await pinBestBrewsForAllOpenBags();
            showAutoPinToast('Autopin set to best brews only.');
        } else if (pinOpenBagsEnabled && !pinOpenBagsBestOnlyEnabled && pinOpenBagsBestOnlyWasEnabled) {
            await pinBrewsFromOpenBags();
            showAutoPinToast('Autopin enabled. All brews of all open bags pinned.');
        }

        const user = getCurrentUser();
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), { pinnedBrews: nextPinnedPrefs });
            } catch (e) {
                console.error('Error saving pinned prefs', e);
            }
        }

        localStorage.removeItem('animationsEnabled');
        localStorage.removeItem('organizeByBeans');
        localStorage.removeItem('pinOpenBags');

        document.getElementById('preferencesModal').classList.add('hidden');
        renderTable();
        renderPinnedTiles();
    };

    return {
        columnPreferencesKey,
        loadColumnPreferencesFromStorage,
        saveColumnPreferencesToStorage,
        loadLegacyPinnedBrewsPreferences,
        applyAnimationPreference,
        updateBestOnlyToggleState,
        openPreferences,
        savePreferences
    };
};
