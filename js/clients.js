// ─── CLIENT MANAGEMENT ───────────────────────────────────────────────────────
let clients=JSON.parse(localStorage.getItem('dronehub_clients')||'[]');
let selectedClientId=null;

function toggleAddClientPanel(){
  const panel=document.getElementById('add-client-panel');
  const btn=document.getElementById('btn-add-client-panel');
  const open=panel.style.display==='none';
  panel.style.display=open?'block':'none';
  btn.textContent=open?'✕ Cancel':'+ Add client';
  btn.style.background=open?'rgba(240,82,82,.1)':'rgba(91,141,239,.12)';
  btn.style.borderColor=open?'var(--red)':'var(--blue)';
  btn.style.color=open?'var(--red)':'var(--blue-bright)';
  if(open){
    ['acp-name','acp-company','acp-email','acp-phone','acp-website','acp-account',
     'acp-address','acp-address2','acp-city','acp-state','acp-zip'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
    ['acp-country','acp-currency'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
    document.getElementById('acp-error').textContent='';
    document.getElementById('acp-name').focus();
    cancelClientImport();
  }
}

// Auto-select currency when country changes
function acpSyncCurrency(){
  const country=(document.getElementById('acp-country')?.value||'').toLowerCase();
  const currEl=document.getElementById('acp-currency');
  if(!currEl) return;
  if(country.includes('united states')||country==='us'||country==='usa') currEl.value='usd';
  else if(country.includes('canada')||country==='ca') currEl.value='cad';
}

function saveClientFromPanel(){
  const name=document.getElementById('acp-name').value.trim();
  const err=document.getElementById('acp-error');
  if(!name){err.textContent='Name is required.';return;}
  const v=id=>document.getElementById(id)?.value.trim()||'';
  const client={
    id:'c'+Date.now(),
    name,
    company:v('acp-company'),
    email:v('acp-email'),
    phone:v('acp-phone'),
    website:v('acp-website'),
    accountNumber:v('acp-account'),
    address:v('acp-address'),
    address2:v('acp-address2'),
    city:v('acp-city'),
    state:v('acp-state'),
    zip:v('acp-zip'),
    country:v('acp-country'),
    currency:v('acp-currency'),
    createdAt:new Date().toISOString().slice(0,10),
    status:'active',
  };
  clients.push(client);
  saveClientsToStorage();
  syncClientToSalesCRM(client);
  renderClients();
  toggleAddClientPanel();
}

// ─── CLIENT BULK IMPORT ───────────────────────────────────────────────────────
let clientImportRows=[], clientImportHeaders=[];

function handleClientImportFile(files){
  const file=files[0]; if(!file) return;
  // Apple Numbers files cannot be read directly — must be exported first
  if(/\.numbers$/i.test(file.name)){
    alert('Apple Numbers files can\'t be imported directly.\n\nIn Numbers, go to:\nFile → Export To → Excel (.xlsx)\n\nThen upload the exported .xlsx file here.');
    const inp=document.getElementById('client-import-input'); if(inp) inp.value='';
    return;
  }
  const filenameEl=document.getElementById('client-import-filename');
  if(filenameEl) filenameEl.textContent=`${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  const isExcel=/\.xlsx?$/i.test(file.name)||
    file.type==='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'||
    file.type==='application/vnd.ms-excel';
  const reader=new FileReader();
  reader.onload=e=>{
    const buf=e.target.result;
    // If Excel but XLSX library not loaded yet, wait up to 5 s then retry
    if(isExcel && typeof XLSX==='undefined'){
      let waited=0;
      const poll=setInterval(()=>{
        waited+=200;
        if(typeof XLSX!=='undefined'){
          clearInterval(poll);
          _parseClientImportBuf(buf, true);
        } else if(waited>=5000){
          clearInterval(poll);
          alert('Could not load the Excel parser. Please refresh the page and try again.');
        }
      },200);
      return;
    }
    _parseClientImportBuf(buf, isExcel);
  };
  reader.onerror=()=>alert('Could not read the file. Please try again.');
  reader.readAsArrayBuffer(file);
}
function _parseClientImportBuf(buf, isExcel){
  try{
    let csvText;
    if(isExcel){
      const wb=XLSX.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      csvText=XLSX.utils.sheet_to_csv(ws);
    } else {
      // Detect encoding from BOM — Numbers exports UTF-16 LE by default
      const bytes=new Uint8Array(buf);
      let encoding='utf-8', start=0;
      if(bytes[0]===0xFF&&bytes[1]===0xFE){encoding='utf-16le';start=2;}
      else if(bytes[0]===0xFE&&bytes[1]===0xFF){encoding='utf-16be';start=2;}
      else if(bytes[0]===0xEF&&bytes[1]===0xBB&&bytes[2]===0xBF){start=3;}
      csvText=new TextDecoder(encoding).decode(buf.slice(start));
    }
    const parsed=parseCSV(csvText);
    clientImportHeaders=parsed.headers; clientImportRows=parsed.rows;
    showClientImportMapper();
  }catch(err){alert('Could not read file: '+err.message);}
}

function guessClientCol(headers, type){
  const h=headers.map(x=>x.toLowerCase().trim());
  const patterns={
    name:    ['customer name','full name','client name','contact name','name','first name'],
    lastName:['last name','surname','family name'],
    email:   ['email','e-mail','email address'],
    phone:   ['phone number','phone','mobile','cell','tel','telephone'],
    company: ['company','brokerage','business','firm','organization','org','team'],
    address: ['address 1','address1','street address','street','address','location','addr'],
    address2:['address 2','address2','suite','unit','apt'],
    city:    ['city','town'],
    state:   ['state','province','state/province','region'],
    zip:     ['zip code','zip','postal code','postal','postcode'],
    country: ['country'],
    currency:['currency'],
    website: ['website','web','url','site'],
    accountNumber:['account number','account #','account no','acct'],
  };
  for(const p of patterns[type]||[]){
    const idx=h.findIndex(x=>x===p||x.includes(p));
    if(idx>=0) return idx;
  }
  return -1;
}

function showClientImportMapper(){
  document.getElementById('client-import-mapper').style.display='block';
  const fields=[
    {id:'cic-name',     label:'Name *',          type:'name'},
    {id:'cic-company',  label:'Company',          type:'company'},
    {id:'cic-email',    label:'Email',            type:'email'},
    {id:'cic-phone',    label:'Phone',            type:'phone'},
    {id:'cic-address',  label:'Address 1',        type:'address'},
    {id:'cic-address2', label:'Address 2',        type:'address2'},
    {id:'cic-city',     label:'City',             type:'city'},
    {id:'cic-state',    label:'State / Province', type:'state'},
    {id:'cic-zip',      label:'Zip / Postal',     type:'zip'},
    {id:'cic-country',  label:'Country',          type:'country'},
    {id:'cic-currency', label:'Currency',         type:'currency'},
    {id:'cic-website',  label:'Website',          type:'website'},
    {id:'cic-account',  label:'Account #',        type:'accountNumber'},
  ];
  document.getElementById('client-import-col-map').innerHTML=fields.map(f=>`
    <div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:3px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">${f.label}</div>
      <select id="${f.id}" onchange="updateClientImportPreview()" style="width:100%;padding:5px 6px;border:1px solid var(--border-bright);border-radius:7px;font-size:11px;background:var(--navy-lift);color:var(--white)">
        <option value="-1">— skip —</option>
        ${clientImportHeaders.map((h,j)=>`<option value="${j}"${j===guessClientCol(clientImportHeaders,f.type)?' selected':''}>${h||'(col '+(j+1)+')'}</option>`).join('')}
      </select>
    </div>`).join('');
  updateClientImportPreview();
}

function getClientImportMapped(){
  const gi=id=>parseInt(document.getElementById(id)?.value??-1);
  const g=id=>gi(id);
  const ni=g('cic-name'),coi=g('cic-company'),ei=g('cic-email'),pi=g('cic-phone');
  const a1i=g('cic-address'),a2i=g('cic-address2'),cii=g('cic-city'),sti=g('cic-state');
  const zi=g('cic-zip'),ctri=g('cic-country'),curi=g('cic-currency');
  const wi=g('cic-website'),aci=g('cic-account');
  return clientImportRows.map(r=>{
    let rawName=ni>=0?(r[ni]||'').trim():'';
    let company=coi>=0?(r[coi]||'').trim():'';
    // Handle "First Last | Company Name" pattern common in Numbers exports
    if(rawName.includes('|')){
      const parts=rawName.split('|');
      rawName=parts[0].trim();
      if(!company) company=parts[1].trim();
    }
    const currency=(curi>=0?(r[curi]||'').trim():'').toLowerCase();
    const country=ctri>=0?(r[ctri]||'').trim():'';
    // Normalise currency: derive from country if blank
    const resolvedCurrency=currency==='usd'||currency==='cad'?currency:
      (country.toLowerCase().includes('united states')||country.toLowerCase()==='us'?'usd':'');
    return {
      name:rawName,
      company,
      email:ei>=0?(r[ei]||'').trim():'',
      phone:pi>=0?(r[pi]||'').trim():'',
      address:a1i>=0?(r[a1i]||'').trim():'',
      address2:a2i>=0?(r[a2i]||'').trim():'',
      city:cii>=0?(r[cii]||'').trim():'',
      state:sti>=0?(r[sti]||'').trim():'',
      zip:zi>=0?(r[zi]||'').trim():'',
      country,
      currency:resolvedCurrency,
      website:wi>=0?(r[wi]||'').trim():'',
      accountNumber:aci>=0?(r[aci]||'').trim():'',
    };
  }).filter(r=>r.name);
}

function updateClientImportPreview(){
  const rows=getClientImportMapped();
  const note=document.getElementById('client-import-note');
  note.textContent=`${rows.length} valid rows found (${clientImportRows.length-rows.length} skipped — no name)`;
  const tbl=document.getElementById('client-import-preview');
  if(!rows.length){tbl.innerHTML='<tr><td style="color:var(--muted);font-size:11px;padding:6px">No valid rows — check column mapping.</td></tr>';return;}
  const preview=rows.slice(0,4);
  const cols=['name','company','email','phone','address','city','state','country','currency'];
  const colLabels=['Name','Company','Email','Phone','Address','City','State','Country','Currency'];
  tbl.innerHTML=`<thead><tr style="border-bottom:1px solid var(--border)">
    ${colLabels.map(h=>`<th style="text-align:left;padding:3px 8px;font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:600;white-space:nowrap">${h}</th>`).join('')}
  </tr></thead><tbody>${preview.map(r=>`<tr style="border-bottom:0.5px solid var(--border)">
    ${cols.map(k=>`<td style="padding:4px 8px;font-size:11px;color:var(--offwhite);max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r[k]||'—'}</td>`).join('')}
  </tr>`).join('')}</tbody>`;
}

function runClientImport(){
  const rows=getClientImportMapped();
  if(!rows.length){alert('No valid rows to import.');return;}
  // Skip duplicates by email or name
  let added=0, skipped=0;
  rows.forEach(r=>{
    const dup=clients.some(c=>
      (r.email&&c.email&&c.email.toLowerCase()===r.email.toLowerCase())||
      c.name.toLowerCase()===r.name.toLowerCase()
    );
    if(dup){skipped++;return;}
    const newImported={id:'c'+Date.now()+Math.random(),createdAt:new Date().toISOString().slice(0,10),status:'active',...r};
    clients.push(newImported);
    added++;
  });
  saveClientsToStorage();
  document.getElementById('client-import-status').textContent=`✓ ${added} imported${skipped?' ('+skipped+' duplicates skipped)':''}`;
  setTimeout(()=>{cancelClientImport();renderClients();},1800);
}

function cancelClientImport(){
  document.getElementById('client-import-mapper').style.display='none';
  document.getElementById('client-import-input').value='';
  document.getElementById('client-import-status').textContent='';
  document.getElementById('client-import-filename').textContent='';
  clientImportRows=[]; clientImportHeaders=[];
}



function saveNewClient(){
  const name=document.getElementById('new-client-name').value.trim();
  if(!name){alert('Please enter a client name.');return;}
  const client={
    id:'c'+Date.now(),
    name,
    email:document.getElementById('new-client-email').value.trim(),
    phone:document.getElementById('new-client-phone').value.trim(),
    company:document.getElementById('new-client-company').value.trim(),
    createdAt:new Date().toISOString().slice(0,10),
    status:'active',
  };
  clients.push(client);
  saveClientsToStorage();
  syncClientToSalesCRM(client);
  selectClient(client.id);
  document.getElementById('client-new-form').style.display='none';
  document.getElementById('client-search-input').value=client.name;
  document.getElementById('client-suggestions').innerHTML='';
  renderClients();
}

// Resolve a client's billing currency:
// 1. client.currency if explicitly set
// 2. Infer from client.country (US → usd, otherwise cad)
// 3. Default cad
function getClientCurrency(clientOrId){
  const c=typeof clientOrId==='string'?clients.find(cl=>cl.id===clientOrId):clientOrId;
  if(!c) return 'cad';
  if(c.currency) return c.currency.toLowerCase();
  const co=(c.country||'').toLowerCase();
  if(co.includes('united states')||co==='us'||co==='usa') return 'usd';
  return 'cad';
}

function selectClient(id){
  const c=clients.find(cl=>cl.id===id);
  if(!c) return;
  selectedClientId=id;
  document.getElementById('client-search-input').value=c.name;
  document.getElementById('client-suggestions').innerHTML='';
  document.getElementById('client-new-form').style.display='none';
  const disp=document.getElementById('client-selected-display');
  disp.style.display='block';
  document.getElementById('client-selected-name').textContent=c.name+(c.company?' — '+c.company:'');
  const jobCount=savedJobs.filter(j=>j.clientId===id&&j.status==='completed').length;
  const rev=savedJobs.filter(j=>j.clientId===id&&j.status==='completed').reduce((s,j)=>s+j.grand,0);
  const cur=getClientCurrency(c).toUpperCase();
  document.getElementById('client-selected-meta').textContent=
    (c.email||'')+(c.phone?' · '+c.phone:'')+(c.country?' · '+c.country:'')
    +' · '+cur+(jobCount?' · '+jobCount+' completed job'+(jobCount>1?'s':'')+' · '+fmt(rev)+' revenue':'');
  // Auto-set job currency to match client's billing currency
  const currInput=document.getElementById('job-currency-input');
  if(currInput) currInput.value=getClientCurrency(c);
}

function clearClientSelection(){
  selectedClientId=null;
  document.getElementById('client-search-input').value='';
  document.getElementById('client-suggestions').innerHTML='';
  document.getElementById('client-selected-display').style.display='none';
  document.getElementById('client-new-form').style.display='none';
}

function onClientSearch(){
  const q=document.getElementById('client-search-input').value.trim().toLowerCase();
  const sugBox=document.getElementById('client-suggestions');
  const newForm=document.getElementById('client-new-form');
  document.getElementById('client-selected-display').style.display='none';
  selectedClientId=null;

  if(!q){sugBox.innerHTML='';newForm.style.display='none';return;}

  const matches=clients.filter(c=>
    c.name.toLowerCase().includes(q)||
    (c.email&&c.email.toLowerCase().includes(q))||
    (c.company&&c.company.toLowerCase().includes(q))
  ).slice(0,6);

  let html=matches.map(c=>`
    <div class="client-suggestion" onclick="selectClient('${c.id}')">
      <strong>${c.name}</strong>${c.company?' <span style="color:#7A8AAA">'+c.company+'</span>':''}
      ${c.email?'<span style="color:#7A8AAA;font-size:11px;display:block">'+c.email+'</span>':''}
    </div>`).join('');

  // Add "New client" option if no exact match
  const exactMatch=clients.some(c=>c.name.toLowerCase()===q);
  if(!exactMatch){
    html+=`<div class="client-suggestion" style="color:#22D97A;border-top:0.5px solid #e0ddd5;margin-top:4px;padding-top:8px" onclick="showNewClientForm()">
      + Add "<strong>${document.getElementById('client-search-input').value.trim()}</strong>" as new client
    </div>`;
  }

  sugBox.style.background='#1C2333';
  sugBox.style.border=matches.length||!exactMatch?'0.5px solid #e0ddd5':'none';
  sugBox.style.borderRadius='8px';
  sugBox.style.padding=matches.length||!exactMatch?'4px':'0';
  sugBox.innerHTML=html;
  newForm.style.display='none';
}

function showNewClientForm(){
  const q=document.getElementById('client-search-input').value.trim();
  document.getElementById('new-client-name').value=q;
  document.getElementById('new-client-email').value='';
  document.getElementById('new-client-phone').value='';
  document.getElementById('new-client-company').value='';
  document.getElementById('client-new-form').style.display='block';
  document.getElementById('client-suggestions').innerHTML='';
  document.getElementById('new-client-email').focus();
}

function deleteClient(id){
  if(!confirm('Delete this client? Their job history will not be deleted, just unlinked.')) return;
  // Also remove the matching CRM contact so both sides stay in sync
  const deleted=clients.find(c=>c.id===id);
  if(deleted){
    const allSales=salesLoad();
    let idx=allSales.findIndex(sc=>sc._clientId===id);
    if(idx<0&&deleted.email) idx=allSales.findIndex(sc=>sc.list==='clients'&&sc.email&&sc.email.toLowerCase()===deleted.email.toLowerCase());
    if(idx>=0){ allSales.splice(idx,1); salesSave(allSales); }
  }
  clients=clients.filter(c=>c.id!==id);
  saveClientsToStorage();
  // Delete the individual sub-collection doc for this client
  if(_fbToken()) fbSubDelete('clients',id).catch(e=>console.error('[deleteClient] sub-delete failed:',e.message));
  renderClients();
  if(typeof renderSalesTable==='function') renderSalesTable();
  closeClientDetail();
}

function clearAllClients(){
  if(!confirm('Delete all clients? Job history will remain but clients will be unlinked.')) return;
  window._intentionalClearClients = true;
  clients=[];saveClientsToStorage();renderClients();
}

let _clientFilter='all';
let _clientCountry='all';
let _clientActiveLetter='A';

function setClientFilter(f){
  _clientFilter=f;
  const pillColors={
    all:     {bg:'rgba(91,141,239,.18)', color:'var(--blue-bright)', border:'var(--blue)'},
    messages:{bg:'rgba(34,217,122,.12)', color:'var(--green)',       border:'rgba(34,217,122,.4)'},
    active:  {bg:'rgba(245,166,35,.12)', color:'var(--amber)',       border:'rgba(245,166,35,.4)'},
    inactive:{bg:'rgba(255,255,255,.06)',color:'var(--muted)',       border:'var(--border)'},
  };
  ['all','messages','active','inactive'].forEach(k=>{
    const el=document.getElementById('cfil-'+k);
    if(!el) return;
    const isActive=k===f;
    const c=isActive?pillColors[k]:{bg:'var(--navy-lift)',color:'var(--muted)',border:'var(--border)'};
    el.style.background=c.bg; el.style.color=c.color; el.style.borderColor=c.border;
  });
  renderClients();
}

function setClientCountry(ctry){
  _clientCountry=ctry;
  ['all','canada','usa'].forEach(k=>{
    const el=document.getElementById('cctr-'+k);
    if(!el) return;
    const on=k===ctry;
    el.style.background=on?'rgba(91,141,239,.18)':'var(--navy-lift)';
    el.style.color=on?'var(--blue-bright)':'var(--muted)';
    el.style.borderColor=on?'var(--blue)':'var(--border)';
  });
  renderClients();
}

function _getClientCountryKey(c){
  const co=(c.country||'').toLowerCase().trim();
  const cu=(c.currency||'').toLowerCase().trim();
  if(co.includes('canada')||co==='ca'||co==='can'||cu==='cad'||
     /ontario|british columbia|alberta|quebec|saskatchewan|manitoba|nova scotia|new brunswick|newfoundland|prince edward/.test(co)) return 'canada';
  if(co.includes('united states')||co==='us'||co==='usa'||co.includes('america')||cu==='usd') return 'usa';
  if(!co&&!cu) return 'unknown';
  return 'other';
}

function toggleClientStatus(clientId){
  const idx=clients.findIndex(c=>c.id===clientId);
  if(idx<0) return;
  clients[idx].status=clients[idx].status==='inactive'?'active':'inactive';
  saveClientsToStorage();
  // Sync status change to CRM if linked
  const c=clients[idx];
  if(c._salesId){
    const all=salesLoad();
    const sc=all.find(x=>x.id===c._salesId);
    if(sc){ sc.clientType=c.status==='inactive'?'past':'active'; sc._clientTypeManual=true; salesSave(all); }
  }
  renderClients();
}
// True if a client has at least one job whose most recent date
// (completedAt||createdAt||date) falls within the past 6 months.
function _clientRecent6mo(c){
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
  return (savedJobs||[]).some(j=>{
    if(String(j.clientId)!==String(c.id)) return false;
    const d = new Date(j.completedAt||j.createdAt||j.date||0);
    return d >= sixMonthsAgo;
  });
}

// Top-right stat boxes on the Clients view — clickable filters:
//   Total Clients  -> shows every client (clears recency + country filters)
//   Last 6 Months  -> clients who worked with us in the last 6 months
//   Canada Clients -> clients in Canada    USA Clients -> clients in the US
// Recency lives in _clientFilter; country lives in the separate _clientCountry
// dimension, so they combine (e.g. Canada + Last 6 Months).
function renderClientsStatBar(){
  const bar = document.getElementById('sales-clients-stats-bar');
  if(!bar) return;
  const totalClients = clients.length;
  const recentCount  = clients.filter(_clientRecent6mo).length;
  const caCount  = clients.filter(c=>_getClientCountryKey(c)==='canada').length;
  const usCount  = clients.filter(c=>_getClientCountryKey(c)==='usa').length;
  const box = (num, label, color, on, onclick, accentBg, accentBorder) => {
    const style = on
      ? `background:${accentBg};border:2px solid ${accentBorder};border-radius:9px;padding:4px 11px;font-size:11px;color:${color};cursor:pointer;user-select:none`
      : `background:var(--navy-card);border:1px solid var(--border);border-radius:9px;padding:5px 12px;font-size:11px;color:var(--muted);cursor:pointer;user-select:none`;
    return `<div onclick="${onclick}" title="Click to filter" style="${style}"><span style="font-size:13px;font-weight:700;color:${color};display:block">${num}</span>${label}</div>`;
  };
  const allOn = _clientFilter==='all' && _clientCountry==='all';
  bar.innerHTML =
    box(totalClients, 'Total Clients',  'var(--white)',       allOn,                       'clientsShowAll()',             'rgba(255,255,255,.08)', 'var(--white)') +
    box(recentCount,  'Last 6 Months',  'var(--green)',       _clientFilter==='recent6mo', "setClientFilter('recent6mo')", 'rgba(34,217,122,.12)', 'rgba(34,217,122,.5)') +
    box(caCount,      'Canada Clients', 'var(--blue-bright)', _clientCountry==='canada',   "setClientCountry('canada')",   'rgba(91,141,239,.15)', 'var(--blue)') +
    box(usCount,      'USA Clients',    'var(--blue-bright)', _clientCountry==='usa',       "setClientCountry('usa')",      'rgba(91,141,239,.15)', 'var(--blue)');
}

// Resets the Clients view to show every client (clears recency + country filters).
function clientsShowAll(){
  _clientCountry = 'all';
  ['all','canada','usa'].forEach(k=>{
    const el=document.getElementById('cctr-'+k);
    if(el){ const on=k==='all'; el.style.background=on?'rgba(91,141,239,.18)':'var(--navy-lift)'; el.style.color=on?'var(--blue-bright)':'var(--muted)'; el.style.borderColor=on?'var(--blue)':'var(--border)'; }
  });
  setClientFilter('all'); // re-renders
}

function renderClients(){
  // Bootstrap: if Clients tab has no data but CRM Existing Clients does, auto-populate once
  if(!clients.length){
    const crmClients = salesLoad().filter(c=>c.list==='clients'&&!c._deleted);
    if(crmClients.length){
      syncCRMClientsToTab(crmClients);
      // clients[] is now populated — fall through to render
    } else {
      // CRM data not loaded yet — wait for salesSyncFirebase then retry
      if(typeof salesSyncFirebase === 'function'){
        salesSyncFirebase().then(()=>{
          if(!clients.length){
            const deferred = salesLoad().filter(c=>c.list==='clients'&&!c._deleted);
            if(deferred.length){ syncCRMClientsToTab(deferred); renderClients(); }
          }
        }).catch(()=>{});
      }
      // Fall through — show empty state for now, re-render will follow
    }
  }
  const q=(document.getElementById('clients-search')?.value||'').trim().toLowerCase();
  const list=document.getElementById('clients-list');
  const empty=document.getElementById('clients-empty');
  const azBar=document.getElementById('clients-az-bar');
  if(!list) return;

  // ── Top-right stat bar (Total Clients / Last 6 months) ──────────────────────
  renderClientsStatBar();

  const _lcUnread=getLcUnread();
  const portalAccts=getPortalAccounts();

  // Build enriched records
  const enriched=clients.map(c=>{
    const cJobs=savedJobs.filter(j=>j.clientId===c.id);
    const hasActiveJob=cJobs.some(j=>j.status==='confirmed'||j.status==='in-progress')||c.status==='active';
    // "Recently active" = real job activity or unread messages (not just imported status)
    const isRecentlyActive=cJobs.some(j=>j.status==='confirmed'||j.status==='in-progress'||j.status==='completed')||(_lcUnread['lc_client_'+c.id]||0)>0;
    const newMsgs=_lcUnread['lc_client_'+c.id]||0;
    let lastMsgTs='';
    if(newMsgs>0){const msgs=getLcMessages('lc_client_'+c.id);if(msgs.length)lastMsgTs=msgs[msgs.length-1].ts||'';}
    const countryKey=_getClientCountryKey(c);
    const isRecent6mo=_clientRecent6mo(c);
    return {c, cJobs, hasActiveJob, isRecentlyActive, isRecent6mo, newMsgs, lastMsgTs, countryKey};
  });

  // Country filter base
  const countryFiltered=enriched.filter(r=>_clientCountry==='all'||r.countryKey===_clientCountry);

  // Apply filter pill
  const applyPill=(arr)=>arr.filter(({hasActiveJob,newMsgs,isRecent6mo})=>{
    if(_clientFilter==='messages')  return newMsgs>0;
    if(_clientFilter==='active')    return hasActiveJob;
    if(_clientFilter==='inactive')  return !hasActiveJob;
    if(_clientFilter==='recent6mo') return isRecent6mo;
    return true;
  });

  const _llbl=document.getElementById('clients-letter-label');

  // ── Search mode: flat results, no sections ──────────────────────────────────
  if(q){
    if(azBar) azBar.style.display='none';
    if(_llbl) _llbl.innerHTML='';
    const results=applyPill(enriched).filter(({c})=>
      c.name.toLowerCase().includes(q)||(c.email&&c.email.toLowerCase().includes(q))||(c.company&&c.company.toLowerCase().includes(q))
    ).sort((a,b)=>a.c.name.localeCompare(b.c.name));
    empty.style.display=results.length?'none':'block';
    list.style.display=results.length?'block':'none';
    list.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">${results.map(r=>_clientCardHtml(r,portalAccts)).join('')}</div>`;
    return;
  }

  // ── Filter-pill modes (Last 6 Months / country): flat list ─────────────────
  if(_clientFilter!=='all'||_clientCountry!=='all'){
    if(_llbl) _llbl.innerHTML='';
    const results=applyPill(countryFiltered).sort((a,b)=>{
      if(_clientFilter==='messages'){if(b.newMsgs!==a.newMsgs)return b.newMsgs-a.newMsgs;return b.lastMsgTs.localeCompare(a.lastMsgTs);}
      return a.c.name.localeCompare(b.c.name);
    });
    if(azBar) azBar.style.display='none';
    empty.style.display=results.length?'none':'block';
    list.style.display=results.length?'block':'none';
    list.innerHTML=`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">${results.map(r=>_clientCardHtml(r,portalAccts)).join('')}</div>`;
    return;
  }

  // ── Default "All" mode: one letter at a time + bottom A-Z nav ───────────────
  const letters='ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const letterCounts={};
  countryFiltered.forEach(r=>{
    const ch=r.c.name.charAt(0).toUpperCase();
    const key=/[A-Z]/.test(ch)?ch:'#';
    letterCounts[key]=(letterCounts[key]||0)+1;
  });
  if(!letterCounts[_clientActiveLetter]&&Object.keys(letterCounts).length){
    _clientActiveLetter=letters.find(l=>letterCounts[l])||'#';
  }
  const cur=_clientActiveLetter;
  const visible=countryFiltered
    .filter(r=>{const ch=r.c.name.charAt(0).toUpperCase(); return cur==='#'?!/[A-Z]/.test(ch):ch===cur;})
    .sort((a,b)=>a.c.name.localeCompare(b.c.name));
  empty.style.display=visible.length?'none':'block';
  list.style.display=visible.length?'block':'none';
  if(_llbl) _llbl.innerHTML=`<span style="font-weight:800;color:var(--blue-bright)">${cur}</span> <span style="color:var(--muted)">Clients — ${visible.length}</span>`;
  const azHtml=letters.concat(['#']).map(l=>{
    const cnt=letterCounts[l]||0;
    const on=l===cur;
    return `<button onclick="_clientActiveLetter='${l}';renderClients()"
      style="min-width:30px;height:30px;padding:0 4px;border-radius:8px;font-size:12px;font-weight:700;
             cursor:${cnt?'pointer':'default'};border:1px solid ${on?'var(--blue)':cnt?'rgba(91,141,239,.25)':'transparent'};
             background:${on?'rgba(91,141,239,.25)':cnt?'rgba(91,141,239,.06)':'transparent'};
             color:${on?'var(--white)':cnt?'var(--blue-bright)':'var(--muted)'};line-height:30px;transition:all .1s"
      title="${cnt?cnt+' clients':''}" ${!cnt?'disabled':''}>${l}</button>`;
  }).join('');
  list.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">${visible.map(r=>_clientCardHtml(r,portalAccts)).join('')}</div>
    <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-top:24px;padding-top:16px;border-top:1px solid var(--border)">${azHtml}</div>`;
}

function _clientTierHtml(group, label, bg, color, portalAccts){
  return `<div style="margin-bottom:14px">
    <div style="display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;background:${bg};color:${color};margin-bottom:8px">
      ${label} <span style="opacity:.6">(${group.length})</span>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px">${group.map(r=>_clientCardHtml(r,portalAccts)).join('')}</div>
  </div>`;
}

function _clientCardHtml({c, cJobs, hasActiveJob, newMsgs}, portalAccts){
  const completed=cJobs.filter(j=>j.status==='completed');
  const revenue=completed.reduce((s,j)=>s+j.grand,0);
  const lastJob=[...cJobs].sort((a,b)=>b.date.localeCompare(a.date))[0];
  const hasPortal=portalAccts.find(a=>a.clientId===c.id);
  const activeTrackerJobs=cJobs.filter(j=>{
    const ts=getTrackerStage(j.id);
    return ts.editStatus&&ts.editStatus!=='finals_sent'&&(j.status==='confirmed'||j.status==='completed');
  });
  return `<div class="client-card" onclick="openClientDetail('${c.id}')" style="${newMsgs>0?'border-color:rgba(34,217,122,.35);':''}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px">
      <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;min-width:0">
        <div class="client-card-name" style="min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.name}</div>
        ${hasActiveJob?`<span style="display:inline-flex;align-items:center;font-size:9px;font-weight:700;color:var(--green);background:rgba(34,217,122,.1);border:1px solid rgba(34,217,122,.3);border-radius:8px;padding:1px 5px;flex-shrink:0">● Active</span>`:``}
      </div>
      <div style="display:flex;align-items:center;gap:5px;flex-shrink:0;margin-left:6px">
        ${newMsgs>0?`<span style="display:inline-flex;align-items:center;gap:3px;font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;background:rgba(34,217,122,.15);color:var(--green);border:1px solid rgba(34,217,122,.3)"><svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>${newMsgs}</span>`:''}
        <span style="font-size:10px;padding:2px 7px;border-radius:10px;font-weight:700;background:${hasPortal?'var(--green-bg)':'rgba(255,255,255,.05)'};color:${hasPortal?'var(--green)':'var(--muted)'}">
          ${hasPortal?'✓ Portal':'No portal'}
        </span>
      </div>
    </div>
    <div class="client-card-meta">${[c.company,c.city,c.email,c.phone].filter(Boolean).join(' · ')||'No contact info'}</div>
    <div>
      <span class="client-stat"><span class="client-stat-val">${cJobs.length}</span><span class="client-stat-lbl">Jobs</span></span>
      <span class="client-stat"><span class="client-stat-val">${completed.length}</span><span class="client-stat-lbl">Completed</span></span>
      <span class="client-stat"><span class="client-stat-val">${revenue>0?fmt(revenue):'—'}</span><span class="client-stat-lbl">Billed</span></span>
      ${activeTrackerJobs.length?`<span class="client-stat"><span class="client-stat-val" style="color:var(--amber)">${activeTrackerJobs.length}</span><span class="client-stat-lbl">In production</span></span>`:''}
    </div>
    ${lastJob?`<div style="font-size:10px;color:#7A8AAA;margin-top:6px">Last job: ${lastJob.date} — ${lastJob.name}</div>`:''}
  </div>`;
}

// ── CLIENT LEADERBOARD ────────────────────────────────────────────────────────
function switchClientsSubtab(tab){
  const isLeaderboard = tab === 'leaderboard';
  document.getElementById('clients-list-panel').style.display = isLeaderboard ? 'none' : 'block';
  document.getElementById('clients-leaderboard-panel').style.display = isLeaderboard ? 'block' : 'none';
  document.getElementById('clients-subtab-list').style.background = isLeaderboard ? 'transparent' : 'rgba(255,255,255,.08)';
  document.getElementById('clients-subtab-list').style.color = isLeaderboard ? 'var(--muted)' : 'var(--white)';
  document.getElementById('clients-subtab-leaderboard').style.background = isLeaderboard ? 'rgba(255,255,255,.08)' : 'transparent';
  document.getElementById('clients-subtab-leaderboard').style.color = isLeaderboard ? 'var(--white)' : 'var(--muted)';
  if(isLeaderboard) renderClientLeaderboard();
}

function getClientLeaderboardData(){
  return clients.map(c=>{
    const cJobs = savedJobs.filter(j=>j.clientId===c.id);
    const invoicedJobs = cJobs.filter(j=>j.status==='confirmed'||j.status==='completed');
    const paidJobs = cJobs.filter(j=>j.markedPaid);

    // 1. Total revenue
    const totalRevenue = invoicedJobs.reduce((s,j)=>s+j.grand,0);

    // 2. Avg shoot time (hours)
    const shootTimes = cJobs.map(j=>parseFloat(j.duration)||0).filter(v=>v>0);
    const avgShootHours = shootTimes.length ? shootTimes.reduce((s,v)=>s+v,0)/shootTimes.length : 0;

    // 3. Avg edit time (hours from tracker)
    const editTimes = cJobs.map(j=>{
      const ts=getTrackerStage(j.id);
      return parseFloat(ts.approxEditHours)||0;
    }).filter(v=>v>0);
    const avgEditHours = editTimes.length ? editTimes.reduce((s,v)=>s+v,0)/editTimes.length : 0;

    // 4. Avg drafts per job
    const draftCounts = cJobs.map(j=>{
      const ts=getTrackerStage(j.id);
      return parseInt(ts.draftCount)||0;
    });
    const avgDrafts = draftCounts.length ? draftCounts.reduce((s,v)=>s+v,0)/draftCounts.length : 0;

    // 5. Avg payment time (days from invoicedAt to paidAt)
    const payTimes = paidJobs.filter(j=>j.invoicedAt&&j.paidAt).map(j=>{
      const sent=new Date(j.invoicedAt), paid=new Date(j.paidAt);
      return Math.max(0,Math.floor((paid-sent)/(1000*60*60*24)));
    });
    const avgPayDays = payTimes.length ? payTimes.reduce((s,v)=>s+v,0)/payTimes.length : null;

    // 6. Social media tags (manual)
    const socialTags = parseInt(c.socialTags)||0;

    // 7. Referrals (manual)
    const referrals = parseInt(c.referrals)||0;

    // 8. Job count
    const totalJobs = cJobs.length;

    // 9. Payment rate
    const paymentRate = invoicedJobs.length ? paidJobs.length/invoicedJobs.length : 0;

    // 10. Video & reel counts (from job.services)
    const totalVideos = cJobs.filter(j=>j.services?.video||j.services?.tvideo||j.services?.extvideo||j.services?.randomvideo).length;
    const totalReels  = cJobs.filter(j=>j.services?.reel).length;

    // ── SCORING (100 pts total) ──
    const allRevenues = clients.map(cl=>savedJobs.filter(j=>j.clientId===cl.id&&(j.status==='confirmed'||j.status==='completed')).reduce((s,j)=>s+j.grand,0));
    const maxRevenue = Math.max(...allRevenues,1);
    const revenueScore = Math.round((totalRevenue/maxRevenue)*25);
    const payScore = avgPayDays===null ? 10 : Math.round(Math.max(0,(60-avgPayDays)/60)*20);
    const draftScore = Math.round(Math.max(0,(5-avgDrafts)/5)*20);
    const allShoot = clients.map(cl=>{ const t=savedJobs.filter(j=>j.clientId===cl.id).map(j=>parseFloat(j.duration)||0).filter(v=>v>0); return t.length?t.reduce((s,v)=>s+v,0)/t.length:0; });
    const maxShoot = Math.max(...allShoot,1);
    const shootScore = avgShootHours>0 ? Math.round((1-avgShootHours/maxShoot)*10) : 5;
    const allEdit = clients.map(cl=>{ const t=savedJobs.filter(j=>j.clientId===cl.id).map(j=>{const ts=getTrackerStage(j.id);return parseFloat(ts.approxEditHours)||0;}).filter(v=>v>0); return t.length?t.reduce((s,v)=>s+v,0)/t.length:0; });
    const maxEdit = Math.max(...allEdit,1);
    const editScore = avgEditHours>0 ? Math.round((1-avgEditHours/maxEdit)*10) : 5;
    const tagScore = Math.min(8,socialTags*2);
    const refScore = Math.min(7,referrals*2);
    const totalScore = revenueScore+payScore+draftScore+shootScore+editScore+tagScore+refScore;

    return {c, totalRevenue, avgShootHours, avgEditHours, avgDrafts, avgPayDays, socialTags, referrals, totalJobs, totalVideos, totalReels, paymentRate, totalScore, revenueScore, payScore, draftScore, shootScore, editScore, tagScore, refScore};
  }).filter(d=>d.totalJobs>0).sort((a,b)=>b.totalScore-a.totalScore);
}

let _lbSort='score';
function renderClientLeaderboard(sortKey){
  if(sortKey) _lbSort=sortKey;
  const body = document.getElementById('clients-leaderboard-body');
  if(!body) return;
  let data = getClientLeaderboardData();

  // Sort by selected metric
  const sortFns={
    score:    (a,b)=>b.totalScore-a.totalScore,
    revenue:  (a,b)=>b.totalRevenue-a.totalRevenue,
    payspeed: (a,b)=>{
      if(a.avgPayDays===null&&b.avgPayDays===null) return 0;
      if(a.avgPayDays===null) return 1;
      if(b.avgPayDays===null) return -1;
      return a.avgPayDays-b.avgPayDays;
    },
    drafts:   (a,b)=>a.avgDrafts-b.avgDrafts,
    shoot:    (a,b)=>a.avgShootHours-b.avgShootHours,
    edit:     (a,b)=>a.avgEditHours-b.avgEditHours,
    tags:     (a,b)=>b.socialTags-a.socialTags,
    referrals:(a,b)=>b.referrals-a.referrals,
    jobs:     (a,b)=>b.totalJobs-a.totalJobs,
    videos:   (a,b)=>b.totalVideos-a.totalVideos,
    reels:    (a,b)=>b.totalReels-a.totalReels,
  };
  data = data.slice().sort(sortFns[_lbSort]||sortFns.score);

  if(!data.length){
    body.innerHTML=`<div style="text-align:center;padding:60px;color:var(--muted)">No clients with jobs yet — leaderboard will populate as you add jobs.</div>`;
    return;
  }

  const tierLabel=(score)=>{
    if(score>=80) return {label:'Platinum',color:'#7AABFF',bg:'rgba(122,171,255,.13)',border:'rgba(122,171,255,.35)'};
    if(score>=60) return {label:'Gold',    color:'#5B8DEF',bg:'rgba(91,141,239,.12)', border:'rgba(91,141,239,.32)'};
    if(score>=40) return {label:'Silver',  color:'#3A6AC8',bg:'rgba(58,106,200,.10)', border:'rgba(58,106,200,.28)'};
    if(score>=20) return {label:'Bronze',  color:'#2A4D8F',bg:'rgba(42,77,143,.10)',  border:'rgba(42,77,143,.28)'};
    return {label:'Standard',color:'var(--muted)',bg:'rgba(255,255,255,.03)',border:'var(--border)'};
  };

  const bar=(score,max,color)=>{
    const pct=max>0?Math.round((score/max)*100):0;
    return `<div style="height:4px;background:rgba(255,255,255,.06);border-radius:2px;overflow:hidden;margin-top:3px"><div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width .4s"></div></div>`;
  };

  const fmt2=n=>n!=null?n.toFixed(1):'—';

  // Podium removed — go straight to ranked list

  // Full ranked list
  const listHtml=data.map((d,i)=>{
    const tier=tierLabel(d.totalScore);
    const rank=i+1;
    return `<div style="display:grid;grid-template-columns:52px 1fr auto;gap:12px;align-items:start;padding:14px 16px;background:var(--navy-card);border:1px solid var(--border);border-radius:12px;margin-bottom:8px;cursor:pointer;transition:opacity .15s" onclick="openClientDetail('${d.c.id}')" onmouseover="this.style.opacity='.85'" onmouseout="this.style.opacity='1'">
      <!-- Rank + name -->
      <div style="display:flex;flex-direction:column;align-items:center;gap:5px;padding-top:2px">
        <div style="width:28px;height:28px;border-radius:50%;background:${rank<=3?['#7AABFF','#5B8DEF','#3A6AC8'][rank-1]:'rgba(255,255,255,.06)'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:${rank<=3?'#0D1117':'var(--offwhite)'};flex-shrink:0">${rank}</div>
        <div style="font-size:10px;font-weight:600;color:var(--muted);text-align:center;line-height:1.2;word-break:break-word;max-width:52px">${d.c.name.split(' ')[0]}</div>
      </div>
      <!-- Details -->
      <div>
        <!-- Metric bars -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;font-size:11px">
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Revenue</div><div style="color:var(--blue-bright);font-weight:700">${d.totalRevenue>0?'$'+d.totalRevenue.toLocaleString('en-CA',{minimumFractionDigits:0}):'—'}</div>${bar(d.revenueScore,25,'var(--blue-bright)')}</div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> Pay speed</div><div style="color:${d.avgPayDays===null?'var(--muted)':d.avgPayDays<=7?'var(--blue-bright)':d.avgPayDays<=30?'var(--blue)':'var(--red)'};font-weight:700">${d.avgPayDays===null?'No data':d.avgPayDays===0?'Same day':d.avgPayDays+' days avg'}</div>${bar(d.payScore,20,'var(--blue)')}</div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Drafts/job</div><div style="color:${d.avgDrafts<=1?'var(--blue-bright)':d.avgDrafts<=3?'var(--blue)':'var(--red)'};font-weight:700">${d.totalJobs?fmt2(d.avgDrafts)+' avg':'—'}</div>${bar(d.draftScore,20,'var(--blue-dim)')}</div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg> Shoot time</div><div style="color:var(--offwhite);font-weight:700">${d.avgShootHours>0?fmt2(d.avgShootHours)+'h avg':'—'}</div>${bar(d.shootScore,10,'var(--blue-bright)')}</div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg> Edit time</div><div style="color:var(--offwhite);font-weight:700">${d.avgEditHours>0?fmt2(d.avgEditHours)+'h avg':'—'}</div>${bar(d.editScore,10,'var(--blue-bright)')}</div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg> Social tags</div><div style="color:var(--offwhite);font-weight:700">${d.socialTags||'0'}</div>${bar(d.tagScore,8,'var(--blue)')}</div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg> Referrals</div><div style="color:var(--offwhite);font-weight:700">${d.referrals||'0'}</div>${bar(d.refScore,7,'var(--blue-dim)')}</div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> Total jobs</div><div style="color:var(--offwhite);font-weight:700">${d.totalJobs}</div></div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Videos</div><div style="color:var(--offwhite);font-weight:700">${d.totalVideos}</div></div>
          <div><div style="color:var(--muted);margin-bottom:1px;display:flex;align-items:center;gap:3px"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10"/><path d="M12 8v4l3 3"/><circle cx="19" cy="5" r="3" fill="currentColor" stroke="none"/></svg> Reels</div><div style="color:var(--offwhite);font-weight:700">${d.totalReels}</div></div>
        </div>
      </div>
      <!-- Score -->
      <div style="text-align:right">
        <div style="font-size:26px;font-weight:900;color:var(--blue-bright)">${d.totalScore}</div>
        <div style="font-size:10px;color:var(--muted)">/ 100 pts</div>
        <button onclick="event.stopPropagation();openLeaderboardEdit('${d.c.id}')" style="margin-top:8px;padding:3px 10px;border-radius:7px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:10px;cursor:pointer;font-weight:600">Edit tags</button>
      </div>
    </div>`;
  }).join('');

  body.innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <div style="font-size:15px;font-weight:700;color:var(--white)">Client Leaderboard</div>
      <div style="font-size:11px;color:var(--muted)">Scored on revenue, payment speed, drafts, efficiency, tags & referrals</div>
    </div>
    <!-- Sort filter bar -->
    <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:20px">
      ${[
        {key:'score',    label:'Overall Score'},
        {key:'revenue',  label:'Revenue'},
        {key:'payspeed', label:'Pay Speed'},
        {key:'drafts',   label:'Fewest Drafts'},
        {key:'shoot',    label:'Shoot Time'},
        {key:'edit',     label:'Edit Time'},
        {key:'tags',     label:'Social Tags'},
        {key:'referrals',label:'Referrals'},
        {key:'jobs',     label:'Most Jobs'},
        {key:'videos',   label:'Most Videos'},
        {key:'reels',    label:'Most Reels'},
      ].map(s=>`<button onclick="renderClientLeaderboard('${s.key}')" style="padding:5px 12px;border-radius:20px;border:1px solid ${_lbSort===s.key?'var(--blue)':'var(--border)'};background:${_lbSort===s.key?'rgba(91,141,239,.18)':'transparent'};color:${_lbSort===s.key?'var(--blue-bright)':'var(--muted)'};font-size:11px;font-weight:${_lbSort===s.key?'700':'500'};cursor:pointer;font-family:var(--font);transition:all .12s">${s.label}</button>`).join('')}
    </div>
    ${listHtml}
    <!-- Edit modal for social tags / referrals -->
    <div id="leaderboard-edit-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:3000;display:none;align-items:center;justify-content:center">
      <div style="background:var(--navy-card);border:1px solid var(--border-bright);border-radius:14px;padding:24px;min-width:300px;max-width:400px">
        <div style="font-size:14px;font-weight:700;color:var(--white);margin-bottom:16px">Update client metrics</div>
        <input type="hidden" id="lb-edit-client-id">
        <div style="margin-bottom:12px">
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Social media tags (total mentions / tags)</label>
          <input type="number" id="lb-social-tags" min="0" placeholder="0" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
        </div>
        <div style="margin-bottom:20px">
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Referrals sent to DroneHub</label>
          <input type="number" id="lb-referrals" min="0" placeholder="0" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
        </div>
        <div style="display:flex;gap:8px">
          <button onclick="saveLeaderboardEdit()" style="flex:1;padding:8px;border-radius:8px;border:none;background:var(--blue);color:#fff;font-size:13px;font-weight:700;cursor:pointer">Save</button>
          <button onclick="document.getElementById('leaderboard-edit-modal').style.display='none'" style="padding:8px 16px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;cursor:pointer">Cancel</button>
        </div>
      </div>
    </div>`;
}

function openLeaderboardEdit(clientId){
  const c=clients.find(cl=>cl.id===clientId);
  if(!c) return;
  document.getElementById('lb-edit-client-id').value=clientId;
  document.getElementById('lb-social-tags').value=c.socialTags||0;
  document.getElementById('lb-referrals').value=c.referrals||0;
  const modal=document.getElementById('leaderboard-edit-modal');
  modal.style.display='flex';
}

function saveLeaderboardEdit(){
  const id=document.getElementById('lb-edit-client-id').value;
  const c=clients.find(cl=>cl.id===id);
  if(!c) return;
  c.socialTags=parseInt(document.getElementById('lb-social-tags').value)||0;
  c.referrals=parseInt(document.getElementById('lb-referrals').value)||0;
  saveClientsToStorage();
  document.getElementById('leaderboard-edit-modal').style.display='none';
  renderClientLeaderboard();
}

function openClientDetail(id){
  const c=clients.find(cl=>cl.id===id);
  if(!c) return;
  currentPortalClientId=id;
  document.getElementById('client-detail-overlay').style.display='block';
  document.body.style.overflow='hidden';
  renderClientPortal(id,'overview');
}

function closeClientDetail(){
  document.getElementById('client-detail-overlay').style.display='none';
  document.body.style.overflow='';
  currentPortalClientId=null;
}

let currentPortalClientId=null;

async function renderClientPortal(id, activeTab){
  const c=clients.find(cl=>cl.id===id);
  if(!c) return;

  // Keep imported Drive-tracker jobs in sync with the linked project list
  if(typeof _cdReconcileImportedJobs==='function'&&(c.driveProjects||[]).length){
    const _rmv=_cdReconcileImportedJobs(c);
    if(_rmv){try{showDhToast('Tracker cleaned up',_rmv+' duplicate imported project'+(_rmv===1?'':'s')+' removed','check','var(--green)',3500);}catch(e){}}
  }

  const cJobs=savedJobs.filter(j=>j.clientId===id).sort((a,b)=>b.date.localeCompare(a.date));
  const completed=cJobs.filter(j=>j.status==='completed');
  const outstanding=cJobs.filter(j=>j.status==='confirmed'||j.status==='quoted');
  const revenue=completed.reduce((s,j)=>s+j.grand,0);
  const hst=parseFloat((revenue*0.13).toFixed(2));
  const outstanding_amt=outstanding.reduce((s,j)=>s+j.grand,0);
  const assets=c.assets||[];
  const fmtN=n=>'$'+Number(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const tabs=['overview','jobs','invoices','financials','production','assets','messages','social','portal'];
  const _clientTabIcons={
    overview:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,
    jobs:       `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>`,
    invoices:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,
    financials: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,
    production: `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,
    assets:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
    messages:   `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,
    portal:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
    social:     `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>`,
  };
  const tabLabels={overview:'Overview',jobs:'Jobs',invoices:'Invoices',financials:'Financials',production:'Production',assets:'Files & Media',messages:'LouChat',social:'Social',portal:'Portal Access'};
  const _clientMsgUnread=getLcUnread()['lc_client_'+id]||0;
  const _clientSocialPending=(()=>{
    const sws=socialWorkspacesLoad();const sp=socialPostsLoad();
    return sp.filter(p=>p.status==='pending'&&(p.clientId===id||(p.workspaceId&&sws.find(w=>w.id===p.workspaceId)?.clientId===id))).length;
  })();

  const tabHtml=tabs.map(t=>`
    <button onclick="renderClientPortal('${id}','${t}')"
      style="display:inline-flex;align-items:center;gap:4px;padding:8px 9px;border-radius:9px;border:none;font-size:11px;font-family:var(--font);font-weight:700;cursor:pointer;transition:all .15s;white-space:nowrap;flex-shrink:0;
        background:${t===activeTab?'linear-gradient(135deg,var(--blue),var(--blue-dim))':'transparent'};
        color:${t===activeTab?'#fff':'var(--muted)'};
        box-shadow:${t===activeTab?'0 2px 12px rgba(91,141,239,.35)':'none'}"
    >${_clientTabIcons[t]||''}${tabLabels[t]}${t==='messages'&&_clientMsgUnread>0?`<span style="background:var(--green);color:#fff;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px">${_clientMsgUnread}</span>`:''}${t==='social'&&_clientSocialPending>0?`<span style="background:var(--yellow,#F5C842);color:#000;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px">${_clientSocialPending}</span>`:''}</button>`).join('');

  let tabContent='';

  if(activeTab==='overview'){
    const lastJob=cJobs[0];
    const invoicedJobs=cJobs.filter(j=>j.invoicedAt);
    const overdueJobs=cJobs.filter(j=>{
      const st=getInvoiceStatus(j);
      return st==='overdue';
    });
    tabContent=`
      
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:20px">
        <div class="metric"><div class="mlabel">Total jobs</div><div class="mval">${cJobs.length}</div></div>
        <div class="metric"><div class="mlabel">Completed</div><div class="mval" style="color:var(--green)">${completed.length}</div></div>
        <div class="metric"><div class="mlabel">Outstanding</div><div class="mval" style="color:var(--amber)">${outstanding.length}</div></div>
        <div class="metric"><div class="mlabel">Revenue billed</div><div class="mval" style="color:var(--green)">${revenue>0?fmtN(revenue):'—'}</div></div>
        <div class="metric"><div class="mlabel">Outstanding amt</div><div class="mval" style="color:var(--amber)">${outstanding_amt>0?fmtN(outstanding_amt):'—'}</div></div>
        ${overdueJobs.length?`<div class="metric" style="border-color:var(--red)"><div class="mlabel" style="color:var(--red)">Overdue</div><div class="mval" style="color:var(--red)">${overdueJobs.length}</div></div>`:''}
      </div>
      
      <div class="card" style="margin-bottom:14px">
        <div class="section-label" style="margin-bottom:10px">Contact information</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          ${[
            ['Email',c.email?`<a href="mailto:${c.email}" style="color:var(--blue-bright)">${c.email}</a>`:'—'],
            ['Phone',c.phone?`<a href="tel:${c.phone}" style="color:var(--blue-bright)">${c.phone}</a>`:'—'],
            ['Company',c.company||'—'],
            ['Address',c.address||'—'],
            ['Client since',c.createdAt||'—'],
            ['Client ID',`<span style="font-size:10px;color:var(--muted);font-family:monospace">${c.id}</span>`],
          ].map(([label,val])=>`<div>
            <div style="font-size:10px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">${label}</div>
            <div style="font-size:13px;color:var(--offwhite)">${val}</div>
          </div>`).join('')}
        </div>
        <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-wrap:wrap">
          ${c.email?`<a href="mailto:${c.email}" style="padding:6px 14px;border-radius:14px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:600;text-decoration:none"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Email client</a>`:''}
          <button onclick="editClientInfo('${c.id}')" style="padding:6px 14px;border-radius:14px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:12px;font-weight:600;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit info</button>
          <button onclick="deleteClient('${c.id}')" style="padding:6px 14px;border-radius:14px;border:1px solid var(--red);background:var(--red-bg);color:var(--red);font-size:12px;font-weight:600;cursor:pointer;margin-left:auto">Delete client</button>
        </div>
      </div>
      ${lastJob?`<div class="card"><div class="section-label" style="margin-bottom:8px">Most recent job</div>
        <div style="font-size:14px;font-weight:600;color:var(--white)">${lastJob.name}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:2px">${lastJob.date} · ${lastJob.address}</div>
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span class="status-badge status-${lastJob.status||'quoted'}">${lastJob.status||'quoted'}</span>
          <span style="font-size:12px;font-weight:600;color:var(--green)">${fmtN(lastJob.grand)}</span>
        </div>
      </div>`:''}`;
  }
  else if(activeTab==='jobs'){
    tabContent=`<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="section-label" style="margin-bottom:0">All jobs</div>
        <button onclick="loadClientJobInQuote('${id}')" style="padding:6px 14px;border-radius:14px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:600;cursor:pointer">+ New quote for this client</button>
      </div>
      ${cJobs.length?cJobs.map(j=>`
        <div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);gap:12px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--white)">${j.name}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${j.date}${j.shootTime?' at '+j.shootTime:''} · ${j.address}</div>
            ${j.notes?`<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:2px">${j.notes}</div>`:''}
          </div>
          <div style="text-align:right;flex-shrink:0">
            <span class="status-badge status-${j.status||'quoted'}" style="display:block;margin-bottom:4px">${j.status||'quoted'}</span>
            <span style="font-size:13px;font-weight:700;color:var(--green)">${fmtN(j.grand)}</span>
          </div>
          <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;width:100%">
            <button onclick="openInvoiceJob('${j.id}');closeClientDetail();" style="padding:3px 10px;border-radius:10px;border:1px solid var(--amber);background:var(--amber-bg);color:var(--amber);font-size:10px;cursor:pointer;font-weight:600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> View & edit</button>
            ${(j.status==='confirmed'||j.status==='completed')?`<button onclick="openInvoice(${j.id})" style="padding:3px 10px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:10px;cursor:pointer;font-weight:600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Invoice</button>`:''}
            ${j.status!=='completed'&&j.markedPaid!==true?`<button onclick="openReminder(${j.id})" style="padding:3px 10px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:10px;cursor:pointer;font-weight:600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Remind</button>`:''}
          </div>
        </div>`).join('')
      :'<div style="color:var(--muted);font-size:12px;padding:12px 0">No jobs yet for this client.</div>'}
    </div>`;
  }
  else if(activeTab==='invoices'){
    const inv=cJobs.filter(j=>j.status==='confirmed'||j.status==='completed');
    tabContent=`<div class="card">
      <div class="section-label" style="margin-bottom:12px">Invoice history</div>
      ${inv.length?inv.map(j=>{
        const st=getInvoiceStatus(j);
        const {owed,interest,daysOverdue}=calcCurrentOwed(j);
        const stBadge=st==='paid'
          ?`<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:var(--green-bg);color:var(--green)">PAID</span>`
          :st==='overdue'
          ?`<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:var(--red-bg);color:var(--red)">OVERDUE ${daysOverdue}d</span>`
          :`<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:var(--amber-bg);color:var(--amber)">OUTSTANDING</span>`;
        const refDate=j.invoicedAt?new Date(j.invoicedAt):new Date(j.date||Date.now());
        const dueDate=new Date(refDate); dueDate.setDate(dueDate.getDate()+30);
        return `<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border);gap:12px;flex-wrap:wrap">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--white)">${j.name}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${j.date} · Due ${dueDate.toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}</div>
            ${st==='overdue'&&interest>0?`<div style="font-size:11px;color:var(--red);margin-top:3px">⚠ ${fmtN(interest)} interest accrued</div>`:''}
          </div>
          <div style="text-align:right">
            <div style="margin-bottom:4px">${stBadge}</div>
            <div style="font-size:13px;font-weight:700;color:${st==='overdue'?'var(--red)':st==='paid'?'var(--green)':'var(--amber)'}">${fmtN(st==='overdue'?owed:j.grand)}</div>
          </div>
          <div style="display:flex;gap:5px;width:100%;flex-wrap:wrap">
            <button onclick="openInvoice(${j.id})" style="padding:3px 10px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:10px;cursor:pointer;font-weight:600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View invoice</button>
            ${st!=='paid'?`<button onclick="markInvoicePaid(${j.id});renderClientPortal('${id}','invoices')" style="padding:3px 10px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:10px;cursor:pointer;font-weight:600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Mark paid</button>`:''}
            ${st!=='paid'?`<button onclick="openReminder(${j.id})" style="padding:3px 10px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:10px;cursor:pointer;font-weight:600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Remind</button>`:''}
          </div>
        </div>`;
      }).join('')
      :'<div style="color:var(--muted);font-size:12px;padding:12px 0">No invoices yet — confirm or complete a job to generate an invoice.</div>'}
    </div>`;
  }
  else if(activeTab==='assets'){
    // Jobs that have a Drive folder link attached
    const driveJobs=cJobs.filter(j=>j.driveLink).sort((a,b)=>b.date.localeCompare(a.date));
    const SVC_ICONS={video:'',photo:'',tvideo:'',tphoto:'',reel:'',extphoto:'',extvideo:'',floorplan:''};
    const jobServiceTags=j=>Object.entries(j.services||{}).filter(([k,v])=>v&&SVC_ICONS[k]).map(([k])=>SVC_ICONS[k]).join(' ');

    const assetList=assets.length
      ?assets.map((a,i)=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:600;color:var(--white)">${a.name}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:2px">${a.type||'File'} · Added ${a.addedAt||'—'}</div>
          </div>
          <div style="display:flex;gap:6px;align-items:center">
            ${a.url?`<a href="${a.url}" target="_blank" style="padding:4px 10px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:10px;font-weight:600;text-decoration:none">↓ Open</a>`:''}
            <button onclick="removeClientAsset('${c.id}',${i})" style="padding:4px 10px;border-radius:10px;border:1px solid var(--red);background:var(--red-bg);color:var(--red);font-size:10px;cursor:pointer;font-weight:600">Remove</button>
          </div>
        </div>`).join('')
      :'';

    tabContent=`
      ${typeof cdProjectsSectionHtml==='function'?cdProjectsSectionHtml(c.id,false):''}
      <!-- Drive Files Library -->
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <svg width="18" height="16" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="M43.65 25L29.9 0c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/><path d="M43.65 25L57.4 0H13.9c-1.55 0-3.1.4-4.5 1.2z" fill="#00832d"/><path d="M59.8 53H27.5L13.75 76.8h49.8z" fill="#2684fc"/><path d="M73.4 26.5c-.8-1.4-1.95-2.5-3.3-3.3L56.3 0H43.65l16.15 28z" fill="#ffba00"/></svg>
            <div class="section-label" style="margin-bottom:0">Google Drive Files</div>
            ${driveJobs.length?`<span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(34,217,122,.12);color:var(--green)">${driveJobs.length} propert${driveJobs.length===1?'y':'ies'}</span>`:''}
          </div>
          <div style="font-size:11px;color:var(--muted)">Add Drive links via <b style="color:var(--offwhite)">Edit</b> on each job</div>
        </div>
        ${driveJobs.length?`
        <input type="text" id="drive-search-${c.id}" placeholder="Search by address…" oninput="filterDriveFiles('${c.id}')"
          style="width:100%;box-sizing:border-box;padding:8px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);margin-bottom:12px">
        <div id="drive-files-list-${c.id}">
          ${driveJobs.map(j=>`
          <div class="drive-file-row" data-addr="${(j.address||'').toLowerCase()}" data-name="${(j.name||'').toLowerCase()}"
            style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--navy-lift);border-radius:10px;margin-bottom:6px;border:1px solid var(--border);gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${j.address||j.name}">${j.address||j.name}</div>
              <div style="font-size:11px;color:var(--muted)">${j.date}${j.shootTime?' · '+j.shootTime:''} ${jobServiceTags(j)?'· '+jobServiceTags(j):''}</div>
            </div>
            <a href="${j.driveLink}" target="_blank" rel="noopener"
              style="display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:10px;border:1px solid rgba(0,132,71,.5);background:rgba(0,132,71,.1);color:#22D97A;font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0">
              <svg width="12" height="12" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="M43.65 25L29.9 0c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/><path d="M43.65 25L57.4 0H13.9c-1.55 0-3.1.4-4.5 1.2z" fill="#00832d"/><path d="M59.8 53H27.5L13.75 76.8h49.8z" fill="#2684fc"/><path d="M73.4 26.5c-.8-1.4-1.95-2.5-3.3-3.3L56.3 0H43.65l16.15 28z" fill="#ffba00"/></svg>
              Open Files ↗
            </a>
          </div>`).join('')}
        </div>
        <div id="drive-no-results-${c.id}" style="display:none;text-align:center;padding:16px;color:var(--muted);font-size:12px">No properties match your search</div>
        `:`<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px;line-height:1.7">
          No Drive folders linked yet.<br>
          Open a job → <b style="color:var(--offwhite)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</b> → paste the <b style="color:var(--offwhite)">Google Drive folder link</b> for that property.
        </div>`}
      </div>

      <!-- Manual assets / misc links -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;flex-wrap:wrap;gap:8px">
          <div class="section-label" style="margin-bottom:0">Other links & assets</div>
          <button onclick="showAddAssetForm('${c.id}')" style="padding:5px 14px;border-radius:14px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer">+ Add link</button>
        </div>
        <div id="add-asset-form-${c.id}" style="display:none;padding:10px;background:var(--navy-lift);border-radius:8px;margin-bottom:10px;border:1px solid var(--border-bright)">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
            <div>
              <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Name / description</label>
              <input type="text" id="asset-name-${c.id}" placeholder="e.g. Final video — 4612 Lakeshore" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:7px;font-size:12px;background:var(--navy-card);color:var(--white)">
            </div>
            <div>
              <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Type</label>
              <select id="asset-type-${c.id}" style="width:100%;padding:6px 8px;border:1px solid var(--border-bright);border-radius:7px;font-size:12px;background:var(--navy-card);color:var(--white)">
                <option>Final video</option>
                <option>Photo gallery</option>
                <option>Floor plan</option>
                <option>Raw footage</option>
                <option>Google Drive folder</option>
                <option>Dropbox link</option>
                <option>Other</option>
              </select>
            </div>
          </div>
          <div style="margin-bottom:8px">
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">URL / link</label>
            <input type="url" id="asset-url-${c.id}" placeholder="https://drive.google.com/…" style="width:100%;box-sizing:border-box;padding:6px 8px;border:1px solid var(--border-bright);border-radius:7px;font-size:12px;background:var(--navy-card);color:var(--white)">
          </div>
          <div style="display:flex;gap:8px">
            <button onclick="saveClientAsset('${c.id}')" style="padding:5px 16px;border-radius:14px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">Save ✓</button>
            <button onclick="document.getElementById('add-asset-form-${c.id}').style.display='none'" style="padding:5px 12px;border-radius:14px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer">Cancel</button>
          </div>
        </div>
        ${assetList||'<div style="color:var(--muted);font-size:12px;padding:8px 0;text-align:center">No additional assets linked.</div>'}
      </div>`;
  }
  else if(activeTab==='financials'){
    // Year-by-year spending breakdown
    const isUSAClient=_getClientCountryKey(c)==='usa'
      ||cJobs.some(j=>j.market&&j.market!=='canada')
      ||(c.currency||'').toLowerCase()==='usd'
      ||cJobs.some(j=>(j.currency||'').toLowerCase()==='usd');
    const byYear={};
    cJobs.filter(j=>j.status==='completed'||j.status==='confirmed').forEach(j=>{
      const yr=j.date?.slice(0,4)||'Unknown';
      if(!byYear[yr]) byYear[yr]={jobs:[],total:0,hst:0};
      byYear[yr].jobs.push(j);
      byYear[yr].total+=j.grand;
      if((j.currency||'cad').toLowerCase()==='cad') byYear[yr].hst+=j.grand*0.13;
    });
    const years=Object.keys(byYear).sort().reverse();
    const grandTotal=Object.values(byYear).reduce((s,y)=>s+y.total,0);
    const grandHST=Object.values(byYear).reduce((s,y)=>s+y.hst,0);

    tabContent=`<div>
      <div class="card" style="margin-bottom:14px">
        <div class="section-label" style="margin-bottom:12px;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg> Spending Summary — All Time</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:14px">
          <div class="metric"><div class="mlabel">Total spent</div><div class="mval" style="color:var(--green)">${fmtN(grandTotal)}</div></div>
          ${isUSAClient?'':`<div class="metric"><div class="mlabel">HST paid (13%)</div><div class="mval">${fmtN(grandHST)}</div></div>`}
          <div class="metric"><div class="mlabel">Total jobs</div><div class="mval">${cJobs.length}</div></div>
          <div class="metric"><div class="mlabel">Completed</div><div class="mval" style="color:var(--green)">${completed.length}</div></div>
        </div>
        ${isUSAClient?'':`<div style="font-size:11px;color:var(--muted);padding:8px 12px;background:var(--navy-lift);border-radius:8px;border:1px solid var(--border)">
          This breakdown can be shared with ${c.name.split(' ')[0]} for their annual tax records. HST amounts are estimates based on 13% HST rate.
        </div>`}
      </div>

      ${years.length?years.map(yr=>{
        const y=byYear[yr];
        return `<div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:14px;font-weight:700;color:var(--white)">${yr} Tax Year</div>
            <div style="text-align:right">
              <div style="font-size:14px;font-weight:700;color:var(--green)">${fmtN(y.total)}</div>
              ${isUSAClient?'': `<div style="font-size:10px;color:var(--muted)">HST: ${fmtN(y.hst)}</div>`}
            </div>
          </div>
          ${y.jobs.map(j=>`
            <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px">
              <div>
                <span style="color:var(--offwhite);font-weight:500">${j.name}</span>
                <span style="color:var(--muted);font-size:10px;margin-left:8px">${j.date}</span>
              </div>
              <div style="text-align:right">
                <span style="color:var(--green);font-weight:600">${fmtN(j.grand)}</span>
                ${isUSAClient?'': `<span style="color:var(--muted);font-size:10px;margin-left:6px">+${fmtN(j.grand*0.13)} HST</span>`}
              </div>
            </div>`).join('')}
        </div>`;
      }).join('')
      :'<div class="card"><div style="color:var(--muted);font-size:12px;padding:8px 0">No completed jobs to show.</div></div>'}
    </div>`;
  }
  else if(activeTab==='messages'){
    // Mark as read + save seen receipt the moment ops opens this tab with unread messages
    if(_clientMsgUnread>0){
      savePortalMessage(id,'seen','');
      markLcRead('lc_client_'+id);
      setTimeout(()=>renderClients(),0);
    }
    const _rawMsgs=getPortalMessages(id);
    const msgs=await dhDecryptMsgs(_rawMsgs);
    const visibleMsgs=msgs.filter(m=>m.from!=='seen'); // ops view shows only real messages
    tabContent=`<div class="card">
      <div class="section-label" style="margin-bottom:14px;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> LouChat — ${c.name}</div>
      <div style="min-height:200px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:8px;padding:4px 0;margin-bottom:14px" id="admin-msgs-body">
        ${visibleMsgs.length?visibleMsgs.map(m=>`
          <div style="padding:10px 14px;border-radius:12px;max-width:78%;background:${m.from==='client'?'var(--navy-lift)':'linear-gradient(135deg,var(--blue),var(--blue-dim))'};color:${m.from==='client'?'var(--offwhite)':'#fff'};${m.from==='client'?'align-self:flex-start':'align-self:flex-end'}">
            <div style="font-size:10px;font-weight:700;opacity:.7;margin-bottom:3px">${m.from==='client'?c.name:'DroneHub team'}</div>
            <div style="font-size:12px;line-height:1.5">${m.text}</div>
            <div style="font-size:10px;opacity:.6;margin-top:4px">${new Date(m.ts).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'})}</div>
          </div>`).join('')
        :`<div style="text-align:center;padding:28px;color:var(--muted);font-size:13px">No messages yet from this client.</div>`}
      </div>
      <div style="display:flex;gap:8px;border-top:1px solid var(--border);padding-top:12px">
        <input type="text" id="admin-msg-input-${id}" placeholder="Reply to ${c.name.split(' ')[0]}…" onkeydown="if(event.key==='Enter')adminSendReply('${id}')"
          style="flex:1;padding:8px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white)">
        <button onclick="adminSendReply('${id}')" style="padding:8px 16px;border-radius:10px;border:none;background:linear-gradient(135deg,var(--blue),var(--blue-dim));color:#fff;font-size:12px;font-weight:700;cursor:pointer">Reply</button>
      </div>
    </div>`;
  } else if(activeTab==='production'){
    const PROD_STATUS={
      ready:            {label:'Ready to Start',       color:'var(--blue-bright)', bg:'rgba(91,141,239,.12)'},
      footage_pending:  {label:'Footage Pending',      color:'var(--muted)',       bg:'rgba(136,146,187,.1)'},
      draft1_progress:  {label:'D1 — In Progress',     color:'var(--green)',       bg:'rgba(34,217,122,.12)'},
      draft1:           {label:'D1 — Sent',             color:'var(--green)',       bg:'rgba(34,217,122,.12)'},
      draft2_ready:     {label:'D2 — Ready to Start',  color:'#60C8FF',            bg:'rgba(91,141,239,.15)'},
      draft2_progress:  {label:'D2 — In Progress',     color:'var(--amber)',       bg:'rgba(245,166,35,.12)'},
      draft2:           {label:'D2 — Sent',             color:'var(--green)',       bg:'rgba(34,217,122,.12)'},
      draft3_ready:     {label:'D3 — Ready to Start',  color:'#60C8FF',            bg:'rgba(91,141,239,.15)'},
      draft3_progress:  {label:'D3 — In Progress',     color:'var(--amber)',       bg:'rgba(245,166,35,.12)'},
      draft3:           {label:'D3 — Sent',             color:'var(--amber)',       bg:'rgba(245,166,35,.12)'},
      draft_plus_ready: {label:'D+ — Ready to Start',  color:'#60C8FF',            bg:'rgba(91,141,239,.15)'},
      draft_plus:       {label:'Draft +',               color:'var(--red)',         bg:'rgba(240,82,82,.12)'},
      finals_sent:      {label:'✓ Finals Delivered',   color:'var(--green)',       bg:'rgba(34,217,122,.15)'},
      in_progress:      {label:'In Progress',           color:'var(--blue-bright)', bg:'rgba(91,141,239,.12)'},
      review:           {label:'In Review',             color:'#A78BFA',            bg:'rgba(139,92,246,.12)'},
    };

    // Build a unified project list:
    // 1. Active jobs currently in the tracker for this client
    const trackerJobs=cJobs.filter(j=>j.status==='confirmed'||j.status==='completed');
    // 2. Completed projects auto-linked to this client (includes standalone)
    const linkedCompleted=(c.completedProjects||[]).filter(p=>!trackerJobs.find(j=>String(j.id)===String(p.jobId)));

    const prodProjects=[
      ...trackerJobs.map(j=>({_type:'live',j})),
      ...linkedCompleted.map(p=>({_type:'linked',p})),
    ];

    // Helper to render file link buttons
    const fileLink=(href,label,borderColor,textColor,bg)=>href
      ?`<a href="${href}" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:8px;border:1px solid ${borderColor};background:${bg};color:${textColor};font-size:11px;font-weight:700;text-decoration:none;white-space:nowrap">${label}</a>`:'';

    tabContent=`<div>
      <!-- Search -->
      <div class="card" style="margin-bottom:12px;padding:12px 16px">
        <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
          <div style="display:flex;align-items:center;gap:8px;flex:1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            <span style="font-size:13px;font-weight:700;color:var(--white)">Production & Delivery</span>
            <span style="padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(91,141,239,.12);color:var(--blue-bright)">${prodProjects.length} project${prodProjects.length===1?'':'s'}</span>
          </div>
          <input type="text" id="prod-search-${id}" placeholder="Search by address…" oninput="filterProdProjects('${id}')"
            style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--navy-lift);color:var(--white);width:200px;outline:none">
        </div>
      </div>

      <!-- Active / in-progress jobs -->
      ${trackerJobs.length?`<div class="card" style="margin-bottom:12px">
        <div class="section-label" style="margin-bottom:12px">In Production</div>
        <div id="prod-active-${id}">
        ${trackerJobs.map(j=>{
          const ts=getTrackerStage(j.id);
          const ss=PROD_STATUS[ts.editStatus||'ready']||PROD_STATUS.ready;
          const pid=ts.projectId||getProjectId(j);
          const draftWarning=ts.extraDraftCharge>0?`<span style="font-size:10px;color:var(--amber);font-weight:700">⚠ +$${ts.extraDraftCharge} draft charge</span>`:'';
          const addr=(j.address||j.name||'').toLowerCase();
          return `<div class="prod-row" data-addr="${addr}" style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border);gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${j.address||j.name}">${j.address||j.name}</div>
              <div style="font-size:11px;color:var(--muted);margin-bottom:6px">${j.date||''}${pid?' · '+pid:''}</div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                <span style="padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;background:${ss.bg};color:${ss.color}">${ss.label}</span>
                ${ts.claimedBy?`<span style="font-size:10px;color:var(--muted)">Editor: ${ts.claimedBy}</span>`:''}
                ${draftWarning}
              </div>
              ${ts.completionDate?`<div style="font-size:10px;color:var(--amber);margin-top:5px;font-weight:600">Due: ${ts.completionDate}</div>`:''}
            </div>
            <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
              ${fileLink(ts.frameioLink,'▶ Review on Frame.io','var(--purple)','#A78BFA','var(--purple-bg)')}
              ${fileLink(ts.downloadLink,'☁ Google Drive','rgba(91,141,239,.4)','var(--blue-bright)','rgba(91,141,239,.08)')}
              ${fileLink(ts.dropboxLink,'Dropbox','rgba(0,97,255,.4)','#0061FF','rgba(0,97,255,.08)')}
              ${(()=>{const _fl=(ts.filemailLinks&&ts.filemailLinks.length?ts.filemailLinks:ts.filemailLink?[ts.filemailLink]:[]);const _flFirst=_fl[0]||'';const _flCount=_fl.length;return _flFirst?fileLink(_flFirst,`↓ Filemail${_flCount>1?` (${_flCount})`:''}`, 'rgba(34,217,122,.4)','var(--green)','var(--green-bg)'):'';})()}
            </div>
          </div>`;
        }).join('')}
        </div>
      </div>`:''}

      <!-- Completed / delivered projects -->
      <div class="card">
        <div class="section-label" style="margin-bottom:12px">Completed Deliveries</div>
        <div id="prod-completed-${id}">
        ${(c.completedProjects||[]).length===0
          ?'<div style="color:var(--muted);font-size:12px;padding:12px 0;text-align:center">No completed deliveries yet.<br><span style="font-size:11px">Projects appear here automatically when marked ✓ Finals Sent in the tracker.</span></div>'
          :(c.completedProjects||[]).slice().reverse().map(p=>{
            const addr=(p.address||'').toLowerCase();
            return `<div class="prod-row" data-addr="${addr}" style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border);gap:12px;flex-wrap:wrap">
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${p.address}">${p.address||'Project'}</div>
                <div style="font-size:11px;color:var(--muted);margin-bottom:5px">${p.date||''}${p.projectId?' · '+p.projectId:''}</div>
                <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                  <span style="padding:3px 10px;border-radius:8px;font-size:11px;font-weight:700;background:rgba(34,217,122,.15);color:var(--green)">✓ Finals Delivered</span>
                  ${p.completionDate?`<span style="font-size:10px;color:var(--muted)">Completed ${p.completionDate}</span>`:''}
                  ${p.linkedAt?`<span style="font-size:10px;color:var(--muted)">Linked ${p.linkedAt}</span>`:''}
                </div>
                ${p.notes?`<div style="font-size:10px;color:var(--muted);margin-top:5px;font-style:italic">${p.notes.slice(0,100)}${p.notes.length>100?'…':''}</div>`:''}
              </div>
              <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;flex-shrink:0">
                ${fileLink(p.frameioLink,'▶ Frame.io','var(--purple)','#A78BFA','var(--purple-bg)')}
                ${fileLink(p.downloadLink,'☁ Google Drive','rgba(91,141,239,.4)','var(--blue-bright)','rgba(91,141,239,.08)')}
                ${fileLink(p.dropboxLink,'Dropbox','rgba(0,97,255,.4)','#0061FF','rgba(0,97,255,.08)')}
                ${fileLink(p.filemailLink,'↓ Filemail','rgba(34,217,122,.4)','var(--green)','var(--green-bg)')}
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;
  }
  else if(activeTab==='social'){
    const sAllWorkspaces=socialWorkspacesLoad();
    const sLinkedWs=sAllWorkspaces.find(w=>w.clientId===id);
    const sAllPosts=socialPostsLoad();
    const sPosts=sAllPosts.filter(p=>{
      if(p.status==='draft') return false;
      if(p.clientId===id) return true;
      if(p.workspaceId){const w=sAllWorkspaces.find(w=>w.id===p.workspaceId);if(w?.clientId===id) return true;}
      return false;
    }).sort((a,b)=>(b.scheduledAt||b.createdAt||'').localeCompare(a.scheduledAt||a.createdAt||''));
    const sPending=sPosts.filter(p=>p.status==='pending').length;
    const statusBadge=s=>{
      const map={pending:'#F5C842',approved:'#22D97A',revision:'#FF6B6B',scheduled:'#5B8DEF',posted:'#A8B4D0',draft:'#666'};
      const lbl={pending:'Awaiting Approval',approved:'Approved',revision:'Needs Revision',scheduled:'Scheduled',posted:'Posted',draft:'Draft'};
      return `<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${map[s]||'#666'}22;color:${map[s]||'#666'};border:1px solid ${map[s]||'#666'}44">${lbl[s]||s}</span>`;
    };
    tabContent=`<div>
      ${typeof socialAnalyticsClientCardsHtml==='function'?socialAnalyticsClientCardsHtml(id,false):''}
      <!-- Linked workspace card -->
      <div class="card" style="margin-bottom:12px">
        <div class="section-label" style="margin-bottom:14px;display:flex;align-items:center;gap:6px">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
          Social Workspace
        </div>
        ${sLinkedWs?`
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:12px 14px;background:rgba(91,141,239,.07);border:1px solid rgba(91,141,239,.2);border-radius:10px;margin-bottom:12px">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--white)">${sLinkedWs.name}</div>
              ${sLinkedWs.igHandle?`<div style="font-size:11px;color:var(--muted);margin-top:2px">@${sLinkedWs.igHandle}</div>`:''}
              <div style="font-size:11px;color:var(--muted);margin-top:3px">${(sLinkedWs.channels||[]).join(' · ')||'No channels'}</div>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              ${sPending?`<span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:8px;background:rgba(245,200,66,.15);color:#F5C842;border:1px solid rgba(245,200,66,.3)">${sPending} awaiting approval</span>`:''}
              <button onclick="showPane('social');_socialActiveWorkspace='${sLinkedWs.id}';renderSocial()" style="padding:6px 14px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">Open Workspace ↗</button>
            </div>
          </div>`:`
          <div style="padding:12px 14px;background:rgba(136,146,187,.07);border:1px solid var(--border);border-radius:10px;margin-bottom:12px;color:var(--muted);font-size:12px">
            No social workspace linked yet. Go to <strong style="color:var(--offwhite)">Social → Edit workspace</strong> and select <strong style="color:var(--offwhite)">${c.name}</strong> as the linked client.
          </div>`}
      </div>
      <!-- Posts list -->
      <div class="card">
        <div class="section-label" style="margin-bottom:14px">Recent Posts (${sPosts.length})</div>
        ${sPosts.length===0?`<div style="text-align:center;padding:30px 0;color:var(--muted);font-size:12px">No posts yet${sLinkedWs?` in ${sLinkedWs.name}`:''}. Create posts in the Social tab and they'll appear here.</div>`:''}
        ${sPosts.slice(0,10).map(p=>`
          <div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:10px;border:1px solid var(--border);margin-bottom:8px;background:var(--navy-lift)">
            <div style="flex:1;min-width:0">
              <div style="font-size:12px;font-weight:700;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${p.address||p.title||'Untitled post'}</div>
              <div style="font-size:10px;color:var(--muted);margin-top:2px">${p.format||''}${p.scheduledAt?' · '+p.scheduledAt.slice(0,10):''}</div>
            </div>
            <div>${statusBadge(p.status)}</div>
          </div>`).join('')}
        ${sPosts.length>10?`<div style="font-size:11px;color:var(--muted);text-align:center;padding:6px 0">+ ${sPosts.length-10} more — open workspace to see all</div>`:''}
      </div>
    </div>`;
  }
  else if(activeTab==='portal'){
    const portalAccts=getPortalAccounts();
    const acct=portalAccts.find(a=>a.clientId===id);
    const biz=bizSettings||{};
    // Make sure an invite code exists so it can be shown on the page
    let _inviteCode=acct?.inviteCode;
    if(!_inviteCode){
      _inviteCode=cpGenerateInviteCode();
      if(acct){acct.inviteCode=_inviteCode;}
      else{portalAccts.push({clientId:id,inviteCode:_inviteCode,createdAt:new Date().toISOString().slice(0,10),status:'invited'});}
      savePortalAccounts(portalAccts);
    }
    const _inviteLink=window.location.origin+window.location.pathname+'?portal=client&invite='+_inviteCode+'&cid='+id;

    tabContent=`<div class="card">
      <div class="section-label" style="margin-bottom:14px;display:flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> Client Portal Access</div>

      ${acct?`
        <div style="padding:14px 16px;background:rgba(34,217,122,.08);border:1px solid rgba(34,217,122,.3);border-radius:10px;margin-bottom:16px;display:flex;align-items:center;gap:10px">
          <span style="font-size:20px">✓</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--green)">Portal access active</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${c.name} can log in with their email and password to view projects, invoices, files and LouChat.</div>
          </div>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px">
          <button onclick="previewPortalAs('${id}')" style="padding:7px 16px;border-radius:12px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer;display:inline-flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg> Preview as client</button>
          <button onclick="sendClientPortalInvite('${id}')" style="padding:7px 16px;border-radius:12px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Resend invite email</button>
          <button onclick="revokeClientPortal('${id}');renderClientPortal('${id}','portal')" style="padding:7px 14px;border-radius:12px;border:1px solid var(--red);background:var(--red-bg);color:var(--red);font-size:12px;font-weight:600;cursor:pointer">Revoke access</button>
        </div>`
      :`
        <div style="padding:14px 16px;background:rgba(136,146,187,.07);border:1px solid var(--border);border-radius:10px;margin-bottom:16px">
          <div style="font-size:13px;font-weight:600;color:var(--offwhite);margin-bottom:4px">No portal access yet</div>
          <div style="font-size:11px;color:var(--muted);line-height:1.7">${c.name} doesn't have a login yet. Create credentials below and send them an invite email — they'll be able to log in and see their projects, invoices, video progress and download links.</div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:12px">
          <button id="cp-invite-btn-${c.id}" onclick="cpCopyInviteLink('${c.id}')" style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg> Copy Invite Link</button>
          <button onclick="cpEmailInvite('${c.id}',this)" style="flex:1;padding:8px 12px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Send Email Invite</button>
        </div>
        <div style="background:var(--navy-lift);border:1px solid var(--border);border-radius:10px;padding:12px 14px;margin-bottom:12px">
          <div style="display:grid;grid-template-columns:auto 1fr auto;gap:8px 12px;align-items:center">
            <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Invite code</span>
            <input readonly value="${_inviteCode}" onclick="this.select()" style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;font-weight:700;background:var(--navy-mid);color:var(--white);font-family:monospace;letter-spacing:.05em">
            <button onclick="navigator.clipboard.writeText('${_inviteCode}');this.textContent='✓';setTimeout(()=>this.textContent='Copy',1500)" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border-bright);background:transparent;color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer">Copy</button>
            <span style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Invite link</span>
            <input readonly value="${_inviteLink}" onclick="this.select()" style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:11px;background:var(--navy-mid);color:var(--offwhite)">
            <button onclick="navigator.clipboard.writeText('${_inviteLink}');this.textContent='✓';setTimeout(()=>this.textContent='Copy',1500)" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border-bright);background:transparent;color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer">Copy</button>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:8px;line-height:1.6">Paste the <b style="color:var(--offwhite)">code</b> into the signup form's Invite Code field, or open the <b style="color:var(--offwhite)">link</b> to get the form pre-filled. Nothing is emailed until you use the email buttons.</div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
          <div>
            <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">Password</label>
            <input type="text" id="cp-new-pass-inline" placeholder="Set a password for ${c.name.split(' ')[0]}" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
          </div>
          <div style="display:flex;align-items:flex-end">
            <button onclick="createClientPortalFromDetail('${id}')" style="padding:8px 18px;border-radius:12px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;width:100%;display:inline-flex;align-items:center;justify-content:center;gap:6px"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg> Create & send invite</button>
          </div>
        </div>`}

      <div style="border-top:1px solid var(--border);padding-top:16px">
        <div style="font-size:12px;font-weight:700;color:var(--offwhite);margin-bottom:10px">What the client sees in their portal:</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
          ${[
            [`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>`,'Project progress','Live edit status, draft stages, completion date'],
            [`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>`,'Invoices','All invoices with payment status and history'],
            [`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`,'Spending history','Total spend by year — useful for tax records'],
            [`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>`,'Frame.io reviews','Watch their videos and leave timestamped notes'],
            [`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,'Download finals','Direct links to download their completed files'],
            [`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>`,'Files & media','Photo/video assets — links to Google Drive (coming soon)'],
            [`<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>`,'LouChat','Direct messaging with the DroneHub team'],
          ].map(([icon,title,desc])=>`
            <div style="padding:10px 12px;background:var(--navy-lift);border-radius:8px;border:1px solid var(--border)">
              <div style="margin-bottom:6px;color:var(--blue-bright)">${icon}</div>
              <div style="font-size:12px;font-weight:700;color:var(--white);margin-bottom:2px">${title}</div>
              <div style="font-size:10px;color:var(--muted);line-height:1.5">${desc}</div>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
  }
  if(activeTab==='messages'){setTimeout(()=>{const b=document.getElementById('admin-msgs-body');if(b)b.scrollTop=b.scrollHeight;},50);}
  document.getElementById('client-detail-content').innerHTML=`

      <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
        <button onclick="closeClientDetail()" style="padding:7px 14px;border-radius:12px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:12px;cursor:pointer;font-weight:600">← Back</button>
        <div>
          <div style="font-size:22px;font-weight:700;color:var(--white);line-height:1">${c.name}</div>
          ${c.company?`<div style="font-size:13px;color:var(--muted);margin-top:3px">${c.company}</div>`:''}
        </div>
      </div>
      <div class="no-scrollbar" style="display:flex;gap:3px;background:var(--navy-card);border:1px solid var(--border);border-radius:12px;padding:4px;margin-bottom:16px;overflow-x:auto">
        ${tabHtml}
      </div>
    ${tabContent}`;
}

// ─── CLIENT PORTAL HELPERS ──────────────────────────────────────────────────
function loadClientJobInQuote(clientId){
  closeClientDetail();
  // Pre-select client in quote builder
  selectedClientId=clientId;
  const c=clients.find(cl=>cl.id===clientId);
  if(c){
    const si=document.getElementById('client-search-input');if(si)si.value=c.name;
    const sd=document.getElementById('client-selected-display');if(sd)sd.style.display='block';
    const sn=document.getElementById('client-selected-name');if(sn)sn.textContent=c.name+(c.company?' \u2014 '+c.company:'');
  }
  // Switch to Quote Builder
  document.querySelectorAll('.tab').forEach((t,i)=>t.classList.toggle('active',i===0));
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  document.getElementById('pane-quote')?.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});
}

function editClientInfo(clientId){
  const c=clients.find(cl=>cl.id===clientId);
  if(!c) return;
  const val=(field,placeholder)=>`
    <div style="margin-bottom:8px">
      <label style="font-size:10px;color:var(--muted);font-weight:700;display:block;margin-bottom:3px;text-transform:uppercase;letter-spacing:.06em">${field.charAt(0).toUpperCase()+field.slice(1)}</label>
      <input type="text" id="edit-client-${field}" value="${(c[field]||'').replace(/"/g,'&quot;')}" placeholder="${placeholder}" style="width:100%;box-sizing:border-box;padding:7px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
    </div>`;
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:3000;display:flex;align-items:center;justify-content:center';
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:14px;padding:24px;max-width:460px;width:90%;border:1px solid var(--border-bright)">
    <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:16px">Edit client info</div>
    ${val('name','Full name')}${val('company','Company / brokerage')}${val('email','email@example.com')}${val('phone','905-555-0100')}${val('address','123 Main St, City, ON')}
    <div style="display:flex;gap:8px;margin-top:16px">
      <button onclick="saveClientEdit('${clientId}',this.closest('[style*=fixed]'))" style="padding:7px 20px;border-radius:16px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:13px;font-weight:700;cursor:pointer">Save ✓</button>
      <button onclick="this.closest('[style*=fixed]').remove()" style="padding:7px 14px;border-radius:16px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function saveClientEdit(clientId, modal){
  const c=clients.find(cl=>cl.id===clientId);
  if(!c) return;
  ['name','company','email','phone','address'].forEach(f=>{
    const el=document.getElementById('edit-client-'+f);
    if(el) c[f]=el.value.trim();
  });
  saveClientsToStorage();
  syncClientToSalesCRM(c); // push changes to CRM Contacts → Existing Clients
  modal.remove();
  renderClients();
  if(typeof renderSalesTable==='function') renderSalesTable();
  renderClientPortal(clientId,'overview');
}

function showAddAssetForm(clientId){
  const f=document.getElementById('add-asset-form-'+clientId);
  if(f) f.style.display=f.style.display==='none'?'block':'none';
}

// Filter production tab rows by address keyword
function filterProdProjects(clientId){
  const q=(document.getElementById('prod-search-'+clientId)?.value||'').toLowerCase().trim();
  document.querySelectorAll('#prod-active-'+clientId+' .prod-row, #prod-completed-'+clientId+' .prod-row').forEach(row=>{
    row.style.display=(!q||( row.dataset.addr||'').includes(q))?'':'none';
  });
}

function filterDriveFiles(clientId){
  const q=(document.getElementById('drive-search-'+clientId)?.value||'').toLowerCase().trim();
  const rows=document.querySelectorAll('#drive-files-list-'+clientId+' .drive-file-row');
  let visible=0;
  rows.forEach(row=>{
    const addr=row.dataset.addr||'';
    const name=row.dataset.name||'';
    const show=!q||addr.includes(q)||name.includes(q);
    row.style.display=show?'':'none';
    if(show) visible++;
  });
  const noRes=document.getElementById('drive-no-results-'+clientId);
  if(noRes) noRes.style.display=(rows.length&&visible===0)?'block':'none';
}

function filterCPDriveFiles(){
  const q=(document.getElementById('cp-drive-search')?.value||'').toLowerCase().trim();
  const rows=document.querySelectorAll('#cp-drive-list .cp-drive-row');
  let visible=0;
  rows.forEach(row=>{
    const addr=row.dataset.addr||'';
    const name=row.dataset.name||'';
    const show=!q||addr.includes(q)||name.includes(q);
    row.style.display=show?'':'none';
    if(show) visible++;
  });
  const noRes=document.getElementById('cp-drive-no-results');
  if(noRes) noRes.style.display=(rows.length&&visible===0)?'block':'none';
}

function saveClientAsset(clientId){
  const c=clients.find(cl=>cl.id===clientId);
  if(!c) return;
  const name=document.getElementById('asset-name-'+clientId)?.value.trim();
  const type=document.getElementById('asset-type-'+clientId)?.value;
  const url=document.getElementById('asset-url-'+clientId)?.value.trim();
  if(!name){alert('Please enter a name for this asset.');return;}
  if(!c.assets) c.assets=[];
  c.assets.push({name,type,url,addedAt:new Date().toISOString().slice(0,10)});
  saveClientsToStorage();
  renderClientPortal(clientId,'assets');
}

function removeClientAsset(clientId, index){
  const c=clients.find(cl=>cl.id===clientId);
  if(!c||!c.assets) return;
  if(!confirm('Remove this asset?')) return;
  c.assets.splice(index,1);
  saveClientsToStorage();
  renderClientPortal(clientId,'assets');
}


// Simple hash (not cryptographic — replace with bcrypt on real backend)
// Legacy weak hash — kept ONLY for migrating existing stored passwords.
// Do not use for any new password operations.
function simpleHash(str){
  let h=0;
  for(let i=0;i<str.length;i++){h=Math.imul(31,h)+str.charCodeAt(i)|0;}
  return Math.abs(h).toString(36);
}

// ── Secure password hashing (SHA-256 via Web Crypto) ─────────────────────────
// Prefix stored so we can tell new hashes from legacy ones at a glance.
const _HASH_PREFIX='sha256:';
async function hashPass(email, pass){
  // Salt = normalised email + app-level pepper + password. Keeps hashes
  // user-specific so a leaked hash from one account can't authenticate another.
  const salt=`dronehub|${email.trim().toLowerCase()}|${pass}`;
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(salt));
  return _HASH_PREFIX+Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}
// Returns true if the stored hash matches the password (handles both old and new format).
async function verifyPass(email, pass, stored){
  if(!stored) return false;
  if(stored.startsWith(_HASH_PREFIX)) return stored===(await hashPass(email,pass));
  // Legacy path: djb2 hash. We accept it so existing users aren't locked out.
  return stored===simpleHash(pass);
}
// Call this on successful login when an old-format hash is detected: upgrades in place.
async function upgradeHashIfLegacy(email, pass, userRecord, saveCallback){
  if(userRecord.passHash&&!userRecord.passHash.startsWith(_HASH_PREFIX)){
    userRecord.passHash=await hashPass(email,pass);
    try{ saveCallback(userRecord); }catch(e){}
  }
}

// ── Login rate limiting ───────────────────────────────────────────────────────
// Tracks failed attempts per email in sessionStorage. After 5 failures the
// account is locked for 15 minutes on this device/tab.
const _RATE_KEY='dh_login_attempts';
const _RATE_LIMIT=5;
const _RATE_WINDOW_MS=15*60*1000; // 15 min
function _getRateData(){ try{return JSON.parse(sessionStorage.getItem(_RATE_KEY)||'{}');}catch(e){return{};} }
function _saveRateData(d){ try{sessionStorage.setItem(_RATE_KEY,JSON.stringify(d));}catch(e){} }
function checkRateLimit(email){
  // Returns null if OK to proceed, or an error string if locked out.
  const data=_getRateData();
  const rec=data[email]||{count:0,until:0};
  if(rec.until>Date.now()){
    const mins=Math.ceil((rec.until-Date.now())/60000);
    return `Too many failed attempts. Please try again in ${mins} minute${mins===1?'':'s'}.`;
  }
  return null;
}
function recordLoginFailure(email){
  const data=_getRateData();
  const rec=data[email]||{count:0,until:0};
  // Reset window if lockout has expired
  if(rec.until>0&&rec.until<=Date.now()){ rec.count=0; rec.until=0; }
  rec.count++;
  if(rec.count>=_RATE_LIMIT) rec.until=Date.now()+_RATE_WINDOW_MS;
  data[email]=rec;
  _saveRateData(data);
}
function clearLoginFailures(email){
  const data=_getRateData();
  delete data[email];
  _saveRateData(data);
}

// Portal messages stored per client: {[clientId]: [{from, text, ts}]}
function getPortalMessages(clientId){
  const all=JSON.parse(localStorage.getItem('dronehub_portal_msgs')||'{}');
  return all[clientId]||[];
}
async function savePortalMessage(clientId, from, text, opts){
  const all=JSON.parse(localStorage.getItem('dronehub_portal_msgs')||'{}');
  if(!all[clientId]) all[clientId]=[];
  const encText=text?await dhEncrypt(text):text;
  // to: 'team' or an admin's name — which conversation this belongs to
  // by: display name of the sender (admin name for team-side messages)
  all[clientId].push({from, text:encText, ts:new Date().toISOString(), to:opts?.to||'team', by:opts?.by||''});
  try{localStorage.setItem('dronehub_portal_msgs',JSON.stringify(all));}catch(e){}
  fbSet('orgs',ORG_ID+':portal_msgs',{data:JSON.stringify(all),updatedAt:Date.now()});
}

let cpActiveClientId=null;

// ── Shared client-portal auto-login helper ───────────────────────────────
// Returns true and shows the dashboard if any session can be restored.
// Returns false and the caller must show the login screen.
function _cpTryAutoLogin(){
  // 1. In-memory session already active
  if(cpActiveClientId){
    document.getElementById('cp-login').style.display='none';
    document.getElementById('cp-dashboard').style.display='block';
    return true;
  }

  // 2. Saved sessionStorage session (survived a portal switch)
  try{
    const saved=JSON.parse(sessionStorage.getItem('dronehub_cp_session')||'null');
    if(saved?.clientId){
      cpActiveClientId=saved.clientId;
      document.getElementById('cp-welcome-name').textContent=saved.name||'';
      document.getElementById('cp-login').style.display='none';
      document.getElementById('cp-dashboard').style.display='block';
      restoreFromFirebase().then(()=>cpShowTab('overview')).catch(()=>cpShowTab('overview'));
      return true;
    }
  }catch(e){}

  // 3. SSO — gate session email matched against portal_accounts.
  //    If the logged-in ops/team user has a client portal account under
  //    the same email, authenticate them silently.
  const gateSession=gateGetSession();
  const gateEmail=((gateSession?.email)||'').toLowerCase();
  if(gateEmail){
    const acct=getPortalAccounts().find(a=>(a.email||'').toLowerCase()===gateEmail);
    if(acct?.clientId){
      cpActiveClientId=acct.clientId;
      const displayName=acct.name||gateSession?.name||gateEmail.split('@')[0];
      try{sessionStorage.setItem('dronehub_cp_session',JSON.stringify({clientId:acct.clientId,email:gateEmail,name:displayName}));}catch(e){}
      document.getElementById('cp-welcome-name').textContent=displayName;
      document.getElementById('cp-login').style.display='none';
      document.getElementById('cp-dashboard').style.display='block';
      restoreFromFirebase().then(()=>cpShowTab('overview')).catch(()=>cpShowTab('overview'));
      return true;
    }
  }

  return false; // caller must show login form
}

function openClientPortal(){
  document.getElementById('client-portal-root').style.display='block';
  document.body.style.overflow='hidden';
  if(_cpTryAutoLogin()) return;
  // No session found — show login
  document.getElementById('cp-login').style.display='flex';
  document.getElementById('cp-dashboard').style.display='none';
  document.getElementById('cp-login-email').value='';
  document.getElementById('cp-login-pass').value='';
  document.getElementById('cp-login-error').style.display='none';
  setTimeout(()=>document.getElementById('cp-login-email').focus(),100);
}

function exitClientPortal(){
  document.getElementById('client-portal-root').style.display='none';
  document.body.style.overflow='';
  cpActiveClientId=null;
}

// ── PORTAL SWITCHER — stays logged in to both portals simultaneously ──────
function switchToTeamPortal(){
  document.getElementById('client-portal-root').style.display='none';
  document.getElementById('team-portal-root').style.display='block';
  document.body.style.overflow='hidden';

  // 1. Already have an active session this page load
  if(tpActiveMemberId){
    document.getElementById('tp-login').style.display='none';
    document.getElementById('tp-dashboard').style.display='block';
    return;
  }

  const members=getTeamMembers();

  // 2. Restore from sessionStorage (survived a portal switch mid-session)
  try{
    const saved=JSON.parse(sessionStorage.getItem('dronehub_tp_session')||'null');
    if(saved?.memberId){
      const m=members.find(x=>x.id===saved.memberId);
      if(m){ tpActiveMemberId=m.id; tpOpenDashboard(m); return; }
    }
  }catch(e){}

  // 3. SSO — gate session (or client portal session) already proves identity;
  //    build a synthetic member so the team portal dashboard works regardless
  //    of whether a team_members record exists
  const gateSession=gateGetSession();
  // Also check client portal session as fallback email source
  let cpSession=null;
  try{cpSession=JSON.parse(sessionStorage.getItem('dronehub_cp_session')||'null');}catch(e){}
  const gateEmail=((gateSession?.email)||(cpSession?.email)||'').toLowerCase();
  if(gateEmail){
    // Try exact match in team_members first
    const m=members.find(x=>(x.email||'').toLowerCase()===gateEmail);
    if(m){ tpActiveMemberId=m.id; tpOpenDashboard(m); return; }

    // Gate-authenticated user has no team_members record — create a
    // synthetic one on-the-fly so they can access the portal immediately.
    // This is safe: they're already verified by the gate auth system.
    const syntheticId='tp_gate_'+gateEmail.replace(/[^a-z0-9]/g,'_');
    const synthetic={
      id: syntheticId,
      name: gateSession.name||gateEmail.split('@')[0],
      email: gateEmail,
      role: gateSession.role||'admin',
      orgId: null,
    };
    tpActiveMemberId=syntheticId;
    tpOpenDashboard(synthetic);
    return;
  }

  // 4. DEV SHORTCUT fallback — mirrors openTeamPortal() behaviour
  if(members.length){
    tpActiveMemberId=members[0].id;
    tpOpenDashboard(members[0]);
    return;
  }

  // 5. No session and no members — show login/signup
  document.getElementById('tp-login').style.display='flex';
  document.getElementById('tp-dashboard').style.display='none';
  tpSwitchMode('login');
}

function switchToClientPortal(){
  document.getElementById('team-portal-root').style.display='none';
  document.getElementById('client-portal-root').style.display='block';
  document.body.style.overflow='hidden';
  if(_cpTryAutoLogin()) return;
  // No session — show login screen
  document.getElementById('cp-login').style.display='flex';
  document.getElementById('cp-dashboard').style.display='none';
}

// ── CLIENT PORTAL — STANDALONE ROUTING ───────────────────────────────────
let _cpInviteCode='';
let _cpInviteClientId='';

function cpShowSignin(){
  document.getElementById('cp-login').style.display='flex';
  document.getElementById('cp-dashboard').style.display='none';
  const signupCard=document.getElementById('cp-signup-card');
  const loginCard=document.querySelector('#cp-login .cp-login-main-card');
  if(signupCard) signupCard.style.display='none';
  // Show sign-in card - find it by looking for cp-login-email
  const emailInput=document.getElementById('cp-login-email');
  if(emailInput) emailInput.closest('[style*="border-radius:16px"]').style.display='block';
  setTimeout(()=>document.getElementById('cp-login-email')?.focus(),100);
}

function cpShowSignup(inviteCode, clientId){
  _cpInviteCode=inviteCode||'';
  _cpInviteClientId=clientId||'';
  document.getElementById('cp-login').style.display='flex';
  document.getElementById('cp-dashboard').style.display='none';
  // Hide sign-in card, show sign-up card
  const signupCard=document.getElementById('cp-signup-card');
  if(signupCard){
    signupCard.style.display='block';
    // Pre-fill name from client record if available
    if(clientId){
      const c=clients.find(cl=>cl.id===clientId);
      if(c){
        const nameEl=document.getElementById('cp-signup-name');
        if(nameEl) nameEl.value=c.name||'';
        const emailEl=document.getElementById('cp-signup-email');
        if(emailEl && c.email) emailEl.value=c.email;
      }
    }
  }
  // Hide the sign-in form (the card with cp-login-email)
  const emailInput=document.getElementById('cp-login-email');
  if(emailInput){
    const card=emailInput.closest('div[style*="border-radius:16px"]');
    if(card) card.style.display='none';
  }
  setTimeout(()=>document.getElementById('cp-signup-name')?.focus(),100);
}

async function cpSignup(){
  const name=(document.getElementById('cp-signup-name')?.value||'').trim();
  const email=(document.getElementById('cp-signup-email')?.value||'').trim().toLowerCase();
  const pass=document.getElementById('cp-signup-pass')?.value||'';
  const errEl=document.getElementById('cp-signup-error');
  if(!errEl) return;
  errEl.style.display='none';

  if(!name){errEl.textContent='Please enter your name.';errEl.style.display='block';return;}
  if(!email||!email.includes('@')){errEl.textContent='Please enter a valid email.';errEl.style.display='block';return;}
  if(pass.length<6){errEl.textContent='Password must be at least 6 characters.';errEl.style.display='block';return;}

  // Validate invite code
  if(!_cpInviteCode.startsWith('DC-')){errEl.textContent='Invalid invite link. Please ask DroneHub for a new invite.';errEl.style.display='block';return;}

  // Find or match client record
  let clientId=_cpInviteClientId;
  if(!clientId){
    // Try to match by email
    const matched=clients.find(c=>(c.email||'').toLowerCase()===email);
    if(matched) clientId=matched.id;
  }

  // Create/update portal account
  const accounts=getPortalAccounts();
  const existingIdx=accounts.findIndex(a=>a.clientId===clientId || (a.email||'').toLowerCase()===email);
  const _cpHash=await hashPass(email,pass);
  const entry={
    clientId: clientId||('cp_'+Date.now()),
    email,
    name,
    passHash: _cpHash,
    inviteCode: _cpInviteCode,
    createdAt: new Date().toISOString().slice(0,10),
    status: 'active',
  };
  if(existingIdx>=0) accounts[existingIdx]=entry;
  else accounts.push(entry);
  savePortalAccounts(accounts);

  // Also update client record email if missing — save to both localStorage AND Firebase
  if(clientId){
    const cIdx=clients.findIndex(c=>c.id===clientId);
    if(cIdx>=0 && !clients[cIdx].email){
      clients[cIdx].email=email;
      saveClientsToStorage(); // strict write with retry + toast on failure
    }
  }

  // Add to gate_users so gateInit recognises them as client type
  const gUsers=gateGetUsers();
  if(!gUsers.find(u=>u.email.toLowerCase()===email)){
    gUsers.push({email,name,role:'client',type:'client',passHash:_cpHash,clientId:clientId||entry.clientId,createdAt:entry.createdAt});
    gateSaveUsers(gUsers);
  }

  // Log them in immediately and persist session
  const resolvedClientId=clientId||entry.clientId;
  cpActiveClientId=resolvedClientId;
  try{sessionStorage.setItem('dronehub_cp_session',JSON.stringify({clientId:resolvedClientId,email,name}));}catch(e){}
  document.getElementById('cp-login').style.display='none';
  document.getElementById('cp-dashboard').style.display='block';
  document.getElementById('cp-welcome-name').textContent=name;
  cpShowTab('overview');
}

// Generate a unique invite code for a client
function cpGenerateInviteCode(){
  return 'DC-'+Math.random().toString(36).slice(2,6).toUpperCase()+'-'+Math.random().toString(36).slice(2,6).toUpperCase();
}

// Copy invite link to clipboard for a specific client
function cpCopyInviteLink(clientId){
  const accounts=getPortalAccounts();
  let acct=accounts.find(a=>a.clientId===clientId);
  let code;
  if(acct?.inviteCode) {
    code=acct.inviteCode;
  } else {
    code=cpGenerateInviteCode();
    // Save the code
    if(acct){ acct.inviteCode=code; }
    else { accounts.push({clientId,inviteCode:code,createdAt:new Date().toISOString().slice(0,10),status:'invited'}); }
    savePortalAccounts(accounts);
  }
  const base=window.location.origin+window.location.pathname;
  const link=`${base}?portal=client&invite=${code}&cid=${clientId}`;
  navigator.clipboard.writeText(link).then(()=>{
    const btn=document.getElementById('cp-invite-btn-'+clientId);
    if(btn){const orig=btn.textContent;btn.textContent='✓ Copied!';btn.style.color='var(--green)';setTimeout(()=>{btn.textContent=orig;btn.style.color='';},2000);}
  }).catch(()=>{
    prompt('Copy this invite link:', link);
  });
}

// Send client portal invite email automatically via EmailJS
function cpEmailInvite(clientId, btnEl){
  const c=clients.find(cl=>cl.id===clientId);
  const clientEmail=(c?.email||'').trim();
  if(!c){alert('Client record not found.');return;}
  if(!clientEmail){
    alert('No email address on file for '+c.name+'. Please add one in their client record first.');
    return;
  }

  // Generate or reuse invite code
  const accounts=getPortalAccounts();
  let acct=accounts.find(a=>a.clientId===clientId);
  let code;
  if(acct?.inviteCode){ code=acct.inviteCode; }
  else {
    code=cpGenerateInviteCode();
    if(acct){ acct.inviteCode=code; acct.status='invited'; }
    else { accounts.push({clientId,email:clientEmail,inviteCode:code,createdAt:new Date().toISOString().slice(0,10),status:'invited'}); }
    savePortalAccounts(accounts);
  }

  const base=window.location.origin+window.location.pathname;
  const link=`${base}?portal=client&invite=${code}&cid=${clientId}`;
  const firstName=c.name.split(' ')[0];
  const bname=bizSettings?.name||'DroneHub Media';

  if(typeof emailjs==='undefined'){
    alert('EmailJS not loaded. Please refresh and try again.');
    return;
  }

  // Button state → Sending
  if(btnEl){btnEl.textContent='Sending…';btnEl.disabled=true;}

  // Use the dedicated client invite template (create in EmailJS with these params:
  //   to_email, to_name, invite_link, company_name)
  // Falls back gracefully if template fields differ
  emailjs.send('service_f0gwd3p','template_5demfu7',{
    to_email: clientEmail,
    to_name:  firstName,
    invite_link: link,
    company_name: bname,
  },'Ch7hmj99uF1tLKhMj').then(()=>{
    if(btnEl){btnEl.textContent='✓ Sent!';btnEl.style.color='var(--green)';btnEl.style.borderColor='rgba(34,217,122,.4)';}
    setTimeout(()=>{
      if(btnEl){btnEl.textContent='Send Email Invite';btnEl.disabled=false;btnEl.style.color='';btnEl.style.borderColor='';}
    },3000);
  }).catch(err=>{
    console.error('EmailJS client invite error:',err);
    if(btnEl){btnEl.textContent='Failed — retry';btnEl.disabled=false;btnEl.style.color='var(--red)';}
    setTimeout(()=>{if(btnEl){btnEl.textContent='Send Email Invite';btnEl.style.color='';}},4000);
    // Show the link so it can be copied manually if needed
    prompt('Email failed — copy this link and send manually:', link);
  });
}

async function cpLogin(){
  const email=document.getElementById('cp-login-email').value.trim().toLowerCase();
  const pass=document.getElementById('cp-login-pass').value;
  const errEl=document.getElementById('cp-login-error');
  if(!email||!pass){errEl.textContent='Please enter your email and password.';errEl.style.display='block';return;}
  const _cpL2Lock=checkRateLimit('cp2:'+email);
  if(_cpL2Lock){errEl.textContent=_cpL2Lock;errEl.style.display='block';return;}

  // Look up directly in portal accounts — don't require a matching client record
  const accounts=getPortalAccounts();
  const account=accounts.find(a=>(a.email||'').toLowerCase()===email);
  if(!account||!account.passHash){errEl.textContent='No account found for that email. Please use your invite link to set up access.';errEl.style.display='block';return;}
  const _cpL2Ok=await verifyPass(email,pass,account.passHash);
  if(!_cpL2Ok){
    recordLoginFailure('cp2:'+email);
    errEl.textContent=checkRateLimit('cp2:'+email)||'Incorrect password.';
    errEl.style.display='block';return;
  }
  // Migrate legacy hash
  if(account.passHash&&!account.passHash.startsWith(_HASH_PREFIX)){
    const _h2=await hashPass(email,pass);account.passHash=_h2;
    const _aa=getPortalAccounts();const _ai=_aa.findIndex(a=>(a.email||'').toLowerCase()===email);
    if(_ai>=0){_aa[_ai].passHash=_h2;try{localStorage.setItem('dronehub_portal_accounts',JSON.stringify(_aa));}catch(e){}}
  }
  clearLoginFailures('cp2:'+email);

  // Success
  cpActiveClientId=account.clientId;
  const displayName=account.name||email.split('@')[0];
  document.getElementById('cp-login').style.display='none';
  document.getElementById('cp-dashboard').style.display='block';
  document.getElementById('cp-welcome-name').textContent=displayName;
  // Persist session so page refresh doesn't log client out
  try{sessionStorage.setItem('dronehub_cp_session',JSON.stringify({clientId:account.clientId,email,name:displayName}));}catch(e){}
  cpShowTab('overview');
}

// ── Client portal sidebar (ops-style) ────────────────────────────────────────
const CP_NAV=[
  {tab:'overview',  label:'Overview',    icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>'},
  {tab:'production',label:'My Videos',   icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>'},
  {tab:'projects',  label:'All Jobs',    icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>'},
  {tab:'invoices',  label:'Invoices',    icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>'},
  {tab:'spending',  label:'Spending',    icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>'},
  {tab:'files',     label:'Files',       icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'},
  {tab:'messages',  label:'LouChat',     icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'},
  {tab:'social',    label:'Social',      icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>'},
  {tab:'booking',   label:'Book a Shoot',icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'},
  {tab:'profile',   label:'My Profile',  icon:'<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'},
];

function cpRenderSidebar(activeTab){
  const navEl=document.getElementById('cp-gnav-items');
  if(!navEl) return;
  const acct=getPortalAccounts().find(a=>a.clientId===cpActiveClientId)||{};
  const c=clients.find(cl=>cl.id===cpActiveClientId)||{};
  const name=c.name||acct.name||'Client';
  const email=c.email||acct.email||'';
  const aw=document.getElementById('cp-gnav-avatar-wrap');
  if(aw) aw.innerHTML=typeof getAvatarHtml==='function'?getAvatarHtml(name,email,36,12):'';
  const un=document.getElementById('cp-gnav-username');
  if(un) un.textContent=name;
  const ut=document.getElementById('cp-gnav-usertitle');
  if(ut) ut.textContent=c.company||'Client Portal';
  // Profile lives on the avatar button (like the ops app) — not in the item list
  navEl.innerHTML=CP_NAV.filter(n=>n.tab!=='profile').map(n=>`
    <button onclick="cpShowTab('${n.tab}')" class="app-gnav-item${n.tab===activeTab?' active':''}">${n.icon}<span class="app-gnav-label">${n.label}</span></button>`).join('');
}

function cpProfilePhotoSelected(input){
  const file=input.files&&input.files[0];
  if(!file) return;
  const c=clients.find(cl=>cl.id===cpActiveClientId);
  const email=c?.email;
  if(!email){try{showDhToast('No email on file','Ask DroneHub to add your email first','⚠','var(--orange)',4000);}catch(e){}return;}
  const reader=new FileReader();
  reader.onload=async()=>{
    try{
      await saveProfilePhoto(email,reader.result);
      try{showDhToast('Photo updated','','check','var(--green)',2500);}catch(e){}
      cpShowTab('profile');
    }catch(err){
      try{showDhToast('Upload failed',err.message||'Try a smaller image','⚠','var(--orange)',4000);}catch(e){}
    }
  };
  reader.readAsDataURL(file);
}

function cpSaveClientProfile(){
  const c=clients.find(cl=>cl.id===cpActiveClientId);
  if(!c){try{showDhToast('Profile not found','Ask DroneHub to link your account','⚠','var(--orange)',4000);}catch(e){}return;}
  c.company=document.getElementById('cp-pf-company')?.value.trim()||c.company||'';
  c.phone=document.getElementById('cp-pf-phone')?.value.trim()||'';
  c.address=document.getElementById('cp-pf-address')?.value.trim()||'';
  saveClientsToStorage();
  try{showDhToast('Profile saved','','check','var(--green)',2500);}catch(e){}
  cpRenderSidebar('profile');
}

function cpLogout(){
  cpActiveClientId=null;
  try{sessionStorage.removeItem('dronehub_cp_session');}catch(e){}
  document.getElementById('cp-dashboard').style.display='none';
  document.getElementById('cp-login').style.display='flex';
  document.getElementById('cp-login-pass').value='';
}

async function cpShowTab(tab){
  // Only toggle tabs inside the client portal (not team portal which shares .cp-tab class)
  document.querySelectorAll('#cp-dashboard .cp-tab').forEach(t=>{
    t.classList.toggle('active', t.dataset.tab===tab);
  });
  cpRenderSidebar(tab);
  // LouChat is a full-bleed page like the ops app — every other tab keeps
  // the centered content column
  const _cpContentEl=document.getElementById('cp-content');
  if(_cpContentEl){
    if(tab==='messages'){_cpContentEl.style.maxWidth='none';_cpContentEl.style.padding='0';_cpContentEl.style.margin='0';}
    else if(tab==='files'){_cpContentEl.style.maxWidth='1440px';_cpContentEl.style.padding='24px 28px 60px';_cpContentEl.style.margin='0 auto';}
    else{_cpContentEl.style.maxWidth='900px';_cpContentEl.style.padding='24px 20px 60px';_cpContentEl.style.margin='0 auto';}
  }
  setTimeout(cpUpdateNotifBadge,100);
  // Fall back to portal account data if no matching client record exists
  const cpAcctFallback=getPortalAccounts().find(a=>a.clientId===cpActiveClientId)||{};
  const c=clients.find(cl=>cl.id===cpActiveClientId)||{
    id:cpActiveClientId,
    name:cpAcctFallback.name||'Client',
    email:cpAcctFallback.email||'',
    assets:[],
    address:'',
  };
  if(!c.id) return;
  const fmtN=n=>'$'+Number(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const cJobs=savedJobs.filter(j=>j.clientId===c.id).sort((a,b)=>b.date.localeCompare(a.date));
  const completed=cJobs.filter(j=>j.status==='completed');
  const revenue=completed.reduce((s,j)=>s+j.grand,0);
  const outstanding=cJobs.filter(j=>j.status==='confirmed'||j.status==='quoted');
  const assets=c.assets||[];
  let html='';

  if(tab==='overview'){
    const overdueCount=cJobs.filter(j=>getInvoiceStatus(j)==='overdue').length;
    html=`
      <div style="margin-bottom:20px">
        <div style="font-size:22px;font-weight:700;color:var(--white);margin-bottom:4px">Welcome back, ${c.name.split(' ')[0]}</div>
        <div style="font-size:13px;color:var(--muted)">Here's a summary of your projects with DroneHub Media</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px;margin-bottom:20px">
        <div class="metric"><div class="mlabel">Total projects</div><div class="mval">${cJobs.length}</div></div>
        <div class="metric"><div class="mlabel">Completed</div><div class="mval" style="color:var(--green)">${completed.length}</div></div>
        <div class="metric"><div class="mlabel">Total billed</div><div class="mval">${revenue>0?fmtN(revenue):'—'}</div></div>
        ${overdueCount?`<div class="metric" style="border-color:var(--red)"><div class="mlabel" style="color:var(--red)">Overdue invoices</div><div class="mval" style="color:var(--red)">${overdueCount}</div></div>`:''}
      </div>
      ${cJobs[0]?`<div class="card" style="margin-bottom:14px">
        <div class="section-label" style="margin-bottom:8px">Most recent project</div>
        <div style="font-size:14px;font-weight:600;color:var(--white)">${cJobs[0].name}</div>
        <div style="font-size:12px;color:var(--muted);margin-top:3px">${cJobs[0].date} · ${cJobs[0].address}</div>
        <span class="status-badge status-${cJobs[0].status||'quoted'}" style="margin-top:8px;display:inline-block">${cJobs[0].status||'quoted'}</span>
      </div>`:''}
      ${(()=>{
        const allDrafts=videoDraftsLoad();
        const draftsToReview=cJobs.filter(j=>{const vd=allDrafts.find(d=>d.jobId===j.id);if(!vd) return false;const last=vd.drafts&&vd.drafts.length?vd.drafts[vd.drafts.length-1]:null;return last&&(last.status==='awaiting_review'||vd.status==='awaiting_review');});
        const socialPosts=socialPostsLoad();
        const socialWorkspaces=socialWorkspacesLoad();
        const pendingSocial=socialPosts.filter(p=>{if(p.status!=='pending') return false;if(p.clientId===cpActiveClientId) return true;if(p.workspaceId){const ws=socialWorkspaces.find(w=>w.id===p.workspaceId);if(ws?.clientId===cpActiveClientId) return true;}return false;});
        const items=[];
        draftsToReview.forEach(j=>items.push({type:'draft',label:`Draft ready to review: ${j.name}`,action:`cpShowTab('production')`}));
        pendingSocial.forEach(p=>items.push({type:'social',label:`Post awaiting approval: ${p.address||p.title||'Post'}`,action:`cpShowTab('social')`}));
        if(!items.length) return '';
        return `<div style="background:rgba(124,58,237,.08);border:1px solid rgba(124,58,237,.3);border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:12px;font-weight:700;color:#A78BFA;margin-bottom:10px;display:flex;align-items:center;gap:7px"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg> ${items.length} action${items.length>1?'s':''} need your attention</div>
          ${items.map(it=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(124,58,237,.15);gap:10px">
            <div style="font-size:12px;color:var(--offwhite)">${it.label}</div>
            <button onclick="${it.action}" style="padding:5px 12px;border-radius:8px;border:1px solid rgba(124,58,237,.5);background:transparent;color:#A78BFA;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">View →</button>
          </div>`).join('')}
        </div>`;
      })()}
      <div class="card">
        <div class="section-label" style="margin-bottom:10px">Quick access</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button onclick="cpShowTab('production')" style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:12px;border:1px solid var(--purple);background:var(--purple-bg);color:#A78BFA;font-size:12px;font-weight:700;cursor:pointer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg> Video progress</button>
          <button onclick="cpShowTab('invoices')" style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:12px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg> View invoices</button>
          <button onclick="cpShowTab('files')" style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:12px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Download files</button>
          <button onclick="cpShowTab('messages')" style="display:inline-flex;align-items:center;gap:7px;padding:10px 18px;border-radius:12px;border:1px solid var(--amber);background:var(--amber-bg);color:var(--amber);font-size:12px;font-weight:700;cursor:pointer"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> LouChat</button>
        </div>
      </div>`;
  }
  else if(tab==='production'){
    const trackerJobs=cJobs.filter(j=>j.status==='confirmed'||j.status==='completed');
    const STATUS_STYLES2={
      ready:{label:'Getting started',color:'var(--blue-bright)',bg:'rgba(91,141,239,.12)'},
      footage_pending:{label:'Footage uploading',color:'var(--muted)',bg:'rgba(136,146,187,.1)'},
      draft1:{label:'First draft sent — please review',color:'var(--green)',bg:'rgba(34,217,122,.12)'},
      draft2:{label:'Second draft sent — please review',color:'var(--green)',bg:'rgba(34,217,122,.12)'},
      draft3:{label:'Third draft sent',color:'var(--amber)',bg:'rgba(245,166,35,.12)'},
      draft_plus:{label:'Additional revisions in progress',color:'var(--amber)',bg:'rgba(245,166,35,.12)'},
      finals_sent:{label:'✓ Finals ready to download!',color:'var(--green)',bg:'rgba(34,217,122,.18)'},
      in_progress:{label:'Currently editing',color:'var(--blue-bright)',bg:'rgba(91,141,239,.12)'},
      review:{label:'In final review',color:'#A78BFA',bg:'rgba(139,92,246,.12)'},
    };
    html=`<div class="card">
      <div class="section-label" style="margin-bottom:12px;display:flex;align-items:center;gap:6px">${_icon('clipboard',14)} Your video & photo progress</div>
      ${trackerJobs.length?trackerJobs.map(j=>{
        const ts=getTrackerStage(j.id);
        const ss=STATUS_STYLES2[ts.editStatus||'ready']||STATUS_STYLES2.ready;
        return `<div style="padding:14px 0;border-bottom:1px solid var(--border)">
          <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:4px">${j.name}</div>
          <div style="font-size:11px;color:var(--muted);margin-bottom:8px">${j.date}${j.address?' · '+j.address:''}</div>
          <div style="padding:8px 14px;border-radius:8px;background:${ss.bg};display:inline-block;margin-bottom:8px">
            <span style="font-size:12px;font-weight:700;color:${ss.color}">${ss.label}</span>
          </div>
          ${ts.completionDate?`<div style="font-size:11px;color:var(--muted);margin-bottom:6px">Estimated completion: ${ts.completionDate}</div>`:''}
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${(()=>{const DRAFT_STATUSES=['draft1','draft2','draft3','draft_plus','finals_sent'];if(DRAFT_STATUSES.includes(ts.editStatus||'')){const vd=videoDraftsLoad().find(d=>d.jobId===j.id);if(vd){const lastDraft=vd.drafts&&vd.drafts.length?vd.drafts[vd.drafts.length-1]:null;if(lastDraft&&(lastDraft.status==='awaiting_review'||lastDraft.status==='changes_requested'||vd.status==='awaiting_review'||vd.status==='changes_requested')){return `<button onclick="cpOpenDraftReview('${j.id}')" style="padding:6px 14px;border-radius:10px;border:1px solid #7C3AED;background:rgba(124,58,237,.15);color:#A78BFA;font-size:12px;font-weight:700;cursor:pointer;animation:pulse 2s infinite">▶ Review Draft</button>`;}}};return '';})()}
            ${ts.frameioLink?`<a href="${ts.frameioLink}" target="_blank" style="padding:6px 14px;border-radius:10px;border:1px solid var(--purple);background:var(--purple-bg);color:#A78BFA;font-size:12px;font-weight:700;text-decoration:none">Review & give feedback on Frame.io</a>`:''}
            ${ts.downloadLink?`<a href="${ts.downloadLink}" target="_blank" style="padding:6px 14px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;text-decoration:none">↓ Download your finals</a>`:''}
          </div>
        </div>`;
      }).join('')
      :'<div style="color:var(--muted);font-size:12px;padding:12px 0">No projects in production yet.</div>'}
    </div>`;
  }
  else if(tab==='spending'){
    const isUSAClient=_getClientCountryKey(c)==='usa'
      ||cJobs.some(j=>j.market&&j.market!=='canada')
      ||(c.currency||'').toLowerCase()==='usd'
      ||cJobs.some(j=>(j.currency||'').toLowerCase()==='usd');
    const byYear={};
    cJobs.filter(j=>j.status==='completed'||j.status==='confirmed').forEach(j=>{
      const yr=j.date?.slice(0,4)||'Unknown';
      if(!byYear[yr]) byYear[yr]={jobs:[],total:0,hst:0};
      byYear[yr].jobs.push(j);
      byYear[yr].total+=j.grand;
      if((j.currency||'cad').toLowerCase()==='cad') byYear[yr].hst+=j.grand*0.13;
    });
    const years=Object.keys(byYear).sort().reverse();
    const grandTotal=Object.values(byYear).reduce((s,y)=>s+y.total,0);
    html=`<div>
      <div class="card" style="margin-bottom:14px">
        <div class="section-label" style="margin-bottom:10px;display:flex;align-items:center;gap:6px">${_icon('dollar',14)} Your spending with DroneHub</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin-bottom:12px">
          <div class="metric"><div class="mlabel">Total spent</div><div class="mval" style="color:var(--green)">${fmtN(grandTotal)}</div></div>
          ${isUSAClient?'':`<div class="metric"><div class="mlabel">Est. HST paid</div><div class="mval">${fmtN(grandTotal*0.13)}</div></div>`}
          <div class="metric"><div class="mlabel">Total projects</div><div class="mval">${completed.length}</div></div>
        </div>
        ${isUSAClient?'':`<div style="font-size:11px;color:var(--muted);padding:8px 12px;background:var(--navy-lift);border-radius:8px;border:1px solid var(--border)">
          This breakdown is provided for your records. HST estimates are based on 13% and may vary — please refer to your individual invoices for exact amounts. You can print or screenshot any year for your tax records.
        </div>`}
      </div>
      ${years.map(yr=>{
        const y=byYear[yr];
        return `<div class="card" style="margin-bottom:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div style="font-size:14px;font-weight:700;color:var(--white)">${yr}</div>
            <div style="text-align:right">
              <div style="font-size:14px;font-weight:700;color:var(--green)">${fmtN(y.total)}</div>
              ${isUSAClient?'':`<div style="font-size:10px;color:var(--muted)">HST est: ${fmtN(y.hst)}</div>`}
            </div>
          </div>
          ${y.jobs.map(j=>`
            <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.04);font-size:12px">
              <div><span style="color:var(--offwhite)">${j.name}</span><span style="color:var(--muted);font-size:10px;margin-left:8px">${j.date}</span></div>
              <div><span style="color:var(--green);font-weight:600">${fmtN(j.grand)}</span></div>
            </div>`).join('')}
        </div>`;
      }).join('')||'<div class="card"><div style="color:var(--muted);font-size:12px">No spending history yet.</div></div>'}
    </div>`;
  }
  else if(tab==='projects'){
    html=`<div class="card">
      <div class="section-label" style="margin-bottom:14px">Your projects</div>
      ${cJobs.length?cJobs.map(j=>{
        const svcsStr=Object.entries(j.services||{}).filter(([k,v])=>v).map(([k])=>({video:'Video',photo:'Photo',reel:'Social reels',extphoto:'Ext. photo',extvideo:'Ext. video',floorplan:'Floor plan',rush:'Rush',tvideo:'Twilight video',tphoto:'Twilight photo',custom:j.customDesc||'Custom'}[k]||k)).filter(Boolean).join(' · ');
        return `<div style="padding:14px 0;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700;color:var(--white)">${j.name}</div>
              <div style="font-size:12px;color:var(--muted);margin-top:3px"> ${j.address}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${j.date}${j.shootTime?' at '+j.shootTime:''}</div>
              ${svcsStr?`<div style="font-size:11px;color:var(--blue-bright);margin-top:4px">${svcsStr}</div>`:''}
              ${j.notes?`<div style="font-size:11px;color:var(--muted);font-style:italic;margin-top:4px">${j.notes}</div>`:''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <span class="status-badge status-${j.status||'quoted'}" style="display:block;margin-bottom:6px">${j.status||'quoted'}</span>
              <span style="font-size:14px;font-weight:700;color:var(--green)">${fmtN(j.grand)}</span>
            </div>
          </div>
        </div>`;
      }).join('')
      :'<div style="color:var(--muted);font-size:13px;padding:12px 0">No projects yet.</div>'}
    </div>`;
  }
  else if(tab==='invoices'){
    const inv=cJobs.filter(j=>j.status==='confirmed'||j.status==='completed');
    const paid=inv.filter(j=>getInvoiceStatus(j)==='paid');
    const unpaid=inv.filter(j=>getInvoiceStatus(j)!=='paid');
    html=`<div>
      ${unpaid.length?`<div style="font-size:11px;font-weight:700;color:var(--blue-bright);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px">Outstanding (${unpaid.length})</div>
      ${unpaid.map(j=>{
        const st=getInvoiceStatus(j);
        const {owed,interest,daysOverdue}=calcCurrentOwed(j);
        const refDate=j.invoicedAt?new Date(j.invoicedAt):new Date(j.date||Date.now());
        const dueDate=new Date(refDate); dueDate.setDate(dueDate.getDate()+30);
        const amtDue=st==='overdue'?owed:j.grand;
        const stBadge=st==='overdue'
          ?`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:var(--red-bg);color:var(--red)">OVERDUE ${daysOverdue}d</span>`
          :`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:var(--amber-bg);color:var(--amber)">OUTSTANDING</span>`;
        return `<div class="card" style="margin-bottom:12px;border:1px solid ${st==='overdue'?'rgba(240,82,82,.3)':'rgba(245,166,35,.2)'}">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:12px">
            <div style="flex:1">
              <div style="font-size:14px;font-weight:700;color:var(--white);margin-bottom:3px">${j.name}</div>
              <div style="font-size:11px;color:var(--muted)">${j.address||''}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:3px">Shoot: ${j.date} · Due: ${dueDate.toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'})}</div>
              ${j.invNum?`<div style="font-size:10px;color:var(--muted);margin-top:2px;font-weight:600;letter-spacing:.04em">INV# ${j.invNum}</div>`:''}
              ${st==='overdue'&&interest>0?`<div style="font-size:11px;color:var(--red);margin-top:5px;font-weight:600">⚠ ${fmtN(interest)} in late interest charges</div>`:''}
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="margin-bottom:6px">${stBadge}</div>
              <div style="font-size:18px;font-weight:800;color:${st==='overdue'?'var(--red)':'var(--amber)'}">${fmtN(amtDue)}</div>
            </div>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button onclick="cpViewInvoice('${j.id}')" style="flex:1;min-width:120px;padding:9px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-1px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> View Invoice
            </button>
            <button onclick="openStripeCheckout(${amtDue},'${j.invNum||''}','${c.email||''}','${j.currency||'cad'}',${j.id})" style="flex:1;min-width:120px;padding:9px;border-radius:10px;background:linear-gradient(135deg,#635BFF,#4B44D8);color:#fff;font-size:12px;font-weight:700;border:none;cursor:pointer;font-family:var(--font)">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pay now — ${fmtN(amtDue)}
            </button>
          </div>
        </div>`;
      }).join('')}`:''}
      ${paid.length?`<div style="font-size:11px;font-weight:700;color:var(--muted);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;margin-top:${unpaid.length?'20':'0'}px">Paid (${paid.length})</div>
      ${paid.map(j=>{
        const refDate=j.invoicedAt?new Date(j.invoicedAt):new Date(j.date||Date.now());
        return `<div class="card" style="margin-bottom:10px;opacity:.85">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
            <div style="flex:1">
              <div style="font-size:13px;font-weight:600;color:var(--white)">${j.name}</div>
              <div style="font-size:11px;color:var(--muted);margin-top:2px">${j.date}${j.invNum?' · INV# '+j.invNum:''}</div>
            </div>
            <div style="display:flex;align-items:center;gap:10px">
              <div style="font-size:14px;font-weight:700;color:var(--green)">${fmtN(j.grand)}</div>
              <span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:var(--green-bg);color:var(--green)">PAID</span>
            </div>
          </div>
          <button onclick="cpViewInvoice('${j.id}')" style="margin-top:10px;padding:7px 16px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer;font-family:var(--font)">
            View receipt
          </button>
        </div>`;
      }).join('')}`:''}
      ${!inv.length?`<div class="card" style="text-align:center;padding:40px">
        <div style="font-size:13px;color:var(--muted)">No invoices yet — they'll appear here once your first project is invoiced.</div>
      </div>`:''}
    </div>`;
  }
  else if(tab==='files'){
    const driveJobsCP=cJobs.filter(j=>j.driveLink).sort((a,b)=>b.date.localeCompare(a.date));
    const SVC_ICONS_CP={video:'',photo:'',tvideo:'',tphoto:'',reel:'',extphoto:'',extvideo:'',floorplan:''};
    const jobTagsCP=j=>Object.entries(j.services||{}).filter(([k,v])=>v&&SVC_ICONS_CP[k]).map(([k])=>SVC_ICONS_CP[k]).join(' ');
    // The linked-projects grid supersedes the legacy driveLink list — only
    // show the old card when there are no linked projects
    const _cpHasProjects=((c.driveProjects||[]).length)>0;
    html=`
      ${typeof cdProjectsSectionHtml==='function'?cdProjectsSectionHtml(cpActiveClientId,true):''}
      ${_cpHasProjects?'':`<div class="card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;flex-wrap:wrap">
          <svg width="20" height="18" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg"><path d="M6.6 66.85l3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3L27.5 53H0c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/><path d="M43.65 25L29.9 0c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47"/><path d="M73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5H59.8l5.85 11.5z" fill="#ea4335"/><path d="M43.65 25L57.4 0H13.9c-1.55 0-3.1.4-4.5 1.2z" fill="#00832d"/><path d="M59.8 53H27.5L13.75 76.8h49.8z" fill="#2684fc"/><path d="M73.4 26.5c-.8-1.4-1.95-2.5-3.3-3.3L56.3 0H43.65l16.15 28z" fill="#ffba00"/></svg>
          <div>
            <div style="font-size:14px;font-weight:700;color:var(--white)">Your Files</div>
            <div style="font-size:11px;color:var(--muted)">Click any property to open your deliverables in Google Drive</div>
          </div>
        </div>
        ${driveJobsCP.length?`
        <input type="text" id="cp-drive-search" placeholder="Search by address…" oninput="filterCPDriveFiles()"
          style="width:100%;box-sizing:border-box;padding:9px 14px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);margin-bottom:12px">
        <div id="cp-drive-list">
          ${driveJobsCP.map(j=>`
          <div class="cp-drive-row" data-addr="${(j.address||'').toLowerCase()}" data-name="${(j.name||'').toLowerCase()}"
            style="display:flex;justify-content:space-between;align-items:center;padding:12px 14px;background:var(--navy-lift);border-radius:10px;margin-bottom:8px;border:1px solid var(--border);gap:10px;flex-wrap:wrap">
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${j.address||j.name}</div>
              <div style="font-size:11px;color:var(--muted)">${j.date}${jobTagsCP(j)?' · '+jobTagsCP(j):''}</div>
            </div>
            <a href="${j.driveLink}" target="_blank" rel="noopener"
              style="display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;border:none;background:linear-gradient(135deg,#0066da,#00ac47);color:#fff;font-size:13px;font-weight:700;text-decoration:none;white-space:nowrap;flex-shrink:0">
              Open Files ↗
            </a>
          </div>`).join('')}
        </div>
        <div id="cp-drive-no-results" style="display:none;text-align:center;padding:16px;color:var(--muted);font-size:12px">No properties match your search</div>
        `:`<div style="text-align:center;padding:28px 20px;color:var(--muted);font-size:13px;line-height:1.8">
          <div style="margin-bottom:8px;color:var(--muted)">${_icon('folder',28)}</div>
          Your deliverables will appear here as each project is completed.<br>
          <span style="font-size:12px">We'll send you a message in LouChat when files are ready.</span>
        </div>`}
      </div>`}
      ${assets.length?`<div class="card">
        <div class="section-label" style="margin-bottom:12px">Additional files</div>
        ${assets.map(a=>`<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--border);gap:10px">
          <div>
            <div style="font-size:13px;font-weight:600;color:var(--white)">${a.name}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${a.type||'File'} · ${a.addedAt||''}</div>
          </div>
          ${a.url?`<a href="${a.url}" target="_blank" style="padding:7px 16px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;text-decoration:none;white-space:nowrap">↓ Download</a>`:'<span style="font-size:11px;color:var(--muted)">Link pending</span>'}
        </div>`).join('')}
      </div>`:''}
    `;
  }
  else if(tab==='messages'){
    if(!window._cpChatTo) window._cpChatTo='team';
    const allMsgs=await dhDecryptMsgs(getPortalMessages(c.id));
    // Clients can only DM company admins — not contractors/creators
    const admins=getAdminTeamMembers().filter(m=>m.name&&m.role==='admin');
    const activeTo=window._cpChatTo;
    const cpMyName=c.name||'You';
    const cpMyEmail=c.email||'';
    // Conversation list: Team channel + one DM per admin
    const convos=[{key:'team',name:'DroneHub Media',sub:'The whole team',email:'',section:'team'}]
      .concat(admins.map(m=>({key:m.name,name:m.name,sub:m.title||m.role||'Admin',email:m.email||'',section:'dm'})));
    const lastMsgFor=key=>{
      const list=allMsgs.filter(m=>m.from!=='seen'&&(m.to||'team')===key);
      return list.length?list[list.length-1]:null;
    };
    const threadMsgs=allMsgs.filter(m=>m.from!=='seen'&&(m.to||'team')===(activeTo));
    const activeConvo=convos.find(cv=>cv.key===activeTo)||convos[0];
    const teamIcon=(s)=>`<div style="width:${s}px;height:${s}px;border-radius:50%;background:rgba(91,141,239,.2);border:1.5px solid rgba(91,141,239,.4);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:${Math.round(s*0.34)}px;font-weight:800;color:var(--blue-bright)">DH</div>`;
    const convoAvatar=(cv,s)=>cv.key==='team'?teamIcon(s):(typeof getAvatarHtml==='function'?getAvatarHtml(cv.name,cv.email,s,Math.round(s*0.33)):'');
    const authorEmail=name=>name===cpMyName?cpMyEmail:((admins.find(a=>a.name===name)||{}).email||'');

    // ── Sidebar rows — same look as the ops channel list ──
    const convoRow=cv=>{
      const last=lastMsgFor(cv.key);
      const on=cv.key===activeTo;
      const preview=last?((last.from==='client'?'You: ':'')+(last.text||'').replace(/<[^>]+>/g,'').slice(0,55)):cv.sub;
      const lastTime=last?new Date(last.ts).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'';
      return `<div onclick="window._cpChatTo='${cv.key.replace(/'/g,"\\'")}';cpShowTab('messages')" style="padding:10px 14px;cursor:pointer;display:flex;align-items:center;gap:12px;background:${on?'rgba(91,141,239,.1)':'transparent'};border-bottom:1px solid rgba(255,255,255,.04);transition:background .12s;-webkit-tap-highlight-color:transparent" onmouseover="if(!${on})this.style.background='rgba(255,255,255,.04)'" onmouseout="this.style.background='${on?'rgba(91,141,239,.1)':'transparent'}'">
        <div style="width:46px;height:46px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden">${convoAvatar(cv,46)}</div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:baseline;justify-content:space-between;gap:6px">
            <span style="font-size:13px;font-weight:700;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${cv.name}</span>
            ${lastTime?`<span style="font-size:10px;color:var(--muted);flex-shrink:0">${lastTime}</span>`:''}
          </div>
          <div style="font-size:11px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">${preview}</div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0"><polyline points="9 18 15 12 9 6"/></svg>
      </div>`;
    };
    const sectionHdr=(icon,label)=>`<div style="padding:10px 12px 4px;font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;display:flex;align-items:center;gap:5px"><span style="display:flex;align-items:center;color:var(--muted)">${icon}</span> ${label}</div>`;

    // ── Thread messages — flat rows with day dividers, exactly like ops ──
    let threadHtml='';
    if(threadMsgs.length){
      let prevAuthor='',prevTime=0;
      threadMsgs.forEach((m,i)=>{
        const author=m.from==='client'?cpMyName:(m.by||activeConvo.name||'DroneHub Media');
        const d=new Date(m.ts);
        const timeStr=d.toLocaleTimeString('en-CA',{hour:'2-digit',minute:'2-digit'});
        const dateStr=d.toLocaleDateString('en-CA',{month:'short',day:'numeric'});
        const isToday=new Date().toDateString()===d.toDateString();
        const collapsed=(author===prevAuthor)&&(d.getTime()-prevTime<5*60*1000)&&(i>0);
        if(i===0||(new Date(threadMsgs[i-1].ts).toDateString()!==d.toDateString())){
          threadHtml+=`<div style="display:flex;align-items:center;gap:10px;margin:16px 0 8px">
            <div style="flex:1;height:1px;background:var(--border)"></div>
            <div style="font-size:11px;color:var(--muted);font-weight:600;white-space:nowrap">${isToday?'Today':dateStr}</div>
            <div style="flex:1;height:1px;background:var(--border)"></div>
          </div>`;
        }
        if(!collapsed){
          threadHtml+=`<div style="display:flex;gap:10px;padding:6px 0;margin-top:4px;position:relative" onmouseover="this.querySelector('.cp-ts').style.opacity=1" onmouseout="this.querySelector('.cp-ts').style.opacity=0">
            ${typeof getAvatarHtml==='function'?getAvatarHtml(author,authorEmail(author),36,12):''}
            <div style="flex:1;min-width:0">
              <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:3px">
                <span style="font-size:13px;font-weight:700;color:var(--white)">${author}</span>
                <span class="cp-ts" style="font-size:10px;color:var(--muted);opacity:0;transition:opacity .15s">${isToday?timeStr:dateStr+' '+timeStr}</span>
              </div>
              <div style="font-size:13px;color:var(--offwhite);line-height:1.55;word-break:break-word">${m.text}</div>
            </div>
          </div>`;
        } else {
          threadHtml+=`<div style="padding:1px 0 1px 46px;display:flex;align-items:baseline;gap:8px;position:relative" onmouseover="this.querySelector('.cp-ts2').style.opacity=1" onmouseout="this.querySelector('.cp-ts2').style.opacity=0">
            <span class="cp-ts2" style="font-size:9px;color:var(--muted);opacity:0;transition:opacity .15s;min-width:38px;text-align:right;position:absolute;left:0">${timeStr}</span>
            <div style="flex:1;min-width:0">
              <div style="font-size:13px;color:var(--offwhite);line-height:1.55;word-break:break-word">${m.text}</div>
            </div>
          </div>`;
        }
        prevAuthor=author;prevTime=d.getTime();
      });
    } else {
      threadHtml=`<div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:40px;text-align:center">
        <div style="margin-bottom:12px;color:var(--blue-bright);display:flex;justify-content:center;opacity:.5">${_icon('chat',28)}</div>
        <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:6px">${activeConvo.key==='team'?'Welcome to #dronehub-media':'Message '+activeConvo.name}</div>
        <div style="font-size:13px;color:var(--muted)">${activeConvo.key==='team'?'This conversation reaches the whole team.':'Direct line to '+activeConvo.name.split(' ')[0]+' — we usually reply within the business day.'}</div>
      </div>`;
    }

    html=`<div style="display:flex;height:calc(100vh - 58px);overflow:hidden">

        <!-- Conversation list -->
        <div style="width:380px;flex-shrink:0;border-right:1px solid var(--border);background:var(--navy-card);display:flex;flex-direction:column">
          <div style="padding:16px 18px;border-bottom:1px solid var(--border)">
            <div style="font-size:16px;font-weight:800;color:var(--white);display:flex;align-items:center;gap:8px">${_icon('chat',16)} LouChat</div>
            <div style="font-size:12px;color:var(--muted);margin-top:2px">DroneHub Media</div>
          </div>
          <div style="flex:1;overflow-y:auto">
            ${sectionHdr(_icon('chat',12),'Team')}
            ${convos.filter(cv=>cv.section==='team').map(convoRow).join('')}
            ${convos.some(cv=>cv.section==='dm')?sectionHdr('<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>','Direct Messages'):''}
            ${convos.filter(cv=>cv.section==='dm').map(convoRow).join('')}
          </div>
        </div>

        <!-- Thread -->
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;background:var(--navy)">
          <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;background:var(--navy)">
            ${convoAvatar(activeConvo,34)}
            <div style="flex:1;min-width:0">
              <div style="font-size:15px;font-weight:800;color:var(--white)">${activeConvo.key==='team'?'# dronehub-media':activeConvo.name}</div>
              <div style="font-size:11px;color:var(--muted)">${activeConvo.key==='team'?'Visible to the whole DroneHub team':'Direct message'}</div>
            </div>
            <div style="width:8px;height:8px;border-radius:50%;background:var(--green);box-shadow:0 0 6px var(--green)" title="Online"></div>
          </div>
          <div id="cp-messages-body" style="flex:1;overflow-y:auto;display:flex;flex-direction:column;padding:12px 20px">${threadHtml}</div>
          <div style="padding:10px 16px 12px;border-top:1px solid var(--border)">
            <div style="display:flex;align-items:flex-end;gap:8px;background:var(--navy-lift);border:1px solid var(--border-bright);border-radius:14px;padding:6px 8px 6px 14px">
              <textarea id="cp-msg-input" placeholder="Message ${activeConvo.key==='team'?'#dronehub-media':activeConvo.name.split(' ')[0]}…" rows="1"
                onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();cpSendMessage();}"
                oninput="this.style.height='auto';this.style.height=Math.min(this.scrollHeight,120)+'px';const _sb=document.getElementById('cp-send-btn');if(_sb)_sb.style.display=this.value.trim()?'flex':'none';"
                style="flex:1;background:transparent;border:none;color:var(--white);font-size:14px;font-family:var(--font);resize:none;outline:none;line-height:1.5;max-height:120px;padding:6px 0"></textarea>
              <button id="cp-send-btn" onclick="cpSendMessage()" title="Send" style="display:none;width:34px;height:34px;border-radius:50%;border:none;background:var(--blue);color:#fff;cursor:pointer;flex-shrink:0;align-items:center;justify-content:center;margin-bottom:1px">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2" fill="currentColor" stroke="none"/></svg>
              </button>
            </div>
          </div>
        </div>
    </div>`;
    // Scroll to bottom of messages after render
    setTimeout(()=>{const b=document.getElementById('cp-messages-body');if(b)b.scrollTop=b.scrollHeight;const i=document.getElementById('cp-msg-input');if(i)i.focus();},50);
  }
  else if(tab==='social'){
    const socialPosts=socialPostsLoad();
    const socialWorkspaces=socialWorkspacesLoad();
    const clientAddr=(c?.address||'').toLowerCase();
    const clientName=(c?.name||'').toLowerCase();
    const myPosts=socialPosts.filter(p=>{
      if(p.status==='draft') return false; // hide drafts from client
      // 1. Direct post→client link
      if(p.clientId && p.clientId===cpActiveClientId) return true;
      // 2. Workspace→client link (post inherits from its workspace)
      if(p.workspaceId){
        const ws=socialWorkspaces.find(w=>w.id===p.workspaceId);
        if(ws?.clientId && ws.clientId===cpActiveClientId) return true;
      }
      // 3. Address fuzzy-match fallback
      const addr=(p.address||'').toLowerCase();
      if(!addr) return false;
      const searchStr=clientAddr||clientName;
      if(!searchStr) return false;
      return addr.includes(searchStr.split(',')[0]) || searchStr.includes(addr.split(',')[0]);
    }).sort((a,b)=>(a.scheduledAt||'').localeCompare(b.scheduledAt||''));

    // View / filter state
    if(!window._cpSocialView)   window._cpSocialView='list';
    if(!window._cpSocialFilter) window._cpSocialFilter='all';
    if(!window._cpCalYear)  window._cpCalYear=new Date().getFullYear();
    if(!window._cpCalMonth) window._cpCalMonth=new Date().getMonth();

    const needsApproval=myPosts.filter(p=>p.status==='pending').length;

    const pendingBanner=needsApproval?`<div style="background:rgba(245,200,66,.1);border:1px solid rgba(245,200,66,.3);border-radius:12px;padding:12px 16px;margin-bottom:18px;display:flex;align-items:center;gap:10px;font-family:var(--font)">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C842" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
      <div>
        <div style="font-size:13px;font-weight:700;color:#F5C842">${needsApproval} post${needsApproval>1?'s':''} waiting for your approval</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Review and approve to keep your content calendar on track.</div>
      </div>
    </div>`:'';

    const viewToggle=`${typeof socialAnalyticsClientCardsHtml==='function'?socialAnalyticsClientCardsHtml(cpActiveClientId,true):''}<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
      <div style="font-size:18px;font-weight:700;color:var(--white)">Content Calendar</div>
      <div style="display:flex;background:var(--navy-lift);border-radius:10px;border:1px solid var(--border);overflow:hidden">
        <button onclick="window._cpSocialView='list';cpShowTab('social')" style="padding:7px 16px;border:none;background:${window._cpSocialView==='list'?'rgba(91,141,239,.2)':'transparent'};color:${window._cpSocialView==='list'?'var(--blue-bright)':'var(--muted)'};font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>List</button>
        <button onclick="window._cpSocialView='calendar';cpShowTab('social')" style="padding:7px 16px;border:none;background:${window._cpSocialView==='calendar'?'rgba(91,141,239,.2)':'transparent'};color:${window._cpSocialView==='calendar'?'var(--blue-bright)':'var(--muted)'};font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);display:flex;align-items:center;gap:5px"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Calendar</button>
      </div>
    </div>`;

    if(!myPosts.length){
      html=`<div>
        ${viewToggle}
        <div style="text-align:center;padding:60px 20px;color:var(--muted)">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.25" style="display:block;margin:0 auto 14px"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          <div style="font-size:15px;font-weight:700;color:var(--offwhite);margin-bottom:6px">No content yet</div>
          <div style="font-size:12px;line-height:1.7">Your content calendar will appear here once our team starts planning posts.</div>
        </div>
      </div>`;
    } else if(window._cpSocialView==='calendar'){
      // ── Calendar view ──────────────────────────────────────────────────
      const yr=window._cpCalYear;
      const mo=window._cpCalMonth;
      const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
      const firstDow=new Date(yr,mo,1).getDay();
      const days=new Date(yr,mo+1,0).getDate();
      const todayStr=new Date().toISOString().slice(0,10);
      let cellsHtml='';
      for(let i=0;i<firstDow;i++) cellsHtml+=`<div style="min-height:88px;border-radius:8px;background:var(--navy-lift);border:1px solid var(--border);opacity:.3"></div>`;
      for(let d=1;d<=days;d++){
        const ds=`${yr}-${String(mo+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
        const dp=myPosts.filter(p=>p.scheduledAt===ds);
        const isToday=ds===todayStr;
        cellsHtml+=`<div style="min-height:88px;padding:6px 5px 5px;border-radius:8px;border:1px solid ${isToday?'var(--blue)':'var(--border)'};background:${isToday?'rgba(91,141,239,.07)':'var(--navy-card)'};overflow:hidden;box-sizing:border-box">
          <div style="font-size:11px;font-weight:${isToday?'700':'500'};color:${isToday?'var(--blue-bright)':'var(--border-bright)'};margin-bottom:4px;text-align:right">${d}</div>
          ${dp.map(p=>{
            const st=SOCIAL_STATUSES.find(s=>s.id===p.status);
            const col=st?.color||'#7AABFF';
            const label=p.address||p.reelNumber||p.title||'Post';
            const isPending=p.status==='pending';
            return `<div onclick="cpOpenPost('${p.id}')" title="${label}" style="margin-bottom:3px;cursor:pointer;border-radius:5px;overflow:hidden;background:var(--navy-lift);border:1px solid ${col}30" onmouseenter="this.style.borderColor='${col}66'" onmouseleave="this.style.borderColor='${col}30'">
              <div style="height:2px;background:${col}"></div>
              <div style="padding:3px 5px">
                <div style="font-size:9px;font-weight:600;color:var(--white);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${label}</div>
                <div style="display:flex;align-items:center;gap:3px;margin-top:2px">
                  <span style="background:${col}22;color:${col};border-radius:6px;padding:1px 5px;font-size:8px;font-weight:700;white-space:nowrap">${isPending?'Review →':st?.label||''}</span>
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>`;
      }
      const total=Math.ceil((firstDow+days)/7)*7;
      for(let i=firstDow+days;i<total;i++) cellsHtml+=`<div style="min-height:88px;border-radius:8px;background:var(--navy-lift);border:1px solid var(--border);opacity:.3"></div>`;

      html=`<div>
        ${viewToggle}
        ${pendingBanner}
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <button onclick="window._cpCalMonth--;if(window._cpCalMonth<0){window._cpCalMonth=11;window._cpCalYear--;}cpShowTab('social')" style="padding:6px 16px;border-radius:16px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:13px;cursor:pointer;font-family:var(--font)">‹ Prev</button>
          <div style="font-size:15px;font-weight:700;color:var(--white);font-family:var(--font)">${monthNames[mo]} ${yr}</div>
          <button onclick="window._cpCalMonth++;if(window._cpCalMonth>11){window._cpCalMonth=0;window._cpCalYear++;}cpShowTab('social')" style="padding:6px 16px;border-radius:16px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:13px;cursor:pointer;font-family:var(--font)">Next ›</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px;margin-bottom:3px">
          ${['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>`<div style="text-align:center;font-size:10px;color:var(--muted);font-weight:700;padding:5px 2px;letter-spacing:.06em;font-family:var(--font)">${d}</div>`).join('')}
        </div>
        <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:3px">${cellsHtml}</div>
      </div>`;
    } else {
      // ── List view ──────────────────────────────────────────────────────
      const filter=window._cpSocialFilter;
      const filtered=filter==='all'?myPosts:myPosts.filter(p=>{
        if(filter==='needs_approval') return p.status==='pending';
        if(filter==='revision') return p.status==='revision';
        if(filter==='approved') return p.status==='approved'||p.status==='scheduled';
        if(filter==='published') return p.status==='published';
        return true;
      });

      // Platform icon helper
      const platIcon=id=>({instagram:'IG',facebook:'FB',tiktok:'TT',linkedin:'LI',twitter:'X'}[id]||'');

      // Group by month
      const byMonth={};
      filtered.forEach(p=>{
        const d=p.scheduledAt?p.scheduledAt.slice(0,7):'Unscheduled';
        if(!byMonth[d]) byMonth[d]=[];
        byMonth[d].push(p);
      });
      const monthKeys=Object.keys(byMonth).sort();

      const filterBtn=(key,label,count)=>`<button onclick="window._cpSocialFilter='${key}';cpShowTab('social')" style="padding:6px 14px;border-radius:20px;border:1px solid ${filter===key?'var(--blue)':'var(--border)'};background:${filter===key?'rgba(91,141,239,.15)':'transparent'};color:${filter===key?'var(--blue-bright)':'var(--muted)'};font-size:12px;font-weight:600;cursor:pointer;font-family:var(--font);display:inline-flex;align-items:center;gap:5px">${label}${count?` <span style="background:${filter===key?'var(--blue)':'var(--border-bright)'};color:#fff;border-radius:10px;padding:1px 7px;font-size:10px">${count}</span>`:''}</button>`;

      html=`<div>
        ${viewToggle}
        ${pendingBanner}
        <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:20px">
          ${filterBtn('all','All',myPosts.length)}
          ${filterBtn('needs_approval','Needs Approval',needsApproval)}
          ${filterBtn('revision','In Revision',myPosts.filter(p=>p.status==='revision').length)}
          ${filterBtn('approved','Approved / Scheduled',myPosts.filter(p=>p.status==='approved'||p.status==='scheduled').length)}
          ${filterBtn('published','Published',myPosts.filter(p=>p.status==='published').length)}
        </div>
        ${filtered.length===0?`<div style="text-align:center;padding:32px;color:var(--muted);font-size:13px">No posts in this category.</div>`:''}
        ${monthKeys.map(monthKey=>{
          const label=monthKey==='Unscheduled'?'Unscheduled':new Date(monthKey+'-15').toLocaleDateString('en-CA',{month:'long',year:'numeric'});
          return `<div style="margin-bottom:28px">
            <div style="font-size:11px;font-weight:700;color:var(--blue-bright);letter-spacing:.08em;text-transform:uppercase;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid var(--border)">${label}</div>
            ${byMonth[monthKey].map(p=>{
              const st=SOCIAL_STATUSES.find(s=>s.id===p.status)||{label:p.status,color:'#A8B4D0'};
              const plats=(p.platforms||[]).slice(0,3).map(pid=>platIcon(pid)).join(' ');
              const isPending=p.status==='pending';
              const isRevision=p.status==='revision';
              const comments=(p.clientComments||[]);
              const lastComment=comments[comments.length-1];
              const dateStr=p.scheduledAt?new Date(p.scheduledAt).toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric'}):'No date';
              return `<div style="background:var(--navy-card);border-radius:14px;border:1px solid ${isPending?'rgba(245,200,66,.3)':isRevision?'rgba(251,146,60,.3)':'var(--border)'};padding:16px;margin-bottom:10px;cursor:pointer" onclick="cpOpenPost('${p.id}')">
                <div style="display:flex;gap:12px;align-items:flex-start">
                  ${p.coverPhotoData?`<img src="${p.coverPhotoData}" alt="Post cover" style="width:52px;height:92px;object-fit:cover;border-radius:8px;flex-shrink:0;border:1px solid var(--border)">`:'<div style="width:52px;height:92px;border-radius:8px;background:linear-gradient(160deg,#833ab4,#fd1d1d,#fcb045);flex-shrink:0;display:flex;align-items:center;justify-content:center"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></div>'}
                  <div style="flex:1;min-width:0">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:10px">
                      <div style="flex:1">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:5px">
                          <span style="font-size:13px">${plats||''}</span>
                          <span style="font-size:11px;color:var(--muted)">${dateStr}</span>
                          ${p.format?`<span style="font-size:10px;padding:2px 8px;border-radius:8px;background:var(--navy-lift);color:var(--muted)">${SOCIAL_FORMATS.find(f=>f.id===p.format)?.label||p.format}</span>`:''}
                        </div>
                        <div style="font-size:13px;font-weight:600;color:var(--white);margin-bottom:4px">${p.address||p.title||'Post'}</div>
                        <div style="font-size:12px;color:var(--muted);line-height:1.5">${p.content?p.content.substring(0,140)+(p.content.length>140?'…':''):''}</div>
                        ${lastComment?`<div style="font-size:11px;color:var(--muted);margin-top:8px;padding:8px 10px;background:var(--navy-lift);border-radius:8px;border-left:3px solid ${lastComment.from==='client'?'var(--blue)':'var(--border-bright)'}">
                          <span style="font-weight:700;color:${lastComment.from==='client'?'var(--blue-bright)':'var(--muted)'}">${lastComment.from==='client'?'You':'DroneHub'}</span>: ${lastComment.text.substring(0,80)}${lastComment.text.length>80?'…':''}
                        </div>`:''}
                      </div>
                      <div style="flex-shrink:0;text-align:right">
                        <span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:${st.color}22;color:${st.color};display:block;margin-bottom:6px">${st.label}</span>
                        ${isPending?`<span style="font-size:10px;color:#F5C842;font-weight:600">Tap to review →</span>`:''}
                        ${isRevision?`<span style="font-size:10px;color:#FB923C;font-weight:600">In revision</span>`:''}
                      </div>
                    </div>
                  </div>
                </div>
              </div>`;
            }).join('')}
          </div>`;
        }).join('')}
      </div>`;
    }
  }
  else if(tab==='profile'){
    const acct=getPortalAccounts().find(a=>a.clientId===cpActiveClientId)||{};
    const pfName=c.name||acct.name||'Client';
    const pfEmail=c.email||acct.email||'';
    html=`
      <div class="card" style="margin-bottom:14px">
        <div style="display:flex;align-items:center;gap:18px;flex-wrap:wrap;margin-bottom:6px">
          <div style="position:relative">
            ${typeof getAvatarHtml==='function'?getAvatarHtml(pfName,pfEmail,84,26):''}
          </div>
          <div style="flex:1;min-width:200px">
            <div style="font-size:20px;font-weight:800;color:var(--white)">${pfName}</div>
            ${c.company?`<div style="font-size:13px;color:var(--muted);margin-top:2px">${c.company}</div>`:''}
            <label style="display:inline-flex;align-items:center;gap:6px;margin-top:10px;padding:7px 14px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
              Change photo
              <input type="file" accept="image/*" onchange="cpProfilePhotoSelected(this)" style="display:none">
            </label>
          </div>
        </div>
      </div>
      <div class="card">
        <div class="section-label" style="margin-bottom:14px">Contact Information</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:14px;margin-bottom:16px">
          <div>
            <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px">Name</label>
            <input value="${pfName}" disabled style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:var(--navy-mid);color:var(--muted)">
          </div>
          <div>
            <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px">Email (login)</label>
            <input value="${pfEmail}" disabled style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border);border-radius:10px;font-size:13px;background:var(--navy-mid);color:var(--muted)">
          </div>
          <div>
            <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px">Company / Brokerage</label>
            <input id="cp-pf-company" value="${c.company||''}" placeholder="Your company…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white)">
          </div>
          <div>
            <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px">Phone</label>
            <input id="cp-pf-phone" value="${c.phone||''}" placeholder="(555) 555-5555" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white)">
          </div>
          <div style="grid-column:1/-1">
            <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:5px">Office Address</label>
            <input id="cp-pf-address" value="${c.address||''}" placeholder="Street, city, state…" style="width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white)">
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end">
          <button onclick="cpSaveClientProfile()" style="padding:10px 24px;border-radius:12px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:13px;font-weight:700;cursor:pointer">Save changes</button>
        </div>
      </div>`;
  }
  else if(tab==='booking'){
    const myBookings=savedJobs.filter(j=>j.clientId===c.id).sort((a,b)=>b.date.localeCompare(a.date));
    const statusBadge=s=>s==='requested'?`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(245,166,35,.15);color:var(--amber)">REQUESTED</span>`
      :s==='confirmed'?`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(34,217,122,.12);color:var(--green)">CONFIRMED</span>`
      :s==='completed'?`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:rgba(91,141,239,.15);color:var(--blue-bright)">COMPLETED</span>`
      :`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:var(--navy-lift);color:var(--muted)">${s||'—'}</span>`;
    html=`<div>
      <div class="card" style="margin-bottom:18px">
        <div class="section-label" style="margin-bottom:14px;display:flex;align-items:center;gap:6px">${_icon('calendar',14)} Request a new shoot</div>
        <div style="margin-bottom:12px">
          <label style="font-size:11px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Property address</label>
          <input type="text" id="cp-book-address" placeholder="123 Main St, Oakville, ON" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:14px;background:var(--navy-lift);color:var(--white);font-family:var(--font)">
        </div>
        <div style="margin-bottom:12px">
          <label style="font-size:11px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Shoot type</label>
          <select id="cp-book-type" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:14px;background:var(--navy-lift);color:var(--white);font-family:var(--font)">
            <optgroup label="Property shoots">
              <option value="Reel Package">Reel Package (video + photos + reels)</option>
              <option value="Photo+Video">Photo + Video</option>
              <option value="Aerial Photo">Photo only</option>
              <option value="Aerial Video">Video only</option>
              <option value="Twilight Shoot">Twilight shoot</option>
              <option value="Exterior Only">Exterior only</option>
            </optgroup>
            <optgroup label="Add-ons & extras">
              <option value="Additional Reels">Additional social reels</option>
              <option value="Virtual Tour">Virtual Tour</option>
              <option value="Floor Plan">Floor plan</option>
            </optgroup>
            <optgroup label="Packages">
              <option value="Agent Promo">Agent Promo package</option>
              <option value="Social Day Rate">Social Day Rate (half/full day)</option>
            </optgroup>
            <option value="Other">Other / not sure</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:12px">
          <div>
            <label style="font-size:11px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Preferred date</label>
            <input type="date" id="cp-book-date" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:14px;background:var(--navy-lift);color:var(--white);font-family:var(--font)">
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Preferred time</label>
            <input type="time" id="cp-book-time" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:14px;background:var(--navy-lift);color:var(--white);font-family:var(--font)">
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Approx. sq ft</label>
            <input type="number" id="cp-book-sqft" placeholder="e.g. 2500" min="0" step="100" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:14px;background:var(--navy-lift);color:var(--white);font-family:var(--font)">
          </div>
        </div>
        <div style="margin-bottom:16px">
          <label style="font-size:11px;color:var(--muted);font-weight:700;display:block;margin-bottom:4px;text-transform:uppercase;letter-spacing:.06em">Notes</label>
          <textarea id="cp-book-notes" placeholder="Any special instructions, access notes, or questions…" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:13px;background:var(--navy-lift);color:var(--white);min-height:70px;resize:vertical;font-family:var(--font)"></textarea>
        </div>
        <div id="cp-book-success" style="display:none;padding:10px 14px;border-radius:10px;background:rgba(34,217,122,.12);border:1px solid rgba(34,217,122,.3);color:var(--green);font-size:13px;font-weight:600;margin-bottom:12px">✓ Request submitted! We'll confirm your booking shortly.</div>
        <button onclick="cpSubmitBookingRequest()" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,var(--blue),var(--blue-dim));color:#fff;font-size:14px;font-weight:700;cursor:pointer;font-family:var(--font)">Submit Request →</button>
      </div>
      ${myBookings.length?`<div class="card">
        <div class="section-label" style="margin-bottom:12px">Your shoots</div>
        ${myBookings.map(j=>`<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:12px 0;border-bottom:1px solid var(--border);gap:10px;flex-wrap:wrap">
          <div style="flex:1">
            <div style="font-size:13px;font-weight:600;color:var(--white)">${j.name}</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">${j.date||'—'}${j.shootTime?' at '+j.shootTime:''}${j.address?' · '+j.address:''}</div>
            ${j.shootType?`<div style="font-size:11px;color:var(--blue-bright);margin-top:2px">${j.shootType}${j.sqft?' · '+j.sqft.toLocaleString()+' sqft':''}</div>`:''}
          </div>
          <div style="flex-shrink:0;display:flex;align-items:center;gap:8px">
            ${['requested','quoted','confirmed'].includes(j.status)?`<button onclick="openRequestChat('${j.id}','client')" style="display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:14px;border:1px solid rgba(91,141,239,.4);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer;font-family:var(--font)"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> Message${(j.requestChat&&j.requestChat.length)?' ('+j.requestChat.length+')':''}</button>`:''}
            ${statusBadge(j.status)}
          </div>
        </div>`).join('')}
      </div>`:''}
    </div>`;
  }

  document.getElementById('cp-content').innerHTML=html;
}

function cpCloseInvoice(){
  document.getElementById('cp-invoice-overlay').style.display='none';
}

// ── FEATURE 1: Client Portal Video Draft Review ────────────────────────────

let _cpDraftReviewJobId=null;

function cpOpenDraftReview(jobId){
  _cpDraftReviewJobId=jobId;
  const job=savedJobs.find(j=>j.id===jobId||String(j.id)===String(jobId));
  const vd=videoDraftsLoad().find(d=>d.jobId===jobId);
  if(!vd){alert('No draft found for this job.');return;}
  const lastDraft=vd.drafts&&vd.drafts.length?vd.drafts[vd.drafts.length-1]:null;
  const overlay=document.getElementById('cp-draft-review-overlay');
  if(!overlay) return;

  document.getElementById('cp-dro-title').textContent='Draft Review'+(lastDraft?' — Draft '+vd.drafts.length:'');
  document.getElementById('cp-dro-subtitle').textContent=job?job.name:'';
  document.getElementById('cp-dro-changes-box').style.display='none';
  document.getElementById('cp-dro-changes-notes').value='';
  document.getElementById('cp-dro-comment-input').value='';

  // Render video player
  const playerEl=document.getElementById('cp-dro-player');
  const url=lastDraft?.videoUrl||'';
  if(url){
    if(url.includes('youtube.com')||url.includes('youtu.be')){
      let embedUrl=url.replace('watch?v=','embed/').replace('youtu.be/','www.youtube.com/embed/');
      playerEl.innerHTML=`<iframe src="${embedUrl}" style="width:100%;height:100%;border:none;aspect-ratio:16/9;display:block" allowfullscreen></iframe>`;
    } else if(url.includes('vimeo.com')){
      const vimeoId=url.split('/').pop().split('?')[0];
      playerEl.innerHTML=`<iframe src="https://player.vimeo.com/video/${vimeoId}" style="width:100%;height:100%;border:none;aspect-ratio:16/9;display:block" allowfullscreen></iframe>`;
    } else {
      playerEl.innerHTML=`<video src="${url}" controls style="width:100%;height:100%;display:block;background:#000"></video>`;
    }
  } else {
    playerEl.innerHTML=`<div style="display:flex;align-items:center;justify-content:center;height:100%;background:var(--navy-card);color:var(--muted);font-size:13px;padding:40px;text-align:center">No video URL available for this draft yet.</div>`;
  }

  // Render comments
  cpRenderDraftComments(vd);

  overlay.style.display='flex';
}

function cpRenderDraftComments(vd){
  const commentsEl=document.getElementById('cp-dro-comments');
  if(!commentsEl) return;
  const comments=(vd.comments||[]).filter(c=>!c.isSystem).sort((a,b)=>(a.at||'').localeCompare(b.at||''));
  if(!comments.length){
    commentsEl.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">No comments yet. Be the first to leave feedback!</div>';
    return;
  }
  commentsEl.innerHTML=comments.map(c=>`<div style="padding:10px 12px;border-radius:10px;background:${c.from==='client'?'rgba(91,141,239,.12)':'var(--navy-lift)'};border:1px solid ${c.from==='client'?'rgba(91,141,239,.25)':'var(--border)'}">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
      <span style="font-size:11px;font-weight:700;color:${c.from==='client'?'var(--blue-bright)':'var(--muted)'}">${c.by||c.from}</span>
      <span style="font-size:10px;color:var(--muted)">${c.at?new Date(c.at).toLocaleDateString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):''}</span>
    </div>
    <div style="font-size:12px;color:var(--offwhite);line-height:1.5">${c.text}</div>
  </div>`).join('');
  commentsEl.scrollTop=commentsEl.scrollHeight;
}

function cpCloseDraftReview(){
  const overlay=document.getElementById('cp-draft-review-overlay');
  if(overlay) overlay.style.display='none';
  const playerEl=document.getElementById('cp-dro-player');
  if(playerEl) playerEl.innerHTML='';
  _cpDraftReviewJobId=null;
}

function cpSubmitDraftComment(){
  if(!_cpDraftReviewJobId) return;
  const input=document.getElementById('cp-dro-comment-input');
  const text=(input?.value||'').trim();
  if(!text) return;
  const cpAcct=getPortalAccounts().find(a=>a.clientId===cpActiveClientId)||{name:'Client'};
  const all=videoDraftsLoad();
  let vd=all.find(d=>d.jobId===_cpDraftReviewJobId);
  if(!vd) return;
  if(!vd.comments) vd.comments=[];
  vd.comments.push({
    id:'cc_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
    text,
    from:'client',
    by:cpAcct.name||'Client',
    at:new Date().toISOString(),
  });
  videoDraftsSave(all);
  if(input) input.value='';
  cpRenderDraftComments(vd);
}

function cpRequestChangesToggle(){
  const box=document.getElementById('cp-dro-changes-box');
  if(box) box.style.display=box.style.display==='none'?'block':'none';
}

function cpSubmitRequestChanges(){
  if(!_cpDraftReviewJobId) return;
  const notes=(document.getElementById('cp-dro-changes-notes')?.value||'').trim();
  // Add a comment with the notes if provided
  if(notes){
    const cpAcct=getPortalAccounts().find(a=>a.clientId===cpActiveClientId)||{name:'Client'};
    const all=videoDraftsLoad();
    let vd=all.find(d=>d.jobId===_cpDraftReviewJobId);
    if(vd){
      if(!vd.comments) vd.comments=[];
      vd.comments.push({
        id:'cc_'+Date.now()+'_req',
        text:'Change request: '+notes,
        from:'client',
        by:cpAcct.name||'Client',
        at:new Date().toISOString(),
      });
      videoDraftsSave(all);
      cpRenderDraftComments(vd);
    }
  }
  _vdActiveJobId=_cpDraftReviewJobId;
  const vdAll=videoDraftsLoad();
  const vd=vdAll.find(d=>d.jobId===_cpDraftReviewJobId);
  if(vd&&vd.drafts&&vd.drafts.length){
    _vdActiveDraftId=vd.drafts[vd.drafts.length-1].id||null;
  }
  vdClientDecision('changes_requested');
  document.getElementById('cp-dro-changes-box').style.display='none';
  cpCloseDraftReview();
  cpShowTab('production');
}

function cpApproveDraft(){
  if(!_cpDraftReviewJobId) return;
  _vdActiveJobId=_cpDraftReviewJobId;
  const vdAll=videoDraftsLoad();
  const vd=vdAll.find(d=>d.jobId===_cpDraftReviewJobId);
  if(vd&&vd.drafts&&vd.drafts.length){
    _vdActiveDraftId=vd.drafts[vd.drafts.length-1].id||null;
  }
  vdClientDecision('approved');
  cpCloseDraftReview();
  cpShowTab('production');
}

// ── FEATURE 2: Book a Shoot ────────────────────────────────────────────────

function cpSubmitBookingRequest(){
  const address=(document.getElementById('cp-book-address')?.value||'').trim();
  const shootType=(document.getElementById('cp-book-type')?.value||'Aerial Photo');
  const preferredDate=(document.getElementById('cp-book-date')?.value||'');
  const preferredTime=(document.getElementById('cp-book-time')?.value||'');
  const notes=(document.getElementById('cp-book-notes')?.value||'').trim();
  const sqft=parseInt(document.getElementById('cp-book-sqft')?.value)||0;
  if(!address){alert('Please enter a property address.');return;}
  if(!preferredDate){alert('Please select a preferred date.');return;}
  if(!sqft){alert('Please enter the approximate square footage — it helps us quote your shoot accurately.');return;}
  const newJob={
    id:'jr_'+Date.now(),
    name:address+' — '+shootType,
    date:preferredDate,
    address,
    status:'requested',
    clientId:cpActiveClientId,
    shootType,
    preferredTime,
    sqft,
    notes,
    requestedAt:new Date().toISOString(),
    grand:0,
    services:{},
    payouts:{},
  };
  savedJobs.push(newJob);
  saveJobsToStorage();
  // Notify the ops team via toast
  if(typeof addSocialNotification==='function'){
    addSocialNotification(newJob.id, `New shoot request: ${newJob.name} on ${preferredDate}`, 'booking');
  } else if(typeof showDhToast==='function'){
    showDhToast('New Booking Request','Client requested a shoot: '+newJob.name,'📬','var(--amber)');
  }
  const successEl=document.getElementById('cp-book-success');
  if(successEl){successEl.style.display='block';}
  ['cp-book-address','cp-book-date','cp-book-time','cp-book-notes'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  setTimeout(()=>cpShowTab('booking'),1800);
}

// ── FEATURE 4: Notification Badge ────────────────────────────────────────────

function cpCountPendingActions(){
  if(!cpActiveClientId) return 0;
  const cJobs=savedJobs.filter(j=>j.clientId===cpActiveClientId);
  const allDrafts=videoDraftsLoad();
  let count=0;
  cJobs.forEach(j=>{
    const vd=allDrafts.find(d=>d.jobId===j.id);
    if(vd){
      const last=vd.drafts&&vd.drafts.length?vd.drafts[vd.drafts.length-1]:null;
      if(last&&(last.status==='awaiting_review'||vd.status==='awaiting_review')) count++;
    }
  });
  const socialPosts=socialPostsLoad();
  const socialWorkspaces=socialWorkspacesLoad();
  const clientAddr=(clients.find(cl=>cl.id===cpActiveClientId)?.address||'').toLowerCase();
  socialPosts.forEach(p=>{
    if(p.status!=='pending') return;
    if(p.clientId&&p.clientId===cpActiveClientId){count++;return;}
    if(p.workspaceId){const ws=socialWorkspaces.find(w=>w.id===p.workspaceId);if(ws?.clientId===cpActiveClientId){count++;return;}}
  });
  return count;
}

function cpUpdateNotifBadge(){
  const count=cpCountPendingActions();
  const badge=document.getElementById('cp-notif-count');
  const bell=document.getElementById('cp-notif-bell');
  if(!badge) return;
  if(count>0){
    badge.textContent=count>9?'9+':String(count);
    badge.style.display='block';
    if(bell) bell.style.color='var(--offwhite)';
  } else {
    badge.style.display='none';
    if(bell) bell.style.color='var(--muted)';
  }
}

function cpViewInvoice(jobId){
  const job=savedJobs.find(j=>j.id==jobId||String(j.id)===String(jobId));
  if(!job){
    // Jobs might not have synced yet — try loading from Firebase then retry
    if(_fbToken()){
      fbGet('orgs',ORG_ID+':jobs').then(fb=>{
        if(fb?.data){
          const fbJobs=JSON.parse(fb.data);
          const j=fbJobs.find(x=>String(x.id)===String(jobId));
          if(j){savedJobs=fbJobs;localStorage.setItem('dronehub_jobs',JSON.stringify(fbJobs));cpViewInvoice(jobId);}
          else{alert('Invoice not found. Please try again in a moment.');}
        }
      }).catch(()=>alert('Could not load invoice. Check your connection.'));
    } else {alert('Invoice not found.');}
    return;
  }
  const client=clients.find(c=>c.id===job.clientId)||{name:'Client',email:'',company:''};
  const biz=bizForCurrency(job.currency)||{};
  const bname=biz.name||'DroneHub Media';
  const fmtC=n=>(job.currency||'CAD').toUpperCase()+' $'+Number(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});

  // ── Build line items ──────────────────────────────────────────────────────
  const _isUsdPortalInv=(job.currency||'cad').toLowerCase()==='usd';
  const svcs=job.services||{};
  const hrs=job.hours||{};
  const sqft=job.sqft||0;
  const driveCost=job.driveCost||0;
  const lines=[];

  if(_isUsdPortalInv){
    // US market jobs — build lines from usData
    const ud=job.usData||{};
    const p=US_MARKET_PRICING[ud.market]||US_MARKET_PRICING['other_us'];
    const tierLabels={under4k:'Under 4,000 sqft',over4k:'4,000–8,000 sqft',over8k:'Over 8,000 sqft'};
    const socialLabels={r1:'1 Reel',r2:'2 Reels',r3:'3 Reels',r5:'5 Reels',fullDay:'Full Day Social'};
    if(ud.pkgType==='listing'&&ud.listingTier){
      const basePrice=p.listing[ud.listingTier]||job.grand;
      lines.push({desc:`Real Estate Listing Package — ${tierLabels[ud.listingTier]||ud.listingTier}`,qty:1,unit:basePrice,total:basePrice});
      if((ud.listingReelCount||0)>0){const rr=p.reelAddon||400;lines.push({desc:'Add-on: Social Reels',qty:ud.listingReelCount,unit:rr,total:ud.listingReelCount*rr});}
      if(ud.addons?.sunrise&&p.addons?.sunrise) lines.push({desc:'Add-on: Sunrise/Sunset Shoot',qty:1,unit:p.addons.sunrise,total:p.addons.sunrise});
      if(ud.addons?.photoHDR&&p.addons?.photoHDR) lines.push({desc:'Add-on: Photo HDR Processing',qty:1,unit:p.addons.photoHDR,total:p.addons.photoHDR});
      if(ud.addons?.photoFlash&&p.addons?.photoFlash) lines.push({desc:'Add-on: Flash Photography',qty:1,unit:p.addons.photoFlash,total:p.addons.photoFlash});
      if(ud.offSeason&&p.offSeasonDiscount) lines.push({desc:'Off-season discount',qty:1,unit:-p.offSeasonDiscount,total:-p.offSeasonDiscount});
    } else if(ud.pkgType==='social'&&ud.socialTier){
      const basePrice=p.social[ud.socialTier]||job.grand;
      lines.push({desc:`Social Media Package — ${socialLabels[ud.socialTier]||ud.socialTier}`,qty:1,unit:basePrice,total:basePrice});
      if(ud.addons?.sunrise&&p.addons?.sunrise) lines.push({desc:'Add-on: Sunrise/Sunset Shoot',qty:1,unit:p.addons.sunrise,total:p.addons.sunrise});
    } else if(ud.pkgType==='agent'){
      const basePrice=p.agentPromo||job.grand;
      lines.push({desc:'Agent Promo Package',qty:1,unit:basePrice,total:basePrice});
    } else if(ud.pkgType==='exterior'){
      const basePrice=p.exteriorOnly||750;
      lines.push({desc:'Exterior Only Package',qty:1,unit:basePrice,total:basePrice});
      if(ud.addons?.sunrise&&p.addons?.sunrise) lines.push({desc:'Add-on: Sunrise/Sunset Shoot',qty:1,unit:p.addons.sunrise,total:p.addons.sunrise});
      if(ud.addons?.photoHDR&&p.addons?.photoHDR) lines.push({desc:'Add-on: Photo HDR Processing',qty:1,unit:p.addons.photoHDR,total:p.addons.photoHDR});
      if(ud.addons?.photoFlash&&p.addons?.photoFlash) lines.push({desc:'Add-on: Flash Photography',qty:1,unit:p.addons.photoFlash,total:p.addons.photoFlash});
    } else if(ud.pkgType==='day'){
      const dayPrice=ud.dayType==='half'?US_SOCIAL_DAY.halfDay:US_SOCIAL_DAY.fullDay;
      lines.push({desc:`${ud.dayType==='half'?'Half':'Full'} Day Rate`,qty:1,unit:dayPrice,total:dayPrice});
      if(ud.dayLocations && ud.dayLocations.length){
        ud.dayLocations.forEach((loc,i)=>{
          const addr=(loc.address||`Location ${i+1}`).trim();
          const reels=loc.reelCount||0;
          if(reels>0) lines.push({desc:`${addr} — Social Reels`,qty:reels,unit:US_SOCIAL_DAY.reelRate,total:reels*US_SOCIAL_DAY.reelRate});
        });
      } else if((ud.reelCount||0)>0){
        lines.push({desc:'Social Reels',qty:ud.reelCount,unit:US_SOCIAL_DAY.reelRate,total:ud.reelCount*US_SOCIAL_DAY.reelRate});
      }
    } else {
      if(job.grand>0) lines.push({desc:'Media Package',qty:1,unit:job.grand,total:job.grand});
    }
  } else {
    // Canada jobs — build from services
    let vidDriveBaked=0,phoDriveBaked=0;
    if(driveCost>0){
      const hasVid=svcs.video||svcs.randomvideo,hasPho=svcs.photo||svcs.randomphoto;
      if(hasVid&&hasPho){vidDriveBaked=driveCost*0.6;phoDriveBaked=driveCost*0.4;}
      else if(hasVid) vidDriveBaked=driveCost;
      else if(hasPho) phoDriveBaked=driveCost;
    }
    if(svcs.video&&svcs.photo){
      const vt=Math.ceil(baseVideoRate(sqft)/(1-MARGIN))+Math.ceil(vidDriveBaked);
      const pt=photoBase(sqft,true)+Math.ceil(phoDriveBaked);
      lines.push({desc:'Video production',qty:1,unit:vt,total:vt});
      lines.push({desc:'Photography',qty:1,unit:pt,total:pt});
    } else {
      if(svcs.video){const vt=Math.ceil(baseVideoRate(sqft)/(1-MARGIN))+Math.ceil(vidDriveBaked);lines.push({desc:'Video production',qty:1,unit:vt,total:vt});}
      if(svcs.photo){const pt=photoBase(sqft,false)+Math.ceil(phoDriveBaked);lines.push({desc:'Photography',qty:1,unit:pt,total:pt});}
    }
    if(svcs.tvideo&&svcs.tphoto) lines.push({desc:'Twilight session — video & photography',qty:1,unit:TWILIGHT_BOTH,total:TWILIGHT_BOTH});
    else if(svcs.tvideo) lines.push({desc:'Twilight video session',qty:1,unit:TWILIGHT_VIDEO,total:TWILIGHT_VIDEO});
    else if(svcs.tphoto) lines.push({desc:'Twilight photography session',qty:1,unit:TWILIGHT_PHOTO,total:TWILIGHT_PHOTO});
    if(svcs.reel){const q=hrs.reel||1;lines.push({desc:'Social media reels',qty:q,unit:150,total:150*q});}
    if(svcs.extvideo) lines.push({desc:'Exterior video shoot',qty:1,unit:150,total:150});
    if(svcs.extphoto) lines.push({desc:'Exterior photo shoot',qty:1,unit:150,total:150});
    if(svcs.floorplan) lines.push({desc:'Floor plan',qty:1,unit:150,total:150});
    if(svcs.randomvideo){const h=hrs.randomvideo||1;const u=RANDOM_VIDEO_RATE_CLIENT+(Math.ceil(vidDriveBaked)/h);lines.push({desc:'Video production (hourly)',qty:h,unit:Math.ceil(u),total:Math.ceil(u)*h});}
    if(svcs.randomphoto){const h=hrs.randomphoto||1;const u=RANDOM_PHOTO_RATE_CLIENT+(Math.ceil(phoDriveBaked)/h);lines.push({desc:'Photography (hourly)',qty:h,unit:Math.ceil(u),total:Math.ceil(u)*h});}
    if(svcs.rush) lines.push({desc:'Rush order',qty:1,unit:RUSH_FEE,total:RUSH_FEE});
    if(svcs.custom&&job.customPrice>0) lines.push({desc:job.customDesc||'Custom service',qty:1,unit:job.customPrice,total:job.customPrice});
    (job.extraServices||[]).forEach(xs=>{if(xs.clientPrice>0) lines.push({desc:xs.name,qty:1,unit:xs.clientPrice,total:xs.clientPrice});});
  }

  // Fallback: if no lines built (old job format), derive from grand total
  const subtotal=lines.length?lines.reduce((s,l)=>s+l.total,0):(_isUsdPortalInv?job.grand:Math.round(job.grand/1.13));
  const hst=_isUsdPortalInv?0:(lines.length?parseFloat((subtotal*0.13).toFixed(2)):job.grand-subtotal);
  const grandTotal=subtotal+hst;

  // ── Dates ─────────────────────────────────────────────────────────────────
  const issueDate=job.invoicedAt
    ?new Date(job.invoicedAt).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'})
    :new Date(job.date||Date.now()).toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const refD=job.invoicedAt?new Date(job.invoicedAt):new Date(job.date||Date.now());
  const dueD=new Date(refD); dueD.setDate(dueD.getDate()+30);
  const dueDateStr=dueD.toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const invStatus=getInvoiceStatus(job);
  const {owed}=calcCurrentOwed(job);
  const amtDue=invStatus==='overdue'?owed:grandTotal;

  const statusBar=invStatus==='paid'
    ?`<div style="background:rgba(34,217,122,.12);color:#22D97A;border-radius:10px;padding:12px 18px;font-weight:700;font-size:13px;margin-bottom:24px;display:flex;align-items:center;gap:8px;border:1px solid rgba(34,217,122,.25)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg> This invoice has been paid in full</div>`
    :invStatus==='overdue'
    ?`<div style="background:rgba(255,112,112,.12);color:#FF7070;border-radius:10px;padding:12px 18px;font-weight:700;font-size:13px;margin-bottom:24px;border:1px solid rgba(255,112,112,.25)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>This invoice is overdue. Amount owing: <strong>${fmtC(amtDue)}</strong></div>`
    :`<div style="background:rgba(245,166,35,.1);color:#F5C842;border-radius:10px;padding:12px 18px;font-weight:700;font-size:13px;margin-bottom:24px;border:1px solid rgba(245,166,35,.25)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>Payment due by ${dueDateStr}</div>`;

  const lineRows=lines.map(l=>`<tr>
    <td style="padding:11px 0;border-bottom:1px solid rgba(46,58,85,.7);font-size:13px;color:#E8EAF0">${l.desc}</td>
    <td style="padding:11px 0;border-bottom:1px solid rgba(46,58,85,.7);font-size:13px;text-align:center;color:#A8B4D0">${l.qty}</td>
    <td style="padding:11px 0;border-bottom:1px solid rgba(46,58,85,.7);font-size:13px;text-align:right;color:#A8B4D0">${fmtC(l.unit)}</td>
    <td style="padding:11px 0;border-bottom:1px solid rgba(46,58,85,.7);font-size:13px;text-align:right;font-weight:700;color:#E8EAF0">${fmtC(l.total)}</td>
  </tr>`).join('');

  const payBtn=invStatus!=='paid'?`<div style="text-align:center;margin-top:28px;padding:26px;background:rgba(91,141,239,.07);border-radius:14px;border:1px solid rgba(91,141,239,.2)">
    <div style="font-size:11px;color:#A8B4D0;margin-bottom:6px;text-transform:uppercase;letter-spacing:.06em">Secure online payment</div>
    <div style="font-size:32px;font-weight:900;color:#E8EAF0;margin-bottom:16px;letter-spacing:-.5px">${fmtC(amtDue)}</div>
    <button onclick="openStripeCheckout(${amtDue},'${job.invNum||''}','${client.email||''}','${job.currency||'cad'}',${job.id})" style="padding:13px 40px;background:linear-gradient(135deg,#635BFF,#4B44D8);color:#fff;border-radius:10px;font-size:15px;font-weight:700;border:none;cursor:pointer;box-shadow:0 4px 20px rgba(99,91,255,.35)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align:-2px;margin-right:6px"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>Pay now</button>
    <div style="font-size:11px;color:#6B7A9F;margin-top:10px">Powered by Stripe · Encrypted & secure</div>
  </div>`:'';

  document.getElementById('cp-invoice-body').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:22px;border-bottom:1px solid rgba(58,72,144,.6)">
      <div>
        <div style="font-size:20px;font-weight:800;color:#E8EAF0;margin-bottom:6px;letter-spacing:-.3px">${bname}</div>
        ${[biz.addr1,biz.addr2,biz.phone,biz.email,biz.website].filter(Boolean).map(v=>`<div style="font-size:12px;color:#A8B4D0;line-height:1.75">${v}</div>`).join('')}
        ${biz._isUs?(biz.ein?`<div style="font-size:11px;color:#6B7A9F;margin-top:4px">EIN: ${biz.ein}</div>`:''):(biz.hst?`<div style="font-size:11px;color:#6B7A9F;margin-top:4px">HST # ${biz.hst}</div>`:'')}
      </div>
      <div style="text-align:right">
        <div style="font-size:13px;font-weight:800;color:#22D97A;letter-spacing:.18em;text-transform:uppercase;margin-bottom:6px">Invoice</div>
        ${job.invNum?`<div style="font-size:22px;font-weight:300;color:#E8EAF0;letter-spacing:.04em;margin-bottom:4px">${job.invNum}</div>`:''}
        <div style="font-size:12px;color:#A8B4D0;margin-top:2px">Issued ${issueDate}</div>
        <div style="font-size:12px;color:#F5C842;font-weight:600;margin-top:2px">Due ${dueDateStr}</div>
      </div>
    </div>
    ${statusBar}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:28px">
      <div style="padding:14px 16px;background:rgba(36,45,66,.8);border-radius:10px;border:1px solid rgba(46,58,85,.8)">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6B7A9F;margin-bottom:8px;font-weight:700">Bill to</div>
        <div style="font-size:14px;font-weight:700;color:#E8EAF0;margin-bottom:3px">${client.name}</div>
        ${client.company?`<div style="font-size:12px;color:#A8B4D0">${client.company}</div>`:''}
        ${client.email?`<div style="font-size:12px;color:#A8B4D0">${client.email}</div>`:''}
      </div>
      <div style="padding:14px 16px;background:rgba(36,45,66,.8);border-radius:10px;border:1px solid rgba(46,58,85,.8)">
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6B7A9F;margin-bottom:8px;font-weight:700">Property</div>
        <div style="font-size:13px;font-weight:700;color:#E8EAF0;margin-bottom:3px">${job.name}</div>
        <div style="font-size:12px;color:#A8B4D0">${job.address||''}</div>
        <div style="font-size:12px;color:#6B7A9F;margin-top:4px">Shoot date: ${job.date}</div>
      </div>
    </div>
    ${lines.length?`<table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="border-bottom:1px solid rgba(58,72,144,.6)">
        <th style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#6B7A9F;padding-bottom:10px;font-weight:700">Description</th>
        <th style="text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#6B7A9F;padding-bottom:10px;font-weight:700">Qty</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#6B7A9F;padding-bottom:10px;font-weight:700">Unit</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#6B7A9F;padding-bottom:10px;font-weight:700">Amount</th>
      </tr></thead>
      <tbody>${lineRows}</tbody>
    </table>`:''}
    <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;border-top:1px solid rgba(58,72,144,.6);padding-top:16px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;width:240px;font-size:13px;color:#A8B4D0"><span>Subtotal</span><span>${fmtC(subtotal)}</span></div>
      ${_isUsdPortalInv?'':`<div style="display:flex;justify-content:space-between;width:240px;font-size:13px;color:#A8B4D0"><span>HST (13%)</span><span>${fmtC(hst)}</span></div>`}
      <div style="display:flex;justify-content:space-between;width:240px;font-size:18px;font-weight:800;color:#E8EAF0;margin-top:8px;padding-top:10px;border-top:1px solid rgba(58,72,144,.5)"><span>Total</span><span style="color:#22D97A">${fmtC(grandTotal)}</span></div>
    </div>
    ${payBtn}
    <div style="margin-top:28px;padding-top:18px;border-top:1px solid rgba(46,58,85,.6);font-size:11px;color:#6B7A9F;line-height:1.8;text-align:center">
      Payment is due within 30 days of invoice date. Overdue balances are subject to 2% monthly compounding interest plus a 20% penalty every 6 months unpaid.<br>
      Thank you for your business — ${bname}
    </div>`;

  document.getElementById('cp-invoice-overlay').style.display='block';
  document.getElementById('cp-invoice-overlay').scrollTop=0;
}

function cpClosePost(){
  const el = document.getElementById('cp-post-overlay');
  if(el){ el.style.display='none'; el.style.flexDirection=''; }
}

let _cpOpenPostId = null;
let _cpSidebarTab = 'info';

function cpOpenPost(postId){
  _cpOpenPostId = postId;
  _cpSidebarTab = 'info';
  const posts = socialPostsLoad();
  const p = posts.find(x=>x.id===postId);
  if(!p) return;

  const st = SOCIAL_STATUSES.find(s=>s.id===p.status)||{label:p.status,color:'#A8B4D0'};
  const isPending = p.status==='pending';

  // Show overlay
  const overlay = document.getElementById('cp-post-overlay');
  overlay.style.display='flex';
  overlay.style.flexDirection='column';
  overlay.scrollTop=0;

  // Top bar
  const titleEl = document.getElementById('cp-post-overlay-title');
  const subtitleEl = document.getElementById('cp-post-overlay-subtitle');
  const statusEl = document.getElementById('cp-post-overlay-status');
  const actionBtns = document.getElementById('cp-post-action-btns');

  if(titleEl) titleEl.textContent = p.address||p.title||'Post';
  if(subtitleEl) subtitleEl.textContent = p.reelNumber ? `Reel ${p.reelNumber}` : (p.format ? (SOCIAL_FORMATS.find(f=>f.id===p.format)?.label||p.format) : '');
  if(statusEl){ statusEl.textContent=st.label; statusEl.style.background=st.color+'22'; statusEl.style.color=st.color; }
  if(actionBtns) actionBtns.style.display = isPending ? 'flex' : 'none';

  // Instagram phone mockup
  const coverImg = document.getElementById('cp-ig-cover');
  const placeholder = document.getElementById('cp-ig-placeholder');
  const locationEl = document.getElementById('cp-ig-location');
  const captionEl = document.getElementById('cp-ig-caption');
  const hashtagsEl = document.getElementById('cp-ig-hashtags');
  const overlayTextEl = document.getElementById('cp-ig-overlay-text');

  if(p.coverPhotoData){
    if(coverImg){ coverImg.src=p.coverPhotoData; coverImg.style.display='block'; }
    if(placeholder) placeholder.style.display='none';
  } else {
    if(coverImg) coverImg.style.display='none';
    if(placeholder) placeholder.style.display='flex';
  }

  if(locationEl){
    if(p.address){ locationEl.textContent=''+p.address.substring(0,28)+(p.address.length>28?'…':''); locationEl.style.display='block'; }
    else locationEl.style.display='none';
  }
  if(captionEl) captionEl.textContent = p.content ? p.content.substring(0,80)+(p.content.length>80?'…':'') : '';
  if(hashtagsEl) hashtagsEl.textContent = p.hashtags ? p.hashtags.replace(/\n/g,' ').substring(0,80) : '';
  if(overlayTextEl){
    if(p.overlayText){ overlayTextEl.textContent=p.overlayText; overlayTextEl.style.display='block'; }
    else overlayTextEl.style.display='none';
  }

  // Set time on status bar
  const igTime = document.getElementById('cp-ig-time');
  if(igTime){ const now=new Date(); igTime.textContent=now.getHours()+':'+(now.getMinutes()<10?'0':'')+now.getMinutes(); }

  // Render sidebar
  cpSetSidebarTab('info');
}

function cpSetSidebarTab(tab){
  _cpSidebarTab = tab;
  ['info','activity','approval'].forEach(t=>{
    const btn = document.getElementById('cp-sidebar-tab-'+t);
    if(btn){
      btn.style.borderBottomColor = t===tab ? 'var(--blue-bright)' : 'transparent';
      btn.style.color = t===tab ? 'var(--blue-bright)' : 'var(--muted)';
    }
  });
  const content = document.getElementById('cp-sidebar-content');
  if(!content||!_cpOpenPostId) return;

  const posts = socialPostsLoad();
  const p = posts.find(x=>x.id===_cpOpenPostId);
  if(!p){ content.innerHTML=''; return; }

  const st = SOCIAL_STATUSES.find(s=>s.id===p.status)||{label:p.status,color:'#A8B4D0'};
  const isPending = p.status==='pending';
  const isRevision = p.status==='revision';
  const fmtDt = iso=>iso?new Date(iso).toLocaleString('en-CA',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'';
  const platLabel = id=>SOCIAL_PLATFORMS.find(pl=>pl.id===id)?.label||id;
  const platIcon = id=>({instagram:'IG',facebook:'FB',tiktok:'TT',linkedin:'LI',twitter:'X'}[id]||'');

  const row = (label,val)=>val?`<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--border)">
    <span style="font-size:11px;color:var(--muted);flex-shrink:0;margin-right:12px">${label}</span>
    <span style="font-size:12px;color:var(--offwhite);text-align:right;font-weight:600">${val}</span>
  </div>`:'';

  if(tab==='info'){
    content.innerHTML=`
      <div style="margin-bottom:12px">
        ${p.address?`<div style="display:inline-block;padding:3px 10px;border-radius:20px;background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:11px;font-weight:700;margin-bottom:10px">${p.address}</div>`:''}
        ${row('Status',`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:${st.color}22;color:${st.color}">${st.label}</span>`)}
        ${row('Post date', p.scheduledAt?new Date(p.scheduledAt).toLocaleDateString('en-CA',{weekday:'short',month:'short',day:'numeric',year:'numeric'})+' · '+(p.scheduledTime||'8:00 am'):'')}
        ${p.status==='scheduled'?`<div style="padding:10px 0;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:11px;color:var(--muted)">Move post date</span>
          <button onclick="cpOpenMoveDate('${p.id}')" style="padding:4px 12px;border-radius:10px;border:1px solid rgba(122,171,255,.3);background:rgba(122,171,255,.08);color:var(--blue-bright);font-size:11px;cursor:pointer">Change Date</button>
        </div>`:''}
        ${row('Channel type','Instagram mockup channel')}
        ${row('Post type', p.format?SOCIAL_FORMATS.find(f=>f.id===p.format)?.label||p.format:'')}
        ${row('Platforms',(p.platforms||[]).map(pid=>platIcon(pid)+' '+platLabel(pid)).join(', '))}
        ${row('Reel', p.reelNumber||'')}
        ${row('Content owner','Bailey Roubos')}
        ${p.songName?row('Song',p.songName):''}
        ${p.songTimestamps?row('Timestamps',p.songTimestamps):''}
      </div>
      ${p.content?`<div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--blue-bright);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Caption</div>
        <div style="font-size:12px;color:var(--offwhite);line-height:1.75;white-space:pre-line">${p.content}</div>
      </div>`:''}
      ${p.hashtags?`<div style="margin-bottom:12px">
        <div style="font-size:10px;font-weight:700;color:var(--blue-bright);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Hashtags</div>
        <div style="font-size:11px;color:var(--muted);line-height:1.7;white-space:pre-line">${p.hashtags}</div>
      </div>`:''}
      ${p.overlayText?`<div>
        <div style="font-size:10px;font-weight:700;color:var(--blue-bright);letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Overlay Text</div>
        <div style="font-size:12px;color:#A78BFA;font-style:italic">"${p.overlayText}"</div>
      </div>`:''}
    `;
  } else if(tab==='activity'){
    const chatLog = p.chatLog||[];
    const logHtml = renderChatLog(chatLog, 'client', p.id);
    content.innerHTML = `
      <div id="cp-chat-log" style="margin-bottom:12px">${logHtml}</div>
      <div style="display:flex;gap:8px;align-items:flex-end;border-top:1px solid var(--border);padding-top:12px">
        <textarea id="cp-chat-input" placeholder="Send a message to DroneHub…" rows="2" style="flex:1;padding:9px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:12px;background:var(--navy-lift);color:var(--white);font-family:var(--font);resize:none;min-height:40px" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();cpSendChatMessage('${p.id}');}"></textarea>
        <button onclick="cpSendChatMessage('${p.id}')" style="padding:9px 14px;border-radius:10px;border:none;background:var(--blue);color:#fff;font-size:12px;font-weight:700;cursor:pointer;flex-shrink:0;height:40px">Send</button>
      </div>`;
    setTimeout(()=>{const el=document.getElementById('cp-chat-log');if(el)el.scrollTop=el.scrollHeight;},50);

  } else if(tab==='approval'){
    const comments = p.clientComments||[];
    const commentThread = comments.length?`
      <div style="margin-bottom:16px">
        <div style="font-size:10px;font-weight:700;color:var(--blue-bright);letter-spacing:.08em;text-transform:uppercase;margin-bottom:10px">Feedback Thread</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          ${comments.map(cm=>`
            <div style="display:flex;flex-direction:column;align-items:${cm.from==='client'?'flex-end':'flex-start'}">
              <div style="max-width:90%;padding:8px 12px;border-radius:10px;background:${cm.from==='client'?'linear-gradient(135deg,var(--blue),var(--blue-dim))':'var(--navy-lift)'};color:#fff">
                <div style="font-size:10px;font-weight:700;opacity:.7;margin-bottom:3px">${cm.from==='client'?'You':'DroneHub Media'}</div>
                <div style="font-size:12px;line-height:1.5">${cm.text}</div>
              </div>
              <div style="font-size:9px;color:var(--muted);margin-top:2px">${fmtDt(cm.at)}</div>
            </div>`).join('')}
        </div>
      </div>` : '';

    const roundLabel = p.approvalRound ? `Round ${p.approvalRound} of Approval` : 'Approval';
    const actionHtml = isPending?`
      <div>
        <div style="margin-bottom:12px"><span style="font-size:10px;font-weight:700;color:#F5C842;letter-spacing:.06em;text-transform:uppercase;padding:5px 12px;border-radius:20px;background:rgba(245,200,66,.1);border:1px solid rgba(245,200,66,.25);display:inline-block">${roundLabel}</span></div>
        <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:4px">Your Review</div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px">Approve this post or request changes with a note for our team.</div>
        <textarea id="cp-feedback-text" placeholder="Leave a note (optional for approval, required for revisions)…" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:10px;font-size:12px;background:var(--navy-lift);color:var(--white);font-family:var(--font);resize:vertical;min-height:80px;margin-bottom:10px"></textarea>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button onclick="cpClientApproveQuick()" style="width:100%;padding:12px;border-radius:12px;border:none;background:linear-gradient(135deg,#22D97A,#0E7A4C);color:#fff;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:7px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Approve Post
          </button>
          <button onclick="cpClientRevisionQuick()" style="width:100%;padding:12px;border-radius:12px;border:2px solid #FB923C;background:rgba(251,146,60,.08);color:#FB923C;font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);display:flex;align-items:center;justify-content:center;gap:7px">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Request Changes
          </button>
        </div>
      </div>`
    :isRevision?`<div style="padding:16px;border-radius:12px;border:1px solid rgba(251,146,60,.25);background:rgba(251,146,60,.05)">
        <div style="font-size:13px;font-weight:700;color:#FB923C;margin-bottom:4px">In Revision</div>
        <div style="font-size:12px;color:var(--muted);line-height:1.7">Our team is working on your requested changes.</div>
      </div>`
    :`<div style="padding:16px;border-radius:12px;background:var(--navy-lift)">
        <div style="font-size:12px;color:var(--muted)">Status: <strong style="color:var(--offwhite)">${st.label}</strong> — no action needed right now.</div>
      </div>`;

    content.innerHTML = commentThread + actionHtml;
  }
}

// Quick approve from top bar or approval tab
function cpClientApproveQuick(){
  const note=(document.getElementById('cp-feedback-text')?.value||'').trim();
  cpClientApproveWithNote(_cpOpenPostId, note);
}
function cpClientRevisionQuick(){
  const note=(document.getElementById('cp-feedback-text')?.value||'').trim();
  if(!note){
    const el=document.getElementById('cp-feedback-text');
    if(el){el.style.borderColor='var(--red)';el.placeholder='Please describe what changes you need…';el.focus();}
    return;
  }
  cpClientRevisionWithNote(_cpOpenPostId, note);
}
function cpShowReviewPanel(){
  cpSetSidebarTab('approval');
  // Scroll sidebar to bottom where the textarea is
  const content = document.getElementById('cp-sidebar-content');
  if(content) setTimeout(()=>{content.scrollTop=content.scrollHeight;document.getElementById('cp-feedback-text')?.focus();},100);
}

// Core approve/revision logic — accept note as parameter
function cpClientApproveWithNote(postId, note){
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  posts[idx].clientComments=posts[idx].clientComments||[];
  if(note) posts[idx].clientComments.push({from:'client',text:note,at:new Date().toISOString()});
  posts[idx].clientComments.push({from:'client',text:'✓ Approved this post.',at:new Date().toISOString()});
  if(note) chatLogAppend(posts,idx,{type:'message',from:'client',by:'Client',text:note});
  chatLogAppend(posts,idx,{type:'approval',from:'client',by:'client',text:'Approved this post.'});
  const round=posts[idx].approvalRound||1;
  if(round===2){ posts[idx].status='scheduled'; posts[idx].approvedAt=new Date().toISOString().slice(0,10); }
  else { posts[idx].status='approved'; posts[idx].approvalRound=1; }
  posts[idx].history=posts[idx].history||[];
  posts[idx].history.push({action:'Client approved',by:'client',at:new Date().toISOString()});
  chatLogAppend(posts,idx,{type:'system',from:'team',by:'system',text:'Client approved'});
  const label=posts[idx].address||posts[idx].reelNumber||'Post';
  socialPostsSave(posts);
  addSocialNotification(postId,'Client approved "'+label+'"','approval');
  cpClosePost();
  cpShowTab('social');
}

function cpClientRevisionWithNote(postId, note){
  const posts=socialPostsLoad();
  const idx=posts.findIndex(p=>p.id===postId);
  if(idx<0) return;
  posts[idx].clientComments=posts[idx].clientComments||[];
  posts[idx].clientComments.push({from:'client',text:note,at:new Date().toISOString()});
  posts[idx].status='revision';
  // approvalRound stays unchanged
  posts[idx].history=posts[idx].history||[];
  posts[idx].history.push({action:'Client requested revision: '+note,by:'client',at:new Date().toISOString()});
  chatLogAppend(posts,idx,{type:'revision',from:'client',by:'Client',text:note});
  const label=posts[idx].address||posts[idx].reelNumber||'Post';
  socialPostsSave(posts);
  addSocialNotification(postId,'Revision requested on "'+label+'": '+note,'revision');
  cpClosePost();
  cpShowTab('social');
}

// Legacy wrappers — keep working for renderSocialApprovals on the ops side
function cpClientApprove(postId){
  const note=(document.getElementById('cp-feedback-text')?.value||'').trim();
  cpClientApproveWithNote(postId, note);
}

function cpClientRevision(postId){
  const note=(document.getElementById('cp-feedback-text')?.value||'').trim();
  if(!note){
    const el=document.getElementById('cp-feedback-text');
    if(el){el.style.borderColor='var(--red)';el.placeholder='Please describe what changes you need…';el.focus();}
    return;
  }
  cpClientRevisionWithNote(postId, note);
}

async function cpSendMessage(){
  const input=document.getElementById('cp-msg-input');
  const text=input?.value.trim();
  if(!text||!cpActiveClientId) return;

  const chatTo=window._cpChatTo||'team';
  const cpSess=(() => { try{return JSON.parse(sessionStorage.getItem('dronehub_cp_session')||'null');}catch(e){return null;} })();
  const _cpClientRec=(typeof clients!=='undefined'?clients:[]).find(c=>String(c.id)===String(cpActiveClientId));
  const clientDisplayName=cpSess?.name||_cpClientRec?.name||'Client';

  // 1. Save to portal_msgs (client-side thread the client can read)
  savePortalMessage(cpActiveClientId,'client',text,{to:chatTo,by:clientDisplayName});

  // 2. Mirror into ops-side LouChat so the team sees it immediately.
  // Team messages go to the shared client channel; DMs to an admin get
  // their own channel so that person knows it's addressed to them.
  const isDm=chatTo!=='team';
  const dmSlug=isDm?chatTo.toLowerCase().replace(/[^a-z0-9]+/g,'_'):'';
  const lcChannelId=isDm?('lc_client_'+cpActiveClientId+'_dm_'+dmSlug):('lc_client_'+cpActiveClientId);
  let channels=getLcChannels();
  const existingCh=channels.find(c=>c.id===lcChannelId);
  if(!existingCh){
    channels.push({
      id:lcChannelId,
      name:isDm?(clientDisplayName.split(' ')[0]+' → '+chatTo.split(' ')[0]).toLowerCase():clientDisplayName.split(' ')[0].toLowerCase(),
      type:'client_dm',
      topic:isDm?('Private — '+clientDisplayName+' ↔ '+chatTo):('Direct messages from '+clientDisplayName),
      clientId:cpActiveClientId,
      clientName:clientDisplayName,
      adminName:isDm?chatTo:'',
      createdAt:new Date().toISOString().slice(0,10),
      members:[],
    });
    saveLcChannels(channels);
  } else if((existingCh.name==='client'||existingCh.clientName==='Client')&&clientDisplayName!=='Client'){
    // Repair channels created before the client name was known
    existingCh.name=clientDisplayName.split(' ')[0].toLowerCase();
    existingCh.clientName=clientDisplayName;
    existingCh.topic='Direct messages from '+clientDisplayName;
    saveLcChannels(channels);
  }
  saveLcMessage(lcChannelId,{
    id:Date.now(),
    author:clientDisplayName,
    text,
    ts:new Date().toISOString(),
    from:'client',
    clientId:cpActiveClientId,
    reactions:{},
  });
  addLcUnread(lcChannelId);

  input.value='';
  cpShowTab('messages');
}

// ─── PORTAL ACCOUNT MANAGEMENT (Settings) ────────────────────────────────────
function renderPortalAccounts(){
  const list=document.getElementById('cp-accounts-list');
  const sel=document.getElementById('cp-new-client-sel');
  if(!list) return;
  const accounts=getPortalAccounts();

  // Populate client selector
  if(sel){
    sel.innerHTML='<option value="">— Select client —</option>'+
      clients.map(c=>`<option value="${c.id}">${c.name}${c.email?' ('+c.email+')':''}</option>`).join('');
  }

  if(!accounts.length){
    list.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">No portal accounts created yet.</div>';
    return;
  }
  list.innerHTML=accounts.map(a=>{
    const c=clients.find(cl=>cl.id===a.clientId);
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--navy-lift);border-radius:8px;margin-bottom:6px;border:1px solid var(--border)">
      <div>
        <div style="font-size:12px;font-weight:600;color:var(--white)">${c?.name||'Unknown client'}</div>
        <div style="font-size:10px;color:var(--muted)">${c?.email||a.email||'no email'} · ${a.status==='invited'?'<span style="color:#F5C842">Invited</span>':'<span style="color:var(--green)">Active</span>'} · ${a.createdAt||'—'}</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <button id="cp-invite-btn-${a.clientId}" onclick="cpCopyInviteLink('${a.clientId}')" style="padding:4px 10px;border-radius:10px;border:1px solid var(--border);background:var(--navy);color:var(--muted);font-size:10px;cursor:pointer;font-weight:600">Copy Link</button>
        <button onclick="cpEmailInvite('${a.clientId}',this)" style="padding:4px 10px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:10px;cursor:pointer;font-weight:600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Email</button>
        <button onclick="previewPortalAs('${a.clientId}')" style="padding:4px 10px;border-radius:10px;border:1px solid var(--border);background:var(--navy);color:var(--muted);font-size:10px;cursor:pointer;font-weight:600">Preview</button>
        <button onclick="deletePortalAccount('${a.clientId}')" style="padding:4px 10px;border-radius:10px;border:1px solid var(--red);background:var(--red-bg);color:var(--red);font-size:10px;cursor:pointer;font-weight:600">Revoke</button>
      </div>
    </div>`;
  }).join('');
}

async function createPortalAccount(){
  const clientId=document.getElementById('cp-new-client-sel')?.value;
  const pass=document.getElementById('cp-new-pass')?.value.trim();
  const msg=document.getElementById('cp-create-msg');
  if(!clientId){msg.textContent='Please select a client.';msg.style.color='var(--red)';return;}
  if(!pass||pass.length<6){msg.textContent='Password must be at least 6 characters.';msg.style.color='var(--red)';return;}
  const accounts=getPortalAccounts();
  const existing=accounts.findIndex(a=>a.clientId===clientId);
  const _cpaClient=clients.find(c=>c.id===clientId);
  const _cpaEmail=(_cpaClient?.email||clientId).toLowerCase();
  const entry={clientId,email:_cpaEmail,passHash:await hashPass(_cpaEmail,pass),createdAt:new Date().toISOString().slice(0,10)};
  if(existing>=0) accounts[existing]=entry;
  else accounts.push(entry);
  savePortalAccounts(accounts);
  document.getElementById('cp-new-pass').value='';
  document.getElementById('cp-new-client-sel').value='';
  msg.textContent='✓ Account created!';msg.style.color='var(--green)';
  setTimeout(()=>msg.textContent='',2500);
  renderPortalAccounts();
}

function deletePortalAccount(clientId){
  if(!confirm('Revoke portal access for this client?')) return;
  const accounts=getPortalAccounts().filter(a=>a.clientId!==clientId);
  savePortalAccounts(accounts);
  renderPortalAccounts();
}

function previewPortalAs(clientId){
  // Admin previews the client's portal view without needing to log in
  cpActiveClientId=clientId;
  const c=clients.find(cl=>cl.id===clientId);
  document.getElementById('client-portal-root').style.display='block';
  document.getElementById('cp-login').style.display='none';
  document.getElementById('cp-dashboard').style.display='block';
  document.getElementById('cp-welcome-name').textContent=c?.name||'Client';
  // Show preview banner
  const banner=document.getElementById('preview-banner');
  const bannerName=document.getElementById('preview-banner-name');
  if(banner){ banner.style.display='block'; }
  if(bannerName) bannerName.textContent='Previewing as '+( c?.name||'Client');
  document.body.style.overflow='hidden';
  cpShowTab('overview');
}
function exitClientPortalPreview(){
  const banner=document.getElementById('preview-banner');
  if(banner) banner.style.display='none';
  exitClientPortal();
}

// Admin reply to client messages (from openClientDetail portal Assets tab or messages)
async function adminReplyMessage(clientId, text){
  if(!text) return;
  savePortalMessage(clientId,'team',text);
}

function adminSendReply(clientId){
  const input=document.getElementById('admin-msg-input-'+clientId);
  const text=input?.value.trim();
  if(!text) return;
  savePortalMessage(clientId,'team',text);
  input.value='';
  renderClientPortal(clientId,'messages');
}

let invoiceFilter='all';

function setInvoiceFilter(f){
  invoiceFilter=f;
  ['all','outstanding','overdue','paid'].forEach(k=>{
    const btn=document.getElementById('inv-btn-'+k);
    if(!btn) return;
    const active=k===f;
    btn.style.borderColor=active?'var(--blue)':'var(--border)';
    btn.style.background=active?'rgba(91,141,239,.15)':'var(--navy-lift)';
    btn.style.color=active?'var(--blue-bright)':'var(--offwhite)';
  });
  renderInvoiceTracker();
}

function getInvoiceStatus(job){
  // A job has been invoiced if it is confirmed or completed
  if(job.status==='quoted') return null;
  if(job.status==='completed'&&job.markedPaid) return 'paid';
  // Calculate due date: use job.invoicedAt if set, otherwise job.date + estimate
  const refDate=job.invoicedAt?new Date(job.invoicedAt):new Date(job.date||Date.now());
  const dueDate=new Date(refDate);
  dueDate.setDate(dueDate.getDate()+30);
  const now=new Date();
  const daysOverdue=Math.floor((now-dueDate)/(1000*60*60*24));
  if(job.markedPaid) return 'paid';
  if(daysOverdue>0) return 'overdue';
  return 'outstanding';
}

function calcCurrentOwed(job){
  const refDate=job.invoicedAt?new Date(job.invoicedAt):new Date(job.date||Date.now());
  const dueDate=new Date(refDate);
  dueDate.setDate(dueDate.getDate()+30);
  const now=new Date();
  const daysOverdue=Math.max(0,Math.floor((now-dueDate)/(1000*60*60*24)));
  const monthsLate=daysOverdue/30;
  if(monthsLate<=0) return {owed:job.grand,interest:0,daysOverdue:0};
  let amt=job.grand*Math.pow(1.02,monthsLate);
  const penaltyBlocks=Math.floor(monthsLate/6);
  if(penaltyBlocks>0) amt*=Math.pow(1.20,penaltyBlocks);
  return {owed:amt,interest:amt-job.grand,daysOverdue,monthsLate};
}

function renderInvoiceTracker(){
  const el=document.getElementById('invoice-tracker-list');
  if(!el) return;
  const fmtN=n=>'$'+Number(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});

  // Filter by financeMarket (canada = no market or market=canada; usa = any US market key)
  const isUSInv=financeMarket==='usa';
  const marketFilteredJobs=savedJobs.filter(j=>isUSInv?(j.market&&j.market!=='canada'):(!j.market||j.market==='canada'));
  // Exclude standalone tracker projects (no quote/invoice attached) — they have no dollar amounts
  const invoiced=marketFilteredJobs.filter(j=>(j.status==='confirmed'||j.status==='completed')&&!j.isStandalone&&j.grand!=null);
  const filtered=invoiced.filter(j=>{
    const st=getInvoiceStatus(j);
    if(invoiceFilter==='all') return true;
    return st===invoiceFilter;
  });

  // Summary counts
  const counts={outstanding:0,overdue:0,paid:0};
  const totals={outstanding:0,overdue:0,paid:0};
  invoiced.forEach(j=>{
    const st=getInvoiceStatus(j);
    if(st){counts[st]++;totals[st]+=(st==='overdue'?calcCurrentOwed(j).owed:j.grand);}
  });

  if(!filtered.length){
    el.innerHTML=`<div style="text-align:center;padding:24px;color:var(--muted);font-size:12px">${invoiceFilter==='all'?'No invoices yet — confirmed or completed jobs appear here.':'No '+invoiceFilter+' invoices.'}</div>`;
    return;
  }

  el.innerHTML=filtered.sort((a,b)=>{
    // Sort overdue first, then by date descending
    const sa=getInvoiceStatus(a), sb=getInvoiceStatus(b);
    if(sa==='overdue'&&sb!=='overdue') return -1;
    if(sb==='overdue'&&sa!=='overdue') return 1;
    return (b.date||'').localeCompare(a.date||'');
  }).map(j=>{
    const st=getInvoiceStatus(j);
    const {owed,interest,daysOverdue}=calcCurrentOwed(j);
    const client=j.clientId?clients.find(c=>c.id===j.clientId):null;
    const refDate=j.invoicedAt?new Date(j.invoicedAt):new Date(j.date||Date.now());
    const dueDate=new Date(refDate); dueDate.setDate(dueDate.getDate()+30);
    const dueDateStr=dueDate.toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});

    const stBadge=st==='paid'
      ?`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:var(--green-bg);color:var(--green)">PAID</span>`
      :st==='overdue'
      ?`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:var(--red-bg);color:var(--red)">OVERDUE ${daysOverdue}d</span>`
      :`<span style="padding:3px 10px;border-radius:10px;font-size:10px;font-weight:700;background:var(--amber-bg);color:var(--amber)">OUTSTANDING</span>`;

    const interestNote=st==='overdue'&&interest>0
      ?`<div style="font-size:11px;color:var(--red);margin-top:3px">⚠ Interest accrued: ${fmtN(interest)} — Total now owing: <strong>${fmtN(owed)}</strong></div>`:'';

    const paidBtn=st!=='paid'
      ?`<button onclick="markInvoicePaid(${j.id})" style="padding:4px 10px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:11px;cursor:pointer;font-weight:600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><polyline points="20 6 9 17 4 12"/></svg> Mark paid</button>`:'';
    const reminderBtn=st!=='paid'
      ?`<button onclick="openReminder(${j.id})" style="padding:4px 10px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;cursor:pointer;font-weight:600"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Remind</button>`:'';
    const invoiceBtn=`<button onclick="openInvoice(${j.id})" style="padding:4px 10px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:11px;cursor:pointer;font-weight:600"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Invoice</button>`;
    const editBtn=`<button onclick="openInvoiceJob('${j.id}')" style="padding:4px 10px;border-radius:10px;border:1px solid var(--amber);background:var(--amber-bg);color:var(--amber);font-size:11px;cursor:pointer;font-weight:600">✏ View &amp; edit</button>`;

    return `<div style="padding:12px 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:3px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;color:var(--white)">${j.name}</span>
          ${stBadge}
        </div>
        <div style="font-size:11px;color:var(--muted)">${j.date||''}${client?' · '+client.name:j.clientName?' · '+j.clientName:''} · Due ${dueDateStr}</div>
        ${interestNote}
      </div>
      <div style="text-align:right;min-width:0;max-width:100%">
        <div style="font-size:14px;font-weight:700;color:${st==='overdue'?'var(--red)':st==='paid'?'var(--green)':'var(--amber)'}">${fmtN(st==='overdue'?owed:j.grand)}</div>
        ${st==='overdue'?`<div style="font-size:10px;color:var(--muted)">orig. ${fmtN(j.grand)}</div>`:''}
        <div style="display:flex;gap:5px;margin-top:6px;justify-content:flex-end;flex-wrap:wrap">
          ${paidBtn}${reminderBtn}${editBtn}${invoiceBtn}
        </div>
      </div>
    </div>`;
  }).join('');
}

// Load a saved job back into the Quote Builder + Cost Model for viewing / editing
function openInvoiceJob(jobId){
  const job=savedJobs.find(j=>String(j.id)===String(jobId));
  if(!job){alert('Job not found.');return;}

  const isUSJob = job.market && job.market !== 'canada';

  // ── Restore client ──────────────────────────────────────────────────────────
  if(job.clientId){
    selectedClientId=job.clientId;
    const c=clients.find(c=>c.id===job.clientId);
    if(c){
      const si=document.getElementById('client-search-input');if(si)si.value=c.name;
      const sd=document.getElementById('client-selected-display');if(sd)sd.style.display='block';
      const sn=document.getElementById('client-selected-name');if(sn)sn.textContent=c.name+(c.company?' — '+c.company:'');
      const sm=document.getElementById('client-selected-meta');if(sm)sm.textContent=[c.email,c.phone].filter(Boolean).join(' · ');
    }
  }

  // ── Restore shared job fields ───────────────────────────────────────────────
  const fields={
    'job-name-input':job.name,'job-date-input':job.date,
    'job-time-input':job.shootTime,'job-duration-input':job.duration,
    'job-notes-input':job.notes,'job-currency-input':job.currency||(isUSJob?'usd':'cad')
  };
  Object.entries(fields).forEach(([id,val])=>{const el=document.getElementById(id);if(el&&val!=null)el.value=val;});

  // ── Restore address ─────────────────────────────────────────────────────────
  if(job.address&&job.address!=='(no address)'){
    propAddrText=job.address;
    const ad=document.getElementById('propAddrDisplay');if(ad)ad.textContent=job.address;
  }

  // ── Restore market selector ─────────────────────────────────────────────────
  const mktSel=document.getElementById('job-market-input');
  if(mktSel) mktSel.value=job.market||'canada';

  // ── Restore editors ─────────────────────────────────────────────────────────
  if(job.editors) Object.entries(job.editors).forEach(([k,v])=>{editors[k]=v||'';});
  // sel-video-editor removed from quote builder — editor assigned in Project Tracker

  if(isUSJob){
    // ── US market job: restore usQuoteState from job.usData ──────────────────
    const ud=job.usData||{};
    usQuoteState.market      = job.market;
    usQuoteState.pkgType     = ud.pkgType     || 'listing';
    usQuoteState.listingTier = ud.listingTier || null;
    usQuoteState.socialTier  = ud.socialTier  || null;
    usQuoteState.dayType     = ud.dayType     || null;
    usQuoteState.reelCount   = ud.reelCount   || 0;
    usQuoteState.reelsTBD    = ud.reelsTBD    || false;
    usQuoteState.dayLocations= (ud.dayLocations||[]).map(l=>({...l}));
    usQuoteState.offSeason   = ud.offSeason   || false;
    usQuoteState.addons      = Object.assign({sunrise:false,photoHDR:false,photoFlash:false}, ud.addons||{});

    // Sync DOM checkboxes so calcUS() reads correct values
    const sunEl=document.getElementById('us-addon-sunrise');
    const hdrEl=document.getElementById('us-addon-photoHDR');
    const flEl =document.getElementById('us-addon-photoFlash');
    const osEl =document.getElementById('us-offseason-check');
    if(sunEl) sunEl.checked = !!usQuoteState.addons.sunrise;
    if(hdrEl) hdrEl.checked = !!usQuoteState.addons.photoHDR;
    if(flEl)  flEl.checked  = !!usQuoteState.addons.photoFlash;
    if(osEl)  osEl.checked  = !!usQuoteState.offSeason;

    // Render location list if in day rate mode
    if(usQuoteState.pkgType==='day') renderUSDayLocations();

    // Switch to US panels and render
    onMarketChange(job.market);
    onContractorChange();

  } else {
    // ── Canada job: restore contractors from payout names ────────────────────
    const nameToKey=name=>Object.entries(CONTRACTORS).find(([k,c])=>c.name===name)?.[0]||'';
    if(job.payouts){
      const vidEntry=Object.entries(job.payouts).find(([k,p])=>(p.lines||[]).some(l=>(l.label||'').includes('Video')));
      const phoEntry=Object.entries(job.payouts).find(([k,p])=>(p.lines||[]).some(l=>(l.label||'').includes('Photo')));
      const fpEntry=Object.entries(job.payouts).find(([k,p])=>(p.lines||[]).some(l=>(l.label||'').includes('Floor')));
      const vk=vidEntry?nameToKey(vidEntry[1].name):'';
      const pk=phoEntry?nameToKey(phoEntry[1].name):'';
      const fk=fpEntry?nameToKey(fpEntry[1].name):'';
      if(vk){const s=document.getElementById('sel-videographer');if(s)s.value=vk;}
      if(pk){const s=document.getElementById('sel-photographer');if(s)s.value=pk;}
      if(fk){const s=document.getElementById('sel-floorplan');if(s)s.value=fk;}
    }

    // Restore sqft
    const sqftSlider=document.getElementById('sqftSlider');
    if(sqftSlider&&job.sqft){sqftSlider.value=job.sqft;const sv=document.getElementById('sqftVal');if(sv)sv.textContent=Number(job.sqft).toLocaleString()+' sqft';}

    // Restore services
    const svcs=job.services||{};const hrs=job.hours||{};
    Object.keys(svc).forEach(k=>{svc[k]=!!svcs[k];});
    Object.keys(qty).forEach(k=>{qty[k]=hrs[k]||1;});
    const togMap={video:'tog-video',photo:'tog-photo',tvideo:'tog-tvideo',tphoto:'tog-tphoto',
      reel:'tog-reel',extphoto:'tog-extphoto',extvideo:'tog-extvideo',
      floorplan:'tog-floorplan',randomvideo:'tog-randomvideo',randomphoto:'tog-randomphoto',
      rush:'tog-rush',custom:'tog-custom'};
    Object.entries(togMap).forEach(([k,id])=>{
      const btn=document.getElementById(id);
      if(btn){btn.classList.toggle('on',!!svc[k]);btn.textContent=svc[k]?'On':'Add';}
    });

    // Make sure Canada panels are visible
    onMarketChange('canada');
    onContractorChange();calc();
  }

  // ── Navigate to Quote Builder ───────────────────────────────────────────────
  document.querySelectorAll('.tab').forEach((t,i)=>{t.classList.toggle('active',i===0);});
  document.querySelectorAll('.pane').forEach(p=>p.classList.remove('active'));
  document.getElementById('pane-quote')?.classList.add('active');
  window.scrollTo({top:0,behavior:'smooth'});

  const toastMarket=isUSJob?'US — '+job.market:'Canada';
  const toast=document.createElement('div');
  toast.style.cssText='position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#242D42;border:1px solid #5B8DEF;color:#E8ECF8;padding:10px 22px;border-radius:20px;font-size:12px;font-weight:600;z-index:9999;box-shadow:0 4px 20px rgba(0,0,0,.4);white-space:nowrap';
  toast.textContent='✏ "'+job.name+'" loaded ('+toastMarket+') — edit and save to update';
  document.body.appendChild(toast);
  setTimeout(()=>toast.remove(),5000);
}


function markInvoicePaid(jobId){
  const job=savedJobs.find(j=>String(j.id)===String(jobId));
  if(!job) return;
  job.markedPaid=true;
  job.paidAt=new Date().toISOString().slice(0,10);
  saveJobsToStorage();
  renderInvoiceTracker();
  renderFinance();
}

// ─── REMINDER EMAIL ───────────────────────────────────────────────────────────
let reminderJobId=null;

function openReminder(jobId){
  const job=savedJobs.find(j=>String(j.id)===String(jobId));
  if(!job) return;
  reminderJobId=jobId;
  const fmtN=n=>'$'+Number(n).toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});
  const client=job.clientId?clients.find(c=>c.id===job.clientId):null;
  const clientName=client?.name||job.clientName||'';
  const clientEmail=client?.email||'';
  const {owed,interest,daysOverdue}=calcCurrentOwed(job);
  const st=getInvoiceStatus(job);
  const biz=bizSettings||{};

  const refDate=job.invoicedAt?new Date(job.invoicedAt):new Date(job.date||Date.now());
  const dueDate=new Date(refDate); dueDate.setDate(dueDate.getDate()+30);
  const dueDateStr=dueDate.toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});

  const subject=st==='overdue'
    ?`OVERDUE NOTICE — Invoice for ${job.name} — ${fmtN(owed)} now owing`
    :`Payment reminder — Invoice for ${job.name} — Due ${dueDateStr}`;

  const interestClause=st==='overdue'&&interest>0
    ?`\nPlease note that your balance has accrued ${fmtN(interest)} in late interest charges (2% monthly compounding), bringing the total now owing to ${fmtN(owed)}. Additional charges will continue to accrue until payment is received.\n`
    :'';

  const body=`Hi${clientName?' '+clientName.split(' ')[0]:''},\n\n`+
    (st==='overdue'
      ?`This is a notice that your invoice for "${job.name}" (${job.address}) is now ${daysOverdue} days overdue. The original invoice total was ${fmtN(job.grand)}, which was due on ${dueDateStr}.\n${interestClause}\nPlease arrange payment at your earliest convenience to avoid further interest charges.`
      :`This is a friendly reminder that your invoice for "${job.name}" (${job.address}) is due on ${dueDateStr}.\n\nInvoice total: ${fmtN(job.grand)}\n\nIf you have any questions, please don't hesitate to reach out.`)+
    `\n\n${biz.stripeUrl?'You can pay securely online here:\n'+biz.stripeUrl+'\n\n':''}`+
    `Thank you for your business!\n\n${biz.name||'DroneHub Media Company'}\n${biz.phone||''}\n${biz.email||''}\n${biz.website||''}`.trim();

  document.getElementById('reminder-to').value=clientEmail;
  document.getElementById('reminder-subject').value=subject;
  document.getElementById('reminder-body').value=body;
  updateReminderMailto();
  document.getElementById('reminder-overlay').style.display='block';
}

function updateReminderMailto(){
  const to=document.getElementById('reminder-to')?.value||'';
  const subject=encodeURIComponent(document.getElementById('reminder-subject')?.value||'');
  const body=encodeURIComponent(document.getElementById('reminder-body')?.value||'');
  const btn=document.getElementById('reminder-mailto-btn');
  if(btn) btn.href=`mailto:${to}?subject=${subject}&body=${body}`;
}

function closeReminder(){
  document.getElementById('reminder-overlay').style.display='none';
  document.getElementById('reminder-copy-msg').textContent='';
  reminderJobId=null;
}

function copyReminderText(){
  const subject=document.getElementById('reminder-subject')?.value||'';
  const body=document.getElementById('reminder-body')?.value||'';
  const text=`Subject: ${subject}\n\n${body}`;
  navigator.clipboard.writeText(text).then(()=>{
    const msg=document.getElementById('reminder-copy-msg');
    msg.textContent='Copied!';
    setTimeout(()=>msg.textContent='',2000);
  });
}

