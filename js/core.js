// Firebase is now accessed exclusively through server-side Netlify Functions.
// The browser never holds Firebase credentials. All reads/writes go through
// /.netlify/functions/firebase-proxy which validates a session token first.
let db=null; // kept for legacy compatibility checks — always null now
let _dhToken=null; // session token issued by /.netlify/functions/auth on login
const _PROXY='/.netlify/functions/firebase-proxy';
let ORG_ID='dronehub_main';

// ── SVG Icon Library ────────────────────────────────────────────────────────
function _icon(name,size){
  var s=size||16;
  var icons={
    lock:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" stroke-width="2"/><path d="M7 11V7a5 5 0 0110 0v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><circle cx="12" cy="16" r="1.5" fill="currentColor"/></svg>',
    key:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><circle cx="8" cy="15" r="5" stroke="currentColor" stroke-width="2"/><path d="M12 11l8-8M16 3l4 4M14 5l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    shield:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M12 2L4 6v5c0 5.5 3.5 8.5 8 10 4.5-1.5 8-4.5 8-10V6l-8-4z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    sun:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    chart:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M4 20V10M9 20V4M14 20v-8M19 20V8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    clipboard:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M9 2h6a1 1 0 011 1v1H8V3a1 1 0 011-1z" stroke="currentColor" stroke-width="2"/><path d="M8 10h8M8 14h8M8 18h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    calendar:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2"/><path d="M3 9h18M8 2v4M16 2v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    folder:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M3 6v12a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-7l-2-3H5a2 2 0 00-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    video:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><rect x="2" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="2"/><path d="M16 10l5-3v10l-5-3" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    chat:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2h-5l-3 3-3-3H4a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    dollar:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    user:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 21v-1a6 6 0 0112 0v1" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    wave:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M3 15c2.5-3 5-3 7.5 0s5 3 7.5 0M3 9c2.5-3 5-3 7.5 0s5 3 7.5 0" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    wrench:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    mail:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><rect x="2" y="4" width="20" height="16" rx="2" stroke="currentColor" stroke-width="2"/><path d="M2 7l10 6 10-6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    feedback:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M4 4h16a2 2 0 012 2v10a2 2 0 01-2 2h-5l-3 3-3-3H4a2 2 0 01-2-2V6a2 2 0 012-2z" stroke="currentColor" stroke-width="2"/><path d="M8 9h8M8 13h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    heart:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M12 21C12 21 3 14 3 8.5A4.5 4.5 0 0112 6a4.5 4.5 0 019 2.5C21 14 12 21 12 21z" stroke="currentColor" stroke-width="2"/></svg>',
    bookmark:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M5 3h14a1 1 0 011 1v17l-8-4-8 4V4a1 1 0 011-1z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    send:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    trash:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    warn:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M12 2L2 20h20L12 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M12 10v4M12 17h.01" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    check:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M5 13l4 4L19 7" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gear:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="2"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    notes:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    save:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M17 21v-8H7v8M7 3v5h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    refresh:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M1 4v6h6M23 20v-6h-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10M23 14l-4.64 4.36A9 9 0 013.51 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    circle:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="currentColor"/></svg>',
    vacation:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M17 3l4 4-9 9-4-4 9-9zM4 20l3-8 5 5-8 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    house:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M3 10l9-7 9 7v9a2 2 0 01-2 2H5a2 2 0 01-2-2v-9z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 21V12h6v9" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    hotel:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><rect x="4" y="2" width="16" height="20" rx="1" stroke="currentColor" stroke-width="2"/><path d="M9 6h2M13 6h2M9 10h2M13 10h2M9 14h2M13 14h2M9 18h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    golf:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M12 2v16M8 22c0-1.1 1.8-2 4-2s4 .9 4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round"/><path d="M12 5l6 3-6 3V5z" fill="currentColor"/></svg>',
    fire:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M12 2c1 4-2 6-2 10a4 4 0 008 0c0-4-3-6-2-10M10 16a2 2 0 004 0c0-2-2-3-2-5-0 2-2 3-2 5z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    comment:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.4 8.4 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.4 8.4 0 01-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.4 8.4 0 013.8-.9h.5a8.5 8.5 0 018 8v.5z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    share:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    edit:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>',
    sync:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M23 4v6h-6M1 20v-6h6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    camera:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="2"/></svg>',
    bell:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    download:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    plus:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>',
    search:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
    filefolder:'<svg width="'+s+'" height="'+s+'" viewBox="0 0 24 24" fill="none"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2v11z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>'
  };
  return icons[name]||name;
}
// ── Platform helpers ────────────────────────────────────────────────────────
// Scoped localStorage key — dronehub_main keeps legacy keys for backward compat
function lsKey(suffix){ return ORG_ID==='dronehub_main'?'dronehub_'+suffix:ORG_ID+'_'+suffix; }
// Platform owner check
function isPlatformOwner(email){ return (email||'').toLowerCase().trim()==='roubosb1@gmail.com'; }
// Look up which org an email belongs to (for multi-tenant logins)
async function lookupUserOrg(email){
  if(!_fbToken()) return null;
  try{
    const res=await _fbCall({action:'get',col:'platform',docId:'users'});
    const data=res?.data;
    if(data){
      const orgId=data[email.toLowerCase().replace(/[.@]/g,'_')];
      if(orgId) return orgId;
    }
  }catch(e){console.warn('lookupUserOrg failed:',e);}
  return null;
}

