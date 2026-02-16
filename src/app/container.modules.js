        import { BAG_AI_URL, STATS_AI_URL, auth, db, storage, provider } from '../config/firebase.js';
        import { signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
        import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, query, writeBatch, where, orderBy, limit, startAfter } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
        import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
        import { initCoffeeScale } from '../features/scales/scales.js';
        import { createScaleModalsModule } from '../features/scales/scales-modals.js';
        import { parseBeanconquerorCSV, mapBeanconquerorBrews } from '../features/import-export/importers/beanconqueror.js';
        import { initEmailLinkAuth } from '../integrations/email-link-auth.js';
        import { closeAutoPinToast, showAutoPinToast, showToast } from '../core/notify.js';
        import { closeAppConfirm, openAppConfirm, resolveAppConfirm, installDialogAdapters } from '../core/confirm.js';
        import { getStarDisplay, formatBeanOpenedDate, formatTime, getRoastBadge } from '../core/format.js';
        import { createCoffeeDisplayModule } from '../core/coffee-display.js';
        import { createCoffeesController } from '../features/coffees/coffees.controller.js';
        import { createGasController } from '../features/gas/gas.controller.js';
        import { createBeansController } from '../features/beans/beans.controller.js';
        import { createSocialCoordinator } from './coordinators/social.coordinator.js';
        import { createGalleryModule } from '../features/gallery.js';
        import { createStatsModule } from '../features/stats/stats.js';
        import { createImportExportModule } from '../features/import-export/import-export.js';
        import { createBrewsCardActionsModule } from '../features/brews/brews-card-actions.js';
        import { createBrewsCardUiModule } from '../features/brews/brews-card-ui.js';
        import { createBrewsCardShareModule } from '../features/brews/brews-card-share.js';
        import { createBrewsCardGraphModule } from '../features/brews/brews-card-graph.js';
        import { createBrewsCardPhotoModule } from '../features/brews/brews-card-photo.js';
        import { createBrewsFormModalModule } from '../features/brews/brews-form-modal.js';
        import { createBrewsCoordinator, createBrewsTableCoordinator } from './coordinators/brews.coordinator.js';
        import { createBrewsController } from '../features/brews/brews.controller.js';
        import { createBrewsRepo } from '../features/brews/brews.repo.js';
        import { registerBrewsFilterCommands } from '../features/brews/brews-filter-commands.js';
        import { createBrewsPinAutopinModule } from '../features/pin/brews-pin-autopin.js';
        import { createBrewsPreferencesModule } from '../features/preferences.js';
        import { createDataService } from './services/data.service.js';
        import { createStorageService } from './services/storage.service.js';
        import { createAuthService } from './services/auth.service.js';
        import { createSessionAuthViewModule } from '../features/session-auth-view.js';
        import { createAiImportModule } from '../features/ai-import.js';
        import { createStatsAiProfileModule } from '../features/stats/stats-ai-profile.js';
        import { createBrewFormLookupModule } from '../features/brews/brew-form-lookup.js';
        import { createBrewFormUiModule } from '../features/brews/brew-form-ui.js';
        import { createBrewCsvRecipeModule } from '../features/brews/brew-csv-recipe.js';
        import { createCoffeeTypesExtractModule } from '../features/coffees/coffee-types-extract.js';
        import { createActionMenuModule } from '../features/ui/action-menu.js';
        import { createUiShellModule } from '../features/ui-shell.js';
        import { createMediaModalsModule } from '../features/media/media-modals.js';
        import { createPinCoordinator } from './coordinators/pin.coordinator.js';
        import { createActionsRegistry } from './actions.registry.js';
        import { createInitialAppState } from './container.state.js';
        import { createAuthStateChangedHandler } from './runtime/auth-state.js';
        import { createGearMigrationModule } from './runtime/gear-migration.js';
        import { createOpenAddBrewFromPinned } from './runtime/open-add-brew.js';
        import { installCardNavigationHandlers } from './runtime/card-navigation.js';
        
