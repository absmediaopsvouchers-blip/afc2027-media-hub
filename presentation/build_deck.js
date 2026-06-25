'use strict';

/* Generates the AFC Asian Cup 2027 Media Hub onboarding deck (cloud edition).
   Run with:  node presentation/build_deck.js   (uses pptxgenjs in presentation/) */

const path = require('path');
const pptxgen = require(path.join(__dirname, 'node_modules', 'pptxgenjs'));

// ---- palette ---------------------------------------------------------------
const NAVY = '12274A';
const NAVY2 = '1E3A6B';
const BLUE = '2F6BFF';        // Admin accent
const BLUE_SOFT = 'E8F0FF';
const GREEN = '0E9F6E';       // Client accent
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
const URL_CLIENT = 'https://' + HOST;
const URL_ADMIN = 'https://' + HOST + '/admin';

// ---- geometry --------------------------------------------------------------
const W = 13.333, H = 7.5;
const MX = 0.62;
const CW = W - 2 * MX;

const pres = new pptxgen();
pres.defineLayout({ name: 'WIDE', width: W, height: H });
pres.layout = 'WIDE';
pres.author = 'AFC Asian Cup 2027 Media Operations';
pres.title = 'Media Hub — Setup & Onboarding Guide';

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
  s.addText('AFC Asian Cup 2027  ·  Media Hub', {
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
  const runs = items.map((it, i) => {
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

// numbered list (no bullet glyph, big colored numbers)
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
  const fp = inner * 0.28; // finder size
  const finders = [[ox, oy], [ox + inner - fp, oy], [ox, oy + inner - fp]];
  finders.forEach(([fx, fy]) => {
    s.addShape(pres.shapes.RECTANGLE, { x: fx, y: fy, w: fp, h: fp, fill: { color: dark }, line: { type: 'none' } });
    s.addShape(pres.shapes.RECTANGLE, { x: fx + fp * 0.22, y: fy + fp * 0.22, w: fp * 0.56, h: fp * 0.56, fill: { color: WHITE }, line: { type: 'none' } });
    s.addShape(pres.shapes.RECTANGLE, { x: fx + fp * 0.36, y: fy + fp * 0.36, w: fp * 0.28, h: fp * 0.28, fill: { color: dark }, line: { type: 'none' } });
  });
  // deterministic module sprinkle
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

// phone frame; returns inner screen rect for caller to fill
function phone(s, x, y, w, h) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.22, fill: { color: '0B1A33' }, line: { type: 'none' }, shadow: shadow() });
  const m = 0.1;
  const sx = x + m, sy = y + m, sw = w - 2 * m, sh = h - 2 * m;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: sx, y: sy, w: sw, h: sh, rectRadius: 0.16, fill: { color: WHITE }, line: { type: 'none' } });
  return { x: sx, y: sy, w: sw, h: sh };
}

// app-bar inside a screen rect (rounded-safe: inset slightly)
function screenBar(s, r, label, color = NAVY) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r.x + 0.06, y: r.y + 0.06, w: r.w - 0.12, h: 0.5, rectRadius: 0.1, fill: { color }, line: { type: 'none' } });
  s.addText(label, { x: r.x + 0.2, y: r.y + 0.06, w: r.w - 0.4, h: 0.5, margin: 0, fontFace: FONT, fontSize: 11, bold: true, color: WHITE, align: 'left', valign: 'middle' });
}

function bottomNav(s, r, activeIdx) {
  const labels = ['Voucher', 'Press', 'News', 'Transport'];
  const navY = r.y + r.h - 0.5;
  s.addShape(pres.shapes.RECTANGLE, { x: r.x + 0.06, y: navY, w: r.w - 0.12, h: 0.42, fill: { color: PANEL }, line: { type: 'none' } });
  const cw = (r.w - 0.12) / 4;
  labels.forEach((l, i) => {
    const active = i === activeIdx;
    s.addShape(pres.shapes.OVAL, { x: r.x + 0.06 + i * cw + cw / 2 - 0.05, y: navY + 0.07, w: 0.1, h: 0.1, fill: { color: active ? BLUE : FAINT }, line: { type: 'none' } });
    s.addText(l, { x: r.x + 0.06 + i * cw, y: navY + 0.18, w: cw, h: 0.22, margin: 0, fontFace: FONT, fontSize: 6.5, bold: active, color: active ? BLUE : MUTED, align: 'center', valign: 'middle' });
  });
}

function lineRow(s, x, y, w, h, color = PANEL) {
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color }, line: { type: 'none' } });
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

