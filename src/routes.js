'use strict';

/**
 * REST API for the Media Hub. All handlers are async and talk to the storage
 * adapter (file / Postgres / MongoDB) selected at startup — they never care
 * which one is active.
 *
 *   PUBLIC (client app)
 *     GET    /api/meta                      event branding + timezone + today
 *     GET    /api/locations                 venues + the meals each one offers
 *     GET    /api/user/:email               is this email already registered?
 *     POST   /api/vouchers                  request a voucher (rules enforced)
 *     GET    /api/vouchers/:id              live voucher status (Pending/Redeemed)
 *     GET    /api/news                       news feed
 *     GET    /api/press-conferences          schedule
 *     GET    /api/transport                  shuttle info
 *
 *   ADMIN  (require x-admin-key header or ?key=) — full access
 *     POST   /api/admin/login               validate a key, returns its role
 *     GET    /api/analytics                 dashboard metrics + live feed
 *     POST   /api/admin/redeem              catering: validate & redeem a voucher
 *     GET    /api/admin/export.csv          download full voucher log (CSV)
 *     POST·PUT·DELETE /api/locations[/:id]  venue manager
 *     POST·PUT·DELETE /api/news[/:id]       news manager
 *     POST·PUT·DELETE /api/press-conferences[/:id]   press manager
 *
 *   VOLUNTEER  (require x-volunteer-key header) — redeem only
 *     POST   /api/admin/redeem              same endpoint as admin, scoped access
 */

const express = require('express');
const os = require('os');
const rateLimit = require('express-rate-limit');
const QRCode = require('qrcode');
const store = require('./store');
const { allowedMeals, checkEligibility, STATUS, LOCATION_TYPES } = require('./rules');
const { eventTimezone, todayInTz } = require('./time');

const router = express.Router();

// Shared secrets, required from the environment — no defaults (R-2). server.js
// refuses to boot if these are unset, so they are guaranteed non-empty here.
const ADMIN_KEY = process.env.ADMIN_KEY;

// Scoped secret for volunteers — voucher redemption only.
const VOLUNTEER_KEY = process.env.VOLUNTEER_KEY;

// ---- rate limiting (R-4) ----------------------------------------------------
// Brute-forcing the admin/volunteer key happens at the login endpoint, so that
// gets the strictest limit. Public voucher creation gets a looser cap to stop
// spam. Redemption is already key-gated and used rapidly by catering staff, so
// its limit is generous — high enough never to hinder a real scanning line.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please wait a few minutes and try again.' },
});
const voucherLimiter = rateLimit({
  windowMs: 60 * 1000, max: 20,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down and try again shortly.' },
});
const redeemLimiter = rateLimit({
  windowMs: 60 * 1000, max: 100,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' },
});

// ---- helpers ----------------------------------------------------------------

/** Short, human-friendly unique id, e.g. "MV-7F3K9Q". */
function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

const VENUE_PREFIX = { MMC: 'MMC', Stadium: 'STD', Training: 'TRN' };

function isEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// ---- news attachments (images / PDFs stored as base64 data URLs) ------------
const ATT_ALLOWED = /^(image\/(png|jpe?g|gif|webp)|application\/pdf)$/i;
const ATT_MAX_BYTES = 3 * 1024 * 1024; // 3 MB per file (decoded)
const ATT_MAX_COUNT = 4;

/** Validate/normalise a list of attachments. @returns {ok, attachments}|{ok:false,error} */
function validateAttachments(raw) {
  if (raw === undefined || raw === null) return { ok: true, attachments: [] };
  if (!Array.isArray(raw)) return { ok: false, error: 'Attachments must be a list.' };
  if (raw.length > ATT_MAX_COUNT) return { ok: false, error: `Please attach at most ${ATT_MAX_COUNT} files.` };
  const out = [];
  for (const a of raw) {
    if (!a || typeof a.dataUrl !== 'string') return { ok: false, error: 'Invalid attachment.' };
    const m = a.dataUrl.match(/^data:([^;]+);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) return { ok: false, error: 'Each attachment must be a base64 data URL.' };
    if (!ATT_ALLOWED.test(m[1])) return { ok: false, error: 'Only images (PNG/JPG/GIF/WebP) and PDFs are allowed.' };
    if (Math.floor((m[2].length * 3) / 4) > ATT_MAX_BYTES) {
      return { ok: false, error: `“${a.name || 'A file'}” is too large (max 3 MB each).` };
    }
    out.push({ name: String(a.name || 'file').slice(0, 140), type: m[1], dataUrl: a.dataUrl });
  }
  return { ok: true, attachments: out };
}

