---
title: Never skip the first snapshot of the live Firestore listeners after the fast startup load
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 8, tokens: 174930 }
id: l-481b2487
scope: repo
status: active
src: agent
touches:
  - src/features/session-auth-view/session-auth-view.js
---

## Decided
The startup load stays staged: pinned brews from the local cache, then the latest 120 brews with active bags and referenced coffees, then live listeners on the full collections. The first snapshot of every live listener is always applied.

## Tried and ruled out
Skipping the first listener snapshot to save a render (added 2026-03-06 together with the persistent IndexedDB cache). With a persistent cache the first snapshot comes from IndexedDB; when that cache is already complete the server sends no second snapshot, so the app stayed on the partial startup data all session: at most 120 brews, only active bags, only referenced coffees, and wrong bag stock because stock is computed from the loaded brews.

## Watch out
The bug only shows on a device whose cache is already complete, so a fresh browser or the seeded E2E run looks fine. It was not reproduced against live data; the cause follows from Firestore snapshot semantics.

In the code: attachLiveViewListeners and loadCompleteViewData in src/features/session-auth-view/session-auth-view.js; INITIAL_BREWS_LIMIT = 120.
