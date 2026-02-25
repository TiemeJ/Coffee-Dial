const LAB_RESULT_AXIS_FIELDS = [
    { key: 'brew', label: 'Brew' },
    { key: 'date', label: 'Date' },
    { key: 'timeOfDay', label: 'Time of day' },
    { key: 'in', label: 'IN' },
    { key: 'out', label: 'Out' },
    { key: 'ratio', label: 'Ratio' },
    { key: 'time', label: 'Brew time' },
    { key: 'temp', label: 'Temp' },
    { key: 'grind', label: 'Grind size' },
    { key: 'firstDrip', label: 'First drip' },
    { key: 'maxFlow', label: 'Max flow' },
    { key: 'avgFlow', label: 'AVG flow' },
    { key: 'pourCount', label: 'Pour count' },
    { key: 'swirlCount', label: 'Swirl count' }
];
const LAB_RESULT_GRAPHS = [
    { key: 'flowGraph', label: 'Flow graph' },
    { key: 'weightGraph', label: 'Weight graph' },
    { key: 'customGraph', label: 'Custom graph' }
];
const AXIS_LABEL_BY_KEY = Object.fromEntries(LAB_RESULT_AXIS_FIELDS.map((field) => [field.key, field.label]));
const Y_AXIS_FIELD_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#9333ea', '#0891b2', '#ea580c', '#4f46e5'];
const AXIS_SKIP_REASONS = Object.freeze({
    MISSING_AXIS: 'missing-axis',
    MISSING_BREW: 'missing-brew',
    MISSING_VALUE: 'missing-value',
    NON_NUMERIC_VALUE: 'non-numeric-value',
    UNKNOWN_AXIS: 'unknown-axis'
});

