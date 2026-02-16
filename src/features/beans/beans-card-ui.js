import { createBeansVmModule } from './beans.vm.js';

export const createBeansCardUiModule = ({
    getBeans,
    getCoffeeTypeForBean,
    getCurrentView,
    getCurrentBeanCardId,
    setCurrentBeanCardId,
    getBeanCalculatedStock,
    getBeanCoffeeTypeDisplay,
    getBeanTableOrder,
    openBrewWithBean,
    deleteBean,
    showBrewsForBean,
    showCoffeeForBean,
    enterBeanEditMode,
    cancelBeanEditMode,
    toggleBeanFrozen,
    toggleBeanArchive,
    dispatchCommand,
    publishEvent
}) => {
    let navigationOrderOverride = null;
    const beansVm = createBeansVmModule();

    const formatCardDate = (value) => beansVm.formatCardDate(value);

    const updateBeanCardActionButtons = (bean) => {
        const freezeBtn = document.getElementById('beanCardFreezeBtn');
        const archiveBtn = document.getElementById('beanCardArchiveBtn');
        const freezeActionBtn = document.getElementById('beanCardActionFreeze');
        const archiveActionBtn = document.getElementById('beanCardActionArchive');

        if (freezeBtn) {
            const freezeLabel = bean.frozen ? 'Unfreeze' : 'Freeze';
            const freezeIcon = bean.frozen ? 'fa-sun' : 'fa-snowflake';
            freezeBtn.innerHTML = `<i class="fa-solid ${freezeIcon}"></i> ${freezeLabel}`;
            freezeBtn.onclick = () => toggleBeanFrozen(bean.id, !!bean.frozen);
        }

        if (archiveBtn) {
            const archiveLabel = bean.archived ? 'Unarchive' : 'Archive';
            const archiveIcon = bean.archived ? 'fa-box-open' : 'fa-box-archive';
            archiveBtn.innerHTML = `<i class="fa-solid ${archiveIcon}"></i> ${archiveLabel}`;
            archiveBtn.onclick = () => toggleBeanArchive(bean.id, !!bean.archived);
        }

        if (freezeActionBtn) {
            const freezeLabel = bean.frozen ? 'Unfreeze' : 'Freeze';
            const freezeIcon = bean.frozen ? 'fa-sun' : 'fa-snowflake';
            freezeActionBtn.innerHTML = `<i class="fa-solid ${freezeIcon} text-sky-600 w-4"></i> ${freezeLabel}`;
            freezeActionBtn.onclick = () => toggleBeanFrozen(bean.id, !!bean.frozen);
        }

        if (archiveActionBtn) {
            const archiveLabel = bean.archived ? 'Unarchive' : 'Archive';
            const archiveIcon = bean.archived ? 'fa-box-open' : 'fa-box-archive';
            archiveActionBtn.innerHTML = `<i class="fa-solid ${archiveIcon} text-amber-600 w-4"></i> ${archiveLabel}`;
            archiveActionBtn.onclick = () => toggleBeanArchive(bean.id, !!bean.archived);
        }
    };

    const updateBeanCardNav = () => {
        const order =
            Array.isArray(navigationOrderOverride) && navigationOrderOverride.length
                ? navigationOrderOverride
                : getBeanTableOrder();
        const idx = order.indexOf(getCurrentBeanCardId());
        const prevBtn = document.getElementById('beanCardPrevBtn');
        const nextBtn = document.getElementById('beanCardNextBtn');
        if (!prevBtn || !nextBtn) return;

        prevBtn.disabled = idx <= 0;
        nextBtn.disabled = idx === -1 || idx >= order.length - 1;
        prevBtn.classList.toggle('opacity-40', prevBtn.disabled);
        prevBtn.classList.toggle('cursor-not-allowed', prevBtn.disabled);
        nextBtn.classList.toggle('opacity-40', nextBtn.disabled);
        nextBtn.classList.toggle('cursor-not-allowed', nextBtn.disabled);
    };

    const openBeanCardInternal = (beanId, ev, keepNavigationOrder = false) => {
        if (ev) ev.stopPropagation();
        if (!keepNavigationOrder && navigationOrderOverride?.length && !navigationOrderOverride.includes(beanId)) {
            navigationOrderOverride = null;
        }
        const bean = getBeans().find((b) => b.id === beanId);
        if (!bean) return;

        const coffeeDisplay = getBeanCoffeeTypeDisplay(bean);
        document.querySelectorAll('.action-menu').forEach((el) => el.classList.add('hidden'));
        setCurrentBeanCardId(bean.id);

        const isMine = getCurrentView() === 'mine';
        const cardVm = beansVm.buildBeanCardViewModel({
            bean,
            coffeeDisplay,
            stockLeft: getBeanCalculatedStock(bean)
        });

        document.getElementById('beanCardTitle').textContent = cardVm.farmer;
        document.getElementById('beanCardSubtitle').textContent = cardVm.roaster;
        document.getElementById('beanCardOrigin').textContent = cardVm.origin;
        document.getElementById('beanCardProcess').textContent = cardVm.process;
        document.getElementById('beanCardVariety').textContent = cardVm.variety;
        document.getElementById('beanCardRoast').textContent = cardVm.roastType;
        document.getElementById('beanCardPrice').textContent = cardVm.price;
        document.getElementById('beanCardStock').textContent = cardVm.stock;
        document.getElementById('beanCardStockLeft').textContent = cardVm.stockLeft;
        document.getElementById('beanCardStatus').textContent = cardVm.status;
        document.getElementById('beanCardOpened').textContent = cardVm.openedDate;
        document.getElementById('beanCardFrozen').textContent = cardVm.frozenDate;
        document.getElementById('beanCardRoastDate').textContent = cardVm.roastDate;
        document.getElementById('beanCardArchivedDate').textContent = cardVm.archivedDate;

        const coffeeType = getCoffeeTypeForBean(bean);
        const coffeeImageUrl = coffeeType?.imageUrl || coffeeType?.imageURL || '';
        const beanImageUrl = bean.imageURL || bean.imageUrl || '';
        const imgEl = document.getElementById('beanCardImage');
        const placeholderEl = document.getElementById('beanCardImagePlaceholder');
        const beanImgEl = document.getElementById('beanCardBeanImage');
        const beanPlaceholderEl = document.getElementById('beanCardBeanImagePlaceholder');
        const beanImageControlsEl = document.getElementById('beanCardBeanImageControls');
        if (coffeeImageUrl) {
            imgEl.src = coffeeImageUrl;
            imgEl.classList.remove('hidden');
            placeholderEl.classList.add('hidden');
        } else {
            imgEl.src = '';
            imgEl.classList.add('hidden');
            placeholderEl.classList.remove('hidden');
        }
        if (imgEl) {
            if (bean.coffeeTypeId) {
                imgEl.classList.add('cursor-pointer');
                imgEl.onclick = (event) => {
                    event.stopPropagation();
                    dispatchCommand?.(
                        'coffees.openCard',
                        { id: bean.coffeeTypeId, source: 'beans.image' }
                    );
                };
            } else {
                imgEl.classList.remove('cursor-pointer');
                imgEl.onclick = null;
            }
        }
        if (placeholderEl) {
            if (bean.coffeeTypeId) {
                placeholderEl.classList.add('cursor-pointer');
                placeholderEl.onclick = (event) => {
                    event.stopPropagation();
                    dispatchCommand?.(
                        'coffees.openCard',
                        { id: bean.coffeeTypeId, source: 'beans.image' }
                    );
                };
            } else {
                placeholderEl.classList.remove('cursor-pointer');
                placeholderEl.onclick = null;
            }
        }
        if (beanImageUrl) {
            beanImgEl.src = beanImageUrl;
            beanImgEl.classList.remove('hidden');
            beanPlaceholderEl.classList.add('hidden');
        } else {
            beanImgEl.src = '';
            beanImgEl.classList.add('hidden');
            beanPlaceholderEl.classList.remove('hidden');
        }
        if (beanImageControlsEl) {
            beanImageControlsEl.classList.toggle('hidden', !isMine);
        }

        const brewBtn = document.getElementById('beanCardBrewBtn');
        const deleteBtn = document.getElementById('beanCardDeleteBtn');
        const showBrewsBtn = document.getElementById('beanCardShowBrewsBtn');
        const showCoffeeBtn = document.getElementById('beanCardShowCoffeeBtn');
        const editActionBtn = document.getElementById('beanCardActionEdit');
        const brewActionBtn = document.getElementById('beanCardActionBrew');
        const brewsActionBtn = document.getElementById('beanCardActionBrews');
        const coffeeActionBtn = document.getElementById('beanCardActionCoffee');
        const deleteActionBtn = document.getElementById('beanCardActionDelete');
        const editBtn = document.getElementById('beanCardEditBtn');
        const menuBtn = document.getElementById('beanCardMenuBtn');
        const freezeBtn = document.getElementById('beanCardFreezeBtn');
        const archiveBtn = document.getElementById('beanCardArchiveBtn');

        if (brewBtn) {
            brewBtn.onclick = () => {
                closeBeanCard(null);
                openBrewWithBean(bean.id);
            };
            brewBtn.classList.toggle('hidden', !isMine);
        }

        if (deleteBtn) {
            deleteBtn.onclick = () => {
                closeBeanCard(null);
                deleteBean(bean.id);
            };
            deleteBtn.classList.toggle('hidden', !isMine);
        }

        if (showBrewsBtn) showBrewsBtn.onclick = () => showBrewsForBean(bean.id);

        if (brewActionBtn) {
            brewActionBtn.onclick = () => {
                closeBeanCard(null);
                openBrewWithBean(bean.id);
            };
            brewActionBtn.classList.toggle('hidden', !isMine);
        }

        if (editActionBtn) {
            editActionBtn.onclick = () => enterBeanEditMode();
            editActionBtn.classList.toggle('hidden', !isMine);
        }

        if (brewsActionBtn) brewsActionBtn.onclick = () => showBrewsForBean(bean.id);

        if (deleteActionBtn) {
            deleteActionBtn.onclick = () => {
                closeBeanCard(null);
                deleteBean(bean.id);
            };
            deleteActionBtn.classList.toggle('hidden', !isMine);
        }

        if (showCoffeeBtn) {
            if (bean.coffeeTypeId) {
                showCoffeeBtn.disabled = false;
                showCoffeeBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                showCoffeeBtn.onclick = () => showCoffeeForBean(bean.coffeeTypeId);
            } else {
                showCoffeeBtn.disabled = true;
                showCoffeeBtn.classList.add('opacity-40', 'cursor-not-allowed');
                showCoffeeBtn.onclick = null;
            }
        }

        if (coffeeActionBtn) {
            if (bean.coffeeTypeId) {
                coffeeActionBtn.disabled = false;
                coffeeActionBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                coffeeActionBtn.onclick = () => showCoffeeForBean(bean.coffeeTypeId);
            } else {
                coffeeActionBtn.disabled = true;
                coffeeActionBtn.classList.add('opacity-40', 'cursor-not-allowed');
                coffeeActionBtn.onclick = null;
            }
        }

        if (editBtn) editBtn.classList.toggle('hidden', !isMine);
        if (menuBtn) menuBtn.classList.toggle('hidden', !isMine);
        if (freezeBtn) freezeBtn.classList.toggle('hidden', !isMine);
        if (archiveBtn) archiveBtn.classList.toggle('hidden', !isMine);

        updateBeanCardActionButtons(bean);
        updateBeanCardNav();

        document.getElementById('beanCardOverlay').classList.remove('hidden');
        cancelBeanEditMode();
        publishEvent?.('beans.cardOpened', { beanId: bean.id });
    };

    const openCardWithOrder = (beanId, order = [], ev = null) => {
        const cleanedOrder = Array.from(new Set((order || []).filter(Boolean)));
        navigationOrderOverride = cleanedOrder.length ? cleanedOrder : null;
        openBeanCardInternal(beanId, ev, true);
    };

    const navigateBeanCard = (direction) => {
        const order =
            Array.isArray(navigationOrderOverride) && navigationOrderOverride.length
                ? navigationOrderOverride
                : getBeanTableOrder();
        const idx = order.indexOf(getCurrentBeanCardId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        openBeanCardInternal(order[nextIdx], null, true);
    };

    const closeBeanCard = (e) => {
        if (!e || e.target.id === 'beanCardOverlay') {
            navigationOrderOverride = null;
            document.getElementById('beanCardOverlay').classList.add('hidden');
            publishEvent?.('beans.cardClosed', { beanId: getCurrentBeanCardId() });
        }
    };

    const closeBeanCardMenu = () => {
        const menu = document.getElementById('beanCardActionMenu');
        if (menu) menu.classList.add('hidden');
    };

    return {
        updateBeanCardActionButtons,
        updateBeanCardNav,
        openCard: openBeanCardInternal,
        openCardWithOrder,
        navigateBeanCard,
        closeBeanCard,
        closeBeanCardMenu
    };
};
