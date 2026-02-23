const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

const REGION = "us-central1";
const MAX_COMMENTERS_SCAN = 200;
const MAX_MULTICAST_TOKENS = 500;

const DEFAULT_PREFS = {
  pushEnabled: false,
  friendMoments: true,
  commentsOnMyMoments: true,
  commentsOnFollowedOrCommentedMoments: true,
};
const TEMP_DEBUG_LOGS = true;

function normalizePrefs(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    pushEnabled: !!source.pushEnabled,
    friendMoments: source.friendMoments !== false,
    commentsOnMyMoments: source.commentsOnMyMoments !== false,
    commentsOnFollowedOrCommentedMoments:
      source.commentsOnFollowedOrCommentedMoments !== false,
  };
}

function toStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
      .map((entry) => typeof entry === "string" ? entry.trim() : "")
      .filter((entry) => !!entry);
}

function chunk(items, size) {
  const out = [];
  for (let idx = 0; idx < items.length; idx += size) {
    out.push(items.slice(idx, idx + size));
  }
  return out;
}

async function getFollowers(ownerUid) {
  if (!ownerUid) return [];
  const snap = await db.collection("users")
      .doc(ownerUid)
      .collection("followers")
      .get();
  return snap.docs
      .map((item) => item.id)
      .filter((uid) => !!uid && uid !== ownerUid);
}

async function getRecentCommenters(photoId) {
  if (!photoId) return [];
  const snap = await db.collection("photos")
      .doc(photoId)
      .collection("comments")
      .orderBy("createdAt", "desc")
      .limit(MAX_COMMENTERS_SCAN)
      .get();
  const unique = new Set();
  snap.docs.forEach((item) => {
    const data = item.data() || {};
    const uid = typeof data.uid === "string" ? data.uid : "";
    if (uid) unique.add(uid);
  });
  return [...unique];
}

async function getUserPrefs(uid) {
  if (!uid) return DEFAULT_PREFS;
  const userSnap = await db.collection("users").doc(uid).get();
  const userData = userSnap.exists ? (userSnap.data() || {}) : {};
  const rawPrefs = userData.notificationPrefs || null;
  return normalizePrefs(rawPrefs);
}

async function getUserTokenEntries(uid) {
  if (!uid) return [];
  const snap = await db.collection("users")
      .doc(uid)
      .collection("devices")
      .where("enabled", "==", true)
      .get();
  return snap.docs
      .map((item) => {
        const data = item.data() || {};
        const token = typeof data.token === "string" ? data.token.trim() : "";
        if (!token) return null;
        return {
          uid,
          token,
          ref: item.ref,
        };
      })
      .filter(Boolean);
}

async function markTokenInvalid(entries = []) {
  if (!entries.length) return;
  const batch = db.batch();
  entries.forEach((entry) => {
    batch.set(entry.ref, {
      enabled: false,
      token: "",
      updatedAt: new Date().toISOString(),
    }, {merge: true});
  });
  await batch.commit();
}

async function sendPushToRecipients({recipients, title, body, data}) {
  const notificationType = data && data.type ? data.type : "";
  if (!recipients.length) {
    if (TEMP_DEBUG_LOGS) {
      logger.info("push.send skipped: no recipients", {
        notificationType,
      });
    }
    return;
  }
  const tokenEntries = [];
  const tokenCountByUser = {};
  for (const uid of recipients) {
    // Keep it simple and explicit: one user read + one devices query per user.
    const userEntries = await getUserTokenEntries(uid);
    tokenEntries.push(...userEntries);
    tokenCountByUser[uid] = userEntries.length;
  }
  if (TEMP_DEBUG_LOGS) {
    logger.info("push.send recipient token scan", {
      notificationType,
      recipientCount: recipients.length,
      tokenEntryCount: tokenEntries.length,
      tokenCountByUser,
    });
  }
  if (!tokenEntries.length) {
    logger.info("push.send skipped: no enabled tokens", {
      notificationType,
      recipientCount: recipients.length,
    });
    return;
  }

  const invalidEntries = [];
  const grouped = chunk(tokenEntries, MAX_MULTICAST_TOKENS);
  let totalSuccess = 0;
  let totalFailure = 0;
  const errorCodeCount = {};
  for (const group of grouped) {
    const response = await messaging.sendEachForMulticast({
      tokens: group.map((entry) => entry.token),
      notification: {title, body},
      data: data || {},
      webpush: {
        fcmOptions: {
          link: "/#moments",
        },
      },
    });
    response.responses.forEach((item, idx) => {
      if (item.success) {
        totalSuccess += 1;
        return;
      }
      totalFailure += 1;
      const code = item.error && item.error.code ? item.error.code : "";
      if (code) errorCodeCount[code] = (errorCodeCount[code] || 0) + 1;
      if (
        code === "messaging/registration-token-not-registered" ||
        code === "messaging/invalid-registration-token"
      ) {
        invalidEntries.push(group[idx]);
      }
    });
  }
  logger.info("push.send multicast summary", {
    notificationType,
    recipientCount: recipients.length,
    tokenEntryCount: tokenEntries.length,
    totalSuccess,
    totalFailure,
    invalidTokenCount: invalidEntries.length,
    errorCodeCount,
  });
  if (invalidEntries.length) await markTokenInvalid(invalidEntries);
}

function canReadMoment({uid, ownerUid, sharedWith}) {
  if (!uid || !ownerUid) return false;
  return uid === ownerUid || sharedWith.includes(uid);
}

