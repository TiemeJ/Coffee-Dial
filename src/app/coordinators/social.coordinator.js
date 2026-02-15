import { createSocialModule } from '../../features/social.js';

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
    changeView
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
        changeView
    });
