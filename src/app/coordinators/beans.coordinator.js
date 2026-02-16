import { createNotificationUxModule } from '../../core/notify.js';
import { createBeansTableModule } from '../../features/beans/beans-table.js';
import { createBeansActionsModule } from '../../features/beans/beans-actions.js';
import { createBeansMaintenanceModule } from '../../features/beans/beans-maintenance.js';
import { createBeansStockServiceModule } from '../../features/beans/beans-stock.service.js';
import { createBeansStockControllerModule } from '../../features/beans/beans-stock.controller.js';
import { createBeansCardActionsModule } from '../../features/beans/beans-card-actions.js';
import { createBeansCardFormModule } from '../../features/beans/beans-card-form.js';
import { createBeansCardPhotoModule } from '../../features/beans/beans-card-photo.js';
import { createBeansCardUiModule } from '../../features/beans/beans-card-ui.js';

export const createBeansCoordinator = ({
    dataService,
    storageService,
    imageCompression,
    getCurrentUser,
    getCurrentView,
    getCoffees,
    getBeans,
    setBeansState,
    getCoffeeTypes,
    getBeansSearch,
    setBeansSearchState,
    getBeansFilters,
    setBeansFiltersState,
    getHasLoadedBeans,
    getHasLoadedBrews,
    getCurrentBeanCardId,
    setCurrentBeanCardId,
    getRoastBadge,
    getBeanCoffeeTypeDisplay,
    getCoffeeTypeForBean,
    updateCoffeeTypeSelectors,
    openAppConfirm,
    appCommands = null,
    appEvents = null
}) => {
    const dispatchCommand = (commandName, payload) => {
        if (!appCommands?.dispatch) return undefined;
        return appCommands.dispatch(commandName, payload, { source: 'beans.coordinator' });
    };
    const publishEvent = (eventName, payload) => {
        if (!appEvents?.publish) return;
        appEvents.publish(eventName, payload, { source: 'beans.coordinator' });
    };
    const beansStockService = createBeansStockServiceModule();
    const computeBeansLeft = (bean, brews = getCoffees()) => beansStockService.computeBeansLeft(bean, brews);
    const getBeanCalculatedStock = (bean, brews = getCoffees()) => beansStockService.getBeanCalculatedStock(bean, brews);
    const getRemainingStockAfterBrew = (bean, brew, existingBrewId = null, brews = getCoffees()) =>
        beansStockService.getRemainingStockAfterBrew(bean, brew, existingBrewId, brews);
    const getFirstBrewDateForBean = (beanId, brew = null, existingBrewId = null, brews = getCoffees()) =>
        beansStockService.getFirstBrewDateForBean(beanId, brew, existingBrewId, brews);

    let renderBeansTable = () => {};
    let openCard = () => {};
    let closeBeans = () => {};
    let closeBeanCard = () => {};
    let enterBeanEditMode = () => {};
    let cancelBeanEditMode = () => {};
    let toggleBeanFrozen = () => {};
    let toggleBeanArchive = () => {};
    let deleteBean = () => {};
    let openNewBag = () => {};

    const {
        showAutoArchiveToast,
        closeAutoArchiveToast,
        handleAutoArchiveToastAction,
        showCoffeeTypeCreatedToast,
        closeCoffeeTypeCreatedToast,
        showBeanCreatedToast,
        closeBeanCreatedToast,
        handleBeanCreatedToastAction
    } = createNotificationUxModule({
        getCoffeeTypes: () => getCoffeeTypes(),
        onAutoArchiveUnarchive: async (beanId) => toggleBeanArchive(beanId, true),
        onAutoArchiveOpen: async (beanId) => openNewBag(beanId, { openCard: true, editAfter: true }),
        onBeanCreatedEdit: async (beanId) => {
            openCard(beanId);
            enterBeanEditMode();
        }
    });

    const {
        updateBeansLeftForBean,
        maybeMigrateBeansLeft,
        recalculateAllBeanStockLeft,
        archiveBeanIfStockDepleted
    } = createBeansStockControllerModule({
        dataService,
        getCurrentUser: () => getCurrentUser(),
        getBeans: () => getBeans(),
        setBeansState: (value) => setBeansState(value),
        getCoffees: () => getCoffees(),
        getHasLoadedBeans: () => getHasLoadedBeans(),
        getHasLoadedBrews: () => getHasLoadedBrews(),
        getCurrentBeanCardId: () => getCurrentBeanCardId(),
        renderBeansTable: (...args) => renderBeansTable(...args),
        dispatchCommand,
        computeBeansLeft: (...args) => computeBeansLeft(...args),
        getRemainingStockAfterBrew: (...args) => getRemainingStockAfterBrew(...args),
        showAutoArchiveToast: (...args) => showAutoArchiveToast(...args)
    });

    const getBeanTableOrder = () => {
        const beansWithStock = getBeans().map((bean) => ({ ...bean, calculatedStock: getBeanCalculatedStock(bean) }));
        const inStockBeans = beansWithStock
            .filter((b) => !b.archived && !b.frozen && b.calculatedStock !== null && b.calculatedStock > 0)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const frozenBeans = beansWithStock
            .filter((b) => !b.archived && b.frozen)
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const otherBeans = beansWithStock
            .filter((b) => b.archived || (!b.frozen && (b.calculatedStock === null || b.calculatedStock <= 0)))
            .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        return [...inStockBeans, ...frozenBeans, ...otherBeans].map((b) => b.id);
    };

    const { showBrewsForBean, showCoffeeForBean, openBrewWithBean } = createBeansCardActionsModule({
        getCurrentView: () => getCurrentView(),
        getCurrentBeanCardId: () => getCurrentBeanCardId(),
        getBeans: () => getBeans(),
        closeBeanCard: (...args) => closeBeanCard(...args),
        closeBeans: (...args) => closeBeans(...args),
        dispatchCommand,
        publishEvent
    });

    const beansCardForm = createBeansCardFormModule({
        dataService,
        getCurrentUser: () => getCurrentUser(),
        getCurrentView: () => getCurrentView(),
        getCurrentBeanCardId: () => getCurrentBeanCardId(),
        getBeans: () => getBeans(),
        getCoffeeTypes: () => getCoffeeTypes(),
        setBeansState: (value) => setBeansState(value),
        computeBeansLeft: (...args) => computeBeansLeft(...args),
        updateCoffeeTypeSelectors: (...args) => updateCoffeeTypeSelectors(...args),
        dispatchCommand
    });
    enterBeanEditMode = beansCardForm.enterBeanEditMode;
    cancelBeanEditMode = beansCardForm.cancelBeanEditMode;

    const beansCardUi = createBeansCardUiModule({
        getBeans: () => getBeans(),
        getCoffeeTypeForBean: (...args) => getCoffeeTypeForBean(...args),
        getCurrentView: () => getCurrentView(),
        getCurrentBeanCardId: () => getCurrentBeanCardId(),
        setCurrentBeanCardId: (value) => setCurrentBeanCardId(value),
        getBeanCalculatedStock: (...args) => getBeanCalculatedStock(...args),
        getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
        getBeanTableOrder: (...args) => getBeanTableOrder(...args),
        openBrewWithBean: (...args) => openBrewWithBean(...args),
        deleteBean: (...args) => deleteBean(...args),
        showBrewsForBean: (...args) => showBrewsForBean(...args),
        showCoffeeForBean: (...args) => showCoffeeForBean(...args),
        enterBeanEditMode: (...args) => enterBeanEditMode(...args),
        cancelBeanEditMode: (...args) => cancelBeanEditMode(...args),
        toggleBeanFrozen: (...args) => toggleBeanFrozen(...args),
        toggleBeanArchive: (...args) => toggleBeanArchive(...args),
        dispatchCommand,
        publishEvent
    });
    openCard = beansCardUi.openCard;
    closeBeanCard = beansCardUi.closeBeanCard;

    const { triggerBeanPhoto, openBeanPhoto, removeBeanPhoto, handleBeanPhoto } = createBeansCardPhotoModule({
        dataService,
        storageService,
        getCurrentUser: () => getCurrentUser(),
        getCurrentView: () => getCurrentView(),
        getCurrentBeanCardId: () => getCurrentBeanCardId(),
        getBeans: () => getBeans(),
        setBeansState: (value) => setBeansState(value),
        imageCompression,
        dispatchCommand
    });

    const beansTable = createBeansTableModule({
        getCurrentUser: () => getCurrentUser(),
        getCurrentView: () => getCurrentView(),
        getBeans: () => getBeans(),
        getCoffeeTypes: () => getCoffeeTypes(),
        getBeansSearch: () => getBeansSearch(),
        setBeansSearchState: (value) => setBeansSearchState(value),
        getBeansFilters: () => getBeansFilters(),
        setBeansFiltersState: (value) => setBeansFiltersState(value),
        getBeanCalculatedStock: (...args) => getBeanCalculatedStock(...args),
        getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
        getRoastBadge,
        dispatchCommand,
        updateCoffeeTypeSelectors: (...args) => updateCoffeeTypeSelectors(...args)
    });
    renderBeansTable = beansTable.renderBeansTable;
    closeBeans = beansTable.closeBeans;

    const beansActions = createBeansActionsModule({
        dataService,
        getCurrentUser: () => getCurrentUser(),
        getCurrentBeanCardId: () => getCurrentBeanCardId(),
        getBeans: () => getBeans(),
        setBeansState: (value) => setBeansState(value),
        computeBeansLeft: (...args) => computeBeansLeft(...args),
        updateBeanCardActionButtons: (...args) => beansCardUi.updateBeanCardActionButtons(...args),
        dispatchCommand,
        openAppConfirm
    });
    toggleBeanArchive = beansActions.toggleBeanArchive;
    toggleBeanFrozen = beansActions.toggleBeanFrozen;
    openNewBag = beansActions.openNewBag;
    deleteBean = beansActions.deleteBean;

    const beansMaintenance = createBeansMaintenanceModule({
        dataService,
        getCurrentUser: () => getCurrentUser(),
        getBeans: () => getBeans(),
        setBeansState: (value) => setBeansState(value),
        getCoffees: () => getCoffees(),
        dispatchCommand
    });

    return {
        computeBeansLeft,
        getBeanCalculatedStock,
        getRemainingStockAfterBrew,
        getFirstBrewDateForBean,
        updateBeansLeftForBean,
        maybeMigrateBeansLeft,
        recalculateAllBeanStockLeft,
        archiveBeanIfStockDepleted,
        showAutoArchiveToast,
        closeAutoArchiveToast,
        handleAutoArchiveToastAction,
        showCoffeeTypeCreatedToast,
        closeCoffeeTypeCreatedToast,
        showBeanCreatedToast,
        closeBeanCreatedToast,
        handleBeanCreatedToastAction,
        showBrewsForBean,
        showCoffeeForBean,
        openBrewWithBean,
        setBeanEditCoffeeTypeFieldState: beansCardForm.setBeanEditCoffeeTypeFieldState,
        applyBeanEditCoffeeType: beansCardForm.applyBeanEditCoffeeType,
        enterBeanEditMode: beansCardForm.enterBeanEditMode,
        openCoffeeFromBeanEdit: beansCardForm.openCoffeeFromBeanEdit,
        cancelBeanEditMode: beansCardForm.cancelBeanEditMode,
        saveBeanCardEdits: beansCardForm.saveBeanCardEdits,
        updateBeanCardActionButtons: beansCardUi.updateBeanCardActionButtons,
        updateBeanCardNav: beansCardUi.updateBeanCardNav,
        openCard: beansCardUi.openCard,
        openCardWithOrder: beansCardUi.openCardWithOrder,
        navigateBeanCard: beansCardUi.navigateBeanCard,
        closeBeanCard: beansCardUi.closeBeanCard,
        closeBeanCardMenu: beansCardUi.closeBeanCardMenu,
        triggerBeanPhoto,
        openBeanPhoto,
        removeBeanPhoto,
        handleBeanPhoto,
        openBeans: beansTable.openBeans,
        closeBeans: beansTable.closeBeans,
        setBeansSearch: beansTable.setBeansSearch,
        clearBeansSearch: beansTable.clearBeansSearch,
        toggleBeansQuickFilter: beansTable.toggleBeansQuickFilter,
        openBeansQuickFilterValues: beansTable.openBeansQuickFilterValues,
        applyBeansFilterFromQuick: beansTable.applyBeansFilterFromQuick,
        clearBeansFilters: beansTable.clearBeansFilters,
        renderBeansActiveFilters: beansTable.renderBeansActiveFilters,
        renderBeansTable: beansTable.renderBeansTable,
        saveBeanStock: beansActions.saveBeanStock,
        toggleBeanArchive: beansActions.toggleBeanArchive,
        toggleBeanFrozen: beansActions.toggleBeanFrozen,
        openNewBag: beansActions.openNewBag,
        deleteBean: beansActions.deleteBean,
        saveBeanRoastDate: beansMaintenance.saveBeanRoastDate,
        saveBeanOpenedDate: beansMaintenance.saveBeanOpenedDate,
        saveBeanFrozenDate: beansMaintenance.saveBeanFrozenDate,
        syncLegacyBeans: beansMaintenance.syncLegacyBeans,
        backfillBeanDatesFromBrews: beansMaintenance.backfillBeanDatesFromBrews
    };
};
