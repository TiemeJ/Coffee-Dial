export const createAiImportModule = ({
    BAG_AI_URL,
    imageCompression,
    getCurrentUser,
    toggleForm,
    dataService,
    storageService,
    db: legacyDb,
    doc: legacyDoc,
    setDoc: legacySetDoc,
    updateDoc: legacyUpdateDoc,
    collection: legacyCollection,
    writeBatch: legacyWriteBatch,
    storage: legacyStorage,
    ref: legacyRef,
    uploadBytes: legacyUploadBytes,
    getDownloadURL: legacyGetDownloadURL,
    autoPinOpenBagsIfEnabled,
    getCoffeeTypes,
    setCoffeeTypes,
    openCoffeeTypeCard,
    enterCoffeeTypeEditMode
}) => {
    const db = dataService?.db ?? legacyDb;
    const doc = dataService?.doc ?? legacyDoc;
    const setDoc = dataService?.setDoc ?? legacySetDoc;
    const updateDoc = dataService?.updateDoc ?? legacyUpdateDoc;
    const collection = dataService?.collection ?? legacyCollection;
    const writeBatch = dataService?.writeBatch ?? legacyWriteBatch;
    const storage = storageService?.storage ?? legacyStorage;
    const ref = storageService?.ref ?? legacyRef;
    const uploadBytes = storageService?.uploadBytes ?? legacyUploadBytes;
    const getDownloadURL = storageService?.getDownloadURL ?? legacyGetDownloadURL;
    let pendingAIBeanImageFile = null;

    const callBagAi = async (file) => {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1024, useWebWorker: true };
        const compressedFile = await imageCompression(file, options);
        const base64String = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(compressedFile);
        });

        const response = await fetch(BAG_AI_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64Image: base64String })
        });

        if (!response.ok) throw new Error('AI Analysis Failed.');
        const data = await response.json();
        return { compressedFile, data };
    };

    const triggerAIScan = (mode = null) => {
        if (!getCurrentUser()) return alert('Please sign in to use AI scanning.');
        const input = document.getElementById('aiFileInput');
        if (mode === 'camera') input.setAttribute('capture', 'environment');
        else if (mode === 'library') input.removeAttribute('capture');
        document.getElementById('aiMenuDropdown').classList.add('hidden');
        input.click();
    };

    const toggleAiMenu = (e) => {
        if (e) e.stopPropagation();
        document.getElementById('aiMenuDropdown').classList.toggle('hidden');
    };

    const toggleBeansAiMenu = (e) => {
        if (e) e.stopPropagation();
        document.getElementById('beansAiMenuDropdown').classList.toggle('hidden');
    };

    const toggleCoffeeTypesAiMenu = (e) => {
        if (e) e.stopPropagation();
        document.getElementById('coffeeTypesAiMenuDropdown').classList.toggle('hidden');
    };

    const triggerBeansAIScan = (mode = null) => {
        if (!getCurrentUser()) return alert('Please sign in to use AI scanning.');
        const input = document.getElementById('beansAiFileInput');
        if (mode === 'camera') input.setAttribute('capture', 'environment');
        else if (mode === 'library') input.removeAttribute('capture');
        document.getElementById('beansAiMenuDropdown').classList.add('hidden');
        input.click();
    };

    const triggerCoffeeTypesAIScan = (mode = null) => {
        if (!getCurrentUser()) return alert('Please sign in to use AI scanning.');
        const input = document.getElementById('coffeeTypesAiFileInput');
        if (mode === 'camera') input.setAttribute('capture', 'environment');
        else if (mode === 'library') input.removeAttribute('capture');
        document.getElementById('coffeeTypesAiMenuDropdown').classList.add('hidden');
        input.click();
    };

    const handleAIFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const btn = document.getElementById('aiScanBtn');
        const originalContent = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Analyzing...';
            btn.classList.add('ai-loading-pulse');

            const { compressedFile, data } = await callBagAi(file);
            const fieldsToFill = ['roaster', 'farmer', 'origin', 'variety', 'processing', 'roastType'];
            fieldsToFill.forEach((id) => {
                const el = document.getElementById(id);
                if (data[id] && el) {
                    el.value = data[id];
                    // Keep dependent UI (like collapsed coffee details title) in sync on AI-fill.
                    el.dispatchEvent(new Event('input', { bubbles: true }));
                    el.classList.add('ai-flash-effect');
                    setTimeout(() => el.classList.remove('ai-flash-effect'), 2000);
                }
            });

            pendingAIBeanImageFile = compressedFile;
            toggleForm(true);
        } catch (error) {
            console.error(error);
            alert(`Error scanning bag: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            btn.classList.remove('ai-loading-pulse');
            event.target.value = '';
        }
    };

    const uploadPendingCoffeeTypeImage = async (coffeeTypeId) => {
        const user = getCurrentUser();
        if (!pendingAIBeanImageFile || !coffeeTypeId || !user) return null;

        const storageRef = ref(storage, `photos/${user.uid}/coffee_type_${coffeeTypeId}_${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, pendingAIBeanImageFile);
        const imageURL = await getDownloadURL(snapshot.ref);
        await updateDoc(doc(db, 'users', user.uid, 'coffeeTypes', coffeeTypeId), {
            imageUrl: imageURL,
            updatedAt: new Date().toISOString()
        });
        const nextCoffeeTypes = getCoffeeTypes().map((type) =>
            type.id === coffeeTypeId ? { ...type, imageUrl: imageURL, updatedAt: new Date().toISOString() } : type
        );
        setCoffeeTypes(nextCoffeeTypes);

        pendingAIBeanImageFile = null;
        return imageURL;
    };

    const clearPendingAIBeanImageFile = () => {
        pendingAIBeanImageFile = null;
    };

    const handleBeansAIFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('beansAiScanBtn');
        const originalContent = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning...';
            btn.classList.add('ai-loading-pulse');

            const { compressedFile, data } = await callBagAi(file);
            const nowIso = new Date().toISOString();
            const beanRef = doc(collection(db, 'users', user.uid, 'beans'));
            const typeRef = doc(collection(db, 'users', user.uid, 'coffeeTypes'));
            const storageRef = ref(storage, `photos/${user.uid}/coffee_type_${typeRef.id}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, compressedFile);
            const imageURL = await getDownloadURL(snapshot.ref);

            const typeData = {
                uid: user.uid,
                roaster: data.roaster || '',
                farmer: data.farmer || '',
                origin: data.origin || '',
                processing: data.processing || '',
                variety: data.variety || '',
                roast: data.roastType || data.roast || '',
                rating: 0,
                tasteNotes: '',
                webshopUrl: '',
                imageUrl: imageURL,
                createdAt: nowIso,
                updatedAt: nowIso
            };

            const beanData = {
                coffeeTypeId: typeRef.id,
                createdAt: nowIso,
                updatedAt: nowIso,
                archived: false,
                frozen: false,
                stock: 250,
                beansLeft: 250,
                openedDate: null,
                archivedDate: null
            };

            const batch = writeBatch(db);
            batch.set(typeRef, typeData);
            batch.set(beanRef, beanData);
            await batch.commit();
            await autoPinOpenBagsIfEnabled();

            const current = getCoffeeTypes();
            if (!current.find((ct) => ct.id === typeRef.id)) {
                setCoffeeTypes([...current, { id: typeRef.id, ...typeData }]);
            }
        } catch (error) {
            console.error(error);
            alert(`Error scanning bag: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            btn.classList.remove('ai-loading-pulse');
            event.target.value = '';
        }
    };

    const handleCoffeeTypesAIFile = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('coffeeTypesAiScanBtn');
        const originalContent = btn.innerHTML;

        try {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Scanning...';
            btn.classList.add('ai-loading-pulse');

            const { compressedFile, data } = await callBagAi(file);
            const nowIso = new Date().toISOString();
            const typeRef = doc(collection(db, 'users', user.uid, 'coffeeTypes'));
            const storageRef = ref(storage, `photos/${user.uid}/coffee_type_${typeRef.id}_${Date.now()}`);
            const snapshot = await uploadBytes(storageRef, compressedFile);
            const imageURL = await getDownloadURL(snapshot.ref);

            const typeData = {
                uid: user.uid,
                roaster: data.roaster || '',
                farmer: data.farmer || '',
                origin: data.origin || '',
                processing: data.processing || '',
                variety: data.variety || '',
                roast: data.roastType || data.roast || '',
                rating: 0,
                tasteNotes: '',
                webshopUrl: '',
                imageUrl: imageURL,
                createdAt: nowIso,
                updatedAt: nowIso
            };

            await setDoc(typeRef, typeData);
            const newType = { id: typeRef.id, ...typeData };
            const current = getCoffeeTypes();
            if (!current.find((ct) => ct.id === newType.id)) {
                setCoffeeTypes([...current, newType]);
            }

            openCoffeeTypeCard(newType.id);
            enterCoffeeTypeEditMode();
        } catch (error) {
            console.error(error);
            alert(`Error scanning bag: ${error.message}`);
        } finally {
            btn.disabled = false;
            btn.innerHTML = originalContent;
            btn.classList.remove('ai-loading-pulse');
            event.target.value = '';
        }
    };

    return {
        triggerAIScan,
        toggleAiMenu,
        toggleBeansAiMenu,
        toggleCoffeeTypesAiMenu,
        triggerBeansAIScan,
        triggerCoffeeTypesAIScan,
        handleAIFile,
        uploadPendingCoffeeTypeImage,
        clearPendingAIBeanImageFile,
        handleBeansAIFile,
        handleCoffeeTypesAIFile
    };
};
