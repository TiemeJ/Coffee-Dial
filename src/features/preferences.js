const normalizeNotificationPreferences = (value = null) => {
    const source = (value && typeof value === 'object') ? value : {};
    return {
        pushEnabled: !!source.pushEnabled,
        friendMoments: source.friendMoments !== false,
        commentsOnMyMoments: source.commentsOnMyMoments !== false,
        commentsOnFollowedOrCommentedMoments: source.commentsOnFollowedOrCommentedMoments !== false
    };
};

const PUSH_DEVICE_ID_STORAGE_KEY = 'coffeeDialPushDeviceId:v1';
const readPushDeviceId = () => {
    try {
        return localStorage.getItem(PUSH_DEVICE_ID_STORAGE_KEY) || '';
    } catch (_) {
        return '';
    }
};

export const DEFAULT_PINNED_BREWS_PREFERENCES = {
    useLegacyMobileTable: false,
    hideCoffeeImageInBrewCard: false,
    animationsEnabled: true,
    showTilesInsteadOfCoffeeArt: false,
    pinBestPerMethodDrink: true
};

export const createBrewsPreferencesModule = ({
    getPinnedBrewsPreferences,
    setPinnedBrewsPreferences,
    getNotificationPreferences,
    setNotificationPreferences,
    getCurrentUser,
    dataService,
    applyAnimationClass,
    renderTable,
    renderPinnedTiles,
    dispatchCommand,
    showAutoPinToast,
    onPinnedBrewsPreferencesChanged,
    onNotificationPreferencesChanged
}) => {
    const { db, doc, updateDoc, collection, getDocs } = dataService || {};
    if (!db || !doc || !updateDoc) {
        throw new Error('createBrewsPreferencesModule requires dataService { db, doc, updateDoc }');
    }
    const PREF_TOGGLE_IDS = [
        'useLegacyMobileTableToggle',
        'hideCoffeeImageInBrewCardToggle',
        'animationsToggle',
        'showTilesInsteadOfCoffeeArtToggle',
        'pinBestPerMethodDrinkToggle',
        'notificationsPushEnabledToggle',
        'notificationsFriendMomentsToggle',
        'notificationsCommentsMyToggle',
        'notificationsCommentsFollowingToggle'
    ];
    let isHydratingPreferences = false;
    let hasBoundAutoSave = false;
    let hasBoundNotificationsDebug = false;
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
        const notificationPrefs = normalizeNotificationPreferences({
            pushEnabled: !!document.getElementById('notificationsPushEnabledToggle')?.checked,
            friendMoments: !!document.getElementById('notificationsFriendMomentsToggle')?.checked,
            commentsOnMyMoments: !!document.getElementById('notificationsCommentsMyToggle')?.checked,
            commentsOnFollowedOrCommentedMoments: !!document.getElementById('notificationsCommentsFollowingToggle')?.checked
        });
        return {
            pinned: {
                ...getPinnedBrewsPreferences(),
                useLegacyMobileTable: !!document.getElementById('useLegacyMobileTableToggle')?.checked,
                hideCoffeeImageInBrewCard: !!document.getElementById('hideCoffeeImageInBrewCardToggle')?.checked,
                animationsEnabled: showTilesInsteadOfCoffeeArt ? !!document.getElementById('animationsToggle')?.checked : false,
                showTilesInsteadOfCoffeeArt,
                pinOpenBags: true,
                pinOpenBagsBestOnly: true,
                pinBestPerMethodDrink: !!document.getElementById('pinBestPerMethodDrinkToggle')?.checked
            },
            notificationPrefs
        };
    };

    const updateNotificationToggleState = (pushEnabled = null) => {
        const enabled = typeof pushEnabled === 'boolean'
            ? pushEnabled
            : !!document.getElementById('notificationsPushEnabledToggle')?.checked;
        ['notificationsFriendMomentsToggle', 'notificationsCommentsMyToggle', 'notificationsCommentsFollowingToggle'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.disabled = !enabled;
        });
        ['notificationsFriendMomentsRow', 'notificationsCommentsMyRow', 'notificationsCommentsFollowingRow'].forEach((id) => {
            const row = document.getElementById(id);
            if (!row) return;
            row.classList.toggle('opacity-50', !enabled);
            row.classList.toggle('cursor-not-allowed', !enabled);
        });
    };

    const setDebugText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${value ?? '-'}`;
    };

    const shortenToken = (value) => {
        const token = (value || '').toString().trim();
        if (!token) return '-';
        if (token.length <= 20) return token;
        return `${token.slice(0, 10)}...${token.slice(-8)}`;
    };

    const renderNotificationsDebugPanel = async () => {
        const listEl = document.getElementById('notificationsDebugDevicesList');
        const user = getCurrentUser?.();
        const prefs = normalizeNotificationPreferences(getNotificationPreferences?.());
        const permission = typeof Notification === 'undefined' ? 'unsupported' : (Notification.permission || 'default');
        const currentDeviceId = readPushDeviceId();

        setDebugText('notificationsDebugPermission', permission);
        setDebugText('notificationsDebugPushEnabled', prefs.pushEnabled ? 'true' : 'false');
        setDebugText('notificationsDebugDeviceId', currentDeviceId || '-');
        setDebugText('notificationsDebugDeviceCount', '-');
        setDebugText('notificationsDebugCurrentToken', '-');
        setDebugText('notificationsDebugCurrentUpdatedAt', '-');
        if (listEl) listEl.textContent = 'Loading...';

        if (!user?.uid) {
            if (listEl) listEl.textContent = 'Sign in required.';
            return;
        }
        if (!collection || !getDocs) {
            if (listEl) listEl.textContent = 'Device query unavailable in current build.';
            return;
        }

        try {
            const snap = await getDocs(collection(db, 'users', user.uid, 'devices'));
            const rows = snap.docs.map((item) => ({ id: item.id, ...(item.data() || {}) }));
            setDebugText('notificationsDebugDeviceCount', rows.length);
            const current = rows.find((entry) => entry.id === currentDeviceId) || null;
            setDebugText('notificationsDebugCurrentToken', shortenToken(current?.token || ''));
            setDebugText('notificationsDebugCurrentUpdatedAt', current?.updatedAt || '-');

            if (!listEl) return;
            listEl.innerHTML = '';
            if (!rows.length) {
                listEl.textContent = 'No device docs found.';
                return;
            }
            rows
                .sort((a, b) => `${b.updatedAt || ''}`.localeCompare(`${a.updatedAt || ''}`))
                .forEach((entry) => {
                    const row = document.createElement('div');
                    const marker = entry.id === currentDeviceId ? ' (current)' : '';
                    row.className = 'font-mono';
                    row.textContent = `${entry.id}${marker} | enabled=${entry.enabled ? '1' : '0'} | token=${shortenToken(entry.token)} | updated=${entry.updatedAt || '-'}`;
                    listEl.appendChild(row);
                });
        } catch (error) {
            if (listEl) listEl.textContent = `Failed loading devices: ${error?.message || error}`;
        }
    };

    const bindNotificationsDebug = () => {
        if (hasBoundNotificationsDebug) return;
        hasBoundNotificationsDebug = true;
        const refreshBtn = document.getElementById('notificationsDebugRefreshBtn');
        refreshBtn?.addEventListener('click', () => {
            renderNotificationsDebugPanel();
        });
    };

    const persistPinnedBrewsPreferences = async (nextState) => {
        let nextPinnedPrefs = { ...(nextState?.pinned || {}) };
        const nextNotificationPrefs = normalizeNotificationPreferences(nextState?.notificationPrefs || getNotificationPreferences?.());
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
        setNotificationPreferences?.(nextNotificationPrefs);
        applyAnimationPreference();

        if (pinBestPerMethodDrinkEnabled !== pinBestPerMethodDrinkWasEnabled) {
            await dispatchCommand?.('pin.autoPinOpenBagsIfEnabled', {});
            showAutoPinToast('Autopin best-brew grouping updated.');
        }

        const user = getCurrentUser();
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), {
                    pinnedBrews: nextPinnedPrefs,
                    notificationPrefs: nextNotificationPrefs
                });
            } catch (e) {
                console.error('Error saving pinned prefs', e);
            }
        }
        renderTable();
        renderPinnedTiles();
        onPinnedBrewsPreferencesChanged?.(nextPinnedPrefs);
        onNotificationPreferencesChanged?.(nextNotificationPrefs);
        renderNotificationsDebugPanel();

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
                if (id === 'notificationsPushEnabledToggle') updateNotificationToggleState();
                scheduleAutoSavePreferences();
            });
        });
    };

    const openPreferences = () => {
        const pinnedPrefs = getPinnedBrewsPreferences();

        isHydratingPreferences = true;
        document.getElementById('animationsToggle').checked = !!pinnedPrefs.animationsEnabled;
        document.getElementById('useLegacyMobileTableToggle').checked = !!pinnedPrefs.useLegacyMobileTable;
        document.getElementById('hideCoffeeImageInBrewCardToggle').checked = !!pinnedPrefs.hideCoffeeImageInBrewCard;
        document.getElementById('showTilesInsteadOfCoffeeArtToggle').checked = !!pinnedPrefs.showTilesInsteadOfCoffeeArt;
        document.getElementById('pinBestPerMethodDrinkToggle').checked = pinnedPrefs.pinBestPerMethodDrink !== false;
        const notificationPrefs = normalizeNotificationPreferences(getNotificationPreferences?.());
        document.getElementById('notificationsPushEnabledToggle').checked = !!notificationPrefs.pushEnabled;
        document.getElementById('notificationsFriendMomentsToggle').checked = !!notificationPrefs.friendMoments;
        document.getElementById('notificationsCommentsMyToggle').checked = !!notificationPrefs.commentsOnMyMoments;
        document.getElementById('notificationsCommentsFollowingToggle').checked = !!notificationPrefs.commentsOnFollowedOrCommentedMoments;
        updateAnimationsToggleState(!!pinnedPrefs.showTilesInsteadOfCoffeeArt);
        updateNotificationToggleState(!!notificationPrefs.pushEnabled);

        bindPreferencesAutoSave();
        bindNotificationsDebug();
        renderNotificationsDebugPanel();
        isHydratingPreferences = false;

        document.getElementById('preferencesModal').classList.remove('hidden');
    };

    return {
        applyAnimationPreference,
        openPreferences
    };
};
