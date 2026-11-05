// Prove hidden installed-plugin answers remain editable through native Markdown.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';
import {parseContent,YAML} from '../../scripts/source-project.mjs';
import {chromium} from 'playwright';import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/spectra');
const temp=await mkdtemp(path.join(tmpdir(),'spectra-authoring-'));let browser,server;
try {
 await cp(path.join(root,'project'),temp,{recursive:true});
 const file=path.join(temp,'content/pages/faq-exclusive.md');const md=await readFile(file,'utf8');
 const parsed=parseContent(md,file);
 assert.ok(parsed.body.includes('Review the first draft and refine the details.'));
 await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body.replace('Review the first draft and refine the details.','Edited hidden answer from native Markdown.'));
 await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});
 server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 for(const width of [1440,390]) {
  const page=await browser.newPage({reducedMotion:'reduce',viewport:{width,height:900}});
  await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())&&new URL(r.request().url()).origin===server.url?r.continue():r.abort());
  await page.goto(server.url+'/faq-exclusive/',{waitUntil:'networkidle'});
  const controls=page.locator('.uagb-faq-questions-button'),panels=page.locator('.uagb-faq-content');
  assert.equal(await panels.nth(1).isVisible(),false);
  await controls.first().focus();await controls.first().press('End');
  assert.equal(await controls.nth(1).evaluate(e=>e===document.activeElement),true);
  await controls.nth(1).press('Enter');assert.equal(await panels.first().isVisible(),false);
  assert.match(await panels.nth(1).innerText(),/Edited hidden answer from native Markdown/);
  assert.equal(await panels.nth(1).isVisible(),true);
  await controls.nth(1).press('Space');assert.equal(await panels.nth(1).isVisible(),false);
  await controls.nth(1).press('Home');assert.equal(await controls.first().evaluate(e=>e===document.activeElement),true);
  await page.close();
 }
 const result={hiddenAnswerMarkdownEdit:true,keyboard:['End','Enter','Space','Home'],viewports:[1440,390],sourceModified:false,aiCalls:0};
 await writeFile(path.join(root,'spectra-authoring-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
} finally {await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
