const pad=n=>String(n).padStart(2,'0');
const localStamp=date=>date.toISOString().slice(0,19).replace('T',' ');
function parse(value){const text=String(value||'').replace('T',' ').replace(/Z$/,'');if(!/^\d{4}-\d{2}-\d{2}(?: \d{2}:\d{2}:\d{2})?$/.test(text))throw Error('Invalid event date');const date=new Date(text.slice(0,10)+'T'+(text.slice(11)||'00:00:00')+'Z');if(!Number.isFinite(+date)||localStamp(date)!==(text.length===10?text+' 00:00:00':text))throw Error('Invalid event date');return date;}
function zoned(date,zone){
 const fixed=/^(?:UTC)?([+-])(\d{1,2})(?::?(\d{2}))?$/.exec(zone||'');if(fixed){const minutes=Number(fixed[2])*60+Number(fixed[3]||0);if(minutes>840||Number(fixed[3]||0)>59)throw Error('Invalid event timezone');return localStamp(new Date(+date+(fixed[1]==='-'?-1:1)*minutes*60000));}
 const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone||'UTC',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}`;
}
function toUTC(value,zone,explicit){
 if(!zone)throw Error('A timezone is required when editing local event dates');const date=parse(value),target=localStamp(date),offsets=new Set();
 for(const delta of [-36,-12,0,12,36]){const sample=new Date(+date+delta*3600000);offsets.add(+parse(zoned(sample,zone))-+sample);}
 const candidates=[...offsets].map(offset=>new Date(+date-offset)).filter(candidate=>zoned(candidate,zone)===target);
 if(explicit){const instant=parse(explicit);if(!candidates.some(c=>+c===+instant))throw Error('Local and UTC event dates disagree');return localStamp(instant);}
 if(candidates.length!==1)throw Error(candidates.length?'Ambiguous local event time; provide the matching UTC value':'Local event time does not exist in this timezone');return localStamp(candidates[0]);
}
// Local edits update UTC; explicit UTC edits update local display. Conflicting
// edits and DST gaps/ambiguities fail instead of inventing an instant.
export function normalizeEventDates(event,previous){
 const result={...event};if(previous&&['start','end','utc_start','utc_end','timezone','all_day'].every(key=>event[key]===previous[key]))return result;
 if(event.all_day){if(parse(event.end)<parse(event.start))throw Error('Event ends before it starts');return result;}
 for(const field of ['start','end']){const utc='utc_'+field,localChanged=previous&&(event[field]!==previous[field]||event.timezone!==previous.timezone||previous.all_day),utcChanged=previous&&event[utc]!==previous[utc];
  if(!previous)result[utc]=toUTC(event[field],event.timezone,event[utc]||null);
  else if(localChanged)result[utc]=toUTC(event[field],event.timezone,utcChanged?event[utc]:null);
  else if(utcChanged)result[field]=zoned(parse(event[utc]),event.timezone);
 }
 if(parse(result.utc_end)<parse(result.utc_start))throw Error('Event ends before it starts');return result;
}
const dates=['MMMM d, yyyy','d MMMM yyyy','MMMM d yyyy','MMM d, yyyy','d MMM yyyy','yyyy-MM-dd','MM/dd/yyyy','dd/MM/yyyy','d/M/yyyy','M/d/yyyy','dd.MM.yyyy','MMMM yyyy','MMM yyyy','M/yyyy','MM/yyyy','yyyy/MM','EEE','EEEE','d','dd'];
const times=['h:mm a','h:mm A','hh:mm a','HH:mm','H:mm','HH:mm:ss','h a','h A'];
const formatPartsCache=new Map();
function format(value,pattern,locale='en'){const key=value+'\0'+locale;let parts=formatPartsCache.get(key);if(!parts){const d=parse(value),hour=d.getUTCHours(),period=new Intl.DateTimeFormat(locale,{timeZone:'UTC',hour:'numeric',hour12:true}).formatToParts(d).find(p=>p.type==='dayPeriod')?.value||(hour<12?'am':'pm'),intl=options=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',...options}).format(d);parts={yyyy:String(d.getUTCFullYear()),yy:pad(d.getUTCFullYear()%100),MMMM:intl({month:'long'}),MMM:intl({month:'short'}),MM:pad(d.getUTCMonth()+1),M:String(d.getUTCMonth()+1),dd:pad(d.getUTCDate()),d:String(d.getUTCDate()),EEEE:intl({weekday:'long'}),EEE:intl({weekday:'short'}),HH:pad(hour),H:String(hour),hh:pad(hour%12||12),h:String(hour%12||12),mm:pad(d.getUTCMinutes()),ss:pad(d.getUTCSeconds()),a:period.toLocaleLowerCase(locale),A:period.toLocaleUpperCase(locale)};formatPartsCache.set(key,parts);if(formatPartsCache.size>256)formatPartsCache.delete(formatPartsCache.keys().next().value);}
 return pattern.replace(/\[[^\]]*\]|yyyy|yy|MMMM|MMM|MM|M|dd|d|EEEE|EEE|HH|H|hh|h|mm|ss|a|A/g,t=>t.startsWith('[')?t.slice(1,-1):parts[t]);}
export function eventFormat(text,value,locale='en'){
 const normalized=String(text).replace(/\s+/g,' ').trim();
 const numeric=/^(\d{1,2})([/.])(\d{1,2})\2\d{4}(?:\b|$)/.exec(normalized);
 if(numeric&&Number(numeric[1])===Number(numeric[3]))return null;
 for(const date of dates){if(format(value,date,locale)===normalized)return {date,time:null,separator:''};for(const time of times)for(const separator of [' @ ',' at ',' ',' – ', ', '])if(format(value,date,locale)+separator+format(value,time,locale)===normalized)return {date,time,separator};}
 for(const time of times)if(format(value,time,locale)===normalized)return {date:null,time,separator:''};return null;
}
export function formatEventValue(value,spec,locale='en',mode='both'){if(!spec)throw Error('Source event date format could not be inferred');const date=spec.date&&mode!=='time'?format(value,spec.date,locale):'',time=spec.time&&mode!=='date'?format(value,spec.time,locale):'';return date+(date&&time?spec.separator:'')+time;}
function updateEventTimezones($,event,previous,locale,issues){
 $('.tribe-events-time-zone').each((_,node)=>{
  const el=$(node),label=el.text().trim();if(event.all_day){el.remove();return;}
  if(!previous.utc_start||!event.utc_start){issues.push('Event timezone label requires a UTC baseline');return;}
  if(label===previous.timezone){el.text(event.timezone);return;}
  let replacement;
  for(const language of [...new Set([locale,'en-US','en-GB'])])for(const style of ['short','long','shortOffset','longOffset']){
   try{
    const name=(value,zone)=>new Intl.DateTimeFormat(language,{timeZone:zone,timeZoneName:style}).formatToParts(parse(value)).find(p=>p.type==='timeZoneName')?.value;
    if(name(previous.utc_start,previous.timezone)===label)replacement=name(event.utc_start,event.timezone);
   }catch{}
   if(replacement)break;
  }
  if(replacement)el.text(replacement);else issues.push('Unsupported event timezone label: '+label);
 });
}
export function renderEventDates($,event,previous,{locale='en'}={}){
 const issues=[];if(!previous)return ['Source event date format baseline unavailable'];
 const update=(selector,before,after,mode='both')=>$(selector).each((_,node)=>{const el=$(node),spec=eventFormat(el.text(),before,locale);if(!spec){issues.push('Unsupported event date format: '+selector);return;}el.text(formatEventValue(after,spec,locale,mode));});
 if(event.all_day!==previous.all_day)issues.push('Event all-day/timed layout changed; source detail layout variant requires review');
 if((event.start.slice(0,10)===event.end.slice(0,10))!==(previous.start.slice(0,10)===previous.end.slice(0,10))&&$('.tribe-events-meta-group-details').length)issues.push('Event single-day/multi-day detail layout changed; source layout variant requires review');
 const dateChanged=['start','end','all_day','timezone'].some(key=>event[key]!==previous[key]);if(!dateChanged)return issues;
 const start=$('.tribe-event-date-start').first(),startSpec=start.length?eventFormat(start.text(),previous.start,locale):null;
 update('.tribe-event-date-start',previous.start,event.start,event.all_day?'date':'both');
 update('.tribe-event-date-end',previous.end,event.end,event.all_day?'date':'both');
 $('.tribe-event-time').each((_,node)=>{const el=$(node),sameDay=event.start.slice(0,10)===event.end.slice(0,10);if(!sameDay&&startSpec?.date){el.text(formatEventValue(event.end,startSpec,locale,event.all_day?'date':'both')).removeClass('tribe-event-time').addClass('tribe-event-date-end');}else if(event.all_day){const prev=node.prev;if(prev?.type==='text'&&/^\s*[-–—]\s*$/.test(prev.data))$(prev).remove();el.remove();}else{const spec=eventFormat(el.text(),previous.end,locale);if(spec)el.text(formatEventValue(event.end,spec,locale));else issues.push('Unsupported event end time format');}});
 update('.tribe-events-start-date',previous.start,event.start,'date');update('.tribe-events-end-date',previous.end,event.end,'date');
 update('.tribe-events-start-datetime',previous.start,event.start,event.all_day?'date':'both');update('.tribe-events-end-datetime',previous.end,event.end,event.all_day?'date':'both');
 update('.tribe-events-calendar-list__event-date-tag-weekday',previous.start,event.start);update('.tribe-events-calendar-list__event-date-tag-daynum',previous.start,event.start);
 $('.tribe-events-calendar-list__event-date-tag-datetime,.tribe-events-calendar-list__event-datetime').attr('datetime',event.start.slice(0,10));
 $('.tribe-events-start-date,.tribe-events-start-time,.tribe-events-start-datetime').attr('title',event.start.slice(0,10));$('.tribe-events-end-date,.tribe-events-end-time,.tribe-events-end-datetime').attr('title',event.end.slice(0,10));
 $('.tribe-events-start-time,.tribe-events-end-time').each((_,node)=>{
  const el=$(node),copy=el.clone();copy.find('.tribe-events-time-zone').remove();
  const before=copy.text().replace(/\s+/g,' ').trim();
  let range;
  for(const pattern of times){
   const start=format(previous.start,pattern,locale),end=format(previous.end,pattern,locale);
   if(!before.startsWith(start)||!before.endsWith(end))continue;
   const separator=before.slice(start.length,before.length-end.length);
   if(/^\s*[-–—]\s*$/.test(separator)){range={pattern,separator};break;}
  }
  let value;
  if(range&&!event.all_day)value=format(event.start,range.pattern,locale)+range.separator+format(event.end,range.pattern,locale);
  else if(event.all_day)value='';
  else{const which=el.hasClass('tribe-events-end-time')?'end':'start',spec=eventFormat(before,previous[which],locale);if(spec)value=formatEventValue(event[which],spec,locale);else issues.push('Unsupported event details time format');}
  if(value!==undefined){
   const zones=el.find('.tribe-events-time-zone').remove();el.text(value);
   if(!event.all_day&&zones.length){el.append(' ');el.append(zones);}
  }
 });
 updateEventTimezones($,event,previous,locale,issues);
 return issues;
}
