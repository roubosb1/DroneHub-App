// ═══════════════════════════════════════════════════════════════════════════════
// PLATFORM OWNER DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════

let _platformActiveTab='orgs';
let _platformOrgs=[];
let _platformSuggestions=[];

function setPlatformTab(tab){
  _platformActiveTab=tab;
  ['orgs','revenue','suggestions'].forEach(t=>{
    const btn=document.getElementById('ptab-'+t);
    const panel=document.getElementById('platform-tab-'+t);
    if(btn) btn.style.cssText=btn.style.cssText.replace(/border-bottom:[^;]+/,'')
      +';border-bottom:2px solid '+(t===tab?'var(--blue-bright)':'transparent');
    if(btn){ btn.style.color=t===tab?'var(--blue-bright)':'var(--muted)'; btn.style.borderBottom='2px solid '+(t===tab?'var(--blue-bright)':'transparent');}
    if(panel) panel.style.display=t===tab?'block':'none';
  });
  if(tab==='orgs') renderPlatformOrgs();
  if(tab==='revenue') renderPlatformRevenue();
  if(tab==='suggestions') renderPlatformSuggestions();
}

async function platformRefresh(){
  await renderPlatformDashboard();
}

async function renderPlatformDashboard(){
  if(!isPlatformOwner(_activeSessionEmail)) return;
  // Load orgs from Firebase
  if(_fbToken()){
    try{const r=await _fbCall({action:'get',col:'platform',docId:'orgs_registry'});_platformOrgs=r?.data?.orgs||[];}catch(e){_platformOrgs=[];}
    try{const r=await _fbCall({action:'get',col:'platform',docId:'suggestions'});_platformSuggestions=r?.data?.items||[];}catch(e){_platformSuggestions=[];}
  }
  // KPI strip
  const kpiEl=document.getElementById('platform-kpi-strip');
  if(kpiEl){
    const totalOrgs=_platformOrgs.length;
    const activeOrgs=_platformOrgs.filter(o=>o.status!=='suspended').length;
    const totalUsers=_platformOrgs.reduce((s,o)=>s+(o.teamCount||1),0);
    const totalRevenue=_platformOrgs.reduce((s,o)=>s+(o.totalRevenue||0),0);
    const platformFee=(totalRevenue*0.02);
    kpiEl.innerHTML=[
      {val:totalOrgs,label:'Total orgs'},
      {val:activeOrgs,label:'Active'},
      {val:totalUsers,label:'Total users'},
      {val:'$'+totalRevenue.toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0}),label:'Org revenue (est.)'},
      {val:'$'+platformFee.toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0}),label:'Platform fees (2%)'},
      {val:_platformSuggestions.filter(s=>!s.resolved).length,label:'Open suggestions'},
    ].map(k=>`<div class="platform-kpi"><div class="kpi-val">${k.val}</div><div class="kpi-label">${k.label}</div></div>`).join('');
  }
  // Update suggestion badge
  const badge=document.getElementById('platform-suggest-badge');
  const openSug=_platformSuggestions.filter(s=>!s.resolved).length;
  if(badge){ badge.textContent=openSug; badge.style.display=openSug>0?'inline-block':'none'; }
  // Render active tab
  setPlatformTab(_platformActiveTab);
}

