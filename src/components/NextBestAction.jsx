// src/components/NextBestAction.jsx
//
// Two real suggestions picked from the live ranking by stats.js's
// pickNextBestActions — not scripted copy. If the fleet is fully assessed
// and nothing is critical, both slots quietly disappear rather than
// inventing something to say.

export default function NextBestAction({ unassessed, topRisk, onScanClick, onViewVehicle }) {
  const hasAny = unassessed || topRisk;

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <TargetIcon className="w-4 h-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Next best action</h2>
        </div>

        {!hasAny && (
          <div className="text-sm text-slate-500">Fleet is fully assessed and nothing is critical.</div>
        )}

        {unassessed && (
          <ActionRow
            icon={DocIcon}
            iconClass="bg-unassessed/10 text-unassessed"
            title={`Scan certificate for ${unassessed.vehicle.plate}`}
            subtitle="No document on file."
            buttonLabel="Scan now"
            buttonClass="bg-unassessed/10 text-unassessed hover:bg-unassessed/20"
            onClick={onScanClick}
          />
        )}

        {topRisk && (
          <ActionRow
            icon={WarnIcon}
            iconClass="bg-danger/10 text-danger"
            title={`Renew ${topRisk.vehicle.label}`}
            subtitle={`${topRisk.isExpired ? 'Expired' : `Critical in ${Math.max(0, Math.ceil(topRisk.daysLeft))} days`} · R${topRisk.vehicle.dailyIncome.toLocaleString('en-ZA')}/day at risk`}
            buttonLabel="View details"
            buttonClass="bg-danger/10 text-danger hover:bg-danger/20"
            onClick={() => onViewVehicle(topRisk.vehicle.id)}
          />
        )}
      </div>

      <div className="rounded-xl border border-brand/20 bg-brand/5 p-5">
        <div className="flex items-center gap-2 text-brand font-semibold text-sm mb-1">
          <ShieldIcon className="w-4 h-4" />
          Prevent. Protect. Perform.
        </div>
        <p className="text-xs text-slate-600 leading-relaxed">
          Keep certificates current to avoid impoundment, protect passengers, and secure daily
          revenue.
        </p>
      </div>
    </div>
  );
}

function ActionRow({ icon: Icon, iconClass, title, subtitle, buttonLabel, buttonClass, onClick }) {
  return (
    <div className="flex items-start gap-3 py-2 first:pt-0">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${iconClass}`}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-800 truncate">{title}</div>
        <div className="text-xs text-slate-500">{subtitle}</div>
        <button
          onClick={onClick}
          className={`mt-2 rounded-lg px-3 h-11 sm:h-9 text-xs font-semibold ${buttonClass}`}
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

function TargetIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}
function DocIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M7 3h7l4 4v14H7z M14 3v4h4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function WarnIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 2 2 20h20L12 2zM12 9v5M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function ShieldIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" strokeLinejoin="round" />
    </svg>
  );
}