// Firebase helpers — safe no-ops if Firebase not loaded
// ── Firebase proxy helpers ─────────────────────────────────────────────────
// All Firestore operations go through the server-side proxy.
// If no session token is available (not logged in, or offline) the calls
// are silently skipped — localStorage remains the primary data store.
function _fbToken(){ return _dhToken||sessionStorage.getItem('dh_token')||null; }
async function _fbCall(body, _attempt=0){
  const tok=_fbToken(); if(!tok) return null;
  try{
    const r=await fetch(_PROXY,{method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},body:JSON.stringify(body)});
    if(r.status===401){
      // Token expired/invalid — clear stale token and surface the prompt here
      // (not just signal the caller) so a 401 can never go unnoticed just
      // because a particular call site forgot to check _fbAuthExpired().
      _dhToken=null; try{sessionStorage.removeItem('dh_token');}catch(e){}
      _fbShowSessionExpired();
      return {__authExpired:true};
    }
    if(r.status===429){
      // Rate limited — retry all operations with backoff (reads included,
      // because a rate-limited chunk read returns null which silently drops contacts)
      if(_attempt < 3){
        await new Promise(res=>setTimeout(res, 1500 * (_attempt+1)));
        return _fbCall(body, _attempt+1);
      }
      return null;
    }
    if(!r.ok){
      // Other server errors — retry all operations up to 3 times with backoff
      if(_attempt < 3){
        await new Promise(res=>setTimeout(res, 1000 * (_attempt+1)));
        return _fbCall(body, _attempt+1);
      }
      return null;
    }
    return await r.json();
  }catch(e){
    // Network error — retry all operations up to 3 times with backoff
    if(_attempt < 3){
      await new Promise(res=>setTimeout(res, 1000 * (_attempt+1)));
      return _fbCall(body, _attempt+1);
    }
    return null;
  }
}
// Check if a _fbCall result signals an auth expiry
function _fbAuthExpired(res){ return res && res.__authExpired===true; }
function _fbShowSessionExpired(){
  // Show a non-dismissable overlay prompting the user to sign back in
  if(document.getElementById('_fb_session_expired_overlay')) return;
  const ov=document.createElement('div');
  ov.id='_fb_session_expired_overlay';
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:99999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML=`<div style="background:#1a2236;border:1px solid #3b4f7a;border-radius:18px;padding:36px 40px;max-width:400px;text-align:center">
    <div style="margin-bottom:12px;color:var(--muted)">${_icon('lock',28)}</div>
    <div style="font-size:17px;font-weight:800;color:#fff;margin-bottom:8px">Session Expired</div>
    <div style="font-size:13px;color:#8a9bbf;margin-bottom:24px;line-height:1.6">Your session has expired or become invalid. Please sign in again to continue.</div>
    <button onclick="gateClearSession();location.reload()" style="padding:12px 32px;border-radius:12px;border:none;background:linear-gradient(135deg,#5B8DEF,#3B6FD4);color:#fff;font-size:14px;font-weight:700;cursor:pointer">Sign In Again</button>
  </div>`;
  document.body.appendChild(ov);
}
async function fbSet(col,docId,data){
  const res=await _fbCall({action:'set',col,docId,data});
  if(_fbAuthExpired(res)){ _fbShowSessionExpired(); return; }
  if(res) localStorage.setItem('dronehub_last_save',Date.now().toString());
}
async function fbGet(col,docId){
  const res=await _fbCall({action:'get',col,docId});
  if(_fbAuthExpired(res)){ _fbShowSessionExpired(); return null; }
  return res?.data??null;
}
async function fbGetAll(col){
  const res=await _fbCall({action:'getAll',col});
  return res?.data??[];
}
async function fbDelete(col,docId){
  await _fbCall({action:'delete',col,docId});
}
// Strict write — throws on any failure so callers can surface real errors.
// Use this anywhere data MUST reach Firebase (e.g. contacts, deals).
async function fbSetStrict(col,docId,data,_attempt=0){
  const tok=_fbToken();
  if(!tok) throw new Error('Not authenticated — please log in again');
  let r;
  try{
    r=await fetch(_PROXY,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({action:'set',col,docId,data}),
    });
  }catch(netErr){
    // Network-level failure (TypeError: Load failed / Failed to fetch) — retry up to 2×
    if(_attempt < 2){
      await new Promise(res=>setTimeout(res, 1200 * (_attempt+1)));
      return fbSetStrict(col,docId,data,_attempt+1);
    }
    throw new Error(netErr.message||'Network error');
  }
  if(r.status===401){
    // Token invalid/expired — clear it and show the session-expired screen
    _dhToken=null; try{sessionStorage.removeItem('dh_token');}catch(e){}
    _fbShowSessionExpired();
    throw new Error('Session expired — please sign in again');
  }
  if(r.status===429 && _attempt < 3){
    // Rate limited — wait and retry
    await new Promise(res=>setTimeout(res, 1500 * (_attempt+1)));
    return fbSetStrict(col,docId,data,_attempt+1);
  }
  if(!r.ok){
    // Other server errors — retry up to 2 times
    if(_attempt < 2){
      await new Promise(res=>setTimeout(res, 1000 * (_attempt+1)));
      return fbSetStrict(col,docId,data,_attempt+1);
    }
    let msg='Firebase error';
    try{ const j=await r.json(); msg=j.error||msg; }catch(e){}
    throw new Error(`${msg} (HTTP ${r.status})`);
  }
  const res=await r.json();
  localStorage.setItem('dronehub_last_save',Date.now().toString());
  return res;
}

