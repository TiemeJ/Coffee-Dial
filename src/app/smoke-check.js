const REQUIRED_ACTION_IDS = [
    'googleLogin',
    'changeView',
    'handleFormSubmit',
    'editCoffee',
    'duplicateCoffee',
    'togglePinnedTiles',
    'openCoffeeCard',
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

export const runSmokeChecks = ({ actions = {} } = {}) => {
    const missingActions = REQUIRED_ACTION_IDS.filter((id) => typeof actions[id] !== 'function');
    const missingElements = REQUIRED_ELEMENT_IDS.filter((id) => !document.getElementById(id));

    const report = {
        ok: missingActions.length === 0 && missingElements.length === 0,
        missingActions,
        missingElements,
        checkedAt: new Date().toISOString()
    };

    if (typeof window !== 'undefined') {
        window.__coffeeDialSmokeReport = report;
    }

    if (report.ok) {
        console.info('[Coffee Dial] Smoke checks passed', report);
    } else {
        console.error('[Coffee Dial] Smoke checks failed', report);
    }

    return report;
};

export { shouldRunSmokeChecks };
