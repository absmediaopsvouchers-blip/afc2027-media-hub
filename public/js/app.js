'use strict';

/* =============================================================================
   Media Client app — four tabs:
     1. Meal Voucher Request   2. Press Conferences
     3. News & Media Updates   4. Transport & Shuttle Info
   ========================================================================== */

const TABS = [
  { id: 'voucher', label: 'Voucher', icon: 'ticket' },
  { id: 'press', label: 'Press', icon: 'mic' },
  { id: 'news', label: 'News', icon: 'news' },
  { id: 'transport', label: 'Transport', icon: 'bus' },
];

// Returning users only enter their email — we cache it locally so the form is
// pre-filled and the accreditation field stays hidden on subsequent visits.
const EMAIL_KEY = 'mh.email';
// Today's issued vouchers are cached locally (with their QR images) so they
// survive closing/reopening the app and are even viewable offline at the counter.
const VOUCHERS_KEY = 'mh.vouchers';

const state = {
  tab: 'voucher',
  locations: [],
  meta: null,
  ticketPoll: null, // interval id for live voucher-status polling
  myVouchers: [], // this user's vouchers for today (server-backed + cached)
  myVouchersDate: null,
  news: [], // last-loaded news list (for attachment lookups)
  // Persisted across tab switches so a half-filled form survives navigation.
  form: { email: '', acc: '', known: null, locationId: '', meal: '' },
};

const view = () => document.getElementById('view');

function isEmailLike(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

/* ---- shell ---------------------------------------------------------------- */

function init() {
  document.getElementById('brand-mark').innerHTML = ICONS.ticket;
  document.getElementById('admin-link').innerHTML = ICONS.lock + '<span>Admin</span>';

  // Restore the cached email so returning users skip re-entering it.
  const cached = localStorage.getItem(EMAIL_KEY);
  if (cached) state.form.email = cached;

  buildNavs();
  startClock();

  // Restore tab from URL hash (so a refresh keeps you in place).
  const hash = location.hash.replace('#', '');
  if (TABS.some((t) => t.id === hash)) state.tab = hash;

  loadConfig().then(() => render());
}

async function loadConfig() {
  try {
    const [meta, locations] = await Promise.all([
      API.get('/meta').catch(() => null),
      API.get('/locations').catch(() => []),
    ]);
    state.meta = meta;
    state.locations = locations || [];
    // Theme / branding (colours, font, logo, background, header text).
    await loadTheme();
    applyLogo(THEME.logo);
    const titleEl = document.querySelector('.brand-title');
    if (titleEl && THEME.headerTitle) titleEl.textContent = THEME.headerTitle;
    const subEl = document.getElementById('brand-sub');
    if (subEl) subEl.textContent = THEME.headerSubtitle || (meta && meta.event) || '';
    if (!state.form.locationId && state.locations.length) {
      // Default to the first venue that actually offers meals (skips Training etc.).
      const first = state.locations.find((l) => l.allowedMeals && l.allowedMeals.length);
      if (first) {
        state.form.locationId = first.id;
        state.form.meal = first.allowedMeals[0];
      }
    }
    // Load managed categories (for the News feed badges).
    await loadCategories();
    // Restore today's saved vouchers, then refresh from the server.
    loadCachedVouchers();
    if (isEmailLike(state.form.email)) fetchMyVouchers(state.form.email);
  } catch (e) { /* render will show errors per-tab */ }
}

function buildNavs() {
  const top = document.getElementById('topnav');
  const bottom = document.getElementById('bottomnav');
  top.innerHTML = TABS.map((t) =>
    `<button data-tab="${t.id}">${ICONS[t.icon]}<span>${t.label}</span></button>`).join('');
  bottom.innerHTML = TABS.map((t) =>
    `<button data-tab="${t.id}">${ICONS[t.icon]}<span>${t.label}</span></button>`).join('');
  [top, bottom].forEach((nav) => nav.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (b) go(b.dataset.tab);
  }));
}

function go(tab) {
  state.tab = tab;
  location.hash = tab;
  stopTicketPoll();
  updateNavActive();
  render();
  scrollViewTop();
}

/** Scroll the content area (the app-shell scroller) back to the top. */
function scrollViewTop(smooth) {
  const v = view();
  if (v && v.scrollTo) v.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  else if (v) v.scrollTop = 0;
}

