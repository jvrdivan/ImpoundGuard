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

export default function StatCards({ stats, onNavigate }) {
  const cards = [
    {
      label: 'Vehicles at risk',
      value: stats.atRiskCount,
      sub: `of ${stats.totalVehicles} in the fleet`,
      tone: stats.atRiskCount > 0 ? 'danger' : 'brand',
      icon: WarnIcon,
      // Same destination as the sidebar's Fleet link — this count is the
      // action queue's row count, so "show me" means "take me there".
      navKey: 'fleet',
    },
    {
      label: 'Daily revenue exposed',
      value: `R${stats.dailyRevenueExposed.toLocaleString('en-ZA')}`,
      sub: 'per day if impounded',
      tone: 'warn',
      icon: RandIcon,
      navKey: 'reports',
    },
    {
      label: 'Routes uncoverable',
      value: stats.uncoverableCount,
      sub: 'at-risk vehicles with zero compatible spares',
      tone: 'brand',
      icon: RouteIcon,
      // "Uncoverable" is exactly what the maintenance schedule works out
      // week by week, so that's where this count leads.
      navKey: 'schedule',
    },
    {
      label: 'Unassessed',
      value: stats.unassessedCount,
      sub: 'no document on file',
      tone: 'unassessed',
      icon: DocQuestionIcon,
      // No single panel answers "which ones" better than any other —
      // left as a plain stat rather than picking a destination that isn't
      // clearly right.
      navKey: null,
    },
  ];

  return (
    // Two-up on phones: four full-width cards pushed the actual fleet data
    // most of a screen further down, and these are glanceable numbers that
    // read fine at half width.
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Wrapper = c.navKey ? 'button' : 'div';
        return (
          <Wrapper
            key={c.label}
            {...(c.navKey ? { onClick: () => onNavigate(c.navKey), type: 'button' } : {})}
            className={`rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm text-left w-full ${
              c.navKey ? 'hover:border-slate-300 hover:shadow-md transition-shadow focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand/50' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                {c.label}
              </span>
              <c.icon className={`w-5 h-5 shrink-0 ${TONE_ICON_CLASS[c.tone]}`} />
            </div>
            <div className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">{c.value}</div>
            <div className="mt-1.5 text-xs text-slate-500">{c.sub}</div>
          </Wrapper>
        );
      })}
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
function RouteIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="6" cy="19" r="2.5" />
      <circle cx="18" cy="5" r="2.5" />
      <path d="M6 16.5V13a4 4 0 014-4h4a4 4 0 004-4" strokeLinecap="round" strokeDasharray="2.5 3" />
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
