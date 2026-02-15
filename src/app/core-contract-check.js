import * as format from '../core/format.js';
import * as notify from '../core/notify.js';
import * as confirm from '../core/confirm.js';

const CONTRACTS = [
    {
        moduleId: 'core/format',
        exports: ['getStarDisplay', 'formatTime', 'getRoastBadge', 'formatBeanOpenedDate'],
        target: format
    },
    {
        moduleId: 'core/notify',
        exports: ['showAutoPinToast', 'closeAutoPinToast', 'showToast', 'createNotificationUxModule'],
        target: notify
    },
    {
        moduleId: 'core/confirm',
        exports: ['resolveAppConfirm', 'closeAppConfirm', 'openAppConfirm', 'installDialogAdapters'],
        target: confirm
    }
];

export const shouldRunCoreContractChecks = () => {
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    if (search.get('debugContracts') === '1') return true;
    if (search.get('debug') === '1') return true;
    if (search.get('debugBindings') === '1') return true;
    if (search.get('smoke') === '1') return true;
    if (typeof localStorage !== 'undefined') {
        if (localStorage.getItem('coffeeDialDebugContracts') === '1') return true;
        if (localStorage.getItem('coffeeDialDebugBindings') === '1') return true;
        if (localStorage.getItem('coffeeDialSmoke') === '1') return true;
    }
    return false;
};

const validateModuleContract = ({ moduleId, exports, target }) => {
    const missing = [];
    const invalidType = [];

    exports.forEach((key) => {
        if (!(key in target)) {
            missing.push(key);
            return;
        }
        if (typeof target[key] !== 'function') {
            invalidType.push({ key, type: typeof target[key] });
        }
    });

    return {
        moduleId,
        ok: missing.length === 0 && invalidType.length === 0,
        missing,
        invalidType
    };
};

export const runCoreContractChecks = () => {
    const results = CONTRACTS.map(validateModuleContract);
    const failed = results.filter((item) => !item.ok);
    const report = {
        ok: failed.length === 0,
        checkedAt: new Date().toISOString(),
        results
    };

    if (typeof window !== 'undefined') {
        window.__coffeeDialCoreContractsReport = report;
    }

    if (report.ok) {
        console.info('[Coffee Dial] Core contract checks passed', report);
    } else {
        console.error('[Coffee Dial] Core contract checks failed', report);
    }

    return report;
};
