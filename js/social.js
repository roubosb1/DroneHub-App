// ── SOCIAL MEDIA MANAGEMENT ───────────────────────────────────────────────────

const SOCIAL_PLATFORMS = [
  {id:'instagram', label:'Instagram'},
  {id:'facebook',  label:'Facebook'},
  {id:'tiktok',    label:'TikTok'},
  {id:'linkedin',  label:'LinkedIn'},
  {id:'twitter',   label:'X / Twitter'},
];

const SOCIAL_FORMATS = [
  {id:'reel',      label:'Reel'},
  {id:'post',      label:'Photo Post'},
  {id:'carousel',  label:'Carousel'},
  {id:'story',     label:'Story'},
  {id:'tiktok',    label:'TikTok'},
  {id:'video',     label:'Video'},
  {id:'ad_mockup', label:'Ad Mock-up'},
];

// Unified statuses — round tracked via approvalRound field
const SOCIAL_STATUSES = [
  {id:'draft',    label:'Draft',    color:'#A8B4D0'},
  {id:'pending',  label:'Pending',  color:'#F5C842'},
  {id:'revision', label:'Revision', color:'#FB923C'},
  {id:'approved', label:'Approved', color:'#7AABFF'},
  {id:'scheduled',label:'Scheduled',color:'#22D97A'},
  {id:'published',label:'Published',color:'#A78BFA'},
];

// Distinctly different, non-pastel label colors for properties
const SOCIAL_LABEL_COLORS = [
  '#FF3B30','#FF9500','#FFCC00','#34C759',
  '#00C7BE','#007AFF','#AF52DE','#FF2D55',
];

const PLATFORM_SPECS = {
  instagram: {maxChars:2200,  label:'Instagram max 2,200'},
  facebook:  {maxChars:63206, label:'Facebook max 63,206'},
  twitter:   {maxChars:280,   label:'X/Twitter max 280'},
  linkedin:  {maxChars:3000,  label:'LinkedIn max 3,000'},
  tiktok:    {maxChars:2200,  label:'TikTok max 2,200'},
};

const FORMAT_COLORS = {
  reel:'#E1306C', post:'#7AABFF', carousel:'#F5C842',
  story:'#A78BFA', tiktok:'#69C9D0', video:'#A78BFA',
  ad_mockup:'#FB923C',
};

let _socialActiveWorkspace = null;
let _socialSubTab = 'workspaces';
let _socialPostFilter = 'all';
let _socialEditingWsId = null;
let _socialEditingPostId = null;
let _socialCalYear = new Date().getFullYear();
let _socialCalMonth = new Date().getMonth();
let _socialNewLabelColor = SOCIAL_LABEL_COLORS[0];
// Reel upload state
let _reelObjectUrl = null;
let _reelCoverDataUrl = null;
let _reelCoverTime = 0;
let _reelDuration = 0;
let _frameStripCapturing = false;

// ── Storage ───────────────────────────────────────────────────────────────────────────────
function socialWorkspacesLoad(){
  try{ return JSON.parse(localStorage.getItem('dronehub_social_workspaces')||'[]'); }catch(e){ return []; }
}
function socialWorkspacesSave(arr){
  localStorage.setItem('dronehub_social_workspaces', JSON.stringify(arr));
  if(_fbToken()){
    fbSetStrict('orgs', ORG_ID+':social_workspaces', {data:JSON.stringify(arr), updatedAt:Date.now()})
      .catch(e=>{
        console.error('[socialWorkspacesSave] Firebase write failed:', e.message);
        showDhToast('Workspace not saved','Social workspace could not be saved to the cloud — changes may be lost on next login.','⚠️','var(--orange)',7000);
      });
  }
}
function socialPostsLoad(){
  try{
    const posts=JSON.parse(localStorage.getItem('dronehub_social_posts')||'[]');
    return posts.map(p=>{
      if(p.status==='pending_r1') p={...p,status:'pending',approvalRound:1};
      else if(p.status==='pending_r2') p={...p,status:'pending',approvalRound:2};
      else if(p.status==='revision_r1') p={...p,status:'revision',approvalRound:1};
      else if(p.status==='revision_r2') p={...p,status:'revision',approvalRound:2};
      else if(p.status==='approved_r1') p={...p,status:'approved',approvalRound:1};
      if(!p.chatLog){
        const h=(p.history||[]).map(e=>({id:'h_'+(e.at||Date.now()),type:'system',from:'team',by:e.by||'team',text:e.action,at:e.at||new Date().toISOString()}));
        const c=(p.clientComments||[]).map(e=>({id:'cc_'+(e.at||Date.now()),type:e.text?.startsWith('✓')?'approval':'message',from:e.from||'client',by:e.from==='client'?'Client':'DroneHub',text:e.text,at:e.at||new Date().toISOString()}));
        p.chatLog=[...h,...c].sort((a,b)=>new Date(a.at)-new Date(b.at));
      }
      return p;
    });
  }catch(e){ return []; }
}
function socialPostsSave(arr){
  localStorage.setItem('dronehub_social_posts', JSON.stringify(arr));
  if(_fbToken()){
    fbSetStrict('orgs', ORG_ID+':social_posts', {data:JSON.stringify(arr), updatedAt:Date.now()})
      .catch(e=>{
        console.error('[socialPostsSave] Firebase write failed:', e.message);
        showDhToast('Post not saved','Social post could not be saved to the cloud — changes may be lost on next login.','⚠️','var(--orange)',7000);
      });
  }
}
function videoDraftsLoad(){
  try{ return JSON.parse(localStorage.getItem('dh_video_drafts')||'[]'); }catch(e){ return []; }
}
function videoDraftsSave(arr){
  localStorage.setItem('dh_video_drafts', JSON.stringify(arr));
  if(_fbToken()) fbSet('orgs', ORG_ID+':video_drafts',{data:JSON.stringify(arr),updatedAt:Date.now()}).catch(()=>{});
}
async function videoDraftsSyncFirebase(){
  if(!_fbToken()) return;
  try{
    const fb = await fbGet('orgs', ORG_ID+':video_drafts');
    if(fb?.data){ const r=JSON.parse(fb.data); localStorage.setItem('dh_video_drafts',JSON.stringify(r)); }
  }catch(e){}
}
function videoDraftForJob(jobId){
  return videoDraftsLoad().find(d=>d.jobId===jobId)||null;
}
function chatLogAppend(posts,idx,entry){
  if(!posts[idx].chatLog) posts[idx].chatLog=[];
  posts[idx].chatLog.push({
    id:'cl_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
    at:new Date().toISOString(),
    ...entry
  });
}
function socialLabelsLoad(wsId){
  const ws = socialWorkspacesLoad().find(w=>w.id===wsId);
  return ws?.labels || [];
}
function socialLabelsSave(wsId, labels){
  const all = socialWorkspacesLoad();
  const idx = all.findIndex(w=>w.id===wsId);
  if(idx>=0){ all[idx].labels=labels; socialWorkspacesSave(all); }
}

async function socialSyncFirebase(){
  if(!_fbToken()) return;
  try{
    const [fbWs,fbPosts] = await Promise.all([
      fbGet('orgs',ORG_ID+':social_workspaces'),
      fbGet('orgs',ORG_ID+':social_posts'),
    ]);
    if(fbWs?.data){ const r=JSON.parse(fbWs.data); if(r.length>=socialWorkspacesLoad().length) localStorage.setItem('dronehub_social_workspaces',JSON.stringify(r)); }
    if(fbPosts?.data){ const r=JSON.parse(fbPosts.data); if(r.length>=socialPostsLoad().length) localStorage.setItem('dronehub_social_posts',JSON.stringify(r)); }
  }catch(e){}
}

// ── Notifications ─────────────────────────────────────────────────────────────────────────
function notificationsLoad(){
  try{ return JSON.parse(localStorage.getItem('dh_social_notifs')||'[]'); }catch(e){ return []; }
}
function notificationsSave(arr){
  localStorage.setItem('dh_social_notifs',JSON.stringify(arr));
  if(_fbToken()) fbSet('orgs',ORG_ID+':social_notifs',{data:JSON.stringify(arr),updatedAt:Date.now()}).catch(()=>{});
}
function addSocialNotification(postId,text,type){
  const notifs=notificationsLoad();
  notifs.unshift({id:'n_'+Date.now(),postId,text,type:type||'message',at:new Date().toISOString(),read:false});
  if(notifs.length>50) notifs.splice(50);
  notificationsSave(notifs);
  refreshNotificationBadge();
  // Show a toast alert for the new notification
  const icons={approval:_icon('check',16),revision:_icon('edit',16),message:_icon('chat',16),date_change:_icon('calendar',16),video_approved:_icon('video',16),video_changes:_icon('refresh',16),booking:_icon('mail',16),tax_update:_icon('dollar',16)};
  const titles={approval:'Client Approved',revision:'Revision Requested',message:'New Message',date_change:'Date Changed',video_approved:'Video Approved',video_changes:'Changes Requested',booking:'New Booking Request',tax_update:'Payroll Tax Update'};
  const colors={approval:'#22D97A',revision:'#FB923C',video_approved:'#22D97A',video_changes:'#F5C842',booking:'var(--amber)',message:'var(--blue-bright)',date_change:'var(--blue-bright)',tax_update:'#F5C842'};
  showDhToast(titles[type]||'Notification', text, icons[type]||'🔔', colors[type]||'var(--blue-bright)');
}

// ══════════════════════════════════════════════
// ── VIDEO DRAFT REVIEW SYSTEM ─────────────────
// ══════════════════════════════════════════════

let _vdActiveJobId        = null;  // jobId currently open in the profile modal
let _vdActiveDraftId      = null;  // which draft version is being viewed
let _vdCommentTs          = null;  // captured timestamp in seconds (null = no timestamp)
let _vdViewerMode         = 'team'; // 'team' | 'client'
let _vdActiveReviewLinkId = null;  // id of the currently selected review link tab

function openVdProfile(jobId, viewerMode){
  _vdActiveJobId  = jobId;
  _vdViewerMode   = viewerMode || 'team';
  _vdCommentTs    = null;

  const job = (savedJobs||[]).find(j=>j.id===jobId);
  const vd  = videoDraftForJob(jobId);
  const ts  = getTrackerStage(jobId);
  const modal = document.getElementById('vd-profile-modal');
  if(!modal) return;

  // Header
  document.getElementById('vd-profile-title').textContent   = job ? (job.title||job.client||job.name||'Project Review') : 'Project Review';
  document.getElementById('vd-profile-subtitle').textContent = job ? `${job.clientName||job.client||''} · ${job.date||''}`.replace(/^·\s*/,'').replace(/\s*·$/,'') : '';

  // Seed review links from legacy frameioLink if reviewLinks is empty
  const reviewLinks = (ts.reviewLinks&&ts.reviewLinks.length)
    ? ts.reviewLinks
    : (ts.frameioLink ? [{id:'rl_legacy',url:ts.frameioLink,type:'horizontal'}] : []);

  // Set default active link
  _vdActiveReviewLinkId = reviewLinks.length ? reviewLinks[0].id : null;

  // Render review link tabs
  vdRenderReviewTabs(reviewLinks);

  // If no draft record yet, create a shell
  if(!vd){
    _vdActiveDraftId = null;
    vdRenderNoDraft();
  } else {
    // Default to latest draft
    const latest = vd.drafts[vd.drafts.length-1];
    _vdActiveDraftId = latest?.id || null;
    vdRenderProfile(vd);
  }

  // If review links exist, always load the first one (drafts with videoUrl take priority inside vdRenderProfile)
  if(reviewLinks.length){
    const activeDraft = vd?.drafts?.find(d=>d.id===_vdActiveDraftId);
    if(!activeDraft?.videoUrl) vdLoadReviewLink(reviewLinks[0]);
  }

  // Show/hide team vs client sections
  const uploadSec   = document.getElementById('vd-upload-section');
  const approvalSec = document.getElementById('vd-approval-section');
  if(uploadSec)   uploadSec.style.display   = _vdViewerMode==='team'   ? '' : 'none';
  if(approvalSec) approvalSec.style.display = _vdViewerMode==='client' ? '' : 'none';

  modal.style.display = 'flex';
  videoDraftsSyncFirebase().then(()=>{
    const v=videoDraftForJob(jobId);
    if(v) vdRenderProfile(v);
    else if(reviewLinks.length) vdLoadReviewLink(reviewLinks[0]);
  });
}

// Render the video tab bar (one tab per review link)
function vdRenderReviewTabs(reviewLinks){
  const container = document.getElementById('vd-review-tabs');
  if(!container) return;
  if(!reviewLinks || !reviewLinks.length){
    container.style.display = 'none';
    return;
  }
  container.style.display = 'flex';
  container.innerHTML = reviewLinks.map((rl, i) => {
    const active = rl.id === _vdActiveReviewLinkId;
    const isReel = rl.type === 'reel';
    const label  = rl.title || (isReel ? `Reel ${i+1}` : `Video ${i+1}`);
    const icon   = isReel
      ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="6" x2="12" y2="6.01"/><line x1="12" y1="18" x2="12" y2="18.01"/></svg>'
      : '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>';
    return `<button
      onclick="vdSelectReviewLink('${rl.id}')"
      data-rl-id="${rl.id}"
      data-rl-url="${(rl.url||'').replace(/"/g,'&quot;')}"
      data-rl-type="${rl.type||'horizontal'}"
      style="display:inline-flex;align-items:center;gap:5px;padding:6px 14px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid ${active?'#A78BFA':'var(--border)'};background:${active?'rgba(139,92,246,.15)':'var(--navy-lift)'};color:${active?'#A78BFA':'var(--muted)'}">
      ${icon} ${label}
    </button>`;
  }).join('');
}

function vdSelectReviewLink(rlId){
  const container = document.getElementById('vd-review-tabs');
  if(!container) return;
  _vdActiveReviewLinkId = rlId;
  // Update tab styles
  container.querySelectorAll('button').forEach(btn=>{
    const active = btn.dataset.rlId === rlId;
    btn.style.borderColor  = active ? '#A78BFA' : 'var(--border)';
    btn.style.background   = active ? 'rgba(139,92,246,.15)' : 'var(--navy-lift)';
    btn.style.color        = active ? '#A78BFA' : 'var(--muted)';
    if(active){
      vdLoadReviewLink({ id: btn.dataset.rlId, url: btn.dataset.rlUrl, type: btn.dataset.rlType });
    }
  });
}

function vdLoadReviewLink(rl){
  if(!rl || !rl.url) return;
  // Adjust aspect ratio based on orientation
  const area = document.getElementById('vd-video-area');
  if(area) area.style.aspectRatio = rl.type==='reel' ? '9/16' : '16/9';
  vdLoadVideo(rl.url);
  // Also re-render comments filtered by this link
  const vd = videoDraftForJob(_vdActiveJobId);
  if(vd) vdRenderComments((vd.comments||[]).filter(c=>c.draftId===_vdActiveDraftId&&(c.reviewLinkId===rl.id||!c.reviewLinkId)));
}

function closeVdProfile(){
  document.getElementById('vd-profile-modal').style.display = 'none';
  _vdActiveJobId        = null;
  _vdActiveDraftId      = null;
  _vdCommentTs          = null;
  _vdActiveReviewLinkId = null;
  const tabs = document.getElementById('vd-review-tabs');
  if(tabs){ tabs.innerHTML=''; tabs.style.display='none'; }
  _vdStopProgressTimer();
  // Stop / destroy players
  const vid = document.getElementById('vd-video-el');
  if(vid){ vid.pause(); vid.src=''; }
  const iframe = document.getElementById('vd-iframe');
  if(iframe) iframe.src='';
  if(_vdYtPlayer){ try{ _vdYtPlayer.destroy(); }catch(e){} _vdYtPlayer=null; }
  if(_vdVimeoPlayer){ try{ _vdVimeoPlayer.destroy(); }catch(e){} _vdVimeoPlayer=null; }
  const ytCont = document.getElementById('vd-yt-container');
  if(ytCont) ytCont.innerHTML='';
  _vdCurrentUrl='';
}

function vdRenderNoDraft(){
  document.getElementById('vd-profile-status-badge').textContent  = 'No Draft Yet';
  document.getElementById('vd-profile-status-badge').style.cssText = 'font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid var(--border);color:var(--muted);background:transparent';
  document.getElementById('vd-draft-selector').innerHTML  = '';
  document.getElementById('vd-draft-history').innerHTML   = '<div style="font-size:12px;color:var(--muted)">No drafts yet.</div>';
  document.getElementById('vd-comments-list').innerHTML   = '';
  document.getElementById('vd-edit-requests').innerHTML   = '<div style="font-size:12px;color:var(--muted)">None</div>';
  document.getElementById('vd-no-video').style.display    = 'flex';
  document.getElementById('vd-iframe').style.display      = 'none';
  document.getElementById('vd-video-el').style.display    = 'none';
  document.getElementById('vd-comment-bar').style.display = 'none';
}

