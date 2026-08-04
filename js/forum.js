/* ══════════════════════════════════════════════════════════════════
   COMMUNITY FORUM — Reddit-style feedback board
   Team (ops app) + clients (portal) share one board: post ideas,
   show work, upvote, comment. Admins pin, delete, and set status
   on feature requests (Considering / Planned / Shipped).
   Storage: localStorage 'dronehub_forum' + Firebase orgs ORG_ID:forum
   ══════════════════════════════════════════════════════════════════ */

const FORUM_CATS = [
  {id:'feature',  label:'Suggestions',    color:'#5B8DEF', bg:'rgba(91,141,239,.14)'},
  {id:'work',     label:'Show Your Work', color:'#22D97A', bg:'rgba(34,217,122,.14)'},
  {id:'question', label:'Questions',      color:'#A78BFA', bg:'rgba(167,139,250,.14)'},
  {id:'announce', label:'Announcements',  color:'#F5C842', bg:'rgba(245,200,66,.14)', adminPost:true},
  {id:'general',  label:'General',        color:'#F5A623', bg:'rgba(245,166,35,.14)'},
];
const FORUM_STATUSES = [
  {id:'',            label:'No status',   color:'var(--muted)'},
  {id:'considering', label:'Considering', color:'#F5C842'},
  {id:'planned',     label:'Planned',     color:'#5B8DEF'},
  {id:'inprogress',  label:'In Progress', color:'#F5A623'},
  {id:'shipped',     label:'Shipped',     color:'#22D97A'},
];
const FORUM_Q_STATUSES = [
  {id:'',         label:'Unanswered', color:'var(--muted)'},
  {id:'answered', label:'Answered',   color:'#22D97A'},
];
function _frStatusMeta(id){ return [...FORUM_STATUSES,...FORUM_Q_STATUSES].find(x=>x.id===(id||''))||FORUM_STATUSES[0]; }
// Mini pipeline for suggestion posts: Submitted → … → Shipped
function _frPipelineHtml(p){
  if(p.category!=='feature') return '';
  const steps=[['','Submitted'],['considering','Considering'],['planned','Planned'],['inprogress','In Progress'],['shipped','Shipped']];
  const cur=Math.max(steps.findIndex(x=>x[0]===(p.status||'')),0);
  return `<div class="fr-pipe">${steps.map((st,i)=>{
    const done=i<=cur&&(cur>0||i===0);
    const col=i===cur&&cur>0?_frStatusMeta(st[0]).color:'var(--blue)';
    return `${i?`<div class="fr-pipe-line${i<=cur?' on':''}"></div>`:''}
      <div class="fr-pipe-step${done?' on':''}${i===cur?' now':''}" ${i===cur&&cur>0?`style="--pc:${_frStatusMeta(st[0]).color}"`:''}>
        <span class="fr-pipe-dot"></span><span class="fr-pipe-lbl">${st[1]}</span>
      </div>`;
  }).join('')}</div>`;
}

let _forumSort='hot';      // hot | new | top
let _forumCat='all';       // all | feature | work | general
let _forumOpenId=null;

// ── Identity: works in the ops app AND the client portal ─────────────────────
function forumMe(){
  try{
    const s=gateGetSession&&gateGetSession();
    if(s?.email) return {name:s.name||s.email,email:s.email.toLowerCase(),role:(s.type==='admin'||s.role==='admin')?'admin':'team'};
  }catch(e){}
  try{
    if(typeof cpActiveClientId!=='undefined'&&cpActiveClientId){
      const c=(typeof clients!=='undefined'?clients:[]).find(x=>String(x.id)===String(cpActiveClientId));
      const sess=JSON.parse(localStorage.getItem('dronehub_cp_session')||'null');
      return {name:sess?.name||c?.name||'Client',email:(sess?.email||c?.email||'client_'+cpActiveClientId).toLowerCase(),role:'client'};
    }
  }catch(e){}
  return null;
}
function forumIsAdmin(){ return forumMe()?.role==='admin'; }

