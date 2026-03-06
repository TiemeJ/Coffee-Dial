const T0_FULL = performance.now();
const logTimeF = (label) => console.log(`[PERF-FULL] ${label}: ${(performance.now() - T0_FULL).toFixed(0)}ms`);
logTimeF('full-bootstrap.js loading');

import { auth } from '../config/firebase.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { createAppContainer } from './container.js';
import { registerServiceWorker } from './pwa.js';
import { initViewBindings } from './view-bindings.js';
import { createAppCommands } from './app-commands.js';
import { createAppEvents } from './app-events.js';
import { runSmokeChecks, shouldRunSmokeChecks } from './smoke-check.js';
import { runCoreContractChecks, shouldRunCoreContractChecks } from './core-contract-check.js';
import { mountShellHeader } from '../features/shell/shell.controller.js';
import { mountSignedOutAuth } from '../features/auth/auth.controller.js';
import { mountPinnedSection } from '../features/pin/pin.mount.js';
import { mountBrewsPinArtView, mountBrewsTableView } from '../features/brews/brews.mount.js';
import { mountBeansTableView } from '../features/beans/beans.mount.js';
import { mountCoffeeTypesTableView } from '../features/coffees/coffee-types.mount.js';
import { mountGasTableView } from '../features/gas/gas.mount.js';
import { mountUiShellView } from '../features/ui-shell/ui-shell.mount.js';
import { mountOverlayHostView } from '../core/overlay-host.mount.js';

const loadE2ESeedData = async () => {
    if (typeof window === 'undefined') return null;
    const search = new URLSearchParams(window.location.search);
    if (search.get('e2eSeed') !== '1') return null;
    const seedPath = search.get('e2eSeedPath') || '/tests/fixtures/smoke-seed.json';
    try {
        const response = await fetch(seedPath, { cache: 'no-store' });
        if (!response.ok) {
            throw new Error(`Failed to load E2E seed (${response.status}) from ${seedPath}`);
        }
        return await response.json();
    } catch (error) {
        console.error('[Coffee Dial] Failed to load E2E seed data', error);
        return null;
    }
};

let appStartupPromise = null;

const runActionIfPresent = async (app, actionName) => {
    if (!actionName || !app?.actions || typeof app.actions[actionName] !== 'function') return;
    await app.actions[actionName]();
};

export const startFullApp = async ({ actionName = null } = {}) => {
    logTimeF('startFullApp: called');
    if (!appStartupPromise) {
        appStartupPromise = (async () => {
            logTimeF('mounting UI views: start');
            await mountShellHeader();
            logTimeF('mountShellHeader done');
            await mountSignedOutAuth();
            await mountPinnedSection();
            logTimeF('mountPinnedSection done');
            await mountUiShellView();
            logTimeF('mountUiShellView done');

            // Parallelize remaining non-critical mounts (tables only, modals deferred)
            await Promise.all([
                mountBrewsPinArtView(),
                mountBrewsTableView(),
                mountBeansTableView(),
                mountCoffeeTypesTableView(),
                mountGasTableView(),
                mountOverlayHostView()
            ]);
            logTimeF('all UI views mounted');

            const appCommands = createAppCommands();
            const appEvents = createAppEvents();
            const app = createAppContainer({ appCommands, appEvents });
            if (typeof window !== 'undefined') {
                window.__coffeeDialApp = app;
            }
            const e2eSeedData = await loadE2ESeedData();
            if (e2eSeedData && typeof app.applyE2ESeedData === 'function') {
                await app.applyE2ESeedData(e2eSeedData);
            }
            initViewBindings(app.actions, {
                featureActions: app.featureActions
            });
            if (shouldRunCoreContractChecks()) {
                runCoreContractChecks();
            }
            if (shouldRunSmokeChecks()) {
                runSmokeChecks({ actions: app.actions, appCommands });
            }
            registerServiceWorker();
            if (!e2eSeedData) {
                logTimeF('registering onAuthStateChanged listener');
                onAuthStateChanged(auth, app.handleAuthStateChanged);
            }
            logTimeF('startFullApp promise resolving');
            return { app, appCommands };
        })();
    }

    const context = await appStartupPromise;
    await runActionIfPresent(context.app, actionName);
    return context;
};
