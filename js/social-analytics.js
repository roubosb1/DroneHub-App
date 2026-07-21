// ── SOCIAL ANALYTICS ─────────────────────────────────────────────────────────
// Tracks company + client social accounts and their metrics.
// Account: {id, platform, handle, ownerType:'company'|'client', clientId,
//           name, avatar, url, followers, views, posts, lastSync,
//           history:[{date, followers, views, posts}]}

const SOCIAL_METRICS_API = '/.netlify/functions/social-metrics';

const SA_PLATFORMS = [
  { id: 'youtube',   label: 'YouTube',   color: '#FF0000', live: true,
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="var(--navy)"/></svg>' },
  { id: 'instagram', label: 'Instagram', color: '#E4405F', live: true,
    icon: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>' },
  { id: 'facebook',  label: 'Facebook',  color: '#1877F2', live: true,
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
      body: JSON.stringify({ platform: acct.platform, handle: acct.handle, acctId: acct.id }),
    });
    const data = await res.json();
    if (data.notConfigured) {
      if (!silent) try { showDhToast('Not connected yet', data.message || 'This platform needs API setup', '⚠', 'var(--orange)', 5000); } catch (e) {}
      return;
    }
    if (data.notConnected) {
      acct.metaConnected = false;
      socialAcctsSave(arr);
      if (!silent) try { showDhToast('Connect with Facebook', 'Open this account and click Connect to pull live Instagram/Facebook stats', 'ℹ️', 'var(--blue-bright)', 5000); } catch (e) {}
      return;
    }
    if (data.error) throw new Error(data.error);
    if (data.expiringSoon && !silent) try { showDhToast('Meta connection expiring soon', 'Reconnect with Facebook within a week to keep stats flowing', '⚠', 'var(--orange)', 6000); } catch (e) {}
    if (acct.platform === 'instagram' || acct.platform === 'facebook') acct.metaConnected = !data.discovery;
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
  return `<div class="card" ${!readOnly ? `onclick="socialAcctDetail('${acct.id}')"` : ''} style="padding:16px;min-width:0;${!readOnly ? 'cursor:pointer;' : ''}transition:border-color .15s" onmouseenter="this.style.borderColor='var(--border-bright)'" onmouseleave="this.style.borderColor=''">
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

// Full-page detail rendered inside the Analytics sub-tab
async function socialAcctDetail(acctId) {
  const acct = socialAcctsLoad().find(a => a.id === acctId);
  if (!acct) return;
  const cont = document.getElementById('social-sub-analytics');
  if (!cont) return;
  const p = _saPlatform(acct.platform);
  const hist = acct.history || [];
  const first = hist[0], last = hist[hist.length - 1];
  const growth = (field) => first && last && hist.length > 1 ? (last[field] || 0) - (first[field] || 0) : null;
  const growthChip = (field) => {
    const g = growth(field);
    if (g === null) return '';
    const up = g >= 0;
    return `<span style="font-size:10px;font-weight:700;color:${up ? 'var(--green)' : '#E85D5D'}">${up ? '▲' : '▼'} ${_saFmt(Math.abs(g))} in ${hist.length} days</span>`;
  };
  const owner = acct.ownerType === 'client'
    ? ((typeof clients !== 'undefined' ? clients : []).find(c => String(c.id) === String(acct.clientId))?.name || 'Client')
    : 'DroneHub Media Company';

  cont.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <button onclick="renderSocialAnalytics()" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:12px;font-weight:600;cursor:pointer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> All accounts
      </button>
      ${acct.avatar ? `<img src="${acct.avatar}" style="width:44px;height:44px;border-radius:50%">` : `<span style="width:44px;height:44px;border-radius:50%;background:${p.color}22;color:${p.color};display:inline-flex;align-items:center;justify-content:center">${p.icon}</span>`}
      <div style="flex:1;min-width:0">
        <div style="font-size:18px;font-weight:800;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${acct.name || acct.handle}</div>
        <div style="font-size:11px;color:${p.color};font-weight:600;display:flex;align-items:center;gap:4px;flex-wrap:wrap">${p.icon} ${p.label} · <span style="color:var(--muted)">${owner}</span>${acct.url ? ` · <a href="${acct.url}" target="_blank" style="color:var(--blue-bright);text-decoration:none">Open channel ↗</a>` : ''}</div>
      </div>
      <button onclick="socialAcctRefresh('${acct.id}').then(()=>socialAcctDetail('${acct.id}'))" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border-bright);background:transparent;color:var(--offwhite);font-size:12px;font-weight:600;cursor:pointer">⟳ Refresh</button>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:18px">
      <div style="background:var(--navy-mid);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--white)">${_saFmt(acct.followers)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">${acct.platform === 'youtube' ? 'Subscribers' : 'Followers'}</div>
        <div style="margin-top:3px">${growthChip('followers')}</div>
      </div>
      <div style="background:var(--navy-mid);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--white)">${_saFmt(acct.views)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">Total Views</div>
        <div style="margin-top:3px">${growthChip('views')}</div>
      </div>
      <div style="background:var(--navy-mid);border:1px solid var(--border);border-radius:12px;padding:16px;text-align:center">
        <div style="font-size:24px;font-weight:800;color:var(--white)">${_saFmt(acct.posts)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:3px">${acct.platform === 'youtube' ? 'Videos' : 'Posts'}</div>
        <div style="margin-top:3px">${growthChip('posts')}</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:18px">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${acct.platform === 'youtube' ? 'Subscriber' : 'Follower'} growth</div>
      ${_saSparkline(hist, 'followers', p.color)}
    </div>

    <div id="sa-detail-insights" style="margin-bottom:18px"></div>
    <div id="sa-detail-videos"><div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Loading recent videos…</div></div>`;

  if (acct.platform === 'instagram' || acct.platform === 'facebook') {
    _saRenderMetaSection(acct);
    return;
  }
  if (acct.platform !== 'youtube') {
    document.getElementById('sa-detail-videos').innerHTML = '';
    return;
  }

  _saRenderInsights(acct);
  _saRenderVideos(acct);
}

// ── Meta (Instagram/Facebook) connect + recent posts ─────────────────────────
function socialAcctConnectMeta(acctId) {
  window.location.href = '/.netlify/functions/meta-auth?step=init&acctId=' + encodeURIComponent(acctId);
}

async function _saRenderMetaSection(acct) {
  const insEl = document.getElementById('sa-detail-insights');
  const vidEl = document.getElementById('sa-detail-videos');
  if (!insEl || !vidEl) return;
  const p = _saPlatform(acct.platform);
  if (!acct.metaConnected) {
    insEl.innerHTML = `<div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div style="flex:1;min-width:220px">
        <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:4px">${acct.platform === 'instagram' ? 'Public stats shown — connect for full insights' : 'Connect ' + p.label + ' via Facebook'}</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.6">${acct.platform === 'instagram' ? 'Followers and recent posts come from public data. Connecting with the Facebook account that manages this Instagram unlocks reach, profile views, and demographics.' : 'Page followers and recent posts — pulled live from Meta. Sign in once with the Facebook account that manages this Page to grant read-only access.'}</div>
      </div>
      <button onclick="socialAcctConnectMeta('${acct.id}')" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:12px;border:1px solid rgba(24,119,242,.5);background:rgba(24,119,242,.1);color:#1877F2;font-size:12px;font-weight:700;cursor:pointer">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
        Connect with Facebook
      </button>
    </div>`;
  } else {
    insEl.innerHTML = '';
  }
  vidEl.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Loading recent posts…</div>`;
  try {
    const res = await fetch(SOCIAL_METRICS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: acct.platform, handle: acct.handle, action: 'media', acctId: acct.id }),
    });
    const data = await res.json();
    if (data.notConnected) {
      const arr = socialAcctsLoad(); const a = arr.find(x => x.id === acct.id);
      if (a) { a.metaConnected = false; socialAcctsSave(arr); }
      _saRenderMetaSection({ ...acct, metaConnected: false });
      return;
    }
    if (data.error) throw new Error(data.error);
    const media = data.media || [];
    if (!media.length) { vidEl.innerHTML = `<div class="card" style="text-align:center;color:var(--muted);font-size:12px">No recent posts found.</div>`; return; }
    vidEl.innerHTML = `<div class="card">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:12px">Recent posts <span style="color:var(--green);margin-left:6px">● Connected</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
        ${media.map(m => `
          <a href="${m.url}" target="_blank" style="text-decoration:none;background:var(--navy-mid);border:1px solid var(--border);border-radius:12px;overflow:hidden;display:block">
            ${m.thumb ? `<img src="${m.thumb}" style="width:100%;aspect-ratio:1;object-fit:cover;display:block" onerror="this.style.display='none'">` : `<div style="width:100%;aspect-ratio:1;display:flex;align-items:center;justify-content:center;color:${p.color}">${p.icon}</div>`}
            <div style="padding:10px">
              <div style="font-size:10px;color:var(--offwhite);line-height:1.4;height:28px;overflow:hidden">${(m.caption || '').replace(/</g, '&lt;') || '<span style="color:var(--muted)">No caption</span>'}</div>
              <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:10px;color:var(--muted)">
                <span>❤ ${_saFmt(m.likes)}</span><span>💬 ${_saFmt(m.comments)}</span><span>${m.date}</span>
              </div>
            </div>
          </a>`).join('')}
      </div>
    </div>`;
  } catch (err) {
    vidEl.innerHTML = `<div class="card" style="color:#E85D5D;font-size:12px">${err.message}</div>`;
  }
}

// ── Private channel analytics (watch time, daily views, traffic sources) ─────
function socialAcctConnectYt(acctId) {
  window.location.href = '/.netlify/functions/youtube-auth?step=init&acctId=' + encodeURIComponent(acctId);
}

// Selected analytics range, shared by channel and video views
let _saRange = '28';
const SA_RANGES = [
  { id: '7', label: '7d' },
  { id: '28', label: '28d' },
  { id: '90', label: '90d' },
  { id: '365', label: '1y' },
  { id: 'all', label: 'All' },
];
function _saRangeLabel() { return { '7': 'last 7 days', '28': 'last 28 days', '90': 'last 90 days', '365': 'last year', 'all': 'all time' }[_saRange] || ''; }
function _saRangePills(rerenderJs) {
  return `<div style="display:flex;gap:4px">
    ${SA_RANGES.map(r => `<button onclick="_saRange='${r.id}';${rerenderJs}" style="padding:4px 10px;border-radius:8px;border:1px solid ${_saRange === r.id ? 'var(--blue)' : 'var(--border)'};background:${_saRange === r.id ? 'rgba(91,141,239,.15)' : 'transparent'};color:${_saRange === r.id ? 'var(--blue-bright)' : 'var(--muted)'};font-size:10px;font-weight:700;cursor:pointer">${r.label}</button>`).join('')}
  </div>`;
}
function _saFmtDur(sec) {
  sec = Math.round(sec || 0);
  const m = Math.floor(sec / 60), s = sec % 60;
  return m + ':' + String(s).padStart(2, '0');
}
const SA_SRC_LABELS = { YT_SEARCH: 'YouTube search', SUBSCRIBER: 'Subscribers feed', EXT_URL: 'External links', RELATED_VIDEO: 'Suggested videos', NO_LINK_OTHER: 'Direct / other', PLAYLIST: 'Playlists', YT_CHANNEL: 'Channel pages', NOTIFICATION: 'Notifications', SHORTS: 'Shorts feed', YT_OTHER_PAGE: 'Other YouTube', ADVERTISING: 'Ads', END_SCREEN: 'End screens', HASHTAGS: 'Hashtags', SOUND_PAGE: 'Sound pages' };
function _saSourceBars(sources) {
  const top = (sources || []).slice(0, 6);
  if (!top.length) return '';
  const maxSrc = Math.max(...top.map(s => s.views), 1);
  return `<div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin:16px 0 8px">Where views came from</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${top.map(s => `
        <div style="display:flex;align-items:center;gap:10px">
          <span style="width:130px;font-size:11px;color:var(--offwhite);flex-shrink:0">${SA_SRC_LABELS[s.type] || s.type}</span>
          <div style="flex:1;height:14px;border-radius:7px;background:var(--navy-mid);overflow:hidden"><div style="height:100%;width:${Math.round(s.views / maxSrc * 100)}%;background:var(--blue);border-radius:7px"></div></div>
          <span style="width:52px;font-size:10px;color:var(--muted);text-align:right">${_saFmt(s.views)}</span>
        </div>`).join('')}
    </div>`;
}

async function _saRenderInsights(acct) {
  const el = document.getElementById('sa-detail-insights');
  if (!el) return;
  const p = _saPlatform(acct.platform);
  if (!acct.ytConnected) {
    el.innerHTML = `<div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
      <div style="flex:1;min-width:220px">
        <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:4px">Unlock full channel analytics</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.6">Watch time, daily views, subscriber changes, and traffic sources — the same numbers as YouTube Studio. The channel owner signs in with Google once to grant read-only access.</div>
      </div>
      <button onclick="socialAcctConnectYt('${acct.id}')" style="display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border-radius:12px;border:1px solid rgba(66,133,244,.5);background:rgba(66,133,244,.1);color:#4285F4;font-size:12px;font-weight:700;cursor:pointer">
        <svg width="15" height="15" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.1 0 5.8 1.1 7.9 2.9l5.9-5.9C34.3 3.4 29.4 1.5 24 1.5 14.9 1.5 7.1 7 3.4 14.9l6.9 5.4C12.2 13.5 17.6 9.5 24 9.5z"/><path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h12.7c-.5 2.9-2.2 5.3-4.6 6.9l7.1 5.5C43.5 37 46.5 31.2 46.5 24.5z"/><path fill="#FBBC05" d="M10.3 28.7c-.6-1.7-.9-3.5-.9-5.4 0-1.9.3-3.7.9-5.4l-6.9-5.4C1.8 15.7 1 19.7 1 24s.8 8.3 2.4 11.7l6.9-5.3z"/><path fill="#34A853" d="M24 46.5c5.4 0 9.9-1.8 13.2-4.8l-7.1-5.5c-1.8 1.2-4.1 1.9-6.1 1.9-6.4 0-11.8-4-13.7-9.5l-6.9 5.3C7.1 41 14.9 46.5 24 46.5z"/></svg>
        Connect channel analytics
      </button>
    </div>`;
    return;
  }
  el.innerHTML = `<div class="card"><div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Loading channel analytics…</div></div>`;
  try {
    const res = await fetch(SOCIAL_METRICS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'youtube', handle: acct.handle, action: 'insights', acctId: acct.id, range: _saRange }),
    });
    const data = await res.json();
    if (data.notConnected) {
      const arr = socialAcctsLoad();
      const a = arr.find(x => x.id === acct.id);
      if (a) { a.ytConnected = false; socialAcctsSave(arr); }
      _saRenderInsights({ ...acct, ytConnected: false });
      return;
    }
    if (data.error) throw new Error(data.error);
    const days = data.days || [];
    const totViews = days.reduce((s, d) => s + d.views, 0);
    const watchHrs = Math.round(days.reduce((s, d) => s + d.watchMin, 0) / 60 * 10) / 10;
    const subsNet = days.reduce((s, d) => s + d.subsGained - d.subsLost, 0);
    const el2 = document.getElementById('sa-detail-insights');
    if (!el2) return;
    const rerender = `_saRenderInsights(socialAcctsLoad().find(a=>a.id==='${acct.id}'))`;
    el2.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Channel analytics · ${_saRangeLabel()} <span style="color:var(--green);margin-left:6px">● Connected</span></div>
          ${_saRangePills(rerender)}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:16px">
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:var(--white)">${_saFmt(totViews)}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Views</div>
          </div>
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:var(--white)">${watchHrs.toLocaleString()}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Watch hours</div>
          </div>
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:${subsNet >= 0 ? 'var(--green)' : '#E85D5D'}">${subsNet >= 0 ? '+' : ''}${subsNet}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Subscribers</div>
          </div>
        </div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${data.granularity === 'month' ? 'Monthly' : 'Daily'} views</div>
        ${_saSparkline(days.map(d => ({ date: d.date, v: d.views })), 'v', p.color || '#FF0000')}
        ${_saSourceBars(data.sources)}
      </div>`;
  } catch (err) {
    const el2 = document.getElementById('sa-detail-insights');
    if (el2) el2.innerHTML = `<div class="card"><div style="padding:14px;text-align:center;color:#E85D5D;font-size:12px">Channel analytics: ${err.message}</div></div>`;
  }
}

async function _saRenderVideos(acct) {
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
      vc.innerHTML = `<div class="card"><div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Recent uploads</div>
        <div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">${data.error || 'No videos found'}</div></div>`;
      return;
    }
    window._saVideosCache = window._saVideosCache || {};
    window._saVideosCache[acct.id] = vids;
    const avgViews = Math.round(vids.reduce((s, v) => s + v.views, 0) / vids.length);
    const likeRate = (vids.reduce((s, v) => s + v.likes, 0) / Math.max(vids.reduce((s, v) => s + v.views, 0), 1) * 100).toFixed(1);
    vc.innerHTML = `<div class="card">
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
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Recent uploads — click one for its analytics</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${vids.map(v => `
          <div onclick="socialVideoDetail('${acct.id}','${v.id}')" style="display:flex;gap:10px;align-items:center;padding:8px;border-radius:10px;background:var(--navy-mid);cursor:pointer;transition:background .15s" onmouseenter="this.style.background='var(--navy-lift)'" onmouseleave="this.style.background='var(--navy-mid)'">
            ${v.thumb ? `<img src="${v.thumb}" style="width:80px;height:45px;border-radius:6px;object-fit:cover;flex-shrink:0">` : ''}
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:3px">${v.publishedAt} · ${_saFmt(v.views)} views · ${_saFmt(v.likes)} likes · ${_saFmt(v.comments)} comments</div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
          </div>`).join('')}
      </div>
    </div>`;
  } catch (err) {
    const vc = document.getElementById('sa-detail-videos');
    if (vc) vc.innerHTML = `<div class="card"><div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Could not load videos: ${err.message}</div></div>`;
  }
}

