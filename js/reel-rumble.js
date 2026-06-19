// ─── REEL RUMBLE — Weekly editor video competition ──────────────────────────

let _rrWeek = null;       // current week key, e.g. "2026-W25"
let _rrData = null;       // {submissions:[], votes:{}} for current week
let _rrHistory = null;    // past weeks cache

function _rrCurrentWeek(){
  const d=new Date();
  const jan1=new Date(d.getFullYear(),0,1);
  const days=Math.floor((d-jan1)/(86400000));
  const wn=Math.ceil((days+jan1.getDay()+1)/7);
  return d.getFullYear()+'-W'+(wn<10?'0':'')+wn;
}

function _rrWeekLabel(wk){
  const [y,w]=wk.split('-W');
  const jan1=new Date(Number(y),0,1);
  const dayOffset=(jan1.getDay()<=4?jan1.getDay()-1:jan1.getDay()-8);
  const mon=new Date(jan1);
  mon.setDate(jan1.getDate()+(Number(w)-1)*7-dayOffset);
  const sun=new Date(mon); sun.setDate(mon.getDate()+6);
  const fmt=d=>d.toLocaleDateString('en-CA',{month:'short',day:'numeric'});
  return fmt(mon)+' – '+fmt(sun)+', '+y;
}

function _rrPhase(){
  const dow=new Date().getDay();
  return dow>=1 && dow<=5 ? 'submit' : 'vote';
}

function _rrMe(){
  const s=typeof gateGetSession==='function'?gateGetSession():null;
  return s?.email?.toLowerCase()||null;
}

function _rrMyName(){
  const s=typeof gateGetSession==='function'?gateGetSession():null;
  if(s?.name) return s.name;
  const me=_rrMe();
  if(!me) return 'Unknown';
  const members=typeof getAdminTeamMembers==='function'?getAdminTeamMembers():[];
  const m=members.find(m=>(m.email||'').toLowerCase()===me);
  return m?.name||me.split('@')[0];
}

function _rrFbKey(wk){ return ORG_ID+':reel_rumble_'+wk; }

async function _rrLoad(wk){
  _rrWeek=wk||_rrCurrentWeek();
  const cached=localStorage.getItem('rr_'+_rrWeek);
  _rrData=cached?JSON.parse(cached):{submissions:[],votes:{}};
  if(_fbToken()){
    try{
      const fb=await fbGet('orgs',_rrFbKey(_rrWeek));
      if(fb?.data){
        _rrData=JSON.parse(fb.data);
        localStorage.setItem('rr_'+_rrWeek,JSON.stringify(_rrData));
      }
    }catch(e){}
  }
}

async function _rrSave(){
  localStorage.setItem('rr_'+_rrWeek,JSON.stringify(_rrData));
  if(_fbToken()){
    try{ await fbSet('orgs',_rrFbKey(_rrWeek),{data:JSON.stringify(_rrData),updatedAt:Date.now()}); }catch(e){}
  }
}

function _rrDetectPlatform(url){
  if(/youtu\.?be/i.test(url)) return 'youtube';
  if(/drive\.google/i.test(url)) return 'gdrive';
  if(/vimeo/i.test(url)) return 'vimeo';
  return 'link';
}

function _rrExtractYoutubeId(url){
  const m=url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/v\/)([a-zA-Z0-9_-]{11})/);
  return m?m[1]:null;
}

function _rrExtractDriveId(url){
  const m=url.match(/\/d\/([a-zA-Z0-9_-]+)/)||url.match(/id=([a-zA-Z0-9_-]+)/);
  return m?m[1]:null;
}

function _rrEmbedHtml(url, platform){
  if(platform==='youtube'){
    const vid=_rrExtractYoutubeId(url);
    if(vid) return `<iframe src="https://www.youtube.com/embed/${vid}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:10px" allowfullscreen></iframe>`;
  }
  if(platform==='gdrive'){
    const fid=_rrExtractDriveId(url);
    if(fid) return `<iframe src="https://drive.google.com/file/d/${fid}/preview" style="width:100%;aspect-ratio:16/9;border:none;border-radius:10px" allow="autoplay"></iframe>`;
  }
  if(platform==='vimeo'){
    const m=url.match(/vimeo\.com\/(\d+)/);
    if(m) return `<iframe src="https://player.vimeo.com/video/${m[1]}" style="width:100%;aspect-ratio:16/9;border:none;border-radius:10px" allowfullscreen></iframe>`;
  }
  return `<a href="${url}" target="_blank" rel="noopener" style="color:var(--blue-bright);word-break:break-all">${url}</a>`;
}

function _rrGetVoteCounts(){
  const counts={};
  if(!_rrData?.votes) return counts;
  Object.values(_rrData.votes).forEach(email=>{
    counts[email]=(counts[email]||0)+1;
  });
  return counts;
}

