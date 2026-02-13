export const DEFAULT_PINNED_BREWS_PREFERENCES = {
    animationsEnabled: true,
    organizeByBeans: true,
    pinOpenBags: false,
    pinOpenBagsBestOnly: false,
    swapRoasterFarmer: false
};

export const createBrewsPreferencesModule = ({
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
        loadLegacyPinnedBrewsPreferences,
        applyAnimationPreference,
        updateBestOnlyToggleState,
        openPreferences,
        savePreferences
    };
};
