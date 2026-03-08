import { createCoffeesCoordinator } from '../../app/coordinators/coffees.coordinator.js';

export const createCoffeesController = (deps = {}) => {
    const coffees = createCoffeesCoordinator(deps);
    const appCommands = deps.appCommands;
    const ensureCardMounted = deps.ensureCardMounted || (() => Promise.resolve());
    if (!appCommands?.registerCommand) {
        throw new Error('createCoffeesController requires appCommands.registerCommand');
    }

    appCommands.registerCommand(
        'coffees.openCard',
        async ({ id, event = null } = {}) => {
            await ensureCardMounted();
            coffees.openCoffeeTypeCard(id, event);
        },
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
        async ({ id, event = null } = {}) => {
            await ensureCardMounted();
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

    // Wrap card functions to ensure HTML is mounted before accessing DOM
    const openCoffeeTypeCard = async (...args) => {
        await ensureCardMounted();
        return coffees.openCoffeeTypeCard(...args);
    };

    const openCoffeeTypeFromTableEdit = async (...args) => {
        await ensureCardMounted();
        return coffees.openCoffeeTypeFromTableEdit(...args);
    };

    return {
        ...coffees,
        openCoffeeTypeCard,
        openCoffeeTypeFromTableEdit
    };
};
