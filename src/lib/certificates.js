// src/lib/certificates.js
//
// The certificate register: every document on file, across every vehicle,
// flattened into one list — plus a row for any vehicle that has no
// document at all, since "nothing on file" is exactly the gap this
// product exists to surface.
//
// Deliberately separate from risk.js's classifyStatus(). That one answers
// "how much business risk does this vehicle carry" (blends revenue and
// passenger load into the tier). This one answers "is this specific piece
// of paperwork still valid" — a pure date question. A document can be
// DOC_EXPIRING on a vehicle whose overall risk tier is still LOW because
// it earns little and carries nobody; conflating the two would hide real
// expiries behind a vehicle's low business stakes.

import { daysUntil } from './risk';

export const DOC_STATUS = {
  NONE: 'NONE',
  EXPIRED: 'EXPIRED',
  EXPIRING: 'EXPIRING',
  VALID: 'VALID',
};

const EXPIRING_WINDOW_DAYS = 14;

export function classifyDocStatus(daysLeft) {
  if (daysLeft <= 0) return DOC_STATUS.EXPIRED;
  if (daysLeft <= EXPIRING_WINDOW_DAYS) return DOC_STATUS.EXPIRING;
  return DOC_STATUS.VALID;
}

/**
 * One row per document, plus one NONE row per document-less vehicle.
 * Sorted soonest-expiry-first — the natural order for an audit list,
 * distinct from the Action Queue's risk-weighted order.
 */
export function buildCertificateRegister(fleet, now = new Date()) {
  const rows = [];

  fleet.forEach((vehicle) => {
    if (!vehicle.documents || vehicle.documents.length === 0) {
      rows.push({ vehicle, doc: null, daysLeft: Infinity, status: DOC_STATUS.NONE });
      return;
    }
    vehicle.documents.forEach((doc) => {
      const daysLeft = daysUntil(doc.expiryDate, now);
      rows.push({ vehicle, doc, daysLeft, status: classifyDocStatus(daysLeft) });
    });
  });

  return rows.sort((a, b) => a.daysLeft - b.daysLeft);
}
