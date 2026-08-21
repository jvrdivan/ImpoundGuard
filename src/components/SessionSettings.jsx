// src/components/SessionSettings.jsx
//
// The "Settings" scroll target: controls that don't belong on the main risk
// view. The panic-button scan skips the camera/confirm flow entirely — a last
// resort if the real scan panel is unusable, not the primary demo path
// (that's ScanPanel).
//
// "Clear session" used to mean something when the fleet lived in React state:
// it dropped the data and the data was genuinely gone. Scans are now written
// to Postgres, so there is no session to clear — a reload shows the same
// fleet. The honest replacement is an explicit, destructive reset of the demo
// data back to its seeded state, labelled as exactly that.

export default function SessionSettings({ onSimulateScan, onResetDemoData, busy }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900 mb-3">Demo controls</h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onSimulateScan}
          disabled={busy}
          title="Skips the photo/confirm flow entirely — use only if the scan panel is unusable"
          className="rounded-lg border border-slate-300 px-4 h-11 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          ⚡ Panic-button scan (skips camera)
        </button>
        <button
          onClick={onResetDemoData}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-4 h-11 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          {busy ? 'Working…' : 'Reset demo data'}
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Resetting deletes every certificate recorded since setup and restores the fleet's
        original documents. This writes to the database — it affects everyone using this
        deployment, not just your browser.
      </p>
    </div>
  );
}