// ── Data layer ───────────────────────────────────────────────────────────────
function forumLoad(){ try{return JSON.parse(localStorage.getItem('dronehub_forum')||'[]');}catch(e){return[];} }
function forumSave(arr){
  try{localStorage.setItem('dronehub_forum',JSON.stringify(arr));}catch(e){}
  if(typeof _fbToken==='function'&&_fbToken()){
    fbSetStrict('orgs',ORG_ID+':forum',{data:JSON.stringify(arr),updatedAt:Date.now()})
      .catch(e=>{ console.error('[forumSave]',e.message); showDhToast('Not synced','Community post saved locally but could not sync.','⚠️','var(--orange)',5000); });
  }
}
async function forumSyncFirebase(){
  if(typeof _fbToken!=='function'||!_fbToken()) return;
  try{
    const fb=await fbGet('orgs',ORG_ID+':forum');
    if(!fb?.data) return;
    const remote=JSON.parse(fb.data);
    const local=forumLoad();
    // Merge by post id — newer editedAt/createdAt wins; union votes/comments
    const byId={};
    [...remote,...local].forEach(p=>{
      const ex=byId[p.id];
      if(!ex){ byId[p.id]=p; return; }
      const newer=(p.editedAt||p.createdAt||'')>(ex.editedAt||ex.createdAt||'')?p:ex;
      const older=newer===p?ex:p;
      // union upvotes + comments so a vote made on another device isn't lost
      newer.upvotes=[...new Set([...(newer.upvotes||[]),...(older.upvotes||[])])];
      const cIds=new Set((newer.comments||[]).map(c=>String(c.id)));
      (older.comments||[]).forEach(c=>{ if(!cIds.has(String(c.id))) (newer.comments=newer.comments||[]).push(c); });
      byId[p.id]=newer;
    });
    const merged=Object.values(byId).filter(p=>!p.deleted);
    localStorage.setItem('dronehub_forum',JSON.stringify(merged));
    try{
      const ff=await fbGet('orgs',ORG_ID+':forum_follows');
      if(ff?.data){
        const remote=JSON.parse(ff.data), local=forumFollowsLoad();
        Object.keys(remote).forEach(k=>{ if(!(k in local)) local[k]=remote[k]; });
        localStorage.setItem('dronehub_forum_follows',JSON.stringify(local));
      }
    }catch(e){}
  }catch(e){}
}