// ── Per-video analytics page ──────────────────────────────────────────────────
async function socialVideoDetail(acctId, videoId) {
  const acct = socialAcctsLoad().find(a => a.id === acctId);
  const cont = document.getElementById('social-sub-analytics');
  if (!acct || !cont) return;
  const vid = (window._saVideosCache?.[acctId] || []).find(v => v.id === videoId);
  if (!vid) { socialAcctDetail(acctId); return; }

  cont.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <button onclick="socialAcctDetail('${acctId}')" style="display:flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:12px;font-weight:600;cursor:pointer">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg> ${acct.name || 'Channel'}
      </button>
    </div>
    <div style="display:flex;gap:16px;align-items:flex-start;margin-bottom:18px;flex-wrap:wrap">
      ${vid.thumb ? `<img src="${vid.thumb}" style="width:200px;max-width:100%;border-radius:12px">` : ''}
      <div style="flex:1;min-width:220px">
        <div style="font-size:17px;font-weight:800;color:var(--white);line-height:1.4;margin-bottom:6px">${vid.title}</div>
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px">Published ${vid.publishedAt}</div>
        <a href="https://www.youtube.com/watch?v=${vid.id}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:12px;font-weight:600;text-decoration:none">Watch on YouTube ↗</a>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:18px">
      <div style="background:var(--navy-mid);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--white)">${_saFmt(vid.views)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Views · lifetime</div>
      </div>
      <div style="background:var(--navy-mid);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--white)">${_saFmt(vid.likes)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Likes</div>
      </div>
      <div style="background:var(--navy-mid);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--white)">${_saFmt(vid.comments)}</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Comments</div>
      </div>
      <div style="background:var(--navy-mid);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
        <div style="font-size:22px;font-weight:800;color:var(--white)">${(vid.likes / Math.max(vid.views, 1) * 100).toFixed(1)}%</div>
        <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Like rate</div>
      </div>
    </div>
    <div id="sa-video-insights"></div>`;

  const el = document.getElementById('sa-video-insights');
  if (!acct.ytConnected) {
    el.innerHTML = `<div class="card" style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Connect channel analytics on the channel page to see this video's watch time, daily views, and traffic sources.</div>`;
    return;
  }
  el.innerHTML = `<div class="card"><div style="padding:16px;text-align:center;color:var(--muted);font-size:12px">Loading video analytics…</div></div>`;
  try {
    const res = await fetch(SOCIAL_METRICS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform: 'youtube', handle: acct.handle, action: 'videoInsights', acctId: acct.id, videoId, range: _saRange }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.notConnected) { el.innerHTML = ''; return; }
    const days = data.days || [];
    const t = data.totals || { views: days.reduce((s, d) => s + d.views, 0), watchMin: days.reduce((s, d) => s + d.watchMin, 0), avgViewSec: 0, subsGained: days.reduce((s, d) => s + d.subsGained, 0) };
    const p = _saPlatform(acct.platform);
    const rerender = `socialVideoDetail('${acctId}','${videoId}')`;
    el.innerHTML = `
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Video analytics · ${_saRangeLabel()} <span style="color:var(--green);margin-left:6px">● Connected</span></div>
          ${_saRangePills(rerender)}
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px;margin-bottom:16px">
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:var(--white)">${_saFmt(t.views)}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Views</div>
          </div>
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:var(--white)">${(Math.round((t.watchMin || 0) / 60 * 10) / 10).toLocaleString()}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Watch hours</div>
          </div>
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:var(--white)">${_saFmtDur(t.avgViewSec)}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Avg view duration</div>
          </div>
          <div style="background:var(--navy-mid);border-radius:12px;padding:14px;text-align:center">
            <div style="font-size:20px;font-weight:800;color:${(t.subsGained || 0) >= 0 ? 'var(--green)' : '#E85D5D'}">+${t.subsGained || 0}</div>
            <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-top:2px">Subs gained</div>
          </div>
        </div>
        <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">${data.granularity === 'month' ? 'Monthly' : 'Daily'} views</div>
        ${_saSparkline(days.map(d => ({ date: d.date, v: d.views })), 'v', p.color || '#FF0000')}
        ${_saSourceBars(data.sources)}
      </div>`;
  } catch (err) {
    if (el) el.innerHTML = `<div class="card"><div style="padding:14px;text-align:center;color:#E85D5D;font-size:12px">Video analytics: ${err.message}</div></div>`;
  }
}

