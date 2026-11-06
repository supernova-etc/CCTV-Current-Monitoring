const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const mqttService = require('./mqtt_service');
const db = require('./database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize MQTT connection
mqttService.init(io);

// Socket.io Connection
io.on('connection', (socket) => {
  console.log(`[Socket.io] Web client connected: ${socket.id}`);
  
  // Send immediate state to newly connected client
  socket.emit('telemetry_update', mqttService.getLatestState());
  socket.emit('history_update', db.getRecentIncidents(20));

  socket.on('disconnect', () => {
    console.log(`[Socket.io] Web client disconnected: ${socket.id}`);
  });
});

// REST APIs
app.get('/api/status', (req, res) => {
  res.json({
    telemetry: mqttService.getLatestState(),
    recent_incidents: db.getRecentIncidents(10)
  });
});

app.get('/api/history', (req, res) => {
  res.json(db.getRecentIncidents(50));
});

// Endpoint to simulate sensor data (ideal for prototype & demonstration without hardware)
app.post('/api/simulate', (req, res) => {
  const { scenario, s1, s2, s3 } = req.body;
  let s1_val = 0.052;
  let s2_val = 0.050;
  let s3_val = 0.048;

  if (scenario === 'NORMAL') {
    s1_val = 0.052;
    s2_val = 0.050;
    s3_val = 0.048;
  } else if (scenario === 'FAULT_SOURCE') {
    s1_val = 0.000;
    s2_val = 0.000;
    s3_val = 0.000;
  } else if (scenario === 'FAULT_MIDPOINT') {
    s1_val = 0.052;
    s2_val = 0.000;
    s3_val = 0.000;
  } else if (scenario === 'FAULT_CCTV') {
    s1_val = 0.052;
    s2_val = 0.050;
    s3_val = 0.000;
  } else {
    // Custom values from manual switches
    s1_val = typeof s1 === 'number' ? s1 : 0.052;
    s2_val = typeof s2 === 'number' ? s2 : 0.050;
    s3_val = typeof s3 === 'number' ? s3 : 0.048;
  }

  const updatedState = mqttService.processTelemetry({
    device_id: 'ESP32-DEMO-SIM',
    location: 'Bandara Sultan Hasanuddin - CCTV Terminal 1',
    interval_sec: 10,
    sensors: {
      sensor_1: { current_rms: s1_val },
      sensor_2: { current_rms: s2_val },
      sensor_3: { current_rms: s3_val }
    }
  }, 'SIMULATION');

  io.emit('history_update', db.getRecentIncidents(20));

  res.json({
    success: true,
    message: `Scenario '${scenario || 'CUSTOM'}' applied successfully`,
    state: updatedState
  });
});

app.post('/api/alarm/ack', (req, res) => {
  db.acknowledgeAll();
  io.emit('history_update', db.getRecentIncidents(20));
  res.json({ success: true, message: 'All active alarm logs acknowledged' });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`Airport CCTV Current Monitoring Server Started`);
  console.log(`Web Dashboard URL: http://localhost:${PORT}`);
  console.log(`=======================================================`);
});