function updateNavActive() {
  $all('[data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === state.tab));
}

function startClock() {
  const el = document.getElementById('clock');
  const tick = () => { el.textContent = fmtClock(new Date()); };
  tick();
  setInterval(tick, 1000);
}

function render() {
  updateNavActive();
  if (state.tab === 'voucher') return renderVoucher();
  if (state.tab === 'press') return renderPress();
  if (state.tab === 'news') return renderNews();
  if (state.tab === 'transport') return renderTransport();
}

/* ---- event-timezone day labels ------------------------------------------- */
// Day labels (Today / Tomorrow) are relative to the EVENT timezone reported by
// the server, not the visitor's device clock.

function refToday() { return (state.meta && state.meta.today) || dayStr(0); }
function addDays(ymd, n) {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
function eventRelLabel(ymd) {
  const t = refToday();
  if (ymd === t) return 'Today';
  if (ymd === addDays(t, 1)) return 'Tomorrow';
  if (ymd === addDays(t, -1)) return 'Yesterday';
  const [y, m, d] = ymd.split('-').map(Number);
  try { return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long' }); }
  catch (e) { return ymd; }
}

/* ---- shared view helpers -------------------------------------------------- */

function pageHead(title, sub) {
  return `<div class="page-head"><h1>${esc(title)}</h1><p>${esc(sub)}</p></div>`;
}
function loadingHtml() { return `<div class="loading"><div class="spinner"></div>Loading…</div>`; }
function emptyHtml(msg) { return `<div class="card card-pad empty">${ICONS.info}<div>${esc(msg)}</div></div>`; }
function errorHtml(msg) { return `<div class="alert alert-error">${ICONS.alert}<div>${esc(msg)}</div></div>`; }

/* =============================================================================
   TAB 1 — Meal Voucher Request
   ========================================================================== */

function renderVoucher() {
  const f = state.form;
  view().innerHTML = `
    ${pageHead('Meal Voucher', 'Generate your digital catering voucher. Limits are enforced centrally, per day.')}
    <div id="v-result"></div>
    <div id="v-mine"></div>
    <div class="card card-pad" id="v-form-card">
      <div id="v-alert"></div>
      <div class="field">
        <label for="v-email">Email address</label>
        <input class="input" id="v-email" type="email" inputmode="email" autocomplete="email"
               placeholder="you@press.example" value="${esc(f.email)}">
      </div>
      <div class="field ${f.known === true ? 'hidden' : ''}" id="v-acc-row">
        <label for="v-acc">Accreditation number <span class="hint">— first request only</span></label>
        <input class="input" id="v-acc" type="text" autocomplete="off"
               placeholder="AFC-MED-00000" value="${esc(f.acc)}">
      </div>
      <div class="field ${f.known === true ? '' : 'hidden'}" id="v-known"></div>
      <div class="field">
        <label for="v-location">Location</label>
        <select class="select" id="v-location">${locationOptions(f.locationId)}</select>
      </div>
      <div class="field">
        <label>Meal type</label>
        <div class="seg" id="v-meal"></div>
      </div>
      <button class="btn btn-primary btn-block" id="v-submit">${ICONS.ticket}<span>Generate Voucher</span></button>
    </div>
  `;

  if (!state.locations.length) {
    document.getElementById('v-alert').innerHTML =
      `<div class="alert alert-error">${ICONS.alert}<div>Could not load locations. Is the server running?</div></div>`;
  }

  wireVoucherForm();
  renderMyVouchers();
  if (isEmailLike(f.email) && f.known === null) checkUser(f.email);
}

function locationOptions(selectedId) {
  const groups = { MMC: 'Media Centres', Stadium: 'Stadiums', Training: 'Training Sites' };
  let html = '';
  for (const type of Object.keys(groups)) {
    // Only list venues that actually offer meals (Training Sites are excluded).
    const locs = state.locations.filter((l) => l.type === type && l.allowedMeals && l.allowedMeals.length);
    if (!locs.length) continue;
    html += `<optgroup label="${esc(groups[type])}">`;
    for (const l of locs) {
      html += `<option value="${esc(l.id)}" ${l.id === selectedId ? 'selected' : ''}>${esc(l.name)}</option>`;
    }
    html += '</optgroup>';
  }
  return html;
}

// Display metadata for each meal type. The set of meals a venue offers comes
// from the server (location.allowedMeals), so the policy lives in one place.
const MEAL_META = {
  Lunch: { label: 'Lunch', sub: 'Midday service' },
  Dinner: { label: 'Dinner', sub: 'Evening service' },
  Meal: { label: 'Media Café Meal', sub: 'One per day' },
};

function mealsFor(locationId) {
  const loc = state.locations.find((l) => l.id === locationId);
  return (loc && loc.allowedMeals) ? loc.allowedMeals : [];
}

function mealSegHtml(allowed, selected) {
  return allowed.map((v) => {
    const m = MEAL_META[v] || { label: v, sub: '' };
    return `<button type="button" data-meal="${esc(v)}" class="${v === selected ? 'active' : ''}">
       <span>${esc(m.label)}</span><span class="seg-sub">${esc(m.sub)}</span>
     </button>`;
  }).join('');
}

function updateMeals(locationId) {
  const allowed = mealsFor(locationId);
  if (!allowed.includes(state.form.meal)) state.form.meal = allowed[0] || '';
  const host = document.getElementById('v-meal');
  if (!host) return;
  host.innerHTML = allowed.length
    ? mealSegHtml(allowed, state.form.meal)
    : '<div class="muted" style="font-size:.9rem;padding:4px 2px">No meals are offered at this location.</div>';
}

function wireVoucherForm() {
  updateMeals(state.form.locationId);

  document.getElementById('v-email').addEventListener('change', (e) => {
    const email = e.target.value.trim().toLowerCase();
    state.form.email = email;
    state.form.known = null;
    if (isEmailLike(email)) { checkUser(email); fetchMyVouchers(email); }
    else { showUnknown(); state.myVouchers = []; renderMyVouchers(); }
  });

  const accEl = document.getElementById('v-acc');
  if (accEl) accEl.addEventListener('input', (e) => { state.form.acc = e.target.value; });

  document.getElementById('v-location').addEventListener('change', (e) => {
    state.form.locationId = e.target.value;
    updateMeals(e.target.value);
  });

  document.getElementById('v-meal').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-meal]');
    if (!b) return;
    state.form.meal = b.dataset.meal;
    $all('#v-meal button').forEach((x) => x.classList.toggle('active', x === b));
  });

  document.getElementById('v-submit').addEventListener('click', submitVoucher);
}

