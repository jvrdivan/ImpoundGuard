# ImpoundGuard

A fleet compliance tool that turns a photographed roadworthy certificate into
an instant vehicle match, then re-ranks the fleet live by real risk — safety
included, not just whichever document expires soonest.

Built for a hackathon (Friday–Saturday). No database, no multipart upload, no
polling — the fleet lives in browser state for the session, which is also what
makes the POPIA "nothing is persisted" claim true by architecture rather than
by promise. See [docs/CONTEXT.md](docs/CONTEXT.md) for why this is deliberately
smaller than a production stack, what is still open, and the original plan.

**Live:** https://impoundguard.vercel.app

## Architecture

```
src/App.jsx                  all state lives here; re-derives the ranking every render
src/data/fleet.js            8 seeded vehicles + the scripted demo scan payload

src/lib/risk.js              pure scoring engine (urgency x stake), reasoning strings,
                             and classifyStatus() — the single source of truth for
                             critical / due-soon / compliant / no-certificate
src/lib/stats.js             KPI totals, compliance buckets, notification alerts
src/lib/certificates.js      the paperwork register (pure date status, not risk-weighted)
src/lib/reports.js           forward-looking exposure model + CSV export
src/lib/downscale.js         client-side image resize before upload

src/components/
  Sidebar / TopBar           nav (scroll targets), search, NotificationsMenu
  StatCards                  four KPI cards
  ComplianceOutlook          proportional bucket bar
  RiskExposurePanel          the money-vs-lives slider (this IS risk.js's `weight`)
  RiskPanel                  revenue-vs-safety quadrant + per-vehicle score breakdown
  ActionQueue                the core ranked table + the expiry-order toggle
  NextBestAction             two data-driven suggestions
  CertificatesPanel          every document, soonest-expiry first
  ReportsPanel               horizon exposure, impound-days assumption, CSV export
  ScanPanel                  capture -> extract -> confirm/correct -> commit
  PrivacyBanner              the POPIA line
  Logo                       inline SVG brandmark + wordmark

api/scan.js                  the ONLY server code — one vision-model call, 12s timeout
deck/impoundguard-deck.html  10-slide pitch deck, self-contained, opens in any browser
docs/CONTEXT.md              project background, what's open, tooling gotchas
```

## Local development

```bash
npm install
npm run dev
```

Opens the dashboard at `http://localhost:5173`. This alone is enough to
rehearse the whole demo: click **Scan a certificate** with demo mode on (the
default) to run the full photograph → extract → confirm → re-sort loop
without any API key or network call.

### Testing the real vision pipeline

The frontend alone (`npm run dev`) does not run `api/scan.js` — that needs
the Vercel dev server:

```bash
cp .env.example .env
# fill in ONE of ANTHROPIC_API_KEY or GEMINI_API_KEY in .env
npx vercel dev
```

Then in ScanPanel, untick "Demo mode" before scanning.

## Deploying

```bash
npx vercel login      # one-time, opens a browser
npx vercel             # deploy; follow the prompts to link/create a project
```

Then in the Vercel dashboard for the project: **Settings → Environment
Variables**, add `ANTHROPIC_API_KEY` (preferred — no daily rate cap) or
`GEMINI_API_KEY` + `GEMINI_MODEL`, and redeploy.

**Verify on an actual phone before the pitch** — localhost success proves
nothing about venue wifi or a real photo's file size. See the plan doc's
verification checklist.

## The risk formula

```
urgency (U) = 1 if expired, else (30 - daysLeft) / 30, clamped 0..1
revenue (R) = dailyIncome / fleet's highest dailyIncome
safety  (S) = passengerLoad / fleet's highest passengerLoad
stake       = weight * S + (1 - weight) * R     (weight = the slider, default 0.5)
score       = 100 * U * stake
```

Multiplicative on purpose — a vehicle with 200 days of runway scores near
zero regardless of stakes; an expired document pins urgency to 1. See
`src/lib/risk.js` for the full implementation and reasoning-string
formatter.

## The demo beat

`ALEX-TAXI-014` (the 14-passenger minibus taxi) starts near the bottom of
the ranking pre-scan because its roadworthy record is stale/unverified.
Scanning the demo certificate (`src/data/fleet.js`'s `DEMO_SCAN_RESULT`)
jumps it to #1, ahead of the highest-earning, zero-passenger courier van.

Its real scanned expiry (~11 days out) is deliberately *later* than the
van's (~5 days out) — so flipping the **Expiry order** toggle (the "what a
reminder app shows you" naive mode) puts the van back at #1 and drops the
taxi to #3, using the exact same data. That contrast, on the same scan, is
what proves this isn't just a reminder app.

Rehearse: open the app → **Scan a certificate** (demo mode on) → confirm →
watch the re-sort → flip the toggle → flip it back → drag the slider.

## Continuing on another machine

Everything needed is in this repo; nothing else has to be copied across.

```bash
git clone https://github.com/jvrdivan/impoundguard-app.git
cd impoundguard-app
npm install
npm run dev
```

That is enough to rehearse the entire demo — demo mode is on by default, so
the scan -> confirm -> re-sort loop runs with no API key and no network.

Read [docs/CONTEXT.md](docs/CONTEXT.md) first. It carries the background that
does not live in the code: why the scope is deliberately small, what is still
open, and the testing gotchas.

What does **not** come with the clone, and how to restore each:

| Not in git | Why | Restore |
|---|---|---|
| `node_modules/`, `dist/` | build artefacts | `npm install` |
| `.env` | secrets never belong in git | `cp .env.example .env`, then add one API key |
| `.vercel/` | machine-local project link | `npx vercel login` then `npx vercel link` |

The deck opens straight from the filesystem — double-click
`deck/impoundguard-deck.html`. Arrow keys navigate, **N** shows speaker notes,
**F** goes full screen.
