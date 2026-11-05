import assert from 'node:assert/strict';import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {chromium} from 'playwright';
import {parseContent,YAML} from '../../scripts/source-project.mjs';import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/litespeed-installed'),temp=await mkdtemp(path.join(tmpdir(),'optimizer-authoring-'));let browser,server;
try {
 await cp(path.join(root,'project'),temp,{recursive:true});
 const file=path.join(temp,'content/pages/home.md'),parsed=parseContent(await readFile(file,'utf8'),file);
 assert.equal(parsed.meta.template_role,'home');assert.ok(parsed.body.includes('Optimized assets, preserved design'));
 const marker='Edited optimized design';await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body.replaceAll('Optimized assets, preserved design',marker));
 const aboutFile=path.join(temp,'content/pages/about.md'),contactFile=path.join(temp,'content/pages/contact.md');
 const about=parseContent(await readFile(aboutFile,'utf8'),aboutFile),contact=parseContent(await readFile(contactFile,'utf8'),contactFile);assert.equal(about.meta.content_template,contact.meta.content_template);
 await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),failed=[],blocked=[];
  page.on('response',r=>{if(r.status()>=400)failed.push(r.url());});await page.route('**/*',r=>{if(new URL(r.request().url()).origin===server.url&&['GET','HEAD'].includes(r.request().method()))return r.continue();blocked.push(r.request().url());return r.abort();});
  await page.goto(server.url+'/',{waitUntil:'networkidle'});assert.equal(await page.getByRole('heading',{name:marker}).count(),1);await page.locator('.fixture-lazy').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.fixture-lazy').evaluate(el=>el.complete&&el.naturalWidth>0&&getComputedStyle(el).objectFit==='cover'),true);
  await page.locator('details summary').click();assert.equal(await page.locator('details').evaluate(el=>el.open),true);assert.deepEqual(failed,[]);assert.deepEqual(blocked,[]);await page.close();
 }
 const result={markdownEdit:true,homeRole:true,sharedDefaultPageTemplate:true,localMediaAndDisclosure:true,viewports:[1440,390],aiCalls:0};await writeFile(path.join(root,'optimizer-authoring-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
