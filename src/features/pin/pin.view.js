export const createPinViewModule = ({ getBeanCalculatedStock, getCoffeeTypeDisplay }) => {
    const LONG_PRESS_MS = 420;
    let chooserOpenFor = null;

    const isPinnedDraggable = ({ currentView, currentSort, activeFilters }) =>
        currentView === 'mine' &&
        currentSort?.key === null &&
        !activeFilters?.method &&
        !Object.values(activeFilters || {}).some((v) => v !== null);

    const buildBrewLabel = (brew, includeDrink = true) => {
        const method = (brew?.method || 'Unknown method').toString().trim();
        if (!includeDrink) return method;
        const drink = (brew?.drink || 'Unknown drink').toString().trim();
        return `${method} (${drink})`;
    };

    const normalizeDisplayText = (value) => {
        const text = (value ?? '').toString().trim();
        if (!text || text === '-' || text === '—') return '';
        return text;
    };

    const closeChooser = () => {
        chooserOpenFor = null;
        const chooser = document.getElementById('brewPinArtChooser');
        if (chooser) chooser.classList.add('hidden');
        const list = document.getElementById('brewPinArtChooserList');
        if (list) list.innerHTML = '';
    };

    const openChooser = ({ beanName, brews, includeDrinkInLabel = true, openPinnedBrewCard }) => {
        const chooser = document.getElementById('brewPinArtChooser');
        const title = document.getElementById('brewPinArtChooserTitle');
        const list = document.getElementById('brewPinArtChooserList');
        if (!chooser || !title || !list) return;

        chooserOpenFor = beanName || 'coffee';
        title.textContent = `Choose brew for ${chooserOpenFor}`;
        list.innerHTML = '';

        brews.forEach((brew) => {
            const btn = document.createElement('button');
            btn.className =
                'w-full text-left px-3 py-2 rounded-lg border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#292524] text-sm text-coffee-800 dark:text-[#d6ccc2] hover:bg-coffee-100 dark:hover:bg-[#34302e] transition-colors';
            btn.textContent = buildBrewLabel(brew, includeDrinkInLabel);
            btn.addEventListener('click', () => {
                closeChooser();
                openPinnedBrewCard(brew.id);
            });
            list.appendChild(btn);
        });

        chooser.classList.remove('hidden');
    };

    const ensureChooserWiring = () => {
        const chooser = document.getElementById('brewPinArtChooser');
        const chooserCard = document.getElementById('brewPinArtChooserCard');
        const closeBtn = document.getElementById('brewPinArtChooserClose');
        if (!chooser || !chooserCard || !closeBtn) return;
        if (chooser.dataset.bound === 'true') return;

        chooser.dataset.bound = 'true';
        closeBtn.addEventListener('click', closeChooser);
        chooser.addEventListener('click', (event) => {
            if (!chooserOpenFor) return;
            if (event.target === chooser && !chooserCard.contains(event.target)) {
                closeChooser();
            }
        });
    };

    const resolveLinkedBean = ({ brew, beans }) => {
        let linkedBean = brew.beanId ? beans.find((b) => b.id === brew.beanId) : null;
        if (linkedBean) return linkedBean;
        const clean = (s) => (s || '').toLowerCase().trim();
        return (
            beans.find(
                (b) =>
                    clean(b.roaster) === clean(brew.roaster) &&
                    clean(b.farmer) === clean(brew.farmer) &&
                    clean(b.origin) === clean(brew.origin) &&
                    clean(b.processing) === clean(brew.processing) &&
                    clean(b.variety) === clean(brew.variety) &&
                    clean(b.roastType) === clean(brew.roastType)
            ) || null
        );
    };

    const getStockOverlay = ({ bean }) => {
        if (!bean || !bean.stock) return { stockOverlay: '', dragIconClass: '', menuBtnClass: '' };
        const initialStock = parseFloat(bean.stock);
        const currentStockRaw = getBeanCalculatedStock(bean);
        const currentStock = Math.max(0, parseFloat(currentStockRaw));
        const stockPercentage = isNaN(initialStock) || initialStock <= 0 || isNaN(currentStock)
            ? 100
            : Math.min(100, Math.max(0, (currentStock / initialStock) * 100));

        let stockOverlay = '';
        let dragIconClass = 'text-coffee-300 dark:text-[#57534e] hover:text-coffee-600 dark:hover:text-[#a8a29e]';
        if (stockPercentage < 100) {
            const fullHeight = stockPercentage;
            const darkCoffeeFill = '#3B2F2F';
            const waveSvg = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20 L0 10 Q 25 0 50 10 T 100 10 L 100 20 Z' fill='${encodeURIComponent(darkCoffeeFill)}'/%3E%3C/svg%3E`;
            const colors = ['text-amber-700', 'text-blue-500', 'text-green-600', 'text-purple-500'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const boatDelay = Math.random() * 18;
            const boatElement = `<div class="absolute top-1/2 boat-right pointer-events-none z-10" style="animation-delay: -${boatDelay}s;"><i class="fa-solid fa-mug-hot ${randomColor} text-lg drop-shadow-lg"></i></div>`;
            stockOverlay = `<div class="absolute bottom-0 left-0 w-full z-0 pointer-events-none hidden dark:flex flex-col justify-start transition-all duration-500" style="height: ${fullHeight}%;"><div class="w-full h-3 bg-repeat-x wave-animate relative" style="background-image: url(&quot;${waveSvg}&quot;); background-size: 50% 100%;">${boatElement}</div><div class="w-full flex-1" style="background-color: ${darkCoffeeFill};"></div></div>`;
            if (fullHeight > 25) {
                dragIconClass = 'text-stone-400 drop-shadow-md hover:text-stone-300';
            }
        }
        return { stockOverlay, dragIconClass };
    };

    const buildPinnedTileDetailsMarkup = ({
        hideDetailsInitially,
        farmerText,
        roasterText,
        decafIcon
    }) => {
        if (hideDetailsInitially) {
            return '<div class="pr-16 relative z-10" data-pin-details-stage="loading"><div class="h-3 w-20 rounded bg-coffee-200 dark:bg-[#44403c] animate-pulse"></div><div class="h-2.5 w-24 mt-2 rounded bg-coffee-200 dark:bg-[#44403c] animate-pulse"></div><div class="h-2.5 w-16 mt-2 rounded bg-coffee-200 dark:bg-[#44403c] animate-pulse"></div></div>';
        }
        return `<div class="pr-16 relative z-10"><p class="font-bold text-coffee-900 dark:text-white truncate text-sm leading-tight" title="${farmerText}">${farmerText}</p><p class="text-[10px] text-coffee-500 dark:text-[#e7e5e4] truncate font-medium">${roasterText}</p><div class="flex items-center mt-1">${decafIcon}</div></div>`;
    };

    const buildPinnedTileImageCardMarkup = ({ imageUrl, titleText, stage = 'ready' }) => {
        const baseClass =
            'absolute w-12 h-16 rounded-lg overflow-hidden border border-coffee-200 dark:border-[#57534e] bg-coffee-100 dark:bg-[#1c1917]';
        if (stage === 'loading') {
            return `<div data-pin-image-stage="loading" class="${baseClass} ai-loading-pulse" style="position:absolute; right:0.5rem; bottom:0.5rem; z-index:20;"><div class="w-full h-full bg-gradient-to-br from-coffee-200 via-coffee-100 to-coffee-200 dark:from-[#44403c] dark:via-[#34302e] dark:to-[#44403c]"></div></div>`;
        }
        if (!imageUrl) {
            return `<div data-pin-image-card="placeholder" class="${baseClass}" style="position:absolute; right:0.5rem; bottom:0.5rem; z-index:20;"><div class="w-full h-full bg-gradient-to-br from-coffee-200 via-coffee-100 to-coffee-200 dark:from-[#44403c] dark:via-[#34302e] dark:to-[#44403c]"></div><div class="absolute inset-0 flex items-center justify-center text-coffee-400 dark:text-[#78716c]"><i class="fa-regular fa-image text-xs"></i></div></div>`;
        }
        return `<div data-pin-image-card="img" class="${baseClass}" style="position:absolute; right:0.5rem; bottom:0.5rem; z-index:20;"><img data-pin-image-img src="${imageUrl}" alt="${titleText}" class="w-full h-full object-cover" loading="lazy" decoding="async"></div>`;
    };

    const wirePinnedTileImageState = (tile) => {
        if (!tile) return;
        const imgs = tile.querySelectorAll('img[data-pin-image-img]');
        imgs.forEach((img) => {
            if (img.dataset.bound === 'true') return;
            img.dataset.bound = 'true';
            const card = img.closest('[data-pin-image-card]');
            const skeleton = card?.querySelector('[data-pin-image-bg]');
            const showImage = () => {
                img.classList.remove('opacity-0');
                if (skeleton) {
                    skeleton.classList.remove('ai-loading-pulse');
                    skeleton.classList.add('hidden');
                }
            };
            const showFallback = () => {
                img.remove();
                if (skeleton) {
                    skeleton.classList.remove('ai-loading-pulse');
                    skeleton.classList.remove('hidden');
                    skeleton.innerHTML = '<div class="absolute inset-0 flex items-center justify-center text-coffee-400 dark:text-[#78716c]"><i class="fa-regular fa-image text-xs"></i></div>';
                    return;
                }
                if (card) {
                    card.setAttribute('data-pin-image-card', 'placeholder');
                    card.innerHTML = '<div class="w-full h-full bg-gradient-to-br from-coffee-200 via-coffee-100 to-coffee-200 dark:from-[#44403c] dark:via-[#34302e] dark:to-[#44403c]"></div><div class="absolute inset-0 flex items-center justify-center text-coffee-400 dark:text-[#78716c]"><i class="fa-regular fa-image text-xs"></i></div>';
                }
            };
            img.addEventListener('load', showImage, { once: true });
            img.addEventListener('error', showFallback, { once: true });
            if (img.complete) {
                if (img.naturalWidth > 0) showImage();
                else showFallback();
            }
        });
    };

    const renderPinnedTilesView = ({
        coffees,
        beans,
        pinnedBrewsPreferences,
        currentView,
        currentSort,
        activeFilters,
        openPinnedBrewCard,
        openPinnedBeanCardWithOrder,
        progressiveHydration = false,
        activeBeansOnly = false,
        suppressCoffeeDetails = false,
        suppressCoffeeImages = false
    }) => {
        ensureChooserWiring();
        closeChooser();
        const pinnedSection = document.getElementById('pinnedSection');
        const pinnedGrid = document.getElementById('pinnedGrid');
        if (!pinnedSection || !pinnedGrid) return { hasTiles: false, beanKeys: [] };

        pinnedGrid.innerHTML = '';
        const isBeanActive = (bean) => !!bean && bean.archived !== true && bean.frozen !== true;
        const allActiveBrews = coffees
            .filter((c) => c.isActive)
            .filter((brew) => {
                if (!activeBeansOnly) return true;
                const linkedBean = resolveLinkedBean({ brew, beans });
                return isBeanActive(linkedBean);
            });
        if (!allActiveBrews.length) {
            pinnedSection.classList.add('hidden');
            return { hasTiles: false, beanKeys: [] };
        }

        const hideDetailsInitially = progressiveHydration || suppressCoffeeDetails;
        const hideImagesInitially = progressiveHydration || suppressCoffeeImages;
        const hydrateDetailsInPlace = progressiveHydration && !suppressCoffeeDetails;
        const hydrateImagesInPlace = progressiveHydration && !suppressCoffeeImages;
        const progressiveDetailHydrators = [];
        const progressiveImageHydrators = [];
        const beanKeys = [];

        const beanGroups = new Map();
        allActiveBrews.forEach((brew) => {
            const linkedBean = resolveLinkedBean({ brew, beans });
            const beanKey = linkedBean ? linkedBean.id : `no-bean-${brew.id}`;
            if (!beanGroups.has(beanKey)) {
                beanGroups.set(beanKey, { bean: linkedBean, brews: [], minOrder: brew.customOrder || 0 });
            }
            const group = beanGroups.get(beanKey);
            group.brews.push(brew);
            group.minOrder = Math.min(group.minOrder, brew.customOrder || 0);
        });

        const sortedGroups = Array.from(beanGroups.entries()).sort((a, b) => a[1].minOrder - b[1].minOrder);
        const beanOrder = Array.from(new Set(sortedGroups.map(([, group]) => group.bean?.id).filter(Boolean)));
        sortedGroups.forEach(([beanKey]) => beanKeys.push(beanKey));

        sortedGroups.forEach(([beanKey, group]) => {
            const { bean } = group;
            const brews = [...group.brews].sort((a, b) => (a.customOrder || 0) - (b.customOrder || 0));
            const previewBrew = brews[0] || null;
            if (!previewBrew) return;

            const tile = document.createElement('div');
            tile.className =
                'w-full h-full bg-white dark:bg-[#292524] p-3 rounded-lg shadow-sm border border-coffee-200 dark:border-[#44403c] relative overflow-hidden group select-none cursor-pointer hover:shadow-md transition-all';
            tile.style.height = '112px';
            tile.style.minHeight = '112px';
            tile.style.maxHeight = '112px';
            tile.setAttribute('data-bean-key', beanKey);

            const linkedBean = bean || resolveLinkedBean({ brew: previewBrew, beans });
            const { stockOverlay, dragIconClass } = getStockOverlay({ bean: linkedBean });
            const typeDisplay = getCoffeeTypeDisplay(previewBrew);
            const roaster = normalizeDisplayText(typeDisplay.roaster) ||
                normalizeDisplayText(previewBrew.roaster) ||
                normalizeDisplayText(previewBrew.name) ||
                'Unknown Roaster';
            const farmer = normalizeDisplayText(typeDisplay.farmer) || normalizeDisplayText(previewBrew.farmer);
            const farmerText = farmer || roaster;
            const roasterText = roaster;
            const titleText = farmerText;
            const imageUrl = typeDisplay.imageUrl || typeDisplay.imageURL || '';
            const isDecaf = !!typeDisplay.decaf;
            const decafIcon = isDecaf ? '<i class="fa-solid fa-moon text-[11px] text-coffee-500 dark:text-[#a8a29e] ml-1" title="Decaf"></i>' : '';
            const dragIcon = isPinnedDraggable({ currentView, currentSort, activeFilters })
                ? `<div class="absolute top-1 right-1 ${dragIconClass || 'text-coffee-300 dark:text-[#57534e] hover:text-coffee-600 dark:hover:text-[#a8a29e]'} drag-handle p-2 z-20 transition-colors duration-200"><i class="fa-solid fa-grip-vertical text-base"></i></div>`
                : '';
            const detailsMarkup = buildPinnedTileDetailsMarkup({
                hideDetailsInitially,
                farmerText,
                roasterText,
                decafIcon
            });
            const imageMarkup = hideImagesInitially
                ? buildPinnedTileImageCardMarkup({ imageUrl, titleText, stage: 'loading' })
                : buildPinnedTileImageCardMarkup({ imageUrl, titleText, stage: 'ready' });
            const backgroundLayer = `<div class="absolute inset-0 rounded-lg overflow-hidden z-0">${stockOverlay}</div>`;
            tile.innerHTML = `${backgroundLayer}${dragIcon}${detailsMarkup}${imageMarkup}`;
            if (hydrateDetailsInPlace && hideDetailsInitially) {
                progressiveDetailHydrators.push(() => {
                    if (!tile.isConnected) return;
                    const detailsSkeleton = tile.querySelector('[data-pin-details-stage="loading"]');
                    if (!detailsSkeleton) return;
                    detailsSkeleton.outerHTML = buildPinnedTileDetailsMarkup({
                        hideDetailsInitially: false,
                        farmerText,
                        roasterText,
                        decafIcon
                    });
                });
            }
            if (hydrateImagesInPlace && hideImagesInitially) {
                progressiveImageHydrators.push(() => {
                    if (!tile.isConnected) return;
                    const imageSkeleton = tile.querySelector('[data-pin-image-stage="loading"]');
                    if (!imageSkeleton) return;
                    imageSkeleton.outerHTML = buildPinnedTileImageCardMarkup({ imageUrl, titleText, stage: 'ready' });
                    wirePinnedTileImageState(tile);
                });
            }

            let pressTimer = null;
            let longPressHandled = false;
            const clearPressTimer = () => {
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = null;
            };

            tile.addEventListener('pointerdown', () => {
                clearPressTimer();
                longPressHandled = false;
                pressTimer = setTimeout(() => {
                    if (!bean?.id || typeof openPinnedBeanCardWithOrder !== 'function') return;
                    longPressHandled = true;
                    closeChooser();
                    openPinnedBeanCardWithOrder(bean.id, beanOrder);
                }, LONG_PRESS_MS);
            });
            tile.addEventListener('pointerup', clearPressTimer);
            tile.addEventListener('pointerleave', clearPressTimer);
            tile.addEventListener('pointercancel', clearPressTimer);
            tile.addEventListener('contextmenu', (event) => event.preventDefault());
            tile.addEventListener('click', () => {
                clearPressTimer();
                if (longPressHandled) {
                    longPressHandled = false;
                    return;
                }
                if (brews.length === 1) {
                    closeChooser();
                    openPinnedBrewCard(previewBrew.id);
                    return;
                }
                openChooser({
                    beanName: titleText,
                    brews,
                    includeDrinkInLabel: pinnedBrewsPreferences?.pinBestPerMethodDrink !== false,
                    openPinnedBrewCard
                });
            });

            pinnedGrid.appendChild(tile);
            wirePinnedTileImageState(tile);
        });

        pinnedSection.classList.remove('hidden');
        if (hydrateDetailsInPlace || hydrateImagesInPlace) {
            setTimeout(() => {
                progressiveDetailHydrators.forEach((hydrate) => {
                    try {
                        hydrate();
                    } catch (_) {}
                });
            }, 0);
            setTimeout(() => {
                progressiveImageHydrators.forEach((hydrate) => {
                    try {
                        hydrate();
                    } catch (_) {}
                });
            }, 140);
        }
        return { hasTiles: true, beanKeys };
    };

    return {
        resolveLinkedBean,
        renderPinnedTilesView
    };
};
