export const createGalleryCommentsModule = ({
    getCurrentUser,
    db,
    collection,
    query,
    orderBy,
    limit,
    getDocs,
    addDoc
}) => {
    if (!db || !collection || !query || !orderBy || !limit || !getDocs || !addDoc) {
        throw new Error('createGalleryCommentsModule requires { db, collection, query, orderBy, limit, getDocs, addDoc }');
    }

    const normalizeCommentText = (text) => (text ?? '').toString().trim();

    const listComments = async ({ photoId, max = 30 }) => {
        if (!photoId) return [];
        const commentsQuery = query(
            collection(db, 'photos', photoId, 'comments'),
            orderBy('createdAt', 'desc'),
            limit(Math.max(1, max))
        );
        const snapshot = await getDocs(commentsQuery);
        return snapshot.docs.map((item) => ({
            id: item.id,
            ...item.data()
        }));
    };

    const addComment = async ({ photoId, text }) => {
        const user = getCurrentUser?.();
        if (!user?.uid) throw new Error('Please sign in first.');
        if (!photoId) throw new Error('Moment not found.');

        const normalizedText = normalizeCommentText(text);
        if (!normalizedText) throw new Error('Please enter a comment.');
        if (normalizedText.length > 1000) throw new Error('Comment is too long.');

        const payload = {
            uid: user.uid,
            uploaderName: user.displayName || 'Unknown User',
            text: normalizedText,
            createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'photos', photoId, 'comments'), payload);
        return payload;
    };

    return {
        listComments,
        addComment
    };
};
