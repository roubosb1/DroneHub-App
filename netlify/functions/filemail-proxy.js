/**
 * Filemail API Proxy
 * POST /.netlify/functions/filemail-proxy
 * Body: { action, email?, password?, logintoken?, refreshtoken?, search?, limit?, skip? }
 *
 * Proxies requests to the Filemail API so the API key never touches the frontend.
 *
 * Required Netlify environment variable:
 *   FILEMAIL_API_KEY — your Filemail API key
 */

const https = require('https');

const FM_BASE = 'https://api-public.filemail.com';

function fmRequest(method, path, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, FM_BASE);
    const opts = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.FILEMAIL_API_KEY,
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
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
    if (action === 'login') {
      const res = await fmRequest('POST', '/auth/login', {
        email: req.email,
        password: req.password,
      });
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'refresh') {
      const res = await fmRequest('POST', '/auth/refreshtoken', {
        refreshtoken: req.refreshtoken,
      });
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'sent') {
      const params = new URLSearchParams();
      if (req.search) params.set('search', req.search);
      if (req.limit) params.set('limit', String(req.limit));
      if (req.skip) params.set('skip', String(req.skip));
      if (req.getexpired) params.set('getexpired', 'true');
      const qs = params.toString();
      const res = await fmRequest('GET', '/transfer/sent' + (qs ? '?' + qs : ''), null, {
        logintoken: req.logintoken,
      });
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'received') {
      const params = new URLSearchParams();
      if (req.search) params.set('search', req.search);
      if (req.limit) params.set('limit', String(req.limit));
      if (req.skip) params.set('skip', String(req.skip));
      const qs = params.toString();
      const res = await fmRequest('GET', '/transfer/received' + (qs ? '?' + qs : ''), null, {
        logintoken: req.logintoken,
      });
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'logout') {
      const res = await fmRequest('POST', '/auth/logout', null, {
        logintoken: req.logintoken,
      });
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
