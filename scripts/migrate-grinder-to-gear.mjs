import {
  commitOps,
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  normalizeText,
  nowIso,
  parseCommonArgs,
  printCommonUsage,
} from "./admin-utils.mjs";

const SCRIPT = "scripts/migrate-grinder-to-gear.mjs";

async function processUser(db, uid, apply) {
  const gearSnap = await db.collection("users").doc(uid).collection("gear").get();
  const brewsSnap = await db.collection("users").doc(uid).collection("coffees").get();

  const gearItems = gearSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  const brews = brewsSnap.docs.map((d) => ({id: d.id, ...d.data()}));

  const grinderIdByName = new Map();
  const discoveredByNorm = new Map();

  gearItems.forEach((item) => {
    if ((item.type || "").toString().toLowerCase() !== "grinder") return;
    const norm = normalizeText(item.name);
    if (!norm || grinderIdByName.has(norm)) return;
    grinderIdByName.set(norm, item.id);
  });

  brews.forEach((brew) => {
    const norm = normalizeText(brew.grinder);
    if (!norm || discoveredByNorm.has(norm)) return;
    discoveredByNorm.set(norm, (brew.grinder || "").toString().trim().replace(/\s+/g, " "));
  });

  const ops = [];
  const now = nowIso();
  let createdGear = 0;
  let updatedBrews = 0;

  [...discoveredByNorm.keys()]
    .filter((norm) => !grinderIdByName.has(norm))
    .forEach((norm) => {
      const name = discoveredByNorm.get(norm);
      if (!name) return;
      const ref = db.collection("users").doc(uid).collection("gear").doc();
      grinderIdByName.set(norm, ref.id);
      createdGear += 1;
      ops.push({
        type: "set",
        ref,
        data: {
          uid,
          name,
          price: null,
          type: "Grinder",
          methods: [],
          imageUrl: "",
          purchasedDate: now,
          archived: false,
          createdAt: now,
          updatedAt: now,
        },
      });
    });

  brews.forEach((brew) => {
    const norm = normalizeText(brew.grinder);
    const grinderGearId = norm ? grinderIdByName.get(norm) : null;
    if (!grinderGearId) return;

    const currentGearIds = Array.isArray(brew.gearIds) ? brew.gearIds.filter(Boolean) : [];
    if (currentGearIds.includes(grinderGearId)) return;

    updatedBrews += 1;
    const nextGearIds = [...new Set([...currentGearIds, grinderGearId])];
    ops.push({
      type: "update",
      ref: db.collection("users").doc(uid).collection("coffees").doc(brew.id),
      data: {
        gearIds: nextGearIds,
        updatedAt: nowIso(),
      },
    });
  });

  const committed = await commitOps(db, ops, apply);
  return { createdGear, updatedBrews, ops: ops.length, committed };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Backfill grinder text into gear records and brew gearIds.");
    process.exit(0);
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);

  let totalUsers = 0;
  let totalCreatedGear = 0;
  let totalUpdatedBrews = 0;
  let totalOps = 0;

  for (const uid of userIds) {
    const result = await processUser(db, uid, args.apply);
    totalUsers += 1;
    totalCreatedGear += result.createdGear;
    totalUpdatedBrews += result.updatedBrews;
    totalOps += result.ops;
    console.log(`[${args.apply ? "apply" : "dry-run"}] uid=${uid} createdGear=${result.createdGear} updatedBrews=${result.updatedBrews}`);
  }

  console.log("\nSummary");
  console.log("- Mode:", args.apply ? "apply" : "dry-run");
  console.log("- Project:", args.projectId);
  console.log("- Users processed:", totalUsers);
  console.log("- Gear created:", totalCreatedGear);
  console.log("- Brews updated:", totalUpdatedBrews);
  console.log("- Write ops:", totalOps);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
