        import { BAG_AI_URL, STATS_AI_URL, auth, db, storage, provider } from '../config/firebase.js';
        import { signInWithPopup, signOut } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
        import { collection, doc, setDoc, addDoc, updateDoc, deleteDoc, getDoc, getDocs, onSnapshot, query, writeBatch, where, orderBy, limit, startAfter } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
        import { ref, uploadBytes, getDownloadURL, deleteObject } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js';
        import { initCoffeeScale } from '../features/scales/scales.js';
        import { parseBeanconquerorCSV, mapBeanconquerorBrews } from '../features/import-export/importers/beanconqueror.js';
        import { initEmailLinkAuth } from '../integrations/email-link-auth.js';
        import { createNotificationUxModule, closeAutoPinToast, showAutoPinToast, showToast } from '../core/notify.js';
        import { closeAppConfirm, openAppConfirm, resolveAppConfirm, installDialogAdapters } from '../core/confirm.js';
        import { getStarDisplay, formatBeanOpenedDate, formatTime, getRoastBadge } from '../core/format.js';
        import { createCoffeeTypeCardModule } from '../features/coffees/coffee-type-card.js';
        import { createCoffeeTypesTableModule } from '../features/coffees/coffee-types-table.js';
        import { createGasTableModule } from '../features/gas/gas-table.js';
        import { createGasCardModule } from '../features/gas/gas-card.js';
        import { createBeansTableModule } from '../features/beans/beans-table.js';
        import { createBeansActionsModule } from '../features/beans/beans-actions.js';
        import { createBeansMaintenanceModule } from '../features/beans/beans-maintenance.js';
        import { createBeansStockServiceModule } from '../features/beans/beans-stock.service.js';
        import { createBeansStockControllerModule } from '../features/beans/beans-stock.controller.js';
        import { createBeansCardActionsModule } from '../features/beans/beans-card-actions.js';
        import { createBeansCardFormModule } from '../features/beans/beans-card-form.js';
        import { createBeansCardPhotoModule } from '../features/beans/beans-card-photo.js';
        import { createBeansCardUiModule } from '../features/beans/beans-card-ui.js';
        import { createSocialModule } from '../features/social.js';
        import { createGalleryModule } from '../features/gallery.js';
        import { createStatsModule } from '../features/stats/stats.js';
        import { createImportExportModule } from '../features/import-export.js';
        import { createBrewsFormModule } from '../features/brews/brews-form.js';
        import { createBrewsTableModule } from '../features/brews/brews-table.js';
        import { createBrewsActionsModule } from '../features/brews/brews-actions.js';
        import { createBrewsCardActionsModule } from '../features/brews/brews-card-actions.js';
        import { createBrewsCardUiModule } from '../features/brews/brews-card-ui.js';
        import { createBrewsCardShareModule } from '../features/brews/brews-card-share.js';
        import { createBrewsCardGraphModule } from '../features/brews/brews-card-graph.js';
        import { createBrewsCardPhotoModule } from '../features/brews/brews-card-photo.js';
        import { createBrewsPinAutopinModule } from '../features/brews/brews-pin-autopin.js';
        import { createBrewsPreferencesModule } from '../features/preferences.js';
        import { createSessionAuthViewModule } from '../features/session-auth-view.js';
        import { createAiImportModule } from '../features/ai-import.js';
        import { createStatsAiProfileModule } from '../features/stats/stats-ai-profile.js';
        import { createBrewFormLookupModule } from '../features/brews/brew-form-lookup.js';
        import { createCoffeeTypesExtractModule } from '../features/coffees/coffee-types-extract.js';
        import { createUiShellModule } from '../features/ui-shell.js';
        import { createMediaModalsModule } from '../features/media/media-modals.js';
        import { createPinControllerModule } from '../features/pin/pin.controller.js';
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

        const {
            columnPreferencesKey,
            loadColumnPreferencesFromStorage,
            saveColumnPreferencesToStorage,
            loadLegacyPinnedBrewsPreferences,
            applyAnimationPreference,
            updateBestOnlyToggleState,
            openPreferences,
            savePreferences
        } = createBrewsPreferencesModule({
            columnDefs,
            getColumnPreferences: () => columnPreferences,
            setColumnPreferences: (value) => { columnPreferences = value; },
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
            setPinnedBrewsPreferences: (value) => { pinnedBrewsPreferences = value; },
            getCurrentUser: () => currentUser,
            db,
            doc,
            updateDoc,
            applyAnimationClass: (...args) => applyAnimationClass(...args),
            renderTable: (...args) => renderTable(...args),
            renderPinnedTiles: (...args) => renderPinnedTiles(...args),
            pinBrewsFromOpenBags: (...args) => pinBrewsFromOpenBags(...args),
            pinBestBrewsForAllOpenBags: (...args) => pinBestBrewsForAllOpenBags(...args),
            showAutoPinToast
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
            db,
            doc,
            writeBatch
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
            uploadPendingBeanImage,
            clearPendingAIBeanImageFile,
            handleBeansAIFile,
            handleCoffeeTypesAIFile
        } = createAiImportModule({
            BAG_AI_URL,
            imageCompression,
            getCurrentUser: () => currentUser,
            toggleForm: (...args) => toggleForm(...args),
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
            auth,
            provider,
            signInWithPopup,
            signOut,
            db,
            doc,
            setDoc,
            updateDoc,
            getDoc,
            collection,
            query,
            where,
            orderBy,
            limit,
            onSnapshot,
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
            refreshBrewGearSelectors: () => refreshBrewGearSelectors()
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
            closeExportModal: (...args) => closeExportModal(...args),
            closeImportModal: (...args) => closeImportModal(...args),
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
            db,
            writeBatch,
            doc,
            collection
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
        const beansStockService = createBeansStockServiceModule();
        const computeBeansLeft = (bean, brews = coffees) => beansStockService.computeBeansLeft(bean, brews);
        const getBeanCalculatedStock = (bean, brews = coffees) => beansStockService.getBeanCalculatedStock(bean, brews);
        const getRemainingStockAfterBrew = (bean, brew, existingBrewId = null, brews = coffees) =>
            beansStockService.getRemainingStockAfterBrew(bean, brew, existingBrewId, brews);
        const getFirstBrewDateForBean = (beanId, brew = null, existingBrewId = null, brews = coffees) =>
            beansStockService.getFirstBrewDateForBean(beanId, brew, existingBrewId, brews);

        const {
            updateBeansLeftForBean,
            maybeMigrateBeansLeft,
            recalculateAllBeanStockLeft,
            archiveBeanIfStockDepleted
        } = createBeansStockControllerModule({
            db,
            doc,
            updateDoc,
            writeBatch,
            getCurrentUser: () => currentUser,
            getBeans: () => beans,
            setBeansState: (value) => { beans = value; },
            getCoffees: () => coffees,
            getHasLoadedBeans: () => hasLoadedBeans,
            getHasLoadedBrews: () => hasLoadedBrews,
            getCurrentBeanCardId: () => currentBeanCardId,
            renderBeansTable: (...args) => renderBeansTable(...args),
            openBeanCard: (...args) => openBeanCard(...args),
            computeBeansLeft: (...args) => computeBeansLeft(...args),
            getRemainingStockAfterBrew: (...args) => getRemainingStockAfterBrew(...args),
            autoUnpinClosedBagsIfEnabled: (...args) => autoUnpinClosedBagsIfEnabled(...args),
            makeBeanSignature: (...args) => makeBeanSignature(...args),
            showAutoArchiveToast: (...args) => showAutoArchiveToast(...args)
        });

        const {
            showAutoArchiveToast,
            closeAutoArchiveToast,
            handleAutoArchiveToastAction,
            showCoffeeTypeCreatedToast,
            closeCoffeeTypeCreatedToast
        } = createNotificationUxModule({
            getCoffeeTypes: () => coffeeTypes,
            onAutoArchiveUnarchive: async (beanId) => toggleBeanArchive(beanId, true),
            onAutoArchiveOpen: async (beanId) => openNewBag(beanId, { openCard: true, editAfter: true })
        });

        // --- Coffee Management Functions ---
        const openCoffeeTypes = () => {
            if (!currentUser) return alert("Please sign in.");
            document.getElementById('coffeeTypesModal').classList.remove('hidden');
            renderCoffeeTypesTable();
        };

        const closeCoffeeTypes = () => {
            document.getElementById('coffeeTypesModal').classList.add('hidden');
        };

        const createCoffeeTypeFromModal = async () => {
            if (!currentUser) return alert("Please sign in.");
            const nowIso = new Date().toISOString();
            const typeData = {
                uid: currentUser.uid,
                roaster: '',
                farmer: '',
                origin: '',
                processing: '',
                variety: '',
                roast: '',
                rating: 0,
                tasteNotes: '',
                webshopUrl: '',
                imageUrl: '',
                createdAt: nowIso,
                updatedAt: nowIso
            };

            try {
                const typeRef = await addDoc(collection(db, 'users', currentUser.uid, 'coffeeTypes'), typeData);
                const newType = { id: typeRef.id, ...typeData };
                if (!coffeeTypes.find(ct => ct.id === newType.id)) coffeeTypes.push(newType);
                openCoffeeTypeCard(newType.id);
                enterCoffeeTypeEditMode();
            } catch (err) {
                console.error('Error creating coffee:', err);
                alert('Failed to create coffee.');
            }
        };

        const openCoffeeTypeShopUrl = (typeId, ev) => {
            if (ev) ev.stopPropagation();
            const type = coffeeTypes.find(ct => ct.id === typeId);
            const url = type?.webshopUrl || type?.shopUrl;
            if (!url) return;
            window.open(url, '_blank', 'noopener,noreferrer');
        };

        const openNewBagForCoffeeType = async () => {
            if (!currentUser || !currentCoffeeTypeId) return;
            const type = coffeeTypes.find(ct => ct.id === currentCoffeeTypeId);
            if (!type) return;
            const nowIso = new Date().toISOString();
            const newBeanData = {
                coffeeTypeId: type.id,
                roaster: type.roaster || '',
                farmer: type.farmer || '',
                origin: type.origin || '',
                processing: type.processing || '',
                variety: type.variety || '',
                roastType: type.roast || type.roastType || '',
                shopUrl: type.webshopUrl || type.shopUrl || '',
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
                const ref = await addDoc(collection(db, 'users', currentUser.uid, 'beans'), newBeanData);
                const newBean = { id: ref.id, ...newBeanData };
                beans.push(newBean);
                renderBeansTable();
                await autoPinOpenBagsIfEnabled();
                openBeanCard(ref.id);
                enterBeanEditMode();
                closeCoffeeTypeCard(null);
            } catch (err) {
                console.error('Error creating bean from coffee type:', err);
                alert('Failed to create bean.');
            }
        };

        const showBeansForCoffeeType = () => {
            if (!currentCoffeeTypeId) return;
            closeCoffeeTypeCard(null);
            closeCoffeeTypes();
            openBeans();
            clearBeansSearch();
            clearBeansFilters();
            applyBeansFilterFromQuick('coffeeType', currentCoffeeTypeId);
        };

        const showBrewsForCoffeeType = () => {
            if (!currentCoffeeTypeId) return;
            closeCoffeeTypeCard(null);
            closeCoffeeTypes();
            clearSearch();
            clearAllFilters();
            activeFilters.coffeeType = currentCoffeeTypeId;
            displayedBrewsCount = BREWS_PER_PAGE;
            renderTable();
            renderActiveFilters();
        };

        const {
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
            closeCoffeeTypeCardMenu
        } = createCoffeeTypeCardModule({
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentCoffeeTypeId: () => currentCoffeeTypeId,
            setCurrentCoffeeTypeId: (value) => { currentCoffeeTypeId = value; },
            getCoffeeTypes: () => coffeeTypes,
            setCoffeeTypesState: (value) => { coffeeTypes = value; },
            getBeans: () => beans,
            setBeansState: (value) => { beans = value; },
            db,
            storage,
            doc,
            updateDoc,
            writeBatch,
            ref,
            uploadBytes,
            getDownloadURL,
            deleteObject,
            openAppConfirm,
            getStarDisplay,
            renderCoffeeTypesTable: () => renderCoffeeTypesTable(),
            updateCoffeeTypeSelectors,
            renderPinnedTiles: () => renderPinnedTiles(),
            renderTable: () => renderTable(),
            openCoffeeTypeShopUrl,
            showBeansForCoffeeType,
            showBrewsForCoffeeType,
            openNewBagForCoffeeType,
            updateCoffeeTypeCardNav: () => updateCoffeeTypeCardNav()
        });

        const updateCoffeeTypeCardNav = () => {
            const order = getFilteredSortedCoffeeTypes().map(type => type.id);
            const idx = order.indexOf(currentCoffeeTypeId);
            const prevBtn = document.getElementById('coffeeTypeCardPrevBtn');
            const nextBtn = document.getElementById('coffeeTypeCardNextBtn');
            if (!prevBtn || !nextBtn) return;
            prevBtn.disabled = idx <= 0;
            nextBtn.disabled = idx === -1 || idx >= order.length - 1;
            prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
            prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);
            nextBtn.classList.toggle('opacity-40', nextBtn.disabled);
            nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
        };

        const navigateCoffeeTypeCard = (direction) => {
            const order = getFilteredSortedCoffeeTypes().map(type => type.id);
            const idx = order.indexOf(currentCoffeeTypeId);
            const nextIdx = idx + direction;
            if (nextIdx < 0 || nextIdx >= order.length) return;
            openCoffeeTypeCard(order[nextIdx]);
        };

        const {
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
        } = createCoffeeTypesTableModule({
            getCoffeeTypes: () => coffeeTypes,
            getCurrentView: () => currentView,
            getCoffeeTypesSearch: () => coffeeTypesSearch,
            setCoffeeTypesSearchState: (value) => { coffeeTypesSearch = value; },
            getCoffeeTypesFilters: () => coffeeTypesFilters,
            setCoffeeTypesFiltersState: (value) => { coffeeTypesFilters = value; },
            getCoffeeTypesSortKey: () => coffeeTypesSortKey,
            setCoffeeTypesSortKeyState: (value) => { coffeeTypesSortKey = value; },
            getCoffeeTypesSortDir: () => coffeeTypesSortDir,
            setCoffeeTypesSortDirState: (value) => { coffeeTypesSortDir = value; },
            getStarDisplay,
            openCoffeeTypeCard
        });

        const createGasItemFromModal = async () => {
            if (!currentUser) return alert('Please sign in.');
            const nowIso = new Date().toISOString();
            const gasData = {
                uid: currentUser.uid,
                name: '',
                price: null,
                type: 'Other',
                methods: [],
                imageUrl: '',
                purchasedDate: nowIso,
                archived: false,
                createdAt: nowIso,
                updatedAt: nowIso
            };

            try {
                const gasRef = await addDoc(collection(db, 'users', currentUser.uid, 'gear'), gasData);
                const newGas = { id: gasRef.id, ...gasData };
                if (!gasItems.find((item) => item.id === newGas.id)) gasItems.push(newGas);
                refreshBrewGearSelectors();
                openGasCard(newGas.id);
                enterGasEditMode();
            } catch (err) {
                console.error('Error creating gear item:', err);
                alert('Failed to create gear item.');
            }
        };

        const {
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
            renderGasTable
        } = createGasTableModule({
            getGasItems: () => gasItems,
            getCurrentView: () => currentView,
            getGasSearch: () => gasSearch,
            setGasSearchState: (value) => { gasSearch = value; },
            getGasFilters: () => gasFilters,
            setGasFiltersState: (value) => { gasFilters = value; },
            getGasSortKey: () => gasSortKey,
            setGasSortKeyState: (value) => { gasSortKey = value; },
            getGasSortDir: () => gasSortDir,
            setGasSortDirState: (value) => { gasSortDir = value; },
            openGasCard: (...args) => openGasCard(...args)
        });

        const {
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
            toggleGasArchiveFromTable,
            deleteGasFromTable,
            triggerGasPhoto,
            openGasPhoto,
            removeGasPhoto,
            handleGasPhoto,
            closeGasCardMenu
        } = createGasCardModule({
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentGasId: () => currentGasId,
            setCurrentGasId: (value) => { currentGasId = value; },
            getGasItems: () => gasItems,
            setGasItemsState: (value) => { gasItems = value; },
            getFilteredSortedGasItems: (...args) => getFilteredSortedGasItems(...args),
            db,
            storage,
            doc,
            updateDoc,
            deleteDoc,
            ref,
            uploadBytes,
            getDownloadURL,
            deleteObject,
            imageCompression,
            openAppConfirm,
            renderGasTable: (...args) => renderGasTable(...args)
        });

        const getBeanTableOrder = () => {
            const beansWithStock = beans.map((bean) => {
                const remaining = getBeanCalculatedStock(bean);
                return { ...bean, calculatedStock: remaining };
            });

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


        const {
            openBeanShopUrl,
            showBrewsForBean,
            showCoffeeForBean,
            openBrewWithBean
        } = createBeansCardActionsModule({
            getCurrentView: () => currentView,
            getCurrentBeanCardId: () => currentBeanCardId,
            getBeans: () => beans,
            closeBeanCard: (...args) => closeBeanCard(...args),
            closeBeans: (...args) => closeBeans(...args),
            clearSearch: (...args) => clearSearch(...args),
            clearAllFilters: (...args) => clearAllFilters(...args),
            setActiveBeanFilter: (beanId) => { activeFilters.bean = beanId; },
            getBrewsPerPage: () => BREWS_PER_PAGE,
            setDisplayedBrewsCount: (value) => { displayedBrewsCount = value; },
            renderTable: (...args) => renderTable(...args),
            renderActiveFilters: (...args) => renderActiveFilters(...args),
            openCoffeeTypes: (...args) => openCoffeeTypes(...args),
            clearCoffeeTypesSearch: (...args) => clearCoffeeTypesSearch(...args),
            clearCoffeeTypesFilters: (...args) => clearCoffeeTypesFilters(...args),
            openCoffeeTypeCard: (...args) => openCoffeeTypeCard(...args),
            fillBeanDetails: (...args) => fillBeanDetails(...args),
            toggleForm: (...args) => toggleForm(...args)
        });

        const {
            setBeanEditCoffeeTypeFieldState,
            applyBeanEditCoffeeType,
            enterBeanEditMode,
            openCoffeeFromBeanEdit,
            cancelBeanEditMode,
            saveBeanCardEdits
        } = createBeansCardFormModule({
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentBeanCardId: () => currentBeanCardId,
            getBeans: () => beans,
            getCoffeeTypes: () => coffeeTypes,
            setBeansState: (value) => { beans = value; },
            computeBeansLeft: (...args) => computeBeansLeft(...args),
            updateCoffeeTypeSelectors: (...args) => updateCoffeeTypeSelectors(...args),
            db,
            doc,
            collection,
            setDoc,
            updateDoc,
            openBeanCard: (...args) => openBeanCard(...args),
            openCoffeeTypeCard: (...args) => openCoffeeTypeCard(...args),
            enterCoffeeTypeEditMode: (...args) => enterCoffeeTypeEditMode(...args)
        });

        const {
            updateBeanCardActionButtons,
            updateBeanCardNav,
            openBeanCard,
            navigateBeanCard,
            closeBeanCard,
            closeBeanCardMenu
        } = createBeansCardUiModule({
            getBeans: () => beans,
            getCurrentView: () => currentView,
            getCurrentBeanCardId: () => currentBeanCardId,
            setCurrentBeanCardId: (value) => { currentBeanCardId = value; },
            getBeanCalculatedStock,
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            getBeanTableOrder: (...args) => getBeanTableOrder(...args),
            openBrewWithBean: (...args) => openBrewWithBean(...args),
            openNewBag: (...args) => openNewBag(...args),
            deleteBean: (...args) => deleteBean(...args),
            showBrewsForBean: (...args) => showBrewsForBean(...args),
            showCoffeeForBean: (...args) => showCoffeeForBean(...args),
            openBeanShopUrl: (...args) => openBeanShopUrl(...args),
            enterBeanEditMode: (...args) => enterBeanEditMode(...args),
            cancelBeanEditMode: (...args) => cancelBeanEditMode(...args),
            toggleBeanFrozen: (...args) => toggleBeanFrozen(...args),
            toggleBeanArchive: (...args) => toggleBeanArchive(...args)
        });

        const {
            triggerBeanPhoto,
            openBeanPhoto,
            removeBeanPhoto,
            handleBeanPhoto
        } = createBeansCardPhotoModule({
            getCurrentUser: () => currentUser,
            getCurrentBeanCardId: () => currentBeanCardId,
            getBeans: () => beans,
            setBeansState: (value) => { beans = value; },
            storage,
            ref,
            deleteObject,
            db,
            doc,
            updateDoc,
            imageCompression,
            uploadBytes,
            getDownloadURL,
            openBeanCard: (...args) => openBeanCard(...args)
        });

        const {
            openBeans,
            closeBeans,
            setBeansSearch,
            clearBeansSearch,
            toggleBeansQuickFilter,
            openBeansQuickFilterValues,
            applyBeansFilterFromQuick,
            clearBeansFilters,
            renderBeansActiveFilters,
            renderBeansTable
        } = createBeansTableModule({
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getBeans: () => beans,
            getCoffeeTypes: () => coffeeTypes,
            getBeansSearch: () => beansSearch,
            setBeansSearchState: (value) => { beansSearch = value; },
            getBeansFilters: () => beansFilters,
            setBeansFiltersState: (value) => { beansFilters = value; },
            getBeanCalculatedStock,
            getBeanCoffeeTypeDisplay: (bean) => getBeanCoffeeTypeDisplay(bean),
            getRoastBadge,
            openBeanCard: (...args) => openBeanCard(...args),
            updateCoffeeTypeSelectors
        });

        const {
            saveBeanStock,
            toggleBeanArchive,
            toggleBeanFrozen,
            openNewBag,
            deleteBean
        } = createBeansActionsModule({
            getCurrentUser: () => currentUser,
            getCurrentBeanCardId: () => currentBeanCardId,
            getBeans: () => beans,
            setBeansState: (value) => { beans = value; },
            computeBeansLeft,
            db,
            doc,
            updateDoc,
            addDoc,
            collection,
            deleteDoc,
            autoUnpinClosedBagsIfEnabled: (...args) => autoUnpinClosedBagsIfEnabled(...args),
            autoPinOpenBagsIfEnabled: (...args) => autoPinOpenBagsIfEnabled(...args),
            makeBeanSignature: (...args) => makeBeanSignature(...args),
            updateBeanCardActionButtons: (bean) => updateBeanCardActionButtons(bean),
            openBeanCard: (...args) => openBeanCard(...args),
            enterBeanEditMode: () => enterBeanEditMode(),
            openAppConfirm
        });

        const {
            saveBeanRoastDate,
            saveBeanOpenedDate,
            saveBeanFrozenDate,
            syncLegacyBeans
        } = createBeansMaintenanceModule({
            getCurrentUser: () => currentUser,
            getBeans: () => beans,
            getCoffees: () => coffees,
            db,
            doc,
            updateDoc,
            writeBatch,
            collection,
            autoPinOpenBagsIfEnabled: (...args) => autoPinOpenBagsIfEnabled(...args)
        });

        const setNotesMode = (mode) => {
            const btnMan = document.getElementById('btnNotesManual'), btnSca = document.getElementById('btnNotesSCA'), conMan = document.getElementById('notesManualContainer'), conSca = document.getElementById('notesSCAContainer'), hidden = document.getElementById('notesMode');
            hidden.value = mode;
            if (mode === 'manual') {
                conMan.classList.remove('hidden'); conSca.classList.add('hidden');
                btnMan.className="px-2 py-0.5 text-[10px] rounded font-bold transition-all bg-white dark:bg-[#1c1917] shadow-sm text-coffee-800 dark:text-white"; 
                btnSca.className="px-2 py-0.5 text-[10px] rounded font-bold transition-all text-coffee-500 dark:text-[#78716c] hover:text-coffee-700";
            } else {
                conSca.classList.remove('hidden'); conMan.classList.remove('hidden');
                btnSca.className="px-2 py-0.5 text-[10px] rounded font-bold transition-all bg-white dark:bg-[#1c1917] shadow-sm text-coffee-800 dark:text-white"; 
                btnMan.className="px-2 py-0.5 text-[10px] rounded font-bold transition-all text-coffee-500 dark:text-[#78716c] hover:text-coffee-700";
                if (scaState.level === 0 && scaState.path.length === 0) renderScaWheel();
            }
        };

        const renderScaWheel = () => {
            const container = document.getElementById('scaButtonsContainer'); const display = document.getElementById('scaSelectionDisplay'); container.innerHTML = '';
            const pathString = scaState.path.join(' > '); const leafNode = scaState.path.length > 0 ? scaState.path[scaState.path.length - 1] : null;
            if (leafNode) { display.innerHTML = `<div class="flex flex-col sm:flex-row justify-between items-center gap-2 bg-coffee-100 dark:bg-[#292524] p-2 rounded"><span class="text-xs text-coffee-500 italic">${pathString}</span><div class="flex gap-2"><button data-action-click="resetSca()" class="text-xs text-coffee-600 dark:text-[#a8a29e] hover:text-red-500 underline">Reset</button><button type="button" data-action-click="addScaToNotes()" class="bg-green-500 hover:bg-green-600 text-white text-xs font-bold px-3 py-1 rounded shadow-sm transition-colors"><i class="fa-solid fa-plus mr-1"></i> Add "${leafNode}"</button></div></div>`; } 
            else { display.innerHTML = '<span class="text-coffee-400 font-normal italic text-xs">Tap categories below to build a flavor...</span>'; }
            if (scaState.level === 0) {
                Object.keys(scaData).forEach(key => {
                    const btn = document.createElement('button'); btn.type = 'button'; btn.className = `sca-btn px-3 py-2 rounded text-xs font-bold shadow-sm ${scaData[key].c}`; btn.textContent = key;
                    btn.onclick = () => { scaState.path = [key]; scaState.level = 1; scaState.currentNode = scaData[key]; renderScaWheel(); }; container.appendChild(btn);
                });
            } else if (scaState.level === 1) {
                const subs = scaState.currentNode.s; const parentColor = scaState.currentNode.c;
                const backBtn = document.createElement('button'); backBtn.type = 'button'; backBtn.className = "sca-btn px-3 py-2 rounded text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"; backBtn.innerHTML = "<i class='fa-solid fa-arrow-left'></i>"; backBtn.onclick = () => { scaState.level = 0; scaState.path = []; scaState.currentNode = null; renderScaWheel(); }; container.appendChild(backBtn);
                Object.keys(subs).forEach(key => {
                    const btn = document.createElement('button'); btn.type = 'button'; btn.className = `sca-btn px-3 py-2 rounded text-xs font-bold shadow-sm opacity-90 hover:opacity-100 ${parentColor}`; btn.textContent = key;
                    btn.onclick = () => { scaState.path.push(key); scaState.level = 2; renderScaWheel(); }; container.appendChild(btn);
                });
            } else if (scaState.level === 2) {
                const parentKey = scaState.path[0]; const subKey = scaState.path[1]; const notes = scaData[parentKey].s[subKey]; const parentColor = scaData[parentKey].c;
                const backBtn = document.createElement('button'); backBtn.type = 'button'; backBtn.className = "sca-btn px-3 py-2 rounded text-xs font-bold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200"; backBtn.innerHTML = "<i class='fa-solid fa-arrow-left'></i>"; backBtn.onclick = () => { scaState.path.pop(); scaState.level = 1; renderScaWheel(); }; container.appendChild(backBtn);
                if (notes.length === 0) { container.innerHTML += `<div class="flex-1 text-xs text-coffee-500 italic ml-2 flex items-center">Use 'Add' above to confirm selection.</div>`; } else {
                    notes.forEach(note => {
                        const btn = document.createElement('button'); btn.type = 'button'; btn.className = `sca-btn px-3 py-2 rounded text-xs font-bold shadow-sm opacity-80 hover:opacity-100 ${parentColor}`; btn.textContent = note;
                        btn.onclick = () => { if (scaState.path.length === 3) scaState.path.pop(); scaState.path.push(note); renderScaWheel(); }; container.appendChild(btn);
                    });
                }
            }
        };

        const addScaToNotes = () => { if (scaState.path.length === 0) return; const flavorToAdd = scaState.path[scaState.path.length - 1]; const input = document.getElementById('notes'); let currentText = input.value.trim(); if (currentText.length > 0) { if(currentText.endsWith(',')) currentText = currentText.slice(0, -1); input.value = `${currentText}, ${flavorToAdd}`; } else { input.value = flavorToAdd; } resetSca(); };
        const resetSca = () => { scaState = { level: 0, path: [], currentNode: null }; renderScaWheel(); };

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
        } = createSocialModule({
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            setCurrentView: (value) => { currentView = value; },
            getFollowing: () => following,
            setFollowingState: (value) => { following = value; },
            setFollowersState: (value) => { followers = value; },
            getIsPublic: () => isPublic,
            setIsPublicState: (value) => { isPublic = value; },
            db,
            doc,
            updateDoc,
            getDoc,
            getDocs,
            collection,
            writeBatch,
            openAppConfirm,
            changeView: (...args) => changeView(...args)
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
            getCurrentGalleryMode: () => currentGalleryMode,
            setCurrentGalleryMode: (value) => { currentGalleryMode = value; },
            getLastGalleryDoc: () => lastGalleryDoc,
            setLastGalleryDoc: (value) => { lastGalleryDoc = value; },
            getIsGalleryLoading: () => isGalleryLoading,
            setIsGalleryLoading: (value) => { isGalleryLoading = value; },
            getFollowing: () => following,
            getCoffees: () => coffees,
            db,
            storage,
            ref,
            uploadBytes,
            getDownloadURL,
            addDoc,
            collection,
            query,
            where,
            orderBy,
            limit,
            startAfter,
            getDocs,
            doc,
            deleteDoc,
            deleteObject,
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
            db,
            collection,
            getDocs,
            getCoffeeTypeDisplay: (brew) => getCoffeeTypeDisplay(brew),
            getCoffeeTypeForBrew: (brew) => getCoffeeTypeForBrew(brew),
            setCurrentStatsData: (value) => { currentStatsData = value; },
            getCurrentStatsData: () => currentStatsData,
            setCurrentBeanMeterPeriod: (value) => { currentBeanMeterPeriod = value; },
            getCurrentBeanMeterPeriod: () => currentBeanMeterPeriod,
            Chart
        });

        const setRating = (r) => { const c=document.getElementById('starContainer'); document.getElementById('ratingInput').value=r; for(let i=0;i<c.children.length;i++){ if(i<r)c.children[i].classList.add('active'); else c.children[i].classList.remove('active'); } };

        const openCoffeeScaleModal = () => {
            document.getElementById('coffeeScaleModal').classList.remove('hidden');
            if (coffeeScale?.autoConnect) coffeeScale.autoConnect();
        };

        const closeCoffeeScaleModal = () => {
            document.getElementById('coffeeScaleModal').classList.add('hidden');
        };

        const openConnectScaleModal = () => {
            document.getElementById('connectScaleModal').classList.remove('hidden');
            if (coffeeScale?.autoConnect) coffeeScale.autoConnect();
        };

        const closeConnectScaleModal = () => {
            document.getElementById('connectScaleModal').classList.add('hidden');
        };

        const {
            resetImportState,
            renderImportPreview,
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
            db,
            collection,
            doc,
            writeBatch,
            getFilteredCoffees: () => getFilteredCoffees(),
            getBeans: () => beans,
            getCoffeeTypes: () => coffeeTypes,
            getCoffeeTypeDisplay: (brew) => getCoffeeTypeDisplay(brew),
            getCoffeeTypeForBrew: (brew) => getCoffeeTypeForBrew(brew),
            openAppConfirm
        });

        const exportCSV = () => { 
            const d = getFilteredCoffees(); if(!d.length) return alert("No data"); 
            const esc = (t) => { if (t === null || t === undefined) return ''; const str = String(t); if (str.includes(',') || str.includes('"') || str.includes('\n')) return `"${str.replace(/"/g, '""')}"`; return str; };
            const h = ["Date","Roaster","Origin","Blend/Farmer","Variety","Process","Roast","Method","Grinder","Grind","In(g)","Out(g)","Time(s)","Temp","Drink","Rating","Notes","Improve"]; 
            const r = d.map(c => { const type = getCoffeeTypeDisplay(c); return [ c.createdAt || '', esc(type.roaster), esc(type.origin), esc(type.farmer), esc(type.variety), esc(type.processing), esc(type.roastType), esc(c.method), esc(c.grinder), esc(c.grind), esc(c.weight), (c.weight && c.ratio) ? (c.weight * c.ratio).toFixed(1) : '', esc(c.time), esc(c.temp), esc(c.drink), esc(c.rating), esc(c.notes), esc(c.improve) ]; }); 
            const csvContent = "data:text/csv;charset=utf-8," + h.join(",") + "\n" + r.map(e => e.join(",")).join("\n"); 
            const encodedUri = encodeURI(csvContent); const link = document.createElement("a"); link.setAttribute("href", encodedUri); link.setAttribute("download", "coffee_log.csv"); document.body.appendChild(link); link.click(); document.body.removeChild(link); 
        };

        const handleRecipeInput = (s) => { const w=document.getElementById('inputWeight'),r=document.getElementById('inputRatio'),y=document.getElementById('inputYield'); const wv=parseFloat(w.value)||0,yv=parseFloat(y.value)||0; if(!wv)return; if(s==='weight'){ if(yv>0)r.value=(yv/wv).toFixed(2); } else if(s==='yield'){ if(wv>0)r.value=(yv/wv).toFixed(2); } };
        const handleQuickEditRecipeInput = (source) => {
            const weightInput = document.getElementById('quickEditWeight');
            const yieldInput = document.getElementById('quickEditYield');
            const ratioInput = document.getElementById('quickEditRatio');
            if (!weightInput || !yieldInput || !ratioInput) return;
            const weightVal = parseFloat(weightInput.value);
            const yieldVal = parseFloat(yieldInput.value);
            if (!Number.isFinite(weightVal) || weightVal <= 0) {
                ratioInput.value = '';
                return;
            }
            if (source === 'weight' || source === 'yield') {
                if (Number.isFinite(yieldVal) && yieldVal >= 0) {
                    ratioInput.value = (yieldVal / weightVal).toFixed(2);
                } else {
                    ratioInput.value = '';
                }
            }
        };
        const setTempMode = (m) => { 
            document.getElementById('tempMode').value = m; const btnNum = document.getElementById('btnTempNumeric'); const btnProf = document.getElementById('btnTempProfile'); const conNum = document.getElementById('tempNumericContainer'); const conProf = document.getElementById('tempProfileContainer');
            const activeClass = "px-2 py-0.5 text-[10px] rounded font-bold transition-all bg-white dark:bg-[#1c1917] shadow-sm text-coffee-800 dark:text-white"; const inactiveClass = "px-2 py-0.5 text-[10px] rounded font-bold transition-all text-coffee-500 dark:text-[#a8a29e] hover:text-coffee-700";
            if (m === 'numeric') { conNum.classList.remove('hidden'); conProf.classList.add('hidden'); btnNum.className = activeClass; btnProf.className = inactiveClass; } else { conProf.classList.remove('hidden'); conNum.classList.add('hidden'); btnProf.className = activeClass; btnNum.className = inactiveClass; }
        };

        const updateCoffeeDetailsTitle = () => {
            const titleEl = document.getElementById('coffeeDetailsTitle');
            const body = document.getElementById('coffeeDetailsBody');
            const farmerEl = document.getElementById('farmer');
            if (!titleEl || !body || !farmerEl) return;
            const isCollapsed = body.classList.contains('hidden');
            const farmerValue = (farmerEl.value || '').trim();
            const roasterEl = document.getElementById('roaster');
            const roasterValue = (roasterEl?.value || '').trim();
            if (isCollapsed && (farmerValue || roasterValue)) {
                titleEl.textContent = farmerValue || roasterValue;
            } else {
                titleEl.textContent = 'Coffee Details';
            }
        };

        const setCoffeeDetailsCollapsed = (collapsed) => {
            const body = document.getElementById('coffeeDetailsBody');
            const icon = document.getElementById('coffeeDetailsToggleIcon');
            if (!body || !icon) return;
            body.classList.toggle('hidden', collapsed);
            icon.classList.toggle('rotate-180', collapsed);
            localStorage.setItem('coffeeDetailsCollapsed', collapsed ? 'true' : 'false');
            updateCoffeeDetailsTitle();
        };

        const toggleCoffeeDetails = (e) => {
            if (e) e.stopPropagation();
            const body = document.getElementById('coffeeDetailsBody');
            if (!body) return;
            const isHidden = body.classList.contains('hidden');
            setCoffeeDetailsCollapsed(!isHidden);
        };

        const initCoffeeDetailsCollapsed = () => {
            const collapsed = localStorage.getItem('coffeeDetailsCollapsed') === 'true';
            setCoffeeDetailsCollapsed(collapsed);
            ['farmer', 'roaster'].forEach((id) => {
                const el = document.getElementById(id);
                if (!el) return;
                el.addEventListener('input', updateCoffeeDetailsTitle);
                el.addEventListener('change', updateCoffeeDetailsTitle);
            });
        };
        initCoffeeDetailsCollapsed();
        
        const toggleForm = (f=null) => { 
            const c=document.getElementById('formContainer'),o=document.getElementById('formContent'),e=c.getAttribute('aria-expanded')==='true',s=f!==null?f:!e; 
            c.setAttribute('aria-expanded',s?'true':'false'); if(s){ o.classList.remove('hidden'); if(document.getElementById('notesMode').value === 'sca') renderScaWheel(); if (coffeeScale?.autoConnect) coffeeScale.autoConnect(); const isEditing = c.classList.contains('editing-mode') || !!document.getElementById('editId').value; if (!isEditing && coffeeScale?.applyGraphTogglePrefsForMethod) coffeeScale.applyGraphTogglePrefsForMethod(); } else { o.classList.add('hidden'); } 
        };
        
        const getCoffeeTypeForBrew = (brew) => {
            if (!brew || !brew.beanId) return null;
            const bean = beans.find(b => b.id === brew.beanId);
            if (!bean || !bean.coffeeTypeId) return null;
            return coffeeTypes.find(ct => ct.id === bean.coffeeTypeId) || null;
        };

        const getCoffeeTypeDisplay = (brew) => {
            const type = getCoffeeTypeForBrew(brew);
            return {
                roaster: type?.roaster || brew?.roaster || '-',
                farmer: type?.farmer || brew?.farmer || '-',
                origin: type?.origin || brew?.origin || '-',
                processing: type?.processing || brew?.processing || '-',
                variety: type?.variety || brew?.variety || '-',
                roastType: type?.roast || type?.roastType || brew?.roastType || '-'
            };
        };

        const getCoffeeTypeForBean = (bean) => {
            if (!bean || !bean.coffeeTypeId) return null;
            return coffeeTypes.find(ct => ct.id === bean.coffeeTypeId) || null;
        };

        const getBeanCoffeeTypeDisplay = (bean) => {
            const type = getCoffeeTypeForBean(bean);
            return {
                roaster: type?.roaster || bean?.roaster || '-',
                farmer: type?.farmer || bean?.farmer || '-',
                origin: type?.origin || bean?.origin || '-',
                processing: type?.processing || bean?.processing || '-',
                variety: type?.variety || bean?.variety || '-',
                roastType: type?.roast || type?.roastType || bean?.roastType || '-'
            };
        };

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
            db,
            doc,
            updateDoc,
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
            autoPinOpenBagsIfEnabled: (...args) => autoPinOpenBagsIfEnabled(...args)
        });

        const { resetCardPhotoState, triggerCardPhoto, handleCardPhoto } = createBrewsCardPhotoModule();

        const {
            populateCardData,
            getBrewTableOrder,
            openCoffeeCard,
            updateCoffeeCardNav,
            navigateCoffeeCard,
            closeCoffeeCard
        } = createBrewsCardUiModule({
            getCurrentView: () => currentView,
            getCoffees: () => coffees,
            getFilteredCoffees: () => getFilteredCoffees(),
            getDisplayedBrewsCount: () => displayedBrewsCount,
            getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
            getStarDisplay,
            formatTime,
            getTempBadge: (...args) => getTempBadge(...args),
            setCurrentCardCoffee: (value) => { currentCardCoffee = value; },
            getCurrentCoffeeCardId: () => currentCoffeeCardId,
            setCurrentCoffeeCardId: (value) => { currentCoffeeCardId = value; },
            setCurrentCardGraphData: (value) => { currentCardGraphData = value; },
            updateCoffeeCardActionMenu: (...args) => updateCoffeeCardActionMenu(...args),
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

        const { populateForm, refreshBrewGearField, getSelectedBrewGearIds, setSelectedBrewGearIds } = createBrewsFormModule({
            setTempMode: (...args) => setTempMode(...args),
            setRating: (...args) => setRating(...args),
            setNotesMode: (...args) => setNotesMode(...args),
            getCoffeeScale: () => coffeeScale,
            getGasItems: () => gasItems
        });

        const {
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
            resetFormState
        } = createBrewsActionsModule({
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentCoffeeCardId: () => currentCoffeeCardId,
            getCurrentCardCoffee: () => currentCardCoffee,
            getCoffees: () => coffees,
            getBeans: () => beans,
            getCoffeeTypes: () => coffeeTypes,
            getGasItems: () => gasItems,
            getBeanCoffeeTypeDisplay: (...args) => getBeanCoffeeTypeDisplay(...args),
            db,
            doc,
            updateDoc,
            addDoc,
            deleteDoc,
            collection,
            openAppConfirm,
            parseNum,
            setTempMode: (...args) => setTempMode(...args),
            setNotesMode: (...args) => setNotesMode(...args),
            resetSca: (...args) => resetSca(...args),
            setRating: (...args) => setRating(...args),
            toggleForm: (...args) => toggleForm(...args),
            populateForm: (...args) => populateForm(...args),
            changeView: (...args) => changeView(...args),
            closeCoffeeCard: (...args) => closeCoffeeCard(...args),
            openCoffeeCard: (...args) => openCoffeeCard(...args),
            closeCoffeeCardMenu: (...args) => closeCoffeeCardMenu(...args),
            handleQuickEditRecipeInput: (...args) => handleQuickEditRecipeInput(...args),
            archiveBeanIfStockDepleted: (...args) => archiveBeanIfStockDepleted(...args),
            updateBeansLeftForBean: (...args) => updateBeansLeftForBean(...args),
            autoPinOpenBagsIfEnabled: (...args) => autoPinOpenBagsIfEnabled(...args),
            getFirstBrewDateForBean: (...args) => getFirstBrewDateForBean(...args),
            showCoffeeTypeCreatedToast: (...args) => showCoffeeTypeCreatedToast(...args),
            uploadPendingBeanImage: (...args) => uploadPendingBeanImage(...args),
            clearPendingAIBeanImageFile: (...args) => clearPendingAIBeanImageFile(...args),
            getCoffeeScale: () => coffeeScale,
            getSelectedBrewGearIds: () => getSelectedBrewGearIds(),
            setSelectedBrewGearIds: (...args) => setSelectedBrewGearIds(...args)
        });
        refreshBrewGearSelectors = () => {
            refreshBrewGearField();
            refreshQuickEditGearFieldVisibility();
        };
        refreshBrewGearSelectors();

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
            loadMoreBrews
        } = createBrewsTableModule({
            getCoffees: () => coffees,
            getBeans: () => beans,
            getCoffeeTypes: () => coffeeTypes,
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
            getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
            getCoffeeTypeForBrew: (...args) => getCoffeeTypeForBrew(...args),
            getStarDisplay,
            formatBeanOpenedDate,
            formatTime,
            openCoffeeCard: (...args) => openCoffeeCard(...args),
            changeView: (...args) => changeView(...args)
        });

        const { renderPinnedTiles, togglePinnedTiles } = createPinControllerModule({
            db,
            doc,
            writeBatch,
            getCurrentUser: () => currentUser,
            getCurrentView: () => currentView,
            getCurrentSort: () => currentSort,
            getActiveFilters: () => activeFilters,
            getCoffees: () => coffees,
            setCoffees: (value) => { coffees = value; },
            getBeans: () => beans,
            getPinnedBrewsPreferences: () => pinnedBrewsPreferences,
            getBeanCalculatedStock: (...args) => getBeanCalculatedStock(...args),
            getCoffeeTypeDisplay: (...args) => getCoffeeTypeDisplay(...args),
            openCoffeeCard: (...args) => openCoffeeCard(...args),
            renderTable: (...args) => renderTable(...args)
        });

        const toggleActionMenu = (menuId, e) => {
            const eventObj = e;
            if (eventObj?.stopPropagation) eventObj.stopPropagation();
            document.querySelectorAll('.action-menu').forEach((el) => {
                if (el.id !== menuId) el.classList.add('hidden');
            });
            const menu = document.getElementById(menuId);
            if (!menu) return;

            menu.classList.toggle('hidden');
            if (menu.classList.contains('hidden')) return;

            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.left = '';
            menu.style.right = '';
            menu.style.marginTop = '';
            menu.style.marginBottom = '';

            setTimeout(() => {
                const rect = menu.getBoundingClientRect();
                const viewportWidth = window.innerWidth;
                const viewportHeight = window.innerHeight;
                const headerHeight = 70;
                const isTableMenu = menuId.startsWith('action-menu-');

                if (isTableMenu) {
                    menu.style.top = '100%';
                    menu.style.bottom = 'auto';
                    menu.style.marginTop = '0.25rem';
                    menu.style.marginBottom = '0';
                    menu.classList.remove('origin-bottom-right');
                    menu.classList.add('origin-top-right');
                } else {
                    const overflowsBottom = rect.bottom > viewportHeight - 20;
                    const wouldOverflowTop = rect.top - rect.height < headerHeight;
                    if (overflowsBottom && !wouldOverflowTop) {
                        menu.style.top = 'auto';
                        menu.style.bottom = '100%';
                        menu.style.marginTop = '0';
                        menu.style.marginBottom = '0.5rem';
                        menu.classList.remove('origin-top-right');
                        menu.classList.add('origin-bottom-right');
                    } else {
                        menu.style.top = '100%';
                        menu.style.bottom = 'auto';
                        menu.style.marginTop = '0.5rem';
                        menu.style.marginBottom = '0';
                        menu.classList.remove('origin-bottom-right');
                        menu.classList.add('origin-top-right');
                    }
                }

                const menuWidth = rect.width;
                const menuLeft = rect.left;
                if (menuLeft < 10) {
                    menu.style.right = 'auto';
                    menu.style.left = '0';
                    menu.classList.remove('origin-top-right', 'origin-bottom-right');
                    menu.classList.add(menu.style.bottom === '100%' ? 'origin-bottom-left' : 'origin-top-left');
                } else if (menuLeft + menuWidth > viewportWidth - 10) {
                    menu.style.left = 'auto';
                    menu.style.right = '0';
                }
            }, 0);
        };

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

        const handleCardKeyNav = (event) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
            const target = event.target;
            if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable)) {
                return;
            }

            const dir = event.key === 'ArrowLeft' ? -1 : 1;
            const isVisible = (id) => {
                const el = document.getElementById(id);
                return el && !el.classList.contains('hidden');
            };
            const tryNavigate = (btnId, action) => {
                const btn = document.getElementById(btnId);
                if (!btn || btn.disabled || btn.classList.contains('hidden')) return false;
                action();
                return true;
            };

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

        document.addEventListener('keydown', handleEscapeKey);
        const handleAuthStateChanged = async (user) => {
            currentUser = user;
            const setMenuVisibility = (loggedIn) => {
                const ids = [
                    'menuStatsBtn',
                    'menuBeansBtn',
                    'menuCoffeesBtn',
                    'menuGasBtn',
                    'menuGalleryBtn',
                    'menuScaleBtn',
                    'menuExportBtn',
                    'menuImportBtn',
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
                document.getElementById('authContainer').innerHTML = `<div class="flex flex-col sm:flex-row sm:items-center gap-2"><button data-action-click="googleLogin()" class="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors"><i class="fa-brands fa-google"></i> Sign In</button></div>`;
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

        const actions = {
            triggerAIScan, handleAIFile, toggleAiMenu, triggerBeansAIScan, handleBeansAIFile, toggleBeansAiMenu, triggerAIProfile, googleLogin, googleLogout, openFriendsModal, closeModal, switchGalleryTab, switchModalTab, togglePublicProfile, copyShareId, followUser, unfollowUser, changeView, toggleForm, resetFormState, handleFormSubmit, handleRecipeInput, handleQuickEditRecipeInput, setTempMode, setNotesMode, resetSca, addScaToNotes, editCoffee, duplicateCoffee, duplicateFromCard, fastDuplicateFromCard, cloneBrew, deleteCoffee, discardForm, toggleActive, sortBy, openFilterMenu, applyFilter, clearAllFilters, closeMenus, getFilteredCoffees, setRating, exportCSV, openExportModal, closeExportModal, performExport, openImportModal, closeImportModal, handleImportFileChange, performImport, exportBrewsAsCSV, exportBrewsAsBeanconquerorCSV, exportCoffeesAsCSV, exportCoffeesAsJSON, openGraphModal, closeGraphModal, openImageModal, closeImageModal, openCoffeeCard, closeCoffeeCard, navigateCoffeeCard, openBeanCard, closeBeanCard, navigateBeanCard, openBrewWithBean, enterBeanEditMode, cancelBeanEditMode, saveBeanCardEdits, triggerBeanPhoto, handleBeanPhoto, openBeanPhoto, removeBeanPhoto, openBeanShopUrl, openCardGraphModal, closeCardGraphModal, navigateCoffeeCardFromGraph, toggleMainMenu, openUploadModal, closeUploadModal, handlePhotoSubmit, openGallery, deletePhoto, openEasterEgg, closeEasterEgg, openPreferences, savePreferences, clearSearch, toggleDrinkOther, toggleMethodOther, openHelp, closeHelp, openAbout, closeAbout, toggleAllFriends, loadMoreGallery, resetZoom, openStats, closeStats, changeStatsView, toggleStatsUniqueTable, toggleActionMenu, shareCoffeeCard, toggleCardMode, triggerCardPhoto, handleCardPhoto, generateShareImage, resetCardPhotoState, updateBeanMeter, refreshTableData, fillBeanDetails, loadMoreBrews, toggleQuickFilter, openQuickFilterValues, applyFilterFromQuick, hideAiProfile, hideGalleryModal, hidePreferencesModal, handleCoffeeCardOverlayClick, handleBeanCardOverlayClick, handleCoffeeTypeCardOverlayClick, handleGasCardOverlayClick, openCoffeeScaleModal, closeCoffeeScaleModal, openConnectScaleModal, closeConnectScaleModal, sendEmailLinkActivation, sendEmailLinkLogin, openCoffeeCardQuickEdit, openExternalUrl,
            togglePinnedTiles,
            fastRepeatCoffee,
            editBrewFromCard,
            enterBrewQuickEditMode,
            cancelBrewQuickEditMode,
            saveBrewQuickEdits,
            closeCoffeeTypeCardMenu,
            closeBeanCardMenu,
            // New Beans Functions
            openBeans, closeBeans, saveBeanStock, saveBeanOpenedDate, saveBeanFrozenDate, saveBeanRoastDate, toggleBeanArchive, toggleBeanFrozen, openNewBag, deleteBean, syncLegacyBeans, extractCoffeeTypesFromBeans,
            openCoffeeTypes, closeCoffeeTypes, setCoffeeTypesSearch, setCoffeeTypesSort, openCoffeeTypeCard, closeCoffeeTypeCard, enterCoffeeTypeEditMode, cancelCoffeeTypeEditMode, saveCoffeeTypeEdits, openCoffeeTypeShopUrl, navigateCoffeeTypeCard, triggerCoffeeTypePhoto, handleCoffeeTypePhoto, openCoffeeTypePhoto, removeCoffeeTypePhoto,
            openGasList, closeGasList, createGasItemFromModal, setGasSearch, clearGasSearch, toggleGasQuickFilter, openGasQuickFilterValues, applyGasFilterFromQuick, clearGasFilters, setGasSort, openGasCard, closeGasCard, navigateGasCard, enterGasEditMode, cancelGasEditMode, saveGasEdits, toggleGasArchive, deleteGasItem, openGasFromTableEdit, toggleGasArchiveFromTable, deleteGasFromTable, triggerGasPhoto, openGasPhoto, removeGasPhoto, handleGasPhoto,
            closeCoffeeCardMenu,
            toggleCoffeeDetails,
            createCoffeeTypeFromModal,
            deleteCoffeeType,
            createBeanFromModal,
            toggleCoffeeTypesAiMenu,
            triggerCoffeeTypesAIScan,
            handleCoffeeTypesAIFile,
            setBeansSearch,
            clearBeansSearch,
            clearCoffeeTypesSearch,
            toggleBeansQuickFilter,
            openBeansQuickFilterValues,
            applyBeansFilterFromQuick,
            clearBeansFilters,
            toggleCoffeeTypesQuickFilter,
            openCoffeeTypesQuickFilterValues,
            applyCoffeeTypesFilterFromQuick,
            clearCoffeeTypesFilters,
            showBeansForCoffeeType,
            openNewBagForCoffeeType,
            openNewBagForCoffeeTypeFromTable,
            showBrewsForCoffeeType,
            showBeansForCoffeeTypeFromTable,
            showBrewsForCoffeeTypeFromTable,
            openCoffeeTypeFromTableEdit,
            deleteCoffeeTypeFromTable,
            showBrewsForBean,
            showCoffeeForBean,
            showBeanForBrew,
            showCoffeeForBrew,
            closeAutoArchiveToast,
            handleAutoArchiveToastAction,
            closeCoffeeTypeCreatedToast,
            closeAutoPinToast,
            closeAppConfirm,
            resolveAppConfirm,
            openSelectedBeanForEdit,
            openCoffeeFromBeanEdit,
            recalculateAllBeanStockLeft,
            migrateGrinderToGear
        };

        const searchInput = document.getElementById('globalSearch'); 
        if(searchInput) { searchInput.addEventListener('input', (e) => { const clearBtn = document.getElementById('searchClearBtn'); if(e.target.value.length > 0) clearBtn.classList.remove('hidden'); else clearBtn.classList.add('hidden'); displayedBrewsCount = BREWS_PER_PAGE; renderTable(); }); }


        return { handleAuthStateChanged, actions };
};
