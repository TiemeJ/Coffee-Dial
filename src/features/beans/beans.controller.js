import { createBeansCoordinator } from '../../app/coordinators/beans.coordinator.js';

export const createBeansController = (deps = {}) => {
    const beans = createBeansCoordinator(deps);
    const appCommands = deps.appCommands;
    const ensureCardMounted = deps.ensureCardMounted || (() => Promise.resolve());
    if (!appCommands?.registerCommand) {
        throw new Error('createBeansController requires appCommands.registerCommand');
    }
    const openCard = async (beanId, event = null, keepNavigationOrder = false) => {
        await ensureCardMounted();
        beans.openCard(beanId, event, keepNavigationOrder);
    };
    const openCardForEdit = async (beanId, event = null) => {
        await openCard(beanId, event, false);
        beans.enterBeanEditMode();
    };

    appCommands.registerCommand(
        'beans.openCard',
        ({ beanId, event = null, keepNavigationOrder = false } = {}) =>
            openCard(beanId, event, keepNavigationOrder),
        {
            owner: 'beans',
            schema: {
                beanId: 'string',
                event: 'object|null?',
                keepNavigationOrder: 'boolean?'
            }
        }
    );

    appCommands.registerCommand(
        'beans.openCardWithOrder',
        async ({ beanId, order = [], event = null } = {}) => {
            await ensureCardMounted();
            beans.openCardWithOrder(beanId, order, event);
        },
        {
            owner: 'beans',
            schema: {
                beanId: 'string',
                order: 'array?',
                event: 'object|null?'
            }
        }
    );

    appCommands.registerCommand(
        'beans.openCardForEdit',
        ({ beanId, event = null } = {}) => openCardForEdit(beanId, event),
        {
            owner: 'beans',
            schema: {
                beanId: 'string',
                event: 'object|null?'
            }
        }
    );

    appCommands.registerCommand(
        'beans.showForCoffeeType',
        ({ coffeeTypeId } = {}) => {
            beans.openBeans();
            beans.clearBeansSearch();
            beans.clearBeansFilters();
            beans.applyBeansFilterFromQuick('coffeeType', coffeeTypeId);
        },
        {
            owner: 'beans',
            schema: {
                coffeeTypeId: 'string'
            }
        }
    );

    appCommands.registerCommand(
        'beans.archiveIfStockDepleted',
        ({ beanId, brew, existingBrewId = null } = {}) =>
            beans.archiveBeanIfStockDepleted({ beanId, brew, existingBrewId }),
        {
            owner: 'beans',
            schema: {
                beanId: 'string',
                brew: 'object',
                existingBrewId: 'string|null?'
            }
        }
    );

    appCommands.registerCommand(
        'beans.updateStockForBean',
        ({ beanId, extraBrews = [] } = {}) =>
            beans.updateBeansLeftForBean(beanId, extraBrews),
        {
            owner: 'beans',
            schema: {
                beanId: 'string',
                extraBrews: 'array?'
            }
        }
    );

    appCommands.registerCommand(
        'beans.showCoffeeTypeCreatedToast',
        ({ coffeeTypeId } = {}) => beans.showCoffeeTypeCreatedToast(coffeeTypeId),
        {
            owner: 'beans',
            schema: {
                coffeeTypeId: 'string'
            }
        }
    );

    appCommands.registerCommand(
        'beans.showBeanCreatedToast',
        ({ beanId, roaster = '', farmer = '' } = {}) =>
            beans.showBeanCreatedToast({ beanId, roaster, farmer }),
        {
            owner: 'beans',
            schema: {
                beanId: 'string',
                roaster: 'string?',
                farmer: 'string?'
            }
        }
    );

    return beans;
};
