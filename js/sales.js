
// ── Early variable declarations ───────────────────────────────────────────────
// These must be declared BEFORE the initialization block (lines below) because
// gateInit() → gateEnterApp() → gateShowAdminView() can run synchronously
// (when Firebase is offline) and call renderSalesTable() / pricingLoad()
// before the parser reaches the original let statements further down.
let salesActiveList  = 'realestate';
let _salesClientSub  = 'all';
let _salesOtherType  = 'all';
let _salesQuickFilter = null; // 'warm' | 'unsubscribed' | 'dne' | null — stat-chip quick-filter
let salesSortCol     = 'name';
let salesSortDir     = 'asc';
let salesView        = 'clients';
let _salesPage       = 0;          // current pagination page (0-based)
const _SALES_PAGE_SIZE = 500;      // contacts rendered per page — safe DOM limit
let _salesSessionSynced = false;   // true after first forced full-sync on Sales pane open
let _pricingConfig   = null;
// salesLoad() (called synchronously by renderSalesTable() during the gateInit()
// chain below) needs all three of these — moved up from their original spot
// further down the file to avoid "Cannot access before initialization" when
// the restored pane on page load is Sales/Contacts.
const SALES_LISTS = ['realestate','golf','resorts','other','warm','clients'];
let _salesByList = { realestate:null, golf:null, resorts:null, other:null, warm:null, clients:null };

// ── Bidirectional sync: Sales > Clients tab ↔ Sales CRM "Existing Clients" ──

// Sync a client record → create/update matching CRM contact in 'clients' list
function syncClientToSalesCRM(client){
  if(!client) return;
  const all=salesLoad();
  // Find by linked _clientId first, then by email
  let idx=all.findIndex(c=>c._clientId===client.id);
  if(idx<0 && client.email) idx=all.findIndex(c=>c.list==='clients'&&c.email&&c.email.toLowerCase()===client.email.toLowerCase());
  const nameParts=(client.name||'').trim().split(/\s+/);
  const firstName=nameParts[0]||'';
  const lastName=nameParts.slice(1).join(' ');
  if(idx>=0){
    const c=all[idx];
    // Always push latest client-tab values to the CRM contact
    if(firstName||lastName){ c.firstName=firstName; c.lastName=lastName; }
    if(client.company) c.company=client.company;
    if(client.phone)   c.phone=client.phone;
    if(client.email)   c.email=client.email;
    c.list='clients';
    c._clientId=client.id;
    // Sync active/inactive status → clientType (unless user manually overrode in CRM)
    if(!c._clientTypeManual){
      c.clientType=client.status==='inactive'?'past':'active';
    }
  } else {
    const newContact={
      id:'sc_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
      firstName, lastName,
      company:client.company||'',
      phone:client.phone||'',
      email:client.email||'',
      list:'clients', status:'client',
      notes:'', clientType:client.status==='inactive'?'past':'active',
      _clientTypeManual:false, doNotEmail:false, unsubscribed:false,
      createdAt:client.createdAt||new Date().toISOString(),
      _clientId:client.id,
    };
    all.push(newContact);
    // Back-link the sales ID onto the client record and persist
    client._salesId=newContact.id;
    saveClientsToStorage(); // persist the _salesId back-link
  }
  salesSave(all);
}

// Bulk sync ALL clients → Sales CRM Existing Clients list (fills in missing entries)
function syncAllClientsToCRM(){
  if(!clients||!clients.length) return;
  const all=salesLoad();
  let changed=false;
  clients.forEach(client=>{
    if(!client||client._deleted) return;
    // Find by back-link, then by email
    let idx=all.findIndex(c=>c._clientId===client.id);
    if(idx<0 && client.email) idx=all.findIndex(c=>c.list==='clients'&&c.email&&c.email.toLowerCase()===client.email.toLowerCase());
    const nameParts=(client.name||'').trim().split(/\s+/);
    const firstName=nameParts[0]||'';
    const lastName=nameParts.slice(1).join(' ');
    if(idx>=0){
      const c=all[idx];
      // Ensure the contact is in the clients list and has the back-link
      if(c.list!=='clients'){ c.list='clients'; changed=true; }
      if(!c._clientId){ c._clientId=client.id; changed=true; }
      if(!c.firstName&&firstName){ c.firstName=firstName; changed=true; }
      if(!c.lastName&&lastName){ c.lastName=lastName; changed=true; }
      if(!c.company&&client.company){ c.company=client.company; changed=true; }
      if(!c.phone&&client.phone){ c.phone=client.phone; changed=true; }
      if(!c.email&&client.email){ c.email=client.email; changed=true; }
    } else {
      // Client has no CRM entry — create one
      const newContact={
        id:'sc_'+Date.now()+'_'+Math.random().toString(36).slice(2,7),
        firstName, lastName,
        company:client.company||'',
        phone:client.phone||'',
        email:client.email||'',
        list:'clients', status:'client',
        notes:'', clientType:client.status==='inactive'?'past':'active',
        _clientTypeManual:false, doNotEmail:false, unsubscribed:false,
        createdAt:client.createdAt||new Date().toISOString(),
        _clientId:client.id,
      };
      all.push(newContact);
      client._salesId=newContact.id;
      changed=true;
    }
  });
  if(changed){
    salesSave(all);
    saveClientsToStorage(); // persist any new _salesId back-links
  }
}

// Sync a CRM contact (list='clients') → create/update matching client record
function syncSalesCRMToClient(contact){
  if(!contact||contact.list!=='clients') return;
  // Re-load the full sales array so we can back-link and save
  const allSales=salesLoad();
  const sc=allSales.find(c=>c.id===contact.id)||contact;
  // Find by linked _salesId first, then by email
  let idx=clients.findIndex(c=>c._salesId===sc.id);
  if(idx<0 && sc.email) idx=clients.findIndex(c=>c.email&&c.email.toLowerCase()===sc.email.toLowerCase());
  const fullName=[sc.firstName,sc.lastName].filter(Boolean).join(' ');
  let clientsDirty=false, salesDirty=false;
  if(idx>=0){
    const c=clients[idx];
    // Always push latest CRM values to the client record (overwrite if source has a value)
    if(fullName)    { c.name=fullName;       clientsDirty=true; }
    if(sc.company)  { c.company=sc.company;  clientsDirty=true; }
    if(sc.email)    { c.email=sc.email;      clientsDirty=true; }
    if(sc.phone)    { c.phone=sc.phone;      clientsDirty=true; }
    if(c._salesId!==sc.id){ c._salesId=sc.id; clientsDirty=true; }
    // Sync active/past status
    const ns=sc.clientType==='past'?'inactive':'active';
    if(c.status!==ns){ c.status=ns; clientsDirty=true; }
    if(sc._clientId!==c.id){ sc._clientId=c.id; salesDirty=true; }
  } else {
    const newClient={
      id:'c'+Date.now(),
      name:fullName||sc.email||'Client',
      company:sc.company||'',
      email:sc.email||'',
      phone:sc.phone||'',
      website:'', accountNumber:'',
      address:'', address2:'', city:'', state:'', zip:'', country:'', currency:'',
      createdAt:new Date().toISOString().slice(0,10),
      status:'active',
      _salesId:sc.id,
    };
    clients.push(newClient);
    sc._clientId=newClient.id;
    clientsDirty=true; salesDirty=true;
  }
  if(clientsDirty) saveClientsToStorage();
  if(salesDirty) salesSave(allSales);
}

// Batch sync: all CRM contacts with list='clients' → Clients tab.
// Used after bulk import so every imported client appears in the Clients tab
// without triggering a separate salesSave per contact.
function syncCRMClientsToTab(crmContacts){
  if(!crmContacts || !crmContacts.length) return;
  let clientsDirty = false;
  const salesBackLinks = {}; // crmContactId → clientId (for back-linking)

  crmContacts.forEach(sc => {
    if(!sc || sc.list !== 'clients') return;
    const fullName = [sc.firstName, sc.lastName].filter(Boolean).join(' ');
    let idx = clients.findIndex(c => c._salesId === sc.id);
    if(idx < 0 && sc.email) idx = clients.findIndex(c => c.email && c.email.toLowerCase() === sc.email.toLowerCase());

    if(idx >= 0){
      const c = clients[idx];
      if(!c.name && fullName)    { c.name    = fullName;     clientsDirty = true; }
      if(!c.company && sc.company){ c.company = sc.company;  clientsDirty = true; }
      if(!c.email && sc.email)   { c.email   = sc.email;     clientsDirty = true; }
      if(!c.phone && sc.phone)   { c.phone   = sc.phone;     clientsDirty = true; }
      if(c._salesId !== sc.id)   { c._salesId = sc.id;       clientsDirty = true; }
      if(sc._clientTypeManual){
        const ns = sc.clientType === 'past' ? 'inactive' : 'active';
        if(c.status !== ns){ c.status = ns; clientsDirty = true; }
      }
      salesBackLinks[sc.id] = c.id;
    } else {
      const newClient = {
        id: 'c' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
        name: fullName || sc.email || 'Client',
        company: sc.company || '',
        email: sc.email || '',
        phone: sc.phone || '',
        website: '', accountNumber: '',
        address: '', address2: '', city: sc.city || '', state: '', zip: '', country: '', currency: '',
        createdAt: sc.createdAt || new Date().toISOString().slice(0,10),
        status: sc.clientType === 'past' ? 'inactive' : 'active',
        _salesId: sc.id,
      };
      clients.push(newClient);
      salesBackLinks[sc.id] = newClient.id;
      clientsDirty = true;
    }
  });

  if(clientsDirty) saveClientsToStorage();

  // Write back _clientId links to CRM contacts in a single pass
  const all = salesLoad();
  let salesDirty = false;
  all.forEach(sc => {
    if(salesBackLinks[sc.id] && sc._clientId !== salesBackLinks[sc.id]){
      sc._clientId = salesBackLinks[sc.id];
      salesDirty = true;
    }
  });
  if(salesDirty) salesSave(all);
}

// ══════════════════════════════════════════════════════
// SALES CRM
// ══════════════════════════════════════════════════════

const SALES_LIST_DEFS = [
  {id:'realestate', label:'Real Estate'},
  {id:'resorts',    label:'Resorts'},
  {id:'golf',       label:'Golf Courses'},
  {id:'other',      label:'Other'},
  {id:'warm',       label:'Warm Leads'},
  {id:'clients',    label:'Existing Clients'},
];

// salesActiveList, _salesClientSub, _salesOtherType declared early above (TDZ fix)

// ── Recognized job types for the "Other" list ────────────────────────────────
const OTHER_TYPES = [
  { id:'landscape',    label:'Landscaping',                  color:'#22D97A' },
  { id:'construction', label:'Construction',                 color:'#F97316' },
  { id:'architects',   label:'Architects',                   color:'#5B7FDB' },
  { id:'interior',     label:'Interior Designers',           color:'#A78BFA' },
  { id:'builders',     label:'Builders',                     color:'#C084FC' },
  { id:'restaurants',  label:'Restaurants',                  color:'#FB923C' },
  { id:'retail',       label:'Retail',                       color:'#F5C842' },
  { id:'events',       label:'Events',                       color:'#E879F9' },
  { id:'sports',       label:'Sports',                       color:'#FF2D55' },
  { id:'weddings',     label:'Weddings',                     color:'#F472B6' },
  { id:'automotive',   label:'Automotive',                   color:'#60A5FA' },
  { id:'hospitality',  label:'Hospitality',                  color:'#34D399' },
  { id:'healthcare',   label:'Healthcare',                   color:'#F87171' },
];

// Normalize a freeform type string to the nearest OTHER_TYPES id
function normalizeOtherType(raw){
  if(!raw) return '';
  const s = raw.toLowerCase().trim();
  // Exact id match
  const exact = OTHER_TYPES.find(t=>t.id===s);
  if(exact) return exact.id;
  // Label match (case-insensitive)
  const byLabel = OTHER_TYPES.find(t=>t.label.toLowerCase()===s);
  if(byLabel) return byLabel.id;
  // Keyword heuristics
  if(/landscap|garden|lawn|outdoor|turf/.test(s))              return 'landscape';
  if(/construct|contactor|general contractor|build|develop/.test(s)) return 'construction';
  if(/architect|arch\b/.test(s))                                return 'architects';
  if(/interior|designer/.test(s))                               return 'interior';
  if(/\bbuilder|home build|custom home|renovation|reno/.test(s)) return 'builders';
  if(/restaurant|café|cafe|dining|food|bar\b/.test(s))          return 'restaurants';
  if(/retail|store|shop|boutique/.test(s))                      return 'retail';
  if(/wedding|bridal|bride|groom/.test(s))                      return 'weddings';
  if(/event|entertain|concert/.test(s))                         return 'events';
  if(/sport|rec(reation)?|athlet/.test(s))                      return 'sports';
  if(/auto|car|vehicle|dealer|motor/.test(s))                   return 'automotive';
  if(/hotel|motel|resort|hospit|inn\b|lodge/.test(s))           return 'hospitality';
  if(/health|medical|clinic|dental|pharma/.test(s))             return 'healthcare';
  return raw; // keep original if no match — fall through to unclassified badge style
}
let salesEditingId   = null;
let _scDNE           = false; // tracks Do Not Email toggle state in the add/edit modal
// salesSortCol, salesSortDir declared early above (TDZ fix)

// Split a full name typed into the first-name field when last name is blank.
// 2 words  → "John Smith"       → {firstName:'John', lastName:'Smith'}
// 3+ words → "Mary Jane Smith"  → {firstName:'Mary Jane', lastName:'Smith'}
// 1 word   → unchanged
function splitSalesName(fn, ln){
  fn = (fn||'').trim();
  ln = (ln||'').trim();
  if(ln || !fn.includes(' ')) return {firstName:fn, lastName:ln};
  const parts = fn.split(/\s+/);
  if(parts.length === 2) return {firstName:parts[0], lastName:parts[1]};
  // 3+ words: first two = firstName, rest = lastName
  return {firstName:parts.slice(0,2).join(' '), lastName:parts.slice(2).join(' ')};
}

// Auto-extract company name from last name if it contains " - Company" pattern.
// e.g. lastName = "Gonsenhauser - Harvey Kalles Real Estate"
//   → { firstName, lastName: "Gonsenhauser", company: "Harvey Kalles Real Estate" }
// Returns unchanged names if no " - " pattern is detected.
function _salesExtractCompanyFromLastName(firstName, lastName){
  if(!(lastName||'').includes(' - ')){
    return {firstName, lastName, company:''};
  }
  const parts = lastName.split(' - ');
  const cleanLast = parts[0].trim();
  const extractedCompany = parts.slice(1).join(' - ').trim();
  return {firstName, lastName:cleanLast, company:extractedCompany};
}

