# Multi-BLE Device Support Plan

## Overview
Expand the current single-scale BLE implementation to support multiple device types:
- **Primary Scale** (existing) - Weight/flow measurement
- **Secondary Scale** - Additional weight measurement (e.g., input water scale)
- **Pressure Sensor** - Real-time pressure profiling
- **Thermometer** - Temperature profiling during brew

All devices share measurement start/stop controlled by existing play/pause buttons in the brew form. Data is captured synchronously and displayed on the existing brew graph with additional data series.

---

## Phase 1: Expand Troubleshoot Modal

### Current State
[scales.view.html](../src/features/scales/scales.view.html) contains `coffeeScaleModal` for single scale diagnostics.

### Changes Required

#### 1.1 Rename Modal
- `coffeeScaleModal` → `deviceTroubleshootModal`
- Update title: "Coffee scale" → "BLE Devices"

#### 1.2 Device Selection UI
```html
<!-- Tab-style device selector -->
<div class="flex gap-1 mb-4 bg-coffee-100 dark:bg-[#1c1917] p-1 rounded-lg">
  <button data-device-tab="scale" class="flex-1 px-3 py-2 text-xs font-bold rounded-md">Scale</button>
  <button data-device-tab="scale2" class="flex-1 px-3 py-2 text-xs font-bold rounded-md">Scale 2</button>
  <button data-device-tab="pressure" class="flex-1 px-3 py-2 text-xs font-bold rounded-md">Pressure</button>
  <button data-device-tab="temp" class="flex-1 px-3 py-2 text-xs font-bold rounded-md">Temp</button>
</div>
```

#### 1.3 Device-Specific Panels (switchable)
Each device gets a panel showing:
- Connection status
- Current reading (weight/pressure/temp)
- Last device name (if previously connected)
- Tare button (for scales)
- Connect/Disconnect button
- Supported device info text

#### 1.4 New File Structure
```
src/features/devices/
├── devices.view.html          # Troubleshoot modal (renamed from scales)
├── devices-modals.js          # Modal open/close logic
├── devices.controller.js      # Command registration
├── devices.mount.js           # Lazy mount
├── adapters/
│   ├── base-ble-device.js     # Abstract base class
│   ├── scale-adapter.js       # Acaia/Bookoo/Generic scales
│   ├── pressure-adapter.js    # Pressure transducers (later)
│   └── temp-adapter.js        # BLE thermometers (later)
└── device-manager.js          # Multi-device orchestrator
```

#### 1.5 Tasks
- [x] Create `devices/` feature folder structure
- [x] Extract scale BLE logic from `scales.js` into `scale-adapter.js`
- [x] Create `base-ble-device.js` abstract class with common BLE methods
- [x] Create `device-manager.js` to manage multiple device instances
- [x] Build new troubleshoot modal HTML with device tabs
- [x] Wire up modal show/hide actions
- [x] Update preferences.view.html button text: "Troubleshoot scale" → "BLE Devices"

---

## Phase 2: Expand Connect Scale Modal

### Current State
[scales.view.html](../src/features/scales/scales.view.html) contains `connectScaleModal` as a simplified connection dialog opened from brew form.

### Changes Required

#### 2.1 Rename Modal
- `connectScaleModal` → `connectDevicesModal`
- Title: "Connect scale" → "Connect Devices"

#### 2.2 Multi-Device Connection Grid
```html
<div class="grid grid-cols-2 gap-3">
  <!-- Scale 1 (Primary) -->
  <div class="device-card p-3 rounded-lg border">
    <div class="flex items-center gap-2 mb-2">
      <i class="fa-solid fa-scale-balanced"></i>
      <span class="text-xs font-bold uppercase">Scale</span>
    </div>
    <div id="connectScale1Weight" class="text-2xl font-semibold">--.- g</div>
    <div id="connectScale1Status" class="text-[10px] text-coffee-500">Disconnected</div>
    <button id="connectScale1Btn" class="mt-2 w-full text-xs px-2 py-1.5 rounded">Connect</button>
  </div>
  
  <!-- Scale 2 (Secondary) -->
  <div class="device-card p-3 rounded-lg border">...</div>
  
  <!-- Pressure Sensor -->
  <div class="device-card p-3 rounded-lg border">
    <div class="flex items-center gap-2 mb-2">
      <i class="fa-solid fa-gauge-high"></i>
      <span class="text-xs font-bold uppercase">Pressure</span>
    </div>
    <div id="connectPressureValue" class="text-2xl font-semibold">-- bar</div>
    ...
  </div>
  
  <!-- Thermometer -->
  <div class="device-card p-3 rounded-lg border">
    <div class="flex items-center gap-2 mb-2">
      <i class="fa-solid fa-temperature-half"></i>
      <span class="text-xs font-bold uppercase">Temp</span>
    </div>
    <div id="connectTempValue" class="text-2xl font-semibold">-- °C</div>
    ...
  </div>
</div>
```

