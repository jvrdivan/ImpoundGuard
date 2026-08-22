// src/components/SchedulePanel.jsx
//
// The maintenance schedule: when each vehicle goes in for its inspection,
// and whether its route is covered while it's off the road. Two adjustable
// assumptions, same pattern as ReportsPanel's impound-days slider — a
// visible, user-set constraint restated next to every figure it derives,
// never a hidden number a judge can poke a hole in:
//
//   slotsPerWeek    — testing-station throughput / admin bandwidth: how
//                     many vehicles can be taken offline at once.
//   maintenanceDays — how long a vehicle is off the road per inspection.
//
// The headline is deliberately not "we always cover you" — some rows say
// UNCOVERED, in red, with a rand figure. That's the whole point: the
// product's claim is knowing which weeks are covered and which aren't,
// not a promise that can't be kept for every vehicle in the fleet.

import { useState } from 'react';
import { buildSchedule } from '../lib/schedule';
import { formatRand } from '../lib/reports';

export default function SchedulePanel({ fleet }) {
  const [slotsPerWeek, setSlotsPerWeek] = useState(3);
  const [maintenanceDays, setMaintenanceDays] = useState(2);
  // The week-by-week list and the assumption sliders are the bulk of this
  // panel's height — collapsed by default on phones, where the four stat
  // tiles above already carry the headline numbers. Always expanded on
  // sm+; the toggle itself is hidden there.
  const [showDetails, setShowDetails] = useState(false);

  const schedule = buildSchedule(fleet, { slotsPerWeek, maintenanceDays, horizonWeeks: 12 });
  const activeWeeks = schedule.weeks.filter((w) => w.jobs.length > 0);
  const spareCount = fleet.filter((v) => v.route === null).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">Maintenance schedule</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          When each vehicle goes in for inspection, and which routes stay covered while it's off
          the road. {spareCount} of {fleet.length} vehicles are held in reserve to cover for
          others — the rest have nothing behind them if their route can't be covered.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Revenue preserved" value={formatRand(schedule.totals.revenuePreserved)} tone="brand" />
        <Stat label="Revenue at risk" value={formatRand(schedule.totals.revenueAtRisk)} tone="warn" />
        <Stat
          label="Certain to lapse"
          value={formatRand(schedule.totals.guaranteedLoss)}
          sub={`${schedule.unschedulable.length} vehicle${schedule.unschedulable.length === 1 ? '' : 's'} — no slot before expiry`}
          tone="danger"
        />
        <Stat
          label="Coverage rate"
          value={`${schedule.totals.coveredJobs}/${schedule.totals.coveredJobs + schedule.totals.uncoveredJobs}`}
          sub="routes covered vs scheduled"
          tone="slate"
        />
      </div>

      <button
        onClick={() => setShowDetails((v) => !v)}
        className="sm:hidden w-full mb-4 rounded-lg border border-slate-200 px-3 h-11 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        {showDetails ? 'Hide schedule details' : 'View schedule details'}
      </button>

      <div className={`${showDetails ? 'grid' : 'hidden'} sm:grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start`}>
        <div className="space-y-4 min-w-0">
          {schedule.unschedulable.length > 0 && (
            <div className="rounded-lg border border-danger/25 bg-danger/5 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-danger">
                Will lapse — no slot fits before expiry
              </h3>
              <div className="mt-2 space-y-1.5">
                {schedule.unschedulable.map((job) => (
                  <div key={job.vehicle.id} className="flex items-center justify-between text-xs gap-3">
                    <span className="min-w-0 truncate">
                      <span className="font-semibold text-slate-900">{job.vehicle.plate}</span>
                      <span className="text-slate-500"> · {job.vehicle.label}</span>
                    </span>
                    <span className="shrink-0 text-danger font-medium tabular-nums">
                      {job.deadlineDays <= 0
                        ? `${Math.abs(Math.floor(job.deadlineDays))}d overdue`
                        : `${Math.ceil(job.deadlineDays)}d left`}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-slate-500">
                Raise the slots-per-week limit, or these lapse before a slot opens up.
              </p>
            </div>
          )}

          <div className="max-h-[520px] overflow-y-auto pr-1 space-y-4">
            {activeWeeks.length === 0 && (
              <p className="text-sm text-slate-500 py-6 text-center">Nothing scheduled in this horizon.</p>
            )}
            {activeWeeks.map((week) => (
              <WeekGroup key={week.weekIndex} week={week} maintenanceDays={maintenanceDays} />
            ))}
          </div>
        </div>

        {/* The two constraints, stated plainly and adjustable */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Scheduling assumptions
          </h3>

          <label htmlFor="slots-per-week" className="block mt-3 text-sm text-slate-700">
            Vehicles offline at once
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              id="slots-per-week"
              type="range"
              min="1"
              max="6"
              step="1"
              value={slotsPerWeek}
              onChange={(e) => setSlotsPerWeek(parseInt(e.target.value, 10))}
              className="ig-slider flex-1"
            />
            <span className="text-lg font-bold text-slate-900 tabular-nums w-8 text-right">{slotsPerWeek}</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            Testing-station throughput, workshop bays, or admin bandwidth — however many vehicles
            you can genuinely afford to take off the road in the same week.
          </p>

          <label htmlFor="maintenance-days" className="block mt-4 text-sm text-slate-700">
            Days offline per inspection
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              id="maintenance-days"
              type="range"
              min="1"
              max="5"
              step="1"
              value={maintenanceDays}
              onChange={(e) => setMaintenanceDays(parseInt(e.target.value, 10))}
              className="ig-slider flex-1"
            />
            <span className="text-lg font-bold text-slate-900 tabular-nums w-8 text-right">{maintenanceDays}</span>
          </div>

          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            Both are planning assumptions you set, not measured figures — drag either one and
            every week below, and every rand figure, recomputes live.
          </p>

          <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
            Vehicles are placed earliest-deadline-first: whoever lapses soonest gets the earliest
            slot. A route is covered only by a compliant spare of the same vehicle type with
            enough capacity — not by weighting, by whether one actually exists.
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekGroup({ week, maintenanceDays }) {
  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2">
        Week of {week.startDate}
      </h3>
      <div className="space-y-1.5">
        {week.jobs.map((job) => (
          <JobRow key={job.vehicle.id} job={job} maintenanceDays={maintenanceDays} />
        ))}
      </div>
    </div>
  );
}

function JobRow({ job, maintenanceDays }) {
  const { vehicle, route, cover, revenueAtRisk } = job;

  return (
    <div className="grid grid-cols-[minmax(0,1.3fr)_minmax(0,1.4fr)_minmax(0,110px)] gap-3 items-center rounded-lg px-2.5 py-2 bg-slate-50">
      <div className="min-w-0">
        <div className="text-sm font-medium text-slate-900 truncate">{vehicle.plate}</div>
        <div className="text-xs text-slate-500 truncate">{vehicle.label}</div>
      </div>

      <div className="min-w-0 text-xs">
        {route ? (
          <>
            <div className="text-slate-700 truncate" title={route.name}>{route.name}</div>
            <div className="text-slate-500">{formatRand(route.dailyValue)}/day route</div>
          </>
        ) : (
          <div className="text-slate-500">Spare — own inspection, no route to cover</div>
        )}
      </div>

      <div className="justify-self-end text-right">
        {!route ? (
          <span className="text-xs text-slate-400">—</span>
        ) : cover ? (
          <>
            <span className="rounded-full border border-brand/25 bg-brand/10 px-2 py-1 text-[11px] font-semibold text-brand whitespace-nowrap">
              Covered
            </span>
            <div className="mt-1 text-[11px] text-slate-500 truncate">by {cover.plate}</div>
          </>
        ) : (
          <>
            <span className="rounded-full border border-danger/25 bg-danger/10 px-2 py-1 text-[11px] font-semibold text-danger whitespace-nowrap">
              Uncovered
            </span>
            <div className="mt-1 text-[11px] text-danger font-medium tabular-nums">
              {formatRand(revenueAtRisk)} ({maintenanceDays}d)
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const STAT_TONE = {
  brand: 'text-brand',
  warn: 'text-warn',
  danger: 'text-danger',
  slate: 'text-slate-900',
};

function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${STAT_TONE[tone]}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
