# Deploy `getPhotoSignedUrl` from This Repo

## Option A: GitHub Actions (recommended)

Workflow file:
- `.github/workflows/deploy-get-photo-signed-url.yml`

### 1) Create Google Cloud deployer service account

Example:

```bash
gcloud iam service-accounts create github-function-deployer \
  --project=YOUR_PROJECT_ID \
  --display-name="GitHub Function Deployer"
```

Grant deploy permissions:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-function-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/cloudfunctions.developer"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-function-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.admin"

gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:github-function-deployer@YOUR_PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/artifactregistry.writer"
```

Also grant `roles/iam.serviceAccountUser` on the runtime service account used by the function.

### 2) Configure Workload Identity Federation

Create:
- Workload Identity Pool
- Workload Identity Provider for GitHub OIDC

Bind provider principal to deployer service account with:
- `roles/iam.workloadIdentityUser`

### 3) Add GitHub repository secrets

- `GCP_PROJECT_ID`
- `GCP_WORKLOAD_IDENTITY_PROVIDER` (full provider resource path)
- `GCP_DEPLOYER_SERVICE_ACCOUNT` (email)

### 4) Deploy

- Push changes to `main` under:
  - `cloud/google-cloud-functions/getPhotoSignedUrl-function-source/`
- Or run workflow manually via Actions tab.


## Option B: Cloud Build Trigger

Cloud Build config file:
- `cloud/google-cloud-functions/getPhotoSignedUrl-function-source/cloudbuild.yaml`

Create a trigger pointing to this config file.

Trigger can run on push to `main` with path filter:
- `cloud/google-cloud-functions/getPhotoSignedUrl-function-source/**`


## Runtime service account permissions (for signed URLs)

The function runtime service account needs:
- `roles/iam.serviceAccountTokenCreator`
- Storage read access, for example `roles/storage.objectViewer`
- Firestore read access, for example `roles/datastore.user`
