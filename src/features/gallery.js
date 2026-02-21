import { createGalleryLikesModule } from './gallery-likes.js';
import { createGalleryCommentsModule } from './gallery-comments.js';

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
    openLightbox,
    openAppConfirm,
    openBrewFromMoment
}) => {
    const { db, addDoc, collection, query, where, orderBy, limit, startAfter, getDoc, getDocs, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove } = dataService || {};
    const { storage, ref, uploadBytes, deleteObject } = storageService || {};
    const { functions, httpsCallable } = functionsService || {};

    if (!db || !addDoc || !collection || !query || !where || !orderBy || !limit || !startAfter || !getDoc || !getDocs || !doc || !updateDoc || !deleteDoc || !arrayUnion || !arrayRemove) {
        throw new Error('createGalleryModule requires dataService { db, addDoc, collection, query, where, orderBy, limit, startAfter, getDoc, getDocs, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove }');
    }
    if (!storage || !ref || !uploadBytes || !deleteObject) {
        throw new Error('createGalleryModule requires storageService { storage, ref, uploadBytes, deleteObject }');
    }
    if (!functions || typeof httpsCallable !== 'function') {
        throw new Error('createGalleryModule requires functionsService { functions, httpsCallable }');
    }

    const getPhotoSignedUrl = httpsCallable(functions, 'getPhotoSignedUrl');
    const getPhotoSignedUrlsBatch = httpsCallable(functions, 'getPhotoSignedUrlsBatch');
    const likesModule = createGalleryLikesModule({
        getCurrentUser,
        db,
        doc,
        updateDoc,
        arrayUnion,
        arrayRemove
    });
    const commentsModule = createGalleryCommentsModule({
        getCurrentUser,
        db,
        collection,
        query,
        orderBy,
        limit,
        getDocs,
        addDoc
    });
    const signedUrlCache = new Map();
    const preparedMomentShares = new Map();
    const momentBrewAccessCache = new Map();
    let currentUploadMomentBrew = null;
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

    const checkFriendBrewAccess = async ({ ownerUid, brewId }) => {
        const normalizedOwner = typeof ownerUid === 'string' ? ownerUid.trim() : '';
        const normalizedBrewId = typeof brewId === 'string' ? brewId.trim() : '';
        if (!normalizedOwner || !normalizedBrewId) return false;

        const cacheKey = getMomentBrewAccessKey(normalizedOwner, normalizedBrewId);
        const cached = momentBrewAccessCache.get(cacheKey);
        if (typeof cached === 'boolean') return cached;
        if (cached && typeof cached.then === 'function') return cached;

        const accessPromise = (async () => {
            try {
                const snap = await getDoc(doc(db, 'users', normalizedOwner, 'coffees', normalizedBrewId));
                return !!snap?.exists?.();
            } catch (_) {
                return false;
            }
        })();

        momentBrewAccessCache.set(cacheKey, accessPromise);
        const allowed = await accessPromise;
        momentBrewAccessCache.set(cacheKey, allowed);
        return allowed;
    };

    const getSignedUrlCacheKey = (photoId, variant) => `${photoId}:${variant}`;
    const getMomentBrewAccessKey = (ownerUid, brewId) => `${ownerUid}:${brewId}`;
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

    const openExternalUrl = (url, options = {}) => {
        if (!url) return;
        if (typeof openLightbox === 'function') {
            const fallbackItems = [{ url, alt: 'Moment image' }];
            openLightbox({
                items: Array.isArray(options.items) && options.items.length ? options.items : fallbackItems,
                startIndex: Number.isFinite(options.startIndex) ? options.startIndex : 0
            });
            return;
        }
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const getSelectedMomentType = () => {
        const selected = document.querySelector('input[name="momentContentType"]:checked');
        const type = (selected?.value || 'photo').toLowerCase();
        return type === 'graph' || type === 'details' ? type : 'photo';
    };

    const hasCapturedGraphForBrew = (brew) => {
        const weightSamples = Array.isArray(brew?.scaleCapture?.samples) ? brew.scaleCapture.samples : [];
        const flowSamples = Array.isArray(brew?.scaleFlowCapture?.samples) ? brew.scaleFlowCapture.samples : [];
        const hasWeight = weightSamples.some((sample) => Number.isFinite(Number(sample?.tMs)) && Number.isFinite(Number(sample?.w)));
        const hasFlow = flowSamples.some((sample) => Number.isFinite(Number(sample?.tMs)) && Number.isFinite(Number(sample?.flow)));
        return hasWeight && hasFlow;
    };

    const updateUploadMomentTypeUi = () => {
        const momentType = getSelectedMomentType();
        const photoWrap = document.getElementById('momentPhotoInputWrap');
        const autoHint = document.getElementById('momentAutoGenHint');
        const photoInput = document.getElementById('photoInput');
        const graphWrap = document.getElementById('momentTypeGraphWrap');
        const graphInput = document.getElementById('momentTypeGraph');
        const graphAvailable = hasCapturedGraphForBrew(currentUploadMomentBrew);
        if (graphWrap) graphWrap.classList.toggle('hidden', !graphAvailable);
        if (!graphAvailable && graphInput?.checked) {
            const photoType = document.getElementById('momentTypePhoto');
            if (photoType) photoType.checked = true;
        }

        const effectiveType = getSelectedMomentType();
        const effectiveRequiresPhoto = effectiveType === 'photo';
        if (photoWrap) photoWrap.classList.toggle('hidden', !effectiveRequiresPhoto);
        if (autoHint) autoHint.classList.toggle('hidden', effectiveRequiresPhoto);
        if (photoInput) photoInput.required = effectiveRequiresPhoto;
    };

    const bindUploadMomentTypeControls = () => {
        const radios = document.querySelectorAll('input[name="momentContentType"]');
        radios.forEach((radio) => {
            if (radio.dataset.boundMomentType === 'true') return;
            radio.dataset.boundMomentType = 'true';
            radio.addEventListener('change', updateUploadMomentTypeUi);
        });
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

    const canvasToPngFile = async (canvas, fileName) => {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png', 0.95));
        if (!blob) throw new Error('Failed to generate image.');
        return new File([blob], fileName, { type: 'image/png' });
    };

    const drawWrappedText = (ctx, text, x, y, maxWidth, lineHeight, options = {}) => {
        const normalized = (text || '').toString().trim();
        if (!normalized) return y;
        const words = normalized.split(/\s+/);
        const lines = [];
        let current = '';
        words.forEach((word) => {
            const test = current ? `${current} ${word}` : word;
            if (ctx.measureText(test).width <= maxWidth) {
                current = test;
            } else {
                if (current) lines.push(current);
                current = word;
            }
        });
        if (current) lines.push(current);

        const maxLines = Number.isFinite(options.maxLines) ? options.maxLines : lines.length;
        const displayLines = lines.slice(0, Math.max(1, maxLines));
        displayLines.forEach((line, index) => {
            ctx.fillText(line, x, y + index * lineHeight);
        });
        return y + displayLines.length * lineHeight;
    };

    const buildMomentGraphFile = async ({ brew, snapshot, message, timestamp }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable.');

        ctx.fillStyle = '#171717';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#f5f5f4';
        ctx.font = '700 54px Nunito, sans-serif';
        ctx.fillText('Brew Graph', 72, 110);

        ctx.fillStyle = '#a8a29e';
        ctx.font = '500 30px Nunito, sans-serif';
        ctx.fillText((snapshot?.roaster || '-').toString(), 72, 160);
        ctx.fillText((snapshot?.farmer || '-').toString(), 72, 198);
        ctx.fillText((snapshot?.method || '-').toString(), 72, 236);
        const weightSamples = (Array.isArray(brew?.scaleCapture?.samples) ? brew.scaleCapture.samples : [])
            .filter((sample) => Number.isFinite(Number(sample?.tMs)) && Number.isFinite(Number(sample?.w)))
            .map((sample) => ({ tMs: Number(sample.tMs), w: Number(sample.w) }));
        const flowSamples = (Array.isArray(brew?.scaleFlowCapture?.samples) ? brew.scaleFlowCapture.samples : [])
            .filter((sample) => Number.isFinite(Number(sample?.tMs)) && Number.isFinite(Number(sample?.flow)))
            .map((sample) => ({ tMs: Number(sample.tMs), flow: Number(sample.flow) }));

        if (!weightSamples.length || !flowSamples.length) {
            throw new Error('No captured weight/flow graph available for this brew.');
        }

        const times = weightSamples.map((s) => s.tMs).concat(flowSamples.map((s) => s.tMs));
        const minT = Math.min(...times);
        const maxT = Math.max(...times);
        const spanT = Math.max(1, maxT - minT);
        const maxWeight = Math.max(1, ...weightSamples.map((s) => s.w));
        const maxFlow = Math.max(0.5, ...flowSamples.map((s) => s.flow));

        const chart = { x: 72, y: 310, w: 936, h: 620 };
        ctx.fillStyle = '#1f2937';
        ctx.fillRect(chart.x, chart.y, chart.w, chart.h);
        ctx.strokeStyle = '#374151';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i += 1) {
            const y = chart.y + (chart.h / 5) * i;
            ctx.beginPath();
            ctx.moveTo(chart.x, y);
            ctx.lineTo(chart.x + chart.w, y);
            ctx.stroke();
        }

        const xFor = (tMs) => chart.x + ((tMs - minT) / spanT) * chart.w;
        const yWeightFor = (w) => chart.y + chart.h - (Math.max(0, w) / maxWeight) * chart.h;
        const yFlowFor = (flow) => chart.y + chart.h - (Math.max(0, flow) / maxFlow) * chart.h;

        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 5;
        ctx.beginPath();
        weightSamples.forEach((sample, index) => {
            const x = xFor(sample.tMs);
            const y = yWeightFor(sample.w);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 4;
        ctx.beginPath();
        flowSamples.forEach((sample, index) => {
            const x = xFor(sample.tMs);
            const y = yFlowFor(sample.flow);
            if (index === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        ctx.fillStyle = '#93c5fd';
        ctx.font = '600 24px Nunito, sans-serif';
        ctx.fillText(`Weight max: ${maxWeight.toFixed(1)} g`, chart.x, chart.y + chart.h + 38);
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`Flow max: ${maxFlow.toFixed(1)} g/s`, chart.x + 340, chart.y + chart.h + 38);
        ctx.fillStyle = '#d1d5db';
        ctx.fillText(`Time: ${(spanT / 1000).toFixed(1)} s`, chart.x + 670, chart.y + chart.h + 38);

        if (message?.trim()) {
            ctx.fillStyle = '#f5f5f4';
            ctx.font = '600 30px Nunito, sans-serif';
            ctx.fillText('Note', 72, 1010);
            ctx.fillStyle = '#e5e7eb';
            ctx.font = '400 30px Nunito, sans-serif';
            drawWrappedText(ctx, message.trim(), 72, 1060, 940, 42, { maxLines: 5 });
        }

        return canvasToPngFile(canvas, `moment-graph-${timestamp}.png`);
    };

    const buildMomentDetailsFile = async ({ brew, snapshot, message, timestamp }) => {
        const canvas = document.createElement('canvas');
        canvas.width = 1080;
        canvas.height = 1350;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context unavailable.');

        ctx.fillStyle = '#1c1917';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const cardX = 44;
        const cardY = 42;
        const cardW = 992;
        const cardH = 1266;
        ctx.fillStyle = '#292524';
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(cardX, cardY, cardW, cardH, 28);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#1c1917';
        ctx.beginPath();
        ctx.roundRect(cardX + 28, cardY + 26, cardW - 56, 216, 18);
        ctx.fill();

        ctx.fillStyle = '#fafaf9';
        ctx.font = '700 48px Nunito, sans-serif';
        ctx.fillText((snapshot?.farmer || '-').toString(), cardX + 54, cardY + 92);
        ctx.fillStyle = '#d6d3d1';
        ctx.font = '500 34px Nunito, sans-serif';
        ctx.fillText((snapshot?.roaster || '-').toString(), cardX + 54, cardY + 140);
        ctx.fillStyle = '#a8a29e';
        ctx.font = '500 30px Nunito, sans-serif';
        ctx.fillText((snapshot?.method || '-').toString(), cardX + 54, cardY + 186);

        const toNumber = (value) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        };
        const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
        const fmtNumber = (value, digits = 1) => {
            const n = toNumber(value);
            if (n === null) return '';
            return `${Math.round(n * (10 ** digits)) / (10 ** digits)}`;
        };
        const steps = Array.isArray(brew?.recipeSteps) ? brew.recipeSteps : [];
        const derivedPourCount = steps.filter((step) => step?.type === 'pour').length;
        const derivedSwirlCount = steps.filter((step) => step?.type === 'swirl').length;
        const inValue = fmtNumber(brew?.weight, 1);
        const ratioValue = fmtNumber(brew?.ratio, 2);
        const outDerived = (() => {
            const w = toNumber(brew?.weight);
            const r = toNumber(brew?.ratio);
            if (!Number.isFinite(w) || !Number.isFinite(r)) return '';
            return fmtNumber(w * r, 1);
        })();
        const grinderValue = hasText(brew?.grinder) ? brew.grinder.trim() : '';
        const grindValue = (() => {
            if (hasText(brew?.grind)) return brew.grind.toString().trim();
            const n = toNumber(brew?.grind);
            return n === null ? '' : fmtNumber(n, 1);
        })();
        const timeValue = fmtNumber(brew?.time, 0);
        const tempValue = hasText(brew?.temp) ? brew.temp.trim() : fmtNumber(brew?.temp, 1);
        const firstDripValue = fmtNumber(brew?.firstDrip, 0);
        const maxFlowValue = fmtNumber(brew?.maxFlow, 1);
        const avgFlowValue = fmtNumber(brew?.avgFlow, 1);
        const pourCountValue = Number.isFinite(Number(brew?.pourCount))
            ? `${Math.round(Number(brew.pourCount))}`
            : (derivedPourCount > 0 ? `${derivedPourCount}` : '');
        const swirlCountValue = Number.isFinite(Number(brew?.swirlCount))
            ? `${Math.round(Number(brew.swirlCount))}`
            : (derivedSwirlCount > 0 ? `${derivedSwirlCount}` : '');

        const metrics = [
            { label: 'In', value: inValue, suffix: 'g' },
            { label: 'Ratio', value: ratioValue, suffix: '' },
            { label: 'Out', value: outDerived, suffix: 'g' },
            { label: 'Grinder', value: grinderValue, suffix: '' },
            { label: 'Grind size', value: grindValue, suffix: '' },
            { label: 'Time', value: timeValue, suffix: 's' },
            { label: 'Temp', value: tempValue, suffix: 'C' },
            { label: 'First drip', value: firstDripValue, suffix: 's' },
            { label: 'Max flow', value: maxFlowValue, suffix: 'g/s' },
            { label: 'Avg flow', value: avgFlowValue, suffix: 'g/s' },
            { label: 'Pour count', value: pourCountValue, suffix: '' },
            { label: 'Swirl count', value: swirlCountValue, suffix: '' }
        ].filter((metric) => hasText(metric.value));

        const gridX = cardX + 28;
        const gridY = cardY + 270;
        const gridW = cardW - 56;
        const colGap = 14;
        const rowGap = 14;
        const cols = 3;
        const boxW = Math.floor((gridW - (colGap * (cols - 1))) / cols);
        const boxH = 126;

        metrics.forEach((metric, index) => {
            const col = index % cols;
            const row = Math.floor(index / cols);
            const x = gridX + col * (boxW + colGap);
            const y = gridY + row * (boxH + rowGap);
            ctx.fillStyle = '#fafaf9';
            ctx.beginPath();
            ctx.roundRect(x, y, boxW, boxH, 12);
            ctx.fill();
            ctx.strokeStyle = '#e7e5e4';
            ctx.lineWidth = 1;
            ctx.stroke();

            ctx.fillStyle = '#78716c';
            ctx.font = '700 18px Nunito, sans-serif';
            ctx.fillText(metric.label.toUpperCase(), x + 14, y + 28);
            ctx.fillStyle = '#1c1917';
            ctx.font = '700 34px Nunito, sans-serif';
            const suffix = metric.suffix ? ` ${metric.suffix}` : '';
            ctx.fillText(`${metric.value}${suffix}`, x + 14, y + 82);
        });

        const rowsUsed = Math.max(1, Math.ceil(Math.max(1, metrics.length) / cols));
        let messageY = gridY + rowsUsed * (boxH + rowGap) + 22;
        if (messageY < 960) messageY = 960;

        if (message?.trim()) {
            ctx.fillStyle = '#f5f5f4';
            ctx.font = '600 30px Nunito, sans-serif';
            ctx.fillText('Message', cardX + 54, messageY);
            ctx.fillStyle = '#e7e5e4';
            ctx.font = '400 30px Nunito, sans-serif';
            drawWrappedText(ctx, message.trim(), cardX + 54, messageY + 48, cardW - 108, 40, { maxLines: 5 });
        }

        return canvasToPngFile(canvas, `moment-details-${timestamp}.png`);
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
        const appLink = typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}${window.location.search}#moments`
            : '';
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
        currentUploadMomentBrew = getCoffees().find((coffee) => coffee.id === coffeeId) || null;
        document.getElementById('uploadPhotoModal')?.classList.remove('hidden');
        const file = document.getElementById('photoInput');
        const msg = document.getElementById('photoMessage');
        const progress = document.getElementById('uploadProgress');
        if (file) file.value = '';
        if (msg) msg.value = '';
        const defaultType = document.getElementById('momentTypePhoto');
        if (defaultType) defaultType.checked = true;
        const shareOutsideCheckbox = document.getElementById('momentShareOutsideApp');
        if (shareOutsideCheckbox) shareOutsideCheckbox.checked = false;
        bindUploadMomentTypeControls();
        updateUploadMomentTypeUi();
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

    const getMomentSharedWith = (data) => {
        if (!Array.isArray(data?.sharedWith)) return [];
        return data.sharedWith
            .map((uid) => (typeof uid === 'string' ? uid.trim() : ''))
            .filter((uid) => !!uid);
    };

    const closeOpenMomentShareEditors = () => {
        document.querySelectorAll('[data-moment-share-editor="true"]').forEach((el) => el.remove());
    };

    const buildMomentShareEditor = ({ photoId, data, onSaved }) => {
        const wrapper = document.createElement('div');
        wrapper.dataset.momentShareEditor = 'true';
        wrapper.className = 'mt-2 rounded-lg border border-coffee-200 dark:border-[#57534e] bg-coffee-50 dark:bg-[#1c1917] p-2 space-y-2';

        const header = document.createElement('div');
        header.className = 'text-[11px] font-semibold uppercase text-coffee-600 dark:text-[#a8a29e]';
        header.textContent = 'In-app sharing';
        wrapper.appendChild(header);

        const following = getFollowing();
        const selectedSet = new Set(getMomentSharedWith(data));

        if (!following.length) {
            const empty = document.createElement('div');
            empty.className = 'text-xs italic text-coffee-500 dark:text-[#a8a29e]';
            empty.textContent = 'No friends followed yet.';
            wrapper.appendChild(empty);
        } else {
            const list = document.createElement('div');
            list.className = 'max-h-36 overflow-y-auto space-y-1';
            following.forEach((friend) => {
                const uid = typeof friend?.uid === 'string' ? friend.uid : '';
                if (!uid) return;
                const row = document.createElement('label');
                row.className = 'flex items-center justify-between gap-2 rounded bg-white dark:bg-[#292524] border border-coffee-100 dark:border-[#44403c] px-2 py-1.5';
                const name = document.createElement('span');
                name.className = 'text-xs text-coffee-800 dark:text-[#d6ccc2] truncate';
                name.textContent = friend?.name || uid;
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.value = uid;
                checkbox.checked = selectedSet.has(uid);
                checkbox.className = 'rounded border-coffee-300 dark:border-[#57534e]';
                row.appendChild(name);
                row.appendChild(checkbox);
                list.appendChild(row);
            });
            wrapper.appendChild(list);
        }

        const actions = document.createElement('div');
        actions.className = 'flex items-center justify-end gap-2';

        const cancelBtn = document.createElement('button');
        cancelBtn.type = 'button';
        cancelBtn.className = 'px-2 py-1 text-xs rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] hover:bg-coffee-100 dark:hover:bg-[#34302e]';
        cancelBtn.textContent = 'Close';
        cancelBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            wrapper.remove();
        });

        const saveBtn = document.createElement('button');
        saveBtn.type = 'button';
        saveBtn.className = 'px-2.5 py-1 text-xs rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            saveBtn.disabled = true;
            saveBtn.classList.add('opacity-70', 'cursor-wait');
            saveBtn.textContent = 'Saving...';
            try {
                const selected = Array.from(wrapper.querySelectorAll('input[type="checkbox"]:checked'))
                    .map((cb) => cb.value)
                    .filter((uid) => !!uid);
                await updateDoc(doc(db, 'photos', photoId), { sharedWith: selected });
                data.sharedWith = selected;
                if (typeof onSaved === 'function') onSaved(selected);
                wrapper.remove();
                alert('Moment sharing updated.');
            } catch (error) {
                console.error('Failed updating moment sharing', error);
                alert(`Failed to update sharing: ${error?.message || 'Unknown error'}`);
                saveBtn.disabled = false;
                saveBtn.classList.remove('opacity-70', 'cursor-wait');
                saveBtn.textContent = 'Save';
            }
        });

        actions.appendChild(cancelBtn);
        actions.appendChild(saveBtn);
        wrapper.appendChild(actions);
        return wrapper;
    };

    const closeUploadModal = () => {
        currentUploadMomentBrew = null;
        document.getElementById('uploadPhotoModal')?.classList.add('hidden');
    };

    const handlePhotoSubmit = async () => {
        const user = getCurrentUser();
        if (!user) return;
        const fileInput = document.getElementById('photoInput');
        const momentType = getSelectedMomentType();
        const selectedPhotoFile = fileInput?.files?.[0];
        const alsoShareOutsideApp = !!document.getElementById('momentShareOutsideApp')?.checked;
        const message = document.getElementById('photoMessage')?.value || '';
        if (momentType === 'photo' && !selectedPhotoFile) return alert('Please select a photo.');

        const uploadCoffeeId = getCurrentUploadCoffeeId();
        if (!uploadCoffeeId) return;

        const checkboxes = document.querySelectorAll('#shareWithList input[type="checkbox"]:checked');
        const sharedWith = Array.from(checkboxes).map((cb) => cb.value);
        const coffeeData = getCoffees().find((c) => c.id === uploadCoffeeId);
        if (!coffeeData) return alert('Coffee data not found.');
        if (momentType === 'graph' && !hasCapturedGraphForBrew(coffeeData)) {
            return alert('Graph option is only available when this brew has captured weight and flow data.');
        }

        const coffeeSnapshot = resolveCoffeeSnapshot(coffeeData);

        document.getElementById('uploadProgress')?.classList.remove('hidden');

        try {
            const timestamp = Date.now();
            let fileToUpload = selectedPhotoFile;
            if (momentType === 'graph') {
                fileToUpload = await buildMomentGraphFile({
                    brew: coffeeData,
                    snapshot: coffeeSnapshot,
                    message,
                    timestamp
                });
            } else if (momentType === 'details') {
                fileToUpload = await buildMomentDetailsFile({
                    brew: coffeeData,
                    snapshot: coffeeSnapshot,
                    message,
                    timestamp
                });
            }

            if (!fileToUpload) throw new Error('No moment image available.');

            const photoPath = `photos/${user.uid}/${timestamp}_${fileToUpload.name}_original`;
            const storageRef = ref(storage, photoPath);
            const originalOptions = { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true };
            const compressedOriginal = await imageCompression(fileToUpload, originalOptions);
            await uploadBytes(storageRef, compressedOriginal);

            let thumbPath = null;
            const thumbOptions = { maxSizeMB: 0.1, maxWidthOrHeight: 600, useWebWorker: true };
            try {
                const thumbFile = await imageCompression(fileToUpload, thumbOptions);
                thumbPath = `photos/${user.uid}/${timestamp}_${fileToUpload.name}_thumb`;
                const thumbRef = ref(storage, thumbPath);
                await uploadBytes(thumbRef, thumbFile);
            } catch (error) {
                console.log('Thumbnail generation failed:', error);
                thumbPath = null;
            }

            const createdAtIso = new Date().toISOString();
            const momentPayload = {
                uid: user.uid,
                uploaderName: user.displayName || 'Unknown User',
                photoPath,
                thumbPath,
                message,
                coffeeId: uploadCoffeeId,
                coffeeSnapshot,
                momentType,
                sharedWith,
                likedBy: [],
                createdAt: createdAtIso
            };
            const createdMomentRef = await addDoc(collection(db, 'photos'), momentPayload);
            closeUploadModal();

            let outsideShareError = '';
            if (alsoShareOutsideApp) {
                if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
                    outsideShareError = 'Native sharing is not supported on this device.';
                } else {
                    try {
                        await shareMoment({
                            photoId: createdMomentRef?.id,
                            data: momentPayload,
                            cardSnapshot: coffeeSnapshot,
                            cardElement: null
                        });
                    } catch (error) {
                        if (error?.name !== 'AbortError') {
                            outsideShareError = error?.message || 'Could not open device share.';
                        }
                    }
                }
            }

            if (outsideShareError) {
                alert(`Moment shared in app. Outside app share failed: ${outsideShareError}`);
            } else {
                alert('Moment shared successfully!');
            }
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
        const getMomentTypeMeta = (type) => {
            if (type === 'graph') {
                return {
                    label: 'Graph',
                    icon: 'fa-chart-line',
                    frameClass: 'border-blue-300 dark:border-blue-700',
                    accentClass: 'bg-blue-500',
                    badgeClass: 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-200',
                    iconWrapClass: 'bg-blue-600/80 text-white'
                };
            }
            if (type === 'details') {
                return {
                    label: 'Brew details',
                    icon: 'fa-list-check',
                    frameClass: 'border-emerald-300 dark:border-emerald-700',
                    accentClass: 'bg-emerald-500',
                    badgeClass: 'bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700 text-emerald-700 dark:text-emerald-200',
                    iconWrapClass: 'bg-emerald-600/80 text-white'
                };
            }
            return {
                label: 'Photo',
                icon: 'fa-image',
                frameClass: 'border-coffee-200 dark:border-[#44403c]',
                accentClass: 'bg-coffee-400 dark:bg-[#57534e]',
                badgeClass: 'bg-coffee-100 dark:bg-[#1c1917] border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2]',
                iconWrapClass: 'bg-black/55 text-white'
            };
        };

        docsWithData.forEach(({ docItem, data }) => {
            const cardSnapshot = resolveSnapshotForCard(data);
            const momentType = data?.momentType === 'graph' || data?.momentType === 'details'
                ? data.momentType
                : 'photo';
            const momentTypeMeta = getMomentTypeMeta(momentType);
            const card = document.createElement('div');
            card.id = `moment-card-${docItem.id}`;
            card.className = `bg-white dark:bg-[#292524] rounded-lg shadow-md overflow-hidden border ${momentTypeMeta.frameClass} flex flex-col relative group`;
            const accent = document.createElement('div');
            accent.className = `absolute top-0 left-0 right-0 h-1 z-[1] ${momentTypeMeta.accentClass}`;
            card.appendChild(accent);

            const cachedThumb = getCachedSignedUrl(docItem.id, 'thumb');
            const batchThumb = prefetchedThumbUrls.get(getSignedUrlCacheKey(docItem.id, 'thumb'));
            const displayUrl = cachedThumb || batchThumb || resolveLegacyUrl(data, 'thumb');
            const primaryInfo = cardSnapshot.farmer || '-';
            const secondaryInfo = cardSnapshot.roaster || cardSnapshot.origin || '-';
            if (getCurrentGalleryMode() === 'mine') {
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
            img.loading = 'lazy';
            img.className = 'w-full h-full object-cover transition-transform duration-500 group-hover:scale-110';
            img.alt = 'Brew Photo';
            img.dataset.momentId = docItem.id;
            imageWrap.appendChild(img);

            const dateBadge = document.createElement('div');
            dateBadge.className = 'absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 text-white text-xs';
            dateBadge.textContent = new Date(data.createdAt).toLocaleDateString();
            imageWrap.appendChild(dateBadge);
            card.appendChild(imageWrap);

            const body = document.createElement('div');
            body.dataset.momentBody = 'true';
            body.className = 'p-3 flex-1 flex flex-col';
            body.innerHTML = `<div class="flex justify-between items-start mb-2"><span class="text-xs font-bold text-coffee-500 dark:text-[#78716c] uppercase">${data.uploaderName}</span><div data-moment-header-actions="true" class="flex items-center gap-1"></div></div><p data-moment-message="true" class="text-sm italic text-gray-700 dark:text-gray-300 mb-3 flex-1">"${data.message || ''}"</p><div data-moment-info="true" class="bg-coffee-50 dark:bg-[#1c1917] rounded p-2 text-xs border border-coffee-100 dark:border-[#44403c]"><div class="font-bold text-coffee-800 dark:text-white truncate">${primaryInfo}</div><div class="text-coffee-600 dark:text-[#a8a29e] truncate">${secondaryInfo}</div><div class="mt-1 inline-block px-1.5 py-0.5 bg-white dark:bg-[#292524] rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] font-mono text-[10px]">${cardSnapshot.method}</div></div>`;
            if (getCurrentGalleryMode() === 'mine') {
                const headerActions = body.querySelector('[data-moment-header-actions="true"]');
                const shareBtn = document.createElement('button');
                shareBtn.type = 'button';
                shareBtn.title = 'Share moment';
                shareBtn.dataset.momentAction = 'true';
                shareBtn.className = 'text-[11px] px-2 py-1 rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] hover:bg-coffee-100 dark:hover:bg-[#34302e] inline-flex items-center gap-1';
                shareBtn.innerHTML = '<i class="fa-solid fa-share-nodes text-[10px]"></i>';
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
                headerActions?.appendChild(shareBtn);
            }
            const momentInfoEl = body.querySelector('[data-moment-info="true"]');
            const linkedBrewId = typeof data?.coffeeId === 'string' ? data.coffeeId.trim() : '';
            const ownerUid = typeof data?.uid === 'string' ? data.uid.trim() : '';
            const currentUserUid = typeof getCurrentUser()?.uid === 'string' ? getCurrentUser().uid : '';
            const isOwnMoment = !!ownerUid && !!currentUserUid && ownerUid === currentUserUid;
            const wireMomentBrewLink = () => {
                if (!momentInfoEl || !linkedBrewId || momentInfoEl.dataset.momentBrewLinked === 'true') return;
                momentInfoEl.dataset.momentBrewLinked = 'true';
                momentInfoEl.classList.add('cursor-pointer', 'hover:bg-coffee-100', 'dark:hover:bg-[#34302e]', 'transition-colors');
                momentInfoEl.title = 'Open associated brew';
                momentInfoEl.addEventListener('click', (event) => {
                    event.stopPropagation();
                    if (typeof openBrewFromMoment === 'function') {
                        openBrewFromMoment(linkedBrewId, event, ownerUid);
                    }
                });
            };
            if (getCurrentGalleryMode() === 'mine') {
                if (linkedBrewId && isOwnMoment) wireMomentBrewLink();
            } else if (momentInfoEl && linkedBrewId && ownerUid) {
                checkFriendBrewAccess({ ownerUid, brewId: linkedBrewId }).then((allowed) => {
                    if (!allowed || !momentInfoEl.isConnected) return;
                    wireMomentBrewLink();
                });
            }

            let mineManageRow = null;
            let friendsFooterRow = null;
            if (getCurrentGalleryMode() === 'mine') {
                const shareMetaWrap = document.createElement('div');
                shareMetaWrap.className = 'mt-2 flex items-center gap-2';

                const manageBtn = document.createElement('button');
                manageBtn.type = 'button';
                manageBtn.dataset.momentAction = 'true';
                manageBtn.className = 'text-[11px] px-2 py-1 rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] hover:bg-coffee-100 dark:hover:bg-[#34302e] inline-flex items-center gap-1';
                const setManageBtnLabel = () => {
                    const count = getMomentSharedWith(data).length;
                    manageBtn.innerHTML = `<i class="fa-solid fa-user-group text-[10px]"></i><span>${count}</span>`;
                    manageBtn.title = count === 0
                        ? 'Visible only to you (manage sharing)'
                        : `Shared with ${count} friend${count === 1 ? '' : 's'} (manage sharing)`;
                };
                setManageBtnLabel();
                manageBtn.addEventListener('click', (event) => {
                    event.stopPropagation();
                    const existing = body.querySelector('[data-moment-share-editor="true"]');
                    if (existing) {
                        existing.remove();
                        return;
                    }
                    closeOpenMomentShareEditors();
                    const editor = buildMomentShareEditor({
                        photoId: docItem.id,
                        data,
                        onSaved: () => setManageBtnLabel()
                    });
                    body.appendChild(editor);
                });

                shareMetaWrap.appendChild(manageBtn);
                body.appendChild(shareMetaWrap);
                mineManageRow = shareMetaWrap;
            } else {
                const footerRow = document.createElement('div');
                footerRow.className = 'mt-2 flex items-center gap-2';
                const sharedCount = getMomentSharedWith(data).length;
                const sharedReadOnly = document.createElement('div');
                sharedReadOnly.className = 'text-[11px] px-2 py-1 rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] inline-flex items-center gap-1 opacity-90';
                sharedReadOnly.innerHTML = `<i class="fa-solid fa-user-group text-[10px]"></i><span>${sharedCount}</span>`;
                sharedReadOnly.title = sharedCount === 0
                    ? 'Visible only to owner'
                    : `Shared with ${sharedCount} friend${sharedCount === 1 ? '' : 's'}`;
                footerRow.appendChild(sharedReadOnly);
                body.appendChild(footerRow);
                friendsFooterRow = footerRow;
            }

            const likesRow = document.createElement('div');
            likesRow.className = 'mt-2 flex items-center justify-between gap-2';
            const likeControl = document.createElement('button');
            likeControl.type = 'button';
            likeControl.dataset.momentAction = 'true';
            likeControl.className = 'text-[11px] px-2 py-1 rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] inline-flex items-center gap-1';

            const updateLikesUi = () => {
                const count = likesModule.getLikeCount(data);

                const isMineTab = getCurrentGalleryMode() === 'mine';
                const canLike = !isMineTab && likesModule.canLikeMoment(data);
                const liked = likesModule.hasLiked(data);
                const showFilledIcon = liked || (isMineTab && count > 0);
                const iconClass = showFilledIcon ? 'fa-solid text-red-500' : 'fa-regular text-coffee-500 dark:text-[#a8a29e]';
                likeControl.innerHTML = `<i class="${iconClass} fa-heart text-[10px]"></i><span>${count}</span>`;
                likeControl.disabled = !canLike;
                likeControl.classList.toggle('cursor-pointer', canLike);
                likeControl.classList.toggle('hover:bg-coffee-100', canLike);
                likeControl.classList.toggle('dark:hover:bg-[#34302e]', canLike);
                likeControl.classList.toggle('opacity-80', !canLike);
                likesRow.classList.toggle('hidden', isMineTab && count <= 0);
            };

            likeControl.addEventListener('click', async (event) => {
                event.stopPropagation();
                if (!likesModule.canLikeMoment(data)) return;
                likeControl.disabled = true;
                likeControl.classList.add('opacity-70', 'cursor-wait');
                try {
                    const nowLiked = await likesModule.toggleLike({ photoId: docItem.id, data });
                    const currentLikedBy = Array.isArray(data.likedBy) ? [...data.likedBy] : [];
                    const uid = getCurrentUser()?.uid;
                    if (uid) {
                        data.likedBy = nowLiked
                            ? Array.from(new Set([...currentLikedBy, uid]))
                            : currentLikedBy.filter((entryUid) => entryUid !== uid);
                    }
                    updateLikesUi();
                } catch (error) {
                    console.error('Failed toggling moment like', error);
                    alert(`Could not update like: ${error?.message || 'Unknown error'}`);
                } finally {
                    likeControl.disabled = false;
                    likeControl.classList.remove('opacity-70', 'cursor-wait');
                }
            });

            likesRow.appendChild(likeControl);
            updateLikesUi();
            if (getCurrentGalleryMode() === 'mine' && mineManageRow) {
                likesRow.className = 'flex items-center gap-2';
                likesRow.classList.remove('mt-2');
                mineManageRow.insertBefore(likesRow, mineManageRow.firstChild);
            } else if (friendsFooterRow) {
                likesRow.className = 'flex items-center gap-2';
                likesRow.classList.remove('mt-2');
                friendsFooterRow.insertBefore(likesRow, friendsFooterRow.firstChild);
            } else {
                body.appendChild(likesRow);
            }

            const commentsWrap = document.createElement('div');
            commentsWrap.className = 'mt-2';
            commentsWrap.dataset.momentAction = 'true';

            const commentsToolbar = document.createElement('div');
            commentsToolbar.className = 'flex items-center justify-between gap-2';
            commentsToolbar.dataset.momentAction = 'true';

            const commentBtn = document.createElement('button');
            commentBtn.type = 'button';
            commentBtn.dataset.momentAction = 'true';
            commentBtn.className = 'text-[11px] px-2 py-1 rounded border border-coffee-200 dark:border-[#57534e] text-coffee-700 dark:text-[#d6ccc2] hover:bg-coffee-100 dark:hover:bg-[#34302e] inline-flex items-center gap-1';
            commentBtn.innerHTML = '<i class="fa-regular fa-comment text-[10px]"></i><span>0 comments</span>';
            if (getCurrentGalleryMode() === 'mine' && mineManageRow) {
                commentBtn.classList.add('ml-auto');
                mineManageRow.appendChild(commentBtn);
            } else if (friendsFooterRow) {
                commentBtn.classList.add('ml-auto');
                friendsFooterRow.appendChild(commentBtn);
            } else {
                commentsToolbar.appendChild(commentBtn);
                commentsWrap.appendChild(commentsToolbar);
            }

            const commentsPanel = document.createElement('div');
            commentsPanel.className = 'hidden mt-2 rounded-lg border border-coffee-200 dark:border-[#57534e] bg-coffee-50 dark:bg-[#1c1917] p-2 space-y-2';
            commentsPanel.dataset.momentAction = 'true';

            const commentsList = document.createElement('div');
            commentsList.className = 'max-h-36 overflow-y-auto space-y-1';
            commentsList.dataset.momentAction = 'true';

            const commentComposer = document.createElement('div');
            commentComposer.className = 'flex items-end gap-2';
            commentComposer.dataset.momentAction = 'true';

            const commentInput = document.createElement('textarea');
            commentInput.rows = 2;
            commentInput.maxLength = 1000;
            commentInput.placeholder = 'Write a comment...';
            commentInput.className = 'flex-1 bg-white dark:bg-[#292524] border border-coffee-200 dark:border-[#44403c] rounded px-2 py-1.5 text-xs text-coffee-900 dark:text-white';
            commentInput.dataset.momentAction = 'true';

            const commentPostBtn = document.createElement('button');
            commentPostBtn.type = 'button';
            commentPostBtn.dataset.momentAction = 'true';
            commentPostBtn.className = 'px-2.5 py-1.5 text-xs rounded bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white';
            commentPostBtn.textContent = 'Post';

            commentComposer.appendChild(commentInput);
            commentComposer.appendChild(commentPostBtn);
            commentsPanel.appendChild(commentsList);
            commentsPanel.appendChild(commentComposer);
            commentsWrap.appendChild(commentsPanel);
            body.appendChild(commentsWrap);

            let commentsLoaded = false;
            let commentsEntries = [];
            const setCommentBtnLabel = (count) => {
                commentBtn.innerHTML = `<i class="fa-regular fa-comment text-[10px]"></i><span>${count} comment${count === 1 ? '' : 's'}</span>`;
            };

            const formatCommentDate = (value) => {
                const parsed = new Date(value);
                if (Number.isNaN(parsed.getTime())) return '';
                return parsed.toLocaleString([], {
                    year: 'numeric',
                    month: 'numeric',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            };

            const renderComments = () => {
                commentsList.innerHTML = '';
                commentsEntries.forEach((entry) => {
                    const row = document.createElement('div');
                    row.className = 'rounded bg-white dark:bg-[#292524] border border-coffee-100 dark:border-[#44403c] px-2 py-1.5';
                    row.dataset.momentAction = 'true';

                    const meta = document.createElement('div');
                    meta.className = 'flex items-center justify-between gap-2 mb-1';
                    meta.dataset.momentAction = 'true';

                    const author = document.createElement('span');
                    author.className = 'text-[11px] font-semibold text-coffee-700 dark:text-[#d6ccc2] truncate';
                    author.textContent = entry?.uploaderName || 'Unknown';
                    author.dataset.momentAction = 'true';

                    const date = document.createElement('span');
                    date.className = 'text-[10px] text-coffee-500 dark:text-[#a8a29e]';
                    date.textContent = formatCommentDate(entry?.createdAt);
                    date.dataset.momentAction = 'true';

                    const text = document.createElement('p');
                    text.className = 'text-xs text-coffee-800 dark:text-[#e7e5e4] whitespace-pre-wrap break-words';
                    text.textContent = (entry?.text || '').toString();
                    text.dataset.momentAction = 'true';

                    meta.appendChild(author);
                    meta.appendChild(date);
                    row.appendChild(meta);
                    row.appendChild(text);
                    commentsList.appendChild(row);
                });

                if (!commentsEntries.length) {
                    const empty = document.createElement('div');
                    empty.className = 'text-xs italic text-coffee-500 dark:text-[#a8a29e]';
                    empty.textContent = 'No comments yet.';
                    empty.dataset.momentAction = 'true';
                    commentsList.appendChild(empty);
                }

                const commentCount = commentsEntries.length;
                setCommentBtnLabel(commentCount);
            };

            const loadComments = async () => {
                commentsEntries = await commentsModule.listComments({ photoId: docItem.id, max: 30 });
                commentsLoaded = true;
                renderComments();
            };

            // Prime comment count during card render so button label is correct before first click.
            loadComments().catch(() => {
                // Keep default 0 comments label if prefetch fails.
            });

            commentBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const willShow = commentsPanel.classList.contains('hidden');
                commentsPanel.classList.toggle('hidden', !willShow);
                if (!willShow) return;
                if (commentsLoaded) return;
                commentsList.innerHTML = '<div class="text-xs italic text-coffee-500 dark:text-[#a8a29e]">Loading comments...</div>';
                try {
                    await loadComments();
                } catch (error) {
                    commentsList.innerHTML = '<div class="text-xs italic text-red-500">Could not load comments.</div>';
                }
            });

            commentPostBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const text = commentInput.value.trim();
                if (!text) return;
                commentPostBtn.disabled = true;
                commentPostBtn.classList.add('opacity-70', 'cursor-wait');
                try {
                    const created = await commentsModule.addComment({ photoId: docItem.id, text });
                    commentInput.value = '';
                    commentsEntries = [created, ...commentsEntries];
                    commentsLoaded = true;
                    commentsPanel.classList.remove('hidden');
                    renderComments();
                } catch (error) {
                    console.error('Failed creating comment', error);
                    alert(`Could not add comment: ${error?.message || 'Unknown error'}`);
                } finally {
                    commentPostBtn.disabled = false;
                    commentPostBtn.classList.remove('opacity-70', 'cursor-wait');
                }
            });

            card.appendChild(body);
            grid.appendChild(card);

            img.addEventListener('click', async (event) => {
                event.stopPropagation();
                const fullUrl = await resolveSignedPhotoUrl({
                    photoId: docItem.id,
                    variant: 'full',
                    data
                });
                img.dataset.lightboxFullUrl = fullUrl;
                const galleryImages = Array.from(document.querySelectorAll('#galleryGrid img[data-moment-id]'));
                const items = galleryImages
                    .map((imageEl) => ({
                        url: imageEl.dataset.lightboxFullUrl || imageEl.currentSrc || imageEl.src || '',
                        alt: imageEl.alt || 'Moment image'
                    }))
                    .filter((item) => !!item.url);
                const startIndex = Math.max(0, galleryImages.indexOf(img));
                openExternalUrl(fullUrl, { items, startIndex });
            });
        });
    };

    const deletePhoto = async (photoId, photoRefValue, thumbRefValue, ev) => {
        if (ev) ev.stopPropagation();
        const shouldDelete = await openAppConfirm({
            title: 'Delete moment?',
            message: 'This permanently deletes the moment and cannot be undone.',
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
            alert('Moment deleted successfully.');
            const activeTab = getCurrentGalleryMode() || 'shared';
            await switchGalleryTab(activeTab);
        } catch (err) {
            console.error('Deletion failed', err);
            alert(`Error deleting moment: ${err.message}`);
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
