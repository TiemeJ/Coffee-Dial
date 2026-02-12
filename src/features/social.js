export const createSocialModule = ({
    getCurrentUser,
    getCurrentView,
    setCurrentView,
    getFollowing,
    setFollowingState,
    setFollowersState,
    getIsPublic,
    setIsPublicState,
    db,
    doc,
    updateDoc,
    getDoc,
    getDocs,
    collection,
    writeBatch,
    openAppConfirm,
    changeView
}) => {
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

    const openFriendsModal = () => {
        document.getElementById('modalOverlay')?.classList.remove('hidden');
        switchModalTab('profile');
    };

    const closeModal = () => {
        document.getElementById('modalOverlay')?.classList.add('hidden');
    };

    const switchModalTab = (tab) => {
        const tProf = document.getElementById('tabProfile');
        const tFoll = document.getElementById('tabFollowing');
        const cProf = document.getElementById('contentProfile');
        const cFoll = document.getElementById('contentFollowing');
        if (!tProf || !tFoll || !cProf || !cFoll) return;

        if (tab === 'profile') {
            tProf.classList.add('bg-coffee-50', 'dark:bg-[#1c1917]', 'text-coffee-700', 'dark:text-[#d6ccc2]');
            tProf.classList.remove('text-coffee-500', 'dark:text-[#78716c]');
            tFoll.classList.remove('bg-coffee-50', 'dark:bg-[#1c1917]', 'text-coffee-700', 'dark:text-[#d6ccc2]');
            tFoll.classList.add('text-coffee-500', 'dark:text-[#78716c]');
            cProf.classList.remove('hidden');
            cFoll.classList.add('hidden');
            loadFollowersList();
        } else {
            tFoll.classList.add('bg-coffee-50', 'dark:bg-[#1c1917]', 'text-coffee-700', 'dark:text-[#d6ccc2]');
            tFoll.classList.remove('text-coffee-500', 'dark:text-[#78716c]');
            tProf.classList.remove('bg-coffee-50', 'dark:bg-[#1c1917]', 'text-coffee-700', 'dark:text-[#d6ccc2]');
            tProf.classList.add('text-coffee-500', 'dark:text-[#78716c]');
            cFoll.classList.remove('hidden');
            cProf.classList.add('hidden');
        }
    };

    const togglePublicProfile = async () => {
        const user = getCurrentUser();
        if (!user) return;
        setIsPublicState(!getIsPublic());
        updatePublicToggleUI();
        await updateDoc(doc(db, 'users', user.uid), { isPublic: getIsPublic() });
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
            const d = await getDoc(doc(db, 'users', uId));
            let n = 'Friend';
            if (d.exists() && d.data().displayName) n = d.data().displayName;
            const batch = writeBatch(db);
            batch.set(doc(db, 'users', user.uid, 'following', uId), { uid: uId, name: n, addedAt: new Date().toISOString() });
            batch.set(doc(db, 'users', uId, 'followers', user.uid), { uid: user.uid, name: user.displayName || 'Unknown User', addedAt: new Date().toISOString() });
            await batch.commit();
            if (i) i.value = '';
            loadFollowingList();
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
            batch.delete(doc(db, 'users', u, 'followers', user.uid));
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

    const syncFriendViewSelectValues = (value) => {
        ['viewSelect', 'beansViewSelect', 'coffeeTypesViewSelect', 'gasViewSelect'].forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.value = value;
        });
    };

    const updateFriendViewSelectors = () => {
        const populateSelect = (select, label) => {
            if (!select) return;
            select.innerHTML = `<option value="mine">My ${label}</option>`;
            getFollowing().forEach((f) => {
                const option = document.createElement('option');
                option.value = f.uid;
                option.text = f.name || `Friend (${f.uid.substr(0, 5)}...)`;
                select.appendChild(option);
            });
            select.value = getCurrentView();
        };
        populateSelect(document.getElementById('viewSelect'), 'Brews');
        populateSelect(document.getElementById('beansViewSelect'), 'Beans');
        populateSelect(document.getElementById('coffeeTypesViewSelect'), 'Coffees');
        populateSelect(document.getElementById('gasViewSelect'), 'GAS');
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
                    d.innerHTML = `<span class="text-sm font-mono text-coffee-700 dark:text-[#a8a29e] truncate w-full">${f.name || f.uid}</span>`;
                    listEl.appendChild(d);
                });
            }
        } catch (e) {
            console.error('Error loading followers', e);
            listEl.innerHTML = '<p class="text-xs text-red-400 italic">Error loading followers.</p>';
        }
    };

    return {
        openFriendsModal,
        closeModal,
        switchModalTab,
        togglePublicProfile,
        updatePublicToggleUI,
        copyShareId,
        followUser,
        unfollowUser,
        syncFriendViewSelectValues,
        updateFriendViewSelectors,
        loadFollowingList,
        loadFollowersList
    };
};
