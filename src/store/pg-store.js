'use strict';

/**
 * PostgreSQL store (used when DATABASE_URL is a postgres:// connection string).
 *
 * Works with any standard Postgres: Neon, Supabase, Render Postgres, etc.
 * The `pg` driver is required LAZILY so the file/Mongo backends never need it
 * installed. On first connect it creates the schema (idempotent) and seeds the
 * reference data if the database is empty.
 *
 * The daily voucher limit is enforced at the database level by a UNIQUE
 * constraint on (email, location_id, date, meal_type) — rock-solid even under
 * concurrent requests across multiple cloud instances.
 */

const { getSeedData } = require('../seed');

const backend = 'postgres';
let pool = null;

function getConnectionString() {
  return process.env.DATABASE_URL || '';
}

function needsSsl(conn) {
  if (/sslmode=disable/i.test(conn)) return false;
  if (/localhost|127\.0\.0\.1/i.test(conn)) return false;
  return true; // managed cloud Postgres (Neon/Supabase/Render) requires SSL
}

async function init() {
  let Pool;
  try {
    ({ Pool } = require('pg'));
  } catch (e) {
    throw new Error(
      "DATABASE_URL points to Postgres but the 'pg' package is not installed. " +
        "Run `npm install pg` (it is listed in optionalDependencies)."
    );
  }

  const connectionString = getConnectionString();
  pool = new Pool({
    connectionString,
    ssl: needsSsl(connectionString) ? { rejectUnauthorized: false } : false,
    max: 5,
  });

  await migrate();
  await seedIfEmpty();
  await seedCategoriesIfEmpty();
}

function q(text, params) {
  return pool.query(text, params);
}

async function migrate() {
  await q(`
    CREATE TABLE IF NOT EXISTS meta (
      id       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      event    TEXT,
      city     TEXT,
      subtitle TEXT
    );
    CREATE TABLE IF NOT EXISTS locations (
      id       TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      type     TEXT NOT NULL,
      zone     TEXT,
      "window" TEXT
    );
    CREATE TABLE IF NOT EXISTS users (
      email                TEXT PRIMARY KEY,
      accreditation_number TEXT NOT NULL,
      created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS vouchers (
      id                   TEXT PRIMARY KEY,
      email                TEXT NOT NULL,
      accreditation_number TEXT,
      location_id          TEXT NOT NULL,
      location_name        TEXT NOT NULL,
      location_type        TEXT NOT NULL,
      meal_type            TEXT NOT NULL,
      date                 TEXT NOT NULL,
      status               TEXT NOT NULL DEFAULT 'Pending',
      issued_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      redeemed_at          TIMESTAMPTZ,
      CONSTRAINT uq_voucher_per_day UNIQUE (email, location_id, date, meal_type)
    );
    CREATE INDEX IF NOT EXISTS idx_vouchers_date ON vouchers (date);
    CREATE INDEX IF NOT EXISTS idx_vouchers_email ON vouchers (email);
    CREATE TABLE IF NOT EXISTS news (
      id        TEXT PRIMARY KEY,
      title     TEXT NOT NULL,
      body      TEXT,
      category  TEXT,
      pinned    BOOLEAN NOT NULL DEFAULT false,
      timestamp TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS press_conferences (
      id     TEXT PRIMARY KEY,
      date   TEXT,
      time   TEXT,
      team   TEXT,
      room   TEXT,
      status TEXT,
      note   TEXT
    );
    CREATE TABLE IF NOT EXISTS transport (
      id              TEXT PRIMARY KEY,
      route           TEXT,
      type            TEXT,
      "from"          TEXT,
      "to"            TEXT,
      frequency       TEXT,
      first_departure TEXT,
      last_departure  TEXT,
      duration        TEXT,
      notes           TEXT
    );
    CREATE TABLE IF NOT EXISTS categories (
      id    TEXT PRIMARY KEY,
      name  TEXT NOT NULL,
      color TEXT
    );
  `);
}

