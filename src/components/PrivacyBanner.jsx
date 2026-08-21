// src/components/PrivacyBanner.jsx
//
// The POPIA line, styled like the reference dashboard's info banner. The
// "expand" toggle reveals the real detail rather than linking anywhere —
// there's no separate privacy page in a hackathon build, and a dead link
// reads worse than no link.

import { useState } from 'react';

export default function PrivacyBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex items-start gap-3">
        <LockIcon className="w-4 h-4 text-slate-500 mt-1.5 shrink-0" />
        <div className="flex-1 text-sm text-slate-600 py-1.5">
          Demo data only. Holder names read off certificates are personal data. Captured
          documents are held in this browser session only, never written to a server or disk.
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 h-9 px-2.5 -mr-2 rounded-md text-xs font-semibold text-brand hover:bg-brand/5"
        >
          {expanded ? 'Show less' : 'Learn more'}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 pl-7 text-xs text-slate-500 leading-relaxed">
          Everything on this screen — vehicle data, scanned certificates, holder names — lives in
          this browser tab's memory for the current session and nowhere else. Refreshing the page
          or pressing "Clear session" removes it completely. A real pilot deployment would need an
          explicit retention policy and access controls before storing any of this beyond a demo.
        </div>
      )}
    </div>
  );
}

function LockIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...props}>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" strokeLinecap="round" />
    </svg>
  );
}
