// api/reset.js
//
// Restores the document set to the seeded snapshot (documents_seed, created
// by db/schema.sql) and returns the fresh fleet.
//
// This replaces what "Clear session" used to do. When the fleet lived in
// React state, clearing it was a state reset and the data was genuinely gone.
// Now that scans are written to Postgres, there is no session to clear — a
// reload shows the same data. So the honest equivalent is an explicit,
// destructive reset of demo data, which is what this does.
//
// Wrapped in a transaction: a half-reset fleet (documents deleted, seed not
// restored) would be worse than either end state, and this runs during a
// rehearsal when someone wants a clean slate quickly.

import { loadFleet, getPool } from './_db.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Use POST.' });
    return;
  }

  const client = await getPool().connect().catch((err) => {
    console.error('reset.js could not connect:', err);
    return null;
  });

  if (!client) {
    res.status(502).json({ error: 'Could not reach the fleet database.' });
    return;
  }

  try {
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM documents');
      await client.query('INSERT INTO documents SELECT * FROM documents_seed');
      // documents.document_id is a SERIAL; restoring rows with explicit ids
      // leaves the sequence behind them, so the next scan would collide on the
      // primary key. Push it past the highest restored id.
      await client.query(`
        SELECT setval(
          pg_get_serial_sequence('documents', 'document_id'),
          COALESCE((SELECT max(document_id) FROM documents), 1)
        )
      `);
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      // Release before reading the fleet back. loadFleet() goes through the
      // pool, and the pool holds a single connection by design — reading
      // while this transaction still owns it deadlocks until the connection
      // timeout fires.
      client.release();
    }

    res.status(200).json({ fleet: await loadFleet() });
  } catch (err) {
    console.error('reset.js failed:', err);
    res.status(502).json({ error: 'Reset failed.' });
  }
}
