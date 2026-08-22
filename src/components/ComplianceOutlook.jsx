// src/components/ComplianceOutlook.jsx
//
// Horizontal proportional bar: how much of the fleet falls into each risk
// bucket right now. Segment width is share-of-fleet (a real, honest
// proportion), not a literal date-scaled timeline — the day markers below
// are a legend for the 30-day urgency window risk.js uses.
//
// AXIS NOTE: "Today" is the origin label. An earlier version also rendered
// a "0" at left-0, which collided with it (measured 5x15px of overlap).
// One origin label, then the interval markers.

export default function ComplianceOutlook({ buckets }) {
  const total = buckets.reduce((sum, b) => sum + b.count, 0);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <h2 className="text-base font-semibold text-slate-900">Compliance outlook</h2>
        <span className="text-xs text-slate-500">{total} vehicles by days to noncompliance</span>
      </div>

      <div className="flex h-10 rounded-lg overflow-hidden bg-slate-100">
        {buckets.map((b) =>
          b.count > 0 ? (
            <div
              key={b.key}
              className={`${b.barClass} flex items-center justify-center text-white text-sm font-bold`}
              style={{ width: `${b.pct}%` }}
              title={`${b.label}: ${b.count}`}
            >
              {b.count}
            </div>
          ) : null
        )}
      </div>

      <div className="relative mt-2 h-8">
        <div className="absolute left-0 top-0 flex flex-col items-start">
          <span className="w-px h-2.5 bg-slate-300" />
          <span className="mt-1 text-[10px] font-medium text-slate-500">Today</span>
        </div>
        <span className="absolute left-1/3 -translate-x-1/2 top-[14px] text-[10px] text-slate-500">30d</span>
        <span className="absolute left-2/3 -translate-x-1/2 top-[14px] text-[10px] text-slate-500">60d</span>
        <span className="absolute right-0 top-[14px] text-[10px] text-slate-500">90d</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-2 mt-3 pt-3 border-t border-slate-100">
        {buckets.map((b) => (
          <div key={b.key} className="flex items-center gap-1.5 text-xs text-slate-600">
            <span className={`w-2.5 h-2.5 rounded-full ${b.dotClass}`} />
            {b.label}
            <span className="font-semibold text-slate-900 tabular-nums">{b.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
