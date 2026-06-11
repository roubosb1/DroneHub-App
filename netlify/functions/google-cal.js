/**
 * DroneHub Google Calendar API proxy
 *
 * POST body: { action, memberId, calendarIds? }
 * Header:    Authorization: Bearer <dhToken>
 *
 * Actions:
 *   list       → lists the user's Google Calendars with current selection state
 *   sync       → fetches events from selected calendars (saves selection if provided)
 *   disconnect → revokes stored tokens and clears Google Calendar connection
 *
 * Required Netlify env vars:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
 *   FIREBASE_SERVICE_ACCOUNT, JWT_SECRET
 *   ORG_ID (optional, defaults to 'dronehub_main')
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

// ── Token helpers ────────────────────────────────────────────────────────────
async function getAccessToken(refreshToken) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    new URLSearchParams({
      refresh_token: refreshToken,
      client_id:     process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type:    'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Google token refresh failed');
  return data.access_token;
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

  // Require valid DroneHub session token
  const authHeader = event.headers?.authorization || '';
  const tok        = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const session    = tok ? verifyToken(tok) : null;
  if (!session) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Authentication required' }) };
  }

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const { action, memberId, calendarIds } = body;
  if (!memberId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'memberId required' }) };

  const db    = getDb();
  const orgId = process.env.ORG_ID || 'dronehub_main';

  try {

    // ── Disconnect ────────────────────────────────────────────────────────────
    if (action === 'disconnect') {
      await Promise.all([
        db.doc(`dh_secure/${memberId}`).set(
          { googleCalRefreshToken: null, googleCalUpdatedAt: Date.now() },
          { merge: true }
        ),
        db.doc(`orgs/${orgId}:profile_${memberId}`).set({
          googleCalConnected:   false,
          googleCalEmail:       null,
          googleCalConnectedAt: null,
          googleCalSelectedIds: null,
        }, { merge: true }),
      ]);
      return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
    }

    // ── Get stored refresh token ──────────────────────────────────────────────
    const secureDoc    = await db.doc(`dh_secure/${memberId}`).get();
    const refreshToken = secureDoc.exists ? secureDoc.data()?.googleCalRefreshToken : null;

    if (!refreshToken) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Google Calendar not connected', notConnected: true }),
      };
    }

    const accessToken = await getAccessToken(refreshToken);

    // ── List calendars ────────────────────────────────────────────────────────
    if (action === 'list') {
      const profileDoc = await db.doc(`orgs/${orgId}:profile_${memberId}`).get();
      const profile    = profileDoc.exists ? profileDoc.data() : {};
      const selectedIds = profile.googleCalSelectedIds || ['primary'];

      const res  = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=50', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `Calendar list failed (${res.status})`);

      const calendars = (data.items || []).map(cal => ({
        id:       cal.id,
        name:     cal.summary || cal.id,
        primary:  !!cal.primary,
        selected: selectedIds.includes(cal.id) || (!!cal.primary && selectedIds.includes('primary')),
        colorHex: cal.backgroundColor || '#4285f4',
      }));

      return { statusCode: 200, headers, body: JSON.stringify({
        calendars,
        email:       profile.googleCalEmail  || '',
        connectedAt: profile.googleCalConnectedAt || 0,
      })};
    }

    // ── Sync events ───────────────────────────────────────────────────────────
    if (action === 'sync') {
      const profileDoc  = await db.doc(`orgs/${orgId}:profile_${memberId}`).get();
      const profile     = profileDoc.exists ? profileDoc.data() : {};
      const idsToSync   = calendarIds || profile.googleCalSelectedIds || ['primary'];

      // Persist new selection when caller specifies calendarIds
      if (calendarIds) {
        await db.doc(`orgs/${orgId}:profile_${memberId}`).set(
          { googleCalSelectedIds: calendarIds },
          { merge: true }
        );
      }

      const now     = new Date();
      const timeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
      const timeMax = new Date(now.getFullYear(), now.getMonth() + 4, 0).toISOString();

      const allEvents = [];
      await Promise.allSettled(idsToSync.map(async calId => {
        const params = new URLSearchParams({
          timeMin, timeMax,
          singleEvents: 'true',
          orderBy:      'startTime',
          maxResults:   '500',
        });
        const res  = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calId)}/events?${params}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        const data = await res.json();
        if (!res.ok) return; // skip failing calendars silently
        (data.items || []).forEach(ev => {
          const start = ev.start?.dateTime || ev.start?.date || '';
          const end   = ev.end?.dateTime   || ev.end?.date   || '';
          allEvents.push({
            title:       ev.summary    || '(No title)',
            date:        start.slice(0, 10),
            endDate:     end.slice(0, 10),
            time:        start.length > 10 ? start.slice(11, 16) : '',
            endTime:     end.length   > 10 ? end.slice(11, 16)   : '',
            location:    ev.location    || '',
            description: ev.description || '',
            uid:         ev.id,
            calendarId:  calId,
          });
        });
      }));

      return { statusCode: 200, headers, body: JSON.stringify({ events: allEvents, count: allEvents.length }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown action. Use: list | sync | disconnect' }) };

  } catch (err) {
    console.error('[google-cal] error:', err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
