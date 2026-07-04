'use strict';

/* =============================================================================
   Admin & Catering dashboard
     • Overview   — counters, charts, CSV export, auto-refreshing live feed
     • Redeemer   — catering staff: scan QR / type ID to validate & redeem
     • Venues     — add / edit / delete tournament venues (drives allocation)
     • News       — add / edit / delete news items
     • Press      — add / edit / delete press conferences
   Protected by a shared admin key (sent as the x-admin-key header).
   ========================================================================== */

const ADMIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'redeem', label: 'Redeemer' },
  { id: 'venues', label: 'Venues' },
  { id: 'news', label: 'News' },
  { id: 'categories', label: 'Categories' },
  { id: 'press', label: 'Press' },
  { id: 'transport', label: 'Transport' },
  { id: 'apptabs', label: 'App Tabs' },
  { id: 'design', label: 'Design' },
  { id: 'reset', label: 'Reset' },
];
const NEWS_CATS = ['Announcement', 'Alert', 'Operations', 'Transport', 'Catering'];
const PC_STATUS = ['Scheduled', 'Live', 'Delayed', 'Concluded'];
const PC_ROOMS = ['PC Room 1', 'PC Room 2', 'Main Auditorium', 'Mixed Zone'];
const VENUE_TYPES = [
  { v: 'MMC', label: 'Main Media Centre' },
  { v: 'Stadium', label: 'Stadium' },
  { v: 'Training', label: 'Training Site' },
];
const VENUE_TYPE_LABEL = { MMC: 'Main Media Centre', Stadium: 'Stadium', Training: 'Training Site' };
const TRANSPORT_TYPES = [
  { v: 'Stadium', label: 'Stadium shuttle' },
  { v: 'Training', label: 'Training-site shuttle' },
];

const adminState = {
  tab: 'overview',
  analytics: null,
  news: [],
  press: [],
  venues: [],
  transport: [],
  categories: [],
  appTabs: [],
  theme: null,
  pollTimer: null,
  scanner: null, // { stream, video, timer }
};

const view = () => document.getElementById('view');

/* ---- tiny local view helpers (app.js is not loaded here) ------------------ */
function loadingHtml() { return `<div class="loading"><div class="spinner"></div>Loading…</div>`; }
function errorHtml(msg) { return `<div class="alert alert-error">${ICONS.alert}<div>${esc(msg)}</div></div>`; }
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }

/* ---- shell ---------------------------------------------------------------- */

function init() {
  document.getElementById('brand-mark').innerHTML = ICONS.dash;
  document.getElementById('client-link').innerHTML = ICONS.back + '<span>Client App</span>';

  const logout = document.getElementById('logout-btn');
  logout.innerHTML = ICONS.logout + '<span>Lock</span>';
  logout.addEventListener('click', () => { Admin.clear(); teardownTransients(); showLogin(); });

  startClock();

  // Apply saved branding to the admin shell too (colours, font, logo, bg).
  loadTheme().then(() => applyLogo(THEME.logo));

  if (Admin.key()) showDashboard();
  else showLogin();
}

function startClock() {
  const el = document.getElementById('clock');
  const tick = () => { el.textContent = fmtClock(new Date()); };
  tick();
  setInterval(tick, 1000);
}

/* ---- login gate ----------------------------------------------------------- */

function showLogin(err) {
  teardownTransients();
  document.getElementById('logout-btn').style.display = 'none';
  view().innerHTML = `
    <div class="login-wrap">
      <div class="card login-card">
        <div class="login-icon">${ICONS.lock}</div>
        <h1>Admin access</h1>
        <p>Enter your admin or volunteer key. Admin keys unlock the full dashboard; volunteer keys unlock the voucher redeemer only.</p>
        ${err ? `<div class="alert alert-error" style="text-align:left">${ICONS.alert}<div>${esc(err)}</div></div>` : ''}
        <div class="field"><input class="input" id="login-key" type="password" placeholder="Admin or volunteer key" autocomplete="current-password"></div>
        <button class="btn btn-primary btn-block" id="login-btn">${ICONS.lock}<span>Unlock dashboard</span></button>
      </div>
    </div>`;

  const submit = async () => {
    const key = document.getElementById('login-key').value;
    if (!key) return;
    try {
      const r = await API.post('/admin/login', { key });
      Admin.setKey(key);
      Admin.setRole(r.role || 'admin');
      if (Admin.isVolunteer()) adminState.tab = 'redeem';
      showDashboard();
    } catch (e) {
      showLogin('Incorrect key. Please try again.');
    }
  };
  document.getElementById('login-btn').addEventListener('click', submit);
  const input = document.getElementById('login-key');
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
  input.focus();
}

function visibleTabs() {
  return Admin.isVolunteer() ? ADMIN_TABS.filter((t) => t.id === 'redeem') : ADMIN_TABS;
}

function showDashboard() {
  document.getElementById('logout-btn').style.display = '';
  if (Admin.isVolunteer()) adminState.tab = 'redeem';
  const tabs = visibleTabs();
  view().innerHTML = `
    <div class="admin-tabs" id="admin-tabs">
      ${tabs.map((t) => `<button data-atab="${t.id}" class="${t.id === adminState.tab ? 'active' : ''}">${t.label}</button>`).join('')}
    </div>
    <div id="panel"></div>`;
  document.getElementById('admin-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-atab]');
    if (b) setTab(b.dataset.atab);
  });
  renderPanel();
}

function setTab(tab) {
  if (!visibleTabs().some((t) => t.id === tab)) return;
  adminState.tab = tab;
  teardownTransients();
  $all('[data-atab]').forEach((b) => b.classList.toggle('active', b.dataset.atab === tab));
  renderPanel();
}

/** Stop anything tab-specific (polling, camera) when leaving a tab. */
function teardownTransients() {
  stopPolling();
  stopScanner();
}

function renderPanel() {
  if (adminState.tab === 'overview') return renderOverview();
  if (adminState.tab === 'redeem') return renderRedeemer();
  if (adminState.tab === 'venues') return renderVenuesMgr();
  if (adminState.tab === 'news') return renderNewsMgr();
  if (adminState.tab === 'categories') return renderCategoriesMgr();
  if (adminState.tab === 'press') return renderPressMgr();
  if (adminState.tab === 'transport') return renderTransportMgr();
  if (adminState.tab === 'apptabs') return renderAppTabsMgr();
  if (adminState.tab === 'design') return renderDesignMgr();
  if (adminState.tab === 'reset') return renderResetMgr();
}

function handleAdminErr(e) {
  if (e.status === 401) {
    Admin.clear();
    showLogin('Session expired — please re-enter the admin key.');
  } else {
    toast(e.message || 'Something went wrong.', 'error');
  }
}

/* =============================================================================
   OVERVIEW — analytics + live feed + CSV export
   ========================================================================== */

async function renderOverview() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head">
      <h2>Analytics &amp; live monitoring</h2>
      <div class="head-actions">
        <span class="refresh-flag"><span class="dot"></span>Auto-refreshing every 5s</span>
        <a class="btn btn-ghost btn-sm" href="/share" target="_blank" rel="noopener">${ICONS.scan}<span>Share QR</span></a>
        <button class="btn btn-ghost btn-sm" id="ov-export">${ICONS.download}<span>Export CSV</span></button>
      </div>
    </div>
    <div id="ov-body">${loadingHtml()}</div>`;
  document.getElementById('ov-export').addEventListener('click', exportCsv);
  await refreshOverview();
  startPolling();
}

async function exportCsv() {
  // Fetch with the admin key in a header (R-6 — never in the URL), then save the
  // returned CSV as a Blob download.
  toast('Exporting voucher log…', 'success');
  try {
    const res = await fetch('/api/admin/export.csv', { headers: { 'x-admin-key': Admin.key() } });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `voucher-log-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    toast(e.message || 'Export failed', 'error');
  }
}

async function refreshOverview() {
  let a;
  try {
    a = await API.get('/analytics', true);
  } catch (e) {
    if (e.status === 401) { Admin.clear(); showLogin('Session expired — please re-enter the admin key.'); return; }
    const body = document.getElementById('ov-body');
    if (body) body.innerHTML = errorHtml(e.message);
    return;
  }
  adminState.analytics = a;
  const body = document.getElementById('ov-body');
  if (body) body.innerHTML = overviewHtml(a);
}

