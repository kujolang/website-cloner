import {createHash} from 'node:crypto';
const escape=value=>String(value||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;').replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g,'');
function stamp(value,dateOnly=false){
 const pattern=dateOnly?/^(\d{4}-\d{2}-\d{2})(?:[ T]\d{2}:\d{2}:\d{2})?$/:/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})Z?$/;
 const match=pattern.exec(value||'');if(!match)throw Error('Missing or invalid event date');
 const input=match[1]+'T'+(dateOnly?'00:00:00':match[2])+'Z',date=new Date(input);
 if(!Number.isFinite(date.valueOf())||date.toISOString().slice(0,19)!==input.slice(0,19))throw Error('Invalid event date');
 return date;
}
const compact=date=>date.toISOString().replace(/[-:]/g,'').replace('.000','');
// RFC5545 folds by UTF-8 octets, never in the middle of a character.
function fold(line){let result='',current='',bytes=0;for(const ch of line){const size=Buffer.byteLength(ch);if(bytes+size>75){result+=current+'\r\n';current=' ';bytes=1;}current+=ch;bytes+=size;}return result+current;}
export function calendarEvent(page,origin,base=''){
 const event=page.meta.event;if(!event)return null;
 const start=stamp(event.all_day?event.start:event.utc_start,event.all_day),end=stamp(event.all_day?event.end:event.utc_end,event.all_day);
 if(end<start)throw Error('Event ends before it starts');
 if(event.all_day)end.setUTCDate(end.getUTCDate()+1);
 const uid=createHash('sha256').update(origin+'|'+(event.id||page.sourceRoute||page.route)).digest('hex')+'@website-cloner';
 const route='/assets/calendars/'+createHash('sha256').update(page.route).digest('hex').slice(0,20)+'.ics';
 const venue=event.venue||{},location=['venue','address','city','state','province','zip','country'].map(k=>venue[k]).filter(Boolean).join(', ');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Website Cloner//Static Events//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+compact(event.captured_at?stamp(event.captured_at):new Date()),'SUMMARY:'+escape(page.title),'URL:'+new URL(base+page.route,origin).href];
 if(event.all_day)lines.push('DTSTART;VALUE=DATE:'+compact(start).slice(0,8),'DTEND;VALUE=DATE:'+compact(end).slice(0,8));else lines.push('DTSTART:'+compact(start),'DTEND:'+compact(end));
 if(location)lines.push('LOCATION:'+escape(location));
 if(page.description)lines.push('DESCRIPTION:'+escape(page.description));
 lines.push('END:VEVENT','END:VCALENDAR');
 const canonical=new URL(base+page.route,origin).href,details=[page.description,canonical].filter(Boolean).join('\n\n');
 const google=new URL('https://www.google.com/calendar/event');google.search=new URLSearchParams({action:'TEMPLATE',text:page.title,dates:(event.all_day?compact(start).slice(0,8):compact(start))+'/'+(event.all_day?compact(end).slice(0,8):compact(end)),details,location}).toString();
 const outlook=host=>{const url=new URL('/owa/',host);url.search=new URLSearchParams({path:'/calendar/action/compose',rrv:'addevent',subject:page.title,body:details,location,startdt:start.toISOString(),enddt:end.toISOString(),allday:String(!!event.all_day)}).toString();return url.href;};
 return {route,eventText:lines.slice(4,-1).map(fold).join('\r\n')+'\r\n',text:lines.map(fold).join('\r\n')+'\r\n',links:{gcal:google.href,'outlook-365':outlook('https://outlook.office.com'),'outlook-live':outlook('https://outlook.live.com')}};
}
export function applyEventCalendar($,calendar,base=''){
 if(!calendar)return;
 for(const [kind,url]of Object.entries(calendar.links||{}))$('.tribe-events-c-subscribe-dropdown__list-item--'+kind+' a').attr('href',url).removeAttr('aria-disabled').removeAttr('data-migration-unavailable');
 $('head').append($('<link>').attr({rel:'alternate',type:'text/calendar',href:base+calendar.route,title:'Add event to calendar'}));
 $('a.tribe-events-ical,a.tribe-events-button[href*="ical"],.tribe-events-c-subscribe-dropdown__list-item--ical a').attr('href',base+calendar.route).attr('download','event.ics');
}