#### 2.3 Connect Status Indicator in Brew Form
Add small device status icons near the graph panel:
```html
<div class="flex items-center gap-2 text-[10px] text-coffee-500">
  <span id="graphScale1Indicator" class="hidden"><i class="fa-solid fa-scale-balanced"></i> ✓</span>
  <span id="graphScale2Indicator" class="hidden"><i class="fa-solid fa-scale-balanced"></i> ✓</span>
  <span id="graphPressureIndicator" class="hidden"><i class="fa-solid fa-gauge-high"></i> ✓</span>
  <span id="graphTempIndicator" class="hidden"><i class="fa-solid fa-temperature-half"></i> ✓</span>
</div>
```

#### 2.4 Tasks
- [x] Rebuild connect modal with 2x2 device grid
- [x] Add device indicator icons to graph panel header
- [x] Create individual connect functions per device type
- [x] Implement auto-reconnect on modal open for all remembered devices
- [x] Update `openConnectScaleModal` → `openConnectDevicesModal` naming
- [x] Wire device connect buttons to adapters via device-manager

---

## Phase 3: Connect Devices to Brew Form & Graph

### Current State
- [scales.js](../src/features/scales/scales.js) handles:
  - Weight capture during timer (play/pause)
  - Flow calculation from weight delta
  - Graph rendering with weight + flow series
- [brews-actions.js](../src/features/brews/brews-actions.js) saves:
  - `scaleCapture` - weight samples
  - `scaleFlowCapture` - flow samples
  - `scaleRawCapture` - raw unprocessed samples

### Changes Required

#### 3.1 Extended Data Model
```typescript
// Existing
brew.scaleCapture = { startAt: number, samples: [{tMs, w}] }
brew.scaleFlowCapture = { startAt: number, samples: [{tMs, f}] }

// New additions
brew.scale2Capture = { startAt: number, samples: [{tMs, w}] }
brew.pressureCapture = { startAt: number, samples: [{tMs, p}] }  // pressure in bar
brew.tempCapture = { startAt: number, samples: [{tMs, t}] }      // temp in °C
```

#### 3.2 Device Manager Integration
```javascript
// device-manager.js
class DeviceManager {
  devices = {
    scale: null,      // ScaleAdapter instance
    scale2: null,     // ScaleAdapter instance  
    pressure: null,   // PressureAdapter instance
    temp: null        // TempAdapter instance
  };
  
  startCapture() {
    const startAt = Date.now();
    Object.values(this.devices).forEach(d => d?.startCapture(startAt));
  }
  
  stopCapture() {
    Object.values(this.devices).forEach(d => d?.stopCapture());
  }
  
  getCaptureData() {
    return {
      scaleCapture: this.devices.scale?.getCaptureData(),
      scale2Capture: this.devices.scale2?.getCaptureData(),
      pressureCapture: this.devices.pressure?.getCaptureData(),
      tempCapture: this.devices.temp?.getCaptureData()
    };
  }
}
```

#### 3.3 Graph Rendering Updates
Modify `renderGraphTo()` in scales.js (or new graph-renderer.js):

```javascript
// Extended graph with multiple Y-axes
const datasets = [
  // Left Y-axis: Weight (g)
  { label: 'Weight', data: weightSamples, yAxisID: 'y-weight', borderColor: brown },
  { label: 'Scale 2', data: scale2Samples, yAxisID: 'y-weight', borderColor: orange },
  
  // Right Y-axis: Flow (g/s)
  { label: 'Flow', data: flowSamples, yAxisID: 'y-flow', borderColor: blue },
  
  // Secondary right axis: Pressure (bar)
  { label: 'Pressure', data: pressureSamples, yAxisID: 'y-pressure', borderColor: red },
  
  // Third axis: Temperature (°C)
  { label: 'Temp', data: tempSamples, yAxisID: 'y-temp', borderColor: green }
];
```

#### 3.4 Graph Toggle Prefs Extension
```javascript
graphTogglePrefs[methodKey] = {
  autoStart: boolean,
  unswirl: boolean,
  countPours: boolean,
  // New toggles
  showScale2: boolean,
  showPressure: boolean,
  showTemp: boolean
};
```

#### 3.5 UI Updates to Graph Panel
Add series visibility toggles:
```html
<div class="graph-toggle-grid">
  <!-- Existing toggles: Auto, Swirls, Pours -->
  
  <!-- New toggles -->
  <div class="toggle-row">
    <span><i class="fa-solid fa-scale-balanced"></i> Scale 2</span>
    <input type="checkbox" id="graphShowScale2Toggle" />
  </div>
  <div class="toggle-row">
    <span><i class="fa-solid fa-gauge-high"></i> Pressure</span>
    <input type="checkbox" id="graphShowPressureToggle" />
  </div>
  <div class="toggle-row">
    <span><i class="fa-solid fa-temperature-half"></i> Temp</span>
    <input type="checkbox" id="graphShowTempToggle" />
  </div>
</div>
```

