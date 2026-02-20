import {
  commitOps,
  containsDecaf,
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  nowIso,
  parseCommonArgs,
  printCommonUsage,
} from "./admin-utils.mjs";

const SCRIPT = "scripts/backfill-coffee-type-decaf-from-scan.mjs";

async function processUser(db, uid, apply) {
  const typesSnap = await db.collection("users").doc(uid).collection("coffeeTypes").get();
  const beansSnap = await db.collection("users").doc(uid).collection("beans").get();
  const brewsSnap = await db.collection("users").doc(uid).collection("coffees").get();

  const coffeeTypes = typesSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  const beans = beansSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  const brews = brewsSnap.docs.map((d) => ({id: d.id, ...d.data()}));

  const beanIdsByTypeId = new Map();
  beans.forEach((bean) => {
    if (!bean.coffeeTypeId) return;
    if (!beanIdsByTypeId.has(bean.coffeeTypeId)) beanIdsByTypeId.set(bean.coffeeTypeId, []);
    beanIdsByTypeId.get(bean.coffeeTypeId).push(bean.id);
  });

  const brewsByBeanId = new Map();
  brews.forEach((brew) => {
    if (!brew.beanId) return;
    if (!brewsByBeanId.has(brew.beanId)) brewsByBeanId.set(brew.beanId, []);
    brewsByBeanId.get(brew.beanId).push(brew);
  });

  const ops = [];
  let updatedTypes = 0;
  const now = nowIso();

  coffeeTypes.forEach((type) => {
    if (type.decaf === true) return;

    const typeFields = [
      type.roaster,
      type.farmer,
      type.origin,
      type.variety,
      type.processing,
      type.roast,
      type.roastType,
      type.tasteNotes,
      type.name,
    ];

    const linkedBeanIds = beanIdsByTypeId.get(type.id) || [];
    const linkedBeans = linkedBeanIds
      .map((beanId) => beans.find((bean) => bean.id === beanId))
      .filter(Boolean);

    const beanFields = linkedBeans.flatMap((bean) => [
      bean.roaster,
      bean.farmer,
      bean.origin,
      bean.variety,
      bean.processing,
      bean.roastType,
    ]);

    const brewFields = linkedBeanIds
      .flatMap((beanId) => brewsByBeanId.get(beanId) || [])
      .flatMap((brew) => [
        brew.roaster,
        brew.farmer,
        brew.origin,
        brew.variety,
        brew.processing,
        brew.roastType,
        brew.notes,
        brew.name,
      ]);

    const isDecaf = [...typeFields, ...beanFields, ...brewFields].some(containsDecaf);
    if (!isDecaf) return;

    updatedTypes += 1;
    ops.push({
      type: "update",
      ref: db.collection("users").doc(uid).collection("coffeeTypes").doc(type.id),
      data: { decaf: true, updatedAt: now },
    });
  });

  const committed = await commitOps(db, ops, apply);
  return { updatedTypes, ops: ops.length, committed };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Backfill coffeeTypes.decaf from existing type/bean/brew text.");
    process.exit(0);
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);

  let totalUsers = 0;
  let totalUpdatedTypes = 0;
  let totalOps = 0;

  for (const uid of userIds) {
    const result = await processUser(db, uid, args.apply);
    totalUsers += 1;
    totalUpdatedTypes += result.updatedTypes;
    totalOps += result.ops;
    console.log(`[${args.apply ? "apply" : "dry-run"}] uid=${uid} updatedTypes=${result.updatedTypes}`);
  }

  console.log("\nSummary");
  console.log("- Mode:", args.apply ? "apply" : "dry-run");
  console.log("- Project:", args.projectId);
  console.log("- Users processed:", totalUsers);
  console.log("- Coffee types updated:", totalUpdatedTypes);
  console.log("- Write ops:", totalOps);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
