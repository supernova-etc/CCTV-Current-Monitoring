// ============================================================
// BAUHAUS EDITION - APP JAVASCRIPT
// CCTV Current Monitoring - Bandara Sultan Hasanuddin
// ============================================================

const socket = io();

// Audio State
let audioEnabled = false;
let isMuted = false;
let audioCtx = null;
let sirenInterval = null;
let isSirenPlaying = false;

// Audio Synthesizer using Web Audio API (Dual-tone Airport Emergency Alarm)
function initAudio() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContext();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function startSiren() {
  if (!audioEnabled || isMuted || isSirenPlaying) return;
  initAudio();
  if (!audioCtx) return;

  isSirenPlaying = true;
  let highTone = true;

  sirenInterval = setInterval(() => {
    if (!audioEnabled || isMuted) {
      stopSiren();
      return;
    }
    try {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sawtooth';
      // Dual tone alternating: 880 Hz and 620 Hz
      osc.frequency.setValueAtTime(highTone ? 880 : 620, audioCtx.currentTime);

      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.32);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);

      highTone = !highTone;
    } catch (e) {
      console.warn('Audio play error:', e);
    }
  }, 350);
}

function stopSiren() {
  if (sirenInterval) {
    clearInterval(sirenInterval);
    sirenInterval = null;
  }
  isSirenPlaying = false;
}

// DOM Elements: Header & Alarm
const audioBtn = document.getElementById('audio-toggle-btn');
const audioIcon = document.getElementById('audio-icon');
const audioLabel = document.getElementById('audio-label');
const alarmBanner = document.getElementById('alarm-banner');
const alarmTitle = document.getElementById('alarm-title');
const alarmLocation = document.getElementById('alarm-location');
const btnAck = document.getElementById('btn-ack');
const liveClock = document.getElementById('live-clock');
const modeStatus = document.getElementById('mode-status');

// DOM Elements: Floorplan SVG Wires & Nodes
const wire1 = document.getElementById('wire-segment-1');
const wire2 = document.getElementById('wire-segment-2');
const wire3 = document.getElementById('wire-segment-3');
const wire4 = document.getElementById('wire-segment-4');

const svgNodeSource = document.getElementById('node-source');
const svgNodeS1 = document.getElementById('node-sensor-1');
const svgNodeS2 = document.getElementById('node-sensor-2');
const svgNodeS3 = document.getElementById('node-sensor-3');
const svgNodeCctv = document.getElementById('node-cctv');

const svgValS1 = document.getElementById('svg-val-s1');
const svgValS2 = document.getElementById('svg-val-s2');
const svgValS3 = document.getElementById('svg-val-s3');

// DOM Elements: Metrics Cards
const cardS1 = document.getElementById('card-sensor-1');
const cardS2 = document.getElementById('card-sensor-2');
const cardS3 = document.getElementById('card-sensor-3');

const pillS1 = document.getElementById('pill-s1');
const pillS2 = document.getElementById('pill-s2');
const pillS3 = document.getElementById('pill-s3');

const valS1Amp = document.getElementById('val-s1-amp');
const valS1Mamp = document.getElementById('val-s1-mamp');
const barS1 = document.getElementById('bar-s1');

const valS2Amp = document.getElementById('val-s2-amp');
const valS2Mamp = document.getElementById('val-s2-mamp');
const barS2 = document.getElementById('bar-s2');

const valS3Amp = document.getElementById('val-s3-amp');
const valS3Mamp = document.getElementById('val-s3-mamp');
const barS3 = document.getElementById('bar-s3');

const historyTbody = document.getElementById('history-tbody');

// Audio Permission Toggle
audioBtn.addEventListener('click', () => {
  initAudio();
  audioEnabled = !audioEnabled;
  if (audioEnabled) {
    isMuted = false;
    audioBtn.classList.add('active');
    audioIcon.textContent = '🔊';
    audioLabel.textContent = 'ALARM AUDIO: AKTIF';
  } else {
    stopSiren();
    audioBtn.classList.remove('active');
    audioIcon.textContent = '🔇';
    audioLabel.textContent = 'AKTIFKAN ALARM AUDIO';
  }
});

// Acknowledge Alarm
btnAck.addEventListener('click', async () => {
  isMuted = true;
  stopSiren();
  try {
    await fetch('/api/alarm/ack', { method: 'POST' });
  } catch (e) {
    console.error(e);
  }
});

// Live Clock
setInterval(() => {
  const now = new Date();
  liveClock.textContent = now.toLocaleTimeString('id-ID', { hour12: false }) + ' WITA';
}, 1000);