// ---- theme / design settings ------------------------------------------------
const THEME_FONTS = ['IBM Plex Sans', 'Inter', 'Poppins', 'Montserrat', 'Roboto', 'System'];
const HEX_RE = /^#[0-9a-fA-F]{6}$/;
const IMG_DATA_RE = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,([A-Za-z0-9+/=]+)$/;

/** Validate/normalise submitted theme fields (only those present are touched). */
function sanitizeTheme(body) {
  const t = {};
  for (const k of ['brandColor', 'accentColor', 'bgColor']) {
    if (body[k] === undefined) continue;
    const v = String(body[k] || '').trim();
    if (v === '' || HEX_RE.test(v)) t[k] = v;
    else return { ok: false, error: `Invalid colour value for ${k}.` };
  }
  for (const k of ['headerTitle', 'headerSubtitle']) {
    if (body[k] !== undefined) t[k] = String(body[k]).slice(0, 80);
  }
  if (body.font !== undefined) t.font = THEME_FONTS.includes(String(body.font)) ? String(body.font) : 'IBM Plex Sans';
  for (const [k, max, label] of [['logo', 1.2 * 1024 * 1024, 'Logo'], ['background', 2.6 * 1024 * 1024, 'Background']]) {
    if (body[k] === undefined) continue;
    const v = String(body[k] || '');
    if (v === '') { t[k] = ''; continue; }
    const m = v.match(IMG_DATA_RE);
    if (!m) return { ok: false, error: `${label} must be an image (PNG/JPG/GIF/WebP/SVG).` };
    if (Math.floor((m[2].length * 3) / 4) > max) return { ok: false, error: `${label} image is too large.` };
    t[k] = v;
  }
  return { ok: true, theme: t };
}

/** A voucher's effective status, applying same-day expiry without a DB write. */
function effectiveStatus(v, today) {
  if (v.status === STATUS.PENDING && v.date < today) return STATUS.EXPIRED;
  return v.status;
}

/** Generate a QR data-URL encoding the voucher id (server-side, offline-friendly). */
async function voucherQr(id) {
  try {
    return await QRCode.toDataURL(id, { margin: 1, scale: 6, errorCorrectionLevel: 'M' });
  } catch (err) {
    console.error('[qr] generation failed:', err.message);
    return '';
  }
}

/** Normalise a scanned/typed voucher id (QR may encode plain id or JSON). */
function normalizeVoucherId(raw) {
  let s = String(raw == null ? '' : raw).trim();
  if (s.startsWith('{')) {
    try {
      const o = JSON.parse(s);
      if (o && o.id) s = String(o.id);
    } catch (e) {
      /* not JSON — use as-is */
    }
  }
  return s.toUpperCase();
}

/** Gate admin-only endpoints behind the shared key. */
function requireAdmin(req, res, next) {
  const key = req.get('x-admin-key') || req.query.key;
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ error: 'Unauthorized — invalid admin key.' });
  }
  req.role = 'admin';
  next();
}

/** Gate the redeemer endpoint behind either the admin key or the volunteer key. */
function requireRedeemAccess(req, res, next) {
  const adminKey = req.get('x-admin-key') || req.query.key;
  if (adminKey && adminKey === ADMIN_KEY) { req.role = 'admin'; return next(); }
  const volunteerKey = req.get('x-volunteer-key');
  if (volunteerKey && volunteerKey === VOLUNTEER_KEY) { req.role = 'volunteer'; return next(); }
  return res.status(401).json({ error: 'Unauthorized — invalid key.' });
}

