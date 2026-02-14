export const DEFAULT_PINNED_BREWS_PREFERENCES = {
    useLegacyBrewForm: true,
    animationsEnabled: true,
    organizeByBeans: true,
    coffeeArtEnabled: false,
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
    showAutoPinToast,
    onPinnedBrewsPreferencesChanged
}) => {
    const PREF_TOGGLE_IDS = [
        'useLegacyBrewFormToggle',
        'animationsToggle',
        'organizeByBeansToggle',
        'coffeeArtToggle',
        'pinOpenBagsToggle',
        'pinOpenBagsBestOnlyToggle',
        'swapRoasterFarmerToggle'
    ];
    let isHydratingPreferences = false;
    let hasBoundAutoSave = false;
    let autoSaveTimer = null;
    let saveQueue = Promise.resolve();

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

    const updateCoffeeArtToggleState = (organizeByBeansEnabled = null) => {
        const row = document.getElementById('coffeeArtRow');
        const toggle = document.getElementById('coffeeArtToggle');
        if (!row || !toggle) return;

        const enabled =
            typeof organizeByBeansEnabled === 'boolean'
                ? organizeByBeansEnabled
                : !!document.getElementById('organizeByBeansToggle')?.checked;

        toggle.disabled = !enabled;
        if (!enabled) toggle.checked = false;
        row.classList.toggle('opacity-50', !enabled);
        row.classList.toggle('cursor-not-allowed', !enabled);
    };

    const collectPinnedBrewsPreferencesFromForm = () => {
        const organizeByBeansEnabled = !!document.getElementById('organizeByBeansToggle')?.checked;
        const pinOpenBagsEnabled = !!document.getElementById('pinOpenBagsToggle')?.checked;
        const pinOpenBagsBestOnlyEnabled =
            pinOpenBagsEnabled && !!document.getElementById('pinOpenBagsBestOnlyToggle')?.checked;
        return {
            ...getPinnedBrewsPreferences(),
            useLegacyBrewForm: !!document.getElementById('useLegacyBrewFormToggle')?.checked,
            animationsEnabled: !!document.getElementById('animationsToggle')?.checked,
            organizeByBeans: organizeByBeansEnabled,
            coffeeArtEnabled: organizeByBeansEnabled && !!document.getElementById('coffeeArtToggle')?.checked,
            pinOpenBags: pinOpenBagsEnabled,
            pinOpenBagsBestOnly: pinOpenBagsBestOnlyEnabled,
            swapRoasterFarmer: !!document.getElementById('swapRoasterFarmerToggle')?.checked
        };
    };

    const persistPinnedBrewsPreferences = async (nextPinnedPrefs) => {
        const currentPrefs = getPinnedBrewsPreferences();
        const pinOpenBagsEnabled = !!nextPinnedPrefs.pinOpenBags;
        const pinOpenBagsBestOnlyEnabled = !!nextPinnedPrefs.pinOpenBagsBestOnly;
        const pinOpenBagsWasEnabled = !!currentPrefs.pinOpenBags;
        const pinOpenBagsBestOnlyWasEnabled = !!currentPrefs.pinOpenBagsBestOnly;
        const organizeByBeansEnabled = !!nextPinnedPrefs.organizeByBeans;

        if (!organizeByBeansEnabled) {
            nextPinnedPrefs = {
                ...nextPinnedPrefs,
                coffeeArtEnabled: false
            };
        }

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

        renderTable();
        renderPinnedTiles();
        onPinnedBrewsPreferencesChanged?.(nextPinnedPrefs);

    };

    const enqueuePinnedBrewsPreferencesSave = (nextPinnedPrefs) => {
        saveQueue = saveQueue
            .then(() => persistPinnedBrewsPreferences(nextPinnedPrefs))
            .catch((err) => {
                console.error('Failed to persist preferences', err);
            });
        return saveQueue;
    };

    const scheduleAutoSavePreferences = () => {
        clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            const nextPinnedPrefs = collectPinnedBrewsPreferencesFromForm();
            enqueuePinnedBrewsPreferencesSave(nextPinnedPrefs);
        }, 120);
    };

    const bindPreferencesAutoSave = () => {
        if (hasBoundAutoSave) return;
        hasBoundAutoSave = true;
        PREF_TOGGLE_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('change', () => {
                if (isHydratingPreferences) return;
                if (id === 'pinOpenBagsToggle') updateBestOnlyToggleState();
                if (id === 'organizeByBeansToggle') updateCoffeeArtToggleState();
                scheduleAutoSavePreferences();
            });
        });
    };

    const openPreferences = () => {
        const pinnedPrefs = getPinnedBrewsPreferences();
        const pinOpenBagsEnabled = !!pinnedPrefs.pinOpenBags;

        isHydratingPreferences = true;
        document.getElementById('animationsToggle').checked = !!pinnedPrefs.animationsEnabled;
        document.getElementById('useLegacyBrewFormToggle').checked = pinnedPrefs.useLegacyBrewForm !== false;
        document.getElementById('organizeByBeansToggle').checked = !!pinnedPrefs.organizeByBeans;
        document.getElementById('coffeeArtToggle').checked = !!pinnedPrefs.organizeByBeans && !!pinnedPrefs.coffeeArtEnabled;
        document.getElementById('pinOpenBagsToggle').checked = pinOpenBagsEnabled;
        document.getElementById('pinOpenBagsBestOnlyToggle').checked = !!pinnedPrefs.pinOpenBagsBestOnly;
        document.getElementById('swapRoasterFarmerToggle').checked = !!pinnedPrefs.swapRoasterFarmer;

        updateBestOnlyToggleState(pinOpenBagsEnabled);
        updateCoffeeArtToggleState(!!pinnedPrefs.organizeByBeans);
        bindPreferencesAutoSave();
        isHydratingPreferences = false;

        document.getElementById('preferencesModal').classList.remove('hidden');
    };

    return {
        loadLegacyPinnedBrewsPreferences,
        applyAnimationPreference,
        updateBestOnlyToggleState,
        updateCoffeeArtToggleState,
        openPreferences
    };
};