// One-time silent migration: scan all contacts and auto-clean any
// "LastName - Company Name" patterns without requiring user interaction.
// Runs once per browser (guarded by localStorage flag) shortly after login.
async function _salesAutoCleanCompanyNames(){
  const FLAG = 'dh_sales_company_clean_v1';
  if(localStorage.getItem(FLAG)) return;
  await salesEnsureLoaded();
  const all = salesLoad();
  let fixed = 0;
  all.forEach(c => {
    if(!(c.lastName||'').includes(' - ')) return;
    const {lastName:cleanLn, company:extracted} = _salesExtractCompanyFromLastName(c.firstName||'', c.lastName||'');
    c.lastName = cleanLn;
    if(extracted && !c.company) c.company = extracted;
    else if(extracted && c.company !== extracted) c.company = extracted; // last name pattern is authoritative
    c.updatedAt = new Date().toISOString();
    fixed++;
  });
  if(fixed > 0){
    salesSave(all);
    if(typeof renderSalesTable === 'function') renderSalesTable();
    console.log('[salesAutoClean] Cleaned company names for',fixed,'contacts');
  }
  localStorage.setItem(FLAG,'1');
}

function salesFixUnsplitNames(){
  const all = salesLoad();
  let anyFixed = false;

  // ── Pass 1: firstName contains a full name (lastName is blank) ──────────────
  const nameCandidates = all.filter(c => !(c.lastName||'').trim() && (c.firstName||'').trim().includes(' '));
  if(nameCandidates.length){
    const preview = nameCandidates.slice(0,5).map(c=>{
      const {firstName:newFn, lastName:newLn} = splitSalesName(c.firstName, '');
      return `"${c.firstName}" → First: "${newFn}"  Last: "${newLn}"`;
    }).join('\n');
    const moreNote = nameCandidates.length > 5 ? `\n…and ${nameCandidates.length - 5} more` : '';
    if(confirm(
      `Found ${nameCandidates.length} contact${nameCandidates.length!==1?'s':''} with an unsplit full name.\n\n` +
      `Rule:\n• 2 words → word 1 = First, word 2 = Last\n• 3+ words → words 1–2 = First, remaining = Last\n\n` +
      `Preview:\n${preview}${moreNote}\n\nApply to all ${nameCandidates.length} contact${nameCandidates.length!==1?'s':''}?`
    )){
      let fixed = 0;
      all.forEach(c => {
        if((c.lastName||'').trim() || !(c.firstName||'').trim().includes(' ')) return;
        const {firstName: newFn, lastName: newLn} = splitSalesName(c.firstName, '');
        c.firstName = newFn; c.lastName = newLn; c.updatedAt = new Date().toISOString();
        fixed++;
      });
      anyFixed = true;
      showDhToast(`Fixed ${fixed} name${fixed!==1?'s':''}`, `First and last names separated across ${fixed} contact${fixed!==1?'s':''}.`, '✅', 'var(--green)', 4000);
    }
  }

  // ── Pass 2: lastName contains " - Company Name" pattern ────────────────────
  // e.g. lastName = "Gonsenhauser - Harvey Kalles Real Estate"
  // → clean lastName to "Gonsenhauser", always set Company to extracted value
  //   (overrides existing company if different — last name pattern is more reliable)
  const dashCandidates = all.filter(c => (c.lastName||'').includes(' - '));
  if(dashCandidates.length){
    const preview2 = dashCandidates.slice(0,5).map(c=>{
      const parts   = (c.lastName||'').split(' - ');
      const cleanLn = parts[0].trim();
      const coBit   = parts.slice(1).join(' - ').trim();
      const coAction = c.company && c.company !== coBit
        ? `Company: "${c.company}" → "${coBit}"`
        : `Company → "${coBit}"`;
      return `"${c.firstName} ${c.lastName}" → Last: "${cleanLn}"  ${coAction}`;
    }).join('\n');
    const overrideCount = dashCandidates.filter(c => c.company && c.company !== (c.lastName||'').split(' - ').slice(1).join(' - ').trim()).length;
    const moreNote2 = dashCandidates.length > 5 ? `\n…and ${dashCandidates.length - 5} more` : '';
    const overrideNote = overrideCount > 0 ? `\n\n${overrideCount} contact${overrideCount!==1?'s have':' has'} an existing Company that will be replaced with the value from the Last Name field.` : '';
    if(confirm(
      `Found ${dashCandidates.length} contact${dashCandidates.length!==1?'s':''} where the Last Name contains " - [Company]".\n\n` +
      `This will clean the last name and set the Company field to the extracted value.${overrideNote}\n\n` +
      `Preview:\n${preview2}${moreNote2}\n\nApply to all ${dashCandidates.length} contact${dashCandidates.length!==1?'s':''}?`
    )){
      let fixed2 = 0;
      all.forEach(c => {
        if(!(c.lastName||'').includes(' - ')) return;
        const parts  = (c.lastName||'').split(' - ');
        const coBit  = parts.slice(1).join(' - ').trim();
        c.lastName   = parts[0].trim();
        if(coBit) c.company = coBit; // always update — extracted value is the source of truth
        c.updatedAt  = new Date().toISOString();
        fixed2++;
      });
      anyFixed = true;
      showDhToast(`Cleaned ${fixed2} last name${fixed2!==1?'s':''}`, `Company names extracted from last name field for ${fixed2} contact${fixed2!==1?'s':''}.`, '✅', 'var(--green)', 4000);
    }
  }

  if(!nameCandidates.length && !dashCandidates.length){
    showDhToast('No names to fix', 'All contacts already have clean, separated names.', '✅', 'var(--green)', 4000);
    return;
  }

  if(anyFixed){
    salesSave(all);
    renderSalesTable();
  }
}

function setSalesSort(col){
  if(salesSortCol === col){
    salesSortDir = salesSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    salesSortCol = col;
    salesSortDir = 'asc';
  }
  renderSalesTable();
}

function applySalesSortHeaders(){
  const cols = ['name','company','city','email','status'];
  cols.forEach(col=>{
    const th = document.getElementById('sth-'+col);
    if(!th) return;
    const arrow = th.querySelector('.sort-arrow');
    th.classList.remove('sort-asc','sort-desc');
    if(salesSortCol === col){
      th.classList.add(salesSortDir === 'asc' ? 'sort-asc' : 'sort-desc');
      if(arrow) arrow.textContent = salesSortDir === 'asc' ? '↑' : '↓';
    } else {
      if(arrow) arrow.textContent = '↕';
    }
  });
}

// ── In-memory contacts store — split by list, one Firebase doc per list ──────
// Firebase keys: dronehub_main:sales_realestate, :sales_golf, :sales_resorts,
//                :sales_other, :sales_warm, :sales_clients
// This avoids Firestore's 1MB per-document limit and keeps lists independent.
// SALES_LISTS / _salesByList / _salesUpdatedAt now declared in the early block
// near the top of this script (search "moved up from their original spot").

function _salesFbKey(listId){ return ORG_ID + ':sales_' + listId; }
function _salesLsKey(listId){ return 'dh_sales_cache_' + listId; }

// ── localStorage cache helpers ────────────────────────────────────────────────
// Writes a list to localStorage so it survives token expiry / page reloads.
// Only stores up to 1.5 MB per list to avoid QuotaExceededError.
function _salesCacheWrite(listId, arr){
  try{
    const json = JSON.stringify(arr);
    if(json.length <= 1500000) localStorage.setItem(_salesLsKey(listId), json);
  }catch(e){}
}
// Reads a list from localStorage cache. Returns null if absent.
function _salesCacheRead(listId){
  try{
    const raw = localStorage.getItem(_salesLsKey(listId));
    return raw ? JSON.parse(raw) : null;
  }catch(e){ return null; }
}

// Returns all contacts across all lists (for operations that need the full set)
function salesLoad(){
  return SALES_LISTS.flatMap(l => {
    if(_salesByList[l] !== null) return _salesByList[l];
    // Firebase not yet loaded — fall back to localStorage cache
    const cached = _salesCacheRead(l);
    if(cached) { _salesByList[l] = cached; } // populate memory from cache
    return _salesByList[l] || [];
  });
}

// Returns contacts for a specific list only
function salesLoadList(listId){
  return _salesByList[listId] || [];
}

// Save an entire list to memory + Firebase
let _salesSaveStatusTimer = null;
let _salesSavePending = 0; // track concurrent saves so status clears only when all done
function _showSalesSaveStatus(state, msg){
  const el = document.getElementById('sales-save-status');
  if(!el) return;
  clearTimeout(_salesSaveStatusTimer);
  if(state === 'saving'){
    _salesSavePending++;
    el.textContent = '⟳ Saving…';
    el.style.color = 'var(--muted)';
  } else if(state === 'saved'){
    _salesSavePending = Math.max(0, _salesSavePending - 1);
    if(_salesSavePending === 0){
      el.textContent = '✓ Saved';
      el.style.color = 'var(--green)';
      _salesSaveStatusTimer = setTimeout(()=>{ if(el) el.textContent=''; }, 3000);
    }
  } else if(state === 'error'){
    _salesSavePending = Math.max(0, _salesSavePending - 1);
    el.title = msg || '';
    el.textContent = '⚠ Save failed' + (msg ? ` (${msg})` : ' — check connection');
    el.style.color = '#FF7070';
    el.style.cursor = 'help';
    // Keep the error visible until next successful save
  }
}

// Firestore hard limit is 1MB per document. We leave a safe margin and chunk
// any list whose JSON exceeds this threshold across numbered part docs.
const _SALES_CHUNK_BYTES = 900000; // 900 KB per chunk (Firestore 1 MB doc limit, ~100 KB headroom for field overhead)

function _salesChunkSplit(arr){
  const chunks = [];
  let i = 0;
  while(i < arr.length){
    let lo = i, hi = arr.length;
    // Binary-search the largest slice that fits in one chunk
    while(lo < hi - 1){
      const mid = (lo + hi) >> 1;
      JSON.stringify(arr.slice(i, mid)).length <= _SALES_CHUNK_BYTES ? (lo=mid) : (hi=mid);
    }
    // Guarantee progress even for a single oversized contact
    const end = lo > i ? lo : i + 1;
    chunks.push(arr.slice(i, end));
    i = end;
  }
  return chunks;
}

// Read a potentially-chunked list doc from Firebase and return the merged array.
// fb is the result of fbGet(key) — has {data?, chunks?, updatedAt?}.
async function _salesReadChunked(fb, fbKey){
  if(!fb) return null;
  const numChunks = fb.chunks || 1;
  if(numChunks <= 1){
    return fb.data ? JSON.parse(fb.data) : null;
  }
  // Load all part docs in parallel
  const parts = await Promise.all(
    Array.from({length: numChunks}, (_, i) => fbGet('orgs', fbKey+'_part'+i).catch(()=>null))
  );
  return parts.flatMap(p=>{ try{ return p?.data ? JSON.parse(p.data) : []; }catch(e){ return []; } });
}

function salesSaveList(listId, arr){
  const now = Date.now();
  _salesByList[listId] = arr;
  _salesUpdatedAt[listId] = now;
  _salesCacheWrite(listId, arr); // keep localStorage cache in sync

  _showSalesSaveStatus('saving');

  const fbKey = _salesFbKey(listId);
  const doSync = async () => {
    try{
      const json = JSON.stringify(arr);
      if(json.length <= _SALES_CHUNK_BYTES){
        // Single document — also clear any stale chunk parts from a previous chunked write
        await fbSetStrict('orgs', fbKey, {data: json, updatedAt: now, chunks: 1});
        // Best-effort cleanup of old part docs (fire and forget)
        for(let i=0;i<20;i++) fbDelete('orgs', fbKey+'_part'+i).catch(()=>{});
      } else {
        // Chunked write — split into ≤900KB parts and write all parts in parallel
        const chunks = _salesChunkSplit(arr);
        await Promise.all(
          chunks.map((chunk, i) =>
            fbSetStrict('orgs', fbKey+'_part'+i, {data: JSON.stringify(chunk), updatedAt: now})
          )
        );
        // Header doc written AFTER parts are all confirmed (readers check parts count from header)
        await fbSetStrict('orgs', fbKey, {data: null, chunks: chunks.length, updatedAt: now});
        // Cleanup any excess part docs from a previous write that had more chunks
        for(let i=chunks.length;i<chunks.length+10;i++) fbDelete('orgs', fbKey+'_part'+i).catch(()=>{});
      }
      _showSalesSaveStatus('saved');
    }catch(e){
      console.error('[salesSaveList] Firebase write failed for list "'+listId+'":', e.message);
      _showSalesSaveStatus('error', e.message);
    }
  };

  if(_fbToken()){
    doSync();
  } else {
    setTimeout(()=>{
      if(_fbToken()) doSync();
      else _showSalesSaveStatus('error');
    }, 2000);
  }
}

// Save the full cross-list array back by splitting into per-list buckets.
// Used by legacy callers that operate on the full array.
// SAFETY 1: skips lists still at null (not yet loaded — would wipe Firebase with empty data).
// SAFETY 2: only writes lists whose content actually changed — avoids spurious Firebase
//           writes (and "save failed" flashes) when e.g. syncAllClientsToCRM runs on a
//           pane that was already in sync.
function salesSave(arr){
  const byList = {};
  SALES_LISTS.forEach(l=>{ byList[l]=[]; });
  arr.forEach(c=>{ const l=c.list||'other'; if(byList[l]) byList[l].push(c); else byList['other'].push(c); });
  SALES_LISTS.forEach(l=>{
    if(_salesByList[l] === null) return; // not loaded yet — skip
    // NOTE: diff-check removed. salesLoad() returns the same object references that live
    // inside _salesByList, so callers that mutate contacts (c.x = ...) also silently
    // mutate _salesByList before salesSave() runs, making the diff always equal → silent
    // data loss. Always writing loaded lists is safe; Firebase writes are async and cheap
    // relative to losing contact edits.
    salesSaveList(l, byList[l]);
  });
}

// Ensure a specific list is loaded. If listId is omitted, loads all lists.
async function salesEnsureLoaded(listId){
  if(listId){
    if(_salesByList[listId] === null) await salesSyncFirebase(listId);
  } else {
    const missing = SALES_LISTS.filter(l=>_salesByList[l]===null);
    if(missing.length) await salesSyncFirebase();
  }
}

