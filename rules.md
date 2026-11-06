# Project Rules & Specification
## Current Monitoring System untuk CCTV Bandara Internasional Sultan Hasanuddin

Dokumen ini merupakan acuan resmi spesifikasi arsitektur, standar teknis, skema kelistrikan, protokol komunikasi, serta aturan implementasi perangkat lunak (firmware, backend, dan frontend) untuk sistem pemantauan arus CCTV.

---

### 1. Ringkasan & Tujuan Proyek
* **Nama Proyek:** Airport CCTV Power Current Monitoring & Fault Localization System.
* **Lokasi Implementasi:** Bandara Internasional Sultan Hasanuddin.
* **Tujuan Utama:** Mendeteksi kontinuitas arus listrik AC pada jalur catu daya kamera CCTV dan menentukan secara presisi titik lokasi gangguan (lokalisasi kesalahan) menggunakan 3 titik sensor arus di sepanjang jalur kabel.

---

### 2. Topologi Jalur Listrik & Logika Fault Localization

#### 2.1. Topologi Fisik Jalur Kabel (Single Series Line)
Aliran kelistrikan dari panel distribusi menuju kamera CCTV terbagi menjadi 3 titik ukur sensor:
```
[Sumber Listrik PLN/UPS] 
          │
      [Sensor 1] (Titik Dekat Sumber / Distribution Panel)
          │
      (Bentangan Kabel Jalur / Cable Tray)
          │
      [Sensor 2] (Titik Tengah / Junction Box)
          │
      (Kabel Menuju Beban)
          │
      [Sensor 3] (Titik Dekat Beban / Input Adaptor PoE)
          │
     [Adaptor PoE]
          │
    [Kamera CCTV]
```

#### 2.2. Logika Deteksi Gangguan (Fault Rules)
Penetapan status gangguan ditentukan berdasarkan batas ambang arus (*Current Threshold* $I_{\text{threshold}} \approx 0.015\,\text{A} / 15\,\text{mA}$ untuk mengabaikan noise sensor):

| Kondisi Sensor 1 | Kondisi Sensor 2 | Kondisi Sensor 3 | Status Sistem | Lokasi / Interpretasi Gangguan | Tindakan Alarm UI |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Arus = 0** | Arus = 0 | Arus = 0 | `FAULT_SOURCE` | Gangguan di sekitar **Sumber Energi Listrik / Panel UPS** | Alarm Titik 1 + Audio Sirine |
| **Arus > 0** | **Arus = 0** | Arus = 0 | `FAULT_MIDPOINT` | Gangguan di daerah **Pertengahan Jalur Kabel (Kabel Putus/Saklar Mati)** | Alarm Titik 2 + Audio Sirine |
| **Arus > 0** | **Arus > 0** | **Arus = 0** | `FAULT_CCTV` | Gangguan di sekitar **Adaptor PoE / Titik Dekat CCTV** | Alarm Titik 3 + Audio Sirine |
| **Arus > 0** | **Arus > 0** | **Arus > 0** | `NORMAL` | Aliran listrik normal, CCTV beroperasi penuh | Indikator Hijau (No Audio) |

> **Catatan Simulasi/Demonstrasi:**
> Pada pengujian prototype, pemutusan arus per segmen disimulasikan menggunakan saklar pembatas pada tiap titik agar ketiga skenario kondisi gangguan dapat diuji secara independen.

---

### 3. Spesifikasi Hardware & Instrumentasi ESP32

#### 3.1. Komponen Utama
* **Mikrokontroler:** ESP32 Development Board (30-pin / 38-pin).
* **Sensor Arus:** 3x Module ACS712-05B (Range -5A s.d. +5A, Sensitivitas 185 mV/A).
* **Beban Terukur:** Tegangan AC 220V 50Hz (Input Power Adaptor PoE CCTV).

#### 3.2. Proteksi Tegangan ADC ESP32 (Voltage Divider)
* **Masalah:** Output `VOUT` ACS712 bekerja pada tegangan nominal 5V (2.5V saat nol arus), sedangkan batas aman tegangan ADC ESP32 adalah **3.3V**.
* **Solusi Rangkaian Pembagi Tegangan (Voltage Divider) per Sensor:**
  * Resistor $R_1 = 1\,\text{k}\Omega$ (atau $2\,\text{k}\Omega$) terhubung dari `VOUT` ACS712 ke Pin ADC ESP32.
  * Resistor $R_2 = 2\,\text{k}\Omega$ (atau $3.3\,\text{k}\Omega$) terhubung dari Pin ADC ESP32 ke `GND`.
  * Rasio konversi: $V_{\text{ADC}} = V_{\text{OUT}} \times \frac{R_2}{R_1 + R_2}$.

