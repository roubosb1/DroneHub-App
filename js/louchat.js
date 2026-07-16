// ═══════════════════════════════════════════════════════════════════════════
// LOUCHAT
// ═══════════════════════════════════════════════════════════════════════════

const LC_SVG={
  welcome:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`,
  general:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
  project:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>`,
  client:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`,
  social:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>`,
  admin:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  video:`<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
  pin:`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V17z"/></svg>`,
  chat:`<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
};
const LC_TYPE_META={
  welcome:{icon:LC_SVG.welcome,color:'var(--blue-bright)',label:'Welcome'},
  general:{icon:LC_SVG.general,color:'var(--blue-bright)',label:'General'},
  project:{icon:LC_SVG.project,color:'var(--blue)',label:'Project'},
  client:     {icon:LC_SVG.client, color:'var(--blue)',label:'Client'},
  client_dm:  {icon:LC_SVG.client, color:'#22D97A',label:'Client Messages'},
  social: {icon:LC_SVG.social, color:'var(--blue-bright)',label:'Social Media'},
  admin:  {icon:LC_SVG.admin,  color:'var(--red)',label:'Admin'},
};

// Channels: [{id, name, type, topic, createdAt, pinned}]
function getLcChannels(){return JSON.parse(localStorage.getItem('dronehub_lc_channels')||'[]');}
function saveLcChannels(ch){
  try{localStorage.setItem('dronehub_lc_channels',JSON.stringify(ch));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':lc_channels',{data:JSON.stringify(ch),updatedAt:Date.now()})
      .catch(e=>console.error('[saveLcChannels] Firebase write failed:',e.message));
  }
}

// Messages: {channelId: [{id, author, text, ts, reactions:{emoji:count}}]}
function getLcMessages(channelId){
  // Each channel has its OWN localStorage key — completely isolated.
  // STRICT filter: only return messages explicitly tagged to this channel.
  // Any message without channelId or with a different channelId is silently dropped.
  try{
    const all=JSON.parse(localStorage.getItem('dronehub_lc_msgs_'+channelId)||'[]');
    return all.filter(m=>m.channelId===channelId);
  }catch(e){return[];}
}

function lcResetAllMessages(){
  if(!confirm('This will fix all channels. Continue?')) return;
  // Remove ALL old merged lc_msgs data
  localStorage.removeItem('dronehub_lc_msgs');
  // Also remove any per-channel keys that might have corrupt data
  const channels=getLcChannels();
  channels.forEach(ch=>localStorage.removeItem('dronehub_lc_msgs_'+ch.id));
  // Reload each channel from Firebase
  if(_fbToken()){
    channels.forEach(ch=>{
      fbGet('orgs',ORG_ID+':lc_msgs_'+ch.id).then(fb=>{
        if(fb?.msgs){
          try{
            const msgs=JSON.parse(fb.msgs).filter(m=>!m.channelId||m.channelId===ch.id);
            localStorage.setItem('dronehub_lc_msgs_'+ch.id,JSON.stringify(msgs));
          }catch(e){}
        }
      });
    });
  }
  setTimeout(()=>{renderLouChat();if(lcActiveChannel)lcRenderMessages();},1000);
  alert('✓ Channels reset. Each channel now has isolated storage.');
}

function lcCleanCorruptMessages(){
  // Remove the old merged dronehub_lc_msgs key that caused all channels to bleed into each other
  localStorage.removeItem('dronehub_lc_msgs');
  // ALWAYS wipe the welcome channel's message store — it renders a static photo, never messages
  localStorage.removeItem('dronehub_lc_msgs_lc_welcome');
  // Assign channelId to any per-channel messages that are missing it (one-time migration)
  const _cleanKey='dh_lc_channelid_migrated_v4';
  if(!sessionStorage.getItem(_cleanKey)){
    sessionStorage.setItem(_cleanKey,'1');
    try{
      const channels=JSON.parse(localStorage.getItem('dronehub_lc_channels')||'[]');
      channels.forEach(ch=>{
        if(ch.id==='lc_welcome') return; // welcome has no messages, already wiped above
        const key='dronehub_lc_msgs_'+ch.id;
        const msgs=JSON.parse(localStorage.getItem(key)||'[]');
        // STRICT: only keep messages explicitly tagged to this channel.
        // Drop untagged messages (they have no provenance and could be from any channel).
        // Drop messages tagged to a different channel (crossover from old bugs).
        const clean=msgs.filter(m=>m.channelId===ch.id);
        if(clean.length!==msgs.length)try{localStorage.setItem(key,JSON.stringify(clean));}catch(e){}
      });
    }catch(e){}
  }
}

async function saveLcMessage(channelId, msg){
  // Welcome channel is read-only — it renders a static photo, never stores messages
  if(!channelId||channelId==='lc_welcome') return;
  msg.channelId=channelId;
  const key='dronehub_lc_msgs_'+channelId;
  const msgs=JSON.parse(localStorage.getItem(key)||'[]');
  // Keep plaintext for browser notification before encrypting
  const _notifText=msg.text||'';
  if(msg.text) msg.text=await dhEncrypt(msg.text);
  msgs.push(msg);
  // Enforce channel isolation: only sync messages that belong to this channel
  const msgsForSync=msgs.filter(m=>!m.channelId||m.channelId===channelId);
  try{localStorage.setItem(key,JSON.stringify(msgsForSync));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':lc_msgs_'+channelId,{channelId,msgs:JSON.stringify(msgsForSync),updatedAt:Date.now()})
      .catch(e=>{
        console.error('[saveLcMessage] Firebase write failed:',e.message);
        showDhToast('Message not synced','LouChat message saved locally but could not sync to cloud.','⚠️','var(--orange)',5000);
      });
  }
  // Send browser notification with original plaintext
  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===channelId);
  if(ch&&_notifText) lcSendNotification(msg.author,_notifText,ch.name);
}
function deleteLcChannelMessages(channelId){
  localStorage.removeItem('dronehub_lc_msgs_'+channelId);
}

// Unread counts
function getLcUnread(){return JSON.parse(localStorage.getItem('dronehub_lc_unread')||'{}');}
function refreshLcNavBadge(){
  const u=getLcUnread();
  const total=Object.values(u).reduce((s,v)=>s+(v||0),0);
  const el=document.getElementById('lc-nav-badge');
  if(!el) return;
  if(total>0){el.textContent=total>99?'99+':String(total);el.style.display='inline-block';}
  else{el.style.display='none';}
  // Sync sidebar badge dot
  document.getElementById('dh-lc-nav-louchat')?.classList.toggle('has-badge',total>0);
  // Also refresh clients badge count in client cards
  const cListEl=document.getElementById('clients-list');
  if(cListEl&&cListEl.style.display!=='none') renderClients();
}
function markLcRead(channelId){
  const u=getLcUnread(); delete u[channelId];
  try{localStorage.setItem('dronehub_lc_unread',JSON.stringify(u));}catch(e){}
  refreshLcNavBadge();
}
function addLcUnread(channelId){
  const u=getLcUnread(); u[channelId]=(u[channelId]||0)+1;
  try{localStorage.setItem('dronehub_lc_unread',JSON.stringify(u));}catch(e){}
  refreshLcNavBadge();
}

let lcActiveChannel=null;
// Firebase fetch cache — tracks when each channel's messages were last fetched
// so we don't re-fetch on every click (30s TTL)
const _lcFetchedAt={};
const _LC_FETCH_TTL=30000;

// Lightweight sidebar active-state swap — avoids full renderLouChat() on channel switch
function lcUpdateSidebarActive(newId, prevId){
  // Deactivate previous
  if(prevId){
    const prev=document.getElementById('lc-ch-'+prevId);
    if(prev){
      const isWelcome=prevId==='lc_welcome';
      prev.style.background=isWelcome?'rgba(91,141,239,.07)':'transparent';
      if(isWelcome) prev.style.borderColor='rgba(91,141,239,.18)';
      const hash=prev.querySelector('.lc-ch-hash');
      const name=prev.querySelector('.lc-ch-name');
      if(hash) hash.style.color='var(--muted)';
      if(name){name.style.color='var(--muted)';name.style.fontWeight='400';}
    }
  }
  // Activate new
  if(newId){
    const next=document.getElementById('lc-ch-'+newId);
    if(next){
      const isWelcome=newId==='lc_welcome';
      const channels=getLcChannels();
      const ch=channels.find(c=>c.id===newId);
      const meta=ch?LC_TYPE_META[ch.type]||{}:{};
      next.style.background='rgba(91,141,239,.18)';
      if(isWelcome) next.style.borderColor='rgba(91,141,239,.45)';
      const hash=next.querySelector('.lc-ch-hash');
      const name=next.querySelector('.lc-ch-name');
      if(hash) hash.style.color=meta.color||'var(--blue-bright)';
      if(name){name.style.color='var(--white)';name.style.fontWeight='600';}
    }
    // If element not in DOM yet, lcRenderMessages() from lcOpenChannel handles it
  }
}

// Ensure default channels exist on first load
function lcEnsureDefaults(){
  // Clear any corrupt message data on every load
  lcCleanCorruptMessages();
  let channels=getLcChannels();
  if(channels.length){
    // Migrate: add members array if missing
    let changed=false;
    channels.forEach(ch=>{ if(!ch.members){ch.members=[];changed=true;} });
    // Migrate: add welcome channel if missing, or repair corrupted type
    const _wi=channels.findIndex(c=>c.id==='lc_welcome');
    if(_wi===-1){
      channels.unshift({id:'lc_welcome',name:'welcome',type:'welcome',topic:'A message from Lou — the person this chat is named after',createdAt:new Date().toISOString().slice(0,10),pinned:'',members:[]});
      changed=true;
    } else if(channels[_wi].type!=='welcome'){
      channels[_wi].type='welcome'; // repair if Firebase sync corrupted the type
      changed=true;
    }
    if(changed) saveLcChannels(channels);
    // Always ensure welcome message exists and has the photo
    lcEnsureWelcomeMsg();
    return;
  }
  const defaults=[
    {id:'lc_welcome',name:'welcome',type:'welcome',topic:'A message from Lou — the person this chat is named after',createdAt:new Date().toISOString().slice(0,10),pinned:'',members:[]},
    {id:'lc_general',name:'general',type:'general',topic:'Team-wide announcements and general chat',createdAt:new Date().toISOString().slice(0,10),pinned:'Welcome to LouChat! This is your team hub.',members:[]},
    {id:'lc_projects',name:'projects',type:'project',topic:'Project updates, shoot notes, and delivery tracking',createdAt:new Date().toISOString().slice(0,10),pinned:'',members:[]},
    {id:'lc_social',name:'social-media',type:'social',topic:'Social media content, scheduling, and strategy',createdAt:new Date().toISOString().slice(0,10),pinned:'',members:[]},
    {id:'lc_katrina',name:'katrina-barrett',type:'client',topic:'Katrina Barrett — social media management & shoots',createdAt:new Date().toISOString().slice(0,10),pinned:'Ongoing client — social media + regular shoots',members:[]},
    {id:'lc_admin',name:'admin-only',type:'admin',topic:'DroneHub admin — finances, contracts, planning',createdAt:new Date().toISOString().slice(0,10),pinned:'',members:[]},
  ];
  saveLcChannels(defaults);
  lcEnsureWelcomeMsg();
}

// Always keep the welcome message fresh — re-writes it every time so photo never disappears
function lcEnsureWelcomeMsg(){
  const louPhoto=document.getElementById('lou-photo-data')?.src||'';
  const welcomeMsg={
    id:1,
    author:'Lou',
    text:'Welcome to LouChat! My name is Lou and this chat was named after me. Happy Messaging!',
    ts:new Date('2025-01-01T09:00:00').toISOString(),
    reactions:{},
    attachments:louPhoto?[{
      id:2,
      type:'image',
      name:'lou-and-friends.png',
      dataUrl:louPhoto,
      mimeType:'image/png',
      size:0,
      source:'welcome',
    }]:[],
  };
  // Write to the per-channel key (not the old merged key)
  try{localStorage.setItem('dronehub_lc_msgs_lc_welcome',JSON.stringify([welcomeMsg]));}catch(e){}
}

function renderLouChat(){
  lcEnsureDefaults();
  lcEnsureWelcomeMsg(); // always keep Lou's photo + message fresh
  const channels=getLcChannels();
  const unread=getLcUnread();

  // Determine current user for channel visibility filtering
  const _lcSession=gateGetSession();
  const _lcIsAdmin=!_lcSession||_lcSession.type==='admin'||_lcSession.role==='admin';
  const _lcMyName=(_lcSession?.name||'').toLowerCase().trim();

  // Group channels by type — personal contractor channels are filtered per-user
  const groups={};
  channels.forEach(ch=>{
    // Admin-only channel: hide from non-admins
    if(ch.type==='admin' && !_lcIsAdmin) return;
    // Personal contractor channels (tagged with ownerName or topic pattern) are private:
    // only the channel owner and admins can see them
    const isPersonalCh = ch.ownerName || (ch.topic||'').includes('— assigned shoots and updates');
    if(isPersonalCh && !_lcIsAdmin){
      const ownerName=(ch.ownerName||ch.topic.split(' — ')[0]||'').toLowerCase().trim();
      if(ownerName && ownerName!==_lcMyName) return; // hide other people's private channels
    }
    if(!groups[ch.type]) groups[ch.type]=[];
    groups[ch.type].push(ch);
  });

  // Helper: get last-message timestamp for a channel (for sorting most-recent-first)
  function lcLastMsgTs(ch){
    const msgs=getLcMessages(ch.id);
    if(!msgs.length) return 0;
    const last=msgs[msgs.length-1];
    return new Date(last.ts||last.sentAt||0).getTime();
  }
  // Sort each group's channels by most-recent message desc
  Object.keys(groups).forEach(t=>{
    if(t==='welcome') return; // welcome always stays pinned at top
    groups[t].sort((a,b)=>lcLastMsgTs(b)-lcLastMsgTs(a));
  });

  const typeOrder=['welcome','general','project','client','client_dm','social','admin'];
  let html='';
  typeOrder.forEach(type=>{
    if(!groups[type]) return;
    const meta=LC_TYPE_META[type]||{icon:_icon('chat',16),color:'var(--offwhite)',label:type};

    // Welcome channel gets special hero treatment — no category header, sits above everything
    if(type==='welcome'){
      groups[type].forEach(ch=>{
        const isActive=ch.id===lcActiveChannel;
        const u=unread[ch.id]||0;
        html+=`<div id="lc-ch-${ch.id}" class="lc-dm-item" onclick="lcOpenChannel('${ch.id}')" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;background:${isActive?'rgba(91,141,239,.12)':'rgba(91,141,239,.05)'};border-bottom:1px solid rgba(91,141,239,.12);transition:background .12s;-webkit-tap-highlight-color:transparent">
          <div style="width:46px;height:46px;border-radius:50%;background:rgba(91,141,239,.2);border:1.5px solid rgba(91,141,239,.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--blue-bright)">
            <span style="font-size:18px">${LC_SVG.welcome||_icon('wave',18)}</span>
          </div>
          <div style="flex:1;min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--white);margin-bottom:2px"># welcome</div>
            <div style="font-size:12px;color:var(--muted)">A message from Lou</div>
          </div>
          ${u>0?`<span style="background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;flex-shrink:0">${u>9?'9+':u}</span>`:''}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
        </div>`;
      });
      return;
    }

    html+=`<div style="padding:10px 12px 4px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:5px">
      <span style="display:flex;align-items:center;color:var(--muted)">${meta.icon}</span> ${meta.label}
    </div>`;
    groups[type].forEach(ch=>{
      const isActive=ch.id===lcActiveChannel;
      const u=unread[ch.id]||0;
      // Get last message preview
      const msgs=getLcMessages(ch.id);
      const lastMsg=msgs.length?msgs[msgs.length-1]:null;
      const preview=lastMsg?(lastMsg.text||'').replace(/<[^>]+>/g,'').slice(0,55)||(lastMsg.text?'…':'No messages yet'):'No messages yet';
      const lastTime=lastMsg?new Date(lastMsg.ts||lastMsg.sentAt||0).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
      const accent=meta.color||'var(--blue-bright)';
      html+=`<div id="lc-ch-${ch.id}" class="lc-dm-item" onclick="lcOpenChannel('${ch.id}')" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;background:${isActive?'rgba(91,141,239,.1)':'transparent'};border-bottom:1px solid rgba(255,255,255,.04);transition:background .12s;-webkit-tap-highlight-color:transparent" onmouseover="if('${ch.id}'!==lcActiveChannel)this.style.background='rgba(255,255,255,.04)'" onmouseout="if('${ch.id}'!==lcActiveChannel)this.style.background='${isActive?'rgba(91,141,239,.1)':'transparent'}'">
        <!-- Channel avatar circle -->
        <div style="width:46px;height:46px;border-radius:50%;background:${isActive?'rgba(91,141,239,.25)':'rgba(255,255,255,.07)'};border:1.5px solid ${isActive?accent:'rgba(255,255,255,.12)'};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:${isActive?accent:'var(--muted)'};overflow:hidden;position:relative">
          ${ch.photo?`<img src="${ch.photo}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0">`:`<span style="font-size:18px">${meta.icon||_icon('chat',16)}</span>`}
        </div>
        <!-- Name + preview -->
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:3px">
            <span style="font-size:14px;font-weight:${u>0?'700':'600'};color:${isActive||u>0?'var(--white)':'var(--offwhite)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:70%">${ch.name}</span>
            <span style="font-size:10px;color:var(--muted);flex-shrink:0;margin-left:6px">${lastTime}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="font-size:12px;color:${u>0?'var(--offwhite)':'var(--muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1">${preview}</span>
            ${u>0?`<span style="background:var(--red);color:#fff;font-size:10px;font-weight:700;padding:1px 6px;border-radius:10px;min-width:18px;text-align:center;flex-shrink:0">${u>9?'9+':u}</span>`:''}
          </div>
        </div>
        <!-- Chevron (desktop hides this via opacity, mobile shows) -->
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    });
  });
  // Video Call entry — pinned below all channels
  const isVCActive=lcActiveChannel==='__video_call__';
  html+=`<div style="height:1px;background:var(--border);margin:8px 8px 4px"></div>
  <div onclick="lcOpenVideoCall()" style="padding:7px 12px;cursor:pointer;border-radius:6px;margin:1px 6px;display:flex;align-items:center;gap:9px;background:${isVCActive?'rgba(91,141,239,.18)':'transparent'};transition:background .12s" onmouseover="if(!${isVCActive})this.style.background='rgba(255,255,255,.05)'" onmouseout="if(!${isVCActive})this.style.background='${isVCActive?'rgba(91,141,239,.18)':'transparent'}'">
    <span style="display:flex;align-items:center;color:${isVCActive?'var(--blue-bright)':'var(--muted)'}">${LC_SVG.video}</span>
    <span style="font-size:13px;font-weight:${isVCActive?'700':'400'};color:${isVCActive?'var(--white)':'var(--muted)'}">Video Call</span>
  </div>`;

  document.getElementById('lc-channel-list').innerHTML=html;

  // Show "New channel" button only for admins
  const _s=gateGetSession();
  const _isAdmin=_s?.type==='admin'||_s?.role==='admin';
  const _addSec=document.getElementById('lc-add-section');
  if(_addSec) _addSec.style.display=_isAdmin?'block':'none';
  // NOTE: lcRenderMessages() is intentionally NOT called here.
  // Each lcOpenChannel() call handles its own render. Calling it here
  // creates a second competing async render when switching channels.
}

