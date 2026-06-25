# AFC Asian Cup 2027 — Meal Vouchers & Media Info Hub

A **cloud-deployable** full-stack web app for event media operations. It issues
**digital meal vouchers** with QR codes, lets catering staff **scan & redeem**
them, and acts as an information hub (press conferences, news, transport) for
accredited media. Daily voucher limits are enforced **centrally on the server**,
so they **cannot be bypassed** by using incognito mode or clearing the cache.

The system has two faces:

| | URL | Audience |
|---|---|---|
| **Media Client App** | `/` | Journalists / media on their phones |
| **Admin & Catering Dashboard** | `/admin` | Organizers + buffet-counter staff |

It runs anywhere Node runs: locally off a laptop on the venue Wi-Fi, **or on free
cloud tiers** (Render / Fly.io) with a managed database (Neon / Supabase / Mongo
Atlas) so media can reach it globally over 4G/5G.

---

## Contents
- [Features](#features)
- [Business rules](#business-rules-enforced-server-side)
- [Voucher lifecycle](#voucher-lifecycle)
- [Tech stack & pluggable storage](#tech-stack--pluggable-storage)
- [Quick start (local)](#quick-start-local)
- [Environment variables](#environment-variables)
- [Cloud deployment](#cloud-deployment)
- [PWA / Add to Home Screen](#pwa--add-to-home-screen)
- [Admin access](#admin-access)
- [API reference](#api-reference)
- [Project structure](#project-structure)

---

## Features

### Media Client App (4 tabs, mobile-first PWA)
1. **Meal Voucher** — request a voucher. First-time users link their email to an
   accreditation number; returning users just enter their email (cached in
   `localStorage`). Returns a digital ticket with a **QR code** (encoding the
   Voucher ID) and a **live status badge** that flips from *Pending* to
   *Redeemed* in real time the moment catering scans it. All of a user's
   vouchers for the day are saved (server-backed, cached on-device) and listed
   under **“Your vouchers — today”**, so they can reopen any QR until local
   midnight — even after closing the app or switching to another device.
2. **Press Conferences** — schedule grouped by day with live status badges
   (Scheduled / Live / Delayed / Concluded). Rooms come from the venues database.
3. **News & Media Updates** — announcements, alerts and operational updates.
4. **Transport & Shuttles** — MMC ⇄ stadium / training-site shuttle routes,
   frequencies and timings.

### Admin & Catering Dashboard
- **Overview** — live counters (issued today, **redeemed today**, registered
  media, stadium-café meals), bar charts (by meal type / location type / venue),
  an auto-refreshing live feed (every 5s) showing vouchers as they are claimed or
  scanned, and a **one-click CSV export** of the full voucher log.
- **Redeemer (catering)** — buffet-counter view to **scan a QR with the device
  camera** or **type the Voucher ID**. Flashes a green **“SUCCESS — MEAL VALID”**
  and marks the voucher `Redeemed`; if already used, flashes a red
  **“WARNING — ALREADY REDEEMED”** with the original timestamp.
- **Venue Manager** — add / edit / delete venues. A venue's **Type**
  (Main Media Centre / Stadium / Training Site) drives the allocation rules.
- **News Manager** — add / edit / delete news with categories and a “pin to top”.
- **Press Manager** — create / update conferences and their status badges.

---

## Business rules (enforced server-side)

Per **unique email**, per **calendar day** (the day resets at local midnight in
the configured `EVENT_TIMEZONE`):

| Location type | Allowance |
|---|---|
| Main Media Centre (MMC) | **1 Lunch** and **1 Dinner** |
| Stadiums | **1 Meal** total (Media Café access) |
| Training Sites | **No meal vouchers** — transport & info only |

Limits are applied **per location**, so a journalist legitimately travelling
between media centres may hold a lunch at each. Training Sites are out of scope
for catering and don't appear in the voucher location list. The policy lives in
one file — [`src/rules.js`](src/rules.js). On the SQL/Mongo backends the
limit is additionally enforced by a database **UNIQUE constraint**
`(email, location, date, meal_type)`, so it holds even under concurrent requests.

A duplicate request returns a clear error which the client shows as a friendly
“already claimed” message.

---

## Voucher lifecycle

Every voucher has one of three states:

| State | Meaning |
|---|---|
| `Pending` | Generated but not yet eaten. |
| `Redeemed` | Scanned / used at the counter (records the timestamp). |
| `Expired` | Unused past its calendar day (rolled over automatically). |

---

## Tech stack & pluggable storage

- **Backend:** Node.js + [Express](https://expressjs.com/)
- **QR codes:** generated **server-side** with [`qrcode`](https://www.npmjs.com/package/qrcode)
  (clients need no internet and no QR library)
- **Frontend:** plain HTML/CSS/JavaScript — no build step, no framework
- **Camera scanning:** the native `BarcodeDetector` API (no dependency); manual
  entry is always available as a fallback

**Storage is pluggable and auto-selected from `DATABASE_URL`:**

| `DATABASE_URL` | Backend | Driver | Use |
|---|---|---|---|
| *(unset)* | JSON file (`data.json`) | none | Local dev / single-laptop venue |
| `postgres://…` / `postgresql://…` | **PostgreSQL** | `pg` | Cloud (Neon, Supabase, Render PG) |
| `mongodb://…` / `mongodb+srv://…` | **MongoDB** | `mongoose` | Cloud (MongoDB Atlas) |

The database drivers are **optional dependencies, loaded lazily** — local file
mode needs nothing installed. On a cloud database the schema is **created and
seeded automatically** on first boot.

---

## Quick start (local)

### Option A — Zero install (Windows) ✅
This folder ships with a self-contained copy of Node.js (`.node-portable/`) and
dependencies pre-installed:

- **Double-click `start.bat`**, or in PowerShell:
  ```powershell
  powershell -ExecutionPolicy Bypass -File .\start.ps1
  ```

Then open **http://localhost:3000** (admin at **/admin**). Uses the local
`data.json` store — no database to set up.

### Option B — Your own Node.js (any OS)
Requires [Node.js](https://nodejs.org/) 18+.
```bash
npm install
npm start
```

A demo media account is seeded: `demo.reporter@press.example`
(accreditation `AFC-MED-10293`) — enter just that email to test the
“returning user” flow.

---

## Environment variables

Copy [`.env.example`](.env.example) to `.env` for local development, or set these
in your cloud host's dashboard. **Nothing is required for local file mode.**

| Variable | Required | Description |
|---|---|---|
| `PORT` | no | Port to listen on. Cloud hosts set this automatically. Default `3000`. |
| `DATABASE_URL` | no | Postgres or Mongo connection string. **Unset → local JSON file store.** |
| `ADMIN_KEY` | recommended | Protects `/admin` and admin APIs. Default `afc2027-media` — **change it for production.** |
| `EVENT_TIMEZONE` | no | IANA timezone for the daily calendar-day reset, e.g. `Asia/Riyadh`. Default `Asia/Riyadh`. |

---

## Cloud deployment

> Free tiers may **sleep when idle**; the first request after a nap can take a few
> seconds to wake. Always set a real `DATABASE_URL` in the cloud so data survives
> instance restarts (the local file store does **not** persist on most free tiers).

### Render — one-click Blueprint (recommended)

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/absmediaopsvouchers-blip/afc2027-media-hub)

This repo includes [`render.yaml`](render.yaml), which provisions a free web
service **and** a free Postgres database and wires `DATABASE_URL` automatically.

1. Click the **Deploy to Render** button above (sign in to Render with GitHub the
   first time — this is the one step only you can do).
2. Render reads `render.yaml` and shows the web service + free Postgres it will
   create. When prompted, set **`ADMIN_KEY`** to your own secret.
3. Click **Apply**. After ~3–5 min your app is live at
   `https://<name>.onrender.com` (admin at `/admin`).

### Render / any host — manual, with Neon or Supabase Postgres
1. Create a free Postgres database at **[Neon](https://neon.tech)** or
   **[Supabase](https://supabase.com)** and copy its connection string
   (include `?sslmode=require`).
2. Create a **Web Service** from the repo with:
   - Build command: `npm install`
   - Start command: `node server.js`
   - Health check path: `/healthz`
3. Set env vars: `DATABASE_URL`, `ADMIN_KEY`, `EVENT_TIMEZONE`.
4. Deploy. Tables are created and seeded automatically on first boot.

### MongoDB Atlas instead of Postgres
Create a free cluster at **[MongoDB Atlas](https://www.mongodb.com/atlas)**, then
set `DATABASE_URL` to your `mongodb+srv://…` string. The app detects Mongo from
the scheme and uses `mongoose` — no other change needed.

### Fly.io / Docker hosts
A [`Dockerfile`](Dockerfile), [`fly.toml`](fly.toml) and [`Procfile`](Procfile)
are included, so this runs on Fly.io, Railway, Cloud Run, Render-Docker, etc.
For Fly: `flyctl launch --no-deploy` (accept the bundled `fly.toml`), attach a
database (`flyctl postgres create` + `flyctl postgres attach`, which sets
`DATABASE_URL`), set secrets `flyctl secrets set ADMIN_KEY=…`, then `flyctl deploy`.

### Instant public link without deploying (tunnel)
To make your **locally running** server reachable over cellular or any other
network *right now* — no cloud account, but your laptop must stay on — expose it
with a tunnel while `start.bat` is running:

- **Cloudflare (no signup, clean HTTPS URL):** install `cloudflared`, then:
  ```bash
  cloudflared tunnel --url http://localhost:3000
  ```
  It prints a public `https://<random>.trycloudflare.com` address. Make a QR for
  it with `npm run qr -- https://<random>.trycloudflare.com`.
- **Alternatives:** `ngrok http 3000` (free account) or `npx localtunnel --port 3000`.

Tunnels are ideal for demos and short events. For a permanent URL that survives
the laptop being off, deploy to the cloud (above).

### Provisioning the database manually (optional)
`npm run db:init` creates the schema and seeds reference data for whatever
`DATABASE_URL` points at. A reference schema is in
[`src/store/schema.sql`](src/store/schema.sql).

---

## Sharing access (QR code)

Get media onto the client app fast:
- **Printable page:** open **`/share`** (or admin → Overview → **Share QR**). It shows
  a QR + URL that **auto-matches whatever address the app is served on** — your LAN
  IP locally, or your public domain once deployed — with a Print button.
- **Image file:** run **`npm run qr`** to write `client-app-qr.png` for the current
  LAN address, or **`npm run qr -- https://your-app.onrender.com`** for your cloud URL.

## PWA / Add to Home Screen

The client app ships a web manifest and a service worker, so on a phone you can
use the browser's **“Add to Home Screen”** to run it full-screen like a native
app. The app shell is cached for offline resilience; API calls always go to the
network so voucher limits stay authoritative.

---

## Admin access

- Open `/admin` and enter the **admin key** (default `afc2027-media`; override
  with the `ADMIN_KEY` env var).
- The key is sent with admin requests and remembered for the browser session.
- The CSV export and admin APIs require the same key.

> **Security scope.** The admin key is a lightweight gate. Anything internet-facing
> should run behind **HTTPS** (Render/Fly provide this automatically) and you
> should set a strong `ADMIN_KEY`.

---

## API reference (all under `/api`)

**Public**
| Method | Path | Purpose |
|---|---|---|
| GET | `/meta` | event branding + `timezone` + `today` |
| GET | `/locations` | venues + the meals each offers |
| GET | `/user/:email` | is this email already registered? |
| POST | `/vouchers` | request a voucher (rules enforced) |
| GET | `/vouchers?email=` | a user's vouchers for today (with QR) — powers the saved list |
| GET | `/vouchers/:id` | live voucher status (Pending/Redeemed/Expired) |
| GET | `/share` | `{ url, qr }` — QR + URL to open the client app (auto-detects the live host) |
| GET | `/news` · `/press-conferences` · `/transport` | hub content |

**Admin** (require header `x-admin-key: <key>` or `?key=`)
| Method | Path | Purpose |
|---|---|---|
| POST | `/admin/login` | validate the admin key |
| GET | `/analytics` | dashboard metrics + live feed |
| POST | `/admin/redeem` | validate & redeem a voucher (`{ voucherId }`) |
| GET | `/admin/export.csv` | download the full voucher log |
| POST · PUT · DELETE | `/locations[/:id]` | venue manager |
| POST · PUT · DELETE | `/news[/:id]` | news manager |
| POST · PUT · DELETE | `/press-conferences[/:id]` | press manager |

Example voucher request:
```bash
curl -X POST http://localhost:3000/api/vouchers \
  -H "Content-Type: application/json" \
  -d '{"email":"jo@press.example","accreditationNumber":"AFC-MED-55512","locationId":"MMC-01","mealType":"Lunch"}'
```

---

## Resetting / backing up data

- **File store:** all data lives in `data.json` at the project root — copy it to
  back up. `npm run reset` deletes it so it re-seeds on next start.
- **Cloud database:** reset by clearing the tables/collections via your provider.

---

## Project structure

```
.
├── server.js              # Express app: env, store init, routing, banner
├── render.yaml            # Render Blueprint (web + free Postgres)
├── Dockerfile             # container image (Fly.io / Railway / Cloud Run / …)
├── fly.toml               # Fly.io config
├── Procfile               # generic PaaS start command
├── .env.example           # all environment variables, documented
├── package.json
├── src/
│   ├── env.js             # tiny zero-dependency .env loader
│   ├── time.js            # EVENT_TIMEZONE-aware calendar-day helpers
│   ├── rules.js           # voucher allocation policy (single source of truth)
│   ├── seed.js            # initial demo data (dates relative to "today")
│   ├── routes.js          # all REST API endpoints
│   └── store/
│       ├── index.js       # auto-selects the backend from DATABASE_URL
│       ├── file-store.js  # JSON file backend (default)
│       ├── pg-store.js    # PostgreSQL backend (lazy `pg`)
│       ├── mongo-store.js # MongoDB backend (lazy `mongoose`)
│       └── schema.sql     # reference SQL schema
├── scripts/
│   ├── init-db.js         # `npm run db:init` (create schema + seed)
│   └── reset-db.js        # `npm run reset` (wipe local file store)
└── public/
    ├── index.html         # client app shell (+ PWA manifest/SW)
    ├── admin.html         # admin dashboard shell
    ├── manifest.webmanifest
    ├── sw.js              # service worker (offline app shell)
    ├── icons/icon.svg
    ├── css/{styles,admin}.css
    └── js/{common,app,admin}.js
```

---

## Notes
- **Offline-friendly.** QR codes are generated on the server; the IBM Plex web
  font loads from a CDN but falls back to system fonts with no internet.
- **Calendar day** is computed in `EVENT_TIMEZONE`, so limits reset at the
  venue's local midnight regardless of where the cloud server physically runs.
- **Camera scanning** uses the native `BarcodeDetector` (Android Chrome works
  well). Where unsupported, staff type the Voucher ID — the result is identical.
```
