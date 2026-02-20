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
    functionsService,
    imageCompression,
    html2canvas,
    getStarDisplay,
    openAppConfirm
}) => {
    const { db, addDoc, collection, query, where, orderBy, limit, startAfter, getDocs, doc, updateDoc, deleteDoc } = dataService || {};
    const { storage, ref, uploadBytes, deleteObject } = storageService || {};
    const { functions, httpsCallable } = functionsService || {};

    if (!db || !addDoc || !collection || !query || !where || !orderBy || !limit || !startAfter || !getDocs || !doc || !updateDoc || !deleteDoc) {
        throw new Error('createGalleryModule requires dataService { db, addDoc, collection, query, where, orderBy, limit, startAfter, getDocs, doc, updateDoc, deleteDoc }');
    }
    if (!storage || !ref || !uploadBytes || !deleteObject) {
        throw new Error('createGalleryModule requires storageService { storage, ref, uploadBytes, deleteObject }');
    }
    if (!functions || typeof httpsCallable !== 'function') {
        throw new Error('createGalleryModule requires functionsService { functions, httpsCallable }');
    }

    const getPhotoSignedUrl = httpsCallable(functions, 'getPhotoSignedUrl');
    const getPhotoSignedUrlsBatch = httpsCallable(functions, 'getPhotoSignedUrlsBatch');
    const signedUrlCache = new Map();
    const preparedMomentShares = new Map();
    const DEFAULT_URL_TTL_SECONDS = 180;
    const CACHE_SKEW_MS = 15000;
    const SESSION_CACHE_PREFIX = 'gallerySignedUrl:v1';
    const SESSION_INDEX_PREFIX = 'gallerySignedUrlIndex:v1';

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

    const getSignedUrlCacheKey = (photoId, variant) => `${photoId}:${variant}`;
    const getSessionBaseKey = (photoId, variant) => `${SESSION_CACHE_PREFIX}:${photoId}:${variant}`;
    const getSessionIndexKey = (photoId, variant) => `${SESSION_INDEX_PREFIX}:${photoId}:${variant}`;
    const isSessionStorageAvailable = () => {
        try {
            return typeof window !== 'undefined' && !!window.sessionStorage;
        } catch (_) {
            return false;
        }
    };

    const setPersistentSignedUrl = (photoId, variant, url, expiresAtMs) => {
        if (!isSessionStorageAvailable() || !url || !Number.isFinite(expiresAtMs)) return;
        const baseKey = getSessionBaseKey(photoId, variant);
        const indexKey = getSessionIndexKey(photoId, variant);
        const entryKey = `${baseKey}:${expiresAtMs}`;
        try {
            const previousEntryKey = window.sessionStorage.getItem(indexKey);
            if (previousEntryKey && previousEntryKey !== entryKey) {
                window.sessionStorage.removeItem(previousEntryKey);
            }
            window.sessionStorage.setItem(entryKey, JSON.stringify({ url, expiresAtMs }));
            window.sessionStorage.setItem(indexKey, entryKey);
        } catch (_) {
            // Ignore quota/access errors; in-memory cache still works.
        }
    };

    const removePersistentSignedUrl = (photoId, variant) => {
        if (!isSessionStorageAvailable()) return;
        const indexKey = getSessionIndexKey(photoId, variant);
        try {
            const entryKey = window.sessionStorage.getItem(indexKey);
            if (entryKey) window.sessionStorage.removeItem(entryKey);
            window.sessionStorage.removeItem(indexKey);
        } catch (_) {
            // Ignore storage errors.
        }
    };

    const getPersistentSignedUrl = (photoId, variant) => {
        if (!isSessionStorageAvailable()) return '';
        const indexKey = getSessionIndexKey(photoId, variant);
        try {
            const entryKey = window.sessionStorage.getItem(indexKey);
            if (!entryKey) return '';
            const raw = window.sessionStorage.getItem(entryKey);
            if (!raw) {
                window.sessionStorage.removeItem(indexKey);
                return '';
            }
            const parsed = JSON.parse(raw);
            const url = typeof parsed?.url === 'string' ? parsed.url.trim() : '';
            const expiresAtMs = Number(parsed?.expiresAtMs);
            if (!url || !Number.isFinite(expiresAtMs) || Date.now() >= expiresAtMs - CACHE_SKEW_MS) {
                window.sessionStorage.removeItem(entryKey);
                window.sessionStorage.removeItem(indexKey);
                return '';
            }
            signedUrlCache.set(getSignedUrlCacheKey(photoId, variant), { url, expiresAtMs });
            return url;
        } catch (_) {
            return '';
        }
    };

    const getCachedSignedUrl = (photoId, variant) => {
        const entry = signedUrlCache.get(getSignedUrlCacheKey(photoId, variant));
        if (!entry) return '';
        if (Date.now() >= entry.expiresAtMs - CACHE_SKEW_MS) {
            signedUrlCache.delete(getSignedUrlCacheKey(photoId, variant));
            removePersistentSignedUrl(photoId, variant);
            return '';
        }
        return entry.url;
    };

    const setCachedSignedUrl = (photoId, variant, signedUrlData) => {
        const signedUrl = typeof signedUrlData?.signedUrl === 'string'
            ? signedUrlData.signedUrl.trim()
            : '';
        if (!signedUrl) return '';

        let expiresAtMs = Number.NaN;
        if (typeof signedUrlData?.expiresAt === 'string') {
            expiresAtMs = new Date(signedUrlData.expiresAt).getTime();
        }
        if (!Number.isFinite(expiresAtMs)) {
            const ttlSeconds = Number.isFinite(Number(signedUrlData?.cacheTtlSeconds))
                ? Number(signedUrlData.cacheTtlSeconds)
                : DEFAULT_URL_TTL_SECONDS;
            expiresAtMs = Date.now() + Math.max(30, ttlSeconds) * 1000;
        }

        signedUrlCache.set(getSignedUrlCacheKey(photoId, variant), {
            url: signedUrl,
            expiresAtMs
        });
        setPersistentSignedUrl(photoId, variant, signedUrl, expiresAtMs);
        return signedUrl;
    };

    const resolveLegacyUrl = (data, variant) => {
        const photoURL = typeof data?.photoURL === 'string' ? data.photoURL.trim() : '';
        const thumbURL = typeof data?.thumbURL === 'string' ? data.thumbURL.trim() : '';
        if (variant === 'thumb') return thumbURL || photoURL || '';
        return photoURL || thumbURL || '';
    };

    const hasStoragePath = (data, variant) => {
        const photoPath = typeof data?.photoPath === 'string' ? data.photoPath.trim() : '';
        const thumbPath = typeof data?.thumbPath === 'string' ? data.thumbPath.trim() : '';
        if (variant === 'thumb') return !!(thumbPath || photoPath);
        return !!(photoPath || thumbPath);
    };

    const resolveSignedPhotoUrl = async ({ photoId, variant, data }) => {
        if (!photoId) return resolveLegacyUrl(data, variant);

        const cached = getCachedSignedUrl(photoId, variant);
        if (cached) return cached;
        const persistent = getPersistentSignedUrl(photoId, variant);
        if (persistent) return persistent;

        if (!hasStoragePath(data, variant)) {
            return resolveLegacyUrl(data, variant);
        }

        try {
            const result = await getPhotoSignedUrl({
                photoId,
                variant,
                expiresInMinutes: 3
            });
            const signedUrl = setCachedSignedUrl(photoId, variant, result?.data || {});
            if (signedUrl) return signedUrl;
        } catch (error) {
            console.warn(`Signed URL retrieval failed for ${photoId}/${variant}:`, error);
        }

        return resolveLegacyUrl(data, variant);
    };

    const resolveBatchSignedPhotoUrls = async ({ items, expiresInMinutes = 3 }) => {
        if (!Array.isArray(items) || !items.length) return new Map();
        try {
            const result = await getPhotoSignedUrlsBatch({
                items,
                expiresInMinutes
            });
            const signedItems = Array.isArray(result?.data?.items) ? result.data.items : [];
            const resolved = new Map();
            signedItems.forEach((entry) => {
                const photoId = typeof entry?.photoId === 'string' ? entry.photoId : '';
                const variant = entry?.variant === 'thumb' ? 'thumb' : 'full';
                if (!photoId) return;
                const signedUrl = setCachedSignedUrl(photoId, variant, entry);
                if (!signedUrl) return;
                resolved.set(getSignedUrlCacheKey(photoId, variant), signedUrl);
            });
            return resolved;
        } catch (error) {
            console.warn('Batch signed URL retrieval failed:', error);
            return new Map();
        }
    };

    const toDocsWithData = (docs) => docs.map((docItem) => ({
        docItem,
        data: docItem.data()
    }));

    const buildThumbBatchItems = (docsWithData) => {
        const batchItems = [];
        docsWithData.forEach(({ docItem, data }) => {
            if (!hasStoragePath(data, 'thumb')) return;
            const photoId = docItem.id;
            const cached = getCachedSignedUrl(photoId, 'thumb');
            if (cached) return;
            const persistent = getPersistentSignedUrl(photoId, 'thumb');
            if (persistent) return;
            batchItems.push({ photoId, variant: 'thumb' });
        });
        return batchItems;
    };

    const openExternalUrl = (url) => {
        if (!url) return;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const inferExtensionFromContentType = (contentType) => {
        const normalized = (contentType || '').toLowerCase();
        if (normalized.includes('png')) return 'png';
        if (normalized.includes('webp')) return 'webp';
        return 'jpg';
    };

    const buildMomentShareText = ({ data, cardSnapshot, appLink }) => {
        const parts = [];
        if (data?.message) {
            parts.push(data.message.trim());
            parts.push('');
        }
        parts.push(`Farmer: ${cardSnapshot?.farmer || '-'}`);
        parts.push(`Roaster: ${cardSnapshot?.roaster || '-'}`);
        parts.push(`Method: ${cardSnapshot?.method || '-'}`);
        const numericRating = Number(cardSnapshot?.rating) || 0;
        if (numericRating > 0) {
            parts.push(`Rating: ${numericRating}/5`);
        }
        parts.push('');
        parts.push(appLink);
        return parts.join('\n');
    };

    const getHtml2Canvas = () => {
        if (typeof html2canvas === 'function') return html2canvas;
        if (typeof window !== 'undefined' && typeof window.html2canvas === 'function') {
            return window.html2canvas;
        }
        return null;
    };

    const waitForCardImages = async (cardElement) => {
        const images = Array.from(cardElement.querySelectorAll('img'));
        if (!images.length) return;
        await Promise.all(images.map((img) => {
            if (img.complete) return Promise.resolve();
            return new Promise((resolve) => {
                const done = () => {
                    img.removeEventListener('load', done);
                    img.removeEventListener('error', done);
                    resolve();
                };
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
            });
        }));
    };

    const formatMomentDate = (isoValue) => {
        if (!isoValue) return '';
        const date = new Date(isoValue);
        if (Number.isNaN(date.getTime())) return '';
        return date.toLocaleDateString();
    };

    const buildShareTemplateCard = ({ photoUrl, data, cardSnapshot, widthPx }) => {
        const width = Math.max(280, Math.min(640, widthPx || 560));
        const hasRating = (Number(cardSnapshot?.rating) || 0) > 0;

        const card = document.createElement('div');
        card.style.cssText = [
            `width:${width}px`,
            'border-radius:24px',
            'overflow:hidden',
            'background:#302a28',
            'border:1px solid rgba(255,255,255,0.18)',
            'box-shadow:0 20px 46px rgba(0,0,0,0.4)',
            "font-family:'Nunito', system-ui, sans-serif",
            'color:#f5f5f4'
        ].join(';');

        const mediaWrap = document.createElement('div');
        mediaWrap.style.cssText = 'position:relative;width:100%;background:#1f1b19;overflow:hidden;';
        if (photoUrl) {
            const img = document.createElement('img');
            img.src = photoUrl;
            img.alt = 'Moment photo';
            img.crossOrigin = 'anonymous';
            img.style.cssText = 'width:100%;height:auto;display:block;';
            mediaWrap.appendChild(img);
        }
        const dateBadge = document.createElement('div');
        dateBadge.style.cssText = 'position:absolute;left:16px;bottom:14px;color:#ffffff;font-size:18px;font-weight:800;line-height:1;';
        dateBadge.textContent = formatMomentDate(data?.createdAt);
        mediaWrap.appendChild(dateBadge);
        card.appendChild(mediaWrap);

        const body = document.createElement('div');
        body.style.cssText = 'padding:24px 24px 22px;';

        const topRow = document.createElement('div');
        topRow.style.cssText = 'display:flex;align-items:flex-start;justify-content:space-between;gap:8px;margin-bottom:16px;';
        const uploader = document.createElement('div');
        uploader.style.cssText = 'font-size:13px;font-weight:700;letter-spacing:0.03em;text-transform:uppercase;color:#a8a29e;line-height:1;';
        uploader.textContent = data?.uploaderName || 'Unknown';
        const rating = document.createElement('div');
        rating.style.cssText = 'font-size:12px;color:#f5f5f4;font-weight:600;white-space:nowrap;line-height:1;';
        rating.textContent = hasRating ? `${Number(cardSnapshot?.rating) || 0}/5` : '-';
        topRow.appendChild(uploader);
        topRow.appendChild(rating);
        body.appendChild(topRow);

        const message = document.createElement('p');
        message.style.cssText = 'margin:0 0 18px 0;max-width:88%;color:#e7e5e4;font-size:14px;line-height:1.45;font-style:italic;font-weight:400;';
        const rawMessage = (data?.message || '').trim();
        message.textContent = rawMessage ? `"${rawMessage}"` : '"-"';
        body.appendChild(message);

        const info = document.createElement('div');
        info.style.cssText = 'padding:0;';
        const farmer = document.createElement('div');
        farmer.style.cssText = 'font-size:14px;font-weight:700;color:#ffffff;line-height:1.2;';
        farmer.textContent = cardSnapshot?.farmer || '-';
        const roaster = document.createElement('div');
        roaster.style.cssText = 'margin-top:4px;font-size:13px;font-weight:500;color:#d6d3d1;line-height:1.2;';
        roaster.textContent = cardSnapshot?.roaster || '-';
        const method = document.createElement('div');
        method.style.cssText = 'margin-top:8px;font-size:13px;font-weight:500;color:#d6d3d1;line-height:1.2;text-align:left;';
        method.textContent = cardSnapshot?.method || '-';
        info.appendChild(farmer);
        info.appendChild(roaster);
        info.appendChild(method);
        body.appendChild(info);

        card.appendChild(body);
        return card;
    };

    const createShareFileFromMomentCard = async ({ photoId, cardElement, data, cardSnapshot, photoUrl }) => {
        const capture = getHtml2Canvas();
        if (!capture) {
            throw new Error('Screenshot capture is not available.');
        }
        const rect = cardElement?.getBoundingClientRect?.();
        const widthPx = rect?.width ? Math.round(rect.width) : 560;
        const templateCard = buildShareTemplateCard({ photoUrl, data, cardSnapshot, widthPx });
        const host = document.createElement('div');
        host.style.cssText = 'position:fixed;left:-10000px;top:0;pointer-events:none;z-index:-1;';
        host.appendChild(templateCard);
        document.body.appendChild(host);

        let canvas;
        try {
            await waitForCardImages(templateCard);
            await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            canvas = await capture(templateCard, {
                scale: Math.min(2, window.devicePixelRatio || 1),
                useCORS: true,
                allowTaint: false,
                backgroundColor: null,
                logging: false
            });
        } finally {
            host.remove();
        }

        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
        if (!blob) {
            throw new Error('Screenshot generation failed.');
        }
        const extension = inferExtensionFromContentType(blob.type);
        return new File([blob], `moment-${photoId}.${extension}`, {
            type: blob.type || `image/${extension}`
        });
    };

    const prepareMomentSharePayload = async ({ photoId, data, cardSnapshot, cardElement, shareText }) => {
        const fullPhotoUrl = await resolveSignedPhotoUrl({
            photoId,
            variant: 'full',
            data
        });
        const shareFile = await createShareFileFromMomentCard({
            photoId,
            cardElement,
            data,
            cardSnapshot,
            photoUrl: fullPhotoUrl
        });

        const payload = { text: shareText };
        if (shareFile && (!navigator.canShare || navigator.canShare({ files: [shareFile] }))) {
            payload.files = [shareFile];
        }
        preparedMomentShares.set(photoId, payload);
        return payload;
    };

    const shareMoment = async ({ photoId, data, cardSnapshot, cardElement }) => {
        const appLink = typeof window !== 'undefined' ? window.location.origin : '';
        const shareText = buildMomentShareText({ data, cardSnapshot, appLink });
        if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
            alert('Sharing is not supported on this device.');
            return;
        }

        // Best-effort: copy details for apps that only keep the image payload.
        try {
            if (navigator?.clipboard?.writeText) {
                navigator.clipboard.writeText(shareText).catch(() => {});
            }
        } catch (error) {
            console.warn('Clipboard copy failed before sharing moment:', error);
        }

        let sharePayload = preparedMomentShares.get(photoId);
        if (!sharePayload) {
            try {
                sharePayload = await prepareMomentSharePayload({
                    photoId,
                    data,
                    cardSnapshot,
                    cardElement,
                    shareText
                });
            } catch (error) {
                console.warn('Moment card screenshot share fallback to text-only:', error);
                sharePayload = { text: shareText };
            }
        } else {
            sharePayload = { ...sharePayload, text: shareText };
        }

        try {
            await navigator.share(sharePayload);
            preparedMomentShares.delete(photoId);
        } catch (error) {
            if (error?.name === 'NotAllowedError') {
                const hasPreparedFile = Array.isArray(sharePayload?.files) && sharePayload.files.length > 0;
                if (hasPreparedFile) {
                    throw new Error('Share sheet was blocked by the browser. Tap Share moment again.');
                }
            }
            throw error;
        }
    };

    const setMomentShareButtonLoading = (button, isLoading) => {
        if (!button) return;
        if (isLoading) {
            button.disabled = true;
            button.classList.add('opacity-100', 'cursor-wait');
            button.innerHTML = '<i class="fa-solid fa-spinner fa-spin text-xs"></i>';
            return;
        }
        button.disabled = false;
        button.classList.remove('cursor-wait');
        button.innerHTML = '<i class="fa-solid fa-share-nodes text-xs"></i>';
    };

    const setGalleryLoadingVisible = (isVisible) => {
        const loading = document.getElementById('galleryLoading');
        if (!loading) return;
        loading.classList.toggle('hidden', !isVisible);
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
            const photoPath = `photos/${user.uid}/${timestamp}_${file.name}_original`;
            const storageRef = ref(storage, photoPath);
            const originalOptions = { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true };
            const compressedOriginal = await imageCompression(file, originalOptions);
            await uploadBytes(storageRef, compressedOriginal);

            let thumbPath = null;
            const thumbOptions = { maxSizeMB: 0.1, maxWidthOrHeight: 600, useWebWorker: true };
            try {
                const thumbFile = await imageCompression(file, thumbOptions);
                thumbPath = `photos/${user.uid}/${timestamp}_${file.name}_thumb`;
                const thumbRef = ref(storage, thumbPath);
                await uploadBytes(thumbRef, thumbFile);
            } catch (error) {
                console.log('Thumbnail generation failed:', error);
                thumbPath = null;
            }

            await addDoc(collection(db, 'photos'), {
                uid: user.uid,
                uploaderName: user.displayName || 'Unknown User',
                photoPath,
                thumbPath,
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
        switchGalleryTab('shared');
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
        const isInitialLoad = !getLastGalleryDoc();
        if (isInitialLoad) setGalleryLoadingVisible(true);
        try {
            let q;
            const constraints = [orderBy('createdAt', 'desc'), limit(9)];
            if (getLastGalleryDoc()) constraints.push(startAfter(getLastGalleryDoc()));

            const user = getCurrentUser();
            if (getCurrentGalleryMode() === 'mine') q = query(collection(db, 'photos'), where('uid', '==', user.uid), ...constraints);
            else q = query(collection(db, 'photos'), where('sharedWith', 'array-contains', user.uid), ...constraints);

            const snapshot = await getDocs(q);
            if (!snapshot.empty) {
                const docsWithData = toDocsWithData(snapshot.docs);
                const thumbBatchItems = buildThumbBatchItems(docsWithData);
                const prefetchedThumbUrlsPromise = resolveBatchSignedPhotoUrls({
                    items: thumbBatchItems
                });
                setLastGalleryDoc(snapshot.docs[snapshot.docs.length - 1]);
                const prefetchedThumbUrls = await prefetchedThumbUrlsPromise;
                renderGalleryGrid(snapshot.docs, { prefetchedThumbUrls });
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
        } finally {
            if (isInitialLoad) setGalleryLoadingVisible(false);
        }
        setIsGalleryLoading(false);
    };

    const renderGalleryGrid = (docs, options = {}) => {
        const grid = document.getElementById('galleryGrid');
        const docsWithData = toDocsWithData(docs);
        const prefetchedThumbUrls = options.prefetchedThumbUrls instanceof Map
            ? options.prefetchedThumbUrls
            : new Map();

        docsWithData.forEach(({ docItem, data }) => {
            const cardSnapshot = resolveSnapshotForCard(data);
            const card = document.createElement('div');
            card.id = `moment-card-${docItem.id}`;
            card.className = 'bg-white dark:bg-[#292524] rounded-lg shadow-md overflow-hidden border border-coffee-200 dark:border-[#44403c] flex flex-col relative group';

            const ratingHtml = getStarDisplay(cardSnapshot.rating || 0);
            const cachedThumb = getCachedSignedUrl(docItem.id, 'thumb');
            const batchThumb = prefetchedThumbUrls.get(getSignedUrlCacheKey(docItem.id, 'thumb'));
            const displayUrl = cachedThumb || batchThumb || resolveLegacyUrl(data, 'thumb');
            const primaryInfo = cardSnapshot.farmer || '-';
            const secondaryInfo = cardSnapshot.roaster || cardSnapshot.origin || '-';

            if (getCurrentGalleryMode() === 'mine') {
                const shareBtn = document.createElement('button');
                shareBtn.type = 'button';
                shareBtn.title = 'Share moment';
                shareBtn.dataset.momentAction = 'true';
                shareBtn.className = 'absolute top-2 left-2 bg-white/80 hover:bg-white text-coffee-700 w-8 h-8 rounded-full flex items-center justify-center shadow transition-all z-10 opacity-0 group-hover:opacity-100';
                shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes text-xs"></i>';
                shareBtn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    setMomentShareButtonLoading(shareBtn, true);
                    try {
                        await shareMoment({
                            photoId: docItem.id,
                            data,
                            cardSnapshot,
                            cardElement: card
                        });
                    } catch (error) {
                        if (error?.name === 'AbortError') return;
                        console.error('Share moment failed:', error);
                        alert(`Share failed: ${error.message || 'Unknown error'}`);
                    } finally {
                        setMomentShareButtonLoading(shareBtn, false);
                    }
                });
                card.appendChild(shareBtn);

                const deleteBtn = document.createElement('button');
                deleteBtn.type = 'button';
                deleteBtn.title = 'Delete Photo';
                deleteBtn.dataset.momentAction = 'true';
                deleteBtn.className = 'absolute top-2 right-2 bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg transition-all z-10 opacity-0 group-hover:opacity-100';
                deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can text-xs"></i>';
                deleteBtn.addEventListener('click', (event) => {
                    const photoRefValue = data.photoPath || data.photoURL || '';
                    const thumbRefValue = data.thumbPath || data.thumbURL || '';
                    deletePhoto(docItem.id, photoRefValue, thumbRefValue, event);
                });
                card.appendChild(deleteBtn);
            }

            const imageWrap = document.createElement('div');
            imageWrap.dataset.momentImageWrap = 'true';
            imageWrap.className = 'h-48 overflow-hidden bg-gray-100 dark:bg-gray-800 relative cursor-pointer';

            const img = document.createElement('img');
            img.src = displayUrl;
            img.crossOrigin = 'anonymous';
            img.loading = 'lazy';
            img.className = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-110';
            img.alt = 'Brew Photo';
            imageWrap.appendChild(img);

            const dateBadge = document.createElement('div');
            dateBadge.className = 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-xs';
            dateBadge.textContent = new Date(data.createdAt).toLocaleDateString();
            imageWrap.appendChild(dateBadge);
            card.appendChild(imageWrap);

            const body = document.createElement('div');
            body.dataset.momentBody = 'true';
            body.className = 'p-3 flex-1 flex flex-col';
            body.innerHTML = `<div class="flex justify-between items-start mb-2"><span class="text-xs font-bold text-coffee-500 dark:text-[#78716c] uppercase">${data.uploaderName}</span><div class="text-xs">${ratingHtml}</div></div><p data-moment-message="true" class="text-sm italic text-gray-700 dark:text-gray-300 mb-3 flex-1">"${data.message || ''}"</p><div data-moment-info="true" class="bg-coffee-50 dark:bg-[#1c1917] rounded p-2 text-xs border border-coffee-100 dark:border-[#44403c]"><div class="font-bold text-coffee-800 dark:text-white truncate">${primaryInfo}</div><div class="text-coffee-600 dark:text-[#a8a29e] truncate">${secondaryInfo}</div><div class="mt-1 inline-block px-1.5 py-0.5 bg-white dark:bg-[#292524] rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] font-mono text-[10px]">${cardSnapshot.method}</div></div>`;
            card.appendChild(body);
            grid.appendChild(card);

            img.addEventListener('click', async (event) => {
                event.stopPropagation();
                const fullUrl = await resolveSignedPhotoUrl({
                    photoId: docItem.id,
                    variant: 'full',
                    data
                });
                openExternalUrl(fullUrl);
            });
        });
    };

    const deletePhoto = async (photoId, photoRefValue, thumbRefValue, ev) => {
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
            const normalizedPhotoRef = typeof photoRefValue === 'string' ? photoRefValue.trim() : '';
            if (normalizedPhotoRef) {
                await deleteObject(ref(storage, normalizedPhotoRef));
            }
            const normalizedThumbRef = typeof thumbRefValue === 'string' ? thumbRefValue.trim() : '';
            if (normalizedThumbRef) {
                await deleteObject(ref(storage, normalizedThumbRef));
            }
            signedUrlCache.delete(getSignedUrlCacheKey(photoId, 'full'));
            signedUrlCache.delete(getSignedUrlCacheKey(photoId, 'thumb'));
            removePersistentSignedUrl(photoId, 'full');
            removePersistentSignedUrl(photoId, 'thumb');
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
