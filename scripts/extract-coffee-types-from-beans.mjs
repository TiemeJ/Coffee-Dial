import {
  commitOps,
  containsDecaf,
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  normalizeText,
  nowIso,
  parseCommonArgs,
  printCommonUsage,
} from "./admin-utils.mjs";

const SCRIPT = "scripts/extract-coffee-types-from-beans.mjs";

function makeKey(obj) {
  return [
    normalizeText(obj.roaster),
    normalizeText(obj.farmer),
    normalizeText(obj.processing),
    normalizeText(obj.origin),
    normalizeText(obj.roast || obj.roastType),
  ].join("|");
}

function withDetectedDecaf(source = {}) {
  const fields = [
    source.roaster,
    source.farmer,
    source.origin,
    source.variety,
    source.processing,
    source.roast,
    source.roastType,
    source.tasteNotes,
    source.notes,
    source.name,
  ];
  return {
    ...source,
    decaf: source.decaf === true || fields.some(containsDecaf),
  };
}

async function processUser(db, uid, apply) {
  const beansSnap = await db.collection("users").doc(uid).collection("beans").get();
  const typesSnap = await db.collection("users").doc(uid).collection("coffeeTypes").get();

  const beans = beansSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  const coffeeTypes = typesSnap.docs.map((d) => ({id: d.id, ...d.data()}));

  const existingByKey = new Map(coffeeTypes.map((ct) => [makeKey(ct), ct]));
  const newByKey = new Map();
  const now = nowIso();

  beans.forEach((bean) => {
    const key = makeKey(bean);
    if (existingByKey.has(key) || newByKey.has(key)) return;
    newByKey.set(key, withDetectedDecaf({
      uid,
      roaster: bean.roaster || "",
      farmer: bean.farmer || "",
      processing: bean.processing || "",
      origin: bean.origin || "",
      rating: 0,
      tasteNotes: bean.tasteNotes || bean.notes || "",
      roast: bean.roastType || "",
      webshopUrl: bean.shopUrl || "",
      imageUrl: bean.imageURL || "",
      variety: bean.variety || "",
      createdAt: now,
      updatedAt: now,
    }));
  });

  const typeIdByKey = new Map();
  existingByKey.forEach((type, key) => {
    if (type?.id) typeIdByKey.set(key, type.id);
  });

  const ops = [];
  let createdTypes = 0;
  let linkedBeans = 0;

  newByKey.forEach((typeData, key) => {
    const ref = db.collection("users").doc(uid).collection("coffeeTypes").doc();
    createdTypes += 1;
    typeIdByKey.set(key, ref.id);
    ops.push({ type: "set", ref, data: typeData });
  });

  beans.forEach((bean) => {
    const typeId = typeIdByKey.get(makeKey(bean));
    if (!typeId || bean.coffeeTypeId === typeId) return;
    linkedBeans += 1;
    ops.push({
      type: "update",
      ref: db.collection("users").doc(uid).collection("beans").doc(bean.id),
      data: {
        coffeeTypeId: typeId,
        updatedAt: now,
      },
    });
  });

  const committed = await commitOps(db, ops, apply);
  return { createdTypes, linkedBeans, ops: ops.length, committed };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Extract coffee types from beans and link beans to coffeeTypeId.");
    process.exit(0);
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);

  let totalUsers = 0;
  let totalCreatedTypes = 0;
  let totalLinkedBeans = 0;
  let totalOps = 0;

  for (const uid of userIds) {
    const result = await processUser(db, uid, args.apply);
    totalUsers += 1;
    totalCreatedTypes += result.createdTypes;
    totalLinkedBeans += result.linkedBeans;
    totalOps += result.ops;
    console.log(`[${args.apply ? "apply" : "dry-run"}] uid=${uid} createdTypes=${result.createdTypes} linkedBeans=${result.linkedBeans}`);
  }

  console.log("\nSummary");
  console.log("- Mode:", args.apply ? "apply" : "dry-run");
  console.log("- Project:", args.projectId);
  console.log("- Users processed:", totalUsers);
  console.log("- Coffee types created:", totalCreatedTypes);
  console.log("- Beans linked:", totalLinkedBeans);
  console.log("- Write ops:", totalOps);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
