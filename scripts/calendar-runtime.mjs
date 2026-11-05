import {calendarListPage,renderListHeading,renderListNavigation} from './calendar-list.mjs';
import {calendarToday} from './calendar-clock.mjs';
import {calendarPicker} from './calendar-picker.mjs';
import {renderCalendarMonth} from './calendar-month-renderer.mjs';
import {eventFormat,formatEventValue} from './event-presentation.mjs';
import {calendarView,shiftCalendarDate,calendarPeriod} from './calendar-view.mjs';
const selectors={list:'.tribe-events-calendar-list',day:'.tribe-events-calendar-day',month:'.tribe-events-calendar-month'};
function fragment(html){const t=document.createElement('template');t.innerHTML=html;for(const e of t.content.querySelectorAll('script,iframe,object,embed'))e.remove();for(const e of t.content.querySelectorAll('*'))for(const a of [...e.attributes])if(/^on/i.test(a.name)||(/^(href|src)$/i.test(a.name)&&/^\s*(?:javascript|data):/i.test(a.value)))e.removeAttribute(a.name);return t.content;}
for(const root of document.querySelectorAll('[data-migration-calendar]')){
 const view=Object.keys(selectors).find(k=>root.querySelector(selectors[k]));if(!view)continue;
 const locale=document.documentElement.lang||'en',button=root.querySelector('.tribe-events-c-top-bar__datepicker-button'),input=root.querySelector('[data-js="tribe-events-top-bar-date"]');
 let listConfig;try{listConfig=JSON.parse(root.getAttribute('data-migration-calendar-list'));}catch{}
 let clock;try{clock=JSON.parse(root.getAttribute('data-migration-calendar-clock'));}catch{}
 let day=root.querySelector('.tribe-events-c-top-bar__datepicker-time')?.getAttribute('datetime')?.slice(0,10)||calendarToday(clock),pending,version=0;
 if(view==='month'&&/^\d{4}-\d{2}$/.test(day))day+='-01';
 const todayDate=()=>{const today=calendarToday(clock);return view==='month'?today.slice(0,7)+'-01':today;};
 const pickerDate=()=>view==='list'?(root.querySelector('.tribe-events-c-top-bar__datepicker-time')?.getAttribute('datetime')||day):day;
 const requestedDate=value=>value==='today'?todayDate():value;
 const initialDay=day,initialContent=root.querySelector(selectors[view]).cloneNode(true),initialMobile=root.querySelector('.tribe-events-calendar-month-mobile-events')?.cloneNode(true),initialTime=root.querySelector('.tribe-events-c-top-bar__datepicker-time')?.cloneNode(true);
 const preserveListLabel=view==='list'&&root.querySelectorAll('.tribe-events-c-top-bar__datepicker-time').length===1&&!!root.querySelector('.tribe-events-c-nav__next:disabled');
 const compact=root.getAttribute('data-migration-calendar-compact-format'),labelFormats=[...(initialTime?.querySelectorAll('span')||[])].map(span=>{const text=span.textContent.replace(/\s+/g,' ').trim();if(compact&&view!=='month'&&span.classList.contains('tribe-events-c-top-bar__datepicker-mobile')){const spec={date:compact,time:null,separator:''};try{if(formatEventValue(initialDay,spec,locale)===text)return spec;}catch{}}return eventFormat(text,initialDay,locale)||(preserveListLabel&&!/\p{N}/u.test(text)?{literal:text}:null);});
 const navigation=[];const updateLinks=()=>{for(const a of root.querySelectorAll('a[data-calendar-view-route]')){const url=new URL(a.dataset.calendarViewRoute,location.href);if(url.origin===location.origin){url.searchParams.set('calendar-date',day);a.href=url.href;}}for(const {a,direction}of navigation){const url=new URL(location.href);url.searchParams.set('calendar-date',shiftCalendarDate(day,view,direction));a.href=url.href;}};
 const status=document.createElement('p');status.setAttribute('role','status');status.hidden=true;root.append(status);
 async function data(){if(!pending)pending=(async()=>{const url=new URL(root.dataset.migrationCalendar,location.href);if(url.origin!==location.origin)throw Error('Calendar data must be local');const urls=[url.href,url.href.replace(/\.json$/,'.presentation.json')];const [manifest,presentation]=await Promise.all(urls.map(async u=>{const r=await fetch(u,{credentials:'same-origin'});if(!r.ok)throw Error('Calendar data unavailable');return r.json();}));if(presentation.schema!=='website-cloner-calendar-presentation/v1')throw Error('Invalid calendar presentation');return {manifest,presentation};})().catch(e=>{pending=null;throw e;});return pending;}
 const label=(value,options)=>new Intl.DateTimeFormat(locale,{timeZone:'UTC',...options}).format(new Date(value.replace(' ','T')+'Z'));
 async function render(next,push=true,requestedPage=1){const ticket=++version;try{
  calendarPeriod(next,view);root.setAttribute('aria-busy','true');const {manifest,presentation}=await data();if(ticket!==version)return;
  if(view==='list'&&listConfig&&presentation.paginationIssues?.length)throw Error('Calendar list page sizes conflict across source captures');
  const list=view==='list'&&listConfig&&presentation.listPagination?calendarListPage(manifest,next,presentation.listPagination.pageSize,requestedPage):null;
  const entries=list?list.entries:calendarView(manifest,{date:next,view}),shell=presentation.shells[view];if(!shell||(view!=='month'&&entries.some(e=>!presentation.entries[e.route]?.[view])))throw Error('This calendar view needs missing event templates');
  const month=view==='month'?renderCalendarMonth(manifest,presentation,next,{fragment,locale,today:calendarToday(clock)}):null;const replacement=month?month.grid:fragment(shell).firstElementChild;let lastGroup;
  for(const event of view==='month'?[]:entries){const group=view==='list'?event.start.slice(0,7):event.allDay?'all-day':event.start.slice(0,10)<next?'ongoing':event.start.slice(11,16);
   if(group!==lastGroup){const kind=view==='list'?'listGroup':event.allDay?'dayAllDayGroup':event.start.slice(0,10)<next?'dayOngoingGroup':'dayGroup',markup=presentation.shells[kind];if(markup){const heading=fragment(markup),time=heading.querySelector('time');if(time){time.textContent=presentation.formats?.[kind]?formatEventValue(event.start,presentation.formats[kind],locale):view==='list'?label(event.start,{month:'long',year:'numeric'}):label(event.start,{hour:'numeric',minute:'2-digit',hour12:/am|pm/i.test(time.textContent)});time.setAttribute('datetime',view==='list'?event.start.slice(0,7):event.start.slice(11,16));}replacement.append(heading);}lastGroup=group;}
   replacement.append(fragment(presentation.entries[event.route][view]));
  }
  if(list)renderListHeading(button,presentation.listPagination.heading,list,{fragment,locale,today:calendarToday(clock)});
  root.querySelector(selectors[view]).replaceWith(replacement);if(month)root.querySelector('.tribe-events-calendar-month-mobile-events')?.replaceWith(month.mobile);day=next;
  const time=root.querySelector('.tribe-events-c-top-bar__datepicker-time');if(time&&!list){time.setAttribute('datetime',day);for(const [index,span]of [...time.querySelectorAll('span')].entries())span.textContent=labelFormats[index]?.literal??(labelFormats[index]?formatEventValue(day,labelFormats[index],locale):label(day+' 00:00:00',view==='month'?{month:'long',year:'numeric'}:{month:'long',day:'numeric',year:'numeric'}));}
  if(list){renderListNavigation(root,list,day,page=>render(day,true,page));}
  if(input)input.value=pickerDate();updateLinks();status.classList.add('tribe-common-a11y-visual-hide');status.hidden=false;status.textContent=entries.length?`${entries.length} events`:'No events for this date.';
  if(push){const url=new URL(location.href);url.searchParams.set('calendar-date',day);if(list&&list.page>1)url.searchParams.set('calendar-page',String(list.page));else url.searchParams.delete('calendar-page');if(url.href!==location.href)history.pushState({},'',url);}
 }catch(error){if(ticket===version){status.classList.remove('tribe-common-a11y-visual-hide');status.hidden=false;status.textContent=error.message;}}finally{if(ticket===version)root.removeAttribute('aria-busy');}}
 if(button&&input&&!calendarPicker({root,button,input,view,locale,getDate:pickerDate,onSelect:render,data,fragment})){input.type='date';input.value=pickerDate();input.removeAttribute('tabindex');input.classList.remove('tribe-common-a11y-visual-hide');input.hidden=true;button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls',input.id);
  button.addEventListener('click',()=>{input.hidden=!input.hidden;button.setAttribute('aria-expanded',String(!input.hidden));if(!input.hidden)input.focus();});
  input.addEventListener('change',()=>{const next=input.value;input.hidden=true;button.setAttribute('aria-expanded','false');button.focus();render(next);});
  input.addEventListener('keydown',e=>{if(e.key==='Escape'){input.hidden=true;button.setAttribute('aria-expanded','false');button.focus();}});
 }
 // Day navigation is a date operation. List pagination remains native pagination.
 if(view==='day'||view==='month')for(const a of root.querySelectorAll('.tribe-events-c-top-bar__nav-link,.tribe-events-c-nav__next,.tribe-events-c-nav__prev')){
  const direction=a.matches('[class*="--next"],.tribe-events-c-nav__next')?1:-1;a.removeAttribute('aria-disabled');a.removeAttribute('data-migration-unavailable');a.href=location.pathname+'?calendar-date='+shiftCalendarDate(day,view,direction);
  navigation.push({a,direction});a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();render(shiftCalendarDate(day,view,direction));});
 }
 if(view==='month')root.addEventListener('click',async e=>{const button=e.target.closest('[data-js=tribe-events-calendar-month-day-cell-mobile]');if(!button||button.dataset.calendarDay)return;const selected=button.querySelector('time[datetime]')?.getAttribute('datetime');if(selected){await render(day,false);root.querySelector('[data-calendar-day="'+selected+'"]')?.click();}});
 for(const a of root.querySelectorAll('a.tribe-events-c-top-bar__today-button')){const url=new URL(location.href);url.searchParams.set('calendar-date','today');url.searchParams.delete('calendar-page');a.href=url.href;a.removeAttribute('aria-disabled');a.removeAttribute('data-migration-unavailable');if(a.title==='This destination was not included in this static export.')a.removeAttribute('title');a.addEventListener('click',e=>{if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;e.preventDefault();render(todayDate());});}
 updateLinks();
 const params=new URL(location.href).searchParams,initial=params.get('calendar-date'),requestedPage=()=>Number(new URL(location.href).searchParams.get('calendar-page')||'1');
 if(initial||params.has('calendar-page'))render(requestedDate(initial||listConfig?.date||initialDay),false,requestedPage());
 else if(view==='list'&&listConfig)render(requestedDate(listConfig.date||initialDay),false,listConfig.page||1);
 addEventListener('popstate',()=>{const selected=new URL(location.href).searchParams.get('calendar-date');if(selected)render(requestedDate(selected),false,requestedPage());else if(view==='list'&&listConfig)render(requestedDate(listConfig.date||initialDay),false,listConfig.page||1);else{version++;day=initialDay;root.querySelector(selectors[view]).replaceWith(initialContent.cloneNode(true));if(initialMobile)root.querySelector('.tribe-events-calendar-month-mobile-events')?.replaceWith(initialMobile.cloneNode(true));const current=root.querySelector('.tribe-events-c-top-bar__datepicker-time');if(current&&initialTime)current.replaceWith(initialTime.cloneNode(true));status.hidden=true;root.removeAttribute('aria-busy');if(input)input.value=pickerDate();updateLinks();}});
}
