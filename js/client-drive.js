// ── CLIENT DRIVE PROJECTS ────────────────────────────────────────────────────
// Links Google Drive folders to a client as "projects by address". Multiple
// Drive folders for the same property (duplicates, .PRV/RAW variants) group
// into ONE project. Client browses/downloads from their portal.
// Stored on the client record:
//   c.driveProjects = [{address, folders:[{folderId,name,label,webViewLink,shared}], linkedAt}]
// (Legacy single-folder entries {folderId,name,address,shared,...} still work.)

function _cdClient(clientId) {
  return (typeof clients !== 'undefined' ? clients : []).find(c => String(c.id) === String(clientId));
}

// "8002 East Vista Bonita Drive - Scottsdale, AZ - Katrina Barrett" → address only
function _cdParseAddress(folderName, clientName) {
  let addr = folderName || '';
  if (clientName) {
    const esc = clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    addr = addr.replace(new RegExp('\\s*[-–—]\\s*' + esc, 'i'), '');
  }
  return addr.trim();
}

// Base address for grouping: strip trailing variant suffixes like ".PRV"
function _cdBaseAddress(address) {
  return (address || '').replace(/\.(prv|raw|previews?)\s*$/i, '').trim();
}

// Normalize a project entry (handles legacy single-folder shape)
function _cdProjFolders(p) {
  if (p.folders && p.folders.length) return p.folders;
  return [{ folderId: p.folderId, name: p.name, label: '', webViewLink: p.webViewLink || '', shared: !!p.shared }];
}
function _cdProjKey(p) { return _cdProjFolders(p)[0].folderId; }

function _cdFolderLabel(folderName, clientName, address) {
  const parsed = _cdParseAddress(folderName, clientName);
  if (/\.(prv|raw|previews?)\s*$/i.test(parsed)) return 'PRV / RAW files';
  return 'Deliverables';
}