function renderPlatformOrgs(){
  const el=document.getElementById('platform-orgs-list');
  if(!el) return;
  if(_platformOrgs.length===0){
    el.innerHTML=`<div style="text-align:center;padding:48px 20px;color:var(--muted)">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:.4"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">No organizations yet</div>
      <div style="font-size:12px">Companies that sign up will appear here.</div>
    </div>`;
    return;
  }
  el.innerHTML=_platformOrgs.map(org=>{
    const statusColor=org.status==='active'?'var(--green)':org.status==='suspended'?'var(--red)':'var(--muted)';
    const modules=(org.enabledTabs||[]).join(', ')||'All';
    const created=org.createdAt?new Date(org.createdAt).toLocaleDateString('en-CA',{year:'numeric',month:'short',day:'numeric'}):'—';
    return `<div class="platform-org-card">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:15px;font-weight:700;color:var(--white)">${org.companyName||'Unnamed org'}</span>
            <span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${statusColor}22;color:${statusColor}">${(org.status||'active').toUpperCase()}</span>
          </div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:2px">${org.adminEmail||'—'} · ${org.industry||'Media'}</div>
          <div style="font-size:11px;color:var(--muted);display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <span>Joined ${created} · Modules: ${modules}</span>
            <span style="padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;background:${org.platformFeeEnabled?'rgba(34,217,122,.12)':'rgba(168,180,208,.1)'};color:${org.platformFeeEnabled?'var(--green)':'var(--muted)'}">Fee ${org.platformFeeEnabled?'2% ON':'OFF'}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0">
          <div style="font-size:11px;color:var(--muted)">
            <span style="color:var(--white);font-weight:700">${org.teamCount||1}</span> users &nbsp;
            <span style="color:var(--white);font-weight:700">${org.clientCount||0}</span> clients
          </div>
          <div style="font-size:13px;font-weight:700;color:var(--green)">$${((org.totalRevenue||0)).toLocaleString('en-CA',{minimumFractionDigits:0})} invoiced</div>
          <div style="display:flex;gap:6px">
            <button onclick="platformSuspendOrg('${org.orgId}')" style="padding:5px 12px;border-radius:8px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:11px;cursor:pointer">${org.status==='suspended'?'Reactivate':'Suspend'}</button>
            <button onclick="platformViewOrg('${org.orgId}')" style="padding:5px 12px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;cursor:pointer">View →</button>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');
}

function renderPlatformRevenue(){
  const el=document.getElementById('platform-revenue-content');
  if(!el) return;
  const totalRevenue=_platformOrgs.reduce((s,o)=>s+(o.totalRevenue||0),0);
  const feeableRevenue=_platformOrgs.filter(o=>o.platformFeeEnabled).reduce((s,o)=>s+(o.totalRevenue||0),0);
  const platformFee=feeableRevenue*0.02;
  const feeOrgs=_platformOrgs.filter(o=>o.platformFeeEnabled).length;
  const freeOrgs=_platformOrgs.filter(o=>!o.platformFeeEnabled).length;
  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin-bottom:24px">
      <div style="background:var(--navy-card);border:1px solid var(--border);border-radius:14px;padding:20px">
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Total Org Revenue</div>
        <div style="font-size:32px;font-weight:800;color:var(--white)">$${totalRevenue.toLocaleString('en-CA',{minimumFractionDigits:0})}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">across ${_platformOrgs.length} org(s) · ${freeOrgs} fee-free</div>
      </div>
      <div style="background:var(--navy-card);border:1px solid rgba(34,217,122,.3);border-radius:14px;padding:20px">
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Your Platform Fees (2%)</div>
        <div style="font-size:32px;font-weight:800;color:var(--green)">$${platformFee.toLocaleString('en-CA',{minimumFractionDigits:0,maximumFractionDigits:0})}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">from ${feeOrgs} paying org${feeOrgs!==1?'s':''} · ${freeOrgs} waived</div>
      </div>
    </div>
    <div style="background:var(--navy-card);border:1px solid var(--border);border-radius:14px;overflow:hidden">
      <table style="width:100%;border-collapse:collapse">
        <thead><tr style="border-bottom:1px solid var(--border)">
          <th style="padding:12px 16px;text-align:left;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em">Company</th>
          <th style="padding:12px 16px;text-align:center;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em">Fee Status</th>
          <th style="padding:12px 16px;text-align:right;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em">Revenue</th>
          <th style="padding:12px 16px;text-align:right;font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em">Your Fee</th>
        </tr></thead>
        <tbody>
          ${_platformOrgs.length===0?`<tr><td colspan="4" style="padding:32px;text-align:center;color:var(--muted)">No data yet</td></tr>`:
          _platformOrgs.map(o=>{
            const feeOn=o.platformFeeEnabled===true;
            const fee=feeOn?(o.totalRevenue||0)*0.02:0;
            return `<tr style="border-bottom:1px solid var(--border)">
              <td style="padding:12px 16px;color:var(--white);font-weight:600">${o.companyName||'—'}</td>
              <td style="padding:12px 16px;text-align:center">
                <span style="padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;background:${feeOn?'rgba(34,217,122,.12)':'rgba(168,180,208,.1)'};color:${feeOn?'var(--green)':'var(--muted)'}">${feeOn?'2% ON':'Waived'}</span>
              </td>
              <td style="padding:12px 16px;text-align:right;color:var(--offwhite)">$${(o.totalRevenue||0).toLocaleString('en-CA',{minimumFractionDigits:0})}</td>
              <td style="padding:12px 16px;text-align:right;color:${feeOn?'var(--green)':'var(--muted)'};font-weight:600">${feeOn?'$'+fee.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2}):'—'}</td>
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;
}

