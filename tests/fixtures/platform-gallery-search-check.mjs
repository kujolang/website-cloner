import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';import {serveStatic} from '../../engine/static.mjs';import {visualScore,layoutScore} from '../../engine/verify.mjs';import {measure} from '../../engine/capture.mjs';
const route=process.argv.find(a=>a.startsWith('--route='))?.slice(8)||'/search-gallery/';
const root=path.resolve(process.argv[2]||'artifacts/platform/essential-search'),out=path.join(root,'search-evidence');await mkdir(out,{recursive:true});const server=await serveStatic(path.join(root,'project/output')),browser=await chromium.launch({channel:'chrome'}),results=[];
try {
 for(const [viewport,width,height] of [['desktop',1440,1000],['mobile',390,844]]){
  const shots={};
  for(const [side,origin] of [['source','http://127.0.0.1:9431'],['rebuilt',server.url]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'no-preference'});
   await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())&&(new URL(r.request().url()).origin===origin||(side==='source'&&['fonts.googleapis.com','fonts.gstatic.com'].includes(new URL(r.request().url()).hostname)))?r.continue():r.abort());
   assert.equal((await page.goto(origin+route,{waitUntil:'networkidle'})).status(),200);await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(600);
   const controls=page.locator('.eael-filter-gallery-wrapper [data-filter]'),items=page.locator('.eael-filterable-gallery-item-wrap');assert.equal(await items.count(),4);
   for(const [state,query,index,expected]of [['initial','',null,4],['title','Lamp',null,1],['category','Lighting',null,2],['combined-empty','Lighting',1,0],['category-reset','',null,2],['reset','',0,4]]){
    await page.locator('[name="fg-frontend-search"]').fill(query);await page.waitForTimeout(1100);
    if(index!==null){if(!await controls.nth(index).isVisible())await page.locator('[id="fg-filter-trigger"]').click();await controls.nth(index).click();await page.waitForFunction(expected=>[...document.querySelectorAll('.eael-filterable-gallery-item-wrap')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0).length===expected,expected,{timeout:10000});await page.waitForTimeout(100);}
    await page.waitForFunction(expected=>[...document.querySelectorAll('.eael-filterable-gallery-item-wrap')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0).length===expected,expected,{timeout:10000});await page.waitForTimeout(100);
    const visible=await items.evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0).length);assert.equal(visible,expected,side+' '+state);
    if(side==='rebuilt'){assert.equal(await items.evaluateAll(es=>es.filter(e=>e.inert).length),4-expected);assert.equal(await page.locator('[data-gallery-items]').count(),0);}
    await page.evaluate(()=>scrollTo(0,0));(shots[state]??=[]).push({image:await page.screenshot({path:path.join(out,`${side}-${viewport}-${state}.png`),fullPage:true,animations:'disabled'}),layout:await measure(page)});
   }
   await page.close();
  }
  for(const [state,[a,b]] of Object.entries(shots)){const result={viewport,state,pixel:visualScore(a.image,b.image),layout:layoutScore(a.layout,b.layout)};results.push(result);assert.ok(result.pixel>=0.99,JSON.stringify(result));assert.ok(result.layout>=0.99,JSON.stringify(result));}
 }
 await writeFile(path.join(root,'search-check.json'),JSON.stringify({plugin:'Essential Addons 6.8.7',route,results,scope:'Fully captured layout_3 gallery local literal search and category combination; not regex queries, hidden payload expansion, lightbox or motion parity.'},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
