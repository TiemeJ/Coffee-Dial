export const createActionsRegistry = ({
    commonActions = {},
    brewActions = {},
    beanActions = {},
    coffeeActions = {},
    gasActions = {},
    uiActions = {},
    systemActions = {}
} = {}) => ({
    ...commonActions,
    ...brewActions,
    ...beanActions,
    ...coffeeActions,
    ...gasActions,
    ...uiActions,
    ...systemActions
});
