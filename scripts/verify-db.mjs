// scripts/verify-db.mjs
//
// End-to-end check of the persistence layer without needing `vercel dev`.
// Invokes the real handlers with mock req/res objects against a real
// Postgres, and asserts the behaviour the demo depends on.
//
//   DATABASE_URL=... node scripts/verify-db.mjs

import fleetHandler from '../api/fleet.js';
import resetHandler from '../api/reset.js';
import { rankFleet } from '../src/lib/risk.js';
import { buildSchedule } from '../src/lib/schedule.js';
import { DEMO_SCAN_RESULT } from '../src/data/demoScan.js';

let failures = 0;

function check(label, condition, detail = '') {
  const mark = condition ? '  ok  ' : ' FAIL ';
  if (!condition) failures++;
  console.log(`[${mark}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function mockRes() {
  return {
    statusCode: null,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; },
  };
}

async function call(handler, req) {
  const res = mockRes();
  await handler(req, res);
  return res;
}

const rankOf = (ranked, plate) =>
  ranked.findIndex((r) => r.vehicle.plate === plate) + 1;

console.log('\n--- reset to seed state ---');
const reset = await call(resetHandler, { method: 'POST' });
check('POST /api/reset returns 200', reset.statusCode === 200, `got ${reset.statusCode}`);
check('reset returns 32 vehicles', reset.body?.fleet?.length === 32, `got ${reset.body?.fleet?.length}`);

console.log('\n--- GET /api/fleet ---');
const get = await call(fleetHandler, { method: 'GET' });
const fleet = get.body?.fleet ?? [];
check('returns 200', get.statusCode === 200, `got ${get.statusCode}`);
check('returns 32 vehicles', fleet.length === 32, `got ${fleet.length}`);

const sample = fleet.find((v) => v.plate === 'CA 449-102');
check('demo target present', Boolean(sample));
check('dailyIncome is a number', typeof sample?.dailyIncome === 'number', `got ${typeof sample?.dailyIncome}`);
check('passengerLoad is a number', typeof sample?.passengerLoad === 'number', `got ${typeof sample?.passengerLoad}`);
check('passengerLoad is 65', sample?.passengerLoad === 65, `got ${sample?.passengerLoad}`);
check('expiryDate is a YYYY-MM-DD string',
  /^\d{4}-\d{2}-\d{2}$/.test(sample?.documents?.[0]?.expiryDate ?? ''),
  `got ${JSON.stringify(sample?.documents?.[0]?.expiryDate)}`);
check('seeded as unverified', sample?.documents?.[0]?.verified === false);

console.log('\n--- risk engine against live data ---');
const before = rankFleet(fleet, { weight: 0.5, mode: 'risk' });
const beforeRank = rankOf(before, 'CA 449-102');
check('scores are non-zero (the columns are populated)',
  before[0].score > 0, `top score ${before[0].score.toFixed(1)}`);
check('demo target starts low in risk order', beforeRank > 20, `rank ${beforeRank}/32`);
console.log(`         top of queue before scan: ${before[0].vehicle.plate} (${before[0].score.toFixed(1)})`);

console.log('\n--- POST /api/fleet (the scan) ---');
const post = await call(fleetHandler, { method: 'POST', body: DEMO_SCAN_RESULT });
check('returns 200', post.statusCode === 200, `got ${post.statusCode}`);
check('returns updated fleet in same response', Array.isArray(post.body?.fleet));
check('reports which vehicle matched', Boolean(post.body?.matchedId), post.body?.matchedId);

const after = rankFleet(post.body.fleet, { weight: 0.5, mode: 'risk' });
const afterRank = rankOf(after, 'CA 449-102');
const afterExpiry = rankOf(rankFleet(post.body.fleet, { weight: 0.5, mode: 'expiry' }), 'CA 449-102');
check('demo target jumps in risk order', afterRank <= 3, `rank ${beforeRank} -> ${afterRank}`);
check('but NOT top in expiry order (the whole argument)',
  afterExpiry > afterRank, `risk #${afterRank} vs expiry #${afterExpiry}`);

console.log('\n--- persistence ---');
const reread = await call(fleetHandler, { method: 'GET' });
const rereadRank = rankOf(rankFleet(reread.body.fleet, { weight: 0.5, mode: 'risk' }), 'CA 449-102');
check('scan survives a fresh read', rereadRank === afterRank, `rank ${rereadRank}`);

console.log('\n--- idempotency (rehearsing twice) ---');
const again = await call(fleetHandler, { method: 'POST', body: DEMO_SCAN_RESULT });
check('re-scanning same certificate succeeds', again.statusCode === 200, `got ${again.statusCode}`);
const docCount = again.body.fleet.find((v) => v.plate === 'CA 449-102').documents.length;
check('does not duplicate the document', docCount === 2, `${docCount} documents`);

console.log('\n--- error paths ---');
const unknown = await call(fleetHandler, { method: 'POST', body: { plate: 'ZZ 00 ZZ GP', expiryDate: '2027-01-01' } });
check('unknown plate returns 404', unknown.statusCode === 404, `got ${unknown.statusCode}`);
const missing = await call(fleetHandler, { method: 'POST', body: { plate: 'CA 449-102' } });
check('missing expiryDate returns 400', missing.statusCode === 400, `got ${missing.statusCode}`);
const wrongVerb = await call(fleetHandler, { method: 'DELETE' });
check('unsupported verb returns 405', wrongVerb.statusCode === 405, `got ${wrongVerb.statusCode}`);

console.log('\n--- maintenance scheduler ---');
const scheduleFleet = await call(fleetHandler, { method: 'GET' }).then((r) => r.body.fleet);
const schedule = buildSchedule(scheduleFleet, { maintenanceDays: 2, slotsPerWeek: 3, horizonWeeks: 12 });

check('every vehicle is scheduled exactly once (or correctly unschedulable)',
  (() => {
    const placed = schedule.weeks.flatMap((w) => w.jobs.map((j) => j.vehicle.id));
    const unsched = schedule.unschedulable.map((j) => j.vehicle.id);
    const all = [...placed, ...unsched];
    return all.length === new Set(all).size && all.length === scheduleFleet.length;
  })(),
  `${schedule.weeks.flatMap((w) => w.jobs).length + schedule.unschedulable.length} placements for ${scheduleFleet.length} vehicles`);

check('no week exceeds the slots-per-week cap',
  schedule.weeks.every((w) => w.jobs.length <= 3));

check('no spare covers two routes in the same week',
  schedule.weeks.every((w) => {
    const covers = w.jobs.map((j) => j.cover?.id).filter(Boolean);
    return new Set(covers).size === covers.length;
  }));

check('a covering vehicle is never also in maintenance that same week',
  schedule.weeks.every((w) => {
    const inMaintenance = new Set(w.jobs.map((j) => j.vehicle.id));
    return w.jobs.every((j) => !j.cover || !inMaintenance.has(j.cover.id));
  }));

const busJob = schedule.weeks.flatMap((w) => w.jobs).find((j) => j.vehicle.plate === 'CA 449-102');
check('the 65-seat bus (zero compatible spares) comes back uncovered',
  Boolean(busJob) && busJob.route && !busJob.cover,
  busJob ? `route=${busJob.route?.code}, cover=${busJob.cover?.plate ?? 'none'}` : 'not scheduled');

console.log('\n--- tightening capacity pushes jobs later, never drops them ---');
const unschedCounts = [1, 2, 3, 6].map(
  (slotsPerWeek) => buildSchedule(scheduleFleet, { maintenanceDays: 2, slotsPerWeek, horizonWeeks: 12 }).unschedulable.length
);
check('unschedulable count is non-increasing as slots-per-week rises',
  unschedCounts.every((n, i) => i === 0 || n <= unschedCounts[i - 1]),
  unschedCounts.join(' -> '));

console.log('\n--- restore seed state ---');
await call(resetHandler, { method: 'POST' });

console.log(failures === 0 ? '\nAll checks passed.\n' : `\n${failures} check(s) FAILED.\n`);
process.exit(failures === 0 ? 0 : 1);
