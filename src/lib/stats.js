// src/lib/stats.js
//
// Pure aggregate functions for the dashboard chrome (KPI cards, compliance
// outlook bar, next-best-action picks). Kept separate from risk.js, which
// owns the per-vehicle scoring formula — this file only summarizes what
// rankFleet() already computed, using risk.js's classifyStatus() as the
// single source of truth so the outlook bar, the action-queue badges, and
// the KPI cards can never disagree about which bucket a vehicle is in.

import { classifyStatus, STATUS } from './risk';

export function computeFleetStats(ranked) {
  const atRisk = ranked.filter((r) => classifyStatus(r) === STATUS.CRITICAL);
  const unassessed = ranked.filter((r) => classifyStatus(r) === STATUS.NO_CERTIFICATE);

  return {
    totalVehicles: ranked.length,
    atRiskCount: atRisk.length,
    dailyRevenueExposed: atRisk.reduce((sum, r) => sum + r.vehicle.dailyIncome, 0),
    passengersExposed: atRisk.reduce((sum, r) => sum + r.vehicle.passengerLoad, 0),
    unassessedCount: unassessed.length,
  };
}

const BUCKETS = [
  { key: 'critical', status: STATUS.CRITICAL, label: 'Critical', barClass: 'bg-danger', dotClass: 'bg-danger' },
  { key: 'dueSoon', status: STATUS.DUE_SOON, label: 'Due soon', barClass: 'bg-warn', dotClass: 'bg-warn' },
  { key: 'compliant', status: STATUS.COMPLIANT, label: 'Compliant', barClass: 'bg-brand', dotClass: 'bg-brand' },
  { key: 'unassessed', status: STATUS.NO_CERTIFICATE, label: 'Unassessed', barClass: 'bg-unassessed', dotClass: 'bg-unassessed' },
];

/** Bucket counts for the compliance-outlook bar. Segment width is proportional to fleet share. */
export function computeComplianceBuckets(ranked) {
  return BUCKETS.map((b) => {
    const count = ranked.filter((r) => classifyStatus(r) === b.status).length;
    return { ...b, count, pct: ranked.length ? (count / ranked.length) * 100 : 0 };
  });
}

/**
 * The two suggestions in the "Next best action" panel:
 *   - the first vehicle with no document on file at all (can't even be scored)
 *   - the highest-risk vehicle that isn't already covered above
 */
export function pickNextBestActions(ranked) {
  const unassessed = ranked.find((r) => classifyStatus(r) === STATUS.NO_CERTIFICATE) || null;
  const topRisk =
    ranked.find((r) => r.vehicle.id !== unassessed?.vehicle.id && classifyStatus(r) === STATUS.CRITICAL) || null;
  return { unassessed, topRisk };
}

/**
 * Alerts for the notification menu, derived from the same ranked data the
 * rest of the dashboard reads — so the bell's badge count can never
 * disagree with what the Action Queue shows. Ordered most-urgent-first:
 * expired documents, then critical, then vehicles with nothing on file.
 *
 * `severity` drives the dot colour; `vehicleId` lets a click jump to the
 * vehicle, reusing the existing handleViewVehicle flow.
 */
export function buildAlerts(ranked) {
  const alerts = [];

  ranked.forEach((r) => {
    const status = classifyStatus(r);
    const days = Math.max(0, Math.ceil(r.daysLeft));

    if (r.isExpired) {
      alerts.push({
        id: r.vehicle.id + '-expired',
        vehicleId: r.vehicle.id,
        severity: 'critical',
        title: `${r.vehicle.plate} certificate expired`,
        detail: `${r.vehicle.label} · impound risk now`,
        sort: 0,
      });
    } else if (status === STATUS.CRITICAL) {
      alerts.push({
        id: r.vehicle.id + '-critical',
        vehicleId: r.vehicle.id,
        severity: 'critical',
        title: `${r.vehicle.plate} is critical`,
        detail: `${days} day${days === 1 ? '' : 's'} to noncompliance · ${r.vehicle.passengerLoad} passengers daily`,
        sort: 1,
      });
    } else if (status === STATUS.NO_CERTIFICATE) {
      alerts.push({
        id: r.vehicle.id + '-none',
        vehicleId: r.vehicle.id,
        severity: 'unassessed',
        title: `${r.vehicle.plate} has no certificate`,
        detail: `${r.vehicle.label} · cannot be risk-scored`,
        sort: 2,
      });
    } else if (status === STATUS.DUE_SOON) {
      alerts.push({
        id: r.vehicle.id + '-due',
        vehicleId: r.vehicle.id,
        severity: 'warn',
        title: `${r.vehicle.plate} due soon`,
        detail: `${days} day${days === 1 ? '' : 's'} to noncompliance`,
        sort: 3,
      });
    }
  });

  return alerts.sort((a, b) => a.sort - b.sort);
}
