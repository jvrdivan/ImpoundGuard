// src/components/ScanPanel.jsx
//
// The real demo flow: photograph → downscale → extract → confirm/correct →
// commit. Every step is visible so the confirm step reads as a deliberate
// feature (catching a misread plate in two seconds) rather than a bug fix.
//
// Demo mode swaps the live network call for the recorded DEMO_SCAN_RESULT —
// same UI, same theater, no dependency on venue wifi or the vision API
// being up. It is always labeled on screen when active; never presented as
// a live call. See api/scan.js for the real extraction endpoint and its
// 12s timeout, which is what routes here into manual entry on failure.

import { useState, useRef } from 'react';
import { downscaleImage } from '../lib/downscale';
import { DEMO_SCAN_RESULT } from '../data/fleet';

const BLANK_FIELDS = {
  docType: 'roadworthy',
  plate: '',
  holderName: '',
  docNumber: '',
  issueDate: '',
  expiryDate: '',
};

export default function ScanPanel({ onConfirm, onClose }) {
  const [demoMode, setDemoMode] = useState(true);
  const [stage, setStage] = useState('idle'); // idle | scanning | confirming | error
  const [preview, setPreview] = useState(null);
  const [fields, setFields] = useState(BLANK_FIELDS);
  const [confidence, setConfidence] = useState(null);
  const [errorNote, setErrorNote] = useState(null);
  const fileInputRef = useRef(null);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreview(URL.createObjectURL(file));
    setStage('scanning');
    setErrorNote(null);

    try {
      const { base64, mimeType } = await downscaleImage(file);

      let result;
      if (demoMode) {
        await new Promise((r) => setTimeout(r, 900)); // feels like a real call
        result = DEMO_SCAN_RESULT;
      } else {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64, mimeType }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Extraction failed.');
        result = data;
      }

      setFields({
        docType: result.docType || 'roadworthy',
        plate: result.plate || '',
        holderName: result.holderName || '',
        docNumber: result.docNumber || '',
        issueDate: result.issueDate || '',
        expiryDate: result.expiryDate || '',
      });
      setConfidence(result.confidence ?? null);
      setStage('confirming');
    } catch (err) {
      // Timeout or malformed response: land on the same confirm form, just
      // empty, so the operator can key it in by hand. The loop still closes.
      setErrorNote(err.message || 'Could not read that photo automatically — enter it by hand.');
      setFields(BLANK_FIELDS);
      setConfidence(null);
      setStage('confirming');
    }
  };

  const handleConfirm = () => {
    onConfirm(fields);
    reset();
  };

  const reset = () => {
    setStage('idle');
    setPreview(null);
    setFields(BLANK_FIELDS);
    setConfidence(null);
    setErrorNote(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="rounded-xl border border-brand/30 bg-white p-4 space-y-3 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-800">Scan a certificate</h2>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 text-sm h-9 px-2 -mr-2 rounded-md">
          ✕ close
        </button>
      </div>

      <label className="flex items-center gap-2 text-xs text-slate-500">
        <input
          type="checkbox"
          checked={demoMode}
          onChange={(e) => setDemoMode(e.target.checked)}
          className="accent-brand"
        />
        Demo mode — use the recorded certificate, no live call
      </label>
      {demoMode && (
        <div className="rounded-md bg-warn/10 border border-warn/30 px-2 py-1 text-[11px] text-warn">
          Demo mode is on: this will not call the vision API. Say so if you use it live.
        </div>
      )}

      {stage === 'idle' && (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full rounded-lg border-2 border-dashed border-slate-300 py-8 text-slate-500 hover:border-brand hover:text-brand hover:bg-brand/5"
        >
          📷 Photograph or choose a certificate
        </button>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        className="hidden"
      />

      {preview && (
        <img src={preview} alt="Captured certificate" className="w-full max-h-48 object-contain rounded-lg border border-slate-200" />
      )}

      {stage === 'scanning' && (
        <div className="text-center text-sm text-slate-500 py-2">Reading document…</div>
      )}

      {stage === 'confirming' && (
        <div className="space-y-2">
          {errorNote && (
            <div className="rounded-md bg-danger/10 border border-danger/30 px-2 py-1 text-xs text-danger">
              {errorNote}
            </div>
          )}
          {confidence !== null && (
            <div className="text-xs text-slate-500">Model confidence: {Math.round(confidence * 100)}%</div>
          )}
          <FieldRow label="Document type" value={fields.docType} onChange={(v) => setFields((f) => ({ ...f, docType: v }))} />
          <FieldRow label="Plate" value={fields.plate} onChange={(v) => setFields((f) => ({ ...f, plate: v }))} />
          <FieldRow label="Holder name" value={fields.holderName} onChange={(v) => setFields((f) => ({ ...f, holderName: v }))} />
          <FieldRow label="Document #" value={fields.docNumber} onChange={(v) => setFields((f) => ({ ...f, docNumber: v }))} />
          <FieldRow label="Issue date" value={fields.issueDate} onChange={(v) => setFields((f) => ({ ...f, issueDate: v }))} type="date" />
          <FieldRow label="Expiry date" value={fields.expiryDate} onChange={(v) => setFields((f) => ({ ...f, expiryDate: v }))} type="date" />

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleConfirm}
              disabled={!fields.plate || !fields.expiryDate}
              className="flex-1 rounded-lg bg-brand px-3 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-40"
            >
              ✓ Confirm and apply to fleet
            </button>
            <button onClick={reset} className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
              Retake
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldRow({ label, value, onChange, type = 'text' }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-28 shrink-0 text-xs text-slate-500">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 rounded-md bg-white border border-slate-300 px-2 py-1 text-sm text-slate-800 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
      />
    </div>
  );
}