async function checkUser(email) {
  try {
    const r = await API.get('/user/' + encodeURIComponent(email));
    // Ignore if the user has since changed the email field.
    if (document.getElementById('v-email') && document.getElementById('v-email').value.trim().toLowerCase() !== email) return;
    if (r.known) { rememberEmail(email); showKnown(); }
    else showUnknown();
  } catch (e) { /* offline check is best-effort */ }
}

function rememberEmail(email) {
  try { localStorage.setItem(EMAIL_KEY, email); } catch (e) { /* storage may be blocked */ }
}

function showKnown() {
  state.form.known = true;
  state.form.acc = '';
  const row = document.getElementById('v-acc-row');
  const known = document.getElementById('v-known');
  if (row) row.classList.add('hidden');
  if (known) {
    known.classList.remove('hidden');
    known.innerHTML = `<div class="note">${ICONS.check}<span>Welcome back — your accreditation is already on file.</span></div>`;
  }
}

function showUnknown() {
  state.form.known = false;
  const row = document.getElementById('v-acc-row');
  const known = document.getElementById('v-known');
  if (row) row.classList.remove('hidden');
  if (known) { known.classList.add('hidden'); known.innerHTML = ''; }
}

function vAlert(type, msg) {
  const a = document.getElementById('v-alert');
  if (!a) return;
  const cls = type === 'warn' ? 'alert-warn' : type === 'success' ? 'alert-success' : type === 'info' ? 'alert-info' : 'alert-error';
  const icon = type === 'error' ? ICONS.ban : type === 'warn' ? ICONS.alert : type === 'success' ? ICONS.check : ICONS.info;
  a.innerHTML = `<div class="alert ${cls}">${icon}<div>${esc(msg)}</div></div>`;
}
function vClearAlert() { const a = document.getElementById('v-alert'); if (a) a.innerHTML = ''; }

