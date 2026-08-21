// src/components/CertificatesPanel.jsx
//
// The full paperwork register: every document on file, soonest-expiry
// first, plus a row for any vehicle with nothing on file. The Action
// Queue answers "what should I do about my fleet's risk" (revenue and
// passengers weighted in); this answers "what's the state of my
// paperwork" (pure dates). Different question, so a document can show
// EXPIRING here on a vehicle that reads LOW/Compliant over there.

import { DOC_STATUS, buildCertificateRegister } from '../lib/certificates';

const BADGE_BY_DOC_STATUS = {
  [DOC_STATUS.NONE]: { label: 'No certificate', className: 'bg-unassessed/10 text-unassessed border-unassessed/25' },
  [DOC_STATUS.EXPIRED]: { label: 'Expired', className: 'bg-danger/10 text-danger border-danger/25' },
  [DOC_STATUS.EXPIRING]: { label: 'Expiring soon', className: 'bg-warn/10 text-warn border-warn/25' },
  [DOC_STATUS.VALID]: { label: 'Valid', className: 'bg-brand/10 text-brand border-brand/25' },
};

export default function CertificatesPanel({ fleet, onScanClick }) {
  const rows = buildCertificateRegister(fleet);
  const unverifiedCount = rows.filter((r) => r.doc && r.doc.verified === false).length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Certificates</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {rows.length} document{rows.length === 1 ? '' : 's'} on file across {fleet.length} vehicles
            {unverifiedCount > 0 && (
              <> · <span className="text-unassessed font-medium">{unverifiedCount} unverified</span></>
            )}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[minmax(140px,1.6fr)_100px_112px_112px_104px_112px_96px] gap-3 px-2 pb-2 text-[11px] font-semibold tracking-wide text-slate-500 uppercase border-b border-slate-200">
            <span>Vehicle</span>
            <span>Type</span>
            <span>Issued</span>
            <span>Expires</span>
            <span>Status</span>
            <span>Holder</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-slate-100">
            {rows.map((row, i) => (
              <Row key={row.vehicle.id + '-' + (row.doc?.docNumber || 'none') + i} row={row} onScanClick={onScanClick} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ row, onScanClick }) {
  const { vehicle, doc, daysLeft, status } = row;
  const badge = BADGE_BY_DOC_STATUS[status];
  const needsAction = status !== DOC_STATUS.VALID;

  return (
    <div className="grid grid-cols-[minmax(140px,1.6fr)_100px_112px_112px_104px_112px_96px] gap-3 items-center px-2 py-3">
      <div className="min-w-0">
        <div className="text-sm font-semibold text-slate-900 truncate">{vehicle.plate}</div>
        <div className="text-xs text-slate-500 truncate">{vehicle.label}</div>
      </div>

      <div className="text-xs text-slate-700 capitalize">{doc ? doc.type : '—'}</div>
      <div className="text-xs text-slate-600">{doc ? doc.issueDate : '—'}</div>

      <div className="text-xs">
        {doc ? (
          <>
            <div className={status === DOC_STATUS.EXPIRED ? 'text-danger font-semibold' : 'text-slate-700 font-medium'}>
              {doc.expiryDate}
            </div>
            {status !== DOC_STATUS.VALID && (
              <div className="text-slate-500">
                {status === DOC_STATUS.EXPIRED
                  ? `${Math.abs(Math.floor(daysLeft))}d overdue`
                  : `${Math.max(0, Math.ceil(daysLeft))}d left`}
              </div>
            )}
          </>
        ) : (
          <span className="text-slate-400">—</span>
        )}
      </div>

      <div className="flex flex-col gap-1 items-start">
        <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${badge.className}`}>
          {badge.label}
        </span>
        {doc && doc.verified === false && (
          <span className="rounded-full border border-unassessed/25 bg-unassessed/10 px-2 py-0.5 text-[10px] font-semibold text-unassessed">
            Unverified
          </span>
        )}
      </div>

      <div className="text-xs text-slate-600 truncate">{doc ? doc.holderName : '—'}</div>

      <div className="justify-self-end">
        {needsAction ? (
          <button
            onClick={onScanClick}
            className="rounded-lg bg-brand px-3 h-9 text-xs font-semibold text-white hover:bg-brand/90"
          >
            {doc ? 'Renew' : 'Scan now'}
          </button>
        ) : (
          <span className="text-xs text-slate-500 pr-2">—</span>
        )}
      </div>
    </div>
  );
}
