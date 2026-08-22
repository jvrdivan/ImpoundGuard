// src/components/RiskPanel.jsx
//
// Makes the scoring formula visible rather than trusting the pitch to
// explain it. Two views of the same numbers, cross-linked through one
// shared hover state — pointing at a vehicle in either view dims every
// other vehicle in BOTH views and surfaces its numbers:
//   1. A revenue-vs-coverage-scarcity quadrant — the top-left corner is
//      exactly the vehicles a profit-only ranking would neglect, because
//      nothing else in the fleet can run their route. That's the argument
//      for building a risk engine instead of a reminder app.
//   2. A per-vehicle breakdown of the three inputs that produced each
//      score, so "why is this vehicle ranked here" has a visual answer
//      beyond the reasoning string in the Action Queue.
//
// The y-axis was "safety exposure" (passenger load relative to the
// fleet's fullest vehicle) — a moral weighting. It's now "how hard is
// this to replace," computed from real spare capacity in risk.js's
// scarcityFor(). Same shape of chart, same argument, no longer arbitrary.
//
// Chart and list share one filtered set: by default both hide COMPLIANT
// vehicles (nothing needs attention, no route is at stake), behind a
// "View all" toggle. Filtering both together, not just the list, keeps
// the cross-linked hover honest — a row can never be visible without its
// dot, or vice versa.

import { useState } from 'react';
import { classifyStatus, STATUS } from '../lib/risk';

const DOT_COLOR = {
  [STATUS.CRITICAL]: '#dc2626',
  [STATUS.DUE_SOON]: '#b45309',
  [STATUS.COMPLIANT]: '#0f766e',
  [STATUS.NO_CERTIFICATE]: '#7c3aed',
};

// Dot radius scales with urgency. Kept small on purpose: the SVG is
// width-responsive, so an oversized viewBox radius becomes an enormous
// blob once the chart is stretched (these were rendering at a 30px radius
// before). MIN/MAX are the two ends of the urgency ramp.
const MIN_DOT_RADIUS = 3;
const MAX_DOT_RADIUS = 7.5;
const DOT_RANGE = MAX_DOT_RADIUS - MIN_DOT_RADIUS;

// Padding must clear the largest possible dot radius from the axis tick
// labels, or an extreme-value vehicle's dot sits on top of its own axis
// label — which is what happened with the 100%-revenue vehicle and the
// "100%" x-axis tick.
const PAD = { l: 52, r: 16, t: 16, b: 40 };
const W = 1200;
const H = 300;
const PLOT_W = W - PAD.l - PAD.r;
const PLOT_H = H - PAD.t - PAD.b;

const toX = (revenue) => PAD.l + revenue * PLOT_W;
const toY = (scarcity) => PAD.t + (1 - scarcity) * PLOT_H;

// scarcityFor() in risk.js is clamp(1 - compatibleSpares / 3, 0, 1) for an
// integer compatibleSpares of 0/1/2/3+ — so every vehicle's y-position is
// one of exactly these four values. Vehicles sharing a spare count land on
// the same row; that's the real data, not a rendering bug. The gridlines
// below snap to these same four bands instead of a generic 0/50/100 split,
// so the rows read as the discrete steps they are.
const SCARCITY_BANDS = [0, 1 / 3, 2 / 3, 1];

