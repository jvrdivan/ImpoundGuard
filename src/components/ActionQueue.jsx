// src/components/ActionQueue.jsx
//
// The core product, as a ranked table. The `layout` + `layoutId` combo on
// each row is what makes a re-sort visible — when a scan changes a
// vehicle's rank, framer-motion animates the row sliding to its new
// position rather than the list silently snapping.
//
// LAYOUT NOTE: the reasoning line gets its OWN full-width sub-row rather
// than a grid cell. An earlier version put it in the vehicle cell, which
// collapsed to 44px against ~340px of text and crushed the name, plate and
// reasoning together. A cell can always be squeezed by its siblings; a
// spanning row cannot. The reasoning line is the plain-language answer to
// "why is this ranked here" and must stay legible at every width.

import { useState } from 'react';
import { motion } from 'framer-motion';
import { classifyStatus, STATUS } from '../lib/risk';

// Search intent beats the urgency filter: if a search is active, every
// match it produced is shown regardless of the "hide compliant" default —
// a fleet manager searching for a specific plate should always find it.
export default function ActionQueue({ ranked, mode, onModeChange, onScanClick, justUpdatedId, searchActive }) {
  const [showAll, setShowAll] = useState(false);

  const hiddenCount = ranked.filter((r) => classifyStatus(r) === STATUS.COMPLIANT).length;
  const visible = searchActive || showAll ? ranked : ranked.filter((r) => classifyStatus(r) !== STATUS.COMPLIANT);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h2 className="text-base font-semibold text-slate-900">Action queue</h2>
        <div className="flex items-center gap-2 flex-wrap">
          {!searchActive && hiddenCount > 0 && (
            <button
              onClick={() => setShowAll((v) => !v)}
              className="rounded-lg border border-slate-200 px-3 h-9 text-xs font-medium text-slate-600 hover:bg-slate-50 whitespace-nowrap"
            >
              {showAll ? 'Hide compliant' : `View all (${hiddenCount} hidden)`}
            </button>
          )}
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-100">
            <button
              onClick={() => onModeChange('risk')}
              className={`px-3 h-9 rounded-md text-xs font-semibold transition-colors ${
                mode === 'risk' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Risk score
            </button>
            <button
              onClick={() => onModeChange('expiry')}
              title="What a reminder app would show you: soonest expiry wins, safety not weighed."
              className={`px-3 h-9 rounded-md text-xs font-semibold transition-colors ${
                mode === 'expiry' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Expiry order
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[680px]">
          <div className="grid grid-cols-[40px_minmax(140px,2fr)_116px_104px_112px_92px_92px] gap-3 px-2 pb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase border-b border-slate-200">
            <span>Rank</span>
            <span>Vehicle</span>
            <span>Status</span>
            <span>Deadline</span>
            <span>Exposure</span>
            <span>Passengers</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-slate-100">
            {visible.length === 0 ? (
              <div className="py-10 text-center text-sm text-slate-500">
                {ranked.length === 0 ? 'No vehicles match that search.' : 'Nothing urgent right now.'}
              </div>
            ) : (
              visible.map((result, i) => (
                <Row
                  key={result.vehicle.id}
                  rank={i + 1}
                  result={result}
                  justUpdated={result.vehicle.id === justUpdatedId}
                  onScanClick={onScanClick}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const BADGE_BY_STATUS = {
  [STATUS.NO_CERTIFICATE]: {
    label: 'No certificate',
    className: 'bg-unassessed/10 text-unassessed border-unassessed/25',
    rank: 'bg-unassessed',
  },
  [STATUS.CRITICAL]: {
    label: 'Critical',
    className: 'bg-danger/10 text-danger border-danger/25',
    rank: 'bg-danger',
  },
  [STATUS.DUE_SOON]: {
    label: 'Due soon',
    className: 'bg-warn/10 text-warn border-warn/25',
    rank: 'bg-warn',
  },
  [STATUS.COMPLIANT]: {
    label: 'Compliant',
    className: 'bg-brand/10 text-brand border-brand/25',
    rank: 'bg-brand',
  },
};

function PersonIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.6 3.1-6.5 7-6.5s7 2.9 7 6.5" strokeLinecap="round" />
    </svg>
  );
}

function Row({ rank, result, justUpdated, onScanClick }) {
  const { vehicle, worstDoc, isExpired, daysLeft, reasoning } = result;
  const status = classifyStatus(result);
  const badge = BADGE_BY_STATUS[status];
  const needsAction = status === STATUS.NO_CERTIFICATE || status === STATUS.CRITICAL;

  return (
    <motion.div
      layout
      layoutId={vehicle.id}
      transition={{ type: 'spring', stiffness: 320, damping: 32 }}
      className={`py-3 px-2 rounded-lg ${justUpdated ? 'ring-2 ring-brand/40 bg-brand/5' : ''}`}
    >
      <div className="grid grid-cols-[40px_minmax(140px,2fr)_116px_104px_112px_92px_92px] gap-3 items-center">
        <span
          className={`w-7 h-7 rounded-full ${badge.rank} text-white text-xs font-bold flex items-center justify-center tabular-nums`}
        >
          {rank}
        </span>

        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900 truncate">{vehicle.plate}</div>
          <div className="text-xs text-slate-500 truncate">{vehicle.label}</div>
        </div>

        <span
          className={`justify-self-start rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${badge.className}`}
        >
          {badge.label}
        </span>

        <div className="text-xs">
          {worstDoc ? (
            <>
              <div className={isExpired ? 'text-danger font-semibold' : 'text-slate-700 font-medium'}>
                {isExpired ? 'Expired' : `${Math.max(0, Math.ceil(daysLeft))} days`}
              </div>
              <div className="text-slate-500">{worstDoc.expiryDate}</div>
            </>
          ) : (
            <span className="text-slate-500">—</span>
          )}
        </div>

        <div className="text-xs text-slate-800 font-medium tabular-nums">
          R{vehicle.dailyIncome.toLocaleString('en-ZA')}
          <span className="text-slate-500 font-normal">/day</span>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-slate-700 tabular-nums">
          <PersonIcon className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          {vehicle.passengerLoad}
        </div>

        <div className="justify-self-end">
          {needsAction ? (
            <button
              onClick={onScanClick}
              className="rounded-lg bg-brand px-3 h-9 text-xs font-semibold text-white hover:bg-brand/90"
            >
              {worstDoc ? 'Renew' : 'Scan now'}
            </button>
          ) : (
            <span className="text-xs text-slate-500 pr-2" aria-label="No action needed">—</span>
          )}
        </div>
      </div>

      {/* Full-width reasoning line — never competes with the columns above. */}
      <div className="mt-2 ml-[52px] mr-2 flex items-start gap-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 shrink-0 mt-px">
          Why
        </span>
        <span className="text-xs text-slate-600 leading-relaxed">{reasoning}</span>
      </div>
    </motion.div>
  );
}
