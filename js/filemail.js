// ─── FILEMAIL INTEGRATION — browse & link transfers to tracker projects ──────

let _fmTransfers = null;
let _fmLinkJobId = null;
let _fmConnected = null; // null=unknown, true/false after ping

function _fmProxy(body){
  return fetch('/.netlify/functions/filemail-proxy',{
    method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)
  }).then(r=>r.json());
}

async function _fmEnsureConnected(){
  if(_fmConnected===true) return true;
  try{
    const res=await _fmProxy({action:'ping'});
    if(res.email || res.userid || res.username || (res.responsestatus&&res.responsestatus!=='Failed')){
      _fmConnected=true;
      return true;
    }
    if(res.statusCode===401 || res.status===401 || res.error){
      _fmConnected=false;
      return false;
    }
    _fmConnected=true;
    return true;
  }catch(e){
    _fmConnected=false;
    return false;
  }
}

async function fmLoadTransfers(){
  const body={action:'sent',limit:50,getexpired:true};
  try{
    const res=await _fmProxy(body);
    const transfers=res.transfers||res.data?.transfers||[];
    _fmTransfers=transfers;
    return transfers;
  }catch(e){
    return [];
  }
}

function fmOpenBrowser(jobId){
  _fmLinkJobId=jobId||null;
  let overlay=document.getElementById('fm-browser-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='fm-browser-overlay';
    overlay.onclick=e=>{if(e.target===overlay)fmCloseBrowser();};
    overlay.style.cssText='position:fixed;inset:0;z-index:9900;background:rgba(0,0,0,.78);display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML=`<div onclick="event.stopPropagation()" style="background:var(--navy-deep,#0f1724);border:1px solid var(--border-bright,#2a3454);border-radius:16px;width:100%;max-width:720px;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.6)">
      <div id="fm-browser-content" style="padding:20px"></div>
    </div>`;
    document.body.appendChild(overlay);
  }
  overlay.style.display='flex';
  fmRenderBrowser();
}

function fmCloseBrowser(){
  const o=document.getElementById('fm-browser-overlay');
  if(o) o.style.display='none';
  _fmLinkJobId=null;
}

async function fmRenderBrowser(){
  const root=document.getElementById('fm-browser-content');
  if(!root) return;

  root.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
      <div style="font-size:16px;font-weight:700;color:var(--white);display:flex;align-items:center;gap:8px">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--blue-bright)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Filemail
      </div>
      <button onclick="fmCloseBrowser()" style="border:none;background:none;color:var(--muted);font-size:20px;cursor:pointer;padding:4px">✕</button>
    </div>
    <div id="fm-transfers-list" style="color:var(--muted);text-align:center;padding:20px;font-size:12px">Connecting to Filemail…</div>`;

  const connected=await _fmEnsureConnected();
  if(!connected){
    document.getElementById('fm-transfers-list').innerHTML=`
      <div style="text-align:center;padding:30px">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:12px"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        <div style="color:var(--white);font-size:14px;font-weight:700;margin-bottom:6px">Filemail Not Connected</div>
        <div style="color:var(--muted);font-size:12px;line-height:1.6;max-width:400px;margin:0 auto">
          The Filemail API key needs to be added to Netlify environment variables.<br>
          Go to your <a href="https://www.filemail.com" target="_blank" style="color:var(--blue-bright)">Filemail account settings</a> to find your API key,
          then add it as <code style="background:rgba(255,255,255,.06);padding:2px 6px;border-radius:4px;font-size:11px">FILEMAIL_API_KEY</code> in Netlify.
        </div>
        <button onclick="fmRetryConnect()" style="margin-top:16px;padding:8px 20px;border-radius:8px;border:1px solid var(--border-bright);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">Retry Connection</button>
      </div>`;
    return;
  }

  // Connected — load transfers
  const transfers=await fmLoadTransfers();
  _fmRenderTransferList(transfers);

  // Add sync button at top
  const syncRow=document.createElement('div');
  syncRow.style.cssText='display:flex;gap:8px;margin-bottom:14px;align-items:center;flex-wrap:wrap';
  syncRow.innerHTML=`
    <button onclick="fmRunSync()" id="fm-modal-sync" style="padding:6px 14px;border-radius:8px;border:1px solid rgba(34,217,122,.4);background:rgba(34,217,122,.08);color:#22D97A;font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px;white-space:nowrap">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
      Auto-Sync to Tracker
    </button>
    <span style="font-size:11px;color:var(--muted)">Match transfers to projects by address / client name</span>`;
  const list=document.getElementById('fm-transfers-list');
  list.parentNode.insertBefore(syncRow,list);
}

async function fmRetryConnect(){
  _fmConnected=null;
  fmRenderBrowser();
}

async function fmRunSync(){
  const btn=document.getElementById('fm-modal-sync');
  if(btn){btn.disabled=true;btn.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="animation:spin 1s linear infinite"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Syncing…';}
  const result=await fmAutoSync();
  if(typeof showDhToast==='function'){
    showDhToast('Filemail synced',result.msg,'✓',result.matched>0?'var(--green)':'var(--muted)');
  }
  if(btn){btn.disabled=false;btn.innerHTML='<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg> Auto-Sync to Tracker';}
}

function _fmFormatSize(bytes){
  if(!bytes) return '';
  if(bytes>1e9) return (bytes/1e9).toFixed(1)+' GB';
  if(bytes>1e6) return (bytes/1e6).toFixed(1)+' MB';
  if(bytes>1e3) return (bytes/1e3).toFixed(0)+' KB';
  return bytes+' B';
}

function _fmFileIcon(filename){
  const ext=(filename||'').split('.').pop().toLowerCase();
  const video=['mp4','mov','avi','mkv','wmv','m4v','webm','prproj','fcpx'];
  const image=['jpg','jpeg','png','gif','tiff','tif','raw','cr2','nef','arw','dng','psd','ai','heic'];
  const audio=['mp3','wav','aac','flac','m4a','ogg'];
  const doc=['pdf','doc','docx','xls','xlsx','csv','txt','rtf'];
  const zip=['zip','rar','7z','tar','gz'];
  if(video.includes(ext)) return {icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',color:'var(--blue-bright)'};
  if(image.includes(ext)) return {icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',color:'#E879F9'};
  if(audio.includes(ext)) return {icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',color:'var(--amber)'};
  if(doc.includes(ext)) return {icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',color:'var(--green)'};
  if(zip.includes(ext)) return {icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8v13H3V8"/><path d="M1 3h22v5H1z"/><path d="M10 12h4"/></svg>',color:'var(--muted)'};
  return {icon:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/></svg>',color:'var(--muted)'};
}

function fmToggleTransfer(id){
  const el=document.getElementById('fm-detail-'+id);
  if(!el) return;
  el.style.display=el.style.display==='none'?'block':'none';
  const chevron=document.getElementById('fm-chev-'+id);
  if(chevron) chevron.style.transform=el.style.display==='none'?'':'rotate(180deg)';
}

function _fmRenderTransferList(transfers){
  const list=document.getElementById('fm-transfers-list');
  if(!list) return;
  if(!transfers||!transfers.length){
    list.innerHTML='<div style="text-align:center;padding:30px;color:var(--muted);font-size:12px">No transfers found.</div>';
    return;
  }
  list.innerHTML=transfers.map((t,idx)=>{
    const date=t.created?new Date(t.created).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'';
    const expired=t.status==='STATUS_DELETED'||t.status==='STATUS_CANCELLED'||(t.expiredate&&new Date(t.expiredate)<new Date());
    const files=t.files||[];
    const totalSize=files.reduce((s,f)=>s+(f.filesize||0),0);
    const sizeStr=_fmFormatSize(totalSize);
    const recipients=(t.recipients||[]).map(r=>r.to||r.email||'').filter(Boolean).join(', ');
    const subject=t.subject||t.message||'';
    const tid='fmt'+idx;
    const linkBtn=_fmLinkJobId
      ?`<button onclick="event.stopPropagation();fmLinkToProject('${t.id}','${(t.url||'').replace(/'/g,"\\'")}')" style="padding:4px 12px;border-radius:7px;border:1px solid rgba(34,217,122,.5);background:rgba(34,217,122,.1);color:var(--green);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">Link to Project</button>`
      :'';

    const fileRows=files.map(f=>{
      const fi=_fmFileIcon(f.filename);
      const fSize=_fmFormatSize(f.filesize);
      const dlUrl=f.downloadurl||f.url||'';
      return `<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-radius:8px;transition:background .15s" onmouseover="this.style.background='rgba(255,255,255,.04)'" onmouseout="this.style.background='transparent'">
        <span style="color:${fi.color};flex-shrink:0">${fi.icon}</span>
        <span style="color:var(--offwhite);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0">${f.filename||'file'}</span>
        <span style="color:var(--muted);font-size:10px;white-space:nowrap;flex-shrink:0">${fSize}</span>
        ${dlUrl&&!expired?`<a href="${dlUrl}" target="_blank" onclick="event.stopPropagation()" style="padding:3px 10px;border-radius:6px;border:1px solid rgba(91,141,239,.4);background:rgba(91,141,239,.08);color:var(--blue-bright);font-size:10px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0">Download</a>`:''}
      </div>`;
    }).join('');

    const message=t.message?`<div style="font-size:11px;color:var(--muted);padding:8px 10px;line-height:1.5;background:rgba(0,0,0,.15);border-radius:8px;margin-bottom:8px;white-space:pre-wrap;word-break:break-word">${t.message}</div>`:'';

    return `<div class="card" style="margin-bottom:8px;padding:0;${expired?'opacity:.5':''}">
      <div onclick="fmToggleTransfer('${tid}')" style="padding:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:flex-start;gap:10px" onmouseover="this.style.background='rgba(255,255,255,.02)'" onmouseout="this.style.background='transparent'">
        <div style="min-width:0;flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--white);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;display:flex;align-items:center;gap:6px">
            <svg id="fm-chev-${tid}" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;transition:transform .15s"><polyline points="6 9 12 15 18 9"/></svg>
            ${subject||'(No subject)'}
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px;margin-left:16px">
            ${date}${recipients?' · To: '+recipients:''}${files.length?' · '+files.length+' file'+(files.length>1?'s':''):''} ${sizeStr?' · '+sizeStr:''}${expired?' · <span style="color:var(--red)">Expired</span>':''}
          </div>
        </div>
        <div style="display:flex;gap:5px;flex-shrink:0" onclick="event.stopPropagation()">
          ${linkBtn}
          ${t.compressedfileurl&&!expired?`<a href="${t.compressedfileurl}" target="_blank" style="padding:4px 10px;border-radius:7px;border:1px solid rgba(91,141,239,.5);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap">↓ All (ZIP)</a>`:''}
        </div>
      </div>
      <div id="fm-detail-${tid}" style="display:none;padding:0 12px 12px;border-top:1px solid var(--border)">
        ${message}
        ${files.length?`<div style="margin-top:6px">${fileRows}</div>`:'<div style="padding:10px;color:var(--muted);font-size:11px">No files in this transfer.</div>'}
      </div>
    </div>`;
  }).join('');
}

function fmLinkToProject(transferId, transferUrl){
  if(!_fmLinkJobId) return;
  const mode=_trackerMode||'video';
  _fmLinkJob(mode, _fmLinkJobId, transferUrl);
  if(typeof showDhToast==='function') showDhToast('Linked!','Filemail transfer linked to this project.','✓','var(--green)');
  fmCloseBrowser();
  if(typeof renderTracker==='function') renderTracker();
}

function _fmLinkJob(mode, jobId, url){
  const key=mode==='photo'?'dronehub_photo_tracker':'dronehub_tracker';
  const stages=JSON.parse(localStorage.getItem(key)||'{}');
  const ts=stages[jobId]||{};
  const existing=ts.filemailLinks||[];
  if(ts.filemailLink&&!existing.includes(ts.filemailLink)) existing.unshift(ts.filemailLink);
  if(!existing.includes(url)) existing.push(url);
  ts.filemailLinks=existing;
  if(!ts.filemailLink) ts.filemailLink=url;
  stages[jobId]=ts;
  try{localStorage.setItem(key,JSON.stringify(stages));}catch(e){}
  if(typeof _fbToken==='function'&&_fbToken()) fbSubSet('tracker_meta','stages_'+mode,stages).catch(()=>{});
}

// ─── AUTO-MATCH: link Filemail transfers to tracker projects by address/client ─

let _fmAutoSynced=false;

function _fmNormalize(str){
  return (str||'').toLowerCase().replace(/[^a-z0-9]/g,' ').replace(/\s+/g,' ').trim();
}

function _fmMatchScore(transferText, projectAddr, clientName){
  const t=_fmNormalize(transferText);
  if(!t) return 0;
  const addr=_fmNormalize(projectAddr);
  const client=_fmNormalize(clientName);

  if(addr.length>=5 && t.includes(addr)) return 100;

  if(addr.length>=5){
    const addrParts=addr.split(' ').filter(p=>p.length>=2);
    if(addrParts.length>=2){
      const matched=addrParts.filter(p=>t.includes(p));
      const ratio=matched.length/addrParts.length;
      if(ratio>=0.7 && addrParts.length>=2) return Math.round(ratio*80);
    }
  }

  if(client.length>=3 && t.includes(client)) return 60;

  if(client.length>=3){
    const nameParts=client.split(' ').filter(p=>p.length>=3);
    if(nameParts.length>=2){
      const matched=nameParts.filter(p=>t.includes(p));
      if(matched.length>=2) return 50;
    }
  }

  return 0;
}

async function fmAutoSync(mode){
  if(!await _fmEnsureConnected()) return {matched:0, msg:'Filemail not connected.'};

  const transfers=await fmLoadTransfers();
  if(!transfers||!transfers.length) return {matched:0, msg:'No Filemail transfers found.'};

  mode=mode||_trackerMode||'video';
  const key=mode==='photo'?'dronehub_photo_tracker':'dronehub_tracker';
  const stages=JSON.parse(localStorage.getItem(key)||'{}');
  const isPhoto=mode==='photo';

  const jobs=(typeof savedJobs!=='undefined'?savedJobs:[]).filter(j=>
    (j.status==='confirmed'||j.status==='completed')&&(isPhoto?j.isPhoto:!j.isPhoto)
  );
  const standalone=isPhoto
    ?(typeof getPhotoStandaloneProjects==='function'?getPhotoStandaloneProjects():[])
    :(typeof getStandaloneProjects==='function'?getStandaloneProjects():[]);
  standalone.forEach(sp=>{
    if(!jobs.find(j=>j.id===sp.id)){
      jobs.push({id:sp.id, name:sp.address||sp.clientName||'', address:sp.address, clientId:null, clientName:sp.clientName});
    }
  });

  let matched=0;
  const details=[];

  jobs.forEach(j=>{
    const ts=stages[j.id]||{};
    const existingLinks=ts.filemailLinks||[];
    if(ts.filemailLink&&!existingLinks.includes(ts.filemailLink)) existingLinks.push(ts.filemailLink);

    const client=(typeof clients!=='undefined')?clients.find(c=>c.id===j.clientId):null;
    const addr=j.address||j.name||'';
    const cName=client?.name||j.clientName||'';

    transfers.forEach(t=>{
      if(t.status==='STATUS_DELETED'||t.status==='STATUS_CANCELLED') return;
      if(t.expiredate && new Date(t.expiredate)<new Date()) return;
      const url=t.url||'';
      if(!url) return;
      if(existingLinks.includes(url)) return;

      const searchText=[t.subject,t.message,(t.recipients||[]).map(r=>r.to||'').join(' ')].join(' ');
      const score=_fmMatchScore(searchText, addr, cName);

      if(score>=50){
        _fmLinkJob(mode, j.id, url);
        existingLinks.push(url);
        matched++;
        details.push({job:addr||cName, transfer:t.subject||'(untitled)', score});
      }
    });
  });

  if(matched>0 && typeof renderTracker==='function') renderTracker();
  return {matched, details, msg:matched?`Linked ${matched} transfer${matched>1?'s':''} to projects.`:'No new matches found.'};
}

async function fmSyncButton(){
  if(!await _fmEnsureConnected()){
    fmOpenBrowser();
    return;
  }
  const result=await fmAutoSync();
  if(typeof showDhToast==='function'){
    showDhToast('Filemail synced',result.msg,'✓',result.matched>0?'var(--green)':'var(--muted)');
  }
}

function fmTryAutoSync(){
  if(_fmAutoSynced) return;
  _fmAutoSynced=true;
  _fmEnsureConnected().then(ok=>{
    if(ok) fmAutoSync().then(r=>{
      if(r.matched>0 && typeof showDhToast==='function'){
        showDhToast('Filemail auto-linked',r.msg,'✓','var(--green)');
      }
    });
  });
}
