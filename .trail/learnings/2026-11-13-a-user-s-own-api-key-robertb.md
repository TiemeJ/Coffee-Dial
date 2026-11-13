---
title: "A user's own API key goes in an owner-only private document, never in the user document"
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 8, tokens: 77088 }
id: l-3873779a
scope: repo
status: active
src: agent
touches:
  - package-lock.json
  - package.json
  - playwright.config.mjs
  - src/app/pwa.js
  - src/features/session-auth-view/session-auth-view.js
  - sw.js
  - src/core/gemini-client.js
  - src/core/ai-settings.js
---

## Decided
The AI features call Gemini straight from the browser with the user's own key, so the app needs no backend. The key is stored in an owner-only private document so it syncs across devices, with a copy in localStorage so it works instantly, offline and before the rule is deployed.

## Tried and ruled out
Storing the key in the user document next to the other preferences: followers can read that document, so the key would leak to them. The remove.bg key still lives there and has the same problem.

## Watch out
The Firestore rules folder is gitignored and deployed by hand, so a new rule does not ship with a commit. Until the rule for the private document is live, saving reports that syncing failed and keeps the key on the device only.
The default model is an alias for the newest Flash model; the old cloud functions used a model Google has shut down.

In the code: src/core/ai-settings.js (users/{uid}/private/ai), src/core/gemini-client.js (DEFAULT_GEMINI_MODEL = gemini-flash-latest), cloud/firebase-config/firebase-firestore.rules (match /private/{docId}).