async function submitVoucher() {
  const email = document.getElementById('v-email').value.trim().toLowerCase();
  const accEl = document.getElementById('v-acc');
  const acc = accEl ? accEl.value.trim() : state.form.acc;
  const locationId = document.getElementById('v-location').value;
  const meal = state.form.meal;

  state.form.email = email;
  state.form.acc = acc;
  state.form.locationId = locationId;
  vClearAlert();

  if (!isEmailLike(email)) { vAlert('error', 'Please enter a valid email address.'); return; }
  if (!locationId) { vAlert('error', 'Please choose a location.'); return; }
  if (!meal) { vAlert('error', 'Please choose a meal type.'); return; }

  const btn = document.getElementById('v-submit');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner" style="width:18px;height:18px;border-width:2px;margin:0"></span><span>Generating…</span>`;

  try {
    const r = await API.post('/vouchers', { email, accreditationNumber: acc, locationId, mealType: meal });
    rememberEmail(email);
    addMyVoucher(r.voucher);
    showTicket(r.voucher, r.registeredNow);
    toast('Voucher issued', 'success');
  } catch (e) {
    if (e.code === 'ACCREDITATION_REQUIRED') {
      showUnknown();
      vAlert('warn', e.message);
      const el = document.getElementById('v-acc');
      if (el) el.focus();
    } else {
      vAlert('error', e.message);
    }
  } finally {
    btn.disabled = false;
    btn.innerHTML = `${ICONS.ticket}<span>Generate Voucher</span>`;
  }
}

/** Status pill shown on the ticket; updated live as the voucher is scanned. */
function ticketStatusPill(status) {
  if (status === 'Redeemed') return `<div class="ticket-status redeemed">${ICONS.check}<span>Redeemed</span></div>`;
  if (status === 'Expired') return `<div class="ticket-status expired">${ICONS.ban}<span>Expired</span></div>`;
  return `<div class="ticket-status pending"><span class="dot"></span><span>Valid · Pending</span></div>`;
}

function showTicket(v, registeredNow) {
  stopTicketPoll();
  const mealLabel = v.mealType === 'Meal' ? 'Media Café Meal' : v.mealType;
  const kicker = v.locationType === 'Stadium' ? 'Stadium · Media Café' : v.locationType;
  document.getElementById('v-result').innerHTML = `
    <div class="ticket">
      <div class="ticket-top type-${esc(v.locationType)}">
        <div>
          <div class="t-meal">${esc(kicker)}</div>
          <h3>${esc(mealLabel)}</h3>
        </div>
        <div id="ticket-status">${ticketStatusPill(v.status || 'Pending')}</div>
      </div>
      <div class="ticket-perf"></div>
      <div class="ticket-body">
        <div class="ticket-qr">${v.qr ? `<img src="${v.qr}" alt="Voucher QR code">` : '<div class="muted center">QR<br>unavailable</div>'}</div>
        <div class="ticket-meta">
          <div class="ticket-row"><span class="k">Voucher ID</span><span class="v mono">${esc(v.id)}</span></div>
          <div class="ticket-row"><span class="k">Location</span><span class="v">${esc(v.locationName)}</span></div>
          <div class="ticket-row"><span class="k">Issued</span><span class="v">${esc(fmtDateTime(v.issuedAt))}</span></div>
          <div class="ticket-row"><span class="k">Media member</span><span class="v">${esc(v.email)}</span></div>
        </div>
      </div>
      <div class="ticket-foot">${ICONS.info}<span>Show this QR code at the counter. The badge updates to “Redeemed” once scanned.</span></div>
    </div>
    ${registeredNow ? `<div class="alert alert-success" style="margin-top:14px">${ICONS.checkCircle}<div>Your email is now linked to accreditation <strong>${esc(v.accreditationNumber)}</strong>. Next time, just enter your email.</div></div>` : ''}
    <button class="btn btn-ghost btn-block" id="v-again" style="margin-top:14px">${ICONS.refresh}<span>Request another voucher</span></button>
  `;
  document.getElementById('v-form-card').classList.add('hidden');
  const mine = document.getElementById('v-mine');
  if (mine) mine.classList.add('hidden');
  scrollViewTop(true);
  document.getElementById('v-again').addEventListener('click', () => {
    stopTicketPoll();
    document.getElementById('v-result').innerHTML = '';
    document.getElementById('v-form-card').classList.remove('hidden');
    const m = document.getElementById('v-mine');
    if (m) m.classList.remove('hidden');
    renderMyVouchers();
  });

  startTicketPoll(v.id);
}

