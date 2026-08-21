// src/data/fleet.js
//
// Seed data for the 8-vehicle demo fleet. No database — this is the whole
// "backend" for the hackathon build. App.jsx clones this into React state
// and mutates it as certificates get scanned.
//
// Numbers are tuned on purpose, not arbitrary: at the default 50/50
// revenue/safety slider, ALEX-TAXI-014 (14 passengers) starts near the
// bottom of the ranking because its roadworthy record is stale/unverified.
// When the demo scan lands a fresh certificate, it jumps to #1 — ahead of
// METRO-VAN-001, which earns more than double but carries nobody. That jump
// is the entire pitch.
//
// Deliberately, the scanned cert's real expiry (~11 days out) is LATER than
// the van's (~5 days out) — so a naive "soonest expiry wins" sort (the
// naive-mode toggle in the UI) still puts the van first even after the
// scan. Only the risk engine's safety weighting pushes the taxi to #1. That
// gap between the two modes, after the same scan, is what proves this
// isn't just a reminder app. See risk.js for the scoring math.
//
// Dates are offsets from THE MOMENT THIS MODULE LOADS, not a fixed
// calendar date. This module evaluates once per page load, so every
// session gets the exact same relative story — the van 5 days out, the
// taxi's stale cert 25 days out, the scanned cert replacing it at 11
// days out — no matter whether that's tonight, during the actual
// hackathon, or someone reviewing the repo months later. An earlier
// version anchored to a fixed hackathon date (2026-08-21) instead; that
// drifted day to day before the hackathon (0 "Critical" on one test run,
// 2 on another, 48 hours apart, same code) and would have aged into
// everything reading EXPIRED for anyone opening this after the event.
const TODAY = (() => {
  const d = new Date();
  d.setHours(9, 0, 0, 0); // anchor away from midnight edge cases
  return d;
})();

function daysFromRef(days) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

// Roadworthy certificates run ~1 year; issue date is just the expiry
// offset shifted back 365 days so every document reads as plausibly
// issued, not just plausibly expiring.
function issuedFor(expiryOffsetDays) {
  return daysFromRef(expiryOffsetDays - 365);
}

export const INITIAL_FLEET = [
  {
    id: 'metro-van-001',
    plate: 'CA 402-118',
    type: 'Courier Van',
    label: 'Metro Courier Van',
    driverName: 'S. Ndlovu',
    dailyIncome: 3200,
    passengerLoad: 0,
    documents: [
      {
        type: 'roadworthy',
        docNumber: 'RWC-88213',
        holderName: 'S. Ndlovu',
        issueDate: issuedFor(5),
        expiryDate: daysFromRef(5),
        verified: true,
      },
    ],
  },
  {
    id: 'tow-002',
    plate: 'CA 118-902',
    type: 'Tow Truck',
    label: 'CBD Recovery Tow Truck',
    driverName: 'M. Petersen',
    dailyIncome: 2600,
    passengerLoad: 2,
    documents: [
      {
        type: 'roadworthy',
        docNumber: 'RWC-77410',
        holderName: 'M. Petersen',
        issueDate: issuedFor(8),
        expiryDate: daysFromRef(8),
        verified: true,
      },
    ],
  },
  {
    id: 'courier-003',
    plate: 'CA 559-330',
    type: 'Courier Van',
    label: 'Parcel Express Van',
    driverName: 'T. Abrahams',
    dailyIncome: 2000,
    passengerLoad: 4,
    documents: [
      {
        type: 'roadworthy',
        docNumber: 'RWC-63981',
        holderName: 'T. Abrahams',
        issueDate: issuedFor(12),
        expiryDate: daysFromRef(12),
        verified: true,
      },
    ],
  },
  {
    id: 'shuttle-004',
    plate: 'CA 220-874',
    type: 'Shuttle',
    label: 'Airport Shuttle',
    driverName: 'L. Daniels',
    dailyIncome: 1800,
    passengerLoad: 6,
    documents: [
      {
        type: 'roadworthy',
        docNumber: 'RWC-51027',
        holderName: 'L. Daniels',
        issueDate: issuedFor(17),
        expiryDate: daysFromRef(17),
        verified: true,
      },
    ],
  },
  {
    id: 'courier-005',
    plate: 'CA 884-201',
    type: 'Courier Van',
    label: 'Same-Day Courier Van',
    driverName: 'R. Isaacs',
    dailyIncome: 2400,
    passengerLoad: 3,
    documents: [
      {
        type: 'roadworthy',
        docNumber: 'RWC-45219',
        holderName: 'R. Isaacs',
        issueDate: issuedFor(20),
        expiryDate: daysFromRef(20),
        verified: true,
      },
    ],
  },
  {
    id: 'alex-taxi-014',
    plate: 'CA 671-045',
    type: 'Minibus Taxi',
    label: 'Alex Taxi 14',
    driverName: 'B. Khumalo',
    dailyIncome: 1400,
    passengerLoad: 14,
    documents: [
      {
        type: 'roadworthy',
        docNumber: 'RWC-30044',
        holderName: 'B. Khumalo',
        issueDate: issuedFor(25),
        // Stale on purpose: this is last known cert data, unverified this
        // cycle — exactly the "shoebox in the cab" problem the pitch names.
        // The demo scan replaces this with the real, much closer expiry.
        expiryDate: daysFromRef(25),
        verified: false,
      },
    ],
  },
  {
    id: 'sedan-006',
    plate: 'CA 390-667',
    type: 'Sedan',
    label: 'Meter Taxi Sedan',
    driverName: 'D. van Wyk',
    dailyIncome: 1600,
    passengerLoad: 1,
    documents: [
      {
        type: 'roadworthy',
        docNumber: 'RWC-29187',
        holderName: 'D. van Wyk',
        issueDate: issuedFor(22),
        expiryDate: daysFromRef(22),
        verified: true,
      },
    ],
  },
  {
    id: 'courier-007',
    plate: 'CA 112-558',
    type: 'Courier Van',
    label: 'Local Parcel Runner',
    driverName: 'N. Fortuin',
    dailyIncome: 900,
    passengerLoad: 2,
    documents: [
      {
        type: 'roadworthy',
        docNumber: 'RWC-18820',
        holderName: 'N. Fortuin',
        issueDate: issuedFor(24),
        expiryDate: daysFromRef(24),
        verified: true,
      },
    ],
  },
];

// The demo scan payload used by ScanPanel's demo mode (see task: demo-mode
// canned response). Lives here, next to the vehicle it targets, so the two
// stay in sync if the fleet data ever changes.
export const DEMO_SCAN_RESULT = {
  docType: 'roadworthy',
  plate: 'CA 671-045', // matches alex-taxi-014
  holderName: 'B. Khumalo',
  docNumber: 'RWC-30099',
  issueDate: issuedFor(11),
  expiryDate: daysFromRef(11),
  confidence: 0.94,
};

// Matching a scanned plate to a vehicle is a lookup, not a guess — every
// mock certificate carries the same plate field in the same visible spot.
export function findVehicleByPlate(fleet, plate) {
  const normalize = (p) => (p || '').toUpperCase().replace(/[\s-]/g, '');
  const target = normalize(plate);
  return fleet.find((v) => normalize(v.plate) === target) || null;
}
