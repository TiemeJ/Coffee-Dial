import { DeviceManager } from '../devices/device-manager.js';

let coffeeScaleApi = null;

export const getCoffeeScale = () => coffeeScaleApi;

export function initCoffeeScale({ openScaleModal, onTimerStateChange, onCaptureReset } = {}) {
  const statusEl = document.getElementById("status");
  const weightEl = document.getElementById("weight");
  const tareBtn = document.getElementById("tare");
  const timerBtn = document.getElementById("timer");
  const resetTimerBtn = document.getElementById("resetTimer");
  const connectBtn = document.getElementById("connect");  
  const connectStatusEl = document.getElementById("connectScaleStatus");
  const connectWeightEl = document.getElementById("connectScaleWeight");
  const connectTareBtn = document.getElementById("connectScaleTare");
  const connectTimerBtn = document.getElementById("connectScaleTimer");
  const connectResetTimerBtn = document.getElementById("connectScaleResetTimer");
  const connectConnectBtn = document.getElementById("connectScaleConnect");
  const flowEl = document.getElementById("flow");
  let graphTimeEl = document.getElementById("graphTime");
  const captureOutputEl = document.getElementById("captureOutput");
  const flowOutputEl = document.getElementById("flowOutput");
  const rawOutputEl = document.getElementById("rawOutput");
  let graphEl = document.getElementById("graph");
  let graphInputWeightEl = document.getElementById("graphInputWeight");
  let graphInputRatioEl = document.getElementById("graphInputRatio");
  let graphInputYieldEl = document.getElementById("graphInputYield");
  let graphFirstDripEl = document.getElementById("graphFirstDrip");
  let graphMaxFlowEl = document.getElementById("graphMaxFlow");
  let graphAvgFlowEl = document.getElementById("graphAvgFlow");
  let graphAutoStartToggle = document.getElementById("graphAutoStartToggle");
  let graphUnswirlToggle = document.getElementById("graphUnswirlToggle");
  let graphEventLogEl = document.getElementById("graphEventLog");
  let graphCountPoursToggle = document.getElementById("graphCountPoursToggle");
  const GRAPH_TOGGLE_NONE_KEY = "none";
  let graphTogglePrefs = {};
  let graphTogglePrefsSaver = null;
  let liveTimerInterval = null;
  let liveTimerStartAt = null;
  let liveTimerElapsedMs = 0;

  function refreshGraphDomRefs() {
    graphTimeEl = document.getElementById("graphTime");
    graphEl = document.getElementById("graph");
    graphInputWeightEl = document.getElementById("graphInputWeight");
    graphInputRatioEl = document.getElementById("graphInputRatio");
    graphInputYieldEl = document.getElementById("graphInputYield");
    graphFirstDripEl = document.getElementById("graphFirstDrip");
    graphMaxFlowEl = document.getElementById("graphMaxFlow");
    graphAvgFlowEl = document.getElementById("graphAvgFlow");
    graphAutoStartToggle = document.getElementById("graphAutoStartToggle");
    graphUnswirlToggle = document.getElementById("graphUnswirlToggle");
    graphEventLogEl = document.getElementById("graphEventLog");
    graphCountPoursToggle = document.getElementById("graphCountPoursToggle");
  }

  // Scale modal elements may not be mounted (graph-only usage): do not early-return,
  // all element-dependent code below is already guarded with null checks.

  let timerRunning = false;
  let lastWeight = null;
  let isConnected = false;
  let scale2Capture = { startAt: null, samples: [] };
  let scale2RawSamples = [];
  let scale2LastInterpolatedWeight = null;
  let scale2FlowHistory = [];
  let scale2FlowCapture = { startAt: null, samples: [] };
  let lastFocusedField = null;
  let weighClickFromOut = false;
  let capture = {
    startAt: null,
    samples: [],
  };
  let captureInterval = null;
  let flowCapture = {
    startAt: null,
    samples: [],
  };
  let flowPrevWeight = null;
  let rawSamples = [];
  let lastInterpolatedWeight = null;
  let flowHistory = [];
  let firstDripCapturedAt = null;
  let maxFlowCaptured = null;
  let autoStartPending = false;
  let unswirlEnabled = false;
  let swirlActive = false;
  let swirlCount = 0;
  let currentSwirlStartMs = null;
  let swirls = [];
  let lastGoodWeight = null;
  let swirlStartHoldWeight = null;
  let swirlPendingEndMs = null;
  let swirlSpikeFilterUntil = null;
  let swirlPostWeight = null;
  let countPoursEnabled = false;
  let pourActive = false;
  let pourCount = 0;
  let pourStartMs = null;
  let pourStartWeight = null;
  let pourMaxFlow = null;
  let pours = [];
  let graphTooltipEl = null;
  let graphTooltipHideBound = false;
  const graphRenderCache = new WeakMap();
  const graphHoverState = new WeakMap();
  const graphLabelHits = new WeakMap();
  const FLOW_WINDOW_MS = 2000;
  const FIRST_DRIP_THRESHOLD = 0;
  const AUTO_START_THRESHOLD = 0.2;
  const UNSWIRL_THRESHOLD = 0.1;
  const POUR_FLOW_THRESHOLD = 3;
  const CAPTURE_UI_UPDATE_INTERVAL_MS = 250;
  const LIVE_YIELD_INPUT_DISPATCH_INTERVAL_MS = 120;
  let lastCaptureUiRefreshAt = 0;
  let lastLiveYieldInputDispatchAt = 0;



  function getMethodValueFromForm() {
    const methodEl = document.getElementById("method");
    const methodOtherEl = document.getElementById("methodOther");
    const raw = methodEl ? methodEl.value : "";
    if (raw === "Other") {
      const otherValue = methodOtherEl ? methodOtherEl.value.trim() : "";
      return otherValue || "Other";
    }
    return raw || "";
  }

  function getMethodKey(value) {
    const cleaned = (value || "").trim();
    return cleaned ? cleaned.toLowerCase() : GRAPH_TOGGLE_NONE_KEY;
  }

  function getGraphTogglePrefs() {
    return graphTogglePrefs || {};
  }

  function saveGraphTogglePrefsForMethod(methodValue = null) {
    const prefs = getGraphTogglePrefs();
    const methodKey = getMethodKey(methodValue ?? getMethodValueFromForm());
    prefs[methodKey] = {
      autoStart: !!graphAutoStartToggle?.checked,
      unswirl: !!graphUnswirlToggle?.checked,
      countPours: !!graphCountPoursToggle?.checked,
    };
    graphTogglePrefs = { ...prefs };
    if (typeof graphTogglePrefsSaver === "function") {
      Promise.resolve(graphTogglePrefsSaver(graphTogglePrefs)).catch((err) => {
        console.warn("Failed to save graph toggle prefs", err);
      });
    }
  }

  function setGraphToggleState(state) {
    refreshGraphDomRefs();
    if (graphAutoStartToggle && typeof state.autoStart === "boolean") {
      graphAutoStartToggle.checked = state.autoStart;
      if (!state.autoStart && autoStartPending) {
        autoStartPending = false;
        setTimerBlinking(false);
      }
    }
    if (graphUnswirlToggle && typeof state.unswirl === "boolean") {
      graphUnswirlToggle.checked = state.unswirl;
      unswirlEnabled = state.unswirl;
      if (!unswirlEnabled) {
        swirlActive = false;
        currentSwirlStartMs = null;
      } else if (Number.isFinite(lastWeight) && lastWeight > UNSWIRL_THRESHOLD) {
        lastGoodWeight = lastWeight;
      }
    }
    if (graphCountPoursToggle && typeof state.countPours === "boolean") {
      graphCountPoursToggle.checked = state.countPours;
      countPoursEnabled = state.countPours;
      if (!countPoursEnabled) {
        pourActive = false;
        pourStartMs = null;
        pourStartWeight = null;
      }
    }
  }

  function applyGraphTogglePrefsForMethod(methodValue = null) {
    refreshGraphDomRefs();
    const prefs = getGraphTogglePrefs();
    const methodKey = getMethodKey(methodValue ?? getMethodValueFromForm());
    const state = prefs[methodKey];
    if (!state) {
      if (methodKey === GRAPH_TOGGLE_NONE_KEY) {
        saveGraphTogglePrefsForMethod(methodValue ?? getMethodValueFromForm());
      }
      return;
    }
    setGraphToggleState(state);
  }

  /* ---- UI helpers ---- */
  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
    if (connectStatusEl) connectStatusEl.textContent = text;
  }

  function setWeight(value) {
    const prevWeight = lastWeight;
    const formattedWeight = value.toFixed(1) + " g";
    if (weightEl && weightEl.textContent !== formattedWeight) {
      weightEl.textContent = formattedWeight;
    }
    if (connectWeightEl && connectWeightEl.textContent !== formattedWeight) {
      connectWeightEl.textContent = formattedWeight;
    }
    lastWeight = value;
    // When scale 2 (cup) is active it owns the live yield field; suppress scale 1 updates.
    if (!isScale2Active()) updateLiveWeight(value);
    if (timerRunning) {
      addRawSample(value, Date.now());
    }
    if (autoStartPending && Number.isFinite(value)) {
      const weightDelta = Number.isFinite(prevWeight) ? Math.abs(value - prevWeight) : Math.abs(value);
      if (weightDelta >= AUTO_START_THRESHOLD) {
        triggerAutoStartTimer();
      }
    }
  }

  // Returns true when a Scale 2 device (cup) is actively connected.
  function isScale2Active() {
    return !!DeviceManager.getDevice('scale2')?.isConnected;
  }

  function setFlow(value) {
    if (!flowEl) return;
    if (!Number.isFinite(value)) {
      flowEl.textContent = "--.- g/s";
      return;
    }
    flowEl.textContent = value.toFixed(1) + " g/s";
  }

  function updateLiveWeight(value) {
    if (!timerRunning) return;
    if (!Number.isFinite(value)) return;
    const outField = document.getElementById("inputYield");
    if (!outField) return;
    const formatted = value.toFixed(1);
    if (outField.value !== formatted) {
      outField.value = formatted;
    }
    const now = Date.now();
    if (now - lastLiveYieldInputDispatchAt < LIVE_YIELD_INPUT_DISPATCH_INTERVAL_MS) {
      return;
    }
    lastLiveYieldInputDispatchAt = now;
    outField.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function updateCaptureOutput() {
    if (!captureOutputEl) return;
    captureOutputEl.value = JSON.stringify(capture);
  }

  function updateFlowOutput() {
    if (!flowOutputEl) return;
    flowOutputEl.value = JSON.stringify(flowCapture);
  }

  function updateRawOutput() {
    if (!rawOutputEl) return;
    rawOutputEl.value = JSON.stringify({
      startAt: capture.startAt,
      samples: rawSamples,
    });
  }

  function getFirstDripSecondsFromState() {
    if (!Number.isFinite(firstDripCapturedAt)) return null;
    return Math.round(firstDripCapturedAt / 1000);
  }

  function syncFirstDripInputFromState() {
    if (!graphFirstDripEl) return;
    const firstDripSeconds = getFirstDripSecondsFromState();
    graphFirstDripEl.value = Number.isFinite(firstDripSeconds) ? String(firstDripSeconds) : "";
  }

  function setFirstDripSeconds(seconds) {
    const parsed = Number(seconds);
    firstDripCapturedAt = Number.isFinite(parsed) ? parsed * 1000 : null;
    syncFirstDripInputFromState();
    renderGraph();
  }

  function renderGraphTo(targetEl, dataOverride = null) {
    console.log('[renderGraphTo] called, targetEl:', targetEl, 'dataOverride:', dataOverride);
    if (!targetEl) { console.warn('[renderGraphTo] no targetEl, returning'); return; }
    const ctx = targetEl.getContext("2d");
    const width = targetEl.clientWidth || 320;
    const height = targetEl.clientHeight || 220;
    if (targetEl.width !== width) targetEl.width = width;
    if (targetEl.height !== height) targetEl.height = height;

    ctx.clearRect(0, 0, width, height);

    const padding = { left: 40, right: 60, top: 20, bottom: 46 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const captureData = dataOverride?.capture || capture;
    const flowData = dataOverride?.flowCapture || flowCapture;
    const scale2CaptureData = dataOverride?.scale2Capture ?? (scale2Capture.samples.length ? scale2Capture : null);
    const firstDripSource = dataOverride?.firstDrip ?? getFirstDripSecondsFromState();
    const firstDripSeconds = Number.isFinite(Number(firstDripSource)) ? Number(firstDripSource) : null;
    const elapsedSecondsSource = dataOverride?.elapsedSeconds;
    let elapsedSeconds = Number.isFinite(Number(elapsedSecondsSource)) ? Number(elapsedSecondsSource) : null;
    const recipeSteps = Array.isArray(dataOverride?.recipeSteps) ? dataOverride.recipeSteps : getRecipeSteps();
    if (!Number.isFinite(elapsedSeconds) && !timerRunning) {
      const timeField = document.getElementById("time");
      const timeValue = timeField ? Number(timeField.value) : NaN;
      elapsedSeconds = Number.isFinite(timeValue) ? timeValue : null;
    }
    const samples = captureData.samples || [];
    const flowSamples = flowData.samples || [];
    const scale2Samples = (scale2CaptureData?.samples || []).filter((s) => Number.isFinite(s?.w));
    const scale2FlowData = dataOverride?.scale2FlowCapture ?? (scale2FlowCapture.samples.length ? scale2FlowCapture : null);
    const scale2FlowSamples = (scale2FlowData?.samples || []).filter((s) => Number.isFinite(s?.flow));
    if (!samples.length && !flowSamples.length && !scale2Samples.length && !scale2FlowSamples.length) {
      ctx.fillStyle = "#999";
      ctx.font = "12px system-ui";
      ctx.fillText("No data", padding.left, padding.top + 12);
      return;
    }

    const allTimes = samples.map((s) => s.tMs)
      .concat(flowSamples.map((s) => s.tMs))
      .concat(scale2Samples.map((s) => s.tMs));
    const minT = Math.min(...allTimes);
    const maxT = Math.max(...allTimes);
    const spanT = Math.max(1, maxT - minT);

    const weightVals = samples.map((s) => s.w).filter((v) => Number.isFinite(v));
    const scale2WeightVals = scale2Samples.map((s) => s.w).filter((v) => Number.isFinite(v));
    const flowVals = flowSamples.map((s) => s.flow).filter((v) => Number.isFinite(v));
    const scale2FlowVals = scale2FlowSamples.map((s) => s.flow).filter((v) => Number.isFinite(v));

    const allWeightVals = weightVals.concat(scale2WeightVals);
    const allFlowVals = flowVals.concat(scale2FlowVals);
    let minW = allWeightVals.length ? Math.min(...allWeightVals) : 0;
    let maxW = allWeightVals.length ? Math.max(...allWeightVals) : 1;
    let minF = allFlowVals.length ? Math.min(...allFlowVals) : 0;
    let maxF = allFlowVals.length ? Math.max(...allFlowVals) : 1;

    if (minW === maxW) {
      minW -= 0.5;
      maxW += 0.5;
    }
    if (minF === maxF) {
      minF -= 0.5;
      maxF += 0.5;
    }

    const xFor = (t) => padding.left + ((t - minT) / spanT) * plotW;
    const yForW = (w) => padding.top + (1 - (w - minW) / (maxW - minW)) * plotH;
    const yForF = (f) => padding.top + (1 - (f - minF) / (maxF - minF)) * plotH;

    const hoverEnabled = !!dataOverride || !captureInterval;
    if (!hoverEnabled && graphHoverState.has(targetEl)) {
      graphHoverState.delete(targetEl);
    }
    graphRenderCache.set(targetEl, {
      dataOverride,
      padding,
      plotW,
      plotH,
      minT,
      maxT,
      spanT,
      samples,
      flowSamples,
      scale2Samples,
      scale2FlowSamples,
      minW,
      maxW,
      minF,
      maxF,
      hoverEnabled,
    });

    ctx.strokeStyle = "#eee";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + plotH);
    ctx.lineTo(padding.left + plotW, padding.top + plotH);
    ctx.moveTo(padding.left, padding.top);
    ctx.lineTo(padding.left, padding.top + plotH);
    ctx.moveTo(padding.left + plotW, padding.top);
    ctx.lineTo(padding.left + plotW, padding.top + plotH);
    ctx.stroke();

    ctx.font = "12px system-ui";
    ctx.textBaseline = "middle";
    ctx.textAlign = "right";
    ctx.fillStyle = "#2563eb";
    ctx.fillText(`${minW.toFixed(1)} g`, padding.left - 6, padding.top + plotH);
    ctx.fillText(`${maxW.toFixed(1)} g`, padding.left - 6, padding.top);
    ctx.textAlign = "left";
    ctx.fillStyle = "#16a34a";
    const maxFlowLabel = `${maxF.toFixed(1)} g/s`;
    const minFlowLabel = `${minF.toFixed(1)} g/s`;
    const flowLabelX = padding.left + plotW + 6;
    ctx.fillText(maxFlowLabel, flowLabelX, padding.top);
    ctx.fillText(minFlowLabel, flowLabelX, padding.top + plotH);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    if (samples.length) {
      ctx.strokeStyle = "#2563eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      samples.forEach((s, i) => {
        if (!Number.isFinite(s.w)) return;
        const x = xFor(s.tMs);
        const y = yForW(s.w);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    if (scale2Samples.length) {
      ctx.save();
      ctx.strokeStyle = "#f97316";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.beginPath();
      scale2Samples.forEach((s, i) => {
        const x = xFor(s.tMs);
        const y = yForW(s.w);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    if (scale2FlowSamples.length) {
      ctx.save();
      ctx.strokeStyle = "#fb923c";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      scale2FlowSamples.forEach((s, i) => {
        if (!Number.isFinite(s.flow)) return;
        const x = xFor(s.tMs);
        const y = yForF(s.flow);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.restore();
    }

    if (flowSamples.length) {
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      flowSamples.forEach((s, i) => {
        if (!Number.isFinite(s.flow)) return;
        const x = xFor(s.tMs);
        const y = yForF(s.flow);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    }

    const hoverState = graphHoverState.get(targetEl);
    if (hoverState && Number.isFinite(hoverState.x)) {
      const hoverX = Math.min(padding.left + plotW, Math.max(padding.left, hoverState.x));
      ctx.save();
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = "rgba(148, 163, 184, 0.9)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(hoverX, padding.top);
      ctx.lineTo(hoverX, padding.top + plotH);
      ctx.stroke();
      ctx.restore();
    }

    const labelHits = [];
    if (recipeSteps.length) {
      const axisY = padding.top + plotH;
      ctx.strokeStyle = "#16a34a";
      ctx.lineWidth = 1;
      recipeSteps.forEach((step) => {
        const startMs = Number(step.startMs);
        const endMs = Number(step.endMs);
        if (step?.type === "pour") {
          ctx.strokeStyle = "#16a34a";
          if (Number.isFinite(startMs)) {
            const x = xFor(Math.min(Math.max(startMs, minT), maxT));
            ctx.beginPath();
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY + 5);
            ctx.stroke();
          }
          if (Number.isFinite(endMs)) {
            const x = xFor(Math.min(Math.max(endMs, minT), maxT));
            ctx.beginPath();
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY + 5);
            ctx.stroke();
          }
          if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
            const midMs = (startMs + endMs) / 2;
            const x = xFor(Math.min(Math.max(midMs, minT), maxT));
            ctx.fillStyle = "#16a34a";
            ctx.font = "11px system-ui";
            ctx.textAlign = "center";
            const label = `p${step.count}`;
            const textWidth = ctx.measureText(label).width;
            const textY = axisY + 16;
            ctx.fillText(label, x, textY);
            labelHits.push({
              x: x - textWidth / 2,
              y: textY - 10,
              w: textWidth,
              h: 12,
              step,
            });
          }
        } else if (step?.type === "swirl") {
          ctx.strokeStyle = "#f59e0b";
          if (Number.isFinite(startMs)) {
            const x = xFor(Math.min(Math.max(startMs, minT), maxT));
            ctx.beginPath();
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY + 5);
            ctx.stroke();
          }
          if (Number.isFinite(endMs)) {
            const x = xFor(Math.min(Math.max(endMs, minT), maxT));
            ctx.beginPath();
            ctx.moveTo(x, axisY);
            ctx.lineTo(x, axisY + 5);
            ctx.stroke();
          }
          if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
            const midMs = (startMs + endMs) / 2;
            const x = xFor(Math.min(Math.max(midMs, minT), maxT));
            ctx.fillStyle = "#f59e0b";
            ctx.font = "11px system-ui";
            ctx.textAlign = "center";
            const label = `s${step.count}`;
            const textWidth = ctx.measureText(label).width;
            const textY = axisY + 16;
            ctx.fillText(label, x, textY);
            labelHits.push({
              x: x - textWidth / 2,
              y: textY - 10,
              w: textWidth,
              h: 12,
              step,
            });
          }
        }
      });
    }

    if (Number.isFinite(firstDripSeconds)) {
      const firstDripMs = firstDripSeconds * 1000;
      if (firstDripMs >= minT && firstDripMs <= maxT) {
        const x = xFor(firstDripMs);
        const axisY = padding.top + plotH;
        ctx.strokeStyle = "#f59e0b";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, axisY);
        ctx.lineTo(x, axisY + 6);
        ctx.stroke();
        ctx.fillStyle = "#f59e0b";
        ctx.font = "11px system-ui";
        const label = `${firstDripSeconds}s`;
        const labelWidth = ctx.measureText(label).width;
        const labelX = x;
        ctx.textAlign = "center";
        ctx.fillText(label, labelX, axisY + 16);
      }
    }

    if (Number.isFinite(elapsedSeconds)) {
      const elapsedMs = elapsedSeconds * 1000;
      const x = xFor(Math.min(Math.max(elapsedMs, minT), maxT));
      const axisY = padding.top + plotH;
      ctx.strokeStyle = "#9ca3af";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, axisY);
      ctx.lineTo(x, axisY + 6);
      ctx.stroke();
      ctx.fillStyle = "#9ca3af";
      ctx.font = "11px system-ui";
      const label = `${elapsedSeconds}s`;
      const labelX = x;
      ctx.textAlign = "center";
      ctx.fillText(label, labelX, axisY + 16);
    }

    const hasScale2Data = scale2Samples.length > 0 || scale2FlowSamples.length > 0;
    const weightLabel = hasScale2Data ? "Poured weight" : "Weight";
    const flowLabel = hasScale2Data ? "Pouring flow" : "Flow";
    ctx.font = "12px system-ui";
    ctx.textAlign = "left";
    const maxFlowLabelWidth = ctx.measureText(maxFlowLabel).width;
    const minFlowLabelWidth = ctx.measureText(minFlowLabel).width;
    const flowAxisLabelRight = flowLabelX + Math.max(maxFlowLabelWidth, minFlowLabelWidth);
    const swatchWidth = 10;
    const gap = 6;
    const itemGap = 12;

    const legendEntries = hasScale2Data ? [
      { color: "#2563eb", dash: null,   label: weightLabel },
      { color: "#16a34a", dash: null,   label: flowLabel },
      { color: "#f97316", dash: [6, 3], label: "Beverage weight" },
      { color: "#fb923c", dash: [3, 4], label: "Drip flow" },
    ] : [
      { color: "#2563eb", dash: null, label: weightLabel },
      { color: "#16a34a", dash: null, label: flowLabel },
    ];

    const legendTotalWidth = legendEntries.reduce((acc, e, i) => {
      return acc + swatchWidth + gap + ctx.measureText(e.label).width + (i < legendEntries.length - 1 ? itemGap : 0);
    }, 0);
    const legendLeft = Math.max(padding.left, flowAxisLabelRight - legendTotalWidth);
    const legendY = height - 6;

    let legendCurX = legendLeft;
    legendEntries.forEach(({ color, dash, label }) => {
      ctx.save();
      if (dash) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash(dash);
        ctx.beginPath();
        ctx.moveTo(legendCurX, legendY + 1);
        ctx.lineTo(legendCurX + swatchWidth, legendY + 1);
        ctx.stroke();
      } else {
        ctx.fillStyle = color;
        ctx.fillRect(legendCurX, legendY, swatchWidth, 2);
      }
      ctx.restore();
      ctx.fillStyle = "#444";
      ctx.textAlign = "left";
      ctx.fillText(label, legendCurX + swatchWidth + gap, legendY + 4);
      legendCurX += swatchWidth + gap + ctx.measureText(label).width + itemGap;
    });

    graphLabelHits.set(targetEl, labelHits);
    attachGraphTooltipHandler(targetEl);
  }

  function renderGraph() {
    refreshGraphDomRefs();
    renderGraphTo(graphEl);
  }

  function attachGraphTooltipHandler(targetEl) {
    if (!targetEl || targetEl.dataset.graphTooltipBound) return;
    targetEl.dataset.graphTooltipBound = "true";
    targetEl.style.touchAction = "none";
    const updateHover = (event) => {
      const cache = graphRenderCache.get(targetEl);
      if (!cache || !cache.hoverEnabled) return;
      const rect = targetEl.getBoundingClientRect();
      const scaleX = targetEl.width / rect.width;
      const scaleY = targetEl.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      const { padding, plotW, plotH, minT, maxT, spanT, samples, flowSamples } = cache;
      const withinX = x >= padding.left && x <= padding.left + plotW;
      const withinY = y >= padding.top && y <= padding.top + plotH;
      if (!withinX || !withinY) {
        clearGraphHover(targetEl);
        return;
      }
      const clampedX = Math.min(padding.left + plotW, Math.max(padding.left, x));
      const timeMs = minT + ((clampedX - padding.left) / plotW) * spanT;
      const weight = getValueAtTime(samples, "w", timeMs);
      const flow = getValueAtTime(flowSamples, "flow", timeMs);
      graphHoverState.set(targetEl, { x: clampedX });
      renderGraphTo(targetEl, cache.dataOverride);
      showGraphTooltip(event.clientX, event.clientY, buildHoverTooltipHtml(timeMs, weight, flow), "hover");
    };
    const clearHover = () => clearGraphHover(targetEl);
    targetEl.addEventListener("pointermove", updateHover);
    targetEl.addEventListener("pointerdown", updateHover);
    targetEl.addEventListener("pointerleave", clearHover);
    targetEl.addEventListener("pointerup", clearHover);
    targetEl.addEventListener("pointercancel", clearHover);
    targetEl.addEventListener("click", (event) => {
      const hits = graphLabelHits.get(targetEl) || [];
      if (!hits.length) {
        hideGraphTooltip();
        return;
      }
      const rect = targetEl.getBoundingClientRect();
      const scaleX = targetEl.width / rect.width;
      const scaleY = targetEl.height / rect.height;
      const x = (event.clientX - rect.left) * scaleX;
      const y = (event.clientY - rect.top) * scaleY;
      const hit = hits.find((h) => x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h);
      if (!hit) {
        hideGraphTooltip();
        return;
      }
      const html = buildStepTooltipHtml(hit.step);
      showGraphTooltip(event.clientX, event.clientY, html, "step");
      event.stopPropagation();
    });
    if (!graphTooltipHideBound) {
      graphTooltipHideBound = true;
      document.addEventListener("click", () => hideGraphTooltip());
    }
  }

  function clearGraphHover(targetEl) {
    if (!targetEl) return;
    const cache = graphRenderCache.get(targetEl);
    if (graphHoverState.has(targetEl)) {
      graphHoverState.delete(targetEl);
      renderGraphTo(targetEl, cache ? cache.dataOverride : null);
    }
    hideGraphTooltip("hover");
  }

  function ensureGraphTooltip() {
    if (graphTooltipEl) return graphTooltipEl;
    const el = document.createElement("div");
    el.style.position = "fixed";
    el.style.zIndex = "10050";
    el.style.background = "rgba(15, 23, 42, 0.95)";
    el.style.color = "#e2e8f0";
    el.style.border = "1px solid rgba(148, 163, 184, 0.4)";
    el.style.borderRadius = "8px";
    el.style.padding = "8px 10px";
    el.style.font = "12px system-ui";
    el.style.lineHeight = "1.4";
    el.style.boxShadow = "0 8px 20px rgba(15, 23, 42, 0.35)";
    el.style.pointerEvents = "none";
    el.style.maxWidth = "220px";
    el.style.display = "none";
    document.body.appendChild(el);
    graphTooltipEl = el;
    return el;
  }

  function showGraphTooltip(clientX, clientY, html, mode = "hover") {
    const el = ensureGraphTooltip();
    el.innerHTML = html;
    el.dataset.mode = mode;
    el.style.display = "block";
    const offset = 40;
    let left = clientX - offset;
    let top = clientY - offset;
    const rect = el.getBoundingClientRect();
    if (left - rect.width < 8) left = clientX + offset;
    else left = left - rect.width;
    if (top - rect.height < 8) top = clientY + offset;
    else top = top - rect.height;
    el.style.left = `${Math.max(8, left)}px`;
    el.style.top = `${Math.max(8, top)}px`;
  }

  function hideGraphTooltip(mode = null) {
    if (!graphTooltipEl) return;
    if (mode && graphTooltipEl.dataset.mode !== mode) return;
    graphTooltipEl.style.display = "none";
  }

  function formatSeconds(ms) {
    if (!Number.isFinite(ms)) return "-";
    return Math.round(ms / 1000);
  }

  function formatValue(value, suffix = "") {
    if (!Number.isFinite(value)) return "-";
    return `${value.toFixed(1)}${suffix}`;
  }

  function formatHoverSeconds(ms) {
    if (!Number.isFinite(ms)) return "-";
    return (ms / 1000).toFixed(1);
  }

  function getValueAtTime(samples, key, tMs) {
    if (!Array.isArray(samples) || samples.length === 0 || !Number.isFinite(tMs)) return null;
    if (tMs <= samples[0].tMs) return samples[0][key];
    if (tMs >= samples[samples.length - 1].tMs) return samples[samples.length - 1][key];
    let i = 1;
    while (i < samples.length && samples[i].tMs < tMs) {
      i += 1;
    }
    const prev = samples[i - 1];
    const next = samples[i];
    const v1 = prev ? prev[key] : null;
    const v2 = next ? next[key] : null;
    if (!Number.isFinite(v1) && !Number.isFinite(v2)) return null;
    if (!Number.isFinite(v1)) return v2;
    if (!Number.isFinite(v2)) return v1;
    const span = next.tMs - prev.tMs;
    if (span <= 0) return v1;
    const ratio = (tMs - prev.tMs) / span;
    return v1 + (v2 - v1) * ratio;
  }

  function buildHoverTooltipHtml(timeMs, weight, flow) {
    return `
      <div style="font-weight:600;margin-bottom:4px;">Time: ${formatHoverSeconds(timeMs)}s</div>
      <div>Weight: ${formatValue(weight, "g")}</div>
      <div>Flow: ${formatValue(flow, "g/s")}</div>
    `;
  }

  function buildStepTooltipHtml(step) {
    if (!step) return "";
    if (step.type === "pour") {
      const start = formatSeconds(step.startMs);
      const end = formatSeconds(step.endMs);
      const len = Number.isFinite(step.startMs) && Number.isFinite(step.endMs)
        ? Math.max(0, Math.round((step.endMs - step.startMs) / 1000))
        : "-";
      return `
        <div style="font-weight:600;margin-bottom:4px;">Pour ${step.count || ""}</div>
        <div>Start: ${start}s</div>
        <div>End: ${end}s</div>
        <div>Length: ${len}s</div>
        <div>Weight: ${formatValue(step.weightDiff, "g")}</div>
        <div>Avg flow: ${formatValue(step.avgFlow, "g/s")}</div>
        <div>Max flow: ${formatValue(step.maxFlow, "g/s")}</div>
      `;
    }
    if (step.type === "swirl") {
      const start = formatSeconds(step.startMs);
      const end = formatSeconds(step.endMs);
      const len = Number.isFinite(step.startMs) && Number.isFinite(step.endMs)
        ? Math.max(0, Math.round((step.endMs - step.startMs) / 1000))
        : "-";
      return `
        <div style="font-weight:600;margin-bottom:4px;">Swirl ${step.count || ""}</div>
        <div>Start: ${start}s</div>
        <div>End: ${end}s</div>
        <div>Length: ${len}s</div>
      `;
    }
    return "";
  }

  function startCapture() {
    capture = {
      startAt: Date.now(),
      samples: [],
    };
    flowCapture = {
      startAt: capture.startAt,
      samples: [],
    };
    scale2Capture = { startAt: capture.startAt, samples: [] };
    scale2RawSamples = [];
    scale2LastInterpolatedWeight = null;
    scale2FlowHistory = [];
    scale2FlowCapture = { startAt: capture.startAt, samples: [] };
    flowPrevWeight = null;
    rawSamples = [];
    lastInterpolatedWeight = null;
    flowHistory = [];
    firstDripCapturedAt = null;
    maxFlowCaptured = null;
    unswirlEnabled = graphUnswirlToggle ? graphUnswirlToggle.checked : false;
    swirlActive = false;
    swirlCount = 0;
    currentSwirlStartMs = null;
    swirls = [];
    lastGoodWeight = null;
    swirlStartHoldWeight = null;
    swirlPendingEndMs = null;
    countPoursEnabled = graphCountPoursToggle ? graphCountPoursToggle.checked : false;
    pourActive = false;
    pourCount = 0;
    pourStartMs = null;
    pourStartWeight = null;
    pourMaxFlow = null;
    pours = [];
    syncFirstDripInputFromState();
    updateCaptureOutput();
    updateFlowOutput();
    updateRawOutput();
    renderGraph();
    lastCaptureUiRefreshAt = 0;

    if (captureInterval) {
      clearInterval(captureInterval);
    }

    captureInterval = setInterval(() => {
      if (!capture.startAt) return;
      const elapsedMs = Date.now() - capture.startAt;
      const targetTime = capture.startAt + elapsedMs;
      const resampledWeight = getInterpolatedWeight(targetTime);
      let effectiveWeight = resampledWeight;
      // Clamp effectiveWeight to zero or above
      if (Number.isFinite(effectiveWeight) && effectiveWeight < 0) {
        effectiveWeight = 0;
      }

      if (unswirlEnabled) {
        const hasWeight = Number.isFinite(resampledWeight);
        // Swirl start: hold pre-swirl weight for 500ms
        if (!swirlActive && hasWeight && resampledWeight <= UNSWIRL_THRESHOLD && Number.isFinite(lastGoodWeight) && lastGoodWeight > UNSWIRL_THRESHOLD) {
          swirlActive = true;
          swirlCount += 1;
          currentSwirlStartMs = elapsedMs;
          const preSwirlTime = Math.max(0, elapsedMs - 1000);
          const preSwirlWeight = getInterpolatedWeight(capture.startAt + preSwirlTime);
          swirlStartHoldWeight = Number.isFinite(preSwirlWeight) ? preSwirlWeight : lastGoodWeight;
          swirlSpikeFilterUntil = elapsedMs + 500;
        }

        // Swirl end: hold post-swirl weight for 500ms
        if (swirlActive) {
          if (hasWeight && resampledWeight > UNSWIRL_THRESHOLD) {
            swirlActive = false;
            const swirlRecord = {
              count: swirlCount,
              startMs: currentSwirlStartMs,
              endMs: elapsedMs
            };
            swirls.push(swirlRecord);
            renderEventLog();
            currentSwirlStartMs = null;
            swirlPendingEndMs = elapsedMs + 1000;
            lastGoodWeight = Number.isFinite(resampledWeight) ? resampledWeight : lastGoodWeight;
            swirlSpikeFilterUntil = elapsedMs + 500;
            swirlPostWeight = lastGoodWeight;
          } else if (Number.isFinite(lastGoodWeight)) {
            // During swirl, hold pre-swirl weight
            effectiveWeight = Number.isFinite(swirlStartHoldWeight) ? swirlStartHoldWeight : lastGoodWeight;
          }
        } else if (hasWeight && resampledWeight > UNSWIRL_THRESHOLD) {
          lastGoodWeight = resampledWeight;
        }

        // After swirl ends, hold post-swirl weight for 500ms
        if (!swirlActive && typeof swirlSpikeFilterUntil !== 'undefined' && elapsedMs < swirlSpikeFilterUntil && typeof swirlPostWeight !== 'undefined') {
          effectiveWeight = swirlPostWeight;
        } else if (!swirlActive && typeof swirlSpikeFilterUntil !== 'undefined' && elapsedMs >= swirlSpikeFilterUntil) {
          swirlSpikeFilterUntil = undefined;
          swirlPostWeight = undefined;
        }

        if (!swirlActive && swirlPendingEndMs !== null && elapsedMs >= swirlPendingEndMs) {
          const postSwirlWeight = getInterpolatedWeight(capture.startAt + swirlPendingEndMs);
          if (Number.isFinite(postSwirlWeight)) {
            lastGoodWeight = postSwirlWeight;
          }
          swirlPendingEndMs = null;
          swirlStartHoldWeight = null;
        }
      }

      // --- Pre-compute scale 2 interpolated weight (reused below and for first-drip) ---
      // Computed here — before the scale 2 block at the end — so first-drip detection
      // can use it without repeating the interpolation.
      let s2w = null;
      if (scale2RawSamples.length > 0) {
        const s2raw = getInterpolatedWeightScale2(capture.startAt + elapsedMs);
        s2w = Number.isFinite(s2raw) ? Math.max(0, Number(s2raw.toFixed(1))) : null;
      }

      // First drip: scale 2 (cup) when active → coffee has arrived in the cup.
      // Fall back to scale 1 (dripper) when only one scale is in use.
      const firstDripWeight = (isScale2Active() && Number.isFinite(s2w)) ? s2w : effectiveWeight;
      if (firstDripCapturedAt === null && Number.isFinite(firstDripWeight) && firstDripWeight > FIRST_DRIP_THRESHOLD) {
        firstDripCapturedAt = elapsedMs;
        syncFirstDripInputFromState();
        if (graphFirstDripEl) graphFirstDripEl.dispatchEvent(new Event("input", { bubbles: true }));
      }

      capture.samples.push({
        tMs: elapsedMs,
        w: Number.isFinite(effectiveWeight)
          ? Math.max(0, Number(effectiveWeight.toFixed(1)))
          : null,
      });

      const swirlGuardActive = unswirlEnabled && (swirlActive || (swirlPendingEndMs !== null && elapsedMs < swirlPendingEndMs));
      if (swirlGuardActive && Number.isFinite(lastGoodWeight)) {
        effectiveWeight = lastGoodWeight;
      }

      let flow = null;
      if (swirlGuardActive) {
        flowHistory.length = 0;
        flow = 0;
      } else if (Number.isFinite(effectiveWeight)) {
        flowHistory.push({ tMs: elapsedMs, w: effectiveWeight });
        const cutoff = elapsedMs - FLOW_WINDOW_MS;
        while (flowHistory.length && flowHistory[0].tMs < cutoff) {
          flowHistory.shift();
        }

        if (flowHistory.length >= 2) {
          let sumT = 0;
          let sumW = 0;
          let sumTT = 0;
          let sumTW = 0;
          for (const p of flowHistory) {
            const t = p.tMs / 1000;
            sumT += t;
            sumW += p.w;
            sumTT += t * t;
            sumTW += t * p.w;
          }
          const n = flowHistory.length;
          const denom = n * sumTT - sumT * sumT;
          if (denom !== 0) {
            const slope = (n * sumTW - sumT * sumW) / denom;
            flow = Number(slope.toFixed(1));
            // Clamp flow to zero or above
            if (Number.isFinite(flow) && flow < 0) {
              flow = 0;
            }
          }
        }
      }
      flowCapture.samples.push({
        tMs: elapsedMs,
        flow: Number.isFinite(flow) ? Math.max(0, flow) : flow,
      });
      if (Number.isFinite(flow) && (maxFlowCaptured === null || flow > maxFlowCaptured)) {
        maxFlowCaptured = flow;
        if (graphMaxFlowEl) {
          graphMaxFlowEl.value = flow.toFixed(1);
          graphMaxFlowEl.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }

      if (countPoursEnabled && !swirlGuardActive) {
        if (!pourActive && Number.isFinite(flow) && flow >= POUR_FLOW_THRESHOLD) {
          pourActive = true;
          pourStartMs = elapsedMs;
          pourStartWeight = Number.isFinite(effectiveWeight) ? effectiveWeight : lastGoodWeight;
          pourMaxFlow = flow;
        }

        if (pourActive && Number.isFinite(flow) && (pourMaxFlow === null || flow > pourMaxFlow)) {
          pourMaxFlow = flow;
        }

        if (pourActive && (!Number.isFinite(flow) || flow <= 0)) {
          const endWeight = Number.isFinite(effectiveWeight) ? effectiveWeight : lastGoodWeight;
          const durationSec = Math.max(0.001, (elapsedMs - pourStartMs) / 1000);
          const weightDiff = (Number.isFinite(pourStartWeight) && Number.isFinite(endWeight))
            ? (endWeight - pourStartWeight)
            : NaN;
          const avgFlow = Number.isFinite(weightDiff) ? (weightDiff / durationSec) : NaN;
          if (Number.isFinite(weightDiff) && weightDiff > 0) {
            const pourRecord = {
              count: pourCount + 1,
              startMs: pourStartMs,
              endMs: elapsedMs,
              weightDiff,
              avgFlow,
              maxFlow: pourMaxFlow
            };
            pours.push(pourRecord);
            pourCount += 1;
            renderEventLog();
          }
          pourActive = false;
          pourStartMs = null;
          pourStartWeight = null;
          pourMaxFlow = null;
        }
      }
      // --- Scale 2 weight + flow (resampled, same cadence as scale 1) ---
      // s2w was already interpolated above for first-drip detection; reuse it.
      if (scale2RawSamples.length > 0) {
        scale2Capture.samples.push({ tMs: elapsedMs, w: s2w });
        if (Number.isFinite(s2w)) {
          scale2FlowHistory.push({ tMs: elapsedMs, w: s2w });
          const s2cutoff = elapsedMs - FLOW_WINDOW_MS;
          while (scale2FlowHistory.length && scale2FlowHistory[0].tMs < s2cutoff) scale2FlowHistory.shift();
          let s2flow = null;
          if (scale2FlowHistory.length >= 2) {
            let sT = 0, sW = 0, sTT = 0, sTW = 0;
            for (const p of scale2FlowHistory) {
              const t = p.tMs / 1000;
              sT += t; sW += p.w; sTT += t * t; sTW += t * p.w;
            }
            const n = scale2FlowHistory.length;
            const denom = n * sTT - sT * sT;
            if (denom !== 0) s2flow = Math.max(0, Number(((n * sTW - sT * sW) / denom).toFixed(1)));
          }
          scale2FlowCapture.samples.push({ tMs: elapsedMs, flow: Number.isFinite(s2flow) ? s2flow : null });
        }
        // Scale 2 (cup) owns the live beverage-weight yield field when active.
        if (isScale2Active() && Number.isFinite(s2w)) updateLiveWeight(s2w);
      }

      setFlow(flow);

      const now = Date.now();
      if (now - lastCaptureUiRefreshAt >= CAPTURE_UI_UPDATE_INTERVAL_MS) {
        updateCaptureOutput();
        updateFlowOutput();
        updateRawOutput();
        renderGraph();
        lastCaptureUiRefreshAt = now;
      }
    }, 100);
  }

  function stopCapture() {
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
    updateCaptureOutput();
    updateFlowOutput();
    renderGraph();
  }

  function pauseCapture() {
    if (captureInterval) {
      clearInterval(captureInterval);
      captureInterval = null;
    }
  }

  function addRawSample(weight, timeMs) {
    rawSamples.push({ t: timeMs, w: weight });
    if (rawSamples.length > 2000) {
      rawSamples.splice(0, rawSamples.length - 2000);
    }
  }

  function getInterpolatedWeight(targetTime) {
    if (rawSamples.length === 0) return lastInterpolatedWeight;
    if (targetTime <= rawSamples[0].t) {
      lastInterpolatedWeight = rawSamples[0].w;
      return lastInterpolatedWeight;
    }
    if (targetTime >= rawSamples[rawSamples.length - 1].t) {
      lastInterpolatedWeight = rawSamples[rawSamples.length - 1].w;
      return lastInterpolatedWeight;
    }

    let i = 1;
    while (i < rawSamples.length && rawSamples[i].t < targetTime) {
      i++;
    }
    const prev = rawSamples[i - 1];
    const next = rawSamples[i];
    const span = next.t - prev.t;
    if (span <= 0) {
      lastInterpolatedWeight = prev.w;
      return lastInterpolatedWeight;
    }

    const ratio = (targetTime - prev.t) / span;
    lastInterpolatedWeight = prev.w + (next.w - prev.w) * ratio;
    return lastInterpolatedWeight;
  }

  function addScale2RawSample(weight, timeMs) {
    scale2RawSamples.push({ t: timeMs, w: weight });
    if (scale2RawSamples.length > 2000) {
      scale2RawSamples.splice(0, scale2RawSamples.length - 2000);
    }
  }

  function getInterpolatedWeightScale2(targetTime) {
    if (scale2RawSamples.length === 0) return scale2LastInterpolatedWeight;
    if (targetTime <= scale2RawSamples[0].t) {
      scale2LastInterpolatedWeight = scale2RawSamples[0].w;
      return scale2LastInterpolatedWeight;
    }
    if (targetTime >= scale2RawSamples[scale2RawSamples.length - 1].t) {
      scale2LastInterpolatedWeight = scale2RawSamples[scale2RawSamples.length - 1].w;
      return scale2LastInterpolatedWeight;
    }
    let i = 1;
    while (i < scale2RawSamples.length && scale2RawSamples[i].t < targetTime) { i++; }
    const prev = scale2RawSamples[i - 1];
    const next = scale2RawSamples[i];
    const span = next.t - prev.t;
    if (span <= 0) {
      scale2LastInterpolatedWeight = prev.w;
      return scale2LastInterpolatedWeight;
    }
    const ratio = (targetTime - prev.t) / span;
    scale2LastInterpolatedWeight = prev.w + (next.w - prev.w) * ratio;
    return scale2LastInterpolatedWeight;
  }

  function resetCaptureData() {
    capture = { startAt: null, samples: [] };
    flowCapture = { startAt: null, samples: [] };
    scale2Capture = { startAt: null, samples: [] };
    scale2RawSamples = [];
    scale2LastInterpolatedWeight = null;
    scale2FlowHistory = [];
    scale2FlowCapture = { startAt: null, samples: [] };
    flowPrevWeight = null;
    rawSamples = [];
    lastInterpolatedWeight = null;
    flowHistory = [];
    firstDripCapturedAt = null;
    maxFlowCaptured = null;
    autoStartPending = false;
    setTimerBlinking(false);
    swirlActive = false;
    swirlCount = 0;
    currentSwirlStartMs = null;
    swirls = [];
    lastGoodWeight = null;
    swirlStartHoldWeight = null;
    swirlPendingEndMs = null;
    pourActive = false;
    pourCount = 0;
    pourStartMs = null;
    pourStartWeight = null;
    pourMaxFlow = null;
    pours = [];
    renderEventLog();
    syncFirstDripInputFromState();
    setFlow(NaN);
    updateCaptureOutput();
    updateFlowOutput();
    updateRawOutput();
    renderGraph();
    onCaptureReset?.();
  }

  function setCaptureData(data) {
    if (!data) {
      resetCaptureData();
      return;
    }

    capture = data.capture || { startAt: null, samples: [] };
    flowCapture = data.flowCapture || { startAt: capture.startAt, samples: [] };
    scale2Capture = data.scale2Capture || { startAt: capture.startAt, samples: [] };
    scale2FlowCapture = data.scale2FlowCapture || { startAt: capture.startAt, samples: [] };
    scale2RawSamples = data.scale2RawCapture?.samples ? [...data.scale2RawCapture.samples] : [];
    scale2LastInterpolatedWeight = null;
    scale2FlowHistory = [];
    rawSamples = (data.rawCapture && data.rawCapture.samples) ? data.rawCapture.samples : [];
    firstDripCapturedAt = Number.isFinite(Number(data.firstDrip)) ? Number(data.firstDrip) * 1000 : null;
    flowPrevWeight = null;
    lastInterpolatedWeight = null;
    flowHistory = [];

    if (timerRunning && flowCapture.samples && flowCapture.samples.length) {
      const lastFlow = [...flowCapture.samples].reverse().find((s) => Number.isFinite(s.flow));
      setFlow(lastFlow ? lastFlow.flow : NaN);
    } else {
      setFlow(NaN);
    }

    updateCaptureOutput();
    updateFlowOutput();
    updateRawOutput();
    syncFirstDripInputFromState();
    renderGraph();
  }

  function getCaptureData() {
    if (!capture || (!capture.samples.length && !flowCapture.samples.length && !rawSamples.length)) {
      return null;
    }
    const rawCapture = { startAt: capture.startAt, samples: rawSamples };
    const result = { capture, flowCapture, rawCapture };
    if (scale2Capture.samples.length) result.scale2Capture = scale2Capture;
    if (scale2FlowCapture.samples.length) result.scale2FlowCapture = scale2FlowCapture;
    if (scale2RawSamples.length) result.scale2RawCapture = { startAt: scale2Capture.startAt, samples: scale2RawSamples };
    return JSON.parse(JSON.stringify(result));
  }

  function formatLiveTime(ms) {
    return Math.round(ms / 1000);
  }

  function updateLiveTime() {
    const timeField = document.getElementById("time");
    const now = Date.now();
    const elapsed = liveTimerElapsedMs + (liveTimerStartAt ? (now - liveTimerStartAt) : 0);
    const seconds = formatLiveTime(elapsed);
    const nextTimeValue = String(seconds);
    if (timeField) {
      if (timeField.value !== nextTimeValue) {
        timeField.value = nextTimeValue;
        timeField.dispatchEvent(new Event("input", { bubbles: true }));
      }
    }
    if (graphTimeEl) {
      const timeValue = timeField ? timeField.value : nextTimeValue;
      const nextGraphTime = `${timeValue} s`;
      if (graphTimeEl.textContent !== nextGraphTime) {
        graphTimeEl.textContent = nextGraphTime;
      }
    }
  }

  function startLiveTimer() {
    liveTimerStartAt = Date.now();
    lastLiveYieldInputDispatchAt = 0;
    updateLiveTime();
    if (liveTimerInterval) clearInterval(liveTimerInterval);
    liveTimerInterval = setInterval(updateLiveTime, 250);
  }

  function stopLiveTimer() {
    if (liveTimerInterval) {
      clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }
    if (liveTimerStartAt) {
      liveTimerElapsedMs += Date.now() - liveTimerStartAt;
      liveTimerStartAt = null;
    }
    updateLiveTime();
  }

  function resetLiveTimer() {
    liveTimerElapsedMs = 0;
    liveTimerStartAt = null;
    if (liveTimerInterval) {
      clearInterval(liveTimerInterval);
      liveTimerInterval = null;
    }
    pours = [];
    swirls = [];
    pourCount = 0;
    swirlCount = 0;
    renderEventLog();
    const timeField = document.getElementById("time");
    if (timeField) {
      timeField.value = 0;
      timeField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (graphTimeEl) {
      graphTimeEl.textContent = "0 s";
    }
    const outField = document.getElementById("inputYield");
    if (outField) {
      outField.value = "";
      if (graphInputYieldEl) graphInputYieldEl.value = "";
    }
  }

  function resetGraphMetrics() {
    syncFirstDripInputFromState();
    if (graphMaxFlowEl) graphMaxFlowEl.value = "";
    if (graphAvgFlowEl) graphAvgFlowEl.value = "";
    renderEventLog();
  }

  function renderEventLog() {
    if (!graphEventLogEl) return;
    if (!pours.length && !swirls.length) {
      graphEventLogEl.innerHTML = "";
      return;
    }
    const events = [];
    pours.forEach((pour, index) => {
      const startSec = Math.round(pour.startMs / 1000);
      const endSec = Math.round(pour.endMs / 1000);
      const lenSec = Math.max(0, endSec - startSec);
      const weightDiff = Number.isFinite(pour.weightDiff) ? `${pour.weightDiff.toFixed(1)}g` : "-";
      const avgFlow = Number.isFinite(pour.avgFlow) ? `${pour.avgFlow.toFixed(1)}g/s` : "-";
      const maxFlow = Number.isFinite(pour.maxFlow) ? `${pour.maxFlow.toFixed(1)}g/s` : "-";
      events.push({
        startMs: pour.startMs || 0,
        order: index,
        text: `Pour ${pour.count}: ${startSec} - ${endSec} (${lenSec}s / ${weightDiff} / ${avgFlow} / ${maxFlow})`
      });
    });
    swirls.forEach((swirl, index) => {
      const startSec = Math.round(swirl.startMs / 1000);
      const endSec = Math.round(swirl.endMs / 1000);
      const lenSec = Math.max(0, endSec - startSec);
      events.push({
        startMs: swirl.startMs || 0,
        order: index,
        text: `Swirl ${swirl.count}: ${startSec} - ${endSec} (${lenSec}s)`
      });
    });
    events.sort((a, b) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs;
      return a.order - b.order;
    });
    graphEventLogEl.innerHTML = events.map((event) => event.text).join("<br>");
  }

  function getRecipeSteps() {
    if (!pours.length && !swirls.length) return [];
    const events = [];
    pours.forEach((pour, index) => {
      events.push({
        type: "pour",
        count: pour.count,
        startMs: pour.startMs,
        endMs: pour.endMs,
        weightDiff: pour.weightDiff,
        avgFlow: pour.avgFlow,
        maxFlow: pour.maxFlow,
        order: index,
      });
    });
    swirls.forEach((swirl, index) => {
      events.push({
        type: "swirl",
        count: swirl.count,
        startMs: swirl.startMs,
        endMs: swirl.endMs,
        order: index,
      });
    });
    events.sort((a, b) => {
      if (a.startMs !== b.startMs) return a.startMs - b.startMs;
      return a.order - b.order;
    });
    return events.map((event) => {
      const cleaned = { ...event };
      delete cleaned.order;
      return cleaned;
    });
  }

  function setRecipeSteps(steps) {
    pours = [];
    swirls = [];
    if (Array.isArray(steps)) {
      steps.forEach((step) => {
        if (step?.type === "pour") {
          pours.push({
            count: Number.isFinite(step.count) ? step.count : pours.length + 1,
            startMs: step.startMs ?? null,
            endMs: step.endMs ?? null,
            weightDiff: step.weightDiff ?? NaN,
            avgFlow: step.avgFlow ?? NaN,
            maxFlow: step.maxFlow ?? NaN,
          });
        } else if (step?.type === "swirl") {
          swirls.push({
            count: Number.isFinite(step.count) ? step.count : swirls.length + 1,
            startMs: step.startMs ?? null,
            endMs: step.endMs ?? null,
          });
        }
      });
    }
    renderEventLog();
    renderGraph();
  }


  function setTimerRunningState(running, options = {}) {
    const { skipFinalizeMetrics = false } = options;
    timerRunning = running;
    if (timerBtn) timerBtn.textContent = timerRunning ? "Stop timer" : "Start timer";
    updateTimerIcon();
    if (connectTimerBtn) {
      connectTimerBtn.textContent = timerRunning ? "Stop timer" : "Start timer";
    }
    if (timerRunning) {
      startLiveTimer();
      startCapture();
      onTimerStateChange?.(true);
    } else {
      stopLiveTimer();
      stopCapture();
      onTimerStateChange?.(false);
      if (!skipFinalizeMetrics) {
        const outField = document.getElementById("inputYield");
        const timeField = document.getElementById("time");
        const finalWeight = outField ? parseFloat(outField.value) : NaN;
        const totalSeconds = timeField ? parseFloat(timeField.value) : NaN;
        if (graphAvgFlowEl) {
          if (Number.isFinite(finalWeight) && Number.isFinite(totalSeconds) && totalSeconds > 0) {
            const avgFlow = finalWeight / totalSeconds;
            graphAvgFlowEl.value = avgFlow.toFixed(1);
            graphAvgFlowEl.dispatchEvent(new Event("input", { bubbles: true }));
          }
        }
      }
      setFlow(NaN);
    }
  }

  /* ---- Scale 1 tare (via DeviceManager) ---- */
  if (tareBtn) {
    tareBtn.onclick = async () => {
      await DeviceManager.getDevice('scale')?.tare?.();
    };
  }
  if (connectTareBtn) {
    connectTareBtn.onclick = () => tareBtn?.onclick?.();
  }

  /* ---- Scale 1 timer (via DeviceManager) ---- */
  if (timerBtn) {
    timerBtn.onclick = async () => {
      const dev = DeviceManager.getDevice('scale');
      if (!dev?.isConnected) return;
      await dev.toggleTimer();
      setTimerRunningState(!timerRunning);
    };
  }
  if (connectTimerBtn) {
    connectTimerBtn.onclick = () => timerBtn?.onclick?.();
  }

  /* ---- Shared helper: tare + reset timer on every connected scale ---- */
  async function resetAllScaleDevices() {
    const dev1 = DeviceManager.getDevice('scale');
    const dev2 = DeviceManager.getDevice('scale2');
    await Promise.all([
      dev1?.isConnected ? (async () => { try { await dev1.tare(); await dev1.resetTimer(); } catch (e) { console.warn('Reset scale 1 failed', e); } })() : Promise.resolve(),
      dev2?.isConnected ? (async () => { try { await dev2.tare(); } catch (e) { console.warn('Reset scale 2 failed', e); } })() : Promise.resolve(),
    ]);
  }

  /* ---- Scale 1 reset timer (via DeviceManager) ---- */
  if (resetTimerBtn) {
    resetTimerBtn.onclick = async () => {
      await resetAllScaleDevices();
      setTimerRunningState(false, { skipFinalizeMetrics: true });
      resetLiveTimer();
      resetCaptureData();
      resetGraphMetrics();
    };
  }
  if (connectResetTimerBtn) {
    connectResetTimerBtn.onclick = () => resetTimerBtn?.onclick?.();
  }

  function handleWeighClick() {
    if (!isConnected) {
      openScaleModal?.();
      return;
    }

    if (!Number.isFinite(lastWeight)) {
      return;
    }

    const outField = document.getElementById("inputYield");
    const inField = document.getElementById("inputWeight");
    if (timerRunning || weighClickFromOut) {
      outField.value = lastWeight.toFixed(1);
      outField.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }

    if (inField) {
      inField.value = lastWeight.toFixed(1);
      inField.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  async function handleResetScaleClick() {
    if (!isConnected) {
      openScaleModal?.();
    }

    await resetAllScaleDevices();

    // Always clear local extraction state/graph, even when no scale is connected.
    setTimerRunningState(false, { skipFinalizeMetrics: true });
    resetLiveTimer();
    resetCaptureData();
    resetGraphMetrics();
  }

  async function handleTimerIconClick() {
    if (!isConnected) {
      openScaleModal?.();
      return;
    }

    const dev = DeviceManager.getDevice('scale');
    if (!dev?.isConnected) return;

    const autoStartEnabled = graphAutoStartToggle ? graphAutoStartToggle.checked : false;
    if (!timerRunning && autoStartEnabled) {
      autoStartPending = !autoStartPending;
      setTimerBlinking(autoStartPending);
      return;
    }

    try {
      await dev.toggleTimer();
      setTimerRunningState(!timerRunning);
    } catch (err) {
      console.warn("Timer icon command failed", err);
    }
  }

  function updateTimerIcon() {
    const timerTargets = [
      { button: document.getElementById("brewTimerBtn"), label: null },
      { button: document.getElementById("graphTimerBtn"), label: "span" }
    ];

    timerTargets.forEach(({ button, label }) => {
      if (!button) return;
      const timerIcon = button.querySelector("i");
      if (!timerIcon) return;
      if (timerRunning) {
        timerIcon.classList.remove("fa-play");
        timerIcon.classList.add("fa-pause");
        button.title = "Stop timer";
      } else {
        timerIcon.classList.remove("fa-pause");
        timerIcon.classList.add("fa-play");
        button.title = "Start timer";
      }

      if (label) {
        const labelEl = button.querySelector(label);
        if (labelEl) labelEl.textContent = timerRunning ? "Stop" : "Start";
      }
    });

    if (timerRunning) {
      setTimerBlinking(false);
    }
  }

  function setTimerBlinking(isBlinking) {
    const timerTargets = [
      document.getElementById("brewTimerBtn"),
      document.getElementById("graphTimerBtn")
    ];

    timerTargets.forEach((button) => {
      if (!button) return;
      const timerIcon = button.querySelector("i");
      if (!timerIcon) return;
      if (isBlinking) {
        timerIcon.classList.add("animate-pulse");
      } else {
        timerIcon.classList.remove("animate-pulse");
      }
    });
  }

  async function triggerAutoStartTimer() {
    if (!autoStartPending || timerRunning) return;
    const dev = DeviceManager.getDevice('scale');
    if (!dev?.isConnected) return;
    try {
      await dev.startTimer();
      autoStartPending = false;
      setTimerRunningState(true);
      setTimerBlinking(false);
    } catch (err) {
      console.warn("Auto start failed", err);
    }
  }

  function bindBrewFormControls() {
    const weighBtn = document.getElementById("brewWeighBtn");
    if (weighBtn && weighBtn.dataset.scaleBound !== "true") {
      weighBtn.dataset.scaleBound = "true";
      weighBtn.addEventListener("pointerdown", () => {
        const outField = document.getElementById("inputYield");
        weighClickFromOut = document.activeElement === outField;
      });
      weighBtn.addEventListener("click", handleWeighClick);
    }

    const resetScaleBtn = document.getElementById("brewResetScaleBtn");
    if (resetScaleBtn && resetScaleBtn.dataset.scaleBound !== "true") {
      resetScaleBtn.dataset.scaleBound = "true";
      resetScaleBtn.addEventListener("click", handleResetScaleClick);
    }

    const timerIconBtn = document.getElementById("brewTimerBtn");
    if (timerIconBtn && timerIconBtn.dataset.scaleBound !== "true") {
      timerIconBtn.dataset.scaleBound = "true";
      timerIconBtn.addEventListener("click", handleTimerIconClick);
    }
  }

  bindBrewFormControls();

  // Subscribe to Scale 1 events via DeviceManager
  DeviceManager.onConnectionChange('scale', (connected) => {
    isConnected = connected;
    if (connected) {
      const dev = DeviceManager.getDevice('scale');
      dev?.onTimerStateChange?.((running) => setTimerRunningState(running));
      if (tareBtn) tareBtn.disabled = false;
      if (timerBtn) timerBtn.disabled = false;
      if (resetTimerBtn) resetTimerBtn.disabled = false;
      if (connectTareBtn) connectTareBtn.disabled = false;
      if (connectTimerBtn) connectTimerBtn.disabled = false;
      if (connectResetTimerBtn) connectResetTimerBtn.disabled = false;
      setStatus(`Connected to ${DeviceManager.getDeviceName('scale') || 'scale'}`);
    } else {
      const wasRunning = timerRunning;
      timerRunning = false;
      updateTimerIcon();
      pauseCapture();
      if (wasRunning) stopLiveTimer();
      setStatus('Disconnected');
      setWeight(NaN);
      if (tareBtn) tareBtn.disabled = true;
      if (timerBtn) timerBtn.disabled = true;
      if (resetTimerBtn) resetTimerBtn.disabled = true;
      if (connectTareBtn) connectTareBtn.disabled = true;
      if (connectTimerBtn) connectTimerBtn.disabled = true;
      if (connectResetTimerBtn) connectResetTimerBtn.disabled = true;
    }
  });
  DeviceManager.onValueChange('scale', (weight) => {
    if (Number.isFinite(weight)) setWeight(weight);
  });
  DeviceManager.onValueChange('scale2', (weight) => {
    if (Number.isFinite(weight)) addScale2RawSample(weight, Date.now());
  });
  DeviceManager.onStatusChange('scale', (status) => setStatus(status));

  function bindGraphModalControls() {
    refreshGraphDomRefs();

    const graphWeighBtn = document.getElementById("graphWeighBtn");
    if (graphWeighBtn && graphWeighBtn.dataset.scaleBound !== "true") {
      graphWeighBtn.dataset.scaleBound = "true";
      graphWeighBtn.addEventListener("pointerdown", () => {
        const outField = document.getElementById("inputYield");
        weighClickFromOut = document.activeElement === outField;
      });
      graphWeighBtn.addEventListener("click", handleWeighClick);
    }

    const graphResetScaleBtn = document.getElementById("graphResetScaleBtn");
    if (graphResetScaleBtn && graphResetScaleBtn.dataset.scaleBound !== "true") {
      graphResetScaleBtn.dataset.scaleBound = "true";
      graphResetScaleBtn.addEventListener("click", handleResetScaleClick);
    }

    const graphTimerBtn = document.getElementById("graphTimerBtn");
    if (graphTimerBtn && graphTimerBtn.dataset.scaleBound !== "true") {
      graphTimerBtn.dataset.scaleBound = "true";
      graphTimerBtn.addEventListener("click", handleTimerIconClick);
    }

    if (graphAutoStartToggle && graphAutoStartToggle.dataset.scaleBound !== "true") {
      graphAutoStartToggle.dataset.scaleBound = "true";
      graphAutoStartToggle.addEventListener("change", () => {
        if (!graphAutoStartToggle.checked && autoStartPending) {
          autoStartPending = false;
          setTimerBlinking(false);
        }
        saveGraphTogglePrefsForMethod();
      });
    }

    if (graphUnswirlToggle && graphUnswirlToggle.dataset.scaleBound !== "true") {
      graphUnswirlToggle.dataset.scaleBound = "true";
      graphUnswirlToggle.addEventListener("change", () => {
        unswirlEnabled = graphUnswirlToggle.checked;
        if (!unswirlEnabled) {
          swirlActive = false;
          currentSwirlStartMs = null;
        } else if (Number.isFinite(lastWeight) && lastWeight > UNSWIRL_THRESHOLD) {
          lastGoodWeight = lastWeight;
        }
        saveGraphTogglePrefsForMethod();
      });
    }

    if (graphCountPoursToggle && graphCountPoursToggle.dataset.scaleBound !== "true") {
      graphCountPoursToggle.dataset.scaleBound = "true";
      graphCountPoursToggle.addEventListener("change", () => {
        countPoursEnabled = graphCountPoursToggle.checked;
        if (!countPoursEnabled) {
          pourActive = false;
          pourStartMs = null;
          pourStartWeight = null;
        }
        saveGraphTogglePrefsForMethod();
      });
    }

    if (graphFirstDripEl && graphFirstDripEl.dataset.scaleBound !== "true") {
      graphFirstDripEl.dataset.scaleBound = "true";
      graphFirstDripEl.addEventListener("input", () => {
        const value = graphFirstDripEl.value;
        if (value === "") {
          firstDripCapturedAt = null;
        } else {
          const parsed = Number(value);
          firstDripCapturedAt = Number.isFinite(parsed) ? parsed * 1000 : firstDripCapturedAt;
        }
        renderGraph();
      });
    }
  }

  // Keep references for event listener binding; re-query at runtime in case
  // the brew form modal is mounted lazily (after initCoffeeScale runs).
  let inField = document.getElementById("inputWeight");
  let outField = document.getElementById("inputYield");
  let ratioField = document.getElementById("inputRatio");
  const syncGraphRecipeFields = () => {
    // Always do a live lookup so stale null refs (brew form mounted after
    // initCoffeeScale) don't silently prevent the sync.
    const curInField = document.getElementById("inputWeight");
    const curOutField = document.getElementById("inputYield");
    const curRatioField = document.getElementById("inputRatio");
    // Refresh live listener refs if they were null at init time
    if (!inField && curInField) {
      inField = curInField;
      inField.addEventListener("input", syncGraphRecipeFields);
    }
    if (!outField && curOutField) {
      outField = curOutField;
      outField.addEventListener("input", syncGraphRecipeFields);
    }
    if (!ratioField && curRatioField) {
      ratioField = curRatioField;
    }
    refreshGraphDomRefs();
    if (graphInputWeightEl && curInField) graphInputWeightEl.value = curInField.value;
    if (graphInputRatioEl && curRatioField) {
      const src = curRatioField.querySelector('span:last-child');
      const dst = graphInputRatioEl.querySelector('span:last-child');
      if (src && dst) dst.textContent = src.textContent;
    }
    if (graphInputYieldEl && curOutField) graphInputYieldEl.value = curOutField.value;
  };
  const syncGraphTimeFromForm = () => {
    refreshGraphDomRefs();
    if (!graphTimeEl) return;
    const timeField = document.getElementById("time");
    const timeValue = timeField ? (timeField.value || 0) : 0;
    graphTimeEl.textContent = `${timeValue} s`;
  };
  const syncGraphFormFields = () => {
    syncGraphRecipeFields();
    syncGraphTimeFromForm();
  };
  if (inField) inField.addEventListener("input", syncGraphRecipeFields);
  if (ratioField) ratioField.addEventListener("input", syncGraphRecipeFields);
  if (outField) outField.addEventListener("input", syncGraphRecipeFields);
  bindGraphModalControls();
  syncGraphRecipeFields();
  syncGraphTimeFromForm();
  applyGraphTogglePrefsForMethod();
  if (inField) {
    inField.addEventListener("focus", () => {
      lastFocusedField = "in";
    });
  }
  if (outField) {
    outField.addEventListener("focus", () => {
      lastFocusedField = "out";
    });
  }
  function setGraphTogglePrefs(prefs) {
    const next = prefs && typeof prefs === "object" ? { ...prefs } : {};
    if (Object.prototype.hasOwnProperty.call(next, "__none__")) {
      if (!Object.prototype.hasOwnProperty.call(next, GRAPH_TOGGLE_NONE_KEY)) {
        next[GRAPH_TOGGLE_NONE_KEY] = next["__none__"];
      }
      delete next["__none__"];
    }
    graphTogglePrefs = next;
  }

  function setGraphTogglePrefsSaver(fn) {
    graphTogglePrefsSaver = fn;
  }

  coffeeScaleApi = {
    isConnected: () => isConnected,
    getLastWeight: () => lastWeight,
    autoConnect: () => DeviceManager.autoConnect('scale'),
    bindBrewFormControls,
    getCaptureData,
    setCaptureData,
    resetCaptureData,
    syncGraphFormFields,
    bindGraphModalControls,
    renderGraphTo,
    applyGraphTogglePrefsForMethod,
    setGraphTogglePrefs,
    setGraphTogglePrefsSaver,
    getFirstDripSeconds: getFirstDripSecondsFromState,
    setFirstDripSeconds,
    getGraphEventStats: () => {
      const pourCountValue = pours.length;
      const swirlCountValue = swirls.length;
      let bloomTime = null;
      if (pours.length) {
        const firstPour = pours[0];
        if (Number.isFinite(firstPour?.startMs) && Number.isFinite(firstPour?.endMs)) {
          bloomTime = Math.max(0, (firstPour.endMs - firstPour.startMs) / 1000);
        }
      }
      return {
        pourCount: pourCountValue,
        swirlCount: swirlCountValue,
        bloomTime
      };
    },
    getRecipeSteps,
    setRecipeSteps
  };

  return coffeeScaleApi;
}
