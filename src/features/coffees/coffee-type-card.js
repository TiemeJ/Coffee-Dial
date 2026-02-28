import { createCoffeesVmModule } from './coffees.vm.js';

export const createCoffeeTypeCardModule = ({
    getCurrentUser,
    getCurrentView,
    getCurrentCoffeeTypeId,
    setCurrentCoffeeTypeId,
    getCoffeeTypes,
    setCoffeeTypesState,
    getBeans,
    setBeansState,
    dataService,
    storageService,
    imageCompression,
    removeCoffeeImageBackground,
    openAppConfirm,
    getStarDisplay,
    renderCoffeeTypesTable,
    updateCoffeeTypeSelectors,
    renderPinnedTiles,
    dispatchCommand,
    openCoffeeTypeShopUrl,
    openNewBagForCoffeeType,
    updateCoffeeTypeCardNav,
    openLightbox
}) => {
    const { db, doc, updateDoc, writeBatch } = dataService || {};
    const { storage, ref, uploadBytes, getDownloadURL, deleteObject } = storageService || {};
    if (!db || !doc || !updateDoc || !writeBatch) {
        throw new Error('createCoffeeTypeCardModule requires dataService { db, doc, updateDoc, writeBatch }');
    }
    if (!storage || !ref || !uploadBytes || !getDownloadURL || !deleteObject) {
        throw new Error('createCoffeeTypeCardModule requires storageService { storage, ref, uploadBytes, getDownloadURL, deleteObject }');
    }
    if (typeof imageCompression !== 'function') {
        throw new Error('createCoffeeTypeCardModule requires imageCompression(file, options)');
    }
    const coffeesVm = createCoffeesVmModule();
    const getCurrentType = () => getCoffeeTypes().find((ct) => ct.id === getCurrentCoffeeTypeId());
    const setImageLoaderVisible = (visible) => {
        const loader = document.getElementById('coffeeTypeCardImageLoader');
        if (!loader) return;
        loader.classList.toggle('hidden', !visible);
    };
    const dispatchOnly = (commandName, payload) => {
        if (typeof dispatchCommand !== 'function') return undefined;
        try {
            return dispatchCommand(commandName, payload);
        } catch (error) {
            console.warn(`[Coffees] Command "${commandName}" failed`, error);
            return undefined;
        }
    };

    const showBeansForCoffeeTypeFromTable = (typeId) => {
        dispatchOnly('beans.showForCoffeeType', { coffeeTypeId: typeId, source: 'coffees.table' });
    };

    const showBrewsForCoffeeTypeFromTable = (typeId) => {
        dispatchOnly('brews.showForCoffeeType', { coffeeTypeId: typeId, source: 'coffees.table' });
    };

    const openNewBagForCoffeeTypeFromTable = (typeId) => {
        setCurrentCoffeeTypeId(typeId);
        openNewBagForCoffeeType();
    };

    const openCoffeeTypeFromTableEdit = (typeId) => {
        openCoffeeTypeCard(typeId);
        enterCoffeeTypeEditMode();
    };

    const deleteCoffeeTypeFromTable = (typeId) => {
        setCurrentCoffeeTypeId(typeId);
        deleteCoffeeType();
    };

    const deleteCoffeeType = async () => {
        const user = getCurrentUser();
        const typeId = getCurrentCoffeeTypeId();
        if (!user || !typeId) return;

        const shouldDelete = await openAppConfirm({
            title: 'Delete coffee?',
            message: 'Beans linked to this coffee will be unlinked.',
            confirmLabel: 'Delete',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!shouldDelete) return;

        const nowIso = new Date().toISOString();

        try {
            const batch = writeBatch(db);
            getBeans()
                .filter((bean) => bean.coffeeTypeId === typeId)
                .forEach((bean) => {
                    batch.update(doc(db, 'users', user.uid, 'beans', bean.id), { coffeeTypeId: null, updatedAt: nowIso });
                });
            batch.delete(doc(db, 'users', user.uid, 'coffeeTypes', typeId));
            await batch.commit();

            setCoffeeTypesState(getCoffeeTypes().filter((ct) => ct.id !== typeId));
            setBeansState(
                getBeans().map((bean) =>
                    bean.coffeeTypeId === typeId ? { ...bean, coffeeTypeId: null, updatedAt: nowIso } : bean
                )
            );
            updateCoffeeTypeSelectors();
            renderCoffeeTypesTable();
            closeCoffeeTypeCard(null);
            renderPinnedTiles();
            dispatchOnly('brews.refreshTable', { source: 'coffees.deleteCoffeeType' });
        } catch (err) {
            console.error('Error deleting coffee:', err);
            alert('Failed to delete coffee.');
        }
    };

    const triggerCoffeeTypePhoto = (e) => {
        if (e) e.stopPropagation();
        if (!getCurrentCoffeeTypeId()) return;
        document.getElementById('coffeeTypePhotoInput')?.click();
    };

    const openCoffeeTypePhoto = (e) => {
        if (e) e.stopPropagation();
        const type = getCurrentType();
        const url = type?.imageUrl || type?.imageURL;
        if (!url) return;
        if (typeof openLightbox === 'function') {
            openLightbox({
                items: [{ url, alt: 'Coffee type photo' }],
                startIndex: 0
            });
            return;
        }
        window.open(url, '_blank');
    };

    const removeCoffeeTypePhoto = async (e) => {
        if (e) e.stopPropagation();
        const user = getCurrentUser();
        const typeId = getCurrentCoffeeTypeId();
        if (!user || !typeId) return;

        const type = getCurrentType();
        const url = type?.imageUrl || type?.imageURL;
        if (!url) return;

        try {
            const photoRef = ref(storage, url);
            await deleteObject(photoRef);
            await updateDoc(doc(db, 'users', user.uid, 'coffeeTypes', typeId), {
                imageUrl: null,
                updatedAt: new Date().toISOString()
            });
            setCoffeeTypesState(
                getCoffeeTypes().map((ct) =>
                    ct.id === typeId ? { ...ct, imageUrl: null, imageURL: null } : ct
                )
            );
            openCoffeeTypeCard(typeId);
        } catch (err) {
            console.error('Remove coffee photo failed:', err);
            alert('Failed to remove image.');
        }
    };

    const replaceCoffeeTypePhotoWithBackgroundRemoved = async (e) => {
        if (e) e.stopPropagation();
        const user = getCurrentUser();
        const typeId = getCurrentCoffeeTypeId();
        if (!user || !typeId) return;
        if (typeof removeCoffeeImageBackground !== 'function') {
            alert('Background removal integration is unavailable.');
            return;
        }

        const type = getCurrentType();
        const url = type?.imageUrl || type?.imageURL;
        if (!url) return;

        const imageSection = document.getElementById('coffeeTypeCardImageSection');
        const originalClasses = imageSection?.className || '';

        try {
            if (imageSection) imageSection.classList.add('ai-loading-pulse');
            setImageLoaderVisible(true);
            const sourceResponse = await fetch(url, { cache: 'no-store' });
            if (!sourceResponse.ok) {
                throw new Error(`Could not load current image (${sourceResponse.status}).`);
            }

            const sourceBlob = await sourceResponse.blob();
            const sourceType = `${sourceBlob?.type || ''}`.toLowerCase();
            const sourceExt = sourceType.includes('png') ? 'png' : (sourceType.includes('webp') ? 'webp' : 'jpg');
            const sourceFile = new File(
                [sourceBlob],
                `coffee_type_${typeId}.${sourceExt}`,
                { type: sourceBlob.type || 'image/jpeg', lastModified: Date.now() }
            );

            const bgRemovedFile = await removeCoffeeImageBackground(sourceFile, {
                source: 'coffees.replaceCoffeeTypePhotoWithBackgroundRemoved',
                force: true
            });

            const timestamp = Date.now();
            const storageRef = ref(storage, `photos/${user.uid}/coffee_type_${typeId}_${timestamp}`);
            const snapshot = await uploadBytes(storageRef, bgRemovedFile);
            const downloadURL = await getDownloadURL(snapshot.ref);
            await updateDoc(doc(db, 'users', user.uid, 'coffeeTypes', typeId), {
                imageUrl: downloadURL,
                updatedAt: new Date().toISOString()
            });
            setCoffeeTypesState(
                getCoffeeTypes().map((ct) => (ct.id === typeId ? { ...ct, imageUrl: downloadURL } : ct))
            );
            try {
                const oldRef = ref(storage, url);
                await deleteObject(oldRef);
            } catch (_) {}
            openCoffeeTypeCard(typeId);
        } catch (err) {
            const message = `${err?.message || err || ''}`.trim();
            if (message === 'Enter your remove.bg API key in Preferences > Integrations.') {
                await openAppConfirm?.({
                    title: 'remove.bg API key required',
                    message,
                    confirmLabel: 'OK',
                    danger: false,
                    showCancel: false
                });
            } else {
                console.error('Coffee background removal failed:', err);
                alert(`Failed to remove background: ${message || 'Unknown error'}`);
            }
        } finally {
            if (imageSection && originalClasses) imageSection.className = originalClasses;
            setImageLoaderVisible(false);
        }
    };

    const handleCoffeeTypePhoto = async (event) => {
        const file = event.target.files?.[0];
        const user = getCurrentUser();
        const typeId = getCurrentCoffeeTypeId();
        if (!file || !user || !typeId) return;

        const btn = document.getElementById('coffeeTypeCardImageSection');
        const targetEl = btn || document.getElementById('coffeeTypeCardView');
        const originalClasses = targetEl?.className;

        try {
            if (targetEl) targetEl.classList.add('ai-loading-pulse');
            setImageLoaderVisible(true);
            const options = { maxSizeMB: 0.6, maxWidthOrHeight: 1200, useWebWorker: true };
            const compressedFile = await imageCompression(file, options);
            const timestamp = Date.now();
            const storageRef = ref(storage, `photos/${user.uid}/coffee_type_${typeId}_${timestamp}`);
            const snapshot = await uploadBytes(storageRef, compressedFile);
            const downloadURL = await getDownloadURL(snapshot.ref);
            await updateDoc(doc(db, 'users', user.uid, 'coffeeTypes', typeId), {
                imageUrl: downloadURL,
                updatedAt: new Date().toISOString()
            });
            setCoffeeTypesState(
                getCoffeeTypes().map((ct) => (ct.id === typeId ? { ...ct, imageUrl: downloadURL } : ct))
            );
            openCoffeeTypeCard(typeId);
        } catch (err) {
            console.error('Coffee photo upload failed:', err);
            alert(`Failed to upload image: ${err?.message || err}`);
        } finally {
            if (targetEl && originalClasses) targetEl.className = originalClasses;
            setImageLoaderVisible(false);
            event.target.value = '';
        }
    };

    const openCoffeeTypeCard = (typeId, ev) => {
        if (ev) ev.stopPropagation();
        const type = getCoffeeTypes().find((ct) => ct.id === typeId);
        if (!type) return;

        setCurrentCoffeeTypeId(type.id);
        const isMine = getCurrentView() === 'mine';
        const cardVm = coffeesVm.toCardView(type);

        document.getElementById('coffeeTypeCardTitle').textContent = cardVm.farmer;
        document.getElementById('coffeeTypeCardSubtitle').textContent = cardVm.roaster;
        document.getElementById('coffeeTypeCardRating').innerHTML = cardVm.rating > 0 ? getStarDisplay(cardVm.rating) : '';
        document.getElementById('coffeeTypeCardOrigin').textContent = cardVm.origin;
        document.getElementById('coffeeTypeCardRoast').textContent = cardVm.roast;
        document.getElementById('coffeeTypeCardProcess').textContent = cardVm.processing;
        document.getElementById('coffeeTypeCardVariety').textContent = cardVm.variety;
        document.getElementById('coffeeTypeCardCreated').textContent = cardVm.createdAt;
        document.getElementById('coffeeTypeCardTasteNotes').textContent = cardVm.tasteNotes || '-';
        document.getElementById('coffeeTypeCardDecafIcon')?.classList.toggle('hidden', !cardVm.decaf);

        const imageUrl = cardVm.imageUrl;
        const imgEl = document.getElementById('coffeeTypeCardImage');
        const placeholderEl = document.getElementById('coffeeTypeCardImagePlaceholder');
        if (imageUrl) {
            imgEl.src = imageUrl;
            imgEl.classList.remove('hidden');
            placeholderEl.classList.add('hidden');
        } else {
            imgEl.src = '';
            imgEl.classList.add('hidden');
            placeholderEl.classList.remove('hidden');
        }
        document.getElementById('coffeeTypeRemoveBgBtn')?.classList.toggle('hidden', !imageUrl);

        const buyBtn = document.getElementById('coffeeTypeCardBuyBtn');
        const buyActionBtn = document.getElementById('coffeeTypeCardActionBuy');
        const newBagBtn = document.getElementById('coffeeTypeCardNewBagBtn');
        const newBagActionBtn = document.querySelector('#coffeeTypeCardActionMenu button[onclick*="openNewBagForCoffeeType"]');
        const shopUrl = cardVm.shopUrl;

        if (buyBtn) {
            if (shopUrl) {
                buyBtn.disabled = false;
                buyBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                buyBtn.onclick = () => openCoffeeTypeShopUrl(type.id);
            } else {
                buyBtn.disabled = true;
                buyBtn.classList.add('opacity-40', 'cursor-not-allowed');
                buyBtn.onclick = null;
            }
        }

        if (buyActionBtn) {
            if (shopUrl) {
                buyActionBtn.disabled = false;
                buyActionBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                buyActionBtn.onclick = () => openCoffeeTypeShopUrl(type.id);
            } else {
                buyActionBtn.disabled = true;
                buyActionBtn.classList.add('opacity-40', 'cursor-not-allowed');
                buyActionBtn.onclick = null;
            }
        }

        if (newBagBtn) newBagBtn.classList.toggle('hidden', !isMine);
        if (newBagActionBtn) newBagActionBtn.classList.toggle('hidden', !isMine);

        document.getElementById('coffeeTypeCardView').classList.remove('hidden');
        document.getElementById('coffeeTypeCardEdit').classList.add('hidden');
        document.getElementById('coffeeTypeCardEditBtn').classList.toggle('hidden', !isMine);
        document.getElementById('coffeeTypeCardMenuBtn').classList.toggle('hidden', !isMine);
        updateCoffeeTypeCardNav();
        document.getElementById('coffeeTypeCardOverlay').classList.remove('hidden');
    };

    const closeCoffeeTypeCard = (event) => {
        if (event && event.target !== event.currentTarget) return;
        document.getElementById('coffeeTypeCardEdit').classList.add('hidden');
        document.getElementById('coffeeTypeCardView').classList.remove('hidden');
        document.getElementById('coffeeTypeCardEditBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('coffeeTypeCardMenuBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('coffeeTypeCardOverlay').classList.add('hidden');
    };

    const enterCoffeeTypeEditMode = () => {
        const type = getCurrentType();
        if (!type) return;

        document.getElementById('coffeeTypeEditFarmer').value = type.farmer || '';
        document.getElementById('coffeeTypeEditRoaster').value = type.roaster || '';
        document.getElementById('coffeeTypeEditOrigin').value = type.origin || '';
        document.getElementById('coffeeTypeEditProcessing').value = type.processing || '';
        document.getElementById('coffeeTypeEditVariety').value = type.variety || '';
        document.getElementById('coffeeTypeEditRoast').value = type.roast || type.roastType || '';
        document.getElementById('coffeeTypeEditRating').value = parseInt(type.rating, 10) || '';
        document.getElementById('coffeeTypeEditDecaf').checked = !!type.decaf;
        document.getElementById('coffeeTypeEditShopUrl').value = type.webshopUrl || type.shopUrl || '';
        document.getElementById('coffeeTypeEditTasteNotes').value = type.tasteNotes || '';

        document.getElementById('coffeeTypeCardView').classList.add('hidden');
        document.getElementById('coffeeTypeCardEdit').classList.remove('hidden');
        document.getElementById('coffeeTypeCardEditBtn').classList.add('hidden');
        document.getElementById('coffeeTypeCardMenuBtn').classList.add('hidden');
        document.getElementById('coffeeTypeCardActionMenu').classList.add('hidden');
    };

    const cancelCoffeeTypeEditMode = () => {
        document.getElementById('coffeeTypeCardEdit').classList.add('hidden');
        document.getElementById('coffeeTypeCardView').classList.remove('hidden');
        document.getElementById('coffeeTypeCardEditBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
        document.getElementById('coffeeTypeCardMenuBtn').classList.toggle('hidden', getCurrentView() !== 'mine');
    };

    const saveCoffeeTypeEdits = async () => {
        const user = getCurrentUser();
        const typeId = getCurrentCoffeeTypeId();
        if (!user || !typeId) return;

        const nowIso = new Date().toISOString();
        const updates = {
            farmer: document.getElementById('coffeeTypeEditFarmer').value || '',
            roaster: document.getElementById('coffeeTypeEditRoaster').value || '',
            origin: document.getElementById('coffeeTypeEditOrigin').value || '',
            processing: document.getElementById('coffeeTypeEditProcessing').value || '',
            variety: document.getElementById('coffeeTypeEditVariety').value || '',
            roast: document.getElementById('coffeeTypeEditRoast').value || '',
            rating: parseInt(document.getElementById('coffeeTypeEditRating').value, 10) || 0,
            decaf: !!document.getElementById('coffeeTypeEditDecaf').checked,
            webshopUrl: document.getElementById('coffeeTypeEditShopUrl').value || '',
            tasteNotes: document.getElementById('coffeeTypeEditTasteNotes').value || '',
            updatedAt: nowIso
        };

        try {
            await updateDoc(doc(db, 'users', user.uid, 'coffeeTypes', typeId), updates);
            setCoffeeTypesState(getCoffeeTypes().map((ct) => (ct.id === typeId ? { ...ct, ...updates } : ct)));
            renderCoffeeTypesTable();
            openCoffeeTypeCard(typeId);
        } catch (err) {
            console.error('Error saving coffee edits:', err);
            alert('Failed to save changes.');
        }
    };

    const closeCoffeeTypeCardMenu = () => {
        const menu = document.getElementById('coffeeTypeCardActionMenu');
        if (menu) menu.classList.add('hidden');
    };

    return {
        showBeansForCoffeeTypeFromTable,
        showBrewsForCoffeeTypeFromTable,
        openNewBagForCoffeeTypeFromTable,
        openCoffeeTypeFromTableEdit,
        deleteCoffeeTypeFromTable,
        deleteCoffeeType,
        triggerCoffeeTypePhoto,
        openCoffeeTypePhoto,
        removeCoffeeTypePhoto,
        replaceCoffeeTypePhotoWithBackgroundRemoved,
        handleCoffeeTypePhoto,
        openCoffeeTypeCard,
        closeCoffeeTypeCard,
        enterCoffeeTypeEditMode,
        cancelCoffeeTypeEditMode,
        saveCoffeeTypeEdits,
        closeCoffeeTypeCardMenu
    };
};
