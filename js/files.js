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
        <button onclick="filesNewFolder()" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:1px solid rgba(245,200,66,.4);background:rgba(245,200,66,.06);color:#F5C842;font-size:11px;font-weight:700;cursor:pointer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/><line x1="12" y1="11" x2="12" y2="17"/><line x1="9" y1="14" x2="15" y2="14"/></svg>
          New Folder
        </button>
        <button onclick="filesUpload()" style="display:flex;align-items:center;gap:6px;padding:6px 14px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Upload
        </button>
        <input type="file" id="files-upload-input" multiple style="display:none" onchange="filesUploadSelected(this)">
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
        ${!isFolder ? `<button onclick="event.stopPropagation();filesDownload('${f.id}')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(91,141,239,.4);background:rgba(91,141,239,.06);color:var(--blue-bright);font-size:10px;cursor:pointer;white-space:nowrap" title="Download file"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download</button>` : ''}
        ${!isFolder ? `<button onclick="event.stopPropagation();filesCopyLink('${f.id}','${(f.webViewLink || '').replace(/'/g, "\\'")}')" style="padding:4px 10px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:10px;cursor:pointer;white-space:nowrap" title="Copy link">Copy Link</button>` : ''}
        ${!isFolder ? `<button onclick="event.stopPropagation();filesUseAsLink('${(f.webViewLink || '').replace(/'/g, "\\'")}')" style="padding:4px 10px;border-radius:6px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.06);color:var(--green);font-size:10px;cursor:pointer;white-space:nowrap" title="Use in tracker">Use Link</button>` : ''}
        <button onclick="event.stopPropagation();filesRename('${f.id}','${(f.name || '').replace(/'/g, "\\'")}')" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:10px;cursor:pointer;white-space:nowrap" title="Rename"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg></button>
        <button onclick="event.stopPropagation();filesTrash('${f.id}','${(f.name || '').replace(/'/g, "\\'")}')" style="padding:4px 8px;border-radius:6px;border:1px solid rgba(232,93,93,.35);background:transparent;color:#E85D5D;font-size:10px;cursor:pointer;white-space:nowrap" title="Move to trash"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>
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

async function filesDownload(fileId) {
  try { showDhToast('Downloading…', 'Preparing your file…', '⬇', 'var(--blue-bright)', 3000); } catch (e) {}
  try {
    const res = await fetch(_GDRIVE_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'download', fileId }),
    });
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const data = await res.json();
      if (data.tooLarge) {
        // File too large for proxy — use hidden iframe so it still doesn't open a visible tab
        const dl = data.webContentLink || '';
        if (!dl) { try { showDhToast('Download failed', 'No download link for this file', '⚠', 'var(--orange)', 3000); } catch (e) {} return; }
        try { showDhToast('Large file', 'Downloading via Google Drive…', '⬇', 'var(--blue-bright)', 3000); } catch (e) {}
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        document.body.appendChild(iframe);
        iframe.src = dl;
        setTimeout(() => iframe.remove(), 120000);
        return;
      }
      if (data.error) { try { showDhToast('Download failed', data.error, '⚠', 'var(--orange)', 3000); } catch (e) {} return; }
    }
    // Binary response — save as file
    const blob = await res.blob();
    const cd = res.headers.get('content-disposition') || '';
    const nameMatch = cd.match(/filename="([^"]+)"/);
    const name = nameMatch ? nameMatch[1] : 'download';
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    try { showDhToast('Downloaded', name, 'check', 'var(--green)', 2000); } catch (e) {}
  } catch (err) {
    try { showDhToast('Download failed', err.message || 'Could not download file', '⚠', 'var(--orange)', 3000); } catch (e) {}
  }
}

// ── Folder / file management ─────────────────────────────────────────────────
async function filesNewFolder() {
  const name = prompt('New folder name:');
  if (!name || !name.trim()) return;
  try {
    const res = await _filesApi('createFolder', { name: name.trim(), parentId: _filesCurrentFolder });
    if (res.error) throw new Error(res.error);
    try { showDhToast('Folder created', res.name || name.trim(), 'check', 'var(--green)', 2500); } catch (e) {}
    filesLoadFolder(_filesCurrentFolder);
  } catch (err) {
    try { showDhToast('Create failed', err.message || 'Could not create folder', '⚠', 'var(--orange)', 4000); } catch (e) {}
  }
}

