export const DEFAULT_NOTIFICATION_PREFERENCES = {
    pushEnabled: false,
    friendMoments: true,
    commentsOnMyMoments: true,
    commentsOnFollowedOrCommentedMoments: true
};

export const normalizeNotificationPreferences = (value = null) => {
    const source = (value && typeof value === 'object') ? value : {};
    return {
        pushEnabled: !!source.pushEnabled,
        friendMoments: source.friendMoments !== false,
        commentsOnMyMoments: source.commentsOnMyMoments !== false,
        commentsOnFollowedOrCommentedMoments: source.commentsOnFollowedOrCommentedMoments !== false
    };
};

