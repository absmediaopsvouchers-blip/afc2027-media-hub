'use strict';

/**
 * Cross-platform UI self-diagnosis for the Media Hub client app.
 *
 *   npm run test:devices
 *
 * Spins up the local server (server.js) in legacy open mode (file-store, no MEO
 * key so the app never depends on Firebase to render), then drives a headless
 * Chromium through four device profiles — desktop, iPhone, iPad and Android —
 * and for each one:
 *
 *   • loads the homepage,
 *   • checks the computed font-size of the main body text is the expected value
 *     (i.e. mobile text auto-inflation was successfully disabled),
 *   • checks for unintended horizontal overflow,
 *   • saves a full-page screenshot to tests/screenshots/.
 *
 * Exit code is non-zero if any device fails a check, so it can gate CI later.
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');

const PORT = process.env.TEST_PORT || 4321;
const BASE = `http://127.0.0.1:${PORT}`;
const SCREENSHOT_DIR = path.join(__dirname, '..', 'tests', 'screenshots');

// The app doesn't set an explicit <body> font-size, so it inherits the browser
// default of 16px. With text-size-adjust:100% this must stay 16px on EVERY
// device — a larger value on mobile would mean auto-inflation is still active.
const EXPECTED_BODY_FONT_PX = 16;

// Device emulation profiles. Custom descriptors (rather than puppeteer's
// KnownDevices) so the exact target hardware is covered and stable across
// puppeteer versions.
const DEVICES = [
  {
    name: 'Desktop-1080p',
    label: 'Desktop 1080p (Windows/Mac baseline)',
    viewport: { width: 1920, height: 1080, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  },
  {
    name: 'iPhone-15-Pro-Max',
    label: 'iPhone 15 Pro Max (iOS mobile)',
    viewport: { width: 430, height: 932, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'iPad-Pro-11',
    label: 'iPad Pro 11 (iOS tablet)',
    viewport: { width: 834, height: 1194, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  },
  {
    name: 'Pixel-7',
    label: 'Pixel 7 (Android mobile)',
    viewport: { width: 412, height: 915, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
  },
];

function waitForServer(url, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) reject(new Error('Server did not start in time.'));
        else setTimeout(tick, 300);
      });
    };
    tick();
  });
}

async function run() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // --- Boot the server in legacy open mode (file store, no Firebase). ---
  const server = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env: {
      ...process.env,
      PORT: String(PORT),
      ADMIN_KEY: 'diag-admin',
      VOLUNTEER_KEY: 'diag-volunteer',
      DATABASE_URL: '', // force the JSON file store — no DB dependency
      DATA_FILE: path.join(require('os').tmpdir(), `mediahub-diag-${Date.now()}.json`),
      MEO_SERVICE_ACCOUNT_JSON: '', // legacy open mode — no closed-loop gate
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stdout.on('data', () => {});
  server.stderr.on('data', (d) => process.stderr.write(`[server] ${d}`));

  const results = [];
  let browser;
  try {
    await waitForServer(`${BASE}/healthz`);
    browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    for (const device of DEVICES) {
      const page = await browser.newPage();
      await page.setUserAgent(device.userAgent);
      await page.setViewport(device.viewport);

      // Load the homepage and let the app render (theme + tabs + content).
      await page.goto(`${BASE}/`, { waitUntil: 'networkidle2', timeout: 20000 });
      await new Promise((r) => setTimeout(r, 900)); // settle async renders

      const metrics = await page.evaluate(() => {
        const bodyFont = parseFloat(getComputedStyle(document.body).fontSize);
        // A representative piece of running text on the default (News) tab.
        const textEl = document.querySelector('.page-head p, .news-body, .brand-title');
        const textFont = textEl ? parseFloat(getComputedStyle(textEl).fontSize) : null;
        const de = document.documentElement;
        const view = document.getElementById('view');
        return {
          bodyFont,
          textFont,
          textSizeAdjust: getComputedStyle(document.documentElement).webkitTextSizeAdjust
            || getComputedStyle(document.documentElement).textSizeAdjust || 'n/a',
          docScrollWidth: de.scrollWidth,
          innerWidth: window.innerWidth,
          bodyScrollWidth: document.body.scrollWidth,
          viewScrollWidth: view ? view.scrollWidth : null,
          viewClientWidth: view ? view.clientWidth : null,
          appbarBottom: (() => { const a = document.querySelector('.appbar'); return a ? Math.round(a.getBoundingClientRect().bottom) : null; })(),
        };
      });

      const horizontalOverflow = metrics.docScrollWidth > metrics.innerWidth
        || (metrics.viewScrollWidth != null && metrics.viewScrollWidth > metrics.viewClientWidth + 1);
      const fontOk = Math.abs(metrics.bodyFont - EXPECTED_BODY_FONT_PX) < 0.5;

      const file = path.join(SCREENSHOT_DIR, `${device.name}.png`);
      await page.screenshot({ path: file, fullPage: true });

      const pass = fontOk && !horizontalOverflow;
      results.push({ device: device.label, pass, fontOk, horizontalOverflow, metrics, file });
      await page.close();
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }

  // --- Report ---
  console.log('\n' + '='.repeat(70));
  console.log('  Media Hub — cross-device UI diagnostic');
  console.log('='.repeat(70));
  let failures = 0;
  for (const r of results) {
    if (!r.pass) failures++;
    console.log(`\n  ${r.pass ? 'PASS' : 'FAIL'}  ${r.device}`);
    console.log(`     body font-size : ${r.metrics.bodyFont}px  (expected ${EXPECTED_BODY_FONT_PX}px) ${r.fontOk ? '✓' : '✗ text auto-inflation?'}`);
    console.log(`     text-size-adjust: ${r.metrics.textSizeAdjust}`);
    console.log(`     running text   : ${r.metrics.textFont != null ? r.metrics.textFont + 'px' : 'n/a'}`);
    console.log(`     horiz overflow : doc ${r.metrics.docScrollWidth} vs vw ${r.metrics.innerWidth}` +
      (r.metrics.viewScrollWidth != null ? ` | .view ${r.metrics.viewScrollWidth}/${r.metrics.viewClientWidth}` : '') +
      `  ${r.horizontalOverflow ? '✗ OVERFLOW' : '✓ none'}`);
    console.log(`     screenshot     : ${path.relative(path.join(__dirname, '..'), r.file)}`);
  }
  console.log('\n' + '='.repeat(70));
  console.log(`  ${results.length - failures}/${results.length} devices passed.`);
  console.log('='.repeat(70) + '\n');

  process.exit(failures ? 1 : 0);
}

run().catch((err) => {
  console.error('Diagnostic run failed:', err);
  process.exit(2);
});
