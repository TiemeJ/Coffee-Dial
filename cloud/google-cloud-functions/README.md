# Google Cloud Functions (Auto-Deployed)

This folder contains Cloud Function source code that is deployed automatically from GitHub Actions.

Workflows:
- `deploy-get-photo-signed-url.yml`
- `deploy-ai-functions.yml`
- `deploy-notifications-function.yml`
- `lint-get-photo-signed-url.yml`
- `lint-ai-functions.yml`
- `lint-notifications-function.yml`

For workflow details and required IAM roles, see:
- `.github/workflows/README.md`

## Deployment Model

- Deploys are triggered by pushes to `main` (path-based) or manual workflow dispatch.
- Functions are deployed with `gcloud functions deploy --gen2` from this repository.
- Runtime secrets are not stored in source code.

### Secret strategy

- GitHub repository secrets are used for deployment authentication/config:
  - `GCP_PROJECT_ID`
  - `GCP_WORKLOAD_IDENTITY_PROVIDER`
  - `GCP_DEPLOYER_SERVICE_ACCOUNT`
- App secret (`GEMINI_API_KEY`) is stored in **Google Secret Manager** and injected at deploy time via `--set-secrets`.

## Install gcloud CLI

### macOS (Homebrew)
```bash
brew install --cask google-cloud-sdk
```

### Linux (apt)
```bash
sudo apt-get update && sudo apt-get install -y apt-transport-https ca-certificates gnupg curl
curl -fsSL https://packages.cloud.google.com/apt/doc/apt-key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/cloud.google.gpg
echo "deb [signed-by=/usr/share/keyrings/cloud.google.gpg] https://packages.cloud.google.com/apt cloud-sdk main" | sudo tee /etc/apt/sources.list.d/google-cloud-sdk.list
sudo apt-get update && sudo apt-get install -y google-cloud-cli
```

### Windows
Install Google Cloud CLI from:
- https://cloud.google.com/sdk/docs/install

### Initialize/authenticate
```bash
gcloud init
gcloud auth login
gcloud config set project coffee-dial-app-9db38
```

## Values to put in GitHub Secrets

These commands print the values used by your workflows.

### 1) `GCP_PROJECT_ID`
```bash
gcloud config get-value project
```

### 2) `GCP_DEPLOYER_SERVICE_ACCOUNT`
Use your deployer SA email (example):
```bash
echo github-function-deployer@coffee-dial-app-9db38.iam.gserviceaccount.com
```

### 3) `GCP_WORKLOAD_IDENTITY_PROVIDER`
If you already created WIF, list providers and copy the full `name` value:
```bash
gcloud iam workload-identity-pools providers list \
  --project="coffee-dial-app-9db38" \
  --location="global" \
  --workload-identity-pool="github-pool" \
  --format="table(name,displayName,state)"
```

Expected format to paste in GitHub:
```text
projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID
```

### Optional: set GitHub secrets from CLI
If you use GitHub CLI (`gh`):
```bash
gh secret set GCP_PROJECT_ID --body "coffee-dial-app-9db38"
gh secret set GCP_DEPLOYER_SERVICE_ACCOUNT --body "github-function-deployer@coffee-dial-app-9db38.iam.gserviceaccount.com"
gh secret set GCP_WORKLOAD_IDENTITY_PROVIDER --body "projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/POOL_ID/providers/PROVIDER_ID"
```

## Check function status / URLs / config

List functions:
```bash
gcloud functions list --gen2 --regions=us-central1 --project=coffee-dial-app-9db38
```

Describe a function:
```bash
gcloud functions describe getPhotoSignedUrl \
  --gen2 --region=us-central1 --project=coffee-dial-app-9db38
```

Get service URL only:
```bash
gcloud functions describe getPhotoSignedUrl \
  --gen2 --region=us-central1 --project=coffee-dial-app-9db38 \
  --format='value(serviceConfig.uri)'
```

## Read logs

Latest logs for one function:
```bash
gcloud functions logs read getPhotoSignedUrl \
  --gen2 --region=us-central1 --project=coffee-dial-app-9db38 --limit=100
```

AI function logs:
```bash
gcloud functions logs read analyzeCoffeeBag \
  --gen2 --region=us-central1 --project=coffee-dial-app-9db38 --limit=100

gcloud functions logs read analyzeBrewProfile \
  --gen2 --region=us-central1 --project=coffee-dial-app-9db38 --limit=100
```

## Secret Manager checks (for GEMINI)

Check secret exists:
```bash
gcloud secrets describe GEMINI_API_KEY --project=coffee-dial-app-9db38
```

List versions:
```bash
gcloud secrets versions list GEMINI_API_KEY --project=coffee-dial-app-9db38
```

Check runtime SA can access the secret:
```bash
gcloud secrets get-iam-policy GEMINI_API_KEY \
  --project=coffee-dial-app-9db38 \
  --format='table(bindings.role,bindings.members)'
```

## Manual deploy fallback (if needed)

If GitHub Actions is unavailable, you can still deploy manually with the same source folders/workflow settings. Use the workflow files as source of truth for flags:
- `.github/workflows/deploy-get-photo-signed-url.yml`
- `.github/workflows/deploy-ai-functions.yml`
