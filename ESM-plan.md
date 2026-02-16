Good path is an incremental “strangler” refactor around `src/app/container.modules.js` so behavior stays stable.

**Stage 0: Guardrails first**
1. Add lightweight smoke tests around critical flows (auth, change view, add/edit/repeat brew, pinned tiles, card nav).
2. Add a dev-only action tracer in `src/app/view-bindings.js` to log unresolved action names and handler errors.
3. Freeze public contracts for shared helpers (`core/format`, `core/notify`, `core/confirm`).

**Exit criteria:** baseline behavior captured before moving code.

---

**Stage 1: Split orchestration by domain coordinators**
1. Create coordinator modules under `src/app/`:
   - `brews.coordinator.js`
   - `beans.coordinator.js`
   - `coffees.coordinator.js`
   - `gas.coordinator.js`
   - `social.coordinator.js`
2. Move wiring logic from `container.modules.js` into these coordinators, but keep existing feature modules unchanged.
3. Keep one root container that only creates shared state/services and composes coordinators.

**Exit criteria:** `container.modules.js` becomes mostly composition, not feature logic.

---

**Stage 2: Introduce shared app services (explicit dependencies)**
1. Extract side-effect services:
   - `data.service.js` (Firestore CRUD/watch wrappers)
   - `storage.service.js` (image upload/delete)
   - `auth.service.js`
2. Replace raw Firebase usage in feature modules with injected service interfaces.
3. Keep adapters thin so no behavior change.

**Exit criteria:** features no longer import Firebase directly.

---

**Stage 3: Decouple UI actions from global action map**
1. Keep `data-action-*`, but scope actions per mounted feature root (feature-local registries).
2. Add `registerFeatureActions(featureId, actions)` and namespace collisions checks.
3. Gradually move actions from one global map to feature maps.

**Exit criteria:** removing one feature does not affect action resolution of others.

---

**Stage 4: Strengthen feature boundaries**
1. For each feature, define:
   - `mount` (view)
   - `controller` (events/commands)
   - `repo/service` (data)
   - `view-model mapper` (display shaping)
2. Eliminate cross-feature direct calls; use app-level events/commands:
   - `openBeanCard`, `openCoffeeCard`, `openBrewForm` become typed app commands.
3. Keep compatibility shims during migration.

**Exit criteria:** features communicate via commands/events, not direct imports/callback chains.

---

**Stage 5: Replace central mutable state with domain stores**
1. Split current state into stores:
   - `brewsStore`, `beansStore`, `coffeeTypesStore`, `gasStore`, `uiStore`, `sessionStore`.
2. Expose read/select/update APIs; avoid direct object mutation from outside store modules.
3. Move derived selectors (filtered/sorted lists, pinned order) into store/selectors.

**Exit criteria:** no shared mutable “bag” passed everywhere.

---

**Stage 6: Remove legacy container**
1. Keep a thin `createAppContainer()` that only:
   - creates services/stores
   - mounts features
   - wires top-level lifecycle (auth, bootstrap).
2. Delete obsolete wiring paths and compatibility shims.

**Exit criteria:** `container.modules.js` retired or reduced to minimal bootstrap glue.

---

**Suggested execution order**
1. Stage 0 → 1 first (lowest risk, high clarity gain).
2. Then Stage 2 and 3 in parallel by feature.
3. Stage 4 and 5 per feature slice (brews first, then beans/coffees, then gas/social).
4. Stage 6 last.

---

**Practical migration slices (small PRs)**
1. Extract `brews` coordinator only.
2. Move brew Firebase calls behind `data.service`.
3. Namespace brew actions.
4. Introduce `brewsStore`.
5. Repeat for beans/coffees/gas/social.

If you want, I can draft the first concrete PR scope (files to create/change) for Stage 1 focused on brews only.