function vdRenderProfile(vd){
  if(!vd) return;
  const STATUS_MAP = {
    awaiting_upload:   {label:'Awaiting Upload',   color:'var(--muted)',       bg:'transparent'},
    awaiting_review:   {label:'Awaiting Review',   color:'#F5C842',            bg:'rgba(245,200,66,.1)'},
    in_review:         {label:'In Review',          color:'var(--blue-bright)', bg:'rgba(91,141,239,.1)'},
    changes_requested: {label:'Changes Requested',  color:'var(--amber)',       bg:'rgba(245,200,66,.1)'},
    approved:          {label:'Approved ✓',         color:'var(--green)',       bg:'rgba(34,217,122,.1)'},
  };
  const st = STATUS_MAP[vd.status] || STATUS_MAP.awaiting_upload;

  // Status badge
  const badge = document.getElementById('vd-profile-status-badge');
  badge.textContent = st.label;
  badge.style.cssText = `font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;border:1px solid ${st.color};color:${st.color};background:${st.bg}`;

  // Draft selector pills
  const ds = document.getElementById('vd-draft-selector');
  ds.innerHTML = vd.drafts.map(d=>{
    const active = d.id === _vdActiveDraftId;
    const dSt = STATUS_MAP[d.status]||STATUS_MAP.awaiting_upload;
    return `<button onclick="vdSelectDraft('${vd.jobId}','${d.id}')" style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid ${active?dSt.color:'var(--border)'};background:${active?dSt.bg:'var(--navy-lift)'};color:${active?dSt.color:'var(--muted)'}">
      Draft ${d.draftNumber}${active?' ←':''}
    </button>`;
  }).join('');

  // Find active draft object
  const activeDraft = vd.drafts.find(d=>d.id===_vdActiveDraftId) || vd.drafts[vd.drafts.length-1];
  if(activeDraft?.videoUrl){
    // Only (re)load the player if the URL has actually changed — avoids
    // resetting the video to 0:00 when re-rendering after a comment is posted.
    if(activeDraft.videoUrl !== _vdCurrentUrl){
      vdLoadVideo(activeDraft.videoUrl);
    }
  } else if(!_vdCurrentUrl) {
    document.getElementById('vd-no-video').style.display = 'flex';
    document.getElementById('vd-iframe').style.display   = 'none';
    document.getElementById('vd-video-el').style.display = 'none';
  }

  // Comments for this draft
  const draftComments = (vd.comments||[]).filter(c=>c.draftId===_vdActiveDraftId);
  vdRenderComments(draftComments);

  // Draft history sidebar
  const dh = document.getElementById('vd-draft-history');
  dh.innerHTML = vd.drafts.slice().reverse().map(d=>{
    const dSt = STATUS_MAP[d.status]||STATUS_MAP.awaiting_upload;
    const commCount = (vd.comments||[]).filter(c=>c.draftId===d.id).length;
    return `<div style="padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--navy-mid)">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
        <span style="font-size:12px;font-weight:700;color:var(--white)">Draft ${d.draftNumber}</span>
        <span style="font-size:10px;font-weight:700;color:${dSt.color};background:${dSt.bg};border:1px solid ${dSt.color};border-radius:10px;padding:1px 8px">${dSt.label}</span>
      </div>
      <div style="font-size:10px;color:var(--muted)">${commCount} comment${commCount!==1?'s':''} · ${d.uploadedAt?new Date(d.uploadedAt).toLocaleDateString():''}</div>
    </div>`;
  }).join('') || '<div style="font-size:12px;color:var(--muted)">No drafts yet.</div>';

  // Editor checklist — client comments (all, not just unresolved, so editor can see full history)
  const clientEdits = (vd.comments||[]).filter(c=>c.from==='client'&&!c.isSystem);
  const er = document.getElementById('vd-edit-requests');
  if(!clientEdits.length){
    er.innerHTML='<div style="font-size:12px;color:var(--muted)">No client edit requests yet.</div>';
  } else {
    const doneCount = clientEdits.filter(c=>c.checkedOff||c.rebuttal).length;
    er.innerHTML = `
      <div style="font-size:10px;color:var(--muted);margin-bottom:8px;display:flex;align-items:center;justify-content:space-between">
        <span>Edit requests</span>
        <span style="font-weight:700;color:${doneCount===clientEdits.length?'var(--green)':'var(--amber)'}">${doneCount}/${clientEdits.length} addressed</span>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
      ${clientEdits.map(c=>{
        const isDone = !!c.checkedOff;
        const hasRebuttal = !!c.rebuttal;
        const isAddressed = isDone || hasRebuttal;
        const draftNum = (vd.drafts.find(d=>d.id===c.draftId)||{}).draftNumber||'?';
        const borderCol = isDone ? 'rgba(34,217,122,.35)' : hasRebuttal ? 'rgba(91,141,239,.35)' : 'rgba(245,200,66,.3)';
        const bgCol     = isDone ? 'rgba(34,217,122,.06)' : hasRebuttal ? 'rgba(91,141,239,.06)' : 'rgba(245,200,66,.04)';
        const tsLabel   = c.videoTimestamp!=null ? `<span onclick="vdSeekTo(${c.videoTimestamp})" style="font-size:10px;font-weight:700;background:rgba(91,141,239,.15);border:1px solid rgba(91,141,239,.35);color:var(--blue-bright);border-radius:8px;padding:1px 7px;cursor:pointer;flex-shrink:0">▶ ${vdFmtTime(c.videoTimestamp)}</span>` : '';
        const draftLabel = `<span style="font-size:10px;color:var(--muted)">D${draftNum}</span>`;
        return `<div style="border-radius:10px;border:1px solid ${borderCol};background:${bgCol};overflow:hidden">
          <!-- Main row: checkbox + text -->
          <div style="display:flex;align-items:flex-start;gap:9px;padding:9px 10px">
            <div onclick="vdCheckOffEdit('${vd.jobId}','${c.id}')" title="${isDone?'Mark as not done':'Mark as done'}"
              style="width:17px;height:17px;border-radius:4px;border:2px solid ${isDone?'var(--green)':'rgba(245,200,66,.6)'};background:${isDone?'var(--green)':'transparent'};cursor:pointer;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;transition:all .15s">
              ${isDone?'<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>':''}
            </div>
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-bottom:4px">${tsLabel}${draftLabel}</div>
              <div style="font-size:12px;color:${isDone?'var(--muted)':'var(--offwhite)'};line-height:1.45;${isDone?'text-decoration:line-through;':''}">${escSalesHtml(c.text)}</div>
            </div>
          </div>
          <!-- Existing rebuttal display -->
          ${hasRebuttal?`<div style="padding:7px 10px;border-top:1px solid rgba(91,141,239,.2);background:rgba(91,141,239,.06)">
            <div style="font-size:10px;font-weight:700;color:var(--blue-bright);margin-bottom:2px">↩ Editor response</div>
            <div style="font-size:11px;color:var(--offwhite);line-height:1.4">${escSalesHtml(c.rebuttal)}</div>
          </div>`:''}
          <!-- Action buttons (only shown when not yet fully addressed) -->
          ${!isAddressed?`<div style="padding:0 10px 8px;display:flex;gap:5px">
            <button onclick="vdCheckOffEdit('${vd.jobId}','${c.id}')" style="flex:1;padding:4px 8px;border-radius:7px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.08);color:var(--green);font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Done</button>
            <button onclick="vdToggleRebuttalInput('${c.id}')" style="flex:1;padding:4px 8px;border-radius:7px;border:1px solid rgba(91,141,239,.4);background:rgba(91,141,239,.08);color:var(--blue-bright);font-size:10px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:4px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Reply</button>
          </div>
          <div id="vd-rebuttal-input-${c.id}" style="display:none;padding:0 10px 10px">
            <textarea id="vd-rebuttal-text-${c.id}" placeholder="Explain why this can't be done, or add a note…" rows="2" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:7px;font-size:11px;background:var(--navy-lift);color:var(--white);resize:none;line-height:1.5;font-family:var(--font)"></textarea>
            <div style="display:flex;gap:5px;margin-top:5px">
              <button onclick="vdSaveRebuttal('${vd.jobId}','${c.id}')" style="flex:1;padding:4px 10px;border-radius:7px;border:1px solid rgba(91,141,239,.5);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:10px;font-weight:700;cursor:pointer">Send Reply</button>
              <button onclick="vdToggleRebuttalInput('${c.id}')" style="padding:4px 8px;border-radius:7px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:10px;cursor:pointer">Cancel</button>
            </div>
          </div>`:''}
        </div>`;
      }).join('')}
      </div>`;
  }
}

function vdSelectDraft(jobId, draftId){
  _vdActiveDraftId = draftId;
  const vd = videoDraftForJob(jobId);
  if(vd) vdRenderProfile(vd);
}

// ── Video player globals ──────────────────────
let _vdYtPlayer      = null;   // YouTube IFrame Player instance
let _vdVimeoPlayer   = null;   // Vimeo Player instance
let _vdProgressTimer = null;   // setInterval for scrubber progress
let _vdCurrentUrl    = '';

function vdLoadVideo(url){
  if(!url) return;
  _vdCurrentUrl = url;
  _vdStopProgressTimer();
  _vdYtPlayer    = null;
  _vdVimeoPlayer = null;

  const iframe    = document.getElementById('vd-iframe');
  const videoEl   = document.getElementById('vd-video-el');
  const ytCont    = document.getElementById('vd-yt-container');
  const noVid     = document.getElementById('vd-no-video');
  const bar       = document.getElementById('vd-comment-bar');
  const scrubWrap = document.getElementById('vd-scrubber-wrap');

  // Hide everything first
  iframe.style.display  = 'none';
  videoEl.style.display = 'none';
  ytCont.style.display  = 'none';
  noVid.style.display   = 'none';
  bar.style.display     = 'none';
  if(scrubWrap) scrubWrap.style.display = 'none';
  // Clear old YT container
  ytCont.innerHTML = '';
  iframe.src = '';
  videoEl.src = '';

  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]+)/);
  const viMatch = url.match(/vimeo\.com\/(\d+)/);

  if(ytMatch){
    ytCont.style.display = 'block';
    noVid.style.display  = 'none';
    if(scrubWrap) scrubWrap.style.display = '';
    _vdLoadYouTube(ytMatch[1]);
  } else if(viMatch){
    iframe.src = `https://player.vimeo.com/video/${viMatch[1]}`;
    iframe.style.display = 'block';
    noVid.style.display  = 'none';
    if(scrubWrap) scrubWrap.style.display = '';
    _vdLoadVimeo(viMatch[1]);
  } else {
    // Direct video file — full auto-detect on pause
    videoEl.src = url;
    videoEl.style.display = 'block';
    noVid.style.display   = 'none';
    if(scrubWrap) scrubWrap.style.display = '';
    videoEl.onloadedmetadata = function(){
      const dur = document.getElementById('vd-scrubber-duration');
      if(dur) dur.textContent = vdFmtTime(videoEl.duration);
      vdUpdateScrubberPins();
    };
    videoEl.onpause = function(){
      if(videoEl.readyState < 2) return;
      _vdCommentTs = videoEl.currentTime;
      vdShowCommentBar(_vdCommentTs);
    };
    videoEl.onplay = function(){
      bar.style.display = 'none';
      _vdStartProgressTimer(()=>{
        if(!videoEl.duration) return;
        vdSetScrubberProgress(videoEl.currentTime, videoEl.duration);
      });
    };
    videoEl.onseeked = function(){
      vdSetScrubberProgress(videoEl.currentTime, videoEl.duration||1);
    };
  }
}

// ── YouTube IFrame Player API ─────────────────
function _vdLoadYouTube(videoId){
  const initPlayer = function(){
    const div = document.createElement('div');
    div.id = 'vd-yt-inner';
    document.getElementById('vd-yt-container').appendChild(div);
    _vdYtPlayer = new YT.Player('vd-yt-inner', {
      width:'100%', height:'100%', videoId,
      playerVars:{rel:0, modestbranding:1, color:'white'},
      events:{
        onReady: function(){
          const dur = _vdYtPlayer.getDuration();
          const durEl = document.getElementById('vd-scrubber-duration');
          if(durEl) durEl.textContent = vdFmtTime(dur);
          vdUpdateScrubberPins();
        },
        onStateChange: function(e){
          if(e.data === YT.PlayerState.PAUSED){
            const t = _vdYtPlayer.getCurrentTime();
            _vdCommentTs = t;
            vdShowCommentBar(t);
            _vdStopProgressTimer();
          } else if(e.data === YT.PlayerState.PLAYING){
            document.getElementById('vd-comment-bar').style.display = 'none';
            _vdStartProgressTimer(()=>{
              const t2 = _vdYtPlayer.getCurrentTime();
              const d2 = _vdYtPlayer.getDuration();
              vdSetScrubberProgress(t2, d2);
            });
          } else if(e.data === YT.PlayerState.ENDED){
            _vdStopProgressTimer();
          }
        }
      }
    });
  };
  if(window.YT && window.YT.Player){
    initPlayer();
  } else {
    // Load the API script once
    if(!document.getElementById('yt-iframe-api')){
      const s = document.createElement('script');
      s.id  = 'yt-iframe-api';
      s.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(s);
    }
    // Queue init — onYouTubeIframeAPIReady is called by the script
    window._vdYtPendingInit = initPlayer;
  }
}
// Global callback required by YouTube API
if(!window.onYouTubeIframeAPIReady){
  window.onYouTubeIframeAPIReady = function(){
    if(window._vdYtPendingInit){ window._vdYtPendingInit(); window._vdYtPendingInit = null; }
  };
}

// ── Vimeo Player SDK ──────────────────────────
function _vdLoadVimeo(videoId){
  const initVimeo = function(){
    const iframe = document.getElementById('vd-iframe');
    _vdVimeoPlayer = new Vimeo.Player(iframe);
    _vdVimeoPlayer.getDuration().then(dur=>{
      const durEl = document.getElementById('vd-scrubber-duration');
      if(durEl) durEl.textContent = vdFmtTime(dur);
      // Pins need duration — now we have it
      vdUpdateScrubberPins_withDuration(dur);
    });
    _vdVimeoPlayer.on('pause', function(data){
      _vdCommentTs = data.seconds;
      vdShowCommentBar(data.seconds);
      _vdStopProgressTimer();
    });
    _vdVimeoPlayer.on('play', function(){
      document.getElementById('vd-comment-bar').style.display = 'none';
      _vdVimeoPlayer.getDuration().then(dur=>{
        _vdStartProgressTimer(()=>{
          _vdVimeoPlayer.getCurrentTime().then(t=>vdSetScrubberProgress(t, dur));
        });
      });
    });
    _vdVimeoPlayer.on('ended', ()=>_vdStopProgressTimer());
    _vdVimeoPlayer.on('timeupdate', data=>{
      _vdVimeoPlayer.getDuration().then(dur=>vdSetScrubberProgress(data.seconds, dur));
    });
  };
  if(window.Vimeo){
    initVimeo();
  } else {
    if(!document.getElementById('vimeo-player-sdk')){
      const s = document.createElement('script');
      s.id  = 'vimeo-player-sdk';
      s.src = 'https://player.vimeo.com/api/player.js';
      s.onload = initVimeo;
      document.head.appendChild(s);
    }
  }
}

// ── Scrubber helpers ──────────────────────────
function vdShowCommentBar(t){
  const badge = document.getElementById('vd-comment-ts-badge');
  if(badge) badge.textContent = vdFmtTime(t);
  const bar = document.getElementById('vd-comment-bar');
  if(bar){ bar.style.display='flex'; bar.style.flexDirection='column'; }
  setTimeout(()=>document.getElementById('vd-comment-text')?.focus(), 60);
}

function vdSetScrubberProgress(current, duration){
  if(!duration) return;
  const pct = Math.min(100, (current/duration)*100);
  const fill = document.getElementById('vd-scrubber-fill');
  if(fill) fill.style.width = pct + '%';
  const cur = document.getElementById('vd-scrubber-current');
  if(cur) cur.textContent = vdFmtTime(current);
}

function _vdStartProgressTimer(fn){
  _vdStopProgressTimer();
  _vdProgressTimer = setInterval(fn, 250);
}
function _vdStopProgressTimer(){
  clearInterval(_vdProgressTimer);
  _vdProgressTimer = null;
}

function vdScrubberClick(e){
  const track = document.getElementById('vd-scrubber-track');
  if(!track) return;
  const rect = track.getBoundingClientRect();
  const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  let duration = 0;
  const videoEl = document.getElementById('vd-video-el');
  if(videoEl && videoEl.style.display!=='none' && videoEl.duration) duration = videoEl.duration;
  else if(_vdYtPlayer?.getDuration) duration = _vdYtPlayer.getDuration();
  if(!duration) return;
  const seekTo = pct * duration;
  vdSeekTo(seekTo);
}

function vdSeekTo(seconds){
  const videoEl = document.getElementById('vd-video-el');
  if(videoEl && videoEl.style.display!=='none'){
    videoEl.currentTime = seconds;
  } else if(_vdYtPlayer?.seekTo){
    _vdYtPlayer.seekTo(seconds, true);
    _vdYtPlayer.pauseVideo();
  } else if(_vdVimeoPlayer){
    _vdVimeoPlayer.setCurrentTime(seconds).then(()=>_vdVimeoPlayer.pause());
  }
}

function vdUpdateScrubberPins(){
  // Called after comments render or video loads — places pin dots on scrubber
  if(!_vdActiveJobId || !_vdActiveDraftId) return;
  const vd = videoDraftForJob(_vdActiveJobId);
  if(!vd) return;
  const comments = (vd.comments||[]).filter(c=>c.draftId===_vdActiveDraftId && c.videoTimestamp!=null && !c.isSystem);
  const pinsEl = document.getElementById('vd-scrubber-pins');
  if(!pinsEl) return;

  // Get duration
  let duration = 0;
  const videoEl = document.getElementById('vd-video-el');
  if(videoEl && videoEl.style.display!=='none' && videoEl.duration) duration = videoEl.duration;
  else if(_vdYtPlayer?.getDuration) duration = _vdYtPlayer.getDuration();
  // For Vimeo, duration is fetched async — pins update when loaded via getDuration().then
  if(!duration){ pinsEl.innerHTML=''; return; }

  pinsEl.innerHTML = comments.map(c=>{
    const pct = Math.min(99, (c.videoTimestamp/duration)*100);
    const col  = c.from==='client' ? '#F5C842' : '#7AABFF';
    const safe = escSalesHtml(c.text.slice(0,60)+(c.text.length>60?'…':''));
    return `<div
      onclick="event.stopPropagation();vdSeekTo(${c.videoTimestamp})"
      title="${vdFmtTime(c.videoTimestamp)}: ${safe}"
      style="position:absolute;left:${pct}%;top:50%;transform:translate(-50%,-50%);
        width:11px;height:11px;border-radius:50%;background:${col};
        border:2px solid rgba(255,255,255,.8);cursor:pointer;z-index:3;
        box-shadow:0 0 0 2px rgba(0,0,0,.4);transition:transform .12s"
      onmouseenter="this.style.transform='translate(-50%,-50%) scale(1.6)';vdShowScrubberTooltip(event,'${vdFmtTime(c.videoTimestamp)}',${pct})"
      onmouseleave="this.style.transform='translate(-50%,-50%) scale(1)';vdHideScrubberTooltip()"
    ></div>`;
  }).join('');
}

function vdUpdateScrubberPins_withDuration(duration){
  // Same as vdUpdateScrubberPins but with explicit duration (for async cases like Vimeo)
  if(!_vdActiveJobId || !_vdActiveDraftId || !duration) return;
  const vd = videoDraftForJob(_vdActiveJobId);
  if(!vd) return;
  const comments = (vd.comments||[]).filter(c=>c.draftId===_vdActiveDraftId && c.videoTimestamp!=null && !c.isSystem);
  const pinsEl = document.getElementById('vd-scrubber-pins');
  if(!pinsEl) return;
  pinsEl.innerHTML = comments.map(c=>{
    const pct = Math.min(99, (c.videoTimestamp/duration)*100);
    const col  = c.from==='client' ? '#F5C842' : '#7AABFF';
    const safe = escSalesHtml(c.text.slice(0,60)+(c.text.length>60?'…':''));
    return `<div
      onclick="event.stopPropagation();vdSeekTo(${c.videoTimestamp})"
      title="${vdFmtTime(c.videoTimestamp)}: ${safe}"
      style="position:absolute;left:${pct}%;top:50%;transform:translate(-50%,-50%);
        width:11px;height:11px;border-radius:50%;background:${col};
        border:2px solid rgba(255,255,255,.8);cursor:pointer;z-index:3;
        box-shadow:0 0 0 2px rgba(0,0,0,.4);transition:transform .12s"
      onmouseenter="this.style.transform='translate(-50%,-50%) scale(1.6)';vdShowScrubberTooltip(event,'${vdFmtTime(c.videoTimestamp)}',${pct})"
      onmouseleave="this.style.transform='translate(-50%,-50%) scale(1)';vdHideScrubberTooltip()"
    ></div>`;
  }).join('');
}

function vdShowScrubberTooltip(e, label, pct){
  const tt = document.getElementById('vd-scrubber-tooltip');
  if(!tt) return;
  tt.textContent = label;
  tt.style.left    = pct + '%';
  tt.style.display = 'block';
}
function vdHideScrubberTooltip(){
  const tt = document.getElementById('vd-scrubber-tooltip');
  if(tt) tt.style.display = 'none';
}

