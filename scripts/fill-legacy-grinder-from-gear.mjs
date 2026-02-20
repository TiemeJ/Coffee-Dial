import {
  commitOps,
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  parseCommonArgs,
  printCommonUsage,
} from "./admin-utils.mjs";

const SCRIPT = "scripts/fill-legacy-grinder-from-gear.mjs";

async function processUser(db, uid, apply) {
  const gearSnap = await db.collection("users").doc(uid).collection("gear").get();
  const brewsSnap = await db.collection("users").doc(uid).collection("coffees").get();

  const grinderNameByGearId = new Map(
    gearSnap.docs
      .map((d) => ({id: d.id, ...d.data()}))
      .filter((item) => (item.type || "").toString().toLowerCase() === "grinder")
      .map((item) => [item.id, (item.name || "").toString().trim()]),
  );

  const ops = [];
  let updatedBrews = 0;

  brewsSnap.docs.forEach((docSnap) => {
    const brew = {id: docSnap.id, ...docSnap.data()};
    const gearIds = Array.isArray(brew.gearIds) ? brew.gearIds : [];
    const firstGrinder = gearIds.map((id) => grinderNameByGearId.get(id)).find((name) => !!name);
    if (!firstGrinder) return;
    if ((brew.grinder || "") === firstGrinder) return;

    updatedBrews += 1;
    ops.push({
      type: "update",
      ref: db.collection("users").doc(uid).collection("coffees").doc(brew.id),
      data: {
        grinder: firstGrinder,
        updatedAt: new Date().toISOString(),
      },
    });
  });

  const committed = await commitOps(db, ops, apply);
  return { updatedBrews, ops: ops.length, committed };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Backfill legacy brew.grinder from linked grinder gear.");
    process.exit(0);
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);

  let totalUsers = 0;
  let totalUpdatedBrews = 0;
  let totalOps = 0;

  for (const uid of userIds) {
    const result = await processUser(db, uid, args.apply);
    totalUsers += 1;
    totalUpdatedBrews += result.updatedBrews;
    totalOps += result.ops;
    console.log(`[${args.apply ? "apply" : "dry-run"}] uid=${uid} updatedBrews=${result.updatedBrews}`);
  }

  console.log("\nSummary");
  console.log("- Mode:", args.apply ? "apply" : "dry-run");
  console.log("- Project:", args.projectId);
  console.log("- Users processed:", totalUsers);
  console.log("- Brews updated:", totalUpdatedBrews);
  console.log("- Write ops:", totalOps);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
