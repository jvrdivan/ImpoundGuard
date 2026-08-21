# Project context

Everything here normally lives outside the repo (Claude Code's per-machine
memory and plan directories), which means it does NOT travel with a git
clone. It is copied in so that cloning this repo is enough to pick the work
back up on another machine, and so a teammate has the same background.

Source of truth for code is the repo. This file is background: why things
are the way they are, what is still open, and the tooling gotchas that cost
real time.

---

## Project state

ImpoundGuard is a fleet-compliance demo for a hackathon running **Fri 21 – Sat 22 Aug 2026** (theme: solve business problems with AI). Photograph a roadworthy certificate → vision model extracts plate/expiry → the 8-vehicle fleet re-ranks live by combined revenue-at-risk and passenger-safety-risk.

**This repo is `jvrdivan/ImpoundGuard` — the official submission repo.** Development originally happened in `jvrdivan/impoundguard-app` because `ImpoundGuard` started as an earlier placeholder (public, README only) and the name was already taken. The working app was consolidated back into this repo on 21 Aug so the submission repo is the real thing, not a placeholder. `impoundguard-app` still exists and still works, but this is now the canonical repo going forward.

**Deployed and public: https://impoundguard.vercel.app** — Vercel CLI is already logged in as `jvrdivan-8952`, so `npx vercel --prod --yes` just works. Note the deployment-specific and org-scoped URLs are SSO-protected (302 to vercel.com/sso-api); only the clean production alias is public. The page carries `noindex` because it's link-shareable but shouldn't be crawled before the event.

**Team shape drives the scoping:** only two people genuinely code, and one of those two is the user, who is also delivering the pitch — so ~1.5 coders. The build is deliberately small for that reason.