export default function RiskPanel({ ranked, onViewVehicle }) {
  const [hoveredId, setHoveredId] = useState(null);
  const [showAll, setShowAll] = useState(false);

  const hiddenCount = ranked.filter((r) => classifyStatus(r) === STATUS.COMPLIANT).length;
  const visible = showAll ? ranked : ranked.filter((r) => classifyStatus(r) !== STATUS.COMPLIANT);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Risk breakdown</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Revenue exposure vs. how hard this vehicle is to replace, dot size = urgency. Hover a vehicle for detail, click to jump to it.
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

      <Quadrant ranked={visible} onViewVehicle={onViewVehicle} hoveredId={hoveredId} onHover={setHoveredId} />
      <Legend />

      <div className="space-y-1 mt-4">
        {visible.map((r) => (
          <BreakdownRow
            key={r.vehicle.id}
            result={r}
            onViewVehicle={onViewVehicle}
            isHovered={hoveredId === r.vehicle.id}
            isDimmed={hoveredId !== null && hoveredId !== r.vehicle.id}
            onHoverStart={() => setHoveredId(r.vehicle.id)}
            onHoverEnd={() => setHoveredId(null)}
          />
        ))}
      </div>
    </div>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 mt-3 text-[11px] text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-unassessed/10 border border-unassessed/40" />
        top-left: low revenue, nothing else can cover it — overlooked by a revenue-only view
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="w-2.5 h-2.5 rounded-full bg-warn/10 border border-warn/40" />
        bottom-right: high revenue, easily covered — a revenue-only favourite
      </span>
    </div>
  );
}

// How many dots carry a printed plate label. Labelling every vehicle worked
// at 8 and collapses at fleet scale: vehicles with three or more compliant
// spares all sit at scarcity = 0, so their dots and labels pile up along
// the x-axis. The vehicles worth naming on sight are the high scorers;
// everything else is identified by hovering, which the tooltip already
// handles.
const MAX_LABELLED_DOTS = 6;

function Quadrant({ ranked, onViewVehicle, hoveredId, onHover }) {
  const hovered = ranked.find((r) => r.vehicle.id === hoveredId);

  // By score, not by array order — `ranked` is re-sorted by days-to-expiry in
  // expiry mode, and the labels should not change meaning when the toggle
  // flips.
  const labelledIds = new Set(
    [...ranked]
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_LABELLED_DOTS)
      .map((r) => r.vehicle.id)
  );

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-2">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto overflow-visible" role="img" aria-label="Revenue vs safety risk quadrant">
        {/* quadrant tints — replace floating text callouts, which collided
            with data points at real coordinates. A colour wash can't collide. */}
        <rect x={PAD.l} y={PAD.t} width={PLOT_W / 2} height={PLOT_H / 2} fill="#7c3aed" fillOpacity="0.05" />
        <rect x={PAD.l + PLOT_W / 2} y={PAD.t + PLOT_H / 2} width={PLOT_W / 2} height={PLOT_H / 2} fill="#b45309" fillOpacity="0.05" />

        {/* vertical quarter gridlines — revenue is continuous, so these are
            purely visual spacing, not meaningful bands. */}
        {[0.25, 0.75].map((f) => (
          <line key={'vx' + f} x1={toX(f)} y1={PAD.t} x2={toX(f)} y2={PAD.t + PLOT_H} stroke="#eef2f7" />
        ))}
        <line x1={toX(0.5)} y1={PAD.t} x2={toX(0.5)} y2={PAD.t + PLOT_H} stroke="#e2e8f0" strokeDasharray="3 3" />

        {/* horizontal gridlines at scarcity's actual four possible values —
            not a generic 0/50/100 split, so the rows of dots that land on
            them read as intentional steps. */}
        {SCARCITY_BANDS.slice(1, -1).map((f) => (
          <line key={'hy' + f} x1={PAD.l} y1={toY(f)} x2={PAD.l + PLOT_W} y2={toY(f)} stroke="#e2e8f0" strokeDasharray="3 3" />
        ))}

        {/* axes */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + PLOT_H} stroke="#cbd5e1" />
        <line x1={PAD.l} y1={PAD.t + PLOT_H} x2={PAD.l + PLOT_W} y2={PAD.t + PLOT_H} stroke="#cbd5e1" />

        {/* axis % ticks — offset by MAX_DOT_RADIUS past the axis line so an
            extreme-value vehicle's dot can never sit on top of its own tick */}
        {[0, 0.5, 1].map((f) => (
          <text
            key={'x' + f}
            x={toX(f)}
            y={PAD.t + PLOT_H + MAX_DOT_RADIUS + 10}
            textAnchor="middle"
            fontSize="9"
            className="fill-slate-400"
          >
            {Math.round(f * 100)}%
          </text>
        ))}
        {SCARCITY_BANDS.map((f) => (
          <text
            key={'y' + f}
            x={PAD.l - MAX_DOT_RADIUS - 6}
            y={toY(f) + 3}
            textAnchor="end"
            fontSize="9"
            className="fill-slate-400"
          >
            {Math.round(f * 100)}%
          </text>
        ))}

        {/* axis labels */}
        <text x={PAD.l + PLOT_W / 2} y={H - 6} textAnchor="middle" className="fill-slate-500" fontSize="11" fontWeight="600">
          Revenue exposure →
        </text>
        <text
          x={12}
          y={PAD.t + PLOT_H / 2}
          textAnchor="middle"
          className="fill-slate-500"
          fontSize="11"
          fontWeight="600"
          transform={`rotate(-90, 12, ${PAD.t + PLOT_H / 2})`}
        >
          Hard to replace →
        </text>

        {ranked.map((r) => {
          const status = classifyStatus(r);
          const cx = toX(r.revenue);
          const cy = toY(r.scarcity);
          const radius = MIN_DOT_RADIUS + r.urgency * DOT_RANGE;
          const isHovered = hoveredId === r.vehicle.id;
          const isDimmed = hoveredId !== null && !isHovered;
          const shortPlate = r.vehicle.plate.replace(/\D/g, '').slice(-3);
          return (
            <g
              key={r.vehicle.id}
              onMouseEnter={() => onHover(r.vehicle.id)}
              onMouseLeave={() => onHover(null)}
              onClick={() => onViewVehicle(r.vehicle.id)}
              className="cursor-pointer"
              style={{ transition: 'opacity 150ms ease' }}
              opacity={isDimmed ? 0.22 : 1}
            >
              <circle
                cx={cx}
                cy={cy}
                r={isHovered ? radius + 1.5 : radius}
                fill={DOT_COLOR[status]}
                fillOpacity="0.85"
                stroke="#fff"
                strokeWidth={isHovered ? 2 : 1.25}
                style={{ transition: 'r 150ms ease' }}
              />
              {(labelledIds.has(r.vehicle.id) || isHovered) && (
                <text
                  x={cx}
                  y={cy - radius - 4}
                  textAnchor="middle"
                  fontSize="9"
                  fontWeight="700"
                  className="fill-slate-600"
                >
                  {shortPlate}
                </text>
              )}
            </g>
          );
        })}

        {hovered && <DotTooltip result={hovered} cx={toX(hovered.revenue)} cy={toY(hovered.scarcity)} />}
      </svg>
    </div>
  );
}

