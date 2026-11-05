import test from 'node:test';import assert from 'node:assert/strict';import{load}from'cheerio';import{applyComponents}from'../scripts/component-export.mjs';
test('local calendar runtime is selective and included in export CSP',()=>{
 for(const cls of ['tribe-events-calendar-list','tribe-events-calendar-day','tribe-events-calendar-month']){const $=load(`<head><meta http-equiv="Content-Security-Policy" content="script-src 'none'"></head><div data-migration-calendar="/assets/events.json"><div class="${cls}"></div></div>`);const selected=applyComponents($);assert.equal(selected.filter(r=>r.id==='calendar').length,1);assert.ok($('meta').attr('content').includes(selected.find(r=>r.id==='calendar').hash));assert.equal($('script[data-cloner-component=calendar]').length,1);}
 for(const html of ['<p>Ordinary page</p>'])assert.ok(!applyComponents(load(html)).some(r=>r.id==='calendar'));
});
import {chromium} from 'playwright';
test('calendar fetch retries and missing templates leave the current view intact',async()=>{
 const $=load(`<div data-migration-calendar="/site/calendar.json"><time class="tribe-events-c-top-bar__datepicker-time" datetime="2028-03-11"><span>March 11</span></time><a class="tribe-events-c-top-bar__nav-link--next tribe-events-c-top-bar__nav-link" href="#">Next</a><div class="tribe-events-calendar-day"><article>Original view</article></div><a data-calendar-view-route="/site/month/">Month</a></div>`);applyComponents($);
 let mode='offline',requests=0;const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage();await page.route('https://calendar.example/**',r=>{
  const p=new URL(r.request().url()).pathname;if(p==='/site/')return r.fulfill({contentType:'text/html',body:$.html()});requests++;
  if(mode==='offline')return r.fulfill({status:503,body:'unavailable'});
  if(p.endsWith('.presentation.json'))return r.fulfill({json:{schema:'website-cloner-calendar-presentation/v1',shells:{day:'<div class="tribe-events-calendar-day"></div>'},entries:mode==='missing'?{}:{'/site/event/':{day:'<article><a href="/site/event/">Local event</a><script>window.unwanted=true</script><span onclick="window.unwanted=true">Text</span></article>'}}}});
  return r.fulfill({json:{schema:'website-cloner-calendar/v1',events:[{route:'/site/event/',title:'Local event',start:'2028-03-12 10:00:00',end:'2028-03-12 11:00:00',allDay:false}]}});
 });await page.goto('https://calendar.example/site/');assert.equal(requests,0);assert.equal(await page.locator('[data-calendar-view-route]').getAttribute('href'),'https://calendar.example/site/month/?calendar-date=2028-03-11');const next=page.locator('a').first();await next.click();await page.getByRole('status').filter({hasText:'Calendar data unavailable'}).waitFor();assert.match(await page.locator('.tribe-events-calendar-day').textContent(),/Original/);assert.equal(new URL(page.url()).search,'');
 assert.doesNotMatch(await page.getByRole('status').getAttribute('class')||'',/tribe-common-a11y-visual-hide/);
 mode='missing';await next.click();await page.getByRole('status').filter({hasText:'missing event templates'}).waitFor();assert.match(await page.locator('.tribe-events-calendar-day').textContent(),/Original/);
 // A reload models an owner repairing the exported data; successful fetches stay cached.
 mode='ready';await page.reload();await page.locator('a').first().click();await page.waitForURL('**calendar-date=2028-03-12');assert.match(await page.locator('.tribe-events-calendar-day').textContent(),/Local event/);assert.match(await page.getByRole('status').getAttribute('class'),/tribe-common-a11y-visual-hide/);assert.equal(await page.locator('.tribe-events-calendar-day [onclick]').count(),0);assert.equal(await page.evaluate(()=>!!window.unwanted),false);assert.equal(await page.locator('[data-calendar-view-route]').getAttribute('href'),'https://calendar.example/site/month/?calendar-date=2028-03-12');
 }finally{await browser.close();}
});