#### 3.6 Tasks
- [x] Extend brew data model with new capture fields
- [x] Update `brews-actions.js` `handleFormSubmit` to save all captures
- [x] Update `brews-form.js` `populateFromBrew` to restore all captures
- [x] Modify/replace graph renderer to support multiple data series
- [ ] Add Y-axis configuration for pressure (bar) and temperature (°C)
- [ ] Add series visibility toggles to graph panel
- [ ] Update `graphTogglePrefs` schema and persistence
- [x] Update card graph preview to show multi-series data

---

## Device Adapter Specifications

### Base BLE Device Interface
```javascript
class BaseBleDevice {
  // Connection
  async connect()
  async disconnect()
  get isConnected()
  get deviceName()
  
  // Events
  onValueChange(callback)  // (value) => void
  onStatusChange(callback) // (status) => void
  
  // Capture
  startCapture(startAtMs)
  stopCapture()
  getCaptureData()  // { startAt, samples }
  resetCapture()
  
  // Commands
  async tare()  // scales only
}
```

### Scale Adapter (scale-adapter.js)
- Supports: Acaia (old/new protocol), Bookoo, Generic 0xFF10 scales
- Value: weight in grams (float)
- Sample format: `{ tMs: number, w: number }`
- Commands: tare, timer start/stop/reset (passed through to scale)

### Pressure Adapter (pressure-adapter.js)
- Supports: Generic GATT pressure services, custom pressure transducers
- Value: pressure in bar (float)
- Sample format: `{ tMs: number, p: number }`
- Known services to scan for:
  - Environmental Sensing Service (0x181A)
  - Custom pressure UUIDs (TBD based on specific hardware)

### Temperature Adapter (temp-adapter.js)
- Supports: BLE thermometers (generic, BBQ thermometers, etc.)
- Value: temperature in °C (float)
- Sample format: `{ tMs: number, t: number }`
- Known services to scan for:
  - Health Thermometer Service (0x1809)
  - Environmental Sensing Service (0x181A)
  - Custom temp UUIDs

---

## Implementation Order

### Sprint 1: Foundation
1. Create `devices/` feature folder structure
2. Extract scale BLE code into `scale-adapter.js`
3. Create `base-ble-device.js` abstract class
4. Create `device-manager.js` singleton

### Sprint 2: Troubleshoot Modal
5. Build new troubleshoot modal with device tabs
6. Wire scale adapter to existing functionality
7. Add placeholder tabs for scale2/pressure/temp

### Sprint 3: Connect Modal
8. Rebuild connect modal with device grid
9. Add status indicators to graph panel
10. Implement multi-device auto-reconnect

### Sprint 4: Second Scale
11. Enable scale2 adapter (reusing scale-adapter)
12. Add scale2 capture to data model
13. Add scale2 series to graph

### Sprint 5: Pressure Sensor
14. Research/identify target pressure hardware
15. Implement pressure adapter
16. Add pressure capture and graph series

### Sprint 6: Thermometer
17. Research/identify target temp hardware
18. Implement temp adapter
19. Add temp capture and graph series

### Sprint 7: Polish
20. Graph legend and color scheme refinement
21. Performance optimization for multi-series rendering
22. Comprehensive testing across device combinations

---

## Open Questions

1. **Hardware Selection**: Which specific pressure sensors and thermometers to target first? 
    1. BooKoo Espresso Monitor first Later Smart Espresso Profiler & BooKoo Espresso Monitor & Pressensor.
    2. ETI Ltd (ThermaQ Blue), Combustion, Meater (not Meater+ or Meater 2)
2. **Graph Complexity**: Should all series show by default, or only connected devices?
    -> only connected devices. this advnaced user experience should be invisible for casual users with one scale. 
3. **Data Migration**: Should existing brews be backfilled with null for new capture fields?
    -> no backfill, code should support non existing fields
4. **Mobile Support**: Chrome Android supports Web Bluetooth - confirm iOS status (Safari limitation)
    -> users should use Bluefy app on iOS.
5. **Conflicting UUIDs**: If multiple devices share UUIDs, how to differentiate during scan?
    -> does this mean we cannot support two scales of the same brand and type?

---

## References

- Current scale implementation: [scales.js](../src/features/scales/scales.js)
- Scale modals: [scales.view.html](../src/features/scales/scales.view.html)
- Brew form integration: [brews-actions.js](../src/features/brews/brews-actions.js)
- Graph rendering: Chart.js library used for canvas rendering
- Web Bluetooth API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- Espresso BLE devices interfacing examples: https://github.com/graphefruit/Beanconqueror 
