// src/components/NotificationsMenu.jsx
//
// The bell was previously a decorative <div> with a badge and no behaviour.
// It now opens a real menu of alerts derived from the same ranked fleet
// data everything else reads (see buildAlerts in lib/stats.js), so the
// badge count can never disagree with the Action Queue. Clicking an alert
// jumps to that vehicle via the existing handleViewVehicle flow.

import { useEffect, useRef, useState } from 'react';

const SEVERITY_DOT = {
  critical: 'bg-danger',
  warn: 'bg-warn',
  unassessed: 'bg-unassessed',
};

export default function NotificationsMenu({ alerts, onViewVehicle }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const count = alerts.length;

  // Close on outside click and on Escape — a menu you can only dismiss by
  // clicking the trigger again feels broken, and Escape is expected.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label={`Notifications: ${count} alert${count === 1 ? '' : 's'}`}
        aria-expanded={open}
        aria-haspopup="menu"
        className={`relative w-11 h-11 rounded-lg border bg-white flex items-center justify-center shrink-0 transition-colors ${
          open ? 'border-brand ring-2 ring-brand/20' : 'border-slate-300 hover:bg-slate-50'
        }`}
      >
        <BellIcon className="w-4 h-4 text-slate-600" />
        {count > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center">
            {count}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg z-50"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
            <span className="text-sm font-semibold text-slate-900">Alerts</span>
            <span className="text-xs text-slate-500">
              {count} needing attention
            </span>
          </div>

          {count === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">
              Nothing needs attention. Every vehicle is compliant.
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {alerts.map((a) => (
                <li key={a.id}>
                  <button
                    role="menuitem"
                    onClick={() => {
                      onViewVehicle(a.vehicleId);
                      setOpen(false);
                    }}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 flex gap-2.5 items-start"
                  >
                    <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${SEVERITY_DOT[a.severity]}`} />
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-slate-900 truncate">{a.title}</span>
                      <span className="block text-xs text-slate-500">{a.detail}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function BellIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M13.7 21a2 2 0 01-3.4 0" strokeLinecap="round" />
    </svg>
  );
}
