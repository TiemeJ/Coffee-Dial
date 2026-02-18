        import { BAG_AI_URL, STATS_AI_URL, auth, db, storage, provider } from '../../config/firebase.js';
        import { signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
        import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, query, writeBatch, where, orderBy, limit, startAfter } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
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
        import { createDataService } from '../services/data.service.js';
        import { createStorageService } from '../services/storage.service.js';
        import { createAuthService } from '../services/auth.service.js';
        import { createSessionAuthViewModule } from '../../features/session-auth-view.js';
        import { createAiImportModule } from '../../features/ai-import.js';
        import { createStatsAiProfileModule } from '../../features/stats/stats-ai-profile.js';
        import { createBrewFormLookupModule } from '../../features/brews/brew-form-lookup.js';
        import { createBrewFormUiModule } from '../../features/brews/brew-form-ui.js';
        import { createBrewFormActionsModule } from '../../features/brews/brew-form-actions.js';
        import { createBrewCsvRecipeModule } from '../../features/brews/brew-csv-recipe.js';
        import { createLabResultsModule } from '../../features/brews/lab-results.js';
        import { createCoffeeTypesExtractModule } from '../../features/coffees/coffee-types-extract.js';
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
        import { selectVisibleBrewOrderIds } from '../stores/brews-table.selectors.js';
        import { createAuthStateChangedHandler } from '../runtime/auth-state.js';
        import { createAppLifecycleModule } from '../runtime/app-lifecycle.js';
        import { createGearMigrationModule } from '../runtime/gear-migration.js';
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
        const isLegacyBrewFormEnabled = () => getPinnedBrewsPreferencesState()?.useLegacyBrewForm !== false;
        const dataService = createDataService({
            db,
            collection,
            doc,
            setDoc,
            addDoc,
            updateDoc,
            deleteDoc,
            getDoc,
            getDocs,
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
        const applyBrewFormInlineVisibility = () => {
            const formMount = document.getElementById('brewsFormMount');
            const formContainer = document.getElementById('formContainer');
            if (!formMount) return;
            const shouldShowInline = getCurrentViewState() === 'mine' && isLegacyBrewFormEnabled();
            const modal = document.getElementById('brewFormModal');
            const modalOpen = !!modal && !modal.classList.contains('hidden');
            formMount.classList.toggle('hidden', !shouldShowInline);
            if (formContainer) {
                if (shouldShowInline || modalOpen) formContainer.classList.remove('hidden');
                else formContainer.classList.add('hidden');
            }
            if (!shouldShowInline && !modalOpen) toggleForm?.(false);
        };

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
            loadBrewsTableStatePreset,
            deleteBrewsTableStatePreset
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

        const {
            applyAnimationPreference,
            updateBestOnlyToggleState,
            openPreferences
        } = createBrewsPreferencesModule({
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
            setPinnedBrewsPreferences: (value) => setPinnedBrewsPreferencesState(value),
            getCurrentUser: () => getCurrentUserState(),
            dataService,
            applyAnimationClass: (...args) => applyAnimationClass(...args),
            renderTable: (...args) => renderTable(...args),
            renderPinnedTiles: (...args) => renderPinnedTiles(...args),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'preferences' }),
            showAutoPinToast,
            onPinnedBrewsPreferencesChanged: () => {
                applyBrewFormInlineVisibility?.();
                refreshManualPinningVisibility?.();
                const currentCard = getCurrentCardCoffeeState();
                if (currentCard) updateCoffeeCardActionMenu?.(currentCard);
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
            maybeMigrateBeansLeft: (...args) => maybeMigrateBeansLeft(...args),
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
            applyBrewFormInlineVisibility: (...args) => applyBrewFormInlineVisibility(...args)
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
            closeImageModal: (...args) => closeImageModal(...args),
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

        const { extractCoffeeTypesFromBeans } = createCoffeeTypesExtractModule({
            getCurrentUser: () => getCurrentUserState(),
            getBeans: () => getBeansState(),
            getCoffeeTypes: () => getCoffeeTypesState(),
            setBeansState: (value) => setBeansState(value),
            dataService
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
            saveBeanFrozenDate,
            syncLegacyBeans,
            backfillBeanDatesFromBrews
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
            setBeansState: (value) => setBeansState(value),
            getCoffeeTypes: () => getCoffeeTypesState(),
            getBeansSearch: () => getBeansSearchState(),
            setBeansSearchState: (value) => setBeansSearchRuntimeState(value),
            getBeansFilters: () => getBeansFiltersState(),
            setBeansFiltersState: (value) => setBeansFiltersRuntimeState(value),
            getHasLoadedBeans: () => getHasLoadedBeansState(),
            getHasLoadedBrews: () => getHasLoadedBrewsState(),
            getCurrentBeanCardId: () => getCurrentBeanCardIdState(),
            setCurrentBeanCardId: (value) => setCurrentBeanCardIdState(value),
            getRoastBadge,
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            getCoffeeTypeForBean: (...args) => getCoffeeTypeForBean(...args),
            updateCoffeeTypeSelectors: (...args) => updateCoffeeTypeSelectors(...args),
            openAppConfirm
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
            backfillCoffeeTypeDecafFromScan,
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
            renderPinnedTiles: () => renderPinnedTiles()
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
            getRefreshBrewGearSelectors: () => refreshBrewGearSelectors
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
            initCoffeeDetailsUi,
            toggleForm,
            handleQuickEditRecipeInput
        } = createBrewFormUiModule({
            getScaData: () => scaData,
            getScaState: () => getScaStateRuntime(),
            setScaState: (value) => setScaStateRuntime(value),
            getRefreshManualPinningVisibility: () => refreshManualPinningVisibility,
            getCoffeeScale: () => coffeeScale
        });

        const {
            acceptFriendRequest,
            openFriendsModal,
            closeModal,
            switchModalTab,
            togglePublicProfile,
            updatePublicToggleUI,
            copyShareId,
            declineFriendRequest,
            followUser,
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
            imageCompression,
            getStarDisplay,
            openAppConfirm
        });

        const {
            openGraphModal,
            closeGraphModal,
            openImageModal,
            closeImageModal,
            resetZoom,
            initZoomListeners
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
            getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState()
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
            toggleActive,
            editCoffee,
            fastDuplicateFromCard,
            fastRepeatCoffee,
            duplicateFromCard,
            duplicateCoffee,
            cloneBrew,
            deleteCoffee,
            resetFormState,
            refreshManualPinningVisibility
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
                getPinnedBrewsPreferences: () => getPinnedBrewsPreferencesState(),
                getFirstBrewDateForBean,
                uploadPendingCoffeeTypeImage,
                clearPendingAIBeanImageFile,
                getCoffeeScale: () => coffeeScale,
                shouldUseLegacyBrewForm: () => isLegacyBrewFormEnabled(),
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

        installCardNavigationHandlers({
            navigateBeanCard,
            navigateCoffeeCard,
            navigateCoffeeCardFromGraph,
            navigateCoffeeTypeCard,
            navigateGasCard,
            handleEscapeKey
        });

        const authStateChangedHandler = createAuthStateChangedHandler({
            initUserData,
            loadFollowingList,
            changeView,
            initNotificationListener,
            openHelp,
            initZoomListeners,
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

        const { fillLegacyGrinderFromGear, migrateGrinderToGear } = createGearMigrationModule({
            dataService,
            getCurrentUser: () => getCurrentUserState(),
            getGasItems: () => getGasItemsState(),
            getCoffees: () => getCoffeesState(),
            setCoffees: (value) => setCoffeesState(value),
            refreshBrewGearSelectors: () => refreshBrewGearSelectors()
        });

        const { openBrewFormModal, closeBrewFormModal, discardBrewFormModal, submitBrewFormModal } = createBrewsFormModalModule({
            getCurrentView: () => getCurrentViewState(),
            changeView,
            resetFormState,
            toggleForm,
            openAppConfirm
        });
        applyBrewFormInlineVisibility();

        const openAddBrewFromPinned = createOpenAddBrewFromPinned({
            isLegacyBrewFormEnabled,
            openBrewFormModal,
            changeView,
            resetFormState,
            toggleForm,
            getCurrentView: () => getCurrentViewState()
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
                if (!isLegacyBrewFormEnabled()) {
                    openBrewFormModal(event, { reset: false, syncTitleFromForm: true });
                    return;
                }
                const formWrapper = document.getElementById('formWrapper');
                if (!formWrapper) return;
                const scrollToFormTop = (behavior = 'smooth') => {
                    const headerHeight = document.getElementById('appHeader')?.offsetHeight || 72;
                    const top = formWrapper.getBoundingClientRect().top + window.pageYOffset;
                    window.scrollTo({ top: Math.max(0, top - headerHeight - 8), behavior });
                };
                scrollToFormTop('smooth');
                requestAnimationFrame(() => scrollToFormTop('auto'));
                setTimeout(() => scrollToFormTop('auto'), 140);
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
            backfillBeanDatesFromBrews,
            backfillCoffeeTypeDecafFromScan,
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
            closeImageModal,
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
            extractCoffeeTypesFromBeans,
            fastDuplicateFromCard,
            fastRepeatCoffee,
            fillBeanDetails,
            fillLegacyGrinderFromGear,
            followUser,
            gasToggleActionMenu: toggleActionMenu,
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
            migrateGrinderToGear,
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
            openImageModal,
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
            recalculateAllBeanStockLeft,
            refreshFriendRequests,
            refreshTableData,
            removeFollower,
            removeBeanPhoto,
            removeCoffeeTypePhoto,
            removeGasPhoto,
            resetCardPhotoState,
            resetFormState,
            resetSca,
            resetZoom,
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
            setCoffeeTypesSearch,
            setCoffeeTypesSort,
            setGasSearch,
            setGasSort,
            setImportExportMode,
            setLabResultCustomGraphRenderMode,
            setNotesMode,
            setRating,
            setTempMode,
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
            syncLegacyBeans,
            toggleActionMenu,
            toggleActive,
            toggleAiMenu,
            toggleAllFriends,
            toggleBeanArchive,
            toggleBeanFrozen,
            toggleBeansAiMenu,
            toggleBeansQuickFilter,
            toggleCardMode,
            toggleCoffeeDetails,
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
                authContainer.innerHTML = `<div class="flex items-center gap-3"><button data-action-click="openFriendsModal()" class="relative flex-shrink-0 hover:opacity-80 transition-opacity"><img src="${user.photoURL}" class="w-8 h-8 flex-shrink-0 rounded-full border border-coffee-200 dark:border-[#44403c]" title="${user.displayName}"></button></div>`;
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

            applyBrewFormInlineVisibility?.();
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
