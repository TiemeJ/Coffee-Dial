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
        import { createCoffeesCoordinator } from './coordinators/coffees.coordinator.js';
        import { createGasCoordinator } from './coordinators/gas.coordinator.js';
        import { createBeansCoordinator } from './coordinators/beans.coordinator.js';
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
        
export const createAppContainerModules = () => {

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
        let openBrewFormModalRef = null;
        const openBrewFormModalBridge = (event = null, options = {}) => openBrewFormModalRef?.(event, options);
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
                openCoffeeCard: (...args) => openCoffeeCard(...args),
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
            pinBrewsFromOpenBags: (...args) => pinBrewsFromOpenBags(...args),
            pinBestBrewsForAllOpenBags: (...args) => pinBestBrewsForAllOpenBags(...args),
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
            makeBeanSignature,
            pinBrewsFromOpenBags,
            pinBestBrewsForBean,
            pinBestBrewsForAllOpenBags,
            autoPinOpenBagsIfEnabled,
            unpinBrewsForBeans,
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
            autoPinOpenBagsIfEnabled: (...args) => autoPinOpenBagsIfEnabled(...args),
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
            openBeanCard(beanId);
            enterBeanEditMode();
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
                await autoPinOpenBagsIfEnabled();
                openBeanCard(ref.id);
                enterBeanEditMode();
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
            openBeanCard,
            openBeanCardWithOrder,
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
        } = createBeansCoordinator({
            dataService,
            storageService,
            imageCompression,
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
            getBrewsPerPage: () => BREWS_PER_PAGE,
            setDisplayedBrewsCount: (value) => { displayedBrewsCount = value; },
            setActiveBeanFilter: (beanId) => { activeFilters.bean = beanId; },
            clearSearch: (...args) => clearSearch(...args),
            clearAllFilters: (...args) => clearAllFilters(...args),
            renderTable: (...args) => renderTable(...args),
            renderActiveFilters: (...args) => renderActiveFilters(...args),
            openCoffeeTypes: (...args) => openCoffeeTypes(...args),
            clearCoffeeTypesSearch: (...args) => clearCoffeeTypesSearch(...args),
            clearCoffeeTypesFilters: (...args) => clearCoffeeTypesFilters(...args),
            openCoffeeTypeCard: (...args) => openCoffeeTypeCard(...args),
            enterCoffeeTypeEditMode: (...args) => enterCoffeeTypeEditMode(...args),
            fillBeanDetails: (...args) => fillBeanDetails(...args),
            toggleForm: (...args) => toggleForm(...args),
            shouldUseLegacyBrewForm: () => isLegacyBrewFormEnabled(),
            openBrewFormModal: (...args) => openBrewFormModalBridge(...args),
            autoUnpinClosedBagsIfEnabled: (...args) => autoUnpinClosedBagsIfEnabled(...args),
            autoPinOpenBagsIfEnabled: (...args) => autoPinOpenBagsIfEnabled(...args),
            makeBeanSignature: (...args) => makeBeanSignature(...args),
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
        } = createCoffeesCoordinator({
            dataService,
            storageService,
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
            renderPinnedTiles: () => renderPinnedTiles(),
            renderTable,
            renderActiveFilters,
            clearSearch,
            clearAllFilters,
            getBrewsPerPage: () => BREWS_PER_PAGE,
            setDisplayedBrewsCount: (value) => { displayedBrewsCount = value; },
            setActiveCoffeeTypeFilter: (typeId) => { activeFilters.coffeeType = typeId; },
            openBeans,
            renderBeansTable,
            clearBeansSearch,
            clearBeansFilters,
            applyBeansFilterFromQuick,
            openBeanCard,
            enterBeanEditMode,
            autoPinOpenBagsIfEnabled
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
            bulkAddGearToBrews
        } = createGasCoordinator({
            dataService,
            storageService,
            imageCompression,
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
            openBeanCard: (...args) => openBeanCard(...args),
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
            dataService,
            parseNum,
            handleQuickEditRecipeInput: (...args) => handleQuickEditRecipeInput(...args),
            openCoffeeCard: (...args) => openCoffeeCard(...args),
            closeCoffeeCard: (...args) => closeCoffeeCard(...args),
            closeBeans: (...args) => closeBeans(...args),
            closeCoffeeTypes: (...args) => closeCoffeeTypes(...args),
            openBeans: (...args) => openBeans(...args),
            openCoffeeTypes: (...args) => openCoffeeTypes(...args),
            clearBeansSearch: (...args) => clearBeansSearch(...args),
            clearBeansFilters: (...args) => clearBeansFilters(...args),
            clearCoffeeTypesSearch: (...args) => clearCoffeeTypesSearch(...args),
            clearCoffeeTypesFilters: (...args) => clearCoffeeTypesFilters(...args),
            openBeanCard: (...args) => openBeanCard(...args),
            openCoffeeTypeCard: (...args) => openCoffeeTypeCard(...args),
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            getFirstBrewDateForBean: (...args) => getFirstBrewDateForBean(...args),
            archiveBeanIfStockDepleted: (...args) => archiveBeanIfStockDepleted(...args),
            updateBeansLeftForBean: (...args) => updateBeansLeftForBean(...args),
            autoPinOpenBagsIfEnabled: (...args) => autoPinOpenBagsIfEnabled(...args),
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences
        });

        const { resetCardPhotoState, triggerCardPhoto, handleCardPhoto } = createBrewsCardPhotoModule();

        const {
            populateCardData,
            getBrewTableOrder,
            openCoffeeCard,
            openCoffeeCardWithOrder,
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
            openBeanCard: (...args) => openBeanCard(...args),
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
            openCoffeeCard: (...args) => openCoffeeCard(...args),
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
                dataService,
                openAppConfirm,
                parseNum,
                setTempMode,
                setNotesMode,
                resetSca,
                setRating,
                toggleForm,
                updateBeanDropdown,
                setCoffeeDetailsCollapsed,
                changeView,
                closeCoffeeCard,
                openCoffeeCard,
                closeCoffeeCardMenu,
                handleQuickEditRecipeInput,
                archiveBeanIfStockDepleted,
                updateBeansLeftForBean,
                autoPinOpenBagsIfEnabled,
                getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
                getFirstBrewDateForBean,
                showCoffeeTypeCreatedToast,
                showBeanCreatedToast,
                uploadPendingCoffeeTypeImage,
                clearPendingAIBeanImageFile,
                getCoffeeScale: () => coffeeScale,
                shouldUseLegacyBrewForm: () => isLegacyBrewFormEnabled(),
                openBrewFormModal: openBrewFormModalBridge
            },
            refreshQuickEditGearFieldVisibility,
            setRefreshBrewGearSelectors: (fn) => { refreshBrewGearSelectors = fn; }
        });

        const { renderPinnedTiles, togglePinnedTiles } = createPinCoordinator({
            dataService,
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
            getCoffeeTypeDisplay,
            openCoffeeCard,
            openCoffeeCardWithOrder,
            openBeanCardWithOrder,
            renderTable
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

        const isVisible = (id) => {
            const el = document.getElementById(id);
            return el && !el.classList.contains('hidden');
        };

        const isTextInputTarget = (target) => {
            return target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable);
        };

        const tryNavigate = (btnId, action) => {
            const btn = document.getElementById(btnId);
            if (!btn || btn.disabled || btn.classList.contains('hidden')) return false;
            action();
            return true;
        };

        const handleCardKeyNav = (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const target = event.target;
            if (isTextInputTarget(target)) return;

            const dir = event.key === 'ArrowLeft' ? -1 : 1;

            if (isVisible('cardGraphModal')) {
                if (tryNavigate(dir < 0 ? 'cardGraphPrevBtn' : 'cardGraphNextBtn', () => navigateCoffeeCardFromGraph(dir))) {
                    event.preventDefault();
                }
                return;
            }

            if (isVisible('coffeeCardOverlay')) {
                if (tryNavigate(dir < 0 ? 'coffeeCardPrevBtn' : 'coffeeCardNextBtn', () => navigateCoffeeCard(dir))) {
                    event.preventDefault();
                }
                return;
            }

            if (isVisible('beanCardOverlay')) {
                if (tryNavigate(dir < 0 ? 'beanCardPrevBtn' : 'beanCardNextBtn', () => navigateBeanCard(dir))) {
                    event.preventDefault();
                }
                return;
            }

            if (isVisible('coffeeTypeCardOverlay')) {
                if (tryNavigate(dir < 0 ? 'coffeeTypeCardPrevBtn' : 'coffeeTypeCardNextBtn', () => navigateCoffeeTypeCard(dir))) {
                    event.preventDefault();
                }
                return;
            }

            if (isVisible('gasCardOverlay')) {
                if (tryNavigate(dir < 0 ? 'gasCardPrevBtn' : 'gasCardNextBtn', () => navigateGasCard(dir))) {
                    event.preventDefault();
                }
            }
        };
        document.addEventListener('keydown', handleCardKeyNav);

        const bindSwipeNavigation = ({ overlayId, panelId, prevBtnId, nextBtnId, onNavigate }) => {
            const overlay = document.getElementById(overlayId);
            if (!overlay) return;
            const panel = panelId ? document.getElementById(panelId) : overlay.firstElementChild;
            if (!panel || panel.dataset.swipeNavBound === 'true') return;

            const state = {
                startX: 0,
                startY: 0,
                active: false,
                blocked: false
            };
            const SWIPE_MIN_DISTANCE = 40;

            const isSwipeBlockedTarget = (target) => {
                if (!(target instanceof Element)) return false;
                if (isTextInputTarget(target)) return true;
                return !!target.closest('button, a, label, .action-menu, .action-menu-toggle, [data-no-swipe]');
            };

            panel.addEventListener('touchstart', (event) => {
                if (!isVisible(overlayId)) {
                    state.active = false;
                    return;
                }
                if (!event.touches || event.touches.length !== 1) {
                    state.active = false;
                    return;
                }

                const touch = event.touches[0];
                state.startX = touch.clientX;
                state.startY = touch.clientY;
                state.blocked = isSwipeBlockedTarget(event.target);
                state.active = !state.blocked;
            }, { passive: true });

            panel.addEventListener('touchend', (event) => {
                if (!state.active || state.blocked || !isVisible(overlayId)) return;
                if (!event.changedTouches || event.changedTouches.length !== 1) return;

                const touch = event.changedTouches[0];
                const deltaX = touch.clientX - state.startX;
                const deltaY = touch.clientY - state.startY;
                if (Math.abs(deltaX) < SWIPE_MIN_DISTANCE) return;
                if (Math.abs(deltaX) <= Math.abs(deltaY)) return;

                const direction = deltaX < 0 ? 1 : -1;
                const btnId = direction < 0 ? prevBtnId : nextBtnId;
                tryNavigate(btnId, () => onNavigate(direction));
            }, { passive: true });

            panel.dataset.swipeNavBound = 'true';
        };

        bindSwipeNavigation({
            overlayId: 'coffeeCardOverlay',
            panelId: 'coffeeCardContent',
            prevBtnId: 'coffeeCardPrevBtn',
            nextBtnId: 'coffeeCardNextBtn',
            onNavigate: navigateCoffeeCard
        });
        bindSwipeNavigation({
            overlayId: 'beanCardOverlay',
            prevBtnId: 'beanCardPrevBtn',
            nextBtnId: 'beanCardNextBtn',
            onNavigate: navigateBeanCard
        });
        bindSwipeNavigation({
            overlayId: 'coffeeTypeCardOverlay',
            prevBtnId: 'coffeeTypeCardPrevBtn',
            nextBtnId: 'coffeeTypeCardNextBtn',
            onNavigate: navigateCoffeeTypeCard
        });
        bindSwipeNavigation({
            overlayId: 'gasCardOverlay',
            panelId: 'gasCardPanel',
            prevBtnId: 'gasCardPrevBtn',
            nextBtnId: 'gasCardNextBtn',
            onNavigate: navigateGasCard
        });
        bindSwipeNavigation({
            overlayId: 'cardGraphModal',
            prevBtnId: 'cardGraphPrevBtn',
            nextBtnId: 'cardGraphNextBtn',
            onNavigate: navigateCoffeeCardFromGraph
        });

        document.addEventListener('keydown', handleEscapeKey);
        const handleAuthStateChanged = async (user) => {
            currentUser = user;
            const setMenuVisibility = (loggedIn) => {
                const ids = [
                    'menuAddBrewBtn',
                    'menuStatsBtn',
                    'menuBeansBtn',
                    'menuCoffeesBtn',
                    'menuGasBtn',
                    'menuGalleryBtn',
                    'menuImportExportBtn',
                    'menuPreferencesBtn',
                    'menuHelpDivider'
                ];
                ids.forEach((id) => {
                    const el = document.getElementById(id);
                    if (el) el.classList.toggle('hidden', !loggedIn);
                });
                const divider = document.getElementById('menuHelpDivider');
                if (divider) divider.classList.toggle('hidden', !loggedIn);
            };
            if (user) {
                document.getElementById('authContainer').innerHTML = `<div class="flex items-center gap-3"><button data-action-click="openFriendsModal()" class="relative flex-shrink-0 hover:opacity-80 transition-opacity"><img src="${user.photoURL}" class="w-8 h-8 flex-shrink-0 rounded-full border border-coffee-200 dark:border-[#44403c]" title="${user.displayName}"><div id="avatarBadge" class="hidden absolute -top-2 -right-2 bg-red-600 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center border-2 border-white dark:border-[#292524] shadow-md"></div></button></div>`;
                document.getElementById('viewSelectorContainer').classList.remove('hidden'); 
                document.getElementById('signedOutAuthBody').classList.add('hidden');
                document.getElementById('signedInContent').classList.remove('hidden');
                setMenuVisibility(true);
                const { shouldShowOnboarding } = await initUserData(user);
                loadFollowingList(); changeView('mine'); initNotificationListener(user.uid);
                if (shouldShowOnboarding) openHelp();
                initZoomListeners(); 
            } else {
                document.getElementById('authContainer').innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center gap-2"><button data-action-click="googleLogin()" class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><i class="fa-brands fa-google"></i> Sign in</button></div>`;
                document.getElementById('viewSelectorContainer').classList.add('hidden');
                document.getElementById('coffeeTableBody').innerHTML = '';
                document.getElementById('emptyState').classList.add('hidden');
                document.getElementById('signedInContent').classList.add('hidden');
                document.getElementById('signedOutAuthBody').classList.remove('hidden');
                setMenuVisibility(false);
                clearNotificationSubscription();
                clearViewSubscriptions();
            }
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
            openCoffeeCard(brewId, event || null);
            setTimeout(() => enterBrewQuickEditMode(), 0);
        };

        const openExternalUrl = (url) => {
            if (!url) return;
            window.open(url, '_blank', 'noopener,noreferrer');
        };

        const migrateGrinderToGear = async () => {
            if (!currentUser) return alert('Please sign in.');

            const btn = document.getElementById('migrateGrinderToGearBtn');
            const originalHtml = btn?.innerHTML;
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Migrating...';
            }

            const normalizeName = (value) =>
                (value || '')
                    .toString()
                    .trim()
                    .replace(/\s+/g, ' ')
                    .toLowerCase();

            const denormalizeName = (value) => (value || '').toString().trim().replace(/\s+/g, ' ');

            try {
                const grinderIdByName = new Map();
                const discoveredGrinderNameByNorm = new Map();

                gasItems.forEach((item) => {
                    if (!item) return;
                    if ((item.type || '').toString().toLowerCase() !== 'grinder') return;
                    const norm = normalizeName(item.name);
                    if (!norm || grinderIdByName.has(norm)) return;
                    grinderIdByName.set(norm, item.id);
                });

                coffees.forEach((brew) => {
                    const norm = normalizeName(brew?.grinder);
                    if (!norm || discoveredGrinderNameByNorm.has(norm)) return;
                    discoveredGrinderNameByNorm.set(norm, denormalizeName(brew.grinder));
                });

                const missingNorms = [...discoveredGrinderNameByNorm.keys()].filter((norm) => !grinderIdByName.has(norm));
                const nowIso = new Date().toISOString();
                const newGearItems = [];

                for (const norm of missingNorms) {
                    const name = discoveredGrinderNameByNorm.get(norm);
                    if (!name) continue;
                    const newRef = doc(collection(db, 'users', currentUser.uid, 'gear'));
                    const gearData = {
                        uid: currentUser.uid,
                        name,
                        price: null,
                        type: 'Grinder',
                        methods: [],
                        imageUrl: '',
                        purchasedDate: nowIso,
                        archived: false,
                        createdAt: nowIso,
                        updatedAt: nowIso
                    };
                    newGearItems.push({ id: newRef.id, ...gearData });
                    grinderIdByName.set(norm, newRef.id);
                    await setDoc(newRef, gearData);
                }

                const batchLimit = 400;
                let currentBatch = writeBatch(db);
                let opCount = 0;
                let updatedBrewsCount = 0;
                const commitJobs = [];

                coffees.forEach((brew) => {
                    const norm = normalizeName(brew?.grinder);
                    const grinderGearId = norm ? grinderIdByName.get(norm) : null;
                    if (!grinderGearId) return;

                    const currentGearIds = Array.isArray(brew.gearIds) ? brew.gearIds.filter(Boolean) : [];
                    if (currentGearIds.includes(grinderGearId)) return;

                    const nextGearIds = [...new Set([...currentGearIds, grinderGearId])];
                    const brewRef = doc(db, 'users', currentUser.uid, 'coffees', brew.id);
                    currentBatch.update(brewRef, {
                        gearIds: nextGearIds,
                        updatedAt: new Date().toISOString()
                    });
                    opCount++;
                    updatedBrewsCount++;
                    const idx = coffees.findIndex((c) => c.id === brew.id);
                    if (idx !== -1) coffees[idx] = { ...coffees[idx], gearIds: nextGearIds };

                    if (opCount >= batchLimit) {
                        commitJobs.push(currentBatch.commit());
                        currentBatch = writeBatch(db);
                        opCount = 0;
                    }
                });

                if (opCount > 0) {
                    commitJobs.push(currentBatch.commit());
                }
                if (commitJobs.length) await Promise.all(commitJobs);

                if (newGearItems.length > 0) {
                    refreshBrewGearSelectors();
                }

                alert(`Migration complete. Added ${newGearItems.length} grinder gear item(s) and linked ${updatedBrewsCount} brew(s).`);
            } catch (err) {
                console.error('Migrate grinder to gear failed:', err);
                alert(`Migration failed: ${err.message}`);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }
        };

        const fillLegacyGrinderFromGear = async () => {
            if (!currentUser) return alert('Please sign in.');

            const btn = document.getElementById('fillLegacyGrinderFromGearBtn');
            const originalHtml = btn?.innerHTML;
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i> Filling...';
            }

            try {
                const grinderNameByGearId = new Map(
                    gasItems
                        .filter((item) => (item?.type || '').toString().toLowerCase() === 'grinder')
                        .map((item) => [item.id, (item.name || '').toString().trim()])
                );

                const updates = [];
                coffees.forEach((brew) => {
                    const gearIds = Array.isArray(brew?.gearIds) ? brew.gearIds : [];
                    const firstAssociatedGrinderName = gearIds
                        .map((gearId) => grinderNameByGearId.get(gearId))
                        .find((name) => !!name);
                    if (!firstAssociatedGrinderName) return;
                    if ((brew.grinder || '') === firstAssociatedGrinderName) return;
                    updates.push({
                        brewId: brew.id,
                        grinder: firstAssociatedGrinderName,
                        updatedAt: new Date().toISOString()
                    });
                });

                if (!updates.length) {
                    alert('No brews needed legacy grinder updates.');
                    return;
                }

                const batchLimit = 400;
                let currentBatch = writeBatch(db);
                let opCount = 0;
                const commitJobs = [];

                for (const update of updates) {
                    const brewRef = doc(db, 'users', currentUser.uid, 'coffees', update.brewId);
                    currentBatch.update(brewRef, {
                        grinder: update.grinder,
                        updatedAt: update.updatedAt
                    });
                    opCount += 1;
                    if (opCount >= batchLimit) {
                        commitJobs.push(currentBatch.commit());
                        currentBatch = writeBatch(db);
                        opCount = 0;
                    }
                }

                if (opCount > 0) commitJobs.push(currentBatch.commit());
                if (commitJobs.length) await Promise.all(commitJobs);

                const updateByBrewId = new Map(updates.map((entry) => [entry.brewId, entry]));
                coffees = coffees.map((brew) => {
                    const patch = updateByBrewId.get(brew.id);
                    return patch ? { ...brew, grinder: patch.grinder, updatedAt: patch.updatedAt } : brew;
                });

                alert(`Legacy grinder field updated for ${updates.length} brew(s).`);
            } catch (err) {
                console.error('Fill legacy grinder from gear failed:', err);
                alert(`Legacy grinder fill failed: ${err.message}`);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = originalHtml;
                }
            }
        };

        const showBrewsForGear = (gearId = null) => {
            const targetId = gearId || currentGasId;
            if (!targetId) return;

            closeGasCardMenu?.();
            closeGasCard?.(null);
            closeGasList?.();
            clearSearch();
            clearAllFilters();
            applyFilter('gear', targetId);
            displayedBrewsCount = BREWS_PER_PAGE;
            renderTable();
            renderActiveFilters();
            document.getElementById('brewsTableMount')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        const { openBrewFormModal, closeBrewFormModal, discardBrewFormModal, submitBrewFormModal } = createBrewsFormModalModule({
            getCurrentView: () => currentView,
            changeView,
            resetFormState,
            toggleForm,
            openAppConfirm
        });
        openBrewFormModalRef = openBrewFormModal;
        applyBrewFormInlineVisibility();

        const openAddBrewFromPinned = (event = null) => {
            if (!isLegacyBrewFormEnabled()) {
                openBrewFormModal(event, { reset: true, title: 'Add new brew' });
                return;
            }
            if (event?.stopPropagation) event.stopPropagation();
            if (currentView !== 'mine') changeView('mine');
            resetFormState(null);
            toggleForm(true);
            const formWrapper = document.getElementById('formWrapper');
            if (!formWrapper) return;
            const headerHeight = document.getElementById('appHeader')?.offsetHeight || 72;
            const top = formWrapper.getBoundingClientRect().top + window.pageYOffset;
            window.scrollTo({ top: Math.max(0, top - headerHeight - 8), behavior: 'smooth' });
        };

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
                openBeanCard,
                openBrewWithBean,
                openBrewsTablePrefs,
                openCardGraphModal,
                openCoffeeCard,
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
                toggleActionMenu,
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
                cancelBeanEditMode,
                changeView,
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
                openBeanCard,
                openBeansQuickFilterValues,
                openBrewWithBean,
                openCoffeeFromBeanEdit,
                openSelectedBeanForEdit,
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
                toggleActionMenu,
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
            gas: {
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


        return { handleAuthStateChanged, actions, featureActions };
};
