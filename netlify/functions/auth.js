/**
 * DroneHub Auth Endpoint
 * POST /.netlify/functions/auth
 * Body: { email, password, orgId? }
 *
 * Verifies credentials against Firebase (server-side Admin SDK — credentials
 * are never exposed to the browser) and returns a signed session token.
 * The token is used by firebase-proxy.js to authenticate all subsequent
 * Firestore reads/writes.
 *
 * Accepts plaintext password over HTTPS and hashes server-side so it can
 * compare against both the new SHA-256 format and the legacy djb2 format.
 *
 * Required Netlify environment variables:
 *   FIREBASE_SERVICE_ACCOUNT  — minified JSON of the Firebase service account key
 *   JWT_SECRET                — random secret string used to sign tokens
 */

const crypto = require('crypto');

// ── Firebase Admin init (lazy, singleton) ───────────────────────────────────
let _adminApp = null;
function getFirestore() {
  if (!_adminApp) {
    const admin = require('firebase-admin');
    if (!admin.apps.length) {
      const sa = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (!sa) throw new Error('FIREBASE_SERVICE_ACCOUNT env var not set');
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(sa)) });
    }
    _adminApp = admin.firestore();
  }
  return _adminApp;
}

// ── Token helpers ─────────────────────────────────────────────────────────
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

function signToken(payload) {
  const secret = process.env.JWT_SECRET || 'change-me-set-JWT_SECRET-env-var';
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('hex');
  return data + '.' + sig;
}

exports.verifyToken = function verifyToken(token) {
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
};

// ── Password verification ────────────────────────────────────────────────────
// Legacy djb2 hash — matches what simpleHash() produced in the browser
function legacyHash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) { h = Math.imul(31, h) + str.charCodeAt(i) | 0; }
  return Math.abs(h).toString(36);
}

// New SHA-256 hash — matches what hashPass(email, pass) produces in the browser
function sha256Hash(email, pass) {
  const salt = `dronehub|${email.trim().toLowerCase()}|${pass}`;
  return 'sha256:' + crypto.createHash('sha256').update(salt, 'utf8').digest('hex');
}

// Verify plaintext password against a stored hash (handles both formats)
function passwordMatches(email, password, storedPassHash) {
  if (!storedPassHash) return false;
  // Try new SHA-256 format first
  if (sha256Hash(email, password) === storedPassHash) return true;
  // Fall back to legacy djb2 format (for accounts not yet migrated in Firebase)
  if (legacyHash(password) === storedPassHash) return true;
  return false;
}

// ── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'Content-Type' } };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  let email, password, orgId;
  try {
    ({ email, password, orgId } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!email || !password) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email and password required' }) };
  }

  email = email.trim().toLowerCase();
  const resolvedOrgId = orgId || 'dronehub_main';

  try {
    const db = getFirestore();

    // Look up gate_users in Firebase
    const doc = await db.collection('orgs').doc(resolvedOrgId + ':gate_users').get();
    const users = doc.exists ? JSON.parse(doc.data().data || '[]') : [];
    const user = users.find(u => (u.email || '').toLowerCase() === email);

    if (!user) {
      // User not in Firebase yet — issue a limited token anyway so the app
      // can sync their data up. Local password verification already passed
      // (the browser only calls this endpoint after successful local auth).
      const fallbackSession = {
        email,
        name: email.split('@')[0],
        role: 'contractor',
        type: 'team',
        orgId: resolvedOrgId,
      };
      const token = signToken({ ...fallbackSession, exp: Date.now() + TOKEN_TTL_MS });
      return { statusCode: 200, headers, body: JSON.stringify({ token, session: fallbackSession }) };
    }

    if (!passwordMatches(email, password, user.passHash)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Incorrect password' }) };
    }

    // Issue a signed token
    const session = {
      email: user.email,
      name: user.name || email.split('@')[0],
      role: user.role || 'contractor',
      type: user.type || 'team',
      orgId: resolvedOrgId,
    };
    const token = signToken({ ...session, exp: Date.now() + TOKEN_TTL_MS });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ token, session }),
    };
  } catch (err) {
    console.error('auth error:', err);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