async function seedIfEmpty() {
  const { rows } = await q('SELECT COUNT(*)::int AS n FROM locations');
  if (rows[0].n > 0) return;

  const seed = getSeedData();
  console.log('[store:postgres] Empty database — seeding reference data.');

  await q(
    'INSERT INTO meta (id, event, city, subtitle) VALUES (1, $1, $2, $3) ON CONFLICT (id) DO NOTHING',
    [seed.meta.event, seed.meta.city, seed.meta.subtitle]
  );

  for (const l of seed.locations) {
    await q(
      'INSERT INTO locations (id, name, type, zone, "window") VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING',
      [l.id, l.name, l.type, l.zone, l.window]
    );
  }
  for (const u of seed.users) {
    await q(
      'INSERT INTO users (email, accreditation_number, created_at) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING',
      [u.email, u.accreditationNumber, u.createdAt]
    );
  }
  for (const n of seed.news) {
    await q(
      'INSERT INTO news (id, title, body, category, pinned, timestamp) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING',
      [n.id, n.title, n.body, n.category, n.pinned, n.timestamp]
    );
  }
  for (const p of seed.pressConferences) {
    await q(
      'INSERT INTO press_conferences (id, date, time, team, room, status, note) VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING',
      [p.id, p.date, p.time, p.team, p.room, p.status, p.note]
    );
  }
  for (const t of seed.transport) {
    await q(
      'INSERT INTO transport (id, route, type, "from", "to", frequency, first_departure, last_departure, duration, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING',
      [t.id, t.route, t.type, t.from, t.to, t.frequency, t.firstDeparture, t.lastDeparture, t.duration, t.notes]
    );
  }
}

// Seed default categories independently, so databases provisioned before the
// categories feature existed still get the defaults on the next boot.
async function seedCategoriesIfEmpty() {
  const { rows } = await q('SELECT COUNT(*)::int AS n FROM categories');
  if (rows[0].n > 0) return;
  for (const c of getSeedData().categories) {
    await q('INSERT INTO categories (id, name, color) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING', [c.id, c.name, c.color]);
  }
}

// ---- row mappers ------------------------------------------------------------

const iso = (v) => (v == null ? null : v instanceof Date ? v.toISOString() : v);

function toVoucher(r) {
  if (!r) return null;
  return {
    id: r.id,
    email: r.email,
    accreditationNumber: r.accreditation_number,
    locationId: r.location_id,
    locationName: r.location_name,
    locationType: r.location_type,
    mealType: r.meal_type,
    date: r.date,
    status: r.status,
    issuedAt: iso(r.issued_at),
    redeemedAt: iso(r.redeemed_at),
  };
}

function toUser(r) {
  return r ? { email: r.email, accreditationNumber: r.accreditation_number, createdAt: iso(r.created_at) } : null;
}

function toNews(r) {
  return { id: r.id, title: r.title, body: r.body, category: r.category, pinned: r.pinned, timestamp: iso(r.timestamp) };
}

function toTransport(r) {
  return {
    id: r.id, route: r.route, type: r.type, from: r.from, to: r.to,
    frequency: r.frequency, firstDeparture: r.first_departure, lastDeparture: r.last_departure,
    duration: r.duration, notes: r.notes,
  };
}

// ---- meta -------------------------------------------------------------------

async function getMeta() {
  const { rows } = await q('SELECT event, city, subtitle FROM meta WHERE id = 1');
  return rows[0] || getSeedData().meta;
}

// ---- locations --------------------------------------------------------------

async function listLocations() {
  const { rows } = await q('SELECT * FROM locations ORDER BY type, name');
  return rows;
}

async function getLocation(id) {
  const { rows } = await q('SELECT * FROM locations WHERE id = $1', [id]);
  return rows[0] || null;
}

async function createLocation(loc) {
  await q('INSERT INTO locations (id, name, type, zone, "window") VALUES ($1,$2,$3,$4,$5)', [
    loc.id, loc.name, loc.type, loc.zone, loc.window,
  ]);
  return loc;
}

