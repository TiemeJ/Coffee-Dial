const createGalleryLikesModule = ({
    getCurrentUser,
    db,
    doc,
    updateDoc
}) => {
    if (!db || !doc || !updateDoc) {
        throw new Error('createGalleryLikesModule requires { db, doc, updateDoc }');
    }
    const DEFAULT_REACTION_EMOJI = '❤️';

    const getCurrentUid = () => {
        const uid = getCurrentUser?.()?.uid;
        return typeof uid === 'string' ? uid : '';
    };

    const normalizeUids = (items) =>
        Array.isArray(items)
            ? items
                .map((uid) => (typeof uid === 'string' ? uid.trim() : ''))
                .filter((uid) => !!uid)
            : [];

    const getReactions = (data) => {
        const reactions = (data?.reactions && typeof data.reactions === 'object') ? data.reactions : {};
        const normalized = {};
        Object.keys(reactions).forEach((emoji) => {
            normalized[emoji] = normalizeUids(reactions[emoji]);
        });
        return normalized;
    };

    const getReactionCount = (data) => {
        const reactions = getReactions(data);
        const users = new Set();
        Object.values(reactions).forEach((uids) => {
            (uids || []).forEach((uid) => users.add(uid));
        });
        return users.size;
    };

    const getTopReactionEmoji = (data) => {
        const reactions = getReactions(data);
        let topEmoji = '';
        let topCount = 0;
        Object.entries(reactions).forEach(([emoji, uids]) => {
            const count = Array.isArray(uids) ? uids.length : 0;
            if (count > topCount) {
                topCount = count;
                topEmoji = emoji;
            }
        });
        return topEmoji;
    };

    const getUserReaction = (data) => {
        const uid = getCurrentUid();
        if (!uid) return '';
        const reactions = getReactions(data);
        for (const [emoji, uids] of Object.entries(reactions)) {
            if (uids.includes(uid)) return emoji;
        }
        return '';
    };

    const hasLiked = (data) => {
        const uid = getCurrentUid();
        if (!uid) return false;
        return !!getUserReaction(data);
    };

    const canLikeMoment = (data) => {
        const uid = getCurrentUid();
        const ownerUid = typeof data?.uid === 'string' ? data.uid.trim() : '';
        if (!uid || !ownerUid) return false;
        return uid !== ownerUid;
    };

    const setReaction = async ({ photoId, data, emoji }) => {
        const uid = getCurrentUid();
        if (!uid || !photoId || !canLikeMoment(data)) return false;
        const selectedEmoji = (emoji || '').trim();
        const reactions = getReactions(data);
        const currentEmoji = getUserReaction(data);
        Object.keys(reactions).forEach((key) => {
            reactions[key] = reactions[key].filter((entryUid) => entryUid !== uid);
        });
        if (selectedEmoji && selectedEmoji !== currentEmoji) {
            const bucket = Array.isArray(reactions[selectedEmoji]) ? reactions[selectedEmoji] : [];
            reactions[selectedEmoji] = Array.from(new Set([...bucket, uid]));
        }
        await updateDoc(doc(db, 'photos', photoId), {
            reactions
        });
        return selectedEmoji && selectedEmoji !== currentEmoji ? selectedEmoji : '';
    };

    return {
        DEFAULT_REACTION_EMOJI,
        getReactions,
        getReactionCount,
        getTopReactionEmoji,
        getUserReaction,
        hasLiked,
        canLikeMoment,
        setReaction
    };
};

