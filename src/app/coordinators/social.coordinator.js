import { createSocialModule } from '../../features/social/social.module.js';

export const createSocialCoordinator = ({
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
}) =>
    createSocialModule({
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
    });
