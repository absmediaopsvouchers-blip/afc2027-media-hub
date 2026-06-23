'use strict';

/**
 * Storage adapter selector.
 *
 * The backend is chosen automatically from the DATABASE_URL connection string:
 *
 *   • mongodb:// or mongodb+srv://   → MongoDB (mongoose)        [cloud]
 *   • postgres:// or postgresql://   → PostgreSQL (pg)           [cloud]
 *   • (unset / anything else)        → JSON file store (data.json) [local default]
 *
 * Every adapter exposes the same async interface, so the rest of the app
 * (routes.js) is completely agnostic to where the data actually lives.
 */

function selectStore() {
  const url = (process.env.DATABASE_URL || '').trim();

  if (/^mongodb(\+srv)?:\/\//i.test(url)) return require('./mongo-store');
  if (/^postgres(ql)?:\/\//i.test(url)) return require('./pg-store');
  return require('./file-store');
}

module.exports = selectStore();
