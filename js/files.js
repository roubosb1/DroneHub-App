// ── Files Tab — Google Drive / Dropbox / NAS browser ────────────────────────
let _filesProvider = 'gdrive';
let _filesCurrentFolder = 'root';
let _filesBreadcrumb = [{ id: 'root', name: 'My Drive' }];
let _filesConnected = false;
let _filesEmail = '';
let _filesCache = {};

const _GDRIVE_PROXY = '/.netlify/functions/gdrive-proxy';
const _GDRIVE_AUTH  = '/.netlify/functions/gdrive-auth';

async function _filesApi(action, data = {}) {
  const res = await fetch(_GDRIVE_PROXY, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...data }),
  });
  return res.json();
}

async function filesInit() {
  const hash = window.location.hash;
  if (hash.startsWith('#gdrive-connected=')) {
    _filesConnected = true;
    _filesEmail = decodeURIComponent(hash.replace('#gdrive-connected=', ''));
    window.location.hash = '';
    try { showDhToast('Google Drive connected', `Signed in as ${_filesEmail}`, 'check', 'var(--green)'); } catch (e) {}
  }
  if (hash.startsWith('#gdrive-error=') || hash === '#gdrive-denied') {
    const msg = hash === '#gdrive-denied' ? 'Access denied' : decodeURIComponent(hash.replace('#gdrive-error=', ''));
    window.location.hash = '';
    try { showDhToast('Drive error', msg, 'alert-triangle', 'var(--red)'); } catch (e) {}
  }
}

