export const createAuthStateChangedHandler = ({
    initUserData,
    loadFollowingList,
    changeView,
    initNotificationListener,
    openHelp,
    initZoomListeners,
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
            document.getElementById('authContainer').innerHTML = `<div class="flex items-center gap-3"><button data-action-click="openFriendsModal()" class="relative flex-shrink-0 hover:opacity-80 transition-opacity"><img src="${user.photoURL}" class="w-8 h-8 flex-shrink-0 rounded-full border border-coffee-200 dark:border-[#44403c]" title="${user.displayName}"><div id="avatarBadge" class="hidden absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white dark:border-[#292524] shadow-md"></div></button></div>`;
            document.getElementById('viewSelectorContainer').classList.remove('hidden');
            document.getElementById('signedOutAuthBody').classList.add('hidden');
            document.getElementById('signedInContent').classList.remove('hidden');
            setMenuVisibility(true);
            const { shouldShowOnboarding } = await initUserData(user);
            loadFollowingList();
            changeView('mine');
            initNotificationListener(user.uid);
            if (shouldShowOnboarding) openHelp();
            initZoomListeners();
            return;
        }

        document.getElementById('authContainer').innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center gap-2"><button data-action-click="googleLogin()" class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><i class="fa-brands fa-google"></i> Sign in</button></div>`;
        document.getElementById('viewSelectorContainer').classList.add('hidden');
        document.getElementById('coffeeTableBody').innerHTML = '';
        document.getElementById('emptyState').classList.add('hidden');
        document.getElementById('signedInContent').classList.add('hidden');
        document.getElementById('signedOutAuthBody').classList.remove('hidden');
        setMenuVisibility(false);
        clearNotificationSubscription();
        clearViewSubscriptions();
    };
};
