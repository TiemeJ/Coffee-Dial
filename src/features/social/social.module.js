import { createSocialFriendRequestsModule } from './social-friend-requests.js';

export const createSocialModule = ({
    getCurrentUser,
    getCurrentView,
    setCurrentView,
    getFollowing,
    setFollowingState,
    setFollowersState,
    getIsPublic,
    setIsPublicState,
    dataService,
    openAppConfirm,
    changeView,
    showToast
}) => {
    const { db, doc, setDoc, updateDoc, getDoc, getDocs, collection, writeBatch } = dataService || {};
    if (!db || !doc || !setDoc || !updateDoc || !getDoc || !getDocs || !collection || !writeBatch) {
        throw new Error('createSocialModule requires dataService { db, doc, setDoc, updateDoc, getDoc, getDocs, collection, writeBatch }');
    }
    const updatePublicToggleUI = () => {
        const btn = document.getElementById('togglePublicBtn');
        if (!btn) return;
        const dot = btn.firstElementChild;
        const con = document.getElementById('shareIdContainer');
        if (getIsPublic()) {
            btn.className = 'bg-green-500 w-12 h-6 rounded-full p-1 transition-colors relative';
            if (dot) dot.className = 'bg-white w-4 h-4 rounded-full shadow-md transform translate-x-6 transition-transform';
            con?.classList.remove('hidden');
        } else {
            btn.className = 'bg-gray-300 dark:bg-[#44403c] w-12 h-6 rounded-full p-1 transition-colors relative';
            if (dot) dot.className = 'bg-white w-4 h-4 rounded-full shadow-md transform translate-x-0 transition-transform';
            con?.classList.add('hidden');
        }
    };

    const setSocialAccordionState = (section, expanded) => {
        const isManual = section === 'manual';
        const body = document.getElementById(isManual ? 'socialManualBody' : 'socialRequestsBody');
        const icon = document.getElementById(isManual ? 'socialManualToggleIcon' : 'socialRequestsToggleIcon');
        if (!body || !icon) return;
        body.classList.toggle('hidden', !expanded);
        icon.classList.toggle('fa-chevron-up', expanded);
        icon.classList.toggle('fa-chevron-down', !expanded);
    };

    const toggleSocialAccordion = (section) => {
        const isManual = section === 'manual';
        const body = document.getElementById(isManual ? 'socialManualBody' : 'socialRequestsBody');
        if (!body) return;
        const nextExpanded = body.classList.contains('hidden');
        setSocialAccordionState(section, nextExpanded);
    };

    const openFriendsModal = async () => {
        document.getElementById('modalOverlay')?.classList.remove('hidden');
        setSocialAccordionState('requests', true);
        setSocialAccordionState('manual', false);
        switchModalTab('profile');
        friendRequests.applyPublicState();
        await friendRequests.refreshFriendRequests();
    };

    const closeModal = () => {
        friendRequests.resetSearchUi();
        document.getElementById('modalOverlay')?.classList.add('hidden');
    };

    const switchModalTab = (tab) => {
        const tProf = document.getElementById('tabProfile');
        const tFoll = document.getElementById('tabFollowing');
        const cProf = document.getElementById('contentProfile');
        const cFoll = document.getElementById('contentFollowing');
        if (!tProf || !tFoll || !cProf || !cFoll) return;

        if (tab === 'profile') {
            tProf.classList.add('bg-white', 'dark:bg-[#292524]', 'text-coffee-800', 'dark:text-white', 'shadow-sm');
            tProf.classList.remove('text-coffee-500', 'dark:text-[#a8a29e]', 'hover:text-coffee-700', 'dark:hover:text-white');
            tFoll.classList.remove('bg-white', 'dark:bg-[#292524]', 'text-coffee-800', 'dark:text-white', 'shadow-sm');
            tFoll.classList.add('text-coffee-500', 'dark:text-[#a8a29e]', 'hover:text-coffee-700', 'dark:hover:text-white');
            cProf.classList.remove('hidden');
            cFoll.classList.add('hidden');
            loadFollowersList();
            loadBlockedUsersList();
        } else {
            tFoll.classList.add('bg-white', 'dark:bg-[#292524]', 'text-coffee-800', 'dark:text-white', 'shadow-sm');
            tFoll.classList.remove('text-coffee-500', 'dark:text-[#a8a29e]', 'hover:text-coffee-700', 'dark:hover:text-white');
            tProf.classList.remove('bg-white', 'dark:bg-[#292524]', 'text-coffee-800', 'dark:text-white', 'shadow-sm');
            tProf.classList.add('text-coffee-500', 'dark:text-[#a8a29e]', 'hover:text-coffee-700', 'dark:hover:text-white');
            cFoll.classList.remove('hidden');
            cProf.classList.add('hidden');
        }
    };

    const togglePublicProfile = async () => {
        const user = getCurrentUser();
        if (!user) return;
        setIsPublicState(!getIsPublic());
        updatePublicToggleUI();
        const nextIsPublic = getIsPublic();
        await updateDoc(doc(db, 'users', user.uid), { isPublic: nextIsPublic });
        await setDoc(doc(db, 'publicProfiles', user.uid), {
            uid: user.uid,
            displayName: user.displayName || 'Unknown User',
            isPublic: nextIsPublic,
            updatedAt: new Date().toISOString()
        }, { merge: true });
        friendRequests.applyPublicState();
        if (nextIsPublic) {
            await friendRequests.refreshFriendRequests();
        }
    };

    const copyShareId = () => {
        const el = document.getElementById('myShareId');
        if (!el) return;
        el.select();
        document.execCommand('copy');
        alert('ID Copied!');
    };

    const followUser = async (u) => {
        const user = getCurrentUser();
        if (!user) return;
        const i = document.getElementById('friendIdInput');
        const uId = u || i?.value.trim();
        if (!uId || uId === user.uid) return alert('Invalid ID');
        try {
            let n = 'Friend';
            const d = await getDoc(doc(db, 'publicProfiles', uId));
            if (!d.exists()) return alert('Invalid ID');
            const userData = d.data() || {};
            if (userData.isPublic !== true) return alert('This profile is private and cannot be followed by Share ID.');
            if (userData.displayName) n = userData.displayName;
            const batch = writeBatch(db);
            batch.set(doc(db, 'users', user.uid, 'following', uId), { uid: uId, name: n, addedAt: new Date().toISOString() });
            batch.set(doc(db, 'users', user.uid, 'followers', uId), { uid: uId, name: n, addedAt: new Date().toISOString() });
            await batch.commit();
            if (i) i.value = '';
            loadFollowingList();
            loadFollowersList();
            alert(`Following ${n}!`);
        } catch (e) {
            console.error(e);
            alert('Could not follow user. Check ID or permissions.');
        }
    };

    const unfollowUser = async (u) => {
        const user = getCurrentUser();
        if (!user) return;
        const shouldUnfollow = await openAppConfirm({
            title: 'Unfollow user?',
            message: 'You can follow them again later.',
            confirmLabel: 'Unfollow',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!shouldUnfollow) return;
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'users', user.uid, 'following', u));
            await batch.commit();
            loadFollowingList();
            if (getCurrentView() === u) {
                document.getElementById('viewSelect').value = 'mine';
                changeView('mine');
            }
        } catch (e) {
            console.error('Unfollow error', e);
            alert('Error unfollowing');
        }
    };

    const removeFollower = async (followerUid) => {
        const user = getCurrentUser();
        if (!user || !followerUid) return;
        const shouldRemove = await openAppConfirm({
            title: 'Remove follower?',
            message: 'This removes them from your followers list.',
            confirmLabel: 'Remove',
            cancelLabel: 'Cancel',
            danger: true
        });
        if (!shouldRemove) return;
        try {
            const batch = writeBatch(db);
            batch.delete(doc(db, 'users', user.uid, 'followers', followerUid));
            await batch.commit();
            loadFollowersList();
        } catch (e) {
            console.error('Remove follower error', e);
            alert('Error removing follower');
        }
    };

    const syncFriendViewSelectValues = (value) => {
        ['viewSelect', 'beansViewSelect', 'coffeeTypesViewSelect', 'gasViewSelect'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });
    };

    const updateFriendViewSelectors = () => {
        const following = Array.isArray(getFollowing?.()) ? getFollowing() : [];
        const hasFriendOptions = following.length > 0;
        if (!hasFriendOptions && getCurrentView() !== 'mine') {
            setCurrentView('mine');
            changeView('mine');
        }

        const populateSelect = (select, label) => {
            if (!select) return;
            select.innerHTML = `<option value="mine">My ${label}</option>`;
            following.forEach((f) => {
                const option = document.createElement('option');
                option.value = f.uid;
                option.text = f.name || `Friend (${f.uid.substr(0, 5)}...)`;
                select.appendChild(option);
            });
            const nextValue = hasFriendOptions ? getCurrentView() : 'mine';
            select.value = nextValue;
            const wrapper = document.querySelector(`[data-friend-select-wrap="${select.id}"]`);
            if (wrapper) {
                wrapper.classList.toggle('hidden', !hasFriendOptions);
                select.classList.remove('hidden');
            } else {
                select.classList.toggle('hidden', !hasFriendOptions);
            }
        };
        populateSelect(document.getElementById('viewSelect'), 'brews');
        populateSelect(document.getElementById('beansViewSelect'), 'beans');
        populateSelect(document.getElementById('coffeeTypesViewSelect'), 'coffees');
        populateSelect(document.getElementById('gasViewSelect'), 'gear');
    };

    const loadFollowingList = async () => {
        const user = getCurrentUser();
        if (!user) return;
        const s = await getDocs(collection(db, 'users', user.uid, 'following'));
        const following = [];
        s.forEach((d) => following.push(d.data()));
        setFollowingState(following);

        const l = document.getElementById('followingList');
        if (!l) return;
        l.innerHTML = '';
        if (!following.length) {
            l.innerHTML = '<p class="text-xs text-gray-400 italic">You are not following anyone yet.</p>';
        } else {
            following.forEach((f) => {
                const d = document.createElement('div');
                d.className = 'flex justify-between items-center bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-200 dark:border-[#44403c]';
                d.innerHTML = `<span class="text-sm font-mono text-coffee-700 dark:text-[#a8a29e] truncate w-40">${f.name || f.uid}</span> <button data-action-click="unfollowUser('${f.uid}')" class="text-xs text-red-500 hover:text-red-700">Unfollow</button>`;
                l.appendChild(d);
            });
        }
        updateFriendViewSelectors();
    };

    const loadFollowersList = async () => {
        const user = getCurrentUser();
        if (!user) return;
        const listEl = document.getElementById('followersList');
        if (!listEl) return;
        listEl.innerHTML = '<p class="text-xs text-gray-400 italic animate-pulse">Loading...</p>';
        try {
            const s = await getDocs(collection(db, 'users', user.uid, 'followers'));
            const followers = [];
            s.forEach((d) => followers.push(d.data()));
            setFollowersState(followers);
            listEl.innerHTML = '';
            if (!followers.length) {
                listEl.innerHTML = '<p class="text-xs text-gray-400 italic">No followers yet.</p>';
            } else {
                followers.forEach((f) => {
                    const d = document.createElement('div');
                    d.className = 'flex justify-between items-center bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-200 dark:border-[#44403c]';
                    d.innerHTML = `<span class="text-sm font-mono text-coffee-700 dark:text-[#a8a29e] truncate w-40">${f.name || f.uid}</span><button data-action-click="removeFollower('${f.uid}')" class="text-xs text-red-500 hover:text-red-700">Remove</button>`;
                    listEl.appendChild(d);
                });
            }
        } catch (e) {
            console.error('Error loading followers', e);
            listEl.innerHTML = '<p class="text-xs text-red-400 italic">Error loading followers.</p>';
        }
    };

    const loadBlockedUsersList = async () => {
        const user = getCurrentUser();
        if (!user) return;
        const listEl = document.getElementById('blockedUsersList');
        if (!listEl) return;
        listEl.innerHTML = '<p class="text-xs text-gray-400 italic animate-pulse">Loading...</p>';
        try {
            const s = await getDocs(collection(db, 'users', user.uid, 'blockedUsers'));
            const blocked = [];
            s.forEach((d) => blocked.push(d.data()));
            listEl.innerHTML = '';
            if (!blocked.length) {
                listEl.innerHTML = '<p class="text-xs text-gray-400 italic">No blocked users.</p>';
            } else {
                blocked.forEach((b) => {
                    const d = document.createElement('div');
                    d.className = 'flex justify-between items-center bg-coffee-50 dark:bg-[#1c1917] p-2 rounded border border-coffee-200 dark:border-[#44403c]';
                    d.innerHTML = `<span class="text-sm font-mono text-coffee-700 dark:text-[#a8a29e] truncate w-40">${b.name || b.uid}</span><button data-action-click="removeBlockedUser('${b.uid}')" class="text-xs text-blue-500 hover:text-blue-700">Unblock</button>`;
                    listEl.appendChild(d);
                });
            }
        } catch (e) {
            console.error('Error loading blocked users', e);
            listEl.innerHTML = '<p class="text-xs text-red-400 italic">Error loading blocked users.</p>';
        }
    };

    const friendRequests = createSocialFriendRequestsModule({
        getCurrentUser,
        getIsPublic,
        getFollowing,
        dataService,
        onFollowersChanged: loadFollowersList,
        onFollowingChanged: loadFollowingList,
        onBlockedChanged: loadBlockedUsersList,
        onOutgoingAccepted: (friendName) => {
            showToast?.(`Request accepted. ${friendName || 'Friend'} was added to your friend list.`);
        }
    });

    const removeBlockedUser = async (blockedUid) => {
        const user = getCurrentUser();
        if (!user || !blockedUid) return;
        const shouldUnblock = await openAppConfirm({
            title: 'Unblock user?',
            message: 'This allows this user to send friend requests again.',
            confirmLabel: 'Unblock',
            cancelLabel: 'Cancel',
            danger: false
        });
        if (!shouldUnblock) return;
        try {
            const blockedRef = doc(db, 'users', user.uid, 'blockedUsers', blockedUid);
            const blockedSnap = await getDoc(blockedRef);
            const requestId = blockedSnap.exists()
                ? ((blockedSnap.data() || {}).requestId || `${blockedUid}__${user.uid}`)
                : `${blockedUid}__${user.uid}`;
            const batch = writeBatch(db);
            batch.delete(blockedRef);
            batch.delete(doc(db, 'friendRequests', requestId));
            await batch.commit();
            await loadBlockedUsersList();
            await friendRequests.refreshFriendRequests();
        } catch (e) {
            console.error('Remove blocked user error', e);
            alert('Error unblocking user.');
        }
    };

    const searchPublicUsers = () => friendRequests.searchPublicUsers();
    const sendFriendRequest = (toUid) => friendRequests.sendFriendRequest(toUid);
    const acceptFriendRequest = (requestId) => friendRequests.acceptFriendRequest(requestId);
    const declineFriendRequest = (requestId) => friendRequests.declineFriendRequest(requestId);
    const refreshFriendRequests = () => friendRequests.refreshFriendRequests();

    return {
        acceptFriendRequest,
        openFriendsModal,
        closeModal,
        switchModalTab,
        toggleSocialAccordion,
        togglePublicProfile,
        updatePublicToggleUI,
        copyShareId,
        followUser,
        removeBlockedUser,
        removeFollower,
        unfollowUser,
        syncFriendViewSelectValues,
        updateFriendViewSelectors,
        loadFollowingList,
        loadFollowersList,
        loadBlockedUsersList,
        declineFriendRequest,
        refreshFriendRequests,
        searchPublicUsers,
        sendFriendRequest
    };
};
