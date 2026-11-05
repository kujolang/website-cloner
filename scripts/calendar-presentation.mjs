import {calendarPeriod,shiftCalendarDate} from './calendar-view.mjs';
import {eventFormat,formatEventValue} from './event-presentation.mjs';
// Preserve generated source-theme fragments for local calendar rendering.
// Called inside the existing build DOM pass; never fetches or executes source code.
export function collectCalendarPresentation($,feed,registry,context={}){
 const key=(feed.scope||'')+'|'+JSON.stringify(feed.manifest.events.map(e=>e.route).sort());
 let group=registry.get(key);if(!group){group={manifests:new Set(),events:new Map(feed.manifest.events.map(e=>[e.route,{}])),shells:{},formats:{},viewRoutes:{},pages:new Map(),manifestURLs:new Set(),issues:[]};registry.set(key,group);}
 group.manifests.add(feed.manifestRoute);
 collectListHeading($,group);
 rootListConfiguration($,group);
 const configured=$('[data-migration-calendar-week-start]').first().attr('data-migration-calendar-week-start');if(/^[0-6]$/.test(configured||''))group.weekStartsOn=Number(configured);
 if(context.file){group.pages.set(context.file,context.route);group.manifestURLs.add(context.manifestURL);}
 if(context.url)for(const [kind,selector]of Object.entries({list:'.tribe-events-calendar-list',day:'.tribe-events-calendar-day',month:'.tribe-events-calendar-month'})){if($(selector).length&&(!group.viewRoutes[kind]||context.url.length<group.viewRoutes[kind].length))group.viewRoutes[kind]=context.url;}
 const selectors={list:'.tribe-events-calendar-list__event-row',day:'.tribe-events-calendar-day__event',month:'.tribe-events-calendar-month__calendar-event',monthMultiday:'.tribe-events-calendar-month__multiday-event',monthMobile:'.tribe-events-calendar-month-mobile-events__mobile-event'};
 for(const [kind,selector]of Object.entries(selectors))$(selector).each((_,node)=>{
  const el=$(node),matches=new Set();el.find('a[href]').each((_,a)=>{const href=$(a).attr('href');if(group.events.has(href))matches.add(href);});
  if(matches.size!==1)return;const route=[...matches][0],html=$.html(node),existing=group.events.get(route)[kind];
  // Multi-day continuation stubs omit content; retain the richest captured variant.
  if(!existing||html.length>existing.length)group.events.get(route)[kind]=html;
 });
 for(const [kind,selector]of Object.entries({list:'.tribe-events-calendar-list',day:'.tribe-events-calendar-day',monthMobile:'.tribe-events-calendar-month-mobile-events',monthMobileDay:'.tribe-events-calendar-month-mobile-events__mobile-day'})){
  const el=$(selector).first();if(el.length&&!group.shells[kind]){const shell=el.clone().empty();group.shells[kind]=$.html(shell);}
 }
 for(const [kind,selector]of Object.entries({listGroup:'.tribe-events-calendar-list__month-separator',dayGroup:'.tribe-events-calendar-day__time-separator'})){
  const el=$(selector).first();if(el.length&&!group.shells[kind]){
   group.shells[kind]=$.html(el);let event;
   el.nextAll('.tribe-events-calendar-list__event-row,.tribe-events-calendar-day__event').first().find('a[href]').each((_,a)=>{event ||= feed.manifest.events.find(e=>e.route===$(a).attr('href'));});
   if(event?.start)group.formats[kind]=eventFormat(el.find('time').text(),event.start,$('html').attr('lang')||'en');
  }
 }
 $('.tribe-events-calendar-day__type-separator').each((_,node)=>{
  const heading=$(node),card=heading.nextAll('.tribe-events-calendar-day__event').first();let event;
  card.find('a[href]').each((_,a)=>{event ||= feed.manifest.events.find(e=>e.route===$(a).attr('href'));});
  if(event){const kind=event.allDay?'dayAllDayGroup':'dayOngoingGroup';group.shells[kind] ||= $.html(heading);}
 });
 const month=$('.tribe-events-calendar-month').first();
 if(month.length&&!group.shells.monthEventCell){const populated=month.find('.tribe-events-calendar-month__mobile-events-icon').first().closest('.tribe-events-calendar-month__day').clone();if(populated.length){populated.find('.tribe-events-calendar-month__events').empty();group.shells.monthEventCell=$.html(populated);}}
 if(month.length&&!group.shells.month){const shell=month.clone();shell.find('tbody').empty();group.shells.month=$.html(shell);const week=month.find('.tribe-events-calendar-month__week').first().clone().empty();group.shells.monthWeek=$.html(week);const cell=month.find('.tribe-events-calendar-month__day').first().clone();cell.find('.tribe-events-calendar-month__events').empty();group.shells.monthCell=$.html(cell);const first=month.find('time[datetime]').first().attr('datetime');if(group.weekStartsOn===undefined&&/^\d{4}-\d{2}-\d{2}$/.test(first||''))group.weekStartsOn=new Date(first+'T00:00:00Z').getUTCDay();}
}
function collectListHeading($,group){
 $('[data-migration-calendar-list]').each((_,el)=>{const root=$(el),times=root.find('.tribe-events-c-top-bar__datepicker-time'),first=times.first();if(!first.length)return;const locale=$('html').attr('lang')||'en',format=time=>time.find('span').toArray().map(span=>{const text=$(span).text().replace(/\s+/g,' ').trim(),compact=root.attr('data-migration-calendar-compact-format'),spec={date:compact,time:null,separator:''};if(compact&&$(span).hasClass('tribe-events-c-top-bar__datepicker-mobile')){try{if(formatEventValue(time.attr('datetime'),spec,locale)===text)return spec;}catch{}}return eventFormat(text,time.attr('datetime'),locale);});
  group.listHeading ||= {};const heading=group.listHeading;
  if(root.find('a.tribe-events-c-nav__next[href]').length&&!/\p{N}/u.test(first.text()))heading.nowTime ||= $.html(first);
  if(times.length===1&&root.find('.tribe-events-c-nav__next:disabled').length&&!/\p{N}/u.test(first.text()))heading.fallback ||= $.html(first);
  const formats=format(first);if(formats.length&&formats.every(Boolean)){heading.time ||= $.html(first);heading.formats ||= formats;}
  if(times.length===2){const formats=format(times.eq(1));if(formats.length&&formats.every(Boolean)){heading.endTime ||= $.html(times.eq(1));heading.endFormats ||= formats;heading.time ||= $.html(times.eq(1));heading.formats ||= formats;heading.separator ||= $.html(root.find('.tribe-events-c-top-bar__datepicker-separator').first());}}
 });
}
function rootListConfiguration($,group){
 $('[data-migration-calendar-list]').each((_,el)=>{let value;try{value=JSON.parse($(el).attr('data-migration-calendar-list'));}catch{return;}if(Number.isInteger(value.pageSize)&&value.pageSize>0&&value.pageSize<=1000){group.listPageSizes ||= new Set();group.listPageSizes.add(value.pageSize);}});
}
export function calendarPresentation(group){
 const entries=Object.fromEntries([...group.events].map(([route,templates])=>[route,templates]));
 const missing=[];for(const [route,templates]of group.events)for(const kind of ['list','day'])if(!templates[kind])missing.push({route,kind});
 const sizes=[...(group.listPageSizes||[])];
 return {schema:'website-cloner-calendar-presentation/v1',listPagination:sizes.length===1?{pageSize:sizes[0],evidence:'full-source-page-with-next-link',heading:group.listHeading}:null,paginationIssues:sizes.length>1?[{kind:'conflicting-source-page-sizes',sizes}]:[],shells:group.shells,formats:group.formats,viewRoutes:group.viewRoutes,weekStartsOn:group.weekStartsOn??null,entries,missing,controlsVerified:false};
}