/* Open one of the user's saved vouchers (from the "today" list) as a full ticket. */
function openSavedTicket(v) {
  showTicket(v, false);
}

/* Live status: poll the server so the badge flips to "Redeemed" the moment
   catering scans the voucher at the counter. */
function startTicketPoll(id) {
  stopTicketPoll();
  state.ticketPoll = setInterval(async () => {
    let r;
    try { r = await API.get('/vouchers/' + encodeURIComponent(id)); }
    catch (e) { return; }
    const host = document.getElementById('ticket-status');
    if (!host) { stopTicketPoll(); return; }
    host.innerHTML = ticketStatusPill(r.status);
    // Keep the saved-vouchers cache in sync so the list reflects redemption too.
    const mv = state.myVouchers.find((x) => x.id === id);
    if (mv && (mv.status !== r.status || mv.redeemedAt !== r.redeemedAt)) {
      mv.status = r.status;
      mv.redeemedAt = r.redeemedAt;
      saveCachedVouchers(state.form.email);
    }
    if (r.status !== 'Pending') {
      stopTicketPoll();
      if (r.status === 'Redeemed') toast('Voucher redeemed at the counter — enjoy your meal!', 'success');
    }
  }, 4000);
}

/* =============================================================================
   "Your vouchers — today": server-backed list, locally cached for offline use.
   This is what keeps issued vouchers retrievable until the day rolls over, even
   after the app is closed or reopened on another device (keyed by email).
   ========================================================================== */

function todayRef() { return (state.meta && state.meta.today) || dayStr(0); }

async function fetchMyVouchers(email) {
  if (!isEmailLike(email)) return;
  try {
    const r = await API.get('/vouchers?email=' + encodeURIComponent(email));
    state.myVouchers = r.vouchers || [];
    state.myVouchersDate = r.date || todayRef();
    saveCachedVouchers(email);
  } catch (e) {
    return; // offline or error — keep whatever is cached
  }
  renderMyVouchers();
}

function addMyVoucher(v) {
  state.myVouchers = (state.myVouchers || []).filter((x) => x.id !== v.id);
  state.myVouchers.push(v);
  state.myVouchersDate = todayRef();
  saveCachedVouchers(state.form.email);
}

function saveCachedVouchers(email) {
  try {
    localStorage.setItem(VOUCHERS_KEY, JSON.stringify({
      date: state.myVouchersDate || todayRef(),
      email: email || state.form.email,
      list: state.myVouchers || [],
    }));
  } catch (e) { /* storage may be blocked/full */ }
}

function loadCachedVouchers() {
  try {
    const raw = localStorage.getItem(VOUCHERS_KEY);
    if (!raw) return;
    const c = JSON.parse(raw);
    if (c && c.date === todayRef()) {
      state.myVouchers = c.list || [];
      state.myVouchersDate = c.date;
    } else {
      localStorage.removeItem(VOUCHERS_KEY); // a previous day — expired
      state.myVouchers = [];
    }
  } catch (e) { /* ignore corrupt cache */ }
}

function renderMyVouchers() {
  const host = document.getElementById('v-mine');
  if (!host) return;
  const list = state.myVouchers || [];
  if (!list.length) { host.innerHTML = ''; return; }
  // Newest first.
  const sorted = list.slice().sort((a, b) => String(b.issuedAt).localeCompare(String(a.issuedAt)));
  host.innerHTML = `
    <div class="section-label">Your vouchers — today</div>
    <div class="card mine-list">${sorted.map(mineRow).join('')}</div>
    <p class="mine-hint">${ICONS.info}<span>Saved on this device until end of day. Tap any voucher to show its QR at the counter.</span></p>`;
  host.querySelectorAll('[data-vid]').forEach((b) => b.addEventListener('click', () => {
    const v = state.myVouchers.find((x) => x.id === b.dataset.vid);
    if (v) openSavedTicket(v);
  }));
}

