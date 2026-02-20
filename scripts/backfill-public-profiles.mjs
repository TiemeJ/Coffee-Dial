import {
  commitOps,
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  nowIso,
  parseCommonArgs,
  printCommonUsage,
} from "./admin-utils.mjs";

const SCRIPT = "scripts/backfill-public-profiles.mjs";

function normalizeDisplayName(value) {
  const text = (value || "").toString().trim();
  return text || "Unknown User";
}

async function processUser(db, uid, apply) {
  const userRef = db.collection("users").doc(uid);
  const publicProfileRef = db.collection("publicProfiles").doc(uid);

  const [userSnap, publicSnap] = await Promise.all([
    userRef.get(),
    publicProfileRef.get(),
  ]);

  if (!userSnap.exists) {
    return {
      scannedUsers: 0,
      createdProfiles: 0,
      updatedProfiles: 0,
      skippedUsers: 1,
      ops: 0,
      committed: 0,
    };
  }

  const userData = userSnap.data() || {};
  const nextDisplayName = normalizeDisplayName(userData.displayName);
  const nextIsPublic = userData.isPublic === true;
  const now = nowIso();

  const ops = [];
  let createdProfiles = 0;
  let updatedProfiles = 0;

  if (!publicSnap.exists) {
    createdProfiles += 1;
    ops.push({
      type: "set",
      ref: publicProfileRef,
      data: {
        uid,
        displayName: nextDisplayName,
        isPublic: nextIsPublic,
        updatedAt: now,
      },
    });
  } else {
    const publicData = publicSnap.data() || {};
    const needsUpdate =
      publicData.uid !== uid ||
      (publicData.displayName || "") !== nextDisplayName ||
      publicData.isPublic !== nextIsPublic;

    if (needsUpdate) {
      updatedProfiles += 1;
      ops.push({
        type: "update",
        ref: publicProfileRef,
        data: {
          uid,
          displayName: nextDisplayName,
          isPublic: nextIsPublic,
          updatedAt: now,
        },
      });
    }
  }

  const committed = await commitOps(db, ops, apply);
  return {
    scannedUsers: 1,
    createdProfiles,
    updatedProfiles,
    skippedUsers: 0,
    ops: ops.length,
    committed,
  };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Backfill publicProfiles from users collection.");
    process.exit(0);
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);

  let totalScannedUsers = 0;
  let totalCreatedProfiles = 0;
  let totalUpdatedProfiles = 0;
  let totalSkippedUsers = 0;
  let totalOps = 0;

  for (const uid of userIds) {
    const result = await processUser(db, uid, args.apply);
    totalScannedUsers += result.scannedUsers;
    totalCreatedProfiles += result.createdProfiles;
    totalUpdatedProfiles += result.updatedProfiles;
    totalSkippedUsers += result.skippedUsers;
    totalOps += result.ops;

    console.log(
      `[${args.apply ? "apply" : "dry-run"}] uid=${uid} created=${result.createdProfiles} updated=${result.updatedProfiles}`,
    );
  }

  console.log("\nSummary");
  console.log("- Mode:", args.apply ? "apply" : "dry-run");
  console.log("- Project:", args.projectId);
  console.log("- Users scanned:", totalScannedUsers);
  console.log("- Public profiles created:", totalCreatedProfiles);
  console.log("- Public profiles updated:", totalUpdatedProfiles);
  console.log("- Users skipped:", totalSkippedUsers);
  console.log("- Write ops:", totalOps);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
