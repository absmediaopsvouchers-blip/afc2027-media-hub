'use strict';

/**
 * Initialise the configured database (create schema + seed reference data).
 *
 *   npm run db:init
 *
 * Useful for provisioning a cloud database before/at deploy time. It simply runs
 * the same store.init() the server runs on boot, then exits:
 *   • Postgres  → CREATE TABLE IF NOT EXISTS ... + seed if empty
 *   • MongoDB   → ensure indexes + seed if empty
 *   • file      → create data.json if missing
 */

require('../src/env');

const store = require('../src/store');
const { eventTimezone } = require('../src/time');

(async () => {
  console.log(`Initialising "${store.backend}" backend (timezone: ${eventTimezone()}) ...`);
  await store.init();
  console.log('Done — schema ready and reference data seeded (if the database was empty).');
  process.exit(0);
})().catch((err) => {
  console.error('Database initialisation failed:\n', err);
  process.exit(1);
});
