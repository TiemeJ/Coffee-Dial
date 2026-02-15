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
    maybeMigrateBeansLeft,
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
    loadLegacyPinnedBrewsPreferences,
    applyAnimationPreference,
    setIsPublic,
    updatePublicToggleUI,
    getCoffeeScale,
    refreshBrewGearSelectors,
    getLastGalleryVisit,
    setLastGalleryVisit,
    applyBrewFormInlineVisibility
}) => {
    const { auth, provider, signInWithPopup, signOut } = authService || {};
    const { db, doc, setDoc, updateDoc, getDoc, collection, query, where, orderBy, limit, onSnapshot } = dataService || {};
    if (!auth || !provider || !signInWithPopup || !signOut) {
        throw new Error('createSessionAuthViewModule requires authService { auth, provider, signInWithPopup, signOut }');
    }
    if (!db || !doc || !setDoc || !updateDoc || !getDoc || !collection || !query || !where || !orderBy || !limit || !onSnapshot) {
        throw new Error('createSessionAuthViewModule requires dataService { db, doc, setDoc, updateDoc, getDoc, collection, query, where, orderBy, limit, onSnapshot }');
    }
    const googleLogin = () => signInWithPopup(auth, provider).catch((e) => alert(e.message));

    const googleLogout = () => signOut(auth).then(() => location.reload());

    const clearViewSubscriptions = () => {
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

    const clearNotificationSubscription = () => {
        const unsub = getUnsubscribeNotifications();
        if (unsub) unsub();
        setUnsubscribeNotifications(null);
    };

    const initUserData = async (user) => {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);
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
                const legacyPinned = loadLegacyPinnedBrewsPreferences();
                if (legacyPinned) {
                    setPinnedBrewsPreferences({ ...getPinnedBrewsPreferences(), ...legacyPinned });
                }
                try {
                    await updateDoc(userDocRef, { pinnedBrews: getPinnedBrewsPreferences() });
                    localStorage.removeItem('animationsEnabled');
                    localStorage.removeItem('organizeByBeans');
                    localStorage.removeItem('pinOpenBags');
                } catch (err) {
                    console.error('Error saving pinned preferences', err);
                }
            }

            if (data.displayName !== user.displayName) {
                await updateDoc(userDocRef, { displayName: user.displayName });
            }
        } else {
            loadColumnPreferencesFromStorage();
            await setDoc(userDocRef, {
                isPublic: false,
                displayName: user.displayName,
                pinnedBrews: getPinnedBrewsPreferences(),
                graphTogglePrefs: {},
                onboardingSeen: false,
                lastGalleryVisit: null
            });
            shouldShowOnboarding = true;
            setLastGalleryVisit(null);
            const coffeeScale = getCoffeeScale?.();
            if (coffeeScale?.setGraphTogglePrefs) {
                coffeeScale.setGraphTogglePrefs({});
            }
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
        document.getElementById('myShareId').value = user.uid;
        applyBrewFormInlineVisibility?.();
        renderTable();
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

    const changeView = (uid) => {
        setCurrentView(uid);
        syncFriendViewSelectValues(uid);
        clearViewSubscriptions();
        setHasLoadedBrews(false);
        setHasLoadedBeans(false);

        const user = getCurrentUser();
        if (!user) return;

        const isMine = uid === 'mine';
        const targetUid = isMine ? user.uid : uid;
        applyBrewFormInlineVisibility?.();

        const brewsRef = collection(db, 'users', targetUid, 'coffees');
        setUnsubscribeData(
            onSnapshot(
                brewsRef,
                (snapshot) => {
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
                    if (isMine) maybeMigrateBeansLeft();
                },
                (error) => {
                    console.error(error);
                    if (error.code === 'permission-denied') {
                        alert('⚠️ Access Denied: This user\'s profile is private.');
                        syncFriendViewSelectValues('mine');
                        changeView('mine');
                    }
                }
            )
        );

        const beansRef = collection(db, 'users', targetUid, 'beans');
        setUnsubscribeBeans(
            onSnapshot(
                beansRef,
                (snapshot) => {
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
                    if (isMine) maybeMigrateBeansLeft();
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

        const gasRef = collection(db, 'users', targetUid, 'gear');
        setUnsubscribeGas(
            onSnapshot(
                gasRef,
                (snapshot) => {
                    const nextGasItems = [];
                    snapshot.forEach((docSnap) => nextGasItems.push({ id: docSnap.id, ...docSnap.data() }));
                    setGasItems(nextGasItems);
                    if (refreshBrewGearSelectors) refreshBrewGearSelectors();
                    if (!document.getElementById('gasModal').classList.contains('hidden')) {
                        renderGasTable();
                    }
                },
                (error) => {
                    console.error('Error loading gas list:', error);
                    setGasItems([]);
                    if (refreshBrewGearSelectors) refreshBrewGearSelectors();
                    if (!document.getElementById('gasModal').classList.contains('hidden')) {
                        renderGasTable();
                    }
                }
            )
        );
    };

    const initNotificationListener = (uid) => {
        clearNotificationSubscription();
        const q = query(collection(db, 'photos'), where('sharedWith', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(1));
        let latestPhotoDate = null;

        const syncGalleryBadge = () => {
            const menuBadge = document.getElementById('menuBadge');
            const galleryBadge = document.getElementById('galleryBadge');
            if (!menuBadge || !galleryBadge) return;
            if (!latestPhotoDate) {
                menuBadge.classList.add('hidden');
                galleryBadge.classList.add('hidden');
                return;
            }
            const lastVisit = getLastGalleryVisit();
            const hasNew = !lastVisit || new Date(latestPhotoDate) > new Date(lastVisit);
            menuBadge.classList.toggle('hidden', !hasNew);
            galleryBadge.classList.toggle('hidden', !hasNew);
        };

        const unsubPhotos = onSnapshot(q, (snapshot) => {
            latestPhotoDate = snapshot.empty ? null : snapshot.docs[0].data().createdAt;
            syncGalleryBadge();
        });

        const userDocRef = doc(db, 'users', uid);
        const unsubUser = onSnapshot(userDocRef, (snapshot) => {
            const data = snapshot.exists() ? snapshot.data() : {};
            setLastGalleryVisit(data?.lastGalleryVisit || null);
            syncGalleryBadge();
        });

        setUnsubscribeNotifications(() => {
            unsubPhotos();
            unsubUser();
        });
    };

    return {
        googleLogin,
        googleLogout,
        initUserData,
        markOnboardingSeen,
        changeView,
        initNotificationListener,
        clearViewSubscriptions,
        clearNotificationSubscription
    };
};