export const createAppContainerModules = ({ appCommands = null, appEvents = null } = {}) => {

        const emailLinkAuth = initEmailLinkAuth({ auth }) || {};
        installDialogAdapters(showToast);
        
        const initialState = createInitialAppState();
        let {
            currentUser,
            currentView,
            coffees,
            beans,
            hasLoadedBrews,
            hasLoadedBeans,
            coffeeTypes,
            gasItems,
            following,
            followers,
            unsubscribeData,
            unsubscribeBeans,
            unsubscribeCoffeeTypes,
            unsubscribeGas,
            unsubscribeNotifications,
            isPublic,
            currentUploadCoffeeId,
            currentShareMode,
            currentCardCoffee,
            currentCoffeeCardId,
            currentCardGraphData,
            pendingImportBrews,
            currentCoffeeTypeId,
            currentGasId,
            coffeeTypesSortKey,
            coffeeTypesSortDir,
            coffeeTypesSearch,
            coffeeTypesFilters,
            gasSortKey,
            gasSortDir,
            gasSearch,
            gasFilters,
            currentStatsData,
            currentBeanMeterPeriod,
            lastGalleryDoc,
            lastGalleryVisit,
            currentGalleryMode,
            isGalleryLoading,
            displayedBrewsCount,
            columnDefs,
            columnPreferences,
            pinnedBrewsPreferences,
            scaData,
            scaState,
            currentBeanCardId,
            beansSearch,
            beansFilters,
            currentSort,
            activeFilters
        } = initialState;
        const BREWS_PER_PAGE = initialState.BREWS_PER_PAGE;
        const dispatchBrewOpenForm = (event = null, options = {}) =>
            appCommands?.dispatch?.(
                'brews.openForm',
                { event, options },
                { source: 'container.brewsOpenForm' }
            );
        const isLegacyBrewFormEnabled = () => pinnedBrewsPreferences?.useLegacyBrewForm !== false;
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
        const brewsRepo = createBrewsRepo({
            dataService,
            getCurrentUser: () => currentUser
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
            const shouldShowInline = currentView === 'mine' && isLegacyBrewFormEnabled();
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
                getCoffees: () => coffees,
                getBeans: () => beans,
                getCoffeeTypes: () => coffeeTypes,
                getGasItems: () => gasItems,
                getCurrentView: () => currentView,
                getCurrentSort: () => currentSort,
                setCurrentSort: (value) => { currentSort = value; },
                getActiveFilters: () => activeFilters,
                setActiveFilters: (value) => { activeFilters = value; },
                getDisplayedBrewsCount: () => displayedBrewsCount,
                setDisplayedBrewsCount: (value) => { displayedBrewsCount = value; },
                getBrewsPerPage: () => BREWS_PER_PAGE,
                getColumnDefs: () => columnDefs,
                getColumnPreferences: () => columnPreferences,
                getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
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
                getColumnPreferences: () => columnPreferences,
                setColumnPreferences: (value) => { columnPreferences = value; }
            }
        });

        const {
            loadLegacyPinnedBrewsPreferences,
            applyAnimationPreference,
            updateBestOnlyToggleState,
            openPreferences
        } = createBrewsPreferencesModule({
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
            setPinnedBrewsPreferences: (value) => { pinnedBrewsPreferences = value; },
            getCurrentUser: () => currentUser,
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
                const currentCard = currentCardCoffee;
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
            getCurrentUser: () => currentUser,
            getBeans: () => beans,
            getCoffees: () => coffees,
            getBeanCalculatedStock: (...args) => getBeanCalculatedStock(...args),
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
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
            getCurrentUser: () => currentUser,
            toggleForm: (...args) => toggleForm(...args),
            dataService,
            storageService,
            db,
            doc,
            setDoc,
            updateDoc,
            collection,
            writeBatch,
            storage,
            ref,
            uploadBytes,
            getDownloadURL,
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'ai-import' }),
            getCoffeeTypes: () => coffeeTypes,
            setCoffeeTypes: (value) => { coffeeTypes = value; },
            openCoffeeTypeCard: (...args) => openCoffeeTypeCard(...args),
            enterCoffeeTypeEditMode: (...args) => enterCoffeeTypeEditMode(...args)
        });

        const { triggerAIProfile } = createStatsAiProfileModule({
            STATS_AI_URL,
            getCurrentStatsData: () => currentStatsData,
            getCurrentUser: () => currentUser
        });
        let refreshBrewGearSelectors = () => {};

        const {
            googleLogin,
            googleLogout,
            initUserData,
            markOnboardingSeen,
            changeView,
            initNotificationListener,
            clearViewSubscriptions,
            clearNotificationSubscription
        } = createSessionAuthViewModule({
            authService,
            dataService,
            getCurrentUser: () => currentUser,
            setCurrentView: (value) => { currentView = value; },
            syncFriendViewSelectValues: (...args) => syncFriendViewSelectValues(...args),
            getUnsubscribeData: () => unsubscribeData,
            setUnsubscribeData: (value) => { unsubscribeData = value; },
            getUnsubscribeBeans: () => unsubscribeBeans,
            setUnsubscribeBeans: (value) => { unsubscribeBeans = value; },
            getUnsubscribeCoffeeTypes: () => unsubscribeCoffeeTypes,
            setUnsubscribeCoffeeTypes: (value) => { unsubscribeCoffeeTypes = value; },
            getUnsubscribeGas: () => unsubscribeGas,
            setUnsubscribeGas: (value) => { unsubscribeGas = value; },
            getUnsubscribeNotifications: () => unsubscribeNotifications,
            setUnsubscribeNotifications: (value) => { unsubscribeNotifications = value; },
            setHasLoadedBrews: (value) => { hasLoadedBrews = value; },
            setHasLoadedBeans: (value) => { hasLoadedBeans = value; },
            toggleForm: (...args) => toggleForm(...args),
            getCurrentSort: () => currentSort,
            setCoffees: (value) => { coffees = value; },
            getCoffees: () => coffees,
            setBeans: (value) => { beans = value; },
            setCoffeeTypes: (value) => { coffeeTypes = value; },
            setGasItems: (value) => { gasItems = value; },
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
            getColumnPreferences: () => columnPreferences,
            loadColumnPreferencesFromStorage: (...args) => loadColumnPreferencesFromStorage(...args),
            saveColumnPreferencesToStorage: (...args) => saveColumnPreferencesToStorage(...args),
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
            setPinnedBrewsPreferences: (value) => { pinnedBrewsPreferences = value; },
            loadLegacyPinnedBrewsPreferences: (...args) => loadLegacyPinnedBrewsPreferences(...args),
            applyAnimationPreference: (...args) => applyAnimationPreference(...args),
            setIsPublic: (value) => { isPublic = value; },
            updatePublicToggleUI: (...args) => updatePublicToggleUI(...args),
            getCoffeeScale: () => coffeeScale,
            refreshBrewGearSelectors: () => refreshBrewGearSelectors(),
            getLastGalleryVisit: () => lastGalleryVisit,
            setLastGalleryVisit: (value) => { lastGalleryVisit = value; },
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
            getBeans: () => beans,
            getCoffeeTypes: () => coffeeTypes,
            getCoffees: () => coffees,
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            updateCoffeeDetailsTitle: (...args) => updateCoffeeDetailsTitle(...args)
        });

        const { extractCoffeeTypesFromBeans } = createCoffeeTypesExtractModule({
            getCurrentUser: () => currentUser,
            getBeans: () => beans,
            getCoffeeTypes: () => coffeeTypes,
            setBeansState: (value) => { beans = value; },
            dataService
        });


        const openSelectedBeanForEdit = () => {
            const select = document.getElementById('savedBeanSelect');
            const beanId = select?.value;
            if (!beanId) return;
            appCommands?.dispatch?.(
                'beans.openCardForEdit',
                { beanId, event: null },
                { source: 'container.openSelectedBeanForEdit' }
            );
        };

        const parseNum = (v) => (v === '' || v === null || isNaN(v)) ? null : parseFloat(v);

        const toggleDrinkOther = () => {
            const val = document.getElementById('drinkType').value; const input = document.getElementById('drinkOther');
            if(val === 'Other') input.classList.remove('hidden'); else input.classList.add('hidden');
        };

        const toggleMethodOther = () => {
            const val = document.getElementById('method').value; const input = document.getElementById('methodOther');
            if(val === 'Other') input.classList.remove('hidden'); else input.classList.add('hidden');
            if (coffeeScale?.applyGraphTogglePrefsForMethod) coffeeScale.applyGraphTogglePrefsForMethod();
        };

        const methodOtherInput = document.getElementById('methodOther');
        if (methodOtherInput) {
            methodOtherInput.addEventListener('change', () => {
                if (coffeeScale?.applyGraphTogglePrefsForMethod) coffeeScale.applyGraphTogglePrefsForMethod();
            });
        }
        // --- Beans Management Functions ---
        const createBeanFromModal = async () => {
            if (!currentUser) return alert("Please sign in.");
            const nowIso = new Date().toISOString();
            const beanData = {
                roaster: '',
                farmer: '',
                origin: '',
                processing: '',
                variety: '',
                roastType: '',
                shopUrl: '',
                archived: false,
                frozen: false,
                stock: 250,
                beansLeft: 250,
                openedDate: null,
                frozenDate: null,
                archivedDate: null,
                roastDate: null,
                createdAt: nowIso,
                updatedAt: nowIso
            };

            try {
                const ref = await addDoc(collection(db, 'users', currentUser.uid, 'beans'), beanData);
                const newBean = { id: ref.id, ...beanData };
                beans.push(newBean);
                renderBeansTable();
                await appCommands?.dispatch?.(
                    'pin.autoPinOpenBagsIfEnabled',
                    {},
                    { source: 'container.createBeanFromModal' }
                );
                appCommands?.dispatch?.(
                    'beans.openCardForEdit',
                    { beanId: ref.id, event: null },
                    { source: 'container.createBeanFromModal' }
                );
            } catch (err) {
                console.error('Error creating bean:', err);
                alert('Failed to create bean.');
            }
        };
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
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCoffees: () => coffees,
            getBeans: () => beans,
            setBeansState: (value) => { beans = value; },
            getCoffeeTypes: () => coffeeTypes,
            getBeansSearch: () => beansSearch,
            setBeansSearchState: (value) => { beansSearch = value; },
            getBeansFilters: () => beansFilters,
            setBeansFiltersState: (value) => { beansFilters = value; },
            getHasLoadedBeans: () => hasLoadedBeans,
            getHasLoadedBrews: () => hasLoadedBrews,
            getCurrentBeanCardId: () => currentBeanCardId,
            setCurrentBeanCardId: (value) => { currentBeanCardId = value; },
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
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentCoffeeTypeId: () => currentCoffeeTypeId,
            setCurrentCoffeeTypeId: (value) => { currentCoffeeTypeId = value; },
            getCoffeeTypes: () => coffeeTypes,
            setCoffeeTypesState: (value) => { coffeeTypes = value; },
            getCoffeeTypesSearch: () => coffeeTypesSearch,
            setCoffeeTypesSearchState: (value) => { coffeeTypesSearch = value; },
            getCoffeeTypesFilters: () => coffeeTypesFilters,
            setCoffeeTypesFiltersState: (value) => { coffeeTypesFilters = value; },
            getCoffeeTypesSortKey: () => coffeeTypesSortKey,
            setCoffeeTypesSortKeyState: (value) => { coffeeTypesSortKey = value; },
            getCoffeeTypesSortDir: () => coffeeTypesSortDir,
            setCoffeeTypesSortDirState: (value) => { coffeeTypesSortDir = value; },
            getBeans: () => beans,
            setBeansState: (value) => { beans = value; },
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
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentGasId: () => currentGasId,
            setCurrentGasId: (value) => { currentGasId = value; },
            getGasItems: () => gasItems,
            setGasItemsState: (value) => { gasItems = value; },
            getGasSearch: () => gasSearch,
            setGasSearchState: (value) => { gasSearch = value; },
            getGasFilters: () => gasFilters,
            setGasFiltersState: (value) => { gasFilters = value; },
            getGasSortKey: () => gasSortKey,
            setGasSortKeyState: (value) => { gasSortKey = value; },
            getGasSortDir: () => gasSortDir,
            setGasSortDirState: (value) => { gasSortDir = value; },
            getCoffees: () => coffees,
            setCoffeesState: (value) => { coffees = value; },
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
            getScaState: () => scaState,
            setScaState: (value) => { scaState = value; },
            getRefreshManualPinningVisibility: () => refreshManualPinningVisibility,
            getCoffeeScale: () => coffeeScale
        });

        const {
            openFriendsModal,
            closeModal,
            switchModalTab,
            togglePublicProfile,
            updatePublicToggleUI,
            copyShareId,
            followUser,
            unfollowUser,
            syncFriendViewSelectValues,
            updateFriendViewSelectors,
            loadFollowingList,
            loadFollowersList
        } = createSocialCoordinator({
            dataService,
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            setCurrentView: (value) => { currentView = value; },
            getFollowing: () => following,
            setFollowingState: (value) => { following = value; },
            setFollowersState: (value) => { followers = value; },
            getIsPublic: () => isPublic,
            setIsPublicState: (value) => { isPublic = value; },
            openAppConfirm,
            changeView
        });

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
            getCurrentUser: () => currentUser,
            getCurrentUploadCoffeeId: () => currentUploadCoffeeId,
            setCurrentUploadCoffeeId: (value) => { currentUploadCoffeeId = value; },
            getLastGalleryVisit: () => lastGalleryVisit,
            setLastGalleryVisit: (value) => { lastGalleryVisit = value; },
            getCurrentGalleryMode: () => currentGalleryMode,
            setCurrentGalleryMode: (value) => { currentGalleryMode = value; },
            getLastGalleryDoc: () => lastGalleryDoc,
            setLastGalleryDoc: (value) => { lastGalleryDoc = value; },
            getIsGalleryLoading: () => isGalleryLoading,
            setIsGalleryLoading: (value) => { isGalleryLoading = value; },
            getFollowing: () => following,
            getCoffees: () => coffees,
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
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getFollowing: () => following,
            dataService,
            getCoffeeTypeDisplay: (brew) => getCoffeeTypeDisplay(brew),
            getCoffeeTypeForBrew: (brew) => getCoffeeTypeForBrew(brew),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'stats' }),
            setCurrentStatsData: (value) => { currentStatsData = value; },
            getCurrentStatsData: () => currentStatsData,
            setCurrentBeanMeterPeriod: (value) => { currentBeanMeterPeriod = value; },
            getCurrentBeanMeterPeriod: () => currentBeanMeterPeriod,
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
            getCurrentUser: () => currentUser,
            getPendingImportBrews: () => pendingImportBrews,
            setPendingImportBrews: (value) => { pendingImportBrews = value; },
            parseBeanconquerorCSV,
            mapBeanconquerorBrews,
            dataService,
            getFilteredCoffees: () => getFilteredCoffees(),
            getBeans: () => beans,
            getCoffeeTypes: () => coffeeTypes,
            getCoffeeTypeDisplay: (brew) => getCoffeeTypeDisplay(brew),
            getCoffeeTypeForBrew: (brew) => getCoffeeTypeForBrew(brew),
            openAppConfirm
        });

        const { getCoffeeTypeForBrew, getCoffeeTypeDisplay, getCoffeeTypeForBean, getBeanCoffeeTypeDisplay } =
            createCoffeeDisplayModule({
                getBeans: () => beans,
                getCoffeeTypes: () => coffeeTypes
            });

        const { exportCSV, handleRecipeInput } = createBrewCsvRecipeModule({
            getFilteredCoffees,
            getCoffeeTypeDisplay
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
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentCoffeeCardId: () => currentCoffeeCardId,
            getCurrentCoffeeCard: () => currentCardCoffee,
            getCoffees: () => coffees,
            getBeans: () => beans,
            getGasItems: () => gasItems,
            getCoffeeTypes: () => coffeeTypes,
            brewsRepo,
            parseNum,
            handleQuickEditRecipeInput: (...args) => handleQuickEditRecipeInput(...args),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'brews.card-actions' }),
            closeCoffeeCard: (...args) => closeCoffeeCard(...args),
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            getFirstBrewDateForBean: (...args) => getFirstBrewDateForBean(...args),
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences
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
            getCurrentView: () => currentView,
            getCoffees: () => coffees,
            getBeans: () => beans,
            getFilteredCoffees: () => getFilteredCoffees(),
            getDisplayedBrewsCount: () => displayedBrewsCount,
            getCoffeeTypeForBrew: (...args) => getCoffeeTypeForBrew(...args),
            getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
            getStarDisplay,
            formatTime,
            getTempBadge: (...args) => getTempBadge(...args),
            setCurrentCardCoffee: (value) => { currentCardCoffee = value; },
            getCurrentCoffeeCardId: () => currentCoffeeCardId,
            setCurrentCoffeeCardId: (value) => { currentCoffeeCardId = value; },
            setCurrentCardGraphData: (value) => { currentCardGraphData = value; },
            updateCoffeeCardActionMenu: (...args) => updateCoffeeCardActionMenu(...args),
            dispatchCommand: (commandName, payload) =>
                appCommands?.dispatch?.(commandName, payload, { source: 'brews.card-ui' }),
            cancelBrewQuickEditMode: (...args) => cancelBrewQuickEditMode(...args),
            resetCardPhotoState: (...args) => resetCardPhotoState(...args),
            toggleCardMode: (...args) => toggleCardMode(...args)
        });
        const { toggleCardMode, shareCoffeeCard, generateShareImage } = createBrewsCardShareModule({
            getCoffees: () => coffees,
            setCurrentCoffeeCardId: (value) => { currentCoffeeCardId = value; },
            getCurrentCardCoffee: () => currentCardCoffee,
            getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
            setCurrentShareMode: (value) => { currentShareMode = value; },
            cancelBrewQuickEditMode: (...args) => cancelBrewQuickEditMode(...args),
            resetCardPhotoState: (...args) => resetCardPhotoState(...args),
            populateCardData: (...args) => populateCardData(...args),
            updateCoffeeCardNav: (...args) => updateCoffeeCardNav(...args),
            html2canvas
        });

        const { openCardGraphModal, closeCardGraphModal, updateCoffeeGraphNav, navigateCoffeeCardFromGraph } = createBrewsCardGraphModule({
            getCurrentCardGraphData: () => currentCardGraphData,
            getCurrentCardCoffee: () => currentCardCoffee,
            getCurrentCoffeeCardId: () => currentCoffeeCardId,
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
                getGasItems: () => gasItems,
                fillBeanDetails
            },
            actionsDeps: {
                getCurrentUser: () => currentUser,
                getCurrentView: () => currentView,
                getCurrentCoffeeCardId: () => currentCoffeeCardId,
                getCurrentCardCoffee: () => currentCardCoffee,
                getCoffees: () => coffees,
                getBeans: () => beans,
                getCoffeeTypes: () => coffeeTypes,
                getGasItems: () => gasItems,
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
                getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
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
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentSort: () => currentSort,
            getActiveFilters: () => activeFilters,
            getCoffees: () => coffees,
            setCoffees: (value) => { coffees = value; },
            getBeans: () => beans,
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
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
        const handleAuthStateChanged = async (user) => {
            currentUser = user;
            await authStateChangedHandler(user);
        };

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
            getCurrentUser: () => currentUser,
            getGasItems: () => gasItems,
            getCoffees: () => coffees,
            setCoffees: (value) => { coffees = value; },
            refreshBrewGearSelectors: () => refreshBrewGearSelectors()
        });

        const { openBrewFormModal, closeBrewFormModal, discardBrewFormModal, submitBrewFormModal } = createBrewsFormModalModule({
            getCurrentView: () => currentView,
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
            getCurrentView: () => currentView
        });

        registerBrewsFilterCommands({
            appCommands,
            clearSearch,
            clearAllFilters,
            applyFilter,
            renderTable,
            renderActiveFilters,
            getBrewsPerPage: () => BREWS_PER_PAGE,
            setDisplayedBrewsCount: (value) => { displayedBrewsCount = value; }
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
                activeFilters.coffeeType = coffeeTypeId;
                displayedBrewsCount = BREWS_PER_PAGE;
                renderTable();
                renderActiveFilters();
            },
            showForBean: (beanId) => {
                if (!beanId) return;
                clearSearch();
                clearAllFilters();
                activeFilters.bean = beanId;
                displayedBrewsCount = BREWS_PER_PAGE;
                renderTable();
                renderActiveFilters();
            },
            openFormForBean: (beanId, event = null) => {
                if (!beanId) return;
                if (currentView !== 'mine') changeView('mine');
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

        const actions = createActionsRegistry({
            commonActions: {
                addScaToNotes,
                applyFilter,
                applyFilterFromQuick,
                cancelBeanEditMode,
                changeStatsView,
                changeView,
                clearAllFilters,
                clearSearch,
                cloneBrew,
                closeAbout,
                closeBeanCard,
                closeCardGraphModal,
                closeCoffeeCard,
                closeCoffeeScaleModal,
                closeConnectScaleModal,
                closeEasterEgg,
                closeExportModal,
                closeGraphModal,
                closeHelp,
                closeImageModal,
                closeImportExportModal,
                closeImportModal,
                closeMenus,
                closeModal,
                closeStats,
                closeUploadModal,
                copyShareId,
                deleteCoffee,
                deletePhoto,
                discardForm,
                duplicateCoffee,
                duplicateFromCard,
                editCoffee,
                enterBeanEditMode,
                exportBrewsAsBeanconquerorCSV,
                exportBrewsAsCSV,
                exportCSV,
                exportCoffeesAsCSV,
                exportCoffeesAsJSON,
                fastDuplicateFromCard,
                fillBeanDetails,
                followUser,
                generateShareImage,
                getFilteredCoffees,
                googleLogin,
                googleLogout,
                handleAIFile,
                handleBeanCardOverlayClick,
                handleBeansAIFile,
                handleCardPhoto,
                handleCoffeeCardOverlayClick,
                handleCoffeeTypeCardOverlayClick,
                handleFormSubmit,
                handleGasCardOverlayClick,
                handleImportFileChange,
                handlePhotoSubmit,
                handleQuickEditRecipeInput,
                hideAiProfile,
                hideBrewsTablePrefsModal,
                hideGalleryModal,
                hidePreferencesModal,
                loadMoreBrews,
                loadMoreGallery,
                navigateBeanCard,
                navigateCoffeeCard,
                navigateCoffeeCardFromGraph,
                openAbout,
                openBrewWithBean,
                openBrewsTablePrefs,
                brewsOpenCard,
                openCardGraphModal,
                openCoffeeCardQuickEdit,
                openCoffeeScaleModal,
                openConnectScaleModal,
                openEasterEgg,
                openExportModal,
                openExternalUrl,
                openFilterMenu,
                openFriendsModal,
                openGallery,
                openGraphModal,
                openHelp,
                openImageModal,
                openImportExportModal,
                openImportModal,
                openPreferences,
                openQuickFilterValues,
                openStats,
                openUploadModal,
                performExport,
                performImport,
                refreshTableData,
                resetCardPhotoState,
                resetFormState,
                resetSca,
                resetZoom,
                saveBeanCardEdits,
                sendEmailLinkActivation,
                sendEmailLinkLogin,
                setImportExportMode,
                setNotesMode,
                setRating,
                setTempMode,
                shareCoffeeCard,
                sortBy,
                switchGalleryTab,
                switchModalTab,
                toggleActive,
                toggleAiMenu,
                toggleAllFriends,
                toggleBeansAiMenu,
                toggleCardMode,
                toggleDrinkOther,
                toggleForm,
                toggleMainMenu,
                toggleMethodOther,
                togglePublicProfile,
                toggleQuickFilter,
                toggleStatsUniqueTable,
                triggerAIScan,
                triggerAIProfile,
                triggerBeansAIScan,
                triggerCardPhoto,
                unfollowUser,
                updateBeanMeter
            },
            brewActions: {
                cancelBrewQuickEditMode,
                editBrewFromCard,
                enterBrewQuickEditMode,
                fastRepeatCoffee,
                saveBrewQuickEdits,
                showBeanForBrew,
                showCoffeeForBrew,
                togglePinnedTiles
            },
            beanActions: {
                applyBeansFilterFromQuick,
                backfillBeanDatesFromBrews,
                clearBeansFilters,
                clearBeansSearch,
                closeBeans,
                deleteBean,
                extractCoffeeTypesFromBeans,
                handleBeanPhoto,
                openBeanPhoto,
                openBeans,
                openBeansQuickFilterValues,
                openCoffeeFromBeanEdit,
                openNewBag,
                openSelectedBeanForEdit,
                recalculateAllBeanStockLeft,
                removeBeanPhoto,
                saveBeanFrozenDate,
                saveBeanOpenedDate,
                saveBeanRoastDate,
                saveBeanStock,
                setBeansSearch,
                showBrewsForBean,
                showCoffeeForBean,
                syncLegacyBeans,
                toggleBeanArchive,
                toggleBeanFrozen,
                toggleBeansQuickFilter,
                triggerBeanPhoto
            },
            coffeeActions: {
                applyCoffeeTypesFilterFromQuick,
                cancelCoffeeTypeEditMode,
                clearCoffeeTypesFilters,
                clearCoffeeTypesSearch,
                closeCoffeeTypeCard,
                closeCoffeeTypes,
                createBeanFromModal,
                createCoffeeTypeFromModal,
                deleteCoffeeType,
                deleteCoffeeTypeFromTable,
                enterCoffeeTypeEditMode,
                handleCoffeeTypePhoto,
                handleCoffeeTypesAIFile,
                navigateCoffeeTypeCard,
                openCoffeeTypeCard,
                openCoffeeTypeFromTableEdit,
                openCoffeeTypePhoto,
                openCoffeeTypeShopUrl,
                openCoffeeTypes,
                openCoffeeTypesQuickFilterValues,
                openNewBagForCoffeeType,
                openNewBagForCoffeeTypeFromTable,
                removeCoffeeTypePhoto,
                saveCoffeeTypeEdits,
                setCoffeeTypesSearch,
                setCoffeeTypesSort,
                showBeansForCoffeeType,
                showBeansForCoffeeTypeFromTable,
                showBrewsForCoffeeType,
                showBrewsForCoffeeTypeFromTable,
                toggleCoffeeTypesAiMenu,
                toggleCoffeeTypesQuickFilter,
                triggerCoffeeTypePhoto,
                triggerCoffeeTypesAIScan
            },
            gasActions: {
                applyGasFilterFromQuick,
                bulkAddGearToBrews,
                cancelGasEditMode,
                clearGasFilters,
                clearGasSearch,
                closeGasBulkAddModal,
                closeGasCard,
                closeGasList,
                closeGasMergeModal,
                createGasItemFromModal,
                deleteGasFromTable,
                deleteGasItem,
                enterGasEditMode,
                fillLegacyGrinderFromGear,
                handleGasPhoto,
                mergeGasItem,
                migrateGrinderToGear,
                navigateGasCard,
                openGasBulkAddFromTable,
                openGasBulkAddModal,
                openGasCard,
                openGasFromTableEdit,
                openGasList,
                openGasMergeFromTable,
                openGasMergeModal,
                openGasPhoto,
                openGasQuickFilterValues,
                removeGasPhoto,
                saveGasEdits,
                setGasSearch,
                setGasSort,
                showBrewsForGear,
                toggleGasArchive,
                toggleGasArchiveFromTable,
                toggleGasQuickFilter,
                triggerGasPhoto
            },
            uiActions: {
                closeBeanCardMenu,
                closeCoffeeCardMenu,
                closeCoffeeTypeCardMenu,
                toggleCoffeeDetails
            },
            systemActions: {
                closeAppConfirm,
                closeAutoArchiveToast,
                closeAutoPinToast,
                closeBeanCreatedToast,
                closeBrewFormModal,
                closeCoffeeTypeCreatedToast,
                discardBrewFormModal,
                handleAutoArchiveToastAction,
                handleBeanCreatedToastAction,
                openAddBrewFromPinned,
                resolveAppConfirm,
                submitBrewFormModal
            }
        });

        const featureActions = {
            beans: {
                applyBeansFilterFromQuick,
                backfillBeanDatesFromBrews,
                beansChangeView: changeView,
                beansOpenCard,
                beansOpenCardForEdit,
                beansToggleActionMenu: toggleActionMenu,
                cancelBeanEditMode,
                clearBeansFilters,
                clearBeansSearch,
                closeBeanCard,
                closeBeans,
                createBeanFromModal,
                deleteBean,
                enterBeanEditMode,
                handleBeanCardOverlayClick,
                handleBeanPhoto,
                handleBeansAIFile,
                navigateBeanCard,
                openBeansQuickFilterValues,
                openBrewWithBean,
                openCoffeeFromBeanEdit,
                openBeanPhoto,
                openNewBag,
                recalculateAllBeanStockLeft,
                removeBeanPhoto,
                saveBeanCardEdits,
                saveBeanFrozenDate,
                saveBeanOpenedDate,
                saveBeanRoastDate,
                saveBeanStock,
                setBeansSearch,
                showBrewsForBean,
                showCoffeeForBean,
                syncLegacyBeans,
                toggleBeanArchive,
                toggleBeanFrozen,
                toggleBeansAiMenu,
                toggleBeansQuickFilter,
                triggerBeanPhoto,
                triggerBeansAIScan
            },
            coffees: {
                applyCoffeeTypesFilterFromQuick,
                cancelCoffeeTypeEditMode,
                clearCoffeeTypesFilters,
                clearCoffeeTypesSearch,
                coffeesChangeView: changeView,
                coffeesToggleActionMenu: toggleActionMenu,
                closeCoffeeTypeCard,
                closeCoffeeTypes,
                createCoffeeTypeFromModal,
                deleteCoffeeType,
                deleteCoffeeTypeFromTable,
                enterCoffeeTypeEditMode,
                handleCoffeeTypeCardOverlayClick,
                handleCoffeeTypePhoto,
                handleCoffeeTypesAIFile,
                navigateCoffeeTypeCard,
                openCoffeeTypeCard,
                openCoffeeTypeFromTableEdit,
                openCoffeeTypePhoto,
                openCoffeeTypeShopUrl,
                openCoffeeTypesQuickFilterValues,
                openNewBagForCoffeeType,
                openNewBagForCoffeeTypeFromTable,
                removeCoffeeTypePhoto,
                saveCoffeeTypeEdits,
                setCoffeeTypesSearch,
                setCoffeeTypesSort,
                showBeansForCoffeeType,
                showBeansForCoffeeTypeFromTable,
                showBrewsForCoffeeType,
                showBrewsForCoffeeTypeFromTable,
                toggleCoffeeTypesAiMenu,
                toggleCoffeeTypesQuickFilter,
                triggerCoffeeTypePhoto,
                triggerCoffeeTypesAIScan
            },
            brews: {
                addScaToNotes,
                applyFilter,
                applyFilterFromQuick,
                brewsChangeView: changeView,
                brewsToggleActionMenu: toggleActionMenu,
                cancelBrewQuickEditMode,
                clearAllFilters,
                clearSearch,
                cloneBrew,
                closeBrewFormModal,
                closeCardGraphModal,
                closeCoffeeCard,
                closeCoffeeScaleModal,
                closeConnectScaleModal,
                deleteCoffee,
                discardBrewFormModal,
                discardForm,
                duplicateCoffee,
                duplicateFromCard,
                editBrewFromCard,
                editCoffee,
                fastDuplicateFromCard,
                fastRepeatCoffee,
                fillBeanDetails,
                generateShareImage,
                handleAIFile,
                handleCardPhoto,
                handleCoffeeCardOverlayClick,
                handleFormSubmit,
                handleQuickEditRecipeInput,
                handleRecipeInput,
                hideBrewsTablePrefsModal,
                loadMoreBrews,
                navigateCoffeeCard,
                navigateCoffeeCardFromGraph,
                openBrewsTablePrefs,
                brewsOpenCard,
                openCardGraphModal,
                openCoffeeCardQuickEdit,
                openCoffeeScaleModal,
                openConnectScaleModal,
                openFilterMenu,
                openGraphModal,
                openImageModal,
                openQuickFilterValues,
                openSelectedBeanForEdit,
                refreshTableData,
                resetCardPhotoState,
                resetFormState,
                resetSca,
                saveBrewQuickEdits,
                setNotesMode,
                setRating,
                setTempMode,
                shareCoffeeCard,
                showBeanForBrew,
                showCoffeeForBrew,
                sortBy,
                submitBrewFormModal,
                toggleActive,
                toggleAiMenu,
                toggleCardMode,
                toggleCoffeeDetails,
                toggleDrinkOther,
                toggleForm,
                toggleMethodOther,
                toggleQuickFilter,
                triggerAIScan,
                triggerCardPhoto
            },
            gas: {
                applyGasFilterFromQuick,
                bulkAddGearToBrews,
                cancelGasEditMode,
                clearGasFilters,
                clearGasSearch,
                gasChangeView: changeView,
                gasToggleActionMenu: toggleActionMenu,
                closeGasBulkAddModal,
                closeGasCard,
                closeGasList,
                closeGasMergeModal,
                createGasItemFromModal,
                deleteGasFromTable,
                deleteGasItem,
                enterGasEditMode,
                handleGasCardOverlayClick,
                handleGasPhoto,
                mergeGasItem,
                navigateGasCard,
                openGasBulkAddFromTable,
                openGasBulkAddModal,
                openGasCard,
                openGasFromTableEdit,
                openGasMergeFromTable,
                openGasMergeModal,
                openGasPhoto,
                openGasQuickFilterValues,
                removeGasPhoto,
                saveGasEdits,
                setGasSearch,
                setGasSort,
                showBrewsForGear,
                toggleGasArchive,
                toggleGasArchiveFromTable,
                toggleGasQuickFilter,
                triggerGasPhoto
            },
            pin: {
                pinToggleActionMenu: toggleActionMenu,
                togglePinnedTiles
            },
            social: {
                closeModal,
                copyShareId,
                followUser,
                googleLogout,
                openFriendsModal,
                switchModalTab,
                togglePublicProfile,
                unfollowUser
            }
        };

        const searchInput = document.getElementById('globalSearch'); 
        if(searchInput) { searchInput.addEventListener('input', (e) => { const clearBtn = document.getElementById('searchClearBtn'); if(e.target.value.length > 0) clearBtn.classList.remove('hidden'); else clearBtn.classList.add('hidden'); displayedBrewsCount = BREWS_PER_PAGE; renderTable(); }); }


        return { handleAuthStateChanged, actions, featureActions, appCommands, appEvents };
};
