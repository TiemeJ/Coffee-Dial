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

const TABLE_ROW_ID_CHECKS = [
    { tableBodyId: 'coffeeTableBody', label: 'brews' },
    { tableBodyId: 'beansTableBody', label: 'beans' },
    { tableBodyId: 'coffeeTypesTableBody', label: 'coffee-types' },
    { tableBodyId: 'gasTableBody', label: 'gas' }
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

const findRowsMissingDataId = () => {
    const failures = [];
    TABLE_ROW_ID_CHECKS.forEach(({ tableBodyId, label }) => {
        const tbody = document.getElementById(tableBodyId);
        if (!tbody) return;
        const rows = Array.from(tbody.querySelectorAll('tr'));
        const missingRows = rows.filter((row) => {
            const singleCell = row.children.length === 1 ? row.children[0] : null;
            const isSectionHeader = !!singleCell?.hasAttribute('colspan');
            if (isSectionHeader) return false;
            return !row.getAttribute('data-id');
        });
        if (!missingRows.length) return;
        failures.push({
            tableBodyId,
            table: label,
            missingCount: missingRows.length
        });
    });
    return failures;
};

const normalizeBeansTableState = async (actions = {}) => {
    actions.openBeans?.();
    await waitFor(() => isVisible('beansModal'), 2500);
    actions.beansChangeView?.('mine');
    actions.clearBeansSearch?.();
    actions.clearBeansFilters?.();
    await waitFor(
        () => !!document.querySelector('#beansTableBody tr') || !document.getElementById('beansEmpty')?.classList.contains('hidden'),
        3000
    );
};

const runCommandFlowSmoke = async ({ actions = {}, appCommands = null } = {}) => {
    const flows = [];

    const addFlow = (name, status, detail = '') => {
        flows.push({ name, status, detail });
    };

    const extractBeanIdFromAction = (actionValue = '') => {
        const value = String(actionValue || '');
        const patterns = [
            /openBrewWithBean\('([^']+)'\)/,
            /beansOpenCard\('([^']+)'\)/,
            /beansOpenCardForEdit\('([^']+)'\)/,
            /showBrewsForBean\('([^']+)'\)/
        ];
        for (const pattern of patterns) {
            const match = value.match(pattern);
            if (match?.[1]) return match[1];
        }
        return null;
    };

    const getFirstBeanRowId = () => {
        const rows = Array.from(document.querySelectorAll('#beansTableBody tr'));
        for (const row of rows) {
            const directId = row.getAttribute('data-id');
            if (directId) return directId;

            const actionEls = Array.from(row.querySelectorAll('[data-action-click]'));
            for (const actionEl of actionEls) {
                const beanId = extractBeanIdFromAction(actionEl.getAttribute('data-action-click'));
                if (beanId) return beanId;
            }
        }
        return null;
    };

    const findBrewWithCoffeeBeanContext = async (brewIds = []) => {
        for (const candidateBrewId of brewIds) {
            actions.showBeanForBrew(candidateBrewId);
            const beanOpened = await waitFor(() => isVisible('beanCardOverlay'), 2500);
            if (!beanOpened) {
                actions.closeBeanCard?.(null);
                continue;
            }

            actions.showCoffeeForBean();
            const coffeeOpened = await waitFor(() => isVisible('coffeeTypeCardOverlay'), 2500);
            if (!coffeeOpened) {
                actions.closeBeanCard?.(null);
                actions.closeCoffeeTypeCard?.(null);
                continue;
            }

            actions.showBeansForCoffeeType();
            await waitFor(() => isVisible('beansModal'), 3000);
            actions.beansChangeView?.('mine');
            actions.clearBeansSearch?.();
            actions.clearBeansFilters?.();
            const beansReady = await waitFor(
                () => !!document.querySelector('#beansTableBody tr') || !document.getElementById('beansEmpty')?.classList.contains('hidden'),
                3000
            );
            const hasRows = !!document.querySelector('#beansTableBody tr');
            const beanId = beansReady && hasRows ? getFirstBeanRowId() : null;
            if (beanId) {
                return { brewId: candidateBrewId, beanId };
            }

            actions.closeBeans?.();
            actions.closeCoffeeTypeCard?.(null);
            actions.closeBeanCard?.(null);
        }
        return null;
    };

    const preconditionsOk =
        typeof actions.showBeanForBrew === 'function' &&
        typeof actions.showCoffeeForBean === 'function' &&
        typeof actions.openBrewWithBean === 'function' &&
        typeof actions.showBeansForCoffeeType === 'function' &&
        typeof actions.openBeans === 'function' &&
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
        const brewRows = hasBrewRows
            ? Array.from(document.querySelectorAll('#coffeeTableBody tr[data-id]'))
            : [];
        const brewRow = brewRows.length ? brewRows[0] : null;
        const brewIds = brewRows
            .map((row) => row.getAttribute('data-id'))
            .filter(Boolean);
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
            const contextual = await findBrewWithCoffeeBeanContext(brewIds.length ? brewIds : [brewId]);
            if (!contextual?.beanId) {
                addFlow('coffee -> brew form', 'skip', 'No brew rows with bean/coffee context');
            } else {
                actions.openBrewWithBean(contextual.beanId);
                const coffeeBrewFormOpened = await waitFor(
                    () => isVisible('brewFormModal'),
                    3000
                );
                addFlow(
                    'coffee -> brew form',
                    coffeeBrewFormOpened ? 'pass' : 'fail',
                    coffeeBrewFormOpened ? '' : 'brewFormModal did not become visible'
                );
                actions.discardBrewFormModal?.();
            }
            actions.closeBeans?.();
            actions.closeCoffeeTypeCard?.(null);
            actions.closeBeanCard?.(null);
        }

        await normalizeBeansTableState(actions);
        const hasBeanRows = !!document.querySelector('#beansTableBody tr');
        const beanId = hasBeanRows ? getFirstBeanRowId() : null;

        if (!beanId) {
            const rowCount = document.querySelectorAll('#beansTableBody tr').length;
            addFlow('bean -> brew form', 'skip', rowCount > 0 ? 'Bean rows found but no resolvable bean id' : 'No bean rows available');
        } else {
            actions.openBrewWithBean(beanId);
            const beanBrewFormOpened = await waitFor(
                () => isVisible('brewFormModal'),
                3000
            );
            addFlow(
                'bean -> brew form',
                beanBrewFormOpened ? 'pass' : 'fail',
                beanBrewFormOpened ? '' : 'brewFormModal did not become visible'
            );
            actions.discardBrewFormModal?.();
        }

        actions.openAddBrewFromPinned(null);
        const pinBrewFormOpened = await waitFor(
            () => isVisible('brewFormModal'),
            3000
        );
        addFlow(
            'pin -> brew form',
            pinBrewFormOpened ? 'pass' : 'fail',
            pinBrewFormOpened ? '' : 'brewFormModal did not become visible'
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
    const missingRowDataIds = findRowsMissingDataId();

    const report = {
        ok: missingActions.length === 0 && missingElements.length === 0 && missingRowDataIds.length === 0,
        missingActions,
        missingElements,
        missingRowDataIds,
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
