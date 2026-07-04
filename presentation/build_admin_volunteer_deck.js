'use strict';

/* Generates the AFC Asian Cup 2027 Media Hub — Admin & Volunteer onboarding deck.
   Run with:  node presentation/build_admin_volunteer_deck.js */

const path = require('path');
const pptxgen = require(path.join(__dirname, 'node_modules', 'pptxgenjs'));

// ---- palette ---------------------------------------------------------------
const NAVY = '12274A';
const NAVY2 = '1E3A6B';
const BLUE = '2F6BFF';        // Admin accent
const BLUE_SOFT = 'E8F0FF';
const GREEN = '0E9F6E';       // Volunteer accent
const GREEN_SOFT = 'E2F6EE';
const PURPLE = '7A2BB8';
const PURPLE_SOFT = 'F1E5FB';
const AMBER = 'B9710A';
const AMBER_SOFT = 'FBEFD9';
const RED = 'D12626';
const RED_SOFT = 'FDE6E6';
const INK = '0F1A2E';
const MUTED = '5C6A7E';
const FAINT = '8A96A8';
const LINE = 'DCE2EC';
const PANEL = 'F5F8FC';
const WHITE = 'FFFFFF';
const DARKMUTED = '93A4C6';

const FONT = 'Segoe UI';
const MONO = 'Consolas';

// ---- live deployment -------------------------------------------------------
const HOST = 'afc2027-media-hub.onrender.com';
const URL_ADMIN = 'https://' + HOST + '/admin';

// ---- geometry --------------------------------------------------------------
const W = 13.333, H = 7.5;
const MX = 0.62;
const CW = W - 2 * MX;

const pres = new pptxgen();
pres.defineLayout({ name: 'WIDE', width: W, height: H });
pres.layout = 'WIDE';
pres.author = 'AFC Asian Cup 2027 Media Operations';
pres.title = 'Media Hub — Admin & Volunteer Onboarding';

let pageNo = 0;

// ---- helpers ---------------------------------------------------------------
const shadow = () => ({ type: 'outer', color: '0F1A2E', blur: 9, offset: 3, angle: 90, opacity: 0.12 });

function slideLight() {
  const s = pres.addSlide();
  s.background = { color: WHITE };
  return s;
}
function slideDark() {
  const s = pres.addSlide();
  s.background = { color: NAVY };
  return s;
}

function kicker(s, text, color, x = MX, y = 0.62) {
  s.addText(text.toUpperCase(), {
    x, y, w: CW, h: 0.32, margin: 0, fontFace: FONT, fontSize: 12.5, bold: true,
    color, charSpacing: 3, align: 'left',
  });
}

function title(s, text, color = INK, x = MX, y = 0.95, w = CW) {
  s.addText(text, {
    x, y, w, h: 0.9, margin: 0, fontFace: FONT, fontSize: 32, bold: true,
    color, align: 'left', valign: 'top',
  });
}

function footer(s, dark = false) {
  pageNo += 1;
  const c = dark ? DARKMUTED : FAINT;
  s.addText('AFC Asian Cup 2027  ·  Media Hub — Staff Onboarding', {
    x: MX, y: H - 0.45, w: 7, h: 0.3, margin: 0, fontFace: FONT, fontSize: 9,
    color: c, align: 'left', valign: 'middle',
  });
  s.addText(String(pageNo).padStart(2, '0'), {
    x: W - MX - 1, y: H - 0.45, w: 1, h: 0.3, margin: 0, fontFace: FONT, fontSize: 9,
    color: c, align: 'right', valign: 'middle',
  });
}

function card(s, x, y, w, h, opts = {}) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
    x, y, w, h, rectRadius: opts.radius || 0.12,
    fill: { color: opts.fill || WHITE },
    line: opts.line === false ? { type: 'none' } : { color: opts.lineColor || LINE, width: 1 },
    shadow: opts.shadow === false ? undefined : shadow(),
  });
}

function stepBadge(s, n, x, y, color, d = 0.6) {
  s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color }, line: { type: 'none' } });
  s.addText(String(n), {
    x, y, w: d, h: d, margin: 0, fontFace: FONT, fontSize: 22, bold: true,
    color: WHITE, align: 'center', valign: 'middle',
  });
}

function bullets(s, items, x, y, w, h, opts = {}) {
  const runs = items.map((it) => {
    const isObj = typeof it === 'object';
    return {
      text: isObj ? it.text : it,
      options: {
        bullet: { code: '2022', indent: 16 },
        indentLevel: isObj && it.level ? it.level : 0,
        breakLine: true,
        fontSize: opts.fontSize || 15,
        color: opts.color || INK,
        bold: !!(isObj && it.bold),
        paraSpaceAfter: opts.gap != null ? opts.gap : 10,
      },
    };
  });
  s.addText(runs, { x, y, w, h, margin: 0, fontFace: FONT, valign: 'top', align: 'left' });
}

