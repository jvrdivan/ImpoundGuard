# Backend brief

**Owner's job:** explain what the server does, what each endpoint is for, and what happens
when any of it fails.

> **Updated when persistence was added.** An earlier version of this brief said there was
> one endpoint and no database. There are now four files under `api/`, and the fleet is
> read from and written to Postgres.

---

## 1. What it does

Four files under `api/`, three of them endpoints:

| File | Purpose |
|---|---|
| `api/scan.js` | Vision extraction. Stateless — holds the API key, stores nothing. |
| `api/fleet.js` | `GET` the fleet · `POST` a confirmed certificate |
| `api/reset.js` | Restore documents to the seeded snapshot |
| `api/_db.js` | Shared Postgres access (underscore = not an endpoint) |

The split matters: **`scan.js` never touches the database and `fleet.js` never calls a
model.** Extraction is a pure function of an image; persistence is a pure function of
confirmed fields. A vision-API outage cannot corrupt the fleet, and a database outage
cannot break extraction.

---

## 2. How it works

### Deployment shape

`api/scan.js` is a Vercel serverless function. Vercel's convention is that any file under
`api/` becomes an endpoint at that path — no route table, no server framework, no Express.

```js
export const config = { runtime: 'nodejs' };   // api/scan.js:18
export default async function handler(req, res) { ... }  // :41
```

`vercel.json` sets `maxDuration: 15` for it. That number is deliberately **above** the
function's own 12-second internal timeout (`TIMEOUT_MS`, `api/scan.js:20`), so our timeout
always fires first and returns a useful error, instead of Vercel killing the request and
returning a generic platform error.

> **Local dev gotcha:** `npm run dev` runs Vite only and does **not** execute `api/scan.js`.
> To test the real endpoint locally you need `npx vercel dev`. This trips people up.

### Request

```
POST /api/scan
{ "imageBase64": "<string>", "mimeType": "image/jpeg" }
```

Validation, in order (`api/scan.js:42-55`):

| Check | Failure |
|---|---|
| Method is POST | `405 Use POST.` |
| `imageBase64` present and a string | `400 Missing imageBase64.` |
| Length ≤ 8,000,000 chars | `413 Image too large even after downscaling` |

That 8M ceiling (`MAX_BASE64_CHARS`, `:24`) is a guard rail, not a working limit — the
client already downscales to 150–300KB. Its job is to make a client bug fail loudly and
fast instead of hanging.

### Response

```json
{ "docType": "roadworthy", "plate": "CA 671-045", "holderName": "B. Khumalo",
  "docNumber": "RWC-30099", "issueDate": "...", "expiryDate": "...",
  "confidence": 0.94, "modelUsed": "anthropic" }
```

### The full error ladder

| Code | Meaning | What the user sees |
|---|---|---|
| 405 | Not a POST | — |
| 400 | Missing image | — |
| 413 | Payload too big | "try again" |
| 500 | No API key configured | — |
| 504 | Model took >12s | Blank manual-entry form |
| 502 | Upstream error or unparseable JSON | Blank manual-entry form |

The last two are the ones that matter on stage. **Every failure path lands on the same
confirm form, just empty** (`ScanPanel.jsx:70-77`). The operator types the certificate in
by hand and the demo continues. There is no hung spinner and no dead end.

### Timeout

```js
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);  // :57-58
```

The signal is passed into whichever provider's `fetch` runs, and `clearTimeout` is in a
`finally` block (`:85-87`) so it always clears.

### Provider selection

```js
const provider = process.env.ANTHROPIC_API_KEY ? 'anthropic'
               : process.env.GEMINI_API_KEY    ? 'gemini'
               : null;                                    // :61-65
```

Checked at request time, not build time. Anthropic wins if both keys are set. If neither is
set, `500`. Details of the two calls are in the **AI brief**.

Environment variables read: `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `GEMINI_MODEL`. All are
set in the Vercel project dashboard for deploys, or in a local `.env` for `vercel dev`.
`.env` and `.vercel/` are gitignored — **no key is ever in the repo.**

---

## 3. Why it was built this way

**Why is `scan.js` separate from `fleet.js`?** Two different failure modes that must not
share a fate. Extraction depends on a third-party model and can time out; persistence
depends on our database and can't. Keeping them apart means a vision outage still lets you
key a certificate in by hand and save it, and a database outage still lets extraction run.

**Why does `POST /api/fleet` return the whole fleet?** So confirming a scan is one round
trip and one state update. Write-then-refetch would put a second network wait inside the
exact moment the pitch depends on.

**Why no fallback chain?** The original proposal had a 3-model OpenRouter chain. It was cut,
and the reason is in the file's own header comment (`api/scan.js:7-8`): *a chain just makes
the slowest provider the one that fires when the room is watching.* If the primary is
degraded, a chain doesn't save you — it makes you wait for all three before failing. One
model, a hard timeout, and a human fallback is more predictable.

**Why no multipart upload?** Vercel caps serverless request bodies at 4.5MB, hard and
unconfigurable. A judge's phone photo is routinely 3–6MB. The original plan's multipart
parser allowed 10MB — that is a live `413 FUNCTION_PAYLOAD_TOO_LARGE` on stage, and it
passes on localhost. Downscaling client-side to base64 JSON sidesteps the limit entirely.
See `src/lib/downscale.js` and the storage brief.

**Why no Express wrapper?** A local Express shim exists in many Vercel projects to emulate
the handler signature. It's a "works locally, breaks deployed" bug class. We use
`vercel dev` instead, which runs the real thing.

---

## 4. Likely judge questions

**"Where's your backend?"**
Three endpoints on Vercel serverless functions, plus Postgres. One holds the vision API key
and does extraction; one reads and writes the fleet; one resets the demo data. Deliberately
small — the risk engine is a pure function on the client, so the server only does the two
things a browser genuinely can't: keep a secret, and remember something.

**"What happens if the AI call fails during this demo?"**
Four layers. The photo is downscaled client-side so a weak connection isn't fatal. There's
a hard 12-second timeout. On any failure we land on the manual-entry form pre-filled with
whatever came back, so the loop still closes. And there's demo mode, which is labelled on
screen whenever it's on.

**"Is the API key safe?"**
It never reaches the browser. It's an environment variable in Vercel's project settings,
read at request time inside the function. `.env` and `.vercel/` are gitignored, so it's not
in the repository either.

**"Could this scale?"**
Serverless scales horizontally per request, and the schema is indexed on the three access
patterns that matter. The real constraints are the vision provider's rate limit and
Postgres connection count — which is why the pool is capped at one connection per
container; a bigger pool multiplies idle connections across containers and exhausts the
server, which is the standard way serverless kills a database. What's genuinely missing for
production is multi-tenancy, access control and a retention policy, and I'd rather name
those than pretend a weekend build has them.

**"Why 15 seconds in `vercel.json` but 12 in the code?"**
So our timeout fires first and returns a useful 504 that routes the user to manual entry.
If Vercel's platform limit hit first we'd get a generic error and no fallback.