const localCalendarRoute=route=>typeof route==='string'&&route.startsWith('/')&&!route.startsWith('//')&&!/[?#\\]/.test(route);
const enableCalendarLink=a=>{a.removeAttr('aria-disabled').removeAttr('data-migration-unavailable');if(a.attr('title')==='This destination was not included in this static export.')a.removeAttr('title');};
export function applyCalendarViewLinks($,viewRoutes,roots=$('[data-migration-calendar]')){
 roots.each((_,node)=>{const root=$(node);let day=root.find('.tribe-events-c-top-bar__datepicker-time').first().attr('datetime')||'';if(/^\d{4}-\d{2}$/.test(day))day+='-01';
  try{calendarPeriod(day);}catch{return;}
  const view=root.find('.tribe-events-calendar-day').length?'day':root.find('.tribe-events-calendar-month').length?'month':null;
  const activeView=view||(root.find('.tribe-events-calendar-list').length?'list':null);
  if(activeView&&localCalendarRoute(viewRoutes[activeView]))root.find('a.tribe-events-c-top-bar__today-button').each((_,link)=>{const a=$(link);a.attr('href',viewRoutes[activeView]+'?calendar-date=today');enableCalendarLink(a);});
  if(view&&localCalendarRoute(viewRoutes[view]))root.find('a.tribe-events-c-top-bar__nav-link,a.tribe-events-c-nav__next,a.tribe-events-c-nav__prev').each((_,link)=>{const a=$(link),direction=a.is('[class*="--next"],.tribe-events-c-nav__next')?1:-1;a.attr('href',viewRoutes[view]+'?calendar-date='+shiftCalendarDate(day,view,direction));enableCalendarLink(a);});
  for(const [kind,route]of Object.entries(viewRoutes)){
   if(!['list','day','month'].includes(kind)||!localCalendarRoute(route))continue;
   root.find('.tribe-events-c-view-selector__list-item--'+kind+' a').each((_,link)=>{const a=$(link);a.attr('href',route+(/^\d{4}-\d{2}-\d{2}$/.test(day)?'?calendar-date='+day:'')).attr('data-calendar-view',kind).attr('data-calendar-view-route',route);enableCalendarLink(a);});
  }
 });
}

export function applyCalendarArchivePage($,page){
 if(!page.generatedSourceArchive||!Number.isInteger(page.archivePage)||page.archivePage<1)return;
 $('[data-migration-calendar-list]').each((_,el)=>{const root=$(el);let config;try{config=JSON.parse(root.attr('data-migration-calendar-list'));}catch{return;}if(!config||typeof config!=='object'||Array.isArray(config))return;root.attr('data-migration-calendar-list',JSON.stringify({...config,page:page.archivePage}));});
}
