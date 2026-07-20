-- =============================================================================
--  AFC Asian Cup 2027 — Media Hub — PostgreSQL schema (reference)
--
--  This file documents the schema for the Postgres backend. You do NOT need to
--  run it manually: src/store/pg-store.js creates these tables automatically
--  (idempotently) on first connect and seeds the reference data if empty.
--  It is provided here for DBAs / manual provisioning.
-- =============================================================================

CREATE TABLE IF NOT EXISTS meta (
  id       INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  event    TEXT,
  city     TEXT,
  subtitle TEXT
);

CREATE TABLE IF NOT EXISTS locations (
  id       TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  type     TEXT NOT NULL,          -- 'MMC' | 'Stadium' | 'Training'
  zone     TEXT,
  "window" TEXT                    -- quoted: WINDOW is a reserved keyword
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
  date                 TEXT NOT NULL,         -- calendar day 'YYYY-MM-DD' (event tz)
  status               TEXT NOT NULL DEFAULT 'Pending',  -- Pending | Redeemed | Expired
  issued_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  redeemed_at          TIMESTAMPTZ,
  -- Enforces the daily allocation limit at the database level:
  CONSTRAINT uq_voucher_per_day UNIQUE (email, location_id, date, meal_type)
);
CREATE INDEX IF NOT EXISTS idx_vouchers_date  ON vouchers (date);
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

-- Web Push (VAPID) subscriptions registered by client-app browsers.
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint    TEXT PRIMARY KEY,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
