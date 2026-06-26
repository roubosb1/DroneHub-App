const crypto = require('crypto');

let _db = null;
function getDb() {
  if (!_db) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
      });
    }
    _db = admin.firestore();
  }
  return _db;
}

const PLAID_BASE = process.env.PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : 'https://sandbox.plaid.com';

async function plaidPost(endpoint, body) {
  const resp = await fetch(`${PLAID_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body,
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data.error_message || JSON.stringify(data));
  return data;
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };

  const auth = event.headers?.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { body = {}; }
  const action = body.action;

  try {
    if (action === 'create_link_token') {
      const data = await plaidPost('/link/token/create', {
        user: { client_user_id: body.userId || 'dh-user' },
        client_name: 'DroneHub',
        products: ['transactions'],
        country_codes: body.countryCodes || ['US', 'CA'],
        language: 'en',
      });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ link_token: data.link_token }) };
    }

    if (action === 'exchange_token') {
      const data = await plaidPost('/item/public_token/exchange', {
        public_token: body.publicToken,
      });
      const db = getDb();
      const docId = body.orgId + ':plaid_items';
      const existing = await db.collection('dh_secure').doc(docId).get();
      const items = existing.exists ? (existing.data().items || []) : [];
      items.push({
        access_token: data.access_token,
        item_id: data.item_id,
        label: body.label || 'Bank Account',
        country: body.country || 'US',
        added: new Date().toISOString(),
      });
      await db.collection('dh_secure').doc(docId).set({ items });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true, item_id: data.item_id }) };
    }

    if (action === 'list_items') {
      const db = getDb();
      const doc = await db.collection('dh_secure').doc(body.orgId + ':plaid_items').get();
      const items = doc.exists ? (doc.data().items || []) : [];
      const safe = items.map(i => ({ item_id: i.item_id, label: i.label, country: i.country, added: i.added }));
      return { statusCode: 200, headers: cors, body: JSON.stringify({ items: safe }) };
    }

    if (action === 'remove_item') {
      const db = getDb();
      const docId = body.orgId + ':plaid_items';
      const doc = await db.collection('dh_secure').doc(docId).get();
      if (!doc.exists) return { statusCode: 404, headers: cors, body: JSON.stringify({ error: 'No items' }) };
      const items = (doc.data().items || []).filter(i => i.item_id !== body.itemId);
      const removed = (doc.data().items || []).find(i => i.item_id === body.itemId);
      if (removed) {
        try { await plaidPost('/item/remove', { access_token: removed.access_token }); } catch {}
      }
      await db.collection('dh_secure').doc(docId).set({ items });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ success: true }) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Unknown action' }) };
  } catch (err) {
    console.error('plaid-link error:', err);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