async function salesMigrateLocalStorage(){
  // One-time migration: split the old monolithic dronehub_main:sales document
  // into per-list documents.
  const raw = localStorage.getItem('dronehub_sales');
  let legacyFb = null;
  // Also check if Firebase still has the old monolithic doc
  try{
    const fb = await fbGet('orgs', ORG_ID+':sales').catch(()=>null);
    if(fb?.data) legacyFb = JSON.parse(fb.data);
  }catch(e){}

  let local = [];
  try{ if(raw && raw!=='[]') local = JSON.parse(raw); }catch(e){}

  // Merge localStorage + legacy Firebase into one set (dedupe by id)
  const allLegacy = [...(legacyFb||[])];
  const existingIds = new Set(allLegacy.map(c=>c.id));
  local.forEach(c=>{ if(c.id && !existingIds.has(c.id)){ allLegacy.push(c); existingIds.add(c.id); }});

  if(!allLegacy.length) return; // nothing to migrate

  // ── SAFETY: write a backup doc BEFORE touching anything else ────────────────
  const now = Date.now();
  try{
    await fbSet('orgs', ORG_ID+':sales_backup', {
      data: JSON.stringify(allLegacy),
      count: allLegacy.length,
      migratedAt: now,
      source: 'migration'
    });
  }catch(e){ console.warn('[salesMigrate] backup write failed — aborting migration to protect data', e); return; }

  // Split by list and write each to its own Firebase doc
  const byList = {};
  SALES_LISTS.forEach(l=>{ byList[l]=[]; });
  allLegacy.forEach(c=>{ const l=c.list||'other'; if(byList[l]) byList[l].push(c); else byList['other'].push(c); });

  const writeResults = {};
  const skipLists = new Set(); // Lists skipped because a per-list doc already has data
  for(const l of SALES_LISTS){
    if(byList[l].length){
      try{
        // ── CRITICAL SAFETY CHECK ────────────────────────────────────────────────
        // If a per-list Firebase doc already exists and has data, NEVER overwrite it
        // with the old monolithic migration data. A team member may have uploaded
        // contacts (e.g. 7,187 real-estate leads) after this user last had the app
        // open, and the old :sales doc is stale by comparison.
        // Only write to lists that have NO existing per-list doc yet.
        const existingDoc = await fbGet('orgs', _salesFbKey(l)).catch(()=>null);
        const existingHasData = existingDoc && (existingDoc.data || (existingDoc.chunks||0) > 1);
        if(existingHasData){
          writeResults[l] = true; // already populated — treat as done
          skipLists.add(l);
          continue;
        }
        await fbSet('orgs', _salesFbKey(l), {data: JSON.stringify(byList[l]), updatedAt: now});
        writeResults[l] = true;
      }catch(e){
        writeResults[l] = false;
        console.warn('[salesMigrate] per-list write failed for', l, e);
      }
    } else {
      writeResults[l] = true; // nothing to write = fine
    }
  }

  // ── VERIFY: read back at least one list that was actually written (not skipped) ─
  const listsWithData = SALES_LISTS.filter(l=>byList[l].length && !skipLists.has(l));
  let verified = true;
  if(listsWithData.length){
    try{
      const check = await fbGet('orgs', _salesFbKey(listsWithData[0]));
      verified = !!(check?.data && JSON.parse(check.data).length > 0);
    }catch(e){ verified = false; }
  }

  if(!verified || SALES_LISTS.some(l=>byList[l].length && !writeResults[l])){
    console.warn('[salesMigrate] write verification failed — leaving old sources intact for safety');
    return;
  }

  // Update in-memory cache ONLY for lists that were actually written (not skipped).
  // Lists that were skipped already have correct data in _salesByList from restoreFromFirebase.
  for(const l of SALES_LISTS){
    if(byList[l].length && !skipLists.has(l)){
      _salesByList[l] = byList[l];
      _salesUpdatedAt[l] = now;
    }
  }

  console.log(`salesMigrateLocalStorage: split ${allLegacy.length} contacts into per-list Firebase docs`);

  // Clean up old sources ONLY after successful verified writes
  localStorage.removeItem('dronehub_sales');
  localStorage.removeItem('dronehub_sales_updatedAt');
  // Overwrite the old monolithic Firebase doc (best-effort)
  if(legacyFb) fbSet('orgs', ORG_ID+':sales', {data:'[]', updatedAt:0}).catch(()=>{});
}

// Attempt to recover contacts from the migration backup doc.
// Returns the number of contacts recovered (0 = nothing found).
async function salesTryRecover(){
  if(!_fbToken()) return 0;
  try{
    const backup = await fbGet('orgs', ORG_ID+':sales_backup');
    if(!backup?.data) return 0;
    let contacts = [];
    try{ contacts = JSON.parse(backup.data); }catch(e){ return 0; }
    if(!Array.isArray(contacts) || !contacts.length) return 0;

    // Split by list
    const byList = {};
    SALES_LISTS.forEach(l=>{ byList[l]=[]; });
    contacts.forEach(c=>{ const l=c.list||'other'; if(byList[l]) byList[l].push(c); else byList['other'].push(c); });

    const now = Date.now();
    for(const l of SALES_LISTS){
      // Only restore to lists that are currently empty (don't overwrite real data)
      const currentEmpty = !_salesByList[l] || _salesByList[l].length === 0;
      if(currentEmpty && byList[l].length){
        try{
          await fbSet('orgs', _salesFbKey(l), {data: JSON.stringify(byList[l]), updatedAt: now});
          _salesByList[l] = byList[l];
          _salesUpdatedAt[l] = now;
        }catch(e){}
      }
    }
    return contacts.length;
  }catch(e){
    console.error('[salesTryRecover]', e);
    return 0;
  }
}

// UI wrapper for the recovery button — shows feedback to the user
async function salesRunRecovery(){
  const btn = document.querySelector('button[onclick="salesRunRecovery()"]');
  if(btn){ btn.disabled=true; btn.textContent='Searching…'; }
  try{
    const n = await salesTryRecover();
    if(n > 0){
      renderSalesTable();
      alert(`Recovered ${n} contact${n===1?'':'s'} from backup. Check each list for your contacts.`);
    } else {
      // Also try a fresh sync from Firebase before giving up
      await salesSyncFirebase();
      const total = SALES_LISTS.reduce((s,l)=>s+(_salesByList[l]||[]).length,0);
      if(total > 0){
        renderSalesTable();
        alert(`Found ${total} contact${total===1?'':'s'} after re-syncing from Firebase.`);
      } else {
        alert('No backup data was found. Your contacts may have been lost in a previous session.\n\nIf you have an Excel or CSV export, you can re-import via the Import button.');
        if(btn){ btn.disabled=false; btn.textContent='Try to Recover Contacts'; }
      }
    }
  }catch(e){
    alert('Recovery failed: '+e.message);
    if(btn){ btn.disabled=false; btn.textContent='Try to Recover Contacts'; }
  }
}

// Sync one or all lists from Firebase (handles chunked docs transparently)
async function salesSyncFirebase(listId, force=false){
  if(!_fbToken()) return;
  // Run one-time migration from old monolithic doc on first sync
  const needsMigration = SALES_LISTS.some(l=>_salesByList[l]===null);
  if(needsMigration) await salesMigrateLocalStorage();

  const listsToSync = listId ? [listId] : SALES_LISTS;
  for(const l of listsToSync){
    try{
      const fbKey = _salesFbKey(l);
      const fb = await fbGet('orgs', fbKey);
      const remoteTs = fb?.updatedAt || 0;
      // force=true bypasses the timestamp guard — always read fresh from Firebase.
      // Used on the first Sales pane open per session to catch uploads from other users.
      if(fb && (force || remoteTs > (_salesUpdatedAt[l]||0))){
        const data = await _salesReadChunked(fb, fbKey);
        if(data !== null){
          _salesByList[l] = data;
          _salesUpdatedAt[l] = remoteTs;
        }
      } else if(!fb){
        // Doc doesn't exist yet — initialise as empty
        if(_salesByList[l] === null) _salesByList[l] = [];
      } else if(_salesByList[l] === null){
        // Doc exists but isn't newer — still need to initialise memory
        const data = await _salesReadChunked(fb, fbKey);
        _salesByList[l] = data || [];
        _salesUpdatedAt[l] = remoteTs;
      }
    }catch(e){
      if(_salesByList[l] === null) _salesByList[l] = [];
    }
  }
}

// ── Live-sync polling ────────────────────────────────────────────────────────
// Runs every 15 s regardless of which pane is open.
// Only fetches & re-renders when the Sales pane is active AND Firebase has a
// newer timestamp than what's already in memory — zero flicker otherwise.
// Background lists (not currently being viewed) are checked far less often
// than the active list to avoid burning the Firestore daily read quota —
// each tick is 1 read per list checked, and this used to check ALL lists
// every 15s regardless of which one (if any) the user was looking at.
let _salesSyncTickCount = 0;
const _SALES_BG_SYNC_EVERY_N_TICKS = 5; // background lists refresh every 5th tick
async function _salesLiveSyncTick(forceListId){
  if(!_fbToken()) return;
  const salesPane = document.getElementById('pane-sales');
  if(!salesPane?.classList.contains('active') && !forceListId) return; // not on Sales page, skip

  _salesSyncTickCount++;
  const checkBackground = forceListId ? false : (_salesSyncTickCount % _SALES_BG_SYNC_EVERY_N_TICKS === 0);

  let changed = false;
  // Active (visible) list every tick; background lists only every Nth tick —
  // or immediately for forceListId when the user just switched to a list.
  const toCheck = forceListId ? [forceListId]
    : checkBackground ? SALES_LISTS
    : [salesActiveList];

  for(const l of toCheck){
    try{
      const fbKey = _salesFbKey(l);
      const doc = await fbGet('orgs', fbKey);
      if(doc){
        const remoteTs = doc.updatedAt || 0;
        if(remoteTs > (_salesUpdatedAt[l] || 0)){
          const data = await _salesReadChunked(doc, fbKey);
          if(data !== null){
            _salesByList[l] = data;
            _salesUpdatedAt[l] = remoteTs;
            if(l === salesActiveList) changed = true;
          }
        }
      }
    }catch(e){}
  }

  if(changed) renderSalesTable();
}

// Start once after login — never stopped; pane-visibility check inside the tick
function salesInitLiveSync(){
  setInterval(_salesLiveSyncTick, 60000); // every 60 s (was 15s — see _salesLiveSyncTick comment)
}

function setSalesList(listId){
  salesActiveList = listId;
  // Background lists only refresh every 5th tick now (see _salesLiveSyncTick),
  // so force an immediate check of the list the user just switched to —
  // otherwise it could show stale data for a few minutes after switching.
  _salesLiveSyncTick(listId).catch(()=>{});
  _salesPage = 0; // reset to first page when switching lists
  try{localStorage.setItem('dronehub_sales_list', listId);}catch(e){}
  if(listId !== 'clients') _salesClientSub = 'all';
  _salesOtherType = 'all'; // reset type filter on every tab switch
  _salesQuickFilter = null; // clear stat-chip quick-filter on list switch
  document.querySelectorAll('.sales-list-tab').forEach(b=>{
    b.classList.toggle('active', b.id === 'sltab-'+listId);
  });
  // Reset select-all checkbox
  const sa = document.getElementById('sales-select-all');
  if(sa) sa.checked = false;
  // Auto-detect client types and sync from main Clients tab when entering clients list.
  // Must run AFTER all lists are loaded from Firebase so salesSave doesn't clobber
  // unloaded lists with empty arrays.
  if(listId === 'clients'){
    salesEnsureLoaded().then(()=>{
      syncAllClientsToCRM();
      const allContacts = salesLoad();
      if(salesAutoDetectClientTypes(allContacts)) salesSave(allContacts);
      renderSalesTable();
    });
  } else {
    renderSalesTable();
  }
}

function renderSales(){
  renderSalesTable(); // immediate paint with whatever is already in memory
  if(salesView==='pipeline') renderDealsTable();
  // Load from Firebase first, THEN sync clients so salesSave never runs
  // against partially-loaded lists.
  // On the first open per session, force a full fresh read from Firebase so any
  // contacts uploaded by other team members (e.g. Mackenzie's bulk upload) are
  // immediately visible — even if restoreFromFirebase already ran with stale data.
  const forceRefresh = !_salesSessionSynced;
  _salesSessionSynced = true;
  salesSyncFirebase(null, forceRefresh).then(()=>{
    // Bootstrap: if Clients tab is empty but CRM has Existing Clients, populate it now
    if(!clients.length){
      const crmClients = salesLoad().filter(c=>c.list==='clients'&&!c._deleted);
      if(crmClients.length){
        syncCRMClientsToTab(crmClients);
        renderClients();
      }
    }
    syncAllClientsToCRM();
    renderSalesTable();
  });
  dealsSyncFirebase && dealsSyncFirebase().then(()=>{ if(salesView==='pipeline') renderDealsTable(); }).catch(()=>{});
}

// Auto-classify unclassified Other contacts by inferring type from company name
function salesAutoClassifyOther(){
  const all = salesLoad();
  let changed = 0;
  all.forEach(c=>{
    if(c.list !== 'other') return;
    if(c.field && OTHER_TYPES.find(t=>t.id===normalizeOtherType(c.field))) return; // already classified
    // Try to infer from company name or existing field value
    const guessStr = [c.company||'', c.field||''].join(' ').trim();
    const guessed = normalizeOtherType(guessStr);
    if(guessed){
      c.field = guessed;
      changed++;
    }
  });
  if(changed > 0){
    salesSave(all);
    renderSalesTable();
    // Brief toast
    const t=document.createElement('div');
    t.textContent=`Auto-classified ${changed} contact${changed===1?'':'s'}`;
    Object.assign(t.style,{position:'fixed',bottom:'24px',left:'50%',transform:'translateX(-50%)',background:'#22D97A',color:'#0D1117',padding:'10px 22px',borderRadius:'24px',fontWeight:'700',fontSize:'13px',zIndex:'9999',boxShadow:'0 4px 20px rgba(0,0,0,.4)'});
    document.body.appendChild(t);
    setTimeout(()=>t.remove(),3000);
  } else {
    alert('No contacts could be automatically classified from their company name.');
  }
}

function salesAutoDetectClientTypes(allContacts){
  // Returns true if any record was changed (so caller can save)
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  let changed = false;
  allContacts.forEach(c=>{
    if(c.list !== 'clients' || c._deleted) return;
    if(c._clientTypeManual) return; // user manually set — don't overwrite
    const hasRecentJob = (savedJobs||[]).some(j=>{
      if(j.clientId !== c.id) return false;
      const d = new Date(j.completedAt||j.createdAt||j.date||0);
      return d >= oneYearAgo;
    });
    const detected = hasRecentJob ? 'active' : (c.clientType || 'active');
    if(c.clientType !== detected){ c.clientType = detected; changed = true; }
  });
  return changed;
}

function escSalesHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function escSalesAttr(s){ return String(s||'').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

function salesCheckChanged(){
  const checked = document.querySelectorAll('.sales-row-check:checked');
  const n = checked.length;
  // Bottom bar
  const bulk = document.getElementById('sales-bulk-actions');
  const selLabel = document.getElementById('sales-selected-label');
  if(bulk) bulk.style.display = n ? 'flex' : 'none';
  if(selLabel) selLabel.textContent = `${n} selected`;
  // Top bar
  const bulkTop = document.getElementById('sales-bulk-actions-top');
  const selLabelTop = document.getElementById('sales-selected-label-top');
  if(bulkTop) bulkTop.style.display = n ? 'flex' : 'none';
  if(selLabelTop) selLabelTop.textContent = `${n} selected`;
  // Sync select-all checkbox state
  const sa = document.getElementById('sales-select-all');
  const all = document.querySelectorAll('.sales-row-check');
  if(sa) sa.indeterminate = n > 0 && n < all.length;
  if(sa && n === all.length && all.length > 0) sa.checked = true;
}

function salesToggleAll(checked){
  document.querySelectorAll('.sales-row-check').forEach(cb=>cb.checked=checked);
  salesCheckChanged();
}

function salesSelectedIds(){
  return Array.from(document.querySelectorAll('.sales-row-check:checked')).map(cb=>cb.dataset.id);
}

async function salesMoveSelected(){
  const ids  = salesSelectedIds();
  const dest = document.getElementById('sales-move-target-top')?.value ||
               document.getElementById('sales-move-target')?.value;
  if(!dest || !ids.length) return;
  await salesEnsureLoaded();
  const all  = salesLoad();
  ids.forEach(id=>{ const c = all.find(x=>x.id===id); if(c) c.list = dest; });
  salesSave(all);
  // Sync contacts moved to Existing Clients
  if(dest==='clients'){
    ids.forEach(id=>{ const c=all.find(x=>x.id===id); if(c) syncSalesCRMToClient(c); });
    if(typeof renderClients==='function') renderClients();
  }
  renderSalesTable();
}

async function salesUnsubSelected(){
  const ids = salesSelectedIds();
  if(!ids.length) return;
  await salesEnsureLoaded();
  const all = salesLoad();
  ids.forEach(id=>{ const c = all.find(x=>x.id===id); if(c) c.unsubscribed = true; });
  salesSave(all);
  renderSalesTable();
}

async function salesDeleteSelected(){
  const ids = salesSelectedIds();
  if(!ids.length) return;
  if(!confirm(`Delete ${ids.length} contact(s)? This cannot be undone.`)) return;
  await salesEnsureLoaded();
  const all = salesLoad().filter(c=>!ids.includes(c.id));
  salesSave(all);
  renderSalesTable();
}

async function salesToggleUnsub(id){
  await salesEnsureLoaded();
  const all = salesLoad();
  const c   = all.find(x=>x.id===id);
  if(!c) return;
  c.unsubscribed = !c.unsubscribed;
  salesSave(all);
  renderSalesTable();
}

async function salesToggleDNE(id){
  await salesEnsureLoaded();
  const all = salesLoad();
  const idx = all.findIndex(x=>x.id===id);
  if(idx<0) return;
  const updated = {...all[idx], doNotEmail: !all[idx].doNotEmail};
  all[idx] = updated; // break reference so diff-check fires
  salesSave(all);
  renderSalesTable();
}

async function salesToggleClientType(id){
  await salesEnsureLoaded();
  const all = salesLoad();
  const idx = all.findIndex(x=>x.id===id);
  if(idx<0) return;
  const updated = {...all[idx],
    clientType: (all[idx].clientType||'active') === 'active' ? 'past' : 'active',
    _clientTypeManual: true,
  };
  all[idx] = updated; // break reference so diff-check fires
  salesSave(all);
  renderSalesTable();
}

// Notes cell in the Contacts table is truncated to keep the column narrow —
// click it to read/edit/add the full note in a modal instead.
function salesShowNotesModal(id){
  const existing = document.getElementById('sales-notes-modal');
  if(existing) existing.remove();
  const all = salesLoad();
  const c = all.find(x=>x.id===id);
  if(!c) return;
  const name = [c.firstName,c.lastName].filter(Boolean).join(' ')||'Contact';
  const modal = document.createElement('div');
  modal.id = 'sales-notes-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9700;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  modal.innerHTML = `<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:420px;border:1px solid var(--border-bright);overflow:hidden" onclick="event.stopPropagation()">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
      <div style="font-size:14px;font-weight:700;color:var(--white)">Notes</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">${escSalesHtml(name)}</div>
    </div>
    <div style="padding:16px 20px">
      <textarea id="sales-notes-modal-textarea" rows="6" placeholder="Add a note about this contact…" style="width:100%;box-sizing:border-box;padding:10px 12px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white);resize:vertical;line-height:1.5">${c.notes||''}</textarea>
    </div>
    <div style="padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px">
      <button onclick="document.getElementById('sales-notes-modal').remove()" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer">Cancel</button>
      <button onclick="salesSaveNotesModal('${escSalesAttr(id)}')" style="padding:8px 20px;border-radius:10px;border:1px solid var(--green);background:var(--green-bg);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">Save ✓</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
  setTimeout(()=>document.getElementById('sales-notes-modal-textarea')?.focus(),50);
}

function salesSaveNotesModal(id){
  const ta = document.getElementById('sales-notes-modal-textarea');
  const all = salesLoad();
  const idx = all.findIndex(x=>x.id===id);
  if(idx>=0){
    all[idx] = {...all[idx], notes: (ta?.value||'').trim()};
    salesSave(all);
    renderSalesTable();
  }
  document.getElementById('sales-notes-modal')?.remove();
}

const _SALES_LIST_PICKER_OPTS = [
  {id:'realestate', label:'Real Estate', color:'var(--blue-bright)', icon:'<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>'},
  {id:'resorts', label:'Resorts', color:'var(--blue-bright)', icon:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>'},
  {id:'golf', label:'Golf Courses', color:'var(--blue-bright)', icon:'<line x1="12" y1="2" x2="12" y2="22"/><path d="M12 7l6 4-6 4V7z"/><path d="M5 21c0-3 7-3 7-6"/>'},
  {id:'other', label:'Other', color:'var(--blue-bright)', icon:'<rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2h-3"/><line x1="9" y1="10" x2="15" y2="10"/><line x1="9" y1="14" x2="15" y2="14"/>'},
  {id:'warm', label:'Warm Leads', color:'var(--amber)', icon:'<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'},
  {id:'clients', label:'Existing Clients', color:'var(--green)', icon:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>'},
];

function salesQuickMove(id){
  const existing = document.getElementById('sales-move-modal');
  if(existing) existing.remove();
  const modal = document.createElement('div');
  modal.id = 'sales-move-modal';
  modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9700;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick = e => { if(e.target===modal) modal.remove(); };
  modal.innerHTML = `<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:340px;border:1px solid var(--border-bright);overflow:hidden" onclick="event.stopPropagation()">
    <div style="padding:16px 20px;border-bottom:1px solid var(--border)">
      <div style="font-size:14px;font-weight:700;color:var(--white)">Move to List</div>
      <div style="font-size:11px;color:var(--muted);margin-top:2px">Choose where this contact should live</div>
    </div>
    <div style="padding:12px;display:flex;flex-direction:column;gap:6px">
      ${_SALES_LIST_PICKER_OPTS.map(o=>`
      <button onclick="_salesQuickMoveTo('${escSalesAttr(id)}','${o.id}')" style="display:flex;align-items:center;gap:10px;padding:10px 14px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:${o.color};font-size:13px;font-weight:600;cursor:pointer;text-align:left;width:100%;box-sizing:border-box">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${o.icon}</svg>
        ${o.label}
      </button>`).join('')}
    </div>
    <div style="padding:10px 16px 16px;display:flex;justify-content:flex-end">
      <button onclick="document.getElementById('sales-move-modal').remove()" style="padding:8px 16px;border-radius:10px;border:1px solid var(--border);background:transparent;color:var(--muted);font-size:12px;font-weight:600;cursor:pointer">Cancel</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

async function _salesQuickMoveTo(id, listId){
  document.getElementById('sales-move-modal')?.remove();
  await salesEnsureLoaded();
  const all = salesLoad();
  const c = all.find(x=>x.id===id);
  if(c){ c.list = listId; salesSave(all); if(listId==='clients'){syncSalesCRMToClient(c);if(typeof renderClients==='function')renderClients();} renderSalesTable(); }
}

// Toggles the "Lists" dropdown (Real Estate/Resorts/Golf/Other/Warm/Clients)
// that replaced the always-visible pill row. Closes on outside click or once
// a list is picked (each list button's onclick also calls this to close).
let _salesListsDropdownOutsideHandler = null;
function salesToggleListsDropdown(evt){
  evt?.stopPropagation();
  const panel = document.getElementById('sales-lists-dropdown-panel');
  if(!panel) return;
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? 'flex' : 'none';
  if(_salesListsDropdownOutsideHandler){
    document.removeEventListener('click', _salesListsDropdownOutsideHandler);
    _salesListsDropdownOutsideHandler = null;
  }
  if(opening){
    _salesListsDropdownOutsideHandler = (e) => {
      const btn = document.getElementById('sales-lists-dropdown-btn');
      if(!panel.contains(e.target) && e.target!==btn && !btn?.contains(e.target)){
        panel.style.display = 'none';
        document.removeEventListener('click', _salesListsDropdownOutsideHandler);
        _salesListsDropdownOutsideHandler = null;
      }
    };
    setTimeout(()=>document.addEventListener('click', _salesListsDropdownOutsideHandler), 0);
  }
}

// Toggles the "Create" dropdown (Add Contact/Import Excel/Fix Names/Bulk Email)
// that replaced those as separate standalone buttons in the toolbar.
let _salesCreateDropdownOutsideHandler = null;
function salesToggleCreateDropdown(evt){
  evt?.stopPropagation();
  const panel = document.getElementById('sales-create-dropdown-panel');
  if(!panel) return;
  const opening = panel.style.display === 'none';
  panel.style.display = opening ? 'flex' : 'none';
  if(_salesCreateDropdownOutsideHandler){
    document.removeEventListener('click', _salesCreateDropdownOutsideHandler);
    _salesCreateDropdownOutsideHandler = null;
  }
  if(opening){
    _salesCreateDropdownOutsideHandler = (e) => {
      const btn = document.getElementById('sales-create-dropdown-btn');
      if(!panel.contains(e.target) && e.target!==btn && !btn?.contains(e.target)){
        panel.style.display = 'none';
        document.removeEventListener('click', _salesCreateDropdownOutsideHandler);
        _salesCreateDropdownOutsideHandler = null;
      }
    };
    setTimeout(()=>document.addEventListener('click', _salesCreateDropdownOutsideHandler), 0);
  }
}

// Single "⋯" menu replaces the old row of 5-6 separate icon buttons (New Deal,
// Edit, Unsubscribe, Do Not Email, Move, Client-type toggle). Delete stays as
// its own visible button since it's destructive and gets a confirm() anyway.
// Body-appended + position:fixed so it isn't clipped by the table card's
// overflow:hidden.
function salesShowActionsMenu(evt, id){
  evt.stopPropagation();
  const existing = document.getElementById('sales-actions-menu');
  const reopening = existing && existing.dataset.forId === id;
  existing?.remove();
  if(reopening) return; // clicking the same row's "⋯" again just closes it

  const all = salesLoad();
  const c = all.find(x=>x.id===id);
  if(!c) return;
  const isClientsTab = salesActiveList === 'clients';
  const ctType = c.clientType || 'active';

  const items = [
    {label:'New Deal', icon:'circle-target', onclick:`openDealModal(null,'${escSalesAttr(id)}')`, color:'var(--offwhite)'},
    {label:'Edit', icon:'edit', onclick:`salesEditContact('${escSalesAttr(id)}')`, color:'var(--offwhite)'},
    isClientsTab ? {label: ctType==='active'?'Mark as Past Client':'Mark as Active Client', icon:'swap', onclick:`salesToggleClientType('${escSalesAttr(id)}')`, color:'var(--offwhite)'} : null,
    {label: c.unsubscribed?'Re-subscribe':'Unsubscribe', icon:'unsub', onclick:`salesToggleUnsub('${escSalesAttr(id)}')`, color:'var(--offwhite)'},
    {label: c.doNotEmail?'Remove Do Not Email':'Mark Do Not Email', icon:'block', onclick:`salesToggleDNE('${escSalesAttr(id)}')`, color:'var(--offwhite)'},
    {label:'Move to List', icon:'move', onclick:`salesQuickMove('${escSalesAttr(id)}')`, color:'var(--offwhite)'},
  ].filter(Boolean);

  const icons = {
    'circle-target':'<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    'edit':'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/>',
    'swap':'<polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
    'unsub':'<path d="M4 4l16 16"/><path d="M22 12a10 10 0 1 1-9-10"/>',
    'block':'<circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>',
    'move':'<line x1="7" y1="17" x2="17" y2="7"/><polyline points="7 7 17 7 17 17"/>',
  };

  const btn = evt.currentTarget;
  const rect = btn.getBoundingClientRect();
  const menu = document.createElement('div');
  menu.id = 'sales-actions-menu';
  menu.dataset.forId = id;
  menu.style.cssText = `position:fixed;z-index:9650;top:${rect.bottom+4}px;right:${window.innerWidth-rect.right}px;background:var(--navy-card);border:1px solid var(--border-bright);border-radius:10px;box-shadow:0 12px 32px rgba(0,0,0,.5);min-width:190px;padding:6px;display:flex;flex-direction:column;gap:2px`;
  menu.innerHTML = items.map(it=>`
    <button onclick="document.getElementById('sales-actions-menu')?.remove();${it.onclick}" style="display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:7px;border:none;background:transparent;color:${it.color};font-size:12px;font-weight:600;cursor:pointer;text-align:left;width:100%" onmouseover="this.style.background='var(--navy-lift)'" onmouseout="this.style.background='transparent'">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">${icons[it.icon]}</svg>
      ${it.label}
    </button>`).join('');
  document.body.appendChild(menu);

  const closeOnOutsideClick = (e) => {
    if(!menu.contains(e.target)){
      menu.remove();
      document.removeEventListener('click', closeOnOutsideClick);
    }
  };
  setTimeout(()=>document.addEventListener('click', closeOnOutsideClick), 0);
}

async function salesDeleteContact(id){
  if(!confirm('Delete this contact?')) return;
  await salesEnsureLoaded();
  const all = salesLoad().filter(c=>c.id!==id);
  salesSave(all);
  renderSalesTable();
}

// ── Add / Edit Modal ──
function openSalesAddModal(editId){
  salesEditingId = editId || null;
  const modal = document.getElementById('sales-add-modal');
  if(!modal) return;
  const err = document.getElementById('sc-err');
  if(err){ err.style.display='none'; err.textContent=''; }

  _scDNE = false; // reset to off each time the modal opens
  function scToggleDNE(){
    _scDNE = !_scDNE;
    const btn = document.getElementById('sc-dne-btn');
    const lbl = document.getElementById('sc-dne-label');
    if(btn){ btn.style.background = _scDNE ? 'rgba(240,82,82,.12)' : 'var(--navy-lift)'; btn.style.borderColor = _scDNE ? 'var(--red)' : 'var(--border)'; btn.style.color = _scDNE ? 'var(--red)' : 'var(--muted)'; }
    if(lbl) lbl.textContent = _scDNE ? 'Do Not Email (ON — will be excluded from all emails)' : 'Do Not Email';
  }
  window.scToggleDNE = scToggleDNE;

  function scUpdateFieldRow(){
    const listVal = document.getElementById('sc-list')?.value;
    const row = document.getElementById('sc-field-row');
    if(row) row.style.display = listVal==='other' ? '' : 'none';
    const ctRow = document.getElementById('sc-clienttype-row');
    if(ctRow) ctRow.style.display = listVal==='clients' ? '' : 'none';
    // Populate the type dropdown
    const sel = document.getElementById('sc-field');
    if(sel && sel.tagName==='SELECT' && sel.options.length <= 1){
      sel.innerHTML = '<option value="">— Select a type —</option>'
        + OTHER_TYPES.map(t=>`<option value="${t.id}">${t.label}</option>`).join('');
    }
    scUpdateTypePreview();
    scRefreshClientTypeStyles();
  }
  function scUpdateTypePreview(){
    const sel = document.getElementById('sc-field');
    const preview = document.getElementById('sc-type-preview');
    if(!sel || !preview) return;
    const val = sel.value;
    const t = OTHER_TYPES.find(x=>x.id===val);
    if(t && val){
      preview.style.display = 'flex';
      preview.innerHTML = `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:${t.color}22;color:${t.color};border:1px solid ${t.color}44"><span style="width:7px;height:7px;border-radius:50%;background:${t.color};display:inline-block"></span>${t.label}</span>`;
    } else {
      preview.style.display = 'none';
    }
  }
  window.scUpdateTypePreview = scUpdateTypePreview;
  function scRefreshClientTypeStyles(){
    const activeRadio = document.getElementById('sc-ct-active');
    const pastRadio   = document.getElementById('sc-ct-past');
    const activeLbl   = document.getElementById('sc-ct-active-lbl');
    const pastLbl     = document.getElementById('sc-ct-past-lbl');
    if(!activeRadio||!pastRadio) return;
    if(activeRadio.checked){
      if(activeLbl){ activeLbl.style.borderColor='var(--green)'; activeLbl.style.background='rgba(34,217,122,.08)'; activeLbl.style.color='var(--green)'; }
      if(pastLbl)  { pastLbl.style.borderColor='var(--border)';  pastLbl.style.background='var(--navy-lift)';       pastLbl.style.color='var(--muted)'; }
    } else {
      if(pastLbl)  { pastLbl.style.borderColor='var(--blue-bright)'; pastLbl.style.background='rgba(91,141,239,.08)'; pastLbl.style.color='var(--blue-bright)'; }
      if(activeLbl){ activeLbl.style.borderColor='var(--border)';    activeLbl.style.background='var(--navy-lift)';    activeLbl.style.color='var(--muted)'; }
    }
  }
  document.getElementById('sc-ct-active')?.addEventListener('change', scRefreshClientTypeStyles);
  document.getElementById('sc-ct-past')?.addEventListener('change',   scRefreshClientTypeStyles);
  document.getElementById('sc-list')?.addEventListener('change', scUpdateFieldRow);

  if(editId){
    const c = salesLoad().find(x=>x.id===editId);
    if(c){
      document.getElementById('sc-fname').value   = c.firstName||'';
      document.getElementById('sc-lname').value   = c.lastName||'';
      document.getElementById('sc-company').value = c.company||'';
      document.getElementById('sc-phone').value   = c.phone||'';
      document.getElementById('sc-email').value   = c.email||'';
      const _editCityEl = document.getElementById('sc-city'); if(_editCityEl) _editCityEl.value = c.city||'';
      document.getElementById('sc-list').value    = c.list||salesActiveList;
      document.getElementById('sc-status').value  = c.status||'new';
      document.getElementById('sc-notes').value   = c.notes||'';
      const fieldEl = document.getElementById('sc-field');
      if(fieldEl){
        // Populate options first if needed (select may not be populated yet)
        if(fieldEl.tagName==='SELECT' && fieldEl.options.length<=1){
          fieldEl.innerHTML = '<option value="">— Select a type —</option>'
            + OTHER_TYPES.map(t=>`<option value="${t.id}">${t.label}</option>`).join('');
        }
        const normalized = normalizeOtherType(c.field||'');
        fieldEl.value = OTHER_TYPES.find(t=>t.id===normalized) ? normalized : '';
      }
      // Client type
      const ctVal = c.clientType||'active';
      const ctA = document.getElementById('sc-ct-active'); if(ctA) ctA.checked = ctVal==='active';
      const ctP = document.getElementById('sc-ct-past');   if(ctP) ctP.checked = ctVal==='past';
      _scDNE = !!c.doNotEmail;
      const btn = document.getElementById('sc-dne-btn');
      const lbl = document.getElementById('sc-dne-label');
      if(btn){ btn.style.background = _scDNE ? 'rgba(240,82,82,.12)' : 'var(--navy-lift)'; btn.style.borderColor = _scDNE ? 'var(--red)' : 'var(--border)'; btn.style.color = _scDNE ? 'var(--red)' : 'var(--muted)'; }
      if(lbl) lbl.textContent = _scDNE ? 'Do Not Email (ON — will be excluded from all emails)' : 'Do Not Email';
      modal.querySelector('.sales-modal-header div').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Contact';
    }
  } else {
    ['sc-fname','sc-lname','sc-company','sc-phone','sc-email','sc-city','sc-notes'].forEach(id=>{
      const el=document.getElementById(id); if(el) el.value='';
    });
    const fieldEl = document.getElementById('sc-field');
    if(fieldEl){ if(fieldEl.tagName==='SELECT'){ fieldEl.innerHTML='<option value="">— Select a type —</option>'+OTHER_TYPES.map(t=>`<option value="${t.id}">${t.label}</option>`).join(''); } fieldEl.value=''; }
    document.getElementById('sc-list').value   = salesActiveList;
    document.getElementById('sc-status').value = 'new';
    // Default client type to active for new contacts
    const ctA = document.getElementById('sc-ct-active'); if(ctA) ctA.checked = true;
    const ctP = document.getElementById('sc-ct-past');   if(ctP) ctP.checked = false;
    _scDNE = false;
    const btn = document.getElementById('sc-dne-btn'); const lbl = document.getElementById('sc-dne-label');
    if(btn){ btn.style.background='var(--navy-lift)'; btn.style.borderColor='var(--border)'; btn.style.color='var(--muted)'; }
    if(lbl) lbl.textContent='Do Not Email';
    modal.querySelector('.sales-modal-header div').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Add Contact';
  }
  scUpdateFieldRow();
  scRefreshClientTypeStyles();
  modal.classList.add('open');
}
function closeSalesAddModal(){ document.getElementById('sales-add-modal')?.classList.remove('open'); salesEditingId=null; }

function salesEditContact(id){ openSalesAddModal(id); }

async function saveSalesContact(){
  const email = document.getElementById('sc-email').value.trim();
  const err   = document.getElementById('sc-err');

  await salesEnsureLoaded();
  const all = salesLoad();

  if(salesEditingId){
    const idx = all.findIndex(c=>c.id===salesEditingId);
    if(idx>=0){
      // Shallow-clone the contact BEFORE modifying it. salesLoad() returns the same
      // object references that live inside _salesByList, so mutating all[idx] directly
      // also mutates _salesByList — making salesSave()'s diff-check see no change and
      // skip the write entirely (silent data loss on every edit). Breaking the reference
      // here ensures the diff correctly detects the update and persists it.
      const updated = {...all[idx]};
      all[idx] = updated;

      const _editName = splitSalesName(document.getElementById('sc-fname').value, document.getElementById('sc-lname').value);
      // Auto-extract company from last name if it contains " - Company" pattern
      const _autoExtracted = _salesExtractCompanyFromLastName(_editName.firstName, _editName.lastName);
      const _rawCompany = document.getElementById('sc-company').value.trim();
      updated.firstName  = _autoExtracted.firstName;
      updated.lastName   = _autoExtracted.lastName;
      // Use auto-extracted company if field is blank, otherwise keep what user typed
      updated.company    = _rawCompany || _autoExtracted.company || '';
      updated.phone      = document.getElementById('sc-phone').value.trim();
      updated.email      = email;
      updated.city       = (document.getElementById('sc-city')?.value||'').trim();
      updated.list       = document.getElementById('sc-list').value;
      updated.status     = document.getElementById('sc-status').value;
      updated.notes      = document.getElementById('sc-notes').value.trim();
      updated.field      = (document.getElementById('sc-field')?.value||'').trim()||undefined;
      updated.doNotEmail = typeof _scDNE !== 'undefined' ? !!_scDNE : !!updated.doNotEmail;
      if(updated.list === 'clients'){
        const ctChecked = document.querySelector('input[name="sc-clienttype"]:checked')?.value || 'active';
        updated.clientType = ctChecked;
        updated._clientTypeManual = true;
      }
      updated.updatedAt  = new Date().toISOString();
    }
    salesSave(all);
    // Sync to clients tab if this contact is in the clients list
    if(idx>=0 && all[idx].list==='clients') syncSalesCRMToClient(all[idx]);
    closeSalesAddModal();
    renderSalesTable();
    if(typeof renderClients==='function') renderClients();
    return;
  }

  const _newList = document.getElementById('sc-list').value;
  const _newCt   = _newList==='clients' ? (document.querySelector('input[name="sc-clienttype"]:checked')?.value||'active') : undefined;
  const _newName = splitSalesName(document.getElementById('sc-fname').value, document.getElementById('sc-lname').value);
  const _newExtracted = _salesExtractCompanyFromLastName(_newName.firstName, _newName.lastName);
  const _newRawCompany = document.getElementById('sc-company').value.trim();
  const contact = {
    id:        'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
    firstName: _newExtracted.firstName,
    lastName:  _newExtracted.lastName,
    company:   _newRawCompany || _newExtracted.company || '',
    phone:     document.getElementById('sc-phone').value.trim(),
    email:     email,
    city:      (document.getElementById('sc-city')?.value||'').trim(),
    list:      _newList,
    status:    document.getElementById('sc-status').value,
    notes:     document.getElementById('sc-notes').value.trim(),
    field:     (document.getElementById('sc-field')?.value||'').trim()||undefined,
    clientType: _newCt,
    _clientTypeManual: _newList==='clients' ? true : undefined,
    doNotEmail: typeof _scDNE !== 'undefined' ? !!_scDNE : false,
    unsubscribed: false,
    createdAt: new Date().toISOString(),
  };

  if(!contact.firstName && !contact.lastName && !contact.email){
    if(err){ err.textContent='Please enter at least a name or email.'; err.style.display='block'; }
    return;
  }

  all.push(contact);
  salesSave(all);
  // Sync to clients tab if added as Existing Client
  if(contact.list==='clients') syncSalesCRMToClient(contact);
  closeSalesAddModal();
  // Switch to the list the contact was added to
  setSalesList(contact.list);
  renderSalesTable();
  if(contact.list==='clients' && typeof renderClients==='function') renderClients();
}

// ── Excel Import ──
function importSalesExcel(input){
  const file = input.files[0];
  if(!file) return;
  const listId = salesActiveList;
  const reader = new FileReader();
  reader.onload = async function(e){
    try{
      const wb = XLSX.read(e.target.result, {type:'binary'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:''});

      if(!rows.length){ alert('No data found in the file.'); return; }

      // Always fetch fresh from Firebase before merging
      await salesSyncFirebase();
      const all = salesLoad();
      let added = 0;
      rows.forEach(row=>{
        // Normalise column names (case-insensitive, strip spaces/underscores/hyphens/slashes)
        const r = {};
        Object.keys(row).forEach(k=>{ r[k.toLowerCase().replace(/[\s_\-\/]/g,'')] = row[k]; });

        const firstName = String(r.firstname||r.fname||r.name||'').trim();
        const lastName  = String(r.lastname||r.lname||'').trim();
        const company   = String(r.company||r.organisation||r.organization||r.brokerage||'').trim();
        const email     = String(r.email||r.emailaddress||'').trim().toLowerCase();
        const phone     = String(r.phone||r.telephone||r.mobile||r.cell||'').trim();
        const city      = String(r.city||r.cityregion||r.region||r.location||r.market||r.area||r.territory||'').trim();
        const notes     = String(r.notes||r.note||r.comments||'').trim();
        const status    = String(r.status||'new').toLowerCase();
        const rawType   = String(r.type||r.field||r.industry||r.category||r.jobtype||r.businesstype||r.sector||'').trim();
        const field     = rawType ? (normalizeOtherType(rawType)||rawType) : undefined;

        if(!firstName && !lastName && !email) return; // skip blank rows

        // Avoid exact email duplicates
        if(email && all.some(c=>c.email && c.email.toLowerCase()===email)) return;

        all.push({
          id: 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
          firstName, lastName, company, phone, email, city, notes,
          field: field||undefined,
          list: listId,
          status: ['new','contacted','warm','client'].includes(status) ? status : 'new',
          unsubscribed: false,
          createdAt: new Date().toISOString(),
        });
        added++;
      });
      salesSave(all);
      renderSalesTable();
      alert(`Imported ${added} contacts into ${SALES_LIST_DEFS.find(l=>l.id===listId)?.label||listId}.\n(Duplicates by email were skipped.)`);
    } catch(err){
      alert('Error reading file: ' + err.message);
    }
    input.value = ''; // reset so same file can be re-imported
  };
  reader.readAsBinaryString(file);
}

// ── Bulk Email ──
function openSalesBulkEmail(){
  const modal = document.getElementById('sales-bulk-modal');
  if(!modal) return;
  // Pre-check the active list
  document.querySelectorAll('#bulk-list-checkboxes input[type=checkbox]').forEach(cb=>{
    cb.checked = cb.value === salesActiveList;
  });
  updateBulkPreview();
  // Update preview whenever checkboxes change
  document.querySelectorAll('#bulk-list-checkboxes input[type=checkbox]').forEach(cb=>{
    cb.onchange = updateBulkPreview;
  });
  modal.classList.add('open');
}
function closeSalesBulkModal(){ document.getElementById('sales-bulk-modal')?.classList.remove('open'); }

function getBulkRecipients(){
  const selected = Array.from(document.querySelectorAll('#bulk-list-checkboxes input:checked')).map(cb=>cb.value);
  const all = salesLoad();
  return all.filter(c=> selected.includes(c.list) && !c.unsubscribed && !c.doNotEmail && !c._deleted && c.email);
}

function updateBulkPreview(){
  const recipients = getBulkRecipients();
  const preview = document.getElementById('bulk-recipients-preview');
  const countEl = document.getElementById('bulk-recipient-count');
  if(preview) preview.textContent = recipients.map(c=>c.email).join(', ') || 'No subscribers found in selected lists.';
  if(countEl) countEl.textContent = `${recipients.length} recipient${recipients.length!==1?'s':''} (unsubscribed excluded)`;
}

function bulkCopyEmails(){
  const recipients = getBulkRecipients();
  if(!recipients.length){ alert('No recipients to copy.'); return; }
  const text = recipients.map(c=>c.email).join(', ');
  navigator.clipboard.writeText(text).then(()=>{
    const msg = document.getElementById('bulk-copy-msg');
    if(msg){ msg.style.display='block'; setTimeout(()=>msg.style.display='none', 2500); }
  }).catch(()=>{ prompt('Copy these emails:', text); });
}

function bulkOpenMail(){
  const recipients = getBulkRecipients();
  if(!recipients.length){ alert('No recipients to email.'); return; }
  const subject = encodeURIComponent(document.getElementById('bulk-subject')?.value||'DroneHub Media — Services');
  const body    = encodeURIComponent(document.getElementById('bulk-body')?.value||'');
  // BCC all recipients so they don't see each other
  const bcc = recipients.map(c=>encodeURIComponent(c.email)).join(',');
  window.location.href = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`;
}

// ── Individual Email ──
function openSalesIndivEmail(id){
  const c = salesLoad().find(x=>x.id===id);
  if(!c) return;
  if(c.doNotEmail){ alert(`${[c.firstName,c.lastName].filter(Boolean).join(' ')||c.email} is marked Do Not Email and cannot receive any emails. Remove the Do Not Email flag on their profile to send them emails.`); return; }
  const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || c.company || 'there';
  document.getElementById('indiv-to').value = c.email||'';
  document.getElementById('indiv-subject').value = 'DroneHub Media — Let\'s Connect';
  document.getElementById('indiv-body').value = `Hi ${name},\n\nI wanted to reach out personally about our drone media services. We specialize in real estate listings, resort photography, and aerial videography.\n\nWould love to chat about how we can work together!\n\nBest,\nDroneHub Media`;
  document.getElementById('sales-individual-email-modal').classList.add('open');
}
function closeSalesIndivModal(){ document.getElementById('sales-individual-email-modal')?.classList.remove('open'); }

function openIndivMailto(){
  const to      = encodeURIComponent(document.getElementById('indiv-to')?.value||'');
  const subject = encodeURIComponent(document.getElementById('indiv-subject')?.value||'');
  const body    = encodeURIComponent(document.getElementById('indiv-body')?.value||'');
  window.location.href = `mailto:${to}?subject=${subject}&body=${body}`;
}

// ── Import Excel Modal ──
function openImportModal(){
  const modal = document.getElementById('sales-import-modal');
  if(!modal) return;
  // Pre-select the currently active list
  // For 'clients' tab, pre-select 'clients-active' by default
  const preselect = salesActiveList === 'clients' ? 'clients-active' : salesActiveList;
  const radios = modal.querySelectorAll('input[name="import-list"]');
  radios.forEach(r => r.checked = r.value === preselect);
  updateImportPickerStyles();
  // Wire up radio change to update styles
  radios.forEach(r => r.onchange = updateImportPickerStyles);
  // Clear previous file selection and reset overwrite toggle
  const fi = document.getElementById('sales-import-file-input');
  if(fi) fi.value = '';
  document.getElementById('import-filename').textContent = '';
  const ow = document.getElementById('import-overwrite-dupes');
  if(ow) ow.checked = false;
  // Reset default type dropdown
  const dt = document.getElementById('import-other-default-type');
  if(dt) dt.value = '';
  modal.style.display = 'flex';
}

function closeSalesImportModal(){
  document.getElementById('sales-import-modal').style.display = 'none';
}

function updateImportPickerStyles(){
  const LIST_IDS = ['realestate','resorts','golf','other','warm','clients-active','clients-past'];
  LIST_IDS.forEach(id => {
    const lbl = document.getElementById('import-pick-'+id);
    const radio = lbl?.querySelector('input[type=radio]');
    if(!lbl || !radio) return;
    const isActive = id === 'clients-active';
    const isOther  = id === 'other';
    const activeCol = isActive ? 'var(--green)' : isOther ? 'var(--amber)' : 'var(--blue-bright)';
    const activeBg  = isActive ? 'rgba(34,217,122,.1)' : isOther ? 'rgba(245,166,35,.1)' : 'rgba(91,141,239,.12)';
    if(radio.checked){
      lbl.style.borderColor = activeCol;
      lbl.style.background  = activeBg;
      lbl.style.color       = activeCol;
    } else {
      lbl.style.borderColor = 'var(--border)';
      lbl.style.background  = 'var(--navy-lift)';
      lbl.style.color       = 'var(--muted)';
    }
  });
  // Show/hide the Other-tab Type hint
  const hint = document.getElementById('import-other-type-hint');
  const selectedList = getImportSelectedList();
  if(hint) hint.style.display = selectedList === 'other' ? 'block' : 'none';
}

function getImportSelectedList(){
  const checked = document.querySelector('input[name="import-list"]:checked');
  return checked ? checked.value : salesActiveList;
}

function _getImportDefaultType(){
  return document.getElementById('import-other-default-type')?.value || '';
}

function onImportDrop(e){
  e.preventDefault();
  document.getElementById('sales-import-dropzone').style.borderColor = 'var(--border)';
  const file = e.dataTransfer?.files?.[0];
  if(!file) return;
  const fn = document.getElementById('import-filename');
  if(fn) fn.textContent = file.name;
  const overwrite = !!document.getElementById('import-overwrite-dupes')?.checked;
  processSalesImportFile(file, getImportSelectedList(), overwrite, _getImportDefaultType());
}

function runSalesImport(input){
  const file = input.files[0];
  if(!file) return;
  const fn = document.getElementById('import-filename');
  if(fn) fn.textContent = file.name;
  const overwrite = !!document.getElementById('import-overwrite-dupes')?.checked;
  processSalesImportFile(file, getImportSelectedList(), overwrite, _getImportDefaultType());
}

function processSalesImportFile(file, listId, overwriteDupes, defaultOtherType){
  // Resolve clients-active / clients-past into list='clients' + clientType
  let importClientType = undefined;
  if(listId === 'clients-active'){ importClientType = 'active'; listId = 'clients'; }
  if(listId === 'clients-past'){   importClientType = 'past';   listId = 'clients'; }
  const LIST_LABELS = {realestate:'Real Estate',resorts:'Resorts',golf:'Golf Courses',other:'Other',warm:'Warm Leads',clients:'Existing Clients'};
  const reader = new FileReader();
  reader.onload = async function(e){
    try{
      const wb = XLSX.read(e.target.result, {type:'binary'});
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, {defval:''});
      if(!rows.length){ alert('No data found in the file.'); return; }

      // Always fetch the latest from Firebase before merging so we never
      // overwrite contacts that haven't been loaded into memory yet
      await salesSyncFirebase();
      const all = salesLoad();
      let added = 0, updated = 0, blankRows = 0, dupSkipped = 0;
      rows.forEach(row=>{
        const r = {};
        Object.keys(row).forEach(k=>{ r[k.toLowerCase().replace(/[\s_\-\/\.\(\)]/g,'')] = String(row[k]); });
        const {firstName, lastName} = splitSalesName(
          String(r.firstname||r.fname||r.name||'').trim(),
          String(r.lastname||r.lname||'').trim()
        );
        const company   = String(r.company||r.organisation||r.organization||r.brokerage||r.businessname||r.business||'').trim();
        const email     = String(r.email||r['e-mail']||r.emailaddress||r.emailaddr||'').trim().toLowerCase();
        const phone     = String(r.phone||r.telephone||r.mobile||r.cell||r.phonenumber||r.contactnumber||'').trim();
        const city      = String(r.city||r.cityregion||r.region||r.location||r.market||r.area||r.territory||r.province||r.state||'').trim();
        const notes     = String(r.notes||r.note||r.comments||r.comment||r.memo||'').trim();
        const status    = String(r.status||'new').toLowerCase();
        // Type column: check many possible column name variations (Mackenzie's sheets may use "Business Type" etc.)
        const rawField  = listId==='other' ? String(
          r.type||r.businesstype||r.typeofbusiness||r.businesscategory||r.companytype||
          r.industrytype||r.industrysector||r.industry||r.category||r.field||
          r.sector||r.jobtype||r.profession||r.trade||''
        ).trim() : '';
        // normalizeOtherType returns '' for unknown/empty — fall back to the default type chosen in the modal
        const detectedField = listId==='other' ? normalizeOtherType(rawField) : '';
        const field = detectedField || (listId==='other' ? (defaultOtherType||'') : '');
        const doNotEmail= String(r.donotemail||r['do not email']||r.optout||r['opt out']||'').trim().toLowerCase();
        // Client type: use import-level default, allow row override via 'clienttype'/'type' column
        let rowClientType = undefined;
        if(listId === 'clients'){
          const ctCol = String(r.clienttype||r.type||r.clientstatus||'').trim().toLowerCase();
          if(['active','current'].includes(ctCol)) rowClientType = 'active';
          else if(['past','previous','former','inactive'].includes(ctCol)) rowClientType = 'past';
          else rowClientType = importClientType || 'active';
        }
        // Skip truly blank rows
        if(!firstName && !lastName && !email){ blankRows++; return; }
        // Handle email duplicates
        const existingIdx = email ? all.findIndex(c=>c.email && c.email.toLowerCase()===email) : -1;
        if(existingIdx >= 0){
          if(overwriteDupes){
            // Update existing record with fresh data from the file
            const ex = all[existingIdx];
            if(firstName) ex.firstName = firstName;
            if(lastName)  ex.lastName  = lastName;
            if(company)   ex.company   = company;
            if(phone)     ex.phone     = phone;
            if(city)      ex.city      = city;
            if(notes)     ex.notes     = notes;
            if(field)     ex.field     = normalizeOtherType(field)||field;
            ex.updatedAt = new Date().toISOString();
            updated++;
          } else {
            dupSkipped++;
          }
          return;
        }
        all.push({
          id: 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2,7),
          firstName, lastName, company, phone, email, city, notes,
          field: field||undefined,
          list: listId,
          clientType: rowClientType,
          _clientTypeManual: listId==='clients' ? true : undefined,
          status: ['new','contacted','warm','client'].includes(status) ? status : 'new',
          doNotEmail: ['yes','true','1','y'].includes(doNotEmail),
          unsubscribed: false,
          createdAt: new Date().toISOString(),
        });
        added++;
      });
      // Save to Firebase (in-memory + cloud — no localStorage size limits)
      salesSave(all);
      // Mirror any imported clients into the Clients tab
      if(listId === 'clients'){
        syncCRMClientsToTab(all.filter(c => c.list === 'clients'));
        if(typeof renderClients === 'function') renderClients();
      }
      closeSalesImportModal();
      setSalesList(listId);
      renderSalesTable();
      const label = LIST_LABELS[listId] || listId;
      const ctNote = importClientType ? ` (${importClientType} clients)` : '';
      const parts = [];
      if(added)      parts.push(`${added} new contact${added!==1?'s':''} added`);
      if(updated)    parts.push(`${updated} existing contact${updated!==1?'s':''} updated`);
      if(dupSkipped) parts.push(`${dupSkipped} skipped — already in system (upload with "Update existing" checked to overwrite)`);
      if(blankRows)  parts.push(`${blankRows} empty row${blankRows!==1?'s':''} ignored`);
      alert(`Import into ${label}${ctNote}:\n${parts.join('\n')}`);
    } catch(err){ alert('Error reading file: ' + err.message); }
  };
  reader.readAsBinaryString(file);
}

// Toggle a stat-chip quick filter; clicking the same chip again clears it
function salesSetQuickFilter(f){
  _salesQuickFilter = (_salesQuickFilter === f) ? null : f;
  _salesPage = 0; // reset to first page
  renderSalesTable();
}

// "Total Contacts" stat acts as a clear-all-filters shortcut — resets quick
// filter, the active/past client sub-filter, and the search box.
function salesClearAllFilters(){
  _salesQuickFilter = null;
  _salesClientSub = 'all';
  _salesPage = 0;
  const searchEl = document.getElementById('sales-search');
  if(searchEl) searchEl.value = '';
  renderSalesTable();
}

// ── Sales view switcher ──
// salesView declared early above (TDZ fix)
function setSalesView(v, skipGateCheck){
  salesView = v;
  try{localStorage.setItem('dronehub_sales_view', v);}catch(e){}

  const views = ['jobs','clients','contacts','pipeline'];
  views.forEach(id=>{
    const el = document.getElementById('sales-view-'+id);
    const btn = document.getElementById('sales-view-'+id+'-btn');
    if(el) el.style.display = id===v ? '' : 'none';
    if(btn){ btn.style.borderBottomColor = id===v?'var(--blue-bright)':'transparent'; btn.style.color = id===v?'var(--blue-bright)':'var(--muted)'; }
  });
  // Stats bars live in the top tab row (next to Jobs/Clients/Contacts/Pipeline).
  // Contacts view shows contact stats; Clients view shows client stats.
  const statsBarEl = document.getElementById('sales-stats-bar');
  if(statsBarEl) statsBarEl.style.display = v==='contacts' ? 'flex' : 'none';
  const clientStatsBarEl = document.getElementById('sales-clients-stats-bar');
  if(clientStatsBarEl) clientStatsBarEl.style.display = v==='clients' ? 'flex' : 'none';
  const pipeStatsBarEl = document.getElementById('sales-pipeline-stats-bar');
  if(pipeStatsBarEl) pipeStatsBarEl.style.display = v==='pipeline' ? 'flex' : 'none';
  const jobsStatsBarEl = document.getElementById('sales-jobs-stats-bar');
  if(jobsStatsBarEl) jobsStatsBarEl.style.display = v==='jobs' ? 'flex' : 'none';
  // Show/hide contacts & pipeline based on sales access (re-evaluated every call)
  const emailToCheck = _activeSessionEmail || gateGetSession()?.email || '';
  const hasSalesAccess = canAccessSales(emailToCheck);
  ['contacts','pipeline'].forEach(id=>{
    const btn = document.getElementById('sales-view-'+id+'-btn');
    if(btn) btn.style.display = hasSalesAccess ? 'flex' : 'none';
  });
  // If user tried to navigate to a gated view without access, fall back to clients.
  // Skipped when restoring the last-visited tab on page load (skipGateCheck=true) —
  // the value being restored was only ever saved because the user had access to set
  // it, and _activeSessionEmail/team-roster data can be momentarily stale right at
  // boot, which was incorrectly bouncing people from Contacts back to Clients on
  // every refresh.
  if(!skipGateCheck && !hasSalesAccess && (v==='contacts'||v==='pipeline')){
    setSalesView('clients'); return;
  }
  if(v==='pipeline') renderDealsTable();
  if(v==='jobs') renderJobs();
  if(v==='clients') renderClients();
}

// ══════════════════════════════════════════════════════
// SALES CRM — renderSalesTable
// ══════════════════════════════════════════════════════
function renderSalesTable(){
  const all = salesLoad();
  const q   = (document.getElementById('sales-search')?.value||'').toLowerCase().trim();
  const list= all.filter(c=> c.list === salesActiveList && !c._deleted);

  // Client sub-filter bar / Other type filter bar
  const subFilterEl = document.getElementById('clients-sub-filter');
  if(salesActiveList === 'clients' && subFilterEl){
    const activeCount = list.filter(c=>(c.clientType||'active')==='active').length;
    const pastCount   = list.filter(c=>c.clientType==='past').length;
    subFilterEl.style.display = '';
    subFilterEl.innerHTML = `<div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
      <span style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-right:2px">Filter:</span>
      ${[['all','All Clients',list.length,'var(--green)'],['active','Active Clients',activeCount,'var(--green)'],['past','Past Clients',pastCount,'var(--blue-bright)']].map(([v,lbl,cnt,col])=>`
        <button onclick="_salesClientSub='${v}';renderSalesTable()" style="padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid ${_salesClientSub===v?col:'var(--border)'};background:${_salesClientSub===v?'rgba(34,217,122,.1)':'var(--navy-lift)'};color:${_salesClientSub===v?col:'var(--muted)'}">
          ${lbl} <span style="opacity:.65">(${cnt})</span>
        </button>`).join('')}
    </div>`;
  } else if(subFilterEl){
    subFilterEl.style.display = 'none';
  }

  // Apply sub-filter
  let subList = list;
  if(salesActiveList==='clients' && _salesClientSub!=='all'){
    subList = list.filter(c=>(c.clientType||'active')===_salesClientSub);
  }

  // Apply stat-chip quick filter (overrides list — shows matching contacts from all lists)
  let quickFiltered = subList;
  if(_salesQuickFilter === 'warm')         quickFiltered = all.filter(c=>!c._deleted && (c.status==='warm'||c.list==='warm'));
  else if(_salesQuickFilter === 'unsubscribed') quickFiltered = all.filter(c=>!c._deleted && c.unsubscribed);
  else if(_salesQuickFilter === 'dne')     quickFiltered = all.filter(c=>!c._deleted && c.doNotEmail);

  let filtered = q ? quickFiltered.filter(c=>[c.firstName,c.lastName,c.company,c.email,c.phone,c.city,c.notes].join(' ').toLowerCase().includes(q)) : quickFiltered;

  // ── Apply sort ──
  const STATUS_ORDER = {new:0, contacted:1, warm:2, client:3, unsubscribed:4};
  filtered = [...filtered].sort((a,b)=>{
    let va='', vb='';
    if(salesSortCol==='name'){
      va=[a.firstName,a.lastName].filter(Boolean).join(' ').toLowerCase();
      vb=[b.firstName,b.lastName].filter(Boolean).join(' ').toLowerCase();
    } else if(salesSortCol==='status'){
      const sa = a.unsubscribed?'unsubscribed':(a.status||'new');
      const sb = b.unsubscribed?'unsubscribed':(b.status||'new');
      va = STATUS_ORDER[sa]??9;
      vb = STATUS_ORDER[sb]??9;
    } else {
      va = (a[salesSortCol]||'').toLowerCase();
      vb = (b[salesSortCol]||'').toLowerCase();
    }
    if(va < vb) return salesSortDir==='asc'?-1:1;
    if(va > vb) return salesSortDir==='asc'?1:-1;
    return 0;
  });
  applySalesSortHeaders();

  // Stats bar
  const statsBar = document.getElementById('sales-stats-bar');
  if(statsBar){
    const total  = all.filter(c=>!c._deleted).length;
    // Warm = contacts with status 'warm' (across all lists) OR in the warm list
    const warm   = all.filter(c=>!c._deleted && (c.status==='warm' || c.list==='warm')).length;
    const unsub  = all.filter(c=>c.unsubscribed&&!c._deleted).length;
    const dne    = all.filter(c=>c.doNotEmail&&!c._deleted).length;
    const allClients = all.filter(c=>c.list==='clients'&&!c._deleted);
    const activeClients = allClients.filter(c=>(c.clientType||'active')==='active').length;
    const pastClients   = allClients.filter(c=>c.clientType==='past').length;
    const isClientsView = salesActiveList === 'clients';
    const qf = _salesQuickFilter;
    // Helper: chip style — highlighted when active, normal otherwise
    const chipStyle = (active, accentColor, activeBg) =>
      active
        ? `background:${activeBg};border:2px solid ${accentColor};border-radius:9px;padding:4px 11px;font-size:11px;color:${accentColor};cursor:pointer;user-select:none`
        : `background:var(--navy-card);border:1px solid var(--border);border-radius:9px;padding:5px 12px;font-size:11px;color:var(--muted);cursor:pointer;user-select:none`;
    const filtersActive = qf || (isClientsView && _salesClientSub!=='all') || (document.getElementById('sales-search')?.value||'').trim();
    statsBar.innerHTML = [
      `<div onclick="salesClearAllFilters()" title="${filtersActive?'Click to clear filters and show all':'All contacts in this list'}" style="${chipStyle(!!filtersActive,'var(--white)','rgba(255,255,255,.08)')}"><span style="font-size:13px;font-weight:700;color:var(--white);display:block">${total}</span>${filtersActive?'✕ ':''}Total Contacts</div>`,
      isClientsView
        ? `<div style="background:rgba(34,217,122,.06);border:1px solid rgba(34,217,122,.25);border-radius:9px;padding:5px 12px;font-size:11px;color:var(--muted)"><span style="font-size:13px;font-weight:700;color:var(--green);display:block">${activeClients}</span>Active Clients</div>`
        : `<div onclick="salesSetQuickFilter('warm')" title="Click to filter by Warm status" style="${chipStyle(qf==='warm','#F5C842','rgba(245,200,66,.1)')}"><span style="font-size:13px;font-weight:700;color:#F5C842;display:block">${warm}</span>${qf==='warm'?'✕ ':''}Warm Leads</div>`,
      isClientsView
        ? `<div style="background:rgba(91,141,239,.06);border:1px solid rgba(91,141,239,.25);border-radius:9px;padding:5px 12px;font-size:11px;color:var(--muted)"><span style="font-size:13px;font-weight:700;color:var(--blue-bright);display:block">${pastClients}</span>Past Clients</div>`
        : `<div onclick="salesSetQuickFilter('unsubscribed')" title="Click to filter by Unsubscribed" style="${chipStyle(qf==='unsubscribed','#FF7070','rgba(255,112,112,.1)')}"><span style="font-size:13px;font-weight:700;color:#FF7070;display:block">${unsub}</span>${qf==='unsubscribed'?'✕ ':''}Unsubscribed</div>`,
      !isClientsView && dne>0 ? `<div onclick="salesSetQuickFilter('dne')" title="Click to filter by Do Not Email" style="${chipStyle(qf==='dne','var(--red)','rgba(240,82,82,.1)')}"><span style="font-size:13px;font-weight:700;color:var(--red);display:block">${dne}</span>${qf==='dne'?'✕ ':''}Do Not Email</div>` : '',
    ].join('');
  }

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / _SALES_PAGE_SIZE));
  if(_salesPage >= totalPages) _salesPage = totalPages - 1;
  if(_salesPage < 0) _salesPage = 0;
  const pageStart = _salesPage * _SALES_PAGE_SIZE;
  const pageEnd   = Math.min(pageStart + _SALES_PAGE_SIZE, filtered.length);
  const paginated  = filtered.slice(pageStart, pageEnd);

  const cl = document.getElementById('sales-count-label');
  if(cl){
    const subNote = (salesActiveList==='clients' && _salesClientSub!=='all') ? ` (${_salesClientSub} clients)` : '';
    if(totalPages > 1){
      cl.textContent = `Showing ${pageStart+1}–${pageEnd} of ${filtered.length} contacts${subNote} · Page ${_salesPage+1}/${totalPages}`;
    } else {
      cl.textContent = `Showing ${filtered.length} of ${subList.length} contacts in this list${subNote}`;
    }
  }

  // Paginator bar
  let paginatorEl = document.getElementById('sales-paginator');
  if(!paginatorEl){
    const tableWrap = document.getElementById('sales-table-body')?.closest('table');
    if(tableWrap){
      paginatorEl = document.createElement('div');
      paginatorEl.id = 'sales-paginator';
      paginatorEl.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:10px;padding:12px 0 4px;flex-wrap:wrap';
      tableWrap.parentNode.insertBefore(paginatorEl, tableWrap.nextSibling);
    }
  }
  if(paginatorEl){
    if(totalPages <= 1){
      paginatorEl.innerHTML = '';
    } else {
      const btnStyle = (active) => `padding:5px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;border:1px solid ${active?'var(--blue-bright)':'var(--border)'};background:${active?'rgba(91,141,239,.18)':'var(--navy-lift)'};color:${active?'var(--blue-bright)':'var(--offwhite)'}`;
      const pageBtns = [];
      const winStart = Math.max(0, _salesPage - 3);
      const winEnd   = Math.min(totalPages - 1, _salesPage + 3);
      if(winStart > 0) pageBtns.push(`<button style="${btnStyle(false)}" onclick="_salesPage=0;renderSalesTable()">1</button><span style="color:var(--muted)">…</span>`);
      for(let p=winStart; p<=winEnd; p++){
        pageBtns.push(`<button style="${btnStyle(p===_salesPage)}" onclick="_salesPage=${p};renderSalesTable()">${p+1}</button>`);
      }
      if(winEnd < totalPages-1) pageBtns.push(`<span style="color:var(--muted)">…</span><button style="${btnStyle(false)}" onclick="_salesPage=${totalPages-1};renderSalesTable()">${totalPages}</button>`);
      paginatorEl.innerHTML =
        `<button style="${btnStyle(false)}" ${_salesPage===0?'disabled':''} onclick="_salesPage=Math.max(0,_salesPage-1);renderSalesTable()">← Prev</button>` +
        pageBtns.join('') +
        `<button style="${btnStyle(false)}" ${_salesPage===totalPages-1?'disabled':''} onclick="_salesPage=Math.min(${totalPages-1},_salesPage+1);renderSalesTable()">Next →</button>`;
    }
  }

  const tbody = document.getElementById('sales-table-body');
  if(!tbody) return;
  if(!paginated.length){
    const totalAll = SALES_LISTS.reduce((s,l)=>s+(_salesByList[l]||[]).filter(c=>!c._deleted).length,0);
    const allEmpty = totalAll === 0 && SALES_LISTS.every(l=>Array.isArray(_salesByList[l]));
    const recoveryHtml = (!q && allEmpty) ? `
      <div style="margin-top:16px">
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px">If your contacts recently disappeared, a backup may be available.</div>
        <button onclick="salesRunRecovery()" style="padding:8px 18px;border-radius:8px;border:1px solid var(--blue-bright);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:13px;font-weight:700;cursor:pointer">
          Try to Recover Contacts
        </button>
      </div>` : '';
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:32px">${q?'No contacts match your search.':'No contacts in this list yet.'}${recoveryHtml}</td></tr>`;
    return;
  }
  const isClientsTab = salesActiveList === 'clients';
  tbody.innerHTML = paginated.map(c=>{
    const name = [c.firstName, c.lastName].filter(Boolean).join(' ') || '—';
    const statusClass = {new:'sales-status-new',contacted:'sales-status-contacted',warm:'sales-status-warm',unsubscribed:'sales-status-unsubscribed',client:'sales-status-client'}[c.unsubscribed?'unsubscribed':(c.status||'new')] || 'sales-status-new';
    const statusLabel = c.unsubscribed ? 'Unsubscribed' : ({new:'New',contacted:'Contacted',warm:'Warm',client:'Client'}[c.status]||'New');
    const dneBadge = c.doNotEmail ? `<span title="Do Not Email" style="display:inline-flex;align-items:center;gap:3px;font-size:9px;font-weight:700;color:var(--red);background:rgba(240,82,82,.1);border:1px solid rgba(240,82,82,.3);border-radius:8px;padding:1px 6px;margin-left:5px;vertical-align:middle">⊘ DNE</span>` : '';
    const ctType = c.clientType || 'active';
    const ctBadge = isClientsTab
      ? (ctType === 'active'
          ? `<span title="Active Client" style="display:inline-flex;align-items:center;font-size:9px;font-weight:700;color:var(--green);background:rgba(34,217,122,.1);border:1px solid rgba(34,217,122,.3);border-radius:8px;padding:1px 6px;margin-left:5px;vertical-align:middle">● Active</span>`
          : `<span title="Past Client" style="display:inline-flex;align-items:center;font-size:9px;font-weight:700;color:var(--blue-bright);background:rgba(91,141,239,.1);border:1px solid rgba(91,141,239,.3);border-radius:8px;padding:1px 6px;margin-left:5px;vertical-align:middle">◌ Past</span>`)
      : '';
    const emailCell = c.email
      ? (c.doNotEmail
          ? `<span style="color:var(--muted);font-size:12px;text-decoration:line-through" title="Do Not Email">${escSalesHtml(c.email)}</span>`
          : `<a class="sales-email-link" onclick="openSalesIndivEmail('${escSalesAttr(c.id)}')" href="javascript:void(0)">${escSalesHtml(c.email)}</a>`)
      : '—';
    // Check if there's a deal for this contact
    const deals = dealsLoad();
    const contactDeals = deals.filter(d=>d.contactId===c.id&&d.stage!=='lost');
    const dealBadge = contactDeals.length ? `<span style="background:rgba(245,166,35,.15);color:#F5C842;border-radius:8px;padding:2px 7px;font-size:10px;font-weight:700;margin-left:4px" title="Active deal: ${contactDeals.map(d=>d.id).join(', ')}">${contactDeals[0].id}</span>` : '';
    return `<tr>
      <td><input type="checkbox" class="sales-row-check" data-id="${escSalesAttr(c.id)}" onchange="salesCheckChanged()" style="cursor:pointer"></td>
      <td style="font-weight:600;color:var(--white)">${escSalesHtml(name)}${dneBadge}${dealBadge}</td>
      <td style="min-width:170px">${escSalesHtml(c.company||'—')}</td>
      <td style="color:var(--muted);font-size:12px">${escSalesHtml(c.city||'—')}</td>
      <td style="white-space:nowrap">${escSalesHtml(c.phone||'—')}</td>
      <td>${emailCell}</td>
      <td style="white-space:nowrap"><span class="sales-status-badge ${statusClass}">${statusLabel}</span>${ctBadge?`<div style="margin-top:3px">${ctBadge.replace('margin-left:5px;','')}</div>`:''}</td>
      <td onclick="salesShowNotesModal('${escSalesAttr(c.id)}')" style="max-width:90px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-size:12px;cursor:pointer" title="${c.notes?'Click to view/edit notes':'Click to add notes'}">${escSalesHtml((c.notes||'').slice(0,18))||'<span style="color:var(--border-bright)">+ note</span>'}</td>
      <td style="text-align:right;white-space:nowrap">
        <button class="sales-action-btn" onclick="salesShowActionsMenu(event,'${escSalesAttr(c.id)}')" title="More actions">⋯</button>
        <button class="sales-action-btn" style="color:#FF7070;border-color:#FF7070" onclick="salesDeleteContact('${escSalesAttr(c.id)}')" title="Delete">✕</button>
      </td>
    </tr>`;
  }).join('');
}