// =============================================================================
// SLIDE 1 — Title
// =============================================================================
(() => {
  const s = slideDark();
  s.addShape(pres.shapes.OVAL, { x: 10.4, y: -1.4, w: 4.6, h: 4.6, fill: { color: NAVY2 }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: 11.7, y: 4.6, w: 3.4, h: 3.4, fill: { color: '16305C' }, line: { type: 'none' } });

  // app icon tile
  const ix = 9.7, iy = 2.1, isz = 1.9;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ix, y: iy, w: isz, h: isz, rectRadius: 0.42, fill: { color: BLUE }, line: { type: 'none' }, shadow: shadow() });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ix + 0.4, y: iy + 0.72, w: isz - 0.8, h: 0.52, rectRadius: 0.1, fill: { color: WHITE }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: ix + 0.4 + (isz - 0.8) / 2 - 0.12, y: iy + 0.72 - 0.12, w: 0.24, h: 0.24, fill: { color: BLUE }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: ix + 0.4 + (isz - 0.8) / 2 - 0.12, y: iy + 0.72 + 0.52 - 0.12, w: 0.24, h: 0.24, fill: { color: BLUE }, line: { type: 'none' } });

  s.addText('SETUP & ONBOARDING GUIDE', { x: MX, y: 1.45, w: 8.5, h: 0.4, margin: 0, fontFace: FONT, fontSize: 14, bold: true, color: '6FA0FF', charSpacing: 4 });
  s.addText('Media Hub', { x: MX, y: 1.95, w: 8.6, h: 1.3, margin: 0, fontFace: FONT, fontSize: 64, bold: true, color: WHITE });
  s.addText('Meal Vouchers & Media Information — AFC Asian Cup 2027', { x: MX, y: 3.3, w: 8.6, h: 0.6, margin: 0, fontFace: FONT, fontSize: 19, color: 'CFDBF2' });

  pill(s, 'For Administrators', MX, 4.3, 2.5, 0.5, BLUE, WHITE, 12.5);
  pill(s, 'For Media Clients', MX + 2.7, 4.3, 2.4, 0.5, GREEN, WHITE, 12.5);

  // live URL strip
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: 5.15, w: 7.4, h: 0.62, rectRadius: 0.12, fill: { color: '17305A' }, line: { type: 'none' } });
  s.addText([
    { text: 'LIVE  ', options: { color: '6BE0AE', bold: true, fontSize: 12 } },
    { text: URL_CLIENT, options: { color: WHITE, bold: true, fontSize: 13.5, fontFace: MONO } },
  ], { x: MX + 0.25, y: 5.15, w: 7.0, h: 0.62, margin: 0, fontFace: FONT, valign: 'middle', align: 'left' });

  s.addText('Hosted in the cloud — open it from any phone, on Wi-Fi or mobile data.', { x: MX, y: 5.95, w: 8.6, h: 0.5, margin: 0, fontFace: FONT, fontSize: 13.5, italic: true, color: DARKMUTED });
  footer(s, true);
})();

// =============================================================================
// SLIDE 2 — Overview: two apps, one cloud address
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'Overview', BLUE);
  title(s, 'Two apps, one cloud address');

  const cy = 2.0, ch = 2.7, cw = 5.85, gap = CW - cw * 2;
  // Client card
  card(s, MX, cy, cw, ch, { lineColor: GREEN_SOFT });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: cy, w: cw, h: 0.85, rectRadius: 0.12, fill: { color: GREEN }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: MX, y: cy + 0.43, w: cw, h: 0.42, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('Client App', { x: MX + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 20, bold: true, color: WHITE, valign: 'middle' });
  s.addText('on every phone', { x: MX + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 12, color: 'D8F3E6', align: 'right', valign: 'middle' });
  bullets(s, [
    'For accredited media members.',
    'Request meal vouchers — get a QR ticket.',
    'Vouchers stay available all day.',
    'Press, news & shuttle info.',
  ], MX + 0.35, cy + 1.0, cw - 0.7, 1.5, { fontSize: 13, gap: 6 });
  s.addText(HOST, { x: MX + 0.35, y: cy + ch - 0.45, w: cw - 0.7, h: 0.34, margin: 0, fontFace: MONO, fontSize: 12, color: GREEN, bold: true });

  // Admin card
  const ax = MX + cw + gap;
  card(s, ax, cy, cw, ch, { lineColor: BLUE_SOFT });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ax, y: cy, w: cw, h: 0.85, rectRadius: 0.12, fill: { color: NAVY }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: ax, y: cy + 0.43, w: cw, h: 0.42, fill: { color: NAVY }, line: { type: 'none' } });
  s.addText('Admin & Catering', { x: ax + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 20, bold: true, color: WHITE, valign: 'middle' });
  s.addText('organizers + counter staff', { x: ax + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 12, color: 'BFD2F6', align: 'right', valign: 'middle' });
  bullets(s, [
    'Live analytics + CSV export.',
    'Scan & redeem vouchers at the counter.',
    'Manage venues, news, press & transport.',
  ], ax + 0.35, cy + 1.0, cw - 0.7, 1.5, { fontSize: 13, gap: 6 });
  s.addText(HOST + '/admin', { x: ax + 0.35, y: cy + ch - 0.45, w: cw - 0.7, h: 0.34, margin: 0, fontFace: MONO, fontSize: 12, color: BLUE, bold: true });

  // benefit strip
  const by = cy + ch + 0.35;
  card(s, MX, by, CW, 0.95, { fill: AMBER_SOFT, lineColor: 'F1DCB0', shadow: false });
  s.addText([
    { text: 'Why a central server?  ', options: { bold: true, color: AMBER, fontSize: 14 } },
    { text: 'Every voucher is recorded in a cloud database — daily limits apply to everyone and can’t be bypassed with incognito mode or by clearing the cache. Data survives restarts.', options: { color: '7A4E08', fontSize: 13 } },
  ], { x: MX + 0.35, y: by, w: CW - 0.7, h: 0.95, margin: 0, fontFace: FONT, valign: 'middle', align: 'left' });
  footer(s);
})();

