# GitHub Actions Workflows

This directory contains the GitHub Actions workflows for the Coffee Dial project.

## deploy.yml

This workflow handles deployment to GitHub Pages. It runs on:
- Push to the main branch
- Manual workflow dispatch

The workflow:
1. Checks out the repository
2. Sets up GitHub Pages configuration
3. Uploads all files as a Pages artifact
4. Deploys to GitHub Pages

This replaces the dynamic Pages workflow that was causing runner acquisition errors.

## stage4-guardrails.yml

This workflow enforces Stage 4 module boundaries on push/PR to `main`.

It runs:
1. `node scripts/check-feature-boundaries.mjs`
2. `node scripts/check-command-ownership.mjs`
3. `node scripts/check-command-dispatch-coverage.mjs`

## deploy-get-photo-signed-url.yml

This workflow deploys the `getPhotoSignedUrl` Cloud Function (Gen2) from:
- `cloud/google-cloud-functions/getPhotoSignedUrl-function-source`

It runs on:
- Pushes to `main` that touch the function folder
- Manual workflow dispatch

The workflow runs lint first, then deploys only if lint passes.

Required GitHub repository secrets:
- `GCP_PROJECT_ID`: Google Cloud project id
- `GCP_WORKLOAD_IDENTITY_PROVIDER`: full Workload Identity Provider resource name
- `GCP_DEPLOYER_SERVICE_ACCOUNT`: deployer service account email

Expected deployer permissions:
- `roles/cloudfunctions.developer`
- `roles/run.admin`
- `roles/artifactregistry.writer`
- `roles/iam.serviceAccountUser` on the function runtime service account

For signed URL generation at runtime, the function runtime service account should also have:
- `roles/iam.serviceAccountTokenCreator`
- Storage read access (for example `roles/storage.objectViewer`)
- Firestore read access (for example `roles/datastore.user`)

## lint-get-photo-signed-url.yml

This workflow runs lint for `getPhotoSignedUrl` function source on:
- Push to `main` for function path changes
- Pull requests targeting `main` for function path changes
- Manual workflow dispatch

## deploy-ai-functions.yml

This workflow deploys both AI functions from one consolidated source folder:
- `cloud/google-cloud-functions/ai-functions-source`

It runs on:
- Pushes to `main` that touch the AI function folder
- Manual workflow dispatch

The workflow:
1. Lints the consolidated package.
2. Deploys `analyzeCoffeeBag` with entry point `analyzeCoffeeBag`.
3. Deploys `analyzeBrewProfile` with entry point `analyzeBrewProfile`.

Secret handling:
- Uses Google Secret Manager binding at deploy time:
  - `--set-secrets=GEMINI_API_KEY=GEMINI_API_KEY:latest`
- No plaintext Gemini API key is stored in repo or GitHub Actions secrets.

Required permissions in GCP:
- Deployer service account:
  - `roles/cloudfunctions.developer`
  - `roles/run.admin`
  - `roles/artifactregistry.writer`
  - `roles/iam.serviceAccountUser` on runtime service account
- Runtime service account:
  - `roles/secretmanager.secretAccessor` on secret `GEMINI_API_KEY`

## lint-ai-functions.yml

This workflow runs lint for the consolidated AI function package:
- `cloud/google-cloud-functions/ai-functions-source`

It runs on:
- Push to `main` for AI function path changes
- Pull requests targeting `main` for AI function path changes
- Manual workflow dispatch

## deploy-notifications-function.yml

This workflow deploys push notification functions from:
- `cloud/google-cloud-functions/notifications-function-source`

It runs on:
- Pushes to `main` that touch the notifications function folder
- Manual workflow dispatch

Manual dispatch input:
- `deploy_mode`: `gcloud` | `firebase` | `both` (default: `gcloud`)

The workflow:
1. Lints the function package.
2. On push: stops after lint (no deploy).
3. On manual dispatch: deploys notification functions with `gcloud functions deploy` and/or `firebase-tools` based on `deploy_mode`.
4. Uses Firestore trigger location `eur3` with `database=(default)` event filter in the gcloud path.
5. Firebase deploy uses config: `.github/firebase.notifications.functions.json` and deploys `functions:notifications` codebase.

Required GitHub repository secrets:
- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER`
- `GCP_DEPLOYER_SERVICE_ACCOUNT`

Expected deployer permissions:
- `roles/cloudfunctions.developer`
- `roles/run.admin`
- `roles/artifactregistry.writer`
- `roles/iam.serviceAccountUser` on the function runtime service account

Runtime service account should include:
- Firestore access (`roles/datastore.user`)
- FCM send access (`roles/firebasecloudmessaging.admin`)

## lint-notifications-function.yml

This workflow runs lint for notifications functions on:
- Push to `main` for notifications function path changes
- Pull requests targeting `main` for notifications function path changes
- Manual workflow dispatch
