**Stage 4 Plan: Strengthen Feature Boundaries**

1. Define the target contract and migration rules.
- Create a short `Stage 4 contract` doc in repo.
- Define standard feature surface: `mount`, `controller`, `repo/service`, `view-model`.
- Define allowed dependencies: feature code can depend on `core/*` and feature-local files, not other feature internals.
- Define command/event naming convention and payload schemas.

2. Add an app command/event hub.
- Introduce `app-commands.js` with typed command registry and dispatch.
- Introduce `app-events.js` with typed publish/subscribe.
- Add runtime payload validation in debug mode.
- Add tracing logs for command dispatch and event emission.

3. Add compatibility shims before refactor.
- Keep existing action/callback entry points.
- Map old direct calls to commands:
  - `openBeanCard(...)` -> `dispatch('beans.openCard', payload)`
  - `openCoffeeCard(...)` -> `dispatch('brews.openCard', payload)` or `coffees.openCard` based on context
  - `openBrewForm(...)` -> `dispatch('brews.openForm', payload)`
- Mark shim methods with deprecation comments.

4. Refactor one feature end-to-end as reference implementation.
- Start with `beans` (smallest high-value cross-links).
- Extract and enforce:
  - `beans.mount.js`
  - `beans.controller.js`
  - `beans.repo.js` (or service adapter)
  - `beans.vm.js`
- Replace outgoing direct calls with commands/events only.
- Replace incoming direct callbacks with command handlers registered at app level.

5. Refactor `coffees` using the same pattern.
- Move all display shaping to `coffees.vm.js`.
- Keep data access in `coffees.repo.js`.
- Replace cross-feature calls (`showBrewsForCoffeeType`, etc.) with commands/events.
- Keep temporary shim methods for legacy callers.

6. Refactor `gas` similarly.
- Isolate table/card behavior in `gas.controller.js`.
- Convert navigation/cross-feature actions to typed commands.
- Remove direct references to brew/bean internals.

7. Refactor `brews` (largest slice) in controlled sub-steps.
- Split into subcontrollers: table/card/form/modal command handlers.
- Move data writes/reads into `brews.repo.js` facade.
- Move UI shaping/formatting to `brews.vm.js`.
- Replace all cross-feature open/show methods with command dispatch.

8. Refactor `pin` after brews stabilization.
- Treat pin as consumer of brew/bean/coffee commands/events.
- Remove direct invocation chains into brews/coffees/beans.
- Keep pin rendering logic local and driven by events/state.

9. Remove cross-feature direct imports/callback chains.
- For each feature, ban imports from other feature folders.
- Enforce via lint rule or script check.
- Remove shim usages progressively; keep temporary fallback only where migration is incomplete.

10. Harden boundaries with checks and tests.
- Add static check: no `src/features/*` importing another feature internals.
- Add runtime check in debug: feature-local controllers only register their own command handlers.
- Add integration tests for command flows:
  - open bean card from brew context
  - open coffee card from bean context
  - open brew form from bean/coffee/pin contexts

11. Cut over and cleanup.
- Remove deprecated shims once no callsites remain.
- Simplify `container.modules.js` to composition/wiring only.
- Keep command/event schemas as the only cross-feature API.

12. Exit criteria verification checklist.
- Every cross-feature interaction is command/event based.
- No feature directly imports another feature’s controller/view/repo internals.
- No direct callback chain from feature A into feature B logic.
- Compatibility shims removed or reduced to thin no-op aliases with zero internal usage.
- `container.modules.js` only composes features and shared services.