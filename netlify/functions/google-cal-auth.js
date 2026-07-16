/**
 * DroneHub Google Calendar OAuth handler
 *
 * GET ?step=init&memberId=<id>  → redirects to Google OAuth consent screen
 * GET ?code=<code>&state=<sig>  → exchanges code for tokens, stores them, redirects back to app
 *
 * Required Netlify env vars:
 *   GOOGLE_CLIENT_ID       — from Google Cloud Console OAuth 2.0 client
 *   GOOGLE_CLIENT_SECRET   — from Google Cloud Console OAuth 2.0 client
 *   FIREBASE_SERVICE_ACCOUNT — Firebase admin service account JSON
 *   JWT_SECRET             — same secret used by auth.js (for CSRF state signing)
 *   ORG_ID                 — (optional) defaults to 'dronehub_main'
 *
 * Authorized redirect URI to register in Google Cloud Console:
 *   https://[your-site].netlify.app/.netlify/functions/google-cal-auth
 */

const crypto = require('crypto');

// ── Firebase Admin (lazy singleton) ─────────────────────────────────────────
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function getRedirectUri(event) {
  const host = event.headers?.host || event.headers?.['x-forwarded-host'] || '';
  return `https://${host}/.netlify/functions/google-cal-auth`;
}

function getSiteUrl(event) {
  return process.env.URL || `https://${event.headers?.host || ''}`;
}

function makeState(memberId) {
  const payload = JSON.stringify({ memberId, ts: Date.now(), n: crypto.randomBytes(4).toString('hex') });
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

// ── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const p = event.queryStringParameters || {};

  // ── Step 1: Initiate OAuth ─────────────────────────────────────────────────
  if (p.step === 'init') {
    const { memberId } = p;
    if (!memberId) return { statusCode: 400, body: 'memberId required' };
    if (!process.env.GOOGLE_CLIENT_ID) {
      return { statusCode: 500, body: 'GOOGLE_CLIENT_ID not configured — add it in Netlify environment variables' };
    }

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.set('client_id',     process.env.GOOGLE_CLIENT_ID);
    authUrl.searchParams.set('redirect_uri',  getRedirectUri(event));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope',         'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar.readonly openid email');
    authUrl.searchParams.set('access_type',   'offline');
    authUrl.searchParams.set('prompt',        'consent'); // always get refresh_token
    authUrl.searchParams.set('state',         makeState(memberId));

    return { statusCode: 302, headers: { Location: authUrl.toString() }, body: '' };
  }

  // ── User denied / error ────────────────────────────────────────────────────
  if (p.error) {
    return {
      statusCode: 302,
      headers: { Location: `${getSiteUrl(event)}/#gcal-denied` },
      body: '',
    };
  }

  // ── Step 2: OAuth callback ─────────────────────────────────────────────────
  if (p.code && p.state) {
    const siteUrl   = getSiteUrl(event);
    const stateData = verifyState(p.state);

    if (!stateData) {
      return { statusCode: 302, headers: { Location: `${siteUrl}/#gcal-error=invalid_state` }, body: '' };
    }

    const { memberId } = stateData;

    try {
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method:  'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body:    new URLSearchParams({
          code:          p.code,
          client_id:     process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri:  getRedirectUri(event),
          grant_type:    'authorization_code',
        }),
      });
      const tokenData = await tokenRes.json();

      if (!tokenRes.ok) {
        throw new Error(tokenData.error_description || tokenData.error || `HTTP ${tokenRes.status}`);
      }
      if (!tokenData.refresh_token) {
        throw new Error('Google did not return a refresh token. Revoke DroneHub access at myaccount.google.com → Security → Third-party apps, then try again.');
      }

      // Fetch the Google account email
      let googleEmail = '';
      try {
        const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
        if (userRes.ok) { const u = await userRes.json(); googleEmail = u.email || ''; }
      } catch {}

      const db    = getDb();
      const orgId = process.env.ORG_ID || 'dronehub_main';

      // Store the refresh token in a SECURE collection — never exposed via firebase-proxy
      await db.doc(`dh_secure/${memberId}`).set({
        googleCalRefreshToken: tokenData.refresh_token,
        googleCalUpdatedAt:    Date.now(),
      }, { merge: true });

      // Store non-sensitive OAuth metadata in the regular profile doc (readable by client)
      await db.doc(`orgs/${orgId}:profile_${memberId}`).set({
        googleCalConnected:   true,
        googleCalEmail:       googleEmail,
        googleCalConnectedAt: Date.now(),
        googleCalSelectedIds: ['primary'], // default: primary calendar
      }, { merge: true });

      return {
        statusCode: 302,
        headers: { Location: `${siteUrl}/#gcal-connected=${encodeURIComponent(memberId)}` },
        body: '',
      };

    } catch (err) {
      console.error('[google-cal-auth] callback error:', err.message);
      return {
        statusCode: 302,
        headers: { Location: `${siteUrl}/#gcal-error=${encodeURIComponent(err.message)}` },
        body: '',
      };
    }
  }

  return {
    statusCode: 400,
    body: 'Bad request. Use ?step=init&memberId=<id> to start the OAuth flow.',
  };
};
