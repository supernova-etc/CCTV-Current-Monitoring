const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'incidents_history.json');

class IncidentDatabase {
  constructor() {
    this.incidents = [];
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(DB_PATH)) {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        this.incidents = JSON.parse(raw);
      } else {
        this.incidents = [];
        this.save();
      }
    } catch (err) {
      console.error('[DB] Error loading database, initializing empty:', err.message);
      this.incidents = [];
    }
  }

  save() {
    try {
      fs.writeFileSync(DB_PATH, JSON.stringify(this.incidents, null, 2), 'utf-8');
    } catch (err) {
      console.error('[DB] Error saving database:', err.message);
    }
  }

  addIncident(incident) {
    const entry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      timestamp_local: new Date().toLocaleTimeString('id-ID'),
      system_state: incident.system_state,
      fault_location: incident.fault_location,
      sensors: incident.sensors,
      acknowledged: false,
      acknowledged_at: null
    };

    // Keep the most recent 100 incidents
    this.incidents.unshift(entry);
    if (this.incidents.length > 100) {
      this.incidents.pop();
    }
    this.save();
    return entry;
  }

  getRecentIncidents(limit = 20) {
    return this.incidents.slice(0, limit);
  }

  acknowledge(id) {
    const target = this.incidents.find((item) => item.id === id);
    if (target) {
      target.acknowledged = true;
      target.acknowledged_at = new Date().toISOString();
      this.save();
      return target;
    }
    return null;
  }

  acknowledgeAll() {
    this.incidents.forEach((item) => {
      item.acknowledged = true;
      if (!item.acknowledged_at) {
        item.acknowledged_at = new Date().toISOString();
      }
    });
    this.save();
  }
}

module.exports = new IncidentDatabase();

