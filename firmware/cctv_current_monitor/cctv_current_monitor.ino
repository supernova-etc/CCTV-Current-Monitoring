/*
 * Project: CCTV Current Monitoring & Fault Localization
 * Lokasi: Bandara Internasional Sultan Hasanuddin (UPG)
 * Hardware: ESP32 + 3x Sensor ACS712-05B (dengan Voltage Divider)
 * Protokol: MQTT v3.1.1 JSON Telemetry
 */

#include <WiFi.h>
#include <PubSubClient.h>
#include "config.h"

WiFiClient espClient;
PubSubClient mqttClient(espClient);

unsigned long lastSendTime = 0;

// Nilai tegangan offset ADC saat arus 0 (sekitar 1.67V setelah divider dari 2.5V ACS712)
// Nilai ADC 12-bit (0 - 4095) untuk 1.67V di ESP32: (1.67 / 3.3) * 4095 ≈ 2070
float zeroOffset1 = 2070.0;
float zeroOffset2 = 2070.0;
float zeroOffset3 = 2070.0;

// Fungsi Menghitung Arus RMS AC (50Hz)
float readCurrentRMS(int pin, float zeroOffset) {
  unsigned long startTime = millis();
  float sumSquaredDiff = 0;
  long sampleCount = 0;

  // Sampling selama 60 milidetik (3 periode gelombang AC 50Hz)
  while (millis() - startTime < 60) {
    int rawADC = analogRead(pin);
    // Konversi ADC ke milivolt (ESP32 ADC 3300 mV / 4095)
    float sampleVoltageMV = (rawADC - zeroOffset) * (3300.0 / 4095.0);
    sumSquaredDiff += sampleVoltageMV * sampleVoltageMV;
    sampleCount++;
    delayMicroseconds(50);
  }

  if (sampleCount == 0) return 0.0;

  float meanSquareMV = sumSquaredDiff / sampleCount;
  float rootMeanSquareMV = sqrt(meanSquareMV);

  // Hitung Arus RMS dalam Ampere
  float currentRMS = rootMeanSquareMV / SENSITIVITY_MV_PER_A;

  // Filter noise lantai (jika arus < threshold, anggap nol)
  if (currentRMS < ZERO_CURRENT_THRESHOLD) {
    currentRMS = 0.0;
  }

  return currentRMS;
}

// Kalibrasi Zero Offset saat awal menyala (tanpa beban)
void calibrateZeroOffset() {
  Serial.println("[CALIB] Mengukur baseline offset tegangan ADC...");
  long sum1 = 0, sum2 = 0, sum3 = 0;
  const int calibSamples = 500;

  for (int i = 0; i < calibSamples; i++) {
    sum1 += analogRead(PIN_SENSOR_1);
    sum2 += analogRead(PIN_SENSOR_2);
    sum3 += analogRead(PIN_SENSOR_3);
    delay(2);
  }

  zeroOffset1 = (float)sum1 / calibSamples;
  zeroOffset2 = (float)sum2 / calibSamples;
  zeroOffset3 = (float)sum3 / calibSamples;

  Serial.printf("[CALIB] Offset S1: %.1f | S2: %.1f | S3: %.1f\n", zeroOffset1, zeroOffset2, zeroOffset3);
}

void setupWiFi() {
  delay(10);
  Serial.print("[WIFI] Menghubungkan ke: ");
  Serial.println(WIFI_SSID);

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WIFI] Terhubung!");
    Serial.print("[WIFI] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WIFI] Gagal terhubung (Akan mencoba lagi di background loop).");
  }
}

void reconnectMQTT() {
  if (WiFi.status() != WL_CONNECTED) return;

  while (!mqttClient.connected()) {
    Serial.print("[MQTT] Menghubungkan ke broker...");
    String clientId = String(DEVICE_ID) + "-" + String(random(0xffff), HEX);

    if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS, MQTT_TOPIC_STATUS, 1, true, "OFFLINE")) {
      Serial.println(" Berhasil terhubung!");
      // Publish status online
      mqttClient.publish(MQTT_TOPIC_STATUS, "ONLINE", true);
    } else {
      Serial.print(" Gagal, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" mencoba lagi dalam 5 detik...");
      delay(5000);
      break;
    }
  }
}

