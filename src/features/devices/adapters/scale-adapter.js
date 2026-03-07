/**
 * Scale BLE Adapter
 * Supports Acaia (old/new protocol), Bookoo, and generic 0xFF10 scales
 */
import { BaseBleDevice } from './base-ble-device.js';

// Service UUIDs
const ACAIA_SERVICE_UUID = '00001820-0000-1000-8000-00805f9b34fb';
const PYXIS_SERVICE_UUID = '49535343-fe7d-4ae5-8fa9-9fafd205e455';
const BOOKOO_SERVICE_UUID = '00000ffe-0000-1000-8000-00805f9b34fb';
const GENERIC_SERVICE_UUID = '0000ff10-0000-1000-8000-00805f9b34fb';

// Characteristic UUIDs
const READ_CHAR_OLD_UUID = '00002a80-0000-1000-8000-00805f9b34fb';
const WRITE_CHAR_OLD_UUID = '00002a80-0000-1000-8000-00805f9b34fb';
const READ_CHAR_NEW_UUID = '49535343-1e4d-4bd9-ba61-23c647249616';
const WRITE_CHAR_NEW_UUID = '49535343-8841-43f4-a8d4-ecbe34729bb3';
const READ_CHAR_GENERIC_UUID = '0000ff11-0000-1000-8000-00805f9b34fb';
const WRITE_CHAR_GENERIC_UUID = '0000ff12-0000-1000-8000-00805f9b34fb';

// Commands
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

const HEARTBEAT_PERIOD_MS = 2750;

export class ScaleAdapter extends BaseBleDevice {
    constructor(options = {}) {
        super('scale', options);
        
        // Scale-specific state
        this._scaleType = 'UNKNOWN'; // OLD, NEW, GENERIC
        this._acaiaBuffer = new Uint8Array(0);
        this._lastWeight = null;
        
        // Timer state
        this._timerRunning = false;
        this._onTimerStateChange = null;
    }
    
    getBleConfig() {
        return {
            filters: [
                { namePrefix: 'ACAIA' },
                { namePrefix: 'Acaia' },
                { namePrefix: 'PEARL' },
                { namePrefix: 'LUNAR' },
                { namePrefix: 'BOOKOO' },
                { namePrefix: 'BOOKO' },
                { namePrefix: 'CINCO' },
                { namePrefix: 'PYXIS' },
                { namePrefix: 'PROCH' }
            ],
            services: [
                ACAIA_SERVICE_UUID,
                PYXIS_SERVICE_UUID,
                BOOKOO_SERVICE_UUID,
                GENERIC_SERVICE_UUID,
                '00001800-0000-1000-8000-00805f9b34fb',
                '00001801-0000-1000-8000-00805f9b34fb',
                '0000180a-0000-1000-8000-00805f9b34fb',
                '0000180f-0000-1000-8000-00805f9b34fb'
            ],
            characteristics: {
                read: [
                    READ_CHAR_OLD_UUID,
                    READ_CHAR_NEW_UUID,
                    READ_CHAR_GENERIC_UUID
                ],
                write: [
                    WRITE_CHAR_OLD_UUID,
                    WRITE_CHAR_NEW_UUID,
                    WRITE_CHAR_GENERIC_UUID
                ]
            }
        };
    }
    
    getSampleKey() {
        return 'w';
    }
    
    get weight() {
        return this._lastWeight;
    }
    
    get scaleType() {
        return this._scaleType;
    }
    
    get isTimerRunning() {
        return this._timerRunning;
    }
    
    // Override to handle scale-specific GATT setup
    async _setupGatt() {
        const services = await this._server.getPrimaryServices();
        
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
        
        // Determine scale type
        if (newReadChar && newWriteChar) {
            this._scaleType = 'NEW';
            this._notifyChar = newReadChar;
            this._writeChar = newWriteChar;
        } else if (oldChar) {
            this._scaleType = 'OLD';
            this._notifyChar = oldChar;
            this._writeChar = oldChar;
        } else if (genericReadChar && genericWriteChar) {
            this._scaleType = 'GENERIC';
            this._notifyChar = genericReadChar;
            this._writeChar = genericWriteChar;
        } else {
            this._setStatus('No compatible scale characteristics found');
            return;
        }
        
        await this._notifyChar.startNotifications();
        this._notifyChar.addEventListener('characteristicvaluechanged', (e) => this._onNotify(e));
        
        await this._onGattSetupComplete();
    }
    
    async _onGattSetupComplete() {
        if (this._scaleType === 'OLD' || this._scaleType === 'NEW') {
            await this._enqueueWrite(IDENTIFY);
            await this._enqueueWrite(NOTIFICATION_REQUEST);
            this._startHeartbeat(HEARTBEAT, HEARTBEAT_PERIOD_MS);
        }
        
        this._setStatus(`Connected to ${this._deviceName} (${this._scaleType})`);
    }
    
    parseNotification(data) {
        const events = [];
        
        // Handle timer events for Acaia/Bookoo
        if (this._scaleType === 'OLD' || this._scaleType === 'NEW') {
            this._handleAcaiaTimerEvent(data, events);
        } else if (this._scaleType === 'GENERIC') {
            this._handleBookooTimerEvent(data, events);
        }
        
        // Parse weight
        let weight = null;
        const l = data.length;
        
        if ((this._scaleType === 'NEW') && (l === 13 || l === 17) && data[4] === 0x05) {
            const raw = ((data[6] & 0xff) << 8) + (data[5] & 0xff);
            const unit = data[9];
            const sign = (data[10] & 0x02) ? -1 : 1;
            weight = (raw / Math.pow(10, unit)) * sign;
        } else if ((this._scaleType === 'OLD') && (l === 10 || l === 14)) {
            const raw = ((data[3] & 0xff) << 8) + (data[2] & 0xff);
            const unit = data[6];
            const sign = (data[7] & 0x02) ? -1 : 1;
            weight = (raw / Math.pow(10, unit)) * sign;
        } else if ((this._scaleType === 'GENERIC') && l === 20) {
            const raw = ((data[7] & 0xff) << 16) | ((data[8] & 0xff) << 8) | (data[9] & 0xff);
            const sign = (data[6] === 45) ? -1 : 1;
            weight = (raw / 100) * sign;
        }
        
        if (weight !== null && Number.isFinite(weight)) {
            this._lastWeight = weight;
        }
        
        return { value: weight, events };
    }
    
