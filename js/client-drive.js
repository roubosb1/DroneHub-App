// ── CLIENT DRIVE PROJECTS ────────────────────────────────────────────────────
// Links Google Drive folders to a client as "projects by address" so the
// client can browse and download their files from their portal.
// Stored on the client record: c.driveProjects = [{folderId, name, address,
// shared, linkedAt}]

function _cdClient(clientId) {
  return (typeof clients !== 'undefined' ? clients : []).find(c => String(c.id) === String(clientId));
}

// "8002 East Vista Bonita Drive - Scottsdale, AZ - Katrina Barrett" → address only
function _cdParseAddress(folderName, clientName) {
  let addr = folderName || '';
  if (clientName) {
    const re = new RegExp('\\s*[-–—]\\s*' + clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$', 'i');
    addr = addr.replace(re, '');
  }
  return addr.trim();
}

// ── Admin: scan Drive for a client's project folders ─────────────────────────
async function cdScanDrive(clientId) {
  const c = _cdClient(clientId);
  if (!c) return;
  try { showDhToast('Scanning Drive…', 'Looking for folders matching "' + c.name + '"', '⟳', 'var(--blue-bright)', 3000); } catch (e) {}
  let folders = [];
  try {
    const data = await _filesApi('search', { query: c.name });
    if (data.error) throw new Error(data.error);
    folders = (data.files || []).filter(f => f.mimeType === 'application/vnd.google-apps.folder');
  } catch (err) {
    try { showDhToast('Scan failed', err.message || 'Could not search Drive', '⚠', 'var(--orange)', 5000); } catch (e) {}
    return;
  }
  const linked = new Set((c.driveProjects || []).map(p => p.folderId));
  const candidates = folders.filter(f => !linked.has(f.id));
  if (!candidates.length) {
    try { showDhToast('Nothing new found', folders.length ? 'All ' + folders.length + ' matching folders are already linked' : 'No Drive folders contain "' + c.name + '"', 'check', 'var(--blue-bright)', 5000); } catch (e) {}
    return;
  }

  document.getElementById('cd-scan-modal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'cd-scan-modal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  wrap.innerHTML = `
    <div style="background:var(--navy-card);border:1px solid var(--border-bright);border-radius:16px;max-width:560px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55)">
      <div style="background:var(--navy-mid);padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--white)">Found ${candidates.length} project folder${candidates.length === 1 ? '' : 's'}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Drive folders matching "${c.name}" — untick any you don't want linked</div>
        </div>
        <button onclick="document.getElementById('cd-scan-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="padding:14px 20px;overflow-y:auto;flex:1">
        ${candidates.map((f, i) => `
          <label style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:10px;background:var(--navy-mid);margin-bottom:6px;cursor:pointer">
            <input type="checkbox" checked data-cd-idx="${i}" style="accent-color:var(--blue);width:15px;height:15px;flex-shrink:0">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_cdParseAddress(f.name, c.name)}</div>
              <div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
            </div>
          </label>`).join('')}
      </div>
      <div style="padding:14px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
        <label style="display:flex;align-items:center;gap:7px;font-size:11px;color:var(--muted);cursor:pointer">
          <input type="checkbox" id="cd-scan-share" checked style="accent-color:var(--blue)">
          Also enable client downloads (makes each folder viewable by anyone with its link)
        </label>
        <div style="display:flex;gap:8px">
          <button onclick="document.getElementById('cd-scan-modal').remove()" style="padding:9px 18px;border-radius:10px;border:1px solid var(--border-bright);background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer">Cancel</button>
          <button id="cd-scan-link-btn" onclick="cdLinkSelected('${clientId}')" style="padding:9px 20px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">Link Selected</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
  window._cdScanCandidates = candidates;
}

async function cdLinkSelected(clientId) {
  const c = _cdClient(clientId);
  const candidates = window._cdScanCandidates || [];
  if (!c) return;
  const checked = [...document.querySelectorAll('#cd-scan-modal input[data-cd-idx]:checked')].map(cb => candidates[parseInt(cb.dataset.cdIdx, 10)]).filter(Boolean);
  const doShare = document.getElementById('cd-scan-share')?.checked;
  if (!checked.length) { document.getElementById('cd-scan-modal').remove(); return; }
  const btn = document.getElementById('cd-scan-link-btn');
  if (btn) { btn.textContent = 'Linking…'; btn.disabled = true; }

  c.driveProjects = c.driveProjects || [];
  let shareFails = 0;
  for (const f of checked) {
    const proj = {
      folderId: f.id,
      name: f.name,
      address: _cdParseAddress(f.name, c.name),
      webViewLink: f.webViewLink || '',
      shared: false,
      linkedAt: new Date().toISOString(),
    };
    if (doShare) {
      try {
        const res = await _filesApi('shareFolder', { fileId: f.id });
        if (res.error) throw new Error(res.error);
        proj.shared = true;
      } catch (e) { shareFails++; }
    }
    c.driveProjects.push(proj);
  }
  c.driveProjects.sort((a, b) => a.address.localeCompare(b.address));
  saveClientsToStorage();
  document.getElementById('cd-scan-modal')?.remove();
  try { showDhToast('Projects linked', checked.length + ' project' + (checked.length === 1 ? '' : 's') + ' added to ' + c.name + (shareFails ? ' — ' + shareFails + ' could not be shared' : ''), 'check', 'var(--green)', 4000); } catch (e) {}
  if (typeof renderClientPortal === 'function' && typeof currentPortalClientId !== 'undefined' && currentPortalClientId) {
    renderClientPortal(clientId, 'assets');
  }
}

function cdUnlinkProject(clientId, folderId) {
  const c = _cdClient(clientId);
  if (!c) return;
  const proj = (c.driveProjects || []).find(p => p.folderId === folderId);
  _filesModal({
    title: 'Unlink Project',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>',
    iconColor: '#E85D5D',
    message: 'Remove <strong style="color:var(--offwhite)">' + (proj?.address || 'this project') + '</strong> from ' + c.name + '\'s portal? The Drive folder itself is not affected.',
    confirmText: 'Unlink',
    danger: true,
    onConfirm: () => {
      c.driveProjects = (c.driveProjects || []).filter(p => p.folderId !== folderId);
      saveClientsToStorage();
      try { showDhToast('Unlinked', proj?.address || '', 'check', 'var(--green)', 2500); } catch (e) {}
      if (typeof renderClientPortal === 'function') renderClientPortal(clientId, 'assets');
    },
  });
}

// ── Shared section HTML (admin assets tab + client portal files tab) ─────────
function cdProjectsSectionHtml(clientId, isClientView) {
  const c = _cdClient(clientId);
  const projects = c?.driveProjects || [];
  const scanBtn = !isClientView ? `
    <button onclick="cdScanDrive('${clientId}')" style="display:inline-flex;align-items:center;gap:7px;padding:8px 16px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      Scan Drive for projects
    </button>` : '';

  if (!projects.length && isClientView) return '';

  return `<div class="card" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="18" height="16" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="M43.65 25L29.9 0c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/><path d="M43.65 25L57.4 0H13.9c-1.55 0-3.1.4-4.5 1.2z" fill="#00832d"/><path d="M59.8 53H27.5L13.75 76.8h49.8z" fill="#2684fc"/><path d="M73.4 26.5c-.8-1.4-1.95-2.5-3.3-3.3L56.3 0H43.65l16.15 28z" fill="#ffba00"/></svg>
        <div class="section-label" style="margin-bottom:0">${isClientView ? 'Your Projects' : 'Linked Drive Projects'}</div>
        ${projects.length ? `<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(34,217,122,.12);color:var(--green)">${projects.length}</span>` : ''}
      </div>
      ${scanBtn}
    </div>
    ${projects.length ? `
    <input type="text" id="cd-proj-search-${clientId}" placeholder="Search by address…" oninput="cdFilterProjects('${clientId}')"
      style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);margin-bottom:12px">
    <div id="cd-proj-list-${clientId}">
      ${projects.map(p => `
      <div class="cd-proj-row" data-addr="${(p.address || '').toLowerCase()}" style="background:var(--navy-lift);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="cdToggleBrowse('${clientId}','${p.folderId}')">
            <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.name}">${p.address}</div>
            <div style="font-size:10px;color:var(--muted)">${isClientView ? 'Click to browse files' : 'Linked ' + (p.linkedAt || '').slice(0, 10) + (p.shared ? ' · <span style="color:var(--green)">downloads enabled</span>' : ' · <span style="color:#F5C842">downloads not enabled</span>')}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <button onclick="cdToggleBrowse('${clientId}','${p.folderId}')" style="padding:6px 14px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer">Browse Files</button>
            ${!isClientView && !p.shared ? `<button onclick="cdShareProject('${clientId}','${p.folderId}')" title="Allow the client to download large files" style="padding:6px 12px;border-radius:10px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.06);color:var(--green);font-size:11px;font-weight:600;cursor:pointer">Enable downloads</button>` : ''}
            ${!isClientView ? `<button onclick="cdUnlinkProject('${clientId}','${p.folderId}')" title="Unlink" style="border:none;background:none;color:var(--muted);cursor:pointer;padding:4px;font-size:13px">✕</button>` : ''}
          </div>
        </div>
        <div id="cd-browse-${p.folderId}" style="display:none;border-top:1px solid var(--border);padding:10px 14px"></div>
      </div>`).join('')}
    </div>
    <div id="cd-proj-none-${clientId}" style="display:none;text-align:center;padding:14px;color:var(--muted);font-size:12px">No projects match your search</div>
    ` : `<div style="text-align:center;padding:18px;color:var(--muted);font-size:12px;line-height:1.7">
      No Drive projects linked yet.${!isClientView ? '<br>Click <b style="color:var(--offwhite)">Scan Drive for projects</b> to find every folder with this client\'s name and link them by address.' : ''}
    </div>`}
  </div>`;
}

function cdFilterProjects(clientId) {
  const q = (document.getElementById('cd-proj-search-' + clientId)?.value || '').toLowerCase();
  const rows = document.querySelectorAll('#cd-proj-list-' + CSS.escape(String(clientId)) + ' .cd-proj-row');
  let visible = 0;
  rows.forEach(r => {
    const show = !q || (r.dataset.addr || '').includes(q);
    r.style.display = show ? '' : 'none';
    if (show) visible++;
  });
  const none = document.getElementById('cd-proj-none-' + clientId);
  if (none) none.style.display = visible ? 'none' : '';
}

async function cdShareProject(clientId, folderId) {
  const c = _cdClient(clientId);
  const proj = (c?.driveProjects || []).find(p => p.folderId === folderId);
  if (!proj) return;
  try {
    const res = await _filesApi('shareFolder', { fileId: folderId });
    if (res.error) throw new Error(res.error);
    proj.shared = true;
    saveClientsToStorage();
    try { showDhToast('Downloads enabled', proj.address, 'check', 'var(--green)', 3000); } catch (e) {}
    if (typeof renderClientPortal === 'function') renderClientPortal(clientId, 'assets');
  } catch (err) {
    try { showDhToast('Share failed', err.message || 'Could not share folder', '⚠', 'var(--orange)', 5000); } catch (e) {}
  }
}

// ── Browse a project folder inline (works in admin + client portal) ──────────
// Navigation stack per project root: window._cdNav[rootId] = [{id,name},…]
window._cdNav = window._cdNav || {};

async function cdToggleBrowse(clientId, folderId) {
  const el = document.getElementById('cd-browse-' + folderId);
  if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  el.style.display = '';
  window._cdNav[folderId] = [];
  cdRenderFolder(folderId);
}

function cdNavInto(rootId, id, name) {
  window._cdNav[rootId] = [...(window._cdNav[rootId] || []), { id, name }];
  cdRenderFolder(rootId);
}
function cdNavBack(rootId) {
  window._cdNav[rootId] = (window._cdNav[rootId] || []).slice(0, -1);
  cdRenderFolder(rootId);
}

async function cdRenderFolder(rootId) {
  const el = document.getElementById('cd-browse-' + rootId);
  if (!el) return;
  const stack = window._cdNav[rootId] || [];
  const currentId = stack.length ? stack[stack.length - 1].id : rootId;
  el.innerHTML = '<div style="padding:10px;text-align:center;color:var(--muted);font-size:12px">Loading files…</div>';
  try {
    const data = await _filesApi('list', { folderId: currentId });
    if (data.error) throw new Error(data.error);
    const files = data.files || [];
    const crumbHtml = stack.length
      ? `<div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button onclick="cdNavBack('${rootId}')" style="border:none;background:var(--navy-mid);border-radius:8px;color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer;padding:4px 12px">← Back</button>
          <span style="font-size:11px;color:var(--muted)">${stack.map(s => s.name).join(' / ')}</span>
        </div>`
      : '';
    if (!files.length) {
      el.innerHTML = crumbHtml + '<div style="padding:10px;text-align:center;color:var(--muted);font-size:12px">This folder is empty</div>';
      return;
    }
    el.innerHTML = crumbHtml + files.map(f => {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      const size = f.size ? _filesFormatSize(f.size) : '';
      const safeName = (f.name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
      if (isFolder) {
        return `<div onclick="cdNavInto('${rootId}','${f.id}','${safeName}')" style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='var(--navy-mid)'" onmouseleave="this.style.background='transparent'">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5C842" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
          <span style="flex:1;font-size:12px;font-weight:600;color:var(--offwhite);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</span>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`;
      }
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px">
        ${typeof _filesGetIcon === 'function' ? `<span style="flex-shrink:0;display:inline-flex">${_filesGetIcon(f.mimeType, f.name)}</span>` : ''}
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;color:var(--offwhite);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${f.name}</div>
          <div style="font-size:9px;color:var(--muted)">${size}</div>
        </div>
        <button onclick="filesDownload('${f.id}')" style="padding:4px 12px;border-radius:8px;border:1px solid rgba(91,141,239,.4);background:rgba(91,141,239,.06);color:var(--blue-bright);font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;flex-shrink:0">↓ Download</button>
      </div>`;
    }).join('');
  } catch (err) {
    el.innerHTML = `<div style="padding:10px;text-align:center;color:#E85D5D;font-size:12px">${err.message}</div>`;
  }
}