// ── Admin: scan Drive for a client's project folders ─────────────────────────
async function cdScanDrive(clientId) {
  const c = _cdClient(clientId);
  if (!c) return;
  try { showDhToast('Scanning Drive…', 'Looking for folders matching "' + c.name + '"', '⟳', 'var(--blue-bright)', 3000); } catch (e) {}
  let folders = [];
  try {
    // Folders only, paginated — file names also contain the client's name
    let pageToken = '';
    for (let page = 0; page < 10; page++) {
      const data = await _filesApi('search', { query: c.name, foldersOnly: true, ...(pageToken ? { pageToken } : {}) });
      if (data.error) throw new Error(data.error);
      folders.push(...(data.files || []).filter(f => f.mimeType === 'application/vnd.google-apps.folder'));
      pageToken = data.nextPageToken || '';
      if (!pageToken) break;
    }
  } catch (err) {
    try { showDhToast('Scan failed', err.message || 'Could not search Drive', '⚠', 'var(--orange)', 5000); } catch (e) {}
    return;
  }
  // Dedupe by folder id, drop already-linked folders
  const seen = new Set();
  folders = folders.filter(f => { if (seen.has(f.id)) return false; seen.add(f.id); return true; });
  const linked = new Set();
  (c.driveProjects || []).forEach(p => _cdProjFolders(p).forEach(f => linked.add(f.folderId)));
  const fresh = folders.filter(f => !linked.has(f.id));
  if (!fresh.length) {
    try { showDhToast('Nothing new found', folders.length ? 'All matching folders are already linked' : 'No Drive folders contain "' + c.name + '"', 'check', 'var(--blue-bright)', 5000); } catch (e) {}
    return;
  }

  // Group folders by base address → one project per property
  const groups = new Map();
  fresh.forEach(f => {
    const address = _cdParseAddress(f.name, c.name);
    const base = _cdBaseAddress(address);
    const key = base.toLowerCase();
    if (!groups.has(key)) groups.set(key, { address: base, folders: [] });
    groups.get(key).folders.push({
      folderId: f.id,
      name: f.name,
      label: _cdFolderLabel(f.name, c.name, base),
      webViewLink: f.webViewLink || '',
      modifiedTime: f.modifiedTime || '',
      shared: false,
    });
  });
  const candidates = [...groups.values()].sort((a, b) => a.address.localeCompare(b.address));

  document.getElementById('cd-scan-modal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'cd-scan-modal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9500;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  const totalFolders = fresh.length;
  wrap.innerHTML = `
    <div style="background:var(--navy-card);border:1px solid var(--border-bright);border-radius:16px;max-width:600px;width:100%;max-height:80vh;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55)">
      <div style="background:var(--navy-mid);padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--white)">Found ${candidates.length} propert${candidates.length === 1 ? 'y' : 'ies'} (${totalFolders} folders)</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">Folders for the same address are grouped into one project — untick any you don't want</div>
        </div>
        <button onclick="document.getElementById('cd-scan-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="padding:14px 20px;overflow-y:auto;flex:1">
        ${candidates.map((g, i) => `
          <label style="display:flex;align-items:flex-start;gap:10px;padding:9px 10px;border-radius:10px;background:var(--navy-mid);margin-bottom:6px;cursor:pointer">
            <input type="checkbox" checked data-cd-idx="${i}" style="accent-color:var(--blue);width:15px;height:15px;flex-shrink:0;margin-top:2px">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${g.address}</div>
              <div style="font-size:10px;color:var(--muted)">${g.folders.length} folder${g.folders.length === 1 ? '' : 's'}${g.folders.length > 1 ? ' — ' + g.folders.map(f => f.label).join(', ') : ''}</div>
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
  if (btn) { btn.disabled = true; }

  c.driveProjects = c.driveProjects || [];
  let shareFails = 0, jobsCreated = 0, jobsLinked = 0, done = 0;
  let nextJobId = Date.now();
  for (const g of checked) {
    if (btn) btn.textContent = 'Linking ' + (++done) + '/' + checked.length + '…';
    // Share every folder in the group
    if (doShare) {
      for (const f of g.folders) {
        try {
          const res = await _filesApi('shareFolder', { fileId: f.folderId });
          if (res.error) throw new Error(res.error);
          f.shared = true;
        } catch (e) { shareFails++; }
      }
    }
    // Merge into an existing project for the same address, or create one
    const addrLc = g.address.toLowerCase();
    const existingProj = c.driveProjects.find(p => _cdBaseAddress(p.address || '').toLowerCase() === addrLc);
    if (existingProj) {
      const pf = _cdProjFolders(existingProj);
      const have = new Set(pf.map(f => f.folderId));
      existingProj.folders = pf.concat(g.folders.filter(f => !have.has(f.folderId)));
      delete existingProj.folderId;
      existingProj.address = _cdBaseAddress(existingProj.address);
    } else {
      c.driveProjects.push({ address: g.address, folders: g.folders, linkedAt: new Date().toISOString() });
    }

    // One Finished tracker project per property. $0 financials.
    if (typeof savedJobs !== 'undefined') {
      const main = g.folders.find(f => f.label === 'Deliverables') || g.folders[0];
      const existing = savedJobs.find(j =>
        (j.driveLink && g.folders.some(f => f.folderId && j.driveLink.includes(f.folderId))) ||
        (String(j.clientId) === String(c.id) && ((j.address || '').toLowerCase() === addrLc || (j.name || '').toLowerCase() === addrLc)));
      if (existing) {
        if (!existing.driveLink && main.webViewLink) { existing.driveLink = main.webViewLink; jobsLinked++; }
      } else {
        savedJobs.push({
          id: nextJobId++,
          name: g.address,
          date: (main.modifiedTime || new Date().toISOString()).slice(0, 10),
          status: 'completed',
          clientId: c.id,
          clientName: c.name,
          address: g.address,
          driveLink: main.webViewLink || '',
          market: 'canada',
          grand: 0, driveCost: 0,
          services: {}, hours: {}, payouts: {}, editors: {}, extraServices: [],
          commissionPct: 0, commissionAmt: 0,
          notes: 'Imported from Google Drive',
          _importedFromDrive: true,
        });
        jobsCreated++;
      }
    }
  }
  c.driveProjects.sort((a, b) => (a.address || '').localeCompare(b.address || ''));
  saveClientsToStorage();
  if ((jobsCreated || jobsLinked) && typeof saveJobsToStorage === 'function') saveJobsToStorage();
  document.getElementById('cd-scan-modal')?.remove();
  const bits = [checked.length + ' propert' + (checked.length === 1 ? 'y' : 'ies') + ' linked'];
  if (jobsCreated) bits.push(jobsCreated + ' finished project' + (jobsCreated === 1 ? '' : 's') + ' created');
  if (jobsLinked) bits.push(jobsLinked + ' existing updated');
  if (shareFails) bits.push(shareFails + ' folder' + (shareFails === 1 ? '' : 's') + ' could not be shared');
  try { showDhToast('Drive import complete', bits.join(' · '), 'check', 'var(--green)', 5000); } catch (e) {}
  if (typeof renderClientPortal === 'function' && typeof currentPortalClientId !== 'undefined' && currentPortalClientId) {
    renderClientPortal(clientId, 'assets');
  }
}

// ── Merge two projects (same property, differently spelled folders) ─────────
function cdMergeProject(clientId, projKey) {
  const c = _cdClient(clientId);
  if (!c) return;
  const source = (c.driveProjects || []).find(p => _cdProjKey(p) === projKey);
  if (!source) return;
  const others = (c.driveProjects || []).filter(p => _cdProjKey(p) !== projKey);
  if (!others.length) { try { showDhToast('Nothing to merge with', 'This client has no other projects', '⚠', 'var(--orange)', 3000); } catch (e) {} return; }
  document.getElementById('cd-merge-modal')?.remove();
  const wrap = document.createElement('div');
  wrap.id = 'cd-merge-modal';
  wrap.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:9600;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(2px);-webkit-backdrop-filter:blur(2px)';
  wrap.onclick = (e) => { if (e.target === wrap) wrap.remove(); };
  wrap.innerHTML = `
    <div style="background:var(--navy-card);border:1px solid var(--border-bright);border-radius:16px;max-width:480px;width:100%;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,.55)">
      <div style="background:var(--navy-mid);padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:14px;font-weight:700;color:var(--white)">Merge Project</span>
        <button onclick="document.getElementById('cd-merge-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:16px">✕</button>
      </div>
      <div style="padding:20px">
        <div style="font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:12px">Move the ${_cdProjFolders(source).length} folder${_cdProjFolders(source).length === 1 ? '' : 's'} from <strong style="color:var(--offwhite)">${source.address}</strong> into another project. The merged project keeps the other project's address.</div>
        <select id="cd-merge-target" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);margin-bottom:16px">
          ${others.map(p => `<option value="${_cdProjKey(p)}">${p.address} (${_cdProjFolders(p).length} folder${_cdProjFolders(p).length === 1 ? '' : 's'})</option>`).join('')}
        </select>
        <div style="display:flex;gap:8px;justify-content:flex-end">
          <button onclick="document.getElementById('cd-merge-modal').remove()" style="padding:9px 18px;border-radius:10px;border:1px solid var(--border-bright);background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer">Cancel</button>
          <button onclick="cdMergeConfirm('${clientId}','${projKey}')" style="padding:9px 20px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">Merge</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(wrap);
}

function cdMergeConfirm(clientId, sourceKey) {
  const c = _cdClient(clientId);
  const targetKey = document.getElementById('cd-merge-target')?.value;
  if (!c || !targetKey) return;
  const source = (c.driveProjects || []).find(p => _cdProjKey(p) === sourceKey);
  const target = (c.driveProjects || []).find(p => _cdProjKey(p) === targetKey);
  if (!source || !target) return;
  const tf = _cdProjFolders(target);
  const have = new Set(tf.map(f => f.folderId));
  target.folders = tf.concat(_cdProjFolders(source).filter(f => !have.has(f.folderId)));
  delete target.folderId;
  c.driveProjects = c.driveProjects.filter(p => _cdProjKey(p) !== sourceKey);
  saveClientsToStorage();
  // Drop the imported tracker job for the source address (target's job covers it)
  if (typeof savedJobs !== 'undefined') {
    const idx = savedJobs.findIndex(j => j._importedFromDrive && String(j.clientId) === String(c.id) && (j.address || '').toLowerCase() === (source.address || '').toLowerCase());
    if (idx >= 0) { savedJobs.splice(idx, 1); if (typeof saveJobsToStorage === 'function') saveJobsToStorage(); }
  }
  document.getElementById('cd-merge-modal')?.remove();
  try { showDhToast('Merged', source.address + ' → ' + target.address, 'check', 'var(--green)', 3500); } catch (e) {}
  if (typeof renderClientPortal === 'function') renderClientPortal(clientId, 'assets');
}

function cdUnlinkProject(clientId, projKey) {
  const c = _cdClient(clientId);
  if (!c) return;
  const proj = (c.driveProjects || []).find(p => _cdProjKey(p) === projKey);
  _filesModal({
    title: 'Unlink Project',
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"/><line x1="12" y1="2" x2="12" y2="12"/></svg>',
    iconColor: '#E85D5D',
    message: 'Remove <strong style="color:var(--offwhite)">' + (proj?.address || 'this project') + '</strong> from ' + c.name + '\'s portal? The Drive folders themselves are not affected.',
    confirmText: 'Unlink',
    danger: true,
    onConfirm: () => {
      c.driveProjects = (c.driveProjects || []).filter(p => _cdProjKey(p) !== projKey);
      saveClientsToStorage();
      try { showDhToast('Unlinked', proj?.address || '', 'check', 'var(--green)', 2500); } catch (e) {}
      if (typeof renderClientPortal === 'function') renderClientPortal(clientId, 'assets');
    },
  });
}

// House number heuristic for spotting likely duplicate properties
function _cdHouseNo(address) {
  const m = (address || '').match(/(\d{2,6})/);
  return m ? m[1] : '';
}
window._cdShowDups = window._cdShowDups || {};
function cdToggleDupFilter(clientId) {
  window._cdShowDups[clientId] = !window._cdShowDups[clientId];
  if (typeof renderClientPortal === 'function') renderClientPortal(clientId, 'assets');
}

// ── Shared section HTML (admin assets tab + client portal files tab) ─────────
function cdProjectsSectionHtml(clientId, isClientView) {
  const c = _cdClient(clientId);
  let projects = c?.driveProjects || [];

  // Admin: possible-duplicates mode — only projects sharing a house number,
  // grouped side by side so they're easy to merge
  let dupGroups = new Map();
  if (!isClientView && projects.length) {
    projects.forEach(p => {
      const no = _cdHouseNo(p.address);
      if (!no) return;
      if (!dupGroups.has(no)) dupGroups.set(no, []);
      dupGroups.get(no).push(p);
    });
    dupGroups = new Map([...dupGroups].filter(([, list]) => list.length > 1));
  }
  const dupCount = dupGroups.size;
  const dupMode = !isClientView && window._cdShowDups[clientId] && dupCount > 0;
  if (dupMode) {
    projects = [...dupGroups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true }))
      .flatMap(([, list]) => list);
  }
  const scanBtn = !isClientView ? `
    ${dupCount ? `<button onclick="cdToggleDupFilter('${clientId}')" style="display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;border:1px solid ${dupMode ? '#F5C842' : 'var(--border-bright)'};background:${dupMode ? 'rgba(245,200,66,.12)' : 'transparent'};color:${dupMode ? '#F5C842' : 'var(--muted)'};font-size:12px;font-weight:700;cursor:pointer">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
      ${dupMode ? 'Show all projects' : 'Possible duplicates (' + dupCount + ')'}
    </button>` : ''}
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
    ${dupMode ? `<div style="font-size:11px;color:#F5C842;margin-bottom:10px;line-height:1.6">Showing only properties that share a house number — likely the same project spelled differently. Use <b>Merge</b> to combine them; folders and files are kept.</div>` : ''}
    <div id="cd-proj-list-${clientId}">
      ${(() => { let _lastNo = null; return projects.map(p => {
        const pf = _cdProjFolders(p);
        const key = _cdProjKey(p);
        const allShared = pf.every(f => f.shared);
        let groupHdr = '';
        if (dupMode) {
          const no = _cdHouseNo(p.address);
          if (no !== _lastNo) { groupHdr = `<div style="font-size:10px;font-weight:700;color:#F5C842;text-transform:uppercase;letter-spacing:.06em;margin:${_lastNo === null ? '0' : '14px'} 0 6px">№ ${no}</div>`; _lastNo = no; }
        }
        return groupHdr + `
      <div class="cd-proj-row" data-addr="${(p.address || '').toLowerCase()}" style="background:var(--navy-lift);border:1px solid var(--border);border-radius:10px;margin-bottom:8px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:11px 14px;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:0;cursor:pointer" onclick="cdToggleBrowse('${clientId}','${key}')">
            <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.address}">${p.address}</div>
            <div style="font-size:10px;color:var(--muted)">${pf.length > 1 ? pf.length + ' folders · ' : ''}${isClientView ? 'Click to browse files' : 'Linked ' + (p.linkedAt || '').slice(0, 10) + (allShared ? ' · <span style="color:var(--green)">downloads enabled</span>' : ' · <span style="color:#F5C842">downloads not enabled</span>')}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
            <button onclick="cdToggleBrowse('${clientId}','${key}')" style="padding:6px 14px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer">Browse Files</button>
            ${!isClientView && !allShared ? `<button onclick="cdShareProject('${clientId}','${key}')" title="Allow the client to download large files" style="padding:6px 12px;border-radius:10px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.06);color:var(--green);font-size:11px;font-weight:600;cursor:pointer">Enable downloads</button>` : ''}
            ${!isClientView ? `<button onclick="cdMergeProject('${clientId}','${key}')" title="Merge into another project (same property, different folder spelling)" style="padding:6px 10px;border-radius:10px;border:1px solid var(--border-bright);background:transparent;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer">Merge</button>` : ''}
            ${!isClientView ? `<button onclick="cdUnlinkProject('${clientId}','${key}')" title="Unlink" style="border:none;background:none;color:var(--muted);cursor:pointer;padding:4px;font-size:13px">✕</button>` : ''}
          </div>
        </div>
        <div id="cd-browse-${key}" style="display:none;border-top:1px solid var(--border);padding:10px 14px"></div>
      </div>`;
      }).join(''); })()}
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

async function cdShareProject(clientId, projKey) {
  const c = _cdClient(clientId);
  const proj = (c?.driveProjects || []).find(p => _cdProjKey(p) === projKey);
  if (!proj) return;
  const pf = _cdProjFolders(proj);
  let fails = 0;
  for (const f of pf) {
    if (f.shared) continue;
    try {
      const res = await _filesApi('shareFolder', { fileId: f.folderId });
      if (res.error) throw new Error(res.error);
      f.shared = true;
    } catch (err) { fails++; }
  }
  if (!proj.folders) { proj.folders = pf; delete proj.folderId; }
  saveClientsToStorage();
  if (fails) { try { showDhToast('Partially shared', fails + ' folder(s) could not be shared', '⚠', 'var(--orange)', 5000); } catch (e) {} }
  else { try { showDhToast('Downloads enabled', proj.address, 'check', 'var(--green)', 3000); } catch (e) {} }
  if (typeof renderClientPortal === 'function') renderClientPortal(clientId, 'assets');
}

// ── Browse a project inline (works in admin + client portal) ─────────────────
// Navigation stack per project: window._cdNav[projKey] = [{id,name},…]
window._cdNav = window._cdNav || {};
window._cdRootProjects = window._cdRootProjects || {};

function cdToggleBrowse(clientId, projKey) {
  const el = document.getElementById('cd-browse-' + projKey);
  if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  el.style.display = '';
  const c = _cdClient(clientId);
  const proj = (c?.driveProjects || []).find(p => _cdProjKey(p) === projKey);
  window._cdRootProjects[projKey] = proj ? _cdProjFolders(proj) : [];
  window._cdNav[projKey] = [];
  cdRenderFolder(projKey);
}

function cdNavInto(projKey, id, name) {
  window._cdNav[projKey] = [...(window._cdNav[projKey] || []), { id, name }];
  cdRenderFolder(projKey);
}
function cdNavBack(projKey) {
  window._cdNav[projKey] = (window._cdNav[projKey] || []).slice(0, -1);
  cdRenderFolder(projKey);
}

function _cdFolderRowHtml(projKey, id, name, sub) {
  const safeName = (name || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
  return `<div onclick="cdNavInto('${projKey}','${id}','${safeName}')" style="display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='var(--navy-mid)'" onmouseleave="this.style.background='transparent'">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5C842" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
    <div style="flex:1;min-width:0">
      <div style="font-size:12px;font-weight:600;color:var(--offwhite);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${name}</div>
      ${sub ? `<div style="font-size:9px;color:var(--muted)">${sub}</div>` : ''}
    </div>
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
  </div>`;
}

async function cdRenderFolder(projKey) {
  const el = document.getElementById('cd-browse-' + projKey);
  if (!el) return;
  const stack = window._cdNav[projKey] || [];
  const roots = window._cdRootProjects[projKey] || [];

  // Multi-folder project at the top level: list the folders themselves
  if (!stack.length && roots.length > 1) {
    el.innerHTML = roots.map(f => _cdFolderRowHtml(projKey, f.folderId, f.label || f.name, f.name)).join('');
    return;
  }

  const currentId = stack.length ? stack[stack.length - 1].id : (roots[0] ? roots[0].folderId : projKey);
  el.innerHTML = '<div style="padding:10px;text-align:center;color:var(--muted);font-size:12px">Loading files…</div>';
  try {
    const data = await _filesApi('list', { folderId: currentId });
    if (data.error) throw new Error(data.error);
    const files = data.files || [];
    const crumbHtml = stack.length
      ? `<div style="margin-bottom:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap">
          <button onclick="cdNavBack('${projKey}')" style="border:none;background:var(--navy-mid);border-radius:8px;color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer;padding:4px 12px">← Back</button>
          <span style="font-size:11px;color:var(--muted)">${stack.map(s => s.name).join(' / ')}</span>
        </div>`
      : '';
    if (!files.length) {
      el.innerHTML = crumbHtml + '<div style="padding:10px;text-align:center;color:var(--muted);font-size:12px">This folder is empty</div>';
      return;
    }
    el.innerHTML = crumbHtml + files.map(f => {
      const isFolder = f.mimeType === 'application/vnd.google-apps.folder';
      if (isFolder) return _cdFolderRowHtml(projKey, f.id, f.name, '');
      const size = f.size ? _filesFormatSize(f.size) : '';
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
