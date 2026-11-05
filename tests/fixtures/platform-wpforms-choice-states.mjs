import assert from 'node:assert/strict';import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import {chromium} from 'playwright';import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';import {visualScore} from '../../engine/verify.mjs';
const artifact=path.resolve(process.argv[2]||'artifacts/platform/wpforms-paint-v39'),temp=await mkdtemp(path.join(tmpdir(),'wpf-choice-states-'));let browser,server;const cases=[];
try{
 await cp(path.join(artifact,'project'),temp,{recursive:true});const config=JSON.parse(await readFile(path.join(temp,'forms.json')));const form=config.forms.find(f=>f.provider==='wpforms'&&f.route==='/workshop-interest/');assert.ok(form);form.delivery={endpoint:'/local-proof',format:'multipart'};await writeFile(path.join(temp,'forms.json'),JSON.stringify(config));await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 for(const width of [1440,390]){
  const captures={};for(const [kind,url]of [['source','http://127.0.0.1:9439/workshop-interest/'],['rebuilt',server.url+'/workshop-interest/']]){
   const page=await browser.newPage({viewport:{width,height:844},reducedMotion:'reduce'});let posts=0;await page.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){posts++;return r.abort();}return new URL(r.request().url()).origin===new URL(url).origin?r.continue():r.abort();});await page.goto(url,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);const widgets=page.locator('form.wpforms-form .choices');assert.equal(await widgets.count(),2);
   captures[kind]={};for(const state of ['single-open','multiple-filtered']){
    if(state==='single-open')await widgets.nth(0).locator('.choices__inner').click();
    else{await page.keyboard.press('Escape');const search=widgets.nth(1).locator('input.choices__input--cloned');await search.click();await search.pressSequentially('mat');}
    await page.waitForTimeout(400);const widget=widgets.nth(state==='single-open'?0:1);assert.equal(await widget.locator('.choices__list--dropdown').isVisible(),true);const visible=await widget.locator('.choices__list--dropdown [data-choice]').evaluateAll(es=>es.filter(e=>e.getBoundingClientRect().height>0&&getComputedStyle(e).visibility!=='hidden').map(e=>e.textContent.trim()));const file=path.join(artifact,`choice-${state}-${kind}-${width}.png`);await page.screenshot({path:file,fullPage:true,animations:'disabled'});captures[kind][state]={file,visible};
   }assert.equal(posts,0);await page.close();
  }
  for(const state of ['single-open','multiple-filtered']){const source=captures.source[state],rebuilt=captures.rebuilt[state],pixel=visualScore(await readFile(source.file),await readFile(rebuilt.file));assert.deepEqual(rebuilt.visible,source.visible);cases.push({width,state,pixel,visible:rebuilt.visible});assert.ok(pixel>=.99,`${state} visual mismatch ${pixel}`);}
 }
 await writeFile(path.join(artifact,'choice-states-check.json'),JSON.stringify({generatedScripts:true,cases,sourceSubmissions:0,aiCalls:0},null,2));console.log(JSON.stringify({cases}));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
