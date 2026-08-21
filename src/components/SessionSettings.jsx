// src/components/SessionSettings.jsx
//
// The "Settings" scroll target: session controls that don't belong on the
// main risk view. The panic-button scan skips the camera/confirm flow
// entirely — a last resort if the real scan panel is unusable, not the
// primary demo path (that's ScanPanel).

export default function SessionSettings({ onSimulateScan, onClearSession }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900 mb-3">Session</h2>
      <div className="flex flex-wrap gap-2">
        <button
          onClick={onSimulateScan}
          title="Skips the photo/confirm flow entirely — use only if the scan panel is unusable"
          className="rounded-lg border border-slate-300 px-4 h-11 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          ⚡ Panic-button scan (skips camera)
        </button>
        <button
          onClick={onClearSession}
          className="rounded-lg border border-slate-300 px-4 h-11 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Clear session
        </button>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Clearing the session resets the fleet to its seed state and removes every scanned
        certificate from memory.
      </p>
    </div>
  );
}
