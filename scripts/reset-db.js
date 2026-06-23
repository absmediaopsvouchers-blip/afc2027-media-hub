'use strict';

/**
 * Reset the LOCAL file-store database back to the seed data.
 * Deletes data.json so the next server start re-seeds it.
 *
 *   npm run reset
 *
 * Note: this only affects the local JSON file store. If DATABASE_URL is set
 * (Postgres/MongoDB), reset the data using your database provider's tools.
 */

require('../src/env');

const fs = require('fs');
const path = require('path');

if (process.env.DATABASE_URL) {
  console.log('DATABASE_URL is set — this command only resets the local data.json file store.');
  console.log('To reset a cloud database, drop/clear its tables or collections via your provider.');
  process.exit(0);
}

const DATA_FILE = path.join(__dirname, '..', 'data.json');

if (fs.existsSync(DATA_FILE)) {
  fs.unlinkSync(DATA_FILE);
  console.log('Removed data.json — it will be re-seeded on the next "npm start".');
} else {
  console.log('No data.json found — nothing to reset.');
}