function vdFmtTime(sec){
  if(sec==null) return '';
  const s = Math.floor(sec);
  const m = Math.floor(s/60);
  const h = Math.floor(m/60);
  const ss = String(s%60).padStart(2,'0');
  const mm = String(m%60).padStart(2,'0');
  return h>0 ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
}

// Manual timestamp button for YouTube/Vimeo iframes
function vdCaptureManualTs(){
  const tsRaw = prompt('Enter timestamp (e.g. 1:23 or 83):');
  if(!tsRaw) return;
  const parts = tsRaw.trim().split(':').map(Number);
  let secs = 0;
  if(parts.length===1) secs = parts[0];
  else if(parts.length===2) secs = parts[0]*60+parts[1];
  else if(parts.length===3) secs = parts[0]*3600+parts[1]*60+parts[2];
  _vdCommentTs = isNaN(secs) ? null : secs;
  const badge = document.getElementById('vd-comment-ts-badge');
  if(badge) badge.textContent = vdFmtTime(_vdCommentTs);
  document.getElementById('vd-comment-bar').style.display = 'flex';
  document.getElementById('vd-comment-bar').style.flexDirection = 'column';
  setTimeout(()=>{ document.getElementById('vd-comment-text')?.focus(); }, 50);
}

function vdCloseCommentBar(){
  document.getElementById('vd-comment-bar').style.display = 'none';
  _vdCommentTs = null;
}

function vdSubmitComment(){
  const text = document.getElementById('vd-comment-text')?.value.trim();
  if(!text) return;
  _vdAddComment(text, _vdCommentTs);
  document.getElementById('vd-comment-text').value = '';
  vdCloseCommentBar();
}

function vdSubmitFreeComment(){
  const text = document.getElementById('vd-free-comment')?.value.trim();
  if(!text) return;
  _vdAddComment(text, null);
  document.getElementById('vd-free-comment').value = '';
}

function _vdAddComment(text, timestamp){
  if(!_vdActiveJobId) return;
  const all = videoDraftsLoad();
  let vd = all.find(d=>d.jobId===_vdActiveJobId);
  if(!vd){ vd = vdCreateShell(_vdActiveJobId); all.push(vd); }

  const comment = {
    id:             'vc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    draftId:        _vdActiveDraftId,
    videoTimestamp: timestamp!=null ? timestamp : null,
    text,
    from:           _vdViewerMode,
    by:             _vdViewerMode==='client' ? 'Client' : 'DroneHub',
    at:             new Date().toISOString(),
    resolved:       false,
  };
  if(!vd.comments) vd.comments = [];
  vd.comments.push(comment);

  // Update status if client commented
  if(_vdViewerMode==='client' && vd.status==='awaiting_review') vd.status='in_review';

  videoDraftsSave(all);
  vdRenderProfile(vd);

  // Notify team if client commented
  if(_vdViewerMode==='client'){
    const tsNote = timestamp!=null ? ` at ${vdFmtTime(timestamp)}` : '';
    addSocialNotification && addSocialNotification(
      _vdActiveJobId,
      `Client commented${tsNote}: "${text.slice(0,60)}${text.length>60?'…':''}"`,
      'video_comment'
    );
  }
}

function vdResolveComment(jobId, commentId){
  const all = videoDraftsLoad();
  const vd = all.find(d=>d.jobId===jobId);
  if(!vd) return;
  const c = vd.comments.find(x=>x.id===commentId);
  if(c){ c.resolved=true; c.resolvedAt=new Date().toISOString(); }
  videoDraftsSave(all);
  vdRenderProfile(vd);
}

function vdCheckOffEdit(jobId, commentId){
  const all = videoDraftsLoad();
  const vd = all.find(d=>d.jobId===jobId);
  if(!vd) return;
  const c = vd.comments.find(x=>x.id===commentId);
  if(!c) return;
  // Toggle checked state
  if(c.checkedOff){
    c.checkedOff = false;
    c.checkedOffAt = null;
    c.resolved = !!c.rebuttal; // stay resolved if there's a rebuttal
  } else {
    c.checkedOff = true;
    c.checkedOffAt = new Date().toISOString();
    c.resolved = true;
  }
  videoDraftsSave(all);
  vdRenderProfile(vd);
}

function vdToggleRebuttalInput(commentId){
  const el = document.getElementById('vd-rebuttal-input-'+commentId);
  if(!el) return;
  const isVisible = el.style.display !== 'none';
  el.style.display = isVisible ? 'none' : 'block';
  if(!isVisible){
    const ta = el.querySelector('textarea');
    if(ta) ta.focus();
  }
}

function vdSaveRebuttal(jobId, commentId){
  const el = document.getElementById('vd-rebuttal-input-'+commentId);
  const ta = el ? el.querySelector('textarea') : null;
  const text = ta ? ta.value.trim() : '';
  if(!text){ alert('Please type a reply first.'); return; }
  const all = videoDraftsLoad();
  const vd = all.find(d=>d.jobId===jobId);
  if(!vd) return;
  const c = vd.comments.find(x=>x.id===commentId);
  if(!c) return;
  c.rebuttal = text;
  c.rebuttalAt = new Date().toISOString();
  c.resolved = true;
  videoDraftsSave(all);
  vdRenderProfile(vd);
}

function vdRenderComments(comments){
  const el = document.getElementById('vd-comments-list');
  if(!el) return;
  // Update scrubber pins to match
  setTimeout(vdUpdateScrubberPins, 80);
  if(!comments.length){
    el.innerHTML = '<div style="font-size:12px;color:var(--muted);padding:8px 0">No comments on this draft yet.</div>';
    return;
  }
  // Sort by timestamp then by date
  const sorted = [...comments].sort((a,b)=>{
    if(a.videoTimestamp!=null && b.videoTimestamp!=null) return a.videoTimestamp-b.videoTimestamp;
    if(a.videoTimestamp!=null) return -1;
    if(b.videoTimestamp!=null) return 1;
    return new Date(a.at)-new Date(b.at);
  });
  el.innerHTML = sorted.map(c=>{
    const isClient = c.from==='client';
    const col = isClient ? 'var(--amber)' : 'var(--blue-bright)';
    const bg  = isClient ? 'rgba(245,200,66,.06)' : 'rgba(91,141,239,.06)';
    const bdr = isClient ? 'rgba(245,200,66,.25)' : 'rgba(91,141,239,.25)';
    const tsChip = c.videoTimestamp!=null
      ? `<span onclick="vdSeekTo(${c.videoTimestamp})" title="Jump to ${vdFmtTime(c.videoTimestamp)}" style="font-size:10px;font-weight:700;background:rgba(91,141,239,.15);border:1px solid rgba(91,141,239,.35);color:var(--blue-bright);border-radius:10px;padding:1px 8px;margin-right:6px;cursor:pointer;transition:background .12s" onmouseenter="this.style.background='rgba(91,141,239,.3)'" onmouseleave="this.style.background='rgba(91,141,239,.15)'">▶ ${vdFmtTime(c.videoTimestamp)}</span>`
      : '';
    const resolvedStyle = c.checkedOff ? 'opacity:.5;' : '';
    const checkedBadge = c.checkedOff
      ? `<span style="font-size:10px;font-weight:700;color:var(--green);background:rgba(34,217,122,.12);border:1px solid rgba(34,217,122,.35);border-radius:10px;padding:1px 8px;margin-left:4px">✓ Done</span>`
      : '';
    const rebuttalBlock = c.rebuttal
      ? `<div style="margin-top:6px;padding:6px 8px;border-radius:7px;background:rgba(91,141,239,.08);border:1px solid rgba(91,141,239,.2)">
           <span style="font-size:10px;font-weight:700;color:var(--blue-bright)">Reply</span>
           <span style="font-size:10px;color:var(--muted);margin-left:4px">${c.rebuttalAt ? new Date(c.rebuttalAt).toLocaleDateString() : ''}</span>
           <div style="font-size:11px;color:var(--offwhite);margin-top:3px;line-height:1.4">${escSalesHtml(c.rebuttal)}</div>
         </div>`
      : '';
    return `<div style="${resolvedStyle}padding:10px 12px;border-radius:10px;border:1px solid ${bdr};background:${bg}">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px">
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          ${tsChip}
          <span style="font-size:11px;font-weight:700;color:${col}">${c.by}</span>
          <span style="font-size:10px;color:var(--muted)">${new Date(c.at).toLocaleDateString()}</span>
          ${checkedBadge}
        </div>
        ${!c.checkedOff && c.resolved ? '<span style="font-size:10px;color:var(--green)">✓ Resolved</span>' : ''}
      </div>
      <div style="font-size:12px;color:var(--offwhite);line-height:1.5;${c.checkedOff?'text-decoration:line-through;opacity:.6':''}">${escSalesHtml(c.text)}</div>
      ${rebuttalBlock}
    </div>`;
  }).join('');
}

function vdUploadDraft(){
  const url   = document.getElementById('vd-upload-url')?.value.trim();
  const notes = document.getElementById('vd-upload-notes')?.value.trim();
  if(!url){ alert('Please paste a video URL first.'); return; }
  if(!_vdActiveJobId){ alert('No job selected.'); return; }

  const all = videoDraftsLoad();
  let vd = all.find(d=>d.jobId===_vdActiveJobId);
  if(!vd){ vd = vdCreateShell(_vdActiveJobId); all.push(vd); }

  const newDraftNum = (vd.drafts.length||0) + 1;
  const draftId = 'vdr_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  vd.drafts.push({
    id:          draftId,
    draftNumber: newDraftNum,
    videoUrl:    url,
    notesForClient: notes||'',
    status:      'awaiting_review',
    uploadedAt:  new Date().toISOString(),
    uploadedBy:  'team',
  });
  vd.status      = 'awaiting_review';
  _vdActiveDraftId = draftId;

  // Add a system comment
  if(!vd.comments) vd.comments = [];
  vd.comments.push({
    id:             'vc_'+Date.now()+'_sys',
    draftId,
    videoTimestamp: null,
    text:           `Draft ${newDraftNum} uploaded by DroneHub.${notes?' Notes: '+notes:''}`,
    from:           'team',
    by:             'DroneHub',
    at:             new Date().toISOString(),
    resolved:       true,
    isSystem:       true,
  });

  videoDraftsSave(all);
  document.getElementById('vd-upload-url').value   = '';
  document.getElementById('vd-upload-notes').value = '';
  vdRenderProfile(vd);

  addSocialNotification && addSocialNotification(
    _vdActiveJobId,
    `Draft ${newDraftNum} uploaded — awaiting client review`,
    'video_upload'
  );
  alert(`Draft ${newDraftNum} sent to client for review.`);
}

function vdClientDecision(decision){
  if(!_vdActiveJobId || !_vdActiveDraftId) return;
  const all = videoDraftsLoad();
  const vd  = all.find(d=>d.jobId===_vdActiveJobId);
  if(!vd) return;
  const draft = vd.drafts.find(d=>d.id===_vdActiveDraftId);
  if(!draft) return;

  draft.status         = decision;
  draft.clientDecision = decision;
  draft.clientDecisionAt = new Date().toISOString();
  vd.status = decision;

  // Add system comment
  if(!vd.comments) vd.comments = [];
  const decisionLabel = decision==='approved' ? '✅ Approved by client' : '↩ Changes requested by client';
  vd.comments.push({
    id:             'vc_'+Date.now()+'_dec',
    draftId:        _vdActiveDraftId,
    videoTimestamp: null,
    text:           decisionLabel,
    from:           'client',
    by:             'Client',
    at:             new Date().toISOString(),
    resolved:       true,
    isSystem:       true,
  });

  videoDraftsSave(all);

  // ── Advance tracker edit status when client requests changes ──────────────
  if(decision === 'changes_requested'){
    const ts = getTrackerStage(_vdActiveJobId);
    const curr = ts.editStatus || '';
    // Map current status → next "Ready to Start" state for the following draft
    const NEXT_DRAFT_STATUS = {
      'ready':          'draft2_ready',
      'draft1_progress':'draft2_ready',
      'draft1':         'draft2_ready',
      'draft2_progress':'draft3_ready',
      'draft2':         'draft3_ready',
      'draft3_progress':'draft_plus_ready',
      'draft3':         'draft_plus_ready',
      'draft_plus':     'draft_plus_ready',
    };
    const DRAFT_NUMBER = {draft2_ready:2, draft3_ready:3, draft_plus_ready:4};
    const nextStatus = NEXT_DRAFT_STATUS[curr] || 'draft2_ready';
    const nextDraftNum = DRAFT_NUMBER[nextStatus] || 2;
    // Auto-increment draftCount to at least the next draft number
    const newDraftCount = Math.max(parseInt(ts.draftCount)||0, nextDraftNum);
    setTrackerStage(_vdActiveJobId, {
      editStatus:       nextStatus,
      draftCount:       newDraftCount,
      clientDecisionAt: new Date().toISOString(), // used for In Progress priority sort
    });
    const nextLabel = {draft2_ready:'Draft 2', draft3_ready:'Draft 3', draft_plus_ready:'Draft +'}[nextStatus] || 'next draft';
    addSocialNotification && addSocialNotification(
      _vdActiveJobId,
      `↩ Client requested changes — ${nextLabel} ready to start`,
      'video_changes'
    );
    vdRenderProfile(vd);
    alert(`↩ Changes requested. ${nextLabel} has been queued as "Ready to Start" in the project tracker — the editor will be notified.`);
  } else {
    // Approved: no status advancement — finals delivery handled separately
    addSocialNotification && addSocialNotification(
      _vdActiveJobId,
      'Approved by client — ready for final delivery',
      'video_approved'
    );
    vdRenderProfile(vd);
    alert('Video approved! The production team has been notified.');
  }
}

function vdCreateShell(jobId){
  return {
    id:       'vd_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    jobId,
    status:   'awaiting_upload',
    drafts:   [],
    comments: [],
    createdAt: new Date().toISOString(),
  };
}

// ── END VIDEO DRAFT REVIEW SYSTEM ─────────────

