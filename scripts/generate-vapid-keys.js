'use strict';

/**
 * One-time setup: generate a VAPID key pair for Web Push.
 *
 *   npm run push:keys
 *
 * Prints the keys to the terminal — copy them into your .env (local) or your
 * host's environment variables (production). Never commit them to git. The
 * private key signs push messages; anyone with it could send notifications
 * to your subscribers, so treat it like ADMIN_KEY.
 */

const webPush = require('web-push');

const keys = webPush.generateVAPIDKeys();

console.log('\nVAPID keys generated. Add these to your .env / host environment:\n');
console.log(`VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log('VAPID_SUBJECT=mailto:you@example.com   # contact address required by the push standard\n');
