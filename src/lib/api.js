// src/lib/api.js
//
// Every call the browser makes to our own backend. Kept in one file so the
// network surface is countable: three endpoints, no client-side caching
// layer, no request library.
//
// Errors are thrown with the server's own message where there is one. The
// fleet is the whole screen, so a failure to load it has to be visible and
// explained rather than silently rendering an empty dashboard — an empty
// fleet and a broken database look identical to a user otherwise, and in a
// compliance tool "no vehicles at risk" is the most dangerous thing to show
// by accident.

async function request(url, options) {
  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new Error('Could not reach the server. Check your connection.');
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // Fall through — a non-JSON body on an error status is still an error.
  }

  if (!response.ok) {
    throw new Error(body?.error || `Request failed (${response.status}).`);
  }
  return body;
}

/** The whole fleet, already shaped for risk.js. */
export async function fetchFleet() {
  const { fleet } = await request('/api/fleet');
  return fleet;
}

/**
 * Persist a confirmed certificate and get the updated fleet back in the same
 * response, so the re-rank is one state update rather than write-then-refetch.
 */
export async function saveDocument(fields) {
  return request('/api/fleet', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(fields),
  });
}

/** Restore the document set to the seeded snapshot. Destructive. */
export async function resetDemoData() {
  const { fleet } = await request('/api/reset', { method: 'POST' });
  return fleet;
}

/** Vision extraction. Unchanged by persistence — still stateless. */
export async function extractCertificate({ imageBase64, mimeType }) {
  return request('/api/scan', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ imageBase64, mimeType }),
  });
}