// ── Sub-collection helpers (orgs/{ORG_ID}/{subCol}/...) ──────────────────────
// Each item (client, job, tracker stage, etc.) gets its own Firestore document
// instead of being packed into a single JSON blob. This prevents race conditions
// when multiple devices write simultaneously, and avoids the 1 MB doc size limit.

async function fbSubGetAll(subCol){
  const res=await _fbCall({action:'getSubCollection',col:'orgs',subCol});
  if(_fbAuthExpired(res)){ _fbShowSessionExpired(); return []; }
  return res?.data??[];
}

async function fbSubSet(subCol,docId,data){
  const res=await _fbCall({action:'setSubDoc',col:'orgs',subCol,docId:String(docId),data});
  if(_fbAuthExpired(res)){ _fbShowSessionExpired(); return; }
  if(res) localStorage.setItem('dronehub_last_save',Date.now().toString());
}

async function fbSubDelete(subCol,docId){
  await _fbCall({action:'deleteSubDoc',col:'orgs',subCol,docId:String(docId)});
}

async function fbSubBatch(subCol,docs){
  if(!docs||!docs.length) return;
  const res=await _fbCall({action:'batchSetSubDocs',col:'orgs',subCol,docs});
  if(_fbAuthExpired(res)){ _fbShowSessionExpired(); return; }
  if(res) localStorage.setItem('dronehub_last_save',Date.now().toString());
}

async function fbSubClear(subCol){
  await _fbCall({action:'deleteSubCollection',col:'orgs',subCol});
}

// Strict sub-doc write — throws on failure, retries 3×, shows session-expired on 401
async function fbSubSetStrict(subCol,docId,data,_attempt=0){
  const tok=_fbToken();
  if(!tok) throw new Error('Not authenticated — please log in again');
  let r;
  try{
    r=await fetch(_PROXY,{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({action:'setSubDoc',col:'orgs',subCol,docId:String(docId),data}),
    });
  }catch(netErr){
    if(_attempt<2){
      await new Promise(res=>setTimeout(res,1200*(_attempt+1)));
      return fbSubSetStrict(subCol,docId,data,_attempt+1);
    }
    throw new Error(netErr.message||'Network error');
  }
  if(r.status===401){
    _dhToken=null; try{sessionStorage.removeItem('dh_token');}catch(e){}
    _fbShowSessionExpired();
    throw new Error('Session expired — please sign in again');
  }
  if(r.status===429 && _attempt<3){
    await new Promise(res=>setTimeout(res,1500*(_attempt+1)));
    return fbSubSetStrict(subCol,docId,data,_attempt+1);
  }
  if(!r.ok){
    if(_attempt<2){
      await new Promise(res=>setTimeout(res,1000*(_attempt+1)));
      return fbSubSetStrict(subCol,docId,data,_attempt+1);
    }
    let msg='Firebase error';
    try{const j=await r.json();msg=j.error||msg;}catch(e){}
    throw new Error(`${msg} (HTTP ${r.status})`);
  }
  const res=await r.json();
  localStorage.setItem('dronehub_last_save',Date.now().toString());
  return res;
}

