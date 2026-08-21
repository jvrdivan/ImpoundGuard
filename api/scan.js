// api/scan.js
//
// The ONLY server-side code in this project. One job: hold the vision-model
// API key so it never reaches the browser, forward the (already-downscaled)
// photo with a structured-extraction prompt, and return plain JSON fields.
//
// One model, one call, a hard timeout, no fallback chain — a chain just
// makes the slowest provider the one that fires when the room is watching.
// On timeout or a malformed response the client falls back to manual entry;
// see ScanPanel.jsx and DEMO_SCAN_RESULT in src/data/fleet.js for the rest
// of that safety net.
//
// Provider is picked at runtime from whichever key is set — ANTHROPIC_API_KEY
// (Claude, preferred: no daily cap) or GEMINI_API_KEY (Google AI Studio free
// tier). Swapping providers, or adding a third, is a few lines in
// callAnthropic/callGemini below — the rest of the file doesn't change.

export const config = { runtime: 'nodejs' };

const TIMEOUT_MS = 12_000;
// Generous ceiling on the base64 payload itself (~6MB raw image before
// base64's ~33% overhead). The client downscales to ~150-300KB; this guard
// exists purely so a client bug fails loudly and fast instead of hanging.
const MAX_BASE64_CHARS = 8_000_000;

const EXTRACTION_PROMPT = `You are reading a South African vehicle compliance document (a roadworthy certificate, PrDP card, or COIDA letter) from a photograph that may have glare, an angle, or a shadow across it.

Return ONLY a single JSON object, no markdown fences, no commentary, with exactly these fields:
{
  "docType": "roadworthy" | "prdp" | "coida" | "unknown",
  "plate": string | null,       // vehicle registration/plate, as printed
  "holderName": string | null,  // driver or operator name on the document
  "docNumber": string | null,   // certificate/permit number
  "issueDate": "YYYY-MM-DD" | null,
  "expiryDate": "YYYY-MM-DD" | null,
  "confidence": number          // 0 to 1, your own confidence in this extraction
}

If a field is illegible or absent, use null for it rather than guessing. Dates must be ISO YYYY-MM-DD. Return valid JSON only.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  const { imageBase64, mimeType } = req.body || {};
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    res.status(400).json({ error: 'Missing imageBase64.' });
    return;
  }
  if (imageBase64.length > MAX_BASE64_CHARS) {
    res.status(413).json({ error: 'Image too large even after downscaling — try again.' });
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
      res.status(500).json({ error: 'No vision API key configured (ANTHROPIC_API_KEY or GEMINI_API_KEY).' });
      return;
    }

    const extracted =
      provider === 'anthropic'
        ? await callAnthropic(imageBase64, mimeType || 'image/jpeg', controller.signal)
        : await callGemini(imageBase64, mimeType || 'image/jpeg', controller.signal);

    res.status(200).json({ ...extracted, modelUsed: provider });
  } catch (err) {
    if (err.name === 'AbortError') {
      res.status(504).json({ error: 'Extraction timed out.' });
    } else {
      console.error('scan.js extraction failed:', err);
      res.status(502).json({ error: 'Extraction failed.' });
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function callAnthropic(imageBase64, mimeType, signal) {
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
      max_tokens: 400,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
            { type: 'text', text: EXTRACTION_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`Anthropic API error ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  return parseExtractionJson(text);
}

async function callGemini(imageBase64, mimeType, signal) {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { inline_data: { mime_type: mimeType, data: imageBase64 } },
            { text: EXTRACTION_PROMPT },
          ],
        },
      ],
      generationConfig: { temperature: 0, responseMimeType: 'application/json' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error ${response.status}: ${await response.text()}`);
  }
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return parseExtractionJson(text);
}

function parseExtractionJson(text) {
  // Models occasionally wrap JSON in ```json fences despite instructions —
  // strip those before parsing rather than failing the whole extraction.
  const cleaned = text.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const parsed = JSON.parse(cleaned);
  return {
    docType: parsed.docType ?? 'unknown',
    plate: parsed.plate ?? null,
    holderName: parsed.holderName ?? null,
    docNumber: parsed.docNumber ?? null,
    issueDate: parsed.issueDate ?? null,
    expiryDate: parsed.expiryDate ?? null,
    confidence: typeof parsed.confidence === 'number' ? parsed.confidence : null,
  };
}
