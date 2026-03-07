/**
 * Devices Modals Module
 * Handles modal open/close and tab switching for BLE device management
 */
import { DeviceManager } from './device-manager.js';

/**
 * @typedef {'scale' | 'scale2' | 'pressure' | 'temp'} DeviceSlot
 */

let currentTab = 'scale';

// --- Modal functions ---

export const openDeviceTroubleshootModal = () => {
    document.getElementById('deviceTroubleshootModal')?.classList.remove('hidden');
    DeviceManager.autoConnectAll();
};

export const closeDeviceTroubleshootModal = () => {
    document.getElementById('deviceTroubleshootModal')?.classList.add('hidden');
};

export const openConnectDevicesModal = () => {
    document.getElementById('connectDevicesModal')?.classList.remove('hidden');
    DeviceManager.autoConnectAll();
};

export const closeConnectDevicesModal = () => {
    document.getElementById('connectDevicesModal')?.classList.add('hidden');
};

// --- Tab switching ---

/**
 * Switch between device tabs
 * @param {DeviceSlot} tab
 */
export const switchDeviceTab = (tab) => {
    currentTab = tab;
    
    // Update tab button styles
    document.querySelectorAll('.device-tab-btn').forEach(btn => {
        const btnTab = btn.dataset.deviceTab;
        const isActive = btnTab === tab;
        
        if (isActive) {
            btn.classList.add('bg-white', 'dark:bg-[#292524]', 'text-coffee-800', 'dark:text-white', 'shadow-sm');
            btn.classList.remove('text-coffee-500', 'dark:text-[#78716c]', 'hover:text-coffee-800', 'dark:hover:text-white');
        } else {
            btn.classList.remove('bg-white', 'dark:bg-[#292524]', 'text-coffee-800', 'dark:text-white', 'shadow-sm');
            btn.classList.add('text-coffee-500', 'dark:text-[#78716c]', 'hover:text-coffee-800', 'dark:hover:text-white');
        }
    });
    
    // Show/hide panels
    document.querySelectorAll('.device-panel').forEach(panel => {
        panel.classList.add('hidden');
    });
    
    const panelId = `devicePanel${tab.charAt(0).toUpperCase() + tab.slice(1)}`;
    document.getElementById(panelId)?.classList.remove('hidden');
};

// --- Device actions ---

/**
 * Connect to a device
 * @param {DeviceSlot} slot
 */
export const connectDevice = async (slot) => {
    try {
        await DeviceManager.connect(slot);
    } catch (err) {
        console.error(`[DevicesModals] Connect ${slot} failed:`, err);
    }
};

/**
 * Tare a scale device
 * @param {DeviceSlot} slot
 */
export const tareDevice = async (slot) => {
    await DeviceManager.tare(slot);
};

/**
 * Toggle timer on a scale device
 * @param {DeviceSlot} slot
 */
export const toggleDeviceTimer = async (slot) => {
    const device = DeviceManager.getDevice(slot);
    if (device && typeof device.toggleTimer === 'function') {
        await device.toggleTimer();
    }
};

/**
 * Reset timer on a scale device
 * @param {DeviceSlot} slot
 */
export const resetDeviceTimer = async (slot) => {
    const device = DeviceManager.getDevice(slot);
    if (device && typeof device.resetTimer === 'function') {
        await device.resetTimer();
    }
};

// --- UI update functions ---

const formatWeight = (weight) => {
    if (weight === null || !Number.isFinite(weight)) {
        return '--.- g';
    }
    return `${weight.toFixed(1)} g`;
};

/**
 * Update UI for a scale slot
 * @param {DeviceSlot} slot
 * @param {object} params
 */
const updateScaleUI = (slot, { weight, status, connected, timerRunning } = {}) => {
    const prefix = slot === 'scale' ? 'Scale' : 'Scale2';
    
    // Troubleshoot modal elements
    const weightEl = document.getElementById(`device${prefix}Weight`);
    const statusEl = document.getElementById(`device${prefix}Status`);
    const connectBtn = document.getElementById(`device${prefix}Connect`);
    const tareBtn = document.getElementById(`device${prefix}Tare`);
    const timerBtn = document.getElementById(`device${prefix}Timer`);
    const resetTimerBtn = document.getElementById(`device${prefix}ResetTimer`);
    
    // Connect modal elements
    const connectModalWeightEl = document.getElementById(`connect${prefix}Weight`);
    const connectModalStatusEl = document.getElementById(`connect${prefix}Status`);
    const connectModalIndicator = document.getElementById(`connect${prefix}Indicator`);
    const connectModalBtn = document.getElementById(`connect${prefix}Btn`);
    
    // Update weight
    if (weight !== undefined) {
        const formattedWeight = formatWeight(weight);
        if (weightEl) weightEl.textContent = formattedWeight;
        if (connectModalWeightEl) connectModalWeightEl.textContent = formattedWeight;
    }
    
    // Update status
    if (status !== undefined) {
        if (statusEl) statusEl.textContent = status;
        if (connectModalStatusEl) connectModalStatusEl.textContent = status;
    }
    
    // Update connected state
    if (connected !== undefined) {
        if (tareBtn) tareBtn.disabled = !connected;
        if (timerBtn) timerBtn.disabled = !connected;
        if (resetTimerBtn) resetTimerBtn.disabled = !connected;
        
        if (connectBtn) {
            connectBtn.innerHTML = connected
                ? '<i class="fa-solid fa-link-slash"></i> Disconnect'
                : '<i class="fa-solid fa-link"></i> Connect';
        }
        if (connectModalBtn) {
            connectModalBtn.textContent = connected ? 'Disconnect' : 'Connect';
        }
        if (connectModalIndicator) {
            connectModalIndicator.classList.toggle('hidden', !connected);
        }
    }
    
    // Update timer button text
    if (timerRunning !== undefined && timerBtn) {
        timerBtn.textContent = timerRunning ? 'Stop timer' : 'Start timer';
    }
};

// --- Initialize listeners ---

export const initDeviceListeners = () => {
    // Scale 1 listeners
    DeviceManager.onValueChange('scale', (weight) => {
        updateScaleUI('scale', { weight });
    });
    
    DeviceManager.onStatusChange('scale', (status) => {
        updateScaleUI('scale', { status });
    });
    
    DeviceManager.onConnectionChange('scale', (connected) => {
        updateScaleUI('scale', { connected });
        const device = DeviceManager.getDevice('scale');
        if (device?.onTimerStateChange) {
            device.onTimerStateChange((running) => {
                updateScaleUI('scale', { timerRunning: running });
            });
        }
    });
    
    // Scale 2 listeners
    DeviceManager.onValueChange('scale2', (weight) => {
        updateScaleUI('scale2', { weight });
    });
    
    DeviceManager.onStatusChange('scale2', (status) => {
        updateScaleUI('scale2', { status });
    });
    
    DeviceManager.onConnectionChange('scale2', (connected) => {
        updateScaleUI('scale2', { connected });
        const device = DeviceManager.getDevice('scale2');
        if (device?.onTimerStateChange) {
            device.onTimerStateChange((running) => {
                updateScaleUI('scale2', { timerRunning: running });
            });
        }
    });
};

// --- Export actions object for data-action-click binding ---

export const devicesActions = {
    openDeviceTroubleshootModal,
    closeDeviceTroubleshootModal,
    openConnectDevicesModal,
    closeConnectDevicesModal,
    switchDeviceTab,
    connectDevice,
    tareDevice,
    toggleDeviceTimer,
    resetDeviceTimer
};
