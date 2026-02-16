Implemented.

### What I added
- A scripted command-flow smoke harness in `src/app/smoke-check.js` that behaviorally verifies:
  - `brew -> bean card`
  - `bean -> coffee card`
  - `bean -> brew form`
  - `pin -> brew form`
- It runs under the existing smoke trigger (`?smoke=1` or `localStorage.coffeeDialSmoke=1`) and writes:
  - `window.__coffeeDialCommandFlowSmokeReport`
- It is skip-safe for signed-out state / missing data (no false hard-fail for non-applicable flows).

### Wiring updates
- `src/app/bootstrap.js`
  - now passes `appCommands` into `runSmokeChecks(...)` so the harness can validate command-driven flows.
- `readme.md`
  - added `window.__coffeeDialCommandFlowSmokeReport` to the guardrail report list.

### Validation
- Syntax checks passed for touched files.
- Guardrail scripts still pass:
  - `node scripts/check-command-ownership.mjs`
  - `node scripts/check-command-dispatch-coverage.mjs`
  - `node scripts/check-feature-boundaries.mjs`

### Next step
1. Add a tiny Playwright (or Puppeteer) CI smoke spec that runs these same flows in a real browser session (with seeded test data) so behavioral boundary checks are enforced in PRs without manual `?smoke=1` runs.