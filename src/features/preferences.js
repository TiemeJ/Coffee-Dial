export const DEFAULT_PINNED_BREWS_PREFERENCES = {
    useLegacyBrewForm: true,
    useLegacyMobileTable: true,
    showCoffeeImageInBrewCard: false,
    animationsEnabled: true,
    organizeByBeans: true,
    coffeeArtEnabled: false,
    pinOpenBags: false,
    pinOpenBagsBestOnly: false,
    pinBestPerMethodDrink: true,
    swapRoasterFarmer: false
};

export const createBrewsPreferencesModule = ({
    getPinnedBrewsPreferences,
    setPinnedBrewsPreferences,
    getCurrentUser,
    dataService,
    applyAnimationClass,
    renderTable,
    renderPinnedTiles,
    dispatchCommand,
    showAutoPinToast,
    onPinnedBrewsPreferencesChanged
}) => {
    const { db, doc, updateDoc } = dataService || {};
    if (!db || !doc || !updateDoc) {
        throw new Error('createBrewsPreferencesModule requires dataService { db, doc, updateDoc }');
    }
    const PREF_TOGGLE_IDS = [
        'useLegacyBrewFormToggle',
        'useLegacyMobileTableToggle',
        'showCoffeeImageInBrewCardToggle',
        'animationsToggle',
        'organizeByBeansToggle',
        'coffeeArtToggle',
        'pinOpenBagsToggle',
        'pinOpenBagsBestOnlyToggle',
        'pinBestPerMethodDrinkToggle',
        'swapRoasterFarmerToggle'
    ];
    let isHydratingPreferences = false;
    let hasBoundAutoSave = false;
    let autoSaveTimer = null;
    let saveQueue = Promise.resolve();

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

    const updateBestPerMethodDrinkToggleState = (bestOnlyEnabled = null) => {
        const row = document.getElementById('pinBestPerMethodDrinkRow');
        const toggle = document.getElementById('pinBestPerMethodDrinkToggle');
        if (!row || !toggle) return;

        const enabled =
            typeof bestOnlyEnabled === 'boolean'
                ? bestOnlyEnabled
                : !!document.getElementById('pinOpenBagsBestOnlyToggle')?.checked;

        toggle.disabled = !enabled;
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
            useLegacyMobileTable: !!document.getElementById('useLegacyMobileTableToggle')?.checked,
            showCoffeeImageInBrewCard: !!document.getElementById('showCoffeeImageInBrewCardToggle')?.checked,
            animationsEnabled: !!document.getElementById('animationsToggle')?.checked,
            organizeByBeans: organizeByBeansEnabled,
            coffeeArtEnabled: organizeByBeansEnabled && !!document.getElementById('coffeeArtToggle')?.checked,
            pinOpenBags: pinOpenBagsEnabled,
            pinOpenBagsBestOnly: pinOpenBagsBestOnlyEnabled,
            pinBestPerMethodDrink: !!document.getElementById('pinBestPerMethodDrinkToggle')?.checked,
            swapRoasterFarmer: !!document.getElementById('swapRoasterFarmerToggle')?.checked
        };
    };

    const persistPinnedBrewsPreferences = async (nextPinnedPrefs) => {
        const currentPrefs = getPinnedBrewsPreferences();
        const pinOpenBagsEnabled = !!nextPinnedPrefs.pinOpenBags;
        const pinOpenBagsBestOnlyEnabled = !!nextPinnedPrefs.pinOpenBagsBestOnly;
        const pinOpenBagsWasEnabled = !!currentPrefs.pinOpenBags;
        const pinOpenBagsBestOnlyWasEnabled = !!currentPrefs.pinOpenBagsBestOnly;
        const pinBestPerMethodDrinkEnabled = nextPinnedPrefs.pinBestPerMethodDrink !== false;
        const pinBestPerMethodDrinkWasEnabled = currentPrefs.pinBestPerMethodDrink !== false;
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
                await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
                showAutoPinToast('Autopin set to best brews only.');
            } else {
                await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
                showAutoPinToast('Autopin enabled. All brews of all open bags pinned.');
            }
        } else if (pinOpenBagsEnabled && pinOpenBagsBestOnlyEnabled && !pinOpenBagsBestOnlyWasEnabled) {
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
            showAutoPinToast('Autopin set to best brews only.');
        } else if (
            pinOpenBagsEnabled &&
            pinOpenBagsBestOnlyEnabled &&
            pinBestPerMethodDrinkEnabled !== pinBestPerMethodDrinkWasEnabled
        ) {
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
            showAutoPinToast('Autopin best-brew grouping updated.');
        } else if (pinOpenBagsEnabled && !pinOpenBagsBestOnlyEnabled && pinOpenBagsBestOnlyWasEnabled) {
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
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
                if (id === 'pinOpenBagsToggle') {
                    updateBestOnlyToggleState();
                    updateBestPerMethodDrinkToggleState();
                }
                if (id === 'pinOpenBagsBestOnlyToggle') updateBestPerMethodDrinkToggleState();
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
        document.getElementById('useLegacyMobileTableToggle').checked = pinnedPrefs.useLegacyMobileTable !== false;
        document.getElementById('showCoffeeImageInBrewCardToggle').checked = !!pinnedPrefs.showCoffeeImageInBrewCard;
        document.getElementById('organizeByBeansToggle').checked = !!pinnedPrefs.organizeByBeans;
        document.getElementById('coffeeArtToggle').checked = !!pinnedPrefs.organizeByBeans && !!pinnedPrefs.coffeeArtEnabled;
        document.getElementById('pinOpenBagsToggle').checked = pinOpenBagsEnabled;
        document.getElementById('pinOpenBagsBestOnlyToggle').checked = !!pinnedPrefs.pinOpenBagsBestOnly;
        document.getElementById('pinBestPerMethodDrinkToggle').checked = pinnedPrefs.pinBestPerMethodDrink !== false;
        document.getElementById('swapRoasterFarmerToggle').checked = !!pinnedPrefs.swapRoasterFarmer;

        updateBestOnlyToggleState(pinOpenBagsEnabled);
        updateBestPerMethodDrinkToggleState(!!pinnedPrefs.pinOpenBagsBestOnly);
        updateCoffeeArtToggleState(!!pinnedPrefs.organizeByBeans);
        bindPreferencesAutoSave();
        isHydratingPreferences = false;

        document.getElementById('preferencesModal').classList.remove('hidden');
    };

    return {
        applyAnimationPreference,
        updateBestOnlyToggleState,
        updateBestPerMethodDrinkToggleState,
        updateCoffeeArtToggleState,
        openPreferences
    };
};
