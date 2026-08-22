// src/components/RiskPanel.jsx
//
// Makes the scoring formula visible rather than trusting the pitch to
// explain it — a per-vehicle breakdown of the three inputs (urgency,
// revenue, coverage scarcity) that produced each score, so "why is this
// vehicle ranked here" has a visual answer beyond the reasoning string in
// the Action Queue.
//
// This used to pair the list with a revenue-vs-scarcity scatter chart above
// it. Dropped at the user's request — the chart's y-axis only ever takes
// one of four values (scarcityFor() is quantized to 0/33/67/100%, see
// risk.js), which meant dots piling into flat rows no matter how the chart
// was sized or gridlined, and it read as visual noise rather than insight.
// The three-meter breakdown below carries the same information per vehicle
// without needing a plot to explain first.
//
// By default this hides COMPLIANT vehicles (nothing needs attention),
// behind a "View all" toggle — same treatment as the Action Queue and
// Certificates panel.

import { useState } from 'react';
import { classifyStatus, STATUS } from '../lib/risk';

// Same reasoning as ActionQueue's cap: even the urgency-filtered list is a
// lot of rows to scroll through on a phone.
const MOBILE_ROW_CAP = 3;

export default function RiskPanel({ ranked, onViewVehicle }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  const hiddenCount = ranked.filter((r) => classifyStatus(r) === STATUS.COMPLIANT).length;
  const visible = showAll ? ranked : ranked.filter((r) => classifyStatus(r) !== STATUS.COMPLIANT);
  const mobileMoreCount = Math.max(0, visible.length - MOBILE_ROW_CAP);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Risk breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            The three inputs behind each score. Hover a vehicle for detail, click to jump to it.
          </p>
        </div>
        {hiddenCount > 0 && (
          <button
            onClick={() => setShowAll((v) => !v)}
            className="shrink-0 rounded-lg border border-slate-200 px-3 h-11 sm:h-8 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
          >
            {showAll ? 'Hide compliant' : `View all (${hiddenCount} hidden)`}
          </button>
        )}
      </div>

      <div className="space-y-1">
        {visible.map((r, i) => (
          <BreakdownRow
            key={r.vehicle.id}
            result={r}
            onViewVehicle={onViewVehicle}
            isHovered={hoveredId === r.vehicle.id}
            isDimmed={hoveredId !== null && hoveredId !== r.vehicle.id}
            onHoverStart={() => setHoveredId(r.vehicle.id)}
            onHoverEnd={() => setHoveredId(null)}
            mobileHidden={!mobileExpanded && i >= MOBILE_ROW_CAP}
          />
        ))}
      </div>

      {mobileMoreCount > 0 && (
        <button
          onClick={() => setMobileExpanded((v) => !v)}
          className="sm:hidden w-full mt-2 rounded-lg border border-slate-200 px-3 h-11 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          {mobileExpanded ? 'Show fewer' : `Show ${mobileMoreCount} more`}
        </button>
      )}
    </div>
  );
}

function Meter({ value, className }) {
  return (
    <div className="h-1.5 min-w-0 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.round(value * 100)}%`, transition: 'width 150ms ease' }} />
    </div>
  );
}

function BreakdownRow({ result, onViewVehicle, isHovered, isDimmed, onHoverStart, onHoverEnd, mobileHidden }) {
  const { vehicle, urgency, revenue, scarcity, score } = result;

  return (
    <div className={`relative ${mobileHidden ? 'hidden sm:block' : ''}`} onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
      <button
        onClick={() => onViewVehicle(vehicle.id)}
        className={`w-full h-11 sm:h-9 grid grid-cols-[minmax(0,1.7fr)_14px_minmax(0,1fr)_14px_minmax(0,1fr)_14px_minmax(0,1fr)_34px] items-center gap-2 text-left rounded-lg px-2 -mx-2 transition-opacity ${
          isHovered ? 'bg-slate-50' : ''
        } ${isDimmed ? 'opacity-30' : 'opacity-100'}`}
      >
        <span className="min-w-0 text-xs font-medium text-slate-800 truncate" title={vehicle.label}>
          {vehicle.label}
        </span>

        <span className="text-[10px] text-slate-500 text-right">U</span>
        <Meter value={urgency} className="bg-danger" />
        <span className="text-[10px] text-slate-500 text-right">R</span>
        <Meter value={revenue} className="bg-warn" />
        <span className="text-[10px] text-slate-500 text-right">C</span>
        <Meter value={scarcity} className="bg-brand" />

        <span className="text-xs font-semibold text-slate-900 tabular-nums text-right">{Math.round(score)}</span>
      </button>

      {isHovered && (
        <div className="absolute z-20 left-0 top-full mt-1 w-72 rounded-lg border border-slate-200 bg-white shadow-lg px-3 py-2.5 text-xs pointer-events-none">
          <div className="text-slate-600">{result.reasoning}</div>
          <div className="mt-2 flex gap-3 text-[11px] text-slate-500">
            <span>Urgency <b className="text-slate-700">{Math.round(urgency * 100)}%</b></span>
            <span>Revenue <b className="text-slate-700">{Math.round(revenue * 100)}%</b></span>
            <span>Coverage scarcity <b className="text-slate-700">{Math.round(scarcity * 100)}%</b></span>
          </div>
        </div>
      )}
    </div>
  );
}