#### 3.3. Mapping Pin GPIO ESP32
Gunakan pin ADC1 (aman dan tidak bentrok dengan modul WiFi ESP32):
* `GPIO 34` (ADC1_CH6) : Input Sensor 1 (Sumber)
* `GPIO 35` (ADC1_CH7) : Input Sensor 2 (Tengah)
* `GPIO 32` (ADC1_CH4) : Input Sensor 3 (CCTV/PoE)

#### 3.4. Algoritma Pembacaan Firmware
* Menghitung nilai arus efektif **RMS (Root Mean Square)** pada frekuensi AC 50Hz dengan melakukan sampling minimal 1000 sampel dalam beberapa periode gelombang sinus.
* Pengiriman data dilakukan secara berkala **setiap 10 detik** via MQTT.

---

### 4. Spesifikasi Protokol Komunikasi & Payload Data

#### 4.1. MQTT Broker & Topic
* **Protokol:** MQTT v3.1.1 (TCP Port 1883).
* **Topik Publish Data:** `bandara/hasanuddin/cctv/<device_id>/telemetry`
* **Topik Status Perangkat:** `bandara/hasanuddin/cctv/<device_id>/status` (LWT: Last Will and Testament)

#### 4.2. Struktur JSON Payload
```json
{
  "device_id": "ESP32-CCTV-01",
  "location": "Terminal 1 - Area Gate 5",
  "timestamp": 1730900000,
  "interval_sec": 10,
  "sensors": {
    "sensor_1": {
      "name": "Sumber Listrik (UPS/Panel)",
      "current_rms": 0.052,
      "unit": "A",
      "status": "NORMAL"
    },
    "sensor_2": {
      "name": "Jalur Tengah (Cable Tray)",
      "current_rms": 0.050,
      "unit": "A",
      "status": "NORMAL"
    },
    "sensor_3": {
      "name": "Dekat Beban (Adaptor PoE)",
      "current_rms": 0.000,
      "unit": "A",
      "status": "NO_CURRENT"
    }
  },
  "system_state": "FAULT_CCTV",
  "fault_location": "Dekat Adaptor PoE / Kamera CCTV",
  "alarm_active": true
}
```

---

### 5. Arsitektur Perangkat Lunak Web (Backend & Frontend)

#### 5.1. Backend Server (Node.js & Express)
* **MQTT Client:** Menghubungkan ke broker MQTT dan subscribe ke topik telemetry.
* **Websocket Server (Socket.io):** Melakukan *broadcast* data telemetry real-time ke web dashboard setiap kali ada pesan baru dari ESP32.
* **Rule Engine & Database:**
  * Memvalidasi status gangguan.
  * Menyimpan riwayat insiden alarm ke database lokal (SQLite) untuk audit operasional (*Incident History Logging*).
* **REST API Endpoints:**
  * `GET /api/status` : Mendapatkan status telemetri terkini.
  * `GET /api/history` : Mendapatkan riwayat insiden alarm dan durasi pemadaman.
  * `POST /api/alarm/ack` : Mencatat konfirmasi/acknowledgment dari petugas teknisi.

#### 5.2. Frontend Web Application (Dashboard Operator - Bauhaus Light Edition)
* **Desain UI Berkonsep Bauhaus (Tema Terang / Light Theme):**
  * *Filosofi:* Form follows function, garis batas geometris tebal (`2.5px - 3px solid #121212`), drop-shadow tegas tanpa blur (`box-shadow: 4px 4px 0 #121212`), dan tipografi sans-serif geometris tebal (`Space Grotesk`).
  * *Palet Warna Primer Khas Bauhaus:*
    * Canvas Dasar: Warm off-white arsitektural (`#F5F3ED`).
    * Aksen Primer: Merah Bauhaus (`#D82B27`), Biru Bauhaus (`#184CB4`), Kuning Primer (`#F2B705`), dan Hitam Arsitektur (`#121212`).
