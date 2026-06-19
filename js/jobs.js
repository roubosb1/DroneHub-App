function renderEditorSelectors(){
  const services=[
    // Video editor intentionally omitted — assigned in the Project Tracker after filming.
    // Editing fee goes to whoever is assigned as editor in the tracker (contractor or team member).
    {key:'photo',label:'Photo editor',show:svc.photo},
    {key:'extvideo',label:'Exterior video editor',show:svc.extvideo},
    {key:'extphoto',label:'Exterior photo editor',show:svc.extphoto},
    {key:'randomvideo',label:'Random video editor',show:svc.randomvideo},
    {key:'randomphoto',label:'Random photo editor',show:svc.randomphoto},
    {key:'rush',label:'Rush order editor',show:svc.rush},
  ];
  const container=document.getElementById('editor-selectors');
  if(!container)return;
  const active=services.filter(s=>s.show);

  let html=active.length
    ? active.map(s=>`
      <div class="svc-row" style="padding:5px 0">
        <span class="svc-name" style="min-width:160px;flex:none;font-size:12px">${s.label}</span>
        <select id="ed-${s.key}" onchange="editors['${s.key}']=this.value;calc()" style="flex:1;padding:5px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">
          <option value="dronehub"${'dronehub'===editors[s.key]?' selected':''}>DroneHub — assign later in tracker</option>
          <option value="">— Same as shooter —</option>
          ${EDITOR_OPTIONS.filter(k=>k!=='dronehub').map(k=>`<option value="${k}"${editors[s.key]===k?' selected':''}>${EDITOR_NAMES[k]}</option>`).join('')}
        </select>
      </div>`).join('')
    : '<div style="font-size:12px;color:#7A8AAA">No services selected yet.</div>';

  // Custom service — separate contractor + payout section
  if(svc.custom){
    const customDesc=document.getElementById('custom-svc-desc')?.value||'Custom service';
    const allContractors=Object.entries(CONTRACTORS).map(([k,c])=>`<option value="${k}"${editors.custom===k?' selected':''}>${c.name}</option>`).join('');
    html+=`<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      <div style="font-size:11px;font-weight:700;color:var(--blue-bright);text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px">Custom: "${customDesc}"</div>
      <div class="svc-row" style="padding:5px 0;gap:8px;flex-wrap:wrap">
        <span class="svc-name" style="min-width:140px;flex:none;font-size:12px">Contractor</span>
        <select id="ed-custom" onchange="editors['custom']=this.value;calc()" style="flex:1;min-width:120px;padding:5px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white)">
          <option value="">— Select contractor —</option>
          ${allContractors}
          <option value="dronehub"${editors.custom==='dronehub'?' selected':''}>DroneHub</option>
        </select>
        <span style="font-size:12px;color:var(--muted);flex-shrink:0">Pay $</span>
        <input type="number" id="custom-svc-payout" min="0" step="1" placeholder="Agreed payout" value="${window._customPayout||''}" oninput="window._customPayout=this.value;calc()" style="width:90px;padding:5px 8px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);flex-shrink:0">
      </div>
    </div>`;
  }

  container.innerHTML=html;
}

function saveJob(){
  const name=document.getElementById('job-name-input').value.trim();
  const date=document.getElementById('job-date-input').value;
  if(!name||!date){document.getElementById('save-job-status').textContent='Please enter a job name and date.';return;}

  const market=document.getElementById('job-market-input')?.value||'canada';
  const isUS=market!=='canada';
  const period=getBiweeklyPeriod(date);

  let grand=0,driveCost=0,payoutSnapshot={},lines=[];
  let usJobData={};

  if(isUS){
    // US job — get grand from US quote state
    grand=getUSGrand();
    if(!grand){document.getElementById('save-job-status').textContent='Please build a US quote first.';return;}
    driveCost=0; // no drive charge for US
    // Record US-specific data for invoice rendering
    usJobData={
      market,
      pkgType:usQuoteState.pkgType,
      listingTier:usQuoteState.listingTier,
      socialTier:usQuoteState.socialTier,
      dayType:usQuoteState.dayType,
      reelCount:usQuoteState.reelCount,
      reelsTBD:usQuoteState.reelsTBD,
      dayLocations:(usQuoteState.dayLocations||[]).map(l=>({...l})),
      addons:{...usQuoteState.addons},
      offSeason:usQuoteState.offSeason,
    };
  } else {
    // Canada job — existing logic
    const ds=buildDriveSummary();
    const sqft=parseInt(document.getElementById('sqft').value);
    const result=buildQuote(sqft,svc,qty);
    lines=result.lines; grand=result.grand; driveCost=result.driveCost;
    payoutSnapshot=buildPayoutSnapshot(lines,ds);
  }

  const job={
    id:Date.now(),
    name,date,
    shootTime:document.getElementById('job-time-input')?.value||'',
    duration:document.getElementById('job-duration-input')?.value||'2',
    currency:document.getElementById('job-currency-input')?.value||'cad',
    market,
    notes:document.getElementById('job-notes-input')?.value.trim()||'',
    grand,driveCost,
    status:initialJobStatus,
    clientId:selectedClientId||null,
    clientName:selectedClientId?(clients.find(c=>c.id===selectedClientId)?.name||''):'',
    period:period.label,periodStart:period.start,periodEnd:period.end,
    sqft:isUS?0:parseInt(document.getElementById('sqft').value),
    services:isUS?{}:{...svc},
    hours:isUS?{}:{...qty},
    payouts:isUS?{}:payoutSnapshot,
    editors:isUS?{}:{...editors},
    address:propAddrText||'(no address)',
    customDesc:(!isUS&&svc.custom)?(document.getElementById('custom-svc-desc')?.value||'Custom service').trim():'',
    customPrice:(!isUS&&svc.custom)?parseFloat(document.getElementById('custom-svc-price')?.value)||0:0,
    customPayout:(!isUS&&svc.custom)?parseFloat(document.getElementById('custom-svc-payout')?.value||window._customPayout||0)||0:0,
    extraServices:isUS?[]:getExtraServiceLines().map(xs=>({name:xs.name,clientPrice:xs.clientPrice,contractorPayout:xs.contractorPayout,payoutType:xs.payoutType})),
    commissionPct:parseInt(document.getElementById('commission-pct-sel')?.value||0),
    commissionSalesperson:document.getElementById('commission-salesperson-sel')?.value||'Mackenzie Woodhouse',
    commissionAmt:0,
    ...(isUS?{usData:usJobData}:{}),
  };
  job.commissionAmt=job.commissionPct>0?Math.ceil(job.grand*job.commissionPct/100):0;

  // ── Link to Sales Deal ───────────────────────────────────────────────────
  const dealId=(document.getElementById('job-deal-id-input')?.value||'').trim().toUpperCase();
  if(dealId){
    job.dealId=dealId;
    linkDealToJob(dealId, job.id, job.grand);
  }

  savedJobs.push(job);
  saveJobsToStorage();

  // ── AUTO-POPULATE TRACKER STAGE ──────────────────────────────────────────
  // Find the videographer (shooter) from payouts
  const shooterEntry=Object.values(payoutSnapshot).find(p=>p.entries?.some(e=>e.role?.includes('shoot')));
  const videographerName=shooterEntry?.name||'';
  // Editor is not set at quote time — assigned later in the Project Tracker.
  // Editing fee defaults to the shooter on their paystub; jobDetailReassign
  // will move it when an editor is actually assigned.

  setTrackerStage(job.id,{
    stage:'ready',
    editStatus:'ready',
    claimedBy:'',   // editor assigned in tracker, not at quote time
    videographer:videographerName,
    filesReceived:false,
    notes:'',
    projectId:getProjectId(job),
    approxFilmHours:job.duration||'',
    approxEditHours:'',
    completionDate:'',
    filemailLink:'',frameioLink:'',downloadLink:'',
    draftCount:0,extraDraftCharge:0,
  });

  // ── UPDATE CALENDAR ───────────────────────────────────────────────────────
  if(document.getElementById('pane-calendar')?.classList.contains('active')){
    populateCalNameDropdown();
    renderCalendar();
  }

  // ── SEND QUOTE EMAIL TO CLIENT ────────────────────────────────────────────
  if(initialJobStatus==='quoted'&&job.clientId){
    const client=clients.find(c=>c.id===job.clientId);
    if(client?.email){
      const{lines:quoteLines,grand:quoteGrand}=buildQuote(sqft,svc,qty);
      const _qIsUs=(document.getElementById('job-market-input')?.value||'canada')!=='canada';
      const hst=_qIsUs?0:parseFloat((quoteGrand*0.13).toFixed(2));
      const total=quoteGrand+hst;
      const svcList=Object.entries(svc).filter(([k,v])=>v&&['video','photo','tvideo','tphoto','reel','extphoto','extvideo','floorplan','custom'].includes(k))
        .map(([k])=>({video:'Aerial Video',photo:'Aerial Photography',tvideo:'Twilight Video',tphoto:'Twilight Photography',reel:'Social Media Reel',extphoto:'Exterior Photography',extvideo:'Exterior Video',floorplan:'Floor Plan',custom:job.customDesc||'Custom Service'}[k]||k)).join(', ');
      const biz=bizSettings||{};
      if(typeof emailjs!=='undefined'){
        emailjs.send('service_f0gwd3p','template_fjf8aas',{
          to_email:client.email,
          to_name:client.name||client.email,
          company_name:biz.name||'DroneHub Media Company',
          invoice_number:'QUOTE-'+job.id.toString().slice(-6),
          invoice_total:'$'+total.toFixed(2)+(_qIsUs?'':' (incl. HST)'),
          job_name:job.name||job.address,
          job_date:job.date,
          payment_link:'',
        },'Ch7hmj99uF1tLKhMj').then(()=>{
          const el=document.getElementById('save-job-status');
          if(el) el.textContent+=' · Quote emailed to '+client.email;
        }).catch(e=>console.warn('Quote email failed:',e));
      }
    }
  }

  document.getElementById('save-job-status').textContent=`✓ Saved "${name}" as ${initialJobStatus} — ${period.label} · Contractors notified in LouChat`;
  setTimeout(()=>document.getElementById('save-job-status').textContent='',5000);
  // Clear deal ID field + preview
  const dealIdEl = document.getElementById('job-deal-id-input');
  if(dealIdEl) dealIdEl.value='';
  const dealPreviewEl = document.getElementById('job-deal-preview');
  if(dealPreviewEl) dealPreviewEl.textContent='';
  refreshPayrollPeriods();
  renderJobs();
  renderTracker();
  // Reset editors back to defaults so the next quote starts clean
  editors.video='dronehub'; editors.photo='dronehub';
  editors.extvideo=''; editors.extphoto=''; editors.randomvideo=''; editors.randomphoto=''; editors.rush=''; editors.custom='';
  renderEditorSelectors();
}

function buildPayoutSnapshot(lines,ds){
  // Re-use renderCostModel logic but return data instead of rendering
  const snap={};
  const addContractor=(key,role,shootFee,editFee,driveFee,miscFee,miscDetail)=>{
    if(!key) return;
    const name=CONTRACTORS[key]?.name||EDITOR_NAMES[key]||key;
    if(!snap[name]) snap[name]={name,entries:[]};
    snap[name].entries.push({role,shootFee:shootFee||0,editFee:editFee||0,driveFee:driveFee||0,miscFee:miscFee||0,miscDetail:miscDetail||''});
  };

  // Video
  if(svc.video&&ds.vidKey){
    let vGrossedBase=0;
    lines.forEach(l=>{
      if(l.isBundle) vGrossedBase+=((l.videoTotal/(1+ADMIN_RATE))-(ds.vidClientCharge||0));
      else if(!l.flat&&!l.isStandalonePhoto) vGrossedBase+=(l.total-l.admin)-(ds.vidClientCharge||0);
    });
    const vRev=vGrossedBase*(1-MARGIN);
    const shooterFee=vRev*0.600;
    const editFee=vRev*0.400;
    addContractor(ds.vidKey,'Video shoot',shooterFee,0,ds.vidDrive.contractorCharge||0,0,'');
    // Editing fee starts on the shooter — if a different editor is assigned in the
    // tracker, jobDetailReassign moves this entry to them. If a salaried DroneHub
    // team member edits, jobDetailReassign removes this entry entirely (their pay
    // comes from the hourly rate system instead).
    addContractor(ds.vidKey,'Video editing',0,editFee,0,0,'');
  }
  // Photo
  if(svc.photo&&ds.phoKey){
    let pGrossedBase=0;
    lines.forEach(l=>{
      if(l.isBundle) pGrossedBase+=l.photoFlat||0;
      else if(l.isStandalonePhoto) pGrossedBase+=l.base;
    });
    const pRev=pGrossedBase;
    const shooterFee=pRev*0.600;
    const pKey=ds.sameShooter?ds.vidKey:ds.phoKey;
    addContractor(pKey,'Photo shoot',shooterFee,0,ds.sameShooter?0:ds.phoDrive.contractorCharge||0,0,'');
    // Photo editing is also internal cost — no per-job paystub entry
  }
  // Random video
  if(svc.randomvideo&&ds.vidKey){
    const hrs=qty.randomvideo||1;
    const shootPay=hrs*RANDOM_SHOOT_PAY;
    const editPay=hrs*RANDOM_EDIT_PAY;
    addContractor(ds.vidKey,'Random video shoot',0,0,ds.randVideoContractorCharge||0,shootPay,`${hrs}hr × $${RANDOM_SHOOT_PAY}/hr shoot`);
    const edKey=editors.randomvideo||ds.vidKey;
    addContractor(edKey,'Random video editing',0,0,0,editPay,`${hrs}hr × $${RANDOM_EDIT_PAY}/hr edit`);
  }
  // Random photo
  if(svc.randomphoto&&ds.phoKey){
    const hrs=qty.randomphoto||1;
    const shootPay=hrs*RANDOM_SHOOT_PAY;
    const editPay=hrs*RANDOM_EDIT_PAY;
    const pKey=ds.sameShooter?ds.vidKey:ds.phoKey;
    addContractor(pKey,'Random photo shoot',0,0,ds.sameShooter?0:ds.randPhotoContractorCharge||0,shootPay,`${hrs}hr × $${RANDOM_SHOOT_PAY}/hr shoot`);
    const edKey=editors.randomphoto||pKey;
    addContractor(edKey,'Random photo editing',0,0,0,editPay,`${hrs}hr × $${RANDOM_EDIT_PAY}/hr edit`);
  }
  return snap;
}

function updateJobStatus(id,newStatus){
  const job=savedJobs.find(j=>String(j.id)===String(id));
  if(!job) return;
  job.status=newStatus;
  saveJobsToStorage();
  renderJobs();
  renderPayroll();
}

let _jobsStatFilter = '';
function jobsFilterStat(f){
  _jobsStatFilter = _jobsStatFilter===f ? '' : f;
  renderJobs();
}

