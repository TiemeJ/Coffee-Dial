import admin from "firebase-admin";

export const DEFAULT_PROJECT_ID = "coffee-dial-app-9db38";
const WRITE_BATCH_LIMIT = 400;

export function parseCommonArgs(argv, projectDefault = DEFAULT_PROJECT_ID) {
  const args = {
    apply: false,
    projectId: projectDefault,
    uid: "",
    limitUsers: 0,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--project" && argv[i + 1]) {
      args.projectId = argv[i + 1];
      i += 1;
    } else if (arg === "--uid" && argv[i + 1]) {
      args.uid = argv[i + 1];
      i += 1;
    } else if (arg === "--limit-users" && argv[i + 1]) {
      args.limitUsers = Number(argv[i + 1]) || 0;
      i += 1;
    } else if (arg === "--help") {
      args.help = true;
    }
  }

  return args;
}

export function printCommonUsage(scriptName, summary) {
  console.log(`\n${summary}\n\nUsage:\n  node ${scriptName} [--apply] [--project PROJECT_ID] [--uid USER_UID] [--limit-users N]\n\nOptions:\n  --apply           Write updates. If omitted, runs in dry-run mode.\n  --project ID      GCP project id (default: ${DEFAULT_PROJECT_ID}).\n  --uid UID         Process only one user UID.\n  --limit-users N   Stop after processing N users (default: all).\n  --help            Show this help.\n`);
}

export function normalizeText(value) {
  return (value || "")
    .toString()
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function nowIso() {
  return new Date().toISOString();
}

export function initDb(projectId) {
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  return admin.firestore();
}

export async function listTargetUserIds(db, args) {
  if (args.uid) return [args.uid];

  const result = [];
  let cursor = null;

  while (true) {
    let q = db.collection("users")
      .orderBy(admin.firestore.FieldPath.documentId())
      .limit(500);

    if (cursor) q = q.startAfter(cursor);

    const snap = await q.get();
    if (snap.empty) break;

    for (const docSnap of snap.docs) {
      result.push(docSnap.id);
      if (args.limitUsers > 0 && result.length >= args.limitUsers) return result;
    }

    cursor = snap.docs[snap.docs.length - 1];
  }

  return result;
}

export async function commitOps(db, ops, apply) {
  if (!ops.length) return 0;
  if (!apply) return ops.length;

  let committed = 0;
  for (let i = 0; i < ops.length; i += WRITE_BATCH_LIMIT) {
    const chunk = ops.slice(i, i + WRITE_BATCH_LIMIT);
    const batch = db.batch();
    chunk.forEach((op) => {
      if (op.type === "set") batch.set(op.ref, op.data);
      else if (op.type === "update") batch.update(op.ref, op.data);
    });
    await batch.commit();
    committed += chunk.length;
  }
  return committed;
}

export function parseDateMs(value) {
  if (!value) return Number.NaN;
  const dateObj = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
  return dateObj instanceof Date ? dateObj.getTime() : Number.NaN;
}

export function containsDecaf(value) {
  return (value || "").toString().toLowerCase().includes("decaf");
}

export function computeBeansLeft(bean, brews = []) {
  if (!bean || bean.stock === undefined || bean.stock === null || bean.stock === "") return null;
  const baseWeight = parseFloat(bean.stock);
  if (Number.isNaN(baseWeight)) return null;

  const totalIn = brews
    .filter((c) => c.beanId === bean.id)
    .reduce((sum, c) => {
      const weight = parseFloat(c.weight);
      return sum + (Number.isNaN(weight) ? 0 : weight);
    }, 0);

  return baseWeight - totalIn;
}
