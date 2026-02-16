import { createCoffeesCoordinator } from '../../app/coordinators/coffees.coordinator.js';

export const createCoffeesController = (deps = {}) => {
    const coffees = createCoffeesCoordinator(deps);
    const appCommands = deps.appCommands;
    if (!appCommands?.registerCommand) {
        throw new Error('createCoffeesController requires appCommands.registerCommand');
    }

    appCommands.registerCommand(
        'coffees.openCard',
        ({ id, event = null } = {}) => coffees.openCoffeeTypeCard(id, event),
        {
            owner: 'coffees',
            schema: {
                id: 'string',
                event: 'object|null?'
            }
        }
    );

    appCommands.registerCommand(
        'coffees.openCardForEdit',
        ({ id, event = null } = {}) => {
            coffees.openCoffeeTypeCard(id, event);
            coffees.enterCoffeeTypeEditMode();
        },
        {
            owner: 'coffees',
            schema: {
                id: 'string',
                event: 'object|null?'
            }
        }
    );

    return coffees;
};
