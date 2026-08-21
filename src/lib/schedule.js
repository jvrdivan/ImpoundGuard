// src/lib/schedule.js
//
// The maintenance scheduler. Pure functions only, same discipline as
// risk.js: no fetch, no state, so it is instant and explainable out loud.
//
// This exists because "backfill the route" only means something if there
// is a real, limited pool of spare capacity to draw from — see
// db/schema.sql's routes/reserve design. The two things this answers:
//
//   1. WHEN does each vehicle go in for its inspection, given we can only
//      take `slotsPerWeek` vehicles offline at once (a real constraint:
//      testing-station throughput, workshop bays, admin bandwidth)?
//   2. WHILE it's offline, is there a compatible spare to cover its route,
//      or does that route's revenue go unprotected?
//
// The claim this supports: "we sequence inspections so you never take more
// capacity offline than you can cover, and we tell you plainly which weeks
// are covered and which are not." Not "we always break even" — that would
// require slack that doesn't exist for every vehicle, and the bus fleet in
// this seed data (see schema.sql) is built to demonstrate exactly that.

// Explicit .js extension, unlike this module's siblings: reports.js and
// stats.js are only ever loaded through Vite, which resolves extensionless
// specifiers. This one is also imported directly by plain-Node scripts
// (scripts/verify-db.mjs) for testing, and Node's ESM loader has no
// bundler to fall back on — it needs the real filename.
import { daysUntil, worstDocument, isCompliant } from './risk.js';

const DAYS_PER_WEEK = 7;

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// isCompliant is shared with risk.js's scarcity calculation — the same
// definition of "usable spare" backs both the headline score and this
// week-by-week assignment, so they can never disagree about who counts.
//
// Simplifying assumption, stated plainly: a spare's compliance is checked
// once, against `now`, not re-derived for every future week. A spare whose
// own certificate lapses partway through the horizon is still treated as
// available throughout. Modelling that precisely would mean simulating
// every vehicle's maintenance forward in lockstep, which is a real
// refinement for a pilot, not a hackathon build — and it would not change
// which vehicles are structurally uncoverable (the bus fleet), which is
// the point being demonstrated.

function findCover(fleet, job, busyThisWeek, now) {
  return (
    fleet.find(
      (v) =>
        v.route === null &&
        v.type === job.vehicle.type &&
        v.passengerLoad >= (job.route?.minCapacity ?? 0) &&
        !busyThisWeek.has(v.id) &&
        isCompliant(v, now)
    ) ?? null
  );
}

/**
 * Build the schedule.
 *
 * @param {Array} fleet - as returned by loadFleet(): each vehicle has
 *   `.route` (null if spare) and `.documents`.
 * @param {object} opts
 * @param {number} opts.maintenanceDays - days a vehicle is off the road per
 *   inspection. User-set planning assumption, same spirit as `impoundDays`
 *   in reports.js — printed next to every figure it derives, never hidden.
 * @param {number} opts.slotsPerWeek - the testing-throughput / admin-bandwidth
 *   constraint: how many vehicles can be taken offline in the same week.
 * @param {number} opts.horizonWeeks - how far forward to plan.
 * @param {Date} opts.now
 */
export function buildSchedule(
  fleet,
  { maintenanceDays = 2, slotsPerWeek = 3, horizonWeeks = 12, now = new Date() } = {}
) {
  // One job per vehicle that has a document to renew. A vehicle with no
  // document at all has no known deadline to schedule against — that's a
  // separate, already-handled case (STATUS.NO_CERTIFICATE in risk.js) and
  // is deliberately not silently absorbed into this schedule.
  const jobs = fleet
    .map((vehicle) => {
      const doc = worstDocument(vehicle, now);
      if (!doc) return null;
      return { vehicle, route: vehicle.route, deadlineDays: daysUntil(doc.expiryDate, now) };
    })
    .filter(Boolean)
    // Earliest-deadline-first: the classic scheduling rule, and the one a
    // pitcher can defend in one sentence — whoever lapses soonest gets the
    // earliest slot, full stop, no other weighting.
    .sort((a, b) => a.deadlineDays - b.deadlineDays);

  const weeks = Array.from({ length: horizonWeeks }, (_, weekIndex) => ({
    weekIndex,
    startDate: addDays(now, weekIndex * DAYS_PER_WEEK).toISOString().slice(0, 10),
    jobs: [],
  }));

  // Per week: which vehicle ids are unavailable — either in maintenance
  // themselves, or already covering someone else's route that week.
  const busyByWeek = weeks.map(() => new Set());
  const unschedulable = [];

  for (const job of jobs) {
    let placedWeek = null;
    for (let w = 0; w < weeks.length; w++) {
      const weekStartsAtDay = w * DAYS_PER_WEEK;
      // Check the week's START, not its end. A vehicle with 5 days left is
      // still schedulable in week 0 (days 0-6) — day 0 is before the
      // deadline, which is all that matters at this weekly granularity.
      // Checking the week's end instead would wrongly reject week 0 for
      // anything with fewer than 7 days left, which is exactly backwards:
      // those are the vehicles that most need the earliest slot.
      // This week, and every week after it, START on or after the
      // deadline — too late, no day in that week helps. (Also correctly
      // catches an already-expired document: weekStartsAtDay is >= 0,
      // deadlineDays is <= 0, so even week 0 fails immediately.)
      if (weekStartsAtDay > job.deadlineDays) break;
      if (weeks[w].jobs.length < slotsPerWeek) {
        placedWeek = w;
        break;
      }
    }

    if (placedWeek === null) {
      unschedulable.push(job);
      continue;
    }

    busyByWeek[placedWeek].add(job.vehicle.id);

    let cover = null;
    let revenueAtRisk = 0;
    if (job.route) {
      cover = findCover(fleet, job, busyByWeek[placedWeek], now);
      if (cover) {
        busyByWeek[placedWeek].add(cover.id);
      } else {
        revenueAtRisk = job.route.dailyValue * maintenanceDays;
      }
    }

    weeks[placedWeek].jobs.push({
      vehicle: job.vehicle,
      route: job.route,
      cover,
      revenueAtRisk,
    });
  }

  const totals = { revenuePreserved: 0, revenueAtRisk: 0, coveredJobs: 0, uncoveredJobs: 0 };
  for (const week of weeks) {
    for (const j of week.jobs) {
      if (!j.route) continue; // spares protect nothing by going offline
      if (j.cover) {
        totals.coveredJobs += 1;
        totals.revenuePreserved += j.route.dailyValue * maintenanceDays;
      } else {
        totals.uncoveredJobs += 1;
        totals.revenueAtRisk += j.revenueAtRisk;
      }
    }
  }
  // Unschedulable route-holders lapse with certainty, not just a risk —
  // there was never a slot before their deadline. Counted separately in
  // totals so "uncovered but scheduled" and "won't even make it to a slot"
  // aren't conflated on screen.
  const guaranteedLoss = unschedulable.reduce(
    (sum, j) => sum + (j.route ? j.route.dailyValue * maintenanceDays : 0),
    0
  );

  return {
    weeks,
    unschedulable,
    totals: { ...totals, guaranteedLoss },
  };
}