// Helper function to reset wire and node states
function resetFloorplanStyles() {
  [wire1, wire2, wire3, wire4].forEach(w => {
    if (w) {
      w.className.baseVal = 'wire-active';
    }
  });

  [svgNodeSource, svgNodeS1, svgNodeS2, svgNodeS3, svgNodeCctv].forEach(n => {
    if (n) {
      n.classList.remove('alarm');
    }
  });

  [cardS1, cardS2, cardS3].forEach(c => {
    if (c) {
      c.classList.remove('alarm');
    }
  });
}

// Render Telemetry onto SVG Floorplan & Bauhaus Cards
function renderTelemetry(data) {
  if (!data || !data.sensors) return;

  modeStatus.textContent = data.mode || 'LIVE';

  const s1 = data.sensors.sensor_1;
  const s2 = data.sensors.sensor_2;
  const s3 = data.sensors.sensor_3;

  // 1. Update Numeric Values on Metric Cards
  valS1Amp.innerHTML = `${s1.current_rms.toFixed(3)} <small>A</small>`;
  valS1Mamp.textContent = `${(s1.current_rms * 1000).toFixed(1)} mA • Sisi Sumber`;
  barS1.style.width = `${Math.min(100, (s1.current_rms / 0.1) * 100)}%`;

  valS2Amp.innerHTML = `${s2.current_rms.toFixed(3)} <small>A</small>`;
  valS2Mamp.textContent = `${(s2.current_rms * 1000).toFixed(1)} mA • Cable Tray`;
  barS2.style.width = `${Math.min(100, (s2.current_rms / 0.1) * 100)}%`;

  valS3Amp.innerHTML = `${s3.current_rms.toFixed(3)} <small>A</small>`;
  valS3Mamp.textContent = `${(s3.current_rms * 1000).toFixed(1)} mA • Adaptor PoE`;
  barS3.style.width = `${Math.min(100, (s3.current_rms / 0.1) * 100)}%`;

  // 2. Update Direct SVG Floorplan Callouts
  if (svgValS1) svgValS1.textContent = `${s1.current_rms.toFixed(3)}A`;
  if (svgValS2) svgValS2.textContent = `${s2.current_rms.toFixed(3)}A`;
  if (svgValS3) svgValS3.textContent = `${s3.current_rms.toFixed(3)}A`;

  // 3. Reset Styles
  resetFloorplanStyles();

  const state = data.system_state;

  if (state === 'NORMAL') {
    alarmBanner.classList.add('hidden');
    stopSiren();
    isMuted = false;

    pillS1.className = 'box-pill pill-ok';
    pillS1.textContent = 'NORMAL';
    pillS2.className = 'box-pill pill-ok';
    pillS2.textContent = 'NORMAL';
    pillS3.className = 'box-pill pill-ok';
    pillS3.textContent = 'NORMAL';

  } else {
    // FAULT ACTIVE
    alarmBanner.classList.remove('hidden');
    alarmTitle.textContent = `PERINGATAN GANGGUAN: ${state}`;
    alarmLocation.textContent = data.fault_location;

    if (!isMuted && audioEnabled) {
      startSiren();
    }

    if (state === 'FAULT_SOURCE') {
      // Gangguan di Sumber (S1 = 0)
      if (svgNodeSource) svgNodeSource.classList.add('alarm');
      if (svgNodeS1) svgNodeS1.classList.add('alarm');
      if (cardS1) cardS1.classList.add('alarm');

      if (wire1) wire1.className.baseVal = 'wire-fault';
      if (wire2) wire2.className.baseVal = 'wire-dead';
      if (wire3) wire3.className.baseVal = 'wire-dead';
      if (wire4) wire4.className.baseVal = 'wire-dead';

      pillS1.className = 'box-pill pill-bad';
      pillS1.textContent = 'GANGGUAN';
      pillS2.className = 'box-pill pill-bad';
      pillS2.textContent = 'MATI (NO CURRENT)';
      pillS3.className = 'box-pill pill-bad';
      pillS3.textContent = 'MATI (NO CURRENT)';

    } else if (state === 'FAULT_MIDPOINT') {
      // Gangguan di Tengah (S1 > 0, S2 = 0)
      if (svgNodeS2) svgNodeS2.classList.add('alarm');
      if (cardS2) cardS2.classList.add('alarm');

      if (wire1) wire1.className.baseVal = 'wire-active';
      if (wire2) wire2.className.baseVal = 'wire-fault';
      if (wire3) wire3.className.baseVal = 'wire-dead';
      if (wire4) wire4.className.baseVal = 'wire-dead';

      pillS1.className = 'box-pill pill-ok';
      pillS1.textContent = 'NORMAL';
      pillS2.className = 'box-pill pill-bad';
      pillS2.textContent = 'PUTUS DI TENGAH';
      pillS3.className = 'box-pill pill-bad';
      pillS3.textContent = 'MATI (NO CURRENT)';

    } else if (state === 'FAULT_CCTV') {
      // Gangguan di Sekitar CCTV (S1 > 0, S2 > 0, S3 = 0)
      if (svgNodeS3) svgNodeS3.classList.add('alarm');
      if (svgNodeCctv) svgNodeCctv.classList.add('alarm');
      if (cardS3) cardS3.classList.add('alarm');

      if (wire1) wire1.className.baseVal = 'wire-active';
      if (wire2) wire2.className.baseVal = 'wire-active';
      if (wire3) wire3.className.baseVal = 'wire-fault';
      if (wire4) wire4.className.baseVal = 'wire-fault';

      pillS1.className = 'box-pill pill-ok';
      pillS1.textContent = 'NORMAL';
      pillS2.className = 'box-pill pill-ok';
      pillS2.textContent = 'NORMAL';
      pillS3.className = 'box-pill pill-bad';
      pillS3.textContent = 'PUTUS BEBAN';
    }
  }
}

