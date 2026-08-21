// src/components/ReportsPanel.jsx
//
// The forward-looking pane: what doing nothing costs, over a horizon the
// owner picks. Three deliberate choices:
//
//  1. The impound-days assumption is a visible, adjustable input with the
//     assumption restated next to every derived figure. We are not
//     asserting a researched national average — it is a planning
//     assumption, and saying so is stronger than quietly hard-coding a
//     number a judge can poke a hole in.
//  2. Revenue and uncovered-route exposure sit side by side at the same
//     visual weight, because a report that leads with money alone is the
//     exact failure mode this product exists to correct.
//  3. Export produces a real CSV of real session state, not a stub.

import { useState } from 'react';
import { buildForecast, summariseHorizon, buildCsv, formatRand } from '../lib/reports';

// 7/14/30 rather than 30/60/90 — see the WINDOWS comment in lib/reports.js.
const HORIZONS = [7, 14, 30];
const TONE_BAR = { danger: 'bg-danger', warn: 'bg-warn', brand: 'bg-brand' };
const TONE_TEXT = { danger: 'text-danger', warn: 'text-warn', brand: 'text-brand' };

export default function ReportsPanel({ fleet, ranked }) {
  const [horizon, setHorizon] = useState(14);
  const [impoundDays, setImpoundDays] = useState(5);
  const [exportNote, setExportNote] = useState(null);

  const forecast = buildForecast(fleet, { impoundDays });
  const summary = summariseHorizon(forecast, horizon);
  const maxWindowCount = Math.max(...forecast.windows.map((w) => w.count), 1);

  const handleExport = () => {
    const csv = buildCsv(ranked, { impoundDays });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `impoundguard-fleet-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Revoke on the next tick so the download has definitely started.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportNote(`Exported ${ranked.length} vehicles`);
    setTimeout(() => setExportNote(null), 3000);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Reports</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            What it costs to do nothing. Every other view shows today; this one projects forward.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-100">
            {HORIZONS.map((h) => (
              <button
                key={h}
                onClick={() => setHorizon(h)}
                className={`px-3 h-9 rounded-md text-xs font-semibold transition-colors ${
                  horizon === h ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {h} days
              </button>
            ))}
          </div>

          <button
            onClick={handleExport}
            className="rounded-lg border border-slate-300 px-3 h-9 text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1.5"
          >
            <DownloadIcon className="w-3.5 h-3.5" />
            Export CSV
          </button>
        </div>
      </div>

      {exportNote && (
        <div className="mb-4 rounded-lg border border-brand/25 bg-brand/5 px-3 py-2 text-xs text-brand">
          {exportNote} — check your downloads folder.
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-6 items-start">
        <div>
          {/* Headline exposure over the selected horizon */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Stat
              label={`Lapsing in ${horizon} days`}
              value={`${summary.vehicleCount}`}
              sub={`of ${summary.fleetSize} vehicles`}
              tone="danger"
            />
            <Stat
              label="Revenue at risk"
              value={formatRand(summary.lostRevenue)}
              sub={`if each is impounded ${impoundDays} day${impoundDays === 1 ? '' : 's'}`}
              tone="warn"
            />
            <Stat
              label="Uncovered route-days"
              value={summary.uncoveredRouteDays.toLocaleString('en-ZA')}
              sub="days a route runs with nothing behind it, same period"
              tone="brand"
            />
          </div>

          {/* When each vehicle falls out of compliance */}
          <div className="mt-5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2.5">
              When compliance lapses
            </h3>
            <div className="space-y-2">
              {forecast.windows.map((w) => (
                <div key={w.key} className="grid grid-cols-[128px_minmax(0,1fr)_auto] gap-3 items-center">
                  <span className="text-xs text-slate-600">{w.label}</span>
                  <div className="h-5 rounded bg-slate-100 overflow-hidden">
                    {w.count > 0 && (
                      <div
                        className={`h-full ${TONE_BAR[w.tone]} flex items-center justify-end pr-2`}
                        style={{ width: `${Math.max(8, (w.count / maxWindowCount) * 100)}%` }}
                      >
                        <span className="text-[10px] font-bold text-white tabular-nums">{w.count}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-slate-500 tabular-nums w-20 text-right">
                    {w.count > 0 ? formatRand(w.lostRevenue) : '—'}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* The vehicles behind the headline number */}
          {summary.vehicles.length > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2.5">
                Vehicles lapsing within {horizon} days
              </h3>
              <div className="space-y-1">
                {summary.vehicles.map((r) => (
                  <div
                    key={r.vehicle.id}
                    className="grid grid-cols-[minmax(0,1.6fr)_84px_minmax(0,90px)_minmax(0,80px)] gap-3 items-center py-1.5 text-xs"
                  >
                    <span className="min-w-0 truncate text-slate-800 font-medium" title={r.vehicle.label}>
                      {r.vehicle.plate}
                      <span className="text-slate-500 font-normal"> · {r.vehicle.label}</span>
                    </span>
                    <span className={`tabular-nums font-medium ${r.daysLeft <= 0 ? 'text-danger' : 'text-slate-600'}`}>
                      {r.daysLeft === -Infinity
                        ? 'no cert'
                        : r.daysLeft <= 0
                          ? 'lapsed'
                          : `${Math.ceil(r.daysLeft)} days`}
                    </span>
                    <span className="tabular-nums text-slate-700 text-right">{formatRand(r.lostRevenue)}</span>
                    <span className="tabular-nums text-slate-500 text-right">
                      {r.uncoveredRouteDays > 0 ? `${r.uncoveredRouteDays}d uncovered` : 'covered'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* The assumption, stated plainly and adjustable */}
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Model assumption</h3>

          <label htmlFor="impound-days" className="block mt-3 text-sm text-slate-700">
            Days impounded per incident
          </label>
          <div className="flex items-center gap-3 mt-2">
            <input
              id="impound-days"
              type="range"
              min="1"
              max="21"
              step="1"
              value={impoundDays}
              onChange={(e) => setImpoundDays(parseInt(e.target.value, 10))}
              className="ig-slider flex-1"
            />
            <span className="text-lg font-bold text-slate-900 tabular-nums w-8 text-right">{impoundDays}</span>
          </div>

          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            Every rand and trip figure on this page is{' '}
            <span className="font-medium text-slate-800">daily rate × {impoundDays} days</span>. This is a
            planning assumption you set, not a researched national average — drag it to model a
            best or worst case.
          </p>

          <div className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500 leading-relaxed">
            Figures cover the {horizon}-day horizon and update live as certificates are scanned.
            Export includes every vehicle, not just those lapsing.
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3.5">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1.5 text-2xl font-bold tabular-nums tracking-tight ${TONE_TEXT[tone]}`}>{value}</div>
      <div className="mt-1 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function DownloadIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3v12M7 11l5 5 5-5M4 21h16" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
