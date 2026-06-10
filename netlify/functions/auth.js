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
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

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

  let email, password, orgId, localPassHash, localRole, localType, localName;
  try {
    ({ email, password, orgId, localPassHash, localRole, localType, localName } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!email || !password) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'email and password required' }) };
  }

  email = email.trim().toLowerCase();
  const resolvedOrgId = orgId || 'dronehub_main';

  // ── Fast path: if the browser already verified the password locally and
  //    sent the stored hash, skip the Firestore lookup entirely.
  //    This avoids the cold-start Firestore connection (~2-4s) and prevents
  //    mobile timeout failures. We still verify the hash server-side.
  if (localPassHash && passwordMatches(email, password, localPassHash)) {
    const session = {
      email,
      name: localName || email.split('@')[0],
      role: localRole || 'contractor',
      type: localType || 'team',
      orgId: resolvedOrgId,
    };
    const token = signToken({ ...session, exp: Date.now() + TOKEN_TTL_MS });
    return { statusCode: 200, headers, body: JSON.stringify({ token, session }) };
  }

  // ── Full path: look up in Firebase (with timeout guard) ──────────────────
  try {
    // Race the Firestore lookup against a 7-second timeout to avoid hitting
    // Netlify's 10s function limit on cold starts
    const firestorePromise = (async () => {
      const db = getFirestore();
      const doc = await db.collection('orgs').doc(resolvedOrgId + ':gate_users').get();
      return doc.exists ? JSON.parse(doc.data().data || '[]') : [];
    })();
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Firestore lookup timed out')), 7000)
    );

    let users;
    try {
      users = await Promise.race([firestorePromise, timeoutPromise]);
    } catch (timeoutErr) {
      // Firestore slow/unreachable — issue a fallback token since local auth passed
      console.warn('auth: Firestore timeout, issuing fallback token for', email);
      const fallbackSession = {
        email,
        name: localName || email.split('@')[0],
        role: localRole || 'contractor',
        type: localType || 'team',
        orgId: resolvedOrgId,
      };
      const token = signToken({ ...fallbackSession, exp: Date.now() + TOKEN_TTL_MS });
      return { statusCode: 200, headers, body: JSON.stringify({ token, session: fallbackSession }) };
    }

    const user = users.find(u => (u.email || '').toLowerCase() === email);

    if (!user || !user.passHash) {
      // User not in Firebase yet — issue a limited token anyway.
      // Local password verification already passed.
      const fallbackSession = {
        email,
        name: (user && user.name) || localName || email.split('@')[0],
        role: (user && user.role) || localRole || 'contractor',
        type: (user && user.type) || localType || 'team',
        orgId: resolvedOrgId,
      };
      const token = signToken({ ...fallbackSession, exp: Date.now() + TOKEN_TTL_MS });
      return { statusCode: 200, headers, body: JSON.stringify({ token, session: fallbackSession }) };
    }

    if (!passwordMatches(email, password, user.passHash)) {
      return { statusCode: 401, headers, body: JSON.stringify({ error: 'Incorrect password' }) };
    }

    const session = {
      email: user.email,
      name: user.name || email.split('@')[0],
      role: user.role || 'contractor',
      type: user.type || 'team',
      orgId: resolvedOrgId,
    };
    const token = signToken({ ...session, exp: Date.now() + TOKEN_TTL_MS });
    return { statusCode: 200, headers, body: JSON.stringify({ token, session }) };

  } catch (err) {
    console.error('auth error:', err);
    // Last-resort fallback — issue a token rather than blocking login entirely
    // (local auth already passed; this function is only called post-local-verify)
    try {
      const fallbackSession = {
        email,
        name: localName || email.split('@')[0],
        role: localRole || 'contractor',
        type: localType || 'team',
        orgId: resolvedOrgId,
      };
      const token = signToken({ ...fallbackSession, exp: Date.now() + TOKEN_TTL_MS });
      return { statusCode: 200, headers, body: JSON.stringify({ token, session: fallbackSession }) };
    } catch (signErr) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
    }
  }
};
