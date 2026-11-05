import assert from 'node:assert/strict';import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {chromium} from 'playwright';import {parseContent,YAML} from '../../scripts/source-project.mjs';import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';
const route=process.argv.find(a=>a.startsWith('--route='))?.slice(8)||'/filtered-gallery/';
const root=path.resolve(process.argv[2]||'artifacts/platform/essential-gallery'),temp=await mkdtemp(path.join(tmpdir(),'gallery-authoring-'));let browser,server;
try {
 await cp(path.join(root,'project'),temp,{recursive:true});const file=path.join(temp,'content/pages/'+route.replaceAll('/','')+'.md'),parsed=parseContent(await readFile(file,'utf8'),file);assert.ok(parsed.body.includes('Lamp from our workshop.'));
 await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body.replace('Lamp from our workshop.','Updated lamp caption from Markdown.'));await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())&&new URL(r.request().url()).origin===server.url?r.continue():r.abort());await page.goto(server.url+route,{waitUntil:'networkidle'});
  const controls=page.locator('[data-migration-filter-value]'),items=page.locator('[data-migration-filter-item]');await controls.first().focus();await controls.first().press('End');await controls.nth(2).press('Enter');assert.equal(await controls.nth(2).getAttribute('aria-pressed'),'true');
  assert.equal(await items.evaluateAll(es=>es.filter(e=>!e.hidden).length),2);assert.equal(await items.evaluateAll(es=>es.filter(e=>e.inert).length),2);assert.match(await items.nth(1).innerText(),/Updated lamp caption from Markdown/);
  await controls.nth(2).press('Home');await controls.first().press('Space');assert.equal(await items.evaluateAll(es=>es.filter(e=>!e.hidden).length),4);await page.close();
 }
 const result={captionMarkdownEdit:true,keyboard:['End','Enter','Home','Space'],viewports:[1440,390],reducedMotion:true,sourceModified:false,aiCalls:0};await writeFile(path.join(root,'gallery-authoring-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
