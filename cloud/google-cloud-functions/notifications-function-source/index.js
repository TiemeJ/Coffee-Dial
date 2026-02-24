const {onDocumentCreated} = require("firebase-functions/v2/firestore");
const logger = require("firebase-functions/logger");
const admin = require("firebase-admin");
const webpush = require("web-push");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const messaging = admin.messaging();

const REGION = "us-central1";
const MAX_COMMENTERS_SCAN = 200;
const MAX_MULTICAST_TOKENS = 500;
const MOMENTS_PUSH_LINK = "https://tiemej.github.io/Coffee-Dial/?moments";
const WEB_PUSH_SUBJECT = process.env.WEB_PUSH_SUBJECT ||
  "mailto:noreply@coffee-dial.app";
const WEB_PUSH_PUBLIC_KEY = process.env.WEB_PUSH_PUBLIC_KEY ||
  process.env.WEB_PUSH_VAPID_PUBLIC_KEY || "";
const WEB_PUSH_PRIVATE_KEY = process.env.WEB_PUSH_PRIVATE_KEY ||
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY || "";

const DEFAULT_PREFS = {
  pushEnabled: false,
  friendMoments: true,
  commentsOnMyMoments: true,
  commentsOnFollowedOrCommentedMoments: true,
};
const TEMP_DEBUG_LOGS = true;
let webPushConfigured = false;

if (WEB_PUSH_PUBLIC_KEY && WEB_PUSH_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
        WEB_PUSH_SUBJECT,
        WEB_PUSH_PUBLIC_KEY,
        WEB_PUSH_PRIVATE_KEY,
    );
    webPushConfigured = true;
  } catch (error) {
    logger.error("webpush vapid configuration failed", {
      error: error && error.message ? error.message : String(error),
    });
    webPushConfigured = false;
  }
}

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

function normalizeWebPushSubscription(value) {
  if (!value || typeof value !== "object") return null;
  const endpoint = typeof value.endpoint === "string" ?
    value.endpoint.trim() : "";
  const keys = value.keys && typeof value.keys === "object" ? value.keys : {};
  const p256dh = typeof keys.p256dh === "string" ? keys.p256dh.trim() : "";
  const auth = typeof keys.auth === "string" ? keys.auth.trim() : "";
  if (!endpoint || !p256dh || !auth) return null;
  return {
    endpoint,
    expirationTime: value.expirationTime || null,
    keys: {p256dh, auth},
  };
}