// =============================================================================
// SLIDE 3 — How it works (cloud)
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'How it works', BLUE);
  title(s, 'In the cloud — reachable anywhere');

  const cy = 2.4, ch = 2.7, cw = 3.5;
  const xs = [MX, MX + (CW - cw) / 2, MX + CW - cw];
  const nodes = [
    { t: 'Cloud server', d: 'Runs the app + a PostgreSQL database. Always on, no laptop needed.', c: NAVY, sub: 'Render + Postgres' },
    { t: 'The internet', d: 'Reachable over mobile data (4G/5G) or any Wi-Fi, worldwide.', c: BLUE, sub: 'one public URL' },
    { t: 'Any phone', d: 'Open the link or scan the QR — then add to home screen.', c: GREEN, sub: HOST },
  ];
  nodes.forEach((n, i) => {
    const x = xs[i];
    card(s, x, cy, cw, ch);
    s.addShape(pres.shapes.OVAL, { x: x + cw / 2 - 0.45, y: cy + 0.35, w: 0.9, h: 0.9, fill: { color: n.c }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + cw / 2 - 0.45, y: cy + 0.35, w: 0.9, h: 0.9, margin: 0, fontFace: FONT, fontSize: 30, bold: true, color: WHITE, align: 'center', valign: 'middle' });
    s.addText(n.t, { x: x + 0.2, y: cy + 1.35, w: cw - 0.4, h: 0.4, margin: 0, fontFace: FONT, fontSize: 17, bold: true, color: INK, align: 'center' });
    s.addText(n.d, { x: x + 0.25, y: cy + 1.75, w: cw - 0.5, h: 0.55, margin: 0, fontFace: FONT, fontSize: 12.5, color: MUTED, align: 'center', valign: 'top' });
    s.addText(n.sub, { x: x + 0.15, y: cy + 2.34, w: cw - 0.3, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: n.c, align: 'center', bold: true });
  });
  [[xs[0] + cw, xs[1]], [xs[1] + cw, xs[2]]].forEach(([x1, x2]) => {
    s.addShape(pres.shapes.LINE, { x: x1 + 0.08, y: cy + ch / 2, w: x2 - x1 - 0.16, h: 0, line: { color: FAINT, width: 2, endArrowType: 'triangle' } });
  });

  s.addText('The cloud is the single source of truth — limits are checked there, for every request, from any device, anywhere.', { x: MX, y: cy + ch + 0.5, w: CW, h: 0.5, margin: 0, fontFace: FONT, fontSize: 13.5, italic: true, color: MUTED, align: 'center' });
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
  s.addText('Run the system from any browser — organizers and catering staff.', { x: MX, y: 3.35, w: 9.5, h: 0.5, margin: 0, fontFace: FONT, fontSize: 18, color: 'CFDBF2' });

  const steps = ['Open the dashboard', 'Analytics & export', 'Redeem at counter', 'Manage content', 'Share the QR'];
  steps.forEach((t, i) => {
    const x = MX + i * 2.42;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.5, w: 2.25, h: 0.95, rectRadius: 0.12, fill: { color: '17305A' }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + 0.18, y: 4.62, w: 0.7, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: BLUE, align: 'left' });
    s.addText(t, { x: x + 0.18, y: 4.6, w: 1.95, h: 0.75, margin: 0, fontFace: FONT, fontSize: 10.5, bold: true, color: 'E7EEFB', align: 'right', valign: 'middle' });
  });
  footer(s, true);
})();

// =============================================================================
// SLIDE 5 — Admin Step 1: Open the dashboard
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 1, MX, 0.6, BLUE);
  title(s, 'Open the Admin Dashboard', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 1 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Go to the admin URL', d: 'On any phone or laptop, open  ' + HOST + '/admin' },
    { h: 'Enter your admin key', d: 'The private key set when the app was deployed.' },
    { h: 'You’re in', d: 'The key is remembered for the browser session. Tap Lock to sign out.' },
  ], MX, 2.05, 6.0, { color: BLUE, rowH: 1.05 });

  pill(s, 'Works from anywhere — no venue Wi-Fi required', MX, 5.35, 5.7, 0.5, BLUE_SOFT, BLUE, 11.5);

  // login mock in browser
  const bx = 7.0, bw = CW - (bx - MX);
  const r = browser(s, bx, 2.0, bw, 3.4, HOST + '/admin');
  const fx = r.x + (r.w - 3.0) / 2;
  s.addShape(pres.shapes.OVAL, { x: fx + 1.25, y: r.y + 0.3, w: 0.6, h: 0.6, fill: { color: NAVY }, line: { type: 'none' } });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx + 1.45, y: r.y + 0.5, w: 0.2, h: 0.18, rectRadius: 0.03, fill: { color: WHITE }, line: { type: 'none' } });
  s.addText('Admin access', { x: r.x, y: r.y + 1.0, w: r.w, h: 0.35, margin: 0, fontFace: FONT, fontSize: 15, bold: true, color: INK, align: 'center' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx, y: r.y + 1.5, w: 3.0, h: 0.45, rectRadius: 0.08, fill: { color: PANEL }, line: { color: LINE, width: 1 } });
  s.addText('• • • • • • • • • •', { x: fx + 0.15, y: r.y + 1.5, w: 2.7, h: 0.45, margin: 0, fontFace: FONT, fontSize: 13, color: MUTED, valign: 'middle' });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx, y: r.y + 2.1, w: 3.0, h: 0.45, rectRadius: 0.08, fill: { color: BLUE }, line: { type: 'none' } });
  s.addText('Unlock dashboard', { x: fx, y: r.y + 2.1, w: 3.0, h: 0.45, margin: 0, fontFace: FONT, fontSize: 12.5, bold: true, color: WHITE, align: 'center', valign: 'middle' });
  footer(s);
})();

