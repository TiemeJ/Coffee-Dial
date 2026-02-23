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
    openAppConfirm,
    showAutoPinToast,
    onPinnedBrewsPreferencesChanged,
    onNotificationPreferencesChanged
}) => {
    const { db, doc, updateDoc, deleteDoc, collection, getDocs } = dataService || {};
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

    const updatePushPermissionGuard = (pushEnabled = null) => {
        const guard = document.getElementById('notificationsPermissionGuard');
        const detail = document.getElementById('notificationsPermissionGuardDetail');
        if (!guard) return;

        const enabled = typeof pushEnabled === 'boolean'
            ? pushEnabled
            : !!document.getElementById('notificationsPushEnabledToggle')?.checked;
        const permission = typeof Notification === 'undefined'
            ? 'unsupported'
            : (Notification.permission || 'default');
        const shouldWarn = enabled && (permission === 'default' || permission === 'denied' || permission === 'unsupported');

        if (detail) {
            if (permission === 'denied') {
                detail.textContent = 'Browser permission is blocked. Enable notifications for this site in browser settings.';
            } else if (permission === 'unsupported') {
                detail.textContent = 'This browser does not support web push notifications.';
            } else {
                detail.textContent = 'Allow notifications in your browser prompt to receive push alerts.';
            }
        }

        guard.classList.toggle('hidden', !shouldWarn);
    };

    const isPushEnvironmentSupported = () => {
        if (typeof window === 'undefined') return false;
        if (typeof Notification === 'undefined') return false;
        if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false;
        if (!('PushManager' in window)) return false;
        if (!window.isSecureContext) return false;
        return true;
    };

    const updatePushAvailabilityState = ({ hasRegisteredDevices = false } = {}) => {
        const toggle = document.getElementById('notificationsPushEnabledToggle');
        const row = document.getElementById('notificationsPushEnabledRow');
        if (!toggle) return;

        const supported = isPushEnvironmentSupported();
        const shouldDisable = !supported && !hasRegisteredDevices;
        toggle.disabled = shouldDisable;
        if (row) {
            row.classList.toggle('opacity-50', shouldDisable);
            row.classList.toggle('cursor-not-allowed', shouldDisable);
        }
    };

    const updateRegisterCurrentDeviceButton = ({ show = false, busy = false } = {}) => {
        const button = document.getElementById('notificationsRegisterCurrentDeviceBtn');
        if (!button) return;
        button.classList.toggle('hidden', !show);
        button.disabled = !!busy;
        if (busy) {
            button.textContent = 'Registering...';
            button.classList.add('opacity-60', 'cursor-not-allowed');
        } else {
            button.textContent = 'Register this device for push';
            button.classList.remove('opacity-60', 'cursor-not-allowed');
        }
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
        const listEl = document.getElementById('notificationsRegisteredDevicesList');
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
        updatePushPermissionGuard(!!prefs.pushEnabled);
        updateRegisterCurrentDeviceButton({ show: false, busy: false });
        if (listEl) listEl.textContent = 'Loading...';

        if (!user?.uid) {
            updatePushAvailabilityState({ hasRegisteredDevices: false });
            if (listEl) listEl.textContent = 'Sign in required.';
            return;
        }
        if (!collection || !getDocs) {
            updatePushAvailabilityState({ hasRegisteredDevices: false });
            if (listEl) listEl.textContent = 'Device query unavailable in current build.';
            return;
        }

        try {
            const snap = await getDocs(collection(db, 'users', user.uid, 'devices'));
            const rows = snap.docs.map((item) => ({ id: item.id, ...(item.data() || {}) }));
            updatePushAvailabilityState({ hasRegisteredDevices: rows.length > 0 });
            setDebugText('notificationsDebugDeviceCount', rows.length);
            const current = rows.find((entry) => entry.id === currentDeviceId) || null;
            const showRegisterCurrentDeviceButton = !!prefs?.pushEnabled &&
                isPushEnvironmentSupported() &&
                !!currentDeviceId &&
                !current;
            updateRegisterCurrentDeviceButton({ show: showRegisterCurrentDeviceButton, busy: false });
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
                    row.className = 'flex items-center justify-between gap-2 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#292524] px-2 py-1.5';
                    const meta = document.createElement('div');
                    meta.className = 'min-w-0 text-[10px] font-mono text-coffee-700 dark:text-[#d6ccc2]';
                    meta.textContent = `${entry.id}${marker} | enabled=${entry.enabled ? '1' : '0'} | token=${shortenToken(entry.token)} | updated=${entry.updatedAt || '-'}`;
                    row.appendChild(meta);
                    if (typeof deleteDoc === 'function') {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.type = 'button';
                        deleteBtn.className = 'shrink-0 px-2 py-1 rounded border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 text-[10px] font-semibold';
                        deleteBtn.textContent = 'Delete';
                        deleteBtn.setAttribute('data-device-delete-id', entry.id);
                        deleteBtn.addEventListener('click', async (clickEvent) => {
                            clickEvent.preventDefault();
                            clickEvent.stopPropagation();
                            await deleteRegisteredDevice(entry.id);
                        });
                        row.appendChild(deleteBtn);
                    }
                    listEl.appendChild(row);
                });
        } catch (error) {
            updatePushAvailabilityState({ hasRegisteredDevices: false });
            if (listEl) listEl.textContent = `Failed loading devices: ${error?.message || error}`;
        }
    };

    const deleteRegisteredDevice = async (deviceId) => {
        const normalizedDeviceId = (deviceId || '').toString().trim();
        if (!normalizedDeviceId) return;
        if (typeof deleteDoc !== 'function') {
            alert('Delete device is not available in this build.');
            return;
        }
        const shouldDelete = typeof openAppConfirm === 'function'
            ? await openAppConfirm({
                title: 'Delete device registration?',
                message: 'This will remove push registration for this device.',
                confirmLabel: 'Delete',
                cancelLabel: 'Cancel',
                danger: true
            })
            : confirm('Delete this device registration?');
        if (!shouldDelete) return;
        const user = getCurrentUser?.();
        if (!user?.uid) return;

        try {
            await deleteDoc(doc(db, 'users', user.uid, 'devices', normalizedDeviceId));
            let hasRegisteredDevices = true;
            if (collection && getDocs) {
                const remainingSnap = await getDocs(collection(db, 'users', user.uid, 'devices'));
                hasRegisteredDevices = remainingSnap.docs.length > 0;
            }
            if (!hasRegisteredDevices) {
                const nextNotificationPrefs = normalizeNotificationPreferences({
                    ...getNotificationPreferences?.(),
                    pushEnabled: false
                });
                setNotificationPreferences?.(nextNotificationPrefs);
                const pushToggle = document.getElementById('notificationsPushEnabledToggle');
                if (pushToggle) pushToggle.checked = false;
                updateNotificationToggleState(false);
                updatePushPermissionGuard(false);
                updatePushAvailabilityState({ hasRegisteredDevices: false });
                try {
                    await updateDoc(doc(db, 'users', user.uid), {
                        notificationPrefs: nextNotificationPrefs
                    });
                } catch (persistError) {
                    console.error('Failed persisting notification preferences after device delete:', persistError);
                }
                try {
                    await onNotificationPreferencesChanged?.(nextNotificationPrefs);
                } catch (applyError) {
                    console.error('Failed applying notification preferences after device delete:', applyError);
                }
            }
            await renderNotificationsDebugPanel();
        } catch (error) {
            alert(`Failed deleting device: ${error?.message || error}`);
        }
    };

    const bindNotificationsDebug = () => {
        if (hasBoundNotificationsDebug) return;
        hasBoundNotificationsDebug = true;
        const refreshBtn = document.getElementById('notificationsDebugRefreshBtn');
        const registerCurrentDeviceBtn = document.getElementById('notificationsRegisterCurrentDeviceBtn');
        refreshBtn?.addEventListener('click', () => {
            renderNotificationsDebugPanel();
            updatePushPermissionGuard();
        });
        registerCurrentDeviceBtn?.addEventListener('click', async () => {
            updateRegisterCurrentDeviceButton({ show: true, busy: true });
            try {
                await onNotificationPreferencesChanged?.(normalizeNotificationPreferences(getNotificationPreferences?.()));
            } catch (error) {
                alert(`Failed registering current device: ${error?.message || error}`);
            } finally {
                await renderNotificationsDebugPanel();
            }
        });
        window.addEventListener('focus', () => updatePushPermissionGuard());
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) updatePushPermissionGuard();
        });
        document.addEventListener('click', async (event) => {
            const target = event.target instanceof Element
                ? event.target.closest('#notificationsRegisteredDevicesList [data-device-delete-id]')
                : null;
            if (!target) return;
            event.preventDefault();
            event.stopPropagation();
            const deviceId = (target.getAttribute('data-device-delete-id') || '').trim();
            if (!deviceId) return;
            await deleteRegisteredDevice(deviceId);
        }, true);
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
                if (id === 'notificationsPushEnabledToggle') {
                    updateNotificationToggleState();
                    updatePushPermissionGuard();
                }
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
        updatePushPermissionGuard(!!notificationPrefs.pushEnabled);

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
