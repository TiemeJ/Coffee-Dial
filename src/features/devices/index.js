/**
 * Devices Feature
 * Multi-BLE device support for scales, pressure sensors, and thermometers
 */

// Export device manager singleton
export { DeviceManager, DeviceManagerClass } from './device-manager.js';

// Export adapters
export { BaseBleDevice } from './adapters/base-ble-device.js';
export { ScaleAdapter } from './adapters/scale-adapter.js';

// Export modal functions
export {
    openDeviceTroubleshootModal,
    closeDeviceTroubleshootModal,
    openConnectDevicesModal,
    closeConnectDevicesModal,
    switchDeviceTab,
    connectDevice,
    tareDevice,
    toggleDeviceTimer,
    resetDeviceTimer,
    initDeviceListeners,
    devicesActions
} from './devices-modals.js';

// Export mount function
export { ensureDevicesModalsMounted, isDevicesModalsMounted } from './devices.mount.js';
