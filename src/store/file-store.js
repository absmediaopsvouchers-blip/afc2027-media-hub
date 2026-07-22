'use strict';

/**
 * File-based store (the default, zero-dependency backend).
 *
 * All application state lives in a single JSON file (data.json) at the project
 * root. The whole object is held in memory and written back to disk on every
 * mutation (write-through). Writes are atomic (temp file + rename) so the data
 * file is never left half-written if the process dies.
 *
 * Because the state lives on the server (not the browser), clients cannot bypass
 * the daily voucher limits with incognito mode or by clearing their cache. This
 * backend is ideal for local development and a single-laptop venue deployment.
 * For multi-instance cloud hosting, set DATABASE_URL to use Postgres/Mongo.
 */

const fs = require('fs');
const path = require('path');
const { getSeedData } = require('../seed');

// Override the data file with the DATA_FILE env var (handy for running a second
// isolated instance, e.g. tests, without touching the live data.json).
const DATA_FILE = process.env.DATA_FILE
  ? path.resolve(process.env.DATA_FILE)
  : path.join(__dirname, '..', '..', 'data.json');

const backend = 'file';
let data = null;

function persist() {
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

async function init() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      data = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      // Back-fill any collections added since the file was first written.
      const seed = getSeedData();
      let changed = false;
      for (const key of Object.keys(seed)) {
        if (!(key in data)) {
          data[key] = seed[key];
          changed = true;
        }
      }
      if (changed) persist();
    } else {
      data = getSeedData();
      persist();
    }
  } catch (err) {
    console.error('[store:file] data.json was missing or unreadable — re-seeding.', err.message);
    data = getSeedData();
    persist();
  }
}

// ---- meta -------------------------------------------------------------------

async function getMeta() {
  return data.meta;
}

// ---- locations --------------------------------------------------------------

async function listLocations() {
  return data.locations.slice();
}

async function getLocation(id) {
  return data.locations.find((l) => l.id === id) || null;
}

async function createLocation(loc) {
  data.locations.push(loc);
  persist();
  return loc;
}

async function updateLocation(id, fields) {
  const loc = data.locations.find((l) => l.id === id);
  if (!loc) return null;
  Object.assign(loc, fields);
  persist();
  return loc;
}

async function deleteLocation(id) {
  const before = data.locations.length;
  data.locations = data.locations.filter((l) => l.id !== id);
  if (data.locations.length === before) return false;
  persist();
  return true;
}

// ---- users ------------------------------------------------------------------

async function getUserByEmail(email) {
  return data.users.find((u) => u.email === email) || null;
}

async function createUser(user) {
  data.users.push(user);
  persist();
  return user;
}

async function listUsers() {
  return data.users.slice();
}

async function countUsers() {
  return data.users.length;
}

// ---- vouchers ---------------------------------------------------------------

async function createVoucher(v) {
  // Enforce the per-email/location/day/meal uniqueness as a backstop, mirroring
  // the DB UNIQUE constraint used by the SQL/Mongo backends.
  const clash = data.vouchers.find(
    (x) =>
      x.email === v.email &&
      x.locationId === v.locationId &&
      x.date === v.date &&
      x.mealType === v.mealType
  );
  if (clash) {
    const err = new Error('Duplicate voucher');
    err.code = 'DUP_VOUCHER';
    throw err;
  }
  data.vouchers.push(v);
  persist();
  return v;
}

async function getVoucher(id) {
  return data.vouchers.find((v) => v.id === id) || null;
}

async function findDayVouchers({ email, locationId, date }) {
  return data.vouchers.filter(
    (v) => v.email === email && v.locationId === locationId && v.date === date
  );
}

/** All vouchers a given email holds on a given calendar day. */
async function findUserDayVouchers({ email, date }) {
  return data.vouchers.filter((v) => v.email === email && v.date === date);
}

