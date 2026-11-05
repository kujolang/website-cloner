import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';import {collectCalendarPresentation,calendarPresentation,applyCalendarViewLinks} from '../scripts/calendar-presentation.mjs';
const feed={manifestRoute:'/assets/calendar.json',manifest:{events:[{route:'/event/a/'},{route:'/event/b/'}]}};
test('collect source-specific cards across archive pages without conflating event links',()=>{
 const groups=new Map();collectCalendarPresentation(load('<ul class="tribe-events-calendar-list theme"><li class="tribe-events-calendar-list__event-row"><a href="/event/a/">A</a><p>Authored text</p></li></ul>'),feed,groups);
 collectCalendarPresentation(load('<div class="tribe-events-calendar-day"><article class="tribe-events-calendar-day__event"><a href="/event/a/">A</a></article></div>'),feed,groups);
 const group=[...groups.values()][0],p=calendarPresentation(group);assert.match(p.shells.list,/theme/);assert.doesNotMatch(p.shells.list,/Authored/);assert.match(p.entries['/event/a/'].list,/Authored text/);assert.equal(p.missing.length,2);assert.equal(p.controlsVerified,false);
 collectCalendarPresentation(load('<li class="tribe-events-calendar-list__event-row"><a href="/event/a/">A</a><a href="/event/b/">B</a></li>'),feed,groups);assert.deepEqual(calendarPresentation(group),p);
});
test('calendar scopes remain separate and missing fragments remain explicit',()=>{
 const groups=new Map();collectCalendarPresentation(load('<main/>'),feed,groups);collectCalendarPresentation(load('<main/>'),{manifestRoute:'/other.json',manifest:{events:[{route:'/event/b/'}]}},groups);assert.equal(groups.size,2);assert.equal(calendarPresentation([...groups.values()][1]).missing.length,2);
});
import {formatEventValue} from '../scripts/event-presentation.mjs';
test('calendar group formats come from source headings rather than locale defaults',()=>{
 const groups=new Map(),scoped={...feed,manifest:{events:[{route:'/event/a/',start:'2028-03-11 10:00:00'}]}};
 const $=load('<html lang="en-US"><ul class="tribe-events-calendar-list"><li class="tribe-events-calendar-list__month-separator"><time>Mar 2028</time></li><li class="tribe-events-calendar-list__event-row"><a href="/event/a/">A</a></li></ul><div class="tribe-events-calendar-day"><div class="tribe-events-calendar-day__time-separator"><time>10:00 am</time></div><article class="tribe-events-calendar-day__event"><a href="/event/a/">A</a></article></div></html>');
 collectCalendarPresentation($,scoped,groups);const p=calendarPresentation([...groups.values()][0]);assert.equal(formatEventValue('2028-07-12 13:15:00',p.formats.dayGroup),'1:15 pm');assert.equal(formatEventValue('2028-07-12 13:15:00',p.formats.listGroup),'Jul 2028');
});

test('view routes preserve export prefixes and isolate equally populated taxonomy scopes',()=>{
 const groups=new Map();
 for(const [scope,kind,route]of [['all','month','/clone/events/month/2028-03/'],['all','month','/clone/events/month/'],['all','day','/clone/events/day/'],['category:work','list','/clone/work/list/']])collectCalendarPresentation(load(`<div class="tribe-events-calendar-${kind}"></div>`),{...feed,scope},groups,{url:route});
 assert.equal(groups.size,2);const [all,work]=[...groups.values()];assert.deepEqual(all.viewRoutes,{month:'/clone/events/month/',day:'/clone/events/day/'});assert.deepEqual(work.viewRoutes,{list:'/clone/work/list/'});
 const $=load(`<div data-migration-calendar="/clone/calendar.json"><time class="tribe-events-c-top-bar__datepicker-time" datetime="2028-03"></time><div class="tribe-events-c-view-selector__list-item--day"><a aria-disabled="true" data-migration-unavailable="/events/2028-03-01/" title="This destination was not included in this static export.">Day</a></div><div class="tribe-events-c-view-selector__list-item--month"><a href="https://source.example/events/month/">Month</a></div><div class="tribe-events-c-view-selector__list-item--list"><a aria-disabled="true">Uncaptured list</a></div></div>`);
 applyCalendarViewLinks($,all.viewRoutes);const a=$('a').first();assert.equal(a.attr('href'),'/clone/events/day/?calendar-date=2028-03-01');assert.equal(a.attr('data-calendar-view-route'),'/clone/events/day/');for(const attr of ['aria-disabled','data-migration-unavailable','title'])assert.equal(a.attr(attr),undefined);assert.equal($('a').last().attr('aria-disabled'),'true');
 applyCalendarViewLinks($,{day:'//other.example/day/'});assert.equal(a.attr('href'),'/clone/events/day/?calendar-date=2028-03-01');
});

