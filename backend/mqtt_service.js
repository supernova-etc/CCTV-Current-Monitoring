const mqtt = require('mqtt');
const db = require('./database');

const CURRENT_THRESHOLD = 0.015; // 15 mA threshold for zero current detection

class MqttService {
  constructor() {
    this.client = null;
    this.io = null;
    this.latestState = {
      device_id: 'ESP32-CCTV-01',
      location: 'Bandara Sultan Hasanuddin - CCTV Terminal 1',
      timestamp: Date.now(),
      timestamp_local: new Date().toLocaleTimeString('id-ID'),
      interval_sec: 10,
      mode: 'STANDBY', // 'MQTT_LIVE' | 'SIMULATION' | 'STANDBY'
      sensors: {
        sensor_1: { name: 'Sumber Listrik (UPS/Panel)', current_rms: 0.052, unit: 'A', status: 'NORMAL' },
        sensor_2: { name: 'Jalur Tengah (Cable Tray)', current_rms: 0.050, unit: 'A', status: 'NORMAL' },
        sensor_3: { name: 'Dekat Beban (Adaptor PoE)', current_rms: 0.048, unit: 'A', status: 'NORMAL' }
      },
      system_state: 'NORMAL',
      fault_location: 'Aliran Listrik Normal',
      alarm_active: false
    };
    this.lastFaultState = 'NORMAL';
  }

  init(io, brokerUrl = process.env.MQTT_BROKER || 'mqtt://broker.emqx.io:1883') {
    this.io = io;
    console.log(`[MQTT] Connecting to broker: ${brokerUrl}`);

    try {
      this.client = mqtt.connect(brokerUrl, {
        clientId: `airport_backend_${Math.random().toString(16).slice(2, 8)}`,
        clean: true,
        connectTimeout: 5000,
        reconnectPeriod: 5000
      });

      this.client.on('connect', () => {
        console.log('[MQTT] Connected successfully to MQTT Broker');
        const topic = 'bandara/hasanuddin/cctv/+/telemetry';
        this.client.subscribe(topic, (err) => {
          if (!err) {
            console.log(`[MQTT] Subscribed to topic pattern: ${topic}`);
          } else {
            console.error('[MQTT] Subscription error:', err);
          }
        });
      });

      this.client.on('message', (topic, message) => {
        try {
          const payload = JSON.parse(message.toString());
          this.processTelemetry(payload, 'MQTT_LIVE');
        } catch (e) {
          console.error('[MQTT] Failed to parse message JSON:', e.message);
        }
      });

      this.client.on('error', (err) => {
        console.warn('[MQTT] Connection warning/error:', err.message);
      });

      this.client.on('offline', () => {
        console.warn('[MQTT] Client currently offline. Reconnecting in background...');
      });
    } catch (err) {
      console.error('[MQTT] Initialization error:', err.message);
    }
  }

  evaluateFault(s1_current, s2_current, s3_current) {
    const s1_active = s1_current >= CURRENT_THRESHOLD;
    const s2_active = s2_current >= CURRENT_THRESHOLD;
    const s3_active = s3_current >= CURRENT_THRESHOLD;

    if (!s1_active) {
      return {
        system_state: 'FAULT_SOURCE',
        fault_location: 'Gangguan di sekitar Sumber Listrik (Panel / UPS)',
        alarm_active: true
      };
    } else if (!s2_active) {
      return {
        system_state: 'FAULT_MIDPOINT',
        fault_location: 'Gangguan di daerah Pertengahan Jalur Kabel (Junction Box / Cable Tray)',
        alarm_active: true
      };
    } else if (!s3_active) {
      return {
        system_state: 'FAULT_CCTV',
        fault_location: 'Gangguan di sekitar Adaptor PoE / Titik Dekat CCTV',
        alarm_active: true
      };
    } else {
      return {
        system_state: 'NORMAL',
        fault_location: 'Aliran Listrik Normal, Semua Titik Terhubung',
        alarm_active: false
      };
    }
  }

  processTelemetry(data, mode = 'MQTT_LIVE') {
    const s1_val = Number(data.sensors?.sensor_1?.current_rms ?? data.s1 ?? 0);
    const s2_val = Number(data.sensors?.sensor_2?.current_rms ?? data.s2 ?? 0);
    const s3_val = Number(data.sensors?.sensor_3?.current_rms ?? data.s3 ?? 0);

    const faultEval = this.evaluateFault(s1_val, s2_val, s3_val);

    const s1_status = s1_val >= CURRENT_THRESHOLD ? 'NORMAL' : 'NO_CURRENT';
    const s2_status = s2_val >= CURRENT_THRESHOLD ? 'NORMAL' : 'NO_CURRENT';
    const s3_status = s3_val >= CURRENT_THRESHOLD ? 'NORMAL' : 'NO_CURRENT';

    this.latestState = {
      device_id: data.device_id || 'ESP32-CCTV-01',
      location: data.location || 'Bandara Sultan Hasanuddin - CCTV Terminal 1',
      timestamp: Date.now(),
      timestamp_local: new Date().toLocaleTimeString('id-ID'),
      interval_sec: data.interval_sec || 10,
      mode: mode,
      sensors: {
        sensor_1: {
          name: 'Sumber Listrik (UPS/Panel)',
          current_rms: Number(s1_val.toFixed(3)),
          unit: 'A',
          status: s1_status
        },
        sensor_2: {
          name: 'Jalur Tengah (Cable Tray)',
          current_rms: Number(s2_val.toFixed(3)),
          unit: 'A',
          status: s2_status
        },
        sensor_3: {
          name: 'Dekat Beban (Adaptor PoE)',
          current_rms: Number(s3_val.toFixed(3)),
          unit: 'A',
          status: s3_status
        }
      },
      system_state: faultEval.system_state,
      fault_location: faultEval.fault_location,
      alarm_active: faultEval.alarm_active
    };

    // Log incident on state change to FAULT
    if (faultEval.alarm_active && this.lastFaultState !== faultEval.system_state) {
      db.addIncident(this.latestState);
    }
    this.lastFaultState = faultEval.system_state;

    // Broadcast to web clients via Socket.io
    if (this.io) {
      this.io.emit('telemetry_update', this.latestState);
    }

    return this.latestState;
  }

  getLatestState() {
    return this.latestState;
  }
}

module.exports = new MqttService();