function mineRow(v) {
  const meal = v.mealType === 'Meal' ? 'Media Café Meal' : v.mealType;
  const cls = v.status === 'Redeemed' ? 'badge-green' : v.status === 'Expired' ? 'badge-gray' : 'badge-amber';
  const dot = v.status === 'Pending' ? '<span class="dot"></span>' : '';
  return `<button type="button" class="mine-row" data-vid="${esc(v.id)}">
    <div class="mine-thumb">${v.qr ? `<img src="${v.qr}" alt="">` : ICONS.ticket}</div>
    <div class="mine-main">
      <div class="mine-meal">${esc(meal)}</div>
      <div class="mine-loc">${esc(v.locationName)}</div>
      <div class="mine-id mono">${esc(v.id)}</div>
    </div>
    <span class="badge ${cls}">${dot}${esc(v.status)}</span>
  </button>`;
}
function stopTicketPoll() {
  if (state.ticketPoll) { clearInterval(state.ticketPoll); state.ticketPoll = null; }
}

/* =============================================================================
   TAB 2 — Press Conferences
   ========================================================================== */

async function renderPress() {
  view().innerHTML = pageHead('Press Conferences', 'Official team media availabilities and briefings.') + loadingHtml();
  let list;
  try { list = await API.get('/press-conferences'); }
  catch (e) { view().innerHTML = pageHead('Press Conferences', 'Official team media availabilities and briefings.') + errorHtml(e.message); return; }

  let html = pageHead('Press Conferences', 'Official team media availabilities and briefings.');
  if (!list.length) { view().innerHTML = html + emptyHtml('No press conferences scheduled yet.'); return; }

  const byDate = {};
  for (const pc of list) (byDate[pc.date] = byDate[pc.date] || []).push(pc);

  for (const date of Object.keys(byDate).sort()) {
    html += `<div class="day-group">
      <div class="day-head"><span class="d-label">${esc(eventRelLabel(date))}</span><span class="d-date">${esc(longDate(date))}</span></div>
      <div class="card">`;
    for (const pc of byDate[date]) {
      const badge = STATUS_BADGE[pc.status] || 'badge-gray';
      html += `<div class="pc">
        <div class="pc-time">${esc(pc.time || '—')}</div>
        <div class="pc-main">
          <div class="pc-team">${esc(pc.team)}</div>
          <div class="pc-meta">${esc(pc.room || '')}</div>
          ${pc.note ? `<div class="pc-note">${esc(pc.note)}</div>` : ''}
        </div>
        <span class="badge ${badge}"><span class="dot"></span>${esc(pc.status)}</span>
      </div>`;
    }
    html += `</div></div>`;
  }
  view().innerHTML = html;
}

/* =============================================================================
   TAB 3 — News & Media Updates
   ========================================================================== */

async function renderNews() {
  const head = pageHead('News & Media Updates', 'Live operational updates and official announcements.');
  view().innerHTML = head + loadingHtml();
  let list;
  try { list = await API.get('/news'); }
  catch (e) { view().innerHTML = head + errorHtml(e.message); return; }

  if (!list.length) { view().innerHTML = head + emptyHtml('No updates posted yet.'); return; }

  state.news = list; // kept so attachment clicks can look up the data URL
  let html = head + '<div class="card">';
  for (const n of list) {
    html += `<div class="news-item">
      <div class="news-top">
        ${catBadge(n.category)}
        ${n.pinned ? `<span class="badge badge-amber">Pinned</span>` : ''}
        <span class="news-time" style="margin-left:auto">${esc(relTime(n.timestamp))}</span>
      </div>
      <div class="news-title">${esc(n.title)}</div>
      <div class="news-body">${esc(n.body)}</div>
      ${attachmentsHtml(n)}
    </div>`;
  }
  html += '</div>';
  view().innerHTML = html;

  view().querySelectorAll('[data-att]').forEach((b) => b.addEventListener('click', () => {
    const [nid, idxStr] = b.dataset.att.split(':');
    const n = (state.news || []).find((x) => x.id === nid);
    const a = n && (n.attachments || [])[Number(idxStr)];
    if (!a) return;
    if (a.type && a.type.indexOf('image/') === 0) openLightbox(a.dataUrl, a.name);
    else openBlob(a.dataUrl);
  }));
}

/* ---- news attachments (images / PDFs) ------------------------------------- */

