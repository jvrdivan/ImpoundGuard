// src/components/StatCards.jsx
//
// Four KPI cards. Every number is derived live from stats.js — no fake
// "vs last 7 days" deltas, since a session-only demo has no history to
// compare against. Better honest than decorative.

// Tailwind's build-time scanner needs literal class strings, not
// interpolated ones (`text-${tone}` would never get generated) — hence the
// explicit map instead of a template literal below.
const TONE_ICON_CLASS = {
  danger: 'text-danger',
  warn: 'text-warn',
  brand: 'text-brand',
  unassessed: 'text-unassessed',
};

export default function StatCards({ stats }) {
  const cards = [
    {
      label: 'Vehicles at risk',
      value: stats.atRiskCount,
      sub: `of ${stats.totalVehicles} in the fleet`,
      tone: stats.atRiskCount > 0 ? 'danger' : 'brand',
      icon: WarnIcon,
    },
    {
      label: 'Daily revenue exposed',
      value: `R${stats.dailyRevenueExposed.toLocaleString('en-ZA')}`,
      sub: 'per day if impounded',
      tone: 'warn',
      icon: RandIcon,
    },
    {
      label: 'Passengers exposed',
      value: stats.passengersExposed,
      sub: 'carried daily by at-risk vehicles',
      tone: 'brand',
      icon: PeopleIcon,
    },
    {
      label: 'Unassessed',
      value: stats.unassessedCount,
      sub: 'no document on file',
      tone: 'unassessed',
      icon: DocQuestionIcon,
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              {c.label}
            </span>
            <c.icon className={`w-5 h-5 ${TONE_ICON_CLASS[c.tone]}`} />
          </div>
          <div className="mt-3 text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{c.value}</div>
          <div className="mt-1.5 text-xs text-slate-500">{c.sub}</div>
        </div>
      ))}
    </div>
  );
}

function WarnIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 2 2 20h20L12 2zM12 9v5M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function RandIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 8h4a2 2 0 010 4H9m0 0h5m-5 0v4m0-8v-2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PeopleIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 20c0-3.3 3.1-6 7-6s7 2.7 7 6M16 8a3 3 0 110-6M23 20c0-2.8-2.2-5.1-5-5.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function DocQuestionIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M7 3h7l4 4v14H7z" strokeLinejoin="round" />
      <path d="M10.5 11a1.5 1.5 0 113 0c0 1.5-1.5 1.5-1.5 3M12 17h.01" strokeLinecap="round" />
    </svg>
  );
}