function numberedList(s, items, x, y, w, opts = {}) {
  const rowH = opts.rowH || 0.92;
  const color = opts.color || BLUE;
  items.forEach((it, i) => {
    const ry = y + i * rowH;
    s.addShape(pres.shapes.OVAL, { x, y: ry, w: 0.42, h: 0.42, fill: { color }, line: { type: 'none' } });
    s.addText(String(i + 1), { x, y: ry, w: 0.42, h: 0.42, margin: 0, fontFace: FONT, fontSize: 15, bold: true, color: WHITE, align: 'center', valign: 'middle' });
    s.addText([
      { text: it.h + '\n', options: { bold: true, fontSize: 14.5, color: INK, breakLine: true } },
      { text: it.d, options: { fontSize: 12.5, color: MUTED } },
    ], { x: x + 0.6, y: ry - 0.04, w: w - 0.6, h: rowH, margin: 0, fontFace: FONT, valign: 'top', align: 'left', lineSpacingMultiple: 1.0 });
  });
}

function pill(s, text, x, y, w, h, fill, color, fs = 12) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: fill }, line: { type: 'none' } });
  s.addText(text, { x, y, w, h, margin: 0, fontFace: FONT, fontSize: fs, bold: true, color, align: 'center', valign: 'middle' });
}

// QR-like motif inside a white box
function drawQR(s, x, y, size, dark = '12274A') {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: size, h: size, rectRadius: 0.08, fill: { color: WHITE }, line: { color: LINE, width: 1 } });
  const pad = size * 0.12;
  const inner = size - pad * 2;
  const ox = x + pad, oy = y + pad;
  const fp = inner * 0.28;
  const finders = [[ox, oy], [ox + inner - fp, oy], [ox, oy + inner - fp]];
  finders.forEach(([fx, fy]) => {
    s.addShape(pres.shapes.RECTANGLE, { x: fx, y: fy, w: fp, h: fp, fill: { color: dark }, line: { type: 'none' } });
    s.addShape(pres.shapes.RECTANGLE, { x: fx + fp * 0.22, y: fy + fp * 0.22, w: fp * 0.56, h: fp * 0.56, fill: { color: WHITE }, line: { type: 'none' } });
    s.addShape(pres.shapes.RECTANGLE, { x: fx + fp * 0.36, y: fy + fp * 0.36, w: fp * 0.28, h: fp * 0.28, fill: { color: dark }, line: { type: 'none' } });
  });
  const n = 9, cell = inner / n;
  let seed = 7;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const inFinder = (r < 3 && c < 3) || (r < 3 && c > n - 4) || (r > n - 4 && c < 3);
      if (inFinder) continue;
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      if ((seed >> 8) % 100 < 42) {
        s.addShape(pres.shapes.RECTANGLE, { x: ox + c * cell + cell * 0.1, y: oy + r * cell + cell * 0.1, w: cell * 0.8, h: cell * 0.8, fill: { color: dark }, line: { type: 'none' } });
      }
    }
  }
}

// browser window frame; returns inner content rect
function browser(s, x, y, w, h, url) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: WHITE }, line: { color: LINE, width: 1 }, shadow: shadow() });
  s.addShape(pres.shapes.RECTANGLE, { x: x + 0.02, y: y + 0.04, w: w - 0.04, h: 0.46, fill: { color: PANEL }, line: { type: 'none' } });
  ['F96167', 'F9C23C', '3FBF6A'].forEach((c, i) => {
    s.addShape(pres.shapes.OVAL, { x: x + 0.22 + i * 0.22, y: y + 0.2, w: 0.12, h: 0.12, fill: { color: c }, line: { type: 'none' } });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x + 1.0, y: y + 0.13, w: w - 1.3, h: 0.28, rectRadius: 0.14, fill: { color: WHITE }, line: { color: LINE, width: 1 } });
  if (url) s.addText(url, { x: x + 1.15, y: y + 0.13, w: w - 1.5, h: 0.28, margin: 0, fontFace: MONO, fontSize: 9.5, color: MUTED, align: 'left', valign: 'middle' });
  return { x: x + 0.02, y: y + 0.56, w: w - 0.04, h: h - 0.6 };
}

// tab strip inside a browser rect — highlights `active`, dims the rest
function tabStrip(s, r, tabs, active, activeColor = BLUE) {
  let tx = r.x + 0.2;
  tabs.forEach((t) => {
    const tw = 0.28 + t.length * 0.085;
    const isActive = t === active;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: r.y + 0.15, w: tw, h: 0.36, rectRadius: 0.18, fill: { color: isActive ? activeColor : PANEL }, line: { type: 'none' } });
    s.addText(t, { x: tx, y: r.y + 0.15, w: tw, h: 0.36, margin: 0, fontFace: FONT, fontSize: 9, bold: isActive, color: isActive ? WHITE : MUTED, align: 'center', valign: 'middle' });
    tx += tw + 0.12;
  });
}

