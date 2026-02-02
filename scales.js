export function initCoffeeScale() {
  const statusEl = document.getElementById("status");
  const weightEl = document.getElementById("weight");
  const tareBtn = document.getElementById("tare");
  const timerBtn = document.getElementById("timer");
  const resetTimerBtn = document.getElementById("resetTimer");
  const connectBtn = document.getElementById("connect");

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
  }

  function setWeight(value) {
    weightEl.textContent = value.toFixed(1) + " g";
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

      if (acaiaBuffer.length - start < 6) {
        consumeAcaiaBuffer(start);
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

  /* ---- Connect ---- */
  connectBtn.onclick = async () => {
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

      server = await device.gatt.connect();
      setStatus("Connected to " + device.name);

      await setupGatt();
      tareBtn.disabled = false;
      timerBtn.disabled = false;
      resetTimerBtn.disabled = false;
      timerBtn.textContent = "Start Timer";
      timerRunning = false;
    } catch (err) {
      console.error(err);
      setStatus("Connection failed");
    }
  };

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

      timerRunning = !timerRunning;
      timerBtn.textContent = timerRunning ? "Stop Timer" : "Start Timer";
    } catch (err) {
      console.warn("Timer command failed", err);
    }
  };

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

      timerRunning = false;
      timerBtn.textContent = "Start Timer";
    } catch (err) {
      console.warn("Reset timer failed", err);
    }
  };

  /* ---- Disconnect ---- */
  function onDisconnected() {
    setStatus("Disconnected");
    tareBtn.disabled = true;
    timerBtn.disabled = true;
    resetTimerBtn.disabled = true;
    timerBtn.textContent = "Start Timer";
    timerRunning = false;
    weightEl.textContent = "--.- g";
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
}
