Storage and data brief
Owner's job: explain where the data lives, why there is no database, and why that makes
the privacy claim true rather than promised.
This is the brief most likely to draw a sceptical question. The answer is strong, but only
if you say it confidently.
---
1. What it does
There is no database. No Postgres, no Supabase, no ORM, no `localStorage`, no
`sessionStorage`, no cookies, no IndexedDB. This was verified by reading every file in
`src/` and `api/`, not assumed.
All data lives in one React state variable — the `fleet` array in `src/App.jsx:32` — for as
long as the browser tab is open. Refresh the page and it is gone.
---
2. How it works
Where state lives
```js
const [fleet, setFleet] = useState(() => cloneFleet(INITIAL_FLEET));  // App.jsx:32
```
Seeded once from `INITIAL_FLEET`, deep-cloned so the seed module itself is never mutated.
Only two things ever change it:
`applyScanResult` (`App.jsx:51-71`) — a confirmed scan
`handleClearSession` (`App.jsx:75-83`) — the reset button
The seed data
`src/data/fleet.js` (227 lines) holds 8 vehicles. Each one:
```js
{
  id: 'alex-taxi-014',
  plate: 'CA 671-045',
  type: 'Minibus Taxi',
  label: 'Alex Taxi 14',
  driverName: 'B. Khumalo',
  dailyIncome: 1400,        // rand per day
  passengerLoad: 14,        // people carried daily
  documents: [
    { type: 'roadworthy', docNumber: 'RWC-30044', holderName: 'B. Khumalo',
      issueDate: '...', expiryDate: '...', verified: false }
  ]
}
```
`dailyIncome` and `passengerLoad` are the two inputs the risk engine weighs against each
other. Everything else is display.
Dates are relative, not fixed
`TODAY` (`fleet.js:31-35`) is computed at module load — `new Date()` with the hour pinned to
09:00 to dodge midnight edge cases. Every date in the file is an offset from it via
`daysFromRef()` (`:37-41`).
This was a real bug fix. An earlier version hardcoded `2026-08-21`, and the "Critical"
count drifted between test runs 48 hours apart — 0 on one run, 2 on another, same code.
Worse, after the event every date would eventually read EXPIRED for anyone opening the repo.
Now every page load gets the identical relative story, whenever it runs. If a judge opens
this in six months, it still demos correctly.
`issuedFor()` (`:46-48`) backdates issue dates 365 days from their expiry, so certificates
read as plausibly issued, not just plausibly expiring.
How the data is tuned
The numbers are staged for legibility, and you should say so — it's honest and it's what
makes the moment land:
`metro-van-001` — R3,200/day, 0 passengers, expires in 5 days. Starts at #1.
`alex-taxi-014` — R1,400/day, 14 passengers, cert stale and `verified: false`.
Starts near the bottom.
The demo scan (`DEMO_SCAN_RESULT`, `:211-219`) gives the taxi a real certificate expiring in
11 days — which is later than the van's 5 days. So:
In risk mode, the taxi jumps to #1, because 14 passengers outweigh the van's revenue.
In expiry mode (the naive toggle), the van stays first, because 5 < 11.
That gap, after the same scan, is the proof this isn't a reminder app. It's engineered into
the seed data on purpose (`fleet.js:14-19`).
How a scan merges in
`applyScanResult` (`App.jsx:51-71`):
Deep-clone the fleet.
`findVehicleByPlate` (`fleet.js:223-227`) — uppercase, strip spaces and hyphens, exact
match. No fuzzy matching.
No match → set `scanError`, return the previous state unchanged.
Match → `documents.push({...})` with `verified: true`.
Scans are additive. Old documents are never overwritten or deleted. That's why
`worstDocument()` (`risk.js:36-42`) reduces across the array to find whichever is closest to
lapsing, and why the Certificates register lists every document rather than just the latest.
---
3. Why it was built this way
The original proposal had Supabase with row-level security, database views and triggers. All
of it was cut, for three reasons:
The security was ceremony. The backend would have used a service-role key, which bypasses
RLS entirely. The policies would have looked rigorous and protected nothing.
Views and triggers are unfixable under time pressure. A trigger silently producing wrong
numbers at 2am, the night before a pitch, is not a debuggable problem in the time available.
It makes the privacy claim true. This is the real reason. With a database, "we don't keep
your data" is a promise you're asking someone to trust. With no database, it's a description
of the architecture. There is no persistence code to audit because there is no persistence
code.
---
4. The POPIA position
South Africa's Protection of Personal Information Act governs processing of personal
information — and driver names on certificates qualify.
What we can state as fact:
No server-side persistence. `api/scan.js` forwards an image and returns fields. It
writes no disk, calls no database, and its only log line (`:82`) logs the error object,
not extracted fields.
No client-side persistence. No storage API is called anywhere in the codebase.
One outbound request, total. The only network call the app makes is the `/api/scan`
POST during a live scan. Fleet state is never transmitted anywhere.
Session-scoped by construction. Refresh or "Clear session" and it's gone.
This is what `PrivacyBanner.jsx:28-34` tells the user on screen, and it ends by naming the
limit honestly: a real pilot deployment would need an explicit retention policy and access
controls before storing any of this beyond a demo.
---
5. Likely judge questions
"So nothing is saved at all? What use is that?"
For a demo, it's the point — you can photograph a real certificate and nothing about it
survives the tab. For a pilot, you'd add persistence with a stated retention policy. That's
a deliberate next step, not an oversight, and it's the honest place for that conversation to
start.
"How would you add persistence?"
`localStorage` is about five lines — the state is already a single serialisable array. Real
multi-user persistence means a database, and at that point the interesting work is the
retention policy and access controls, not the schema.
"Is this real data?"
It's synthetic data, tuned so the demo is legible. The formula is real, the calculation is
real, and the numbers are plausible for a small Cape Town operator — but these are not eight
real vehicles, and we're not claiming they are.
"Isn't the demo rigged if you tuned the data?"
The data is staged; the mechanism isn't. The taxi is at 14 passengers and the van at 0
because that's what makes the trade-off visible in three seconds. Change any number in
`fleet.js` and the ranking recomputes honestly — the formula doesn't know which vehicle it's
supposed to favour. Drag the slider to pure revenue and the van wins, live.
"What about POPIA?"
Use the four facts in §4. Lead with: nothing is persisted anywhere, and that's enforced by
the architecture rather than by a policy document.
