// src/components/AIInsightsPanel.jsx
//
// The one place in the dashboard that puts a language model between the
// data and the screen — everywhere else (risk.js, schedule.js, stats.js)
// is deterministic arithmetic, on purpose (see ai_brief.md). This panel is
// explicitly the exception, and stays honest about it three ways:
//
//   1. It never runs on its own. No auto-refresh, no recompute on scan, no
//      polling — only a click on "Generate insight" calls the API. That's
//      the whole point: an LLM call on every render or every scan would
//      burn through an API budget for no reason a fleet manager asked for.
//   2. It only ever sees a small, already-computed summary (top 10 vehicles
//      by score, plus the same headline counts the KPI cards show) — never
//      raw fleet data, and never anything the model could mistake for
//      something to act on directly. The prompt (api/insights.js) also
//      forbids inventing a vehicle or number not in that summary.
//   3. The result is labelled AI-generated and cached in localStorage with
//      its timestamp, so it's never confused with the live, deterministic
//      numbers sitting right above it.

import { useState } from 'react';
import { generateInsights } from '../lib/api';

const CACHE_KEY = 'ig-ai-insights';

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(value));
  } catch {
    // Storage unavailable (private browsing, quota) — the result still
    // renders for this session, it just won't survive a reload.
  }
}

const TONE_STYLE = {
  critical: { border: 'border-danger', dot: 'bg-danger' },
  warn: { border: 'border-warn', dot: 'bg-warn' },
  info: { border: 'border-brand', dot: 'bg-brand' },
};

export default function AIInsightsPanel({ buildSummary }) {
  const [cached, setCached] = useState(readCache);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await generateInsights(buildSummary());
      const next = { insights: result.insights, generatedAt: result.generatedAt, modelUsed: result.modelUsed };
      setCached(next);
      writeCache(next);
    } catch (err) {
      setError(err.message || 'Could not generate an insight — try again.');
    } finally {
      setLoading(false);
    }
  };

  const generatedLabel = cached?.generatedAt
    ? new Date(cached.generatedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-1">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-900">AI insights</h2>
            <span className="rounded-full border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 whitespace-nowrap">
              Claude · on demand
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            A short read of your current fleet snapshot, written on request — never generated automatically.
          </p>
        </div>

        <button
          onClick={handleGenerate}
          disabled={loading}
          className="shrink-0 rounded-lg bg-brand px-3 h-11 sm:h-9 text-xs font-semibold text-white hover:bg-brand/90 disabled:opacity-60 whitespace-nowrap inline-flex items-center gap-2"
        >
          {loading && <span className="w-3.5 h-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
          {loading ? 'Generating…' : cached ? 'Regenerate insight' : 'Generate insight'}
        </button>
      </div>

      {error && (
        <div className="mt-3 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
          {error}
        </div>
      )}

      {!cached && !loading && !error && (
        <p className="mt-4 text-sm text-slate-500 py-4 text-center">
          Click "Generate insight" for a plain-language read of what needs attention right now.
        </p>
      )}

      {cached && (
        <div className="mt-4">
          <div className="space-y-2.5">
            {cached.insights.length === 0 ? (
              <p className="text-sm text-slate-500">Nothing came back — try regenerating.</p>
            ) : (
              cached.insights.map((insight, i) => (
                <div
                  key={i}
                  className={`rounded-lg border-l-4 ${TONE_STYLE[insight.tone]?.border || TONE_STYLE.info.border} bg-slate-50 px-3 py-2.5`}
                >
                  <div className="text-sm font-semibold text-slate-900">{insight.title}</div>
                  <div className="text-xs text-slate-600 mt-0.5">{insight.detail}</div>
                </div>
              ))
            )}
          </div>

          <div className="mt-3 text-[11px] text-slate-400">
            Generated {generatedLabel} from this session's fleet data · {cached.modelUsed === 'anthropic' ? 'Claude' : 'Gemini'}, not the risk engine
          </div>
        </div>
      )}
    </div>
  );
}
