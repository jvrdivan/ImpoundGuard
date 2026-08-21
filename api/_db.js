// api/_db.js
//
// Postgres access for the serverless functions. Underscore-prefixed so
// Vercel treats it as a shared module rather than an HTTP endpoint.
//
// One module-level pool, deliberately small. Serverless invocations are
// independent processes but warm containers are reused, so a module-scoped
// pool survives between requests on the same container and avoids paying
// TCP + TLS + auth on every call. max:1 because each container handles one
// request at a time — a bigger pool here just multiplies idle connections
// across containers and exhausts the server's connection limit, which is the
// classic way serverless kills a Postgres instance.

import pg from 'pg';

// Certificate dates are DATE columns and mean a calendar day, not an instant.
// node-postgres otherwise hands back a JS Date in the server's timezone, which
// can shift the day across a UTC boundary and silently move an expiry. Parse
// them as the plain YYYY-MM-DD string the app already works in.
pg.types.setTypeParser(1082, (value) => value);
// NUMERIC arrives as a string to preserve precision; the risk engine does
// arithmetic on it, so convert.
pg.types.setTypeParser(1700, (value) => (value === null ? null : Number(value)));

let pool;

export function getPool() {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set.');
    }
    pool = new pg.Pool({
      connectionString,
      max: 1,
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
      // Hosted providers (Neon, Vercel Postgres, Supabase) require TLS but
      // present certs signed by roots the Lambda image doesn't always carry.
      // Local development over a unix socket or plain TCP has no TLS at all.
      ssl: /\blocalhost\b|\b127\.0\.0\.1\b|sslmode=disable/.test(connectionString)
        ? false
        : { rejectUnauthorized: false },
    });
  }
  return pool;
}

export function query(text, params) {
  return getPool().query(text, params);
}

/**
 * The whole fleet, shaped exactly as the UI already expects it.
 *
 * The mapping from database columns to app fields lives here and only here:
 * risk.js, stats.js and every component keep working against the same object
 * shape they did when the fleet was a hard-coded array, so adding persistence
 * did not ripple through the rendering code.
 */
export async function loadFleet() {
  const { rows } = await query(`
    SELECT
      v.vehicle_id,
      v.plate_number,
      v.vehicle_name,
      v.vehicle_type,
      v.driver_name,
      v.daily_revenue,
      v.passenger_load,
      COALESCE(
        json_agg(
          json_build_object(
            'type',       d.document_type,
            'docNumber',  d.document_number,
            'holderName', d.holder_name,
            'issueDate',  d.issue_date,
            'expiryDate', d.expiry_date,
            'verified',   d.verified
          )
          ORDER BY d.expiry_date
        ) FILTER (WHERE d.document_id IS NOT NULL),
        '[]'
      ) AS documents
    FROM vehicles v
    LEFT JOIN documents d ON d.vehicle_id = v.vehicle_id
    GROUP BY v.vehicle_id
    ORDER BY v.vehicle_id
  `);

  return rows.map((row) => ({
    id: `veh-${row.vehicle_id}`,
    plate: row.plate_number,
    type: row.vehicle_type,
    label: row.vehicle_name,
    driverName: row.driver_name,
    dailyIncome: row.daily_revenue,
    passengerLoad: row.passenger_load,
    documents: row.documents,
  }));
}

/** Normalised plate matching — mirrors findVehicleByPlate on the client. */
export async function findVehicleIdByPlate(plate) {
  const { rows } = await query(
    `SELECT vehicle_id FROM vehicles
      WHERE upper(regexp_replace(plate_number, '[\\s-]', '', 'g'))
          = upper(regexp_replace($1, '[\\s-]', '', 'g'))
      LIMIT 1`,
    [plate ?? '']
  );
  return rows[0]?.vehicle_id ?? null;
}
