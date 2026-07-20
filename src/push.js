'use strict';

/**
 * Web Push (VAPID) sender — broadcasts News updates to subscribed browsers.
 *
 * Configuration is optional: if VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY /
 * VAPID_SUBJECT aren't set, `configured` is false and the routes that depend
 * on this module respond "not configured" instead of crashing the server —
 * push notifications are an enhancement, not core to voucher issuance.
 *
 * Generate a key pair once with: npm run push:keys
 */

const webPush = require('web-push');
const store = require('./store');

const VAPID_PUBLIC_KEY = (process.env.VAPID_PUBLIC_KEY || '').trim();
const VAPID_PRIVATE_KEY = (process.env.VAPID_PRIVATE_KEY || '').trim();
const VAPID_SUBJECT = (process.env.VAPID_SUBJECT || '').trim();

const configured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY && VAPID_SUBJECT);

if (configured) {
  webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/** Plain-text preview of a news body, short enough for a notification. */
function preview(body, max = 140) {
  const s = String(body || '').trim();
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/**
 * Push a News item to every subscribed browser. Best-effort: a subscription
 * the push service reports as gone (404/410 — the user uninstalled the app or
 * revoked permission) is pruned from storage; any other per-subscription
 * failure is logged and skipped without affecting the rest of the broadcast.
 *
 * @returns {Promise<{sent:number, failed:number, total:number}>}
 */
async function sendNewsPush(item) {
  if (!configured) return { sent: 0, failed: 0, total: 0 };

  const subs = await store.listPushSubscriptions();
  if (!subs.length) return { sent: 0, failed: 0, total: 0 };

  const payload = JSON.stringify({
    title: item.title,
    body: preview(item.body),
    // Dedicated notification-sized art, not the 512px app logo: OS notification
    // surfaces render icons as raster images at small sizes (down to ~18px in
    // the Android status bar), and the app's detailed ticket-glyph logo turned
    // into an oversized, illegible blob there. `badge` in particular gets
    // reduced to a flat monochrome silhouette, so it must be a simple shape on
    // a transparent background — see public/icons/notification-badge.svg.
    icon: '/icons/notification-icon-256.png',
    badge: '/icons/notification-badge-96.png',
    data: {
      article_id: item.id,
      category: item.category,
      deep_link_url: `/#news?article=${encodeURIComponent(item.id)}`,
    },
  });

  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webPush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        sent += 1;
      } catch (err) {
        failed += 1;
        if (err.statusCode === 404 || err.statusCode === 410) {
          await store.deletePushSubscription(sub.endpoint).catch(() => {});
        } else {
          console.error('[push] send failed:', err.statusCode || '', err.message);
        }
      }
    })
  );

  return { sent, failed, total: subs.length };
}

module.exports = { configured, publicKey: VAPID_PUBLIC_KEY, sendNewsPush };