// =============================================================================
// SLIDE 6 — Admin Step 2: Analytics & CSV export
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 2, MX, 0.6, BLUE);
  title(s, 'Monitor & export in real time', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 2 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  bullets(s, [
    { text: 'Counters', bold: true },
    'Issued today, redeemed today, registered media, café meals.',
    { text: 'Charts & live feed', bold: true },
    'Breakdown by meal/venue; vouchers as they’re claimed or scanned (auto-refresh 5s).',
    { text: 'Export to CSV', bold: true },
    'Download the full voucher log for catering reconciliation.',
  ], MX, 2.05, 4.7, 3.2, { fontSize: 13, gap: 6 });

  const bx = 5.7, bw = CW - (bx - MX);
  const r = browser(s, bx, 1.95, bw, 3.6, HOST + '/admin');
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
// SLIDE 7 — Admin Step 3: Catering Redeemer
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 3, MX, 0.6, BLUE);
  title(s, 'Redeem vouchers at the counter', INK, MX + 0.85, 0.62, 10);
  s.addText('Step 3 of 5  ·  Administrators  ·  the Redeemer tab', { x: MX + 0.85, y: 1.28, w: 10, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Open the Redeemer tab', d: 'Designed for catering staff at the buffet.' },
    { h: 'Scan the QR or type the ID', d: 'Use the device camera, or enter the Voucher ID by hand.' },
    { h: 'Read the result', d: 'Valid vouchers are marked Redeemed instantly.' },
  ], MX, 2.05, 6.0, { color: BLUE, rowH: 1.0 });

  // result cards (success + already redeemed)
  const rx = 7.1, rw = CW - (rx - MX);
  // success
  card(s, rx, 2.0, rw, 1.55, { fill: GREEN_SOFT, lineColor: 'BCE6CC' });
  s.addShape(pres.shapes.OVAL, { x: rx + 0.3, y: 2.45, w: 0.65, h: 0.65, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('✓', { x: rx + 0.3, y: 2.43, w: 0.65, h: 0.65, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: WHITE, align: 'center', valign: 'middle' });
  s.addText('SUCCESS — MEAL VALID', { x: rx + 1.1, y: 2.3, w: rw - 1.3, h: 0.4, margin: 0, fontFace: FONT, fontSize: 17, bold: true, color: '0C6E3A', valign: 'middle' });
  s.addText('Marked Redeemed · MMC · Lunch', { x: rx + 1.1, y: 2.78, w: rw - 1.3, h: 0.4, margin: 0, fontFace: FONT, fontSize: 12, color: '0C6E3A' });
  // already redeemed
  card(s, rx, 3.75, rw, 1.55, { fill: RED_SOFT, lineColor: 'F3C4C4' });
  s.addShape(pres.shapes.OVAL, { x: rx + 0.3, y: 4.2, w: 0.65, h: 0.65, fill: { color: RED }, line: { type: 'none' } });
  s.addText('!', { x: rx + 0.3, y: 4.18, w: 0.65, h: 0.65, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: WHITE, align: 'center', valign: 'middle' });
  s.addText('WARNING — ALREADY REDEEMED', { x: rx + 1.1, y: 4.05, w: rw - 1.3, h: 0.4, margin: 0, fontFace: FONT, fontSize: 15.5, bold: true, color: '9D1C1C', valign: 'middle' });
  s.addText('Shows the original redemption time', { x: rx + 1.1, y: 4.53, w: rw - 1.3, h: 0.4, margin: 0, fontFace: FONT, fontSize: 12, color: '9D1C1C' });

  pill(s, 'Camera scanning works great on Android Chrome — manual entry always available', MX, 5.45, 6.2, 0.5, BLUE_SOFT, BLUE, 10.5);
  footer(s);
})();

