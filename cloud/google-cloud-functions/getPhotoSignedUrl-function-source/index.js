const {onCall, HttpsError} = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

const MIN_URL_TTL_MINUTES = 1;
const MAX_URL_TTL_MINUTES = 5;
const DEFAULT_URL_TTL_MINUTES = 3;

/**
 * Clamps a numeric minute value into the supported signed URL range.
 * @param {unknown} value
 * @return {number}
 */
function resolveTtlMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return DEFAULT_URL_TTL_MINUTES;
  }
  return Math.max(
      MIN_URL_TTL_MINUTES,
      Math.min(MAX_URL_TTL_MINUTES, Math.floor(parsed)),
  );
}

/**
 * @param {Record<string, unknown>} photoData
 * @param {string} variant
 * @return {string}
 */
function selectStoragePath(photoData, variant) {
  const fullPath = typeof photoData.photoPath === "string" ?
      photoData.photoPath.trim() :
      "";
  const thumbPath = typeof photoData.thumbPath === "string" ?
      photoData.thumbPath.trim() :
      "";

  if (variant === "thumb" && thumbPath) {
    return thumbPath;
  }
  if (fullPath) {
    return fullPath;
  }
  if (thumbPath) {
    return thumbPath;
  }
  throw new HttpsError(
      "failed-precondition",
      "Photo does not have a valid storage path.",
  );
}

/**
 * @param {string} path
 * @param {string} ownerUid
 */
function validateOwnerPath(path, ownerUid) {
  const expectedPrefix = `photos/${ownerUid}/`;
  if (!path.startsWith(expectedPrefix)) {
    throw new HttpsError(
        "permission-denied",
        "Storage path is outside the owner namespace.",
    );
  }
}

exports.getPhotoSignedUrl = onCall({cors: true}, async (request) => {
  if (!request.auth || !request.auth.uid) {
    throw new HttpsError("unauthenticated", "Authentication is required.");
  }

  const callerUid = request.auth.uid;
  const payload = request.data || {};
  const photoId = typeof payload.photoId === "string" ?
      payload.photoId.trim() :
      "";
  const variant = payload.variant === "thumb" ? "thumb" : "full";
  const ttlMinutes = resolveTtlMinutes(payload.expiresInMinutes);

  if (!photoId) {
    throw new HttpsError("invalid-argument", "photoId is required.");
  }

  const photoSnap = await db.collection("photos").doc(photoId).get();
  if (!photoSnap.exists) {
    throw new HttpsError("not-found", "Photo not found.");
  }

  const photo = photoSnap.data() || {};
  const ownerUid = typeof photo.uid === "string" ? photo.uid : "";
  const sharedWith = Array.isArray(photo.sharedWith) ? photo.sharedWith : [];

  const canAccess = callerUid === ownerUid || sharedWith.includes(callerUid);
  if (!canAccess) {
    throw new HttpsError(
        "permission-denied",
        "You are not allowed to access this photo.",
    );
  }

  const path = selectStoragePath(photo, variant);
  validateOwnerPath(path, ownerUid);

  const expiresAtMs = Date.now() + ttlMinutes * 60 * 1000;
  const [signedUrl] = await storage.bucket().file(path).getSignedUrl({
    version: "v4",
    action: "read",
    expires: expiresAtMs,
  });

  return {
    photoId,
    variant,
    signedUrl,
    expiresAt: new Date(expiresAtMs).toISOString(),
    cacheTtlSeconds: ttlMinutes * 60,
  };
});
