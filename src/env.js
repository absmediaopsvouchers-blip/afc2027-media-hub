'use strict';

/**
 * Minimal, zero-dependency `.env` loader.
 *
 * Cloud hosts (Render, Fly.io, serverless platforms) inject configuration as
 * real environment variables, so this file only matters for LOCAL development:
 * it reads a `.env` file at the project root (if present) into `process.env`.
 *
 * Anything already set in the real environment always wins — we never clobber
 * a variable the host provided.
 *
 * Require this module once, first thing, before anything reads process.env.
 */

const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    return; // No .env file — perfectly fine (this is how it runs in the cloud).
  }

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const eq = line.indexOf('=');
    if (eq === -1) continue;

    const key = line.slice(0, eq).trim();
    if (!key) continue;

    let value = line.slice(eq + 1).trim();
    // Strip matching surrounding quotes.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnv(path.join(__dirname, '..', '.env'));

module.exports = { loadEnv };
