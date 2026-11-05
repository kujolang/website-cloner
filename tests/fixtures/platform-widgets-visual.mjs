// Compare installed widgets in initial and active states, not only page load.
import{chromium}from'playwright';import{mkdir,writeFile,readFile}from'node:fs/promises';import path from'node:path';import assert from'node:assert/strict';
import{serveStatic}from'../../engine/static.mjs';import{visualScore,layoutScore}from'../../engine/verify.mjs';import{measure,revealLazyContent}from'../../engine/capture.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/elementor'),out=path.join(root,'widget-evidence');await mkdir(out,{recursive:true});const source=new URL(JSON.parse(await readFile(path.join(root,'captured-model.json'),'utf8')).source).origin;
const server=await serveStatic(path.join(root,'project/output')),browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 for(const route of(process.argv.slice(3).length?process.argv.slice(3):['/components/','/vertical-components/']))for(const[name,width,height]of[['desktop',1440,1000],['mobile',390,844]]){
  const captures={initial:[],active:[]};
  for(const[side,origin]of[['source',source],['rebuilt',server.url]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());const response=await page.goto(origin+route,{waitUntil:'networkidle'});assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);await revealLazyContent(page);
   for(const state of['initial','active']){
    if(state==='active'){
     if(route.startsWith('/product/')){
      const field=page.locator('select[name="attribute_size"]');await field.selectOption('Small');await page.waitForTimeout(400);assert.match(await page.locator('.single_variation').innerText(),/29[.,]00/);await page.waitForFunction(()=>!window.jQuery||!window.jQuery('.single_variation').is(':animated'));await page.evaluate(()=>scrollTo(0,0));
     }else if(route.startsWith('/nested-')){
      const tabs=page.locator('.e-n-tabs');await tabs.locator('.e-n-tab-title').nth(1).click();
      const accordion=page.locator('.e-n-accordion');await accordion.locator(':scope > details > summary').nth(1).click();await page.waitForTimeout(500);
      assert.equal(await tabs.locator('[role=tabpanel]').nth(1).isVisible(),true);
      assert.equal(await accordion.locator(':scope > details').nth(1).evaluate(e=>e.open),true);
      assert.equal(await accordion.locator(':scope > details').first().evaluate(e=>e.open),route==='/nested-multiple/');
      await page.evaluate(()=>scrollTo(0,0));
     }else{
     const tabs=page.locator('[data-widget_type="tabs.default"]');await tabs.locator(width===390?'.elementor-tab-mobile-title':'.elementor-tab-desktop-title').nth(1).click();
     await page.locator('[data-widget_type="accordion.default"] .elementor-tab-title').nth(1).click();
     const toggle=page.locator('[data-widget_type="toggle.default"] .elementor-tab-title');await toggle.nth(0).click();await toggle.nth(1).click();await page.waitForTimeout(450);await page.evaluate(()=>scrollTo(0,0));
     assert.equal(await tabs.locator('.elementor-tab-content').nth(1).isVisible(),true);assert.equal(await page.locator('[data-widget_type="accordion.default"] .elementor-tab-content').nth(1).isVisible(),true);
     }
    }
    const file=path.join(out,route.split('/')[1]+'-'+side+'-'+name+'-'+state+'.png');captures[state].push({image:await page.screenshot({path:file,fullPage:true,animations:'disabled'}),layout:await measure(page)});
   }
   await page.close();
  }
  for(const[state,[a,b]]of Object.entries(captures)){let pixelSimilarity=null,error=null;try{pixelSimilarity=visualScore(a.image,b.image);}catch(e){error=e.message;}results.push({route,viewport:name,state,pixelSimilarity,layoutSimilarity:layoutScore(a.layout,b.layout),error});}
 }
 await writeFile(path.join(root,'widget-visual.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
