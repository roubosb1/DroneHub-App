// ── TRACKER TAB STATE ────────────────────────────────────────────────────────
let _trackerTab='upcoming'; // 'upcoming' | 'active' | 'completed'
let _trackerMode = 'video'; // 'video' | 'photo'
let _trackerClientFilter=''; // selected client name
let _trackerMineOnly=false;  // show only rows assigned to the current user

function trackerToggleAddMenu(){
  const m=document.getElementById('tracker-add-menu');
  if(!m) return;
  const open=m.style.display==='none'||!m.style.display;
  m.style.display=open?'block':'none';
  if(open){
    const close=e=>{if(!document.getElementById('tracker-add-wrap')?.contains(e.target)){m.style.display='none';document.removeEventListener('click',close);}};
    setTimeout(()=>document.addEventListener('click',close),0);
  }
}

function trackerSetTab(tab){
  _trackerTab=tab;
  const upcomingBtn=document.getElementById('tracker-tab-upcoming');
  const activeBtn=document.getElementById('tracker-tab-active');
  const completedBtn=document.getElementById('tracker-tab-completed');
  const btns={upcoming:upcomingBtn,active:activeBtn,completed:completedBtn};
  const styles={
    upcoming:{
      active:_trackerLightMode?'rgba(245,166,35,.35)':'rgba(245,166,35,.32)', activeColor:_trackerLightMode?'#b45309':'#F5A623',
      activeBorder:_trackerLightMode?'rgba(245,166,35,.75)':'rgba(245,166,35,.7)',
      inactiveBg:_trackerLightMode?'rgba(245,166,35,.18)':'rgba(245,166,35,.16)',
      inactiveColor:_trackerLightMode?'#92400e':'#F5A623',
      inactiveBorder:_trackerLightMode?'rgba(245,166,35,.45)':'rgba(245,166,35,.4)',
    },
    active:{
      active:_trackerLightMode?'rgba(91,141,239,.30)':'rgba(91,141,239,.28)', activeColor:_trackerLightMode?'#1d4ed8':'var(--blue-bright)',
      activeBorder:_trackerLightMode?'rgba(91,141,239,.70)':'rgba(91,141,239,.65)',
      inactiveBg:_trackerLightMode?'rgba(91,141,239,.14)':'rgba(91,141,239,.13)',
      inactiveColor:_trackerLightMode?'#2563eb':'var(--blue-bright)',
      inactiveBorder:_trackerLightMode?'rgba(91,141,239,.4)':'rgba(91,141,239,.35)',
    },
    completed:{
      active:'linear-gradient(135deg,var(--green),#16A34A)', activeColor:'#fff',
      activeBorder:'rgba(34,217,122,.7)',
      inactiveBg:_trackerLightMode?'rgba(34,217,122,.18)':'rgba(34,217,122,.15)',
      inactiveColor:_trackerLightMode?'#047857':'var(--green)',
      inactiveBorder:_trackerLightMode?'rgba(34,217,122,.55)':'rgba(34,217,122,.45)',
    },
  };
  Object.entries(btns).forEach(([key,btn])=>{
    if(!btn) return;
    if(key===tab){
      btn.style.background=styles[key].active;
      btn.style.color=styles[key].activeColor;
      btn.style.borderColor=styles[key].activeBorder||'transparent';
      btn.style.borderLeft='';
    } else {
      btn.style.background=styles[key].inactiveBg;
      btn.style.color=styles[key].inactiveColor;
      btn.style.borderColor=styles[key].inactiveBorder;
    }
  });
  renderTracker();
  if(window.innerWidth<=768) setTimeout(mobTrkRefresh, 50);
}

function trackerSetMode(mode){
  _trackerMode = mode;
  // Update mode button styles
  const vBtn = document.getElementById('tracker-mode-video');
  const pBtn = document.getElementById('tracker-mode-photo');
  if(vBtn){
    vBtn.style.background = mode==='video' ? 'linear-gradient(135deg,#5B8DEF,#3B6FD4)' : 'transparent';
    vBtn.style.color = mode==='video' ? '#fff' : 'var(--muted)';
  }
  if(pBtn){
    pBtn.style.background = mode==='photo' ? 'linear-gradient(135deg,#E879F9,#9333ea)' : 'transparent';
    pBtn.style.color = mode==='photo' ? '#fff' : 'var(--muted)';
  }
  // Update column headers
  const vgHeader = document.getElementById('tracker-col-vg');
  if(vgHeader) vgHeader.textContent = mode==='photo' ? 'Photographer' : 'Videographer';
  const stHeader = document.getElementById('tracker-col-status-header');
  if(stHeader) stHeader.textContent = mode==='photo' ? 'Photo Status' : 'Edit Status';
  // Update title
  const titleEl = document.getElementById('tracker-pane-title');
  if(titleEl) titleEl.innerHTML = mode==='photo'
    ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>Photo Tracker'
    : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M4 6h16v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/></svg>Project Tracker';
  // Update status filter dropdown
  const filterSel = document.getElementById('tracker-filter-status');
  if(filterSel){
    if(mode === 'photo'){
      filterSel.innerHTML = `<option value="">All statuses</option>
        <optgroup label="── Upcoming ──">
          <option value="files_pending">Files Pending</option>
          <option value="ready">Ready to Edit</option>
        </optgroup>
        <optgroup label="── In Progress ──">
          <option value="culling">Culling – In Progress</option>
          <option value="editing">Editing – In Progress</option>
          <option value="review">In Review</option>
        </optgroup>
        <optgroup label="── Completed ──">
          <option value="finals_sent">Finals Sent</option>
        </optgroup>`;
    } else {
      filterSel.innerHTML = `<option value="">All statuses</option>
        <optgroup label="── Upcoming ──">
          <option value="footage_pending">Footage Pending</option>
          <option value="ready">Ready to Start</option>
        </optgroup>
        <optgroup label="── In Progress ──">
          <option value="draft1_progress">D1 – In Progress</option>
          <option value="draft1">D1 – Sent</option>
          <option value="draft2_progress">D2 – In Progress</option>
          <option value="draft2">D2 – Sent</option>
          <option value="draft3_progress">D3 – In Progress</option>
          <option value="draft3">D3 – Sent</option>
          <option value="draft_plus">Draft + – In Progress</option>
        </optgroup>
        <optgroup label="── Completed ──">
          <option value="finals_sent">Finals Sent</option>
        </optgroup>`;
    }
  }
  // Reset tab to upcoming
  trackerSetTab(_trackerTab);
}

