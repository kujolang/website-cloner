import assert from 'node:assert/strict';import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {chromium} from 'playwright';
import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';import {verificationScreenshot} from '../../engine/verify-screenshot.mjs';import {visualScore} from '../../engine/verify.mjs';import {verifyNavigation} from '../../engine/verify-navigation.mjs';
const artifact=path.resolve(process.argv[2]||'artifacts/platform/ultimate-expanded-installed'),temp=await mkdtemp(path.join(tmpdir(),'ultimate-breakpoints-')),records=JSON.parse(await readFile('work/uae/ultimate-menu-variant-records.json'));let browser,server;const results=[];
try{
 await cp(path.join(artifact,'project'),temp,{recursive:true});for(const name of ['component-addon-navigation.js','component-export.mjs','component-markup.mjs','semantic-export.mjs'])await cp('scripts/'+name,path.join(temp,'scripts',name));await cp('scripts/build-export.mjs',path.join(temp,'scripts/build.mjs'));await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 for(const variant of (process.argv[3]?[process.argv[3]]:['contained','fullwidth']))for(const width of (process.argv[3]?[390,767,768,1024,1025,1440]:[767,768,1024,1025])){
  const record=records.find(r=>r.variant===variant),pages=[],evidence=[],threshold=record.settings.dropdown==='none'?null:record.settings.dropdown==='mobile'?767:1024;const responsive=w=>threshold!==null&&w<=threshold;
  for(const kind of ['source','export']){
   const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(12000);pages.push({page,context});await page.goto(kind==='source'?record.url:server.url+new URL(record.url).pathname,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
   const widget=page.locator('.elementor-widget-navigation-menu'),nav=widget.locator('nav'),toggle=widget.locator('.hfe-nav-menu__toggle');const collapsed=await toggle.isVisible();assert.equal(collapsed,responsive(width),'Installed configured breakpoint');const files={};
   for(const state of ['closed','open']){
    if(state==='open'){
     if(collapsed)await toggle.click();const parents=widget.locator(kind==='source'?'.hfe-has-submenu-container':'.hfe-has-submenu-container > a');for(const parent of await parents.all())if(collapsed||width<=1024)await parent.locator('.hfe-menu-toggle').click();else await parent.hover();
     await page.waitForTimeout(350);
    }
    files[state]=path.join(artifact,`breakpoint-${variant}-${width}-${kind}-${state}.png`);await verificationScreenshot(page,files[state]);
   }
   const geometry=await nav.evaluate(el=>{const r=el.getBoundingClientRect();return {x:r.x,width:r.width,height:r.height}});evidence.push({files,geometry,collapsed});
  }
  const pixels={};for(const state of ['closed','open']){pixels[state]=visualScore(await readFile(evidence[0].files[state]),await readFile(evidence[1].files[state]));assert.ok(pixels[state]>=.99,variant+' '+width+' '+state+' visual mismatch '+pixels[state]);}
  for(const key of ['x','width','height'])assert.ok(Math.abs(evidence[0].geometry[key]-evidence[1].geometry[key])<=1,variant+' '+width+' '+key+' geometry mismatch');
  const page=pages[1].page,nav=page.locator('.elementor-widget-navigation-menu nav');
  const transitions=[];
  for(const next of [threshold===null?(width<1000?1440:390):(responsive(width)?threshold+1:threshold),width]){
   await page.setViewportSize({width:next,height:900});await page.waitForFunction(expected=>{const nav=document.querySelector('.elementor-widget-navigation-menu nav');return nav.inert===expected;},responsive(next));
   assert.equal(await nav.locator('[aria-expanded=true]').count(),0,'Resize resets submenu state');const check=(await verifyNavigation(page)).find(r=>r.kind==='addon-navigation');assert.equal(check?.status,'passed',JSON.stringify(check));assert.equal(check.disclosures,2);assert.equal(check.responsive,responsive(next));transitions.push({width:next,...check});
  }
  results.push({variant,width,pixels,sourceGeometry:evidence[0].geometry,exportGeometry:evidence[1].geometry,transitions});for(const {context} of pages)await context.close();console.log('Passed',variant,width);
 }
 await writeFile(path.join(artifact,'ultimate-breakpoint-check.json'),JSON.stringify(results,null,2));console.log(JSON.stringify({cases:results.length,minimumPixel:Math.min(...results.flatMap(r=>Object.values(r.pixels)))}));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
