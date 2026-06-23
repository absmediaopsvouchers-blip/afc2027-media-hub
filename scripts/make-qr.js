'use strict';

/**
 * Generate a printable QR code (PNG) that opens the Media Client app.
 *
 *   npm run qr                       -> auto-detect the LAN URL (http://<lan-ip>:<port>/)
 *   npm run qr -- https://your.app   -> use an explicit URL (e.g. your cloud domain)
 *
 * Writes "client-app-qr.png" to the project root.
 */

require('../src/env');

const os = require('os');
const path = require('path');
const QRCode = require('qrcode');

function firstLanIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) return net.address;
    }
  }
  return 'localhost';
}

const arg = process.argv[2];
const port = process.env.PORT || 3000;
const url = arg || `http://${firstLanIp()}:${port}/`;
const out = path.join(__dirname, '..', 'client-app-qr.png');

QRCode.toFile(out, url, {
  width: 900,
  margin: 2,
  errorCorrectionLevel: 'M',
  color: { dark: '#12274a', light: '#ffffff' }, // on-brand navy on white
})
  .then(() => {
    console.log('QR code written to: ' + out);
    console.log('It opens:           ' + url);
    if (!arg) {
      console.log('\nTip: that is this computer\'s Wi-Fi address — good for phones on the');
      console.log('same network. After deploying to the cloud, regenerate with your public');
      console.log('URL:  npm run qr -- https://your-app.onrender.com');
    }
  })
  .catch((err) => {
    console.error('Failed to generate QR code:', err.message);
    process.exit(1);
  });
