// api/fleet.js
//
// The fleet endpoint. Two verbs:
//
//   GET  /api/fleet   — the whole fleet with its documents
//   POST /api/fleet   — attach a confirmed certificate to a vehicle,
//                       then return the updated fleet in the same response
//
// The POST returning the new fleet is deliberate: the client applies one
// state update from one round trip, so the re-rank still happens in a single
// render rather than a write followed by a refetch. That keeps the moment the
// whole pitch depends on as close to instant as a persisted app can be.

import { loadFleet, findVehicleIdByPlate, query } from './_db.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      res.status(200).json({ fleet: await loadFleet() });
      return;
    }

    if (req.method === 'POST') {
      const { plate, docType, holderName, docNumber, issueDate, expiryDate } = req.body || {};

      if (!plate || !expiryDate) {
        res.status(400).json({ error: 'plate and expiryDate are required.' });
        return;
      }

      const vehicleId = await findVehicleIdByPlate(plate);
      if (!vehicleId) {
        res.status(404).json({ error: `No vehicle on file matches plate "${plate}".` });
        return;
      }

      // A re-scan of the same certificate should update it, not accumulate a
      // second identical row — document_number is UNIQUE, so an unguarded
      // insert would fail on the second scan of the same document. Scanning a
      // genuinely new certificate still adds a row, which is what lets
      // worstDocument() see the full history.
      await query(
        `INSERT INTO documents
           (vehicle_id, document_type, holder_name, issue_date, expiry_date, document_number, verified)
         VALUES ($1, $2, $3, $4, $5, $6, TRUE)
         ON CONFLICT (document_number) DO UPDATE SET
           vehicle_id    = EXCLUDED.vehicle_id,
           document_type = EXCLUDED.document_type,
           holder_name   = EXCLUDED.holder_name,
           issue_date    = EXCLUDED.issue_date,
           expiry_date   = EXCLUDED.expiry_date,
           verified      = TRUE`,
        [
          vehicleId,
          docType || 'roadworthy',
          holderName || null,
          issueDate || null,
          expiryDate,
          docNumber || null,
        ]
      );

      res.status(200).json({ fleet: await loadFleet(), matchedId: `veh-${vehicleId}` });
      return;
    }

    res.status(405).json({ error: 'Use GET or POST.' });
  } catch (err) {
    console.error('fleet.js failed:', err);
    if (err.message === 'DATABASE_URL is not set.') {
      res.status(500).json({ error: 'Database is not configured.' });
      return;
    }
    res.status(502).json({ error: 'Could not reach the fleet database.' });
  }
}