// ── MY PROJECTS FILTER ───────────────────────────────────────────────────────
function trackerToggleMine(){
  _trackerMineOnly = !_trackerMineOnly;
  const btn = document.getElementById('tracker-mine-btn');
  if(btn){
    if(_trackerMineOnly){
      btn.style.background = 'linear-gradient(135deg,var(--blue),#3B6FD4)';
      btn.style.color = '#fff';
      btn.style.borderColor = 'var(--blue)';
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> My Projects ✓';
    } else {
      btn.style.background = _trackerLightMode ? '#e8eaf2' : 'var(--navy-lift)';
      btn.style.color = _trackerLightMode ? '#6b7280' : 'var(--muted)';
      btn.style.borderColor = _trackerLightMode ? '#c8cce0' : 'var(--border)';
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> My Projects';
    }
  }
  trackerSetTab(_trackerTab);
}

// ── CLIENT AUTOCOMPLETE ───────────────────────────────────────────────────────
function trackerClientSearchInput(val){
  const dropdown=document.getElementById('tracker-client-dropdown');
  if(!dropdown) return;
  if(!val.trim()){
    _trackerClientFilter='';
    dropdown.style.display='none';
    renderTracker();
    return;
  }
  const query=val.toLowerCase();
  // Gather all unique client names from jobs + standalone
  const names=new Set();
  savedJobs.forEach(j=>{
    const c=clients.find(cl=>cl.id===j.clientId);
    if(c?.name) names.add(c.name);
    if(j.clientName) names.add(j.clientName);
  });
  getStandaloneProjects().forEach(sp=>{ if(sp.clientName) names.add(sp.clientName); });

  const matches=[...names].filter(n=>n.toLowerCase().includes(query)).sort();
  if(!matches.length){ dropdown.style.display='none'; return; }

  dropdown.style.display='block';
  dropdown.innerHTML=matches.slice(0,12).map((name,i)=>`
    <div onmousedown="trackerSelectClient('${name.replace(/'/g,'\\\'')}')"
      style="padding:8px 12px;cursor:pointer;font-size:13px;color:var(--offwhite);border-bottom:1px solid rgba(255,255,255,.05);transition:background .1s"
      onmouseover="this.style.background='rgba(91,141,239,.15)'"
      onmouseout="this.style.background='transparent'">
      ${name.replace(new RegExp('('+query.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','gi'),'<strong style="color:var(--blue-bright)">$1</strong>')}
    </div>`).join('');
}

function trackerSelectClient(name){
  _trackerClientFilter=name;
  const input=document.getElementById('tracker-client-search');
  if(input) input.value=name;
  const dropdown=document.getElementById('tracker-client-dropdown');
  if(dropdown) dropdown.style.display='none';
  renderTracker();
}

function trackerHideClientDropdown(){
  const dropdown=document.getElementById('tracker-client-dropdown');
  if(dropdown) dropdown.style.display='none';
  // If input doesn't match a selection, clear the filter
  const input=document.getElementById('tracker-client-search');
  if(input&&input.value.trim()!==_trackerClientFilter){
    if(!input.value.trim()){ _trackerClientFilter=''; renderTracker(); }
  }
}

function trackerClientSearchKey(e){
  if(e.key==='Escape'){ trackerHideClientDropdown(); }
  if(e.key==='Enter'){
    // Select first match
    const dropdown=document.getElementById('tracker-client-dropdown');
    const first=dropdown?.querySelector('div');
    if(first) first.onmousedown();
  }
}

function trackerClearClientFilter(){
  _trackerClientFilter='';
  const input=document.getElementById('tracker-client-search');
  if(input) input.value='';
  renderTracker();
}

// ── COMPLETED STATUS KEYS ────────────────────────────────────────────────────

