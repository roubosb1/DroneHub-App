/**
 * DroneHub OG Image Proxy
 * GET /.netlify/functions/get-og-image?url=<encoded-url>
 *
 * Fetches the og:image meta tag from any public URL server-side.
 * This bypasses CORS restrictions that prevent the browser from reading
 * Instagram, Vimeo, and other social pages directly.
 *
 * No auth required — only returns a single image URL string, no sensitive data.
 * Rate-limited naturally by Netlify function invocations.
 */

const https = require('https');
const http  = require('http');
const { URL } = require('url');

const TIMEOUT_MS = 6000;
const MAX_BYTES  = 150_000; // read only first ~150 KB (og:image is near the top)

function fetchHtml(rawUrl) {
  return new Promise((resolve, reject) => {
    let parsed;
    try { parsed = new URL(rawUrl); } catch (e) { return reject(new Error('Invalid URL')); }

    const lib = parsed.protocol === 'https:' ? https : http;

    const req = lib.get(
      rawUrl,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; DroneHubBot/1.0)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: TIMEOUT_MS,
      },
      (res) => {
        // Follow one redirect
        if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
          return fetchHtml(res.headers.location).then(resolve).catch(reject);
        }
        if (res.statusCode !== 200) {
          res.destroy();
          return reject(new Error(`HTTP ${res.statusCode}`));
        }

        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          buf += chunk;
          if (buf.length >= MAX_BYTES) { res.destroy(); resolve(buf); }
        });
        res.on('end', () => resolve(buf));
        res.on('error', reject);
      }
    );

    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.on('error', reject);
  });
}

function extractOgImage(html) {
  // Match both attribute orderings: property then content, or content then property
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']og:image["']/i,
    // Twitter fallback
    /<meta[^>]+property=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']twitter:image["']/i,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return m[1].replace(/&amp;/g, '&');
  }
  return null;
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: { ...cors, 'Access-Control-Allow-Headers': 'Content-Type' } };
  }

  const rawUrl = event.queryStringParameters?.url;
  if (!rawUrl) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'url param required' }) };
  }

  // Sanity check — only allow http/https
  let parsed;
  try {
    parsed = new URL(rawUrl);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
  } catch {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid URL' }) };
  }

  try {
    const html = await fetchHtml(rawUrl);
    const imageUrl = extractOgImage(html);
    return {
      statusCode: 200,
      headers: { ...cors, 'Cache-Control': 'public, max-age=3600' },
      body: JSON.stringify({ imageUrl }),
    };
  } catch (err) {
    // Non-fatal — just return null so the caller falls back to placeholder
    return {
      statusCode: 200,
      headers: cors,
      body: JSON.stringify({ imageUrl: null, _err: err.message }),
    };
  }
};
