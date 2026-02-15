const BINDINGS = [
    { domEvent: 'click', attr: 'data-action-click' },
    { domEvent: 'change', attr: 'data-action-change' },
    { domEvent: 'input', attr: 'data-action-input' },
    { domEvent: 'submit', attr: 'data-action-submit' },
    { domEvent: 'pointerdown', attr: 'data-action-pointerdown' },
    { domEvent: 'dblclick', attr: 'data-action-dblclick' }
];

const CALL_PATTERN = /^([A-Za-z_$][\w$]*)\((.*)\)$/;
const boundElements = new WeakMap();
const TRACE_LIMIT = 200;
const FEATURE_ROOT_ATTR = 'data-feature-root';

const shouldTraceBindings = (options = {}) => {
    if (typeof options.traceBindings === 'boolean') return options.traceBindings;
    const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    if (search?.get('debugBindings') === '1') return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('coffeeDialDebugBindings') === '1') return true;
    return false;
};

const pushTraceEvent = (enabled, payload) => {
    if (!enabled || typeof window === 'undefined') return;
    const trace = (window.__coffeeDialBindingTrace = window.__coffeeDialBindingTrace || []);
    trace.push({
        time: new Date().toISOString(),
        ...payload
    });
    if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
};

const splitStatements = (code) => {
    const output = [];
    let buf = '';
    let quote = null;
    for (let i = 0; i < code.length; i += 1) {
        const ch = code[i];
        if ((ch === '\'' || ch === '"') && code[i - 1] !== '\\') {
            if (quote === ch) quote = null;
            else if (!quote) quote = ch;
            buf += ch;
            continue;
        }
        if (ch === ';' && !quote) {
            if (buf.trim()) output.push(buf.trim());
            buf = '';
            continue;
        }
        buf += ch;
    }
    if (buf.trim()) output.push(buf.trim());
    return output;
};

const splitArgs = (argsRaw) => {
    if (!argsRaw || !argsRaw.trim()) return [];
    const args = [];
    let buf = '';
    let quote = null;
    for (let i = 0; i < argsRaw.length; i += 1) {
        const ch = argsRaw[i];
        if ((ch === '\'' || ch === '"') && argsRaw[i - 1] !== '\\') {
            if (quote === ch) quote = null;
            else if (!quote) quote = ch;
            buf += ch;
            continue;
        }
        if (ch === ',' && !quote) {
            args.push(buf.trim());
            buf = '';
            continue;
        }
        buf += ch;
    }
    if (buf.trim()) args.push(buf.trim());
    return args;
};

const decodeToken = (token, event, el) => {
    if (token === 'event') return event;
    if (token === 'this' || token === 'el') return el;
    if (token === 'this.value' || token === 'el.value') return el?.value;
    if (token === 'event.target.value') return event?.target?.value;
    if (token === 'null') return null;
    if (token === 'true') return true;
    if (token === 'false') return false;

    if ((token.startsWith('\'') && token.endsWith('\'')) || (token.startsWith('"') && token.endsWith('"'))) {
        const quote = token[0];
        const inner = token.slice(1, -1);
        return inner.replaceAll(`\\${quote}`, quote);
    }

    if (/^-?\d+(\.\d+)?$/.test(token)) {
        return Number(token);
    }

    return undefined;
};

const resolveFeatureIdForElement = (el) => {
    const root = el?.closest?.(`[${FEATURE_ROOT_ATTR}]`);
    const featureId = root?.getAttribute?.(FEATURE_ROOT_ATTR)?.trim?.();
    return featureId || null;
};

const createFeatureActionResolver = ({ globalActions = {}, traceEnabled = false, strictFeatureActionCollisions = true } = {}) => {
    const featureActionsById = new Map();
    const actionOwnerByName = new Map();

    const registerFeatureActions = (featureId, actions = {}) => {
        const normalizedFeatureId = (featureId || '').toString().trim();
        if (!normalizedFeatureId) {
            throw new Error('registerFeatureActions requires a non-empty featureId');
        }
        if (featureActionsById.has(normalizedFeatureId)) {
            throw new Error(`Feature actions for "${normalizedFeatureId}" are already registered`);
        }

        const normalizedActions = {};
        Object.entries(actions || {}).forEach(([actionId, action]) => {
            if (typeof action !== 'function') return;
            if (strictFeatureActionCollisions) {
                const existingOwner = actionOwnerByName.get(actionId);
                if (existingOwner && existingOwner !== normalizedFeatureId) {
                    throw new Error(
                        `Feature action collision for "${actionId}" between "${existingOwner}" and "${normalizedFeatureId}"`
                    );
                }
            }
            actionOwnerByName.set(actionId, normalizedFeatureId);
            normalizedActions[actionId] = action;
        });

        featureActionsById.set(normalizedFeatureId, normalizedActions);
        pushTraceEvent(traceEnabled, {
            level: 'info',
            type: 'feature_actions_registered',
            featureId: normalizedFeatureId,
            count: Object.keys(normalizedActions).length
        });
    };

    const resolveAction = (actionId, el) => {
        const featureId = resolveFeatureIdForElement(el);
        if (featureId) {
            const featureActions = featureActionsById.get(featureId);
            const featureAction = featureActions?.[actionId];
            if (typeof featureAction === 'function') {
                return { action: featureAction, source: `feature:${featureId}` };
            }
        }

        const globalAction = globalActions?.[actionId];
        if (typeof globalAction === 'function') {
            return { action: globalAction, source: 'global' };
        }

        return { action: null, source: 'missing' };
    };

    return {
        registerFeatureActions,
        resolveAction
    };
};