// ── Follows: keep tabs on people's posts + comments ──────────────────────────
function forumFollowsLoad(){ try{return JSON.parse(localStorage.getItem('dronehub_forum_follows')||'{}');}catch(e){return{};} }
function forumFollowsSave(map){
  try{localStorage.setItem('dronehub_forum_follows',JSON.stringify(map));}catch(e){}
  if(typeof _fbToken==='function'&&_fbToken())
    fbSet('orgs',ORG_ID+':forum_follows',{data:JSON.stringify(map),updatedAt:Date.now()}).catch(()=>{});
}
function forumMyFollows(){
  const me=forumMe(); if(!me) return [];
  return forumFollowsLoad()[me.email]||[];
}
function forumToggleFollow(email){
  const me=forumMe(); if(!me) return;
  const map=forumFollowsLoad();
  const mine=map[me.email]||[];
  const i=mine.indexOf(email);
  if(i>-1) mine.splice(i,1); else mine.push(email);
  map[me.email]=mine;
  forumFollowsSave(map);
  const root=document.querySelector('#fr-rail')?.closest('[id]');
  renderForum(root?.id||'forum-root');
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function _frEsc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
// Pull the first YouTube video id out of a block of text (watch/youtu.be/shorts/embed links)
function _frYtId(text){
  const m=String(text||'').match(/(?:youtube\.com\/(?:watch\?[^\s]*?v=|shorts\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  return m?m[1]:null;
}
// Escape, then turn bare URLs into clickable links
function _frRich(text){
  const linked=_frEsc(text).replace(/(https?:\/\/[^\s<]+)/g,'<a href="$1" target="_blank" rel="noopener" style="color:var(--blue-bright);word-break:break-all" onclick="event.stopPropagation()">$1</a>');
  return _frMentions(linked);
}
// Everyone taggable: team members + clients + me
function _frPeople(){
  const out=[],seen=new Set();
  const add=(name,role)=>{ if(name&&!seen.has(name.toLowerCase())){seen.add(name.toLowerCase());out.push({name,role});} };
  try{ (getAdminTeamMembers()||[]).forEach(m=>add(m.name,'team')); }catch(e){}
  try{ (typeof clients!=='undefined'?clients:[]).forEach(c=>add(c.name,'client')); }catch(e){}
  const me=forumMe(); if(me) add(me.name,me.role);
  return out;
}
// Highlight @Name tokens (longest names first so "Katrina Barrett" wins over "Katrina")
function _frMentions(html){
  const people=_frPeople().sort((a,b)=>b.name.length-a.name.length);
  people.forEach(p=>{
    const esc=p.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    html=html.replace(new RegExp('@('+esc+'|'+esc.split(' ')[0]+')(?![\\w])','gi'),
      '<span style="color:var(--blue-bright);font-weight:700;background:rgba(91,141,239,.12);border-radius:6px;padding:0 4px">@$1</span>');
  });
  return html;
}
function _frFindMentioned(text){
  const t=String(text||'').toLowerCase();
  return _frPeople().filter(p=>{
    const full='@'+p.name.toLowerCase();
    const first='@'+p.name.split(' ')[0].toLowerCase();
    return t.includes(full)||t.includes(first);
  });
}
// @-autocomplete on an input/textarea — shows a small dropdown of matches
function _frMentionInput(el){
  let dd=document.getElementById('fr-mention-dd');
  const val=el.value.slice(0,el.selectionStart??el.value.length);
  const m=val.match(/@([A-Za-z]{1,20})$/);
  if(!m){ dd?.remove(); return; }
  const q=m[1].toLowerCase();
  const hits=_frPeople().filter(p=>p.name.toLowerCase().startsWith(q)||p.name.split(' ')[0].toLowerCase().startsWith(q)).slice(0,5);
  if(!hits.length){ dd?.remove(); return; }
  if(!dd){
    dd=document.createElement('div');
    dd.id='fr-mention-dd';
    dd.style.cssText='position:fixed;background:var(--navy-card);border:1px solid var(--border-bright);border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.5);z-index:99999;overflow:hidden;min-width:200px';
    document.body.appendChild(dd);
  }
  const r=el.getBoundingClientRect();
  const above=r.bottom>window.innerHeight-180;
  dd.style.left=Math.min(r.left,window.innerWidth-220)+'px';
  if(above){ dd.style.bottom=(window.innerHeight-r.top+6)+'px'; dd.style.top='auto'; }
  else { dd.style.top=(r.bottom+6)+'px'; dd.style.bottom='auto'; }
  dd.innerHTML=hits.map(h=>`<div onmousedown="event.preventDefault();_frMentionPick('${el.id}','${h.name.replace(/'/g,"\\'")}')" style="padding:10px 14px;font-size:13.5px;font-weight:600;color:var(--white);cursor:pointer;display:flex;align-items:center;gap:8px" onmouseenter="this.style.background='rgba(91,141,239,.12)'" onmouseleave="this.style.background=''">${h.name} ${_frRoleTag(h.role)}</div>`).join('');
}
function _frMentionPick(elId,name){
  const el=document.getElementById(elId); if(!el) return;
  const pos=el.selectionStart??el.value.length;
  const before=el.value.slice(0,pos).replace(/@[A-Za-z]{0,20}$/,'@'+name+' ');
  el.value=before+el.value.slice(pos);
  document.getElementById('fr-mention-dd')?.remove();
  el.focus();
  el.selectionStart=el.selectionEnd=before.length;
}
document.addEventListener('click',e=>{ if(!e.target.closest('#fr-mention-dd')) document.getElementById('fr-mention-dd')?.remove(); });

// Drop a notification in the org feed for each tagged person
function _frNotifyMentions(text,contextTitle){
  const me=forumMe(); if(!me) return;
  _frFindMentioned(text).forEach(p=>{
    if(p.name===me.name) return;
    try{
      if(typeof addSocialNotification==='function')
        addSocialNotification(null,me.name.split(' ')[0]+' tagged '+p.name.split(' ')[0]+' in Community: "'+String(contextTitle||'').slice(0,60)+'"','mention');
    }catch(e){}
  });
}

function _frAgo(iso){
  if(!iso) return '';
  const diff=Date.now()-new Date(iso).getTime();
  if(diff<60000) return 'just now';
  if(diff<3600000) return Math.floor(diff/60000)+'m';
  if(diff<86400000) return Math.floor(diff/3600000)+'h';
  if(diff<2592000000) return Math.floor(diff/86400000)+'d';
  return new Date(iso).toLocaleDateString('en-US',{month:'short',day:'numeric'});
}
function _frHot(p){
  const votes=(p.upvotes||[]).length+(p.comments||[]).length*0.5;
  const ageH=(Date.now()-new Date(p.createdAt).getTime())/3600000;
  return (votes+1)/Math.pow(ageH+2,1.4)+(p.pinned?1e6:0);
}
function _frDesktop(){ return window.innerWidth>768; }
// Mobile: full-page overlay. Desktop: render inline where the feed was.
function _frMount(page,rootId){
  if(_frDesktop()){
    const root=document.getElementById(rootId||'forum-root');
    if(root){ root.innerHTML=''; root.appendChild(page); return; }
  }
  document.body.appendChild(page);
}
function _frRoleTag(role){
  if(role==='admin') return '<span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:7px;background:rgba(91,141,239,.2);color:var(--blue-bright)">TEAM</span>';
  if(role==='team') return '<span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:7px;background:rgba(91,141,239,.2);color:var(--blue-bright)">TEAM</span>';
  return '<span style="font-size:9px;font-weight:800;padding:1px 6px;border-radius:7px;background:rgba(34,217,122,.16);color:var(--green)">CLIENT</span>';
}

// ── List view ────────────────────────────────────────────────────────────────
function renderForum(containerId){
  const root=document.getElementById(containerId||'forum-root');
  if(!root) return;
  forumSyncFirebase().then(()=>{
    // Don't clobber an open composer/post view with the refreshed feed
    if(document.getElementById('fr-compose-page')||document.getElementById('fr-post-page')) return;
    _frRenderList(root);
  });
  _frRenderList(root);
}
function _frRenderList(root){
  const me=forumMe();
  let posts=forumLoad().filter(p=>!p.deleted);
  if(_forumCat!=='all') posts=posts.filter(p=>p.category===_forumCat);
  if(_forumSort==='hot') posts.sort((a,b)=>_frHot(b)-_frHot(a));
  else if(_forumSort==='new') posts.sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
  else posts.sort((a,b)=>((b.pinned?1e6:0)+(b.upvotes||[]).length)-((a.pinned?1e6:0)+(a.upvotes||[]).length));

  const sorts=[['hot','Hot'],['new','New'],['top','Top']];
  const rail=_frDesktop()?_frRailHtml(root.id):'';
  root.innerHTML=`${rail?'<div class="fr-cols"><div class="fr-main">':''}
    <div class="fr-head">
      <div class="fr-title-row">
        <div class="fr-sorts">${sorts.map(([id,l])=>`<button class="fr-sort${_forumSort===id?' on':''}" onclick="_forumSort='${id}';renderForum('${root.id}')">${l}</button>`).join('')}</div>
        <button class="fr-newbtn" onclick="forumOpenComposer('${root.id}')">+ New Post</button>
      </div>
      <div class="fr-cats no-scrollbar">
        <button class="fr-cat${_forumCat==='all'?' on':''}" onclick="_forumCat='all';renderForum('${root.id}')">All</button>
        ${FORUM_CATS.map(c=>`<button class="fr-cat${_forumCat===c.id?' on':''}" style="${_forumCat===c.id?`background:${c.bg};color:${c.color};border-color:${c.color}55`:''}" onclick="_forumCat='${c.id}';renderForum('${root.id}')">${c.label}</button>`).join('')}
      </div>
    </div>
    <div class="fr-list">
      ${posts.length?posts.map(p=>_frCardHtml(p,me,root.id)).join(''):`
        <div style="padding:60px 20px;text-align:center;color:var(--muted)">
          <div style="font-size:34px;margin-bottom:10px">💬</div>
          <div style="font-size:14px;font-weight:700;color:var(--offwhite);margin-bottom:4px">Nothing here yet</div>
          <div style="font-size:12.5px">Start the conversation — request a feature, share your work, or say hi.</div>
        </div>`}
    </div>${rail?'</div>'+rail+'</div>':''}`;
}

// ── Desktop right rail: follows, trending, roadmap ───────────────────────────
function _frRailHtml(rootId){
  const me=forumMe();
  const posts=forumLoad().filter(p=>!p.deleted);
  // distinct people from posts + comments
  const people={};
  const bump=(name,email,role)=>{
    if(!email||!name) return;
    if(me&&email===me.email) return;
    (people[email]=people[email]||{name,email,role,n:0}).n++;
  };
  posts.forEach(p=>{ bump(p.author,p.authorEmail,p.role); (p.comments||[]).forEach(c=>bump(c.author,c.authorEmail,c.role)); });
  const roster=Object.values(people).sort((a,b)=>b.n-a.n).slice(0,8);
  const follows=forumMyFollows();

  // activity by followed people (posts + comments), newest first
  const acts=[];
  posts.forEach(p=>{
    if(follows.includes(p.authorEmail)) acts.push({at:p.createdAt,who:p.author,what:'posted',title:p.title,pid:p.id});
    (p.comments||[]).forEach(c=>{ if(follows.includes(c.authorEmail)) acts.push({at:c.at,who:c.author,what:'commented on',title:p.title,pid:p.id}); });
  });
  acts.sort((x,y)=>new Date(y.at)-new Date(x.at));

  // trending: top upvoted in the last 7 days
  const weekAgo=Date.now()-7*86400000;
  const trend=posts.filter(p=>new Date(p.createdAt)>weekAgo).sort((a,b)=>(b.upvotes||[]).length-(a.upvotes||[]).length).slice(0,3);

  // roadmap: suggestion statuses
  const feat=posts.filter(p=>p.category==='feature');
  const stCount=id=>feat.filter(p=>(p.status||'')===id).length;

  const sec=(title,body)=>`<div class="fr-rail-card"><div class="fr-rail-title">${title}</div>${body}</div>`;
  let html='<aside id="fr-rail">';
  html+=sec('Roadmap',`
    ${[['considering','Considering','#F5C842'],['planned','Planned','#5B8DEF'],['shipped','Shipped','#22D97A']].map(([id,l,col])=>`
      <div class="fr-rail-row" onclick="_forumCat='feature';renderForum('${rootId}')">
        <span class="mca-dot" style="background:${col}"></span><span style="flex:1">${l}</span>
        <span style="color:var(--muted);font-weight:700">${stCount(id)}</span>
      </div>`).join('')}`);
  if(trend.length) html+=sec('Trending this week',trend.map(p=>`
    <div class="fr-rail-row" onclick="forumOpenPost('${p.id}','${rootId}')">
      <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_frEsc(p.title)}</span>
      <span style="color:var(--blue-bright);font-weight:800;font-size:11px">▲ ${(p.upvotes||[]).length}</span>
    </div>`).join(''));
  if(acts.length) html+=sec('Following',acts.slice(0,6).map(a=>`
    <div class="fr-rail-row" onclick="forumOpenPost('${a.pid}','${rootId}')" style="align-items:flex-start">
      <div style="flex:1;min-width:0"><b style="color:var(--white)">${_frEsc(a.who.split(' ')[0])}</b> <span style="color:var(--muted)">${a.what}</span>
      <div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--offwhite)">${_frEsc(a.title)}</div></div>
      <span style="color:var(--muted);font-size:10.5px;flex-shrink:0">${_frAgo(a.at)}</span>
    </div>`).join(''));
  html+=sec('People',roster.length?roster.map(u=>`
    <div class="fr-rail-row" style="cursor:default">
      <div style="flex:1;min-width:0"><div style="color:var(--white);font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${_frEsc(u.name)}</div>
      <div style="font-size:10.5px;color:var(--muted)">${u.n} contribution${u.n===1?'':'s'}</div></div>
      ${_frRoleTag(u.role)}
      <button class="fr-follow${follows.includes(u.email)?' on':''}" onclick="forumToggleFollow('${u.email}')">${follows.includes(u.email)?'Following':'Follow'}</button>
    </div>`).join(''):'<div style="font-size:12px;color:var(--muted);padding:4px 0">People show up here once they post or comment.</div>');
  html+='</aside>';
  return html;
}
function _frCardHtml(p,me,rootId){
  const cat=FORUM_CATS.find(c=>c.id===p.category)||FORUM_CATS[2];
  const st=_frStatusMeta(p.status);
  const votes=(p.upvotes||[]).length;
  const voted=me&&(p.upvotes||[]).includes(me.email);
  const nComments=(p.comments||[]).length;
  return `<div class="fr-card" onclick="forumOpenPost('${p.id}','${rootId}')">
    <button class="fr-vote${voted?' on':''}" onclick="event.stopPropagation();forumVote('${p.id}','${rootId}')">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="${voted?'currentColor':'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l8 12H4z"/></svg>
      <span>${votes}</span>
    </button>
    <div class="fr-card-main">
      <div class="fr-card-meta">
        ${p.pinned?'<span style="color:var(--amber);font-size:11px">📌</span>':''}
        <span class="fr-cat-pill" style="background:${cat.bg};color:${cat.color}">${cat.label}</span>
        ${p.status?`<span class="fr-cat-pill" style="background:${st.color}22;color:${st.color}">${st.label}</span>`:''}
      </div>
      <div class="fr-card-title">${_frEsc(p.title)}</div>
      ${p.body?`<div class="fr-card-snip">${_frEsc(p.body).slice(0,110)}${p.body.length>110?'…':''}</div>`:''}
      ${(()=>{const yt=_frYtId(p.body||'');return yt?`<div class="fr-yt-thumb"><img src="https://i.ytimg.com/vi/${yt}/hqdefault.jpg" alt="" loading="lazy"><span class="fr-yt-play">▶</span></div>`:'';})()}
      <div class="fr-card-sub">${_frEsc(p.author)} ${_frRoleTag(p.role)} · ${_frAgo(p.createdAt)} · ${nComments} comment${nComments===1?'':'s'}</div>
    </div>
  </div>`;
}

// ── Voting ───────────────────────────────────────────────────────────────────
function forumVote(postId,rootId){
  const me=forumMe(); if(!me){showDhToast('Sign in','Sign in to vote','','var(--orange)',2500);return;}
  const posts=forumLoad();
  const p=posts.find(x=>x.id===postId); if(!p) return;
  p.upvotes=p.upvotes||[];
  const i=p.upvotes.indexOf(me.email);
  if(i>-1) p.upvotes.splice(i,1); else p.upvotes.push(me.email);
  p.editedAt=new Date().toISOString();
  forumSave(posts);
  if(_forumOpenId===postId) forumOpenPost(postId,rootId,true);
  else renderForum(rootId);
}
function forumVoteComment(postId,commentId,rootId){
  const me=forumMe(); if(!me) return;
  const posts=forumLoad();
  const p=posts.find(x=>x.id===postId); if(!p) return;
  const c=(p.comments||[]).find(x=>String(x.id)===String(commentId)); if(!c) return;
  c.upvotes=c.upvotes||[];
  const i=c.upvotes.indexOf(me.email);
  if(i>-1) c.upvotes.splice(i,1); else c.upvotes.push(me.email);
  p.editedAt=new Date().toISOString();
  forumSave(posts);
  forumOpenPost(postId,rootId,true);
}

// ── Post detail (full page) ──────────────────────────────────────────────────
function forumOpenPost(postId,rootId,keepScroll){
  const p=forumLoad().find(x=>x.id===postId); if(!p) return;
  _forumOpenId=postId;
  const me=forumMe();
  const admin=forumIsAdmin();
  const cat=FORUM_CATS.find(c=>c.id===p.category)||FORUM_CATS[2];
  const st=_frStatusMeta(p.status);
  const votes=(p.upvotes||[]).length;
  const voted=me&&(p.upvotes||[]).includes(me.email);
  const canDelete=admin||(me&&me.email===p.authorEmail);
  const comments=(p.comments||[]).slice().sort((a,b)=>new Date(a.at)-new Date(b.at));

  let page=document.getElementById('fr-post-page');
  const prevScroll=keepScroll&&page?page.querySelector('.fr-post-body')?.scrollTop:0;
  if(!page){
    page=document.createElement('div');
    page.id='fr-post-page';
    page.className=_frDesktop()?'fr-inline-page':'mc-page';
    _frMount(page,rootId);
  }
  page.dataset.rootId=rootId||'forum-root';
  page.innerHTML=`
    <div class="mc-page-bar">
      <button class="mc-page-back" onclick="forumClosePost()"><svg width="10" height="17" viewBox="0 0 9 15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="8 1 2 7.5 8 14"/></svg></button>
      <div class="mc-page-title">${cat.label}</div>
      ${canDelete?`<button onclick="forumDeletePost('${p.id}')" style="margin-left:auto;border:none;background:none;color:var(--muted);cursor:pointer;padding:6px;position:relative;z-index:2"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`:''}
    </div>
    <div class="fr-post-body">
      <div style="padding:6px 18px 0">
        <div class="fr-card-meta" style="margin-bottom:8px">
          ${p.pinned?'<span style="color:var(--amber)">📌</span>':''}
          <span class="fr-cat-pill" style="background:${cat.bg};color:${cat.color}">${cat.label}</span>
          ${p.status&&st?`<span class="fr-cat-pill" style="background:${st.color}22;color:${st.color}">${st.label}</span>`:''}
        </div>
        <div style="font-size:19px;font-weight:800;color:var(--white);line-height:1.3">${_frEsc(p.title)}</div>
        <div class="fr-card-sub" style="margin-top:6px">${_frEsc(p.author)} ${_frRoleTag(p.role)} · ${_frAgo(p.createdAt)}</div>
        ${_frPipelineHtml(p)}
        ${p.body?`<div style="font-size:14.5px;color:var(--offwhite);line-height:1.55;margin-top:12px;white-space:pre-wrap">${_frRich(p.body)}</div>`:''}
        ${(()=>{const yt=_frYtId(p.body||'');return yt?`<div class="fr-yt-embed"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="YouTube video" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`:'';})()}
        <div style="display:flex;align-items:center;gap:10px;margin-top:16px">
          <button class="fr-vote fr-vote-lg${voted?' on':''}" onclick="forumVote('${p.id}','${page.dataset.rootId}')">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="${voted?'currentColor':'none'}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4l8 12H4z"/></svg>
            <span>${votes} upvote${votes===1?'':'s'}</span>
          </button>
          ${admin?`
          <button class="fr-adminbtn" onclick="forumTogglePin('${p.id}')">${p.pinned?'Unpin':'Pin'}</button>
          ${p.category==='feature'?`<select class="fr-adminbtn" style="appearance:none" onchange="forumSetStatus('${p.id}',this.value)">
            ${FORUM_STATUSES.map(s=>`<option value="${s.id}"${(p.status||'')===s.id?' selected':''}>${s.label}</option>`).join('')}
          </select>`:''}
          ${p.category==='question'?`<select class="fr-adminbtn" style="appearance:none" onchange="forumSetStatus('${p.id}',this.value)">
            ${FORUM_Q_STATUSES.map(s=>`<option value="${s.id}"${(p.status||'')===s.id?' selected':''}>${s.label}</option>`).join('')}
          </select>`:''}`:''}
        </div>
      </div>
      <div style="height:1px;background:var(--border);margin:18px 18px 4px"></div>
      <div style="padding:8px 18px 140px">
        <div style="font-size:12px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">${comments.length} comment${comments.length===1?'':'s'}</div>
        ${comments.map(c=>{
          if(c.isSystem) return `<div style="display:flex;align-items:center;gap:8px;padding:9px 0;font-size:11.5px;color:var(--muted)"><span class="mca-dot" style="background:${_frStatusMeta(c.statusId).color}"></span>${_frEsc(c.text)} · ${_frAgo(c.at)}</div>`;
          const cVotes=(c.upvotes||[]).length;
          const cVoted=me&&(c.upvotes||[]).includes(me.email);
          const cDel=admin||(me&&me.email===c.authorEmail);
          return `<div class="fr-comment">
            <div class="fr-card-sub" style="margin-bottom:3px">${_frEsc(c.author)} ${_frRoleTag(c.role)} · ${_frAgo(c.at)}</div>
            <div style="font-size:14px;color:var(--offwhite);line-height:1.5;white-space:pre-wrap">${_frRich(c.text)}</div>
            <div style="display:flex;gap:12px;margin-top:6px;align-items:center">
              <button class="fr-cvote${cVoted?' on':''}" onclick="forumVoteComment('${p.id}','${c.id}','${page.dataset.rootId}')">▲ ${cVotes||''}</button>
              ${cDel?`<button class="fr-cvote" onclick="forumDeleteComment('${p.id}','${c.id}')">Delete</button>`:''}
            </div>
          </div>`;
        }).join('')||'<div style="padding:18px 0;color:var(--muted);font-size:13px">No comments yet — be the first.</div>'}
      </div>
    </div>
    <div class="fr-comment-bar">
      <input id="fr-comment-in" type="text" placeholder="Add a comment… (@ to tag)" autocomplete="off" oninput="_frMentionInput(this)" onkeydown="if(event.key==='Enter')forumAddComment('${p.id}')">
      <button onclick="forumAddComment('${p.id}')" aria-label="Send"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg></button>
    </div>`;
  if(prevScroll) page.querySelector('.fr-post-body').scrollTop=prevScroll;
}
function forumClosePost(){
  const page=document.getElementById('fr-post-page');
  const rootId=page?.dataset.rootId||'forum-root';
  page?.remove();
  _forumOpenId=null;
  renderForum(rootId);
}

// ── Comments ─────────────────────────────────────────────────────────────────
function forumAddComment(postId){
  const me=forumMe(); if(!me){showDhToast('Sign in','Sign in to comment','','var(--orange)',2500);return;}
  const input=document.getElementById('fr-comment-in');
  const text=(input?.value||'').trim(); if(!text) return;
  const posts=forumLoad();
  const p=posts.find(x=>x.id===postId); if(!p) return;
  (p.comments=p.comments||[]).push({id:'fc_'+Date.now(),author:me.name,authorEmail:me.email,role:me.role,text,at:new Date().toISOString(),upvotes:[]});
  p.editedAt=new Date().toISOString();
  forumSave(posts);
  _frNotifyMentions(text,p.title);
  input.value='';
  const page=document.getElementById('fr-post-page');
  forumOpenPost(postId,page?.dataset.rootId,true);
  const body=page?.querySelector('.fr-post-body');
  if(body) body.scrollTop=body.scrollHeight;
}
function forumDeleteComment(postId,commentId){
  if(!confirm('Delete this comment?')) return;
  const posts=forumLoad();
  const p=posts.find(x=>x.id===postId); if(!p) return;
  p.comments=(p.comments||[]).filter(c=>String(c.id)!==String(commentId));
  p.editedAt=new Date().toISOString();
  forumSave(posts);
  const page=document.getElementById('fr-post-page');
  forumOpenPost(postId,page?.dataset.rootId,true);
}

// ── Admin actions ────────────────────────────────────────────────────────────
function forumTogglePin(postId){
  if(!forumIsAdmin()) return;
  const posts=forumLoad();
  const p=posts.find(x=>x.id===postId); if(!p) return;
  p.pinned=!p.pinned; p.editedAt=new Date().toISOString();
  forumSave(posts);
  const page=document.getElementById('fr-post-page');
  forumOpenPost(postId,page?.dataset.rootId,true);
}
function forumSetStatus(postId,status){
  if(!forumIsAdmin()) return;
  const posts=forumLoad();
  const p=posts.find(x=>x.id===postId); if(!p) return;
  if((p.status||'')===(status||'')) return;
  p.status=status; p.editedAt=new Date().toISOString();
  const me=forumMe();
  const meta=_frStatusMeta(status);
  (p.comments=p.comments||[]).push({id:'fs_'+Date.now(),isSystem:true,statusId:status,author:me?.name||'Admin',authorEmail:me?.email||'',text:(me?.name?me.name.split(' ')[0]:'Admin')+' moved this to '+(status?meta.label:'no status'),at:new Date().toISOString()});
  forumSave(posts);
  try{ if(status&&typeof addSocialNotification==='function') addSocialNotification(null,'"'+String(p.title).slice(0,50)+'" is now '+meta.label+' 🎉','mention'); }catch(e){}
  showDhToast('Status updated',meta.label||'','','var(--green)',2000);
  const page=document.getElementById('fr-post-page');
  forumOpenPost(postId,page?.dataset.rootId,true);
}
function forumDeletePost(postId){
  if(!confirm('Delete this post and its comments?')) return;
  const posts=forumLoad();
  const p=posts.find(x=>x.id===postId); if(!p) return;
  p.deleted=true; p.editedAt=new Date().toISOString();
  forumSave(posts);
  forumClosePost();
}

// ── Composer (full page) ─────────────────────────────────────────────────────
function forumOpenComposer(rootId){
  const me=forumMe(); if(!me){showDhToast('Sign in','Sign in to post','','var(--orange)',2500);return;}
  document.getElementById('fr-compose-page')?.remove();
  const page=document.createElement('div');
  page.id='fr-compose-page';
  page.className=_frDesktop()?'fr-inline-page':'mc-page';
  page.dataset.rootId=rootId||'forum-root';
  page.innerHTML=`
    <div class="mca-hdr">
      <button class="mca-circle" onclick="forumCloseComposer()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
      <div class="mca-title">New Post</div>
      <button class="mca-circle mca-ok" onclick="forumSubmitPost()"><svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></button>
    </div>
    <div class="mca-scroll">
      <div style="display:flex;gap:8px;padding:2px 16px 14px;flex-wrap:wrap" id="fr-compose-cats">
        ${FORUM_CATS.filter(c=>!c.adminPost||forumIsAdmin()).map((c,i)=>`<button data-cat="${c.id}" class="fr-cat${i===0?' on':''}" style="${i===0?`background:${c.bg};color:${c.color};border-color:${c.color}55`:''}" onclick="_frComposePickCat('${c.id}')">${c.label}</button>`).join('')}
      </div>
      <div class="mca-card">
        <input id="fr-compose-title" class="mca-in" type="text" placeholder="Title" maxlength="120" autocomplete="off">
      </div>
      <div class="mca-card">
        <textarea id="fr-compose-body" class="mca-in mca-in-sub" placeholder="Details — paste a YouTube link to embed it, @ to tag someone" rows="7" style="resize:none" oninput="_frMentionInput(this)"></textarea>
      </div>
      <div style="padding:0 18px;font-size:11.5px;color:var(--muted);line-height:1.5">Everyone in the DroneHub community — team and clients — can see, upvote, and comment on your post.</div>
    </div>`;
  _frMount(page,page.dataset.rootId);
  page.dataset.cat=FORUM_CATS[0].id;
  setTimeout(()=>document.getElementById('fr-compose-title')?.focus(),80);
}
function forumCloseComposer(){
  const page=document.getElementById('fr-compose-page');
  const rootId=page?.dataset.rootId||'forum-root';
  page?.remove();
  if(_frDesktop()) renderForum(rootId);
}
function _frComposePickCat(catId){
  const page=document.getElementById('fr-compose-page');
  if(!page) return;
  page.dataset.cat=catId;
  page.querySelectorAll('#fr-compose-cats .fr-cat').forEach(b=>{
    const c=FORUM_CATS.find(x=>x.id===b.dataset.cat);
    const on=b.dataset.cat===catId;
    b.classList.toggle('on',on);
    b.style.cssText=on?`background:${c.bg};color:${c.color};border-color:${c.color}55`:'';
  });
}
function forumSubmitPost(){
  const me=forumMe(); if(!me) return;
  const page=document.getElementById('fr-compose-page');
  const title=(document.getElementById('fr-compose-title')?.value||'').trim();
  const body=(document.getElementById('fr-compose-body')?.value||'').trim();
  if(!title){showDhToast('Add a title','Give your post a short title','','var(--orange)',2500);return;}
  const posts=forumLoad();
  posts.push({
    id:'fp_'+Date.now(),
    title,body,
    category:page?.dataset.cat||'general',
    author:me.name,authorEmail:me.email,role:me.role,
    createdAt:new Date().toISOString(),
    upvotes:[me.email],
    comments:[],
    status:'',pinned:false,
  });
  forumSave(posts);
  _frNotifyMentions(title+' '+body,title);
  const rootId=page?.dataset.rootId||'forum-root';
  page?.remove();
  showDhToast('Posted','Your post is live in the community','','var(--green)',2500);
  renderForum(rootId);
}
