// ── SOCIAL ANALYTICS ─────────────────────────────────────────────────────────
// Tracks company + client social accounts and their metrics.
// Account: {id, platform, handle, ownerType:'company'|'client', clientId,
//           name, avatar, url, followers, views, posts, lastSync,
//           history:[{date, followers, views, posts}]}

const SOCIAL_METRICS_API = '/.netlify/functions/social-metrics';

const SA_PLATFORMS = [
  { id: 'youtube',   label: 'YouTube',   color: '#FF0000', live: true,
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="var(--navy)"/></svg>' },
  { id: 'instagram', label: 'Instagram', color: '#E4405F', live: false,
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>' },
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2', live: false,
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>' },
  { id: 'tiktok',    label: 'TikTok',    color: '#69C9D0', live: false,
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>' },
];

function socialAcctsLoad() {
  try { return JSON.parse(localStorage.getItem('dronehub_social_accounts') || '[]'); } catch (e) { return []; }
}
function socialAcctsSave(arr) {
  localStorage.setItem('dronehub_social_accounts', JSON.stringify(arr));
  if (_fbToken()) {
    fbSetStrict('orgs', ORG_ID + ':social_accounts', { data: JSON.stringify(arr), updatedAt: Date.now() })
      .catch(e => {
        console.error('[socialAcctsSave] Firebase write failed:', e.message);
        try { showDhToast('Accounts not saved', 'Social accounts could not sync to the cloud.', '⚠️', 'var(--orange)', 6000); } catch (er) {}
      });
  }
}
// Pull from Firebase when local copy is empty (fresh device / client portal)
async function socialAcctsRestore() {
  if (socialAcctsLoad().length || !_fbToken()) return;
  try {
    const doc = await fbGet('orgs', ORG_ID + ':social_accounts');
    if (doc?.data) localStorage.setItem('dronehub_social_accounts', doc.data);
  } catch (e) {}
}

function _saPlatform(id) { return SA_PLATFORMS.find(p => p.id === id) || SA_PLATFORMS[0]; }
function _saFmt(n) {
  n = parseInt(n || 0, 10);
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}
function _saDelta(acct, field) {
  const h = acct.history || [];
  if (h.length < 2) return '';
  const prev = h[h.length - 2][field] || 0;
  const cur = acct[field] || 0;
  const d = cur - prev;
  if (!d) return '';
  const up = d > 0;
  return `<span style="font-size:10px;font-weight:700;color:${up ? 'var(--green)' : '#E85D5D'}">${up ? '▲' : '▼'} ${_saFmt(Math.abs(d))}</span>`;
}

// ── Fetch metrics ─────────────────────────────────────────────────────────────
async function socialAcctRefresh(acctId, silent) {
  const arr = socialAcctsLoad();
  const acct = arr.find(a => a.id === acctId);
  if (!acct) return;
  try {
    const res = await fetch(SOCIAL_METRICS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: acct.platform, handle: acct.handle }),
    });
    const data = await res.json();
    if (data.notConfigured) {
      if (!silent) try { showDhToast('Not connected yet', data.message || 'This platform needs API setup', '⚠', 'var(--orange)', 5000); } catch (e) {}
      return;
    }
    if (data.error) throw new Error(data.error);
    acct.name = data.name || acct.name;
    acct.avatar = data.avatar || acct.avatar || '';
    acct.url = data.url || acct.url || '';
    acct.followers = data.followers || 0;
    acct.views = data.views || 0;
    acct.posts = data.posts || 0;
    acct.lastSync = new Date().toISOString();
    acct.syncError = null;
    // Daily snapshot for deltas/history (one per day, keep a year)
    const today = new Date().toISOString().slice(0, 10);
    acct.history = (acct.history || []).filter(s => s.date !== today);
    acct.history.push({ date: today, followers: acct.followers, views: acct.views, posts: acct.posts });
    if (acct.history.length > 366) acct.history = acct.history.slice(-366);
    socialAcctsSave(arr);
    if (!silent) try { showDhToast('Updated', acct.name, 'check', 'var(--green)', 2000); } catch (e) {}
  } catch (err) {
    acct.syncError = err.message;
    socialAcctsSave(arr);
    if (!silent) try { showDhToast('Refresh failed', err.message, '⚠', 'var(--orange)', 5000); } catch (e) {}
  }
}

async function socialAcctsRefreshAll() {
  const arr = socialAcctsLoad();
  try { showDhToast('Refreshing…', arr.length + ' account' + (arr.length === 1 ? '' : 's'), '⟳', 'var(--blue-bright)', 2000); } catch (e) {}
  for (const a of arr) await socialAcctRefresh(a.id, true);
  renderSocialAnalytics();
  try { showDhToast('All metrics updated', '', 'check', 'var(--green)', 2000); } catch (e) {}
}