const createGalleryCommentsModule = ({
    getCurrentUser,
    db,
    collection,
    doc,
    deleteDoc,
    updateDoc,
    query,
    orderBy,
    limit,
    getDocs,
    addDoc
}) => {
    if (!db || !collection || !doc || !deleteDoc || !updateDoc || !query || !orderBy || !limit || !getDocs || !addDoc) {
        throw new Error('createGalleryCommentsModule requires { db, collection, doc, deleteDoc, updateDoc, query, orderBy, limit, getDocs, addDoc }');
    }

    const normalizeCommentText = (text) => (text ?? '').toString().trim();

    const listComments = async ({ photoId, max = 30 }) => {
        if (!photoId) return [];
        const commentsQuery = query(
            collection(db, 'photos', photoId, 'comments'),
            orderBy('createdAt', 'desc'),
            limit(Math.max(1, max))
        );
        const snapshot = await getDocs(commentsQuery);
        return snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
        }));
    };

    const addComment = async ({ photoId, text }) => {
        const user = getCurrentUser?.();
        if (!user?.uid) throw new Error('Please sign in first.');
        if (!photoId) throw new Error('Moment not found.');

        const normalizedText = normalizeCommentText(text);
        if (!normalizedText) throw new Error('Please enter a comment.');
        if (normalizedText.length > 1000) throw new Error('Comment is too long.');

        const payload = {
            uid: user.uid,
            uploaderName: user.displayName || 'Unknown User',
            text: normalizedText,
            createdAt: new Date().toISOString()
        };
        const createdRef = await addDoc(collection(db, 'photos', photoId, 'comments'), payload);
        try {
            await updateDoc(doc(db, 'photos', photoId), {
                lastCommentAt: payload.createdAt,
                lastCommentByUid: user.uid
            });
        } catch (error) {
            console.warn('Could not update moment comment metadata:', error);
        }
        return {
            id: createdRef.id,
            ...payload
        };
    };

    const deleteComment = async ({ photoId, commentId, commentUid }) => {
        const user = getCurrentUser?.();
        if (!user?.uid) throw new Error('Please sign in first.');
        if (!photoId || !commentId) throw new Error('Comment not found.');
        if (commentUid && commentUid !== user.uid) throw new Error('You can only delete your own comments.');

        await deleteDoc(doc(db, 'photos', photoId, 'comments', commentId));
        try {
            const latest = await listComments({ photoId, max: 1 });
            const latestComment = latest[0] || null;
            await updateDoc(doc(db, 'photos', photoId), {
                lastCommentAt: latestComment?.createdAt || null,
                lastCommentByUid: latestComment?.uid || null
            });
        } catch (error) {
            console.warn('Could not refresh moment comment metadata after delete:', error);
        }
    };

    return {
        listComments,
        addComment,
        deleteComment
    };
};

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
    openBrewFromMoment,
    getCoffeeScale
}) => {
    const { db, addDoc, collection, query, where, orderBy, limit, startAfter, getDoc, getDocs, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, onSnapshot } = dataService || {};
    const { storage, ref, uploadBytes, deleteObject } = storageService || {};
    const { functions, httpsCallable } = functionsService || {};

    if (!db || !addDoc || !collection || !query || !where || !orderBy || !limit || !startAfter || !getDoc || !getDocs || !doc || !updateDoc || !deleteDoc || !arrayUnion || !arrayRemove || !onSnapshot) {
        throw new Error('createGalleryModule requires dataService { db, addDoc, collection, query, where, orderBy, limit, startAfter, getDoc, getDocs, doc, updateDoc, deleteDoc, arrayUnion, arrayRemove, onSnapshot }');
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
        doc,
        deleteDoc,
        updateDoc,
        query,
        orderBy,
        limit,
        getDocs,
        addDoc
    });
    const signedUrlCache = new Map();
    const preparedMomentShares = new Map();
    const momentBrewAccessCache = new Map();
    const liveCommentUnsubs = new Set();
    const unreadCommentMomentIds = new Set();
    const unreadMineCommentMomentIds = new Set();
    const unreadSharedCommentMomentIds = new Set();
    let currentUploadMomentBrew = null;
    let galleryNotificationBaseline = null;
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

    const clearLiveCommentListeners = () => {
        liveCommentUnsubs.forEach((unsub) => {
            try {
                unsub();
            } catch (_) {
                // Ignore unsubscribe errors.
            }
        });
        liveCommentUnsubs.clear();
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

    const toDate = (value) => {
        if (!value) return null;
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    };

    const getNotificationBaselineDate = () => {
        const candidate = galleryNotificationBaseline || getLastGalleryVisit();
        return toDate(candidate);
    };

    const isUnreadCommentForSession = (commentEntry, momentOwnerUid = '') => {
        const baseline = getNotificationBaselineDate();
        if (!baseline) return false;
        const commentDate = toDate(commentEntry?.createdAt);
        if (!commentDate || commentDate <= baseline) return false;
        const currentUid = getCurrentUser()?.uid || '';
        if (commentEntry?.uid && commentEntry.uid === currentUid) return false;
        if (!momentOwnerUid) return true;
        return true;
    };

    const renderGalleryTabCommentBadges = () => {
        const sharedBadge = document.getElementById('tabGallerySharedBadge');
        const mineBadge = document.getElementById('tabGalleryMineBadge');
        if (sharedBadge) sharedBadge.classList.toggle('hidden', unreadSharedCommentMomentIds.size === 0);
        if (mineBadge) mineBadge.classList.toggle('hidden', unreadMineCommentMomentIds.size === 0);
    };

    const collectTabMomentIds = async (tab, maxMoments = 60) => {
        const user = getCurrentUser();
        if (!user?.uid) return [];
        const constraints = [orderBy('createdAt', 'desc'), limit(Math.max(1, maxMoments))];
        const q = tab === 'mine'
            ? query(collection(db, 'photos'), where('uid', '==', user.uid), ...constraints)
            : query(collection(db, 'photos'), where('sharedWith', 'array-contains', user.uid), ...constraints);
        const snapshot = await getDocs(q);
        return snapshot.docs.map((docItem) => ({ id: docItem.id, data: docItem.data() }));
    };

    const refreshGalleryCommentIndicators = async () => {
        const baseline = getNotificationBaselineDate();
        unreadCommentMomentIds.clear();
        unreadMineCommentMomentIds.clear();
        unreadSharedCommentMomentIds.clear();
        if (!baseline) {
            renderGalleryTabCommentBadges();
            return;
        }

        const evaluateTab = async (tab) => {
            const moments = await collectTabMomentIds(tab, 60);
            if (!moments.length) return false;
            const states = await Promise.all(moments.map(async ({ id, data }) => {
                try {
                    const latest = await commentsModule.listComments({ photoId: id, max: 1 });
                    if (!latest.length) return false;
                    const unread = isUnreadCommentForSession(latest[0], data?.uid || '');
                    if (unread) {
                        unreadCommentMomentIds.add(id);
                        if (tab === 'mine') unreadMineCommentMomentIds.add(id);
                        else unreadSharedCommentMomentIds.add(id);
                    }
                    return unread;
                } catch (_) {
                    return false;
                }
            }));
            return states.some(Boolean);
        };

        try {
            await Promise.all([
                evaluateTab('mine'),
                evaluateTab('shared')
            ]);
        } catch (error) {
            console.warn('Could not refresh gallery comment indicators:', error);
            unreadCommentMomentIds.clear();
            unreadMineCommentMomentIds.clear();
            unreadSharedCommentMomentIds.clear();
        }
        renderGalleryTabCommentBadges();
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

    const buildMomentGraphSnapshot = (brew) => {
        const normalizeSamples = (samples, valueKey) => {
            if (!Array.isArray(samples)) return [];
            return samples
                .filter((sample) => Number.isFinite(Number(sample?.tMs)) && Number.isFinite(Number(sample?.[valueKey])))
                .map((sample) => ({
                    tMs: Number(sample.tMs),
                    [valueKey]: Number(sample[valueKey])
                }));
        };

        const captureSamples = normalizeSamples(brew?.scaleCapture?.samples, 'w');
        const flowSamples = normalizeSamples(brew?.scaleFlowCapture?.samples, 'flow');
        const rawSamples = Array.isArray(brew?.scaleRawCapture?.samples)
            ? brew.scaleRawCapture.samples
                .filter((sample) => Number.isFinite(Number(sample?.tMs)) && Number.isFinite(Number(sample?.w)))
                .map((sample) => ({ tMs: Number(sample.tMs), w: Number(sample.w) }))
            : [];

        return {
            capture: {
                startAt: brew?.scaleCapture?.startAt || null,
                samples: captureSamples
            },
            flowCapture: {
                startAt: brew?.scaleFlowCapture?.startAt || brew?.scaleCapture?.startAt || null,
                samples: flowSamples
            },
            rawCapture: {
                startAt: brew?.scaleRawCapture?.startAt || brew?.scaleCapture?.startAt || null,
                samples: rawSamples
            },
            firstDrip: Number.isFinite(Number(brew?.firstDrip)) ? Number(brew.firstDrip) : null,
            elapsedSeconds: Number.isFinite(Number(brew?.time)) ? Number(brew.time) : null,
            recipeSteps: Array.isArray(brew?.recipeSteps) ? brew.recipeSteps : []
        };
    };

    const hasRenderableMomentGraph = (graphSnapshot) => {
        const weightSamples = Array.isArray(graphSnapshot?.capture?.samples) ? graphSnapshot.capture.samples : [];
        const flowSamples = Array.isArray(graphSnapshot?.flowCapture?.samples) ? graphSnapshot.flowCapture.samples : [];
        return weightSamples.length > 0 || flowSamples.length > 0;
    };

    const renderMomentGraphCanvas = (targetCanvas, graphSnapshot) => {
        if (!targetCanvas || !hasRenderableMomentGraph(graphSnapshot)) return false;
        const coffeeScale = typeof getCoffeeScale === 'function' ? getCoffeeScale() : null;
        if (!coffeeScale?.renderGraphTo) return false;
        coffeeScale.renderGraphTo(targetCanvas, graphSnapshot);
        return true;
    };

    let momentDetailsTooltipEl = null;
    const ensureMomentDetailsTooltip = () => {
        if (momentDetailsTooltipEl) return momentDetailsTooltipEl;
        const el = document.createElement('div');
        el.style.position = 'fixed';
        el.style.zIndex = '10050';
        el.style.background = 'rgba(15, 23, 42, 0.95)';
        el.style.color = '#e2e8f0';
        el.style.border = '1px solid rgba(148, 163, 184, 0.4)';
        el.style.borderRadius = '8px';
        el.style.padding = '8px 10px';
        el.style.font = '12px system-ui';
        el.style.lineHeight = '1.4';
        el.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.35)';
        el.style.pointerEvents = 'none';
        el.style.maxWidth = '220px';
        el.style.display = 'none';
        document.body.appendChild(el);
        momentDetailsTooltipEl = el;
        return el;
    };

    const showMomentDetailsTooltip = (clientX, clientY, text) => {
        const content = (text || '').toString().trim();
        if (!content) return;
        const el = ensureMomentDetailsTooltip();
        el.textContent = content;
        el.style.display = 'block';
        const offset = 40;
        let left = clientX - offset;
        let top = clientY - offset;
        const rect = el.getBoundingClientRect();
        if (left - rect.width < 8) left = clientX + offset;
        else left -= rect.width;
        if (top - rect.height < 8) top = clientY + offset;
        else top -= rect.height;
        el.style.left = `${Math.max(8, left)}px`;
        el.style.top = `${Math.max(8, top)}px`;
    };

    const hideMomentDetailsTooltip = () => {
        if (!momentDetailsTooltipEl) return;
        momentDetailsTooltipEl.style.display = 'none';
    };

    const bindMomentDetailsTooltip = (target, text) => {
        if (!target || target.dataset.detailsTooltipBound === 'true') return;
        const tooltipText = (text || '').toString().trim();
        if (!tooltipText) return;
        target.dataset.detailsTooltipBound = 'true';
        target.addEventListener('pointerenter', (event) => {
            showMomentDetailsTooltip(event.clientX, event.clientY, tooltipText);
        });
        target.addEventListener('pointermove', (event) => {
            showMomentDetailsTooltip(event.clientX, event.clientY, tooltipText);
        });
        target.addEventListener('pointerleave', hideMomentDetailsTooltip);
        target.addEventListener('pointercancel', hideMomentDetailsTooltip);
    };

    const emojiSegmenter = (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function')
        ? new Intl.Segmenter(undefined, { granularity: 'grapheme' })
        : null;
    const isEmojiGrapheme = (segment) => /[\p{Extended_Pictographic}\uFE0F\u20E3]/u.test(segment || '');
    const splitToGraphemes = (text) => {
        const value = (text || '').toString();
        if (!value) return [];
        if (emojiSegmenter) {
            return Array.from(emojiSegmenter.segment(value), (item) => item.segment);
        }
        return Array.from(value);
    };
    const EMOTICON_PREFIX = '(^|[\\s([{"\'`])';
    const EMOTICON_SUFFIX = '(?=$|[\\s)\\]}\',"!?.;:])';
    const EMOTICON_RULES = [
        { regex: new RegExp(`${EMOTICON_PREFIX}<3${EMOTICON_SUFFIX}`, 'g'), emoji: '❤️' },
        { regex: new RegExp(`${EMOTICON_PREFIX}</3${EMOTICON_SUFFIX}`, 'g'), emoji: '💔' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\*${EMOTICON_SUFFIX}`, 'g'), emoji: '😘' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\*${EMOTICON_SUFFIX}`, 'g'), emoji: '😘' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\)${EMOTICON_SUFFIX}`, 'g'), emoji: '🙂' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\)${EMOTICON_SUFFIX}`, 'g'), emoji: '🙂' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\]${EMOTICON_SUFFIX}`, 'g'), emoji: '🙂' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\]${EMOTICON_SUFFIX}`, 'g'), emoji: '🙂' },
        { regex: new RegExp(`${EMOTICON_PREFIX};-\\)${EMOTICON_SUFFIX}`, 'g'), emoji: '😉' },
        { regex: new RegExp(`${EMOTICON_PREFIX};\\)${EMOTICON_SUFFIX}`, 'g'), emoji: '😉' },
        { regex: new RegExp(`${EMOTICON_PREFIX};-\\]${EMOTICON_SUFFIX}`, 'g'), emoji: '😉' },
        { regex: new RegExp(`${EMOTICON_PREFIX};\\]${EMOTICON_SUFFIX}`, 'g'), emoji: '😉' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-D${EMOTICON_SUFFIX}`, 'g'), emoji: '😄' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:D${EMOTICON_SUFFIX}`, 'g'), emoji: '😄' },
        { regex: new RegExp(`${EMOTICON_PREFIX}XD${EMOTICON_SUFFIX}`, 'gi'), emoji: '😆' },
        { regex: new RegExp(`${EMOTICON_PREFIX}X-D${EMOTICON_SUFFIX}`, 'gi'), emoji: '😆' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-P${EMOTICON_SUFFIX}`, 'gi'), emoji: '😛' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:P${EMOTICON_SUFFIX}`, 'gi'), emoji: '😛' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-p${EMOTICON_SUFFIX}`, 'g'), emoji: '😛' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:p${EMOTICON_SUFFIX}`, 'g'), emoji: '😛' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\|${EMOTICON_SUFFIX}`, 'g'), emoji: '😐' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\|${EMOTICON_SUFFIX}`, 'g'), emoji: '😐' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-/${EMOTICON_SUFFIX}`, 'g'), emoji: '😕' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:/${EMOTICON_SUFFIX}`, 'g'), emoji: '😕' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\\\${EMOTICON_SUFFIX}`, 'g'), emoji: '😕' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\\\${EMOTICON_SUFFIX}`, 'g'), emoji: '😕' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-O${EMOTICON_SUFFIX}`, 'gi'), emoji: '😮' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:O${EMOTICON_SUFFIX}`, 'gi'), emoji: '😮' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-o${EMOTICON_SUFFIX}`, 'g'), emoji: '😮' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:o${EMOTICON_SUFFIX}`, 'g'), emoji: '😮' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-S${EMOTICON_SUFFIX}`, 'gi'), emoji: '😖' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:S${EMOTICON_SUFFIX}`, 'gi'), emoji: '😖' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-s${EMOTICON_SUFFIX}`, 'g'), emoji: '😖' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:s${EMOTICON_SUFFIX}`, 'g'), emoji: '😖' },
        { regex: new RegExp(`${EMOTICON_PREFIX}'\\(:${EMOTICON_SUFFIX}`, 'g'), emoji: '😢' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\'\\(${EMOTICON_SUFFIX}`, 'g'), emoji: '😢' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\'\\(${EMOTICON_SUFFIX}`, 'g'), emoji: '😢' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\'\\)${EMOTICON_SUFFIX}`, 'g'), emoji: '😂' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\'\\)${EMOTICON_SUFFIX}`, 'g'), emoji: '😂' },
        { regex: new RegExp(`${EMOTICON_PREFIX}>:\\(${EMOTICON_SUFFIX}`, 'g'), emoji: '😠' },
        { regex: new RegExp(`${EMOTICON_PREFIX}>:-\\(${EMOTICON_SUFFIX}`, 'g'), emoji: '😠' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\(${EMOTICON_SUFFIX}`, 'g'), emoji: '🙁' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\(${EMOTICON_SUFFIX}`, 'g'), emoji: '🙁' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\[${EMOTICON_SUFFIX}`, 'g'), emoji: '🙁' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\[${EMOTICON_SUFFIX}`, 'g'), emoji: '🙁' },
        { regex: new RegExp(`${EMOTICON_PREFIX}D:${EMOTICON_SUFFIX}`, 'g'), emoji: '😱' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:-\\$${EMOTICON_SUFFIX}`, 'g'), emoji: '😳' },
        { regex: new RegExp(`${EMOTICON_PREFIX}:\\$${EMOTICON_SUFFIX}`, 'g'), emoji: '😳' },
        { regex: new RegExp(`${EMOTICON_PREFIX}B-\\)${EMOTICON_SUFFIX}`, 'gi'), emoji: '😎' },
        { regex: new RegExp(`${EMOTICON_PREFIX}B\\)${EMOTICON_SUFFIX}`, 'gi'), emoji: '😎' }
    ];
    const parseEmoticonsToEmoji = (text) => {
        let value = (text || '').toString();
        EMOTICON_RULES.forEach(({ regex, emoji }) => {
            value = value.replace(regex, (_, prefix) => `${prefix}${emoji}`);
        });
        return value;
    };
    const buildEmojiTextFragment = (text) => {
        const fragment = document.createDocumentFragment();
        splitToGraphemes(parseEmoticonsToEmoji(text)).forEach((segment) => {
            if (isEmojiGrapheme(segment)) {
                const emoji = document.createElement('span');
                emoji.className = 'inline-block not-italic align-[-0.08em] leading-none';
                emoji.style.fontFamily = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
                emoji.textContent = segment;
                fragment.appendChild(emoji);
                return;
            }
            fragment.appendChild(document.createTextNode(segment));
        });
        return fragment;
    };

    const QUICK_REACTION_EMOJIS = ['❤️', '👍', '🔥', '😍', '☕', '😂'];
    const FULL_REACTION_EMOJIS = [
        '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😍', '🥰', '😘', '😗', '😙', '😚',
        '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '🤩', '😏', '😌', '😴', '🤤', '😪', '😵', '🤯', '🤗',
        '🤔', '🫡', '🫠', '😶', '🫥', '😐', '🫤', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😳', '🥺', '🥹',
        '😢', '😭', '😤', '😠', '😡', '🤬', '🤐', '🤢', '🤮', '🤒', '🤕', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓',
        '🤠', '😈', '👿', '💀', '☠️', '🤡', '👻', '👽', '🤖', '💩', '👋', '🤚', '🖐️', '✋', '🖖', '🫱', '🫲', '🫳', '🫴',
        '👌', '🤌', '🤏', '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '🫵', '👍', '👎',
        '👏', '🙌', '🫶', '👐', '🤲', '🙏', '💪', '🫂', '🫀', '🧠', '👀', '👁️', '🧡', '💛', '💚', '💙', '💜', '🖤',
        '🤍', '🤎', '❤️', '🩷', '🩵', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '🔥', '✨', '⭐', '🌟',
        '💫', '⚡', '💥', '☕', '🍵', '🥤', '🍺', '🍻', '🍷', '🥂', '🍾', '🍕', '🍔', '🍟', '🌮', '🍩', '🍪', '🍫', '🎂',
        '🍰', '🍓', '🍒', '🍇', '🍉', '🍋', '🍍', '🥑', '🥕', '🌶️', '🥐', '🥨', '🥯', '🧀', '🍳', '🥓', '🎉', '🎊', '🎈',
        '🎁', '🏆', '🥇', '🥈', '🥉', '⚽', '🏀', '🏐', '🎾', '🎯', '🎮', '🎵', '🎶', '🚀', '🌈', '🌞', '🌙', '⭐', '🌍',
        '🌊', '🍀', '🌸', '🌹', '🌻', '🫶', '🫰'
    ];
    let reactionPickerEl = null;
    let reactionPickerModalEl = null;
    let reactionPickerTarget = null;
    let reactionPickerModalTarget = null;

    const closeReactionPicker = () => {
        if (reactionPickerEl) reactionPickerEl.classList.add('hidden');
        reactionPickerTarget = null;
    };

    const closeReactionPickerModal = () => {
        if (!reactionPickerModalEl) return;
        reactionPickerModalEl.classList.add('hidden');
        reactionPickerModalTarget = null;
    };

    const applyReactionPickerSelection = async (emoji, useModalTarget = false) => {
        const target = useModalTarget ? reactionPickerModalTarget : reactionPickerTarget;
        if (!target || typeof target.onSelect !== 'function') return;
        await target.onSelect(emoji);
        if (useModalTarget) closeReactionPickerModal();
        closeReactionPicker();
    };

    const ensureReactionPicker = () => {
        if (reactionPickerEl) return reactionPickerEl;
        const picker = document.createElement('div');
        picker.id = 'momentReactionPicker';
        picker.className = 'hidden fixed z-[10060] bg-white dark:bg-[#292524] border border-coffee-200 dark:border-[#57534e] rounded-xl shadow-xl p-2';
        picker.dataset.momentAction = 'true';
        const row = document.createElement('div');
        row.className = 'flex items-center gap-1';
        const clearBtn = document.createElement('button');
        clearBtn.type = 'button';
        clearBtn.className = 'w-8 h-8 rounded-lg border border-coffee-200 dark:border-[#57534e] hover:bg-coffee-100 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] text-sm';
        clearBtn.innerHTML = '<i class="fa-solid fa-ban"></i>';
        clearBtn.title = 'Remove reaction';
        clearBtn.addEventListener('click', async (event) => {
            event.stopPropagation();
            await applyReactionPickerSelection('');
        });
        row.appendChild(clearBtn);
        QUICK_REACTION_EMOJIS.forEach((emoji) => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'w-8 h-8 rounded-lg hover:bg-coffee-100 dark:hover:bg-[#34302e] text-lg';
            btn.textContent = emoji;
            btn.addEventListener('click', async (event) => {
                event.stopPropagation();
                await applyReactionPickerSelection(emoji);
            });
            row.appendChild(btn);
        });
        const plusBtn = document.createElement('button');
        plusBtn.type = 'button';
        plusBtn.className = 'w-8 h-8 rounded-lg border border-coffee-200 dark:border-[#57534e] hover:bg-coffee-100 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] text-sm font-bold';
        plusBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
        plusBtn.title = 'More emojis';
        plusBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            openReactionPickerModal();
        });
        row.appendChild(plusBtn);
        picker.appendChild(row);
        document.body.appendChild(picker);
        reactionPickerEl = picker;
        document.addEventListener('click', (event) => {
            if (picker.classList.contains('hidden')) return;
            if (picker.contains(event.target)) return;
            closeReactionPicker();
        });
        return picker;
    };

    const ensureReactionPickerModal = () => {
        if (reactionPickerModalEl) return reactionPickerModalEl;
        const overlay = document.createElement('div');
        overlay.id = 'momentReactionPickerModal';
        overlay.className = 'hidden fixed inset-0 z-[10070] bg-black/50 backdrop-blur-sm p-4 flex items-center justify-center';
        overlay.dataset.momentAction = 'true';
        overlay.addEventListener('click', (event) => {
            if (event.target === overlay) closeReactionPickerModal();
        });

        const panel = document.createElement('div');
        panel.className = 'w-full max-w-lg bg-white dark:bg-[#292524] rounded-xl border border-coffee-200 dark:border-[#57534e] shadow-2xl overflow-hidden';
        panel.dataset.momentAction = 'true';

        const header = document.createElement('div');
        header.className = 'p-3 border-b border-coffee-200 dark:border-[#44403c] flex items-center justify-between gap-2';
        header.innerHTML = '<span class="text-sm font-bold text-coffee-800 dark:text-white">Choose emoji reaction</span>';
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'w-8 h-8 rounded-full hover:bg-coffee-100 dark:hover:bg-[#34302e] text-coffee-600 dark:text-[#a8a29e]';
        closeBtn.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        closeBtn.addEventListener('click', () => closeReactionPickerModal());
        header.appendChild(closeBtn);

        const searchWrap = document.createElement('div');
        searchWrap.className = 'p-3 border-b border-coffee-100 dark:border-[#44403c]';
        const search = document.createElement('input');
        search.type = 'text';
        search.placeholder = 'Search emoji...';
        search.className = 'w-full bg-coffee-50 dark:bg-[#1c1917] border border-coffee-200 dark:border-[#44403c] rounded px-3 py-2 text-sm text-coffee-900 dark:text-white';
        searchWrap.appendChild(search);

        const grid = document.createElement('div');
        grid.className = 'p-3 max-h-[60vh] overflow-y-auto grid grid-cols-8 sm:grid-cols-10 gap-1';

        const renderGrid = (queryText = '') => {
            const normalized = queryText.trim().toLowerCase();
            const byQuery = FULL_REACTION_EMOJIS.filter((emoji) => !normalized || emoji.includes(normalized));
            const items = byQuery.length ? byQuery : FULL_REACTION_EMOJIS;
            grid.innerHTML = '';
            items.forEach((emoji) => {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'h-9 rounded hover:bg-coffee-100 dark:hover:bg-[#34302e] text-xl';
                btn.textContent = emoji;
                btn.addEventListener('click', async (event) => {
                    event.stopPropagation();
                    await applyReactionPickerSelection(emoji, true);
                });
                grid.appendChild(btn);
            });
        };
        renderGrid('');
        search.addEventListener('input', () => renderGrid(search.value));

        panel.appendChild(header);
        panel.appendChild(searchWrap);
        panel.appendChild(grid);
        overlay.appendChild(panel);
        document.body.appendChild(overlay);
        reactionPickerModalEl = overlay;
        return overlay;
    };

    const openReactionPicker = ({ anchorElement, onSelect }) => {
        if (!anchorElement || typeof onSelect !== 'function') return;
        const picker = ensureReactionPicker();
        const rect = anchorElement.getBoundingClientRect();
        reactionPickerTarget = { onSelect };
        picker.classList.remove('hidden');
        const top = Math.max(8, rect.top - 52);
        const left = Math.min(window.innerWidth - 220, Math.max(8, rect.left));
        picker.style.top = `${top}px`;
        picker.style.left = `${left}px`;
    };

    const openReactionPickerModal = () => {
        if (!reactionPickerTarget) return;
        reactionPickerModalTarget = reactionPickerTarget;
        const modal = ensureReactionPickerModal();
        modal.classList.remove('hidden');
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

    const copyMomentShareTextToClipboard = (text) => {
        try {
            if (typeof navigator !== 'undefined' && navigator?.clipboard?.writeText && text) {
                navigator.clipboard.writeText(text).catch(() => {});
            }
        } catch (_) {
            // Ignore clipboard failures; sharing can continue.
        }
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

    const buildMomentBrewDetailsSnapshot = (brew) => {
        const toNumber = (value) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : null;
        };
        const hasText = (value) => typeof value === 'string' && value.trim().length > 0;
        const normalizeText = (value) => {
            if (!hasText(value)) return '';
            const trimmed = value.trim();
            const numeric = Number(trimmed);
            if (Number.isFinite(numeric) && numeric === 0) return '';
            return trimmed;
        };
        const normalizeNumberText = (value, digits = 1, options = {}) => {
            const n = toNumber(value);
            if (n === null) return '';
            const allowZero = options.allowZero === true;
            if (!allowZero && n === 0) return '';
            const factor = 10 ** digits;
            return `${Math.round(n * factor) / factor}`;
        };

        const steps = Array.isArray(brew?.recipeSteps) ? brew.recipeSteps : [];
        const derivedPourCount = steps.filter((step) => step?.type === 'pour').length;
        const derivedSwirlCount = steps.filter((step) => step?.type === 'swirl').length;
        const weight = toNumber(brew?.weight);
        const ratio = toNumber(brew?.ratio);
        const yieldValue = toNumber(brew?.yield);
        const derivedOut = Number.isFinite(weight) && Number.isFinite(ratio)
            ? (weight * ratio)
            : null;

        const grinderText = normalizeText(brew?.grinder);
        const grindText = normalizeText(brew?.grind);

        return {
            weight: weight === null ? '' : normalizeNumberText(weight, 1),
            ratio: ratio === null ? '' : normalizeNumberText(ratio, 2),
            out: yieldValue !== null
                ? normalizeNumberText(yieldValue, 1)
                : (derivedOut !== null ? normalizeNumberText(derivedOut, 1) : ''),
            grinder: grinderText,
            grind: grindText || normalizeNumberText(brew?.grind, 1),
            time: normalizeNumberText(brew?.time, 0),
            temp: normalizeText(brew?.temp) || normalizeNumberText(brew?.temp, 1),
            firstDrip: normalizeNumberText(brew?.firstDrip, 0),
            maxFlow: normalizeNumberText(brew?.maxFlow, 1),
            avgFlow: normalizeNumberText(brew?.avgFlow, 1),
            pourCount: Number.isFinite(Number(brew?.pourCount))
                ? (Math.round(Number(brew.pourCount)) > 0 ? `${Math.round(Number(brew.pourCount))}` : '')
                : (derivedPourCount > 0 ? `${derivedPourCount}` : ''),
            swirlCount: Number.isFinite(Number(brew?.swirlCount))
                ? (Math.round(Number(brew.swirlCount)) > 0 ? `${Math.round(Number(brew.swirlCount))}` : '')
                : (derivedSwirlCount > 0 ? `${derivedSwirlCount}` : '')
        };
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
        const isDetailsMoment = data?.momentType === 'details';
        const isGraphMoment = data?.momentType === 'graph';
        const graphSnapshot = data?.graphSnapshot || null;

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
        if (isGraphMoment && hasRenderableMomentGraph(graphSnapshot)) {
            const graphWrap = document.createElement('div');
            graphWrap.style.cssText = 'padding:16px;background:#1c1917;border-bottom:1px solid rgba(255,255,255,0.08);';
            const graphCanvas = document.createElement('canvas');
            graphCanvas.dataset.momentShareGraph = 'true';
            graphCanvas.style.cssText = 'width:100%;height:220px;display:block;border-radius:12px;';
            graphWrap.appendChild(graphCanvas);
            mediaWrap.appendChild(graphWrap);
        } else if (!isDetailsMoment && photoUrl) {
            const img = document.createElement('img');
            img.src = photoUrl;
            img.alt = 'Moment photo';
            img.crossOrigin = 'anonymous';
            img.style.cssText = 'width:100%;height:auto;display:block;';
            mediaWrap.appendChild(img);
        } else if (isDetailsMoment) {
            const details = data?.brewDetailsSnapshot || {};
            const inText = details.weight ? `${details.weight}g` : '-';
            const ratioText = details.ratio ? `1:${details.ratio}` : '-';
            const outText = details.out ? `${details.out}g` : '-';
            const tempText = details.temp
                ? (/[a-z]/i.test(details.temp) ? details.temp : `${details.temp}C`)
                : '-';
            const timeText = details.time ? `${details.time}s` : '';
            const extraMeta = [
                { label: 'First drip', value: details.firstDrip ? `${details.firstDrip}s` : '' },
                { label: 'Max flow', value: details.maxFlow ? `${details.maxFlow}g/s` : '' },
                { label: 'Avg flow', value: details.avgFlow ? `${details.avgFlow}g/s` : '' },
                { label: 'Pours', value: details.pourCount || '' },
                { label: 'Swirls', value: details.swirlCount || '' }
            ].filter((item) => !!item.value);

            const detailsWrap = document.createElement('div');
            detailsWrap.style.cssText = 'padding:16px;background:#1c1917;border-bottom:1px solid rgba(255,255,255,0.08);';
            const statsCard = document.createElement('div');
            statsCard.style.cssText = 'background:#1c1917;border-radius:14px;padding:14px;border:1px solid rgba(255,255,255,0.12);';

            const timeBlock = timeText
                ? `<div><div style="font-size:10px;color:#78716c;text-transform:uppercase;">Time</div><div style="font-weight:700;color:#f5f5f4;">${timeText}</div></div>`
                : '';
            const extraChips = extraMeta.map((item) =>
                `<span style="display:inline-flex;align-items:center;padding:2px 6px;background:#292524;border-radius:6px;border:1px solid rgba(255,255,255,0.15);font-size:10px;color:#d6ccc2;">${item.label}: ${item.value}</span>`
            ).join('');

            statsCard.innerHTML = `
                <div style="font-size:10px;font-weight:700;color:#a8a29e;text-transform:uppercase;margin-bottom:8px;">Brew stats</div>
                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:center;margin-bottom:8px;">
                    <div style="background:#292524;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);"><div style="font-size:10px;color:#78716c;text-transform:uppercase;">In</div><div style="font-family:'Nunito',system-ui,sans-serif;font-weight:700;color:#f5f5f4;">${inText}</div></div>
                    <div style="background:#292524;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);"><div style="font-size:10px;color:#78716c;text-transform:uppercase;">Ratio</div><div style="font-family:'Nunito',system-ui,sans-serif;font-weight:700;color:#f5f5f4;">${ratioText}</div></div>
                    <div style="background:#292524;padding:8px;border-radius:8px;border:1px solid rgba(255,255,255,0.12);"><div style="font-size:10px;color:#78716c;text-transform:uppercase;">Out</div><div style="font-family:'Nunito',system-ui,sans-serif;font-weight:700;color:#f5f5f4;">${outText}</div></div>
                </div>
                <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;text-align:center;border-top:1px solid rgba(255,255,255,0.12);padding-top:8px;">
                    <div><div style="font-size:10px;color:#78716c;text-transform:uppercase;">${details.grinder ? 'Grinder' : 'Grind'}</div><div style="font-weight:700;color:#f5f5f4;">${details.grinder || details.grind || '-'}</div></div>
                    ${timeBlock}
                    <div><div style="font-size:10px;color:#78716c;text-transform:uppercase;">Temp</div><div style="font-weight:700;color:#f5f5f4;">${tempText}</div></div>
                </div>
                ${extraChips ? `<div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px;">${extraChips}</div>` : ''}
            `;
            detailsWrap.appendChild(statsCard);
            mediaWrap.appendChild(detailsWrap);
        }
        const dateBadge = document.createElement('div');
        dateBadge.style.cssText = (isDetailsMoment || isGraphMoment)
            ? 'padding:0 16px 12px 16px;color:#ffffff;font-size:13px;font-weight:700;line-height:1;text-align:right;'
            : 'position:absolute;left:16px;bottom:14px;color:#ffffff;font-size:18px;font-weight:800;line-height:1;';
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
            const shareGraphCanvas = templateCard.querySelector('canvas[data-moment-share-graph="true"]');
            if (shareGraphCanvas) {
                renderMomentGraphCanvas(shareGraphCanvas, data?.graphSnapshot || null);
            }
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
            ? `${window.location.origin}${window.location.pathname}${window.location.search ? `${window.location.search}&moments` : '?moments'}`
            : '';
        const shareText = buildMomentShareText({ data, cardSnapshot, appLink });
        if (typeof navigator === 'undefined' || typeof navigator.share !== 'function') {
            alert('Sharing is not supported on this device.');
            return;
        }

        // Best-effort: copy details for apps that only keep the image payload.
        copyMomentShareTextToClipboard(shareText);

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
        const appLink = typeof window !== 'undefined'
            ? `${window.location.origin}${window.location.pathname}${window.location.search ? `${window.location.search}&moments` : '?moments'}`
            : '';
        const previewShareText = buildMomentShareText({
            data: {
                message
            },
            cardSnapshot: coffeeSnapshot,
            appLink
        });
        if (alsoShareOutsideApp) {
            // Try early clipboard copy while still in direct user action context.
            copyMomentShareTextToClipboard(previewShareText);
        }

        document.getElementById('uploadProgress')?.classList.remove('hidden');

        try {
            const timestamp = Date.now();
            let fileToUpload = selectedPhotoFile;
            if (momentType === 'graph') {
                fileToUpload = null;
            } else if (momentType === 'details') {
                fileToUpload = null;
            }
            let photoPath = '';
            let thumbPath = '';
            if (fileToUpload) {
                photoPath = `photos/${user.uid}/${timestamp}_${fileToUpload.name}_original`;
                const storageRef = ref(storage, photoPath);
                const originalOptions = { maxSizeMB: 1.5, maxWidthOrHeight: 1920, useWebWorker: true };
                const compressedOriginal = await imageCompression(fileToUpload, originalOptions);
                await uploadBytes(storageRef, compressedOriginal);

                const thumbOptions = { maxSizeMB: 0.1, maxWidthOrHeight: 600, useWebWorker: true };
                try {
                    const thumbFile = await imageCompression(fileToUpload, thumbOptions);
                    thumbPath = `photos/${user.uid}/${timestamp}_${fileToUpload.name}_thumb`;
                    const thumbRef = ref(storage, thumbPath);
                    await uploadBytes(thumbRef, thumbFile);
                } catch (error) {
                    console.log('Thumbnail generation failed:', error);
                    thumbPath = '';
                }
            }

            const createdAtIso = new Date().toISOString();
            const momentPayload = {
                uid: user.uid,
                uploaderName: user.displayName || 'Unknown User',
                message,
                coffeeId: uploadCoffeeId,
                coffeeSnapshot,
                momentType,
                sharedWith,
                reactions: {},
                createdAt: createdAtIso
            };
            if (photoPath) momentPayload.photoPath = photoPath;
            if (thumbPath) momentPayload.thumbPath = thumbPath;
            if (momentType === 'details') {
                momentPayload.brewDetailsSnapshot = buildMomentBrewDetailsSnapshot(coffeeData);
            }
            if (momentType === 'graph') {
                momentPayload.graphSnapshot = buildMomentGraphSnapshot(coffeeData);
            }
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

            await openGallery('mine');
        } catch (error) {
            console.error('Upload failed', error);
            alert(`Upload failed: ${error.message}`);
        }
    };

    const openGallery = async (initialTab = 'shared') => {
        clearLiveCommentListeners();
        document.getElementById('galleryModal')?.classList.remove('hidden');
        galleryNotificationBaseline = getLastGalleryVisit();
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
        await refreshGalleryCommentIndicators();
        await switchGalleryTab(initialTab === 'mine' ? 'mine' : 'shared');
        setLastGalleryDoc(null);
        document.getElementById('galleryGrid').innerHTML = '';
        document.getElementById('galleryEmpty')?.classList.add('hidden');
        document.getElementById('galleryLoadMore')?.classList.add('hidden');
        loadMoreGallery();
    };

    const switchGalleryTab = async (tab) => {
        clearLiveCommentListeners();
        const tMine = document.getElementById('tabGalleryMine');
        const tShared = document.getElementById('tabGalleryShared');
        renderGalleryTabCommentBadges();
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
            const graphSnapshot = data?.graphSnapshot || null;
            const hasGraphSnapshot = hasRenderableMomentGraph(graphSnapshot);
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

            let img = null;
            if (momentType === 'graph' && hasGraphSnapshot) {
                const graphWrap = document.createElement('div');
                graphWrap.className = 'p-3 bg-coffee-50 dark:bg-[#1c1917] border-b border-coffee-100 dark:border-[#44403c]';
                const graphCanvas = document.createElement('canvas');
                graphCanvas.className = 'w-full h-52 rounded-lg border border-coffee-200 dark:border-[#57534e]';
                graphWrap.appendChild(graphCanvas);

                const dateBadge = document.createElement('div');
                dateBadge.className = 'mt-2 text-right text-[11px] text-coffee-500 dark:text-[#a8a29e]';
                dateBadge.textContent = new Date(data.createdAt).toLocaleDateString();
                graphWrap.appendChild(dateBadge);
                card.appendChild(graphWrap);
                renderMomentGraphCanvas(graphCanvas, graphSnapshot);
            } else if (momentType === 'details') {
                const details = data?.brewDetailsSnapshot || {};
                const inText = details.weight ? `${details.weight}g` : '-';
                const ratioText = details.ratio ? `1:${details.ratio}` : '-';
                const outText = details.out ? `${details.out}g` : '-';
                const tempText = details.temp
                    ? (/[a-z]/i.test(details.temp) ? details.temp : `${details.temp}C`)
                    : '-';
                const timeText = details.time ? `${details.time}s` : '';
                const timeBlock = timeText
                    ? `<div data-details-tip="Total extraction time in seconds."><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Time</div><div class="font-bold text-coffee-800 dark:text-[#d6ccc2]">${timeText}</div></div>`
                    : '';
                const detailsWrap = document.createElement('div');
                detailsWrap.className = 'p-3 bg-coffee-50 dark:bg-[#1c1917] border-b border-coffee-100 dark:border-[#44403c]';

                const statsCard = document.createElement('div');
                statsCard.className = 'bg-coffee-50 dark:bg-[#1c1917] rounded-xl p-3 border border-coffee-100 dark:border-[#44403c]';
                statsCard.innerHTML = `
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[10px] font-bold text-coffee-500 dark:text-[#78716c] uppercase"><i class="fa-solid fa-flask mr-1"></i> Brew stats</span>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-center mb-2">
                        <div data-details-tip="Input coffee dose in grams." class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">In</div><div class="font-mono font-bold text-coffee-900 dark:text-white">${inText}</div></div>
                        <div data-details-tip="Brew ratio as input to output (1:x)." class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Ratio</div><div class="font-mono font-bold text-coffee-900 dark:text-white">${ratioText}</div></div>
                        <div data-details-tip="Output beverage weight in grams." class="bg-white dark:bg-[#292524] p-2 rounded border border-coffee-100 dark:border-[#44403c]"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Out</div><div class="font-mono font-bold text-coffee-900 dark:text-white">${outText}</div></div>
                    </div>
                    <div class="grid grid-cols-3 gap-2 text-center border-t border-coffee-200 dark:border-[#44403c] pt-2">
                        <div data-details-tip="${details.grinder ? 'Grinder model used for this brew.' : 'Grind setting used for this brew.'}"><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase truncate px-1">${details.grinder ? 'Grinder' : 'Grind'}</div><div class="font-bold text-coffee-800 dark:text-[#d6ccc2]">${details.grinder || details.grind || '-'}</div></div>
                        ${timeBlock}
                        <div data-details-tip="Water temperature used during extraction."><div class="text-[10px] text-coffee-400 dark:text-[#57534e] uppercase">Temp</div><div class="font-bold text-coffee-800 dark:text-[#d6ccc2]">${tempText}</div></div>
                    </div>
                `;
                statsCard.querySelectorAll('[data-details-tip]').forEach((el) => {
                    bindMomentDetailsTooltip(el, el.getAttribute('data-details-tip'));
                });

                const extraMeta = [
                    { label: 'First drip', value: details.firstDrip ? `${details.firstDrip}s` : '' },
                    { label: 'Max flow', value: details.maxFlow ? `${details.maxFlow}g/s` : '' },
                    { label: 'Avg flow', value: details.avgFlow ? `${details.avgFlow}g/s` : '' },
                    { label: 'Pours', value: details.pourCount || '' },
                    { label: 'Swirls', value: details.swirlCount || '' }
                ].filter((item) => item.value);
                if (extraMeta.length) {
                    const extraWrap = document.createElement('div');
                    extraWrap.className = 'mt-2 flex flex-wrap gap-1.5';
                    extraMeta.forEach((item) => {
                        const chip = document.createElement('span');
                        chip.className = 'inline-flex items-center px-1.5 py-0.5 bg-white dark:bg-[#292524] rounded border border-coffee-200 dark:border-[#57534e] text-[10px] text-coffee-700 dark:text-[#d6ccc2]';
                        chip.textContent = `${item.label}: ${item.value}`;
                        bindMomentDetailsTooltip(chip, `${item.label}: ${item.value}`);
                        extraWrap.appendChild(chip);
                    });
                    statsCard.appendChild(extraWrap);
                }

                const dateBadge = document.createElement('div');
                dateBadge.className = 'mt-2 text-right text-[11px] text-coffee-500 dark:text-[#a8a29e]';
                dateBadge.textContent = new Date(data.createdAt).toLocaleDateString();
                detailsWrap.appendChild(statsCard);
                detailsWrap.appendChild(dateBadge);
                card.appendChild(detailsWrap);
            } else {
                const imageWrap = document.createElement('div');
                imageWrap.dataset.momentImageWrap = 'true';
                imageWrap.className = 'h-48 overflow-hidden bg-gray-100 dark:bg-gray-800 relative cursor-pointer';

                img = document.createElement('img');
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
            }

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
                const count = likesModule.getReactionCount(data);
                const activeEmoji = likesModule.getUserReaction(data);
                const topEmoji = likesModule.getTopReactionEmoji(data);
                const displayEmoji = activeEmoji || topEmoji;

                const isMineTab = getCurrentGalleryMode() === 'mine';
                const canLike = !isMineTab && likesModule.canLikeMoment(data);
                likeControl.innerHTML = displayEmoji
                    ? `<span class="text-base leading-none">${displayEmoji}</span><span>${count}</span><i class="fa-solid fa-plus text-[9px] opacity-70"></i>`
                    : `<i class="fa-regular fa-heart text-[12px]"></i><span>${count}</span><i class="fa-solid fa-plus text-[9px] opacity-70"></i>`;
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
                openReactionPicker({
                    anchorElement: likeControl,
                    onSelect: async (emoji) => {
                        likeControl.disabled = true;
                        likeControl.classList.add('opacity-70', 'cursor-wait');
                        try {
                            const selected = await likesModule.setReaction({ photoId: docItem.id, data, emoji });
                            const reactions = likesModule.getReactions(data);
                            const uid = getCurrentUser()?.uid;
                            if (uid) {
                                Object.keys(reactions).forEach((key) => {
                                    reactions[key] = (reactions[key] || []).filter((entryUid) => entryUid !== uid);
                                });
                                if (selected) {
                                    const bucket = Array.isArray(reactions[selected]) ? reactions[selected] : [];
                                    reactions[selected] = Array.from(new Set([...bucket, uid]));
                                }
                                data.reactions = reactions;
                            }
                            updateLikesUi();
                        } catch (error) {
                            console.error('Failed toggling moment reaction', error);
                            alert(`Could not update reaction: ${error?.message || 'Unknown error'}`);
                        } finally {
                            likeControl.disabled = false;
                            likeControl.classList.remove('opacity-70', 'cursor-wait');
                        }
                    }
                });
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
            const commentTabKey = getCurrentGalleryMode() === 'mine' ? 'mine' : 'shared';
            let hasUnreadComments = unreadCommentMomentIds.has(docItem.id);
            let commentsLiveUnsub = null;
            const normalizeCommentsEntries = (entries) => {
                const unique = [];
                const seen = new Set();
                (Array.isArray(entries) ? entries : []).forEach((entry) => {
                    if (!entry || typeof entry !== 'object') return;
                    const id = typeof entry.id === 'string' ? entry.id : '';
                    if (!id) {
                        unique.push(entry);
                        return;
                    }
                    if (seen.has(id)) return;
                    seen.add(id);
                    unique.push(entry);
                });
                return unique;
            };
            const stopCommentsLive = () => {
                if (typeof commentsLiveUnsub === 'function') {
                    commentsLiveUnsub();
                    liveCommentUnsubs.delete(commentsLiveUnsub);
                    commentsLiveUnsub = null;
                }
            };
            const setCommentBtnLabel = (count, unread = hasUnreadComments) => {
                const unreadDot = unread
                    ? '<span class="inline-block h-2 w-2 rounded-full bg-red-500 ml-1"></span>'
                    : '';
                commentBtn.innerHTML = `<i class="fa-regular fa-comment text-[10px]"></i><span>${count} comment${count === 1 ? '' : 's'}</span>${unreadDot}`;
            };
            setCommentBtnLabel(0, hasUnreadComments);

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

                    const metaRight = document.createElement('div');
                    metaRight.className = 'flex items-center gap-2';
                    metaRight.dataset.momentAction = 'true';
                    metaRight.appendChild(date);

                    const currentUid = getCurrentUser()?.uid || '';
                    const canDeleteComment = !!entry?.id && !!currentUid && entry?.uid === currentUid;
                    if (canDeleteComment) {
                        const deleteBtn = document.createElement('button');
                        deleteBtn.type = 'button';
                        deleteBtn.className = 'text-[10px] text-red-500 hover:text-red-600';
                        deleteBtn.title = 'Delete comment';
                        deleteBtn.dataset.momentAction = 'true';
                        deleteBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                        deleteBtn.addEventListener('click', async (event) => {
                            event.stopPropagation();
                            const shouldDelete = await openAppConfirm({
                                title: 'Delete comment?',
                                message: 'This permanently deletes your comment.',
                                confirmLabel: 'Delete',
                                cancelLabel: 'Cancel',
                                danger: true
                            });
                            if (!shouldDelete) return;
                            deleteBtn.disabled = true;
                            deleteBtn.classList.add('opacity-70', 'cursor-wait');
                            try {
                                await commentsModule.deleteComment({
                                    photoId: docItem.id,
                                    commentId: entry.id,
                                    commentUid: entry.uid
                                });
                                commentsEntries = commentsEntries.filter((item) => item.id !== entry.id);
                                commentsLoaded = true;
                                renderComments();
                            } catch (error) {
                                console.error('Failed deleting comment', error);
                                alert(`Could not delete comment: ${error?.message || 'Unknown error'}`);
                            } finally {
                                deleteBtn.disabled = false;
                                deleteBtn.classList.remove('opacity-70', 'cursor-wait');
                            }
                        });
                        metaRight.appendChild(deleteBtn);
                    }

                    const text = document.createElement('p');
                    text.className = 'text-xs text-coffee-800 dark:text-[#e7e5e4] whitespace-pre-wrap break-words';
                    text.replaceChildren(buildEmojiTextFragment(entry?.text || ''));
                    text.dataset.momentAction = 'true';

                    meta.appendChild(author);
                    meta.appendChild(metaRight);
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
                hasUnreadComments = commentsEntries.some((entry) => isUnreadCommentForSession(entry, data?.uid || ''));
                if (hasUnreadComments) {
                    unreadCommentMomentIds.add(docItem.id);
                    if (commentTabKey === 'mine') unreadMineCommentMomentIds.add(docItem.id);
                    else unreadSharedCommentMomentIds.add(docItem.id);
                } else {
                    unreadCommentMomentIds.delete(docItem.id);
                    if (commentTabKey === 'mine') unreadMineCommentMomentIds.delete(docItem.id);
                    else unreadSharedCommentMomentIds.delete(docItem.id);
                }
                setCommentBtnLabel(commentCount, hasUnreadComments);
                renderGalleryTabCommentBadges();
            };

            const loadComments = async () => {
                commentsEntries = normalizeCommentsEntries(await commentsModule.listComments({ photoId: docItem.id, max: 30 }));
                commentsLoaded = true;
                renderComments();
            };

            const startCommentsLive = () => {
                if (typeof commentsLiveUnsub === 'function') return;
                const liveQuery = query(
                    collection(db, 'photos', docItem.id, 'comments'),
                    orderBy('createdAt', 'desc'),
                    limit(30)
                );
                commentsLiveUnsub = onSnapshot(
                    liveQuery,
                    (snapshot) => {
                        commentsEntries = normalizeCommentsEntries(snapshot.docs.map((item) => ({
                            id: item.id,
                            ...item.data()
                        })));
                        commentsLoaded = true;
                        renderComments();
                    },
                    (error) => {
                        console.error('Live moment comments listener failed', error);
                    }
                );
                liveCommentUnsubs.add(commentsLiveUnsub);
            };

            // Prime comment count during card render so button label is correct before first click.
            loadComments().catch(() => {
                // Keep default 0 comments label if prefetch fails.
            });

            commentBtn.addEventListener('click', async (event) => {
                event.stopPropagation();
                const willShow = commentsPanel.classList.contains('hidden');
                commentsPanel.classList.toggle('hidden', !willShow);
                if (willShow && hasUnreadComments) {
                    hasUnreadComments = false;
                    unreadCommentMomentIds.delete(docItem.id);
                    if (commentTabKey === 'mine') unreadMineCommentMomentIds.delete(docItem.id);
                    else unreadSharedCommentMomentIds.delete(docItem.id);
                    setCommentBtnLabel(commentsEntries.length, false);
                    renderGalleryTabCommentBadges();
                }
                if (!willShow) return;
                startCommentsLive();
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
                    commentsEntries = normalizeCommentsEntries([created, ...commentsEntries]);
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

            card.addEventListener('remove', () => {
                stopCommentsLive();
            });

            card.appendChild(body);
            grid.appendChild(card);

            if (img) {
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
            }
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
