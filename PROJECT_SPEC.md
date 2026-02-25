**Current Architecture (Aligned to Repository)**
Coffee Dial — Project Specification

## Overview

Coffee Dial is a browser-based brew logging app for home coffee enthusiasts. It combines recipe tracking, bean inventory, coffee type metadata, social sharing, and analytics in a modular vanilla JavaScript frontend.

## Mission

Make coffee dialing practical for beginners and deep enough for advanced brewers by turning daily brew sessions into structured, reusable data.

## Core Requirements

- Frontend-first app using ES modules and vanilla JavaScript.
- No npm build step required; app runs directly from static hosting.
- Firebase-backed data/auth/storage for signed-in features.
- Modular feature composition through mount modules and container actions.
- Mobile-friendly PWA shell with installable manifest and service worker.

## Features

- Core Brew Logging
- Create, edit, duplicate, rate, and delete brew entries.
- Store detailed brew parameters (method, dose, ratio, grind, notes, timing, etc.).
- Render brew table and detailed brew card views.

- Pinned Brews & Workflow Support
- Pin favorite brews to a quick-access section.
- Auto-pin and auto-unpin helpers based on open bean bag state.
- Support "best brew" style filtering for active daily recipes.

- Beans & Stock Management
- Manage bean inventory with table + card workflows.
- Track bean bag status and stock-related behavior.
- Link brews to beans for inventory-aware workflows.

- Coffee Types Management
- Maintain reusable coffee type definitions.
- Extract and reuse coffee metadata across brew forms.

- GAS (Gear Acquisition Syndrome) List
- Manage coffee gear inventory with sortable/filterable table and card-edit workflow.
- Track gear basics (name, price, archived state) with quick archive/delete actions.

- Social & Sharing
- Public profile mode and friend-following workflows.
- Share brew-card and media content with others.
- View friend data through social view switching.

- Media & Gallery
- Upload brew and bean photos via Firebase Storage.
- View coffee imagery in gallery and modal flows.

- Stats & Insights
- Aggregate brewing history into charts and summary metrics.
- Support AI profile analysis from statistics data.

- AI-assisted Input
- AI bag scan to extract coffee information from label photos.
- AI profile endpoint for preference/taste analysis.

- Import/Export
- Beanconqueror CSV importer and mapped brew import flow.

- Scales Integration
- Coffee scale feature module with dedicated modal flow.

## Architecture

The repository is structured as:

```txt
/
├─ index.html
├─ manifest.json
├─ sw.js
├─ PROJECT_SPEC.md
├─ readme.md
├─ img/
├─ vendor/
│  ├─ css/
│  ├─ js/
│  ├─ fonts/
│  └─ webfonts/
├─ .github/
│  └─ workflows/
└─ src/
   ├─ app/
   │  ├─ bootstrap.js
   │  ├─ container.js
   │  ├─ container.state.js
   │  ├─ app-commands.js
   │  ├─ app-events.js
   │  ├─ view-bindings.js
   │  ├─ smoke-check.js
   │  ├─ core-contract-check.js
   │  ├─ composition/
   │  │  ├─ app-composition.js
   │  │  └─ action-assemblies.js
   │  ├─ coordinators/
   │  ├─ runtime/
   │  ├─ services/
   │  ├─ stores/
   │  ├─ head.js
   │  └─ pwa.js
   ├─ config/
   │  └─ firebase.js
   ├─ core/
   │  ├─ confirm.js
   │  ├─ format.js
   │  ├─ notify.js
   │  ├─ overlay-host.mount.js
   │  └─ overlay-host.view.html
   ├─ integrations/
   │  └─ email-link-auth.js
   ├─ styles/
   │  └─ app.css
   └─ features/
      ├─ auth/
      ├─ beans/
      ├─ brews/
      ├─ coffees/
      ├─ gas/
      ├─ pin/
      ├─ stats/
      ├─ scales/
      ├─ social/
      ├─ media/
      ├─ graph-modals/
      ├─ import-export/
      │  └─ importers/
      ├─ shell/
      ├─ ui/
      ├─ ai-import.js
      ├─ session-auth-view.js
      ├─ gallery.js
      ├─ gallery.mount.js
      ├─ preferences.js
      ├─ preferences.mount.js
      ├─ preferences.view.html
      ├─ ui-shell.js
      ├─ ui-shell.mount.js
      └─ ui-shell.view.html
```

---

**Module Boundaries**

- `src/app/bootstrap.js`: mounts feature views and initializes app runtime.
- `src/app/container.js` + `src/app/composition/app-composition.js`: composition root for actions, state mutation, and cross-feature orchestration.
- `src/features/*/*.mount.js`: inject HTML view fragments into mount points.
- `src/features/**/*.{js,html}`: feature-local behavior and templates (brews, beans, coffees, social, stats, etc.).
- `src/core/*.js`: shared UX primitives and formatting helpers.
- `src/config/firebase.js`: Firebase app/auth/firestore/storage initialization + AI endpoint constants.
- `src/integrations/*.js`: external auth/integration adapters.

---

**Architecture guardrails**

- Cross-feature interactions must go through typed app commands/events, not direct feature-to-feature callbacks.
- Command ownership is feature-local: `beans.*`, `brews.*`, `coffees.*`, `gas.*`, and `pin.*` commands are registered by their own feature controllers.
- `src/features/*` may depend on `src/core/*`, shared app services, and feature-local modules; importing other feature internals is not allowed.
- `src/app/composition/app-composition.js` is the composition/wiring root only; local runtime behaviors should live in dedicated `src/app/runtime/*` modules.
- Transitional shim helpers (`registerCompatCommand`, `dispatchCompatCommand`, `dispatchWithFallback`) are not allowed in app/feature code.