function overviewHtml(a) {
  const m = a.byMeal || {};
  const t = a.byType || {};
  const mealMax = Math.max(1, m.Lunch || 0, m.Dinner || 0, m.Meal || 0);
  const typeMax = Math.max(1, t.MMC || 0, t.Training || 0, t.Stadium || 0);
  const venues = Object.entries(a.byLocation || {}).sort((x, y) => y[1] - x[1]);
  const venueMax = Math.max(1, ...venues.map((v) => v[1]));
  const redeemRate = a.issuedToday ? Math.round((a.redeemedToday / a.issuedToday) * 100) : 0;

  return `
    <div class="metrics">
      ${metric(ICONS.ticket, '', a.issuedToday, 'Issued today', `${a.total} all-time`)}
      ${metric(ICONS.checkCircle, 'accent-green', a.redeemedToday, 'Redeemed today', `${redeemRate}% of today’s`)}
      ${metric(ICONS.users, 'accent-purple', a.uniqueUsers, 'Registered media', 'unique emails')}
      ${metric(ICONS.building, 'accent-amber', a.stadiumMeals || 0, 'Stadium café meals', 'all-time')}
    </div>

    <div class="chart-row">
      <div class="card card-pad chart">
        <h3>Vouchers by meal type</h3>
        ${bar('Lunch', m.Lunch || 0, mealMax, 'c-blue')}
        ${bar('Dinner', m.Dinner || 0, mealMax, 'c-navy')}
        ${bar('Stadium meal', m.Meal || 0, mealMax, 'c-purple')}
      </div>
      <div class="card card-pad chart">
        <h3>Requests by location type</h3>
        ${bar('Main Media Centre', t.MMC || 0, typeMax, 'c-blue')}
        ${bar('Training sites', t.Training || 0, typeMax, 'c-green')}
        ${bar('Stadiums', t.Stadium || 0, typeMax, 'c-purple')}
      </div>
    </div>

    <div class="card card-pad chart" style="margin-top:14px">
      <h3>Breakdown by venue</h3>
      ${venues.length ? venues.map((v) => bar(v[0], v[1], venueMax, 'c-navy')).join('') : '<div class="muted">No vouchers issued yet.</div>'}
    </div>

    <div class="section-label">Live voucher feed</div>
    <div class="card feed">
      ${a.recent && a.recent.length ? a.recent.map(feedItem).join('') : '<div class="empty" style="padding:28px">No vouchers issued yet.</div>'}
    </div>

    ${a.audit && a.audit.length ? `
    <div class="section-label">Admin activity</div>
    <div class="card feed">${a.audit.map(auditItem).join('')}</div>` : ''}`;
}

const AUDIT_LABEL = {
  'reset-vouchers': 'Voucher reset',
  'tab-added': 'Tab added',
  'tab-updated': 'Tab updated',
  'tab-removed': 'Tab removed',
};

function auditItem(e) {
  const danger = e.action === 'reset-vouchers';
  return `<div class="feed-item">
    <div class="feed-dot ${danger ? 't-Stadium' : 't-MMC'}">${danger ? '!' : '⚙'}</div>
    <div class="feed-main">
      <div class="f-email">${esc(AUDIT_LABEL[e.action] || e.action)} · ${esc(e.actor || 'admin')}</div>
      <div class="f-meta">${esc(e.detail || '')}</div>
    </div>
    <div class="feed-right"><div class="feed-time">${esc(fmtDateTime(e.at))}</div></div>
  </div>`;
}

function metric(icon, cls, value, label, sub) {
  return `<div class="card metric ${cls}">
    <div class="m-icon">${icon}</div>
    <div class="m-value">${esc(value)}</div>
    <div class="m-label">${esc(label)}</div>
    <div class="m-sub">${esc(sub)}</div>
  </div>`;
}

function bar(label, valNum, max, cls) {
  const pct = Math.round((valNum / max) * 100);
  return `<div class="bar">
    <div class="bar-top"><span>${esc(label)}</span><span class="b-val">${esc(valNum)}</span></div>
    <div class="bar-track"><div class="bar-fill ${cls}" style="width:${pct}%"></div></div>
  </div>`;
}

function feedItem(v) {
  const ab = v.locationType === 'Stadium' ? 'STD' : v.locationType === 'Training' ? 'TRN' : 'MMC';
  const meal = v.mealType === 'Meal' ? 'Media Café' : v.mealType;
  const redeemed = v.status === 'Redeemed';
  const statusBadge = redeemed
    ? `<span class="feed-status redeemed">${ICONS.check} Redeemed ${esc(fmtTime(v.redeemedAt))}</span>`
    : v.status === 'Expired'
      ? `<span class="feed-status expired">Expired</span>`
      : `<span class="feed-status pending">Pending</span>`;
  return `<div class="feed-item">
    <div class="feed-dot t-${esc(v.locationType)}">${ab}</div>
    <div class="feed-main">
      <div class="f-email">${esc(v.email)}</div>
      <div class="f-meta">${esc(meal)} · ${esc(v.locationName)} · <span class="mono">${esc(v.id)}</span></div>
    </div>
    <div class="feed-right">
      ${statusBadge}
      <div class="feed-time">${esc(fmtTime(v.issuedAt))}</div>
    </div>
  </div>`;
}

function startPolling() {
  stopPolling();
  adminState.pollTimer = setInterval(() => {
    if (adminState.tab === 'overview') refreshOverview();
  }, 5000);
}
function stopPolling() {
  if (adminState.pollTimer) { clearInterval(adminState.pollTimer); adminState.pollTimer = null; }
}

/* =============================================================================
   REDEEMER — catering staff scan / manual entry
   ========================================================================== */

