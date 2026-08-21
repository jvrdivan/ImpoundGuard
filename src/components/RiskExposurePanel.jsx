// src/components/RiskExposurePanel.jsx
//
// The owner-adjustable revenue<->safety slider, restyled to match the
// reference dashboard's MONEY/LIVES split. This IS risk.js's `weight`
// parameter — dragging it live-reorders the action queue below.

export default function RiskExposurePanel({ weight, onWeightChange, disabled }) {
  const money = Math.round((1 - weight) * 100);
  const lives = 100 - money;

  const balanceLabel =
    weight < 0.4 ? 'Weighted toward money' : weight > 0.6 ? 'Weighted toward lives' : 'Balanced';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
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
          <div className="text-[11px] font-semibold tracking-wide text-brand uppercase">Lives</div>
          <div className="text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{lives}<span className="text-lg text-slate-500 font-semibold">%</span></div>
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
        {disabled ? 'Inactive in expiry-order mode.' : `${balanceLabel}. Money and lives carry this weight in the ranking.`}
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
