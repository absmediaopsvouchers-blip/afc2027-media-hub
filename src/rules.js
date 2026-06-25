'use strict';

/**
 * Voucher business rules — the single source of truth for what a media member
 * is allowed to claim. Keeping this in one place makes the policy easy to audit
 * and to change.
 *
 * Allocation policy (enforced per Email, per Location, per calendar day):
 *
 *   • Main Media Centre (MMC)
 *       → 1 Lunch AND 1 Dinner voucher.
 *         (You may hold both, but not two of the same meal type at the same
 *          location on the same day.)
 *
 *   • Stadiums
 *       → 1 Meal total (grants access to the venue Media Café).
 *         (No second meal of any kind at that stadium on the same day.)
 *
 *   • Training Sites
 *       → NO meal vouchers. Training venues still exist for transport/info,
 *         but are out of scope for catering — no Lunch/Dinner/Meal is offered.
 *
 * The "calendar day" is computed in the EVENT_TIMEZONE (see src/time.js), so the
 * daily reset happens at the venue's local midnight regardless of where the
 * cloud server physically runs.
 *
 * NOTE ON SCOPE: limits are applied per individual location. A journalist who
 * legitimately travels between, say, the MMC and a training ground may hold a
 * lunch at each. To make the limit global across a category instead, query
 * same-day vouchers by location TYPE rather than location id where
 * checkEligibility is called (src/routes.js) — the logic here needs no change.
 */

// The meal types each location type offers.
const MEALS_BY_TYPE = {
  MMC: ['Lunch', 'Dinner'],
  Training: [], // Training Sites are out of scope for meals (transport/info only)
  Stadium: ['Meal'],
};

// Voucher lifecycle states.
const STATUS = {
  PENDING: 'Pending', // generated but not yet eaten
  REDEEMED: 'Redeemed', // scanned / used at the counter
  EXPIRED: 'Expired', // unused past its calendar day
};

// The valid location types an admin may assign to a venue.
const LOCATION_TYPES = ['MMC', 'Stadium', 'Training'];

/** @returns {string[]} valid meal types for a location type. */
function allowedMeals(type) {
  return MEALS_BY_TYPE[type] || [];
}

/**
 * Decide whether a voucher may be issued, given the vouchers this email already
 * holds at this location today.
 *
 * @param {object}   args
 * @param {object[]} args.existing  same email + same location + same day vouchers
 * @param {object}   args.location  the chosen location record ({ type, name })
 * @param {string}   args.mealType  requested meal type
 * @returns {{ok: true} | {ok: false, code: string, message: string}}
 */
function checkEligibility({ existing, location, mealType }) {
  if (!allowedMeals(location.type).includes(mealType)) {
    return {
      ok: false,
      code: 'INVALID_MEAL',
      message: `${mealType || 'That meal'} is not available at ${location.name}.`,
    };
  }

  // Expired vouchers belong to a previous calendar day and never appear in
  // "today" results, so every voucher in `existing` counts against the limit.
  if (location.type === 'Stadium') {
    if (existing.length > 0) {
      return {
        ok: false,
        code: 'LIMIT_REACHED',
        message: `You have already claimed your Media Café meal at ${location.name} today.`,
      };
    }
  } else if (existing.some((v) => v.mealType === mealType)) {
    return {
      ok: false,
      code: 'LIMIT_REACHED',
      message: `You have already claimed your ${mealType} voucher at ${location.name} today.`,
    };
  }

  return { ok: true };
}

module.exports = { MEALS_BY_TYPE, STATUS, LOCATION_TYPES, allowedMeals, checkEligibility };
