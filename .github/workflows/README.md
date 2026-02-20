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
