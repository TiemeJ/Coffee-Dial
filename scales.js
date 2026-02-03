export function initCoffeeScale() {
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
  const graphTimeEl = document.getElementById("graphTime");
  const captureOutputEl = document.getElementById("captureOutput");
  const flowOutputEl = document.getElementById("flowOutput");
  const rawOutputEl = document.getElementById("rawOutput");
  const graphEl = document.getElementById("graph");
  const graphInputWeightEl = document.getElementById("graphInputWeight");
  const graphInputRatioEl = document.getElementById("graphInputRatio");
  const graphInputYieldEl = document.getElementById("graphInputYield");
  let liveTimerInterval = null;
  let liveTimerStartAt = null;
  let liveTimerElapsedMs = 0;

  if (!statusEl || !weightEl || !tareBtn || !timerBtn || !resetTimerBtn || !connectBtn) {
    return;
  }

  let device;
  let server;
  let notifyChar;
  let writeChar;
  let scaleType = "UNKNOWN"; // OLD, NEW, GENERIC

  let heartbeatTimer;
  let lastPacketAt = 0;
  let timerRunning = false;
  let acaiaBuffer = new Uint8Array(0);
  let writeQueue = Promise.resolve();
  let writeInProgress = false;
  let lastWeight = null;
  let isConnected = false;
  let lastFocusedField = null;
  let autoConnectInProgress = false;
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
  const FLOW_WINDOW_MS = 2000;

  /* ---- Acaia/Bookoo UUIDs (Beanconqueror-compatible) ---- */
  const ACAIA_SERVICE_UUID = "00001820-0000-1000-8000-00805f9b34fb";
  const READ_CHAR_OLD_UUID = "00002a80-0000-1000-8000-00805f9b34fb";
  const WRITE_CHAR_OLD_UUID = "00002a80-0000-1000-8000-00805f9b34fb";
  const PYXIS_SERVICE_UUID = "49535343-fe7d-4ae5-8fa9-9fafd205e455";
  const READ_CHAR_NEW_UUID = "49535343-1e4d-4bd9-ba61-23c647249616";
  const WRITE_CHAR_NEW_UUID = "49535343-8841-43f4-a8d4-ecbe34729bb3";
  const READ_CHAR_GENERIC_UUID = "0000ff11-0000-1000-8000-00805f9b34fb";
  const WRITE_CHAR_GENERIC_UUID = "0000ff12-0000-1000-8000-00805f9b34fb";
  const BOOKOO_SERVICE_UUID = "00000ffe-0000-1000-8000-00805f9b34fb";
  const GENERIC_SERVICE_UUID = "0000ff10-0000-1000-8000-00805f9b34fb";

  const HEARTBEAT_PERIOD_MS = 2750;
  const MAX_PACKET_PERIOD_MS = 5000;

  /* ---- Commands (AcaiaArduinoBLE) ---- */
  const IDENTIFY = new Uint8Array([0xef, 0xdd, 0x0b, 0x30, 0x31, 0x32, 0x33, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x30, 0x31, 0x32, 0x33, 0x34, 0x9a, 0x6d]);
  const HEARTBEAT = new Uint8Array([0xef, 0xdd, 0x00, 0x02, 0x00, 0x02, 0x00]);
  const NOTIFICATION_REQUEST = new Uint8Array([0xef, 0xdd, 0x0c, 0x09, 0x00, 0x01, 0x01, 0x02, 0x02, 0x05, 0x03, 0x04, 0x15, 0x06]);
  const TARE_ACAIA = new Uint8Array([0xef, 0xdd, 0x04, 0x00, 0x00, 0x00]);
  const TARE_GENERIC = new Uint8Array([0x03, 0x0a, 0x01, 0x00, 0x00, 0x08]);
  const START_TIMER_ACAIA = new Uint8Array([0xef, 0xdd, 0x0d, 0x00, 0x00, 0x00, 0x00]);
  const STOP_TIMER_ACAIA = new Uint8Array([0xef, 0xdd, 0x0d, 0x00, 0x02, 0x00, 0x02]);
  const RESET_TIMER_ACAIA = new Uint8Array([0xef, 0xdd, 0x0d, 0x00, 0x01, 0x00, 0x01]);
  const START_TIMER_BOOKOO = new Uint8Array([0x03, 0x0a, 0x04, 0x00, 0x00, 0x0a]);
  const STOP_TIMER_BOOKOO = new Uint8Array([0x03, 0x0a, 0x05, 0x00, 0x00, 0x0d]);
  const RESET_TIMER_BOOKOO = new Uint8Array([0x03, 0x0a, 0x06, 0x00, 0x00, 0x0c]);

  /* ---- UI helpers ---- */
  function setStatus(text) {
    statusEl.textContent = text;
    if (connectStatusEl) connectStatusEl.textContent = text;
  }

  function setWeight(value) {
    weightEl.textContent = value.toFixed(1) + " g";
    if (connectWeightEl) connectWeightEl.textContent = value.toFixed(1) + " g";
    lastWeight = value;
    updateLiveWeight(value);
    if (timerRunning) {
      addRawSample(value, Date.now());
    }
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
    outField.value = value.toFixed(1);
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

  function renderGraphTo(targetEl, dataOverride = null) {
    if (!targetEl) return;
    const ctx = targetEl.getContext("2d");
    const width = targetEl.clientWidth || 320;
    const height = targetEl.clientHeight || 220;
    if (targetEl.width !== width) targetEl.width = width;
    if (targetEl.height !== height) targetEl.height = height;

    ctx.clearRect(0, 0, width, height);

    const padding = { left: 40, right: 40, top: 20, bottom: 30 };
    const plotW = width - padding.left - padding.right;
    const plotH = height - padding.top - padding.bottom;

    const captureData = dataOverride?.capture || capture;
    const flowData = dataOverride?.flowCapture || flowCapture;
    const samples = captureData.samples || [];
    const flowSamples = flowData.samples || [];
    if (!samples.length && !flowSamples.length) {
      ctx.fillStyle = "#999";
      ctx.font = "12px system-ui";
      ctx.fillText("No data", padding.left, padding.top + 12);
      return;
    }

    const allTimes = samples.map((s) => s.tMs).concat(flowSamples.map((s) => s.tMs));
    const minT = Math.min(...allTimes);
    const maxT = Math.max(...allTimes);
    const spanT = Math.max(1, maxT - minT);

    const weightVals = samples.map((s) => s.w).filter((v) => Number.isFinite(v));
    const flowVals = flowSamples.map((s) => s.flow).filter((v) => Number.isFinite(v));

    let minW = weightVals.length ? Math.min(...weightVals) : 0;
    let maxW = weightVals.length ? Math.max(...weightVals) : 1;
    let minF = flowVals.length ? Math.min(...flowVals) : 0;
    let maxF = flowVals.length ? Math.max(...flowVals) : 1;

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

    ctx.fillStyle = "#666";
    ctx.font = "12px system-ui";
    ctx.fillText(`${minW.toFixed(1)} g`, 4, padding.top + plotH);
    ctx.fillText(`${maxW.toFixed(1)} g`, 4, padding.top + 10);
    ctx.fillText(`${maxF.toFixed(1)} g/s`, width - 50, padding.top + 10);
    ctx.fillText(`${minF.toFixed(1)} g/s`, width - 50, padding.top + plotH);

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

    ctx.fillStyle = "#2563eb";
    ctx.fillRect(padding.left, height - 18, 10, 2);
    ctx.fillStyle = "#16a34a";
    ctx.fillRect(padding.left + 70, height - 18, 10, 2);
    ctx.fillStyle = "#444";
    ctx.fillText("Weight", padding.left + 15, height - 14);
    ctx.fillText("Flow", padding.left + 85, height - 14);
  }

  function renderGraph() {
    renderGraphTo(graphEl);
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
    flowPrevWeight = null;
    rawSamples = [];
    lastInterpolatedWeight = null;
    flowHistory = [];
    updateCaptureOutput();
    updateFlowOutput();
    updateRawOutput();
    renderGraph();

    if (captureInterval) {
      clearInterval(captureInterval);
    }

    captureInterval = setInterval(() => {
      if (!capture.startAt) return;
      const elapsedMs = Date.now() - capture.startAt;
      const targetTime = capture.startAt + elapsedMs;
      const resampledWeight = getInterpolatedWeight(targetTime);

      capture.samples.push({
        tMs: elapsedMs,
        w: Number.isFinite(resampledWeight)
          ? Number(resampledWeight.toFixed(1))
          : null,
      });

      let flow = null;
      if (Number.isFinite(resampledWeight)) {
        flowHistory.push({ tMs: elapsedMs, w: resampledWeight });
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
          }
        }
      }
      flowCapture.samples.push({
        tMs: elapsedMs,
        flow,
      });
      setFlow(flow);

      updateCaptureOutput();
      updateFlowOutput();
      updateRawOutput();
      renderGraph();
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
    updateRawOutput();
    renderGraph();
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

  function resetCaptureData() {
    capture = { startAt: null, samples: [] };
    flowCapture = { startAt: null, samples: [] };
    flowPrevWeight = null;
    rawSamples = [];
    lastInterpolatedWeight = null;
    flowHistory = [];
    setFlow(NaN);
    updateCaptureOutput();
    updateFlowOutput();
    updateRawOutput();
    renderGraph();
  }

  function setCaptureData(data) {
    if (!data) {
      resetCaptureData();
      return;
    }

    capture = data.capture || { startAt: null, samples: [] };
    flowCapture = data.flowCapture || { startAt: capture.startAt, samples: [] };
    rawSamples = (data.rawCapture && data.rawCapture.samples) ? data.rawCapture.samples : [];
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
    renderGraph();
  }

  function getCaptureData() {
    if (!capture || (!capture.samples.length && !flowCapture.samples.length && !rawSamples.length)) {
      return null;
    }
    const rawCapture = { startAt: capture.startAt, samples: rawSamples };
    return JSON.parse(JSON.stringify({
      capture,
      flowCapture,
      rawCapture
    }));
  }

  function formatLiveTime(ms) {
    return Math.round(ms / 1000);
  }

  function updateLiveTime() {
    const timeField = document.getElementById("time");
    const now = Date.now();
    const elapsed = liveTimerElapsedMs + (liveTimerStartAt ? (now - liveTimerStartAt) : 0);
    if (timeField) {
      timeField.value = formatLiveTime(elapsed);
      timeField.dispatchEvent(new Event("input", { bubbles: true }));
    }
    if (graphTimeEl) {
      const timeValue = timeField ? timeField.value : formatLiveTime(elapsed);
      graphTimeEl.textContent = `${timeValue} s`;
    }
  }

  function startLiveTimer() {
    liveTimerStartAt = Date.now();
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
      outField.value = 0;
      outField.dispatchEvent(new Event("input", { bubbles: true }));
    }
  }

  function enqueueWrite(data) {
    if (!writeChar) return Promise.resolve();
    writeQueue = writeQueue
      .then(async () => {
        writeInProgress = true;
        await writeChar.writeValue(data);
      })
      .catch(() => {})
      .finally(() => {
        writeInProgress = false;
      });
    return writeQueue;
  }

  function appendAcaiaBuffer(chunk) {
    if (!chunk || chunk.length === 0) return;
    const merged = new Uint8Array(acaiaBuffer.length + chunk.length);
    merged.set(acaiaBuffer, 0);
    merged.set(chunk, acaiaBuffer.length);
    acaiaBuffer = merged;
  }

  function consumeAcaiaBuffer(startIndex) {
    if (startIndex <= 0) return;
    acaiaBuffer = acaiaBuffer.slice(startIndex);
  }

  function parseAcaiaMessages() {
    let offset = 0;
    while (offset < acaiaBuffer.length - 6) {
      let start = -1;
      for (let i = offset; i < acaiaBuffer.length - 1; i++) {
        if (acaiaBuffer[i] === 0xef && acaiaBuffer[i + 1] === 0xdd) {
          start = i;
          break;
        }
      }

      if (start < 0) {
        acaiaBuffer = new Uint8Array(0);
        return;
      }

      const payloadLen = acaiaBuffer[start + 3];
      const messageEnd = start + payloadLen + 5;
      if (messageEnd > acaiaBuffer.length) {
        consumeAcaiaBuffer(start);
        return;
      }

      const cmd = acaiaBuffer[start + 2];
      if (cmd === 0x0c) {
        const msgType = acaiaBuffer[start + 4];
        if (msgType === 0x08) {
          const payload = acaiaBuffer.slice(start + 5, messageEnd);
          if (payload.length >= 2) {
            const p0 = payload[0];
            const p1 = payload[1];
            let matched = false;
            if (p0 === 0x08 && p1 === 0x05) {
              setTimerRunningState(true);
              matched = true;
            } else if (p0 === 0x0a && p1 === 0x07) {
              setTimerRunningState(false);
              matched = true;
            } else if (p0 === 0x09 && p1 === 0x07) {
              setTimerRunningState(false);
              matched = true;
            }

            if (!matched && timerRunning) {
              // Some Lunar firmware reports stop as unknown; mirror Beanconqueror fallback
              setTimerRunningState(false);
            }
          }
        }
      }

      offset = messageEnd;
    }

    if (offset > 0) {
      consumeAcaiaBuffer(offset);
    }
  }

  function setTimerRunningState(running) {
    timerRunning = running;
    timerBtn.textContent = timerRunning ? "Stop Timer" : "Start Timer";
    updateTimerIcon();
    if (connectTimerBtn) {
      connectTimerBtn.textContent = timerRunning ? "Stop Timer" : "Start Timer";
    }
    if (timerRunning) {
      startLiveTimer();
      startCapture();
    } else {
      stopLiveTimer();
      stopCapture();
      setFlow(NaN);
    }
  }

  function handleAcaiaTimerEvent(data) {
    appendAcaiaBuffer(data);
    parseAcaiaMessages();
    return true;
  }

  function handleBookooTimerEvent(data) {
    // Some Bookoo variants send button events as short frames
    if (data.length >= 3 && data[0] === 0x03 && data[1] === 0x0a) {
      if (data[2] === 0x04) {
        setTimerRunningState(true);
        return true;
      }
      if (data[2] === 0x05 || data[2] === 0x06) {
        setTimerRunningState(false);
        return true;
      }
    }
    return false;
  }

  function applyConnectedState() {
    tareBtn.disabled = false;
    timerBtn.disabled = false;
    resetTimerBtn.disabled = false;
    timerBtn.textContent = "Start Timer";
    if (connectTareBtn) connectTareBtn.disabled = false;
    if (connectTimerBtn) connectTimerBtn.disabled = false;
    if (connectResetTimerBtn) connectResetTimerBtn.disabled = false;
    if (connectTimerBtn) connectTimerBtn.textContent = "Start Timer";
    timerRunning = false;
  }

  async function connectToCurrentDevice() {
    if (!device) return;
    device.addEventListener(
      "gattserverdisconnected",
      onDisconnected
    );
    server = await device.gatt.connect();
    setStatus("Connected to " + device.name);
    await setupGatt();
    applyConnectedState();
  }

  async function attemptAutoConnect() {
    if (isConnected || autoConnectInProgress) return;
    if (!device || !device.gatt) return;
    if (device.gatt.connected) {
      isConnected = true;
      return;
    }

    autoConnectInProgress = true;
    try {
      setStatus("Connecting...");
      await connectToCurrentDevice();
    } catch (err) {
      console.warn("Auto connect failed", err);
      setStatus("Disconnected");
    } finally {
      autoConnectInProgress = false;
    }
  }

  /* ---- Connect ---- */
  const handleConnectClick = async () => {
    if (!navigator.bluetooth) {
      alert("Web Bluetooth not supported");
      return;
    }

    try {
      setStatus("Requesting device...");

      device = await navigator.bluetooth.requestDevice({
        filters: [
          { namePrefix: "ACAIA" },
          { namePrefix: "Acaia" },
          { namePrefix: "PEARL" },
          { namePrefix: "LUNAR" },
          { namePrefix: "BOOKOO" },
          { namePrefix: "BOOKO" },
          { namePrefix: "CINCO" },
          { namePrefix: "PYXIS" },
          { namePrefix: "PROCH" }
        ],
        optionalServices: [
          ACAIA_SERVICE_UUID,
          PYXIS_SERVICE_UUID,
          BOOKOO_SERVICE_UUID,
          GENERIC_SERVICE_UUID,
          "00001800-0000-1000-8000-00805f9b34fb",
          "00001801-0000-1000-8000-00805f9b34fb",
          "0000180a-0000-1000-8000-00805f9b34fb",
          "0000180f-0000-1000-8000-00805f9b34fb"
        ]
      });

      device.addEventListener("gattserverdisconnected", onDisconnected);

      await connectToCurrentDevice();
    } catch (err) {
      console.error(err);
      setStatus("Connection failed");
    }
  };

  connectBtn.onclick = handleConnectClick;
  if (connectConnectBtn) connectConnectBtn.onclick = handleConnectClick;

  /* ---- GATT setup ---- */
  async function setupGatt() {
    const services = await server.getPrimaryServices();

    let oldChar = null;
    let newReadChar = null;
    let newWriteChar = null;
    let genericReadChar = null;
    let genericWriteChar = null;
    for (const service of services) {
      const chars = await service.getCharacteristics();
      for (const char of chars) {
        const uuid = char.uuid.toLowerCase();
        if (uuid === READ_CHAR_OLD_UUID) {
          oldChar = char;
        } else if (uuid === READ_CHAR_NEW_UUID) {
          newReadChar = char;
        } else if (uuid === WRITE_CHAR_NEW_UUID) {
          newWriteChar = char;
        } else if (uuid === READ_CHAR_GENERIC_UUID) {
          genericReadChar = char;
        } else if (uuid === WRITE_CHAR_GENERIC_UUID) {
          genericWriteChar = char;
        }
      }
    }

    if (newReadChar && newWriteChar) {
      scaleType = "NEW";
      notifyChar = newReadChar;
      writeChar = newWriteChar;
    } else if (oldChar) {
      scaleType = "OLD";
      notifyChar = oldChar;
      writeChar = oldChar;
    } else if (genericReadChar && genericWriteChar) {
      scaleType = "GENERIC";
      notifyChar = genericReadChar;
      writeChar = genericWriteChar;
    } else {
      setStatus("No compatible Acaia/Bookoo characteristics found");
      return;
    }

    await notifyChar.startNotifications();
    notifyChar.addEventListener("characteristicvaluechanged", onNotify);

    if (scaleType === "OLD" || scaleType === "NEW") {
      await enqueueWrite(IDENTIFY);
      await enqueueWrite(NOTIFICATION_REQUEST);
      startHeartbeat();
    }

    isConnected = true;
    setStatus(`Connected to ${device.name} (${scaleType})`);
  }

  /* ---- Notification handler ---- */
  function onNotify(event) {
    const data = new Uint8Array(event.target.value.buffer);
    const l = data.length;

    if (scaleType === "OLD" || scaleType === "NEW") {
      handleAcaiaTimerEvent(data);
    } else if (scaleType === "GENERIC") {
      handleBookooTimerEvent(data);
    }

    let weight = null;

    if ((scaleType === "NEW") && (l === 13 || l === 17) && data[4] === 0x05) {
      const raw = ((data[6] & 0xff) << 8) + (data[5] & 0xff);
      const unit = data[9];
      const sign = (data[10] & 0x02) ? -1 : 1;
      weight = (raw / Math.pow(10, unit)) * sign;
    } else if ((scaleType === "OLD") && (l === 10 || l === 14)) {
      const raw = ((data[3] & 0xff) << 8) + (data[2] & 0xff);
      const unit = data[6];
      const sign = (data[7] & 0x02) ? -1 : 1;
      weight = (raw / Math.pow(10, unit)) * sign;
    } else if ((scaleType === "GENERIC") && l === 20) {
      const raw = ((data[7] & 0xff) << 16) | ((data[8] & 0xff) << 8) | (data[9] & 0xff);
      const sign = (data[6] === 45) ? -1 : 1;
      weight = (raw / 100) * sign;
    }

    if (weight !== null && Number.isFinite(weight)) {
      setWeight(weight);
      lastPacketAt = Date.now();
    }
  }

  /* ---- Tare ---- */
  tareBtn.onclick = async () => {
    if (!writeChar) return;

    try {
      await enqueueWrite(scaleType === "GENERIC" ? TARE_GENERIC : TARE_ACAIA);
    } catch (err) {
      console.warn("Tare failed", err);
    }
  };

  if (connectTareBtn) {
    connectTareBtn.onclick = () => tareBtn.onclick();
  }

  /* ---- Timer ---- */
  timerBtn.onclick = async () => {
    if (!writeChar) return;

    try {
      if (scaleType === "OLD" || scaleType === "NEW") {
        await enqueueWrite(timerRunning ? STOP_TIMER_ACAIA : START_TIMER_ACAIA);
      } else if (scaleType === "GENERIC") {
        await enqueueWrite(timerRunning ? STOP_TIMER_BOOKOO : START_TIMER_BOOKOO);
      } else {
        return;
      }

      setTimerRunningState(!timerRunning);
    } catch (err) {
      console.warn("Timer command failed", err);
    }
  };

  if (connectTimerBtn) {
    connectTimerBtn.onclick = () => timerBtn.onclick();
  }

  /* ---- Reset Timer ---- */
  resetTimerBtn.onclick = async () => {
    if (!writeChar) return;

    try {
      if (scaleType === "OLD" || scaleType === "NEW") {
        await enqueueWrite(RESET_TIMER_ACAIA);
      } else if (scaleType === "GENERIC") {
        await enqueueWrite(RESET_TIMER_BOOKOO);
      } else {
        return;
      }

      setTimerRunningState(false);
      resetLiveTimer();
      resetCaptureData();
    } catch (err) {
      console.warn("Reset timer failed", err);
    }
  };

  if (connectResetTimerBtn) {
    connectResetTimerBtn.onclick = () => resetTimerBtn.onclick();
  }

  /* ---- Disconnect ---- */
  function onDisconnected() {
    const wasRunning = timerRunning;
    setStatus("Disconnected");
    tareBtn.disabled = true;
    timerBtn.disabled = true;
    resetTimerBtn.disabled = true;
    timerBtn.textContent = "Start Timer";
    timerRunning = false;
    isConnected = false;
    updateTimerIcon();
    pauseCapture();
    
    if (wasRunning) {
        stopLiveTimer();
    }

    weightEl.textContent = "--.- g";
    if (connectWeightEl) connectWeightEl.textContent = "--.- g";
    if (connectTareBtn) connectTareBtn.disabled = true;
    if (connectTimerBtn) connectTimerBtn.disabled = true;
    if (connectResetTimerBtn) connectResetTimerBtn.disabled = true;
    if (connectTimerBtn) connectTimerBtn.textContent = "Start Timer";
    stopHeartbeat();
  }

  function startHeartbeat() {
    stopHeartbeat();
    heartbeatTimer = setInterval(async () => {
      if (!writeChar || (scaleType !== "OLD" && scaleType !== "NEW")) return;
      if (writeInProgress) return;
      if (lastPacketAt && Date.now() - lastPacketAt > MAX_PACKET_PERIOD_MS) {
        setStatus("No data (timeout)");
        return;
      }
      try {
        await enqueueWrite(HEARTBEAT);
      } catch (err) {
        console.warn("Heartbeat failed", err);
      }
    }, HEARTBEAT_PERIOD_MS);
  }

  function stopHeartbeat() {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }
  }

  function handleWeighClick() {
    if (!isConnected) {
      if (typeof window.openConnectScaleModal === "function") {
        window.openConnectScaleModal();
      } else if (typeof window.openCoffeeScaleModal === "function") {
        window.openCoffeeScaleModal();
      }
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
      if (typeof window.openConnectScaleModal === "function") {
        window.openConnectScaleModal();
      } else if (typeof window.openCoffeeScaleModal === "function") {
        window.openCoffeeScaleModal();
      }
      return;
    }

    if (!writeChar) return;

    try {
      await enqueueWrite(scaleType === "GENERIC" ? TARE_GENERIC : TARE_ACAIA);
      if (scaleType === "OLD" || scaleType === "NEW") {
        await enqueueWrite(RESET_TIMER_ACAIA);
      } else if (scaleType === "GENERIC") {
        await enqueueWrite(RESET_TIMER_BOOKOO);
      }

      setTimerRunningState(false);
      resetLiveTimer();
      resetCaptureData();
    } catch (err) {
      console.warn("Reset scale failed", err);
    }
  }

  async function handleTimerIconClick() {
    if (!isConnected) {
      if (typeof window.openConnectScaleModal === "function") {
        window.openConnectScaleModal();
      } else if (typeof window.openCoffeeScaleModal === "function") {
        window.openCoffeeScaleModal();
      }
      return;
    }

    if (!writeChar) return;

    try {
      if (scaleType === "OLD" || scaleType === "NEW") {
        await enqueueWrite(timerRunning ? STOP_TIMER_ACAIA : START_TIMER_ACAIA);
      } else if (scaleType === "GENERIC") {
        await enqueueWrite(timerRunning ? STOP_TIMER_BOOKOO : START_TIMER_BOOKOO);
      } else {
        return;
      }

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
        if (labelEl) labelEl.textContent = timerRunning ? "Stop Timer" : "Start Timer";
      }
    });
  }

  const weighBtn = document.getElementById("brewWeighBtn");
  if (weighBtn) {
    weighBtn.addEventListener("pointerdown", () => {
      const outField = document.getElementById("inputYield");
      weighClickFromOut = document.activeElement === outField;
    });
    weighBtn.addEventListener("click", handleWeighClick);
  }

  const resetScaleBtn = document.getElementById("brewResetScaleBtn");
  if (resetScaleBtn) {
    resetScaleBtn.addEventListener("click", handleResetScaleClick);
  }

  const timerIconBtn = document.getElementById("brewTimerBtn");
  if (timerIconBtn) {
    timerIconBtn.addEventListener("click", handleTimerIconClick);
  }

  const graphWeighBtn = document.getElementById("graphWeighBtn");
  if (graphWeighBtn) {
    graphWeighBtn.addEventListener("pointerdown", () => {
      const outField = document.getElementById("inputYield");
      weighClickFromOut = document.activeElement === outField;
    });
    graphWeighBtn.addEventListener("click", handleWeighClick);
  }

  const graphResetScaleBtn = document.getElementById("graphResetScaleBtn");
  if (graphResetScaleBtn) {
    graphResetScaleBtn.addEventListener("click", handleResetScaleClick);
  }

  const graphTimerBtn = document.getElementById("graphTimerBtn");
  if (graphTimerBtn) {
    graphTimerBtn.addEventListener("click", handleTimerIconClick);
  }

  const inField = document.getElementById("inputWeight");
  const outField = document.getElementById("inputYield");
  const ratioField = document.getElementById("inputRatio");
  const syncGraphRecipeFields = () => {
    if (graphInputWeightEl && inField) graphInputWeightEl.value = inField.value;
    if (graphInputRatioEl && ratioField) graphInputRatioEl.value = ratioField.value;
    if (graphInputYieldEl && outField) graphInputYieldEl.value = outField.value;
  };
  const syncGraphTimeFromForm = () => {
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
  syncGraphRecipeFields();
  syncGraphTimeFromForm();
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

  window.coffeeScale = {
    isConnected: () => isConnected,
    getLastWeight: () => lastWeight,
    autoConnect: attemptAutoConnect,
    getCaptureData,
    setCaptureData,
    resetCaptureData,
    syncGraphFormFields,
    renderGraphTo
  };
}
