'use strict';

/**
 * Closed-loop authentication against the MEO Desk Portal's client roster.
 *
 * The MEO Desk Portal (Firebase project `meo-desk-operations-portal`) is the
 * single source of truth for who is accredited. This module lets the Media Hub
 * backend validate a login email against that roster in real time, so only
 * people the MEO desk has registered can generate meal vouchers.
 *
 * Configuration is OPTIONAL. Set the service-account JSON in the environment to
 * turn the strict gate on:
 *
 *   MEO_SERVICE_ACCOUNT_JSON   the full service-account JSON (as a string), or
 *                              the same JSON base64-encoded (handy for hosts
 *                              that dislike newlines in env values).
 *   MEO_PROJECT_ID             optional override; defaults to the project id in
 *                              the service account.
 *
 * Generate the key in Firebase Console → meo-desk-operations-portal →
 * Project Settings → Service Accounts → "Generate new private key". Treat it
 * like ADMIN_KEY — never commit it.
 *
 * When unconfigured, `configured` is false and the login routes fall back to the
 * app's previous open behaviour, so the live system keeps working until the key
 * is set.
 */

const RAW = (process.env.MEO_SERVICE_ACCOUNT_JSON || '').trim();

let configured = false;
let db = null;
let initError = null;

/** Parse the service account from either raw JSON or base64-encoded JSON. */
function parseServiceAccount(raw) {
  if (!raw) return null;
  let text = raw;
  // If it doesn't look like JSON, assume base64.
  if (!raw.startsWith('{')) {
    try { text = Buffer.from(raw, 'base64').toString('utf8'); } catch (e) { return null; }
  }
  try { return JSON.parse(text); } catch (e) { return null; }
}

(function init() {
  if (!RAW) return; // Not configured — strict gate stays off.
  let admin;
  try {
    admin = require('firebase-admin');
  } catch (e) {
    initError = "MEO_SERVICE_ACCOUNT_JSON is set but 'firebase-admin' is not installed.";
    console.error('[meo-auth]', initError);
    return;
  }
  const serviceAccount = parseServiceAccount(RAW);
  if (!serviceAccount || !serviceAccount.project_id) {
    initError = 'MEO_SERVICE_ACCOUNT_JSON could not be parsed as a service-account JSON.';
    console.error('[meo-auth]', initError);
    return;
  }
  try {
    // Named app so this never collides with any other firebase-admin usage.
    const app = admin.apps.find((a) => a && a.name === 'meo')
      || admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: process.env.MEO_PROJECT_ID || serviceAccount.project_id,
      }, 'meo');
    db = admin.firestore(app);
    configured = true;
    console.log('[meo-auth] MEO closed-loop auth enabled (project:', serviceAccount.project_id + ').');
  } catch (e) {
    initError = e.message;
    console.error('[meo-auth] init failed:', e.message);
  }
})();

/**
 * Look up an accredited client by email in the MEO roster.
 * @returns {Promise<{found: true, accreditationNumber, name, role, agencyName}|{found: false}>}
 */
async function lookupClientByEmail(email) {
  if (!configured || !db) return { found: false };
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return { found: false };

  // MEO stores email as a field on each clients/{accreditationNumber} doc.
  // Try the normalized (lowercase) form first, then the raw as a fallback for
  // any legacy records stored with mixed case.
  const candidates = [normalized];
  const raw = String(email || '').trim();
  if (raw && raw !== normalized) candidates.push(raw);

  for (const value of candidates) {
    let snap;
    try {
      snap = await db.collection('clients').where('email', '==', value).limit(1).get();
    } catch (e) {
      console.error('[meo-auth] lookup failed:', e.message);
      throw e; // let the caller decide how to surface a backend failure
    }
    if (!snap.empty) {
      const doc = snap.docs[0];
      const data = doc.data() || {};
      return {
        found: true,
        accreditationNumber: doc.id, // MEO uses the accreditation number as the doc id
        name: data.name || '',
        role: data.role || '',
        agencyName: data.agencyName || '',
      };
    }
  }
  return { found: false };
}

module.exports = {
  get configured() { return configured; },
  get initError() { return initError; },
  lookupClientByEmail,
};
