        import { BAG_AI_URL, STATS_AI_URL, WEB_PUSH_VAPID_KEY, app as firebaseApp, auth, db, functions, storage, provider } from '../../config/firebase.js';
        import { signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
        import { collection, collectionGroup, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, arrayUnion, arrayRemove, onSnapshot, query, writeBatch, where, orderBy, limit, startAfter } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
        import { httpsCallable } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js';
        import { getMessaging, getToken, deleteToken, onMessage, isSupported } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js';
        import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
        import { initCoffeeScale } from '../../features/scales/scales.js';
        import { createScaleModalsModule } from '../../features/scales/scales-modals.js';
        import { parseBeanconquerorCSV, mapBeanconquerorBrews } from '../../features/import-export/importers/beanconqueror.js';
        import { initEmailLinkAuth } from '../../integrations/email-link-auth.js';
        import { closeAutoPinToast, showAutoPinToast, showToast } from '../../core/notify.js';
        import { closeAppConfirm, openAppConfirm, resolveAppConfirm, installDialogAdapters } from '../../core/confirm.js';
        import { getStarDisplay, formatBeanOpenedDate, formatTime, getRoastBadge } from '../../core/format.js';
        import { createCoffeeDisplayModule } from '../../core/coffee-display.js';
        import { createCoffeesController } from '../../features/coffees/coffees.controller.js';
        import { createGasController } from '../../features/gas/gas.controller.js';
        import { createBeansController } from '../../features/beans/beans.controller.js';
        import { createSocialCoordinator } from '../coordinators/social.coordinator.js';
        import { createGalleryModule } from '../../features/gallery.js';
        import { createStatsModule } from '../../features/stats/stats.js';
        import { createImportExportModule } from '../../features/import-export/import-export.js';
        import { createBrewsCardActionsModule } from '../../features/brews/brews-card-actions.js';
        import { createBrewsCardUiModule } from '../../features/brews/brews-card-ui.js';
        import { createBrewsCardShareModule } from '../../features/brews/brews-card-share.js';
        import { createBrewsCardGraphModule } from '../../features/brews/brews-card-graph.js';
        import { createBrewsCardPhotoModule } from '../../features/brews/brews-card-photo.js';
        import { createBrewsFormModalModule } from '../../features/brews/brews-form-modal.js';
        import { createBrewsTableStatePresetsModule } from '../../features/brews/brews-table-state-presets.js';
        import { createBrewsCoordinator, createBrewsTableCoordinator } from '../coordinators/brews.coordinator.js';
        import { createBrewsController } from '../../features/brews/brews.controller.js';
        import { createBrewsRepo } from '../../features/brews/brews.repo.js';
        import { registerBrewsFilterCommands } from '../../features/brews/brews-filter-commands.js';
        import { createBrewsPinAutopinModule } from '../../features/pin/brews-pin-autopin.js';
        import { createBrewsPreferencesModule } from '../../features/preferences.js';
        import { createPushNotificationsModule } from '../../features/push-notifications.js';
        import { createDataService } from '../services/data.service.js';
        import { createStorageService } from '../services/storage.service.js';
        import { createFunctionsService } from '../services/functions.service.js';
        import { createAuthService } from '../services/auth.service.js';
        import { createSessionAuthViewModule } from '../../features/session-auth-view.js';
        import { createAiImportModule } from '../../features/ai-import.js';
        import { createStatsAiProfileModule } from '../../features/stats/stats-ai-profile.js';
        import { createBrewFormLookupModule } from '../../features/brews/brew-form-lookup.js';
        import { createBrewFormUiModule } from '../../features/brews/brew-form-ui.js';
        import { createBrewFormActionsModule } from '../../features/brews/brew-form-actions.js';
        import { createBrewCsvRecipeModule } from '../../features/brews/brew-csv-recipe.js';
        import { createLabResultsModule } from '../../features/brews/lab-results.js';
        import { createActionMenuModule } from '../../features/ui/action-menu.js';
        import { createUiShellModule } from '../../features/ui-shell.js';
        import { createMediaModalsModule } from '../../features/media/media-modals.js';
        import { createPinCoordinator } from '../coordinators/pin.coordinator.js';
        import { createActionAssemblies } from './action-assemblies.js';
        import { createInitialAppState } from '../container.state.js';
        import { createSessionStore } from '../stores/session.store.js';
        import { createBrewsStore } from '../stores/brews.store.js';
        import { createBeansStore } from '../stores/beans.store.js';
        import { createCoffeeTypesStore } from '../stores/coffee-types.store.js';
        import { createGasStore } from '../stores/gas.store.js';
        import { createUiStore } from '../stores/ui.store.js';
        import { createRuntimeStore } from '../stores/runtime.store.js';
        import { normalizeNotificationPreferences } from '../../features/notification-preferences.js';
        import { selectVisibleBrewOrderIds } from '../stores/brews-table.selectors.js';
        import { createAuthStateChangedHandler } from '../runtime/auth-state.js';
        import { createAppLifecycleModule } from '../runtime/app-lifecycle.js';
        import { createOpenAddBrewFromPinned } from '../runtime/open-add-brew.js';
        import { installCardNavigationHandlers } from '../runtime/card-navigation.js';
        
export const createAppComposition = ({ appCommands = null, appEvents = null } = {}) => {
        const isE2ESeedMode =
            typeof window !== 'undefined' &&
            new URLSearchParams(window.location.search).get('e2eSeed') === '1';

        const emailLinkAuth = initEmailLinkAuth({ auth }) || {};
        installDialogAdapters(showToast);
        
        const initialState = createInitialAppState();
        const columnDefs = initialState.columnDefs;
        const scaData = initialState.scaData;
        const BREWS_PER_PAGE = initialState.BREWS_PER_PAGE;
        const sessionStore = createSessionStore({
            currentUser: initialState.currentUser,
            currentView: initialState.currentView
        });
        const brewsStore = createBrewsStore({ items: initialState.coffees });
        const beansStore = createBeansStore({ items: initialState.beans });
        const coffeeTypesStore = createCoffeeTypesStore({ items: initialState.coffeeTypes });
        const gasStore = createGasStore({ items: initialState.gasItems });
        const uiStore = createUiStore({
            pinnedBrewsPreferences: initialState.pinnedBrewsPreferences,
            currentSort: initialState.currentSort,
            activeFilters: initialState.activeFilters,
            displayedBrewsCount: initialState.displayedBrewsCount
        });
        const runtimeStore = createRuntimeStore({
            unsubscribeData: initialState.unsubscribeData,
            unsubscribeBeans: initialState.unsubscribeBeans,
            unsubscribeCoffeeTypes: initialState.unsubscribeCoffeeTypes,
            unsubscribeGas: initialState.unsubscribeGas,
            unsubscribeNotifications: initialState.unsubscribeNotifications,
            hasLoadedBrews: initialState.hasLoadedBrews,
            hasLoadedBeans: initialState.hasLoadedBeans,
            isPublic: initialState.isPublic,
            lastGalleryVisit: initialState.lastGalleryVisit,
            beansSearch: initialState.beansSearch,
            beansFilters: initialState.beansFilters,
            notificationPrefs: initialState.notificationPrefs,
            beansSortKey: initialState.beansSortKey,
            beansSortDir: initialState.beansSortDir,
            currentBeanCardId: initialState.currentBeanCardId,
            currentCoffeeTypeId: initialState.currentCoffeeTypeId,
            coffeeTypesSearch: initialState.coffeeTypesSearch,
            coffeeTypesFilters: initialState.coffeeTypesFilters,
            coffeeTypesSortKey: initialState.coffeeTypesSortKey,
            coffeeTypesSortDir: initialState.coffeeTypesSortDir,
            currentGasId: initialState.currentGasId,
            gasSearch: initialState.gasSearch,
            gasFilters: initialState.gasFilters,
            gasSortKey: initialState.gasSortKey,
            gasSortDir: initialState.gasSortDir,
            scaState: initialState.scaState,
            following: initialState.following,
            followers: initialState.followers,
            currentUploadCoffeeId: initialState.currentUploadCoffeeId,
            currentGalleryMode: initialState.currentGalleryMode,
            lastGalleryDoc: initialState.lastGalleryDoc,
            isGalleryLoading: initialState.isGalleryLoading,
            currentStatsData: initialState.currentStatsData,
            currentBeanMeterPeriod: initialState.currentBeanMeterPeriod,
            pendingImportBrews: initialState.pendingImportBrews,
            currentCardCoffee: initialState.currentCardCoffee,
            currentCoffeeCardId: initialState.currentCoffeeCardId,
            currentCardGraphData: initialState.currentCardGraphData,
            currentShareMode: initialState.currentShareMode,
            columnPreferences: initialState.columnPreferences
        });

        // Session store
        const getCurrentUserState = () => sessionStore.getCurrentUser();
        const setCurrentUserState = (value) => sessionStore.setCurrentUser(value);
        const getCurrentViewState = () => sessionStore.getCurrentView();
        const setCurrentViewState = (value) => sessionStore.setCurrentView(value);

        // Domain entity stores
        const getCoffeesState = () => brewsStore.getItems();
        const setCoffeesState = (value) => brewsStore.setItems(value);
        const getBeansState = () => beansStore.getItems();
        const setBeansState = (value) => beansStore.setItems(value);
        const getCoffeeTypesState = () => coffeeTypesStore.getItems();
        const setCoffeeTypesState = (value) => coffeeTypesStore.setItems(value);
        const getGasItemsState = () => gasStore.getItems();
        const setGasItemsState = (value) => gasStore.setItems(value);

        // UI store
        const getPinnedBrewsPreferencesState = () => uiStore.getPinnedBrewsPreferences();
        const setPinnedBrewsPreferencesState = (value) => uiStore.setPinnedBrewsPreferences(value);
        const getCurrentSortState = () => uiStore.getCurrentSort();
        const setCurrentSortState = (value) => uiStore.setCurrentSort(value);
        const getActiveFiltersState = () => uiStore.getActiveFilters();
        const setActiveFiltersState = (value) => uiStore.setActiveFilters(value);
        const getDisplayedBrewsCountState = () => uiStore.getDisplayedBrewsCount();
        const setDisplayedBrewsCountState = (value) => uiStore.setDisplayedBrewsCount(value);

        // Runtime store
        const getRuntime = (key) => runtimeStore.get(key);
        const setRuntime = (key, value) => runtimeStore.set(key, value);

        // Runtime: subscriptions and load flags
        const setUnsubscribeDataState = (value) => setRuntime('unsubscribeData', value);
        const getUnsubscribeDataState = () => getRuntime('unsubscribeData');
        const setUnsubscribeBeansState = (value) => setRuntime('unsubscribeBeans', value);
        const getUnsubscribeBeansState = () => getRuntime('unsubscribeBeans');
        const setUnsubscribeCoffeeTypesState = (value) => setRuntime('unsubscribeCoffeeTypes', value);
        const getUnsubscribeCoffeeTypesState = () => getRuntime('unsubscribeCoffeeTypes');
        const setUnsubscribeGasState = (value) => setRuntime('unsubscribeGas', value);
        const getUnsubscribeGasState = () => getRuntime('unsubscribeGas');
        const setUnsubscribeNotificationsState = (value) => setRuntime('unsubscribeNotifications', value);
        const getUnsubscribeNotificationsState = () => getRuntime('unsubscribeNotifications');
        const getHasLoadedBrewsState = () => getRuntime('hasLoadedBrews');
        const setHasLoadedBrewsState = (value) => setRuntime('hasLoadedBrews', value);
        const getHasLoadedBeansState = () => getRuntime('hasLoadedBeans');
        const setHasLoadedBeansState = (value) => setRuntime('hasLoadedBeans', value);

        // Runtime: profile/gallery visibility
        const getIsPublicState = () => getRuntime('isPublic');
        const setIsPublicState = (value) => setRuntime('isPublic', value);
        const getLastGalleryVisitState = () => getRuntime('lastGalleryVisit');
        const setLastGalleryVisitState = (value) => setRuntime('lastGalleryVisit', value);

        // Runtime: beans/coffees/gas table UI
        const getBeansSearchState = () => getRuntime('beansSearch');
        const setBeansSearchRuntimeState = (value) => setRuntime('beansSearch', value);
        const getBeansFiltersState = () => getRuntime('beansFilters');
        const setBeansFiltersRuntimeState = (value) => setRuntime('beansFilters', value);
        const getNotificationPreferencesState = () =>
            normalizeNotificationPreferences(getRuntime('notificationPrefs'));
        const setNotificationPreferencesState = (value) =>
            setRuntime('notificationPrefs', normalizeNotificationPreferences(value));
        const getBeansSortKeyState = () => getRuntime('beansSortKey');
        const setBeansSortKeyRuntimeState = (value) => setRuntime('beansSortKey', value);
        const getBeansSortDirState = () => getRuntime('beansSortDir');
        const setBeansSortDirRuntimeState = (value) => setRuntime('beansSortDir', value);
        const getCurrentBeanCardIdState = () => getRuntime('currentBeanCardId');
        const setCurrentBeanCardIdState = (value) => setRuntime('currentBeanCardId', value);
        const getCurrentCoffeeTypeIdState = () => getRuntime('currentCoffeeTypeId');
        const setCurrentCoffeeTypeIdState = (value) => setRuntime('currentCoffeeTypeId', value);
        const getCoffeeTypesSearchState = () => getRuntime('coffeeTypesSearch');
        const setCoffeeTypesSearchRuntimeState = (value) => setRuntime('coffeeTypesSearch', value);
        const getCoffeeTypesFiltersState = () => getRuntime('coffeeTypesFilters');
        const setCoffeeTypesFiltersRuntimeState = (value) => setRuntime('coffeeTypesFilters', value);
        const getCoffeeTypesSortKeyState = () => getRuntime('coffeeTypesSortKey');
        const setCoffeeTypesSortKeyRuntimeState = (value) => setRuntime('coffeeTypesSortKey', value);
        const getCoffeeTypesSortDirState = () => getRuntime('coffeeTypesSortDir');
        const setCoffeeTypesSortDirRuntimeState = (value) => setRuntime('coffeeTypesSortDir', value);
        const getCurrentGasIdState = () => getRuntime('currentGasId');
        const setCurrentGasIdState = (value) => setRuntime('currentGasId', value);
        const getGasSearchState = () => getRuntime('gasSearch');
        const setGasSearchRuntimeState = (value) => setRuntime('gasSearch', value);
        const getGasFiltersState = () => getRuntime('gasFilters');
        const setGasFiltersRuntimeState = (value) => setRuntime('gasFilters', value);
        const getGasSortKeyState = () => getRuntime('gasSortKey');
        const setGasSortKeyRuntimeState = (value) => setRuntime('gasSortKey', value);
        const getGasSortDirState = () => getRuntime('gasSortDir');
        const setGasSortDirRuntimeState = (value) => setRuntime('gasSortDir', value);

        // Runtime: form and social state
        const getScaStateRuntime = () => getRuntime('scaState');
        const setScaStateRuntime = (value) => setRuntime('scaState', value);
        const getFollowingState = () => getRuntime('following');
        const setFollowingRuntimeState = (value) => setRuntime('following', value);
        const setFollowersRuntimeState = (value) => setRuntime('followers', value);

        // Runtime: gallery and stats state
        const getCurrentUploadCoffeeIdState = () => getRuntime('currentUploadCoffeeId');
        const setCurrentUploadCoffeeIdState = (value) => setRuntime('currentUploadCoffeeId', value);
        const getCurrentGalleryModeState = () => getRuntime('currentGalleryMode');
        const setCurrentGalleryModeState = (value) => setRuntime('currentGalleryMode', value);
        const getLastGalleryDocState = () => getRuntime('lastGalleryDoc');
        const setLastGalleryDocState = (value) => setRuntime('lastGalleryDoc', value);
        const getIsGalleryLoadingState = () => getRuntime('isGalleryLoading');
        const setIsGalleryLoadingState = (value) => setRuntime('isGalleryLoading', value);
        const getCurrentStatsDataState = () => getRuntime('currentStatsData');
        const setCurrentStatsDataState = (value) => setRuntime('currentStatsData', value);
        const getCurrentBeanMeterPeriodState = () => getRuntime('currentBeanMeterPeriod');
        const setCurrentBeanMeterPeriodState = (value) => setRuntime('currentBeanMeterPeriod', value);
        const getPendingImportBrewsState = () => getRuntime('pendingImportBrews');
        const setPendingImportBrewsState = (value) => setRuntime('pendingImportBrews', value);

        // Runtime: card/modal context
        const getCurrentCardCoffeeState = () => getRuntime('currentCardCoffee');
        const setCurrentCardCoffeeState = (value) => setRuntime('currentCardCoffee', value);
        const getCurrentCoffeeCardIdState = () => getRuntime('currentCoffeeCardId');
        const setCurrentCoffeeCardIdState = (value) => setRuntime('currentCoffeeCardId', value);
        const getCurrentCardGraphDataState = () => getRuntime('currentCardGraphData');
        const setCurrentCardGraphDataState = (value) => setRuntime('currentCardGraphData', value);
        const getCurrentShareModeState = () => getRuntime('currentShareMode');
        const setCurrentShareModeState = (value) => setRuntime('currentShareMode', value);

        // Runtime: table preferences
        const getColumnPreferencesState = () => getRuntime('columnPreferences');
        const setColumnPreferencesState = (value) => setRuntime('columnPreferences', value);
        const dispatchBrewOpenForm = (event = null, options = {}) =>
            appCommands?.dispatch?.(
                'brews.openForm',
                { event, options },
                { source: 'container.brewsOpenForm' }
            );
        const dataService = createDataService({
            db,
            collection,
            collectionGroup,
            doc,
            setDoc,
            addDoc,
            updateDoc,
            deleteDoc,
            getDoc,
            getDocs,
            arrayUnion,
            arrayRemove,
            onSnapshot,
            query,
            where,
            orderBy,
            limit,
            startAfter,
            writeBatch
        });
        const storageService = createStorageService({
            storage,
            ref,
            uploadBytes,
            getDownloadURL,
            deleteObject
        });
        const functionsService = createFunctionsService({
            functions,
            httpsCallable
        });
        const pushNotifications = createPushNotificationsModule({
            dataService,
            messagingApi: {
                app: firebaseApp,
                getMessaging,
                getToken,
                deleteToken,
                onMessage,
                isSupported
            },
            getCurrentUser: () => getCurrentUserState(),
            getNotificationPreferences: () => getNotificationPreferencesState(),
            vapidKey: WEB_PUSH_VAPID_KEY,
            showToast
        });
        const createE2EBrewsRepo = () => {
            let e2eIdCounter = 1;
            const nextId = (prefix) => `${prefix}-${Date.now()}-${e2eIdCounter++}`;
            const requireUid = () => {
                const uid = getCurrentUserState()?.uid;
                if (!uid) throw new Error('User not signed in');
                return uid;
            };
            return {
                addBean: async (payload) => {
                    requireUid();
                    const id = nextId('bean');
                    setBeansState([...getBeansState(), { id, ...payload }]);
                    return id;
                },
                addCoffee: async (payload) => {
                    requireUid();
                    const id = nextId('brew');
                    setCoffeesState([...getCoffeesState(), { id, ...payload }]);
                    return id;
                },
                addCoffeeType: async (payload) => {
                    requireUid();
                    const id = nextId('coffee-type');
                    setCoffeeTypesState([...getCoffeeTypesState(), { id, ...payload }]);
                    return id;
                },
                deleteCoffee: async (id) => {
                    requireUid();
                    setCoffeesState(getCoffeesState().filter((item) => item.id !== id));
                },
                updateBean: async (id, patch) => {
                    requireUid();
                    setBeansState(getBeansState().map((item) => (item.id === id ? { ...item, ...patch } : item)));
                },
                updateCoffee: async (id, patch) => {
                    requireUid();
                    setCoffeesState(getCoffeesState().map((item) => (item.id === id ? { ...item, ...patch } : item)));
                }
            };
        };

        const brewsRepo = isE2ESeedMode
            ? createE2EBrewsRepo()
            : createBrewsRepo({
                  dataService,
                  getCurrentUser: () => getCurrentUserState()
              });
        const authService = createAuthService({
            auth,
            provider,
            signInWithPopup,
            signOut
        });
        const {
            clearSearch,
            getFilterLabel,
            updateBrewSortIcons,
            sortBy,
            openFilterMenu,
            applyFilter,
            clearAllFilters,
            renderActiveFilters,
            toggleQuickFilter,
            setBrewsTableStatePresetApi,
            openQuickFilterValues,
            applyFilterFromQuick,
            getFilteredCoffees,
            getTempBadge,
            refreshTableData,
            renderTable,
            loadMoreBrews,
            columnPreferencesKey,
            loadColumnPreferencesFromStorage,
            saveColumnPreferencesToStorage,
            openBrewsTablePrefs,
            hideBrewsTablePrefsModal
        } = createBrewsTableCoordinator({
            tableDeps: {
                getCoffees: () => getCoffeesState(),
                getBeans: () => getBeansState(),
                getCoffeeTypes: () => getCoffeeTypesState(),
                getGasItems: () => getGasItemsState(),
                getCurrentView: () => getCurrentViewState(),
                getCurrentSort: () => getCurrentSortState(),
                setCurrentSort: (value) => setCurrentSortState(value),
                getActiveFilters: () => getActiveFiltersState(),
                setActiveFilters: (value) => setActiveFiltersState(value),
                getDisplayedBrewsCount: () => getDisplayedBrewsCountState(),
                setDisplayedBrewsCount: (value) => setDisplayedBrewsCountState(value),
                getBrewsPerPage: () => BREWS_PER_PAGE,
                getColumnDefs: () => columnDefs,
                getColumnPreferences: () => getColumnPreferencesState(),
                setColumnPreferences: (value) => setColumnPreferencesState(value),
                getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
                getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
                getCoffeeTypeForBrew: (...args) => getCoffeeTypeForBrew(...args),
                getStarDisplay,
                formatBeanOpenedDate,
                formatTime,
                dispatchCommand: (commandName, payload) =>
                    appCommands?.dispatch?.(
                        commandName,
                        payload,
                        { source: 'brews.table' }
                    ),
                changeView: (...args) => changeView(...args)
            },
            tablePrefDeps: {
                columnDefs,
                getColumnPreferences: () => getColumnPreferencesState(),
                setColumnPreferences: (value) => setColumnPreferencesState(value)
            }
        });
        const {
            toggleBrewsTableStateMenu,
            closeBrewsTableStateMenu,
            saveCurrentBrewsTableState,
            saveBrewsTableStatePresetByName,
            loadBrewsTableStatePreset,
            deleteBrewsTableStatePreset,
            listBrewsTableStatePresets
        } = createBrewsTableStatePresetsModule({
            getCurrentUser: () => getCurrentUserState(),
            dataService,
            getCurrentSort: () => getCurrentSortState(),
            setCurrentSort: (value) => setCurrentSortState(value),
            getActiveFilters: () => getActiveFiltersState(),
            setActiveFilters: (value) => setActiveFiltersState(value),
            getCurrentView: () => getCurrentViewState(),
            setDisplayedBrewsCount: (value) => setDisplayedBrewsCountState(value),
            getBrewsPerPage: () => BREWS_PER_PAGE,
            renderTable: (...args) => renderTable(...args),
            renderActiveFilters: (...args) => renderActiveFilters(...args),
            updateBrewSortIcons: (...args) => updateBrewSortIcons(...args)
        });
        setBrewsTableStatePresetApi({
            list: (...args) => listBrewsTableStatePresets(...args),
            saveByName: (...args) => saveBrewsTableStatePresetByName(...args),
            load: (...args) => loadBrewsTableStatePreset(...args),
            remove: (...args) => deleteBrewsTableStatePreset(...args)
        });

        const {
            applyAnimationPreference,
            openPreferences
        } = createBrewsPreferencesModule({
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            setPinnedBrewsPreferences: (value) => setPinnedBrewsPreferencesState(value),
            getNotificationPreferences: () => getNotificationPreferencesState(),
            setNotificationPreferences: (value) => setNotificationPreferencesState(value),
            getCurrentUser: () => getCurrentUserState(),
            dataService,
            applyAnimationClass: (...args) => applyAnimationClass(...args),
            renderTable: (...args) => renderTable(...args),
            renderPinnedTiles: (...args) => renderPinnedTiles(...args),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'preferences' }),
            openAppConfirm,
            showAutoPinToast,
            onPinnedBrewsPreferencesChanged: () => {
                const currentCard = getCurrentCardCoffeeState();
                if (currentCard) updateCoffeeCardActionMenu?.(currentCard);
                renderCoffeeTypesTable?.();
                renderGasTable?.();
            },
            onNotificationPreferencesChanged: async (nextPrefs = null, options = {}) => {
                try {
                    return await pushNotifications.handlePreferencesChanged(nextPrefs, options);
                } catch (error) {
                    console.error('Failed applying push notification preference change:', error);
                    return { ok: false, reason: 'error', error: error?.message || String(error) };
                }
            }
        });

        const applyAnimationClass = (enabled) => {
            document.documentElement.classList.toggle('no-animations', !enabled);
        };

        const {
            autoPinOpenBagsIfEnabled,
            autoUnpinClosedBagsIfEnabled
        } = createBrewsPinAutopinModule({
            getCurrentUser: () => getCurrentUserState(),
            getBeans: () => getBeansState(),
            getCoffees: () => getCoffeesState(),
            getBeanCalculatedStock: (...args) => getBeanCalculatedStock(...args),
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            dataService
        });

        const coffeeScale = initCoffeeScale({
            openScaleModal: () => {
                const connectModal = document.getElementById('connectScaleModal');
                if (connectModal) openConnectScaleModal();
                else openCoffeeScaleModal();
            }
        });

        // --- Functions ---
        
        const {
            triggerAIScan,
            toggleAiMenu,
            toggleBeansAiMenu,
            toggleCoffeeTypesAiMenu,
            triggerBeansAIScan,
            triggerCoffeeTypesAIScan,
            handleAIFile,
            uploadPendingCoffeeTypeImage,
            clearPendingAIBeanImageFile,
            handleBeansAIFile,
            handleCoffeeTypesAIFile
        } = createAiImportModule({
            BAG_AI_URL,
            imageCompression,
            getCurrentUser: () => getCurrentUserState(),
            toggleForm: (...args) => toggleForm(...args),
            dataService,
            storageService,
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'ai-import' }),
            getCoffeeTypes: () => getCoffeeTypesState(),
            setCoffeeTypes: (value) => setCoffeeTypesState(value),
            openCoffeeTypeCard: (...args) => openCoffeeTypeCard(...args),
            enterCoffeeTypeEditMode: (...args) => enterCoffeeTypeEditMode(...args)
        });

        const { triggerAIProfile } = createStatsAiProfileModule({
            STATS_AI_URL,
            getCurrentStatsData: () => getCurrentStatsDataState(),
            getCurrentUser: () => getCurrentUserState()
        });
        let refreshBrewGearSelectors = () => {};

        const {
            googleLogin,
            googleLogout,
            initUserData,
            markOnboardingSeen,
            changeView,
            initNotificationListener,
            setOutgoingFriendRequestsProcessor,
            clearViewSubscriptions,
            clearNotificationSubscription
        } = createSessionAuthViewModule({
            authService,
            dataService,
            getCurrentUser: () => getCurrentUserState(),
            setCurrentView: (value) => setCurrentViewState(value),
            syncFriendViewSelectValues: (...args) => syncFriendViewSelectValues(...args),
            getUnsubscribeData: () => getUnsubscribeDataState(),
            setUnsubscribeData: (value) => setUnsubscribeDataState(value),
            getUnsubscribeBeans: () => getUnsubscribeBeansState(),
            setUnsubscribeBeans: (value) => setUnsubscribeBeansState(value),
            getUnsubscribeCoffeeTypes: () => getUnsubscribeCoffeeTypesState(),
            setUnsubscribeCoffeeTypes: (value) => setUnsubscribeCoffeeTypesState(value),
            getUnsubscribeGas: () => getUnsubscribeGasState(),
            setUnsubscribeGas: (value) => setUnsubscribeGasState(value),
            getUnsubscribeNotifications: () => getUnsubscribeNotificationsState(),
            setUnsubscribeNotifications: (value) => setUnsubscribeNotificationsState(value),
            setHasLoadedBrews: (value) => setHasLoadedBrewsState(value),
            setHasLoadedBeans: (value) => setHasLoadedBeansState(value),
            toggleForm: (...args) => toggleForm(...args),
            getCurrentSort: () => getCurrentSortState(),
            setCoffees: (value) => setCoffeesState(value),
            getCoffees: () => getCoffeesState(),
            setBeans: (value) => setBeansState(value),
            setCoffeeTypes: (value) => setCoffeeTypesState(value),
            setGasItems: (value) => setGasItemsState(value),
            renderPinnedTiles: (...args) => renderPinnedTiles(...args),
            renderTable: (...args) => renderTable(...args),
            updateAutocompleteLists: (...args) => updateAutocompleteLists(...args),
            updateBeanDropdown: (...args) => updateBeanDropdown(...args),
            renderBeansTable: (...args) => renderBeansTable(...args),
            updateCoffeeTypeSelectors: (...args) => updateCoffeeTypeSelectors(...args),
            renderCoffeeTypesTable: (...args) => renderCoffeeTypesTable(...args),
            renderGasTable: (...args) => renderGasTable(...args),
            getColumnPreferencesKey: () => columnPreferencesKey,
            getColumnPreferences: () => getColumnPreferencesState(),
            loadColumnPreferencesFromStorage: (...args) => loadColumnPreferencesFromStorage(...args),
            saveColumnPreferencesToStorage: (...args) => saveColumnPreferencesToStorage(...args),
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            setPinnedBrewsPreferences: (value) => setPinnedBrewsPreferencesState(value),
            applyAnimationPreference: (...args) => applyAnimationPreference(...args),
            setIsPublic: (value) => setIsPublicState(value),
            updatePublicToggleUI: (...args) => updatePublicToggleUI(...args),
            getCoffeeScale: () => coffeeScale,
            refreshBrewGearSelectors: () => refreshBrewGearSelectors(),
            getLastGalleryVisit: () => getLastGalleryVisitState(),
            setLastGalleryVisit: (value) => setLastGalleryVisitState(value),
            getNotificationPreferences: () => getNotificationPreferencesState(),
            setNotificationPreferences: (value) => setNotificationPreferencesState(value)
        });

        const {
            openHelp,
            closeHelp,
            openAbout,
            closeAbout,
            openEasterEgg,
            closeEasterEgg,
            closeMenus,
            initGlobalCloseHandlers,
            toggleMainMenu,
            handleEscapeKey
        } = createUiShellModule({
            persistOnboardingSeen: () => markOnboardingSeen(),
            closeModal: (...args) => closeModal(...args),
            closeCardGraphModal: (...args) => closeCardGraphModal(...args),
            closeGraphModal: (...args) => closeGraphModal(...args),
            closeCoffeeCard: (...args) => closeCoffeeCard(...args),
            closeStats: (...args) => closeStats(...args),
            closeImportExportModal: (...args) => closeImportExportModal(...args),
            closeUploadModal: (...args) => closeUploadModal(...args),
            closeCoffeeTypeCard: (...args) => closeCoffeeTypeCard(...args),
            closeBeanCard: (...args) => closeBeanCard(...args),
            closeGasCard: (...args) => closeGasCard(...args),
            closeLightbox: (...args) => closeLightbox?.(...args),
            closeCoffeeTypes: (...args) => closeCoffeeTypes(...args),
            closeBeans: (...args) => closeBeans(...args),
            closeGasList: (...args) => closeGasList(...args),
            closeCoffeeScaleModal: (...args) => closeCoffeeScaleModal(...args),
            closeConnectScaleModal: (...args) => closeConnectScaleModal(...args)
        });
        initGlobalCloseHandlers();

        const {
            updateBeanDropdown,
            updateCoffeeTypeSelectors,
            fillBeanDetails,
            updateAutocompleteLists
        } = createBrewFormLookupModule({
            getBeans: () => getBeansState(),
            getCoffeeTypes: () => getCoffeeTypesState(),
            getCoffees: () => getCoffeesState(),
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            updateCoffeeDetailsTitle: (...args) => updateCoffeeDetailsTitle(...args)
        });

        const parseNum = (v) => (v === '' || v === null || isNaN(v)) ? null : parseFloat(v);
        const {
            bindMethodOtherChangeListener,
            openSelectedBeanForEdit,
            toggleDrinkOther,
            toggleMethodOther
        } = createBrewFormActionsModule({
            dispatchCommand: (commandName, payload, meta) =>
                appCommands?.dispatch?.(commandName, payload, meta),
            applyGraphTogglePrefsForMethod: () => coffeeScale?.applyGraphTogglePrefsForMethod?.()
        });
        bindMethodOtherChangeListener();
        const {
            computeBeansLeft,
            getBeanCalculatedStock,
            getRemainingStockAfterBrew,
            getFirstBrewDateForBean,
            updateBeansLeftForBean,
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
            setBeanEditCoffeeTypeFieldState,
            applyBeanEditCoffeeType,
            enterBeanEditMode,
            openCoffeeFromBeanEdit,
            cancelBeanEditMode,
            saveBeanCardEdits,
            updateBeanCardActionButtons,
            updateBeanCardNav,
            openCard: openBeanCardImpl,
            openCardWithOrder: openBeanCardWithOrderImpl,
            navigateBeanCard,
            closeBeanCard,
            closeBeanCardMenu,
            triggerBeanPhoto,
            openBeanPhoto,
            removeBeanPhoto,
            handleBeanPhoto,
            openBeans,
            closeBeans,
            setBeansSearch,
            clearBeansSearch,
            toggleBeansQuickFilter,
            openBeansQuickFilterValues,
            applyBeansFilterFromQuick,
            clearBeansFilters,
            renderBeansActiveFilters,
            setBeansSort,
            updateBeansSortIcons,
            getFilteredSortedBeans,
            renderBeansTable,
            createBeanFromModal,
            saveBeanPrice,
            saveBeanStock,
            toggleBeanArchive,
            toggleBeanFrozen,
            openNewBag,
            deleteBean,
            saveBeanRoastDate,
            saveBeanOpenedDate,
            saveBeanFrozenDate
        } = createBeansController({
            dataService,
            storageService,
            imageCompression,
            appCommands,
            appEvents,
            getCurrentUser: () => getCurrentUserState(),
            getCurrentView: () => getCurrentViewState(),
            getCoffees: () => getCoffeesState(),
            getBeans: () => getBeansState(),
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            setBeansState: (value) => setBeansState(value),
            getCoffeeTypes: () => getCoffeeTypesState(),
            getBeansSearch: () => getBeansSearchState(),
            setBeansSearchState: (value) => setBeansSearchRuntimeState(value),
            getBeansFilters: () => getBeansFiltersState(),
            setBeansFiltersState: (value) => setBeansFiltersRuntimeState(value),
            getBeansSortKey: () => getBeansSortKeyState(),
            setBeansSortKeyState: (value) => setBeansSortKeyRuntimeState(value),
            getBeansSortDir: () => getBeansSortDirState(),
            setBeansSortDirState: (value) => setBeansSortDirRuntimeState(value),
            getHasLoadedBeans: () => getHasLoadedBeansState(),
            getHasLoadedBrews: () => getHasLoadedBrewsState(),
            getCurrentBeanCardId: () => getCurrentBeanCardIdState(),
            setCurrentBeanCardId: (value) => setCurrentBeanCardIdState(value),
            getRoastBadge,
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            getCoffeeTypeForBean: (...args) => getCoffeeTypeForBean(...args),
            updateCoffeeTypeSelectors: (...args) => updateCoffeeTypeSelectors(...args),
            openAppConfirm,
            openLightbox: (...args) => openLightbox?.(...args)
        });
        // --- Coffee Management Functions ---
        const {
            openCoffeeTypes,
            closeCoffeeTypes,
            createCoffeeTypeFromModal,
            openCoffeeTypeShopUrl,
            openNewBagForCoffeeType,
            showBeansForCoffeeType,
            showBrewsForCoffeeType,
            updateCoffeeTypeCardNav,
            navigateCoffeeTypeCard,
            showBeansForCoffeeTypeFromTable,
            showBrewsForCoffeeTypeFromTable,
            openNewBagForCoffeeTypeFromTable,
            openCoffeeTypeFromTableEdit,
            deleteCoffeeTypeFromTable,
            deleteCoffeeType,
            triggerCoffeeTypePhoto,
            openCoffeeTypePhoto,
            removeCoffeeTypePhoto,
            handleCoffeeTypePhoto,
            openCoffeeTypeCard,
            closeCoffeeTypeCard,
            enterCoffeeTypeEditMode,
            cancelCoffeeTypeEditMode,
            saveCoffeeTypeEdits,
            closeCoffeeTypeCardMenu,
            setCoffeeTypesSearch,
            clearCoffeeTypesSearch,
            toggleCoffeeTypesQuickFilter,
            openCoffeeTypesQuickFilterValues,
            applyCoffeeTypesFilterFromQuick,
            clearCoffeeTypesFilters,
            renderCoffeeTypesActiveFilters,
            setCoffeeTypesSort,
            updateCoffeeTypesSortIcons,
            getFilteredSortedCoffeeTypes,
            renderCoffeeTypesTable
        } = createCoffeesController({
            dataService,
            storageService,
            appCommands,
            appEvents,
            getCurrentUser: () => getCurrentUserState(),
            getCurrentView: () => getCurrentViewState(),
            getCurrentCoffeeTypeId: () => getCurrentCoffeeTypeIdState(),
            setCurrentCoffeeTypeId: (value) => setCurrentCoffeeTypeIdState(value),
            getCoffees: () => getCoffeesState(),
            getCoffeeTypes: () => getCoffeeTypesState(),
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            setCoffeeTypesState: (value) => setCoffeeTypesState(value),
            getCoffeeTypesSearch: () => getCoffeeTypesSearchState(),
            setCoffeeTypesSearchState: (value) => setCoffeeTypesSearchRuntimeState(value),
            getCoffeeTypesFilters: () => getCoffeeTypesFiltersState(),
            setCoffeeTypesFiltersState: (value) => setCoffeeTypesFiltersRuntimeState(value),
            getCoffeeTypesSortKey: () => getCoffeeTypesSortKeyState(),
            setCoffeeTypesSortKeyState: (value) => setCoffeeTypesSortKeyRuntimeState(value),
            getCoffeeTypesSortDir: () => getCoffeeTypesSortDirState(),
            setCoffeeTypesSortDirState: (value) => setCoffeeTypesSortDirRuntimeState(value),
            getBeans: () => getBeansState(),
            setBeansState: (value) => setBeansState(value),
            getStarDisplay,
            openAppConfirm,
            updateCoffeeTypeSelectors,
            renderPinnedTiles: () => renderPinnedTiles(),
            openLightbox: (...args) => openLightbox?.(...args)
        });

        const {
            createGasItemFromModal,
            openGasList,
            closeGasList,
            setGasSearch,
            clearGasSearch,
            toggleGasQuickFilter,
            openGasQuickFilterValues,
            applyGasFilterFromQuick,
            clearGasFilters,
            renderGasActiveFilters,
            setGasSort,
            updateGasSortIcons,
            getFilteredSortedGasItems,
            renderGasTable,
            updateGasCardNav,
            openGasCard,
            closeGasCard,
            enterGasEditMode,
            cancelGasEditMode,
            saveGasEdits,
            toggleGasArchive,
            deleteGasItem,
            navigateGasCard,
            openGasFromTableEdit,
            openGasMergeFromTable,
            toggleGasArchiveFromTable,
            deleteGasFromTable,
            triggerGasPhoto,
            openGasPhoto,
            removeGasPhoto,
            handleGasPhoto,
            closeGasCardMenu,
            openGasMergeModal,
            closeGasMergeModal,
            mergeGasItem,
            openGasBulkAddModal,
            closeGasBulkAddModal,
            openGasBulkAddFromTable,
            bulkAddGearToBrews,
            showBrewsForGear
        } = createGasController({
            dataService,
            storageService,
            imageCompression,
            appCommands,
            appEvents,
            getCurrentUser: () => getCurrentUserState(),
            getCurrentView: () => getCurrentViewState(),
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            getCurrentGasId: () => getCurrentGasIdState(),
            setCurrentGasId: (value) => setCurrentGasIdState(value),
            getGasItems: () => getGasItemsState(),
            setGasItemsState: (value) => setGasItemsState(value),
            getGasSearch: () => getGasSearchState(),
            setGasSearchState: (value) => setGasSearchRuntimeState(value),
            getGasFilters: () => getGasFiltersState(),
            setGasFiltersState: (value) => setGasFiltersRuntimeState(value),
            getGasSortKey: () => getGasSortKeyState(),
            setGasSortKeyState: (value) => setGasSortKeyRuntimeState(value),
            getGasSortDir: () => getGasSortDirState(),
            setGasSortDirState: (value) => setGasSortDirRuntimeState(value),
            getCoffees: () => getCoffeesState(),
            setCoffeesState: (value) => setCoffeesState(value),
            openAppConfirm,
            getRefreshBrewGearSelectors: () => refreshBrewGearSelectors,
            openLightbox: (...args) => openLightbox?.(...args)
        });

        

        const {
            setNotesMode,
            renderScaWheel,
            addScaToNotes,
            resetSca,
            setTempMode,
            updateCoffeeDetailsTitle,
            setCoffeeDetailsCollapsed,
            toggleCoffeeDetails,
            toggleExtractionSection,
            initCoffeeDetailsUi,
            toggleForm,
            handleQuickEditRecipeInput
        } = createBrewFormUiModule({
            getScaData: () => scaData,
            getScaState: () => getScaStateRuntime(),
            setScaState: (value) => setScaStateRuntime(value),
            getCoffeeScale: () => coffeeScale
        });

        const {
            acceptFriendRequest,
            openFriendsModal,
            closeModal,
            switchModalTab,
            toggleSocialAccordion,
            togglePublicProfile,
            updatePublicToggleUI,
            copyShareId,
            declineFriendRequest,
            followUser,
            removeBlockedUser,
            removeFollower,
            refreshFriendRequests,
            searchPublicUsers,
            sendFriendRequest,
            unfollowUser,
            syncFriendViewSelectValues,
            updateFriendViewSelectors,
            loadFollowingList,
            loadFollowersList
        } = createSocialCoordinator({
            dataService,
            getCurrentUser: () => getCurrentUserState(),
            getCurrentView: () => getCurrentViewState(),
            setCurrentView: (value) => setCurrentViewState(value),
            getFollowing: () => getFollowingState(),
            setFollowingState: (value) => setFollowingRuntimeState(value),
            setFollowersState: (value) => setFollowersRuntimeState(value),
            getIsPublic: () => getIsPublicState(),
            setIsPublicState: (value) => setIsPublicState(value),
            openAppConfirm,
            changeView,
            showToast
        });

        setOutgoingFriendRequestsProcessor?.(() => refreshFriendRequests());

        const {
            openUploadModal,
            toggleAllFriends,
            closeUploadModal,
            handlePhotoSubmit,
            openGallery,
            switchGalleryTab,
            loadMoreGallery,
            renderGalleryGrid,
            deletePhoto
        } = createGalleryModule({
            getCurrentUser: () => getCurrentUserState(),
            getCurrentUploadCoffeeId: () => getCurrentUploadCoffeeIdState(),
            setCurrentUploadCoffeeId: (value) => setCurrentUploadCoffeeIdState(value),
            getLastGalleryVisit: () => getLastGalleryVisitState(),
            setLastGalleryVisit: (value) => setLastGalleryVisitState(value),
            getCurrentGalleryMode: () => getCurrentGalleryModeState(),
            setCurrentGalleryMode: (value) => setCurrentGalleryModeState(value),
            getLastGalleryDoc: () => getLastGalleryDocState(),
            setLastGalleryDoc: (value) => setLastGalleryDocState(value),
            getIsGalleryLoading: () => getIsGalleryLoadingState(),
            setIsGalleryLoading: (value) => setIsGalleryLoadingState(value),
            getFollowing: () => getFollowingState(),
            getCoffees: () => getCoffeesState(),
            getCoffeeTypeDisplay: (brew) => getCoffeeTypeDisplay(brew),
            dataService,
            storageService,
            functionsService,
            imageCompression,
            html2canvas,
            openLightbox: (...args) => openLightbox?.(...args),
            openAppConfirm,
            getCoffeeScale: () => coffeeScale,
            openBrewFromMoment: async (brewId, event = null, ownerUid = null) => {
                const targetId = typeof brewId === 'string' ? brewId.trim() : '';
                if (!targetId) return;

                const targetOwnerUid = typeof ownerUid === 'string' ? ownerUid.trim() : '';
                const currentUserUid = typeof getCurrentUserState()?.uid === 'string' ? getCurrentUserState().uid : '';
                const targetView = !targetOwnerUid || targetOwnerUid === currentUserUid ? 'mine' : targetOwnerUid;
                if (getCurrentViewState() !== targetView) {
                    changeView(targetView);
                }

                const start = Date.now();
                const timeoutMs = 3500;
                while (!getCoffeesState().some((brew) => brew.id === targetId) && Date.now() - start < timeoutMs) {
                    await new Promise((resolve) => setTimeout(resolve, 80));
                }

                if (!getCoffeesState().some((brew) => brew.id === targetId)) {
                    showToast('Could not open brew card. Brew is not available in current view.');
                    return;
                }

                appCommands?.dispatch?.(
                    'brews.openCard',
                    { id: targetId, event, options: { ownerUid: targetOwnerUid || null } },
                    { source: 'gallery.openBrewFromMoment' }
                );
            }
        });

        const {
            openGraphModal,
            closeGraphModal,
            openScaWheelLightbox,
            openLightbox,
            closeLightbox,
            showPrevLightboxImage,
            showNextLightboxImage,
            resetLightboxZoom,
            initLightboxListeners
        } = createMediaModalsModule({
            getCoffeeScale: () => coffeeScale
        });

        // --- Statistics Logic ---
        const {
            openStats,
            closeStats,
            toggleStatsUniqueTable,
            changeStatsView,
            calculateStats,
            updateBeanMeter,
            renderCharts
        } = createStatsModule({
            getCurrentUser: () => getCurrentUserState(),
            getCurrentView: () => getCurrentViewState(),
            getFollowing: () => getFollowingState(),
            dataService,
            getCoffeeTypeDisplay: (brew) => getCoffeeTypeDisplay(brew),
            getCoffeeTypeForBrew: (brew) => getCoffeeTypeForBrew(brew),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'stats' }),
            setCurrentStatsData: (value) => setCurrentStatsDataState(value),
            getCurrentStatsData: () => getCurrentStatsDataState(),
            setCurrentBeanMeterPeriod: (value) => setCurrentBeanMeterPeriodState(value),
            getCurrentBeanMeterPeriod: () => getCurrentBeanMeterPeriodState(),
            Chart
        });

        const setRating = (r) => { const c=document.getElementById('starContainer'); document.getElementById('ratingInput').value=r; for(let i=0;i<c.children.length;i++){ if(i<r)c.children[i].classList.add('active'); else c.children[i].classList.remove('active'); } };

        const {
            openCoffeeScaleModal,
            closeCoffeeScaleModal,
            openConnectScaleModal,
            closeConnectScaleModal
        } = createScaleModalsModule({
            getCoffeeScale: () => coffeeScale
        });

        const {
            resetImportState,
            renderImportPreview,
            openImportExportModal,
            closeImportExportModal,
            setImportExportMode,
            openImportModal,
            closeImportModal,
            handleImportFileChange,
            performImport,
            openExportModal,
            closeExportModal,
            performExport,
            exportBrewsAsCSV,
            exportBrewsAsBeanconquerorCSV,
            exportAsJSON,
            exportCoffeesAsCSV,
            exportCoffeesAsJSON
        } = createImportExportModule({
            getCurrentUser: () => getCurrentUserState(),
            getPendingImportBrews: () => getPendingImportBrewsState(),
            setPendingImportBrews: (value) => setPendingImportBrewsState(value),
            parseBeanconquerorCSV,
            mapBeanconquerorBrews,
            dataService,
            getFilteredCoffees: () => getFilteredCoffees(),
            getBeans: () => getBeansState(),
            getCoffeeTypes: () => getCoffeeTypesState(),
            getCoffeeTypeDisplay: (brew) => getCoffeeTypeDisplay(brew),
            getCoffeeTypeForBrew: (brew) => getCoffeeTypeForBrew(brew),
            openAppConfirm
        });

        const { getCoffeeTypeForBrew, getCoffeeTypeDisplay, getCoffeeTypeForBean, getBeanCoffeeTypeDisplay } =
            createCoffeeDisplayModule({
                getBeans: () => getBeansState(),
                getCoffeeTypes: () => getCoffeeTypesState()
            });

        const { exportCSV, handleRecipeInput } = createBrewCsvRecipeModule({
            getFilteredCoffees,
            getCoffeeTypeDisplay
        });
        const {
            openLabResultsModal,
            closeLabResultsModal,
            setLabResultCustomGraphRenderMode,
            startLabResultBrewLongPress,
            toggleLabResultGraph,
            toggleLabResultXField,
            toggleLabResultYField,
            toggleLabResultBrewSelection
        } = createLabResultsModule({
            getFilteredCoffees,
            getCoffeeTypeDisplay,
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'brews.lab-results' })
        });
        initCoffeeDetailsUi();

        const {
            showBeanForBrew,
            showCoffeeForBrew,
            closeCoffeeCardMenu,
            getBeanLabelForBrew,
            populateBrewQuickEditBeanOptions,
            enterBrewQuickEditMode,
            cancelBrewQuickEditMode,
            saveBrewQuickEdits,
            editBrewFromCard,
            updateCoffeeCardActionMenu,
            refreshQuickEditGearFieldVisibility
        } = createBrewsCardActionsModule({
            getCurrentUser: () => getCurrentUserState(),
            getCurrentView: () => getCurrentViewState(),
            getCurrentCoffeeCardId: () => getCurrentCoffeeCardIdState(),
            getCurrentCoffeeCard: () => getCurrentCardCoffeeState(),
            getCoffees: () => getCoffeesState(),
            getBeans: () => getBeansState(),
            getGasItems: () => getGasItemsState(),
            getCoffeeTypes: () => getCoffeeTypesState(),
            brewsRepo,
            parseNum,
            handleQuickEditRecipeInput: (...args) => handleQuickEditRecipeInput(...args),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'brews.card-actions' }),
            closeCoffeeCard: (...args) => closeCoffeeCard(...args),
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            getFirstBrewDateForBean: (...args) => getFirstBrewDateForBean(...args),
            showToast
        });

        const { resetCardPhotoState, triggerCardPhoto, handleCardPhoto } = createBrewsCardPhotoModule();

        const {
            populateCardData,
            getBrewTableOrder,
            openCard: openBrewCardImpl,
            openCardWithOrder: openBrewCardWithOrderImpl,
            updateCoffeeCardNav,
            navigateCoffeeCard,
            closeCoffeeCard
        } = createBrewsCardUiModule({
            getCurrentView: () => getCurrentViewState(),
            getCoffees: () => getCoffeesState(),
            getBeans: () => getBeansState(),
            getBrewTableOrderIds: () =>
                selectVisibleBrewOrderIds({
                    filteredSortedBrews: getFilteredCoffees(),
                    displayedCount: getDisplayedBrewsCountState()
                }),
            getCoffeeTypeForBrew: (...args) => getCoffeeTypeForBrew(...args),
            getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            getStarDisplay,
            formatTime,
            getTempBadge: (...args) => getTempBadge(...args),
            setCurrentCardCoffee: (value) => setCurrentCardCoffeeState(value),
            getCurrentCoffeeCardId: () => getCurrentCoffeeCardIdState(),
            setCurrentCoffeeCardId: (value) => setCurrentCoffeeCardIdState(value),
            setCurrentCardGraphData: (value) => setCurrentCardGraphDataState(value),
            updateCoffeeCardActionMenu: (...args) => updateCoffeeCardActionMenu(...args),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'brews.card-ui' }),
            cancelBrewQuickEditMode: (...args) => cancelBrewQuickEditMode(...args),
            resetCardPhotoState: (...args) => resetCardPhotoState(...args),
            toggleCardMode: (...args) => toggleCardMode(...args)
        });
        // TODO: remove legacy Share brew code
        const { toggleCardMode, shareCoffeeCard, generateShareImage } = createBrewsCardShareModule({
            getCoffees: () => getCoffeesState(),
            setCurrentCoffeeCardId: (value) => setCurrentCoffeeCardIdState(value),
            getCurrentCardCoffee: () => getCurrentCardCoffeeState(),
            getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
            setCurrentShareMode: (value) => setCurrentShareModeState(value),
            cancelBrewQuickEditMode: (...args) => cancelBrewQuickEditMode(...args),
            resetCardPhotoState: (...args) => resetCardPhotoState(...args),
            populateCardData: (...args) => populateCardData(...args),
            updateCoffeeCardNav: (...args) => updateCoffeeCardNav(...args),
            html2canvas
        });

        const { openCardGraphModal, closeCardGraphModal, updateCoffeeGraphNav, navigateCoffeeCardFromGraph } = createBrewsCardGraphModule({
            getCurrentCardGraphData: () => getCurrentCardGraphDataState(),
            getCurrentCardCoffee: () => getCurrentCardCoffeeState(),
            getCurrentCoffeeCardId: () => getCurrentCoffeeCardIdState(),
            getBrewTableOrder: (...args) => getBrewTableOrder(...args),
            getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'brews.card-graph' }),
            getCoffeeScale: () => coffeeScale
        });

        const {
            populateForm,
            refreshBrewGearField,
            setBrewGearScope,
            getSelectedBrewGearIds,
            setSelectedBrewGearIds,
            handleFormSubmit,
            discardForm,
            editCoffee,
            fastDuplicateFromCard,
            fastRepeatCoffee,
            duplicateFromCard,
            duplicateCoffee,
            cloneBrew,
            deleteCoffee,
            resetFormState
        } = createBrewsCoordinator({
            formDeps: {
                setTempMode,
                setRating,
                setNotesMode,
                getCoffeeScale: () => coffeeScale,
                getGasItems: () => getGasItemsState(),
                fillBeanDetails
            },
            actionsDeps: {
                getCurrentUser: () => getCurrentUserState(),
                getCurrentView: () => getCurrentViewState(),
                getCurrentCoffeeCardId: () => getCurrentCoffeeCardIdState(),
                getCurrentCardCoffee: () => getCurrentCardCoffeeState(),
                getCoffees: () => getCoffeesState(),
                getBeans: () => getBeansState(),
                getCoffeeTypes: () => getCoffeeTypesState(),
                getGasItems: () => getGasItemsState(),
                getBeanCoffeeTypeDisplay,
                brewsRepo,
                openAppConfirm,
                parseNum,
                setTempMode,
                setNotesMode,
                resetSca,
                setRating,
                toggleForm,
                updateBeanDropdown,
                setCoffeeDetailsCollapsed,
                closeCoffeeCard,
                closeCoffeeCardMenu,
                handleQuickEditRecipeInput,
                dispatchCommand: (commandName, payload) =>
                    appCommands?.dispatch?.(commandName, payload, { source: 'brews.actions' }),
                getFirstBrewDateForBean,
                uploadPendingCoffeeTypeImage,
                clearPendingAIBeanImageFile,
                getCoffeeScale: () => coffeeScale,
                showToast,
                getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
                openBrewFormModal: dispatchBrewOpenForm
            },
            refreshQuickEditGearFieldVisibility,
            setRefreshBrewGearSelectors: (fn) => { refreshBrewGearSelectors = fn; }
        });

        const { renderPinnedTiles, togglePinnedTiles } = createPinCoordinator({
            dataService,
            appCommands,
            appEvents,
            autoPinOpenBagsIfEnabled,
            autoUnpinClosedBagsIfEnabled,
            getCurrentUser: () => getCurrentUserState(),
            getCurrentView: () => getCurrentViewState(),
            getCurrentSort: () => getCurrentSortState(),
            getActiveFilters: () => getActiveFiltersState(),
            getCoffees: () => getCoffeesState(),
            setCoffees: (value) => setCoffeesState(value),
            getBeans: () => getBeansState(),
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            getBeanCalculatedStock,
            getCoffeeTypeForBrew,
            getCoffeeTypeDisplay
        });

        const { toggleActionMenu } = createActionMenuModule();

        const hideAiProfile = () => {
            document.getElementById('aiProfileContainer')?.classList.add('hidden');
        };

        const hideGalleryModal = () => {
            document.getElementById('galleryModal')?.classList.add('hidden');
        };

        const hidePreferencesModal = () => {
            document.getElementById('preferencesModal')?.classList.add('hidden');
        };

        const handleCoffeeCardOverlayClick = (event) => {
            event.stopPropagation();
            if (!event.target.closest('.action-menu') && !event.target.closest('.action-menu-toggle')) {
                closeCoffeeCardMenu();
            }
        };

        const handleBeanCardOverlayClick = (event) => {
            event.stopPropagation();
            if (!event.target.closest('.action-menu') && !event.target.closest('.action-menu-toggle')) {
                closeBeanCardMenu();
            }
        };

        const handleCoffeeTypeCardOverlayClick = (event) => {
            event.stopPropagation();
            if (!event.target.closest('.action-menu') && !event.target.closest('.action-menu-toggle')) {
                closeCoffeeTypeCardMenu();
            }
        };

        const handleGasCardOverlayClick = (event) => {
            event.stopPropagation();
            if (!event.target.closest('.action-menu') && !event.target.closest('.action-menu-toggle')) {
                closeGasCardMenu();
            }
        };
        // Initialize animation preference
        const initAnimationPreference = () => {
            applyAnimationPreference();
        };
        initAnimationPreference();

        let hasBoundServiceWorkerRouteMessages = false;
        const bindServiceWorkerRouteMessages = () => {
            if (hasBoundServiceWorkerRouteMessages) return;
            if (typeof navigator === 'undefined' || !navigator.serviceWorker) return;
            hasBoundServiceWorkerRouteMessages = true;
            navigator.serviceWorker.addEventListener('message', (event) => {
                const payload = event?.data && typeof event.data === 'object' ? event.data : null;
                if (!payload) return;
                const targetRoute = typeof payload.route === 'string' ? payload.route.trim() : '';
                if (targetRoute !== '/moments' && targetRoute !== 'moments') return;
                try {
                    openGallery?.();
                } catch (error) {
                    console.error('Failed opening moments from service worker message:', error);
                }
            });
        };
        bindServiceWorkerRouteMessages();

        installCardNavigationHandlers({
            navigateBeanCard,
            navigateCoffeeCard,
            navigateCoffeeCardFromGraph,
            navigateCoffeeTypeCard,
            navigateGasCard,
            showPrevLightboxImage,
            showNextLightboxImage,
            handleEscapeKey
        });

        const authStateChangedHandler = createAuthStateChangedHandler({
            initUserData,
            initPushNotifications: async () => pushNotifications.handlePreferencesChanged(null, { trigger: 'auth-init' }),
            loadFollowingList,
            changeView,
            initNotificationListener,
            openHelp,
            openGallery,
            initLightboxListeners,
            clearPushNotifications: async () => pushNotifications.cleanupOnLogout(),
            clearNotificationSubscription,
            clearViewSubscriptions
        });
        const { handleAuthStateChanged, bindGlobalSearchInput } = createAppLifecycleModule({
            setCurrentUser: (value) => setCurrentUserState(value),
            authStateChangedHandler,
            setDisplayedBrewsCount: (value) => setDisplayedBrewsCountState(value),
            renderTable: (...args) => renderTable(...args),
            brewsPerPage: BREWS_PER_PAGE
        });

        const sendEmailLinkActivation = () => {
            if (typeof emailLinkAuth.sendEmailLinkActivation === 'function') {
                return emailLinkAuth.sendEmailLinkActivation();
            }
        };

        const sendEmailLinkLogin = () => {
            if (typeof emailLinkAuth.sendEmailLinkLogin === 'function') {
                return emailLinkAuth.sendEmailLinkLogin();
            }
        };

        const openCoffeeCardQuickEdit = (brewId, event) => {
            appCommands?.dispatch?.(
                'brews.openCard',
                { id: brewId, event: event || null, options: {} },
                { source: 'container.openCoffeeCardQuickEdit' }
            );
            setTimeout(() => enterBrewQuickEditMode(), 0);
        };
        const brewsOpenCard = (brewId, event = null) => {
            appCommands?.dispatch?.(
                'brews.openCard',
                { id: brewId, event, options: {} },
                { source: 'container.brewsOpenCard' }
            );
        };
        const beansOpenCard = (beanId, event = null) => {
            appCommands?.dispatch?.(
                'beans.openCard',
                { beanId, event, keepNavigationOrder: false },
                { source: 'container.beansOpenCard' }
            );
        };
        const beansOpenCardForEdit = (beanId, event = null) => {
            appCommands?.dispatch?.(
                'beans.openCardForEdit',
                { beanId, event },
                { source: 'container.beansOpenCardForEdit' }
            );
        };

        const openExternalUrl = (url) => {
            if (!url) return;
            window.open(url, '_blank', 'noopener,noreferrer');
        };

        const { openBrewFormModal, closeBrewFormModal, discardBrewFormModal, submitBrewFormModal } = createBrewsFormModalModule({
            getCurrentView: () => getCurrentViewState(),
            changeView,
            resetFormState,
            toggleForm,
            openAppConfirm
        });

        const openAddBrewFromPinned = createOpenAddBrewFromPinned({
            openBrewFormModal
        });

        registerBrewsFilterCommands({
            appCommands,
            clearSearch,
            clearAllFilters,
            applyFilter,
            renderTable,
            renderActiveFilters,
            getBrewsPerPage: () => BREWS_PER_PAGE,
            setDisplayedBrewsCount: (value) => setDisplayedBrewsCountState(value)
        });
        createBrewsController({
            appCommands,
            openCard: (id, event = null, options = {}) => openBrewCardImpl(id, event, options),
            openCardWithOrder: (id, order = [], event = null, options = {}) =>
                openBrewCardWithOrderImpl(id, order, event, options),
            openForm: (event = null, options = {}) => openBrewFormModal(event, options),
            showForCoffeeType: (coffeeTypeId) => {
                if (!coffeeTypeId) return;
                clearSearch();
                clearAllFilters();
                const nextFilters = { ...(getActiveFiltersState() || {}), coffeeType: coffeeTypeId };
                setActiveFiltersState(nextFilters);
                setDisplayedBrewsCountState(BREWS_PER_PAGE);
                renderTable();
                renderActiveFilters();
                document.getElementById('brewsTableMount')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
            showForBean: (beanId) => {
                if (!beanId) return;
                clearSearch();
                clearAllFilters();
                const nextFilters = { ...(getActiveFiltersState() || {}), bean: beanId };
                setActiveFiltersState(nextFilters);
                setDisplayedBrewsCountState(BREWS_PER_PAGE);
                renderTable();
                renderActiveFilters();
                document.getElementById('brewsTableMount')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            },
            openFormForBean: (beanId, event = null) => {
                if (!beanId) return;
                if (getCurrentViewState() !== 'mine') changeView('mine');
                const select = document.getElementById('savedBeanSelect');
                if (select) select.value = beanId;
                fillBeanDetails(beanId);
                toggleForm(true);
                openBrewFormModal(event, { reset: false, syncTitleFromForm: true });
            },
            refreshTable: () => {
                renderTable();
                renderActiveFilters();
            }
        });

        const { actions, featureActions } = createActionAssemblies({
            addScaToNotes,
            acceptFriendRequest,
            applyBeansFilterFromQuick,
            applyCoffeeTypesFilterFromQuick,
            applyFilter,
            applyFilterFromQuick,
            applyGasFilterFromQuick,
            beansOpenCard,
            beansOpenCardForEdit,
            brewsOpenCard,
            bulkAddGearToBrews,
            cancelBeanEditMode,
            cancelBrewQuickEditMode,
            cancelCoffeeTypeEditMode,
            cancelGasEditMode,
            changeStatsView,
            changeView,
            clearAllFilters,
            clearBeansFilters,
            clearBeansSearch,
            clearCoffeeTypesFilters,
            clearCoffeeTypesSearch,
            clearGasFilters,
            clearGasSearch,
            clearSearch,
            cloneBrew,
            closeAbout,
            closeAppConfirm,
            closeAutoArchiveToast,
            closeAutoPinToast,
            closeBeanCard,
            closeBeanCardMenu,
            closeBeanCreatedToast,
            closeBeans,
            closeBrewFormModal,
            closeCardGraphModal,
            closeCoffeeCard,
            closeCoffeeCardMenu,
            closeCoffeeScaleModal,
            closeCoffeeTypeCard,
            closeCoffeeTypeCardMenu,
            closeCoffeeTypeCreatedToast,
            closeCoffeeTypes,
            closeConnectScaleModal,
            closeBrewsTableStateMenu,
            closeEasterEgg,
            closeExportModal,
            closeGasBulkAddModal,
            closeGasCard,
            closeGasList,
            closeGasMergeModal,
            closeGraphModal,
            closeHelp,
            closeImportExportModal,
            closeImportModal,
            closeLabResultsModal,
            closeMenus,
            closeModal,
            closeStats,
            closeUploadModal,
            copyShareId,
            createBeanFromModal,
            createCoffeeTypeFromModal,
            createGasItemFromModal,
            declineFriendRequest,
            deleteBean,
            deleteBrewsTableStatePreset,
            deleteCoffee,
            deleteCoffeeType,
            deleteCoffeeTypeFromTable,
            deleteGasFromTable,
            deleteGasItem,
            deletePhoto,
            discardBrewFormModal,
            discardForm,
            duplicateCoffee,
            duplicateFromCard,
            editBrewFromCard,
            editCoffee,
            enterBeanEditMode,
            enterBrewQuickEditMode,
            enterCoffeeTypeEditMode,
            enterGasEditMode,
            exportBrewsAsBeanconquerorCSV,
            exportBrewsAsCSV,
            exportCSV,
            exportCoffeesAsCSV,
            exportCoffeesAsJSON,
            fastDuplicateFromCard,
            fastRepeatCoffee,
            fillBeanDetails,
            followUser,
            gasToggleActionMenu: toggleActionMenu,
            // TODO: remove legacy Share brew code
            generateShareImage,
            getFilteredCoffees,
            googleLogin,
            googleLogout,
            handleAIFile,
            handleAutoArchiveToastAction,
            handleBeanCardOverlayClick,
            handleBeanCreatedToastAction,
            handleBeanPhoto,
            handleBeansAIFile,
            handleCardPhoto,
            handleCoffeeCardOverlayClick,
            handleCoffeeTypeCardOverlayClick,
            handleCoffeeTypePhoto,
            handleCoffeeTypesAIFile,
            handleFormSubmit,
            handleGasCardOverlayClick,
            handleGasPhoto,
            handleImportFileChange,
            handlePhotoSubmit,
            handleQuickEditRecipeInput,
            handleRecipeInput,
            hideAiProfile,
            hideBrewsTablePrefsModal,
            hideGalleryModal,
            hidePreferencesModal,
            loadMoreBrews,
            loadBrewsTableStatePreset,
            loadMoreGallery,
            mergeGasItem,
            navigateBeanCard,
            navigateCoffeeCard,
            navigateCoffeeCardFromGraph,
            navigateCoffeeTypeCard,
            navigateGasCard,
            openAbout,
            openAddBrewFromPinned,
            openBeanPhoto,
            openBeans,
            openBeansQuickFilterValues,
            openBrewWithBean,
            openBrewsTablePrefs,
            openCardGraphModal,
            openCoffeeCardQuickEdit,
            openCoffeeFromBeanEdit,
            openCoffeeScaleModal,
            openCoffeeTypeCard,
            openCoffeeTypeFromTableEdit,
            openCoffeeTypePhoto,
            openCoffeeTypeShopUrl,
            openCoffeeTypes,
            openCoffeeTypesQuickFilterValues,
            openConnectScaleModal,
            openEasterEgg,
            openExportModal,
            openExternalUrl,
            openFilterMenu,
            openFriendsModal,
            openGallery,
            openGasBulkAddFromTable,
            openGasBulkAddModal,
            openGasCard,
            openGasFromTableEdit,
            openGasList,
            openGasMergeFromTable,
            openGasMergeModal,
            openGasPhoto,
            openGasQuickFilterValues,
            openGraphModal,
            openHelp,
            openScaWheelLightbox,
            openImportExportModal,
            openImportModal,
            openLabResultsModal,
            openNewBag,
            openNewBagForCoffeeType,
            openNewBagForCoffeeTypeFromTable,
            openPreferences,
            openQuickFilterValues,
            openSelectedBeanForEdit,
            openStats,
            openUploadModal,
            performExport,
            performImport,
            pinToggleActionMenu: toggleActionMenu,
            refreshFriendRequests,
            refreshTableData,
            removeBlockedUser,
            removeFollower,
            removeBeanPhoto,
            removeCoffeeTypePhoto,
            removeGasPhoto,
            resetCardPhotoState,
            resetFormState,
            resetSca,
            resetLightboxZoom,
            resolveAppConfirm,
            saveBeanCardEdits,
            saveBeanFrozenDate,
            saveBeanOpenedDate,
            saveBeanPrice,
            saveBeanRoastDate,
            saveBeanStock,
            saveBrewQuickEdits,
            saveCurrentBrewsTableState,
            saveCoffeeTypeEdits,
            saveGasEdits,
            searchPublicUsers,
            sendEmailLinkActivation,
            sendEmailLinkLogin,
            sendFriendRequest,
            setBeansSearch,
            setBeansSort,
            setCoffeeTypesSearch,
            setCoffeeTypesSort,
            setGasSearch,
            setGasSort,
            setImportExportMode,
            setLabResultCustomGraphRenderMode,
            setNotesMode,
            setRating,
            setTempMode,
            // TODO: remove legacy Share brew code
            shareCoffeeCard,
            startLabResultBrewLongPress,
            showBeanForBrew,
            showBeansForCoffeeType,
            showBeansForCoffeeTypeFromTable,
            showBrewsForBean,
            showBrewsForCoffeeType,
            showBrewsForCoffeeTypeFromTable,
            showBrewsForGear,
            showCoffeeForBean,
            showCoffeeForBrew,
            sortBy,
            submitBrewFormModal,
            switchGalleryTab,
            switchModalTab,
            toggleSocialAccordion,
            toggleActionMenu,
            toggleAiMenu,
            toggleAllFriends,
            toggleBeanArchive,
            toggleBeanFrozen,
            toggleBeansAiMenu,
            toggleBeansQuickFilter,
            toggleCardMode,
            toggleCoffeeDetails,
            toggleExtractionSection,
            toggleCoffeeTypesAiMenu,
            toggleCoffeeTypesQuickFilter,
            toggleDrinkOther,
            toggleForm,
            toggleGasArchive,
            toggleGasArchiveFromTable,
            toggleGasQuickFilter,
            toggleBrewsTableStateMenu,
            toggleLabResultBrewSelection,
            toggleLabResultGraph,
            toggleLabResultXField,
            toggleLabResultYField,
            toggleMainMenu,
            toggleMethodOther,
            togglePinnedTiles,
            togglePublicProfile,
            toggleQuickFilter,
            toggleStatsUniqueTable,
            triggerAIScan,
            triggerAIProfile,
            triggerBeanPhoto,
            triggerBeansAIScan,
            triggerCardPhoto,
            triggerCoffeeTypePhoto,
            triggerCoffeeTypesAIScan,
            triggerGasPhoto,
            unfollowUser,
            updateBeanMeter
        });

        const initializeHistoryRoutes = () => {
            if (typeof window === 'undefined' || !window.history || typeof window.history.pushState !== 'function') return;

            const APP_BASE_PATH = '/Coffee-Dial';
            const ROUTE_KEYS = [
                'moments',
                'beans',
                'gear',
                'coffees',
                'statistics',
                'preferences',
                'import-export',
                'help',
                'about',
                'lab-results',
                'profile',
                'brew'
            ];
            const ROUTE_KEY_SET = new Set(ROUTE_KEYS);
            const shouldUseBasePath = () => {
                const pathname = window.location.pathname || '/';
                return pathname.startsWith(`${APP_BASE_PATH}/`) || pathname === APP_BASE_PATH || (window.location.hostname || '').endsWith('github.io');
            };
            const getBasePath = () => (shouldUseBasePath() ? APP_BASE_PATH : '');
            const stripBasePath = (fullPath = '/') => {
                const base = getBasePath();
                if (!base) return fullPath || '/';
                if (fullPath === base) return '/';
                if (fullPath.startsWith(`${base}/`)) return fullPath.slice(base.length) || '/';
                return fullPath || '/';
            };
            const buildFullPath = () => {
                const base = getBasePath();
                if (!base) return '/';
                return `${base}/`;
            };

            const encodeRouteSearch = (routeKeys = [], preserveSearch = window.location.search || '') => {
                const params = new URLSearchParams(preserveSearch);
                ROUTE_KEYS.forEach((key) => params.delete(key));
                const parts = [];
                params.forEach((value, key) => {
                    if (value === '') parts.push(encodeURIComponent(key));
                    else parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
                });
                routeKeys.forEach((key) => {
                    if (!ROUTE_KEY_SET.has(key)) return;
                    parts.push(encodeURIComponent(key));
                });
                return parts.length ? `?${parts.join('&')}` : '';
            };

            const normalizeRouteKey = (value) => {
                const key = typeof value === 'string' ? value.trim() : '';
                return ROUTE_KEY_SET.has(key) ? key : '';
            };

            const normalizeRouteKeys = (values = []) => {
                const seen = new Set();
                return values
                    .map((value) => normalizeRouteKey(value))
                    .filter((value) => {
                        if (!value || seen.has(value)) return false;
                        seen.add(value);
                        return true;
                    });
            };

            const getRouteKeysFromSearch = (search = window.location.search || '') => {
                const params = new URLSearchParams(search);
                const keys = [];
                ROUTE_KEYS.forEach((key) => {
                    if (params.has(key)) keys.push(key);
                });
                return normalizeRouteKeys(keys);
            };

            const getActiveRouteKeysFromLocation = () => {
                const keysFromSearch = getRouteKeysFromSearch(window.location.search || '');
                return keysFromSearch;
            };

            const routeKeysToStateKey = (routeKeys = []) => {
                const normalized = normalizeRouteKeys(routeKeys).sort();
                return normalized.join('|');
            };

            const buildRouteUrl = (routeKeys = [], preserveSearch = window.location.search || '') => {
                const fullPath = buildFullPath();
                const search = encodeRouteSearch(routeKeys, preserveSearch);
                return `${fullPath}${search}`;
            };

            const trackVirtualPageView = (routeKeys = []) => {
                if (typeof window.gtag !== 'function') return;
                const normalizedKeys = normalizeRouteKeys(routeKeys);
                const fullPath = buildFullPath();
                const search = encodeRouteSearch(normalizedKeys, window.location.search || '');
                const location = `${window.location.origin}${fullPath}${search}`;
                window.gtag('event', 'page_view', {
                    page_path: `${fullPath}${search}`,
                    page_location: location,
                    page_title: document.title
                });
            };

            let isApplyingRoute = false;

            const setRoute = (routeKeys, { replace = false } = {}) => {
                const normalized = normalizeRouteKeys(routeKeys);
                const current = getActiveRouteKeysFromLocation();
                if (routeKeysToStateKey(current) === routeKeysToStateKey(normalized)) return;
                const fullPath = buildRouteUrl(normalized, window.location.search || '');
                const state = { ...(window.history.state || {}), appRouteKeys: normalized };
                if (replace) window.history.replaceState(state, document.title, fullPath);
                else window.history.pushState(state, document.title, fullPath);
                trackVirtualPageView(normalized);
            };

            const wrapActionWithRoute = (obj, actionName, routeKey) => {
                const original = obj?.[actionName];
                if (typeof original !== 'function') return;
                obj[actionName] = (...args) => {
                    const result = original(...args);
                    if (!isApplyingRoute) {
                        const current = getActiveRouteKeysFromLocation();
                        const next = normalizeRouteKeys([...current, routeKey]);
                        setRoute(next);
                    }
                    return result;
                };
            };

            const removeRouteKeyFromLocation = (routeKey) => {
                const key = normalizeRouteKey(routeKey);
                if (!key) return;
                const current = getActiveRouteKeysFromLocation();
                if (!current.includes(key)) return;
                setRoute(current.filter((entry) => entry !== key));
            };

            const wrapCloseRouteKey = (obj, actionName, routeKey) => {
                const original = obj?.[actionName];
                if (typeof original !== 'function') return;
                obj[actionName] = (...args) => {
                    const result = original(...args);
                    if (!isApplyingRoute) removeRouteKeyFromLocation(routeKey);
                    return result;
                };
            };

            const closeRoutedViews = () => {
                const closeFns = [
                    actions.closeStats,
                    actions.closeBeans,
                    actions.closeGasList,
                    actions.closeCoffeeTypes,
                    actions.hideGalleryModal,
                    actions.hidePreferencesModal,
                    actions.closeImportExportModal,
                    actions.closeHelp,
                    actions.closeAbout,
                    actions.closeLabResultsModal,
                    actions.closeBrewFormModal,
                    actions.closeModal
                ];
                closeFns.forEach((fn) => {
                    if (typeof fn !== 'function') return;
                    try {
                        fn();
                    } catch (_) {
                        // Ignore close errors while syncing route state.
                    }
                });
            };

            const authRequiredRouteKeys = new Set(['beans', 'coffees', 'statistics', 'import-export', 'profile', 'brew']);
            const isAuthDeferredRouteKey = (routeKey) => {
                const key = normalizeRouteKey(routeKey);
                if (!key) return false;
                return authRequiredRouteKeys.has(key) && !getCurrentUserState?.();
            };

            const openRouteKey = (routeKey) => {
                const key = normalizeRouteKey(routeKey);
                if (!key) return;
                if (isAuthDeferredRouteKey(key)) return;
                if (key === 'moments') return actions.openGallery?.();
                if (key === 'beans') return actions.openBeans?.();
                if (key === 'gear') return actions.openGasList?.();
                if (key === 'coffees') return actions.openCoffeeTypes?.();
                if (key === 'statistics') return actions.openStats?.();
                if (key === 'preferences') return actions.openPreferences?.();
                if (key === 'import-export') return actions.openImportExportModal?.('export');
                if (key === 'help') return actions.openHelp?.();
                if (key === 'about') return actions.openAbout?.();
                if (key === 'lab-results') return actions.openLabResultsModal?.();
                if (key === 'profile') return actions.openFriendsModal?.();
                if (key === 'brew') return actions.openAddBrewFromPinned?.(null);
            };

            const routeModalIdByKey = new Map([
                ['moments', 'galleryModal'],
                ['beans', 'beansModal'],
                ['gear', 'gasModal'],
                ['coffees', 'coffeeTypesModal'],
                ['statistics', 'statsModal'],
                ['preferences', 'preferencesModal'],
                ['import-export', 'importExportModal'],
                ['help', 'helpModal'],
                ['about', 'aboutModal'],
                ['lab-results', 'labResultsModal'],
                ['profile', 'modalOverlay'],
                ['brew', 'brewFormModal']
            ]);

            const isModalVisible = (modalId) => {
                const el = document.getElementById(modalId);
                return !!el && !el.classList.contains('hidden');
            };

            const syncRouteFromModalVisibility = () => {
                if (isApplyingRoute) return;
                const current = getActiveRouteKeysFromLocation();
                if (!current.length) return;
                const visible = current.filter((key) => {
                    if (isAuthDeferredRouteKey(key)) return true;
                    const modalId = routeModalIdByKey.get(key);
                    if (!modalId) return false;
                    return isModalVisible(modalId);
                });
                if (routeKeysToStateKey(current) !== routeKeysToStateKey(visible)) {
                    setRoute(visible);
                }
            };

            const applyRoute = (routeKeys, { track = true } = {}) => {
                const normalized = normalizeRouteKeys(routeKeys);
                isApplyingRoute = true;
                try {
                    closeRoutedViews();
                    normalized.forEach((key) => {
                        openRouteKey(key);
                    });
                } finally {
                    isApplyingRoute = false;
                }
                const current = getActiveRouteKeysFromLocation();
                if (routeKeysToStateKey(current) !== routeKeysToStateKey(normalized)) {
                    const state = { ...(window.history.state || {}), appRouteKeys: normalized };
                    window.history.replaceState(state, document.title, buildRouteUrl(normalized, window.location.search || ''));
                }
                if (track) trackVirtualPageView(normalized);
            };

            [
                ['openGallery', 'moments'],
                ['openBeans', 'beans'],
                ['openGasList', 'gear'],
                ['openCoffeeTypes', 'coffees'],
                ['openStats', 'statistics'],
                ['openPreferences', 'preferences'],
                ['openImportExportModal', 'import-export'],
                ['openHelp', 'help'],
                ['openAbout', 'about'],
                ['openLabResultsModal', 'lab-results'],
                ['openFriendsModal', 'profile'],
                ['openAddBrewFromPinned', 'brew']
            ].forEach(([actionName, routeKey]) => {
                wrapActionWithRoute(actions, actionName, routeKey);
                wrapActionWithRoute(featureActions, actionName, routeKey);
            });

            [
                ['hideGalleryModal', 'moments'],
                ['hidePreferencesModal', 'preferences'],
                ['closeImportExportModal', 'import-export'],
                ['closeHelp', 'help'],
                ['closeAbout', 'about'],
                ['closeLabResultsModal', 'lab-results'],
                ['closeStats', 'statistics'],
                ['closeBeans', 'beans'],
                ['closeGasList', 'gear'],
                ['closeCoffeeTypes', 'coffees'],
                ['closeBrewFormModal', 'brew']
            ].forEach(([actionName, routeKey]) => {
                wrapCloseRouteKey(actions, actionName, routeKey);
                wrapCloseRouteKey(featureActions, actionName, routeKey);
            });

            const closeModalOriginal = actions.closeModal;
            if (typeof closeModalOriginal === 'function') {
                const wrappedCloseModal = (...args) => {
                    const result = closeModalOriginal(...args);
                    if (!isApplyingRoute) {
                        removeRouteKeyFromLocation('profile');
                    }
                    return result;
                };
                actions.closeModal = wrappedCloseModal;
                if (typeof featureActions?.closeModal === 'function') {
                    featureActions.closeModal = wrappedCloseModal;
                }
            }

            window.addEventListener('popstate', () => {
                applyRoute(getActiveRouteKeysFromLocation(), { track: true });
            });
            window.addEventListener('coffee-dial-auth-ready', () => {
                applyRoute(getActiveRouteKeysFromLocation(), { track: false });
            });
            window.addEventListener('pageshow', () => {
                applyRoute(getActiveRouteKeysFromLocation(), { track: false });
            });
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) {
                    applyRoute(getActiveRouteKeysFromLocation(), { track: false });
                }
            });

            const modalObserver = new MutationObserver(() => {
                syncRouteFromModalVisibility();
            });
            routeModalIdByKey.forEach((modalId) => {
                const modalEl = document.getElementById(modalId);
                if (!modalEl) return;
                modalObserver.observe(modalEl, {
                    attributes: true,
                    attributeFilter: ['class', 'style']
                });
            });

            const initialKeys = getActiveRouteKeysFromLocation();
            const normalizedInitialKeys = normalizeRouteKeys(initialKeys);
            const initialState = { ...(window.history.state || {}), appRouteKeys: normalizedInitialKeys };

            window.history.replaceState(initialState, document.title, buildRouteUrl(normalizedInitialKeys, window.location.search || ''));
            applyRoute(normalizedInitialKeys, { track: true });
        };

        initializeHistoryRoutes();
        bindGlobalSearchInput();

        const applyE2ESeedData = async (seed = {}) => {
            const user = seed.user || {
                uid: 'e2e-user',
                displayName: 'E2E User',
                photoURL: 'img/icon-192.png'
            };

            setCurrentUserState(user);
            setCurrentViewState('mine');
            setHasLoadedBrewsState(true);
            setHasLoadedBeansState(true);

            const authContainer = document.getElementById('authContainer');
            if (authContainer) {
                authContainer.innerHTML = `<div class="flex items-center gap-3"><button data-action-click="openFriendsModal()" class="relative flex-shrink-0 hover:opacity-80 transition-opacity" aria-label="Open friends profile"><img src="${user.photoURL}" alt="${user.displayName || 'User avatar'}" class="w-8 h-8 flex-shrink-0 rounded-full border border-coffee-200 dark:border-[#44403c]" title="${user.displayName}"></button></div>`;
            }
            document.getElementById('viewSelectorContainer')?.classList.remove('hidden');
            document.getElementById('signedOutAuthBody')?.classList.add('hidden');
            document.getElementById('signedInContent')?.classList.remove('hidden');

            [
                'menuAddBrewBtn',
                'menuStatsBtn',
                'menuBeansBtn',
                'menuCoffeesBtn',
                'menuGasBtn',
                'menuGalleryBtn',
                'menuImportExportBtn',
                'menuPreferencesBtn',
                'menuHelpBtn',
                'menuHelpDivider'
            ].forEach((id) => document.getElementById(id)?.classList.remove('hidden'));

            syncFriendViewSelectValues?.('mine');

            setCoffeeTypesState(Array.isArray(seed.coffeeTypes) ? seed.coffeeTypes : []);
            setBeansState(Array.isArray(seed.beans) ? seed.beans : []);
            setCoffeesState(Array.isArray(seed.coffees) ? seed.coffees : []);
            setGasItemsState(Array.isArray(seed.gasItems) ? seed.gasItems : []);

            if (seed.pinnedBrewsPreferences && typeof seed.pinnedBrewsPreferences === 'object') {
                setPinnedBrewsPreferencesState({
                    ...getPinnedBrewsPreferencesState(),
                    ...seed.pinnedBrewsPreferences
                });
            }

            updateCoffeeTypeSelectors?.();
            updateBeanDropdown?.();
            updateAutocompleteLists?.();
            renderBeansTable?.();
            renderCoffeeTypesTable?.();
            renderGasTable?.();
            renderPinnedTiles?.();
            renderTable?.();
        };

        const getE2EStateSnapshot = () => ({
            isE2ESeedMode,
            counts: {
                beans: getBeansState().length,
                brews: getCoffeesState().length,
                coffeeTypes: getCoffeeTypesState().length
            }
        });

        return { handleAuthStateChanged, actions, featureActions, appCommands, appEvents, applyE2ESeedData, getE2EStateSnapshot };
};
