/**
 * Device Manager
 * Orchestrates multiple BLE device adapters (scales, pressure sensors, thermometers)
 */
import { ScaleAdapter } from './adapters/scale-adapter.js';

/**
 * @typedef {'scale' | 'scale2' | 'pressure' | 'temp'} DeviceSlot
 */

class DeviceManagerClass {
    constructor() {
        /** @type {Map<DeviceSlot, import('./adapters/base-ble-device.js').BaseBleDevice>} */
        this._devices = new Map();
        
        /** @type {Map<DeviceSlot, Function[]>} */
        this._statusListeners = new Map();
        
        /** @type {Map<DeviceSlot, Function[]>} */
        this._valueListeners = new Map();
        
        /** @type {Map<DeviceSlot, Function[]>} */
        this._connectionListeners = new Map();
        
        /** @type {number|null} */
        this._captureStartAt = null;
        
        /** @type {boolean} */
        this._isCapturing = false;
    }
    
    /**
     * Get all available device slots
     * @returns {DeviceSlot[]}
     */
    getSlots() {
        return ['scale', 'scale2', 'pressure', 'temp'];
    }
    
    /**
     * Get device adapter for a slot
     * @param {DeviceSlot} slot
     * @returns {import('./adapters/base-ble-device.js').BaseBleDevice|null}
     */
    getDevice(slot) {
        return this._devices.get(slot) || null;
    }
    
    /**
     * Check if a device slot is connected
     * @param {DeviceSlot} slot
     * @returns {boolean}
     */
    isConnected(slot) {
        const device = this._devices.get(slot);
        return device?.isConnected ?? false;
    }
    
    /**
     * Get device name for a slot
     * @param {DeviceSlot} slot
     * @returns {string|null}
     */
    getDeviceName(slot) {
        const device = this._devices.get(slot);
        return device?.deviceName ?? null;
    }
    
    /**
     * Connect a device to a slot
     * @param {DeviceSlot} slot
     */
    async connect(slot) {
        // Disconnect existing device in this slot
        if (this._devices.has(slot)) {
            await this.disconnect(slot);
        }
        
        // Create appropriate adapter
        const adapter = this._createAdapter(slot);
        if (!adapter) {
            throw new Error(`Unknown device slot: ${slot}`);
        }
        
        // Wire up listeners
        adapter.onStatusChange((status) => this._notifyStatusListeners(slot, status));
        adapter.onValueChange((value) => this._notifyValueListeners(slot, value));
        adapter.onConnectionChange((connected) => this._notifyConnectionListeners(slot, connected));
        
        // Store before connect so listeners work
        this._devices.set(slot, adapter);
        
        try {
            await adapter.connect();
            
            // If we're currently capturing, start capture on new device
            if (this._isCapturing && this._captureStartAt !== null) {
                adapter.startCapture(this._captureStartAt);
            }
        } catch (err) {
            this._devices.delete(slot);
            this._notifyConnectionListeners(slot, false);
            throw err;
        }
    }
    
    /**
     * Disconnect device from a slot
     * @param {DeviceSlot} slot
     */
    async disconnect(slot) {
        const device = this._devices.get(slot);
        if (!device) return;
        
        try {
            await device.disconnect();
        } catch (err) {
            console.warn(`[DeviceManager] Disconnect error for ${slot}:`, err);
        }
        
        this._devices.delete(slot);
        this._notifyConnectionListeners(slot, false);
    }
    
    /**
     * Auto-reconnect a slot if it has a previously paired device
     * @param {DeviceSlot} slot
     */
    async autoConnect(slot) {
        const device = this._devices.get(slot);
        if (device) {
            await device.autoConnect();
        }
    }
    
    /**
     * Auto-reconnect all slots that have previously paired devices
     */
    async autoConnectAll() {
        const promises = [];
        for (const slot of this.getSlots()) {
            if (this._devices.has(slot)) {
                promises.push(this.autoConnect(slot));
            }
        }
        await Promise.allSettled(promises);
    }
    
    /**
     * Create appropriate adapter for a slot
     * @param {DeviceSlot} slot
     * @returns {import('./adapters/base-ble-device.js').BaseBleDevice|null}
     */
    _createAdapter(slot) {
        switch (slot) {
            case 'scale':
            case 'scale2':
                return new ScaleAdapter({ slot });
            // Pressure and temp adapters will be added later
            // case 'pressure':
            //     return new PressureAdapter({ slot });
            // case 'temp':
            //     return new TempAdapter({ slot });
            default:
                return null;
        }
    }
    
    // --- Scale-specific methods ---
    