// =============================================================================
// SLIDE 1 — Title
// =============================================================================
(() => {
  const s = slideDark();
  s.addShape(pres.shapes.OVAL, { x: 10.4, y: -1.4, w: 4.6, h: 4.6, fill: { color: NAVY2 }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: 11.7, y: 4.6, w: 3.4, h: 3.4, fill: { color: '16305C' }, line: { type: 'none' } });

  // shield icon tile (staff access)
  const ix = 9.7, iy = 2.1, isz = 1.9;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ix, y: iy, w: isz, h: isz, rectRadius: 0.42, fill: { color: BLUE }, line: { type: 'none' }, shadow: shadow() });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ix + 0.62, y: iy + 0.5, w: 0.66, h: 0.55, rectRadius: 0.08, fill: { color: WHITE }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: ix + 0.83, y: iy + 0.68, w: 0.24, h: 0.24, fill: { color: BLUE }, line: { type: 'none' } });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ix + 0.72, y: iy + 1.18, w: 0.46, h: 0.12, rectRadius: 0.05, fill: { color: WHITE }, line: { type: 'none' } });

  s.addText('STAFF ONBOARDING GUIDE', { x: MX, y: 1.45, w: 8.5, h: 0.4, margin: 0, fontFace: FONT, fontSize: 14, bold: true, color: '6FA0FF', charSpacing: 4 });
  s.addText('Admins & Volunteers', { x: MX, y: 1.95, w: 8.9, h: 1.3, margin: 0, fontFace: FONT, fontSize: 54, bold: true, color: WHITE });
  s.addText('Running the Meal Voucher system — AFC Asian Cup 2027 Media Hub', { x: MX, y: 3.3, w: 8.6, h: 0.6, margin: 0, fontFace: FONT, fontSize: 19, color: 'CFDBF2' });

  pill(s, 'For Administrators', MX, 4.3, 2.5, 0.5, BLUE, WHITE, 12.5);
  pill(s, 'For Volunteers', MX + 2.7, 4.3, 2.2, 0.5, GREEN, WHITE, 12.5);

  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 5.15, w: 7.4, h: 0.62, rectRadius: 0.12, fill: { color: '17305A' }, line: { type: 'none' } });
  s.addText([
    { text: 'STAFF LOGIN  ', options: { color: '6BE0AE', bold: true, fontSize: 12 } },
    { text: HOST + '/admin', options: { color: WHITE, bold: true, fontSize: 13.5, fontFace: MONO } },
  ], { x: MX + 0.25, y: 5.15, w: 7.0, h: 0.62, margin: 0, fontFace: FONT, valign: 'middle', align: 'left' });

  s.addText('One login page for both roles — your key decides what you can do.', { x: MX, y: 5.95, w: 8.6, h: 0.5, margin: 0, fontFace: FONT, fontSize: 13.5, italic: true, color: DARKMUTED });
  footer(s, true);
})();

// =============================================================================
// SLIDE 2 — Roles at a glance
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'Roles', BLUE);
  title(s, 'Two roles, two keys');

  const cy = 2.0, ch = 2.9, cw = 5.85, gap = CW - cw * 2;
  // Admin card
  card(s, MX, cy, cw, ch, { lineColor: BLUE_SOFT });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: cy, w: cw, h: 0.85, rectRadius: 0.12, fill: { color: NAVY }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: MX, y: cy + 0.43, w: cw, h: 0.42, fill: { color: NAVY }, line: { type: 'none' } });
  s.addText('Administrator', { x: MX + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 20, bold: true, color: WHITE, valign: 'middle' });
  s.addText('full dashboard', { x: MX + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 12, color: 'BFD2F6', align: 'right', valign: 'middle' });
  bullets(s, [
    'Live analytics, counters & CSV export.',
    'Redeem vouchers (same tool as volunteers).',
    'Manage venues, news, press & transport.',
    'Share the client-app QR; hold both keys.',
  ], MX + 0.35, cy + 1.05, cw - 0.7, 1.5, { fontSize: 13, gap: 6 });
  s.addText('signs in with the ADMIN key', { x: MX + 0.35, y: cy + ch - 0.42, w: cw - 0.7, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, color: BLUE, bold: true });

  // Volunteer card
  const ax = MX + cw + gap;
  card(s, ax, cy, cw, ch, { lineColor: GREEN_SOFT });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ax, y: cy, w: cw, h: 0.85, rectRadius: 0.12, fill: { color: GREEN }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: ax, y: cy + 0.43, w: cw, h: 0.42, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('Volunteer', { x: ax + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 20, bold: true, color: WHITE, valign: 'middle' });
  s.addText('buffet counter', { x: ax + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 12, color: 'D8F3E6', align: 'right', valign: 'middle' });
  bullets(s, [
    'One job: scan & redeem meal vouchers.',
    'Sees only the Redeemer tab.',
    'The server blocks every other admin action.',
    'No access to analytics, exports or content.',
  ], ax + 0.35, cy + 1.05, cw - 0.7, 1.5, { fontSize: 13, gap: 6 });
  s.addText('signs in with the VOLUNTEER key', { x: ax + 0.35, y: cy + ch - 0.42, w: cw - 0.7, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, color: GREEN, bold: true });

  const by = cy + ch + 0.3;
  card(s, MX, by, CW, 0.95, { fill: AMBER_SOFT, lineColor: 'F1DCB0', shadow: false });
  s.addText([
    { text: 'Same login page.  ', options: { bold: true, color: AMBER, fontSize: 14 } },
    { text: 'Both roles open ' + HOST + '/admin and enter their key. The scope is enforced by the server, not just hidden in the interface — a volunteer key is rejected on every endpoint except voucher redemption.', options: { color: '7A4E08', fontSize: 13 } },
  ], { x: MX + 0.35, y: by, w: CW - 0.7, h: 0.95, margin: 0, fontFace: FONT, valign: 'middle', align: 'left' });
  footer(s);
})();