/** Wrap an async handler so rejections become clean 500s. */
function wrap(fn) {
  return (req, res) => fn(req, res).catch((err) => {
    console.error(`[api] ${req.method} ${req.path} failed:`, err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Server error. Please try again.' });
  });
}

// =============================================================================
//  PUBLIC
// =============================================================================

router.get('/meta', wrap(async (req, res) => {
  const meta = await store.getMeta();
  res.json({ ...meta, timezone: eventTimezone(), today: todayInTz() });
}));

// Venues, each annotated with the meal types it offers so the client can build
// the meal selector dynamically.
router.get('/locations', wrap(async (req, res) => {
  const locations = await store.listLocations();
  res.json(locations.map((l) => ({ ...l, allowedMeals: allowedMeals(l.type) })));
}));

// Lets the client hide the accreditation field for returning users. Returns
// only whether the email is on file — never the accreditation number itself
// (R-3): this endpoint is public and email-addressable, so echoing PII would
// let anyone harvest accreditation numbers by guessing emails.
router.get('/user/:email', wrap(async (req, res) => {
  const email = String(req.params.email || '').trim().toLowerCase();
  const user = await store.getUserByEmail(email);
  res.json({ known: !!user });
}));

// Issue a voucher — the heart of the system. Every rule is enforced here,
// server-side, so the browser cannot talk its way around the daily limits.
router.post('/vouchers', voucherLimiter, wrap(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const accreditationNumber = String(req.body.accreditationNumber || '').trim();
  const locationId = String(req.body.locationId || '').trim();
  const mealType = String(req.body.mealType || '').trim();

  if (!isEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const location = await store.getLocation(locationId);
  if (!location) {
    return res.status(400).json({ error: 'Please choose a valid location.' });
  }
  if (!allowedMeals(location.type).includes(mealType)) {
    return res.status(400).json({ error: `Please choose a valid meal type for ${location.name}.` });
  }

  // --- Identity: register on first contact, auto-link thereafter. ---
  let user = await store.getUserByEmail(email);
  const firstTime = !user;
  if (!user) {
    if (!accreditationNumber) {
      return res.status(400).json({
        code: 'ACCREDITATION_REQUIRED',
        error: 'First-time request: please provide your accreditation number.',
      });
    }
    user = { email, accreditationNumber, createdAt: new Date().toISOString() };
    await store.createUser(user);
  }

  // --- Allocation limits (per email / location / calendar day). ---
  const date = todayInTz();
  const existing = await store.findDayVouchers({ email, locationId, date });
  const eligibility = checkEligibility({ existing, location, mealType });
  if (!eligibility.ok) {
    return res.status(409).json({ code: eligibility.code, error: eligibility.message });
  }

  // --- Issue. ---
  const issuedAt = new Date().toISOString();
  const voucher = {
    id: uid('MV'),
    email,
    accreditationNumber: user.accreditationNumber,
    locationId: location.id,
    locationName: location.name,
    locationType: location.type,
    mealType,
    date,
    status: STATUS.PENDING,
    issuedAt,
    redeemedAt: null,
  };

  try {
    await store.createVoucher(voucher);
  } catch (err) {
    // Backstop: the DB UNIQUE constraint caught a duplicate (e.g. a race).
    if (err.code === 'DUP_VOUCHER') {
      return res.status(409).json({
        code: 'LIMIT_REACHED',
        error: `You have already claimed your ${mealType === 'Meal' ? 'Media Café meal' : mealType} at ${location.name} today.`,
      });
    }
    throw err;
  }

  // QR encodes the Voucher ID (generated server-side, so the client needs no
  // QR library or internet connection). The catering scanner reads this id.
  const qr = await voucherQr(voucher.id);

  res.status(201).json({ voucher: { ...voucher, qr }, registeredNow: firstTime });
}));

// All of a media member's vouchers for TODAY (the event-tz calendar day), each
// with a freshly generated QR. This is what lets the client re-display a user's
// vouchers after they close/reopen the app — from any device — until the day
// rolls over. Keyed on email (the cached identity).
router.get('/vouchers', wrap(async (req, res) => {
  const email = String(req.query.email || '').trim().toLowerCase();
  if (!isEmail(email)) return res.status(400).json({ error: 'A valid email is required.' });

  const today = todayInTz();
  const list = (await store.findUserDayVouchers({ email, date: today }))
    .sort((a, b) => String(a.issuedAt).localeCompare(String(b.issuedAt)));

  const vouchers = await Promise.all(
    list.map(async (v) => ({ ...v, status: effectiveStatus(v, today), qr: await voucherQr(v.id) }))
  );
  res.json({ date: today, vouchers });
}));

// Live voucher status — lets the client card flip Pending → Redeemed in real time.
router.get('/vouchers/:id', wrap(async (req, res) => {
  const id = normalizeVoucherId(req.params.id);
  const v = await store.getVoucher(id);
  if (!v) return res.status(404).json({ error: 'Voucher not found.' });
  const today = todayInTz();
  res.json({
    id: v.id,
    status: effectiveStatus(v, today),
    mealType: v.mealType,
    locationName: v.locationName,
    locationType: v.locationType,
    date: v.date,
    issuedAt: v.issuedAt,
    redeemedAt: v.redeemedAt,
  });
}));

router.get('/news', wrap(async (req, res) => {
  const news = (await store.listNews()).sort(
    (a, b) =>
      (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) ||
      new Date(b.timestamp) - new Date(a.timestamp)
  );
  res.json(news);
}));

router.get('/press-conferences', wrap(async (req, res) => {
  const list = (await store.listPress()).sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time)
  );
  res.json(list);
}));

