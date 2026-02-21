export const createGalleryCommentsModule = ({
    getCurrentUser,
    db,
    collection,
    doc,
    updateDoc,
    query,
    orderBy,
    limit,
    getDocs,
    addDoc
}) => {
    if (!db || !collection || !doc || !updateDoc || !query || !orderBy || !limit || !getDocs || !addDoc) {
        throw new Error('createGalleryCommentsModule requires { db, collection, doc, updateDoc, query, orderBy, limit, getDocs, addDoc }');
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
        try {
            await updateDoc(doc(db, 'photos', photoId), {
                lastCommentAt: payload.createdAt,
                lastCommentByUid: user.uid
            });
        } catch (error) {
            console.warn('Could not update moment comment metadata:', error);
        }
        return payload;
    };

    return {
        listComments,
        addComment
    };
};
