'use strict';

/* Generates the AFC Asian Cup 2027 Media Hub onboarding deck.
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
const INK = '0F1A2E';
const MUTED = '5C6A7E';
const FAINT = '8A96A8';
const LINE = 'DCE2EC';
const PANEL = 'F5F8FC';
const WHITE = 'FFFFFF';
const DARKMUTED = '93A4C6';

const FONT = 'Segoe UI';
const MONO = 'Consolas';

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
  // soft accent blocks
  s.addShape(pres.shapes.OVAL, { x: 10.4, y: -1.4, w: 4.6, h: 4.6, fill: { color: NAVY2 }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: 11.7, y: 4.6, w: 3.4, h: 3.4, fill: { color: '16305C' }, line: { type: 'none' } });

  // app icon tile
  const ix = 9.7, iy = 2.35, isz = 1.9;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ix, y: iy, w: isz, h: isz, rectRadius: 0.42, fill: { color: BLUE }, line: { type: 'none' }, shadow: shadow() });
  // ticket glyph
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ix + 0.4, y: iy + 0.72, w: isz - 0.8, h: 0.52, rectRadius: 0.1, fill: { color: WHITE }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: ix + 0.4 + (isz - 0.8) / 2 - 0.12, y: iy + 0.72 - 0.12, w: 0.24, h: 0.24, fill: { color: BLUE }, line: { type: 'none' } });
  s.addShape(pres.shapes.OVAL, { x: ix + 0.4 + (isz - 0.8) / 2 - 0.12, y: iy + 0.72 + 0.52 - 0.12, w: 0.24, h: 0.24, fill: { color: BLUE }, line: { type: 'none' } });

  s.addText('SETUP & ONBOARDING GUIDE', { x: MX, y: 1.5, w: 8.5, h: 0.4, margin: 0, fontFace: FONT, fontSize: 14, bold: true, color: '6FA0FF', charSpacing: 4 });
  s.addText('Media Hub', { x: MX, y: 2.0, w: 8.6, h: 1.3, margin: 0, fontFace: FONT, fontSize: 64, bold: true, color: WHITE });
  s.addText('Meal Vouchers & Media Information — AFC Asian Cup 2027', { x: MX, y: 3.35, w: 8.6, h: 0.6, margin: 0, fontFace: FONT, fontSize: 19, color: 'CFDBF2' });

  pill(s, 'For Administrators', MX, 4.35, 2.5, 0.5, BLUE, WHITE, 12.5);
  pill(s, 'For Media Clients', MX + 2.7, 4.35, 2.4, 0.5, GREEN, WHITE, 12.5);

  s.addText('How to run the system — and how to install it on your team’s phones.', { x: MX, y: 5.5, w: 8.6, h: 0.5, margin: 0, fontFace: FONT, fontSize: 13.5, italic: true, color: DARKMUTED });
  footer(s, true);
})();

// =============================================================================
// SLIDE 2 — Overview: two apps
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'Overview', BLUE);
  title(s, 'Two apps, powered by one local server');

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
    'Press conferences, news & shuttle info.',
  ], MX + 0.35, cy + 1.05, cw - 0.7, 1.5, { fontSize: 13.5, gap: 8 });
  s.addText('http://<host>:3000', { x: MX + 0.35, y: cy + ch - 0.5, w: cw - 0.7, h: 0.34, margin: 0, fontFace: MONO, fontSize: 12, color: GREEN, bold: true });

  // Admin card
  const ax = MX + cw + gap;
  card(s, ax, cy, cw, ch, { lineColor: BLUE_SOFT });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ax, y: cy, w: cw, h: 0.85, rectRadius: 0.12, fill: { color: NAVY }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: ax, y: cy + 0.43, w: cw, h: 0.42, fill: { color: NAVY }, line: { type: 'none' } });
  s.addText('Admin Dashboard', { x: ax + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 20, bold: true, color: WHITE, valign: 'middle' });
  s.addText('at the media desk', { x: ax + 0.3, y: cy, w: cw - 0.6, h: 0.85, margin: 0, fontFace: FONT, fontSize: 12, color: 'BFD2F6', align: 'right', valign: 'middle' });
  bullets(s, [
    'For event organizers.',
    'Live analytics & voucher monitoring.',
    'Manage news & press conferences.',
  ], ax + 0.35, cy + 1.05, cw - 0.7, 1.5, { fontSize: 13.5, gap: 8 });
  s.addText('http://<host>:3000/admin', { x: ax + 0.35, y: cy + ch - 0.5, w: cw - 0.7, h: 0.34, margin: 0, fontFace: MONO, fontSize: 12, color: BLUE, bold: true });

  // benefit strip
  const by = cy + ch + 0.35;
  card(s, MX, by, CW, 0.95, { fill: AMBER_SOFT, lineColor: 'F1DCB0', shadow: false });
  s.addText([
    { text: 'Why a server?  ', options: { bold: true, color: AMBER, fontSize: 14 } },
    { text: 'Every voucher is recorded centrally — so daily limits apply to everyone and can’t be bypassed with incognito mode or by clearing the browser cache.', options: { color: '7A4E08', fontSize: 13.5 } },
  ], { x: MX + 0.35, y: by, w: CW - 0.7, h: 0.95, margin: 0, fontFace: FONT, valign: 'middle', align: 'left' });
  footer(s);
})();

// =============================================================================
// SLIDE 3 — How it works
// =============================================================================
(() => {
  const s = slideLight();
  kicker(s, 'How it works', BLUE);
  title(s, 'One laptop. Your Wi-Fi. Everyone’s phone.');

  const cy = 2.4, ch = 2.7, cw = 3.5;
  const xs = [MX, MX + (CW - cw) / 2, MX + CW - cw];
  const nodes = [
    { t: 'Host laptop', d: 'Runs the server and stores all data (data.json).', c: NAVY, sub: 'start.bat' },
    { t: 'Venue Wi-Fi', d: 'Connects the laptop and the phones on one network.', c: BLUE, sub: 'same network' },
    { t: 'Media phones', d: 'Open the app in any browser — no app store needed.', c: GREEN, sub: 'http://<ip>:3000' },
  ];
  nodes.forEach((n, i) => {
    const x = xs[i];
    card(s, x, cy, cw, ch);
    s.addShape(pres.shapes.OVAL, { x: x + cw / 2 - 0.45, y: cy + 0.35, w: 0.9, h: 0.9, fill: { color: n.c }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + cw / 2 - 0.45, y: cy + 0.35, w: 0.9, h: 0.9, margin: 0, fontFace: FONT, fontSize: 30, bold: true, color: WHITE, align: 'center', valign: 'middle' });
    s.addText(n.t, { x: x + 0.2, y: cy + 1.35, w: cw - 0.4, h: 0.4, margin: 0, fontFace: FONT, fontSize: 17, bold: true, color: INK, align: 'center' });
    s.addText(n.d, { x: x + 0.25, y: cy + 1.75, w: cw - 0.5, h: 0.55, margin: 0, fontFace: FONT, fontSize: 12.5, color: MUTED, align: 'center', valign: 'top' });
    s.addText(n.sub, { x: x + 0.2, y: cy + 2.32, w: cw - 0.4, h: 0.3, margin: 0, fontFace: MONO, fontSize: 10.5, color: n.c, align: 'center', bold: true });
  });
  // arrows
  [[xs[0] + cw, xs[1]], [xs[1] + cw, xs[2]]].forEach(([x1, x2]) => {
    s.addShape(pres.shapes.LINE, { x: x1 + 0.08, y: cy + ch / 2, w: x2 - x1 - 0.16, h: 0, line: { color: FAINT, width: 2, endArrowType: 'triangle' } });
  });

  s.addText('The laptop is the single source of truth — limits are checked there, for every request, from every device.', { x: MX, y: cy + ch + 0.5, w: CW, h: 0.5, margin: 0, fontFace: FONT, fontSize: 13.5, italic: true, color: MUTED, align: 'center' });
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
  s.addText('Run the system in five simple steps.', { x: MX, y: 3.35, w: 9, h: 0.5, margin: 0, fontFace: FONT, fontSize: 18, color: 'CFDBF2' });

  const steps = ['Start the server', 'Open the dashboard', 'Watch the analytics', 'Manage the content', 'Share the link'];
  steps.forEach((t, i) => {
    const y = 4.5 + i * 0.0;
    const x = MX + i * 2.42;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.5, w: 2.25, h: 0.95, rectRadius: 0.12, fill: { color: '17305A' }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + 0.18, y: 4.62, w: 0.7, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: BLUE, align: 'left' });
    s.addText(t, { x: x + 0.18, y: 4.6, w: 1.95, h: 0.75, margin: 0, fontFace: FONT, fontSize: 11, bold: true, color: 'E7EEFB', align: 'right', valign: 'middle' });
  });
  footer(s, true);
})();

// =============================================================================
// SLIDE 5 — Admin Step 1: Start the server
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 1, MX, 0.6, BLUE);
  title(s, 'Start the server', INK, MX + 0.85, 0.62, 8);
  s.addText('Step 1 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  bullets(s, [
    { text: 'Double-click start.bat (Windows).', bold: true },
    'No installation needed — a self-contained Node.js is bundled in the folder.',
    'A console window opens and prints the addresses to use.',
    'Keep this window open during the event — closing it stops the server.',
  ], MX, 2.05, 5.9, 3.0, { fontSize: 14.5, gap: 12 });

  pill(s, 'Also works with  npm start  if you install Node yourself', MX, 5.25, 5.7, 0.5, BLUE_SOFT, BLUE, 11.5);

  // terminal mock
  const tx = 6.95, tw = CW - (tx - MX), ty = 2.0, th = 3.55;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: tx, y: ty, w: tw, h: th, rectRadius: 0.12, fill: { color: '0B1A33' }, line: { type: 'none' }, shadow: shadow() });
  ['F96167', 'F9C23C', '3FBF6A'].forEach((c, i) => s.addShape(pres.shapes.OVAL, { x: tx + 0.25 + i * 0.25, y: ty + 0.22, w: 0.14, h: 0.14, fill: { color: c }, line: { type: 'none' } }));
  s.addText('Command Prompt', { x: tx, y: ty + 0.13, w: tw, h: 0.3, margin: 0, fontFace: FONT, fontSize: 10, color: DARKMUTED, align: 'center' });
  s.addText([
    { text: '========================================', options: { color: '4D6699', breakLine: true } },
    { text: 'AFC Asian Cup 2027 | Media Hub - running', options: { color: 'FFFFFF', bold: true, breakLine: true } },
    { text: '========================================', options: { color: '4D6699', breakLine: true } },
    { text: 'Client app   -> http://localhost:3000', options: { color: '7FE8B6', breakLine: true } },
    { text: 'Admin panel  -> http://localhost:3000/admin', options: { color: '7FE8B6', breakLine: true } },
    { text: 'On phones    -> http://10.0.34.23:3000', options: { color: '6FA0FF', breakLine: true } },
    { text: ' ', options: { breakLine: true } },
    { text: 'Admin key: "afc2027-media"', options: { color: 'F9C23C' } },
  ], { x: tx + 0.3, y: ty + 0.62, w: tw - 0.6, h: th - 0.85, margin: 0, fontFace: MONO, fontSize: 11.5, valign: 'top', align: 'left', lineSpacingMultiple: 1.45 });
  footer(s);
})();

// =============================================================================
// SLIDE 6 — Admin Step 2: Log in
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 2, MX, 0.6, BLUE);
  title(s, 'Open the Admin Dashboard', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 2 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Go to the admin URL', d: 'On the laptop, open  http://localhost:3000/admin' },
    { h: 'Enter the admin key', d: 'Default:  afc2027-media' },
    { h: 'Change the key anytime', d: 'Set the ADMIN_KEY value before starting the server.' },
  ], MX, 2.1, 5.9, { color: BLUE, rowH: 1.0 });

  pill(s, 'The key is remembered only for that browser session', MX, 5.2, 5.7, 0.5, BLUE_SOFT, BLUE, 11.5);

  // login mock in browser
  const bx = 7.0, bw = CW - (bx - MX);
  const r = browser(s, bx, 2.0, bw, 3.4, 'localhost:3000/admin');
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
// SLIDE 7 — Admin Step 3: Analytics
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 3, MX, 0.6, BLUE);
  title(s, 'Watch vouchers in real time', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 3 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  bullets(s, [
    { text: 'Counters', bold: true },
    'Total issued, issued today, registered media, stadium meals.',
    { text: 'Charts', bold: true },
    'Breakdown by meal type and by location.',
    { text: 'Live feed', bold: true },
    'Recently issued vouchers — auto-refreshes every 5 seconds.',
  ], MX, 2.05, 4.7, 3.2, { fontSize: 13.5, gap: 7 });

  // browser with metric callouts + chart
  const bx = 5.7, bw = CW - (bx - MX);
  const r = browser(s, bx, 1.95, bw, 3.6, 'localhost:3000/admin');
  // two metric callouts
  const mcw = (r.w - 0.6) / 2;
  [['7', 'Issued today', BLUE], ['5', 'Registered media', PURPLE]].forEach((m, i) => {
    const mx = r.x + 0.2 + i * (mcw + 0.2);
    card(s, mx, r.y + 0.15, mcw, 0.85, { shadow: false, fill: PANEL, lineColor: LINE });
    s.addText(m[0], { x: mx + 0.2, y: r.y + 0.2, w: mcw - 0.4, h: 0.55, margin: 0, fontFace: FONT, fontSize: 30, bold: true, color: m[2], valign: 'middle' });
    s.addText(m[1], { x: mx + 0.2, y: r.y + 0.62, w: mcw - 0.4, h: 0.25, margin: 0, fontFace: FONT, fontSize: 10, color: MUTED });
  });
  // native bar chart
  s.addChart(pres.charts.BAR, [{ name: 'Vouchers', labels: ['Lunch', 'Dinner', 'Stadium'], values: [5, 1, 1] }], {
    x: r.x + 0.15, y: r.y + 1.15, w: r.w - 0.3, h: r.h - 1.3, barDir: 'col',
    chartColors: [BLUE, NAVY, PURPLE], showValue: true, dataLabelColor: INK, dataLabelFontSize: 10,
    catAxisLabelColor: MUTED, valAxisHidden: true, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
    showLegend: false, showTitle: true, title: 'Vouchers by meal type', titleColor: INK, titleFontSize: 12, barGapWidthPct: 60,
  });
  footer(s);
})();

// =============================================================================
// SLIDE 8 — Admin Step 4: CMS
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 4, MX, 0.6, BLUE);
  title(s, 'Publish news & press conferences', INK, MX + 0.85, 0.62, 11);
  s.addText('Step 4 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  const cy = 2.05, ch = 2.95, cw = 5.85, gap = CW - cw * 2;
  // News
  card(s, MX, cy, cw, ch);
  pill(s, 'News Manager', MX + 0.3, cy + 0.28, 2.2, 0.45, BLUE_SOFT, BLUE, 12.5);
  bullets(s, [
    'Add, edit or delete updates.',
    'Choose a category (Alert, Transport, Catering…).',
    'Optionally Pin an item to the top.',
    'Appears instantly in the client News tab.',
  ], MX + 0.35, cy + 0.95, cw - 0.7, 1.9, { fontSize: 13.5, gap: 9 });

  // Press
  const ax = MX + cw + gap;
  card(s, ax, cy, cw, ch);
  pill(s, 'Press Manager', ax + 0.3, cy + 0.28, 2.3, 0.45, BLUE_SOFT, BLUE, 12.5);
  bullets(s, [
    'Add or update conferences.',
    'Set date, time, team and room.',
    'Set status: Scheduled · Live · Delayed · Concluded.',
    'Shows on the client Press tab with a status badge.',
  ], ax + 0.35, cy + 0.95, cw - 0.7, 1.9, { fontSize: 13.5, gap: 9 });

  card(s, MX, cy + ch + 0.2, CW, 0.7, { fill: PANEL, shadow: false });
  s.addText([
    { text: 'Saved to the server. ', options: { bold: true, color: INK, fontSize: 13 } },
    { text: 'Every phone sees the change on its next refresh.', options: { color: MUTED, fontSize: 13 } },
  ], { x: MX + 0.35, y: cy + ch + 0.2, w: CW - 0.7, h: 0.7, margin: 0, fontFace: FONT, valign: 'middle' });
  footer(s);
})();

// =============================================================================
// SLIDE 9 — Admin Step 5: Share the link
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 5, MX, 0.6, BLUE);
  title(s, 'Give clients the address', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 5 of 5  ·  Administrators', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Use the “On phones” address', d: 'From the console, e.g.  http://10.0.34.23:3000' },
    { h: 'Make it easy to reach', d: 'Print it as a QR code or a poster at the media desk.' },
    { h: 'First run only: allow the firewall', d: 'Tick “Private networks” on the Windows Defender prompt.' },
  ], MX, 2.1, 6.4, { color: BLUE, rowH: 1.05 });

  // poster mock with QR
  const px = 8.4, pw = CW - (px - MX), py = 2.0, ph = 3.5;
  card(s, px, py, pw, ph);
  s.addText('Scan to open', { x: px, y: py + 0.25, w: pw, h: 0.4, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: INK, align: 'center' });
  s.addText('the Media Hub', { x: px, y: py + 0.6, w: pw, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: MUTED, align: 'center' });
  drawQR(s, px + pw / 2 - 0.9, py + 1.05, 1.8, NAVY);
  pill(s, 'http://10.0.34.23:3000', px + 0.3, py + ph - 0.6, pw - 0.6, 0.42, NAVY, WHITE, 11);
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
    { h: 'Keep it awake', d: 'Stop the laptop from sleeping; stay on the same Wi-Fi.' },
    { h: 'Phone can’t connect?', d: 'Re-check the firewall — allow Node on Private networks.' },
    { h: 'Back up your data', d: 'Copy data.json to keep a record of all vouchers.' },
    { h: 'Start fresh', d: 'Run npm run reset (or delete data.json) to clear & re-seed.' },
    { h: 'Change the admin key', d: 'Set ADMIN_KEY before starting the server.' },
    { h: 'Change the port', d: 'Set PORT (the default is 3000).' },
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
  s.addText('Get it on your phone in under a minute.', { x: MX, y: 3.35, w: 9, h: 0.5, margin: 0, fontFace: FONT, fontSize: 18, color: 'CFE8DC' });

  const steps = ['Join the Wi-Fi', 'Open the link', 'Add to Home Screen', 'Request a voucher', 'Explore the hub'];
  steps.forEach((t, i) => {
    const x = MX + i * 2.42;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 4.5, w: 2.25, h: 0.95, rectRadius: 0.12, fill: { color: '143E30' }, line: { type: 'none' } });
    s.addText(String(i + 1), { x: x + 0.18, y: 4.62, w: 0.7, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: GREEN, align: 'left' });
    s.addText(t, { x: x + 0.18, y: 4.6, w: 1.95, h: 0.75, margin: 0, fontFace: FONT, fontSize: 10.5, bold: true, color: 'DFF3EA', align: 'right', valign: 'middle' });
  });
  footer(s, true);
})();

// =============================================================================
// SLIDE 12 — Client Step 1: Wi-Fi
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 1, MX, 0.6, GREEN);
  title(s, 'Connect to the event Wi-Fi', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 1 of 5  ·  Media Clients', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  bullets(s, [
    { text: 'Join the same Wi-Fi network as the media desk.', bold: true },
    'Ask the media desk for the network name if needed.',
    'No mobile data required — everything runs locally at the venue.',
  ], MX, 2.2, 6.5, 2.5, { fontSize: 15, gap: 12 });

  pill(s, 'Same Wi-Fi as the laptop = you’re good to go', MX, 4.7, 5.5, 0.5, GREEN_SOFT, GREEN, 11.5);

  // phone with wifi settings row
  const r = phone(s, 9.6, 1.7, 2.4, 4.5);
  screenBar(s, r, 'Wi-Fi', NAVY);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r.x + 0.18, y: r.y + 0.8, w: r.w - 0.36, h: 0.7, rectRadius: 0.1, fill: { color: GREEN_SOFT }, line: { type: 'none' } });
  s.addText('AFC-Media-WiFi', { x: r.x + 0.32, y: r.y + 0.8, w: r.w - 0.9, h: 0.7, margin: 0, fontFace: FONT, fontSize: 11, bold: true, color: INK, valign: 'middle' });
  s.addShape(pres.shapes.OVAL, { x: r.x + r.w - 0.6, y: r.y + 1.05, w: 0.28, h: 0.28, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('Connected', { x: r.x + 0.32, y: r.y + 1.55, w: r.w - 0.6, h: 0.3, margin: 0, fontFace: FONT, fontSize: 9, color: GREEN, bold: true });
  for (let i = 0; i < 3; i++) lineRow(s, r.x + 0.18, r.y + 2.15 + i * 0.45, r.w - 0.36, 0.26, PANEL);
  footer(s);
})();

// =============================================================================
// SLIDE 13 — Client Step 2: Open the link
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 2, MX, 0.6, GREEN);
  title(s, 'Open the Media Hub link', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 2 of 5  ·  Media Clients', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Open your browser', d: 'Safari (iPhone) or Chrome (Android).' },
    { h: 'Type the address', d: 'The one on the media-desk poster, e.g.  http://10.0.34.23:3000' },
    { h: 'Or scan the QR code', d: 'Point your camera at the poster — tap the link.' },
  ], MX, 2.1, 6.4, { color: GREEN, rowH: 1.05 });

  // QR + phone
  const px = 8.5, pw = CW - (px - MX);
  card(s, px, 2.0, pw, 3.5);
  s.addText('Scan to open', { x: px, y: 2.25, w: pw, h: 0.35, margin: 0, fontFace: FONT, fontSize: 15, bold: true, color: INK, align: 'center' });
  drawQR(s, px + pw / 2 - 0.85, 2.75, 1.7, GREEN);
  pill(s, 'http://10.0.34.23:3000', px + 0.3, 4.75, pw - 0.6, 0.42, GREEN, WHITE, 11);
  footer(s);
})();

// =============================================================================
// SLIDE 14 — Client Step 3: Add to Home Screen
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 3, MX, 0.6, GREEN);
  title(s, 'Add it to your home screen', INK, MX + 0.85, 0.62, 10);
  s.addText('Step 3 of 5  ·  Media Clients  ·  it then opens like an app, full-screen', { x: MX + 0.85, y: 1.28, w: 10, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  const cy = 2.05, ch = 3.4, cw = 5.85, gap = CW - cw * 2;
  // iPhone
  card(s, MX, cy, cw, ch);
  pill(s, 'iPhone — Safari', MX + 0.3, cy + 0.28, 2.4, 0.45, '0F1A2E', WHITE, 12);
  numberedList(s, [
    { h: 'Tap the Share button', d: 'The square with an up-arrow.' },
    { h: 'Tap “Add to Home Screen”', d: 'Scroll the share sheet to find it.' },
    { h: 'Tap “Add”', d: 'An icon appears on your home screen.' },
  ], MX + 0.35, cy + 1.0, cw - 1.9, { color: GREEN, rowH: 0.75 });
  // mini phone w/ icon
  const r1 = phone(s, MX + cw - 1.35, cy + 1.0, 1.05, 2.1);
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r1.x + r1.w / 2 - 0.25, y: r1.y + 0.4, w: 0.5, h: 0.5, rectRadius: 0.12, fill: { color: GREEN }, line: { type: 'none' } });
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
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r2.x + r2.w / 2 - 0.25, y: r2.y + 0.4, w: 0.5, h: 0.5, rectRadius: 0.12, fill: { color: GREEN }, line: { type: 'none' } });
  s.addText('Hub', { x: r2.x, y: r2.y + 0.95, w: r2.w, h: 0.2, margin: 0, fontFace: FONT, fontSize: 7, color: INK, align: 'center' });
  footer(s);
})();

// =============================================================================
// SLIDE 15 — Client Step 4: Request a voucher
// =============================================================================
(() => {
  const s = slideLight();
  stepBadge(s, 4, MX, 0.6, GREEN);
  title(s, 'Request a meal voucher', INK, MX + 0.85, 0.62, 9);
  s.addText('Step 4 of 5  ·  Media Clients', { x: MX + 0.85, y: 1.28, w: 8, h: 0.3, margin: 0, fontFace: FONT, fontSize: 12, color: FAINT });

  numberedList(s, [
    { h: 'Enter your email', d: 'First time only: add your accreditation number — it’s linked for next time.' },
    { h: 'Pick location & meal', d: 'Choose the venue, then Lunch / Dinner (or the stadium meal).' },
    { h: 'Tap “Generate Voucher”', d: 'Show the QR ticket at the counter.' },
  ], MX, 2.1, 6.6, { color: GREEN, rowH: 1.1 });

  pill(s, 'Returning? Just your email — no need to re-enter accreditation', MX, 5.45, 6.5, 0.5, GREEN_SOFT, GREEN, 11.5);

  // phone with voucher ticket
  const r = phone(s, 9.5, 1.6, 2.5, 4.7);
  // ticket header
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: r.x + 0.12, y: r.y + 0.15, w: r.w - 0.24, h: 0.85, rectRadius: 0.1, fill: { color: NAVY }, line: { type: 'none' } });
  s.addText('MMC · LUNCH', { x: r.x + 0.28, y: r.y + 0.25, w: r.w - 0.5, h: 0.3, margin: 0, fontFace: FONT, fontSize: 10, bold: true, color: WHITE });
  pill(s, 'VALID', r.x + r.w - 0.95, r.y + 0.32, 0.7, 0.3, '1C3A6B', WHITE, 8);
  s.addText('Voucher', { x: r.x + 0.28, y: r.y + 0.55, w: r.w - 0.5, h: 0.3, margin: 0, fontFace: FONT, fontSize: 13, bold: true, color: WHITE });
  drawQR(s, r.x + r.w / 2 - 0.7, r.y + 1.2, 1.4, NAVY);
  s.addText('MV-3LWU13', { x: r.x + 0.2, y: r.y + 2.75, w: r.w - 0.4, h: 0.25, margin: 0, fontFace: MONO, fontSize: 9, color: INK, align: 'center', bold: true });
  for (let i = 0; i < 2; i++) lineRow(s, r.x + 0.35, r.y + 3.15 + i * 0.32, r.w - 0.7, 0.2, PANEL);
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

  // phone showing nav
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
  // MMC & Training
  card(s, MX, cy, cw, ch, { lineColor: BLUE_SOFT });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: MX, y: cy, w: cw, h: 0.8, rectRadius: 0.12, fill: { color: BLUE }, line: { type: 'none' } });
  s.addShape(pres.shapes.RECTANGLE, { x: MX, y: cy + 0.4, w: cw, h: 0.4, fill: { color: BLUE }, line: { type: 'none' } });
  s.addText('Media Centres & Training Sites', { x: MX + 0.3, y: cy, w: cw - 0.6, h: 0.8, margin: 0, fontFace: FONT, fontSize: 16, bold: true, color: WHITE, valign: 'middle' });
  s.addText('1× Lunch  +  1× Dinner', { x: MX, y: cy + 1.1, w: cw, h: 0.7, margin: 0, fontFace: FONT, fontSize: 26, bold: true, color: INK, align: 'center' });
  s.addText('You may hold both — but not two of the same meal at the same place on the same day.', { x: MX + 0.4, y: cy + 1.95, w: cw - 0.8, h: 0.8, margin: 0, fontFace: FONT, fontSize: 12.5, color: MUTED, align: 'center' });

  // Stadiums
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
    { text: 'A duplicate request shows a friendly “already claimed” message.', options: { color: MUTED, fontSize: 13 } },
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
    { text: 'Start:   ', options: { color: DARKMUTED } }, { text: 'double-click start.bat\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Admin:  ', options: { color: DARKMUTED } }, { text: 'localhost:3000/admin\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Key:     ', options: { color: DARKMUTED } }, { text: 'afc2027-media\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Reset:   ', options: { color: DARKMUTED } }, { text: 'npm run reset', options: { color: WHITE, bold: true } },
  ], { x: MX + 0.4, y: cy + 1.0, w: cw - 0.8, h: 1.9, margin: 0, fontFace: MONO, fontSize: 13.5, valign: 'top', lineSpacingMultiple: 1.3 });

  // Client
  const ax = MX + cw + gap;
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: ax, y: cy, w: cw, h: ch, rectRadius: 0.14, fill: { color: '143E30' }, line: { type: 'none' } });
  pill(s, 'Media Clients', ax + 0.3, cy + 0.28, 2.2, 0.45, GREEN, WHITE, 12);
  s.addText([
    { text: 'Open:      ', options: { color: 'A9CFBF' } }, { text: 'http://<desk-IP>:3000\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Install:    ', options: { color: 'A9CFBF' } }, { text: 'Share → Add to Home Screen\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'First time: ', options: { color: 'A9CFBF' } }, { text: 'email + accreditation\n', options: { color: WHITE, bold: true, breakLine: true } },
    { text: 'Then:       ', options: { color: 'A9CFBF' } }, { text: 'email only', options: { color: WHITE, bold: true } },
  ], { x: ax + 0.4, y: cy + 1.0, w: cw - 0.8, h: 1.9, margin: 0, fontFace: MONO, fontSize: 13, valign: 'top', lineSpacingMultiple: 1.3 });

  s.addText('You’re ready — enjoy the tournament.', { x: MX, y: cy + ch + 0.35, w: CW, h: 0.5, margin: 0, fontFace: FONT, fontSize: 17, bold: true, italic: true, color: WHITE, align: 'center' });
  footer(s, true);
})();

// ---- write -----------------------------------------------------------------
const out = path.join(__dirname, '..', 'AFC2027 Media Hub - Onboarding Guide.pptx');
pres.writeFile({ fileName: out }).then((f) => console.log('WROTE', f)).catch((e) => { console.error(e); process.exit(1); });
