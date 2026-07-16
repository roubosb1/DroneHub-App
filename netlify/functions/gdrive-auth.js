/**
 * Google Drive OAuth handler
 *
 * GET ?step=init   → redirects to Google OAuth consent screen
 * GET ?code=<code>&state=<sig> → exchanges code for tokens, stores in Firebase
 *
 * Reuses the same GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET as google-cal-auth.
 * Authorized redirect URI to register in Google Cloud Console:
 *   https://[your-site].netlify.app/.netlify/functions/gdrive-auth
 */

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

function getRedirectUri(event) {
  const host = event.headers?.host || event.headers?.['x-forwarded-host'] || '';
  return `https://${host}/.netlify/functions/gdrive-auth`;
}

function getSiteUrl(event) {
  return process.env.URL || `https://${event.headers?.host || ''}`;
}

function makeState() {
  const payload = JSON.stringify({ ts: Date.now(), n: crypto.randomBytes(4).toString('hex') });
  const data = Buffer.from(payload).toString('base64url');
  const sig = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'fallback')
    .update(data)
    .digest('hex')
    .slice(0, 16);
  return `${data}.${sig}`;
}

function verifyState(state) {
  const dot = state.lastIndexOf('.');
  if (dot < 0) return null;
  const data = state.slice(0, dot);
  const sig  = state.slice(dot + 1);
  const expected = crypto
    .createHmac('sha256', process.env.JWT_SECRET || 'fallback')
    .update(data)
    .digest('hex')
    .slice(0, 16);
  if (sig !== expected) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const orgId = process.env.ORG_ID || 'dronehub_main';

  // Step 1: Initiate OAuth
  if (p.step === 'init') {
    if (!process.env.GOOGLE_CLIENT_ID) {
      return { statusCode: 500, body: 'GOOGLE_CLIENT_ID not configured' };
    }
    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id', process.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri', getRedirectUri(event));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/drive openid email');
    authUrl.searchParams.set('access_type', 'offline');
    authUrl.searchParams.set('prompt', 'consent');
    authUrl.searchParams.set('state', makeState());
    return { statusCode: 302, headers: { Location: authUrl.toString() }, body: '' };
  }

  if (p.error) {
    return { statusCode: 302, headers: { Location: `${getSiteUrl(event)}/#gdrive-denied` }, body: '' };
  }

  // Step 2: OAuth callback
  if (p.code && p.state) {
    const siteUrl = getSiteUrl(event);
    if (!verifyState(p.state)) {
      return { statusCode: 302, headers: { Location: `${siteUrl}/#gdrive-error=invalid_state` }, body: '' };
    }

    try {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: p.code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: getRedirectUri(event),
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error_description || tokenData.error);
      if (!tokenData.refresh_token) throw new Error('No refresh token returned. Revoke DroneHub access at myaccount.google.com and try again.');

      let email = '';
      try {
        const r = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (r.ok) { const u = await r.json(); email = u.email || ''; }
      } catch {}

      const db = getDb();
      await db.doc(`dh_secure/${orgId}_gdrive`).set({
        gdriveRefreshToken: tokenData.refresh_token,
        gdriveAccessToken: tokenData.access_token,
        gdriveTokenExpiresAt: Date.now() + (tokenData.expires_in || 3600) * 1000,
        gdriveEmail: email,
        updatedAt: Date.now(),
      }, { merge: true });

      return {
        statusCode: 302,
        headers: { Location: `${siteUrl}/#gdrive-connected=${encodeURIComponent(email)}` },
        body: '',
      };
    } catch (err) {
      console.error('[gdrive-auth] callback error:', err.message);
      return {
        statusCode: 302,
        headers: { Location: `${siteUrl}/#gdrive-error=${encodeURIComponent(err.message)}` },
        body: '',
      };
    }
  }

  return { statusCode: 400, body: 'Bad request. Use ?step=init to start OAuth.' };
};