**Debug toggles and diagnostics**

- View-binding action tracing: `?debugBindings=1` or `localStorage.setItem('coffeeDialDebugBindings', '1')`.
- App-command validation/tracing: `?debugCommands=1` or `localStorage.setItem('coffeeDialDebugCommands', '1')`.
- App-event validation/tracing: `?debugEvents=1` or `localStorage.setItem('coffeeDialDebugEvents', '1')`.
- Smoke preflight checks: `?smoke=1` or `localStorage.setItem('coffeeDialSmoke', '1')`.
- Core contract checks: `?debugContracts=1` or `localStorage.setItem('coffeeDialDebugContracts', '1')`.
- In-browser diagnostics reports: `window.__coffeeDialBindingTrace`, `window.__coffeeDialCommandTrace`, `window.__coffeeDialEventTrace`, `window.__coffeeDialSmokeReport`, `window.__coffeeDialCommandFlowSmokeReport`, `window.__coffeeDialCoreContractsReport`.

---

**Guardrail checks (must pass)**

- `node scripts/check-feature-boundaries.mjs`
- `node scripts/check-command-ownership.mjs`
- `node scripts/check-command-dispatch-coverage.mjs`
- CI workflow `.github/workflows/stage4-guardrails.yml` runs the same checks on push/PR.

---

**Naming Conventions**

- Files use `kebab-case`.
- `*.mount.js` modules mount view HTML into DOM placeholders.
- `*.view.html` stores feature-specific markup templates.
- Feature behavior is split by concern (`*-actions.js`, `*-table.js`, `*-card-*.js`, `*.controller.js`, `*.repo.js`, `*.service.js`).
- Shared utility APIs are colocated in `src/core/`.

---

## UI/UX Guidelines

- Tailwind utility classes are built ahead-of-time into `vendor/css/tailwind.generated.min.css` (no Tailwind runtime CDN script).
- Iconography uses local Font Awesome assets under `vendor/`.
- Dark-mode-first visual style (`<html class="dark">`) with responsive modal/table/card patterns.
- UX patterns prioritize quick actions: inline row menus, modal workflows, double-click card open, and toast/confirm feedback.
- Accessibility baseline includes semantic controls and touch-friendly interactions; continue improving keyboard focus behavior for modal-heavy flows.

### Accessibility coding guidelines

- Every interactive control must have an accessible name.
- Buttons must expose readable text or an explicit `aria-label`.
- Icon-only buttons must include both `aria-label` and `title` (for assistive tech + visual tooltip parity).
- Do not ship empty button text patterns (`x`, `+`, icon only) without a descriptive label such as `Remove filter`, `Close graph modal`, or `Open actions menu`.
- Apply the same naming rules to HTML templates and JS-generated template strings (`innerHTML` builders, row renderers, dropdown builders).
- `select` elements must have an effective label via a visible `<label for="...">` or an `aria-label` when a visible label is not practical (compact controls/modals).
- Keep viewport zoom enabled for low-vision accessibility.
- Do not use `user-scalable=no`.
- Do not cap `maximum-scale` below `5` (prefer omitting the cap).
- Touch targets must be finger-friendly.
- Minimum target size: `44x44px` for tappable controls.
- In Tailwind utility terms, default icon-button size should be `w-11 h-11` (or larger).
- Apply this to card headers, modal close buttons, accordion header controls, quick-filter controls, and table row action buttons.
- For tightly packed controls, preserve clear spacing so adjacent actions are not hard to hit.
- Use semantic interactive elements (`<button>`, `<a>`, `<select>`) for click/tap behavior instead of clickable non-semantic containers.
- Accessibility regressions are release blockers for these Lighthouse/axe rules: buttons without accessible names, select elements without labels, viewport zoom disabled (`user-scalable=no` or restrictive `maximum-scale`), and insufficient touch target size/spacing.

## Deliverables

- Static web app source (current repo state) deployable to GitHub Pages.
- Firebase-enabled runtime for auth, Firestore, and media storage.
- PWA artifacts: `manifest.json` and `sw.js`.
- Documentation: `readme.md` and this updated `PROJECT_SPEC.md`.
- CI/CD automation in `.github/workflows/`:
- `deploy.yml` for Pages deployment.
- `codeql.yml` for static security analysis.

## Developer & Collaboration Notes

- Keep feature modules isolated and wired through app container actions.
- Prefer extending existing feature folders over adding broad global scripts.
- Preserve no-build static-hosting compatibility when introducing changes.
- Treat Firebase config, auth flows, and storage operations as security-sensitive.
- Add regression checks for high-impact flows: auth transitions, brew CRUD, bean stock updates, sharing, and import/export.
- Use sentence case for user-facing headers and labels (European style): capitalize only the first word unless the text contains proper nouns/acronyms.
- Start commit messages with 'Fixes #<issuenumber>.' AI-coding agents, start responses with 'Fixes #<issuenumber>.' when issue number was provided by human operator to accommodate copy pasting of response to commit message.

## Example API Usage (optional)

```js
import { createAppContainer } from './src/app/container.js';
import { initViewBindings } from './src/app/view-bindings.js';

const app = createAppContainer();
initViewBindings(app.actions);

// Example action call once a user is authenticated
app.actions.toggleForm(true);
```