function attachmentsHtml(n) {
  const atts = n.attachments || [];
  if (!atts.length) return '';
  let h = '<div class="news-attach">';
  atts.forEach((a, i) => {
    const isImg = a.type && a.type.indexOf('image/') === 0;
    if (isImg) {
      h += `<button type="button" class="att-thumb" data-att="${esc(n.id)}:${i}" title="${esc(a.name)}"><img src="${a.dataUrl}" alt="${esc(a.name)}" loading="lazy"></button>`;
    } else {
      h += `<button type="button" class="att-file" data-att="${esc(n.id)}:${i}">${ICONS.file}<span>${esc(a.name)}</span></button>`;
    }
  });
  return h + '</div>';
}

function dataUrlToBlob(dataUrl) {
  const comma = dataUrl.indexOf(',');
  const mime = (dataUrl.slice(0, comma).match(/data:([^;]+)/) || [])[1] || 'application/octet-stream';
  const bin = atob(dataUrl.slice(comma + 1));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Open a PDF/file via a blob URL (browsers block navigating to data: URLs). */
function openBlob(dataUrl) {
  try {
    const url = URL.createObjectURL(dataUrlToBlob(dataUrl));
    const w = window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    if (!w) toast('Pop-up blocked — allow pop-ups to view the file.', 'error');
  } catch (e) { toast('Could not open the file.', 'error'); }
}

function openLightbox(dataUrl, name) {
  const existing = document.getElementById('lightbox');
  if (existing) existing.remove();
  const ov = document.createElement('div');
  ov.id = 'lightbox';
  ov.className = 'lightbox';
  ov.innerHTML = `<button class="lb-close" aria-label="Close">${ICONS.close}</button>
    <img src="${dataUrl}" alt="${esc(name || '')}">
    ${name ? `<div class="lb-name">${esc(name)}</div>` : ''}`;
  ov.addEventListener('click', (e) => { if (e.target === ov || e.target.closest('.lb-close')) ov.remove(); });
  document.addEventListener('keydown', function esc2(e) { if (e.key === 'Escape') { ov.remove(); document.removeEventListener('keydown', esc2); } });
  document.body.appendChild(ov);
}

/* =============================================================================
   TAB 4 — Transport & Shuttle Info
   ========================================================================== */

async function renderTransport() {
  const head = pageHead('Transport & Shuttles', 'Shuttle services from the Main Media Centre to stadiums and training sites — and back.');
  view().innerHTML = head + loadingHtml();
  let list;
  try { list = await API.get('/transport'); }
  catch (e) { view().innerHTML = head + errorHtml(e.message); return; }

  if (!list.length) { view().innerHTML = head + emptyHtml('No shuttle information available.'); return; }

  const sections = [
    { type: 'Stadium', label: 'Stadium shuttles' },
    { type: 'Training', label: 'Training-site shuttles' },
  ];
  let html = head;
  for (const s of sections) {
    const routes = list.filter((r) => r.type === s.type);
    if (!routes.length) continue;
    html += `<div class="section-label">${esc(s.label)}</div><div class="grid grid-auto">`;
    for (const r of routes) {
      const badge = r.type === 'Stadium' ? 'badge-blue' : 'badge-green';
      html += `<div class="card route-card">
        <div class="route-head"><span class="route-name">${esc(r.route)}</span><span class="badge ${badge}">${esc(r.type)}</span></div>
        <div class="route-path"><span class="stop">${esc(r.from)}</span><span class="arrow">${ICONS.arrow}</span><span class="stop">${esc(r.to)}</span></div>
        <div class="route-freq">${ICONS.refresh}${esc(r.frequency)}</div>
        <div class="route-stats">
          <div class="route-stat"><div class="k">First</div><div class="v">${esc(r.firstDeparture)}</div></div>
          <div class="route-stat"><div class="k">Last</div><div class="v">${esc(r.lastDeparture)}</div></div>
          <div class="route-stat"><div class="k">Duration</div><div class="v">${esc(r.duration || '—')}</div></div>
        </div>
        ${r.notes ? `<div class="route-notes">${esc(r.notes)}</div>` : ''}
      </div>`;
    }
    html += '</div>';
  }
  view().innerHTML = html;
}

window.addEventListener('DOMContentLoaded', init);