function lcMobBack(){
  document.getElementById('lc-flex-container')?.classList.remove('lc-mob-chat-open');
  document.body.classList.remove('lc-chat-full');
}

/* ── Instagram-style mobile input bar ──────────────────────── */
function lcIgInputChange(el){
  // Auto-grow textarea
  el.style.height='auto';
  el.style.height=Math.min(el.scrollHeight,100)+'px';
  const hasText=el.value.length>0;
  const bar=document.getElementById('lc-mob-ig-bar');
  if(bar) bar.classList.toggle('lc-ig-typing',hasText);
}

function lcIgSend(){
  const igEl=document.getElementById('lc-ig-input');
  const mainEl=document.getElementById('lc-msg-input');
  if(!igEl||!igEl.value.trim()) return;
  // Copy to main input then call the regular send
  mainEl.value=igEl.value;
  igEl.value='';
  igEl.style.height='auto';
  // Reset typing state
  const bar=document.getElementById('lc-mob-ig-bar');
  if(bar) bar.classList.remove('lc-ig-typing');
  lcSendMessage();
}

function lcIgToggleEmoji(){
  // Reuse the existing emoji picker (positioned inside lc-input-area)
  // Temporarily show lc-input-area just to show the emoji picker, then hide again
  lcToggleEmojiPicker();
  const ia=document.getElementById('lc-input-area');
  if(ia){
    const ep=document.getElementById('lc-emoji-picker');
    if(ep&&ep.style.display!=='none'){
      // Show input area so emoji picker is visible, but hide input row
      ia.style.display='block';
      const inputRow=ia.querySelector('div[style*="align-items:flex-end"]');
      if(inputRow) inputRow.style.display='none';
    } else {
      ia.style.display='none';
    }
  }
}

