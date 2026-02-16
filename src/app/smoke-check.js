const REQUIRED_ACTION_IDS = [
    'googleLogin',
    'changeView',
    'handleFormSubmit',
    'editCoffee',
    'duplicateCoffee',
    'togglePinnedTiles',
    'brewsOpenCard',
    'navigateCoffeeCard'
];

const REQUIRED_ELEMENT_IDS = [
    'viewSelect',
    'coffeeTableBody',
    'pinnedSection',
    'pinnedGrid',
    'coffeeCardOverlay',
    'coffeeCardPrevBtn',
    'coffeeCardNextBtn'
];

const shouldRunSmokeChecks = () => {
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    if (search.get('smoke') === '1') return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('coffeeDialSmoke') === '1') return true;
    return false;
};

const isVisible = (id) => {
    const el = document.getElementById(id);
    return !!el && !el.classList.contains('hidden');
};

const cleanupSmokeUiState = (actions = {}) => {
    try { actions.closeBeans?.(); } catch (_) {}
    try { actions.closeCoffeeTypeCard?.(null); } catch (_) {}
    try { actions.closeBeanCard?.(null); } catch (_) {}
    try { actions.discardBrewFormModal?.(); } catch (_) {}
    // Hard-close overlays in case action wiring or command timing leaves stale UI state behind.
    document.getElementById('beansModal')?.classList.add('hidden');
    document.getElementById('coffeeTypeCardOverlay')?.classList.add('hidden');
    document.getElementById('beanCardOverlay')?.classList.add('hidden');
};

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const waitFor = async (predicate, timeoutMs = 4000, intervalMs = 80) => {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
        if (predicate()) return true;
        await delay(intervalMs);
    }
    return false;
};

const ensureMineView = (actions) => {
    const viewSelect = document.getElementById('viewSelect');
    if (!viewSelect) return;
    if (viewSelect.value !== 'mine') {
        actions.changeView?.('mine');
        viewSelect.value = 'mine';
    }
};

const runCommandFlowSmoke = async ({ actions = {}, appCommands = null } = {}) => {
    const flows = [];

    const addFlow = (name, status, detail = '') => {
        flows.push({ name, status, detail });
    };

    const preconditionsOk =
        typeof actions.showBeanForBrew === 'function' &&
        typeof actions.showCoffeeForBean === 'function' &&
        typeof actions.openBrewWithBean === 'function' &&
        typeof actions.showBeansForCoffeeType === 'function' &&
        typeof actions.openAddBrewFromPinned === 'function' &&
        typeof appCommands?.dispatch === 'function';

    if (!preconditionsOk) {
        addFlow('preconditions', 'skip', 'Required actions or appCommands.dispatch missing');
        return {
            ok: true,
            skipped: true,
            flows,
            checkedAt: new Date().toISOString()
        };
    }

    const signedInRoot = document.getElementById('signedInContent');
    if (signedInRoot && signedInRoot.classList.contains('hidden')) {
        addFlow('auth state', 'skip', 'Signed-out state; command flow smoke not applicable');
        return {
            ok: true,
            skipped: true,
            flows,
            checkedAt: new Date().toISOString()
        };
    }

    try {
        ensureMineView(actions);

        const hasBrewRows = await waitFor(
            () => !!document.querySelector('#coffeeTableBody tr[data-id]'),
            5000
        );
        const brewRow = hasBrewRows ? document.querySelector('#coffeeTableBody tr[data-id]') : null;
        const brewId = brewRow?.getAttribute('data-id') || null;

        if (!brewId) {
            addFlow('brew -> bean card', 'skip', 'No brew rows available');
            addFlow('bean -> coffee card', 'skip', 'Missing brew context');
        } else {
            actions.showBeanForBrew(brewId);
            const beanOpened = await waitFor(() => isVisible('beanCardOverlay'), 3000);
            addFlow(
                'brew -> bean card',
                beanOpened ? 'pass' : 'fail',
                beanOpened ? '' : 'beanCardOverlay did not open'
            );

            if (beanOpened) {
                actions.showCoffeeForBean();
                const coffeeOpened = await waitFor(() => isVisible('coffeeTypeCardOverlay'), 3000);
                addFlow(
                    'bean -> coffee card',
                    coffeeOpened ? 'pass' : 'fail',
                    coffeeOpened ? '' : 'coffeeTypeCardOverlay did not open'
                );
                actions.closeCoffeeTypeCard?.(null);
                actions.closeBeanCard?.(null);
            }
        }

        // coffee -> brew form (via coffee card -> beans -> brew)
        if (isVisible('coffeeTypeCardOverlay')) {
            actions.closeCoffeeTypeCard?.(null);
        }
        if (!brewId) {
            addFlow('coffee -> brew form', 'skip', 'No brew rows available for coffee context');
        } else {
            actions.showBeanForBrew(brewId);
            const beanOpenedForCoffeeFlow = await waitFor(() => isVisible('beanCardOverlay'), 3000);
            if (!beanOpenedForCoffeeFlow) {
                addFlow('coffee -> brew form', 'skip', 'Unable to open bean card from brew context');
            } else {
                actions.showCoffeeForBean();
                const coffeeOpenedForBrewFlow = await waitFor(() => isVisible('coffeeTypeCardOverlay'), 3000);
                if (!coffeeOpenedForBrewFlow) {
                    addFlow('coffee -> brew form', 'skip', 'Unable to open coffee card from bean context');
                } else {
                    actions.showBeansForCoffeeType();
                    const beansModalOpened = await waitFor(
                        () => isVisible('beansModal') || !!document.querySelector('#beansTableBody tr[data-id]'),
                        3000
                    );
                    const coffeeBeanId = beansModalOpened
                        ? document.querySelector('#beansTableBody tr[data-id]')?.getAttribute('data-id')
                        : null;
                    if (!coffeeBeanId) {
                        addFlow('coffee -> brew form', 'skip', 'No beans found for selected coffee context');
                    } else {
                        actions.openBrewWithBean(coffeeBeanId);
                        const coffeeBrewFormOpened = await waitFor(
                            () => isVisible('brewFormModal') || isVisible('formContainer'),
                            3000
                        );
                        addFlow(
                            'coffee -> brew form',
                            coffeeBrewFormOpened ? 'pass' : 'fail',
                            coffeeBrewFormOpened ? '' : 'Neither brewFormModal nor formContainer became visible'
                        );
                        actions.discardBrewFormModal?.();
                    }
                }
            }
            actions.closeCoffeeTypeCard?.(null);
            actions.closeBeanCard?.(null);
        }

        const hasBeanRows = await waitFor(
            () => !!document.querySelector('#beansTableBody tr[data-id]'),
            4000
        );
        const beanId = hasBeanRows
            ? document.querySelector('#beansTableBody tr[data-id]')?.getAttribute('data-id')
            : null;

        if (!beanId) {
            addFlow('bean -> brew form', 'skip', 'No bean rows available');
        } else {
            actions.openBrewWithBean(beanId);
            const beanBrewFormOpened = await waitFor(
                () => isVisible('brewFormModal') || isVisible('formContainer'),
                3000
            );
            addFlow(
                'bean -> brew form',
                beanBrewFormOpened ? 'pass' : 'fail',
                beanBrewFormOpened ? '' : 'Neither brewFormModal nor formContainer became visible'
            );
            actions.discardBrewFormModal?.();
        }

        actions.openAddBrewFromPinned(null);
        const pinBrewFormOpened = await waitFor(
            () => isVisible('brewFormModal') || isVisible('formContainer'),
            3000
        );
        addFlow(
            'pin -> brew form',
            pinBrewFormOpened ? 'pass' : 'fail',
            pinBrewFormOpened ? '' : 'Neither brewFormModal nor formContainer became visible'
        );
        actions.discardBrewFormModal?.();
    } finally {
        // Smoke must leave app UI as it found it.
        cleanupSmokeUiState(actions);
    }

    const failed = flows.filter((f) => f.status === 'fail');
    const passed = flows.filter((f) => f.status === 'pass');
    const skipped = flows.filter((f) => f.status === 'skip');
    return {
        ok: failed.length === 0,
        flows,
        failed: failed.length,
        passed: passed.length,
        skipped: skipped.length,
        checkedAt: new Date().toISOString()
    };
};