// =============================================================================
// SLIDE 3 — Signing in (both roles)
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'Getting in', BLUE);
  title(s, 'Sign in — same door for everyone');

  numberedList(s, [
    { h: 'Open the staff login', d: 'On any phone, tablet or laptop:  ' + HOST + '/admin' },
    { h: 'Enter your key', d: 'Admin key → full dashboard.  Volunteer key → Redeemer only.' },
    { h: 'Stay signed in', d: 'The key is remembered for the browser session.' },
    { h: 'Lock when you leave', d: 'Tap Lock to sign out — always do this on shared devices.' },
  ], MX, 2.05, 6.0, { color: BLUE, rowH: 1.02 });

  // login mock in browser
  const bx = 7.0, bw = CW - (bx - MX);
  const r = browser(s, bx, 2.0, bw, 3.9, HOST + '/admin');
  const fx = r.x + (r.w - 3.0) / 2;
  s.addShape(pres.shapes.OVAL, { x: fx + 1.25, y: r.y + 0.3, w: 0.6, h: 0.6, fill: { color: NAVY }, line: { type: 'none' } });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx + 1.45, y: r.y + 0.5, w: 0.2, h: 0.18, rectRadius: 0.03, fill: { color: WHITE }, line: { type: 'none' } });
  s.addText('Staff access', { x: r.x, y: r.y + 1.0, w: r.w, h: 0.35, margin: 0, fontFace: FONT, fontSize: 15, bold: true, color: INK, align: 'center' });
  s.addText('Admin keys unlock the full dashboard; volunteer keys unlock the voucher redeemer only.', { x: r.x + 0.5, y: r.y + 1.35, w: r.w - 1.0, h: 0.5, margin: 0, fontFace: FONT, fontSize: 10.5, color: MUTED, align: 'center' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx, y: r.y + 1.95, w: 3.0, h: 0.45, rectRadius: 0.08, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
  s.addText('• • • • • • • • • •', { x: fx + 0.15, y: r.y + 1.95, w: 2.7, h: 0.45, margin: 0, fontFace: FONT, fontSize: 13, color: MUTED, valign: 'middle' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx, y: r.y + 2.55, w: 3.0, h: 0.45, rectRadius: 0.08, fill: { color: BLUE }, line: { type: 'none' } });
  s.addText('Unlock', { x: fx, y: r.y + 2.55, w: 3.0, h: 0.45, margin: 0, fontFace: FONT, fontSize: 12.5, bold: true, color: WHITE, align: 'center', valign: 'middle' });

  pill(s, 'Keys are secrets — never post them in group chats or print them on posters', MX, 6.25, 6.6, 0.5, RED_SOFT, '9D1C1C', 11);
  footer(s);
})();

// =============================================================================
// SLIDE 4 — Section: Admins
// =============================================================================
(() => {
  const s = slideDark();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.22, h: H, fill: { color: BLUE }, line: { type: 'none' } });
  s.addText('PART 1', { x: MX, y: 1.7, w: 6, h: 0.5, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: '6FA0FF', charSpacing: 5 });
  s.addText('For Administrators', { x: MX, y: 2.2, w: 9, h: 1.0, margin: 0, fontFace: FONT, fontSize: 46, bold: true, color: WHITE });
  s.addText('Everything you run: analytics, content, access — from any browser.', { x: MX, y: 3.35, w: 9.5, h: 0.5, margin: 0, fontFace: FONT, fontSize: 18, color: 'CFDBF2' });

  const steps = ['Monitor & export', 'Manage content', 'Share the QR', 'Manage the keys', 'Support the counter'];
  steps.forEach((t, i) => {
    const x = MX + i * 2.42;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.5, w: 2.25, h: 0.95, rectRadius: 0.12, fill: { color: '17305A' }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + 0.18, y: 4.62, w: 0.7, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: BLUE, align: 'left' });
    s.addText(t, { x: x + 0.18, y: 4.6, w: 1.95, h: 0.75, margin: 0, fontFace: FONT, fontSize: 10.5, bold: true, color: 'E7EEFB', align: 'right', valign: 'middle' });
  });
  footer(s, true);
})();

