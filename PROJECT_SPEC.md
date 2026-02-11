**Starter Architecture (For Your Current App)**
Coffee Dial — Project Specification

## Overview

A simple app for coffee enthousiasts to capture brews, keep stock and log coffees.

## Mission

Coffee nerds can log everything about their coffee brews to make dialing in there coffees to perfection psossible. Entry barrier is low, but extreme depth is possible.

## Core Requirements

- vanilla javascript, no dependencies
- clear file structure

## Features

- List features in bullet points, grouped as needed (Core, Advanced, Optional)
- Describe user flows, inputs, and outputs

## Architecture
The directory structure should be like this:

```txt
/
├─ index.html
├─ sw.js
├─ manifest.json
├─ img/
└─ src/
   ├─ app/
   │  ├─ bootstrap.js
   │  ├─ router.js
   │  ├─ state.js
   │  └─ keyboard-shortcuts.js
   ├─ config/
   │  ├─ firebase.js
   │  └─ constants.js
   ├─ core/
   │  ├─ dom.js
   │  ├─ format.js
   │  ├─ notify.js
   │  ├─ confirm.js
   │  └─ csv.js
   ├─ services/
   │  ├─ auth.service.js
   │  ├─ firestore.service.js
   │  ├─ storage.service.js
   │  └─ ai.service.js
   ├─ features/
   │  ├─ brews/
   │  │  ├─ brew-form.view.js
   │  │  ├─ brew-table.view.js
   │  │  ├─ brew-card.view.js
   │  │  ├─ brew.controller.js
   │  │  └─ brew.repo.js
   │  ├─ beans/
   │  │  ├─ beans-table.view.js
   │  │  ├─ bean-card.view.js
   │  │  ├─ bean.controller.js
   │  │  └─ bean.repo.js
   │  ├─ coffee-types/
   │  │  ├─ coffee-types-table.view.js
   │  │  ├─ coffee-type-card.view.js
   │  │  ├─ coffee-type.controller.js
   │  │  └─ coffee-type.repo.js
   │  ├─ gallery/
   │  ├─ stats/
   │  ├─ social/
   │  ├─ import-export/
   │  │  ├─ importers/
   │  │  │  └─ beanconqueror.js
   │  │  └─ export.controller.js
   │  └─ preferences/
   └─ integrations/
      ├─ scale/
      │  ├─ scale-capture.js
      │  └─ scale-graph.view.js
      └─ email-link-auth.js
```

---

**Module Boundaries**

- `features/*/*.view.js`: render + DOM binding only.
- `features/*/*.controller.js`: user actions, orchestration, no direct raw Firebase calls.
- `features/*/*.repo.js`: Firestore collection-specific CRUD/query logic.
- `services/*.service.js`: shared Firebase wrappers (auth/storage/functions).
- `core/notify.js` + `core/confirm.js`: toasts and app confirmation modal.
- `app/state.js`: single app state object and subscriptions.

---

**Mapping from Existing Code**

- `index.html` brew form/table/card logic -> `features/brews/*`
- `index.html` beans modal + bean card + stock math -> `features/beans/*`
- `index.html` coffee types modal/table/card/edit -> `features/coffee-types/*`
- `index.html` gallery/photo upload/delete -> `features/gallery/*`
- `index.html` stats modal/charts/AI profile -> `features/stats/*`
- `index.html` follow/friends/profile/public toggle -> `features/social/*`
- `index.html` toast/confirm helpers -> `core/notify.js` and `core/confirm.js`
- `scales.js` -> `integrations/scale/*`
- `importers.js` -> `features/import-export/importers/beanconqueror.js`
- `email-auth.js` -> `integrations/email-link-auth.js`
- Firebase init block in `index.html` -> `config/firebase.js`

---

**Naming Conventions**

- Files: `kebab-case`.
- Services: `*.service.js`.
- Repositories: `*.repo.js`.
- UI modules: `*.view.js`.
- Orchestration: `*.controller.js`.
- Methods:
- `render*` for UI
- `load*` for reads
- `save*`/`update*`/`delete*` for writes
- `handle*` for event handlers

---

**Recommended Migration Order**

1. Extract `config/firebase.js`, `core/notify.js`, `core/confirm.js`, `core/format.js`.
2. Extract `coffee-types` feature end-to-end (smallest clear boundary).
3. Extract `beans`.
4. Extract `brews` (largest, includes scale integration).
5. Extract `gallery`, `stats`, `social`, `import-export`.
6. Keep `index.html` as shell + markup only, with one entry script: `src/app/bootstrap.js`.

If you want, I can generate the initial `src/` scaffold files and move one feature (coffee types) first so you have a working migration baseline.


## UI/UX Guidelines

- UI frameworks, layout preferences, accessibility
- Examples: use Material UI, responsive layout, dark mode support

## Deliverables

- What to deliver (code, tests, docs, examples, demo app)
- Distribution (npm, GitHub, installers, etc.)

## Developer & Collaboration Notes

- Testing, code quality, modularity, documentation, security
- “If anything is unclear, request clarification via code comments.”

## Example API Usage (optional)

```js
// Example usage of core API or components