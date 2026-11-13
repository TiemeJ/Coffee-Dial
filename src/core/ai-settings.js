import { DEFAULT_GEMINI_MODEL } from './gemini-client.js';

// The user's own AI key. It must never go into users/{uid} itself: that document is readable
// by followers. It lives in users/{uid}/private/ai (owner-only in the Firestore rules) so it
// syncs across devices, with a localStorage copy so it is available instantly and offline.

const LOCAL_KEY_PREFIX = 'coffeeDial.aiSettings.';

export const normalizeAiSettings = (value = null) => {
    const source = value && typeof value === 'object' ? value : {};
    return {
        geminiApiKey: `${source.geminiApiKey || ''}`.trim(),
        geminiModel: `${source.geminiModel || ''}`.trim() || DEFAULT_GEMINI_MODEL,
        updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : ''
    };
};

export const createAiSettingsStore = ({ dataService, getCurrentUser, storage = globalThis.localStorage } = {}) => {
    const { db, doc, getDoc, setDoc } = dataService || {};
    if (!db || !doc || !getDoc || !setDoc) {
        throw new Error('createAiSettingsStore requires dataService { db, doc, getDoc, setDoc }');
    }

    let cachedUid = null;
    let cached = null;
    let cloudLoadPromise = null;

    const getUid = () => getCurrentUser?.()?.uid || null;
    const privateRef = (uid) => doc(db, 'users', uid, 'private', 'ai');

    const readLocal = (uid) => {
        try {
            const raw = storage?.getItem(`${LOCAL_KEY_PREFIX}${uid}`);
            return raw ? normalizeAiSettings(JSON.parse(raw)) : null;
        } catch (_) {
            return null;
        }
    };

    const writeLocal = (uid, settings) => {
        try {
            storage?.setItem(`${LOCAL_KEY_PREFIX}${uid}`, JSON.stringify(settings));
        } catch (_) { /* storage unavailable: the cloud copy still works */ }
    };

    const ensureUser = () => {
        const uid = getUid();
        if (uid !== cachedUid) {
            cachedUid = uid;
            cached = uid ? readLocal(uid) : null;
            cloudLoadPromise = null;
        }
        return uid;
    };

    const loadFromCloud = (uid) => {
        if (!cloudLoadPromise) {
            cloudLoadPromise = (async () => {
                try {
                    const snap = await getDoc(privateRef(uid));
                    if (uid !== cachedUid || !snap.exists()) return;
                    const cloud = normalizeAiSettings(snap.data());
                    const local = cached;
                    // Newest write wins, so a key changed on another device replaces the local copy.
                    if (!local || !local.geminiApiKey || cloud.updatedAt >= local.updatedAt) {
                        cached = cloud;
                        writeLocal(uid, cloud);
                    }
                } catch (error) {
                    cloudLoadPromise = null;
                    console.warn('Could not load AI settings from the cloud; using this device only.', error);
                }
            })();
        }
        return cloudLoadPromise;
    };

    const load = async () => {
        const uid = ensureUser();
        if (!uid) return normalizeAiSettings();
        await loadFromCloud(uid);
        return normalizeAiSettings(cached);
    };

    // Returns { settings, synced }: synced is false when only the local copy could be written.
    const save = async (next = {}) => {
        const uid = ensureUser();
        if (!uid) throw new Error('Sign in to save AI settings.');
        const settings = normalizeAiSettings({ ...next, updatedAt: new Date().toISOString() });
        cached = settings;
        writeLocal(uid, settings);
        try {
            await setDoc(privateRef(uid), settings);
            return { settings, synced: true };
        } catch (error) {
            console.warn('Could not sync AI settings to the cloud; saved on this device only.', error);
            return { settings, synced: false };
        }
    };

    return { load, save };
};