function DotTooltip({ result, cx, cy }) {
  const boxW = 190;
  const boxH = 78;
  const flipX = cx + 12 + boxW > W;
  const flipY = cy - boxH - 10 < 0;
  const x = flipX ? cx - boxW - 12 : cx + 12;
  const y = flipY ? cy + 12 : cy - boxH - 10;

  return (
    <foreignObject x={x} y={y} width={boxW} height={boxH} style={{ overflow: 'visible', pointerEvents: 'none' }}>
      <div
        xmlns="http://www.w3.org/1999/xhtml"
        className="rounded-lg border border-slate-200 bg-white shadow-lg px-2.5 py-2 text-[11px] leading-snug"
      >
        <div className="font-semibold text-slate-900 truncate">{result.vehicle.label}</div>
        <div className="text-slate-500">{result.vehicle.plate}</div>
        <div className="text-slate-600 mt-1">{result.reasoning}</div>
      </div>
    </foreignObject>
  );
}

function Meter({ value, className }) {
  return (
    <div className="h-1.5 min-w-0 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full ${className}`} style={{ width: `${Math.round(value * 100)}%`, transition: 'width 150ms ease' }} />
    </div>
  );
}

function BreakdownRow({ result, onViewVehicle, isHovered, isDimmed, onHoverStart, onHoverEnd }) {
  const { vehicle, urgency, revenue, scarcity, score } = result;

  return (
    <div className="relative" onMouseEnter={onHoverStart} onMouseLeave={onHoverEnd}>
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
