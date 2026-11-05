import {calendarClock} from '../scripts/calendar-clock.mjs';
import {recordWordpress,taxonomyName} from './wordpress.mjs';
import {load} from 'cheerio';
const plain=value=>load(String(value||'')).text().trim();
export function recordEvent(model,row){
 if(!Number.isInteger(row?.id)||row.id<1||row.status!=='publish')return false;
 let url;try{url=new URL(row.url);if(url.origin!==new URL(model.source).origin||url.search||url.hash||url.username||url.password)return false;}catch{return false;}
 recordWordpress(model,{id:row.id,type:'tribe_events',link:url.href,slug:row.slug,date:row.date,modified:row.modified,excerpt:{rendered:row.excerpt||''}},{slug:'tribe_events'});
 const record=model.wordpress.records[url.href];if(!record)return false;
 for(const [key,tax]of [['categories','tribe_events_cat'],['tags','post_tag']]){
  const terms=model.wordpress.terms[tax]||=[];const ids=[];
  if(!model.wordpress.taxonomies.some(t=>t.slug===tax))model.wordpress.taxonomies.push({slug:tax,types:['tribe_events'],method:'events-public-api'});
  for(const term of Array.isArray(row[key])?row[key]:[]){if(!Number.isInteger(term.id))continue;ids.push(term.id);if(!terms.some(t=>t.id===term.id))terms.push({id:term.id,name:plain(term.name),slug:term.slug||'',parent:term.parent||0,url:term.url||''});}
  record.terms[taxonomyName(tax)]=ids;
 }
 const venue=row.venue||{};
 record.event={schema:'public-event/v1',id:row.id,captured_at:new Date().toISOString().replace(/\.\d{3}Z$/,'Z'),all_day:row.all_day===true,start:row.start_date||'',end:row.end_date||'',utc_start:row.utc_start_date||'',utc_end:row.utc_end_date||'',timezone:row.timezone||'',cost:plain(row.cost),venue:Object.fromEntries(['id','venue','address','city','state','province','zip','country'].filter(k=>venue[k]!==undefined).map(k=>[k,k==='id'?venue[k]:plain(venue[k])])),provenance:{method:'events-public-api',snapshot:true},recurrence:{status:'not-exposed',note:'Only captured occurrences are exported; no recurrence rule is inferred.'}};
 record.featuredImage ||= row.image?.url||'';return true;
}
export async function enrichEvents(model,network,save=async()=>{}){
 const candidates=model.pages.filter(p=>p.wordpress?.type==='tribe_events'||/(?:^|\s)single-tribe_events(?:\s|$)/.test(p.bodyClass||''));
 if(!candidates.length&&!model.pages.some(p=>/tribe-events-view/.test((p.shell||'')+(p.content||'')+(p.bodyClass||''))))return;
 const state=model.events ||= {schema:'events-discovery/v1',checked:[],issues:[]};const checked=new Set(state.checked);
 const root=new URL(model.wordpress.apiRoot||'/wp-json',model.source);if(root.origin!==new URL(model.source).origin)throw Error('Invalid events API origin');
 if(!state.clockChecked){
  try{const response=await network.get(root.href);if(response.status!==200)throw Error('HTTP '+response.status);state.clock=calendarClock(JSON.parse(response.body));if(!state.clock)throw Error('Public site timezone unavailable');}
  catch(error){if(['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(error.code))throw error;state.issues.push({kind:'calendar-timezone-unavailable',error:error.message});}
  state.clockChecked=true;await save();
 }
 for(const page of candidates){
  const id=page.wordpress?.id||Number(/(?:^|\s)postid-(\d+)(?:\s|$)/.exec(page.bodyClass||'')?.[1]);
  if(!id){if(!state.issues.some(i=>i.route===page.route))state.issues.push({route:page.route,error:'Public event identifier unavailable'});continue;}if(checked.has(id))continue;
  try{const response=await network.get(root.href.replace(/\/$/,'')+'/tribe/events/v1/events/'+id);if(response.status!==200)throw Error('HTTP '+response.status);const row=JSON.parse(response.body);if(row.id!==id||!recordEvent(model,row))throw Error('Invalid public event record');}
  catch(error){if(['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(error.code))throw error;state.issues.push({id,route:page.route,error:error.message});}
  checked.add(id);state.checked=[...checked];await save();
 }
}
