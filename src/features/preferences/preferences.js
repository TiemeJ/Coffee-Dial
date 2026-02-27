import { normalizeIntegrationPreferences } from '../../core/integration-preferences.js';

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
    pinBestPerMethodDrink: true,
    keepCuppingNotesWhenRepeatingBrew: false
};

export const createBrewsPreferencesModule = ({
    getPinnedBrewsPreferences,
    setPinnedBrewsPreferences,
    getNotificationPreferences,
    setNotificationPreferences,
    getIntegrationPreferences,
    setIntegrationPreferences,
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
        'keepCuppingNotesWhenRepeatingBrewToggle',
        'notificationsPushEnabledToggle',
        'notificationsFriendMomentsToggle',
        'notificationsCommentsMyToggle',
        'notificationsCommentsFollowingToggle',
        'integrationsRemoveBgEnabledToggle'
    ];
    const PREF_INPUT_IDS = ['integrationsRemoveBgApiKey'];
    let isHydratingPreferences = false;
    let hasBoundAutoSave = false;
    let hasBoundNotificationsDebug = false;
    let hasBoundReloadButton = false;
    let reloadInProgress = false;
    let autoSaveTimer = null;
    let saveQueue = Promise.resolve();
    let isCurrentDevicePushRegistered = false;

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
        const integrationPrefs = normalizeIntegrationPreferences({
            ...getIntegrationPreferences?.(),
            removeBg: {
                enabled: !!document.getElementById('integrationsRemoveBgEnabledToggle')?.checked,
                apiKey: document.getElementById('integrationsRemoveBgApiKey')?.value || ''
            }
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
                pinBestPerMethodDrink: !!document.getElementById('pinBestPerMethodDrinkToggle')?.checked,
                keepCuppingNotesWhenRepeatingBrew: !!document.getElementById('keepCuppingNotesWhenRepeatingBrewToggle')?.checked
            },
            notificationPrefs,
            integrationPrefs
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

    const updatePushPermissionGuard = (pushEnabled = null, { currentDeviceRegistered = null } = {}) => {
        const guard = document.getElementById('notificationsPermissionGuard');
        const detail = document.getElementById('notificationsPermissionGuardDetail');
        if (!guard) return;

        if (typeof currentDeviceRegistered === 'boolean') {
            isCurrentDevicePushRegistered = currentDeviceRegistered;
        }

        const enabled = typeof pushEnabled === 'boolean'
            ? pushEnabled
            : !!document.getElementById('notificationsPushEnabledToggle')?.checked;
        const permission = typeof Notification === 'undefined'
            ? 'unsupported'
            : (Notification.permission || 'default');
        const shouldWarn = enabled &&
            isCurrentDevicePushRegistered &&
            (permission === 'default' || permission === 'denied' || permission === 'unsupported');

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

    const setText = (id, value) => {
        const el = document.getElementById(id);
        if (el) el.textContent = `${value ?? '-'}`;
    };

    const parseSwVersionFromScriptUrl = (scriptUrl) => {
        if (!scriptUrl || typeof scriptUrl !== 'string') return '-';
        try {
            const url = new URL(scriptUrl, window.location.origin);
            const version = url.searchParams.get('v');
            return version || '-';
        } catch (_) {
            return '-';
        }
    };

    const renderBuildAndVersionInfo = async () => {
        const info = (typeof window !== 'undefined' && window.__coffeeDialBuildInfo && typeof window.__coffeeDialBuildInfo === 'object')
            ? window.__coffeeDialBuildInfo
            : {};
        const buildStamp = `${info.buildStamp || '-'}`;
        setText('preferencesBuildInfo', `Build: ${buildStamp}`);

        let configuredVersion = '-';
        let activeVersion = '-';
        let waitingVersion = '-';
        try {
            if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
                const registration = await navigator.serviceWorker.getRegistration().catch(() => null);
                configuredVersion = parseSwVersionFromScriptUrl(registration?.active?.scriptURL || registration?.waiting?.scriptURL || registration?.installing?.scriptURL || '');
                activeVersion = parseSwVersionFromScriptUrl(registration?.active?.scriptURL || '');
                waitingVersion = parseSwVersionFromScriptUrl(registration?.waiting?.scriptURL || '');
            }
        } catch (_) {}
        setText(
            'preferencesRuntimeSwInfo',
            `pwa.js/sw.js: cfg=${configuredVersion} | active=${activeVersion} | waiting=${waitingVersion}`
        );
    };

    const shortenToken = (value) => {
        const token = (value || '').toString().trim();
        if (!token) return '-';
        if (token.length <= 20) return token;
        return `${token.slice(0, 10)}...${token.slice(-8)}`;
    };

    const escapeHtml = (value) => `${value ?? ''}`
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

    const formatPushType = (entry = {}) => {
        const channel = `${entry?.pushChannel || ''}`.trim().toLowerCase();
        const hasSubscription = !!(entry?.webPushSubscription && typeof entry.webPushSubscription === 'object');
        const hasToken = !!(`${entry?.token || ''}`.trim());
        if (channel === 'declarative-web-push' || hasSubscription) return 'DWP';
        if (channel === 'fcm' || hasToken) return 'FCM';
        return '-';
    };

    const getDeclarativeDebugDetails = (entry = {}) => {
        const sub = entry?.webPushSubscription && typeof entry.webPushSubscription === 'object'
            ? entry.webPushSubscription
            : null;
        if (!sub) {
            return { host: '-', keys: '-', expiration: '-' };
        }
        let host = '-';
        try {
            host = sub.endpoint ? (new URL(sub.endpoint).host || '-') : '-';
        } catch (_) {}
        const hasP256 = !!(`${sub?.keys?.p256dh || ''}`.trim());
        const hasAuth = !!(`${sub?.keys?.auth || ''}`.trim());
        const keys = hasP256 && hasAuth ? 'ok' : 'missing';
        const expirationRaw = sub?.expirationTime ?? null;
        const expiration = expirationRaw === null || expirationRaw === undefined || expirationRaw === ''
            ? 'none'
            : `${expirationRaw}`;
        return { host, keys, expiration };
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
        setDebugText('notificationsDebugCurrentPushType', '-');
        setDebugText('notificationsDebugCurrentToken', '-');
        setDebugText('notificationsDebugCurrentDwpHost', '-');
        setDebugText('notificationsDebugCurrentDwpKeys', '-');
        setDebugText('notificationsDebugCurrentDwpExpiration', '-');
        setDebugText('notificationsDebugCurrentUpdatedAt', '-');
        updatePushPermissionGuard(!!prefs.pushEnabled, { currentDeviceRegistered: false });
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
                !current;
            updatePushPermissionGuard(!!prefs.pushEnabled, { currentDeviceRegistered: !!current });
            updateRegisterCurrentDeviceButton({ show: showRegisterCurrentDeviceButton, busy: false });
            setDebugText('notificationsDebugCurrentPushType', formatPushType(current || {}));
            setDebugText('notificationsDebugCurrentToken', shortenToken(current?.token || ''));
            const dwpDetails = getDeclarativeDebugDetails(current || {});
            setDebugText('notificationsDebugCurrentDwpHost', dwpDetails.host);
            setDebugText('notificationsDebugCurrentDwpKeys', dwpDetails.keys);
            setDebugText('notificationsDebugCurrentDwpExpiration', dwpDetails.expiration);
            setDebugText('notificationsDebugCurrentUpdatedAt', current?.updatedAt || '-');

            if (!listEl) return;
            listEl.innerHTML = '';
            if (!rows.length) {
                listEl.textContent = 'No devices found.';
                return;
            }
            rows
                .sort((a, b) => `${b.updatedAt || ''}`.localeCompare(`${a.updatedAt || ''}`))
                .forEach((entry) => {
                    const row = document.createElement('div');
                    const isCurrent = entry.id === currentDeviceId;
                    row.className = isCurrent
                        ? 'flex items-center justify-between gap-2 rounded border border-sky-400 dark:border-sky-500 bg-white dark:bg-[#292524] px-2 py-1.5'
                        : 'flex items-center justify-between gap-2 rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#292524] px-2 py-1.5';
                    const meta = document.createElement('div');
                    meta.className = 'min-w-0 flex-1 text-[11px] text-coffee-700 dark:text-[#d6ccc2]';
                    const userAgent = typeof entry.userAgent === 'string' ? entry.userAgent.trim() : '';
                    const displayName = userAgent || entry.id;
                    const thisDeviceTag = isCurrent
                        ? '<span class="text-sky-600 dark:text-sky-400">(this device)</span>'
                        : '';
                    meta.innerHTML = `
                        <div class="min-w-0 font-semibold break-all" title="${escapeHtml(displayName)}">${escapeHtml(displayName)}${thisDeviceTag ? ` ${thisDeviceTag}` : ''}</div>
                    `;
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
            updatePushPermissionGuard(!!prefs.pushEnabled, { currentDeviceRegistered: false });
            updatePushAvailabilityState({ hasRegisteredDevices: false });
            if (listEl) listEl.textContent = `Failed loading devices: ${error?.message || error}`;
        }
    };

    const getSwDiagnostics = () => {
        if (typeof window === 'undefined') return [];
        const list = window.__coffeeDialPushDiagnostics;
        if (!Array.isArray(list)) return [];
        return list.filter((entry) => entry && typeof entry === 'object');
    };

    const renderSwDiagnosticsPanel = () => {
        const listEl = document.getElementById('notificationsSwDiagList');
        if (!listEl) return;
        const entries = getSwDiagnostics();
        if (!entries.length) {
            listEl.textContent = 'No diagnostics yet.';
            return;
        }
        const latest = entries.slice(-15).reverse();
        listEl.innerHTML = latest.map((entry) => {
            const eventType = escapeHtml(`${entry.eventType || '-'}`);
            const ts = escapeHtml(`${entry.ts || entry.tsClient || '-'}`);
            const swVersion = escapeHtml(`${entry.swVersion || '-'}`);
            const link = escapeHtml(`${entry?.details?.link || '-'}`);
            const clientsCount = escapeHtml(`${entry?.details?.existingClientCount ?? '-'}`);
            const openedClientUrl = escapeHtml(`${entry?.details?.openedClientUrl || '-'}`);
            const error = escapeHtml(`${entry?.details?.error || '-'}`);
            return `
                <div class="rounded border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#292524] p-1.5">
                    <div><span class="text-coffee-500 dark:text-[#a8a29e]">event</span>: ${eventType}</div>
                    <div><span class="text-coffee-500 dark:text-[#a8a29e]">ts</span>: ${ts}</div>
                    <div><span class="text-coffee-500 dark:text-[#a8a29e]">sw</span>: ${swVersion}</div>
                    <div><span class="text-coffee-500 dark:text-[#a8a29e]">link</span>: ${link}</div>
                    <div><span class="text-coffee-500 dark:text-[#a8a29e]">clients</span>: ${clientsCount}</div>
                    <div><span class="text-coffee-500 dark:text-[#a8a29e]">opened</span>: ${openedClientUrl}</div>
                    <div><span class="text-coffee-500 dark:text-[#a8a29e]">error</span>: ${error}</div>
                </div>
            `;
        }).join('');
    };

    const buildPushDebugText = () => {
        const read = (id) => `${document.getElementById(id)?.textContent || '-'}`.trim();
        return [
            `Permission: ${read('notificationsDebugPermission')}`,
            `Push enabled pref: ${read('notificationsDebugPushEnabled')}`,
            `Current device ID: ${read('notificationsDebugDeviceId')}`,
            `Registered devices: ${read('notificationsDebugDeviceCount')}`,
            `Current push type: ${read('notificationsDebugCurrentPushType')}`,
            `Current token: ${read('notificationsDebugCurrentToken')}`,
            `DWP endpoint host: ${read('notificationsDebugCurrentDwpHost')}`,
            `DWP keys: ${read('notificationsDebugCurrentDwpKeys')}`,
            `DWP expiration: ${read('notificationsDebugCurrentDwpExpiration')}`,
            `Current updatedAt: ${read('notificationsDebugCurrentUpdatedAt')}`
        ].join('\n');
    };

    const buildSwDiagnosticsText = () => {
        const entries = getSwDiagnostics().slice(-50).reverse();
        if (!entries.length) return 'No diagnostics yet.';
        return entries.map((entry) => {
            const eventType = `${entry.eventType || '-'}`;
            const ts = `${entry.ts || entry.tsClient || '-'}`;
            const swVersion = `${entry.swVersion || '-'}`;
            const link = `${entry?.details?.link || '-'}`;
            const clientsCount = `${entry?.details?.existingClientCount ?? '-'}`;
            const openedClientUrl = `${entry?.details?.openedClientUrl || '-'}`;
            const error = `${entry?.details?.error || '-'}`;
            return [
                `event: ${eventType}`,
                `ts: ${ts}`,
                `sw: ${swVersion}`,
                `link: ${link}`,
                `clients: ${clientsCount}`,
                `opened: ${openedClientUrl}`,
                `error: ${error}`
            ].join('\n');
        }).join('\n\n');
    };

    const copyTextToClipboard = async (text = '', successMessage = 'Copied') => {
        const payload = `${text || ''}`.trim();
        if (!payload) {
            alert('Nothing to copy.');
            return;
        }
        try {
            if (navigator?.clipboard?.writeText) {
                await navigator.clipboard.writeText(payload);
            } else {
                const area = document.createElement('textarea');
                area.value = payload;
                area.setAttribute('readonly', '');
                area.style.position = 'fixed';
                area.style.opacity = '0';
                document.body.appendChild(area);
                area.focus();
                area.select();
                document.execCommand('copy');
                document.body.removeChild(area);
            }
            alert(successMessage);
        } catch (error) {
            alert(`Copy failed: ${error?.message || error}`);
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
                    await onNotificationPreferencesChanged?.(nextNotificationPrefs, { trigger: 'toggle-disable' });
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
        const copyBtn = document.getElementById('notificationsDebugCopyBtn');
        const swDiagRefreshBtn = document.getElementById('notificationsSwDiagRefreshBtn');
        const swDiagCopyBtn = document.getElementById('notificationsSwDiagCopyBtn');
        const registerCurrentDeviceBtn = document.getElementById('notificationsRegisterCurrentDeviceBtn');
        refreshBtn?.addEventListener('click', () => {
            renderNotificationsDebugPanel();
            renderSwDiagnosticsPanel();
            renderBuildAndVersionInfo();
            updatePushPermissionGuard();
        });
        swDiagRefreshBtn?.addEventListener('click', () => {
            renderSwDiagnosticsPanel();
            renderBuildAndVersionInfo();
        });
        copyBtn?.addEventListener('click', () => {
            copyTextToClipboard(buildPushDebugText(), 'Push debug copied.');
        });
        swDiagCopyBtn?.addEventListener('click', () => {
            copyTextToClipboard(buildSwDiagnosticsText(), 'SW diagnostics copied.');
        });
        registerCurrentDeviceBtn?.addEventListener('click', async () => {
            updateRegisterCurrentDeviceButton({ show: true, busy: true });
            try {
                const registrationResult = await Promise.race([
                    Promise.resolve(
                        onNotificationPreferencesChanged?.(
                            normalizeNotificationPreferences(getNotificationPreferences?.()),
                            { trigger: 'register-button' }
                        )
                    ),
                    new Promise((resolve) => setTimeout(() => resolve({ ok: false, reason: 'timeout' }), 20000))
                ]);
                const result = registrationResult || { ok: false, reason: 'unknown' };
                if (result && result.ok === false) {
                    const reason = `${result.reason || ''}`.trim();
                    if (reason === 'permission-not-granted') {
                        alert('Push permission is not granted in this browser.');
                    } else if (reason === 'unsupported') {
                        alert('This browser environment does not support web push.');
                    } else if (reason === 'missing-vapid-key') {
                        alert('Push configuration is missing a VAPID key.');
                    } else if (reason === 'token-empty') {
                        alert('Could not obtain a push token for this device.');
                    } else if (reason === 'token-timeout') {
                        alert('Timed out while obtaining a push token. Please try again.');
                    } else if (reason === 'token-error') {
                        alert(`Push token request failed: ${result.error || 'Unknown error'}`);
                    } else if (reason === 'push-disabled') {
                        alert('Enable push notifications first.');
                    } else if (reason === 'no-user') {
                        alert('You need to be signed in to register this device.');
                    } else if (reason === 'timeout') {
                        alert('Device registration timed out. Check service worker/network and try again.');
                    } else if (reason === 'error') {
                        alert(`Device registration failed: ${result.error || 'Unknown error'}`);
                    } else {
                        alert(`Device registration did not complete (${reason || 'unknown reason'}).`);
                    }
                }
            } catch (error) {
                alert(`Failed registering current device: ${error?.message || error}`);
            } finally {
                const rendered = await Promise.race([
                    Promise.resolve(renderNotificationsDebugPanel()).then(() => true).catch(() => false),
                    new Promise((resolve) => setTimeout(() => resolve(false), 5000))
                ]);
                renderSwDiagnosticsPanel();
                setTimeout(() => {
                    renderNotificationsDebugPanel();
                    renderSwDiagnosticsPanel();
                    renderBuildAndVersionInfo();
                }, 1200);
                if (!rendered) {
                    updateRegisterCurrentDeviceButton({ show: true, busy: false });
                }
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

    const runMaximumFreshReload = async () => {
        if (reloadInProgress) return;
        reloadInProgress = true;
        const reloadBtn = document.getElementById('preferencesReloadAppBtn');
        if (reloadBtn) {
            reloadBtn.disabled = true;
            reloadBtn.classList.add('opacity-60', 'cursor-not-allowed');
            reloadBtn.textContent = 'Reloading...';
        }
        try {
            if (typeof navigator !== 'undefined' && navigator.serviceWorker) {
                const registrations = await navigator.serviceWorker.getRegistrations().catch(() => []);
                const controllerChanged = new Promise((resolve) => {
                    let done = false;
                    const finish = () => {
                        if (done) return;
                        done = true;
                        resolve(true);
                    };
                    navigator.serviceWorker.addEventListener('controllerchange', finish, { once: true });
                    setTimeout(() => resolve(false), 3500);
                });
                await Promise.all(registrations.map(async (registration) => {
                    try { await registration.update(); } catch (_) {}
                }));
                await Promise.all(registrations.map(async (registration) => {
                    try {
                        if (registration.waiting) {
                            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                        }
                    } catch (_) {}
                }));
                await controllerChanged;
            }
            if (typeof caches !== 'undefined' && typeof caches.keys === 'function') {
                const cacheNames = await caches.keys().catch(() => []);
                await Promise.all(cacheNames.map((name) => caches.delete(name).catch(() => false)));
            }
        } catch (_) {
            // Continue with reload even if cleanup partly fails.
        }

        try {
            const url = new URL(window.location.href);
            url.search = '';
            url.hash = '';
            url.searchParams.set('_r', `${Date.now()}`);
            window.location.replace(url.toString());
        } catch (_) {
            window.location.reload();
        }
    };

    const bindReloadButton = () => {
        if (hasBoundReloadButton) return;
        hasBoundReloadButton = true;
        const reloadBtn = document.getElementById('preferencesReloadAppBtn');
        reloadBtn?.addEventListener('click', () => {
            runMaximumFreshReload();
        });
    };

    const persistPinnedBrewsPreferences = async (nextState) => {
        let nextPinnedPrefs = { ...(nextState?.pinned || {}) };
        const prevNotificationPrefs = normalizeNotificationPreferences(getNotificationPreferences?.());
        const nextNotificationPrefs = normalizeNotificationPreferences(nextState?.notificationPrefs || getNotificationPreferences?.());
        const nextIntegrationPrefs = normalizeIntegrationPreferences(nextState?.integrationPrefs || getIntegrationPreferences?.());
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
        setIntegrationPreferences?.(nextIntegrationPrefs);
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
                    notificationPrefs: nextNotificationPrefs,
                    integrationPrefs: nextIntegrationPrefs
                });
            } catch (e) {
                console.error('Error saving pinned prefs', e);
            }
        }
        renderTable();
        renderPinnedTiles();
        onPinnedBrewsPreferencesChanged?.(nextPinnedPrefs);
        const wasPushEnabled = !!prevNotificationPrefs.pushEnabled;
        const isPushEnabled = !!nextNotificationPrefs.pushEnabled;
        if (wasPushEnabled !== isPushEnabled) {
            onNotificationPreferencesChanged?.(
                nextNotificationPrefs,
                { trigger: isPushEnabled ? 'toggle-enable' : 'toggle-disable' }
            );
        } else {
            onNotificationPreferencesChanged?.(nextNotificationPrefs, { trigger: 'preferences-save' });
        }
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
        PREF_INPUT_IDS.forEach((id) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.addEventListener('input', () => {
                if (isHydratingPreferences) return;
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
        document.getElementById('keepCuppingNotesWhenRepeatingBrewToggle').checked = pinnedPrefs.keepCuppingNotesWhenRepeatingBrew === true;
        const notificationPrefs = normalizeNotificationPreferences(getNotificationPreferences?.());
        document.getElementById('notificationsPushEnabledToggle').checked = !!notificationPrefs.pushEnabled;
        document.getElementById('notificationsFriendMomentsToggle').checked = !!notificationPrefs.friendMoments;
        document.getElementById('notificationsCommentsMyToggle').checked = !!notificationPrefs.commentsOnMyMoments;
        document.getElementById('notificationsCommentsFollowingToggle').checked = !!notificationPrefs.commentsOnFollowedOrCommentedMoments;
        const integrationPrefs = normalizeIntegrationPreferences(getIntegrationPreferences?.());
        document.getElementById('integrationsRemoveBgEnabledToggle').checked = !!integrationPrefs.removeBg.enabled;
        document.getElementById('integrationsRemoveBgApiKey').value = integrationPrefs.removeBg.apiKey || '';
        updateAnimationsToggleState(!!pinnedPrefs.showTilesInsteadOfCoffeeArt);
        updateNotificationToggleState(!!notificationPrefs.pushEnabled);
        updatePushPermissionGuard(!!notificationPrefs.pushEnabled, { currentDeviceRegistered: false });

        bindPreferencesAutoSave();
        bindNotificationsDebug();
        bindReloadButton();
        renderNotificationsDebugPanel();
        renderSwDiagnosticsPanel();
        renderBuildAndVersionInfo();
        isHydratingPreferences = false;

        document.getElementById('preferencesModal').classList.remove('hidden');
    };

    return {
        applyAnimationPreference,
        openPreferences
    };
};
