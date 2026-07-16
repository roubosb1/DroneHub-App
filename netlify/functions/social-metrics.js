/**
 * Social media metrics proxy
 *
 * POST body: { platform, handle }
 *
 * Platforms:
 *   youtube   — public channel stats via YouTube Data API v3 (needs YOUTUBE_API_KEY)
 *   instagram — requires Meta Graph API app (META_ACCESS_TOKEN) — not yet configured
 *   facebook  — same Meta app
 *   tiktok    — requires TikTok developer app — not yet configured
 *
 * Required Netlify env vars:
 *   YOUTUBE_API_KEY — Google Cloud Console → enable "YouTube Data API v3" → create API key
 */

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

  const { platform, handle } = body;
  if (!platform || !handle) return { statusCode: 400, headers, body: JSON.stringify({ error: 'platform and handle required' }) };

  try {
    if (platform === 'youtube') {
      const key = process.env.YOUTUBE_API_KEY;
      if (!key) return { statusCode: 200, headers, body: JSON.stringify({ notConfigured: true, message: 'YOUTUBE_API_KEY not set in Netlify environment variables' }) };

      // Accept @handle, channel ID (UC…), full URL, or plain name
      let raw = handle.trim();
      const urlMatch = raw.match(/youtube\.com\/(?:@([\w.-]+)|channel\/(UC[\w-]+)|c\/([\w.-]+)|user\/([\w.-]+))/i);
      if (urlMatch) raw = urlMatch[1] ? '@' + urlMatch[1] : (urlMatch[2] || urlMatch[3] || urlMatch[4]);

      const params = new URLSearchParams({ part: 'snippet,statistics', key });
      if (/^UC[\w-]{20,}$/.test(raw)) params.set('id', raw);
      else params.set('forHandle', raw.startsWith('@') ? raw : '@' + raw);

      const res = await fetch(`https://www.googleapis.com/youtube/v3/channels?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || `YouTube API ${res.status}`);
      const ch = (data.items || [])[0];
      if (!ch) return { statusCode: 200, headers, body: JSON.stringify({ error: 'Channel not found — check the handle or URL' }) };

      const st = ch.statistics || {};
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
