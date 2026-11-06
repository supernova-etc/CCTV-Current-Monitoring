# Sistem Monitoring Arus Listrik CCTV Bandara Sultan Hasanuddin (Bauhaus Edition)

Sistem pemantauan kontinuitas arus listrik CCTV berbasis IoT (ESP32 + ACS712) dan Web Dashboard interaktif dengan **Denah Instalasi Arsitektural Terminal Bandara** serta desain **Bauhaus Tema Terang (Light Theme)**.

---

## 🎨 Konsep Desain: Bauhaus Light Theme & Architectural Blueprint
* **Filosofi Bauhaus:** *Form follows function*, border geometris tegas (`2.5px solid #121212`), bayangan balok tanpa blur (`box-shadow: 4px 4px 0 #121212`), dan tipografi sans-serif berkarakter kuat (`Space Grotesk`).
* **Warna Primer:** Merah Bauhaus (`#D82B27`), Biru Bauhaus (`#184CB4`), Kuning Bauhaus (`#F2B705`), Hitam (`#121212`), dan kanvas arsitektural krem (`#F5F3ED`).
* **Denah Instalasi Elektrikal MEP (Floorplan):**
  * **Zone A:** Ruang Panel Listrik MDP 220V & Ruang UPS 10kVA (Posisi **Sensor 1**).
  * **Zone B:** Koridor Terminal Keberangkatan & Plafon Cable Tray 150x50mm (Posisi **Sensor 2**).
  * **Zone C:** Ruang Tunggu Gate 5, Counter Boarding Pass, Dinding Kaca Fasad Apron, Tiang CCTV & Adaptor PoE (Posisi **Sensor 3** dan **Kamera CCTV Dome**).

---

## 📁 Struktur Direktori
* [`rules.md`](rules.md) : Spesifikasi teknis, aturan deteksi gangguan, dan protokol komunikasi.
* [`backend/`](backend/) : Server Node.js (Express, Socket.io, MQTT Client, REST API).
  * [`backend/public/index.html`](backend/public/index.html) : Denah instalasi SVG & layout Bauhaus.
  * [`backend/public/style.css`](backend/public/style.css) : Desain sistem Bauhaus tema terang.
  * [`backend/public/app.js`](backend/public/app.js) : Web Audio API siren synthesizer & real-time animation.
* [`firmware/`](firmware/cctv_current_monitor/) : Program ESP32 True RMS AC 50Hz + JSON MQTT.
* [`docs/wiring_diagram.md`](docs/wiring_diagram.md) : Skema pembagi tegangan (*voltage divider*) sensor ACS712 ke ESP32.

---

## 🚀 Cara Menjalankan

1. Masuk ke direktori backend:
   ```powershell
   cd d:\Magang\backend
   ```
2. Jalankan server:
   ```powershell
   node server.js
   ```
3. Buka dashboard di browser:
   👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🕹️ Panduan Pengujian & Simulasi Saklar
1. Tekan tombol **"AKTIFKAN ALARM AUDIO"** di pojok kanan atas browser.
2. Gunakan tombol preset di bawah denah untuk menguji skenario:
   * **NORMAL:** Kabel menyala hijau bergerak, status normal.
   * **PUTUS DI SUMBER:** Ruang Panel & Sensor 1 berdenyut merah, seluruh downstream padam, sirine darurat berbunyi.
   * **PUTUS DI TENGAH:** Kabel koridor terputus di Junction Box Sensor 2.
   * **PUTUS DEKAT CCTV:** Tiang CCTV & Sensor 3 memicu alarm.
3. Tekan **"ACKNOWLEDGE / SENYAPKAN SIRINE"** untuk menghentikan suara alarm.
