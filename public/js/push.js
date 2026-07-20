'use strict';

/* =============================================================================
   Web Push subscription manager for the News tab. Talks to the service worker
   (already registered in index.html) and the /api/push/* endpoints.
   ========================================================================== */

const PushMgr = {
  supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  },

  /** The active subscription for this browser, or null. */
  async current() {
    if (!this.supported()) return null;
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  },

  async isSubscribed() {
    return !!(await this.current());
  },

  async subscribe() {
    if (!this.supported()) throw new Error('This browser does not support push notifications.');
    if (Notification.permission === 'denied') {
      throw new Error('Notifications are blocked for this site — enable them in your browser settings.');
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') throw new Error('Notification permission was not granted.');

    const { publicKey } = await API.get('/push/vapid-public-key');
    const reg = await navigator.serviceWorker.ready;
    const existing = await reg.pushManager.getSubscription();
    const sub = existing || await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    });

    await API.post('/push/subscribe', sub.toJSON());
    return sub;
  },

  async unsubscribe() {
    const sub = await this.current();
    if (!sub) return;
    const endpoint = sub.endpoint;
    await sub.unsubscribe();
    await API.post('/push/unsubscribe', { endpoint }).catch(() => {});
  },
};

/** Standard VAPID key conversion: base64url string -> Uint8Array. */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}
