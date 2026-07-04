'use strict';

/**
 * AFC Asian Cup 2027 — Meal Vouchers & Media Info Hub
 *
 * A cloud-deployable Express server with a pluggable storage backend:
 *   • no DATABASE_URL  → local JSON file store (data.json)        [default]
 *   • postgres://...    → PostgreSQL (Neon / Supabase / Render)
 *   • mongodb://...     → MongoDB (Atlas)
 *
 * Deploy to Render / Fly.io / any Node host. Locally:
 *   npm start         (or double-click start.bat on Windows)
 */

require('./src/env'); // load .env into process.env before anything reads it

const express = require('express');
const path = require('path');
const os = require('os');

const store = require('./src/store');
const { router, ADMIN_KEY, VOLUNTEER_KEY } = require('./src/routes');
const { eventTimezone, todayInTz } = require('./src/time');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

async function main() {
  // Refuse to boot without real keys (R-2). There are no built-in defaults, so
  // an unset key would otherwise leave the API unguarded.
  if (!ADMIN_KEY || !VOLUNTEER_KEY) {
    console.error('\n[fatal] ADMIN_KEY and VOLUNTEER_KEY must be set as environment variables (no defaults).');
    console.error('        Set them in your .env for local dev, or in the host dashboard for deploys.\n');
    process.exit(1);
  }

  // Connect / migrate / seed the chosen backend before serving any requests.
  await store.init();

  const app = express();
  app.disable('x-powered-by');
  // Behind Render/Fly's proxy: trust one hop so express-rate-limit keys off the
  // real client IP (X-Forwarded-For) rather than the proxy's.
  app.set('trust proxy', 1);

  // CORS: the API is read directly from the browser by other AFC 2027 tools
  // on different origins (e.g. the Central Dashboard). No cookies/credentials
  // are used — admin auth is a bearer-style header — so a permissive origin
  // is safe here and avoids maintaining an allowlist across deploys.
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-volunteer-key');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });

  // Larger limit so News posts can carry base64 image/PDF attachments.
  app.use(express.json({ limit: '16mb' }));

  // Health check (used by cloud platforms to verify the instance is live).
  app.get('/healthz', (req, res) => res.json({ ok: true, backend: store.backend, today: todayInTz() }));

  // API.
  app.use('/api', router);

  // Static client + admin assets (also serves manifest.webmanifest, sw.js, icons).
  app.use(express.static(PUBLIC_DIR));
  app.get('/admin', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'admin.html')));
  app.get('/share', (req, res) => res.sendFile(path.join(PUBLIC_DIR, 'share.html')));

  // Hourly housekeeping: roll any still-Pending vouchers from past days to Expired.
  const sweep = setInterval(() => {
    store.expireStale(todayInTz()).catch((e) => console.error('[sweep]', e.message));
  }, 60 * 60 * 1000);
  if (sweep.unref) sweep.unref();

  app.listen(PORT, HOST, () => printBanner(PORT));
}

/** Print a friendly banner with config + every URL the server is reachable on. */
function printBanner(port) {
  const line = '='.repeat(62);
  console.log('\n' + line);
  console.log('  AFC Asian Cup 2027 | Media Hub  -  server running');
  console.log(line);
  console.log(`  Storage backend : ${store.backend}`);
  console.log(`  Event timezone  : ${eventTimezone()}  (today: ${todayInTz()})`);
  // Never print the actual keys (R-2/M-6) — logs may be captured by the host.
  console.log(`  Admin key       : set ✓  (from ADMIN_KEY)`);
  console.log(`  Volunteer key   : set ✓  (from VOLUNTEER_KEY) — redeem only`);
  console.log(line);
  console.log('  On this computer:');
  console.log(`     Client app   ->  http://localhost:${port}`);
  console.log(`     Admin panel  ->  http://localhost:${port}/admin`);

  const lanIps = [];
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) lanIps.push(net.address);
    }
  }
  if (lanIps.length) {
    console.log('\n  On phones / tablets (same Wi-Fi):');
    for (const ip of lanIps) console.log(`     Client app   ->  http://${ip}:${port}`);
    console.log('     (Admin panel is at the same address with /admin)');
  }
  console.log(line + '\n');
}

main().catch((err) => {
  console.error('\n[fatal] Failed to start server:\n', err);
  process.exit(1);
});
