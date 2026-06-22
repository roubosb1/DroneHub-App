const https = require('https');

function fmRequest(method, path, body) {
  const apikey = process.env.FILEMAIL_API_KEY;
  const data = body ? JSON.stringify(body) : '';
  const options = {
    hostname: 'api-public.filemail.com',
    path,
    method,
    headers: {
      'x-api-key': apikey,
      'x-api-version': '2.0',
      'Content-Type': 'application/json',
      ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
    },
  };
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', (c) => (raw += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(raw) }); }
        catch (e) { resolve({ status: res.statusCode, data: raw }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

exports.handler = async (event) => {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers: cors, body: 'Method not allowed' };

  if (!process.env.FILEMAIL_API_KEY) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: 'FILEMAIL_API_KEY not configured' }) };
  }

  let req;
  try { req = JSON.parse(event.body); } catch (e) {
    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Invalid JSON' }) };
  }

  const { action } = req;

  try {
    if (action === 'ping') {
      const res = await fmRequest('GET', '/user/get');
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'sent') {
      const params = new URLSearchParams();
      if (req.limit) params.set('limit', String(req.limit));
      if (req.offset) params.set('offset', String(req.offset));
      if (req.getexpired) params.set('getexpired', 'true');
      const qs = params.toString();
      const res = await fmRequest('GET', '/transfer/sent/get' + (qs ? '?' + qs : ''));
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'received') {
      const params = new URLSearchParams();
      if (req.limit) params.set('limit', String(req.limit));
      if (req.offset) params.set('offset', String(req.offset));
      const qs = params.toString();
      const res = await fmRequest('GET', '/transfer/received/get' + (qs ? '?' + qs : ''));
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'transfer') {
      const res = await fmRequest('GET', '/transfer/get?transferid=' + encodeURIComponent(req.transferid));
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
