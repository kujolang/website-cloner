import test from'node:test';import assert from'node:assert/strict';import{load}from'cheerio';import{calendarListConfig}from'../scripts/calendar-list-config.mjs';import{extract}from'../engine/extract.mjs';import{collectCalendarPresentation,calendarPresentation}from'../scripts/calendar-presentation.mjs';
const source={slug:'list',url:'https://events.example/events/list/?tribe-bar-date=2028-01-01',next_url:'https://events.example/events/list/page/2/?tribe-bar-date=2028-01-01',events:[1,2],past:false};
test('infer page size only from matching full upcoming pages with next-page evidence',()=>{
 assert.equal(calendarListConfig({...source,url_event_date:'2028-07-01'},2).date,'2028-07-01');assert.equal(calendarListConfig({...source,url_event_date:'2028-02-30'},2).date,'today');
 assert.deepEqual(calendarListConfig(source,2),{page:1,date:'today',pageSize:2});
 assert.deepEqual(calendarListConfig({...source,url:source.next_url,next_url:'',events:[3]},1),{page:2,date:'today'});
 for(const override of [{next_url:'https://other.test/events/page/2/'},{next_url:'https://events.example/events/page/3/'},{events:[1,1]},{events:['1','2']},{events:[1]},{next_url:''}])assert.deepEqual(calendarListConfig({...source,...override},2),{page:1,date:'today'});
 for(const override of [{slug:'month'},{past:true},{is_past:true},{url:'invalid'},{url:'https://events.example/events/?tribe_paged=0'}])assert.equal(calendarListConfig({...source,...override},2),null);
 assert.deepEqual(calendarListConfig({...source,url:'https://events.example/events/?tribe_paged=2',next_url:'https://events.example/events/?tribe_paged=3'},2),{page:2,date:'today',pageSize:2});
});
test('extraction keeps bounded pagination evidence and shared presentations reject conflicting sizes',()=>{
 const capture=(config,count)=>{const p=extract(`<div data-js="tribe-events-view"><script data-js="tribe-events-view-data">${JSON.stringify({...config,rest_nonce:'private-token'})}</script><div class="tribe-events-calendar-list">${Array.from({length:count},(_,i)=>`<article class="tribe-events-calendar-list__event-row"><a href="/event/${i}/">Event</a></article>`).join('')}</div></div>`,'https://events.example/events/');return load(p.shell.replace('MIGRATION_CONTENT_SLOT_7c3e',p.content));};
 const $=capture(source,2);assert.deepEqual(JSON.parse($('[data-migration-calendar-list]').attr('data-migration-calendar-list')),{page:1,date:'today',pageSize:2});assert.doesNotMatch($.html(),/private-token/);
 const groups=new Map(),feed={manifestRoute:'/calendar.json',manifest:{events:[]}};collectCalendarPresentation($,feed,groups);let p=calendarPresentation([...groups.values()][0]);assert.equal(p.listPagination.pageSize,2);
 collectCalendarPresentation(capture({...source,url:source.next_url,next_url:'',events:[3]},1),feed,groups);assert.equal(calendarPresentation([...groups.values()][0]).listPagination.pageSize,2);
 collectCalendarPresentation(capture({...source,events:[1,2,3]},3),feed,groups);p=calendarPresentation([...groups.values()][0]);assert.equal(p.listPagination,null);assert.equal(p.paginationIssues[0].kind,'conflicting-source-page-sizes');
});