* **Visualisasi Denah Instalasi Arsitektural Bandara (Floorplan Topology):**
  * Representasi instalasi elektrikal MEP (*Mechanical, Electrical & Plumbing*) dalam bentuk blueprint denah Terminal Bandara Sultan Hasanuddin:
    * **ZONE A (Ruang Panel & UPS):** Dinding teknis, rak baterai UPS 10kVA, panel MDP 220V, dan peletakan **Sensor 1**.
    * **ZONE B (Koridor Keberangkatan):** Struktur pilar beton, arah lalu lintas penumpang, dan bentangan plafon *Cable Tray 150x50mm* memuat **Sensor 2** (Junction Box JB-02).
    * **ZONE C (Waiting Lounge & Boarding Gate 5):** Deretan kursi tunggu, counter boarding pass, dinding kaca fasad apron, serta tiang penopang **Sensor 3** (Adaptor PoE) dan **Kamera CCTV Dome Gate 5**.
  * Efek visual dinamis kabel:
    * Animasi aliran arus hijau (*flowing dashed lines*) saat kondisi normal.
    * Jalur kabel merah berkedip (*wire-fault*) dan kabel padam abu-abu (*wire-dead*) saat terjadi gangguan.
    * Lingkaran denyut merah (*pulsing alarm halo*) pada node sensor yang mendeteksi gangguan.
* **Display Real-Time Current:**
  * Menampilkan nilai Ampere ($A$) dan miliampere ($mA$) untuk Sensor 1, Sensor 2, dan Sensor 3 secara real-time langsung di dalam denah maupun di metric cards.
* **Sistem Alarm Audio & Kebijakan Browser:**
  * Tombol interaktif bergaya Bauhaus **"AKTIFKAN ALARM AUDIO"** di header navigasi.
  * Sirine darurat *dual-tone* (880 Hz / 620 Hz) disintesis langsung menggunakan Web Audio API tanpa perlu file eksternal.
* **Panel Kontrol Simulasi & Audit Log:**
  * Tombol preset skenario cepat dan saklar toggle interaktif untuk pengujian prototype di laboratorium.
  * Tabel riwayat insiden (*incident history*) tersimpan ke database lokal.

---

### 6. Struktur Direktori Proyek Standar
```
d:\Magang/
│
├── rules.md                     # Dokumen aturan & spesifikasi teknis proyek (File ini)
│
├── firmware/                    # Kode Program ESP32
│   └── cctv_current_monitor/
│       ├── cctv_current_monitor.ino
│       └── config.h             # Konfigurasi WiFi, MQTT Broker, dan Pinout
│
├── backend/                     # Server Node.js
│   ├── package.json
│   ├── server.js                # Express & Socket.io server
│   ├── mqtt_service.js          # MQTT listener & parser
│   ├── database.js              # SQLite database & incident logger
│   └── public/                  # Frontend Web Dashboard
│       ├── index.html           # UI Topologi & Monitoring
│       ├── style.css            # Styling visual alarm & animasi topologi
│       ├── app.js               # Logika Socket.io, UI update, dan audio alarm
│       └── sounds/
│           └── alert.mp3        # File audio alarm
│
└── docs/                        # Skema rangkaian & panduan instalasi
    └── wiring_diagram.md
```

---

### 7. Standar Pengujian & Validasi
1. **Pengujian Kalibrasi ACS712:**
   * Melakukan kalibrasi nilai nol (offset 2.5V sebelum pembagi tegangan) pada kondisi tanpa beban.
   * Mengukur beban aktual CCTV dan memvalidasi nilai pembacaan ADC terhadap multimeter digital.
2. **Pengujian Skenario Saklar (Simulasi Gangguan):**
   * Matikan saklar sumber $\rightarrow$ Verifikasi alarm UI menunjukkan titik 1.
   * Nyalakan saklar sumber, matikan saklar tengah $\rightarrow$ Verifikasi alarm UI menunjukkan titik 2.
   * Nyalakan saklar tengah, matikan saklar CCTV $\rightarrow$ Verifikasi alarm UI menunjukkan titik 3.
3. **Pengujian Keandalan Jaringan:**
   * Pengujian auto-reconnect MQTT pada ESP32 jika koneksi WiFi terputus.
   * Pengujian sinkronisasi audio alarm dan status UI saat koneksi kembali pulih.