// =============================================================================
// SLIDE 8 — Admin Step 4: Manage all content
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 4, MX, 0.6, BLUE);
  title(s, 'Manage every piece of content', INK, MX + 0.85, 0.62, 11);
  s.addText('Step 4 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  const mgrs = [
    { h: 'Venue Manager', d: 'Add/edit/delete venues. Type sets the rules: MMC = Lunch + Dinner; Stadium = 1 café meal; Training = no meals.', c: PURPLE, cs: PURPLE_SOFT },
    { h: 'Transport Manager', d: 'Shuttle routes, times and frequencies — MMC ⇄ stadiums and training sites.', c: GREEN, cs: GREEN_SOFT },
    { h: 'News Manager', d: 'Alerts and updates with categories (Alert, Transport, Catering…) and a “pin to top”.', c: AMBER, cs: AMBER_SOFT },
    { h: 'Press Manager', d: 'Conferences with date, time, room and a live status badge.', c: BLUE, cs: BLUE_SOFT },
  ];
  const cw = (CW - 0.3) / 2, ch = 1.45;
  mgrs.forEach((m, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * (cw + 0.3), y = 2.05 + row * (ch + 0.3);
    card(s, x, y, cw, ch, { lineColor: m.cs });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 0.16, h: ch, rectRadius: 0.05, fill: { color: m.c }, line: { type: 'none' } });
    s.addText(m.h, { x: x + 0.4, y: y + 0.22, w: cw - 0.6, h: 0.4, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: INK, valign: 'middle' });
    s.addText(m.d, { x: x + 0.4, y: y + 0.68, w: cw - 0.65, h: 0.7, margin: 0, fontFace: FONT, fontSize: 12, color: MUTED, valign: 'top' });
  });

  card(s, MX, 2.05 + 2 * (ch + 0.3) - 0.02, CW, 0.62, { fill: PANEL, shadow: false });
  s.addText([
    { text: 'Saved to the cloud. ', options: { bold: true, color: INK, fontSize: 13 } },
    { text: 'Every phone sees the change on its next refresh — venue changes instantly update the client’s location list.', options: { color: MUTED, fontSize: 13 } },
  ], { x: MX + 0.35, y: 2.05 + 2 * (ch + 0.3) - 0.02, w: CW - 0.7, h: 0.62, margin: 0, fontFace: FONT, valign: 'middle' });
  footer(s);
})();

// =============================================================================
// SLIDE 9 — Admin Step 5: Share the QR
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 5, MX, 0.6, BLUE);
  title(s, 'Share access with a QR code', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 5 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Open the Share page', d: 'Visit  ' + HOST + '/share  (or Admin → Share QR).' },
    { h: 'Print or display it', d: 'A ready-to-print poster with the QR and the link.' },
    { h: 'Hand it to the media', d: 'Works on cellular and any Wi-Fi — anyone, anywhere.' },
  ], MX, 2.1, 6.4, { color: BLUE, rowH: 1.05 });

  const px = 8.4, pw = CW - (px - MX), py = 2.0, ph = 3.5;
  card(s, px, py, pw, ph);
  s.addText('Scan to open', { x: px, y: py + 0.25, w: pw, h: 0.4, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: INK, align: 'center' });
  s.addText('the Media Hub', { x: px, y: py + 0.6, w: pw, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: MUTED, align: 'center' });
  drawQR(s, px + pw / 2 - 0.9, py + 1.05, 1.8, NAVY);
  pill(s, HOST, px + 0.25, py + ph - 0.6, pw - 0.5, 0.42, NAVY, WHITE, 10.5);
  footer(s);
})();

// =============================================================================
// SLIDE 10 — Admin tips
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'Good to know', BLUE);
  title(s, 'Tips & troubleshooting');

  const tips = [
    { h: 'Change the admin key', d: 'Edit ADMIN_KEY in the host’s Environment settings.' },
    { h: 'First hit may be slow', d: 'Free tier sleeps when idle; it wakes in ~50 seconds.' },
    { h: 'Back up regularly', d: 'Use Export to CSV for a record of all vouchers.' },
    { h: 'Data is safe', d: 'Stored in PostgreSQL — survives restarts & redeploys.' },
    { h: 'Updates auto-deploy', d: 'Pushing to the GitHub repo redeploys the site.' },
    { h: 'Correct daily reset', d: 'Limits reset at the event’s local midnight (timezone-aware).' },
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
// SLIDE 11 — Section: Clients
// =============================================================================
(() => {
  const s = slideDark();
  s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.22, h: H, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('PART 2', { x: MX, y: 1.7, w: 6, h: 0.5, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: '6BE0AE', charSpacing: 5 });
  s.addText('For Media Clients', { x: MX, y: 2.2, w: 9, h: 1.0, margin: 0, fontFace: FONT, fontSize: 46, bold: true, color: WHITE });
  s.addText('Get it on your phone in under a minute — from anywhere.', { x: MX, y: 3.35, w: 9.5, h: 0.5, margin: 0, fontFace: FONT, fontSize: 18, color: 'CFE8DC' });

  const steps = ['Open the link', 'Add to Home Screen', 'Request a voucher', 'Find it anytime', 'Explore the hub'];
  steps.forEach((t, i) => {
    const x = MX + i * 2.42;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.5, w: 2.25, h: 0.95, rectRadius: 0.12, fill: { color: '143E30' }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + 0.18, y: 4.62, w: 0.7, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: GREEN, align: 'left' });
    s.addText(t, { x: x + 0.18, y: 4.6, w: 1.95, h: 0.75, margin: 0, fontFace: FONT, fontSize: 10.5, bold: true, color: 'DFF3EA', align: 'right', valign: 'middle' });
  });
  footer(s, true);
})();

