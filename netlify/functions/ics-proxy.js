/**
 * DroneHub ICS Proxy
 * GET /.netlify/functions/ics-proxy?url=<encoded ICS URL>
 *
 * Fetches a Google Calendar (or any) ICS feed server-side (bypassing browser
 * CORS restrictions) and returns the events as a JSON array.
 * No auth token required — Google Calendar ICS URLs are already secret URLs
 * with a private key embedded, so the URL itself is the credential.
 *
 * Each event object: { title, date, endDate, time, endTime, location, description, uid }
 * Dates are ISO strings (YYYY-MM-DD). Times are HH:MM (24-hr) or '' if all-day.
 */

const https = require('https');
const http  = require('http');

// ── ICS parser ───────────────────────────────────────────────────────────────

// Unfold ICS lines (continuation lines start with a space or tab)
function unfold(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

// Parse a DTSTART / DTEND value into { date:'YYYY-MM-DD', time:'HH:MM' }
function parseDt(raw) {
  if (!raw) return { date: '', time: '' };
  // Strip TZID=... prefix if present (value comes after the colon)
  const val = raw.includes(':') ? raw.split(':').slice(1).join(':') : raw;
  // All-day: YYYYMMDD
  if (/^\d{8}$/.test(val)) {
    return { date: `${val.slice(0,4)}-${val.slice(4,6)}-${val.slice(6,8)}`, time: '' };
  }
  // DateTime: YYYYMMDDTHHmmss[Z]
  if (/^\d{8}T\d{6}/.test(val)) {
    const d = val.slice(0,8);
    const t = val.slice(9,13); // HHMM
    return {
      date: `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}`,
      time: `${t.slice(0,2)}:${t.slice(2,4)}`,
    };
  }
  return { date: '', time: '' };
}

// Unescape ICS text values (\n → newline, \, → comma, etc.)
function unescape(s) {
  return (s || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseIcs(text) {
  const lines = unfold(text).split('\n');
  const events = [];
  let current = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') { current = {}; continue; }
    if (line === 'END:VEVENT') {
      if (current && current.date) events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const key = line.slice(0, colon).toUpperCase();
    const value = line.slice(colon + 1);

    // DTSTART may look like "DTSTART;TZID=America/New_York" — normalize the key
    const baseKey = key.split(';')[0];

    switch (baseKey) {
      case 'SUMMARY':     current.title       = unescape(value); break;
      case 'DESCRIPTION': current.description = unescape(value); break;
      case 'LOCATION':    current.location    = unescape(value); break;
      case 'UID':         current.uid         = value; break;
      case 'DTSTART': {
        // Pass the whole key:value so parseDt can detect TZID
        const { date, time } = parseDt(line.slice(colon + 1 - (key.length - baseKey.length)));
        // Simpler: just pass the raw value part
        const parsed = parseDt(value);
        current.date = parsed.date;
        current.time = parsed.time;
        break;
      }
      case 'DTEND': {
        const parsed = parseDt(value);
        current.endDate = parsed.date;
        current.endTime = parsed.time;
        break;
      }
    }
  }

  return events;
}

// ── HTTP fetch helper (Node built-in, no dependencies) ──────────────────────
function fetchUrl(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    const parsedUrl = new URL(url);
    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; DroneHub-CalSync/1.0)',
        'Accept': 'text/calendar, text/plain, */*',
      },
      timeout: 10000,
    };
    const req = mod.request(options, (res) => {
      // Follow redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        if (redirectsLeft <= 0) return reject(new Error('Too many redirects'));
        const next = res.headers.location.startsWith('http')
          ? res.headers.location
          : `${parsedUrl.protocol}//${parsedUrl.host}${res.headers.location}`;
        return fetchUrl(next, redirectsLeft - 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Google returned HTTP ${res.statusCode} — make sure you copied the Secret address (not the public one)`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => {
        // Sanity check: ICS files must start with BEGIN:VCALENDAR
        if (!body.includes('BEGIN:VCALENDAR')) {
          return reject(new Error('Response is not a valid ICS calendar file — check the URL is the Secret iCal address'));
        }
        resolve(body);
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
    req.end();
  });
}

// ── Handler ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers };
  }

  // Get ICS URL from query string
  const icsUrl = event.queryStringParameters?.url;
  if (!icsUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'url param required' }) };
  }

  // Only allow Google Calendar ICS URLs (and other calendar services)
  const allowedHosts = ['calendar.google.com', 'outlook.live.com', 'outlook.office.com', 'apple.com', 'icloud.com'];
  let parsedUrl;
  try { parsedUrl = new URL(decodeURIComponent(icsUrl)); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) };
  }
  if (!allowedHosts.some(h => parsedUrl.hostname.endsWith(h))) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL not from an allowed calendar service' }) };
  }

  try {
    const icsText = await fetchUrl(decodeURIComponent(icsUrl));
    const events = parseIcs(icsText);
    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'public, max-age=300' }, // cache 5 min
      body: JSON.stringify({ events }),
    };
  } catch (err) {
    console.error('ics-proxy error:', err.message);
    return { statusCode: 502, headers, body: JSON.stringify({ error: 'Could not fetch calendar: ' + err.message }) };
  }
};
