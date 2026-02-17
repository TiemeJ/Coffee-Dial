const LAB_RESULT_AXIS_FIELDS = [
    { key: 'date', label: 'Date' },
    { key: 'brew', label: 'Brew' },
    { key: 'in', label: 'IN' },
    { key: 'out', label: 'Out' },
    { key: 'ratio', label: 'Ratio' },
    { key: 'time', label: 'Time' },
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
    { key: 'weightGraph', label: 'Weight graph' }
];

const escapeAttr = (value) => String(value || '').replace(/'/g, "\\'");

const formatDate = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleDateString();
};

export const createLabResultsModule = ({
    getFilteredCoffees,
    getCoffeeTypeDisplay
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

    const getModal = () => document.getElementById('labResultsModal');

    const hasSelectedGraphs = () => selectedGraphKeys.size > 0;
    const GRAPH_COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#db2777', '#9333ea', '#0891b2', '#ea580c', '#4f46e5'];

    const getBrewLabel = (brew) => {
        const typeDisplay = getCoffeeTypeDisplay?.(brew) || {};
        const farmer = typeDisplay.farmer || brew.farmer || 'Unknown';
        const method = brew.method || '-';
        return `${farmer} (${method})`;
    };

    const getSelectedBrews = () => visibleBrews.filter((brew) => selectedBrewIds.has(brew.id));

    const toChartPoints = (samples, valueKey) =>
        (Array.isArray(samples) ? samples : [])
            .filter((sample) => Number.isFinite(sample?.tMs) && Number.isFinite(sample?.[valueKey]))
            .map((sample) => ({ x: sample.tMs / 1000, y: sample[valueKey] }));

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

    const renderCaptureGraph = () => {
        const canvas = document.getElementById('labResultsGraphCanvas');
        const chartCtor = window.Chart;
        if (!canvas || typeof chartCtor !== 'function') return;

        if (!selectedGraphKeys.size) {
            destroyLabGraph();
            setGraphEmptyState('Select Flow graph and/or Weight graph');
            return;
        }

        const selectedBrews = getSelectedBrews();
        if (!selectedBrews.length) {
            destroyLabGraph();
            setGraphEmptyState('Select at least one brew');
            return;
        }

        const datasets = [];
        selectedBrews.forEach((brew, brewIndex) => {
            const baseColor = GRAPH_COLORS[brewIndex % GRAPH_COLORS.length];
            const brewLabel = getBrewLabel(brew);
            if (selectedGraphKeys.has('weightGraph')) {
                const points = toChartPoints(brew.scaleCapture?.samples, 'w');
                if (points.length) {
                    datasets.push({
                        label: `${brewLabel} - Weight`,
                        data: points,
                        borderColor: baseColor,
                        backgroundColor: baseColor,
                        yAxisID: 'yWeight',
                        pointRadius: 0,
                        pointHoverRadius: 2,
                        borderWidth: 2,
                        tension: 0.15
                    });
                }
            }
            if (selectedGraphKeys.has('flowGraph')) {
                const points = toChartPoints(brew.scaleFlowCapture?.samples, 'flow');
                if (points.length) {
                    datasets.push({
                        label: `${brewLabel} - Flow`,
                        data: points,
                        borderColor: baseColor,
                        backgroundColor: baseColor,
                        borderDash: [6, 3],
                        yAxisID: 'yFlow',
                        pointRadius: 0,
                        pointHoverRadius: 2,
                        borderWidth: 2,
                        tension: 0.15
                    });
                }
            }
        });

        if (!datasets.length) {
            destroyLabGraph();
            setGraphEmptyState('No capture samples found for selected brews');
            return;
        }

        hideGraphEmptyState();
        destroyLabGraph();
        labGraphChart = new chartCtor(canvas.getContext('2d'), {
            type: 'line',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                parsing: false,
                scales: {
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
                    tooltip: { mode: 'nearest', intersect: false }
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
        const disabled = hasSelectedGraphs();
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
                        type="checkbox"
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
        renderBrewTiles();
        renderCaptureGraph();
    };

    const openLabResultsModal = (event = null) => {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        visibleBrews = (getFilteredCoffees() || []).slice(0, 20);
        selectedGraphKeys = new Set();
        selectedXFieldKeys = new Set();
        selectedYFieldKeys = new Set();
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
        if (hasSelectedGraphs()) return;
        if (!fieldKey) return;
        if (selectedKeys.has(fieldKey)) selectedKeys.delete(fieldKey);
        else selectedKeys.add(fieldKey);
        renderFieldSelectors();
    };

    const toggleLabResultXField = (fieldKey) => {
        toggleAxisField(fieldKey, selectedXFieldKeys);
    };

    const toggleLabResultYField = (fieldKey) => {
        toggleAxisField(fieldKey, selectedYFieldKeys);
    };

    const toggleLabResultGraph = (graphKey) => {
        if (!graphKey) return;
        if (selectedGraphKeys.has(graphKey)) selectedGraphKeys.delete(graphKey);
        else selectedGraphKeys.add(graphKey);
        renderGraphSelectors();
        renderFieldSelectors();
        renderCaptureGraph();
    };

    const toggleLabResultBrewSelection = (brewId) => {
        if (!brewId) return;
        if (selectedBrewIds.has(brewId)) selectedBrewIds.delete(brewId);
        else selectedBrewIds.add(brewId);
        renderBrewTiles();
        renderCaptureGraph();
    };

    return {
        openLabResultsModal,
        closeLabResultsModal,
        toggleLabResultGraph,
        toggleLabResultXField,
        toggleLabResultYField,
        toggleLabResultBrewSelection
    };
};
