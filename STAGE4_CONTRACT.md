# Stage 4 Contract: Feature Boundaries

Status: draft, active for Stage 4 migration.

## 1) Goal
Move from callback/import coupling to command/event-based feature integration, while keeping behavior unchanged during migration.

## 2) Standard feature surface
Each feature exposes four layers:

- `mount`
  - Loads/mounts feature views and root nodes.
  - No business logic.
- `controller`
  - Handles UI actions and app commands.
  - May publish app events.
  - Owns feature-local state transitions.
- `repo` (or `service adapter`)
  - Data access only (Firestore/storage/auth wrappers through app services).
  - No DOM logic.
- `view-model` (`*.vm.js`)
  - Maps entities to display/view shapes.
  - Pure formatting/mapping logic.

## 3) Allowed dependencies
Feature code (`src/features/<feature>/**`) may depend on:

- `src/core/**`
- `src/app/services/**` (or equivalent shared service interfaces)
- files inside its own feature folder

Feature code must not depend on:

- other feature internals (`src/features/<other-feature>/**`)
- container-local implementation details

Cross-feature interaction must use app commands/events.

## 4) Command contract
Commands are imperative requests handled by exactly one owner feature.

- Naming: `<feature>.<verbNoun>`
  - Examples: `beans.openCard`, `brews.openForm`, `coffees.openCard`
- Transport:
  - `dispatch(commandName, payload, meta?)`
- Owner:
  - exactly one registered handler per command
- Return:
  - handler may return value/promise to caller

Command payload schema format (runtime-validated in debug mode):

```js
{
  "beans.openCard": {
    beanId: "string",        // required
    mode: "view|edit",       // optional
    source: "string?"        // optional
  }
}
```

Validation rules:

- unknown command -> error in debug, warn in prod
- missing required fields -> error in debug, no-op + warn in prod
- unexpected payload type -> error in debug, no-op + warn in prod

## 5) Event contract
Events are facts that already happened; multiple listeners allowed.

- Naming: `<feature>.<nounPastTense>` or `<feature>.<nounChanged>`
  - Examples: `beans.cardOpened`, `brews.formOpened`, `brews.saved`, `pin.orderChanged`
- Transport:
  - `publish(eventName, payload, meta?)`
  - `subscribe(eventName, handler)`
- Ownership:
  - event publisher is the feature that owns the state change
- Return:
  - no return contract (fire-and-notify)

Event payload schema format (runtime-validated in debug mode):

```js
{
  "brews.saved": {
    brewId: "string",
    beanId: "string?",
    timestamp: "string" // ISO
  }
}
```

## 6) Required migration shims
During migration, legacy entry points stay available but delegate to commands.

- `openBeanCard(...)` -> `dispatch('beans.openCard', payload)`
- `openCoffeeCard(...)` -> `dispatch('brews.openCard', payload)` or `dispatch('coffees.openCard', payload)`
- `openBrewForm(...)` -> `dispatch('brews.openForm', payload)`

Shim rules:

- include `@deprecated Stage 4 shim` comment
- do not add new callsites to shim APIs
- remove shims once zero internal callers remain

## 7) Debug/runtime rules
- Debug mode must validate command/event payloads against schema.
- Debug mode must trace:
  - command dispatch + handler resolution
  - event publish + subscriber count
- Name collisions:
  - command names are globally unique
  - event names are globally unique

## 7.1) Boundary enforcement check
- Run `node scripts/check-feature-boundaries.mjs`
- Enforced failure condition:
  - any `src/features/<feature>/**` file importing another feature internals
- Tracking output (non-failing):
  - potential shim callsites (`openBeanCard/openCoffeeCard/openBrewForm`) to migrate progressively

## 8) Stage 4 done criteria
Stage 4 is complete when all are true:

- cross-feature communication is command/event based
- no feature imports another feature internals
- no direct callback chain from feature A into feature B
- compatibility shims removed (or no-op wrappers with zero callers)
- `container.modules.js` is composition/wiring, not feature behavior