function renderRedeemer() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head"><h2>Catering — voucher redeemer</h2></div>
    <div class="redeem-grid">
      <div class="card card-pad redeem-input-card">
        <label class="redeem-label" for="rd-id">Voucher ID</label>
        <div class="redeem-row">
          <input class="input redeem-id" id="rd-id" type="text" autocomplete="off" autocapitalize="characters"
                 spellcheck="false" placeholder="e.g. MV-7F3K9Q">
          <button class="btn btn-primary" id="rd-go">${ICONS.check}<span>Validate</span></button>
        </div>
        <div class="redeem-or"><span>or</span></div>
        <button class="btn btn-ghost btn-block" id="rd-scan">${ICONS.camera}<span>Scan QR with camera</span></button>
        <div id="rd-scanner" class="scanner hidden">
          <video id="rd-video" playsinline muted></video>
          <div class="scanner-frame"></div>
          <button class="btn btn-ghost btn-sm scanner-stop" id="rd-stop">Stop camera</button>
        </div>
        <p class="redeem-hint">${ICONS.info}<span>Point any phone or laptop camera at the voucher QR to scan it — works across browsers. You can always type the ID by hand.</span></p>
      </div>
      <div class="card redeem-result-card" id="rd-result">
        <div class="redeem-idle">${ICONS.scan}<div>Scan or enter a voucher to begin.</div></div>
      </div>
    </div>`;

  document.getElementById('rd-go').addEventListener('click', () => {
    const id = val('rd-id').trim();
    if (id) doRedeem(id);
    else toast('Enter a voucher ID first.', 'error');
  });
  document.getElementById('rd-id').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const id = e.target.value.trim(); if (id) doRedeem(id); }
  });
  document.getElementById('rd-scan').addEventListener('click', startScanner);
  document.getElementById('rd-stop').addEventListener('click', stopScanner);
  document.getElementById('rd-id').focus();
}

async function doRedeem(rawId) {
  const id = String(rawId).trim();
  const resultEl = document.getElementById('rd-result');
  if (resultEl) resultEl.innerHTML = `<div class="redeem-idle">${loadingHtml()}</div>`;
  try {
    const r = await API.post('/admin/redeem', { voucherId: id }, true);
    buzz([40, 30, 40]);
    showRedeemResult('success', r.voucher);
  } catch (e) {
    if (e.status === 401) { handleAdminErr(e); return; }
    buzz([120]);
    const v = e.data && e.data.voucher;
    if (e.code === 'ALREADY_REDEEMED') showRedeemResult('already', v, e.data && e.data.redeemedAt);
    else if (e.code === 'EXPIRED') showRedeemResult('expired', v);
    else showRedeemResult('invalid', null, null, id, e.message);
  }
  const input = document.getElementById('rd-id');
  if (input) { input.value = ''; input.focus(); }
}

function buzz(pattern) { try { if (navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* ignore */ } }

function showRedeemResult(kind, v, redeemedAt, triedId, message) {
  const el = document.getElementById('rd-result');
  if (!el) return;
  const details = v ? `
    <div class="rr-details">
      <div class="rr-row"><span>Meal</span><strong>${esc(v.mealType === 'Meal' ? 'Media Café Meal' : v.mealType)}</strong></div>
      <div class="rr-row"><span>Location</span><strong>${esc(v.locationName)}</strong></div>
      <div class="rr-row"><span>Media member</span><strong>${esc(v.email)}</strong></div>
      <div class="rr-row"><span>Voucher</span><strong class="mono">${esc(v.id)}</strong></div>
    </div>` : '';

  if (kind === 'success') {
    el.className = 'card redeem-result-card state-success';
    el.innerHTML = `
      <div class="rr-banner">${ICONS.checkCircle}<div class="rr-headline">SUCCESS — MEAL VALID</div></div>
      ${details}
      <div class="rr-foot">Redeemed just now · ${esc(fmtDateTime(v.redeemedAt || new Date().toISOString()))}</div>
      <button class="btn btn-ghost btn-block" id="rr-next">${ICONS.scan}<span>Next voucher</span></button>`;
  } else if (kind === 'already') {
    el.className = 'card redeem-result-card state-danger';
    el.innerHTML = `
      <div class="rr-banner">${ICONS.ban}<div class="rr-headline">WARNING — ALREADY REDEEMED</div></div>
      ${details}
      <div class="rr-foot">Originally redeemed ${esc(fmtDateTime(redeemedAt || (v && v.redeemedAt)))}</div>
      <button class="btn btn-ghost btn-block" id="rr-next">${ICONS.scan}<span>Next voucher</span></button>`;
  } else if (kind === 'expired') {
    el.className = 'card redeem-result-card state-warn';
    el.innerHTML = `
      <div class="rr-banner">${ICONS.alert}<div class="rr-headline">EXPIRED VOUCHER</div></div>
      ${details}
      <div class="rr-foot">This voucher was not used on its valid day.</div>
      <button class="btn btn-ghost btn-block" id="rr-next">${ICONS.scan}<span>Next voucher</span></button>`;
  } else {
    el.className = 'card redeem-result-card state-danger';
    el.innerHTML = `
      <div class="rr-banner">${ICONS.ban}<div class="rr-headline">INVALID VOUCHER</div></div>
      <div class="rr-foot">${esc(message || 'No matching voucher found.')}${triedId ? ` (“${esc(triedId)}”)` : ''}</div>
      <button class="btn btn-ghost btn-block" id="rr-next">${ICONS.scan}<span>Try again</span></button>`;
  }
  const next = document.getElementById('rr-next');
  if (next) next.addEventListener('click', () => {
    el.className = 'card redeem-result-card';
    el.innerHTML = `<div class="redeem-idle">${ICONS.scan}<div>Scan or enter a voucher to begin.</div></div>`;
    const input = document.getElementById('rd-id');
    if (input) input.focus();
  });

  // Refresh analytics in the background so counters stay in sync.
  if (kind === 'success') API.get('/analytics', true).then((a) => { adminState.analytics = a; }).catch(() => {});
}

/* ---- camera QR scanning (BarcodeDetector) --------------------------------- */

async function startScanner() {
  const wrap = document.getElementById('rd-scanner');
  if (!wrap) return;

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    toast('No camera available here — please type the voucher ID.', 'error');
    return;
  }
  // Native detector (Chromium) is fastest; jsQR is the cross-browser fallback
  // (iPhone Safari, Firefox, desktop Safari…). One of them will be present.
  const hasNative = 'BarcodeDetector' in window;
  if (!hasNative && typeof window.jsQR !== 'function') {
    toast('QR scanning couldn’t load — please type the voucher ID.', 'error');
    return;
  }

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
  } catch (e) {
    toast('Camera permission denied. You can still type the ID.', 'error');
    return;
  }

  const video = document.getElementById('rd-video');
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play().catch(() => {});
  wrap.classList.remove('hidden');

  let detector = null;
  if (hasNative) {
    try { detector = new window.BarcodeDetector({ formats: ['qr_code'] }); }
    catch (e) { try { detector = new window.BarcodeDetector(); } catch (e2) { detector = null; } }
  }
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  const timer = setInterval(async () => {
    if (!adminState.scanner) return;
    const v = adminState.scanner.video;
    if (!v || !v.videoWidth) return;
    let value = '';
    try {
      if (detector) {
        const codes = await detector.detect(v);
        if (codes && codes.length) value = codes[0].rawValue || '';
      } else if (window.jsQR) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' });
        if (code && code.data) value = code.data;
      }
    } catch (e) { /* transient frame error — keep trying */ }
    if (value) { stopScanner(); doRedeem(value); }
  }, 300);

  adminState.scanner = { stream, video, timer };
}

function stopScanner() {
  const s = adminState.scanner;
  if (s) {
    clearInterval(s.timer);
    if (s.stream) s.stream.getTracks().forEach((t) => t.stop());
    if (s.video) s.video.srcObject = null;
    adminState.scanner = null;
  }
  const wrap = document.getElementById('rd-scanner');
  if (wrap) wrap.classList.add('hidden');
}

/* =============================================================================
   VENUE MANAGER (CMS)
   ========================================================================== */

async function renderVenuesMgr() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head">
      <h2>Venue manager</h2>
      <button class="btn btn-primary btn-sm" id="ven-add">${ICONS.plus}<span>Add venue</span></button>
    </div>
    <p class="mgr-note">${ICONS.info}<span>A venue’s <strong>type</strong> drives the allocation rules: Media Centres allow 1 Lunch + 1 Dinner per day; Stadiums allow 1 Media Café meal per day; Training Sites have <strong>no meal vouchers</strong> (transport &amp; info only).</span></p>
    <div id="ven-editor"></div>
    <div class="card" id="ven-list">${loadingHtml()}</div>`;
  document.getElementById('ven-add').addEventListener('click', () => openVenueEditor(null));
  await loadVenues();
}

async function loadVenues() {
  try { adminState.venues = await API.get('/locations'); }
  catch (e) { const el = document.getElementById('ven-list'); if (el) el.innerHTML = errorHtml(e.message); return; }
  renderVenueList();
}

function venueBadge(type) {
  const cls = type === 'Stadium' ? 'badge-purple' : type === 'Training' ? 'badge-green' : 'badge-blue';
  return `<span class="badge ${cls}">${esc(VENUE_TYPE_LABEL[type] || type)}</span>`;
}

function renderVenueList() {
  const el = document.getElementById('ven-list');
  if (!el) return;
  const list = adminState.venues;
  if (!list.length) { el.innerHTML = '<div class="empty" style="padding:28px">No venues yet. Add your first venue.</div>'; return; }
  el.innerHTML = list.map((l) => `
    <div class="mgr-item">
      <div class="mgr-main">
        <div class="mgr-title">${venueBadge(l.type)}<span>${esc(l.name)}</span></div>
        <div class="mgr-sub">${esc(l.zone || '—')} · ${esc(l.window || 'no window set')} · meals: ${esc((l.allowedMeals || []).join(', ') || '—')}</div>
      </div>
      <div class="mgr-actions">
        <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${esc(l.id)}">${ICONS.edit}</button>
        <button class="btn btn-danger btn-icon" title="Delete" data-del="${esc(l.id)}">${ICONS.trash}</button>
      </div>
    </div>`).join('');
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openVenueEditor(adminState.venues.find((l) => l.id === b.dataset.edit))));
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteVenue(b.dataset.del)));
}