const isEvent=node=>[node?.['@type']].flat().some(t=>typeof t==='string'&&/(?:^|\/)(?:Event|BusinessEvent|ChildrensEvent|ComedyEvent|CourseInstance|DanceEvent|DeliveryEvent|EducationEvent|ExhibitionEvent|Festival|FoodEvent|Hackathon|LiteraryEvent|MusicEvent|PublicationEvent|SaleEvent|ScreeningEvent|SocialEvent|SportsEvent|TheaterEvent|VisualArtsEvent)$/.test(t));
// Update the current event, not unrelated events embedded in a graph/list.
export function synchronizeEventSchema(documents,page,canonical){
 const event=page.meta.event;if(!event)return {documents,issues:[]};
 const issues=[],copy=structuredClone(documents),nodes=[];
 function walk(value,depth=0){if(depth>64)return;if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return;}if(!value||typeof value!=='object')return;if(isEvent(value))nodes.push(value);for(const [key,child]of Object.entries(value))if(key!=='@context')walk(child,depth+1);}
 walk(copy);
 const normalize=value=>{try{const u=new URL(value,canonical);u.hash='';return u.href.replace(/\/$/,'');}catch{return null;}};
 const identities=node=>[node.url,typeof node.mainEntityOfPage==='string'?node.mainEntityOfPage:node.mainEntityOfPage?.['@id']].filter(v=>typeof v==='string');
 let selected=nodes.filter(node=>identities(node).some(value=>normalize(value)===normalize(canonical)));
 if(!selected.length&&nodes.length===1&&!identities(nodes[0]).length)selected=[nodes[0]];
 if(!selected.length&&nodes.length){issues.push({kind:'event-schema-identity-unmatched',count:nodes.length});return {documents:copy,issues};}
 let start,end;
 try{start=stamp(event.all_day?event.start:event.utc_start,event.all_day);end=stamp(event.all_day?event.end:event.utc_end,event.all_day);if(end<start)throw Error('Event ends before it starts');}
 catch(error){issues.push({kind:'event-schema-invalid-dates',message:error.message});return {documents:copy,issues};}
 if(!selected.length){const node={'@context':'https://schema.org','@type':'Event','@id':canonical+'#event'};copy.push(node);selected=[node];}
 const date=value=>event.all_day?value.toISOString().slice(0,10):value.toISOString().replace('.000Z','Z');
 for(const node of selected){
  node.name=page.title;node.url=canonical;node.startDate=date(start);node.endDate=date(end);
  if(page.description)node.description=page.description;
  const venue=event.venue||{};
  if(venue.venue||venue.address||venue.city){
   const address=Object.fromEntries([['streetAddress',venue.address],['addressLocality',venue.city],['addressRegion',venue.state||venue.province],['postalCode',venue.zip],['addressCountry',venue.country]].filter(([,v])=>v));
   const place={'@type':'Place',...(venue.venue?{name:venue.venue}:{}),...(Object.keys(address).length?{address:{'@type':'PostalAddress',...address}}:{})};
   // Retain a separate online location for mixed-attendance source events.
   const virtual=[node.location].flat().filter(x=>[x?.['@type']].flat().includes('VirtualLocation'));
   node.location=virtual.length?[place,...virtual]:place;
  }
  if(node.offers)issues.push({kind:'event-offers-source-snapshot',message:'Source offers are not bound to event.cost or a ticket service.'});
 }
 return {documents:copy,issues};
}