async function updateLocation(id, fields) {
  const allowed = ['name', 'type', 'zone', 'window'];
  const sets = [];
  const vals = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      vals.push(fields[f]);
      sets.push(`"${f}" = $${vals.length}`);
    }
  }
  if (!sets.length) return getLocation(id);
  vals.push(id);
  const { rows } = await q(`UPDATE locations SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return rows[0] || null;
}

async function deleteLocation(id) {
  const { rowCount } = await q('DELETE FROM locations WHERE id = $1', [id]);
  return rowCount > 0;
}

// ---- users ------------------------------------------------------------------

async function getUserByEmail(email) {
  const { rows } = await q('SELECT * FROM users WHERE email = $1', [email]);
  return toUser(rows[0]);
}

async function createUser(user) {
  await q('INSERT INTO users (email, accreditation_number, created_at) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING', [
    user.email, user.accreditationNumber, user.createdAt,
  ]);
  return user;
}

async function listUsers() {
  const { rows } = await q('SELECT * FROM users');
  return rows.map(toUser);
}

async function countUsers() {
  const { rows } = await q('SELECT COUNT(*)::int AS n FROM users');
  return rows[0].n;
}

// ---- vouchers ---------------------------------------------------------------

async function createVoucher(v) {
  try {
    await q(
      `INSERT INTO vouchers
         (id, email, accreditation_number, location_id, location_name, location_type, meal_type, date, status, issued_at, redeemed_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [v.id, v.email, v.accreditationNumber, v.locationId, v.locationName, v.locationType, v.mealType, v.date, v.status, v.issuedAt, v.redeemedAt]
    );
    return v;
  } catch (err) {
    if (err.code === '23505') {
      const e = new Error('Duplicate voucher');
      e.code = 'DUP_VOUCHER';
      throw e;
    }
    throw err;
  }
}

async function getVoucher(id) {
  const { rows } = await q('SELECT * FROM vouchers WHERE id = $1', [id]);
  return toVoucher(rows[0]);
}

async function findDayVouchers({ email, locationId, date }) {
  const { rows } = await q('SELECT * FROM vouchers WHERE email = $1 AND location_id = $2 AND date = $3', [
    email, locationId, date,
  ]);
  return rows.map(toVoucher);
}

async function findUserDayVouchers({ email, date }) {
  const { rows } = await q('SELECT * FROM vouchers WHERE email = $1 AND date = $2 ORDER BY issued_at ASC', [
    email, date,
  ]);
  return rows.map(toVoucher);
}

async function redeemVoucher(id, atIso) {
  const { rows } = await q(
    "UPDATE vouchers SET status = 'Redeemed', redeemed_at = $2 WHERE id = $1 AND status = 'Pending' RETURNING *",
    [id, atIso]
  );
  return toVoucher(rows[0]) || null;
}

async function listVouchers() {
  const { rows } = await q('SELECT * FROM vouchers ORDER BY issued_at ASC');
  return rows.map(toVoucher);
}

async function expireStale(today) {
  await q("UPDATE vouchers SET status = 'Expired' WHERE status = 'Pending' AND date < $1", [today]);
}

// ---- news -------------------------------------------------------------------

async function listNews() {
  const { rows } = await q('SELECT * FROM news');
  return rows.map(toNews);
}

async function createNews(item) {
  await q('INSERT INTO news (id, title, body, category, pinned, timestamp) VALUES ($1,$2,$3,$4,$5,$6)', [
    item.id, item.title, item.body, item.category, item.pinned, item.timestamp,
  ]);
  return item;
}

