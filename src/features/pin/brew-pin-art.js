export const createBrewPinArtModule = ({
    resolveLinkedBean,
    getCoffeeTypeForBrew,
    getBeanCalculatedStock,
    openPinnedBrewCard,
    openPinnedBeanCardWithOrder
}) => {
    let chooserOpenFor = null;
    const LONG_PRESS_MS = 420;

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

    const openChooser = ({ beanName, brews, includeDrinkInLabel = true }) => {
        const chooser = document.getElementById('brewPinArtChooser');
        const title = document.getElementById('brewPinArtChooserTitle');
        const list = document.getElementById('brewPinArtChooserList');
        if (!chooser || !title || !list) return;

        chooserOpenFor = beanName || 'coffee';
        title.textContent = `Choose brew for ${chooserOpenFor}`;
        list.innerHTML = '';

        brews.forEach((brew) => {
            const btn = document.createElement('button');
            btn.className = 'w-full text-left px-3 py-2 rounded-lg border border-coffee-200 dark:border-[#44403c] bg-white dark:bg-[#292524] text-sm text-coffee-800 dark:text-[#d6ccc2] hover:bg-coffee-100 dark:hover:bg-[#34302e] transition-colors';
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

    const getStockPercentForBean = (bean) => {
        if (!bean || !bean.stock) return null;
        const initial = Number.parseFloat(bean.stock);
        const currentRaw = getBeanCalculatedStock?.(bean);
        const current = Math.max(0, Number.parseFloat(currentRaw));
        if (!Number.isFinite(initial) || initial <= 0 || !Number.isFinite(current)) return null;
        return Math.min(100, Math.max(0, (current / initial) * 100));
    };

    const renderPinnedArtView = ({
        coffees,
        beans,
        pinnedBrewsPreferences,
        progressiveHydration = false,
        activeBeansOnly = false,
        suppressCoffeeDetails = false,
        suppressCoffeeImages = false
    }) => {
        ensureChooserWiring();
        closeChooser();

        const root = document.getElementById('brewPinArtRoot');
        const grid = document.getElementById('brewPinArtGrid');
        if (!root || !grid) return { hasArt: false };

        const isBeanActive = (bean) => !!bean && bean.archived !== true && bean.frozen !== true;
        const allActiveBrews = coffees
            .filter((c) => c.isActive)
            .filter((brew) => {
                if (!activeBeansOnly) return true;
                const linkedBean = resolveLinkedBean({ brew, beans });
                return isBeanActive(linkedBean);
            });
        if (!allActiveBrews.length) {
            root.classList.add('hidden');
            grid.innerHTML = '';
            return { hasArt: false };
        }

        const grouped = new Map();
        allActiveBrews.forEach((brew) => {
            const bean = resolveLinkedBean({ brew, beans });
            const key = bean?.id || `no-bean-${brew.id}`;
            if (!grouped.has(key)) {
                grouped.set(key, {
                    bean,
                    minOrder: brew.customOrder || 0,
                    brews: []
                });
            }
            const group = grouped.get(key);
            group.brews.push(brew);
            group.minOrder = Math.min(group.minOrder, brew.customOrder || 0);
        });

        const sortedGroups = [...grouped.values()].sort((a, b) => a.minOrder - b.minOrder);
        const beanOrder = Array.from(new Set(sortedGroups.map((group) => group.bean?.id).filter(Boolean)));
        grid.innerHTML = '';
        const hideDetailsInitially = progressiveHydration || suppressCoffeeDetails;
        const hideImagesInitially = progressiveHydration || suppressCoffeeImages;
        const hydrateDetailsInPlace = progressiveHydration && !suppressCoffeeDetails;
        const hydrateImagesInPlace = progressiveHydration && !suppressCoffeeImages;
        const progressiveDetailHydrators = [];
        const progressiveImageHydrators = [];

        sortedGroups.forEach((group, groupIndex) => {
            const bean = group.bean;
            const sortedBrews = [...group.brews].sort((a, b) => (a.customOrder || 0) - (b.customOrder || 0));
            const previewBrew = sortedBrews[0] || null;
            const coffeeType = getCoffeeTypeForBrew?.(previewBrew) || null;
            const roaster = normalizeDisplayText(coffeeType?.roaster) ||
                normalizeDisplayText(bean?.roaster) ||
                normalizeDisplayText(previewBrew?.roaster) ||
                normalizeDisplayText(previewBrew?.name) ||
                'Unknown coffee';
            const farmer = normalizeDisplayText(coffeeType?.farmer) ||
                normalizeDisplayText(bean?.farmer) ||
                normalizeDisplayText(previewBrew?.farmer);
            const titleText = farmer || roaster;
            const subtitleText = roaster;
            const imageUrl = coffeeType?.imageUrl || coffeeType?.imageURL || '';
            const stockPercent = getStockPercentForBean(bean);
            const isDecaf = !!coffeeType?.decaf;
            const decafMoonBadge = isDecaf
                ? '<div class="absolute top-2 right-2 z-20 w-7 h-7 rounded-full bg-black/45 text-white flex items-center justify-center border border-white/30"><i class="fa-solid fa-moon text-xs"></i></div>'
                : '';
            const stockIndicator = stockPercent === null
                ? ''
                : `
                    <div class="absolute left-2 right-2 bottom-1 z-20 pointer-events-none">
                        <div class="h-1 w-full rounded-full bg-black/20 overflow-hidden">
                            <div class="h-full bg-white/20" style="width: ${stockPercent.toFixed(0)}%;"></div>
                        </div>
                    </div>
                `;

            const card = document.createElement('button');
            card.className = 'relative w-full aspect-[3/4] rounded-xl overflow-hidden border border-coffee-200 dark:border-[#44403c] shadow-sm hover:shadow-md transition-all text-left group';
            card.type = 'button';
            card.setAttribute('data-brew-ids', sortedBrews.map((brew) => brew.id).join(','));
            let pressTimer = null;
            let longPressHandled = false;
            const isPrimaryHeroCard = groupIndex === 0;
            const fetchPriority = isPrimaryHeroCard ? 'high' : 'auto';
            const loadingMode = isPrimaryHeroCard ? 'eager' : 'lazy';
            const detailsMarkup = hideDetailsInitially
                ? '<div data-pin-art-details-stage="loading" class="absolute bottom-0 left-0 right-0 p-3 text-white"><div class="h-3 w-24 rounded bg-white/50 animate-pulse"></div><div class="h-2.5 w-20 mt-2 rounded bg-white/40 animate-pulse"></div></div>'
                : `<div class="absolute bottom-0 left-0 right-0 p-3 text-white"><p class="text-sm font-bold truncate">${titleText}</p><p class="text-xs opacity-90 truncate">${subtitleText}</p></div>`;
            const imageMarkup = imageUrl
                ? `
                    <img
                        src="${imageUrl}"
                        alt="${titleText}"
                        class="absolute inset-0 w-full h-full object-cover"
                        width="180"
                        height="240"
                        fetchpriority="${fetchPriority}"
                        loading="${loadingMode}"
                        decoding="async"
                    />
                `
                : '';
            const imageStageMarkup = hideImagesInitially
                ? '<div data-pin-art-image-stage="loading" class="absolute inset-0 bg-gradient-to-br from-coffee-300 via-coffee-200 to-coffee-300 dark:from-[#44403c] dark:via-[#34302e] dark:to-[#44403c] ai-loading-pulse"></div>'
                : imageMarkup;

            card.innerHTML = `
                <div class="absolute inset-0 bg-gradient-to-br from-coffee-200 via-coffee-300 to-coffee-400 dark:from-[#34302e] dark:via-[#292524] dark:to-[#1c1917]"></div>
                ${imageStageMarkup}
                <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                ${decafMoonBadge}
                ${stockIndicator}
                ${detailsMarkup}
            `;
            if (hydrateDetailsInPlace && hideDetailsInitially) {
                progressiveDetailHydrators.push(() => {
                    if (!card.isConnected) return;
                    const detailsSkeleton = card.querySelector('[data-pin-art-details-stage="loading"]');
                    if (!detailsSkeleton) return;
                    detailsSkeleton.outerHTML = `<div class="absolute bottom-0 left-0 right-0 p-3 text-white"><p class="text-sm font-bold truncate">${titleText}</p><p class="text-xs opacity-90 truncate">${subtitleText}</p></div>`;
                });
            }
            if (hydrateImagesInPlace && hideImagesInitially) {
                progressiveImageHydrators.push(() => {
                    if (!card.isConnected) return;
                    const imageSkeleton = card.querySelector('[data-pin-art-image-stage="loading"]');
                    if (!imageSkeleton) return;
                    if (imageMarkup) {
                        imageSkeleton.outerHTML = imageMarkup;
                    } else {
                        imageSkeleton.remove();
                    }
                });
            }

            const clearPressTimer = () => {
                if (pressTimer) clearTimeout(pressTimer);
                pressTimer = null;
            };

            card.addEventListener('pointerdown', () => {
                clearPressTimer();
                longPressHandled = false;
                pressTimer = setTimeout(() => {
                    if (!bean?.id) return;
                    longPressHandled = true;
                    closeChooser();
                    openPinnedBeanCardWithOrder?.(bean.id, beanOrder);
                }, LONG_PRESS_MS);
            });

            card.addEventListener('pointerup', clearPressTimer);
            card.addEventListener('pointerleave', clearPressTimer);
            card.addEventListener('pointercancel', clearPressTimer);
            card.addEventListener('contextmenu', (event) => event.preventDefault());

            card.addEventListener('click', () => {
                clearPressTimer();
                if (longPressHandled) {
                    longPressHandled = false;
                    return;
                }
                if (sortedBrews.length === 1) {
                    closeChooser();
                    openPinnedBrewCard(sortedBrews[0].id);
                    return;
                }
                openChooser({
                    beanName: titleText,
                    brews: sortedBrews,
                    includeDrinkInLabel: pinnedBrewsPreferences?.pinBestPerMethodDrink !== false
                });
            });

            grid.appendChild(card);
        });

        root.classList.remove('hidden');
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
        return { hasArt: true };
    };

    return {
        renderPinnedArtView,
        closeChooser
    };
};
