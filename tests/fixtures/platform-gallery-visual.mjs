// Actual installed WooCommerce/source-versus-export gallery states, with local GETs only.
import assert from 'node:assert/strict';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {serveStatic} from '../../engine/static.mjs';
import {visualScore,layoutScore} from '../../engine/verify.mjs';
import {measure,revealLazyContent} from '../../engine/capture.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/woocommerce-gallery'),out=path.join(root,'gallery-evidence');await mkdir(out,{recursive:true});
const source=new URL(JSON.parse(await readFile(path.join(root,'captured-model.json'),'utf8')).source).origin;
const server=await serveStatic(path.join(root,'project/output')),browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 for(const[name,width,height]of[['desktop',1440,1000],['mobile',390,844]]){
  const captures={initial:[],thumbnail:[],variation:[],fullscreen:[]};
  for(const[side,origin]of[['source',source],['rebuilt',server.url]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});page.setDefaultTimeout(15000);let posts=0;await page.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){posts++;return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});assert.equal((await page.goto(origin+'/product/workshop-shirt/',{waitUntil:'networkidle'})).status(),200);await page.evaluate(()=>document.fonts.ready);await revealLazyContent(page);await page.evaluate(()=>scrollTo(0,0));
   const gallery=page.locator('.woocommerce-product-gallery'),thumbs=gallery.locator('.flex-control-thumbs img');assert.equal(await thumbs.count(),2);
   for(const state of Object.keys(captures)){
    if(state==='thumbnail')await thumbs.nth(1).click();
    if(state==='variation'){await thumbs.first().click();await page.locator('select[name=attribute_size]').selectOption('Large');await page.waitForFunction(()=>/34[.,]00/.test(document.querySelector('.single_variation').textContent));}
    if(state==='fullscreen'){const trigger=gallery.locator('.woocommerce-product-gallery__trigger');if(await trigger.count())await trigger.click();else await gallery.locator('.flex-active-slide a').click();await page.waitForFunction(()=>document.querySelector('.pswp')?.classList.contains('pswp--open'));}
    await page.waitForFunction(()=>!window.jQuery||!window.jQuery('.single_variation').is(':animated'));await page.waitForTimeout(500);await page.mouse.move(0,0);if(state!=='fullscreen')await page.evaluate(()=>scrollTo(0,0));
    captures[state].push({image:await page.screenshot({path:path.join(out,side+'-'+name+'-'+state+'.png'),fullPage:state!=='fullscreen',animations:'disabled'}),layout:await measure(page)});
   }
   await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.querySelector('.pswp')?.classList.contains('pswp--open'));assert.equal(posts,0);await page.close();
  }
  for(const[state,[a,b]]of Object.entries(captures)){let pixelSimilarity=null,error=null;try{pixelSimilarity=visualScore(a.image,b.image);}catch(e){error=e.message;}results.push({viewport:name,state,pixelSimilarity,layoutSimilarity:layoutScore(a.layout,b.layout),error});}
 }
 await writeFile(path.join(root,'gallery-visual.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
