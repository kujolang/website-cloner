import {calendarView} from './calendar-view.mjs';
import {formatEventValue} from './event-presentation.mjs';
export function calendarListPage(manifest,date,pageSize,page=1){
 if(!Number.isInteger(pageSize)||pageSize<1||pageSize>1000)throw Error('Calendar page size is unavailable');
 if(!Number.isInteger(page)||page<1||page>1000000)throw Error('Invalid calendar page');
 const all=calendarView(manifest,{date,view:'list'}),pages=Math.max(1,Math.ceil(all.length/pageSize));page=Math.min(page,pages);
 const entries=all.slice((page-1)*pageSize,page*pageSize),first=page===1?date:(entries[0]?.start.slice(0,10)||date),start=first<date?date:first,last=entries.at(-1)?.start.slice(0,10)||date,end=last<start?date:last;
 return {entries,page,pages,total:all.length,hasPrevious:page>1,hasNext:page<pages,start,end,showEnd:page<pages&&new Set(entries.map(e=>e.start.slice(0,10))).size>1&&start!==end};
}
export function renderListHeading(button,definition,state,{fragment,locale='en',today}={}){
 if(!button)return;
 if(!definition?.time||!definition?.formats||(!state.hasNext&&!definition.fallback))throw Error('Calendar list heading templates are unavailable');
 const useNow=state.hasNext&&state.page===1&&state.start===today&&definition.nowTime;
 const time=fragment(state.hasNext?(useNow||definition.time):definition.fallback).firstElementChild;time.setAttribute('datetime',state.start);
 if(state.hasNext&&!useNow)for(const [i,span]of [...time.querySelectorAll('span')].entries()){if(!definition.formats[i])throw Error('Calendar list date format is unavailable');span.textContent=formatEventValue(state.start,definition.formats[i],locale);}
 const nodes=[time];if(state.showEnd){if(!definition.separator||!definition.endTime)throw Error('Calendar list range template is unavailable');nodes.push(fragment(definition.separator));const end=fragment(definition.endTime).firstElementChild;end.setAttribute('datetime',state.end);for(const [i,span]of [...end.querySelectorAll('span')].entries()){const spec=definition.endFormats?.[i]||definition.formats[i];if(!spec)throw Error('Calendar list range format is unavailable');span.textContent=formatEventValue(state.end,spec,locale);}nodes.push(end);}
 // Keep the source icon and button itself (and its picker listeners).
 button.querySelectorAll('.tribe-events-c-top-bar__datepicker-time,.tribe-events-c-top-bar__datepicker-separator').forEach(n=>n.remove());button.prepend(...nodes);
}
export function renderListNavigation(root,state,date,onSelect){
 for(const [selector,enabled,page]of [['.tribe-events-c-nav__prev',state.hasPrevious,state.page-1],['.tribe-events-c-nav__next',state.hasNext,state.page+1]])for(const old of root.querySelectorAll(selector)){
  const next=document.createElement(enabled?'a':'button');for(const attr of old.attributes)if(!/^(href|disabled|aria-disabled|data-migration-unavailable|data-calendar-page|type|rel)$/i.test(attr.name)&&!/^on/i.test(attr.name))next.setAttribute(attr.name,attr.value);
  next.innerHTML=old.innerHTML;if(enabled){const url=new URL(location.href);url.searchParams.set('calendar-date',date);url.searchParams.set('calendar-page',String(page));next.href=url.href;next.rel=page>state.page?'next':'prev';next.dataset.calendarPage=String(page);next.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();onSelect(page);});}else{next.type='button';next.disabled=true;}old.replaceWith(next);
 }
}
