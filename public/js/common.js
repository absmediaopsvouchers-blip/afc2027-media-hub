'use strict';

/* =============================================================================
   Shared helpers for the client app and the admin dashboard.
   Plain browser JS — no build step, no framework, works offline.
   ========================================================================== */

/* ---- API client ----------------------------------------------------------- */

const Admin = {
  key() { return sessionStorage.getItem('mh.adminKey') || ''; },
  setKey(k) { sessionStorage.setItem('mh.adminKey', k); },
  role() { return sessionStorage.getItem('mh.adminRole') || 'admin'; },
  setRole(r) { sessionStorage.setItem('mh.adminRole', r); },
  isVolunteer() { return this.role() === 'volunteer'; },
  clear() { sessionStorage.removeItem('mh.adminKey'); sessionStorage.removeItem('mh.adminRole'); },
};

const API = {
  async _req(method, path, body, admin) {
    const headers = {};
    const opts = { method, headers };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (admin) headers[Admin.isVolunteer() ? 'x-volunteer-key' : 'x-admin-key'] = Admin.key();

    let res;
    try {
      res = await fetch('/api' + path, opts);
    } catch (networkErr) {
      throw new Error('Cannot reach the server. Check your Wi-Fi connection.');
    }

    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch (e) { data = { error: text }; } }

    if (!res.ok) {
      const err = new Error((data && data.error) || `Request failed (${res.status})`);
      err.status = res.status;
      err.code = data && data.code;
      err.data = data; // full response body (e.g. redeemedAt on a 409)
      throw err;
    }
    return data;
  },
  get(p, admin) { return this._req('GET', p, undefined, admin); },
  post(p, b, admin) { return this._req('POST', p, b, admin); },
  put(p, b, admin) { return this._req('PUT', p, b, admin); },
  del(p, admin) { return this._req('DELETE', p, undefined, admin); },
};

/* ---- text / DOM ----------------------------------------------------------- */

/** Escape a value for safe interpolation into innerHTML. */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function $(sel, root) { return (root || document).querySelector(sel); }
function $all(sel, root) { return Array.from((root || document).querySelectorAll(sel)); }

/* ---- date / time formatting (local) --------------------------------------- */

function pad(n) { return String(n).padStart(2, '0'); }

function fmtClock(d) { return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; }

function fmtTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  try {
    return d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return `${pad(d.getDate())} ${fmtTime(iso)}`;
  }
}

/** Relative time: "just now", "12 min ago", "3 h ago", then a date. */
function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return 'Yesterday';
  if (day < 7) return `${day} days ago`;
  try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }); }
  catch (e) { return ''; }
}

/** "YYYY-MM-DD" today + offset. */
function dayStr(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Friendly label for a "YYYY-MM-DD" string: Today / Tomorrow / weekday. */
function dayLabel(ymd) {
  if (ymd === dayStr(0)) return 'Today';
  if (ymd === dayStr(1)) return 'Tomorrow';
  if (ymd === dayStr(-1)) return 'Yesterday';
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  try { return date.toLocaleDateString('en-GB', { weekday: 'long' }); }
  catch (e) { return ymd; }
}

function longDate(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  try { return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }); }
  catch (e) { return ymd; }
}

/* ---- inline SVG icons ------------------------------------------------------ */

const ICONS = {
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v5M8 22h8"/></svg>',
  news: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l16-6v14L3 13v-2z"/><path d="M11.6 16.8a3 3 0 0 1-5.6-1.4V13"/><path d="M19 8a3 3 0 0 1 0 6"/></svg>',
  bus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="14" rx="2"/><path d="M4 10h16M8 17v2M16 17v2M8 3v7M16 3v7"/><circle cx="8.5" cy="14" r=".6" fill="currentColor"/><circle cx="15.5" cy="14" r=".6" fill="currentColor"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="5" rx="1.5"/><rect x="13" y="10" width="8" height="11" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 4v5h-5"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 4l6 6-3 1-3 3-1 5-2-2-4 4-1-1 4-4-2-2 5-1 3-3 1-3z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
  checkCircle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.1V12a10 10 0 1 1-5.9-9.1"/><path d="M22 4L12 14.01l-3-3"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M5.6 5.6l12.8 12.8"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  pin2: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-5.7-7-11a7 7 0 1 1 14 0c0 5.3-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>',
  users: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5M12 15V3"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  scan: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M3 12h18"/></svg>',
  building: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 7h.01M15 7h.01M9 11h.01M15 11h.01M9 15h.01M15 15h.01"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h6"/></svg>',
  paperclip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 1 1 4.95 4.95L9.6 18.66a2 2 0 0 1-2.83-2.83l8.49-8.49"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
  bellOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.7 21a2 2 0 0 1-3.4 0"/><path d="M18.6 13.4A8.6 8.6 0 0 0 19 11a7 7 0 0 0-11.9-5"/><path d="M6 8v3c0 3.5-1.5 5-3 6h13"/><path d="M2 2l20 20"/></svg>',
};