// ══════════════════════════════════════════════════════
// DEAL PIPELINE
// ══════════════════════════════════════════════════════

const DEAL_STAGES = [
  {id:'new_lead',   label:'New Lead',       color:'#7AABFF'},
  {id:'contacted',  label:'Contacted',      color:'#F5C842'},
  {id:'proposal',   label:'Proposal Sent',  color:'#A78BFA'},
  {id:'negotiating',label:'Negotiating',    color:'#FB923C'},
  {id:'won',        label:'Won',         color:'#22D97A'},
  {id:'lost',       label:'Lost ✗',         color:'#FF7070'},
];

let dealEditingId = null;
let _dealIdCounter = null; // cached for new deal generation

function dealsLoad(){
  try{ return JSON.parse(localStorage.getItem('dronehub_sales_deals')||'[]'); }
  catch(e){ return []; }
}
function dealsSave(arr){
  // Keep a local copy as fast cache only — Firebase is the source of truth
  const now = Date.now();
  try{
    localStorage.setItem('dronehub_sales_deals', JSON.stringify(arr));
    localStorage.setItem('dronehub_sales_deals_ts', String(now));
  }catch(e){}
  _showSalesSaveStatus('saving');
  (async()=>{
    try{
      await fbSetStrict('orgs', ORG_ID+':sales_deals', {data:JSON.stringify(arr), updatedAt:now});
      _showSalesSaveStatus('saved');
    }catch(e){
      console.error('[dealsSave] Firebase write failed:', e.message);
      _showSalesSaveStatus('error', e.message);
    }
  })();
}

