export const createSocialFriendRequestsModule = ({
    getCurrentUser,
    getIsPublic,
    getFollowing,
    dataService,
    onFollowersChanged,
    onFollowingChanged,
    onOutgoingAccepted
}) => {
    const { db, collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, limit, writeBatch } = dataService || {};
    if (!db || !collection || !query || !where || !getDocs || !getDoc || !doc || !setDoc || !updateDoc || !deleteDoc || !limit || !writeBatch) {
        throw new Error('createSocialFriendRequestsModule requires dataService { db, collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, deleteDoc, limit, writeBatch }');
    }

    let lastPublicResults = [];
    let outgoingPendingByTarget = new Set();
    let outgoingByTarget = new Map();
    let outgoingRequests = [];
    let incomingPending = [];
    let hasSearchedPublicUsers = false;
    let publicProfilesCache = [];
    let publicProfilesCacheAt = 0;
    let searchDebounceTimer = null;
    let dismissHandlersInstalled = false;

    const byId = (id) => document.getElementById(id);

    const esc = (value) =>
        (value || '')
            .toString()
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');

    const isEnabled = () => !!getIsPublic?.();

    const requestDocId = (fromUid, toUid) => `${fromUid}__${toUid}`;
    const DECLINED_COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;

    const normalizeDisplayName = (value) => (value || '').toString().trim();
    const getRequestTime = (req) => new Date(req?.updatedAt || req?.createdAt || 0).getTime();
    const isDeclinedOnCooldown = (req) =>
        req?.status === 'declined' && (Date.now() - getRequestTime(req)) < DECLINED_COOLDOWN_MS;

    const applyPublicState = () => {
        const enabled = isEnabled();
        const input = byId('friendRequestSearchInput');
        const dropdown = byId('friendRequestSearchResults');
        const hint = byId('friendRequestsDisabledHint');
        if (input) input.disabled = !enabled;
        if (!enabled && dropdown) {
            dropdown.classList.add('hidden');
            dropdown.innerHTML = '';
        }
        if (hint) hint.classList.toggle('hidden', enabled);
        if (!dismissHandlersInstalled) {
            installDismissHandlers();
        }
    };

    const installDismissHandlers = () => {
        if (dismissHandlersInstalled) return;
        dismissHandlersInstalled = true;
        document.addEventListener('pointerdown', (event) => {
            const wrap = byId('friendRequestSearchWrap');
            const dropdown = byId('friendRequestSearchResults');
            if (!wrap || !dropdown) return;
            if (wrap.contains(event.target)) return;
            dropdown.classList.add('hidden');
        });
    };

    const renderSearchResults = () => {
        const container = byId('friendRequestSearchResults');
        if (!container) return;
        const currentUser = getCurrentUser?.();
        const followingIds = new Set((getFollowing?.() || []).map((f) => f.uid));
        const enabled = isEnabled();
        if (!enabled) {
            container.innerHTML = '';
            container.classList.add('hidden');
            return;
        }
        if (!hasSearchedPublicUsers) {
            container.innerHTML = '';
            container.classList.add('hidden');
            return;
        }
        container.classList.remove('hidden');
        if (!lastPublicResults.length) {
            container.innerHTML = '<p class="text-[11px] text-coffee-500 dark:text-[#78716c] italic">No public users found.</p>';
            return;
        }
        container.innerHTML = lastPublicResults
            .map((item) => {
                const uid = item.uid;
                const alreadyFollowing = followingIds.has(uid);
                const pending = outgoingPendingByTarget.has(uid);
                const existingRequest = outgoingByTarget.get(uid);
                const isSelf = !!currentUser && currentUser.uid === uid;
                let btnHtml = '';
                if (isSelf) {
                    btnHtml = '<span class="text-[11px] text-coffee-500 dark:text-[#78716c]">You</span>';
                } else if (alreadyFollowing) {
                    btnHtml = '<span class="text-[11px] text-coffee-500 dark:text-[#78716c]">Following</span>';
                } else if (isDeclinedOnCooldown(existingRequest)) {
                    btnHtml = '<span class="text-[11px] text-red-600 dark:text-red-400">Declined</span>';
                } else if (pending) {
                    btnHtml = '<span class="text-[11px] text-amber-600 dark:text-amber-400">Requested</span>';
                } else if (existingRequest?.status === 'accepted') {
                    btnHtml = '<span class="text-[11px] text-green-600 dark:text-green-400">Accepted</span>';
                } else {
                    btnHtml = `<button data-action-click="sendFriendRequest('${esc(uid)}')" class="text-xs bg-coffee-700 hover:bg-coffee-800 dark:bg-[#57534e] text-white px-2 py-1 rounded">Request</button>`;
                }
                return `<div class="flex items-center justify-between bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-200 dark:border-[#44403c]"><span class="text-sm text-coffee-800 dark:text-[#d6ccc2] truncate">${esc(item.displayName || uid)}</span>${btnHtml}</div>`;
            })
            .join('');
    };

    const ensurePublicProfilesCache = async ({ force = false } = {}) => {
        const now = Date.now();
        if (!force && publicProfilesCache.length && now - publicProfilesCacheAt < 60000) {
            return publicProfilesCache;
        }
        const q = query(
            collection(db, 'publicProfiles'),
            where('isPublic', '==', true),
            limit(300)
        );
        const snap = await getDocs(q);
        publicProfilesCache = snap.docs.map((item) => ({ id: item.id, ...item.data() }));
        publicProfilesCacheAt = now;
        return publicProfilesCache;
    };

    const renderIncomingRequests = () => {
        const container = byId('friendRequestIncomingList');
        if (!container) return;
        const enabled = isEnabled();
        if (!incomingPending.length) {
            container.innerHTML = '<p class="text-[11px] text-coffee-500 dark:text-[#78716c] italic">No pending requests.</p>';
            return;
        }
        container.innerHTML = incomingPending
            .map((req) => {
                const acceptDisabled = !enabled ? 'disabled class="text-xs bg-gray-300 dark:bg-[#44403c] text-coffee-500 dark:text-[#78716c] px-2 py-1 rounded cursor-not-allowed"' : 'class="text-xs bg-green-600 hover:bg-green-700 text-white px-2 py-1 rounded"';
                const declineDisabled = !enabled ? 'disabled class="text-xs bg-gray-300 dark:bg-[#44403c] text-coffee-500 dark:text-[#78716c] px-2 py-1 rounded cursor-not-allowed"' : 'class="text-xs bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded"';
                return `<div class="flex items-center justify-between gap-2 bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-200 dark:border-[#44403c]"><span class="text-sm text-coffee-800 dark:text-[#d6ccc2] truncate">${esc(req.fromName || req.fromUid || 'Unknown user')}</span><div class="flex items-center gap-2"><button data-action-click="acceptFriendRequest('${esc(req.id)}')" ${acceptDisabled}>Accept</button><button data-action-click="declineFriendRequest('${esc(req.id)}')" ${declineDisabled}>Decline</button></div></div>`;
            })
            .join('');
    };

    const getRequestStatusBadge = (status) => {
        const normalized = (status || '').toString().toLowerCase();
        if (normalized === 'accepted') return '<span class="text-[11px] text-green-600 dark:text-green-400">Accepted</span>';
        if (normalized === 'declined') return '<span class="text-[11px] text-red-600 dark:text-red-400">Declined</span>';
        if (normalized === 'cancelled') return '<span class="text-[11px] text-coffee-500 dark:text-[#78716c]">Cancelled</span>';
        return '<span class="text-[11px] text-amber-600 dark:text-amber-400">Requested</span>';
    };

    const renderOutgoingRequests = () => {
        const container = byId('friendRequestOutgoingList');
        if (!container) return;
        if (!outgoingRequests.length) {
            container.innerHTML = '<p class="text-[11px] text-coffee-500 dark:text-[#78716c] italic">No requests sent yet.</p>';
            return;
        }
        container.innerHTML = outgoingRequests
            .map((req) => `<div class="flex items-center justify-between gap-2 bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-200 dark:border-[#44403c]"><span class="text-sm text-coffee-800 dark:text-[#d6ccc2] truncate">${esc(req.toName || req.toUid || 'Unknown user')}</span>${getRequestStatusBadge(req.status)}</div>`)
            .join('');
    };

    const refreshFriendRequests = async () => {
        const currentUser = getCurrentUser?.();
        if (!currentUser) return;

        const incomingQ = query(
            collection(db, 'friendRequests'),
            where('toUid', '==', currentUser.uid),
            limit(30)
        );
        const outgoingQ = query(
            collection(db, 'friendRequests'),
            where('fromUid', '==', currentUser.uid),
            limit(80)
        );

        const [incomingSnap, outgoingSnap] = await Promise.all([getDocs(incomingQ), getDocs(outgoingQ)]);

        incomingPending = incomingSnap.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((item) => item.status === 'pending');
        const outgoingAll = outgoingSnap.docs.map((item) => ({ id: item.id, ...item.data() }));
        const acceptedOutgoing = outgoingAll.filter((item) => item.status === 'accepted' && item.toUid);
        const staleDeclinedOutgoing = outgoingAll.filter((item) =>
            item.status === 'declined' &&
            (Date.now() - getRequestTime(item)) >= DECLINED_COOLDOWN_MS
        );

        if (acceptedOutgoing.length || staleDeclinedOutgoing.length) {
            for (const req of staleDeclinedOutgoing) {
                await deleteDoc(doc(db, 'friendRequests', req.id));
            }
            for (const req of acceptedOutgoing) {
                const friendUid = req.toUid;
                const friendName = req.toName || friendUid;
                const nowIso = new Date().toISOString();
                const batch = writeBatch(db);
                batch.set(
                    doc(db, 'users', currentUser.uid, 'followers', friendUid),
                    {
                        uid: friendUid,
                        name: friendName,
                        addedAt: nowIso
                    },
                    { merge: true }
                );
                batch.set(
                    doc(db, 'users', currentUser.uid, 'following', friendUid),
                    {
                        uid: friendUid,
                        name: friendName,
                        addedAt: nowIso
                    },
                    { merge: true }
                );
                await batch.commit();
                await deleteDoc(doc(db, 'friendRequests', req.id));
                onOutgoingAccepted?.(friendName);
            }
            if (acceptedOutgoing.length && typeof onFollowersChanged === 'function') {
                await onFollowersChanged();
            }
            if (acceptedOutgoing.length && typeof onFollowingChanged === 'function') {
                await onFollowingChanged();
            }
        }

        outgoingRequests = outgoingAll
            .filter((item) => item.status !== 'accepted')
            .filter((item) => !(item.status === 'declined' && (Date.now() - getRequestTime(item)) >= DECLINED_COOLDOWN_MS))
            .sort((a, b) => {
                const aDate = getRequestTime(a);
                const bDate = getRequestTime(b);
                return bDate - aDate;
            });
        outgoingByTarget = new Map(outgoingRequests.filter((item) => item?.toUid).map((item) => [item.toUid, item]));
        outgoingPendingByTarget = new Set(outgoingRequests.filter((item) => item?.status === 'pending').map((item) => item.toUid).filter(Boolean));

        applyPublicState();
        renderIncomingRequests();
        renderOutgoingRequests();
        renderSearchResults();
    };

    const performSearchPublicUsers = async () => {
        const currentUser = getCurrentUser?.();
        if (!currentUser) return;
        applyPublicState();
        if (!isEnabled()) return;

        const input = byId('friendRequestSearchInput');
        const term = normalizeDisplayName(input?.value).toLowerCase();
        const container = byId('friendRequestSearchResults');
        if (!term) {
            hasSearchedPublicUsers = false;
            lastPublicResults = [];
            if (container) {
                container.classList.add('hidden');
                container.innerHTML = '';
            }
            return;
        }
        hasSearchedPublicUsers = true;
        if (container) {
            container.classList.remove('hidden');
            container.innerHTML = '<p class="text-[11px] text-coffee-500 dark:text-[#78716c] italic">Searching...</p>';
        }

        try {
            const profiles = await ensurePublicProfilesCache();
            lastPublicResults = profiles
                .filter((item) => item.uid && item.uid !== currentUser.uid)
                .filter((item) => {
                    if (!term) return true;
                    const name = normalizeDisplayName(item.displayName).toLowerCase();
                    const uid = normalizeDisplayName(item.uid).toLowerCase();
                    return name.includes(term) || uid.includes(term);
                })
                .sort((a, b) => normalizeDisplayName(a.displayName).localeCompare(normalizeDisplayName(b.displayName)));
            renderSearchResults();
        } catch (error) {
            console.error('Friend search error', error);
            if (container) {
                container.innerHTML = '<p class="text-[11px] text-red-500 dark:text-red-400 italic">Could not search users right now.</p>';
            }
        }
    };

    const searchPublicUsers = async () => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        await new Promise((resolve) => {
            searchDebounceTimer = setTimeout(resolve, 120);
        });
        searchDebounceTimer = null;
        return performSearchPublicUsers();
    };

    const resetSearchUi = () => {
        const input = byId('friendRequestSearchInput');
        const container = byId('friendRequestSearchResults');
        if (input) input.value = '';
        hasSearchedPublicUsers = false;
        lastPublicResults = [];
        if (searchDebounceTimer) {
            clearTimeout(searchDebounceTimer);
            searchDebounceTimer = null;
        }
        if (container) {
            container.innerHTML = '';
            container.classList.add('hidden');
        }
    };

    const sendFriendRequest = async (toUid) => {
        const currentUser = getCurrentUser?.();
        if (!currentUser || !toUid || toUid === currentUser.uid) return;
        if (!isEnabled()) return alert('Enable Public profile to send friend requests.');
        const existingRequest = outgoingByTarget.get(toUid);
        if (isDeclinedOnCooldown(existingRequest)) {
            alert('Request was declined recently. You can send a new request after 30 days.');
            return;
        }
        if (existingRequest?.status === 'pending') {
            alert('Request already pending.');
            return;
        }

        const targetSnap = await getDoc(doc(db, 'publicProfiles', toUid));
        if (!targetSnap.exists()) return alert('User not found.');
        const targetData = targetSnap.data() || {};
        if (targetData.isPublic !== true) return alert('This profile is not public.');

        const nowIso = new Date().toISOString();
        await setDoc(
            doc(db, 'friendRequests', requestDocId(currentUser.uid, toUid)),
            {
                fromUid: currentUser.uid,
                fromName: currentUser.displayName || 'Unknown User',
                toUid,
                toName: targetData.displayName || 'Friend',
                status: 'pending',
                createdAt: nowIso,
                updatedAt: nowIso
            },
            { merge: true }
        );
        await refreshFriendRequests();
        await performSearchPublicUsers();
    };

    const acceptFriendRequest = async (requestId) => {
        const currentUser = getCurrentUser?.();
        if (!currentUser || !requestId) return;
        if (!isEnabled()) return alert('Enable Public profile to process friend requests.');
        const requestSnap = await getDoc(doc(db, 'friendRequests', requestId));
        if (!requestSnap.exists()) return;
        const req = requestSnap.data() || {};
        if (req.toUid !== currentUser.uid || req.status !== 'pending' || !req.fromUid) return;

        const nowIso = new Date().toISOString();
        const batch = writeBatch(db);
        batch.set(
            doc(db, 'users', currentUser.uid, 'followers', req.fromUid),
            {
                uid: req.fromUid,
                name: req.fromName || req.fromUid,
                addedAt: nowIso
            },
            { merge: true }
        );
        batch.set(
            doc(db, 'users', currentUser.uid, 'following', req.fromUid),
            {
                uid: req.fromUid,
                name: req.fromName || req.fromUid,
                addedAt: nowIso
            },
            { merge: true }
        );
        batch.update(doc(db, 'friendRequests', requestId), {
            status: 'accepted',
            updatedAt: nowIso,
            acceptedAt: nowIso
        });
        await batch.commit();
        await refreshFriendRequests();
        onFollowersChanged?.();
        onFollowingChanged?.();
    };

    const declineFriendRequest = async (requestId) => {
        const currentUser = getCurrentUser?.();
        if (!currentUser || !requestId) return;
        if (!isEnabled()) return alert('Enable Public profile to process friend requests.');
        const requestSnap = await getDoc(doc(db, 'friendRequests', requestId));
        if (!requestSnap.exists()) return;
        const req = requestSnap.data() || {};
        if (req.toUid !== currentUser.uid || req.status !== 'pending') return;
        await updateDoc(doc(db, 'friendRequests', requestId), {
            status: 'declined',
            updatedAt: new Date().toISOString()
        });
        await refreshFriendRequests();
    };

    return {
        acceptFriendRequest,
        applyPublicState,
        declineFriendRequest,
        refreshFriendRequests,
        resetSearchUi,
        searchPublicUsers,
        sendFriendRequest
    };
};
