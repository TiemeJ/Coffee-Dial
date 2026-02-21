export const createGalleryLikesModule = ({
    getCurrentUser,
    db,
    doc,
    updateDoc,
    arrayUnion,
    arrayRemove
}) => {
    if (!db || !doc || !updateDoc || !arrayUnion || !arrayRemove) {
        throw new Error('createGalleryLikesModule requires { db, doc, updateDoc, arrayUnion, arrayRemove }');
    }

    const getCurrentUid = () => {
        const uid = getCurrentUser?.()?.uid;
        return typeof uid === 'string' ? uid : '';
    };

    const getLikedBy = (data) =>
        Array.isArray(data?.likedBy)
            ? data.likedBy
                .map((uid) => (typeof uid === 'string' ? uid.trim() : ''))
                .filter((uid) => !!uid)
            : [];

    const getLikeCount = (data) => getLikedBy(data).length;

    const hasLiked = (data) => {
        const uid = getCurrentUid();
        if (!uid) return false;
        return getLikedBy(data).includes(uid);
    };

    const canLikeMoment = (data) => {
        const uid = getCurrentUid();
        const ownerUid = typeof data?.uid === 'string' ? data.uid.trim() : '';
        if (!uid || !ownerUid) return false;
        return uid !== ownerUid;
    };

    const toggleLike = async ({ photoId, data }) => {
        const uid = getCurrentUid();
        if (!uid || !photoId || !canLikeMoment(data)) return false;
        const alreadyLiked = hasLiked(data);
        await updateDoc(doc(db, 'photos', photoId), {
            likedBy: alreadyLiked ? arrayRemove(uid) : arrayUnion(uid)
        });
        return !alreadyLiked;
    };

    return {
        getLikeCount,
        hasLiked,
        canLikeMoment,
        toggleLike
    };
};