test('static date navigation targets captured views without hiding unrelated missing links',()=>{
 const make=(view,date)=>load(`<div data-migration-calendar="/calendar.json"><time class="tribe-events-c-top-bar__datepicker-time" datetime="${date}"></time><div class="tribe-events-calendar-${view}"></div><a class="tribe-events-c-top-bar__nav-link tribe-events-c-top-bar__nav-link--prev" aria-disabled="true" data-migration-unavailable="/old/">Previous</a><a class="tribe-events-c-nav__next" aria-disabled="true" data-migration-unavailable="/next/">Next</a><a data-migration-unavailable="/missing-event/">Missing event</a></div>`);
 const $=make('day','2028-03-01');applyCalendarViewLinks($,{day:'/clone/events/today/'});assert.equal($('a').eq(0).attr('href'),'/clone/events/today/?calendar-date=2028-02-29');assert.equal($('a').eq(1).attr('href'),'/clone/events/today/?calendar-date=2028-03-02');assert.equal($('[data-migration-unavailable]').length,1);assert.equal($('a').last().attr('data-migration-unavailable'),'/missing-event/');
 const month=make('month','2028-12');applyCalendarViewLinks(month,{month:'/clone/events/month/'});assert.equal(month('a').eq(1).attr('href'),'/clone/events/month/?calendar-date=2029-01-01');
 for(const [view,date,routes]of [['list','2028-03-01',{list:'/events/'}],['day','2028-02-30',{day:'/events/'}],['day','2028-03-01',{}]]){const bad=make(view,date);applyCalendarViewLinks(bad,routes);assert.equal(bad('[data-migration-unavailable]').length,3);assert.equal(bad('a[href]').length,0);}
});

test('Today links target the same captured view with a dynamic date, including list scopes',()=>{
 for(const view of ['day','month','list']){const $=load(`<div data-migration-calendar="/calendar.json"><time class="tribe-events-c-top-bar__datepicker-time" datetime="2028-03-01"></time><div class="tribe-events-calendar-${view}"></div><a class="tribe-events-c-top-bar__today-button" aria-disabled="true" data-migration-unavailable="/old/">Today</a></div>`);applyCalendarViewLinks($,{[view]:'/prefix/scoped/'+view+'/'});assert.equal($('a').attr('href'),'/prefix/scoped/'+view+'/?calendar-date=today');assert.equal($('a').attr('aria-disabled'),undefined);}
});

test('generated native pages retain their own calendar page index without changing captured pages',async()=>{
 const {applyCalendarArchivePage}=await import('../scripts/calendar-presentation.mjs'),$=load('<div data-migration-calendar-list=\'{"page":1,"date":"2028-01-01","pageSize":2}\'></div>');applyCalendarArchivePage($,{archivePage:3});assert.equal(JSON.parse($('div').attr('data-migration-calendar-list')).page,1);applyCalendarArchivePage($,{generatedSourceArchive:true,archivePage:3});assert.deepEqual(JSON.parse($('div').attr('data-migration-calendar-list')),{page:3,date:'2028-01-01',pageSize:2});applyCalendarArchivePage($,{generatedSourceArchive:true,archivePage:-1});assert.equal(JSON.parse($('div').attr('data-migration-calendar-list')).page,3);
});
