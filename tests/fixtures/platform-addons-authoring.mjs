import assert from 'node:assert/strict';import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {chromium} from 'playwright';import {parseContent,YAML} from '../../scripts/source-project.mjs';import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/essential-addons'),temp=await mkdtemp(path.join(tmpdir(),'addons-authoring-'));let browser,server;
try {
 await cp(path.join(root,'project'),temp,{recursive:true});const file=path.join(temp,'content/pages/horizontal-tabs.md'),parsed=parseContent(await readFile(file,'utf8'),file);
 assert.ok(parsed.body.includes('Design editable workshop content.'));await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body.replace('Design editable workshop content.','Updated design content from Markdown.'));
 await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 for(const width of [1440,390]) {
  const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())&&new URL(r.request().url()).origin===server.url?r.continue():r.abort());
  await page.goto(server.url+'/horizontal-tabs/',{waitUntil:'networkidle'});const controls=page.locator('.eael-tab-item-trigger'),panels=page.locator('.eael-tab-content-item');
  assert.equal(await panels.nth(1).isVisible(),false);await controls.first().focus();await controls.first().press('End');assert.equal(await panels.nth(2).isVisible(),true);
  await controls.nth(2).press('Home');await controls.first().press('ArrowRight');assert.equal(await panels.nth(1).isVisible(),true);assert.match(await panels.nth(1).innerText(),/Updated design content from Markdown/);assert.equal(await panels.nth(0).evaluate(e=>e.inert),true);
  await page.close();
 }
 const result={hiddenTabMarkdownEdit:true,keyboard:['End','Home','ArrowRight'],viewports:[1440,390],sourceModified:false,aiCalls:0};await writeFile(path.join(root,'addons-authoring-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