function openVenueEditor(item) {
  const ed = document.getElementById('ven-editor');
  const it = item || { name: '', type: 'MMC', zone: '', window: '' };
  ed.innerHTML = `
    <div class="editor">
      <div class="field"><label>Venue name</label>
        <input class="input" id="ven-name" value="${esc(it.name)}" placeholder="e.g. Main Media Centre"></div>
      <div class="row2">
        <div class="field"><label>Type</label>
          <select class="select" id="ven-type">${VENUE_TYPES.map((t) => `<option value="${t.v}" ${t.v === it.type ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
        <div class="field"><label>Zone</label>
          <input class="input" id="ven-zone" value="${esc(it.zone || '')}" placeholder="e.g. Riyadh — North"></div>
      </div>
      <div class="field"><label>Service window</label>
        <input class="input" id="ven-window" value="${esc(it.window || '')}" placeholder="e.g. 08:00 – 23:00 or Match windows"></div>
      <div class="editor-actions">
        <button class="btn btn-ghost btn-sm" id="ven-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="ven-save">${ICONS.check}<span>${item ? 'Save changes' : 'Add venue'}</span></button>
      </div>
    </div>`;
  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('ven-cancel').addEventListener('click', () => { ed.innerHTML = ''; });
  document.getElementById('ven-save').addEventListener('click', () => saveVenue(item ? item.id : null));
  document.getElementById('ven-name').focus();
}

async function saveVenue(id) {
  const payload = {
    name: val('ven-name').trim(),
    type: val('ven-type'),
    zone: val('ven-zone').trim(),
    window: val('ven-window').trim(),
  };
  if (!payload.name) { toast('Please enter a venue name.', 'error'); return; }
  try {
    if (id) await API.put('/locations/' + id, payload, true);
    else await API.post('/locations', payload, true);
    document.getElementById('ven-editor').innerHTML = '';
    toast(id ? 'Venue saved.' : 'Venue added.', 'success');
    await loadVenues();
  } catch (e) { handleAdminErr(e); }
}

async function deleteVenue(id) {
  if (!confirm('Delete this venue? It will no longer appear in the client app. Existing vouchers are kept for reporting.')) return;
  try { await API.del('/locations/' + id, true); toast('Venue deleted.', 'success'); await loadVenues(); }
  catch (e) { handleAdminErr(e); }
}

/* =============================================================================
   NEWS MANAGER
   ========================================================================== */

async function renderNewsMgr() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head">
      <h2>News manager</h2>
      <button class="btn btn-primary btn-sm" id="news-add">${ICONS.plus}<span>Add update</span></button>
    </div>
    <div id="news-editor"></div>
    <div class="card" id="news-list">${loadingHtml()}</div>`;
  document.getElementById('news-add').addEventListener('click', () => openNewsEditor(null));
  await loadNews();
}

async function loadNews() {
  try {
    await loadCategories(); // populate the category picker + feed badge colours
    adminState.news = await API.get('/news');
  }
  catch (e) { const el = document.getElementById('news-list'); if (el) el.innerHTML = errorHtml(e.message); return; }
  renderNewsList();
}

function renderNewsList() {
  const el = document.getElementById('news-list');
  if (!el) return;
  const list = adminState.news;
  if (!list.length) { el.innerHTML = '<div class="empty" style="padding:28px">No news items yet.</div>'; return; }
  el.innerHTML = list.map((n) => {
    return `<div class="mgr-item">
      <div class="mgr-main">
        <div class="mgr-title">
          ${catBadge(n.category)}
          ${n.pinned ? '<span class="badge badge-amber">Pinned</span>' : ''}
          <span>${esc(n.title)}</span>
        </div>
        <div class="mgr-body">${esc(n.body)}</div>
        <div class="mgr-sub">${esc(relTime(n.timestamp))}${n.attachments && n.attachments.length ? ` · <span class="att-count">${ICONS.paperclip} ${n.attachments.length}</span>` : ''}</div>
      </div>
      <div class="mgr-actions">
        <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${esc(n.id)}">${ICONS.edit}</button>
        <button class="btn btn-danger btn-icon" title="Delete" data-del="${esc(n.id)}">${ICONS.trash}</button>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openNewsEditor(adminState.news.find((n) => n.id === b.dataset.edit))));
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteNews(b.dataset.del)));
}

// Working set of attachments for the currently-open news editor.
let neAttachments = [];

function readFileAsDataURL(file) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(file); });
}

function renderNeAttachments() {
  const el = document.getElementById('ne-att-list');
  if (!el) return;
  el.innerHTML = neAttachments.map((a, i) => {
    const isImg = a.type && a.type.indexOf('image/') === 0;
    const thumb = isImg ? `<img src="${a.dataUrl}" alt="">` : ICONS.file;
    return `<div class="att-chip"><span class="att-chip-thumb">${thumb}</span><span class="att-chip-name">${esc(a.name)}</span><button type="button" class="att-chip-x" data-rm="${i}" title="Remove">${ICONS.close}</button></div>`;
  }).join('');
  el.querySelectorAll('[data-rm]').forEach((b) =>
    b.addEventListener('click', () => { neAttachments.splice(Number(b.dataset.rm), 1); renderNeAttachments(); }));
}

async function onNeFiles(e) {
  const files = Array.from(e.target.files || []);
  for (const f of files) {
    if (neAttachments.length >= 4) { toast('Up to 4 attachments per post.', 'error'); break; }
    if (f.size > 3 * 1024 * 1024) { toast(`“${f.name}” is too large (max 3 MB).`, 'error'); continue; }
    try {
      const dataUrl = await readFileAsDataURL(f);
      neAttachments.push({ name: f.name, type: f.type || 'application/octet-stream', dataUrl });
    } catch (err) { toast(`Could not read “${f.name}”.`, 'error'); }
  }
  e.target.value = '';
  renderNeAttachments();
}

function openNewsEditor(item) {
  const ed = document.getElementById('news-editor');
  const it = item || { title: '', body: '', category: (CATEGORIES[0] && CATEGORIES[0].name) || 'Announcement', pinned: false };
  neAttachments = (item && Array.isArray(item.attachments)) ? item.attachments.slice() : [];
  // Category options come from the managed list; keep the item's own value even
  // if its category was later deleted.
  const catNames = CATEGORIES.length ? CATEGORIES.map((c) => c.name) : NEWS_CATS.slice();
  if (it.category && !catNames.includes(it.category)) catNames.unshift(it.category);
  ed.innerHTML = `
    <div class="editor">
      <div class="field"><label>Title</label>
        <input class="input" id="ne-title" value="${esc(it.title)}" placeholder="Headline"></div>
      <div class="row2">
        <div class="field"><label>Category</label>
          <select class="select" id="ne-cat">${catNames.map((c) => `<option ${c === it.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label>Visibility</label>
          <div class="check-row"><input type="checkbox" id="ne-pin" ${it.pinned ? 'checked' : ''}><label for="ne-pin">Pin to top of feed</label></div></div>
      </div>
      <div class="field"><label>Body</label>
        <textarea class="textarea" id="ne-body" placeholder="Update details…">${esc(it.body)}</textarea></div>
      <div class="field"><label>Attachments <span class="hint">— images or PDF · up to 4 · max 3 MB each</span></label>
        <div class="att-editor">
          <div class="att-list" id="ne-att-list"></div>
          <label class="btn btn-ghost btn-sm att-add">${ICONS.paperclip}<span>Add files</span>
            <input type="file" id="ne-att-input" accept="image/png,image/jpeg,image/gif,image/webp,application/pdf" multiple hidden>
          </label>
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn btn-ghost btn-sm" id="ne-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="ne-save">${ICONS.check}<span>${item ? 'Save changes' : 'Publish update'}</span></button>
      </div>
    </div>`;
  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  renderNeAttachments();
  document.getElementById('ne-att-input').addEventListener('change', onNeFiles);
  document.getElementById('ne-cancel').addEventListener('click', () => { ed.innerHTML = ''; });
  document.getElementById('ne-save').addEventListener('click', () => saveNews(item ? item.id : null));
  document.getElementById('ne-title').focus();
}

async function saveNews(id) {
  const payload = {
    title: val('ne-title').trim(),
    body: val('ne-body').trim(),
    category: val('ne-cat'),
    pinned: document.getElementById('ne-pin').checked,
    attachments: neAttachments,
  };
  if (!payload.title) { toast('Please enter a title.', 'error'); return; }
  try {
    if (id) await API.put('/news/' + id, payload, true);
    else await API.post('/news', payload, true);
    document.getElementById('news-editor').innerHTML = '';
    toast(id ? 'Update saved.' : 'Update published.', 'success');
    await loadNews();
  } catch (e) { handleAdminErr(e); }
}

async function deleteNews(id) {
  if (!confirm('Delete this news item? This cannot be undone.')) return;
  try { await API.del('/news/' + id, true); toast('Deleted.', 'success'); await loadNews(); }
  catch (e) { handleAdminErr(e); }
}

/* =============================================================================
   PRESS CONFERENCE MANAGER
   ========================================================================== */

async function renderPressMgr() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head">
      <h2>Press conference manager</h2>
      <button class="btn btn-primary btn-sm" id="pc-add">${ICONS.plus}<span>Add conference</span></button>
    </div>
    <div id="pc-editor"></div>
    <div class="card" id="pc-list">${loadingHtml()}</div>`;
  document.getElementById('pc-add').addEventListener('click', () => openPressEditor(null));
  await loadPress();
}

async function loadPress() {
  try { adminState.press = await API.get('/press-conferences'); }
  catch (e) { const el = document.getElementById('pc-list'); if (el) el.innerHTML = errorHtml(e.message); return; }
  renderPressList();
}

function renderPressList() {
  const el = document.getElementById('pc-list');
  if (!el) return;
  const list = adminState.press;
  if (!list.length) { el.innerHTML = '<div class="empty" style="padding:28px">No press conferences yet.</div>'; return; }
  el.innerHTML = list.map((p) => {
    const badge = STATUS_BADGE[p.status] || 'badge-gray';
    return `<div class="mgr-item">
      <div class="mgr-main">
        <div class="mgr-title">
          <span class="badge ${badge}"><span class="dot"></span>${esc(p.status)}</span>
          <span>${esc(p.team)}</span>
        </div>
        <div class="mgr-sub">${esc(dayLabel(p.date))} · ${esc(p.time || '—')} · ${esc(p.room || '')}</div>
        ${p.note ? `<div class="mgr-body">${esc(p.note)}</div>` : ''}
      </div>
      <div class="mgr-actions">
        <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${esc(p.id)}">${ICONS.edit}</button>
        <button class="btn btn-danger btn-icon" title="Delete" data-del="${esc(p.id)}">${ICONS.trash}</button>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openPressEditor(adminState.press.find((p) => p.id === b.dataset.edit))));
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deletePress(b.dataset.del)));
}