async function renderFiles() {
  const pane = document.getElementById('pane-files');
  if (!pane) return;

  if (!_filesConnected) {
    const status = await _filesApi('status');
    _filesConnected = status.connected || false;
    _filesEmail = status.email || '';
  }

  const header = document.getElementById('files-header');
  const content = document.getElementById('files-content');

  if (!_filesConnected) {
    header.innerHTML = '';
    content.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:60px 20px;text-align:center">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
        <div style="font-size:16px;font-weight:700;color:var(--offwhite);margin-top:16px">Connect your file storage</div>
        <div style="font-size:13px;color:var(--muted);margin-top:8px;max-width:400px">Browse files, copy shareable links, and connect deliverables to projects — all without leaving the app.</div>
        <div style="display:flex;gap:10px;margin-top:24px;flex-wrap:wrap;justify-content:center">
          <button onclick="filesConnectGDrive()" style="display:flex;align-items:center;gap:8px;padding:12px 24px;border-radius:12px;border:1px solid rgba(66,133,244,.5);background:rgba(66,133,244,.08);color:#4285F4;font-size:13px;font-weight:700;cursor:pointer">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M4.433 22l-1.766-3.062 7.57-13.1h3.53L6.2 18.938z" fill="#0066DA"/><path d="M21.567 22H8.1l1.766-3.062h9.936L21.567 22z" fill="#00AC47"/><path d="M23.35 18.938L19.583 12l-3.766 6.938h-3.531l5.533-9.6L23.35 18.938z" fill="#EA4335"/><path d="M8.017 5.838L6.2 2.776 10.237 5.838z" fill="#00832D"/><path d="M15.817 5.838h-3.531L8.017 5.838 10.237 2h3.53z" fill="#2684FC"/><path d="M15.817 5.838L19.583 12l-1.766 3.062L14.05 8.9z" fill="#FFBA00"/></svg>
            Google Drive
          </button>
          <button onclick="filesConnectDropbox()" style="display:flex;align-items:center;gap:8px;padding:12px 24px;border-radius:12px;border:1px solid rgba(0,97,255,.5);background:rgba(0,97,255,.08);color:#0061FF;font-size:13px;font-weight:700;cursor:pointer">
            <svg width="18" height="18" viewBox="0 0 24 24"><path d="M6 2l6 3.75L6 9.5 0 5.75z" fill="#0061FF"/><path d="M18 2l6 3.75-6 3.75-6-3.75z" fill="#0061FF"/><path d="M0 13.25L6 9.5l6 3.75L6 17z" fill="#0061FF"/><path d="M12 13.25l6-3.75 6 3.75-6 3.75z" fill="#0061FF"/><path d="M6 18.25l6-3.75 6 3.75-6 3.75z" fill="#0061FF"/></svg>
            Dropbox
          </button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:16px;opacity:.6">NAS server support coming soon</div>
      </div>`;
    return;
  }

  // Connected — render browser
  header.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="16" height="16" viewBox="0 0 24 24"><path d="M4.433 22l-1.766-3.062 7.57-13.1h3.53L6.2 18.938z" fill="#0066DA"/><path d="M21.567 22H8.1l1.766-3.062h9.936L21.567 22z" fill="#00AC47"/><path d="M23.35 18.938L19.583 12l-3.766 6.938h-3.531l5.533-9.6L23.35 18.938z" fill="#EA4335"/></svg>
        <span style="font-size:12px;color:var(--muted)">${_filesEmail}</span>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <div style="position:relative">
          <input type="text" id="files-search" placeholder="Search files…" onkeydown="if(event.key==='Enter')filesSearch()" style="padding:6px 30px 6px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--offwhite);width:200px">
          <svg onclick="filesSearch()" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);cursor:pointer" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        </div>
        <button onclick="filesDisconnect()" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">Disconnect</button>
      </div>
    </div>`;

  filesRenderBreadcrumb();
  filesLoadFolder(_filesCurrentFolder);
}

function filesRenderBreadcrumb() {
  const el = document.getElementById('files-breadcrumb');
  if (!el) return;
  el.innerHTML = _filesBreadcrumb.map((b, i) => {
    const isLast = i === _filesBreadcrumb.length - 1;
    return `<span style="cursor:${isLast ? 'default' : 'pointer'};color:${isLast ? 'var(--offwhite)' : 'var(--blue-bright)'};font-weight:${isLast ? '600' : '400'}" ${isLast ? '' : `onclick="filesNavigateBreadcrumb(${i})"`}>${b.name}</span>`;
  }).join('<span style="color:var(--muted);margin:0 4px">/</span>');
}

function filesNavigateBreadcrumb(idx) {
  _filesBreadcrumb = _filesBreadcrumb.slice(0, idx + 1);
  _filesCurrentFolder = _filesBreadcrumb[idx].id;
  filesRenderBreadcrumb();
  filesLoadFolder(_filesCurrentFolder);
}

async function filesLoadFolder(folderId) {
  const list = document.getElementById('files-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Loading…</div>';

  try {
    const data = await _filesApi('list', { folderId });
    if (data.error) { list.innerHTML = `<div style="padding:20px;color:var(--red);font-size:12px">${data.error}</div>`; return; }
    const files = data.files || [];
    if (!files.length) {
      list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">This folder is empty</div>';
      return;
    }
    _filesRenderList(files);
  } catch (err) {
    list.innerHTML = `<div style="padding:20px;color:var(--red);font-size:12px">Error: ${err.message}</div>`;
  }
}

function _filesRenderList(files) {
  const list = document.getElementById('files-list');
  if (!list) return;
  list.innerHTML = _filesRowsHtml(files);
}

function _filesRowsHtml(files) {
  return files.map(f => {
    const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
    const icon = isFolder
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F5C842" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>'
      : _filesGetIcon(f.mimeType, f.name);
    const size = f.size ? _filesFormatSize(f.size) : '';
    const date = f.modifiedTime ? new Date(f.modifiedTime).toLocaleDateString('en-CA') : '';
    const onclick = isFolder
      ? `filesOpenFolder('${f.id}','${(f.name || '').replace(/'/g, "\\'")}')`
      : `filesCopyLink('${f.id}','${(f.webViewLink || '').replace(/'/g, "\\'")}')`;

    return `<div onclick="${onclick}" style="display:flex;align-items:center;padding:10px 12px;gap:10px;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s" onmouseenter="this.style.background='var(--navy-lift)'" onmouseleave="this.style.background='transparent'">
      <div style="flex:none;width:24px;display:flex;align-items:center;justify-content:center">${icon}</div>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:500;color:var(--offwhite);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
        <div style="font-size:10px;color:var(--muted)">${date}${size ? ' · ' + size : ''}</div>
      </div>
      <div style="flex:none;display:flex;gap:4px">
        ${!isFolder ? `<button onclick="event.stopPropagation();filesCopyLink('${f.id}','${(f.webViewLink || '').replace(/'/g, "\\'")}')" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:10px;cursor:pointer;white-space:nowrap" title="Copy link">Copy Link</button>` : ''}
        ${!isFolder ? `<button onclick="event.stopPropagation();filesUseAsLink('${(f.webViewLink || '').replace(/'/g, "\\'")}')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.06);color:var(--green);font-size:10px;cursor:pointer;white-space:nowrap" title="Use in tracker">Use Link</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

function _filesGetIcon(mimeType, name) {
  const mt = (mimeType || '').toLowerCase();
  const ext = (name || '').split('.').pop().toLowerCase();
  if (mt.includes('video') || ['mp4', 'mov', 'avi', 'mkv'].includes(ext))
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
  if (mt.includes('image') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic'].includes(ext))
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22D97A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>';
  if (mt.includes('pdf') || ext === 'pdf')
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#E85D3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
  if (mt.includes('spreadsheet') || ['xlsx', 'xls', 'csv', 'numbers'].includes(ext))
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#00AC47" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>';
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
}

function _filesFormatSize(bytes) {
  bytes = parseInt(bytes);
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + ' MB';
  return (bytes / 1073741824).toFixed(1) + ' GB';
}

function filesOpenFolder(folderId, name) {
  _filesCurrentFolder = folderId;
  _filesBreadcrumb.push({ id: folderId, name });
  filesRenderBreadcrumb();
  filesLoadFolder(folderId);
}

function filesCopyLink(fileId, webViewLink) {
  if (webViewLink) {
    navigator.clipboard.writeText(webViewLink).then(() => {
      try { showDhToast('Link copied', 'File link copied to clipboard', 'check', 'var(--green)'); } catch (e) {}
    }).catch(() => {
      prompt('Copy this link:', webViewLink);
    });
    return;
  }
  _filesApi('link', { fileId }).then(data => {
    const link = data.webViewLink || data.webContentLink || '';
    if (link) {
      navigator.clipboard.writeText(link).then(() => {
        try { showDhToast('Link copied', 'File link copied to clipboard', 'check', 'var(--green)'); } catch (e) {}
      }).catch(() => { prompt('Copy this link:', link); });
    }
  });
}

function filesUseAsLink(link) {
  if (!link) return;
  _filesSelectedLink = link;
  const modal = document.createElement('div');
  modal.id = 'files-use-link-modal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center';
  modal.innerHTML = `
    <div style="background:var(--navy);border:1px solid var(--border-bright);border-radius:16px;padding:20px;width:340px;max-width:90vw">
      <div style="font-size:14px;font-weight:700;color:var(--offwhite);margin-bottom:12px">Use link in…</div>
      <div style="display:flex;flex-direction:column;gap:6px">
        <button onclick="filesInsertLink('download')" style="padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:12px;cursor:pointer;text-align:left">Download Link (tracker)</button>
        <button onclick="filesInsertLink('review')" style="padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:12px;cursor:pointer;text-align:left">Review Link (video review)</button>
        <button onclick="filesInsertLink('dropbox')" style="padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:12px;cursor:pointer;text-align:left">Dropbox/Browse Link (tracker)</button>
        <button onclick="filesInsertLink('copy')" style="padding:10px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:12px;cursor:pointer;text-align:left">Just copy to clipboard</button>
      </div>
      <button onclick="document.getElementById('files-use-link-modal').remove()" style="margin-top:10px;padding:8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer;width:100%">Cancel</button>
    </div>`;
  document.body.appendChild(modal);
}

let _filesSelectedLink = '';

function filesInsertLink(target) {
  const link = _filesSelectedLink;
  document.getElementById('files-use-link-modal')?.remove();
  if (!link) return;

  if (target === 'copy') {
    navigator.clipboard.writeText(link).catch(() => prompt('Copy:', link));
    try { showDhToast('Copied', 'Link copied to clipboard', 'check', 'var(--green)'); } catch (e) {}
    return;
  }

  // Store for use when opening tracker modal
  localStorage.setItem('dh_pending_file_link', JSON.stringify({ link, target, ts: Date.now() }));
  try { showDhToast('Link ready', 'Open a project in the tracker to insert this link', 'check', 'var(--blue-bright)'); } catch (e) {}
}

let _filesSearchQuery = '';
let _filesSearchPageToken = '';

async function filesSearch() {
  const q = document.getElementById('files-search')?.value.trim();
  if (!q) { filesLoadFolder(_filesCurrentFolder); return; }
  const list = document.getElementById('files-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">Searching…</div>';

  try {
    const data = await _filesApi('search', { query: q });
    if (data.error) { list.innerHTML = `<div style="padding:20px;color:var(--red);font-size:12px">${data.error}</div>`; return; }
    const files = data.files || [];
    if (!files.length) {
      list.innerHTML = `<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No files found for "${q}"</div>`;
      return;
    }
    _filesSearchQuery = q;
    _filesSearchPageToken = data.nextPageToken || '';
    _filesBreadcrumb = [{ id: 'root', name: 'My Drive' }, { id: 'search', name: `Search: ${q}` }];
    filesRenderBreadcrumb();
    _filesRenderList(files);
    _filesAppendLoadMore();
  } catch (err) {
    list.innerHTML = `<div style="padding:20px;color:var(--red);font-size:12px">Error: ${err.message}</div>`;
  }
}

function _filesAppendLoadMore() {
  const list = document.getElementById('files-list');
  if (!list || !_filesSearchPageToken) return;
  const btn = document.createElement('div');
  btn.id = 'files-load-more';
  btn.innerHTML = `<button onclick="filesSearchMore()" style="width:100%;padding:12px;border:none;background:transparent;color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">Load more results ↓</button>`;
  list.appendChild(btn);
}

async function filesSearchMore() {
  const list = document.getElementById('files-list');
  const moreBtn = document.getElementById('files-load-more');
  if (!list || !_filesSearchQuery || !_filesSearchPageToken) return;
  if (moreBtn) moreBtn.innerHTML = '<div style="padding:12px;text-align:center;color:var(--muted);font-size:12px">Loading…</div>';

  try {
    const data = await _filesApi('search', { query: _filesSearchQuery, pageToken: _filesSearchPageToken });
    moreBtn?.remove();
    if (data.error) return;
    const files = data.files || [];
    _filesSearchPageToken = data.nextPageToken || '';
    const wrap = document.createElement('div');
    wrap.innerHTML = _filesRowsHtml(files);
    while (wrap.firstChild) list.appendChild(wrap.firstChild);
    _filesAppendLoadMore();
  } catch (err) {
    moreBtn?.remove();
  }
}

function filesConnectGDrive() {
  window.location.href = _GDRIVE_AUTH + '?step=init';
}

function filesConnectDropbox() {
  try { showDhToast('Coming soon', 'Dropbox integration is in development', 'alert-triangle', 'var(--orange)'); } catch (e) {
    alert('Dropbox integration coming soon');
  }
}

function filesDisconnect() {
  if (!confirm('Disconnect Google Drive? You can reconnect anytime.')) return;
  _filesConnected = false;
  _filesEmail = '';
  _filesCurrentFolder = 'root';
  _filesBreadcrumb = [{ id: 'root', name: 'My Drive' }];
  renderFiles();
}