    /**
     * Tare a scale (slot must be 'scale' or 'scale2')
     * @param {DeviceSlot} slot
     */
    async tare(slot) {
        const device = this._devices.get(slot);
        if (device && typeof device.tare === 'function') {
            await device.tare();
        }
    }
    
    /**
     * Get current weight from a scale
     * @param {DeviceSlot} slot
     * @returns {number|null}
     */
    getWeight(slot) {
        const device = this._devices.get(slot);
        return device?.weight ?? null;
    }
    
    // --- Capture methods (synchronized across all devices) ---
    
    /**
     * Start capture on all connected devices
     */
    startCapture() {
        this._captureStartAt = Date.now();
        this._isCapturing = true;
        
        for (const device of this._devices.values()) {
            device.startCapture(this._captureStartAt);
        }
    }
    
    /**
     * Stop capture on all connected devices
     */
    stopCapture() {
        this._isCapturing = false;
        
        for (const device of this._devices.values()) {
            device.stopCapture();
        }
    }
    
    /**
     * Reset capture on all devices
     */
    resetCapture() {
        this._captureStartAt = null;
        this._isCapturing = false;
        
        for (const device of this._devices.values()) {
            device.resetCapture();
        }
    }
    
    /**
     * Get capture data from all devices
     * @returns {{
     *   scaleCapture: object|null,
     *   scale2Capture: object|null,
     *   pressureCapture: object|null,
     *   tempCapture: object|null
     * }}
     */
    getCaptureData() {
        return {
            scaleCapture: this._devices.get('scale')?.getCaptureData() || null,
            scale2Capture: this._devices.get('scale2')?.getCaptureData() || null,
            pressureCapture: this._devices.get('pressure')?.getCaptureData() || null,
            tempCapture: this._devices.get('temp')?.getCaptureData() || null
        };
    }
    
    /**
     * Check if any device is currently capturing
     * @returns {boolean}
     */
    get isCapturing() {
        return this._isCapturing;
    }
    
    // --- Listeners ---
    
    /**
     * Subscribe to status changes for a slot
     * @param {DeviceSlot} slot
     * @param {Function} callback
     */
    onStatusChange(slot, callback) {
        if (!this._statusListeners.has(slot)) {
            this._statusListeners.set(slot, []);
        }
        this._statusListeners.get(slot).push(callback);
    }
    
    /**
     * Subscribe to value changes for a slot
     * @param {DeviceSlot} slot
     * @param {Function} callback
     */
    onValueChange(slot, callback) {
        if (!this._valueListeners.has(slot)) {
            this._valueListeners.set(slot, []);
        }
        this._valueListeners.get(slot).push(callback);
    }
    
    /**
     * Subscribe to connection changes for a slot
     * @param {DeviceSlot} slot
     * @param {Function} callback
     */
    onConnectionChange(slot, callback) {
        if (!this._connectionListeners.has(slot)) {
            this._connectionListeners.set(slot, []);
        }
        this._connectionListeners.get(slot).push(callback);
    }
    
    /**
     * Remove all listeners for a slot
     * @param {DeviceSlot} slot
     */
    removeListeners(slot) {
        this._statusListeners.delete(slot);
        this._valueListeners.delete(slot);
        this._connectionListeners.delete(slot);
    }
    
    _notifyStatusListeners(slot, status) {
        const listeners = this._statusListeners.get(slot) || [];
        listeners.forEach(cb => {
            try { cb(status); } catch (e) { console.error(e); }
        });
    }
    
    _notifyValueListeners(slot, value) {
        const listeners = this._valueListeners.get(slot) || [];
        listeners.forEach(cb => {
            try { cb(value); } catch (e) { console.error(e); }
        });
    }
    
    _notifyConnectionListeners(slot, connected) {
        const listeners = this._connectionListeners.get(slot) || [];
        listeners.forEach(cb => {
            try { cb(connected); } catch (e) { console.error(e); }
        });
    }
    
    // --- Utility ---
    
    /**
     * Get summary of all connected devices
     * @returns {Array<{slot: DeviceSlot, name: string, connected: boolean}>}
     */
    getConnectedDevicesSummary() {
        return this.getSlots().map(slot => ({
            slot,
            name: this.getDeviceName(slot),
            connected: this.isConnected(slot)
        })).filter(d => d.connected);
    }
    
    /**
     * Check if any device is connected
     * @returns {boolean}
     */
    hasAnyConnection() {
        return this.getSlots().some(slot => this.isConnected(slot));
    }
}

// Singleton instance
export const DeviceManager = new DeviceManagerClass();

// Also export class for testing
export { DeviceManagerClass };
