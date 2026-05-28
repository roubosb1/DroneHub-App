/**
 * DroneHub ICS Proxy
 * GET /.netlify/functions/ics-proxy?url=<encoded ICS URL>
 *
 * Fetches a Google Calendar (or any) ICS feed server-side (bypassing browser
 * CORS restrictions) and returns the events as a JSON array.
 * Uses Node 18 native fetch which handles redirects and TLS automatically.
 *
 * Each event object: { title, date, endDate, time, endTime, location, description, uid }
 * Dates are ISO strings (YYYY-MM-DD). Times are HH:MM (24-hr) or '' if all-day.
 */

// ── ICS parser ───────────────────────────────────────────────────────────────

function unfold(text) {
  return text.replace(/\r\n[ \t]/g, '').replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
}

function parseDt(val) {
  if (!val) return { date: '', time: '' };
  // Strip VALUE=DATE: or TZID=...: prefixes
  const v = val.includes(':') ? val.split(':').slice(1).join(':') : val;
  if (/^\d{8}$/.test(v)) {
    return { date: `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`, time: '' };
  }
  if (/^\d{8}T\d{6}/.test(v)) {
    return {
      date: `${v.slice(0,4)}-${v.slice(4,6)}-${v.slice(6,8)}`,
      time: `${v.slice(9,11)}:${v.slice(11,13)}`,
    };
  }
  return { date: '', time: '' };
}

function icsUnescape(s) {
  return (s || '').replace(/\\n/gi, ' ').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
}

function parseIcs(text) {
  const lines = unfold(text).split('\n');
  const events = [];
  let cur = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT')   { if (cur?.date) events.push(cur); cur = null; continue; }
    if (!cur) continue;

    const colon = line.indexOf(':');
    if (colon < 0) continue;
    const fullKey = line.slice(0, colon).toUpperCase();
    const value   = line.slice(colon + 1);
    const baseKey = fullKey.split(';')[0];

    switch (baseKey) {
      case 'SUMMARY':     cur.title       = icsUnescape(value); break;
      case 'DESCRIPTION': cur.description = icsUnescape(value); break;
      case 'LOCATION':    cur.location    = icsUnescape(value); break;
      case 'UID':         cur.uid         = value.trim(); break;
      case 'DTSTART': { const p = parseDt(line.slice(colon + 1)); cur.date    = p.date; cur.time    = p.time; break; }
      case 'DTEND':   { const p = parseDt(line.slice(colon + 1)); cur.endDate = p.date; cur.endTime = p.time; break; }
    }
  }
  return events;
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

  const icsUrl = event.queryStringParameters?.url;
  if (!icsUrl) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'url param required' }) };
  }

  let decoded;
  try { decoded = decodeURIComponent(icsUrl); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL encoding' }) };
  }

  // Only allow known calendar hostnames
  let parsedUrl;
  try { parsedUrl = new URL(decoded); } catch {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) };
  }
  const allowed = ['calendar.google.com', 'outlook.live.com', 'outlook.office.com', 'icloud.com', 'apple.com'];
  if (!allowed.some(h => parsedUrl.hostname === h || parsedUrl.hostname.endsWith('.'+h))) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'URL host not allowed: ' + parsedUrl.hostname }) };
  }

  try {
    // Use native fetch (Node 18) — handles TLS, gzip, redirects automatically
    const res = await fetch(decoded, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/calendar, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(12000),
    });

    if (!res.ok) {
      const hint = res.status === 403 || res.status === 401
        ? ' — make sure you use the Secret address in iCal format, not the public one'
        : res.status === 404
        ? ' — calendar not found, check the URL is correct'
        : '';
      return { statusCode: 502, headers, body: JSON.stringify({ error: `Google returned ${res.status}${hint}` }) };
    }

    const text = await res.text();

    if (!text.includes('BEGIN:VCALENDAR')) {
      return { statusCode: 502, headers, body: JSON.stringify({
        error: 'URL did not return a calendar file — make sure you copied the Secret address in iCal format from Google Calendar settings',
      })};
    }

    const events = parseIcs(text);
    return {
      statusCode: 200,
      headers: { ...headers, 'Cache-Control': 'public, max-age=300' },
      body: JSON.stringify({ events, count: events.length }),
    };
  } catch (err) {
    const msg = err.name === 'TimeoutError' ? 'Request timed out — Google took too long to respond' : err.message;
    console.error('ics-proxy error:', msg);
    return { statusCode: 502, headers, body: JSON.stringify({ error: msg }) };
  }
};