function _rrGetWinner(){
  const counts=_rrGetVoteCounts();
  let max=0, winner=null;
  Object.entries(counts).forEach(([email,n])=>{
    if(n>max){max=n;winner=email;}
  });
  return winner&&max>0?{email:winner,votes:max}:null;
}

function setTeamSubtab(tab){
  const membersView=document.getElementById('team-view-members');
  const rumbleView=document.getElementById('team-view-rumble');
  const btnMembers=document.getElementById('team-subtab-members');
  const btnRumble=document.getElementById('team-subtab-rumble');
  const addBtn=document.getElementById('team-add-btn');
  if(tab==='rumble'){
    if(membersView) membersView.style.display='none';
    if(rumbleView) rumbleView.style.display='block';
    if(btnMembers){btnMembers.style.color='var(--muted)';btnMembers.style.borderBottomColor='transparent';btnMembers.style.fontWeight='600';}
    if(btnRumble){btnRumble.style.color='var(--blue-bright)';btnRumble.style.borderBottomColor='var(--blue-bright)';btnRumble.style.fontWeight='700';}
    if(addBtn) addBtn.style.display='none';
    renderReelRumble();
  } else {
    if(membersView) membersView.style.display='block';
    if(rumbleView) rumbleView.style.display='none';
    if(btnMembers){btnMembers.style.color='var(--blue-bright)';btnMembers.style.borderBottomColor='var(--blue-bright)';btnMembers.style.fontWeight='700';}
    if(btnRumble){btnRumble.style.color='var(--muted)';btnRumble.style.borderBottomColor='transparent';btnRumble.style.fontWeight='600';}
    if(addBtn) addBtn.style.display='';
  }
}

