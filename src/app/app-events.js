const TRACE_LIMIT = 300;

const parseSchemaType = (rawType = '') => {
    const token = String(rawType || '').trim();
    const optional = token.endsWith('?');
    const core = optional ? token.slice(0, -1).trim() : token;
    const variants = core.split('|').map((part) => part.trim()).filter(Boolean);
    return { optional, variants: variants.length ? variants : ['any'] };
};

const valueMatchesVariant = (value, variant) => {
    if (variant === 'any' || variant === 'unknown') return true;
    if (variant === 'null') return value === null;
    if (variant === 'array') return Array.isArray(value);
    if (variant === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    return typeof value === variant;
};

const validatePayload = (payload, schema = {}) => {
    if (!schema || typeof schema !== 'object') return { ok: true, errors: [] };
    if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
        return {
            ok: false,
            errors: ['Payload must be an object.']
        };
    }

    const errors = [];
    Object.entries(schema).forEach(([field, descriptor]) => {
        const { optional, variants } = parseSchemaType(descriptor);
        const hasValue = Object.prototype.hasOwnProperty.call(payload, field);
        if (!hasValue) {
            if (!optional) errors.push(`Missing required field "${field}".`);
            return;
        }
        const value = payload[field];
        if (value === undefined && optional) return;
        const matches = variants.some((variant) => valueMatchesVariant(value, variant));
        if (!matches) {
            errors.push(
                `Invalid type for "${field}". Expected ${variants.join(' | ')}, got ${
                    value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value
                }.`
            );
        }
    });
    return { ok: errors.length === 0, errors };
};

const shouldEnableDebug = (options = {}) => {
    if (typeof options.debug === 'boolean') return options.debug;
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    if (search.get('debugEvents') === '1') return true;
    if (search.get('debug') === '1') return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('coffeeDialDebugEvents') === '1') return true;
    return false;
};

const shouldEnableTrace = (options = {}) => {
    if (typeof options.trace === 'boolean') return options.trace;
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    if (search.get('traceEvents') === '1') return true;
    if (search.get('debugEvents') === '1') return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('coffeeDialTraceEvents') === '1') return true;
    return false;
};

const pushTrace = (enabled, payload) => {
    if (!enabled || typeof window === 'undefined') return;
    const trace = (window.__coffeeDialEventTrace = window.__coffeeDialEventTrace || []);
    trace.push({ time: new Date().toISOString(), ...payload });
    if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
};

export const createAppEvents = (options = {}) => {
    const debug = shouldEnableDebug(options);
    const trace = shouldEnableTrace(options);
    const listeners = new Map();
    const schemas = new Map();
    const owners = new Map();

    const registerEventSchema = (eventName, schema, config = {}) => {
        const name = String(eventName || '').trim();
        if (!name) throw new Error('registerEventSchema requires an event name');
        if (schemas.has(name)) throw new Error(`Event schema for "${name}" is already registered`);
        schemas.set(name, schema || {});
        if (config.owner) owners.set(name, String(config.owner));
        pushTrace(trace, { type: 'event_schema_registered', name, owner: owners.get(name) || null });
    };

    const subscribe = (eventName, handler) => {
        const name = String(eventName || '').trim();
        if (!name) throw new Error('subscribe requires an event name');
        if (typeof handler !== 'function') throw new Error(`subscribe("${name}") requires a function handler`);
        const set = listeners.get(name) || new Set();
        set.add(handler);
        listeners.set(name, set);
        pushTrace(trace, { type: 'event_subscribed', name, listeners: set.size });
        return () => {
            const current = listeners.get(name);
            if (!current) return;
            current.delete(handler);
            if (current.size === 0) listeners.delete(name);
            pushTrace(trace, { type: 'event_unsubscribed', name, listeners: current.size });
        };
    };

    const publish = (eventName, payload = {}, meta = {}) => {
        const name = String(eventName || '').trim();
        if (!name) throw new Error('publish requires an event name');

        const schema = schemas.get(name);
        if (schema) {
            const result = validatePayload(payload, schema);
            if (!result.ok) {
                const message = `Invalid payload for app event "${name}"`;
                pushTrace(trace, { type: 'event_invalid_payload', name, payload, errors: result.errors });
                if (debug) throw new Error(`${message}: ${result.errors.join(' ')}`);
                console.warn(message, result.errors, payload);
                return 0;
            }
        }

        const handlers = Array.from(listeners.get(name) || []);
        pushTrace(trace, {
            type: 'event_publish',
            name,
            owner: owners.get(name) || null,
            listeners: handlers.length,
            payload,
            meta
        });
        handlers.forEach((handler) => {
            try {
                handler(payload, meta);
            } catch (error) {
                pushTrace(trace, { type: 'event_handler_failed', name, error: error?.message || String(error) });
                console.error(`Event handler failed for "${name}"`, error);
            }
        });
        return handlers.length;
    };

    const getRegisteredEvents = () => Array.from(new Set([...schemas.keys(), ...listeners.keys()])).sort();

    if (trace && typeof window !== 'undefined') {
        window.__coffeeDialEventTraceMeta = {
            traceEnabled: true,
            debugEnabled: debug,
            startedAt: new Date().toISOString()
        };
        console.info('[Coffee Dial] Event tracing enabled');
    }

    return {
        debug,
        trace,
        getRegisteredEvents,
        publish,
        registerEventSchema,
        subscribe
    };
};

