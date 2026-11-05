// Installed Essential Addons tab behavior, icons and layout; no source mutations.
import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';import {serveStatic} from '../../engine/static.mjs';import {visualScore,layoutScore} from '../../engine/verify.mjs';import {measure} from '../../engine/capture.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/essential-addons'),out=path.join(root,'addons-evidence');await mkdir(out,{recursive:true});const server=await serveStatic(path.join(root,'project/output'));const browser=await chromium.launch({channel:'chrome'}),results=[];
try {
 for(const [viewport,width,height] of [['desktop',1440,1000],['mobile',390,844]])for(const route of ['horizontal-tabs','vertical-tabs','collapsed-tabs']) {
  const shots={};
  for(const [side,origin] of [['source','http://127.0.0.1:9431'],['rebuilt',server.url]]) {
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});let mutations=0;const missing=[],blocked=[],failed=[];
   page.on('requestfailed',r=>failed.push(r.url()));
   page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
   await page.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){mutations++;return r.abort();}if(new URL(r.request().url()).origin!==origin){if(side==='source'&&['fonts.googleapis.com','fonts.gstatic.com'].includes(new URL(r.request().url()).hostname))return r.continue();blocked.push(r.request().url());return r.abort();}return r.continue();});
   assert.equal((await page.goto(origin+'/'+route+'/',{waitUntil:'networkidle'})).status(),200);await page.evaluate(()=>document.fonts.ready);
   const controls=page.locator('.eael-tab-item-trigger'),panels=page.locator('.eael-tab-content-item');assert.equal(await controls.count(),3);assert.equal(await controls.locator('i,svg').count(),3);
   for(const state of ['initial','second','repeat']) {
    if(state!=='initial'){await controls.nth(1).click();await page.waitForTimeout(350);}
    const visible=await panels.evaluateAll(es=>es.map(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0));
    const expected=state==='initial'?(route==='collapsed-tabs'?[false,false,false]:[true,false,false]):state==='repeat'&&route==='collapsed-tabs'?[false,false,false]:[false,true,false];
    assert.deepEqual(visible,expected,side+' '+route+' '+state);
    await page.evaluate(()=>scrollTo(0,0));(shots[state]??=[]).push({visible,image:await page.screenshot({path:path.join(out,`${side}-${viewport}-${route}-${state}.png`),fullPage:true,animations:'disabled'}),layout:await measure(page)});
   }
   assert.equal(mutations,0);assert.deepEqual(missing,[]);assert.deepEqual(blocked,[],side+' unexpected external dependencies');assert.deepEqual(failed,[],side+' dependencies must load');await page.close();
  }
  for(const [state,[a,b]] of Object.entries(shots)){const result={viewport,route,state,pixel:visualScore(a.image,b.image),layout:layoutScore(a.layout,b.layout)};results.push(result);assert.ok(result.pixel>=0.99,JSON.stringify(result));}
 }
 await writeFile(path.join(root,'addons-check.json'),JSON.stringify({plugin:'Essential Addons 6.8.7 / Elementor 4.3.5',mutations:0,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
