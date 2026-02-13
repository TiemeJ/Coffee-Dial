export const createBrewPinArtModule = ({
    resolveLinkedBean,
    getCoffeeTypeForBrew,
    getBeanCalculatedStock,
    openCoffeeCard,
    openBeanCardWithOrder
}) => {
    let chooserOpenFor = null;
    const LONG_PRESS_MS = 420;

    const buildBrewLabel = (brew) => {
        const method = (brew?.method || 'Unknown method').toString().trim();
        const drink = (brew?.drink || 'Unknown drink').toString().trim();
        return `${method} (${drink})`;
    };

    const closeChooser = () => {
        chooserOpenFor = null;
        const chooser = document.getElementById('brewPinArtChooser');
        if (chooser) chooser.classList.add('hidden');
        const list = document.getElementById('brewPinArtChooserList');
        if (list) list.innerHTML = '';
    };

    const openChooser = ({ beanName, brews }) => {
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
            btn.textContent = buildBrewLabel(brew);
            btn.addEventListener('click', () => {
                closeChooser();
                openCoffeeCard(brew.id);
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

    const renderPinnedArtView = ({ coffees, beans, pinnedBrewsPreferences }) => {
        ensureChooserWiring();
        closeChooser();

        const root = document.getElementById('brewPinArtRoot');
        const grid = document.getElementById('brewPinArtGrid');
        if (!root || !grid) return { hasArt: false };

        const allActiveBrews = coffees.filter((c) => c.isActive);
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

        sortedGroups.forEach((group) => {
            const bean = group.bean;
            const previewBrew = group.brews[0] || null;
            const coffeeType = getCoffeeTypeForBrew?.(previewBrew) || null;
            const roaster = (bean?.roaster || 'Unknown coffee').trim();
            const farmer = (bean?.farmer || '-').trim();
            const swapTitle = !!pinnedBrewsPreferences?.swapRoasterFarmer;
            const titleText = swapTitle ? (farmer && farmer !== '-' ? farmer : roaster) : roaster;
            const subtitleText = swapTitle ? roaster : farmer;
            const imageUrl = coffeeType?.imageUrl || coffeeType?.imageURL || '';
            const stockPercent = getStockPercentForBean(bean);
            const isDecaf = [
                coffeeType?.roaster,
                coffeeType?.farmer,
                coffeeType?.origin,
                coffeeType?.variety,
                coffeeType?.processing,
                coffeeType?.roast,
                coffeeType?.roastType,
                bean?.roaster,
                bean?.farmer,
                bean?.origin,
                bean?.variety,
                bean?.processing,
                bean?.roastType,
                previewBrew?.notes,
                previewBrew?.name
            ].some((field) => (field || '').toString().toLowerCase().includes('decaf'));
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
            let pressTimer = null;
            let longPressHandled = false;

            if (imageUrl) {
                card.innerHTML = `
                    <img src="${imageUrl}" alt="${titleText}" class="absolute inset-0 w-full h-full object-cover" />
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
                    ${decafMoonBadge}
                    ${stockIndicator}
                    <div class="absolute bottom-0 left-0 right-0 p-3 text-white">
                        <p class="text-sm font-bold truncate">${titleText}</p>
                        <p class="text-xs opacity-90 truncate">${subtitleText}</p>
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <div class="absolute inset-0 bg-gradient-to-br from-coffee-100 via-coffee-200 to-coffee-300 dark:from-[#34302e] dark:via-[#292524] dark:to-[#1c1917]"></div>
                    ${decafMoonBadge}
                    ${stockIndicator}
                    <div class="absolute inset-0 flex flex-col items-center justify-center text-coffee-700 dark:text-[#d6ccc2] gap-2 p-3">
                        <i class="fa-solid fa-mug-hot text-2xl"></i>
                        <p class="text-sm font-bold text-center">${titleText}</p>
                        <p class="text-xs text-center opacity-80">${subtitleText}</p>
                    </div>
                `;
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
                    openBeanCardWithOrder?.(bean.id, beanOrder);
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
                const sortedBrews = [...group.brews].sort((a, b) => (a.customOrder || 0) - (b.customOrder || 0));
                if (sortedBrews.length === 1) {
                    closeChooser();
                    openCoffeeCard(sortedBrews[0].id);
                    return;
                }
                openChooser({ beanName: titleText, brews: sortedBrews });
            });

            grid.appendChild(card);
        });

        root.classList.remove('hidden');
        return { hasArt: true };
    };

    return {
        renderPinnedArtView,
        closeChooser
    };
};