// ── Message Encryption (AES-GCM 256-bit) ─────────────────────────────────────
// Encryption key lives only in memory — never written to localStorage or disk.
// Fetched from the server on login; only authenticated sessions can decrypt.
// Format of an encrypted payload: {"v":1,"iv":"<hex>","ct":"<hex>"}
// Legacy plaintext messages are detected and passed through untouched.
let _msgKey=null;         // CryptoKey object, set after login
let _msgKeyLoading=null;  // single in-flight promise — prevents parallel fetches racing each other

async function _loadMsgKey(){
  if(_msgKey) return _msgKey;
  // If a fetch is already in flight, wait for it instead of firing a duplicate
  if(_msgKeyLoading) return _msgKeyLoading;
  const tok=_fbToken(); if(!tok) return null;
  _msgKeyLoading=(async()=>{
    try{
      const r=await fetch('/.netlify/functions/get-msg-key',{headers:{'Authorization':'Bearer '+tok}});
      if(!r.ok) return null;
      const {key}=await r.json();
      if(!key||key.length<64) return null;
      const raw=new Uint8Array(key.match(/.{2}/g).map(b=>parseInt(b,16)));
      _msgKey=await crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);
      return _msgKey;
    }catch(e){return null;}
    finally{_msgKeyLoading=null;}
  })();
  return _msgKeyLoading;
}

// Encrypt plaintext → encrypted payload string (or original text if key unavailable)
async function dhEncrypt(text){
  if(!text) return text;
  const key=await _loadMsgKey(); if(!key) return text;
  try{
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text));
    const toHex=buf=>Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
    return JSON.stringify({v:1,iv:toHex(iv),ct:toHex(ct)});
  }catch(e){return text;}
}

// Decrypt an encrypted payload string → plaintext (or indicator if key unavailable)
async function dhDecrypt(payload){
  if(!payload) return '';
  // Detect encrypted format: starts with { and contains "v":1
  if(typeof payload!=='string'||!payload.startsWith('{"v":1')) return payload; // plaintext passthrough
  try{
    const {v,iv,ct}=JSON.parse(payload);
    if(v!==1) return payload;
    const key=await _loadMsgKey();
    if(!key){
      // Distinguish: not logged in vs. logged in but key unavailable
      return _fbToken() ? '[Decrypting…]' : '[Sign in to read]';
    }
    const fromHex=h=>new Uint8Array(h.match(/.{2}/g).map(b=>parseInt(b,16)));
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:fromHex(iv)},key,fromHex(ct));
    return new TextDecoder().decode(plain);
  }catch(e){return '[Could not decrypt]';}
}

// Decrypt an array of message objects in-series (avoids parallel fetch storm on first load)
async function dhDecryptMsgs(msgs){
  // Load the key once upfront so individual dhDecrypt calls all get the cached key
  await _loadMsgKey().catch(()=>{});
  return Promise.all(msgs.map(async m=>{
    const text=await dhDecrypt(m.text);
    return {...m,text};
  }));
}

// ── PROFILE PHOTOS ────────────────────────────────────────────────────────────
// Resize a dataURL to a thumbnail (max 200×200) using canvas, then return JPEG dataURL
// This keeps profile pics well under Firestore's 1 MB document limit (~5-15 KB each)
function _resizePhoto(dataUrl,maxPx=200){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      const scale=Math.min(1,maxPx/img.width,maxPx/img.height);
      const w=Math.round(img.width*scale);
      const h=Math.round(img.height*scale);
      const c=document.createElement('canvas');
      c.width=w; c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      resolve(c.toDataURL('image/jpeg',0.82));
    };
    img.onerror=()=>resolve(dataUrl); // fallback: use original if canvas fails
    img.src=dataUrl;
  });
}

