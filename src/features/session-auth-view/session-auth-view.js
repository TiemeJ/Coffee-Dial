import {
    DEFAULT_INTEGRATION_PREFERENCES,
    normalizeIntegrationPreferences
} from '../../core/integration-preferences.js';

const DEFAULT_NOTIFICATION_PREFERENCES = {
    pushEnabled: false,
    friendMoments: true,
    commentsOnMyMoments: true,
    commentsOnFollowedOrCommentedMoments: true
};

const normalizeNotificationPreferences = (value = null) => {
    const source = (value && typeof value === 'object') ? value : {};
    return {
        pushEnabled: !!source.pushEnabled,
        friendMoments: source.friendMoments !== false,
        commentsOnMyMoments: source.commentsOnMyMoments !== false,
        commentsOnFollowedOrCommentedMoments: source.commentsOnFollowedOrCommentedMoments !== false
    };
};

export const createSessionAuthViewModule = ({
    authService,
    dataService,
    getCurrentUser,
    setCurrentView,
    syncFriendViewSelectValues,
    getUnsubscribeData,
    setUnsubscribeData,
    getUnsubscribeBeans,
    setUnsubscribeBeans,
    getUnsubscribeCoffeeTypes,
    setUnsubscribeCoffeeTypes,
    getUnsubscribeGas,
    setUnsubscribeGas,
    getUnsubscribeNotifications,
    setUnsubscribeNotifications,
    setHasLoadedBrews,
    setHasLoadedBeans,
    toggleForm,
    getCurrentSort,
    setCoffees,
    getCoffees,
    setBeans,
    setCoffeeTypes,
    setGasItems,
    renderPinnedTiles,
    renderTable,
    updateAutocompleteLists,
    updateBeanDropdown,
    renderBeansTable,
    updateCoffeeTypeSelectors,
    renderCoffeeTypesTable,
    renderGasTable,
    getColumnPreferencesKey,
    getColumnPreferences,
    loadColumnPreferencesFromStorage,
    saveColumnPreferencesToStorage,
    getPinnedBrewsPreferences,
    setPinnedBrewsPreferences,
    applyAnimationPreference,
    setIsPublic,
    updatePublicToggleUI,
    getCoffeeScale,
    refreshBrewGearSelectors,
    getLastGalleryVisit,
    setLastGalleryVisit,
    getNotificationPreferences,
    setNotificationPreferences,
    getIntegrationPreferences,
    setIntegrationPreferences
}) => {
    const { auth, provider, signInWithPopup, signOut } = authService || {};
    const { db, doc, setDoc, updateDoc, getDoc, getDocs, collection, query, where, orderBy, limit, onSnapshot } = dataService || {};
    if (!auth || !provider || !signInWithPopup || !signOut) {
        throw new Error('createSessionAuthViewModule requires authService { auth, provider, signInWithPopup, signOut }');
    }
    if (!db || !doc || !setDoc || !updateDoc || !getDoc || !getDocs || !collection || !query || !where || !orderBy || !limit || !onSnapshot) {
        throw new Error('createSessionAuthViewModule requires dataService { db, doc, setDoc, updateDoc, getDoc, getDocs, collection, query, where, orderBy, limit, onSnapshot }');
    }
    let outgoingFriendRequestsProcessor = null;
    let pendingLiveListenerHandle = null;
    let currentViewListenerContext = null;
    let latestViewRequestId = 0;
    const INITIAL_BREWS_LIMIT = 120;
    const INITIAL_PINNED_BREWS_LIMIT = 120;
    let hasCompletedInitialViewBootstrap = false;
    const googleLogin = () => signInWithPopup(auth, provider).catch((e) => alert(e.message));

    const googleLogout = () => signOut(auth).then(() => location.reload());

    const clearViewSubscriptions = () => {
        currentViewListenerContext = null;
        if (pendingLiveListenerHandle) {
            const clearIdle = window.cancelIdleCallback;
            if (typeof clearIdle === 'function' && pendingLiveListenerHandle.type === 'idle') {
                clearIdle(pendingLiveListenerHandle.id);
            } else {
                clearTimeout(pendingLiveListenerHandle.id);
            }
            pendingLiveListenerHandle = null;
        }
        const unsubData = getUnsubscribeData();
        const unsubBeans = getUnsubscribeBeans();
        const unsubCoffeeTypes = getUnsubscribeCoffeeTypes();
        const unsubGas = getUnsubscribeGas();
        if (unsubData) unsubData();
        if (unsubBeans) unsubBeans();
        if (unsubCoffeeTypes) unsubCoffeeTypes();
        if (unsubGas) unsubGas();
        setUnsubscribeData(null);
        setUnsubscribeBeans(null);
        setUnsubscribeCoffeeTypes(null);
        setUnsubscribeGas(null);
    };

    const handleViewPermissionDenied = () => {
        alert('⚠️ Access Denied: This user\'s profile is private.');
        syncFriendViewSelectValues('mine');
        changeView('mine');
    };

    const getModal = (id) => document.getElementById(id);

    const attachLiveViewListeners = ({ targetUid, isMine, requestId, skipFirstCallback = false }) => {
        if (requestId !== latestViewRequestId) return;

        let skipBrews = skipFirstCallback;
        let skipBeans = skipFirstCallback;
        let skipCoffeeTypes = skipFirstCallback;

        const brewsRef = collection(db, 'users', targetUid, 'coffees');
        setUnsubscribeData(
            onSnapshot(
                brewsRef,
                (snapshot) => {
                    if (requestId !== latestViewRequestId) return;
                    if (skipBrews) { skipBrews = false; return; }
                    const nextCoffees = [];
                    snapshot.forEach((docSnap) => nextCoffees.push({ id: docSnap.id, ...docSnap.data() }));
                    if (!getCurrentSort().key) {
                        nextCoffees.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                    }
                    setCoffees(nextCoffees);
                    renderPinnedTiles();
                    renderTable();
                    updateAutocompleteLists();
                    setHasLoadedBrews(true);
                },
                (error) => {
                    console.error(error);
                    if (error.code === 'permission-denied') {
                        handleViewPermissionDenied();
                    }
                }
            )
        );

        const beansRef = collection(db, 'users', targetUid, 'beans');
        setUnsubscribeBeans(
            onSnapshot(
                beansRef,
                (snapshot) => {
                    if (requestId !== latestViewRequestId) return;
                    if (skipBeans) { skipBeans = false; return; }
                    const nextBeans = [];
                    snapshot.forEach((docSnap) => nextBeans.push({ id: docSnap.id, ...docSnap.data() }));
                    setBeans(nextBeans);

                    if (isMine) updateBeanDropdown();
                    if (!document.getElementById('beansModal').classList.contains('hidden')) {
                        renderBeansTable();
                    }
                    renderPinnedTiles();
                    renderTable();
                    setHasLoadedBeans(true);
                },
                (error) => {
                    console.error('Error loading beans:', error);
                    setBeans([]);
                    renderPinnedTiles();
                    renderTable();
                }
            )
        );

        const coffeeTypesRef = collection(db, 'users', targetUid, 'coffeeTypes');
        setUnsubscribeCoffeeTypes(
            onSnapshot(
                coffeeTypesRef,
                (snapshot) => {
                    if (requestId !== latestViewRequestId) return;
                    if (skipCoffeeTypes) { skipCoffeeTypes = false; return; }
                    const nextCoffeeTypes = [];
                    snapshot.forEach((docSnap) => nextCoffeeTypes.push({ id: docSnap.id, ...docSnap.data() }));
                    setCoffeeTypes(nextCoffeeTypes);
                    updateCoffeeTypeSelectors();
                    if (isMine) updateBeanDropdown();
                    if (!document.getElementById('coffeeTypesModal').classList.contains('hidden')) {
                        renderCoffeeTypesTable();
                    }
                    renderPinnedTiles();
                    renderTable();
                },
                (error) => {
                    console.error('Error loading coffees:', error);
                    setCoffeeTypes([]);
                    updateCoffeeTypeSelectors();
                    if (isMine) updateBeanDropdown();
                    if (!document.getElementById('coffeeTypesModal').classList.contains('hidden')) {
                        renderCoffeeTypesTable();
                    }
                    renderPinnedTiles();
                    renderTable();
                }
            )
        );
    };

    const attachGasLiveListener = ({ targetUid, requestId }) => {
        if (requestId !== latestViewRequestId) return;
        if (getUnsubscribeGas()) return;

        const gasRef = collection(db, 'users', targetUid, 'gear');
        setUnsubscribeGas(
            onSnapshot(
                gasRef,
                (snapshot) => {
                    if (requestId !== latestViewRequestId) return;
                    const nextGasItems = [];
                    snapshot.forEach((docSnap) => nextGasItems.push({ id: docSnap.id, ...docSnap.data() }));
                    setGasItems(nextGasItems);
                    if (refreshBrewGearSelectors) refreshBrewGearSelectors();
                    if (!getModal('gasModal')?.classList.contains('hidden')) {
                        renderGasTable();
                    }
                },
                (error) => {
                    console.error('Error loading gas list:', error);
                    setGasItems([]);
                    if (refreshBrewGearSelectors) refreshBrewGearSelectors();
                    if (!getModal('gasModal')?.classList.contains('hidden')) {
                        renderGasTable();
                    }
                }
            )
        );
    };

    const ensureGasListenerForCurrentView = () => {
        if (!currentViewListenerContext) return;
        attachGasLiveListener(currentViewListenerContext);
    };

    const scheduleLiveViewListeners = ({ targetUid, isMine, requestId, skipFirstCallback = false }) => {
        const run = () => {
            pendingLiveListenerHandle = null;
            attachLiveViewListeners({ targetUid, isMine, requestId, skipFirstCallback });
        };
        const scheduleIdle = window.requestIdleCallback;
        if (typeof scheduleIdle === 'function') {
            const id = scheduleIdle(run, { timeout: 1800 });
            pendingLiveListenerHandle = { type: 'idle', id };
            return;
        }
        const id = setTimeout(run, 900);
        pendingLiveListenerHandle = { type: 'timeout', id };
    };

    const clearNotificationSubscription = () => {
        const unsub = getUnsubscribeNotifications();
        if (unsub) unsub();
        setUnsubscribeNotifications(null);
    };

    const initUserData = async (user) => {
        console.log('[PERF-DATA] initUserData: start');
        const userDocRef = doc(db, 'users', user.uid);
        const publicProfileRef = doc(db, 'publicProfiles', user.uid);
        const snap = await getDoc(userDocRef);
        console.log('[PERF-DATA] initUserData: user doc fetched');
        let shouldShowOnboarding = false;

        if (snap.exists()) {
            const data = snap.data();
            setIsPublic(data.isPublic || false);
            shouldShowOnboarding = data.onboardingSeen !== true;
            setLastGalleryVisit(data.lastGalleryVisit || null);

            const coffeeScale = getCoffeeScale?.();
            if (coffeeScale?.setGraphTogglePrefs) {
                coffeeScale.setGraphTogglePrefs(data.graphTogglePrefs || {});
            }

            if (data.preferences && !localStorage.getItem(getColumnPreferencesKey())) {
                saveColumnPreferencesToStorage(data.preferences);
            }
            loadColumnPreferencesFromStorage();

            if (data.pinnedBrews) {
                setPinnedBrewsPreferences({ ...getPinnedBrewsPreferences(), ...data.pinnedBrews });
            } else {
                try {
                    await updateDoc(userDocRef, { pinnedBrews: getPinnedBrewsPreferences() });
                } catch (err) {
                    console.error('Error saving pinned preferences', err);
                }
            }

            if (data.displayName !== user.displayName) {
                await updateDoc(userDocRef, { displayName: user.displayName });
            }

            const normalizedPrefs = normalizeNotificationPreferences(data.notificationPrefs || getNotificationPreferences?.());
            setNotificationPreferences?.(normalizedPrefs);
            if (!data.notificationPrefs || typeof data.notificationPrefs !== 'object') {
                try {
                    await updateDoc(userDocRef, { notificationPrefs: normalizedPrefs });
                } catch (err) {
                    console.error('Error saving notification preferences', err);
                }
            }

            const normalizedIntegrationPrefs = normalizeIntegrationPreferences(
                data.integrationPrefs || getIntegrationPreferences?.()
            );
            setIntegrationPreferences?.(normalizedIntegrationPrefs);
            if (!data.integrationPrefs || typeof data.integrationPrefs !== 'object') {
                try {
                    await updateDoc(userDocRef, { integrationPrefs: normalizedIntegrationPrefs });
                } catch (err) {
                    console.error('Error saving integration preferences', err);
                }
            }
        } else {
            loadColumnPreferencesFromStorage();
            await setDoc(userDocRef, {
                isPublic: false,
                displayName: user.displayName,
                pinnedBrews: getPinnedBrewsPreferences(),
                notificationPrefs: DEFAULT_NOTIFICATION_PREFERENCES,
                integrationPrefs: DEFAULT_INTEGRATION_PREFERENCES,
                graphTogglePrefs: {},
                onboardingSeen: false,
                lastGalleryVisit: null
            });
            await setDoc(publicProfileRef, {
                uid: user.uid,
                displayName: user.displayName || 'Unknown User',
                isPublic: false,
                updatedAt: new Date().toISOString()
            }, { merge: true });
            shouldShowOnboarding = true;
            setLastGalleryVisit(null);
            const coffeeScale = getCoffeeScale?.();
            if (coffeeScale?.setGraphTogglePrefs) {
                coffeeScale.setGraphTogglePrefs({});
            }
            setNotificationPreferences?.(DEFAULT_NOTIFICATION_PREFERENCES);
            setIntegrationPreferences?.(DEFAULT_INTEGRATION_PREFERENCES);
        }

        const coffeeScale = getCoffeeScale?.();
        if (coffeeScale?.setGraphTogglePrefsSaver) {
            coffeeScale.setGraphTogglePrefsSaver((prefs) => {
                if (!getCurrentUser()) return Promise.resolve();
                return updateDoc(userDocRef, { graphTogglePrefs: prefs });
            });
        }

        const formContainer = document.getElementById('formContainer');
        if (formContainer && formContainer.getAttribute('aria-expanded') === 'true') {
            const isEditing = formContainer.classList.contains('editing-mode') || !!document.getElementById('editId').value;
            if (!isEditing && coffeeScale?.applyGraphTogglePrefsForMethod) {
                coffeeScale.applyGraphTogglePrefsForMethod();
            }
        }

        if (!localStorage.getItem(getColumnPreferencesKey())) {
            saveColumnPreferencesToStorage(getColumnPreferences());
        }

        applyAnimationPreference();
        updatePublicToggleUI();
        const shareIdInput = document.getElementById('myShareId');
        if (shareIdInput) shareIdInput.value = user.uid;
        return { shouldShowOnboarding };
    };

    const markOnboardingSeen = async () => {
        const user = getCurrentUser();
        if (!user) return;
        try {
            await setDoc(doc(db, 'users', user.uid), { onboardingSeen: true }, { merge: true });
        } catch (err) {
            console.error('Error saving onboarding state', err);
        }
    };

    const changeView = async (uid) => {
        console.log(`[PERF-DATA] changeView(${uid}): start`);
        latestViewRequestId += 1;
        const requestId = latestViewRequestId;
        setCurrentView(uid);
        syncFriendViewSelectValues(uid);
        clearViewSubscriptions();
        setHasLoadedBrews(false);
        setHasLoadedBeans(false);

        const user = getCurrentUser();
        if (!user) return;

        const isMine = uid === 'mine';
        const targetUid = isMine ? user.uid : uid;
        currentViewListenerContext = { targetUid, requestId };
        const sortByPinnedOrder = (left, right) => {
            const orderDelta = (left?.customOrder || 0) - (right?.customOrder || 0);
            if (orderDelta !== 0) return orderDelta;
            return new Date(left?.createdAt || 0) - new Date(right?.createdAt || 0);
        };
        const loadPinnedBootstrapSnapshot = async () => {
            console.log('[PERF-DATA] loadPinnedBootstrapSnapshot: start');
            const pinnedBrewsQ = query(
                collection(db, 'users', targetUid, 'coffees'),
                where('isActive', '==', true),
                limit(INITIAL_PINNED_BREWS_LIMIT)
            );
            const activeBeansQ = query(
                collection(db, 'users', targetUid, 'beans'),
                where('archived', '==', false),
                where('frozen', '==', false)
            );
            const [pinnedBrewsSnap, activeBeansSnap] = await Promise.all([
                getDocs(pinnedBrewsQ),
                getDocs(activeBeansQ)
            ]);
            console.log(`[PERF-DATA] loadPinnedBootstrapSnapshot: queries done (brews=${pinnedBrewsSnap.size}, beans=${activeBeansSnap.size})`);
            if (requestId !== latestViewRequestId) return false;

            const nextActiveBeans = [];
            const activeBeanMap = new Map();
            activeBeansSnap.forEach((docSnap) => {
                const bean = { id: docSnap.id, ...docSnap.data() };
                activeBeanMap.set(bean.id, bean);
                nextActiveBeans.push(bean);
            });

            const clean = (value) => (value || '').toString().toLowerCase().trim();
            const resolveActiveBeanIdForBrew = (brew) => {
                const explicitBeanId = typeof brew?.beanId === 'string' ? brew.beanId.trim() : '';
                if (explicitBeanId && activeBeanMap.has(explicitBeanId)) return explicitBeanId;
                const matchedBean = nextActiveBeans.find((bean) =>
                    clean(bean.roaster) === clean(brew?.roaster) &&
                    clean(bean.farmer) === clean(brew?.farmer) &&
                    clean(bean.origin) === clean(brew?.origin) &&
                    clean(bean.processing) === clean(brew?.processing) &&
                    clean(bean.variety) === clean(brew?.variety) &&
                    clean(bean.roastType) === clean(brew?.roastType)
                );
                return matchedBean?.id || '';
            };

            const nextPinnedBrews = [];
            pinnedBrewsSnap.forEach((docSnap) => {
                const brew = { id: docSnap.id, ...docSnap.data() };
                if (!brew?.isActive) return;
                const activeBeanId = resolveActiveBeanIdForBrew(brew);
                if (!activeBeanId) return;
                nextPinnedBrews.push({
                    ...brew,
                    beanId: activeBeanId
                });
            });
            nextPinnedBrews.sort(sortByPinnedOrder);

            setBeans(nextActiveBeans);
            if (isMine) updateBeanDropdown();
            if (!getModal('beansModal')?.classList.contains('hidden')) {
                renderBeansTable();
            }
            setHasLoadedBeans(true);

            setCoffees(nextPinnedBrews);
            updateAutocompleteLists();
            setHasLoadedBrews(true);

            renderPinnedTiles({
                progressiveHydration: true,
                activeBeansOnly: true,
                suppressCoffeeDetails: true,
                suppressCoffeeImages: true
            });
            console.log('[PERF-DATA] loadPinnedBootstrapSnapshot: renderPinnedTiles done');
            return true;
        };

        const loadCompleteViewData = async () => {
            console.log('[PERF-DATA] loadCompleteViewData: start');
            try {
                const brewsInitialQ = query(
                    collection(db, 'users', targetUid, 'coffees'),
                    orderBy('createdAt', 'desc'),
                    limit(INITIAL_BREWS_LIMIT)
                );
                const activeBeansInitialQ = query(
                    collection(db, 'users', targetUid, 'beans'),
                    where('archived', '==', false),
                    where('frozen', '==', false)
                );
                const [brewsSnap, activeBeansSnap, gasSnap] = await Promise.all([
                    getDocs(brewsInitialQ),
                    getDocs(activeBeansInitialQ),
                    getDocs(collection(db, 'users', targetUid, 'gear'))
                ]);

                if (requestId !== latestViewRequestId) return;

                const nextCoffees = [];
                brewsSnap.forEach((docSnap) => nextCoffees.push({ id: docSnap.id, ...docSnap.data() }));
                if (!getCurrentSort().key) {
                    nextCoffees.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                }
                setCoffees(nextCoffees);
                updateAutocompleteLists();
                setHasLoadedBrews(true);

                const nextBeans = [];
                const beanMap = new Map();
                activeBeansSnap.forEach((docSnap) => {
                    const bean = { id: docSnap.id, ...docSnap.data() };
                    beanMap.set(bean.id, bean);
                    nextBeans.push(bean);
                });

                const referencedBeanIds = new Set(
                    nextCoffees.map((brew) => brew?.beanId).filter((beanId) => typeof beanId === 'string' && beanId.trim())
                );
                const missingReferencedBeanIds = Array.from(referencedBeanIds).filter((beanId) => !beanMap.has(beanId));
                if (missingReferencedBeanIds.length) {
                    const missingBeanSnaps = await Promise.all(
                        missingReferencedBeanIds.map((beanId) => getDoc(doc(db, 'users', targetUid, 'beans', beanId)))
                    );
                    if (requestId !== latestViewRequestId) return;
                    missingBeanSnaps.forEach((beanSnap) => {
                        if (!beanSnap.exists()) return;
                        const bean = { id: beanSnap.id, ...beanSnap.data() };
                        if (beanMap.has(bean.id)) return;
                        beanMap.set(bean.id, bean);
                        nextBeans.push(bean);
                    });
                }
                // Legacy safety: older docs may miss archived/frozen fields and be excluded from the filtered query.
                if (!nextBeans.length && referencedBeanIds.size) {
                    const legacyBeansSnap = await getDocs(collection(db, 'users', targetUid, 'beans'));
                    if (requestId !== latestViewRequestId) return;
                    legacyBeansSnap.forEach((docSnap) => {
                        const bean = { id: docSnap.id, ...docSnap.data() };
                        if (beanMap.has(bean.id)) return;
                        if (referencedBeanIds.has(bean.id)) {
                            beanMap.set(bean.id, bean);
                            nextBeans.push(bean);
                        }
                    });
                }

                setBeans(nextBeans);
                if (isMine) updateBeanDropdown();
                if (!getModal('beansModal')?.classList.contains('hidden')) {
                    renderBeansTable();
                }
                setHasLoadedBeans(true);

                const referencedCoffeeTypeIds = new Set(
                    nextCoffees
                        .map((brew) => brew?.coffeeTypeId)
                        .filter((coffeeTypeId) => typeof coffeeTypeId === 'string' && coffeeTypeId.trim())
                );
                nextBeans.forEach((bean) => {
                    const coffeeTypeId = bean?.coffeeTypeId;
                    if (typeof coffeeTypeId !== 'string' || !coffeeTypeId.trim()) return;
                    referencedCoffeeTypeIds.add(coffeeTypeId);
                });

                const nextCoffeeTypes = [];
                if (referencedCoffeeTypeIds.size) {
                    const coffeeTypeSnaps = await Promise.all(
                        Array.from(referencedCoffeeTypeIds).map((coffeeTypeId) =>
                            getDoc(doc(db, 'users', targetUid, 'coffeeTypes', coffeeTypeId))
                        )
                    );
                    if (requestId !== latestViewRequestId) return;
                    coffeeTypeSnaps.forEach((coffeeTypeSnap) => {
                        if (!coffeeTypeSnap.exists()) return;
                        nextCoffeeTypes.push({ id: coffeeTypeSnap.id, ...coffeeTypeSnap.data() });
                    });
                }
                setCoffeeTypes(nextCoffeeTypes);
                updateCoffeeTypeSelectors();
                if (isMine) updateBeanDropdown();
                if (!getModal('coffeeTypesModal')?.classList.contains('hidden')) {
                    renderCoffeeTypesTable();
                }

                const nextGasItems = [];
                gasSnap.forEach((docSnap) => nextGasItems.push({ id: docSnap.id, ...docSnap.data() }));
                setGasItems(nextGasItems);
                if (refreshBrewGearSelectors) refreshBrewGearSelectors();

                renderPinnedTiles();
                renderTable();
                console.log('[PERF-DATA] loadCompleteViewData: renderPinnedTiles+renderTable done');
                const navStart = performance.timing?.navigationStart || performance.timeOrigin || 0;
                console.log(`[PERF-ABSOLUTE] Full data loaded and rendered: ${Date.now() - navStart}ms from navigation start`);
                scheduleLiveViewListeners({ targetUid, isMine, requestId, skipFirstCallback: true });
                if (!getModal('gasModal')?.classList.contains('hidden')) {
                    ensureGasListenerForCurrentView();
                }
            } catch (error) {
                console.error('Initial view load failed:', error);
                if (error?.code === 'permission-denied') {
                    handleViewPermissionDenied();
                    return;
                }
                // Fallback to immediate live listeners if the bootstrap query path fails.
                attachLiveViewListeners({ targetUid, isMine, requestId });
            }
        };

        const shouldUsePinnedBootstrap = !hasCompletedInitialViewBootstrap;
        console.log(`[PERF-DATA] changeView: shouldUsePinnedBootstrap=${shouldUsePinnedBootstrap}`);
        if (shouldUsePinnedBootstrap) {
            let renderedPinnedBootstrap = false;
            try {
                renderedPinnedBootstrap = await loadPinnedBootstrapSnapshot();
            } catch (error) {
                console.warn('Pinned bootstrap load failed, falling back to full load:', error);
            }
            if (renderedPinnedBootstrap) {
                void loadCompleteViewData().then(() => {
                    if (requestId === latestViewRequestId) {
                        hasCompletedInitialViewBootstrap = true;
                    }
                });
                return;
            }
        }

        await loadCompleteViewData();
        if (requestId === latestViewRequestId) {
            hasCompletedInitialViewBootstrap = true;
        }
    };

    const initNotificationListener = (uid) => {
        clearNotificationSubscription();
        const sharedPhotosQ = query(collection(db, 'photos'), where('sharedWith', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(200));
        const ownPhotosQ = query(collection(db, 'photos'), where('uid', '==', uid), orderBy('createdAt', 'desc'), limit(200));
        const friendRequestsQ = query(
            collection(db, 'friendRequests'),
            where('toUid', '==', uid),
            where('status', '==', 'pending'),
            limit(100)
        );
        const acceptedOutgoingQ = query(
            collection(db, 'friendRequests'),
            where('fromUid', '==', uid),
            where('status', '==', 'accepted'),
            limit(100)
        );
        let latestPhotoDate = null;
        let hasNewComments = false;
        let sharedPhotosSnapshot = null;
        let ownPhotosSnapshot = null;
        let commentWatchersUnsubs = [];
        const latestCommentByPhotoId = new Map();
        let pendingFriendRequestsCount = 0;

        const syncAvatarBadge = () => {
            const avatarBadge = document.getElementById('avatarBadge');
            if (!avatarBadge) return;
            if (!pendingFriendRequestsCount) {
                avatarBadge.classList.add('hidden');
                avatarBadge.textContent = '';
                return;
            }
            avatarBadge.classList.remove('hidden');
            avatarBadge.textContent = pendingFriendRequestsCount > 99 ? '99+' : String(pendingFriendRequestsCount);
        };

        const toDate = (value) => {
            if (!value) return null;
            const parsed = new Date(value);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
        };

        const syncCommentBadges = () => {
            const baseline = toDate(getLastGalleryVisit());
            if (!baseline) {
                hasNewComments = false;
                return;
            }
            const hasUnreadInSnapshot = (snapshot) => {
                if (!snapshot || snapshot.empty) return false;
                return snapshot.docs.some((docSnap) => {
                    const data = docSnap.data() || {};
                    const commentAt = toDate(data.lastCommentAt);
                    if (!commentAt || commentAt <= baseline) return false;
                    if (data.lastCommentByUid && data.lastCommentByUid === uid) return false;
                    return true;
                });
            };

            const unreadFromMetadata = hasUnreadInSnapshot(sharedPhotosSnapshot) || hasUnreadInSnapshot(ownPhotosSnapshot);
            const unreadFromLiveWatchers = Array.from(latestCommentByPhotoId.values()).some((entry) => {
                const commentAt = toDate(entry?.createdAt);
                if (!commentAt || commentAt <= baseline) return false;
                if (entry?.uid && entry.uid === uid) return false;
                return true;
            });
            hasNewComments = unreadFromMetadata || unreadFromLiveWatchers;
        };

        const clearCommentWatchers = () => {
            commentWatchersUnsubs.forEach((unsub) => {
                try { unsub(); } catch (_) {}
            });
            commentWatchersUnsubs = [];
            latestCommentByPhotoId.clear();
        };

        const getRecentPhotoIdsForCommentWatchers = (max = 40) => {
            const docs = [];
            if (ownPhotosSnapshot && !ownPhotosSnapshot.empty) {
                ownPhotosSnapshot.docs.forEach((docSnap) => docs.push(docSnap));
            }
            if (sharedPhotosSnapshot && !sharedPhotosSnapshot.empty) {
                sharedPhotosSnapshot.docs.forEach((docSnap) => docs.push(docSnap));
            }
            const unique = new Map();
            docs.forEach((docSnap) => {
                if (!unique.has(docSnap.id)) unique.set(docSnap.id, docSnap);
            });
            return Array.from(unique.values())
                .sort((a, b) => {
                    const aDate = toDate(a.data()?.createdAt);
                    const bDate = toDate(b.data()?.createdAt);
                    const aTime = aDate ? aDate.getTime() : 0;
                    const bTime = bDate ? bDate.getTime() : 0;
                    return bTime - aTime;
                })
                .slice(0, Math.max(1, max))
                .map((docSnap) => docSnap.id);
        };

        const refreshCommentWatchers = () => {
            clearCommentWatchers();
            const ids = getRecentPhotoIdsForCommentWatchers(40);
            if (!ids.length) {
                syncCommentBadges();
                syncGalleryBadge();
                return;
            }
            ids.forEach((photoId) => {
                const latestCommentQ = query(
                    collection(db, 'photos', photoId, 'comments'),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                );
                let watcherUnsub = () => {};
                watcherUnsub = onSnapshot(
                    latestCommentQ,
                    (snapshot) => {
                        if (snapshot.empty) latestCommentByPhotoId.delete(photoId);
                        else latestCommentByPhotoId.set(photoId, snapshot.docs[0].data() || {});
                        syncCommentBadges();
                        syncGalleryBadge();
                    },
                    (error) => {
                        if (error?.code !== 'permission-denied') {
                            console.error('Comment notification watcher error:', error);
                        }
                        // Stop this watcher on permission failures for inaccessible comment subcollections.
                        watcherUnsub();
                        latestCommentByPhotoId.delete(photoId);
                        syncCommentBadges();
                        syncGalleryBadge();
                    }
                );
                commentWatchersUnsubs.push(watcherUnsub);
            });
        };

        const syncGalleryBadge = () => {
            const menuBadge = document.getElementById('menuBadge');
            const galleryBadge = document.getElementById('galleryBadge');
            if (!menuBadge || !galleryBadge) return;
            const lastVisit = getLastGalleryVisit();
            const hasNewPhoto = !!latestPhotoDate && (!lastVisit || new Date(latestPhotoDate) > new Date(lastVisit));
            const hasNew = hasNewPhoto || hasNewComments;
            menuBadge.classList.toggle('hidden', !hasNew);
            galleryBadge.classList.toggle('hidden', !hasNew);
        };

        const unsubSharedPhotos = onSnapshot(
            sharedPhotosQ,
            (snapshot) => {
                latestPhotoDate = snapshot.empty ? null : snapshot.docs[0].data().createdAt;
                sharedPhotosSnapshot = snapshot;
                refreshCommentWatchers();
                syncCommentBadges();
                syncGalleryBadge();
            },
            (error) => {
                console.error('Photo notification listener error:', error);
                latestPhotoDate = null;
                sharedPhotosSnapshot = null;
                refreshCommentWatchers();
                syncCommentBadges();
                syncGalleryBadge();
            }
        );
        const unsubOwnPhotos = onSnapshot(
            ownPhotosQ,
            (snapshot) => {
                ownPhotosSnapshot = snapshot;
                refreshCommentWatchers();
                syncCommentBadges();
                syncGalleryBadge();
            },
            (error) => {
                console.error('Own photo notification listener error:', error);
                ownPhotosSnapshot = null;
                refreshCommentWatchers();
                syncCommentBadges();
                syncGalleryBadge();
            }
        );

        const userDocRef = doc(db, 'users', uid);
        const unsubUser = onSnapshot(userDocRef, (snapshot) => {
            const data = snapshot.exists() ? snapshot.data() : {};
            setLastGalleryVisit(data?.lastGalleryVisit || null);
            syncCommentBadges();
            syncGalleryBadge();
        });

        const unsubFriendRequests = onSnapshot(
            friendRequestsQ,
            async (snapshot) => {
                pendingFriendRequestsCount = snapshot.size;
                syncAvatarBadge();
                const isSocialModalOpen = !document.getElementById('modalOverlay')?.classList.contains('hidden');
                if (isSocialModalOpen && typeof outgoingFriendRequestsProcessor === 'function') {
                    try {
                        await outgoingFriendRequestsProcessor();
                    } catch (error) {
                        console.error('Friend request modal refresh error:', error);
                    }
                }
            },
            (error) => {
                console.error('Friend request notification listener error:', error);
                pendingFriendRequestsCount = 0;
                syncAvatarBadge();
            }
        );

        const unsubAcceptedOutgoing = onSnapshot(
            acceptedOutgoingQ,
            async (snapshot) => {
                if (!snapshot.empty && typeof outgoingFriendRequestsProcessor === 'function') {
                    try {
                        await outgoingFriendRequestsProcessor();
                    } catch (error) {
                        console.error('Accepted outgoing request processor error:', error);
                    }
                }
            },
            (error) => {
                console.error('Accepted outgoing friend request listener error:', error);
            }
        );

        setUnsubscribeNotifications(() => {
            clearCommentWatchers();
            unsubSharedPhotos();
            unsubOwnPhotos();
            unsubUser();
            unsubFriendRequests();
            unsubAcceptedOutgoing();
        });
    };

    const setOutgoingFriendRequestsProcessor = (processor) => {
        outgoingFriendRequestsProcessor = typeof processor === 'function' ? processor : null;
    };

    return {
        googleLogin,
        googleLogout,
        initUserData,
        markOnboardingSeen,
        changeView,
        ensureGasListenerForCurrentView,
        initNotificationListener,
        setOutgoingFriendRequestsProcessor,
        clearViewSubscriptions,
        clearNotificationSubscription
    };
};