// Handle return from YouTube OAuth (#yt-connected=acctId)
(function _saCheckYtOAuthReturn() {
  const hash = window.location.hash;
  if (!hash) return;
  if (hash.startsWith('#yt-connected=')) {
    const acctId = decodeURIComponent(hash.replace('#yt-connected=', ''));
    window.location.hash = '';
    const arr = socialAcctsLoad();
    const a = arr.find(x => x.id === acctId);
    if (a) { a.ytConnected = true; socialAcctsSave(arr); }
    setTimeout(() => {
      try {
        showDhToast('Channel analytics connected', a?.name || '', '✅', 'var(--green)', 4000);
        showPane('social');
        setSocialSubTab('analytics');
        socialAcctDetail(acctId);
      } catch (e) {}
    }, 600);
  } else if (hash.startsWith('#yt-error=') || hash === '#yt-denied') {
    const msg = hash === '#yt-denied' ? 'Access denied' : decodeURIComponent(hash.replace('#yt-error=', ''));
    window.location.hash = '';
    setTimeout(() => { try { showDhToast('YouTube connection failed', msg, '⚠', 'var(--orange)', 6000); } catch (e) {} }, 600);
  } else if (hash.startsWith('#meta-connected=')) {
    const acctId = decodeURIComponent(hash.replace('#meta-connected=', ''));
    window.location.hash = '';
    const arr = socialAcctsLoad();
    const a = arr.find(x => x.id === acctId);
    if (a) { a.metaConnected = true; socialAcctsSave(arr); }
    setTimeout(() => {
      try {
        showDhToast('Meta account connected', a?.name || '', '✅', 'var(--green)', 4000);
        showPane('social');
        setSocialSubTab('analytics');
        if (a) socialAcctRefresh(acctId, true).then(() => socialAcctDetail(acctId));
        else socialAcctDetail(acctId);
      } catch (e) {}
    }, 600);
  } else if (hash.startsWith('#meta-error=') || hash === '#meta-denied') {
    const msg = hash === '#meta-denied' ? 'Access denied' : decodeURIComponent(hash.replace('#meta-error=', ''));
    window.location.hash = '';
    setTimeout(() => { try { showDhToast('Meta connection failed', msg, '⚠', 'var(--orange)', 6000); } catch (e) {} }, 600);
  }
})();

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
    if (company.length) html += section('DroneHub Media Company', 'var(--blue-bright)', company.map(a => socialAcctCardHtml(a, false)).join(''));
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
