export const createSessionAuthViewModule = ({
    auth,
    provider,
    signInWithPopup,
    signOut,
    db,
    doc,
    setDoc,
    updateDoc,
    getDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    getCurrentUser,
    setCurrentView,
    syncFriendViewSelectValues,
    getUnsubscribeData,
    setUnsubscribeData,
    getUnsubscribeBeans,
    setUnsubscribeBeans,
    getUnsubscribeCoffeeTypes,
    setUnsubscribeCoffeeTypes,
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
    renderPinnedTiles,
    renderTable,
    updateAutocompleteLists,
    maybeMigrateBeansLeft,
    updateBeanDropdown,
    renderBeansTable,
    updateCoffeeTypeSelectors,
    renderCoffeeTypesTable,
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
    getCoffeeScale
}) => {
    const googleLogin = () => signInWithPopup(auth, provider).catch((e) => alert(e.message));

    const googleLogout = () => signOut(auth).then(() => location.reload());

    const clearViewSubscriptions = () => {
        const unsubData = getUnsubscribeData();
        const unsubBeans = getUnsubscribeBeans();
        const unsubCoffeeTypes = getUnsubscribeCoffeeTypes();
        if (unsubData) unsubData();
        if (unsubBeans) unsubBeans();
        if (unsubCoffeeTypes) unsubCoffeeTypes();
        setUnsubscribeData(null);
        setUnsubscribeBeans(null);
        setUnsubscribeCoffeeTypes(null);
    };

    const clearNotificationSubscription = () => {
        const unsub = getUnsubscribeNotifications();
        if (unsub) unsub();
        setUnsubscribeNotifications(null);
    };

    const initUserData = async (user) => {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);

        if (snap.exists()) {
            const data = snap.data();
            setIsPublic(data.isPublic || false);

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
                graphTogglePrefs: {}
            });
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
        renderTable();
    };

    const changeView = (uid) => {
        setCurrentView(uid);
        syncFriendViewSelectValues(uid);
        clearViewSubscriptions();
        setHasLoadedBrews(false);
        setHasLoadedBeans(false);

        const user = getCurrentUser();
        if (!user) return;

        const targetUid = uid === 'mine' ? user.uid : uid;
        const isMine = uid === 'mine';
        const formContainer = document.getElementById('formContainer');
        const formWrapper = document.getElementById('formWrapper');

        if (isMine) {
            formWrapper.classList.remove('hidden');
            formContainer.classList.remove('hidden');
            toggleForm(false);
        } else {
            formWrapper.classList.add('hidden');
            formContainer.classList.add('hidden');
            toggleForm(false);
        }

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
    };

    const initNotificationListener = (uid) => {
        clearNotificationSubscription();
        const q = query(collection(db, 'photos'), where('sharedWith', 'array-contains', uid), orderBy('createdAt', 'desc'), limit(1));
        setUnsubscribeNotifications(
            onSnapshot(q, (snapshot) => {
                if (!snapshot.empty) {
                    const latestPhotoDate = snapshot.docs[0].data().createdAt;
                    const lastVisit = localStorage.getItem('lastGalleryVisit');
                    const hasNew = !lastVisit || new Date(latestPhotoDate) > new Date(lastVisit);
                    document.getElementById('menuBadge').classList.toggle('hidden', !hasNew);
                    document.getElementById('galleryBadge').classList.toggle('hidden', !hasNew);
                }
            })
        );
    };

    return {
        googleLogin,
        googleLogout,
        initUserData,
        changeView,
        initNotificationListener,
        clearViewSubscriptions,
        clearNotificationSubscription
    };
};
