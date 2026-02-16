Pin transitional fallback scan (post-scan):

Resolved:
- Pin cross-feature navigation now dispatches typed app commands instead of direct callbacks:
  - `src/features/pin/pin.controller.js:41` -> `beans.openCardWithOrder`
  - `src/features/pin/pin.controller.js:126` -> `brews.openCardWithOrder`
  - `src/features/pin/pin.controller.js:226` -> `brews.refreshTable`
- Pin now emits app events for key interactions:
  - `src/features/pin/pin.controller.js:42` -> `pin.beanCardOpened`
  - `src/features/pin/pin.controller.js:132` -> `pin.brewCardOpened`
- Container pin wiring no longer injects direct cross-feature callbacks (`openCoffeeCard`, `openCoffeeCardWithOrder`, `openBeanCardWithOrder`, `renderTable`) into pin coordinator.
- Pin controller now requires explicit command/event interfaces:
  - `src/features/pin/pin.controller.js:21` requires `appCommands.dispatch`
  - `src/features/pin/pin.controller.js:24` requires `appEvents.publish`
- Optional command/event fallback signatures and no-op guards removed from pin controller.

Remaining (transitional fallback patterns):
- None found in pin modules.

Remaining (expected, not transitional fallback):
- Pin view/art modules still use feature-local callback injection for internal rendering/event handling:
  - `src/features/pin/brew-pin-art.js:5`
  - `src/features/pin/brew-pin-art.js:6`
  - `src/features/pin/pin.view.js:87`
- These callbacks are provided by pin controller and do not directly import/call other feature internals.

Notes:
- No direct cross-feature imports found under `src/features/pin/*`.
- Step 8 objective is met for pin: cross-feature interactions are command/event-based and pin no longer relies on direct cross-feature callback injection.
