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

const SCRIPT = "scripts/sync-legacy-beans.mjs";

function beanKey(source) {
  return [
    normalizeText(source.roaster),
    normalizeText(source.farmer),
    normalizeText(source.origin),
    normalizeText(source.processing),
    normalizeText(source.variety),
    normalizeText(source.roastType),
  ].join("|");
}

async function processUser(db, uid, apply) {
  const beansSnap = await db.collection("users").doc(uid).collection("beans").get();
  const brewsSnap = await db.collection("users").doc(uid).collection("coffees").get();

  const beans = beansSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  const brews = brewsSnap.docs.map((d) => ({id: d.id, ...d.data()}));

  const uniqueMap = new Map();

  brews.forEach((brew) => {
    const key = beanKey(brew);
    if (uniqueMap.has(key)) return;

    const existingBean = beans.find((bean) => beanKey(bean) === key);
    const beanData = {};
    if (brew.roaster) beanData.roaster = brew.roaster;
    if (brew.farmer) beanData.farmer = brew.farmer;
    if (brew.origin || brew.beanType) beanData.origin = brew.origin || brew.beanType;
    if (brew.variety) beanData.variety = brew.variety;
    if (brew.processing) beanData.processing = brew.processing;
    if (brew.roastType) beanData.roastType = brew.roastType;

    uniqueMap.set(key, {
      data: beanData,
      id: existingBean ? existingBean.id : null,
      isNew: !existingBean,
    });
  });

  const ops = [];
  const now = nowIso();
  let createdBeans = 0;
  let linkedBrews = 0;

  for (const entry of uniqueMap.values()) {
    if (!entry.isNew || !(entry.data.roaster || entry.data.origin)) continue;
    const ref = db.collection("users").doc(uid).collection("beans").doc();
    entry.id = ref.id;
    createdBeans += 1;
    ops.push({
      type: "set",
      ref,
      data: {
        ...entry.data,
        createdAt: now,
        archived: false,
        archivedDate: null,
        frozen: false,
      },
    });
  }

  brews.forEach((brew) => {
    if (brew.beanId) return;
    const entry = uniqueMap.get(beanKey(brew));
    if (!entry?.id) return;
    linkedBrews += 1;
    ops.push({
      type: "update",
      ref: db.collection("users").doc(uid).collection("coffees").doc(brew.id),
      data: { beanId: entry.id },
    });
  });

  const committed = await commitOps(db, ops, apply);
  return { createdBeans, linkedBrews, ops: ops.length, committed };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Create missing beans from legacy brews and link brew.beanId.");
    process.exit(0);
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);

  let totalUsers = 0;
  let totalCreatedBeans = 0;
  let totalLinkedBrews = 0;
  let totalOps = 0;

  for (const uid of userIds) {
    const result = await processUser(db, uid, args.apply);
    totalUsers += 1;
    totalCreatedBeans += result.createdBeans;
    totalLinkedBrews += result.linkedBrews;
    totalOps += result.ops;
    console.log(`[${args.apply ? "apply" : "dry-run"}] uid=${uid} createdBeans=${result.createdBeans} linkedBrews=${result.linkedBrews}`);
  }

  console.log("\nSummary");
  console.log("- Mode:", args.apply ? "apply" : "dry-run");
  console.log("- Project:", args.projectId);
  console.log("- Users processed:", totalUsers);
  console.log("- Beans created:", totalCreatedBeans);
  console.log("- Brews linked:", totalLinkedBrews);
  console.log("- Write ops:", totalOps);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
