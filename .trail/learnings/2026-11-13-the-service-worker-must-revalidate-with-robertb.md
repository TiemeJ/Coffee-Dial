---
title: The service worker must revalidate with the server or new code never arrives
author: RobertB
date: 2026-11-13
branch: main
cost: { minutes: 24, tokens: 97105 }
id: l-4e127270
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
The service worker serves static files cache-first and refreshes them in the background. Both the background refresh and the first fetch on a cache miss now ask the server whether the file changed.

## Tried and ruled out
A plain fetch for the refresh: it is answered by the browser's HTTP cache, so the old file was written back into the service worker cache. Bumping the service worker version alone did not help, because the new cache was filled from that same HTTP cache.

## Watch out
On GitHub Pages the effect was limited to about ten minutes; on the local Python server, which sends no cache headers, stale JavaScript survived many reloads. When local changes do not show up, unregister the service worker and delete its cache before concluding the code is wrong.

In the code: serveWithStaticCache in sw.js uses fetch(request, { cache: 'no-cache' }); SW_VERSION must match in sw.js and src/app/pwa.js.
