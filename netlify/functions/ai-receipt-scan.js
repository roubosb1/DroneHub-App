/**
 * DroneHub AI Receipt Scanner
 * POST /.netlify/functions/ai-receipt-scan
 * Header: Authorization: Bearer <session token>
 * Body: { image: "<base64 image data>", mimeType: "image/jpeg" }
 *
 * Sends a receipt photo to Claude vision to extract:
 *  - vendor name, date, subtotal, tax, total, currency
 *  - expense category guess
 *  - whether it's Canadian or US (from address, tax labels, currency)
 *
 * Required Netlify env vars: ANTHROPIC_API_KEY, JWT_SECRET
 */

const crypto = require('crypto');

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

const _rateCounts = {};
const RATE_LIMIT = 15;
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

const CATEGORIES = [
  'Equipment', 'Software', 'Fuel', 'Travel', 'Meals',
  'Marketing', 'Insurance', 'Office', 'Subcontractor',
  'Phone', 'Education', 'Other'
];

function buildSystemPrompt() {
  return `You are a receipt data extractor for a drone media company. You will receive a photo of a receipt and must extract structured data from it.

Determine whether this is a Canadian or US receipt by looking at:
- Currency symbols ($ CAD vs $ USD)
- Tax labels: HST, GST, PST = Canadian; Sales Tax, State Tax = US
- Address, province/state, postal code vs zip code
- Store chain branding if recognizable

Valid expense categories: ${JSON.stringify(CATEGORIES)}
Choose the single best matching category. Use "Equipment" for drone/camera gear, "Fuel" for gas stations, "Meals" for restaurants/food, "Office" for office supplies/printing, "Software" for apps/subscriptions, etc.

Respond with ONLY a JSON object, no markdown fences, no commentary:
{
  "vendor": string|null,
  "date": string|null (YYYY-MM-DD format),
  "description": string|null (brief 3-6 word description of what was purchased),
  "category": one of the valid categories,
  "subtotal": number|null,
  "tax": number|null,
  "total": number (the final amount paid — this is required),
  "country": "canada" or "usa",
  "currency": "CAD" or "USD",
  "confidence": "high" or "medium" or "low",
  "notes": string|null (anything notable — e.g. "tip included", "partial payment", etc.)
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
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests — please wait' }) };
  }

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !verifyToken(token)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };
  }

  let image, mimeType;
  try {
    ({ image, mimeType } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  if (!image || typeof image !== 'string') {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'image (base64) is required' }) };
  }
  if (image.length > 10 * 1024 * 1024) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Image too large (max 10MB)' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const mt = validTypes.includes(mimeType) ? mimeType : 'image/jpeg';

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
        system: buildSystemPrompt(),
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mt, data: image } },
            { type: 'text', text: 'Extract the receipt data from this image.' }
          ]
        }],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      console.error('[ai-receipt-scan] Anthropic API error:', r.status, errBody);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service error (HTTP ' + r.status + ')' }) };
    }

    const result = await r.json();
    const text = (result.content || []).map(b => b.text || '').join('').trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[ai-receipt-scan] Failed to parse AI response:', text);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI returned unparseable response' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ data: parsed }) };
  } catch (e) {
    console.error('[ai-receipt-scan] error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Receipt scan failed' }) };
  }
};
