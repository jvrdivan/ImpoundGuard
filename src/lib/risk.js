// src/lib/risk.js
//
// The whole risk model. Pure functions only — no fetch, no state, no LLM
// call. This has to be instant and dependable at demo time, and it has to
// be a formula the pitcher can say out loud, not a black box.
//
//   urgency  (U) = 1 if expired, else how close the worst document is to
//                  lapsing, ramped over a 30-day window
//   revenue  (R) = this vehicle's daily income, relative to the fleet's
//                  highest earner                          → 0..1
//   scarcity (C) = how few compliant, capable spares exist to cover this
//                  vehicle's route if it goes offline       → 0..1
//                  0 spares of a compatible type = 1 (fully scarce);
//                  3+ = 0 (fully replaceable). A vehicle with no route
//                  (itself a spare) has nothing to protect, so C = 0.
//   stake        = w·C + (1-w)·R       (w = the owner-adjustable slider)
//   score        = 100 × U × stake
//
// Multiplicative on purpose: a vehicle with 200 days of runway scores near
// zero no matter how much it earns or how scarce its coverage — urgency
// gates everything else. An expired document pins urgency to 1.
//
// scarcity replaced an earlier "safety" weight (passengerLoad relative to
// the fleet's fullest vehicle). That was a moral weighting exercise — it
// asked an owner to price how many lives a route carries, which isn't a
// number a dashboard should be asking for. Scarcity asks something a fleet
// manager actually decides on: not "how much do I value this route" but
// "if I pull this vehicle for inspection, is there anything else that can
// physically run its route." See db/schema.sql's routes/reserve design
// and src/lib/schedule.js, which computes the same substitution rule for
// actual weekly assignment — this is the fleet-wide, at-a-glance version
// of the same fact.

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const URGENCY_WINDOW_DAYS = 30;

export const RISK_TIER = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
};

/** Days remaining until `expiryDate` (may be negative if already expired). */
export function daysUntil(expiryDate, now = new Date()) {
  const expiry = new Date(`${expiryDate}T23:59:59`);
  return (expiry.getTime() - now.getTime()) / MS_PER_DAY;
}

/** The document closest to lapsing, i.e. the one that sets the vehicle's risk. */
export function worstDocument(vehicle, now = new Date()) {
  if (!vehicle.documents || vehicle.documents.length === 0) return null;
  return vehicle.documents.reduce((worst, doc) => {
    if (!worst) return doc;
    return daysUntil(doc.expiryDate, now) < daysUntil(worst.expiryDate, now) ? doc : worst;
  }, null);
}

