/**
 * bridge.js — SmartPosture → PostgreSQL
 *
 * ESP32 → HTTP POST → bridge.js → PostgreSQL (TimescaleDB)
 *
 * Démarrage :
 *   node bridge.js
 *
 * Tunnel Wokwi :
 *   npx cloudflared tunnel --url http://localhost:8081
 */

const http = require('http');
const { WebSocketServer } = require('ws');
const { Pool } = require('pg');

// ─────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────

const BRIDGE_PORT = process.env.BRIDGE_PORT || 8082;

const SENSOR_KEYS = [
  'cervical',
  'haut_du_dos',
  'lombaire',
  'epaule_g',
  'epaule_d'
];

// ─────────────────────────────────────────────────────────────
// POSTGRESQL
// ─────────────────────────────────────────────────────────────

const pool = new Pool({
  host: process.env.PG_HOST || 'localhost',
  port: process.env.PG_PORT || 5432,
  user: process.env.PG_USER || 'postgres',
  password: process.env.PG_PASSWORD || 'postgres',
  database: process.env.PG_DATABASE || 'postgres',
});

pool.connect()
  .then(() => console.log('PostgreSQL connecté'))
  .catch(err => console.error('Erreur PostgreSQL:', err.message));

// ─────────────────────────────────────────────────────────────
// INSERTIONS BDD
// ─────────────────────────────────────────────────────────────

async function insertPosture(data) {
  const operatorId = data.operatorId ?? 'op1';
  const timestamp = new Date();

  for (const sensor of SENSOR_KEYS) {
    const s = data[sensor];
    if (!s) continue;

    await pool.query(
      `INSERT INTO posture_raw
       (time, operator_id, sensor_name, ax, ay, az, gx, gy, gz)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [
        timestamp,
        operatorId,
        sensor,
        s.ax ?? 0,
        s.ay ?? 0,
        s.az ?? 0,
        s.gx ?? 0,
        s.gy ?? 0,
        s.gz ?? 0
      ]
    );
  }
}

async function insertTemperature(data) {
  await pool.query(
    `INSERT INTO temperature_raw (time, operator_id, temperature)
     VALUES (NOW(), $1, $2)`,
    [
      data.operatorId ?? 'op1',
      data.temperature ?? 0
    ]
  );
}

async function insertStatus(data) {
  await pool.query(
    `INSERT INTO status_log (operator_id, status)
     VALUES ($1, $2)`,
    [
      data.operatorId ?? 'op1',
      data.status ?? 'unknown'
    ]
  );
}

// ─────────────────────────────────────────────────────────────
// SERVEUR HTTP
// ─────────────────────────────────────────────────────────────

const httpServer = http.createServer((req, res) => {

  // Health check
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok' }));
    return;
  }

  // Endpoint ESP32
  if (req.url === '/data' && req.method === 'POST') {

    let body = '';

    req.on('data', chunk => {
      body += chunk.toString();
    });

    req.on('end', async () => {

      let parsed;

      try {
        parsed = JSON.parse(body);
      } catch (err) {
        res.writeHead(400);
        res.end('JSON invalide');
        return;
      }

      // Réponse immédiate à l’ESP32
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));

      try {

        if (parsed.topic === "sensors/posture") {
          console.log("Posture reçue → insertion BDD");
          await insertPosture(parsed);

        } else if (parsed.topic === "sensors/temperature") {
          console.log("🌡 Température reçue → insertion BDD");
          await insertTemperature(parsed);

        } else if (parsed.topic === "alerts/status") {
          console.log("Status reçu → insertion BDD");
          await insertStatus(parsed);

        } else {
          console.log("Topic inconnu :", parsed.topic);
        }

      } catch (err) {
        console.error("Erreur insertion BDD:", err.message);
      }

    });

  } else {
    res.writeHead(404);
    res.end();
  }

});

// ─────────────────────────────────────────────────────────────
// WEBSOCKET (optionnel si tu veux debug live)
// ─────────────────────────────────────────────────────────────

const wss = new WebSocketServer({ server: httpServer });

wss.on('connection', (socket, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`WebSocket connecté depuis ${clientIp}`);

  socket.on('close', () =>
    console.log(`WebSocket déconnecté (${clientIp})`)
  );

  socket.on('error', (err) =>
    console.error(`Erreur WS : ${err.message}`)
  );

  socket.send(JSON.stringify({ message: "Bridge connecté" }));
});

// ─────────────────────────────────────────────────────────────
// LANCEMENT
// ─────────────────────────────────────────────────────────────

console.log('🚀 SmartPosture Bridge → PostgreSQL');
httpServer.listen(BRIDGE_PORT, () => {
  console.log(`HTTP en écoute sur http://localhost:${BRIDGE_PORT}`);
  console.log(`   → POST /data depuis ESP32`);
  console.log(`   → Health check : /health`);
  console.log(`   → Tunnel Wokwi : npx cloudflared tunnel --url http://localhost:${BRIDGE_PORT}`);
});