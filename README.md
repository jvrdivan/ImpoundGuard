# ImpoundGuard

A fleet compliance tool that turns a photographed roadworthy certificate into
an instant vehicle match, then re-ranks the fleet live by real risk — safety
included, not just whichever document expires soonest.

The fleet lives in Postgres and confirmed certificates are written back, so a
scan survives a reload. That is the product working as it actually would: the
promise is warning an operator *before* a document lapses, which means the
server has to know the fleet when nobody has the app open.

Certificate **fields** are persisted. The certificate **photograph** is not —
it is downscaled in the browser, sent once for extraction, and discarded. This
build has no accounts, no access control and no retention limit; a pilot needs
all three, plus consent for holder names. See
[docs/CONTEXT.md](docs/CONTEXT.md) for background and what is still open.

**Live:** https://impoundguard.vercel.app

## Architecture

```
db/schema.sql                vehicles + documents, 32 seeded vehicles, seed snapshot

api/_db.js                   pooled Postgres access; maps DB columns -> the shape the UI
                             already expected, so risk.js and the components are untouched
api/fleet.js                 GET the fleet · POST a confirmed certificate
api/reset.js                 restore documents to the seeded snapshot
api/scan.js                  one vision-model call, 12s timeout — stateless, stores nothing

src/App.jsx                  loads the fleet on mount, writes on confirm, re-derives
                             the ranking every render
src/lib/api.js               every call the browser makes to our backend
src/data/demoScan.js         the canned extraction used by demo mode

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
  PrivacyBanner              what is stored and what is not
  Logo                       inline SVG brandmark + wordmark

scripts/verify-db.mjs        end-to-end check of the persistence layer, no Vercel needed
scripts/dev-server.mjs       serves dist/ + runs api/ in one process for local testing
deck/impoundguard-deck.html  10-slide pitch deck, self-contained, opens in any browser
docs/CONTEXT.md              project background, what's open, tooling gotchas
```

## Setup

You need a Postgres database. Any provider works — [Neon](https://neon.tech)
and Vercel Postgres both have free tiers and hand you a connection string.

```bash
npm install
cp .env.example .env          # then paste your DATABASE_URL into it
psql "$DATABASE_URL" -f db/schema.sql
```

`db/schema.sql` is safe to re-run: it drops and recreates both tables.

### Running locally

`npm run dev` starts Vite only and does **not** execute anything under `api/`,
so the dashboard will fail to load its fleet. Use either:

```bash
npx vercel dev                # the real thing, needs a Vercel login
```

```bash
npm run build                 # or the no-login harness
DATABASE_URL=... node scripts/dev-server.mjs
```

Both serve on `http://localhost:5173`.

### Checking the database layer

```bash
DATABASE_URL=... node scripts/verify-db.mjs
```

Runs the real handlers against a real database and asserts the behaviour the
demo depends on: the fleet loads, a scan persists across a re-read, re-scanning
the same certificate doesn't duplicate it, and the demo vehicle climbs the risk
ranking without topping the expiry ranking.

### Testing the real vision pipeline

Fill in ONE of `ANTHROPIC_API_KEY` or `GEMINI_API_KEY` in `.env`, then untick
**Demo mode** in ScanPanel before scanning.

## Deploying

```bash
npx vercel login      # one-time, opens a browser
npx vercel            # deploy; follow the prompts to link/create a project
```

Then in the Vercel dashboard: **Settings → Environment Variables**, add
`DATABASE_URL` plus `ANTHROPIC_API_KEY` (preferred — no daily rate cap) or
`GEMINI_API_KEY` + `GEMINI_MODEL`, and redeploy. Environment variables only
apply to *new* deployments.

**Verify on an actual phone before the pitch** — localhost success proves
nothing about venue wifi or a real photo's file size.

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
`src/lib/risk.js` for the full implementation and reasoning-string formatter.

`daily_revenue` and `passenger_load` in `db/schema.sql` are the two inputs to
`stake`. They are estimates, not measured figures — and if they are left at
their column defaults of `0`, every vehicle scores `0` and the ranking
collapses entirely.

## The demo beat

`CA 449-102` (the Volvo B8R 65-seater bus) starts near the bottom of the risk
ranking — around #28 of 32 — because its roadworthy record says November and
is flagged `verified = false`. Plenty of runway on paper; nobody has checked.

Scanning the demo certificate (`src/data/demoScan.js`) reveals a real
certificate ~9 days from lapsing. Carrying 65 people, it climbs to **#2**,
behind only an already-expired commuter bus.

The contrast: in **Expiry order** — the "what a reminder app shows you" naive
mode — that same vehicle sits at **#7**, because five others genuinely expire
sooner. Same fleet, same scan, different question asked.

Rehearse: open the app → **Scan a certificate** (demo mode on) → confirm →
watch the re-sort → flip the toggle → flip it back → drag the slider.

## Continuing on another machine

```bash
git clone https://github.com/jvrdivan/ImpoundGuard.git
cd ImpoundGuard
npm install
cp .env.example .env          # add DATABASE_URL
psql "$DATABASE_URL" -f db/schema.sql
```

Read [docs/CONTEXT.md](docs/CONTEXT.md) first. It carries the background that
does not live in the code: why the scope is what it is, what is still open, and
the testing gotchas.

What does **not** come with the clone, and how to restore each:

| Not in git | Why | Restore |
|---|---|---|
| `node_modules/`, `dist/` | build artefacts | `npm install` |
| `.env` | secrets never belong in git | `cp .env.example .env`, then fill it in |
| `.vercel/` | machine-local project link | `npx vercel login` then `npx vercel link` |
| the database itself | lives with your provider | `psql "$DATABASE_URL" -f db/schema.sql` |

The deck opens straight from the filesystem — double-click
`deck/impoundguard-deck.html`. Arrow keys navigate, **N** shows speaker notes,
**F** goes full screen.
