/**
 * Google Drive API proxy
 *
 * POST with JSON body: { action, folderId, query, fileId }
 *
 * Actions:
 *   status    — check if connected + return email
 *   list      — list files in a folder (default: root)
 *   search    — search files by name
 *   link      — get webViewLink for a file
 *   share     — create a shareable link for a file
 *
 * Tokens stored in Firebase dh_secure collection by gdrive-auth.
 */

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

async function getAccessToken() {
  const orgId = process.env.ORG_ID || 'dronehub_main';
  const db = getDb();
  const doc = await db.doc(`dh_secure/${orgId}_gdrive`).get();
  if (!doc.exists) return null;
  const data = doc.data();
  if (!data.gdriveRefreshToken) return null;

  // If token is still valid (with 60s buffer), return it
  if (data.gdriveAccessToken && data.gdriveTokenExpiresAt && Date.now() < data.gdriveTokenExpiresAt - 60000) {
    return { token: data.gdriveAccessToken, email: data.gdriveEmail || '' };
  }

  // Refresh the token
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      refresh_token: data.gdriveRefreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const tok = await res.json();
  if (!res.ok) throw new Error(tok.error_description || tok.error || 'Token refresh failed');

  await db.doc(`dh_secure/${orgId}_gdrive`).set({
    gdriveAccessToken: tok.access_token,
    gdriveTokenExpiresAt: Date.now() + (tok.expires_in || 3600) * 1000,
  }, { merge: true });

  return { token: tok.access_token, email: data.gdriveEmail || '' };
}

async function driveApi(token, path, params = {}) {
  const url = new URL(`https://www.googleapis.com/drive/v3/${path}`);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Drive API ${res.status}`);
  }
  return res.json();
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'POST only' };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers: cors, body: 'Invalid JSON' }; }

  const { action } = body;

  try {
    // Status check — doesn't need a valid token
    if (action === 'status') {
      try {
        const auth = await getAccessToken();
        if (!auth) return { statusCode: 200, headers: cors, body: JSON.stringify({ connected: false }) };
        return { statusCode: 200, headers: cors, body: JSON.stringify({ connected: true, email: auth.email }) };
      } catch {
        return { statusCode: 200, headers: cors, body: JSON.stringify({ connected: false }) };
      }
    }

    const auth = await getAccessToken();
    if (!auth) return { statusCode: 401, headers: cors, body: JSON.stringify({ error: 'Google Drive not connected' }) };

    if (action === 'list') {
      const folderId = body.folderId || 'root';
      const pageToken = body.pageToken || '';
      const q = `'${folderId}' in parents and trashed = false`;
      const params = {
        q,
        fields: 'nextPageToken,files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size,thumbnailLink)',
        orderBy: 'folder,name',
        pageSize: '50',
      };
      if (pageToken) params.pageToken = pageToken;
      const data = await driveApi(auth.token, 'files', params);
      return { statusCode: 200, headers: cors, body: JSON.stringify(data) };
    }

    if (action === 'search') {
      const q = body.query || '';
      if (!q) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'query required' }) };
      const params = {
        q: `name contains '${q.replace(/'/g, "\\'")}' and trashed = false`,
        fields: 'nextPageToken,files(id,name,mimeType,webViewLink,iconLink,modifiedTime,size,thumbnailLink,parents)',
        orderBy: 'modifiedTime desc',
        pageSize: '100',
      };
      if (body.pageToken) params.pageToken = body.pageToken;
      const data = await driveApi(auth.token, 'files', params);
      return { statusCode: 200, headers: cors, body: JSON.stringify(data) };
    }

    if (action === 'link') {
      const fileId = body.fileId;
      if (!fileId) return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'fileId required' }) };
      const data = await driveApi(auth.token, `files/${fileId}`, {
        fields: 'id,name,webViewLink,webContentLink',
      });
      return { statusCode: 200, headers: cors, body: JSON.stringify(data) };
    }

    if (action === 'breadcrumb') {
      const fileId = body.fileId;
      if (!fileId || fileId === 'root') return { statusCode: 200, headers: cors, body: JSON.stringify({ path: [{ id: 'root', name: 'My Drive' }] }) };
      const path = [];
      let currentId = fileId;
      for (let i = 0; i < 10; i++) {
        const data = await driveApi(auth.token, `files/${currentId}`, { fields: 'id,name,parents' });
        path.unshift({ id: data.id, name: data.name });
        if (!data.parents || !data.parents.length) break;
        currentId = data.parents[0];
      }
      path.unshift({ id: 'root', name: 'My Drive' });
      return { statusCode: 200, headers: cors, body: JSON.stringify({ path }) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Unknown action: ' + action }) };

  } catch (err) {
    console.error('[gdrive-proxy]', err.message);
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: err.message }) };
  }
};
