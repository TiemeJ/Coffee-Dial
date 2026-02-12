export const createBeansCardUiModule = ({
    getBeans,
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
    openBeanShopUrl,
    enterBeanEditMode,
    cancelBeanEditMode,
    toggleBeanFrozen,
    toggleBeanArchive
}) => {
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

    const updateBeanCardNav = () => {
        const order = getBeanTableOrder();
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

    const openBeanCard = (beanId, ev) => {
        if (ev) ev.stopPropagation();
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

        const imgEl = document.getElementById('beanCardImage');
        const placeholderEl = document.getElementById('beanCardImagePlaceholder');
        if (bean.imageURL) {
            imgEl.src = bean.imageURL;
            imgEl.classList.remove('hidden');
            placeholderEl.classList.add('hidden');
        } else {
            imgEl.src = '';
            imgEl.classList.add('hidden');
            placeholderEl.classList.remove('hidden');
        }

        const brewBtn = document.getElementById('beanCardBrewBtn');
        const openNewBagBtn = document.getElementById('beanCardOpenNewBagBtn');
        const deleteBtn = document.getElementById('beanCardDeleteBtn');
        const buyBtn = document.getElementById('beanCardBuyBtn');
        const showBrewsBtn = document.getElementById('beanCardShowBrewsBtn');
        const showCoffeeBtn = document.getElementById('beanCardShowCoffeeBtn');
        const buyActionBtn = document.getElementById('beanCardActionBuy');
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

        if (buyBtn) {
            if (bean.shopUrl) {
                buyBtn.disabled = false;
                buyBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                buyBtn.onclick = () => openBeanShopUrl(bean.id);
            } else {
                buyBtn.disabled = true;
                buyBtn.classList.add('opacity-40', 'cursor-not-allowed');
                buyBtn.onclick = null;
            }
        }

        if (buyActionBtn) {
            if (bean.shopUrl) {
                buyActionBtn.disabled = false;
                buyActionBtn.classList.remove('opacity-40', 'cursor-not-allowed');
                buyActionBtn.onclick = () => openBeanShopUrl(bean.id);
            } else {
                buyActionBtn.disabled = true;
                buyActionBtn.classList.add('opacity-40', 'cursor-not-allowed');
                buyActionBtn.onclick = null;
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

    const navigateBeanCard = (direction) => {
        const order = getBeanTableOrder();
        const idx = order.indexOf(getCurrentBeanCardId());
        const nextIdx = idx + direction;
        if (nextIdx < 0 || nextIdx >= order.length) return;
        openBeanCard(order[nextIdx]);
    };

    const closeBeanCard = (e) => {
        if (!e || e.target.id === 'beanCardOverlay') {
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
        navigateBeanCard,
        closeBeanCard,
        closeBeanCardMenu
    };
};