function openPressEditor(item) {
  const ed = document.getElementById('pc-editor');
  const it = item || { date: dayStr(0), time: '11:00', team: '', room: 'PC Room 1', status: 'Scheduled', note: '' };
  ed.innerHTML = `
    <div class="editor">
      <div class="row2">
        <div class="field"><label>Date</label><input class="input" id="pe-date" type="date" value="${esc(it.date)}"></div>
        <div class="field"><label>Time</label><input class="input" id="pe-time" type="time" value="${esc(it.time)}"></div>
      </div>
      <div class="field"><label>Team / organisation</label>
        <input class="input" id="pe-team" value="${esc(it.team)}" placeholder="e.g. Japan"></div>
      <div class="row2">
        <div class="field"><label>Room</label>
          <select class="select" id="pe-room">${PC_ROOMS.map((r) => `<option ${r === it.room ? 'selected' : ''}>${r}</option>`).join('')}</select></div>
        <div class="field"><label>Status</label>
          <select class="select" id="pe-status">${PC_STATUS.map((s) => `<option ${s === it.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Notes</label>
        <textarea class="textarea" id="pe-note" placeholder="Speakers, topic, advisories…">${esc(it.note)}</textarea></div>
      <div class="editor-actions">
        <button class="btn btn-ghost btn-sm" id="pe-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="pe-save">${ICONS.check}<span>${item ? 'Save changes' : 'Add conference'}</span></button>
      </div>
    </div>`;
  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('pe-cancel').addEventListener('click', () => { ed.innerHTML = ''; });
  document.getElementById('pe-save').addEventListener('click', () => savePress(item ? item.id : null));
  document.getElementById('pe-team').focus();
}

async function savePress(id) {
  const payload = {
    date: val('pe-date'),
    time: val('pe-time'),
    team: val('pe-team').trim(),
    room: val('pe-room'),
    status: val('pe-status'),
    note: val('pe-note').trim(),
  };
  if (!payload.team) { toast('Please enter a team / organisation.', 'error'); return; }
  if (!payload.date || !payload.time) { toast('Please set a date and time.', 'error'); return; }
  try {
    if (id) await API.put('/press-conferences/' + id, payload, true);
    else await API.post('/press-conferences', payload, true);
    document.getElementById('pc-editor').innerHTML = '';
    toast(id ? 'Conference saved.' : 'Conference added.', 'success');
    await loadPress();
  } catch (e) { handleAdminErr(e); }
}

async function deletePress(id) {
  if (!confirm('Delete this press conference?')) return;
  try { await API.del('/press-conferences/' + id, true); toast('Deleted.', 'success'); await loadPress(); }
  catch (e) { handleAdminErr(e); }
}

/* =============================================================================
   TRANSPORT / SHUTTLE MANAGER
   ========================================================================== */

async function renderTransportMgr() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head">
      <h2>Transport &amp; shuttle manager</h2>
      <button class="btn btn-primary btn-sm" id="tr-add">${ICONS.plus}<span>Add route</span></button>
    </div>
    <p class="mgr-note">${ICONS.info}<span>Routes appear on the client app's <strong>Transport</strong> tab, grouped by type (Stadium / Training-site shuttles).</span></p>
    <div id="tr-editor"></div>
    <div class="card" id="tr-list">${loadingHtml()}</div>`;
  document.getElementById('tr-add').addEventListener('click', () => openTransportEditor(null));
  await loadTransport();
}

async function loadTransport() {
  try { adminState.transport = await API.get('/transport'); }
  catch (e) { const el = document.getElementById('tr-list'); if (el) el.innerHTML = errorHtml(e.message); return; }
  renderTransportList();
}

function renderTransportList() {
  const el = document.getElementById('tr-list');
  if (!el) return;
  const list = adminState.transport;
  if (!list.length) { el.innerHTML = '<div class="empty" style="padding:28px">No shuttle routes yet. Add your first route.</div>'; return; }
  el.innerHTML = list.map((t) => {
    const cls = t.type === 'Training' ? 'badge-green' : 'badge-blue';
    return `<div class="mgr-item">
      <div class="mgr-main">
        <div class="mgr-title"><span class="badge ${cls}">${esc(t.type)}</span><span>${esc(t.route)}</span></div>
        <div class="mgr-sub">${esc(t.frequency || '—')} · first ${esc(t.firstDeparture || '—')} · last ${esc(t.lastDeparture || '—')} · ${esc(t.duration || '—')}</div>
        ${t.notes ? `<div class="mgr-body">${esc(t.notes)}</div>` : ''}
      </div>
      <div class="mgr-actions">
        <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${esc(t.id)}">${ICONS.edit}</button>
        <button class="btn btn-danger btn-icon" title="Delete" data-del="${esc(t.id)}">${ICONS.trash}</button>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openTransportEditor(adminState.transport.find((t) => t.id === b.dataset.edit))));
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteTransport(b.dataset.del)));
}

function openTransportEditor(item) {
  const ed = document.getElementById('tr-editor');
  const it = item || { route: '', type: 'Stadium', from: 'Main Media Centre', to: '', frequency: '', firstDeparture: '', lastDeparture: '', duration: '', notes: '' };
  ed.innerHTML = `
    <div class="editor">
      <div class="field"><label>Route name <span class="hint">— leave blank to auto-build from destination</span></label>
        <input class="input" id="tr-route" value="${esc(it.route)}" placeholder="e.g. MMC ⇄ King Fahd International Stadium"></div>
      <div class="row2">
        <div class="field"><label>Type</label>
          <select class="select" id="tr-type">${TRANSPORT_TYPES.map((t) => `<option value="${t.v}" ${t.v === it.type ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
        <div class="field"><label>Frequency</label>
          <input class="input" id="tr-freq" value="${esc(it.frequency)}" placeholder="e.g. Every 20 min"></div>
      </div>
      <div class="row2">
        <div class="field"><label>From</label><input class="input" id="tr-from" value="${esc(it.from)}" placeholder="Main Media Centre"></div>
        <div class="field"><label>To (destination)</label><input class="input" id="tr-to" value="${esc(it.to)}" placeholder="e.g. King Fahd International Stadium"></div>
      </div>
      <div class="row2">
        <div class="field"><label>First departure</label><input class="input" id="tr-first" value="${esc(it.firstDeparture)}" placeholder="08:00"></div>
        <div class="field"><label>Last departure</label><input class="input" id="tr-last" value="${esc(it.lastDeparture)}" placeholder="23:30"></div>
      </div>
      <div class="field"><label>Duration</label><input class="input" id="tr-duration" value="${esc(it.duration)}" placeholder="~25 min"></div>
      <div class="field"><label>Notes</label><textarea class="textarea" id="tr-notes" placeholder="Boarding bay, advisories…">${esc(it.notes)}</textarea></div>
      <div class="editor-actions">
        <button class="btn btn-ghost btn-sm" id="tr-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="tr-save">${ICONS.check}<span>${item ? 'Save changes' : 'Add route'}</span></button>
      </div>
    </div>`;
  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('tr-cancel').addEventListener('click', () => { ed.innerHTML = ''; });
  document.getElementById('tr-save').addEventListener('click', () => saveTransport(item ? item.id : null));
  document.getElementById('tr-to').focus();
}

async function saveTransport(id) {
  const payload = {
    route: val('tr-route').trim(),
    type: val('tr-type'),
    from: val('tr-from').trim(),
    to: val('tr-to').trim(),
    frequency: val('tr-freq').trim(),
    firstDeparture: val('tr-first').trim(),
    lastDeparture: val('tr-last').trim(),
    duration: val('tr-duration').trim(),
    notes: val('tr-notes').trim(),
  };
  if (!payload.route && !payload.to) { toast('Enter a destination or a route name.', 'error'); return; }
  try {
    if (id) await API.put('/transport/' + id, payload, true);
    else await API.post('/transport', payload, true);
    document.getElementById('tr-editor').innerHTML = '';
    toast(id ? 'Route saved.' : 'Route added.', 'success');
    await loadTransport();
  } catch (e) { handleAdminErr(e); }
}

async function deleteTransport(id) {
  if (!confirm('Delete this shuttle route?')) return;
  try { await API.del('/transport/' + id, true); toast('Deleted.', 'success'); await loadTransport(); }
  catch (e) { handleAdminErr(e); }
}

/* =============================================================================
   CATEGORY MANAGER
   ========================================================================== */

async function renderCategoriesMgr() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head">
      <h2>Category manager</h2>
      <button class="btn btn-primary btn-sm" id="cat-add">${ICONS.plus}<span>Add category</span></button>
    </div>
    <p class="mgr-note">${ICONS.info}<span>Categories tag News posts. Create new ones any time — they show up in the News editor and are colour-coded in the client feed.</span></p>
    <div id="cat-editor"></div>
    <div class="card" id="cat-list">${loadingHtml()}</div>`;
  document.getElementById('cat-add').addEventListener('click', () => openCategoryEditor(null));
  await loadCategoriesAdmin();
}

async function loadCategoriesAdmin() {
  try {
    adminState.categories = await API.get('/categories');
    CATEGORIES = adminState.categories; // keep the shared badge map in sync
  } catch (e) {
    const el = document.getElementById('cat-list'); if (el) el.innerHTML = errorHtml(e.message); return;
  }
  renderCategoryList();
}

function catChip(c) {
  return `<span class="badge cat-badge" style="color:${esc(c.color)};background:${esc(c.color)}1f;border-color:${esc(c.color)}3d">${esc(c.name)}</span>`;
}

function renderCategoryList() {
  const el = document.getElementById('cat-list');
  if (!el) return;
  const list = adminState.categories;
  if (!list.length) { el.innerHTML = '<div class="empty" style="padding:28px">No categories yet. Add your first category.</div>'; return; }
  el.innerHTML = list.map((c) => `
    <div class="mgr-item">
      <div class="mgr-main">
        <div class="mgr-title">${catChip(c)}<span class="mono" style="color:var(--faint);font-size:.8rem">${esc(c.color)}</span></div>
      </div>
      <div class="mgr-actions">
        <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${esc(c.id)}">${ICONS.edit}</button>
        <button class="btn btn-danger btn-icon" title="Delete" data-del="${esc(c.id)}">${ICONS.trash}</button>
      </div>
    </div>`).join('');
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openCategoryEditor(adminState.categories.find((c) => c.id === b.dataset.edit))));
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteCategory(b.dataset.del)));
}

function openCategoryEditor(item) {
  const ed = document.getElementById('cat-editor');
  const it = item || { name: '', color: '#2f6bff' };
  ed.innerHTML = `
    <div class="editor">
      <div class="row2">
        <div class="field"><label>Name</label>
          <input class="input" id="cat-name" value="${esc(it.name)}" placeholder="e.g. Security"></div>
        <div class="field"><label>Colour</label>
          <div class="color-row">
            <input type="color" id="cat-color" value="${esc(it.color || '#2f6bff')}">
            <input class="input mono" id="cat-color-hex" value="${esc(it.color || '#2f6bff')}" placeholder="#2f6bff">
          </div>
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn btn-ghost btn-sm" id="cat-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="cat-save">${ICONS.check}<span>${item ? 'Save changes' : 'Add category'}</span></button>
      </div>
    </div>`;
  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  const picker = document.getElementById('cat-color');
  const hex = document.getElementById('cat-color-hex');
  picker.addEventListener('input', () => { hex.value = picker.value; });
  hex.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value; });
  document.getElementById('cat-cancel').addEventListener('click', () => { ed.innerHTML = ''; });
  document.getElementById('cat-save').addEventListener('click', () => saveCategory(item ? item.id : null));
  document.getElementById('cat-name').focus();
}

async function saveCategory(id) {
  const name = val('cat-name').trim();
  let color = val('cat-color-hex').trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) color = val('cat-color'); // fall back to the picker
  if (!name) { toast('Please enter a category name.', 'error'); return; }
  try {
    if (id) await API.put('/categories/' + id, { name, color }, true);
    else await API.post('/categories', { name, color }, true);
    document.getElementById('cat-editor').innerHTML = '';
    toast(id ? 'Category saved.' : 'Category added.', 'success');
    await loadCategoriesAdmin();
  } catch (e) { handleAdminErr(e); }
}

async function deleteCategory(id) {
  if (!confirm('Delete this category? Existing news keeps its label but loses the colour.')) return;
  try { await API.del('/categories/' + id, true); toast('Category deleted.', 'success'); await loadCategoriesAdmin(); }
  catch (e) { handleAdminErr(e); }
}

/* =============================================================================
   APP TABS — add / customise tabs in the Media Client app
   ========================================================================== */

const TAB_TYPES = [
  { v: 'static', label: 'Static content (HTML)' },
  { v: 'feed', label: 'News feed' },
  { v: 'external-link', label: 'External link' },
];
const TAB_PERMS = [
  { v: 'all', label: 'Everyone' },
  { v: 'admin', label: 'Admins only' },
  { v: 'volunteer', label: 'Volunteers only' },
];
const TAB_TYPE_LABEL = { 'static': 'Static', 'feed': 'Feed', 'external-link': 'Link' };

async function renderAppTabsMgr() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head">
      <h2>Client app tabs</h2>
      <button class="btn btn-primary btn-sm" id="tab-add">${ICONS.plus}<span>Add tab</span></button>
    </div>
    <p class="mgr-note">${ICONS.info}<span>Custom tabs appear in the Media Client app alongside Voucher / Press / News / Transport. Use <strong>Order</strong> to position them, and <strong>Visible to</strong> to hide a tab from the public app. Changes are logged in the Overview activity feed.</span></p>
    <div id="tab-editor"></div>
    <div class="card" id="tab-list">${loadingHtml()}</div>`;
  document.getElementById('tab-add').addEventListener('click', () => openTabEditor(null));
  await loadAppTabs();
}

async function loadAppTabs() {
  try { adminState.appTabs = await API.get('/tabs', true); }
  catch (e) { const el = document.getElementById('tab-list'); if (el) el.innerHTML = errorHtml(e.message); return; }
  renderAppTabList();
}

function renderAppTabList() {
  const el = document.getElementById('tab-list');
  if (!el) return;
  const list = adminState.appTabs;
  if (!list.length) { el.innerHTML = '<div class="empty" style="padding:28px">No custom tabs yet. Add your first tab.</div>'; return; }
  el.innerHTML = list.map((t) => {
    const perm = TAB_PERMS.find((p) => p.v === (t.permissions || 'all'));
    return `<div class="mgr-item">
      <div class="mgr-main">
        <div class="mgr-title">
          <span class="badge badge-blue">${esc(TAB_TYPE_LABEL[t.content_type] || t.content_type)}</span>
          ${t.permissions && t.permissions !== 'all' ? `<span class="badge badge-amber">${esc(perm ? perm.label : t.permissions)}</span>` : ''}
          <span>${esc(t.title)}</span>
        </div>
        <div class="mgr-sub">order ${esc(t.order || 0)} · <span class="mono">${esc(t.route)}</span>${t.content_type === 'external-link' && t.content ? ` · ${esc(t.content)}` : ''}</div>
      </div>
      <div class="mgr-actions">
        <button class="btn btn-ghost btn-icon" title="Edit" data-edit="${esc(t.id)}">${ICONS.edit}</button>
        <button class="btn btn-danger btn-icon" title="Delete" data-del="${esc(t.id)}">${ICONS.trash}</button>
      </div>
    </div>`;
  }).join('');
  el.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openTabEditor(adminState.appTabs.find((t) => t.id === b.dataset.edit))));
  el.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteAppTab(b.dataset.del)));
}

