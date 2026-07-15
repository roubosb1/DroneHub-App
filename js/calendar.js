// ─── CALENDAR ────────────────────────────────────────────────────────────────
let calYear=new Date().getFullYear(), calMonth=new Date().getMonth();

let _mcNavDir=0; // direction hint for mobile slide animation (set before renderCalendar)
let _mobCalSelDate=new Date().toISOString().slice(0,10);

var _calView='week';
var _calSelectedDate=new Date().toISOString().slice(0,10);

function calNav(dir){
  if(window.innerWidth>768){
    if(_calView==='day'){
      const d=new Date(_calSelectedDate+'T12:00:00');
      d.setDate(d.getDate()+dir);
      _calSelectedDate=d.toISOString().slice(0,10);
      calYear=d.getFullYear(); calMonth=d.getMonth();
      _calSlideTransition('cal-day-view',dir,()=>renderCalDayView(_calSelectedDate)); return;
    }
    if(_calView==='week'){
      const d=new Date(_calSelectedDate+'T12:00:00');
      d.setDate(d.getDate()+dir*7);
      _calSelectedDate=d.toISOString().slice(0,10);
      calYear=d.getFullYear(); calMonth=d.getMonth();
      _calSlideTransition('cal-week-view',dir,()=>renderCalWeekView(_calSelectedDate)); return;
    }
  }
  calMonth+=dir;
  if(calMonth>11){calMonth=0;calYear++;}
  else if(calMonth<0){calMonth=11;calYear--;}
  _mcNavDir=dir;
  if(window.innerWidth>768){
    _calSlideTransition('cal-month-view',dir,()=>renderCalendar());
  } else {
    renderCalendar();
  }
}
function _calSlideTransition(elId,dir,renderFn){
  const el=document.getElementById(elId);
  if(!el){renderFn();return;}
  const ease='cubic-bezier(.4,0,.2,1)';
  const slideOut=dir>0?'-40px':'40px';
  const slideIn=dir>0?'40px':'-40px';
  el.animate([
    {opacity:1,transform:'translateX(0)'},
    {opacity:0,transform:'translateX('+slideOut+')'}
  ],{duration:180,easing:ease,fill:'forwards'}).onfinish=()=>{
    el.getAnimations().forEach(a=>a.cancel());
    renderFn();
    el.animate([
      {opacity:0,transform:'translateX('+slideIn+')'},
      {opacity:1,transform:'translateX(0)'}
    ],{duration:220,easing:ease,fill:'forwards'}).onfinish=()=>{
      el.getAnimations().forEach(a=>a.cancel());
    };
  };
}
function calToday(){
  const t=new Date();
  calYear=t.getFullYear(); calMonth=t.getMonth();
  _calSelectedDate=t.toISOString().slice(0,10);
  _mobCalSelDate=_calSelectedDate;
  _mcNavDir=0;
  if(window.innerWidth>768){
    if(_calView==='day'){renderCalDayView(_calSelectedDate);return;}
    if(_calView==='week'){renderCalWeekView(_calSelectedDate);return;}
  }
  renderCalendar();
}
function calViewRefresh(){
  if(window.innerWidth>768){
    if(_calView==='day'){renderCalDayView(_calSelectedDate);return;}
    if(_calView==='week'){renderCalWeekView(_calSelectedDate);return;}
  }
  renderCalendar();
}

// ── Switch between Day / Week / Month views ──────────────────────────────────
let _calTransiting=false;
function setCalView(view,dateStr){
  if(window.innerWidth<=768||_calTransiting) return;
  const prevView=_calView;
  _calView=view;
  if(dateStr){
    _calSelectedDate=dateStr;
    const d=new Date(dateStr+'T12:00:00');
    calYear=d.getFullYear(); calMonth=d.getMonth();
  }
  ['day','week','month'].forEach(v=>{
    const btn=document.getElementById('cal-vbtn-'+v);
    if(!btn) return;
    const on=v===view;
    btn.style.background=on?'rgba(91,141,239,.18)':'transparent';
    btn.style.color=on?'var(--blue-bright)':'var(--muted)';
  });
  const mv=document.getElementById('cal-month-view');
  const dv=document.getElementById('cal-day-view');
  const wv=document.getElementById('cal-week-view');
  const views={month:mv,day:dv,week:wv};
  const order={month:0,week:1,day:2};
  const zoomingIn=order[view]>order[prevView];
  const oldEl=views[prevView];
  const newEl=views[view];
  if(oldEl&&newEl&&prevView!==view){
    _calTransiting=true;
    const wrap=oldEl.parentElement;
    const wrapH=wrap.offsetHeight;
    wrap.style.minHeight=wrapH+'px';
    wrap.classList.add('cal-wrap-transitioning');
    if(view==='month') renderCalendar();
    else if(view==='day') renderCalDayView(_calSelectedDate);
    else if(view==='week') renderCalWeekView(_calSelectedDate);
    newEl.style.display=view==='month'?'':'block';
    const dur=500;
    const ease='cubic-bezier(.25,.1,.25,1)';
    if(zoomingIn){
      // Infinite zoom in: old scales way up and dissolves, new grows from small behind it
      oldEl.style.zIndex='2';
      newEl.style.zIndex='1';
      oldEl.animate([
        {transform:'scale(1)',opacity:1,offset:0},
        {transform:'scale(1.8)',opacity:.6,offset:.4},
        {transform:'scale(3)',opacity:0,offset:1}
      ],{duration:dur,easing:ease,fill:'forwards'});
      newEl.animate([
        {transform:'scale(.4)'},
        {transform:'scale(1)'}
      ],{duration:dur,easing:ease,fill:'forwards'});
    } else {
      // Infinite zoom out: old shrinks down and dissolves, new descends from large behind it
      oldEl.style.zIndex='2';
      newEl.style.zIndex='1';
      oldEl.animate([
        {transform:'scale(1)',opacity:1,offset:0},
        {transform:'scale(.5)',opacity:.6,offset:.4},
        {transform:'scale(.2)',opacity:0,offset:1}
      ],{duration:dur,easing:ease,fill:'forwards'});
      newEl.animate([
        {transform:'scale(3)'},
        {transform:'scale(1)'}
      ],{duration:dur,easing:ease,fill:'forwards'});
    }
    setTimeout(()=>{
      oldEl.style.display='none';
      oldEl.getAnimations().forEach(a=>a.cancel());
      newEl.getAnimations().forEach(a=>a.cancel());
      oldEl.style.zIndex='';newEl.style.zIndex='';
      wrap.classList.remove('cal-wrap-transitioning');
      wrap.style.minHeight='';
      _calTransiting=false;
    },dur+20);
  } else {
    if(mv) mv.style.display=view==='month'?'':'none';
    if(dv) dv.style.display=view==='day'?'block':'none';
    if(wv) wv.style.display=view==='week'?'block':'none';
    if(view==='month') renderCalendar();
    else if(view==='day') renderCalDayView(_calSelectedDate);
    else if(view==='week') renderCalWeekView(_calSelectedDate);
  }
}

// ── Gather all events for a given date string ─────────────────────────────────
function calGetDayEvents(dateStr){
  const filterCreator=document.getElementById('cal-filter-contractor')?.value||'';
  const evts=[];
  // Jobs / shoots
  savedJobs.forEach(j=>{
    if(j.date!==dateStr) return;
    const names=new Set();
    Object.values(j.payouts||{}).forEach(p=>{if(p.name&&!p.name.includes('unassigned'))names.add(p.name);});
    const ts=getTrackerStage(j.id);
    if(ts.videographer) names.add(ts.videographer);
    if(ts.claimedBy) names.add(ts.claimedBy);
    const primary=getJobCreator(j)||'Unknown';
    if(!names.size) names.add(primary);
    if(filterCreator&&!names.has(filterCreator)) return;
    const creator=names.has(filterCreator)&&filterCreator?filterCreator:primary;
    evts.push({_src:'shoot',_creator:creator,_time:j.shootTime||null,name:j.name,_job:j,_col:getCreatorColor(creator)});
  });
  // GCal events
  getGcalLinks().forEach(link=>{
    if(link.enabled===false) return;
    (link.events||[]).forEach(ev=>{
      if(ev.date!==dateStr) return;
      if(filterCreator&&link.creatorName!==filterCreator) return;
      evts.push({_src:'gcal',_creator:link.creatorName,_time:ev.time||null,name:ev.title||'GCal event',_col:getCreatorColor(link.creatorName)});
    });
  });
  // Custom events (vacation etc.) — include if date falls within range
  calEventsLoad().forEach(e=>{
    const s=e.date,en=e.endDate||e.date;
    if(dateStr<s||dateStr>en) return;
    if(filterCreator&&e.memberName!==filterCreator) return;
    const td=CAL_EVENT_TYPES.find(t=>t.id===e.type)||CAL_EVENT_TYPES[CAL_EVENT_TYPES.length-1];
    evts.push({_src:'custom',_creator:e.memberName,_time:e.startTime||null,name:e.title,_typeDef:td,_eventId:e.id,_col:{bg:td.bg,border:td.color,text:td.color}});
  });
  return evts;
}

// ── Day View ──────────────────────────────────────────────────────────────────
function renderCalDayView(dateStr){
  const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d=new Date(dateStr+'T12:00:00');
  const label=document.getElementById('cal-month-label');
  if(label) label.textContent=DAYS[d.getDay()]+', '+MONTHS[d.getMonth()]+' '+d.getDate()+', '+d.getFullYear();
  renderCalFilterBar();
  renderCalLegend();
  const evts=calGetDayEvents(dateStr);
  const timedEvts=evts.filter(e=>e._time);
  const allDayEvts=evts.filter(e=>!e._time);
  // All-day section
  let adHtml='';
  if(allDayEvts.length){
    adHtml=`<div style="background:var(--navy-mid);border:1px solid var(--border);border-radius:10px;padding:10px 14px;margin-bottom:10px">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);margin-bottom:8px">All Day</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">`+
      allDayEvts.map(e=>calDayEventPill(e,dateStr)).join('')+
    `</div></div>`;
  }
  // Timeline rows – in scrollable container
  const now=new Date(); const todayStr=now.toISOString().slice(0,10);
  const isToday=dateStr===todayStr;
  const nowHour=now.getHours(); const nowMin=now.getMinutes();
  let rowsHtml='';
  for(let h=0;h<24;h++){
    const lbl=h===0?'12 AM':h<12?h+' AM':h===12?'12 PM':(h-12)+' PM';
    const hEvts=timedEvts.filter(e=>{
      if(!e._time) return false;
      const parts=e._time.split(':'); return parseInt(parts[0],10)===h;
    });
    const isNowHour=isToday&&h===nowHour;
    const border=h>0?'border-top:1px solid var(--border);':'';
    rowsHtml+=`<div style="padding:0 6px;text-align:right;font-size:10px;color:var(--muted);line-height:1;padding-top:8px;min-height:52px;${border}background:var(--navy-mid)">${lbl}</div>`;
    rowsHtml+=`<div ondblclick="calQuickAdd('${dateStr}',${h},event)" style="min-height:52px;${border}background:${h%2===0?'var(--navy-card)':'var(--navy-mid)'};padding:4px 8px;position:relative;cursor:default">`;
    if(isNowHour){
      const pct=(nowMin/60)*100;
      rowsHtml+=`<div style="position:absolute;left:0;right:0;top:${pct}%;height:2px;background:var(--blue-bright);z-index:2"><span style="position:absolute;left:-6px;top:-4px;width:10px;height:10px;background:var(--blue-bright);border-radius:50%;display:block"></span></div>`;
    }
    hEvts.forEach(e=>{rowsHtml+=calDayEventPill(e,dateStr);});
    rowsHtml+='</div>';
  }
  const timelineHtml=`<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden"><div id="cal-day-scroll" style="overflow-y:auto;max-height:calc(100vh - 240px)"><div style="display:grid;grid-template-columns:52px 1fr">${rowsHtml}</div></div></div>`;
  const cont=document.getElementById('cal-day-view-content');
  if(cont){
    cont.innerHTML=`<div style="margin-bottom:8px;display:flex;align-items:center;gap:8px">
      <button onclick="setCalView('month')" style="border:none;background:none;color:var(--blue-bright);cursor:pointer;font-size:12px;font-weight:600;padding:0;display:flex;align-items:center;gap:4px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><polyline points="15 18 9 12 15 6"/></svg>Month
      </button>
      <span style="color:var(--border);font-size:12px">/</span>
      <span style="font-size:12px;color:var(--muted)">${DAYS[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}</span>
    </div>${adHtml}${timelineHtml}`;
    setTimeout(()=>{const sc=document.getElementById('cal-day-scroll');if(sc)sc.scrollTop=7*52;},50);
  }
}
function calDayEventPill(e,dateStr){
  const c=e._col;
  if(e._src==='custom'){
    const td=e._typeDef;
    return `<div onclick="showCalEventDetail('${e._eventId}')" title="${e.name}" style="padding:5px 10px;border-radius:7px;background:${td.bg};border-left:3px solid ${td.color};color:${td.color};font-size:12px;font-weight:600;cursor:pointer;margin-bottom:4px">${td.svg||td.icon} ${e.name}${e._creator?` <span style="font-size:10px;opacity:.7">— ${e._creator}</span>`:''}</div>`;
  }
  const time=e._time?`<span style="font-size:10px;opacity:.75;margin-right:5px">${e._time.slice(0,5)}</span>`:'';
  if(e._src==='gcal'){
    const safeN=e.name.replace(/'/g,"\\'");const safeC=(e._creator||'').replace(/'/g,"\\'");const safeT=(e._time||'').replace(/'/g,"\\'");
    return `<div onclick="showGcalEventDetail('${safeN}','${safeC}','${safeT}')" title="${e._creator?e._creator+': ':''}${e.name}" style="padding:5px 10px;border-radius:7px;background:${c.bg};border-left:3px solid ${c.border};color:${c.text};font-size:12px;font-weight:600;cursor:pointer;margin-bottom:4px">${time}${e.name}${e._creator?` <span style="font-size:10px;opacity:.7">— ${e._creator}</span>`:''}</div>`;
  }
  return `<div onclick="${e._job?'openJobModal('+e._job.id+')':''}" title="${e._creator?e._creator+': ':''}${e.name}" style="padding:5px 10px;border-radius:7px;background:${c.bg};border-left:3px solid ${c.border};color:${c.text};font-size:12px;font-weight:600;cursor:${e._job?'pointer':'default'};margin-bottom:4px">${time}${e.name}${e._creator?` <span style="font-size:10px;opacity:.7">— ${e._creator}</span>`:''}</div>`;
}