function urgencyFromDaysLeft(daysLeft) {
  if (daysLeft <= 0) return 1;
  return clamp((URGENCY_WINDOW_DAYS - daysLeft) / URGENCY_WINDOW_DAYS, 0, 1);
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Is this vehicle currently able to stand in for another? Shared with
 * schedule.js's week-by-week matching so the headline scarcity score and
 * the actual scheduling engine can never disagree about who counts as a
 * usable spare.
 */
export function isCompliant(vehicle, now = new Date()) {
  const doc = worstDocument(vehicle, now);
  return Boolean(doc) && daysUntil(doc.expiryDate, now) > 0;
}

// 3+ compatible, compliant spares and a route is considered fully
// replaceable — scarcity bottoms out at 0 rather than needing an unbounded
// reserve. Chosen, not measured: three deep is a reasonable real-world
// bar for "not actually at risk," and it is a constant precisely so it is
// easy to point at and argue with.
const FULLY_REPLACEABLE_AT = 3;

/**
 * How scarce is cover for this vehicle's route, right now? Vehicles with
 * no route (spares) return 0 — there is nothing for them to protect.
 * Exported: reports.js reuses this directly rather than re-deriving its
 * own notion of "uncovered," so the risk score, the schedule panel, and
 * the forecast all agree about which vehicles have nothing behind them.
 */
export function scarcityFor(vehicle, spares, now) {
  if (!vehicle.route) return 0;
  const compatibleSpares = spares.filter(
    (s) =>
      s.type === vehicle.type &&
      s.passengerLoad >= vehicle.route.minCapacity &&
      isCompliant(s, now)
  ).length;
  return clamp(1 - compatibleSpares / FULLY_REPLACEABLE_AT, 0, 1);
}

/**
 * Score one vehicle against the fleet. `weight` (0..1) is the
 * owner-adjustable slider: 0 = pure revenue, 1 = pure scarcity of cover.
 * `fleetMax.income` and `spares` are both fleet-wide, computed once by
 * rankFleet and passed in, so every vehicle is scored relative to the
 * same fleet rather than in isolation.
 */
export function scoreVehicle(vehicle, fleetMax, spares, weight = 0.5, now = new Date()) {
  const doc = worstDocument(vehicle, now);
  const daysLeft = doc ? daysUntil(doc.expiryDate, now) : Infinity;
  const isExpired = doc ? daysLeft <= 0 : false;
  const urgency = doc ? urgencyFromDaysLeft(daysLeft) : 0;

  const scarcity = scarcityFor(vehicle, spares, now);
  const revenue = fleetMax.income > 0 ? vehicle.dailyIncome / fleetMax.income : 0;
  const stake = weight * scarcity + (1 - weight) * revenue;

  const score = 100 * urgency * stake;
  const tier = isExpired || score >= 38 ? RISK_TIER.HIGH : score >= 15 ? RISK_TIER.MEDIUM : RISK_TIER.LOW;

  return {
    score,
    tier,
    urgency,
    stake,
    scarcity,
    revenue,
    daysLeft,
    isExpired,
    worstDoc: doc,
    reasoning: formatReasoning(vehicle, daysLeft, isExpired),
  };
}

export const STATUS = {
  NO_CERTIFICATE: 'NO_CERTIFICATE',
  CRITICAL: 'CRITICAL',
  DUE_SOON: 'DUE_SOON',
  COMPLIANT: 'COMPLIANT',
};

/**
 * The single source of truth for "what state is this vehicle in," used by
 * every piece of UI that labels risk — the action queue's status badge,
 * the compliance-outlook bar, and the KPI cards. They used to classify
 * independently (one by raw days-to-expiry, one by risk tier) and could
 * disagree on the same vehicle; this is the fix, and there's now exactly
 * one place classification logic can be changed.
 */
export function classifyStatus(result) {
  if (!result.worstDoc) return STATUS.NO_CERTIFICATE;
  if (result.isExpired || result.tier === RISK_TIER.HIGH) return STATUS.CRITICAL;
  if (result.tier === RISK_TIER.MEDIUM) return STATUS.DUE_SOON;
  return STATUS.COMPLIANT;
}

/**
 * Plain string formatting — no second LLM call, so it's instant and never
 * fails. Describes the route this vehicle would leave uncovered, not a
 * passenger count — that's the actual stake now, and it's the same fact
 * the schedule panel would show for the same vehicle.
 */
export function formatReasoning(vehicle, daysLeft, isExpired) {
  const routePart = vehicle.route ? `covers ${vehicle.route.name}` : 'held in reserve, no route';
  const revenuePart = `${formatRand(vehicle.dailyIncome)}/day at risk`;
  const timePart = isExpired
    ? 'EXPIRED — impound risk now'
    : `${Math.max(0, Math.ceil(daysLeft))} day${Math.ceil(daysLeft) === 1 ? '' : 's'} to noncompliance`;
  return `${timePart} · ${routePart} · ${revenuePart}`;
}

function formatRand(amount) {
  return `R${Math.round(amount).toLocaleString('en-ZA')}`;
}

/**
 * Rank the whole fleet.
 *   mode 'risk'   — the real product: combined urgency × stake, slider-weighted.
 *   mode 'expiry' — the naive comparison: "what a reminder app shows you",
 *                    sorted purely by soonest expiry. Same data, same
 *                    reasoning lines, different order — that contrast is
 *                    the point.
 */
export function rankFleet(fleet, { weight = 0.5, mode = 'risk', now = new Date() } = {}) {
  const fleetMax = { income: Math.max(...fleet.map((v) => v.dailyIncome), 0) };
  const spares = fleet.filter((v) => v.route === null);

  const scored = fleet.map((vehicle) => ({
    vehicle,
    ...scoreVehicle(vehicle, fleetMax, spares, weight, now),
  }));

  const comparator =
    mode === 'expiry'
      ? (a, b) => a.daysLeft - b.daysLeft
      : (a, b) => b.score - a.score;

  return scored.sort(comparator);
}
