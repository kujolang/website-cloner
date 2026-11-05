// Public site timezone settings only. Never infer a timezone from event dates.
export function calendarClock(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return null;
 const zone=value.timeZone??value.timezone_string;
 if(typeof zone==='string'&&zone.length>0&&zone.length<=100){try{new Intl.DateTimeFormat('en',{timeZone:zone});return {timeZone:zone};}catch{}}
 const offset=value.offsetMinutes??(typeof value.gmt_offset==='number'?value.gmt_offset*60:undefined);
 if(Number.isInteger(offset)&&Math.abs(offset)<=14*60)return {offsetMinutes:offset};
 return null;
}
export function calendarToday(value,now=new Date()){
 const clock=calendarClock(value);
 if(clock?.timeZone){const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:clock.timeZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}`;}
 if(clock)return new Date(now.valueOf()+clock.offsetMinutes*60000).toISOString().slice(0,10);
 return [now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
}
export function applyCalendarClock($,value){
 const clock=calendarClock(value);
 $('[data-migration-calendar]').each((_,el)=>{const root=$(el);root.removeAttr('data-migration-calendar-clock');if(clock)root.attr('data-migration-calendar-clock',JSON.stringify(clock));});
 return clock;
}
