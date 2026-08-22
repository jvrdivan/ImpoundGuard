// src/components/RiskExposurePanel.jsx
//
// The owner-adjustable revenue<->scarcity slider, MONEY/CONTINUITY. This IS
// risk.js's `weight` parameter — dragging it live-reorders the action queue
// below.
//
// Previously MONEY/LIVES, weighting passenger count as a proxy for safety.
// That asked an owner to price how many lives a route carries, which isn't
// a number a dashboard should be asking for — and it wasn't really
// buying safety anyway, just correlating with it. CONTINUITY asks something
// a fleet manager actually decides on day to day: how much weight to give
// "can anything else run this route if this vehicle goes offline," which
// is exactly what risk.js's scarcity term and the schedule panel both
// compute from real spare capacity, not an assigned value.

export default function RiskExposurePanel({ weight, onWeightChange, disabled }) {
  const money = Math.round((1 - weight) * 100);
  const continuity = 100 - money;

  const balanceLabel =
    weight < 0.4 ? 'Weighted toward money' : weight > 0.6 ? 'Weighted toward continuity' : 'Balanced';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-semibold text-slate-900">Risk exposure</h2>
        <ScaleIcon className="w-4 h-4 text-slate-500" />
      </div>

      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[11px] font-semibold tracking-wide text-warn uppercase">Money</div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{money}<span className="text-lg text-slate-500 font-semibold">%</span></div>
        </div>
        <div className="text-right">
          <div className="text-[11px] font-semibold tracking-wide text-brand uppercase">Continuity</div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{continuity}<span className="text-lg text-slate-500 font-semibold">%</span></div>
        </div>
      </div>

      <input
        type="range"
        min="0"
        max="1"
        step="0.01"
        value={weight}
        disabled={disabled}
        onChange={(e) => onWeightChange(parseFloat(e.target.value))}
        className="ig-slider mt-3"
      />

      <div className="mt-2 text-xs text-slate-600">
        {disabled
          ? 'Inactive in expiry-order mode.'
          : `${balanceLabel}. Money and how hard a route is to cover carry this weight in the ranking.`}
      </div>
    </div>
  );
}

function ScaleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3v18M7 7l-4 8a4 4 0 008 0zM21 7l-4 8a4 4 0 008 0zM5 7h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