// =============================================================================
// SLIDE 5 — Admin: Overview & CSV export
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 1, MX, 0.6, BLUE);
  title(s, 'Monitor & export in real time', INK, MX + 0.85, 0.62, 9);
  s.addText('Administrators  ·  the Overview tab', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  bullets(s, [
    { text: 'Counters', bold: true },
    'Issued today, redeemed today, registered media, café meals.',
    { text: 'Charts & live feed', bold: true },
    'Breakdown by meal and venue; vouchers appear as they’re claimed or scanned (auto-refresh every 5 s).',
    { text: 'Export to CSV', bold: true },
    'One click downloads the full voucher log — use it for catering reconciliation and backups.',
  ], MX, 2.05, 4.7, 3.6, { fontSize: 13, gap: 6 });

  const bx = 5.7, bw = CW - (bx - MX);
  const r = browser(s, bx, 1.95, bw, 3.9, HOST + '/admin');
  const mcw = (r.w - 0.6) / 2;
  [['142', 'Issued today', BLUE], ['96', 'Redeemed today', GREEN]].forEach((m, i) => {
    const mx = r.x + 0.2 + i * (mcw + 0.2);
    card(s, mx, r.y + 0.15, mcw, 0.85, { shadow: false, fill: PANEL, lineColor: LINE });
    s.addText(m[0], { x: mx + 0.2, y: r.y + 0.2, w: mcw - 0.4, h: 0.55, margin: 0, fontFace: FONT, fontSize: 30, bold: true, color: m[2], valign: 'middle' });
    s.addText(m[1], { x: mx + 0.2, y: r.y + 0.62, w: mcw - 0.4, h: 0.25, margin: 0, fontFace: FONT, fontSize: 10, color: MUTED });
  });
  s.addChart(pres.charts.BAR, [{ name: 'Vouchers', labels: ['Lunch', 'Dinner', 'Stadium'], values: [78, 41, 23] }], {
    x: r.x + 0.15, y: r.y + 1.15, w: r.w - 0.3, h: r.h - 1.3, barDir: 'col',
    chartColors: [BLUE, NAVY, PURPLE], showValue: true, dataLabelColor: INK, dataLabelFontSize: 10,
    catAxisLabelColor: MUTED, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    showLegend: false, showTitle: true, title: 'Vouchers by meal type', titleColor: INK, titleFontSize: 12, barGapWidthPct: 60,
  });
  footer(s);
})();

// =============================================================================
// SLIDE 6 — Admin: Content managers
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 2, MX, 0.6, BLUE);
  title(s, 'Manage every piece of content', INK, MX + 0.85, 0.62, 11);
  s.addText('Administrators  ·  Venues · News · Press · Transport · Design', { x: MX + 0.85, y: 1.28, w: 10, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  const mgrs = [
    { h: 'Venues', d: 'Add/edit/delete venues. The type sets meal rules: MMC = Lunch + Dinner; Stadium = 1 café meal; Training Site = no meals.', c: PURPLE, cs: PURPLE_SOFT },
    { h: 'Transport', d: 'Shuttle routes, times and frequencies — MMC ⇄ stadiums and training sites.', c: GREEN, cs: GREEN_SOFT },
    { h: 'News & Categories', d: 'Alerts and updates with categories (Alert, Transport, Catering…) and a “pin to top”.', c: AMBER, cs: AMBER_SOFT },
    { h: 'Press', d: 'Conferences with date, time, room and a live status badge (Scheduled / Live / Delayed / Concluded).', c: BLUE, cs: BLUE_SOFT },
  ];
  const cw = (CW - 0.3) / 2, ch = 1.45;
  mgrs.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * (cw + 0.3), y = 2.05 + row * (ch + 0.3);
    card(s, x, y, cw, ch, { lineColor: m.cs });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.22, w: 0.38, h: 0.38, fill: { color: m.c }, line: { type: 'none' } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.37, y: y + 0.34, w: 0.14, h: 0.14, fill: { color: WHITE }, line: { type: 'none' } });
    s.addText(m.h, { x: x + 0.78, y: y + 0.2, w: cw - 1.0, h: 0.4, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: INK, valign: 'middle' });
    s.addText(m.d, { x: x + 0.3, y: y + 0.68, w: cw - 0.6, h: 0.7, margin: 0, fontFace: FONT, fontSize: 12, color: MUTED, valign: 'top' });
  });

  card(s, MX, 2.05 + 2 * (ch + 0.3) - 0.02, CW, 0.62, { fill: PANEL, shadow: false });
  s.addText([
    { text: 'Saved to the cloud. ', options: { bold: true, color: INK, fontSize: 13 } },
    { text: 'Every phone sees changes on its next refresh. The Design tab also lets you adjust event branding & theme.', options: { color: MUTED, fontSize: 13 } },
  ], { x: MX + 0.35, y: 2.05 + 2 * (ch + 0.3) - 0.02, w: CW - 0.7, h: 0.62, margin: 0, fontFace: FONT, valign: 'middle' });
  footer(s);
})();