function lcOpenChannel(channelId){
  const prevChannel=lcActiveChannel;
  lcActiveChannel=channelId;
  markLcRead(channelId);
  // Mobile: slide to chat panel + enter immersive fullscreen mode
  if(window.innerWidth<=768){
    document.getElementById('lc-flex-container')?.classList.add('lc-mob-chat-open');
    document.body.classList.add('lc-chat-full');
  }

  // Always restore normal chat layout when opening a real channel
  const vcView=document.getElementById('lc-video-call-view');
  const msgsEl=document.getElementById('lc-messages');
  if(vcView) vcView.style.display='none';
  if(msgsEl) msgsEl.style.display='flex';

  // Lightweight sidebar active-state swap — no full re-render needed
  lcUpdateSidebarActive(channelId, prevChannel);

  // ── WELCOME CHANNEL: dedicated view, lc-messages stays hidden ────────────────
  if(channelId==='lc_welcome'){
    document.getElementById('lc-channel-icon').innerHTML=LC_SVG.welcome||_icon('house',18);
    document.getElementById('lc-channel-title').textContent='# welcome';
    document.getElementById('lc-channel-desc').textContent='A message from Lou — the person this chat is named after';
    document.getElementById('lc-input-area').style.display='none';
    const actionsEl=document.getElementById('lc-channel-actions');
    if(actionsEl) actionsEl.style.display='none';
    const delBtn=document.getElementById('lc-delete-channel-btn');
    if(delBtn) delBtn.style.display='none';
    const pinnedBar=document.getElementById('lc-pinned-bar');
    if(pinnedBar) pinnedBar.style.display='none';
    // Hide lc-messages, show lc-welcome-view (so lc-messages can never corrupt welcome)
    const msgsDiv=document.getElementById('lc-messages');
    if(msgsDiv) msgsDiv.style.display='none';
    lcRenderMessages(); // renders into lc-welcome-view
    return;
  }

  // Any non-welcome channel: ensure lc-welcome-view is hidden and lc-messages is visible
  const _wv=document.getElementById('lc-welcome-view');
  if(_wv) _wv.style.display='none';
  const _mv=document.getElementById('lc-messages');
  if(_mv) _mv.style.display='flex';

  // Fetch from Firebase only if stale (>30s since last fetch for this channel)
  if(_fbToken()){
    const now=Date.now();
    if(!_lcFetchedAt[channelId]||now-_lcFetchedAt[channelId]>_LC_FETCH_TTL){
      _lcFetchedAt[channelId]=now;
      fbGet('orgs',ORG_ID+':lc_msgs_'+channelId).then(fb=>{
        // Only update if still on the same channel when response arrives
        if(lcActiveChannel!==channelId) return;
        if(fb?.msgs){
          try{
            // Strict channel isolation: ONLY keep messages explicitly tagged to this channel.
            // No more "legacy" promotion — untagged messages are dropped.
            const msgs=JSON.parse(fb.msgs).filter(m=>m.channelId===channelId);
            localStorage.setItem('dronehub_lc_msgs_'+channelId,JSON.stringify(msgs));
            lcRenderMessages();
            lcScrollToBottom();
          }catch(e){}
        }
      });
    }
  }

  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===channelId);
  if(!ch) return;
  if(!ch.members) ch.members=[];
  const meta=LC_TYPE_META[ch.type]||{icon:_icon('chat',16),color:'var(--blue-bright)'};

  document.getElementById('lc-channel-icon').innerHTML=meta.icon;
  document.getElementById('lc-channel-title').textContent='# '+ch.name;
  document.getElementById('lc-channel-desc').textContent=ch.topic||'No description set';
  document.getElementById('lc-input-area').style.display='block';
  const actionsEl=document.getElementById('lc-channel-actions');
  if(actionsEl) actionsEl.style.display='flex';
  // Show delete button only for admins
  const delBtn=document.getElementById('lc-delete-channel-btn');
  if(delBtn){const s=gateGetSession();delBtn.style.display=(s?.type==='admin'||s?.role==='admin')?'inline-block':'none';}
  // lc-empty-state is replaced by innerHTML once any channel renders — always null-safe
  const _eEl=document.getElementById('lc-empty-state');
  if(_eEl) _eEl.style.display='none';
  document.getElementById('lc-msg-input').placeholder='Message #'+ch.name+'…';

  // Member count badge
  const memberCountEl=document.getElementById('lc-members-count');
  if(memberCountEl){
    const isOpen=!ch.members||ch.members.length===0;
    memberCountEl.textContent=isOpen?'Open · All':'Restricted · '+ch.members.length+' member'+(ch.members.length===1?'':'s');
  }

  // Pinned bar
  const pinnedBar=document.getElementById('lc-pinned-bar');
  if(ch.pinned){
    pinnedBar.style.display='block';
    document.getElementById('lc-pinned-text').textContent=ch.pinned;
  } else {
    pinnedBar.style.display='none';
  }

  lcRenderMessages();
  lcScrollToBottom();
  setTimeout(()=>document.getElementById('lc-msg-input').focus(),50);
}

// ─── CHANNEL MEMBER MANAGEMENT ────────────────────────────────────────────────

function lcOpenMembersPanel(){
  const panel=document.getElementById('lc-members-panel');
  if(!panel) return;
  const isOpen=panel.style.display==='none'||panel.style.display==='';
  panel.style.display=isOpen?'flex':'none';
  if(isOpen) lcRenderMembersPanel();
}

function lcCloseMembersPanel(){
  const panel=document.getElementById('lc-members-panel');
  if(panel) panel.style.display='none';
}

function lcRenderMembersPanel(){
  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===lcActiveChannel);
  if(!ch) return;
  if(!ch.members) ch.members=[];

  const isRestricted=ch.members.length>0;

  // Access toggle buttons
  const openBtn=document.getElementById('lc-access-open');
  const restrictedBtn=document.getElementById('lc-access-restricted');
  const noteEl=document.getElementById('lc-access-note');
  const addSection=document.getElementById('lc-add-member-section');

  if(openBtn&&restrictedBtn){
    openBtn.style.borderColor=!isRestricted?'var(--green)':'var(--border)';
    openBtn.style.background=!isRestricted?'var(--green-bg)':'transparent';
    openBtn.style.color=!isRestricted?'var(--green)':'var(--muted)';
    restrictedBtn.style.borderColor=isRestricted?'var(--amber)':'var(--border)';
    restrictedBtn.style.background=isRestricted?'var(--amber-bg)':'transparent';
    restrictedBtn.style.color=isRestricted?'var(--amber)':'var(--muted)';
    if(noteEl) noteEl.textContent=isRestricted
      ?'Restricted — only invited members can see this channel.'
      :'Open — all team members and admins can see this channel.';
    if(addSection) addSection.style.display=isRestricted?'block':'none';
  }

  // Populate add member dropdown with all team members + clients
  const memberSel=document.getElementById('lc-add-member-sel');
  if(memberSel){
    const teamMembers=getTeamMembers();
    const alreadyIn=ch.members.map(m=>m.id);
    const available=[
      ...teamMembers.filter(m=>!alreadyIn.includes(m.id)).map(m=>({id:m.id,name:m.name,type:'team'})),
      ...clients.filter(c=>!alreadyIn.includes('client_'+c.id)).map(c=>({id:'client_'+c.id,name:c.name+' (client)',type:'client'})),
    ];
    memberSel.innerHTML='<option value="">— Select person —</option>'+
      available.map(p=>`<option value="${p.id}" data-type="${p.type}">${p.name}</option>`).join('');
  }

  // Render current members list
  const listEl=document.getElementById('lc-members-list');
  if(!listEl) return;

  if(!ch.members.length){
    listEl.innerHTML='<div style="font-size:12px;color:var(--muted);font-style:italic">No restrictions — visible to everyone</div>';
    return;
  }

  listEl.innerHTML=ch.members.map(m=>{
    const initials=(m.name||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    // avatar handled by getAvatarHtml
    return `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border)">
      ${getAvatarHtml(m.name,m.email,28,10)}
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.name}</div>
        <div style="font-size:10px;color:var(--muted)">${m.role||m.type||'member'}</div>
      </div>
      <button onclick="lcRemoveMember('${m.id}')" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:14px;padding:2px 5px;border-radius:4px" title="Remove from channel">✕</button>
    </div>`;
  }).join('');
}

function lcSetAccess(mode){
  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===lcActiveChannel);
  if(!ch) return;
  if(mode==='open'){
    if(!confirm('Make #'+ch.name+' open to all team members? This will remove all member restrictions.')) return;
    ch.members=[];
  } else {
    // Switch to restricted — keep existing members, just show the add UI
    if(!ch.members) ch.members=[];
  }
  saveLcChannels(channels);
  lcRenderMembersPanel();
  lcOpenChannel(lcActiveChannel);
}

