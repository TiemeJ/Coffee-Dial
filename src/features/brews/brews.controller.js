export const createBrewsController = ({
    appCommands,
    openCard,
    openCardWithOrder,
    openForm,
    openFormForBean,
    refreshTable,
    showForBean,
    showForCoffeeType
}) => {
    if (!appCommands?.registerCommand) {
        throw new Error('createBrewsController requires appCommands.registerCommand');
    }

    appCommands.registerCommand(
        'brews.openCard',
        ({ id, event = null, options = {} } = {}) => openCard(id, event, options),
        {
            owner: 'brews',
            schema: {
                id: 'string',
                event: 'object|null?',
                options: 'object?'
            }
        }
    );

    appCommands.registerCommand(
        'brews.openCardWithOrder',
        ({ id, order = [], event = null, options = {} } = {}) =>
            openCardWithOrder(id, order, event, options),
        {
            owner: 'brews',
            schema: {
                id: 'string',
                order: 'array?',
                event: 'object|null?',
                options: 'object?'
            }
        }
    );

    appCommands.registerCommand(
        'brews.openForm',
        ({ event = null, options = {} } = {}) => openForm(event, options),
        {
            owner: 'brews',
            schema: {
                event: 'object|null?',
                options: 'object?'
            }
        }
    );

    appCommands.registerCommand(
        'brews.showForCoffeeType',
        ({ coffeeTypeId } = {}) => showForCoffeeType(coffeeTypeId),
        {
            owner: 'brews',
            schema: {
                coffeeTypeId: 'string'
            }
        }
    );

    appCommands.registerCommand(
        'brews.showForBean',
        ({ beanId } = {}) => showForBean(beanId),
        {
            owner: 'brews',
            schema: {
                beanId: 'string'
            }
        }
    );

    appCommands.registerCommand(
        'brews.openFormForBean',
        ({ beanId, event = null } = {}) => openFormForBean(beanId, event),
        {
            owner: 'brews',
            schema: {
                beanId: 'string',
                event: 'object|null?'
            }
        }
    );

    appCommands.registerCommand(
        'brews.refreshTable',
        () => refreshTable(),
        { owner: 'brews' }
    );
};
