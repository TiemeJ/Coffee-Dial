export const createAuthStateChangedHandler = ({
    initUserData,
    initPushNotifications,
    loadFollowingList,
    changeView,
    initNotificationListener,
    openHelp,
    openGallery,
    initLightboxListeners,
    clearPushNotifications,
    clearNotificationSubscription,
    clearViewSubscriptions
}) => {
    const setMenuVisibility = (loggedIn) => {
        const ids = [
            'menuAddBrewBtn',
            'menuStatsBtn',
            'menuBeansBtn',
            'menuCoffeesBtn',
            'menuGasBtn',
            'menuGalleryBtn',
            'menuImportExportBtn',
            'menuPreferencesBtn',
            'menuHelpBtn',
            'menuHelpDivider'
        ];
        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) el.classList.toggle('hidden', !loggedIn);
        });
        const divider = document.getElementById('menuHelpDivider');
        if (divider) divider.classList.toggle('hidden', !loggedIn);
    };

    return async (user) => {
        if (user) {
            document.getElementById('authContainer').innerHTML = `<div class="flex items-center gap-3"><button data-action-click="openFriendsModal()" class="relative flex-shrink-0 hover:opacity-80 transition-opacity" aria-label="Open friends profile"><img src="${user.photoURL}" alt="${user.displayName || 'User avatar'}" class="w-8 h-8 flex-shrink-0 rounded-full border border-coffee-200 dark:border-[#44403c]" title="${user.displayName}"><div id="avatarBadge" class="hidden absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white dark:border-[#292524] shadow-md"></div></button></div>`;
            document.getElementById('viewSelectorContainer').classList.remove('hidden');
            document.getElementById('signedOutAuthBody').classList.add('hidden');
            document.getElementById('signedInContent').classList.remove('hidden');
            setMenuVisibility(true);
            const { shouldShowOnboarding } = await initUserData(user);
            Promise.resolve(initPushNotifications?.(user)).catch((error) => {
                console.error('Push initialization failed:', error);
            });
            loadFollowingList();
            changeView('mine');
            initNotificationListener(user.uid);
            if (shouldShowOnboarding) openHelp();
            initLightboxListeners();
            const hasQueryMomentsIntent = typeof window !== 'undefined' &&
                new URLSearchParams(window.location.search || '').has('moments');
            if (hasQueryMomentsIntent) {
                openGallery?.();
            }
            if (typeof window !== 'undefined') {
                try {
                    window.dispatchEvent(new Event('coffee-dial-auth-ready'));
                } catch (_) {
                    // no-op
                }
            }
            return;
        }

        document.getElementById('authContainer').innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center gap-2"><button data-action-click="googleLogin()" class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-white"><path d="M21.35 11.1h-9.17v2.92h5.27c-.23 1.5-1.76 4.4-5.27 4.4-3.17 0-5.76-2.62-5.76-5.85s2.59-5.85 5.76-5.85c1.8 0 3 .77 3.69 1.43l2.52-2.43C16.84 4.28 14.7 3.4 12.18 3.4 7.23 3.4 3.2 7.47 3.2 12.57s4.03 9.17 8.98 9.17c5.18 0 8.61-3.64 8.61-8.76 0-.59-.06-1.04-.14-1.48z"></path></svg><span>Sign in</span></button></div>`;
        document.getElementById('viewSelectorContainer').classList.add('hidden');
        document.getElementById('coffeeTableBody').innerHTML = '';
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('signedInContent').classList.add('hidden');
        document.getElementById('signedOutAuthBody').classList.remove('hidden');
        setMenuVisibility(false);
        await clearPushNotifications?.();
        clearNotificationSubscription();
        clearViewSubscriptions();
    };
};