/* ---- toast ---------------------------------------------------------------- */

function toast(msg, type) {
  let host = document.getElementById('toasts');
  if (!host) {
    host = document.createElement('div');
    host.id = 'toasts';
    document.body.appendChild(host);
  }
  const el = document.createElement('div');
  el.className = 'toast' + (type ? ' toast-' + type : '');
  const icon = type === 'error' ? ICONS.alert : type === 'success' ? ICONS.check : ICONS.info;
  el.innerHTML = icon + '<span>' + esc(msg) + '</span>';
  host.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s, transform .3s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(8px)';
    setTimeout(() => el.remove(), 300);
  }, 2600);
}

/* ---- misc ----------------------------------------------------------------- */

const STATUS_BADGE = {
  Scheduled: 'badge-blue',
  Live: 'badge-live',
  Delayed: 'badge-amber',
  Concluded: 'badge-gray',
};

const CATEGORY_BADGE = {
  Announcement: 'badge-blue',
  Alert: 'badge-red',
  Operations: 'badge-gray',
  Transport: 'badge-green',
  Catering: 'badge-amber',
};

/* ---- dynamic categories (managed via the admin panel) --------------------- */

let CATEGORIES = [];

async function loadCategories() {
  try { CATEGORIES = await API.get('/categories'); } catch (e) { /* keep last */ }
  return CATEGORIES;
}

/** Colour for a category name; falls back to a neutral grey. */
function categoryColor(name) {
  const c = CATEGORIES.find((x) => x.name === name);
  return (c && c.color) || '#5c6a7e';
}

/** Render a category chip tinted with the category's own colour. */
function catBadge(name) {
  const color = categoryColor(name);
  return `<span class="badge cat-badge" style="color:${esc(color)};background:${esc(color)}1f;border-color:${esc(color)}3d">${esc(name)}</span>`;
}

/* ---- theme / design (managed via the admin panel) ------------------------- */

const THEME_FONTS = [
  { name: 'IBM Plex Sans', google: 'IBM+Plex+Sans:wght@400;500;600;700' },
  { name: 'Inter', google: 'Inter:wght@400;500;600;700' },
  { name: 'Poppins', google: 'Poppins:wght@400;500;600;700' },
  { name: 'Montserrat', google: 'Montserrat:wght@400;500;600;700' },
  { name: 'Roboto', google: 'Roboto:wght@400;500;700' },
  { name: 'System', google: null },
];

let THEME = {};

function isHex(v) { return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v); }
function _hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function _hex(r, g, b) { return '#' + [r, g, b].map((x) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')).join(''); }
function mixHex(hex, target, amt) { const a = _hexRgb(hex), b = _hexRgb(target); return _hex(a[0] + (b[0] - a[0]) * amt, a[1] + (b[1] - a[1]) * amt, a[2] + (b[2] - a[2]) * amt); }

/** Lazily load a Google web font for the chosen family. */
function ensureFont(name) {
  const f = THEME_FONTS.find((x) => x.name === name);
  if (!f || !f.google) return;
  const id = 'font-' + name.replace(/\s+/g, '-');
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id; link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=' + f.google + '&display=swap';
  document.head.appendChild(link);
}

/** Apply theme overrides to CSS variables + page background. Empty fields are ignored. */
function applyTheme(t) {
  t = t || {};
  const s = document.documentElement.style;
  if (isHex(t.brandColor)) {
    s.setProperty('--brand', t.brandColor);
    s.setProperty('--brand-2', mixHex(t.brandColor, '#ffffff', 0.16));
  }
  if (isHex(t.accentColor)) {
    s.setProperty('--accent', t.accentColor);
    s.setProperty('--accent-press', mixHex(t.accentColor, '#000000', 0.14));
    s.setProperty('--accent-soft', mixHex(t.accentColor, '#ffffff', 0.88));
  }
  if (t.font === 'System') s.setProperty('--font', "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif");
  else if (t.font) { ensureFont(t.font); s.setProperty('--font', "'" + t.font + "', system-ui, -apple-system, sans-serif"); }
  if (isHex(t.bgColor)) s.setProperty('--bg', t.bgColor);
  if (document.body) {
    if (t.background) {
      document.body.style.backgroundImage = 'linear-gradient(rgba(255,255,255,.78),rgba(255,255,255,.78)), url("' + t.background + '")';
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
    } else {
      document.body.style.backgroundImage = '';
    }
  }
}

/** Replace the brand mark with a logo image (if provided). */
function applyLogo(logo) {
  const mark = document.getElementById('brand-mark');
  if (!mark || !logo) return;
  mark.innerHTML = '<img src="' + logo + '" alt="logo" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">';
  mark.style.background = 'none';
  mark.style.boxShadow = 'none';
}

async function loadTheme() {
  try { THEME = (await API.get('/theme')) || {}; } catch (e) { THEME = {}; }
  applyTheme(THEME);
  return THEME;
}