/** Atomically mark a Pending voucher Redeemed. Returns the voucher, or null. */
async function redeemVoucher(id, atIso) {
  const v = data.vouchers.find((x) => x.id === id);
  if (!v || v.status !== 'Pending') return null;
  v.status = 'Redeemed';
  v.redeemedAt = atIso;
  persist();
  return v;
}

async function listVouchers() {
  return data.vouchers.slice();
}

/** Mark any still-Pending voucher from a previous day as Expired. */
async function expireStale(today) {
  let changed = false;
  for (const v of data.vouchers) {
    if (v.status === 'Pending' && v.date < today) {
      v.status = 'Expired';
      changed = true;
    }
  }
  if (changed) persist();
}

/** Wipe every voucher (Pending, Redeemed and Expired). Returns the count removed. */
async function resetVouchers() {
  const removed = data.vouchers.length;
  data.vouchers = [];
  persist();
  return removed;
}

// ---- news -------------------------------------------------------------------

async function listNews() {
  return data.news.slice();
}

async function createNews(item) {
  data.news.push(item);
  persist();
  return item;
}

async function updateNews(id, fields) {
  const item = data.news.find((n) => n.id === id);
  if (!item) return null;
  Object.assign(item, fields);
  persist();
  return item;
}

async function deleteNews(id) {
  const before = data.news.length;
  data.news = data.news.filter((n) => n.id !== id);
  if (data.news.length === before) return false;
  persist();
  return true;
}

// ---- press conferences ------------------------------------------------------

async function listPress() {
  return data.pressConferences.slice();
}

async function createPress(item) {
  data.pressConferences.push(item);
  persist();
  return item;
}

async function updatePress(id, fields) {
  const item = data.pressConferences.find((p) => p.id === id);
  if (!item) return null;
  Object.assign(item, fields);
  persist();
  return item;
}

async function deletePress(id) {
  const before = data.pressConferences.length;
  data.pressConferences = data.pressConferences.filter((p) => p.id !== id);
  if (data.pressConferences.length === before) return false;
  persist();
  return true;
}

// ---- transport --------------------------------------------------------------

async function listTransport() {
  return data.transport.slice();
}

async function createTransport(item) {
  data.transport.push(item);
  persist();
  return item;
}

async function updateTransport(id, fields) {
  const item = data.transport.find((t) => t.id === id);
  if (!item) return null;
  Object.assign(item, fields);
  persist();
  return item;
}

async function deleteTransport(id) {
  const before = data.transport.length;
  data.transport = data.transport.filter((t) => t.id !== id);
  if (data.transport.length === before) return false;
  persist();
  return true;
}

// ---- categories -------------------------------------------------------------

async function listCategories() {
  return (data.categories || []).slice();
}

async function createCategory(item) {
  if (!data.categories) data.categories = [];
  data.categories.push(item);
  persist();
  return item;
}

async function updateCategory(id, fields) {
  const item = (data.categories || []).find((c) => c.id === id);
  if (!item) return null;
  Object.assign(item, fields);
  persist();
  return item;
}

async function deleteCategory(id) {
  const before = (data.categories || []).length;
  data.categories = (data.categories || []).filter((c) => c.id !== id);
  if (data.categories.length === before) return false;
  persist();
  return true;
}

// ---- custom client-app tabs ---------------------------------------------------

async function listTabs() {
  return (data.tabs || []).slice();
}

async function createTab(tab) {
  if (!data.tabs) data.tabs = [];
  data.tabs.push(tab);
  persist();
  return tab;
}

async function updateTab(id, fields) {
  const tab = (data.tabs || []).find((t) => t.id === id);
  if (!tab) return null;
  Object.assign(tab, fields);
  persist();
  return tab;
}

async function deleteTab(id) {
  const before = (data.tabs || []).length;
  data.tabs = (data.tabs || []).filter((t) => t.id !== id);
  if (data.tabs.length === before) return false;
  persist();
  return true;
}

// ---- audit log (admin actions) ------------------------------------------------