**Persistence was added on 21 Aug, replacing the original browser-only state.** The fleet now lives in Postgres (`db/schema.sql`, two tables, 32 seeded vehicles from a teammate's design against `roadworthy_certificates.csv`) and confirmed scans are written back via `api/fleet.js`. The reasoning: the product's actual promise is warning an operator *before* a document lapses, which requires the server to know the fleet when nobody has the app open — impossible without storage, and the per-vehicle price implies an account anyway.

This changed the privacy position, and every surface stating it was rewritten in the same pass — `PrivacyBanner.jsx`, the deck's slide 9, the README and `docs/brief-storage.md` all previously claimed nothing was ever persisted, which stopped being true. **The line to hold now: certificate _fields_ are stored, the _photograph_ is not, and this build has no accounts, access control or retention limit — a pilot needs all three.** Do not let the old "there is no database" phrasing back into the pitch; it is contradicted by the repo.

Two gotchas worth knowing before touching this: `daily_revenue` and `passenger_load` default to `0` in the schema, and a vehicle seeded without them silently scores 0 forever (they are the two inputs to `stake` in `risk.js`); and the connection pool is capped at one connection, so any handler that holds a client while also calling `loadFleet()` deadlocks against itself — `api/reset.js` did exactly that and had to release before reading back.

**Built as of 20 Aug:** full scan→confirm→re-rank loop, Action Queue with the risk/expiry-order toggle, Risk pane (quadrant + score breakdown, cross-linked hover), Certificates register, Reports pane (forward-looking exposure model, adjustable impound-days assumption, CSV export), working notifications menu, and a 10-slide pitch deck at `deck/impoundguard-deck.html` (also a private Claude artifact). Every sidebar item is live; nothing is a placeholder.

**Still open:** the vision API key is still not sorted (demo mode covers the pitch without it — recommend a Google AI Studio key as the zero-friction default, Anthropic `claude-sonnet-5` if a small budget appears). Slide 10 of the deck quotes **R49/vehicle/month as a placeholder price** the user still needs to set. The Risk pane's hover-dim interaction was never mechanically verified — see [[verify-ui-by-measuring-dom]].

Full build plan: `C:\Users\jvrdi\.claude\plans\c-users-jvrdi-downloads-fleet-complianc-cosmic-parasol.md`.


---

## How to verify UI work in this setup

In this environment `computer{action:"screenshot"}` often fails ("Browser pane is not displayed, so the page is not compositing frames"), real pointer input frequently doesn't register (`document.querySelectorAll(':hover')` returns zero elements even right after a `computer` hover action), font-metric width probes return identical values for every family including Times, and `scrollIntoView({behavior:'smooth'})` doesn't animate. Don't let any of that block visual verification.

**Why:** a defect the user describes as "messy" or "too big" is almost always measurable, and measuring catches things eyeballing misses. On ImpoundGuard this found a grid column resolving to 43.9px against 117–156px of content, a chart rendering 1156×788 with 30px-radius dots, and a deck stage being flex-shrunk from 1600px to the viewport width — none of which were visible from a description.

**How to apply:** run a `javascript_tool` script over the live page collecting (a) elements where `scrollWidth > clientWidth` (clipped text), (b) pairwise bounding-box intersections (real overlaps — scope the query tightly, or icons elsewhere on the page produce false positives), (c) interactive elements under the 44pt tap target, (d) `documentElement.scrollWidth > innerWidth` (page overflow), and (e) computed contrast ratios against the *effective* background walked up the ancestor chain. Record the numbers before and after so the improvement is a measurement, not an opinion.

**Gotchas that cost real time here:**
- `.click()` reaches React handlers; `dispatchEvent(new MouseEvent('click'))` often does not — except on SVG elements, which have no native `.click()` and *require* dispatchEvent.
- Check UI state in the **same** script as the interaction, with an in-script `await` delay. Tool round-trip latency between two separate calls can exceed a short-lived timeout (a 2.2s flash highlight) and read as a false negative.
- The preview pane keeps stale viewport dimensions across navigations. If `innerWidth` looks wrong, open a fresh tab or call `resize_window` explicitly before trusting any measurement.
- Restart the dev server after editing Tailwind config — a stale CSS cache once showed three "reintroduced" contrast failures that were already fixed.

Related: [[impoundguard-hackathon]].


---

## Original build plan

_Written before the build started. Kept for the reasoning and the
verification checklist; the delivered app has since gone well past this scope._


# CompoundGuard — Build Plan

## Context

Hackathon build, Friday evening to Saturday. Theme: solve business problems with AI. The product is a fleet compliance tool for small South African operators (tow, taxi, courier) running ~8 vehicles: photograph a roadworthy certificate, a vision model extracts plate and expiry, it attaches to the right vehicle, and the fleet re-ranks live by combined revenue-at-risk and passenger-safety-risk — not by whichever document expires soonest.

A teammate proposed a 28-file / 1,380-line stack: monorepo, Node backend on Vercel serverless, Supabase with RLS + views + triggers, multipart photo upload, a 3-model OpenRouter fallback chain, and 30-second polling. The architecture is competent but priced for a product rather than for ~30 hours, and three of its choices directly threaten the one moment the pitch depends on:

- **Vercel serverless caps request bodies at 4.5MB, hard and unconfigurable** ([docs](https://vercel.com/docs/functions/limitations)) — the plan's multipart parser allows 10MB. A judge's phone photo is routinely 3–6MB. That is a live `413 FUNCTION_PAYLOAD_TOO_LARGE` on stage, and it passes on localhost.
- **A free-tier 3-model fallback chain** makes the *slowest* path the one that fires under load — i.e. exactly when the room is watching.
- **30-second polling** means the re-sort lands up to 30s after the scan, or someone hits refresh on stage. The re-sort is the entire pitch.

The risk engine as a pure function returning a score *plus a plain-language reasoning string* is the strongest idea in that document and is kept verbatim in spirit.

**Team constraint driving every decision below: two people can genuinely code, and one of those two is also writing and delivering the pitch.** Effectively ~1.5 coders. The plan is scoped for that, with real non-code work carved out for the other two so they contribute without touching the repo.

**Outcome:** ~13 small files, no database, no multipart, no polling. Every file is short enough that its owner can explain it out loud to a judge.

---

## Architecture

Single Vite + React app. State lives in the browser. One serverless function exists solely to keep the API key off the client.

```
compoundguard/
  index.html
  package.json
  vite.config.js
  tailwind.config.js
  postcss.config.js
  api/
    scan.js                    ~60 lines  ← the ONLY server code
  src/
    main.jsx                   ~6
    App.jsx                    ~150   dashboard shell, all state
    index.css                  tailwind directives
    data/fleet.js              ~70    8 seeded vehicles
    lib/risk.js                ~70    pure scoring + reasoning strings
    lib/downscale.js           ~25    canvas resize → base64
    components/VehicleCard.jsx ~80
    components/ScanPanel.jsx   ~120   capture → preview → confirm/correct
    components/Controls.jsx    ~40    slider, naive toggle, clear-session
```

### Cut from the original, and why

| Cut | Reason |
|---|---|
| Supabase, `schema.sql`, RLS, views, triggers | Backend uses a service-role key that bypasses RLS entirely — the policies are ceremony. A view + trigger silently producing wrong numbers at 2am is unfixable under time pressure. |
| busboy / `parseMultipart.js` | Replaced by client-side downscale + base64 JSON. Sidesteps the 4.5MB limit completely. |
| `server-local.js` Express wrapper | Exists only to paper over Vercel handlers ≠ Express handlers. A "works locally, breaks deployed" bug class you don't need. |
| Monorepo workspaces | One app. One `package.json`. |
| `useVehicles` 30s polling | The scan response returns the new ranking; state updates directly. Instant. |
| Filters, search, PATCH/DELETE | Eight cards fit on one screen. Not in the demo path. |
| 3-model fallback chain | One model, hard timeout, human fallback. Predictable beats comprehensive. |

### Added

- `framer-motion` layout animation — **a plain React re-render teleports rows.** There is no "watch it jump" unless this is built. Highest-leverage hour of the weekend.
- Client-side downscale to ~1024px (≈150–300KB payloads) — fast on venue wifi, and kills the body-limit risk.
- Confirm-and-correct step after extraction.
- Revenue↔safety slider — **not a stretch goal.** ~20 lines, and it's the thing a judge physically touches.
- "Expiry order" naive toggle — see below.
- Session-clear button + persistent POPIA line.

---

## The three ideas doing the real work

**1. No database is a feature, not a compromise.** Eight vehicles seeded in `src/data/fleet.js`; scans mutate React state. This makes the POPIA story *true by architecture* rather than promised in a bullet: "nothing you photograph leaves this session, and we never persist it." The idea doc already commits to demo-only data — build it so that's enforced, then say it on stage. If asked about persistence: "localStorage is five lines; for a pilot, here's the retention policy" — have that answer ready, don't build it.

**2. The confirm step earns its keep three times.** Show extracted fields → editable → "Confirm." It converts a misread plate from a demo disaster into a two-second fix; it adds a beat of suspense *before* the re-sort (better theatre); and it's the real answer to "what if the AI is wrong?" — which you will be asked, in a compliance domain, guaranteed.

**3. The naive toggle is your sharpest weapon.** A switch that re-sorts by days-to-expiry only, labelled *"Expiry order — what a reminder app shows you."* Flip it live: the 14-passenger taxi drops to position six. Flip back: it returns to #1. That proves you are not a reminder app in three seconds, without saying a word. Build this before the slider if time gets tight.

---

## Risk model (`src/lib/risk.js`)

Must be explainable in one breath, because the pitcher will have to explain it.

```
urgency  U = 1 if expired, else clamp((30 - daysLeft) / 30, 0, 1)
revenue  R = dailyIncome / maxDailyIncomeInFleet        → 0..1
safety   S = passengerLoad / maxPassengerLoadInFleet    → 0..1
stake    = w·S + (1-w)·R            w = slider, default 0.5
score    = 100 × U × stake          expired documents pin to 100
```

Multiplicative is the correct shape: 200 days left scores near zero regardless of stakes. Expired pins to the top with a distinct `IMPOUND RISK NOW` state — good demo material.

Reasoning string is plain `format()`, **no second LLM call** — it must be instant and dependable:

> `6 days to noncompliance · carries 14 passengers daily · R2,400/day at risk`

**Tune `fleet.js` so the demo re-sort is dramatic.** Seed it so the scanned certificate takes a 14-seater taxi from roughly rank 6 to rank 1, past a courier van earning nearly double. Real data, real formula, staged for legibility — that's honest and it's what makes the moment land. Do not leave this to chance.

---

## Vision extraction (`api/scan.js`)

Client downscales → posts `{ imageBase64 }` → function calls the model with a structured-extraction prompt → returns `{ docType, plate, holderName, issueDate, expiryDate, confidence }`.

**Model choice, given nothing is set up yet:** get a **Google AI Studio key tonight** — free, instant, no card. Free tier gives Flash roughly 10–15 RPM and ~250 requests/day ([rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)); verify the current Flash model id in AI Studio when you generate the key. **That daily cap is reachable:** iterating a prompt across 30 test certificates is ~30 requests per full run, so ~8 runs/day. If anyone can put $5–10 on an Anthropic key, use `claude-sonnet-5` as the demo-day primary — most reliable at structured extraction, and no daily cap to hit at the worst possible moment.

Keep the model call isolated in one function so swapping providers is a five-line change.

Hard rules: **12-second timeout**, one model, no chain. On timeout or malformed JSON, fall through to the manual-entry form pre-filled with whatever came back.

---

## Demo safety — four layers

1. Client-side downscale (fast upload on bad wifi, no body-limit exposure).
2. 12s timeout → manual entry, pre-filled. The demo continues either way.
3. **Demo mode**: a canned extraction for one known certificate, toggleable. Be honest if you use it — "our connection is down, here's the recorded path" — never present it as a live call.
4. **Saturday afternoon, screen-record a 40-second successful run.** If everything dies, you play the video. This has saved more hackathon teams than any code.

---

## Who does what

| Person | Owns |
|---|---|
| **Coder A** (not pitching) | `App.jsx`, `VehicleCard.jsx`, `ScanPanel.jsx`, animation, slider, toggle — the biggest chunk and the one needing the most iteration and taste. |
| **You** (coder + pitch) | `fleet.js` and `risk.js` — small, self-contained, and *exactly what you'll defend on stage*. Owning the formula makes the pitch authentic. Then pitch prep. |
| **Non-coder 1** | 20–30 mock certificates in Canva/Slides (roadworthy first; PrDP/COIDA only if the core loop is done). Consistent plate field position. More work than it sounds. |
| **Non-coder 2** | Demo photography — print/screen, real phone, glare, angle, shadow. Builds the test set. On the day: hands the certificate to the judge, runs the timer during rehearsals. |

`api/scan.js`, `downscale.js` and the extraction prompt get generated and reviewed rather than hand-written — they're self-contained and prompt-shaped. **But every file must have an owner who can explain it.** The failure mode to avoid: 1,400 generated lines nobody understands, something breaks at hour 20, and no one can fix it. Judges also ask "walk me through this."

---

## Timeline

**Before Friday**
- API key generated and a test call verified working. Do not lose Friday night to account verification.
- Repo created, Vercel account linked, `npm create vite` skeleton pushed and deploying.
- Certificates designed and photographed. Test set ready before build hours start.

**Friday 18:00–24:00 — the safe landing**
- Vite + Tailwind + framer-motion installed.
- `fleet.js` seeded and tuned, `risk.js` complete, cards rendering, sorting working, **animation working.**
- **Hard gate: fully demoable with fake data by midnight.** A button that fakes a scan result is enough. The vision call is never on the critical path to having something to show.

**Saturday 09:00–13:00**
- `api/scan.js` + downscale + real extraction end to end.
- Confirm/correct step. Test against the real photo set, not clean PNGs.

**Saturday 13:00–16:00**
- Naive toggle, then slider, then POPIA line + session-clear.
- Screen-record the successful run.

**Saturday 16:00 → pitch**
- **Code freeze.** Rehearse the photograph→confirm→re-sort sequence at least five times.
- Most hackathon losses are teams still debugging at pitch time. Freeze with real hours left.

---

## Pitch shape (~2½ min)

1. **20s** — Problem, concrete: impounded for days, driver unpaid, route uncovered.
2. **20s** — Here's the fleet, already ranked. Read one reasoning line aloud.
3. **30s** — Judge photographs a certificate on their own phone → confirm → **the re-sort.** Say nothing while it moves.
4. **20s** — Flip to expiry order: *"this is what a reminder app would tell you to renew."* Flip back.
5. **20s** — Drag the slider. Let them drag it.
6. **20s** — Privacy (nothing persisted), price (small per-vehicle monthly fee), wedge (zero hardware, phone only).
7. End with the re-sorted list on screen, reasoning line visible. Not a spinner.

---

## Verification

- **Friday midnight gate:** `npm run dev`, fake-scan button reorders cards with visible animation. If not, stop adding features and fix this.
- **Extraction:** run the full photographed set through `/api/scan`; log which fields fail and at what rate. Target: plate and expiry correct on the large majority; the confirm step covers the rest.
- **Payload check:** confirm downscaled uploads land well under 4.5MB — log the byte size in `scan.js` during testing.
- **Deployed, on a phone, on venue wifi if you can get there early.** Localhost success proves nothing about demo day.
- **Timeout path:** kill your network mid-scan and confirm you land on manual entry, not a hung spinner.
- **Rehearse on the deployed URL**, never on localhost.

Sources: [Vercel Functions Limits](https://vercel.com/docs/functions/limitations), [Gemini API rate limits](https://ai.google.dev/gemini-api/docs/rate-limits)
