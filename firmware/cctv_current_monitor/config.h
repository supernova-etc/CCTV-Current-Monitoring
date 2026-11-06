#ifndef CONFIG_H
#define CONFIG_H

// ======================== KONFIGURASI WIFI ========================
const char* WIFI_SSID     = "NAMA_WIFI_BANDARA";
const char* WIFI_PASSWORD = "PASSWORD_WIFI";

// ======================== KONFIGURASI MQTT ========================
// Gunakan broker public untuk demo (misal broker.emqx.io) atau IP lokal server bandara
const char* MQTT_BROKER   = "broker.emqx.io";
const int   MQTT_PORT     = 1883;
const char* MQTT_USER     = "";  // Biarkan kosong jika tanpa autentikasi
const char* MQTT_PASS     = "";

// Topik MQTT
const char* MQTT_TOPIC_DATA   = "bandara/hasanuddin/cctv/ESP32-CCTV-01/telemetry";
const char* MQTT_TOPIC_STATUS = "bandara/hasanuddin/cctv/ESP32-CCTV-01/status";
const char* DEVICE_ID         = "ESP32-CCTV-01";
const char* DEVICE_LOCATION   = "Bandara Sultan Hasanuddin - CCTV Terminal 1 Gate 5";

// ======================== PIN MAPPING SENSOR ========================
// Wajib menggunakan pin ADC1 (tidak bentrok dengan WiFi)
const int PIN_SENSOR_1 = 34; // Sisi Sumber (UPS / Panel)
const int PIN_SENSOR_2 = 35; // Jalur Tengah (Cable Tray)
const int PIN_SENSOR_3 = 32; // Dekat Beban (Adaptor PoE)

// ======================== PARAMETER KALIBRASI ACS712 ========================
// ACS712-05B memiliki sensitivitas ~185 mV/A.
// Karena melewati pembagi tegangan (R1=1k, R2=2k -> faktor 2/3), sensitivitas terukur di ADC ESP32:
// 185 mV/A * (2 / 3) ≈ 123.3 mV/A
const float SENSITIVITY_MV_PER_A = 123.33; 

// Batas ambang arus dianggap NOL (Noise floor filter: 15 mA)
const float ZERO_CURRENT_THRESHOLD = 0.015; 

// Interval pengiriman data (10 Detik)
const unsigned long SEND_INTERVAL_MS = 10000;

#endif

