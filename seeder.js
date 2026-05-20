/**
 * seeder.js — Simulator data sensor
 *
 * Menulis data pembacaan sensor ke SQLite setiap 2 detik.
 * Jalankan di terminal terpisah: node seeder.js
 *
 * NANTI: Ganti fungsi walk() dengan pembacaan dari sensor nyata
 * (PLC via Modbus, MQTT broker, REST API perangkat, dll.)
 * Cukup ubah bagian "BACA SENSOR" di bawah — sisanya tetap sama.
 */

const db = require('./db');

// ── State internal simulator (random walk) ───────────────────
const state = {
  'LT-101': { v: 2.84, noise: 0.07, min: 0.10, max: 3.90 },
  'LT-102': { v: 1.62, noise: 0.05, min: 0.05, max: 2.85 },
  'PT-201': { v: 3.47, noise: 0.11, min: 0.20, max: 4.80 },
  'PT-202': { v: 2.18, noise: 0.09, min: 0.20, max: 4.80 },
  'QT-301': { v: 187,  noise: 4.5,  min: 50,   max: 480  },
  'FT-401': { v: 47.0, noise: 1.4,  min: 5.0,  max: 72.0 },
};

function walk(key) {
  const s = state[key];
  s.v += (Math.random() - 0.5) * s.noise * 2;
  if (s.v < s.min) s.v = s.min + Math.random() * s.noise;
  if (s.v > s.max) s.v = s.max - Math.random() * s.noise;
  return parseFloat(s.v.toFixed(3));
}

// ── Prepared statements ──────────────────────────────────────
const insertReading = db.prepare(`
  INSERT INTO sensor_readings (device_id, value)
  VALUES (@device_id, @value)
`);

const upsertStatus = db.prepare(`
  INSERT INTO device_status (device_id, status, extra_json, updated_at)
  VALUES (@device_id, @status, @extra_json, datetime('now','localtime'))
  ON CONFLICT(device_id) DO UPDATE SET
    status     = excluded.status,
    extra_json = excluded.extra_json,
    updated_at = excluded.updated_at
`);

// Hapus data lama (>24 jam) agar DB tidak membengkak
const cleanup = db.prepare(`
  DELETE FROM sensor_readings
  WHERE recorded_at < datetime('now', '-24 hours', 'localtime')
`);

// ── Insert batch dalam satu transaksi (cepat & aman) ─────────
const writeBatch = db.transaction((readings, statuses) => {
  for (const r of readings) insertReading.run(r);
  for (const s of statuses) upsertStatus.run(s);
  cleanup.run();
});

// ── Status pompa & valve (simulasi sederhana) ────────────────
// NANTI: baca status dari PLC atau I/O digital
function getPumpStatus(id) {
  const running = { 'P-01': true, 'P-02': true, 'P-03': false };
  const isRun = running[id];
  let extra = null;
  if (id === 'P-01' && isRun) {
    const rpm = Math.round(1180 + Math.random() * 100);
    extra = JSON.stringify({ rpm, load: Math.round(rpm / 14.5) });
  } else if (id === 'P-02' && isRun) {
    const spm = Math.round(68 + Math.random() * 8);
    extra = JSON.stringify({ spm, load: spm });
  }
  return { device_id: id, status: isRun ? 'running' : 'standby', extra_json: extra };
}

function getValveStatus(id) {
  const openValves = new Set(['SV-01', 'SV-02', 'SV-03', 'SV-05']);
  return {
    device_id: id,
    status: openValves.has(id) ? 'open' : 'closed',
    extra_json: null,
  };
}

// ── Loop utama ───────────────────────────────────────────────
let tick = 0;
function run() {
  tick++;

  // ── BACA SENSOR ──────────────────────────────────────────
  // Ganti bagian ini dengan pembacaan dari sensor nyata.
  // Contoh Modbus: const val = await client.readHoldingRegisters(0, 1)
  // Contoh MQTT  : subscribe ke topik dan simpan nilai terakhir di map
  const readings = Object.keys(state).map(id => ({
    device_id: id,
    value: walk(id),   // <-- ganti: baca dari sensor
  }));
  // ── AKHIR BACA SENSOR ────────────────────────────────────

  const statuses = [
    ...['P-01','P-02','P-03'].map(getPumpStatus),
    ...['SV-01','SV-02','SV-03','SV-04','SV-05','SV-06'].map(getValveStatus),
  ];

  writeBatch(readings, statuses);

  if (tick % 30 === 0) {
    const ts = new Date().toTimeString().slice(0, 8);
    console.log(`[${ts}] Seeder tick #${tick} — ${readings.length} sensor ditulis ke DB`);
  }
}

run(); // jalankan sekali langsung
const interval = setInterval(run, 2000);

console.log('Seeder berjalan — menulis data sensor tiap 2 detik. Ctrl+C untuk berhenti.\n');

process.on('SIGINT', () => {
  clearInterval(interval);
  db.close();
  console.log('\nSeeder dihentikan.');
  process.exit(0);
});