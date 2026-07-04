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
const helmet = require('helmet');
const path = require('path');
const os = require('os');

const store = require('./src/store');
const { router, ADMIN_KEY, VOLUNTEER_KEY } = require('./src/routes');
const { eventTimezone, todayInTz } = require('./src/time');

const PORT = process.env.PORT || 3000;
const HOST = '0.0.0.0';
const PUBLIC_DIR = path.join(__dirname, 'public');

// CORS allowlist (R-7): comma-separated origins allowed to call the API from a
// browser (e.g. the Central Dashboard). The Media Hub's own pages are
// same-origin and don't need this. Unset = no cross-origin access (secure
// default) — set ALLOWED_ORIGINS on the host to let the Dashboard read it.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

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

  // Security headers (R-10). CSP is scoped to what the app actually loads:
  // scripts from self + the jsdelivr QR CDN, styles inline (the UI sets style
  // attributes and CSS vars), fonts from Google, images as data/blob URLs.
  // CORP is 'cross-origin' so the Dashboard can still fetch the JSON API.
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", 'https://cdn.jsdelivr.net'],
          styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
          imgSrc: ["'self'", 'data:', 'blob:'],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          frameAncestors: ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );

  // CORS allowlist (R-7): reflect only known origins, never '*'. No cookies are
  // used (auth is a header), so this simply controls which sites' JS may read
  // the API cross-origin.
  app.use((req, res, next) => {
    const origin = req.get('origin');
    if (origin && ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-admin-key, x-volunteer-key');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    }
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