async function filesRename(fileId, currentName) {
  const name = prompt('Rename to:', currentName || '');
  if (!name || !name.trim() || name.trim() === currentName) return;
  try {
    const res = await _filesApi('rename', { fileId, name: name.trim() });
    if (res.error) throw new Error(res.error);
    try { showDhToast('Renamed', name.trim(), 'check', 'var(--green)', 2500); } catch (e) {}
    filesLoadFolder(_filesCurrentFolder);
  } catch (err) {
    try { showDhToast('Rename failed', err.message || 'Could not rename', '⚠', 'var(--orange)', 4000); } catch (e) {}
  }
}

async function filesTrash(fileId, name) {
  if (!confirm('Move "' + (name || 'this item') + '" to the Google Drive trash?\n\nYou can restore it from drive.google.com → Trash within 30 days.')) return;
  try {
    const res = await _filesApi('trash', { fileId });
    if (res.error) throw new Error(res.error);
    try { showDhToast('Moved to trash', name || '', 'check', 'var(--green)', 2500); } catch (e) {}
    filesLoadFolder(_filesCurrentFolder);
  } catch (err) {
    try { showDhToast('Trash failed', err.message || 'Could not move to trash', '⚠', 'var(--orange)', 4000); } catch (e) {}
  }
}

// ── Upload ───────────────────────────────────────────────────────────────────
function filesUpload() {
  document.getElementById('files-upload-input')?.click();
}

async function filesUploadSelected(input) {
  const files = [...(input.files || [])];
  input.value = '';
  if (!files.length) return;
  for (const file of files) {
    await _filesUploadOne(file);
  }
  _filesUploadBarRemove();
  filesLoadFolder(_filesCurrentFolder);
}

function _filesUploadBar(name, pct) {
  let bar = document.getElementById('files-upload-bar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'files-upload-bar';
    bar.style.cssText = 'position:fixed;bottom:20px;right:20px;z-index:9000;background:var(--navy-card);border:1px solid var(--border-bright);border-radius:12px;padding:12px 16px;min-width:260px;box-shadow:0 8px 24px rgba(0,0,0,.5)';
    document.body.appendChild(bar);
  }
  bar.innerHTML = `
    <div style="font-size:12px;font-weight:600;color:var(--offwhite);margin-bottom:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:280px">Uploading ${name}</div>
    <div style="height:6px;border-radius:3px;background:var(--navy-lift);overflow:hidden">
      <div style="height:100%;width:${pct}%;background:var(--blue-bright);border-radius:3px;transition:width .2s"></div>
    </div>
    <div style="font-size:10px;color:var(--muted);margin-top:5px">${pct}%</div>`;
}

function _filesUploadBarRemove() {
  document.getElementById('files-upload-bar')?.remove();
}

function _filesUploadOne(file) {
  return new Promise(async (resolve) => {
    try {
      _filesUploadBar(file.name, 0);
      const init = await _filesApi('uploadInit', {
        name: file.name,
        mimeType: file.type || 'application/octet-stream',
        folderId: _filesCurrentFolder,
        size: file.size,
      });
      if (init.error || !init.uploadUrl) {
        try { showDhToast('Upload failed', init.error || 'Could not start upload', '⚠', 'var(--orange)', 5000); } catch (e) {}
        resolve(); return;
      }
      // Browser streams the bytes straight to Google's upload session URL
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', init.uploadUrl);
      xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) _filesUploadBar(file.name, Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { showDhToast('Uploaded', file.name, 'check', 'var(--green)', 3000); } catch (e) {}
        } else {
          try { showDhToast('Upload failed', file.name + ' (HTTP ' + xhr.status + ')', '⚠', 'var(--orange)', 5000); } catch (e) {}
        }
        resolve();
      };
      xhr.onerror = () => {
        try { showDhToast('Upload failed', 'Network error uploading ' + file.name, '⚠', 'var(--orange)', 5000); } catch (e) {}
        resolve();
      };
      xhr.send(file);
    } catch (err) {
      try { showDhToast('Upload failed', err.message || 'Unknown error', '⚠', 'var(--orange)', 5000); } catch (e) {}
      resolve();
    }
  });
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
