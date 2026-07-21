/**
 * Meta (Instagram/Facebook) OAuth handler — connects a Facebook account so
 * DroneHub can read Page + Instagram Business account stats and insights.
 *
 * GET ?step=init&acctId=<social account id> → Facebook consent screen
 * GET ?code=<code>&state=<sig>              → stores long-lived user token
 *
 * Required Netlify env vars: META_APP_ID, META_APP_SECRET
 * In the Meta app dashboard (Facebook Login for Business → Settings), add
 * this to Valid OAuth Redirect URIs:
 *   https://[your-site].netlify.app/.netlify/functions/meta-auth
 *
 * Long-lived user tokens last ~60 days; each successful metrics call that
 * notices <7 days remaining triggers a re-connect prompt in the UI.
 */

const crypto = require('crypto');

const FB_VER = 'v21.0';

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
  return `https://${host}/.netlify/functions/meta-auth`;
}
function getSiteUrl(event) {
  return process.env.URL || `https://${event.headers?.host || ''}`;
}
function makeState(acctId) {
  const payload = JSON.stringify({ acctId, ts: Date.now(), n: crypto.randomBytes(4).toString('hex') });
  const data = Buffer.from(payload).toString('base64url');
  const sig = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback').update(data).digest('hex').slice(0, 16);
  return `${data}.${sig}`;
}
function verifyState(state) {
  const dot = state.lastIndexOf('.');
  if (dot < 0) return null;
  const data = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const expected = crypto.createHmac('sha256', process.env.JWT_SECRET || 'fallback').update(data).digest('hex').slice(0, 16);
  if (sig !== expected) return null;
  try { return JSON.parse(Buffer.from(data, 'base64url').toString()); } catch { return null; }
}

exports.handler = async (event) => {
  const p = event.queryStringParameters || {};
  const orgId = process.env.ORG_ID || 'dronehub_main';

  if (p.step === 'init') {
    if (!p.acctId) return { statusCode: 400, body: 'acctId required' };
    if (!process.env.META_APP_ID) return { statusCode: 500, body: 'META_APP_ID not configured in Netlify environment variables' };
    const authUrl = new URL(`https://www.facebook.com/${FB_VER}/dialog/oauth`);
    authUrl.searchParams.set('client_id', process.env.META_APP_ID);
    authUrl.searchParams.set('redirect_uri', getRedirectUri(event));
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('scope', 'pages_show_list,pages_read_engagement,read_insights,instagram_basic,instagram_manage_insights,business_management');
    authUrl.searchParams.set('state', makeState(p.acctId));
    return { statusCode: 302, headers: { Location: authUrl.toString() }, body: '' };
  }

  if (p.error) {
    return { statusCode: 302, headers: { Location: `${getSiteUrl(event)}/#meta-denied` }, body: '' };
  }

  if (p.code && p.state) {
    const siteUrl = getSiteUrl(event);
    const stateData = verifyState(p.state);
    if (!stateData) return { statusCode: 302, headers: { Location: `${siteUrl}/#meta-error=invalid_state` }, body: '' };
    const { acctId } = stateData;

    try {
      // 1. Exchange code for a short-lived user token
      const tokenRes = await fetch(`https://graph.facebook.com/${FB_VER}/oauth/access_token?` + new URLSearchParams({
        code: p.code,
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri: getRedirectUri(event),
      }));
      const tokenData = await tokenRes.json();
      if (!tokenRes.ok) throw new Error(tokenData.error?.message || 'Token exchange failed');

      // 2. Upgrade to a long-lived user token (~60 days)
      const longRes = await fetch(`https://graph.facebook.com/${FB_VER}/oauth/access_token?` + new URLSearchParams({
        grant_type: 'fb_exchange_token',
        client_id: process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        fb_exchange_token: tokenData.access_token,
      }));
      const longData = await longRes.json();
      if (!longRes.ok) throw new Error(longData.error?.message || 'Long-lived token exchange failed');
      const accessToken = longData.access_token;
      const expiresAt = Date.now() + (longData.expires_in ? longData.expires_in * 1000 : 60 * 86400000);

      // 3. Who connected (for display)
      let name = '';
      try {
        const r = await fetch(`https://graph.facebook.com/${FB_VER}/me?fields=name&access_token=${encodeURIComponent(accessToken)}`);
        if (r.ok) { const u = await r.json(); name = u.name || ''; }
      } catch {}

      await getDb().doc(`dh_secure/${orgId}_meta_${acctId}`).set({
        metaAccessToken: accessToken,
        metaName: name,
        metaExpiresAt: expiresAt,
        updatedAt: Date.now(),
      }, { merge: true });

      // Also keep an org-wide default token (most recent connection) so
      // Business Discovery can pull public stats for accounts nobody has
      // explicitly connected.
      await getDb().doc(`dh_secure/${orgId}_meta_default`).set({
        metaAccessToken: accessToken,
        metaName: name,
        metaExpiresAt: expiresAt,
        updatedAt: Date.now(),
      }, { merge: true });

      return { statusCode: 302, headers: { Location: `${siteUrl}/#meta-connected=${encodeURIComponent(acctId)}` }, body: '' };
    } catch (err) {
      console.error('[meta-auth] callback error:', err.message);
      return { statusCode: 302, headers: { Location: `${siteUrl}/#meta-error=${encodeURIComponent(err.message)}` }, body: '' };
    }
  }

  return { statusCode: 400, body: 'Bad request. Use ?step=init&acctId=<id> to start OAuth.' };
};