export const runSmokeChecks = ({ actions = {}, appCommands = null } = {}) => {
    const missingActions = REQUIRED_ACTION_IDS.filter((id) => typeof actions[id] !== 'function');
    const missingElements = REQUIRED_ELEMENT_IDS.filter((id) => !document.getElementById(id));

    const report = {
        ok: missingActions.length === 0 && missingElements.length === 0,
        missingActions,
        missingElements,
        checkedAt: new Date().toISOString(),
        commandFlows: {
            status: 'pending'
        }
    };

    if (typeof window !== 'undefined') {
        window.__coffeeDialSmokeReport = report;
    }

    if (report.ok) {
        console.info('[Coffee Dial] Smoke checks passed', report);
    } else {
        console.error('[Coffee Dial] Smoke checks failed', report);
    }

    // Async behavioral smoke flow for command-driven cross-feature paths.
    runCommandFlowSmoke({ actions, appCommands })
        .then((commandFlowReport) => {
            report.commandFlows = commandFlowReport;
            report.ok = report.ok && commandFlowReport.ok;
            cleanupSmokeUiState(actions);
            if (typeof window !== 'undefined') {
                window.__coffeeDialSmokeReport = report;
                window.__coffeeDialCommandFlowSmokeReport = commandFlowReport;
            }
            if (commandFlowReport.ok) {
                console.info('[Coffee Dial] Command flow smoke checks passed', commandFlowReport);
            } else {
                console.error('[Coffee Dial] Command flow smoke checks failed', commandFlowReport);
            }
        })
        .catch((error) => {
            report.commandFlows = {
                ok: false,
                error: String(error?.message || error),
                checkedAt: new Date().toISOString()
            };
            report.ok = false;
            cleanupSmokeUiState(actions);
            if (typeof window !== 'undefined') {
                window.__coffeeDialSmokeReport = report;
                window.__coffeeDialCommandFlowSmokeReport = report.commandFlows;
            }
            console.error('[Coffee Dial] Command flow smoke checks errored', error);
        });

    return report;
};

export { shouldRunSmokeChecks };
