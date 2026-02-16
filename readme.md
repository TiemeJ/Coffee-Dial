## About Coffee Dial

This app is made by two amateur brewers, Tieme & Robert (mostly Tieme :0 ), who wanted some method to their madness of home coffee experimentation.

Feel free to spread our love for coffee and share the link to this app with friends and follow each other's brews.

## Architecture

- Stage 4 contract: [STAGE4_CONTRACT.md](STAGE4_CONTRACT.md)
- Stage 4 exit verification: [Stage 4 exit verification (post-scan).md](Stage%204%20exit%20verification%20%28post-scan%29.md)

## Dev guardrails

- Enable view-binding action tracing: `?debugBindings=1` or `localStorage.setItem('coffeeDialDebugBindings', '1')`
- Enable app-command validation/tracing: `?debugCommands=1` or `localStorage.setItem('coffeeDialDebugCommands', '1')`
- Enable app-event validation/tracing: `?debugEvents=1` or `localStorage.setItem('coffeeDialDebugEvents', '1')`
- Run smoke preflight checks: `?smoke=1` or `localStorage.setItem('coffeeDialSmoke', '1')`
- Run core contract checks: `?debugContracts=1` or `localStorage.setItem('coffeeDialDebugContracts', '1')`
- Run routine Stage 4 checks locally:
  - `node scripts/check-feature-boundaries.mjs`
  - `node scripts/check-command-ownership.mjs`
  - `node scripts/check-command-dispatch-coverage.mjs`
- Architecture boundary rules:
  - Cross-feature behavior must use `appCommands` / `appEvents` (no direct feature-to-feature callbacks).
  - Each `beans.*|brews.*|coffees.*|gas.*|pin.*` command must have exactly one owning feature controller registration.
  - `src/features/*` cannot import other feature internals.
  - Avoid transitional compat helpers (`registerCompatCommand`, `dispatchCompatCommand`, `dispatchWithFallback`).
- Latest reports are exposed on:
  - `window.__coffeeDialBindingTrace`
  - `window.__coffeeDialCommandTrace`
  - `window.__coffeeDialEventTrace`
  - `window.__coffeeDialSmokeReport`
  - `window.__coffeeDialCommandFlowSmokeReport`
  - `window.__coffeeDialCoreContractsReport`

## Your Brew, Your Way
Coffee Dial is flexible. You can use it to log every single shot you make to track consistency, OR you can just save your favourite recipes (Golden Cups) and update them as you dial in a new bean. It's your laboratory!

1. ### Adding & Editing Brews

Tap the "Add New Brew" bar at the top to open the form. Fill in your details (Roaster, Grind, Ratio, etc.). You can use the SCA Flavor Wheel for notes! To edit, simply tap the  icon on any row.

2. ###  Pinning & Active Brews

Found a recipe you love? Click the Pin icon () to move it to the top "Active Brews" section. This keeps your daily drivers separated from your experiment history.

3. ###  The Coffee Card (Double Tap!)

This is the magic feature. Double tap any row in your table to open the "Coffee Card".
This presents a beautiful, summarized view of the recipe, perfect for quickly replicating a brew without scrolling through the table.

4. ###  Social & Sharing

Want to see what your friends are brewing? Click the "Friends" button.
Enable "Public Profile" to get a Share ID.
Send your ID to a friend so they can follow you.
Enter a friend's ID to follow them.
Use the dropdown menu (top left) to switch views between "My Brews" and your friends' lists.

5. ###  Photo Gallery

Use the camera icon on any brew row to upload a photo (latte art, bean bag, setup). You can share these photos specifically with friends, and view them in the global Photo Gallery via the main menu.

6. ### Statistics & Insights

Open the Statistics menu to visualize your brewing habits. See charts for roast types, methods, and your personal "Hall of Fame" (top-rated beans). You can even view stats for your friends!

7. ### AI Power

Scan Bag: When adding a brew, click "AI Scan Bag" to auto-fill details from a photo of your coffee packaging.
Brew Sommelier: In the Statistics view, click "AI Profile" to get a personalized analysis of your taste preferences.