function renderJobs(){
  const isAdmin=!gateGetSession()||gateGetSession()?.type==='admin';
  const filterPeriod=document.getElementById('jobs-filter-period')?.value||'';
  const pipeline=document.getElementById('jobs-pipeline');
  const emptyEl=document.getElementById('jobs-empty');
  if(!pipeline) return;

  // Jobs stats (top-right bar)
  const jStatsBar = document.getElementById('sales-jobs-stats-bar');
  if(jStatsBar){
    const allJ = savedJobs;
    const confirmedJobs = allJ.filter(j=>j.status==='confirmed');
    const _7dAgo = new Date(); _7dAgo.setDate(_7dAgo.getDate()-7);
    const completedJobs = allJ.filter(j=>j.status==='completed'&&new Date(j.completedAt||j.date||0)>=_7dAgo);
    const unpaidJobs = completedJobs.filter(j=>!j.markedPaid);
    const paidJobs = completedJobs.filter(j=>j.markedPaid);
    const unpaidVal = unpaidJobs.reduce((s,j)=>s+(j.grand||0),0);
    const paidVal = paidJobs.reduce((s,j)=>s+(j.grand||0),0);
    const sf = _jobsStatFilter;
    const jbox = (num, label, color, on, onclick, accentBg, accentBorder) => {
      const st = on
        ? 'background:'+accentBg+';border:2px solid '+accentBorder+';border-radius:9px;padding:4px 11px;font-size:11px;color:'+color+';cursor:pointer;user-select:none'
        : 'background:var(--navy-card);border:1px solid var(--border);border-radius:9px;padding:5px 12px;font-size:11px;color:var(--muted);cursor:pointer;user-select:none';
      return '<div onclick="'+onclick+'" title="Click to filter" style="'+st+'"><span style="font-size:13px;font-weight:700;color:'+color+';display:block">'+num+'</span>'+label+'</div>';
    };
    jStatsBar.innerHTML =
      jbox(confirmedJobs.length, 'Confirmed',           'var(--amber)',       sf==='confirmed', "jobsFilterStat('confirmed')", 'rgba(245,166,35,.12)', 'rgba(245,166,35,.5)') +
      jbox(completedJobs.length, 'Completed (7d)',       'var(--green)',       sf==='completed', "jobsFilterStat('completed')", 'rgba(34,217,122,.12)', 'rgba(34,217,122,.5)') +
      jbox('$'+unpaidVal.toLocaleString(), 'Unpaid',    '#F05252',            sf==='unpaid',    "jobsFilterStat('unpaid')",    'rgba(240,82,82,.12)',  'rgba(240,82,82,.5)') +
      jbox('$'+paidVal.toLocaleString(),   'Paid',      '#22D97A',            sf==='paid',      "jobsFilterStat('paid')",      'rgba(34,217,122,.12)', 'rgba(34,217,122,.5)');
  }

  // Refresh period filter options
  const periodSel=document.getElementById('jobs-filter-period');
  if(periodSel){
    const periods=[...new Set(savedJobs.map(j=>j.period))].sort().reverse();
    const cur=periodSel.value;
    periodSel.innerHTML='<option value="">All periods</option>'+periods.map(p=>`<option value="${p}"${p===cur?' selected':''}>${p}</option>`).join('');
  }

  let filtered=filterPeriod?savedJobs.filter(j=>j.period===filterPeriod):savedJobs;
  if(_jobsStatFilter==='confirmed') filtered=filtered.filter(j=>j.status==='confirmed');
  else if(_jobsStatFilter==='completed'){ const _7d=new Date();_7d.setDate(_7d.getDate()-7); filtered=filtered.filter(j=>j.status==='completed'&&new Date(j.completedAt||j.date||0)>=_7d); }
  else if(_jobsStatFilter==='unpaid') filtered=filtered.filter(j=>j.status==='completed'&&!j.markedPaid);
  else if(_jobsStatFilter==='paid') filtered=filtered.filter(j=>j.status==='completed'&&j.markedPaid);
  const jobsQ=(document.getElementById('jobs-search')?.value||'').trim().toLowerCase();
  if(jobsQ) filtered=filtered.filter(j=>[j.name,j.clientName,j.address,j.videographerName,j.photographerName,j.date,j.id].join(' ').toLowerCase().includes(jobsQ));
  pipeline.style.display=filtered.length?'grid':'none';
  if(emptyEl) emptyEl.style.display=filtered.length?'none':'block';

  // Render requested (client bookings) column + banner
  const requestedJobs=savedJobs.filter(j=>j.status==='requested');
  const reqCol=document.getElementById('col-requested');
  const reqBanner=document.getElementById('jobs-requested-banner');
  const reqCount=document.getElementById('col-requested-count');
  if(reqBanner) reqBanner.style.display=requestedJobs.length?'block':'none';
  if(reqCount){if(requestedJobs.length){reqCount.textContent=requestedJobs.length;reqCount.style.display='inline';}else{reqCount.style.display='none';}}
  const reqTitle=document.getElementById('jobs-requested-banner-title');
  if(reqTitle&&requestedJobs.length) reqTitle.textContent=requestedJobs.length===1?'1 new booking request':`${requestedJobs.length} new booking requests`;
  if(reqCol){
    if(!requestedJobs.length){reqCol.innerHTML='<div style="font-size:11px;color:var(--muted);padding:8px 4px">None</div>';}
    else{reqCol.innerHTML=requestedJobs.map(j=>{
      const clientRec=clients.find(c=>c.id===j.clientId);
      const clientName=clientRec?.name||j.clientName||'Client portal';
      return `<div class="job-card" onclick="openJobDetail('${j.id}')" style="cursor:pointer;border-color:rgba(245,166,35,.4)"
        onmouseover="this.style.borderColor='var(--amber)';this.style.boxShadow='0 0 0 1px var(--amber)'"
        onmouseout="this.style.borderColor='rgba(245,166,35,.4)';this.style.boxShadow=''">
        <div style="font-size:10px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg> New request</div>
        <div class="job-card-title">${j.name}</div>
        <div class="job-card-meta">${j.date||'No date'}${j.preferredTime?' at '+j.preferredTime:''}</div>
        ${clientName?`<div style="font-size:11px;color:var(--green);margin-bottom:3px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${clientName}</div>`:''}
        ${j.shootType?`<div style="font-size:10px;color:var(--blue-bright);margin-bottom:4px">${j.shootType}</div>`:''}
        ${j.notes?`<div style="font-size:10px;color:#A8B4D0;font-style:italic;margin-bottom:4px">${j.notes.slice(0,60)}${j.notes.length>60?'…':''}</div>`:''}
        <div class="job-card-actions">
          <button class="job-action-btn job-action-confirm" onclick="event.stopPropagation();updateJobStatus('${j.id}','confirmed')">✓ Confirm</button>
          <button class="job-action-btn" onclick="event.stopPropagation();updateJobStatus('${j.id}','quoted')">→ Quoted</button>
          <button class="job-action-btn job-action-delete" onclick="event.stopPropagation();deleteJob('${j.id}')">Delete</button>
        </div>
      </div>`;
    }).join('');}
  }

  const statuses=['quoted','confirmed','completed'];
  statuses.forEach(st=>{
    const col=document.getElementById('col-'+st);
    if(!col) return;
    const jobs=filtered.filter(j=>(j.status||'quoted')===st);
    if(!jobs.length){col.innerHTML='<div style="font-size:11px;color:#ccc;padding:8px 4px">None</div>';return;}
    col.innerHTML=jobs.map(j=>{
      const actionBtns=[];
      if(st==='quoted') actionBtns.push(`<button class="job-action-btn job-action-confirm" onclick="event.stopPropagation();updateJobStatus('${j.id}','confirmed')">Confirm</button>`);
      if(st==='confirmed') actionBtns.push(`<button class="job-action-btn job-action-complete" onclick="event.stopPropagation();updateJobStatus('${j.id}','completed')">Complete</button>`);
      if(st==='confirmed') actionBtns.push(`<button class="job-action-btn" onclick="event.stopPropagation();updateJobStatus('${j.id}','quoted')">← Quoted</button>`);
      if(st==='completed') actionBtns.push(`<button class="job-action-btn" onclick="event.stopPropagation();updateJobStatus('${j.id}','confirmed')">← Confirmed</button>`);
      if(isAdmin&&(st==='confirmed'||st==='completed')) actionBtns.push(`<button class="job-action-btn" style="border-color:#5B7FDB;background:rgba(91,141,239,.12);color:#7AABFF" onclick="event.stopPropagation();openInvoice('${j.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Invoice</button>`);
      if(isAdmin&&(st==='confirmed'||st==='completed')) actionBtns.push(`<button class="job-action-btn" style="border-color:#1D9E75;background:rgba(34,217,122,.1);color:#22D97A" onclick="event.stopPropagation();this.disabled=true;this.textContent='Opening…';openAndSendInvoice('${j.id}');setTimeout(()=>{this.disabled=false;this.textContent='Send invoice';},5000)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Send invoice</button>`);
      actionBtns.push(`<button class="job-action-btn" style="border-color:#C87D1E;background:rgba(245,166,35,.1);color:#F5A623" onclick="event.stopPropagation();openEditJob('${j.id}')"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>`);
      actionBtns.push(`<button class="job-action-btn job-action-delete" onclick="event.stopPropagation();deleteJob('${j.id}')">Delete</button>`);
      const ts=getTrackerStage(j.id);
      const assigned=[ts.videographer,ts.claimedBy].filter((n,i,a)=>n&&a.indexOf(n)===i).join(' · ');
      return `<div class="job-card" onclick="openJobDetail('${j.id}')" style="cursor:pointer"
        onmouseover="this.style.borderColor='var(--blue)';this.style.boxShadow='0 0 0 1px var(--blue)'"
        onmouseout="this.style.borderColor='';this.style.boxShadow=''">
        <div class="job-card-title">${j.name}</div>
        <div class="job-card-meta">${j.date}${j.shootTime?' · '+j.shootTime:''}</div>
        ${j.clientName?`<div style="font-size:11px;color:#22D97A;margin-bottom:3px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${j.clientName}</div>`:''}
        ${assigned?`<div style="font-size:10px;color:var(--blue-bright);margin-bottom:3px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${assigned}</div>`:''}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <span class="job-card-amount">${isAdmin?fmt(j.grand):''}</span>
          <span style="font-size:10px;color:#7A8AAA">${j.sqft?j.sqft.toLocaleString()+' sqft':''}</span>
        </div>
        ${j.notes?`<div style="font-size:10px;color:#A8B4D0;font-style:italic;margin-bottom:4px">${j.notes.slice(0,60)}${j.notes.length>60?'…':''}</div>`:''}
        <div style="font-size:10px;color:var(--blue-bright);margin-bottom:6px">Click for full breakdown →</div>
        <div class="job-card-actions">${actionBtns.join('')}</div>
      </div>`;
    }).join('');
  });
}


function openJobDetail(jobId){
  const j=savedJobs.find(jb=>String(jb.id)===String(jobId));
  if(!j) return;
  const isAdmin=!gateGetSession()||gateGetSession()?.type==='admin';
  const ts=getTrackerStage(j.id);

  // Contractor payout rows
  function calcPay(job){
    const rows=[];
    Object.values(job.payouts||{}).forEach(p=>{
      let total=0;
      (p.entries||[]).forEach(e=>{
        total+=e.shootFee||0;
        // editFee on a shoot entry belongs to the assigned editor (internal cost) — never add to shooter
        const isShootEntry=(e.role||'').toLowerCase().includes('shoot');
        if(!isShootEntry) total+=e.editFee||0;
        total+=e.driveFee||0;
        total+=e.miscFee||0;
      });
      if(!p.entries?.length){(p.lines||[]).forEach(l=>total+=l.fee||0);(p.editLines||[]).forEach(l=>total+=l.fee||0);}
      if(p.name&&total>0) rows.push({name:p.name,total});
    });
    return rows;
  }
  const payoutRows=calcPay(j);
  const grand=j.grand||0;
  const isUsdJob=(j.currency||'cad').toLowerCase()==='usd';
  const SVC_LABELS={video:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg> Video',photo:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Photo',tvideo:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg> Twilight video',tphoto:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Twilight photo',reel:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg> Reel',extphoto:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Ext. photo',extvideo:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg> Ext. video',floorplan:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Floor plan'};
  const activeServices=Object.entries(j.services||{}).filter(([k,v])=>v&&SVC_LABELS[k]).map(([k])=>SVC_LABELS[k]);

  // Contractor options for dropdowns
  const contractorOpts=Object.values(CONTRACTORS).map(c=>`<option value="${c.name}" ${ts.videographer===c.name?'selected':''}>${c.name}</option>`).join('');
  const editorOpts=buildEditorOptions(ts.claimedBy||'');
  const photoEditorOpts=buildEditorOptions(ts.photoEditor||'');
  const hasVideo=!!(j.services?.video||j.services?.extvideo||j.services?.randomvideo||j.services?.tvideo);
  const hasPhoto=!!(j.services?.photo||j.services?.extphoto||j.services?.randomphoto||j.services?.tphoto);

  const existing=document.getElementById('job-detail-modal');
  if(existing) existing.remove();
  const modal=document.createElement('div');
  modal.id='job-detail-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9800;display:flex;align-items:flex-start;justify-content:center;padding:30px 20px;overflow-y:auto';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};

  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:640px;border:1px solid var(--border-bright);overflow:hidden" onclick="event.stopPropagation()">
    <div style="background:var(--navy-mid);padding:18px 22px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start">
      <div>
        <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:3px">${j.name}</div>
        <div style="font-size:11px;color:var(--muted)">${j.date}${j.shootTime?' at '+j.shootTime:''} · ${j.address||''}</div>
        ${j.clientName?`<div style="font-size:11px;color:var(--green);margin-top:2px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> ${j.clientName}</div>`:''}
      </div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="status-badge status-${j.status||'quoted'}">${j.status||'quoted'}</span>
        <button onclick="document.getElementById('job-detail-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:20px">✕</button>
      </div>
    </div>
    <div style="padding:20px;max-height:80vh;overflow-y:auto">

      <!-- Services -->
      <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px">
        ${activeServices.map(s=>`<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:var(--navy-lift);border:1px solid var(--border-bright);color:var(--offwhite)">${s}</span>`).join('')}
        ${j.sqft?`<span style="padding:4px 12px;border-radius:20px;font-size:12px;font-weight:600;background:var(--navy-lift);border:1px solid var(--border-bright);color:var(--muted)">${Number(j.sqft).toLocaleString()} sqft</span>`:''}
      </div>

      ${isAdmin?`
      <!-- Cost model breakdown -->
      <div style="background:var(--navy-lift);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:12px">Cost model breakdown</div>
        <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:700;padding-bottom:8px;border-bottom:1px solid var(--border);margin-bottom:8px">
          <span style="color:var(--white)">Client invoice${isUsdJob?'':' (before HST)'}</span><span style="color:var(--green)">${fmt(grand)}</span>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;padding:3px 0">Profit 21%<span>${fmt(grand*0.21)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0">CC/Non-pay 5%<span>${fmt(grand*0.05)}</span></div>
          <div style="display:flex;justify-content:space-between;padding:3px 0">Sales 7%<span>${fmt(grand*0.07)}</span></div>
          ${j.commissionAmt>0?`<div style="display:flex;justify-content:space-between;padding:3px 0 3px 14px;color:var(--offwhite)">↳ ${j.commissionSalesperson||'Mackenzie'} (${j.commissionPct}%)<span>${fmt(j.commissionAmt)}</span></div>`:''}
          <div style="display:flex;justify-content:space-between;padding:3px 0">Admin 17%<span>${fmt(grand*0.17)}</span></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:12px;font-weight:700;color:var(--offwhite);padding:8px 0;border-top:1px solid var(--border);margin-bottom:4px">
          Contractor pool (50%)<span style="color:var(--blue-bright)">${fmt(grand*0.5)}</span>
        </div>
        ${payoutRows.map(p=>`<div style="display:flex;justify-content:space-between;font-size:11px;padding:3px 0;color:var(--muted)">${p.name}<span style="color:var(--white);font-weight:600">${fmt(p.total)}</span></div>`).join('')}
        ${isUsdJob?'':`<div style="display:flex;justify-content:space-between;font-size:11px;padding:6px 0 3px;color:var(--muted);border-top:1px solid var(--border);margin-top:6px">
          With HST (13%)<span style="color:var(--offwhite)">${fmt(grand*1.13)}</span>
        </div>`}
      </div>

      <!-- Reassign contractors -->
      <div style="background:var(--navy-lift);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:16px">
        <div style="font-size:11px;font-weight:700;color:var(--white);margin-bottom:4px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg> Assign / reassign roles</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Saving updates the project tracker and payroll automatically.</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px">
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Videographer / Shooter</label>
            <select id="jd-reassign-vid" style="width:100%;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-card);color:var(--white)">
              <option value="">— Unassigned —</option>
              ${contractorOpts}
            </select>
          </div>
          ${hasVideo?`<div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/></svg> Video Editor</label>
            <select id="jd-reassign-editor" style="width:100%;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-card);color:var(--white)">
              <option value="">— Unassigned —</option>
              ${editorOpts}
            </select>
          </div>`:'<div></div>'}
        </div>
        ${hasPhoto?`<div style="margin-bottom:10px">
          <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Photo Editor</label>
          <select id="jd-reassign-photo-editor" style="width:100%;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-card);color:var(--white)">
            <option value="">— Unassigned —</option>
            ${photoEditorOpts}
          </select>
        </div>`:''}
        <div style="display:flex;align-items:center;gap:10px">
          <button onclick="jobDetailReassign('${j.id}')" style="padding:7px 18px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">Save ✓</button>
          <span id="jd-reassign-status" style="font-size:11px;color:var(--muted)"></span>
        </div>
      </div>`:''}

      ${j.notes?`<div style="padding:10px 12px;background:var(--navy-lift);border-radius:8px;border:1px solid var(--border);font-size:12px;color:var(--offwhite);margin-bottom:16px"><span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Notes</span>${j.notes}</div>`:''}

      <div style="display:flex;gap:8px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:14px">
        ${j.status==='quoted'?`<button onclick="updateJobStatus(${j.id},'confirmed');document.getElementById('job-detail-modal').remove()" style="padding:7px 16px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Mark confirmed</button>`:''}
        ${j.status==='confirmed'?`<button onclick="updateJobStatus(${j.id},'completed');document.getElementById('job-detail-modal').remove()" style="padding:7px 16px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> Mark completed</button>`:''}
        ${isAdmin&&(j.status==='confirmed'||j.status==='completed')?`<button onclick="openInvoice(${j.id});document.getElementById('job-detail-modal').remove()" style="padding:7px 16px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Invoice</button>`:''}
        <button onclick="openEditJob(${j.id});document.getElementById('job-detail-modal').remove()" style="padding:7px 14px;border-radius:10px;border:1px solid var(--amber);background:rgba(245,166,35,.1);color:var(--amber);font-size:12px;font-weight:600;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
        <button onclick="document.getElementById('job-detail-modal').remove()" style="padding:7px 14px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:12px;cursor:pointer">Close</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function jobDetailReassign(jobId){
  const j=savedJobs.find(jb=>String(jb.id)===String(jobId));
  if(!j) return;
  const vid=document.getElementById('jd-reassign-vid')?.value||'';
  const editor=document.getElementById('jd-reassign-editor')?.value||'';
  const photoEditor=document.getElementById('jd-reassign-photo-editor')?.value||'';
  const statusEl=document.getElementById('jd-reassign-status');

  // Update tracker stage
  const ts=getTrackerStage(jobId);
  ts.videographer=vid;
  ts.claimedBy=editor;        // video editor
  ts.photoEditor=photoEditor; // photo editor (separate)
  setTrackerStage(jobId,ts);

  // Update job.editors and reassign payouts so payroll reflects new assignments
  if(j){
    if(!j.editors) j.editors={};
    const oldVidEditor=j.editors.video||'';
    const oldPhoEditor=j.editors.photo||'';
    j.editors.video=editor;
    j.editors.photo=photoEditor;

    // Helper: check if a person is a field contractor (Akbar, Brad, etc.) by looking
    // them up in CONTRACTORS by name. Internal DroneHub team members are NOT contractors.
    const isFieldContractor=(name)=>{
      if(!name) return false;
      return Object.values(CONTRACTORS).some(c=>(c.name||'').toLowerCase()===name.toLowerCase());
    };

    // Sweep ALL payout entries matching a pattern across every contractor key.
    // If the new editor is a field contractor → move the edit entries to their paystub.
    // If the new editor is an internal DroneHub team member → remove the edit entries
    //   entirely (their pay is calculated from hours × hourly rate in the hourly system).
    const reassignEditEntries=(newName,rolePattern)=>{
      if(!newName||!j.payouts) return;
      const editorIsContractor=isFieldContractor(newName);
      if(editorIsContractor && !j.payouts[newName]){
        j.payouts[newName]={name:newName,entries:[],editLines:[]};
      }
      Object.keys(j.payouts).forEach(key=>{
        const p=j.payouts[key];
        // entries[] format (new)
        const toMove=(p.entries||[]).filter(e=>rolePattern.test(e.role||''));
        if(toMove.length){
          if(editorIsContractor && key!==newName){
            // Contractor editor — move entries to their key
            if(!j.payouts[newName].entries) j.payouts[newName].entries=[];
            toMove.forEach(e=>j.payouts[newName].entries.push({...e}));
          }
          // Whether moved or removed, strip from the source (avoids double-counting)
          p.entries=p.entries.filter(e=>!rolePattern.test(e.role||''));
        }
        // editLines[] format (legacy)
        const toMoveLines=(p.editLines||[]).filter(l=>rolePattern.test(l.label||''));
        if(toMoveLines.length){
          if(editorIsContractor && key!==newName){
            if(!j.payouts[newName].editLines) j.payouts[newName].editLines=[];
            toMoveLines.forEach(l=>j.payouts[newName].editLines.push({...l}));
          }
          p.editLines=p.editLines.filter(l=>!rolePattern.test(l.label||''));
        }
      });
    };
    if(editor) reassignEditEntries(editor, /video.edit|video edit|editing.*video/i);
    if(photoEditor) reassignEditEntries(photoEditor, /photo.edit|photo edit|editing.*photo/i);
    saveJobsToStorage();
  }

  // Post LouChat notification
  const channels=getLcChannels();
  const projectsCh=channels.find(c=>c.id==='lc_projects'||c.name==='projects');
  if(projectsCh&&(vid||editor||photoEditor)){
    const msg={id:Date.now(),author:'DroneHub System',
      text:`**Assignment updated** — ${j.name}\n${vid?'Shooter: '+vid:''}${editor?'\nVideo editor: '+editor:''}${photoEditor?'\nPhoto editor: '+photoEditor:''}`,
      ts:new Date().toISOString(),reactions:{},attachments:[]};
    saveLcMessage(projectsCh.id,msg);
    // Notify each assigned person in their personal channel
    [vid,editor,photoEditor].filter((n,i,a)=>n&&a.indexOf(n)===i).forEach(name=>{
      let personalCh=channels.find(c=>c.name.toLowerCase()===name.toLowerCase().replace(/\s+/g,'-'));
      if(!personalCh){
        personalCh={id:'lc_'+Date.now()+'_'+Math.random().toString(36).slice(2,5),
          name:name.toLowerCase().replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-'),
          type:'project',topic:name+' — assigned shoots and updates',
          ownerName:name,
          createdAt:new Date().toISOString().slice(0,10),pinned:'',members:[]};
        channels.push(personalCh);
        saveLcChannels(channels);
      }
      const role=name===vid?'Shooter':name===editor?'Video Editor':'Photo Editor';
      saveLcMessage(personalCh.id,{id:Date.now()+Math.random(),author:'DroneHub System',
        text:`**You've been assigned to a project**\n\n**${j.name}**\n${j.address||''}\n${j.date}${j.shootTime?' at '+j.shootTime:''}\nRole: ${role}`,
        ts:new Date().toISOString(),reactions:{},attachments:[]});
    });
  }

  renderTracker();
  renderPayroll();
  if(statusEl){statusEl.textContent='✓ Saved — tracker and payroll updated';statusEl.style.color='var(--green)';}
}


function populateSalespersonDropdown(){
  const sel=document.getElementById('commission-salesperson-sel');
  if(!sel) return;
  const current=sel.value;

  // Collect all salespeople: team members with sales role + preset sales accounts
  const salesPeople=new Set();

  // From gate users / admin accounts with sales title
  gateGetUsers().forEach(u=>{
    const title=u.jobTitle||PRESET_JOB_TITLES[u.email]?.title||'';
    if(u.type==='admin'||title.toLowerCase().includes('sales')||title.toLowerCase().includes('acquisitions')){
      if(u.name&&u.name!=='Admin') salesPeople.add(u.name);
    }
  });

  // From admin team members with sales role
  getAdminTeamMembers().forEach(m=>{
    if(m.role==='sales'||m.jobTitle?.toLowerCase().includes('sales')) salesPeople.add(m.name);
  });

  // Always include Mackenzie as default
  salesPeople.add('Mackenzie Woodhouse');

  sel.innerHTML='<option value="">— Select salesperson —</option>'+
    [...salesPeople].sort().map(n=>`<option value="${n}"${n===current?' selected':''}>${n}</option>`).join('');
}


function refreshPayrollPeriods(){
  const sel=document.getElementById('payroll-period-sel');
  const periods=[...new Set(savedJobs.map(j=>j.period))].sort().reverse();
  const current=sel.value;
  sel.innerHTML='<option value="">— Select payroll period —</option>'+
    periods.map(p=>`<option value="${p}"${p===current?' selected':''}>${p}</option>`).join('');
}

let activePayrollContractor='';
function renderPayroll(){
  const session=gateGetSession();
  const isAdmin=!session||session.type==='admin';
  const period=document.getElementById('payroll-period-sel').value;
  const jobs=savedJobs.filter(j=>j.period===period&&j.status==='completed');
  const summary=document.getElementById('payroll-period-summary');
  const ctabs=document.getElementById('payroll-contractor-tabs');
  const ccontent=document.getElementById('payroll-contractor-content');
  const allJobs=document.getElementById('payroll-all-jobs');

  // ── TEAM MEMBER VIEW — only show their own paystub ────────────────────────
  if(!isAdmin){
    // Hide the all-jobs list and period summary entirely
    if(allJobs) allJobs.style.display='none';
    if(ctabs) ctabs.style.display='none';

    // Find this member's name from their session
    const myName=session.name||'';
    // Look across ALL periods, not just selected
    const myAllJobs=savedJobs.filter(j=>
      Object.values(j.payouts||{}).some(p=>p.name===myName)
    );

    if(!myAllJobs.length){
      summary.innerHTML='';
      ccontent.innerHTML='<div class="card"><div style="color:var(--muted);font-size:13px;padding:12px 0">No pay stubs yet — jobs you work on will appear here once completed.</div></div>';
      return;
    }

    // Calculate totals
    function calcMyPay2(j){
      const p=Object.values(j.payouts||{}).find(p=>p.name===myName);
      if(!p) return {shoot:0,edit:0,drive:0,misc:0,total:0};
      let shoot=0,edit=0,drive=p.driveFee||0,misc=0;
      (p.entries||[]).forEach(e=>{shoot+=e.shootFee||0;edit+=e.editFee||0;drive+=e.driveFee||0;misc+=e.miscFee||0;});
      if(!p.entries||!p.entries.length){
        (p.lines||[]).forEach(l=>shoot+=l.fee||0);
        (p.editLines||[]).forEach(l=>edit+=l.fee||0);
      }
      return {shoot,edit,drive,misc,total:shoot+edit+drive+misc};
    }

    const completedJobs=myAllJobs.filter(j=>j.status==='completed');
    const totalEarned=completedJobs.reduce((s,j)=>s+calcMyPay2(j).total,0);
    const pendingJobs=myAllJobs.filter(j=>j.status!=='completed');
    const pendingAmt=pendingJobs.reduce((s,j)=>s+calcMyPay2(j).total,0);

    summary.innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px">
      <div class="metric"><div class="mlabel">Total earned</div><div class="mval" style="color:var(--green)">${totalEarned>0?fmt(totalEarned):'—'}</div></div>
      <div class="metric"><div class="mlabel">Completed jobs</div><div class="mval">${completedJobs.length}</div></div>
      ${pendingAmt>0?`<div class="metric"><div class="mlabel">Pending</div><div class="mval" style="color:var(--amber)">${fmt(pendingAmt)}</div></div>`:''}
    </div>`;

    // Group by biweekly period
    const byPeriod={};
    myAllJobs.forEach(j=>{
      const p=j.period||'Unknown period';
      if(!byPeriod[p]) byPeriod[p]=[];
      byPeriod[p].push(j);
    });

    ccontent.innerHTML=`<div class="card">
      <div class="section-label" style="margin-bottom:12px">Your pay history</div>
      ${Object.keys(byPeriod).sort().reverse().map(per=>{
        const pJobs=byPeriod[per];
        const perTotal=pJobs.reduce((s,j)=>s+calcMyPay2(j).total,0);
        return `<div style="margin-bottom:16px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:12px;font-weight:700;color:var(--offwhite)">${per}</div>
            <div style="font-size:13px;font-weight:700;color:var(--green)">${fmt(perTotal)}</div>
          </div>
          ${pJobs.sort((a,b)=>b.date.localeCompare(a.date)).map(j=>{
            const pay=calcMyPay2(j);
            return `<div style="padding:10px 0;border-bottom:1px solid var(--border)">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px">
                <div style="font-size:13px;font-weight:600;color:var(--white)">${j.address||j.name}</div>
                <div style="font-size:14px;font-weight:700;color:${j.status==='completed'?'var(--green)':'var(--amber)'}">
                  ${fmt(pay.total)}${j.status!=='completed'?' ⏳':''}
                </div>
              </div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:5px">${j.date}${j.shootTime?' at '+j.shootTime:''}</div>
              <div style="display:flex;flex-wrap:wrap;gap:5px">
                ${pay.shoot>0?`<span style="padding:2px 8px;border-radius:6px;background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:11px">Shoot: ${fmt(pay.shoot)}</span>`:''}
                ${pay.edit>0?`<span style="padding:2px 8px;border-radius:6px;background:rgba(139,92,246,.12);color:#A78BFA;font-size:11px">Edit: ${fmt(pay.edit)}</span>`:''}
                ${pay.drive>0?`<span style="padding:2px 8px;border-radius:6px;background:rgba(34,217,122,.1);color:var(--green);font-size:11px">Drive: ${fmt(pay.drive)}</span>`:''}
                ${pay.misc>0?`<span style="padding:2px 8px;border-radius:6px;background:rgba(245,166,35,.1);color:var(--amber);font-size:11px">+ ${fmt(pay.misc)}</span>`:''}
              </div>
            </div>`;
          }).join('')}
        </div>`;
      }).join('')}
    </div>`;
    return;
  }

  // ── ADMIN VIEW ───────────────────────────────────────────────────────────
  return;
  if(!savedJobs.length){allJobs.innerHTML='<div style="color:#7A8AAA;font-style:italic">No jobs saved yet.</div>';return;}
  allJobs.innerHTML=savedJobs.map(j=>{
    const st=j.status||'quoted';
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 0;border-bottom:0.5px solid #f0ede6;font-size:12px;gap:8px">
      <span style="flex:1;min-width:0"><strong>${j.name}</strong> <span style="color:#7A8AAA">${j.date} · ${j.period}</span></span>
      <span class="status-badge status-${st}">${st}</span>
      <span style="color:#A8B4D0;white-space:nowrap">${fmt(j.grand)}</span>
      <button onclick="deleteJob(${j.id})" style="border:none;background:none;color:#993C1D;cursor:pointer;font-size:11px;flex-shrink:0">✕</button>
    </div>`;
  }).join('');

  if(!period||!jobs.length){
    summary.innerHTML='<div style="font-size:12px;color:#7A8AAA">'+(!period?'Select a period above.':'No completed jobs in this period yet. Mark jobs as completed in the Jobs tab to include them in payroll.')+' </div>';
    ctabs.innerHTML=''; ccontent.innerHTML=''; return;
  }

  // Period summary
  const totalRev=jobs.reduce((s,j)=>s+j.grand,0);
  const totalRevCad=jobs.filter(j=>(j.currency||'cad').toLowerCase()==='cad').reduce((s,j)=>s+j.grand,0);
  const totalRevUsd=jobs.filter(j=>(j.currency||'cad').toLowerCase()==='usd').reduce((s,j)=>s+j.grand,0);
  const totalSalesComm=savedJobs.filter(j=>j.period===period&&(j.commissionPct||0)>0)
    .reduce((s,j)=>s+(j.commissionAmt||Math.ceil(j.grand*((j.commissionPct||0)/100))),0);
  summary.innerHTML=`<div style="display:flex;gap:10px;flex-wrap:wrap">
    <div class="metric"><div class="mlabel">Jobs</div><div class="mval">${jobs.length}</div></div>
    <div class="metric"><div class="mlabel">Total invoiced</div><div class="mval">${fmt(totalRev)}</div></div>
    ${totalRevCad>0?`<div class="metric"><div class="mlabel">CAD w/ HST</div><div class="mval">${fmt(totalRevCad*1.13)}</div></div>`:''}
    ${totalRevUsd>0?`<div class="metric"><div class="mlabel">USD (no HST)</div><div class="mval">${fmt(totalRevUsd)}</div></div>`:''}
    ${totalSalesComm>0?`<div class="metric"><div class="mlabel">Sales commission</div><div class="mval">${fmt(totalSalesComm)}</div></div>`:''}
  </div>`;

  // Collect all contractors across jobs in this period
  const contractorTotals={};
  jobs.forEach(j=>{
    Object.values(j.payouts).forEach(c=>{
      if(!contractorTotals[c.name]) contractorTotals[c.name]={name:c.name,jobs:[]};
      contractorTotals[c.name].jobs.push({jobName:j.name,jobDate:j.date,address:j.address,entries:c.entries});
    });
  });

  // Add commission paystubs grouped by salesperson
  const allPeriodJobs=savedJobs.filter(j=>j.period===period);
  const commByPerson={};
  allPeriodJobs.filter(j=>(j.commissionPct||0)>0).forEach(j=>{
    const person=j.commissionSalesperson||'Mackenzie Woodhouse';
    if(!commByPerson[person]) commByPerson[person]={name:person,isSales:true,jobs:[]};
    const pct=j.commissionPct||0;
    const amt=j.commissionAmt||Math.ceil(j.grand*(pct/100));
    commByPerson[person].jobs.push({jobName:j.name,jobDate:j.date,address:j.address,commissionPct:pct,commissionAmt:amt,grand:j.grand,status:j.status||'quoted'});
  });
  Object.assign(contractorTotals,commByPerson);

  const names=Object.keys(contractorTotals).sort();
  if(!names.length){ctabs.innerHTML='<div style="font-size:12px;color:#7A8AAA">No contractor data for this period.</div>';ccontent.innerHTML='';return;}

  if(!activePayrollContractor||!names.includes(activePayrollContractor)) activePayrollContractor=names[0];

  ctabs.innerHTML=names.map(n=>
    `<button onclick="selectPayrollContractor('${n.replace(/'/g,"\\'")}')\">` +
    '</button>'
  ).join('');

  // Fix: inline the full button properly
  ctabs.innerHTML=names.map(n=>{
    const bn=n.replace(/'/g,"\\'");
    const isActive=activePayrollContractor===n;
    const extraStyle=n==='Mackenzie Woodhouse'?';border-color:var(--border-bright);color:var(--offwhite)':'';
    const label=n==='Mackenzie Woodhouse'?'\u{1f4bc} '+n:n;
    return '<button onclick="selectPayrollContractor(\'' + bn + '\')" class="tab' + (isActive?' active':'') + '" style="font-size:12px' + extraStyle + '">' + label + '</button>';
  }).join('');

  renderPayrollStub(contractorTotals[activePayrollContractor],period);
}
function selectPayrollContractor(name){
  activePayrollContractor=name;
  renderPayroll();
}

function renderPayrollStub(contractor,period){
  const el=document.getElementById('payroll-contractor-content');

  // ── MACKENZIE WOODHOUSE — COMMISSION STUB ──────────────────────────────────
  if(contractor.isMackenzie){
    const biz=bizSettings||{};
    const issueDate=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
    const totalComm=contractor.jobs.reduce((s,j)=>s+(j.commissionAmt||0),0);

    el.innerHTML=`<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:16px">
        <div>
          <div style="font-size:18px;font-weight:700;color:var(--white)">Sales Commission Statement</div>
          <div style="font-size:12px;color:var(--muted);margin-top:3px">Issued: ${issueDate} · Period: ${period}</div>
        </div>
        ${biz.name?`<div style="text-align:right"><div style="font-size:13px;font-weight:700;color:var(--white)">${biz.name}</div><div style="font-size:11px;color:var(--muted)">${biz.address||''}</div></div>`:''}
      </div>

      <div style="background:rgba(139,92,246,.08);border:1px solid rgba(139,92,246,.3);border-radius:10px;padding:12px 16px;margin-bottom:16px">
        <div style="font-size:14px;font-weight:700;color:var(--white)">Mackenzie Woodhouse</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Sales Representative — Commission Earnings</div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px">
        <thead>
          <tr style="background:var(--navy-lift)">
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--offwhite);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Job / Property</th>
            <th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:700;color:var(--offwhite);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Date</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--offwhite);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Invoice</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:var(--offwhite);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Rate</th>
            <th style="padding:8px 10px;text-align:right;font-size:10px;font-weight:700;color:var(--offwhite);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Commission</th>
            <th style="padding:8px 10px;text-align:center;font-size:10px;font-weight:700;color:var(--offwhite);text-transform:uppercase;letter-spacing:.06em;border-bottom:1px solid var(--border)">Status</th>
          </tr>
        </thead>
        <tbody>
          ${contractor.jobs.map((j,i)=>{
            const amt=j.commissionAmt||Math.ceil((j.grand||0)*(j.commissionPct||0)/100);
            return `
          <tr style="background:${i%2===0?'rgba(255,255,255,.02)':'transparent'}">
            <td style="padding:8px 10px;font-size:12px;color:var(--white)">${j.jobName}<br><span style="font-size:10px;color:var(--muted)">${j.address||''}</span></td>
            <td style="padding:8px 10px;font-size:12px;color:var(--muted);white-space:nowrap">${j.jobDate}</td>
            <td style="padding:8px 10px;font-size:12px;color:var(--offwhite);text-align:right;white-space:nowrap">${fmt(j.grand||0)}</td>
            <td style="padding:8px 10px;font-size:12px;text-align:center">
              <span style="padding:2px 8px;border-radius:8px;background:rgba(91,141,239,.15);color:var(--blue-bright);font-weight:700">${j.commissionPct||0}%</span>
            </td>
            <td style="padding:8px 10px;font-size:12px;color:var(--green);font-weight:700;text-align:right;white-space:nowrap">${fmt(amt)}</td>
            <td style="padding:8px 10px;text-align:center"><span class="status-badge status-${j.status||'quoted'}">${j.status||'quoted'}</span></td>
          </tr>`;}).join('')}
        </tbody>
      </table>

      <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
        <div style="background:var(--navy-lift);border-radius:10px;padding:12px 20px;min-width:220px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
            <span style="font-size:12px;color:var(--muted)">Total jobs</span>
            <span style="font-size:12px;color:var(--offwhite);font-weight:600">${contractor.jobs.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--border);padding-top:8px;margin-top:4px">
            <span style="font-size:14px;font-weight:700;color:var(--white)">Total Commission</span>
            <span style="font-size:16px;font-weight:700;color:var(--green)">${fmt(totalComm)}</span>
          </div>
        </div>
      </div>

      <div style="font-size:10px;color:var(--muted);border-top:1px solid var(--border);padding-top:10px">
        Commission is part of the Sales/Acquisition overhead — not added to client invoices. Based on commissioned jobs in period ${period}.
      </div>
    </div>`;
    return;
  }

  // Find contractor record by name to get business info
  const cRecord=Object.values(CONTRACTORS).find(c=>c.name===contractor.name)||{};
  const biz=bizSettings||{};
  const issueDate=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});

  let totalShoot=0,totalEdit=0,totalDrive=0,totalMisc=0;

  let html=`<div class="card">
    
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;padding-bottom:14px;border-bottom:2px solid #1a1a1a">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7A8AAA;margin-bottom:4px">Prepared by</div>
        <div style="font-size:15px;font-weight:700">${biz.name||'DroneHub Media Company'}</div>
        ${biz.addr1?`<div style="font-size:11px;color:#A8B4D0">${biz.addr1}</div>`:''}
        ${biz.addr2?`<div style="font-size:11px;color:#A8B4D0">${biz.addr2}</div>`:''}
        ${biz.email?`<div style="font-size:11px;color:#A8B4D0">${biz.email}</div>`:''}
        ${biz.hst?`<div style="font-size:10px;color:#7A8AAA;margin-top:2px">HST# ${biz.hst}</div>`:''}
      </div>
      <div style="text-align:right">
        <div style="font-size:22px;font-weight:200;color:#1D9E75;letter-spacing:.04em">PAY STUB</div>
        <div style="font-size:11px;color:#A8B4D0;margin-top:2px">Period: ${period}</div>
        <div style="font-size:11px;color:#7A8AAA">Issued: ${issueDate}</div>
      </div>
    </div>

    
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:16px;padding:12px;background:#1C2333;border-radius:8px">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7A8AAA;margin-bottom:5px">Pay to</div>
        <div style="font-size:14px;font-weight:600">${contractor.name}</div>
        ${cRecord.company?`<div style="font-size:12px;color:#C8D0E8">${cRecord.company}</div>`:''}
        ${cRecord.email?`<div style="font-size:11px;color:#A8B4D0">${cRecord.email}</div>`:''}
        ${cRecord.phone?`<div style="font-size:11px;color:#A8B4D0">${cRecord.phone}</div>`:''}
        ${cRecord.addr?`<div style="font-size:11px;color:#A8B4D0">${cRecord.addr}</div>`:''}
        ${cRecord.hst?`<div style="font-size:10px;color:#7A8AAA;margin-top:3px">HST# ${cRecord.hst}</div>`:''}
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7A8AAA;margin-bottom:5px">Role</div>
        <div style="font-size:12px;color:#C8D0E8">${cRecord.role||'Contractor'}</div>
        ${cRecord.rate?`<div style="font-size:11px;color:#A8B4D0;margin-top:2px">Hourly rate: $${cRecord.rate}/hr</div>`:''}
      </div>
    </div>

    
    <div style="font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.06em;color:#A8B4D0;margin-bottom:8px">Job breakdown</div>`;

  contractor.jobs.forEach(job=>{
    const jobShoot=job.entries.reduce((s,e)=>s+e.shootFee,0);
    const jobEdit=job.entries.reduce((s,e)=>s+e.editFee,0);
    const jobDrive=job.entries.reduce((s,e)=>s+e.driveFee,0);
    const jobMisc=job.entries.reduce((s,e)=>s+e.miscFee,0);
    const jobTotal=jobShoot+jobEdit+jobDrive+jobMisc;
    totalShoot+=jobShoot; totalEdit+=jobEdit; totalDrive+=jobDrive; totalMisc+=jobMisc;

    html+=`<div style="border:0.5px solid #e0ddd5;border-radius:8px;padding:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;margin-bottom:4px">
        <div style="font-size:13px;font-weight:500">${job.jobDate} — ${job.jobName}</div>
        <div style="font-size:13px;font-weight:600">${fmt(jobTotal)}</div>
      </div>
      <div style="font-size:11px;color:#A8B4D0;margin-bottom:6px">${job.address}</div>
      <div style="border-top:0.5px solid #f0ede6;padding-top:6px">
        ${job.entries.filter(e=>e.shootFee>0||e.editFee>0||e.driveFee>0||e.miscFee>0).map(e=>{
          const parts=[];
          if(e.shootFee>0) parts.push(`Shoot: ${fmt(e.shootFee)}`);
          if(e.editFee>0) parts.push(`Edit: ${fmt(e.editFee)}`);
          if(e.miscFee>0) parts.push(`${e.miscDetail||'Misc'}: ${fmt(e.miscFee)}`);
          if(e.driveFee>0) parts.push(`Drive: ${fmt(e.driveFee)}`);
          return `<div style="font-size:11px;color:#555;padding:1px 0">${e.role}: ${parts.join(' · ')}</div>`;
        }).join('')}
      </div>
    </div>`;
  });

  const grandTotal=totalShoot+totalEdit+totalDrive+totalMisc;
  const hstLine=cRecord.hst?`<div style="font-size:11px;color:#A8B4D0;margin-top:4px">Note: HST charged separately by contractor if registered</div>`:'';

  html+=`<div style="border-top:1.5px solid #1a1a1a;padding-top:12px;margin-top:8px">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:12px">
      ${totalShoot>0?`<div class="metric"><div class="mlabel">Shoot fees</div><div class="mval">${fmt(totalShoot)}</div></div>`:''}
      ${totalEdit>0?`<div class="metric"><div class="mlabel">Edit fees</div><div class="mval">${fmt(totalEdit)}</div></div>`:''}
      ${totalMisc>0?`<div class="metric"><div class="mlabel">Misc / hourly</div><div class="mval">${fmt(totalMisc)}</div></div>`:''}
      ${totalDrive>0?`<div class="metric"><div class="mlabel">Drive reimb.</div><div class="mval">${fmt(totalDrive)}</div></div>`:''}
    </div>
    <div class="brow total"><span>Total payable to ${contractor.name}</span><span>${fmt(grandTotal)}</span></div>
    ${hstLine}
  </div>
  </div>`;

  el.innerHTML=html;
}

// ─── EDIT JOB ────────────────────────────────────────────────────────────────
let editingJobId=null;
let _ejUsState={};   // tracks current US pricing selections in edit modal

function openEditJob(jobId){
  const job=savedJobs.find(j=>String(j.id)===String(jobId));
  if(!job){alert('Job not found.');return;}
  editingJobId=jobId;

  // Populate header
  document.getElementById('ej-job-name').textContent=job.name;
  document.getElementById('ej-job-meta').textContent=`${job.date||''}${job.shootTime?' at '+job.shootTime:''} · ${job.address} · ${job.sqft?job.sqft.toLocaleString()+' sqft':''}`;

  // Determine if this is a US market job
  const isUSJob=!!(job.usData||job.currency==='usd');
  document.getElementById('ej-ca-section').style.display=isUSJob?'none':'';
  document.getElementById('ej-us-section').style.display=isUSJob?'':'none';

  if(isUSJob){
    // US market — populate US pricing section
    _ejInitUSEdit(job);
  } else {
    // Canadian market — restore services
    const svcs=job.services||{};
    const hrs=job.hours||{};
    ['video','photo','tvideo','tphoto','floorplan','extphoto','extvideo','reel','randomvideo','randomphoto'].forEach(k=>{
      const cb=document.getElementById('ej-svc-'+k);
      if(cb) cb.checked=!!svcs[k];
    });
    ['reel','randomvideo','randomphoto'].forEach(k=>{
      const inp=document.getElementById('ej-qty-'+k);
      if(inp) inp.value=hrs[k]||1;
    });
    // Rush & custom adj
    const cb=document.getElementById('ej-svc-rush');
    if(cb) cb.checked=!!(svcs.rush);
  }

  document.getElementById('ej-adj-amount').value=Math.abs(job.customAdj||0);
  document.getElementById('ej-adj-type').value=(job.customAdj||0)<0?'subtract':'add';

  // Shoot details
  document.getElementById('ej-date').value=job.date||'';
  document.getElementById('ej-time').value=job.shootTime||'';
  document.getElementById('ej-duration').value=job.duration||'2';
  document.getElementById('ej-notes').value=job.notes||'';
  document.getElementById('ej-drive-link').value=job.driveLink||'';

  if(isUSJob) recalcEditUS(); else recalcEdit();
  document.getElementById('edit-job-overlay').style.display='block';
}

// ── US edit modal helpers ──────────────────────────────────────────────────

function _ejInitUSEdit(job){
  const ud=job.usData||{};
  const market=ud.market||'other_us';
  const p=US_MARKET_PRICING[market]||US_MARKET_PRICING['other_us'];

  _ejUsState={
    market,
    pkgType:ud.pkgType||null,
    listingTier:ud.listingTier||null,
    socialTier:ud.socialTier||null,
    dayType:ud.dayType||null,
    reelCount:ud.reelCount||0,
    reelsTBD:ud.reelsTBD||false,
    dayLocations:ud.dayLocations||[],
    offSeason:ud.offSeason||false,
    addons:{sunrise:!!(ud.addons?.sunrise),photoHDR:!!(ud.addons?.photoHDR),photoFlash:!!(ud.addons?.photoFlash)},
  };

  // Market label
  document.getElementById('ej-us-market-label').textContent=p.label+' Market';
  // Addon prices
  document.getElementById('ej-us-sunrise-price').textContent=p.addons.sunrise.toLocaleString();
  document.getElementById('ej-us-hdr-price').textContent=p.addons.photoHDR.toLocaleString();
  document.getElementById('ej-us-flash-price').textContent=p.addons.photoFlash.toLocaleString();
  document.getElementById('ej-us-offseason-price').textContent=p.offSeasonDiscount.toLocaleString();
  // Addon checkboxes
  document.getElementById('ej-us-sunrise').checked=_ejUsState.addons.sunrise;
  document.getElementById('ej-us-hdr').checked=_ejUsState.addons.photoHDR;
  document.getElementById('ej-us-flash').checked=_ejUsState.addons.photoFlash;
  document.getElementById('ej-us-offseason').checked=_ejUsState.offSeason;

  _ejRenderUSPkgBtns();
  _ejRenderUSTierBtns();
}

function _ejRenderUSPkgBtns(){
  const c=document.getElementById('ej-us-pkg-btns');
  if(!c) return;
  const pkgs=[
    {key:'listing', label:'Listing'},
    {key:'social',  label:'Social Reels'},
    {key:'agent',   label:'Agent Promo'},
    {key:'day',     label:'☀️ Day Rate'},
    {key:'exterior',label:'Exterior Only'},
  ];
  const active='padding:7px 14px;border-radius:8px;border:1px solid #5B8DEF;background:rgba(91,141,239,.25);color:#7AABFF;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:4px';
  const idle ='padding:7px 14px;border-radius:8px;border:1px solid #3A4460;background:rgba(91,141,239,.07);color:#A8B4D0;font-size:12px;font-weight:600;cursor:pointer;margin-bottom:4px';
  c.innerHTML=pkgs.map(pk=>`<button onclick="ejSelectUSPkg('${pk.key}')" style="${_ejUsState.pkgType===pk.key?active:idle}">${pk.label}</button>`).join('');
}

function ejSelectUSPkg(pkgType){
  _ejUsState.pkgType=pkgType;
  _ejUsState.listingTier=null;
  _ejUsState.socialTier=null;
  _ejRenderUSPkgBtns();
  _ejRenderUSTierBtns();
  recalcEditUS();
}

function _ejRenderUSTierBtns(){
  const market=_ejUsState.market||'other_us';
  const p=US_MARKET_PRICING[market]||US_MARKET_PRICING['other_us'];
  const tierRow=document.getElementById('ej-us-tier-row');
  const socialRow=document.getElementById('ej-us-social-row');

  const active='padding:7px 14px;border-radius:8px;border:1px solid #5B8DEF;background:rgba(91,141,239,.25);color:#7AABFF;font-size:12px;cursor:pointer;margin-bottom:4px';
  const idle ='padding:7px 14px;border-radius:8px;border:1px solid #3A4460;background:rgba(91,141,239,.07);color:#A8B4D0;font-size:12px;cursor:pointer;margin-bottom:4px';

  if(_ejUsState.pkgType==='listing'){
    if(tierRow) tierRow.style.display='';
    if(socialRow) socialRow.style.display='none';
    const c=document.getElementById('ej-us-tier-btns');
    if(c) c.innerHTML=[
      {key:'under4k',label:'Under 4,000 sqft',price:p.listing.under4k},
      {key:'over4k', label:'4,000–8,000 sqft', price:p.listing.over4k},
      {key:'over8k', label:'Over 8,000 sqft',  price:p.listing.over8k},
    ].map(t=>`<button onclick="ejSelectUSTier('${t.key}')" style="${_ejUsState.listingTier===t.key?active:idle}">${t.label} — $${t.price.toLocaleString()}</button>`).join('');
  } else if(_ejUsState.pkgType==='social'){
    if(tierRow) tierRow.style.display='none';
    if(socialRow) socialRow.style.display='';
    const c=document.getElementById('ej-us-social-btns');
    if(c){
      const tiers=[
        {key:'r1',label:'1 Reel'},{key:'r2',label:'2 Reels'},{key:'r3',label:'3 Reels'},
        {key:'r4',label:'4 Reels'},{key:'r5',label:'5 Reels'},{key:'fullDay',label:'Full Day (Unlimited)'},
      ];
      c.innerHTML=tiers.filter(t=>p.social[t.key]!=null).map(t=>`<button onclick="ejSelectUSSocialTier('${t.key}')" style="${_ejUsState.socialTier===t.key?active:idle}">${t.label} — $${p.social[t.key].toLocaleString()}</button>`).join('');
    }
  } else {
    if(tierRow)  tierRow.style.display='none';
    if(socialRow) socialRow.style.display='none';
  }
}

function ejSelectUSTier(tier){
  _ejUsState.listingTier=tier;
  _ejRenderUSTierBtns();
  recalcEditUS();
}

function ejSelectUSSocialTier(tier){
  _ejUsState.socialTier=tier;
  _ejRenderUSTierBtns();
  recalcEditUS();
}

function recalcEditUS(){
  const job=savedJobs.find(j=>String(j.id)===String(editingJobId));
  if(!job) return;
  const market=_ejUsState.market||'other_us';
  const p=US_MARKET_PRICING[market]||US_MARKET_PRICING['other_us'];

  // Sync addon checkboxes into state
  _ejUsState.addons.sunrise   =!!(document.getElementById('ej-us-sunrise')?.checked);
  _ejUsState.addons.photoHDR  =!!(document.getElementById('ej-us-hdr')?.checked);
  _ejUsState.addons.photoFlash=!!(document.getElementById('ej-us-flash')?.checked);
  _ejUsState.offSeason        =!!(document.getElementById('ej-us-offseason')?.checked);

  const noSel=(msg)=>{
    document.getElementById('ej-breakdown').textContent=msg;
    document.getElementById('ej-new-total').textContent='$—';
    document.getElementById('ej-total-delta').textContent='';
  };

  let base=0;
  const parts=[];

  switch(_ejUsState.pkgType){
    case 'listing':
      if(!_ejUsState.listingTier) return noSel('← Select property size tier');
      base=p.listing[_ejUsState.listingTier]||0;
      const tl={under4k:'Under 4k sqft',over4k:'4k–8k sqft',over8k:'Over 8k sqft'};
      parts.push(`Listing (${tl[_ejUsState.listingTier]}) $${base.toLocaleString()}`);
      break;
    case 'social':
      if(!_ejUsState.socialTier) return noSel('← Select social package tier');
      base=p.social[_ejUsState.socialTier]||0;
      const sl={r1:'1 Reel',r2:'2 Reels',r3:'3 Reels',r4:'4 Reels',r5:'5 Reels',fullDay:'Full Day'};
      parts.push(`Social Reels (${sl[_ejUsState.socialTier]||_ejUsState.socialTier}) $${base.toLocaleString()}`);
      if(_ejUsState.offSeason){const d=p.offSeasonDiscount||0;base=Math.max(0,base-d);parts.push(`Off-Season −$${d.toLocaleString()}`);}
      break;
    case 'agent':
      base=p.agentPromo||0;
      parts.push(`Agent Promo $${base.toLocaleString()}`);
      break;
    case 'exterior':
      base=p.exteriorOnly||750;
      parts.push(`Exterior Only $${base.toLocaleString()}`);
      break;
    case 'day':{
      // Day rate: reconstruct from stored usData (half/full + per-reel)
      const ud=job.usData||{};
      if(ud.dayType==='half'||ud.dayType==='full'){
        base=ud.dayType==='half'?US_SOCIAL_DAY.halfDay:US_SOCIAL_DAY.fullDay;
        const totalReels=ud.dayLocations?.reduce((s,l)=>s+(l.reelCount||0),0)||(ud.reelCount||0);
        base+=totalReels*US_SOCIAL_DAY.reelRate;
        parts.push(`Day Rate (${ud.dayType==='half'?'Half':'Full'} Day${totalReels>0?', '+totalReels+' reel'+(totalReels>1?'s':''):''}) $${base.toLocaleString()}`);
      } else {
        base=job.grand||0;
        parts.push(`Day Rate (kept from original) $${base.toLocaleString()}`);
      }
      break;
    }
    default:
      return noSel('← Select a package type above');
  }

  if(_ejUsState.addons.sunrise)   {const a=p.addons.sunrise;   base+=a;parts.push(`Sunrise/Sunset +$${a.toLocaleString()}`);}
  if(_ejUsState.addons.photoHDR)  {const a=p.addons.photoHDR;  base+=a;parts.push(`Photo HDR +$${a.toLocaleString()}`);}
  if(_ejUsState.addons.photoFlash){const a=p.addons.photoFlash;base+=a;parts.push(`Flash Photo +$${a.toLocaleString()}`);}

  // Custom adj
  const adjAmt=parseFloat(document.getElementById('ej-adj-amount')?.value)||0;
  const adjType=document.getElementById('ej-adj-type')?.value||'add';
  const adjSigned=adjType==='subtract'?-adjAmt:adjAmt;
  if(adjAmt>0){base+=adjSigned;parts.push(`Custom adj. ${adjType==='subtract'?'−':'+'}$${adjAmt.toLocaleString()}`);}

  const orig=job.grand||0;
  const delta=base-orig;
  document.getElementById('ej-new-total').textContent='$'+base.toLocaleString();
  document.getElementById('ej-total-delta').textContent=orig>0?(delta===0?`Same as original ($${orig.toLocaleString()})`:
    (delta>0?`+$${delta.toLocaleString()} more than original ($${orig.toLocaleString()})`:
     `$${Math.abs(delta).toLocaleString()} less than original ($${orig.toLocaleString()})`)):'';
  document.getElementById('ej-breakdown').textContent=parts.join(' · ');
}

function closeEditJob(){
  document.getElementById('edit-job-overlay').style.display='none';
  editingJobId=null;
  document.getElementById('ej-save-status').textContent='';
}

function recalcEdit(){
  const job=savedJobs.find(j=>String(j.id)===String(editingJobId));
  if(!job) return;
  // For US market jobs, delegate to the US recalc
  if(job.usData||job.currency==='usd'){ recalcEditUS(); return; }

  const sqft=job.sqft||0;
  // Read checked services
  const s={};
  ['video','photo','tvideo','tphoto','floorplan','extphoto','extvideo','reel','randomvideo','randomphoto','rush'].forEach(k=>{
    const el=document.getElementById('ej-svc-'+k);
    if(el) s[k]=el.checked;
  });
  const qty={
    reel:parseInt(document.getElementById('ej-qty-reel')?.value)||1,
    randomvideo:parseInt(document.getElementById('ej-qty-randomvideo')?.value)||1,
    randomphoto:parseInt(document.getElementById('ej-qty-randomphoto')?.value)||1,
  };

  // Recalculate using same pricing logic as buildQuote
  let total=0;
  const parts=[];

  if(s.video&&s.photo){
    const vb=baseVideoRate(sqft);
    const vt=Math.ceil(vb/(1-MARGIN));
    const pb=photoBase(sqft,true);
    const pt=pb; // photo is already flat client price
    total+=vt+pt; parts.push(`Video ${fmt(vt)} + Photo ${fmt(pt)}`);
  } else {
    if(s.video){const vb=baseVideoRate(sqft);const vt=Math.ceil(vb/(1-MARGIN));total+=vt;parts.push(`Video ${fmt(vt)}`);}
    if(s.photo){const pb=photoBase(sqft,false);const pt=pb;total+=pt;parts.push(`Photo ${fmt(pt)}`);}
  }
  if(s.tvideo&&s.tphoto){total+=TWILIGHT_BOTH;parts.push(`Twilight pkg ${fmt(TWILIGHT_BOTH)}`);}
  else if(s.tvideo){total+=TWILIGHT_VIDEO;parts.push(`Twilight video ${fmt(TWILIGHT_VIDEO)}`);}
  else if(s.tphoto){total+=TWILIGHT_PHOTO;parts.push(`Twilight photo ${fmt(TWILIGHT_PHOTO)}`);}
  if(s.reel){const a=qty.reel*150;total+=a;parts.push(`Reels×${qty.reel} ${fmt(a)}`);}
  if(s.floorplan){total+=150;parts.push(`Floor plan ${fmt(150)}`);}
  if(s.extphoto){total+=150;parts.push(`Ext. photo ${fmt(150)}`);}
  if(s.extvideo){total+=150;parts.push(`Ext. video ${fmt(150)}`);}
  if(s.randomvideo){const a=qty.randomvideo*RANDOM_VIDEO_RATE_CLIENT;total+=a;parts.push(`Random video ${qty.randomvideo}hr ${fmt(a)}`);}
  if(s.randomphoto){const a=qty.randomphoto*RANDOM_PHOTO_RATE_CLIENT;total+=a;parts.push(`Random photo ${qty.randomphoto}hr ${fmt(a)}`);}
  if(s.rush){total+=RUSH_FEE;parts.push(`Rush order ${fmt(RUSH_FEE)}`);}

  // Custom adjustment
  const adjAmt=parseFloat(document.getElementById('ej-adj-amount')?.value)||0;
  const adjType=document.getElementById('ej-adj-type')?.value||'add';
  const adjSigned=adjType==='subtract'?-adjAmt:adjAmt;
  if(adjAmt>0){total+=adjSigned;parts.push(`Custom adj. ${adjType==='subtract'?'−':'+'}${fmt(adjAmt)}`);}

  // Add drive cost from original job (unchanged)
  total+=job.driveCost||0;
  if(job.driveCost>0) parts.push(`Drive ${fmt(job.driveCost)}`);

  const orig=job.grand||0;
  const delta=total-orig;
  document.getElementById('ej-new-total').textContent=fmt(total);
  document.getElementById('ej-total-delta').textContent=
    orig>0?(delta===0?`Same as original (${fmt(orig)})`:
      (delta>0?`+${fmt(delta)} more than original (${fmt(orig)})`:
       `${fmt(Math.abs(delta))} less than original (${fmt(orig)})`)):'';
  document.getElementById('ej-breakdown').textContent=parts.join(' · ');
}

function saveEditJob(){
  const job=savedJobs.find(j=>String(j.id)===String(editingJobId));
  if(!job) return;

  const adjAmt=parseFloat(document.getElementById('ej-adj-amount')?.value)||0;
  const adjType=document.getElementById('ej-adj-type')?.value||'add';
  const adjSigned=adjType==='subtract'?-adjAmt:adjAmt;

  const isUSJob=!!(job.usData||job.currency==='usd');
  let total=0;

  if(isUSJob){
    // ── US market: recalculate from _ejUsState ──────────────────────────────
    const market=_ejUsState.market||'other_us';
    const p=US_MARKET_PRICING[market]||US_MARKET_PRICING['other_us'];

    switch(_ejUsState.pkgType){
      case 'listing':
        if(!_ejUsState.listingTier){alert('Please select a property size tier.');return;}
        total=p.listing[_ejUsState.listingTier]||0;
        break;
      case 'social':
        if(!_ejUsState.socialTier){alert('Please select a social package tier.');return;}
        total=p.social[_ejUsState.socialTier]||0;
        if(_ejUsState.offSeason) total=Math.max(0,total-(p.offSeasonDiscount||0));
        break;
      case 'agent':
        total=p.agentPromo||0;
        break;
      case 'exterior':
        total=p.exteriorOnly||750;
        break;
      case 'day':{
        const ud=job.usData||{};
        total=ud.dayType==='half'?US_SOCIAL_DAY.halfDay:US_SOCIAL_DAY.fullDay;
        const reels=ud.dayLocations?.reduce((s,l)=>s+(l.reelCount||0),0)||(ud.reelCount||0);
        total+=reels*US_SOCIAL_DAY.reelRate;
        break;
      }
      default:
        alert('Please select a package type.');return;
    }
    if(_ejUsState.addons.sunrise)    total+=p.addons.sunrise;
    if(_ejUsState.addons.photoHDR)   total+=p.addons.photoHDR;
    if(_ejUsState.addons.photoFlash) total+=p.addons.photoFlash;
    if(adjAmt>0) total+=adjSigned;

    // Persist updated US data back onto job
    job.usData={
      ...(job.usData||{}),
      pkgType:_ejUsState.pkgType,
      listingTier:_ejUsState.listingTier,
      socialTier:_ejUsState.socialTier,
      offSeason:_ejUsState.offSeason,
      addons:{..._ejUsState.addons},
    };
    job.currency='usd';
    job.services={};   // clear CA services so they don't bleed into invoices
  } else {
    // ── Canadian market: original logic ────────────────────────────────────
    const s={};
    ['video','photo','tvideo','tphoto','floorplan','extphoto','extvideo','reel','randomvideo','randomphoto','rush'].forEach(k=>{
      const el=document.getElementById('ej-svc-'+k);
      if(el) s[k]=el.checked;
    });
    const qty={
      reel:parseInt(document.getElementById('ej-qty-reel')?.value)||1,
      randomvideo:parseInt(document.getElementById('ej-qty-randomvideo')?.value)||1,
      randomphoto:parseInt(document.getElementById('ej-qty-randomphoto')?.value)||1,
    };
    const sqft=job.sqft||0;
    if(s.video&&s.photo){
      const vb=baseVideoRate(sqft);
      const vt=Math.ceil(vb/(1-MARGIN));
      const pt=photoBase(sqft,true);
      total+=vt+pt;
    } else {
      if(s.video){ const vb=baseVideoRate(sqft); total+=Math.ceil(vb/(1-MARGIN)); }
      if(s.photo) total+=photoBase(sqft,false);
    }
    if(s.tvideo&&s.tphoto) total+=TWILIGHT_BOTH;
    else if(s.tvideo) total+=TWILIGHT_VIDEO;
    else if(s.tphoto) total+=TWILIGHT_PHOTO;
    if(s.reel) total+=qty.reel*150;
    if(s.floorplan) total+=150;
    if(s.extphoto) total+=150;
    if(s.extvideo) total+=150;
    if(s.randomvideo) total+=qty.randomvideo*RANDOM_VIDEO_RATE_CLIENT;
    if(s.randomphoto) total+=qty.randomphoto*RANDOM_PHOTO_RATE_CLIENT;
    if(s.rush) total+=RUSH_FEE;
    if(adjAmt>0) total+=adjSigned;
    total+=job.driveCost||0;
    job.services={...s};
    job.hours={...qty};
  }

  // Update job in place
  const newDate=document.getElementById('ej-date').value||job.date;
  const period=getBiweeklyPeriod(newDate);
  job.grand=total;
  job.date=newDate;
  job.shootTime=document.getElementById('ej-time').value||job.shootTime;
  job.duration=document.getElementById('ej-duration').value||job.duration;
  job.notes=document.getElementById('ej-notes').value;
  job.driveLink=(document.getElementById('ej-drive-link').value||'').trim()||null;
  job.customAdj=adjSigned;
  job.period=period.label; job.periodStart=period.start; job.periodEnd=period.end;
  job.editedAt=new Date().toISOString().slice(0,16).replace('T',' ');

  saveJobsToStorage();
  renderJobs();
  renderClients();
  renderCalendar();

  const status=document.getElementById('ej-save-status');
  status.textContent=`✓ Updated — new total $${total.toLocaleString()}`;
  setTimeout(()=>closeEditJob(),1800);
}

function deleteJob(id){
  savedJobs=savedJobs.filter(j=>j.id!==id);
  saveJobsToStorage();
  // Delete the individual sub-collection doc for this job
  if(_fbToken()) fbSubDelete('jobs',String(id)).catch(e=>console.error('[deleteJob] sub-delete failed:',e.message));
  refreshPayrollPeriods(); renderPayroll(); renderJobs();
}
function clearJobsByStatus(status){
  const count=savedJobs.filter(j=>(j.status||'quoted')===status).length;
  if(!count){alert('No '+status+' jobs to clear.');return;}
  if(!confirm('Clear all '+count+' '+status+' job'+(count>1?'s':'')+'? This cannot be undone.')) return;
  const removedIds=savedJobs.filter(j=>(j.status||'quoted')===status).map(j=>String(j.id));
  savedJobs=savedJobs.filter(j=>(j.status||'quoted')!==status);
  saveJobsToStorage();
  // Delete sub-collection docs for removed jobs
  if(_fbToken()) removedIds.forEach(id=>fbSubDelete('jobs',id).catch(()=>{}));
  refreshPayrollPeriods(); renderPayroll(); renderJobs();
}

function clearAllJobs(){
  if(!confirm('Clear all saved jobs?')) return;
  window._intentionalClearJobs = true;
  savedJobs=[]; saveJobsToStorage(); refreshPayrollPeriods(); renderPayroll(); renderJobs();
}

function exportPayroll(){
  const period=document.getElementById('payroll-period-sel').value;
  if(!period){alert('Select a payroll period first.');return;}
  const jobs=savedJobs.filter(j=>j.period===period&&j.status==='completed');
  const rows=[['Date','Job','Address','Contractor','Role','Shoot Fee','Edit Fee','Misc Fee','Drive','Total']];
  jobs.forEach(j=>{
    Object.values(j.payouts).forEach(c=>{
      c.entries.forEach(e=>{
        const tot=e.shootFee+e.editFee+e.miscFee+e.driveFee;
        if(tot===0) return;
        rows.push([j.date,j.name,j.address,c.name,e.role,
          e.shootFee.toFixed(2),e.editFee.toFixed(2),e.miscFee.toFixed(2),e.driveFee.toFixed(2),tot.toFixed(2)]);
      });
    });
  });
  const csv=rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');
  const a=document.createElement('a');
  a.href='data:text/csv;charset=utf-8,'+encodeURIComponent(csv);
  a.download=`DroneHub_Payroll_${period.replace(/[\s–]/g,'_')}.csv`;
  a.click();
}


function calc(){
  // Skip Canadian calc when a US market is selected
  const _market=document.getElementById('job-market-input')?.value||'canada';
  if(_market!=='canada'){ calcUS(); return; }

  const sqft=parseInt(document.getElementById('sqft').value);
  document.getElementById('sqftVal').textContent=sqft.toLocaleString()+' sqft';
  const{lines,grand,driveCost,ds}=buildQuote(sqft,svc,qty);

  // Drive cost display
  const hasBoth=svc.video&&svc.photo;
  document.getElementById('driveCostDisplay').textContent=fmt(driveCost);
  let driveLabel='';
  if(!propLat) driveLabel='look up address to calculate drive';
  else if(driveCost===0) driveLabel='within free zone — no drive charge';
  else if(hasBoth&&!ds.sameShooter) driveLabel='2 contractors — separate drives';
  else if(ds.sameShooter&&hasBoth) driveLabel='same contractor — single drive';
  else driveLabel='contractor drive charge';
  document.getElementById('driveKmDisplay').textContent=driveLabel;

  // Update service hints
  const vhint=document.getElementById('video-price-hint');
  if(vhint) vhint.textContent=propLat?fmt(Math.ceil((baseVideoRate(sqft)+ds.vidClientCharge)/(1-MARGIN)*(1+ADMIN_RATE)))+' for '+sqft.toLocaleString()+' sqft':'from $'+Math.ceil((baseVideoRate(sqft))/(1-MARGIN)*(1+ADMIN_RATE))+' (no address yet)';
  const phoB=photoBase(sqft,false);
  const hint=document.getElementById('photo-price-hint');
  if(hint) hint.textContent=`${fmt(phoB)} standalone / ${fmt(phoB-50)} with video`;

  // Exterior hints — show $150 + drive per assigned contractor
  const extpHint=document.getElementById('extphoto-price-hint');
  if(extpHint){
    const charge=ds.extPhotoClientCharge||0;
    extpHint.textContent=ds.phoKey?(charge>0?`$${150+charge} (incl. drive)`:'$150 — free zone'):'$150 (select photographer)';
  }
  const extvHint=document.getElementById('extvideo-price-hint');
  if(extvHint){
    const charge=ds.extVideoClientCharge||0;
    extvHint.textContent=ds.vidKey?(charge>0?`$${150+charge} (incl. drive)`:'$150 — free zone'):'$150 (select videographer)';
  }
  const rvHint=document.getElementById('randomvideo-price-hint');
  if(rvHint){
    const hrs=qty.randomvideo||1;
    const charge=ds.randVideoClientCharge||0;
    rvHint.textContent=`$${200*hrs+charge} (${hrs}hr${hrs>1?'s':''}${charge>0?' + drive':''})`;
  }
  const rpHint=document.getElementById('randomphoto-price-hint');
  if(rpHint){
    const hrs=qty.randomphoto||1;
    const charge=ds.randPhotoClientCharge||0;
    rpHint.textContent=`$${200*hrs+charge} (${hrs}hr${hrs>1?'s':''}${charge>0?' + drive':''})`;
  }

  renderBreakdown(lines,grand,driveCost,'lineBreakdown','shooterNote','resultsGrid');
  renderCostModel(grand,driveCost,lines);
  renderTierTable();
}

// ─────────────────────────────────────────────────────────────────────────────
// AI QUOTE ASSISTANT — parses a freeform description into the Quote Builder
// form fields via /.netlify/functions/ai-quote-parse. Never auto-saves —
// only fills the form so the user can review the calculated price and click
// Save themselves.
// ─────────────────────────────────────────────────────────────────────────────
function _aiQuoteSetStatus(msg, isError){
  const el = document.getElementById('ai-quote-status');
  if(!el) return;
  el.textContent = msg;
  el.style.color = isError ? 'var(--red)' : 'var(--muted)';
}

async function aiQuoteGenerate(){
  const input = document.getElementById('ai-quote-input');
  const description = (input?.value || '').trim();
  if(!description){ _aiQuoteSetStatus('Type a description first.', true); return; }
  if(!_fbToken()){ _aiQuoteSetStatus('Not signed in — please refresh and sign in again.', true); return; }

  const btn = document.getElementById('ai-quote-btn');
  if(btn){ btn.disabled = true; btn.style.opacity = '.6'; }
  _aiQuoteSetStatus('Thinking…');

  try{
    const contractorList = Object.values(CONTRACTORS||{}).map(c=>({name:c.name, role:c.role||''}));
    const clientList = (clients||[]).map(c=>({name:c.name, email:c.email||''}));

    const res = await fetch('/.netlify/functions/ai-quote-parse', {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_fbToken()},
      body: JSON.stringify({ description, contractors: contractorList, clients: clientList }),
    });
    const json = await res.json().catch(()=>({}));
    if(!res.ok){ _aiQuoteSetStatus(json.error || 'AI request failed (HTTP '+res.status+')', true); return; }

    aiQuoteApplyToForm(json.data || {});
    _aiQuoteSetStatus('✓ Form filled — review the price below, then click Save job.');
  }catch(e){
    _aiQuoteSetStatus('Network error: '+e.message, true);
  }finally{
    if(btn){ btn.disabled = false; btn.style.opacity = '1'; }
  }
}

function aiQuoteApplyToForm(d){
  // Address — also triggers geocoding/drive-cost lookup
  if(d.address){
    const addrEl = document.getElementById('qAddrInput');
    if(addrEl){ addrEl.value = d.address; if(typeof searchQAddr==='function') searchQAddr(); }
    const nameEl = document.getElementById('job-name-input');
    if(nameEl && !nameEl.value) nameEl.value = d.address;
  }

  // Square footage
  if(d.sqft){
    const sqftEl = document.getElementById('sqft');
    if(sqftEl){ sqftEl.value = Math.max(800, Math.min(8000, Math.round(d.sqft/50)*50)); }
  }

  // Market — triggers service-panel/currency switch
  if(d.market){
    const marketEl = document.getElementById('job-market-input');
    if(marketEl && marketEl.querySelector(`option[value="${d.market}"]`)){
      marketEl.value = d.market;
      if(typeof onMarketChange==='function') onMarketChange(d.market);
    }
  }

  // Contractors — match AI-suggested names against the real roster (CONTRACTORS keys)
  const findContractorKey = (name) => {
    if(!name) return '';
    const target = name.trim().toLowerCase();
    const entry = Object.entries(CONTRACTORS||{}).find(([,c])=>(c.name||'').trim().toLowerCase()===target);
    return entry ? entry[0] : '';
  };
  const vidKey = findContractorKey(d.videographerName);
  if(vidKey){ const el=document.getElementById('sel-videographer'); if(el){ el.value=vidKey; } }
  const phoKey = findContractorKey(d.photographerName);
  if(phoKey){ const el=document.getElementById('sel-photographer'); if(el){ el.value=phoKey; } }
  const fpKey = findContractorKey(d.floorplanName);
  if(fpKey){ const el=document.getElementById('sel-floorplan'); if(el){ el.value=fpKey; } }
  if((vidKey||phoKey||fpKey) && typeof onContractorChange==='function') onContractorChange();

  // Services — only flip toggles that differ from the AI's desired state
  if(d.services && typeof svc==='object'){
    Object.entries(d.services).forEach(([key,want])=>{
      if(typeof want!=='boolean') return;
      if(!(key in svc)) return;
      if(svc[key]!==want){
        const tbtn = document.getElementById('tog-'+key);
        if(tbtn) toggleSvc(key, tbtn);
      }
    });
  }

  // Client — match against existing clients by name or email, else prefill "new client" form
  if(d.clientName || d.clientEmail){
    const target = (d.clientEmail||d.clientName||'').trim().toLowerCase();
    const match = (clients||[]).find(c =>
      (d.clientEmail && c.email && c.email.toLowerCase()===d.clientEmail.trim().toLowerCase()) ||
      (c.name && c.name.toLowerCase()===target)
    );
    if(match){
      selectClient(match.id);
    } else if(d.clientName){
      const searchEl = document.getElementById('client-search-input');
      if(searchEl){ searchEl.value = d.clientName; }
      if(typeof showNewClientForm==='function') showNewClientForm();
      if(d.clientEmail){ const e=document.getElementById('new-client-email'); if(e) e.value=d.clientEmail; }
      if(d.clientPhone){ const p=document.getElementById('new-client-phone'); if(p) p.value=d.clientPhone; }
    }
  }

  // Date / time / duration / notes
  if(d.jobDate){ const el=document.getElementById('job-date-input'); if(el) el.value=d.jobDate; }
  if(d.jobTime){ const el=document.getElementById('job-time-input'); if(el) el.value=d.jobTime; }
  if(d.duration){ const el=document.getElementById('job-duration-input'); if(el) el.value=d.duration; }
  if(d.notes){ const el=document.getElementById('job-notes-input'); if(el) el.value=d.notes; }

  // Recalculate price with everything now in place
  if(typeof calc==='function') calc();
}

// ─────────────────────────────────────────────────────────────────────────────
// US MARKET PRICING FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── Custom Market dropdown (flat SVG flags — Apple's flag emoji renders as a
// wavy ribbon and can't be flattened with CSS). The real <select id="job-
// market-input"> stays hidden in the DOM since many functions read its
// .value directly; this just drives a nicer-looking UI in front of it.
const _CA_FLAG_SVG = '<svg width="18" height="13" viewBox="0 0 20 14"><rect width="20" height="14" fill="#fff"/><rect width="5" height="14" fill="#FF0000"/><rect x="15" width="5" height="14" fill="#FF0000"/><path d="M10 2.6l.9 1.5 1.5-.8-.4 1.6 1.7.1-1.2 1.1.9 1.4-1.6-.3.1 1.6-1-1-.9 1.1-.1-1.7-1.6.4.8-1.5-1.3-1 1.7-.2-.5-1.6 1.6.7z" fill="#FF0000"/><path d="M10 9.5v1.4" stroke="#FF0000" stroke-width="0.7"/></svg>';
const _US_FLAG_SVG = '<svg width="18" height="13" viewBox="0 0 20 14"><rect width="20" height="14" fill="#fff"/><g fill="#B22234"><rect y="0" width="20" height="1.1"/><rect y="2.2" width="20" height="1.1"/><rect y="4.4" width="20" height="1.1"/><rect y="6.6" width="20" height="1.1"/><rect y="8.8" width="20" height="1.1"/><rect y="11" width="20" height="1.1"/><rect y="13" width="20" height="1.1"/></g><rect width="8" height="7.5" fill="#3C3B6E"/></svg>';
const MARKET_OPTS = [
  {id:'canada', label:'Canada', flag:_CA_FLAG_SVG},
  {id:'new_york', label:'New York', flag:_US_FLAG_SVG},
  {id:'texas', label:'Texas', flag:_US_FLAG_SVG},
  {id:'arizona', label:'Arizona', flag:_US_FLAG_SVG},
  {id:'colorado', label:'Colorado / Vail–Aspen', flag:_US_FLAG_SVG},
  {id:'other_us', label:'Other US', flag:_US_FLAG_SVG},
];

function syncMarketDropdownDisplay(){
  const sel = document.getElementById('job-market-input');
  const opt = MARKET_OPTS.find(o=>o.id===(sel?.value||'canada')) || MARKET_OPTS[0];
  const labelEl = document.getElementById('market-dropdown-label');
  if(labelEl) labelEl.innerHTML = opt.flag+'<span>'+opt.label+'</span>';
}

function selectMarket(marketId){
  const sel = document.getElementById('job-market-input');
  if(sel) sel.value = marketId;
  onMarketChange(marketId);
  const panel = document.getElementById('market-dropdown-panel');
  if(panel) panel.style.display = 'none';
}

let _marketDropdownOutsideHandler = null;
function toggleMarketDropdown(evt){
  evt?.stopPropagation();
  const panel = document.getElementById('market-dropdown-panel');
  const btn = document.getElementById('market-dropdown-btn');
  if(!panel || !btn) return;
  const opening = panel.style.display === 'none';
  if(opening){
    panel.innerHTML = MARKET_OPTS.map(o=>`
      <button type="button" onclick="selectMarket('${o.id}')" style="display:flex;align-items:center;gap:8px;width:100%;box-sizing:border-box;padding:8px 10px;border:none;background:transparent;color:#E8ECF8;font-size:13px;cursor:pointer;border-radius:6px;text-align:left" onmouseover="this.style.background='#2f3a55'" onmouseout="this.style.background='transparent'">${o.flag}<span>${o.label}</span></button>`).join('');
    // Re-parent to <body> with position:fixed so the .card's overflow:hidden
    // doesn't clip the panel — same pattern as the other floating menus.
    if(panel.parentElement !== document.body) document.body.appendChild(panel);
    const rect = btn.getBoundingClientRect();
    panel.style.position = 'fixed';
    panel.style.top = (rect.bottom+4)+'px';
    panel.style.left = rect.left+'px';
    panel.style.width = rect.width+'px';
    panel.style.right = 'auto';
  }
  panel.style.display = opening ? 'block' : 'none';
  if(_marketDropdownOutsideHandler){
    document.removeEventListener('click', _marketDropdownOutsideHandler);
    _marketDropdownOutsideHandler = null;
  }
  if(opening){
    _marketDropdownOutsideHandler = (e) => {
      const btn = document.getElementById('market-dropdown-btn');
      if(!panel.contains(e.target) && e.target!==btn && !btn?.contains(e.target)){
        panel.style.display = 'none';
        document.removeEventListener('click', _marketDropdownOutsideHandler);
        _marketDropdownOutsideHandler = null;
      }
    };
    setTimeout(()=>document.addEventListener('click', _marketDropdownOutsideHandler), 0);
  }
}

function onMarketChange(market){
  if(typeof syncMarketDropdownDisplay==='function') syncMarketDropdownDisplay();
  const isUS = market !== 'canada';

  // Auto-set currency
  const currSel = document.getElementById('job-currency-input');
  if(currSel){ currSel.value = isUS ? 'usd' : 'cad'; }

  // Toggle services panels
  const caPanel = document.getElementById('canada-services-panel');
  const usPanel = document.getElementById('us-services-panel');
  if(caPanel) caPanel.style.display = isUS ? 'none' : '';
  if(usPanel) usPanel.style.display = isUS ? '' : 'none';

  // Toggle quote panels
  const caQ = document.getElementById('canada-quote-panel');
  const usQ = document.getElementById('us-quote-panel');
  if(caQ) caQ.style.display = isUS ? 'none' : '';
  if(usQ) usQ.style.display = isUS ? '' : 'none';

  if(isUS){
    usQuoteState.market = market;
    // Default to listing pkg if nothing selected
    if(!usQuoteState.pkgType) usQuoteState.pkgType = 'listing';
    renderUSServicePanel(market);
    calcUS();
  } else {
    usQuoteState = { market:null, pkgType:null, listingTier:null, socialTier:null, dayType:null, reelCount:0, reelsTBD:false, dayLocations:[], addons:{sunrise:false,photoHDR:false,photoFlash:false}, offSeason:false };
    calc();
  }
}

function renderUSServicePanel(market){
  const p = US_MARKET_PRICING[market];
  if(!p) return;

  // Update pkg button active state
  ['listing','social','agent','day','exterior'].forEach(k=>{
    const btn = document.getElementById('us-pkg-'+k);
    if(btn){ btn.classList.toggle('us-pkg-active', usQuoteState.pkgType===k); }
  });

  // Show the correct sub-panel
  ['listing','social','agent','day','exterior'].forEach(k=>{
    const el = document.getElementById('us-panel-'+k);
    if(el) el.style.display = usQuoteState.pkgType===k ? '' : 'none';
  });
  // Render location list whenever the day panel is visible
  if(usQuoteState.pkgType==='day') renderUSDayLocations();

  // Update listing tier prices
  if(p.listing){
    const td = document.getElementById('us-tier-under4k-price');
    const td2 = document.getElementById('us-tier-over4k-price');
    const td3 = document.getElementById('us-tier-over8k-price');
    if(td)  td.textContent  = '$'+p.listing.under4k.toLocaleString();
    if(td2) td2.textContent = '$'+p.listing.over4k.toLocaleString();
    if(td3) td3.textContent = '$'+p.listing.over8k.toLocaleString();
  }

  // Rebuild social tier buttons dynamically
  if(usQuoteState.pkgType==='social'){
    const container = document.getElementById('us-social-tiers');
    if(container){
      const tiers=[
        {key:'r1', label:'1 Reel'},
        {key:'r2', label:'2 Reels'},
        {key:'r3', label:'3 Reels'},
        {key:'r4', label:'4 Reels'},
        {key:'r5', label:'5 Reels'},
        {key:'fullDay', label:'Full Day (Unlimited)'},
      ];
      container.innerHTML = tiers.filter(t=>p.social[t.key]!==null && p.social[t.key]!==undefined)
        .map(t=>`<button id="us-stier-${t.key}" onclick="selectUSSocialTier('${t.key}')"
          class="us-tier-btn ${usQuoteState.socialTier===t.key?'us-tier-active':''}"
          style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;
          border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);
          color:var(--white);font-size:13px;cursor:pointer;text-align:left">
          <span>${t.label}</span>
          <span style="font-weight:700;color:var(--blue-bright)">$${p.social[t.key].toLocaleString()}</span>
        </button>`).join('');
    }
  }

  // Update listing tier active states
  if(usQuoteState.pkgType==='listing'){
    ['under4k','over4k','over8k'].forEach(k=>{
      const btn = document.getElementById('us-tier-'+k);
      if(btn) btn.classList.toggle('us-tier-active', usQuoteState.listingTier===k);
    });
  }
}

function selectUSPkg(pkgType){
  usQuoteState.pkgType = pkgType;
  usQuoteState.listingTier = null;
  usQuoteState.socialTier = null;
  usQuoteState.dayType = null;
  const market = document.getElementById('job-market-input')?.value || usQuoteState.market;
  renderUSServicePanel(market);
  calcUS();
}

function selectUSTier(tier){
  usQuoteState.listingTier = tier;
  // Update active states
  ['under4k','over4k','over8k'].forEach(k=>{
    const btn = document.getElementById('us-tier-'+k);
    if(btn) btn.classList.toggle('us-tier-active', k===tier);
  });
  calcUS();
}

function selectUSSocialTier(tier){
  usQuoteState.socialTier = tier;
  // Update active states on dynamically generated buttons
  document.querySelectorAll('[id^="us-stier-"]').forEach(btn=>{
    btn.classList.toggle('us-tier-active', btn.id==='us-stier-'+tier);
  });
  calcUS();
}

function selectUSDayType(type){
  usQuoteState.dayType = type;
  const halfBtn = document.getElementById('us-day-half');
  const fullBtn = document.getElementById('us-day-full');
  if(halfBtn) halfBtn.classList.toggle('us-day-active', type==='half');
  if(fullBtn) fullBtn.classList.toggle('us-day-active', type==='full');
  calcUS();
}

// Legacy single-counter (kept for old saved jobs)
function changeUSReelCount(delta){
  usQuoteState.reelCount = Math.max(0, (usQuoteState.reelCount||0)+delta);
  const el = document.getElementById('us-reel-count-display');
  if(el) el.textContent = usQuoteState.reelCount;
  calcUS();
}
function toggleUSReelsTBD(checked){ usQuoteState.reelsTBD = checked; calcUS(); }

// ── Multi-location reel tracking for Social Day Rate ──────────────────────────
function renderUSDayLocations(){
  const container = document.getElementById('us-day-locations');
  if(!container) return;
  if(!usQuoteState.dayLocations) usQuoteState.dayLocations = [];
  const locs = usQuoteState.dayLocations;
  if(!locs.length){
    container.innerHTML = '<div style="font-size:12px;color:var(--muted);text-align:center;padding:8px 0;font-style:italic">No locations yet — click Add Location to begin.</div>';
    return;
  }
  const btnStyle = 'width:26px;height:26px;border-radius:50%;border:1px solid var(--border);background:var(--navy-card);color:var(--white);font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0';
  container.innerHTML = locs.map((loc, i) => {
    const reels = loc.reelCount || 0;
    const cost  = reels * 100;
    return `<div style="background:var(--navy-lift);border:1px solid var(--border);border-radius:10px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em">Location ${i+1}</div>
        ${locs.length>1?`<button onclick="removeUSLocation(${i})" title="Remove this location" style="width:22px;height:22px;border-radius:50%;border:1px solid rgba(240,82,82,.4);background:rgba(240,82,82,.08);color:#FF7070;font-size:13px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;flex-shrink:0">✕</button>`:''}
      </div>
      <input type="text" value="${(loc.address||'').replace(/"/g,'&quot;')}" oninput="usQuoteState.dayLocations[${i}].address=this.value" placeholder="Address or location name…" style="width:100%;padding:7px 10px;border-radius:8px;border:1px solid var(--border-bright);background:var(--navy-card);color:var(--white);font-size:12px;box-sizing:border-box;margin-bottom:10px;outline:none">
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
        <div style="font-size:11px;color:var(--muted);font-weight:600">Reels:</div>
        <button onclick="changeUSLocationReels(${i},-1)" style="${btnStyle}">−</button>
        <span style="font-size:18px;font-weight:900;color:var(--blue-bright);min-width:22px;text-align:center">${reels}</span>
        <button onclick="changeUSLocationReels(${i},1)" style="${btnStyle}">+</button>
        <span style="font-size:11px;color:var(--muted)">${reels===1?'reel':'reels'}</span>
        ${cost>0?`<span style="font-size:11px;color:var(--green);font-weight:700;margin-left:4px">+$${cost.toLocaleString()}</span>`:''}
      </div>
    </div>`;
  }).join('');
}

function addUSLocation(){
  if(!usQuoteState.dayLocations) usQuoteState.dayLocations = [];
  usQuoteState.dayLocations.push({address:'', reelCount:0});
  renderUSDayLocations();
  calcUS();
}

function removeUSLocation(idx){
  if(!usQuoteState.dayLocations) return;
  usQuoteState.dayLocations.splice(idx,1);
  renderUSDayLocations();
  calcUS();
}

function changeUSLocationReels(idx, delta){
  if(!usQuoteState.dayLocations) return;
  const loc = usQuoteState.dayLocations[idx];
  if(!loc) return;
  loc.reelCount = Math.max(0, (loc.reelCount||0)+delta);
  renderUSDayLocations();
  calcUS();
}

function getUSGrand(){
  const market = usQuoteState.market || document.getElementById('job-market-input')?.value;
  if(!market || market==='canada') return 0;
  const p = US_MARKET_PRICING[market];
  if(!p) return 0;
  let base = 0;

  switch(usQuoteState.pkgType){
    case 'listing':
      if(!usQuoteState.listingTier) return 0;
      base = p.listing[usQuoteState.listingTier] || 0;
      break;
    case 'social':
      if(!usQuoteState.socialTier) return 0;
      base = p.social[usQuoteState.socialTier] || 0;
      if(usQuoteState.offSeason && document.getElementById('us-offseason-check')?.checked){
        base = Math.max(0, base - p.offSeasonDiscount);
      }
      break;
    case 'agent':
      base = p.agentPromo;
      break;
    case 'exterior':
      base = p.exteriorOnly || 750;
      break;
    case 'day':
      if(!usQuoteState.dayType) return 0;
      base = usQuoteState.dayType==='half' ? US_SOCIAL_DAY.halfDay : US_SOCIAL_DAY.fullDay;
      // Sum reels across all locations (multi-location system)
      if(usQuoteState.dayLocations && usQuoteState.dayLocations.length){
        const totalReels = usQuoteState.dayLocations.reduce((s,l)=>s+(l.reelCount||0),0);
        base += totalReels * US_SOCIAL_DAY.reelRate;
      } else if(!usQuoteState.reelsTBD){
        // Legacy fallback for old saved jobs
        base += (usQuoteState.reelCount||0) * US_SOCIAL_DAY.reelRate;
      }
      break;
    default:
      return 0;
  }

  // Add-ons
  if(document.getElementById('us-addon-sunrise')?.checked)    base += p.addons.sunrise;
  if(document.getElementById('us-addon-photoHDR')?.checked)   base += p.addons.photoHDR;
  if(document.getElementById('us-addon-photoFlash')?.checked) base += p.addons.photoFlash;

  return base;
}

function calcUS(){
  const market = usQuoteState.market || document.getElementById('job-market-input')?.value;
  if(!market || market==='canada') return;

  // Read live addon state
  usQuoteState.addons.sunrise    = !!(document.getElementById('us-addon-sunrise')?.checked);
  usQuoteState.addons.photoHDR   = !!(document.getElementById('us-addon-photoHDR')?.checked);
  usQuoteState.addons.photoFlash = !!(document.getElementById('us-addon-photoFlash')?.checked);
  usQuoteState.offSeason         = !!(document.getElementById('us-offseason-check')?.checked);

  const grand = getUSGrand();
  renderUSQuote(market, grand);
}

function renderUSQuote(market, grand){
  const grid = document.getElementById('us-results-grid');
  const breakdown = document.getElementById('us-line-breakdown');
  if(!grid || !breakdown) return;

  const p = US_MARKET_PRICING[market];
  const fmt = n => '$'+n.toLocaleString();

  if(!grand){
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--muted);font-size:13px">Select a package above to see your quote</div>`;
    breakdown.innerHTML = '';
    return;
  }

  // Build line items
  const lines = [];
  const pkgLabels = { listing:'Listing Video Tour', social:'Social Reels Package', agent:'Agent Promo', day:'Social Day Rate', exterior:'Exterior Only' };

  switch(usQuoteState.pkgType){
    case 'listing':{
      const tierLabels = { under4k:'Under 4,000 sqft', over4k:'4,000–8,000 sqft', over8k:'Over 8,000 sqft' };
      lines.push({ label:'Listing Video — '+tierLabels[usQuoteState.listingTier||'under4k'], amount: p?.listing[usQuoteState.listingTier]||0 });
      break;
    }
    case 'social':{
      const tierLabels = { r1:'1 Reel', r2:'2 Reels', r3:'3 Reels', r4:'4 Reels', r5:'5 Reels', fullDay:'Full Day (Unlimited Reels)' };
      let base = p?.social[usQuoteState.socialTier]||0;
      lines.push({ label:'Social Reels — '+tierLabels[usQuoteState.socialTier||'r1'], amount: base });
      if(usQuoteState.offSeason && p){
        lines.push({ label:'Off-season discount (Nov–Feb)', amount: -(p.offSeasonDiscount), color:'var(--green)' });
      }
      break;
    }
    case 'agent':
      lines.push({ label:'Agent Promo Package', amount: p?.agentPromo||4000 });
      break;
    case 'exterior':
      lines.push({ label:'Exterior Only Package', amount: p?.exteriorOnly||750 });
      break;
    case 'day':{
      const base = usQuoteState.dayType==='half' ? US_SOCIAL_DAY.halfDay : US_SOCIAL_DAY.fullDay;
      lines.push({ label:(usQuoteState.dayType==='half'?'Half Day':'Full Day')+' Social Shoot', amount: base });
      // Multi-location reels
      if(usQuoteState.dayLocations && usQuoteState.dayLocations.length){
        usQuoteState.dayLocations.forEach((loc,i)=>{
          const addr = loc.address ? loc.address.trim() : `Location ${i+1}`;
          const reels = loc.reelCount || 0;
          if(reels > 0){
            lines.push({ label:`${addr} — ${reels} reel${reels===1?'':'s'} × $100`, amount: reels * US_SOCIAL_DAY.reelRate });
          } else {
            lines.push({ label:`${addr}`, amount: 0, note:'0 reels', color:'var(--muted)' });
          }
        });
      } else if(!usQuoteState.reelsTBD && usQuoteState.reelCount>0){
        // Legacy fallback
        lines.push({ label:`Post-shoot reels (${usQuoteState.reelCount} × $100)`, amount: usQuoteState.reelCount * US_SOCIAL_DAY.reelRate });
      } else if(usQuoteState.reelsTBD){
        lines.push({ label:'Post-shoot reels', amount: 0, note:'TBD — invoice updated after shoot', color:'var(--amber)' });
      }
      break;
    }
  }

  // Add-on lines
  if(usQuoteState.addons.sunrise)    lines.push({ label:'Sunrise / Sunset shoot', amount: p?.addons.sunrise||500 });
  if(usQuoteState.addons.photoHDR)   lines.push({ label:'Photo HDR', amount: p?.addons.photoHDR||500 });
  if(usQuoteState.addons.photoFlash) lines.push({ label:'Photo Flash', amount: p?.addons.photoFlash||1000 });

  // Summary grid cards
  const marketLabel = p?.label || 'US';
  grid.innerHTML = [
    { label:'Market', value: marketLabel, icon:'' },
    { label:'Package', value: pkgLabels[usQuoteState.pkgType]||'—', icon:'' },
    { label:'Total (USD)', value: fmt(grand), icon:'', big:true, green:true },
  ].map(c=>`<div style="background:var(--navy-lift);border:1px solid var(${c.green?'--blue':'--border'});
    border-radius:10px;padding:12px 14px">
    <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:4px">${c.icon} ${c.label}</div>
    <div style="font-size:${c.big?'22':'15'}px;font-weight:${c.big?'900':'700'};color:${c.green?'var(--blue-bright)':'var(--white)'}">${c.value}</div>
  </div>`).join('');

  // Line breakdown table
  breakdown.innerHTML = `
    <div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
      <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Invoice breakdown</div>
      ${lines.map(l=>`<div style="display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:13px">
        <span style="color:${l.color||'var(--offwhite)'}">
          ${l.label}${l.note?`<span style="font-size:11px;color:var(--amber);margin-left:6px">⚠ ${l.note}</span>`:''}
        </span>
        <span style="font-weight:700;color:${l.color||(l.amount<0?'var(--green)':'var(--white)')}">${l.amount===0&&l.note?'TBD':fmt(l.amount)}</span>
      </div>`).join('')}
      <div style="display:flex;justify-content:space-between;align-items:baseline;padding:8px 0 0;font-size:15px;font-weight:900">
        <span style="color:var(--white)">Total</span>
        <span style="color:var(--blue-bright)">${fmt(grand)} <span style="font-size:11px;font-weight:600;color:var(--muted)">USD · No HST</span></span>
      </div>
      <div style="margin-top:8px;padding:8px 12px;background:rgba(91,141,239,.08);border:1px solid rgba(91,141,239,.2);border-radius:8px;font-size:11px;color:var(--muted)">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Invoice will be sent in <strong style="color:var(--white)">USD</strong> — payment processed via Stripe to Chase (US account)
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────


async function geocodeAddress(addr){
  // Use Google Maps JS API geocoder — works from any browser
  if(googleGeocoder){
    return new Promise((resolve,reject)=>{
      googleGeocoder.geocode({address:addr+' Canada',region:'ca'},(results,status)=>{
        if(status==='OK'&&results[0]){
          resolve({
            lat:results[0].geometry.location.lat(),
            lng:results[0].geometry.location.lng(),
            name:results[0].formatted_address
          });
        } else {
          reject(new Error('Google geocoder: '+status));
        }
      });
    });
  }
  throw new Error('Address lookup not ready — please try again in a moment');
}

async function searchQAddr(){
  const addr=document.getElementById('qAddrInput').value.trim();
  if(!addr)return;
  const statusEl=document.getElementById('qAddrStatus');
  statusEl.innerHTML='<div class="status-pill pill-loading"><span class="dot dot-loading"></span>Looking up address…</div>';
  document.getElementById('qAddrResult').style.display='none';
  try{
    // Use Nominatim (OpenStreetMap) — free, no API key, works from any browser
    const geo=await geocodeAddress(addr);
    propLat=geo.lat; propLng=geo.lng; propAddrText=geo.name;
    const displayName=geo.name;
    document.getElementById('qAddrResultLabel').innerHTML=`<strong>${displayName}</strong><br><span style="font-size:11px;color:#7A8AAA">Drive charges calculated per contractor below</span>`;
    statusEl.innerHTML=`<div class="status-pill pill-free"><span class="dot dot-free"></span>${displayName} located</div>`;
    document.getElementById('qAddrResult').style.display='block';
    refreshAddrPanel();
    calc();
  }catch(e){
    console.error('Address lookup error:',e);
    statusEl.innerHTML='<div class="status-pill pill-error"><span class="dot dot-error"></span>Could not find address — try adding city and province (e.g. 123 Main St, Oakville, ON)</div>';
  }
}

function applyQAddr(){
  const labelEl=document.getElementById('qAddrResultLabel');
  const location=labelEl?.querySelector('strong')?.textContent||document.getElementById('qAddrInput').value.trim();
  document.getElementById('qAddrStatus').innerHTML=`<div class="status-pill pill-free"><span class="dot dot-free"></span>${location} — applied to quote</div>`;
  document.getElementById('qAddrResult').style.display='none';
  const al=document.getElementById('appliedLocation');
  const alt=document.getElementById('appliedLocationText');
  if(al&&alt){al.style.display='block';alt.textContent=`Property: ${propAddrText||location}`;}
  // Show weather card immediately and fetch
  const wCard=document.getElementById('weather-card');
  if(wCard) wCard.style.display='block';
  if(propLat&&propLng){
    fetchWeather(propLat,propLng,propAddrText||location);
  } else {
    const wDaily=document.getElementById('weather-daily');
    if(wDaily) wDaily.innerHTML='<div style="font-size:12px;color:var(--amber);padding:8px">⚠ Apply an address first to load the forecast</div>';
  }
  calc();
}

function calcAddr(){
  const sqftEl=document.getElementById('addrSqft');
  if(!sqftEl) return;
  const sqft=parseInt(sqftEl.value);
  const sv=document.getElementById('addrSqftVal');if(sv) sv.textContent=sqft.toLocaleString()+' sqft';
  const{lines,grand,driveCost}=buildQuote(sqft,asvc,aqty);
  renderBreakdown(lines,grand,driveCost,'addrBreakdown','addrShooterNote',null);
}

async function searchAddr(){
  const addrInputEl=document.getElementById('addrInput');
  if(!addrInputEl) return;
  const addr=addrInputEl.value.trim();
  if(!addr)return;
  const statusEl=document.getElementById('addrStatus');
  if(statusEl) statusEl.innerHTML='<div class="status-pill pill-loading"><span class="dot dot-loading"></span>Looking up address…</div>';
  const arc=document.getElementById('addrResultCard');if(arc) arc.style.display='none';
  const aqc=document.getElementById('addrQuoteCard');if(aqc) aqc.style.display='none';
  const mp=document.getElementById('mapPreview');if(mp) mp.style.display='none';
  try{
    const geo2=await geocodeAddress(addr);
    propLat=geo2.lat; propLng=geo2.lng; propAddrText=addr;
    const city=geo2.name;
    const vidDrive=contractorDrive('brad');
    const bradDist=vidDrive.km;
    const akbarDist=contractorDrive('akbar').km;
    if(statusEl) statusEl.innerHTML=`<div class="status-pill pill-free"><span class="dot dot-free"></span>${city} — coordinates found</div>`;
    const am=document.getElementById('addrMetrics');
    if(am) am.innerHTML=`
      <div class="metric"><div class="mlabel">Brad (Welland)</div><div class="mval">${bradDist} km</div><div class="msub">${vidDrive.isFree?'free zone':vidDrive.excessKm+' km excess'}</div></div>
      <div class="metric"><div class="mlabel">Akbar (Toronto)</div><div class="mval">${akbarDist} km</div><div class="msub">${contractorDrive('akbar').isFree?'free zone':contractorDrive('akbar').excessKm+' km excess'}</div></div>
      <div class="metric"><div class="mlabel">Steve (Niagara Falls)</div><div class="mval">${contractorDrive('steve').km} km</div><div class="msub">${contractorDrive('steve').isFree?'free zone':contractorDrive('steve').excessKm+' km excess'}</div></div>`;
    const an=document.getElementById('addrNote');if(an) an.textContent='Select a contractor in Quote Builder to price from their home. Drive charges apply beyond their 40 km free zone.';
    if(aqc) aqc.style.display='block';
    updateTwilightUI(asvc,'a');
    calcAddr();
  }catch(e){
    if(statusEl) statusEl.innerHTML='<div class="status-pill pill-error"><span class="dot dot-error"></span>Could not look up address — try a full address with city and province</div>';
  }
}

function renderTierTable(){
  const el=document.getElementById('tierTable');
  if(!el) return; // Tier reference pane removed
  const cols=[
    {name:'Niagara area',lat:43.05,lng:-79.25},
    {name:'Hamilton',lat:43.255,lng:-79.869},
    {name:'Burlington',lat:43.386,lng:-79.837},
    {name:'Oakville (E)',lat:43.447,lng:-79.668},
    {name:'Toronto (DT)',lat:43.653,lng:-79.383},
  ];
  const tiers=[{label:'Under 1,500',sqft:1250},{label:'1,500–2,000',sqft:1750},{label:'2,000–2,500',sqft:2250},{label:'2,500–3,500',sqft:3000},{label:'3,500–5,000',sqft:4250},{label:'5,000+',sqft:5500}];
  const sqftEl=document.getElementById('sqft');
  const sqft=sqftEl?parseInt(sqftEl.value):2500;
  const bradHome=CONTRACTORS.brad;
  let html='<tr><th>Sqft</th>';
  cols.forEach(c=>{html+=`<th colspan="2">${c.name}</th>`;});
  html+='</tr><tr><th></th>';
  cols.forEach(()=>{html+='<th>Video</th><th>Photo+Video</th>';});
  html+='</tr>';
  tiers.forEach(tier=>{
    const active=sqft>=(tier.sqft-375)&&sqft<(tier.sqft+375);
    html+=`<tr class="${active?'highlight-row':''}"><td>${tier.label}</td>`;
    cols.forEach(c=>{
      const straight=haversineKm(bradHome.lat,bradHome.lng,c.lat,c.lng);
      const km=Math.round(straight*1.3);
      const excess=Math.max(0,km-FREE_RADIUS_KM);
      const clientDrive=excess*2*DRIVE_RATE;
      const vb=baseVideoRate(tier.sqft);
      const vp=Math.ceil((vb+clientDrive)/(1-MARGIN)*(1+ADMIN_RATE));
      const pb=photoBase(tier.sqft,false);
      const pBundle=photoBase(tier.sqft,true)+(excess*2*DRIVE_RATE); // photo is flat client price
      const bundle=vp+pBundle;
      html+=`<td>${fmt(vp)}</td><td>${fmt(bundle)}</td>`;
    });
    html+='</tr>';
  });
  el.innerHTML=html;
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENT PORTAL SYSTEM
// ═══════════════════════════════════════════════════════════════════════════

// Portal accounts stored in localStorage: [{clientId, email, passHash, createdAt}]
async function createClientPortalFromDetail(clientId){
  const pass=document.getElementById('cp-new-pass-inline')?.value.trim();
  if(!pass){alert('Please set a password first.');return;}
  const c=clients.find(cl=>cl.id===clientId);
  if(!c) return;
  const accounts=getPortalAccounts();
  if(accounts.find(a=>a.clientId===clientId)){alert('Portal account already exists for this client.');return;}
  const _cpEmail=(c.email||clientId).toLowerCase();
  accounts.push({clientId,email:_cpEmail,passHash:await hashPass(_cpEmail,pass),createdAt:new Date().toISOString().slice(0,10)});
  savePortalAccounts(accounts);
  sendClientPortalInvite(clientId, pass);
  renderClientPortal(clientId,'portal');
}

function sendClientPortalInvite(clientId, pass){
  const c=clients.find(cl=>cl.id===clientId);
  if(!c||!c.email) return;
  const biz=bizSettings||{};
  const bname=biz.name||'DroneHub Media';
  // Generate/reuse invite code so they get the proper sign-up link
  const accounts=getPortalAccounts();
  let acct=accounts.find(a=>a.clientId===clientId);
  let code;
  if(acct?.inviteCode){ code=acct.inviteCode; }
  else {
    code=cpGenerateInviteCode();
    if(acct){ acct.inviteCode=code; }
    else { accounts.push({clientId,email:c.email,inviteCode:code,createdAt:new Date().toISOString().slice(0,10),status:'invited'}); }
    savePortalAccounts(accounts);
  }
  const base=window.location.origin+window.location.pathname;
  const link=`${base}?portal=client&invite=${code}&cid=${clientId}`;
  if(typeof emailjs==='undefined'){ console.warn('EmailJS not loaded'); return; }
  emailjs.send('service_f0gwd3p','template_5demfu7',{
    to_email: c.email,
    to_name:  c.name.split(' ')[0],
    invite_link: link,
    company_name: bname,
  },'Ch7hmj99uF1tLKhMj').then(()=>{
    console.log('Client portal invite sent to',c.email);
  }).catch(err=>console.error('Invite email error:',err));
}

function revokeClientPortal(clientId){
  if(!confirm('Revoke portal access for this client? They will no longer be able to log in.')) return;
  savePortalAccounts(getPortalAccounts().filter(a=>a.clientId!==clientId));
}

function getPortalAccounts(){return JSON.parse(localStorage.getItem('dronehub_portal_accounts')||'[]');}


function savePortalAccounts(accounts){
  try{localStorage.setItem('dronehub_portal_accounts',JSON.stringify(accounts));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':portal_accounts',{data:JSON.stringify(accounts),updatedAt:Date.now()})
      .catch(e=>{
        console.error('[savePortalAccounts] Firebase write failed:',e.message);
        showDhToast('Portal accounts not saved','Client portal login accounts could not be saved to the cloud.','⚠️','var(--orange)',7000);
      });
  }
}

