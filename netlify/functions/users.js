// Netlify Function: Users storage (server-side proxy to JSONBlob)
// Simple API
//   GET    /.netlify/functions/users        -> { users: { [username]: { password, name, role, ... } } }
//   PUT    /.netlify/functions/users        -> body: { [username]: { ... } }  (custom users only)

const JSON_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,PUT,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

exports.handler = async (event) => {
  // CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: JSON_HEADERS, body: '' };
  }

  try {
    const BLOB_URL = process.env.JSONBLOB_URL || 'https://jsonblob.com/api/jsonBlob/1417956693685493760';

    if (event.httpMethod === 'GET') {
      const res = await fetch(BLOB_URL, { method: 'GET', headers: { 'Accept': 'application/json' } });
      if (!res.ok) {
        return { statusCode: res.status, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Upstream fetch failed' }) };
      }
      const data = await res.json();
      const users = (data && data.users) ? data.users : (typeof data === 'object' ? data : {});
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ users, updated: Date.now() }) };
    }

    if (event.httpMethod === 'PUT') {
      const body = event.body ? JSON.parse(event.body) : {};
      if (typeof body !== 'object' || Array.isArray(body)) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid payload' }) };
      }
      // JSONBlob expects full JSON doc; include metadata and users map
      const payload = { _meta: 'mhm-tracker-users', users: body, _updated: Date.now() };
      const res = await fetch(BLOB_URL, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        return { statusCode: res.status, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Upstream save failed' }) };
      }
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