async function getUserPushTargetEntries(uid) {
  if (!uid) return {fcmEntries: [], declarativeEntries: []};
  const snap = await db.collection("users")
      .doc(uid)
      .collection("devices")
      .where("enabled", "==", true)
      .get();
  const fcmEntries = [];
  const declarativeEntries = [];
  snap.docs.forEach((item) => {
    const data = item.data() || {};
    const subscription = normalizeWebPushSubscription(data.webPushSubscription);
    const token = typeof data.token === "string" ? data.token.trim() : "";
    if (subscription) {
      declarativeEntries.push({
        uid,
        subscription,
        ref: item.ref,
      });
      return;
    }
    if (token) {
      fcmEntries.push({
        uid,
        token,
        ref: item.ref,
      });
    }
  });
  return {fcmEntries, declarativeEntries};
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

async function markWebPushSubscriptionInvalid(entries = []) {
  if (!entries.length) return;
  const batch = db.batch();
  entries.forEach((entry) => {
    batch.set(entry.ref, {
      enabled: false,
      webPushSubscription: null,
      updatedAt: new Date().toISOString(),
    }, {merge: true});
  });
  await batch.commit();
}

function buildDeclarativeWebPushPayload({title, body, link, data}) {
  const payload = {
    web_push: 8030,
    notification: {
      title: typeof title === "string" ? title : "Coffee Dial",
      body: typeof body === "string" ? body : "",
      icon: "/Coffee-Dial/img/icon-192.png",
      navigate: typeof link === "string" && link.trim() ?
        link.trim() : MOMENTS_PUSH_LINK,
      data: data || {},
    },
  };
  return JSON.stringify(payload);
}

async function sendPushToRecipients({recipients, title, body, data}) {
  const notificationType = data && data.type ? data.type : "";
  const pushLink = data && typeof data.link === "string" && data.link.trim() ?
    data.link.trim() :
    MOMENTS_PUSH_LINK;
  if (!recipients.length) {
    if (TEMP_DEBUG_LOGS) {
      logger.info("push.send skipped: no recipients", {
        notificationType,
      });
    }
    return;
  }
  const tokenEntries = [];
  const declarativeEntries = [];
  const tokenCountByUser = {};
  for (const uid of recipients) {
    // Keep it simple and explicit: one user read + one devices query per user.
    const targets = await getUserPushTargetEntries(uid);
    tokenEntries.push(...targets.fcmEntries);
    declarativeEntries.push(...targets.declarativeEntries);
    tokenCountByUser[uid] = targets.fcmEntries.length;
  }
  if (TEMP_DEBUG_LOGS) {
    logger.info("push.send recipient token scan", {
      notificationType,
      recipientCount: recipients.length,
      tokenEntryCount: tokenEntries.length,
      declarativeEntryCount: declarativeEntries.length,
      tokenCountByUser,
      webPushConfigured,
    });
  }
  if (!tokenEntries.length && !declarativeEntries.length) {
    logger.info("push.send skipped: no enabled tokens", {
      notificationType,
      recipientCount: recipients.length,
    });
    return;
  }

  const invalidEntries = [];
  const invalidDeclarativeEntries = [];
  let declarativeSuccess = 0;
  let declarativeFailure = 0;
  const declarativeErrorCodeCount = {};
  const grouped = chunk(tokenEntries, MAX_MULTICAST_TOKENS);
  let totalSuccess = 0;
  let totalFailure = 0;
  const errorCodeCount = {};
  const messageData = {
    ...(data || {}),
    link: pushLink,
  };
  if (webPushConfigured && declarativeEntries.length) {
    const declarativePayload = buildDeclarativeWebPushPayload({
      title,
      body,
      link: pushLink,
      data: messageData,
    });
    for (const entry of declarativeEntries) {
      try {
        await webpush.sendNotification(entry.subscription, declarativePayload, {
          TTL: 60,
        });
        declarativeSuccess += 1;
      } catch (error) {
        declarativeFailure += 1;
        const statusCode = error && error.statusCode ? String(error.statusCode) :
          (error && error.code ? String(error.code) : "unknown");
        declarativeErrorCodeCount[statusCode] =
          (declarativeErrorCodeCount[statusCode] || 0) + 1;
        if (statusCode === "404" || statusCode === "410") {
          invalidDeclarativeEntries.push(entry);
        }
      }
    }
  } else if (declarativeEntries.length) {
    logger.warn("push.send declarative skipped: missing VAPID config", {
      notificationType,
      declarativeEntryCount: declarativeEntries.length,
    });
  }

  for (const group of grouped) {
    const response = await messaging.sendEachForMulticast({
      tokens: group.map((entry) => entry.token),
      notification: {
        title: typeof title === "string" ? title : "Coffee Dial",
        body: typeof body === "string" ? body : "",
      },
      data: messageData,
      webpush: {
        notification: {
          title: typeof title === "string" ? title : "Coffee Dial",
          body: typeof body === "string" ? body : "",
          icon: "/img/icon-192.png",
        },
        fcmOptions: {
          link: pushLink,
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
    declarativeEntryCount: declarativeEntries.length,
    totalSuccess,
    totalFailure,
    invalidTokenCount: invalidEntries.length,
    errorCodeCount,
    declarativeSuccess,
    declarativeFailure,
    invalidDeclarativeCount: invalidDeclarativeEntries.length,
    declarativeErrorCodeCount,
  });
  if (invalidEntries.length) await markTokenInvalid(invalidEntries);
  if (invalidDeclarativeEntries.length) {
    await markWebPushSubscriptionInvalid(invalidDeclarativeEntries);
  }
}

function canReadMoment({uid, ownerUid, sharedWith}) {
  if (!uid || !ownerUid) return false;
  return uid === ownerUid || sharedWith.includes(uid);
}

function getFieldString(fields, key) {
  const value = fields && fields[key] ? fields[key] : null;
  if (!value) return "";
  if (typeof value.stringValue === "string") return value.stringValue;
  return "";
}

function getFieldStringArray(fields, key) {
  const value = fields && fields[key] ? fields[key] : null;
  const entries = value && value.arrayValue && Array.isArray(value.arrayValue.values) ?
    value.arrayValue.values : [];
  return entries
      .map((item) => (item && typeof item.stringValue === "string" ? item.stringValue.trim() : ""))
      .filter((item) => !!item);
}

function decodePubsubWrappedData(data) {
  const message = data && data.message ? data.message : null;
  const encoded = message && typeof message.data === "string" ? message.data : "";
  if (!encoded) return null;
  try {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    return JSON.parse(decoded);
  } catch (error) {
    logger.warn("Failed decoding Pub/Sub wrapped event payload", {
      error: error && error.message ? error.message : String(error),
    });
    return null;
  }
}

function getEventData(event) {
  const data = event && event.data ? event.data : null;
  if (!data || typeof data !== "object") return null;
  const decoded = decodePubsubWrappedData(data);
  if (decoded && typeof decoded === "object") return decoded;
  return data;
}

function getCloudEventAttr(event, key) {
  const data = event && event.data ? event.data : null;
  const attrs = data && data.message && data.message.attributes ?
    data.message.attributes : null;
  if (!attrs) return "";
  const value = attrs[key];
  return typeof value === "string" ? value : "";
}

function getDocumentNameFromEvent(event, eventData) {
  const data = eventData || getEventData(event);
  if (data && data.value && typeof data.value.name === "string") {
    return data.value.name;
  }
  if (data && typeof data.name === "string") return data.name;
  const ceSubject = getCloudEventAttr(event, "ce-subject");
  if (typeof ceSubject === "string" && ceSubject) return ceSubject;
  if (typeof event.subject === "string") return event.subject;
  return "";
}

function extractIdsFromDocumentName(documentName) {
  const normalized = typeof documentName === "string" ? documentName : "";
  const pathStart = normalized.includes("/documents/") ?
    normalized.split("/documents/")[1] : normalized;
  const momentMatch = pathStart.match(/^photos\/([^/]+)$/);
  if (momentMatch) {
    return {photoId: momentMatch[1] || "", commentId: ""};
  }
  const commentMatch = pathStart.match(/^photos\/([^/]+)\/comments\/([^/]+)$/);
  if (commentMatch) {
    return {
      photoId: commentMatch[1] || "",
      commentId: commentMatch[2] || "",
    };
  }
  return {photoId: "", commentId: ""};
}

function readMomentFromEvent(event, eventData) {
  const data = eventData || getEventData(event);
  if (data && typeof data.data === "function") {
    const snapshotData = data.data() || {};
    return {
      uid: typeof snapshotData.uid === "string" ? snapshotData.uid : "",
      uploaderName: typeof snapshotData.uploaderName === "string" ? snapshotData.uploaderName : "",
      sharedWith: toStringArray(snapshotData.sharedWith),
    };
  }
  const fields = data && data.value && data.value.fields ? data.value.fields : {};
  return {
    uid: getFieldString(fields, "uid"),
    uploaderName: getFieldString(fields, "uploaderName"),
    sharedWith: getFieldStringArray(fields, "sharedWith"),
  };
}

function readCommentFromEvent(event) {
  const data = getEventData(event);
  if (data && typeof data.data === "function") {
    const snapshotData = data.data() || {};
    return {
      uid: typeof snapshotData.uid === "string" ? snapshotData.uid : "",
      uploaderName: typeof snapshotData.uploaderName === "string" ? snapshotData.uploaderName : "",
      text: typeof snapshotData.text === "string" ? snapshotData.text : "",
    };
  }
  const fields = data && data.value && data.value.fields ? data.value.fields : {};
  return {
    uid: getFieldString(fields, "uid"),
    uploaderName: getFieldString(fields, "uploaderName"),
    text: getFieldString(fields, "text"),
  };
}

exports.notifyOnMomentCreated = onDocumentCreated(
    {
      region: REGION,
      document: "photos/{photoId}",
    },
    async (event) => {
      const eventData = getEventData(event);
      const eventId = event && event.id ? event.id : getCloudEventAttr(event, "ce-id");
      const photo = readMomentFromEvent(event, eventData);
      const documentName = getDocumentNameFromEvent(event, eventData);
      const extractedIds = extractIdsFromDocumentName(documentName);
      const photoIdFromParams = event && event.params && event.params.photoId ?
        event.params.photoId : "";
      const photoId = photoIdFromParams || extractedIds.photoId || "";
      const ownerUid = typeof photo.uid === "string" ? photo.uid : "";
      logger.info("notifyOnMomentCreated start", {
        eventId,
        photoId,
        ownerUid,
        hasParams: !!(event && event.params),
        hasSnapshotAccessor: !!(event && event.data && typeof event.data.data === "function"),
        dataKeys: eventData && typeof eventData === "object" ? Object.keys(eventData) : [],
        ceType: event && event.type ? event.type : getCloudEventAttr(event, "ce-type"),
        ceSubject: getCloudEventAttr(event, "ce-subject"),
        documentName,
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
      const sharedWith = toStringArray(photo.sharedWith || []);
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
          link: MOMENTS_PUSH_LINK,
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
      const eventData = getEventData(event);
      const eventId = event && event.id ? event.id : getCloudEventAttr(event, "ce-id");
      const comment = readCommentFromEvent(event);
      const documentName = getDocumentNameFromEvent(event, eventData);
      const extractedIds = extractIdsFromDocumentName(documentName);
      const photoIdFromParams = event && event.params && event.params.photoId ?
        event.params.photoId : "";
      const commentIdFromParams = event && event.params && event.params.commentId ?
        event.params.commentId : "";
      const photoId = photoIdFromParams || extractedIds.photoId || "";
      const commentId = commentIdFromParams || extractedIds.commentId || "";
      const actorUid = typeof comment.uid === "string" ? comment.uid : "";
      logger.info("notifyOnCommentCreated start", {
        eventId,
        photoId,
        commentId,
        actorUid,
        hasParams: !!(event && event.params),
        hasSnapshotAccessor: !!(event && event.data && typeof event.data.data === "function"),
        dataKeys: eventData && typeof eventData === "object" ? Object.keys(eventData) : [],
        ceType: event && event.type ? event.type : getCloudEventAttr(event, "ce-type"),
        ceSubject: getCloudEventAttr(event, "ce-subject"),
        documentName,
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
          link: MOMENTS_PUSH_LINK,
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