// =============================================================================
// SLIDE 7 — Admin: Share QR + manage keys
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 3, MX, 0.6, BLUE);
  title(s, 'Open the doors: QR & keys', INK, MX + 0.85, 0.62, 9);
  s.addText('Administrators  ·  onboarding media and volunteers', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Share the client app with media', d: 'Print the poster at  ' + HOST + '/share  (or Admin → Overview → Share QR).' },
    { h: 'Hand volunteers the volunteer key', d: 'One shared key for counter staff — it can only redeem vouchers.' },
    { h: 'Keep the admin key close', d: 'Only organizers get it. It unlocks everything, including exports and content.' },
    { h: 'Rotate keys if they leak', d: 'Change ADMIN_KEY / VOLUNTEER_KEY in the host’s Environment settings; old keys stop working on restart.' },
  ], MX, 2.05, 7.2, { color: BLUE, rowH: 1.02 });

  const px = 8.6, pw = CW - (px - MX), py = 2.0, ph = 3.6;
  card(s, px, py, pw, ph);
  s.addText('Scan to open', { x: px, y: py + 0.25, w: pw, h: 0.4, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: INK, align: 'center' });
  s.addText('the Media Hub client app', { x: px, y: py + 0.6, w: pw, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: MUTED, align: 'center' });
  drawQR(s, px + pw / 2 - 0.9, py + 1.05, 1.8, NAVY);
  pill(s, HOST, px + 0.25, py + ph - 0.6, pw - 0.5, 0.42, NAVY, WHITE, 10.5);
  footer(s);
})();

// =============================================================================
// SLIDE 8 — Admin: tips & troubleshooting
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'Good to know', BLUE);
  title(s, 'Tips & troubleshooting');

  const tips = [
    { h: 'First hit may be slow', d: 'The free tier sleeps when idle; the first request wakes it in ~50 seconds.' },
    { h: 'Back up regularly', d: 'Export to CSV gives you a full record of all vouchers.' },
    { h: 'Data survives restarts', d: 'Everything is stored in the cloud database, not on the device.' },
    { h: 'Daily reset', d: 'Voucher limits reset at the event’s local midnight (Asia/Riyadh).' },
    { h: 'Limits are server-side', d: 'Incognito mode or clearing the cache cannot bypass daily allowances.' },
    { h: 'Volunteers are contained', d: 'A volunteer key is rejected on every admin endpoint except redemption.' },
  ];
  const cw = (CW - 0.6) / 3, ch = 1.7, gx = 0.3, gy = 0.35;
  tips.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = MX + col * (cw + gx), y = 2.15 + row * (ch + gy);
    card(s, x, y, cw, ch);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.28, w: 0.34, h: 0.34, fill: { color: BLUE_SOFT }, line: { type: 'none' } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.35, y: y + 0.38, w: 0.14, h: 0.14, fill: { color: BLUE }, line: { type: 'none' } });
    s.addText(t.h, { x: x + 0.72, y: y + 0.24, w: cw - 0.9, h: 0.4, margin: 0, fontFace: FONT, fontSize: 14, bold: true, color: INK, valign: 'middle' });
    s.addText(t.d, { x: x + 0.28, y: y + 0.78, w: cw - 0.55, h: 0.8, margin: 0, fontFace: FONT, fontSize: 12, color: MUTED, valign: 'top' });
  });
  footer(s);
})();

// =============================================================================
// SLIDE 9 — Section: Volunteers
// =============================================================================
(() => {
  const s = slideDark();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.22, h: H, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('PART 2', { x: MX, y: 1.7, w: 6, h: 0.5, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: '6BE0AE', charSpacing: 5 });
  s.addText('For Volunteers', { x: MX, y: 2.2, w: 9, h: 1.0, margin: 0, fontFace: FONT, fontSize: 46, bold: true, color: WHITE });
  s.addText('You run the buffet counter — scan, redeem, keep the queue moving.', { x: MX, y: 3.35, w: 9.5, h: 0.5, margin: 0, fontFace: FONT, fontSize: 18, color: 'CFE8DC' });

  const steps = ['Open the login', 'Enter your key', 'Scan or type', 'Read the result', 'Lock when done'];
  steps.forEach((t, i) => {
    const x = MX + i * 2.42;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.5, w: 2.25, h: 0.95, rectRadius: 0.12, fill: { color: '143E30' }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + 0.18, y: 4.62, w: 0.7, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: GREEN, align: 'left' });
    s.addText(t, { x: x + 0.18, y: 4.6, w: 1.95, h: 0.75, margin: 0, fontFace: FONT, fontSize: 10.5, bold: true, color: 'DFF3EA', align: 'right', valign: 'middle' });
  });
  footer(s, true);
})();

