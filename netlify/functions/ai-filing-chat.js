/**
 * DroneHub Payroll Filing Assistant Chat
 * POST /.netlify/functions/ai-filing-chat
 * Accepts a conversation history + context (country, state/province)
 * and returns a streaming-compatible AI response about payroll filing.
 *
 * Required env vars: ANTHROPIC_API_KEY, JWT_SECRET
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
function isRateLimited(ip) {
  const now = Date.now();
  if (!_rateCounts[ip] || now - _rateCounts[ip].start > 60000) {
    _rateCounts[ip] = { count: 1, start: now };
    return false;
  }
  _rateCounts[ip].count++;
  return _rateCounts[ip].count > 30;
}

function buildSystemPrompt(country, region) {
  return `You are a payroll compliance assistant built into DroneHub's operations platform. You help employers understand the process of registering for payroll tax accounts, making tax deposits, and filing quarterly/annual returns.

SCOPE: You answer questions about:
- Federal and state/provincial payroll tax registration (EIN, EFTPS, SSA BSO, CRA payroll accounts, WCB)
- How to make federal tax deposits (EFTPS) and state withholding deposits
- CRA remittance procedures and schedules
- Filing Form 941, Form 940, W-2/W-3, state quarterly/annual returns
- Filing T4 slips, T4 Summary, and ROE in Canada
- Deposit schedules (monthly vs semi-weekly, CRA remitter types)
- FUTA and SUTA registration and rates
- Workers' compensation registration
- General payroll compliance timelines and deadlines

RULES:
- Be concise and practical. Give step-by-step instructions when appropriate.
- If the user asks about a specific state or province, tailor your answer to that jurisdiction.
- You are NOT a licensed tax advisor or CPA. If a question requires professional tax advice (complex tax planning, audit defense, specific legal interpretations), say so and recommend they consult a CPA or tax attorney.
- Do NOT provide advice on employee classification (1099 vs W-2), immigration/work authorization, or benefits/insurance beyond workers' comp.
- Do NOT make up government URLs. Only reference well-known sites (irs.gov, eftps.gov, ssa.gov, canada.ca, state revenue department sites).
- Keep answers under 300 words unless the question genuinely requires more detail.
- Use plain language. Avoid unnecessary jargon.

The user is currently viewing the filing guide for: ${country === 'CA' ? 'Canada' + (region ? ' — ' + region : '') : 'United States' + (region ? ' — ' + region : '')}.`;
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
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests. Please wait a moment.' }) };
  }

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !verifyToken(token)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };
  }

  let messages, country, region;
  try {
    ({ messages, country, region } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  if (!messages || !Array.isArray(messages) || messages.length < 1) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Messages required' }) };
  }
  if (messages.length > 20) {
    messages = messages.slice(-20);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  const apiMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: String(m.content || '').slice(0, 2000),
  }));

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
        system: buildSystemPrompt(country || 'US', region || ''),
        messages: apiMessages,
      }),
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('Anthropic API error:', r.status, err);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service unavailable' }) };
    }

    const result = await r.json();
    const text = (result.content || []).map(b => b.text || '').join('');

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ reply: text }),
    };
  } catch (e) {
    console.error('Filing chat error:', e);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Internal error' }) };
  }
};
