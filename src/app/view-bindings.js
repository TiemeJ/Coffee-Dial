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

const runStatement = (statement, event, el, actions) => {
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
    const action = actions[actionId];
    if (typeof action !== 'function') {
        throw new Error(`Unknown action "${actionId}"`);
    }

    const args = splitArgs(rawArgs).map((token) => decodeToken(token, event, el));
    return action(...args);
};

const executeBinding = (code, event, el, actions) => {
    try {
        const statements = splitStatements(code);
        let result;
        for (const statement of statements) {
            result = runStatement(statement, event, el, actions);
        }
        if (result === false) {
            event.preventDefault();
            event.stopPropagation();
        }
    } catch (err) {
        console.error('Failed to execute view binding:', code, err);
    }
};

export const initViewBindings = (actions = {}) => {
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
            executeBinding(code, event, el, actions);
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
};
