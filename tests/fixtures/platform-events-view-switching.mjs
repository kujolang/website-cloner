import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,access} from 'node:fs/promises';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {serveStatic} from '../../engine/static.mjs';
const artifact=path.resolve('artifacts/platform/events-heldout'),cases=[];
let server,browser;const staticNavigation=[];
for(const r of JSON.parse(await readFile(path.join(artifact,'project/routes.json')))){
 const $=load(await readFile(path.join(artifact,'project/output',r.route,'index.html'),'utf8'));
 for(const node of $('[data-migration-calendar]').toArray()){const root=$(node);if(!root.find('.tribe-events-calendar-day,.tribe-events-calendar-month').length)continue;for(const a of root.find('a.tribe-events-c-top-bar__nav-link,a.tribe-events-c-nav__next,a.tribe-events-c-nav__prev').toArray()){const link=$(a),href=link.attr('href');assert.ok(href,'Date navigation must have a static href');const target=new URL(href,'https://local.example');assert.equal(target.origin,'https://local.example');assert.match(target.searchParams.get('calendar-date'),/^\d{4}-\d{2}-\d{2}$/);assert.equal(link.attr('data-migration-unavailable'),undefined);await access(path.join(artifact,'project/output',target.pathname,'index.html'));staticNavigation.push({source:r.route,target:target.pathname,date:target.searchParams.get('calendar-date')});}}
}
assert.ok(staticNavigation.length>0);
try {
 server=await serveStatic(path.join(artifact,'project/output'));
 browser=await chromium.launch({channel:'chrome'});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  const missingBefore=staticNavigation.find(x=>x.source==='/events/2028-03-19/'&&x.date==='2028-03-20');assert.ok(missingBefore);
  const deepResponse=await page.goto(server.url+missingBefore.target+'?calendar-date='+missingBefore.date,{waitUntil:'networkidle'});assert.equal(deepResponse.status(),200);await page.waitForFunction(()=>document.querySelector('.tribe-events-c-top-bar__datepicker-time')?.getAttribute('datetime')==='2028-03-20');assert.equal(await page.locator('.tribe-events-calendar-day__event').count(),0);
  const response=await page.goto(server.url+'/events/month/2028-03/?calendar-date=2028-03-11',{waitUntil:'networkidle'});
  assert.equal(response.status(),200);
  for(const kind of ['day','list','month']){
   const root=page.locator('.tribe-events-c-view-selector').first(),button=root.locator('.tribe-events-c-view-selector__button');
   if(await button.isVisible())await button.click();
   const link=root.locator(`[data-calendar-view="${kind}"]`),href=await link.getAttribute('href');
   const target=new URL(href,server.url);assert.equal(target.origin,server.url);assert.equal(target.searchParams.get('calendar-date'),'2028-03-11');
   await link.click();await page.waitForURL(target.href);await page.waitForFunction(()=>!document.querySelector('[data-migration-calendar]')?.hasAttribute('aria-busy'));
   assert.ok(await page.locator('.tribe-events-calendar-'+kind).isVisible());
   assert.equal(await page.locator('[data-calendar-view][data-migration-unavailable]').count(),0);
  }
  cases.push({width,selectedDate:'2028-03-11',sequence:['month','day','list','month'],localNavigation:true});await page.close();
 }
 await writeFile(path.join(artifact,'view-switching-generated-check.json'),JSON.stringify({scope:'Actual generated installed-fixture view links and responsive selector; not full plugin acceptance',cases,staticNavigation:{controls:staticNavigation.length,targetsExist:true,serializedHrefs:true}},null,2));console.log(JSON.stringify({cases,staticNavigationControls:staticNavigation.length}));
}finally{await browser?.close();await server?.close();}
