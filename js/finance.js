// ── Market-specific categories ──────────────────────────────────────────────
const US_EXPENSE_CATS=['Bank Fee','Business Insurance','Car Maintenance','Contract','DroneHub Canada','Equipment','Fuel/EV','Gift','Golf','Meals & Entertainment','Miscellaneous','Office/Bedroom','Parking','Payroll','Payroll Fee','Payroll Tax','Personal','Reimbursements','Rent','Repair','Software Subscription','Supplies','Travel','Wise Fees','Zelle Payment'];
const US_TRANSFER_CATS=['Account Transfer','CC Payment','Cheque Deposit'];
const US_INCOME_CATS=['Invoice Payment','Miscellaneous Debit','Zelle Debit'];
const CA_EXPENSE_CATS=['Accounting','Advertisement','Auto Loan','Bank Fee','Contract','Equipment Lease','Equipment Purchase','Equipment Repair','Fuel/EV','Gift','Golf','Internet/Phone','Meals & Entertainment','Miscellaneous','Payroll Tax','Personal','Rent','Student Loan','Subscriptions','Supplies','Travel','Vehicle Insurance','Vehicle Maintenance'];
const CA_INCOME_CATS=['Transfer From US to Canada'];
const _NON_EXPENSE_CATS=new Set([...US_TRANSFER_CATS,...US_INCOME_CATS].map(c=>c.toLowerCase()));
function _isNonExpense(cat){return _NON_EXPENSE_CATS.has((cat||'').toLowerCase());}
function _isTransfer(cat){return US_TRANSFER_CATS.some(t=>t.toLowerCase()===(cat||'').toLowerCase());}
function _isIncomeCat(cat){return [...US_INCOME_CATS,...CA_INCOME_CATS].some(c=>c.toLowerCase()===(cat||'').toLowerCase());}
const _ALL_KNOWN_CATS=[...US_EXPENSE_CATS,...US_TRANSFER_CATS,...US_INCOME_CATS,...CA_EXPENSE_CATS,...CA_INCOME_CATS];
function _normalizeCat(raw){const match=_ALL_KNOWN_CATS.find(c=>c.toLowerCase()===(raw||'').toLowerCase());return match||raw;}
const ALL_EXPENSE_CATS=[...new Set([...US_EXPENSE_CATS,...CA_EXPENSE_CATS])].sort();
const ALL_CATS=[...new Set([...US_EXPENSE_CATS,...US_TRANSFER_CATS,...CA_EXPENSE_CATS])].sort();

// Overhead = 50% total: 21% profit + 5% CC/non-payment + 7% sales + 17% admin
const MARGIN=0.50,DRIVE_RATE=0.75,SHOOTER_DRIVE_RATE=0.73;
const ADMIN_RATE=0.17; // 17% admin — part of the 50% overhead, shown as a breakdown line
function adminCost(grossed){return Math.ceil(grossed*ADMIN_RATE);}
const RANDOM_VIDEO_RATE_CLIENT=200,RANDOM_VIDEO_RATE_CONTRACTOR=80;
const RANDOM_PHOTO_RATE_CLIENT=200,RANDOM_PHOTO_RATE_CONTRACTOR=80;
const RUSH_FEE=200;
const RANDOM_SHOOT_PAY=45,RANDOM_EDIT_PAY=35; // $45/hr to shooter, $35/hr to editor

// ── US MARKET PRICING ─────────────────────────────────────────────────────
const US_MARKET_PRICING={
  'new_york':{
    label:'New York',
    listing:{ under4k:1400, over4k:1600, over8k:2000 },
    social:{ r1:500, r2:900, r3:1200, r4:null, r5:null, fullDay:5000 },
    agentPromo:4000,
    exteriorOnly:750,
    addons:{ sunrise:500, photoHDR:500, photoFlash:1000 },
    reelAddon:400,
    offSeasonDiscount:1000,
  },
  'texas':{
    label:'Texas',
    listing:{ under4k:1250, over4k:1600, over8k:2000 },
    social:{ r1:500, r2:800, r3:1000, r4:null, r5:null, fullDay:5000 },
    agentPromo:4000,
    exteriorOnly:750,
    addons:{ sunrise:500, photoHDR:500, photoFlash:1000 },
    reelAddon:400,
    offSeasonDiscount:1000,
  },
  'arizona':{
    label:'Arizona',
    listing:{ under4k:1400, over4k:1600, over8k:2000 },
    social:{ r1:500, r2:900, r3:1200, r4:null, r5:null, fullDay:5000 },
    agentPromo:4000,
    exteriorOnly:750,
    addons:{ sunrise:500, photoHDR:500, photoFlash:1000 },
    reelAddon:400,
    offSeasonDiscount:1000,
  },
  'colorado':{
    label:'Colorado / Vail–Aspen',
    listing:{ under4k:1400, over4k:1600, over8k:2000 },
    social:{ r1:900, r2:null, r3:1500, r4:null, r5:2000, fullDay:5000 },
    agentPromo:4000,
    exteriorOnly:750,
    addons:{ sunrise:500, photoHDR:500, photoFlash:1000 },
    reelAddon:800,
    offSeasonDiscount:1000,
  },
  'other_us':{
    label:'Other US',
    listing:{ under4k:1400, over4k:1600, over8k:2000 },
    social:{ r1:500, r2:900, r3:1200, r4:null, r5:null, fullDay:5000 },
    agentPromo:4000,
    exteriorOnly:750,
    addons:{ sunrise:500, photoHDR:500, photoFlash:1000 },
    reelAddon:400,
    offSeasonDiscount:1000,
  },
};
// Social day rate (all US markets)
const US_SOCIAL_DAY={ halfDay:2500, fullDay:4000, reelRate:100 };

// US quote state — tracks current selections
let usQuoteState={
  market:null,          // key from US_MARKET_PRICING
  pkgType:null,         // 'listing' | 'social' | 'agent' | 'day'
  listingTier:null,     // 'under4k' | 'over4k' | 'over8k'
  socialTier:null,      // 'r1'|'r2'|'r3'|'r5'|'fullDay'
  dayType:null,         // 'half'|'full'
  reelCount:0,          // legacy single-count (kept for old job compatibility)
  listingReelCount:0,   // social reels added onto a Listing Video package
  reelsTBD:false,       // legacy flag
  dayLocations:[],      // [{address:string, reelCount:number}] — multi-location reel tracker
  addons:{ sunrise:false, photoHDR:false, photoFlash:false },
  offSeason:false,
};


function setFinanceSubTab(sub){
  const tabs = ['overview','invoices','payroll','contractors','expenses','loans'];
  tabs.forEach(t=>{
    const pane = document.getElementById('finance-sub-'+t);
    const btn  = document.getElementById('fin-sub-tab-'+t);
    const active = t === sub;
    if(pane) pane.style.display = active ? '' : 'none';
    if(btn){
      btn.style.borderBottomColor = active ? 'var(--blue-bright)' : 'transparent';
      btn.style.color = active ? 'var(--blue-bright)' : 'var(--muted)';
    }
  });
  try{localStorage.setItem('dronehub_finance_sub',sub);localStorage.setItem('dronehub_active_pane',sub==='overview'?'finance':sub==='payroll'?'payroll':'finance');}catch(e){}
  if(sub === 'payroll'){ refreshPayrollPeriods(); renderPayroll(); renderEmployeePayroll(); renderRemittanceSummary(); renderT4Summary(); }
  if(sub === 'invoices'){ renderInvoiceTracker && renderInvoiceTracker(); }
  if(sub === 'expenses'){ _updateExpCatDropdown(); _updateIncCatDropdown(); if(typeof renderExpenseList==='function') renderExpenseList(); if(typeof renderTransferList==='function') renderTransferList(); if(typeof renderIncomeList==='function') renderIncomeList(); if(typeof renderFinance==='function') renderFinance(); if(typeof plaidLoadItems==='function') plaidLoadItems(); }
  if(sub === 'contractors'){ populateCpContractorSelect(); renderContractorBreakdown(); }
  if(sub === 'loans'){ renderLoans(); }
}

// ── Historical contractor payments ───────────────────────────────────────────
let contractorPayHistory=JSON.parse(localStorage.getItem('dronehub_contractor_pay_history')||'[]');
function saveContractorPayHistory(){
  try{localStorage.setItem('dronehub_contractor_pay_history',JSON.stringify(contractorPayHistory));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':contractor_pay_history',{data:JSON.stringify(contractorPayHistory),updatedAt:Date.now()}).catch(()=>{});
  }
}
function populateCpContractorSelect(){
  const sel=document.getElementById('cp-contractor');
  if(!sel) return;
  const names=new Set();
  getAdminTeamMembers().forEach(m=>{if(m.name) names.add(m.name);});
  Object.values(CONTRACTORS||{}).forEach(c=>{if(c.name) names.add(c.name);});
  contractorPayHistory.forEach(p=>{if(p.name) names.add(p.name);});
  sel.innerHTML='<option value="">— Select —</option>'+
    [...names].sort().map(n=>`<option value="${n}">${n}</option>`).join('')+
    '<option value="__other__">Other (type name)</option>';
}
function addContractorPayment(){
  let name=document.getElementById('cp-contractor').value;
  if(name==='__other__'){
    name=prompt('Enter contractor name:');
    if(!name||!name.trim()) return;
    name=name.trim();
  }
  const date=document.getElementById('cp-date').value;
  const desc=document.getElementById('cp-desc').value.trim();
  const amount=parseFloat(document.getElementById('cp-amount').value);
  const market=document.getElementById('cp-market')?.value||'canada';
  if(!name||!date||!amount||amount<=0){alert('Please fill in contractor, date, and amount.');return;}
  contractorPayHistory.push({id:Date.now(),name,date,desc:desc||'Payment',amount,market});
  contractorPayHistory.sort((a,b)=>b.date.localeCompare(a.date));
  saveContractorPayHistory();
  document.getElementById('cp-desc').value='';
  document.getElementById('cp-amount').value='';
  showDhToast('Payment added','$'+amount.toFixed(2)+' to '+name,'✓','var(--green)');
  renderContractorBreakdown();
}
function deleteContractorPayment(id){
  contractorPayHistory=contractorPayHistory.filter(p=>p.id!==id);
  saveContractorPayHistory();renderContractorBreakdown();
}
function handleCpImportDrop(files){handleCpImportFile(files);}
function handleCpImportFile(files){
  const file=files&&files[0];
  if(!file) return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      let text=e.target.result;
      if(/\.xlsx?$/i.test(file.name)){
        if(typeof XLSX==='undefined'){alert('Excel library not loaded yet.');return;}
        const wb=XLSX.read(e.target.result,{type:'array'});
        text=XLSX.utils.sheet_to_csv(wb.Sheets[wb.SheetNames[0]]);
      }
      const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
      if(lines.length<2){alert('File must have a header row and at least one data row.');return;}
      // Detect delimiter: tab, comma, or semicolon
      const hdrLine=lines[0];
      const delim=hdrLine.includes('\t')?'\t':hdrLine.includes(';')?';':',';
      function splitRow(line){
        const cols=[];let cur='',inQ=false;
        for(let i=0;i<line.length;i++){
          const ch=line[i];
          if(ch==='"'){inQ=!inQ;continue;}
          if(ch===delim&&!inQ){cols.push(cur.trim());cur='';continue;}
          cur+=ch;
        }
        cols.push(cur.trim());
        return cols;
      }
      const headers=splitRow(hdrLine).map(h=>h.toLowerCase().replace(/['"]/g,''));
      console.log('[CSV Import] Detected headers:',headers,'delimiter:',JSON.stringify(delim));
      const nameIdx=headers.findIndex(h=>/name|contractor|employee|vendor|payee|recipient|worker/i.test(h));
      const dateIdx=headers.findIndex(h=>/date|period|when/i.test(h));
      const descIdx=headers.findIndex(h=>/desc|note|memo|detail|reference/i.test(h));
      const amtIdx=headers.findIndex(h=>/amount|total|paid|pay|sum|cost|fee|earning|net|gross/i.test(h));
      const mktIdx=headers.findIndex(h=>/country|market|currency|region/i.test(h));

      // Pivot table detection: contractor names as columns with "Total Amount" / "HST" sub-headers
      if(nameIdx<0||amtIdx<0){
        let pivotNames=null,pivotSubRow=null,pivotDataStart=-1;
        for(let r=0;r<Math.min(5,lines.length);r++){
          const row=splitRow(lines[r]);
          const nextRow=r+1<lines.length?splitRow(lines[r+1]):[];
          const hasAmtSub=nextRow.some(c=>/total.?amount|amount.*sum|gross|paid/i.test(c));
          if(hasAmtSub){
            pivotNames=row;pivotSubRow=nextRow;pivotDataStart=r+2;break;
          }
        }
        if(!pivotNames||pivotDataStart<0){
          alert('CSV must have at least a Name/Contractor and Amount column.\n\nDetected columns: '+headers.join(', ')+'\n\nExpected a column matching "name/contractor" and "amount/total/paid".');return;
        }
        // Build contractor map: [{name, amtCol, hstCol}]
        const contractors=[];
        for(let c=1;c<pivotNames.length;c++){
          const nm=pivotNames[c].trim();
          if(!nm||/grand.?total/i.test(nm)) continue;
          const sub=(pivotSubRow[c]||'').toLowerCase();
          if(/total.?amount|amount|sum|gross|paid/i.test(sub)){
            const hstCol=(c+1<pivotSubRow.length&&/hst|gst|tax/i.test(pivotSubRow[c+1]))?c+1:-1;
            contractors.push({name:nm,amtCol:c,hstCol});
          }
        }
        const dateCol=pivotSubRow.findIndex(h=>/date|period|ym/i.test(h));
        const descCol=pivotNames.findIndex(h=>/desc/i.test(h));
        const mkt=file.name.toLowerCase().includes('us')?'usa':'canada';
        let added=0;
        for(let i=pivotDataStart;i<lines.length;i++){
          const cols=splitRow(lines[i]);
          const rawDate=dateCol>=0?cols[dateCol]:'';
          const date=rawDate.replace(/\s.*$/,'');
          contractors.forEach(ct=>{
            const raw=(cols[ct.amtCol]||'').replace(/[^0-9.\-]/g,'');
            const amount=parseFloat(raw);
            if(!amount||amount<=0) return;
            const desc=descCol>=0&&cols[descCol]?cols[descCol]:'Imported payment';
            contractorPayHistory.push({id:Date.now()+Math.random(),name:ct.name,date,desc,amount,market:mkt});
            added++;
          });
        }
        if(added){
          contractorPayHistory.sort((a,b)=>b.date.localeCompare(a.date));
          saveContractorPayHistory();
          renderContractorBreakdown();
          document.getElementById('cp-import-status').textContent='✓ '+added+' payment'+(added!==1?'s':'')+' imported (pivot)';
          setTimeout(()=>{document.getElementById('cp-import-status').textContent='';},4000);
        }else{alert('No valid rows found in pivot table.');}
        return;
      }

      let added=0;
      for(let i=1;i<lines.length;i++){
        const cols=splitRow(lines[i]);
        const name=cols[nameIdx];
        const amount=parseFloat((cols[amtIdx]||'0').replace(/[^0-9.\-]/g,''));
        if(!name||!amount||amount<=0) continue;
        const date=dateIdx>=0?cols[dateIdx]:'';
        const desc=descIdx>=0?cols[descIdx]:'Imported payment';
        const mkt=mktIdx>=0&&/us|usd/i.test(cols[mktIdx])?'usa':'canada';
        contractorPayHistory.push({id:Date.now()+Math.random(),name,date,desc,amount,market:mkt});
        added++;
      }
      if(added){
        contractorPayHistory.sort((a,b)=>b.date.localeCompare(a.date));
        saveContractorPayHistory();
        renderContractorBreakdown();
        document.getElementById('cp-import-status').textContent='✓ '+added+' payment'+(added!==1?'s':'')+' imported';
        setTimeout(()=>{document.getElementById('cp-import-status').textContent='';},3000);
      }else{alert('No valid rows found.');}
    }catch(err){alert('Import error: '+err.message);}
  };
  if(/\.xlsx?$/i.test(file.name)) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
}

function renderContractorBreakdown(){
  const el = document.getElementById('contractor-breakdown-content');
  if(!el) return;
  const marketFilter = (document.getElementById('contractor-filter-market')||{}).value || 'all';

  // Build map: contractorName → { total, jobs: [{id, client, date, amount, market}] }
  const map = {};
  (savedJobs||[]).forEach(j=>{
    const m = j.market === 'canada' ? 'canada' : 'usa';
    if(marketFilter !== 'all' && m !== marketFilter) return;
    const rows = calcPay(j);
    rows.forEach(r=>{
      if(!r.name || r.total <= 0) return;
      if(!map[r.name]) map[r.name] = { total:0, jobs:[] };
      map[r.name].total += r.total;
      map[r.name].jobs.push({
        id: j.id,
        client: j.clientName || j.address || 'Unknown client',
        date: j.date || '',
        amount: r.total,
        market: m
      });
    });
  });

  // Add historical payments
  (contractorPayHistory||[]).forEach(p=>{
    const m=p.market==='usa'?'usa':'canada';
    if(marketFilter!=='all'&&m!==marketFilter) return;
    if(!p.name||!p.amount||p.amount<=0) return;
    if(!map[p.name]) map[p.name]={total:0,jobs:[]};
    map[p.name].total+=p.amount;
    map[p.name].jobs.push({id:'hist_'+p.id,client:p.desc||'Historical payment',date:p.date||'',amount:p.amount,market:m,isHistorical:true,histId:p.id});
  });

  const sorted = Object.entries(map).sort((a,b)=>b[1].total - a[1].total);

  if(!sorted.length){
    el.innerHTML = '<div class="card" style="color:var(--muted);font-size:13px;text-align:center;padding:32px">No contractor payout data found.</div>';
    return;
  }

  el.innerHTML = sorted.map(([name, data])=>{
    const jobRows = data.jobs.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(jb=>`
      <tr>
        <td style="padding:5px 10px;font-size:11px;color:var(--muted)">${jb.date||'—'}</td>
        <td style="padding:5px 10px;font-size:11px;color:var(--offwhite)">${jb.client}</td>
        <td style="padding:5px 10px;font-size:11px;color:var(--muted);text-align:center">${jb.market==='usa'?'🇺🇸':'🇨🇦'}</td>
        <td style="padding:5px 10px;font-size:11px;color:var(--green);text-align:right;font-weight:600">$${jb.amount.toFixed(2)}</td>
        <td style="padding:5px 10px;font-size:11px;text-align:center">${jb.isHistorical?`<button onclick="event.stopPropagation();deleteContractorPayment(${jb.histId});return false" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:12px;line-height:1" title="Delete">×</button>`:''}</td>
      </tr>`).join('');
    return `
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;cursor:pointer" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display==='none'?'':'none'">
        <div>
          <div style="font-size:14px;font-weight:700;color:var(--offwhite)">${name}</div>
          <div style="font-size:11px;color:var(--muted);margin-top:2px">${data.jobs.length} job${data.jobs.length!==1?'s':''}</div>
        </div>
        <div style="font-size:16px;font-weight:700;color:var(--green)">$${data.total.toFixed(2)}</div>
      </div>
      <div style="display:none;overflow-x:auto">
        <table style="width:100%;border-collapse:collapse">
          <thead>
            <tr style="border-bottom:1px solid var(--border)">
              <th style="padding:5px 10px;font-size:10px;color:var(--muted);text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Date</th>
              <th style="padding:5px 10px;font-size:10px;color:var(--muted);text-align:left;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Client</th>
              <th style="padding:5px 10px;font-size:10px;color:var(--muted);text-align:center;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Market</th>
              <th style="padding:5px 10px;font-size:10px;color:var(--muted);text-align:right;font-weight:600;text-transform:uppercase;letter-spacing:.06em">Paid</th>
            </tr>
          </thead>
          <tbody>${jobRows}</tbody>
        </table>
      </div>
    </div>`;
  }).join('');
}

function openModal(html,opts){
  let ov=document.getElementById('emp-modal-overlay');
  if(ov)ov.remove();
  ov=document.createElement('div');
  ov.id='emp-modal-overlay';
  ov.style.cssText='position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.6);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto';
  ov.onclick=function(e){if(e.target===ov)closeModal();};
  const box=document.createElement('div');
  var mw=(opts&&opts.maxWidth)||520;
  var mh=(opts&&opts.maxHeight)?';max-height:'+opts.maxHeight:'';
  var df=(opts&&opts.flex)?';display:flex;flex-direction:column':'';
  box.style.cssText='background:var(--navy-card);border-radius:16px;width:100%;max-width:'+mw+'px;border:1px solid var(--border-bright);overflow:hidden'+mh+df;
  box.innerHTML=html;
  ov.appendChild(box);
  document.body.appendChild(ov);
}
function closeModal(){
  const ov=document.getElementById('emp-modal-overlay');
  if(ov)ov.remove();
}

// ── Employee Payroll (with tax deductions) ──────────────────────────────────
let employeePayroll=JSON.parse(localStorage.getItem('dronehub_employee_payroll')||'[]');
function saveEmployeePayroll(){
  try{localStorage.setItem('dronehub_employee_payroll',JSON.stringify(employeePayroll));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':employee_payroll',{data:JSON.stringify(employeePayroll),updatedAt:Date.now()}).catch(()=>{});
  }
}

const EMP_DEDUCTION_FIELDS=[
  {key:'cpp',label:'CPP'},
  {key:'cpp2',label:'CPP2'},
  {key:'ei',label:'EI'},
  {key:'federalTax',label:'Federal Tax'},
  {key:'provincialTax',label:'Provincial Tax'},
  {key:'unionDues',label:'Union Dues'},
  {key:'benefits',label:'Benefits'},
  {key:'pension',label:'Pension'},
  {key:'garnishment',label:'Garnishment'},
  {key:'otherDeduction',label:'Other Deduction'}
];

function openAddEmployeePayStub(){
  const names=new Set();
  employeePayroll.forEach(p=>{if(p.employee) names.add(p.employee);});
  const teamMembers=getAdminTeamMembers?getAdminTeamMembers():[];
  teamMembers.forEach(m=>{if(m.name) names.add(m.name);});
  const opts=[...names].sort().map(n=>`<option value="${n}">${n}</option>`).join('');
  const deductionRows=EMP_DEDUCTION_FIELDS.map(f=>
    `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0">
      <label style="font-size:12px;color:var(--offwhite)">${f.label}</label>
      <input id="emp-ded-${f.key}" type="number" step="0.01" min="0" placeholder="0.00" style="width:100px;padding:4px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);text-align:right">
    </div>`
  ).join('');

  const manualHtml=`<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div>
        <div style="margin-bottom:10px">
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Employee</label>
          <input id="emp-pay-name" list="emp-pay-name-list" placeholder="Employee name" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
          <datalist id="emp-pay-name-list">${opts}</datalist>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Pay Date</label>
            <input id="emp-pay-date" type="date" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Pay Period</label>
            <input id="emp-pay-period" type="text" placeholder="e.g. Jun 1-15, 2026" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Hours Worked</label>
            <input id="emp-pay-hours" type="number" step="0.01" placeholder="0" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
          </div>
          <div>
            <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Pay Rate ($/hr)</label>
            <input id="emp-pay-rate" type="number" step="0.01" placeholder="0.00" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
          </div>
        </div>
        <div style="margin-bottom:10px">
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Gross Pay</label>
          <input id="emp-pay-gross" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-weight:700;background:var(--navy-mid);color:var(--green);box-sizing:border-box">
        </div>
        <div style="margin-bottom:10px">
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Net Pay (auto-calculated or override)</label>
          <input id="emp-pay-net" type="number" step="0.01" min="0" placeholder="Auto" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:14px;font-weight:700;background:var(--navy-mid);color:var(--blue-bright);box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:11px;color:var(--muted);display:block;margin-bottom:3px">Notes</label>
          <input id="emp-pay-notes" type="text" placeholder="Optional" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
        </div>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:8px">Deductions</div>
        ${deductionRows}
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:16px">
      <button onclick="submitEmployeePayStub()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--green);color:#000;font-size:13px;font-weight:700;cursor:pointer">Save Pay Stub</button>
      <button onclick="closeModal()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;cursor:pointer">Cancel</button>
    </div>`;

  const importHtml=`<div style="text-align:center;padding:20px 0">
      <div style="font-size:13px;color:var(--offwhite);margin-bottom:6px;font-weight:600">Import from Numbers/Excel/CSV</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:16px;line-height:1.5">Supports payroll sheets with employee names across the top and pay periods down the rows,<br>or flat CSV with columns: Employee Name, Pay Date, Gross Pay, CPP, EI, Federal Tax, Provincial Tax, Net Pay</div>
      <div id="emp-import-dropzone" onclick="document.getElementById('emp-import-file').click()" style="border:1.5px dashed var(--border-bright);border-radius:10px;padding:30px;text-align:center;cursor:pointer;transition:border-color .15s;margin:0 20px" ondragover="event.preventDefault();this.style.borderColor='var(--green)'" ondragleave="this.style.borderColor='var(--border-bright)'" ondrop="event.preventDefault();this.style.borderColor='var(--border-bright)';handleEmpPayImport(event.dataTransfer.files)">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" style="margin-bottom:6px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--green)" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 2v6h6M8 13h8M8 17h8M8 9h2" stroke="var(--green)" stroke-width="1.5" stroke-linecap="round"/></svg>
        <div style="font-size:12px;font-weight:600;color:var(--offwhite)">Drop file here or click to browse</div>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">.csv, .xlsx, .xls</div>
      </div>
      <input type="file" id="emp-import-file" accept=".csv,.xlsx,.xls" style="display:none" onchange="handleEmpPayImport(this.files)">
      <div id="emp-import-status" style="font-size:12px;margin-top:10px;color:var(--green)"></div>
    </div>`;

  const scanHtml=`<div style="padding:10px 0">
      <div style="font-size:13px;color:var(--offwhite);margin-bottom:4px;font-weight:600;text-align:center">Scan CRA Calculator Screenshots</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:14px;text-align:center;line-height:1.5">Upload screenshots from the CRA Payroll Deductions Online Calculator.<br>Upload in the same order on both sides — 1st salary pairs with 1st remittance.</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px" id="paystub-scan-zones">
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--blue-bright);margin-bottom:6px">1. Salary Calculations</div>
          <div id="paystub-scan-zone-1" onclick="document.getElementById('paystub-scan-input-1').click()" style="border:1.5px dashed var(--blue);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color .15s;background:rgba(91,141,239,.03);min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center" ondragover="event.preventDefault();this.style.borderColor='var(--green)'" ondragleave="this.style.borderColor='var(--blue)'" ondrop="event.preventDefault();this.style.borderColor='var(--blue)';_stagePaystubFiles(1,event.dataTransfer.files)">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="margin-bottom:4px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--blue-bright)" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="var(--blue-bright)" stroke-width="1.5"/></svg>
            <div style="font-size:11px;font-weight:600;color:var(--blue-bright)">Employee deductions</div>
            <div style="font-size:9px;color:var(--muted);margin-top:2px">Drop or click — multiple OK</div>
          </div>
          <input type="file" id="paystub-scan-input-1" accept="image/*" multiple style="display:none" onchange="_stagePaystubFiles(1,this.files)">
        </div>
        <div>
          <div style="font-size:11px;font-weight:700;color:var(--orange);margin-bottom:6px">2. Employer Remittances</div>
          <div id="paystub-scan-zone-2" onclick="document.getElementById('paystub-scan-input-2').click()" style="border:1.5px dashed var(--orange);border-radius:10px;padding:20px;text-align:center;cursor:pointer;transition:border-color .15s;background:rgba(255,152,56,.03);min-height:80px;display:flex;flex-direction:column;align-items:center;justify-content:center" ondragover="event.preventDefault();this.style.borderColor='var(--green)'" ondragleave="this.style.borderColor='var(--orange)'" ondrop="event.preventDefault();this.style.borderColor='var(--orange)';_stagePaystubFiles(2,event.dataTransfer.files)">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="margin-bottom:4px"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z" stroke="var(--orange)" stroke-width="1.5" stroke-linejoin="round"/><path d="M14 2v6h6" stroke="var(--orange)" stroke-width="1.5"/></svg>
            <div style="font-size:11px;font-weight:600;color:var(--orange)">Company remittance</div>
            <div style="font-size:9px;color:var(--muted);margin-top:2px">Drop or click — multiple OK</div>
          </div>
          <input type="file" id="paystub-scan-input-2" accept="image/*" multiple style="display:none" onchange="_stagePaystubFiles(2,this.files)">
        </div>
      </div>
      <div id="paystub-scan-submit" style="display:none;text-align:center;margin-top:12px">
        <button id="paystub-scan-submit-btn" onclick="_submitStagedPaystubs()" style="padding:10px 28px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--blue),var(--blue-dim));color:#fff;font-size:13px;font-weight:700;cursor:pointer">Scan Screenshots</button>
      </div>
      <div id="paystub-scan-spinner" style="display:none;text-align:center;padding:20px">
        <div id="paystub-scan-spinner-text" style="font-size:14px;color:var(--blue-bright);margin-bottom:6px">Scanning pay stubs...</div>
        <div id="paystub-scan-spinner-sub" style="font-size:11px;color:var(--muted)">AI is extracting payroll data</div>
      </div>
      <div id="paystub-scan-preview" style="display:none"></div>
    </div>`;

  const tabStyle='flex:1;padding:7px 0;border:none;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer';
  const html=`<div style="padding:16px 20px;border-bottom:1px solid var(--border)">
    <div style="font-size:16px;font-weight:700;color:var(--white)">Add Pay Stub</div>
    <div style="display:flex;gap:6px;margin-top:10px">
      <button id="ps-tab-manual" onclick="_psTab('manual')" style="${tabStyle};background:var(--green);color:#000">Manual Entry</button>
      <button id="ps-tab-import" onclick="_psTab('import')" style="${tabStyle};background:var(--navy-mid);color:var(--muted)">Import Excel/CSV</button>
      <button id="ps-tab-scan" onclick="_psTab('scan')" style="${tabStyle};background:var(--navy-mid);color:var(--muted)">Scan Screenshots</button>
    </div>
  </div>
  <div id="ps-tab-body" style="padding:16px 20px"></div>`;
  openModal(html,{maxWidth:750});
  window._psTabContent={manual:manualHtml,import:importHtml,scan:scanHtml};
  window._stagedPaystubs={1:[],2:[]};
  _psTab('manual');
}
function _psTab(tab){
  var body=document.getElementById('ps-tab-body');
  if(!body||!window._psTabContent)return;
  body.innerHTML=window._psTabContent[tab]||'';
  var tabs=['manual','import','scan'];
  tabs.forEach(function(t){
    var btn=document.getElementById('ps-tab-'+t);
    if(!btn)return;
    if(t===tab){btn.style.background='var(--green)';btn.style.color='#000';}
    else{btn.style.background='var(--navy-mid)';btn.style.color='var(--muted)';}
  });
}

function submitEmployeePayStub(){
  const employee=document.getElementById('emp-pay-name').value.trim();
  const date=document.getElementById('emp-pay-date').value;
  const period=document.getElementById('emp-pay-period').value.trim();
  const hours=parseFloat(document.getElementById('emp-pay-hours').value)||0;
  const rate=parseFloat(document.getElementById('emp-pay-rate').value)||0;
  const gross=parseFloat(document.getElementById('emp-pay-gross').value)||0;
  if(!employee||!date||!gross){alert('Employee, date, and gross pay are required.');return;}

  const deductions={};
  let totalDed=0;
  EMP_DEDUCTION_FIELDS.forEach(f=>{
    const v=parseFloat(document.getElementById('emp-ded-'+f.key).value)||0;
    if(v>0){deductions[f.key]=v;totalDed+=v;}
  });

  const netInput=document.getElementById('emp-pay-net').value;
  const net=netInput?parseFloat(netInput):+(gross-totalDed).toFixed(2);
  const notes=document.getElementById('emp-pay-notes').value.trim();

  employeePayroll.push({
    id:Date.now(),employee,date,period,hours,rate,gross,
    deductions,totalDeductions:totalDed,net,notes
  });
  employeePayroll.sort((a,b)=>b.date.localeCompare(a.date));
  saveEmployeePayroll();
  closeModal();
  renderEmployeePayroll();
  showDhToast&&showDhToast('Pay stub saved','Added for '+employee,'💰','var(--green)',3000);
}

function clearAllEmployeePayroll(){
  if(!confirm('Delete ALL employee pay stubs? This cannot be undone.'))return;
  employeePayroll=[];
  saveEmployeePayroll();
  renderEmployeePayroll();
  renderRemittanceSummary();
  showDhToast&&showDhToast('Cleared','All employee pay stubs deleted','🗑','var(--red)',3000);
}

function deleteEmployeePayStub(key){
  if(!confirm('Delete this pay stub?'))return;
  const s=window._empStubMap[key];
  if(!s)return;
  employeePayroll=employeePayroll.filter(p=>p.id!==s.id);
  saveEmployeePayroll();renderEmployeePayroll();renderRemittanceSummary();renderT4Summary();
}

function populateEmpPayFilters(){
  const empSel=document.getElementById('emp-pay-filter-employee');
  const yrSel=document.getElementById('emp-pay-filter-year');
  if(!empSel||!yrSel)return;
  const curEmp=empSel.value,curYr=yrSel.value;
  const names=new Set(),years=new Set();
  employeePayroll.forEach(p=>{
    if(p.employee)names.add(p.employee);
    if(p.date)years.add(p.date.slice(0,4));
  });
  empSel.innerHTML='<option value="">All employees</option>'+[...names].sort().map(n=>`<option${n===curEmp?' selected':''}>${n}</option>`).join('');
  yrSel.innerHTML='<option value="">All years</option>'+[...years].sort().reverse().map(y=>`<option${y===curYr?' selected':''}>${y}</option>`).join('');
}

function renderEmployeePayroll(){
  window._empStubMap={};window._empStubIdx=0;
  populateEmpPayFilters();
  const el=document.getElementById('employee-payroll-content');
  if(!el)return;
  const filterEmp=document.getElementById('emp-pay-filter-employee')?.value||'';
  const filterYr=document.getElementById('emp-pay-filter-year')?.value||'';
  let list=employeePayroll.slice();
  if(filterEmp)list=list.filter(p=>p.employee===filterEmp);
  if(filterYr)list=list.filter(p=>p.date&&p.date.startsWith(filterYr));

  if(!list.length){el.innerHTML='<div class="card" style="text-align:center;color:var(--muted);font-size:13px;padding:20px">No employee pay stubs yet</div>';return;}

  const byEmp={};
  list.forEach(p=>{
    if(!byEmp[p.employee])byEmp[p.employee]={stubs:[],totalGross:0,totalNet:0,totalDed:0,totalRemit:0};
    byEmp[p.employee].stubs.push(p);
    byEmp[p.employee].totalGross+=p.gross||0;
    byEmp[p.employee].totalNet+=p.net||0;
    byEmp[p.employee].totalDed+=p.totalDeductions||0;
    byEmp[p.employee].totalRemit+=p.dhRemittance||0;
  });

  el.innerHTML=Object.entries(byEmp).sort((a,b)=>{const la=a[1].stubs.reduce((m,s)=>s.date&&s.date>m?s.date:m,'');const lb=b[1].stubs.reduce((m,s)=>s.date&&s.date>m?s.date:m,'');return lb.localeCompare(la);}).map(([name,data])=>{
    const member=_findLinkedTeamMember(name);
    const anyLinked=data.stubs.some(s=>s.linkedEmail)||member;
    const linkBadge=anyLinked
      ?`<span style="display:inline-flex;align-items:center;gap:3px;background:rgba(34,217,122,.1);border:1px solid var(--green);border-radius:20px;padding:2px 8px;font-size:10px;color:var(--green);margin-left:8px"><span style="width:5px;height:5px;border-radius:50%;background:var(--green);display:inline-block"></span>${member?.email||data.stubs[0]?.linkedEmail||'linked'}</span>`
      :'';
    const uid='epd_'+name.replace(/[^a-zA-Z0-9]/g,'_');
    data.stubs.sort((a,b)=>(b.date||'').localeCompare(a.date||''));
    const stubCards=data.stubs.map(s=>{
      const sk='s'+(window._empStubIdx=(window._empStubIdx||0)+1);
      window._empStubMap[sk]=s;
      const mo=s.date?new Date(s.date+'T12:00:00').toLocaleString('en',{month:'short'}):' ';
      const day=s.date?s.date.slice(8,10):'';
      return `<div class="emp-stub-tile" data-sk="${sk}" style="background:var(--navy-lift);border:1px solid var(--border);border-radius:10px;padding:10px;cursor:pointer;transition:border-color .15s,transform .1s;min-width:0" onmouseover="this.style.borderColor='var(--blue)';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform=''">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">${mo} ${day}</div>
        <div style="font-size:14px;font-weight:700;color:var(--blue-bright);margin-bottom:2px">$${(s.net||0).toFixed(2)}</div>
        <div style="font-size:9px;color:var(--green)">Gross $${(s.gross||0).toFixed(2)}</div>
        ${s.dhRemittance?`<div style="font-size:9px;color:var(--orange)">CRA $${s.dhRemittance.toFixed(2)}</div>`:''}
      </div>`;
    }).join('');
    return `<div style="margin-bottom:8px;border:1px solid var(--border);border-radius:12px;overflow:hidden">
      <div onclick="(function(el){var b=document.getElementById('${uid}');var arr=el.querySelector('.ep-arrow');if(b.style.display==='none'){b.style.display='block';arr.style.transform='rotate(90deg)';}else{b.style.display='none';arr.style.transform='rotate(0deg)';}})(this)" style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;cursor:pointer;background:var(--navy-lift);user-select:none;flex-wrap:wrap;gap:4px" onmouseover="this.style.background='var(--navy-border)'" onmouseout="this.style.background='var(--navy-lift)'">
        <div style="display:flex;align-items:center;gap:8px"><span class="ep-arrow" style="color:var(--muted);font-size:12px;transition:transform .2s;display:inline-block;transform:rotate(0deg)">&#9654;</span><span style="font-size:15px;font-weight:700;color:var(--white)">${name}</span>${linkBadge}</div>
        <div style="font-size:11px;color:var(--muted)">${data.stubs.length} stubs · <span style="color:var(--green)">$${data.totalGross.toFixed(2)}</span> gross · <span style="color:var(--blue-bright)">$${data.totalNet.toFixed(2)}</span> net${data.totalRemit?` · <span style="color:var(--orange)">$${data.totalRemit.toFixed(2)}</span> remit`:''}</div>
      </div>
      <div id="${uid}" style="display:none;padding:12px 16px 16px">
        <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px">
          ${stubCards}
        </div>
      </div>
    </div>`;
  }).join('');

  el.querySelectorAll('.emp-stub-tile').forEach(tile=>{
    tile.addEventListener('click',function(){ viewEmployeePayStub(this.dataset.sk); });
  });
}

function _findLinkedTeamMember(name){
  const team=typeof getAdminTeamMembers==='function'?getAdminTeamMembers():[];
  const n=(name||'').toLowerCase().trim();
  return team.find(m=>(m.name||'').toLowerCase().trim()===n)||null;
}

function linkPayStubToAccount(key){
  const s=window._empStubMap[key];
  if(!s)return;
  const team=typeof getAdminTeamMembers==='function'?getAdminTeamMembers():[];
  if(!team.length){alert('No team members found.');return;}
  const opts=team.filter(m=>m.name).sort((a,b)=>(a.name||'').localeCompare(b.name||'')).map(m=>
    `<option value="${m.email||m.id}" ${(s.linkedEmail&&s.linkedEmail===(m.email||m.id))?'selected':''}>${m.name}${m.email?' ('+m.email+')':''}${m.role?' — '+m.role:''}</option>`
  ).join('');
  const html=`<div style="padding:20px;max-width:400px;margin:auto">
    <div style="font-size:16px;font-weight:700;color:var(--white);margin-bottom:12px">Link Pay Stub to Account</div>
    <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Stub: <strong style="color:var(--offwhite)">${s.employee}</strong> — ${s.date}</div>
    <select id="link-stub-sel" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box;margin-bottom:14px">
      <option value="">— Select team member —</option>${opts}
    </select>
    <div style="display:flex;gap:8px">
      <button onclick="(function(){
        const sel=document.getElementById('link-stub-sel');
        if(!sel.value)return;
        const team=(typeof getAdminTeamMembers==='function'?getAdminTeamMembers():[]);
        const m=team.find(t=>(t.email||t.id)===sel.value);
        if(!m)return;
        const stub=window._empStubMap['${key}'];
        if(stub){stub.linkedEmail=m.email||m.id;stub.linkedName=m.name;stub.linkedUserId=m.id||'';saveEmployeePayroll();renderEmployeePayroll();}
        closeModal();
      })()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--green);background:rgba(34,217,122,.1);color:var(--green);font-size:13px;font-weight:600;cursor:pointer">Link</button>
      <button onclick="closeModal()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;cursor:pointer">Cancel</button>
    </div>
  </div>`;
  openModal(html);
}

if(!window._empStubMap) window._empStubMap={};
function viewEmployeePayStub(key){
  const s=window._empStubMap[key];
  if(!s){alert('Stub not found — key: '+key);return;}

  const linked=s.linkedEmail?s:null;
  const member=_findLinkedTeamMember(s.employee);
  const acct=linked||member;
  const acctBadge=acct?`<div style="display:inline-flex;align-items:center;gap:4px;background:rgba(34,217,122,.1);border:1px solid var(--green);border-radius:20px;padding:3px 10px;font-size:10px;color:var(--green);margin-top:6px"><span style="width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block"></span> Linked to ${s.linkedEmail||member?.email||'account'}</div>`
    :`<button onclick="linkPayStubToAccount('${key}')" style="margin-top:6px;padding:3px 10px;border-radius:20px;border:1px dashed var(--border-bright);background:transparent;color:var(--muted);font-size:10px;cursor:pointer">Link to account</button>`;

  const workPay=s.vacationPay?(s.gross-s.vacationPay):0;
  const earningsRows=[];
  if(s.vacationPay&&workPay>0){
    earningsRows.push(`<tr><td style="padding:4px 10px;font-size:12px;color:var(--offwhite)">Working Pay</td><td style="padding:4px 10px;font-size:12px;color:var(--green);text-align:right">$${workPay.toFixed(2)}</td></tr>`);
    earningsRows.push(`<tr><td style="padding:4px 10px;font-size:12px;color:var(--offwhite)">Vacation Pay (4%)</td><td style="padding:4px 10px;font-size:12px;color:var(--green);text-align:right">$${s.vacationPay.toFixed(2)}</td></tr>`);
  }

  const dedRows=[];
  if(s.deductions){
    EMP_DEDUCTION_FIELDS.forEach(f=>{
      if(s.deductions[f.key]){
        const label=f.key==='cpp'?'CPP (Employee 50%)':f.key==='ei'?'EI (Employee)':f.label;
        dedRows.push(`<tr><td style="padding:4px 10px;font-size:12px;color:var(--offwhite)">${label}</td><td style="padding:4px 10px;font-size:12px;color:var(--red);text-align:right">-$${s.deductions[f.key].toFixed(2)}</td></tr>`);
      }
    });
  }

  const empContribRows=[];
  if(s.dhCpp) empContribRows.push(`<tr><td style="padding:4px 10px;font-size:12px;color:var(--offwhite)">CPP (Employer 50%)</td><td style="padding:4px 10px;font-size:12px;color:var(--orange);text-align:right">$${s.dhCpp.toFixed(2)}</td></tr>`);
  if(s.dhEi) empContribRows.push(`<tr><td style="padding:4px 10px;font-size:12px;color:var(--offwhite)">EI (Employer — DH)</td><td style="padding:4px 10px;font-size:12px;color:var(--orange);text-align:right">$${s.dhEi.toFixed(2)}</td></tr>`);

  const taxDed=(s.deductions?.federalTax||0)+(s.deductions?.provincialTax||0);

  const html=`<div style="padding:20px;max-width:480px;margin:auto">
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:4px">Pay Stub</div>
      <div style="font-size:20px;font-weight:800;color:var(--white)">${s.employee}</div>
      <div style="font-size:12px;color:var(--muted)">${s.date}${s.period?' · '+s.period:''}</div>
      ${acctBadge}
    </div>
    ${s.hours?`<div style="text-align:center;margin-bottom:12px;font-size:12px;color:var(--muted)">${s.hours} hours @ $${s.rate?.toFixed(2)||'0.00'}/hr</div>`:''}

    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Earnings</div>
      <div style="display:flex;justify-content:space-between;margin-bottom:${earningsRows.length?'6':'0'}px">
        <span style="font-size:14px;font-weight:700;color:var(--offwhite)">Total Cash Income (Gross)</span>
        <span style="font-size:14px;font-weight:700;color:var(--green)">$${(s.gross||0).toFixed(2)}</span>
      </div>
      ${earningsRows.length?`<table style="width:100%;border-collapse:collapse"><tbody>${earningsRows.join('')}</tbody></table>`:''}
    </div>

    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">Employee Deductions</div>
      ${dedRows.length?`<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tbody>${dedRows.join('')}</tbody></table>`:'<div style="font-size:12px;color:var(--muted)">None</div>'}
      ${taxDed?`<div style="border-top:1px solid var(--border);padding-top:6px;margin-top:4px;display:flex;justify-content:space-between"><span style="font-size:11px;color:var(--muted)">Tax Deductions (Fed + Prov)</span><span style="font-size:11px;color:var(--red)">-$${taxDed.toFixed(2)}</span></div>`:''}
      <div style="border-top:2px solid var(--border);padding-top:8px;margin-top:6px;display:flex;justify-content:space-between">
        <span style="font-size:13px;font-weight:700;color:var(--offwhite)">Total Deductions</span>
        <span style="font-size:13px;font-weight:700;color:var(--red)">-$${(s.totalDeductions||0).toFixed(2)}</span>
      </div>
    </div>

    <div style="background:linear-gradient(135deg,rgba(91,141,239,.15),rgba(91,141,239,.05));border:1px solid var(--blue);border-radius:10px;padding:14px;text-align:center;margin-bottom:10px">
      <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Net Pay (What ${s.employee.split(' ')[0]} Receives)</div>
      <div style="font-size:26px;font-weight:800;color:var(--blue-bright)">$${(s.net||0).toFixed(2)}</div>
    </div>

    ${empContribRows.length||s.dhRemittance?`<div style="background:var(--navy-lift);border:1px solid rgba(255,165,0,.2);border-radius:10px;padding:14px;margin-bottom:10px">
      <div style="font-size:11px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.06em;margin-bottom:6px">DroneHub Employer Contributions</div>
      ${empContribRows.length?`<table style="width:100%;border-collapse:collapse;margin-bottom:8px"><tbody>${empContribRows.join('')}</tbody></table>`:''}
      ${s.dhRemittance?`<div style="border-top:2px solid rgba(255,165,0,.2);padding-top:8px;display:flex;justify-content:space-between"><span style="font-size:13px;font-weight:700;color:var(--offwhite)">Total CRA Remittance</span><span style="font-size:13px;font-weight:700;color:var(--orange)">$${s.dhRemittance.toFixed(2)}</span></div>
      <div style="font-size:10px;color:var(--muted);margin-top:4px">Employee deductions + Employer CPP/EI remitted to CRA monthly</div>`:''}
    </div>`:''}

    <div style="display:flex;gap:8px;margin-top:14px">
      <button onclick="deleteEmployeePayStub('${key}');closeModal()" style="padding:10px;border-radius:10px;border:1px solid var(--red);background:rgba(240,82,82,.08);color:var(--red);font-size:12px;cursor:pointer;flex-shrink:0">Delete</button>
      <button onclick="closeModal()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;cursor:pointer">Close</button>
    </div>
  </div>`;
  openModal(html);
}

// Detect if spreadsheet is a pivoted payroll register (names across top, dates down left)
function _detectPivotedPayroll(rows){
  // Look for "DH Remittance" or "Remittance" in the first few rows as column headers
  // and payroll line-item labels like "Total Cash Income", "Net Amount", "Federal Deductions"
  const topRows=rows.slice(0,5);
  let hasRemittanceCols=false,hasPayrollLabels=false;
  for(const row of topRows){
    for(const cell of row){
      const s=(cell||'').toString().toLowerCase();
      if(s.includes('remittance')) hasRemittanceCols=true;
    }
  }
  for(let i=2;i<Math.min(rows.length,15);i++){
    const labelA=((rows[i]||[])[0]||'').toString().toLowerCase();
    const labelB=((rows[i]||[])[1]||'').toString().toLowerCase();
    const combined=labelA+' '+labelB;
    if(/total cash|net amount|federal ded|province ded|vacation|gross pay/i.test(combined)) hasPayrollLabels=true;
  }
  return hasRemittanceCols&&hasPayrollLabels;
}

// Import pivoted payroll register format (DroneHub's Numbers payroll sheets)
function _importPivotedPayroll(rows){
  // Find the header row with employee names (scan first 5 rows)
  // Layout: each employee has 2 columns — their column + "DH Remittance" column
  let nameRowIdx=-1,employees=[];
  for(let r=0;r<Math.min(rows.length,5);r++){
    const row=rows[r];
    const names=[];
    for(let c=2;c<row.length;c++){
      const val=(row[c]||'').toString().trim();
      if(val&&!/remittance|payroll|total|date/i.test(val)&&val.length>2&&/[a-z]/i.test(val)&&/\s/.test(val)){
        // Find the DH Remittance column — scan right for "DH Remittance" or "Remittance"
        let dhc=c+1;
        for(let dc=c+1;dc<Math.min(c+3,row.length);dc++){
          const dv=(row[dc]||'').toString().trim().toLowerCase();
          if(dv.includes('remittance')){dhc=dc;break;}
        }
        names.push({name:val,col:c,dhCol:dhc});
      }
    }
    if(names.length>=1){nameRowIdx=r;employees=names;break;}
  }
  if(!employees.length){
    alert('Could not find employee names in the header rows.');return 0;
  }
  console.log('[Payroll Import] Found employees:',employees.map(e=>e.name+' @col'+e.col+' dh@col'+e.dhCol));

  // Helper: parse Excel serial date number → YYYY-MM-DD
  function excelDateToISO(v){
    if(typeof v==='number'&&v>40000&&v<60000){
      const d=new Date(Math.round((v-25569)*86400000));
      if(!isNaN(d))return d.toISOString().slice(0,10);
    }
    const s=(v||'').toString().trim();
    if(/^\d{4}-\d{2}-\d{2}$/.test(s))return s;
    if(s){const d=new Date(s);if(!isNaN(d)&&d.getFullYear()>2000)return d.toISOString().slice(0,10);}
    return null;
  }

  // Payroll structure per pay period per employee:
  // Row: "Total Cash Income" / "CPP Remittance"  → empCol=Gross,  dhCol=Total CPP (split 50/50)
  // Row: "Federal Deductions" / "EI Contribution EM" → empCol=Federal Tax, dhCol=Employee EI
  // Row: "Province Deductions" / "EI Remittance DH"  → empCol=Provincial Tax, dhCol=Employer EI
  // Row: "Net Amount" / "Tax Deductions"              → empCol=Net Pay, dhCol=Total Tax Ded
  // Row: "Vacation" / "Total Remittance"              → empCol=Vacation Pay, dhCol=Total Remittance

  let count=0,currentDate=null;
  const block={};
  for(const emp of employees) block[emp.name]={};

  function flushBlock(){
    if(!currentDate)return;
    for(const emp of employees){
      const d=block[emp.name];
      if(!d||(!d.gross&&!d.net))continue;
      const gross=d.gross||0;
      const cppEmployee=d.totalCpp?+(d.totalCpp/2).toFixed(2):0; // 50/50 split
      const cppEmployer=d.totalCpp?+(d.totalCpp/2).toFixed(2):0;
      const eiEmployee=d.eiEmployee||0;
      const eiEmployer=d.eiEmployer||0;
      const federalTax=d.federalTax||0;
      const provincialTax=d.provincialTax||0;
      const vacation=d.vacation||0;
      const net=d.net||0;
      const totalRemittance=d.totalRemittance||0;

      const deductions={};
      let totalDed=0;
      if(cppEmployee){deductions.cpp=cppEmployee;totalDed+=cppEmployee;}
      if(eiEmployee){deductions.ei=eiEmployee;totalDed+=eiEmployee;}
      if(federalTax){deductions.federalTax=federalTax;totalDed+=federalTax;}
      if(provincialTax){deductions.provincialTax=provincialTax;totalDed+=provincialTax;}

      let notes='Imported from payroll spreadsheet';
      const extras=[];
      if(cppEmployer) extras.push('DH CPP: $'+cppEmployer.toFixed(2));
      if(eiEmployer) extras.push('DH EI: $'+eiEmployer.toFixed(2));
      if(totalRemittance) extras.push('Total CRA Remittance: $'+totalRemittance.toFixed(2));
      if(extras.length) notes+=' · '+extras.join(' · ');

      employeePayroll.push({
        id:Date.now()+Math.random(),employee:emp.name,date:currentDate,period:'',
        hours:0,rate:0,gross,deductions,totalDeductions:+totalDed.toFixed(2),
        net:net||+(gross-totalDed).toFixed(2),
        notes,vacationPay:vacation,
        dhCpp:cppEmployer,dhEi:eiEmployer,dhRemittance:totalRemittance
      });
      count++;
    }
    for(const emp of employees) block[emp.name]={};
  }

  for(let i=nameRowIdx+1;i<rows.length;i++){
    const row=rows[i]||[];
    const cellA=row[0],cellB=row[1];
    const strA=(cellA||'').toString().trim();
    const strB=(cellB||'').toString().trim();

    // Detect date row (column A has a date, column B is empty or also a date)
    const dateVal=excelDateToISO(cellA);
    if(dateVal&&(!strB||excelDateToISO(cellB))){
      flushBlock();
      currentDate=dateVal;
      for(const emp of employees) block[emp.name]={};
      continue;
    }

    if(!currentDate)continue;

    // Match row type by column A label
    const a=strA.toLowerCase(),b=strB.toLowerCase();

    for(const emp of employees){
      const empVal=parseFloat(row[emp.col])||0;
      const dhVal=parseFloat(row[emp.dhCol])||0;

      if(/total cash|gross/i.test(a)){
        // If gross already set, this is a second block (year-end totals) — flush first
        if(block[emp.name].gross){flushBlock();currentDate=currentDate;}
        if(empVal) block[emp.name].gross=empVal;
        if(dhVal) block[emp.name].totalCpp=dhVal;
      }
      else if(/federal/i.test(a)){
        if(empVal) block[emp.name].federalTax=empVal;
        if(dhVal) block[emp.name].eiEmployee=dhVal;
      }
      else if(/province|provincial/i.test(a)){
        if(empVal) block[emp.name].provincialTax=empVal;
        if(dhVal) block[emp.name].eiEmployer=dhVal;
      }
      else if(/net amount|net pay/i.test(a)){
        if(empVal) block[emp.name].net=empVal;
      }
      else if(/vacation/i.test(a)){
        if(empVal) block[emp.name].vacation=empVal;
        if(dhVal) block[emp.name].totalRemittance=dhVal;
      }
    }
  }
  flushBlock();

  // Post-process: detect and remove year-end summary/total rows
  // A summary row has gross ≈ sum of all other stubs for that employee in the same year
  if(count>2){
    const toRemove=new Set();
    const byEmpYear={};
    employeePayroll.forEach((s,i)=>{
      if(!s.notes||!s.notes.includes('Imported from payroll'))return;
      const yr=s.date?.slice(0,4);
      const key=s.employee+'_'+yr;
      if(!byEmpYear[key])byEmpYear[key]=[];
      byEmpYear[key].push({idx:i,stub:s});
    });
    Object.values(byEmpYear).forEach(stubs=>{
      if(stubs.length<3)return;
      // Find stub with the highest gross — likely the total row
      let maxIdx=-1,maxGross=0;
      stubs.forEach((s,i)=>{if((s.stub.gross||0)>maxGross){maxGross=s.stub.gross;maxIdx=i;}});
      if(maxIdx<0)return;
      // Sum all other stubs' gross
      let otherSum=0;
      stubs.forEach((s,i)=>{if(i!==maxIdx)otherSum+=s.stub.gross||0;});
      // If the max is within 5% of the sum of others, it's a summary row
      if(maxGross>0&&Math.abs(maxGross-otherSum)/otherSum<0.05){
        toRemove.add(stubs[maxIdx].stub.id);
        count--;
        console.log('[Payroll Import] Removed year-end total row for',stubs[maxIdx].stub.employee,stubs[maxIdx].stub.date,'gross:',maxGross);
      }
    });
    if(toRemove.size>0){
      employeePayroll=employeePayroll.filter(s=>!toRemove.has(s.id));
    }
  }

  return count;
}

// Import flat CSV format (Employee Name, Pay Date, Gross Pay, CPP, EI, etc.)
function _importFlatPayroll(rows){
  const hdr=rows[0].map(h=>(h||'').toString().toLowerCase().trim());
  const ci=(s)=>hdr.findIndex(h=>h.includes(s));
  const iName=Math.max(ci('employee'),ci('name'));
  const iDate=ci('date');
  const iGross=ci('gross');
  const iCpp=ci('cpp');
  const iEi=hdr.findIndex(h=>h==='ei'||h.includes('employment insurance'));
  const iFedTax=ci('federal');
  const iProvTax=ci('provincial');
  const iOtherDed=ci('other ded');
  const iNet=ci('net');
  const iHours=ci('hours');
  const iRate=ci('rate');
  const iDesc=Math.max(ci('description'),ci('period'));

  if(iName<0||iGross<0){
    alert('Flat CSV must have columns: Employee Name, Gross Pay\n\nDetected columns: '+hdr.join(', '));
    return 0;
  }

  let count=0;
  for(let i=1;i<rows.length;i++){
    const r=rows[i];
    const name=(r[iName]||'').toString().trim();
    let date=(r[iDate>=0?iDate:-1]||'').toString().trim();
    const gross=parseFloat(r[iGross])||0;
    if(!name||!gross)continue;
    if(date&&!/^\d{4}-/.test(date)){const d=new Date(date);if(!isNaN(d))date=d.toISOString().slice(0,10);}

    const deductions={};let totalDed=0;
    const addDed=(idx,key)=>{if(idx>=0){const v=parseFloat(r[idx])||0;if(v>0){deductions[key]=v;totalDed+=v;}}};
    addDed(iCpp,'cpp');addDed(iEi,'ei');addDed(iFedTax,'federalTax');addDed(iProvTax,'provincialTax');addDed(iOtherDed,'otherDeduction');
    EMP_DEDUCTION_FIELDS.forEach(f=>{
      if(!deductions[f.key]){
        const idx=hdr.findIndex(h=>h===f.key.toLowerCase()||h.includes(f.label.toLowerCase()));
        if(idx>=0){const v=parseFloat(r[idx])||0;if(v>0){deductions[f.key]=v;totalDed+=v;}}
      }
    });
    const netVal=iNet>=0?parseFloat(r[iNet])||+(gross-totalDed).toFixed(2):+(gross-totalDed).toFixed(2);
    const hours=iHours>=0?parseFloat(r[iHours])||0:0;
    const rate=iRate>=0?parseFloat(r[iRate])||0:0;
    const period=iDesc>=0?(r[iDesc]||'').toString().trim():'';

    employeePayroll.push({
      id:Date.now()+Math.random(),employee:name,date,period,hours,rate,
      gross,deductions,totalDeductions:totalDed,net:netVal,notes:'Imported from CSV'
    });
    count++;
  }
  return count;
}

function handleEmpPayImport(files){
  if(!files||!files.length)return;
  const file=files[0];
  const status=document.getElementById('emp-import-status');
  const reader=new FileReader();
  reader.onload=function(e){
    try{
      let rows;
      if(/\.xlsx?$/i.test(file.name)){
        if(typeof XLSX==='undefined'){alert('Excel library not loaded yet.');return;}
        const wb=XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        // Try all sheets — pick the one with "payroll" in the name, or first
        let sheet=wb.Sheets[wb.SheetNames[0]];
        for(const sn of wb.SheetNames){if(/payroll/i.test(sn)){sheet=wb.Sheets[sn];break;}}
        rows=XLSX.utils.sheet_to_json(sheet,{header:1,defval:''});
      }else{
        rows=e.target.result.split('\n').filter(r=>r.trim()).map(r=>r.split(',').map(c=>c.trim().replace(/^"|"$/g,'')));
      }
      if(rows.length<3){alert('Not enough data rows.');return;}

      // Detect format: pivoted payroll register vs flat CSV
      // Pivoted format has employee names in a header row with "DH Remittance" columns
      // and dates in column A with line items like "Total Cash Income", "Net Amount", etc.
      const isPivoted=_detectPivotedPayroll(rows);
      let count=0;
      if(isPivoted){
        count=_importPivotedPayroll(rows);
      }else{
        count=_importFlatPayroll(rows);
      }
      if(count>0){
        employeePayroll.sort((a,b)=>b.date.localeCompare(a.date));
        saveEmployeePayroll();
        renderEmployeePayroll();
        if(status)status.textContent='Imported '+count+' pay stub'+(count!==1?'s':'');
        showDhToast&&showDhToast('Import complete',count+' pay stubs imported','📊','var(--green)',3000);
      }else{alert('No valid rows found. Check that the spreadsheet format matches expectations.');}
    }catch(err){alert('Import error: '+err.message);}
  };
  if(/\.xlsx?$/i.test(file.name)) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
  document.getElementById('emp-import-file').value='';
}

// ── CRA Payroll Calculator (2026) ────────────────────────────────────────────
var _fedCfg2026={
  rate:0.14,bpa:16452,cea:1501,
  brackets:[
    {max:58523,rate:0.14,k:0},
    {max:117045,rate:0.205,k:3804},
    {max:181440,rate:0.26,k:10241},
    {max:258482,rate:0.29,k:15685},
    {max:Infinity,rate:0.33,k:26024}
  ],
  cppRate:0.0595,cppBase:0.0495,cppEnh:0.01,
  cppYBE:3500,cppYMPE:74600,
  cpp2Rate:0.04,cpp2YAMPE:85000,
  eiRate:0.0163,eiMIE:68900,eiEmployerMult:1.4
};
var _provCfg2026={
  AB:{name:'Alberta',bpa:22769,rate:0.08,brackets:[
    {max:61200,rate:0.08,k:0},{max:154259,rate:0.10,k:1224},{max:185111,rate:0.12,k:4309},
    {max:246813,rate:0.13,k:6160},{max:370220,rate:0.14,k:8628},{max:Infinity,rate:0.15,k:12331}]},
  BC:{name:'British Columbia',bpa:13216,rate:0.0506,brackets:[
    {max:50363,rate:0.0506,k:0},{max:100728,rate:0.077,k:1330},{max:115648,rate:0.105,k:4150},
    {max:140430,rate:0.1229,k:6220},{max:190405,rate:0.147,k:9604},{max:265545,rate:0.168,k:13603},
    {max:Infinity,rate:0.205,k:23428}],
    taxReduction:function(V1,A){var r=Math.max(0,575-0.0356*Math.max(0,A-25570));return Math.min(V1,r);}},
  SK:{name:'Saskatchewan',bpa:20381,rate:0.105,brackets:[
    {max:54532,rate:0.105,k:0},{max:155805,rate:0.125,k:1091},{max:Infinity,rate:0.145,k:4207}]},
  MB:{name:'Manitoba',bpa:15780,rate:0.108,brackets:[
    {max:47000,rate:0.108,k:0},{max:100000,rate:0.1275,k:917},{max:Infinity,rate:0.174,k:5567}]},
  ON:{name:'Ontario',bpa:12989,rate:0.0505,brackets:[
    {max:53891,rate:0.0505,k:0},{max:107785,rate:0.0915,k:2210},{max:150000,rate:0.1116,k:4376},
    {max:220000,rate:0.1216,k:5876},{max:Infinity,rate:0.1316,k:8076}],
    surtax:function(V1){return 0.20*Math.max(0,V1-5818)+0.36*Math.max(0,V1-7307);},
    healthPremium:function(A){
      if(A<=20000)return 0;if(A<=25000)return Math.min(300,0.06*(A-20000));
      if(A<=36000)return 300;if(A<=38500)return 300+0.06*(A-36000);
      if(A<=48000)return 450;if(A<=48600)return 450+0.25*(A-48000);
      if(A<=72000)return 600;if(A<=72600)return 600+0.25*(A-72000);
      if(A<=200600)return 750;if(A<=201200)return 750+0.25*(A-200600);return 900;}},
  NB:{name:'New Brunswick',bpa:13664,rate:0.094,brackets:[
    {max:52333,rate:0.094,k:0},{max:104666,rate:0.14,k:2407},{max:193861,rate:0.16,k:4501},
    {max:Infinity,rate:0.195,k:11286}]},
  NS:{name:'Nova Scotia',bpa:11932,rate:0.0879,brackets:[
    {max:30995,rate:0.0879,k:0},{max:61991,rate:0.1495,k:1909},{max:97417,rate:0.1667,k:2976},
    {max:157124,rate:0.175,k:3784},{max:Infinity,rate:0.21,k:9283}]},
  PE:{name:'Prince Edward Island',bpa:15000,rate:0.095,brackets:[
    {max:33928,rate:0.095,k:0},{max:65820,rate:0.1347,k:1347},{max:106890,rate:0.166,k:3407},
    {max:142250,rate:0.1762,k:4497},{max:200000,rate:0.19,k:6460},{max:Infinity,rate:0.20,k:8460}]},
  NL:{name:'Newfoundland and Labrador',bpa:13094,rate:0.087,brackets:[
    {max:44678,rate:0.087,k:0},{max:89354,rate:0.145,k:2591},{max:159528,rate:0.158,k:3753},
    {max:223340,rate:0.178,k:6943},{max:285319,rate:0.198,k:11410},{max:570638,rate:0.208,k:14263},
    {max:1141275,rate:0.213,k:17117},{max:Infinity,rate:0.218,k:22823}]},
  YT:{name:'Yukon',bpa:16452,rate:0.064,brackets:[
    {max:58523,rate:0.064,k:0},{max:117045,rate:0.09,k:1522},{max:181440,rate:0.109,k:3745},
    {max:500000,rate:0.128,k:7193},{max:Infinity,rate:0.15,k:18193}]},
  NT:{name:'Northwest Territories',bpa:18198,rate:0.059,brackets:[
    {max:53003,rate:0.059,k:0},{max:106009,rate:0.086,k:1431},{max:172346,rate:0.122,k:5247},
    {max:Infinity,rate:0.1405,k:8436}]},
  NU:{name:'Nunavut',bpa:19659,rate:0.04,brackets:[
    {max:55801,rate:0.04,k:0},{max:111602,rate:0.07,k:1674},{max:181439,rate:0.09,k:3906},
    {max:Infinity,rate:0.115,k:8442}]}
};
var _provOrder=['AB','BC','SK','MB','ON','NB','NS','PE','NL','YT','NT','NU'];
// ── US Payroll Calculator ────────────────────────────────────────────────────
var _usFedCfg2024={
  stdDed:{S:8600,MFJ:12900,HoH:8600},
  brackets:{
    S:[{max:6000,rate:0,k:0},{max:17600,rate:0.10,k:600},{max:53150,rate:0.12,k:952},
      {max:106525,rate:0.22,k:6267},{max:197950,rate:0.24,k:8397.50},{max:249725,rate:0.32,k:24233.50},
      {max:615350,rate:0.35,k:31725.25},{max:Infinity,rate:0.37,k:44032.25}],
    MFJ:[{max:16300,rate:0,k:0},{max:39500,rate:0.10,k:1630},{max:110600,rate:0.12,k:2420},
      {max:217350,rate:0.22,k:13480},{max:400200,rate:0.24,k:17827},{max:503750,rate:0.32,k:49843},
      {max:747500,rate:0.35,k:64955.50},{max:Infinity,rate:0.37,k:79905.50}],
    HoH:[{max:13300,rate:0,k:0},{max:29850,rate:0.10,k:1330},{max:76400,rate:0.12,k:1927},
      {max:113800,rate:0.22,k:9567},{max:205250,rate:0.24,k:11843},{max:257000,rate:0.32,k:28263},
      {max:622650,rate:0.35,k:35973},{max:Infinity,rate:0.37,k:48426}]
  },
  ssRate:0.062,ssWageBase:168600,
  medRate:0.0145,addMedRate:0.009,addMedThresh:200000,
  futaRate:0.006,futaWageBase:7000
};
var _usFedCfg2025={
  stdDed:{S:8600,MFJ:12900,HoH:8600},
  brackets:{
    S:[{max:6400,rate:0,k:0},{max:18325,rate:0.10,k:640},{max:54875,rate:0.12,k:1006.50},
      {max:109750,rate:0.22,k:6494},{max:203700,rate:0.24,k:8689},{max:256925,rate:0.32,k:24985},
      {max:632750,rate:0.35,k:32692.75},{max:Infinity,rate:0.37,k:45347.75}],
    MFJ:[{max:17100,rate:0,k:0},{max:40950,rate:0.10,k:1710},{max:114050,rate:0.12,k:2529},
      {max:223800,rate:0.22,k:13934},{max:411700,rate:0.24,k:18410},{max:518150,rate:0.32,k:51346},
      {max:768700,rate:0.35,k:66890.50},{max:Infinity,rate:0.37,k:82264.50}],
    HoH:[{max:13900,rate:0,k:0},{max:30900,rate:0.10,k:1390},{max:78750,rate:0.12,k:2008},
      {max:117250,rate:0.22,k:9883},{max:211200,rate:0.24,k:12228},{max:264400,rate:0.32,k:29124},
      {max:640250,rate:0.35,k:37056},{max:Infinity,rate:0.37,k:49861}]
  },
  ssRate:0.062,ssWageBase:176100,
  medRate:0.0145,addMedRate:0.009,addMedThresh:200000,
  futaRate:0.006,futaWageBase:7000
};
var _usFedCfg2026={
  stdDed:{S:8600,MFJ:12900,HoH:8600},
  brackets:{
    S:[{max:7500,rate:0,k:0},{max:19900,rate:0.10,k:750},{max:57900,rate:0.12,k:1148},
      {max:113200,rate:0.22,k:6938},{max:209275,rate:0.24,k:9202},{max:263725,rate:0.32,k:25944},
      {max:648100,rate:0.35,k:33855.75},{max:Infinity,rate:0.37,k:46817.75}],
    MFJ:[{max:19300,rate:0,k:0},{max:44100,rate:0.10,k:1930},{max:120100,rate:0.12,k:2812},
      {max:230700,rate:0.22,k:14822},{max:422850,rate:0.24,k:19436},{max:531750,rate:0.32,k:53264},
      {max:788000,rate:0.35,k:69216.50},{max:Infinity,rate:0.37,k:84976.50}],
    HoH:[{max:15550,rate:0,k:0},{max:33250,rate:0.10,k:1555},{max:83000,rate:0.12,k:2220},
      {max:121250,rate:0.22,k:10520},{max:217300,rate:0.24,k:12945},{max:271750,rate:0.32,k:30329},
      {max:656150,rate:0.35,k:38481.50},{max:Infinity,rate:0.37,k:51604.50}]
  },
  ssRate:0.062,ssWageBase:184500,
  medRate:0.0145,addMedRate:0.009,addMedThresh:200000,
  futaRate:0.006,futaWageBase:7000
};
var _usStateCfg2026={
  AL:{name:'Alabama',type:'prog',brackets:[
    {max:500,rate:0.02,k:0},{max:3000,rate:0.04,k:10},{max:Infinity,rate:0.05,k:40}]},
  AK:{name:'Alaska',type:'none'},
  AZ:{name:'Arizona',type:'flat',rate:0.025},
  AR:{name:'Arkansas',type:'prog',brackets:[
    {max:4600,rate:0.02,k:0},{max:Infinity,rate:0.039,k:87.40}]},
  CA:{name:'California',type:'prog',brackets:[
    {max:11079,rate:0.01,k:0},{max:26264,rate:0.02,k:110.79},{max:41452,rate:0.04,k:636.07},
    {max:57542,rate:0.06,k:1465.11},{max:72724,rate:0.08,k:2615.95},{max:371479,rate:0.093,k:3561.36},
    {max:445771,rate:0.103,k:7276.15},{max:742953,rate:0.113,k:11733.86},
    {max:1000000,rate:0.123,k:19163.39},{max:Infinity,rate:0.133,k:29163.39}]},
  CO:{name:'Colorado',type:'flat',rate:0.044},
  CT:{name:'Connecticut',type:'prog',brackets:[
    {max:10000,rate:0.03,k:0},{max:50000,rate:0.05,k:200},{max:100000,rate:0.055,k:450},
    {max:200000,rate:0.06,k:950},{max:500000,rate:0.065,k:1950},{max:Infinity,rate:0.0699,k:4400}]},
  DE:{name:'Delaware',type:'prog',brackets:[
    {max:2000,rate:0,k:0},{max:5000,rate:0.022,k:44},{max:10000,rate:0.039,k:129},
    {max:20000,rate:0.048,k:219},{max:25000,rate:0.052,k:299},{max:60000,rate:0.0555,k:386.50},
    {max:Infinity,rate:0.066,k:1016.50}]},
  FL:{name:'Florida',type:'none'},
  GA:{name:'Georgia',type:'flat',rate:0.0519},
  HI:{name:'Hawaii',type:'prog',brackets:[
    {max:9600,rate:0.014,k:0},{max:14400,rate:0.032,k:172.80},{max:19200,rate:0.055,k:504},
    {max:24000,rate:0.064,k:676.80},{max:36000,rate:0.068,k:772.80},{max:48000,rate:0.072,k:916.80},
    {max:125000,rate:0.076,k:1108.80},{max:175000,rate:0.079,k:1483.80},
    {max:225000,rate:0.0825,k:2096.30},{max:275000,rate:0.09,k:3783.80},
    {max:325000,rate:0.10,k:6533.80},{max:Infinity,rate:0.11,k:9783.80}]},
  ID:{name:'Idaho',type:'flat',rate:0.053},
  IL:{name:'Illinois',type:'flat',rate:0.0495},
  IN:{name:'Indiana',type:'flat',rate:0.0295},
  IA:{name:'Iowa',type:'flat',rate:0.038},
  KS:{name:'Kansas',type:'flat',rate:0.052},
  KY:{name:'Kentucky',type:'flat',rate:0.035},
  LA:{name:'Louisiana',type:'flat',rate:0.03},
  ME:{name:'Maine',type:'prog',brackets:[
    {max:27399,rate:0.058,k:0},{max:64849,rate:0.0675,k:260.29},{max:Infinity,rate:0.0715,k:519.69}]},
  MD:{name:'Maryland',type:'prog',brackets:[
    {max:1000,rate:0.02,k:0},{max:2000,rate:0.03,k:10},{max:3000,rate:0.04,k:30},
    {max:100000,rate:0.0475,k:52.50},{max:125000,rate:0.05,k:302.50},{max:150000,rate:0.0525,k:615},
    {max:250000,rate:0.055,k:990},{max:500000,rate:0.0575,k:1615},
    {max:1000000,rate:0.0625,k:4115},{max:Infinity,rate:0.065,k:6615}]},
  MA:{name:'Massachusetts',type:'prog',brackets:[
    {max:1083150,rate:0.05,k:0},{max:Infinity,rate:0.09,k:43326}]},
  MI:{name:'Michigan',type:'flat',rate:0.0425},
  MN:{name:'Minnesota',type:'prog',brackets:[
    {max:33310,rate:0.0535,k:0},{max:109430,rate:0.068,k:483},{max:203150,rate:0.0785,k:1632.02},
    {max:Infinity,rate:0.0985,k:5695.02}]},
  MS:{name:'Mississippi',type:'flat',rate:0.04},
  MO:{name:'Missouri',type:'prog',brackets:[
    {max:1348,rate:0,k:0},{max:2696,rate:0.02,k:26.96},{max:4044,rate:0.025,k:40.44},
    {max:5392,rate:0.03,k:60.66},{max:6740,rate:0.035,k:87.62},{max:8088,rate:0.04,k:121.32},
    {max:9436,rate:0.045,k:161.76},{max:Infinity,rate:0.047,k:180.63}]},
  MT:{name:'Montana',type:'prog',brackets:[
    {max:47500,rate:0.047,k:0},{max:Infinity,rate:0.0565,k:451.25}]},
  NE:{name:'Nebraska',type:'prog',brackets:[
    {max:4130,rate:0.0246,k:0},{max:24760,rate:0.0351,k:43.37},{max:Infinity,rate:0.0455,k:300.87}]},
  NV:{name:'Nevada',type:'none'},
  NH:{name:'New Hampshire',type:'none'},
  NJ:{name:'New Jersey',type:'prog',brackets:[
    {max:20000,rate:0.014,k:0},{max:35000,rate:0.0175,k:70},{max:40000,rate:0.035,k:682.50},
    {max:75000,rate:0.0553,k:1494.50},{max:500000,rate:0.0637,k:2124.50},
    {max:1000000,rate:0.0897,k:15124.50},{max:Infinity,rate:0.1075,k:32924.50}]},
  NM:{name:'New Mexico',type:'prog',brackets:[
    {max:5500,rate:0.015,k:0},{max:16500,rate:0.032,k:93.50},{max:33500,rate:0.043,k:275},
    {max:66500,rate:0.047,k:409},{max:210000,rate:0.049,k:542},{max:Infinity,rate:0.059,k:2642}]},
  NY:{name:'New York',type:'prog',brackets:[
    {max:8500,rate:0.04,k:0},{max:11700,rate:0.045,k:42.50},{max:13900,rate:0.0525,k:130.25},
    {max:80650,rate:0.055,k:165},{max:215400,rate:0.06,k:568.25},{max:1077550,rate:0.0685,k:2399.15},
    {max:5000000,rate:0.0965,k:32570.55},{max:25000000,rate:0.103,k:65070.55},
    {max:Infinity,rate:0.109,k:215070.55}]},
  NC:{name:'North Carolina',type:'flat',rate:0.0399},
  ND:{name:'North Dakota',type:'prog',brackets:[
    {max:48475,rate:0,k:0},{max:244825,rate:0.0195,k:945.26},{max:Infinity,rate:0.025,k:2291.80}]},
  OH:{name:'Ohio',type:'prog',brackets:[
    {max:26050,rate:0,k:0},{max:Infinity,rate:0.0275,k:716.38}]},
  OK:{name:'Oklahoma',type:'prog',brackets:[
    {max:3750,rate:0,k:0},{max:4900,rate:0.025,k:93.75},{max:7200,rate:0.035,k:142.75},
    {max:Infinity,rate:0.045,k:214.75}]},
  OR:{name:'Oregon',type:'prog',brackets:[
    {max:4550,rate:0.0475,k:0},{max:11400,rate:0.0675,k:91},{max:125000,rate:0.0875,k:319},
    {max:Infinity,rate:0.099,k:1756.50}]},
  PA:{name:'Pennsylvania',type:'flat',rate:0.0307},
  RI:{name:'Rhode Island',type:'prog',brackets:[
    {max:82050,rate:0.0375,k:0},{max:186450,rate:0.0475,k:820.50},{max:Infinity,rate:0.0599,k:3132.48}]},
  SC:{name:'South Carolina',type:'prog',brackets:[
    {max:3640,rate:0,k:0},{max:18230,rate:0.03,k:109.20},{max:Infinity,rate:0.06,k:656.10}]},
  SD:{name:'South Dakota',type:'none'},
  TN:{name:'Tennessee',type:'none'},
  TX:{name:'Texas',type:'none'},
  UT:{name:'Utah',type:'flat',rate:0.045},
  VT:{name:'Vermont',type:'prog',brackets:[
    {max:49400,rate:0.0335,k:0},{max:119700,rate:0.066,k:1605.50},{max:249700,rate:0.076,k:2802.50},
    {max:Infinity,rate:0.0875,k:5674.05}]},
  VA:{name:'Virginia',type:'prog',brackets:[
    {max:3000,rate:0.02,k:0},{max:5000,rate:0.03,k:30},{max:17000,rate:0.05,k:130},
    {max:Infinity,rate:0.0575,k:257.50}]},
  WA:{name:'Washington',type:'none'},
  WV:{name:'West Virginia',type:'prog',brackets:[
    {max:10000,rate:0.0222,k:0},{max:25000,rate:0.0296,k:74},{max:40000,rate:0.0333,k:166.50},
    {max:60000,rate:0.0444,k:610.50},{max:Infinity,rate:0.0482,k:838.50}]},
  WI:{name:'Wisconsin',type:'prog',brackets:[
    {max:15110,rate:0.035,k:0},{max:51950,rate:0.044,k:135.99},{max:332720,rate:0.053,k:603.54},
    {max:Infinity,rate:0.0765,k:8422.46}]},
  WY:{name:'Wyoming',type:'none'},
  DC:{name:'District of Columbia',type:'prog',brackets:[
    {max:10000,rate:0.04,k:0},{max:40000,rate:0.06,k:200},{max:60000,rate:0.065,k:400},
    {max:250000,rate:0.085,k:1600},{max:500000,rate:0.0925,k:3475},{max:1000000,rate:0.0975,k:5975},
    {max:Infinity,rate:0.1075,k:15975}]}
};
var _usStateOrder=['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];
var _usStateOverrides={
  2024:{
    AR:{name:'Arkansas',type:'prog',brackets:[
      {max:4400,rate:0.02,k:0},{max:8800,rate:0.04,k:88},{max:Infinity,rate:0.044,k:123.20}]},
    GA:{name:'Georgia',type:'flat',rate:0.0549},
    ID:{name:'Idaho',type:'flat',rate:0.058},
    IN:{name:'Indiana',type:'flat',rate:0.0305},
    IA:{name:'Iowa',type:'prog',brackets:[
      {max:6210,rate:0.044,k:0},{max:31050,rate:0.0482,k:26.08},{max:Infinity,rate:0.057,k:299.32}]},
    KS:{name:'Kansas',type:'prog',brackets:[
      {max:15000,rate:0.031,k:0},{max:30000,rate:0.0525,k:322.50},{max:Infinity,rate:0.057,k:457.50}]},
    KY:{name:'Kentucky',type:'flat',rate:0.04},
    LA:{name:'Louisiana',type:'prog',brackets:[
      {max:12500,rate:0.0185,k:0},{max:50000,rate:0.035,k:206.25},{max:Infinity,rate:0.0425,k:581.25}]},
    MS:{name:'Mississippi',type:'flat',rate:0.047},
    MT:{name:'Montana',type:'prog',brackets:[
      {max:20500,rate:0.047,k:0},{max:Infinity,rate:0.059,k:246}]},
    NC:{name:'North Carolina',type:'flat',rate:0.045},
    NE:{name:'Nebraska',type:'prog',brackets:[
      {max:3700,rate:0.0246,k:0},{max:22170,rate:0.0351,k:38.85},{max:35730,rate:0.0501,k:371.40},
      {max:Infinity,rate:0.0584,k:667.96}]},
    OH:{name:'Ohio',type:'prog',brackets:[
      {max:26050,rate:0,k:0},{max:92150,rate:0.0275,k:716.38},{max:Infinity,rate:0.035,k:1407.50}]},
    OK:{name:'Oklahoma',type:'prog',brackets:[
      {max:1000,rate:0.0025,k:0},{max:2500,rate:0.0075,k:5},{max:3750,rate:0.0175,k:30},
      {max:4900,rate:0.0275,k:67.50},{max:7200,rate:0.0375,k:116.50},{max:Infinity,rate:0.0475,k:188.50}]},
    SC:{name:'South Carolina',type:'prog',brackets:[
      {max:3460,rate:0,k:0},{max:17330,rate:0.03,k:103.80},{max:Infinity,rate:0.064,k:693.02}]},
    UT:{name:'Utah',type:'flat',rate:0.0465},
    WV:{name:'West Virginia',type:'prog',brackets:[
      {max:10000,rate:0.0236,k:0},{max:25000,rate:0.0296,k:60},{max:40000,rate:0.0333,k:152.50},
      {max:60000,rate:0.0444,k:596.50},{max:Infinity,rate:0.0512,k:1004.50}]}
  },
  2025:{
    GA:{name:'Georgia',type:'flat',rate:0.0539},
    ID:{name:'Idaho',type:'flat',rate:0.0569},
    IN:{name:'Indiana',type:'flat',rate:0.03},
    IA:{name:'Iowa',type:'flat',rate:0.039},
    KY:{name:'Kentucky',type:'flat',rate:0.04},
    MS:{name:'Mississippi',type:'flat',rate:0.044},
    MT:{name:'Montana',type:'prog',brackets:[
      {max:20500,rate:0.047,k:0},{max:Infinity,rate:0.059,k:246}]},
    NC:{name:'North Carolina',type:'flat',rate:0.0425},
    NE:{name:'Nebraska',type:'prog',brackets:[
      {max:3700,rate:0.0246,k:0},{max:22170,rate:0.0351,k:38.85},{max:35730,rate:0.0501,k:371.40},
      {max:Infinity,rate:0.0584,k:667.96}]},
    OH:{name:'Ohio',type:'prog',brackets:[
      {max:26050,rate:0,k:0},{max:92150,rate:0.0275,k:716.38},{max:Infinity,rate:0.035,k:1407.50}]},
    SC:{name:'South Carolina',type:'prog',brackets:[
      {max:3560,rate:0,k:0},{max:17780,rate:0.03,k:106.80},{max:Infinity,rate:0.062,k:675.76}]},
    UT:{name:'Utah',type:'flat',rate:0.0455}
  }
};
var _usFedCfgByYear={2024:_usFedCfg2024,2025:_usFedCfg2025,2026:_usFedCfg2026};
function _getUSFedCfg(year){return _usFedCfgByYear[year]||_usFedCfg2026;}
function _getUSStateCfg(year,code){
  var ov=_usStateOverrides[year];
  if(ov&&ov[code])return ov[code];
  return _usStateCfg2026[code]||_usStateCfg2026.CA;
}
function _payPeriods(freq){
  var m={Weekly:52,Biweekly:26,'Semi-monthly':24,Monthly:12};return m[freq]||26;
}
function _bracketTax(A,brackets){
  for(var i=0;i<brackets.length;i++){if(A<=brackets[i].max)return brackets[i].rate*A-brackets[i].k;}
  var last=brackets[brackets.length-1];return last.rate*A-last.k;
}
function _calcPayroll(params){
  var f=_fedCfg2026;
  var provCode=params.province||'ON';
  var p=_provCfg2026[provCode]||_provCfg2026.ON;
  var P=_payPeriods(params.payFrequency||'Biweekly');
  var salary=+(params.salary||0);
  var vacRate=+(params.vacationPayRate||0.04);
  var vacPay=+(salary*vacRate).toFixed(2);
  var gross=+(salary+vacPay).toFixed(2);
  var Ag=gross*P;
  var cppPensionable=Math.max(0,Math.min(Ag,f.cppYMPE)-f.cppYBE);
  var cppTotal=+(cppPensionable*f.cppRate).toFixed(2);
  var cppPer=+(cppTotal/P).toFixed(2);
  var cppBaseCr=cppPensionable*f.cppBase;
  var cppEnhDed=cppPensionable*f.cppEnh;
  var cpp2Pensionable=Math.max(0,Math.min(Ag,f.cpp2YAMPE)-f.cppYMPE);
  var cpp2Total=+(cpp2Pensionable*f.cpp2Rate).toFixed(2);
  var cpp2Per=+(cpp2Total/P).toFixed(2);
  var eiInsurable=Math.min(Ag,f.eiMIE);
  var eiTotal=+(eiInsurable*f.eiRate).toFixed(2);
  var eiPer=+(eiTotal/P).toFixed(2);
  var A=Ag-cppEnhDed;
  var fedTD1=+(params.federalTd1||f.bpa);
  var T3=_bracketTax(A,f.brackets);
  var K1=f.rate*fedTD1;
  var K2=f.rate*cppBaseCr;
  var K3=f.rate*eiTotal;
  var K4=f.rate*Math.min(A,f.cea);
  var T1=Math.max(0,T3-K1-K2-K3-K4);
  var fedTaxPer=+(T1/P).toFixed(2);
  var provTD1=+(params.provincialTd1||p.bpa);
  var V=_bracketTax(A,p.brackets);
  var K1P=p.rate*provTD1;
  var K2P=p.rate*cppBaseCr;
  var K3P=p.rate*eiTotal;
  var V1=Math.max(0,V-K1P-K2P-K3P);
  var V2=p.surtax?p.surtax(V1):0;
  var S1=p.taxReduction?p.taxReduction(V1,A):0;
  var LCP=p.healthPremium?p.healthPremium(A):0;
  var provTaxPer=+(Math.max(0,V1-S1+V2+LCP)/P).toFixed(2);
  var totalTax=+(fedTaxPer+provTaxPer).toFixed(2);
  var totalDed=+(fedTaxPer+provTaxPer+cppPer+cpp2Per+eiPer).toFixed(2);
  var net=+(gross-totalDed).toFixed(2);
  var cppEmployer=cppPer;
  var cpp2Employer=cpp2Per;
  var eiEmployer=+(eiPer*f.eiEmployerMult).toFixed(2);
  var totalRemit=+(fedTaxPer+provTaxPer+cppPer+cppEmployer+cpp2Per+cpp2Employer+eiPer+eiEmployer).toFixed(2);
  return {
    salary:salary,vacationPay:vacPay,gross:gross,
    federalTax:fedTaxPer,provincialTax:provTaxPer,totalTax:totalTax,
    cppEmployee:cppPer,cpp2Employee:cpp2Per,eiEmployee:eiPer,
    totalDeductions:totalDed,net:net,
    cppEmployer:cppEmployer,cpp2Employer:cpp2Employer,eiEmployer:eiEmployer,
    totalRemittance:totalRemit,
    payFrequency:params.payFrequency||'Biweekly',
    employeeName:params.employeeName||'',payDate:params.payDate||'',
    province:provCode,provinceName:p.name,
    federalTd1:fedTD1,provincialTd1:provTD1
  };
}
function _calcUSPayroll(params){
  var yr=parseInt((params.payDate||'').substring(0,4))||2026;
  if(yr<2024)yr=2024;if(yr>2026)yr=2026;
  var uf=_getUSFedCfg(yr);
  var stCode=params.state||'CA';
  var st=_getUSStateCfg(yr,stCode);
  var filing=params.filing||'S';
  var P=_payPeriods(params.payFrequency||'Biweekly');
  var gross=+(params.gross||0);
  var pretax=+(params.pretaxDeductions||0);
  var Ag=gross*P;
  var taxableAg=Math.max(0,(gross-pretax)*P);
  var stdDed=uf.stdDed[filing]||uf.stdDed.S;
  var fedTaxable=Math.max(0,taxableAg-stdDed);
  var fedBrackets=uf.brackets[filing]||uf.brackets.S;
  var fedAnnual=_bracketTax(fedTaxable,fedBrackets);
  var addlW=+(params.additionalWithholding||0);
  var fedTaxPer=+(Math.max(0,fedAnnual)/P+addlW).toFixed(2);
  var ssAnnual=Math.min(Ag,uf.ssWageBase)*uf.ssRate;
  var ssPer=+(ssAnnual/P).toFixed(2);
  var medAnnual=Ag*uf.medRate;
  var addMed=Math.max(0,Ag-uf.addMedThresh)*uf.addMedRate;
  var medPer=+((medAnnual+addMed)/P).toFixed(2);
  var stateTaxPer=0;
  if(st.type==='flat'){
    stateTaxPer=+(Math.max(0,taxableAg)*st.rate/P).toFixed(2);
  }else if(st.type==='prog'){
    stateTaxPer=+(Math.max(0,_bracketTax(Math.max(0,taxableAg),st.brackets))/P).toFixed(2);
  }
  var totalTax=+(fedTaxPer+stateTaxPer).toFixed(2);
  var totalDed=+(fedTaxPer+stateTaxPer+ssPer+medPer).toFixed(2);
  var net=+(gross-pretax-totalDed).toFixed(2);
  var ssEmployer=+(Math.min(Ag,uf.ssWageBase)*uf.ssRate/P).toFixed(2);
  var medEmployer=+(Ag*uf.medRate/P).toFixed(2);
  var futaPer=+(Math.min(Ag,uf.futaWageBase)*uf.futaRate/P).toFixed(2);
  var totalRemit=+(fedTaxPer+stateTaxPer+ssPer+ssEmployer+medPer+medEmployer+futaPer).toFixed(2);
  return {
    gross:gross,pretaxDeductions:pretax,
    federalTax:fedTaxPer,stateTax:stateTaxPer,totalTax:totalTax,
    socialSecurity:ssPer,medicare:medPer,
    totalDeductions:totalDed,net:net,
    ssEmployer:ssEmployer,medEmployer:medEmployer,futaEmployer:futaPer,
    totalRemittance:totalRemit,
    payFrequency:params.payFrequency||'Biweekly',
    employeeName:params.employeeName||'',payDate:params.payDate||'',
    state:stCode,stateName:st.name,filing:filing,
    country:'US',taxYear:yr
  };
}
function _openPayrollCalc(){
  var names=new Set();
  employeePayroll.forEach(function(p){if(p.employee)names.add(p.employee);});
  var teamMembers=typeof getAdminTeamMembers==='function'?getAdminTeamMembers():[];
  teamMembers.forEach(function(m){if(m.name)names.add(m.name);});
  var opts=[...names].sort().map(function(n){return'<option value="'+n+'">'+n+'</option>';}).join('');
  var lastEmp=employeePayroll.length?employeePayroll[employeePayroll.length-1]:null;
  var defTD1F=lastEmp&&lastEmp._fedTd1?lastEmp._fedTd1:16452;
  var defProv=lastEmp&&lastEmp._provCode?lastEmp._provCode:'ON';
  var defTD1P=lastEmp&&lastEmp._provTd1?lastEmp._provTd1:(_provCfg2026[defProv]||_provCfg2026.ON).bpa;
  var provOpts=_provOrder.map(function(code){var pc=_provCfg2026[code];return'<option value="'+code+'"'+(code===defProv?' selected':'')+'>'+pc.name+'</option>';}).join('');
  window._pcCountry='CA';window._pcNameOpts=opts;window._pcDefProv=defProv;window._pcDefTD1F=defTD1F;window._pcDefTD1P=defTD1P;window._pcProvOpts=provOpts;
  openModal('<div style="padding:16px 20px;border-bottom:1px solid var(--border)"><div style="font-size:16px;font-weight:700;color:var(--white)">Payroll Calculator</div><div style="display:flex;gap:8px;margin-top:8px"><button id="pc-tab-ca" onclick="_pcSwitchCountry(\'CA\')" style="flex:1;padding:7px 0;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:var(--green);color:#000">🇨🇦 Canada</button><button id="pc-tab-us" onclick="_pcSwitchCountry(\'US\')" style="flex:1;padding:7px 0;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:var(--navy-mid);color:var(--muted)">🇺🇸 United States</button></div></div><div style="max-height:70vh;overflow-y:auto;padding:16px 20px"><div id="pc-subtitle" style="font-size:11px;color:var(--muted);margin-bottom:10px;text-align:center">CRA 2026 · T4127 formulas · All provinces &amp; territories</div><div id="pc-form-body">'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label style="font-size:12px;color:var(--muted)">Employee Name</label>'
    +'<input id="pc-name" list="pc-names-list" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px" placeholder="e.g. Alex Shewan">'
    +'<datalist id="pc-names-list"><option value="">'+opts+'</datalist></div>'
    +'<div><label style="font-size:12px;color:var(--muted)">Province / Territory</label><select id="pc-prov" onchange="_pcProvChange()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px">'+provOpts+'</select></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label style="font-size:12px;color:var(--muted)">Pay Date</label><input id="pc-date" type="date" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px"></div>'
    +'<div><label style="font-size:12px;color:var(--muted)">Pay Frequency</label><select id="pc-freq" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px"><option value="Weekly">Weekly (52)</option><option value="Biweekly" selected>Biweekly (26)</option><option value="Semi-monthly">Semi-monthly (24)</option><option value="Monthly">Monthly (12)</option></select></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label style="font-size:12px;color:var(--muted)">Salary / Wages</label><input id="pc-salary" type="number" step="0.01" min="0" placeholder="0.00" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px;text-align:right"></div>'
    +'<div><label style="font-size:12px;color:var(--muted)">Vacation Pay %</label><input id="pc-vac" type="number" step="0.5" min="0" max="100" value="4" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px;text-align:right"></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label style="font-size:12px;color:var(--muted)">Federal TD1 Claim</label><input id="pc-td1f" type="number" step="0.01" value="'+defTD1F+'" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px;text-align:right"></div>'
    +'<div><label style="font-size:12px;color:var(--muted)">Provincial TD1 Claim</label><input id="pc-td1p" type="number" step="0.01" value="'+defTD1P+'" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px;text-align:right"></div></div>'
    +'</div><div style="text-align:center;margin:14px 0 10px"><button onclick="_pcCalc()" style="padding:9px 30px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--green),#1aae5f);color:#000;font-size:13px;font-weight:700;cursor:pointer">Calculate Deductions</button></div>'
    +'<div id="pc-results" style="display:none"></div>'
    +'</div>');
}
function _pcProvChange(){
  var code=document.getElementById('pc-prov').value;
  var p=_provCfg2026[code];
  if(p)document.getElementById('pc-td1p').value=p.bpa;
}
function _runPayrollCalc(){
  try{
  var name=document.getElementById('pc-name').value.trim();
  var date=document.getElementById('pc-date').value;
  var salary=parseFloat(document.getElementById('pc-salary').value)||0;
  if(!name){showDhToast('Missing Field','Enter employee name','⚠️','var(--orange)');return;}
  if(!date){showDhToast('Missing Field','Enter pay date','⚠️','var(--orange)');return;}
  if(!salary){showDhToast('Missing Field','Enter salary amount','⚠️','var(--orange)');return;}
  var provCode=document.getElementById('pc-prov').value||'ON';
  var pCfg=_provCfg2026[provCode]||_provCfg2026.ON;
  var r=_calcPayroll({
    employeeName:name,payDate:date,
    salary:salary,
    vacationPayRate:(parseFloat(document.getElementById('pc-vac').value)||0)/100,
    payFrequency:document.getElementById('pc-freq').value,
    province:provCode,
    federalTd1:parseFloat(document.getElementById('pc-td1f').value)||_fedCfg2026.bpa,
    provincialTd1:parseFloat(document.getElementById('pc-td1p').value)||pCfg.bpa
  });
  window._lastPayrollCalc=r;
  var el=document.getElementById('pc-results');
  el.style.display='';
  el.innerHTML='<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-top:4px">'
    +'<div style="background:rgba(34,217,122,.08);padding:10px 14px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:700;color:var(--green)">'+r.employeeName+'</span><span style="font-size:11px;color:var(--muted)">'+r.payDate+' · '+r.payFrequency+' · '+(r.provinceName||r.province)+'</span></div>'
    +'<div style="padding:12px 14px;font-size:12px">'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>Salary / Wages</span><span>$'+r.salary.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>Vacation Pay</span><span>$'+r.vacationPay.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);font-weight:700;color:var(--blue-bright)"><span>Total Cash Income</span><span>$'+r.gross.toFixed(2)+'</span></div>'
    +'<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>Federal Tax</span><span>$'+r.federalTax.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>Provincial Tax</span><span>$'+r.provincialTax.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>CPP</span><span>$'+r.cppEmployee.toFixed(2)+'</span></div>'
    +(r.cpp2Employee?'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>CPP2</span><span>$'+r.cpp2Employee.toFixed(2)+'</span></div>':'')
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>EI</span><span>$'+r.eiEmployee.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);font-weight:700;color:var(--orange)"><span>Total Deductions</span><span>$'+r.totalDeductions.toFixed(2)+'</span></div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid var(--border);font-weight:700;font-size:14px;color:var(--green)"><span>Net Pay</span><span>$'+r.net.toFixed(2)+'</span></div>'
    +'<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)">'
    +'<div style="font-weight:700;margin-bottom:4px">Employer Portions</div>'
    +'<div style="display:flex;justify-content:space-between;padding:2px 0"><span>CPP (employer)</span><span>$'+r.cppEmployer.toFixed(2)+'</span></div>'
    +(r.cpp2Employer?'<div style="display:flex;justify-content:space-between;padding:2px 0"><span>CPP2 (employer)</span><span>$'+r.cpp2Employer.toFixed(2)+'</span></div>':'')
    +'<div style="display:flex;justify-content:space-between;padding:2px 0"><span>EI (employer)</span><span>$'+r.eiEmployer.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:700;color:var(--orange)"><span>Total CRA Remittance</span><span>$'+r.totalRemittance.toFixed(2)+'</span></div>'
    +'</div></div></div>'
    +'<div style="text-align:center;margin-top:12px"><button onclick="_addCalcPaystub()" style="padding:9px 24px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--blue),var(--blue-dim));color:#fff;font-size:13px;font-weight:700;cursor:pointer">Add to Payroll</button></div>';
  }catch(err){showDhToast('Calculator Error',err.message||'Unknown error','❌','var(--red)');}
}
function _addCalcPaystub(){
  var r=window._lastPayrollCalc;if(!r)return;
  var rec={
    id:Date.now()+'_'+Math.random().toString(36).slice(2,8),
    employee:r.employeeName,date:r.payDate,
    period:r.payFrequency,hours:0,rate:0,gross:r.gross,
    deductions:{cpp:r.cppEmployee,cpp2:r.cpp2Employee,ei:r.eiEmployee,federalTax:r.federalTax,provincialTax:r.provincialTax},
    totalDeductions:r.totalDeductions,net:r.net,
    vacationPay:r.vacationPay,
    dhCpp:r.cppEmployer,dhCpp2:r.cpp2Employer,dhEi:r.eiEmployer,
    dhRemittance:r.totalRemittance,
    _fedTd1:r.federalTd1,_provTd1:r.provincialTd1,_provCode:r.province,
    notes:'Calculated via Payroll Calculator'
  };
  employeePayroll.push(rec);
  saveEmployeePayroll();renderEmployeePayroll();renderRemittanceSummary();renderT4Summary();
  closeModal();
  showToast('Pay stub added for '+r.employeeName,'success');
}
function _pcSwitchCountry(c){
  if(c===window._pcCountry)return;
  if(!window._pcCAFormCache){
    window._pcCAFormCache=document.getElementById('pc-form-body').innerHTML;
  }
  window._pcCountry=c;
  var caTab=document.getElementById('pc-tab-ca');
  var usTab=document.getElementById('pc-tab-us');
  var sub=document.getElementById('pc-subtitle');
  var body=document.getElementById('pc-form-body');
  var res=document.getElementById('pc-results');
  res.style.display='none';res.innerHTML='';
  if(c==='US'){
    caTab.style.background='var(--navy-mid)';caTab.style.color='var(--muted)';
    usTab.style.background='var(--green)';usTab.style.color='#000';
    sub.textContent='IRS Pub 15-T · 2024–2026 rates by pay date · All 50 states + DC';
    body.innerHTML=_pcBuildUSForm();
  }else{
    usTab.style.background='var(--navy-mid)';usTab.style.color='var(--muted)';
    caTab.style.background='var(--green)';caTab.style.color='#000';
    sub.innerHTML='CRA 2026 · T4127 formulas · All provinces &amp; territories';
    body.innerHTML=window._pcCAFormCache;
  }
}
function _pcBuildUSForm(){
  var opts=window._pcNameOpts||'';
  var stOpts=_usStateOrder.map(function(code){
    var st=_usStateCfg2026[code];
    return'<option value="'+code+'">'+st.name+(st.type==='none'?' (no state tax)':'')+'</option>';
  }).join('');
  var is='style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px"';
  var ls='style="font-size:12px;color:var(--muted)"';
  return'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label '+ls+'>Employee Name</label>'
    +'<input id="pc-name" list="pc-names-list" '+is+' placeholder="e.g. John Smith">'
    +'<datalist id="pc-names-list"><option value="">'+opts+'</datalist></div>'
    +'<div><label '+ls+'>State</label>'
    +'<select id="pc-state" '+is+'>'+stOpts+'</select></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label '+ls+'>Pay Date</label><input id="pc-date" type="date" '+is+'></div>'
    +'<div><label '+ls+'>Pay Frequency</label><select id="pc-freq" '+is+'><option value="Weekly">Weekly (52)</option><option value="Biweekly" selected>Biweekly (26)</option><option value="Semi-monthly">Semi-monthly (24)</option><option value="Monthly">Monthly (12)</option></select></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label '+ls+'>Gross Wages (per period)</label><input id="pc-gross" type="number" step="0.01" min="0" placeholder="0.00" '+is+' style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px;text-align:right"></div>'
    +'<div><label '+ls+'>Filing Status (W-4)</label><select id="pc-filing" '+is+'><option value="S">Single</option><option value="MFJ">Married Filing Jointly</option><option value="HoH">Head of Household</option></select></div></div>'
    +'<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">'
    +'<div><label '+ls+'>Pre-tax Deductions (401k etc.)</label><input id="pc-pretax" type="number" step="0.01" min="0" value="0" '+is+' style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px;text-align:right"></div>'
    +'<div><label '+ls+'>Additional Federal W/H</label><input id="pc-addl" type="number" step="0.01" min="0" value="0" '+is+' style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px;text-align:right"></div></div>';
}
function _pcCalc(){
  if(window._pcCountry==='US'){_runUSPayrollCalc();}else{_runPayrollCalc();}
}
function _runUSPayrollCalc(){
  try{
  var name=document.getElementById('pc-name').value.trim();
  var date=document.getElementById('pc-date').value;
  var gross=parseFloat(document.getElementById('pc-gross').value)||0;
  if(!name){showDhToast('Missing Field','Enter employee name','⚠️','var(--orange)');return;}
  if(!date){showDhToast('Missing Field','Enter pay date','⚠️','var(--orange)');return;}
  if(!gross){showDhToast('Missing Field','Enter gross wages','⚠️','var(--orange)');return;}
  var stCode=document.getElementById('pc-state').value;
  var filing=document.getElementById('pc-filing').value;
  var addl=parseFloat(document.getElementById('pc-addl').value)||0;
  var pretax=parseFloat(document.getElementById('pc-pretax').value)||0;
  var r=_calcUSPayroll({
    employeeName:name,payDate:date,gross:gross,pretaxDeductions:pretax,
    payFrequency:document.getElementById('pc-freq').value,
    state:stCode,filing:filing,additionalWithholding:addl
  });
  window._lastPayrollCalc=r;
  var el=document.getElementById('pc-results');
  el.style.display='';
  var fl={S:'Single',MFJ:'Married Filing Jointly',HoH:'Head of Household'}[filing]||filing;
  el.innerHTML='<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-top:4px">'
    +'<div style="background:rgba(34,217,122,.08);padding:10px 14px;display:flex;justify-content:space-between;align-items:center"><span style="font-size:14px;font-weight:700;color:var(--green)">'+r.employeeName+'</span><span style="font-size:11px;color:var(--muted)">'+r.payDate+' · '+r.payFrequency+' · '+r.stateName+' · '+fl+' · '+r.taxYear+' rates</span></div>'
    +'<div style="padding:12px 14px;font-size:12px">'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>Gross Wages</span><span>$'+gross.toFixed(2)+'</span></div>'
    +(pretax?'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--muted)"><span>Pre-tax Deductions</span><span>-$'+pretax.toFixed(2)+'</span></div>':'')
    +'<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>Federal Income Tax</span><span>$'+r.federalTax.toFixed(2)+'</span></div>'
    +(r.stateTax?'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>State Tax ('+r.stateName+')</span><span>$'+r.stateTax.toFixed(2)+'</span></div>':'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--muted)"><span>State Tax</span><span>$0.00 (no state tax)</span></div>')
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>Social Security (6.2%)</span><span>$'+r.socialSecurity.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;color:var(--offwhite)"><span>Medicare (1.45%)</span><span>$'+r.medicare.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:6px 0;border-top:1px solid var(--border);font-weight:700;color:var(--orange)"><span>Total Deductions</span><span>$'+r.totalDeductions.toFixed(2)+'</span></div>'
    +'</div>'
    +'<div style="display:flex;justify-content:space-between;padding:8px 0;border-top:2px solid var(--border);font-weight:700;font-size:14px;color:var(--green)"><span>Net Pay</span><span>$'+r.net.toFixed(2)+'</span></div>'
    +'<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)">'
    +'<div style="font-weight:700;margin-bottom:4px">Employer Portions</div>'
    +'<div style="display:flex;justify-content:space-between;padding:2px 0"><span>Social Security (employer)</span><span>$'+r.ssEmployer.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:2px 0"><span>Medicare (employer)</span><span>$'+r.medEmployer.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:2px 0"><span>FUTA (employer)</span><span>$'+r.futaEmployer.toFixed(2)+'</span></div>'
    +'<div style="display:flex;justify-content:space-between;padding:4px 0;font-weight:700;color:var(--orange)"><span>Total Remittance</span><span>$'+r.totalRemittance.toFixed(2)+'</span></div>'
    +'</div>'
    +'<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border);font-size:10px;color:var(--muted)">'
    +'<div style="font-weight:700;margin-bottom:3px">Filing Requirements</div>'
    +'<div>• Federal: Deposit via EFTPS · File Form 941 quarterly · Form W-2 annually</div>'
    +'<div>• FUTA: File Form 940 annually · Deposit if liability exceeds $500</div>'
    +'<div>• State: Requirements vary — check your state tax authority</div>'
    +'</div>'
    +'</div></div>'
    +'<div style="text-align:center;margin-top:12px"><button onclick="_addUSCalcPaystub()" style="padding:9px 24px;border:none;border-radius:8px;background:linear-gradient(135deg,var(--blue),var(--blue-dim));color:#fff;font-size:13px;font-weight:700;cursor:pointer">Add to Payroll</button></div>';
  }catch(err){showDhToast('Calculator Error',err.message||'Unknown error','❌','var(--red)');}
}
function _addUSCalcPaystub(){
  var r=window._lastPayrollCalc;if(!r||r.country!=='US')return;
  var rec={
    id:Date.now()+'_'+Math.random().toString(36).slice(2,8),
    employee:r.employeeName,date:r.payDate,
    period:r.payFrequency,hours:0,rate:0,gross:r.gross,
    deductions:{federalTax:r.federalTax,provincialTax:r.stateTax,cpp:r.socialSecurity,ei:r.medicare},
    totalDeductions:r.totalDeductions,net:r.net,
    vacationPay:0,
    dhCpp:r.ssEmployer,dhCpp2:0,dhEi:r.medEmployer,
    dhRemittance:r.totalRemittance,
    _country:'US',_state:r.state,_filing:r.filing,_futa:r.futaEmployer,
    notes:'US Payroll — '+r.stateName+' — '+(r.filing==='MFJ'?'Married Filing Jointly':r.filing==='HoH'?'Head of Household':'Single')
  };
  employeePayroll.push(rec);
  saveEmployeePayroll();renderEmployeePayroll();renderRemittanceSummary();renderT4Summary();
  closeModal();
  showToast('Pay stub added for '+r.employeeName,'success');
}

// ── Payroll Compliance & Filing Guide ────────────────────────────────────────
var _usStateFilingInfo={
  AL:{agency:'Alabama Dept of Revenue',url:'https://myalabamataxes.alabama.gov',suta:'https://labor.alabama.gov',quarterly:'Form A-1',annual:'Form A-3'},
  AK:{agency:'Alaska Dept of Labor',url:'',suta:'https://labor.alaska.gov',quarterly:'N/A',annual:'N/A',noTax:true},
  AZ:{agency:'Arizona Dept of Revenue',url:'https://azdor.gov',suta:'https://des.az.gov',quarterly:'Form A1-QRT',annual:'Form A1-R'},
  AR:{agency:'Arkansas Dept of Finance',url:'https://www.dfa.arkansas.gov/income-tax',suta:'https://www.dws.arkansas.gov',quarterly:'AR-941M',annual:'AR-3MAR'},
  CA:{agency:'California EDD',url:'https://edd.ca.gov/en/payroll_taxes',suta:'https://edd.ca.gov',quarterly:'DE 9/DE 9C',annual:'DE 7'},
  CO:{agency:'Colorado Dept of Revenue',url:'https://tax.colorado.gov',suta:'https://cdle.colorado.gov',quarterly:'DR 1094',annual:'DR 1093'},
  CT:{agency:'Connecticut DRS',url:'https://portal.ct.gov/drs',suta:'https://www.ctdol.state.ct.us',quarterly:'CT-941',annual:'CT-W3'},
  DE:{agency:'Delaware Div of Revenue',url:'https://revenue.delaware.gov',suta:'https://dol.delaware.gov',quarterly:'W1',annual:'W-3'},
  FL:{agency:'N/A',url:'',suta:'https://floridarevenue.com/taxes/taxesfees/pages/reemployment.aspx',quarterly:'N/A',annual:'N/A',noTax:true},
  GA:{agency:'Georgia Dept of Revenue',url:'https://gtc.dor.ga.gov',suta:'https://dol.georgia.gov',quarterly:'G-7',annual:'G-1003'},
  HI:{agency:'Hawaii Dept of Taxation',url:'https://tax.hawaii.gov',suta:'https://labor.hawaii.gov',quarterly:'HW-14',annual:'HW-3'},
  ID:{agency:'Idaho State Tax Commission',url:'https://tax.idaho.gov',suta:'https://www.labor.idaho.gov',quarterly:'910',annual:'967'},
  IL:{agency:'Illinois Dept of Revenue',url:'https://mytax.illinois.gov',suta:'https://ides.illinois.gov',quarterly:'IL-941',annual:'IL-W-3'},
  IN:{agency:'Indiana DOR',url:'https://intime.dor.in.gov',suta:'https://www.in.gov/dwd',quarterly:'WH-1',annual:'WH-3'},
  IA:{agency:'Iowa Dept of Revenue',url:'https://tax.iowa.gov',suta:'https://www.iowaworkforcedevelopment.gov',quarterly:'44-095',annual:'VSP'},
  KS:{agency:'Kansas Dept of Revenue',url:'https://www.ksrevenue.gov',suta:'https://www.dol.ks.gov',quarterly:'KW-5',annual:'KW-3'},
  KY:{agency:'Kentucky DOR',url:'https://revenue.ky.gov',suta:'https://kcc.ky.gov',quarterly:'K-1E',annual:'K-3'},
  LA:{agency:'Louisiana Dept of Revenue',url:'https://www.revenue.louisiana.gov',suta:'https://www.laworks.net',quarterly:'L-1',annual:'L-3'},
  ME:{agency:'Maine Revenue Services',url:'https://www.maine.gov/revenue',suta:'https://www.maine.gov/labor',quarterly:'941ME',annual:'W-3ME'},
  MD:{agency:'Comptroller of Maryland',url:'https://interactive.marylandtaxes.gov',suta:'https://www.dllr.state.md.us',quarterly:'MW506',annual:'MW508'},
  MA:{agency:'Massachusetts DOR',url:'https://www.mass.gov/orgs/massachusetts-department-of-revenue',suta:'https://www.mass.gov/orgs/department-of-unemployment-assistance',quarterly:'M-941',annual:'M-W3'},
  MI:{agency:'Michigan Treasury',url:'https://mto.treasury.michigan.gov',suta:'https://www.michigan.gov/leo',quarterly:'5080',annual:'5081'},
  MN:{agency:'Minnesota DOR',url:'https://www.revenue.state.mn.us',suta:'https://uimn.org',quarterly:'MN-941',annual:'W-2 filing'},
  MS:{agency:'Mississippi DOR',url:'https://www.dor.ms.gov',suta:'https://mdes.ms.gov',quarterly:'89-100',annual:'89-140'},
  MO:{agency:'Missouri DOR',url:'https://mytax.mo.gov',suta:'https://labor.mo.gov',quarterly:'MO-941',annual:'MO-W-3'},
  MT:{agency:'Montana DOR',url:'https://mtrevenue.gov',suta:'https://uid.dli.mt.gov',quarterly:'MW-1',annual:'MW-3'},
  NE:{agency:'Nebraska DOR',url:'https://revenue.nebraska.gov',suta:'https://dol.nebraska.gov',quarterly:'941N',annual:'W-3N'},
  NV:{agency:'N/A',url:'',suta:'https://ui.nv.gov/ess.html',quarterly:'N/A',annual:'N/A',noTax:true},
  NH:{agency:'N/A',url:'',suta:'https://www.nhes.nh.gov',quarterly:'N/A',annual:'N/A',noTax:true},
  NJ:{agency:'NJ Division of Taxation',url:'https://www.nj.gov/treasury/taxation',suta:'https://myunemployment.nj.gov',quarterly:'NJ-927',annual:'NJ-W-3'},
  NM:{agency:'New Mexico TRD',url:'https://www.tax.newmexico.gov',suta:'https://www.dws.state.nm.us',quarterly:'CRS-1',annual:'RPD-41072'},
  NY:{agency:'New York Tax Dept',url:'https://www.tax.ny.gov',suta:'https://dol.ny.gov',quarterly:'NYS-45',annual:'NYS-45 Q4'},
  NC:{agency:'NC Dept of Revenue',url:'https://www.ncdor.gov',suta:'https://des.nc.gov',quarterly:'NC-5Q',annual:'NC-3'},
  ND:{agency:'North Dakota Tax Dept',url:'https://www.tax.nd.gov',suta:'https://www.jobsnd.com',quarterly:'306',annual:'307'},
  OH:{agency:'Ohio Dept of Taxation',url:'https://tax.ohio.gov',suta:'https://unemployment.ohio.gov',quarterly:'IT-501',annual:'IT-3'},
  OK:{agency:'Oklahoma Tax Commission',url:'https://oktap.tax.ok.gov',suta:'https://oesc.ok.gov',quarterly:'OW-9',annual:'OW-6'},
  OR:{agency:'Oregon DOR',url:'https://www.oregon.gov/dor',suta:'https://www.oregon.gov/employ',quarterly:'OQ',annual:'OR-WR'},
  PA:{agency:'PA Dept of Revenue',url:'https://mypath.pa.gov',suta:'https://www.uc.pa.gov',quarterly:'REV-1667',annual:'REV-1667'},
  RI:{agency:'Rhode Island Tax',url:'https://www.tax.ri.gov',suta:'https://dlt.ri.gov',quarterly:'RI-941',annual:'RI-W3'},
  SC:{agency:'SC Dept of Revenue',url:'https://dor.sc.gov/mydorway',suta:'https://dew.sc.gov',quarterly:'WH-1605',annual:'WH-1606'},
  SD:{agency:'N/A',url:'',suta:'https://dlr.sd.gov',quarterly:'N/A',annual:'N/A',noTax:true},
  TN:{agency:'N/A',url:'',suta:'https://www.jobs4tn.gov',quarterly:'N/A',annual:'N/A',noTax:true},
  TX:{agency:'N/A',url:'',suta:'https://www.twc.texas.gov',quarterly:'N/A',annual:'N/A',noTax:true},
  UT:{agency:'Utah State Tax Commission',url:'https://tap.tax.utah.gov',suta:'https://jobs.utah.gov',quarterly:'TC-941',annual:'TC-941E'},
  VT:{agency:'Vermont Dept of Taxes',url:'https://tax.vermont.gov',suta:'https://labor.vermont.gov',quarterly:'WHT-436',annual:'WH-434'},
  VA:{agency:'Virginia Tax',url:'https://www.individual.tax.virginia.gov',suta:'https://www.vec.virginia.gov',quarterly:'VA-5',annual:'VA-6'},
  WA:{agency:'N/A',url:'',suta:'https://esd.wa.gov',quarterly:'N/A',annual:'N/A',noTax:true},
  WV:{agency:'WV State Tax Dept',url:'https://tax.wv.gov',suta:'https://workforcewv.org',quarterly:'IT-101',annual:'IT-103'},
  WI:{agency:'Wisconsin DOR',url:'https://www.revenue.wi.gov',suta:'https://dwd.wisconsin.gov',quarterly:'WT-6',annual:'WT-7'},
  WY:{agency:'N/A',url:'',suta:'https://doe.state.wy.us',quarterly:'N/A',annual:'N/A',noTax:true},
  DC:{agency:'DC OTR',url:'https://mytax.dc.gov',suta:'https://does.dc.gov',quarterly:'FR-900Q',annual:'FR-900A'}
};
function _openComplianceGuide(){
  var ls='style="font-size:12px;color:var(--muted)"';
  var stOpts=_usStateOrder.map(function(code){
    var st=_usStateCfg2026[code];
    return'<option value="'+code+'">'+st.name+'</option>';
  }).join('');
  var provOpts=_provOrder.map(function(code){
    var pc=_provCfg2026[code];
    return'<option value="'+code+'">'+pc.name+'</option>';
  }).join('');
  openModal('<div style="padding:16px 20px;border-bottom:1px solid var(--border)">'
    +'<div style="font-size:16px;font-weight:700;color:var(--white)">Payroll Filing Guide</div>'
    +'<div style="font-size:11px;color:var(--muted);margin-top:2px">Step-by-step instructions for remitting taxes and filing reports</div>'
    +'<div style="display:flex;gap:8px;margin-top:10px">'
    +'<button id="cg-tab-us" onclick="_cgSwitch(\'US\')" style="flex:1;padding:7px 0;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:var(--green);color:#000">🇺🇸 United States</button>'
    +'<button id="cg-tab-ca" onclick="_cgSwitch(\'CA\')" style="flex:1;padding:7px 0;border:none;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;background:var(--navy-mid);color:var(--muted)">🇨🇦 Canada</button>'
    +'</div></div>'
    +'<div id="cg-body" style="flex:1;overflow-y:auto;padding:16px 20px;min-height:0;overscroll-behavior:contain"></div>'
    +'<div style="border-top:1px solid var(--border);padding:12px 20px;flex-shrink:0">'
    +'<div id="cg-chat-toggle" onclick="_cgToggleChat()" style="display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 12px;background:rgba(91,141,239,.08);border:1px solid rgba(91,141,239,.2);border-radius:10px">'
    +'<svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 3h12a1.5 1.5 0 011.5 1.5v7A1.5 1.5 0 0115 13h-3.5L9 15.5 6.5 13H3a1.5 1.5 0 01-1.5-1.5v-7A1.5 1.5 0 013 3z" stroke="var(--blue-bright)" stroke-width="1.2" stroke-linejoin="round"/><circle cx="6" cy="8" r="1" fill="var(--blue-bright)"/><circle cx="9" cy="8" r="1" fill="var(--blue-bright)"/><circle cx="12" cy="8" r="1" fill="var(--blue-bright)"/></svg>'
    +'<div style="flex:1"><span style="font-size:12px;font-weight:700;color:var(--blue-bright)">Ask the Filing Assistant</span><br>'
    +'<span style="font-size:10px;color:var(--muted)">Have questions about registration, deposits, or filing? Ask here.</span></div>'
    +'<svg id="cg-chat-chevron" width="14" height="14" viewBox="0 0 14 14" fill="none" style="transition:transform .2s"><path d="M4 5.5L7 8.5L10 5.5" stroke="var(--muted)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    +'</div>'
    +'<div id="cg-chat-panel" style="display:none;margin-top:10px">'
    +'<div id="cg-chat-messages" style="max-height:200px;overflow-y:auto;margin-bottom:10px;display:flex;flex-direction:column;gap:8px">'
    +'<div style="padding:8px 12px;background:rgba(91,141,239,.08);border-radius:10px;font-size:11px;color:var(--blue-bright);line-height:1.5">'
    +'<strong>Filing Assistant</strong><br>Hi! I can help you with payroll tax registration, deposit schedules, filing deadlines, and more. What would you like to know?</div>'
    +'</div>'
    +'<div style="display:flex;gap:6px">'
    +'<input id="cg-chat-input" type="text" placeholder="e.g. When is my Form 941 due?" onkeydown="if(event.key===\'Enter\')_cgSendChat()" style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:8px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);outline:none">'
    +'<button onclick="_cgSendChat()" style="padding:8px 14px;border:none;border-radius:8px;background:var(--blue-bright);color:#fff;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">Send</button>'
    +'</div>'
    +'<div style="margin-top:6px;font-size:9px;color:var(--muted);text-align:center">AI assistant — not a substitute for professional tax advice. Verify information with official sources.</div>'
    +'</div>'
    +'</div>',{maxWidth:700,maxHeight:'90vh',flex:true});
  window._cgCountry='US';
  window._cgChatHistory=[];
  window._cgChatOpen=false;
  _cgRenderUS();
}
function _cgToggleChat(){
  window._cgChatOpen=!window._cgChatOpen;
  var panel=document.getElementById('cg-chat-panel');
  var chevron=document.getElementById('cg-chat-chevron');
  if(panel)panel.style.display=window._cgChatOpen?'block':'none';
  if(chevron)chevron.style.transform=window._cgChatOpen?'rotate(180deg)':'';
  if(window._cgChatOpen){var inp=document.getElementById('cg-chat-input');if(inp)inp.focus();}
}
async function _cgSendChat(){
  var inp=document.getElementById('cg-chat-input');
  if(!inp)return;
  var q=inp.value.trim();
  if(!q)return;
  inp.value='';
  var msgs=document.getElementById('cg-chat-messages');
  if(!msgs)return;
  msgs.innerHTML+='<div style="padding:8px 12px;background:rgba(255,255,255,.05);border-radius:10px;font-size:11px;color:var(--offwhite);line-height:1.5;align-self:flex-end;max-width:85%"><strong>You</strong><br>'+q.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div>';
  var loadingId='cg-ai-loading-'+Date.now();
  msgs.innerHTML+='<div id="'+loadingId+'" style="padding:8px 12px;background:rgba(91,141,239,.08);border-radius:10px;font-size:11px;color:var(--blue-bright);line-height:1.5"><strong>Filing Assistant</strong><br><span style="opacity:.6">Thinking...</span></div>';
  msgs.scrollTop=msgs.scrollHeight;
  window._cgChatHistory.push({role:'user',content:q});
  var region='';
  if(window._cgCountry==='US'){var sel=document.getElementById('cg-state');if(sel)region=sel.options[sel.selectedIndex].text;}
  else{var sel=document.getElementById('cg-prov');if(sel)region=sel.options[sel.selectedIndex].text;}
  try{
    var r=await fetch('/.netlify/functions/ai-filing-chat',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_dhToken},
      body:JSON.stringify({messages:window._cgChatHistory,country:window._cgCountry,region:region})
    });
    var data=await r.json();
    if(!r.ok)throw new Error(data.error||'Request failed');
    var reply=data.reply||'Sorry, I couldn\'t generate a response.';
    window._cgChatHistory.push({role:'assistant',content:reply});
    var el=document.getElementById(loadingId);
    if(el)el.innerHTML='<strong>Filing Assistant</strong><br>'+reply.replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>');
  }catch(e){
    var el=document.getElementById(loadingId);
    if(el)el.innerHTML='<strong>Filing Assistant</strong><br><span style="color:var(--orange)">'+( e.message||'Something went wrong. Please try again.')+'</span>';
  }
  msgs.scrollTop=msgs.scrollHeight;
}
function _cgSwitch(c){
  if(c===window._cgCountry)return;
  window._cgCountry=c;
  var us=document.getElementById('cg-tab-us'),ca=document.getElementById('cg-tab-ca');
  if(c==='US'){us.style.background='var(--green)';us.style.color='#000';ca.style.background='var(--navy-mid)';ca.style.color='var(--muted)';_cgRenderUS();}
  else{ca.style.background='var(--green)';ca.style.color='#000';us.style.background='var(--navy-mid)';us.style.color='var(--muted)';_cgRenderCA();}
}
var _cgIcons={
  building:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 14V3a1 1 0 011-1h6a1 1 0 011 1v11M6 14V11h2v3M4 4.5h1.5M4 6.5h1.5M4 8.5h1.5M8 4.5H6.5M8 6.5H6.5M8 8.5H6.5M10 14V7h3a1 1 0 011 1v6M11.5 9H13M11.5 11H13" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="1" y1="14" x2="15" y2="14" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  state:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1L2 4v1h12V4L8 1zM3 6v6M6 6v6M10 6v6M13 6v6M1.5 12.5h13a.5.5 0 01.5.5v1H1v-1a.5.5 0 01.5-.5z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  dollar:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="8" cy="8" r="6.5" stroke="currentColor" stroke-width="1.2"/><path d="M8 3.5v9M10.5 5.8c0-.9-.7-1.3-1.5-1.4h-2c-.8.1-1.5.6-1.5 1.4s.7 1.3 1.5 1.4h2c.8.1 1.5.6 1.5 1.4s-.7 1.3-1.5 1.4H7c-.8-.1-1.5-.6-1.5-1.4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  stateTax:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="2.5" width="13" height="11" rx="1" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 5.5h13M5 8.5h6M5 10.5h4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  clipboard:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="3" y="2" width="10" height="12" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M6 1.5h4a1 1 0 011 1V3H5v-.5a1 1 0 011-1z" stroke="currentColor" stroke-width="1.2"/><path d="M5.5 7h5M5.5 9h5M5.5 11h3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  calendar:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" stroke="currentColor" stroke-width="1.2"/><path d="M1.5 6h13M5 1v3M11 1v3" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><rect x="4" y="8" width="2" height="1.5" rx=".4" fill="currentColor"/><rect x="7" y="8" width="2" height="1.5" rx=".4" fill="currentColor"/><rect x="10" y="8" width="2" height="1.5" rx=".4" fill="currentColor"/><rect x="4" y="11" width="2" height="1.5" rx=".4" fill="currentColor"/></svg>',
  chart:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 13V8M6.5 13V5M10 13V7M13.5 13V3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  maple:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5l-1.2 3.2-2.8-.6 1.5 2.6L3 8.5l2.8.2L5 12l3-2 3 2-.8-3.3 2.8-.2-2.5-1.8 1.5-2.6-2.8.6L8 1.5z" stroke="currentColor" stroke-width="1" stroke-linejoin="round" fill="currentColor" fill-opacity=".15"/><line x1="8" y1="12" x2="8" y2="14.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>',
  shield:'<svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M8 1.5L2.5 4v4c0 3.5 2.5 5.5 5.5 6.5 3-1 5.5-3 5.5-6.5V4L8 1.5z" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round"/><path d="M5.5 8.5l2 2 3-4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
};
function _cgSection(icon,title,body){
  var svg=_cgIcons[icon]||icon;
  return'<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:12px">'
    +'<div style="background:rgba(34,217,122,.06);padding:10px 14px;font-size:13px;font-weight:700;color:var(--green);display:flex;align-items:center;gap:8px">'+svg+' '+title+'</div>'
    +'<div style="padding:12px 14px;font-size:12px;color:var(--offwhite);line-height:1.7">'+body+'</div></div>';
}
function _cgLink(text,url){
  return url?'<a href="'+url+'" target="_blank" rel="noopener" style="color:var(--blue-bright);text-decoration:underline">'+text+'</a>':text;
}
function _cgRenderUS(){
  var el=document.getElementById('cg-body');
  var stOpts=_usStateOrder.map(function(code){
    var st=_usStateCfg2026[code];
    return'<option value="'+code+'"'+(code==='TX'?' selected':'')+'>'+st.name+'</option>';
  }).join('');
  el.innerHTML='<div style="margin-bottom:12px"><label style="font-size:12px;color:var(--muted)">Select your state</label>'
    +'<select id="cg-state" onchange="_cgRenderUSContent()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px">'+stOpts+'</select></div>'
    +'<div id="cg-us-content"></div>';
  _cgRenderUSContent();
}
function _cgRenderUSContent(){
  var code=document.getElementById('cg-state').value;
  var si=_usStateFilingInfo[code]||{};
  var st=_usStateCfg2026[code]||{};
  var el=document.getElementById('cg-us-content');
  var stubs=employeePayroll.filter(function(p){return p._country==='US';});
  var latestStub=stubs.length?stubs[stubs.length-1]:null;
  var fedTotal=0,ssEmpT=0,ssErT=0,medEmpT=0,medErT=0,stateT=0,futaT=0;
  stubs.forEach(function(s){
    fedTotal+=s.deductions?s.deductions.federalTax||0:0;
    ssEmpT+=s.deductions?s.deductions.cpp||0:0;
    ssErT+=s.dhCpp||0;
    medEmpT+=s.deductions?s.deductions.ei||0:0;
    medErT+=s.dhEi||0;
    stateT+=s.deductions?s.deductions.provincialTax||0:0;
    futaT+=s._futa||0;
  });
  var eftpsTotal=+(fedTotal+ssEmpT+ssErT+medEmpT+medErT).toFixed(2);
  var h='';
  h+=_cgSection('building','One-Time Setup — Federal',
    '<div style="display:flex;flex-direction:column;gap:12px">'
    +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Step 1 — Get an EIN (Employer Identification Number)</strong><br>'
    +'Your EIN is your company\'s federal tax ID. You need it before paying employees, opening an EFTPS account, or filing any federal return.<br>'
    +'<span style="color:var(--muted)">How:</span> '+_cgLink('Apply online at IRS.gov','https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online')+' — approval is instant. You\'ll receive your EIN immediately upon completion.<br>'
    +'<span style="color:var(--muted)">Keep your EIN confirmation letter (CP 575) in a safe place — you\'ll need it for banking, state registration, and annual filings.</span></div>'
    +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Step 2 — Register for EFTPS (Electronic Federal Tax Payment System)</strong><br>'
    +'EFTPS is the only way to deposit federal payroll taxes (income tax withholding, Social Security, and Medicare). You cannot pay these by check or through IRS Direct Pay.<br>'
    +'<span style="color:var(--muted)">How:</span> '+_cgLink('Enroll at eftps.gov','https://www.eftps.gov/eftps/')+' using your EIN. A PIN will arrive by mail in 5–7 business days. Once enrolled, you can schedule deposits online or by phone (1-800-555-4477).<br>'
    +'<span style="color:var(--muted)">Tip: Enroll as soon as you get your EIN — the mailed PIN takes time, and you\'ll need it before your first deposit is due.</span></div>'
    +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Step 3 — Create an SSA Business Services Online (BSO) Account</strong><br>'
    +'BSO is where you electronically file W-2s and W-3s at year end. The Social Security Administration requires electronic filing if you have 25+ employees.<br>'
    +'<span style="color:var(--muted)">How:</span> '+_cgLink('Register at ssa.gov/bso','https://www.ssa.gov/bso/')+' — you\'ll need your EIN and a valid email address. Registration takes about 10 minutes.</span></div>'
    +'</div>'
  );
  if(!si.noTax){
    h+=_cgSection('state','One-Time Setup — '+st.name,
      '<div style="display:flex;flex-direction:column;gap:12px">'
      +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Register for State Withholding Tax</strong><br>'
      +'You must register with '+si.agency+' to get a state withholding account number. This is separate from your federal EIN.<br>'
      +'<span style="color:var(--muted)">How:</span> '+_cgLink('Visit '+si.agency,si.url)+' and apply for an employer withholding account. Processing time varies by state (instant to 2 weeks).<br>'
      +'<span style="color:var(--muted)">You\'ll use this account number when depositing state income tax withheld from employees and when filing quarterly state returns.</span></div>'
      +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Register for State Unemployment Insurance (SUTA/SUI)</strong><br>'
      +'SUTA is an employer-paid tax that funds unemployment benefits. Every state requires it, regardless of company size.<br>'
      +'<span style="color:var(--muted)">How:</span> '+_cgLink('Register with your state unemployment agency',si.suta)+'<br>'
      +'<span style="color:var(--muted)">New employer rates typically range from 1% to 5% on the first $7,000–$56,500 per employee (varies by state). Your rate decreases over time with a clean claims history.</span></div>'
      +'</div>'
    );
  }else{
    h+=_cgSection('state','One-Time Setup — '+st.name,
      '<div style="padding:10px 12px;background:rgba(34,217,122,.06);border-radius:8px;margin-bottom:12px"><strong style="color:var(--green)">'+st.name+' has no state income tax.</strong><br>'
      +'<span style="color:var(--muted)">You do not need to register for state withholding or file state income tax returns for employees working in '+st.name+'.</span></div>'
      +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Register for State Unemployment Insurance (SUTA/SUI)</strong><br>'
      +'Even though '+st.name+' has no income tax, SUTA registration is still required. This is an employer-paid tax that funds state unemployment benefits.<br>'
      +'<span style="color:var(--muted)">How:</span> '+_cgLink('Register here',si.suta)+'<br>'
      +'<span style="color:var(--muted)">As a new employer, you\'ll be assigned a standard rate. File quarterly wage reports and pay SUTA on time to keep your rate low.</span></div>'
    );
  }
  h+=_cgSection('dollar','Federal Tax Deposits via EFTPS',
    '<div style="margin-bottom:10px">You must deposit federal payroll taxes (income tax withholding + Social Security + Medicare) to the IRS via '+_cgLink('EFTPS','https://www.eftps.gov/eftps/')+'. Most employers are <strong>monthly depositors</strong> — you total up all payroll runs for the month and make <strong>one combined deposit by the 15th of the following month</strong>. You do not need to deposit after every payroll run.</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employee Federal Income Tax</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.deductions.federalTax||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employee Social Security (6.2%)</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.deductions.cpp||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employer Social Security (6.2%)</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.dhCpp||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employee Medicare (1.45%)</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.deductions.ei||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employer Medicare (1.45%)</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.dhEi||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr><td style="padding:6px 0;font-weight:700;color:var(--green)">Total EFTPS Deposit</td><td style="text-align:right;font-weight:700;color:var(--green);white-space:nowrap">'+(latestStub?'$'+((latestStub.deductions.federalTax||0)+(latestStub.deductions.cpp||0)+(latestStub.dhCpp||0)+(latestStub.deductions.ei||0)+(latestStub.dhEi||0)).toFixed(2)+'/period':'calculate first')+'</td></tr>'
    +'</table>'
    +'<div style="margin-top:12px;padding:10px 12px;background:rgba(91,141,239,.08);border-radius:8px;font-size:11px;color:var(--blue-bright);line-height:1.6">'
    +'<strong>How to make the deposit:</strong><br>'
    +'1. Log in to '+_cgLink('EFTPS.gov','https://www.eftps.gov/eftps/')+' with your EIN, PIN, and password<br>'
    +'2. Select <strong>Make a Payment</strong> → Tax Form <strong>941</strong><br>'
    +'3. Enter the total amount shown above as a single payment<br>'
    +'4. Choose the settlement date (must be on or before the due date)<br>'
    +'5. Save your confirmation number for your records'
    +'</div>'
    +'<div style="margin-top:8px;padding:10px 12px;background:rgba(255,152,56,.08);border-radius:8px;font-size:11px;color:var(--orange);line-height:1.6">'
    +'<strong>Deposit schedule — when is it due?</strong><br>'
    +'• <strong>Monthly depositor</strong> (tax liability under $50,000/year): deposit by the <strong>15th of the following month</strong>. Example: January payroll taxes are due February 15th.<br>'
    +'• <strong>Semi-weekly depositor</strong> (tax liability $50,000+/year): deposit within 3 business days of payday. Wed/Thu/Fri paydays → due the following Wednesday. Sat/Sun/Mon/Tue paydays → due the following Friday.<br>'
    +'• <strong>New employers</strong> default to monthly. The IRS will notify you if your schedule changes based on your lookback period (Form 941 liability from 2 years prior).'
    +'</div>'
  );
  if(!si.noTax){
    h+=_cgSection('stateTax','State Tax Deposits',
      '<div style="margin-bottom:10px">In addition to your federal EFTPS deposit, you must separately deposit state income tax withholding to <strong>'+si.agency+'</strong>. Most states follow a similar monthly schedule — one deposit covering all payroll runs for the month.</div>'
      +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px;margin-bottom:10px">'
      +'<div style="display:flex;justify-content:space-between;align-items:center">'
      +'<span style="color:var(--muted)">'+st.name+' income tax withheld</span>'
      +'<strong>'+(latestStub?'$'+(latestStub.deductions.provincialTax||0).toFixed(2)+'/period':'from calculator')+'</strong></div></div>'
      +'<div style="padding:10px 12px;background:rgba(91,141,239,.08);border-radius:8px;font-size:11px;color:var(--blue-bright);line-height:1.6">'
      +'<strong>How to deposit:</strong><br>'
      +'1. Log in to '+_cgLink(si.agency,si.url)+'<br>'
      +'2. Navigate to your withholding tax account and submit a payment for the amount above<br>'
      +'3. Most states accept ACH debit (free), credit card (fee), or electronic check<br><br>'
      +'<strong>Schedule:</strong> Most states use monthly or semi-weekly schedules similar to federal. '
      +'Check your '+_cgLink('state portal',si.url)+' after registration — your specific schedule depends on your tax liability.'
      +'</div>'
    );
  }
  h+=_cgSection('clipboard','Quarterly Filings',
    '<div style="margin-bottom:10px">Every quarter, you must file returns that reconcile the deposits you\'ve been making. These reports tell the IRS and your state exactly how much you withheld and deposited.</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0"><strong>Form 941</strong><br><span style="color:var(--muted);font-size:10px">Employer\'s Quarterly Federal Tax Return</span></td><td style="color:var(--muted)">Reports total wages paid, federal income tax withheld, and employer + employee Social Security and Medicare taxes. Must match your EFTPS deposits.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('e-File','https://www.irs.gov/businesses/small-businesses-self-employed/e-file-form-940-941-or-944-for-small-businesses')+'</td></tr>'
    +(!si.noTax?'<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0"><strong>'+si.quarterly+'</strong><br><span style="color:var(--muted);font-size:10px">'+st.name+' quarterly return</span></td><td style="color:var(--muted)">Reports state income tax withheld and wages paid. File through '+si.agency+'.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('State portal',si.url)+'</td></tr>':'')
    +'<tr><td style="padding:8px 0"><strong>FUTA deposit</strong><br><span style="color:var(--muted);font-size:10px">Federal unemployment</span></td><td style="color:var(--muted)">If your cumulative FUTA liability exceeds $500 during the quarter, you must deposit it via EFTPS. Use Tax Form 940 when making the EFTPS payment.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('EFTPS','https://www.eftps.gov/eftps/')+'</td></tr>'
    +'</table>'
    +'<div style="margin-top:12px;padding:10px 12px;background:rgba(255,152,56,.08);border-radius:8px;font-size:11px;color:var(--orange);line-height:1.6">'
    +'<strong>Quarterly due dates:</strong><br>'
    +'Q1 (Jan–Mar) → <strong>April 30</strong> &nbsp;|&nbsp; Q2 (Apr–Jun) → <strong>July 31</strong><br>'
    +'Q3 (Jul–Sep) → <strong>October 31</strong> &nbsp;|&nbsp; Q4 (Oct–Dec) → <strong>January 31</strong><br>'
    +'<span style="opacity:.8">If the due date falls on a weekend or holiday, the deadline moves to the next business day. If you deposited all taxes on time, you get 10 extra days to file.</span>'
    +'</div>'
  );
  h+=_cgSection('calendar','Annual Filings (due Jan 31)',
    '<div style="margin-bottom:10px">At year end, you must file annual returns and provide wage statements to employees and government agencies. Most are due <strong>January 31</strong> of the following year.</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0"><strong>W-2</strong><br><span style="color:var(--muted);font-size:10px">Wage & Tax Statement</span></td><td style="color:var(--muted)">One per employee. Shows total wages, federal/state tax withheld, and Social Security/Medicare. Give copies to employees by Jan 31 and file with SSA.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('SSA BSO','https://www.ssa.gov/bso/')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0"><strong>W-3</strong><br><span style="color:var(--muted);font-size:10px">Transmittal of W-2s</span></td><td style="color:var(--muted)">Summary of all W-2s submitted. Filed automatically when you e-file W-2s through BSO.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('SSA BSO','https://www.ssa.gov/bso/')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0"><strong>Form 940</strong><br><span style="color:var(--muted);font-size:10px">Annual FUTA Return</span></td><td style="color:var(--muted)">Reports total FUTA tax for the year (0.6% on first $7,000 per employee after state credit). Due Jan 31, but you get until Feb 10 if you deposited all FUTA on time.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('e-File','https://www.irs.gov/businesses/small-businesses-self-employed/e-file-form-940-941-or-944-for-small-businesses')+'</td></tr>'
    +(!si.noTax?'<tr><td style="padding:8px 0"><strong>'+si.annual+'</strong><br><span style="color:var(--muted);font-size:10px">'+st.name+' annual return</span></td><td style="color:var(--muted)">Annual reconciliation of state withholding and/or state copy of W-2s. Due date varies by state — check your portal.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('State portal',si.url)+'</td></tr>':'')
    +'</table>'
  );
  if(stubs.length){
    h+=_cgSection('chart','Your Running Totals ('+stubs.length+' US pay stubs on file)',
      '<div style="margin-bottom:8px;color:var(--muted);font-size:11px">These totals help you verify that your deposits and quarterly filings match what\'s been withheld and owed.</div>'
      +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">Federal Income Tax withheld</td><td style="text-align:right">$'+fedTotal.toFixed(2)+'</td></tr>'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">Social Security (employee + employer)</td><td style="text-align:right">$'+(ssEmpT+ssErT).toFixed(2)+'</td></tr>'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">Medicare (employee + employer)</td><td style="text-align:right">$'+(medEmpT+medErT).toFixed(2)+'</td></tr>'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">State income tax withheld</td><td style="text-align:right">$'+stateT.toFixed(2)+'</td></tr>'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">FUTA (employer)</td><td style="text-align:right">$'+futaT.toFixed(2)+'</td></tr>'
      +'<tr><td style="padding:6px 0;font-weight:700;color:var(--green)">Total Federal (EFTPS) deposited</td><td style="text-align:right;font-weight:700;color:var(--green)">$'+eftpsTotal.toFixed(2)+'</td></tr>'
      +'</table>'
    );
  }
  el.innerHTML=h;
}
function _cgRenderCA(){
  var el=document.getElementById('cg-body');
  var provOpts=_provOrder.map(function(code){
    var pc=_provCfg2026[code];
    return'<option value="'+code+'"'+(code==='ON'?' selected':'')+'>'+pc.name+'</option>';
  }).join('');
  el.innerHTML='<div style="margin-bottom:12px"><label style="font-size:12px;color:var(--muted)">Select your province</label>'
    +'<select id="cg-prov" onchange="_cgRenderCAContent()" style="width:100%;padding:7px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;background:var(--navy-mid);color:var(--offwhite);margin-top:3px">'+provOpts+'</select></div>'
    +'<div id="cg-ca-content"></div>';
  _cgRenderCAContent();
}
function _cgRenderCAContent(){
  var code=document.getElementById('cg-prov').value;
  var prov=_provCfg2026[code]||_provCfg2026.ON;
  var caStubs=employeePayroll.filter(function(p){return !p._country||p._country!=='US';});
  var latestStub=caStubs.length?caStubs[caStubs.length-1]:null;
  var totalCpp=0,totalCpp2=0,totalEi=0,totalFed=0,totalProv=0,totalCppEr=0,totalCpp2Er=0,totalEiEr=0;
  caStubs.forEach(function(s){
    if(s.deductions){
      totalCpp+=s.deductions.cpp||0;
      totalEi+=s.deductions.ei||0;
      totalFed+=s.deductions.federalTax||0;
      totalProv+=s.deductions.provincialTax||0;
    }
    totalCppEr+=s.dhCpp||0;totalCpp2Er+=s.dhCpp2||0;totalEiEr+=s.dhEi||0;
  });
  var provInfo={
    AB:{wcb:'WCB Alberta',wcbUrl:'https://www.wcb.ab.ca'},
    BC:{wcb:'WorkSafeBC',wcbUrl:'https://www.worksafebc.com'},
    SK:{wcb:'WCB Saskatchewan',wcbUrl:'https://www.wcbsask.com'},
    MB:{wcb:'WCB Manitoba',wcbUrl:'https://www.wcb.mb.ca'},
    ON:{wcb:'WSIB',wcbUrl:'https://www.wsib.ca',eht:'Employer Health Tax (EHT)',ehtUrl:'https://www.ontario.ca/page/employer-health-tax'},
    NB:{wcb:'WorkSafeNB',wcbUrl:'https://www.worksafenb.ca'},
    NS:{wcb:'WCB Nova Scotia',wcbUrl:'https://www.wcb.ns.ca'},
    PE:{wcb:'WCB PEI',wcbUrl:'https://www.wcb.pe.ca'},
    NL:{wcb:'WorkplaceNL',wcbUrl:'https://workplacenl.ca'},
    YT:{wcb:'YWCHSB',wcbUrl:'https://wcb.yk.ca'},
    NT:{wcb:'WSCC',wcbUrl:'https://www.wscc.nt.ca'},
    NU:{wcb:'WSCC Nunavut',wcbUrl:'https://www.wscc.nt.ca'}
  };
  var pi=provInfo[code]||provInfo.ON;
  var h='';
  h+=_cgSection('maple','One-Time Setup — CRA',
    '<div style="display:flex;flex-direction:column;gap:12px">'
    +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Step 1 — Get a Business Number (BN) with a Payroll Account (RP)</strong><br>'
    +'Your BN is your company\'s identifier with the CRA. The "RP" program account under your BN is specifically for payroll. You need it before making any remittance.<br>'
    +'<span style="color:var(--muted)">How:</span> '+_cgLink('Register online via CRA','https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/registering-your-business/register.html')+'. If you already have a BN (for GST/HST, for example), you just need to add an RP account — you don\'t need a new BN.<br>'
    +'<span style="color:var(--muted)">Your payroll account number will look like: 123456789RP0001</span></div>'
    +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Step 2 — Set Up CRA My Business Account</strong><br>'
    +'This is your online portal for everything payroll: remitting deductions, filing T4s, viewing your remittance schedule, and checking your account balance.<br>'
    +'<span style="color:var(--muted)">How:</span> '+_cgLink('Register at CRA My Business Account','https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/business-account.html')+'. You\'ll need your BN and a CRA security code (mailed in 5–10 business days, or instant if you use a Sign-In Partner like your bank).</span></div>'
    +'</div>'
  );
  h+=_cgSection('shield','One-Time Setup — '+prov.name,
    '<div style="display:flex;flex-direction:column;gap:12px">'
    +'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">Workers\' Compensation Insurance</strong><br>'
    +'Registration with '+pi.wcb+' is mandatory for all employers in '+prov.name+'. This covers workplace injuries and is separate from CRA payroll deductions.<br>'
    +'<span style="color:var(--muted)">How:</span> '+_cgLink('Register with '+pi.wcb,pi.wcbUrl)+'. Premium rates vary by industry classification and claims history. You\'ll report payroll annually and pay premiums based on your rate × insurable earnings.</span></div>'
    +(pi.eht?'<div style="padding:10px 12px;background:var(--navy-mid);border-radius:8px"><strong style="color:var(--blue-bright)">'+pi.eht+'</strong><br>'
    +'Ontario employers with total annual payroll over $1,000,000 must pay EHT (0.98%–1.95%). Employers under $1M are exempt.<br>'
    +'<span style="color:var(--muted)">How:</span> '+_cgLink('Register for Ontario EHT',pi.ehtUrl)+'. File an annual return and remit based on your total Ontario payroll.</span></div>':'')
    +'</div>'
  );
  h+=_cgSection('dollar','Each Pay Period — CRA Remittance',
    '<div style="margin-bottom:10px">After each payroll run, remit all payroll deductions to the CRA as a <strong>single combined payment</strong>. Unlike the US, federal and provincial taxes are bundled together in one remittance to the CRA.</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employee CPP contributions</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.deductions.cpp||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employer CPP (1:1 match)</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.dhCpp||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employee EI premiums</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.deductions.ei||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Employer EI (1.4× employee)</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.dhEi||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Federal income tax</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.deductions.federalTax||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:5px 0;color:var(--muted)">Provincial income tax</td><td style="text-align:right;white-space:nowrap">'+(latestStub?'$'+(latestStub.deductions.provincialTax||0).toFixed(2)+'/period':'from calculator')+'</td></tr>'
    +'<tr><td style="padding:6px 0;font-weight:700;color:var(--green)">Total CRA Remittance</td><td style="text-align:right;font-weight:700;color:var(--green);white-space:nowrap">'+(latestStub?'$'+(latestStub.dhRemittance||0).toFixed(2)+'/period':'calculate first')+'</td></tr>'
    +'</table>'
    +'<div style="margin-top:12px;padding:10px 12px;background:rgba(91,141,239,.08);border-radius:8px;font-size:11px;color:var(--blue-bright);line-height:1.6">'
    +'<strong>How to remit:</strong><br>'
    +'1. Log in to '+_cgLink('CRA My Business Account','https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/business-account.html')+'<br>'
    +'2. Select your RP payroll account → Make a remittance<br>'
    +'3. Enter the total amount above as a single payment<br>'
    +'4. Or pay through your bank\'s online bill payment — payee is "CRA Payroll" and your account number is your 15-digit payroll account (e.g., 123456789RP0001)'
    +'</div>'
    +'<div style="margin-top:8px;padding:10px 12px;background:rgba(255,152,56,.08);border-radius:8px;font-size:11px;color:var(--orange);line-height:1.6">'
    +'<strong>Remittance schedule — when is it due?</strong><br>'
    +'• <strong>Regular remitter</strong> (AMWA* under $25K): due the <strong>15th of the following month</strong><br>'
    +'• <strong>Quarterly remitter</strong> (AMWA under $3K + perfect filing history): due the <strong>15th of the month after the quarter ends</strong><br>'
    +'• <strong>Accelerated Threshold 1</strong> (AMWA $25K–$99K): two remittances per month — due the <strong>25th</strong> for pay days 1–15, and the <strong>10th</strong> for pay days 16–end<br>'
    +'• <strong>Accelerated Threshold 2</strong> (AMWA $100K+): due within <strong>3 working days</strong> of each payday<br>'
    +'<span style="opacity:.8">*AMWA = Average Monthly Withholding Amount (your total remittances ÷ 12 from two calendar years ago). The CRA tells you your category — check My Business Account.</span>'
    +'</div>'
  );
  h+=_cgSection('calendar','Annual Filings (due Feb 28)',
    '<div style="margin-bottom:10px">At the end of each calendar year, you must file T4 information returns with the CRA and provide T4 slips to employees. The deadline is <strong>February 28</strong> (or the last day of February in a leap year).</div>'
    +'<table style="width:100%;border-collapse:collapse;font-size:12px">'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0"><strong>T4 Slips</strong><br><span style="color:var(--muted);font-size:10px">Statement of Remuneration Paid</span></td><td style="color:var(--muted)">One per employee. Reports total employment income, CPP/EI/tax deducted. Give copies to employees and file with CRA by Feb 28.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('My Business Account','https://www.canada.ca/en/revenue-agency/services/e-services/digital-services-businesses/business-account.html')+'</td></tr>'
    +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:8px 0"><strong>T4 Summary</strong><br><span style="color:var(--muted);font-size:10px">Summary of all T4 slips</span></td><td style="color:var(--muted)">Totals from all T4 slips, plus your total remittances for the year. Generated automatically when you e-file T4s through My Business Account.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('CRA','https://www.canada.ca/en/revenue-agency/services/tax/businesses/topics/payroll/completing-filing-information-returns/t4-information-employers/t4-summary.html')+'</td></tr>'
    +'<tr><td style="padding:8px 0"><strong>ROE</strong><br><span style="color:var(--muted);font-size:10px">Record of Employment</span></td><td style="color:var(--muted)">Not annual — file within <strong>5 calendar days</strong> of any employee\'s last day of work, reduction in hours, or leave of absence. Required for the employee to apply for EI benefits.</td><td style="text-align:right;white-space:nowrap;vertical-align:top">'+_cgLink('ROE Web','https://www.canada.ca/en/employment-social-development/programs/ei/ei-list/ei-roe/access-roe.html')+'</td></tr>'
    +'</table>'
  );
  if(caStubs.length){
    var totalRemit=+(totalFed+totalProv+totalCpp+totalCppEr+totalCpp2Er+totalEi+totalEiEr).toFixed(2);
    h+=_cgSection('chart','Your Running Totals ('+caStubs.length+' Canadian pay stubs on file)',
      '<table style="width:100%;border-collapse:collapse;font-size:12px">'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">Federal income tax</td><td style="text-align:right">$'+totalFed.toFixed(2)+'</td></tr>'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">Provincial income tax</td><td style="text-align:right">$'+totalProv.toFixed(2)+'</td></tr>'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">CPP (employee + employer)</td><td style="text-align:right">$'+(totalCpp+totalCppEr).toFixed(2)+'</td></tr>'
      +'<tr style="border-bottom:1px solid var(--border)"><td style="padding:4px 0;color:var(--muted)">EI (employee + employer)</td><td style="text-align:right">$'+(totalEi+totalEiEr).toFixed(2)+'</td></tr>'
      +'<tr><td style="padding:6px 0;font-weight:700;color:var(--green)">Total CRA remittance</td><td style="text-align:right;font-weight:700;color:var(--green)">$'+totalRemit.toFixed(2)+'</td></tr>'
      +'</table>'
    );
  }
  document.getElementById('cg-ca-content').innerHTML=h;
}

// ── AI Pay Stub Scanner ─────────────────────────────────────────────────────
window._stagedPaystubs={1:[],2:[]};
async function _stagePaystubFiles(slot,files){
  if(!files||!files.length)return;
  for(var i=0;i<files.length;i++){
    var compressed=await _resizePaystubImage(files[i]);
    window._stagedPaystubs[slot].push(compressed);
  }
  var count=window._stagedPaystubs[slot].length;
  var zone=document.getElementById('paystub-scan-zone-'+slot);
  var color=slot===1?'var(--blue-bright)':'var(--orange)';
  if(zone){
    zone.style.borderColor='var(--green)';
    zone.innerHTML='<div style="margin-bottom:2px;color:var(--green)">'+_icon('check',18)+'</div><div style="font-size:11px;font-weight:600;color:var(--green)">'+count+' screenshot'+(count>1?'s':'')+' ready</div><div style="font-size:9px;color:'+color+';margin-top:2px">Click to add more</div>';
  }
  var inp=document.getElementById('paystub-scan-input-'+slot);if(inp)inp.value='';
  var btn=document.getElementById('paystub-scan-submit');
  if(btn&&window._stagedPaystubs[1].length&&window._stagedPaystubs[2].length){
    btn.style.display='';
    var total=window._stagedPaystubs[1].length+window._stagedPaystubs[2].length;
    var sbtn=document.getElementById('paystub-scan-submit-btn');
    if(sbtn) sbtn.textContent='Scan '+total+' Screenshots';
  }
}
async function _submitStagedPaystubs(){
  if(!window._stagedPaystubs[1].length||!window._stagedPaystubs[2].length){showDhToast&&showDhToast('Missing screenshots','Please upload screenshots for both sides.','⚠️','var(--orange)');return;}
  var zones=document.getElementById('paystub-scan-zones');
  var submit=document.getElementById('paystub-scan-submit');
  var spinner=document.getElementById('paystub-scan-spinner');
  var preview=document.getElementById('paystub-scan-preview');
  zones.style.display='none';submit.style.display='none';spinner.style.display='';preview.style.display='none';
  var totalImgs=window._stagedPaystubs[1].length+window._stagedPaystubs[2].length;
  var spinText=document.getElementById('paystub-scan-spinner-text');
  var spinSub=document.getElementById('paystub-scan-spinner-sub');
  if(spinText)spinText.textContent='Scanning '+totalImgs+' screenshots...';
  if(spinSub)spinSub.textContent='Processing each screenshot individually for accuracy';
  var allImages=[];
  window._stagedPaystubs[1].forEach(function(img){img.label='salary_calculation';allImages.push(img);});
  window._stagedPaystubs[2].forEach(function(img){img.label='employer_remittance';allImages.push(img);});
  try{
    var tok=_fbToken();
    if(!tok){showDhToast('Not logged in','Please log in first.','⚠️','var(--orange)');return;}
    var r=await fetch('/.netlify/functions/ai-paystub-scan',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({images:allImages,batch:true})
    });
    if(!r.ok){var e=await r.json().catch(function(){return{};});throw new Error(e.error||'Scan failed');}
    var result=await r.json();
    var records=Array.isArray(result.data)?result.data:[result.data];
    if(records.length>1){_showBatchPaystubPreview(records);}
    else{_showPaystubScanPreview(records[0]);}
  }catch(e){
    showDhToast&&showDhToast('Scan failed',e.message,'⚠️','var(--red)');
    zones.style.display='';spinner.style.display='none';
  }
  window._stagedPaystubs={1:[],2:[]};
}

function _resizePaystubImage(file){
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>{
      const img=new Image();
      img.onload=()=>{
        const max=1400;
        let w=img.width,h=img.height;
        if(w>max){h=Math.round(h*(max/w));w=max;}
        if(h>max){w=Math.round(w*(max/h));h=max;}
        const c=document.createElement('canvas');c.width=w;c.height=h;
        c.getContext('2d').drawImage(img,0,0,w,h);
        const dataUrl=c.toDataURL('image/jpeg',0.85);
        const b64=dataUrl.split(',')[1];
        resolve({data:b64,mimeType:'image/jpeg'});
      };
      img.onerror=()=>reject(new Error('Failed to load image'));
      img.src=reader.result;
    };
    reader.onerror=()=>reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function _showPaystubScanPreview(d){
  const zone=document.getElementById('paystub-scan-zone');
  const spinner=document.getElementById('paystub-scan-spinner');
  const preview=document.getElementById('paystub-scan-preview');
  spinner.style.display='none';preview.style.display='';

  const workPay=d.salaryOrWages||0;
  const vacPay=d.vacationPay||0;
  const gross=d.totalCashIncome||(workPay+vacPay);
  const fedTax=d.federalTax||0;
  const provTax=d.provincialTax||0;
  const cppEmp=d.cppEmployee||0;
  const cpp2Emp=d.cpp2Employee||0;
  const eiEmp=d.eiEmployee||0;
  const totalDed=d.totalDeductions||(fedTax+provTax+cppEmp+cpp2Emp+eiEmp);
  const net=d.netAmount||(gross-totalDed);
  const cppER=d.cppEmployer||0;
  const cpp2ER=d.cpp2Employer||0;
  const eiER=d.eiEmployer||0;
  const totalRemit=d.totalRemittance||0;

  preview.innerHTML=`<div style="margin-top:12px;border:1px solid var(--blue);border-radius:10px;padding:16px;background:rgba(91,141,239,.03)">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--white)">${d.employeeName||'Unknown'}</div>
        <div style="font-size:11px;color:var(--muted)">${d.payDate||''} · ${d.payFrequency||'Biweekly'} · ${d.province||'Ontario'}</div>
      </div>
      <div style="background:var(--green);color:#000;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700">AI Scanned</div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
      <div style="background:var(--navy-lift);border-radius:8px;padding:10px">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Earnings</div>
        <div style="font-size:12px;color:var(--offwhite);display:flex;justify-content:space-between"><span>Working Pay</span><span>$${workPay.toFixed(2)}</span></div>
        <div style="font-size:12px;color:var(--offwhite);display:flex;justify-content:space-between"><span>Vacation (4%)</span><span>$${vacPay.toFixed(2)}</span></div>
        <div style="font-size:13px;font-weight:700;color:var(--green);display:flex;justify-content:space-between;margin-top:4px;padding-top:4px;border-top:1px solid var(--border)"><span>Gross</span><span>$${gross.toFixed(2)}</span></div>
      </div>
      <div style="background:var(--navy-lift);border-radius:8px;padding:10px">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:4px">Employee Deductions</div>
        <div style="font-size:12px;color:var(--offwhite);display:flex;justify-content:space-between"><span>Federal Tax</span><span style="color:var(--red)">-$${fedTax.toFixed(2)}</span></div>
        <div style="font-size:12px;color:var(--offwhite);display:flex;justify-content:space-between"><span>Provincial Tax</span><span style="color:var(--red)">-$${provTax.toFixed(2)}</span></div>
        <div style="font-size:12px;color:var(--offwhite);display:flex;justify-content:space-between"><span>CPP</span><span style="color:var(--red)">-$${cppEmp.toFixed(2)}</span></div>
        ${cpp2Emp?`<div style="font-size:12px;color:var(--offwhite);display:flex;justify-content:space-between"><span>CPP2</span><span style="color:var(--red)">-$${cpp2Emp.toFixed(2)}</span></div>`:''}
        <div style="font-size:12px;color:var(--offwhite);display:flex;justify-content:space-between"><span>EI</span><span style="color:var(--red)">-$${eiEmp.toFixed(2)}</span></div>
        <div style="font-size:13px;font-weight:700;color:var(--red);display:flex;justify-content:space-between;margin-top:4px;padding-top:4px;border-top:1px solid var(--border)"><span>Total</span><span>-$${totalDed.toFixed(2)}</span></div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px">
      <div style="background:linear-gradient(135deg,rgba(91,141,239,.15),rgba(91,141,239,.05));border:1px solid var(--blue);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:2px">Net Pay</div>
        <div style="font-size:20px;font-weight:800;color:var(--blue-bright)">$${net.toFixed(2)}</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(255,160,0,.1),rgba(255,160,0,.03));border:1px solid var(--orange);border-radius:8px;padding:10px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;margin-bottom:2px">CRA Remittance</div>
        <div style="font-size:20px;font-weight:800;color:var(--orange)">$${totalRemit.toFixed(2)}</div>
      </div>
    </div>
    ${(cppER||eiER)?`<div style="font-size:11px;color:var(--muted);margin-bottom:10px">Employer: CPP $${cppER.toFixed(2)}${cpp2ER?' + CPP2 $'+cpp2ER.toFixed(2):''} · EI $${eiER.toFixed(2)}</div>`:''}
    <div style="display:flex;gap:10px">
      <button onclick="_acceptPaystubScan()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--green);color:#000;font-size:13px;font-weight:700;cursor:pointer">Add Pay Stub</button>
      <button onclick="_dismissPaystubScan()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;cursor:pointer">Discard</button>
    </div>
  </div>`;

  window._scannedPaystub=d;
}

function _buildPaystubRecord(d){
  var workPay=d.salaryOrWages||0;
  var vacPay=d.vacationPay||0;
  var gross=d.totalCashIncome||(workPay+vacPay);
  var cppEmp=d.cppEmployee||0;
  var cpp2Emp=d.cpp2Employee||0;
  var eiEmp=d.eiEmployee||0;
  var fedTax=d.federalTax||0;
  var provTax=d.provincialTax||0;
  var totalDed=d.totalDeductions||(fedTax+provTax+cppEmp+cpp2Emp+eiEmp);
  var net=d.netAmount||(gross-totalDed);
  var deductions={};
  if(cppEmp)deductions.cpp=cppEmp;
  if(cpp2Emp)deductions.cpp2=cpp2Emp;
  if(eiEmp)deductions.ei=eiEmp;
  if(fedTax)deductions.federalTax=fedTax;
  if(provTax)deductions.provincialTax=provTax;
  return {
    id:Date.now()+'_'+Math.random().toString(36).slice(2,8),
    employee:d.employeeName||'Unknown',
    date:d.payDate||new Date().toISOString().slice(0,10),
    period:d.payFrequency||'Biweekly',
    hours:0,rate:0,gross:gross,
    deductions:deductions,totalDeductions:+totalDed.toFixed(2),net:+net.toFixed(2),
    vacationPay:d.vacationPay||0,
    dhCpp:d.cppEmployer||0,dhCpp2:d.cpp2Employer||0,
    dhEi:d.eiEmployer||0,
    dhRemittance:d.totalRemittance||0,
    notes:'Scanned from CRA PDOC'
  };
}

function _showBatchPaystubPreview(records){
  var spinner=document.getElementById('paystub-scan-spinner');
  var preview=document.getElementById('paystub-scan-preview');
  spinner.style.display='none';preview.style.display='';
  window._scannedBatch=records;
  var html='<div style="margin-top:12px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px"><div style="font-size:15px;font-weight:700;color:var(--white)">'+records.length+' Pay Stubs Found</div><div style="background:var(--green);color:#000;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:700">AI Scanned</div></div>';
  records.forEach(function(d,i){
    var gross=d.totalCashIncome||((d.salaryOrWages||0)+(d.vacationPay||0));
    var net=d.netAmount||0;
    var remit=d.totalRemittance||0;
    html+='<div style="border:1px solid var(--border);border-radius:10px;padding:12px;margin-bottom:8px;background:var(--navy-lift)">';
    html+='<div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:4px">';
    html+='<div><span style="font-size:14px;font-weight:700;color:var(--white)">'+( d.employeeName||'Unknown')+'</span><span style="font-size:11px;color:var(--muted);margin-left:8px">'+(d.payDate||'')+'</span></div>';
    html+='<div style="display:flex;gap:12px;font-size:12px">';
    html+='<span style="color:var(--green);font-weight:600">$'+gross.toFixed(2)+' gross</span>';
    html+='<span style="color:var(--blue-bright);font-weight:600">$'+net.toFixed(2)+' net</span>';
    if(remit) html+='<span style="color:var(--orange);font-weight:600">$'+remit.toFixed(2)+' CRA</span>';
    html+='</div></div></div>';
  });
  html+='<div style="display:flex;gap:10px;margin-top:12px">';
  html+='<button onclick="_acceptBatchPaystubs()" style="flex:1;padding:10px;border-radius:10px;border:none;background:var(--green);color:#000;font-size:13px;font-weight:700;cursor:pointer">Add All '+records.length+' Pay Stubs</button>';
  html+='<button onclick="_dismissPaystubScan()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:13px;cursor:pointer">Discard</button>';
  html+='</div></div>';
  preview.innerHTML=html;
}

function _acceptBatchPaystubs(){
  var records=window._scannedBatch;if(!records||!records.length)return;
  var count=0;
  records.forEach(function(d){
    employeePayroll.push(_buildPaystubRecord(d));
    count++;
  });
  employeePayroll.sort(function(a,b){return b.date.localeCompare(a.date);});
  saveEmployeePayroll();
  _dismissPaystubScan();
  renderEmployeePayroll();
  renderRemittanceSummary();
  showDhToast&&showDhToast(count+' pay stubs added','Imported '+count+' records from CRA PDOC','✓','var(--green)',4000);
}

function _acceptPaystubScan(){
  var d=window._scannedPaystub;if(!d)return;
  employeePayroll.push(_buildPaystubRecord(d));
  employeePayroll.sort(function(a,b){return b.date.localeCompare(a.date);});
  saveEmployeePayroll();
  _dismissPaystubScan();
  renderEmployeePayroll();
  renderRemittanceSummary();
  var net=d.netAmount||((d.totalCashIncome||((d.salaryOrWages||0)+(d.vacationPay||0)))-(d.totalDeductions||0));
  showDhToast&&showDhToast('Pay stub added',(d.employeeName||'Unknown')+' — $'+net.toFixed(2)+' net','✓','var(--green)',3000);
}

function _dismissPaystubScan(){
  window._scannedPaystub=null;
  window._scannedBatch=null;
  window._stagedPaystubs={1:[],2:[]};
  var zones=document.getElementById('paystub-scan-zones');
  if(zones)zones.style.display='';
  var z1=document.getElementById('paystub-scan-zone-1');
  if(z1){z1.style.borderColor='var(--blue)';z1.innerHTML='<div style="margin-bottom:2px;color:var(--blue-bright)">'+_icon('notes',18)+'</div><div style="font-size:11px;font-weight:600;color:var(--blue-bright)">Employee deductions</div><div style="font-size:9px;color:var(--muted);margin-top:2px">Drop or click — multiple OK</div>';}
  var z2=document.getElementById('paystub-scan-zone-2');
  if(z2){z2.style.borderColor='var(--orange)';z2.innerHTML='<div style="margin-bottom:2px;color:var(--orange)">'+_icon('notes',18)+'</div><div style="font-size:11px;font-weight:600;color:var(--orange)">Company remittance</div><div style="font-size:9px;color:var(--muted);margin-top:2px">Drop or click — multiple OK</div>';}
  document.getElementById('paystub-scan-submit').style.display='none';
  document.getElementById('paystub-scan-spinner').style.display='none';
  document.getElementById('paystub-scan-preview').style.display='none';
}

// ── Monthly CRA Remittance Summary ──────────────────────────────────────────
function populateRemittanceMonths(){
  const sel=document.getElementById('remittance-month-select');
  if(!sel)return;
  const months=new Set();
  employeePayroll.forEach(p=>{
    if(p.date)months.add(p.date.slice(0,7)); // YYYY-MM
  });
  // Add current month
  months.add(new Date().toISOString().slice(0,7));
  const cur=sel.value;
  const sorted=[...months].sort().reverse();
  sel.innerHTML=sorted.map(m=>{
    const [y,mo]=m.split('-');
    const label=new Date(y,parseInt(mo)-1).toLocaleString('en',{month:'long',year:'numeric'});
    return `<option value="${m}"${m===cur?' selected':''}>${label}</option>`;
  }).join('');
  if(!cur&&sorted.length)sel.value=sorted[0];
}

function renderRemittanceSummary(){
  populateRemittanceMonths();
  const el=document.getElementById('remittance-summary-content');
  if(!el)return;
  const month=document.getElementById('remittance-month-select')?.value;
  if(!month){el.innerHTML='';return;}

  const stubs=employeePayroll.filter(p=>p.date&&p.date.startsWith(month));
  if(!stubs.length){
    el.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px">No pay stubs for this month</div>';
    return;
  }

  // Group by pay date to find pay periods
  const byDate={};
  stubs.forEach(s=>{
    if(!byDate[s.date])byDate[s.date]=[];
    byDate[s.date].push(s);
  });
  const payPeriods=Object.keys(byDate).sort();
  const numPeriods=payPeriods.length;

  // Unique employees
  const empNames=new Set();
  stubs.forEach(s=>empNames.add(s.employee));
  const numEmployees=empNames.size;

  // Totals
  let totalGross=0,totalNet=0,totalDeductions=0,totalRemittance=0;
  let totalCppEmp=0,totalCppER=0,totalEiEmp=0,totalEiER=0,totalFedTax=0,totalProvTax=0;
  stubs.forEach(s=>{
    totalGross+=s.gross||0;
    totalNet+=s.net||0;
    totalDeductions+=s.totalDeductions||0;
    totalRemittance+=s.dhRemittance||0;
    if(s.deductions){
      totalCppEmp+=s.deductions.cpp||0;
      totalEiEmp+=s.deductions.ei||0;
      totalFedTax+=s.deductions.federalTax||0;
      totalProvTax+=s.deductions.provincialTax||0;
    }
    totalCppER+=s.dhCpp||0;
    totalEiER+=s.dhEi||0;
  });

  // Per-period breakdown
  const periodRows=payPeriods.map(date=>{
    const ps=byDate[date];
    const pGross=ps.reduce((a,s)=>a+(s.gross||0),0);
    const pRemit=ps.reduce((a,s)=>a+(s.dhRemittance||0),0);
    const pEmps=new Set(ps.map(s=>s.employee)).size;
    return `<tr>
      <td style="padding:6px 10px;font-size:12px;color:var(--offwhite)">${date}</td>
      <td style="padding:6px 10px;font-size:12px;color:var(--muted);text-align:center">${pEmps}</td>
      <td style="padding:6px 10px;font-size:12px;color:var(--green);text-align:right">$${pGross.toFixed(2)}</td>
      <td style="padding:6px 10px;font-size:12px;color:var(--orange);text-align:right">$${pRemit.toFixed(2)}</td>
    </tr>`;
  }).join('');

  const [yr,mo]=month.split('-');
  const monthLabel=new Date(yr,parseInt(mo)-1).toLocaleString('en',{month:'long',year:'numeric'});

  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px">
      <div style="background:var(--navy-lift);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Employees Paid</div>
        <div style="font-size:22px;font-weight:800;color:var(--white)">${numEmployees}</div>
        <div style="font-size:10px;color:var(--muted)">${numPeriods} pay period${numPeriods!==1?'s':''}</div>
      </div>
      <div style="background:var(--navy-lift);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Total Cash Income</div>
        <div style="font-size:22px;font-weight:800;color:var(--green)">$${totalGross.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--muted)">Wages + vacation</div>
      </div>
      <div style="background:linear-gradient(135deg,rgba(255,160,0,.12),rgba(255,160,0,.03));border:1px solid var(--orange);border-radius:10px;padding:14px;text-align:center">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Remit to CRA</div>
        <div style="font-size:22px;font-weight:800;color:var(--orange)">$${totalRemittance.toFixed(2)}</div>
        <div style="font-size:10px;color:var(--muted)">${monthLabel}</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px">
      <thead><tr style="border-bottom:1px solid var(--border)">
        <th style="padding:5px 10px;font-size:10px;color:var(--muted);text-align:left;text-transform:uppercase;letter-spacing:.06em">Pay Date</th>
        <th style="padding:5px 10px;font-size:10px;color:var(--muted);text-align:center;text-transform:uppercase;letter-spacing:.06em">Employees</th>
        <th style="padding:5px 10px;font-size:10px;color:var(--muted);text-align:right;text-transform:uppercase;letter-spacing:.06em">Cash Income</th>
        <th style="padding:5px 10px;font-size:10px;color:var(--muted);text-align:right;text-transform:uppercase;letter-spacing:.06em">Remittance</th>
      </tr></thead>
      <tbody>${periodRows}
        <tr style="border-top:2px solid var(--border)">
          <td style="padding:8px 10px;font-size:13px;font-weight:700;color:var(--white)">TOTAL</td>
          <td style="padding:8px 10px;font-size:13px;font-weight:700;color:var(--white);text-align:center">${numEmployees}</td>
          <td style="padding:8px 10px;font-size:13px;font-weight:700;color:var(--green);text-align:right">$${totalGross.toFixed(2)}</td>
          <td style="padding:8px 10px;font-size:13px;font-weight:700;color:var(--orange);text-align:right">$${totalRemittance.toFixed(2)}</td>
        </tr>
      </tbody>
    </table>

    <div style="font-size:12px;font-weight:700;color:var(--white);margin-bottom:8px">Per-Employee Breakdown</div>
    ${(()=>{
      const byEmpR={};
      stubs.forEach(s=>{
        if(!byEmpR[s.employee])byEmpR[s.employee]={gross:0,net:0,vacation:0,cpp:0,ei:0,fedTax:0,provTax:0,dhCpp:0,dhEi:0,remit:0,periods:0};
        const e=byEmpR[s.employee];
        e.gross+=s.gross||0;e.net+=s.net||0;e.vacation+=s.vacationPay||0;
        e.cpp+=(s.deductions?.cpp||0);e.ei+=(s.deductions?.ei||0);
        e.fedTax+=(s.deductions?.federalTax||0);e.provTax+=(s.deductions?.provincialTax||0);
        e.dhCpp+=s.dhCpp||0;e.dhEi+=s.dhEi||0;e.remit+=s.dhRemittance||0;e.periods++;
      });
      return Object.entries(byEmpR).sort((a,b)=>a[0].localeCompare(b[0])).map(([name,e])=>`
        <div class="card" style="margin-bottom:8px;padding:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-size:13px;font-weight:700;color:var(--white)">${name}</div>
            <div style="font-size:11px;color:var(--muted)">${e.periods} pay period${e.periods!==1?'s':''}</div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-bottom:8px">
            <div style="background:var(--navy-mid);border-radius:6px;padding:8px;text-align:center">
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase">Gross</div>
              <div style="font-size:13px;font-weight:700;color:var(--green)">$${e.gross.toFixed(2)}</div>
            </div>
            <div style="background:var(--navy-mid);border-radius:6px;padding:8px;text-align:center">
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase">Net Paid</div>
              <div style="font-size:13px;font-weight:700;color:var(--blue-bright)">$${e.net.toFixed(2)}</div>
            </div>
            <div style="background:var(--navy-mid);border-radius:6px;padding:8px;text-align:center">
              <div style="font-size:9px;color:var(--muted);text-transform:uppercase">Remittance</div>
              <div style="font-size:13px;font-weight:700;color:var(--orange)">$${e.remit.toFixed(2)}</div>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 16px;font-size:10px;color:var(--muted)">
            ${e.vacation?`<div>Vacation Pay: <span style="color:var(--green)">$${e.vacation.toFixed(2)}</span></div>`:''}
            <div>Emp CPP: <span style="color:var(--red)">$${e.cpp.toFixed(2)}</span></div>
            <div>DH CPP: <span style="color:var(--orange)">$${e.dhCpp.toFixed(2)}</span></div>
            <div>Emp EI: <span style="color:var(--red)">$${e.ei.toFixed(2)}</span></div>
            <div>DH EI: <span style="color:var(--orange)">$${e.dhEi.toFixed(2)}</span></div>
            <div>Federal Tax: <span style="color:var(--red)">$${e.fedTax.toFixed(2)}</span></div>
            <div>Provincial Tax: <span style="color:var(--red)">$${e.provTax.toFixed(2)}</span></div>
          </div>
        </div>`).join('');
    })()}

    <div style="background:var(--navy-lift);border-radius:8px;padding:12px;font-size:11px;color:var(--muted)">
      <div style="font-weight:700;margin-bottom:6px;color:var(--offwhite)">Total Remittance Breakdown</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 20px">
        <div>Employee CPP: <span style="color:var(--red)">$${totalCppEmp.toFixed(2)}</span></div>
        <div>Employer CPP: <span style="color:var(--orange)">$${totalCppER.toFixed(2)}</span></div>
        <div>Employee EI: <span style="color:var(--red)">$${totalEiEmp.toFixed(2)}</span></div>
        <div>Employer EI: <span style="color:var(--orange)">$${totalEiER.toFixed(2)}</span></div>
        <div>Federal Tax: <span style="color:var(--red)">$${totalFedTax.toFixed(2)}</span></div>
        <div>Provincial Tax: <span style="color:var(--red)">$${totalProvTax.toFixed(2)}</span></div>
      </div>
    </div>`;
}

// ── Year-End T4 Generation ──────────────────────────────────────────────────
function populateT4Years(){
  const sel=document.getElementById('t4-year-select');
  if(!sel)return;
  const years=new Set();
  employeePayroll.forEach(p=>{if(p.date)years.add(p.date.slice(0,4));});
  const sorted=[...years].sort().reverse();
  const cur=sel.value||sorted[0]||'';
  sel.innerHTML=sorted.map(y=>`<option value="${y}" ${y===cur?'selected':''}>${y}</option>`).join('');
  if(!sel.value&&sorted.length)sel.value=sorted[0];
}

function _calcT4(empName,year){
  const stubs=employeePayroll.filter(p=>p.employee===empName&&p.date&&p.date.startsWith(year));
  if(!stubs.length)return null;
  const t4={employee:empName,year,periods:stubs.length};
  t4.box14=stubs.reduce((a,s)=>a+(s.gross||0),0); // Employment income (includes vacation pay)
  t4.box16=stubs.reduce((a,s)=>a+(s.deductions?.cpp||0),0); // Employee CPP
  t4.box17=stubs.reduce((a,s)=>a+(s.deductions?.cpp2||0),0); // Employee CPP2
  t4.box18=stubs.reduce((a,s)=>a+(s.deductions?.ei||0),0); // Employee EI
  t4.box22=stubs.reduce((a,s)=>a+(s.deductions?.federalTax||0)+(s.deductions?.provincialTax||0),0); // Income tax deducted
  // CRA annual maximums by year
  const eiMax={2024:63200,2025:65700,2026:68400};
  const cppMax1={2024:68500,2025:71300,2026:73200}; // First CPP ceiling
  const cppMax2={2024:73200,2025:79400,2026:81200}; // Second CPP ceiling (CPP2)
  t4.box24=Math.min(t4.box14,eiMax[year]||eiMax[2025]); // EI insurable earnings (capped)
  t4.box26=Math.min(t4.box14,cppMax1[year]||cppMax1[2025]); // CPP pensionable earnings (capped at first ceiling)
  // Box 40: only non-zero if there are actual taxable allowances/benefits beyond regular pay
  // Vacation pay is already included in Box 14 gross — do NOT put it in Box 40
  t4.box40=stubs.reduce((a,s)=>a+(s.deductions?.taxableAllowances||0),0);
  t4.box44=stubs.reduce((a,s)=>a+(s.deductions?.unionDues||0),0); // Union dues
  t4.box20=stubs.reduce((a,s)=>a+(s.deductions?.pension||0),0); // RPP contributions
  t4.fedTax=stubs.reduce((a,s)=>a+(s.deductions?.federalTax||0),0);
  t4.provTax=stubs.reduce((a,s)=>a+(s.deductions?.provincialTax||0),0);
  t4.dhCpp=stubs.reduce((a,s)=>a+(s.dhCpp||0),0);
  t4.dhEi=stubs.reduce((a,s)=>a+(s.dhEi||0),0);
  t4.totalRemit=stubs.reduce((a,s)=>a+(s.dhRemittance||0),0);
  t4.netPaid=stubs.reduce((a,s)=>a+(s.net||0),0);
  return t4;
}

function renderT4Summary(){
  populateT4Years();
  const el=document.getElementById('t4-summary-content');
  if(!el)return;
  const year=document.getElementById('t4-year-select')?.value;
  if(!year){el.innerHTML='';return;}

  const emps=new Set();
  employeePayroll.forEach(p=>{if(p.date&&p.date.startsWith(year))emps.add(p.employee);});
  if(!emps.size){
    el.innerHTML='<div style="text-align:center;padding:16px;color:var(--muted);font-size:13px">No pay stubs for '+year+'</div>';
    return;
  }

  const t4s=[...emps].sort().map(name=>_calcT4(name,year)).filter(Boolean);

  el.innerHTML=`
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px">
      ${t4s.map(t=>{
        const member=_findLinkedTeamMember(t.employee);
        const emailBadge=member?.email?`<div style="font-size:10px;color:var(--muted)">${member.email}</div>`:'';
        return `<div class="card" style="margin-bottom:0;padding:14px">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--white)">${t.employee}</div>
              ${emailBadge}
            </div>
            <div style="font-size:11px;font-weight:600;color:var(--muted);background:var(--navy-mid);border-radius:6px;padding:3px 8px">T4 — ${t.year}</div>
          </div>
          <div style="display:grid;grid-template-columns:auto 1fr;gap:3px 12px;font-size:11px">
            <span style="color:var(--muted);font-weight:600">Box 14</span><span style="color:var(--green)">$${t.box14.toFixed(2)} <span style="color:var(--muted);font-weight:400">Employment income</span></span>
            <span style="color:var(--muted);font-weight:600">Box 16</span><span style="color:var(--red)">$${t.box16.toFixed(2)} <span style="color:var(--muted);font-weight:400">CPP contributions</span></span>
            ${t.box17?`<span style="color:var(--muted);font-weight:600">Box 17</span><span style="color:var(--red)">$${t.box17.toFixed(2)} <span style="color:var(--muted);font-weight:400">CPP2 contributions</span></span>`:''}
            <span style="color:var(--muted);font-weight:600">Box 18</span><span style="color:var(--red)">$${t.box18.toFixed(2)} <span style="color:var(--muted);font-weight:400">EI premiums</span></span>
            <span style="color:var(--muted);font-weight:600">Box 22</span><span style="color:var(--red)">$${t.box22.toFixed(2)} <span style="color:var(--muted);font-weight:400">Income tax deducted</span></span>
            <span style="color:var(--muted);font-weight:600">Box 24</span><span style="color:var(--offwhite)">$${t.box24.toFixed(2)} <span style="color:var(--muted);font-weight:400">EI insurable earnings</span></span>
            <span style="color:var(--muted);font-weight:600">Box 26</span><span style="color:var(--offwhite)">$${t.box26.toFixed(2)} <span style="color:var(--muted);font-weight:400">CPP pensionable earnings</span></span>
            ${t.box44?`<span style="color:var(--muted);font-weight:600">Box 44</span><span style="color:var(--red)">$${t.box44.toFixed(2)} <span style="color:var(--muted);font-weight:400">Union dues</span></span>`:''}
            ${t.box20?`<span style="color:var(--muted);font-weight:600">Box 20</span><span style="color:var(--red)">$${t.box20.toFixed(2)} <span style="color:var(--muted);font-weight:400">RPP contributions</span></span>`:''}
          </div>
          <div style="border-top:1px solid var(--border);margin-top:10px;padding-top:8px;display:grid;grid-template-columns:1fr 1fr;gap:3px 12px;font-size:10px;color:var(--muted)">
            <div>Federal Tax: <span style="color:var(--red)">$${t.fedTax.toFixed(2)}</span></div>
            <div>Provincial Tax: <span style="color:var(--red)">$${t.provTax.toFixed(2)}</span></div>
            <div>ER CPP: <span style="color:var(--orange)">$${t.dhCpp.toFixed(2)}</span></div>
            <div>ER EI: <span style="color:var(--orange)">$${t.dhEi.toFixed(2)}</span></div>
            <div>Total Remittance: <span style="color:var(--orange)">$${t.totalRemit.toFixed(2)}</span></div>
            <div>Net Paid: <span style="color:var(--blue-bright)">$${t.netPaid.toFixed(2)}</span></div>
          </div>
          <div style="display:flex;gap:6px;margin-top:10px;flex-wrap:wrap">
            <button onclick="openCRAT4Form('${t.employee}','${t.year}')" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--green);background:rgba(34,217,122,.1);color:var(--green);font-size:11px;font-weight:600;cursor:pointer;white-space:nowrap">Generate CRA T4</button>
            <button onclick="viewT4Detail('${t.employee}','${t.year}')" style="padding:8px 12px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:600;cursor:pointer">Summary</button>
            <button onclick="exportT4CSV('${t.employee}','${t.year}')" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">CSV</button>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function viewT4Detail(empName,year){
  const t=_calcT4(empName,year);
  if(!t)return;
  const member=_findLinkedTeamMember(empName);
  const html=`<div style="padding:24px;max-width:520px;margin:auto">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.15em;margin-bottom:2px">Canada Revenue Agency</div>
      <div style="font-size:20px;font-weight:800;color:var(--white)">T4 — Statement of Remuneration Paid</div>
      <div style="font-size:12px;color:var(--muted);margin-top:4px">Tax Year ${year}</div>
    </div>

    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px">
        <div>
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Employee</div>
          <div style="font-size:15px;font-weight:700;color:var(--white)">${empName}</div>
          ${member?.email?`<div style="font-size:11px;color:var(--muted)">${member.email}</div>`:''}
        </div>
        <div style="text-align:right">
          <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Employer</div>
          <div style="font-size:13px;font-weight:600;color:var(--white)">DroneHub Media Company Corp</div>
          <div style="font-size:11px;color:var(--muted)">Ontario, Canada</div>
        </div>
      </div>
      <div style="font-size:10px;color:var(--muted)">${t.periods} pay periods in ${year}</div>
    </div>

    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">T4 Box Summary</div>
      <table style="width:100%;border-collapse:collapse">
        <tbody>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 14</span> <span style="color:var(--offwhite)">Employment income</span></td><td style="padding:6px 0;font-size:13px;font-weight:700;color:var(--green);text-align:right">$${t.box14.toFixed(2)}</td></tr>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 16</span> <span style="color:var(--offwhite)">Employee CPP contributions</span></td><td style="padding:6px 0;font-size:13px;font-weight:700;color:var(--red);text-align:right">$${t.box16.toFixed(2)}</td></tr>
          ${t.box17?`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 17</span> <span style="color:var(--offwhite)">Employee CPP2 contributions</span></td><td style="padding:6px 0;font-size:13px;font-weight:700;color:var(--red);text-align:right">$${t.box17.toFixed(2)}</td></tr>`:''}
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 18</span> <span style="color:var(--offwhite)">Employee EI premiums</span></td><td style="padding:6px 0;font-size:13px;font-weight:700;color:var(--red);text-align:right">$${t.box18.toFixed(2)}</td></tr>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 22</span> <span style="color:var(--offwhite)">Income tax deducted</span></td><td style="padding:6px 0;font-size:13px;font-weight:700;color:var(--red);text-align:right">$${t.box22.toFixed(2)}</td></tr>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 24</span> <span style="color:var(--offwhite)">EI insurable earnings</span></td><td style="padding:6px 0;font-size:13px;color:var(--offwhite);text-align:right">$${t.box24.toFixed(2)}</td></tr>
          <tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 26</span> <span style="color:var(--offwhite)">CPP/QPP pensionable earnings</span></td><td style="padding:6px 0;font-size:13px;color:var(--offwhite);text-align:right">$${t.box26.toFixed(2)}</td></tr>
          ${t.box44?`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 44</span> <span style="color:var(--offwhite)">Union dues</span></td><td style="padding:6px 0;font-size:13px;color:var(--red);text-align:right">$${t.box44.toFixed(2)}</td></tr>`:''}
          ${t.box20?`<tr style="border-bottom:1px solid var(--border)"><td style="padding:6px 0;font-size:12px"><span style="color:var(--muted);font-weight:700;margin-right:8px">Box 20</span> <span style="color:var(--offwhite)">RPP contributions</span></td><td style="padding:6px 0;font-size:13px;color:var(--red);text-align:right">$${t.box20.toFixed(2)}</td></tr>`:''}
        </tbody>
      </table>
    </div>

    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Tax Breakdown</div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:var(--offwhite)">Federal Tax</span><span style="color:var(--red)">$${t.fedTax.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:var(--offwhite)">Provincial Tax (Ontario)</span><span style="color:var(--red)">$${t.provTax.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-top:1px solid var(--border);margin-top:4px;padding-top:8px"><span style="font-weight:700;color:var(--offwhite)">Total Tax Deducted (Box 22)</span><span style="font-weight:700;color:var(--red)">$${t.box22.toFixed(2)}</span></div>
    </div>

    <div style="background:var(--navy-lift);border:1px solid rgba(255,165,0,.2);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Employer Contributions (DroneHub)</div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:var(--offwhite)">Employer CPP</span><span style="color:var(--orange)">$${t.dhCpp.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px"><span style="color:var(--offwhite)">Employer EI</span><span style="color:var(--orange)">$${t.dhEi.toFixed(2)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;border-top:1px solid rgba(255,165,0,.2);margin-top:4px;padding-top:8px"><span style="font-weight:700;color:var(--offwhite)">Total CRA Remittance (${year})</span><span style="font-weight:700;color:var(--orange)">$${t.totalRemit.toFixed(2)}</span></div>
    </div>

    <div style="background:linear-gradient(135deg,rgba(91,141,239,.15),rgba(91,141,239,.05));border:1px solid var(--blue);border-radius:10px;padding:14px;text-align:center;margin-bottom:14px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Total Net Paid to ${empName.split(' ')[0]} in ${year}</div>
      <div style="font-size:26px;font-weight:800;color:var(--blue-bright)">$${t.netPaid.toFixed(2)}</div>
    </div>

    <div style="display:flex;gap:8px">
      <button onclick="exportT4CSV('${empName}','${year}')" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--green);background:rgba(34,217,122,.1);color:var(--green);font-size:12px;font-weight:600;cursor:pointer">Export CSV</button>
      <button onclick="printT4('${empName}','${year}')" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:600;cursor:pointer">Print T4</button>
      <button onclick="closeModal()" style="padding:10px 16px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:12px;cursor:pointer">Close</button>
    </div>
  </div>`;
  openModal(html);
}

function exportT4CSV(empName,year){
  const t=_calcT4(empName,year);
  if(!t)return;
  const rows=[
    ['T4 Statement of Remuneration Paid — '+year],
    ['Employee',empName],
    ['Employer','DroneHub Media Company Corp'],
    ['Province','Ontario'],
    ['Pay Periods',t.periods],
    [],
    ['Box','Description','Amount'],
    ['14','Employment income',t.box14.toFixed(2)],
    ['16','Employee CPP contributions',t.box16.toFixed(2)],
    ['17','Employee CPP2 contributions',t.box17.toFixed(2)],
    ['18','Employee EI premiums',t.box18.toFixed(2)],
    ['22','Income tax deducted',t.box22.toFixed(2)],
    ['24','EI insurable earnings',t.box24.toFixed(2)],
    ['26','CPP pensionable earnings',t.box26.toFixed(2)],
    ['44','Union dues',t.box44.toFixed(2)],
    ['20','RPP contributions',t.box20.toFixed(2)],
    [],
    ['','Federal tax',t.fedTax.toFixed(2)],
    ['','Provincial tax',t.provTax.toFixed(2)],
    [],
    ['','Employer CPP',t.dhCpp.toFixed(2)],
    ['','Employer EI',t.dhEi.toFixed(2)],
    ['','Total CRA remittance',t.totalRemit.toFixed(2)],
    ['','Total net paid',t.netPaid.toFixed(2)]
  ];
  const csv=rows.map(r=>r.map(c=>'"'+String(c).replace(/"/g,'""')+'"').join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`T4_${empName.replace(/\s+/g,'_')}_${year}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function printT4(empName,year){
  const t=_calcT4(empName,year);
  if(!t)return;
  const member=_findLinkedTeamMember(empName);
  const w=window.open('','_blank','width=800,height=1000');
  w.document.write(`<!DOCTYPE html><html><head><title>T4 — ${empName} — ${year}</title>
  <style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:700px;margin:40px auto;padding:20px;color:#222}
  h1{font-size:18px;text-align:center;margin-bottom:4px}h2{font-size:13px;text-align:center;color:#666;margin-top:0}
  .info{display:flex;justify-content:space-between;margin:20px 0;padding:14px;background:#f5f5f5;border-radius:8px}
  table{width:100%;border-collapse:collapse;margin:16px 0}td,th{padding:8px 12px;text-align:left;border-bottom:1px solid #ddd;font-size:13px}
  th{background:#f0f0f0;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em}
  .amt{text-align:right;font-weight:600;font-variant-numeric:tabular-nums}
  .section{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#666;margin:20px 0 8px;padding-top:12px;border-top:2px solid #ddd}
  .total{font-weight:700;font-size:14px;border-top:2px solid #333}
  @media print{body{margin:20px}}</style></head><body>
  <h1>T4 — Statement of Remuneration Paid</h1>
  <h2>Canada Revenue Agency · Tax Year ${year}</h2>
  <div class="info"><div><strong>Employee:</strong> ${empName}${member?.email?'<br><span style="color:#666;font-size:12px">'+member.email+'</span>':''}</div><div style="text-align:right"><strong>Employer:</strong> DroneHub Media Company Corp<br><span style="color:#666;font-size:12px">Ontario, Canada · ${t.periods} pay periods</span></div></div>
  <table><thead><tr><th>Box</th><th>Description</th><th style="text-align:right">Amount</th></tr></thead><tbody>
  <tr><td>14</td><td>Employment income</td><td class="amt">$${t.box14.toFixed(2)}</td></tr>
  <tr><td>16</td><td>Employee CPP contributions</td><td class="amt">$${t.box16.toFixed(2)}</td></tr>
  ${t.box17?`<tr><td>17</td><td>Employee CPP2 contributions</td><td class="amt">$${t.box17.toFixed(2)}</td></tr>`:''}
  <tr><td>18</td><td>Employee EI premiums</td><td class="amt">$${t.box18.toFixed(2)}</td></tr>
  <tr><td>22</td><td>Income tax deducted</td><td class="amt">$${t.box22.toFixed(2)}</td></tr>
  <tr><td>24</td><td>EI insurable earnings</td><td class="amt">$${t.box24.toFixed(2)}</td></tr>
  <tr><td>26</td><td>CPP/QPP pensionable earnings</td><td class="amt">$${t.box26.toFixed(2)}</td></tr>
  ${t.box44?`<tr><td>44</td><td>Union dues</td><td class="amt">$${t.box44.toFixed(2)}</td></tr>`:''}
  ${t.box20?`<tr><td>20</td><td>RPP contributions</td><td class="amt">$${t.box20.toFixed(2)}</td></tr>`:''}
  </tbody></table>
  <div class="section">Tax Breakdown</div>
  <table><tbody>
  <tr><td></td><td>Federal tax</td><td class="amt">$${t.fedTax.toFixed(2)}</td></tr>
  <tr><td></td><td>Provincial tax (Ontario)</td><td class="amt">$${t.provTax.toFixed(2)}</td></tr>
  <tr class="total"><td></td><td>Total tax deducted</td><td class="amt">$${t.box22.toFixed(2)}</td></tr>
  </tbody></table>
  <div class="section">Employer Contributions</div>
  <table><tbody>
  <tr><td></td><td>Employer CPP</td><td class="amt">$${t.dhCpp.toFixed(2)}</td></tr>
  <tr><td></td><td>Employer EI</td><td class="amt">$${t.dhEi.toFixed(2)}</td></tr>
  <tr class="total"><td></td><td>Total CRA remittance</td><td class="amt">$${t.totalRemit.toFixed(2)}</td></tr>
  </tbody></table>
  <div style="text-align:center;margin-top:24px;padding:16px;background:#f0f7ff;border-radius:8px"><div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px">Total Net Paid to ${empName.split(' ')[0]}</div><div style="font-size:28px;font-weight:800;color:#2563eb">$${t.netPaid.toFixed(2)}</div></div>
  <div style="text-align:center;margin-top:20px;font-size:11px;color:#999">Generated by DroneHub Operations Hub</div>
  </body></html>`);
  w.document.close();
  w.print();
}

// ── CRA T4 Official Form Generator ─────────────────────────────────────────
function _getT4EmployerInfo(){
  try{return JSON.parse(localStorage.getItem(lsKey('t4_employer'))||'{}');}catch(e){return {};}
}
function _saveT4EmployerInfo(info){
  try{localStorage.setItem(lsKey('t4_employer'),JSON.stringify(info));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':t4_employer',{data:JSON.stringify(info),updatedAt:Date.now()}).catch(e=>console.error('[_saveT4EmployerInfo] Firebase write failed:',e.message));
  }
}

function openCRAT4Form(empName,year){
  const t=_calcT4(empName,year);
  if(!t)return;
  const member=_findLinkedTeamMember(empName);
  const biz=typeof bizSettings!=='undefined'?bizSettings:{};
  const emp=_getT4EmployerInfo();
  // Pull from business profile — each org has their own bizSettings
  if(!emp.name) emp.name=biz.name||'';
  if(!emp.addr) emp.addr=[biz.addr1,biz.addr2].filter(Boolean).join(', ')||'';
  if(!emp.bn) emp.bn=biz.hst||'';
  // Find employee address from CONTRACTORS or member
  const empN=(empName||'').toLowerCase().trim();
  let eeAddr=member?.address||member?.addr||'';
  if(!eeAddr&&typeof CONTRACTORS!=='undefined'){
    const cMatch=Object.values(CONTRACTORS).find(c=>(c.name||'').toLowerCase().trim()===empN);
    if(cMatch&&cMatch.addr) eeAddr=cMatch.addr;
  }
  // Find employee email/phone from member or contractor
  const eeEmail=member?.email||'';
  const eePhone=member?.phone||'';
  const bx=(v)=>v?v.toFixed(2):'';
  const _id='t4f_'+Date.now();

  const html=`<div style="padding:20px;max-width:560px;margin:auto;max-height:85vh;overflow-y:auto" id="${_id}">
    <div style="text-align:center;margin-bottom:16px">
      <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.15em">Canada Revenue Agency</div>
      <div style="font-size:18px;font-weight:800;color:var(--white)">T4 Statement of Remuneration Paid</div>
      <div style="font-size:12px;color:var(--muted)">Tax Year ${year}</div>
    </div>

    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Employer Information <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted)">(saved for future use)</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px">Business Number (BN)</label>
          <input id="t4-er-bn" value="${emp.bn||''}" placeholder="123456789RP0001" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px">Employer Name</label>
          <input id="t4-er-name" value="${emp.name||''}" placeholder="Your Business Name" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
        </div>
        <div style="grid-column:span 2">
          <label style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px">Employer Address</label>
          <input id="t4-er-addr" value="${emp.addr||''}" placeholder="123 Main St, City, ON A1B 2C3" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
        </div>
      </div>
    </div>

    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--blue-bright);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Employee Information <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--muted)">(SIN is never stored)</span></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
        <div>
          <label style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px">Employee Name</label>
          <input id="t4-ee-name" value="${empName}" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px">Social Insurance Number</label>
          <input id="t4-ee-sin" type="text" inputmode="numeric" autocomplete="off" name="sin_field_nofill" autocorrect="off" autocapitalize="off" spellcheck="false" data-lpignore="true" data-1p-ignore data-form-type="other" placeholder="000 000 000" maxlength="11" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px">Employee Address</label>
          <input id="t4-ee-addr" value="${eeAddr}" placeholder="456 Worker Ave, City, ON" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
        </div>
        <div>
          <label style="font-size:10px;color:var(--muted);display:block;margin-bottom:2px">Province of Employment</label>
          <select id="t4-ee-prov" style="width:100%;padding:6px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-mid);color:var(--offwhite);box-sizing:border-box">
            <option value="ON" selected>Ontario</option>
            <option value="BC">British Columbia</option><option value="AB">Alberta</option><option value="SK">Saskatchewan</option>
            <option value="MB">Manitoba</option><option value="QC">Quebec</option><option value="NB">New Brunswick</option>
            <option value="NS">Nova Scotia</option><option value="PE">PEI</option><option value="NL">Newfoundland</option>
            <option value="YT">Yukon</option><option value="NT">NWT</option><option value="NU">Nunavut</option>
          </select>
        </div>
      </div>
    </div>

    <div style="background:var(--navy-lift);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px">T4 Boxes <span style="font-weight:400;text-transform:none;letter-spacing:0">(auto-filled from pay stubs — ${t.periods} periods)</span></div>
      <div style="display:grid;grid-template-columns:60px 1fr 110px;gap:4px 8px;align-items:center">
        ${[
          {box:'14',label:'Employment income',val:t.box14,color:'var(--green)'},
          {box:'16',label:'Employee CPP contributions',val:t.box16,color:'var(--red)'},
          {box:'17',label:'Employee CPP2 contributions',val:t.box17,color:'var(--red)'},
          {box:'18',label:'Employee EI premiums',val:t.box18,color:'var(--red)'},
          {box:'20',label:'RPP contributions',val:t.box20,color:'var(--red)'},
          {box:'22',label:'Income tax deducted',val:t.box22,color:'var(--red)'},
          {box:'24',label:'EI insurable earnings',val:t.box24,color:'var(--offwhite)'},
          {box:'26',label:'CPP/QPP pensionable earnings',val:t.box26,color:'var(--offwhite)'},
          {box:'44',label:'Union dues',val:t.box44,color:'var(--red)'},
          {box:'40',label:'Other taxable allowances/benefits',val:t.box40,color:'var(--offwhite)'},
        ].filter(b=>b.val).map(b=>
          '<div style="font-size:11px;font-weight:700;color:var(--muted);background:var(--navy-mid);border-radius:4px;padding:4px 6px;text-align:center">'+b.box+'</div>'+
          '<div style="font-size:11px;color:var(--offwhite)">'+b.label+'</div>'+
          '<input id="t4-box-'+b.box+'" value="'+bx(b.val)+'" style="width:100%;padding:4px 6px;border:1px solid var(--border);border-radius:4px;font-size:12px;font-weight:600;background:var(--navy-mid);color:'+b.color+';text-align:right;box-sizing:border-box">'
        ).join('')}
      </div>
    </div>

    <div style="background:var(--navy-lift);border:1px solid rgba(255,165,0,.2);border-radius:10px;padding:14px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;color:var(--orange);text-transform:uppercase;letter-spacing:.06em;margin-bottom:8px">Employer Totals (for your records)</div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px;font-size:11px">
        <div style="color:var(--muted)">Federal Tax: <span style="color:var(--red)">$${t.fedTax.toFixed(2)}</span></div>
        <div style="color:var(--muted)">Provincial Tax: <span style="color:var(--red)">$${t.provTax.toFixed(2)}</span></div>
        <div style="color:var(--muted)">Employer CPP: <span style="color:var(--orange)">$${t.dhCpp.toFixed(2)}</span></div>
        <div style="color:var(--muted)">Employer EI: <span style="color:var(--orange)">$${t.dhEi.toFixed(2)}</span></div>
        <div style="color:var(--muted)">Total Remittance: <span style="color:var(--orange);font-weight:700">$${t.totalRemit.toFixed(2)}</span></div>
        <div style="color:var(--muted)">Net Paid: <span style="color:var(--blue-bright);font-weight:700">$${t.netPaid.toFixed(2)}</span></div>
      </div>
    </div>

    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button onclick="_downloadCRAT4PDF('${_id}','${empName}','${year}')" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--green);background:rgba(34,217,122,.15);color:var(--green);font-size:13px;font-weight:700;cursor:pointer;min-width:140px">Download CRA T4 PDF</button>
      <button onclick="_submitCRAT4('${_id}','${empName}','${year}')" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:13px;font-weight:600;cursor:pointer;min-width:100px">Download XML</button>
      <button onclick="_printCRAT4('${_id}','${empName}','${year}')" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border-bright);background:rgba(91,141,239,.05);color:var(--muted);font-size:12px;font-weight:600;cursor:pointer;min-width:80px">Print</button>
      <button onclick="closeModal()" style="padding:10px 16px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:12px;cursor:pointer">Close</button>
    </div>
  </div>`;
  openModal(html);
  setTimeout(function(){var f=document.getElementById('t4-ee-sin');if(f){f.value='';f.setAttribute('readonly',true);setTimeout(function(){f.removeAttribute('readonly');},150);}},50);
}

function _readT4Form(containerId){
  const c=document.getElementById(containerId);
  if(!c)return null;
  const v=(id)=>(c.querySelector('#'+id)||{}).value||'';
  // Save employer info for next time
  const erInfo={bn:v('t4-er-bn'),name:v('t4-er-name'),addr:v('t4-er-addr')};
  _saveT4EmployerInfo(erInfo);
  return {
    erBN:v('t4-er-bn'),erName:v('t4-er-name'),erAddr:v('t4-er-addr'),
    eeName:v('t4-ee-name'),eeSIN:v('t4-ee-sin').replace(/\s/g,''),eeAddr:v('t4-ee-addr'),eeProv:v('t4-ee-prov'),
    box14:v('t4-box-14'),box16:v('t4-box-16'),box17:v('t4-box-17'),box18:v('t4-box-18'),
    box20:v('t4-box-20'),box22:v('t4-box-22'),box24:v('t4-box-24'),box26:v('t4-box-26'),
    box44:v('t4-box-44'),box40:v('t4-box-40')
  };
}

function _submitCRAT4(containerId,empName,year){
  const d=_readT4Form(containerId);
  if(!d)return;
  if(!d.erBN){alert('Please enter your Business Number (BN).');return;}
  if(!d.eeSIN||d.eeSIN.length!==9){alert('Please enter a valid 9-digit SIN for the employee.');return;}
  const lastName=empName.includes(' ')?empName.split(' ').slice(-1)[0]:empName;
  const firstName=empName.includes(' ')?empName.split(' ').slice(0,-1).join(' '):empName;
  const bn=d.erBN.replace(/\s/g,'');

  const xml=`<?xml version="1.0" encoding="UTF-8"?>
<Submission xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <T4>
    <T4Summary>
      <bn>${_xmlEsc(bn)}</bn>
      <tx_yr>${year}</tx_yr>
      <slp_cnt>1</slp_cnt>
      <rpt_tcd>O</rpt_tcd>
      <EMPR_NM>
        <l1_nm>${_xmlEsc(d.erName)}</l1_nm>
      </EMPR_NM>
      <EMPR_ADDR>
        <addr_l1_txt>${_xmlEsc(d.erAddr)}</addr_l1_txt>
        <prov_cd>ON</prov_cd>
        <cntry_cd>CAN</cntry_cd>
      </EMPR_ADDR>
      <CNTC>
        <cntc_nm>${_xmlEsc(d.erName)}</cntc_nm>
      </CNTC>
      <T4_TAMT>
        <tot_empt_incamt>${d.box14||'0.00'}</tot_empt_incamt>
        <tot_empe_cpp_amt>${d.box16||'0.00'}</tot_empe_cpp_amt>
        ${d.box17?'<tot_empe_cpp2_amt>'+d.box17+'</tot_empe_cpp2_amt>':''}
        <tot_empe_eip_amt>${d.box18||'0.00'}</tot_empe_eip_amt>
        <tot_itx_ddct_amt>${d.box22||'0.00'}</tot_itx_ddct_amt>
        <tot_ei_ins_erng_amt>${d.box24||'0.00'}</tot_ei_ins_erng_amt>
        <tot_cpp_qpp_pnsnbl_erng_amt>${d.box26||'0.00'}</tot_cpp_qpp_pnsnbl_erng_amt>
      </T4_TAMT>
    </T4Summary>
    <T4Slip>
      <EMPE_NM>
        <snm>${_xmlEsc(lastName)}</snm>
        <gvn_nm>${_xmlEsc(firstName)}</gvn_nm>
      </EMPE_NM>
      <EMPE_ADDR>
        <addr_l1_txt>${_xmlEsc(d.eeAddr)}</addr_l1_txt>
        <prov_cd>${d.eeProv}</prov_cd>
        <cntry_cd>CAN</cntry_cd>
      </EMPE_ADDR>
      <sin>${_xmlEsc(d.eeSIN)}</sin>
      <bn>${_xmlEsc(bn)}</bn>
      <prov_cd>${d.eeProv}</prov_cd>
      <T4_AMT>
        <empt_incamt>${d.box14||'0.00'}</empt_incamt>
        <cpp_cntrb_amt>${d.box16||'0.00'}</cpp_cntrb_amt>
        ${d.box17?'<cpp2_cntrb_amt>'+d.box17+'</cpp2_cntrb_amt>':''}
        <empe_eip_amt>${d.box18||'0.00'}</empe_eip_amt>
        ${d.box20?'<rpp_cntrb_amt>'+d.box20+'</rpp_cntrb_amt>':''}
        <itx_ddct_amt>${d.box22||'0.00'}</itx_ddct_amt>
        <ei_ins_erng_amt>${d.box24||'0.00'}</ei_ins_erng_amt>
        <cpp_qpp_pnsnbl_erng_amt>${d.box26||'0.00'}</cpp_qpp_pnsnbl_erng_amt>
        ${d.box44?'<unn_dues_amt>'+d.box44+'</unn_dues_amt>':''}
        ${d.box40?'<oth_tx_alw_amt>'+d.box40+'</oth_tx_alw_amt>':''}
      </T4_AMT>
    </T4Slip>
  </T4>
</Submission>`;

  const blob=new Blob([xml],{type:'application/xml'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`T4_${empName.replace(/\s+/g,'_')}_${year}_CRA.xml`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function _xmlEsc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}

function _printCRAT4(containerId,empName,year){
  const d=_readT4Form(containerId);
  if(!d)return;
  const lastName=empName.includes(' ')?empName.split(' ').slice(-1)[0]:empName;
  const firstName=empName.includes(' ')?empName.split(' ').slice(0,-1).join(' '):empName;
  const sin=d.eeSIN||'';
  const sinFmt=sin?sin.slice(0,3)+' '+sin.slice(3,6)+' '+sin.slice(6):'';
  const t=_calcT4(empName,year);
  const fmtAmt=v=>{if(!v||v==='0.00')return'';const n=parseFloat(v);return isNaN(n)?v:n.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});};
  const w=window.open('','_blank','width=900,height=1200');
  w.document.write('<!DOCTYPE html><html><head><title>T4 — '+empName+' — '+year+'</title>'+
'<style>'+
'*{margin:0;padding:0;box-sizing:border-box}'+
'body{font-family:Arial,Helvetica,sans-serif;background:#fff;color:#000;padding:12px}'+
'@page{size:letter;margin:10mm}'+
'@media print{body{padding:0}}'+
'.t4-slip{width:720px;margin:0 auto;border:1.5px solid #000;position:relative;font-size:10px}'+
'.t4-top{display:flex;border-bottom:1.5px solid #000}'+
'.t4-top-left{width:50%;border-right:1.5px solid #000;padding:6px 8px}'+
'.t4-top-right{width:50%;padding:6px 8px}'+
'.t4-title{font-size:22px;font-weight:700;letter-spacing:2px;margin-bottom:2px}'+
'.t4-subtitle{font-size:8px;color:#333;text-transform:uppercase;letter-spacing:.5px}'+
'.t4-year{font-size:32px;font-weight:700;text-align:right;margin-top:-20px}'+
'.lbl{font-size:7px;color:#444;text-transform:uppercase;letter-spacing:.3px;line-height:1.2}'+
'.val{font-size:11px;font-weight:600;min-height:14px;margin-top:1px}'+
'.val-amt{font-size:12px;font-weight:700;text-align:right;font-variant-numeric:tabular-nums}'+
'.bx{display:inline-block;font-size:7px;color:#666;border:1px solid #999;border-radius:2px;padding:0 3px;margin-right:3px;font-weight:700}'+
'.grid-cell{border:0.5px solid #000;padding:4px 6px;min-height:34px}'+
'.grid-cell-sm{min-height:28px}'+
'.er-section{border-bottom:1.5px solid #000}'+
'.ee-section{border-bottom:1.5px solid #000}'+
'.amt-grid{display:grid;grid-template-columns:repeat(3,1fr)}'+
'.amt-grid .grid-cell{display:flex;flex-direction:column;justify-content:space-between}'+
'.copy-label{text-align:center;font-size:8px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:1px;padding:3px;border-bottom:1px solid #000;background:#f5f5f5}'+
'.footer-note{font-size:7px;color:#888;text-align:center;padding:4px;border-top:1px solid #ccc}'+
'</style></head><body>'+
'<div class="t4-slip">'+
'<div class="copy-label">T4 — Employee Copy / Copie de l\'employé</div>'+
'<div class="t4-top">'+
'<div class="t4-top-left">'+
'<div class="t4-title">T4</div>'+
'<div class="t4-subtitle">Statement of Remuneration Paid</div>'+
'<div class="t4-subtitle" style="color:#666">État de la rémunération payée</div>'+
'</div>'+
'<div class="t4-top-right">'+
'<div class="t4-year">'+year+'</div>'+
'<div style="margin-top:4px"><div class="lbl">Tax Year / Année d\'imposition</div></div>'+
'</div></div>'+
'<div class="er-section">'+
'<div style="display:grid;grid-template-columns:240px 1fr">'+
'<div class="grid-cell"><div class="lbl"><span class="bx">54</span> Employer\'s account number / Numéro de compte de l\'employeur</div><div class="val">'+(d.erBN||'')+'</div></div>'+
'<div class="grid-cell"><div class="lbl">Employer\'s name — Nom de l\'employeur</div><div class="val">'+d.erName+'</div><div class="val" style="font-size:9px;font-weight:400;color:#444;margin-top:2px">'+(d.erAddr||'')+'</div></div>'+
'</div></div>'+
'<div class="ee-section">'+
'<div style="display:grid;grid-template-columns:160px 1fr 1fr 100px">'+
'<div class="grid-cell"><div class="lbl"><span class="bx">12</span> Social insurance number<br>Numéro d\'assurance sociale</div><div class="val" style="font-size:13px;letter-spacing:2px">'+sinFmt+'</div></div>'+
'<div class="grid-cell"><div class="lbl">Last name / Nom de famille</div><div class="val">'+lastName+'</div></div>'+
'<div class="grid-cell"><div class="lbl">First name / Prénom</div><div class="val">'+firstName+'</div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">10</span> Province</div><div class="val">'+d.eeProv+'</div></div>'+
'</div>'+
'<div style="display:grid;grid-template-columns:1fr">'+
'<div class="grid-cell grid-cell-sm"><div class="lbl">Employee\'s address / Adresse de l\'employé</div><div class="val" style="font-size:10px">'+(d.eeAddr||'')+'</div></div>'+
'</div></div>'+
'<div class="amt-grid">'+
'<div class="grid-cell"><div class="lbl"><span class="bx">14</span> Employment income<br>Revenus d\'emploi</div><div class="val-amt">'+fmtAmt(d.box14)+'</div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">16</span> Employee\'s CPP contributions<br>Cotisations de l\'employé au RPC</div><div class="val-amt">'+fmtAmt(d.box16)+'</div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">17</span> Employee\'s CPP2 contributions<br>Deuxièmes cotisations au RPC</div><div class="val-amt">'+fmtAmt(d.box17)+'</div></div>'+
'</div>'+
'<div class="amt-grid">'+
'<div class="grid-cell"><div class="lbl"><span class="bx">22</span> Income tax deducted<br>Impôt sur le revenu retenu</div><div class="val-amt">'+fmtAmt(d.box22)+'</div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">18</span> Employee\'s EI premiums<br>Cotisations de l\'employé à l\'AE</div><div class="val-amt">'+fmtAmt(d.box18)+'</div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">20</span> RPP contributions<br>Cotisations à un RPA</div><div class="val-amt">'+fmtAmt(d.box20)+'</div></div>'+
'</div>'+
'<div class="amt-grid">'+
'<div class="grid-cell"><div class="lbl"><span class="bx">24</span> EI insurable earnings<br>Gains assurables d\'AE</div><div class="val-amt">'+fmtAmt(d.box24)+'</div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">26</span> CPP/QPP pensionable earnings<br>Gains ouvrant droit à pension</div><div class="val-amt">'+fmtAmt(d.box26)+'</div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">44</span> Union dues<br>Cotisations syndicales</div><div class="val-amt">'+fmtAmt(d.box44)+'</div></div>'+
'</div>'+
'<div class="amt-grid">'+
'<div class="grid-cell"><div class="lbl"><span class="bx">40</span> Other taxable allowances and benefits<br>Autres allocations et avantages imposables</div><div class="val-amt">'+fmtAmt(d.box40)+'</div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">46</span> Charitable donations<br>Dons de bienfaisance</div><div class="val-amt"></div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">50</span> RPP or DPSP registration number<br>N° d\'agrément du RPA ou RPDB</div><div class="val-amt"></div></div>'+
'</div>'+
'<div class="amt-grid">'+
'<div class="grid-cell"><div class="lbl"><span class="bx">52</span> Pension adjustment<br>Facteur d\'équivalence</div><div class="val-amt"></div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">28</span> Exempt / Exemption — CPP/QPP</div><div class="val-amt"></div></div>'+
'<div class="grid-cell"><div class="lbl"><span class="bx">28</span> Exempt / Exemption — EI/AE</div><div class="val-amt"></div></div>'+
'</div>'+
'<div class="footer-note">This T4 was generated from payroll records in DroneHub Operations Hub. Verify all amounts before filing with the CRA.</div>'+
'</div>'+
(t?'<div style="margin:20px auto;max-width:720px;border:1px solid #ccc;border-radius:6px;padding:12px;font-size:10px;color:#555;page-break-before:avoid">'+
'<div style="font-weight:700;margin-bottom:6px;font-size:11px;color:#333">Employer Records (not part of T4)</div>'+
'<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 16px">'+
'<div>Employer CPP: <strong>$'+t.dhCpp.toFixed(2)+'</strong></div>'+
'<div>Employer EI: <strong>$'+t.dhEi.toFixed(2)+'</strong></div>'+
'<div>Total CRA Remittance: <strong>$'+t.totalRemit.toFixed(2)+'</strong></div>'+
'<div>Federal Tax: <strong>$'+t.fedTax.toFixed(2)+'</strong></div>'+
'<div>Provincial Tax: <strong>$'+t.provTax.toFixed(2)+'</strong></div>'+
'<div>Net Paid: <strong>$'+t.netPaid.toFixed(2)+'</strong></div>'+
'</div></div>':'')+
'</body></html>');
  w.document.close();
  w.print();
}

async function _downloadCRAT4PDF(containerId,empName,year){
  const d=_readT4Form(containerId);
  if(!d)return;
  if(!d.erBN){alert('Please enter your Business Number (BN).');return;}
  if(!d.eeSIN||d.eeSIN.length!==9){alert('Please enter a valid 9-digit SIN for the employee.');return;}
  const lastName=empName.includes(' ')?empName.split(' ').slice(-1)[0]:empName;
  const firstName=empName.includes(' ')?empName.split(' ').slice(0,-1).join(' '):empName;
  const sinFmt=d.eeSIN.slice(0,3)+' '+d.eeSIN.slice(3,6)+' '+d.eeSIN.slice(6);
  const btn=event.target;
  const origText=btn.textContent;
  btn.textContent='Generating...';
  btn.disabled=true;
  try{
    const encryptedSIN=await dhEncrypt(sinFmt);
    const sinToSend=(encryptedSIN&&encryptedSIN!==sinFmt)?encryptedSIN:sinFmt;
    const tok=_fbToken();
    const r=await fetch('/.netlify/functions/t4-fill',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({
        employerName:d.erName,
        employerBN:d.erBN.replace(/\s/g,''),
        year:year,
        sin:sinToSend,
        lastName:lastName,
        firstName:firstName,
        initial:'',
        employeeAddress:d.eeAddr||'',
        province:d.eeProv||'ON',
        box14:d.box14||'',
        box16:d.box16||'',
        box17:d.box17||'',
        box18:d.box18||'',
        box20:d.box20||'',
        box22:d.box22||'',
        box24:d.box24||'',
        box26:d.box26||'',
        box40:d.box40||'',
        box44:d.box44||''
      })
    });
    if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'Server error '+r.status);}
    const result=await r.json();
    const byteStr=atob(result.pdf);
    const bytes=new Uint8Array(byteStr.length);
    for(let i=0;i<byteStr.length;i++) bytes[i]=byteStr.charCodeAt(i);
    const blob=new Blob([bytes],{type:'application/pdf'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');
    a.href=url;
    a.download='T4_'+empName.replace(/\s+/g,'_')+'_'+year+'.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showDhToast('T4 Downloaded','CRA T4 PDF for '+empName+' ('+year+') has been saved.','📄','var(--green)',4000);
  }catch(e){
    console.error('[_downloadCRAT4PDF]',e);
    alert('Failed to generate CRA T4 PDF: '+e.message);
  }finally{
    btn.textContent=origText;
    btn.disabled=false;
  }
}

function setFinanceMarket(m){
  financeMarket=m;
  // Update tab button styles
  const caBtn=document.getElementById('fin-tab-canada');
  const usBtn=document.getElementById('fin-tab-usa');
  const badge=document.getElementById('fin-market-badge');
  if(caBtn){ caBtn.style.borderColor=m==='canada'?'var(--blue)':'var(--border)'; caBtn.style.background=m==='canada'?'rgba(91,141,239,.15)':'var(--navy-lift)'; caBtn.style.color=m==='canada'?'var(--blue-bright)':'var(--muted)'; }
  if(usBtn){ usBtn.style.borderColor=m==='usa'?'var(--blue)':'var(--border)'; usBtn.style.background=m==='usa'?'rgba(91,141,239,.15)':'var(--navy-lift)'; usBtn.style.color=m==='usa'?'var(--blue-bright)':'var(--muted)'; }
  if(badge) badge.textContent=m==='canada'?'Showing Canada (CAD)':'Showing United States (USD)';
  renderFinance();
}

const TWILIGHT_VIDEO=350,TWILIGHT_PHOTO=250,TWILIGHT_BOTH=540;
const FREE_RADIUS_KM=40;

// Contractor definitions — editable via Settings, persisted in localStorage
const CONTRACTOR_DEFAULTS={
  bailey:{name:'Bailey Roubos',addr:'177 Lakeshore Road W, Port Colborne, ON L3K 2S2',lat:42.8778,lng:-79.2598,email:'baileyroubos@gmail.com',phone:'',role:'Videographer / Photographer / Floor plan',rate:80,noDrive:true,notes:'Owner — no drive charge applied. US base: 5217 Old Spicewood Springs Rd, Austin TX 78731'},
  brad:{name:'Brad Loiselle',addr:'1 Armour Dr, Welland, ON',lat:42.9848,lng:-79.2482,email:'brad@dronehubmedia.com',phone:'',role:'Videographer / Photographer',rate:80,notes:''},
  akbar:{name:'Akbar Omar',addr:'9 Spall Ct, Toronto, ON',lat:43.7315,lng:-79.6254,email:'akbar@dronehubmedia.com',phone:'',role:'Videographer / Photographer',rate:80,notes:''},
  steve:{name:'Steve Calaguiro',addr:'5623 Woodland Blvd, Niagara Falls, ON',lat:43.0896,lng:-79.0849,email:'steve@dronehubmedia.com',phone:'',role:'Photographer / Floor plan',rate:40,notes:''},
  cam:{name:'Cam',addr:'',lat:0,lng:0,email:'',phone:'',role:'Videographer',rate:80,notes:''},
};
let CONTRACTORS=JSON.parse(localStorage.getItem('dronehub_contractors')||JSON.stringify(CONTRACTOR_DEFAULTS));
// Ensure any newly hardcoded defaults are always present (won't overwrite user edits)
// Also patch in critical flags like noDrive that may be missing from saved data
Object.keys(CONTRACTOR_DEFAULTS).forEach(k=>{
  if(!CONTRACTORS[k]){
    CONTRACTORS[k]=CONTRACTOR_DEFAULTS[k];
  } else {
    // Patch immutable flags from defaults without overwriting user-editable fields
    if(CONTRACTOR_DEFAULTS[k].noDrive) CONTRACTORS[k].noDrive=true;
  }
});
function saveContractors(){
  try{localStorage.setItem('dronehub_contractors',JSON.stringify(CONTRACTORS));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':contractors',{data:JSON.stringify(CONTRACTORS),updatedAt:Date.now()})
      .catch(e=>{
        console.error('[saveContractors] Firebase write failed:',e.message);
        showDhToast('Contractors not saved','Contractor records could not be saved to the cloud — changes may be lost if your browser cache is cleared.','⚠️','var(--orange)',7000);
      });
  }
}

// Property coords — set when address is looked up
let propLat=null, propLng=null, propAddrText='';

// Haversine straight-line km
function haversineKm(lat1,lng1,lat2,lng2){
  const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLng=(lng2-lng1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}

// Drive calc from contractor home → property
// Returns {km, excessKm, clientCharge, contractorCharge, isFree}
function contractorDrive(key){
  if(!key||!propLat) return{km:0,excessKm:0,clientCharge:0,contractorCharge:0,isFree:true};
  const c=CONTRACTORS[key];
  // noDrive flag — owner/operators who don't bill drive charges
  if(c.noDrive) return{km:0,excessKm:0,clientCharge:0,contractorCharge:0,isFree:true};
  const straight=haversineKm(c.lat,c.lng,propLat,propLng);
  const km=Math.round(straight*1.3);
  const excessKm=Math.max(0,km-FREE_RADIUS_KM);
  const isFree=excessKm===0;
  return{
    km, excessKm, isFree,
    clientCharge:   isFree?0:excessKm*2*DRIVE_RATE,
    contractorCharge:isFree?0:excessKm*2*SHOOTER_DRIVE_RATE,
  };
}

// Build contractor drive summary for the current selection
function buildDriveSummary(){
  const vidKey=document.getElementById('sel-videographer')?.value||'';
  const phoKey=document.getElementById('sel-photographer')?.value||'';
  const fpKey=document.getElementById('sel-floorplan')?.value||'';
  const sameShooter=vidKey&&phoKey&&vidKey===phoKey;
  const vidDrive=vidKey?contractorDrive(vidKey):{km:0,excessKm:0,clientCharge:0,contractorCharge:0,isFree:true};
  const phoDrive=(phoKey&&!sameShooter)?contractorDrive(phoKey):{km:0,excessKm:0,clientCharge:0,contractorCharge:0,isFree:true};
  const fpDrive=fpKey?contractorDrive(fpKey):{km:0,excessKm:0,clientCharge:0,contractorCharge:0,isFree:true};
  // US market jobs: drive is absorbed into package price — never billed to client
  const isUsMarket=(document.getElementById('job-market-input')?.value||'canada')!=='canada';
  const cc=isUsMarket?0:1; // client charge multiplier: 0 for US, 1 for Canada
  return{
    vidKey, phoKey, fpKey, sameShooter, isUsMarket,
    vidDrive, phoDrive, fpDrive,
    vidClientCharge:   svc.video?vidDrive.clientCharge*cc:0,
    phoClientCharge:   (svc.photo&&!sameShooter)?phoDrive.clientCharge*cc:0,
    fpClientCharge:    0,  // floor plan has no drive charge — contractor is already on site
    fpContractorCharge:0,  // floor plan drive not reimbursed separately
    // Exterior shoots use the same contractor as their respective type
    extVideoClientCharge: svc.extvideo&&vidKey?vidDrive.clientCharge*cc:0,
    extPhotoClientCharge: svc.extphoto&&phoKey?(sameShooter?0:phoDrive.clientCharge*cc):0,
    extVideoContractorCharge: svc.extvideo&&vidKey?vidDrive.contractorCharge:0,
    extPhotoContractorCharge: svc.extphoto&&phoKey&&!sameShooter?phoDrive.contractorCharge:0,
    // Random shoots also tied to their respective contractor
    randVideoClientCharge: svc.randomvideo&&vidKey?vidDrive.clientCharge*cc:0,
    randPhotoClientCharge: svc.randomphoto&&phoKey&&!sameShooter?phoDrive.clientCharge*cc:0,
    randVideoContractorCharge: svc.randomvideo&&vidKey?vidDrive.contractorCharge:0,
    randPhotoContractorCharge: svc.randomphoto&&phoKey&&!sameShooter?phoDrive.contractorCharge:0,
    vidContractorCharge:svc.video?vidDrive.contractorCharge:0,
    phoContractorCharge:(svc.photo&&!sameShooter)?phoDrive.contractorCharge:0,
    totalClientCharge: isUsMarket?0:(svc.video?vidDrive.clientCharge:0)+(svc.photo&&!sameShooter?phoDrive.clientCharge:0)+(svc.extvideo&&vidKey?vidDrive.clientCharge:0)+(svc.extphoto&&phoKey&&!sameShooter?phoDrive.clientCharge:0)+(svc.randomvideo&&vidKey?vidDrive.clientCharge:0)+(svc.randomphoto&&phoKey&&!sameShooter?phoDrive.clientCharge:0),
  };
}

function onContractorChange(){
  const vidKey=document.getElementById('sel-videographer').value;
  const phoKey=document.getElementById('sel-videographer')?.value||'';
  const fpKey=document.getElementById('sel-floorplan').value;
  const sameShooter=vidKey&&phoKey&&vidKey===phoKey;
  const vidDrive=vidKey?contractorDrive(vidKey):null;
  const phoDrive=phoKey?contractorDrive(phoKey):null;
  const fpDrive=fpKey?contractorDrive(fpKey):null;

  const vidHint=document.getElementById('vid-drive-hint');
  const phoHint=document.getElementById('photo-drive-hint');
  const fpHint=document.getElementById('fp-drive-hint');
  const note=document.getElementById('contractor-note');

  if(vidKey&&vidDrive){
    vidHint.textContent=propLat?(vidDrive.isFree?`${vidDrive.km} km — free zone`:`${vidDrive.km} km — +${fmt(vidDrive.clientCharge)} drive`):'look up address first';
    vidHint.style.color=vidDrive.isFree?'#085041':'#633806';
  } else { vidHint.textContent=''; }

  if(phoKey&&phoDrive){
    const label=sameShooter?'same as videographer':(propLat?(phoDrive.isFree?`${phoDrive.km} km — free zone`:`${phoDrive.km} km — +${fmt(phoDrive.clientCharge)} drive`):'look up address first');
    phoHint.textContent=label;
    phoHint.style.color=sameShooter?'#085041':(phoDrive.isFree?'#085041':'#633806');
  } else { phoHint.textContent=''; }

  if(fpKey&&fpDrive){
    fpHint.textContent=propLat?`${fpDrive.km} km — no drive charge (on site)`:'look up address first';
    fpHint.style.color='#085041';
  } else { fpHint.textContent=''; }

  note.textContent=sameShooter?'Same contractor — single drive charge.':vidKey&&phoKey?'Two contractors — separate drive charges.':'';
  note.style.color=sameShooter?'#085041':'#633806';

  if(propLat) refreshAddrPanel();
  calc();
}

function refreshAddrPanel(){
  const ds=buildDriveSummary();
  let breakdown='';
  const driveLabel=(d)=>ds.isUsMarket
    ?'<span style="color:#22D97A">included in package (US market)</span>'
    :(d.isFree?'<span style="color:#22D97A">free zone</span>':`<span style="color:#F5A623">${d.excessKm} km excess → +${fmt(d.clientCharge)}</span>`);
  if(ds.vidKey&&svc.video){
    const d=ds.vidDrive;
    breakdown+=`<div style="font-size:11px;color:#A8B4D0;padding:2px 0">${(CONTRACTORS[ds.vidKey]?.name||EDITOR_NAMES[ds.vidKey]||ds.vidKey||'Unknown')} (video): ${d.km} km from home → ${driveLabel(d)}</div>`;
  }
  if(ds.phoKey&&svc.photo&&!ds.sameShooter){
    const d=ds.phoDrive;
    breakdown+=`<div style="font-size:11px;color:#A8B4D0;padding:2px 0">${(CONTRACTORS[ds.phoKey]?.name||EDITOR_NAMES[ds.phoKey]||ds.phoKey||'Unknown')} (photo): ${d.km} km from home → ${driveLabel(d)}</div>`;
  }
  if(ds.sameShooter&&ds.vidKey&&svc.video&&svc.photo){
    const d=ds.vidDrive;
    breakdown+=`<div style="font-size:11px;color:#A8B4D0;padding:2px 0">${(CONTRACTORS[ds.vidKey]?.name||EDITOR_NAMES[ds.vidKey]||ds.vidKey||'Unknown')} (video + photo): ${d.km} km → ${driveLabel(d)}</div>`;
  }
  if(ds.fpKey&&svc.floorplan){
    const d=ds.fpDrive;
    breakdown+=`<div style="font-size:11px;color:#A8B4D0;padding:2px 0">${(CONTRACTORS[ds.fpKey]?.name||EDITOR_NAMES[ds.fpKey]||ds.fpKey||'Unknown')} (floor plan): ${d.km} km from home — <span style="color:#22D97A">no drive charge (on site)</span></div>`;
  }
  const bd=document.getElementById('contractorDriveBreakdown');
  if(bd) bd.innerHTML=breakdown;
  const dc=document.getElementById('qAddrDriveCharge');
  if(dc) dc.textContent=fmt(ds.totalClientCharge);
}



const svc={video:true,photo:false,tvideo:false,tphoto:false,reel:false,extphoto:false,extvideo:false,randomvideo:false,randomphoto:false,floorplan:false,rush:false,custom:false};
const qty={reel:1,randomvideo:1,randomphoto:1};
const asvc={video:true,photo:false,tvideo:false,tphoto:false,reel:false,extphoto:false,extvideo:false,randomvideo:false,randomphoto:false,floorplan:false};
const aqty={reel:1};


// ─── CONTRACTOR DROPDOWNS (dynamic) ─────────────────────────────────────────
function populateVideoEditorDropdown(){
  const edSel=document.getElementById('sel-video-editor');
  if(!edSel) return;
  const prev=edSel.value||editors.video||'dronehub';
  // Always lead with DroneHub, then all team editors
  edSel.innerHTML=
    `<option value="dronehub">DroneHub — assign later in tracker</option>`+
    buildEditorOptions(prev).replace(/<option value="">.*?<\/option>/,''); // strip blank unassigned
  // Restore previous selection
  if(prev&&edSel.querySelector(`option[value="${prev}"]`)) edSel.value=prev;
  else edSel.value='dronehub';
  editors.video=edSel.value;
}

function populateContractorDropdowns(){
  const vidSel=document.getElementById('sel-videographer');
  const phoSel=document.getElementById('sel-photographer');
  const fpSel=document.getElementById('sel-floorplan');
  if(!vidSel) return;
  const prevVid=vidSel.value, prevPho=phoSel.value, prevFp=fpSel.value;

  const allOpts='<option value="">— Select —</option>'+
    Object.entries(CONTRACTORS).map(([k,c])=>`<option value="${k}">${c.name}${c.role?' — '+c.role:''}</option>`).join('');

  vidSel.innerHTML=allOpts;
  phoSel.innerHTML=allOpts;
  fpSel.innerHTML='<option value="">— Select —</option>'+
    Object.entries(CONTRACTORS).map(([k,c])=>`<option value="${k}">${c.name}${c.role?' — '+c.role:''}</option>`).join('');

  if(prevVid&&vidSel.querySelector(`option[value="${prevVid}"]`)) vidSel.value=prevVid;
  if(prevPho&&phoSel.querySelector(`option[value="${prevPho}"]`)) phoSel.value=prevPho;
  if(prevFp&&fpSel.querySelector(`option[value="${prevFp}"]`)) fpSel.value=prevFp;
  populateVideoEditorDropdown();
  renderEditorSelectors();
}

// ─── ADD NEW CONTRACTOR ──────────────────────────────────────────────────────
function toggleNewContractorForm(){
  const form=document.getElementById('new-contractor-form');
  const btn=document.getElementById('btn-add-contractor');
  const open=form.style.display==='none';
  form.style.display=open?'block':'none';
  btn.textContent=open?'✕ Cancel':'+ Add new contractor';
  if(open) document.getElementById('nc-first').focus();
}

async function saveNewContractor(){
  const first=document.getElementById('nc-first').value.trim();
  const last=document.getElementById('nc-last').value.trim();
  const addr=document.getElementById('nc-addr').value.trim();
  const email=document.getElementById('nc-email').value.trim().toLowerCase();
  const err=document.getElementById('nc-error');
  if(!first||!last){err.textContent='First and last name are required.';return;}
  if(!addr){err.textContent='Home address is required for drive calculations.';return;}
  err.textContent='Looking up address…';

  let lat=0,lng=0;
  try{
    const geo=await geocodeAddress(addr);
    lat=geo.lat; lng=geo.lng;
  }catch(e){ console.warn('Geocode failed:',e); }

  err.textContent=lat?'':('Address not geocoded — drive calc unavailable. Fix in Settings.');

  const name=first+' '+last;
  const role=document.getElementById('nc-role').value;
  const rate=parseFloat(document.getElementById('nc-rate').value)||80;
  const phone=document.getElementById('nc-phone')?.value.trim()||'';

  // Use email as key if provided, otherwise generate one
  const key=email?'c_'+email.replace(/[^a-z0-9]/g,'_'):'c_'+Date.now();
  CONTRACTORS[key]={
    name, email, phone, addr, lat, lng, role, rate,
    notes:'',
  };
  saveContractors();
  populateContractorDropdowns();

  // ── LINK TO TEAM MEMBER ACCOUNT ──────────────────────────────────────────
  // Create/update admin team member record so they appear in Team tab
  if(email){
    const members=getAdminTeamMembers();
    const existing=members.findIndex(m=>m.email===email);
    const memberRole=role.toLowerCase().includes('editor')?'editor':'contractor';
    const memberRecord={
      id:existing>=0?members[existing].id:('tmadmin_'+Date.now()),
      name,email,phone,
      type:'contractor',
      role:memberRole,
      contractorKey:key, // link back to CONTRACTORS record
      orgId:ensureDefaultOrg().id,
      status:'active',
      addedAt:new Date().toISOString().slice(0,10),
    };
    if(existing>=0) members[existing]=memberRecord;
    else members.push(memberRecord);
    saveAdminTeamMembers(members);
    renderTeam();
  }

  ['nc-first','nc-last','nc-email','nc-phone','nc-addr'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  document.getElementById('nc-rate').value='80';
  document.getElementById('new-contractor-form').style.display='none';
  document.getElementById('btn-add-contractor').textContent='+ Add new contractor';
  if(!lat) return;
  err.textContent='✓ '+name+' added';

  const roleLower=role.toLowerCase();
  if(roleLower.includes('video')){const s=document.getElementById('sel-videographer');if(s&&s.querySelector(`option[value="${key}"]`))s.value=key;}
  else if(roleLower.includes('photo')){const s=document.getElementById('sel-photographer');if(s&&s.querySelector(`option[value="${key}"]`))s.value=key;}
  else if(roleLower.includes('floor')){const s=document.getElementById('sel-floorplan');if(s&&s.querySelector(`option[value="${key}"]`))s.value=key;}
  onContractorChange();
}

function deleteContractor(key){
  if(!confirm(`Remove ${CONTRACTORS[key]?.name||key} from the team?`)) return;
  delete CONTRACTORS[key];
  saveContractors();
  populateContractorDropdowns();
  renderContractorSettingsCards();
}

// ─── CONTRACTOR SETTINGS ─────────────────────────────────────────────────────
function renderContractorSettingsCards(){
  const container=document.getElementById('contractor-cards-settings');
  if(!container) return;
  const defaultKeys=['brad','akbar','steve'];
  container.innerHTML=Object.entries(CONTRACTORS).map(([key,c])=>`
    <div class="contractor-settings-card">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px">
        <div style="font-size:13px;font-weight:500;color:#C8D0E8">${c.name}</div>
        ${!defaultKeys.includes(key)?`<button onclick="deleteContractor('${key}')" style="border:none;background:none;color:#E85D3A;font-size:11px;cursor:pointer;padding:0">Remove</button>`:''}
      </div>
      <div class="row" style="margin-bottom:6px"><label style="min-width:110px;font-size:12px">Name</label><input type="text" id="cs-${key}-name" value="${c.name}" style="flex:1;padding:5px 8px;border:0.5px solid #ccc;border-radius:6px;font-size:12px;background:#242D42;color:#E8ECF8"></div>
      <div class="row" style="margin-bottom:6px"><label style="min-width:110px;font-size:12px">Company</label><input type="text" id="cs-${key}-company" value="${c.company||''}" placeholder="Business name (optional)" style="flex:1;padding:5px 8px;border:0.5px solid #ccc;border-radius:6px;font-size:12px;background:#242D42;color:#E8ECF8"></div>
      <div class="row" style="margin-bottom:6px"><label style="min-width:110px;font-size:12px">HST number</label><input type="text" id="cs-${key}-hst" value="${c.hst||''}" placeholder="123456789 RT0001" style="flex:1;padding:5px 8px;border:0.5px solid #ccc;border-radius:6px;font-size:12px;background:#242D42;color:#E8ECF8"></div>
      <div class="row" style="margin-bottom:6px"><label style="min-width:110px;font-size:12px">Email</label><input type="email" id="cs-${key}-email" value="${c.email||''}" placeholder="email@example.com" style="flex:1;padding:5px 8px;border:0.5px solid #ccc;border-radius:6px;font-size:12px;background:#242D42;color:#E8ECF8"></div>
      <div class="row" style="margin-bottom:6px"><label style="min-width:110px;font-size:12px">Phone</label><input type="tel" id="cs-${key}-phone" value="${c.phone||''}" placeholder="905-555-0100" style="flex:1;padding:5px 8px;border:0.5px solid #ccc;border-radius:6px;font-size:12px;background:#242D42;color:#E8ECF8"></div>
      <div class="row" style="margin-bottom:6px"><label style="min-width:110px;font-size:12px">Home address</label><input type="text" id="cs-${key}-addr" value="${c.addr||''}" style="flex:1;padding:5px 8px;border:0.5px solid #ccc;border-radius:6px;font-size:12px;background:#242D42;color:#E8ECF8"></div>
      <div class="row" style="margin-bottom:6px"><label style="min-width:110px;font-size:12px">Role</label><input type="text" id="cs-${key}-role" value="${c.role||''}" placeholder="Videographer / Photographer" style="flex:1;padding:5px 8px;border:0.5px solid #ccc;border-radius:6px;font-size:12px;background:#242D42;color:#E8ECF8"></div>
      <div class="row" style="margin-bottom:0"><label style="min-width:110px;font-size:12px">Rate ($/hr)</label><input type="number" id="cs-${key}-rate" value="${c.rate||80}" min="0" step="1" style="width:80px;padding:5px 8px;border:0.5px solid #ccc;border-radius:6px;font-size:12px;background:#242D42;color:#E8ECF8"></div>
    </div>`).join('');
}

function saveContractorSettings(){
  Object.keys(CONTRACTORS).forEach(key=>{
    const get=field=>{const el=document.getElementById('cs-'+key+'-'+field);return el?el.value.trim():'';}; 
    CONTRACTORS[key]={
      ...CONTRACTORS[key],
      name:get('name')||CONTRACTORS[key]?.name||key,
      company:get('company'),
      hst:get('hst'),
      email:get('email'),
      phone:get('phone'),
      addr:get('addr')||CONTRACTORS[key].addr,
      role:get('role'),
      rate:parseFloat(document.getElementById('cs-'+key+'-rate')?.value)||80,
    };
  });
  saveContractors();
  const msg=document.getElementById('contractor-saved-msg');
  msg.textContent='Saved!';
  setTimeout(()=>msg.textContent='',2500);
  populateContractorDropdowns();
}

// ─── CONTRACTOR DETAIL MODAL ─────────────────────────────────────────────────
function showContractorDetail(key){
  const c=CONTRACTORS[key];
  if(!c) return;
  const cJobs=savedJobs.filter(j=>{
    const ds=buildDriveSummary();
    return j.payouts&&Object.values(j.payouts).some(p=>p.name===c.name);
  });
  const modal=document.createElement('div');
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:3000;display:flex;align-items:center;justify-content:center';
  modal.onclick=e=>{ if(e.target===modal) document.body.removeChild(modal); };
  modal.innerHTML='<div style="background:#1C2333;border-radius:12px;padding:24px;max-width:480px;width:90%;max-height:80vh;overflow-y:auto;border:1px solid var(--border-bright)">'+
    '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px">'+
    '<div style="font-size:18px;font-weight:600;color:var(--white)">'+c.name+'</div>'+
    '<button onclick="this.parentElement.parentElement.parentElement.remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:18px">✕</button>'+
    '</div>'+
    '<div style="font-size:12px;color:var(--muted);line-height:2">'+
    (c.role?'<div><strong style="color:var(--offwhite)">Role:</strong> '+c.role+'</div>':'')+
    (c.email?'<div><strong style="color:var(--offwhite)">Email:</strong> <a href="mailto:'+c.email+'" style="color:var(--green)">'+c.email+'</a></div>':'')+
    (c.phone?'<div><strong style="color:var(--offwhite)">Phone:</strong> <a href="tel:'+c.phone+'" style="color:var(--green)">'+c.phone+'</a></div>':'')+
    (c.addr?'<div><strong style="color:var(--offwhite)">Address:</strong> '+c.addr+'</div>':'')+
    (c.rate?'<div><strong style="color:var(--offwhite)">Rate:</strong> $'+c.rate+'/hr</div>':'')+
    (c.notes?'<div><strong style="color:var(--offwhite)">Notes:</strong> '+c.notes+'</div>':'')+
    '</div>'+
    (cJobs.length?'<div style="margin-top:16px;font-size:12px;font-weight:600;color:var(--offwhite)">Recent jobs ('+cJobs.length+')</div>'+
    cJobs.slice(0,5).map(j=>'<div style="padding:5px 0;border-bottom:1px solid var(--border);font-size:11px;color:var(--muted)">'+j.date+' — '+j.name+'</div>').join(''):'')+'</div>';
  document.body.appendChild(modal);
}


let bizSettings=JSON.parse(localStorage.getItem('dronehub_settings')||'{}');
let bizSettingsUs=JSON.parse(localStorage.getItem('dronehub_settings_us')||'{}');

// Returns the right entity profile based on currency
function bizForCurrency(currency){
  return (currency||'cad').toLowerCase()==='usd' ? {...bizSettings,...bizSettingsUs,_isUs:true} : {...bizSettings,_isUs:false};
}

function saveSettings(){
  bizSettings={
    name:document.getElementById('biz-name').value.trim(),
    addr1:document.getElementById('biz-addr1').value.trim(),
    addr2:document.getElementById('biz-addr2').value.trim(),
    phone:document.getElementById('biz-phone').value.trim(),
    email:document.getElementById('biz-email').value.trim(),
    website:document.getElementById('biz-website').value.trim(),
    hst:document.getElementById('biz-hst').value.trim(),
    stripeUrl:document.getElementById('biz-stripe-url').value.trim(),
    terms:document.getElementById('biz-terms').value.trim(),
    notes:document.getElementById('biz-notes').value.trim(),
  };
  try{localStorage.setItem('dronehub_settings',JSON.stringify(bizSettings));}catch(e){}
  const _settingsMsg=document.getElementById('settings-saved-msg');
  if(_settingsMsg) _settingsMsg.textContent='Saving…';
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':settings',{data:JSON.stringify(bizSettings),updatedAt:Date.now()})
      .then(()=>{ if(_settingsMsg){_settingsMsg.textContent='✓ Saved';setTimeout(()=>_settingsMsg.textContent='',2500);} })
      .catch(e=>{
        console.error('[saveSettings] Firebase write failed:',e.message);
        if(_settingsMsg){_settingsMsg.style.color='var(--red)';_settingsMsg.textContent='⚠ Cloud save failed — saved locally only';setTimeout(()=>{_settingsMsg.textContent='';_settingsMsg.style.color='';},5000);}
      });
  } else {
    if(_settingsMsg){_settingsMsg.textContent='Saved locally';setTimeout(()=>_settingsMsg.textContent='',2500);}
  }
}

function saveUsSettings(){
  const g=id=>(document.getElementById(id)?.value||'').trim();
  bizSettingsUs={
    name:g('biz-us-name'),
    addr1:g('biz-us-addr1'),
    addr2:g('biz-us-addr2'),
    phone:g('biz-us-phone'),
    email:g('biz-us-email'),
    website:g('biz-us-website'),
    ein:g('biz-us-ein'),
    stripeUrlUs:g('biz-stripe-url-us'),
    terms:g('biz-us-terms'),
    notes:g('biz-us-notes'),
  };
  try{localStorage.setItem('dronehub_settings_us',JSON.stringify(bizSettingsUs));}catch(e){}
  const _usMsg=document.getElementById('settings-us-saved-msg');
  if(_usMsg) _usMsg.textContent='Saving…';
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':settings_us',{data:JSON.stringify(bizSettingsUs),updatedAt:Date.now()})
      .then(()=>{ if(_usMsg){_usMsg.textContent='✓ Saved';setTimeout(()=>_usMsg.textContent='',2500);} })
      .catch(e=>{
        console.error('[saveUsSettings] Firebase write failed:',e.message);
        if(_usMsg){_usMsg.style.color='var(--red)';_usMsg.textContent='⚠ Cloud save failed — saved locally only';setTimeout(()=>{_usMsg.textContent='';_usMsg.style.color='';},5000);}
      });
  } else {
    if(_usMsg){_usMsg.textContent='Saved locally';setTimeout(()=>_usMsg.textContent='',2500);}
  }
}

async function changePassword(){
  const current=document.getElementById('change-pass-current')?.value||'';
  const newPass=document.getElementById('change-pass-new')?.value||'';
  const confirm=document.getElementById('change-pass-confirm')?.value||'';
  const msgEl=document.getElementById('change-pass-msg');

  const show=(text,ok)=>{
    if(!msgEl) return;
    msgEl.textContent=text;
    msgEl.style.display='block';
    msgEl.style.background=ok?'rgba(34,217,122,.1)':'rgba(240,82,82,.1)';
    msgEl.style.color=ok?'var(--green)':'var(--red)';
    msgEl.style.border=ok?'1px solid rgba(34,217,122,.2)':'1px solid rgba(240,82,82,.2)';
  };

  if(!current||!newPass||!confirm){show('Please fill in all fields.',false);return;}
  if(newPass!==confirm){show('New passwords do not match.',false);return;}
  if(newPass.length<6){show('New password must be at least 6 characters.',false);return;}

  const session=gateGetSession();
  if(!session){show('Not logged in.',false);return;}

  const users=gateGetUsers();
  const user=users.find(u=>u.email.toLowerCase()===session.email.toLowerCase());
  if(!user){show('Account not found.',false);return;}

  // Allow change if: correct current password OR no password set yet
  if(user.passHash&&!(await verifyPass(session.email,current,user.passHash))){
    show('Current password is incorrect.',false);
    return;
  }

  user.passHash=await hashPass(session.email,newPass);
  gateSaveUsers(users);
  show('✓ Password updated successfully!',true);

  // Clear fields
  document.getElementById('change-pass-current').value='';
  document.getElementById('change-pass-new').value='';
  document.getElementById('change-pass-confirm').value='';
}

function loadSettings(){
  // Suggestion box moved to floating FAB button — hide the Settings card entirely
  const suggBox=document.getElementById('settings-suggestion-box');
  if(suggBox) suggBox.style.display='none';
  const map={name:'biz-name',addr1:'biz-addr1',addr2:'biz-addr2',phone:'biz-phone',
    email:'biz-email',website:'biz-website',hst:'biz-hst',stripeUrl:'biz-stripe-url',
    terms:'biz-terms',notes:'biz-notes'};
  Object.entries(map).forEach(([k,id])=>{
    const el=document.getElementById(id);
    if(el&&bizSettings[k]) el.value=bizSettings[k];
  });
  // US entity fields
  const usMap={name:'biz-us-name',addr1:'biz-us-addr1',addr2:'biz-us-addr2',phone:'biz-us-phone',
    email:'biz-us-email',website:'biz-us-website',ein:'biz-us-ein',stripeUrlUs:'biz-stripe-url-us',
    terms:'biz-us-terms',notes:'biz-us-notes'};
  Object.entries(usMap).forEach(([k,id])=>{
    const el=document.getElementById(id);
    if(el&&bizSettingsUs[k]) el.value=bizSettingsUs[k];
  });
}

// ─── INVOICE ─────────────────────────────────────────────────────────────────
let invoiceNumberBase=parseInt(localStorage.getItem('dronehub_inv_num')||'999');
let currentInvoiceData=null; // stores data for send button

function fmtN(n){return '$'+n.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});}

// Guard: track the last invoice number that was sent and when, to prevent duplicate sends
let _lastInvoiceSentKey = '';
let _lastInvoiceSentAt  = 0;

async function sendInvoiceEmail(){
  if(!currentInvoiceData){alert('No invoice loaded.');return;}
  const{clientEmail,clientName,invNum,grandTotal,jobName,jobDate,bname}=currentInvoiceData;

  // Duplicate-send guard: block if the same invoice was already sent within the last 60 seconds
  const sendKey = (currentInvoiceData.jobId||'')+'|'+(invNum||'');
  const now = Date.now();
  if(sendKey && sendKey===_lastInvoiceSentKey && (now-_lastInvoiceSentAt)<60000){
    alert('This invoice was already sent recently. Please wait at least 60 seconds before sending again.');
    return;
  }
  const displayTotal=fmtN(grandTotal);
  const btn=document.getElementById('send-invoice-btn');
  const statusEl=document.getElementById('invoice-send-status');

  if(!clientEmail){
    if(statusEl){
      statusEl.textContent='⚠ No email on file for this client — add their email in the Clients tab first.';
      statusEl.style.background='rgba(245,166,35,.1)';
      statusEl.style.color='var(--amber)';
      statusEl.style.borderBottomColor='rgba(245,166,35,.2)';
      statusEl.style.display='block';
    } else {
      alert('No email on file for this client — add their email in the Clients tab first.');
    }
    return;
  }

  if(btn){btn.textContent='Creating payment link…';btn.disabled=true;}
  if(statusEl) statusEl.style.display='none';

  // Step 1 — Create Stripe checkout session to get unique payment URL
  let paymentLink='';
  try{
    const res=await fetch('/.netlify/functions/create-checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        amount:grandTotal,
        currency:currentInvoiceData?.currency||'cad',
        jobName:jobName,
        invoiceNumber:invNum,
        jobId:currentInvoiceData?.jobId||'',
        clientEmail:clientEmail
      })
    });
    const data=await res.json();
    if(data.url) paymentLink=data.url;
    else throw new Error(data.error||'No URL returned');
  }catch(e){
    console.error('Stripe checkout error:',e);
    paymentLink='https://sparkly-halva-0d1aa9.netlify.app';
  }

  // Step 2 — Send email with the unique Stripe checkout URL
  if(btn) btn.textContent='Sending email…';

  if(typeof emailjs==='undefined'){
    alert('EmailJS not loaded — please refresh and try again.');
    if(btn){btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Send to client';btn.disabled=false;}
    return;
  }

  emailjs.send('service_f0gwd3p','template_74pphga',{
    to_email:clientEmail,
    to_name:clientName||clientEmail,
    company_name:bname,
    invoice_number:invNum,
    invoice_total:displayTotal,
    job_name:jobName,
    job_date:jobDate,
    payment_link:paymentLink,
  },'Ch7hmj99uF1tLKhMj').then(()=>{
    // Stamp the guard so rapid re-clicks can't send again for 60 s
    _lastInvoiceSentKey = sendKey;
    _lastInvoiceSentAt  = Date.now();
    // Keep button permanently disabled after a successful send — prevents re-clicking
    if(btn){
      btn.textContent='✓ Sent';
      btn.disabled=true;
      btn.style.background='rgba(34,217,122,.08)';
      btn.style.borderColor='rgba(34,217,122,.3)';
      btn.style.color='#22D97A';
      btn.style.cursor='not-allowed';
      btn.title='Invoice already sent — close and re-open to send again';
    }
    if(statusEl){
      statusEl.textContent='✓ Invoice emailed to '+clientEmail+' — close this window if you are done';
      statusEl.style.background='rgba(34,217,122,.1)';
      statusEl.style.color='#22D97A';
      statusEl.style.borderBottomColor='rgba(34,217,122,.2)';
      statusEl.style.display='block';
    }
  }).catch(err=>{
    const msg=err?.text||err?.message||JSON.stringify(err)||'error';
    console.error('EmailJS error:',msg);
    if(btn){btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg> Send to client';btn.disabled=false;}
    if(statusEl){
      statusEl.textContent='Failed to send email: '+msg;
      statusEl.style.background='rgba(240,82,82,.1)';
      statusEl.style.color='var(--red)';
      statusEl.style.borderBottomColor='rgba(240,82,82,.2)';
      statusEl.style.display='block';
    }
  });
}


function nextInvoiceNum(){
  invoiceNumberBase++;
  try{localStorage.setItem('dronehub_inv_num',String(invoiceNumberBase));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':inv_num',{data:String(invoiceNumberBase),updatedAt:Date.now()})
      .catch(e=>console.error('[nextInvoiceNum] Firebase write failed:',e.message));
  }
  return 'INV-'+String(invoiceNumberBase).padStart(5,'0');
}

function openInvoice(jobId){
  const job=savedJobs.find(j=>String(j.id)===String(jobId));
  if(!job){alert('Job not found.');return;}
  const client=job.clientId?clients.find(c=>c.id===job.clientId):null;
  const biz=bizForCurrency(job.currency);
  const invNum=nextInvoiceNum();
  // Stamp invoice date on job if first time
  if(!job.invoicedAt){
    job.invoicedAt=new Date().toISOString().slice(0,10);
    saveJobsToStorage();
  }
  const issueDate=new Date().toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});
  const svcs=job.services||{};
  const hrs=job.hours||{};
  const sqft=job.sqft||0;
  const driveCost=job.driveCost||0;
  const lines=[];

  // ── US MARKET JOBS — build lines from usData, not services ───────────────
  const _isUsInvBuild=(job.currency||'cad').toLowerCase()==='usd';
  if(_isUsInvBuild){
    const ud=job.usData||{};
    const p=US_MARKET_PRICING[ud.market]||US_MARKET_PRICING['other_us'];
    const pkgLabels={listing:'Real Estate Listing Package',social:'Social Media Package',agent:'Agent Promo Package',day:'Day Rate Package',exterior:'Exterior Only Package'};
    const tierLabels={under4k:'Under 4,000 sqft',over4k:'4,000–8,000 sqft',over8k:'Over 8,000 sqft'};
    const socialLabels={r1:'1 Reel',r2:'2 Reels',r3:'3 Reels',r5:'5 Reels',fullDay:'Full Day Social'};
    if(ud.pkgType==='listing'&&ud.listingTier){
      const basePrice=p.listing[ud.listingTier]||job.grand;
      lines.push({desc:`Real Estate Listing Package — ${tierLabels[ud.listingTier]||ud.listingTier} (includes 1 social reel)`,qty:1,unit:basePrice,total:basePrice});
      {const _xr=Math.max(0,(ud.listingReelCount||1)-1);
      if(_xr>0){const rr=p.reelAddon||400;lines.push({desc:'Add-on: Additional Social Reels',qty:_xr,unit:rr,total:_xr*rr});}}
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
      // Fallback: use grand as a single line item
      if(job.grand>0) lines.push({desc:pkgLabels[ud.pkgType]||'Media Package',qty:1,unit:job.grand,total:job.grand});
    }
  } else {
  // ── CANADA JOBS — existing line-item builder ──────────────────────────────

  // Drive cost is baked silently into video/photo — never shown as a separate line
  let vidDriveBaked=0, phoDriveBaked=0;
  if(driveCost>0){
    const hasVid=svcs.video||svcs.randomvideo, hasPho=svcs.photo||svcs.randomphoto;
    if(hasVid&&hasPho){ vidDriveBaked=driveCost*0.6; phoDriveBaked=driveCost*0.4; }
    else if(hasVid){ vidDriveBaked=driveCost; }
    else if(hasPho){ phoDriveBaked=driveCost; }
  }

  // Core video + photo (with drive baked in)
  if(svcs.video&&svcs.photo){
    const vb=baseVideoRate(sqft);
    const vt=Math.ceil(vb/(1-MARGIN))+Math.ceil(vidDriveBaked);
    const pb=photoBase(sqft,true); // already client price
    const pt=pb+Math.ceil(phoDriveBaked);
    lines.push({desc:'Video production',qty:1,unit:vt,total:vt});
    lines.push({desc:'Photography',qty:1,unit:pt,total:pt});
  } else {
    if(svcs.video){
      const vb=baseVideoRate(sqft);
      const vt=Math.ceil(vb/(1-MARGIN))+Math.ceil(vidDriveBaked);
      lines.push({desc:'Video production',qty:1,unit:vt,total:vt});
    }
    if(svcs.photo){
      const pb=photoBase(sqft,false); // already client price
      const pt=pb+Math.ceil(phoDriveBaked);
      lines.push({desc:'Photography',qty:1,unit:pt,total:pt});
    }
  }

  // Twilight add-ons
  if(svcs.tvideo&&svcs.tphoto) lines.push({desc:'Twilight session — video & photography',qty:1,unit:TWILIGHT_BOTH,total:TWILIGHT_BOTH});
  else if(svcs.tvideo) lines.push({desc:'Twilight video session',qty:1,unit:TWILIGHT_VIDEO,total:TWILIGHT_VIDEO});
  else if(svcs.tphoto) lines.push({desc:'Twilight photography session',qty:1,unit:TWILIGHT_PHOTO,total:TWILIGHT_PHOTO});

  // Add-ons
  if(svcs.reel){const q=hrs.reel||1;lines.push({desc:'Social media reels',qty:q,unit:150,total:150*q});}
  if(svcs.extvideo) lines.push({desc:'Exterior video shoot',qty:1,unit:150,total:150});
  if(svcs.extphoto) lines.push({desc:'Exterior photo shoot',qty:1,unit:150,total:150});
  if(svcs.floorplan) lines.push({desc:'Floor plan',qty:1,unit:150,total:150});

  // Miscellaneous hourly (drive baked in)
  if(svcs.randomvideo){const h=hrs.randomvideo||1;const u=RANDOM_VIDEO_RATE_CLIENT+(Math.ceil(vidDriveBaked)/h);lines.push({desc:'Video production (hourly)',qty:h,unit:Math.ceil(u),total:Math.ceil(u)*h});}
  if(svcs.randomphoto){const h=hrs.randomphoto||1;const u=RANDOM_PHOTO_RATE_CLIENT+(Math.ceil(phoDriveBaked)/h);lines.push({desc:'Photography (hourly)',qty:h,unit:Math.ceil(u),total:Math.ceil(u)*h});}
  if(svcs.rush) lines.push({desc:'Rush order',qty:1,unit:RUSH_FEE,total:RUSH_FEE});
  if(svcs.custom){
    const cdesc=job.customDesc||'Custom service';
    const cprice=job.customPrice||0;
    if(cprice>0) lines.push({desc:cdesc,qty:1,unit:cprice,total:cprice});
  }
  // Extra admin services — stored on job
  (job.extraServices||[]).forEach(xs=>{
    if(xs.clientPrice>0) lines.push({desc:xs.name,qty:1,unit:xs.clientPrice,total:xs.clientPrice});
  });
  } // end Canada jobs

  const subtotal=lines.reduce((s,l)=>s+l.total,0);
  const jobCurrency=(job.currency||'cad').toUpperCase();
  const isUsdInvoice=jobCurrency==='USD';
  const hst=isUsdInvoice?0:parseFloat((subtotal*0.13).toFixed(2));
  const grandTotal=subtotal+hst;
  const fmtN=n=>jobCurrency+' $'+n.toLocaleString('en-CA',{minimumFractionDigits:2,maximumFractionDigits:2});

  // ── INTEREST SCHEDULE ───────────────────────────────────────────────────────
  // Due date = issue date + 30 days
  const dueDate=new Date();
  dueDate.setDate(dueDate.getDate()+30);
  const dueDateStr=dueDate.toLocaleDateString('en-CA',{year:'numeric',month:'long',day:'numeric'});

  // Calculate what client will owe at key overdue milestones
  // 2% per month compounding after day 30
  // Additional 20% penalty every 6 months past due
  const calcOwed=(monthsLate)=>{
    if(monthsLate<=0) return grandTotal;
    // Compound monthly at 2%
    let amt=grandTotal*Math.pow(1.02,monthsLate);
    // +20% penalty for each completed 6-month block
    const penaltyBlocks=Math.floor(monthsLate/6);
    if(penaltyBlocks>0) amt*=Math.pow(1.20,penaltyBlocks);
    return amt;
  };

  const owed1m=calcOwed(1);
  const owed3m=calcOwed(3);
  const owed6m=calcOwed(6);
  const owed12m=calcOwed(12);

  const interestTable=`
    <div style="margin-top:16px;padding:14px 16px;background:#1a1f2e;border-radius:8px;border:1px solid #2a3a5a">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#F5A623;margin-bottom:10px">⚠ Late Payment Interest Schedule</div>
      <div style="font-size:11px;color:#A8B4D0;line-height:1.6;margin-bottom:10px">
        Payment is due within <strong style="color:#E8ECF8">30 days</strong> of invoice date (<strong style="color:#E8ECF8">${dueDateStr}</strong>).
        Overdue balances are subject to <strong style="color:#F5A623">2% monthly compounding interest</strong> plus a
        <strong style="color:#F5A623">20% penalty</strong> for every 6 months unpaid.
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead>
          <tr style="border-bottom:1px solid #2a3a5a">
            <th style="text-align:left;color:#7A8AAA;padding:4px 0;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.06em">Days overdue</th>
            <th style="text-align:right;color:#7A8AAA;padding:4px 0;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.06em">Amount owing</th>
            <th style="text-align:right;color:#7A8AAA;padding:4px 0;font-weight:600;text-transform:uppercase;font-size:10px;letter-spacing:.06em">Added charges</th>
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom:1px solid #1e2840">
            <td style="padding:5px 0;color:#E8ECF8">Due today (within 30 days)</td>
            <td style="padding:5px 0;text-align:right;color:#22D97A;font-weight:700">${fmtN(grandTotal)}</td>
            <td style="padding:5px 0;text-align:right;color:#7A8AAA">—</td>
          </tr>
          <tr style="border-bottom:1px solid #1e2840">
            <td style="padding:5px 0;color:#E8ECF8">30 days overdue (1 month)</td>
            <td style="padding:5px 0;text-align:right;color:#F5A623;font-weight:700">${fmtN(owed1m)}</td>
            <td style="padding:5px 0;text-align:right;color:#F5A623">+${fmtN(owed1m-grandTotal)}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e2840">
            <td style="padding:5px 0;color:#E8ECF8">90 days overdue (3 months)</td>
            <td style="padding:5px 0;text-align:right;color:#F5A623;font-weight:700">${fmtN(owed3m)}</td>
            <td style="padding:5px 0;text-align:right;color:#F5A623">+${fmtN(owed3m-grandTotal)}</td>
          </tr>
          <tr style="border-bottom:1px solid #1e2840">
            <td style="padding:5px 0;color:#E8ECF8">6 months overdue <span style="color:#F05252;font-size:10px">(+20% penalty)</span></td>
            <td style="padding:5px 0;text-align:right;color:#F05252;font-weight:700">${fmtN(owed6m)}</td>
            <td style="padding:5px 0;text-align:right;color:#F05252">+${fmtN(owed6m-grandTotal)}</td>
          </tr>
          <tr>
            <td style="padding:5px 0;color:#E8ECF8">12 months overdue <span style="color:#F05252;font-size:10px">(+20% at 6m)</span></td>
            <td style="padding:5px 0;text-align:right;color:#F05252;font-weight:700">${fmtN(owed12m)}</td>
            <td style="padding:5px 0;text-align:right;color:#F05252">+${fmtN(owed12m-grandTotal)}</td>
          </tr>
        </tbody>
      </table>
      <div style="font-size:10px;color:#7A8AAA;margin-top:8px;line-height:1.5">
        Interest compounds monthly at 2% per month. An additional 20% surcharge is applied at the 6-month mark and every subsequent 6-month interval. DroneHub Media reserves the right to pursue collection of overdue accounts.
      </div>
    </div>`;

  const lineRows=lines.map(l=>`<tr>
    <td style="padding:9px 0;border-bottom:0.5px solid #f0ede6;font-size:13px">${l.desc}</td>
    <td style="padding:9px 0;border-bottom:0.5px solid #f0ede6;font-size:13px;text-align:center;color:#A8B4D0">${l.qty}</td>
    <td style="padding:9px 0;border-bottom:0.5px solid #f0ede6;font-size:13px;text-align:right;color:#A8B4D0">${fmtN(l.unit)}</td>
    <td style="padding:9px 0;border-bottom:0.5px solid #f0ede6;font-size:13px;text-align:right;font-weight:500">${fmtN(l.total)}</td>
  </tr>`).join('');

  const isUsdJob=(job.currency||'cad').toLowerCase()==='usd';
  const stripeUrl=isUsdJob?(biz.stripeUrlUs||biz.stripeUrl||''):(biz.stripeUrl||'');
  const stripeBtn=`<div style="margin-top:20px;padding:20px;background:rgba(99,91,255,.08);border:1px solid rgba(99,91,255,.3);border-radius:10px;text-align:center">
      <div style="font-size:13px;color:#A8B4D0;margin-bottom:6px">Pay securely online via Stripe</div>
      <div style="font-size:28px;font-weight:900;color:#fff;margin-bottom:14px">${fmtN(grandTotal)}</div>
      <button onclick="openStripeCheckout(${grandTotal},'${invNum}','${client?.email||''}','${job.currency||getClientCurrency(client)||'cad'}',${job.id})" style="display:inline-block;padding:13px 36px;background:linear-gradient(135deg,#635BFF,#4B44D8);color:#fff;border-radius:8px;font-size:15px;font-weight:700;border:none;cursor:pointer;letter-spacing:.01em">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pay now
      </button>
      <div style="font-size:11px;color:#7A8AAA;margin-top:10px">Powered by Stripe · Secure checkout</div>
    </div>`;

  // Resolve currency: job setting → client country/currency → default cad
  const resolvedCurrency=job.currency||getClientCurrency(client)||'cad';
  // Store for Send Invoice button
  currentInvoiceData={clientEmail:client?.email||'',clientName:client?.name||'',invNum,grandTotal,jobName:job.name,jobDate:job.date,stripeUrl,bname:biz.name||'DroneHub Media',currency:resolvedCurrency,jobId:job.id};
  const sendStatus=document.getElementById('invoice-send-status');
  if(sendStatus) sendStatus.style.display='none';

  document.getElementById('invoice-body').innerHTML=`
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px;padding-bottom:24px;border-bottom:2px solid #1a1a1a">
      <div>
        <div style="font-size:22px;font-weight:700;margin-bottom:6px">${biz.name||'DroneHub Media Company'}</div>
        ${[biz.addr1,biz.addr2,biz.phone,biz.email,biz.website].filter(Boolean).map(v=>`<div style="font-size:12px;color:#A8B4D0;line-height:1.7">${v}</div>`).join('')}
        ${biz._isUs?(biz.ein?`<div style="font-size:11px;color:#7A8AAA;margin-top:4px">EIN: ${biz.ein}</div>`:''):(biz.hst?`<div style="font-size:11px;color:#7A8AAA;margin-top:4px">HST # ${biz.hst}</div>`:'')}
      </div>
      <div style="text-align:right">
        <div style="font-size:32px;font-weight:200;color:#1D9E75;letter-spacing:.03em">INVOICE</div>
        <div style="font-size:13px;color:#C8D0E8;margin-top:2px;font-weight:500">${invNum}</div>
        <div style="font-size:12px;color:#A8B4D0;margin-top:2px">Issued ${issueDate}</div>
        <div style="font-size:12px;color:#F5A623;margin-top:2px;font-weight:600">Due ${dueDateStr}</div>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:32px;padding:16px;background:#1C2333;border-radius:8px">
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7A8AAA;margin-bottom:6px">Bill to</div>
        ${client?`<div style="font-size:14px;font-weight:500">${client.name}</div>
          ${client.company?`<div style="font-size:12px;color:#A8B4D0">${client.company}</div>`:''}
          ${client.email?`<div style="font-size:12px;color:#A8B4D0">${client.email}</div>`:''}
          ${client.phone?`<div style="font-size:12px;color:#A8B4D0">${client.phone}</div>`:''}
        `:'<div style="font-size:13px;color:#7A8AAA">No client assigned</div>'}
      </div>
      <div>
        <div style="font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#7A8AAA;margin-bottom:6px">Property</div>
        <div style="font-size:13px;font-weight:500">${job.name}</div>
        <div style="font-size:12px;color:#A8B4D0">${job.address}</div>
        <div style="font-size:12px;color:#7A8AAA;margin-top:2px">Shoot date: ${job.date}${job.shootTime?' at '+job.shootTime:''}</div>
        ${job.duration?`<div style="font-size:11px;color:#7A8AAA">Duration: ${job.duration} hr</div>`:''}
        ${job.notes?`<div style="font-size:11px;color:#A8B4D0;margin-top:3px;font-style:italic">${job.notes}</div>`:''}
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:20px">
      <thead><tr style="border-bottom:1.5px solid #1a1a1a">
        <th style="text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#A8B4D0;padding-bottom:8px">Description</th>
        <th style="text-align:center;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#A8B4D0;padding-bottom:8px">Qty</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#A8B4D0;padding-bottom:8px">Unit</th>
        <th style="text-align:right;font-size:10px;text-transform:uppercase;letter-spacing:.07em;color:#A8B4D0;padding-bottom:8px">Amount</th>
      </tr></thead>
      <tbody>${lineRows}</tbody>
    </table>
    <div style="display:flex;justify-content:flex-end;margin-bottom:20px">
      <div style="min-width:220px">
        <div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px"><span style="color:#A8B4D0">Subtotal</span><span>${fmtN(subtotal)}</span></div>
        ${isUsdInvoice?'':`<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;border-bottom:0.5px solid #e0ddd5"><span style="color:#A8B4D0">HST (13%)</span><span>${fmtN(hst)}</span></div>`}
        <div style="display:flex;justify-content:space-between;padding:10px 0;font-size:17px;font-weight:700;${isUsdInvoice?'border-top:0.5px solid #e0ddd5;margin-top:5px;':''}"><span>Total due</span><span style="color:#22D97A">${fmtN(grandTotal)}</span></div>
      </div>
    </div>
    <div style="border-top:0.5px solid #e0ddd5;padding-top:20px">
      ${biz.terms?`<div style="font-size:12px;color:#A8B4D0;margin-bottom:8px">${biz.terms}</div>`:''}
      ${stripeBtn}
      ${interestTable}
      ${biz.notes?`<div style="margin-top:16px;font-size:12px;color:#7A8AAA;padding-top:14px;border-top:0.5px solid #2a3a5a">${biz.notes}</div>`:''}
    </div>`;
  document.getElementById('invoice-overlay').style.display='block';
}

function openAndSendInvoice(jobId){
  openInvoice(jobId);
  // Show a confirmation dialog BEFORE sending — prevents accidental mass-sends
  setTimeout(()=>{
    const d = currentInvoiceData;
    if(!d) return;
    const msg = `Send invoice ${d.invNum} to ${d.clientName||d.clientEmail}?\n\nAmount: ${fmtN(d.grandTotal)}\nEmail: ${d.clientEmail||'(no email on file)'}\n\nThis will email them immediately.`;
    if(confirm(msg)) sendInvoiceEmail();
  }, 350);
}

async function openStripeCheckout(amount, invoiceNumber, clientEmail, currency, jobId){
  const btn=event?.target;
  if(btn){btn.textContent='Loading…';btn.disabled=true;}
  try{
    const res=await fetch('/.netlify/functions/create-checkout',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({
        amount,
        currency:currency||currentInvoiceData?.currency||'cad',
        jobName:currentInvoiceData?.jobName||'DroneHub Media Invoice',
        invoiceNumber,
        clientEmail,
        jobId:jobId||currentInvoiceData?.jobId||''
      })
    });
    const data=await res.json();
    if(data.url){
      window.location.href=data.url;
    } else {
      throw new Error(data.error||'No checkout URL returned');
    }
  }catch(e){
    console.error('Checkout error:',e);
    if(btn){btn.innerHTML='<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg> Pay now';btn.disabled=false;}
    alert('Could not create checkout session: '+e.message);
  }
}

function closeInvoice(){
  document.getElementById('invoice-overlay').style.display='none';
}


// ─── PAYROLL HELPERS ────────────────────────────────────────────────────────
function getBiweeklyPeriod(dateStr){
  // Anchor: Jan 1 2024 as start of first period
  const anchor=new Date('2025-04-25');
  const d=new Date(dateStr);
  const diff=Math.floor((d-anchor)/(1000*60*60*24));
  const periodIndex=Math.floor(diff/14);
  const start=new Date(anchor.getTime()+periodIndex*14*24*60*60*1000);
  const end=new Date(start.getTime()+13*24*60*60*1000);
  const fmt2=(d)=>d.toLocaleDateString('en-CA',{month:'short',day:'numeric',year:'numeric'});
  return{label:`${fmt2(start)} – ${fmt2(end)}`,start:start.toISOString().slice(0,10),end:end.toISOString().slice(0,10)};
}

let initialJobStatus='quoted';
function setInitialStatus(s){
  initialJobStatus=s;
  ['quoted','confirmed','completed'].forEach(st=>{
    const btn=document.getElementById('status-btn-'+st);
    if(btn) btn.className='status-pill-btn'+(s===st?' status-'+st+'-active':'');
  });
}


let incomeEntries=JSON.parse(localStorage.getItem('dronehub_income')||'[]');


function saveIncome(){
  try{localStorage.setItem('dronehub_income',JSON.stringify(incomeEntries));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':income',{data:JSON.stringify(incomeEntries),updatedAt:Date.now()}).catch(e=>{
      console.error('[saveIncome] Firebase write failed:',e.message);
    });
  }
}
function addIncome(){
  const date=document.getElementById('inc-date').value;
  const desc=document.getElementById('inc-desc').value.trim();
  const cat=document.getElementById('inc-cat').value;
  const amount=parseFloat(document.getElementById('inc-amount').value);
  const market=document.getElementById('inc-market')?.value||'canada';
  if(!date||!desc||!amount||amount<=0){alert('Please fill in all income fields.');return;}
  incomeEntries.push({id:Date.now(),date,desc,cat,amount,market});
  incomeEntries.sort((a,b)=>b.date.localeCompare(a.date));
  saveIncome();
  document.getElementById('inc-desc').value='';
  document.getElementById('inc-amount').value='';
  showDhToast('Income added','$'+amount.toFixed(2)+' — '+desc,'✓','var(--green)');
  renderIncomeList();
  renderFinance();
}
function deleteIncome(id){
  incomeEntries=incomeEntries.filter(e=>e.id!==id);
  saveIncome();renderIncomeList();renderFinance();
}
function renderIncomeList(){
  const list=document.getElementById('income-list');
  if(!list) return;
  const filterYear=document.getElementById('inc-filter-year')?.value||'';
  const yearSel=document.getElementById('inc-filter-year');
  if(yearSel){
    const years=[...new Set(incomeEntries.filter(e=>e.date).map(e=>e.date.slice(0,4)))].sort().reverse();
    const prev=yearSel.value;
    yearSel.innerHTML='<option value="">All years</option>'+years.map(y=>`<option value="${y}"${y===prev?' selected':''}>${y}</option>`).join('');
    if(prev) yearSel.value=prev;
  }
  const filtered=incomeEntries.filter(e=>{
    if(filterYear&&(!e.date||!e.date.startsWith(filterYear))) return false;
    return true;
  });
  if(!filtered.length){list.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">No income entries yet.</div>';return;}
  const total=filtered.reduce((s,e)=>s+Number(e.amount||0),0);
  list.innerHTML=filtered.map(e=>{
    const flag=e.market==='usa'?'🇺🇸':'🇨🇦';
    return `<div style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);gap:8px">
      <span style="font-size:11px;flex-shrink:0">${flag}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--offwhite);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.desc}</div>
        <div style="font-size:10px;color:var(--muted)">${e.date} · <span style="color:var(--green)">${e.cat}</span></div>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--green);white-space:nowrap">$${Number(e.amount).toFixed(2)}</div>
      <button onclick="deleteIncome(${e.id})" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" title="Delete">×</button>
    </div>`;
  }).join('')+`<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:12px;font-weight:700"><span style="color:var(--muted)">Total (${filtered.length} entries)</span><span style="color:var(--green)">$${total.toFixed(2)}</span></div>`;
}

let expenses=JSON.parse(localStorage.getItem('dronehub_expenses')||'[]');

// Receipt Storage API (Firebase Cloud Storage via Netlify function)
const _RECEIPT_STORE='/.netlify/functions/receipt-storage';
async function receiptStorageCall(action,receiptId,image){
  const tok=_fbToken();if(!tok)return null;
  const body={action,receiptId,orgId:ORG_ID};
  if(image)body.image=image;
  const r=await fetch(_RECEIPT_STORE,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
    body:JSON.stringify(body)
  });
  if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.error||'Storage error');}
  return r.json();
}

// Migrate old receiptImg fields → save to Cloud Storage, strip from expense object
(function _migrateReceiptImgs(){
  let changed=false;
  expenses.forEach(e=>{
    if(e.receiptImg){
      e.hasReceipt=true;
      const img=e.receiptImg;
      delete e.receiptImg;
      changed=true;
      setTimeout(()=>{
        const raw=img.includes(',')?img.split(',')[1]:img;
        receiptStorageCall('upload','receipt_'+e.id,raw).catch(()=>{});
      },3000);
    }
  });
  if(changed){try{localStorage.setItem('dronehub_expenses',JSON.stringify(expenses));}catch(ex){}}
})();
function clearAllExpensesAndIncome(){
  if(!confirm('Clear ALL expenses and income data? Payroll will be kept.')) return;
  expenses=[];incomeEntries=[];
  saveExpenses();saveIncome();
  if(typeof renderFinance==='function') renderFinance();
  if(typeof renderExpenseList==='function') renderExpenseList();
  if(typeof renderTransferList==='function') renderTransferList();
  if(typeof renderIncomeList==='function') renderIncomeList();
  try{showDhToast('Data cleared','All expenses and income removed. Payroll kept.','check','var(--green)');}catch(e){}
}
function saveExpenses(){
  try{localStorage.setItem('dronehub_expenses',JSON.stringify(expenses));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':expenses',{data:JSON.stringify(expenses),updatedAt:Date.now()})
      .catch(e=>{
        console.error('[saveExpenses] Firebase write failed:',e.message);
        showDhToast('Expenses not saved','Expense records could not be saved to the cloud — changes may be lost if your browser cache is cleared.','⚠️','var(--orange)',7000);
      });
  }
}

// ── Receipt Scanner ──────────────────────────────────────────────────────────
let _receiptScanData=null;
let _receiptImageB64=null;

function handleReceiptFile(input){
  const file=input.files&&input.files[0];
  if(!file) return;
  if(!file.type.startsWith('image/')){showDhToast('Invalid file','Please upload an image of a receipt.','⚠️','var(--orange)');return;}
  if(file.size>10*1024*1024){showDhToast('File too large','Max 10MB.','⚠️','var(--orange)');return;}
  const reader=new FileReader();
  reader.onload=()=>{
    const dataUrl=reader.result;
    const b64=dataUrl.split(',')[1];
    const mime=file.type;
    _receiptImageB64=dataUrl;
    document.getElementById('receipt-drop-zone').style.display='none';
    document.getElementById('receipt-scanning').style.display='block';
    document.getElementById('receipt-preview').style.display='none';
    scanReceipt(b64,mime);
  };
  reader.readAsDataURL(file);
}

function _resizeReceiptImage(dataUrl,maxW){
  return new Promise(resolve=>{
    const img=new Image();
    img.onload=()=>{
      let w=img.width,h=img.height;
      if(w>maxW){h=Math.round(h*(maxW/w));w=maxW;}
      const c=document.createElement('canvas');
      c.width=w;c.height=h;
      c.getContext('2d').drawImage(img,0,0,w,h);
      const jpg=c.toDataURL('image/jpeg',0.8);
      resolve(jpg.split(',')[1]);
    };
    img.src=dataUrl;
  });
}

async function scanReceipt(b64,mimeType){
  try{
    const tok=_fbToken();
    if(!tok){showDhToast('Not signed in','Please sign in first.','⚠️','var(--orange)');receiptDismiss();return;}
    const compressed=await _resizeReceiptImage(_receiptImageB64,1200);
    const r=await fetch('/.netlify/functions/ai-receipt-scan',{
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
      body:JSON.stringify({image:compressed,mimeType:'image/jpeg'})
    });
    if(!r.ok){
      let msg='Scan failed (HTTP '+r.status+')';
      try{const j=await r.json();msg=j.error||msg;}catch(e){}
      throw new Error(msg);
    }
    const json=await r.json();
    _receiptScanData=json.data;
    showReceiptPreview(json.data);
  }catch(e){
    console.error('[receipt-scan]',e);
    showDhToast('Scan failed',e.message||'Could not read receipt.','⚠️','var(--red)');
    receiptDismiss();
  }
}

function showReceiptPreview(d){
  document.getElementById('receipt-scanning').style.display='none';
  document.getElementById('receipt-preview').style.display='block';
  document.getElementById('receipt-preview-img').src=_receiptImageB64;
  const confBadge=document.getElementById('receipt-confidence-badge');
  if(d.confidence){
    const cc=d.confidence==='high'?'var(--green)':d.confidence==='medium'?'var(--amber)':'var(--red)';
    confBadge.style.display='';
    confBadge.style.background=cc+'22';confBadge.style.color=cc;confBadge.style.border='1px solid '+cc+'44';
    confBadge.textContent=d.confidence+' confidence';
  }else{confBadge.style.display='none';}
  const rcptMarket=d.country||'canada';
  const cats=_getExpenseCats(rcptMarket);
  const catOpts=cats.map(c=>`<option value="${c}" ${c===d.category?'selected':''}>${c}</option>`).join('');
  const inputStyle='width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--navy-mid);color:var(--white);font-size:13px;font-family:var(--font);box-sizing:border-box';
  const labelStyle='font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px';
  document.getElementById('receipt-result-fields').innerHTML=`
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      <div style="grid-column:1/-1">
        <div style="${labelStyle}">Vendor</div>
        <input id="rcpt-vendor" value="${d.vendor||''}" style="${inputStyle}">
      </div>
      <div>
        <div style="${labelStyle}">Date</div>
        <input id="rcpt-date" type="date" value="${d.date||''}" style="${inputStyle}">
      </div>
      <div>
        <div style="${labelStyle}">Total</div>
        <input id="rcpt-total" type="number" step="0.01" value="${d.total||''}" style="${inputStyle};font-weight:700;font-size:15px">
      </div>
      <div style="grid-column:1/-1">
        <div style="${labelStyle}">Description</div>
        <input id="rcpt-desc" value="${d.description||''}" style="${inputStyle}">
      </div>
      <div>
        <div style="${labelStyle}">Category</div>
        <select id="rcpt-cat" style="${inputStyle}">${catOpts}</select>
      </div>
      <div>
        <div style="${labelStyle}">Country</div>
        <select id="rcpt-country" style="${inputStyle}">
          <option value="canada" ${d.country==='canada'?'selected':''}>🇨🇦 Canada (CAD)</option>
          <option value="usa" ${d.country==='usa'?'selected':''}>🇺🇸 United States (USD)</option>
        </select>
      </div>
    </div>
    ${d.tax?`<div style="display:flex;justify-content:space-between;margin-top:10px;padding:8px 12px;border-radius:8px;background:var(--navy-mid);font-size:12px"><span style="color:var(--muted)">Tax included</span><span style="color:var(--offwhite);font-weight:600">$${Number(d.tax).toFixed(2)}</span></div>`:''}`;
}

function receiptAccept(){
  const date=document.getElementById('rcpt-date')?.value;
  const desc=(document.getElementById('rcpt-vendor')?.value||'')+(document.getElementById('rcpt-desc')?.value?' — '+document.getElementById('rcpt-desc').value:'');
  const cat=document.getElementById('rcpt-cat')?.value||'Other';
  const total=parseFloat(document.getElementById('rcpt-total')?.value);
  const market=document.getElementById('rcpt-country')?.value||'canada';
  if(!date||!total||total<=0){showDhToast('Missing fields','Date and total are required.','⚠️','var(--orange)');return;}
  const expId=Date.now();
  expenses.push({id:expId,date,desc,cat,amount:total,market,hasReceipt:!!_receiptImageB64});
  expenses.sort((a,b)=>b.date.localeCompare(a.date));
  saveExpenses();
  if(_receiptImageB64&&_fbToken()){
    const raw=_receiptImageB64.includes(',')?_receiptImageB64.split(',')[1]:_receiptImageB64;
    receiptStorageCall('upload','receipt_'+expId,raw).catch(e=>console.warn('Receipt upload failed:',e.message));
  }
  showDhToast('Expense added','$'+total.toFixed(2)+' — '+desc,'✓','var(--green)');
  receiptDismiss();
  renderFinance();
}

function receiptDismiss(){
  _receiptScanData=null;
  _receiptImageB64=null;
  document.getElementById('receipt-drop-zone').style.display='';
  document.getElementById('receipt-scanning').style.display='none';
  document.getElementById('receipt-preview').style.display='none';
  document.getElementById('receipt-file-input').value='';
}

let financeChartInst=null, expCatChartInst=null, financeView='bar';

function setFinanceView(v){
  financeView=v;
  document.getElementById('btn-bar').style.background=v==='bar'?'#E1F5EE':'#f5f5f2';
  document.getElementById('btn-bar').style.color=v==='bar'?'#085041':'#444';
  document.getElementById('btn-line').style.background=v==='line'?'#E1F5EE':'#f5f5f2';
  document.getElementById('btn-line').style.color=v==='line'?'#085041':'#444';
  renderFinance();
}

function addExpense(){
  const date=document.getElementById('exp-date').value;
  const desc=document.getElementById('exp-desc').value.trim();
  const cat=document.getElementById('exp-cat').value;
  const amount=parseFloat(document.getElementById('exp-amount').value);
  const expMarket=document.getElementById('exp-market')?.value||'canada';
  if(!date||!desc||!amount||amount<=0){alert('Please fill in all expense fields.');return;}
  expenses.push({id:Date.now(),date,desc,cat,amount,market:expMarket});
  expenses.sort((a,b)=>b.date.localeCompare(a.date));
  saveExpenses();
  document.getElementById('exp-desc').value='';
  document.getElementById('exp-amount').value='';
  renderFinance();
}

function deleteExpense(id){
  if(!confirm('Delete this expense?')) return;
  expenses=expenses.filter(e=>e.id!==id);
  saveExpenses();
  renderFinance();
}

function deleteExpensesByYear(){
  const year=document.getElementById('exp-filter-year')?.value;
  if(!year) return;
  const count=expenses.filter(e=>e.date&&e.date.startsWith(year)&&!_isNonExpense(e.cat)).length;
  if(!count){showDhToast('No expenses found for '+year,'error');return;}
  if(!confirm('Delete all '+count+' expenses from '+year+'? This cannot be undone.')) return;
  expenses=expenses.filter(e=>!e.date||!e.date.startsWith(year)||_isNonExpense(e.cat));
  saveExpenses();
  renderExpenseList();
  renderFinance();
  showDhToast(count+' expenses from '+year+' deleted','success');
}

function openEditExpenseModal(id){
  const e=expenses.find(x=>x.id===id);
  if(!e) return;
  document.getElementById('edit-exp-id').value=id;
  document.getElementById('edit-exp-date').value=e.date||'';
  document.getElementById('edit-exp-desc').value=e.desc||e.vendor||'';
  document.getElementById('edit-exp-market').value=e.market||'canada';
  _updateEditExpCatDropdown();
  document.getElementById('edit-exp-cat').value=e.cat||'';
  document.getElementById('edit-exp-amount').value=e.amount||0;
  document.getElementById('edit-expense-modal').style.display='flex';
}

function closeEditExpenseModal(){
  document.getElementById('edit-expense-modal').style.display='none';
}

function _updateEditExpCatDropdown(){
  const market=document.getElementById('edit-exp-market')?.value;
  const sel=document.getElementById('edit-exp-cat');
  if(!sel) return;
  const prev=sel.value;
  const cats=market==='usa'?US_EXPENSE_CATS:CA_EXPENSE_CATS;
  sel.innerHTML=cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(prev) sel.value=prev;
}

function saveEditExpense(){
  const id=Number(document.getElementById('edit-exp-id').value);
  const e=expenses.find(x=>x.id===id);
  if(!e) return;
  e.date=document.getElementById('edit-exp-date').value;
  e.desc=document.getElementById('edit-exp-desc').value;
  e.cat=document.getElementById('edit-exp-cat').value;
  e.market=document.getElementById('edit-exp-market').value;
  e.amount=parseFloat(document.getElementById('edit-exp-amount').value)||0;
  saveExpenses();
  closeEditExpenseModal();
  renderExpenseList();
  renderFinance();
  showDhToast('Expense updated','success');
}

function renderExpenseList(){
  const filterCat=document.getElementById('exp-filter-cat')?.value||'';
  const filterYear=document.getElementById('exp-filter-year')?.value||'';
  const list=document.getElementById('expense-list');
  if(!list) return;
  const yearSel=document.getElementById('exp-filter-year');
  if(yearSel){
    const years=[...new Set(expenses.filter(e=>e.date).map(e=>e.date.slice(0,4)))].sort().reverse();
    const prev=yearSel.value;
    yearSel.innerHTML='<option value="">All years</option>'+years.map(y=>`<option value="${y}"${y===prev?' selected':''}>${y}</option>`).join('');
    if(prev) yearSel.value=prev;
  }
  const catFilterSel=document.getElementById('exp-filter-cat');
  if(catFilterSel){
    const usedCats=[...new Set(expenses.map(e=>e.cat).filter(c=>c&&!_isNonExpense(c)))].sort();
    const prevCat=catFilterSel.value;
    catFilterSel.innerHTML='<option value="">All categories</option>'+usedCats.map(c=>`<option value="${c}"${c===prevCat?' selected':''}>${c}</option>`).join('');
    if(prevCat) catFilterSel.value=prevCat;
  }
  const filtered=expenses.filter(e=>{
    if(_isNonExpense(e.cat)) return false;
    if(filterCat&&e.cat!==filterCat) return false;
    if(filterYear&&(!e.date||!e.date.startsWith(filterYear))) return false;
    return true;
  });
  const delYearBtn=document.getElementById('exp-delete-year-btn');
  if(delYearBtn) delYearBtn.style.display=filterYear?'':'none';
  if(!filtered.length){list.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">No expenses found.</div>';return;}
  const total=filtered.reduce((s,e)=>s+Number(e.amount||0),0);
  list.innerHTML=filtered.map(e=>{
    const flag=e.market==='usa'?'🇺🇸':'🇨🇦';
    const receiptIcon=e.hasReceipt?'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--blue-bright)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;cursor:pointer" title="Has receipt" onclick="viewReceipt('+e.id+')"><rect x="2" y="3" width="20" height="18" rx="3"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>':'';
    return `<div style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);gap:8px">
      <span style="font-size:11px;flex-shrink:0">${flag}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--offwhite);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.desc||e.vendor||''}</div>
        <div style="font-size:10px;color:var(--muted)">${e.date} · <span style="color:var(--blue)">${e.cat}</span></div>
      </div>
      ${receiptIcon}
      <div style="font-size:13px;font-weight:600;color:#E85D3A;white-space:nowrap">$${Number(e.amount).toFixed(2)}</div>
      <button onclick="openEditExpenseModal(${e.id})" style="border:none;background:none;color:var(--blue-bright);cursor:pointer;font-size:11px;padding:0 2px" title="Edit">✎</button>
      <button onclick="deleteExpense(${e.id})" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" title="Delete">×</button>
    </div>`;
  }).join('')+`<div style="display:flex;justify-content:space-between;padding:8px 0;font-size:12px;font-weight:700"><span style="color:var(--muted)">Total (${filtered.length} expenses)</span><span style="color:#E85D3A">$${total.toFixed(2)}</span></div>`;
}

function viewReceipt(expId){
  if(_fbToken()){
    receiptStorageCall('get','receipt_'+expId).then(d=>{
      if(d&&d.image){
        const ov=document.createElement('div');
        ov.style.cssText='position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.85);display:flex;align-items:center;justify-content:center;cursor:pointer';
        ov.onclick=()=>ov.remove();
        ov.innerHTML='<img src="data:image/jpeg;base64,'+d.image+'" style="max-width:90vw;max-height:90vh;border-radius:12px;object-fit:contain">';
        document.body.appendChild(ov);
      } else { showDhToast('No receipt','Receipt image not found.','⚠️','var(--orange)'); }
    }).catch(()=>showDhToast('Error','Could not load receipt.','⚠️','var(--red)'));
  }
}

function renderTransferList(){
  const list=document.getElementById('transfer-list');
  const totalEl=document.getElementById('transfer-total');
  if(!list) return;
  const transfers=expenses.filter(e=>_isTransfer(e.cat));
  if(!transfers.length){
    list.innerHTML='<div style="font-size:12px;color:var(--muted);padding:8px 0">No bank transfers found.</div>';
    if(totalEl) totalEl.textContent='';
    return;
  }
  const total=transfers.reduce((s,e)=>s+Number(e.amount||0),0);
  if(totalEl) totalEl.textContent=`$${total.toFixed(2)} (${transfers.length})`;
  list.innerHTML=transfers.map(e=>{
    const flag=e.market==='usa'?'🇺🇸':'🇨🇦';
    return `<div style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);gap:8px">
      <span style="font-size:11px;flex-shrink:0">${flag}</span>
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;font-weight:600;color:var(--offwhite);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.desc}</div>
        <div style="font-size:10px;color:var(--muted)">${e.date} · <span style="color:var(--blue)">${e.cat}</span></div>
      </div>
      <div style="font-size:13px;font-weight:600;color:var(--muted);white-space:nowrap">$${Number(e.amount).toFixed(2)}</div>
      <button onclick="deleteExpense(${e.id})" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 2px;line-height:1" title="Delete">×</button>
    </div>`;
  }).join('');
}

function renderFinance(){
  if(!document.getElementById('pane-finance')) return;
  if(typeof Chart==='undefined') return;
  _updateExpCatDropdown();
  _updateIncCatDropdown();

  // Filter jobs by market (Canada = no market field OR market='canada'; USA = any US market key)
  const isUSFinance = financeMarket==='usa';
  const marketJobs = savedJobs.filter(j=>
    isUSFinance ? (j.market && j.market!=='canada') : (!j.market || j.market==='canada')
  );
  // Filter expenses by market, excluding transfers and income categories
  const marketExpenses = expenses.filter(e=>
    !_isNonExpense(e.cat) && (isUSFinance ? (e.market && e.market!=='canada') : (!e.market || e.market==='canada'))
  );
  const currencyLabel = isUSFinance ? 'USD' : 'CAD';
  const marketIncome=incomeEntries.filter(e=>
    isUSFinance ? (e.market && e.market!=='canada') : (!e.market || e.market==='canada')
  );

  // Update summary metrics label currency
  const badge=document.getElementById('fin-market-badge');
  if(badge) badge.textContent='';

  // Populate year selector
  const yearSel=document.getElementById('finance-year-sel');
  const jobYears=[...new Set(marketJobs.filter(j=>j.status==='completed'&&j.date).map(j=>j.date.slice(0,4)))];
  const expYears=[...new Set(marketExpenses.filter(e=>e.date).map(e=>e.date.slice(0,4)))];
  const incYears=[...new Set(marketIncome.filter(e=>e.date).map(e=>e.date.slice(0,4)))];
  const allYears=[...new Set([...jobYears,...expYears,...incYears])].sort().reverse();
  const curYear=yearSel.value||allYears[0]||String(new Date().getFullYear());
  const prevVal=yearSel.value;
  yearSel.innerHTML=allYears.length
    ?allYears.map(y=>`<option value="${y}"${y===curYear?' selected':''}>${y}</option>`).join('')
    :`<option value="${new Date().getFullYear()}">${new Date().getFullYear()}</option>`;
  if(prevVal&&allYears.includes(prevVal)) yearSel.value=prevVal;
  const year=yearSel.value||String(new Date().getFullYear());

  const months=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  // Revenue per month (completed jobs + manual income entries)
  const revByMonth=Array(12).fill(0);
  marketJobs.filter(j=>j.status==='completed'&&j.date&&j.date.startsWith(year)).forEach(j=>{
    const m=parseInt(j.date.slice(5,7))-1;
    revByMonth[m]+=j.grand||0;
  });
  marketIncome.filter(e=>e.date&&e.date.startsWith(year)).forEach(e=>{
    const m=parseInt(e.date.slice(5,7))-1;
    revByMonth[m]+=e.amount||0;
  });

  // Expenses per month
  const expByMonth=Array(12).fill(0);
  marketExpenses.filter(e=>e.date&&e.date.startsWith(year)).forEach(e=>{
    const m=parseInt(e.date.slice(5,7))-1;
    expByMonth[m]+=e.amount||0;
  });

  // Net profit
  const netByMonth=revByMonth.map((r,i)=>r-expByMonth[i]);

  // Summary metrics
  const totalRev=revByMonth.reduce((a,b)=>a+b,0);
  const totalExp=expByMonth.reduce((a,b)=>a+b,0);
  const netProfit=totalRev-totalExp;
  const hst=isUSFinance?0:totalRev*0.13;
  document.getElementById('finance-metrics').innerHTML=`
    <div class="metric"><div class="mlabel">Revenue ${year}</div><div class="mval" style="color:#1D9E75">$${Math.round(totalRev).toLocaleString('en-CA')}</div><div class="msub">excl. ${isUSFinance?'tax':'HST'} · ${currencyLabel}</div></div>
    <div class="metric"><div class="mlabel">${isUSFinance?'Tax (US)':'HST collected'}</div><div class="mval">${isUSFinance?'<span style="color:var(--muted)">N/A</span>':'$'+Math.round(hst).toLocaleString('en-CA')}</div><div class="msub">${isUSFinance?'No HST on US invoices':'13% of revenue'}</div></div>
    <div class="metric"><div class="mlabel">Expenses ${year}</div><div class="mval" style="color:#E85D3A">$${Math.round(totalExp).toLocaleString('en-CA')}</div><div class="msub">${currencyLabel}</div></div>
    <div class="metric"><div class="mlabel">Net profit</div><div class="mval" style="color:${netProfit>=0?'#1D9E75':'#E85D3A'}">$${Math.round(Math.abs(netProfit)).toLocaleString('en-CA')}${netProfit<0?' loss':''}</div><div class="msub">${currencyLabel}</div></div>`;

  renderInvoiceTracker();

  // Revenue/expense/net chart
  const ctx=document.getElementById('finance-chart');
  if(financeChartInst){financeChartInst.destroy();financeChartInst=null;}
  financeChartInst=new Chart(ctx,{
    type:financeView==='line'?'line':'bar',
    data:{
      labels:months,
      datasets:[
        {label:'Revenue',data:revByMonth.map(v=>Math.round(v)),backgroundColor:'rgba(29,158,117,0.7)',borderColor:'#1D9E75',borderWidth:financeView==='line'?2:0,pointBackgroundColor:'#1D9E75',fill:financeView==='line',tension:0.3},
        {label:'Expenses',data:expByMonth.map(v=>Math.round(v)),backgroundColor:'rgba(232,93,58,0.7)',borderColor:'#E85D3A',borderWidth:financeView==='line'?2:0,pointBackgroundColor:'#E85D3A',fill:false,tension:0.3,borderDash:financeView==='line'?[5,3]:[]},
        {label:'Net profit',data:netByMonth.map(v=>Math.round(v)),backgroundColor:'rgba(91,127,219,0.7)',borderColor:'#5B7FDB',borderWidth:financeView==='line'?2:0,pointBackgroundColor:'#5B7FDB',fill:false,tension:0.3,borderDash:financeView==='line'?[2,2]:[]},
      ]
    },
    options:{
      responsive:true,maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: $${ctx.parsed.y.toLocaleString('en-CA',{minimumFractionDigits:2})}`}}},
      scales:{
        x:{grid:{display:false},ticks:{autoSkip:false,maxRotation:0,font:{size:11}}},
        y:{grid:{color:'rgba(0,0,0,0.05)'},ticks:{callback:v=>'$'+Math.round(v).toLocaleString('en-CA'),font:{size:11}},beginAtZero:true}
      }
    }
  });

  // Category donut chart
  const catColors={
    // Equipment / tech
    'Equipment':'#5B7FDB','Equipment Lease':'#4A6FCA','Equipment Purchase':'#5B7FDB','Equipment Repair':'#4A6FCA',
    'Software':'#1D9E75','Software Subscription':'#1D9E75','Subscriptions':'#1D9E75',
    // People costs
    'Contract':'#E85D3A','Contractors':'#E85D3A','Subcontractor':'#D44E2E',
    'Payroll':'#F5A623','Payroll Fee':'#E8931A','Payroll Tax':'#E8931A',
    // Travel & vehicles
    'Travel':'#00B4D8','Vehicle Insurance':'#0096C7','Vehicle Maintenance':'#0096C7','Car Maintenance':'#0096C7',
    'Fuel/EV':'#B87010','Fuel':'#C87D1E','Gas':'#C87D1E','Parking':'#0077B6',
    'Auto Loan':'#0096C7',
    // Marketing / advertising
    'Advertisement':'#9B5DE5','Marketing':'#9B5DE5',
    // Admin & finance
    'Bank Fee':'#64748B','Accounting':'#475569','Wise Fees':'#64748B',
    'Business Insurance':'#0D9488','Insurance':'#0D9488',
    // Food / entertainment
    'Meals & Entertainment':'#F59E0B','Meals':'#F59E0B','Golf':'#34D399',
    // Office / supplies
    'Office/Bedroom Supplies':'#6B7280','Office/Bedroom':'#6B7280','Office':'#6B7280','Supplies':'#9CA3AF',
    // Phone / utilities
    'Internet/Phone':'#06B6D4','Phone':'#06B6D4',
    // Financial transfers
    'Account Transfer':'#94A3B8','CC CashBack':'#14B8A6','CC Payment':'#94A3B8','Cheque Deposit':'#94A3B8','Payments and Credits':'#94A3B8',
    'Zelle Payment':'#7C3AED','DroneHub Canada':'#5B7FDB','Wise':'#64748B','Wise Fees':'#64748B',
    'Credited':'#14B8A6','Accounting Fees':'#475569',
    // Income
    'Invoice Payment':'#1D9E75','Zelle Debit':'#1D9E75','Zelle debit':'#1D9E75',
    'Misc. Debit':'#1D9E75','Misc. debit':'#1D9E75','Miscellaneous Debit':'#1D9E75',
    'Transfer From US to Canada':'#1D9E75',
    // Misc
    'Gift':'#EC4899','Gifts':'#EC4899','Personal':'#A78BFA','Rent':'#7C3AED',
    'Repair':'#D44E2E','Reimbursements':'#14B8A6','Miscellaneous':'#B4B2A9',
    'Student Loan':'#A78BFA','Other':'#B4B2A9',
  };
  // Deterministic color generator for any category not in the map above
  // Hashes the category name to a consistent hue so the same category always
  // gets the same color across sessions.
  function _catColor(name){
    if(catColors[name]) return catColors[name];
    let h=0; for(let i=0;i<name.length;i++) h=(h*31+name.charCodeAt(i))&0xFFFFFF;
    const hue=(h%360+360)%360;
    return `hsl(${hue},58%,52%)`;
  }

  const catTotals={};
  expenses.filter(e=>e.date&&e.date.startsWith(year)&&!_isNonExpense(e.cat)).forEach(e=>{
    catTotals[e.cat]=(catTotals[e.cat]||0)+e.amount;
  });
  const catKeys=Object.keys(catTotals);
  const catVals=catKeys.map(k=>Math.round(catTotals[k]*100)/100);
  const catColArr=catKeys.map(k=>_catColor(k));
  const ctx2=document.getElementById('exp-cat-chart');
  if(expCatChartInst){expCatChartInst.destroy();expCatChartInst=null;}
  if(catKeys.length){
    expCatChartInst=new Chart(ctx2,{
      type:'doughnut',
      data:{labels:catKeys,datasets:[{data:catVals,backgroundColor:catColArr,borderWidth:2,borderColor:'#fff'}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'65%',plugins:{legend:{display:false},tooltip:{callbacks:{label:ctx=>`${ctx.label}: $${ctx.parsed.toLocaleString('en-CA',{minimumFractionDigits:2})}`}}}}
    });
    const legendEl=document.getElementById('exp-cat-legend');
    if(legendEl){
      const grandTotal=catVals.reduce((a,b)=>a+b,0);
      legendEl.innerHTML=catKeys.map((k,i)=>{
        const pct=grandTotal>0?Math.round(catVals[i]/grandTotal*100):0;
        return `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <span style="width:10px;height:10px;border-radius:2px;background:${catColArr[i]};flex:none;display:inline-block"></span>
          <span style="color:#C8D0E8;flex:1">${k}</span>
          <span style="font-weight:500">$${catVals[i].toLocaleString('en-CA',{minimumFractionDigits:2})}</span>
          <span style="color:#7A8AAA;min-width:30px;text-align:right">${pct}%</span>
        </div>`;
      }).join('');
    }
  } else {
    ctx2.getContext('2d').clearRect(0,0,ctx2.width,ctx2.height);
    const legendEl=document.getElementById('exp-cat-legend');
    if(legendEl) legendEl.innerHTML='<div style="font-size:12px;color:#7A8AAA">No expenses for this year.</div>';
  }

  renderExpenseList();
}


// ─── BULK EXPENSE IMPORT ─────────────────────────────────────────────────────
let importRows=[], importHeaders=[];

function _getExpenseCats(market){
  return market==='usa'?[...US_EXPENSE_CATS,...US_TRANSFER_CATS]:CA_EXPENSE_CATS;
}
function _getTransferCats(market){
  return market==='usa'?US_TRANSFER_CATS:[];
}
function _getIncomeCats(market){
  return market==='usa'?US_INCOME_CATS:CA_INCOME_CATS;
}
function _updateExpCatDropdown(){
  const market=document.getElementById('exp-market')?.value||'canada';
  const sel=document.getElementById('exp-cat');
  if(!sel) return;
  const prev=sel.value;
  const cats=_getExpenseCats(market);
  sel.innerHTML=cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(cats.includes(prev)) sel.value=prev;
}
function _updateIncCatDropdown(){
  const market=document.getElementById('inc-market')?.value||'canada';
  const sel=document.getElementById('inc-cat');
  if(!sel) return;
  const prev=sel.value;
  const cats=_getIncomeCats(market);
  sel.innerHTML=cats.map(c=>`<option value="${c}">${c}</option>`).join('');
  if(cats.includes(prev)) sel.value=prev;
}

// Keyword → category auto-detection
const CAT_KEYWORDS={
  'Equipment Purchase':['equipment','gear','camera','drone','battery','lens','tripod','storage','sd card','hard drive','memory'],
  'Software Subscription':['software','subscription','adobe','lightroom','google','microsoft','office','dropbox','app','saas','license'],
  'Subscriptions':['software','subscription','adobe','lightroom','google','microsoft','office','dropbox','app','saas','license'],
  'Fuel/EV':['fuel','gas','petrol','shell','esso','petro','circle k','ultramar','canadian tire fuel','ev charge','supercharge','tesla'],
  Travel:['hotel','airbnb','flight','airline','uber','lyft','taxi','transit','train','via rail','porter'],
  'Meals & Entertainment':['restaurant','food','coffee','tim horton','starbucks','mcdonald','subway','pizza','donut','meal','dine','cafe','bar','grill','kitchen','bistro','eatery'],
  Advertisement:['marketing','advertising','facebook ads','google ads','instagram','linkedin','print','brochure','flyer'],
  'Vehicle Insurance':['insurance','aviva','intact','belair','coverage','premium','auto insurance'],
  'Business Insurance':['business insurance','liability','e&o','errors and omissions'],
  'Office/Bedroom':['staples','office','supplies','paper','ink','fedex','ups','canada post','shipping','print'],
  'Internet/Phone':['rogers','bell','telus','fido','koodo','public mobile','phone','internet','data plan','wireless'],
  Golf:['golf','tee time','course','range','club'],
  Parking:['parking','meter','lot'],
  Contract:['contractor','freelance','subcontract','consultant'],
  Rent:['rent','lease','office space'],
  'Bank Fee':['bank fee','service charge','monthly fee','nsf','overdraft'],
  Accounting:['accounting','bookkeeping','accountant','tax prep'],
  'Wise Fees':['wise fee','wise transfer fee'],
  'Reimbursements':['reimbursement','reimburse'],
  'Zelle Payment':['zelle'],
  'DroneHub Canada':['dronehub canada'],
  'Car Maintenance':['car wash','car maintenance','oil change','tire'],
};

function guessCategory(desc){
  const d=(desc||'').toLowerCase();
  for(const [cat,kws] of Object.entries(CAT_KEYWORDS)){
    if(kws.some(k=>d.includes(k))) return cat;
  }
  return '';
}

let _importType='expense';
let _importWorkbook=null;

function _importSheetPicker(wb){
  const mapper=document.getElementById('import-mapper');
  mapper.style.display='block';
  mapper.innerHTML=`
    <div style="font-size:13px;font-weight:600;color:var(--offwhite);margin-bottom:10px">Select a sheet to import</div>
    <div style="display:flex;flex-direction:column;gap:6px">
      ${wb.SheetNames.map((name,i)=>`
        <button onclick="_importSelectSheet(${i})" style="padding:10px 16px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:12px;font-weight:500;cursor:pointer;text-align:left">${name}</button>
      `).join('')}
    </div>
    <button onclick="cancelImport()" style="margin-top:10px;padding:7px 14px;border-radius:16px;border:0.5px solid #ccc;background:#1C2333;color:#A8B4D0;font-size:12px;cursor:pointer">Cancel</button>
  `;
}

function _importSelectSheet(idx){
  const wb=_importWorkbook;
  if(!wb) return;
  const ws=wb.Sheets[wb.SheetNames[idx]];
  const data=XLSX.utils.sheet_to_csv(ws);
  const parsed=parseCSV(data);
  importHeaders=parsed.headers; importRows=parsed.rows;
  const mapper=document.getElementById('import-mapper');
  mapper.innerHTML='';mapper.style.display='none';
  _restoreImportMapperHTML();
  const lh=importHeaders.map(h=>h.toLowerCase());
  if(lh.some(h=>h.includes('client')||h.includes('invoice'))) setImportType('income');
  else setImportType('expense');
  document.getElementById('import-file-name').textContent=`Sheet: ${wb.SheetNames[idx]} (${importRows.length} rows)`;
  showImportMapper();
}

function _restoreImportMapperHTML(){
  const mapper=document.getElementById('import-mapper');
  mapper.innerHTML=`
    <div style="font-size:12px;font-weight:500;color:#C8D0E8;margin-bottom:8px" id="import-file-name"></div>
    <div style="display:flex;gap:6px;margin-bottom:10px">
      <button id="import-type-expense" onclick="setImportType('expense')" style="padding:5px 14px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.15);color:var(--blue-bright);font-size:11px;font-weight:600;cursor:pointer">Expenses</button>
      <button id="import-type-income" onclick="setImportType('income')" style="padding:5px 14px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;font-weight:600;cursor:pointer">Income / Invoices</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;margin-bottom:12px" id="import-col-map"></div>
    <div class="note" id="import-preview-note" style="margin-bottom:8px"></div>
    <div style="overflow-x:auto;margin-bottom:12px">
      <table id="import-preview-table" style="width:100%;border-collapse:collapse;font-size:11px"></table>
    </div>
    <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
      <div class="row" style="gap:8px;align-items:center">
        <label style="font-size:12px">Default category for unmatched rows:</label>
        <select id="import-default-cat" style="padding:4px 8px;border:0.5px solid #ccc;border-radius:8px;font-size:12px;background:#242D42;color:#E8ECF8">
          <option value="Miscellaneous">Miscellaneous</option>
        </select>
      </div>
      <button onclick="runImport()" id="import-run-btn" style="padding:7px 20px;border-radius:16px;border:0.5px solid #1D9E75;background:rgba(34,217,122,.1);color:#22D97A;font-size:12px;font-weight:500;cursor:pointer">Import expenses ✓</button>
      <button onclick="cancelImport()" style="padding:7px 14px;border-radius:16px;border:0.5px solid #ccc;background:#1C2333;color:#A8B4D0;font-size:12px;cursor:pointer">Cancel</button>
      <span id="import-status" style="font-size:12px;color:#22D97A"></span>
    </div>
  `;
}
function setImportType(type){
  _importType=type;
  const btns={expense:'import-type-expense',transfer:'import-type-transfer',income:'import-type-income'};
  const runBtn=document.getElementById('import-run-btn');
  const labels={expense:'Import expenses ✓',transfer:'Import bank transfers ✓',income:'Import income ✓'};
  runBtn.textContent=labels[type]||labels.expense;
  Object.entries(btns).forEach(([t,id])=>{
    const btn=document.getElementById(id);
    if(!btn) return;
    if(t===type){
      btn.style.border='1px solid var(--blue)';btn.style.background='rgba(91,141,239,.15)';btn.style.color='var(--blue-bright)';
    }else{
      btn.style.border='1px solid var(--border)';btn.style.background='transparent';btn.style.color='var(--muted)';
    }
  });
  showImportMapper();
}

function parseCSV(text){
  const lines=text.trim().split(/\r?\n/);
  if(!lines.length) return{headers:[],rows:[]};
  const parseRow=line=>{
    const cols=[]; let cur='', inQ=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'&&!inQ){inQ=true;}
      else if(c==='"'&&inQ&&line[i+1]==='"'){cur+='"';i++;}
      else if(c==='"'&&inQ){inQ=false;}
      else if((c===','||c==='\t')&&!inQ){cols.push(cur.trim());cur='';}
      else cur+=c;
    }
    cols.push(cur.trim());
    return cols;
  };
  const headerKeywords=['date','amount','description','transaction','total','category','type','client','invoice','status','debit','credit','merchant','memo','cost'];
  let headerIdx=0;
  for(let i=0;i<Math.min(lines.length,5);i++){
    const cols=parseRow(lines[i]);
    const lower=cols.map(c=>c.toLowerCase());
    if(lower.filter(c=>headerKeywords.some(k=>c.includes(k))).length>=2){
      headerIdx=i;
      break;
    }
  }
  const headers=parseRow(lines[headerIdx]);
  const rows=lines.slice(headerIdx+1).map(l=>parseRow(l)).filter(r=>r.some(c=>c));
  return{headers,rows};
}

function guessColIndex(headers,type){
  const h=headers.map(x=>x.toLowerCase().trim());
  const exact={
    date:['date','transaction date','trans date','posted','post date','day'],
    desc:['description','desc','merchant','payee','memo','name','details','narrative','client','transaction'],
    amount:['amount','total','debit','charge','cost','price','withdrawal','cad','usd','value'],
    cat:['category','transaction type','type','group','class'],
    invoice:['invoice number','invoice','invoice #','inv #'],
    status:['status','paid','state'],
  };
  for(const p of exact[type]||[]){
    const idx=h.findIndex(h2=>h2===p);
    if(idx>=0) return idx;
  }
  for(const p of exact[type]||[]){
    const idx=h.findIndex(h2=>h2.includes(p));
    if(idx>=0) return idx;
  }
  return -1;
}

function handleImportDrop(files){ if(files.length) handleImportFile(files); }

function handleImportFile(files){
  const file=files[0];
  if(!file) return;
  document.getElementById('import-file-name').textContent=`File: ${file.name} (${(file.size/1024).toFixed(1)} KB)`;
  const isExcel=/\.xlsx?$/i.test(file.name);

  const reader=new FileReader();
  reader.onload=e=>{
    try{
      if(isExcel){
        if(typeof XLSX==='undefined'){alert('Excel library not loaded yet. Try again in a moment.');return;}
        _importWorkbook=XLSX.read(e.target.result,{type:'array'});
        if(_importWorkbook.SheetNames.length>1){
          _importSheetPicker(_importWorkbook);
          return;
        }
        const ws=_importWorkbook.Sheets[_importWorkbook.SheetNames[0]];
        const data=XLSX.utils.sheet_to_csv(ws);
        const parsed=parseCSV(data);
        importHeaders=parsed.headers; importRows=parsed.rows;
      } else {
        const parsed=parseCSV(e.target.result);
        importHeaders=parsed.headers; importRows=parsed.rows;
      }
      const lh=importHeaders.map(h=>h.toLowerCase());
      if(lh.some(h=>h.includes('client')||h.includes('invoice'))) setImportType('income');
      else setImportType('expense');
      showImportMapper();
    } catch(err){alert('Could not read file: '+err.message);}
  };
  if(isExcel) reader.readAsArrayBuffer(file);
  else reader.readAsText(file);
}

function showImportMapper(){
  const mapper=document.getElementById('import-mapper');
  mapper.style.display='block';

  const isIncome=_importType==='income';
  const isTransfer=_importType==='transfer';
  const defCatSel=document.getElementById('import-default-cat');
  if(defCatSel){
    const market=document.getElementById('import-market')?.value||'us';
    let cats,def;
    if(isIncome){ cats=[...new Set([...US_INCOME_CATS,...CA_INCOME_CATS])]; def='Invoice Payment'; }
    else{ cats=ALL_CATS; def='Miscellaneous'; }
    defCatSel.innerHTML=cats.map(c=>`<option value="${c}"${c===def?' selected':''}>${c}</option>`).join('');
  }

  const dateIdx=guessColIndex(importHeaders,'date');
  const descIdx=guessColIndex(importHeaders,'desc');
  const amtIdx=guessColIndex(importHeaders,'amount');
  const catIdx=isIncome?guessColIndex(importHeaders,'status'):guessColIndex(importHeaders,'cat');

  const labels=isIncome
    ?{dateCol:'Date',descCol:'Client / Description',amtCol:'Amount / Total',catCol:'Category (optional)'}
    :{dateCol:'Date',descCol:'Description',amtCol:'Amount',catCol:'Category (optional)'};

  const makeSelect=(id,selected)=>`
    <div>
      <div style="font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#A8B4D0;margin-bottom:4px">${labels[id]}</div>
      <select id="${id}" onchange="updateImportPreview()" style="width:100%;padding:5px 6px;border:0.5px solid #ccc;border-radius:8px;font-size:11px;background:#242D42;color:#E8ECF8">
        <option value="-1">— skip —</option>
        ${importHeaders.map((h,i)=>`<option value="${i}"${i===selected?' selected':''}>${h||'(col '+(i+1)+')'}</option>`).join('')}
      </select>
    </div>`;

  document.getElementById('import-col-map').innerHTML=
    makeSelect('dateCol',dateIdx)+
    makeSelect('descCol',descIdx)+
    makeSelect('amtCol',amtIdx)+
    makeSelect('catCol',catIdx);

  updateImportPreview();
}

function parseImportDate(raw){
  if(!raw) return '';
  // Try ISO first
  let d=new Date(raw);
  if(!isNaN(d.getTime())) return d.toISOString().slice(0,10);
  // Try common formats: MM/DD/YYYY, DD/MM/YYYY, MM-DD-YYYY
  const parts=String(raw).split(/[\/\-\.]/);
  if(parts.length===3){
    const [a,b,c]=parts.map(Number);
    if(c>1900){ d=new Date(c,a-1,b); if(!isNaN(d.getTime())) return d.toISOString().slice(0,10); }
    if(a>1900){ d=new Date(a,b-1,c); if(!isNaN(d.getTime())) return d.toISOString().slice(0,10); }
  }
  return String(raw).slice(0,10);
}

function parseImportAmount(raw){
  if(raw===undefined||raw===null||raw==='') return 0;
  const s=String(raw).replace(/[$,\s]/g,'');
  const n=parseFloat(s);
  return isNaN(n)?0:Math.abs(n);
}

function getImportMappedRows(){
  const di=parseInt(document.getElementById('dateCol')?.value??-1);
  const ni=parseInt(document.getElementById('descCol')?.value??-1);
  const ai=parseInt(document.getElementById('amtCol')?.value??-1);
  const ci=parseInt(document.getElementById('catCol')?.value??-1);
  return importRows.map(r=>({
    date:di>=0?parseImportDate(r[di]):'',
    desc:ni>=0?(r[ni]||'').trim():'',
    amount:ai>=0?parseImportAmount(r[ai]):0,
    cat:ci>=0&&r[ci]?_normalizeCat(r[ci].trim()):guessCategory(ni>=0?r[ni]||'':''),
  })).filter(r=>r.amount>0&&r.date);
}

function updateImportPreview(){
  const rows=getImportMappedRows().slice(0,5);
  const note=document.getElementById('import-preview-note');
  const all=getImportMappedRows();
  note.textContent=`Preview (first 5 of ${all.length} valid rows — ${importRows.length-all.length} skipped as invalid/zero)`;
  const tbl=document.getElementById('import-preview-table');
  if(!rows.length){tbl.innerHTML='<tr><td style="padding:6px;color:#7A8AAA;font-size:11px">No valid rows found. Check your column mapping.</td></tr>';return;}
  tbl.innerHTML=`<thead><tr style="border-bottom:1px solid #e0ddd5">
    ${['Date','Description','Amount','Category (auto-detected)'].map(h=>`<th style="text-align:left;padding:4px 8px;font-size:10px;color:#A8B4D0;font-weight:500;text-transform:uppercase;letter-spacing:.05em">${h}</th>`).join('')}
  </tr></thead><tbody>
    ${rows.map(r=>`<tr style="border-bottom:0.5px solid #f0ede6">
      <td style="padding:4px 8px;font-size:11px">${r.date}</td>
      <td style="padding:4px 8px;font-size:11px;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${r.desc}</td>
      <td style="padding:4px 8px;font-size:11px">$${r.amount.toFixed(2)}</td>
      <td style="padding:4px 8px;font-size:11px;color:${r.cat?'#085041':'#aaa'}">${r.cat||'→ default'}</td>
    </tr>`).join('')}
  </tbody>`;
}

function runImport(){
  const rows=getImportMappedRows();
  if(!rows.length){alert('No valid rows to import.');return;}
  const defaultCat=document.getElementById('import-default-cat').value||'Other';
  const isIncome=_importType==='income';
  let added=0;
  const market=document.getElementById('import-market')?.value||'us';
  rows.forEach(r=>{
    const entry={id:Date.now()+Math.random(),date:r.date,desc:r.desc,cat:r.cat||defaultCat,amount:r.amount,market};
    if(isIncome){
      incomeEntries.push(entry);
    }else{
      expenses.push(entry);
    }
    added++;
  });
  if(isIncome){
    incomeEntries.sort((a,b)=>b.date.localeCompare(a.date));
    saveIncome();
  }else{
    expenses.sort((a,b)=>b.date.localeCompare(a.date));
    saveExpenses();
  }
  const label=isIncome?'income entry':'expense';
  document.getElementById('import-status').textContent=`✓ ${added} ${label}${added!==1?'s':''} imported`;
  setTimeout(()=>{
    cancelImport();
    renderFinance();
  },1500);
}

function cancelImport(){
  _restoreImportMapperHTML();
  document.getElementById('import-mapper').style.display='none';
  document.getElementById('import-file-input').value='';
  importRows=[]; importHeaders=[]; _importWorkbook=null;
}

// ── Loan Tracker ────────────────────────────────────────────────────────────
let loans=JSON.parse(localStorage.getItem('dronehub_loans')||'[]');

function saveLoans(){
  try{localStorage.setItem('dronehub_loans',JSON.stringify(loans));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':loans',{data:JSON.stringify(loans),updatedAt:Date.now()}).catch(()=>{});
  }
}

function openLoanModal(editId){
  const modal=document.getElementById('loan-modal');
  modal.style.display='flex';
  document.getElementById('loan-modal-title').textContent=editId?'Edit Loan':'Add Loan';
  if(editId){
    const loan=loans.find(l=>l.id===editId);
    if(!loan) return;
    document.getElementById('loan-edit-id').value=editId;
    document.getElementById('loan-type').value=loan.type||'Other';
    document.getElementById('loan-lender').value=loan.lender||'';
    document.getElementById('loan-original').value=loan.original||'';
    document.getElementById('loan-balance').value=loan.balance||'';
    document.getElementById('loan-rate').value=loan.rate||'';
    document.getElementById('loan-min-payment').value=loan.minPayment||'';
    document.getElementById('loan-market').value=loan.market||'usa';
    document.getElementById('loan-start-date').value=loan.startDate||'';
    document.getElementById('loan-notes').value=loan.notes||'';
  } else {
    document.getElementById('loan-edit-id').value='';
    document.getElementById('loan-type').value='Credit Card';
    document.getElementById('loan-lender').value='';
    document.getElementById('loan-original').value='';
    document.getElementById('loan-balance').value='';
    document.getElementById('loan-rate').value='';
    document.getElementById('loan-min-payment').value='';
    document.getElementById('loan-market').value='usa';
    document.getElementById('loan-start-date').value=new Date().toISOString().slice(0,10);
    document.getElementById('loan-notes').value='';
  }
}

function closeLoanModal(){document.getElementById('loan-modal').style.display='none';}

function saveLoan(){
  const editId=document.getElementById('loan-edit-id').value;
  const type=document.getElementById('loan-type').value;
  const lender=document.getElementById('loan-lender').value.trim();
  const original=parseFloat(document.getElementById('loan-original').value)||0;
  const balance=parseFloat(document.getElementById('loan-balance').value)||0;
  const rate=parseFloat(document.getElementById('loan-rate').value)||0;
  const minPayment=parseFloat(document.getElementById('loan-min-payment').value)||0;
  const market=document.getElementById('loan-market').value;
  const startDate=document.getElementById('loan-start-date').value;
  const notes=document.getElementById('loan-notes').value.trim();
  if(!lender){alert('Enter a lender name.');return;}
  if(!original&&!balance){alert('Enter an amount.');return;}
  if(editId){
    const loan=loans.find(l=>l.id===editId);
    if(loan){Object.assign(loan,{type,lender,original,balance,rate,minPayment,market,startDate,notes,updatedAt:Date.now()});}
  } else {
    loans.push({id:Date.now()+Math.random(),type,lender,original:original||balance,balance,rate,minPayment,market,startDate,notes,payments:[],createdAt:Date.now()});
  }
  saveLoans();
  closeLoanModal();
  renderLoans();
}

function deleteLoan(id){
  if(!confirm('Delete this loan and all its payment history?')) return;
  loans=loans.filter(l=>l.id!==id);
  saveLoans();
  renderLoans();
}

function openLoanPaymentModal(loanId){
  const loan=loans.find(l=>l.id===loanId);
  if(!loan) return;
  const modal=document.getElementById('loan-payment-modal');
  modal.style.display='flex';
  document.getElementById('loan-pay-id').value=loanId;
  document.getElementById('loan-pay-info').textContent=`${loan.lender} — Current balance: $${loan.balance.toFixed(2)}`;
  document.getElementById('loan-pay-amount').value='';
  document.getElementById('loan-pay-date').value=new Date().toISOString().slice(0,10);
  document.getElementById('loan-pay-note').value='';
}

function closeLoanPaymentModal(){document.getElementById('loan-payment-modal').style.display='none';}

function saveLoanPayment(){
  const loanId=document.getElementById('loan-pay-id').value;
  const amount=parseFloat(document.getElementById('loan-pay-amount').value)||0;
  const date=document.getElementById('loan-pay-date').value;
  const note=document.getElementById('loan-pay-note').value.trim();
  if(!amount){alert('Enter a payment amount.');return;}
  const loan=loans.find(l=>String(l.id)===String(loanId));
  if(!loan) return;
  if(!loan.payments) loan.payments=[];
  loan.payments.push({id:Date.now()+Math.random(),amount,date,note});
  loan.payments.sort((a,b)=>b.date.localeCompare(a.date));
  loan.balance=Math.max(0,loan.balance-amount);
  saveLoans();
  closeLoanPaymentModal();
  renderLoans();
  try{showDhToast('Payment recorded',`$${amount.toFixed(2)} applied to ${loan.lender}`,'check','var(--green)');}catch(e){}
}

function deleteLoanPayment(loanId,payId){
  const loan=loans.find(l=>l.id===loanId);
  if(!loan||!loan.payments) return;
  const pay=loan.payments.find(p=>p.id===payId);
  if(!pay) return;
  loan.payments=loan.payments.filter(p=>p.id!==payId);
  loan.balance+=pay.amount;
  saveLoans();
  renderLoans();
}

function _loanTypeIcon(type){
  const t=(type||'').toLowerCase();
  if(t.includes('credit card')) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A78BFA" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>';
  if(t.includes('line of credit')) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22D97A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a2 2 0 0 0 0 4h4v-4z"/></svg>';
  if(t.includes('car')) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F5C842" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17h14M5 17a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/></svg>';
  if(t.includes('student')) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5B8DEF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg>';
  if(t.includes('mortgage')) return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#E85D3A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>';
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>';
}

function renderLoans(){
  const summary=document.getElementById('loan-summary-metrics');
  const list=document.getElementById('loan-list');
  if(!summary||!list) return;

  const totalDebt=loans.reduce((s,l)=>s+l.balance,0);
  const totalOriginal=loans.reduce((s,l)=>s+(l.original||l.balance),0);
  const totalMinPayment=loans.reduce((s,l)=>s+(l.minPayment||0),0);
  const totalPaid=totalOriginal-totalDebt;
  const paidPct=totalOriginal>0?Math.round((totalPaid/totalOriginal)*100):0;

  summary.innerHTML=`
    <div class="metric"><div class="mlabel">Total Debt</div><div class="mval" style="color:#E85D3A">$${Math.round(totalDebt).toLocaleString('en-CA')}</div><div class="msub">${loans.length} active loan${loans.length!==1?'s':''}</div></div>
    <div class="metric"><div class="mlabel">Total Paid</div><div class="mval" style="color:#1D9E75">$${Math.round(totalPaid).toLocaleString('en-CA')}</div><div class="msub">${paidPct}% of original</div></div>
    <div class="metric"><div class="mlabel">Monthly Min.</div><div class="mval" style="color:var(--blue-bright)">$${Math.round(totalMinPayment).toLocaleString('en-CA')}</div><div class="msub">combined minimum</div></div>`;

  if(!loans.length){
    list.innerHTML='<div class="card" style="text-align:center;padding:40px 20px"><div style="font-size:14px;color:var(--muted);margin-bottom:8px">No loans added yet</div><div style="font-size:12px;color:var(--muted);opacity:.6">Click "+ Add Loan" to start tracking</div></div>';
    return;
  }

  list.innerHTML=loans.map(loan=>{
    const original=loan.original||loan.balance;
    const paid=original-loan.balance;
    const pct=original>0?Math.min(100,Math.round((paid/original)*100)):0;
    const flag=loan.market==='canada'?'🇨🇦':'🇺🇸';
    const currency=loan.market==='canada'?'CAD':'USD';
    const barColor=pct>=100?'#1D9E75':pct>=50?'#5B8DEF':'#E85D3A';
    const payments=loan.payments||[];
    const recentPayments=payments.slice(0,3);

    return `<div class="card" style="margin-bottom:12px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:10px;flex-wrap:wrap">
        <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:0">
          ${_loanTypeIcon(loan.type)}
          <div style="min-width:0">
            <div style="font-size:14px;font-weight:700;color:var(--offwhite);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${loan.lender} <span style="font-size:11px;font-weight:500;color:var(--muted)">${flag}</span></div>
            <div style="font-size:11px;color:var(--muted)">${loan.type}${loan.rate?' · '+loan.rate+'% APR':''}${loan.minPayment?' · $'+loan.minPayment.toFixed(2)+'/mo':''}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button onclick="openLoanPaymentModal(${loan.id})" style="padding:5px 14px;border-radius:16px;border:1px solid var(--green);background:rgba(34,217,122,.08);color:var(--green);font-size:11px;font-weight:600;cursor:pointer">+ Payment</button>
          <button onclick="openLoanModal(${loan.id})" style="padding:5px 10px;border-radius:16px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">Edit</button>
          <button onclick="deleteLoan(${loan.id})" style="padding:5px 10px;border-radius:16px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:11px;cursor:pointer">×</button>
        </div>
      </div>

      <div style="display:flex;align-items:baseline;justify-content:space-between;margin-top:12px">
        <div><span style="font-size:20px;font-weight:800;color:var(--offwhite)">$${loan.balance.toLocaleString('en-CA',{minimumFractionDigits:2})}</span><span style="font-size:11px;color:var(--muted);margin-left:6px">remaining</span></div>
        <div style="font-size:11px;color:var(--muted)">of $${original.toLocaleString('en-CA',{minimumFractionDigits:2})}</div>
      </div>

      <div style="margin-top:8px;background:rgba(255,255,255,.06);border-radius:6px;height:8px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:6px;transition:width .3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:var(--muted)">
        <span>${pct}% paid off</span>
        <span>$${paid.toLocaleString('en-CA',{minimumFractionDigits:2})} paid</span>
      </div>

      ${recentPayments.length?`<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:8px">
        <div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:600;margin-bottom:6px">Recent Payments</div>
        ${recentPayments.map(p=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:11px">
          <div style="color:var(--muted)">${p.date}${p.note?' · '+p.note:''}</div>
          <div style="display:flex;align-items:center;gap:6px">
            <span style="color:#1D9E75;font-weight:600">-$${p.amount.toFixed(2)}</span>
            <button onclick="deleteLoanPayment(${loan.id},${p.id})" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:12px;padding:0 2px;line-height:1" title="Remove">×</button>
          </div>
        </div>`).join('')}
        ${payments.length>3?`<div style="font-size:10px;color:var(--blue-bright);margin-top:4px;cursor:pointer" onclick="toggleLoanPayments(${loan.id})">Show all ${payments.length} payments</div>`:''}
      </div>`:''}
      ${loan.notes?`<div style="font-size:11px;color:var(--muted);margin-top:8px;font-style:italic">${loan.notes}</div>`:''}
    </div>`;
  }).join('');
}

// ── PLAID BANK CONNECTION ───────────────────────────────────────────────────
async function plaidConnect(country) {
  try {
    const resp = await fetch(_PROXY.replace('firebase-proxy','plaid-link'), {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_dhToken},
      body: JSON.stringify({ action:'create_link_token', userId: ORG_ID, countryCodes: country==='CA'?['CA']:['US'] })
    });
    const data = await resp.json();
    if(!data.link_token){ showDhToast('Failed to start bank connection: '+(data.error||'unknown'),'error'); console.error('Plaid link error:', data); return; }
    const handler = Plaid.create({
      token: data.link_token,
      onSuccess: async (publicToken, metadata) => {
        const label = metadata.institution?.name || (country+' Bank');
        const exResp = await fetch(_PROXY.replace('firebase-proxy','plaid-link'), {
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+_dhToken},
          body: JSON.stringify({ action:'exchange_token', publicToken, orgId:ORG_ID, label, country })
        });
        const exData = await exResp.json();
        if(exData.success){
          showDhToast(label+' connected!','success');
          plaidLoadItems();
        } else {
          showDhToast('Failed to save connection','error');
        }
      },
      onExit: (err) => { if(err) console.warn('Plaid Link exit:', err); },
    });
    handler.open();
  } catch(e) {
    console.error('plaidConnect error:', e);
    showDhToast('Bank connection error','error');
  }
}

async function plaidLoadItems() {
  const listEl = document.getElementById('plaid-connected-list');
  const syncArea = document.getElementById('plaid-sync-area');
  if(!listEl) return;
  try {
    const resp = await fetch(_PROXY.replace('firebase-proxy','plaid-link'), {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_dhToken},
      body: JSON.stringify({ action:'list_items', orgId:ORG_ID })
    });
    const data = await resp.json();
    const items = data.items || [];
    if(!items.length){
      listEl.innerHTML='<div style="font-size:12px;color:var(--muted);margin-bottom:6px">No bank accounts connected yet.</div>';
      if(syncArea) syncArea.style.display='none';
      return;
    }
    if(syncArea) syncArea.style.display='block';
    listEl.innerHTML = items.map(i=>`<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;background:var(--navy-lift);border-radius:10px;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px">
        <div style="width:8px;height:8px;border-radius:50%;background:${i.country==='CA'?'var(--green)':'var(--blue-bright)'}"></div>
        <span style="font-size:13px;font-weight:600;color:var(--offwhite)">${i.label}</span>
        <span style="font-size:10px;color:var(--muted);background:var(--navy-mid);padding:2px 8px;border-radius:6px">${i.country}</span>
      </div>
      <button onclick="plaidRemoveItem('${i.item_id}','${i.label}')" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0 4px" title="Disconnect">×</button>
    </div>`).join('');
  } catch(e) {
    console.error('plaidLoadItems error:', e);
    listEl.innerHTML='<div style="font-size:12px;color:var(--red)">Failed to load bank accounts.</div>';
  }
}

async function plaidRemoveItem(itemId, label) {
  if(!confirm('Disconnect '+label+'? This will stop syncing transactions from this account.')) return;
  try {
    await fetch(_PROXY.replace('firebase-proxy','plaid-link'), {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_dhToken},
      body: JSON.stringify({ action:'remove_item', orgId:ORG_ID, itemId })
    });
    showDhToast(label+' disconnected','success');
    plaidLoadItems();
  } catch(e) {
    showDhToast('Failed to disconnect','error');
  }
}

async function plaidSyncTransactions() {
  const statusEl = document.getElementById('plaid-sync-status');
  if(statusEl) statusEl.textContent = 'Syncing...';
  try {
    const itemsResp = await fetch(_PROXY.replace('firebase-proxy','plaid-link'), {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':'Bearer '+_dhToken},
      body: JSON.stringify({ action:'list_items', orgId:ORG_ID })
    });
    const itemsData = await itemsResp.json();
    const items = itemsData.items || [];
    if(!items.length){ if(statusEl) statusEl.textContent='No accounts connected'; return; }

    let totalNew = 0;
    for(const item of items) {
      const resp = await fetch(_PROXY.replace('firebase-proxy','plaid-sync'), {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+_dhToken},
        body: JSON.stringify({ orgId:ORG_ID, itemId:item.item_id })
      });
      const data = await resp.json();
      if(data.transactions) {
        const existingIds = new Set(expenses.map(e=>e.plaid_id).filter(Boolean));
        const newTxs = data.transactions.filter(tx => !existingIds.has(tx.plaid_id) && !tx.pending);
        for(const tx of newTxs) {
          expenses.push({
            id: Date.now() + Math.random(),
            date: tx.date,
            vendor: tx.vendor,
            amount: Math.abs(tx.amount),
            cat: tx.cat,
            market: tx.country === 'CA' ? 'canada' : (localStorage.getItem('dh_fin_market') || 'us'),
            plaid_id: tx.plaid_id,
            source: 'plaid',
          });
        }
        totalNew += newTxs.length;
      }
    }

    localStorage.setItem('dronehub_expenses', JSON.stringify(expenses));
    if(typeof fbSet==='function') fbSet(ORG_ID+':expenses', expenses);
    if(statusEl) statusEl.textContent = totalNew > 0 ? totalNew+' new transactions imported' : 'All up to date';
    if(totalNew > 0) {
      renderExpenseList();
      renderFinance();
      showDhToast(totalNew+' transactions synced from bank','success');
    }
  } catch(e) {
    console.error('plaidSync error:', e);
    if(statusEl) statusEl.textContent = 'Sync failed';
    showDhToast('Transaction sync failed','error');
  }
}