// =============================================================================
// SLIDE 12 — Client Step 1: Open the link
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 1, MX, 0.6, GREEN);
  title(s, 'Open the Media Hub', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 1 of 5  ·  Media Clients', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Scan the QR code', d: 'Point your phone camera at the media-desk poster — tap the link.' },
    { h: 'Or type the address', d: HOST },
    { h: 'Any network works', d: 'Mobile data (4G/5G) or any Wi-Fi — no special network needed.' },
  ], MX, 2.1, 6.4, { color: GREEN, rowH: 1.05 });

  const px = 8.5, pw = CW - (px - MX);
  card(s, px, 2.0, pw, 3.5);
  s.addText('Scan to open', { x: px, y: 2.25, w: pw, h: 0.35, margin: 0, fontFace: FONT, fontSize: 15, bold: true, color: INK, align: 'center' });
  drawQR(s, px + pw / 2 - 0.85, 2.75, 1.7, GREEN);
  pill(s, HOST, px + 0.25, 4.75, pw - 0.5, 0.42, GREEN, WHITE, 10.5);
  footer(s);
})();

// =============================================================================
// SLIDE 13 — Client Step 2: Add to Home Screen
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 2, MX, 0.6, GREEN);
  title(s, 'Add it to your home screen', INK, MX + 0.85, 0.62, 10);
  s.addText('Step 2 of 5  ·  Media Clients  ·  it then opens like an app, full-screen', { x: MX + 0.85, y: 1.28, w: 10, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  const cy = 2.05, ch = 3.4, cw = 5.85, gap = CW - cw * 2;
  // iPhone
  card(s, MX, cy, cw, ch);
  pill(s, 'iPhone — Safari', MX + 0.3, cy + 0.28, 2.4, 0.45, '0F1A2E', WHITE, 12);
  numberedList(s, [
    { h: 'Tap the Share button', d: 'The square with an up-arrow.' },
    { h: 'Tap “Add to Home Screen”', d: 'Scroll the share sheet to find it.' },
    { h: 'Tap “Add”', d: 'An icon appears on your home screen.' },
  ], MX + 0.35, cy + 1.0, cw - 1.9, { color: GREEN, rowH: 0.75 });
  const r1 = phone(s, MX + cw - 1.35, cy + 1.0, 1.05, 2.1);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r1.x + r1.w / 2 - 0.25, y: r1.y + 0.4, w: 0.5, h: 0.5, rectRadius: 0.12, fill: { color: BLUE }, line: { type: 'none' } });
  s.addText('Hub', { x: r1.x, y: r1.y + 0.95, w: r1.w, h: 0.2, margin: 0, fontFace: FONT, fontSize: 7, color: INK, align: 'center' });

  // Android
  const ax = MX + cw + gap;
  card(s, ax, cy, cw, ch);
  pill(s, 'Android — Chrome', ax + 0.3, cy + 0.28, 2.5, 0.45, '0F1A2E', WHITE, 12);
  numberedList(s, [
    { h: 'Tap the ⋮ menu', d: 'Top-right of Chrome.' },
    { h: 'Tap “Add to Home screen”', d: 'Or “Install app”.' },
    { h: 'Tap “Add” / “Install”', d: 'An icon appears in your app drawer.' },
  ], ax + 0.35, cy + 1.0, cw - 1.9, { color: GREEN, rowH: 0.75 });
  const r2 = phone(s, ax + cw - 1.35, cy + 1.0, 1.05, 2.1);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r2.x + r2.w / 2 - 0.25, y: r2.y + 0.4, w: 0.5, h: 0.5, rectRadius: 0.12, fill: { color: BLUE }, line: { type: 'none' } });
  s.addText('Hub', { x: r2.x, y: r2.y + 0.95, w: r2.w, h: 0.2, margin: 0, fontFace: FONT, fontSize: 7, color: INK, align: 'center' });
  footer(s);
})();

// =============================================================================
// SLIDE 14 — Client Step 3: Request a voucher
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 3, MX, 0.6, GREEN);
  title(s, 'Request a meal voucher', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 3 of 5  ·  Media Clients', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Enter your email', d: 'First time only: add your accreditation number — linked for next time.' },
    { h: 'Pick location & meal', d: 'Choose the venue, then Lunch / Dinner (or the stadium meal).' },
    { h: 'Tap “Generate Voucher”', d: 'Get a QR ticket; the badge flips to “Redeemed” when scanned.' },
  ], MX, 2.1, 6.6, { color: GREEN, rowH: 1.1 });

  pill(s, 'Returning? Just your email — no need to re-enter accreditation', MX, 5.45, 6.5, 0.5, GREEN_SOFT, GREEN, 11.5);

  const r = phone(s, 9.5, 1.6, 2.5, 4.7);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r.x + 0.12, y: r.y + 0.15, w: r.w - 0.24, h: 0.85, rectRadius: 0.1, fill: { color: NAVY }, line: { type: 'none' } });
  s.addText('MMC · LUNCH', { x: r.x + 0.28, y: r.y + 0.25, w: r.w - 0.5, h: 0.3, margin: 0, fontFace: FONT, fontSize: 10, bold: true, color: WHITE });
  pill(s, 'PENDING', r.x + r.w - 1.05, r.y + 0.32, 0.8, 0.3, '1C3A6B', WHITE, 7.5);
  s.addText('Voucher', { x: r.x + 0.28, y: r.y + 0.55, w: r.w - 0.5, h: 0.3, margin: 0, fontFace: FONT, fontSize: 13, bold: true, color: WHITE });
  drawQR(s, r.x + r.w / 2 - 0.7, r.y + 1.2, 1.4, NAVY);
  s.addText('MV-3LWU13', { x: r.x + 0.2, y: r.y + 2.75, w: r.w - 0.4, h: 0.25, margin: 0, fontFace: MONO, fontSize: 9, color: INK, align: 'center', bold: true });
  for (let i = 0; i < 2; i++) lineRow(s, r.x + 0.35, r.y + 3.15 + i * 0.32, r.w - 0.7, 0.2, PANEL);
  bottomNav(s, r, 0);
  footer(s);
})();

