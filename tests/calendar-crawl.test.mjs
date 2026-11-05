import test from 'node:test';import assert from 'node:assert/strict';
import {calendarDiscoveryLinks} from '../engine/calendar-crawl.mjs';
const base='https://example.test/agenda/2028-03-11/';
test('exclude only dated calendar navigation, preserving event and ordinary dated content',()=>{
 const r=calendarDiscoveryLinks(`<a data-js="tribe-events-view-link" class="tribe-events-c-nav__next" href="../2028-03-12/">Next day</a><a data-js="tribe-events-view-link" class="tribe-events-c-top-bar__nav-link" href="../2028-04/">Next month</a><a href="/event/design-lab/">Event</a><a href="/news/2028-03-12/">Article</a><a class="tribe-events-c-nav__next" data-js="tribe-events-view-link" href="/agenda/page/2/">More events</a>`,base);
 assert.equal(r.navigation.length,2);assert.deepEqual(r.content,['https://example.test/event/design-lab/','https://example.test/news/2028-03-12/','https://example.test/agenda/page/2/']);
});
test('ordinary references override calendar navigation classification',()=>{
 const r=calendarDiscoveryLinks('<a data-js="tribe-events-view-link" class="tribe-events-c-nav__prev" href="../2028-03-10/">Previous</a><a href="../2028-03-10/">Featured day</a>',base);
 assert.equal(r.navigation.length,0);assert.equal(r.content.length,1);
});
import {discover} from '../engine/extract.mjs';
test('discovery and legacy checkpoint resume terminate without discarding captures',async()=>{
 const origin='https://calendar.test',requests=[];
 const html='<html><main><a data-js="tribe-events-view-link" class="tribe-events-c-nav__next" href="/agenda/2028-03-12/">Next day</a><a href="/event/design/">Event</a></main></html>';
 const network={robots:new Map(),async get(url){requests.push(url);return {url,status:url===origin+'/'||url===origin+'/event/design/'?200:404,headers:{},body:Buffer.from(url===origin+'/'?html:'<html><main>Design event</main></html>')};}};
 const m=await discover(origin+'/',network);
 assert.equal(m.pages.length,2);assert.ok(!requests.includes(origin+'/agenda/2028-03-12/'));
 const captured=m.pages.map(p=>p.url);m.crawl.queue.push(origin+'/agenda/2028-03-12/');
 requests.length=0;const resumed=await discover(origin+'/',network,{state:m});
 assert.deepEqual(resumed.pages.map(p=>p.url),captured);assert.equal(resumed.crawl.queue.length,0);
 assert.ok(!requests.includes(origin+'/agenda/2028-03-12/'));assert.ok(resumed.crawl.calendarNavigationSkipped.includes(origin+'/agenda/2028-03-12/'));
});
