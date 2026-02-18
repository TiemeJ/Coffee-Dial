export const createGalleryModule = ({
    getCurrentUser,
    getCurrentUploadCoffeeId,
    setCurrentUploadCoffeeId,
    getLastGalleryVisit,
    setLastGalleryVisit,
    getCurrentGalleryMode,
    setCurrentGalleryMode,
    getLastGalleryDoc,
    setLastGalleryDoc,
    getIsGalleryLoading,
    setIsGalleryLoading,
    getFollowing,
    getCoffees,
    getCoffeeTypeDisplay,
    dataService,
    storageService,
    imageCompression,
    getStarDisplay,
    openAppConfirm
}) => {
    const { db, addDoc, collection, query, where, orderBy, limit, startAfter, getDocs, doc, updateDoc, deleteDoc } = dataService || {};
    const { storage, ref, uploadBytes, getDownloadURL, deleteObject } = storageService || {};
    if (!db || !addDoc || !collection || !query || !where || !orderBy || !limit || !startAfter || !getDocs || !doc || !updateDoc || !deleteDoc) {
        throw new Error('createGalleryModule requires dataService { db, addDoc, collection, query, where, orderBy, limit, startAfter, getDocs, doc, updateDoc, deleteDoc }');
    }
    if (!storage || !ref || !uploadBytes || !getDownloadURL || !deleteObject) {
        throw new Error('createGalleryModule requires storageService { storage, ref, uploadBytes, getDownloadURL, deleteObject }');
    }
    const isMissingValue = (value) => {
        const normalized = (value ?? '').toString().trim();
        return !normalized || normalized === '-' || normalized.toLowerCase() === 'unknown';
    };
    const resolveCoffeeSnapshot = (coffeeData) => {
        const typeDisplay = typeof getCoffeeTypeDisplay === 'function'
            ? getCoffeeTypeDisplay(coffeeData)
            : null;
        return {
            roaster: typeDisplay?.roaster || coffeeData?.roaster || coffeeData?.name || 'Unknown',
            origin: typeDisplay?.origin || coffeeData?.origin || coffeeData?.beanType || 'Unknown',
            farmer: typeDisplay?.farmer || coffeeData?.farmer || '-',
            method: coffeeData?.method || '-',
            rating: coffeeData?.rating || 0
        };
    };
    const resolveSnapshotForCard = (data) => {
        const snapshot = data?.coffeeSnapshot || {};
        if (!data?.coffeeId) return snapshot;
        const coffeeData = getCoffees().find((coffee) => coffee.id === data.coffeeId);
        if (!coffeeData) return snapshot;
        const resolved = resolveCoffeeSnapshot(coffeeData);
        return {
            ...snapshot,
            roaster: isMissingValue(snapshot.roaster) ? resolved.roaster : snapshot.roaster,
            farmer: isMissingValue(snapshot.farmer) ? resolved.farmer : snapshot.farmer,
            origin: isMissingValue(snapshot.origin) ? resolved.origin : snapshot.origin,
            method: isMissingValue(snapshot.method) ? resolved.method : snapshot.method,
            rating: typeof snapshot.rating === 'number' ? snapshot.rating : resolved.rating
        };
    };
    const openUploadModal = (coffeeId) => {
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        setCurrentUploadCoffeeId(coffeeId);
        document.getElementById('uploadPhotoModal')?.classList.remove('hidden');
        const file = document.getElementById('photoInput');
        const msg = document.getElementById('photoMessage');
        const progress = document.getElementById('uploadProgress');
        if (file) file.value = '';
        if (msg) msg.value = '';
        progress?.classList.add('hidden');

        const list = document.getElementById('shareWithList');
        if (!list) return;
        list.innerHTML = '';
        const following = getFollowing();
        if (!following.length) {
            list.innerHTML = '<span class="text-xs text-gray-400 italic">No friends followed yet.</span>';
        } else {
            following.forEach((f) => {
                const div = document.createElement('div');
                div.className = 'flex items-center justify-between p-2 rounded bg-coffee-50 dark:bg-[#1c1917] border border-coffee-100 dark:border-[#44403c]';
                div.innerHTML = `<span class="text-sm font-medium text-coffee-800 dark:text-[#d6ccc2]">${f.name || f.uid}</span><div class="relative inline-block w-10 align-middle select-none transition duration-200 ease-in"><input type="checkbox" id="share_${f.uid}" value="${f.uid}" checked class="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer border-gray-300 dark:border-gray-600"/><label for="share_${f.uid}" class="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 dark:bg-gray-700 cursor-pointer"></label></div>`;
                list.appendChild(div);
            });
        }
    };

    const toggleAllFriends = (state) => {
        const checkboxes = document.querySelectorAll('#shareWithList input[type="checkbox"]');
        checkboxes.forEach((cb) => {
            cb.checked = state;
        });
    };

    const closeUploadModal = () => {
        document.getElementById('uploadPhotoModal')?.classList.add('hidden');
    };

    const handlePhotoSubmit = async () => {
        const user = getCurrentUser();
        if (!user) return;
        const fileInput = document.getElementById('photoInput');
        const file = fileInput?.files?.[0];
        const message = document.getElementById('photoMessage')?.value || '';
        if (!file) return alert('Please select a photo.');

        const uploadCoffeeId = getCurrentUploadCoffeeId();
        if (!uploadCoffeeId) return;

        const checkboxes = document.querySelectorAll('#shareWithList input[type="checkbox"]:checked');
        const sharedWith = Array.from(checkboxes).map((cb) => cb.value);
        const coffeeData = getCoffees().find((c) => c.id === uploadCoffeeId);
        if (!coffeeData) return alert('Coffee data not found.');

        const coffeeSnapshot = resolveCoffeeSnapshot(coffeeData);

        document.getElementById('uploadProgress')?.classList.remove('hidden');

        try {
            const timestamp = Date.now();
            const storageRef = ref(storage, `photos/${user.uid}/${timestamp}_${file.name}_original`);
            const originalOptions = { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true };
            const compressedOriginal = await imageCompression(file, originalOptions);
            const snapshot = await uploadBytes(storageRef, compressedOriginal);
            const downloadURL = await getDownloadURL(snapshot.ref);

            let thumbURL = null;
            const thumbOptions = { maxSizeMB: 0.1, maxWidthOrHeight: 600, useWebWorker: true };
            try {
                const thumbFile = await imageCompression(file, thumbOptions);
                const thumbRef = ref(storage, `photos/${user.uid}/${timestamp}_${file.name}_thumb`);
                const thumbSnapshot = await uploadBytes(thumbRef, thumbFile);
                thumbURL = await getDownloadURL(thumbSnapshot.ref);
            } catch (error) {
                console.log('Thumbnail generation failed:', error);
            }

            await addDoc(collection(db, 'photos'), {
                uid: user.uid,
                uploaderName: user.displayName || 'Unknown User',
                photoURL: downloadURL,
                thumbURL,
                message,
                coffeeId: uploadCoffeeId,
                coffeeSnapshot,
                sharedWith,
                createdAt: new Date().toISOString()
            });
            closeUploadModal();
            alert('Photo uploaded successfully!');
        } catch (error) {
            console.error('Upload failed', error);
            alert(`Upload failed: ${error.message}`);
        }
    };

    const openGallery = async () => {
        document.getElementById('galleryModal')?.classList.remove('hidden');
        const hasNotification = !document.getElementById('galleryBadge')?.classList.contains('hidden');
        const user = getCurrentUser();
        const nowIso = new Date().toISOString();
        setLastGalleryVisit(nowIso);
        if (user) {
            try {
                await updateDoc(doc(db, 'users', user.uid), { lastGalleryVisit: nowIso });
            } catch (error) {
                console.error('Failed to update last gallery visit', error);
            }
        }
        document.getElementById('menuBadge')?.classList.add('hidden');
        document.getElementById('galleryBadge')?.classList.add('hidden');
        if (hasNotification) switchGalleryTab('shared');
        else switchGalleryTab('mine');
        setLastGalleryDoc(null);
        document.getElementById('galleryGrid').innerHTML = '';
        document.getElementById('galleryEmpty')?.classList.add('hidden');
        document.getElementById('galleryLoadMore')?.classList.add('hidden');
        loadMoreGallery();
    };

    const switchGalleryTab = async (tab) => {
        const tMine = document.getElementById('tabGalleryMine');
        const tShared = document.getElementById('tabGalleryShared');
        setCurrentGalleryMode(tab);
        setLastGalleryDoc(null);
        document.getElementById('galleryGrid').innerHTML = '';
        document.getElementById('galleryEmpty')?.classList.add('hidden');
        document.getElementById('galleryLoadMore')?.classList.add('hidden');

        if (tab === 'mine') {
            tMine.classList.add('bg-coffee-50', 'dark:bg-[#1c1917]', 'text-coffee-700', 'dark:text-[#d6ccc2]');
            tMine.classList.remove('text-coffee-500', 'dark:text-[#78716c]');
            tShared.classList.remove('bg-coffee-50', 'dark:bg-[#1c1917]', 'text-coffee-700', 'dark:text-[#d6ccc2]');
            tShared.classList.add('text-coffee-500', 'dark:text-[#78716c]');
        } else {
            tShared.classList.add('bg-coffee-50', 'dark:bg-[#1c1917]', 'text-coffee-700', 'dark:text-[#d6ccc2]');
            tShared.classList.remove('text-coffee-500', 'dark:text-[#78716c]');
            tMine.classList.remove('bg-coffee-50', 'dark:bg-[#1c1917]', 'text-coffee-700', 'dark:text-[#d6ccc2]');
            tMine.classList.add('text-coffee-500', 'dark:text-[#78716c]');
        }
        loadMoreGallery();
    };

    const loadMoreGallery = async () => {
        if (getIsGalleryLoading()) return;
        setIsGalleryLoading(true);
        const btn = document.getElementById('galleryLoadMore');
        const empty = document.getElementById('galleryEmpty');
        try {
            let q;
            const constraints = [orderBy('createdAt', 'desc'), limit(9)];
            if (getLastGalleryDoc()) constraints.push(startAfter(getLastGalleryDoc()));

            const user = getCurrentUser();
            if (getCurrentGalleryMode() === 'mine') q = query(collection(db, 'photos'), where('uid', '==', user.uid), ...constraints);
            else q = query(collection(db, 'photos'), where('sharedWith', 'array-contains', user.uid), ...constraints);

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                setLastGalleryDoc(snapshot.docs[snapshot.docs.length - 1]);
                renderGalleryGrid(snapshot.docs);
                if (snapshot.docs.length < 9) btn.classList.add('hidden');
                else btn.classList.remove('hidden');
            } else {
                btn.classList.add('hidden');
                if (!getLastGalleryDoc()) empty.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Error loading gallery photos:', error);
            btn?.classList.add('hidden');
            if (!getLastGalleryDoc()) empty?.classList.remove('hidden');
        }
        setIsGalleryLoading(false);
    };

    const renderGalleryGrid = (docs) => {
        const grid = document.getElementById('galleryGrid');
        docs.forEach((docItem) => {
            const data = docItem.data();
            const cardSnapshot = resolveSnapshotForCard(data);
            const card = document.createElement('div');
            card.className = 'bg-white dark:bg-[#292524] rounded-lg shadow-md overflow-hidden border border-coffee-200 dark:border-[#44403c] flex flex-col relative group';
            const ratingHtml = getStarDisplay(cardSnapshot.rating || 0);
            const displayUrl = data.thumbURL || data.photoURL;
            const escapedPhotoUrl = String(data.photoURL || '').replace(/'/g, "\\'");
            const escapedThumbUrl = String(data.thumbURL || '').replace(/'/g, "\\'");
            const deleteBtn = getCurrentGalleryMode() === 'mine'
                ? `<button data-action-click="deletePhoto('${docItem.id}', '${escapedPhotoUrl}', '${escapedThumbUrl}', event)" class="absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all z-10 opacity-0 group-hover:opacity-100" title="Delete Photo"><i class="fa-solid fa-trash-can text-xs"></i></button>`
                : '';
            const primaryInfo = cardSnapshot.farmer || '-';
            const secondaryInfo = cardSnapshot.roaster || cardSnapshot.origin || '-';
            card.innerHTML = `${deleteBtn}<div class="h-48 overflow-hidden bg-gray-100 dark:bg-gray-800 relative cursor-pointer"><img src="${displayUrl}" loading="lazy" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="Brew Photo" data-action-click="openExternalUrl('${escapedPhotoUrl}')"><div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-xs">${new Date(data.createdAt).toLocaleDateString()}</div></div><div class="p-3 flex-1 flex flex-col"><div class="flex justify-between items-start mb-2"><span class="text-xs font-bold text-coffee-500 dark:text-[#78716c] uppercase">${data.uploaderName}</span><div class="text-xs">${ratingHtml}</div></div><p class="text-sm italic text-gray-700 dark:text-gray-300 mb-3 flex-1">"${data.message || ''}"</p><div class="bg-coffee-50 dark:bg-[#1c1917] rounded p-2 text-xs border border-coffee-100 dark:border-[#44403c]"><div class="font-bold text-coffee-800 dark:text-white truncate">${primaryInfo}</div><div class="text-coffee-600 dark:text-[#a8a29e] truncate">${secondaryInfo}</div><div class="mt-1 inline-block px-1.5 py-0.5 bg-white dark:bg-[#292524] rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] font-mono text-[10px]">${cardSnapshot.method}</div></div></div>`;
            grid.appendChild(card);
        });
    };

    const deletePhoto = async (photoId, photoURL, thumbURL, ev) => {
        if (ev) ev.stopPropagation();
        const shouldDelete = await openAppConfirm({
            title: 'Delete photo?',
            message: 'This permanently deletes the photo and cannot be undone.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!shouldDelete) return;
        try {
            await deleteDoc(doc(db, 'photos', photoId));
            const photoRef = ref(storage, photoURL);
            await deleteObject(photoRef);
            if (thumbURL) {
                const thumbRef = ref(storage, thumbURL);
                await deleteObject(thumbRef);
            }
            alert('Photo deleted successfully.');
            openGallery();
        } catch (err) {
            console.error('Deletion failed', err);
            alert(`Error deleting photo: ${err.message}`);
        }
    };

    return {
        openUploadModal,
        toggleAllFriends,
        closeUploadModal,
        handlePhotoSubmit,
        openGallery,
        switchGalleryTab,
        loadMoreGallery,
        renderGalleryGrid,
        deletePhoto
    };
};
