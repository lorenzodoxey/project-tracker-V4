// Netlify Function: Users storage with Netlify Blobs
// Simple API
//   GET    /.netlify/functions/users        -> { users: { [username]: { password, name, role, ... } } }
//   PUT    /.netlify/functions/users        -> body: { [username]: { ... } }  (custom users only)

const { getStore } = require('@netlify/blobs');

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
    const store = getStore('mhm-tracker-users');

    if (event.httpMethod === 'GET') {
      const data = (await store.get('users', { type: 'json' })) || {};
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ users: data, updated: Date.now() }) };
    }

    if (event.httpMethod === 'PUT') {
      const body = event.body ? JSON.parse(event.body) : {};
      if (typeof body !== 'object' || Array.isArray(body)) {
        return { statusCode: 400, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Invalid payload' }) };
      }
      await store.set('users', JSON.stringify(body), { metadata: { updated: Date.now() } });
      return { statusCode: 200, headers: JSON_HEADERS, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 405, headers: JSON_HEADERS, body: JSON.stringify({ error: 'Method not allowed' }) };
  } catch (e) {
    return { statusCode: 500, headers: JSON_HEADERS, body: JSON.stringify({ error: e.message }) };
  }
};
