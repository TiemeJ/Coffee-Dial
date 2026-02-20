import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_PROJECT_ID } from "./admin-utils.mjs";

const SCRIPT = "scripts/run-all-migrations.mjs";

function parseArgs(argv) {
  const args = {
    apply: false,
    projectId: DEFAULT_PROJECT_ID,
    uid: "",
    limitUsers: 0,
    bucket: "",
    photoLimit: 0,
    includeRecalculate: false,
    help: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--apply") args.apply = true;
    else if (arg === "--project" && argv[i + 1]) {
      args.projectId = argv[i + 1];
      i += 1;
    } else if (arg === "--uid" && argv[i + 1]) {
      args.uid = argv[i + 1];
      i += 1;
    } else if (arg === "--limit-users" && argv[i + 1]) {
      args.limitUsers = Number(argv[i + 1]) || 0;
      i += 1;
    } else if (arg === "--bucket" && argv[i + 1]) {
      args.bucket = argv[i + 1];
      i += 1;
    } else if (arg === "--photo-limit" && argv[i + 1]) {
      args.photoLimit = Number(argv[i + 1]) || 0;
      i += 1;
    } else if (arg === "--include-recalculate") {
      args.includeRecalculate = true;
    } else if (arg === "--help") {
      args.help = true;
    }
  }

  return args;
}

function printUsage() {
  console.log(
    `\nRun all migration/backfill scripts in a safe recommended order.\n\nUsage:\n  node ${SCRIPT} [--apply] [--project PROJECT_ID] [--uid USER_UID] [--limit-users N] [--bucket BUCKET] [--photo-limit N] [--include-recalculate]\n\nOptions:\n  --apply                Write changes. If omitted, runs in dry-run mode.\n  --project ID           GCP project id (default: ${DEFAULT_PROJECT_ID}).\n  --uid UID              Process only one user UID where supported.\n  --limit-users N        Limit number of users for user-scoped scripts.\n  --bucket NAME          Override bucket for photo path backfill.\n  --photo-limit N        Limit number of photo docs scanned.\n  --include-recalculate  Also run full beansLeft recompute (more aggressive).\n  --help                 Show this help.\n`,
  );
}

function runNodeScript(scriptPath, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptPath} exited with code ${code}`));
    });
  });
}

function buildCommonArgs(args) {
  const out = ["--project", args.projectId];
  if (args.apply) out.push("--apply");
  if (args.uid) out.push("--uid", args.uid);
  if (args.limitUsers > 0) out.push("--limit-users", String(args.limitUsers));
  return out;
}

function buildPhotoArgs(args) {
  const out = ["--project", args.projectId];
  if (args.apply) out.push("--apply");
  if (args.bucket) out.push("--bucket", args.bucket);
  if (args.photoLimit > 0) out.push("--limit", String(args.photoLimit));
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const script = (name) => path.join(__dirname, name);

  const steps = [
    { name: "Backfill photo paths", path: script("backfill-photo-paths.mjs"), args: buildPhotoArgs(args) },
    { name: "Migrate grinder text to gear", path: script("migrate-grinder-to-gear.mjs"), args: buildCommonArgs(args) },
    { name: "Backfill legacy grinder from gear", path: script("fill-legacy-grinder-from-gear.mjs"), args: buildCommonArgs(args) },
    { name: "Sync legacy beans from brews", path: script("sync-legacy-beans.mjs"), args: buildCommonArgs(args) },
    { name: "Extract coffee types from beans", path: script("extract-coffee-types-from-beans.mjs"), args: buildCommonArgs(args) },
    { name: "Backfill coffee type decaf", path: script("backfill-coffee-type-decaf-from-scan.mjs"), args: buildCommonArgs(args) },
    { name: "Backfill bean dates from brews", path: script("backfill-bean-dates-from-brews.mjs"), args: buildCommonArgs(args) },
    { name: "Migrate missing beansLeft", path: script("maybe-migrate-beans-left.mjs"), args: buildCommonArgs(args) },
    { name: "Backfill public profiles", path: script("backfill-public-profiles.mjs"), args: buildCommonArgs(args) },
  ];

  if (args.includeRecalculate) {
    steps.push({
      name: "Recalculate all beansLeft",
      path: script("recalculate-all-beans-left.mjs"),
      args: buildCommonArgs(args),
    });
  }

  console.log(`Mode: ${args.apply ? "apply" : "dry-run"}`);
  console.log(`Project: ${args.projectId}`);
  console.log(`Steps: ${steps.length}`);

  for (let i = 0; i < steps.length; i += 1) {
    const step = steps[i];
    console.log(`\n[${i + 1}/${steps.length}] ${step.name}`);
    await runNodeScript(step.path, step.args);
  }

  console.log("\nAll migration steps completed.");
}

main().catch((error) => {
  console.error("Run-all migrations failed:", error);
  process.exit(1);
});