function tabContentField(type, content) {
  if (type === 'feed') {
    return '<div class="muted" style="font-size:.9rem;padding:4px 2px">This tab shows the live News feed — no content needed.</div>';
  }
  if (type === 'external-link') {
    return `<input class="input" id="tab-content" type="url" value="${esc(content || '')}" placeholder="https://example.com/media-guide">`;
  }
  return `<textarea class="textarea" id="tab-content" placeholder="&lt;h1&gt;Welcome to the Custom Tab&lt;/h1&gt;">${esc(content || '')}</textarea>`;
}

function openTabEditor(item) {
  const ed = document.getElementById('tab-editor');
  const it = item || { title: '', route: '', content_type: 'static', content: '', order: (adminState.appTabs.length + 1) * 10, permissions: 'all' };
  ed.innerHTML = `
    <div class="editor">
      <div class="row2">
        <div class="field"><label>Title</label>
          <input class="input" id="tab-title" value="${esc(it.title)}" placeholder="e.g. Media Guide"></div>
        <div class="field"><label>Route <span class="hint">— leave blank to auto-build from the title</span></label>
          <input class="input mono" id="tab-route" value="${esc(it.route)}" placeholder="/media-guide"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Content type</label>
          <select class="select" id="tab-type">${TAB_TYPES.map((t) => `<option value="${t.v}" ${t.v === it.content_type ? 'selected' : ''}>${t.label}</option>`).join('')}</select></div>
        <div class="field"><label>Visible to</label>
          <select class="select" id="tab-perm">${TAB_PERMS.map((p) => `<option value="${p.v}" ${p.v === (it.permissions || 'all') ? 'selected' : ''}>${p.label}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Order <span class="hint">— lower numbers appear first</span></label>
        <input class="input" id="tab-order" type="number" value="${esc(it.order || 0)}" style="max-width:140px"></div>
      <div class="field"><label>Content</label><div id="tab-content-wrap">${tabContentField(it.content_type, it.content)}</div></div>
      <div class="editor-actions">
        <button class="btn btn-ghost btn-sm" id="tab-cancel">Cancel</button>
        <button class="btn btn-primary btn-sm" id="tab-save">${ICONS.check}<span>${item ? 'Save changes' : 'Add tab'}</span></button>
      </div>
    </div>`;
  ed.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  document.getElementById('tab-type').addEventListener('change', (e) => {
    const cur = document.getElementById('tab-content');
    document.getElementById('tab-content-wrap').innerHTML = tabContentField(e.target.value, cur ? cur.value : '');
  });
  document.getElementById('tab-cancel').addEventListener('click', () => { ed.innerHTML = ''; });
  document.getElementById('tab-save').addEventListener('click', () => saveAppTab(item ? item.id : null));
  document.getElementById('tab-title').focus();
}

async function saveAppTab(id) {
  const contentEl = document.getElementById('tab-content');
  const payload = {
    title: val('tab-title').trim(),
    route: val('tab-route').trim(),
    content_type: val('tab-type'),
    content: contentEl ? contentEl.value : '',
    order: Number(val('tab-order')) || 0,
    permissions: val('tab-perm'),
  };
  if (!payload.title) { toast('Please enter a tab title.', 'error'); return; }
  if (payload.content_type === 'external-link' && !/^https?:\/\//i.test(payload.content.trim())) {
    toast('External-link tabs need a full URL (https://…).', 'error');
    return;
  }
  try {
    const r = id
      ? await API.put('/admin/tabs/' + id, payload, true)
      : await API.post('/admin/tabs', payload, true);
    adminState.appTabs = r.tabs || [];
    document.getElementById('tab-editor').innerHTML = '';
    toast(id ? 'Tab saved.' : 'Tab added — it is now live in the client app.', 'success');
    renderAppTabList();
  } catch (e) { handleAdminErr(e); }
}

async function deleteAppTab(id) {
  if (!confirm('Remove this tab from the client app?')) return;
  try {
    const r = await API.del('/admin/tabs/' + id, true);
    adminState.appTabs = r.tabs || [];
    toast('Tab removed.', 'success');
    renderAppTabList();
  } catch (e) { handleAdminErr(e); }
}

/* =============================================================================
   RESET — wipe all voucher data (danger zone)
   ========================================================================== */

function renderResetMgr() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `
    <div class="admin-head"><h2>Reset voucher data</h2></div>
    <div class="card card-pad" style="border-color:#e5b6b6">
      <div class="alert alert-error" style="margin-bottom:14px">${ICONS.alert}
        <div><strong>Danger zone.</strong> This permanently deletes <strong>every voucher</strong> — Pending, Redeemed and Expired — and resets all counters and the live analytics feed. Registered media, venues, news, press conferences, transport and design settings are kept. This cannot be undone.</div>
      </div>
      <div class="field">
        <label for="reset-confirm">Type <strong>RESET</strong> to confirm</label>
        <input class="input mono" id="reset-confirm" autocomplete="off" placeholder="RESET" style="max-width:240px">
      </div>
      <button class="btn btn-danger" id="reset-go" disabled>${ICONS.trash}<span>Clear all voucher data</span></button>
      <p class="mgr-note" style="margin-top:14px">${ICONS.info}<span>Every reset is recorded in the Overview <strong>Admin activity</strong> feed with a timestamp, for accountability.</span></p>
    </div>`;

  const input = document.getElementById('reset-confirm');
  const btn = document.getElementById('reset-go');
  input.addEventListener('input', () => { btn.disabled = input.value.trim() !== 'RESET'; });
  btn.addEventListener('click', doResetVouchers);
}

async function doResetVouchers() {
  if (!confirm('Final check: permanently delete ALL voucher data? This cannot be undone.')) return;
  const btn = document.getElementById('reset-go');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:16px;height:16px;border-width:2px;margin:0"></span><span>Resetting…</span>`;
  try {
    const r = await API.post('/admin/reset-vouchers', { confirm: true }, true);
    toast(`Voucher data cleared (${r.removed} removed).`, 'success');
    renderResetMgr();
  } catch (e) {
    handleAdminErr(e);
    btn.disabled = false;
    btn.innerHTML = `${ICONS.trash}<span>Clear all voucher data</span>`;
  }
}

