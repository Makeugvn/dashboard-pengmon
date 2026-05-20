const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = path.join(__dirname, 'wtp.db');
const db = new Database(DB_PATH);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS devices (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL,
    unit        TEXT,
    min_value   REAL,
    max_value   REAL,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS sensor_readings (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id   TEXT NOT NULL REFERENCES devices(id),
    value       REAL NOT NULL,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );

  CREATE INDEX IF NOT EXISTS idx_readings_device_time
    ON sensor_readings(device_id, recorded_at DESC);

  CREATE TABLE IF NOT EXISTS device_status (
    device_id   TEXT PRIMARY KEY REFERENCES devices(id),
    status      TEXT NOT NULL,
    extra_json  TEXT,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now','localtime'))
  );
`);

const insertDevice = db.prepare(`
  INSERT OR IGNORE INTO devices (id, name, type, unit, min_value, max_value)
  VALUES (?, ?, ?, ?, ?, ?)
`);

const seedDevices = db.transaction(() => {
  insertDevice.run('LT-101', 'Bak Sedimentasi',  'level',    'meter', 0,    4);
  insertDevice.run('LT-102', 'Bak Filter',       'level',    'meter', 0,    3);
  insertDevice.run('PT-201', 'Pipa Inlet',       'pressure', 'bar',   0,    5);
  insertDevice.run('PT-202', 'Pipa Outlet',      'pressure', 'bar',   0,    5);
  insertDevice.run('QT-301', 'TDS Effluent',     'quality',  'ppm',   0,    500);
  insertDevice.run('FT-401', 'Flow Rate Utama',  'flow',     'm3h',   0,    75);
  insertDevice.run('P-01',   'Pompa Inlet',      'pump',     null,    null, null);
  insertDevice.run('P-02',   'Pompa Dosing',     'pump',     null,    null, null);
  insertDevice.run('P-03',   'Pompa Distribusi', 'pump',     null,    null, null);
  insertDevice.run('SV-01',  'Inlet Utama',      'valve',    null,    null, null);
  insertDevice.run('SV-02',  'Pre-Filter',       'valve',    null,    null, null);
  insertDevice.run('SV-03',  'Dosing Kimia',     'valve',    null,    null, null);
  insertDevice.run('SV-04',  'Backwash',         'valve',    null,    null, null);
  insertDevice.run('SV-05',  'Outlet Filter',    'valve',    null,    null, null);
  insertDevice.run('SV-06',  'Drain',            'valve',    null,    null, null);
});

seedDevices();

module.exports = db;