async function dealsSyncFirebase(){
  if(!_fbToken()) return;
  try{
    const fb = await fbGet('orgs', ORG_ID+':sales_deals');
    if(fb?.data){
      const remoteTs = fb.updatedAt || 0;
      const localTs  = parseInt(localStorage.getItem('dronehub_sales_deals_ts')||'0', 10);
      // Only apply Firebase data if it's newer than what we last wrote locally
      if(remoteTs >= localTs){
        const remote = JSON.parse(fb.data);
        localStorage.setItem('dronehub_sales_deals', JSON.stringify(remote));
        localStorage.setItem('dronehub_sales_deals_ts', String(remoteTs));
      }
    }
  }catch(e){}
}

function generateDealId(){
  const deals = dealsLoad();
  const year  = new Date().getFullYear();
  const existing = deals.map(d=>d.id).filter(id=>id&&id.startsWith('DH-'+year+'-')).map(id=>parseInt(id.split('-')[2]||0)).filter(n=>!isNaN(n));
  const next = existing.length ? Math.max(...existing) + 1 : 1;
  return `DH-${year}-${String(next).padStart(4,'0')}`;
}

function openDealModal(editId, prefillContactId){
  dealEditingId = editId || null;
  const modal = document.getElementById('sales-deal-modal');
  if(!modal) return;

  // Populate contact datalist suggestions
  const dl = document.getElementById('deal-contact-suggestions');
  if(dl){
    const contacts = salesLoad().filter(c=>!c._deleted);
    dl.innerHTML = contacts.map(c=>{
      const name = [c.firstName,c.lastName].filter(Boolean).join(' ');
      return `<option value="${escSalesAttr(name)}" data-id="${escSalesAttr(c.id)}" data-email="${escSalesAttr(c.email||'')}" data-company="${escSalesAttr(c.company||'')}" data-city="${escSalesAttr(c.city||'')}">`;
    }).join('');
  }

  if(editId){
    const d = dealsLoad().find(x=>x.id===editId);
    if(d){
      document.getElementById('deal-id-display').textContent = d.id;
      document.getElementById('deal-contact-name').value  = d.contactName||'';
      document.getElementById('deal-contact-email').value = d.contactEmail||'';
      document.getElementById('deal-company').value       = d.company||'';
      document.getElementById('deal-city').value          = d.city||'';
      document.getElementById('deal-stage').value         = d.stage||'new_lead';
      document.getElementById('deal-value').value         = d.value||'';
      document.getElementById('deal-notes').value         = d.notes||'';
      document.getElementById('deal-modal-title').innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit Deal';
    }
  } else {
    const newId = generateDealId();
    document.getElementById('deal-id-display').textContent = newId;
    document.getElementById('deal-modal-title').innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg> New Deal';
    document.getElementById('deal-stage').value = 'new_lead';
    document.getElementById('deal-value').value = '';
    document.getElementById('deal-notes').value = '';

    if(prefillContactId){
      const c = salesLoad().find(x=>x.id===prefillContactId);
      if(c){
        document.getElementById('deal-contact-name').value  = [c.firstName,c.lastName].filter(Boolean).join(' ');
        document.getElementById('deal-contact-email').value = c.email||'';
        document.getElementById('deal-company').value       = c.company||'';
        document.getElementById('deal-city').value          = c.city||'';
      }
    } else {
      document.getElementById('deal-contact-name').value  = '';
      document.getElementById('deal-contact-email').value = '';
      document.getElementById('deal-company').value       = '';
      document.getElementById('deal-city').value          = '';
    }
  }
  modal.style.display = 'flex';
}

