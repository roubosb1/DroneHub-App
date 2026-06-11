/**
 * DroneHub Message Encryption Key Endpoint
 * GET /.netlify/functions/get-msg-key
 * Header: Authorization: Bearer <session-token>
 *
 * Returns the AES-GCM encryption key for the messaging system to any
 * authenticated session. The key is stored server-side only — the browser
 * never touches the raw key bytes in localStorage or on disk.
 *
 * Required Netlify environment variable:
 *   MSG_ENCRYPTION_KEY  — 64 hex characters (256-bit random key)
 *                          Generate: openssl rand -hex 32
 *   JWT_SECRET          — same secret used by auth.js
 */

const crypto = require('crypto');

// verifyToken inlined to avoid cross-function require('./auth') that can break bundling
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

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...headers, 'Access-Control-Allow-Headers': 'Authorization' } };
  }

  // Validate session token
  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token' }) };
  }
  const session = verifyToken(token);
  if (!session) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired token' }) };
  }

  const key = process.env.MSG_ENCRYPTION_KEY;
  if (!key || key.length < 64) {
    // MSG_ENCRYPTION_KEY not configured — return empty so app falls back to plaintext
    return { statusCode: 200, headers, body: JSON.stringify({ key: null }) };
  }

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ key }),
  };
};
