'use strict';

/**
 * Timezone-aware "calendar day" helpers.
 *
 * Voucher limits reset at LOCAL MIDNIGHT in the event's timezone — NOT the
 * server's UTC clock (a cloud server in another region must still reset at the
 * right moment for the venue). The timezone is configured with the
 * EVENT_TIMEZONE environment variable, e.g. "Asia/Riyadh" or "Asia/Baku".
 */

const DEFAULT_TZ = 'Asia/Riyadh';

/** The configured IANA event timezone (falls back to a sensible default). */
function eventTimezone() {
  return process.env.EVENT_TIMEZONE || DEFAULT_TZ;
}

/**
 * The current calendar day in the event timezone, formatted "YYYY-MM-DD".
 * Uses Intl (built into Node) — no external dependency. The "en-CA" locale
 * conveniently formats dates as YYYY-MM-DD.
 *
 * @param {string} [tz] IANA timezone (defaults to EVENT_TIMEZONE)
 * @param {Date}   [d]  the instant to evaluate (defaults to now)
 */
function todayInTz(tz = eventTimezone(), d = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch (e) {
    // Invalid/unknown timezone string — degrade gracefully to UTC.
    console.warn(`[time] Invalid EVENT_TIMEZONE "${tz}" — falling back to UTC.`);
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  }
}

module.exports = { eventTimezone, todayInTz, DEFAULT_TZ };
