Gas transitional fallback scan (post-scan):

Resolved:
- Gas coordinator now requires explicit command/event interfaces (no optional dispatch/publish fallback guards).
- Optional `?.` fallback calls removed from `showBrewsForGear` in gas coordinator.
- Gas controller now uses strict command registration (no silent no-op/duplicate swallow path).
- Gas coordinator bridge wrappers removed for table/card cross-calls.
- `brews.showForGear` registration moved out of `container.modules.js` into `src/features/brews/brews-filter-commands.js`.

Remaining (expected, not transitional fallback):
- `src/features/gas/gas-card.view.html:13` (`showBrewsForGear()`) feature action callsite.
- `src/features/gas/gas-table.js:309` (`showBrewsForGear('${item.id}')`) feature action callsite.

Notes:
- No remaining gas-side transitional fallback patterns from the previous finding list.
- Gas cross-feature navigation to brews is command-based via `dispatchCommand('brews.showForGear', ...)`.
