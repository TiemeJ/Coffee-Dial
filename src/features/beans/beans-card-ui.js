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
    openNewBag,
    deleteBean,
    showBrewsForBean,
    showCoffeeForBean,
    openCoffeeTypeCard,
    enterBeanEditMode,
    cancelBeanEditMode,
    toggleBeanFrozen,
    toggleBeanArchive
}) => {
    let navigationOrderOverride = null;

    const formatCardDate = (value) => {
        if (!value) return '-';
        const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        if (isNaN(dateObj)) return '-';
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yy = String(dateObj.getFullYear()).slice(-2);
        return `${dd}/${mm}/${yy}`;
    };

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

    const getBeanCardOrder = () =>
        Array.isArray(navigationOrderOverride) && navigationOrderOverride.length
            ? navigationOrderOverride
            : getBeanTableOrder();

    const updateBeanCardNav = () => {
        const order = getBeanCardOrder();
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

    const openBeanCard = (beanId, ev, keepNavigationOrder = false) => {
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
        const statusParts = [];
        if (bean.archived) statusParts.push('Archived');
        if (bean.frozen) statusParts.push('Frozen');
        if (!statusParts.length) statusParts.push('Active');

        const stockLeft = getBeanCalculatedStock(bean);
        const stockLeftDisplay = stockLeft === null || isNaN(stockLeft) ? '-' : `${stockLeft.toFixed(1)}g`;
        const stockDisplay = bean.stock === undefined || bean.stock === null || bean.stock === '' ? '-' : `${bean.stock}g`;

        document.getElementById('beanCardTitle').textContent = coffeeDisplay.farmer;
        document.getElementById('beanCardSubtitle').textContent = coffeeDisplay.roaster !== '-' ? coffeeDisplay.roaster : 'Unknown Roaster';
        document.getElementById('beanCardOrigin').textContent = coffeeDisplay.origin;
        document.getElementById('beanCardProcess').textContent = coffeeDisplay.processing;
        document.getElementById('beanCardVariety').textContent = coffeeDisplay.variety;
        document.getElementById('beanCardRoast').textContent = coffeeDisplay.roastType;
        document.getElementById('beanCardStock').textContent = stockDisplay;
        document.getElementById('beanCardStockLeft').textContent = stockLeftDisplay;
        document.getElementById('beanCardStatus').textContent = statusParts.join(' • ');
        document.getElementById('beanCardOpened').textContent = formatCardDate(bean.openedDate);
        document.getElementById('beanCardFrozen').textContent = formatCardDate(bean.frozenDate);
        document.getElementById('beanCardRoastDate').textContent = formatCardDate(bean.roastDate);
        document.getElementById('beanCardArchivedDate').textContent = formatCardDate(bean.archivedDate);

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
                    openCoffeeTypeCard(bean.coffeeTypeId);
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
                    openCoffeeTypeCard(bean.coffeeTypeId);
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
        const openNewBagBtn = document.getElementById('beanCardOpenNewBagBtn');
        const deleteBtn = document.getElementById('beanCardDeleteBtn');
        const showBrewsBtn = document.getElementById('beanCardShowBrewsBtn');
        const showCoffeeBtn = document.getElementById('beanCardShowCoffeeBtn');
        const editActionBtn = document.getElementById('beanCardActionEdit');
        const brewActionBtn = document.getElementById('beanCardActionBrew');
        const brewsActionBtn = document.getElementById('beanCardActionBrews');
        const coffeeActionBtn = document.getElementById('beanCardActionCoffee');
        const openBagActionBtn = document.getElementById('beanCardActionOpenBag');
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

        if (openNewBagBtn) {
            openNewBagBtn.onclick = () => openNewBag(bean.id);
            openNewBagBtn.classList.toggle('hidden', !isMine);
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

        if (openBagActionBtn) {
            openBagActionBtn.onclick = () => openNewBag(bean.id);
            openBagActionBtn.classList.toggle('hidden', !isMine);
        }

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
    };

    const openBeanCardWithOrder = (beanId, order = [], ev = null) => {
        const cleanedOrder = Array.from(new Set((order || []).filter(Boolean)));
        navigationOrderOverride = cleanedOrder.length ? cleanedOrder : null;
        openBeanCard(beanId, ev, true);
    };

    const navigateBeanCard = (direction) => {
        const order = getBeanCardOrder();
        const idx = order.indexOf(getCurrentBeanCardId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        openBeanCard(order[nextIdx], null, true);
    };

    const closeBeanCard = (e) => {
        if (!e || e.target.id === 'beanCardOverlay') {
            navigationOrderOverride = null;
            document.getElementById('beanCardOverlay').classList.add('hidden');
        }
    };

    const closeBeanCardMenu = () => {
        const menu = document.getElementById('beanCardActionMenu');
        if (menu) menu.classList.add('hidden');
    };

    return {
        updateBeanCardActionButtons,
        updateBeanCardNav,
        openBeanCard,
        openBeanCardWithOrder,
        navigateBeanCard,
        closeBeanCard,
        closeBeanCardMenu
    };
};
