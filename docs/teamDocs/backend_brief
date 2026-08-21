Backend brief
Owner's job: explain what the server does, why there is only one file of it, and what
happens when it fails.
The honest headline: there is 165 lines of server code in this entire product. That is
a deliberate architectural result, not a gap. Own it.
---
1. What it does
One endpoint, `POST /api/scan`. It exists for a single reason: to hold the vision-model
API key so it never reaches the browser.
Send it a base64 photo. It calls a vision model with an extraction prompt, and returns
plain JSON fields — plate, expiry date, holder name, and so on. It stores nothing, reads
no database, and has no session or auth layer.
Everything else in the product runs in the browser.
---
2. How it works
Deployment shape
`api/scan.js` is a Vercel serverless function. Vercel's convention is that any file under
`api/` becomes an endpoint at that path — no route table, no server framework, no Express.
```js
export const config = { runtime: 'nodejs' };   // api/scan.js:18
export default async function handler(req, res) { ... }  // :41
```
`vercel.json` sets `maxDuration: 15` for it. That number is deliberately above the
function's own 12-second internal timeout (`TIMEOUT_MS`, `api/scan.js:20`), so our timeout
always fires first and returns a useful error, instead of Vercel killing the request and
returning a generic platform error.
> **Local dev gotcha:** `npm run dev` runs Vite only and does **not** execute `api/scan.js`.
> To test the real endpoint locally you need `npx vercel dev`. This trips people up.
Request
```
POST /api/scan
{ "imageBase64": "<string>", "mimeType": "image/jpeg" }
```
Validation, in order (`api/scan.js:42-55`):
Check	Failure
Method is POST	`405 Use POST.`
`imageBase64` present and a string	`400 Missing imageBase64.`
Length ≤ 8,000,000 chars	`413 Image too large even after downscaling`
That 8M ceiling (`MAX_BASE64_CHARS`, `:24`) is a guard rail, not a working limit — the
client already downscales to 150–300KB. Its job is to make a client bug fail loudly and
fast instead of hanging.
Response
```json
{ "docType": "roadworthy", "plate": "CA 671-045", "holderName": "B. Khumalo",
  "docNumber": "RWC-30099", "issueDate": "...", "expiryDate": "...",
  "confidence": 0.94, "modelUsed": "anthropic" }
```
The full error ladder
Code	Meaning	What the user sees
405	Not a POST	—
400	Missing image	—
413	Payload too big	"try again"
500	No API key configured	—
504	Model took >12s	Blank manual-entry form
502	Upstream error or unparseable JSON	Blank manual-entry form
The last two are the ones that matter on stage. Every failure path lands on the same
confirm form, just empty (`ScanPanel.jsx:70-77`). The operator types the certificate in
by hand and the demo continues. There is no hung spinner and no dead end.
Timeout
```js
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);  // :57-58
```
The signal is passed into whichever provider's `fetch` runs, and `clearTimeout` is in a
`finally` block (`:85-87`) so it always clears.
Provider selection
```js
const provider = process.env.ANTHROPIC_API_KEY ? 'anthropic'
               : process.env.GEMINI_API_KEY    ? 'gemini'
               : null;                                    // :61-65
```
Checked at request time, not build time. Anthropic wins if both keys are set. If neither is
set, `500`. Details of the two calls are in the AI brief.
Environment variables read: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`. All are
set in the Vercel project dashboard for deploys, or in a local `.env` for `vercel dev`.
`.env` and `.vercel/` are gitignored — no key is ever in the repo.
---
3. Why it was built this way
Why only one endpoint? Because there's no data to serve. The fleet is seeded in the
client and mutated in the client. The only thing that genuinely cannot happen in a browser
is calling a vision API with a secret key — so that, and only that, is on the server.
Why no fallback chain? The original proposal had a 3-model OpenRouter chain. It was cut,
and the reason is in the file's own header comment (`api/scan.js:7-8`): a chain just makes
the slowest provider the one that fires when the room is watching. If the primary is
degraded, a chain doesn't save you — it makes you wait for all three before failing. One
model, a hard timeout, and a human fallback is more predictable.
Why no multipart upload? Vercel caps serverless request bodies at 4.5MB, hard and
unconfigurable. A judge's phone photo is routinely 3–6MB. The original plan's multipart
parser allowed 10MB — that is a live `413 FUNCTION_PAYLOAD_TOO_LARGE` on stage, and it
passes on localhost. Downscaling client-side to base64 JSON sidesteps the limit entirely.
See `src/lib/downscale.js` and the storage brief.
Why no Express wrapper? A local Express shim exists in many Vercel projects to emulate
the handler signature. It's a "works locally, breaks deployed" bug class. We use
`vercel dev` instead, which runs the real thing.
---
4. Likely judge questions
"Where's your backend?"
There's one function, 165 lines, and its only job is holding the API key. Everything else
is client-side. That's not a shortcut — no database means nothing to breach and nothing to
retain, which is what makes the POPIA position defensible rather than aspirational.
"What happens if the AI call fails during this demo?"
Four layers. The photo is downscaled client-side so a weak connection isn't fatal. There's
a hard 12-second timeout. On any failure we land on the manual-entry form pre-filled with
whatever came back, so the loop still closes. And there's demo mode, which is labelled on
screen whenever it's on.
"Is the API key safe?"
It never reaches the browser. It's an environment variable in Vercel's project settings,
read at request time inside the function. `.env` and `.vercel/` are gitignored, so it's not
in the repository either.
"Could this scale?"
For this shape, yes — serverless scales horizontally per request by default. The real limit
is the vision provider's rate limit, not our code. What wouldn't scale is the no-database
decision, and that's intentional: a pilot needs persistence, a retention policy and access
controls, and that's a deliberate next step rather than something we pretended to build.
"Why 15 seconds in `vercel.json` but 12 in the code?"
So our timeout fires first and returns a useful 504 that routes the user to manual entry.
If Vercel's platform limit hit first we'd get a generic error and no fallback.