function refreshNotificationBadge(){
  const notifCount=notificationsLoad().filter(n=>!n.read).length;
  const requestedCount=(typeof savedJobs!=='undefined'?savedJobs:[]).filter(j=>j.status==='requested').length;
  const pendingTimeoff=(typeof _isSessionAdmin==='function'&&_isSessionAdmin()&&typeof timeoffRequestsLoad==='function') ? timeoffRequestsLoad().filter(r=>r.status==='pending').length : 0;
  const count=notifCount+requestedCount+pendingTimeoff;
  const badge=document.getElementById('notif-badge');
  const btn=document.getElementById('notif-bell-btn');
  if(badge){ badge.textContent=count>9?'9+':String(count); badge.style.display=count>0?'flex':'none'; }
  if(btn) btn.style.color = count>0?'var(--blue-bright)':'var(--muted)';
  const mobPfBadge=document.getElementById('mob-pf-notif-badge');
  if(mobPfBadge){ mobPfBadge.textContent=count>9?'9+':String(count); mobPfBadge.style.display=count>0?'flex':'none'; }
  let mobNavBadge=document.getElementById('mob-nav-notif-badge');
  const mobNavProfile=document.getElementById('mobnav-profile');
  if(mobNavProfile&&!mobNavBadge){
    mobNavBadge=document.createElement('span');
    mobNavBadge.id='mob-nav-notif-badge';
    mobNavBadge.style.cssText='display:none;position:absolute;top:2px;right:4px;min-width:14px;height:14px;border-radius:7px;background:var(--red);color:#fff;font-size:8px;font-weight:700;align-items:center;justify-content:center;padding:0 2px;border:2px solid var(--navy-card)';
    mobNavProfile.style.position='relative';
    mobNavProfile.appendChild(mobNavBadge);
  }
  if(mobNavBadge){ mobNavBadge.textContent=count>9?'9+':String(count); mobNavBadge.style.display=count>0?'flex':'none'; }
}
function toggleNotificationPanel(){
  const panel=document.getElementById('notif-panel');
  if(!panel) return;
  const isOpen=panel.style.display!=='none';
  panel.style.display=isOpen?'none':'block';
  if(!isOpen) renderNotificationPanel();
}
function renderNotificationPanel(){
  const panel=document.getElementById('notif-panel');
  if(!panel) return;
  const notifs=notificationsLoad();
  notifs.forEach(n=>n.read=true);
  notificationsSave(notifs);
  refreshNotificationBadge();
  const fmtDt=iso=>{
    if(!iso) return '';
    const d=new Date(iso),now=new Date(),diff=now-d;
    if(diff<60000) return 'Just now';
    if(diff<3600000) return Math.floor(diff/60000)+'m ago';
    if(diff<86400000) return Math.floor(diff/3600000)+'h ago';
    if(diff<604800000) return Math.floor(diff/86400000)+'d ago';
    return d.toLocaleDateString('en-CA',{month:'short',day:'numeric'});
  };
  const typeConfig={
    approval:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22D97A" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',bg:'rgba(34,217,122,.08)',accent:'rgba(34,217,122,.25)',label:'Approved'},
    revision:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FB923C" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',bg:'rgba(251,146,60,.08)',accent:'rgba(251,146,60,.25)',label:'Revision'},
    message:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--blue-bright)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>',bg:'rgba(91,141,239,.08)',accent:'rgba(91,141,239,.25)',label:'Message'},
    date_change:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',bg:'rgba(167,139,250,.08)',accent:'rgba(167,139,250,.25)',label:'Date changed'},
    tax_update:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#F5C842" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>',bg:'rgba(245,200,66,.08)',accent:'rgba(245,200,66,.25)',label:'Tax update'},
    timeoff_request:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2a1 1 0 0 0-.9.3L2 7.4 9 12l-2 3H4l-1 2 3 1 1 3 2-1v-3l3-2 4.9 7 2.1-1.9a1 1 0 0 0 .3-.9z"/></svg>',bg:'rgba(167,139,250,.08)',accent:'rgba(167,139,250,.25)',label:'Time Off Request'},
    rsvp_accept:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22D97A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><path d="m9 15 2 2 4-4"/></svg>',bg:'rgba(34,217,122,.08)',accent:'rgba(34,217,122,.25)',label:'Invite Accepted'},
    rsvp_decline:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#E85D5D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="10" y1="14" x2="14" y2="18"/><line x1="14" y1="14" x2="10" y2="18"/></svg>',bg:'rgba(232,93,93,.08)',accent:'rgba(232,93,93,.25)',label:'Invite Declined'},
    booking:{icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>',bg:'rgba(245,166,35,.08)',accent:'rgba(245,166,35,.25)',label:'New booking'}
  };
  const defaultType={icon:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>',bg:'rgba(255,255,255,.04)',accent:'var(--border)',label:'Update'};
  const requestedJobs=(typeof savedJobs!=='undefined'?savedJobs:[]).filter(j=>j.status==='requested');
  const bookingRows=requestedJobs.map(j=>{
    const clientRec=(typeof clients!=='undefined'?clients:[]).find(c=>c.id===j.clientId);
    const clientName=clientRec?.name||j.clientName||'Client portal';
    return `<div onclick="document.getElementById('notif-panel').style.display='none';showPane('sales');setTimeout(()=>{setSalesView('jobs');},200)" style="padding:12px 16px;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='rgba(245,166,35,.1)'" onmouseleave="this.style.background='transparent'">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:32px;height:32px;border-radius:10px;background:rgba(245,166,35,.12);border:1px solid rgba(245,166,35,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.04em">New booking</span>
            <span style="font-size:10px;color:var(--muted)">${fmtDt(j.createdAt||j.date)}</span>
          </div>
          <div style="font-size:13px;color:var(--white);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${j.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${clientName} · ${j.date||'No date'}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  const notifRows=notifs.map(n=>{
    const cfg=typeConfig[n.type]||defaultType;
    const navAction=n.type==='tax_update'?"showPane('finance')":n.type==='booking'?"showPane('sales');setTimeout(()=>{setSalesView('jobs');},200)":(n.type==='rsvp_accept'||n.type==='rsvp_decline')?"showPane('calendar')":n.type==='timeoff_request'||n.type==='approval'&&n.text?.includes('time off')?"if(window.innerWidth<=768&&typeof mobShowProfile==='function'){mobShowProfile();setTimeout(()=>mobPfSwitchTab('timeoff'),150);}else{dskShowMyProfile();setTimeout(()=>dskPfSwitchTab('timeoff'),150);}":"showPane('social');setTimeout(()=>{setSocialSubTab('approvals');},200)";
    return `<div onclick="document.getElementById('notif-panel').style.display='none';${navAction}" style="padding:12px 16px;cursor:pointer;transition:background .15s" onmouseenter="this.style.background='var(--navy-lift)'" onmouseleave="this.style.background='transparent'">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="width:32px;height:32px;border-radius:10px;background:${cfg.bg};border:1px solid ${cfg.accent};display:flex;align-items:center;justify-content:center;flex-shrink:0">${cfg.icon}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px">
            <span style="font-size:11px;font-weight:700;color:var(--offwhite);text-transform:uppercase;letter-spacing:.04em">${cfg.label}</span>
            <span style="font-size:10px;color:var(--muted)">${fmtDt(n.at)}</span>
          </div>
          <div style="font-size:13px;color:var(--white);line-height:1.45">${n.text}</div>
        </div>
      </div>
    </div>`;
  }).join('');
  const totalCount=requestedJobs.length+notifs.length;
  panel.innerHTML=`
    <div style="padding:14px 18px 12px;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid var(--border)">
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--white)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <span style="font-size:14px;font-weight:800;color:var(--white)">Notifications</span>
        ${totalCount?`<span style="min-width:18px;height:18px;border-radius:9px;background:var(--blue);color:#fff;font-size:10px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;padding:0 5px">${totalCount}</span>`:''}
      </div>
      <button onclick="notificationsClear()" style="font-size:11px;color:var(--muted);background:rgba(255,255,255,.04);border:1px solid var(--border);border-radius:6px;padding:3px 10px;cursor:pointer;transition:all .15s" onmouseenter="this.style.background='rgba(240,82,82,.1)';this.style.color='var(--red)';this.style.borderColor='rgba(240,82,82,.3)'" onmouseleave="this.style.background='rgba(255,255,255,.04)';this.style.color='var(--muted)';this.style.borderColor='var(--border)'">Clear all</button>
    </div>
    <div style="overflow-y:auto;max-height:380px;scrollbar-width:thin;scrollbar-color:rgba(255,255,255,.1) transparent">
      ${bookingRows}
      ${bookingRows&&notifRows?'<div style="height:1px;background:var(--border);margin:0 16px"></div>':''}
      ${notifRows}
      ${!totalCount?`<div style="padding:48px 20px;text-align:center">
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:.4;margin-bottom:12px"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        <div style="font-size:13px;color:var(--muted);font-weight:600">All caught up</div>
        <div style="font-size:11px;color:var(--muted);opacity:.6;margin-top:4px">No new notifications</div>
      </div>`:''}
    </div>`;
}
function notificationsClear(){
  notificationsSave([]);
  renderNotificationPanel();
}
function _checkPayrollTaxUpdates(){
  var now=new Date(),yr=now.getFullYear(),mo=now.getMonth();
  var nextYr=yr+1;
  var checks=[
    {month:10,key:'nov',msgs:[
      '🇨🇦 CRA has announced '+nextYr+' CPP/CPP2 maximum pensionable earnings (YMPE/YAMPE) and contribution rates. Update cppYMPE, cpp2YAMPE, cppRate, cpp2Rate in _fedCfg'+nextYr+'.',
      '🇨🇦 CRA has announced '+nextYr+' EI maximum insurable earnings (MIE) and premium rate. Update eiMIE, eiRate in _fedCfg'+nextYr+'.',
      '🇨🇦 CRA has announced '+nextYr+' Basic Personal Amount (BPA) and Canada Employment Amount (CEA). Update bpa, cea in _fedCfg'+nextYr+'.',
      '🇨🇦 Check '+nextYr+' T4 reporting caps: CPP pensionable max, EI insurable max, pension adjustment limits.',
      '🇺🇸 IRS has announced '+nextYr+' inflation adjustments (Rev. Proc.). Check new bracket thresholds, standard deductions, and FICA wage base for Social Security.'
    ]},
    {month:0,key:'jan',msgs:[
      '🇨🇦 CRA has published the '+yr+' T4127 (January edition). Update _fedCfg'+yr+' and _provCfg'+yr+' with final brackets, KP constants, and all provincial BPAs.',
      '🇨🇦 Verify '+yr+' provincial health premiums (ON), surtax thresholds (ON), and tax reductions (BC) are current.',
      '🇺🇸 IRS has published '+yr+' Pub 15-T withholding tables. Update _usFedCfg'+yr+' brackets, standard deductions (S/MFJ/HoH), and FICA wage bases.',
      '🇺🇸 Check all 50 state tax agencies for '+yr+' bracket and rate changes.'
    ]},
    {month:6,key:'jul',msgs:[
      '🇨🇦 CRA mid-year T4127 update (July edition) may be available. Check for provincial rate changes (e.g. BC budget adjustments).',
      '🇺🇸 Check for mid-year state tax rate changes that took effect July 1.'
    ]}
  ];
  var fired=false;
  checks.forEach(function(c){
    if(mo!==c.month)return;
    var lsKey='dh_tax_notif_'+yr+'_'+c.key;
    if(localStorage.getItem(lsKey))return;
    localStorage.setItem(lsKey,'1');
    c.msgs.forEach(function(m){
      var notifs=notificationsLoad();
      notifs.unshift({id:'tax_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),text:m,type:'tax_update',at:new Date().toISOString(),read:false});
      if(notifs.length>50)notifs.splice(50);
      notificationsSave(notifs);
    });
    fired=true;
  });
  if(fired){
    refreshNotificationBadge();
    showDhToast('Payroll Tax Update','New tax rates and caps are available — update your payroll calculator','💰','#F5C842');
  }
}
setTimeout(_checkPayrollTaxUpdates,3000);

// ── Chat log renderer ─────────────────────────────────────────────────────────────────────
function renderChatLog(chatLog, viewerRole, postId){
  const fmtDt=iso=>iso?new Date(iso).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  if(!chatLog||!chatLog.length) return `<div style="text-align:center;padding:28px 0;color:var(--muted);font-size:12px;font-style:italic">Chat starts once the post is sent for approval.</div>`;
  const entries = chatLog.map(e=>{
    const isMe = (viewerRole==='client' && e.from==='client') || (viewerRole==='team' && e.from==='team');
    if(e.type==='system'){
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <div style="font-size:10px;color:var(--muted);white-space:nowrap;padding:2px 8px;border-radius:10px;background:var(--navy-lift);border:1px solid var(--border)">${e.text}</div>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>`;
    }
    if(e.type==='approval'){
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <div style="flex:1;height:1px;background:rgba(34,217,122,.2)"></div>
        <div style="font-size:10px;color:#22D97A;white-space:nowrap;padding:2px 10px;border-radius:10px;background:rgba(34,217,122,.1);border:1px solid rgba(34,217,122,.25)">✓ ${e.from==='client'?'Client':'Team'} approved · ${fmtDt(e.at)}</div>
        <div style="flex:1;height:1px;background:rgba(34,217,122,.2)"></div>
      </div>`;
    }
    if(e.type==='revision'){
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <div style="flex:1;height:1px;background:rgba(251,146,60,.2)"></div>
        <div style="font-size:10px;color:#FB923C;white-space:nowrap;padding:2px 10px;border-radius:10px;background:rgba(251,146,60,.08);border:1px solid rgba(251,146,60,.25)">${e.from==='client'?'Client':'Team'} requested revision · ${fmtDt(e.at)}</div>
        <div style="flex:1;height:1px;background:rgba(251,146,60,.2)"></div>
      </div>
      ${e.text&&e.text!=='Revision requested'?`<div style="display:flex;justify-content:${isMe?'flex-end':'flex-start'};padding:2px 0 6px">
        <div style="max-width:88%;padding:8px 12px;border-radius:${isMe?'12px 12px 3px 12px':'12px 12px 12px 3px'};background:rgba(251,146,60,.1);border:1px solid rgba(251,146,60,.25)">
          <div style="font-size:10px;font-weight:700;color:#FB923C;margin-bottom:3px">${e.from==='client'?'Client':'DroneHub Media'}</div>
          <div style="font-size:12px;color:var(--white);line-height:1.5">${e.text}</div>
          <div style="font-size:9px;color:var(--muted);margin-top:3px;text-align:right">${fmtDt(e.at)}</div>
        </div>
      </div>`:''}`;
    }
    if(e.type==='date_change'){
      return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0">
        <div style="flex:1;height:1px;background:rgba(122,171,255,.2)"></div>
        <div style="font-size:10px;color:var(--blue-bright);white-space:nowrap;padding:2px 10px;border-radius:10px;background:rgba(122,171,255,.08);border:1px solid rgba(122,171,255,.25)">${e.text} · ${fmtDt(e.at)}</div>
        <div style="flex:1;height:1px;background:rgba(122,171,255,.2)"></div>
      </div>`;
    }
    return `<div style="display:flex;justify-content:${isMe?'flex-end':'flex-start'};padding:3px 0">
      <div style="max-width:88%">
        <div style="padding:8px 12px;border-radius:${isMe?'12px 12px 3px 12px':'12px 12px 12px 3px'};background:${isMe?'linear-gradient(135deg,var(--blue),var(--blue-dim))':'var(--navy-lift)'};border:${isMe?'none':'1px solid var(--border)'}">
          <div style="font-size:10px;font-weight:700;opacity:.75;margin-bottom:3px;color:${isMe?'rgba(255,255,255,.8)':'var(--muted)'}">${e.from==='client'?'Client':'DroneHub Media'}</div>
          <div style="font-size:12px;color:#fff;line-height:1.5">${e.text}</div>
        </div>
        <div style="font-size:9px;color:var(--muted);margin-top:2px;text-align:${isMe?'right':'left'}">${fmtDt(e.at)}</div>
      </div>
    </div>`;
  }).join('');
  return `<div style="display:flex;flex-direction:column;gap:2px;padding-bottom:8px">${entries}</div>`;
}

// ── Chat send functions ────────────────────────────────────────────────────────────────────
function cpSendChatMessage(postId){
  const input=document.getElementById('cp-chat-input');
  const text=input?.value.trim();
  if(!text) return;
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  chatLogAppend(posts,idx,{type:'message',from:'client',by:'Client',text});
  posts[idx].clientComments=posts[idx].clientComments||[];
  posts[idx].clientComments.push({from:'client',text,at:posts[idx].chatLog[posts[idx].chatLog.length-1].at});
  socialPostsSave(posts);
  if(input) input.value='';
  addSocialNotification(postId,'Client message on "'+(posts[idx].address||posts[idx].reelNumber||'Post')+'": '+text.substring(0,80),'message');
  cpSetSidebarTab('activity');
}

function teamSendChatMessage(postId){
  const input=document.getElementById('team-chat-input-'+postId);
  const text=input?.value.trim();
  if(!text) return;
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  chatLogAppend(posts,idx,{type:'message',from:'team',by:_activeSessionEmail||'DroneHub',text});
  posts[idx].clientComments=posts[idx].clientComments||[];
  posts[idx].clientComments.push({from:'team',text,at:posts[idx].chatLog[posts[idx].chatLog.length-1].at});
  socialPostsSave(posts);
  if(input) input.value='';
  const preview=document.getElementById('social-post-preview-modal');
  if(preview) openSocialPostPreview(postId);
  if(document.getElementById('social-sub-approvals')?.style.display!=='none') renderSocialApprovals();
}

// ── Date movement ─────────────────────────────────────────────────────────────────────────
function cpOpenMoveDate(postId){
  const post=socialPostsLoad().find(p=>p.id===postId);
  if(!post) return;
  const existing=document.getElementById('cp-move-date-modal');
  if(existing) existing.remove();
  const modal=document.createElement('div');
  modal.id='cp-move-date-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10100;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;padding:28px;width:340px;max-width:95vw;border:1px solid var(--border)" onclick="event.stopPropagation()">
    <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:4px">Move Post Date</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:20px">Current: ${post.scheduledAt||'Not set'}</div>
    <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:6px">New Date</label>
    <input type="date" id="cp-move-date-input" value="${post.scheduledAt||''}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--white);font-size:13px;box-sizing:border-box;margin-bottom:8px">
    <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:6px">Note (optional)</label>
    <input type="text" id="cp-move-date-note" placeholder="Reason for change…" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--white);font-size:13px;box-sizing:border-box;margin-bottom:20px">
    <div style="display:flex;gap:10px">
      <button onclick="document.getElementById('cp-move-date-modal').remove()" style="flex:1;padding:10px;border-radius:12px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:13px;cursor:pointer">Cancel</button>
      <button onclick="cpConfirmMoveDate('${postId}')" style="flex:2;padding:10px;border-radius:12px;border:none;background:var(--blue);color:#fff;font-size:13px;font-weight:700;cursor:pointer">Save New Date</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}
function cpConfirmMoveDate(postId){
  const newDate=document.getElementById('cp-move-date-input')?.value;
  const note=document.getElementById('cp-move-date-note')?.value.trim();
  if(!newDate){alert('Please select a date.');return;}
  document.getElementById('cp-move-date-modal')?.remove();
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  const oldDate=posts[idx].scheduledAt||'not set';
  posts[idx].scheduledAt=newDate;
  const text='Post date moved from '+oldDate+' to '+newDate+(note?' — '+note:'');
  chatLogAppend(posts,idx,{type:'date_change',from:'client',by:'Client',text});
  socialPostsSave(posts);
  addSocialNotification(postId,text,'date_change');
  cpOpenPost(postId);
}

function teamOpenMoveDate(postId){
  const post=socialPostsLoad().find(p=>p.id===postId);
  if(!post) return;
  const existing=document.getElementById('team-move-date-modal');
  if(existing) existing.remove();
  const modal=document.createElement('div');
  modal.id='team-move-date-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;padding:28px;width:340px;max-width:95vw;border:1px solid var(--border)" onclick="event.stopPropagation()">
    <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:4px">Move Post Date</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:20px">Current: ${post.scheduledAt||'Not set'}</div>
    <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:6px">New Date</label>
    <input type="date" id="team-move-date-input" value="${post.scheduledAt||''}" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--white);font-size:13px;box-sizing:border-box;margin-bottom:8px">
    <label style="font-size:12px;color:var(--muted);display:block;margin-bottom:6px">Note (optional)</label>
    <input type="text" id="team-move-date-note" placeholder="Reason for change…" style="width:100%;padding:10px 12px;border-radius:8px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--white);font-size:13px;box-sizing:border-box;margin-bottom:20px">
    <div style="display:flex;gap:10px">
      <button onclick="document.getElementById('team-move-date-modal').remove()" style="flex:1;padding:10px;border-radius:12px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:13px;cursor:pointer">Cancel</button>
      <button onclick="teamConfirmMoveDate('${postId}')" style="flex:2;padding:10px;border-radius:12px;border:none;background:var(--blue);color:#fff;font-size:13px;font-weight:700;cursor:pointer">Save New Date</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}
function teamConfirmMoveDate(postId){
  const newDate=document.getElementById('team-move-date-input')?.value;
  const note=document.getElementById('team-move-date-note')?.value.trim();
  if(!newDate){alert('Please select a date.');return;}
  document.getElementById('team-move-date-modal')?.remove();
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  const oldDate=posts[idx].scheduledAt||'not set';
  posts[idx].scheduledAt=newDate;
  const text='Post date moved from '+oldDate+' to '+newDate+(note?' — '+note:'');
  chatLogAppend(posts,idx,{type:'date_change',from:'team',by:_activeSessionEmail||'team',text});
  socialPostsSave(posts);
  renderSocialPostsArea();
  if(typeof renderSocialCalendar==='function') renderSocialCalendar();
}

// ── Entry point ────────────────────────────────────────────────────────────────────────────
function renderSocial(){
  socialSyncFirebase().then(()=>{ setSocialSubTab(_socialSubTab); refreshSocialApprovalBadge(); refreshNotificationBadge(); });
  setSocialSubTab(_socialSubTab);
  refreshSocialApprovalBadge();
  refreshNotificationBadge();
}

function refreshSocialApprovalBadge(){
  const count = socialPostsLoad().filter(p=>p.status==='pending'||p.status==='revision').length;
  const badge = document.getElementById('social-approval-badge');
  if(!badge) return;
  if(count>0){ badge.textContent=count; badge.style.display='inline'; }
  else { badge.style.display='none'; }
}

function setSocialSubTab(sub){
  _socialSubTab=sub;
  ['workspaces','calendar','approvals','music','analytics'].forEach(s=>{
    const el  = document.getElementById('social-sub-'+s);
    const btn = document.getElementById('social-stab-'+s);
    if(el)  el.style.display  = s===sub ? '' : 'none';
    if(btn){
      btn.style.borderBottom = s===sub ? '2px solid var(--blue-bright)' : '2px solid transparent';
      btn.style.color        = s===sub ? 'var(--blue-bright)' : 'var(--muted)';
    }
  });
  if(sub==='workspaces') renderSocialWorkspaces();
  else if(sub==='calendar') renderSocialCalendar();
  else if(sub==='approvals') renderSocialApprovals();
  else if(sub==='music') renderSocialMusicTracker();
  else if(sub==='analytics') renderSocialAnalytics();
}

// ── Workspaces ────────────────────────────────────────────────────────────────────────────
function renderSocialWorkspaces(){
  const workspaces=socialWorkspacesLoad();
  const posts=socialPostsLoad();
  const sidebar=document.getElementById('social-ws-sidebar');
  if(!sidebar) return;

  if(workspaces.length===0){
    sidebar.innerHTML=`<div style="padding:16px 10px;text-align:center;color:var(--muted);font-size:13px;line-height:1.7">No workspaces yet.<br><button onclick="openSocialWorkspaceModal()" style="margin-top:10px;padding:7px 18px;border-radius:16px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:12px;cursor:pointer">+ Create First</button></div>`;
    const c=document.getElementById('social-ws-content');
    if(c) c.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:260px;color:var(--muted);font-size:14px;gap:10px"><svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg><span>Create a workspace to start managing social content</span></div>`;
    return;
  }
  if(!_socialActiveWorkspace||!workspaces.find(w=>w.id===_socialActiveWorkspace))
    _socialActiveWorkspace=workspaces[0]?.id||null;

  sidebar.innerHTML=workspaces.map(ws=>{
    const wsp=posts.filter(p=>p.workspaceId===ws.id);
    const pending=wsp.filter(p=>p.status==='pending'||p.status==='revision').length;
    const on=_socialActiveWorkspace===ws.id;
    const chLabels=(ws.channels||[]).map(c=>SOCIAL_PLATFORMS.find(p=>p.id===c)?.label||c).join(', ');
    const linkedClient=ws.clientId?(clients||[]).find(c=>c.id===ws.clientId):null;
    return `<div onclick="selectSocialWorkspace('${ws.id}')" style="padding:11px 14px;border-radius:10px;cursor:pointer;border:1px solid ${on?'var(--blue)':'transparent'};background:${on?'rgba(91,141,239,.1)':'var(--navy-lift)'};margin-bottom:8px;transition:all .18s">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
        <span style="font-weight:600;font-size:13px;color:${on?'var(--blue-bright)':'var(--white)'};flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ws.name}</span>
        ${pending>0?`<span style="margin-left:6px;padding:1px 7px;border-radius:10px;background:rgba(245,200,66,.18);color:#F5C842;font-size:10px;font-weight:700;white-space:nowrap">${pending}</span>`:''}
      </div>
      ${linkedClient?`<div style="display:flex;align-items:center;gap:4px;margin-bottom:3px"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg><span style="font-size:10px;color:var(--green);font-weight:600">Portal: ${linkedClient.name}</span></div>`:'<div style="font-size:10px;color:var(--muted);margin-bottom:3px;opacity:.6">No portal client</div>'}
      <div style="font-size:11px;color:var(--muted)">${wsp.length} post${wsp.length!==1?'s':''} · ${chLabels||'No channels'}</div>
    </div>`;
  }).join('');

  renderSocialPostsArea();
}

function selectSocialWorkspace(id){
  _socialActiveWorkspace=id;
  _socialPostFilter='all';
  renderSocialWorkspaces();
}

function renderSocialPostsArea(){
  const content=document.getElementById('social-ws-content');
  if(!content||!_socialActiveWorkspace) return;
  const ws=socialWorkspacesLoad().find(w=>w.id===_socialActiveWorkspace);
  if(!ws){ content.innerHTML=''; return; }

  const allPosts=socialPostsLoad().filter(p=>p.workspaceId===_socialActiveWorkspace);

  const filters=[
    {id:'all',      label:'All'},
    {id:'revision', label:'Revision'},
    {id:'pending',  label:'Pending'},
    {id:'approved', label:'Approved'},
    {id:'scheduled',label:'Scheduled'},
    {id:'published',label:'Published'},
  ];

  const filtered=_socialPostFilter==='all'?allPosts:allPosts.filter(p=>p.status===_socialPostFilter);

  const filterHtml=filters.map(f=>{
    const count=f.id==='all'?allPosts.length:allPosts.filter(p=>p.status===f.id).length;
    const on=_socialPostFilter===f.id;
    return `<button onclick="setSocialPostFilter('${f.id}')" style="padding:5px 12px;border-radius:20px;border:1px solid ${on?'var(--blue)':'var(--border)'};background:${on?'rgba(91,141,239,.12)':'transparent'};color:${on?'var(--blue-bright)':'var(--muted)'};font-size:12px;cursor:pointer;white-space:nowrap">${f.label}${count>0?' '+count:''}</button>`;
  }).join('');

  const chBadges=(ws.channels||[]).map(c=>{ const pl=SOCIAL_PLATFORMS.find(p=>p.id===c); return `<span style="padding:2px 9px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(122,171,255,.1);color:var(--blue-bright)">${pl?pl.label:c}</span>`; }).join('');

  const linkedClient=ws.clientId?(clients||[]).find(c=>c.id===ws.clientId):null;
  const clientBadge=linkedClient
    ?`<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(34,217,122,.1);color:var(--green);border:1px solid rgba(34,217,122,.25)"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Portal: ${linkedClient.name}</span>`
    :`<span onclick="openSocialWorkspaceModal('${ws.id}')" style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:12px;font-size:11px;font-weight:600;background:rgba(245,200,66,.08);color:#F5C842;border:1px solid rgba(245,200,66,.2);cursor:pointer"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>No client linked — click Edit to connect</span>`;

  const postsGrid=filtered.length===0
    ?`<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px">No ${_socialPostFilter==='all'?'':''+_socialPostFilter.replace(/_/g,' ')+' '}posts yet</div>`
    :`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(268px,1fr));gap:16px;margin-top:16px">${filtered.map(p=>renderSocialPostCard(p)).join('')}</div>`;

  content.innerHTML=`
    <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--white)">${ws.name}</div>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;align-items:center">${chBadges||'<span style="font-size:12px;color:var(--muted)">No channels configured</span>'}${clientBadge}</div>
      </div>
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
        <button onclick="openSocialPostModal()" style="padding:8px 18px;border-radius:20px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> New Post</button>
        <button onclick="openSocialWorkspaceModal('${ws.id}')" style="padding:7px 14px;border-radius:20px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer">Edit</button>
        <button onclick="deleteSocialWorkspace('${ws.id}')" style="padding:7px 14px;border-radius:20px;border:1px solid rgba(255,112,112,.3);background:rgba(255,112,112,.07);color:#FF7070;font-size:12px;cursor:pointer">Delete</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;padding-bottom:12px;border-bottom:1px solid var(--border)">${filterHtml}</div>
    ${postsGrid}`;
}

function renderSocialPostCard(p){
  const status=SOCIAL_STATUSES.find(s=>s.id===p.status)||{label:p.status,color:'#A8B4D0'};
  const format=SOCIAL_FORMATS.find(f=>f.id===p.format)||{label:p.format||'Reel'};
  const fColor=FORMAT_COLORS[p.format]||'#7AABFF';
  const labelDot=p.labelColor?`<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.labelColor};flex-shrink:0"></span>`:'';

  const plats=(p.platforms||[]).map(pid=>{ const pl=SOCIAL_PLATFORMS.find(x=>x.id===pid); return pl?`<span style="font-size:10px;padding:2px 7px;border-radius:8px;background:rgba(122,171,255,.1);color:var(--blue-bright);font-weight:500">${pl.label}</span>`:''; }).join('');

  const schedLine=p.scheduledAt?`<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);margin-top:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>${p.scheduledAt}</div>`:'';
  const songLine=p.songName?`<div style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--muted);margin-top:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>${p.songName}${p.songTimestamps?' · '+p.songTimestamps:''}</div>`:'';
  const overlayLine=p.overlayText?`<div style="font-size:11px;color:#A78BFA;margin-top:5px;font-style:italic">"${p.overlayText.substring(0,60)}${p.overlayText.length>60?'…':''}"</div>`:'';
  const revLine=(p.status==='revision')&&p.revisionNote?`<div style="font-size:11px;color:#FB923C;margin-top:6px;padding:5px 8px;border-radius:6px;background:rgba(251,146,60,.08);border-left:2px solid #FB923C">${p.revisionNote}</div>`:'';
  const formatBadge=`<span style="font-size:10px;color:${fColor};font-weight:600;padding:2px 7px;border-radius:8px;background:${fColor}18">${format.label}</span>`;
  const tagsRow=`<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">${plats}${formatBadge}</div>`;

  if(p.coverPhotoData){
    // Cover card — image bleeds edge-to-edge with gradient overlay
    const addrText=p.address?(p.address.substring(0,46)+(p.address.length>46?'…':'')):'';
    return `<div style="background:var(--navy-lift);border-radius:12px;border:1px solid var(--border);overflow:hidden">
      <div style="position:relative">
        <img src="${p.coverPhotoData}" alt="Post cover image" style="width:100%;height:158px;object-fit:cover;display:block">
        <div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(12,18,38,.9) 0%,rgba(12,18,38,.2) 50%,transparent 100%)"></div>
        <div style="position:absolute;bottom:10px;left:12px;right:12px;display:flex;align-items:flex-end;justify-content:space-between;gap:8px">
          <div style="display:flex;align-items:center;gap:5px;min-width:0">
            ${labelDot}
            <span style="font-size:10px;color:rgba(255,255,255,.8);line-height:1.2;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${addrText}</span>
          </div>
          <span style="padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:${status.color}40;color:${status.color};white-space:nowrap;flex-shrink:0;border:1px solid ${status.color}50">${status.label}</span>
        </div>
      </div>
      <div style="padding:12px 13px 13px">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:8px">
          <div style="font-weight:700;font-size:13px;color:var(--white);flex:1;margin-right:8px;line-height:1.3">${p.reelNumber||p.title||'Untitled'}</div>
          ${p.approvalRound?`<span style="padding:2px 7px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(255,255,255,.06);color:var(--muted);border:1px solid var(--border);flex-shrink:0">R${p.approvalRound}</span>`:''}
        </div>
        ${p.content?`<div style="font-size:12px;color:var(--muted);margin-bottom:8px;line-height:1.5;max-height:36px;overflow:hidden">${p.content.substring(0,100)}${p.content.length>100?'…':''}</div>`:''}
        ${tagsRow}
        ${overlayLine}${schedLine}${songLine}${revLine}
        <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">${getSocialPostActions(p)}</div>
      </div>
    </div>`;
  }

  // No-cover card — thin status bar + clean layout
  const addrText=p.address?(p.address.substring(0,50)+(p.address.length>50?'…':'')):'';
  return `<div style="background:var(--navy-lift);border-radius:12px;border:1px solid var(--border);overflow:hidden">
    <div style="height:3px;background:${status.color}"></div>
    <div style="padding:13px">
      ${addrText?`<div style="display:flex;align-items:center;gap:5px;margin-bottom:8px">${labelDot}<span style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${addrText}</span></div>`:''}
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:${p.content?'7':'5'}px">
        <div style="font-weight:700;font-size:13px;color:var(--white);flex:1;margin-right:8px;line-height:1.3">${p.reelNumber||p.title||'Untitled'}</div>
        <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
          <span style="padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:${status.color}22;color:${status.color};white-space:nowrap">${status.label}</span>
          ${p.approvalRound?`<span style="padding:2px 7px;border-radius:8px;font-size:10px;font-weight:700;background:rgba(255,255,255,.06);color:var(--muted);border:1px solid var(--border)">R${p.approvalRound}</span>`:''}
        </div>
      </div>
      ${p.content?`<div style="font-size:12px;color:var(--muted);margin-bottom:8px;line-height:1.5;max-height:36px;overflow:hidden">${p.content.substring(0,100)}${p.content.length>100?'…':''}</div>`:''}
      ${tagsRow}
      ${overlayLine}${schedLine}${songLine}${revLine}
      <div style="display:flex;gap:5px;margin-top:10px;flex-wrap:wrap">${getSocialPostActions(p)}</div>
    </div>
  </div>`;
}

function getSocialPostActions(p){
  const btns=[];
  btns.push(`<button onclick="openSocialPostModal('${p.id}')" style="padding:5px 11px;border-radius:14px;border:1px solid var(--border);background:var(--navy);color:var(--muted);font-size:11px;cursor:pointer">Edit</button>`);

  if(p.status==='draft')
    btns.push(`<button onclick="openSendForApproval('${p.id}')" style="padding:5px 11px;border-radius:14px;border:none;background:linear-gradient(135deg,rgba(245,200,66,.18),rgba(245,200,66,.08));border:1px solid rgba(245,200,66,.4);color:#F5C842;font-size:11px;font-weight:600;cursor:pointer">Send for Approval</button>`);

  if(p.status==='pending' && p.approvalRound===1){
    btns.push(`<span style="padding:4px 10px;border-radius:14px;border:1px solid rgba(245,200,66,.25);background:rgba(245,200,66,.06);color:#F5C842;font-size:10px;font-weight:600;display:inline-flex;align-items:center;gap:4px"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Awaiting client</span>`);
    btns.push(`<button onclick="promptSocialRevision('${p.id}',1)" style="padding:5px 11px;border-radius:14px;border:1px solid rgba(251,146,60,.3);background:rgba(251,146,60,.08);color:#FB923C;font-size:11px;cursor:pointer">Request Changes</button>`);
  }
  if(p.status==='pending' && p.approvalRound===2){
    btns.push(`<button onclick="setSocialPostStatus('${p.id}','scheduled',{round:2})" style="padding:5px 11px;border-radius:14px;border:1px solid rgba(34,217,122,.3);background:rgba(34,217,122,.08);color:#22D97A;font-size:11px;font-weight:600;cursor:pointer">Approve+Schedule</button>`);
    btns.push(`<button onclick="promptSocialRevision('${p.id}',2)" style="padding:5px 11px;border-radius:14px;border:1px solid rgba(251,146,60,.3);background:rgba(251,146,60,.08);color:#FB923C;font-size:11px;cursor:pointer">Revise</button>`);
  }
  if(p.status==='revision')
    btns.push(`<button onclick="resubmitSocialPost('${p.id}')" style="padding:5px 11px;border-radius:14px;border:1px solid rgba(245,200,66,.3);background:rgba(245,200,66,.08);color:#F5C842;font-size:11px;cursor:pointer">Re-submit R${p.approvalRound||1}</button>`);

  if(p.status==='approved' && p.approvalRound===1)
    btns.push(`<button onclick="openSendForApproval('${p.id}',2)" style="padding:5px 11px;border-radius:14px;border:none;background:linear-gradient(135deg,rgba(34,217,122,.18),rgba(34,217,122,.08));border:1px solid rgba(34,217,122,.4);color:#22D97A;font-size:11px;font-weight:600;cursor:pointer">Send for R2</button>`);

  if(p.status==='scheduled'){
    btns.push(`<button onclick="setSocialPostStatus('${p.id}','published')" style="padding:5px 11px;border-radius:14px;border:1px solid rgba(167,139,250,.3);background:rgba(167,139,250,.08);color:#A78BFA;font-size:11px;cursor:pointer">Mark Published</button>`);
    btns.push(`<button onclick="teamOpenMoveDate('${p.id}')" style="padding:5px 11px;border-radius:14px;border:1px solid rgba(122,171,255,.3);background:rgba(122,171,255,.08);color:var(--blue-bright);font-size:11px;cursor:pointer">Move Date</button>`);
  }

  btns.push(`<button onclick="deleteSocialPost('${p.id}')" style="padding:5px 9px;border-radius:14px;border:1px solid rgba(255,112,112,.2);background:transparent;color:#FF7070;font-size:11px;cursor:pointer">✕</button>`);
  return btns.join('');
}

function setSocialPostStatus(postId,newStatus,opts={}){
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  const prev=posts[idx].status;
  posts[idx].status=newStatus;
  if(opts.round!=null) posts[idx].approvalRound=opts.round;
  if(newStatus==='published') posts[idx].publishedAt=new Date().toISOString().slice(0,10);
  if(newStatus==='scheduled') posts[idx].approvedAt=new Date().toISOString().slice(0,10);
  if(newStatus==='pending') delete posts[idx].revisionNote;
  if(!posts[idx].history) posts[idx].history=[];
  const roundLabel=posts[idx].approvalRound?` (R${posts[idx].approvalRound})`:'';
  const histAction=`Status: ${prev} → ${newStatus}${roundLabel}`;
  posts[idx].history.push({action:histAction, by:_activeSessionEmail||'team', at:new Date().toISOString()});
  chatLogAppend(posts,idx,{type:'system',from:'team',by:_activeSessionEmail||'team',text:histAction});
  socialPostsSave(posts);
  refreshSocialApprovalBadge();
  renderSocialPostsArea();
  if(document.getElementById('social-sub-approvals')?.style.display!=='none') renderSocialApprovals();
}

function promptSocialRevision(postId, round){
  const note=prompt(`Revision note for Round ${round} (describe what needs to change):`);
  if(note===null) return;
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  posts[idx].status='revision';
  posts[idx].approvalRound=round;
  posts[idx].revisionNote=note||'';
  if(!posts[idx].history) posts[idx].history=[];
  posts[idx].history.push({action:`Revision requested (R${round}): ${note}`, by:_activeSessionEmail||'team', at:new Date().toISOString()});
  chatLogAppend(posts,idx,{type:'revision',from:'team',by:_activeSessionEmail||'team',text:note||'Revision requested'});
  socialPostsSave(posts);
  refreshSocialApprovalBadge();
  renderSocialPostsArea();
  if(document.getElementById('social-sub-approvals')?.style.display!=='none') renderSocialApprovals();
}

function resubmitSocialPost(postId){
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  const round=posts[idx].approvalRound||1;
  posts[idx].status='pending';
  delete posts[idx].revisionNote;
  if(!posts[idx].history) posts[idx].history=[];
  posts[idx].history.push({action:`Re-submitted for R${round} approval`, by:_activeSessionEmail||'team', at:new Date().toISOString()});
  chatLogAppend(posts,idx,{type:'system',from:'team',by:_activeSessionEmail||'team',text:`Re-submitted for R${round} approval`});
  socialPostsSave(posts);
  refreshSocialApprovalBadge();
  renderSocialPostsArea();
  if(document.getElementById('social-sub-approvals')?.style.display!=='none') renderSocialApprovals();
}

function openSendForApproval(postId, forceRound){
  const posts=socialPostsLoad();
  const post=posts.find(p=>p.id===postId);
  if(!post) return;
  const ws=socialWorkspacesLoad().find(w=>w.id===post.workspaceId);

  // Determine which round is valid
  let round = forceRound || 1;
  if(!forceRound){
    // R2 only available after R1 is approved
    if(post.status==='approved' && post.approvalRound===1) round=2;
    else if(post.status==='revision') round=post.approvalRound||1;
    else round=1;
  }
  const approvers=round===1?(ws?.approvers1||''):(ws?.approvers2||'');

  const existing=document.getElementById('send-approval-modal');
  if(existing) existing.remove();
  const modal=document.createElement('div');
  modal.id='send-approval-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:5000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;padding:28px;width:460px;max-width:95vw;border:1px solid var(--border);box-shadow:0 8px 48px rgba(0,0,0,.6)" onclick="event.stopPropagation()">
    <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:4px">Send for Approval — Round ${round}</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:20px">${post.address||post.reelNumber||post.title||'Post'} · ${ws?.name||'Workspace'}</div>
    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:16px">
      <div style="font-size:10px;font-weight:700;color:var(--blue-bright);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Round ${round} Approvers</div>
      ${approvers
        ? approvers.split(',').map(e=>e.trim()).filter(Boolean).map(e=>`<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)"><span style="width:28px;height:28px;border-radius:50%;background:rgba(91,141,239,.15);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:11px;color:var(--blue-bright);flex-shrink:0">${e[0]?.toUpperCase()||'?'}</span><span style="font-size:12px;color:var(--white)">${e}</span></div>`).join('')
        : `<div style="font-size:12px;color:var(--muted);font-style:italic">No approvers configured for Round ${round}. <button onclick="openSocialWorkspaceModal('${ws?.id||''}');document.getElementById('send-approval-modal')?.remove()" style="background:none;border:none;color:var(--blue-bright);cursor:pointer;font-size:12px;text-decoration:underline">Configure in workspace settings</button></div>`
      }
    </div>
    <div style="font-size:11px;color:var(--muted);margin-bottom:20px">${round===2?'Round 2 approval confirms the post is scheduled for publishing.':'Round 1 approval is required before the post can be sent for scheduling approval.'}</div>
    <div style="display:flex;gap:10px">
      <button onclick="document.getElementById('send-approval-modal').remove()" style="flex:1;padding:10px;border-radius:12px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:13px;cursor:pointer">Cancel</button>
      <button onclick="confirmSendForApproval('${postId}',${round})" style="flex:2;padding:10px;border-radius:12px;border:none;background:linear-gradient(135deg,#F5C842,#E5B022);color:#0D1117;font-size:13px;font-weight:700;cursor:pointer">Send for R${round} Approval</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function confirmSendForApproval(postId, round){
  document.getElementById('send-approval-modal')?.remove();
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  posts[idx].status='pending';
  posts[idx].approvalRound=round;
  delete posts[idx].revisionNote;
  if(!posts[idx].history) posts[idx].history=[];
  posts[idx].history.push({action:`Sent for R${round} approval`, by:_activeSessionEmail||'team', at:new Date().toISOString()});
  chatLogAppend(posts,idx,{type:'system',from:'team',by:_activeSessionEmail||'team',text:`Sent for R${round} approval`});
  socialPostsSave(posts);
  refreshSocialApprovalBadge();
  renderSocialPostsArea();
  if(document.getElementById('social-sub-approvals')?.style.display!=='none') renderSocialApprovals();
}

function setSocialPostFilter(filter){
  _socialPostFilter=filter;
  renderSocialPostsArea();
}

function deleteSocialPost(id){
  if(!confirm('Delete this post?')) return;
  socialPostsSave(socialPostsLoad().filter(p=>p.id!==id));
  refreshSocialApprovalBadge();
  renderSocialPostsArea();
}

function deleteSocialWorkspace(id){
  if(!confirm('Delete this workspace and all its posts? This cannot be undone.')) return;
  socialWorkspacesSave(socialWorkspacesLoad().filter(w=>w.id!==id));
  socialPostsSave(socialPostsLoad().filter(p=>p.workspaceId!==id));
  if(_socialActiveWorkspace===id) _socialActiveWorkspace=null;
  refreshSocialApprovalBadge();
  renderSocialWorkspaces();
}

// ── Calendar ─────────────────────────────────────────────────────────────────────────────────
let _socialCalFilter='all';

function renderSocialCalendar(){
  const cal=document.getElementById('social-sub-calendar');
  if(!cal) return;
  const allPostsRaw=socialPostsLoad().filter(p=>p.scheduledAt);
  const workspaces=socialWorkspacesLoad();
  const yr=_socialCalYear;
  const mo=_socialCalMonth;
  const firstDow=new Date(yr,mo,1).getDay();
  const days=new Date(yr,mo+1,0).getDate();
  const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const todayStr=new Date().toISOString().slice(0,10);

  const CAL_FILTERS=[
    {id:'all',      label:'All',  color:'var(--muted)'},
    {id:'draft',    label:'DRFT', color:'#A8B4D0'},
    {id:'pending',  label:'PEND', color:'#F5C842'},
    {id:'revision', label:'REV',  color:'#FB923C'},
    {id:'approved', label:'APPR', color:'#7AABFF'},
    {id:'scheduled',label:'SCHD', color:'#22D97A'},
    {id:'published',label:'PUB',  color:'#A78BFA'},
  ];
  const filterPills=[
    {id:'all',      label:'All',  color:'var(--muted)'},
    {id:'draft',    label:'DRFT', color:'#A8B4D0'},
    {id:'pending',  label:'PEND', color:'#F5C842'},
    {id:'revision', label:'REV',  color:'#FB923C'},
    {id:'approved', label:'APPR', color:'#7AABFF'},
    {id:'scheduled',label:'SCHD', color:'#22D97A'},
    {id:'published',label:'PUB',  color:'#A78BFA'},
  ];

  function postMatchesFilter(p){
    if(_socialCalFilter==='all') return true;
    return p.status===_socialCalFilter;
  }
  const posts=allPostsRaw.filter(postMatchesFilter);

  const filterPillsHtml=filterPills.map(f=>{
    const on=_socialCalFilter===f.id;
    return `<button onclick="_socialCalFilter='${f.id}';renderSocialCalendar()" style="padding:4px 12px;border-radius:14px;border:1px solid ${on?f.color:'var(--border)'};background:${on?f.color+'22':'transparent'};color:${on?f.color:'var(--muted)'};font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.04em">${f.label}</button>`;
  }).join('');

  // Gather all labels across workspaces (for legend + dated label entries)
  const allLabels=[];
  workspaces.forEach(ws=>{ (ws.labels||[]).forEach(l=>{ if(!allLabels.find(x=>x.color===l.color&&x.name===l.name)) allLabels.push(l); }); });
  // Dated labels — labels with a specific calendar date set
  const datedLabels=allLabels.filter(l=>l.date);

  // Build list of unique property banners (by labelColor+address) for this month
  const propertyBanners=[];
  posts.forEach(p=>{
    if(!p.labelColor&&!p.address) return;
    const key=(p.labelColor||'')+'|'+(p.address||'');
    if(!propertyBanners.find(b=>b.key===key)){
      propertyBanners.push({key,color:p.labelColor||'#7AABFF',label:p.address||p.title||'Post',workspaceId:p.workspaceId});
    }
  });

  // Build weeks array — each week is an array of 7 date strings (or null for padding)
  const weeks=[];
  let week=Array(firstDow).fill(null);
  for(let d=1;d<=days;d++){
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    week.push(ds);
    if(week.length===7){ weeks.push(week); week=[]; }
  }
  if(week.length) { while(week.length<7) week.push(null); weeks.push(week); }

  // Build flat cell list — padding + real days + trailing padding
  let cellsHtml='';
  // Leading empty cells
  for(let i=0;i<firstDow;i++){
    cellsHtml+=`<div style="min-height:100px;border-radius:8px;background:var(--navy-mid);border:1px solid var(--border);opacity:.4"></div>`;
  }
  // Real day cells
  for(let d=1;d<=days;d++){
    const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dp=posts.filter(p=>p.scheduledAt===ds);
    const dl=datedLabels.filter(l=>l.date===ds);
    const isToday=ds===todayStr;
    const labelChips=dl.map(l=>`<div style="margin-bottom:3px;border-radius:4px;overflow:hidden;background:${l.color}18;border:1px solid ${l.color}44;border-left:3px solid ${l.color}">
      <div style="padding:3px 5px;font-size:9px;font-weight:700;color:${l.color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;letter-spacing:.03em">${l.name}</div>
    </div>`).join('');
    cellsHtml+=`<div style="min-height:100px;padding:6px 5px 5px;border-radius:8px;border:1px solid ${isToday?'var(--blue)':'var(--border)'};background:${isToday?'rgba(91,141,239,.06)':'var(--navy-card)'};overflow:hidden;box-sizing:border-box">
      <div style="font-size:12px;font-weight:${isToday?'700':'500'};color:${isToday?'var(--blue-bright)':'var(--border-bright)'};margin-bottom:5px;text-align:right;line-height:1;letter-spacing:-.01em">${d}</div>
      ${labelChips}
      ${dp.map(p=>{
        const st=SOCIAL_STATUSES.find(s=>s.id===p.status);
        const statusColor=st?.color||'#7AABFF';
        const accentColor=p.labelColor||statusColor;
        const timeStr=p.scheduledTime||'';
        const label=p.address||p.title||p.reelNumber||'Post';
        const statusLabel=st?.label?.replace(' ✓','').replace(' Needed','').replace(' Approval','')||'Draft';
        return `<div onclick="openSocialPostPreview('${p.id}')" title="${label}" style="margin-bottom:4px;cursor:pointer;border-radius:6px;overflow:hidden;background:var(--navy-lift);border:1px solid ${accentColor}28;transition:border-color .15s" onmouseenter="this.style.borderColor='${accentColor}66'" onmouseleave="this.style.borderColor='${accentColor}28'">
          <div style="height:2px;background:linear-gradient(90deg,${accentColor},${accentColor}88)"></div>
          <div style="padding:4px 6px 5px">
            <div style="font-size:10px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.35;margin-bottom:4px">${label}</div>
            <div style="display:flex;align-items:center;gap:4px;flex-wrap:nowrap;min-width:0">
              <span style="flex-shrink:0;display:inline-flex;align-items:center;gap:2px;background:${statusColor}18;border:1px solid ${statusColor}40;border-radius:10px;padding:1px 6px;font-size:8px;font-weight:700;color:${statusColor};letter-spacing:.05em;white-space:nowrap">${statusLabel}</span>
              ${timeStr?`<span style="font-size:8px;color:var(--muted);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${timeStr}</span>`:''}
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
  }
  // Trailing empty cells to complete last row
  const totalCells=Math.ceil((firstDow+days)/7)*7;
  for(let i=firstDow+days;i<totalCells;i++){
    cellsHtml+=`<div style="min-height:100px;border-radius:8px;background:var(--navy-mid);border:1px solid var(--border);opacity:.4"></div>`;
  }

  const legendHtml=allLabels.length?`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px;padding:8px 14px;background:var(--navy-lift);border-radius:8px;border:1px solid var(--border)">
    <span style="font-size:11px;color:var(--muted);font-weight:600;align-self:center">Labels:</span>
    ${allLabels.map(l=>`<span style="display:flex;align-items:center;gap:5px;font-size:11px;color:var(--white)"><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${l.color}"></span>${l.name}</span>`).join('')}
  </div>`:'';

  cal.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:10px">
      <button onclick="_socialCalMonth--;if(_socialCalMonth<0){_socialCalMonth=11;_socialCalYear--;}renderSocialCalendar()" style="padding:6px 16px;border-radius:16px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:13px;cursor:pointer">‹ Prev</button>
      <div style="font-size:16px;font-weight:700;color:var(--white)">${monthNames[mo]} ${yr}</div>
      <div style="display:flex;align-items:center;gap:10px">
        <button onclick="openSocialLabelModal()" style="padding:6px 14px;border-radius:16px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer;display:flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg> Labels</button>
        <button onclick="_socialCalMonth++;if(_socialCalMonth>11){_socialCalMonth=0;_socialCalYear++;}renderSocialCalendar()" style="padding:6px 16px;border-radius:16px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:13px;cursor:pointer">Next ›</button>
      </div>
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">${filterPillsHtml}</div>
    ${legendHtml}
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:4px">
      ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div style="text-align:center;font-size:10px;color:var(--muted);font-weight:700;padding:6px 4px;letter-spacing:.06em;text-transform:uppercase">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${cellsHtml}</div>`;
}

// Quick preview modal for calendar post clicks
// Build the "First Comment" text — hashtags (one per line) + blank line + overlay at bottom
function buildFirstComment(post){
  const tags=(post.hashtags||'').trim();
  const overlay=(post.overlayText||'').trim();
  const parts=[];
  if(tags) parts.push(tags.replace(/\s+#/g,'\n#').replace(/^#+/,'#'));
  if(overlay) parts.push('');  // blank separator line
  if(overlay) parts.push(overlay);
  return parts.join('\n');
}

function openSocialPostPreview(postId){
  const post=socialPostsLoad().find(p=>p.id===postId);
  if(!post) return;
  const status=SOCIAL_STATUSES.find(s=>s.id===post.status)||{label:post.status,color:'#A8B4D0'};
  const firstComment=buildFirstComment(post);
  const contentDesc=[post.address,post.reelNumber].filter(Boolean).join(' - ');
  const existing=document.getElementById('social-post-preview-modal');
  if(existing) existing.remove();
  const modal=document.createElement('div');
  modal.id='social-post-preview-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:4000;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div style="background:#1C2333;border-radius:16px;padding:24px;width:480px;max-width:95vw;border:1px solid #3A4890;box-shadow:0 8px 48px rgba(0,0,0,.6);max-height:85vh;overflow-y:auto" onclick="event.stopPropagation()">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div>
        <div style="font-weight:700;font-size:15px;color:var(--white)">${post.address||post.reelNumber||'Post'}</div>
        ${post.reelNumber?`<div style="font-size:12px;color:var(--muted)">${post.reelNumber}</div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span style="padding:3px 10px;border-radius:10px;font-size:11px;font-weight:700;background:${status.color}22;color:${status.color}">${status.label}</span>
        <button onclick="document.getElementById('social-post-preview-modal').remove()" style="background:none;border:none;color:var(--muted);font-size:20px;cursor:pointer">×</button>
      </div>
    </div>
    ${post.scheduledAt?`<div style="font-size:12px;color:var(--muted);margin-bottom:12px">${post.scheduledAt}${post.scheduledTime?' at '+post.scheduledTime:''}</div>`:''}
    ${post.content?`<div style="margin-bottom:14px"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Caption</div><div style="font-size:13px;color:var(--white);line-height:1.6;white-space:pre-line">${post.content}</div></div>`:''}
    ${firstComment?`<div style="margin-bottom:14px"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">First Comment</div><div style="font-size:12px;color:var(--muted);line-height:1.7;white-space:pre-line;background:var(--navy);border-radius:8px;padding:10px 12px">${firstComment}</div></div>`:''}
    ${contentDesc?`<div style="margin-bottom:14px"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Content Details</div><div style="font-size:12px;color:var(--white)">${contentDesc}</div><div style="margin-top:6px"><span style="padding:2px 10px;border-radius:12px;background:rgba(122,171,255,.12);color:var(--blue-bright);font-size:11px">${post.address||''}</span></div></div>`:''}
    ${post.overlayText?`<div style="margin-bottom:14px"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Overlay (${post.overlayType||'description'})</div><div style="font-size:13px;color:#A78BFA;font-style:italic">"${post.overlayText}"</div></div>`:''}
    ${post.songName?`<div style="margin-bottom:14px"><div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px">Music</div><div style="font-size:12px;color:var(--white)">${post.songName}${post.songTimestamps?' · '+post.songTimestamps:''}</div></div>`:''}
    <div style="margin-bottom:14px">
      <div style="font-size:10px;color:var(--blue-bright);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">Chat Log</div>
      <div style="max-height:200px;overflow-y:auto;margin-bottom:10px">${renderChatLog(post.chatLog||[],'team',post.id)}</div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="text" id="team-chat-input-${post.id}" placeholder="Send a message to the client…" style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--white);font-size:12px" onkeydown="if(event.key==='Enter'){teamSendChatMessage('${post.id}');}">
        <button onclick="teamSendChatMessage('${post.id}')" style="padding:8px 14px;border-radius:10px;border:none;background:var(--blue);color:#fff;font-size:12px;font-weight:700;cursor:pointer">Send</button>
      </div>
    </div>
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="document.getElementById('social-post-preview-modal').remove();openSocialPostModal('${postId}')" style="flex:1;padding:9px;border-radius:12px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:13px;cursor:pointer">Edit Post</button>
      <button onclick="document.getElementById('social-post-preview-modal').remove()" style="padding:9px 18px;border-radius:12px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:13px;cursor:pointer">Close</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

// ── Approvals ────────────────────────────────────────────────────────────────────────────────
function renderSocialApprovals(){
  const appr=document.getElementById('social-sub-approvals');
  if(!appr) return;
  const pending=socialPostsLoad().filter(p=>p.status==='pending'||p.status==='revision');
  const workspaces=socialWorkspacesLoad();

  if(pending.length===0){
    appr.innerHTML=`<div style="text-align:center;padding:60px;color:var(--muted);font-size:14px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2" style="display:block;margin:0 auto 12px"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>No posts pending — all clear!</div>`;
    return;
  }

  // Group by round
  const r1=pending.filter(p=>p.approvalRound===1||(p.approvalRound==null));
  const r2=pending.filter(p=>p.approvalRound===2);

  const renderGroup=(title,color,items)=>`
    <div style="font-size:11px;font-weight:700;color:${color};letter-spacing:.06em;text-transform:uppercase;margin-bottom:10px">${title}</div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-bottom:24px">
    ${items.map(p=>{
      const ws=workspaces.find(w=>w.id===p.workspaceId);
      const status=SOCIAL_STATUSES.find(s=>s.id===p.status)||{label:p.status,color:'#A8B4D0'};
      const format=SOCIAL_FORMATS.find(f=>f.id===p.format);
      const plats=(p.platforms||[]).map(pid=>SOCIAL_PLATFORMS.find(x=>x.id===pid)?.label||pid).join(', ');
      const approvers=(p.approvalRound||1)===1?(ws?.approvers1||''):(ws?.approvers2||'');
      return `<div style="background:var(--navy-lift);border-radius:12px;border:1px solid ${status.color}33;padding:16px;display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start">
        ${p.coverPhotoData?`<img src="${p.coverPhotoData}" alt="" style="width:36px;height:64px;object-fit:cover;border-radius:6px;flex-shrink:0">`:''}
        <div style="flex:1;min-width:200px">
          <div style="font-weight:700;font-size:14px;color:var(--white);margin-bottom:3px">${p.address||p.reelNumber||p.title||'Untitled'}</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:6px">${ws?.name||'—'} · ${format?.label||'Reel'}${plats?' · '+plats:''}</div>
          ${p.content?`<div style="font-size:12px;color:var(--muted);line-height:1.5;border-left:2px solid var(--border);padding-left:10px;margin-bottom:8px">${p.content.substring(0,200)}${p.content.length>200?'…':''}</div>`:''}
          ${p.overlayText?`<div style="font-size:12px;color:#A78BFA;margin-bottom:6px;font-style:italic">Overlay: "${p.overlayText}" <span style="font-style:normal;color:var(--muted)">(${p.overlayType||'description'})</span></div>`:''}
          ${p.status==='revision'&&p.revisionNote?`<div style="font-size:12px;color:#FB923C;background:rgba(251,146,60,.08);padding:8px;border-radius:6px;border-left:3px solid #FB923C;margin-bottom:6px">Revision: ${p.revisionNote}</div>`:''}
          ${(p.clientComments&&p.clientComments.length)?`<div style="margin-top:8px"><div style="font-size:10px;color:#F5C842;font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px">Client Feedback</div>${p.clientComments.slice(-3).map(c=>`<div style="font-size:11px;padding:5px 8px;border-radius:5px;background:rgba(91,141,239,.07);border-left:2px solid #7AABFF;margin-bottom:4px;color:var(--white)">${c.text}</div>`).join('')}${p.clientComments.length>3?`<div style="font-size:10px;color:var(--muted)">(+${p.clientComments.length-3} more — open post to see all)</div>`:''}</div>`:''}
          ${p.scheduledAt?`<div style="font-size:11px;color:var(--muted)">Scheduled: ${p.scheduledAt}</div>`:''}
          ${approvers?`<div style="font-size:11px;color:var(--muted);margin-top:6px">Approvers: ${approvers}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;gap:7px;min-width:148px">
          <span style="padding:4px 10px;border-radius:10px;font-size:11px;font-weight:700;background:${status.color}22;color:${status.color};text-align:center">${status.label}</span>
          ${p.status==='pending'&&(p.approvalRound||1)===1?`<div style="padding:8px;border-radius:12px;border:1px solid rgba(245,200,66,.25);background:rgba(245,200,66,.06);color:#F5C842;font-size:11px;font-weight:600;text-align:center;display:flex;align-items:center;justify-content:center;gap:5px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>Awaiting client</div>`:''}
          ${p.status==='pending'&&(p.approvalRound||1)===1?`<button onclick="promptSocialRevision('${p.id}',1)" style="padding:8px;border-radius:12px;border:1px solid rgba(251,146,60,.3);background:rgba(251,146,60,.08);color:#FB923C;font-size:12px;cursor:pointer">Request Changes</button>`:''}
          ${p.status==='revision'&&(p.approvalRound||1)===1?`<button onclick="resubmitSocialPost('${p.id}')" style="padding:8px;border-radius:12px;border:1px solid rgba(245,200,66,.3);background:rgba(245,200,66,.08);color:#F5C842;font-size:12px;cursor:pointer">Re-send to Client</button>`:''}
          ${p.status==='pending'&&p.approvalRound===2?`<button onclick="setSocialPostStatus('${p.id}','scheduled',{round:2});renderSocialApprovals()" style="padding:8px;border-radius:12px;border:1px solid rgba(34,217,122,.3);background:rgba(34,217,122,.08);color:#22D97A;font-size:12px;font-weight:600;cursor:pointer">✓ Approve + Schedule</button>`:''}
          ${p.status==='pending'&&p.approvalRound===2?`<button onclick="promptSocialRevision('${p.id}',2)" style="padding:8px;border-radius:12px;border:1px solid rgba(251,146,60,.3);background:rgba(251,146,60,.08);color:#FB923C;font-size:12px;cursor:pointer">Request Revision</button>`:''}
          ${p.status==='revision'&&p.approvalRound===2?`<button onclick="resubmitSocialPost('${p.id}')" style="padding:8px;border-radius:12px;border:1px solid rgba(245,200,66,.3);background:rgba(245,200,66,.08);color:#F5C842;font-size:12px;cursor:pointer">Re-submit R2</button>`:''}
          <button onclick="openSocialPostModal('${p.id}')" style="padding:8px;border-radius:12px;border:1px solid var(--border);background:var(--navy);color:var(--muted);font-size:12px;cursor:pointer">Edit Post</button>
        </div>
      </div>`;
    }).join('')}
    </div>`;

  appr.innerHTML=`
    <div style="font-size:13px;color:var(--muted);margin-bottom:20px">${pending.length} post${pending.length>1?'s':''} need${pending.length===1?'s':''} attention</div>
    ${r1.length?renderGroup('Round 1 — Awaiting Client Approval','#F5C842',r1):''}
    ${r2.length?renderGroup('Round 2 — Internal Schedule Approval','#22D97A',r2):''}`;
}

// ── Music Tracker ──────────────────────────────────────────────────────────────────────────
function renderSocialMusicTracker(){
  const mt=document.getElementById('social-sub-music');
  if(!mt) return;
  const posts=socialPostsLoad().filter(p=>p.songName);
  const workspaces=socialWorkspacesLoad();

  if(posts.length===0){
    mt.innerHTML=`<div style="text-align:center;padding:60px;color:var(--muted);font-size:14px"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.2" style="display:block;margin:0 auto 12px"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>No music tracked yet — add song names to posts</div>`;
    return;
  }

  mt.innerHTML=`
    <div style="font-size:13px;color:var(--muted);margin-bottom:16px">${posts.length} post${posts.length>1?'s':''} with music tracked</div>
    <div style="overflow-x:auto">
    <table style="width:100%;border-collapse:collapse;font-size:12px">
      <thead>
        <tr style="border-bottom:1px solid var(--border)">
          <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Workspace</th>
          <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Property / Reel</th>
          <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Song</th>
          <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Timestamps</th>
          <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Final Drive Link</th>
          <th style="padding:8px 12px;text-align:left;color:var(--muted);font-weight:600">Status</th>
        </tr>
      </thead>
      <tbody>
        ${posts.map(p=>{
          const ws=workspaces.find(w=>w.id===p.workspaceId);
          const status=SOCIAL_STATUSES.find(s=>s.id===p.status)||{label:p.status,color:'#A8B4D0'};
          const finalLink=p.finalDriveLink?`<a href="${p.finalDriveLink}" target="_blank" rel="noopener" style="color:var(--blue-bright);text-decoration:none;font-size:11px">Open ↗</a>`:`<span style="color:var(--muted)">—</span>`;
          return `<tr style="border-bottom:1px solid var(--border);cursor:pointer" onmouseover="this.style.background='rgba(255,255,255,.03)'" onmouseout="this.style.background='transparent'">
            <td style="padding:10px 12px;color:var(--muted)">${ws?.name||'—'}</td>
            <td style="padding:10px 12px;color:var(--white);font-weight:600">${p.address||p.reelNumber||p.title||'—'}</td>
            <td style="padding:10px 12px;color:var(--white)">${p.songName}</td>
            <td style="padding:10px 12px;color:var(--muted)">${p.songTimestamps||'—'}</td>
            <td style="padding:10px 12px">${finalLink}</td>
            <td style="padding:10px 12px"><span style="padding:2px 8px;border-radius:8px;font-size:10px;font-weight:700;background:${status.color}22;color:${status.color}">${status.label}</span></td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>
    </div>`;
}

// ── Workspace Modal ───────────────────────────────────────────────────────────────────────────
function openSocialWorkspaceModal(id){
  const modal=document.getElementById('social-ws-modal');
  if(!modal){ console.error('social-ws-modal element not found'); return; }
  _socialEditingWsId=id||null;
  const ws=id?socialWorkspacesLoad().find(w=>w.id===id):null;
  const titleEl=document.getElementById('social-ws-modal-title');
  if(titleEl) titleEl.textContent=ws?'Edit Workspace':'New Workspace';
  const nameEl=document.getElementById('social-ws-name');       if(nameEl) nameEl.value=ws?.name||'';
  const igEl=document.getElementById('social-ws-ig-handle');    if(igEl)   igEl.value=(ws?.igHandle||'');
  const a1El=document.getElementById('social-ws-approvers1');   if(a1El)   a1El.value=(ws?.approvers1||'');
  const a2El=document.getElementById('social-ws-approvers2');   if(a2El)   a2El.value=(ws?.approvers2||'');
  const selected=ws?.channels||[];
  SOCIAL_PLATFORMS.forEach(p=>{ const cb=document.getElementById('social-ch-'+p.id); if(cb) cb.checked=selected.includes(p.id); });
  // Populate client dropdown (limit to 500 for performance; show all if fewer)
  const clientSel=document.getElementById('social-ws-client-id');
  if(clientSel){
    const cList=(clients||[]).slice(0,500);
    const moreNote=(clients||[]).length>500?`<option disabled>…and ${(clients||[]).length-500} more — use Clients tab to manage</option>`:'';
    clientSel.innerHTML='<option value="">— No client linked —</option>'
      +cList.map(c=>`<option value="${c.id||''}">${(c.name||'').replace(/"/g,'&quot;')}${c.company?' ('+c.company.replace(/"/g,'&quot;')+')':''}</option>`).join('')
      +moreNote;
    clientSel.value=ws?.clientId||'';
  }
  modal.style.display='flex';
}
function closeSocialWorkspaceModal(){
  document.getElementById('social-ws-modal').style.display='none';
}
function saveSocialWorkspace(){
  const name=document.getElementById('social-ws-name').value.trim();
  if(!name){ alert('Workspace name is required'); return; }
  const igHandle=(document.getElementById('social-ws-ig-handle')?.value||'').trim().replace(/^@/,'');
  const channels=SOCIAL_PLATFORMS.filter(p=>document.getElementById('social-ch-'+p.id)?.checked).map(p=>p.id);
  const approvers1=document.getElementById('social-ws-approvers1').value.trim();
  const approvers2=document.getElementById('social-ws-approvers2').value.trim();
  const clientId=document.getElementById('social-ws-client-id')?.value||null;
  const workspaces=socialWorkspacesLoad();
  if(_socialEditingWsId){
    const idx=workspaces.findIndex(w=>w.id===_socialEditingWsId);
    if(idx>=0){ Object.assign(workspaces[idx],{name,igHandle,channels,approvers1,approvers2,clientId:clientId||null}); }
  } else {
    const nw={id:'ws_'+Date.now(),name,igHandle,channels,approvers1,approvers2,clientId:clientId||null,labels:[],createdAt:new Date().toISOString().slice(0,10)};
    workspaces.push(nw);
    _socialActiveWorkspace=nw.id;
  }
  socialWorkspacesSave(workspaces);
  // Backfill clientId on existing posts that belong to this workspace and have no clientId set
  if(clientId){
    const wsId=_socialEditingWsId||(workspaces[workspaces.length-1]?.id);
    const allPosts=socialPostsLoad();
    let changed=false;
    allPosts.forEach(p=>{ if(p.workspaceId===wsId && !p.clientId){ p.clientId=clientId; changed=true; } });
    if(changed) socialPostsSave(allPosts);
  }
  closeSocialWorkspaceModal();
  renderSocialWorkspaces();
}

// ── Post Modal ───────────────────────────────────────────────────────────────────────────────────
function openSocialPostModal(id){
  _socialEditingPostId=id||null;
  const post=id?socialPostsLoad().find(p=>p.id===id):null;
  document.getElementById('social-post-modal-title').textContent=post?'Edit Post':'New Post Mockup';
  document.getElementById('social-post-address').value=post?.address||'';
  document.getElementById('social-post-reel').value=post?.reelNumber||'';
  document.getElementById('social-post-format').value=post?.format||'reel';
  document.getElementById('social-post-content').value=post?.content||'';
  document.getElementById('social-post-hashtags').value=post?.hashtags||'';
  if(document.getElementById('social-post-overlay')) document.getElementById('social-post-overlay').value=post?.overlayText||'';
  if(document.getElementById('social-post-overlay-type')) document.getElementById('social-post-overlay-type').value=post?.overlayType||'description';
  document.getElementById('social-post-asset').value=post?.assetName||'';
  document.getElementById('social-post-final-link').value=post?.finalDriveLink||'';
  document.getElementById('social-post-cover').value=post?.coverPhoto||'';
  // Restore reel state
  _reelObjectUrl=null; _reelCoverDataUrl=post?.coverPhotoData||null; _reelCoverTime=post?.coverPhotoTime||0; _reelDuration=0;
  // Reset upload zone defaults
  const _rz=document.getElementById('reel-upload-zone');
  const _rvw=document.getElementById('reel-video-wrap');
  const _fsw=document.getElementById('frame-scrubber-wrap');
  const _fs=document.getElementById('frame-strip');
  const _rfi=document.getElementById('reel-file-input');
  if(_rz) _rz.style.display='block';
  if(_rvw) _rvw.style.display='none';
  if(_fsw) _fsw.style.display='none';
  if(_fs) _fs.innerHTML='';
  if(_rfi) _rfi.value='';
  const _igVid=document.getElementById('ig-preview-video');
  if(_igVid){ _igVid.src=''; _igVid.style.display='none'; }
  const _igCov=document.getElementById('ig-preview-cover');
  const _igPh=document.getElementById('ig-preview-placeholder');
  if(_reelCoverDataUrl){
    if(_igCov){ _igCov.src=_reelCoverDataUrl; _igCov.style.display='block'; }
    if(_igPh) _igPh.style.display='none';
    const coverWrap=document.getElementById('cover-preview-wrap');
    const coverImg=document.getElementById('cover-preview-img');
    const coverTimeEl=document.getElementById('cover-preview-time');
    if(coverWrap) coverWrap.style.display='flex';
    if(coverImg) coverImg.src=_reelCoverDataUrl;
    if(coverTimeEl) coverTimeEl.textContent='Frame @ '+fmtSec(_reelCoverTime);
  } else {
    if(_igCov){ _igCov.src=''; _igCov.style.display='none'; }
    if(_igPh) _igPh.style.display='flex';
    const coverWrap=document.getElementById('cover-preview-wrap');
    if(coverWrap) coverWrap.style.display='none';
  }
  document.getElementById('social-post-song').value=post?.songName||'';
  document.getElementById('social-post-timestamps').value=post?.songTimestamps||'';
  document.getElementById('social-post-status').value=post?.status||'draft';
  document.getElementById('social-post-sched').value=post?.scheduledAt||'';
  document.getElementById('social-post-sched-time').value=post?.scheduledTime||'';
  document.getElementById('social-post-revision').value=post?.revisionNote||'';
  document.getElementById('social-post-label-color').value=post?.labelColor||'';

  // Populate client dropdown
  const clientSel=document.getElementById('social-post-client-id');
  if(clientSel){
    clientSel.innerHTML='<option value="">— No client assigned —</option>'
      +(clients||[]).map(c=>`<option value="${c.id}">${c.name}${c.address?' — '+c.address:''}</option>`).join('');
    clientSel.value=post?.clientId||'';
  }

  SOCIAL_PLATFORMS.forEach(p=>{ const cb=document.getElementById('social-plt-'+p.id); if(cb) cb.checked=(post?.platforms||[]).includes(p.id); });

  // Build label color picker
  buildSocialLabelColorPicker('social-label-color-picker','social-post-label-color', post?.labelColor||'');
  updateSocialPlatformSpecs();
  updateSocialFirstCommentPreview();
  updateInstagramPreview();
  document.getElementById('social-post-modal').style.display='flex';
}

function buildSocialLabelColorPicker(pickerId, hiddenId, selected){
  const el=document.getElementById(pickerId);
  if(!el) return;
  // Workspace labels take priority; fall back to full SOCIAL_LABEL_COLORS palette
  const wsLabels=_socialActiveWorkspace?socialLabelsLoad(_socialActiveWorkspace):[];
  const allColors=wsLabels.length
    ? wsLabels.map(l=>({color:l.color,name:l.name}))
    : SOCIAL_LABEL_COLORS.map(c=>({color:c,name:''}));

  // Render as calendar-style chips: colored dot + name (if named) or just dot
  const chips=allColors.map(c=>{
    const isSelected=selected===c.color;
    const chip=c.name
      ? `<span onclick="document.getElementById('${hiddenId}').value='${c.color}';buildSocialLabelColorPicker('${pickerId}','${hiddenId}','${c.color}')" title="${c.color}" style="display:inline-flex;align-items:center;gap:4px;padding:3px 9px 3px 6px;border-radius:20px;border:1.5px solid ${isSelected?'white':'transparent'};background:${c.color}22;cursor:pointer;font-size:10px;font-weight:700;color:${c.color};transition:all .15s;box-shadow:${isSelected?'0 0 0 2px '+c.color:'none'}">
          <span style="width:10px;height:10px;border-radius:50%;background:${c.color};flex-shrink:0;display:inline-block"></span>${c.name}
        </span>`
      : `<span onclick="document.getElementById('${hiddenId}').value='${c.color}';buildSocialLabelColorPicker('${pickerId}','${hiddenId}','${c.color}')" title="${c.color}" style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${c.color};cursor:pointer;border:2.5px solid ${isSelected?'white':'transparent'};box-shadow:${isSelected?'0 0 0 2px '+c.color:'none'};transition:all .15s" onmouseenter="this.style.transform='scale(1.15)'" onmouseleave="this.style.transform='scale(1)'"></span>`;
    return chip;
  }).join('');

  const none=`<span onclick="document.getElementById('${hiddenId}').value='';buildSocialLabelColorPicker('${pickerId}','${hiddenId}','')" style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;color:var(--muted);cursor:pointer;padding:3px 8px;border-radius:20px;border:1.5px solid ${selected===''?'var(--muted)':'transparent'};background:${selected===''?'rgba(168,180,208,.12)':'transparent'};transition:all .15s">✕ None</span>`;

  el.innerHTML=chips+none;
}

function closeSocialPostModal(){
  document.getElementById('social-post-modal').style.display='none';
  if(_reelObjectUrl){ URL.revokeObjectURL(_reelObjectUrl); _reelObjectUrl=null; }
  _reelCoverDataUrl=null; _reelCoverTime=0; _reelDuration=0;
  const zone=document.getElementById('reel-upload-zone');
  const wrap=document.getElementById('reel-video-wrap');
  const scrubWrap=document.getElementById('frame-scrubber-wrap');
  if(zone) zone.style.display='block';
  if(wrap) wrap.style.display='none';
  if(scrubWrap) scrubWrap.style.display='none';
  const strip=document.getElementById('frame-strip');
  if(strip) strip.innerHTML='';
  const vid=document.getElementById('reel-preview-video');
  if(vid){ vid.src=''; }
  const igVid=document.getElementById('ig-preview-video');
  if(igVid){ igVid.pause(); igVid.src=''; igVid.style.display='none'; }
  // Reset play button state
  const playIcon=document.getElementById('ig-play-icon');
  const pauseIcon=document.getElementById('ig-pause-icon');
  const igOverlay=document.getElementById('ig-play-overlay');
  if(playIcon) playIcon.style.display='block';
  if(pauseIcon) pauseIcon.style.display='none';
  if(igOverlay) igOverlay.style.opacity='1';
  const igCover=document.getElementById('ig-preview-cover');
  if(igCover){ igCover.src=''; igCover.style.display='none'; }
  const igPh=document.getElementById('ig-preview-placeholder');
  if(igPh) igPh.style.display='flex';
  const coverWrap=document.getElementById('cover-preview-wrap');
  if(coverWrap) coverWrap.style.display='none';
  const fi=document.getElementById('reel-file-input');
  if(fi) fi.value='';
}

function saveSocialPost(forceStatus){
  const address=document.getElementById('social-post-address').value.trim();
  const reelNumber=document.getElementById('social-post-reel').value.trim();
  if(!address&&!reelNumber){ alert('Please enter a property address or reel number'); return; }
  if(!_socialActiveWorkspace){ alert('Please select a workspace first'); return; }
  const platforms=SOCIAL_PLATFORMS.filter(p=>document.getElementById('social-plt-'+p.id)?.checked).map(p=>p.id);
  const status=forceStatus||document.getElementById('social-post-status').value;
  const postData={
    title:       address||reelNumber,
    address,
    reelNumber,
    format:      document.getElementById('social-post-format').value,
    content:     document.getElementById('social-post-content').value,
    hashtags:    document.getElementById('social-post-hashtags').value,
    overlayText: document.getElementById('social-post-overlay')?.value||null,
    overlayType: document.getElementById('social-post-overlay-type')?.value||null,
    platforms,
    assetName:   document.getElementById('social-post-asset').value||null,
    finalDriveLink:document.getElementById('social-post-final-link').value||null,
    coverPhoto:  document.getElementById('social-post-cover').value||null,
    coverPhotoData: _reelCoverDataUrl||null,
    coverPhotoTime: _reelCoverTime||0,
    reelFileName: document.getElementById('reel-file-name')?.textContent||null,
    songName:    document.getElementById('social-post-song').value||null,
    songTimestamps:document.getElementById('social-post-timestamps').value||null,
    status,
    scheduledAt: document.getElementById('social-post-sched').value||null,
    scheduledTime: document.getElementById('social-post-sched-time').value||null,
    revisionNote:document.getElementById('social-post-revision').value||null,
    labelColor:  document.getElementById('social-post-label-color').value||null,
    workspaceId: _socialActiveWorkspace,
    clientId:    (()=>{
      const manual=document.getElementById('social-post-client-id')?.value||null;
      if(manual) return manual;
      // Inherit from workspace if no manual override
      const ws=socialWorkspacesLoad().find(w=>w.id===_socialActiveWorkspace);
      return ws?.clientId||null;
    })(),
  };
  const posts=socialPostsLoad();
  if(_socialEditingPostId){
    const idx=posts.findIndex(p=>p.id===_socialEditingPostId);
    if(idx>=0){
      const prev=posts[idx].status;
      Object.assign(posts[idx],postData);
      posts[idx].updatedAt=new Date().toISOString().slice(0,10);
      if(!posts[idx].history) posts[idx].history=[];
      if(prev!==status){
        const histAct=`Status: ${prev} → ${status}`;
        posts[idx].history.push({action:histAct, by:_activeSessionEmail||'team', at:new Date().toISOString()});
        chatLogAppend(posts,idx,{type:'system',from:'team',by:_activeSessionEmail||'team',text:histAct});
      }
    }
  } else {
    posts.push({id:'post_'+Date.now(),...postData,history:[{action:'Created',by:_activeSessionEmail||'team',at:new Date().toISOString()}],createdAt:new Date().toISOString().slice(0,10)});
  }
  try{ socialPostsSave(posts); }catch(e){
    // If localStorage quota exceeded (large cover photo), strip coverPhotoData and retry
    if(e.name==='QuotaExceededError'||e.name==='NS_ERROR_DOM_QUOTA_REACHED'){
      posts.forEach(p=>{ if(p.coverPhotoData&&p.coverPhotoData.length>1000) p.coverPhotoData=null; });
      try{ socialPostsSave(posts); }catch(e2){ console.error('socialPostsSave failed even after stripping cover data',e2); }
    } else { console.error('socialPostsSave failed',e); }
  }
  closeSocialPostModal();
  _socialPostFilter='all';
  refreshSocialApprovalBadge();
  renderSocialWorkspaces();
}

// ── Reel upload & frame scrubber ─────────────────────────────────────────────
function fmtSec(s){
  if(!s||isNaN(s)) return '0:00';
  const m=Math.floor(s/60);
  const sec=Math.floor(s%60);
  return m+':'+(sec<10?'0':'')+sec;
}

function handleReelFileUpload(input){
  const file=input.files[0];
  if(!file) return;
  if(_reelObjectUrl) URL.revokeObjectURL(_reelObjectUrl);
  _reelObjectUrl=URL.createObjectURL(file);

  const video=document.getElementById('reel-preview-video');
  const zone=document.getElementById('reel-upload-zone');
  const wrap=document.getElementById('reel-video-wrap');
  const nameEl=document.getElementById('reel-file-name');

  video.src=_reelObjectUrl;
  if(zone) zone.style.display='none';
  if(wrap) wrap.style.display='block';
  if(nameEl) nameEl.textContent=file.name;

  video.onloadedmetadata=()=>{
    _reelDuration=video.duration;
    const durEl=document.getElementById('frame-duration');
    if(durEl) durEl.textContent=fmtSec(_reelDuration);
    const scrubWrap=document.getElementById('frame-scrubber-wrap');
    if(scrubWrap) scrubWrap.style.display='block';
    generateFrameStrip(video);
    // Auto-select first frame after brief delay
    setTimeout(()=>captureReelFrame(video,0,true),300);
  };

  // Update Instagram phone preview video src
  const igVid=document.getElementById('ig-preview-video');
  if(igVid){
    igVid.src=_reelObjectUrl;
    igVid.style.display='block';
    // Auto-play in mockup
    igVid.play().then(()=>{
      const playIcon=document.getElementById('ig-play-icon');
      const pauseIcon=document.getElementById('ig-pause-icon');
      const overlay=document.getElementById('ig-play-overlay');
      if(playIcon) playIcon.style.display='none';
      if(pauseIcon) pauseIcon.style.display='block';
      if(overlay) setTimeout(()=>{ overlay.style.opacity='0'; },1500);
    }).catch(()=>{});
  }
  const igPlaceholder=document.getElementById('ig-preview-placeholder');
  if(igPlaceholder) igPlaceholder.style.display='none';
  const igCover=document.getElementById('ig-preview-cover');
  if(igCover) igCover.style.display='none';

  updateInstagramPreview();
}

function generateFrameStrip(video){
  const strip=document.getElementById('frame-strip');
  if(!strip||_frameStripCapturing) return;
  strip.innerHTML='';
  _frameStripCapturing=true;
  const count=10;
  const thumbW=40,thumbH=71;
  let i=0;

  function captureNext(){
    if(i>=count){ _frameStripCapturing=false; return; }
    const t=(i/(count-1))*(_reelDuration||1);
    const canvas=document.createElement('canvas');
    canvas.width=thumbW; canvas.height=thumbH;
    const idx=i;
    const time=t;

    const onSeeked=()=>{
      video.removeEventListener('seeked',onSeeked);
      try{
        const ctx=canvas.getContext('2d');
        ctx.drawImage(video,0,0,thumbW,thumbH);
      }catch(e){}
      canvas.title='Frame @ '+fmtSec(time);
      canvas.onclick=()=>{
        document.querySelectorAll('#frame-strip canvas').forEach(c=>c.classList.remove('selected-frame'));
        canvas.classList.add('selected-frame');
        const slider=document.getElementById('frame-scrubber-slider');
        if(slider) slider.value=Math.round((time/_reelDuration)*1000);
        captureReelFrame(video,time,false);
      };
      strip.appendChild(canvas);
      i++;
      // Small timeout to avoid hammering
      setTimeout(captureNext,80);
    };

    video.addEventListener('seeked',onSeeked);
    video.currentTime=t;
    // Fallback timeout if seeked never fires
    setTimeout(()=>{
      if(strip.children.length<=idx){
        video.removeEventListener('seeked',onSeeked);
        strip.appendChild(canvas);
        i++;
        setTimeout(captureNext,80);
      }
    },600);
  }
  captureNext();
}

function captureReelFrame(video,time,isAuto){
  const canvas=document.getElementById('frame-canvas');
  if(!canvas) return;
  canvas.width=320; canvas.height=569;

  const onSeeked=()=>{
    video.removeEventListener('seeked',onSeeked);
    try{
      const ctx=canvas.getContext('2d');
      ctx.drawImage(video,0,0,320,569);
      _reelCoverDataUrl=canvas.toDataURL('image/jpeg',0.7);
      _reelCoverTime=time;

      // Update scrubber time display
      const ctEl=document.getElementById('frame-current-time');
      if(ctEl) ctEl.textContent=fmtSec(time);

      // Update hidden cover field
      const covEl=document.getElementById('social-post-cover');
      if(covEl) covEl.value='Frame @ '+fmtSec(time);

      // Show cover preview
      const coverWrap=document.getElementById('cover-preview-wrap');
      const coverImg=document.getElementById('cover-preview-img');
      const coverTimeEl=document.getElementById('cover-preview-time');
      if(coverWrap) coverWrap.style.display='flex';
      if(coverImg) coverImg.src=_reelCoverDataUrl;
      if(coverTimeEl) coverTimeEl.textContent='Frame @ '+fmtSec(time);

      updateInstagramPreviewCover();
    }catch(e){ console.warn('captureReelFrame error',e); }
  };

  video.addEventListener('seeked',onSeeked);
  video.currentTime=time;
  // Fallback in case seeked doesn't fire
  setTimeout(()=>{
    if(video.currentTime!==time||Math.abs(video.currentTime-time)>0.5){
      video.removeEventListener('seeked',onSeeked);
      // try anyway
      try{
        const ctx=canvas.getContext('2d');
        ctx.drawImage(video,0,0,320,569);
        _reelCoverDataUrl=canvas.toDataURL('image/jpeg',0.7);
        _reelCoverTime=time;
        updateInstagramPreviewCover();
      }catch(e){}
    }
  },700);
}

function scrubToFrame(val){
  if(!_reelDuration) return;
  const time=(val/1000)*_reelDuration;
  const ctEl=document.getElementById('frame-current-time');
  if(ctEl) ctEl.textContent=fmtSec(time);
  const video=document.getElementById('reel-preview-video');
  if(video) captureReelFrame(video,time,false);
  // Highlight nearest strip thumb
  const strip=document.getElementById('frame-strip');
  if(strip){
    const thumbs=strip.querySelectorAll('canvas');
    const nearest=Math.round((val/1000)*(thumbs.length-1));
    thumbs.forEach((c,i)=>c.classList.toggle('selected-frame',i===nearest));
  }
}

function clearReelUpload(){
  if(_reelObjectUrl){ URL.revokeObjectURL(_reelObjectUrl); _reelObjectUrl=null; }
  _reelCoverDataUrl=null; _reelCoverTime=0; _reelDuration=0;
  _frameStripCapturing=false;
  const vid=document.getElementById('reel-preview-video');
  if(vid) vid.src='';
  const zone=document.getElementById('reel-upload-zone');
  const wrap=document.getElementById('reel-video-wrap');
  const scrubWrap=document.getElementById('frame-scrubber-wrap');
  const strip=document.getElementById('frame-strip');
  const fi=document.getElementById('reel-file-input');
  if(zone) zone.style.display='block';
  if(wrap) wrap.style.display='none';
  if(scrubWrap) scrubWrap.style.display='none';
  if(strip) strip.innerHTML='';
  if(fi) fi.value='';
  // Reset Instagram preview
  const igVid=document.getElementById('ig-preview-video');
  if(igVid){ igVid.src=''; igVid.style.display='none'; }
  const igCover=document.getElementById('ig-preview-cover');
  if(igCover){ igCover.src=''; igCover.style.display='none'; }
  const igPh=document.getElementById('ig-preview-placeholder');
  if(igPh) igPh.style.display='flex';
  const coverWrap=document.getElementById('cover-preview-wrap');
  if(coverWrap) coverWrap.style.display='none';
  // Clear hidden fields
  const covEl=document.getElementById('social-post-cover');
  if(covEl) covEl.value='';
}

function updateInstagramPreviewCover(){
  if(!_reelCoverDataUrl) return;
  const igCover=document.getElementById('ig-preview-cover');
  if(igCover){ igCover.src=_reelCoverDataUrl; igCover.style.display='block'; }
  const igVid=document.getElementById('ig-preview-video');
  if(igVid){ igVid.pause(); igVid.style.display='none'; }
  // Reset play button — cover frame is showing, not the video
  const playIcon=document.getElementById('ig-play-icon');
  const pauseIcon=document.getElementById('ig-pause-icon');
  const igOverlay=document.getElementById('ig-play-overlay');
  if(playIcon) playIcon.style.display='block';
  if(pauseIcon) pauseIcon.style.display='none';
  if(igOverlay) igOverlay.style.opacity='1';
  const igPh=document.getElementById('ig-preview-placeholder');
  if(igPh) igPh.style.display='none';
}

function updateInstagramPreview(){
  // Account name — from active workspace igHandle
  const accountEl=document.getElementById('ig-header-account');
  if(accountEl){
    const ws=_socialActiveWorkspace?socialWorkspacesLoad().find(w=>w.id===_socialActiveWorkspace):null;
    const handle=ws?.igHandle||'dronehubmedia';
    accountEl.textContent='@'+handle;
  }

  // Address
  const addr=(document.getElementById('social-post-address')?.value||'').trim();
  const addrEl=document.getElementById('ig-header-address');
  if(addrEl) addrEl.textContent=addr?''+addr.substring(0,30)+(addr.length>30?'…':''):'';

  // Caption
  const caption=(document.getElementById('social-post-content')?.value||'').trim();
  const capEl=document.getElementById('ig-caption-preview');
  if(capEl) capEl.textContent=caption?caption.substring(0,60)+(caption.length>60?'…':''):'Caption will appear here…';

  // Hashtags
  const tags=(document.getElementById('social-post-hashtags')?.value||'').trim();
  const tagEl=document.getElementById('ig-hashtag-preview');
  if(tagEl) tagEl.textContent=tags?tags.substring(0,50)+(tags.length>50?'…':''):'';

  // Overlay text
  const overlay=(document.getElementById('social-post-overlay')?.value||'').trim();
  const ovEl=document.getElementById('ig-overlay-text-preview');
  if(ovEl){ ovEl.textContent=overlay; ovEl.style.display=overlay?'block':'none'; }

  // Song
  const song=(document.getElementById('social-post-song')?.value||'').trim();
  const songEl=document.getElementById('ig-song-preview');
  if(songEl) songEl.textContent=song||'Song name';
}

// Live preview of IG handle while typing in workspace modal
function igUpdateHandlePreview(){
  const val=(document.getElementById('social-ws-ig-handle')?.value||'').trim().replace(/^@/,'');
  const accountEl=document.getElementById('ig-header-account');
  if(accountEl) accountEl.textContent='@'+(val||'dronehubmedia');
}

// Toggle play/pause on the mockup video
function igTogglePlay(){
  const vid=document.getElementById('ig-preview-video');
  if(!vid||vid.style.display==='none') return;
  const playIcon=document.getElementById('ig-play-icon');
  const pauseIcon=document.getElementById('ig-pause-icon');
  const overlay=document.getElementById('ig-play-overlay');
  if(vid.paused){
    vid.play().then(()=>{
      if(playIcon) playIcon.style.display='none';
      if(pauseIcon) pauseIcon.style.display='block';
      // Fade out overlay after 1.5s when playing
      if(overlay) { overlay.style.opacity='0'; setTimeout(()=>{ if(!vid.paused) overlay.style.opacity='0'; },1500); }
    }).catch(()=>{});
  } else {
    vid.pause();
    if(playIcon) playIcon.style.display='block';
    if(pauseIcon) pauseIcon.style.display='none';
    if(overlay) overlay.style.opacity='1';
  }
}

// Show play overlay on hover when playing
(function(){
  document.addEventListener('DOMContentLoaded',()=>{
    const wrap=document.getElementById('ig-preview-video-wrap');
    const overlay=document.getElementById('ig-play-overlay');
    const vid=document.getElementById('ig-preview-video');
    if(!wrap||!overlay||!vid) return;
    wrap.addEventListener('mouseenter',()=>{ overlay.style.opacity='1'; });
    wrap.addEventListener('mouseleave',()=>{ if(!vid.paused) overlay.style.opacity='0'; });
    vid.addEventListener('ended',()=>{
      const playIcon=document.getElementById('ig-play-icon');
      const pauseIcon=document.getElementById('ig-pause-icon');
      if(playIcon) playIcon.style.display='block';
      if(pauseIcon) pauseIcon.style.display='none';
      if(overlay) overlay.style.opacity='1';
    });
  });
})();

// ── Platform spec pre-check
function updateSocialPlatformSpecs(){
  const len=(document.getElementById('social-post-content')?.value||'').length;
  const sel=SOCIAL_PLATFORMS.filter(p=>document.getElementById('social-plt-'+p.id)?.checked).map(p=>p.id);
  const specEl=document.getElementById('social-platform-specs');
  if(!specEl) return;
  if(sel.length===0){ specEl.innerHTML=''; return; }
  const checks=sel.map(pid=>{ const spec=PLATFORM_SPECS[pid]; if(!spec) return ''; const ok=len<=spec.maxChars; return `<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:${ok?'rgba(34,217,122,.08)':'rgba(255,112,112,.1)'};color:${ok?'#22D97A':'#FF7070'}">${spec.label} (${len}) ${ok?'✓':'⚠'}</span>`; }).join('');
  specEl.innerHTML=`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:7px">${checks}</div>`;
}

// Live First Comment Preview — updates as user types hashtags/overlay
function updateSocialFirstCommentPreview(){
  const tags=(document.getElementById('social-post-hashtags')?.value||'').trim();
  const overlay=(document.getElementById('social-post-overlay')?.value||'').trim();
  const wrap=document.getElementById('social-first-comment-preview-wrap');
  const el=document.getElementById('social-first-comment-preview');
  if(!wrap||!el) return;
  const parts=[];
  if(tags) parts.push(tags.replace(/\s+#/g,'\n#').replace(/^#+/,'#'));
  if(overlay){ parts.push(''); parts.push(overlay); }
  const text=parts.join('\n');
  if(!text){ wrap.style.display='none'; return; }
  wrap.style.display='block';
  el.textContent=text;
}

// ── Calendar Labels ────────────────────────────────────────────────────────────────────────────────
let _socialLabelNewColor=SOCIAL_LABEL_COLORS[0];
function openSocialLabelModal(){
  if(!_socialActiveWorkspace){ alert('Select a workspace first'); return; }
  renderSocialLabelList();
  // build new-label color picker
  const pick=document.getElementById('social-label-new-color-pick');
  if(pick) pick.innerHTML=SOCIAL_LABEL_COLORS.map(c=>`<span onclick="_socialLabelNewColor='${c}';openSocialLabelModal()" title="${c}" style="display:inline-block;width:22px;height:22px;border-radius:50%;background:${c};cursor:pointer;flex-shrink:0;border:2px solid ${_socialLabelNewColor===c?'#fff':'transparent'};box-shadow:${_socialLabelNewColor===c?'0 0 0 1px '+c:'none'};transition:transform .1s" onmouseenter="this.style.transform='scale(1.2)'" onmouseleave="this.style.transform='scale(1)'"></span>`).join('');
  document.getElementById('social-label-modal').style.display='flex';
}
function closeSocialLabelModal(){
  document.getElementById('social-label-modal').style.display='none';
  renderSocialPostsArea();
}
function renderSocialLabelList(){
  const list=document.getElementById('social-label-list');
  if(!list) return;
  const labels=socialLabelsLoad(_socialActiveWorkspace);
  if(!labels.length){ list.innerHTML=`<div style="color:var(--muted);font-size:12px;padding:8px">No labels yet — add one below</div>`; return; }
  list.innerHTML=labels.map((l,i)=>`<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--navy);margin-bottom:6px">
    <span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:${l.color};flex-shrink:0"></span>
    <span style="flex:1;font-size:12px;color:var(--white)">${l.name}</span>
    ${l.date?`<span style="font-size:10px;color:var(--muted);background:var(--navy-lift);border:1px solid var(--border);border-radius:8px;padding:2px 7px;flex-shrink:0">${l.date}</span>`:''}
    <button onclick="deleteSocialLabel(${i})" style="background:none;border:none;color:#FF7070;font-size:14px;cursor:pointer;padding:0 4px">×</button>
  </div>`).join('');
}
function addSocialLabel(){
  const name=document.getElementById('social-label-new-name')?.value.trim();
  if(!name){ alert('Label name required'); return; }
  const date=document.getElementById('social-label-new-date')?.value||'';
  const labels=socialLabelsLoad(_socialActiveWorkspace);
  labels.push({id:'lbl_'+Date.now(),name,color:_socialLabelNewColor,date:date||undefined});
  socialLabelsSave(_socialActiveWorkspace,labels);
  document.getElementById('social-label-new-name').value='';
  const dateEl=document.getElementById('social-label-new-date');
  if(dateEl) dateEl.value='';
  renderSocialLabelList();
  if(document.getElementById('social-sub-calendar')?.style.display!=='none') renderSocialCalendar();
}
function deleteSocialLabel(idx){
  const labels=socialLabelsLoad(_socialActiveWorkspace);
  labels.splice(idx,1);
  socialLabelsSave(_socialActiveWorkspace,labels);
  renderSocialLabelList();
  if(document.getElementById('social-sub-calendar')?.style.display!=='none') renderSocialCalendar();
}