function closeDealModal(){
  const modal = document.getElementById('sales-deal-modal');
  if(modal) modal.style.display = 'none';
  dealEditingId = null;
}

function dealContactAutofill(val){
  // Try to find matching contact and prefill fields
  const contacts = salesLoad().filter(c=>!c._deleted);
  const name = val.trim().toLowerCase();
  const match = contacts.find(c=>[c.firstName,c.lastName].filter(Boolean).join(' ').toLowerCase()===name);
  if(match){
    document.getElementById('deal-contact-email').value = match.email||'';
    document.getElementById('deal-company').value       = match.company||'';
    document.getElementById('deal-city').value          = match.city||'';
  }
}

function copyDealId(){
  const id = document.getElementById('deal-id-display')?.textContent||'';
  navigator.clipboard.writeText(id).catch(()=>{});
  const btn = document.querySelector('#sales-deal-modal button[onclick="copyDealId()"]');
  if(btn){ btn.textContent='Copied!'; setTimeout(()=>btn.textContent='Copy',1500); }
}

function saveDeal(){
  const all = dealsLoad();
  const id  = document.getElementById('deal-id-display').textContent.trim();
  const contactName  = document.getElementById('deal-contact-name').value.trim();
  const contactEmail = document.getElementById('deal-contact-email').value.trim().toLowerCase();
  const company      = document.getElementById('deal-company').value.trim();
  const city         = document.getElementById('deal-city').value.trim();
  const stage        = document.getElementById('deal-stage').value;
  const value        = parseFloat(document.getElementById('deal-value').value)||0;
  const notes        = document.getElementById('deal-notes').value.trim();

  // Try to link to a contact record
  const contacts = salesLoad();
  const linked = contacts.find(c=>{
    const cName = [c.firstName,c.lastName].filter(Boolean).join(' ').toLowerCase();
    return (contactEmail && c.email && c.email.toLowerCase()===contactEmail) || (contactName && cName===contactName.toLowerCase());
  });

  if(dealEditingId){
    const idx = all.findIndex(d=>d.id===dealEditingId);
    if(idx>=0){
      all[idx] = {...all[idx], contactName, contactEmail, company, city, stage, value, notes,
        contactId: linked?.id||all[idx].contactId||null,
        updatedAt: new Date().toISOString()};
    }
  } else {
    all.push({
      id, contactName, contactEmail, company, city, stage, value, notes,
      contactId: linked?.id||null,
      jobId: null,
      wonAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
  dealsSave(all);
  closeDealModal();
  renderDealsTable();
}

function deleteDeal(id){
  if(!confirm('Delete this deal?')) return;
  dealsSave(dealsLoad().filter(d=>d.id!==id));
  renderDealsTable();
}

function moveDealStage(id, stage){
  const all = dealsLoad();
  const d = all.find(x=>x.id===id);
  if(!d) return;
  d.stage = stage;
  if(stage==='won') d.wonAt = new Date().toISOString().slice(0,10);
  dealsSave(all);
  renderDealsTable();
}

let _pipelineStatFilter = '';
function pipelineFilterStat(f){
  _pipelineStatFilter = _pipelineStatFilter===f ? '' : f;
  const dd = document.getElementById('deals-stage-filter');
  if(dd) dd.value = '';
  renderDealsTable();
}

function renderDealsTable(){
  dealsSyncFirebase().catch(()=>{});
  const all    = dealsLoad();
  const q      = (document.getElementById('deals-search')?.value||'').toLowerCase().trim();
  const sFilter= document.getElementById('deals-stage-filter')?.value||'';
  if(sFilter) _pipelineStatFilter = '';

  let list = all.filter(d=>!d._deleted);
  if(sFilter) list = list.filter(d=>d.stage===sFilter);
  else if(_pipelineStatFilter==='open') list = list.filter(d=>!['won','lost'].includes(d.stage));
  else if(_pipelineStatFilter==='won') list = list.filter(d=>d.stage==='won');
  else if(_pipelineStatFilter==='pipe') list = list.filter(d=>!['won','lost'].includes(d.stage));
  if(q) list = list.filter(d=>[d.id,d.contactName,d.contactEmail,d.company,d.city,d.notes].join(' ').toLowerCase().includes(q));

  // Pipeline stats (top-right bar, clickable filters)
  const statsBar = document.getElementById('sales-pipeline-stats-bar');
  if(statsBar){
    const totalDeals = all.filter(d=>!d._deleted).length;
    const open   = all.filter(d=>!['won','lost'].includes(d.stage)&&!d._deleted);
    const won    = all.filter(d=>d.stage==='won'&&!d._deleted);
    const wonVal = won.reduce((s,d)=>s+(d.value||0),0);
    const pipe   = open.reduce((s,d)=>s+(d.value||0),0);
    const sf = _pipelineStatFilter;
    const pbox = (num, label, color, on, onclick, accentBg, accentBorder) => {
      const st = on
        ? `background:${accentBg};border:2px solid ${accentBorder};border-radius:9px;padding:4px 11px;font-size:11px;color:${color};cursor:pointer;user-select:none`
        : `background:var(--navy-card);border:1px solid var(--border);border-radius:9px;padding:5px 12px;font-size:11px;color:var(--muted);cursor:pointer;user-select:none`;
      return `<div onclick="${onclick}" title="Click to filter" style="${st}"><span style="font-size:13px;font-weight:700;color:${color};display:block">${num}</span>${label}</div>`;
    };
    statsBar.innerHTML =
      pbox(totalDeals, 'Total Deals',    'var(--white)',  !sf,         "pipelineFilterStat('')",          'rgba(255,255,255,.08)', 'var(--white)') +
      pbox(open.length,'Open',           '#7AABFF',       sf==='open', "pipelineFilterStat('open')",      'rgba(122,171,255,.12)', 'rgba(122,171,255,.5)') +
      pbox('$'+wonVal.toLocaleString(), 'Won Revenue',   '#22D97A',   sf==='won',  "pipelineFilterStat('won')",  'rgba(34,217,122,.12)',  'rgba(34,217,122,.5)') +
      pbox('$'+pipe.toLocaleString(),   'Pipeline Value', '#F5C842',  sf==='pipe', "pipelineFilterStat('pipe')", 'rgba(245,200,66,.12)',  'rgba(245,200,66,.5)');
  }

  // Kanban summary
  const kanban = document.getElementById('pipeline-kanban');
  if(kanban){
    kanban.innerHTML = DEAL_STAGES.map(s=>{
      const stageDeals = all.filter(d=>d.stage===s.id&&!d._deleted);
      const stageVal = stageDeals.reduce((sum,d)=>sum+(d.value||0),0);
      return `<div style="background:var(--navy-card);border:1px solid var(--border);border-radius:10px;padding:10px 12px;min-width:120px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:${s.color};margin-bottom:4px">${s.label}</div>
        <div style="font-size:22px;font-weight:800;color:var(--white)">${stageDeals.length}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${stageVal?'$'+stageVal.toLocaleString():''}</div>
      </div>`;
    }).join('');
  }

  const tbody = document.getElementById('deals-table-body');
  if(!tbody) return;
  if(!list.length){
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--muted);padding:32px">${q||sFilter?'No deals match your filter.':'No deals yet — click "+ New Deal" to start tracking'}</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(d=>{
    const stage = DEAL_STAGES.find(s=>s.id===d.stage)||DEAL_STAGES[0];
    const jobLink = d.jobId ? `<span style="font-size:10px;color:#22D97A;margin-left:4px" title="Linked to job #${d.jobId}">Job</span>` : '';
    return `<tr>
      <td style="font-family:monospace;font-weight:700;color:var(--blue-bright);white-space:nowrap;font-size:12px">${escSalesHtml(d.id)}${jobLink}</td>
      <td style="font-weight:600;color:var(--white)">${escSalesHtml(d.contactName||'—')}</td>
      <td>${escSalesHtml(d.company||'—')}</td>
      <td style="font-size:12px;color:var(--muted)">${escSalesHtml(d.city||'—')}</td>
      <td><span class="sales-status-badge" style="background:${stage.color}22;color:${stage.color}">${stage.label}</span></td>
      <td style="font-weight:600;color:var(--white)">${d.value?'$'+Number(d.value).toLocaleString():'—'}</td>
      <td style="max-width:160px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--muted);font-size:12px" title="${escSalesAttr(d.notes||'')}">${escSalesHtml((d.notes||'').slice(0,50))||'—'}</td>
      <td style="font-size:11px;color:var(--muted);white-space:nowrap">${(d.createdAt||'').slice(0,10)}</td>
      <td style="text-align:right;white-space:nowrap">
        <select onchange="moveDealStage('${escSalesAttr(d.id)}',this.value);this.value=''" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:11px;cursor:pointer;margin-right:4px">
          <option value="">Move…</option>
          ${DEAL_STAGES.map(s=>`<option value="${s.id}">${s.label}</option>`).join('')}
        </select>
        <button class="sales-action-btn" onclick="openDealModal('${escSalesAttr(d.id)}')" title="Edit">✏</button>
        <button class="sales-action-btn" style="color:#FF7070;border-color:#FF7070" onclick="deleteDeal('${escSalesAttr(d.id)}')" title="Delete">✕</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Quote tab: Deal ID lookup ──
function onDealIdInput(val){
  const preview = document.getElementById('job-deal-preview');
  if(!preview) return;
  const id = val.trim().toUpperCase();
  if(!id){ preview.textContent=''; return; }
  const deal = dealsLoad().find(d=>d.id===id);
  if(deal){
    const stage = DEAL_STAGES.find(s=>s.id===deal.stage);
    preview.innerHTML = `<span style="color:#22D97A">✓ Found:</span> <strong style="color:var(--white)">${escSalesHtml(deal.contactName||'?')}</strong> · ${escSalesHtml(deal.company||'')} · <span style="color:${stage?.color||'#7AABFF'}">${stage?.label||deal.stage}</span>`;
  } else {
    preview.innerHTML = `<span style="color:#FF7070">Deal not found</span>`;
  }
}

// ── Called by saveJob() to mark a deal as Won ──
function linkDealToJob(dealId, jobId, jobAmount){
  const all = dealsLoad();
  const idx = all.findIndex(d=>d.id===dealId);
  if(idx<0) return;
  all[idx].stage  = 'won';
  all[idx].jobId  = jobId;
  all[idx].wonAt  = new Date().toISOString().slice(0,10);
  if(jobAmount && !all[idx].value) all[idx].value = jobAmount;
  dealsSave(all);

  // Move the linked contact to Existing Clients
  const contactId = all[idx].contactId;
  if(contactId){
    const contacts = salesLoad();
    const cIdx = contacts.findIndex(c=>c.id===contactId);
    if(cIdx>=0 && contacts[cIdx].list!=='clients'){
      contacts[cIdx].list   = 'clients';
      contacts[cIdx].status = 'client';
      salesSave(contacts);
      syncSalesCRMToClient(contacts[cIdx]);
    }
  }
}