    // --- Acaia message parsing ---
    
    _appendAcaiaBuffer(chunk) {
        if (!chunk || chunk.length === 0) return;
        const merged = new Uint8Array(this._acaiaBuffer.length + chunk.length);
        merged.set(this._acaiaBuffer, 0);
        merged.set(chunk, this._acaiaBuffer.length);
        this._acaiaBuffer = merged;
    }
    
    _consumeAcaiaBuffer(startIndex) {
        if (startIndex <= 0) return;
        this._acaiaBuffer = this._acaiaBuffer.slice(startIndex);
    }
    
    _handleAcaiaTimerEvent(data, events) {
        this._appendAcaiaBuffer(data);
        
        let offset = 0;
        while (offset < this._acaiaBuffer.length - 6) {
            let start = -1;
            for (let i = offset; i < this._acaiaBuffer.length - 1; i++) {
                if (this._acaiaBuffer[i] === 0xef && this._acaiaBuffer[i + 1] === 0xdd) {
                    start = i;
                    break;
                }
            }
            
            if (start < 0) {
                this._acaiaBuffer = new Uint8Array(0);
                return;
            }
            
            const payloadLen = this._acaiaBuffer[start + 3];
            const messageEnd = start + payloadLen + 5;
            if (messageEnd > this._acaiaBuffer.length) {
                this._consumeAcaiaBuffer(start);
                return;
            }
            
            const cmd = this._acaiaBuffer[start + 2];
            if (cmd === 0x0c) {
                const msgType = this._acaiaBuffer[start + 4];
                if (msgType === 0x08) {
                    const payload = this._acaiaBuffer.slice(start + 5, messageEnd);
                    if (payload.length >= 2) {
                        const p0 = payload[0];
                        const p1 = payload[1];
                        
                        if (p0 === 0x08 && p1 === 0x05) {
                            events.push('timer-start');
                        } else if (p0 === 0x0a && p1 === 0x07) {
                            events.push('timer-stop');
                        } else if (p0 === 0x09 && p1 === 0x07) {
                            events.push('timer-stop');
                        }
                    }
                }
            }
            
            offset = messageEnd;
        }
        
        if (offset > 0) {
            this._consumeAcaiaBuffer(offset);
        }
    }
    
    _handleBookooTimerEvent(data, events) {
        if (data.length >= 3 && data[0] === 0x03 && data[1] === 0x0a) {
            if (data[2] === 0x04) {
                events.push('timer-start');
            } else if (data[2] === 0x05 || data[2] === 0x06) {
                events.push('timer-stop');
            }
        }
    }
    
    _handleDeviceEvent(event) {
        if (event === 'timer-start') {
            this._timerRunning = true;
            this._onTimerStateChange?.(true);
        } else if (event === 'timer-stop') {
            this._timerRunning = false;
            this._onTimerStateChange?.(false);
        }
    }
    
    // --- Scale-specific commands ---
    
    async tare() {
        if (!this._writeChar) return;
        
        try {
            const cmd = this._scaleType === 'GENERIC' ? TARE_GENERIC : TARE_ACAIA;
            await this._enqueueWrite(cmd);
        } catch (err) {
            console.warn('[scale] Tare failed:', err);
        }
    }
    
    async startTimer() {
        if (!this._writeChar) return;
        
        try {
            if (this._scaleType === 'OLD' || this._scaleType === 'NEW') {
                await this._enqueueWrite(START_TIMER_ACAIA);
            } else if (this._scaleType === 'GENERIC') {
                await this._enqueueWrite(START_TIMER_BOOKOO);
            }
            this._timerRunning = true;
            this._onTimerStateChange?.(true);
        } catch (err) {
            console.warn('[scale] Start timer failed:', err);
        }
    }
    
    async stopTimer() {
        if (!this._writeChar) return;
        
        try {
            if (this._scaleType === 'OLD' || this._scaleType === 'NEW') {
                await this._enqueueWrite(STOP_TIMER_ACAIA);
            } else if (this._scaleType === 'GENERIC') {
                await this._enqueueWrite(STOP_TIMER_BOOKOO);
            }
            this._timerRunning = false;
            this._onTimerStateChange?.(false);
        } catch (err) {
            console.warn('[scale] Stop timer failed:', err);
        }
    }
    
    async resetTimer() {
        if (!this._writeChar) return;
        
        try {
            if (this._scaleType === 'OLD' || this._scaleType === 'NEW') {
                await this._enqueueWrite(RESET_TIMER_ACAIA);
            } else if (this._scaleType === 'GENERIC') {
                await this._enqueueWrite(RESET_TIMER_BOOKOO);
            }
        } catch (err) {
            console.warn('[scale] Reset timer failed:', err);
        }
    }
    
    async toggleTimer() {
        if (this._timerRunning) {
            await this.stopTimer();
        } else {
            await this.startTimer();
        }
    }
    
    // --- Event callbacks ---
    
    onTimerStateChange(callback) {
        this._onTimerStateChange = callback;
    }
}