// ── Card HTML (shared by admin view + client portal) ─────────────────────────
function socialAcctCardHtml(acct, readOnly) {
  const p = _saPlatform(acct.platform);
  const synced = acct.lastSync ? new Date(acct.lastSync).toLocaleDateString('en-CA') : 'never';
  return `<div class="card" onclick="socialAcctDetail('${acct.id}')" style="padding:16px;min-width:0;cursor:pointer;transition:border-color .15s" onmouseenter="this.style.borderColor='var(--border-bright)'" onmouseleave="this.style.borderColor=''">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      ${acct.avatar
        ? `<img src="${acct.avatar}" style="width:36px;height:36px;border-radius:50%;flex-shrink:0" onerror="this.style.display='none'">`
        : `<span style="width:36px;height:36px;border-radius:50%;background:${p.color}22;color:${p.color};display:inline-flex;align-items:center;justify-content:center;flex-shrink:0">${p.icon}</span>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:700;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${acct.name || acct.handle}</div>
        <div style="font-size:10px;color:${p.color};font-weight:600;display:flex;align-items:center;gap:4px">${p.icon} ${p.label}</div>
      </div>
      ${!readOnly ? `
      <button onclick="event.stopPropagation();socialAcctRefresh('${acct.id}').then(()=>renderSocialAnalytics())" title="Refresh" style="border:none;background:none;color:var(--blue-bright);cursor:pointer;padding:4px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg></button>
      <button onclick="event.stopPropagation();socialAcctRemove('${acct.id}')" title="Remove" style="border:none;background:none;color:var(--muted);cursor:pointer;padding:4px;font-size:14px">✕</button>` : ''}
    </div>
    ${acct.syncError ? `<div style="font-size:10px;color:#E85D5D;margin-bottom:8px">${acct.syncError}</div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">
      <div style="background:var(--navy-mid);border-radius:10px;padding:10px 8px;text-align:center">
        <div style="font-size:17px;font-weight:800;color:var(--white)">${_saFmt(acct.followers)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">${acct.platform === 'youtube' ? 'Subs' : 'Followers'} ${_saDelta(acct, 'followers')}</div>
      </div>
      <div style="background:var(--navy-mid);border-radius:10px;padding:10px 8px;text-align:center">
        <div style="font-size:17px;font-weight:800;color:var(--white)">${_saFmt(acct.views)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Views ${_saDelta(acct, 'views')}</div>
      </div>
      <div style="background:var(--navy-mid);border-radius:10px;padding:10px 8px;text-align:center">
        <div style="font-size:17px;font-weight:800;color:var(--white)">${_saFmt(acct.posts)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">${acct.platform === 'youtube' ? 'Videos' : 'Posts'} ${_saDelta(acct, 'posts')}</div>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px">
      <span style="font-size:9px;color:var(--muted)">Updated ${synced}</span>
      ${acct.url ? `<a href="${acct.url}" target="_blank" onclick="event.stopPropagation()" style="font-size:10px;color:var(--blue-bright);text-decoration:none;font-weight:600">View channel ↗</a>` : ''}
    </div>
  </div>`;
}

// ── Detail view: growth chart + recent videos ────────────────────────────────
function _saSparkline(history, field, color) {
  const pts = (history || []).map(s => s[field] || 0);
  if (pts.length < 2) return `<div style="height:60px;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--muted);background:var(--navy-mid);border-radius:10px">Growth chart builds as daily snapshots accumulate — check back in a few days</div>`;
  const w = 560, h = 60, pad = 4;
  const min = Math.min(...pts), max = Math.max(...pts);
  const range = max - min || 1;
  const step = (w - pad * 2) / (pts.length - 1);
  const coords = pts.map((v, i) => `${(pad + i * step).toFixed(1)},${(h - pad - ((v - min) / range) * (h - pad * 2)).toFixed(1)}`);
  return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:60px;display:block">
    <polyline points="${coords.join(' ')}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <polygon points="${pad},${h - pad} ${coords.join(' ')} ${w - pad},${h - pad}" fill="${color}" opacity="0.08"/>
  </svg>`;
}

async function socialAcctDetail(acctId) {
  const acct = socialAcctsLoad().find(a => a.id === acctId);
  if (!acct) return;
  const p = _saPlatform(acct.platform);
  document.getElementById('sa-detail-modal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'sa-detail-modal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  const hist = acct.history || [];
  const first = hist[0], last = hist[hist.length - 1];
  const growth = (field) => first && last && hist.length > 1 ? (last[field] || 0) - (first[field] || 0) : null;
  const growthChip = (field) => {
    const g = growth(field);
    if (g === null) return '';
    const up = g >= 0;
    return `<span style="font-size:10px;font-weight:700;color:${up ? 'var(--green)' : '#E85D5D'}">${up ? '▲' : '▼'} ${_saFmt(Math.abs(g))} in ${hist.length} days</span>`;
  };
  wrap.innerHTML = `
    <div style="background:var(--navy-card);border:1px solid var(--border-bright);border-radius:16px;max-width:640px;width:100%;max-height:85vh;overflow-y:auto;-webkit-overflow-scrolling:touch;box-shadow:0 20px 60px rgba(0,0,0,.55)" onclick="event.stopPropagation()">
      <div style="background:var(--navy-mid);padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:2">
        ${acct.avatar ? `<img src="${acct.avatar}" style="width:44px;height:44px;border-radius:50%">` : `<span style="width:44px;height:44px;border-radius:50%;background:${p.color}22;color:${p.color};display:inline-flex;align-items:center;justify-content:center">${p.icon}</span>`}
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:800;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${acct.name || acct.handle}</div>
          <div style="font-size:11px;color:${p.color};font-weight:600;display:flex;align-items:center;gap:4px">${p.icon} ${p.label}${acct.url ? ` · <a href="${acct.url}" target="_blank" style="color:var(--blue-bright);text-decoration:none">Open channel ↗</a>` : ''}</div>
        </div>
        <button onclick="document.getElementById('sa-detail-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:18px">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:18px">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--white)">${_saFmt(acct.followers)}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">${acct.platform === 'youtube' ? 'Subscribers' : 'Followers'}</div>
            <div style="margin-top:3px">${growthChip('followers')}</div>
          </div>
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--white)">${_saFmt(acct.views)}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">Total Views</div>
            <div style="margin-top:3px">${growthChip('views')}</div>
          </div>
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:22px;font-weight:800;color:var(--white)">${_saFmt(acct.posts)}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">${acct.platform === 'youtube' ? 'Videos' : 'Posts'}</div>
            <div style="margin-top:3px">${growthChip('posts')}</div>
          </div>
        </div>
        <div>
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${acct.platform === 'youtube' ? 'Subscriber' : 'Follower'} growth</div>
          ${_saSparkline(hist, 'followers', p.color)}
        </div>
        <div id="sa-detail-videos">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Recent uploads</div>
          <div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Loading recent videos…</div>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);

  if (acct.platform !== 'youtube') {
    const vc = document.getElementById('sa-detail-videos');
    if (vc) vc.innerHTML = '';
    return;
  }
  try {
    const res = await fetch(SOCIAL_METRICS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: acct.platform, handle: acct.handle, action: 'videos' }),
    });
    const data = await res.json();
    const vc = document.getElementById('sa-detail-videos');
    if (!vc) return;
    const vids = data.videos || [];
    if (data.error || !vids.length) {
      vc.innerHTML = `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Recent uploads</div>
        <div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">${data.error || 'No videos found'}</div>`;
      return;
    }
    const avgViews = Math.round(vids.reduce((s, v) => s + v.views, 0) / vids.length);
    const likeRate = (vids.reduce((s, v) => s + v.likes, 0) / Math.max(vids.reduce((s, v) => s + v.views, 0), 1) * 100).toFixed(1);
    vc.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:var(--navy-mid);border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--white)">${_saFmt(avgViews)}</div>
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Avg views · last ${vids.length}</div>
        </div>
        <div style="background:var(--navy-mid);border-radius:12px;padding:12px;text-align:center">
          <div style="font-size:18px;font-weight:800;color:var(--white)">${likeRate}%</div>
          <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Like rate</div>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Recent uploads</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${vids.map(v => `
          <a href="https://www.youtube.com/watch?v=${v.id}" target="_blank" style="display:flex;gap:10px;align-items:center;padding:8px;border-radius:10px;background:var(--navy-mid);text-decoration:none;transition:background .15s" onmouseenter="this.style.background='var(--navy-lift)'" onmouseleave="this.style.background='var(--navy-mid)'">
            ${v.thumb ? `<img src="${v.thumb}" style="width:80px;height:45px;border-radius:6px;object-fit:cover;flex-shrink:0">` : ''}
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:3px">${v.publishedAt} · ${_saFmt(v.views)} views · ${_saFmt(v.likes)} likes · ${_saFmt(v.comments)} comments</div>
            </div>
          </a>`).join('')}
      </div>`;
  } catch (err) {
    const vc = document.getElementById('sa-detail-videos');
    if (vc) vc.innerHTML = `<div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Could not load videos: ${err.message}</div>`;
  }
}

// Cards for one client — used inside the client portal social tab
function socialAnalyticsClientCardsHtml(clientId, readOnly) {
  const accts = socialAcctsLoad().filter(a => a.ownerType === 'client' && a.clientId === clientId);
  if (!accts.length) return '';
  return `<div class="card" style="margin-bottom:12px">
    <div class="section-label" style="margin-bottom:14px;display:flex;align-items:center;gap:6px">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      Account Performance
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px">
      ${accts.map(a => socialAcctCardHtml(a, readOnly !== false)).join('')}
    </div>
  </div>`;
}

// ── Analytics sub-tab (admin) ─────────────────────────────────────────────────
let _saAutoRefreshed = false;
async function renderSocialAnalytics() {
  const cont = document.getElementById('social-sub-analytics');
  if (!cont) return;
  await socialAcctsRestore();
  const accts = socialAcctsLoad();

  // Once per session, silently refresh anything older than 24h
  if (!_saAutoRefreshed && accts.length) {
    _saAutoRefreshed = true;
    const stale = accts.filter(a => !a.lastSync || (Date.now() - new Date(a.lastSync).getTime()) > 86400000);
    if (stale.length) {
      Promise.all(stale.map(a => socialAcctRefresh(a.id, true))).then(() => renderSocialAnalytics());
    }
  }

  const company = accts.filter(a => a.ownerType !== 'client');
  const byClient = {};
  accts.filter(a => a.ownerType === 'client').forEach(a => {
    (byClient[a.clientId] = byClient[a.clientId] || []).push(a);
  });

  const section = (title, badgeColor, cards) => `
    <div style="margin-bottom:24px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
        <span style="width:8px;height:8px;border-radius:50%;background:${badgeColor};display:inline-block"></span>
        <span style="font-size:13px;font-weight:700;color:var(--white)">${title}</span>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">${cards}</div>
    </div>`;

  let html = `
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:20px">
      <div style="font-size:12px;color:var(--muted)">Track your company accounts and every client page you manage — clients see their own numbers in their portal.</div>
      <div style="display:flex;gap:8px">
        ${accts.length ? `<button onclick="socialAcctsRefreshAll()" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border-bright);background:transparent;color:var(--offwhite);font-size:12px;font-weight:600;cursor:pointer">⟳ Refresh All</button>` : ''}
        <button onclick="socialAcctAddModal()" style="padding:8px 18px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">+ Add Account</button>
      </div>
    </div>`;

  if (!accts.length) {
    html += `<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;color:var(--muted);gap:12px">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity=".25"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      <div style="font-size:14px;font-weight:600;color:var(--offwhite)">No accounts tracked yet</div>
      <div style="font-size:12px;max-width:380px;text-align:center;line-height:1.7">Add your company's YouTube channel or a client's channel to start tracking subscribers, views, and growth over time.</div>
      <button onclick="socialAcctAddModal()" style="margin-top:6px;padding:10px 22px;border-radius:12px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:13px;font-weight:700;cursor:pointer">+ Add First Account</button>
    </div>`;
  } else {
    if (company.length) html += section('DroneHub Media', 'var(--blue-bright)', company.map(a => socialAcctCardHtml(a, false)).join(''));
    Object.entries(byClient).forEach(([cid, list]) => {
      const client = (typeof clients !== 'undefined' ? clients : []).find(c => String(c.id) === String(cid));
      html += section(client?.name || 'Client', 'var(--green)', list.map(a => socialAcctCardHtml(a, false)).join(''));
    });
  }
  cont.innerHTML = html;
}

// ── Add / remove ──────────────────────────────────────────────────────────────
function socialAcctAddModal() {
  document.getElementById('sa-add-modal')?.remove();
  const clientOpts = (typeof clients !== 'undefined' ? clients : [])
    .filter(c => c.name)
    .map(c => `<option value="${c.id}">${c.name}</option>`).join('');
  const wrap = document.createElement('div');
  wrap.id = 'sa-add-modal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
  wrap.innerHTML = `
    <div style="background:var(--navy-card);border:1px solid var(--border-bright);border-radius:16px;max-width:420px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55)">
      <div style="background:var(--navy-mid);padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:700;color:var(--white)">Add Social Account</span>
        <button onclick="document.getElementById('sa-add-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="padding:20px;display:flex;flex-direction:column;gap:14px">
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Platform</label>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px">
            ${SA_PLATFORMS.map((p, i) => `
              <button type="button" data-platform="${p.id}" onclick="_saPickPlatform(this)" ${!p.live ? 'disabled title="Needs API setup — coming soon"' : ''}
                style="padding:10px 4px;border-radius:10px;border:1px solid ${i === 0 ? p.color : 'var(--border)'};background:${i === 0 ? p.color + '18' : 'var(--navy-lift)'};color:${!p.live ? 'var(--muted)' : p.color};font-size:10px;font-weight:700;cursor:${p.live ? 'pointer' : 'not-allowed'};opacity:${p.live ? 1 : .45};display:flex;flex-direction:column;align-items:center;gap:4px">
                ${p.icon}${p.label}
              </button>`).join('')}
          </div>
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Channel handle or URL</label>
          <input id="sa-add-handle" type="text" placeholder="@dronehubmedia or youtube.com/@dronehubmedia" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);outline:none">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Whose account is this?</label>
          <select id="sa-add-owner" onchange="document.getElementById('sa-add-client-wrap').style.display=this.value==='client'?'':'none'" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white)">
            <option value="company">DroneHub Media (our company)</option>
            <option value="client">A client we manage</option>
          </select>
        </div>
        <div id="sa-add-client-wrap" style="display:none">
          <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Client</label>
          <select id="sa-add-client" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white)">
            <option value="">Select client…</option>${clientOpts}
          </select>
        </div>
        <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:4px">
          <button onclick="document.getElementById('sa-add-modal').remove()" style="padding:9px 18px;border-radius:10px;border:1px solid var(--border-bright);background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer">Cancel</button>
          <button id="sa-add-save" onclick="socialAcctAddSave()" style="padding:9px 20px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">Add &amp; Fetch Stats</button>
        </div>
      </div>
    </div>`;
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  document.body.appendChild(wrap);
  setTimeout(() => document.getElementById('sa-add-handle')?.focus(), 30);
}

let _saSelectedPlatform = 'youtube';
function _saPickPlatform(btn) {
  _saSelectedPlatform = btn.dataset.platform;
  document.querySelectorAll('#sa-add-modal [data-platform]').forEach(b => {
    const p = _saPlatform(b.dataset.platform);
    const on = b.dataset.platform === _saSelectedPlatform;
    b.style.border = '1px solid ' + (on ? p.color : 'var(--border)');
    b.style.background = on ? p.color + '18' : 'var(--navy-lift)';
  });
}

async function socialAcctAddSave() {
  const handle = document.getElementById('sa-add-handle')?.value.trim();
  const owner = document.getElementById('sa-add-owner')?.value || 'company';
  const clientId = document.getElementById('sa-add-client')?.value || '';
  if (!handle) { document.getElementById('sa-add-handle').style.borderColor = '#E85D5D'; return; }
  if (owner === 'client' && !clientId) { document.getElementById('sa-add-client').style.borderColor = '#E85D5D'; return; }
  const btn = document.getElementById('sa-add-save');
  if (btn) { btn.textContent = 'Fetching…'; btn.disabled = true; }
  const acct = {
    id: 'sa_' + Date.now(),
    platform: _saSelectedPlatform,
    handle,
    ownerType: owner,
    clientId: owner === 'client' ? clientId : '',
    name: handle, followers: 0, views: 0, posts: 0, history: [],
    createdAt: new Date().toISOString(),
  };
  const arr = socialAcctsLoad();
  arr.push(acct);
  socialAcctsSave(arr);
  await socialAcctRefresh(acct.id, true);
  const saved = socialAcctsLoad().find(a => a.id === acct.id);
  document.getElementById('sa-add-modal')?.remove();
  renderSocialAnalytics();
  if (saved?.syncError) {
    try { showDhToast('Added with issues', saved.syncError, '⚠', 'var(--orange)', 6000); } catch (e) {}
  } else {
    try { showDhToast('Account added', saved?.name || handle, 'check', 'var(--green)', 3000); } catch (e) {}
  }
}

function socialAcctRemove(acctId) {
  const acct = socialAcctsLoad().find(a => a.id === acctId);
  _filesModal({
    title: 'Remove Account',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
    iconColor: '#E85D5D',
    message: 'Stop tracking <strong style="color:var(--offwhite)">' + (acct?.name || 'this account') + '</strong>? Its metric history will be deleted from DroneHub. The actual social account is not affected.',
    confirmText: 'Remove',
    danger: true,
    onConfirm: () => {
      socialAcctsSave(socialAcctsLoad().filter(a => a.id !== acctId));
      renderSocialAnalytics();
      try { showDhToast('Removed', acct?.name || '', 'check', 'var(--green)', 2000); } catch (e) {}
    },
  });
}