// ── Shared filter pill bar (All / Shoots / event types) ──────────────────────
function renderCalFilterBar(){
  const pillBar=document.getElementById('cal-type-filter-bar');
  if(!pillBar) return;
  const allActive=_calTypeFilters===null;
  const pills=[
    {id:'all',    label:'All',    color:'var(--blue-bright)', svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>'},
    {id:'shoots', label:'Shoots', color:'#22D97A',           svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'},
    ...CAL_EVENT_TYPES
  ];
  pillBar.innerHTML=pills.map(p=>{
    const active=p.id==='all'?allActive:(!allActive&&_calTypeFilters.has(p.id));
    const col=p.color||'var(--blue-bright)';
    return `<button onclick="${p.id==='all'?'calSetAllFilters()':'calToggleTypeFilter(\''+p.id+'\')'}"
      style="padding:4px 11px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;border:1px solid ${active?col:'var(--border)'};background:${active?col+'22':'transparent'};color:${active?col:'var(--muted)'};transition:all .15s;display:inline-flex;align-items:center;gap:5px">
      ${p.svg||''} ${p.label}
    </button>`;
  }).join('');
}

// ── Shared contractor legend ──────────────────────────────────────────────────
function renderCalLegend(){
  const legend=document.getElementById('cal-legend');
  if(!legend) return;
  const filterCreator=document.getElementById('cal-filter-contractor')?.value||'';
  const allNames=new Set();
  savedJobs.forEach(j=>{
    Object.values(j.payouts||{}).forEach(p=>{
      if(p.name&&!p.name.includes('unassigned')&&!p.name.includes('no ')) allNames.add(p.name);
    });
    const ts=getTrackerStage(j.id);
    if(ts.videographer) allNames.add(ts.videographer);
    if(ts.claimedBy) allNames.add(ts.claimedBy);
  });
  Object.values(CONTRACTORS).forEach(c=>allNames.add(c.name));
  getGcalLinks().forEach(l=>allNames.add(l.creatorName));
  calEventsLoad().forEach(e=>{if(e.memberName)allNames.add(e.memberName);});
  const used=filterCreator?new Set([filterCreator]):allNames;
  if(used.size){
    legend.style.display='flex';
    legend.innerHTML=Array.from(used).sort().map(name=>{
      const col=getCreatorColor(name);
      const isActive=filterCreator===name;
      return `<div style="display:flex;align-items:center;gap:5px;padding:3px 8px;border-radius:10px;background:${col.bg};border:1px solid ${isActive?col.text:col.border};cursor:pointer;opacity:${filterCreator&&!isActive?.45:1};transition:opacity .15s,border-color .15s" onclick="(function(){var el=document.getElementById('cal-filter-contractor');el.value=el.value==='${name}'?'':'${name}';calViewRefresh();})()">
        <span style="width:8px;height:8px;border-radius:50%;background:${col.border};flex-shrink:0"></span>
        <span style="font-size:11px;font-weight:600;color:${col.text}">${name}</span>
        ${isActive?`<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="${col.text}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`:''}
      </div>`;
    }).join('');
  } else {
    legend.style.display='none';
  }
}

document.addEventListener('click',function(e){
  const wrap=document.getElementById('cal-create-wrap');
  const dd=document.getElementById('cal-create-dd');
  if(dd&&wrap&&!wrap.contains(e.target)) dd.style.display='none';
});

// ── Week View ─────────────────────────────────────────────────────────────────
function renderCalWeekView(dateStr){
  const DAYS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  // Get week start (Sunday)
  const anchor=new Date(dateStr+'T12:00:00');
  const dow=anchor.getDay();
  const weekStart=new Date(anchor); weekStart.setDate(anchor.getDate()-dow);
  const weekDays=[];
  for(let i=0;i<7;i++){const dd=new Date(weekStart);dd.setDate(weekStart.getDate()+i);weekDays.push(dd);}
  // Update label
  const label=document.getElementById('cal-month-label');
  if(label){
    const s=weekDays[0],e=weekDays[6];
    const sameMonth=s.getMonth()===e.getMonth();
    label.textContent=sameMonth?MONTHS[s.getMonth()]+' '+s.getDate()+'–'+e.getDate()+', '+s.getFullYear():MONTHS[s.getMonth()]+' '+s.getDate()+' – '+MONTHS[e.getMonth()]+' '+e.getDate()+', '+e.getFullYear();
  }
  renderCalFilterBar();
  renderCalLegend();
  const todayStr=new Date().toISOString().slice(0,10);
  const now=new Date(); const nowHour=now.getHours(); const nowMin=now.getMinutes();
  // Collect events for each day
  const dayEvts=weekDays.map(dd=>calGetDayEvents(dd.toISOString().slice(0,10)));
  const hasAllDay=dayEvts.some(evts=>evts.some(e=>!e._time));

  // ── Sticky column headers ──
  let colHeaderHtml=`<div style="display:grid;grid-template-columns:52px repeat(7,1fr);position:sticky;top:0;z-index:10;background:var(--navy-mid);border-bottom:1px solid var(--border)">`;
  colHeaderHtml+=`<div style="border-right:1px solid var(--border);padding:6px"></div>`;
  colHeaderHtml+=weekDays.map((dd,i)=>{
    const ds=dd.toISOString().slice(0,10);
    const isToday=ds===todayStr;
    return `<div onclick="setCalView('day','${ds}')" style="${i<6?'border-right:1px solid var(--border);':''}padding:8px 4px;text-align:center;cursor:pointer;transition:background .12s" onmouseover="this.style.background='rgba(255,255,255,.05)'" onmouseout="this.style.background=''">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;color:var(--muted)">${DAYS[dd.getDay()]}</div>
      <div style="font-size:${isToday?'16':'14'}px;font-weight:${isToday?'800':'500'};color:${isToday?'var(--blue-bright)':'var(--offwhite)'};line-height:1.2;margin-top:2px">${dd.getDate()}${isToday?'<div style="width:6px;height:6px;background:var(--blue-bright);border-radius:50%;margin:2px auto 0"></div>':''}</div>
    </div>`;
  }).join('');
  colHeaderHtml+='</div>';

  // ── Optional sticky all-day row ──
  let allDayHtml='';
  if(hasAllDay){
    allDayHtml=`<div style="display:grid;grid-template-columns:52px repeat(7,1fr);position:sticky;top:44px;z-index:9;background:var(--navy-mid);border-bottom:1px solid var(--border)">`;
    allDayHtml+=`<div style="padding:6px;font-size:9px;color:var(--muted);font-weight:700;text-transform:uppercase;border-right:1px solid var(--border)">All day</div>`;
    allDayHtml+=weekDays.map((dd,i)=>`<div style="padding:4px;min-height:32px;${i<6?'border-right:1px solid var(--border);':''}">
      ${dayEvts[i].filter(e=>!e._time).map(e=>calWeekEventChip(e)).join('')}
    </div>`).join('');
    allDayHtml+='</div>';
  }

  // ── Hour rows ──
  let hoursHtml=`<div style="display:grid;grid-template-columns:52px repeat(7,1fr)">`;
  for(let h=0;h<24;h++){
    const lbl=h===0?'12 AM':h<12?h+' AM':h===12?'12 PM':(h-12)+' PM';
    hoursHtml+=`<div style="font-size:10px;color:var(--muted);padding:8px 6px 0;text-align:right;min-height:52px;${h>0?'border-top:1px solid var(--border);':''}background:var(--navy-mid)">${lbl}</div>`;
    weekDays.forEach((dd,i)=>{
      const ds=dd.toISOString().slice(0,10);
      const isToday=ds===todayStr;
      const hEvts=dayEvts[i].filter(e=>e._time&&parseInt(e._time.split(':')[0],10)===h);
      const isNowHour=isToday&&h===nowHour;
      hoursHtml+=`<div ondblclick="calQuickAdd('${ds}',${h},event)" style="min-height:52px;${h>0?'border-top:1px solid var(--border);':''}${i<6?'border-right:1px solid var(--border);':''}background:${h%2===0?'var(--navy-card)':'var(--navy-mid)'};padding:2px 3px;position:relative;cursor:default">`;
      if(isNowHour){const pct=(nowMin/60)*100;hoursHtml+=`<div style="position:absolute;left:0;right:0;top:${pct}%;height:2px;background:var(--blue-bright);z-index:2"></div>`;}
      hEvts.forEach(e=>{hoursHtml+=calWeekEventChip(e);});
      hoursHtml+='</div>';
    });
  }
  hoursHtml+='</div>';

  const cont=document.getElementById('cal-week-view-content');
  if(cont){
    cont.innerHTML=`<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden"><div id="cal-week-scroll" style="overflow-y:auto;max-height:calc(100vh - 220px)">${colHeaderHtml}${allDayHtml}${hoursHtml}</div></div>`;
    // Auto-scroll to 7 AM (7 rows × 52px each)
    setTimeout(()=>{const sc=document.getElementById('cal-week-scroll');if(sc)sc.scrollTop=7*52;},50);
  }
}
function calWeekEventChip(e){
  const c=e._col;
  if(e._src==='custom'){
    const td=e._typeDef;
    return `<div onclick="showCalEventDetail('${e._eventId}')" title="${e.name}" style="padding:2px 5px;border-radius:4px;background:${td.bg};border-left:2px solid ${td.color};color:${td.color};font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;cursor:pointer">${td.svg||td.icon} ${e._time?e._time.slice(0,5)+' ':''}${e.name}</div>`;
  }
  if(e._src==='gcal'){
    const safeN=e.name.replace(/'/g,"\\'");const safeC=(e._creator||'').replace(/'/g,"\\'");const safeT=(e._time||'').replace(/'/g,"\\'");
    return `<div onclick="showGcalEventDetail('${safeN}','${safeC}','${safeT}')" title="${e._creator?e._creator+': ':''}${e.name}" style="padding:2px 5px;border-radius:4px;background:${c.bg};border-left:2px solid ${c.border};color:${c.text};font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;cursor:pointer">${e._time?e._time.slice(0,5)+' ':''}${e.name}</div>`;
  }
  return `<div onclick="${e._job?'openJobModal('+e._job.id+')':''}" title="${e._creator?e._creator+': ':''}${e.name}" style="padding:2px 5px;border-radius:4px;background:${c.bg};border-left:2px solid ${c.border};color:${c.text};font-size:10px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px;cursor:${e._job?'pointer':'default'}">${e._time?e._time.slice(0,5)+' ':''}${e.name}</div>`;
}

// ── CUSTOM EVENT TYPES ────────────────────────────────────────────────────────
const CAL_EVENT_TYPES=[
  {id:'shoots',     label:'Shoots',         icon:'📸', color:'#22D97A', bg:'rgba(34,217,122,.14)', svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>'},
  {id:'vacation',   label:'Vacation',       icon:'✈️', color:'#8B5CF6', bg:'rgba(139,92,246,.18)', svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21 4 19.5 2.5S18 2 16.5 3.5L13 7 4.8 5.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>'},
  {id:'sick',       label:'Sick Day',        icon:'🤒', color:'#EF4444', bg:'rgba(239,68,68,.14)',   svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>'},
  {id:'holiday',    label:'Stat Holiday',    icon:'🎉', color:'#F59E0B', bg:'rgba(245,158,11,.14)', svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>'},
  {id:'client_mtg', label:'Client Meeting',  icon:'🤝', color:'#06B6D4', bg:'rgba(6,182,212,.14)',  svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>'},
  {id:'editing',    label:'Edit Day',        icon:'🎬', color:'#10B981', bg:'rgba(16,185,129,.14)', svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.18"/><line x1="7" y1="2" x2="7" y2="22"/><line x1="17" y1="2" x2="17" y2="22"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="2" y1="7" x2="7" y2="7"/><line x1="2" y1="17" x2="7" y2="17"/><line x1="17" y1="17" x2="22" y2="17"/><line x1="17" y1="7" x2="22" y2="7"/></svg>'},
  {id:'travel',     label:'Travel',          icon:'🚗', color:'#6366F1', bg:'rgba(99,102,241,.14)', svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>'},
  {id:'team_mtg',   label:'Team Meeting',    icon:'👥', color:'#EC4899', bg:'rgba(236,72,153,.14)', svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>'},
  {id:'deadline',   label:'Deadline',        icon:'⏰', color:'#F97316', bg:'rgba(249,115,22,.14)', svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>'},
  {id:'other',      label:'Other',           icon:'📌', color:'#64748B', bg:'rgba(100,116,139,.14)',svg:'<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>'},
];

// Active type filters — null = all, otherwise Set of active type ids
let _calTypeFilters=null; // null = show all

function calEventsLoad(){try{return JSON.parse(localStorage.getItem('dronehub_cal_events')||'[]');}catch(e){return[];}}
function calEventsSave(arr){
  try{localStorage.setItem('dronehub_cal_events',JSON.stringify(arr));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':cal_events',{data:JSON.stringify(arr),updatedAt:Date.now()})
      .catch(e=>{
        console.error('[calEventsSave] Firebase write failed:',e.message);
        showDhToast('Calendar not saved','Calendar event could not be saved to the cloud — it may disappear after a page reload.','⚠️','var(--orange)',7000);
      });
  }
}
async function calEventsSyncFirebase(){
  if(!_fbToken()) return;
  try{
    const fb=await fbGet('orgs',ORG_ID+':cal_events');
    if(fb?.data){
      const local=JSON.parse(localStorage.getItem('dronehub_cal_events')||'[]');
      const fbArr=JSON.parse(fb.data);
      if(fbArr.length>=local.length) localStorage.setItem('dronehub_cal_events',JSON.stringify(fbArr));
    }
  }catch(e){}
}

function vacationAllocLoad(){try{return JSON.parse(localStorage.getItem('dronehub_vac_alloc')||'[]');}catch(e){return[];}}
function vacationAllocSave(arr){
  try{localStorage.setItem('dronehub_vac_alloc',JSON.stringify(arr));}catch(e){}
  if(_fbToken()){
    fbSetStrict('orgs',ORG_ID+':vac_alloc',{data:JSON.stringify(arr),updatedAt:Date.now()})
      .catch(e=>{
        console.error('[vacationAllocSave] Firebase write failed:',e.message);
        showDhToast('Time-off not saved','Vacation / time-off data could not be saved to the cloud.','⚠️','var(--orange)',7000);
      });
  }
}

// Count vacation days used by a member in a given year (inclusive date range)
function vacationDaysUsed(memberName, year){
  const evts=calEventsLoad().filter(e=>e.type==='vacation'&&e.memberName===memberName);
  let total=0;
  evts.forEach(e=>{
    const s=new Date(e.date+'T12:00:00');
    const end=new Date((e.endDate||e.date)+'T12:00:00');
    if(s.getFullYear()!==year&&end.getFullYear()!==year) return;
    for(let d=new Date(s);d<=end;d.setDate(d.getDate()+1)){
      if(d.getFullYear()===year) total++;
    }
  });
  return total;
}

// Detect vacation overlap: returns array of {name, dates} for others booked off on same dates
function vacationOverlapCheck(startDate, endDate, excludeName){
  const evts=calEventsLoad().filter(e=>e.type==='vacation'&&e.memberName!==excludeName);
  const overlaps=[];
  evts.forEach(e=>{
    const eStart=new Date(e.date+'T12:00:00');
    const eEnd=new Date((e.endDate||e.date)+'T12:00:00');
    const rStart=new Date(startDate+'T12:00:00');
    const rEnd=new Date((endDate||startDate)+'T12:00:00');
    if(eStart<=rEnd&&eEnd>=rStart) overlaps.push(e.memberName);
  });
  return [...new Set(overlaps)];
}

function calToggleTypeFilter(typeId){
  if(_calTypeFilters===null) _calTypeFilters=new Set(CAL_EVENT_TYPES.map(t=>t.id).concat(['shoots']));
  if(_calTypeFilters.has(typeId)) _calTypeFilters.delete(typeId);
  else _calTypeFilters.add(typeId);
  calViewRefresh();
}
function calSetAllFilters(){_calTypeFilters=null;calViewRefresh();}

// ── Custom event-type dropdown (renders SVG icons) ──────────────────────────
function _calTypeDropdownHtml(id,size){
  const sz=size||'sm';
  const pad=sz==='lg'?'8px 10px':'5px 8px';
  const fs=sz==='lg'?'13px':'12px';
  const rad=sz==='lg'?'8px':'6px';
  const bdr=sz==='lg'?'var(--border-bright)':'var(--border)';
  const first=CAL_EVENT_TYPES[0];
  return `<div id="${id}-wrap" style="position:relative;flex:1">
    <input type="hidden" id="${id}" value="${first.id}">
    <button type="button" onclick="var dd=document.getElementById('${id}-dd');dd.style.display=dd.style.display==='block'?'none':'block'" style="width:100%;padding:${pad};border:1px solid ${bdr};border-radius:${rad};font-size:${fs};background:var(--navy-lift);color:var(--white);cursor:pointer;display:flex;align-items:center;gap:6px;text-align:left">
      <span id="${id}-icon" style="display:inline-flex;color:${first.color}">${first.svg}</span>
      <span id="${id}-label">${first.label}</span>
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2.5" style="margin-left:auto"><polyline points="6 9 12 15 18 9"/></svg>
    </button>
    <div id="${id}-dd" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);background:var(--navy-card);border:1px solid var(--border-bright);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.45);z-index:20;overflow:hidden">
      ${CAL_EVENT_TYPES.map(t=>`<div onclick="_calTypeSelect('${id}','${t.id}')" style="display:flex;align-items:center;gap:8px;padding:7px 10px;cursor:pointer;font-size:${fs};color:var(--offwhite);transition:background .1s" onmouseenter="this.style.background='rgba(91,141,239,.1)'" onmouseleave="this.style.background=''">
        <span style="display:inline-flex;color:${t.color}">${t.svg}</span> ${t.label}
      </div>`).join('')}
    </div>
  </div>`;
}
function _calTypeSelect(id,typeId){
  const t=CAL_EVENT_TYPES.find(x=>x.id===typeId);
  if(!t) return;
  document.getElementById(id).value=typeId;
  document.getElementById(id+'-icon').innerHTML=t.svg;
  document.getElementById(id+'-icon').style.color=t.color;
  document.getElementById(id+'-label').textContent=t.label;
  document.getElementById(id+'-dd').style.display='none';
  if(typeof calEventTypeChanged==='function'&&id==='cae-type') calEventTypeChanged();
}
document.addEventListener('click',function(e){
  CAL_EVENT_TYPES.forEach(()=>{});
  ['qca-type','cae-type'].forEach(id=>{
    const wrap=document.getElementById(id+'-wrap');
    const dd=document.getElementById(id+'-dd');
    if(wrap&&dd&&!wrap.contains(e.target)) dd.style.display='none';
  });
});

// ── Invite picker helpers (team dropdown + client search) ────────────────────
function _calInviteAddTeam(prefix){
  const sel=document.getElementById(prefix+'-team-sel');
  const cont=document.getElementById(prefix+'-team-chips');
  if(!sel||!sel.value) return;
  const name=sel.value;
  if(cont.querySelector('[data-name="'+name+'"]')) return;
  const chip=document.createElement('span');
  chip.dataset.name=name;
  chip.style.cssText='display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600;background:rgba(91,141,239,.15);border:1px solid var(--blue);color:var(--blue-bright)';
  chip.innerHTML=name+'<span onclick="this.parentElement.remove()" style="cursor:pointer;margin-left:2px;font-size:13px;line-height:1">&times;</span>';
  cont.appendChild(chip);
  sel.value='';
}
function _calInviteClientSearch(prefix,e){
  const q=(e.target.value||'').toLowerCase();
  const dd=document.getElementById(prefix+'-client-dd');
  if(!q||q.length<1){dd.style.display='none';return;}
  const existing=new Set(Array.from(document.querySelectorAll('#'+prefix+'-client-chips [data-name]')).map(c=>c.dataset.name));
  const matches=clients.filter(c=>c.name&&c.name.toLowerCase().includes(q)&&!existing.has(c.name)).slice(0,6);
  if(!matches.length){dd.style.display='none';return;}
  dd.style.display='block';
  dd.innerHTML=matches.map(c=>'<div onclick="_calInviteAddClient(\''+prefix+'\',\''+c.name.replace(/'/g,"\\'")+'\');document.getElementById(\''+prefix+'-client-search\').value=\'\';" style="padding:6px 10px;font-size:12px;color:var(--offwhite);cursor:pointer;transition:background .1s" onmouseenter="this.style.background=\'rgba(34,217,122,.1)\'" onmouseleave="this.style.background=\'\'">'+c.name+'</div>').join('');
}
function _calInviteAddClient(prefix,name){
  const cont=document.getElementById(prefix+'-client-chips');
  const dd=document.getElementById(prefix+'-client-dd');
  dd.style.display='none';
  if(cont.querySelector('[data-name="'+name+'"]')) return;
  const chip=document.createElement('span');
  chip.dataset.name=name;
  chip.style.cssText='display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:14px;font-size:11px;font-weight:600;background:rgba(34,217,122,.12);border:1px solid var(--green);color:var(--green)';
  chip.innerHTML=name+'<span onclick="this.parentElement.remove()" style="cursor:pointer;margin-left:2px;font-size:13px;line-height:1">&times;</span>';
  cont.appendChild(chip);
}
function _calGetInvitedTeam(prefix){return Array.from(document.querySelectorAll('#'+prefix+'-team-chips [data-name]')).map(c=>c.dataset.name);}
function _calGetInvitedClients(prefix){return Array.from(document.querySelectorAll('#'+prefix+'-client-chips [data-name]')).map(c=>c.dataset.name);}

// ── Quick-add bubble (double-click on empty calendar space) ──────────────────
function calQuickAdd(dateStr, hour, evt){
  if(evt) evt.stopPropagation();
  const old=document.getElementById('cal-quick-add');
  if(old) old.remove();
  const members=getAdminTeamMembers();
  const session=gateGetSession();
  const startH=hour!=null?hour:9;
  const endH=Math.min(startH+1,23);
  const pad2=n=>String(n).padStart(2,'0');
  const startTime=pad2(startH)+':00';
  const endTime=pad2(endH)+':00';
  const allNames=[session?.name||session?.email||'Me',...members.map(m=>m.name)];
  const clientNames=[...new Set(clients.filter(c=>c.name).map(c=>c.name))].sort();

  const bubble=document.createElement('div');
  bubble.id='cal-quick-add';
  bubble.style.cssText='position:fixed;inset:0;z-index:9700;display:flex;align-items:center;justify-content:center';
  bubble.onclick=e=>{if(e.target===bubble)bubble.remove();};
  bubble.innerHTML=`<div onclick="event.stopPropagation()" style="background:var(--navy-card);border:1px solid var(--border-bright);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.6);width:360px;overflow:hidden">
    <div style="padding:14px 16px;border-bottom:1px solid var(--border)">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="display:flex;gap:6px">
          <button id="qca-tab-event" onclick="document.getElementById('qca-tab-event').style.background='rgba(91,141,239,.2)';document.getElementById('qca-tab-event').style.color='var(--blue-bright)';document.getElementById('qca-tab-event').style.borderColor='var(--blue)';document.getElementById('qca-tab-remind').style.background='transparent';document.getElementById('qca-tab-remind').style.color='var(--muted)';document.getElementById('qca-tab-remind').style.borderColor='var(--border)'" style="padding:5px 16px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid var(--blue);background:rgba(91,141,239,.2);color:var(--blue-bright)">Event</button>
          <button id="qca-tab-remind" onclick="document.getElementById('qca-tab-remind').style.background='rgba(91,141,239,.2)';document.getElementById('qca-tab-remind').style.color='var(--blue-bright)';document.getElementById('qca-tab-remind').style.borderColor='var(--blue)';document.getElementById('qca-tab-event').style.background='transparent';document.getElementById('qca-tab-event').style.color='var(--muted)';document.getElementById('qca-tab-event').style.borderColor='var(--border)'" style="padding:5px 16px;border-radius:20px;font-size:11px;font-weight:700;cursor:pointer;border:1px solid var(--border);background:transparent;color:var(--muted)">Reminder</button>
        </div>
        <button onclick="document.getElementById('cal-quick-add').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:16px;padding:0;line-height:1">✕</button>
      </div>
      <input id="qca-title" type="text" placeholder="New Event" style="width:100%;box-sizing:border-box;padding:8px 0;border:none;border-bottom:1px solid var(--border);background:transparent;color:var(--white);font-size:15px;font-weight:600;outline:none" autofocus>
    </div>
    <div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px">
      <!-- Date -->
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <input id="qca-date" type="date" value="${dateStr}" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-lift);color:var(--white)">
      </div>
      <!-- Times -->
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <input id="qca-start-time" type="time" value="${startTime}" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-lift);color:var(--white)">
        <span style="font-size:11px;color:var(--muted)">to</span>
        <input id="qca-end-time" type="time" value="${endTime}" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-lift);color:var(--white)">
      </div>
      <!-- End date (for multi-day) -->
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>
        <label style="font-size:11px;color:var(--muted);white-space:nowrap">End date</label>
        <input id="qca-end-date" type="date" value="${dateStr}" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-lift);color:var(--white)">
      </div>
      <!-- Event type -->
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
        ${_calTypeDropdownHtml('qca-type','sm')}
      </div>
      <!-- Invite team -->
      <div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span style="font-size:11px;font-weight:600;color:var(--muted)">Invite Team</span>
        </div>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <select id="qca-team-sel" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-lift);color:var(--white)">
            <option value="">Select team member</option>
            ${allNames.map(n=>`<option value="${n}">${n}</option>`).join('')}
          </select>
          <button onclick="_calInviteAddTeam('qca')" style="padding:4px 10px;border-radius:6px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap">+ Add</button>
        </div>
        <div id="qca-team-chips" style="display:flex;flex-wrap:wrap;gap:5px"></div>
      </div>
      <!-- Invite clients -->
      <div>
        <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span style="font-size:11px;font-weight:600;color:var(--muted)">Invite Clients</span>
        </div>
        <div style="position:relative">
          <input id="qca-client-search" type="text" placeholder="Search clients…" oninput="_calInviteClientSearch('qca',event)" autocomplete="off" style="width:100%;box-sizing:border-box;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-lift);color:var(--white)">
          <div id="qca-client-dd" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);background:var(--navy-card);border:1px solid var(--border-bright);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.4);z-index:10;max-height:140px;overflow-y:auto"></div>
        </div>
        <div id="qca-client-chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px"></div>
      </div>
      <!-- Notes -->
      <div style="display:flex;align-items:center;gap:8px">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/></svg>
        <input id="qca-notes" type="text" placeholder="Add notes…" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:6px;font-size:12px;background:var(--navy-lift);color:var(--white)">
      </div>
    </div>
    <div style="padding:8px 16px 14px;display:flex;gap:8px">
      <button onclick="calQuickAddSave()" style="flex:1;padding:8px;border-radius:8px;border:1px solid var(--green);background:rgba(34,217,122,.1);color:var(--green);font-size:12px;font-weight:700;cursor:pointer">Save Event</button>
      <button onclick="document.getElementById('cal-quick-add').remove();openCalEventModal('${dateStr}')" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:11px;cursor:pointer">More options</button>
    </div>
  </div>`;
  document.body.appendChild(bubble);
  setTimeout(()=>document.getElementById('qca-title')?.focus(),80);
}
function calQuickAddSave(){
  const title=(document.getElementById('qca-title')?.value||'').trim()||'New Event';
  const type=document.getElementById('qca-type')?.value||'other';
  const dateStr=document.getElementById('qca-date')?.value||new Date().toISOString().slice(0,10);
  const endDate=document.getElementById('qca-end-date')?.value||dateStr;
  const startTime=document.getElementById('qca-start-time')?.value||'';
  const endTime=document.getElementById('qca-end-time')?.value||'';
  const notes=(document.getElementById('qca-notes')?.value||'').trim();
  const invitedTeam=_calGetInvitedTeam('qca');
  const invitedClients=_calGetInvitedClients('qca');
  const memberName=invitedTeam[0]||'';
  const evts=calEventsLoad();
  evts.push({id:'cale_'+Date.now(),title,type,date:dateStr,endDate,startTime,endTime,memberName,invitees:invitedTeam,clientInvitees:invitedClients,notes});
  calEventsSave(evts);
  document.getElementById('cal-quick-add')?.remove();
  calViewRefresh();
  if(type==='vacation') renderVacationTracker();
  const totalInv=invitedTeam.length+invitedClients.length;
  showDhToast('Event created',title+(totalInv>1?' — '+totalInv+' people invited':' added to calendar'),'','var(--green)',3000);
}

// Open add-event modal
function openCalEventModal(prefillDate){
  const members=getAdminTeamMembers();
  const session=gateGetSession();
  const modal=document.createElement('div');
  modal.id='cal-event-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9800;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:480px;border:1px solid var(--border-bright)" onclick="event.stopPropagation()">
    <div style="background:var(--navy-mid);padding:14px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;border-radius:16px 16px 0 0">
      <div style="font-size:14px;font-weight:700;color:var(--white)">Add Calendar Event</div>
      <button onclick="document.getElementById('cal-event-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:18px">✕</button>
    </div>
    <div style="padding:18px;display:flex;flex-direction:column;gap:12px">
      <div>
        <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Event title</label>
        <input id="cae-title" type="text" placeholder="e.g. Bailey – Vacation" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
      </div>
      <div>
        <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Event type</label>
        ${_calTypeDropdownHtml('cae-type','lg')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Start date</label>
          <input id="cae-start" type="date" value="${prefillDate||new Date().toISOString().slice(0,10)}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">End date</label>
          <input id="cae-end" type="date" value="${prefillDate||new Date().toISOString().slice(0,10)}" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Start time <span style="font-weight:400;text-transform:none;letter-spacing:0;opacity:.7">(blank = all day)</span></label>
          <input id="cae-start-time" type="time" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
        </div>
        <div>
          <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">End time</label>
          <input id="cae-end-time" type="time" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
        </div>
      </div>
      <div>
        <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Invite Team</label>
        <div style="display:flex;gap:6px;margin-bottom:6px">
          <select id="cae-team-sel" style="flex:1;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
            <option value="">Select team member</option>
            ${[{name:session?.name||session?.email||'Me'},...members].map(m=>`<option value="${m.name}">${m.name}</option>`).join('')}
          </select>
          <button type="button" onclick="_calInviteAddTeam('cae')" style="padding:6px 14px;border-radius:8px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">+ Add</button>
        </div>
        <div id="cae-team-chips" style="display:flex;flex-wrap:wrap;gap:5px"></div>
      </div>
      <div>
        <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:6px">Invite Clients</label>
        <div style="position:relative">
          <input id="cae-client-search" type="text" placeholder="Search clients…" oninput="_calInviteClientSearch('cae',event)" autocomplete="off" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white)">
          <div id="cae-client-dd" style="display:none;position:absolute;left:0;right:0;top:calc(100% + 2px);background:var(--navy-card);border:1px solid var(--border-bright);border-radius:8px;box-shadow:0 6px 20px rgba(0,0,0,.4);z-index:10;max-height:160px;overflow-y:auto"></div>
        </div>
        <div id="cae-client-chips" style="display:flex;flex-wrap:wrap;gap:5px;margin-top:6px"></div>
      </div>
      <div id="cae-overlap-warn" style="display:none;padding:8px 12px;border-radius:8px;background:rgba(249,115,22,.12);border:1px solid rgba(249,115,22,.4);font-size:11px;color:#F97316"></div>
      <div>
        <label style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;display:block;margin-bottom:4px">Notes (optional)</label>
        <textarea id="cae-notes" placeholder="Any details…" rows="2" style="width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:13px;background:var(--navy-lift);color:var(--white);resize:none;font-family:var(--font)"></textarea>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="saveCalEvent()" style="flex:1;padding:9px;border-radius:10px;border:1px solid var(--green);background:rgba(34,217,122,.1);color:var(--green);font-size:13px;font-weight:700;cursor:pointer">Save event</button>
        <button onclick="document.getElementById('cal-event-modal').remove()" style="padding:9px 16px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:12px;cursor:pointer">Cancel</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
  setTimeout(()=>document.getElementById('cae-title')?.focus(),100);
  // Live overlap check on date/member change
  ['cae-start','cae-end'].forEach(id=>{
    document.getElementById(id)?.addEventListener('change',calEventCheckOverlap);
  });
}

function calEventTypeChanged(){
  const type=document.getElementById('cae-type')?.value;
  const isVac=type==='vacation';
  // For vacation, run overlap check
  if(isVac) calEventCheckOverlap();
  else document.getElementById('cae-overlap-warn').style.display='none';
}

function calEventCheckOverlap(){
  const type=document.getElementById('cae-type')?.value;
  if(type!=='vacation'){document.getElementById('cae-overlap-warn').style.display='none';return;}
  const start=document.getElementById('cae-start')?.value;
  const end=document.getElementById('cae-end')?.value||start;
  const invitedTeam=_calGetInvitedTeam('cae');
  const warn=document.getElementById('cae-overlap-warn');
  const allOverlaps=new Set();
  invitedTeam.forEach(m=>{vacationOverlapCheck(start,end,m).forEach(o=>allOverlaps.add(o));});
  if(allOverlaps.size){
    warn.style.display='block';
    const names=[...allOverlaps];
    warn.innerHTML=`${_icon('warn',14)} <strong>Vacation overlap:</strong> ${names.join(', ')} ${names.length===1?'is':'are'} also off during this period.`;
  } else {
    warn.style.display='none';
  }
}

function saveCalEvent(){
  const title=document.getElementById('cae-title')?.value.trim();
  const type=document.getElementById('cae-type')?.value;
  const start=document.getElementById('cae-start')?.value;
  const end=document.getElementById('cae-end')?.value||start;
  const startTime=document.getElementById('cae-start-time')?.value||'';
  const endTime=document.getElementById('cae-end-time')?.value||'';
  const invitedTeam=_calGetInvitedTeam('cae');
  const invitedClients=_calGetInvitedClients('cae');
  const member=invitedTeam[0]||'';
  const notes=document.getElementById('cae-notes')?.value.trim()||'';
  if(!title){alert('Please enter a title.');return;}
  if(!start){alert('Please select a start date.');return;}
  if(end<start){alert('End date cannot be before start date.');return;}
  if(startTime&&endTime&&start===end&&endTime<startTime){alert('End time cannot be before start time.');return;}
  const evt={id:'cale_'+Date.now(),type,title,date:start,endDate:end,startTime,endTime,memberName:member,invitees:invitedTeam,clientInvitees:invitedClients,notes,createdAt:new Date().toISOString()};
  const arr=calEventsLoad();arr.push(evt);calEventsSave(arr);
  document.getElementById('cal-event-modal').remove();
  calViewRefresh();renderVacationTracker();
  const totalInv=invitedTeam.length+invitedClients.length;
  showDhToast('Event added',totalInv>1?totalInv+' people invited':'','','var(--green)',3000);
}

function deleteCalEvent(id){
  if(!confirm('Delete this event?')) return;
  calEventsSave(calEventsLoad().filter(e=>String(e.id)!==String(id)));
  calViewRefresh();renderVacationTracker();
}

// ── Event detail pop-up ───────────────────────────────────────────────────────
function showCalEventDetail(eventId){
  const evt=calEventsLoad().find(e=>String(e.id)===String(eventId));
  if(!evt) return;
  const td=CAL_EVENT_TYPES.find(t=>t.id===evt.type)||CAL_EVENT_TYPES[CAL_EVENT_TYPES.length-1];
  const fmtD=d=>{const dt=new Date(d+'T12:00:00');return dt.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});};
  const dateLabel=(!evt.endDate||evt.date===evt.endDate)?fmtD(evt.date):fmtD(evt.date)+' – '+fmtD(evt.endDate);
  document.getElementById('cal-detail-modal')?.remove();
  const modal=document.createElement('div');
  modal.id='cal-detail-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9800;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:420px;border:1px solid var(--border-bright)" onclick="event.stopPropagation()">
    <div style="background:${td.bg};padding:16px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;border-radius:16px 16px 0 0">
      <div>
        <div style="font-size:22px;margin-bottom:4px">${td.icon}</div>
        <div style="font-size:15px;font-weight:700;color:${td.color}">${evt.title}</div>
        <div style="font-size:11px;color:${td.color};opacity:.75;margin-top:2px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">${td.label}</div>
      </div>
      <button onclick="document.getElementById('cal-detail-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:20px;line-height:1;margin-top:-2px">✕</button>
    </div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:center;gap:10px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        <span style="font-size:13px;color:var(--offwhite)">${dateLabel}${evt.startTime?' · '+evt.startTime+(evt.endTime?' – '+evt.endTime:''):''}</span>
      </div>
      ${evt.memberName?`<div style="display:flex;align-items:center;gap:10px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span style="font-size:13px;color:var(--offwhite)">${evt.memberName}</span>
      </div>`:''}
      ${evt.notes?`<div style="display:flex;align-items:flex-start;gap:10px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-top:1px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <span style="font-size:13px;color:var(--muted);white-space:pre-wrap">${evt.notes}</span>
      </div>`:''}
      <div style="display:flex;gap:8px;margin-top:4px">
        <button onclick="document.getElementById('cal-detail-modal').remove();editCalEvent('${eventId}')" style="flex:1;padding:9px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.1);color:var(--blue-bright);font-size:13px;font-weight:700;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> Edit</button>
        <button onclick="document.getElementById('cal-detail-modal').remove();deleteCalEvent('${eventId}')" style="padding:9px 16px;border-radius:10px;border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.08);color:#EF4444;font-size:13px;font-weight:600;cursor:pointer">Delete</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function showGcalEventDetail(name,creator,time){
  document.getElementById('cal-detail-modal')?.remove();
  const modal=document.createElement('div');
  modal.id='cal-detail-modal';
  modal.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9800;display:flex;align-items:center;justify-content:center;padding:20px';
  modal.onclick=e=>{if(e.target===modal)modal.remove();};
  modal.innerHTML=`<div style="background:var(--navy-card);border-radius:16px;width:100%;max-width:380px;border:1px solid var(--border-bright)" onclick="event.stopPropagation()">
    <div style="background:rgba(6,182,212,.1);padding:16px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:flex-start;border-radius:16px 16px 0 0">
      <div>
        <div style="margin-bottom:4px;color:var(--muted)">${_icon('calendar',22)}</div>
        <div style="font-size:15px;font-weight:700;color:var(--white)">${name}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px;font-weight:600;text-transform:uppercase;letter-spacing:.05em">Google Calendar</div>
      </div>
      <button onclick="document.getElementById('cal-detail-modal').remove()" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:20px;line-height:1;margin-top:-2px">✕</button>
    </div>
    <div style="padding:16px 18px;display:flex;flex-direction:column;gap:10px">
      ${time?`<div style="display:flex;align-items:center;gap:10px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        <span style="font-size:13px;color:var(--offwhite)">${time.slice(0,5)}</span>
      </div>`:''}
      ${creator?`<div style="display:flex;align-items:center;gap:10px">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span style="font-size:13px;color:var(--offwhite)">${creator}</span>
      </div>`:''}
      <div style="margin-top:4px;padding:8px 12px;border-radius:8px;background:var(--navy-mid);font-size:11px;color:var(--muted)">Google Calendar events can be edited in Google Calendar directly.</div>
      <button onclick="document.getElementById('cal-detail-modal').remove()" style="padding:9px;border-radius:10px;border:1px solid var(--border);background:var(--navy-lift);color:var(--offwhite);font-size:13px;font-weight:600;cursor:pointer">Close</button>
    </div>
  </div>`;
  document.body.appendChild(modal);
}

function editCalEvent(eventId){
  const evt=calEventsLoad().find(e=>String(e.id)===String(eventId));
  if(!evt){showDhToast('Edit failed','Event not found (id: '+eventId+', total: '+calEventsLoad().length+')','⚠','var(--orange)',5000);return;}
  openCalEventModal(evt.date);
  setTimeout(()=>{
    const t=document.getElementById('cae-title');
    const s=document.getElementById('cae-start');const en=document.getElementById('cae-end');
    const st=document.getElementById('cae-start-time');const et=document.getElementById('cae-end-time');
    const n=document.getElementById('cae-notes');
    if(t) t.value=evt.title;
    if(s) s.value=evt.date;if(en) en.value=evt.endDate||evt.date;
    if(st) st.value=evt.startTime||'';if(et) et.value=evt.endTime||'';
    if(n) n.value=evt.notes||'';
    if(evt.type) _calTypeSelect('cae-type',evt.type);
    (evt.invitees||[evt.memberName].filter(Boolean)).forEach(name=>{
      const sel=document.getElementById('cae-team-sel');
      if(sel){sel.value=name;_calInviteAddTeam('cae');}
    });
    (evt.clientInvitees||[]).forEach(name=>_calInviteAddClient('cae',name));
    const hdr=document.querySelector('#cal-event-modal div[style*="Add Calendar Event"]');
    if(hdr) hdr.textContent='Edit Event';
    const sBtn=document.querySelector('#cal-event-modal button[onclick="saveCalEvent()"]');
    if(sBtn){sBtn.textContent='Update event';sBtn.setAttribute('onclick','updateCalEvent(\''+eventId+'\')');}
  },60);
}

function updateCalEvent(eventId){
  const title=document.getElementById('cae-title')?.value.trim();
  const type=document.getElementById('cae-type')?.value;
  const start=document.getElementById('cae-start')?.value;
  const end=document.getElementById('cae-end')?.value||start;
  const startTime=document.getElementById('cae-start-time')?.value||'';
  const endTime=document.getElementById('cae-end-time')?.value||'';
  const invitedTeam=_calGetInvitedTeam('cae');
  const invitedClients=_calGetInvitedClients('cae');
  const member=invitedTeam[0]||'';
  const notes=document.getElementById('cae-notes')?.value.trim()||'';
  if(!title){alert('Please enter a title.');return;}
  if(!start){alert('Please select a start date.');return;}
  if(end<start){alert('End date cannot be before start date.');return;}
  if(startTime&&endTime&&start===end&&endTime<startTime){alert('End time cannot be before start time.');return;}
  const arr=calEventsLoad();const idx=arr.findIndex(e=>String(e.id)===String(eventId));
  if(idx===-1){showDhToast('Update failed','Event not found (id: '+eventId+')','⚠','var(--orange)',5000);return;}
  arr[idx]={...arr[idx],type,title,date:start,endDate:end,startTime,endTime,memberName:member,invitees:invitedTeam,clientInvitees:invitedClients,notes,updatedAt:new Date().toISOString()};
  calEventsSave(arr);
  document.getElementById('cal-event-modal')?.remove();
  calViewRefresh();renderVacationTracker();
  showDhToast('Event updated',startTime?(startTime+(endTime?' – '+endTime:'')):'All day','✅','var(--green)',3000);
}

// Vacation tracker panel
function renderVacationTracker(){
  const panel=document.getElementById('vac-tracker-panel');
  if(!panel) return;
  const year=new Date().getFullYear();
  const session=gateGetSession();
  const isAdmin=!session||session.type==='admin'||session.role==='admin';
  let members=getAdminTeamMembers();
  const allocs=vacationAllocLoad();
  if(!members.length){panel.innerHTML='<div style="font-size:12px;color:var(--muted)">No team members yet.</div>';return;}
  // Non-admins: redirect to their own profile page
  if(!isAdmin && session){
    panel.innerHTML=`<div style="padding:12px 0;display:flex;align-items:center;gap:10px">
      <span style="font-size:12px;color:var(--muted)">View and manage your time off from your profile page.</span>
      <button onclick="openTeamMemberProfile('me')" style="padding:5px 14px;border-radius:8px;border:1px solid rgba(139,92,246,.4);background:rgba(139,92,246,.1);color:#A78BFA;font-size:12px;font-weight:700;cursor:pointer">My Profile</button>
    </div>`;
    return;
  }
  panel.innerHTML=members.map(m=>{
    const alloc=allocs.find(a=>a.memberId===m.id&&a.year===year)||{allocatedDays:14,manualAdjust:0};
    const calUsed=vacationDaysUsed(m.name,year);
    const used=calUsed+(alloc.manualAdjust||0);
    const remaining=alloc.allocatedDays-used;
    const pct=alloc.allocatedDays>0?Math.min(100,Math.round(used/alloc.allocatedDays*100)):0;
    const barColor=remaining<=0?'var(--red)':remaining<=3?'var(--amber)':'var(--green)';
    return `<div style="padding:12px 14px;background:var(--navy-card);border:1px solid var(--border);border-radius:10px;margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="display:flex;align-items:center;gap:8px">
          ${getAvatarHtml(m.name,m.email,28,9)}
          <div>
            <div style="font-size:13px;font-weight:700;color:var(--white)">${m.name}</div>
            <div style="font-size:10px;color:var(--muted)">${m.role||'team'}</div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div style="text-align:right">
            <div style="font-size:11px;color:var(--muted)">Used / Allocated</div>
            <div style="font-size:13px;font-weight:700;color:${barColor}">${used} <span style="color:var(--muted);font-weight:400">/ ${alloc.allocatedDays} days</span></div>
            ${(alloc.manualAdjust||0)!==0?`<div style="font-size:10px;color:var(--amber)">${(alloc.manualAdjust||0)>0?'+':''}${alloc.manualAdjust} manual adj.</div>`:''}
          </div>
          ${isAdmin?`<button onclick="openVacAllocModal('${m.id}','${m.name}')" title="Edit allocation &amp; used days" style="padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--navy-lift);color:var(--muted);font-size:11px;cursor:pointer"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`:''}
        </div>
      </div>
      <div style="height:6px;background:var(--border);border-radius:3px;overflow:hidden">
        <div style="height:100%;width:${pct}%;background:${barColor};border-radius:3px;transition:width .3s"></div>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;color:var(--muted)">
        <span>${remaining>0?remaining+' days remaining':Math.abs(remaining)+' days over'}</span>
        <span>${year}</span>
      </div>
    </div>`;
  }).join('');
}

async function fetchWeather(lat,lng,locationLabel){
  const card=document.getElementById('weather-card');
  if(!card) return;
  card.style.display='block';
  const locEl=document.getElementById('weather-location-label');
  if(locEl) locEl.textContent=locationLabel||'';
  document.getElementById('weather-daily').innerHTML='<div style="font-size:12px;color:var(--muted);grid-column:1/-1;padding:8px 0">Loading forecast…</div>';
  document.getElementById('weather-hourly-panel').style.display='none';

  const params=`latitude=${lat}&longitude=${lng}`+
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,wind_speed_10m_max`+
    `&hourly=temperature_2m,weather_code,precipitation_probability,wind_speed_10m`+
    `&timezone=auto&forecast_days=7`;

  // Try multiple endpoints in order
  const endpoints=[
    `https://api.open-meteo.com/v1/forecast?${params}`,
    `https://customer-api.open-meteo.com/v1/forecast?${params}`,
  ];

  for(const url of endpoints){
    try{
      const res=await fetch(url,{mode:'cors',headers:{'Accept':'application/json'}});
      if(!res.ok) continue;
      const data=await res.json();
      if(data.error) continue;
      weatherData=data;
      renderWeatherDaily(data);
      return;
    }catch(e){ console.warn('Weather endpoint failed:',url,e); continue; }
  }

  // All endpoints failed — try wttr.in as fallback (different service)
  try{
    const wttrUrl=`https://wttr.in/${lat},${lng}?format=j1`;
    const res=await fetch(wttrUrl);
    if(res.ok){
      const data=await res.json();
      renderWeatherWttr(data);
      return;
    }
  }catch(e){}

  document.getElementById('weather-daily').innerHTML=
    `<div style="font-size:12px;color:var(--amber);grid-column:1/-1;line-height:1.6">
      ⚠ Weather blocked by your browser's privacy settings.<br>
      <span style="font-size:11px;color:var(--muted)">Try opening the site in Chrome, or search 
      <a href="https://www.theweathernetwork.com" target="_blank" style="color:var(--blue-bright)">The Weather Network</a> 
      for the shoot address.</span>
    </div>`;
}

function renderWeatherWttr(data){
  // wttr.in format fallback
  const days=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const weather=data.weather||[];
  document.getElementById('weather-daily').innerHTML=weather.slice(0,7).map((day,i)=>{
    const d=new Date(day.date);
    const dayName=i===0?'Today':days[d.getDay()];
    const hi=Math.round(day.maxtempC);
    const lo=Math.round(day.mintempC);
    const desc=day.hourly?.[4]?.weatherDesc?.[0]?.value||'';
    const rain=day.hourly?.[4]?.chanceofrain||0;
    const wind=Math.round(day.hourly?.[4]?.windspeedKmph||0);
    const emoji=desc.toLowerCase().includes('sun')||desc.toLowerCase().includes('clear')?'☀️':
      desc.toLowerCase().includes('cloud')?'⛅':
      desc.toLowerCase().includes('rain')||desc.toLowerCase().includes('drizzle')?'🌧':
      desc.toLowerCase().includes('snow')?'❄️':
      desc.toLowerCase().includes('thunder')?'⛈':'🌤';
    const rainColor=rain>60?'var(--red)':rain>30?'var(--amber)':'var(--muted)';
    return `<div onclick="event.stopPropagation()"
      style="padding:10px 6px;background:var(--navy-lift);border:1px solid var(--border);border-radius:10px;text-align:center">
      <div style="font-size:10px;font-weight:700;color:${i===0?'var(--blue-bright)':'var(--muted)'};margin-bottom:4px">${dayName}</div>
      <div style="font-size:24px;margin-bottom:4px">${emoji}</div>
      <div style="font-size:12px;font-weight:700;color:var(--white)">${hi}°<span style="color:var(--muted);font-weight:400;margin-left:3px">${lo}°</span></div>
      <div style="font-size:10px;color:${rainColor};margin-top:3px">💧 ${rain}%</div>
      <div style="font-size:9px;color:var(--muted);margin-top:2px">💨 ${wind}km/h</div>
    </div>`;
  }).join('');
}

function renderWeatherDaily(data){
  const{daily}=data;
  const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const shortDays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const codes=daily.weather_code||daily.weathercode||[];
  const windField=daily.wind_speed_10m_max||daily.windspeed_10m_max||[];

  document.getElementById('weather-daily').innerHTML=daily.time.map((dateStr,i)=>{
    const d=new Date(dateStr+'T12:00:00');
    const dayName=i===0?'Today':i===1?'Tomorrow':shortDays[d.getDay()];
    const fullDay=i===0?'Today':i===1?'Tomorrow':days[d.getDay()];
    const code=codes[i]||0;
    const hi=Math.round(daily.temperature_2m_max[i]);
    const lo=Math.round(daily.temperature_2m_min[i]);
    const rain=daily.precipitation_probability_max[i]||0;
    const wind=Math.round(windField[i]||0);
    const emoji=WMO_EMOJI[code]||'🌡';
    const desc=WMO_CODES[code]||'';
    const rainColor=rain>60?'#F87171':rain>30?'var(--amber)':'var(--muted)';
    const shootScore=rain<20&&wind<30?'🟢 Great':rain<40&&wind<50?'🟡 OK':'🔴 Tough';
    return `<div class="weather-day-card" onclick="showWeatherHourly(${i},'${fullDay} ${dateStr.slice(5)}',this)" title="Click for hourly forecast">
      <div style="font-size:11px;font-weight:700;color:${i===0?'var(--blue-bright)':'var(--offwhite)'};margin-bottom:6px">${dayName}</div>
      <div style="font-size:28px;margin-bottom:4px;line-height:1">${emoji}</div>
      <div style="font-size:11px;color:var(--muted);margin-bottom:8px;min-height:28px;line-height:1.4">${desc}</div>
      <div style="font-size:15px;font-weight:700;color:var(--white);margin-bottom:2px">${hi}°<span style="font-size:12px;color:var(--muted);font-weight:400;margin-left:4px">${lo}°</span></div>
      <div style="font-size:10px;color:${rainColor};margin-top:6px">💧 ${rain}%</div>
      <div style="font-size:10px;color:var(--muted);margin-top:2px">💨 ${wind} km/h</div>
      <div style="font-size:9px;margin-top:8px;padding:2px 6px;border-radius:10px;background:var(--navy-card);display:inline-block">${shootScore}</div>
    </div>`;
  }).join('');
}
function showWeatherHourly(dayIndex,label,clickedEl){
  if(!weatherData) return;
  const{hourly}=weatherData;
  const hCodes=hourly.weather_code||hourly.weathercode||[];
  const hWind=hourly.wind_speed_10m||hourly.windspeed_10m||[];
  const start=dayIndex*24;
  const panel=document.getElementById('weather-hourly-panel');
  const container=document.getElementById('weather-hourly');
  if(!panel||!container) return;

  // Toggle — if clicking same active day, close the panel
  if(clickedEl&&clickedEl.classList.contains('wday-active')){
    clickedEl.classList.remove('wday-active');
    panel.style.display='none';
    return;
  }

  // Mark active day
  document.querySelectorAll('.weather-day-card').forEach(c=>c.classList.remove('wday-active'));
  if(clickedEl) clickedEl.classList.add('wday-active');

  document.getElementById('weather-hourly-label').textContent=label;

  // Show hours 6am–10pm (indices 6–22)
  const hours=Array.from({length:17},(_,i)=>start+6+i);
  container.innerHTML=hours.map(hi=>{
    const hr=hi%24;
    const code=hCodes[hi]||0;
    const temp=Math.round(hourly.temperature_2m[hi]||0);
    const rain=hourly.precipitation_probability[hi]||0;
    const wind=Math.round(hWind[hi]||0);
    const ampm=hr<12?'am':'pm';
    const h12=hr===0?12:hr>12?hr-12:hr;
    const emoji=WMO_EMOJI[code]||'🌡';
    const rainColor=rain>60?'#F87171':rain>30?'var(--amber)':'var(--muted)';
    const isNow=(new Date().getHours()===hr&&dayIndex===0);
    return `<div class="weather-hour-card" style="${isNow?'border-color:var(--blue);background:rgba(91,141,239,.1)':''}">
      <div style="font-size:9px;font-weight:${isNow?'700':'400'};color:${isNow?'var(--blue-bright)':'var(--muted)'};margin-bottom:4px">${isNow?'Now':`${h12}${ampm}`}</div>
      <div style="font-size:20px;margin-bottom:4px;line-height:1">${emoji}</div>
      <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:4px">${temp}°</div>
      <div style="font-size:9px;color:${rainColor};margin-bottom:2px">💧 ${rain}%</div>
      <div style="font-size:9px;color:var(--muted)">💨 ${wind}</div>
    </div>`;
  }).join('');

  panel.style.display='block';
}

function getGcalLinks(){return JSON.parse(localStorage.getItem('dronehub_gcal_links')||'[]');}

// _gcalMemberKey: stable per-member key used as sub-collection doc ID.
// OAuth members → "m_{memberId}"; ICS-only members → "n_{urlSafeBase64(creatorName)}"
function _gcalMemberKey(link){
  if(link.oauthMemberId) return 'm_'+link.oauthMemberId;
  const name=(link.creatorName||'unknown').replace(/[^a-zA-Z0-9_-]/g,'_');
  return 'n_'+name;
}

function saveGcalLinks(links){
  try{localStorage.setItem('dronehub_gcal_links',JSON.stringify(links));}catch(e){}
  if(!_fbToken()) return;

  // ── Per-member sub-collection docs ─────────────────────────────────────────
  // Each member's links live in their own document (orgs/{orgId}/gcal/{memberKey}).
  // Writing one member's doc never touches another's — no more array race conditions.

  // Compute previous member keys so we can delete docs for removed members
  let prevKeys=[];
  try{prevKeys=JSON.parse(localStorage.getItem('_dh_gcal_member_keys')||'[]');}catch(e){}

  const byMember={};
  links.forEach(l=>{
    const key=_gcalMemberKey(l);
    (byMember[key]=byMember[key]||[]).push(l);
  });

  // Write/update each member doc
  Object.entries(byMember).forEach(([key,memberLinks])=>{
    fbSubSet('gcal',key,{links:JSON.stringify(memberLinks),updatedAt:Date.now()})
      .catch(e=>console.error('[saveGcalLinks] sub-set failed:',e.message));
  });

  // Delete docs for members who now have no links (they were removed)
  prevKeys.forEach(key=>{
    if(!byMember[key]) fbSubDelete('gcal',key).catch(()=>{});
  });

  // Persist the current member key set so next call can detect removals
  try{localStorage.setItem('_dh_gcal_member_keys',JSON.stringify(Object.keys(byMember)));}catch(e){}

  // Belt-and-suspenders: also write each person's ICS URLs into their team member
  // record AND their profile doc so the calendar survives even if gcal sub-collection is wiped
  const allMembers=getAdminTeamMembers();
  const byEmail={};
  links.forEach(l=>{
    if(!l.creatorEmail&&!l.creatorName) return;
    const key=(l.creatorEmail||'').toLowerCase()||l.creatorName;
    (byEmail[key]=byEmail[key]||[]).push(l.icsUrl||'');
  });
  const byName={};
  links.forEach(l=>{if(l.creatorName)(byName[l.creatorName]=byName[l.creatorName]||[]).push(l.icsUrl||'');});
  allMembers.forEach(m=>{
    const emailKey=(m.email||'').toLowerCase();
    const urls=byEmail[emailKey]||(m.name?byName[m.name]:null);
    if(urls){
      m.calendarUrls=urls;
      if(m.id) tpProfileSave(m.id,{calendarUrls:urls});
    }
  });
  const dirty=allMembers.filter(m=>m.calendarUrls);
  if(dirty.length) saveAdminTeamMembers(allMembers);
}

function populateCalNameDropdown(){
  const sel=document.getElementById('cal-gcal-name');
  if(!sel) return;
  const current=sel.value;
  const members=[...getAdminTeamMembers(),...getTeamMembers()];
  const seen=new Set();
  const opts=['<option value="">— Select team member —</option>'];
  members.forEach(m=>{
    if(m.name&&!seen.has(m.name)){
      seen.add(m.name);
      opts.push(`<option value="${m.name}"${m.name===current?' selected':''}>${m.name}${m.role?' ('+m.role+')':''}</option>`);
    }
  });
  // Also add contractors
  Object.values(CONTRACTORS).forEach(c=>{
    if(c.name&&!seen.has(c.name)){
      seen.add(c.name);
      opts.push(`<option value="${c.name}"${c.name===current?' selected':''}>${c.name} (contractor)</option>`);
    }
  });
  sel.innerHTML=opts.join('');
}

async function calAddGcal(){
  const nameEl=document.getElementById('cal-gcal-name');
  const name=nameEl?.value.trim();
  const urlEl=document.getElementById('cal-gcal-url');
  const url=(urlEl?.value||'').trim();
  if(!name||!url){showDhToast('Missing info','Please select a team member and enter a calendar URL.','⚠️','var(--orange)',4000);return;}

  // ── URL validation ────────────────────────────────────────────────────────
  if(!url.toLowerCase().endsWith('.ics')){
    showDhToast('Invalid URL','The calendar URL must end in .ics — in Google Calendar go to Settings → [Your calendar] → Integrate calendar → copy the Secret address in iCal format (it ends with /basic.ics).','⚠️','var(--orange)',8000);
    if(urlEl) urlEl.style.borderColor='var(--red)';
    setTimeout(()=>{ if(urlEl) urlEl.style.borderColor=''; },3000);
    return;
  }
  try{
    const h=new URL(url).hostname;
    const allowed=['calendar.google.com','outlook.live.com','outlook.office.com','icloud.com','apple.com'];
    if(!allowed.some(a=>h===a||h.endsWith('.'+a))){
      showDhToast('Unsupported calendar','Only Google, Outlook, and iCloud calendar URLs are supported.','⚠️','var(--orange)',5000);
      return;
    }
  }catch(e){showDhToast('Invalid URL','That doesn\'t look like a valid URL.','⚠️','var(--orange)',4000);return;}

  const links=getGcalLinks();
  if(links.find(l=>l.creatorName===name&&l.icsUrl===url)){
    showDhToast('Already linked','This calendar URL is already linked for '+name+'.','ℹ️','var(--blue-bright)',4000);return;
  }
  const existing=links.filter(l=>l.creatorName===name);
  if(existing.length>=5){showDhToast('Limit reached','Maximum 5 calendars per person.','⚠️','var(--orange)',4000);return;}

  // Find member email so we can store it on the link for per-profile lookups
  const allMembers=getAdminTeamMembers();
  const member=allMembers.find(m=>m.name===name);
  const calNum=existing.length+1;
  const entry={
    id:'gcal_'+Date.now(),
    creatorName:name,
    creatorEmail:member?.email||'',
    calLabel:'Calendar '+calNum,
    icsUrl:url,
    addedAt:new Date().toISOString().slice(0,10),
    events:[],lastSync:null,syncError:null,
  };
  links.push(entry);
  saveGcalLinks(links);
  if(nameEl) nameEl.value='';
  if(urlEl) urlEl.value='';
  renderCalLinkedList();

  // Fetch events — show result as toast
  const btn=document.querySelector('#cal-import-modal button[onclick="calAddGcal()"]');
  if(btn){btn.textContent='Syncing…';btn.disabled=true;}
  await syncGcalLinks();
  if(btn){btn.textContent='Link ✓';btn.disabled=false;}

  const saved=getGcalLinks().find(l=>l.id===entry.id);
  if(saved?.syncError){
    showDhToast('Sync error',saved.syncError,'⚠️','var(--orange)',8000);
  } else {
    const evtCount=(saved?.events||[]).length;
    showDhToast('Calendar linked!',`${name}'s calendar linked — ${evtCount} event${evtCount!==1?'s':''} loaded.`,'📅','var(--green)',4000);
  }
  renderCalendar();
}

function calRemoveGcal(id){
  if(!confirm('Remove this calendar?')) return;
  saveGcalLinks(getGcalLinks().filter(l=>l.id!==id));
  renderCalLinkedList();
  renderCalendar();
}

// Sync just one calendar entry by id
async function calSyncOne(id){
  const links=getGcalLinks();
  const link=links.find(l=>l.id===id);
  if(!link) return;
  try{
    if(link.oauthMemberId){
      // Google OAuth entry
      const tok=_fbToken();
      if(!tok) throw new Error('Sign in required');
      const r=await fetch('/.netlify/functions/google-cal',{
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
        body:JSON.stringify({action:'sync',memberId:link.oauthMemberId,calendarIds:[link.oauthCalendarId]}),
      });
      const json=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(json.error||'HTTP '+r.status);
      link.events=json.events||[];
    } else if(link.icsUrl){
      // ICS URL entry
      const r=await fetch('/.netlify/functions/ics-proxy?url='+encodeURIComponent(link.icsUrl));
      const json=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(json.error||'HTTP '+r.status);
      link.events=json.events||[];
    } else return;
    link.lastSync=new Date().toISOString();
    link.syncError=null;
  }catch(e){
    link.syncError=e.message||'Sync failed';
  }
  saveGcalLinks(links);
  renderCalLinkedList();
  renderCalendar();
}

// Pre-select a person's name and focus the URL field so adding a second calendar is one click
function calAddCalendarFor(name){
  const sel=document.getElementById('cal-gcal-name');
  if(sel){
    populateCalNameDropdown();
    sel.value=name;
  }
  const urlInput=document.getElementById('cal-gcal-url');
  if(urlInput){urlInput.value='';urlInput.focus();}
}

// ── Fetch real events from all linked calendars (ICS or Google OAuth) ────────
async function syncGcalLinks(showFeedback){
  const links=getGcalLinks();
  if(!links.length) return;
  let anyUpdated=false;
  await Promise.allSettled(links.map(async link=>{
    // ── Google OAuth entry ──
    if(link.oauthMemberId){
      try{
        const tok=_fbToken();
        if(!tok) return; // OAuth sync requires auth
        const r=await fetch('/.netlify/functions/google-cal',{
          method:'POST',
          headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
          body:JSON.stringify({action:'sync',memberId:link.oauthMemberId,calendarIds:[link.oauthCalendarId]}),
        });
        const json=await r.json().catch(()=>({}));
        if(!r.ok) throw new Error(json.error||'HTTP '+r.status);
        link.events=json.events||[];
        link.lastSync=new Date().toISOString();
        link.syncError=null;
        anyUpdated=true;
      }catch(e){
        link.syncError=e.message||'Sync failed';
      }
      return;
    }
    // ── ICS URL entry ──
    if(!link.icsUrl) return;
    try{
      const r=await fetch('/.netlify/functions/ics-proxy?url='+encodeURIComponent(link.icsUrl));
      const json=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(json.error||'HTTP '+r.status);
      link.events=json.events||[];
      link.lastSync=new Date().toISOString();
      link.syncError=null;
      anyUpdated=true;
    }catch(e){
      link.syncError=e.message||'Sync failed';
    }
  }));
  saveGcalLinks(links);
  renderCalLinkedList();
  if(anyUpdated) renderCalendar();
  if(showFeedback) alert('Calendar synced! '+links.reduce((n,l)=>n+(l.events?.length||0),0)+' events loaded.');
}

function renderCalLinkedList(){
  const el=document.getElementById('cal-linked-list');
  if(!el) return;
  const links=getGcalLinks();
  if(!links.length){el.innerHTML='<div style="font-size:12px;color:var(--muted);padding:6px 0">No calendars linked yet.</div>';return;}

  // Group by person name (preserving insertion order of first appearance)
  const order=[];
  const grouped={};
  links.forEach(l=>{
    if(!grouped[l.creatorName]){grouped[l.creatorName]=[];order.push(l.creatorName);}
    grouped[l.creatorName].push(l);
  });

  el.innerHTML=order.map(name=>{
    const col=getCreatorColor(name);
    const personLinks=grouped[name];
    const canAdd=personLinks.length<5;

    const calRows=personLinks.map((l,i)=>{
      const evtCount=(l.events||[]).length;
      const lastSync=l.lastSync?new Date(l.lastSync).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'}):'Never synced';
      const dot=l.syncError?'#E85D5D':evtCount>0?'#22D97A':'#555E78';
      const tip=l.syncError?l.syncError:`${evtCount} event${evtCount!==1?'s':''} · ${lastSync}`;
      const label=l.calLabel||(i===0?'Primary':'Calendar '+(i+1));
      return `<div style="display:flex;align-items:center;gap:8px;padding:5px 10px 5px 28px">
        <span style="width:6px;height:6px;border-radius:50%;background:${dot};flex-shrink:0"></span>
        <div style="flex:1;min-width:0">
          <div style="font-size:11px;font-weight:600;color:var(--offwhite)">${label}</div>
          <div style="font-size:10px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis" title="${tip}">${tip}</div>
        </div>
        <button onclick="calSyncOne('${l.id}')" title="Refresh" style="border:none;background:none;color:var(--blue-bright);cursor:pointer;font-size:12px;padding:2px 4px;border-radius:4px">⟳</button>
        <button onclick="calRemoveGcal('${l.id}')" title="Remove" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:12px;padding:2px 4px;border-radius:4px" onmouseover="this.style.color='#E85D5D'" onmouseout="this.style.color='var(--muted)'">✕</button>
      </div>`;
    }).join('');

    return `<div style="background:var(--navy-lift);border:1px solid ${col.border};border-radius:10px;margin-bottom:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(255,255,255,.06)">
        <span style="width:9px;height:9px;border-radius:50%;background:${col.border};flex-shrink:0"></span>
        <div style="font-size:12px;font-weight:700;color:${col.text};flex:1">${name}</div>
        ${canAdd?`<button onclick="calAddCalendarFor('${name}')" title="Add another calendar" style="border:none;background:rgba(91,141,239,.15);color:var(--blue-bright);cursor:pointer;font-size:11px;font-weight:700;padding:3px 8px;border-radius:6px">+ Add</button>`:''}
      </div>
      ${calRows}
    </div>`;
  }).join('');
}
function openCalImportModal(){
  const modal=document.getElementById('cal-import-modal');
  if(modal){modal.style.display='flex';renderCalLinkedList();populateCalNameDropdown();}
  // Pre-select current user in the dropdown
  const session=gateGetSession();
  if(session?.name){
    const sel=document.getElementById('cal-gcal-name');
    if(sel){const opt=[...sel.options].find(o=>o.value===session.name);if(opt) sel.value=session.name;}
  }
}

// Called from the "Sign in with Google" button in the calendar modal
function calSignInWithGoogle(){
  const session=gateGetSession();
  if(!session?.email){showDhToast('Not logged in','Please sign in first.','⚠️','var(--orange)',4000);return;}
  const members=getAdminTeamMembers();
  const member=members.find(m=>(m.email||'').toLowerCase()===session.email.toLowerCase());
  if(!member?.id){
    showDhToast('Profile not found','Your account isn\'t in the team roster yet — ask your admin to add you.','⚠️','var(--orange)',5000);
    return;
  }
  // Redirect to Google OAuth — returns to app with #gcal-connected=memberId
  gcalConnectWithGoogle(member.id);
}

// ── MAIN RENDER ────────────────────────────────────────────────────────────
function renderCalendar(){
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const label=document.getElementById('cal-month-label');
  if(label) label.textContent=months[calMonth]+' '+calYear;
  const grid=document.getElementById('cal-grid');
  if(!grid) return;
  calPopulateFilter();
  const filterCreator=document.getElementById('cal-filter-contractor')?.value||'';
  const showShoots=_calTypeFilters===null||_calTypeFilters.has('shoots');
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const todayStr=new Date().toISOString().slice(0,10);

  // Render type-filter pill bar (shared with week/day views)
  renderCalFilterBar();

  // Map jobs to dates
  const jobsByDate={};
  if(showShoots){
    savedJobs.forEach(j=>{
      if(!j.date) return;
      const assignedNames=new Set();
      Object.values(j.payouts||{}).forEach(p=>{
        if(p.name&&!p.name.includes('unassigned')) assignedNames.add(p.name);
      });
      const ts=getTrackerStage(j.id);
      if(ts.videographer) assignedNames.add(ts.videographer);
      if(ts.claimedBy) assignedNames.add(ts.claimedBy);
      const primary=getJobCreator(j)||'Unknown';
      if(!assignedNames.size) assignedNames.add(primary);
      if(filterCreator&&!assignedNames.has(filterCreator)) return;
      const creator=assignedNames.has(filterCreator)&&filterCreator?filterCreator:primary;
      if(!jobsByDate[j.date]) jobsByDate[j.date]=[];
      if(!jobsByDate[j.date].find(e=>e.id===j.id)){
        jobsByDate[j.date].push({...j,_creator:creator,_allCreators:[...assignedNames],_evtType:'shoot'});
      }
    });
    // Overlay GCal events (skip disabled calendars)
    getGcalLinks().forEach(link=>{
      if(link.enabled===false) return; // toggled off
      (link.events||[]).forEach(ev=>{
        if(!ev.date) return;
        if(filterCreator&&link.creatorName!==filterCreator) return;
        if(!jobsByDate[ev.date]) jobsByDate[ev.date]=[];
        jobsByDate[ev.date].push({_gcal:true,name:ev.title||'GCal event',_creator:link.creatorName,date:ev.date,shootTime:ev.time||'',_evtType:'shoot'});
      });
    });
  }

  // Overlay custom events (vacation, sick, etc.)
  const customEvts=calEventsLoad();
  customEvts.forEach(e=>{
    if(_calTypeFilters!==null&&!_calTypeFilters.has(e.type)) return;
    if(filterCreator&&e.memberName!==filterCreator) return;
    const typeDef=CAL_EVENT_TYPES.find(t=>t.id===e.type)||CAL_EVENT_TYPES[CAL_EVENT_TYPES.length-1];
    // Expand multi-day events across all their dates in this month
    const start=new Date(e.date+'T12:00:00');
    const end=new Date((e.endDate||e.date)+'T12:00:00');
    for(let dt=new Date(start);dt<=end;dt.setDate(dt.getDate()+1)){
      const dStr=dt.toISOString().slice(0,10);
      if(dt.getFullYear()!==calYear||dt.getMonth()!==calMonth) continue;
      if(!jobsByDate[dStr]) jobsByDate[dStr]=[];
      jobsByDate[dStr].push({_customEvt:true,id:e.id,name:e.title,_creator:e.memberName,date:dStr,_evtType:e.type,_typeDef:typeDef,_eventId:e.id});
    }
  });

  // Contractor legend (shared with week/day views)
  renderCalLegend();

  let html='';
  for(let i=firstDay-1;i>=0;i--)
    html+=`<div class="cal-cell other-month"><span style="font-size:12px;color:var(--border-bright)">${daysInPrev-i}</span></div>`;

  for(let d=1;d<=daysInMonth;d++){
    const dateStr=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const isToday=dateStr===todayStr;
    const dayItems=jobsByDate[dateStr]||[];
    const badges=dayItems.slice(0,4).map(j=>{
      if(j._customEvt){
        const td=j._typeDef;
        return `<div onclick="showCalDay('${dateStr}',event)" title="${j._creator?j._creator+': ':''}${j.name}"
          style="font-size:11px;padding:3px 7px 3px 8px;border-radius:6px;margin-bottom:3px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.5;font-weight:600;background:${td.bg};border-left:3px solid ${td.color};color:${td.color}">
          ${td.icon} ${j.name.slice(0,20)}
        </div>`;
      }
      const col=getCreatorColor(j._creator);
      const time=j.shootTime?j.shootTime.slice(0,5)+' ':'';
      const lbl=(time+j.name).slice(0,24);
      return `<div onclick="showCalDay('${dateStr}',event)" title="${j._creator?j._creator+': ':''}${j.name}"
        style="font-size:11px;padding:4px 8px 4px 9px;border-radius:6px;margin-bottom:3px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.5;font-weight:600;background:${col.bg};border-left:3px solid ${col.border};color:${col.text}">
        ${j._gcal?'':''}${lbl}
      </div>`;
    }).join('');
    const more=dayItems.length>4?`<div style="font-size:9px;color:var(--muted);padding:1px 4px">+${dayItems.length-4} more</div>`:'';
    // Mobile colour dots (one per event, max 5)
    const dots=dayItems.slice(0,5).map(j=>{
      if(j._customEvt) return `<span class="mob-cal-dot" style="background:${j._typeDef.color}"></span>`;
      const col=getCreatorColor(j._creator);
      return `<span class="mob-cal-dot" style="background:${col.border}"></span>`;
    }).join('');
    html+=`<div class="cal-cell${isToday?' today':''}" onclick="showCalDay('${dateStr}',event)" ondblclick="event.stopPropagation();calQuickAdd('${dateStr}',null,event)">
      <div style="font-size:${isToday?'17':'14'}px;font-weight:${isToday?'700':'500'};color:${isToday?'var(--blue-bright)':'var(--offwhite)'};margin-bottom:8px;line-height:1">${d}${isToday?'<span style="font-size:9px;font-weight:700;color:var(--blue-bright);padding:1px 5px;border-radius:5px;background:rgba(91,141,239,.15);margin-left:4px">TODAY</span>':''}</div>
      <div class="cal-cell-badges">${badges}${more}</div>
      <div class="mob-cal-dots">${dots}</div>
    </div>`;
  }
  const total=Math.ceil((firstDay+daysInMonth)/7)*7;
  for(let d=1;d<=total-firstDay-daysInMonth;d++)
    html+=`<div class="cal-cell other-month"><span style="font-size:12px;color:var(--border-bright)">${d}</span></div>`;

  grid.innerHTML=html;
  // Sync mobile calendar view (no-op on desktop)
  if(window.innerWidth<=768 && typeof renderMobCal==='function'){
    const dir=_mcNavDir||0;_mcNavDir=0;
    renderMobCal(dir);
  }
}
function showCalDay(dateStr,e){
  if(e) e.stopPropagation();
  const dayJobs=savedJobs.filter(j=>j.date===dateStr);
  const dayCustomEvts=calEventsLoad().filter(ev=>{
    const s=ev.date, end=ev.endDate||ev.date;
    return dateStr>=s&&dateStr<=end;
  });
  const d=new Date(dateStr+'T12:00:00');
  let html='';
  // Custom events first
  dayCustomEvts.forEach(ev=>{
    const td=CAL_EVENT_TYPES.find(t=>t.id===ev.type)||CAL_EVENT_TYPES[CAL_EVENT_TYPES.length-1];
    const isMultiDay=ev.endDate&&ev.endDate!==ev.date;
    html+=`<div style="padding:10px 12px;border:1px solid ${td.color}55;border-left:4px solid ${td.color};border-radius:8px;margin-bottom:8px;background:${td.bg}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <span style="font-size:13px;font-weight:700;color:var(--white)">${td.icon} ${ev.title}</span>
        <button onclick="deleteCalEvent('${ev.id}')" title="Delete event" style="border:none;background:none;color:var(--muted);cursor:pointer;font-size:14px;padding:0 2px">${_icon('trash',14)}</button>
      </div>
      ${ev.memberName?`<div style="font-size:11px;color:${td.color};font-weight:600;margin-bottom:2px">${ev.memberName}</div>`:''}
      ${isMultiDay?`<div style="font-size:10px;color:var(--muted)">${ev.date} → ${ev.endDate}</div>`:''}
      ${ev.notes?`<div style="font-size:11px;color:var(--muted);margin-top:4px;font-style:italic">${ev.notes}</div>`:''}
    </div>`;
  });
  // Jobs
  if(dayJobs.length){
    html+=dayJobs.map(j=>{
      const creator=getJobCreator(j);
      const col=getCreatorColor(creator);
      const svcsStr=Object.entries(j.services||{}).filter(([k,v])=>v&&!['tvideo','tphoto'].includes(k)).map(([k])=>({video:'Video',photo:'Photo',reel:'Reels',extphoto:'Ext. photo',extvideo:'Ext. video',floorplan:'Floor plan',randomvideo:'Random video',randomphoto:'Random photo'}[k]||k)).join(', ');
      return `<div style="padding:10px;border:1px solid ${col.border};border-radius:8px;margin-bottom:8px;background:${col.bg}">
        <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;flex-wrap:wrap;gap:6px">
          <span style="font-size:13px;font-weight:600;color:var(--white)">${j.name}</span>
          <div style="display:flex;gap:6px;align-items:center">
            ${creator?`<span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:8px;background:${col.border}22;border:1px solid ${col.border};color:${col.text}">${creator}</span>`:''}
            <span class="status-badge status-${j.status||'quoted'}">${j.status||'quoted'}</span>
          </div>
        </div>
        ${j.shootTime?`<div style="font-size:12px;color:var(--amber);margin-bottom:2px">${j.shootTime}${j.duration?' ('+j.duration+'hr)':''}</div>`:''}
        ${j.clientName||j.clientId?`<div style="font-size:11px;color:var(--green)">${j.clientName||(clients.find(c=>c.id===j.clientId)?.name||'')}</div>`:''}
        <div style="font-size:11px;color:var(--muted);margin-top:2px">${j.address||''}</div>
        ${svcsStr?`<div style="font-size:10px;color:var(--muted);margin-top:3px">${svcsStr}</div>`:''}
        ${j.notes?`<div style="font-size:11px;color:var(--muted);margin-top:4px;font-style:italic">${j.notes}</div>`:''}
        ${(j.status==='confirmed'||j.status==='completed')?`<button onclick="openInvoice(${j.id})" style="display:inline-flex;align-items:center;gap:4px;margin-top:8px;padding:4px 12px;border-radius:12px;border:1px solid var(--blue);background:rgba(91,141,239,.12);color:var(--blue-bright);font-size:11px;cursor:pointer;font-weight:600"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Invoice</button>`:''}
      </div>`;
    }).join('');
  }
  if(!html) html=`<div style="padding:24px 0;text-align:center;color:var(--muted);font-size:13px">Nothing scheduled — <button onclick="openCalEventModal('${dateStr}')" style="border:none;background:none;color:var(--blue-bright);cursor:pointer;font-size:13px;padding:0;font-weight:600">+ add event</button></div>`;

  if(window.innerWidth<=768){
    // ── Mobile: slide-up bottom sheet ──
    const sheet=document.getElementById('mob-cal-sheet');
    const overlay=document.getElementById('mob-cal-sheet-overlay');
    const titleEl=document.getElementById('mob-cal-sheet-title');
    const bodyEl=document.getElementById('mob-cal-sheet-body');
    if(!sheet) return;
    // Highlight selected cell
    document.querySelectorAll('.cal-cell.mob-cal-selected').forEach(el=>el.classList.remove('mob-cal-selected'));
    const cellEl=e&&e.currentTarget?e.currentTarget:(document.querySelector(`.cal-cell[onclick*="'${dateStr}'"]`));
    if(cellEl) cellEl.classList.add('mob-cal-selected');
    titleEl.textContent=d.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'});
    bodyEl.innerHTML=html;
    overlay.style.display='block';
    sheet.style.display='block';
    // Double rAF so display:block is painted before the transition fires
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ sheet.classList.add('mob-cal-sheet-open'); }));
  } else {
    // ── Desktop: drill into day view ──
    setCalView('day', dateStr);
  }
}
function mobCalCloseSheet(){
  const sheet=document.getElementById('mob-cal-sheet');
  const overlay=document.getElementById('mob-cal-sheet-overlay');
  if(sheet) sheet.classList.remove('mob-cal-sheet-open');
  setTimeout(()=>{
    if(sheet) sheet.style.display='none';
    if(overlay) overlay.style.display='none';
  },320);
  document.querySelectorAll('.cal-cell.mob-cal-selected').forEach(el=>el.classList.remove('mob-cal-selected'));
}

// ─── MOBILE APPLE-STYLE CALENDAR ─────────────────────────────────────────────
function _mcBuildJobsByDate(){
  const jobsByDate={};
  const showShoots=_calTypeFilters===null||_calTypeFilters.has('shoots');
  if(showShoots){
    savedJobs.forEach(j=>{
      if(!j.date) return;
      const primary=getJobCreator(j)||'Unknown';
      if(!jobsByDate[j.date]) jobsByDate[j.date]=[];
      if(!jobsByDate[j.date].find(e=>e.id===j.id))
        jobsByDate[j.date].push({...j,_creator:primary,_evtType:'shoot'});
    });
    getGcalLinks().forEach(link=>{
      if(link.enabled===false) return;
      (link.events||[]).forEach(ev=>{
        if(!ev.date) return;
        if(!jobsByDate[ev.date]) jobsByDate[ev.date]=[];
        jobsByDate[ev.date].push({_gcal:true,name:ev.title||'GCal event',_creator:link.creatorName,date:ev.date,shootTime:ev.time||'',_evtType:'shoot'});
      });
    });
  }
  calEventsLoad().forEach(e=>{
    if(_calTypeFilters!==null&&!_calTypeFilters.has(e.type)) return;
    const typeDef=CAL_EVENT_TYPES.find(t=>t.id===e.type)||CAL_EVENT_TYPES[CAL_EVENT_TYPES.length-1];
    const start=new Date(e.date+'T12:00:00');
    const end=new Date((e.endDate||e.date)+'T12:00:00');
    for(let dt=new Date(start);dt<=end;dt.setDate(dt.getDate()+1)){
      const dStr=dt.toISOString().slice(0,10);
      if(!jobsByDate[dStr]) jobsByDate[dStr]=[];
      jobsByDate[dStr].push({_customEvt:true,id:e.id,name:e.title,_creator:e.memberName,date:dStr,_evtType:e.type,_typeDef:typeDef,_eventId:e.id});
    }
  });
  return jobsByDate;
}

function _mcBuildGridHtml(jobsByDate){
  const firstDay=new Date(calYear,calMonth,1).getDay();
  const daysInMonth=new Date(calYear,calMonth+1,0).getDate();
  const daysInPrev=new Date(calYear,calMonth,0).getDate();
  const todayStr=new Date().toISOString().slice(0,10);
  let html='';
  // Leading blank cells (previous month)
  for(let i=firstDay-1;i>=0;i--)
    html+=`<div class="mc-cell mc-other"><span class="mc-num" style="font-size:12px">${daysInPrev-i}</span><div class="mob-cal-dots"></div></div>`;
  // Current month cells
  for(let d=1;d<=daysInMonth;d++){
    const ds=calYear+'-'+String(calMonth+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
    const isToday=ds===todayStr;
    const isSel=ds===_mobCalSelDate;
    const items=jobsByDate[ds]||[];
    const dots=items.slice(0,3).map(j=>{
      if(j._customEvt) return `<span class="mob-cal-dot" style="background:${j._typeDef.color}"></span>`;
      const col=getCreatorColor(j._creator);
      return `<span class="mob-cal-dot" style="background:${col.border}"></span>`;
    }).join('');
    html+=`<div class="mc-cell${isToday?' mc-today':''}${isSel?' mc-sel':''}" onclick="mobCalSelectDay('${ds}')">
      <span class="mc-num">${d}</span>
      <div class="mob-cal-dots">${dots}</div>
    </div>`;
  }
  // Trailing blank cells (next month)
  const total=Math.ceil((firstDay+daysInMonth)/7)*7;
  for(let d=1;d<=total-firstDay-daysInMonth;d++)
    html+=`<div class="mc-cell mc-other"><span class="mc-num" style="font-size:12px">${d}</span><div class="mob-cal-dots"></div></div>`;
  return html;
}

function renderMobCal(dir){
  if(window.innerWidth>768) return;
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const ml=document.getElementById('mob-cal-nav-month');
  if(ml) ml.textContent=months[calMonth]+' '+calYear;

  // If selected date is outside current month, reset to today or 1st
  const curMY=calYear+'-'+String(calMonth+1).padStart(2,'0');
  if(_mobCalSelDate.slice(0,7)!==curMY){
    const todayStr=new Date().toISOString().slice(0,10);
    _mobCalSelDate=todayStr.slice(0,7)===curMY?todayStr:curMY+'-01';
  }

  const jobsByDate=_mcBuildJobsByDate();
  const newHtml=_mcBuildGridHtml(jobsByDate);
  const clip=document.getElementById('mob-cal-grid-clip');
  if(!clip) return;
  const oldGrid=document.getElementById('mob-cal-grid');

  if(dir!==0 && oldGrid){
    // Slide old grid out, new grid in
    const newGrid=document.createElement('div');
    newGrid.id='mob-cal-grid';newGrid.className='mc-grid';
    newGrid.innerHTML=newHtml;
    newGrid.style.cssText=`position:absolute;top:0;left:${dir>0?'100%':'-100%'};width:100%;`;
    clip.style.position='relative';
    clip.appendChild(newGrid);
    newGrid.getBoundingClientRect(); // force reflow
    const dur='0.32s cubic-bezier(.4,0,.2,1)';
    oldGrid.style.transition=`transform ${dur}`;
    newGrid.style.transition=`transform ${dur}`;
    requestAnimationFrame(()=>{
      oldGrid.style.transform=`translateX(${dir>0?'-100%':'100%'})`;
      newGrid.style.transform='translateX(0)';
    });
    setTimeout(()=>{
      if(oldGrid.parentNode) oldGrid.remove();
      newGrid.style.cssText='';
      clip.style.position='';
    },330);
  } else if(oldGrid){
    oldGrid.innerHTML=newHtml;
  } else {
    const g=document.createElement('div');
    g.id='mob-cal-grid';g.className='mc-grid';
    g.innerHTML=newHtml;clip.appendChild(g);
  }
  // Update the events list for the currently selected date
  _mcRenderEvents(jobsByDate);
}

// Tap a date cell in month grid → open day view
function mobCalSelectDay(dateStr){
  _mobCalSelDate=dateStr;
  // Highlight tapped cell before sliding
  document.querySelectorAll('#mob-cal-grid-clip .mc-cell').forEach(el=>el.classList.remove('mc-sel'));
  const cells=document.querySelectorAll('#mob-cal-grid-clip .mc-cell:not(.mc-other)');
  const idx=parseInt(dateStr.slice(8))-1;
  if(cells[idx]) cells[idx].classList.add('mc-sel');
  // Build day view then slide in
  _mcBuildDayScreen(dateStr);
  document.getElementById('mob-cal-main')?.classList.add('mc-day-open');
}

// Slide back to month view
function mobCalBackToMonth(){
  document.getElementById('mob-cal-main')?.classList.remove('mc-day-open');
}

// Switch to a different day within the day view (no slide animation)
function mobCalSwitchDay(dateStr){
  _mobCalSelDate=dateStr;
  const d=new Date(dateStr+'T12:00:00');
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  // If crossing into a different month, update the month grid in background
  if(d.getFullYear()!==calYear||d.getMonth()!==calMonth){
    calYear=d.getFullYear(); calMonth=d.getMonth();
    _mcNavDir=0; renderCalendar();
  }
  // Back button label = current month name
  const bl=document.getElementById('mob-cal-dv-back-label');
  if(bl) bl.textContent=months[d.getMonth()];
  // Day title
  const tl=document.getElementById('mob-cal-dv-title');
  if(tl) tl.textContent=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  // Re-render week strip + events with fade
  _mcRenderWeekStrip(dateStr);
  _mcRenderDayEvents(dateStr);
}

// Build & populate the entire day screen for a given date
function _mcBuildDayScreen(dateStr){
  const d=new Date(dateStr+'T12:00:00');
  const months=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const bl=document.getElementById('mob-cal-dv-back-label');
  if(bl) bl.textContent=months[d.getMonth()];
  const tl=document.getElementById('mob-cal-dv-title');
  if(tl) tl.textContent=d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  _mcRenderWeekStrip(dateStr);
  _mcRenderDayEvents(dateStr);
}

// Render the compact 7-day week strip
function _mcRenderWeekStrip(dateStr){
  const strip=document.getElementById('mob-cal-week-strip');
  if(!strip) return;
  const d=new Date(dateStr+'T12:00:00');
  const dow=d.getDay();
  const weekStart=new Date(d); weekStart.setDate(d.getDate()-dow);
  const todayStr=new Date().toISOString().slice(0,10);
  const letters=['S','M','T','W','T','F','S'];
  let html='';
  for(let i=0;i<7;i++){
    const dd=new Date(weekStart); dd.setDate(weekStart.getDate()+i);
    const ds=dd.toISOString().slice(0,10);
    const isToday=ds===todayStr, isSel=ds===dateStr;
    html+=`<div class="mc-ws-cell${isToday?' mc-ws-today':''}${isSel?' mc-ws-sel':''}" onclick="mobCalSwitchDay('${ds}')">
      <span class="mc-ws-letter">${letters[i]}</span>
      <span class="mc-ws-num">${dd.getDate()}</span>
    </div>`;
  }
  strip.innerHTML=html;
}

// Render the event list for a day with time-sorted layout
function _mcRenderDayEvents(dateStr){
  const body=document.getElementById('mob-cal-dv-events');
  if(!body) return;
  const dayJobs=savedJobs.filter(j=>j.date===dateStr)
    .sort((a,b)=>(a.shootTime||'').localeCompare(b.shootTime||''));
  const dayEvts=calEventsLoad().filter(ev=>dateStr>=ev.date&&dateStr<=(ev.endDate||ev.date));
  let html='';
  // All-day custom events first
  dayEvts.forEach(ev=>{
    const td=CAL_EVENT_TYPES.find(t=>t.id===ev.type)||CAL_EVENT_TYPES[CAL_EVENT_TYPES.length-1];
    html+=`<div class="mc-ev-row" style="background:${td.bg};border-left-color:${td.color}"
        onclick="mcShowEventDetail('custom','${ev.id}','${dateStr}')">
      <div class="mc-ev-time" style="color:${td.color}">all-day</div>
      <div class="mc-ev-body">
        <div class="mc-ev-title">${td.icon} ${ev.title}</div>
        ${ev.memberName?`<div class="mc-ev-sub">${ev.memberName}</div>`:''}
        ${ev.notes?`<div class="mc-ev-sub" style="font-style:italic">${ev.notes}</div>`:''}
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;align-self:center"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  });
  // Timed job shoots
  dayJobs.forEach(j=>{
    const creator=getJobCreator(j);
    const col=getCreatorColor(creator);
    const timeDisp=j.shootTime?_mcFmtTime(j.shootTime):'—';
    html+=`<div class="mc-ev-row" style="background:${col.bg};border-left-color:${col.border}"
        onclick="mcShowEventDetail('job',${j.id},'${dateStr}')">
      <div class="mc-ev-time">${timeDisp}</div>
      <div class="mc-ev-body">
        <div class="mc-ev-title">${j.name}</div>
        ${creator?`<div class="mc-ev-sub" style="color:${col.text}">${creator}</div>`:''}
        ${j.address?`<div class="mc-ev-sub">${j.address}</div>`:''}
        <span class="status-badge status-${j.status||'quoted'}" style="margin-top:4px;display:inline-block">${j.status||'quoted'}</span>
      </div>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;align-self:center"><polyline points="9 18 15 12 9 6"/></svg>
    </div>`;
  });
  if(!html) html=`<div style="padding:36px 0;text-align:center;color:var(--muted);font-size:13px">No events<br><button onclick="openCalEventModal('${dateStr}')" style="margin-top:12px;border:1px solid var(--blue);border-radius:10px;background:rgba(91,141,239,.12);color:var(--blue-bright);cursor:pointer;font-size:13px;padding:6px 18px;font-weight:600">+ Add Event</button></div>`;
  body.style.opacity='0';
  body.innerHTML=html;
  body.scrollTop=0;
  requestAnimationFrame(()=>{body.style.transition='opacity .18s';body.style.opacity='1';});
}

// Format "09:30" → "9:30 AM"
function _mcFmtTime(t){
  if(!t) return '';
  const [h,m]=t.split(':').map(Number);
  return `${h%12||12}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`;
}

// Show full event detail modal (tap on event in day view)
function mcShowEventDetail(type,idOrEvtId,dateStr){
  if(type==='job'){
    const j=savedJobs.find(jj=>jj.id==idOrEvtId);
    if(!j) return;
    const creator=getJobCreator(j);
    const col=getCreatorColor(creator);
    const svcsStr=Object.entries(j.services||{}).filter(([k,v])=>v&&!['tvideo','tphoto'].includes(k)).map(([k])=>({video:'Video',photo:'Photo',reel:'Reels',extphoto:'Ext. photo',extvideo:'Ext. video',floorplan:'Floor plan',randomvideo:'Random video',randomphoto:'Random photo'}[k]||k)).join(', ');
    const body=`<div style="padding:4px 0">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div style="font-size:17px;font-weight:800;color:var(--white)">${j.name}</div>
        <span class="status-badge status-${j.status||'quoted'}">${j.status||'quoted'}</span>
      </div>
      ${j.shootTime?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px"><span style="font-size:13px;color:var(--amber)">${_mcFmtTime(j.shootTime)}${j.duration?' · '+j.duration+' hr':''}</span></div>`:''}
      ${creator?`<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px"><span style="font-size:13px;font-weight:600;padding:3px 10px;border-radius:8px;background:${col.border}22;border:1px solid ${col.border};color:${col.text}">${creator}</span></div>`:''}
      ${j.address?`<div style="font-size:12px;color:var(--muted);margin-bottom:8px;display:flex;align-items:flex-start;gap:6px"><span></span><span>${j.address}</span></div>`:''}
      ${j.clientName?`<div style="font-size:12px;color:var(--offwhite);margin-bottom:8px">Client: ${j.clientName}</div>`:''}
      ${svcsStr?`<div style="font-size:11px;color:var(--muted);margin-bottom:8px">Services: ${svcsStr}</div>`:''}
      ${j.notes?`<div style="font-size:12px;color:var(--muted);font-style:italic;margin-bottom:8px;padding:8px 10px;background:rgba(255,255,255,.04);border-radius:8px">${j.notes}</div>`:''}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:14px">
        ${(j.status==='confirmed'||j.status==='completed')?`<button onclick="openInvoice(${j.id});mcCloseEventDetail()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--blue);background:rgba(91,141,239,.14);color:var(--blue-bright);font-size:13px;font-weight:700;cursor:pointer"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> Invoice</button>`:''}
        <button onclick="mcCloseEventDetail()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:13px;font-weight:600;cursor:pointer">Close</button>
      </div>
    </div>`;
    _mcOpenDetailSheet(j.name, body, col.border);
  } else {
    const evts=calEventsLoad();
    const ev=evts.find(e=>String(e.id)===String(idOrEvtId));
    if(!ev) return;
    const td=CAL_EVENT_TYPES.find(t=>t.id===ev.type)||CAL_EVENT_TYPES[CAL_EVENT_TYPES.length-1];
    const isMultiDay=ev.endDate&&ev.endDate!==ev.date;
    const body=`<div style="padding:4px 0">
      <div style="font-size:17px;font-weight:800;color:var(--white);margin-bottom:14px">${td.icon} ${ev.title}</div>
      ${isMultiDay?`<div style="font-size:12px;color:var(--muted);margin-bottom:8px">${ev.date} → ${ev.endDate}</div>`:''}
      ${ev.memberName?`<div style="font-size:13px;font-weight:600;color:${td.color};margin-bottom:8px">${ev.memberName}</div>`:''}
      ${ev.notes?`<div style="font-size:12px;color:var(--muted);font-style:italic;margin-bottom:10px;padding:8px 10px;background:rgba(255,255,255,.04);border-radius:8px">${ev.notes}</div>`:''}
      <div style="display:flex;gap:8px;margin-top:14px">
        <button onclick="deleteCalEvent('${ev.id}');mcCloseEventDetail();mobCalSwitchDay('${dateStr}')" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--red,#E85D5D);background:rgba(232,93,93,.1);color:var(--red,#E85D5D);font-size:13px;font-weight:700;cursor:pointer">Delete</button>
        <button onclick="mcCloseEventDetail()" style="flex:1;padding:10px;border-radius:10px;border:1px solid var(--border-bright);background:var(--navy-lift);color:var(--offwhite);font-size:13px;font-weight:600;cursor:pointer">Close</button>
      </div>
    </div>`;
    _mcOpenDetailSheet(ev.title, body, td.color);
  }
}
function _mcOpenDetailSheet(title, bodyHtml, accentColor){
  let sheet=document.getElementById('mc-event-detail-sheet');
  let ov=document.getElementById('mc-event-detail-ov');
  if(!sheet){
    ov=document.createElement('div');
    ov.id='mc-event-detail-ov';
    ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2100;';
    ov.onclick=mcCloseEventDetail;
    sheet=document.createElement('div');
    sheet.id='mc-event-detail-sheet';
    sheet.style.cssText='position:fixed;bottom:calc(66px + env(safe-area-inset-bottom,0px));left:0;right:0;background:var(--navy-card);border-radius:18px 18px 0 0;border-top:1px solid var(--border-bright);z-index:2101;max-height:80vh;overflow-y:auto;-webkit-overflow-scrolling:touch;transform:translateY(100%);transition:transform .3s cubic-bezier(.4,0,.2,1);box-shadow:0 -6px 32px rgba(0,0,0,.5);padding:0 18px 24px;';
    document.body.appendChild(ov);
    document.body.appendChild(sheet);
  }
  sheet.innerHTML=`
    <div style="display:flex;justify-content:center;padding:10px 0 6px"><div style="width:36px;height:4px;border-radius:2px;background:${accentColor||'var(--border-bright)'}"></div></div>
    ${bodyHtml}`;
  ov.style.display='block';
  sheet.style.display='block';
  requestAnimationFrame(()=>requestAnimationFrame(()=>{ sheet.style.transform='translateY(0)'; }));
}
function mcCloseEventDetail(){
  const sheet=document.getElementById('mc-event-detail-sheet');
  const ov=document.getElementById('mc-event-detail-ov');
  if(sheet) sheet.style.transform='translateY(100%)';
  setTimeout(()=>{
    if(sheet) sheet.style.display='none';
    if(ov) ov.style.display='none';
  },300);
}


// ── Google Calendar OAuth integration ────────────────────────────────────────

// Track which member's picker is open
let _gcalPickerMemberId=null;
let _gcalPickerMemberName=null;
let _gcalPickerCalendars=[];

// Redirect to Google OAuth (opens in same tab so hash return works)
function gcalConnectWithGoogle(memberId){
  if(!memberId){alert('Could not identify your team profile. Please log in and try again.');return;}
  window.location.href='/.netlify/functions/google-cal-auth?step=init&memberId='+encodeURIComponent(memberId);
}

// Generic API call helper for google-cal.js
async function gcalApiCall(action,memberId,extra){
  const tok=_fbToken();
  if(!tok) throw new Error('Not logged in');
  const r=await fetch('/.netlify/functions/google-cal',{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+tok},
    body:JSON.stringify({action,memberId,...extra}),
  });
  const json=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(json.error||'API error '+r.status);
  return json;
}

// Called after OAuth redirect returns with #gcal-connected=memberId
async function gcalCheckOAuthReturn(){
  const hash=window.location.hash;
  if(!hash) return;
  if(hash.startsWith('#gcal-connected=')){
    const params=new URLSearchParams(hash.slice(1));
    const memberId=params.get('gcal-connected');
    history.replaceState(null,'',window.location.pathname+window.location.search);
    if(!memberId) return;
    showDhToast('Google Calendar','Connected! Loading your calendars…','📅','var(--blue-bright)',4000);
    // Refresh the profile from Firebase so googleCalConnected shows true
    await tpProfileLoad_fb(memberId).catch(()=>{});
    // Show the calendar picker
    const member=getAdminTeamMembers().find(m=>m.id===memberId)||getTeamMembers().find(m=>m.id===memberId);
    if(member){
      gcalShowPicker(memberId,member.name);
    } else {
      // Fallback: just sync and refresh calendar view
      gcalSyncAllForMember(memberId,null).catch(()=>{});
    }
  } else if(hash.startsWith('#gcal-error=')){
    const params=new URLSearchParams(hash.slice(1));
    const errMsg=decodeURIComponent(params.get('gcal-error')||'Unknown error');
    history.replaceState(null,'',window.location.pathname+window.location.search);
    showDhToast('Google Calendar Error',errMsg,'⚠️','var(--red)',6000);
  } else if(hash==='#gcal-denied'){
    history.replaceState(null,'',window.location.pathname+window.location.search);
    showDhToast('Google Calendar','Connection cancelled.','ℹ️','var(--muted)',3000);
  }
}

// Show calendar picker modal — loads calendar list from Google API
async function gcalShowPicker(memberId,memberName){
  _gcalPickerMemberId=memberId;
  _gcalPickerMemberName=memberName;
  _gcalPickerCalendars=[];
  const modal=document.getElementById('gcal-picker-modal');
  const listEl=document.getElementById('gcal-picker-list');
  const statusEl=document.getElementById('gcal-picker-status');
  const emailEl=document.getElementById('gcal-picker-email');
  if(!modal) return;
  if(listEl) listEl.innerHTML='<div style="text-align:center;padding:20px;color:var(--muted);font-size:12px">Loading your calendars…</div>';
  if(statusEl) statusEl.textContent='';
  if(emailEl) emailEl.textContent='';
  modal.style.display='flex';
  try{
    const data=await gcalApiCall('list',memberId,{});
    _gcalPickerCalendars=data.calendars||[];
    if(emailEl) emailEl.textContent=data.email||'';
    if(!_gcalPickerCalendars.length){
      if(listEl) listEl.innerHTML='<div style="color:var(--muted);font-size:12px">No calendars found in your Google account.</div>';
      return;
    }
    if(listEl) listEl.innerHTML=_gcalPickerCalendars.map((cal,i)=>`
      <div id="gcal-pick-row-${i}" style="padding:10px 12px;border-radius:10px;background:var(--navy-lift);margin-bottom:6px;border:1px solid ${cal.selected?'var(--blue)':'var(--border)'}">
        <label style="display:flex;align-items:center;gap:10px;cursor:pointer;margin-bottom:0">
          <input type="checkbox" id="gcal-pick-${i}" ${cal.selected?'checked':''} style="accent-color:${cal.colorHex};width:16px;height:16px;cursor:pointer;flex-shrink:0" onchange="gcalPickerToggle(${i})">
          <span style="width:10px;height:10px;border-radius:50%;background:${cal.colorHex};flex-shrink:0"></span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:600;color:var(--offwhite)">${cal.name}</div>
            ${cal.primary?'<div style="font-size:10px;color:var(--muted)">Primary calendar</div>':''}
          </div>
        </label>
        <div id="gcal-pick-label-wrap-${i}" style="margin-top:8px;display:${cal.selected?'block':'none'}">
          <div style="font-size:10px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px">Display name in DroneHub</div>
          <input id="gcal-pick-label-${i}" type="text" value="${cal.name}" placeholder="e.g. Work, Personal, Travel…"
            style="width:100%;box-sizing:border-box;padding:6px 10px;border:1px solid var(--border-bright);border-radius:8px;font-size:12px;background:var(--navy-mid);color:var(--white)">
        </div>
      </div>`).join('');
  }catch(e){
    if(listEl) listEl.innerHTML=`<div style="color:var(--red);font-size:12px;padding:10px">${e.message}</div>`;
  }
}

function gcalPickerToggle(idx){
  if(_gcalPickerCalendars[idx]) _gcalPickerCalendars[idx].selected=!_gcalPickerCalendars[idx].selected;
  const selected=_gcalPickerCalendars[idx]?.selected;
  // Update row border
  const row=document.getElementById('gcal-pick-row-'+idx);
  if(row) row.style.borderColor=selected?'var(--blue)':'var(--border)';
  // Show/hide the name input
  const wrap=document.getElementById('gcal-pick-label-wrap-'+idx);
  if(wrap) wrap.style.display=selected?'block':'none';
  // Focus the name input when newly checked
  if(selected){
    const inp=document.getElementById('gcal-pick-label-'+idx);
    if(inp){ inp.select(); inp.focus(); }
  }
}

// Save picker selection and sync
async function gcalPickerSave(){
  const memberId=_gcalPickerMemberId;
  const memberName=_gcalPickerMemberName;
  if(!memberId) return;
  const selected=_gcalPickerCalendars.filter(c=>c.selected);
  if(!selected.length){alert('Please select at least one calendar.');return;}
  const statusEl=document.getElementById('gcal-picker-status');
  const saveBtn=document.getElementById('gcal-picker-save-btn');
  if(saveBtn){saveBtn.disabled=true;saveBtn.textContent='Syncing…';}
  if(statusEl) statusEl.textContent='Saving selection and syncing events…';
  try{
    const calendarIds=selected.map(c=>c.id);
    const data=await gcalApiCall('sync',memberId,{calendarIds});
    // Build gcal_links entries for each selected calendar
    const links=getGcalLinks().filter(l=>l.oauthMemberId!==memberId); // remove old OAuth entries for this member
    selected.forEach((cal,si)=>{
      // Use the custom display name typed by the user, fall back to Google name
      const origIdx=_gcalPickerCalendars.indexOf(cal);
      const customLabel=(document.getElementById('gcal-pick-label-'+origIdx)?.value||'').trim();
      const calLabel=customLabel || cal.name;
      links.push({
        id:'goauth_'+memberId+'_'+Date.now()+'_'+Math.random().toString(36).slice(2,6),
        creatorName:memberName,
        calLabel,
        oauthMemberId:memberId,
        oauthCalendarId:cal.id,
        events:(data.events||[]).filter(e=>e.calendarId===cal.id),
        lastSync:new Date().toISOString(),
        syncError:null,
        addedAt:new Date().toISOString().slice(0,10),
      });
    });
    saveGcalLinks(links);
    // Refresh profile locally
    const profile=tpProfileLoad(memberId);
    tpProfileSave(memberId,{...profile,googleCalConnected:true,googleCalSelectedIds:calendarIds});
    document.getElementById('gcal-picker-modal').style.display='none';
    renderCalLinkedList();
    renderCalendar();
    if(_tpMemberId===memberId) tpRender();
    showDhToast('Google Calendar','Synced '+data.count+' events from '+selected.length+' calendar'+(selected.length!==1?'s':'')+'!','✅','var(--green)',4000);
  }catch(e){
    if(statusEl) statusEl.textContent='Error: '+e.message;
    showDhToast('Sync failed',e.message,'⚠️','var(--red)',5000);
  }finally{
    if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Save & Sync';}
  }
}

// Sync all OAuth calendars for a member (background)
async function gcalSyncAllForMember(memberId,memberName){
  try{
    const data=await gcalApiCall('sync',memberId,{});
    const links=getGcalLinks();
    const profile=tpProfileLoad(memberId);
    const selectedIds=profile?.googleCalSelectedIds||['primary'];
    // Remove stale OAuth entries, rebuild
    const filtered=links.filter(l=>l.oauthMemberId!==memberId);
    selectedIds.forEach(calId=>{
      const existing=links.find(l=>l.oauthMemberId===memberId&&l.oauthCalendarId===calId);
      filtered.push({
        ...(existing||{id:'goauth_'+memberId+'_'+calId,creatorName:memberName||memberId,calLabel:calId,oauthMemberId:memberId,oauthCalendarId:calId,addedAt:new Date().toISOString().slice(0,10)}),
        events:(data.events||[]).filter(e=>e.calendarId===calId),
        lastSync:new Date().toISOString(),
        syncError:null,
      });
    });
    saveGcalLinks(filtered);
    renderCalLinkedList();
    renderCalendar();
  }catch(e){
    console.warn('[gcalSyncAllForMember]',e.message);
  }
}

// Disconnect Google Calendar
async function gcalDisconnect(memberId,memberName){
  if(!confirm('Disconnect your Google Calendar? Your events will stop syncing.')) return;
  try{
    await gcalApiCall('disconnect',memberId,{});
    // Remove OAuth entries from gcal_links
    saveGcalLinks(getGcalLinks().filter(l=>l.oauthMemberId!==memberId));
    // Explicitly delete this member's sub-collection doc (saveGcalLinks handles it via
    // prevKeys diffing, but this is an explicit guarantee for the disconnect case)
    if(_fbToken()) fbSubDelete('gcal','m_'+memberId).catch(()=>{});
    // Update local profile cache
    tpProfileSave(memberId,{googleCalConnected:false,googleCalEmail:null,googleCalSelectedIds:null});
    renderCalLinkedList();
    renderCalendar();
    if(_tpMemberId===memberId) tpRender();
    showDhToast('Google Calendar','Disconnected successfully.','✓','var(--muted)',3000);
  }catch(e){
    showDhToast('Error',e.message,'⚠️','var(--red)',4000);
  }
}
