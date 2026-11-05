import {verificationScreenshot} from '../../engine/verify-screenshot.mjs';
import AxeBuilder from '@axe-core/playwright';
import assert from 'node:assert/strict';import {readFile,writeFile,readdir,mkdtemp,cp,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {chromium} from 'playwright';import {load} from 'cheerio/slim';import {serveStatic} from '../../engine/static.mjs';import {verifyNavigation} from '../../engine/verify-navigation.mjs';import {visualScore} from '../../engine/verify.mjs';import {run} from '../../engine/pipeline.mjs';
const root=path.resolve('work/uae'),artifact=path.resolve('artifacts/platform/ultimate-chrome-installed'),record=JSON.parse(await readFile(path.join(root,'ultimate-chrome-records.json'))),temp=await mkdtemp(path.join(tmpdir(),'ultimate-chrome-'));let browser,server;const comparisons=[],edits=[];
try{
 await cp(path.join(artifact,'project'),temp,{recursive:true});await cp('scripts/semantic-export.mjs',path.join(temp,'scripts/semantic-export.mjs'));await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 for(const entry of record.pages)for(const width of [1440,390]){
  const route=new URL(entry.url).pathname,context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();page.setDefaultTimeout(8000);await page.goto(server.url+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  const file=path.join(artifact,'chrome-'+entry.id+'-'+width+'-rebuilt.png');await verificationScreenshot(page,file,{fullPage:true});const pixel=visualScore(await readFile(path.join(root,'chrome-'+entry.id+'-'+width+'.png')),await readFile(file));assert.ok(pixel>=.99,'Chrome visual mismatch '+route+' '+width+': '+pixel);
  assert.equal(await page.locator('[role=main] [role=banner],[role=main] [role=contentinfo],main [role=banner],main [role=contentinfo]').count(),0);
  const landmarks=await new AxeBuilder({page}).withRules(['landmark-banner-is-top-level','landmark-contentinfo-is-top-level','landmark-main-is-top-level','landmark-one-main']).analyze();assert.deepEqual(landmarks.violations.map(v=>v.id),[]);
  const navigation=(await verifyNavigation(page)).filter(r=>r.kind==='addon-navigation');assert.equal(navigation.length,1);assert.equal(navigation[0].status,'passed',JSON.stringify(navigation));comparisons.push({route,width,pixel,navigation,landmarkViolations:landmarks.violations.map(v=>v.id)});await context.close();
 }
 await browser.close();browser=null;await server.close();server=null;
 for(const [before,after] of [['Workshop Collective','Authored Workshop Collective'],['Shared workshop footer.','Authored shared workshop footer.']]){
  const matches=[];for(const name of await readdir(path.join(temp,'templates/partials'))){const file=path.join(temp,'templates/partials',name),text=await readFile(file,'utf8');if(text.includes(before))matches.push({file,text});}
  assert.equal(matches.length,1,'Expected one shared editable partial for '+before);
  await writeFile(matches[0].file,matches[0].text.replaceAll(before,after));edits.push({file:path.relative(temp,matches[0].file),before,after});
 }
 await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});
 for(const entry of record.pages){const route=new URL(entry.url).pathname,$=load(await readFile(path.join(temp,'output',route,'index.html'),'utf8'));assert.match($('header').text(),/Authored Workshop Collective/);assert.match($('footer').text(),/Authored shared workshop footer/);assert.match($('body').text(),/Useful information/);}
 const other=load(await readFile(path.join(temp,'output/menu-horizontal/index.html'),'utf8'));assert.doesNotMatch(other('header').text(),/Authored Workshop Collective/);assert.doesNotMatch(other('footer').text(),/Authored shared workshop footer/);
 const result={comparisons,sharedEdits:edits,nativeBuild:true,propagatedToBothPages:true,otherThemeChromeUnchanged:true};await writeFile(path.join(artifact,'ultimate-chrome-export-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
