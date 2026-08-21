// src/data/demoScan.js
//
// The canned extraction used by ScanPanel's demo mode and by the
// panic-button. This is the only seed data still living in the client — the
// fleet itself now comes from Postgres (see db/schema.sql and api/fleet.js).
//
// It targets CA 449-102, the Volvo B8R 65-seater. That vehicle is seeded with
// verified = false and an expiry ~89 days out, so before the scan it sits near
// the bottom of the risk ranking: plenty of runway on paper, nobody has
// checked. The scan reveals a real certificate ~9 days from lapsing, and 65
// passengers then drive it to the top.
//
// The contrast that matters: in expiry order it lands mid-table, because five
// other vehicles genuinely expire sooner. Only the risk ranking surfaces it.
// Same data, same scan, different question asked.

/** Days from today as YYYY-MM-DD, so the demo never goes stale. */
function daysFromToday(days) {
  const d = new Date();
  d.setHours(9, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DEMO_SCAN_RESULT = {
  docType: 'roadworthy',
  plate: 'CA 449-102',
  holderName: 'L. Mthembu',
  docNumber: 'CRW-2026-CPT-004822',
  issueDate: daysFromToday(9 - 365),
  expiryDate: daysFromToday(9),
  confidence: 0.94,
};