function renderPlatformSuggestions(){
  const el=document.getElementById('platform-suggestions-list');
  if(!el) return;
  const items=_platformSuggestions.slice().reverse();
  if(items.length===0){
    el.innerHTML=`<div style="text-align:center;padding:48px 20px;color:var(--muted)">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom:12px;opacity:.4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
      <div style="font-size:14px;font-weight:600;margin-bottom:6px">No suggestions yet</div>
      <div style="font-size:12px">Companies can submit feedback from their Settings page.</div>
    </div>`;
    return;
  }
  el.innerHTML=items.map((s,i)=>{
    const date=s.createdAt?new Date(s.createdAt).toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'}):'—';
    return `<div style="background:var(--navy-card);border:1px solid ${s.resolved?'var(--border)':'rgba(91,141,239,.3)'};border-radius:12px;padding:16px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px">
        <div style="flex:1">
          <div style="font-size:13px;color:var(--white);margin-bottom:4px;line-height:1.5">${s.text||''}</div>
          <div style="font-size:11px;color:var(--muted)">${s.orgName||'Unknown org'} · ${date}</div>
        </div>
        ${s.resolved
          ?`<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:6px;background:rgba(34,217,122,.1);color:var(--green);flex-shrink:0">RESOLVED</span>`
          :`<button onclick="platformResolveSuggestion(${_platformSuggestions.length-1-i})" style="padding:5px 12px;border-radius:8px;border:1px solid var(--green);background:rgba(34,217,122,.08);color:var(--green);font-size:11px;cursor:pointer;flex-shrink:0">Mark resolved</button>`
        }
      </div>
    </div>`;
  }).join('');
}

async function platformResolveSuggestion(idx){
  if(!_fbToken()) return;
  _platformSuggestions[idx].resolved=true;
  await fbSet('platform','suggestions',{items:_platformSuggestions});
  renderPlatformSuggestions();
  const badge=document.getElementById('platform-suggest-badge');
  const open=_platformSuggestions.filter(s=>!s.resolved).length;
  if(badge){ badge.textContent=open; badge.style.display=open>0?'inline-block':'none'; }
}

async function platformSuspendOrg(orgId){
  const org=_platformOrgs.find(o=>o.orgId===orgId);
  if(!org) return;
  const action=org.status==='suspended'?'reactivate':'suspend';
  if(!confirm(`${action.charAt(0).toUpperCase()+action.slice(1)} ${org.companyName}?`)) return;
  org.status=org.status==='suspended'?'active':'suspended';
  await fbSet('platform','orgs_registry',{orgs:_platformOrgs});
  renderPlatformOrgs();
}

function platformViewOrg(orgId){
  const org=_platformOrgs.find(o=>o.orgId===orgId);
  if(!org) return;
  const feeOn=org.platformFeeEnabled===true;
  const created=org.createdAt?new Date(org.createdAt).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'}):'—';
  const revenue=(org.totalRevenue||0);
  const feeEarned=feeOn?revenue*0.02:0;
  const stripeConnected=org.stripeAccountId?`<span style="color:var(--green);font-weight:600">Connected</span> <span style="font-size:11px;color:var(--muted)">${org.stripeAccountId}</span>`:`<span style="color:var(--muted)">Not connected yet</span>`;

  // Build modal
  const existing=document.getElementById('platform-org-modal');
  if(existing) existing.remove();
  const modal=document.createElement('div');
  modal.id='platform-org-modal';
  modal.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.7);display:flex;align-items:center;justify-content:center;padding:20px';
  modal.innerHTML=`
    <div style="background:var(--navy-mid);border:1px solid var(--border-bright);border-radius:20px;width:100%;max-width:540px;max-height:90vh;overflow-y:auto;padding:28px">
      <!-- Header -->
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px">
        <div>
          <div style="font-size:20px;font-weight:800;color:var(--white);margin-bottom:4px">${org.companyName||'Unnamed Org'}</div>
          <div style="font-size:12px;color:var(--muted)">${org.adminEmail||'—'} · Joined ${created}</div>
        </div>
        <button onclick="document.getElementById('platform-org-modal').remove()" style="background:none;border:none;color:var(--muted);font-size:22px;cursor:pointer;line-height:1;padding:0 4px">✕</button>
      </div>

      <!-- Stats row -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:24px">
        <div style="background:var(--navy-card);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--white)">${org.teamCount||1}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Team Members</div>
        </div>
        <div style="background:var(--navy-card);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--white)">${org.clientCount||0}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Clients</div>
        </div>
        <div style="background:var(--navy-card);border:1px solid rgba(34,217,122,.3);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:22px;font-weight:800;color:var(--green)">$${revenue.toLocaleString('en-CA',{minimumFractionDigits:0})}</div>
          <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-top:2px">Invoiced</div>
        </div>
      </div>

      <!-- Platform Fee Toggle -->
      <div style="background:var(--navy-card);border:1px solid var(--border-bright);border-radius:14px;padding:20px;margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px">
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--white);margin-bottom:4px">Platform Fee (2%)</div>
            <div style="font-size:12px;color:var(--muted);line-height:1.5">When ON, DroneHub automatically takes 2% of every invoice this org processes. When OFF, they keep 100%.</div>
            <div style="font-size:12px;color:var(--green);margin-top:6px;font-weight:600">You've earned: $${feeEarned.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2})} from this org</div>
          </div>
          <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:6px">
            <div id="pom-fee-label" style="font-size:11px;font-weight:700;color:${feeOn?'var(--green)':'var(--muted)'}">${feeOn?'ON':'OFF'}</div>
            <div onclick="platformToggleFee('${orgId}')" id="pom-fee-toggle" style="width:52px;height:28px;border-radius:14px;background:${feeOn?'var(--green)':'var(--border-bright)'};cursor:pointer;position:relative;transition:background .2s;flex-shrink:0">
              <div style="position:absolute;top:3px;left:${feeOn?'27px':'3px'};width:22px;height:22px;border-radius:11px;background:#fff;transition:left .2s;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Stripe Connect -->
      <div style="background:var(--navy-card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Stripe Account</div>
        <div style="font-size:13px">${stripeConnected}</div>
      </div>

      <!-- Modules -->
      <div style="background:var(--navy-card);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:20px">
        <div style="font-size:12px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Enabled Modules</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${(org.enabledTabs&&org.enabledTabs.length>0?org.enabledTabs:['All modules']).map(m=>`<span style="padding:3px 10px;border-radius:8px;background:rgba(91,141,239,.12);border:1px solid rgba(91,141,239,.3);color:var(--blue-bright);font-size:11px;font-weight:600">${m}</span>`).join('')}
        </div>
      </div>

      <!-- Actions -->
      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button onclick="platformSuspendOrg('${orgId}');document.getElementById('platform-org-modal').remove()" style="padding:9px 18px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer">${org.status==='suspended'?'Reactivate Org':'Suspend Org'}</button>
        <button onclick="document.getElementById('platform-org-modal').remove()" style="padding:9px 20px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">Done</button>
      </div>
    </div>`;
  document.body.appendChild(modal);
  modal.addEventListener('click',e=>{if(e.target===modal) modal.remove();});
}

async function platformToggleFee(orgId){
  const org=_platformOrgs.find(o=>o.orgId===orgId);
  if(!org) return;
  const newState=!(org.platformFeeEnabled===true);
  org.platformFeeEnabled=newState;
  await fbSet('platform','orgs_registry',{orgs:_platformOrgs});

  // Update toggle UI in place without closing modal
  const toggle=document.getElementById('pom-fee-toggle');
  const label=document.getElementById('pom-fee-label');
  if(toggle){
    toggle.style.background=newState?'var(--green)':'var(--border-bright)';
    toggle.querySelector('div').style.left=newState?'27px':'3px';
  }
  if(label){
    label.textContent=newState?'ON':'OFF';
    label.style.color=newState?'var(--green)':'var(--muted)';
  }

  // Update earned amount
  const revenue=org.totalRevenue||0;
  const feeEarned=newState?revenue*0.02:0;
  const earnedEl=toggle?.closest('[style]')?.parentElement?.querySelector('[style*="green"]');

  showDhToast(
    newState?'Platform fee enabled':'Platform fee waived',
    newState?`${org.companyName} will now contribute 2% on all invoices.`:`${org.companyName} is fee-free — you can turn this on anytime.`,
    newState?_icon('dollar',16):_icon('dollar',16),
    newState?'var(--green)':'var(--blue-bright)',
    4000
  );

  renderPlatformOrgs();
  renderPlatformRevenue();
}

// ═══════════════════════════════════════════════════════════════════════════════
// PRICING CONFIG — data layer
// ═══════════════════════════════════════════════════════════════════════════════

// _pricingConfig declared early above (TDZ fix)

function defaultPricingConfig(){
  return {
    services:[],
    modifiers:{travelRatePerKm:0.73,travelFreeKm:0,rushPct:25,weekendPct:0},
    margins:{profitPct:20,adminPct:10,taxName:'HST',taxPct:13,currency:'cad'}
  };
}

function pricingLoad(){
  if(_pricingConfig) return _pricingConfig;
  try{
    const raw=localStorage.getItem('dronehub_pricing_config');
    _pricingConfig=raw?JSON.parse(raw):defaultPricingConfig();
  }catch(e){ _pricingConfig=defaultPricingConfig(); }
  return _pricingConfig;
}

function pricingSave(cfg){
  _pricingConfig=cfg;
  try{localStorage.setItem('dronehub_pricing_config',JSON.stringify(cfg));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':pricing',{data:JSON.stringify(cfg),updatedAt:Date.now()})
      .catch(e=>{
        console.error('[pricingSave] Firebase write failed:',e.message);
        showDhToast('Pricing not saved','Custom pricing config could not be saved to the cloud.','⚠️','var(--orange)',7000);
      });
  }
}

// ─── Settings UI ──────────────────────────────────────────────────────────────

function renderPricingSetup(){
  const cfg=pricingLoad();
  // Services list
  const el=document.getElementById('pricing-services-list');
  if(el){
    if(cfg.services.length===0){
      el.innerHTML=`<div style="font-size:12px;color:var(--muted);padding:10px 0">No services yet — click "+ Add Service" to get started.</div>`;
    } else {
      el.innerHTML=cfg.services.map((s,i)=>`
        <div style="display:grid;grid-template-columns:1fr 130px 110px 36px;gap:8px;align-items:center">
          <input type="text" value="${s.name||''}" oninput="pricingUpdateService(${i},'name',this.value)" placeholder="Service name" style="padding:7px 10px;border:0.5px solid var(--border-bright);border-radius:8px;font-size:13px;background:#1A2235;color:#E8ECF8;font-family:var(--font)">
          <select onchange="pricingUpdateService(${i},'unit',this.value)" style="padding:7px 8px;border:0.5px solid var(--border-bright);border-radius:8px;font-size:12px;background:#1A2235;color:#E8ECF8;font-family:var(--font)">
            ${['per shoot','per hour','per day','per image','per deliverable','flat fee'].map(u=>`<option value="${u}"${s.unit===u?' selected':''}>${u}</option>`).join('')}
          </select>
          <div style="position:relative">
            <span style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;pointer-events:none">$</span>
            <input type="number" value="${s.rate||''}" oninput="pricingUpdateService(${i},'rate',+this.value)" placeholder="0.00" min="0" step="0.01" style="width:100%;box-sizing:border-box;padding:7px 10px 7px 22px;border:0.5px solid var(--border-bright);border-radius:8px;font-size:13px;background:#1A2235;color:#E8ECF8;font-family:var(--font)">
          </div>
          <button onclick="pricingRemoveService(${i})" style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(240,82,82,.3);background:rgba(240,82,82,.08);color:var(--red);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1">×</button>
        </div>`).join('');
    }
  }
  // Modifiers
  const m=cfg.modifiers||{};
  const setVal=(id,v)=>{const el=document.getElementById(id);if(el&&v!=null)el.value=v;};
  setVal('pc-travel-rate',m.travelRatePerKm);
  setVal('pc-travel-free',m.travelFreeKm);
  setVal('pc-rush-pct',m.rushPct);
  setVal('pc-weekend-pct',m.weekendPct);
  // Margins
  const mg=cfg.margins||{};
  setVal('pc-profit-pct',mg.profitPct);
  setVal('pc-admin-pct',mg.adminPct);
  setVal('pc-tax-name',mg.taxName);
  setVal('pc-tax-pct',mg.taxPct);
  const cur=document.getElementById('pc-currency');
  if(cur) cur.value=mg.currency||'cad';
}

function pricingAddService(){
  const cfg=pricingLoad();
  cfg.services.push({id:'svc_'+Date.now(),name:'',unit:'per shoot',rate:0});
  _pricingConfig=cfg;
  renderPricingSetup();
}

function pricingRemoveService(idx){
  const cfg=pricingLoad();
  cfg.services.splice(idx,1);
  _pricingConfig=cfg;
  renderPricingSetup();
}

function pricingUpdateService(idx,field,val){
  const cfg=pricingLoad();
  if(cfg.services[idx]) cfg.services[idx][field]=val;
  _pricingConfig=cfg;
}

function savePricingConfig(){
  const cfg=pricingLoad();
  const g=id=>parseFloat(document.getElementById(id)?.value||'0')||0;
  const gs=id=>(document.getElementById(id)?.value||'').trim();
  cfg.modifiers={
    travelRatePerKm:g('pc-travel-rate')||0.73,
    travelFreeKm:g('pc-travel-free'),
    rushPct:g('pc-rush-pct'),
    weekendPct:g('pc-weekend-pct')
  };
  cfg.margins={
    profitPct:g('pc-profit-pct'),
    adminPct:g('pc-admin-pct'),
    taxName:gs('pc-tax-name')||'HST',
    taxPct:g('pc-tax-pct'),
    currency:document.getElementById('pc-currency')?.value||'cad'
  };
  pricingSave(cfg);
  const msg=document.getElementById('pricing-saved-msg');
  if(msg){msg.textContent='Saved!';setTimeout(()=>msg.textContent='',2500);}
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOM QUOTE BUILDER
// ═══════════════════════════════════════════════════════════════════════════════

let _cqbLines=[]; // [{svcId, name, unit, qty, rate, override}]

function openCustomQuoteBuilder(){
  const cfg=pricingLoad();
  _cqbLines=[];

  // Populate client dropdown
  const clients=salesLoad().filter(c=>c.firstName||c.company);
  const sel=document.getElementById('cqb-client');
  if(sel){
    sel.innerHTML='<option value="">— Select client —</option>'+
      clients.map(c=>{
        const name=[c.firstName,c.lastName].filter(Boolean).join(' ')||(c.company||'');
        return `<option value="${c.id}">${name}${c.company&&name!==c.company?' ('+c.company+')':''}</option>`;
      }).join('');
  }

  // Set modifier labels
  const rush=document.getElementById('cqb-rush-pct-label');
  const wknd=document.getElementById('cqb-weekend-pct-label');
  if(rush) rush.textContent=cfg.modifiers?.rushPct?'+'+cfg.modifiers.rushPct+'%':'';
  if(wknd) wknd.textContent=cfg.modifiers?.weekendPct?'+'+cfg.modifiers.weekendPct+'%':'';

  // Reset form
  const jobname=document.getElementById('cqb-jobname');
  if(jobname) jobname.value='';
  const travelKm=document.getElementById('cqb-travel-km');
  if(travelKm) travelKm.value='0';
  const rush2=document.getElementById('cqb-rush');
  if(rush2) rush2.checked=false;
  const wknd2=document.getElementById('cqb-weekend');
  if(wknd2) wknd2.checked=false;
  const notes=document.getElementById('cqb-notes');
  if(notes) notes.value='';

  // Start with one empty line
  cqbAddLine();

  document.getElementById('custom-quote-modal').style.display='block';
  cqbCalc();
}

function closeCQB(){
  document.getElementById('custom-quote-modal').style.display='none';
  _cqbLines=[];
}

function cqbAddLine(){
  const cfg=pricingLoad();
  const id='cqbl_'+Date.now()+'_'+Math.random().toString(36).slice(2,6);
  _cqbLines.push({id,svcId:'',name:'',unit:'per shoot',qty:1,rate:0,override:false});
  cqbRenderLines(cfg);
}

function cqbRemoveLine(id){
  _cqbLines=_cqbLines.filter(l=>l.id!==id);
  cqbRenderLines(pricingLoad());
  cqbCalc();
}

function cqbRenderLines(cfg){
  const el=document.getElementById('cqb-lines');
  if(!el) return;
  const svcOpts='<option value="">— custom —</option>'+
    (cfg.services||[]).map(s=>`<option value="${s.id}">${s.name} (${s.unit}) — $${(+s.rate).toFixed(2)}</option>`).join('');

  el.innerHTML=_cqbLines.map((l,i)=>`
    <div style="display:grid;grid-template-columns:1fr 80px 110px 36px;gap:8px;align-items:center" data-line="${l.id}">
      <div style="display:flex;flex-direction:column;gap:4px">
        <select onchange="cqbSelectSvc('${l.id}',this.value)" style="padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);font-family:var(--font)">${svcOpts.replace(`value="${l.svcId}"`,`value="${l.svcId}" selected`)}</select>
        <input type="text" value="${l.name||''}" placeholder="Description" oninput="cqbUpdateLine('${l.id}','name',this.value)" style="padding:6px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);font-family:var(--font)">
      </div>
      <input type="number" value="${l.qty||1}" min="0.5" step="0.5" oninput="cqbUpdateLine('${l.id}','qty',+this.value)" style="padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white);text-align:center" placeholder="Qty">
      <div style="position:relative">
        <span style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:13px;pointer-events:none">$</span>
        <input type="number" value="${l.rate||''}" placeholder="Rate" min="0" step="0.01" oninput="cqbUpdateLine('${l.id}','rate',+this.value)" style="width:100%;box-sizing:border-box;padding:7px 10px 7px 22px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
      </div>
      <button onclick="cqbRemoveLine('${l.id}')" style="width:32px;height:32px;border-radius:8px;border:1px solid rgba(240,82,82,.3);background:rgba(240,82,82,.08);color:var(--red);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center">×</button>
    </div>`).join('');
}

function cqbSelectSvc(lineId,svcId){
  const cfg=pricingLoad();
  const line=_cqbLines.find(l=>l.id===lineId);
  if(!line) return;
  if(svcId){
    const svc=cfg.services.find(s=>s.id===svcId);
    if(svc){line.svcId=svcId;line.name=svc.name;line.unit=svc.unit;line.rate=svc.rate;}
  } else {
    line.svcId='';
  }
  cqbRenderLines(cfg);
  cqbCalc();
}

function cqbUpdateLine(lineId,field,val){
  const line=_cqbLines.find(l=>l.id===lineId);
  if(line){line[field]=val;}
  cqbCalc();
}

function cqbCalc(){
  const cfg=pricingLoad();
  const mg=cfg.margins||{profitPct:20,adminPct:10,taxName:'HST',taxPct:13};
  const mod=cfg.modifiers||{travelRatePerKm:0.73,travelFreeKm:0,rushPct:25,weekendPct:0};

  // Subtotal from line items
  const subtotal=_cqbLines.reduce((s,l)=>s+(((+l.rate)||0)*((+l.qty)||1)),0);

  // Overhead markup (applied to subtotal)
  const overheadPct=(+(mg.profitPct||0))+(+(mg.adminPct||0));
  const overhead=subtotal*(overheadPct/100);
  let total=subtotal+overhead;

  // Modifiers
  const travelKm=Math.max(0,(+(document.getElementById('cqb-travel-km')?.value||0))-(+(mod.travelFreeKm||0)));
  const travelCost=travelKm*(+(mod.travelRatePerKm||0));
  const isRush=document.getElementById('cqb-rush')?.checked;
  const isWeekend=document.getElementById('cqb-weekend')?.checked;
  const rushAdj=isRush?total*(+(mod.rushPct||0)/100):0;
  const weekendAdj=isWeekend?total*(+(mod.weekendPct||0)/100):0;
  total+=travelCost+rushAdj+weekendAdj;

  // Tax
  const tax=total*(+(mg.taxPct||0)/100);
  const grandTotal=total+tax;

  const fmt=n=>'$'+n.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const row=(label,amt,color='var(--offwhite)',bold=false)=>
    `<div style="display:flex;justify-content:space-between;padding:5px 0;border-bottom:1px solid var(--border);font-weight:${bold?700:400};color:${color}">
      <span>${label}</span><span>${fmt(amt)}</span>
    </div>`;

  const el=document.getElementById('cqb-calc');
  if(!el) return;

  if(subtotal===0&&travelCost===0){
    el.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Add line items above to see the estimate.</div>';
    return;
  }

  el.innerHTML=
    row('Services subtotal',subtotal)+
    (overhead>0?row(`Overhead (${overheadPct}%)`,overhead,'var(--muted)'):'')+
    (travelCost>0?row(`Travel (${travelKm.toFixed(0)} km × $${mod.travelRatePerKm}/km)`,travelCost,'var(--muted)'):'')+
    (rushAdj>0?row(`Rush fee (+${mod.rushPct}%)`,rushAdj,'var(--amber)'):'')+
    (weekendAdj>0?row(`Weekend (+${mod.weekendPct}%)`,weekendAdj,'var(--blue-bright)'):'')+
    row(`${mg.taxName||'Tax'} (${mg.taxPct}%)`,tax,'var(--muted)')+
    `<div style="display:flex;justify-content:space-between;padding:12px 0 4px;font-size:18px;font-weight:800;color:var(--green)">
      <span>Total</span><span>${fmt(grandTotal)}</span>
    </div>`;
}

async function cqbCreateJob(){
  const cfg=pricingLoad();
  const mg=cfg.margins||{taxPct:13,taxName:'HST',currency:'cad'};
  const mod=cfg.modifiers||{travelRatePerKm:0.73,travelFreeKm:0,rushPct:25,weekendPct:0};

  const clientId=document.getElementById('cqb-client')?.value||'';
  const jobName=(document.getElementById('cqb-jobname')?.value||'').trim()||'Custom Quote';
  const notes=(document.getElementById('cqb-notes')?.value||'').trim();

  if(_cqbLines.length===0||_cqbLines.every(l=>!l.name&&!l.rate)){
    alert('Add at least one line item before saving.');return;
  }

  // Recalculate totals
  const subtotal=_cqbLines.reduce((s,l)=>s+(((+l.rate)||0)*((+l.qty)||1)),0);
  const overheadPct=(+(mg.profitPct||0))+(+(mg.adminPct||0));
  let total=subtotal*(1+overheadPct/100);
  const travelKm=Math.max(0,(+(document.getElementById('cqb-travel-km')?.value||0))-(+(mod.travelFreeKm||0)));
  const travelCost=travelKm*(+(mod.travelRatePerKm||0));
  const isRush=document.getElementById('cqb-rush')?.checked;
  const isWeekend=document.getElementById('cqb-weekend')?.checked;
  total+=travelCost+(isRush?total*(+(mod.rushPct||0)/100):0)+(isWeekend?total*(+(mod.weekendPct||0)/100):0);
  const grandTotal=total*(1+(+(mg.taxPct||0)/100));

  // Build job object
  const client=clientId?salesLoad().find(c=>c.id===clientId):null;
  const job={
    id:'j'+Date.now(),
    name:jobName,
    clientId:clientId||'',
    status:'quoted',
    currency:mg.currency||'cad',
    date:new Date().toISOString().slice(0,10),
    notes,
    quoteLines:_cqbLines.map(l=>({name:l.name,qty:l.qty,rate:l.rate,unit:l.unit})),
    quotedTotal:+grandTotal.toFixed(2),
    createdAt:new Date().toISOString(),
    source:'custom_quote'
  };

  savedJobs=[...savedJobs,job];
  saveJobsToStorage();
  renderJobs&&renderJobs();
  closeCQB();
  showDhToast('Quote saved','Job created with status Quoted. Open it to send the invoice.','✅','var(--green)',5000);
}

// ─── Load pricing into settings when settings pane opens ──────────────────────
const _origShowPane=window.showPane;

// ═══════════════════════════════════════════════════════════════════════════════
// Submit a suggestion (called from Settings pane for org admins)
async function submitSuggestion(){
  const text=(document.getElementById('suggestion-text')?.value||'').trim();
  if(!text){ alert('Please enter your suggestion first.'); return; }
  const session=gateGetSession();
  const orgName=window._orgData?.companyName||ORG_ID;
  const item={text,orgId:ORG_ID,orgName,submittedBy:session?.email||'',createdAt:new Date().toISOString(),resolved:false};
  if(_fbToken()){
    try{
      const r=await _fbCall({action:'get',col:'platform',docId:'suggestions'});
      const current=r?.data?.items||[];
      current.push(item);
      await fbSet('platform','suggestions',{items:current});
    }catch(e){console.warn('submitSuggestion failed:',e);}
  }
  const textEl=document.getElementById('suggestion-text');
  if(textEl) textEl.value='';
  showToast('✓ Suggestion submitted — thanks!');
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPANY ONBOARDING WIZARD
// ═══════════════════════════════════════════════════════════════════════════════

let _wizCurrentStep=1;
let _wizData={};
let _wizCsvServices=[];

const WIZ_MODULES=[
  {id:'quote',icon:_icon('notes',16),label:'Quote Builder',desc:'Build and send quotes to clients'},
  {id:'jobs',icon:_icon('folder',16),label:'Jobs',desc:'Manage bookings and shoot schedules'},
  {id:'clients',icon:_icon('user',16),label:'Clients',desc:'Client database and portal access'},
  {id:'louchat',icon:_icon('chat',16),label:'LouChat',desc:'Messaging with clients & team'},
  {id:'calendar',icon:_icon('calendar',16),label:'Calendar',desc:'Scheduling and availability'},
  {id:'finance',icon:_icon('dollar',16),label:'Finance',desc:'Invoicing and revenue tracking'},
  {id:'tracker',icon:_icon('chart',16),label:'Projects',desc:'Job progress tracking'},
  {id:'team',icon:_icon('user',16),label:'Team',desc:'Manage staff and contractors'},
  {id:'social',icon:_icon('video',16),label:'Social Media',desc:'Content planning and approvals'},
  {id:'sales',icon:_icon('chart',16),label:'Sales CRM',desc:'Lead tracking and pipeline'},
];

function showOrgSignupWizard(){
  _wizCurrentStep=1;
  _wizData={};
  _wizCsvServices=[];
  document.getElementById('org-signup-wizard').style.display='block';
  document.getElementById('site-login-gate').style.display='none';
  wizRenderModules();
  wizGoToStep(1);
}

function hideOrgSignupWizard(){
  document.getElementById('org-signup-wizard').style.display='none';
  document.getElementById('site-login-gate').style.display='flex';
}

function wizRenderModules(){
  // Default: all except sales (advanced)
  const defaults=['quote','jobs','clients','louchat','calendar','finance','tracker','team'];
  _wizData.enabledTabs=_wizData.enabledTabs||[...defaults];
  const grid=document.getElementById('wiz-module-grid');
  if(!grid) return;
  grid.innerHTML=WIZ_MODULES.map(m=>`
    <div class="wiz-module-card ${_wizData.enabledTabs.includes(m.id)?'selected':''}" id="wiz-mod-${m.id}" onclick="wizToggleModule('${m.id}')">
      <div style="font-size:20px;margin-bottom:6px">${m.icon}</div>
      <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:2px">${m.label}</div>
      <div style="font-size:11px;color:var(--muted);line-height:1.4">${m.desc}</div>
      <div style="margin-top:8px;width:18px;height:18px;border-radius:50%;border:2px solid ${_wizData.enabledTabs.includes(m.id)?'var(--blue-bright)':'var(--border)'};background:${_wizData.enabledTabs.includes(m.id)?'var(--blue-bright)':'transparent'};display:flex;align-items:center;justify-content:center">
        ${_wizData.enabledTabs.includes(m.id)?`<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`:''}
      </div>
    </div>`).join('');
}

function wizToggleModule(id){
  const idx=(_wizData.enabledTabs||[]).indexOf(id);
  if(idx>=0) _wizData.enabledTabs.splice(idx,1);
  else (_wizData.enabledTabs=_wizData.enabledTabs||[]).push(id);
  wizRenderModules();
}

function wizGoToStep(step){
  _wizCurrentStep=step;
  for(let i=1;i<=3;i++){
    const panel=document.getElementById('wiz-step-'+i);
    if(panel) panel.style.display=i===step?'block':'none';
    const dot=document.querySelector(`.wiz-step[data-step="${i}"]`);
    if(dot){
      dot.classList.remove('active','done');
      if(i<step) dot.classList.add('done');
      else if(i===step) dot.classList.add('active');
    }
    const conn=document.querySelectorAll('.wiz-connector')[i-1];
    if(conn) conn.style.background=i<step?'var(--blue-bright)':'var(--border)';
  }
  // Nav buttons
  const btnBack=document.getElementById('wiz-btn-back');
  const btnNext=document.getElementById('wiz-btn-next');
  const btnCreate=document.getElementById('wiz-btn-create');
  if(btnBack) btnBack.style.display=step>1?'inline-flex':'none';
  if(btnNext) btnNext.style.display=step<3?'inline-flex':'none';
  if(btnCreate) btnCreate.style.display=step===3?'inline-flex':'none';
  if(step===3) wizBuildSummary();
}

function wizNext(){
  if(_wizCurrentStep===1){
    const company=(document.getElementById('wiz-company')?.value||'').trim();
    const first=(document.getElementById('wiz-first')?.value||'').trim();
    const last=(document.getElementById('wiz-last')?.value||'').trim();
    const email=(document.getElementById('wiz-email')?.value||'').trim().toLowerCase();
    const pass=(document.getElementById('wiz-pass')?.value||'').trim();
    const err=document.getElementById('wiz-error-1');
    if(!company||!first||!last||!email||!pass){if(err){err.textContent='Please fill in all required fields.';err.style.display='block';}return;}
    if(pass.length<6){if(err){err.textContent='Password must be at least 6 characters.';err.style.display='block';}return;}
    if(!email.includes('@')){if(err){err.textContent='Please enter a valid email.';err.style.display='block';}return;}
    if(err) err.style.display='none';
    _wizData.companyName=company;
    _wizData.firstName=first;
    _wizData.lastName=last;
    _wizData.email=email;
    _wizData.pass=pass;
    _wizData.industry=document.getElementById('wiz-industry')?.value||'other';
  }
  wizStep(_wizCurrentStep+1);
}

function wizStep(step){
  if(step<1||step>5) return;
  wizGoToStep(step);
}

function wizHandleCsvUpload(input){
  const file=input.files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=function(e){
    const lines=e.target.result.split('\n').filter(l=>l.trim());
    _wizCsvServices=[];
    lines.forEach((line,idx)=>{
      if(idx===0&&line.toLowerCase().includes('service')) return; // skip header
      const parts=line.split(',');
      if(parts.length>=2){
        const name=(parts[0]||'').trim().replace(/"/g,'');
        const price=parseFloat((parts[1]||'0').replace(/[^0-9.]/g,''))||0;
        const desc=(parts[2]||'').trim().replace(/"/g,'');
        if(name&&price>0) _wizCsvServices.push({name,price,desc});
      }
    });
    _wizData.csvServices=_wizCsvServices;
    const preview=document.getElementById('wiz-csv-preview');
    const list=document.getElementById('wiz-csv-preview-list');
    if(preview) preview.style.display='block';
    if(list) list.innerHTML=_wizCsvServices.map(s=>`
      <div style="display:flex;justify-content:space-between;padding:8px 10px;background:var(--navy-lift);border-radius:8px;font-size:12px">
        <span style="color:var(--white)">${s.name}</span>
        <span style="color:var(--green);font-weight:700">$${s.price.toFixed(2)}</span>
      </div>`).join('');
  };
  reader.readAsText(file);
}

function wizBuildSummary(){
  const el=document.getElementById('wiz-summary');
  if(!el) return;
  const modules=(_wizData.enabledTabs||[]).map(id=>{
    const m=WIZ_MODULES.find(x=>x.id===id);
    return m?m.label:id;
  }).join(', ');
  el.innerHTML=[
    {label:'Company',val:_wizData.companyName||'—'},
    {label:'Admin',val:(_wizData.firstName||'')+' '+(_wizData.lastName||'')+' ('+(_wizData.email||'')+')'  },
    {label:'Industry',val:_wizData.industry||'—'},
    {label:'Modules',val:modules||'None selected'},
    {label:'Pricing sheet',val:_wizCsvServices.length>0?_wizCsvServices.length+' services imported':'Not provided (set up manually later)'},
    {label:'SendGrid',val:_wizData.sendgridKey?'Connected':'Not connected (emails via platform)'},
  ].map(r=>`<div style="display:flex;align-items:baseline;gap:10px">
    <span style="font-size:11px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;min-width:110px;flex-shrink:0">${r.label}</span>
    <span style="font-size:13px;color:var(--white)">${r.val}</span>
  </div>`).join('');
}

async function wizCreateOrg(){
  const btn=document.getElementById('wiz-create-label');
  if(btn) btn.textContent='Creating…';
  try{
    // Generate org ID
    const orgId='org_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    const now=new Date().toISOString();
    // Build org record
    const orgRecord={
      orgId,
      companyName:_wizData.companyName,
      adminEmail:_wizData.email,
      adminName:_wizData.firstName+' '+_wizData.lastName,
      industry:_wizData.industry||'other',
      enabledTabs:_wizData.enabledTabs||['quote','jobs','clients','louchat','calendar','finance','tracker','team'],
      sendgridKey:'',
      csvServices:_wizCsvServices,
      status:'active',
      createdAt:now,
      teamCount:1,
      clientCount:0,
      totalRevenue:0,
    };
    // Build admin user record for this org
    const adminUser={
      email:_wizData.email,
      name:_wizData.firstName+' '+_wizData.lastName,
      role:'admin',
      type:'admin',
      passHash:await hashPass(_wizData.email,_wizData.pass),
      createdAt:now.slice(0,10),
    };
    if(_fbToken()){
      // Save org's gate users
      await fbSet('orgs',orgId+':gate_users',{data:JSON.stringify([adminUser]),updatedAt:Date.now()});
      // Register org in platform registry
      const _wizOrgSnap=await _fbCall({action:'get',col:'platform',docId:'orgs_registry'});
      const existing=(_wizOrgSnap?.data?.orgs||[]);
      existing.push(orgRecord);
      await fbSet('platform','orgs_registry',{orgs:existing});
      // Map email → orgId for login routing
      const _wizUsersSnap=await _fbCall({action:'get',col:'platform',docId:'users'});
      const userMap=_wizUsersSnap?.data||{};
      const emailKey=_wizData.email.toLowerCase().replace(/[.@]/g,'_');
      userMap[emailKey]=orgId;
      await fbSet('platform','users',userMap);
      // Save org settings (name, enabledTabs, etc.)
      await fbSet('orgs',orgId+':settings',{data:JSON.stringify({companyName:_wizData.companyName,enabledTabs:orgRecord.enabledTabs,sendgridKey:_wizData.sendgridKey||'',csvServices:_wizCsvServices}),updatedAt:Date.now()});
    }
    // Set active org and log in
    ORG_ID=orgId;
    window._orgData=orgRecord;
    const session={email:_wizData.email,name:_wizData.firstName+' '+_wizData.lastName,role:'admin',type:'admin',orgId};
    gateSaveSession(session);
    document.getElementById('org-signup-wizard').style.display='none';
    gateEnterApp(session);
    showToast('Welcome to DroneHub, '+_wizData.firstName+'! Your workspace is ready.');
  }catch(e){
    console.error('wizCreateOrg failed:',e);
    const errEl=document.getElementById('wiz-error-5');
    if(errEl){errEl.textContent='Something went wrong: '+e.message+'. Please try again.';errEl.style.display='block';}
    if(btn) btn.textContent='Create my workspace ✓';
  }
}

// ── Floating suggestion FAB ─────────────────────────────────────────────────
let _suggestPopoverOpen=false;
function toggleSuggestPopover(){
  _suggestPopoverOpen=!_suggestPopoverOpen;
  const pop=document.getElementById('suggest-popover');
  if(pop) pop.style.display=_suggestPopoverOpen?'block':'none';
  if(_suggestPopoverOpen) setTimeout(()=>document.getElementById('suggest-fab-text')?.focus(),50);
}
async function submitSuggestionFab(){
  const text=(document.getElementById('suggest-fab-text')?.value||'').trim();
  if(!text) return;
  const session=gateGetSession();
  const orgName=window._orgData?.companyName||ORG_ID;
  const item={text,orgId:ORG_ID,orgName,submittedBy:session?.email||'',createdAt:new Date().toISOString(),resolved:false};
  if(_fbToken()){
    try{
      const r=await _fbCall({action:'get',col:'platform',docId:'suggestions'});
      const current=r?.data?.items||[];
      current.push(item);
      await fbSet('platform','suggestions',{items:current});
    }catch(e){console.warn('suggestion failed:',e);}
  }
  const textEl=document.getElementById('suggest-fab-text');
  if(textEl) textEl.value='';
  toggleSuggestPopover();
  showToast('✓ Feedback sent — thanks!');
}

// Helper toast (reuse if already defined)
function showToast(msg, duration=4000){
  const t=document.createElement('div');
  t.textContent=msg;
  t.style.cssText='position:fixed;bottom:28px;left:50%;transform:translateX(-50%);background:#1D9E75;color:#fff;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,.4);white-space:nowrap';
  document.body.appendChild(t);
  setTimeout(()=>t.remove(),duration);
}
