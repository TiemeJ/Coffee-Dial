# Scripts

## Authentication (all scripts)

Use Application Default Credentials (ADC):

```bash
gcloud auth application-default login
gcloud auth application-default set-quota-project coffee-dial-app-9db38
gcloud config set project coffee-dial-app-9db38
```

## Shared conventions

- All migration/backfill scripts run in `dry-run` mode by default.
- Add `--apply` to write changes.
- Optional common flags:
  - `--project coffee-dial-app-9db38`
  - `--uid <USER_UID>`
  - `--limit-users <N>`

## 1) Backfill photo paths

Populates `photoPath` / `thumbPath` in `users/{uid}/photos` from legacy `photoURL` / `thumbURL`.

- Script: `scripts/backfill-photo-paths.mjs`
- Dry run: `npm run backfill:photo-paths:dry`
- Apply: `npm run backfill:photo-paths:apply`

## 2) Migrate grinder text to gear links

Creates missing grinder gear items and links brews via `gearIds`.

- Script: `scripts/migrate-grinder-to-gear.mjs`
- Dry run: `npm run migrate:grinder-to-gear:dry`
- Apply: `npm run migrate:grinder-to-gear:apply`

## 3) Backfill legacy `brew.grinder` from gear

Writes legacy grinder name field from linked grinder gear for compatibility.

- Script: `scripts/fill-legacy-grinder-from-gear.mjs`
- Dry run: `npm run backfill:legacy-grinder-from-gear:dry`
- Apply: `npm run backfill:legacy-grinder-from-gear:apply`

## 4) Sync legacy beans from brews

Creates missing bean docs from brew attributes and links brews with `beanId`.

- Script: `scripts/sync-legacy-beans.mjs`
- Dry run: `npm run backfill:sync-legacy-beans:dry`
- Apply: `npm run backfill:sync-legacy-beans:apply`

## 5) Backfill bean dates from brews

Backfills `openedDate` and `archivedDate` for beans from brew timestamps.

- Script: `scripts/backfill-bean-dates-from-brews.mjs`
- Dry run: `npm run backfill:bean-dates-from-brews:dry`
- Apply: `npm run backfill:bean-dates-from-brews:apply`

## 6) Backfill coffee type decaf flag

Sets `coffeeTypes.decaf = true` when decaf is detected in linked data.

- Script: `scripts/backfill-coffee-type-decaf-from-scan.mjs`
- Dry run: `npm run backfill:coffee-type-decaf:dry`
- Apply: `npm run backfill:coffee-type-decaf:apply`

## 7) Extract coffee types from beans

Creates missing `coffeeTypes` from beans and links beans with `coffeeTypeId`.

- Script: `scripts/extract-coffee-types-from-beans.mjs`
- Dry run: `npm run backfill:extract-coffee-types:dry`
- Apply: `npm run backfill:extract-coffee-types:apply`

## 8) Migrate missing beansLeft

One-time backfill for beans with `stock` set but missing `beansLeft`.

- Script: `scripts/maybe-migrate-beans-left.mjs`
- Dry run: `npm run backfill:beans-left-missing:dry`
- Apply: `npm run backfill:beans-left-missing:apply`

## 9) Recalculate all beansLeft

Recomputes `beansLeft` for all beans from current brew usage.

- Script: `scripts/recalculate-all-beans-left.mjs`
- Dry run: `npm run backfill:beans-left-recalculate:dry`
- Apply: `npm run backfill:beans-left-recalculate:apply`

## 10) Backfill public profiles from users

Creates/updates `publicProfiles/{uid}` from `users/{uid}` fields:
- `displayName`
- `isPublic`

- Script: `scripts/backfill-public-profiles.mjs`
- Dry run: `npm run backfill:public-profiles:dry`
- Apply: `npm run backfill:public-profiles:apply`

## Run all migrations in order

Runs all migration/backfill scripts sequentially in a recommended safe order.
- Defaults to dry-run.
- Full `beansLeft` recalculation is excluded by default; add `--include-recalculate` when needed.

- Script: `scripts/run-all-migrations.mjs`
- Dry run: `npm run migrations:all:dry`
- Apply: `npm run migrations:all:apply`

Examples:
- `npm run migrations:all:dry -- --uid <USER_UID>`
- `npm run migrations:all:apply -- --limit-users 100`
- `npm run migrations:all:dry -- --include-recalculate`

## Direct script usage examples

```bash
node scripts/sync-legacy-beans.mjs --project coffee-dial-app-9db38 --uid <USER_UID>
node scripts/recalculate-all-beans-left.mjs --apply --project coffee-dial-app-9db38 --limit-users 100
```