/* =============================================================================
   DESIGN & BRANDING
   ========================================================================== */

const DESIGN_DEFAULTS = {
  brandColor: '#12274a', accentColor: '#2f6bff', bgColor: '#eef1f5',
  font: 'IBM Plex Sans', headerTitle: '', headerSubtitle: '', logo: '', background: '',
};
let designLogo = '';
let designBg = '';

async function renderDesignMgr() {
  const panel = document.getElementById('panel');
  panel.innerHTML = `<div class="admin-head"><h2>Design &amp; branding</h2></div><div id="design-body">${loadingHtml()}</div>`;
  try { adminState.theme = await API.get('/theme'); }
  catch (e) { const el = document.getElementById('design-body'); if (el) el.innerHTML = errorHtml(e.message); return; }
  renderDesignForm();
}

function designColorField(id, label, value) {
  return `<div class="field"><label>${label}</label>
    <div class="color-row">
      <input type="color" id="${id}" value="${esc(value)}">
      <input class="input mono" id="${id}-hex" value="${esc(value)}">
    </div></div>`;
}

function renderDesignForm() {
  const t = { ...DESIGN_DEFAULTS, ...(adminState.theme || {}) };
  designLogo = t.logo || '';
  designBg = t.background || '';
  document.getElementById('design-body').innerHTML = `
    <p class="mgr-note">${ICONS.info}<span>Tailor the look for your event — changes preview instantly. Click <strong>Save &amp; apply</strong> to publish for everyone (client &amp; admin).</span></p>
    <div id="design-preview"></div>
    <div class="card card-pad">
      <div class="row2">
        <div class="field"><label>Header title</label><input class="input" id="d-title" value="${esc(t.headerTitle)}" placeholder="Media Hub"></div>
        <div class="field"><label>Header subtitle</label><input class="input" id="d-sub" value="${esc(t.headerSubtitle)}" placeholder="AFC Asian Cup 2027"></div>
      </div>
      <div class="row2">
        ${designColorField('d-brand', 'Brand colour (header)', t.brandColor)}
        ${designColorField('d-accent', 'Accent colour (buttons)', t.accentColor)}
      </div>
      <div class="row2">
        ${designColorField('d-bg', 'Page background colour', t.bgColor)}
        <div class="field"><label>Font</label><select class="select" id="d-font">${THEME_FONTS.map((f) => `<option ${f.name === t.font ? 'selected' : ''}>${esc(f.name)}</option>`).join('')}</select></div>
      </div>
      <div class="row2">
        <div class="field"><label>Logo <span class="hint">— replaces the icon · max 1 MB</span></label>
          <div class="att-editor"><div class="att-list" id="d-logo-list"></div>
            <label class="btn btn-ghost btn-sm att-add">${ICONS.plus}<span>Upload logo</span><input type="file" id="d-logo-input" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label></div>
        </div>
        <div class="field"><label>Background image <span class="hint">— optional · max 2.5 MB</span></label>
          <div class="att-editor"><div class="att-list" id="d-bg-list"></div>
            <label class="btn btn-ghost btn-sm att-add">${ICONS.plus}<span>Upload background</span><input type="file" id="d-bg-input" accept="image/png,image/jpeg,image/webp" hidden></label></div>
        </div>
      </div>
      <div class="editor-actions">
        <button class="btn btn-ghost btn-sm" id="d-reset">Reset to defaults</button>
        <button class="btn btn-primary btn-sm" id="d-save">${ICONS.check}<span>Save &amp; apply</span></button>
      </div>
    </div>`;

  ['d-title', 'd-sub', 'd-font'].forEach((id) => document.getElementById(id).addEventListener('input', onDesignChange));
  [['d-brand', 'd-brand-hex'], ['d-accent', 'd-accent-hex'], ['d-bg', 'd-bg-hex']].forEach(([p, h]) => {
    const pk = document.getElementById(p), hx = document.getElementById(h);
    pk.addEventListener('input', () => { hx.value = pk.value; onDesignChange(); });
    hx.addEventListener('input', () => { if (/^#[0-9a-fA-F]{6}$/.test(hx.value)) { pk.value = hx.value; onDesignChange(); } });
  });
  document.getElementById('d-logo-input').addEventListener('change', (e) => onDesignFile(e, 'logo'));
  document.getElementById('d-bg-input').addEventListener('change', (e) => onDesignFile(e, 'bg'));
  document.getElementById('d-save').addEventListener('click', saveDesign);
  document.getElementById('d-reset').addEventListener('click', resetDesign);
  renderDesignAssets();
  onDesignChange();
}

function readDesignForm() {
  return {
    headerTitle: val('d-title').trim(),
    headerSubtitle: val('d-sub').trim(),
    brandColor: val('d-brand-hex').trim() || val('d-brand'),
    accentColor: val('d-accent-hex').trim() || val('d-accent'),
    bgColor: val('d-bg-hex').trim() || val('d-bg'),
    font: val('d-font'),
    logo: designLogo,
    background: designBg,
  };
}

function onDesignChange() {
  const t = readDesignForm();
  applyTheme(t);      // live-recolour the admin page
  if (t.logo) applyLogo(t.logo);
  else { const m = document.getElementById('brand-mark'); if (m) { m.innerHTML = ICONS.dash; m.style.background = ''; m.style.boxShadow = ''; } }
  renderDesignPreview(t);
}

function renderDesignPreview(t) {
  const el = document.getElementById('design-preview');
  if (!el) return;
  const brand = /^#[0-9a-fA-F]{6}$/.test(t.brandColor) ? t.brandColor : '#12274a';
  const accent = /^#[0-9a-fA-F]{6}$/.test(t.accentColor) ? t.accentColor : '#2f6bff';
  const mark = t.logo
    ? `<img src="${t.logo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit">`
    : ICONS.ticket;
  el.innerHTML = `
    <div class="design-preview-card">
      <div class="dp-bar" style="background:linear-gradient(120deg, ${brand}, ${mixHex(brand, '#ffffff', 0.16)})">
        <div class="dp-mark" style="background:${t.logo ? 'none' : 'linear-gradient(135deg,' + accent + ',#5b8bff)'}">${mark}</div>
        <div class="dp-text"><div class="dp-title">${esc(t.headerTitle || 'Media Hub')}</div><div class="dp-sub">${esc(t.headerSubtitle || 'AFC Asian Cup 2027')}</div></div>
      </div>
      <div class="dp-body">
        <button class="btn btn-primary btn-sm" style="pointer-events:none;background:${accent}">Generate Voucher</button>
        <span class="dp-hint">Live preview</span>
      </div>
    </div>`;
}

async function onDesignFile(e, kind) {
  const f = (e.target.files || [])[0];
  e.target.value = '';
  if (!f) return;
  const max = kind === 'logo' ? 1024 * 1024 : 2.5 * 1024 * 1024;
  if (f.size > max) { toast(`Image too large (max ${kind === 'logo' ? '1' : '2.5'} MB).`, 'error'); return; }
  try {
    const dataUrl = await readFileAsDataURL(f);
    if (kind === 'logo') designLogo = dataUrl; else designBg = dataUrl;
    renderDesignAssets();
    onDesignChange();
  } catch (err) { toast('Could not read the image.', 'error'); }
}

function designAssetChip(dataUrl, kind) {
  return `<div class="att-chip"><span class="att-chip-thumb"><img src="${dataUrl}" alt=""></span><span class="att-chip-name">${kind === 'logo' ? 'Logo' : 'Background'}</span><button type="button" class="att-chip-x" data-rmasset="${kind}" title="Remove">${ICONS.close}</button></div>`;
}

function renderDesignAssets() {
  const lg = document.getElementById('d-logo-list');
  const bg = document.getElementById('d-bg-list');
  if (lg) lg.innerHTML = designLogo ? designAssetChip(designLogo, 'logo') : '';
  if (bg) bg.innerHTML = designBg ? designAssetChip(designBg, 'bg') : '';
  document.querySelectorAll('[data-rmasset]').forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.rmasset === 'logo') designLogo = ''; else designBg = '';
    renderDesignAssets();
    onDesignChange();
  }));
}

async function saveDesign() {
  try {
    const saved = await API.put('/theme', readDesignForm(), true);
    THEME = saved; adminState.theme = saved;
    toast('Design saved & applied.', 'success');
  } catch (e) { handleAdminErr(e); }
}

async function resetDesign() {
  if (!confirm('Reset all design settings to the defaults?')) return;
  try {
    await API.put('/theme', { brandColor: '', accentColor: '', bgColor: '', font: 'IBM Plex Sans', headerTitle: '', headerSubtitle: '', logo: '', background: '' }, true);
    toast('Reset to defaults — reloading…', 'success');
    setTimeout(() => location.reload(), 700);
  } catch (e) { handleAdminErr(e); }
}

window.addEventListener('DOMContentLoaded', init);