const escapeAttr = (value) => String(value || '').replace(/'/g, "\\'");
const toNumber = (value) => {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return null;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
};
const toTimestamp = (value) => {
    if (!value) return null;
    if (typeof value?.toDate === 'function') {
        const dateObj = value.toDate();
        return Number.isFinite(dateObj?.getTime?.()) ? dateObj.getTime() : null;
    }
    const dateObj = new Date(value);
    return Number.isFinite(dateObj.getTime()) ? dateObj.getTime() : null;
};
const toMinutesOfDay = (value) => {
    const ts = toTimestamp(value);
    if (!Number.isFinite(ts)) return null;
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return null;
    return (date.getHours() * 60) + date.getMinutes();
};

const resolveAxisFieldValue = ({ axisKey, brew, sample, brewOrder }) => {
    if (!axisKey) return { ok: false, reason: AXIS_SKIP_REASONS.MISSING_AXIS };
    if (!brew) return { ok: false, reason: AXIS_SKIP_REASONS.MISSING_BREW };

    if (axisKey === 'date') {
        const timestamp = toTimestamp(brew.createdAt);
        return Number.isFinite(timestamp)
            ? { ok: true, value: timestamp }
            : { ok: false, reason: AXIS_SKIP_REASONS.MISSING_VALUE };
    }
    if (axisKey === 'timeOfDay') {
        const minutes = toMinutesOfDay(brew.createdAt);
        return Number.isFinite(minutes)
            ? { ok: true, value: minutes }
            : { ok: false, reason: AXIS_SKIP_REASONS.MISSING_VALUE };
    }
    if (axisKey === 'brew') {
        return Number.isFinite(brewOrder)
            ? { ok: true, value: brewOrder }
            : { ok: false, reason: AXIS_SKIP_REASONS.MISSING_VALUE };
    }

    const resolverMap = {
        in: () => toNumber(brew.weight),
        out: () => {
            const outDirect = toNumber(brew.out ?? brew.yield);
            if (Number.isFinite(outDirect)) return outDirect;
            const inValue = toNumber(brew.weight);
            const ratioValue = toNumber(brew.ratio);
            if (Number.isFinite(inValue) && Number.isFinite(ratioValue)) return inValue * ratioValue;
            return null;
        },
        ratio: () => toNumber(brew.ratio),
        time: () => (Number.isFinite(sample?.tMs) ? sample.tMs / 1000 : toNumber(brew.time)),
        temp: () => toNumber(brew.temp),
        grind: () => toNumber(brew.grind),
        firstDrip: () => toNumber(brew.firstDrip),
        maxFlow: () => toNumber(brew.maxFlow),
        avgFlow: () => toNumber(brew.avgFlow),
        pourCount: () => toNumber(brew.pourCount),
        swirlCount: () => toNumber(brew.swirlCount)
    };

    const resolver = resolverMap[axisKey];
    if (!resolver) return { ok: false, reason: AXIS_SKIP_REASONS.UNKNOWN_AXIS };
    const numeric = resolver();
    if (numeric === null) {
        const rawValue = brew[axisKey];
        return rawValue === null || typeof rawValue === 'undefined' || rawValue === ''
            ? { ok: false, reason: AXIS_SKIP_REASONS.MISSING_VALUE }
            : { ok: false, reason: AXIS_SKIP_REASONS.NON_NUMERIC_VALUE };
    }
    return { ok: true, value: numeric };
};

// Step 1 mapper: converts selected X/Y axis field keys into numeric points with explicit skip reasons.
export const createLabAxisPointMapper = ({ visibleBrews = [] } = {}) => {
    const brewOrderById = new Map(
        (Array.isArray(visibleBrews) ? visibleBrews : []).map((brew, index) => [brew?.id, index + 1])
    );

    return ({ xAxisKey, yAxisKey, brew, sample = null } = {}) => {
        const brewOrder = brewOrderById.get(brew?.id) || null;
        const x = resolveAxisFieldValue({ axisKey: xAxisKey, brew, sample, brewOrder });
        if (!x.ok) return { ok: false, reason: `x:${x.reason}` };
        const y = resolveAxisFieldValue({ axisKey: yAxisKey, brew, sample, brewOrder });
        if (!y.ok) return { ok: false, reason: `y:${y.reason}` };
        return { ok: true, point: { x: x.value, y: y.value } };
    };
};

const axisKeyUsesSample = (axisKey) => axisKey === 'time';

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};
const formatLabGraphDate = (value) => {
    if (!Number.isFinite(Number(value))) return '';
    const date = new Date(Number(value));
    if (Number.isNaN(date.getTime())) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}-${mm}--${yy}`;
};
const formatLabGraphTimeOfDay = (value) => {
    if (!Number.isFinite(Number(value))) return '';
    const totalMinutes = Math.max(0, Math.floor(Number(value)));
    const hh = String(Math.floor(totalMinutes / 60) % 24).padStart(2, '0');
    const mm = String(totalMinutes % 60).padStart(2, '0');
    return `${hh}:${mm}`;
};

export const createLabResultsModule = ({
    getFilteredCoffees,
    getCoffeeTypeDisplay,
    getChart,
    dispatchCommand
} = {}) => {
    if (typeof getFilteredCoffees !== 'function') {
        throw new Error('createLabResultsModule requires getFilteredCoffees');
    }

    let selectedXFieldKeys = new Set();
    let selectedYFieldKeys = new Set();
    let selectedGraphKeys = new Set();
    let selectedBrewIds = new Set();
    let visibleBrews = [];
    let labGraphChart = null;
    let customGraphRenderMode = 'points';
    let longPressTimer = null;
    let longPressBrewId = null;
    let suppressNextTileClickBrewId = null;
    let longPressListenersBound = false;

    const getModal = () => document.getElementById('labResultsModal');
    const LONG_PRESS_MS = 420;

    const clearLongPressTimer = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
        longPressBrewId = null;
    };

    const bindLongPressListeners = () => {
        if (longPressListenersBound) return;
        longPressListenersBound = true;
        const clear = () => clearLongPressTimer();
        window.addEventListener('pointerup', clear, true);
        window.addEventListener('pointercancel', clear, true);
        window.addEventListener('contextmenu', clear, true);
    };

    const isCustomGraphSelected = () => selectedGraphKeys.has('customGraph');
    const hasSelectedGraphs = () => selectedGraphKeys.size > 0;
    const GRAPH_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#9333ea', '#0891b2', '#ea580c', '#4f46e5'];

    const getBrewLabel = (brew, brewIndex = null) => {
        const typeDisplay = getCoffeeTypeDisplay?.(brew) || {};
        const name = typeDisplay.farmer || brew.farmer || 'Unknown';
        const dateText = formatLabGraphDate(toTimestamp(brew.createdAt)) || '-';
        const indexPrefix = Number.isFinite(brewIndex) ? `${brewIndex + 1}. ` : '';
        return `${indexPrefix}${name} (${dateText})`;
    };

    const getSelectedBrews = () => visibleBrews.filter((brew) => selectedBrewIds.has(brew.id));
    const getFirstSelectedKey = (selectedKeys) => {
        for (const key of selectedKeys || []) return key;
        return null;
    };

    const toChartPoints = (samples, valueKey) =>
        (Array.isArray(samples) ? samples : [])
            .filter((sample) => Number.isFinite(sample?.tMs) && Number.isFinite(sample?.[valueKey]))
            .map((sample) => ({ x: sample.tMs / 1000, y: sample[valueKey] }));

    // Step 2 builder: one place to assemble graph datasets + axis metadata from selection state.
    const buildCaptureDatasets = ({
        selectedBrews = [],
        selectedGraphModes = new Set(),
        selectedXAxis = new Set(),
        selectedYAxis = new Set(),
        customRenderMode = 'points'
    } = {}) => {
        const xAxisKey = getFirstSelectedKey(selectedXAxis);
        const yAxisKeys = Array.from(selectedYAxis || []);
        const yAxisKey = yAxisKeys[0] || null;
        const axisMeta = {
            xAxisKey,
            yAxisKey,
            yAxisKeys,
            xAxisLabel: AXIS_LABEL_BY_KEY[xAxisKey] || 'Time',
            yAxisLabel: AXIS_LABEL_BY_KEY[yAxisKey] || 'Value'
        };

        const hasAxisSelection = Boolean(xAxisKey && yAxisKeys.length > 0);
        const customMode = selectedGraphModes.has('customGraph');
        const useCustomAxes = customMode && hasAxisSelection;
        const pointMapper = createLabAxisPointMapper({ visibleBrews });
        const datasets = [];
        let mappedPointCount = 0;

        if (customMode) {
            if (!hasAxisSelection) {
                return {
                    datasets: [],
                    axisMeta: {
                        ...axisMeta,
                        hasAxisSelection,
                        customMode: true
                    },
                    mappedPointCount: 0
                };
            }

            yAxisKeys.forEach((yKey, index) => {
                const customPoints = selectedBrews
                    .map((brew) => pointMapper({ xAxisKey, yAxisKey: yKey, brew, sample: null }))
                    .filter((result) => result.ok)
                    .map((result) => result.point);

                if (!customPoints.length) return;
                const color = Y_AXIS_FIELD_COLORS[index % Y_AXIS_FIELD_COLORS.length];
                mappedPointCount += customPoints.length;
                datasets.push({
                    label: AXIS_LABEL_BY_KEY[yKey] || yKey,
                    data: customPoints,
                    type: customRenderMode === 'bars' ? 'bar' : 'line',
                    borderColor: color,
                    backgroundColor: color,
                    yAxisID: 'y',
                    showLine: customRenderMode === 'lines',
                    pointRadius: customRenderMode === 'points' ? 4 : 0,
                    pointHoverRadius: 5,
                    borderWidth: customRenderMode === 'bars' ? 1 : 2,
                    tension: customRenderMode === 'lines' ? 0.15 : 0,
                    barPercentage: customRenderMode === 'bars' ? 0.9 : undefined,
                    categoryPercentage: customRenderMode === 'bars' ? 0.9 : undefined,
                    maxBarThickness: customRenderMode === 'bars' ? 24 : undefined
                });
            });

            return {
                datasets,
                axisMeta: {
                    ...axisMeta,
                    hasAxisSelection,
                    customMode: true
                },
                mappedPointCount
            };
        }
        selectedBrews.forEach((brew, brewIndex) => {
            const baseColor = GRAPH_COLORS[brewIndex % GRAPH_COLORS.length];
            const brewLabel = getBrewLabel(brew, brewIndex);
            if (selectedGraphModes.has('weightGraph')) {
                let points = [];
                if (useCustomAxes) {
                    const sourceSamples = Array.isArray(brew.scaleCapture?.samples) ? brew.scaleCapture.samples : [];
                    const sampleMode = axisKeyUsesSample(xAxisKey) || axisKeyUsesSample(yAxisKey);
                    if (sampleMode) {
                        points = sourceSamples
                            .map((sample) => pointMapper({ xAxisKey, yAxisKey, brew, sample }))
                            .filter((result) => result.ok)
                            .map((result) => result.point);
                    } else {
                        const mapped = pointMapper({ xAxisKey, yAxisKey, brew, sample: null });
                        points = mapped.ok ? [mapped.point] : [];
                    }
                } else {
                    points = toChartPoints(brew.scaleCapture?.samples, 'w');
                }
                if (points.length) {
                    mappedPointCount += points.length;
                    datasets.push({
                        label: `${brewLabel} - Weight`,
                        data: points,
                        borderColor: baseColor,
                        backgroundColor: baseColor,
                        yAxisID: useCustomAxes ? 'y' : 'yWeight',
                        pointRadius: 0,
                        pointHoverRadius: 2,
                        borderWidth: 2,
                        tension: 0.15
                    });
                }
            }
            if (selectedGraphModes.has('flowGraph')) {
                let points = [];
                if (useCustomAxes) {
                    const sourceSamples = Array.isArray(brew.scaleFlowCapture?.samples) ? brew.scaleFlowCapture.samples : [];
                    const sampleMode = axisKeyUsesSample(xAxisKey) || axisKeyUsesSample(yAxisKey);
                    if (sampleMode) {
                        points = sourceSamples
                            .map((sample) => pointMapper({ xAxisKey, yAxisKey, brew, sample }))
                            .filter((result) => result.ok)
                            .map((result) => result.point);
                    } else {
                        const mapped = pointMapper({ xAxisKey, yAxisKey, brew, sample: null });
                        points = mapped.ok ? [mapped.point] : [];
                    }
                } else {
                    points = toChartPoints(brew.scaleFlowCapture?.samples, 'flow');
                }
                if (points.length) {
                    mappedPointCount += points.length;
                    datasets.push({
                        label: `${brewLabel} - Flow`,
                        data: points,
                        borderColor: baseColor,
                        backgroundColor: baseColor,
                        borderDash: [6, 3],
                        yAxisID: useCustomAxes ? 'y' : 'yFlow',
                        pointRadius: 0,
                        pointHoverRadius: 2,
                        borderWidth: 2,
                        tension: 0.15
                    });
                }
            }
        });

        return {
            datasets,
            axisMeta: {
                ...axisMeta,
                hasAxisSelection: useCustomAxes,
                customMode: false
            },
            mappedPointCount
        };
    };

    const renderCustomGraphModeControl = () => {
        const selectEl = document.getElementById('labResultsCustomRenderMode');
        const wrapEl = document.getElementById('labResultsCustomRenderModeWrap');
        if (!selectEl || !wrapEl) return;
        selectEl.value = customGraphRenderMode;
        const enabled = isCustomGraphSelected();
        selectEl.disabled = !enabled;
        wrapEl.classList.toggle('opacity-60', !enabled);
    };

    const setGraphEmptyState = (message) => {
        const emptyEl = document.getElementById('labResultsGraphEmpty');
        if (!emptyEl) return;
        emptyEl.textContent = message;
        emptyEl.classList.remove('hidden');
    };

    const hideGraphEmptyState = () => {
        const emptyEl = document.getElementById('labResultsGraphEmpty');
        if (!emptyEl) return;
        emptyEl.classList.add('hidden');
    };

    const destroyLabGraph = () => {
        if (labGraphChart) {
            labGraphChart.destroy();
            labGraphChart = null;
        }
    };

    const resolveChartCtor = async () => {
        if (typeof getChart === 'function') {
            try {
                const ctor = await getChart();
                if (typeof ctor === 'function') return ctor;
            } catch (error) {
                console.error('Chart.js lazy-load failed:', error);
            }
        }
        if (typeof window !== 'undefined' && typeof window.Chart === 'function') {
            return window.Chart;
        }
        return null;
    };

    const renderCaptureGraph = async () => {
        const canvas = document.getElementById('labResultsGraphCanvas');
        const chartCtor = await resolveChartCtor();
        if (!canvas || typeof chartCtor !== 'function') return;

        if (!selectedGraphKeys.size) {
            destroyLabGraph();
            setGraphEmptyState('Select Flow graph, Weight graph, or Custom graph');
            return;
        }

        const selectedBrews = getSelectedBrews();
        if (!selectedBrews.length) {
            destroyLabGraph();
            setGraphEmptyState('Select at least one brew');
            return;
        }

        const { datasets, axisMeta, mappedPointCount } = buildCaptureDatasets({
            selectedBrews,
            selectedGraphModes: selectedGraphKeys,
            selectedXAxis: selectedXFieldKeys,
            selectedYAxis: selectedYFieldKeys,
            customRenderMode: customGraphRenderMode
        });

        if (!datasets.length) {
            destroyLabGraph();
            if (axisMeta.hasAxisSelection && mappedPointCount === 0) {
                setGraphEmptyState('No valid points for selected X-axis and Y-axis');
            } else if (axisMeta.customMode && !axisMeta.hasAxisSelection) {
                setGraphEmptyState('Select one X-axis and at least one Y-axis for Custom graph');
            } else {
                setGraphEmptyState('No capture samples found for selected brews');
            }
            return;
        }

        hideGraphEmptyState();
        destroyLabGraph();
        const isDateOnXAxis = axisMeta.hasAxisSelection && axisMeta.xAxisKey === 'date';
        const isTimeOfDayOnXAxis = axisMeta.hasAxisSelection && axisMeta.xAxisKey === 'timeOfDay';
        const isDateOnSingleYAxis = axisMeta.hasAxisSelection && axisMeta.yAxisKeys.length === 1 && axisMeta.yAxisKeys[0] === 'date';
        const isTimeOfDayOnSingleYAxis = axisMeta.hasAxisSelection && axisMeta.yAxisKeys.length === 1 && axisMeta.yAxisKeys[0] === 'timeOfDay';
        labGraphChart = new chartCtor(canvas.getContext('2d'), {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                parsing: false,
                scales: axisMeta.hasAxisSelection
                    ? {
                          x: {
                              type: 'linear',
                              title: { display: true, text: axisMeta.xAxisLabel },
                              ticks: {
                                  maxTicksLimit: 8,
                                  callback: (value) => {
                                      if (isDateOnXAxis) return formatLabGraphDate(value);
                                      if (isTimeOfDayOnXAxis) return formatLabGraphTimeOfDay(value);
                                      return value;
                                  }
                              }
                          },
                          y: {
                              type: 'linear',
                              title: {
                                  display: true,
                                  text: axisMeta.yAxisKeys.length > 1
                                      ? `Y fields (${axisMeta.yAxisKeys.length})`
                                      : axisMeta.yAxisLabel
                              },
                              ticks: {
                                  callback: (value) => {
                                      if (isDateOnSingleYAxis) return formatLabGraphDate(value);
                                      if (isTimeOfDayOnSingleYAxis) return formatLabGraphTimeOfDay(value);
                                      return value;
                                  }
                              }
                          }
                      }
                    : {
                          x: {
                              type: 'linear',
                              title: { display: true, text: 'Time (s)' },
                              ticks: { maxTicksLimit: 8 }
                          },
                          yWeight: {
                              type: 'linear',
                              position: 'left',
                              title: { display: true, text: 'Weight (g)' },
                              display: selectedGraphKeys.has('weightGraph')
                          },
                          yFlow: {
                              type: 'linear',
                              position: 'right',
                              title: { display: true, text: 'Flow (g/s)' },
                              display: selectedGraphKeys.has('flowGraph'),
                              grid: { drawOnChartArea: false }
                          }
                      },
                plugins: {
                    legend: { display: true, labels: { boxWidth: 10, boxHeight: 10 } },
                    tooltip: {
                        mode: 'nearest',
                        intersect: false,
                        callbacks: {
                            label: (context) => {
                                const datasetLabel = context.dataset?.label || '';
                                const xVal = context.parsed?.x;
                                const yVal = context.parsed?.y;
                                const xText = isDateOnXAxis
                                    ? formatLabGraphDate(xVal)
                                    : isTimeOfDayOnXAxis
                                        ? formatLabGraphTimeOfDay(xVal)
                                        : String(xVal ?? '');
                                const yText = isDateOnSingleYAxis
                                    ? formatLabGraphDate(yVal)
                                    : isTimeOfDayOnSingleYAxis
                                        ? formatLabGraphTimeOfDay(yVal)
                                        : String(yVal ?? '');
                                return `${datasetLabel}: (${xText}, ${yText})`;
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    intersect: false
                }
            }
        });
    };

    const renderGraphSelectors = () => {
        const container = document.getElementById('labResultsGraphSelectors');
        if (!container) return;
        container.innerHTML = LAB_RESULT_GRAPHS.map((graph) => {
            const selected = selectedGraphKeys.has(graph.key);
            return `
                <label class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    selected
                        ? 'bg-coffee-100 dark:bg-[#34302e] border-coffee-300 dark:border-[#57534e] text-coffee-800 dark:text-white'
                        : 'bg-white dark:bg-[#1c1917] border-coffee-200 dark:border-[#44403c] text-coffee-600 dark:text-[#a8a29e]'
                }">
                    <input
                        type="checkbox"
                        data-action-change="toggleLabResultGraph('${graph.key}')"
                        ${selected ? 'checked' : ''}
                        class="rounded border-coffee-300 text-coffee-700 focus:ring-coffee-500"
                    />
                    <span>${graph.label}</span>
                </label>
            `;
        }).join('');
    };

    const renderAxisSelectors = (containerId, selectedKeys, actionName) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const disabled = !isCustomGraphSelected();
        const isXAxis = containerId === 'labResultsXAxisSelectors';
        container.innerHTML = LAB_RESULT_AXIS_FIELDS.map((field) => {
            const selected = selectedKeys.has(field.key);
            return `
                <label class="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                    disabled
                        ? 'bg-coffee-50 dark:bg-[#201d1b] border-coffee-200 dark:border-[#44403c] text-coffee-400 dark:text-[#78716c] opacity-70 cursor-not-allowed'
                        : selected
                        ? 'bg-coffee-100 dark:bg-[#34302e] border-coffee-300 dark:border-[#57534e] text-coffee-800 dark:text-white'
                        : 'bg-white dark:bg-[#1c1917] border-coffee-200 dark:border-[#44403c] text-coffee-600 dark:text-[#a8a29e]'
                }">
                    <input
                        type="${isXAxis ? 'radio' : 'checkbox'}"
                        ${isXAxis ? 'name="labResultsXAxisField"' : ''}
                        data-action-change="${actionName}('${field.key}')"
                        ${selected ? 'checked' : ''}
                        ${disabled ? 'disabled' : ''}
                        class="rounded border-coffee-300 text-coffee-700 focus:ring-coffee-500"
                    />
                    <span>${field.label}</span>
                </label>
            `;
        }).join('');
    };

    const renderFieldSelectors = () => {
        renderAxisSelectors('labResultsXAxisSelectors', selectedXFieldKeys, 'toggleLabResultXField');
        renderAxisSelectors('labResultsYAxisSelectors', selectedYFieldKeys, 'toggleLabResultYField');
    };

    const renderBrewTiles = () => {
        const container = document.getElementById('labResultsBrewTiles');
        const countEl = document.getElementById('labResultsBrewCount');
        if (!container || !countEl) return;

        countEl.textContent = `${selectedBrewIds.size}/${visibleBrews.length} selected`;

        if (!visibleBrews.length) {
            container.innerHTML = '<div class="text-xs text-coffee-500 dark:text-[#78716c] italic">No brews found with current table filters.</div>';
            return;
        }

        container.innerHTML = visibleBrews.map((brew) => {
            const brewIndex = visibleBrews.findIndex((item) => item.id === brew.id) + 1;
            const selected = selectedBrewIds.has(brew.id);
            const typeDisplay = getCoffeeTypeDisplay?.(brew) || {};
            const title = typeDisplay.farmer || brew.farmer || 'Unknown';
            const subtitle = typeDisplay.roaster || brew.roaster || '-';
            const meta = `${brew.method || '-'} • ${brew.drink || '-'}`;
            return `
                <button
                    type="button"
                    data-action-click="toggleLabResultBrewSelection('${escapeAttr(brew.id)}')"
                    data-action-pointerdown="startLabResultBrewLongPress('${escapeAttr(brew.id)}', event)"
                    class="w-full text-left px-3 py-2 rounded-lg border transition-colors ${
                        selected
                            ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700'
                            : 'bg-white dark:bg-[#1c1917] border-coffee-200 dark:border-[#44403c] hover:bg-coffee-50 dark:hover:bg-[#34302e]'
                    }"
                >
                    <div class="flex items-center justify-between gap-2">
                        <div class="min-w-0">
                            <div class="text-xs font-bold text-coffee-800 dark:text-white truncate">${title}</div>
                            <div class="text-[11px] text-coffee-500 dark:text-[#a8a29e] truncate">${subtitle}</div>
                        </div>
                        <div class="text-[10px] text-coffee-400 dark:text-[#78716c] whitespace-nowrap">${formatDate(brew.createdAt)}</div>
                    </div>
                    <div class="mt-1 flex items-end justify-between gap-2">
                        <div class="text-[11px] text-coffee-600 dark:text-[#a8a29e]">${meta}</div>
                        <div class="text-[10px] font-bold text-coffee-400 dark:text-[#78716c]">${brewIndex}</div>
                    </div>
                </button>
            `;
        }).join('');
    };

    const render = () => {
        renderGraphSelectors();
        renderFieldSelectors();
        renderCustomGraphModeControl();
        renderBrewTiles();
        void renderCaptureGraph();
    };

    const openLabResultsModal = (event = null) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        visibleBrews = (getFilteredCoffees() || []).slice(0, 20);
        selectedGraphKeys = new Set();
        selectedXFieldKeys = new Set(['brew']);
        selectedYFieldKeys = new Set();
        customGraphRenderMode = 'points';
        selectedBrewIds = new Set(visibleBrews.map((brew) => brew.id));
        render();
        getModal()?.classList.remove('hidden');
    };

    const closeLabResultsModal = (event = null) => {
        if (!event || event.target?.id === 'labResultsModal' || event.target?.closest?.('button')) {
            getModal()?.classList.add('hidden');
            destroyLabGraph();
        }
    };

    const toggleAxisField = (fieldKey, selectedKeys) => {
        if (!isCustomGraphSelected()) return;
        if (!fieldKey) return;
        if (selectedKeys.has(fieldKey)) selectedKeys.delete(fieldKey);
        else selectedKeys.add(fieldKey);
        renderFieldSelectors();
        void renderCaptureGraph();
    };

    const toggleLabResultXField = (fieldKey) => {
        if (!isCustomGraphSelected()) return;
        if (!fieldKey) return;
        selectedXFieldKeys = new Set([fieldKey]);
        renderFieldSelectors();
        void renderCaptureGraph();
    };

    const toggleLabResultYField = (fieldKey) => {
        toggleAxisField(fieldKey, selectedYFieldKeys);
    };

    const toggleLabResultGraph = (graphKey) => {
        if (!graphKey) return;
        if (selectedGraphKeys.has(graphKey)) {
            selectedGraphKeys.delete(graphKey);
        } else if (graphKey === 'customGraph') {
            selectedGraphKeys.delete('flowGraph');
            selectedGraphKeys.delete('weightGraph');
            selectedGraphKeys.add('customGraph');
        } else {
            selectedGraphKeys.delete('customGraph');
            selectedGraphKeys.add(graphKey);
        }
        renderGraphSelectors();
        renderFieldSelectors();
        renderCustomGraphModeControl();
        void renderCaptureGraph();
    };

    const toggleLabResultBrewSelection = (brewId) => {
        if (!brewId) return;
        if (suppressNextTileClickBrewId === brewId) {
            suppressNextTileClickBrewId = null;
            return;
        }
        if (selectedBrewIds.has(brewId)) selectedBrewIds.delete(brewId);
        else selectedBrewIds.add(brewId);
        renderBrewTiles();
        void renderCaptureGraph();
    };

    const startLabResultBrewLongPress = (brewId, event = null) => {
        if (!brewId) return;
        bindLongPressListeners();
        clearLongPressTimer();
        longPressBrewId = brewId;
        longPressTimer = setTimeout(() => {
            longPressTimer = null;
            if (longPressBrewId !== brewId) return;
            suppressNextTileClickBrewId = brewId;
            dispatchCommand?.('brews.openCard', { id: brewId, event: null, options: {} });
            longPressBrewId = null;
            event?.preventDefault?.();
        }, LONG_PRESS_MS);
    };

    const setLabResultCustomGraphRenderMode = (mode) => {
        const nextMode = mode === 'lines' || mode === 'bars' ? mode : 'points';
        customGraphRenderMode = nextMode;
        renderCustomGraphModeControl();
        if (isCustomGraphSelected()) {
            void renderCaptureGraph();
        }
    };

    return {
        openLabResultsModal,
        closeLabResultsModal,
        toggleLabResultGraph,
        toggleLabResultXField,
        toggleLabResultYField,
        toggleLabResultBrewSelection,
        startLabResultBrewLongPress,
        setLabResultCustomGraphRenderMode
    };
};
