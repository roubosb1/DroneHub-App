/**
 * Filemail API Proxy
 * POST /.netlify/functions/filemail-proxy
 * Body: { action, email?, password?, logintoken?, search?, limit?, skip? }
 *
 * Proxies requests to the Filemail v1 API so the API key never touches the frontend.
 * All Filemail v1 endpoints use GET with query parameters.
 *
 * Required Netlify environment variable:
 *   FILEMAIL_API_KEY — your Filemail API key
 */

const https = require('https');

function fmGet(path, params = {}) {
  params.apikey = process.env.FILEMAIL_API_KEY;
  const qs = new URLSearchParams(params).toString();
  const fullPath = path + (qs ? '?' + qs : '');
  return new Promise((resolve, reject) => {
    https.get('https://www.filemail.com' + fullPath, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, data }); }
      });
    }).on('error', reject);
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
      const res = await fmGet('/api/authentication/login', {
        username: req.email,
        password: req.password,
        source: 'Web',
      });
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'logout') {
      const res = await fmGet('/api/authentication/logout', {
        logintoken: req.logintoken,
      });
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'sent') {
      const params = { logintoken: req.logintoken };
      if (req.search) params.search = req.search;
      if (req.limit) params.limit = String(req.limit);
      if (req.skip) params.skip = String(req.skip);
      if (req.getexpired) params.getexpired = 'true';
      const res = await fmGet('/api/transfer/sent/get', params);
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'received') {
      const params = { logintoken: req.logintoken };
      if (req.search) params.search = req.search;
      if (req.limit) params.limit = String(req.limit);
      if (req.skip) params.skip = String(req.skip);
      const res = await fmGet('/api/transfer/received/get', params);
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    if (action === 'get') {
      const res = await fmGet('/api/transfer/get', {
        logintoken: req.logintoken,
        transferid: req.transferid,
      });
      return { statusCode: res.status, headers: cors, body: JSON.stringify(res.data) };
    }

    return { statusCode: 400, headers: cors, body: JSON.stringify({ error: 'Unknown action: ' + action }) };
  } catch (e) {
    return { statusCode: 500, headers: cors, body: JSON.stringify({ error: e.message }) };
  }
};
