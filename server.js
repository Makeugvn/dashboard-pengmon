/**
 * server.js — AquaControl Pro Backend
 *
 * Menjalankan:
 *   - HTTP server (Express) untuk melayani file dashboard & REST API
 *   - WebSocket server untuk push data realtime ke semua browser
 *
 * Jalankan: node server.js
 * Akses    : http://localhost:3000  /  http://<IP-WiFi>:3000
 */

const express  = require('express');
const http     = require('http');
const { WebSocketServer } = require('ws');
const path     = require('path');
const os       = require('os');
const db       = require('./db');

const PORT = process.env.PORT || 3000;
const app  = express();
const server = http.createServer(app);
const wss  = new WebSocketServer({ server });

// ── Helpers ──────────────────────────────────────────────────
function getLocalIP() {
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces) {
      if (iface.family === 'IPv4' && !iface.internal) return iface.address;
    }
  }
  return '127.0.0.1';
}

function broadcast(data) {
  const msg = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(msg);
  }
}

// ── Prepared queries ─────────────────────────────────────────
const qLatestAll = db.prepare(`
  SELECT
    d.id, d.name, d.type, d.unit, d.min_value, d.max_value,
    r.value, r.recorded_at
  FROM devices d
  LEFT JOIN sensor_readings r ON r.id = (
    SELECT id FROM sensor_readings
    WHERE device_id = d.id
    ORDER BY recorded_at DESC LIMIT 1
  )
  WHERE d.type IN ('level','pressure','quality','flow')
  ORDER BY d.id
`);

const qStatusAll = db.prepare(`
  SELECT d.id, d.name, d.type, ds.status, ds.extra_json, ds.updated_at
  FROM devices d
  LEFT JOIN device_status ds ON ds.device_id = d.id
  WHERE d.type IN ('pump','valve')
  ORDER BY d.type DESC, d.id
`);

const qHistory = db.prepare(`
  SELECT value, recorded_at
  FROM sensor_readings
  WHERE device_id = ?
    AND recorded_at >= datetime('now', ? , 'localtime')
  ORDER BY recorded_at ASC
`);

const qDevices = db.prepare(`SELECT * FROM devices ORDER BY type, id`);

// ── Middleware ────────────────────────────────────────────────
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*'); // izinkan semua asal (LAN)
  res.setHeader('Cache-Control', 'no-cache');
  next();
});

// Sajikan file statis dari folder "public"
app.use(express.static(path.join(__dirname)));

// ── REST API ─────────────────────────────────────────────────

/**
 * GET /api/latest
 * Mengembalikan nilai terkini semua sensor + status semua perangkat
 */
app.get('/api/latest', (req, res) => {
  try {
    const sensors  = qLatestAll.all();
    const devices  = qStatusAll.all().map(d => ({
      ...d,
      extra: d.extra_json ? JSON.parse(d.extra_json) : null,
    }));
    res.json({ ok: true, ts: new Date().toISOString(), sensors, devices });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /api/history/:deviceId?minutes=30
 * Mengembalikan data historis satu sensor dalam N menit terakhir
 */
app.get('/api/history/:deviceId', (req, res) => {
  try {
    const { deviceId } = req.params;
    const minutes = Math.min(parseInt(req.query.minutes) || 30, 1440); // max 24 jam
    const rows = qHistory.all(deviceId, `-${minutes} minutes`);
    res.json({ ok: true, device_id: deviceId, minutes, data: rows });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/**
 * GET /api/devices
 * Mengembalikan daftar semua perangkat (master data)
 */
app.get('/api/devices', (req, res) => {
  res.json({ ok: true, devices: qDevices.all() });
});

/**
 * GET /api/status
 * Status server: versi, jumlah client WS terhubung, waktu sekarang
 */
app.get('/api/status', (req, res) => {
  res.json({
    ok: true,
    server: 'AquaControl Pro v2.0',
    ws_clients: wss.clients.size,
    uptime_seconds: Math.round(process.uptime()),
    ts: new Date().toISOString(),
  });
});

// Fallback: semua route lain → index.html

// ── WebSocket ─────────────────────────────────────────────────
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`[WS] Client terhubung dari ${ip} — total: ${wss.clients.size}`);

  // Kirim data terkini langsung saat client pertama kali connect
  try {
    const sensors = qLatestAll.all();
    const devices = qStatusAll.all().map(d => ({
      ...d, extra: d.extra_json ? JSON.parse(d.extra_json) : null,
    }));
    ws.send(JSON.stringify({ type: 'snapshot', ts: new Date().toISOString(), sensors, devices }));
  } catch (e) {
    console.error('WS snapshot error:', e.message);
  }

  ws.on('close', () => {
    console.log(`[WS] Client ${ip} terputus — sisa: ${wss.clients.size}`);
  });

  ws.on('error', (err) => console.error(`[WS] Error dari ${ip}:`, err.message));
});

// ── Push realtime setiap 2 detik ─────────────────────────────
setInterval(() => {
  if (wss.clients.size === 0) return; // tidak ada yang mendengarkan
  try {
    const sensors = qLatestAll.all();
    const devices = qStatusAll.all().map(d => ({
      ...d, extra: d.extra_json ? JSON.parse(d.extra_json) : null,
    }));
    broadcast({ type: 'update', ts: new Date().toISOString(), sensors, devices });
  } catch (e) {
    console.error('[WS broadcast error]', e.message);
  }
}, 2000);

// ── Start server ──────────────────────────────────────────────
server.listen(PORT, '0.0.0.0', () => {
  const ip = getLocalIP();
  console.log('\n╔══════════════════════════════════════════════════╗');
  console.log('║   AquaControl Pro — WTP Dashboard Server v2.0    ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log(`║  Laptop ini  : http://localhost:${PORT}              ║`);
  console.log(`║  Jaringan    : http://${ip}:${PORT}          ║`);
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  REST API    : /api/latest  /api/history/:id     ║');
  console.log('║  WebSocket   : ws://...:3000 (push 2 detik)      ║');
  console.log('╠══════════════════════════════════════════════════╣');
  console.log('║  Jalankan seeder di terminal lain:               ║');
  console.log('║    node seeder.js                                ║');
  console.log('╚══════════════════════════════════════════════════╝\n');
});

process.on('SIGINT', () => {
  console.log('\nServer dihentikan.');
  db.close();
  process.exit(0);
});