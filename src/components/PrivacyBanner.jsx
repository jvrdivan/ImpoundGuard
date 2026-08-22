// src/components/PrivacyBanner.jsx
//
// The POPIA line, styled like the reference dashboard's info banner. The
// "expand" toggle reveals the real detail rather than linking anywhere —
// there's no separate privacy page in a hackathon build, and a dead link
// reads worse than no link.
//
// This text previously said captured documents were "never written to a
// server or disk". That was true when the fleet lived in React state; it
// stopped being true the moment certificates were persisted to Postgres.
// What follows describes what the system actually does, including the parts
// a pilot would still need to build. Overstating the privacy position in a
// compliance tool is the one failure mode that cannot be argued away.

import { useState } from 'react';

export default function PrivacyBanner() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm">
      <div className="flex items-start gap-3">
        <LockIcon className="w-4 h-4 text-slate-500 mt-1.5 shrink-0" />
        <div className="flex-1 text-sm text-slate-600 py-1.5">
          Demo data. Holder names read off certificates are personal data, and confirmed
          certificates are stored in this deployment's database until reset.
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 h-11 sm:h-9 px-2.5 -mr-2 rounded-md text-xs font-semibold text-brand hover:bg-brand/5"
        >
          {expanded ? 'Show less' : 'Learn more'}
        </button>
      </div>
      {expanded && (
        <div className="mt-2 pl-7 text-xs text-slate-500 leading-relaxed">
          Confirming a scan writes the plate, holder name, document number and dates to a
          Postgres database shared by everyone using this deployment, and they persist across
          reloads until someone presses “Reset demo data”. The photograph itself is not
          stored — it is downscaled in your browser, sent once for extraction, and discarded.
          <br /><br />
          Use demo certificates rather than a real person's. This build has no accounts, no
          access control and no retention limit, because it is a demo: a pilot would need all
          three, plus consent for holder names, before it touched real fleet paperwork.
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
