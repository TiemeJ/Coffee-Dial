# Scripts

## Backfill photo paths

This project includes a one-time backfill script to populate `photoPath` / `thumbPath` in Firestore `photos` docs from legacy `photoURL` / `thumbURL` values.

Script:
- `scripts/backfill-photo-paths.mjs`

### Authenticate locally

Use Application Default Credentials (ADC):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project coffee-dial-app-9db38
gcloud config set project coffee-dial-app-9db38
```

### Run

Dry-run first:

```bash
npm run backfill:photo-paths:dry
```

Apply changes:

```bash
npm run backfill:photo-paths:apply
```

### Optional script flags

You can also run the script directly and pass options:

```bash
node scripts/backfill-photo-paths.mjs --project coffee-dial-app-9db38 --bucket coffee-dial-app-9db38.firebasestorage.app --limit 100
node scripts/backfill-photo-paths.mjs --apply --project coffee-dial-app-9db38
```
