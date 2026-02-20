import admin from "firebase-admin";
import {URL} from "node:url";

const DEFAULT_PROJECT_ID = "coffee-dial-app-9db38";
const DEFAULT_BUCKET = "coffee-dial-app-9db38.firebasestorage.app";
const PAGE_SIZE = 400;
const WRITE_BATCH_LIMIT = 400;

function parseArgs(argv) {
  const args = {
    apply: false,
    projectId: DEFAULT_PROJECT_ID,
    bucket: DEFAULT_BUCKET,
    limit: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--project" && argv[i + 1]) {
      args.projectId = argv[i + 1];
      i += 1;
    } else if (arg === "--bucket" && argv[i + 1]) {
      args.bucket = argv[i + 1];
      i += 1;
    } else if (arg === "--limit" && argv[i + 1]) {
      args.limit = Number(argv[i + 1]) || 0;
      i += 1;
    } else if (arg === "--help") {
      printUsage();
      process.exit(0);
    }
  }

  return args;
}

function printUsage() {
  console.log(`\nBackfill photos.photoPath/thumbPath from legacy photoURL/thumbURL fields.\n\nUsage:\n  node backfill-photo-paths.mjs [--apply] [--project PROJECT_ID] [--bucket BUCKET] [--limit N]\n\nOptions:\n  --apply            Write updates. If omitted, runs in dry-run mode.\n  --project ID       GCP project id (default: ${DEFAULT_PROJECT_ID}).\n  --bucket NAME      Expected storage bucket host (default: ${DEFAULT_BUCKET}).\n  --limit N          Stop after evaluating N docs (default: all).\n  --help             Show this help.\n`);
}

function decodeStoragePath(value, expectedBucket) {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (trimmed.startsWith("photos/")) return trimmed;

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch (_) {
    return "";
  }

  // Firebase download URL format: /v0/b/<bucket>/o/<encodedPath>
  if (parsed.pathname.includes("/o/")) {
    const encodedPath = parsed.pathname.split("/o/")[1] || "";
    if (!encodedPath) return "";
    try {
      const decoded = decodeURIComponent(encodedPath);
      return decoded.startsWith("photos/") ? decoded : "";
    } catch (_) {
      return "";
    }
  }

  // Signed URL format: /<bucket>/<path>
  if (parsed.hostname === "storage.googleapis.com") {
    const path = parsed.pathname.startsWith("/") ? parsed.pathname.slice(1) : parsed.pathname;
    const slashIndex = path.indexOf("/");
    if (slashIndex === -1) return "";
    const bucketName = path.slice(0, slashIndex);
    if (bucketName !== expectedBucket) return "";
    const objectPath = path.slice(slashIndex + 1);
    return objectPath.startsWith("photos/") ? objectPath : "";
  }

  // Firebase storage host often uses bucket name as host and object path as pathname.
  if (parsed.hostname.endsWith("firebasestorage.app") || parsed.hostname.endsWith("appspot.com")) {
    const candidatePath = parsed.pathname.startsWith("/") ? parsed.pathname.slice(1) : parsed.pathname;
    if (candidatePath.startsWith("photos/")) return candidatePath;
  }

  return "";
}

function needsBackfill(data, expectedBucket) {
  const hasPhotoPath = typeof data.photoPath === "string" && data.photoPath.trim().length > 0;
  const hasThumbPath = typeof data.thumbPath === "string" && data.thumbPath.trim().length > 0;

  const legacyPhotoPath = decodeStoragePath(data.photoURL, expectedBucket);
  const legacyThumbPath = decodeStoragePath(data.thumbURL, expectedBucket);

  const update = {};
  if (!hasPhotoPath && legacyPhotoPath) update.photoPath = legacyPhotoPath;
  if (!hasThumbPath && legacyThumbPath) update.thumbPath = legacyThumbPath;

  return {
    shouldUpdate: Object.keys(update).length > 0,
    update,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  admin.initializeApp({
    projectId: args.projectId,
    storageBucket: args.bucket,
  });

  const db = admin.firestore();
  const photosCollection = db.collection("photos");

  let scanned = 0;
  let eligible = 0;
  let updated = 0;
  let skipped = 0;
  let pageCursor = null;

  const updates = [];

  while (true) {
    let q = photosCollection
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(PAGE_SIZE);

    if (pageCursor) {
      q = q.startAfter(pageCursor);
    }

    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      if (args.limit > 0 && scanned >= args.limit) break;

      scanned += 1;
      const data = docSnap.data() || {};
      const result = needsBackfill(data, args.bucket);

      if (!result.shouldUpdate) {
        skipped += 1;
        continue;
      }

      eligible += 1;
      updates.push({id: docSnap.id, update: result.update});

      if (!args.apply) {
        console.log(`[dry-run] photos/${docSnap.id}`, result.update);
      }
    }

    pageCursor = snap.docs[snap.docs.length - 1];

    if (args.limit > 0 && scanned >= args.limit) {
      break;
    }
  }

  if (args.apply && updates.length > 0) {
    for (let i = 0; i < updates.length; i += WRITE_BATCH_LIMIT) {
      const chunk = updates.slice(i, i + WRITE_BATCH_LIMIT);
      const batch = db.batch();
      chunk.forEach((entry) => {
        batch.update(photosCollection.doc(entry.id), {
          ...entry.update,
          updatedAt: new Date().toISOString(),
        });
      });
      await batch.commit();
      updated += chunk.length;
      console.log(`[apply] committed ${chunk.length} updates (${updated}/${updates.length})`);
    }
  }

  console.log("\nBackfill summary");
  console.log("- Mode:", args.apply ? "apply" : "dry-run");
  console.log("- Project:", args.projectId);
  console.log("- Scanned docs:", scanned);
  console.log("- Eligible docs:", eligible);
  console.log("- Updated docs:", args.apply ? updated : 0);
  console.log("- Skipped docs:", skipped);

  process.exit(0);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