async function updateNews(id, fields) {
  const allowed = ['title', 'body', 'category', 'pinned'];
  const sets = [];
  const vals = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      vals.push(fields[f]);
      sets.push(`"${f}" = $${vals.length}`);
    }
  }
  if (!sets.length) {
    const { rows } = await q('SELECT * FROM news WHERE id = $1', [id]);
    return rows[0] ? toNews(rows[0]) : null;
  }
  vals.push(id);
  const { rows } = await q(`UPDATE news SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return rows[0] ? toNews(rows[0]) : null;
}

async function deleteNews(id) {
  const { rowCount } = await q('DELETE FROM news WHERE id = $1', [id]);
  return rowCount > 0;
}

// ---- press conferences ------------------------------------------------------

async function listPress() {
  const { rows } = await q('SELECT * FROM press_conferences');
  return rows;
}

async function createPress(item) {
  await q('INSERT INTO press_conferences (id, date, time, team, room, status, note) VALUES ($1,$2,$3,$4,$5,$6,$7)', [
    item.id, item.date, item.time, item.team, item.room, item.status, item.note,
  ]);
  return item;
}

async function updatePress(id, fields) {
  const allowed = ['date', 'time', 'team', 'room', 'status', 'note'];
  const sets = [];
  const vals = [];
  for (const f of allowed) {
    if (fields[f] !== undefined) {
      vals.push(fields[f]);
      sets.push(`"${f}" = $${vals.length}`);
    }
  }
  if (!sets.length) {
    const { rows } = await q('SELECT * FROM press_conferences WHERE id = $1', [id]);
    return rows[0] || null;
  }
  vals.push(id);
  const { rows } = await q(`UPDATE press_conferences SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return rows[0] || null;
}

async function deletePress(id) {
  const { rowCount } = await q('DELETE FROM press_conferences WHERE id = $1', [id]);
  return rowCount > 0;
}

// ---- transport --------------------------------------------------------------

async function listTransport() {
  const { rows } = await q('SELECT * FROM transport');
  return rows.map(toTransport);
}

async function createTransport(item) {
  await q(
    'INSERT INTO transport (id, route, type, "from", "to", frequency, first_departure, last_departure, duration, notes) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
    [item.id, item.route, item.type, item.from, item.to, item.frequency, item.firstDeparture, item.lastDeparture, item.duration, item.notes]
  );
  return item;
}

async function updateTransport(id, fields) {
  // Maps JS field -> SQL column (quoting reserved words, snake_casing the rest).
  const colMap = {
    route: 'route', type: 'type', from: '"from"', to: '"to"', frequency: 'frequency',
    firstDeparture: 'first_departure', lastDeparture: 'last_departure', duration: 'duration', notes: 'notes',
  };
  const sets = [];
  const vals = [];
  for (const [f, col] of Object.entries(colMap)) {
    if (fields[f] !== undefined) {
      vals.push(fields[f]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) {
    const { rows } = await q('SELECT * FROM transport WHERE id = $1', [id]);
    return rows[0] ? toTransport(rows[0]) : null;
  }
  vals.push(id);
  const { rows } = await q(`UPDATE transport SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return rows[0] ? toTransport(rows[0]) : null;
}

async function deleteTransport(id) {
  const { rowCount } = await q('DELETE FROM transport WHERE id = $1', [id]);
  return rowCount > 0;
}

// ---- categories -------------------------------------------------------------

async function listCategories() {
  const { rows } = await q('SELECT * FROM categories ORDER BY name');
  return rows;
}

async function createCategory(item) {
  await q('INSERT INTO categories (id, name, color) VALUES ($1,$2,$3)', [item.id, item.name, item.color]);
  return item;
}

async function updateCategory(id, fields) {
  const sets = [];
  const vals = [];
  for (const f of ['name', 'color']) {
    if (fields[f] !== undefined) {
      vals.push(fields[f]);
      sets.push(`${f} = $${vals.length}`);
    }
  }
  if (!sets.length) {
    const { rows } = await q('SELECT * FROM categories WHERE id = $1', [id]);
    return rows[0] || null;
  }
  vals.push(id);
  const { rows } = await q(`UPDATE categories SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING *`, vals);
  return rows[0] || null;
}

async function deleteCategory(id) {
  const { rowCount } = await q('DELETE FROM categories WHERE id = $1', [id]);
  return rowCount > 0;
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
};
