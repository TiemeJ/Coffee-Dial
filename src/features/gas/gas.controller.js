import { createGasCoordinator } from '../../app/coordinators/gas.coordinator.js';

export const createGasController = (deps = {}) => {
    const gas = createGasCoordinator(deps);
    const appCommands = deps.appCommands;
    if (!appCommands?.registerCommand) {
        throw new Error('createGasController requires appCommands.registerCommand');
    }

    appCommands.registerCommand(
        'gas.openCard',
        ({ id, event = null } = {}) => gas.openGasCard(id, event),
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
        ({ id, event = null } = {}) => {
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

    return gas;
};
