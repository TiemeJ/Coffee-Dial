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
    db,
    doc,
    updateDoc,
    getDoc,
    getDocs,
    collection,
    writeBatch,
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
        db,
        doc,
        updateDoc,
        getDoc,
        getDocs,
        collection,
        writeBatch,
        openAppConfirm,
        changeView
    });
