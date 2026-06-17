/**
 * DroneHub AI Pay Stub Scanner
 * POST /.netlify/functions/ai-paystub-scan
 * Accepts 1-2 screenshots from CRA Payroll Deductions Online Calculator (PDOC)
 * and extracts structured payroll data.
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
  return _rateCounts[ip].count > 15;
}

const RECORD_SCHEMA = `{
  "employeeName": string,
  "employerName": string|null,
  "payDate": string (YYYY-MM-DD),
  "payFrequency": string|null (e.g. "Biweekly"),
  "province": string|null,
  "salaryOrWages": number,
  "vacationPay": number,
  "totalCashIncome": number,
  "federalTax": number,
  "provincialTax": number,
  "totalTaxDeductions": number,
  "cppEmployee": number,
  "cpp2Employee": number,
  "eiEmployee": number,
  "totalDeductions": number,
  "netAmount": number,
  "cppEmployer": number|null,
  "cpp2Employer": number|null,
  "eiEmployer": number|null,
  "subtotalCpp": number|null,
  "subtotalEi": number|null,
  "totalRemittance": number|null,
  "federalTd1": number|null,
  "provincialTd1": number|null
}`;

function buildSystemPrompt(batch) {
  const base = `You are a payroll data extractor for a Canadian drone media company (DroneHub Media Company Corp) based in Ontario. You will receive screenshots from the CRA Payroll Deductions Online Calculator (PDOC).

The screenshots show two views:
1. "Salary calculation" — shows employee name, pay date, salary/wages, vacation pay, total cash income, federal tax, provincial tax, CPP deductions, CPP2 deductions, EI deductions, total deductions, and net amount.
2. "Employer remittance summary" — shows the same employee info plus employer CPP/CPP2 contributions, employer EI contributions, subtotals, tax deductions total, and the total amount to remit.

Extract ALL of these fields. If you only see one type of screenshot for a given employee/date, extract what you can.`;

  if (batch) {
    return base + `

You are receiving MULTIPLE screenshots — potentially for different employees and/or different pay dates. Match salary calculation screenshots with their corresponding employer remittance screenshots by employee name and pay date.

Return a JSON ARRAY of records, one per unique employee+date combination. Respond with ONLY the JSON array, no markdown fences, no commentary:
[${RECORD_SCHEMA}, ...]`;
  }

  return base + `

Respond with ONLY a JSON object, no markdown fences, no commentary:
${RECORD_SCHEMA}`;
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
    return { statusCode: 429, headers, body: JSON.stringify({ error: 'Too many requests' }) };
  }

  const authHeader = event.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token || !verifyToken(token)) {
    return { statusCode: 401, headers, body: JSON.stringify({ error: 'Invalid or expired session' }) };
  }

  let images, batch;
  try {
    ({ images, batch } = JSON.parse(event.body || '{}'));
  } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }
  if (!images || !Array.isArray(images) || images.length < 1) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'At least one image required' }) };
  }
  if (images.length > 20) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Maximum 20 images per scan' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }) };
  }

  const isBatch = batch && images.length > 2;
  const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  const content = [];
  for (const img of images) {
    const mt = validTypes.includes(img.mimeType) ? img.mimeType : 'image/png';
    content.push({ type: 'image', source: { type: 'base64', media_type: mt, data: img.data } });
    if (img.label) {
      content.push({ type: 'text', text: '(Above image is: ' + img.label.replace(/_/g, ' ') + ')' });
    }
  }
  content.push({ type: 'text', text: isBatch
    ? 'Extract all payroll data from these CRA PDOC calculator screenshots. There are multiple employees and/or pay dates. Match salary calculations with their employer remittance by employee name and date. Return a JSON array.'
    : 'Extract all payroll data from these CRA PDOC calculator screenshots.' });

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
        max_tokens: isBatch ? 4096 : 1024,
        system: buildSystemPrompt(isBatch),
        messages: [{ role: 'user', content }],
      }),
    });

    if (!r.ok) {
      const errBody = await r.text();
      console.error('[ai-paystub-scan] API error:', r.status, errBody);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service error (HTTP ' + r.status + ')' }) };
    }

    const result = await r.json();
    const text = (result.content || []).map(b => b.text || '').join('').trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('[ai-paystub-scan] Parse error:', text);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI returned unparseable response' }) };
    }

    return { statusCode: 200, headers, body: JSON.stringify({ data: parsed }) };
  } catch (e) {
    console.error('[ai-paystub-scan] error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'Scan failed' }) };
  }
};
