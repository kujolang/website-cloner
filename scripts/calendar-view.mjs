// Civil-date queries over exported native records. No network or source runtime.
const iso=date=>date.toISOString().slice(0,10);
function date(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))throw Error('Invalid calendar date');
 const parsed=new Date(value+'T00:00:00Z');if(!Number.isFinite(+parsed)||iso(parsed)!==value)throw Error('Invalid calendar date');return parsed;
}
export function calendarPeriod(value,view='day'){
 const start=date(value);if(!['day','month','list'].includes(view))throw Error('Unknown calendar view');
 if(view==='month')start.setUTCDate(1);
 const end=new Date(start);if(view==='month'){end.setUTCMonth(end.getUTCMonth()+1);end.setUTCDate(0);}
 return {start:iso(start),end:view==='list'?null:iso(end)};
}
export function shiftCalendarDate(value,view,direction){
 if(![-1,1].includes(direction))throw Error('Invalid calendar direction');
 const period=calendarPeriod(value,view),next=date(period.start);
 if(view==='month')next.setUTCMonth(next.getUTCMonth()+direction);else next.setUTCDate(next.getUTCDate()+direction);
 return iso(next);
}
export function calendarView(manifest,{date:day,view='day',query=''}={}){
 if(manifest?.schema!=='website-cloner-calendar/v1'||!Array.isArray(manifest.events))throw Error('Invalid calendar manifest');
 const period=calendarPeriod(day,view),needle=String(query).trim().toLocaleLowerCase();
 return manifest.events.filter(event=>{
  const start=event.start.slice(0,10),end=date(event.end.slice(0,10));date(start);
  // Timed midnight is the next day's boundary, while all-day ends are inclusive.
  if(!event.allDay&&event.end.slice(11)==='00:00:00'&&event.end>event.start)end.setUTCDate(end.getUTCDate()-1);
  return iso(end)>=period.start&&(!period.end||start<=period.end)&&(!needle||[event.title,event.description,event.venue].join(' ').toLocaleLowerCase().includes(needle));
 }).sort((a,b)=>a.start.localeCompare(b.start)||a.route.localeCompare(b.route));
}
export function calendarMonthGrid(manifest,value,weekStartsOn=0){
 if(!Number.isInteger(weekStartsOn)||weekStartsOn<0||weekStartsOn>6)throw Error('Invalid calendar week start');
 const period=calendarPeriod(value,'month'),first=date(period.start),last=date(period.end);
 first.setUTCDate(first.getUTCDate()-(first.getUTCDay()-weekStartsOn+7)%7);last.setUTCDate(last.getUTCDate()+(weekStartsOn+6-last.getUTCDay()+7)%7);
 const intervals=manifest.events.map(event=>{const start=event.start.slice(0,10),end=date(event.end.slice(0,10));date(start);if(!event.allDay&&event.end.slice(11)==='00:00:00'&&event.end>event.start)end.setUTCDate(end.getUTCDate()-1);return {event,start,end:iso(end)};}).filter(e=>e.end>=iso(first)&&e.start<=iso(last)).sort((a,b)=>a.event.start.localeCompare(b.event.start)||a.event.route.localeCompare(b.event.route));
 const weeks=[];for(let current=new Date(first);current<=last;current.setUTCDate(current.getUTCDate()+1)){
  if(!weeks.length||weeks.at(-1).length===7)weeks.push([]);const column=weeks.at(-1).length,day=iso(current);
  weeks.at(-1).push({date:day,inMonth:day.slice(0,7)===period.start.slice(0,7),events:intervals.filter(e=>e.start<=day&&e.end>=day).map(({event,start,end})=>({event,multiday:event.allDay||end>start,display:start===day||column===0,width:Math.min(7-column,Math.round((+date(end)-+current)/86400000)+1),startsHere:start===day,endsThisWeek:end<=iso(new Date(+current+(6-column)*86400000))}))});
 }
 return weeks;
}
