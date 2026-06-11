/**
 * DroneHub Firebase Proxy
 * POST /.netlify/functions/firebase-proxy
 * Header: Authorization: Bearer <token>
 * Body: { action, col, docId, data? }
 *
 * All Firestore reads and writes go through this function. The browser
 * never touches Firebase directly. Firestore security rules should be
 * set to deny ALL direct access (allow read, write: if false).
 *
 * Actions: get | set | getAll | delete
 *
 * Required Netlify environment variables:
 *   FIREBASE_SERVICE_ACCOUNT  — minified JSON of the Firebase service account key
 *   JWT_SECRET                — same secret used by auth.js to sign tokens
 */

const crypto = require('crypto');

// verifyToken is inlined here (same logic as auth.js) to avoid a cross-function
// require('./auth') that can break with some Netlify bundlers (nft, esbuild).
function verifyToken(token) {
  try {
    const [data, sig] = token.split('.');
    const secret = process.env.JWT_SECRET || 'change-me-set-JWT_SECRET-env-var';
    const expected = crypto.createHmac('sha256', secret).update(data).digest('hex');
    if (sig !== expected) return null;
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString());
    if (payload.exp < Date.now()) return null; // expired
    return payload;
  } catch (e) {
    return null;
  }
}

// ── Firebase Admin init (lazy, singleton) ───────────────────────────────────
let _db = null;
function getDb() {
  if (!_db) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
    }
    _db = admin.firestore();
  }
  return _db;
}

// ── Simple in-memory rate limiter (per IP, resets on cold start) ─────────────
const _rateCounts = {};
const RATE_LIMIT = 600;  // max requests per minute per IP (team login fires ~40 reads each; 10 users = 400/min)
const RATE_WINDOW = 60 * 1000;

function isRateLimited(ip) {
  const now = Date.now();
  if (!_rateCounts[ip] || now - _rateCounts[ip].start > RATE_WINDOW) {
    _rateCounts[ip] = { count: 1, start: now };
    return false;
  }
  _rateCounts[ip].count++;
  return _rateCounts[ip].count > RATE_LIMIT;
}

// ── Handler ──────────────────────────────────────────────────────────────────
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

  // Rate limiting
  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientIp)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  // Token validation
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token provided' }) };
  }
  const session = verifyToken(token);
  if (!session) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) };
  }

  // Parse request body
  let action, col, docId, data, subCol, docs;
  try {
    ({ action, col, docId, data, subCol, docs } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!action || !col) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'action and col required' }) };
  }

  // Enforce org isolation: only allow access to the user's own org's documents
  const userOrgId = session.orgId || 'dronehub_main';
  if (docId && !docId.startsWith(userOrgId + ':') && col === 'orgs') {
    // Sub-collection actions bypass this check — they're org-isolated via userOrgId
    const isSubColAction = ['getSubCollection','setSubDoc','deleteSubDoc','batchSetSubDocs','deleteSubCollection'].includes(action);
    if (!isSubColAction) {
      // Allow platform-level reads for multi-org lookup (admin only)
      if (session.role !== 'admin' || action !== 'get') {
        return { statusCode: 403, headers, body: JSON.stringify({ error: 'Access denied to this document' }) };
      }
    }
  }

  try {
    const db = getDb();

    if (action === 'get') {
      if (!docId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'docId required' }) };
      const snap = await db.collection(col).doc(docId).get();
      return { statusCode: 200, headers, body: JSON.stringify({ data: snap.exists ? snap.data() : null }) };
    }

    if (action === 'set') {
      if (!docId || !data) return { statusCode: 400, headers, body: JSON.stringify({ error: 'docId and data required' }) };
      await db.collection(col).doc(docId).set(data, { merge: true });
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'getAll') {
      const snap = await db.collection(col).get();
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { statusCode: 200, headers, body: JSON.stringify({ data: docs }) };
    }

    if (action === 'delete') {
      if (!docId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'docId required' }) };
      await db.collection(col).doc(docId).delete();
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── Sub-collection actions (orgs/{userOrgId}/{subCol}/...) ──────────────────

    if (action === 'getSubCollection') {
      if (!subCol) return { statusCode: 400, headers, body: JSON.stringify({ error: 'subCol required' }) };
      const snap = await db.collection('orgs').doc(userOrgId).collection(subCol).get();
      const result = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      return { statusCode: 200, headers, body: JSON.stringify({ data: result }) };
    }

    if (action === 'setSubDoc') {
      if (!subCol || !docId || !data) return { statusCode: 400, headers, body: JSON.stringify({ error: 'subCol, docId, data required' }) };
      await db.collection('orgs').doc(userOrgId).collection(subCol).doc(String(docId)).set(data);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'deleteSubDoc') {
      if (!subCol || !docId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'subCol and docId required' }) };
      await db.collection('orgs').doc(userOrgId).collection(subCol).doc(String(docId)).delete();
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'batchSetSubDocs') {
      if (!subCol || !Array.isArray(docs)) return { statusCode: 400, headers, body: JSON.stringify({ error: 'subCol and docs[] required' }) };
      // Firestore batch limit is 500 — process in chunks
      const CHUNK = 490;
      for (let i = 0; i < docs.length; i += CHUNK) {
        const chunk = docs.slice(i, i + CHUNK);
        const batch = db.batch();
        chunk.forEach(doc => {
          const { id, ...docData } = doc;
          if (!id) return;
          const ref = db.collection('orgs').doc(userOrgId).collection(subCol).doc(String(id));
          batch.set(ref, docData);
        });
        await batch.commit();
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    if (action === 'deleteSubCollection') {
      if (!subCol) return { statusCode: 400, headers, body: JSON.stringify({ error: 'subCol required' }) };
      const snap = await db.collection('orgs').doc(userOrgId).collection(subCol).get();
      if (!snap.empty) {
        const CHUNK = 490;
        for (let i = 0; i < snap.docs.length; i += CHUNK) {
          const batch = db.batch();
          snap.docs.slice(i, i + CHUNK).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action: ' + action }) };

  } catch (err) {
    console.error('firebase-proxy error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'Firebase error' }) };
  }
};