router.get('/transport', wrap(async (req, res) => {
  res.json(await store.listTransport());
}));

router.get('/categories', wrap(async (req, res) => {
  res.json(await store.listCategories());
}));

router.get('/theme', wrap(async (req, res) => {
  res.json(await store.getSettings());
}));

// A shareable QR code that opens the Media Client app. The encoded URL is the
// address the app is actually being served on (the request Host), so it works
// both on the venue LAN and once deployed to the cloud — no hardcoding. When
// opened via localhost, we substitute a LAN IP so other devices can reach it.
router.get('/share', wrap(async (req, res) => {
  const url = shareBaseUrl(req);
  let qr = '';
  try {
    qr = await QRCode.toDataURL(url, { margin: 1, scale: 9, errorCorrectionLevel: 'M', color: { dark: '#12274a', light: '#ffffff' } });
  } catch (err) {
    console.error('[qr] share generation failed:', err.message);
  }
  res.json({ url, qr });
}));

function firstLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return null;
}

function shareBaseUrl(req) {
  const host = req.get('host') || `localhost:${process.env.PORT || 3000}`;
  const proto = String(req.get('x-forwarded-proto') || req.protocol || 'http').split(',')[0];
  // Behind a localhost address, swap in a LAN IP so phones can actually reach it.
  if (/^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)) {
    const ip = firstLanIp();
    if (ip) {
      const port = host.includes(':') ? host.split(':')[1] : (process.env.PORT || 3000);
      return `http://${ip}:${port}/`;
    }
  }
  return `${proto}://${host}/`;
}

// =============================================================================
//  ADMIN
// =============================================================================

router.post('/admin/login', loginLimiter, (req, res) => {
  const key = String(req.body.key || '');
  if (key === ADMIN_KEY) return res.json({ ok: true, role: 'admin' });
  if (key === VOLUNTEER_KEY) return res.json({ ok: true, role: 'volunteer' });
  return res.status(401).json({ error: 'Incorrect key.' });
});