// =============================================================================
// SLIDE 10 — Volunteer: sign in
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 1, MX, 0.6, GREEN);
  title(s, 'Sign in with your volunteer key', INK, MX + 0.85, 0.62, 10);
  s.addText('Volunteers  ·  any phone or tablet works', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Open the staff login', d: HOST + '/admin  — on the counter tablet or your own phone.' },
    { h: 'Enter the volunteer key', d: 'Your shift lead gives it to you. Don’t share it outside the team.' },
    { h: 'You land in the Redeemer', d: 'It’s the only tab you’ll see — that’s expected.' },
  ], MX, 2.1, 6.0, { color: GREEN, rowH: 1.05 });

  // browser mock: only Redeemer tab
  const bx = 7.0, bw = CW - (bx - MX);
  const r = browser(s, bx, 2.0, bw, 3.6, HOST + '/admin');
  tabStrip(s, r, ['Redeemer'], 'Redeemer', GREEN);
  s.addText('Redeem a voucher', { x: r.x + 0.25, y: r.y + 0.7, w: r.w - 0.5, h: 0.35, margin: 0, fontFace: FONT, fontSize: 14, bold: true, color: INK });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r.x + 0.25, y: r.y + 1.15, w: r.w - 0.5, h: 1.1, rectRadius: 0.1, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
  s.addText('📷  Point the camera at the QR code', { x: r.x + 0.45, y: r.y + 1.15, w: r.w - 0.9, h: 1.1, margin: 0, fontFace: FONT, fontSize: 12, color: MUTED, align: 'center', valign: 'middle' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r.x + 0.25, y: r.y + 2.4, w: r.w - 1.6, h: 0.42, rectRadius: 0.08, fill: { color: WHITE }, line: { color: LINE, width: 1 } });
  s.addText('MV-3LWU13', { x: r.x + 0.4, y: r.y + 2.4, w: r.w - 1.9, h: 0.42, margin: 0, fontFace: MONO, fontSize: 11, color: INK, valign: 'middle' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r.x + r.w - 1.25, y: r.y + 2.4, w: 1.0, h: 0.42, rectRadius: 0.08, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('Redeem', { x: r.x + r.w - 1.25, y: r.y + 2.4, w: 1.0, h: 0.42, margin: 0, fontFace: FONT, fontSize: 11, bold: true, color: WHITE, align: 'center', valign: 'middle' });

  pill(s, 'Seeing only one tab is by design — your key is scoped to redemption', MX, 5.6, 6.4, 0.5, GREEN_SOFT, GREEN, 11.5);
  footer(s);
})();

// =============================================================================
// SLIDE 11 — Volunteer: redeem flow
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 2, MX, 0.6, GREEN);
  title(s, 'Redeem a voucher in seconds', INK, MX + 0.85, 0.62, 10);
  s.addText('Volunteers  ·  the Redeemer tab', { x: MX + 0.85, y: 1.28, w: 10, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Ask for the voucher QR', d: 'The guest opens it in the Media Hub app on their phone.' },
    { h: 'Scan it — or type the ID', d: 'Use the device camera; if it won’t scan, type the code under the QR (e.g. MV-3LWU13).' },
    { h: 'Serve on green', d: 'Green “MEAL VALID” → hand over the meal. The guest’s badge flips to Redeemed instantly.' },
  ], MX, 2.05, 6.0, { color: GREEN, rowH: 1.0 });

  const rx = 7.1, rw = CW - (rx - MX);
  card(s, rx, 2.0, rw, 1.55, { fill: GREEN_SOFT, lineColor: 'BCE6CC' });
  s.addShape(pres.shapes.OVAL, { x: rx + 0.3, y: 2.45, w: 0.65, h: 0.65, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('✓', { x: rx + 0.3, y: 2.43, w: 0.65, h: 0.65, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: WHITE, align: 'center', valign: 'middle' });
  s.addText('SUCCESS — MEAL VALID', { x: rx + 1.1, y: 2.3, w: rw - 1.3, h: 0.4, margin: 0, fontFace: FONT, fontSize: 17, bold: true, color: '0C6E3A', valign: 'middle' });
  s.addText('Serve the meal — voucher is now marked Redeemed', { x: rx + 1.1, y: 2.78, w: rw - 1.3, h: 0.4, margin: 0, fontFace: FONT, fontSize: 12, color: '0C6E3A' });

  card(s, rx, 3.75, rw, 1.55, { fill: RED_SOFT, lineColor: 'F3C4C4' });
  s.addShape(pres.shapes.OVAL, { x: rx + 0.3, y: 4.2, w: 0.65, h: 0.65, fill: { color: RED }, line: { type: 'none' } });
  s.addText('!', { x: rx + 0.3, y: 4.18, w: 0.65, h: 0.65, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: WHITE, align: 'center', valign: 'middle' });
  s.addText('WARNING — ALREADY REDEEMED', { x: rx + 1.1, y: 4.05, w: rw - 1.3, h: 0.4, margin: 0, fontFace: FONT, fontSize: 15.5, bold: true, color: '9D1C1C', valign: 'middle' });
  s.addText('Politely decline — it shows when it was first used', { x: rx + 1.1, y: 4.53, w: rw - 1.3, h: 0.4, margin: 0, fontFace: FONT, fontSize: 12, color: '9D1C1C' });

  pill(s, 'Camera scanning works best on Android Chrome — typing the ID always works', MX, 5.45, 6.4, 0.5, GREEN_SOFT, GREEN, 10.5);
  footer(s);
})();

