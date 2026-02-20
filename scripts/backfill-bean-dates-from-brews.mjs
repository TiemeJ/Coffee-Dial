import {
  commitOps,
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  nowIso,
  parseCommonArgs,
  parseDateMs,
  printCommonUsage,
} from "./admin-utils.mjs";

const SCRIPT = "scripts/backfill-bean-dates-from-brews.mjs";

async function processUser(db, uid, apply) {
  const beansSnap = await db.collection("users").doc(uid).collection("beans").get();
  const brewsSnap = await db.collection("users").doc(uid).collection("coffees").get();

  const beans = beansSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  const brews = brewsSnap.docs.map((d) => ({id: d.id, ...d.data()}));

  const brewsByBeanId = new Map();
  brews.forEach((brew) => {
    if (!brew.beanId) return;
    const createdMs = parseDateMs(brew.createdAt);
    if (!Number.isFinite(createdMs)) return;
    if (!brewsByBeanId.has(brew.beanId)) brewsByBeanId.set(brew.beanId, []);
    brewsByBeanId.get(brew.beanId).push(createdMs);
  });

  const now = nowIso();
  const ops = [];
  let updatedBeans = 0;

  beans.forEach((bean) => {
    const brewTimes = brewsByBeanId.get(bean.id);
    if (!brewTimes?.length) return;

    const needsOpenedDate = !bean.openedDate;
    const needsArchivedDate = !!bean.archived && !bean.archivedDate;
    if (!needsOpenedDate && !needsArchivedDate) return;

    const sortedTimes = [...brewTimes].sort((a, b) => a - b);
    const payload = { updatedAt: now };
    if (needsOpenedDate) payload.openedDate = new Date(sortedTimes[0]).toISOString();
    if (needsArchivedDate) payload.archivedDate = new Date(sortedTimes[sortedTimes.length - 1]).toISOString();

    updatedBeans += 1;
    ops.push({
      type: "update",
      ref: db.collection("users").doc(uid).collection("beans").doc(bean.id),
      data: payload,
    });
  });

  const committed = await commitOps(db, ops, apply);
  return { updatedBeans, ops: ops.length, committed };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Backfill bean openedDate/archivedDate from linked brews.");
    process.exit(0);
  }

  const db = initDb(args.projectId);
  const userIds = await listTargetUserIds(db, args);

  let totalUsers = 0;
  let totalUpdatedBeans = 0;
  let totalOps = 0;

  for (const uid of userIds) {
    const result = await processUser(db, uid, args.apply);
    totalUsers += 1;
    totalUpdatedBeans += result.updatedBeans;
    totalOps += result.ops;
    console.log(`[${args.apply ? "apply" : "dry-run"}] uid=${uid} updatedBeans=${result.updatedBeans}`);
  }

  console.log("\nSummary");
  console.log("- Mode:", args.apply ? "apply" : "dry-run");
  console.log("- Project:", args.projectId);
  console.log("- Users processed:", totalUsers);
  console.log("- Beans updated:", totalUpdatedBeans);
  console.log("- Write ops:", totalOps);
}

main().catch((error) => {
  console.error("Script failed:", error);
  process.exit(1);
});
