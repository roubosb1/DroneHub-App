// ═══════════════════════════════════════════════════════════════════════════

const TEAM_ROLES=[
  {key:'admin',       label:'Admin',       desc:'Full access including Sales & Finance',    color:'#8B5CF6',icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'},
  {key:'editor',      label:'Editor',      desc:'Tracker, LouChat, calendar, pay stubs',   color:'#5B8DEF',icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'},
  {key:'contractor',  label:'Contractor',  desc:'Tracker, LouChat, calendar, pay stubs',   color:'#22D97A',icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'},
  {key:'sales',       label:'Sales',       desc:'Sales CRM, LouChat, calendar',            color:'#F5A623',icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>'},
];
const TEAM_ACCESS={
  admin:       {tracker:true, louchat:true, calendar:true, sales:true, payroll:true, finance:true},
  editor:      {tracker:true, louchat:true, calendar:true, sales:false,payroll:true, finance:false},
  videographer:{tracker:true, louchat:true, calendar:true, sales:false,payroll:true, finance:false},
  sales:       {tracker:false,louchat:true, calendar:true, sales:true, payroll:false, finance:false},
  contractor:  {tracker:true, louchat:true, calendar:true, sales:false,payroll:true, finance:false},
};
const ACCESS_LABELS={tracker:'Projects',louchat:'LouChat',calendar:'Calendar',sales:'Sales CRM',payroll:'Pay Stubs',finance:'Finance'};

// Global role→tab defaults used by gateShowTeamView and the custom-access picker
const TEAM_ROLE_DEFAULTS={
  admin:       ['quote','tracker','louchat','calendar','sales','payroll','finance','social','team','settings'],
  editor:      ['tracker','louchat','calendar','payroll'],
  videographer:['tracker','louchat','calendar','payroll'],
  sales:       ['louchat','calendar','sales'],
  contractor:  ['tracker','louchat','calendar','payroll'],
};

// All tabs available in the custom-access picker (display order)
const ALL_TABS_CONFIG=[
  {id:'quote',    label:'Quote Builder'},
  {id:'sales',    label:'Sales CRM'},
  {id:'calendar', label:'Calendar'},
  {id:'finance',  label:'Finance'},
  {id:'louchat',  label:'LouChat'},
  {id:'tracker',  label:'Projects'},
  {id:'payroll',  label:'Pay Stubs'},
  {id:'social',   label:'Social'},
  {id:'team',     label:'Team'},
  {id:'settings', label:'Settings'},
];

function getAdminTeamMembers(){return JSON.parse(localStorage.getItem('dronehub_admin_team')||'[]');}
function saveAdminTeamMembers(arr){
  try{localStorage.setItem('dronehub_admin_team',JSON.stringify(arr));}catch(e){}
  // SAFETY: never overwrite Firebase with an empty array — would wipe all team members
  if(arr.length > 0 && _fbToken()){
    fbSetStrict('orgs',ORG_ID+':team',{data:JSON.stringify(arr),updatedAt:Date.now()})
      .catch(e=>console.error('[saveAdminTeamMembers] Firebase write failed:',e.message));
    fbSet('orgs',ORG_ID+':team_members',{data:JSON.stringify(arr),updatedAt:Date.now()});
  }
}

// ── BOOTSTRAP TEAM MEMBERS ───────────────────────────────────────────────────
// Ensures every known team member appears on the Team tab even if they were
// never explicitly added to the roster (e.g. after a cache clear or re-invite).
// Safe to call at any time — only adds missing entries, never overwrites existing ones.
function bootstrapForceAdminTeam(){
  const TEAM_DEFAULTS=[
    // ── Admins ────────────────────────────────────────────────────────────────
    {email:'roubosb1@gmail.com',          name:'Bailey Roubos',       jobTitle:'Founder/Owner',        role:'admin', type:'admin'},
    {email:'admin@dronehubmedia.com',     name:'Admin',               jobTitle:'Admin',                role:'admin', type:'admin'},
    {email:'alex@dronehubmedia.com',      name:'Alex Shewan',         jobTitle:'Admin',                role:'admin', type:'admin'},
    {email:'mackenzie@dronehubmedia.com', name:'Mackenzie Woodhouse', jobTitle:'Sales & Acquisitions', role:'admin', type:'admin'},
    // ── Team members ──────────────────────────────────────────────────────────
    {email:'mat@dronehubmedia.com',     name:'Mat Tanguay',      jobTitle:'Head Editor',              role:'editor',     type:'team'},
    {email:'brad@dronehubmedia.com',    name:'Brad Loiselle',    jobTitle:'Videographer/Photographer', role:'contractor', type:'team'},
    {email:'connor@dronehubmedia.com',  name:'Connor Reeves',    jobTitle:'Editor',                   role:'editor',     type:'team'},
    {email:'steve@dronehubmedia.com',   name:'Steve Calaguiro',  jobTitle:'Photographer',             role:'contractor', type:'team'},
    {email:'akbar@dronehubmedia.com',   name:'Akbar Omar',       jobTitle:'Videographer/Photographer', role:'contractor', type:'team'},
  ];
  const members=getAdminTeamMembers();
  const emailIndex={};
  members.forEach((m,i)=>{ emailIndex[(m.email||'').toLowerCase().trim()]=i; });
  let changed=0;
  const today=new Date().toISOString().slice(0,10);
  TEAM_DEFAULTS.forEach(def=>{
    const key=def.email.toLowerCase();
    if(emailIndex[key]===undefined){
      // Add missing member
      members.push({
        id:'tm_'+def.email.split('@')[0].replace(/[^a-z0-9]/g,''),
        name:def.name, email:def.email, phone:'',
        type:def.type, role:def.role, jobTitle:def.jobTitle,
        orgId:ORG_ID, status:'active',
        invitedAt:'2024-01-01', activatedAt:'2024-01-01', addedAt:today,
      });
      changed++;
    } else {
      // Update any fields that are blank or stale (never overwrite user-set values)
      const m=members[emailIndex[key]];
      if(!m.jobTitle && def.jobTitle){ m.jobTitle=def.jobTitle; changed++; }
      if(!m.role    && def.role)     { m.role=def.role;         changed++; }
      if(!m.name    && def.name)     { m.name=def.name;         changed++; }
    }
  });
  if(changed>0) saveAdminTeamMembers(members);
}

// ── MERGE DUPLICATE ACCOUNTS ──────────────────────────────────────────────────
// Finds all duplicate emails in gate_users and admin_team, merges them into one
// record each, and syncs both to Firebase. Safe to call at any time.
function mergeTeamDuplicates(silent){
  let dupeCount=0;

  // 1. Merge login accounts (dronehub_gate_users)
  const users=gateGetUsers();
  const uMap={};
  users.forEach(u=>{
    const key=(u.email||'').toLowerCase().trim();
    if(!key) return;
    if(!uMap[key]){
      uMap[key]={...u};
    } else {
      dupeCount++;
      const ex=uMap[key];
      // Prefer the entry that has a passHash; if both have one, prefer newer createdAt
      const uNewer=u.createdAt&&ex.createdAt&&u.createdAt>ex.createdAt;
      if(u.passHash&&(!ex.passHash||uNewer)) ex.passHash=u.passHash;
      // Fill in any missing fields from the other record
      if(u.name&&!ex.name) ex.name=u.name;
      if(u.jobTitle&&!ex.jobTitle) ex.jobTitle=u.jobTitle;
      if(u.role&&ex.role==='contractor'&&u.role!=='contractor') ex.role=u.role;
      if(u.type==='admin') ex.type='admin'; // if either was admin, keep admin
      if(u.createdAt&&(!ex.createdAt||u.createdAt>ex.createdAt)) ex.createdAt=u.createdAt;
    }
  });
  const mergedUsers=Object.values(uMap);
  if(mergedUsers.length<users.length){
    gateSaveUsers(mergedUsers);
  }

  // 2. Merge admin team roster (dronehub_admin_team)
  const members=getAdminTeamMembers();
  const mMap={};
  members.forEach(m=>{
    const key=(m.email||'').toLowerCase().trim();
    if(!key) return;
    if(!mMap[key]){
      mMap[key]={...m};
    } else {
      const ex=mMap[key];
      // Active beats invited beats anything else
      if(m.status==='active') ex.status='active';
      // Keep most recent activity timestamps
      if(m.activatedAt&&(!ex.activatedAt||m.activatedAt>ex.activatedAt)) ex.activatedAt=m.activatedAt;
      if(m.lastSeen&&(!ex.lastSeen||m.lastSeen>ex.lastSeen)) ex.lastSeen=m.lastSeen;
      // Carry over data from whichever record has it
      if(m.customTabs?.length&&!ex.customTabs?.length) ex.customTabs=m.customTabs;
      if(m.hourlyRate&&!ex.hourlyRate) ex.hourlyRate=m.hourlyRate;
      if(m.phone&&!ex.phone) ex.phone=m.phone;
      if(m.name&&!ex.name) ex.name=m.name;
      if(m.jobTitle&&!ex.jobTitle) ex.jobTitle=m.jobTitle;
      if(m.role&&ex.role==='contractor'&&m.role!=='contractor') ex.role=m.role;
    }
  });
  const mergedMembers=Object.values(mMap);
  if(mergedMembers.length<members.length){
    saveAdminTeamMembers(mergedMembers);
  }

  if(!silent){
    const removed=users.length-mergedUsers.length + members.length-mergedMembers.length;
    const toast=document.createElement('div');
    toast.textContent=removed>0
      ?`✓ Merged ${removed} duplicate account${removed!==1?'s':''} — team list cleaned up`
      :'No duplicate accounts found';
    toast.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:'+(removed>0?'#1D9E75':'#444')+';color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4)';
    document.body.appendChild(toast);
    setTimeout(()=>toast.remove(),3500);
  }

  if(mergedMembers.length<members.length) renderTeam();
  return users.length-mergedUsers.length + members.length-mergedMembers.length;
}

async function teamForceSync(){
  try{
    let members=[];

    // Pull orgs first so invite code shows correctly
    const fbOrgs=await fbGet('orgs',ORG_ID+':orgs_data');
    if(fbOrgs?.data){
      try{
        const orgsData=JSON.parse(fbOrgs.data||'[]');
        if(orgsData.length>0){
          localStorage.setItem('dronehub_orgs',JSON.stringify(orgsData));
        }
      }catch(e){}
    }

    // Check all possible keys where team data might be stored
    const keysToCheck=[ORG_ID+':team',ORG_ID+':admin_team',ORG_ID+':team_members'];
    for(const key of keysToCheck){
      const fb=await fbGet('orgs',key);
      if(fb?.data){
        try{
          const parsed=JSON.parse(fb.data||'[]');
          if(Array.isArray(parsed)&&parsed.length>members.length) members=parsed;
        }catch(e){}
      }
    }

    // Also check gate_users and merge
    const fbGate=await fbGet('orgs',ORG_ID+':gate_users');
    if(fbGate?.data){
      try{
        const gateUsers=JSON.parse(fbGate.data||'[]');
        gateUsers.filter(u=>u.type==='team'||u.type==='admin').forEach(u=>{
          if(!members.find(m=>m.email?.toLowerCase()===u.email?.toLowerCase())){
            members.push({
              id:'tmadmin_'+u.email.replace(/[^a-z0-9]/g,'_'),
              name:u.name||u.email,email:u.email,phone:'',
              type:u.type||'team',role:u.role||'contractor',
              orgId:'org_default',
              status:u.passHash?'active':'invited',
              addedAt:u.createdAt||new Date().toISOString().slice(0,10),
            });
          }
        });
      }catch(e){}
    }

    if(members.length>0){
      localStorage.setItem('dronehub_admin_team',JSON.stringify(members));
      fbSet('orgs',ORG_ID+':team',{data:JSON.stringify(members),updatedAt:Date.now()});
    }
    renderTeam();
  }catch(e){
    console.error('Team sync error:',e);
  }
}

function getRelativeTime(ts){
  if(!ts) return null;
  const now=Date.now();
  // Handle both ISO format and "YYYY-MM-DD HH:MM:SS" format
  const then=new Date(ts.includes('T')?ts:ts.replace(' ','T')).getTime();
  if(isNaN(then)) return null;
  const diff=Math.floor((now-then)/1000);
  if(diff<60) return 'Just now';
  if(diff<3600) return Math.floor(diff/60)+' min ago';
  if(diff<86400) return Math.floor(diff/3600)+' hr ago';
  if(diff<604800) return Math.floor(diff/86400)+' day'+(Math.floor(diff/86400)===1?'':'s')+' ago';
  return new Date(then).toLocaleDateString('en-CA',{month:'short',day:'numeric'});
}

function renderTeam(){
  // Silently merge any duplicate accounts on every render so they never accumulate
  mergeTeamDuplicates(true);

  // Pull fresh data from Firebase so lastSeen/status from team member devices
  // is always reflected in the admin view. Check BOTH :team and :team_members keys
  // and merge them — use whichever has more members to prevent data loss.
  if(_fbToken()){
    Promise.all([
      fbGet('orgs',ORG_ID+':team').catch(()=>null),
      fbGet('orgs',ORG_ID+':team_members').catch(()=>null),
    ]).then(([fbTeam, fbTeamMembers])=>{
      let best = [];
      const parse = (fb) => {
        try{ return fb?.data ? JSON.parse(fb.data) : []; }catch(e){ return []; }
      };
      const a = parse(fbTeam);
      const b = parse(fbTeamMembers);
      // Merge by email — union of both sources
      const emailMap = {};
      [...a, ...b].forEach(m=>{
        const key=(m.email||'').toLowerCase().trim();
        if(!key){ best.push(m); return; } // keep no-email members
        if(!emailMap[key]){
          emailMap[key]={...m};
        } else {
          const ex=emailMap[key];
          // Keep the more complete/recent version
          if(m.status==='active') ex.status='active';
          if(m.lastSeen&&(!ex.lastSeen||m.lastSeen>ex.lastSeen)) ex.lastSeen=m.lastSeen;
          if(m.activatedAt&&(!ex.activatedAt||m.activatedAt>ex.activatedAt)) ex.activatedAt=m.activatedAt;
          if(m.customTabs?.length&&!ex.customTabs?.length) ex.customTabs=m.customTabs;
          if(m.hourlyRate&&!ex.hourlyRate) ex.hourlyRate=m.hourlyRate;
          if(m.phone&&!ex.phone) ex.phone=m.phone;
          if(m.name&&!ex.name) ex.name=m.name;
          if(m.jobTitle&&!ex.jobTitle) ex.jobTitle=m.jobTitle;
        }
      });
      best = [...best, ...Object.values(emailMap)];
      if(best.length > 0){
        const local = getAdminTeamMembers();
        // Only update localStorage and Firebase if we got MORE members than what we have locally
        // This prevents a stale Firebase doc from clobbering a complete local copy
        if(best.length >= local.length){
          localStorage.setItem('dronehub_admin_team',JSON.stringify(best));
          // Write the merged result back to :team so it stays authoritative
          if(best.length > local.length){
            fbSet('orgs',ORG_ID+':team',{data:JSON.stringify(best),updatedAt:Date.now()});
          }
          _renderTeamUI(); // re-render with fresh data
        }
      }
    }).catch(()=>{});
  }
  _renderTeamUI(); // render immediately with cached data, Firebase update follows
}
function _renderTeamUI(){
  const members=getAdminTeamMembers();
  const grid=document.getElementById('team-members-grid');
  const empty=document.getElementById('team-empty-state');
  const codeEl=document.getElementById('team-invite-code-display');
  const org=ensureDefaultOrg();
  if(codeEl) codeEl.textContent=org.inviteCode||'—';
  if(!members.length){if(grid)grid.innerHTML='';if(empty)empty.style.display='block';return;}
  if(empty)empty.style.display='none';
  grid.innerHTML=members.map(m=>{
    const role=TEAM_ROLES.find(r=>r.key===m.role)||TEAM_ROLES[4];
    const access=TEAM_ACCESS[m.role]||TEAM_ACCESS.contractor;
    const initials=(m.name||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    const dot=(c)=>`<span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${c};margin-right:4px;vertical-align:middle;flex-shrink:0"></span>`;
    const lastSeenRel=getRelativeTime(m.lastSeen);
    const _lsMs=m.lastSeen?(Date.now()-new Date(m.lastSeen).getTime()):Infinity;
    const isOnline=_lsMs<15*60*1000;           // within 15 min → Online now
    const isWithin24h=_lsMs<24*60*60*1000;     // within 24 h  → Last seen X
    let statusColor, statusLabel;
    if(m.status==='invited'){
      statusColor='var(--amber)';
      statusLabel=dot('var(--amber)')+'Invited — awaiting signup';
    } else if(!m.lastSeen){
      statusColor='var(--amber)';
      statusLabel=dot('var(--amber)')+'Needs to sign up';
    } else if(isOnline){
      statusColor='var(--green)';
      statusLabel=dot('var(--green)')+'Online now';
    } else if(isWithin24h){
      statusColor='var(--amber)';
      statusLabel=dot('var(--amber)')+'Last seen '+lastSeenRel;
    } else {
      statusColor='var(--red)';
      statusLabel=dot('var(--red)')+'Offline';
    }
    // Build effective access map — customTabs takes priority over role defaults
    let effectiveAccess;
    if(m.customTabs?.length){
      effectiveAccess={};
      ALL_TABS_CONFIG.forEach(t=>{ effectiveAccess[t.id]=m.customTabs.includes(t.id); });
    } else {
      effectiveAccess={...access, sales:canAccessSales(m.email)};
    }
    const TAB_LABELS={...ACCESS_LABELS,...Object.fromEntries(ALL_TABS_CONFIG.map(t=>[t.id,t.label]))};
    const accessBadges=Object.entries(effectiveAccess).map(([k,v])=>`<span style="padding:2px 7px;border-radius:6px;font-size:10px;font-weight:600;background:${v?'rgba(34,217,122,.12)':'rgba(255,255,255,.04)'};color:${v?'var(--green)':'var(--muted)'}">${v?'✓':'✕'} ${TAB_LABELS[k]||k}</span>`).join('');
    return `<div class="card" style="padding:12px">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
        ${getAvatarHtml(m.name,m.email,36,12)}
        <div style="min-width:0;flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.name}</div>
          <div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.email}</div>
        </div>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
        <span style="font-size:10px;color:${statusColor};font-weight:600;display:flex;align-items:center">${statusLabel}</span>
        ${m.activatedAt?`<span style="font-size:9px;color:var(--muted);white-space:nowrap">Joined ${m.activatedAt}</span>`:''}
      </div>
      ${m.phone?`<div style="font-size:10px;color:var(--muted);margin-bottom:6px">${m.phone}</div>`:''}
      <div style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;background:${role.color}18;border:1px solid ${role.color}44;margin-bottom:6px">
        <span style="font-size:12px">${role.icon}</span><span style="font-size:10px;font-weight:700;color:${role.color}">${role.label}</span>
        <span style="font-size:9px;color:${role.color}88">· ${m.type||'contractor'}</span>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:8px">${accessBadges}</div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:8px">
        <button onclick="openTeamMemberProfile('${m.id}')" style="padding:4px 12px;border-radius:8px;border:1px solid rgba(139,92,246,.4);background:rgba(139,92,246,.1);color:#A78BFA;font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px">Profile</button>
        ${m.status==='invited'?`<button onclick="resendTeamInvite('${m.id}')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Resend invite</button>`:''}
        <button onclick="openEditTeamMemberModal('${m.id}')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
        <button onclick="adminLinkMember('${m.id}')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg> Link</button>
        <button onclick="adminResetPassword('${m.id}')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Reset pw</button>
        <button onclick="removeTeamMember('${m.id}')" style="padding:4px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> Remove</button>
      </div>
    </div>`;
  }).join('');
}

function copyTeamInviteCode(){
  const code=document.getElementById('team-invite-code-display')?.textContent;
  if(code&&code!=='—'){
    navigator.clipboard.writeText(code).catch(()=>{});
    const btn=event?.target;
    if(btn){btn.textContent='✓ Copied!';setTimeout(()=>btn.textContent='Copy',2000);}
  }
}

function getInviteLink(role){
  const org=ensureDefaultOrg();
  const code=org.inviteCode||'';
  const base=window.location.href.split('?')[0].split('#')[0];
  return base+'?invite='+encodeURIComponent(code)+'&tab=signup'+(role?'&role='+encodeURIComponent(role):'');
}

function sendTeamInviteEmail(){
  const emailEl=document.getElementById('team-invite-email-input');
  const statusEl=document.getElementById('team-invite-send-status');
  const btnEl=document.querySelector('[onclick="sendTeamInviteEmail()"]');
  const email=(emailEl?.value||'').trim();
  if(!email||!email.includes('@')){
    if(statusEl){statusEl.textContent='Please enter a valid email address.';statusEl.style.color='var(--red)';statusEl.style.display='block';}
    return;
  }
  const org=ensureDefaultOrg();
  const code=org.inviteCode||'';
  const link=getInviteLink();
  const bname=bizSettings?.name||'DroneHub Media';

  if(btnEl){btnEl.textContent='Sending…';btnEl.disabled=true;}
  if(statusEl){statusEl.textContent='Sending…';statusEl.style.color='var(--muted)';statusEl.style.display='block';}

  emailjs.send('service_f0gwd3p','template_5demfu7',{
    to_email:email,
    invite_link:link,
    invite_code:code,
    company_name:bname,
  },'Ch7hmj99uF1tLKhMj').then(()=>{
    if(emailEl) emailEl.value='';
    if(btnEl){btnEl.textContent='Send invite';btnEl.disabled=false;}
    if(statusEl){
      statusEl.textContent='✓ Invite sent to '+email;
      statusEl.style.color='var(--green)';
      statusEl.style.display='block';
      setTimeout(()=>statusEl.style.display='none',5000);
    }
  }).catch(err=>{
    const msg=err?.text||err?.message||JSON.stringify(err)||'error';
    console.error('EmailJS error:',msg,err);
    if(btnEl){btnEl.textContent='Send invite';btnEl.disabled=false;}
    if(statusEl){
      statusEl.textContent='Failed: '+msg;
      statusEl.style.color='var(--red)';
      statusEl.style.display='block';
    }
  });
}

function copyTeamInviteLink(){
  const link=getInviteLink();
  if(navigator.clipboard){
    navigator.clipboard.writeText(link).then(()=>{
      const btn=event?.target;
      if(btn){const orig=btn.textContent;btn.textContent='✓ Copied!';setTimeout(()=>btn.textContent=orig,2000);}
    }).catch(()=>prompt('Copy this invite link:',link));
  } else {
    prompt('Copy this invite link:',link);
  }
}

function regenerateInviteCode(){
  if(!confirm('Regenerate invite code? The old code will stop working immediately.')) return;
  const orgs=JSON.parse(localStorage.getItem('dronehub_orgs')||'[]');
  const newCode='DH-'+Math.random().toString(36).slice(2,8).toUpperCase();
  if(orgs.length) orgs[0].inviteCode=newCode;
  try{localStorage.setItem('dronehub_orgs',JSON.stringify(orgs));}catch(e){}
  renderTeam();
}

function openAddTeamMemberModal(editId){
  const existing=editId?getAdminTeamMembers().find(m=>m.id===editId):null;
  const modal=document.createElement('div');
  modal.id='add-team-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9700;display:flex;align-items:flex-start;justify-content:center;padding:30px 20px;overflow-y:auto';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  const roleOpts=TEAM_ROLES.map(r=>`
    <label class="team-role-label" data-role="${r.key}" onclick="teamHighlightRole('${r.key}');teamUpdateCustomTabs('${r.key}')" style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:10px;border:2px solid ${existing?.role===r.key?r.color:'var(--border)'};background:${existing?.role===r.key?r.color+'18':'transparent'};cursor:pointer;margin-bottom:6px;transition:all .15s">
      <input type="radio" name="new-member-role" value="${r.key}" ${(existing?.role===r.key||(!existing&&r.key==='contractor'))?'checked':''} style="margin-top:2px;accent-color:${r.color}">
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--white)">${r.icon} ${r.label}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:1px">${r.desc}</div>
        <div style="display:flex;flex-wrap:wrap;gap:3px;margin-top:5px">
          ${Object.entries(TEAM_ACCESS[r.key]).map(([k,v])=>`<span style="padding:1px 6px;border-radius:4px;font-size:9px;font-weight:600;background:${v?'rgba(34,217,122,.12)':'rgba(255,255,255,.04)'};color:${v?'var(--green)':'var(--muted)'}">${v?'✓':'✕'} ${ACCESS_LABELS[k]}</span>`).join('')}
        </div>
      </div>
    </label>`).join('');

  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:560px;border:1px solid var(--border-bright);overflow:hidden" onclick="event.stopPropagation()">
    <div style="background:var(--navy-mid);padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:15px;font-weight:700;color:var(--white)">${existing?'Edit team member':'Add team member'}</div>
      <button onclick="document.getElementById('add-team-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:20px">✕</button>
    </div>
    <div style="padding:20px;max-height:80vh;overflow-y:auto">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Full name</label>
        <input type="text" id="new-member-name" value="${existing?.name||''}" placeholder="e.g. Brad Loiselle" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)"></div>
        <div><label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Email address</label>
        <input type="email" id="new-member-email" value="${existing?.email||''}" placeholder="brad@email.com" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div><label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Phone (optional)</label>
        <input type="tel" id="new-member-phone" value="${existing?.phone||''}" placeholder="905-555-0100" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)"></div>
        <div><label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Employment type</label>
        <select id="new-member-type" style="width:100%;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
          <option value="contractor" ${existing?.type==='contractor'?'selected':''}>Contractor (1099)</option>
          <option value="employee" ${existing?.type==='employee'?'selected':''}>Employee (T4/W-2)</option>
        </select></div>
      </div>
      <div style="margin-bottom:14px"><label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Role & platform access</label>
        <div id="team-role-options">${roleOpts}</div>
      </div>
      <div style="margin-bottom:14px;padding:14px 16px;background:var(--navy-lift);border-radius:10px;border:1px solid var(--border-bright)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:11px;font-weight:700;color:var(--offwhite);display:flex;align-items:center;gap:6px">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            Custom Tab Access
          </div>
          <span style="font-size:10px;color:var(--muted)">Overrides role defaults</span>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px" id="ctab-grid">
          ${ALL_TABS_CONFIG.map(t=>{
            const roleDefault=(TEAM_ROLE_DEFAULTS[existing?.role||'contractor']||[]).includes(t.id);
            const checked=existing?.customTabs?.length?existing.customTabs.includes(t.id):roleDefault;
            return '<label style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;border:1px solid var(--border);background:var(--navy-card);cursor:pointer;font-size:12px;color:var(--offwhite);user-select:none"><input type="checkbox" id="ctab-'+t.id+'" value="'+t.id+'" '+(checked?'checked':'')+' style="accent-color:var(--blue-bright);width:13px;height:13px;flex-shrink:0"> '+t.label+'</label>';
          }).join('')}
        </div>
        <div style="margin-top:8px;font-size:10px;color:var(--muted)">Selecting a role above resets these to that role's defaults — customize as needed.</div>
      </div>
      <div style="margin-bottom:14px;padding:12px 14px;background:var(--navy-lift);border-radius:10px;border:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--offwhite);margin-bottom:8px;display:flex;align-items:center;gap:6px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Hourly rate (editors)</div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:13px;color:var(--muted)">$</span>
          <input type="number" id="new-member-hourly-rate" value="${existing?.hourlyRate||''}" placeholder="e.g. 25" min="0" step="0.50"
            style="width:100px;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-card);color:var(--white)">
          <span style="font-size:11px;color:var(--muted)">/hr — used to auto-calculate editor paystubs from hours logged in the tracker</span>
        </div>
      </div>
      <div style="margin-bottom:16px;padding:12px 14px;background:var(--navy-lift);border-radius:10px;border:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--offwhite);margin-bottom:4px;display:flex;align-items:center;gap:6px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Invite email</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.7">Clicking <strong style="color:var(--white)">Save & send invite</strong> will open your email client with a pre-written invite. They'll receive the org invite code and instructions to sign up on the Team Portal.<br><span style="font-size:10px">Financials are always hidden from non-admin roles.</span></div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button onclick="saveTeamMemberFromModal('${editId||''}')" style="padding:8px 22px;border-radius:14px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:7px">${existing?'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Save changes':'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Save & send invite'}</button>
        <button onclick="document.getElementById('add-team-modal').remove()" style="padding:8px 14px;border-radius:14px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function openEditTeamMemberModal(id){openAddTeamMemberModal(id);}

function teamHighlightRole(roleKey){
  document.querySelectorAll('.team-role-label').forEach(el=>{
    const r=TEAM_ROLES.find(r=>r.key===el.dataset.role);
    const isSelected=el.dataset.role===roleKey;
    el.style.borderColor=isSelected?(r?.color||'var(--blue)'):'var(--border)';
    el.style.background=isSelected?(r?.color||'#5B8DEF')+'18':'transparent';
  });
}

// Reset custom tab checkboxes to match the selected role's defaults
function teamUpdateCustomTabs(roleKey){
  // Also ensure the matching radio is checked (handles label onclick)
  const radio=document.querySelector('input[name="new-member-role"][value="'+roleKey+'"]');
  if(radio) radio.checked=true;
  const defaults=TEAM_ROLE_DEFAULTS[roleKey]||[];
  ALL_TABS_CONFIG.forEach(t=>{
    const cb=document.getElementById('ctab-'+t.id);
    if(cb) cb.checked=defaults.includes(t.id);
  });
}

function saveTeamMemberFromModal(editId){
  const name=document.getElementById('new-member-name')?.value.trim();
  const email=document.getElementById('new-member-email')?.value.trim();
  const phone=document.getElementById('new-member-phone')?.value.trim()||'';
  const type=document.getElementById('new-member-type')?.value||'contractor';
  const role=document.querySelector('input[name="new-member-role"]:checked')?.value||'contractor';
  const hourlyRate=parseFloat(document.getElementById('new-member-hourly-rate')?.value||0)||0;
  if(!name){alert('Please enter a name.');return;}
  if(!email||!email.includes('@')){alert('Please enter a valid email address.');return;}
  // Collect custom tab selections
  const customTabs=ALL_TABS_CONFIG.filter(t=>document.getElementById('ctab-'+t.id)?.checked).map(t=>t.id);
  const members=getAdminTeamMembers();
  const org=ensureDefaultOrg();
  const isNew=!editId;
  const prev=editId?members.find(m=>m.id===editId):null;
  const member={
    id:editId||('tmadmin_'+Date.now()),
    name,email,phone,type,role,orgId:org.id,
    hourlyRate:hourlyRate||0,
    customTabs,
    status:prev?.status||'invited',
    invitedAt:prev?.invitedAt||new Date().toISOString().slice(0,10),
    addedAt:new Date().toISOString().slice(0,10),
  };
  if(editId){const idx=members.findIndex(m=>m.id===editId);if(idx>=0)members[idx]=member;else members.push(member);}
  else members.push(member);
  saveAdminTeamMembers(members);

  // ── LINK TO CONTRACTORS ───────────────────────────────────────────────────
  // If role is contractor, create/update their CONTRACTORS record
  if(role==='contractor'&&email){
    const cKey='c_'+email.replace(/[^a-z0-9]/g,'_');
    const existing=CONTRACTORS[cKey];
    CONTRACTORS[cKey]={
      name,email,phone,
      addr:existing?.addr||'',
      lat:existing?.lat||0,
      lng:existing?.lng||0,
      role:'Contractor (Videographer, Photographer, Other)',
      rate:existing?.rate||80,
      notes:'',
      teamMemberId:member.id,
    };
    saveContractors();
    populateContractorDropdowns();
  }
  // Sync to portal team members
  if(isNew){
    const pm=getTeamMembers();
    if(!pm.find(m=>m.email===email)){
      pm.push({id:'tm_'+Date.now(),name,email,passHash:'',orgId:org.id,role,createdAt:new Date().toISOString().slice(0,10)});
      saveTeamMembers(pm);
    }
    // Pre-add to gate_users so they can log in once they sign up
    const gateUsers=gateGetUsers();
    if(!gateUsers.find(u=>u.email.toLowerCase()===email.toLowerCase())){
      gateUsers.push({
        email,name,role,type:'team',
        jobTitle:PRESET_JOB_TITLES[email.toLowerCase()]?.title||'',
        passHash:'', // will be set when they sign up
        clientId:null,
        status:'invited',
        createdAt:new Date().toISOString().slice(0,10),
      });
      gateSaveUsers(gateUsers);
    }
  }
  document.getElementById('add-team-modal')?.remove();
  populateSalespersonDropdown();
  // Send invite via EmailJS
  if(isNew){
    const bname=bizSettings?.name||'DroneHub Media';
    const link=getInviteLink(role);
    const code=org.inviteCode||'';
    emailjs.send('service_f0gwd3p','template_5demfu7',{
      to_email:email,
      invite_link:link,
      invite_code:code,
      company_name:bname,
    },'Ch7hmj99uF1tLKhMj').then(()=>{
      // Show success in team invite status
      const s=document.getElementById('team-invite-send-status');
      if(s){s.textContent='✓ Invite sent to '+email;s.style.color='var(--green)';s.style.display='block';setTimeout(()=>s.style.display='none',5000);}
    }).catch(err=>{
      console.error('EmailJS error:',err);
      // Fallback to mailto
      const roleLabel=TEAM_ROLES.find(r=>r.key===role)?.label||role;
      const subject=encodeURIComponent('You\'re invited to join '+bname);
      const body=encodeURIComponent('Hi '+name+',\n\nYou\'ve been invited to join '+bname+' as a '+roleLabel+'.\n\nSign up here:\n'+link+'\n\nOr enter invite code: '+code+'\n\n'+bname);
      window.open('mailto:'+email+'?subject='+subject+'&body='+body);
    });
  }
  renderTeam();
}

function adminLinkMember(id){
  const members=getAdminTeamMembers();
  const m=members.find(tm=>tm.id===id);
  if(!m) return;

  // Force link by marking them active and adding to gate_users
  const now=new Date().toISOString().slice(0,10);
  m.status='active';
  m.activatedAt=now;
  saveAdminTeamMembers(members);

  // Make sure they're in gate_users
  const gateUsers=gateGetUsers();
  const existing=gateUsers.findIndex(u=>u.email.toLowerCase()===m.email.toLowerCase());
  if(existing>=0){
    gateUsers[existing].role=m.role;
    gateUsers[existing].type=m.role==='admin'?'admin':'team';
    gateUsers[existing].status='active';
  } else {
    gateUsers.push({
      email:m.email,name:m.name,
      role:m.role,type:m.role==='admin'?'admin':'team',
      jobTitle:m.jobTitle||PRESET_JOB_TITLES[m.email.toLowerCase()]?.title||'',
      passHash:'',clientId:null,status:'active',
      createdAt:now,
    });
  }
  gateSaveUsers(gateUsers);

  // Also add to portal team members
  const pm=getTeamMembers();
  if(!pm.find(p=>p.email.toLowerCase()===m.email.toLowerCase())){
    pm.push({id:'tm_'+Date.now(),name:m.name,email:m.email,passHash:'',orgId:ensureDefaultOrg().id,role:m.role,createdAt:now});
    saveTeamMembers(pm);
  }

  renderTeam();
  alert('✓ '+m.name+' has been linked to the team. They can now log in and will have access to the portal.');
}

function resendTeamInvite(id){
  const m=getAdminTeamMembers().find(tm=>tm.id===id);
  if(!m) return;
  const org=ensureDefaultOrg();
  const bname=bizSettings?.name||'DroneHub Media';
  emailjs.send('service_f0gwd3p','template_5demfu7',{
    to_email:m.email,
    invite_link:getInviteLink(),
    invite_code:org.inviteCode||'',
    company_name:bname,
  },'Ch7hmj99uF1tLKhMj')
  .then(()=>alert('✓ Invite resent to '+m.email))
  .catch(err=>alert('Failed to send: '+(err?.text||err?.message||'error')));
}

function removeTeamMember(id){
  const m=getAdminTeamMembers().find(tm=>tm.id===id);
  if(!m||!confirm('Remove '+m.name+' from the team? They will lose portal access.')) return;
  // Remove from all lists
  saveAdminTeamMembers(getAdminTeamMembers().filter(tm=>tm.id!==id));
  saveTeamMembers(getTeamMembers().filter(tm=>tm.email!==m.email));
  // Remove from gate_users so they can't log in
  const gateUsers=gateGetUsers();
  gateSaveUsers(gateUsers.filter(u=>u.email.toLowerCase()!==m.email.toLowerCase()));
  renderTeam();
}

async function adminResetPassword(id){
  const m=getAdminTeamMembers().find(tm=>tm.id===id);
  if(!m) return;
  const newPass=prompt('Set a new temporary password for '+m.name+':');
  if(!newPass||newPass.length<4){alert('Password must be at least 4 characters.');return;}
  const _arpHash=await hashPass(m.email,newPass);
  const gateUsers=gateGetUsers();
  const idx=gateUsers.findIndex(u=>u.email.toLowerCase()===m.email.toLowerCase());
  if(idx>=0){
    gateUsers[idx].passHash=_arpHash;
    gateSaveUsers(gateUsers);
    alert('✓ Password reset for '+m.name+'. Temporary password: '+newPass+'\n\nPlease tell them to change it after logging in.');
  } else {
    // Add them to gate_users with the new password
    gateUsers.push({email:m.email,name:m.name,role:m.role,type:'team',passHash:_arpHash,clientId:null});
    gateSaveUsers(gateUsers);
    alert('✓ Account created for '+m.name+'. Temporary password: '+newPass);
  }
}

function getStandaloneProjects(){return JSON.parse(localStorage.getItem('dronehub_standalone_projects')||'[]');}
function saveStandaloneProjects(arr){
  // Always strip blank entries before saving — prevents phantom imports from persisting
  const clean=(arr||[]).filter(sp=>sp.address||sp.clientName||sp.company);
  try{localStorage.setItem('dronehub_standalone_projects',JSON.stringify(clean));}catch(e){}
  if(_fbToken() && clean.length>0){
    // Each project gets its own sub-collection document
    fbSubBatch('projects', clean.map(p=>({...p,_updatedAt:Date.now()})))
      .catch(e=>{
        console.error('[saveStandaloneProjects] Firebase write failed:',e.message);
        showDhToast('Projects not saved','Standalone project records could not be saved to the cloud.','⚠️','var(--orange)',7000);
      });
  }
}
function clearAllStandaloneProjects(){
  if(!confirm('Delete ALL imported standalone projects? This cannot be undone.\n\nProjects linked to your quote builder will not be affected.')) return;
  localStorage.removeItem('dronehub_standalone_projects');
  // Also clear their tracker stage entries
  const stages=JSON.parse(localStorage.getItem('dronehub_tracker')||'{}');
  const standaloneKeys=Object.keys(stages).filter(k=>k.startsWith('standalone_'));
  standaloneKeys.forEach(k=>delete stages[k]);
  try{localStorage.setItem('dronehub_tracker',JSON.stringify(stages));}catch(e){}
  // Clear Firebase sub-collection docs
  if(_fbToken()){
    fbSubClear('projects').catch(e=>console.error('[clearAllStandaloneProjects] projects clear failed:',e.message));
    standaloneKeys.forEach(k=>fbSubDelete('tracker',k).catch(()=>{}));
  }
  renderTracker();
  showDhToast('Cleared','All imported projects removed.','✓','var(--green)',3000);
}

const TRACKER_COL_MAP={
  'project id':'projectId','project #':'projectId','id':'projectId',
  'client':'clientName','client / realtor':'clientName','client/realtor':'clientName','realtor':'clientName',
  'company':'company','company / team':'company','team':'company',
  'address':'address','property address':'address','property address / project name':'address','project name':'address',
  'shoot date':'date','date':'date',
  'videographer':'videographer','shooter':'videographer',
  'files received':'filesReceived',"files recv'd":'filesReceived','files':'filesReceived',
  'assigned editor':'claimedBy','editor':'claimedBy',
  'edit status':'editStatus','status':'editStatus',
  'approx edit hours':'approxEditHours','edit hours':'approxEditHours','edit hrs':'approxEditHours',
  'approx film hours':'approxFilmHours','film hours':'approxFilmHours','film hrs':'approxFilmHours',
  'priority':'completionDate','due date':'completionDate','priority / due date':'completionDate',
  'completion date':'completionDate',
  'notes':'notes','project notes':'notes','branding':'notes','project notes / branding / assets':'notes',
  'filemail':'filemailLink','filemail link':'filemailLink','filemail / download link':'filemailLink',
  'download link':'downloadLink','download':'downloadLink','google drive':'downloadLink','drive':'downloadLink',
  'frame.io':'frameioLink','frameio':'frameioLink',
  'dropbox':'dropboxLink','dropbox link':'dropboxLink',
};

function mapEditStatus(raw){
  if(!raw) return 'ready';
  const r=raw.toString().toLowerCase().trim();
  if(r.includes('footage')) return 'footage_pending';
  if(r.includes('d1')||r.includes('draft 1')||r.includes('draft1')) return 'draft1';
  if(r.includes('d2')||r.includes('draft 2')||r.includes('draft2')) return 'draft2';
  if(r.includes('d3')||r.includes('draft 3')||r.includes('draft3')) return 'draft3';
  if(r.includes('draft +')||r.includes('draft+')||r.includes('d4')) return 'draft_plus';
  if(r.includes('final')||r.includes('download')) return 'finals_sent';
  if(r.includes('review')) return 'review';
  if(r.includes('progress')) return 'in_progress';
  return 'ready';
}

let _trackerImportRows=[];

function openTrackerImportModal(){
  const existing=document.getElementById('tracker-import-modal');
  if(existing) existing.remove();
  const isCompleted=_trackerTab==='completed';
  const modal=document.createElement('div');
  modal.id='tracker-import-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9600;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:700px;border:1px solid var(--border-bright);overflow:hidden" onclick="event.stopPropagation()">
    <div style="background:var(--navy-mid);padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--white)">⬆ Import from Google Sheets / CSV / Excel</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Standalone projects — not linked to financials or client records</div>
      </div>
      <button onclick="document.getElementById('tracker-import-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:20px">✕</button>
    </div>
    <div style="padding:20px">
      <div style="margin-bottom:16px;padding:12px 14px;background:var(--navy-lift);border-radius:10px;border:1px solid var(--border)">
        <div style="font-size:11px;font-weight:700;color:var(--offwhite);margin-bottom:8px">Import into:</div>
        <div style="display:flex;gap:8px">
          <label id="tracker-import-dest-active-wrap" style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:7px 14px;border-radius:8px;border:2px solid ${isCompleted?'var(--border)':'var(--blue)'};background:${isCompleted?'transparent':'rgba(91,141,239,.1)'}" onclick="trackerImportDestChange('active')">
            <input type="radio" name="tracker-import-dest" id="tracker-dest-active" value="active" ${isCompleted?'':'checked'} style="accent-color:var(--blue)">
            <span style="font-size:12px;font-weight:700;color:${isCompleted?'var(--muted)':'var(--blue-bright)'}">In Progress</span>
          </label>
          <label id="tracker-import-dest-completed-wrap" style="display:flex;align-items:center;gap:7px;cursor:pointer;padding:7px 14px;border-radius:8px;border:2px solid ${isCompleted?'var(--green)':'var(--border)'};background:${isCompleted?'var(--green-bg)':'transparent'}" onclick="trackerImportDestChange('completed')">
            <input type="radio" name="tracker-import-dest" id="tracker-dest-completed" value="completed" ${isCompleted?'checked':''} style="accent-color:var(--green)">
            <span style="font-size:12px;font-weight:700;color:${isCompleted?'var(--green)':'var(--muted)'}">Completed</span>
          </label>
        </div>
        <div id="tracker-import-dest-note" style="font-size:11px;color:var(--muted);margin-top:8px;line-height:1.5">
          ${isCompleted
            ?'Projects will be imported as <strong style=\"color:var(--green)\">Completed</strong> — edit status forced to Ready to Download.'
            :'Projects will be imported as <strong style=\"color:var(--blue-bright)\">In Progress</strong> — edit status read from file.'}
        </div>
      </div>
      <div style="background:rgba(91,141,239,.07);border:1px solid rgba(91,141,239,.2);border-radius:10px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--blue-bright);margin-bottom:8px">How to export from Google Sheets</div>
        <ol style="font-size:12px;color:var(--muted);line-height:2.1;padding-left:18px;margin:0">
          <li>Open your Google Sheet · File → Download → <strong style="color:var(--offwhite)">Comma Separated Values (.csv)</strong></li>
          <li>Upload the file below or paste CSV text directly</li>
        </ol>
        <div style="margin-top:8px;padding:7px 10px;background:rgba(0,0,0,.25);border-radius:6px;font-size:10px;color:var(--muted);line-height:1.7">
          <strong style="color:var(--offwhite)">Recognised columns:</strong> Project ID · Client / Realtor · Company / Team · Property Address · Shoot Date · Videographer · Files Received · Assigned Editor · Edit Status · Approx Edit Hrs · Approx Film Hrs · Completion Date · Project Notes · Filemail Link · Download Link
        </div>
      </div>
      <div style="margin-bottom:12px">
        <div id="tracker-import-drop" onclick="document.getElementById('tracker-import-file').click()"
          style="border:2px dashed var(--border-bright);border-radius:10px;padding:20px;text-align:center;cursor:pointer;background:var(--navy-lift)"
          ondragover="event.preventDefault();this.style.borderColor='var(--green)'"
          ondragleave="this.style.borderColor='var(--border-bright)'"
          ondrop="event.preventDefault();this.style.borderColor='var(--border-bright)';trackerHandleImportDrop(event.dataTransfer.files)">
          <div style="margin-bottom:5px;color:var(--muted)">${_icon('folder',24)}</div>
          <div style="font-size:13px;color:var(--offwhite);font-weight:600">Drop CSV or Excel file here</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">or click to browse — .csv .xlsx .xls supported</div>
          <input type="file" id="tracker-import-file" accept=".csv,.xlsx,.xls" style="display:none" onchange="trackerHandleImportFile(this.files)">
        </div>
      </div>
      <div style="margin-bottom:12px">
        <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:5px;text-transform:uppercase;letter-spacing:.06em">Or paste CSV text</label>
        <textarea id="tracker-import-paste" rows="4" placeholder="Paste CSV here (include header row)…" style="width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--border-bright);border-radius:8px;font-size:11px;background:var(--navy-lift);color:var(--white);resize:vertical;font-family:monospace"></textarea>
      </div>
      <div id="tracker-import-preview" style="display:none;margin-bottom:12px">
        <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Preview (first 5 rows)</div>
        <div id="tracker-import-preview-content" style="background:var(--navy-lift);border:1px solid var(--border);border-radius:8px;overflow:auto;max-height:160px;font-size:11px"></div>
        <div id="tracker-import-count" style="font-size:12px;color:var(--green);margin-top:5px;font-weight:600"></div>
      </div>
      <div style="margin-bottom:14px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;color:var(--offwhite)">
          <input type="checkbox" id="tracker-import-skip-dupes" checked style="accent-color:var(--blue);width:14px;height:14px">
          Skip rows where Project ID already exists
        </label>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button onclick="trackerParsePreview()" style="padding:8px 18px;border-radius:12px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">Preview</button>
        <button onclick="trackerRunImport()" id="tracker-import-btn" disabled style="padding:8px 22px;border-radius:12px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;opacity:.5">✓ Import</button>
        <button onclick="document.getElementById('tracker-import-modal').remove()" style="padding:8px 14px;border-radius:12px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer">Cancel</button>
        <span id="tracker-import-status" style="font-size:12px;color:var(--muted)"></span>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function trackerImportDestChange(dest){
  const activeWrap=document.getElementById('tracker-import-dest-active-wrap');
  const completedWrap=document.getElementById('tracker-import-dest-completed-wrap');
  const note=document.getElementById('tracker-import-dest-note');
  if(dest==='completed'){
    document.getElementById('tracker-dest-completed').checked=true;
    if(activeWrap){activeWrap.style.borderColor='var(--border)';activeWrap.style.background='transparent';activeWrap.querySelector('span').style.color='var(--muted)';}
    if(completedWrap){completedWrap.style.borderColor='var(--green)';completedWrap.style.background='var(--green-bg)';completedWrap.querySelector('span').style.color='var(--green)';}
    if(note) note.innerHTML='Projects will be imported as <strong style="color:var(--green)">Completed</strong> — edit status forced to Ready to Download.';
  } else {
    document.getElementById('tracker-dest-active').checked=true;
    if(activeWrap){activeWrap.style.borderColor='var(--blue)';activeWrap.style.background='rgba(91,141,239,.1)';activeWrap.querySelector('span').style.color='var(--blue-bright)';}
    if(completedWrap){completedWrap.style.borderColor='var(--border)';completedWrap.style.background='transparent';completedWrap.querySelector('span').style.color='var(--muted)';}
    if(note) note.innerHTML='Projects will be imported as <strong style="color:var(--blue-bright)">In Progress</strong> — edit status read from file.';
  }
}


function trackerHandleImportFile(files){
  const file=files[0]; if(!file) return;
  const name=file.name.toLowerCase();
  if(name.endsWith('.csv')){
    const reader=new FileReader();
    reader.onload=e=>{document.getElementById('tracker-import-paste').value=e.target.result;trackerParsePreview();};
    reader.readAsText(file);
  } else {
    const reader=new FileReader();
    reader.onload=e=>{
      try{
        const wb=XLSX.read(e.target.result,{type:'array'});
        const ws=wb.Sheets[wb.SheetNames[0]];
        document.getElementById('tracker-import-paste').value=XLSX.utils.sheet_to_csv(ws);
        trackerParsePreview();
      }catch(err){document.getElementById('tracker-import-status').textContent='Error: '+err.message;}
    };
    reader.readAsArrayBuffer(file);
  }
}
function trackerHandleImportDrop(files){trackerHandleImportFile(files);}

function trackerParseCSV(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(l=>l);
  if(lines.length<2) return [];
  const headers=lines[0].split(',').map(h=>h.replace(/^"|"$/g,'').trim().toLowerCase());
  const rows=[];
  for(let i=1;i<lines.length;i++){
    const vals=[]; let cur='',inQ=false;
    for(const ch of lines[i]){
      if(ch==='"'){inQ=!inQ;}
      else if(ch===','&&!inQ){vals.push(cur.trim());cur='';}
      else{cur+=ch;}
    }
    vals.push(cur.trim());
    if(vals.every(v=>!v)) continue;
    const row={};
    headers.forEach((h,j)=>{const f=TRACKER_COL_MAP[h];if(f)row[f]=vals[j]||'';});
    rows.push(row);
  }
  return rows;
}

function trackerParsePreview(){
  const text=document.getElementById('tracker-import-paste')?.value.trim();
  if(!text){document.getElementById('tracker-import-status').textContent='Please upload or paste CSV first.';return;}
  _trackerImportRows=trackerParseCSV(text);
  const preview=document.getElementById('tracker-import-preview');
  const content=document.getElementById('tracker-import-preview-content');
  const count=document.getElementById('tracker-import-count');
  const btn=document.getElementById('tracker-import-btn');
  if(!_trackerImportRows.length){document.getElementById('tracker-import-status').textContent='No rows parsed — check file has a header row.';return;}
  preview.style.display='block';
  const fields=['projectId','clientName','company','address','date','videographer','claimedBy','editStatus','notes'];
  const labels={projectId:'ID',clientName:'Client',company:'Company',address:'Address',date:'Date',videographer:'Vid',claimedBy:'Editor',editStatus:'Status',notes:'Notes'};
  const sample=_trackerImportRows.slice(0,5);
  content.innerHTML=`<table style="width:100%;border-collapse:collapse">
    <thead><tr style="background:#0D1117">${fields.map(f=>`<th style="padding:5px 8px;text-align:left;font-size:10px;font-weight:700;color:var(--amber);white-space:nowrap;border-bottom:1px solid var(--border)">${labels[f]}</th>`).join('')}</tr></thead>
    <tbody>${sample.map((r,i)=>`<tr style="background:${i%2?'transparent':'rgba(255,255,255,.02)'}">
      ${fields.map(f=>`<td style="padding:4px 8px;font-size:10px;color:var(--offwhite);max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[f]||''}</td>`).join('')}
    </tr>`).join('')}</tbody>
  </table>`;
  count.textContent='✓ '+_trackerImportRows.length+' row'+(+(_trackerImportRows.length!==1)?'s':'')+' ready to import';
  btn.removeAttribute('disabled'); btn.style.opacity='1';
  document.getElementById('tracker-import-status').textContent='';
}

function trackerRunImport(){
  if(!_trackerImportRows.length){document.getElementById('tracker-import-status').textContent='Click Preview first.';return;}
  const skipDupes=document.getElementById('tracker-import-skip-dupes')?.checked;
  const destCompleted=document.getElementById('tracker-dest-completed')?.checked||false;
  const existing=getStandaloneProjects();
  const existingIds=new Set(existing.map(p=>p.projectId).filter(Boolean));
  let added=0,skipped=0;
  _trackerImportRows.forEach(row=>{
    const pid=row.projectId||('DH-IMP-'+(Date.now()%100000));
    if(skipDupes&&row.projectId&&existingIds.has(pid)){skipped++;return;}
    // If destination is Completed, force finals_sent regardless of file content
    const editStatus=destCompleted?'finals_sent':mapEditStatus(row.editStatus);
    const stage=destCompleted?'delivered':(row.stage||'footage_pending');
    existing.push({
      id:'standalone_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
      projectId:pid,
      clientName:row.clientName||'',company:row.company||'',
      address:row.address||'',date:row.date||'',
      videographer:row.videographer||'',
      filesReceived:['yes','true','1','✓','☑','x'].includes((row.filesReceived||'').toString().toLowerCase().trim()),
      claimedBy:row.claimedBy||'',
      editStatus,stage,
      approxEditHours:row.approxEditHours||'',approxFilmHours:row.approxFilmHours||'',
      completionDate:row.completionDate||'',notes:row.notes||'',
      filemailLink:row.filemailLink||'',downloadLink:row.downloadLink||'',frameioLink:row.frameioLink||'',
      isStandalone:true,
      importedAt:new Date().toISOString().slice(0,10),
    });
    existingIds.add(pid); added++;
  });
  saveStandaloneProjects(existing);
  const dest=destCompleted?'Completed tab':'In Progress tab';
  document.getElementById('tracker-import-status').innerHTML=`<span style="color:var(--green)">✓ Imported ${added} project${added!==1?'s':''} into ${dest}${skipped?' · '+skipped+' skipped':''}</span>`;
  _trackerImportRows=[];
  // Switch to the destination tab after import
  setTimeout(()=>{
    document.getElementById('tracker-import-modal')?.remove();
    trackerSetTab(destCompleted?'completed':'active');
  },1400);
}

function openTrackerAddModal(){
  const id='standalone_'+Date.now();
  const fakeJob={id,name:'New Project',date:new Date().toISOString().slice(0,10),address:'',clientId:null,clientName:'',duration:'',payouts:{},editors:{},services:{},status:'confirmed',isStandalone:true};
  savedJobs.push(fakeJob);
  openTrackerModal(id);
}

const TRACKER_STAGES=[
  {key:'footage_pending',label:'Footage Pending',color:'var(--muted)',dot:'var(--muted)'},
  {key:'ready',label:'Ready to Start',color:'var(--blue-bright)',dot:'var(--blue)'},
  {key:'in_progress',label:'In Progress',color:'var(--amber)',dot:'#F5A623'},
  {key:'review',label:'In Review',color:'var(--purple)',dot:'var(--purple)'},
  {key:'delivered',label:'Finals Sent',color:'var(--green)',dot:'var(--green)'},
];

const EDIT_STATUS_OPTS=[
  {key:'footage_pending',  label:'Footage Pending'},
  {key:'ready',            label:'Ready to Start'},
  {key:'draft1_progress',  label:'Draft 1 - In Progress'},
  {key:'draft1',           label:'Draft 1 - Sent'},
  {key:'draft2_ready',     label:'Draft 2 - Ready to Start'},
  {key:'draft2_progress',  label:'Draft 2 - In Progress'},
  {key:'draft2',           label:'Draft 2 - Sent'},
  {key:'draft3_ready',     label:'Draft 3 - Ready to Start'},
  {key:'draft3_progress',  label:'Draft 3 - In Progress'},
  {key:'draft3',           label:'Draft 3 - Sent'},
  {key:'draft_plus_ready', label:'Draft + - Ready to Start'},
  {key:'draft_plus',       label:'Draft + - In Progress'},
  {key:'finals_sent',      label:'Finals Sent'},
];

// Which edit statuses belong to which tab
const UPCOMING_STATUSES=['footage_pending','ready',''];
const INPROGRESS_STATUSES=['draft1_progress','draft1','draft2_ready','draft2_progress','draft2','draft3_ready','draft3_progress','draft3','draft_plus_ready','draft_plus'];
const COMPLETED_STATUSES=['finals_sent'];

function getTrackerTab(editStatus){
  if(!editStatus||UPCOMING_STATUSES.includes(editStatus)) return 'upcoming';
  if(COMPLETED_STATUSES.includes(editStatus)) return 'completed';
  return 'active';
}

function getTrackerStage(jobId){
  const stages=JSON.parse(localStorage.getItem('dronehub_tracker')||'{}');
  return stages[jobId]||{
    stage:'ready',claimedBy:'',claimedAt:'',notes:'',updatedAt:'',
    editStatus:'ready',filesReceived:false,downloadLink:'',filemailLink:'',
    frameioLink:'',dropboxLink:'',approxEditHours:'',approxFilmHours:'',completionDate:'',
    draftCount:0,extraDraftCharge:0,projectId:'',reviewLinks:[],
  };
}
function setTrackerStage(jobId,update){
  const stages=JSON.parse(localStorage.getItem('dronehub_tracker')||'{}');
  const existing=getTrackerStage(jobId);
  const draftCount=parseInt(update.draftCount||existing.draftCount||0);
  const extraDraftCharge=Math.max(0,draftCount-2)*30;
  const newStage={...existing,...update,draftCount,extraDraftCharge,updatedAt:new Date().toISOString().slice(0,16).replace('T',' ')};
  stages[jobId]=newStage;
  try{localStorage.setItem('dronehub_tracker',JSON.stringify(stages));}catch(e){}
  if(_fbToken()){
    // Write only this job's doc — no more re-writing the entire tracker blob
    fbSubSetStrict('tracker',String(jobId),newStage)
      .catch(e=>{
        console.error('[setTrackerStage] Firebase write failed:',e.message);
        showDhToast('Tracker not saved','Production tracker update could not be saved to the cloud.','⚠️','var(--orange)',7000);
      });
  }
}

// Generate project ID from job
// ── Sequential project IDs (DH-0001, DH-0002 …) ─────────────────────────────
// The counter is stored in localStorage and mirrored to Firebase.
// Once a project is assigned an ID it never changes, even if the address does.
function _trackerNextIdNum(){
  return parseInt(localStorage.getItem('dronehub_tracker_id_counter')||'0');
}
function _trackerIncrementId(){
  const n=_trackerNextIdNum()+1;
  localStorage.setItem('dronehub_tracker_id_counter',String(n));
  if(_fbToken()) fbSetStrict('orgs',ORG_ID+':tracker_meta',{idCounter:n,updatedAt:Date.now()}).catch(e=>console.error('[trackerMeta]',e.message));
  return n;
}
// Returns the project's stored ID, assigning a new sequential one if needed.
function ensureProjectId(jobId, ts){
  if(ts.projectId) return ts.projectId;
  const num=_trackerIncrementId();
  const pid='DH-'+String(num).padStart(4,'0');
  // Persist without triggering a full re-render (write directly to localStorage+Firebase)
  const stages=JSON.parse(localStorage.getItem('dronehub_tracker')||'{}');
  const updatedStage={...(stages[jobId]||ts),projectId:pid};
  stages[jobId]=updatedStage;
  try{localStorage.setItem('dronehub_tracker',JSON.stringify(stages));}catch(e){}
  if(_fbToken()) fbSubSet('tracker',String(jobId),updatedStage).catch(e=>console.error('[ensureProjectId]',e.message));
  return pid;
}
function getProjectId(job){
  const ts=getTrackerStage(job.id);
  return ensureProjectId(job.id, ts);
}

// ── PHOTO TRACKER DATA ───────────────────────────────────────────────────────
const PHOTO_UPCOMING_STATUSES   = ['files_pending','ready',''];
const PHOTO_INPROGRESS_STATUSES = ['culling','editing','review'];
const PHOTO_COMPLETED_STATUSES  = ['finals_sent'];

const PHOTO_EDIT_STATUS_OPTS = [
  {key:'files_pending', label:'Files Pending'},
  {key:'ready',         label:'Ready to Edit'},
  {key:'culling',       label:'Culling – In Progress'},
  {key:'editing',       label:'Editing – In Progress'},
  {key:'review',        label:'In Review'},
  {key:'finals_sent',   label:'Finals Sent ✓'},
];

// Status badge styles for photo mode (dark)
const PHOTO_STATUS_STYLES = {
  files_pending: {bg:'#2d2d2d',     color:'#A8B4D0', label:'Files Pending'},
  ready:         {bg:'#1a3a5c',     color:'#7AABFF', label:'Ready to Edit'},
  culling:       {bg:'#2a2a1a',     color:'#FCD34D', label:'Culling – In Progress'},
  editing:       {bg:'#1a2a3a',     color:'#5B8DEF', label:'Editing – In Progress'},
  review:        {bg:'#2a1a3a',     color:'#A78BFA', label:'In Review'},
  finals_sent:   {bg:'#0d2d1a',     color:'#22D97A', label:'Finals Sent ✓'},
};
const PHOTO_STATUS_STYLES_LIGHT = {
  files_pending: {bg:'#e8eaf2', color:'#4a5568', label:'Files Pending'},
  ready:         {bg:'#dbeafe', color:'#1d4ed8', label:'Ready to Edit'},
  culling:       {bg:'#fef9c3', color:'#92400e', label:'Culling – In Progress'},
  editing:       {bg:'#dbeafe', color:'#1e40af', label:'Editing – In Progress'},
  review:        {bg:'#ede9fe', color:'#5b21b6', label:'In Review'},
  finals_sent:   {bg:'#d1fae5', color:'#065f46', label:'Finals Sent ✓'},
};
const PHOTO_ROW_ACCENT = {
  files_pending:'rgba(168,180,208,.05)', ready:'rgba(122,171,255,.06)',
  culling:'rgba(252,211,77,.07)',        editing:'rgba(91,141,239,.07)',
  review:'rgba(167,139,250,.08)',        finals_sent:'rgba(34,217,122,.09)',
};
const PHOTO_ROW_ACCENT_LIGHT = {
  files_pending:'#f8f8fc', ready:'#eff6ff',
  culling:'#fefce8',       editing:'#eff6ff',
  review:'#f5f3ff',        finals_sent:'#f0fdf4',
};

function getPhotoTrackerStage(jobId){
  const stages = JSON.parse(localStorage.getItem('dronehub_photo_tracker')||'{}');
  return stages[jobId] || {
    stage:'ready', claimedBy:'', claimedAt:'', notes:'', updatedAt:'',
    editStatus:'ready', filesReceived:false, downloadLink:'', filemailLink:'',
    dropboxLink:'', approxEditHours:'', approxFilmHours:'', completionDate:'',
    photographer:'', projectId:'',
  };
}

function setPhotoTrackerStage(jobId, update){
  const stages = JSON.parse(localStorage.getItem('dronehub_photo_tracker')||'{}');
  const existing = getPhotoTrackerStage(jobId);
  stages[jobId] = {...existing, ...update, updatedAt: new Date().toISOString().slice(0,16).replace('T',' ')};
  try{localStorage.setItem('dronehub_photo_tracker', JSON.stringify(stages));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs', ORG_ID+':photo_tracker', {data:JSON.stringify(stages), updatedAt:Date.now()})
      .catch(e=>{
        console.error('[setPhotoTrackerStage] Firebase write failed:',e.message);
        showDhToast('Photo tracker not saved','Photo tracker update could not be saved to the cloud.','⚠️','var(--orange)',7000);
      });
  }
}

function getPhotoStandaloneProjects(){
  return JSON.parse(localStorage.getItem('dronehub_photo_standalone')||'[]');
}
function savePhotoStandaloneProjects(arr){
  try{localStorage.setItem('dronehub_photo_standalone', JSON.stringify(arr));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs', ORG_ID+':photo_standalone', {data:JSON.stringify(arr), updatedAt:Date.now()})
      .catch(e=>{
        console.error('[savePhotoStandaloneProjects] Firebase write failed:',e.message);
        showDhToast('Photo projects not saved','Photo standalone projects could not be saved to the cloud.','⚠️','var(--orange)',7000);
      });
  }
}

// Photo project ID counter (DHP-0001 format)
function _photoTrackerNextIdNum(){
  return parseInt(localStorage.getItem('dronehub_photo_id_counter')||'0');
}
function _photoTrackerIncrementId(){
  const n = _photoTrackerNextIdNum() + 1;
  localStorage.setItem('dronehub_photo_id_counter', String(n));
  if(_fbToken()) fbSetStrict('orgs', ORG_ID+':photo_tracker_meta', {idCounter:n, updatedAt:Date.now()}).catch(e=>console.error('[photoTrackerMeta]',e.message));
  return n;
}
function ensurePhotoProjectId(jobId, ts){
  if(ts.projectId) return ts.projectId;
  const num = _photoTrackerIncrementId();
  const pid = 'DHP-' + String(num).padStart(4,'0');
  const stages = JSON.parse(localStorage.getItem('dronehub_photo_tracker')||'{}');
  stages[jobId] = {...(stages[jobId]||ts), projectId:pid};
  try{localStorage.setItem('dronehub_photo_tracker', JSON.stringify(stages));}catch(e){}
  if(_fbToken()) fbSetStrict('orgs', ORG_ID+':photo_tracker', {data:JSON.stringify(stages), updatedAt:Date.now()}).catch(e=>console.error('[ensurePhotoProjectId]',e.message));
  return pid;
}

function openPhotoTrackerModal(jobId){
  const job = savedJobs.find(j=>String(j.id)===String(jobId)) ||
              getPhotoStandaloneProjects().find(s=>String(s.id)===String(jobId));
  const ts = getPhotoTrackerStage(jobId);
  const existing = document.getElementById('photo-tracker-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'photo-tracker-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9600;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto';
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  const addr = job?.address || job?.name || ts.projectId || '';
  const clientName = job?.clientName || '';

  const statusOpts = PHOTO_EDIT_STATUS_OPTS.map(s=>`<option value="${s.key}"${ts.editStatus===s.key?' selected':''}>${s.label}</option>`).join('');

  const _ptmLbl=(txt)=>`<label style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">${txt}</label>`;
  const _ptmInp=(id,val,placeholder,type='text')=>`<input id="${id}" type="${type}" value="${(val||'').toString().replace(/"/g,'&quot;')}" placeholder="${placeholder}" style="width:100%;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);box-sizing:border-box">`;
  modal.innerHTML = `<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:780px;border:1px solid var(--border-bright);overflow:hidden" onclick="event.stopPropagation()">
    <div style="background:linear-gradient(135deg,#1a0d2e,#0d1a3a);padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:14px;font-weight:800;color:var(--white);display:flex;align-items:center;gap:8px">Photo Project${ts.projectId?' — <span style="color:#A78BFA;font-family:monospace">'+ts.projectId+'</span>':''}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${addr||'New Photo Project'}${clientName?' · '+clientName:''}</div>
      </div>
      <button onclick="document.getElementById('photo-tracker-modal').remove()" style="border:none;background:rgba(255,255,255,.06);color:var(--muted);cursor:pointer;font-size:16px;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center">✕</button>
    </div>
    <div style="padding:16px 20px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
      <div style="grid-column:1/3">
        ${_ptmLbl('Client Name')}
        ${_ptmInp('ptm-client',clientName,'Client name…')}
      </div>
      <div>
        ${_ptmLbl('Shoot Date')}
        ${_ptmInp('ptm-shoot-date',job?.date||'','','date')}
      </div>
      <div style="grid-column:1/-1">
        ${_ptmLbl('Property Address / Project')}
        ${_ptmInp('ptm-address',addr,'123 Main St – City, Province…')}
      </div>
      <div>
        ${_ptmLbl('Photographer')}
        ${_ptmInp('ptm-photographer',ts.photographer||'','Photographer name…')}
      </div>
      <div>
        ${_ptmLbl('Photo Status')}
        <select id="ptm-status" style="width:100%;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${statusOpts}</select>
      </div>
      <div>
        ${_ptmLbl('Assigned Editor')}
        ${_ptmInp('ptm-editor',ts.claimedBy||'','Editor name…')}
      </div>
      <div>
        ${_ptmLbl('Due Date')}
        ${_ptmInp('ptm-due',ts.completionDate||'','','date')}
      </div>
      <div>
        ${_ptmLbl('Est. Edit Hrs')}
        ${_ptmInp('ptm-edithrs',ts.approxEditHours||'','e.g. 2.5')}
      </div>
      <div>
        ${_ptmLbl('Est. Shoot Hrs')}
        ${_ptmInp('ptm-shootHrs',ts.approxFilmHours||'','e.g. 1.5')}
      </div>
      <div style="grid-column:1/-1">
        ${_ptmLbl('Filemail Links <span style="font-size:9px;font-weight:400;text-transform:none;letter-spacing:0;opacity:.7">— raw footage for editor</span>')}
        <div id="ptm-filemail-links-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:5px">
          ${(ts.filemailLinks&&ts.filemailLinks.length?ts.filemailLinks:ts.filemailLink?[ts.filemailLink]:[]).map((url,i)=>`
          <div id="ptm-fl-row-${i}" style="display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center">
            <input type="url" class="ptm-fl-url" data-idx="${i}" value="${(url||'').replace(/"/g,'&quot;')}" placeholder="https://filemail.com/…" style="padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);box-sizing:border-box;min-width:0">
            <button onclick="ptmRemoveFilemailLink(${i})" style="padding:6px 9px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">✕</button>
          </div>`).join('')}
        </div>
        <button onclick="ptmAddFilemailLink()" style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.06);color:var(--green);font-size:11px;font-weight:700;cursor:pointer">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Filemail Link
        </button>
      </div>
      <div style="grid-column:1/3">
        ${_ptmLbl('Google Drive / Download Link')}
        ${_ptmInp('ptm-drive',ts.downloadLink||'','https://drive.google.com/…','url')}
      </div>
      <div>
        ${_ptmLbl('Dropbox Link')}
        ${_ptmInp('ptm-dropbox',ts.dropboxLink||'','https://dropbox.com/…','url')}
      </div>
      <div style="grid-column:1/-1">
        ${_ptmLbl('Notes')}
        <textarea id="ptm-notes" rows="2" placeholder="Project notes…" style="width:100%;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);resize:vertical;box-sizing:border-box">${ts.notes||''}</textarea>
      </div>
    </div>
    <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px">
      <button onclick="document.getElementById('photo-tracker-modal').remove()" style="padding:8px 18px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer">Cancel</button>
      <button onclick="savePhotoTrackerModal('${jobId}')" style="padding:8px 22px;border-radius:10px;border:none;background:linear-gradient(135deg,#E879F9,#9333ea);color:#fff;font-size:12px;font-weight:700;cursor:pointer">Save</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function ptmAddFilemailLink(){
  const list = document.getElementById('ptm-filemail-links-list');
  if(!list) return;
  const idx = list.querySelectorAll('[id^="ptm-fl-row-"]').length;
  const row = document.createElement('div');
  row.id = 'ptm-fl-row-'+idx;
  row.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center';
  row.innerHTML = `
    <input type="url" class="ptm-fl-url" data-idx="${idx}" value="" placeholder="https://filemail.com/…" style="padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);box-sizing:border-box;min-width:0">
    <button onclick="ptmRemoveFilemailLink(${idx})" style="padding:6px 9px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">✕</button>`;
  list.appendChild(row);
  row.querySelector('input').focus();
}
function ptmRemoveFilemailLink(idx){
  document.getElementById('ptm-fl-row-'+idx)?.remove();
}
function ptmCollectFilemailLinks(){
  const links=[];
  document.querySelectorAll('.ptm-fl-url').forEach(inp=>{const u=inp.value.trim();if(u)links.push(u);});
  return links;
}

function savePhotoTrackerModal(jobId){
  const filemailLinks = ptmCollectFilemailLinks();
  const update = {
    editStatus:      document.getElementById('ptm-status')?.value || 'ready',
    photographer:    document.getElementById('ptm-photographer')?.value.trim() || '',
    claimedBy:       document.getElementById('ptm-editor')?.value.trim() || '',
    completionDate:  document.getElementById('ptm-due')?.value || '',
    approxEditHours: document.getElementById('ptm-edithrs')?.value.trim() || '',
    approxFilmHours: document.getElementById('ptm-shootHrs')?.value.trim() || '',
    filemailLinks,
    filemailLink:    filemailLinks[0] || '',
    downloadLink:    document.getElementById('ptm-drive')?.value.trim() || '',
    dropboxLink:     document.getElementById('ptm-dropbox')?.value.trim() || '',
    notes:           document.getElementById('ptm-notes')?.value.trim() || '',
  };
  const existing = getPhotoTrackerStage(jobId);
  setPhotoTrackerStage(jobId, {...existing, ...update});
  // Persist client / address / shoot date back to the job object
  const newClient  = document.getElementById('ptm-client')?.value.trim() || '';
  const newAddress = document.getElementById('ptm-address')?.value.trim() || '';
  const newDate    = document.getElementById('ptm-shoot-date')?.value || '';
  const jobIdx = savedJobs.findIndex(j=>String(j.id)===String(jobId));
  if(jobIdx !== -1){
    if(newClient)  savedJobs[jobIdx].clientName = newClient;
    if(newAddress){ savedJobs[jobIdx].address = newAddress; savedJobs[jobIdx].name = newAddress; }
    if(newDate)    savedJobs[jobIdx].date = newDate;
    saveJobsToStorage();
  } else {
    // Standalone photo project — update the standalone store
    const standalones = getPhotoStandaloneProjects();
    const spIdx = standalones.findIndex(s=>String(s.id)===String(jobId));
    if(spIdx !== -1){
      if(newClient)  standalones[spIdx].clientName = newClient;
      if(newAddress){ standalones[spIdx].address = newAddress; standalones[spIdx].name = newAddress; }
      if(newDate)    standalones[spIdx].date = newDate;
      savePhotoStandaloneProjects(standalones);
    }
  }
  document.getElementById('photo-tracker-modal')?.remove();
  renderTracker();
  showDhToast('Photo Tracker', 'Saved ✓', '📸', '#E879F9', 2000);
}

function openPhotoTrackerAddModal(){
  const id = 'photo_standalone_' + Date.now();
  const fakeJob = {
    id, name:'New Photo Project', date:new Date().toISOString().slice(0,10),
    address:'', clientId:null, clientName:'', duration:'',
    payouts:{}, editors:{}, services:{}, status:'confirmed',
    isStandalone:true, isPhoto:true,
  };
  savedJobs.push(fakeJob);
  openPhotoTrackerModal(id);
}

function openPhotoTrackerImportModal(){
  // Simple import modal for photo projects
  const existing = document.getElementById('photo-import-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'photo-import-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9600;display:flex;align-items:flex-start;justify-content:center;padding:40px 20px;overflow-y:auto';
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  modal.innerHTML = `<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:600px;border:1px solid var(--border-bright);overflow:hidden" onclick="event.stopPropagation()">
    <div style="background:linear-gradient(135deg,#1a0d2e,#0d1a3a);padding:20px 24px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div style="font-size:15px;font-weight:800;color:var(--white)">Import Photo Projects (CSV)</div>
      <button onclick="document.getElementById('photo-import-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:20px">✕</button>
    </div>
    <div style="padding:20px 24px">
      <p style="color:var(--muted);font-size:13px;margin:0 0 12px">Paste CSV with columns: <code style="color:var(--amber)">address, clientName, date, photographer, status, notes</code></p>
      <textarea id="photo-import-csv" rows="10" placeholder="address,clientName,date,photographer,status,notes&#10;123 Main St,Acme Corp,2026-01-15,John,ready,Rush job" style="width:100%;padding:10px 12px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);resize:vertical;box-sizing:border-box;font-family:monospace"></textarea>
    </div>
    <div style="padding:16px 24px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:10px">
      <button onclick="document.getElementById('photo-import-modal').remove()" style="padding:9px 20px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer">Cancel</button>
      <button onclick="processPhotoImportCsv()" style="padding:9px 24px;border-radius:10px;border:none;background:linear-gradient(135deg,#E879F9,#9333ea);color:#fff;font-size:13px;font-weight:700;cursor:pointer">⬆ Import</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function processPhotoImportCsv(){
  const raw = (document.getElementById('photo-import-csv')?.value||'').trim();
  if(!raw){ showDhToast('Import','No data pasted','⚠','var(--amber)',2000); return; }
  const lines = raw.split('\n').map(l=>l.trim()).filter(Boolean);
  if(lines.length < 2){ showDhToast('Import','Need header + at least one row','⚠','var(--amber)',2000); return; }
  const headers = lines[0].split(',').map(h=>h.trim().toLowerCase());
  const col = h => headers.indexOf(h);
  const arr = getPhotoStandaloneProjects();
  let added = 0;
  lines.slice(1).forEach(line=>{
    const parts = line.split(',');
    const get = h => (parts[col(h)]||'').trim();
    const id = 'photo_standalone_' + Date.now() + '_' + Math.random().toString(36).slice(2,7);
    const proj = {
      id, address:get('address'), clientName:get('clientname'),
      date:get('date'), photographer:get('photographer'),
      editStatus:get('status')||'ready', notes:get('notes'),
      projectId:'', filesReceived:false, downloadLink:'', dropboxLink:'',
      approxEditHours:'', approxFilmHours:'', completionDate:'',
    };
    arr.push(proj);
    added++;
  });
  savePhotoStandaloneProjects(arr);
  document.getElementById('photo-import-modal')?.remove();
  renderTracker();
  showDhToast('Photo Import', `Imported ${added} project${added===1?'':'s'} ✓`, '📸', '#E879F9', 2500);
}

function clearAllPhotoStandaloneProjects(){
  if(!confirm('Delete ALL imported photo standalone projects? This cannot be undone.')) return;
  localStorage.removeItem('dronehub_photo_standalone');
  const stages = JSON.parse(localStorage.getItem('dronehub_photo_tracker')||'{}');
  Object.keys(stages).forEach(k=>{ if(k.startsWith('photo_standalone_')) delete stages[k]; });
  try{localStorage.setItem('dronehub_photo_tracker', JSON.stringify(stages));}catch(e){}
  renderTracker();
  showDhToast('Photo Tracker','All photo projects cleared','🗑️','var(--muted)',2000);
}

function renderTracker(){
  const tbody=document.getElementById('tracker-tbody');
  const emptyState=document.getElementById('tracker-empty');
  const countEl=document.getElementById('tracker-row-count');
  if(!tbody) return;

  // Self-heal: imported Drive projects always belong in Completed — stamp a
  // finished production stage on any that are missing one (once per session)
  if(!window._dhImportStamped&&typeof savedJobs!=='undefined'){
    window._dhImportStamped=true;
    let stamped=0;
    savedJobs.forEach(j=>{
      if(!j._importedFromDrive) return;
      const st=getTrackerStage(j.id);
      if(st.editStatus!=='finals_sent'){
        setTrackerStage(j.id,{stage:'delivered',editStatus:'finals_sent',filesReceived:true,downloadLink:j.driveLink||st.downloadLink||'',completionDate:j.date||''});
        stamped++;
      }
    });
    if(stamped){try{showDhToast('Tracker updated',stamped+' imported project'+(stamped===1?'':'s')+' moved to Completed','check','var(--green)',4000);}catch(e){}}
  }

  const _isPhoto = _trackerMode === 'photo';

  // Remove old contractor filter population (replaced by client autocomplete)
  const filterStatus=document.getElementById('tracker-filter-status')?.value||'';
  const searchVal=(document.getElementById('tracker-search')?.value||'').toLowerCase();

  // In photo mode: start with only photo-flagged saved jobs (usually none) + photo standalones
  // In video mode: start with confirmed/completed non-photo saved jobs
  let jobs = _isPhoto
    ? savedJobs.filter(j=>j.isPhoto&&(j.status==='confirmed'||j.status==='completed'))
    : savedJobs.filter(j=>(j.status==='confirmed'||j.status==='completed')&&!j.isPhoto);

  // Merge in standalone imported projects
  const standalone=_isPhoto ? getPhotoStandaloneProjects() : getStandaloneProjects();
  standalone.forEach(sp=>{
    if(!jobs.find(j=>j.id===sp.id)){
      jobs.push({
        id:sp.id, name:sp.address||sp.clientName||sp.projectId||'Imported Project',
        date:sp.date, address:sp.address, clientId:null, clientName:sp.clientName,
        duration:sp.approxFilmHours, payouts:{}, editors:{}, services:{}, status:'confirmed',
        isStandalone:true, isPhoto:_isPhoto?true:undefined, _sp:sp,
      });
      if(_isPhoto){
        const photoStages = JSON.parse(localStorage.getItem('dronehub_photo_tracker')||'{}');
        if(!photoStages[sp.id]){
          photoStages[sp.id]={
            stage:sp.stage||'files_pending', claimedBy:sp.claimedBy||'', notes:sp.notes||'',
            editStatus:sp.editStatus||'ready', filesReceived:sp.filesReceived||false,
            projectId:sp.projectId, downloadLink:sp.downloadLink||'',
            dropboxLink:sp.dropboxLink||'', filemailLink:sp.filemailLink||'',
            approxEditHours:sp.approxEditHours||'', approxFilmHours:sp.approxFilmHours||'',
            completionDate:sp.completionDate||'', photographer:sp.photographer||'',
          };
          try{localStorage.setItem('dronehub_photo_tracker', JSON.stringify(photoStages));}catch(e){}
        }
      } else {
        const stagesRaw=JSON.parse(localStorage.getItem('dronehub_tracker')||'{}');
        if(!stagesRaw[sp.id]){
          stagesRaw[sp.id]={
            stage:sp.stage||'footage_pending', claimedBy:sp.claimedBy||'', notes:sp.notes||'',
            editStatus:sp.editStatus||'ready', filesReceived:sp.filesReceived||false,
            projectId:sp.projectId, filemailLink:sp.filemailLink||'', frameioLink:sp.frameioLink||'',
            downloadLink:sp.downloadLink||'', dropboxLink:sp.dropboxLink||'', approxEditHours:sp.approxEditHours||'',
            approxFilmHours:sp.approxFilmHours||'', completionDate:sp.completionDate||'',
            videographer:sp.videographer||'', draftCount:0, extraDraftCharge:0,
          };
          try{localStorage.setItem('dronehub_tracker',JSON.stringify(stagesRaw));}catch(e){}
        }
      }
    }
  });

  const _getStage = _isPhoto ? getPhotoTrackerStage : getTrackerStage;
  const _upcomingSt = _isPhoto ? PHOTO_UPCOMING_STATUSES : UPCOMING_STATUSES;
  const _inprogressSt = _isPhoto ? PHOTO_INPROGRESS_STATUSES : INPROGRESS_STATUSES;
  const _completedSt = _isPhoto ? PHOTO_COMPLETED_STATUSES : COMPLETED_STATUSES;
  const _statusOpts = _isPhoto ? PHOTO_EDIT_STATUS_OPTS : EDIT_STATUS_OPTS;

  // Tab filter: Upcoming / In Progress / Completed
  if(_trackerTab==='upcoming'){
    jobs=jobs.filter(j=>_upcomingSt.includes(_getStage(j.id).editStatus||''));
  } else if(_trackerTab==='active'){
    jobs=jobs.filter(j=>_inprogressSt.includes(_getStage(j.id).editStatus||''));
  } else {
    jobs=jobs.filter(j=>_completedSt.includes(_getStage(j.id).editStatus||''));
  }

  // Client autocomplete filter
  if(_trackerClientFilter){
    const cf=_trackerClientFilter.toLowerCase();
    jobs=jobs.filter(j=>{
      const c=clients.find(cl=>cl.id===j.clientId);
      const name=(c?.name||j.clientName||'').toLowerCase();
      return name===cf||name.includes(cf);
    });
  }

  // "My Projects" filter — match claimedBy or videographer against current session name/email
  if(_trackerMineOnly){
    const sess=gateGetSession&&gateGetSession();
    if(sess){
      const myName=(sess.name||'').toLowerCase().trim();
      const myEmail=(sess.email||'').toLowerCase().trim();
      const myFirst=myName.split(' ')[0]; // first name is usually what's stored in claimedBy
      jobs=jobs.filter(j=>{
        const ts=_getStage(j.id);
        const claimed=(ts.claimedBy||'').toLowerCase().trim();
        const vid=(_isPhoto?(ts.photographer||''):(ts.videographer||'')).toLowerCase().trim();
        // Match on full name, email prefix, or first name (editors are often stored as first name)
        return [myName,myEmail,myFirst].some(m=>m&&(claimed===m||claimed.includes(m)||vid===m||vid.includes(m)));
      });
    }
  }

  if(filterStatus) jobs=jobs.filter(j=>_getStage(j.id).editStatus===filterStatus);
  if(searchVal) jobs=jobs.filter(j=>{
    const ts=_getStage(j.id);
    const client=clients.find(c=>c.id===j.clientId);
    const extraFields=_isPhoto?[ts.photographer]:[ts.videographer];
    return [j.name,j.address,j.clientName,client?.name,client?.company,ts.projectId,ts.claimedBy,...extraFields].some(v=>(v||'').toLowerCase().includes(searchVal));
  });

  // Update empty message based on tab
  const emptyMsg=document.getElementById('tracker-empty-msg');
  if(emptyMsg){
    if(_trackerTab==='upcoming') emptyMsg.textContent='No upcoming projects';
    else if(_trackerTab==='active') emptyMsg.textContent='No projects in progress';
    else emptyMsg.textContent='No completed projects';
  }

  // Sort: rush jobs first, then tab-specific
  // Upcoming:    soonest shoot date first
  // In Progress: client who finished reviewing first gets priority (clientDecisionAt asc),
  //              so editors work on the job whose client has been waiting longest
  // Completed:   most recently completed first
  jobs.sort((a,b)=>{
    const tsA=_getStage(a.id);
    const tsB=_getStage(b.id);
    // Rush jobs always first
    if(tsA.rush&&!tsB.rush) return -1;
    if(!tsA.rush&&tsB.rush) return 1;
    if(_trackerTab==='completed'){
      return (b.date||'').localeCompare(a.date||'');
    }
    if(_trackerTab==='active'){
      // Jobs where the client finished reviewing earliest come first
      const decA=tsA.clientDecisionAt||tsA.updatedAt||a.date||'';
      const decB=tsB.clientDecisionAt||tsB.updatedAt||b.date||'';
      return decA.localeCompare(decB);
    }
    // Upcoming: most recently added / newest shoot date first
    return (b.date||'').localeCompare(a.date||'');
  });

  // Apply saved manual order for upcoming tab
  if(_trackerTab==='upcoming'){
    const _manualOrder=getTrackerOrder(_trackerMode);
    if(_manualOrder.length){
      const _posMap={};
      _manualOrder.forEach((id,i)=>{ _posMap[String(id)]=i; });
      jobs.sort((a,b)=>{
        const pa=_posMap[String(a.id)]??_manualOrder.length;
        const pb=_posMap[String(b.id)]??_manualOrder.length;
        return pa-pb;
      });
    }
  }

  if(countEl) countEl.textContent=jobs.length+' project'+(jobs.length===1?'':'s');

  const _lm=_trackerLightMode; // local alias for light-mode flag
  const _statusStyles = _isPhoto ? (_lm ? PHOTO_STATUS_STYLES_LIGHT : PHOTO_STATUS_STYLES) : null; // null = use local STATUS_STYLES defined below
  const _rowAccentMap = _isPhoto ? (_lm ? PHOTO_ROW_ACCENT_LIGHT : PHOTO_ROW_ACCENT) : null; // null = use local ROW_ACCENT defined below

  // Dark-mode status badge styles
  const STATUS_STYLES={
    footage_pending:  {bg:'#2d2d2d',     color:'#A8B4D0',label:'Footage Pending'},
    ready:            {bg:'#1a3a5c',     color:'#7AABFF', label:'Ready to Start'},
    draft1_progress:  {bg:'#1a2a1a',     color:'#34D399', label:'D1 - In Progress'},
    draft1:           {bg:'#1a3a2a',     color:'#22D97A', label:'D1 - Sent'},
    draft2_ready:     {bg:'#1a3a5c',     color:'#60C8FF', label:'D2 - Ready to Start'},
    draft2_progress:  {bg:'#2a2a1a',     color:'#FCD34D', label:'D2 - In Progress'},
    draft2:           {bg:'#2a2a1a',     color:'#F5A623', label:'D2 - Sent'},
    draft3_ready:     {bg:'#1a3a5c',     color:'#60C8FF', label:'D3 - Ready to Start'},
    draft3_progress:  {bg:'#2a1a1a',     color:'#FB923C', label:'D3 - In Progress'},
    draft3:           {bg:'#2a1a1a',     color:'#F05252', label:'D3 - Sent'},
    draft_plus_ready: {bg:'#1a3a5c',     color:'#60C8FF', label:'D+ - Ready to Start'},
    draft_plus:       {bg:'#3a1a1a',     color:'#F87171', label:'Draft + - In Progress'},
    finals_sent:      {bg:'#0d2d1a',     color:'#22D97A', label:'Finals Sent ✓'},
    in_progress:      {bg:'#1a2a3a',     color:'#5B8DEF', label:'In Progress'},
    review:           {bg:'#2a1a3a',     color:'#A78BFA', label:'In Review'},
  };
  // Light-mode status badge styles (solid pastel chips with dark text)
  const STATUS_STYLES_LIGHT={
    footage_pending:  {bg:'#e8eaf2',color:'#4a5568',label:'Footage Pending'},
    ready:            {bg:'#dbeafe',color:'#1d4ed8',label:'Ready to Start'},
    draft1_progress:  {bg:'#d1fae5',color:'#065f46',label:'D1 - In Progress'},
    draft1:           {bg:'#d1fae5',color:'#065f46',label:'D1 - Sent'},
    draft2_ready:     {bg:'#dbeafe',color:'#1d4ed8',label:'D2 - Ready to Start'},
    draft2_progress:  {bg:'#fef9c3',color:'#92400e',label:'D2 - In Progress'},
    draft2:           {bg:'#fef9c3',color:'#92400e',label:'D2 - Sent'},
    draft3_ready:     {bg:'#dbeafe',color:'#1d4ed8',label:'D3 - Ready to Start'},
    draft3_progress:  {bg:'#ffedd5',color:'#9a3412',label:'D3 - In Progress'},
    draft3:           {bg:'#fee2e2',color:'#991b1b',label:'D3 - Sent'},
    draft_plus_ready: {bg:'#dbeafe',color:'#1d4ed8',label:'D+ - Ready to Start'},
    draft_plus:       {bg:'#fee2e2',color:'#991b1b',label:'Draft + - In Progress'},
    finals_sent:      {bg:'#d1fae5',color:'#065f46',label:'Finals Sent ✓'},
    in_progress:      {bg:'#dbeafe',color:'#1e40af',label:'In Progress'},
    review:           {bg:'#ede9fe',color:'#5b21b6',label:'In Review'},
  };

  // Videographer color pills
  const VID_COLORS=['#5B8DEF','#22D97A','#F5A623','#8B5CF6','#F05252','#E879F9','#14B8A6','#FB923C'];
  function vidColor(name){
    if(!name) return '#555';
    let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xffff;
    return VID_COLORS[h%VID_COLORS.length];
  }

  if(!jobs.length){
    tbody.innerHTML='';
    if(emptyState){
      emptyState.style.display='block';
      const iconEl = emptyState.querySelector('div:first-child');
      if(iconEl) iconEl.innerHTML = _isPhoto ? _icon('camera',14) : _icon('clipboard',14);
    }
    return;
  }
  if(emptyState) emptyState.style.display='none';

  const pidHeader=document.getElementById('tracker-col-pid');
  if(pidHeader) pidHeader.textContent=(_trackerTab==='upcoming'||_trackerTab==='active')?'Queue':'Project ID';

  // Per-status row accent colors — dark mode
  const ROW_ACCENT={
    footage_pending:'rgba(168,180,208,.05)', ready:'rgba(122,171,255,.06)',
    draft1_progress:'rgba(52,211,153,.07)',  draft1:'rgba(34,217,122,.07)',
    draft2_ready:'rgba(96,200,255,.06)',     draft2_progress:'rgba(252,211,77,.07)',
    draft2:'rgba(245,166,35,.07)',           draft3_ready:'rgba(96,200,255,.06)',
    draft3_progress:'rgba(251,146,60,.07)', draft3:'rgba(240,82,82,.07)',
    draft_plus_ready:'rgba(96,200,255,.06)',draft_plus:'rgba(248,113,113,.08)',
    finals_sent:'rgba(34,217,122,.09)',     in_progress:'rgba(91,141,239,.07)',
    review:'rgba(167,139,250,.08)',
  };
  // Per-status row accent colors — light mode (gentle tints on white)
  const ROW_ACCENT_LIGHT={
    footage_pending:'#f8f8fc', ready:'#eff6ff',
    draft1_progress:'#f0fdf4',  draft1:'#f0fdf4',
    draft2_ready:'#eff6ff',     draft2_progress:'#fefce8',
    draft2:'#fefce8',           draft3_ready:'#eff6ff',
    draft3_progress:'#fff7ed', draft3:'#fff1f2',
    draft_plus_ready:'#eff6ff',draft_plus:'#fff1f2',
    finals_sent:'#f0fdf4',     in_progress:'#eff6ff',
    review:'#f5f3ff',
  };

  const today=new Date().toISOString().slice(0,10);

  tbody.innerHTML=jobs.map((j,idx)=>{
    const ts=_getStage(j.id);
    const client=clients.find(c=>c.id===j.clientId);
    const pid=_isPhoto
      ? (ts.projectId || ensurePhotoProjectId(j.id, ts))
      : (ts.projectId || getProjectId(j));
    const videographer=_isPhoto
      ? (ts.photographer || 'TBD')
      : (ts.videographer || getJobCreator(j) || 'TBD');
    const _rawEditor=ts.claimedBy||'';
    const _isDhEditor=_rawEditor==='DroneHub'||_rawEditor==='dronehub';
    const editor=_rawEditor||'ASSIGN';
    const editStatus=ts.editStatus||(_isPhoto?'files_pending':'ready');
    const _activeStatusStyles = _statusStyles || (_lm ? STATUS_STYLES_LIGHT : STATUS_STYLES);
    const _activeRowAccent = _rowAccentMap || (_lm ? ROW_ACCENT_LIGHT : ROW_ACCENT);
    const ss=_activeStatusStyles[editStatus]||_activeStatusStyles[_isPhoto?'files_pending':'ready']||_activeStatusStyles.ready;
    const isRush=ts.rush||false;
    const dueDate=ts.completionDate||'';
    const isOverdue=dueDate&&dueDate<today&&!_completedSt.includes(editStatus);

    // Row background: use "ready" status styling for In Progress tab to match Upcoming look exactly
    const _rowStatus=_trackerTab==='active'?'ready':editStatus;
    const _rowSs=_activeStatusStyles[_rowStatus]||_activeStatusStyles.ready;
    const rowBg=_lm
      ?(isRush?'#fef2f2':isOverdue?'#fff1f2':(_activeRowAccent[_rowStatus]||'#ffffff'))
      :(isRush?'rgba(240,82,82,.10)':isOverdue?'rgba(240,82,82,.08)':(_activeRowAccent[_rowStatus]||'rgba(255,255,255,.01)'));
    const hoverBg=_lm
      ?(isRush?'#fee2e2':isOverdue?'#fee2e2':'#e0e7ff')
      :(isRush?'rgba(240,82,82,.18)':isOverdue?'rgba(240,82,82,.15)':'rgba(91,141,239,.1)');
    const borderColor=_lm
      ?(isRush?'#fca5a5':isOverdue?'#fca5a5':'rgba(0,0,0,.07)')
      :(isRush?'rgba(240,82,82,.3)':isOverdue?'rgba(240,82,82,.2)':(_rowSs.color+'28'));
    const leftAccent=isRush||isOverdue
      ?`border-left:3px solid ${isRush?'#ef4444':'#f97316'};`
      :_lm?`border-left:3px solid ${_rowSs.color}99;`:`border-left:3px solid ${_rowSs.color}44;`;

    // Text colors
    const txtPrimary=_lm?'#111827':'var(--white)';
    const txtMuted=_lm?'#6b7280':'var(--muted)';
    const txtSub=_lm?'#9ca3af':'var(--muted)';

    const rushBadge=isRush?'<span style="background:#ef4444;color:#fff;padding:1px 6px;border-radius:8px;font-size:9px;font-weight:700;margin-left:4px">RUSH</span>':'';
    const overdueBadge=isOverdue?`<span style="background:${_lm?'#fee2e2':'rgba(240,82,82,.18)'};color:#dc2626;padding:1px 5px;border-radius:6px;font-size:9px;font-weight:700;margin-left:4px">⚠ OVERDUE</span>`:'';
    const filmHrs=ts.approxFilmHours||j.duration||'';
    const editHrs=ts.approxEditHours||'';
    const notes=ts.notes||'';
    const _notesObj=parseTrackerNotes(notes);
    const _notesFilled=Object.entries(_notesObj).filter(([,v])=>v&&v.trim());
    const _draftShort={general:'Gen',draft1:'D1',draft2:'D2',draft3:'D3',draft4:'D4+'};
    const _notesDisplay=_notesFilled.length===0?''
      :_notesFilled.length===1?_notesFilled[0][1]
      :_notesFilled.map(([k])=>_draftShort[k]||k).join(' · ');
    const _hasNotes=_notesFilled.length>0;
    const _fmLinks=(ts.filemailLinks&&ts.filemailLinks.length?ts.filemailLinks:ts.filemailLink?[ts.filemailLink]:[]);
    const filemaLink=_fmLinks[0]||'';
    const filemaCount=_fmLinks.length;
    const dlLink=ts.downloadLink||'';
    const dbxLink=ts.dropboxLink||'';
    const clientName=client?.name||j.clientName||'';
    const company=client?.company||'';
    const draftCharge=_isPhoto?'':ts.extraDraftCharge>0?` <span style="color:#F5A623;font-size:9px">+$${ts.extraDraftCharge}</span>`:'';

    // Pre-compute action button HTML (avoids nested template literal issues)
    const reviewBtnHtml = `<button onclick="openVdProfile('${j.id}','team')" title="Video Draft Review" style="padding:2px 6px;border-radius:6px;border:1px solid rgba(91,141,239,${_lm?.5:.4});background:rgba(91,141,239,${_lm?.15:.08});color:${_lm?'#1d4ed8':'var(--blue-bright)'};font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:3px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Review</button>`;
    const editModalFn = _isPhoto ? 'openPhotoTrackerModal' : 'openTrackerModal';
    const editBtnColor = _isPhoto ? (_lm?'#7e22ce':'#E879F9') : (_lm?'#92400e':'var(--amber)');
    const editBtnBorder = _isPhoto ? '232,121,249' : '245,166,35';

    // Queue number for Upcoming + In Progress tabs
    const _queueColor='#D97706';
    const _queueLabel=_trackerTab==='active'?'In Prog':'Up Next';
    const queueCell=(_trackerTab==='upcoming'||_trackerTab==='active')
      ?`<td style="padding:4px 6px;overflow:hidden;background:${rowBg};${_trackerTab==='upcoming'?'cursor:grab;user-select:none':''}" ${_trackerTab==='upcoming'?'title="Drag to reorder queue"':''}>
          <div style="display:flex;flex-direction:column;align-items:center;gap:1px">
            ${_trackerTab==='upcoming'?`<span style="font-size:12px;color:${_queueColor};opacity:.5;line-height:1;letter-spacing:.05em">⠿</span>`:''}
            <span style="font-size:9px;font-weight:700;color:${_queueColor};text-transform:uppercase;letter-spacing:.06em">${_queueLabel}</span>
            <span style="font-size:16px;font-weight:900;color:${isRush?'#ef4444':_queueColor};line-height:1">${idx+1}</span>
          </div>
        </td>`
      :`<td style="padding:4px 6px;overflow:hidden;color:${_lm?'#6b7280':'#A8B4D0'};font-family:monospace;font-size:11px;white-space:nowrap;text-overflow:ellipsis">${pid}</td>`;

    // Build inline edit-status dropdown options
    const editStatusSelectOpts = _statusOpts.map(s=>`<option value="${s.key}"${editStatus===s.key?' selected':''}>${s.label}</option>`).join('');

    // Due date cell: red if overdue
    const dueDateColor=isOverdue?'#dc2626':dueDate?(_lm?'#b45309':'var(--amber)'):txtMuted;
    const dueDateWeight=dueDate?'700':'400';

    const _dragAttrs=_trackerTab==='upcoming'
      ?` draggable="true" ondragstart="trkDragStart(event,'${j.id}')" ondragend="trkDragEnd(event,'${rowBg}')" ondragover="trkDragOver(event,'${j.id}')" ondrop="trkDrop(event,'${j.id}')"`
      :'';
    return `<tr data-job-id="${j.id}"${_dragAttrs} style="background:${rowBg};border-bottom:1px solid ${borderColor};transition:background .1s;${leftAccent}" onmouseover="this.style.background='${hoverBg}'" onmouseout="this.style.background='${rowBg}'">
      ${queueCell}
      <td style="padding:4px 6px;overflow:hidden">
        <div style="color:${txtPrimary};font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${clientName}${rushBadge}${overdueBadge}</div>
        ${company?`<div style="font-size:10px;color:${txtSub};font-weight:400;margin-top:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${company}</div>`:''}
      </td>
      <td style="padding:4px 16px;overflow:hidden">
        <input class="tracker-cell-edit" value="${(j.address||j.name||'').replace(/"/g,'&quot;')}"
          title="Property address / project name — click to edit"
          placeholder="Enter address…"
          onblur="trackerInlineSaveAddress('${j.id}',this.value,'${_trackerMode}')"
          onkeydown="if(event.key==='Enter')this.blur();if(event.key==='Escape'){this.value=this.defaultValue;this.blur()}"
          style="width:100%;color:${txtPrimary};font-size:12px;font-weight:500">
      </td>
      <td style="padding:4px 6px;overflow:hidden;color:${txtMuted};white-space:nowrap;text-overflow:ellipsis">${j.date||''}</td>
      <td style="padding:4px 6px;overflow:hidden;text-align:center">
        ${j.isStandalone
          ? `<select onchange="trackerInlineSave('${j.id}','${_isPhoto?'photographer':'videographer'}',this.value,'${_trackerMode}');renderTracker()" title="Assign ${_isPhoto?'photographer':'videographer'}"
               style="width:100%;padding:2px 2px;border-radius:6px;border:1px solid ${vidColor(videographer)}66;background:${vidColor(videographer)}22;color:${vidColor(videographer)};font-size:10px;font-weight:700;cursor:pointer;outline:none">
               ${buildVideographerOptions(videographer)}
             </select>`
          : `<span style="background:${vidColor(videographer)};color:#fff;padding:2px 5px;border-radius:10px;font-size:10px;font-weight:700;white-space:nowrap" title="${_isPhoto?'Photographer':'Locked — set during quoting'}">${videographer}</span>`}
      </td>
      <td style="padding:4px 6px;overflow:hidden;text-align:center;cursor:pointer" onclick="trackerToggleFiles('${j.id}','${_trackerMode}')" title="Click to toggle files received">
        ${ts.filesReceived
          ?'<span style="font-size:16px;color:#22D97A;user-select:none">☑</span>'
          :`<span style="font-size:16px;color:${_lm?'rgba(0,0,0,.2)':'rgba(255,255,255,.25)'};user-select:none">☐</span>`}
      </td>
      <td style="padding:4px 6px;overflow:hidden;text-align:center">
        <select onchange="trackerInlineSave('${j.id}','claimedBy',this.value,'${_trackerMode}');renderTracker()" title="Assign Editor"
          style="width:100%;padding:2px 2px;border-radius:6px;border:1px solid ${_isDhEditor?'rgba(240,82,82,.5)':vidColor(editor)+'66'};background:${_isDhEditor?'rgba(240,82,82,.18)':vidColor(editor)+'22'};color:${_isDhEditor?'#FF7070':_lm?vidColor(editor):'#fff'};font-size:10px;font-weight:700;cursor:pointer;outline:none">
          ${buildEditorOptions(_rawEditor||'DroneHub')}
        </select>
      </td>
      <td style="padding:4px 6px;overflow:hidden;text-align:center">
        <select onchange="trackerSetEditStatus('${j.id}',this.value,'${_trackerMode}')" title="Change edit status" style="width:100%;padding:2px 2px;border-radius:6px;border:1px solid ${ss.color}55;background:${ss.bg};color:${ss.color};font-size:10px;font-weight:700;cursor:pointer;outline:none">${editStatusSelectOpts}</select>${draftCharge}
      </td>
      <td style="padding:4px 6px;overflow:hidden">
        <div onclick="openTrackerNotesModal('${j.id}','${_trackerMode}',this.dataset.notes)"
          data-notes="${(notes||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;')}"
          title="${_hasNotes?_notesDisplay.replace(/"/g,'&quot;'):'Click to add notes'}"
          style="width:100%;font-size:11px;color:${_hasNotes?txtMuted:'rgba(255,255,255,.28)'};cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:20px;padding:2px 4px;border-radius:4px;transition:background .15s"
          onmouseover="this.style.background='rgba(91,141,239,.12)'"
          onmouseout="this.style.background='transparent'">${_hasNotes?_notesDisplay:'<span style="font-size:10px">Add notes…</span>'}</div>
      </td>
      <td style="padding:4px 4px 4px 6px;overflow:hidden">
        <div style="display:flex;flex-direction:column;gap:3px;align-items:flex-end">
          <div style="display:flex;gap:3px;align-items:center">
            <button onclick="${editModalFn}('${j.id}')" title="Edit project details" style="padding:2px 6px;border-radius:6px;border:1px solid rgba(${editBtnBorder},${_lm?.5:.4});background:rgba(${editBtnBorder},${_lm?.15:.08});color:${editBtnColor};font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:3px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
            <button onclick="deleteTrackerEntry('${j.id}',${j.isStandalone?'true':'false'})" title="Delete this project entry" style="padding:2px 5px;border-radius:6px;border:1px solid rgba(240,82,82,${_lm?.5:.35});background:rgba(240,82,82,${_lm?.12:.07});color:${_lm?'#dc2626':'#FF7070'};font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:2px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg> Delete</button>
          </div>
          ${_isPhoto?'':reviewBtnHtml}
          ${filemaLink?`<a href="${filemaLink}" target="_blank" title="${filemaLink}" style="padding:2px 6px;border-radius:6px;border:1px solid rgba(34,217,122,${_lm?.5:.35});background:rgba(34,217,122,${_lm?.12:.07});color:${_lm?'#047857':'#22D97A'};font-size:10px;font-weight:700;text-decoration:none;white-space:nowrap;display:inline-flex;align-items:center;gap:3px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Filemail${filemaCount>1?` <span style="background:rgba(34,217,122,.25);border-radius:4px;padding:0 4px;font-size:9px">${filemaCount}</span>`:''}</a>`:''}
          <button onclick="fmOpenBrowser('${j.id}')" title="Browse Filemail transfers" style="padding:2px 6px;border-radius:6px;border:1px solid rgba(34,217,122,${_lm?.5:.3});background:rgba(34,217,122,${_lm?.08:.05});color:${_lm?'#047857':'#22D97A'};font-size:10px;font-weight:700;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:3px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Browse</button>
          ${dlLink?`<a href="${dlLink}" target="_blank" style="color:${_lm?'#1d4ed8':'#5B8DEF'};font-size:10px;text-decoration:none;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:100%;text-align:right" title="${dlLink}">☁ Drive ↗</a>`:''}
          ${dbxLink?`<a href="${dbxLink}" target="_blank" style="color:${_lm?'#0044cc':'#0061FF'};font-size:10px;text-decoration:none;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:block;max-width:100%;text-align:right" title="${dbxLink}">Dropbox ↗</a>`:''}
        </div>
      </td>
    </tr>`;
  }).join('');
  if(window.innerWidth<=768) setTimeout(mobTrkRefresh, 50);
  if(typeof fmTryAutoSync==='function') fmTryAutoSync();
}

// ── Tracker queue manual order ────────────────────────────────────────────────
function getTrackerOrder(mode){
  return JSON.parse(localStorage.getItem('dronehub_tracker_order_'+mode)||'[]');
}
function saveTrackerOrder(mode,ids){
  try{localStorage.setItem('dronehub_tracker_order_'+mode,JSON.stringify(ids));}catch(e){}
  if(_fbToken()) fbSubSet('tracker_meta','order_'+mode,{ids}).catch(()=>{});
}

// ── Tracker queue drag-to-reorder ─────────────────────────────────────────────
let _trkDragJobId=null;
function trkDragStart(e,jobId){
  _trkDragJobId=String(jobId);
  e.dataTransfer.effectAllowed='move';
  e.dataTransfer.setData('text/plain',String(jobId));
  setTimeout(()=>{
    const tr=document.querySelector('#tracker-tbody tr[data-job-id="'+jobId+'"]');
    if(tr){tr.style.opacity='0.35';tr.style.outline='2px dashed #5B8DEF';}
  },0);
}
function trkDragEnd(e,origBg){
  _trkDragJobId=null;
  document.querySelectorAll('#tracker-tbody tr').forEach(tr=>{
    tr.style.opacity='';tr.style.outline='';tr.style.borderTop='';
  });
}
function trkDragOver(e,jobId){
  if(!_trkDragJobId||_trkDragJobId===String(jobId)) return;
  e.preventDefault();
  e.dataTransfer.dropEffect='move';
  document.querySelectorAll('#tracker-tbody tr').forEach(tr=>tr.style.borderTop='');
  const t=document.querySelector('#tracker-tbody tr[data-job-id="'+jobId+'"]');
  if(t) t.style.borderTop='2px solid #5B8DEF';
}
function trkDrop(e,jobId){
  e.stopPropagation();e.preventDefault();
  if(!_trkDragJobId||_trkDragJobId===String(jobId)) return;
  const rows=[...document.querySelectorAll('#tracker-tbody tr')];
  const ids=rows.map(r=>r.dataset.jobId);
  const from=ids.indexOf(_trkDragJobId);
  const to=ids.indexOf(String(jobId));
  if(from===-1||to===-1) return;
  ids.splice(from,1);
  ids.splice(to,0,_trkDragJobId);
  saveTrackerOrder(_trackerMode,ids);
  renderTracker();
}

// ── Tracker notes modal ───────────────────────────────────────────────────────
function parseTrackerNotes(raw){
  if(!raw) return {};
  try{
    const p=JSON.parse(raw);
    if(p&&typeof p==='object'&&!Array.isArray(p)) return p;
  }catch(e){}
  return raw.trim()?{general:raw}:{};
}
const _trkNotesDraftLabels={general:'General',draft1:'Draft 1',draft2:'Draft 2',draft3:'Draft 3',draft4:'Draft 4+'};
const _trkNotesDraftHints={
  general:'Pre-shoot notes, gate codes, special instructions, asset links…',
  draft1:'Draft 1 revision notes from client…',
  draft2:'Draft 2 revision notes from client…',
  draft3:'Draft 3 revision notes from client…',
  draft4:'Draft 4.... this client sucks',
};
let _trackerNotesJobId='', _trackerNotesMode='', _trkNotesDraft='general', _trkNotesData={};
function openTrackerNotesModal(jobId, mode, rawNotes){
  _trackerNotesJobId=String(jobId);
  _trackerNotesMode=mode;
  _trkNotesData=parseTrackerNotes(rawNotes);
  _trkNotesDraft='general';
  document.getElementById('tracker-notes-modal').style.display='flex';
  trkNotesDraftSelect('general');
  setTimeout(()=>document.getElementById('tracker-notes-textarea').focus(),60);
}
function closeTrackerNotesModal(){
  document.getElementById('tracker-notes-modal').style.display='none';
}
function trkNotesDraftSelect(draft){
  const ta=document.getElementById('tracker-notes-textarea');
  if(ta&&_trkNotesDraft) _trkNotesData[_trkNotesDraft]=ta.value;
  _trkNotesDraft=draft;
  if(ta){
    ta.value=_trkNotesData[draft]||'';
    ta.placeholder=_trkNotesDraftHints[draft]||'Add notes…';
    ta.focus();
  }
  document.querySelectorAll('.tnm-draft-btn').forEach(b=>{
    const on=b.dataset.draft===draft;
    b.style.background=on?'rgba(91,141,239,.18)':'rgba(255,255,255,.05)';
    b.style.color=on?'#5B8DEF':'rgba(255,255,255,.45)';
    b.style.borderColor=on?'rgba(91,141,239,.45)':'rgba(255,255,255,.12)';
  });
  renderTrkPrevNotes();
}
function renderTrkPrevNotes(){
  const el=document.getElementById('tnm-prev-notes');
  if(!el) return;
  const others=Object.entries(_trkNotesData).filter(([k,v])=>v&&v.trim()&&k!==_trkNotesDraft);
  if(!others.length){el.style.display='none';el.innerHTML='';return;}
  el.style.display='block';
  el.innerHTML='<div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.3);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px;padding-top:4px;border-top:1px solid rgba(255,255,255,.06)">Other Draft Notes</div>'
    +others.map(([k,v])=>`<div onclick="trkNotesDraftSelect('${k}')" title="Click to edit ${_trkNotesDraftLabels[k]||k}"
      style="margin-bottom:8px;padding:10px 12px;background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:8px;cursor:pointer;transition:background .15s"
      onmouseover="this.style.background='rgba(91,141,239,.07)'" onmouseout="this.style.background='rgba(255,255,255,.025)'">
      <div style="font-size:10px;font-weight:700;color:rgba(255,255,255,.4);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px;display:flex;justify-content:space-between;align-items:center">
        <span>${_trkNotesDraftLabels[k]||k}</span>
        <span style="font-size:9px;color:rgba(91,141,239,.6);font-weight:600">Edit ↑</span>
      </div>
      <div style="font-size:12px;color:rgba(255,255,255,.55);line-height:1.5;white-space:pre-wrap;max-height:56px;overflow:hidden">${v.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>
    </div>`).join('');
}
function saveTrackerNotes(){
  const ta=document.getElementById('tracker-notes-textarea');
  if(ta) _trkNotesData[_trkNotesDraft]=ta.value;
  Object.keys(_trkNotesData).forEach(k=>{if(!(_trkNotesData[k]||'').trim())delete _trkNotesData[k];});
  const serialized=Object.keys(_trkNotesData).length?JSON.stringify(_trkNotesData):'';
  trackerInlineSave(_trackerNotesJobId,'notes',serialized,_trackerNotesMode);
  closeTrackerNotesModal();
  renderTracker();
}

// ── Delete a tracker entry ────────────────────────────────────────────────────
// Standalone projects are fully removed (project record + tracker stage).
// Regular quote-builder jobs ask whether to remove from tracker only or also
// delete the billing record.
function deleteTrackerEntry(jobId, isStandalone){
  jobId=String(jobId);
  if(isStandalone){
    if(!confirm('Delete this project? It will be permanently removed from the tracker.')) return;
    // Remove from standalone_projects array
    const projs=getStandaloneProjects().filter(p=>String(p.id)!==jobId);
    saveStandaloneProjects(projs);
    // Remove Firebase sub-collection doc for this project
    if(_fbToken()) fbSubDelete('projects',jobId).catch(()=>{});
    // Remove its tracker stage from localStorage + Firebase
    const stages=JSON.parse(localStorage.getItem('dronehub_tracker')||'{}');
    delete stages[jobId];
    try{localStorage.setItem('dronehub_tracker',JSON.stringify(stages));}catch(e){}
    if(_fbToken()) fbSubDelete('tracker',jobId).catch(()=>{});
    renderTracker();
    showDhToast('Deleted','Project removed from tracker.','✓','var(--red)',3000);
  } else {
    // Regular job — offer two choices
    const choice=confirm(
      'Remove "'+jobId+'" from the tracker?\n\n' +
      'OK = Remove from tracker only (keeps billing/invoice record)\n' +
      'Cancel = Do nothing'
    );
    if(!choice) return;
    // Clear just the tracker stage — job stays in savedJobs for billing
    const stages=JSON.parse(localStorage.getItem('dronehub_tracker')||'{}');
    delete stages[jobId];
    try{localStorage.setItem('dronehub_tracker',JSON.stringify(stages));}catch(e){}
    if(_fbToken()) fbSubDelete('tracker',jobId).catch(()=>{});
    renderTracker();
    showDhToast('Removed','Project removed from tracker. Billing record kept.','✓','var(--muted)',3000);
  }
}

// Inline edit-status change from the dropdown in the tracker table row
function trackerSetEditStatus(jobId, newStatus, mode){
  mode = mode || _trackerMode;
  if(mode === 'photo'){
    const existing = getPhotoTrackerStage(jobId);
    setPhotoTrackerStage(jobId, {...existing, editStatus: newStatus});
  } else {
    const existing = getTrackerStage(jobId);
    setTrackerStage(jobId, { ...existing, editStatus: newStatus });
    // Auto-link to client profile when marked complete
    if(newStatus==='finals_sent') linkProjectToClient(jobId);
  }
  // Re-render so the row moves to the correct tab if needed
  renderTracker();
}

// ── AUTO-LINK PROJECT TO CLIENT ON COMPLETION ────────────────────────────────
// Called whenever a project's editStatus becomes 'finals_sent'.
// Writes a lightweight reference (id, address, date, links) into the client's
// completedProjects array so the client profile production tab always has a
// full, searchable history — including standalone projects with no clientId.
function linkProjectToClient(jobId){
  jobId=String(jobId);
  const ts=getTrackerStage(jobId);
  if((ts.editStatus||'')!=='finals_sent') return;

  // Resolve the job / standalone project
  const job=savedJobs.find(j=>String(j.id)===String(jobId));
  const sp=job?null:getStandaloneProjects().find(s=>String(s.id)===String(jobId));

  // Determine clientId — prefer saved job's clientId, fall back to name match
  let clientId=job?.clientId||null;
  if(!clientId){
    const rawName=(job?.clientName||sp?.clientName||'').toLowerCase().trim();
    if(rawName){
      const match=clients.find(c=>(c.name||'').toLowerCase().trim()===rawName);
      if(match) clientId=match.id;
    }
  }
  if(!clientId) return; // can't link without a client

  const client=clients.find(c=>c.id===clientId);
  if(!client) return;

  // Build the project record
  const projectRef={
    jobId,
    address: job?.address||sp?.address||job?.name||'',
    clientName: job?.clientName||sp?.clientName||client.name||'',
    date: job?.date||sp?.date||'',
    projectId: ts.projectId||getProjectId(job||{id:jobId,date:sp?.date||''}),
    editStatus: ts.editStatus,
    completionDate: ts.completionDate||'',
    downloadLink: ts.downloadLink||'',
    dropboxLink: ts.dropboxLink||'',
    frameioLink: ts.frameioLink||'',
    filemailLink: ts.filemailLink||'',
    notes: ts.notes||'',
    linkedAt: new Date().toISOString().slice(0,10),
  };

  // Merge into client's completedProjects array (no duplicates)
  if(!client.completedProjects) client.completedProjects=[];
  const existingIdx=client.completedProjects.findIndex(p=>String(p.jobId)===jobId);
  if(existingIdx>=0) client.completedProjects[existingIdx]=projectRef;
  else client.completedProjects.push(projectRef);

  saveClientsToStorage(); // already saves to Firebase with retry
}

// Toggle Files Received directly from the table (no modal needed)
function trackerToggleFiles(jobId, mode){
  mode = mode || _trackerMode;
  if(mode === 'photo'){
    const existing = getPhotoTrackerStage(jobId);
    setPhotoTrackerStage(jobId, {...existing, filesReceived: !existing.filesReceived});
  } else {
    const existing = getTrackerStage(jobId);
    setTrackerStage(jobId, { ...existing, filesReceived: !existing.filesReceived });
  }
  renderTracker();
}

// Save a single tracker field inline (called onblur from editable cells)
function trackerInlineSave(jobId, field, value, mode){
  mode = mode || _trackerMode;
  if(mode === 'photo'){
    const existing = getPhotoTrackerStage(jobId);
    if(existing[field] === value) return;
    setPhotoTrackerStage(jobId, {...existing, [field]: value});
    // Sync back to photo standalone if applicable
    const photoArr = getPhotoStandaloneProjects();
    const spIdx = photoArr.findIndex(s=>String(s.id)===String(jobId));
    if(spIdx >= 0){ photoArr[spIdx][field] = value; savePhotoStandaloneProjects(photoArr); }
  } else {
    const existing = getTrackerStage(jobId);
    if(existing[field] === value) return; // no change
    setTrackerStage(jobId, { ...existing, [field]: value });
    // Sync back to standalone project if applicable
    const standaloneArr = getStandaloneProjects();
    const spIdx = standaloneArr.findIndex(s=>String(s.id)===String(jobId));
    if(spIdx >= 0){
      standaloneArr[spIdx][field] = value;
      saveStandaloneProjects(standaloneArr);
    }
  }
  // Re-render only if the field affects sorting/grouping (not for minor text fields)
  const reRenderFields = ['editStatus','rush','completionDate'];
  if(reRenderFields.includes(field)) renderTracker();
}

// Save an edited address/project name back to the source record
// (regular job in savedJobs, or standalone project) + any linked client record
function trackerInlineSaveAddress(jobId, newAddress, mode){
  mode = mode || _trackerMode;
  newAddress = (newAddress||'').trim();
  if(!newAddress) return; // don't blank out an address

  // ── Regular saved job ───────────────────────────────────────────────────
  const jobIdx = savedJobs.findIndex(j=>String(j.id)===String(jobId));
  if(jobIdx >= 0){
    const job = savedJobs[jobIdx];
    if((job.address||job.name||'') === newAddress) return; // no change
    job.address = newAddress;
    // Also update .name if that's what was being used as the display label
    if(!job.address && job.name) job.name = newAddress;
    saveJobsToStorage();

    // Update linked client completed-project entry if it exists
    if(job.clientId){
      const client = clients.find(c=>c.id===job.clientId);
      if(client?.completedProjects){
        const cp = client.completedProjects.find(p=>String(p.jobId)===String(jobId));
        if(cp){
          cp.address = newAddress;
          saveClientsToStorage(); // already writes to Firebase with retry
        }
      }
    }
    renderTracker();
    return;
  }

  // ── Standalone / imported project ───────────────────────────────────────
  const standaloneArr = mode==='photo' ? getPhotoStandaloneProjects() : getStandaloneProjects();
  const spIdx = standaloneArr.findIndex(s=>String(s.id)===String(jobId));
  if(spIdx >= 0){
    if(standaloneArr[spIdx].address === newAddress) return;
    standaloneArr[spIdx].address = newAddress;
    if(mode==='photo') savePhotoStandaloneProjects(standaloneArr);
    else saveStandaloneProjects(standaloneArr);

    // Try to update linked client record by name match
    const clientName = (standaloneArr[spIdx].clientName||'').toLowerCase().trim();
    if(clientName){
      const client = clients.find(c=>(c.name||'').toLowerCase().trim()===clientName);
      if(client?.completedProjects){
        const cp = client.completedProjects.find(p=>String(p.jobId)===String(jobId));
        if(cp){
          cp.address = newAddress;
          saveClientsToStorage(); // already writes to Firebase with retry
        }
      }
    }
    renderTracker();
  }
}

// Toggle light/dark mode for the tracker pane
let _trackerLightMode = false;
function trackerToggleLightMode(){
  _trackerLightMode = !_trackerLightMode;
  const pane = document.getElementById('pane-tracker');
  const btn = document.getElementById('tracker-light-btn');
  if(_trackerLightMode){
    pane?.classList.add('tracker-light');
    if(btn) btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    btn?.setAttribute('title','Switch to dark mode');
  } else {
    pane?.classList.remove('tracker-light');
    if(btn) btn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
    btn?.setAttribute('title','Switch to light mode');
  }
  // Fix My Projects button if not active
  const mineBtn=document.getElementById('tracker-mine-btn');
  if(mineBtn && !_trackerMineOnly){
    mineBtn.style.background=_trackerLightMode?'#e8eaf2':'var(--navy-lift)';
    mineBtn.style.color=_trackerLightMode?'#6b7280':'var(--muted)';
    mineBtn.style.borderColor=_trackerLightMode?'#c8cce0':'var(--border)';
  }
  // trackerSetTab re-applies per-tab colors and calls renderTracker()
  trackerSetTab(_trackerTab);
}

function openTrackerModal(jobId){
  let job=savedJobs.find(j=>String(j.id)===String(jobId));
  // For imported / standalone projects, build a synthetic job object
  if(!job){
    const sp=getStandaloneProjects().find(s=>String(s.id)===String(jobId));
    if(sp){
      job={
        id:sp.id,
        name:sp.address||sp.clientName||sp.projectId||'Imported Project',
        address:sp.address||'',
        clientName:sp.clientName||'',
        company:sp.company||'',
        date:sp.date||'',
        duration:sp.approxFilmHours||'',
        clientId:null,
        payouts:{},
        services:{},
        editors:{},
        grand:0,
        isStandalone:true,
        _sp:sp,
      };
    }
  }
  if(!job) return;
  const ts=getTrackerStage(jobId);
  const pid=ts.projectId||getProjectId(job);
  const client=job.clientId?clients.find(c=>c.id===job.clientId):null;
  const fmtN=n=>'$'+Number(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Derive shooter from payouts (standalone jobs use tracker videographer)
  const vidPayout=Object.values(job.payouts||{}).find(p=>(p.lines||[]).some(l=>l.label?.includes('Video')));
  const videographer=vidPayout?.name||ts.videographer||ts.claimedBy||'—';

  // Draft charge calc
  const draftCount=parseInt(ts.draftCount||0);
  const extraCharge=Math.max(0,draftCount-2)*30;

  // Film hours from job duration
  const filmHours=ts.approxFilmHours||job.duration||'';

  const stageOpts=TRACKER_STAGES.map(s=>`<option value="${s.key}"${ts.stage===s.key?' selected':''}>${s.label}</option>`).join('');
  const editStatusOpts=EDIT_STATUS_OPTS.map(s=>`<option value="${s.key}"${ts.editStatus===s.key?' selected':''}>${s.label}</option>`).join('');
  const contractorOpts=buildEditorOptions(ts.claimedBy||'');
  const vidOpts=buildVideographerOptions(ts.videographer||videographer);

  // ── SIMPLIFIED MODAL FOR TEAM MEMBERS ────────────────────────────────────────
  const _tmSession=gateGetSession();
  const _isTeamMember=_tmSession&&_tmSession.type==='team';
  if(_isTeamMember){
    const tmModal=document.createElement('div');
    tmModal.id='tracker-modal-overlay';
    tmModal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9500;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
    let _tmTeamDown=null;
    tmModal.addEventListener('mousedown',e=>{_tmTeamDown=e.target;});
    tmModal.addEventListener('mouseup',e=>{if(e.target===tmModal&&_tmTeamDown===tmModal)tmModal.remove();});
    tmModal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:560px;border:1px solid var(--border-bright);overflow:hidden;margin:auto" onclick="event.stopPropagation()">
      <div style="background:var(--navy-mid);padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start">
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:3px">${job.name}</div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            ${client?`<span style="font-size:11px;color:var(--muted)">${client.name}${client.company?' · '+client.company:''}</span>`:''}
            <span style="font-size:11px;color:var(--muted)">${job.date||''}</span>
            ${job.address?`<span style="font-size:11px;color:var(--muted)">${job.address}</span>`:''}
          </div>
        </div>
        <button onclick="this.closest('#tracker-modal-overlay').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:20px;flex-shrink:0;padding:0 0 0 12px">✕</button>
      </div>
      <div style="padding:20px;overflow-y:auto;max-height:calc(90vh - 80px)">

        <div style="font-size:10px;font-weight:700;color:var(--blue-bright);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Status</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Kanban stage</label>
            <select id="tm-stage" style="width:100%;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${stageOpts}</select>
          </div>
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Edit status</label>
            <select id="tm-edit-status" style="width:100%;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${editStatusOpts}</select>
          </div>
        </div>

        <div style="font-size:10px;font-weight:700;color:var(--blue-bright);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Team assignment</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div>
            <label style="font-size:10px;font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em;color:${(ts.claimedBy==='DroneHub'||ts.claimedBy==='dronehub'||!ts.claimedBy)?'#FF7070':'var(--muted)'}">Assigned editor ${(ts.claimedBy==='DroneHub'||ts.claimedBy==='dronehub'||!ts.claimedBy)?'⚠ needs assignment':''}</label>
            <select id="tm-assigned" style="width:100%;padding:6px 8px;border:1px solid ${(ts.claimedBy==='DroneHub'||ts.claimedBy==='dronehub'||!ts.claimedBy)?'rgba(240,82,82,.5)':'var(--border-bright)'};border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${contractorOpts}</select>
          </div>
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Videographer</label>
            <select id="tm-videographer" style="width:100%;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${vidOpts}</select>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px">
          <div style="padding:10px 12px;background:var(--navy-lift);border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;font-weight:600;color:var(--offwhite)">
              <input type="checkbox" id="tm-files-received" ${ts.filesReceived?'checked':''} style="width:16px;height:16px;accent-color:var(--green);cursor:pointer">
              <span>Footage received</span>
            </label>
            <span id="tm-files-status" style="font-size:11px;font-weight:700;color:${ts.filesReceived?'var(--green)':'var(--red)'}">
              ${ts.filesReceived?'✓ Confirmed':'⏳ Pending'}
            </span>
          </div>
          <div style="padding:10px 12px;background:${ts.rush?'rgba(240,82,82,.15)':'var(--navy-lift)'};border-radius:8px;border:1px solid ${ts.rush?'var(--red)':'var(--border)'};display:flex;align-items:center;gap:10px">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:13px;font-weight:600;color:${ts.rush?'var(--red)':'var(--offwhite)'}">
              <input type="checkbox" id="tm-rush" ${ts.rush?'checked':''} style="width:16px;height:16px;accent-color:var(--red);cursor:pointer">
              <span>Rush order</span>
            </label>
          </div>
        </div>

        <div style="font-size:10px;font-weight:700;color:var(--blue-bright);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Links</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px">
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Filemail Links <span style="font-size:9px;font-weight:400;text-transform:none;letter-spacing:0">— raw footage downloads</span></label>
            <div id="tm-filemail-links-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:5px">
              ${(ts.filemailLinks&&ts.filemailLinks.length?ts.filemailLinks:ts.filemailLink?[ts.filemailLink]:[]).map((url,i)=>`
              <div id="tm-fl-row-${i}" style="display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center">
                <input type="url" class="tm-fl-url" data-idx="${i}" value="${(url||'').replace(/"/g,'&quot;')}" placeholder="https://filemail.com/…" style="padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);box-sizing:border-box;min-width:0">
                <button onclick="tmRemoveFilemailLink(${i})" style="padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">✕</button>
              </div>`).join('')}
            </div>
            <button onclick="tmAddFilemailLink()" style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.06);color:var(--green);font-size:11px;font-weight:700;cursor:pointer">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Filemail Link
            </button>
          </div>
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Frame.io — client review</label>
            <div style="display:flex;gap:6px">
              <input type="url" id="tm-frameio" value="${ts.frameioLink||''}" placeholder="https://app.frame.io/…" style="flex:1;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">
              ${ts.frameioLink?`<a href="${ts.frameioLink}" target="_blank" style="padding:6px 12px;border-radius:8px;border:1px solid var(--purple);background:var(--purple-bg);color:#A78BFA;font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap;display:flex;align-items:center">▶ Frame.io</a>`:''}
            </div>
          </div>
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Google Drive link — finals for client</label>
            <div style="display:flex;gap:6px">
              <input type="url" id="tm-download" value="${ts.downloadLink||''}" placeholder="https://drive.google.com/…" style="flex:1;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">
              ${ts.downloadLink?`<a href="${ts.downloadLink}" target="_blank" style="padding:6px 12px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap;display:flex;align-items:center">↓ Open</a>`:''}
            </div>
          </div>
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Dropbox link — finals for client</label>
            <div style="display:flex;gap:6px">
              <input type="url" id="tm-dropbox" value="${ts.dropboxLink||''}" placeholder="https://www.dropbox.com/…" style="flex:1;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">
              ${ts.dropboxLink?`<a href="${ts.dropboxLink}" target="_blank" style="padding:6px 12px;border-radius:8px;border:1px solid rgba(0,97,255,.5);background:rgba(0,97,255,.1);color:#0061FF;font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap;display:flex;align-items:center">Open</a>`:''}
            </div>
          </div>
        </div>

        <div style="font-size:10px;font-weight:700;color:var(--blue-bright);text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px">Project notes</div>
        <textarea id="tm-notes" rows="3" placeholder="Instructions, shoot notes, client preferences…" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);resize:vertical;line-height:1.6;margin-bottom:16px">${ts.notes||''}</textarea>

        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button onclick="saveTrackerModal('${jobId}',document.getElementById('tracker-modal-overlay'))" style="padding:9px 24px;border-radius:14px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:13px;font-weight:700;cursor:pointer">Save ✓</button>
          <button onclick="document.getElementById('tracker-modal-overlay').remove()" style="padding:9px 16px;border-radius:14px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>`;
    document.body.appendChild(tmModal);
    tmModal.querySelector('#tm-files-received')?.addEventListener('change',function(){
      const el=document.getElementById('tm-files-status');
      if(el){el.textContent=this.checked?'✓ Confirmed':'⏳ Pending';el.style.color=this.checked?'var(--green)':'var(--red)';}
    });
    return;
  }
  // ── END TEAM MEMBER MODAL ─────────────────────────────────────────────────────

  const inp=(id,label,val,type='text',placeholder='')=>'<div>'+
    `<label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">${label}</label>`+
    `<input type="${type}" id="tm-${id}" value="${(val||'').toString().replace(/"/g,'&quot;')}" placeholder="${placeholder}" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)"></div>`;

  const modal=document.createElement('div');
  modal.id='tracker-modal-overlay';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.7);z-index:9500;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto';
  // Use mousedown+mouseup pair so that drag-selecting text inside the modal
  // and releasing the cursor over the overlay does NOT close the modal.
  let _tmMouseDownTarget=null;
  modal.addEventListener('mousedown',e=>{ _tmMouseDownTarget=e.target; });
  modal.addEventListener('mouseup',e=>{ if(e.target===modal&&_tmMouseDownTarget===modal) modal.remove(); });

  const _lbl=t=>`<div style="font-size:10px;font-weight:700;color:var(--blue-bright);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">${t}</div>`;
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:960px;border:1px solid var(--border-bright);overflow:hidden;margin:auto" onclick="event.stopPropagation()">
    <div style="background:var(--navy-mid);padding:14px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--white)">${job.name}</div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:2px">
          <span style="font-size:11px;color:var(--muted);font-family:monospace">ID: ${pid}</span>
          ${client?`<span style="font-size:11px;color:var(--muted)">${client.name}${client.company?' · '+client.company:''}</span>`:''}
          <span style="font-size:11px;color:var(--muted)">${job.date}</span>
        </div>
      </div>
      <button onclick="this.closest('#tracker-modal-overlay').remove()" style="border:none;background:rgba(255,255,255,.06);color:var(--muted);cursor:pointer;font-size:16px;width:28px;height:28px;border-radius:7px;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
    </div>
    <div style="padding:16px 20px;display:grid;grid-template-columns:1fr 1fr;gap:20px;align-items:start">

      <!-- LEFT: Project Identity -->
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- Address prominent at top -->
        <div>
          <label style="font-size:10px;color:var(--blue-bright);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.08em">Property Address</label>
          <input type="text" id="tm-address" value="${(job.address||'').toString().replace(/"/g,'&quot;')}" placeholder="123 Main St, City…" style="width:100%;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white);box-sizing:border-box">
        </div>

        <!-- Client + date on same row -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${inp('client-name','Client name',client?.name||job.clientName||'','text','')}
          ${inp('shoot-date','Shoot date',job.date||'','date','')}
        </div>

        <!-- Company + Videographer -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${inp('company','Company / team',client?.company||job.company||'','text','')}
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Videographer</label>
            <select id="tm-videographer" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${buildVideographerOptions(videographer)}</select>
          </div>
        </div>

        <!-- Project ID + Completion date (reference/admin fields, lowest priority) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          ${inp('project-id','Project ID',pid,'text','DH-2025-001')}
          ${inp('completion-date','Completion date',ts.completionDate||'','date','')}
        </div>

        <!-- Divider -->
        <div style="border-top:1px solid var(--border)"></div>

        <!-- Notes here on the left so it's read with the project context -->
        <div>
          ${_lbl('Notes')}
          <textarea id="tm-notes" rows="4" placeholder="Shoot instructions, gate codes, special requests, client preferences…" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);resize:vertical;line-height:1.6">${ts.notes||''}</textarea>
          ${ts.updatedAt?`<div style="font-size:10px;color:var(--muted);margin-top:4px">Last updated: ${ts.updatedAt}${ts.claimedBy?' by '+ts.claimedBy:''}</div>`:''}
        </div>
      </div>

      <!-- RIGHT: Status & Operations -->
      <div style="display:flex;flex-direction:column;gap:14px">

        <!-- Kanban + Edit status + Editor — the core workflow status -->
        <div>
          ${_lbl('Status & Assignment')}
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            <div>
              <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Stage</label>
              <select id="tm-stage" style="width:100%;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${stageOpts}</select>
            </div>
            <div>
              <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Edit status</label>
              <select id="tm-edit-status" onchange="tmUpdateDraftCharge()" style="width:100%;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${editStatusOpts}</select>
            </div>
            <div>
              <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Editor</label>
              <select id="tm-assigned" style="width:100%;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">${contractorOpts}</select>
            </div>
          </div>
        </div>

        <!-- Files & Hours together -->
        <div>
          ${_lbl('Hours & Files')}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            ${inp('film-hours','Film hrs',filmHours,'number','e.g. 2')}
            ${inp('edit-hours','Edit hrs',ts.approxEditHours||'','number','e.g. 4')}
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="padding:8px 10px;background:var(--navy-lift);border-radius:8px;border:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:6px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:600;color:var(--offwhite)">
                <input type="checkbox" id="tm-files-received" ${ts.filesReceived?'checked':''} style="width:15px;height:15px;accent-color:var(--green);cursor:pointer">
                <span>Files received</span>
              </label>
              <span id="tm-files-status" style="font-size:10px;font-weight:700;color:${ts.filesReceived?'var(--green)':'var(--red)'};white-space:nowrap">
                ${ts.filesReceived?'✓ Yes':'⏳ No'}
              </span>
            </div>
            <div style="padding:8px 10px;background:${ts.rush?'rgba(240,82,82,.15)':'var(--navy-lift)'};border-radius:8px;border:1px solid ${ts.rush?'var(--red)':'var(--border)'};display:flex;align-items:center;justify-content:space-between;gap:6px">
              <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:12px;font-weight:600;color:${ts.rush?'var(--red)':'var(--offwhite)'}">
                <input type="checkbox" id="tm-rush" ${ts.rush?'checked':''} style="width:15px;height:15px;accent-color:var(--red);cursor:pointer">
                <span>Rush order</span>
              </label>
              <span style="font-size:10px;font-weight:700;color:${ts.rush?'var(--red)':'var(--muted)'}">
                ${ts.rush?'RUSH':'Normal'}
              </span>
            </div>
          </div>
        </div>

        <!-- Draft tracking -->
        <div>
          ${_lbl('Draft Tracking')}
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div>
              <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Draft count</label>
              <input type="number" id="tm-draft-count" min="0" value="${draftCount}" oninput="tmUpdateDraftCharge()" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">
            </div>
            <div style="display:flex;flex-direction:column;justify-content:flex-end">
              <div id="tm-draft-charge-display" style="padding:7px 10px;background:${extraCharge>0?'var(--amber-bg)':'var(--navy-lift)'};border-radius:8px;border:1px solid ${extraCharge>0?'var(--amber)':'var(--border)'};font-size:11px;font-weight:700;color:${extraCharge>0?'var(--amber)':'var(--muted)'}">
                ${extraCharge>0?`+$${extraCharge} (${draftCount-2} extra × $30)`:'No surcharge (≤2 drafts)'}
              </div>
            </div>
          </div>
        </div>

        <!-- Divider -->
        <div style="border-top:1px solid var(--border)"></div>

        <!-- Links -->
        <div>
          ${_lbl('Links')}
          <div style="display:flex;flex-direction:column;gap:8px">

            <!-- Filemail dynamic list -->
            <div>
              <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Filemail <span style="font-size:9px;font-weight:400;text-transform:none;letter-spacing:0;opacity:.7">raw footage for editor</span></label>
              <div id="tm-filemail-links-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:5px">
                ${(ts.filemailLinks&&ts.filemailLinks.length?ts.filemailLinks:ts.filemailLink?[ts.filemailLink]:[]).map((url,i)=>`
                <div id="tm-fl-row-${i}" style="display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center">
                  <input type="url" class="tm-fl-url" data-idx="${i}" value="${(url||'').replace(/"/g,'&quot;')}" placeholder="https://filemail.com/…" style="padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);box-sizing:border-box;min-width:0">
                  <button onclick="tmRemoveFilemailLink(${i})" style="padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">✕</button>
                </div>`).join('')}
              </div>
              <button onclick="tmAddFilemailLink()" style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.06);color:var(--green);font-size:11px;font-weight:700;cursor:pointer">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Filemail Link
              </button>
            </div>

            <!-- Drive + Dropbox side by side -->
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:7px">
              <div>
                <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Google Drive <span style="font-size:9px;font-weight:400;text-transform:none;opacity:.7">finals</span></label>
                <div style="display:flex;gap:5px">
                  <input type="url" id="tm-download" value="${ts.downloadLink||''}" placeholder="https://drive.google.com/…" style="flex:1;min-width:0;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">
                  ${ts.downloadLink?`<a href="${ts.downloadLink}" target="_blank" style="padding:6px 8px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;text-decoration:none;display:flex;align-items:center">↗</a>`:''}
                </div>
              </div>
              <div>
                <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Dropbox <span style="font-size:9px;font-weight:400;text-transform:none;opacity:.7">finals</span></label>
                <div style="display:flex;gap:5px">
                  <input type="url" id="tm-dropbox" value="${ts.dropboxLink||''}" placeholder="https://dropbox.com/…" style="flex:1;min-width:0;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">
                  ${ts.dropboxLink?`<a href="${ts.dropboxLink}" target="_blank" style="padding:6px 8px;border-radius:8px;border:1px solid rgba(0,97,255,.5);background:rgba(0,97,255,.1);color:#0061FF;font-size:11px;font-weight:700;text-decoration:none;display:flex;align-items:center">↗</a>`:''}
                </div>
              </div>
            </div>

            <!-- Review links dynamic list -->
            <div>
              <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Review Links <span style="font-size:9px;font-weight:400;text-transform:none;letter-spacing:0;opacity:.7">YouTube, Vimeo, Drive…</span></label>
              <div id="tm-review-links-list" style="display:flex;flex-direction:column;gap:5px;margin-bottom:5px">
                ${(ts.reviewLinks&&ts.reviewLinks.length?ts.reviewLinks:[]).map((rl,i)=>`
                <div id="tm-rl-row-${i}" style="display:grid;grid-template-columns:1fr auto auto;gap:4px;align-items:center">
                  <input type="url" class="tm-rl-url" data-idx="${i}" value="${(rl.url||'').replace(/"/g,'&quot;')}" placeholder="https://…" style="padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);box-sizing:border-box;min-width:0">
                  <select class="tm-rl-type" data-idx="${i}" style="padding:6px;border:1px solid var(--border-bright);border-radius:8px;font-size:11px;background:var(--navy-lift);color:var(--white);cursor:pointer">
                    <option value="horizontal" ${(rl.type||'horizontal')==='horizontal'?'selected':''}>↔ Horiz</option>
                    <option value="reel" ${rl.type==='reel'?'selected':''}>↕ Reel</option>
                  </select>
                  <button onclick="tmRemoveReviewLink(${i})" style="padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">✕</button>
                </div>`).join('')}
              </div>
              <button onclick="tmAddReviewLink()" style="display:flex;align-items:center;gap:5px;padding:5px 10px;border-radius:8px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.06);color:var(--green);font-size:11px;font-weight:700;cursor:pointer">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Review Link
              </button>
            </div>

          </div>
        </div>
      </div>
    </div>
    <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;gap:8px;justify-content:flex-end">
      <button onclick="document.getElementById('tracker-modal-overlay').remove()" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer">Cancel</button>
      <button onclick="document.getElementById('tracker-modal-overlay').remove();openVdProfile('${jobId}','team')" style="padding:8px 16px;border-radius:10px;border:1px solid rgba(91,141,239,.5);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Video Review</button>
      <button onclick="saveTrackerModal('${jobId}',document.getElementById('tracker-modal-overlay'))" style="padding:8px 22px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">Save ✓</button>
    </div>
  </div>`;

  document.body.appendChild(modal);

  // Wire checkbox to update status label live
  document.getElementById('tm-files-received').addEventListener('change',function(){
    const el=document.getElementById('tm-files-status');
    if(el){el.innerHTML=this.checked?'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Files confirmed':'<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Awaiting files';el.style.color=this.checked?'var(--green)':'var(--red)';}
  });
}

function tmAddReviewLink(){
  const list = document.getElementById('tm-review-links-list');
  if(!list) return;
  const idx = list.querySelectorAll('[id^="tm-rl-row-"]').length;
  const row = document.createElement('div');
  row.id = 'tm-rl-row-'+idx;
  row.style.cssText = 'display:grid;grid-template-columns:1fr auto auto;gap:4px;align-items:center';
  row.innerHTML = `
    <input type="url" class="tm-rl-url" data-idx="${idx}" value="" placeholder="https://…" style="padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);box-sizing:border-box;min-width:0">
    <select class="tm-rl-type" data-idx="${idx}" style="padding:6px 6px;border:1px solid var(--border-bright);border-radius:8px;font-size:11px;background:var(--navy-lift);color:var(--white);cursor:pointer">
      <option value="horizontal">↔ Horizontal</option>
      <option value="reel">↕ Reel</option>
    </select>
    <button onclick="tmRemoveReviewLink(${idx})" style="padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">✕</button>`;
  list.appendChild(row);
}

function tmRemoveReviewLink(idx){
  const row = document.getElementById('tm-rl-row-'+idx);
  if(row) row.remove();
}

function tmCollectReviewLinks(){
  const urls  = document.querySelectorAll('.tm-rl-url');
  const types = document.querySelectorAll('.tm-rl-type');
  const links = [];
  urls.forEach((inp, i) => {
    const url = inp.value.trim();
    if(url) links.push({ id:'rl_'+Date.now()+'_'+i, url, type: types[i]?.value||'horizontal' });
  });
  return links;
}

function tmAddFilemailLink(){
  const list = document.getElementById('tm-filemail-links-list');
  if(!list) return;
  const idx = list.querySelectorAll('[id^="tm-fl-row-"]').length;
  const row = document.createElement('div');
  row.id = 'tm-fl-row-'+idx;
  row.style.cssText = 'display:grid;grid-template-columns:1fr auto;gap:4px;align-items:center';
  row.innerHTML = `
    <input type="url" class="tm-fl-url" data-idx="${idx}" value="" placeholder="https://filemail.com/…" style="padding:6px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);box-sizing:border-box;min-width:0">
    <button onclick="tmRemoveFilemailLink(${idx})" style="padding:5px 8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">✕</button>`;
  list.appendChild(row);
  row.querySelector('input').focus();
}

function tmRemoveFilemailLink(idx){
  const row = document.getElementById('tm-fl-row-'+idx);
  if(row) row.remove();
}

function tmCollectFilemailLinks(){
  const inputs = document.querySelectorAll('.tm-fl-url');
  const links = [];
  inputs.forEach(inp => { const u=inp.value.trim(); if(u) links.push(u); });
  return links;
}

function tmUpdateDraftCharge(){
  const count=parseInt(document.getElementById('tm-draft-count')?.value||0);
  const extra=Math.max(0,count-2)*30;
  const el=document.getElementById('tm-draft-charge-display');
  if(!el) return;
  el.style.background=extra>0?'var(--amber-bg)':'var(--navy-lift)';
  el.style.borderColor=extra>0?'var(--amber)':'var(--border)';
  el.style.color=extra>0?'var(--amber)':'var(--muted)';
  el.innerHTML=extra>0?'<span style="display:inline-flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg> Draft surcharge: +$'+extra+' ('+(count-2)+' extra draft'+(count-2===1?'':'s')+' × $30)</span>':'No draft surcharge (≤2 drafts)';
}

function saveTrackerModal(jobId, modal){
  jobId=String(jobId);
  const v=id=>document.getElementById(id)?.value||'';
  const stage=v('tm-stage')||'ready';
  const claimedBy=v('tm-assigned');
  const notes=v('tm-notes');
  const editStatus=v('tm-edit-status')||'ready';
  const filesReceived=document.getElementById('tm-files-received')?.checked||false;
  const rush=document.getElementById('tm-rush')?.checked||false;
  const filemailLinks=tmCollectFilemailLinks();
  const filemailLink=filemailLinks[0]||'';
  const downloadLink=v('tm-download');
  const dropboxLink=v('tm-dropbox');
  const videographer=v('tm-videographer');
  const reviewLinks=tmCollectReviewLinks();
  // Legacy frameioLink: keep first horizontal link for back-compat display
  const frameioLink=(reviewLinks.find(l=>l.type==='horizontal')||reviewLinks[0])?.url||'';

  // Detect team-member simplified form — admin-only fields may not exist
  const _saveSession=gateGetSession();
  const _saveIsTeam=_saveSession&&_saveSession.type==='team';
  const existing=getTrackerStage(jobId);

  let stageUpdate;
  if(_saveIsTeam){
    // Team members only write the fields visible in their simplified form;
    // preserve all admin-only values from the existing tracker record.
    stageUpdate={
      stage,claimedBy,notes,editStatus,filesReceived,rush,
      filemailLink,filemailLinks,frameioLink,reviewLinks,downloadLink,dropboxLink,videographer,
      claimedAt:claimedBy?new Date().toISOString().slice(0,10):'',
      // Preserve admin-only fields
      draftCount:existing.draftCount||0,
      projectId:existing.projectId||'',
      approxEditHours:existing.approxEditHours||'',
      approxFilmHours:existing.approxFilmHours||'',
      completionDate:existing.completionDate||'',
      extraDraftCharge:existing.extraDraftCharge||0,
    };
  } else {
    const draftCount=parseInt(v('tm-draft-count'))||0;
    const projectId=v('tm-project-id');
    const approxEditHours=v('tm-edit-hours');
    const approxFilmHours=v('tm-film-hours');
    const completionDate=v('tm-completion-date');
    const extraDraftCharge=Math.max(0,draftCount-2)*30;
    stageUpdate={
      stage,claimedBy,notes,editStatus,filesReceived,rush,draftCount,
      projectId,filemailLink,filemailLinks,frameioLink,reviewLinks,downloadLink,dropboxLink,
      approxEditHours,approxFilmHours,completionDate,videographer,
      claimedAt:claimedBy?new Date().toISOString().slice(0,10):'',
      extraDraftCharge,
    };
  }

  // Apply draft surcharge to job if > 2 drafts (admin-only)
  const job=savedJobs.find(j=>String(j.id)===String(jobId));
  if(!_saveIsTeam&&job&&stageUpdate.extraDraftCharge>0){
    job.customAdj=(job.customAdj||0);
    // Store draft charge separately — will be added to next invoice
  }

  // For standalone/imported projects: persist edits to address, client name, company, and date
  if(!job){
    const standaloneArr=getStandaloneProjects();
    const spIdx=standaloneArr.findIndex(s=>String(s.id)===String(jobId));
    if(spIdx>=0){
      const sp=standaloneArr[spIdx];
      const newAddress=document.getElementById('tm-address')?.value;
      const newClient=document.getElementById('tm-client-name')?.value;
      const newDate=document.getElementById('tm-shoot-date')?.value;
      const newCompany=document.getElementById('tm-company')?.value;
      if(newAddress!==undefined) sp.address=newAddress;
      if(newClient!==undefined) sp.clientName=newClient;
      if(newDate!==undefined) sp.date=newDate;
      if(newCompany!==undefined) sp.company=newCompany;
      sp.videographer=stageUpdate.videographer||sp.videographer||'';
      sp.stage=stageUpdate.stage||sp.stage||'footage_pending';
      sp.editStatus=stageUpdate.editStatus||sp.editStatus||'ready';
      sp.claimedBy=stageUpdate.claimedBy||sp.claimedBy||'';
      sp.notes=stageUpdate.notes||sp.notes||'';
      sp.filemailLink=stageUpdate.filemailLink||sp.filemailLink||'';
      sp.frameioLink=stageUpdate.frameioLink||sp.frameioLink||'';
      sp.downloadLink=stageUpdate.downloadLink||sp.downloadLink||'';
      sp.dropboxLink=stageUpdate.dropboxLink||sp.dropboxLink||'';
      sp.approxEditHours=stageUpdate.approxEditHours!==undefined?stageUpdate.approxEditHours:(sp.approxEditHours||'');
      sp.approxFilmHours=stageUpdate.approxFilmHours!==undefined?stageUpdate.approxFilmHours:(sp.approxFilmHours||'');
      sp.completionDate=stageUpdate.completionDate||sp.completionDate||'';
      sp.filesReceived=stageUpdate.filesReceived;
      sp.rush=stageUpdate.rush;
      sp.projectId=stageUpdate.projectId||sp.projectId||'';
      saveStandaloneProjects(standaloneArr);
    }
  } else {
    // For regular saved jobs: persist edits to client name, company, address, and date
    const newAddress=document.getElementById('tm-address')?.value;
    const newClient=document.getElementById('tm-client-name')?.value;
    const newDate=document.getElementById('tm-shoot-date')?.value;
    const newCompany=document.getElementById('tm-company')?.value;
    if(newAddress!==undefined) job.address=newAddress;
    if(newClient!==undefined) job.clientName=newClient;
    if(newDate!==undefined) job.date=newDate;
    if(newCompany!==undefined) job.company=newCompany;
    saveJobsToStorage();
  }

  setTrackerStage(jobId, stageUpdate);

  // Auto-link to client profile when project is marked complete
  if(stageUpdate.editStatus==='finals_sent') linkProjectToClient(jobId);

  // Auto-calculate editor paystub from hours logged (admin only)
  const approxEditHours=stageUpdate.approxEditHours||'';
  if(!_saveIsTeam&&approxEditHours&&claimedBy&&job){
    const hours=parseFloat(approxEditHours)||0;
    if(hours>0){
      // Find editor's hourly rate from admin team
      const editorMember=getAdminTeamMembers().find(m=>m.name===claimedBy||m.email===claimedBy);
      const hourlyRate=editorMember?.hourlyRate||0;
      if(hourlyRate>0){
        const editPay=Math.round(hours*hourlyRate*100)/100;
        if(!job.payouts) job.payouts={};
        if(!job.payouts[claimedBy]) job.payouts[claimedBy]={name:claimedBy,entries:[]};
        // Update or add edit entry
        const existingIdx=job.payouts[claimedBy].entries?.findIndex(e=>e.role==='Video editing');
        const editEntry={role:'Video editing',editFee:editPay,hours,hourlyRate,shootFee:0,driveFee:0};
        if(existingIdx>=0) job.payouts[claimedBy].entries[existingIdx]=editEntry;
        else {
          if(!job.payouts[claimedBy].entries) job.payouts[claimedBy].entries=[];
          job.payouts[claimedBy].entries.push(editEntry);
        }
        saveJobsToStorage();
        renderPayroll();
      }
    }
  }
  if(modal) modal.remove();
  renderTracker();
}