// =============================================================================
// SLIDE 12 — Volunteer: counter playbook
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 3, MX, 0.6, GREEN);
  title(s, 'Counter playbook — common situations', INK, MX + 0.85, 0.62, 11);
  s.addText('Volunteers  ·  what to do when…', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  const cases = [
    { h: 'QR won’t scan', d: 'Ask the guest to raise the screen brightness, or just type the Voucher ID printed under the QR.', c: BLUE, cs: BLUE_SOFT },
    { h: '“Already redeemed”', d: 'Someone used it earlier — the warning shows the original time. Politely decline; direct disputes to a supervisor.', c: RED, cs: RED_SOFT },
    { h: 'Guest closed the app', d: 'No problem: their vouchers are saved. In the Voucher tab, “Your vouchers — today” lists every QR until midnight.', c: GREEN, cs: GREEN_SOFT },
    { h: 'New phone / no voucher', d: 'They can re-open vouchers on any device by entering their email — or request one if they still have allowance.', c: PURPLE, cs: PURPLE_SOFT },
    { h: 'Voucher says Expired', d: 'Vouchers are valid only on the day they were issued. Yesterday’s voucher cannot be redeemed.', c: AMBER, cs: AMBER_SOFT },
    { h: 'Leaving the counter', d: 'Tap Lock to sign out, especially on a shared tablet. Sign back in with the same volunteer key.', c: NAVY, cs: BLUE_SOFT },
  ];
  const cw = (CW - 0.6) / 3, ch = 1.85, gx = 0.3, gy = 0.3;
  cases.forEach((t, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = MX + col * (cw + gx), y = 2.05 + row * (ch + gy);
    card(s, x, y, cw, ch, { lineColor: t.cs });
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.24, w: 0.36, h: 0.36, fill: { color: t.c }, line: { type: 'none' } });
    s.addShape(pres.shapes.OVAL, { x: x + 0.36, y: y + 0.35, w: 0.14, h: 0.14, fill: { color: WHITE }, line: { type: 'none' } });
    s.addText(t.h, { x: x + 0.74, y: y + 0.2, w: cw - 0.95, h: 0.45, margin: 0, fontFace: FONT, fontSize: 13.5, bold: true, color: INK, valign: 'middle' });
    s.addText(t.d, { x: x + 0.28, y: y + 0.72, w: cw - 0.55, h: 1.0, margin: 0, fontFace: FONT, fontSize: 11, color: MUTED, valign: 'top' });
  });
  footer(s);
})();

// =============================================================================
// SLIDE 13 — Quick reference + closing
// =============================================================================
(() => {
  const s = slideDark();
  s.addText('QUICK REFERENCE', { x: MX, y: 0.7, w: CW, h: 0.4, margin: 0, fontFace: FONT, fontSize: 13, bold: true, color: '6FA0FF', charSpacing: 4 });
  s.addText('Keep this handy', { x: MX, y: 1.1, w: CW, h: 0.8, margin: 0, fontFace: FONT, fontSize: 32, bold: true, color: WHITE });

  const cy = 2.3, ch = 3.0, cw = 5.85, gap = CW - cw * 2;
  // Admin
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: cy, w: cw, h: ch, rectRadius: 0.14, fill: { color: '17305A' }, line: { type: 'none' } });
  pill(s, 'Administrators', MX + 0.3, cy + 0.28, 2.3, 0.45, BLUE, WHITE, 12);
  s.addText([
    { text: 'Login:    ', options: { color: DARKMUTED } }, { text: HOST + '/admin\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Key:      ', options: { color: DARKMUTED } }, { text: 'your private ADMIN key\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Export:   ', options: { color: DARKMUTED } }, { text: 'Overview → Export CSV\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Share:    ', options: { color: DARKMUTED } }, { text: HOST + '/share', options: { color: WHITE, bold: true } },
  ], { x: MX + 0.4, y: cy + 1.0, w: cw - 0.8, h: 1.9, margin: 0, fontFace: MONO, fontSize: 12, valign: 'top', lineSpacingMultiple: 1.3 });

  // Volunteer
  const ax = MX + cw + gap;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ax, y: cy, w: cw, h: ch, rectRadius: 0.14, fill: { color: '143E30' }, line: { type: 'none' } });
  pill(s, 'Volunteers', ax + 0.3, cy + 0.28, 2.0, 0.45, GREEN, WHITE, 12);
  s.addText([
    { text: 'Login:  ', options: { color: 'A9CFBF' } }, { text: HOST + '/admin\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Key:    ', options: { color: 'A9CFBF' } }, { text: 'the shared VOLUNTEER key\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Green:  ', options: { color: 'A9CFBF' } }, { text: 'MEAL VALID → serve\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Red:    ', options: { color: 'A9CFBF' } }, { text: 'already used → decline politely', options: { color: WHITE, bold: true } },
  ], { x: ax + 0.4, y: cy + 1.0, w: cw - 0.8, h: 1.9, margin: 0, fontFace: MONO, fontSize: 11.5, valign: 'top', lineSpacingMultiple: 1.3 });

  s.addText('You’re ready — thank you for feeding the world’s media.', { x: MX, y: cy + ch + 0.35, w: CW, h: 0.5, margin: 0, fontFace: FONT, fontSize: 17, bold: true, italic: true, color: WHITE, align: 'center' });
  footer(s, true);
})();

// ---- write -----------------------------------------------------------------
const out = path.join(__dirname, '..', 'AFC2027 Media Hub - Admin & Volunteer Onboarding.pptx');
pres.writeFile({ fileName: out }).then((f) => console.log('WROTE', f)).catch((e) => { console.error(e); process.exit(1); });
