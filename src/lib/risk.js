// src/lib/risk.js
//
// The whole risk model. Pure functions only — no fetch, no state, no LLM
// call. This has to be instant and dependable at demo time, and it has to
// be a formula the pitcher can say out loud, not a black box.
//
//   urgency (U) = 1 if expired, else how close the worst document is to
//                 lapsing, ramped over a 30-day window
//   revenue (R) = this vehicle's daily income, relative to the fleet's
//                 highest earner                         → 0..1
//   safety  (S) = this vehicle's passenger load, relative to the fleet's
//                 fullest vehicle                         → 0..1
//   stake       = w·S + (1-w)·R      (w = the owner-adjustable slider)
//   score       = 100 × U × stake
//
// Multiplicative on purpose: a vehicle with 200 days of runway scores near
// zero no matter how much it earns or carries — urgency gates everything
// else. An expired document pins urgency to 1 and the vehicle to the top.

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
 * Score one vehicle against the fleet. `weight` (0..1) is the
 * owner-adjustable slider: 0 = pure revenue, 1 = pure passenger safety.
 * `fleetMax` = { income, passengers } so every vehicle is scored relative
 * to the same fleet, not in isolation.
 */
export function scoreVehicle(vehicle, fleetMax, weight = 0.5, now = new Date()) {
  const doc = worstDocument(vehicle, now);
  const daysLeft = doc ? daysUntil(doc.expiryDate, now) : Infinity;
  const isExpired = doc ? daysLeft <= 0 : false;
  const urgency = doc ? urgencyFromDaysLeft(daysLeft) : 0;

  const safety = fleetMax.passengers > 0 ? vehicle.passengerLoad / fleetMax.passengers : 0;
  const revenue = fleetMax.income > 0 ? vehicle.dailyIncome / fleetMax.income : 0;
  const stake = weight * safety + (1 - weight) * revenue;

  const score = 100 * urgency * stake;
  const tier = isExpired || score >= 38 ? RISK_TIER.HIGH : score >= 15 ? RISK_TIER.MEDIUM : RISK_TIER.LOW;

  return {
    score,
    tier,
    urgency,
    stake,
    safety,
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

/** Plain string formatting — no second LLM call, so it's instant and never fails. */
export function formatReasoning(vehicle, daysLeft, isExpired) {
  const passengers = vehicle.passengerLoad;
  const passengerPart =
    passengers > 0
      ? `carries ${passengers} passenger${passengers === 1 ? '' : 's'} daily`
      : 'carries no passengers';
  const revenuePart = `${formatRand(vehicle.dailyIncome)}/day at risk`;
  const timePart = isExpired
    ? 'EXPIRED — impound risk now'
    : `${Math.max(0, Math.ceil(daysLeft))} day${Math.ceil(daysLeft) === 1 ? '' : 's'} to noncompliance`;
  return `${timePart} · ${passengerPart} · ${revenuePart}`;
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
  const fleetMax = {
    income: Math.max(...fleet.map((v) => v.dailyIncome), 0),
    passengers: Math.max(...fleet.map((v) => v.passengerLoad), 0),
  };

  const scored = fleet.map((vehicle) => ({
    vehicle,
    ...scoreVehicle(vehicle, fleetMax, weight, now),
  }));

  const comparator =
    mode === 'expiry'
      ? (a, b) => a.daysLeft - b.daysLeft
      : (a, b) => b.score - a.score;

  return scored.sort(comparator);
}
