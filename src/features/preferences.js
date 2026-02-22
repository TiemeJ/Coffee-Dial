export const DEFAULT_PINNED_BREWS_PREFERENCES = {
    useLegacyMobileTable: true,
    hideCoffeeImageInBrewCard: false,
    animationsEnabled: true,
    showTilesInsteadOfCoffeeArt: false,
    pinBestPerMethodDrink: true
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
        'useLegacyMobileTableToggle',
        'hideCoffeeImageInBrewCardToggle',
        'animationsToggle',
        'showTilesInsteadOfCoffeeArtToggle',
        'pinBestPerMethodDrinkToggle'
    ];
    let isHydratingPreferences = false;
    let hasBoundAutoSave = false;
    let autoSaveTimer = null;
    let saveQueue = Promise.resolve();

    const applyAnimationPreference = () => {
        applyAnimationClass(!!getPinnedBrewsPreferences().animationsEnabled);
    };

    const updateAnimationsToggleState = (showTilesInsteadOfCoffeeArt = null) => {
        const row = document.getElementById('animationsRow');
        const toggle = document.getElementById('animationsToggle');
        if (!toggle) return;

        const shouldShowTiles =
            typeof showTilesInsteadOfCoffeeArt === 'boolean'
                ? showTilesInsteadOfCoffeeArt
                : !!document.getElementById('showTilesInsteadOfCoffeeArtToggle')?.checked;
        const isCoffeeArtEnabled = !shouldShowTiles;

        toggle.disabled = isCoffeeArtEnabled;
        if (isCoffeeArtEnabled) toggle.checked = false;
        if (row) {
            row.classList.toggle('opacity-50', isCoffeeArtEnabled);
            row.classList.toggle('cursor-not-allowed', isCoffeeArtEnabled);
        }
    };

    const collectPinnedBrewsPreferencesFromForm = () => {
        const showTilesInsteadOfCoffeeArt = !!document.getElementById('showTilesInsteadOfCoffeeArtToggle')?.checked;
        return {
            ...getPinnedBrewsPreferences(),
            useLegacyMobileTable: !!document.getElementById('useLegacyMobileTableToggle')?.checked,
            hideCoffeeImageInBrewCard: !!document.getElementById('hideCoffeeImageInBrewCardToggle')?.checked,
            animationsEnabled: showTilesInsteadOfCoffeeArt ? !!document.getElementById('animationsToggle')?.checked : false,
            showTilesInsteadOfCoffeeArt,
            pinOpenBags: true,
            pinOpenBagsBestOnly: true,
            pinBestPerMethodDrink: !!document.getElementById('pinBestPerMethodDrinkToggle')?.checked
        };
    };

    const persistPinnedBrewsPreferences = async (nextPinnedPrefs) => {
        const currentPrefs = getPinnedBrewsPreferences();
        const pinBestPerMethodDrinkEnabled = nextPinnedPrefs.pinBestPerMethodDrink !== false;
        const pinBestPerMethodDrinkWasEnabled = currentPrefs.pinBestPerMethodDrink !== false;
        nextPinnedPrefs = {
            ...nextPinnedPrefs,
            pinOpenBags: true,
            pinOpenBagsBestOnly: true,
            showTilesInsteadOfCoffeeArt: !!nextPinnedPrefs.showTilesInsteadOfCoffeeArt,
            animationsEnabled: !!nextPinnedPrefs.showTilesInsteadOfCoffeeArt
                ? !!nextPinnedPrefs.animationsEnabled
                : false
        };
        setPinnedBrewsPreferences(nextPinnedPrefs);
        applyAnimationPreference();

        if (pinBestPerMethodDrinkEnabled !== pinBestPerMethodDrinkWasEnabled) {
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
            showAutoPinToast('Autopin best-brew grouping updated.');
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
                if (id === 'showTilesInsteadOfCoffeeArtToggle') updateAnimationsToggleState();
                scheduleAutoSavePreferences();
            });
        });
    };

    const openPreferences = () => {
        const pinnedPrefs = getPinnedBrewsPreferences();

        isHydratingPreferences = true;
        document.getElementById('animationsToggle').checked = !!pinnedPrefs.animationsEnabled;
        document.getElementById('useLegacyMobileTableToggle').checked = pinnedPrefs.useLegacyMobileTable !== false;
        document.getElementById('hideCoffeeImageInBrewCardToggle').checked = !!pinnedPrefs.hideCoffeeImageInBrewCard;
        document.getElementById('showTilesInsteadOfCoffeeArtToggle').checked = !!pinnedPrefs.showTilesInsteadOfCoffeeArt;
        document.getElementById('pinBestPerMethodDrinkToggle').checked = pinnedPrefs.pinBestPerMethodDrink !== false;
        updateAnimationsToggleState(!!pinnedPrefs.showTilesInsteadOfCoffeeArt);

        bindPreferencesAutoSave();
        isHydratingPreferences = false;

        document.getElementById('preferencesModal').classList.remove('hidden');
    };

    return {
        applyAnimationPreference,
        openPreferences
    };
};
