// Compare genuine installed Spectra FAQ states with the static export.
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {serveStatic} from '../../engine/static.mjs';
import {visualScore,layoutScore} from '../../engine/verify.mjs';
import {measure} from '../../engine/capture.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/spectra');
const out=path.join(root,'spectra-evidence');await mkdir(out,{recursive:true});
const server=await serveStatic(path.join(root,'project/output'));
const browser=await chromium.launch({channel:'chrome'}),results=[];
try {
 for(const [viewport,width,height] of [['desktop',1440,1000],['mobile',390,844]]) {
  for(const route of ['faq-exclusive','faq-multiple','faq-grid']) {
   const shots={};
   for(const [side,origin] of [['source','http://127.0.0.1:9430'],['rebuilt',server.url]]) {
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
    let mutations=0;const missing=[];
    page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
    await page.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){mutations++;return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});
    assert.equal((await page.goto(origin+'/'+route+'/',{waitUntil:'networkidle'})).status(),200);
    await page.evaluate(()=>document.fonts.ready);
    const controls=page.locator('.uagb-faq-questions-button');
    for(const state of route==='faq-grid'?['initial']:['initial','second','first']) {
     if(state!=='initial'){await controls.nth(state==='second'?1:0).click();await page.waitForTimeout(600);}
     const visible=await page.locator('.uagb-faq-content').evaluateAll(es=>es.map(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0));
     if(side==='rebuilt'&&route!=='faq-grid') {
      assert.deepEqual(await controls.evaluateAll(es=>es.map(e=>e.getAttribute('aria-expanded')==='true')),visible);
     }
     await page.evaluate(()=>scrollTo(0,0));
     (shots[state]??=[]).push({visible,image:await page.screenshot({path:path.join(out,`${side}-${viewport}-${route}-${state}.png`),fullPage:true,animations:'disabled'}),layout:await measure(page)});
    }
    assert.equal(mutations,0);assert.deepEqual(missing,[]);await page.close();
   }
   for(const [state,[a,b]] of Object.entries(shots)) {
    assert.deepEqual(b.visible,a.visible,`${route} ${state} visibility`);
    const result={viewport,route,state,visible:a.visible,pixel:visualScore(a.image,b.image),layout:layoutScore(a.layout,b.layout)};
    results.push(result);assert.ok(result.pixel>=0.99,JSON.stringify(result));
   }
  }
 }
 await writeFile(path.join(root,'spectra-check.json'),JSON.stringify({plugin:'Spectra Legacy 2.20.5',sourceMutations:0,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