function isProjectCompleted(ts){
  return COMPLETED_STATUSES.has(ts.editStatus)||ts.stage==='delivered';
}



/* ═══════════════════════════════════════════════════
   MOBILE TRACKER
   ═══════════════════════════════════════════════════ */
var _mobTrkTab = 'upcoming';      // 'upcoming' | 'active' | 'completed'
var _mobTrkMineOnly = true;       // My Projects vs All
var _mobTrkOpenJobId = null;      // currently open project

function mobTrkSetTab(tab){
  _mobTrkTab = tab;
  ['upcoming','active','completed'].forEach(t=>{
    const btn = document.getElementById('mob-trk-tab-'+t);
    if(!btn) return;
    btn.className = 'mob-trk-tab' + (t===tab ? ' active-'+t : '');
  });
  _mobTrkRenderCardsSafe();
}

function mobTrkSetMine(mine){
  _mobTrkMineOnly = mine;
  _trackerMode = 'video';
  trackerSetMode('video');
  _mobTrkUpdateTopTabs('mine');
  _mobTrkRenderCardsSafe();
}

function mobTrkSetVideo(){
  _mobTrkMineOnly = false;
  _trackerMode = 'video';
  trackerSetMode('video');
  _mobTrkUpdateTopTabs('video');
  _mobTrkRenderCardsSafe();
}

function mobTrkSetMode(mode){
  _mobTrkMineOnly = false;
  _trackerMode = mode;
  trackerSetMode(mode);
  _mobTrkUpdateTopTabs(mode==='photo'?'photo':'video');
  _mobTrkRenderCardsSafe();
}

function _mobTrkUpdateTopTabs(active){
  document.getElementById('mob-trk-mine-btn')?.classList.toggle('active', active==='mine');
  document.getElementById('mob-trk-all-btn')?.classList.toggle('active', active==='video');
  document.getElementById('mob-trk-photo-btn')?.classList.toggle('active', active==='photo');
}