// =============================================================================
// SLIDE 15 — Client Step 4: Vouchers stay all day
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 4, MX, 0.6, GREEN);
  title(s, 'Your vouchers stay all day', INK, MX + 0.85, 0.62, 10);
  s.addText('Step 4 of 5  ·  Media Clients  ·  retrieve them anytime', { x: MX + 0.85, y: 1.28, w: 10, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  bullets(s, [
    { text: 'Saved automatically.', bold: true },
    'Every voucher you generate today appears under “Your vouchers — today”.',
    { text: 'Reopen any time.', bold: true },
    'Tap a voucher to show its QR again at the counter — until local midnight.',
    { text: 'On any device, even offline.', bold: true },
    'Just enter your email on another phone; cached on-device for poor signal.',
  ], MX, 2.1, 6.4, 3.2, { fontSize: 13, gap: 6 });

  // phone showing saved vouchers list
  const r = phone(s, 9.5, 1.6, 2.5, 4.7);
  screenBar(s, r, 'Your vouchers — today', NAVY);
  const rowsY = r.y + 0.75;
  const items = [['Stadium Meal', GREEN], ['Dinner · MMC', AMBER], ['Lunch · MMC', GREEN]];
  items.forEach((it, i) => {
    const y = rowsY + i * 0.78;
    card(s, r.x + 0.16, y, r.w - 0.32, 0.66, { shadow: false, fill: PANEL, lineColor: LINE, radius: 0.08 });
    drawQR(s, r.x + 0.26, y + 0.1, 0.46, NAVY);
    s.addText(it[0], { x: r.x + 0.82, y: y + 0.1, w: r.w - 1.4, h: 0.25, margin: 0, fontFace: FONT, fontSize: 8.5, bold: true, color: INK, valign: 'middle' });
    pill(s, i === 2 ? 'Redeemed' : 'Pending', r.x + 0.82, y + 0.34, 0.9, 0.22, i === 2 ? GREEN_SOFT : AMBER_SOFT, i === 2 ? GREEN : AMBER, 6.5);
  });
  bottomNav(s, r, 0);
  footer(s);
})();

// =============================================================================
// SLIDE 16 — Client Step 5: Explore
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 5, MX, 0.6, GREEN);
  title(s, 'Everything else is one tap away', INK, MX + 0.85, 0.62, 10);
  s.addText('Step 5 of 5  ·  Media Clients  ·  use the bottom navigation bar', { x: MX + 0.85, y: 1.28, w: 10, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  const tabs = [
    { h: 'Voucher', d: 'Request and show your meal vouchers.', c: BLUE },
    { h: 'Press Conferences', d: 'Schedule with live status badges.', c: PURPLE },
    { h: 'News & Updates', d: 'Announcements, alerts and operations.', c: AMBER },
    { h: 'Transport', d: 'Shuttle routes, times and frequencies.', c: GREEN },
  ];
  const cw = (8.2 - 0.3) / 2, ch = 1.45;
  tabs.forEach((t, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = MX + col * (cw + 0.3), y = 2.15 + row * (ch + 0.3);
    card(s, x, y, cw, ch);
    s.addShape(pres.shapes.OVAL, { x: x + 0.25, y: y + 0.3, w: 0.42, h: 0.42, fill: { color: t.c }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + 0.25, y: y + 0.3, w: 0.42, h: 0.42, margin: 0, fontFace: FONT, fontSize: 14, bold: true, color: WHITE, align: 'center', valign: 'middle' });
    s.addText(t.h, { x: x + 0.82, y: y + 0.25, w: cw - 1.0, h: 0.4, margin: 0, fontFace: FONT, fontSize: 15, bold: true, color: INK, valign: 'middle' });
    s.addText(t.d, { x: x + 0.28, y: y + 0.78, w: cw - 0.55, h: 0.55, margin: 0, fontFace: FONT, fontSize: 12, color: MUTED });
  });

  const r = phone(s, 9.6, 1.7, 2.4, 4.5);
  screenBar(s, r, 'Media Hub', NAVY);
  for (let i = 0; i < 4; i++) lineRow(s, r.x + 0.2, r.y + 0.85 + i * 0.6, r.w - 0.4, 0.4, PANEL);
  bottomNav(s, r, 2);
  footer(s);
})();

