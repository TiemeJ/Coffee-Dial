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
    let outgoingFriendRequestsProcessor = null;
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
        const publicProfileRef = doc(db, 'publicProfiles', user.uid);
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
                try {
                    await updateDoc(userDocRef, { pinnedBrews: getPinnedBrewsPreferences() });
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
                const unsub = onSnapshot(
                    latestCommentQ,
                    (snapshot) => {
                        if (snapshot.empty) latestCommentByPhotoId.delete(photoId);
                        else latestCommentByPhotoId.set(photoId, snapshot.docs[0].data() || {});
                        syncCommentBadges();
                        syncGalleryBadge();
                    },
                    (error) => {
                        console.error('Comment notification watcher error:', error);
                        latestCommentByPhotoId.delete(photoId);
                        syncCommentBadges();
                        syncGalleryBadge();
                    }
                );
                commentWatchersUnsubs.push(unsub);
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
        initNotificationListener,
        setOutgoingFriendRequestsProcessor,
        clearViewSubscriptions,
        clearNotificationSubscription
    };
};
