export const createBrewsVmModule = () => {
    const formatOutWeight = (weight, ratio) => {
        if (!weight || !ratio) return '-';
        const outWeight = (weight * ratio).toFixed(1);
        return outWeight.endsWith('.0') ? String(parseInt(outWeight, 10)) : outWeight;
    };

    const formatOutWeightWithUnit = (weight, ratio) => {
        const value = formatOutWeight(weight, ratio);
        return value === '-' ? '-' : `${value}g`;
    };

    const formatCardDateHtml = (value) => {
        if (!value) return '-';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '-';
        const timeText = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        const dd = String(date.getDate()).padStart(2, '0');
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const yy = String(date.getFullYear()).slice(-2);
        const dateText = `${dd}-${mm}-${yy}`;
        return `<span class="block text-[11px]">${timeText}</span><span class="block">${dateText}</span>`;
    };

    const formatOpenedDate = (value) => {
        if (!value) return '';
        const dateObj = typeof value.toDate === 'function' ? value.toDate() : new Date(value);
        if (Number.isNaN(dateObj.getTime())) return '';
        const dd = String(dateObj.getDate()).padStart(2, '0');
        const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        const yy = String(dateObj.getFullYear()).slice(-2);
        return `${dd}-${mm}-${yy}`;
    };

    const buildBeanLabel = (bean, beanDisplay) => {
        if (!bean) return 'Unknown bean';
        const farmer = beanDisplay?.farmer && beanDisplay.farmer !== '-' ? beanDisplay.farmer : '';
        const roaster = beanDisplay?.roaster && beanDisplay.roaster !== '-' ? beanDisplay.roaster : '';
        const baseLabel = farmer && roaster ? `${farmer} - ${roaster}` : farmer || roaster || 'Unknown bean';
        const opened = formatOpenedDate(bean.openedDate);
        return opened ? `${baseLabel} (${opened})` : baseLabel;
    };

    const buildCardGraphData = (brew) => {
        const hasGraph = !!(
            (brew.scaleCapture && brew.scaleCapture.samples && brew.scaleCapture.samples.length) ||
            (brew.scaleFlowCapture && brew.scaleFlowCapture.samples && brew.scaleFlowCapture.samples.length) ||
            (brew.scaleRawCapture && brew.scaleRawCapture.samples && brew.scaleRawCapture.samples.length) ||
            (brew.scale2Capture && brew.scale2Capture.samples && brew.scale2Capture.samples.length)
        );
        if (!hasGraph) return { hasGraph: false, graphData: null };
        return {
            hasGraph: true,
            graphData: {
                capture: brew.scaleCapture || { startAt: null, samples: [] },
                flowCapture: brew.scaleFlowCapture || { startAt: (brew.scaleCapture && brew.scaleCapture.startAt) || null, samples: [] },
                rawCapture: brew.scaleRawCapture || { startAt: (brew.scaleCapture && brew.scaleCapture.startAt) || null, samples: [] },
                scale2Capture: brew.scale2Capture || null,
                scale2FlowCapture: brew.scale2FlowCapture || null,
                firstDrip: Number.isFinite(Number(brew.firstDrip)) ? Number(brew.firstDrip) : null,
                elapsedSeconds: Number.isFinite(Number(brew.time)) ? Number(brew.time) : null,
                recipeSteps: Array.isArray(brew.recipeSteps) ? brew.recipeSteps : []
            }
        };
    };

    const buildCardDisplayViewModel = ({ brew, coffeeType }) => {
        const titlePrimary =
            coffeeType.farmer !== '-' ? coffeeType.farmer : (coffeeType.roaster !== '-' ? coffeeType.roaster : 'Unknown Blend');
        const titleSecondary = coffeeType.roaster !== '-' ? coffeeType.roaster : 'Unknown Roaster';
        const weightText = brew.weight ? `${brew.weight}g` : '-';
        const ratioText = brew.ratio ? `1:${brew.ratio}` : '-';
        const grinderTitle = brew.grinder || 'Grind';
        const grinderValue = brew.grind || '-';
        const notesText = brew.notes ? `"${brew.notes}"` : '';
        const improveText = brew.improve ? `"${brew.improve}"` : '';
        return {
            titlePrimary,
            titleSecondary,
            origin: coffeeType.origin,
            processing: coffeeType.processing,
            roastType: coffeeType.roastType,
            method: brew.method || '-',
            drink: brew.drink || '-',
            weightText,
            ratioText,
            outText: formatOutWeightWithUnit(brew.weight, brew.ratio),
            grinderTitle,
            grinderValue,
            notesText,
            hasNotes: !!brew.notes,
            improveText,
            hasImprove: !!brew.improve,
            dateHtml: formatCardDateHtml(brew.createdAt)
        };
    };

    const buildTableRowDisplayModel = ({ brew, typeDisplay }) => {
        const outWeight = formatOutWeight(brew.weight, brew.ratio);
        const displayDate = brew.createdAt ? new Date(brew.createdAt).toLocaleDateString() : '-';
        const displayTime = brew.createdAt
            ? new Date(brew.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
            : '-';
        const recipeColHtml =
            `<div class="whitespace-nowrap text-xs">` +
            `<span class="font-semibold text-coffee-700 dark:text-[#a8a29e]">${brew.weight || '-'}g</span>` +
            `<span class="text-coffee-300 dark:text-[#57534e] mx-0.5">•</span>` +
            `<span class="font-bold text-coffee-900 dark:text-white">${outWeight === '-' ? '-' : `${outWeight}g`}</span>` +
            `<span class="text-coffee-400 dark:text-[#78716c] ml-0.5">(1:${brew.ratio || '-'})</span>` +
            `</div>`;
        return {
            displayRoaster: typeDisplay.roaster,
            displayOrigin: typeDisplay.origin,
            displayDate,
            displayTime,
            recipeColHtml
        };
    };

    const buildTableRowHtml = ({
        brew,
        typeDisplay,
        rowDisplay,
        columnPreferences,
        timeText,
        tempBadgeHtml,
        ratingHtml,
        actionsHtml
    }) => {
        let rowHtml = '';
        if (columnPreferences.farmer !== false) rowHtml += `<td class="px-3 py-1 text-sm">${typeDisplay.farmer}</td>`;
        if (columnPreferences.roaster !== false) rowHtml += `<td class="px-3 py-1 font-semibold text-coffee-900 dark:text-[#e7e5e4]">${rowDisplay.displayRoaster}</td>`;
        if (columnPreferences.origin !== false) rowHtml += `<td class="px-3 py-1 text-sm">${rowDisplay.displayOrigin}</td>`;
        if (columnPreferences.variety !== false) rowHtml += `<td class="px-3 py-1 text-sm">${typeDisplay.variety}</td>`;
        if (columnPreferences.processing !== false) rowHtml += `<td class="px-3 py-1 text-sm">${typeDisplay.processing}</td>`;
        if (columnPreferences.decaf !== false) {
            const decafIcon = typeDisplay.decaf
                ? '<i class="fa-solid fa-moon text-[11px] text-coffee-500 dark:text-[#a8a29e]" title="Decaf"></i>'
                : '';
            rowHtml += `<td class="px-3 py-1 text-center">${decafIcon}</td>`;
        }
        if (columnPreferences.roastType !== false) rowHtml += `<td class="px-3 py-1 text-sm">${typeDisplay.roastType}</td>`;
        if (columnPreferences.method !== false) rowHtml += `<td class="px-3 py-1 text-sm">${brew.method || '-'}</td>`;
        if (columnPreferences.grinder !== false) rowHtml += `<td class="px-3 py-1 text-sm">${brew.grinder || '-'}</td>`;
        if (columnPreferences.grind !== false) rowHtml += `<td class="px-3 py-1 font-mono text-coffee-700 dark:text-[#d6ccc2]">${brew.grind || '-'}</td>`;
        if (columnPreferences.recipe !== false) rowHtml += `<td class="px-3 py-1">${rowDisplay.recipeColHtml}</td>`;
        if (columnPreferences.time !== false) rowHtml += `<td class="px-3 py-1 text-right">${timeText}</td>`;
        if (columnPreferences.temp !== false) rowHtml += `<td class="px-3 py-1 text-center">${tempBadgeHtml}</td>`;
        if (columnPreferences.drink !== false) rowHtml += `<td class="px-3 py-1 text-sm font-medium">${brew.drink || '-'}</td>`;
        if (columnPreferences.notes !== false) rowHtml += `<td class="px-3 py-1 text-sm max-w-xs truncate" title="${brew.notes}">${brew.notes || '-'}</td>`;
        if (columnPreferences.improve !== false) rowHtml += `<td class="px-3 py-1 text-sm italic text-red-400 dark:text-red-400/80 max-w-xs truncate" title="${brew.improve || ''}">${brew.improve || '-'}</td>`;
        if (columnPreferences.rating !== false) rowHtml += `<td class="px-3 py-1 whitespace-nowrap">${ratingHtml}</td>`;
        if (columnPreferences.date !== false) {
            rowHtml += `<td class="px-3 py-1 text-xs font-mono text-coffee-500"><div class="leading-tight"><div class="text-[11px]">${rowDisplay.displayTime}</div><div>${rowDisplay.displayDate}</div></div></td>`;
        }
        rowHtml += `<td class="px-3 py-1 text-center" data-action-click="event.stopPropagation()">${actionsHtml}</td>`;
        return rowHtml;
    };

    return {
        buildBeanLabel,
        buildCardDisplayViewModel,
        buildCardGraphData,
        buildTableRowDisplayModel,
        buildTableRowHtml,
        formatCardDateHtml,
        formatOpenedDate,
        formatOutWeight,
        formatOutWeightWithUnit
    };
};