async function renderReelRumble(){
  const root=document.getElementById('reel-rumble-root');
  if(!root) return;
  root.innerHTML='<div style="text-align:center;padding:40px;color:var(--muted)">Loading…</div>';

  await _rrLoad();
  const me=_rrMe();
  const phase=_rrPhase();
  const members=typeof getAdminTeamMembers==='function'?getAdminTeamMembers():[];
  const mySubmission=_rrData.submissions.find(s=>s.email===me);
  const voteCounts=_rrGetVoteCounts();
  const myVote=me?_rrData.votes?.[me]:null;
  const winner=_rrGetWinner();
  const isCurrentWeek=_rrWeek===_rrCurrentWeek();

  const phaseLabel=isCurrentWeek
    ?(phase==='submit'
      ?'<span style="color:var(--green);font-weight:700">Submissions Open</span> <span style="color:var(--muted);font-size:11px">(Mon–Fri)</span>'
      :'<span style="color:var(--amber);font-weight:700">Voting Open</span> <span style="color:var(--muted);font-size:11px">(Sat–Sun)</span>')
    :(winner
      ?`<span style="color:var(--amber);font-weight:700">Winner: ${_rrMemberName(winner.email, members)}</span>`
      :'<span style="color:var(--muted)">Completed</span>');

  let html=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;flex-wrap:wrap;gap:10px">
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--white);display:flex;align-items:center;gap:8px">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
          Reel Rumble
        </div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">Week of ${_rrWeekLabel(_rrWeek)} · ${phaseLabel}</div>
      </div>
      <div style="display:flex;gap:6px">
        <button onclick="_rrNavWeek(-1)" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:12px;cursor:pointer">← Prev</button>
        ${!isCurrentWeek?`<button onclick="_rrNavWeek(0)" style="padding:6px 12px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">This Week</button>`:''}
        <button onclick="_rrNavWeek(1)" style="padding:6px 12px;border-radius:8px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:12px;cursor:pointer">Next →</button>
      </div>
    </div>`;

  // Submit form (only during submit phase on current week)
  if(isCurrentWeek && phase==='submit' && !mySubmission){
    html+=`
    <div class="card" style="margin-bottom:18px;background:linear-gradient(135deg,rgba(34,217,122,.06),rgba(91,141,239,.06));border-color:rgba(34,217,122,.3)">
      <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:10px;display:flex;align-items:center;gap:7px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Submit Your Reel
      </div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:12px">Paste a YouTube or Google Drive link to your best edit this week. One submission per person.</div>
      <input id="rr-url" type="url" placeholder="https://youtu.be/... or https://drive.google.com/..."
        style="width:100%;padding:10px 14px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);font-family:var(--font);margin-bottom:8px;box-sizing:border-box">
      <input id="rr-title" type="text" placeholder="Video title / project name"
        style="width:100%;padding:10px 14px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);font-family:var(--font);margin-bottom:8px;box-sizing:border-box">
      <textarea id="rr-desc" placeholder="Brief description (optional)" rows="2"
        style="width:100%;padding:10px 14px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);font-family:var(--font);resize:vertical;margin-bottom:10px;box-sizing:border-box"></textarea>
      <button onclick="rrSubmit()" style="padding:9px 24px;border-radius:10px;border:1px solid var(--green);background:rgba(34,217,122,.12);color:var(--green);font-size:13px;font-weight:700;cursor:pointer">Submit Reel</button>
      <span id="rr-submit-msg" style="font-size:11px;color:var(--red);margin-left:10px"></span>
    </div>`;
  } else if(isCurrentWeek && phase==='submit' && mySubmission){
    html+=`
    <div class="card" style="margin-bottom:18px;border-color:rgba(34,217,122,.3)">
      <div style="font-size:12px;color:var(--green);font-weight:700;margin-bottom:4px">✓ Your reel is submitted!</div>
      <div style="font-size:12px;color:var(--muted)">Voting opens Saturday. You can update your submission below.</div>
    </div>`;
  }

  // Submissions grid
  if(_rrData.submissions.length===0){
    html+=`<div style="text-align:center;padding:50px 20px;color:var(--muted)">
      <div style="font-size:40px;margin-bottom:12px;opacity:.3">🎬</div>
      <div style="font-size:14px;font-weight:600;color:var(--offwhite);margin-bottom:6px">No submissions yet</div>
      <div style="font-size:12px">${isCurrentWeek&&phase==='submit'?'Be the first to submit your reel this week!':'No reels were submitted this week.'}</div>
    </div>`;
  } else {
    // Sort: winner first, then by votes desc
    const sorted=[..._rrData.submissions].sort((a,b)=>{
      const va=voteCounts[a.email]||0, vb=voteCounts[b.email]||0;
      return vb-va;
    });

    html+=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:14px">`;
    sorted.forEach(sub=>{
      const platform=_rrDetectPlatform(sub.url);
      const vc=voteCounts[sub.email]||0;
      const isWinner=winner&&winner.email===sub.email&&!isCurrentWeek;
      const isMine=sub.email===me;
      const hasVoted=myVote===sub.email;
      const canVote=isCurrentWeek&&phase==='vote'&&!isMine&&!myVote;
      const memberName=_rrMemberName(sub.email, members);

      html+=`<div class="card" style="padding:0;overflow:hidden;${isWinner?'border-color:var(--amber);box-shadow:0 0 20px rgba(245,158,11,.15)':''}">
        <div style="position:relative">
          ${_rrEmbedHtml(sub.url, platform)}
          ${isWinner?'<div style="position:absolute;top:10px;right:10px;background:var(--amber);color:#000;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:800;display:flex;align-items:center;gap:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Winner</div>':''}
        </div>
        <div style="padding:12px 14px">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            ${typeof getAvatarHtml==='function'?getAvatarHtml(memberName,sub.email,28,10):''}
            <div>
              <div style="font-size:13px;font-weight:700;color:var(--white)">${memberName}${isMine?' <span style="font-size:10px;color:var(--blue-bright)">(You)</span>':''}</div>
              <div style="font-size:10px;color:var(--muted)">${sub.title||'Untitled'}</div>
            </div>
          </div>
          ${sub.desc?`<div style="font-size:11px;color:var(--muted);margin-bottom:8px;line-height:1.5">${sub.desc}</div>`:''}
          <div style="display:flex;align-items:center;justify-content:space-between;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
            <div style="font-size:12px;color:var(--muted);display:flex;align-items:center;gap:4px">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="${vc>0?'var(--amber)':'none'}" stroke="${vc>0?'var(--amber)':'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <span style="font-weight:700;color:${vc>0?'var(--amber)':'var(--muted)'}">${vc}</span> vote${vc!==1?'s':''}
            </div>
            ${canVote?`<button onclick="rrVote('${sub.email}')" style="padding:5px 16px;border-radius:8px;border:1px solid var(--amber);background:rgba(245,158,11,.1);color:var(--amber);font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> Vote</button>`:''}
            ${hasVoted?'<span style="font-size:11px;color:var(--green);font-weight:700">✓ Your vote</span>':''}
            ${isMine&&isCurrentWeek&&phase==='submit'?`<button onclick="rrEditSubmission()" style="padding:5px 14px;border-radius:8px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:11px;cursor:pointer">Edit</button>`:''}
          </div>
        </div>
      </div>`;
    });
    html+=`</div>`;
  }

  // Hall of Fame
  html+=await _rrHallOfFame();

  root.innerHTML=html;
}

function _rrMemberName(email, members){
  if(!members) members=typeof getAdminTeamMembers==='function'?getAdminTeamMembers():[];
  const m=members.find(m=>(m.email||'').toLowerCase()===email);
  return m?.name||email.split('@')[0];
}

async function rrSubmit(){
  const url=(document.getElementById('rr-url')?.value||'').trim();
  const title=(document.getElementById('rr-title')?.value||'').trim();
  const desc=(document.getElementById('rr-desc')?.value||'').trim();
  const msg=document.getElementById('rr-submit-msg');
  if(!url){if(msg)msg.textContent='Please paste a video link.';return;}
  const platform=_rrDetectPlatform(url);
  if(platform==='link'){if(msg)msg.textContent='Please use a YouTube, Google Drive, or Vimeo link.';return;}
  const me=_rrMe();
  if(!me){if(msg)msg.textContent='You must be signed in.';return;}

  const existing=_rrData.submissions.findIndex(s=>s.email===me);
  const entry={email:me,name:_rrMyName(),url,title,desc,platform,submittedAt:new Date().toISOString()};
  if(existing>=0) _rrData.submissions[existing]=entry;
  else _rrData.submissions.push(entry);

  await _rrSave();
  if(typeof showDhToast==='function') showDhToast('Reel submitted!','Your video has been entered into this week\'s Reel Rumble.','🎬','var(--green)');
  renderReelRumble();
}

async function rrVote(forEmail){
  const me=_rrMe();
  if(!me) return;
  if(forEmail===me) return;
  if(_rrData.votes[me]){
    if(typeof showDhToast==='function') showDhToast('Already voted','You\'ve already cast your vote this week.','⚠️','var(--amber)');
    return;
  }
  _rrData.votes[me]=forEmail;
  await _rrSave();
  if(typeof showDhToast==='function') showDhToast('Vote cast!','Thanks for voting in this week\'s Reel Rumble.','⭐','var(--amber)');
  renderReelRumble();
}

function rrEditSubmission(){
  const me=_rrMe();
  const sub=_rrData.submissions.find(s=>s.email===me);
  if(!sub) return;
  _rrData.submissions=_rrData.submissions.filter(s=>s.email!==me);
  _rrSave().then(()=>renderReelRumble()).then(()=>{
    const urlEl=document.getElementById('rr-url');
    const titleEl=document.getElementById('rr-title');
    const descEl=document.getElementById('rr-desc');
    if(urlEl) urlEl.value=sub.url;
    if(titleEl) titleEl.value=sub.title||'';
    if(descEl) descEl.value=sub.desc||'';
  });
}

async function _rrNavWeek(dir){
  if(dir===0){
    await _rrLoad(_rrCurrentWeek());
    renderReelRumble();
    return;
  }
  const [y,w]=_rrWeek.split('-W').map(Number);
  let ny=y, nw=w+dir;
  if(nw<1){ny--;nw=52;}
  if(nw>52){ny++;nw=1;}
  const newWeek=ny+'-W'+(nw<10?'0':'')+nw;
  await _rrLoad(newWeek);
  renderReelRumble();
}

async function _rrHallOfFame(){
  const current=_rrCurrentWeek();
  const [cy,cw]=current.split('-W').map(Number);
  let winners=[];
  for(let i=1;i<=8;i++){
    let wy=cy, ww=cw-i;
    if(ww<1){wy--;ww+=52;}
    const wk=wy+'-W'+(ww<10?'0':'')+ww;
    const cached=localStorage.getItem('rr_'+wk);
    if(cached){
      const data=JSON.parse(cached);
      if(data.submissions?.length>0){
        const counts={};
        Object.values(data.votes||{}).forEach(e=>{counts[e]=(counts[e]||0)+1;});
        let max=0,win=null;
        Object.entries(counts).forEach(([e,n])=>{if(n>max){max=n;win=e;}});
        if(win) winners.push({week:wk,email:win,votes:max,title:data.submissions.find(s=>s.email===win)?.title||''});
      }
    }
  }
  if(winners.length===0) return '';

  const members=typeof getAdminTeamMembers==='function'?getAdminTeamMembers():[];
  let html=`
  <div style="margin-top:28px">
    <div style="font-size:14px;font-weight:700;color:var(--white);margin-bottom:12px;display:flex;align-items:center;gap:8px">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
      Hall of Fame
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">`;

  winners.forEach(w=>{
    const name=_rrMemberName(w.email, members);
    html+=`<div class="card" style="padding:10px 14px;cursor:pointer" onclick="_rrNavWeek(0);_rrLoad('${w.week}').then(()=>renderReelRumble())">
      <div style="font-size:10px;color:var(--muted);margin-bottom:4px">${_rrWeekLabel(w.week)}</div>
      <div style="display:flex;align-items:center;gap:6px">
        ${typeof getAvatarHtml==='function'?getAvatarHtml(name,w.email,24,9):''}
        <div>
          <div style="font-size:12px;font-weight:700;color:var(--amber)">${name}</div>
          <div style="font-size:10px;color:var(--muted)">${w.title} · ${w.votes} vote${w.votes!==1?'s':''}</div>
        </div>
      </div>
    </div>`;
  });

  html+=`</div></div>`;
  return html;
}
