/**
 * Social media metrics proxy
 *
 * POST body: { platform, handle, action?, acctId? }
 *
 * Platforms:
 *   youtube   — public channel stats via YouTube Data API v3 (needs YOUTUBE_API_KEY)
 *               action 'videos'   → recent uploads with per-video stats (public)
 *               action 'insights' → private channel analytics (watch time, daily
 *               views, sub changes, traffic sources) — requires the channel owner
 *               to have connected via youtube-auth (token in dh_secure)
 *   instagram — requires Meta Graph API app — not yet configured
 *   facebook  — same Meta app
 *   tiktok    — requires TikTok developer app — not yet configured
 *
 * Required Netlify env vars:
 *   YOUTUBE_API_KEY — Google Cloud Console → enable "YouTube Data API v3" → create API key
 *   GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / FIREBASE_SERVICE_ACCOUNT — for insights
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

async function ytAccessToken(acctId) {
  const orgId = process.env.ORG_ID || 'dronehub_main';
  const doc = await getDb().doc(`dh_secure/${orgId}_yt_${acctId}`).get();
  const refreshToken = doc.exists ? doc.data()?.ytRefreshToken : null;
  if (!refreshToken) return null;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'YouTube token refresh failed');
  return data.access_token;
}

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Content-Type': 'application/json',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch { return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) }; }

  const { platform, handle, action } = body;
  if (!platform || !handle) return { statusCode: 400, headers, body: JSON.stringify({ error: 'platform and handle required' }) };

  try {
    if (platform === 'youtube') {
      const key = process.env.YOUTUBE_API_KEY;
      if (!key) return { statusCode: 200, headers, body: JSON.stringify({ notConfigured: true, message: 'YOUTUBE_API_KEY not set in Netlify environment variables' }) };

      // Accept @handle, channel ID (UC…), full URL, or plain name
      let raw = handle.trim();
      const urlMatch = raw.match(/youtube\.com\/(?:@([\w.-]+)|channel\/(UC[\w-]+)|c\/([\w.-]+)|user\/([\w.-]+))/i);
      if (urlMatch) raw = urlMatch[1] ? '@' + urlMatch[1] : (urlMatch[2] || urlMatch[3] || urlMatch[4]);

      const params = new URLSearchParams({ part: 'snippet,statistics,contentDetails', key });
      if (/^UC[\w-]{20,}$/.test(raw)) params.set('id', raw);
      else params.set('forHandle', raw.startsWith('@') ? raw : '@' + raw);

      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `YouTube API ${res.status}`);
      const ch = (data.items || [])[0];
      if (!ch) return { statusCode: 200, headers, body: JSON.stringify({ error: 'Channel not found — check the handle or URL' }) };

      const st = ch.statistics || {};

      // Private channel / video analytics — needs owner OAuth via youtube-auth
      if (action === 'insights' || action === 'videoInsights') {
        const acctId = body.acctId;
        if (!acctId) return { statusCode: 400, headers, body: JSON.stringify({ error: 'acctId required' }) };
        let token;
        try { token = await ytAccessToken(acctId); }
        catch (e) { return { statusCode: 200, headers, body: JSON.stringify({ error: 'Channel connection expired — reconnect with Google. (' + e.message + ')' }) }; }
        if (!token) return { statusCode: 200, headers, body: JSON.stringify({ notConnected: true }) };

        // Range: number of days, or 'all' for lifetime
        const range = body.range || '28';
        const end = new Date().toISOString().slice(0, 10);
        const start = range === 'all'
          ? '2005-04-23' // YouTube launch — Analytics clamps to channel creation
          : new Date(Date.now() - parseInt(range, 10) * 86400000).toISOString().slice(0, 10);
        // Month buckets for long ranges keep charts readable and payloads small
        const granularity = (range === 'all' || parseInt(range, 10) > 120) ? 'month' : 'day';
        const base = 'https://youtubeanalytics.googleapis.com/v2/reports';
        const authHdr = { Authorization: `Bearer ${token}` };
        const videoFilter = action === 'videoInsights' && body.videoId ? { filters: `video==${body.videoId}` } : {};

        const seriesRes = await fetch(`${base}?${new URLSearchParams({
          ids: 'channel==MINE', startDate: start, endDate: end,
          metrics: 'views,estimatedMinutesWatched,subscribersGained,subscribersLost',
          dimensions: granularity, sort: granularity,
          ...videoFilter,
        })}`, { headers: authHdr });
        const series = await seriesRes.json();
        if (!seriesRes.ok) throw new Error(series.error?.message || `Analytics API ${seriesRes.status}`);

        const trafficRes = await fetch(`${base}?${new URLSearchParams({
          ids: 'channel==MINE', startDate: start, endDate: end,
          metrics: 'views', dimensions: 'insightTrafficSourceType', sort: '-views',
          ...videoFilter,
        })}`, { headers: authHdr });
        const traffic = await trafficRes.json();

        const days = (series.rows || []).map(r => ({ date: r[0], views: r[1], watchMin: r[2], subsGained: r[3], subsLost: r[4] }));
        const sources = trafficRes.ok ? (traffic.rows || []).map(r => ({ type: r[0], views: r[1] })) : [];

        // Per-video extra: totals row with average view duration
        let totals = null;
        if (action === 'videoInsights' && body.videoId) {
          const totRes = await fetch(`${base}?${new URLSearchParams({
            ids: 'channel==MINE', startDate: start, endDate: end,
            metrics: 'views,estimatedMinutesWatched,averageViewDuration,subscribersGained',
            filters: `video==${body.videoId}`,
          })}`, { headers: authHdr });
          const tot = await totRes.json();
          if (totRes.ok && tot.rows && tot.rows[0]) {
            totals = { views: tot.rows[0][0], watchMin: tot.rows[0][1], avgViewSec: tot.rows[0][2], subsGained: tot.rows[0][3] };
          }
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, days, sources, totals, granularity }) };
      }

      // Detail mode: recent uploads with per-video stats
      if (action === 'videos') {
        const uploadsId = ch.contentDetails?.relatedPlaylists?.uploads;
        let videos = [];
        if (uploadsId) {
          const plRes = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${new URLSearchParams({ part: 'contentDetails', playlistId: uploadsId, maxResults: '12', key })}`);
          const pl = await plRes.json();
          const ids = (pl.items || []).map(i => i.contentDetails?.videoId).filter(Boolean);
          if (ids.length) {
            const vRes = await fetch(`https://www.googleapis.com/youtube/v3/videos?${new URLSearchParams({ part: 'snippet,statistics', id: ids.join(','), key })}`);
            const vData = await vRes.json();
            videos = (vData.items || []).map(v => ({
              id: v.id,
              title: v.snippet?.title || '',
              publishedAt: (v.snippet?.publishedAt || '').slice(0, 10),
              thumb: v.snippet?.thumbnails?.medium?.url || v.snippet?.thumbnails?.default?.url || '',
              views: parseInt(v.statistics?.viewCount || '0', 10),
              likes: parseInt(v.statistics?.likeCount || '0', 10),
              comments: parseInt(v.statistics?.commentCount || '0', 10),
            }));
          }
        }
        return { statusCode: 200, headers, body: JSON.stringify({ ok: true, videos }) };
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ok: true,
          platform: 'youtube',
          name: ch.snippet?.title || raw,
          avatar: ch.snippet?.thumbnails?.default?.url || '',
          followers: parseInt(st.subscriberCount || '0', 10),
          views: parseInt(st.viewCount || '0', 10),
          posts: parseInt(st.videoCount || '0', 10),
          url: 'https://www.youtube.com/' + (ch.snippet?.customUrl || ('channel/' + ch.id)),
        }),
      };
    }

    if (platform === 'instagram' || platform === 'facebook') {
      return { statusCode: 200, headers, body: JSON.stringify({ notConfigured: true, message: 'Instagram/Facebook need a Meta Developer app connection — coming soon' }) };
    }

    if (platform === 'tiktok') {
      return { statusCode: 200, headers, body: JSON.stringify({ notConfigured: true, message: 'TikTok needs a TikTok Developer app connection — coming soon' }) };
    }

    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Unknown platform: ' + platform }) };
  } catch (err) {
    console.error('[social-metrics]', err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: err.message }) };
  }
};
