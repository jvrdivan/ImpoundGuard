# Storage and data brief

**Owner's job:** explain where the data lives, what is stored and what
deliberately isn't, and answer the POPIA question honestly.

> **This brief was rewritten when persistence was added.** An earlier version
> said there was no database and nothing was ever written to disk. That was
> true of the browser-state build; it is not true now. If you have the old
> version in your head, drop it — claiming we store nothing while running on
> Postgres is the one mistake that would cost you a judge's trust outright.

---

## 1. What it does

The fleet lives in **Postgres**. Two tables, `vehicles` and `documents`, seeded
with 32 real-shaped South African vehicles. Confirming a scan writes a row and
it survives a reload.

What is **not** stored: the certificate photograph. It is downscaled in the
browser, sent once to the vision model for extraction, and discarded. Nothing
in the codebase writes an image anywhere — `documents.image_url` exists as a
column for a future pilot but is never populated.

---

## 2. How it works

### The schema — `db/schema.sql`

```sql
vehicles (
  vehicle_id, plate_number UNIQUE, vehicle_name, vehicle_type, vin UNIQUE,
  driver_name, daily_revenue, passenger_load, created_at
)

documents (
  document_id, vehicle_id FK -> vehicles ON DELETE CASCADE,
  document_type, holder_name, issue_date, expiry_date,
  document_number UNIQUE, verified, image_url, created_at, updated_at
)
```

Three indexes, matching the three things the app actually does:
`plate_number` (lookup on scan), `vehicle_id` (documents on fleet load),
`expiry_date` (the expiry-order ranking).

**`daily_revenue` and `passenger_load` are the two inputs to the risk engine.**
In the original draft they defaulted to `0` and were never seeded — which
zeroes `stake` in `risk.js`, so every vehicle scores `0` and the ranking
collapses. They are now populated. If someone ever adds a vehicle and leaves
them blank, that vehicle silently sinks to the bottom of the queue forever.

### Reading — `api/_db.js`

`loadFleet()` does one query with a `json_agg` of each vehicle's documents, and
maps database columns to the field names the UI already used
(`daily_revenue` → `dailyIncome`, `passenger_load` → `passengerLoad`, and so
on). **That mapping is why adding a database didn't ripple through the app** —
`risk.js`, `stats.js` and every component still see exactly the object shape
they saw when the fleet was a hard-coded array.

Two type parsers are registered, both fixing real bugs:

- **DATE (OID 1082)** is returned as the raw `YYYY-MM-DD` string. Left alone,
  node-postgres builds a JS `Date` in the server's timezone, which can shift a
  certificate's expiry across a day boundary. An expiry date is a calendar day,
  not an instant.
- **NUMERIC (OID 1700)** is converted to a number. It arrives as a *string* by
  default to preserve precision — and `"3800" / 5300` in the risk formula would
  be silently wrong.

### Writing — `api/fleet.js`

`POST /api/fleet` matches the plate (uppercased, spaces and hyphens stripped),
inserts the document, and **returns the updated fleet in the same response**.
That's deliberate: one round trip, one state update, so the re-rank still lands
in a single render rather than write-then-refetch.

The insert is `ON CONFLICT (document_number) DO UPDATE`. Without it, the second
rehearsal of the same demo scan would fail on the UNIQUE constraint. Scanning a
genuinely *new* certificate still adds a row — which is why `worstDocument()`
reduces across all of a vehicle's documents to find the one nearest lapsing.

### Resetting — `api/reset.js`

`db/schema.sql` snapshots the seeded documents into `documents_seed`. Reset
truncates `documents`, restores from the snapshot inside a transaction, and
bumps the `SERIAL` sequence past the restored ids (otherwise the next scan
collides on the primary key).

**This is destructive and shared.** There is no session — pressing it affects
everyone on that deployment.

### Connection pooling

`max: 1`. Serverless containers handle one request at a time, so a larger pool
just multiplies idle connections across containers and exhausts the server's
limit — the classic way serverless kills a Postgres instance.

There is a live example of what that constraint costs: `reset.js` originally
held the pool's only connection for its transaction and then called
`loadFleet()`, which needs a second one. It deadlocked against itself until the
connection timeout fired. The fix is releasing the client before reading back.

---

## 3. Why it was built this way

**Why a database at all?** Because the product's promise is warning an operator
*before* a document lapses. That means sending an alert on a Tuesday morning
when nobody has the app open — which requires the server to know the fleet
while every browser is closed. That is impossible without persistence. The
recurring per-vehicle price implies an account, and you cannot bill a browser
tab.

**Why not store the photograph?** It is the highest-risk item and the least
useful. The extracted fields are what the risk engine needs; the image adds
storage cost, a breach surface, and a much harder POPIA conversation, for no
functional gain. `image_url` exists for a pilot that decides otherwise.

**Why is the risk engine still pure?** `risk.js` takes the fleet array and
returns a ranking. It has no idea the data came from Postgres. That keeps the
formula explainable and instant, and means the slider still re-ranks with zero
network traffic.

---

## 4. The POPIA position — say it exactly like this

What is true, and defensible:

1. **Fields are stored; images are not.** Plate, holder name, document number
   and dates go to Postgres. The photograph is discarded after extraction.
2. **Minimal by design.** Only what the risk engine needs to rank and to warn
   ahead of an expiry.
3. **The gaps are named, not hidden.** No accounts, no access control, no
   retention limit. A pilot needs all three plus consent for holder names at
   signup.
4. **The user is told.** `PrivacyBanner.jsx` states this on screen, including
   that a reset affects everyone on the deployment.

**Do not say "nothing is persisted."** It was true of an earlier build and it
is false now.

---

## 5. Likely judge questions

**"What do you store about a driver?"**
Their name as printed on the certificate, plus the plate, document number and
dates. Not the photograph — that's downscaled in the browser, sent once for
extraction, and discarded. It's the minimum the risk engine needs to rank the
fleet and warn ahead of an expiry.

**"Is that POPIA compliant?"**
The data minimisation part, yes — we hold fields rather than images and only
what the ranking needs. What this build does *not* have is accounts, access
control or a retention limit, and a real deployment needs all three plus
consent for holder names at signup. I'd rather tell you that than claim we've
solved it in a weekend.

**"So a judge photographing a certificate ends up in your database?"**
The fields do, yes, and it stays there until someone resets the demo data.
That's why the banner says to use demo certificates. If you'd like yours
removed I can press reset right now and it's gone.

**"Why not just keep it all in the browser like a demo?"**
It did, originally. But then the product can't do the one thing it promises —
tell you about a risk before it bites, when you're not looking at it. That
needs the server to know the fleet while your browser is closed.

**"Is this real data?"**
The vehicles, VINs and certificate numbers are synthetic but real-shaped.
`daily_revenue` and `passenger_load` are our estimates, chosen to be plausible
for a South African operator — trucks earn most and carry nobody, buses carry
up to 65. Those two numbers drive the whole ranking, so it's fair to ask, and
they're visible in `db/schema.sql`.

**"Isn't the demo rigged if you picked those numbers?"**
The numbers are estimates; the mechanism isn't. Change any of them and the
ranking recomputes honestly — the formula doesn't know which vehicle it's
supposed to favour. Drag the slider to pure revenue and the freight trucks take
over, live.
