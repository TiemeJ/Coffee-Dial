Current direct shim callsites (post-scan):

**`openBeanCard(...)`**
- No direct `openBeanCard(...)` callsites remain.

Progress in this pass:
- Removed `openBeanCard(...)` shim usage from:
  - `src/features/beans/beans-table.js`
  - `src/features/beans/beans-actions.js`
  - `src/features/beans/beans-stock.controller.js`
  - `src/features/beans/beans-card-photo.js`
  - `src/features/beans/beans-card-form.js`
  - `src/features/beans/beans.controller.js`
- Removed corresponding container shim call paths from:
  - `src/app/container.modules.js` (`openSelectedBeanForEdit`, `createBeanFromModal`)
- Removed `openBeanCard` exposure from container/global action surfaces where not needed.
- Tightened `src/features/beans/beans.controller.js` to strict command registration (no compat helper path).

**`openCoffeeCard(...)`**
- No direct `openCoffeeCard(...)` callsites remain under `src/features/*` or `src/app/container.modules.js`.

Progress in this pass:
- Removed `openCoffeeCard(...)` shim-style surfaces from:
  - `src/features/brews/brews-actions.js`
  - `src/features/brews/brews-card-graph.js`
  - `src/features/brews/brews-table.js`
  - `src/features/pin/brew-pin-art.js`
  - `src/features/pin/pin.view.js`
  - `src/features/pin/pin.controller.js` (renamed to `openPinnedBrewCard` flow)
- Replaced table/card entry points with `brews.openCard` command dispatch and `brewsOpenCard` action id.
- Removed related container action exposures and updated smoke check action expectation to `brewsOpenCard`.

Container compat cleanup in this pass:
- Removed container-level transitional `registerCompatCommand(...)` for:
  - `beans.openCard`
  - `beans.openCardWithOrder`
- These commands are now owned only by `src/features/beans/beans.controller.js`.

**`openBrewForm(...)` / bridge**
- Removed `openBrewFormModalBridge` and `dispatchCompatCommand` fallback path from `src/app/container.modules.js`.
- Brews actions now invoke `brews.openForm` through command dispatch (`dispatchBrewOpenForm`), and container wiring uses direct modal callback where available.
- Remaining `brews.openForm` references are command registrations/dispatch usage, not shim bridge paths.

Notes:
- I excluded pass-through property wrappers like `openBeanCard: (...args) => openBeanCard(...args)` from the main list.
- There are currently no remaining direct `openBrewForm(...)` shim bridge invocations.

Strict command ownership scan (beans/brews/coffees/gas/pin):
- Result: each command currently has exactly one registration owner (no duplicates).
- `container.modules.js` no longer registers feature commands via `registerCompatCommand(...)`.
- `pin.autoPinOpenBagsIfEnabled` is now owned by `src/features/pin/pin.controller.js`.
- `beans.archiveIfStockDepleted`, `beans.updateStockForBean`, `beans.showCoffeeTypeCreatedToast`, and `beans.showBeanCreatedToast` are now owned by `src/features/beans/beans.controller.js`.

Latest guardrail run:
- `node scripts/check-command-ownership.mjs` passes.
- `node scripts/check-command-dispatch-coverage.mjs` passes.
- `node scripts/check-feature-boundaries.mjs` passes.
- `dispatchWithFallback(...)` helper usages removed from targeted modules.

Step 11 cutover/cleanup status:
- Remaining legacy-style bean card aliases were removed from composition surfaces (`openBeanCard*` -> `openCard*`).
- Stats cross-feature bean navigation now dispatches `beans.openCard` command instead of direct callback chaining.
- `container.modules.js` remains wiring/composition with command/event boundaries as cross-feature API.