const runStatement = (statement, event, el, actionResolver, traceEnabled = false) => {
    if (!statement) return undefined;
    if (statement === 'event.stopPropagation()') {
        event.stopPropagation();
        return undefined;
    }
    if (statement === 'event.preventDefault()') {
        event.preventDefault();
        return undefined;
    }
    if (statement === 'return false' || statement === 'return false;') {
        return false;
    }

    const callMatch = statement.match(CALL_PATTERN);
    if (!callMatch) {
        throw new Error(`Unsupported action statement: "${statement}"`);
    }

    const [, actionId, rawArgs] = callMatch;
    const { action, source } = actionResolver(actionId, el);
    if (typeof action !== 'function') {
        pushTraceEvent(traceEnabled, {
            level: 'error',
            type: 'unknown_action',
            actionId,
            statement,
            source,
            element: el?.id || el?.tagName || 'unknown'
        });
        throw new Error(`Unknown action "${actionId}"`);
    }

    const args = splitArgs(rawArgs).map((token) => decodeToken(token, event, el));
    pushTraceEvent(traceEnabled, {
        level: 'info',
        type: 'action_invoke',
        actionId,
        source,
        statement,
        element: el?.id || el?.tagName || 'unknown'
    });
    return action(...args);
};

const executeBinding = (code, event, el, actionResolver, traceEnabled = false) => {
    try {
        const statements = splitStatements(code);
        let result;
        for (const statement of statements) {
            result = runStatement(statement, event, el, actionResolver, traceEnabled);
        }
        if (result === false) {
            event.preventDefault();
            event.stopPropagation();
        }
    } catch (err) {
        pushTraceEvent(traceEnabled, {
            level: 'error',
            type: 'binding_execution_failed',
            code,
            error: err?.message || String(err),
            element: el?.id || el?.tagName || 'unknown'
        });
        console.error('Failed to execute view binding:', code, err);
    }
};

export const initViewBindings = (actions = {}, options = {}) => {
    const traceEnabled = shouldTraceBindings(options);
    const resolver = createFeatureActionResolver({
        globalActions: actions,
        traceEnabled,
        strictFeatureActionCollisions: options.strictFeatureActionCollisions !== false
    });
    if (traceEnabled && typeof window !== 'undefined') {
        window.__coffeeDialBindingTrace = window.__coffeeDialBindingTrace || [];
        window.__coffeeDialBindingTraceMeta = {
            traceEnabled: true,
            startedAt: new Date().toISOString()
        };
        console.info('[Coffee Dial] View-binding trace enabled');
    }

    const bindElement = (el, domEvent, attr) => {
        let events = boundElements.get(el);
        if (!events) {
            events = new Set();
            boundElements.set(el, events);
        }

        const key = `${domEvent}:${attr}`;
        if (events.has(key)) return;

        events.add(key);
        el.addEventListener(domEvent, (event) => {
            const code = el.getAttribute(attr) ?? (domEvent === 'click' ? el.getAttribute('data-action') : null);
            if (!code) return;
            executeBinding(code, event, el, resolver.resolveAction, traceEnabled);
        });
    };

    const bindAll = (root = document) => {
        BINDINGS.forEach(({ domEvent, attr }) => {
            if (root instanceof Element && root.hasAttribute(attr)) {
                bindElement(root, domEvent, attr);
            }
            root.querySelectorAll?.(`[${attr}]`).forEach((el) => bindElement(el, domEvent, attr));
        });
    };

    bindAll(document);

    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (!(node instanceof Element)) return;
                bindAll(node);
            });
        });
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const initialFeatureActions = options.featureActions;
    if (initialFeatureActions && typeof initialFeatureActions === 'object') {
        Object.entries(initialFeatureActions).forEach(([featureId, featureActions]) => {
            resolver.registerFeatureActions(featureId, featureActions);
        });
    }

    return {
        registerFeatureActions: resolver.registerFeatureActions
    };
};
