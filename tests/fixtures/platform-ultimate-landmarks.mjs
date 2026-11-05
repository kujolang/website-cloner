import assert from 'node:assert/strict';import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {chromium} from 'playwright';import AxeBuilder from '@axe-core/playwright';
import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';import {verificationScreenshot} from '../../engine/verify-screenshot.mjs';import {visualScore} from '../../engine/verify.mjs';
const artifact=path.resolve('artifacts/platform/ultimate-expanded-installed'),temp=await mkdtemp(path.join(tmpdir(),'ultimate-landmarks-'));let browser,server;const cases=[];
try{
 await cp(path.join(artifact,'project'),temp,{recursive:true});await cp('scripts/semantic-export.mjs',path.join(temp,'scripts/semantic-export.mjs'));await cp('scripts/build-export.mjs',path.join(temp,'scripts/build.mjs'));await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 for(const [route,source,fullPage] of [['menu-contained','variant-contained',false],['shared-studio','chrome-23',true],['shared-workshop','chrome-24',true]])for(const width of [1440,390]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();await page.goto(server.url+'/'+route+'/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  const screenshot=path.join(artifact,'landmark-'+route+'-'+width+'.png');await verificationScreenshot(page,screenshot,{fullPage});const original=path.join('work/uae',source+'-'+width+(fullPage?'':'-closed')+'.png');const pixel=visualScore(await readFile(original),await readFile(screenshot));assert.ok(pixel>=.99,'Visual mismatch '+route+' '+width);
  const audit=await new AxeBuilder({page}).withRules(['region','skip-link','landmark-banner-is-top-level','landmark-contentinfo-is-top-level','landmark-main-is-top-level','landmark-one-main']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)})),[]);
  if(route==='menu-contained')assert.equal(await page.locator('main h1.migration-primary-heading').count(),1);
  const skip=page.locator('a.hfe-skip-link').first();if(await skip.count()){const target=await skip.getAttribute('href');assert.ok(target?.startsWith('#'));assert.equal(await page.locator('[id='+JSON.stringify(target.slice(1))+']').count(),1);await skip.focus();await skip.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.id),target.slice(1));}
  cases.push({route,width,pixel,violations:[],skipFocus:await skip.count()>0});await context.close();
 }
 await writeFile(path.join(artifact,'ultimate-landmark-check.json'),JSON.stringify(cases,null,2));console.log(JSON.stringify(cases));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