function lcAddMember(){
  const sel=document.getElementById('lc-add-member-sel');
  const memberId=sel?.value;
  if(!memberId){alert('Please select a person to add.');return;}

  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===lcActiveChannel);
  if(!ch) return;
  if(!ch.members) ch.members=[];
  if(ch.members.find(m=>m.id===memberId)) return;

  // Resolve name and role
  let name='', role='';
  if(memberId.startsWith('client_')){
    const clientId=memberId.slice(7);
    const client=clients.find(c=>c.id===clientId);
    name=client?client.name:'Unknown client';
    role='client';
  } else {
    const member=getTeamMembers().find(m=>m.id===memberId);
    name=member?member.name:'Unknown member';
    role=member?.role||'editor';
  }

  ch.members.push({id:memberId,name,role,addedAt:new Date().toISOString().slice(0,10)});
  saveLcChannels(channels);
  lcRenderMembersPanel();
  lcOpenChannel(lcActiveChannel);
}

function lcRemoveMember(memberId){
  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===lcActiveChannel);
  if(!ch||!ch.members) return;
  ch.members=ch.members.filter(m=>m.id!==memberId);
  saveLcChannels(channels);
  lcRenderMembersPanel();
  lcOpenChannel(lcActiveChannel);
}

// Check if a team member has access to a channel
function lcMemberHasAccess(channelId, memberId){
  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===channelId);
  if(!ch) return false;
  if(!ch.members||ch.members.length===0) return true; // open channel
  return ch.members.some(m=>m.id===memberId);
}

function lcScrollToBottom(){
  // Use rAF + setTimeout so the browser has fully painted the new messages
  // before we set scrollTop — fixes the "doesn't scroll" bug on channel switch.
  requestAnimationFrame(()=>{
    setTimeout(()=>{
      const el = document.getElementById('lc-messages');
      if(el) el.scrollTop = el.scrollHeight;
    }, 0);
  });
}