void setup() {
  Serial.begin(115200);
  Serial.println("\n=======================================================");
  Serial.println("  AIRPORT CCTV CURRENT MONITORING - BANDARA HASANUDDIN");
  Serial.println("=======================================================");

  // Set resolusi ADC 12-bit dan atenuasi 11dB (rentang ukur 0 - 3.3V)
  analogReadResolution(12);
  analogSetPinAttenuation(PIN_SENSOR_1, ADC_11db);
  analogSetPinAttenuation(PIN_SENSOR_2, ADC_11db);
  analogSetPinAttenuation(PIN_SENSOR_3, ADC_11db);

  calibrateZeroOffset();

  setupWiFi();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
}

void loop() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();

  unsigned long currentMillis = millis();
  if (currentMillis - lastSendTime >= SEND_INTERVAL_MS) {
    lastSendTime = currentMillis;

    // 1. Baca Arus RMS tiap sensor
    float current1 = readCurrentRMS(PIN_SENSOR_1, zeroOffset1);
    float current2 = readCurrentRMS(PIN_SENSOR_2, zeroOffset2);
    float current3 = readCurrentRMS(PIN_SENSOR_3, zeroOffset3);

    // 2. Evaluasi Fault Localization
    String systemState = "NORMAL";
    String faultLocation = "Aliran Listrik Normal";
    bool alarmActive = false;

    if (current1 < ZERO_CURRENT_THRESHOLD) {
      systemState = "FAULT_SOURCE";
      faultLocation = "Gangguan di sekitar Sumber Listrik (Panel / UPS)";
      alarmActive = true;
    } else if (current2 < ZERO_CURRENT_THRESHOLD) {
      systemState = "FAULT_MIDPOINT";
      faultLocation = "Gangguan di daerah Pertengahan Jalur Kabel";
      alarmActive = true;
    } else if (current3 < ZERO_CURRENT_THRESHOLD) {
      systemState = "FAULT_CCTV";
      faultLocation = "Gangguan di sekitar Adaptor PoE / Titik Dekat CCTV";
      alarmActive = true;
    }

    // 3. Susun JSON Payload
    char payload[512];
    snprintf(payload, sizeof(payload),
      "{"
      "\"device_id\":\"%s\","
      "\"location\":\"%s\","
      "\"interval_sec\":10,"
      "\"sensors\":{"
        "\"sensor_1\":{\"current_rms\":%.3f,\"unit\":\"A\",\"status\":\"%s\"},"
        "\"sensor_2\":{\"current_rms\":%.3f,\"unit\":\"A\",\"status\":\"%s\"},"
        "\"sensor_3\":{\"current_rms\":%.3f,\"unit\":\"A\",\"status\":\"%s\"}"
      "},"
      "\"system_state\":\"%s\","
      "\"fault_location\":\"%s\","
      "\"alarm_active\":%s"
      "}",
      DEVICE_ID,
      DEVICE_LOCATION,
      current1, (current1 >= ZERO_CURRENT_THRESHOLD ? "NORMAL" : "NO_CURRENT"),
      current2, (current2 >= ZERO_CURRENT_THRESHOLD ? "NORMAL" : "NO_CURRENT"),
      current3, (current3 >= ZERO_CURRENT_THRESHOLD ? "NORMAL" : "NO_CURRENT"),
      systemState.c_str(),
      faultLocation.c_str(),
      (alarmActive ? "true" : "false")
    );

    // 4. Kirim ke MQTT Broker
    Serial.println("\n[TELEMETRY] Mengirim data ke MQTT Broker:");
    Serial.println(payload);
    mqttClient.publish(MQTT_TOPIC_DATA, payload);
  }
}

