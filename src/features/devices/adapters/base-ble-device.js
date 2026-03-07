/**
 * Base BLE Device Adapter
 * Abstract base class for all BLE device types (scales, pressure sensors, thermometers)
 */
export class BaseBleDevice {
    constructor(deviceType, options = {}) {
        if (new.target === BaseBleDevice) {
            throw new Error('BaseBleDevice is abstract and cannot be instantiated directly');
        }
        
        this.deviceType = deviceType;
        this.options = options;
        
        // BLE state
        this._device = null;
        this._server = null;
        this._notifyChar = null;
        this._writeChar = null;
        this._isConnected = false;
        this._deviceName = null;
        this._autoConnectInProgress = false;
        
        // Write queue for serializing BLE writes
        this._writeQueue = Promise.resolve();
        this._writeInProgress = false;
        
        // Heartbeat
        this._heartbeatTimer = null;
        this._lastPacketAt = 0;
        
        // Capture state
        this._capture = { startAt: null, samples: [] };
        this._isCapturing = false;
        
        // Callbacks
        this._onValueChange = null;
        this._onStatusChange = null;
        this._onConnectionChange = null;
    }
    
    // --- Abstract methods (must be implemented by subclasses) ---
    
    /**
     * Get BLE service and characteristic UUIDs for this device type
     * @returns {{ services: string[], filters: object[], characteristics: object }}
     */
    getBleConfig() {
        throw new Error('getBleConfig() must be implemented by subclass');
    }
    
    /**
     * Parse incoming BLE notification data
     * @param {Uint8Array} data - Raw BLE data
     * @returns {{ value: number|null, events: string[] }}
     */
    parseNotification(data) {
        throw new Error('parseNotification() must be implemented by subclass');
    }
    
    /**
     * Get the sample key for this device type (e.g., 'w' for weight, 'p' for pressure)
     * @returns {string}
     */
    getSampleKey() {
        throw new Error('getSampleKey() must be implemented by subclass');
    }
    
    // --- Connection methods ---
    
    get isConnected() {
        return this._isConnected;
    }
    
    get deviceName() {
        return this._deviceName;
    }
    
    /**
     * Request and connect to a BLE device
     */
    async connect() {
        if (!navigator.bluetooth) {
            throw new Error('Web Bluetooth not supported');
        }
        
        this._setStatus('Requesting device...');
        
        const config = this.getBleConfig();
        
        try {
            this._device = await navigator.bluetooth.requestDevice({
                filters: config.filters,
                optionalServices: config.services
            });
            
            this._device.addEventListener('gattserverdisconnected', () => this._onDisconnected());
            
            await this._connectToDevice();
        } catch (err) {
            console.error(`[${this.deviceType}] Connection failed:`, err);
            this._setStatus('Connection failed');
            throw err;
        }
    }
    
    /**
     * Disconnect from the current device
     */
    async disconnect() {
        this._stopHeartbeat();
        
        if (this._device && this._device.gatt && this._device.gatt.connected) {
            try {
                this._device.gatt.disconnect();
            } catch (err) {
                console.warn(`[${this.deviceType}] Disconnect error:`, err);
            }
        }
        
        this._isConnected = false;
        this._setStatus('Disconnected');
        this._onConnectionChange?.(false);
    }
    
    /**
     * Attempt to auto-reconnect to a previously paired device
     */
    async autoConnect() {
        if (this._isConnected || this._autoConnectInProgress) return;
        if (!this._device || !this._device.gatt) return;
        
        if (this._device.gatt.connected) {
            this._isConnected = true;
            return;
        }
        
        this._autoConnectInProgress = true;
        try {
            this._setStatus('Connecting...');
            await this._connectToDevice();
        } catch (err) {
            console.warn(`[${this.deviceType}] Auto connect failed:`, err);
            this._setStatus('Disconnected');
        } finally {
            this._autoConnectInProgress = false;
        }
    }
    
    async _connectToDevice() {
        if (!this._device) return;
        
        this._server = await this._device.gatt.connect();
        this._deviceName = this._device.name;
        this._setStatus(`Connected to ${this._deviceName}`);
        
        await this._setupGatt();
        
        this._isConnected = true;
        this._onConnectionChange?.(true);
    }
    