// =============================================================================
// SLIDE 17 — Daily limits
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'The rules', GREEN);
  title(s, 'What you can claim each day');

  const cy = 2.1, ch = 2.9, cw = 5.85, gap = CW - cw * 2;
  card(s, MX, cy, cw, ch, { lineColor: BLUE_SOFT });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: cy, w: cw, h: 0.8, rectRadius: 0.12, fill: { color: BLUE }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: MX, y: cy + 0.4, w: cw, h: 0.4, fill: { color: BLUE }, line: { type: 'none' } });
  s.addText('Main Media Centre', { x: MX + 0.3, y: cy, w: cw - 0.6, h: 0.8, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: WHITE, valign: 'middle' });
  s.addText('1× Lunch  +  1× Dinner', { x: MX, y: cy + 1.1, w: cw, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: INK, align: 'center' });
  s.addText('You may hold both — but not two of the same meal at the same place on the same day.', { x: MX + 0.4, y: cy + 1.95, w: cw - 0.8, h: 0.8, margin: 0, fontFace: FONT, fontSize: 12.5, color: MUTED, align: 'center' });

  const ax = MX + cw + gap;
  card(s, ax, cy, cw, ch, { lineColor: PURPLE_SOFT });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ax, y: cy, w: cw, h: 0.8, rectRadius: 0.12, fill: { color: PURPLE }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: ax, y: cy + 0.4, w: cw, h: 0.4, fill: { color: PURPLE }, line: { type: 'none' } });
  s.addText('Stadiums', { x: ax + 0.3, y: cy, w: cw - 0.6, h: 0.8, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: WHITE, valign: 'middle' });
  s.addText('1× Meal', { x: ax, y: cy + 1.1, w: cw, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: INK, align: 'center' });
  s.addText('One meal total per stadium per day — grants access to the venue Media Café.', { x: ax + 0.4, y: cy + 1.95, w: cw - 0.8, h: 0.8, margin: 0, fontFace: FONT, fontSize: 12.5, color: MUTED, align: 'center' });

  card(s, MX, cy + ch + 0.2, CW, 0.7, { fill: PANEL, shadow: false });
  s.addText([
    { text: 'Per email, per day, enforced centrally. ', options: { bold: true, color: INK, fontSize: 13 } },
    { text: 'Training Sites are transport & info only — no meal vouchers. Limits reset at local midnight.', options: { color: MUTED, fontSize: 13 } },
  ], { x: MX + 0.35, y: cy + ch + 0.2, w: CW - 0.7, h: 0.7, margin: 0, fontFace: FONT, valign: 'middle', align: 'center' });
  footer(s);
})();

// =============================================================================
// SLIDE 18 — Cheat sheet + closing
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
    { text: 'Admin:   ', options: { color: DARKMUTED } }, { text: HOST + '/admin\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Key:      ', options: { color: DARKMUTED } }, { text: 'your private admin key\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Redeem:  ', options: { color: DARKMUTED } }, { text: 'Redeemer tab (scan / type)\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Export:   ', options: { color: DARKMUTED } }, { text: 'Overview → Export CSV', options: { color: WHITE, bold: true } },
  ], { x: MX + 0.4, y: cy + 1.0, w: cw - 0.8, h: 1.9, margin: 0, fontFace: MONO, fontSize: 12, valign: 'top', lineSpacingMultiple: 1.3 });

  // Client
  const ax = MX + cw + gap;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ax, y: cy, w: cw, h: ch, rectRadius: 0.14, fill: { color: '143E30' }, line: { type: 'none' } });
  pill(s, 'Media Clients', ax + 0.3, cy + 0.28, 2.2, 0.45, GREEN, WHITE, 12);
  s.addText([
    { text: 'Open:      ', options: { color: 'A9CFBF' } }, { text: HOST + '\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Install:    ', options: { color: 'A9CFBF' } }, { text: 'Share → Add to Home Screen\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'First time: ', options: { color: 'A9CFBF' } }, { text: 'email + accreditation\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Then:       ', options: { color: 'A9CFBF' } }, { text: 'email only — vouchers saved all day', options: { color: WHITE, bold: true } },
  ], { x: ax + 0.4, y: cy + 1.0, w: cw - 0.8, h: 1.9, margin: 0, fontFace: MONO, fontSize: 11.5, valign: 'top', lineSpacingMultiple: 1.3 });

  s.addText('You’re ready — enjoy the tournament.', { x: MX, y: cy + ch + 0.35, w: CW, h: 0.5, margin: 0, fontFace: FONT, fontSize: 17, bold: true, italic: true, color: WHITE, align: 'center' });
  footer(s, true);
})();

// ---- write -----------------------------------------------------------------
const out = path.join(__dirname, '..', 'AFC2027 Media Hub - Onboarding Guide.pptx');
pres.writeFile({ fileName: out }).then((f) => console.log('WROTE', f)).catch((e) => { console.error(e); process.exit(1); });
