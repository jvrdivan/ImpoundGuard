# AI implementation brief

**Owner's job:** explain exactly where AI is used, where it deliberately isn't, and why the
scoring engine is a formula rather than a model.

There are **four** things people might call "the AI" in this product, and only two of them
are. Keep them separate when you answer:

| | What it is | Where |
|---|---|---|
| **Vision extraction** | A real vision model reading a photographed certificate | `api/scan.js` |
| **AI insights** | A real model, on demand only, narrating an already-computed summary | `api/insights.js` |
| **The risk engine** | A deterministic formula, **no model involved** | `src/lib/risk.js` |
| **The maintenance scheduler** | Earliest-deadline-first placement, **no model involved** | `src/lib/schedule.js` |

Conflating them is the fastest way to lose credibility with a technical judge.

---

## Part A — Vision extraction

### What it does

Photograph a roadworthy certificate. A vision model returns the plate, expiry date, holder
name and document number as structured JSON. That's the whole job — one call, one response,
no agent loop, no chain.

### The prompt

Verbatim, `api/scan.js:26-39`. The same text goes to both providers:

```
You are reading a South African vehicle compliance document (a roadworthy
certificate, PrDP card, or COIDA letter) from a photograph that may have
glare, an angle, or a shadow across it.

Return ONLY a single JSON object, no markdown fences, no commentary, with
exactly these fields:
{
  "docType": "roadworthy" | "prdp" | "coida" | "unknown",
  "plate": string | null,       // vehicle registration/plate, as printed
  "holderName": string | null,  // driver or operator name on the document
  "docNumber": string | null,   // certificate/permit number
  "issueDate": "YYYY-MM-DD" | null,
  "expiryDate": "YYYY-MM-DD" | null,
  "confidence": number          // 0 to 1, your own confidence in this extraction
}

If a field is illegible or absent, use null for it rather than guessing.
Dates must be ISO YYYY-MM-DD. Return valid JSON only.
```

Three things in it are load-bearing, and each is worth naming if asked:

- **It describes the failure conditions** — "glare, an angle, or a shadow." The photos are
  taken by hand at a venue, not scanned flat.
- **It mandates `null` over guessing.** A wrong plate that looks right is far more dangerous
  in a compliance tool than an obvious blank, because it silently attaches a certificate to
  the wrong vehicle.
- **It asks the model to self-report confidence**, which is surfaced to the operator in the
  confirm step (`ScanPanel.jsx:150-152`).

### The two providers

**Anthropic** (`callAnthropic`, `:90-120`) — preferred. Model `claude-sonnet-5`,
`max_tokens: 400`, direct REST call to `/v1/messages`, image sent as a base64 content block.
Chosen for demo day because it has no daily request cap.

**Google Gemini** (`callGemini`, `:122-149`) — fallback. Model from `GEMINI_MODEL`, default
`gemini-flash-latest`. Sets `temperature: 0` and `responseMimeType: 'application/json'`,
which makes Gemini emit JSON natively. Free tier, no card required — the zero-friction
option, but roughly 250 requests/day, which a prompt-tuning session across 30 test
certificates burns through in about eight runs.

Selection happens at request time (`:61-65`): Anthropic if its key is set, else Gemini, else
`500`. Adding a third provider is one function plus one line.

### Handling bad output

`parseExtractionJson` (`:151-165`) does two jobs:

1. **Strips markdown fences.** Models wrap JSON in ```` ```json ```` despite being told not
   to. Rather than failing the extraction, we strip and parse (`:154`).
2. **Normalises every field.** Missing values become `null`; `docType` defaults to
   `'unknown'`; `confidence` is type-checked and becomes `null` if it isn't a number
   (`:163`).

If the body is genuinely unparseable, `JSON.parse` throws, the handler catches it and
returns `502` — and the client lands on a blank manual-entry form (`ScanPanel.jsx:70-77`).
The loop still closes.

### Demo mode

Default **ON** (`ScanPanel.jsx:27`). When on, `handleFile` skips the network entirely, waits
900ms so it feels like a real call, and uses `DEMO_SCAN_RESULT` from `fleet.js:211-219`.

**It is always labelled on screen while active** (`ScanPanel.jsx:112-116`):

> Demo mode is on: this will not call the vision API. Say so if you use it live.

That banner is there on purpose. If you use demo mode in the pitch, say so out loud — "our
connection is down, here's the recorded path." Never present it as a live call. A judge who
catches an undisclosed canned response has stopped listening to everything else you say.

There's also a "panic-button scan" in `SessionSettings.jsx` that applies the demo result
directly with no photo and no confirm step — a last-resort recovery, not a demo path.

### Current status

**No API key is configured yet.** Demo mode covers the full pitch without one. To go live:
put `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in `.env` (local) or the Vercel project settings
(deployed), and run `npx vercel dev` rather than `npm run dev` — plain Vite does not execute
`api/scan.js`.

---

## Part B — The risk engine (no AI)

### The formula

`src/lib/risk.js`. Pure functions — no fetch, no state, no model call.

```
urgency   U = 1 if expired, else clamp((30 - daysLeft) / 30, 0, 1)
revenue   R = dailyIncome    / highest in fleet                       → 0..1
scarcity  C = 1 - (compatible, compliant spares for this route / 3)   → 0..1
stake       = w·C + (1-w)·R        w = the slider, default 0.5
score       = 100 × U × stake
```