    /**
     * Setup GATT characteristics - override in subclass for custom setup
     */
    async _setupGatt() {
        const services = await this._server.getPrimaryServices();
        const config = this.getBleConfig();
        
        for (const service of services) {
            const chars = await service.getCharacteristics();
            for (const char of chars) {
                const uuid = char.uuid.toLowerCase();
                
                // Check if this is a read/notify characteristic
                if (config.characteristics.read?.includes(uuid)) {
                    this._notifyChar = char;
                }
                // Check if this is a write characteristic
                if (config.characteristics.write?.includes(uuid)) {
                    this._writeChar = char;
                }
            }
        }
        
        if (!this._notifyChar) {
            this._setStatus('No compatible characteristics found');
            return;
        }
        
        await this._notifyChar.startNotifications();
        this._notifyChar.addEventListener('characteristicvaluechanged', (e) => this._onNotify(e));
        
        // Call post-setup hook for subclasses
        await this._onGattSetupComplete();
    }
    
    /**
     * Hook called after GATT setup - override in subclass
     */
    async _onGattSetupComplete() {
        // Override in subclass for initialization commands (identify, heartbeat, etc.)
    }
    
    _onDisconnected() {
        this._isConnected = false;
        this._stopHeartbeat();
        this._setStatus('Disconnected');
        this._onConnectionChange?.(false);
    }
    
    _onNotify(event) {
        const value = event.target.value;
        const data = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
        
        const result = this.parseNotification(data);
        
        if (result.value !== null && Number.isFinite(result.value)) {
            this._lastPacketAt = Date.now();
            this._onValueChange?.(result.value);
            
            // Add to capture if capturing
            if (this._isCapturing && this._capture.startAt !== null) {
                const tMs = Date.now() - this._capture.startAt;
                const sample = { tMs };
                sample[this.getSampleKey()] = result.value;
                this._capture.samples.push(sample);
            }
        }
        
        // Handle any events (timer start/stop, etc.)
        result.events?.forEach(event => this._handleDeviceEvent(event));
    }
    
    /**
     * Handle device-specific events - override in subclass
     */
    _handleDeviceEvent(event) {
        // Override in subclass
    }
    
    // --- Write methods ---
    
    async _enqueueWrite(data) {
        if (!this._writeChar) return;
        
        this._writeQueue = this._writeQueue
            .then(async () => {
                this._writeInProgress = true;
                await this._writeChar.writeValue(data);
            })
            .catch((err) => {
                console.warn(`[${this.deviceType}] Write failed:`, err);
            })
            .finally(() => {
                this._writeInProgress = false;
            });
        
        return this._writeQueue;
    }
    
    // --- Heartbeat ---
    
    _startHeartbeat(command, periodMs = 2750) {
        this._stopHeartbeat();
        this._heartbeatTimer = setInterval(async () => {
            if (!this._isConnected) return;
            try {
                await this._enqueueWrite(command);
            } catch (err) {
                console.warn(`[${this.deviceType}] Heartbeat failed:`, err);
            }
        }, periodMs);
    }
    
    _stopHeartbeat() {
        if (this._heartbeatTimer) {
            clearInterval(this._heartbeatTimer);
            this._heartbeatTimer = null;
        }
    }
    
    // --- Capture methods ---
    
    /**
     * Start capturing data
     * @param {number} startAtMs - Timestamp to use as capture start (for sync across devices)
     */
    startCapture(startAtMs = Date.now()) {
        this._capture = {
            startAt: startAtMs,
            samples: []
        };
        this._isCapturing = true;
    }
    
    /**
     * Stop capturing data
     */
    stopCapture() {
        this._isCapturing = false;
    }
    
    /**
     * Get captured data
     * @returns {{ startAt: number|null, samples: Array }}
     */
    getCaptureData() {
        return JSON.parse(JSON.stringify(this._capture));
    }
    
    /**
     * Restore previously saved capture data (e.g. when re-editing a brew)
     * @param {{ startAt: number|null, samples: Array }} captureData
     */
    setCaptureData(captureData) {
        if (captureData && Array.isArray(captureData.samples)) {
            this._capture = JSON.parse(JSON.stringify(captureData));
        } else {
            this._capture = { startAt: null, samples: [] };
        }
        this._isCapturing = false;
    }

    /**
     * Reset capture data
     */
    resetCapture() {
        this._capture = { startAt: null, samples: [] };
        this._isCapturing = false;
    }
    
    // --- Event callbacks ---
    
    onValueChange(callback) {
        this._onValueChange = callback;
    }
    
    onStatusChange(callback) {
        this._onStatusChange = callback;
    }
    
    onConnectionChange(callback) {
        this._onConnectionChange = callback;
    }
    
    _setStatus(status) {
        this._onStatusChange?.(status);
    }
}
