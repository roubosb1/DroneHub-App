/**
 * DroneHub Receipt Image Storage
 * Uses Firebase Storage (Cloud Storage) instead of Firestore for binary images.
 *
 * POST /.netlify/functions/receipt-storage
 *   action: "upload" | "get" | "delete"
 *   receiptId: string (e.g. "receipt_1718000000000")
 *   image: base64 string (upload only)
 *
 * Required env vars: FIREBASE_SERVICE_ACCOUNT, JWT_SECRET
 */

const crypto = require('crypto');

function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const secret = process.env.JWT_SECRET || 'change-me-set-JWT_SECRET-env-var';
    const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

let _bucket = null;
function getBucket() {
  if (!_bucket) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
      const parsed = JSON.parse(sa);
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
        storageBucket: parsed.project_id + '.firebasestorage.app',
      });
    }
    _bucket = admin.storage().bucket();
  }
  return _bucket;
}

const _rateCounts = {};
function isRateLimited(ip) {
  const now = Date.now();
  if (!_rateCounts[ip] || now - _rateCounts[ip].start > 60000) {
    _rateCounts[ip] = { count: 1, start: now };
    return false;
  }
  _rateCounts[ip].count++;
  return _rateCounts[ip].count > 30;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type,Authorization' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientIp)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !verifyToken(token)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action, receiptId, image, orgId } = body;
  if (!receiptId || !/^receipt_\d+/.test(receiptId)) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid receiptId' }) };
  }

  const org = orgId || 'dronehub_main';
  const filePath = `receipts/${org}/${receiptId}.jpg`;

  try {
    const bucket = getBucket();

    if (action === 'upload') {
      if (!image || typeof image !== 'string') {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'image (base64) required' }) };
      }
      if (image.length > 2 * 1024 * 1024) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image too large (max ~1.5MB)' }) };
      }

      const buffer = Buffer.from(image, 'base64');
      const file = bucket.file(filePath);
      await file.save(buffer, {
        metadata: { contentType: 'image/jpeg', metadata: { orgId: org, receiptId } },
        resumable: false,
      });

      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'get') {
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (!exists) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Receipt not found' }) };
      }
      const [buffer] = await file.download();
      const base64 = buffer.toString('base64');
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ image: base64 }),
      };
    }

    if (action === 'delete') {
      const file = bucket.file(filePath);
      const [exists] = await file.exists();
      if (exists) await file.delete();
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid action' }) };
  } catch (e) {
    console.error('[receipt-storage]', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Storage error' }) };
  }
};
