import {
  commitOps,
  computeBeansLeft,
  DEFAULT_PROJECT_ID,
  initDb,
  listTargetUserIds,
  nowIso,
  parseCommonArgs,
  printCommonUsage,
} from "./admin-utils.mjs";

const SCRIPT = "scripts/recalculate-all-beans-left.mjs";

async function processUser(db, uid, apply) {
  const beansSnap = await db.collection("users").doc(uid).collection("beans").get();
  const brewsSnap = await db.collection("users").doc(uid).collection("coffees").get();

  const beans = beansSnap.docs.map((d) => ({id: d.id, ...d.data()}));
  const brews = brewsSnap.docs.map((d) => ({id: d.id, ...d.data()}));

  const now = nowIso();
  const ops = [];
  let updatedBeans = 0;

  beans
    .map((bean) => ({ beanId: bean.id, beansLeft: computeBeansLeft(bean, brews) }))
    .filter((entry) => entry.beansLeft !== null && !Number.isNaN(entry.beansLeft))
    .forEach((entry) => {
      updatedBeans += 1;
      ops.push({
        type: "update",
        ref: db.collection("users").doc(uid).collection("beans").doc(entry.beanId),
        data: {
          beansLeft: entry.beansLeft,
          updatedAt: now,
        },
      });
    });

  const committed = await commitOps(db, ops, apply);
  return { updatedBeans, ops: ops.length, committed };
}

async function main() {
  const args = parseCommonArgs(process.argv.slice(2), DEFAULT_PROJECT_ID);
  if (args.help) {
    printCommonUsage(SCRIPT, "Recalculate beansLeft for all beans from current brew data.");
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