async function saveProfilePhoto(email,dataUrl){
  const key=email.toLowerCase();
  // Compress to a thumbnail so we never hit Firestore's 1 MB document limit
  const compressed=await _resizePhoto(dataUrl,200);
  // ── 1. Update localStorage immediately so the UI responds right away ─────
  let photos=JSON.parse(localStorage.getItem('dronehub_photos')||'{}');
  // Merge with remote first so we don't overwrite other team members' photos
  try{
    const fbDoc=await fbGet('orgs',ORG_ID+':photos');
    if(fbDoc?.data) Object.assign(photos,JSON.parse(fbDoc.data));
  }catch(e){}
  photos[key]=compressed;
  localStorage.setItem('dronehub_photos',JSON.stringify(photos));
  // ── 2. PRIMARY: write the per-user doc first — this is the reliable backup.
  // Each user's photo lives in its own doc so it can never be displaced by
  // another user's write or by the shared doc exceeding the 1 MB limit.
  try{
    await fbSetStrict('orgs',ORG_ID+':photo_'+key,{photo:compressed,email:key,updatedAt:Date.now()});
  }catch(e){
    console.error('[saveProfilePhoto] per-user doc write failed:',e.message);
    showDhToast('Photo not saved','Could not save profile picture to cloud — check your connection and try again.','⚠️','var(--orange)',6000);
    return; // don't bother writing the shared doc if we already failed
  }
  // ── 3. SECONDARY: also update the shared doc so restoreFromFirebase can
  // restore all photos in one fetch. Best-effort — failure is acceptable
  // because the per-user doc (step 2) is the authoritative source.
  fbSet('orgs',ORG_ID+':photos',{data:JSON.stringify(photos),updatedAt:Date.now()}).catch(()=>{});
}

async function loadProfilePhotoFromFirebase(email){
  // Try the per-user doc first (more reliable), then fall back to shared doc
  const key=email.toLowerCase();
  try{
    const perDoc=await fbGet('orgs',ORG_ID+':photo_'+key);
    if(perDoc?.photo){
      const photos=JSON.parse(localStorage.getItem('dronehub_photos')||'{}');
      photos[key]=perDoc.photo;
      localStorage.setItem('dronehub_photos',JSON.stringify(photos));
      return perDoc.photo;
    }
  }catch(e){}
  return getProfilePhoto(email); // fall back to whatever is in localStorage
}

function getProfilePhoto(email){
  if(!email) return null;
  const photos=JSON.parse(localStorage.getItem('dronehub_photos')||'{}');
  return photos[email.toLowerCase()]||null;
}
function getLcAuthorEmail(name){
  const m=getAdminTeamMembers().find(m=>m.name===name)||getTeamMembers().find(m=>m.name===name);
  return m?.email||'';
}
function getAvatarHtml(name,email,size=36,fontSize=12){
  const photo=getProfilePhoto(email||'');
  if(photo) return `<img src="${photo}" alt="" style="width:${size}px;height:${size}px;border-radius:50%;object-fit:cover;flex-shrink:0">`;
  const initials=(name||'?').split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
  const colors=['#5B8DEF','#22D97A','#F5A623','#8B5CF6','#F05252','#E879F9'];
  const bg=colors[(name||'').charCodeAt(0)%colors.length];
  return `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};display:flex;align-items:center;justify-content:center;font-size:${fontSize}px;font-weight:700;color:#fff;flex-shrink:0">${initials}</div>`;
}
function renderAppHeader(){
  const session=gateGetSession&&gateGetSession();
  if(!session) return;
  const userDisplay=document.getElementById('app-user-display');
  if(!userDisplay) return;
  const isAdmin=session.type==='admin'||session.role==='admin';
  const displayName=session.email==='roubosb1@gmail.com'?'Bailey Roubos':(session.name||session.email);
  const avatarHtml=getAvatarHtml(displayName,session.email,28,10);
  if(isAdmin){
    const PRESET_JOB_TITLES_local=typeof PRESET_JOB_TITLES!=='undefined'?PRESET_JOB_TITLES:{};
    const title=session.jobTitle||PRESET_JOB_TITLES_local[session.email]?.title||'Admin';
    userDisplay.innerHTML=`<div style="display:flex;align-items:center;gap:8px">${avatarHtml}<div><span style="color:var(--white);font-weight:700">${displayName}</span><span style="font-size:10px;color:var(--blue-bright);margin-left:6px;font-weight:600">${title}</span></div></div>`;
  } else {
    const role=session.role||'contractor';
    const roleLabels={admin:'Admin',editor:'Editor',videographer:'Videographer',sales:'Sales',contractor:'Contractor (Photographer/Videographer)'};
    const displayTitle=session.jobTitle||roleLabels[role]||role;
    userDisplay.innerHTML=`<div style="display:flex;align-items:center;gap:8px">${avatarHtml}<div><span style="color:var(--white);font-weight:700">${session.name||session.email}</span><span style="font-size:10px;color:var(--blue-bright);margin-left:6px;font-weight:600">${displayTitle}</span></div></div>`;
  }
}

