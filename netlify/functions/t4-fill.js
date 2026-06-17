const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

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
  return _rateCounts[ip].count > 10;
}

let _templateBytes = null;
function getTemplate() {
  if (!_templateBytes) {
    _templateBytes = fs.readFileSync(path.join(__dirname, 't4-template.pdf'));
  }
  return _templateBytes;
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

  let body;
  try { body = JSON.parse(event.body || '{}'); } catch (e) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const d = body;
  if (!d.employerName || !d.lastName || !d.year) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing required fields (employerName, lastName, year)' }) };
  }

  try {
    const templateBytes = getTemplate();
    const pdf = await PDFDocument.load(templateBytes);
    const form = pdf.getForm();

    const fieldMap = {
      'Slip1EmployersName': d.employerName || '',
      'Slip1Year': d.year || '',
      'Slip1Box54': d.employerBN || '',
      'Slip1Box12': d.sin || '',
      'Slip1LastName': d.lastName || '',
      'Slip1FirstName': d.firstName || '',
      'Slip1Initial': d.initial || '',
      'Slip1Address': d.employeeAddress || '',
      'Slip1Box14': d.box14 || '',
      'Slip1Box16': d.box16 || '',
      'Slip1Box17': d.box17 || '',
      'Slip1Box16A': d.box16A || '',
      'Slip1Box17A': d.box17A || '',
      'Slip1Box18': d.box18 || '',
      'Slip1Box20': d.box20 || '',
      'Slip1Box22': d.box22 || '',
      'Slip1Box24': d.box24 || '',
      'Slip1Box26': d.box26 || '',
      'Slip1Box44': d.box44 || '',
      'Slip1Box46': d.box46 || '',
      'Slip1Box50': d.box50 || '',
      'Slip1Box52': d.box52 || '',
      'Slip1Box55': d.box55 || '',
      'Slip1Box56': d.box56 || '',
    };

    const allFields = form.getFields();
    for (const field of allFields) {
      const name = field.getName();
      const shortName = name.split('.').pop().replace(/\[\d+\]/g, '');

      if (shortName in fieldMap && fieldMap[shortName]) {
        try {
          const tf = form.getTextField(name);
          tf.setText(fieldMap[shortName]);
        } catch (e) {
          // Skip non-text fields (dropdowns, checkboxes)
        }
      }
    }

    const filledBytes = await pdf.save();
    const base64 = Buffer.from(filledBytes).toString('base64');

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pdf: base64 }),
    };
  } catch (e) {
    console.error('[t4-fill] error:', e.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: e.message || 'PDF fill failed' }) };
  }
};
