// api/insights.js
//
// A second, deliberately separate use of AI from api/scan.js: an on-demand
// narrative summary of the current fleet snapshot, written by Claude and
// shown in AIInsightsPanel behind a "Generate insight" button.
//
// This does NOT replace or feed into risk.js's scoring — that stays a pure
// formula, for the same reasons ai_brief.md gives (instant, deterministic,
// explainable on stage). This endpoint only runs when a person clicks the
// button; nothing here recomputes on render, on a scan, or on a timer, so it
// can never quietly burn through an API budget in the background.
//
// Same shape as scan.js: one provider call, a hard timeout, no fallback
// chain, JSON-only output. Anthropic preferred (no daily cap); Gemini as a
// fallback if that's the only key configured.

export const config = { runtime: 'nodejs' };

const TIMEOUT_MS = 20_000;
// A ~10-vehicle summary is a few hundred tokens; this is a generous ceiling
// so a client bug (e.g. sending the raw fleet instead of a summary) fails
// loudly and fast instead of paying for an oversized prompt.
const MAX_SUMMARY_CHARS = 20_000;

const INSIGHTS_PROMPT = `You are a fleet compliance analyst reviewing a snapshot of an operator's fleet risk data below. It was produced by a deterministic scoring formula, not by you — your job is to read it and write the 3 to 5 most concrete, actionable observations a fleet manager should see today.

Rules:
- Base every claim ONLY on the data given below. Never invent a vehicle, plate, route, or number that isn't present in the data.
- Reference real plates and figures from the data in your observations, not vague generalities.
- If the data shows nothing urgent, say that plainly rather than manufacturing urgency.
- All money figures in the data (dailyIncome, dailyRevenueExposed) are South African Rand. Write them with an "R" prefix and comma thousands separators (e.g. "R4,200"), never "$" or "USD".
- Each observation needs a short title (under 8 words) and one sentence of detail.
- Assign each observation a "tone": "critical" for anything needing action today, "warn" for things needing attention soon, "info" for a neutral or positive observation.

Return ONLY a single JSON object, no markdown fences, no commentary before or after it, with
exactly this field:
{
  "insights": [
    { "title": string, "detail": string, "tone": "critical" | "warn" | "info" }
  ]
}
Your entire reply must be that JSON object — start with { and end with }, nothing else.

Fleet data:
`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  const { summary } = req.body || {};
  if (!summary || typeof summary !== 'object') {
    res.status(400).json({ error: 'Missing summary.' });
    return;
  }
  const summaryJson = JSON.stringify(summary);
  if (summaryJson.length > MAX_SUMMARY_CHARS) {
    res.status(413).json({ error: 'Summary too large.' });
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const provider = process.env.ANTHROPIC_API_KEY
      ? 'anthropic'
      : process.env.GEMINI_API_KEY
        ? 'gemini'
        : null;

    if (!provider) {
      res.status(500).json({ error: 'No AI key configured (ANTHROPIC_API_KEY or GEMINI_API_KEY).' });
      return;
    }

    const prompt = INSIGHTS_PROMPT + summaryJson;
    const insights =
      provider === 'anthropic'
        ? await callAnthropic(prompt, controller.signal)
        : await callGemini(prompt, controller.signal);

    res.status(200).json({ insights, modelUsed: provider, generatedAt: new Date().toISOString() });
  } catch (err) {
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'Insight generation timed out.' });
    } else {
      console.error('insights.js generation failed:', err);
      res.status(502).json({ error: 'Insight generation failed.' });
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(prompt, signal) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-5',
      // 5 insights at a sentence each is a few hundred tokens; 2048 is
      // generous headroom rather than a tight estimate — a truncated
      // response is invalid JSON, and 800 was cutting real responses off
      // mid-object (surfaced as a bare "Unexpected end of JSON input").
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  if (data.stop_reason === 'max_tokens') {
    throw new Error('Anthropic response was truncated before completing (hit max_tokens).');
  }
  // `content` is an array of blocks, not always text-first — a thinking or
  // other non-text block ahead of the reply meant content[0].text was
  // silently undefined, which JSON.parse('') on the resulting empty string
  // surfaces as an unhelpful "Unexpected end of JSON input". Concatenating
  // every text block is correct regardless of what else is in the array.
  const text = (data.content || [])
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('');
  if (!text) {
    const blockTypes = (data.content || []).map((b) => b.type).join(', ') || 'none';
    throw new Error(`Anthropic returned no text content (stop_reason: ${data.stop_reason}, blocks: ${blockTypes})`);
  }
  return parseInsightsJson(text);
}

async function callGemini(prompt, signal) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.3, responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  if (data.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
    throw new Error('Gemini response was truncated before completing (hit max output tokens).');
  }
  // Same defensive concatenation as the Anthropic path — parts is an array
  // and nothing guarantees the text lands in parts[0].
  const text = (data.candidates?.[0]?.content?.parts || [])
    .map((part) => part.text || '')
    .join('');
  if (!text) {
    throw new Error(`Gemini returned no text content (finishReason: ${data.candidates?.[0]?.finishReason})`);
  }
  return parseInsightsJson(text);
}

const VALID_TONES = new Set(['critical', 'warn', 'info']);

function parseInsightsJson(text) {
  let cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  // Defensive, not the primary fix: strips stray commentary a model adds
  // before/after the object despite being told not to. Doesn't help with a
  // genuinely truncated response — that's what the stop_reason/finishReason
  // checks above catch before this ever runs.
  const first = cleaned.indexOf('{');
  const last = cleaned.lastIndexOf('}');
  if (first !== -1 && last !== -1 && (first > 0 || last < cleaned.length - 1)) {
    cleaned = cleaned.slice(first, last + 1);
  }
  const parsed = JSON.parse(cleaned);
  const list = Array.isArray(parsed.insights) ? parsed.insights : [];
  return list
    .filter((i) => i && typeof i.title === 'string' && typeof i.detail === 'string')
    .map((i) => ({
      title: i.title,
      detail: i.detail,
      tone: VALID_TONES.has(i.tone) ? i.tone : 'info',
    }));
}
