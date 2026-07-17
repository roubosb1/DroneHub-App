/**
 * DroneHub AI Quote Parser
 * POST /.netlify/functions/ai-quote-parse
 * Header: Authorization: Bearer <session token, same one firebase-proxy uses>
 * Body: { description, contractors: [{name, role}], clients: [{name, email}] }
 *
 * Takes a free-text job description ("1500 Main St Toronto, 2500 sqft,
 * need drone video + twilight photos, John filming, Sarah editing, client
 * is Jane Doe jane@x.com, shoot next Tuesday") and asks Claude to extract
 * structured fields matching the Quote Builder's form. Returns JSON only —
 * never auto-saves anything. The browser is responsible for filling the
 * form and letting the user review before clicking Save.
 *
 * Required Netlify environment variable:
 *   ANTHROPIC_API_KEY — from console.anthropic.com (server-side only,
 *   never sent to or readable by the browser)
 *   JWT_SECRET — same secret auth.js/firebase-proxy.js use to sign tokens
 */

const crypto = require('crypto');

// Inlined (not required from auth.js) to avoid cross-function bundler issues,
// same approach firebase-proxy.js uses.
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

// ── Simple in-memory rate limiter (per IP, resets on cold start) ─────────────
const _rateCounts = {};
const RATE_LIMIT = 20; // AI calls are expensive — much tighter than firebase-proxy's 600/min
const RATE_WINDOW = 60 * 1000;
function isRateLimited(ip) {
  const now = Date.now();
  if (!_rateCounts[ip] || now - _rateCounts[ip].start > RATE_WINDOW) {
    _rateCounts[ip] = { count: 1, start: now };
    return false;
  }
  _rateCounts[ip].count++;
  return _rateCounts[ip].count > RATE_LIMIT;
}

const MARKETS = ['canada', 'new_york', 'texas', 'arizona', 'colorado', 'other_us'];
const SERVICE_KEYS = ['video', 'photo', 'tvideo', 'tphoto', 'reel', 'extphoto', 'extvideo', 'floorplan', 'randomvideo', 'randomphoto', 'rush'];

function buildSystemPrompt(today, contractors, clients) {
  return `You extract structured job-quote data from a real-estate drone media company's freeform job description text. Today's date is ${today} (YYYY-MM-DD) — resolve relative dates ("next Tuesday", "tomorrow") against this.

Known contractors (match the description's filmer/editor/floor-plan names against these EXACT names if there's a clear match; otherwise use null — do not invent a name that isn't in this list):
${JSON.stringify(contractors)}

Known existing clients (match against these EXACT names/emails if there's a clear match; otherwise use null):
${JSON.stringify(clients)}

Valid "market" values: ${JSON.stringify(MARKETS)}. Infer from the address/city if not explicit (Canadian address -> "canada", else best US region match, default "other_us" if unclear).

Valid service keys (booleans) — CANADA MARKET ONLY: ${JSON.stringify(SERVICE_KEYS)}.
- video = drone video, photo = drone photos, tvideo = twilight video, tphoto = twilight photos,
  reel = additional social media reel, extphoto = exterior-only photo shoot, extvideo = exterior-only video shoot,
  floorplan = floor plan, randomvideo/randomphoto = miscellaneous video/photo shoot hours, rush = rush order requested.
Only set a service true if the text actually implies it. Don't assume video+photo by default — only mark what's mentioned.

US MARKET jobs use PACKAGES instead of the service booleans (leave all "services" false for US jobs):
- usPkgType — exactly one of "listing", "social", "agent", "day", "exterior", or null:
  · "listing" = a property listing / house tour shoot (video and photos of a home for sale). This is the default for property media requests.
  · "social" = a standalone reel package where social reels are the main deliverable (no full listing video).
  · "agent" = agent personal-brand promo shoot. · "day" = half/full social day rate. · "exterior" = exterior-only shoot.
- usListingTier (only when usPkgType is "listing") — by property size: under 4,000 sqft -> "under4k"; 4,000–8,000 -> "over4k"; over 8,000 -> "over8k". Derive from sqft when given.
- usSocialTier (only when usPkgType is "social") — number of reels: "r1".."r5", or "fullDay" for unlimited.
- usDayType (only when usPkgType is "day") — "half" or "full".
- usAddons — sunrise (sunrise/sunset/twilight lighting), photoHDR (HDR photos), photoFlash (flash photography). Set true only when clearly requested.
- usListingReels (only when usPkgType is "listing") — TOTAL number of social reels wanted with the listing shoot. Every listing includes 1 reel in its price, so default to 1 when reels aren't mentioned; "house tour plus 3 reels" -> usPkgType "listing", usListingReels 3 (1 included + 2 charged). When reels are the ONLY deliverable use usPkgType "social" with usSocialTier instead.
- For Canada jobs set usPkgType/usListingTier/usSocialTier/usDayType to null, usListingReels 0, and all usAddons false.

Respond with ONLY a single JSON object, no markdown fences, no commentary, matching exactly this shape:
{
  "address": string|null,
  "sqft": number|null,
  "market": one of the valid market values, or null,
  "videographerName": string|null,
  "photographerName": string|null,
  "floorplanName": string|null,
  "services": { "video": bool, "photo": bool, "tvideo": bool, "tphoto": bool, "reel": bool, "extphoto": bool, "extvideo": bool, "floorplan": bool, "randomvideo": bool, "randomphoto": bool, "rush": bool },
  "usPkgType": "listing"|"social"|"agent"|"day"|"exterior"|null,
  "usListingTier": "under4k"|"over4k"|"over8k"|null,
  "usListingReels": number (total reels on a listing; 1 is included in the package price — default 1),
  "usSocialTier": "r1"|"r2"|"r3"|"r4"|"r5"|"fullDay"|null,
  "usDayType": "half"|"full"|null,
  "usAddons": { "sunrise": bool, "photoHDR": bool, "photoFlash": bool },
  "clientName": string|null,
  "clientEmail": string|null,
  "clientPhone": string|null,
  "jobDate": string|null (YYYY-MM-DD),
  "jobTime": string|null (HH:MM, 24h),
  "duration": number|null (hours),
  "notes": string|null (anything not captured above — gate codes, special instructions, extra reels on a listing, etc.)
}`;
}

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

  const clientIp = event.headers['x-forwarded-for']?.split(',')[0]?.trim() || 'unknown';
  if (isRateLimited(clientIp)) {
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many AI requests — please wait a moment' }) };
  }

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !verifyToken(token)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };
  }

  let description, contractors, clients;
  try {
    ({ description, contractors, clients } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'description is required' }) };
  }
  if (description.length > 4000) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'description is too long' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  const today = new Date().toISOString().slice(0, 10);
  const system = buildSystemPrompt(today, contractors || [], clients || []);

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: description.trim() }],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      console.error('[ai-quote-parse] Anthropic API error:', r.status, errBody);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service error (HTTP ' + r.status + ')' }) };
    }

    const result = await r.json();
    const text = (result.content || []).map(b => b.text || '').join('').trim();

    // Strip markdown code fences if the model added them despite instructions
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[ai-quote-parse] Failed to parse AI response as JSON:', text);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI returned an unparseable response' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ data: parsed }) };
  } catch (e) {
    console.error('[ai-quote-parse] error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'AI parse failed' }) };
  }
};
