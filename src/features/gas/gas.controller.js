import { createGasCoordinator } from '../../app/coordinators/gas.coordinator.js';

export const createGasController = (deps = {}) => {
    const gas = createGasCoordinator(deps);
    const appCommands = deps.appCommands;
    const ensureCardMounted = deps.ensureCardMounted || (() => Promise.resolve());
    if (!appCommands?.registerCommand) {
        throw new Error('createGasController requires appCommands.registerCommand');
    }

    appCommands.registerCommand(
        'gas.openCard',
        async ({ id, event = null } = {}) => {
            await ensureCardMounted();
            gas.openGasCard(id, event);
        },
        {
            owner: 'gas',
            schema: {
                id: 'string',
                event: 'object|null?'
            }
        }
    );

    appCommands.registerCommand(
        'gas.openCardForEdit',
        async ({ id, event = null } = {}) => {
            await ensureCardMounted();
            gas.openGasCard(id, event);
            gas.enterGasEditMode();
        },
        {
            owner: 'gas',
            schema: {
                id: 'string',
                event: 'object|null?'
            }
        }
    );

    // Wrap card functions to ensure HTML is mounted before accessing DOM
    const openGasCard = async (...args) => {
        await ensureCardMounted();
        return gas.openGasCard(...args);
    };

    const openGasFromTableEdit = async (...args) => {
        await ensureCardMounted();
        return gas.openGasFromTableEdit(...args);
    };

    const openGasMergeFromTable = async (...args) => {
        await ensureCardMounted();
        return gas.openGasMergeFromTable(...args);
    };

    const openGasBulkAddFromTable = async (...args) => {
        await ensureCardMounted();
        return gas.openGasBulkAddFromTable(...args);
    };

    return {
        ...gas,
        openGasCard,
        openGasFromTableEdit,
        openGasMergeFromTable,
        openGasBulkAddFromTable
    };
};
