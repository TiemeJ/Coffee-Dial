export const createPinViewModule = ({ getBeanCalculatedStock, getCoffeeTypeDisplay }) => {
    const isPinnedDraggable = ({ currentView, currentSort, activeFilters }) =>
        currentView === 'mine' &&
        currentSort?.key === null &&
        !activeFilters?.method &&
        !Object.values(activeFilters || {}).some((v) => v !== null);

    const getTileBadge = (text, kind) => {
        if (!text) {
            return '<span class="min-w-[64px] inline-flex items-center justify-center text-xs font-medium px-2.5 py-0.5 rounded-full border bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 truncate">-</span>';
        }
        const maps = {
            method: {
                Espresso: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-200',
                V60: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/40 dark:text-blue-200',
                'Hario Switch': 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900/40 dark:text-indigo-200',
                'Clever Dripper': 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/40 dark:text-teal-200',
                Aeropress: 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/40 dark:text-purple-200',
                'OXO Rapid Brewer': 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/40 dark:text-pink-200',
                'French Press': 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/40 dark:text-green-200',
                Chemex: 'bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-200',
                Other: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200'
            },
            drink: {
                Espresso: 'bg-amber-50 text-amber-800 border-amber-100 dark:bg-amber-900/30 dark:text-amber-200',
                Americano: 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-900/30 dark:text-slate-200',
                Cappuccino: 'bg-pink-50 text-pink-800 border-pink-100 dark:bg-pink-900/30 dark:text-pink-200',
                'Flat White': 'bg-rose-50 text-rose-800 border-rose-100 dark:bg-rose-900/30 dark:text-rose-200',
                'Latte Macchiato': 'bg-yellow-50 text-yellow-800 border-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-200',
                'Filter Coffee': 'bg-blue-50 text-blue-800 border-blue-100 dark:bg-blue-900/30 dark:text-blue-200',
                Macchiato: 'bg-purple-50 text-purple-800 border-purple-100 dark:bg-purple-900/30 dark:text-purple-200',
                Other: 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200'
            }
        };
        const map = maps[kind]?.[text] || 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-200';
        return `<span class="min-w-[64px] inline-flex items-center justify-center ${map} text-xs font-medium px-2.5 py-0.5 rounded border pointer-events-none select-none truncate">${text}</span>`;
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
        if (!bean || !bean.stock) return { stockOverlay: '', dragIconClass: '', menuBtnClass: '', decafIconSrc: 'img/decaf_dark.png' };
        const initialStock = parseFloat(bean.stock);
        const currentStockRaw = getBeanCalculatedStock(bean);
        const currentStock = Math.max(0, parseFloat(currentStockRaw));
        const stockPercentage = isNaN(initialStock) || initialStock <= 0 || isNaN(currentStock)
            ? 100
            : Math.min(100, Math.max(0, (currentStock / initialStock) * 100));

        let stockOverlay = '';
        let dragIconClass = 'text-coffee-300 dark:text-[#57534e] hover:text-coffee-600 dark:hover:text-[#a8a29e]';
        let menuBtnClass = 'text-coffee-300 hover:text-coffee-800 dark:text-[#57534e] dark:hover:text-[#a8a29e]';
        let decafIconSrc = 'img/decaf_dark.png';

        if (stockPercentage < 100) {
            const fullHeight = stockPercentage;
            const waveSvg = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 20' preserveAspectRatio='none'%3E%3Cpath d='M0 20 L0 10 Q 25 0 50 10 T 100 10 L 100 20 Z' fill='%2357534e'/%3E%3C/svg%3E";
            const colors = ['text-amber-700', 'text-blue-500', 'text-green-600', 'text-purple-500'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            const boatDelay = Math.random() * 18;
            const boatElement = `<div class="absolute top-1/2 boat-right pointer-events-none z-10" style="animation-delay: -${boatDelay}s;"><i class="fa-solid fa-mug-hot ${randomColor} text-lg drop-shadow-lg"></i></div>`;
            stockOverlay = `<div class="absolute bottom-0 left-0 w-full z-0 pointer-events-none hidden dark:flex flex-col justify-start transition-all duration-500" style="height: ${fullHeight}%;"><div class="w-full h-3 bg-repeat-x wave-animate relative" style="background-image: url(&quot;${waveSvg}&quot;); background-size: 50% 100%;">${boatElement}</div><div class="w-full flex-1 bg-[#57534e]"></div></div>`;
            if (fullHeight > 25) {
                dragIconClass = 'text-stone-400 drop-shadow-md hover:text-stone-300';
                menuBtnClass = 'text-stone-400 drop-shadow-md hover:text-stone-300';
            }
            if (fullHeight > 30) decafIconSrc = 'img/decaf_light.png';
        }
        return { stockOverlay, dragIconClass, menuBtnClass, decafIconSrc };
    };

    const renderBrewTile = ({ brew, container, beans, currentView, currentSort, activeFilters, pinnedBrewsPreferences, openCoffeeCard }) => {
        const tile = document.createElement('div');
        tile.className = 'w-full h-full bg-white dark:bg-[#292524] p-3 rounded-lg shadow-sm border border-coffee-200 dark:border-[#44403c] relative group select-none cursor-pointer hover:shadow-md transition-all';
        tile.setAttribute('data-id', brew.id);
        tile.ondblclick = (ev) => openCoffeeCard(brew.id, ev);

        const linkedBean = resolveLinkedBean({ brew, beans });
        const { stockOverlay, dragIconClass, menuBtnClass, decafIconSrc } = getStockOverlay({ bean: linkedBean });

        const typeDisplay = getCoffeeTypeDisplay(brew);
        const roaster = typeDisplay.roaster || brew.name || 'Unknown Roaster';
        const farmer = typeDisplay.farmer || '-';
        const swapTitle = !!pinnedBrewsPreferences.swapRoasterFarmer;
        const titleText = swapTitle ? (farmer && farmer !== '-' ? farmer : roaster) : roaster;
        const subtitleText = swapTitle ? roaster : farmer;

        const isDecaf = [typeDisplay.roaster, typeDisplay.farmer, typeDisplay.origin, typeDisplay.variety, typeDisplay.processing, typeDisplay.roastType, brew.notes, brew.name]
            .some((field) => field && field.toLowerCase().includes('decaf'));
        const decafIcon = isDecaf ? `<img src="${decafIconSrc}" alt="Decaf" class="inline-block w-6 h-6 ml-1" title="Decaffeinated">` : '';

        const isDraggable = currentView === 'mine' && currentSort.key === null && !activeFilters.method && !Object.values(activeFilters).some((v) => v !== null);
        const dragIcon = isDraggable ? `<div class="absolute top-1 right-1 ${dragIconClass} drag-handle p-2 z-20 transition-colors duration-200"><i class="fa-solid fa-grip-vertical text-base"></i></div>` : '';
        const menuId = `tile-menu-${brew.id}`;
        const menuBtn = currentView === 'mine' ? `<button data-action-click="toggleActionMenu('${menuId}', event)" class="absolute bottom-1 right-1 p-2 ${menuBtnClass} transition-colors z-20 duration-200"><i class="fa-solid fa-ellipsis-vertical text-base"></i></button>` : '';

        let menu = '';
        if (currentView === 'mine') {
            menu = `<div id="${menuId}" class="action-menu hidden absolute right-2 bottom-8 w-48 bg-white dark:bg-[#292524] rounded-lg shadow-xl border border-coffee-200 dark:border-[#57534e] overflow-hidden" style="z-index: 9999;"><button data-action-click="openCoffeeCardQuickEdit('${brew.id}', null)" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-wand-magic-sparkles text-blue-500 w-4"></i> Quick edit</button><button data-action-click="editCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-pencil text-blue-500 w-4"></i> Edit</button><button data-action-click="fastRepeatCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-bolt text-amber-500 w-4"></i> Fast repeat</button><button data-action-click="duplicateCoffee('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-regular fa-copy text-green-500 w-4"></i> Repeat</button><button data-action-click="toggleActive('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-thumbtack text-green-600 w-4"></i> Unpin</button><button data-action-click="openUploadModal('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-camera text-purple-500 w-4"></i> Upload photo</button><button data-action-click="showBeanForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-seedling text-green-600 w-4"></i> Go to bean</button><button data-action-click="showCoffeeForBrew('${brew.id}');" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-layer-group text-coffee-600 w-4"></i> Go to coffee</button><button data-action-click="shareCoffeeCard('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-coffee-50 dark:hover:bg-[#34302e] text-coffee-700 dark:text-[#d6ccc2] flex items-center gap-3"><i class="fa-solid fa-share-nodes text-purple-500 w-4"></i> Share card</button><hr class="border-coffee-100 dark:border-[#44403c]"><button data-action-click="deleteCoffee('${brew.id}', event);" class="w-full text-left px-4 py-2 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-3"><i class="fa-solid fa-trash w-4"></i> Delete</button></div>`;
        }

        const backgroundLayer = `<div class="absolute inset-0 rounded-lg overflow-hidden z-0">${stockOverlay}</div>`;
        tile.innerHTML = `${backgroundLayer}${dragIcon}<div class="pr-4 relative z-10"><h3 class="font-bold text-coffee-900 dark:text-white truncate text-sm leading-tight" title="${titleText}">${titleText}</h3><p class="text-[10px] text-coffee-500 dark:text-[#a8a29e] truncate font-medium mb-2">${subtitleText}</p><div class="flex flex-col gap-1 items-start">${getTileBadge(brew.method || '-', 'method')}<div class="flex gap-1 items-center">${getTileBadge(brew.drink || '-', 'drink')}${decafIcon}</div></div></div>${menuBtn}${menu}`;
        container.appendChild(tile);
    };

    const renderPinnedTilesView = ({
        coffees,
        beans,
        pinnedBrewsPreferences,
        currentView,
        currentSort,
        activeFilters,
        expandedBeans,
        onToggleBeanExpansion,
        openCoffeeCard
    }) => {
        const pinnedSection = document.getElementById('pinnedSection');
        const pinnedGrid = document.getElementById('pinnedGrid');
        if (!pinnedSection || !pinnedGrid) return { hasTiles: false, beanKeys: [] };

        pinnedGrid.innerHTML = '';
        const allActiveBrews = coffees.filter((c) => c.isActive);
        if (!allActiveBrews.length) {
            pinnedSection.classList.add('hidden');
            return { hasTiles: false, beanKeys: [] };
        }

        const organizeByBeans = !!pinnedBrewsPreferences.organizeByBeans;
        const beanKeys = [];

        if (!organizeByBeans) {
            allActiveBrews.sort((a, b) => (a.customOrder || 0) - (b.customOrder || 0));
            allActiveBrews.forEach((brew) =>
                renderBrewTile({ brew, container: pinnedGrid, beans, currentView, currentSort, activeFilters, pinnedBrewsPreferences, openCoffeeCard })
            );
            pinnedSection.classList.remove('hidden');
            return { hasTiles: true, beanKeys: [] };
        }

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
        sortedGroups.forEach(([beanKey]) => beanKeys.push(beanKey));

        sortedGroups.forEach(([beanKey, group]) => {
            const isExpanded = expandedBeans.has(beanKey);
            const { bean } = group;
            const brews = [...group.brews].sort((a, b) => (a.customOrder || 0) - (b.customOrder || 0));

            if (bean && brews.length > 1) {
                if (!isExpanded) {
                    const tile = document.createElement('div');
                    tile.className = 'w-full h-full bg-white dark:bg-[#292524] p-3 rounded-lg shadow-sm border border-coffee-200 dark:border-[#44403c] relative group select-none cursor-pointer hover:shadow-md transition-all';
                    tile.setAttribute('data-bean-key', beanKey);
                    tile.onclick = () => onToggleBeanExpansion(beanKey);
                    const { stockOverlay, dragIconClass } = getStockOverlay({ bean });
                    const typeDisplay = {
                        roaster: bean?.roaster || 'Unknown',
                        farmer: bean?.farmer || '-',
                        origin: bean?.origin || '-',
                        processing: bean?.processing || '-',
                        variety: bean?.variety || '-',
                        roastType: bean?.roastType || '-'
                    };
                    const swapTitle = !!pinnedBrewsPreferences.swapRoasterFarmer;
                    const titleText = swapTitle ? (typeDisplay.farmer !== '-' ? typeDisplay.farmer : typeDisplay.roaster) : typeDisplay.roaster;
                    const subtitleText = swapTitle ? typeDisplay.roaster : typeDisplay.farmer;
                    const badge = `<span class="min-w-[64px] inline-flex items-center justify-center text-xs font-medium px-2.5 py-0.5 rounded border bg-coffee-100 dark:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] border-coffee-200 dark:border-[#57534e]"><i class="fa-solid fa-layer-group mr-1"></i>${brews.length} brews</span>`;
                    const placeholderBadge = '<span class="w-6 h-6"></span>';
                    const plusBtn = '<div class="absolute -bottom-2 -right-2 w-5 h-5 bg-coffee-200 dark:bg-[#292524] border border-coffee-300/60 dark:border-[#57534e]/80 rounded-full flex items-center justify-center cursor-pointer hover:bg-coffee-300 dark:hover:bg-[#34302e] transition-all shadow-sm z-30"><i class="fa-solid fa-plus text-[10px] text-coffee-600 dark:text-[#a8a29e]"></i></div>';
                    const dragIcon = isPinnedDraggable({ currentView, currentSort, activeFilters })
                        ? `<div class="absolute top-1 right-1 ${dragIconClass || 'text-coffee-300 dark:text-[#57534e] hover:text-coffee-600 dark:hover:text-[#a8a29e]'} drag-handle p-2 z-20 transition-colors duration-200"><i class="fa-solid fa-grip-vertical text-base"></i></div>`
                        : '';
                    const backgroundLayer = `<div class="absolute inset-0 rounded-lg overflow-hidden z-0">${stockOverlay}</div>`;
                    tile.innerHTML = `${backgroundLayer}${dragIcon}<div class="pr-4 relative z-10"><h3 class="font-bold text-coffee-900 dark:text-white truncate text-sm leading-tight" title="${titleText}">${titleText}</h3><p class="text-[10px] text-coffee-500 dark:text-[#a8a29e] truncate font-medium mb-2">${subtitleText}</p><div class="flex flex-col gap-1 items-start">${badge}<div class="flex gap-1 items-center">${placeholderBadge}</div></div></div>${plusBtn}`;
                    pinnedGrid.appendChild(tile);
                } else {
                    brews.forEach((brew, idx) => {
                        const wrapper = document.createElement('div');
                        wrapper.className = 'relative h-full';
                        wrapper.setAttribute('data-id', brew.id);
                        const bg = document.createElement('div');
                        bg.className = 'absolute inset-0 bg-coffee-100/30 dark:bg-[#1c1917]/40 rounded-lg -z-10';
                        wrapper.appendChild(bg);
                        renderBrewTile({ brew, container: wrapper, beans, currentView, currentSort, activeFilters, pinnedBrewsPreferences, openCoffeeCard });
                        if (idx === brews.length - 1) {
                            const collapseBtn = document.createElement('div');
                            collapseBtn.className = 'absolute -bottom-2 -right-2 w-5 h-5 bg-coffee-200 dark:bg-[#292524] border border-coffee-300/60 dark:border-[#57534e]/80 rounded-full flex items-center justify-center cursor-pointer hover:bg-coffee-300 dark:hover:bg-[#34302e] transition-all shadow-sm z-30';
                            collapseBtn.onclick = (e) => {
                                e.stopPropagation();
                                onToggleBeanExpansion(beanKey);
                            };
                            collapseBtn.innerHTML = '<i class="fa-solid fa-minus text-[10px] text-coffee-600 dark:text-[#a8a29e]"></i>';
                            wrapper.appendChild(collapseBtn);
                        }
                        pinnedGrid.appendChild(wrapper);
                    });
                }
            } else {
                const brew = brews[0];
                if (!isExpanded) {
                    const tile = document.createElement('div');
                    tile.className = 'w-full h-full bg-white dark:bg-[#292524] p-3 rounded-lg shadow-sm border border-coffee-200 dark:border-[#44403c] relative group select-none cursor-pointer hover:shadow-md transition-all';
                    tile.setAttribute('data-bean-key', beanKey);
                    tile.onclick = () => onToggleBeanExpansion(beanKey);
                    const linkedBean = bean || resolveLinkedBean({ brew, beans });
                    const { stockOverlay, dragIconClass, decafIconSrc } = getStockOverlay({ bean: linkedBean });
                    const typeDisplay = getCoffeeTypeDisplay(brew);
                    const roaster = typeDisplay.roaster || brew.name || 'Unknown Roaster';
                    const farmer = typeDisplay.farmer || '-';
                    const swapTitle = !!pinnedBrewsPreferences.swapRoasterFarmer;
                    const titleText = swapTitle ? (farmer && farmer !== '-' ? farmer : roaster) : roaster;
                    const subtitleText = swapTitle ? roaster : farmer;
                    const isDecaf = [typeDisplay.roaster, typeDisplay.farmer, typeDisplay.origin, typeDisplay.variety, typeDisplay.processing, typeDisplay.roastType, brew.notes, brew.name]
                        .some((field) => field && field.toLowerCase().includes('decaf'));
                    const decafIcon = isDecaf ? `<img src="${decafIconSrc || 'img/decaf_dark.png'}" alt="Decaf" class="inline-block w-6 h-6 ml-1" title="Decaffeinated">` : '';
                    const placeholderBadge = '<span class="w-6 h-6"></span>';
                    const plusBtn = '<div class="absolute -bottom-2 -right-2 w-5 h-5 bg-coffee-200 dark:bg-[#292524] border border-coffee-300/60 dark:border-[#57534e]/80 rounded-full flex items-center justify-center cursor-pointer hover:bg-coffee-300 dark:hover:bg-[#34302e] transition-all shadow-sm z-30"><i class="fa-solid fa-plus text-[10px] text-coffee-600 dark:text-[#a8a29e]"></i></div>';
                    const dragIcon = isPinnedDraggable({ currentView, currentSort, activeFilters })
                        ? `<div class="absolute top-1 right-1 ${dragIconClass || 'text-coffee-300 dark:text-[#57534e] hover:text-coffee-600 dark:hover:text-[#a8a29e]'} drag-handle p-2 z-20 transition-colors duration-200"><i class="fa-solid fa-grip-vertical text-base"></i></div>`
                        : '';
                    const backgroundLayer = `<div class="absolute inset-0 rounded-lg overflow-hidden z-0">${stockOverlay}</div>`;
                    tile.innerHTML = `${backgroundLayer}${dragIcon}<div class="pr-4 relative z-10"><h3 class="font-bold text-coffee-900 dark:text-white truncate text-sm leading-tight" title="${titleText}">${titleText}</h3><p class="text-[10px] text-coffee-500 dark:text-[#a8a29e] truncate font-medium mb-2">${subtitleText}</p><div class="flex flex-col gap-1 items-start"><span class="min-w-[64px] inline-flex items-center justify-center text-xs font-medium px-2.5 py-0.5 rounded border bg-coffee-100 dark:bg-[#44403c] text-coffee-700 dark:text-[#d6ccc2] border-coffee-200 dark:border-[#57534e]"><i class="fa-solid fa-layer-group mr-1"></i>1 brew</span><div class="flex gap-1 items-center">${decafIcon || placeholderBadge}</div></div></div>${plusBtn}`;
                    pinnedGrid.appendChild(tile);
                } else {
                    const wrapper = document.createElement('div');
                    wrapper.className = 'relative h-full';
                    wrapper.setAttribute('data-id', brew.id);
                    const bg = document.createElement('div');
                    bg.className = 'absolute inset-0 bg-coffee-100/30 dark:bg-[#1c1917]/40 rounded-lg -z-10';
                    wrapper.appendChild(bg);
                    renderBrewTile({ brew, container: wrapper, beans, currentView, currentSort, activeFilters, pinnedBrewsPreferences, openCoffeeCard });
                    const collapseBtn = document.createElement('div');
                    collapseBtn.className = 'absolute -bottom-2 -right-2 w-5 h-5 bg-coffee-200 dark:bg-[#292524] border border-coffee-300/60 dark:border-[#57534e]/80 rounded-full flex items-center justify-center cursor-pointer hover:bg-coffee-300 dark:hover:bg-[#34302e] transition-all shadow-sm z-30';
                    collapseBtn.onclick = (e) => {
                        e.stopPropagation();
                        onToggleBeanExpansion(beanKey);
                    };
                    collapseBtn.innerHTML = '<i class="fa-solid fa-minus text-[10px] text-coffee-600 dark:text-[#a8a29e]"></i>';
                    wrapper.appendChild(collapseBtn);
                    pinnedGrid.appendChild(wrapper);
                }
            }
        });

        pinnedSection.classList.remove('hidden');
        return { hasTiles: true, beanKeys };
    };

    return {
        resolveLinkedBean,
        renderPinnedTilesView
    };
};
