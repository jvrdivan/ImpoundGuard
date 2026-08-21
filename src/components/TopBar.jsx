// src/components/TopBar.jsx
//
// Page title + today's real date, a search box that actually filters the
// action queue (plate/label/driver), a notifications menu driven by real
// fleet alerts, and the primary "Scan certificate" action.

import NotificationsMenu from './NotificationsMenu';

export default function TopBar({ alerts, onViewVehicle, searchQuery, onSearchChange, onScanClick }) {
  const today = new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Fleet overview</h1>
        <div className="text-sm text-slate-500 mt-1">{today}</div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative">
          <SearchIcon className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search vehicles, plates, or driver"
            className="w-64 h-11 rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          />
        </div>

        <NotificationsMenu alerts={alerts} onViewVehicle={onViewVehicle} />

        <button
          onClick={onScanClick}
          className="rounded-lg bg-brand px-4 h-11 text-sm font-semibold text-white hover:bg-brand/90 flex items-center gap-2 shrink-0"
        >
          <CameraIcon className="w-4 h-4" />
          Scan certificate
        </button>
      </div>
    </div>
  );
}

function SearchIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}
function CameraIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" strokeLinejoin="round" />
      <circle cx="12" cy="13.5" r="3.5" />
    </svg>
  );
}