// Render History Table
function renderHistory(incidents) {
  if (!incidents || incidents.length === 0) {
    historyTbody.innerHTML = `<tr><td colspan="5" class="empty-cell">Belum ada riwayat insiden tercatat.</td></tr>`;
    return;
  }

  historyTbody.innerHTML = incidents.map(item => `
    <tr>
      <td><strong>${item.timestamp_local || item.timestamp}</strong></td>
      <td>
        <span class="box-pill ${item.system_state === 'NORMAL' ? 'pill-ok' : 'pill-bad'}">
          ${item.system_state}
        </span>
      </td>
      <td><strong>${item.fault_location}</strong></td>
      <td><code>S1:${item.sensors?.sensor_1?.current_rms ?? '-'}A | S2:${item.sensors?.sensor_2?.current_rms ?? '-'}A | S3:${item.sensors?.sensor_3?.current_rms ?? '-'}A</code></td>
      <td>
        ${item.acknowledged ? '<span style="color: #0E9F6E; font-weight: bold;">✓ DIAKUI</span>' : '<span style="color: #D82B27; font-weight: bold;">⚠ AKTIF</span>'}
      </td>
    </tr>
  `).join('');
}

// Socket.io Events
socket.on('telemetry_update', (data) => {
  renderTelemetry(data);
});

socket.on('history_update', (history) => {
  renderHistory(history);
});

// SIMULATION INTERACTION
const presetButtons = document.querySelectorAll('.preset-bauhaus-btn');
presetButtons.forEach(btn => {
  btn.addEventListener('click', async () => {
    presetButtons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const scenario = btn.getAttribute('data-scenario');

    // Update physical switch UI
    if (scenario === 'NORMAL') {
      document.getElementById('switch-s1').checked = true;
      document.getElementById('switch-s2').checked = true;
      document.getElementById('switch-s3').checked = true;
    } else if (scenario === 'FAULT_SOURCE') {
      document.getElementById('switch-s1').checked = false;
      document.getElementById('switch-s2').checked = false;
      document.getElementById('switch-s3').checked = false;
    } else if (scenario === 'FAULT_MIDPOINT') {
      document.getElementById('switch-s1').checked = true;
      document.getElementById('switch-s2').checked = false;
      document.getElementById('switch-s3').checked = false;
    } else if (scenario === 'FAULT_CCTV') {
      document.getElementById('switch-s1').checked = true;
      document.getElementById('switch-s2').checked = true;
      document.getElementById('switch-s3').checked = false;
    }

    try {
      await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario })
      });
    } catch (e) {
      console.error('Simulation error:', e);
    }
  });
});

// Manual Switch Checkboxes
['switch-s1', 'switch-s2', 'switch-s3'].forEach(id => {
  document.getElementById(id).addEventListener('change', async () => {
    presetButtons.forEach(b => b.classList.remove('active'));

    const s1 = document.getElementById('switch-s1').checked ? 0.052 : 0.000;
    const s2 = document.getElementById('switch-s2').checked ? 0.050 : 0.000;
    const s3 = document.getElementById('switch-s3').checked ? 0.048 : 0.000;

    try {
      await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ s1, s2, s3 })
      });
    } catch (e) {
      console.error('Simulation switch error:', e);
    }
  });
});
