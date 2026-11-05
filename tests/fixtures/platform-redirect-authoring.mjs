import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {chromium} from 'playwright';
import {parseContent,YAML} from '../../scripts/source-project.mjs';import {run} from '../../engine/pipeline.mjs';import {serveStatic} from '../../engine/static.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/redirection-installed'),temp=await mkdtemp(path.join(tmpdir(),'redirect-authoring-'));let browser,server;
try {
 await cp(path.join(root,'project'),temp,{recursive:true});
 const file=path.join(temp,'content/pages/about.md'),parsed=parseContent(await readFile(file,'utf8'),file);
 assert.equal(parsed.meta.content_template,'templates/content/default-page.html');
 parsed.meta.permalink='/our-story/';
 const marker='Edited through native Markdown.';
 await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body.replace('Our approach is collaborative and our process is transparent.',marker));
 await run(process.execPath,['scripts/build.mjs'],{cwd:temp,timeout:120000});
 const report=JSON.parse(await readFile(path.join(temp,'redirect-report.json'))),rules=await readFile(path.join(temp,'output/_redirects'),'utf8');
 assert.ok(rules.includes('/old-about/ /our-story/ 301'));assert.ok(rules.includes('/enabled-in-disabled-group/ /our-story/ 301'));assert.ok(rules.includes('/chain/ /old-about/ 307'));
 assert.equal(report.rules.find(r=>r.from==='/method/').static,'not-exported');
 server=await serveStatic(path.join(temp,'output'));browser=await chromium.launch({channel:'chrome'});
 const checked=[];
 for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}}),blocked=[];
  await page.route('**/*',r=>{if(new URL(r.request().url()).origin===server.url&&['GET','HEAD'].includes(r.request().method()))return r.continue();blocked.push(r.request().url());return r.abort();});
  await page.goto(server.url+'/',{waitUntil:'networkidle'});
  for(const [from,to]of [['/old-about/','/our-story/'],['/chain/','/our-story/'],['/method/','/contact/'],['/temporary/','/services/']]){const link=page.locator('a[data-migration-redirect="'+from+'"]');assert.equal(await link.getAttribute('href'),to);assert.equal(await link.getAttribute('aria-disabled'),null);await link.click();await page.waitForURL(server.url+to);assert.equal(await page.locator('main').count(),1);await page.goto(server.url+'/',{waitUntil:'networkidle'});}
  for(const route of ['/old-about/','/enabled-in-disabled-group/']){
   await page.goto(server.url+route,{waitUntil:'networkidle'});await page.waitForURL(server.url+'/our-story/');
   assert.ok((await page.locator('main').innerText()).includes(marker));checked.push({width,route,destination:'/our-story/'});
  }
  assert.equal(blocked.length,0);await page.close();
 }
 const result={sharedTemplate:true,markdownEdit:true,permalinkEdit:true,staticNavigation:checked,homeRedirectLinkNavigations:8,httpDeclarationsVerified:true,liveProviderDeployment:false,aiCalls:0};
 await writeFile(path.join(root,'redirect-authoring-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser?.close();await server?.close();await rm(temp,{recursive:true,force:true});}