router.get('/analytics', requireAdmin, wrap(async (req, res) => {
  const today = todayInTz();
  await store.expireStale(today);
  const [vouchers, uniqueUsers] = await Promise.all([store.listVouchers(), store.countUsers()]);

  const byMeal = { Lunch: 0, Dinner: 0, Meal: 0 };
  const byType = { MMC: 0, Training: 0, Stadium: 0 };
  const byStatus = { Pending: 0, Redeemed: 0, Expired: 0 };
  const byLocation = {};
  let issuedToday = 0;
  let redeemedToday = 0;

  for (const v of vouchers) {
    byMeal[v.mealType] = (byMeal[v.mealType] || 0) + 1;
    byType[v.locationType] = (byType[v.locationType] || 0) + 1;
    byStatus[v.status] = (byStatus[v.status] || 0) + 1;
    byLocation[v.locationName] = (byLocation[v.locationName] || 0) + 1;
    if (v.date === today) {
      issuedToday += 1;
      if (v.status === STATUS.REDEEMED) redeemedToday += 1;
    }
  }

  // Feed: most-recent activity first (a fresh scan jumps to the top).
  const recent = vouchers
    .map((v) => ({ ...v, activityAt: v.redeemedAt || v.issuedAt }))
    .sort((a, b) => new Date(b.activityAt) - new Date(a.activityAt))
    .slice(0, 30);

  res.json({
    total: vouchers.length,
    issuedToday,
    redeemedToday,
    redeemedTotal: byStatus.Redeemed,
    uniqueUsers,
    stadiumMeals: byMeal.Meal,
    byMeal,
    byType,
    byStatus,
    byLocation,
    recent,
    today,
  });
}));

// ---- Catering Staff Voucher Redeemer ----------------------------------------

router.post('/admin/redeem', redeemLimiter, requireRedeemAccess, wrap(async (req, res) => {
  const id = normalizeVoucherId(req.body.voucherId || req.body.id);
  if (!id) return res.status(400).json({ code: 'INVALID', error: 'Please scan or enter a voucher ID.' });

  const today = todayInTz();
  const v = await store.getVoucher(id);
  if (!v) {
    return res.status(404).json({ code: 'NOT_FOUND', error: `No voucher found for "${id}".` });
  }

  const status = effectiveStatus(v, today);
  if (status === STATUS.EXPIRED) {
    return res.status(409).json({ code: 'EXPIRED', error: 'This voucher has expired.', voucher: v });
  }
  if (status === STATUS.REDEEMED) {
    return res.status(409).json({
      code: 'ALREADY_REDEEMED',
      error: 'This voucher has already been redeemed.',
      voucher: v,
      redeemedAt: v.redeemedAt,
    });
  }

  // Atomic Pending → Redeemed (only succeeds once, even under concurrency).
  const redeemed = await store.redeemVoucher(id, new Date().toISOString());
  if (!redeemed) {
    const fresh = await store.getVoucher(id);
    return res.status(409).json({
      code: 'ALREADY_REDEEMED',
      error: 'This voucher has already been redeemed.',
      voucher: fresh,
      redeemedAt: fresh && fresh.redeemedAt,
    });
  }

  res.json({ ok: true, code: 'REDEEMED', voucher: redeemed });
}));

// ---- CSV export -------------------------------------------------------------