exports.notifyOnMomentCreated = onDocumentCreated(
    {
      region: REGION,
      document: "photos/{photoId}",
    },
    async (event) => {
      const eventId = event && event.id ? event.id : "";
      const photo = event.data && event.data.data ? event.data.data() : {};
      const photoId = event.params && event.params.photoId ? event.params.photoId : "";
      const ownerUid = typeof photo.uid === "string" ? photo.uid : "";
      logger.info("notifyOnMomentCreated start", {
        eventId,
        photoId,
        ownerUid,
      });
      if (!photoId || !ownerUid) {
        logger.info("notifyOnMomentCreated early return: missing identifiers", {
          eventId,
          photoId,
          ownerUid,
        });
        return;
      }

      const ownerName = typeof photo.uploaderName === "string" &&
          photo.uploaderName.trim() ? photo.uploaderName.trim() : "A friend";
      const sharedWith = toStringArray(photo.sharedWith);
      const followers = await getFollowers(ownerUid);
      const candidateSet = new Set([...sharedWith, ...followers]);
      candidateSet.delete(ownerUid);

      const recipients = [];
      for (const candidateUid of candidateSet) {
        if (!canReadMoment({
          uid: candidateUid,
          ownerUid,
          sharedWith,
        })) continue;
        const prefs = await getUserPrefs(candidateUid);
        if (!prefs.pushEnabled || !prefs.friendMoments) continue;
        recipients.push(candidateUid);
      }
      logger.info("notifyOnMomentCreated recipient filtering", {
        eventId,
        photoId,
        ownerUid,
        sharedWithCount: sharedWith.length,
        followersCount: followers.length,
        candidateCount: candidateSet.size,
        recipientCount: recipients.length,
      });

      await sendPushToRecipients({
        recipients,
        title: `${ownerName} shared a new moment`,
        body: "Tap to open Moments.",
        data: {
          type: "friend_moment",
          photoId,
          link: "/#moments",
        },
      });
      logger.info("notifyOnMomentCreated complete", {
        eventId,
        photoId,
        ownerUid,
        recipientCount: recipients.length,
      });
    },
);

exports.notifyOnCommentCreated = onDocumentCreated(
    {
      region: REGION,
      document: "photos/{photoId}/comments/{commentId}",
    },
    async (event) => {
      const eventId = event && event.id ? event.id : "";
      const comment = event.data && event.data.data ? event.data.data() : {};
      const photoId = event.params &&
          event.params.photoId ? event.params.photoId : "";
      const actorUid = typeof comment.uid === "string" ? comment.uid : "";
      const commentId = event.params &&
          event.params.commentId ? event.params.commentId : "";
      logger.info("notifyOnCommentCreated start", {
        eventId,
        photoId,
        commentId,
        actorUid,
      });
      if (!photoId || !actorUid) {
        logger.info("notifyOnCommentCreated early return: missing identifiers", {
          eventId,
          photoId,
          commentId,
          actorUid,
        });
        return;
      }

      const photoSnap = await db.collection("photos").doc(photoId).get();
      if (!photoSnap.exists) {
        logger.info("notifyOnCommentCreated early return: photo missing", {
          eventId,
          photoId,
          commentId,
        });
        return;
      }
      const photo = photoSnap.data() || {};
      const ownerUid = typeof photo.uid === "string" ? photo.uid : "";
      if (!ownerUid) {
        logger.info("notifyOnCommentCreated early return: owner missing", {
          eventId,
          photoId,
          commentId,
        });
        return;
      }
      const sharedWith = toStringArray(photo.sharedWith);
      const followers = await getFollowers(ownerUid);
      const commenters = await getRecentCommenters(photoId);

      const candidateSet = new Set([ownerUid, ...followers, ...commenters]);
      candidateSet.delete(actorUid);

      const recipients = [];
      for (const candidateUid of candidateSet) {
        if (!canReadMoment({uid: candidateUid, ownerUid, sharedWith})) continue;
        const prefs = await getUserPrefs(candidateUid);
        if (!prefs.pushEnabled) continue;
        if (candidateUid === ownerUid) {
          if (!prefs.commentsOnMyMoments) continue;
        } else if (!prefs.commentsOnFollowedOrCommentedMoments) {
          continue;
        }
        recipients.push(candidateUid);
      }
      logger.info("notifyOnCommentCreated recipient filtering", {
        eventId,
        photoId,
        commentId,
        ownerUid,
        actorUid,
        sharedWithCount: sharedWith.length,
        followersCount: followers.length,
        commentersCount: commenters.length,
        candidateCount: candidateSet.size,
        recipientCount: recipients.length,
      });

      const actorName = typeof comment.uploaderName === "string" &&
          comment.uploaderName.trim() ? comment.uploaderName.trim() : "Someone";
      const commentText = typeof comment.text === "string" ?
          comment.text.trim() : "";
      const body = commentText ?
          commentText.slice(0, 120) :
          "New comment on a moment you follow.";

      await sendPushToRecipients({
        recipients,
        title: `${actorName} commented`,
        body,
        data: {
          type: "moment_comment",
          photoId,
          link: "/#moments",
        },
      });
      logger.info("notifyOnCommentCreated complete", {
        eventId,
        photoId,
        commentId,
        ownerUid,
        actorUid,
        recipientCount: recipients.length,
      });
    },
);