async function lcRenderMessages(){
  // Snapshot the active channel NOW — before any async work — so stale renders
  // from a previous channel can't overwrite what we're about to paint.
  const channelId=lcActiveChannel;
  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===channelId);
  const meta=ch?LC_TYPE_META[ch.type]||{}:{};
  const container=document.getElementById('lc-messages');
  if(!container) return;

  // ── WELCOME CHANNEL — uses its own dedicated DOM element, never lc-messages ──
  if(channelId==='lc_welcome'){
    // Show welcome view, hide messages container (so nothing can ever overwrite it)
    const welcomeView=document.getElementById('lc-welcome-view');
    if(welcomeView){
      const photo=document.getElementById('lou-photo-data')?.src||'';
      const isMob=window.innerWidth<=768;
      welcomeView.innerHTML=`
        ${photo?`<img src="${photo}" alt="Lou" style="${isMob?'width:72%;max-width:260px;height:auto;display:block;margin:0 auto 20px;':'height:min(55vh,340px);width:auto;flex-shrink:0;'}border-radius:${isMob?'14px':'18px'};object-fit:contain;box-shadow:0 8px 32px rgba(0,0,0,.5);border:2px solid rgba(91,141,239,.45)">`:'<div style="width:72px;height:72px;border-radius:50%;background:rgba(91,141,239,.18);border:2px solid rgba(91,141,239,.35);display:flex;align-items:center;justify-content:center;flex-shrink:0"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--blue-bright)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></div>'}
        <div style="text-align:${isMob?'center':'left'};${isMob?'padding:0 8px':'max-width:320px'}">
          <div style="font-size:${isMob?'28':'38'}px;font-weight:900;color:var(--white);font-family:'Barlow Condensed',sans-serif;letter-spacing:-.01em;margin-bottom:10px;line-height:1.05">
            Welcome to <span style="color:var(--blue-bright)">LouChat</span>
          </div>
          <div style="font-size:${isMob?'14':'15'}px;color:var(--offwhite);line-height:1.7;margin-bottom:14px">
            My name is Lou and this chat was named after me.
          </div>
          <div style="font-size:${isMob?'16':'18'}px;color:var(--blue-bright);font-weight:700;margin-bottom:16px">Happy Messaging! 💬✨</div>
          <div style="font-size:11px;color:var(--muted)">— Lou · the person behind the name</div>
        </div>`;
      welcomeView.style.cssText=isMob
        ? 'display:flex;flex-direction:column;flex:1;overflow-y:auto;padding:20px 16px;gap:0;align-items:center;justify-content:flex-start;'
        : 'display:flex;flex:1;overflow:hidden;align-items:center;justify-content:center;padding:24px 32px;gap:32px;';
    }
    container.style.display='none'; // hide lc-messages — nothing can overwrite welcome now
    return;
  }

  // Any non-welcome channel: make sure lc-welcome-view is hidden and lc-messages is visible
  const welcomeView=document.getElementById('lc-welcome-view');
  if(welcomeView) welcomeView.style.display='none';
  container.style.display='flex';

  // Pre-load encryption key before decrypting (avoids "sign in" flash on first open)
  if(!_msgKey && _fbToken()) await _loadMsgKey().catch(()=>{});
  // For non-welcome channels, decrypt messages now (async)
  const rawMsgs=getLcMessages(channelId);
  const msgs=await dhDecryptMsgs(rawMsgs);
  // Bail if the user switched channels (or to welcome) while we were decrypting
  if(lcActiveChannel!==channelId) return;
  if(lcActiveChannel==='lc_welcome') return; // never overwrite welcome with message HTML

  if(!msgs.length){
    container.innerHTML=`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center">
      <div style="margin-bottom:12px;color:var(--blue-bright);display:flex;justify-content:center;opacity:.5">${meta.icon||LC_SVG.general}</div>
      <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:6px">Welcome to #${ch?.name||'channel'}</div>
      <div style="font-size:13px;color:var(--muted)">${ch?.topic||'Start the conversation!'}</div>
    </div>`;
    return;
  }

  // Group messages by author+time (same author within 5 min = collapsed)
  let html='';
  let prevAuthor='', prevTime=0;

  msgs.forEach((m,i)=>{
    const d=new Date(m.ts);
    const timeStr=d.toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'});
    const dateStr=d.toLocaleDateString('en-CA',{month:'short',day:'numeric'});
    const isToday=new Date().toDateString()===d.toDateString();
    const collapsed=(m.author===prevAuthor)&&(d.getTime()-prevTime<5*60*1000)&&(i>0);

    // Day divider
    if(i===0||(new Date(msgs[i-1].ts).toDateString()!==d.toDateString())){
      html+=`<div style="display:flex;align-items:center;gap:10px;margin:16px 0 8px">
        <div style="flex:1;height:1px;background:var(--border)"></div>
        <div style="font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap">${isToday?'Today':dateStr}</div>
        <div style="flex:1;height:1px;background:var(--border)"></div>
      </div>`;
    }

    const initials=m.author.split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    const avatarColor=['#5B8DEF','#22D97A','#F5A623','#8B5CF6','#F05252','#E879F9'][m.author.charCodeAt(0)%6];
    const _lcAuthorEmail=m.authorEmail||getLcAuthorEmail(m.author)||'';

    if(!collapsed){
      html+=`<div style="display:flex;gap:10px;padding:6px 0;margin-top:4px;position:relative" onmouseover="this.querySelector('.lc-msg-actions').style.opacity=1;this.querySelector('.lc-ts').style.opacity=1" onmouseout="this.querySelector('.lc-msg-actions').style.opacity=0;this.querySelector('.lc-ts').style.opacity=0">
        ${getAvatarHtml(m.author,_lcAuthorEmail,36,12)}
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px">
            <span style="font-size:13px;font-weight:700;color:var(--white)">${m.author}</span>${getUserJobTitle(m.author)?`<span style="font-size:10px;color:var(--muted);margin-left:5px">${getUserJobTitle(m.author)}</span>`:''}
            <span class="lc-ts" style="font-size:10px;color:var(--muted);opacity:0;transition:opacity .15s">${isToday?timeStr:dateStr+' '+timeStr}</span>
          </div>
          ${m.text?`<div style="font-size:13px;color:var(--offwhite);line-height:1.55;word-break:break-word">${lcFormatText(m.text)}</div>`:''}
          ${m.isMeeting?`<a href="${m.meetUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;margin-top:6px;padding:8px 16px;border-radius:10px;background:linear-gradient(135deg,#1a73e8,#1557b0);color:#fff;text-decoration:none;font-size:13px;font-weight:700">📹 Join Google Meet</a>`:''}
          ${(m.attachments||[]).map(a=>lcRenderAttachment(a)).join('')}
          ${m.reactions&&Object.keys(m.reactions).length?'<div style="display:flex;gap:4px;margin-top:4px">'+Object.entries(m.reactions).map(([e,n])=>`<span onclick="lcReact('${channelId}',${m.id},'${e}')" style="padding:2px 7px;border-radius:10px;background:rgba(91,141,239,.12);border:1px solid var(--border);color:var(--offwhite);font-size:12px;cursor:pointer">${e} ${n}</span>`).join('')+'</div>':''}
        </div>
        <div class="lc-msg-actions" style="opacity:0;transition:opacity .15s;display:flex;gap:4px;align-items:flex-start;flex-shrink:0">
          ${(gateGetSession()?.type==='admin'||gateGetSession()?.role==='admin')?`<button onclick="lcDeleteMessage('${channelId}',${m.id})" title="Delete message" style="padding:3px 7px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;display:flex;align-items:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`:''}
        </div>
      </div>`;
    } else {
      html+=`<div style="padding:1px 0 1px 46px;display:flex;align-items:baseline;gap:8px;position:relative" onmouseover="this.querySelector('.lc-ts2').style.opacity=1;this.querySelector('.lc-msg-actions2').style.opacity=1" onmouseout="this.querySelector('.lc-ts2').style.opacity=0;this.querySelector('.lc-msg-actions2').style.opacity=0">
        <span class="lc-ts2" style="font-size:9px;color:var(--muted);opacity:0;transition:opacity .15s;min-width:38px;text-align:right">${timeStr}</span>
        <div style="flex:1;min-width:0">
          ${m.text?`<div style="font-size:13px;color:var(--offwhite);line-height:1.55;word-break:break-word">${lcFormatText(m.text)}</div>`:''}
          ${(m.attachments||[]).map(a=>lcRenderAttachment(a)).join('')}
        </div>
        <div class="lc-msg-actions2" style="opacity:0;transition:opacity .15s;flex-shrink:0">
          ${(gateGetSession()?.type==='admin'||gateGetSession()?.role==='admin')?`<button onclick="lcDeleteMessage('${channelId}',${m.id})" title="Delete message" style="padding:3px 7px;border-radius:6px;border:1px solid var(--border);background:transparent;color:var(--muted);cursor:pointer;display:flex;align-items:center"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button>`:''}
        </div>
      </div>`;
    }

    prevAuthor=m.author; prevTime=d.getTime();
  });

  container.innerHTML=html;
  lcScrollToBottom();
  // Init drag-drop
  lcInitDragDrop();
}

// ─── LOUCHAT ATTACHMENTS & EMOJI ─────────────────────────────────────────────

let lcPendingAttachments=[]; // [{type:'image'|'video'|'file', name, dataUrl, mimeType, size}]

// Emoji data — categorised
const LC_EMOJIS={
  'Smileys':['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','☺️','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🫢','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','🤠','🥳','🥸','😎','🤓','🧐','😕','😟','🙁','☹️','😮','😯','😲','😳','🥺','🥹','😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺','👻','👽','👾','🤖'],
  'Gestures':['👋','🤚','🖐','✋','🖖','🫱','🫲','🫳','🫴','👌','🤌','🤏','✌️','🤞','🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','🫦','🧬'],
  'People':['👶','🧒','👦','👧','🧑','👱','👨','🧔','👩','🧓','👴','👵','🙍','🙎','🙅','🙆','💁','🙋','🧏','🙇','🤦','🤷','💆','💇','🚶','🧍','🧎','🏃','💃','🕺','🕴','👫','👬','👭','💑','💏','👨‍👩‍👦','👨‍👩‍👧'],
  'Nature':['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🪱','🐛','🦋','🐌','🐞','🐜','🪲','🦟','🦗','🪳','🕷','🦂','🐢','🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🐊','🌸','🌺','🌻','🌹','🌷','🌼','🌱','🌿','🍀','🍁','🍂','🍃','🌾','🌵','🌴','🌲','🌳','🌞','🌝','🌛','🌜','🌚','🌕','🌖','🌗','🌘','🌙','🪐','⭐','🌟','💫','✨','☄️','🌈','⛅','🌤','🔥','💧','🌊'],
  'Food':['🍎','🍊','🍋','🍇','🍓','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🥑','🫒','🌽','🌶','🫑','🥦','🥬','🧄','🧅','🥔','🍠','🫘','🌰','🍞','🥐','🧀','🍳','🥓','🍗','🍖','🌭','🍔','🍟','🍕','🫓','🥙','🥗','🥘','🫕','🍱','🍛','🍣','🍜','🍝','🍠','🍢','🍡','🍧','🍨','🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧋','🥤','☕','🫖','🍵','🧃','🧊'],
  'Activities':['⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🥊','🥋','🎽','🛹','🛼','🛷','⛸','🤺','🏇','⛷','🏂','🪂','🏋','🤼','🤸','🤽','🤾','🧘','🏄','🚴','🤸','🧗','🚵','🏌','🧜','🤿','🎯','🎱','🎰','🎲','♟','🎭','🎨','🎬','🎤','🎧','🎼','🎹','🥁','🪘','🎷','🎺','🎸','🪕','🎻','🪗'],
  'Travel':['🚗','🚕','🚙','🚌','🚎','🏎','🚓','🚑','🚒','🚐','🛻','🚚','🚛','🚜','🏍','🛵','🚲','🛴','🛺','🚁','🛸','🚀','✈️','🛫','🛬','🛩','💺','🚢','⛴','🛳','🛥','🚤','⛵','🛶','🏠','🏡','🏗','🏘','🏚','🏛','🏟','🏢','🏣','🏤','🏥','🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪','🕌','🛕','🕍','⛩','🕋','⛲','⛺','🌁','🌃','🏙','🌄','🌅','🌆','🌇','🌉','♨️','🎠','🎡','🎢','🎪','🛎'],
  'Objects':['⌚','📱','💻','⌨️','🖥','🖨','🖱','🗜','💾','💿','📀','📷','📸','📹','🎥','📽','🎞','📞','☎️','📟','📠','📺','📻','🧭','⏱','⏰','⏲','⏳','📡','🔋','🔌','💡','🔦','🕯','💰','💴','💵','💶','💷','💸','💳','🪙','💹','📈','📉','📊','📋','📁','📂','🗂','📅','📆','🗒','🗓','📇','📌','📍','🗺','📏','📐','✂️','🗃','🗄','🗑','🔒','🔓','🔏','🔐','🔑','🗝','🔨','🪓','⛏','⚒','🛠','🗡','⚔️','🛡','🔧','🔩','⚙️','🗜','⚖️','🦯','🔗','⛓','🪝','🧲','🔬','🔭','📡','💉','🩸','💊','🩹','🩺','🚪','🪞','🪟','🛋','🚽','🧺','🧹','🧻','🧼','🪣','🧴','🪥','🛁','🪒','🧽','🧯','🛒','🚿'],
  'Symbols':['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🕉','✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍','♎','♏','♐','♑','♒','♓','🆔','⚛️','🉑','☢️','☣️','📴','📳','🈶','🈚','🈸','🈺','🈷','✴️','🆚','💮','🉐','㊙️','㊗️','🈴','🈵','🈹','🈲','🅰️','🅱️','🆎','🆑','🅾️','🆘','❌','⭕','🛑','⛔','🚫','🚳','🚭','🚯','🚱','🚷','📵','🔞','☑️','✅','🔛','🔜','🔚','🔝','🔙','🔃','➕','➖','➗','✖️','♾','❓','❔','❕','❗','〰️','💱','💲','⚕️','♻️','⚜️','🔱','📛','🔰','⭐','🔵','🟠','🟡','🟢','🔴','🟣','🟤','⚫','⚪','🟥','🟧','🟨','🟩','🟦','🟪','🟫','⬛','⬜','◼️','◻️','◾','◽','▪️','▫️'],
};

function lcBuildEmojiPicker(){
  const grid=document.getElementById('lc-emoji-grid');
  if(!grid||grid.children.length>0) return; // already built
  let html='';
  Object.entries(LC_EMOJIS).forEach(([cat,emojis])=>{
    html+=`<div style="width:100%;font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.07em;padding:6px 0 4px;margin-top:4px">${cat}</div>`;
    emojis.forEach(e=>{
      html+=`<button onclick="lcInsertEmoji('${e}')" title="${e}" style="width:34px;height:34px;border:none;background:transparent;cursor:pointer;border-radius:6px;font-size:20px;display:flex;align-items:center;justify-content:center;transition:background .1s;padding:0" onmouseover="this.style.background='rgba(255,255,255,.1)'" onmouseout="this.style.background='transparent'">${e}</button>`;
    });
  });
  grid.innerHTML=html;
}

function lcToggleEmojiPicker(){
  const picker=document.getElementById('lc-emoji-picker');
  if(!picker) return;
  const open=picker.style.display==='none'||!picker.style.display;
  picker.style.display=open?'block':'none';
  if(open){lcBuildEmojiPicker();lcCloseAttachMenu();}
}
function lcToggleAttachMenu(){
  const m=document.getElementById('lc-attach-menu');
  if(!m) return;
  const open=m.style.display==='none'||!m.style.display;
  if(open) document.getElementById('lc-emoji-picker').style.display='none';
  m.style.display=open?'flex':'none';
}
function lcCloseAttachMenu(){
  const m=document.getElementById('lc-attach-menu');
  if(m) m.style.display='none';
}
function lcToggleMoreMenu(){
  const m=document.getElementById('lc-more-menu');
  if(!m) return;
  m.style.display=(m.style.display==='none'||!m.style.display)?'block':'none';
}

function lcInsertEmoji(emoji){
  const input=document.getElementById('lc-msg-input');
  if(!input) return;
  const pos=input.selectionStart||input.value.length;
  input.value=input.value.slice(0,pos)+emoji+input.value.slice(pos);
  input.focus();
  input.setSelectionRange(pos+emoji.length,pos+emoji.length);
  // Close picker
  const picker=document.getElementById('lc-emoji-picker');
  if(picker) picker.style.display='none';
}

function lcHandleFiles(files, sourceType){
  if(!files||!files.length) return;
  Array.from(files).forEach(file=>{
    if(file.size>50*1024*1024){alert(file.name+' is too large (max 50MB).');return;}
    const reader=new FileReader();
    reader.onload=e=>{
      const isImage=file.type.startsWith('image/');
      const isVideo=file.type.startsWith('video/');
      const attach={
        id:Date.now()+Math.random(),
        type:isImage?'image':isVideo?'video':'file',
        name:file.name,
        dataUrl:e.target.result,
        mimeType:file.type,
        size:file.size,
        source:sourceType,
      };
      lcPendingAttachments.push(attach);
      lcRenderAttachPreview();
    };
    reader.readAsDataURL(file);
  });
}

function lcRenderAttachPreview(){
  const container=document.getElementById('lc-attach-preview');
  if(!container) return;
  if(!lcPendingAttachments.length){container.style.display='none';return;}
  container.style.display='flex';
  container.innerHTML=lcPendingAttachments.map((a,i)=>`
    <div style="position:relative;border-radius:8px;overflow:hidden;border:1px solid var(--border-bright);background:var(--navy-lift)">
      ${a.type==='image'
        ?`<img src="${a.dataUrl}" alt="Attachment preview" style="height:70px;width:auto;max-width:120px;object-fit:cover;display:block">`
        :a.type==='video'
        ?`<video src="${a.dataUrl}" style="height:70px;width:auto;max-width:120px;object-fit:cover;display:block" muted></video>`
        :`<div style="height:70px;width:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:8px">
            <span style="font-size:24px">${lcFileIcon(a.mimeType)}</span>
            <span style="font-size:9px;color:var(--muted);text-align:center;word-break:break-all;line-height:1.3">${a.name.slice(0,20)}</span>
          </div>`}
      <button onclick="lcRemoveAttach(${i})" style="position:absolute;top:3px;right:3px;width:18px;height:18px;border-radius:50%;border:none;background:rgba(0,0,0,.7);color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">✕</button>
    </div>`).join('');
}

function lcRemoveAttach(index){
  lcPendingAttachments.splice(index,1);
  lcRenderAttachPreview();
}

function lcFileIcon(mimeType){
  if(!mimeType) return _icon('notes',14);
  if(mimeType.includes('pdf')) return _icon('notes',14);
  if(mimeType.includes('word')||mimeType.includes('document')) return _icon('notes',14);
  if(mimeType.includes('sheet')||mimeType.includes('excel')) return _icon('chart',14);
  if(mimeType.includes('presentation')||mimeType.includes('powerpoint')) return _icon('chart',14);
  if(mimeType.includes('zip')||mimeType.includes('archive')) return _icon('folder',14);
  if(mimeType.includes('video')) return _icon('video',14);
  if(mimeType.includes('audio')) return _icon('notes',14);
  return _icon('notes',14);
}

function lcFormatText(text){
  if(!text) return '';
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,'<em>$1</em>')
    .replace(/`(.+?)`/g,'<code style="background:var(--navy-lift);padding:1px 5px;border-radius:4px;font-size:12px;color:var(--blue-bright)">$1</code>')
    .replace(/(https?:\/\/[^\s]+)/g,'<a href="$1" target="_blank" style="color:var(--blue-bright);text-decoration:underline">$1</a>')
    .replace(/@([A-Za-z][A-Za-z0-9_.\- ]*?)(?=\s|$|[,!?.()\[\]])/g,'<span style="color:var(--blue-bright);font-weight:700;background:rgba(91,141,239,.18);padding:1px 5px;border-radius:4px">@$1</span>')
    .replace(/\n/g,'<br>');
}

function lcRenderAttachment(a){
  if(!a) return '';
  if(a.type==='image'){
    return `<div style="margin-top:6px"><img src="${a.dataUrl}" alt="${a.name}" style="max-width:320px;max-height:280px;border-radius:8px;display:block;cursor:pointer;border:1px solid var(--border)" onclick="window.open(this.src)"></div>`;
  }
  if(a.type==='video'){
    return `<div style="margin-top:6px"><video src="${a.dataUrl}" controls style="max-width:320px;max-height:240px;border-radius:8px;display:block;background:#000;border:1px solid var(--border)"></video></div>`;
  }
  // File
  const sizeStr=a.size>1024*1024?(a.size/(1024*1024)).toFixed(1)+' MB':(a.size/1024).toFixed(0)+' KB';
  return `<div style="margin-top:6px;display:inline-flex;align-items:center;gap:10px;padding:10px 14px;background:var(--navy-lift);border:1px solid var(--border-bright);border-radius:10px;max-width:280px">
    <span style="font-size:24px;flex-shrink:0">${lcFileIcon(a.mimeType)}</span>
    <div style="min-width:0">
      <div style="font-size:12px;font-weight:600;color:var(--white);word-break:break-word">${a.name}</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">${sizeStr}</div>
    </div>
    <a href="${a.dataUrl}" download="${a.name}" style="padding:5px 10px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:11px;font-weight:700;text-decoration:none;flex-shrink:0">↓</a>
  </div>`;
}

// ── DAILY.CO VIDEO CALLS ──────────────────────────────────────────────────────
const DAILY_API_KEY='aefdd165794ee6eb1fec8174d06b5b806653776173c0dd394b62fa5f6da2bd4c';
let _dailyFrame=null;

function lcStartGoogleMeet(){
  const session=gateGetSession();
  const meetUrl='https://meet.google.com/new';

  // Collect invited members
  const invited=[...document.querySelectorAll('.lc-invite-check:checked')].map(c=>c.dataset.name||c.value).filter(Boolean);
  const inviteNote=invited.length?`\nInvited: ${invited.join(', ')}`:'';

  // Post link to general (or first) channel
  const channels=getLcChannels();
  const postCh=channels.find(c=>c.type==='general')||channels[0];
  if(postCh){
    const msg={
      id:Date.now(),
      author:session?.name||'DroneHub',
      authorEmail:session?.email||'',
      channelId:postCh.id,
      text:`🟢 **Google Meet started!**${inviteNote}\n\nClick to join:`,
      ts:new Date().toISOString(),
      reactions:{},
      attachments:[],
      isMeeting:true,
      meetUrl,
    };
    saveLcMessage(postCh.id,msg);
  }
  window.open(meetUrl,'_blank');
}

async function lcStartMeeting(){
  const session=gateGetSession();
  const statusEl=document.getElementById('lc-video-status');
  if(statusEl) statusEl.textContent='Creating room…';

  // Collect invited members from checkboxes
  const invitedEls=[...document.querySelectorAll('.lc-invite-check:checked')];
  const invited=invitedEls.map(c=>c.dataset.name||c.value).filter(Boolean);

  try{
    const roomName='dronehub-call-'+Date.now().toString(36);
    const res=await fetch('https://api.daily.co/v1/rooms',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+DAILY_API_KEY},
      body:JSON.stringify({
        name:roomName,
        properties:{
          enable_chat:true,
          enable_screenshare:true,
          exp:Math.floor(Date.now()/1000)+(60*60*3),
        }
      })
    });
    const room=await res.json();
    if(!room.url) throw new Error(room.error||'Failed to create room');

    // Switch from lobby → active call
    const lobby=document.getElementById('lc-vc-lobby');
    const active=document.getElementById('lc-vc-active');
    if(lobby) lobby.style.display='none';
    if(active) active.style.display='flex';

    // Embed Daily.co
    const frameEl=document.getElementById('lc-daily-frame');
    if(frameEl){
      frameEl.innerHTML='';
      _dailyFrame=window.DailyIframe?DailyIframe.createFrame(frameEl,{
        showLeaveButton:true,
        showFullscreenButton:true,
        iframeStyle:{width:'100%',height:'100%',border:'none'},
      }):null;
      if(_dailyFrame){
        _dailyFrame.join({url:room.url,userName:session?.name||'Guest'});
        _dailyFrame.on('left-meeting',()=>lcEndMeeting());
      } else {
        window.open(room.url,'_blank');
      }
    }
    if(statusEl) statusEl.textContent='🔴 Live';

    // Post join link to the general (or first) channel so invitees can see it
    const channels=getLcChannels();
    const postCh=channels.find(c=>c.type==='general')||channels[0];
    if(postCh){
      const inviteNote=invited.length?`\nInvited: ${invited.join(', ')}`:'';
      const msg={
        id:Date.now(),
        author:session?.name||'DroneHub',
        authorEmail:session?.email||'',
        channelId:postCh.id,
        text:`**Video call started!**${inviteNote}\n\nClick to join:`,
        ts:new Date().toISOString(),
        reactions:{},
        attachments:[],
        isMeeting:true,
        meetUrl:room.url,
      };
      saveLcMessage(postCh.id,msg);
    }

  }catch(e){
    console.error('Daily.co error:',e);
    if(statusEl) statusEl.textContent='';
    alert('Could not start video call: '+e.message+'\n\nMake sure you are connected to the internet.');
  }
}

function lcEndMeeting(){
  if(_dailyFrame){
    try{_dailyFrame.destroy();}catch(e){}
    _dailyFrame=null;
  }
  const frameEl=document.getElementById('lc-daily-frame');
  if(frameEl) frameEl.innerHTML='';
  // Return to lobby
  const active=document.getElementById('lc-vc-active');
  const lobby=document.getElementById('lc-vc-lobby');
  if(active) active.style.display='none';
  if(lobby){ lobby.style.display='flex'; lcRenderInvitePanel(); }
}

function lcOpenVideoCall(){
  lcActiveChannel='__video_call__';

  // Full sidebar re-render to highlight the video call entry
  renderLouChat();

  // Update header
  const icon=document.getElementById('lc-channel-icon');
  const title=document.getElementById('lc-channel-title');
  const desc=document.getElementById('lc-channel-desc');
  if(icon) icon.innerHTML=_icon('video',16);
  if(title) title.textContent='Video Call';
  if(desc) desc.textContent='Start a call and invite your team';

  // Hide chat elements, show video call view
  const msgsEl=document.getElementById('lc-messages');
  const inputEl=document.getElementById('lc-input-area');
  const pinnedEl=document.getElementById('lc-pinned-bar');
  const actionsEl=document.getElementById('lc-channel-actions');
  const vcView=document.getElementById('lc-video-call-view');
  if(msgsEl) msgsEl.style.display='none';
  if(inputEl) inputEl.style.display='none';
  if(pinnedEl) pinnedEl.style.display='none';
  if(actionsEl) actionsEl.style.display='none';
  if(vcView) vcView.style.display='flex';

  // Make sure we're in lobby state
  const lobby=document.getElementById('lc-vc-lobby');
  const active=document.getElementById('lc-vc-active');
  if(lobby) lobby.style.display='flex';
  if(active) active.style.display='none';

  lcRenderInvitePanel();
}

function lcRenderInvitePanel(){
  const session=gateGetSession();
  const list=document.getElementById('lc-invite-list');
  if(!list) return;

  // Gather all team members excluding the current user
  const allMembers=[...getAdminTeamMembers()].filter(m=>m.email!==session?.email&&m.name!==session?.name);

  if(!allMembers.length){
    list.innerHTML='<div style="color:var(--muted);font-size:13px;padding:12px 0">No other team members found. Add teammates in the Team tab.</div>';
    return;
  }

  list.innerHTML=allMembers.map(m=>{
    const avatar=getAvatarHtml(m.name,m.email||'',38,13);
    const title=m.jobTitle||m.role||'Team member';
    return `<label style="display:flex;align-items:center;gap:14px;padding:11px 14px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);cursor:pointer;transition:border-color .15s;user-select:none" onmouseover="this.style.borderColor='var(--border-bright)'" onmouseout="this.style.borderColor='var(--border)'">
      <input type="checkbox" class="lc-invite-check" value="${m.email||m.name}" data-name="${m.name}" style="accent-color:var(--blue);width:16px;height:16px;flex-shrink:0;cursor:pointer">
      ${avatar}
      <div style="flex:1;min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--white)">${m.name}</div>
        <div style="font-size:11px;color:var(--muted)">${title}</div>
      </div>
    </label>`;
  }).join('');
}

function lcToggleMeetingNotes(){
  const panel=document.getElementById('lc-meeting-notes-panel');
  if(!panel) return;
  const isOpen=panel.style.display==='none'||!panel.style.display;
  panel.style.display=isOpen?'block':'none';
  if(isOpen) document.getElementById('lc-meeting-title')?.focus();
}

function lcSaveMeetingNotes(){
  const title=document.getElementById('lc-meeting-title')?.value.trim()||'Meeting Notes';
  const notes=document.getElementById('lc-meeting-notes')?.value.trim();
  if(!notes){alert('Please enter some notes first.');return;}
  if(!lcActiveChannel) return;

  const session=gateGetSession();
  const now=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'});

  const msg={
    id:Date.now(),
    author:session?.name||'DroneHub',
    authorEmail:session?.email||'',
    channelId:lcActiveChannel,
    text:'**'+title+'**\n_'+now+'_\n\n'+notes,
    ts:new Date().toISOString(),
    reactions:{},
    attachments:[],
  };
  saveLcMessage(lcActiveChannel,msg);
  lcRenderMessages();

  // Clear and close notes panel
  if(document.getElementById('lc-meeting-title')) document.getElementById('lc-meeting-title').value='';
  if(document.getElementById('lc-meeting-notes')) document.getElementById('lc-meeting-notes').value='';
  document.getElementById('lc-meeting-notes-panel').style.display='none';
}

function lcDeleteMessage(channelId, msgId){
  if(!confirm('Delete this message?')) return;
  const key='dronehub_lc_msgs_'+channelId;
  const msgs=JSON.parse(localStorage.getItem(key)||'[]');
  const filtered=msgs.filter(m=>m.id!==msgId);
  localStorage.setItem(key,JSON.stringify(filtered));
  fbSet('orgs',ORG_ID+':lc_msgs_'+channelId,{channelId,msgs:JSON.stringify(filtered),updatedAt:Date.now()});
  lcRenderMessages();
}

// ── BROWSER NOTIFICATIONS ─────────────────────────────────────────────────────
function lcRequestNotifications(){
  if('Notification' in window&&Notification.permission==='default'){
    Notification.requestPermission();
  }
}

function lcSendNotification(author, text, channelName){
  const session=gateGetSession();
  // Don't notify for your own messages
  if(session?.name===author||session?.email===author) return;
  if(!('Notification' in window)||Notification.permission!=='granted') return;
  // Don't notify if LouChat tab is currently active
  const lcPane=document.getElementById('pane-louchat');
  if(lcPane&&lcPane.classList.contains('active')&&document.hasFocus()) return;
  new Notification('LouChat — #'+channelName, {
    body:author+': '+text.slice(0,80),
    icon:'https://sparkly-halva-0d1aa9.netlify.app/favicon.ico',
    badge:'https://sparkly-halva-0d1aa9.netlify.app/favicon.ico',
    tag:'louchat-'+Date.now(),
  });
}

async function lcSendMessage(){
  const input=document.getElementById('lc-msg-input');
  const text=(input?.value||'').trim();
  if(!text&&!lcPendingAttachments.length) return;
  if(!lcActiveChannel){alert('Please select a channel first.');return;}
  // Welcome channel is read-only — should never be able to send from it
  if(lcActiveChannel==='lc_welcome') return;

  // Double-check the active channel exists
  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===lcActiveChannel);
  if(!ch){console.error('Channel not found:',lcActiveChannel);return;}

  const session=gateGetSession();
  const author=session?.name||bizSettings?.name||'DroneHub Admin';
  const authorEmail=session?.email||'';
  const msg={
    id:Date.now(),
    author,
    authorEmail,
    channelId:lcActiveChannel, // store which channel this belongs to
    text,
    ts:new Date().toISOString(),
    reactions:{},
    attachments:lcPendingAttachments.length?[...lcPendingAttachments]:[],
  };
  await saveLcMessage(lcActiveChannel,msg);

  // @mention notifications — detect @Name in the message and notify
  if(text){
    const mentions=[...text.matchAll(/@([A-Za-z][A-Za-z0-9_.\- ]*?)(?=\s|$|[,!?.()\[\]])/g)].map(m=>m[1].trim());
    if(mentions.length){
      mentions.forEach(name=>{
        lcSendMentionNotif(name,author,ch.name,lcActiveChannel,text);
      });
    }
  }

  // If replying in a client DM channel → mirror back to portal_msgs
  // so the client sees the reply in the matching portal conversation,
  // signed with the replying admin's name
  if(ch.type==='client_dm' && ch.clientId){
    const _replyBy=gateGetSession()?.name||'DroneHub Media';
    savePortalMessage(ch.clientId,'team',text,{to:ch.adminName||'team',by:_replyBy}); // fire-and-forget
  }

  if(input){input.value='';input.style.height='auto';}
  const _sb=document.getElementById('lc-send-btn');
  if(_sb) _sb.style.display='none';
  lcPendingAttachments=[];
  lcRenderAttachPreview();
  const picker=document.getElementById('lc-emoji-picker');
  if(picker) picker.style.display='none';
  const dd=document.getElementById('lc-mention-dropdown');
  if(dd) dd.style.display='none';
  lcRenderMessages();
}

// Drag and drop on the messages area
function lcInitDragDrop(){
  const msgArea=document.getElementById('lc-messages');
  if(!msgArea||msgArea._ddInit) return;
  msgArea._ddInit=true;
  msgArea.addEventListener('dragover',e=>{
    e.preventDefault();
    msgArea.style.background='rgba(91,141,239,.08)';
    msgArea.style.outline='2px dashed var(--blue)';
  });
  msgArea.addEventListener('dragleave',()=>{
    msgArea.style.background='';
    msgArea.style.outline='';
  });
  msgArea.addEventListener('drop',e=>{
    e.preventDefault();
    msgArea.style.background='';
    msgArea.style.outline='';
    const files=e.dataTransfer?.files;
    if(files&&files.length) lcHandleFiles(files,'drop');
  });
}

// ── Create channel modal state ──────────────────────────────────────────────
let _lcSelectedMembers=[];
let _lcMemberSearchResults=[];
let _lcGroupPhoto='';
let _lcChannelType='general';

function lcSelectChannelType(type){
  _lcChannelType=type;
  const types=['general','project','client','social','admin'];
  types.forEach(t=>{
    const btn=document.getElementById('lc-type-btn-'+t);
    if(!btn) return;
    const isActive=t===type;
    btn.style.background=isActive?'rgba(94,159,255,.18)':'rgba(255,255,255,.05)';
    btn.style.border=isActive?'1px solid rgba(94,159,255,.5)':'1px solid rgba(255,255,255,.08)';
    btn.style.color=isActive?'var(--white)':'var(--muted)';
    const ico=btn.querySelector('svg');
    if(ico) ico.style.stroke=isActive?'var(--blue-bright)':'currentColor';
  });
}

function lcHandleGroupPhoto(input){
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    _lcGroupPhoto=e.target.result;
    const img=document.getElementById('lc-group-photo-img');
    const icon=document.getElementById('lc-group-photo-icon');
    if(img){img.src=_lcGroupPhoto;img.style.display='block';}
    if(icon) icon.style.display='none';
  };
  reader.readAsDataURL(file);
}

function lcOpenCreateModal(){
  const s=gateGetSession();
  if(s?.type!=='admin'&&s?.role!=='admin') return;
  _lcSelectedMembers=[];
  _lcMemberSearchResults=[];
  _lcGroupPhoto='';
  _lcChannelType='general';
  const modal=document.getElementById('lc-create-modal');
  if(!modal) return;
  document.getElementById('lc-new-channel-name').value='';
  document.getElementById('lc-member-search').value='';
  document.getElementById('lc-member-search-results').style.display='none';
  document.getElementById('lc-selected-members').innerHTML='';
  // Reset photo preview
  const img=document.getElementById('lc-group-photo-img');
  const icon=document.getElementById('lc-group-photo-icon');
  const photoInput=document.getElementById('lc-group-photo-input');
  if(img){img.src='';img.style.display='none';}
  if(icon) icon.style.display='';
  if(photoInput) photoInput.value='';
  modal.style.display='flex';
  setTimeout(()=>{
    lcSelectChannelType('general');
    document.getElementById('lc-new-channel-name').focus();
  },60);
}

function lcCloseCreateModal(){
  const modal=document.getElementById('lc-create-modal');
  if(modal) modal.style.display='none';
}

function lcSearchMembers(query){
  const resultsEl=document.getElementById('lc-member-search-results');
  if(!query.trim()){resultsEl.style.display='none';return;}
  const q=query.toLowerCase();
  const all=getAdminTeamMembers();
  _lcMemberSearchResults=all.filter(m=>
    !_lcSelectedMembers.find(s=>s.email===m.email)&&
    ((m.name||'').toLowerCase().includes(q)||(m.email||'').toLowerCase().includes(q))
  ).slice(0,7);
  if(!_lcMemberSearchResults.length){resultsEl.style.display='none';return;}
  resultsEl.innerHTML=_lcMemberSearchResults.map((m,i)=>`
    <button onclick="lcSelectMember(${i})" style="display:flex;align-items:center;gap:10px;width:100%;padding:9px 12px;border:none;background:transparent;cursor:pointer;text-align:left" onmouseover="this.style.background='rgba(255,255,255,.06)'" onmouseout="this.style.background='transparent'">
      ${getAvatarHtml(m.name||m.email,m.email,30,11)}
      <div>
        <div style="font-size:12px;font-weight:700;color:var(--white)">${m.name||m.email}</div>
        <div style="font-size:10px;color:var(--muted)">${m.email||m.role||''}</div>
      </div>
    </button>
  `).join('');
  resultsEl.style.display='block';
}

function lcSelectMember(idx){
  const m=_lcMemberSearchResults[idx];
  if(!m||_lcSelectedMembers.find(s=>s.email===m.email)) return;
  _lcSelectedMembers.push(m);
  document.getElementById('lc-member-search').value='';
  document.getElementById('lc-member-search-results').style.display='none';
  _lcMemberSearchResults=[];
  lcRenderSelectedMembers();
}

function lcRemoveSelectedMember(email){
  _lcSelectedMembers=_lcSelectedMembers.filter(m=>m.email!==email);
  lcRenderSelectedMembers();
}

function lcRenderSelectedMembers(){
  const el=document.getElementById('lc-selected-members');
  if(!el) return;
  if(!_lcSelectedMembers.length){el.innerHTML='';return;}
  el.innerHTML=_lcSelectedMembers.map(m=>`
    <div style="display:inline-flex;align-items:center;gap:5px;padding:4px 8px 4px 5px;background:rgba(94,159,255,.14);border:1px solid rgba(94,159,255,.28);border-radius:20px">
      ${getAvatarHtml(m.name||m.email,m.email,20,8)}
      <span style="font-size:11px;font-weight:700;color:var(--offwhite);max-width:90px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${(m.name||m.email).split(' ')[0]}</span>
      <button onclick="lcRemoveSelectedMember('${m.email}')" style="width:14px;height:14px;border-radius:50%;border:none;background:rgba(255,255,255,.14);color:var(--muted);font-size:9px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;flex-shrink:0;line-height:1">✕</button>
    </div>
  `).join('');
}

function lcCreateChannel(){
  const s=gateGetSession();
  if(s?.type!=='admin'&&s?.role!=='admin'){alert('Only admins can create channels.');return;}
  const name=document.getElementById('lc-new-channel-name')?.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'-').replace(/-+/g,'-');
  const type=_lcChannelType||'general';
  if(!name){document.getElementById('lc-new-channel-name')?.focus();return;}
  const channels=getLcChannels();
  if(channels.find(c=>c.name===name)){alert('A channel with that name already exists.');return;}
  const members=_lcSelectedMembers.map(m=>m.email);
  const newChannel={id:'lc_'+Date.now(),name,type,topic:'',createdAt:new Date().toISOString().slice(0,10),pinned:'',members,photo:_lcGroupPhoto||''};
  channels.push(newChannel);
  saveLcChannels(channels);
  lcCloseCreateModal();
  renderLouChat();
  lcOpenChannel(newChannel.id);
}

function lcDeleteChannel(channelId){
  if(!channelId) return;
  const channels=getLcChannels();
  const ch=channels.find(c=>c.id===channelId);
  if(!ch){return;}
  if(['lc_general','lc_welcome'].includes(channelId)){alert('#'+ch.name+' cannot be deleted.');return;}
  if(!confirm('Delete #'+ch.name+'? All messages will be lost.')) return;
  saveLcChannels(channels.filter(c=>c.id!==channelId));
  deleteLcChannelMessages(channelId);
  lcActiveChannel=null;
  document.getElementById('lc-input-area').style.display='none';
  document.getElementById('lc-channel-actions').style.display='none';
  document.getElementById('lc-channel-title').textContent='Select a channel';
  document.getElementById('lc-channel-desc').textContent='Choose a channel from the sidebar';
  document.getElementById('lc-channel-icon').innerHTML=LC_SVG.general;
  document.getElementById('lc-messages').innerHTML=`<div style="text-align:center;padding:40px;color:var(--muted);font-size:13px" id="lc-empty-state"><div style="margin-bottom:10px;color:var(--muted)">${_icon('chat',32)}</div>Select a channel to start chatting</div>`;
  document.getElementById('lc-pinned-bar').style.display='none';
  renderLouChat();
}

function lcToggleAddForm(){
  const s=gateGetSession();
  if(s?.type!=='admin'&&s?.role!=='admin') return;
  const form=document.getElementById('lc-add-form');
  const btn=document.getElementById('lc-add-btn');
  const open=form.style.display==='none';
  form.style.display=open?'block':'none';
  btn.innerHTML=open?'<span style="font-size:16px">✕</span> Cancel':'<span style="font-size:16px">+</span> New channel';
  if(open) document.getElementById('lc-new-channel-name').focus();
}

function lcReact(channelId, msgId, emoji){
  const key='dronehub_lc_msgs_'+channelId;
  const msgs=JSON.parse(localStorage.getItem(key)||'[]');
  const msg=msgs.find(m=>m.id===msgId);
  if(!msg) return;
  if(!msg.reactions) msg.reactions={};
  msg.reactions[emoji]=(msg.reactions[emoji]||0)+1;
  try{localStorage.setItem(key,JSON.stringify(msgs));}catch(e){}
  fbSet('orgs',ORG_ID+':lc_msgs_'+channelId,{channelId,msgs:JSON.stringify(msgs),updatedAt:Date.now()});
  lcRenderMessages();
}

// ── @MENTION SYSTEM ───────────────────────────────────────────────────────────

// Show autocomplete dropdown when user types @
function lcHandleMentionInput(textarea){
  const val=textarea.value;
  const cursor=textarea.selectionStart;
  const beforeCursor=val.slice(0,cursor);
  const atMatch=beforeCursor.match(/@([A-Za-z0-9_.\- ]*)$/);
  const dropdown=document.getElementById('lc-mention-dropdown');
  if(!dropdown) return;

  if(!atMatch){dropdown.style.display='none';return;}

  const query=atMatch[1].toLowerCase();
  const seen=new Set();
  const allMembers=[...getAdminTeamMembers(),...getTeamMembers()];
  const matches=allMembers.filter(m=>{
    if(!m.name||seen.has(m.name.toLowerCase())) return false;
    seen.add(m.name.toLowerCase());
    return !query||m.name.toLowerCase().includes(query);
  }).slice(0,6);

  if(!matches.length){dropdown.style.display='none';return;}

  dropdown.innerHTML=matches.map((m,i)=>{
    const initials=(m.name||'?').split(' ').map(w=>w[0]||'').join('').slice(0,2).toUpperCase();
    const bg=['#5B8DEF','#22D97A','#F5A623','#8B5CF6','#F05252','#E879F9'][m.name.charCodeAt(0)%6];
    const photo=getProfilePhoto(m.email||'');
    const avatar=photo
      ?`<img src="${photo}" alt="" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0">`
      :`<div style="width:28px;height:28px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0">${initials}</div>`;
    const safeName=m.name.replace(/'/g,"\\'");
    return `<div onclick="lcInsertMention('${safeName}')" style="padding:7px 10px;cursor:pointer;display:flex;align-items:center;gap:8px;border-radius:7px;transition:background .1s" onmouseover="this.style.background='rgba(91,141,239,.18)'" onmouseout="this.style.background='transparent'">
      ${avatar}
      <div style="min-width:0">
        <div style="font-size:13px;font-weight:600;color:var(--white)">${m.name}</div>
        ${m.role?`<div style="font-size:10px;color:var(--muted)">${m.role}</div>`:''}
      </div>
    </div>`;
  }).join('');
  dropdown.style.display='block';
}

// Insert @Name into the message input at the cursor position
function lcInsertMention(name){
  const input=document.getElementById('lc-msg-input');
  if(!input) return;
  const val=input.value;
  const cursor=input.selectionStart;
  const before=val.slice(0,cursor);
  const after=val.slice(cursor);
  const newBefore=before.replace(/@[A-Za-z0-9_.\- ]*$/,'@'+name+' ');
  input.value=newBefore+after;
  const pos=newBefore.length;
  input.setSelectionRange(pos,pos);
  input.focus();
  const dd=document.getElementById('lc-mention-dropdown');
  if(dd) dd.style.display='none';
  // Resize
  input.style.height='auto';
  input.style.height=Math.min(input.scrollHeight,120)+'px';
}

// Notify a mentioned team member — stores in Firebase so they see it on next login
function lcSendMentionNotif(mentionedName, fromAuthor, channelName, channelId, text){
  // Don't notify yourself
  const session=gateGetSession();
  if((session?.name||'').toLowerCase()===mentionedName.toLowerCase()) return;

  // Find mentioned person's email
  const allMembers=[...getAdminTeamMembers(),...getTeamMembers()];
  const person=allMembers.find(m=>(m.name||'').toLowerCase()===mentionedName.toLowerCase());
  const toEmail=person?.email||'';

  const notif={
    id:Date.now()+Math.random(),
    toName:mentionedName,
    toEmail,
    from:fromAuthor,
    channelName,
    channelId,
    text:text.slice(0,120),
    ts:new Date().toISOString(),
  };

  // Store in Firebase — read by the mentioned user on their next load
  if(_fbToken()){
    fbGet('orgs',ORG_ID+':lc_mentions').then(existing=>{
      const list=existing?.list?JSON.parse(existing.list):[];
      list.push(notif);
      // Keep last 500 mentions total
      const trimmed=list.slice(-500);
      fbSet('orgs',ORG_ID+':lc_mentions',{list:JSON.stringify(trimmed),updatedAt:Date.now()});
    }).catch(()=>{});
  }

  // Also fire browser notification immediately for anyone with the app open
  if('Notification' in window&&Notification.permission==='granted'){
    new Notification('LouChat — @mention in #'+channelName,{
      body:fromAuthor+' mentioned @'+mentionedName+': '+text.slice(0,80),
      icon:'https://sparkly-halva-0d1aa9.netlify.app/favicon.ico',
      tag:'lc-mention-'+Date.now(),
    });
  }
}

// Check Firebase for unread @mentions for the current user; updates badge
async function lcCheckMentions(){
  const session=gateGetSession();
  if(!session) return;
  if(!_fbToken()) return;
  try{
    const data=await fbGet('orgs',ORG_ID+':lc_mentions');
    if(!data?.list) return;
    const list=JSON.parse(data.list);
    const myEmail=(session.email||'').toLowerCase();
    const myName=(session.name||'').toLowerCase();
    // Find mentions to me that arrived after my last read time
    const lastRead=parseInt(localStorage.getItem('dronehub_lc_mentions_read')||'0');
    const mine=list.filter(n=>{
      const isMe=(myEmail&&(n.toEmail||'').toLowerCase()===myEmail)||(myName&&(n.toName||'').toLowerCase()===myName);
      return isMe&&new Date(n.ts).getTime()>lastRead;
    });
    if(mine.length>0){
      localStorage.setItem('dronehub_lc_mention_count',String(mine.length));
      // Show a mention notification bubble on the LouChat tab badge
      const badge=document.getElementById('lc-nav-badge');
      if(badge){
        const existing=parseInt(badge.textContent)||0;
        const total=existing+mine.length;
        badge.textContent=total>99?'99+':String(total);
        badge.style.display='inline-block';
      }
    }
  }catch(e){}
}

// Mark all mentions as read (call when user opens LouChat)
function lcMarkMentionsRead(){
  localStorage.setItem('dronehub_lc_mentions_read',String(Date.now()));
  localStorage.removeItem('dronehub_lc_mention_count');
}


// ═══════════════════════════════════════════════════════════════════════════
