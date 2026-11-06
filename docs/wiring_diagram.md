# Skema Wiring & Petunjuk Rangkaian Hardware
## CCTV Current Monitoring Bandara Sultan Hasanuddin

Dokumen ini menjelaskan koneksi fisik antara sensor arus **ACS712-05B**, rangkaian proteksi **Voltage Divider**, dan **ESP32**.

---

### 1. Skema Rangkaian Sensor & Voltage Divider
Sensor ACS712 bekerja dengan tegangan 5V dan menghasilkan output $V_{\text{out}}$ hingga 5V. Karena pin ADC ESP32 hanya mampu menerima maksimal 3.3V, setiap sensor wajib melewati 2 resistor pembagi tegangan (*Voltage Divider*).

```
   ACS712-05B Module
   ┌─────────────────┐
   │ VCC  (Ke 5V)    │
   │ GND  (Ke GND)   │
   │                 │
   │ VOUT ───────────┴───┐
   └─────────────────┘   │
                         │
                        ┌┴┐
                        │ │ R1 (1 kΩ atau 2 kΩ)
                        │ │
                        └┬┘
                         ├───> Ke Pin ADC ESP32 (GPIO 34 / 35 / 32)
                        ┌┴┐
                        │ │ R2 (2 kΩ atau 3.3 kΩ)
                        │ │
                        └┬┘
                         │
                        GND (ESP32 & Power Supply GND)
```

#### Rumus Perhitungan:
$$V_{\text{ADC}} = V_{\text{OUT}} \times \frac{R_2}{R_1 + R_2}$$

* **Jika menggunakan $R_1 = 1\,\text{k}\Omega$ dan $R_2 = 2\,\text{k}\Omega$:**
  * Saat $V_{\text{OUT}} = 2.5\,\text{V}$ (arus 0): $V_{\text{ADC}} = 2.5 \times \frac{2}{3} \approx 1.67\,\text{V}$ (sangat aman di tengah rentang 0 - 3.3V).
  * Saat $V_{\text{OUT}} = 5.0\,\text{V}$ (arus maksimal): $V_{\text{ADC}} = 5.0 \times \frac{2}{3} \approx 3.33\,\text{V}$ (masih dalam toleransi ESP32).

---

### 2. Tabel Pinout ESP32

| Modul Sensor | Lokasi Fisik | Pin Input ACS712 | Pin ADC ESP32 | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **Sensor 1** | Dekat Sumber Listrik (UPS / Panel) | Output Voltage Divider 1 | **GPIO 34** (ADC1_CH6) | Input-only pin, aman dari WiFi |
| **Sensor 2** | Jalur Tengah (Cable Tray / Junction Box) | Output Voltage Divider 2 | **GPIO 35** (ADC1_CH7) | Input-only pin, aman dari WiFi |
| **Sensor 3** | Dekat Beban (Input Adaptor PoE) | Output Voltage Divider 3 | **GPIO 32** (ADC1_CH4) | ADC1, aman dari WiFi |

> **PENTING:** Jangan gunakan pin ADC2 (GPIO 0, 2, 4, 12, 13, 14, 15, 25, 26, 27) karena pin-pin tersebut tidak bisa membaca analog saat modul WiFi ESP32 aktif! Gunakan pin ADC1 di atas.

---

### 3. Koneksi Jalur Arus AC 220V (Terminal Blok Sensor)
Terminal hijau (screw terminal) pada modul ACS712 dipasang secara **seri** dengan kabel fasa (Live/Hot) 220V PLN:
* **Terminal 1 ACS712:** Dari sumber listrik PLN/UPS.
* **Terminal 2 ACS712:** Menuju jalur berikutnya (kabel bentangan / PoE).
* Kabel Netral (Neutral) dan Ground langsung dihubungkan ke beban seperti biasa.