async function addAudit(entry) {
  if (!data.auditLog) data.auditLog = [];
  data.auditLog.push(entry);
  // Keep the log bounded so data.json never grows unbounded.
  if (data.auditLog.length > 200) data.auditLog = data.auditLog.slice(-200);
  persist();
  return entry;
}

async function listAudit(limit = 30) {
  return (data.auditLog || []).slice(-limit).reverse();
}

// ---- settings (theme) -------------------------------------------------------

async function getSettings() {
  return data.settings || {};
}

async function saveSettings(obj) {
  data.settings = obj || {};
  persist();
  return data.settings;
}

// ---- voucher logs (transactional audit trail, keyed on accreditation) --------

async function addVoucherLog(entry) {
  if (!data.voucherLogs) data.voucherLogs = [];
  data.voucherLogs.push(entry);
  // Keep the file bounded — the audit trail is also queryable per-client, and
  // very old global entries add little value on the single-file backend.
  if (data.voucherLogs.length > 5000) data.voucherLogs = data.voucherLogs.slice(-5000);
  persist();
  return entry;
}

async function listVoucherLogsByAccreditation(accreditationNumber) {
  const acr = String(accreditationNumber || '');
  return (data.voucherLogs || [])
    .filter((l) => l.accreditationNumber === acr)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

async function findActiveVouchersByAccreditation({ accreditationNumber, date }) {
  const acr = String(accreditationNumber || '');
  return (data.vouchers || []).filter(
    (v) => v.accreditationNumber === acr && v.date === date && v.status === 'Pending'
  );
}

// Anti-cheat lookup: any voucher (Pending/Redeemed) this accreditation already
// holds for a given meal (=shift) at a given LOCATION on a given day. Non-empty
// => block a new one. Scoped per-location so a client can legitimately hold
// Lunch+Dinner at the MMC and a Media Café Meal at each stadium they attend,
// while still being blocked from double-claiming the same meal at the same
// venue from a second device.
async function findAcrMealVouchers({ accreditationNumber, locationId, mealType, date }) {
  const acr = String(accreditationNumber || '');
  return (data.vouchers || []).filter(
    (v) => v.accreditationNumber === acr && v.locationId === locationId && v.mealType === mealType && v.date === date
  );
}

// ---- push subscriptions (Web Push) -------------------------------------------

async function listPushSubscriptions() {
  return (data.pushSubscriptions || []).slice();
}

/** Upsert by endpoint — a browser resubscribing (e.g. key rotation) replaces the old row. */
async function savePushSubscription(sub) {
  if (!data.pushSubscriptions) data.pushSubscriptions = [];
  const existing = data.pushSubscriptions.find((s) => s.endpoint === sub.endpoint);
  if (existing) Object.assign(existing, sub);
  else data.pushSubscriptions.push(sub);
  persist();
  return sub;
}

async function deletePushSubscription(endpoint) {
  const before = (data.pushSubscriptions || []).length;
  data.pushSubscriptions = (data.pushSubscriptions || []).filter((s) => s.endpoint !== endpoint);
  if (data.pushSubscriptions.length === before) return false;
  persist();
  return true;
}

module.exports = {
  backend,
  init,
  getMeta,
  listLocations,
  getLocation,
  createLocation,
  updateLocation,
  deleteLocation,
  getUserByEmail,
  createUser,
  listUsers,
  countUsers,
  createVoucher,
  getVoucher,
  findDayVouchers,
  findUserDayVouchers,
  redeemVoucher,
  listVouchers,
  expireStale,
  resetVouchers,
  listNews,
  createNews,
  updateNews,
  deleteNews,
  listPress,
  createPress,
  updatePress,
  deletePress,
  listTransport,
  createTransport,
  updateTransport,
  deleteTransport,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getSettings,
  saveSettings,
  listTabs,
  createTab,
  updateTab,
  deleteTab,
  addAudit,
  listAudit,
  listPushSubscriptions,
  savePushSubscription,
  deletePushSubscription,
  addVoucherLog,
  listVoucherLogsByAccreditation,
  findActiveVouchersByAccreditation,
  findAcrMealVouchers,
};
