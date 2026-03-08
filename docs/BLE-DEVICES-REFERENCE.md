# Beanconqueror BLE Devices Reference

This document provides detailed BLE interfacing specifications for scales, pressure sensors, and temperature sensors from the Beanconqueror codebase. Use this reference to implement device adapters for Coffee-Dial's Multi-BLE Device Support (Sprints 5 & 6).

**Source Repository**: https://github.com/graphefruit/Beanconqueror

---

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Scales](#scales)
3. [Pressure Sensors](#pressure-sensors)
4. [Temperature Sensors](#temperature-sensors)
5. [Common Utilities](#common-utilities)
6. [Implementation Notes](#implementation-notes)

---

## Architecture Overview

### Base Classes

#### BluetoothScale (Base for Scales)
**File**: [`src/classes/devices/bluetoothDevice.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/bluetoothDevice.ts)

```typescript
export class BluetoothScale {
  public device_id: string;
  public device_name: string;
  public batteryLevel: number;
  public weightChange: EventEmitter<WeightChangeEvent>;
  public flowChange: EventEmitter<FlowChangeEvent>;
  public timerEvent: EventEmitter<TimerEvent | null>;
  public tareEvent: EventEmitter<TareEvent>;
  public supportsTaring: boolean;
  public supportsTwoWeights: boolean;
  protected weight: Weight;
  
  // Core interface methods
  public async connect() {}
  public async tare() {}
  public async setLed(_weightOn: boolean, _timerOn: boolean) {}
  public async setTimer(_timer: SCALE_TIMER_COMMAND) {}
  public getWeight(): number {}
  public getSmoothedWeight(): number {}
  public disconnectTriggered(): void {}
  
  protected setWeight(_newWeight: number, _stableWeight: boolean = false) {
    // Emits weight change events with smoothing
  }
}

export interface Weight {
  actual: number;
  old: number;
  smoothed: number;
  oldSmoothed: number;
  notMutatedWeight: number;
}

export enum SCALE_TIMER_COMMAND {
  STOP = 'STOP',
  RESET = 'RESET',
  START = 'START',
}
```

#### PressureDevice (Base for Pressure Sensors)
**File**: [`src/classes/devices/pressureBluetoothDevice.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/pressureBluetoothDevice.ts)

```typescript
export abstract class PressureDevice {
  public device_id: string;
  public device_name: string;
  public batteryLevel: number;
  public pressureChange: EventEmitter<PressureChangeEvent>;
  protected pressure: Pressure;
  
  // Abstract methods to implement
  public abstract connect(): void;
  public abstract disconnect(): void;
  public abstract updateZero(): Promise<void>;
  public abstract enableValueTransmission(): void;
  public abstract disableValueTransmission(): Promise<void>;
  
  public getPressure(): number {}
  public getBattery(): Promise<number> {}
  
  protected setPressure(_newPressure: number, _rawData: any, _parsedData: any) {
    // Emits pressure change events
  }
}

export interface Pressure {
  actual: number;
  old: number;
}

// Utility function
export function psiToBar(v: number): number {
  return v * 0.0689476;
}
```

#### TemperatureDevice (Base for Thermometers)
**File**: [`src/classes/devices/temperatureBluetoothDevice.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/temperatureBluetoothDevice.ts)

```typescript
export abstract class TemperatureDevice {
  public device_id: string;
  public device_name: string;
  public batteryLevel: number;
  public temperatureChange: EventEmitter<TemperatureChangeEvent>;
  protected temperature: Temperature;
  
  // Abstract methods
  public abstract connect(): void;
  public abstract disconnect(): void;
  
  public getTemperature(): number {}
  public getBattery(): Promise<number> {}
  
  protected setTemperature(_newTemperature: number, _rawData: any) {
    // Emits temperature change events
  }
}

export interface Temperature {
  actual: number;
  old: number;
}

// Utility functions
export function fahrenheitToCelcius(temp: number): number {
  return (temp - 32) * (5 / 9);
}

export function celciusToFahrenheit(temp: number): number {
  return temp * (9 / 5) + 32;
}
```

---

## Scales

### Supported Scales (excluding Acaia/Bookoo already implemented)

---

### 1. Decent Scale
**File**: [`src/classes/devices/decentScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/decentScale.ts)

| Property | Value |
|----------|-------|
| Device Name | Starts with "decent" |
| Write Service UUID | `fff0` |
| Write Characteristic UUID | `36f5` |
| Read Service UUID | `fff0` |
| Read Characteristic UUID | `fff4` |
| Header Byte | `0x03` |

**Connection Flow**:
```typescript
public override async connect() {
  await this.attachNotification();
  this.startHeartbeatMonitor();  // Sends keepalive every ~1s
}
```

**Weight Parsing** (in notification callback):
```typescript
const uScaleData = new Uint8Array(_data);
if (uScaleData[1] === 0xce || uScaleData[1] === 0xca) {
  // Weight notification
  const dataview = new DataView(uScaleData.buffer);
  const newWeight = dataview.getInt16(2, false) ?? 0;  // Big-endian Int16
  const weightIsStable = uScaleData[1] === 0xce;
  this.setWeight(newWeight / 10.0, weightIsStable);  // Divide by 10 for grams
} else if (uScaleData[1] === 0xaa && uScaleData[2] === 0x01) {
  // Tare button pressed on scale
}
```

**Tare Command**:
```typescript
private buildTareCommand(): Uint8Array {
  // Command: [HEADER, 0x07, 0x00] + XOR checksum
  return new Uint8Array([0x03, 0x07, 0x00, xorChecksum]);
}
```

**Timer Commands**:
```typescript
private buildTimerCommand(_timer: SCALE_TIMER_COMMAND): Uint8Array {
  // START:  [0x03, 0x0B, 0x03, 0x00, xor]
  // STOP:   [0x03, 0x0B, 0x00, 0x00, xor]
  // RESET:  [0x03, 0x0B, 0x02, 0x00, xor]
}
```

**LED Control**:
```typescript
private buildLedOnOffCommand(_weightLedOn: boolean, _timerLedOn: boolean): Uint8Array {
  // [0x03, 0x0A, weightByte, timerByte, xor]
}
```

**Heartbeat/Keepalive** (required to maintain connection):
```typescript
private sendKeepAlive() {
  // Sends heartbeat packet every HEARTBEAT_INTERVAL ms
}
```

---

### 2. Felicita Scale
**File**: [`src/classes/devices/felicitaScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/felicitaScale.ts)

| Property | Value |
|----------|-------|
| Device Name | Contains "felicita" |
| Service UUID | `FFE0` |
| Characteristic UUID | `FFE1` |

**Device Detection**:
```typescript
public static test(device: any): boolean {
  return device?.name?.toLowerCase().includes('felicita');
}
```

**Weight Parsing** (18-byte status update):
```typescript
// Status update format (indices):
// [0-7]: Unknown/header
// [8]: Weight byte 1 (MSB)
// [9]: Weight byte 2 (LSB)  
// [10-17]: Other status data

const weight = (statusUpdate[8] << 8) + statusUpdate[9];
// Adjust for unit/precision settings
```

**Commands**:
```typescript
const CMD_TARE = 0x54;           // Tare
const CMD_TOGGLE_UNIT = 0x55;    // Toggle g/oz
const CMD_TOGGLE_PRECISION = 0x44; // Toggle precision
const CMD_TIMER_START = 0x53;   // Start timer
const CMD_TIMER_STOP = 0x50;    // Stop/pause timer
const CMD_TIMER_RESET = 0x43;   // Reset timer
```

---

### 3. Timemore Scale
**File**: [`src/classes/devices/timemoreScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/timemoreScale.ts)

| Property | Value |
|----------|-------|
| Device Name | Contains "timemore scale" |
| Service UUID | `181d` |
| Read Characteristic UUID | `2a9d` |
| Command Characteristic UUID | `553f4e49-bf21-4468-9c6c-0e4fb5b17697` |

**Special Feature**: Supports two simultaneous weight measurements.

**Connection**:
```typescript
public override async connect() {
  this.supportsTwoWeights = true;
  await this.attachNotification();
}
```

**Tare Command**:
```typescript
public override async tare() {
  await this.write(new Uint8Array([0x00]));
}
```

---

### 4. Skale (by Atomax)
**File**: [`src/classes/devices/skale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/skale.ts)

| Property | Value |
|----------|-------|
| Device Name | Starts with "skale" |
| Service UUID | `FF08` |
| Write Characteristic UUID | `EF80` |
| Read Characteristic UUID | `EF81` |

**Commands**:
```typescript
// Tare
const TARE = [0x10];

// Timer commands
const TIMER_START = [0x14];
const TIMER_STOP = [0x15];
const TIMER_RESET = [0x16];

// LED control
const LED_ON = [0x0D, 0x01];
const LED_OFF = [0x0D, 0x00];

// Set to grams
const SET_GRAMS = [0x0C, 0x00];
```

---

### 5. Hiroia Jimmy Scale
**File**: [`src/classes/devices/jimmyScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/jimmyScale.ts)

| Property | Value |
|----------|-------|
| Device Name | Starts with "hiroia" |
| Service UUID | `06c31822-8682-4744-9211-febc93e3bece` |
| Write Characteristic UUID | `06c31823-8682-4744-9211-febc93e3bece` |
| Read Characteristic UUID | `06c31824-8682-4744-9211-febc93e3bece` |

**Modes**:
```typescript
enum JimmyMode {
  SCALE_ONLY = 0x01,
  TIMER_SCALE = 0x02,
  POUR_OVER = 0x03,
  ESPRESSO_1 = 0x04,
  ESPRESSO_2 = 0x05,
  ESPRESSO_3 = 0x06,
}

enum JimmyUnit {
  GRAMM = 'g',
  OUNCE = 'oz',
}
```

**Commands**:
```typescript
// Tare (send twice with 200ms delay)
const TARE = [0x07, 0x00];

// Timer
const TIMER_START = [0x05, 0x01];
const TIMER_STOP = [0x05, 0x00];
const TIMER_RESET = [0x06, 0x00];
```

**Connection sequence**:
```typescript
await this.attachNotification();
await sleep(500);
await this.setUnit(JimmyUnit.GRAMM);
await this.setMode(JimmyMode.SCALE_ONLY);
```

---

### 6. Eureka Precisa Scale
**File**: [`src/classes/devices/eurekaPrecisaScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/eurekaPrecisaScale.ts)

| Property | Value |
|----------|-------|
| Device Names | "PRECISA", "EUREKA-PREC" |
| Service UUID | `FFE5` |
| Characteristic UUID | `FFE9` |

**Commands**:
```typescript
const CMD_HEADER = 0xAA;
const CMD_BASE = 0x02;
const CMD_TARE = 0x02;

// Tare command: [0xAA, 0x02, 0x02, 0x02]
```

---

### 7. Smartchef Scale
**File**: [`src/classes/devices/smartchefScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/smartchefScale.ts)

| Property | Value |
|----------|-------|
| Device Name | "smartchef" |
| Service UUID | `FFF0` |
| Characteristic UUID | `FFF1` |

**Notes**: Read-only scale - does not support tare or timer commands via BLE.

---

### 8. DiFluid Microbalance
**File**: [`src/classes/devices/difluidMicrobalance.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/difluidMicrobalance.ts)

| Property | Value |
|----------|-------|
| Device Name | Contains "microbalance" |
| Service UUID | `00DD` |
| Characteristic UUID | `AA01` |

**Connection sequence**:
```typescript
await this.attachNotification();
await sleep(100);
await this.setUnitToGram();
await sleep(100);
await this.enableAutoNotifications();
```

---

### 9. DiFluid Microbalance Ti
**File**: [`src/classes/devices/difluidMicrobalanceTi.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/difluidMicrobalanceTi.ts)

| Property | Value |
|----------|-------|
| Device Names | "microbalance ti", "mb ti" |
| Service UUID | `00DD` |
| Characteristic UUID | `AA01` |

---

### 10. Varia AKU Scale
**File**: [`src/classes/devices/variaAku.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/variaAku.ts)

| Property | Value |
|----------|-------|
| Device Name | Contains "varia_aku" |
| Service UUID | `1920` |
| Read Characteristic UUID | `2B11` |
| Command Characteristic UUID | `2B12` |

---

### 11. Blackcoffee Scale
**File**: [`src/classes/devices/blackcoffeeScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/blackcoffeeScale.ts)

| Property | Value |
|----------|-------|
| Device Name | "Blackcoffee" |
| Service UUID | `FFE0` |
| Characteristic UUID | `FFE1` |

---

### 12. Espressi Scale
**File**: [`src/classes/devices/espressiScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/espressiScale.ts)

| Property | Value |
|----------|-------|
| Device Name | Contains "espressi" |
| Read Service UUID | Custom UUID |
| Read Characteristic UUID | Custom UUID |

**Weight parsing** (same as Decent):
```typescript
if (uScaleData[1] === 0xce || uScaleData[1] === 0xca) {
  const newWeight = dataview.getInt16(2, false) ?? 0;
  const weightIsStable = uScaleData[1] === 0xce;
  this.setWeight(newWeight / 10.0, weightIsStable);
}
```

---

### 13. WeighMyBru Scale
**File**: [`src/classes/devices/weighMyBruScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/weighMyBruScale.ts)

| Property | Value |
|----------|-------|
| Device Name | "WeighMyBru" |
| Service UUID | `6e400001-b5a3-f393-e0a9-e50e24dcca9e` |
| Read Characteristic UUID | `6e400004-b5a3-f393-e0a9-e50e24dcca9e` |
| Command Characteristic UUID | `6e400003-b5a3-f393-e0a9-e50e24dcca9e` |

**Commands**:
```typescript
// Tare
[0x03, 0x0a, 0x01, 0x01, 0x00]

// Timer
const TIMER_START = [0x03, 0x0a, 0x02, 0x01, 0x00];
const TIMER_STOP = [0x03, 0x0a, 0x03, 0x01, 0x00];
const TIMER_RESET = [0x03, 0x0a, 0x04, 0x01, 0x00];
```

---

### 14. Futula Scale
**File**: [`src/classes/devices/futulaScale.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/futulaScale.ts)

| Property | Value |
|----------|-------|
| Device Names | "LFSmart Scale", "lefu" |
| Scale Service UUID | `fff0` |
| Command Characteristic UUID | `fff1` |
| Weight Characteristic UUID | `fff4` |
| Battery Service UUID | `180f` |
| Battery Characteristic UUID | `2a19` |

**Commands** (hex strings):
```typescript
const RESET_COMMAND = 'fd320000000000000000cf';
const UNIT_GRAM_COMMAND = 'fd000400000000000000f9';
```

---

## Pressure Sensors

### Supported Pressure Devices (excluding Bookoo already implemented)

---

### 1. Popsicle Pressure (Smart Espresso Profiler)
**File**: [`src/classes/devices/popsiclePressure.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/popsiclePressure.ts)

| Property | Value |
|----------|-------|
| Pressure Service UUID | `1c47e896-4922-4030-957c-32a5be64d3ba` |
| Pressure Characteristic UUID | `2A6D` (128-bit version) |
| Zero Service UUID | `1c47e896-4922-4030-957c-32a5be64d3ba` |
| Zero Characteristic UUID | `ad029632-366d-4a52-ad6b-2a52fb369d3d` |

**Device Detection** (via advertising data):
```typescript
public static test(device: LimitedPeripheralData) {
  const adv = parseAdvertisingManufacturerData(device.advertising);
  return adv && adv.length >= 2 && adv[0] === 0x0c && adv[1] === 0x01;
}
```

**Pressure Parsing**:
```typescript
private attachNotification() {
  ble.startNotification(
    this.device_id,
    PopsiclePressure.PRESSURE_SERVICE_UUID,
    PopsiclePressure.PRESSURE_CHAR_UUID,
    async (_data: any) => {
      const v = new Float32Array(_data);
      const psi = v[0];  // Raw value in PSI
      this.setPressure(psiToBar(psi), _data, v);  // Convert to bar
    }
  );
}
```

**Zero/Tare**:
```typescript
public updateZero(): Promise<void> {
  const data = new Uint8Array(1);
  return ble.writeWithoutResponse(
    this.device_id,
    PopsiclePressure.ZERO_SERVICE_UUID,
    PopsiclePressure.ZERO_CHAR_UUID,
    data.buffer
  );
}
```

---

### 2. Transducer Direct Pressure
**File**: [`src/classes/devices/transducerDirectPressure.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/transducerDirectPressure.ts)

| Property | Value |
|----------|-------|
| Pressure Service UUID | `1c47e896-4922-4030-957c-32a5be64d3ba` |
| Pressure Characteristic UUID | `2A6D` (128-bit) |
| Zero Service UUID | `1c47e896-4922-4030-957c-32a5be64d3ba` |
| Zero Characteristic UUID | `ad029632-366d-4a52-ad6b-2a52fb369d3d` |

**Device Detection** (via manufacturer data):
```typescript
public static test(device: LimitedPeripheralData) {
  const adv = parseAdvertisingManufacturerData(device.advertising);
  return adv && adv.length >= 2 && adv[0] === 0x0c && adv[1] === 0x01;
}
```

**Pressure Parsing**:
```typescript
private attachNotification() {
  ble.startNotification(
    this.device_id,
    PRESSURE_SERVICE_UUID,
    PRESSURE_CHAR_UUID,
    (_data: any) => {
      const v = new Int16Array(_data);
      const psi = swap16(v[0]) / 10;  // Swap bytes, divide by 10
      this.setPressure(psiToBar(psi), _data, v);
    }
  );
}

function swap16(val: any) {
  return ((val & 0xFF) << 8) | ((val >> 8) & 0xFF);
}
```

---

### 3. PRS Pressure (Pressensor)
**File**: [`src/classes/devices/prsPressure.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/prsPressure.ts)

| Property | Value |
|----------|-------|
| Device Name | Contains "PRS" |
| Pressure Service UUID | `1c47e896-4922-4030-957c-32a5be64d3ba` |
| Pressure Characteristic UUID | `beb5483e-36e1-4688-b7f5-ea07361b26a8` |
| Zero Service UUID | `1c47e896-4922-4030-957c-32a5be64d3ba` |
| Zero Characteristic UUID | `ad029632-366d-4a52-ad6b-2a52fb369d3d` |

**Pressure Parsing**:
```typescript
private attachNotification() {
  ble.startNotification(
    this.device_id,
    PrsPressure.PRESSURE_SERVICE_UUID,
    PrsPressure.PRESSURE_CHAR_UUID,
    async (_data: any) => {
      const pressureData = new Uint8Array(_data);
      const val = (pressureData[0] << 8) + pressureData[1];  // Big-endian
      
      let actualPressure: any = 0;
      if (val >= 0x8000) {
        // Negative value (2's complement)
        actualPressure = -1 * (0xffff - val + 1);
      } else {
        actualPressure = val;
      }
      
      actualPressure = actualPressure / 1000;  // Convert to bar
      this.setPressure(actualPressure, _data, val);
    }
  );
}
```

**Connection sequence**:
```typescript
public connect() {
  setTimeout(() => {
    this.updateZero().catch(() => {});
  }, 1000);
}
```

---

### 4. CoffeeSensor Pressure (Smart Espresso Profiler - ESPROFILE)
**File**: [`src/classes/devices/coffeeSensorPressure.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/coffeeSensorPressure.ts)

| Property | Value |
|----------|-------|
| Device Name | "ESPROFILE" |
| Data Service UUID | `777b5132-9f56-4850-a14b-34c8df44901a` |
| Combined Characteristic UUID | `11282dae-6e9c-4223-b6d7-c67878832826` |
| Atmospheric Offset | 0.98 bar |

**Combined Data Layout** (18 bytes, little-endian):
```
Offset  Type    Description
0       uint32  timestampMilliseconds
4       float   probeTemperatureCelsius
8       float   pressureBarAbsolute
12      float   boardTemperatureCelsius
16      uint8   batteryPercent (0-100)
17      uint8   flags (bit 0 = chargingBit)
```

**Pressure Parsing**:
```typescript
private parseCombinedUpdate(view: DataView) {
  if (view.byteLength < 18) return;
  
  const pressureBarAbsolute = view.getFloat32(8, true);  // Little-endian float
  const pressureBar = pressureBarAbsolute - 0.98;  // Subtract atmospheric
  const batteryPercent = view.getUint8(16);
  
  this.batteryLevel = batteryPercent;
  this.setPressure(pressureBar, view.buffer, new Float32Array([pressureBar]));
}
```

**Note**: This device does NOT support hardware zeroing - it's a no-op.

---

### 5. Bookoo Espresso Monitor Pressure
**File**: [`src/classes/devices/bookooPressure.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/bookooPressure.ts)

*Already implemented in Coffee-Dial. Included for reference.*

| Property | Value |
|----------|-------|
| Device Name | "bookoo_em" |
| Pressure Service UUID | `0FFF` |
| Command Characteristic UUID | `FF01` |
| Pressure Characteristic UUID | `FF02` |
| Power Characteristic UUID | `FF03` |

**Enable/Disable Transmission**:
```typescript
// Enable
const enableCmd = new Uint8Array([0x02, 0x0c, 0x01, 0x00, 0x00, 0x00, 0x0f]);

// Disable  
const disableCmd = new Uint8Array([0x02, 0x0c, 0x00, 0x00, 0x00, 0x00, 0x0e]);
```

**Pressure Parsing** (10-byte packets):
```typescript
if (_data.byteLength === 10) {
  const pressureData = new Uint8Array(_data);
  const val = (pressureData[4] << 8) + pressureData[5];  // Big-endian at offset 4-5
  const actualPressure = val / 100;  // Divide by 100 for bar
  this.setPressure(actualPressure, _data, val);
}
```

---

## Temperature Sensors

### Supported Temperature Devices

---

### 1. ETI ThermaQ Blue
**File**: [`src/classes/devices/etiTemperature.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/etiTemperature.ts)

| Property | Value |
|----------|-------|
| Device Names | "THERMAQBLUE", "THERMAQ BLUE" |
| Service UUID | `45544942-4c55-4554-4845-524db87ad700` |
| Channel 1 Temp Characteristic | `45544942-4c55-4554-4845-524db87ad701` |
| Channel 2 Temp Characteristic | `45544942-4c55-4554-4845-524db87ad703` |
| Channel 1 Config Characteristic | `45544942-4C55-4554-4845-524DB87AD707` |
| Channel 2 Config Characteristic | `45544942-4c55-4554-4845-524db87ad708` |
| Device Config Characteristic | `45544942-4c55-4554-4845-524db87ad709` |

**Temperature Parsing** (IEEE 754 Little-Endian Float):
```typescript
private parseStatusUpdate(temperatureRawStatus: Float32Array) {
  const temperatureString = temperatureRawStatus.toString();
  const temperature = parseFloat(temperatureString).toFixed(1);  // 1 decimal place
  this.setTemperature(temperature, temperatureRawStatus);
}

// Notification setup
ble.startNotification(
  this.device_id,
  ETITemperature.TEMPERATURE_SERVICE_UUID,
  ETITemperature.TEMPERATURE_CHANNEL_1_TEMP_CHAR_UUID,
  async (_data: any) => {
    this.parseStatusUpdate(new Float32Array(_data));  // Note: Float32Array
  }
);
```

---

### 2. Meater Thermometer (Original)
**File**: [`src/classes/devices/meaterThermometer.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/meaterThermometer.ts)

| Property | Value |
|----------|-------|
| Device Name | Starts with "MEATER" |
| Service UUID | `a75cc7fc-c956-488f-ac2a-2dbc08b63a04` |
| Characteristic UUID | `7edda774-045e-4bbf-909b-45d1991a2876` |

**Note**: Only original Meater supported - NOT Meater+ or Meater 2.

**Temperature Parsing**:
```typescript
private parseStatusUpdate(temperatureRawStatus: Uint8Array) {
  const tipTemperature = 
    (temperatureRawStatus[0] + temperatureRawStatus[1] * 256 + 8) / 16;
  // Formula: ((LSB + MSB*256) + 8) / 16
  this.setTemperature(tipTemperature, temperatureRawStatus);
}
```

---

### 3. Combustion Thermometer
**File**: [`src/classes/devices/combustionThermometer.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/combustionThermometer.ts)

| Property | Value |
|----------|-------|
| Device Name | "Combustion Inc" |
| Service UUID | `00000100-CAAB-3792-3D44-97AE51C1407A` |
| Characteristic UUID | `00000101-CAAB-3792-3D44-97AE51C1407A` |
| Bits Per Temperature | 13 |

**Device Detection** (requires advertising data parsing):
```typescript
public static test(bleDevice: any): boolean {
  // iOS
  if (Capacitor.getPlatform() === 'ios') {
    return bleDevice?.advertising?.kCBAdvDataServiceUUIDs?.indexOf(
      '00000100-CAAB-3792-3D44-97AE51C1407A'
    ) >= 0;
  }
  // Android
  const decoder = new AdvertisementDecoder();
  const parsed = decoder.decode(bleDevice.advertising);
  return parsed.advDataManufacturerId === 2503 && 
         parsed.advDataManufacturerPayload[0] === 1;
}
```

**Data Structure** (23 bytes):
```
Offset  Size    Description
0-7     8       Log range (2x uint32)
8-20    13      Temperature data (8 temps x 13 bits)
21      1       Mode byte (mode, color, id)
22      1       Battery + Virtual sensors config
```

**Temperature Parsing** (13-bit packed values):
```typescript
public readTemperatures(uint8Array): number[] {
  let result = [];
  let buffer = 0;
  let bufferLength = 0;
  
  for (let i = 0; i < uint8Array.length; i++) {
    buffer = (uint8Array[i] << bufferLength) | buffer;
    bufferLength += 8;
    
    if (bufferLength >= 13) {  // bitsPerTemperature
      const value = buffer & ((1 << 13) - 1);
      result.push(this.convertToTemperature(value));
      buffer = buffer >> 13;
      bufferLength -= 13;
    }
  }
  return result;
}

public convertToTemperature(raw: number): number {
  const convert = raw * 0.05 - 20;  // Scale and offset
  return Math.round(convert * 200) / 200;  // Round to 0.05
}
```

**Virtual Sensors** (decoded from byte 22):
```typescript
const virtualSensors = {
  coreIndex: (byte[22] >> 1) & 0b111,
  surfaceIndex: (byte[22] >> 4) & 0b11,
  ambientIndex: (byte[22] >> 6) & 0b11,
};
// Use core temperature: temperatures[virtualSensors.coreIndex]
```

---

### 4. Basic Grill Thermometer
**File**: [`src/classes/devices/basicGrillThermometer.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/basicGrillThermometer.ts)

| Property | Value |
|----------|-------|
| Device Name | Starts with "BLE#0x" |
| Service UUID | `1000` |
| Characteristic UUID | `1002` |

**Temperature Parsing** (XOR-encoded):
```typescript
private parseStatusUpdate(temperatureRawStatus: Uint8Array) {
  const temperature = 
    (temperatureRawStatus[0] ^ temperatureRawStatus[2] ^ temperatureRawStatus[8]) * 10 +
    (temperatureRawStatus[0] ^ temperatureRawStatus[2] ^ temperatureRawStatus[9]);
  this.setTemperature(temperature, temperatureRawStatus);
}
```

---

### 5. Argos Thermometer
**File**: [`src/classes/devices/argosThermometer.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/argosThermometer.ts)

| Property | Value |
|----------|-------|
| Device Name | Starts with "argos" |
| Service UUID | `1809` (Health Thermometer Service) |
| Characteristic UUID | `2A1C` (Temperature Measurement) |

---

### 6. Geisinger Brühthermometer
**File**: [`src/classes/devices/geisingerThermometer.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/geisingerThermometer.ts)

| Property | Value |
|----------|-------|
| Device Name | "Geisinger Bruehthermometer" |
| Service UUID | `B04F237A-B949-4E36-BF48-500017B198EE` |
| Temperature Characteristic | `D76A5CBF-5981-4AC1-B288-917872EC2449` |
| Runtime Characteristic | `AE87A94D-AC58-4C03-AD80-6C9843FACC9C` |
| Battery Characteristic | `783DE3D7-BDD3-4C77-85CB-DBD5DD0B3280` |
| Status Characteristic | `C6B531B4-0F1D-46FF-A67C-CB0586928DC2` |

**Temperature Parsing** (UTF-8 text):
```typescript
private parseTemperatureUpdate(data: Uint8Array) {
  const text = new TextDecoder('utf-8').decode(data);
  const temp = parseFloat(text);
  if (!isNaN(temp)) {
    this.setTemperature(temp, data);
  }
}
```

---

### 7. CoffeeSensor Temperature (ESPROFILE)
**File**: [`src/classes/devices/coffeeSensorTemperature.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/coffeeSensorTemperature.ts)

| Property | Value |
|----------|-------|
| Device Name | "ESPROFILE" |
| Data Service UUID | `777b5132-9f56-4850-a14b-34c8df44901a` |
| Combined Characteristic | `11282dae-6e9c-4223-b6d7-c67878832826` |
| Individual Temperature Char | `2A6E` |
| Individual Pressure Char | `2A6D` |
| Board Temp Characteristic | `B3A976FF-E863-42F5-B9E9-52967358E6F3` |

**Combined Data Layout** (same as CoffeeSensorPressure):
```
Offset  Type    Description
0       uint32  timestampMilliseconds
4       float   probeTemperatureCelsius  <-- Use this for temperature
8       float   pressureBarAbsolute
12      float   boardTemperatureCelsius
16      uint8   batteryPercent
17      uint8   flags
```

**Temperature Parsing**:
```typescript
private parseCombinedUpdate(view: DataView) {
  if (view.byteLength < 18) return;
  const probeTemp = view.getFloat32(4, true);  // Little-endian at offset 4
  this.setTemperature(probeTemp, view.buffer);
}
```

---

## Common Utilities

### UUID Conversion
**File**: [`src/classes/devices/common/util.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/common/util.ts)

```typescript
// Convert short UUID to 128-bit
export function to128bitUUID(short: string): string {
  return `0000${short.toLowerCase()}-0000-1000-8000-00805f9b34fb`;
}
```

### Advertising Data Parsing
```typescript
export function parseAdvertisingManufacturerData(advertising: any): Uint8Array | null {
  // Platform-specific parsing of BLE advertising data
}
```

### Update Rate Limiting
All device classes limit update frequency:
```typescript
const UPDATE_EVERY_MS = 1000 / 10;  // 10 Hz max update rate

protected setPressure/setTemperature(...) {
  if (Date.now() - this.lastSetTime < UPDATE_EVERY_MS) {
    return;  // Skip update
  }
  this.lastSetTime = Date.now();
  // ... process update
}
```

---

## Implementation Notes

### Device Factory Pattern
**File**: [`src/classes/devices/index.ts`](https://github.com/graphefruit/beanconqueror/tree/main/src/classes/devices/index.ts)

```typescript
export enum PressureType {
  POPSICLE = 'POPSICLE',
  DIRECT = 'DIRECT',
  PRS = 'PRS',
  BOKOOPRESSURE = 'BOKOOPRESSURE',
  COFFEESENSOR = 'COFFEESENSOR',
}

export enum TemperatureType {
  ETI = 'ETI',
  BASICGRILL = 'BASICGRILL',
  MEATER = 'MEATER',
  COMBUSTION = 'COMBUSTION',
  ARGOS = 'ARGOS',
  GEISINGER = 'GEISINGER',
  COFFEESENSOR = 'COFFEESENSOR',
}

export function makePressureDevice(type: PressureType, data: PeripheralData): PressureDevice | null {
  switch (type) {
    case PressureType.POPSICLE: return new PopsiclePressure(data);
    case PressureType.DIRECT: return new TransducerDirectPressure(data);
    case PressureType.PRS: return new PrsPressure(data);
    case PressureType.BOKOOPRESSURE: return new BookooPressure(data);
    case PressureType.COFFEESENSOR: return new CoffeeSensorPressure(data);
    default: return null;
  }
}

export function makeTemperatureDevice(type: TemperatureType, data: PeripheralData): TemperatureDevice | null {
  switch (type) {
    case TemperatureType.ETI: return new ETITemperature(data);
    case TemperatureType.BASICGRILL: return new BasicGrillThermometer(data);
    case TemperatureType.MEATER: return new MeaterThermometer(data);
    case TemperatureType.COMBUSTION: return new CombustionThermometer(data);
    case TemperatureType.ARGOS: return new ArgosThermometer(data);
    case TemperatureType.GEISINGER: return new GeisingerThermometer(data);
    case TemperatureType.COFFEESENSOR: return new CoffeeSensorTemperature(data);
    default: return null;
  }
}
```

### BLE Connection Pattern (Cordova BLE Plugin)
```typescript
// Scan for devices
ble.scan([], seconds, successCallback, errorCallback);

// Connect
ble.connect(deviceId, connectCallback, disconnectCallback);

// Auto-connect (for reconnection)
ble.autoConnect(deviceId, connectCallback, disconnectCallback);

// Start notifications
ble.startNotification(deviceId, serviceUUID, charUUID, successCallback, errorCallback);

// Stop notifications  
ble.stopNotification(deviceId, serviceUUID, charUUID, successCallback, errorCallback);

// Write with response
ble.write(deviceId, serviceUUID, charUUID, data.buffer, successCallback, errorCallback);

// Write without response (faster)
ble.writeWithoutResponse(deviceId, serviceUUID, charUUID, data.buffer, successCallback, errorCallback);

// Disconnect
ble.disconnect(deviceId, successCallback, errorCallback);
```

### Web Bluetooth Adaptation Notes

For Coffee-Dial, adapt the Cordova BLE patterns to Web Bluetooth API:

```javascript
// Web Bluetooth equivalent
navigator.bluetooth.requestDevice({
  filters: [{ services: [serviceUUID] }],
  // OR filter by name
  filters: [{ namePrefix: 'DEVICE_NAME' }]
});

// Connect
const server = await device.gatt.connect();
const service = await server.getPrimaryService(serviceUUID);
const characteristic = await service.getCharacteristic(charUUID);

// Start notifications
await characteristic.startNotifications();
characteristic.addEventListener('characteristicvaluechanged', handler);

// Write
await characteristic.writeValue(buffer);
await characteristic.writeValueWithoutResponse(buffer);  // If supported
```

---

## Priority Implementation Order for Coffee-Dial

### Sprint 5: Pressure Sensors
1. **CoffeeSensor/ESPROFILE** - Smart Espresso Profiler (most comprehensive data)
2. **Bookoo Espresso Monitor** - Already partially implemented
3. **PRS Pressure** - Pressensor
4. **Popsicle Pressure** - SPP

### Sprint 6: Temperature Sensors
1. **ETI ThermaQ Blue** - Professional K-type thermocouple
2. **Combustion Inc** - Advanced BBQ thermometer with virtual sensors
3. **Meater** - Original Meater only
4. **CoffeeSensor Temperature** - If using ESPROFILE device, shares combined characteristic with pressure

---

## References

- Beanconqueror GitHub: https://github.com/graphefruit/Beanconqueror
- Web Bluetooth API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Bluetooth_API
- Bluetooth GATT Services: https://www.bluetooth.com/specifications/gatt/services/