router.get('/admin/export.csv', requireAdmin, wrap(async (req, res) => {
  const today = todayInTz();
  await store.expireStale(today);
  const vouchers = (await store.listVouchers()).sort((a, b) =>
    String(a.issuedAt).localeCompare(String(b.issuedAt))
  );

  const cols = [
    ['Voucher ID', (v) => v.id],
    ['Email', (v) => v.email],
    ['Accreditation', (v) => v.accreditationNumber],
    ['Location', (v) => v.locationName],
    ['Location Type', (v) => v.locationType],
    ['Meal Type', (v) => v.mealType],
    ['Date', (v) => v.date],
    ['Status', (v) => v.status],
    ['Issued At', (v) => v.issuedAt],
    ['Redeemed At', (v) => v.redeemedAt || ''],
  ];

  const cell = (val) => {
    const s = String(val == null ? '' : val);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [cols.map((c) => c[0]).join(',')];
  for (const v of vouchers) lines.push(cols.map((c) => cell(c[1](v))).join(','));

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="afc2027-vouchers-${today}.csv"`);
  res.send('﻿' + lines.join('\r\n')); // BOM for Excel compatibility
}));

// ---- Venue Manager (CMS) ----------------------------------------------------

router.post('/locations', requireAdmin, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  const type = String(req.body.type || '').trim();
  if (!name) return res.status(400).json({ error: 'Please enter a venue name.' });
  if (!LOCATION_TYPES.includes(type)) {
    return res.status(400).json({ error: 'Type must be one of: MMC, Stadium, Training.' });
  }
  const loc = {
    id: uid(VENUE_PREFIX[type] || 'VEN'),
    name,
    type,
    zone: String(req.body.zone || '').trim(),
    window: String(req.body.window || '').trim(),
  };
  await store.createLocation(loc);
  res.status(201).json(loc);
}));

router.put('/locations/:id', requireAdmin, wrap(async (req, res) => {
  const fields = {};
  if (req.body.name !== undefined) fields.name = String(req.body.name).trim();
  if (req.body.zone !== undefined) fields.zone = String(req.body.zone).trim();
  if (req.body.window !== undefined) fields.window = String(req.body.window).trim();
  if (req.body.type !== undefined) {
    const type = String(req.body.type).trim();
    if (!LOCATION_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Type must be one of: MMC, Stadium, Training.' });
    }
    fields.type = type;
  }
  const updated = await store.updateLocation(req.params.id, fields);
  if (!updated) return res.status(404).json({ error: 'Venue not found.' });
  res.json(updated);
}));

router.delete('/locations/:id', requireAdmin, wrap(async (req, res) => {
  const ok = await store.deleteLocation(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Venue not found.' });
  res.json({ ok: true });
}));

// ---- News CMS ---------------------------------------------------------------

router.post('/news', requireAdmin, wrap(async (req, res) => {
  const att = validateAttachments(req.body.attachments);
  if (!att.ok) return res.status(400).json({ error: att.error });
  const item = {
    id: uid('NW'),
    title: String(req.body.title || '').trim() || 'Untitled update',
    body: String(req.body.body || '').trim(),
    category: String(req.body.category || 'Announcement').trim(),
    pinned: !!req.body.pinned,
    timestamp: new Date().toISOString(),
    attachments: att.attachments,
  };
  await store.createNews(item);
  res.status(201).json(item);
}));

router.put('/news/:id', requireAdmin, wrap(async (req, res) => {
  const fields = {};
  for (const f of ['title', 'body', 'category']) {
    if (req.body[f] !== undefined) fields[f] = String(req.body[f]).trim();
  }
  if (req.body.pinned !== undefined) fields.pinned = !!req.body.pinned;
  if (req.body.attachments !== undefined) {
    const att = validateAttachments(req.body.attachments);
    if (!att.ok) return res.status(400).json({ error: att.error });
    fields.attachments = att.attachments;
  }
  const updated = await store.updateNews(req.params.id, fields);
  if (!updated) return res.status(404).json({ error: 'News item not found.' });
  res.json(updated);
}));

router.delete('/news/:id', requireAdmin, wrap(async (req, res) => {
  const ok = await store.deleteNews(req.params.id);
  if (!ok) return res.status(404).json({ error: 'News item not found.' });
  res.json({ ok: true });
}));

// ---- Categories CMS ---------------------------------------------------------

router.post('/categories', requireAdmin, wrap(async (req, res) => {
  const name = String(req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Please enter a category name.' });
  const item = {
    id: uid('CAT'),
    name,
    color: String(req.body.color || '#5c6a7e').trim() || '#5c6a7e',
  };
  await store.createCategory(item);
  res.status(201).json(item);
}));

router.put('/categories/:id', requireAdmin, wrap(async (req, res) => {
  const fields = {};
  if (req.body.name !== undefined) fields.name = String(req.body.name).trim();
  if (req.body.color !== undefined) fields.color = String(req.body.color).trim();
  const updated = await store.updateCategory(req.params.id, fields);
  if (!updated) return res.status(404).json({ error: 'Category not found.' });
  res.json(updated);
}));

router.delete('/categories/:id', requireAdmin, wrap(async (req, res) => {
  const ok = await store.deleteCategory(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Category not found.' });
  res.json({ ok: true });
}));

// ---- Theme / Design ---------------------------------------------------------

router.put('/theme', requireAdmin, wrap(async (req, res) => {
  const s = sanitizeTheme(req.body || {});
  if (!s.ok) return res.status(400).json({ error: s.error });
  const merged = { ...(await store.getSettings()), ...s.theme };
  await store.saveSettings(merged);
  res.json(merged);
}));

// ---- Press conference CMS ---------------------------------------------------

router.post('/press-conferences', requireAdmin, wrap(async (req, res) => {
  const item = {
    id: uid('PC'),
    date: String(req.body.date || '').trim(),
    time: String(req.body.time || '').trim(),
    team: String(req.body.team || '').trim() || 'TBC',
    room: String(req.body.room || '').trim() || 'PC Room 1',
    status: String(req.body.status || 'Scheduled').trim(),
    note: String(req.body.note || '').trim(),
  };
  await store.createPress(item);
  res.status(201).json(item);
}));

router.put('/press-conferences/:id', requireAdmin, wrap(async (req, res) => {
  const fields = {};
  for (const f of ['date', 'time', 'team', 'room', 'status', 'note']) {
    if (req.body[f] !== undefined) fields[f] = String(req.body[f]).trim();
  }
  const updated = await store.updatePress(req.params.id, fields);
  if (!updated) return res.status(404).json({ error: 'Press conference not found.' });
  res.json(updated);
}));

router.delete('/press-conferences/:id', requireAdmin, wrap(async (req, res) => {
  const ok = await store.deletePress(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Press conference not found.' });
  res.json({ ok: true });
}));

// ---- Transport / shuttle CMS ------------------------------------------------

const TRANSPORT_TYPES = ['Stadium', 'Training'];

router.post('/transport', requireAdmin, wrap(async (req, res) => {
  const type = TRANSPORT_TYPES.includes(String(req.body.type || '').trim())
    ? String(req.body.type).trim()
    : 'Stadium';
  const to = String(req.body.to || '').trim();
  const item = {
    id: uid('TR'),
    route: String(req.body.route || '').trim() || (to ? `MMC ⇄ ${to}` : 'New shuttle route'),
    type,
    from: String(req.body.from || '').trim() || 'Main Media Centre',
    to,
    frequency: String(req.body.frequency || '').trim(),
    firstDeparture: String(req.body.firstDeparture || '').trim(),
    lastDeparture: String(req.body.lastDeparture || '').trim(),
    duration: String(req.body.duration || '').trim(),
    notes: String(req.body.notes || '').trim(),
  };
  await store.createTransport(item);
  res.status(201).json(item);
}));

router.put('/transport/:id', requireAdmin, wrap(async (req, res) => {
  const fields = {};
  for (const f of ['route', 'from', 'to', 'frequency', 'firstDeparture', 'lastDeparture', 'duration', 'notes']) {
    if (req.body[f] !== undefined) fields[f] = String(req.body[f]).trim();
  }
  if (req.body.type !== undefined) {
    const type = String(req.body.type).trim();
    if (!TRANSPORT_TYPES.includes(type)) {
      return res.status(400).json({ error: 'Type must be Stadium or Training.' });
    }
    fields.type = type;
  }
  const updated = await store.updateTransport(req.params.id, fields);
  if (!updated) return res.status(404).json({ error: 'Shuttle route not found.' });
  res.json(updated);
}));

router.delete('/transport/:id', requireAdmin, wrap(async (req, res) => {
  const ok = await store.deleteTransport(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Shuttle route not found.' });
  res.json({ ok: true });
}));

module.exports = { router, ADMIN_KEY, VOLUNTEER_KEY };