`C` replaced an earlier `S` for "safety" (passenger count relative to the fleet's fullest
vehicle) — the team's own critique of that version: it was a moral weighting exercise, and
it didn't actually buy safety, just correlated with it. Scarcity is counted, not assigned:
`scarcityFor()` looks at the live fleet for spares matching this vehicle's type with enough
capacity for its route, that are themselves currently compliant. Zero such spares scores 1;
three or more scores 0. A vehicle with no route (itself a spare) scores 0 — there's nothing
for it to protect. Same schema, same seed data (`passenger_load` didn't change), completely
different meaning: capability, not a value judgment.

**Why multiplicative rather than additive:** urgency gates everything. A vehicle with 200
days of runway scores near zero no matter how much it earns or how scarce its coverage is.
An expired document pins `U` to 1 and the vehicle to the top. An additive model would let a
high-revenue vehicle with a year of runway outrank one expiring tomorrow — which is exactly
the wrong answer.

Two details not in the README, worth knowing before someone finds them:

- **Tier cutoffs are hardcoded**: `score >= 38` → HIGH, `>= 15` → MEDIUM (`:70`). They're
  tuned, not derived. Say so if asked.
- **A vehicle with no document scores 0**, not 100 (`:63`). It's `classifyStatus()`
  (`:101-106`) that catches it via a separate `NO_CERTIFICATE` bucket, so it still surfaces
  in the UI. The raw score being zero is a quirk of the formula, not a bug in the ranking.

### `classifyStatus` — one source of truth

`risk.js:101-106` is the only place a vehicle's state is decided. Every piece of UI that
labels risk — KPI cards, the outlook bar, queue badges, the notifications menu — reads from
it.

This exists because they used to classify independently: the outlook bar bucketed by raw
days-to-expiry while the row badge used the combined risk tier, and they could disagree
about the same vehicle on the same screen. One function, one answer.

### Reasoning strings — deliberately not an LLM

`formatReasoning` is plain string templating — real output, pulled live from the seed data:

> `90 days to noncompliance · covers N2 Cape Town-Somerset West commuter bus route · R3 800/day at risk`

That's the demo bus *before* it's scanned — plenty of runway on the stale record. It used to
name a passenger count instead of a route; now it names the actual thing at stake if the
vehicle goes offline. The header comment states why there's no second model call here:
*instant and never fails.* A model call would add latency to every re-render, introduce a
failure mode in the exact moment the room is watching, and produce non-deterministic text
for a compliance figure. The string is generated once and reused verbatim in the Action
Queue's "Why" row and the Risk pane tooltip.

---

## Part C — AI insights (the second real model call)

### What it does

A "Generate insight" button on the dashboard (`AIInsightsPanel.jsx`) sends a small, already-
computed summary — the top 10 vehicles by score, plus the same headline counts the KPI cards
show — to `api/insights.js`, which asks Claude (or Gemini, same fallback order as scan.js)
to write 3-5 short, concrete observations a fleet manager should act on today.

### Why this doesn't contradict Part B

Part B's whole argument is that the *ranking* has to be instant, deterministic, and
defensible on stage — none of which apply to a plain-language summary a person deliberately
asked for once. Three things keep this from becoming what Part B argues against:

- **It never runs on its own.** No auto-refresh, no recompute on scan, no polling — only a
  click calls the API. An LLM call on every render or every scan would burn an API budget
  for no reason anyone asked for; a button press has an obvious reason.
- **It only ever sees a summary, never the raw fleet or an invitation to invent one.** The
  prompt explicitly forbids naming a vehicle, plate, or number not present in the data it was
  given — same discipline as the extraction prompt's `null` over guessing.
- **The result is visibly labelled AI-generated**, with its generation time and which model
  produced it, and cached in `localStorage` rather than presented as live. It reads as a
  narrated summary of numbers you can already see above it, not a new source of truth.

### If asked to defend it

The panel's own copy says it plainly: "written on request — never generated automatically."
If a judge asks whether this could hallucinate a number, the honest answer is the same shape
as the extraction one — the prompt constrains it to the data given, but a model can still get
it wrong, which is why every figure it might reference is *also* shown elsewhere on the
dashboard by the deterministic engine. Nothing here is the only place a number lives.

---

## Likely judge questions

**"Where is the AI, actually?"**
Two places. Reading the certificate photo — a vision model extracts plate and expiry from a
hand-taken photograph. And the "Generate insight" button — a model narrates an
already-computed summary, only when clicked. The ranking underneath both is a deterministic
formula — five lines of arithmetic — because a compliance figure needs to be explainable and
reproducible, and because I have to be able to defend the number on stage.

**"Why not use an LLM for the risk scoring too?"**
Three reasons. It has to be instant, because it recomputes on every slider drag. It has to
be identical every time, because an owner comparing two vehicles can't get different answers
on different days. And I have to be able to say the formula out loud — which I can:
urgency times stake, where stake is the revenue/coverage-scarcity blend you control with the
slider, and scarcity is counted from real spare capacity, not assigned.

**"What's your extraction accuracy?"**
We haven't measured it against a full photographed test set. What we built instead is the
assumption that it will sometimes be wrong: the confirm step shows every extracted field as
editable before anything is applied, so a misread plate is a two-second fix rather than a
silent error.

**"What if the model hallucinates a date?"**
The prompt mandates `null` over guessing, and the confirm step puts a human between
extraction and the fleet record. Nothing the model returns is written anywhere until a
person has looked at it and pressed Confirm.

**"Which model, and why?"**
Claude Sonnet 5 preferred, Gemini Flash as fallback — the code picks whichever key is
present. Sonnet is the more reliable structured extractor and has no daily cap, which
matters when the cap would be hit at the worst possible moment. Gemini's free tier means we
have a working path with no budget at all.

**"Why not a multi-model fallback chain for reliability?"**
Because a chain makes the slowest path the one that fires under load — precisely when the
room is watching. One model, a hard 12-second timeout, and a human fallback to manual entry
is more predictable than three models racing.