// Feed membership follows the native archive binding, never DOM title guesses.
export function archiveCalendar(page,records,bindings,origin,base=''){
 const binding=bindings.find(b=>b.source===(page.archiveBindingSource||page.collection+'/'+page.slug));
 if(!binding)return null;
 const filter=binding.filter,seen=new Set(),included=[],issues=[],events=[],entries=[];
 const eventCollections=new Set(records.filter(record=>record.meta.event).map(record=>record.collection));
 if(filter.types&&!filter.types.some(type=>eventCollections.has(type)))return null;
 for(const record of records){
  if(!record.meta.event||/\b(noindex|none)\b/i.test(record.robots||'')||record.meta.draft===true||record.meta.status==='draft')continue;
  const matches=filter.types?filter.types.includes(record.collection):[...(record.meta[filter.taxonomy]||record.meta.taxonomies?.[filter.taxonomy]||[])].map(String).includes(String(filter.term));
  if(!matches)continue;
  const identity=record.canonicalRoute||record.route;if(seen.has(identity))continue;
  try{events.push(calendarEvent(record,origin,base).eventText);included.push(record.route);seen.add(identity);const event=record.meta.event;entries.push({route:base+record.route,title:record.title,description:record.description||'',start:event.start,end:event.end,timezone:event.timezone||'',allDay:!!event.all_day,venue:[event.venue?.venue,event.venue?.address,event.venue?.city].filter(Boolean).join(', ')});}catch(error){issues.push({route:record.route,error:error.message});}
 }
 const route='/assets/calendars/archive-'+createHash('sha256').update(binding.root).digest('hex').slice(0,20)+'.ics';
 const url=new URL(base+route,origin).href;
 const google=new URL('https://www.google.com/calendar/render');google.searchParams.set('cid',url);
 const outlook=host=>{const u=new URL('/owa/',host);u.search=new URLSearchParams({path:'/calendar/action/compose',rru:'addsubscription',url,name:page.title}).toString();return u.href;};
 return {route,included,issues,scope:JSON.stringify(binding.filter),manifestRoute:route.replace(/\.ics$/,'.json'),manifest:{schema:'website-cloner-calendar/v1',events:entries},text:'BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Website Cloner//Static Events//EN\r\nCALSCALE:GREGORIAN\r\n'+events.join('')+'END:VCALENDAR\r\n',links:{gcal:google.href,'outlook-365':outlook('https://outlook.office.com'),'outlook-live':outlook('https://outlook.live.com')}};
}
export function applyArchiveCalendar($,calendar,base=''){
 applyEventCalendar($,calendar,base);
 $('.tribe-events-c-subscribe-dropdown__list-item--ics a,.tribe-events-c-subscribe-dropdown__list-item--outlook-ics a,.tribe-events-c-subscribe-dropdown__list-item--ical a').attr('href',base+calendar.route).attr('download','events.ics');
 $('.tribe-events-c-subscribe-dropdown__list-item a').each((_,node)=>{const a=$(node);if(!a.attr('href'))return;a.removeAttr('aria-disabled').removeAttr('data-migration-unavailable');if(a.attr('title')==='This destination was not included in this static export.')a.removeAttr('title');});
}

// Keep archive schema tied to the visible native event cards after author edits.
export function synchronizeArchiveEventSchema(documents,records,visibleKeys,origin,base=''){
 const normalize=value=>{try{const u=new URL(value,origin);u.hash='';return u.href.replace(/\/$/,'');}catch{return null;}};
 const byURL=new Map(records.map(record=>[normalize(new URL(base+(record.canonicalRoute||record.route),origin).href),record])),seen=new Set(),issues=[];
 const key=record=>record.collection+'/'+record.slug;
 function walk(value){if(Array.isArray(value))return value.map(walk).filter(v=>v!==undefined);if(!value||typeof value!=='object')return value;
  if(isEvent(value)){const record=[value.url,typeof value.mainEntityOfPage==='string'?value.mainEntityOfPage:value.mainEntityOfPage?.['@id']].map(normalize).map(url=>byURL.get(url)).find(Boolean);if(record){if(!visibleKeys.has(key(record)))return undefined;const canonical=new URL(base+(record.canonicalRoute||record.route),origin).href,result=synchronizeEventSchema([value],record,canonical);issues.push(...result.issues);seen.add(key(record));return result.documents[0];}}
  return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,walk(v)]).filter(([,v])=>v!==undefined));
 }
 const result=walk(documents);for(const record of records)if(visibleKeys.has(key(record))&&!seen.has(key(record))){const added=synchronizeEventSchema([],record,new URL(base+(record.canonicalRoute||record.route),origin).href);result.push(...added.documents);issues.push(...added.issues);}
 return {documents:result,issues};
}