function mobTrkRenderCards(){
  const el = document.getElementById('mob-trk-cards');
  if(!el) return;

  // Refresh savedJobs from localStorage so newly added jobs appear immediately
  try{ savedJobs = JSON.parse(localStorage.getItem('dronehub_jobs')||'[]'); }catch(e){}

  const _isPhoto = _trackerMode === 'photo';
  const _getStage = _isPhoto ? getPhotoTrackerStage : getTrackerStage;
  const _upcomingSt = _isPhoto ? PHOTO_UPCOMING_STATUSES : UPCOMING_STATUSES;
  const _inprogressSt = _isPhoto ? PHOTO_INPROGRESS_STATUSES : INPROGRESS_STATUSES;
  const _completedSt = _isPhoto ? PHOTO_COMPLETED_STATUSES : COMPLETED_STATUSES;
  const _statusStyles = _isPhoto
    ? (typeof PHOTO_STATUS_STYLES!=='undefined' ? PHOTO_STATUS_STYLES : {})
    : null;

  const STATUS_STYLES_LOCAL = {
    footage_pending:{bg:'rgba(168,180,208,.15)',color:'#A8B4D0',label:'Footage Pending'},
    ready:{bg:'rgba(122,171,255,.15)',color:'#7AABFF',label:'Ready to Start'},
    draft1_progress:{bg:'rgba(52,211,153,.15)',color:'#34D399',label:'D1 - In Progress'},
    draft1:{bg:'rgba(34,217,122,.15)',color:'#22D97A',label:'D1 - Sent'},
    draft2_ready:{bg:'rgba(96,200,255,.15)',color:'#60C8FF',label:'D2 - Ready'},
    draft2_progress:{bg:'rgba(252,211,77,.15)',color:'#FCD34D',label:'D2 - In Progress'},
    draft2:{bg:'rgba(245,166,35,.15)',color:'#F5A623',label:'D2 - Sent'},
    draft3_ready:{bg:'rgba(96,200,255,.15)',color:'#60C8FF',label:'D3 - Ready'},
    draft3_progress:{bg:'rgba(251,146,60,.15)',color:'#FB923C',label:'D3 - In Progress'},
    draft3:{bg:'rgba(240,82,82,.15)',color:'#F05252',label:'D3 - Sent'},
    draft_plus_ready:{bg:'rgba(96,200,255,.15)',color:'#60C8FF',label:'D+ - Ready'},
    draft_plus:{bg:'rgba(248,113,113,.15)',color:'#F87171',label:'Draft+ - In Progress'},
    finals_sent:{bg:'rgba(34,217,122,.2)',color:'#22D97A',label:'Finals Sent ✓'},
    in_progress:{bg:'rgba(91,141,239,.15)',color:'#5B8DEF',label:'In Progress'},
    review:{bg:'rgba(167,139,250,.15)',color:'#A78BFA',label:'In Review'},
    files_pending:{bg:'rgba(168,180,208,.15)',color:'#A8B4D0',label:'Files Pending'},
    editing:{bg:'rgba(52,211,153,.15)',color:'#34D399',label:'Editing'},
    delivered:{bg:'rgba(34,217,122,.2)',color:'#22D97A',label:'Delivered ✓'},
  };
  const getStatusStyle = s => (_statusStyles||STATUS_STYLES_LOCAL)[s] || STATUS_STYLES_LOCAL.ready;

  // Build job list
  let jobs = _isPhoto
    ? savedJobs.filter(j=>j.isPhoto&&(j.status==='confirmed'||j.status==='completed'))
    : savedJobs.filter(j=>(j.status==='confirmed'||j.status==='completed')&&!j.isPhoto);

  // Merge standalones
  const standalone = _isPhoto ? getPhotoStandaloneProjects() : getStandaloneProjects();
  standalone.forEach(sp=>{
    if(!jobs.find(j=>j.id===sp.id)){
      jobs.push({id:sp.id,name:sp.address||sp.clientName||'Imported Project',
        date:sp.date,clientId:null,clientName:sp.clientName,isStandalone:true,_sp:sp});
    }
  });

  // "My Projects" filter (apply BEFORE tab filter so we can count all tabs)
  const sess = gateGetSession();
  const myName = (sess?.name||'').toLowerCase();
  if(_mobTrkMineOnly && myName){
    jobs = jobs.filter(j=>{
      const ts=_getStage(j.id);
      const editor=(ts.claimedBy||'').toLowerCase();
      const vg=(ts.videographer||'').toLowerCase();
      const creator=(getJobCreator?.(j)||'').toLowerCase();
      return editor.includes(myName)||vg.includes(myName)||creator.includes(myName);
    });
  }

  // Count jobs per tab BEFORE filtering so we can suggest alternatives
  const countUpcoming = jobs.filter(j=>_upcomingSt.includes(_getStage(j.id).editStatus||'')).length;
  const countActive   = jobs.filter(j=>_inprogressSt.includes(_getStage(j.id).editStatus||'')).length;
  const countDone     = jobs.filter(j=>_completedSt.includes(_getStage(j.id).editStatus||'')).length;

  // Tab filter
  if(_mobTrkTab==='upcoming') jobs=jobs.filter(j=>_upcomingSt.includes(_getStage(j.id).editStatus||''));
  else if(_mobTrkTab==='active') jobs=jobs.filter(j=>_inprogressSt.includes(_getStage(j.id).editStatus||''));
  else jobs=jobs.filter(j=>_completedSt.includes(_getStage(j.id).editStatus||''));

  // Sort
  jobs.sort((a,b)=>{
    const tsA=_getStage(a.id), tsB=_getStage(b.id);
    if(tsA.rush&&!tsB.rush) return -1;
    if(!tsA.rush&&tsB.rush) return 1;
    return (b.date||'').localeCompare(a.date||'');
  });

  if(!jobs.length){
    // Build a helpful hint about which other tabs have results
    const hints=[];
    if(_mobTrkTab!=='upcoming'&&countUpcoming>0) hints.push(`<button onclick="mobTrkSetTab('upcoming')" style="margin-top:10px;padding:8px 18px;border-radius:20px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">Upcoming (${countUpcoming})</button>`);
    if(_mobTrkTab!=='active'&&countActive>0)     hints.push(`<button onclick="mobTrkSetTab('active')"   style="margin-top:10px;padding:8px 18px;border-radius:20px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">Active (${countActive})</button>`);
    if(_mobTrkTab!=='completed'&&countDone>0)    hints.push(`<button onclick="mobTrkSetTab('completed')" style="margin-top:10px;padding:8px 18px;border-radius:20px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">Done (${countDone})</button>`);
    const hintHtml = hints.length ? `<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:4px">${hints.join('')}</div>` : '';
    el.innerHTML=`<div class="mob-trk-empty"><div style="margin-bottom:8px;color:var(--muted)">${_icon('clipboard',36)}</div><div>No projects${_mobTrkMineOnly&&myName?' assigned to you':''} in this tab</div>${hintHtml}</div>`;
    return;
  }

  const _pid = _isPhoto ? (typeof ensurePhotoProjectId==='function'?ensurePhotoProjectId:null) : null;

  el.innerHTML = jobs.map((j,idx)=>{
    const ts = _getStage(j.id);
    const editStatus = ts.editStatus||(_isPhoto?'files_pending':'ready');
    const ss = getStatusStyle(editStatus);
    const client = clients?.find(c=>c.id===j.clientId);
    const clientName = client?.name||j.clientName||'';
    const editor = ts.claimedBy||'';
    const isDhOrEmpty = !editor||editor==='DroneHub'||editor==='dronehub';
    const isRush = ts.rush||false;
    const isOverdue = ts.completionDate && ts.completionDate < new Date().toISOString().slice(0,10);
    const pid = _isPhoto
      ? (ts.projectId||(_pid?_pid(j.id,ts):''))
      : (ts.projectId||(typeof getProjectId==='function'?getProjectId(j):''));

    const numColor = isRush ? '#ef4444' : isOverdue ? '#f97316' : (_mobTrkTab==='completed'?'var(--green)':_mobTrkTab==='active'?'var(--blue-bright)':'var(--amber)');
    const numContent = _mobTrkTab==='completed'
      ? `<span style="font-size:12px;color:var(--green)">✓</span>`
      : `<span style="font-size:18px;font-weight:900;color:${numColor};line-height:1">${idx+1}</span>`;
    const numLabel = _mobTrkTab==='completed' ? 'Done' : _mobTrkTab==='active' ? 'Active' : 'Queue';

    return `<div class="mob-trk-card" onclick="mobTrkOpenProject('${j.id}')">
      <div class="mob-trk-card-num">
        ${numContent}
        <span class="mob-trk-card-num-label">${numLabel}</span>
      </div>
      <div class="mob-trk-card-body">
        <div class="mob-trk-card-name">${isRush?'🚨 ':isOverdue?'⚠ ':''}${j.name||j.address||'Unnamed'}</div>
        <div class="mob-trk-card-meta">${[clientName,j.date,pid].filter(Boolean).join(' · ')}</div>
        <span class="mob-trk-card-status" style="background:${ss.bg};color:${ss.color}">${ss.label}</span>
        ${isDhOrEmpty?'<span style="margin-left:6px;font-size:10px;color:#ef4444;font-weight:700">⚠ Unassigned</span>':''}
      </div>
      <svg class="mob-trk-card-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  }).join('');
}

function _mobTrkRenderCardsSafe(){
  try{ mobTrkRenderCards(); }
  catch(e){
    console.error('[mobTrkRenderCards]',e);
    const el=document.getElementById('mob-trk-cards');
    if(el) el.innerHTML=`<div class="mob-trk-empty" style="color:#ef4444">⚠ Error loading projects<br><span style="font-size:11px;opacity:.7">${e.message}</span></div>`;
  }
}

function mobTrkOpenProject(jobId){
  _mobTrkOpenJobId = jobId;
  mobTrkBuildDetail(jobId);
  document.getElementById('mob-tracker-main')?.classList.add('mtrk-detail-open');
}

function mobTrkBackToList(){
  document.getElementById('mob-tracker-main')?.classList.remove('mtrk-detail-open');
  _mobTrkOpenJobId = null;
  _mobTrkRenderCardsSafe(); // re-render to pick up any saves
}

function mobTrkAdd(){
  const _isPhoto = _trackerMode==='photo';
  const id = _isPhoto ? 'photo_standalone_'+Date.now() : 'standalone_'+Date.now();

  const titleEl = document.getElementById('mob-trk-add-title');
  if(titleEl) titleEl.textContent = _isPhoto ? 'New Photo Project' : 'New Video Project';

  const _statusOpts = _isPhoto
    ? (typeof PHOTO_EDIT_STATUS_OPTS!=='undefined' ? PHOTO_EDIT_STATUS_OPTS : [])
    : EDIT_STATUS_OPTS;
  const _stageOpts = typeof TRACKER_STAGES!=='undefined' ? TRACKER_STAGES : [];
  const contractorOptHtml = typeof buildEditorOptions==='function' ? buildEditorOptions('') : '';
  const vidOptHtml = typeof buildVideographerOptions==='function' ? buildVideographerOptions('') : '';
  const statusOptHtml = _statusOpts.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  const stageOptHtml = _stageOpts.map(s=>`<option value="${s.key}">${s.label}</option>`).join('');
  const today = new Date().toISOString().slice(0,10);

  const lbl = t => `<label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">${t}</label>`;
  const inp = (id,ph,type='text') => `<input id="${id}" type="${type}" placeholder="${ph}" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px;box-sizing:border-box">`;

  const body = document.getElementById('mob-trk-add-body');
  if(!body) return;

  body.innerHTML = `
    <div class="mtrk-section" style="margin-top:0">Project Info</div>

    <div class="mtrk-field">
      ${lbl(_isPhoto?'Property Address / Project':'Project Name')}
      ${inp('mtrk-add-name',_isPhoto?'123 Main St – City, Province…':'Project name…')}
    </div>

    <div class="mtrk-field">
      ${lbl('Client Name')}
      ${inp('mtrk-add-client','Client name…')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="mtrk-field" style="margin-bottom:0">
        ${lbl('Shoot Date')}
        ${inp('mtrk-add-date','','date')}
      </div>
      <div class="mtrk-field" style="margin-bottom:0">
        ${lbl('Due Date')}
        ${inp('mtrk-add-due','','date')}
      </div>
    </div>

    <div class="mtrk-section">Status</div>

    <div class="mtrk-field">
      ${lbl('Edit Status')}
      <select id="mtrk-add-status" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px">${statusOptHtml}</select>
    </div>

    ${!_isPhoto?`<div class="mtrk-field">
      ${lbl('Kanban Stage')}
      <select id="mtrk-add-stage" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px">${stageOptHtml}</select>
    </div>`:''}

    <div class="mtrk-section">Assignment</div>

    ${contractorOptHtml?`<div class="mtrk-field">
      ${lbl('Editor')}
      <select id="mtrk-add-editor" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px">${contractorOptHtml}</select>
    </div>`:''}

    ${vidOptHtml?`<div class="mtrk-field">
      ${lbl(_isPhoto?'Photographer':'Videographer')}
      <select id="mtrk-add-videographer" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px">${vidOptHtml}</select>
    </div>`:''}

    <div class="mtrk-section">Hours</div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="mtrk-field" style="margin-bottom:0">
        ${lbl(_isPhoto?'Shoot Hrs':'Film Hrs')}
        <input id="mtrk-add-film-hrs" type="number" placeholder="e.g. 2" step="0.5" min="0" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px;box-sizing:border-box">
      </div>
      <div class="mtrk-field" style="margin-bottom:0">
        ${lbl('Edit Hrs')}
        <input id="mtrk-add-edit-hrs" type="number" placeholder="e.g. 4" step="0.5" min="0" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px;box-sizing:border-box">
      </div>
    </div>

    <div class="mtrk-section">Notes</div>

    <div class="mtrk-field">
      <textarea id="mtrk-add-notes" rows="3" placeholder="Any notes…" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px;resize:vertical;box-sizing:border-box"></textarea>
    </div>

    <button onclick="mobTrkAddSave('${id}')" style="width:100%;padding:13px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--blue),#3B6FD4);color:#fff;font-size:15px;font-weight:700;cursor:pointer;margin-top:8px">${_isPhoto?'Create Photo Project':'Create Video Project'}</button>

    <div style="height:calc(20px + env(safe-area-inset-bottom,0px))"></div>
  `;

  document.getElementById('mob-tracker-main')?.classList.add('mtrk-add-open');
}

function mobTrkAddBack(){
  document.getElementById('mob-tracker-main')?.classList.remove('mtrk-add-open');
}

function mobTrkAddSave(id){
  const _isPhoto = _trackerMode==='photo';
  const name = document.getElementById('mtrk-add-name')?.value.trim()||'';
  const client = document.getElementById('mtrk-add-client')?.value.trim()||'';
  const date = document.getElementById('mtrk-add-date')?.value||'';
  const due = document.getElementById('mtrk-add-due')?.value||'';
  const status = document.getElementById('mtrk-add-status')?.value||(_isPhoto?'files_pending':'ready');
  const stage = document.getElementById('mtrk-add-stage')?.value||'ready';
  const editor = document.getElementById('mtrk-add-editor')?.value||'';
  const videographer = document.getElementById('mtrk-add-videographer')?.value||'';
  const filmHrs = document.getElementById('mtrk-add-film-hrs')?.value||'';
  const editHrs = document.getElementById('mtrk-add-edit-hrs')?.value||'';
  const notes = document.getElementById('mtrk-add-notes')?.value.trim()||'';

  if(!name){
    showDhToast('Missing','Please enter a project name','⚠','var(--amber)',2000);
    return;
  }

  const fakeJob = {
    id, name, date, address:name, clientId:null, clientName:client,
    duration:'', payouts:{}, editors:{}, services:{}, status:'confirmed',
    isStandalone:true,
  };
  if(_isPhoto) fakeJob.isPhoto = true;
  savedJobs.push(fakeJob);
  saveJobsToStorage();

  const stageData = {
    editStatus: status,
    stage: _isPhoto ? 'ready' : stage,
    claimedBy: editor,
    notes,
    completionDate: due,
    approxFilmHours: filmHrs,
    approxEditHours: editHrs,
    filesReceived: false,
    downloadLink:'', filemailLink:'', frameioLink:'', dropboxLink:'',
  };
  if(_isPhoto){
    stageData.photographer = videographer;
    setPhotoTrackerStage(id, stageData);
  } else {
    stageData.videographer = videographer;
    setTrackerStage(id, stageData);
  }

  document.getElementById('mob-tracker-main')?.classList.remove('mtrk-add-open');
  _mobTrkRenderCardsSafe();
  showDhToast(_isPhoto?'Photo Project':'Video Project', 'Created ✓', _isPhoto?'📸':'🎬', _isPhoto?'#E879F9':'var(--blue-bright)', 2000);
}

function mobTrkOpenFullModal(){
  if(!_mobTrkOpenJobId) return;
  if(_trackerMode==='photo') openPhotoTrackerModal?.(_mobTrkOpenJobId);
  else openTrackerModal?.(_mobTrkOpenJobId);
}

function mobTrkBuildDetail(jobId){
  const _isPhoto = _trackerMode==='photo';
  const _getStage = _isPhoto ? getPhotoTrackerStage : getTrackerStage;
  const _statusOpts = _isPhoto
    ? (typeof PHOTO_EDIT_STATUS_OPTS!=='undefined' ? PHOTO_EDIT_STATUS_OPTS : [])
    : EDIT_STATUS_OPTS;
  const _stageOpts = typeof TRACKER_STAGES!=='undefined' ? TRACKER_STAGES : [];

  let job = savedJobs.find(j=>String(j.id)===String(jobId));
  if(!job){
    const sp = (_isPhoto?getPhotoStandaloneProjects():getStandaloneProjects()).find(s=>String(s.id)===String(jobId));
    if(sp) job={id:sp.id,name:sp.address||sp.clientName||'Imported Project',date:sp.date,clientId:null,clientName:sp.clientName,isStandalone:true,_sp:sp};
  }
  if(!job) return;

  const ts = _getStage(jobId);
  const client = clients?.find(c=>c.id===job.clientId);
  const clientName = client?.name||job.clientName||'';
  const editStatus = ts.editStatus||(_isPhoto?'files_pending':'ready');
  const stage = ts.stage||(_stageOpts[0]?.key||'');

  // Header
  const titleEl = document.getElementById('mob-trk-dv-title');
  if(titleEl) titleEl.textContent = job.name||job.address||'Project';

  // Build options
  const editStatusOptHtml = _statusOpts.map(s=>`<option value="${s.key}"${editStatus===s.key?' selected':''}>${s.label}</option>`).join('');
  const stageOptHtml = _stageOpts.map(s=>`<option value="${s.key}"${stage===s.key?' selected':''}>${s.label}</option>`).join('');
  const contractorOptHtml = typeof buildEditorOptions==='function' ? buildEditorOptions(ts.claimedBy||'') : '';
  const vidOptHtml = typeof buildVideographerOptions==='function' ? buildVideographerOptions(ts.videographer||'') : '';

  // Link helper
  const mkLink = (href, label, color, icon) => href
    ? `<a href="${href}" target="_blank" class="mtrk-link-btn"><span class="mtrk-link-dot" style="background:${color}"></span><span class="mtrk-link-label">${label}</span><span class="mtrk-link-badge">Tap to open</span></a>`
    : `<div class="mtrk-link-btn" style="opacity:.5"><span class="mtrk-link-dot" style="background:${color}"></span><span class="mtrk-link-label">${label}</span><span class="mtrk-link-badge empty">Not set</span></div>`;

  const body = document.getElementById('mob-trk-dv-body');
  if(!body) return;

  body.innerHTML = `
    <!-- Project info -->
    <div style="padding:14px;background:var(--navy-mid);border-radius:12px;margin-bottom:16px;border:1px solid var(--border)">
      <div style="font-size:15px;font-weight:800;color:var(--white);margin-bottom:4px">${job.name||job.address||'—'}</div>
      ${clientName?`<div style="font-size:12px;color:var(--muted);margin-bottom:2px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${clientName}</div>`:''}
      ${job.date?`<div style="font-size:12px;color:var(--muted)">${job.date}</div>`:''}
    </div>

    <div class="mtrk-section">Status</div>

    <div class="mtrk-field">
      <label>Edit status</label>
      <select id="mtrk-edit-status" onchange="mobTrkSave('${jobId}','editStatus',this.value)">${editStatusOptHtml}</select>
    </div>

    ${!_isPhoto?`<div class="mtrk-field">
      <label>Kanban stage</label>
      <select id="mtrk-stage" onchange="mobTrkSave('${jobId}','stage',this.value)">${stageOptHtml}</select>
    </div>`:''}

    <div class="mtrk-section">Assignment</div>

    ${contractorOptHtml?`<div class="mtrk-field">
      <label>Editor</label>
      <select id="mtrk-editor" onchange="mobTrkSave('${jobId}','claimedBy',this.value)">${contractorOptHtml}</select>
    </div>`:''}

    ${vidOptHtml?`<div class="mtrk-field">
      <label>${_isPhoto?'Photographer':'Videographer'}</label>
      <select id="mtrk-videographer" onchange="mobTrkSave('${jobId}',${_isPhoto?`'photographer'`:`'videographer'`},this.value)">${vidOptHtml}</select>
    </div>`:''}

    <div class="mtrk-section">Footage & Files</div>

    <div class="mtrk-check-row">
      <input type="checkbox" id="mtrk-footage" ${ts.filesReceived?'checked':''} onchange="mobTrkSave('${jobId}','filesReceived',this.checked)">
      <label for="mtrk-footage">Footage / files received</label>
    </div>
    <div class="mtrk-check-row">
      <input type="checkbox" id="mtrk-rush" ${ts.rush?'checked':''} onchange="mobTrkSave('${jobId}','rush',this.checked)">
      <label for="mtrk-rush">Rush project</label>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div class="mtrk-field" style="margin-bottom:0">
        <label>Film hrs</label>
        <input type="number" id="mtrk-film-hrs" value="${ts.approxFilmHours||''}" placeholder="e.g. 2" step="0.5" min="0" onchange="mobTrkSave('${jobId}','approxFilmHours',this.value)">
      </div>
      <div class="mtrk-field" style="margin-bottom:0">
        <label>Edit hrs</label>
        <input type="number" id="mtrk-edit-hrs" value="${ts.approxEditHours||''}" placeholder="e.g. 4" step="0.5" min="0" onchange="mobTrkSave('${jobId}','approxEditHours',this.value)">
      </div>
    </div>

    <div class="mtrk-field">
      <label>Due date</label>
      <input type="date" id="mtrk-due" value="${ts.completionDate||''}" onchange="mobTrkSave('${jobId}','completionDate',this.value)">
    </div>

    <div class="mtrk-section">Links</div>

    ${mkLink(ts.frameioLink,'▶ Frame.io Review','#A78BFA','')}
    ${mkLink(ts.downloadLink,'☁ Google Drive','#5B8DEF','')}
    ${mkLink(ts.dropboxLink,'Dropbox','#0061FF','')}
    ${mkLink(ts.filemailLink,'↓ Filemail','#22D97A','')}

    <button class="mtrk-link-btn" onclick="mobTrkEditLinks('${jobId}')" style="border-color:rgba(91,141,239,.3);background:rgba(91,141,239,.06);color:var(--blue-bright)">
      <span class="mtrk-link-dot" style="background:var(--blue-bright)"></span>
      <span class="mtrk-link-label">Edit links…</span>
    </button>

    <div class="mtrk-section">Notes</div>

    <div class="mtrk-field">
      <textarea id="mtrk-notes" placeholder="Any notes…" onchange="mobTrkSave('${jobId}','notes',this.value)">${ts.notes||''}</textarea>
    </div>

    <button class="mtrk-save-btn" onclick="mobTrkSaveNotes('${jobId}')">Save Notes</button>

    <div style="height:8px"></div>
    <button onclick="mobTrkOpenFullModal()" style="width:100%;padding:11px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer;margin-top:4px">Open full editor ↗</button>
  `;
}

function mobTrkSave(jobId, key, value){
  const _isPhoto = _trackerMode==='photo';
  const _getStage = _isPhoto ? getPhotoTrackerStage : getTrackerStage;
  const storageKey = _isPhoto ? 'dronehub_photo_tracker' : 'dronehub_tracker';
  const stages = JSON.parse(localStorage.getItem(storageKey)||'{}');
  if(!stages[jobId]) stages[jobId] = _getStage(jobId);
  stages[jobId][key] = value;
  try{ localStorage.setItem(storageKey, JSON.stringify(stages)); }catch(e){}
  // Sync to Firebase if available
  if(typeof fbSubBatch==='function' && _fbToken && _fbToken()){
    fbSubBatch(_isPhoto?'photo_tracker':'tracker', [{id:jobId,...stages[jobId],_updatedAt:Date.now()}]).catch(()=>{});
  }
}

function mobTrkSaveNotes(jobId){
  const el = document.getElementById('mtrk-notes');
  if(el) mobTrkSave(jobId,'notes',el.value);
  // Brief visual feedback
  const btn = document.querySelector('.mtrk-save-btn');
  if(btn){btn.textContent='Saved ✓';btn.style.background='linear-gradient(135deg,var(--green),#16A34A)';setTimeout(()=>{btn.textContent='Save Notes';btn.style.background='';},1500);}
}

function mobTrkEditLinks(jobId){
  const _isPhoto = _trackerMode==='photo';
  const _getStage = _isPhoto ? getPhotoTrackerStage : getTrackerStage;
  const ts = _getStage(jobId);

  const overlay = document.createElement('div');
  overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9800;display:flex;align-items:flex-end';
  overlay.innerHTML=`<div style="width:100%;background:var(--navy-card);border-radius:20px 20px 0 0;padding:20px 16px calc(20px + env(safe-area-inset-bottom,0px));border-top:1px solid var(--border)">
    <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:16px;display:flex;justify-content:space-between;align-items:center">
      Edit Links <button onclick="this.closest('[style*=fixed]').remove()" style="border:none;background:none;color:var(--muted);font-size:20px;cursor:pointer;padding:0">✕</button>
    </div>
    ${!_isPhoto?`<label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Frame.io</label>
    <input type="url" id="mtrk-lnk-frameio" placeholder="https://app.frame.io/…" value="${ts.frameioLink||''}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px;margin-bottom:10px">`:''}
    <label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Google Drive</label>
    <input type="url" id="mtrk-lnk-drive" placeholder="https://drive.google.com/…" value="${ts.downloadLink||''}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px;margin-bottom:10px">
    <label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Dropbox</label>
    <input type="url" id="mtrk-lnk-dropbox" placeholder="https://www.dropbox.com/…" value="${ts.dropboxLink||''}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px;margin-bottom:10px">
    <label style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.05em;display:block;margin-bottom:4px">Filemail</label>
    <input type="url" id="mtrk-lnk-filemail" placeholder="https://…filemail.com/…" value="${ts.filemailLink||''}" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;background:var(--navy-lift);color:var(--white);font-size:14px;margin-bottom:16px">
    <button onclick="mobTrkSaveLinks('${jobId}',this.closest('[style*=fixed]'))" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--blue),#3B6FD4);color:#fff;font-size:14px;font-weight:700;cursor:pointer">Save Links</button>
  </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click',e=>{if(e.target===overlay)overlay.remove();});
}

function mobTrkSaveLinks(jobId, overlayEl){
  const frameio = document.getElementById('mtrk-lnk-frameio')?.value||'';
  const drive   = document.getElementById('mtrk-lnk-drive')?.value||'';
  const dropbox = document.getElementById('mtrk-lnk-dropbox')?.value||'';
  const filemail= document.getElementById('mtrk-lnk-filemail')?.value||'';
  mobTrkSave(jobId,'frameioLink',frameio);
  mobTrkSave(jobId,'downloadLink',drive);
  mobTrkSave(jobId,'dropboxLink',dropbox);
  mobTrkSave(jobId,'filemailLink',filemail);
  overlayEl?.remove();
  mobTrkBuildDetail(jobId); // refresh detail view
}

// Called after renderTracker() or when pane becomes active on mobile
function mobTrkRefresh(){
  if(window.innerWidth>768) return;
  _mobTrkRenderCardsSafe();
}
