export const createGalleryLikesModule = ({
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
