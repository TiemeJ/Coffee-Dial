const TRACE_LIMIT = 300;
const TRACKED_FEATURE_NAMESPACES = ['beans', 'brews', 'coffees', 'gas', 'pin'];

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
    if (search.get('debugCommands') === '1') return true;
    if (search.get('debug') === '1') return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('coffeeDialDebugCommands') === '1') return true;
    return false;
};

const shouldEnableTrace = (options = {}) => {
    if (typeof options.trace === 'boolean') return options.trace;
    if (typeof window === 'undefined') return false;
    const search = new URLSearchParams(window.location.search);
    if (search.get('traceCommands') === '1') return true;
    if (search.get('debugCommands') === '1') return true;
    if (typeof localStorage !== 'undefined' && localStorage.getItem('coffeeDialTraceCommands') === '1') return true;
    return false;
};

const pushTrace = (enabled, payload) => {
    if (!enabled || typeof window === 'undefined') return;
    const trace = (window.__coffeeDialCommandTrace = window.__coffeeDialCommandTrace || []);
    trace.push({ time: new Date().toISOString(), ...payload });
    if (trace.length > TRACE_LIMIT) trace.splice(0, trace.length - TRACE_LIMIT);
};

const getCommandNamespace = (commandName = '') => {
    const dotIdx = String(commandName).indexOf('.');
    if (dotIdx <= 0) return null;
    return String(commandName).slice(0, dotIdx);
};

const validateCommandOwnerNamespace = ({ commandName, owner }) => {
    const namespace = getCommandNamespace(commandName);
    if (!namespace || !TRACKED_FEATURE_NAMESPACES.includes(namespace)) return { ok: true, message: '' };
    const normalizedOwner = String(owner || '').trim();
    if (!normalizedOwner) {
        return {
            ok: false,
            message: `Command "${commandName}" requires config.owner="${namespace}" (missing owner).`
        };
    }
    if (normalizedOwner !== namespace) {
        return {
            ok: false,
            message: `Command "${commandName}" owner mismatch: expected "${namespace}", got "${normalizedOwner}".`
        };
    }
    return { ok: true, message: '' };
};

export const createAppCommands = (options = {}) => {
    const debug = shouldEnableDebug(options);
    const trace = shouldEnableTrace(options);
    const commands = new Map();
    const schemas = new Map();
    const owners = new Map();

    const registerCommand = (name, handler, config = {}) => {
        const commandName = String(name || '').trim();
        if (!commandName) throw new Error('registerCommand requires a command name');
        if (typeof handler !== 'function') throw new Error(`registerCommand("${commandName}") requires a function handler`);
        if (commands.has(commandName)) throw new Error(`Command "${commandName}" is already registered`);

        const ownerValidation = validateCommandOwnerNamespace({
            commandName,
            owner: config.owner
        });
        if (!ownerValidation.ok) {
            pushTrace(trace, {
                type: 'command_owner_validation_failed',
                name: commandName,
                owner: config.owner || null,
                message: ownerValidation.message
            });
            if (debug) throw new Error(ownerValidation.message);
            console.warn(`[Coffee Dial] ${ownerValidation.message}`);
        }

        commands.set(commandName, handler);
        if (config.schema) schemas.set(commandName, config.schema);
        if (config.owner) owners.set(commandName, String(config.owner));
        pushTrace(trace, { type: 'command_registered', name: commandName, owner: owners.get(commandName) || null });
    };

    const dispatch = (name, payload = {}, meta = {}) => {
        const commandName = String(name || '').trim();
        const handler = commands.get(commandName);
        if (!handler) {
            const message = `Unknown app command "${commandName}"`;
            pushTrace(trace, { type: 'command_unknown', name: commandName, payload, meta });
            if (debug) throw new Error(message);
            console.warn(message, { payload, meta });
            return undefined;
        }

        const schema = schemas.get(commandName);
        if (schema) {
            const result = validatePayload(payload, schema);
            if (!result.ok) {
                const message = `Invalid payload for app command "${commandName}"`;
                pushTrace(trace, { type: 'command_invalid_payload', name: commandName, payload, errors: result.errors });
                if (debug) throw new Error(`${message}: ${result.errors.join(' ')}`);
                console.warn(message, result.errors, payload);
                return undefined;
            }
        }

        pushTrace(trace, {
            type: 'command_dispatch',
            name: commandName,
            owner: owners.get(commandName) || null,
            payload,
            meta
        });
        try {
            return handler(payload, meta);
        } catch (error) {
            pushTrace(trace, {
                type: 'command_failed',
                name: commandName,
                error: error?.message || String(error)
            });
            throw error;
        }
    };

    const registerCommands = (commandMap = {}, config = {}) => {
        Object.entries(commandMap || {}).forEach(([name, handler]) => {
            registerCommand(name, handler, {
                owner: config.owner,
                schema: config.schemas?.[name]
            });
        });
    };

    const getRegisteredCommands = () => Array.from(commands.keys()).sort();

    if (trace && typeof window !== 'undefined') {
        window.__coffeeDialCommandTraceMeta = {
            traceEnabled: true,
            debugEnabled: debug,
            startedAt: new Date().toISOString()
        };
        console.info('[Coffee Dial] Command tracing enabled');
    }

    return {
        debug,
        trace,
        dispatch,
        getRegisteredCommands,
        registerCommand,
        registerCommands
    };
};
