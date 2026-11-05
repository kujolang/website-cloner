import {saveRedirectImport} from '../app/redirect-import.mjs';
import {redirectImportFingerprint} from '../scripts/redirect-export.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {chromium} from 'playwright';
import {compatibilityReport,saveFormSettings} from '../app/compatibility.mjs';
const form={id:'form-test',route:'/contact/',provider:'contact-form-7',status:'requires-connection',delivery:{endpoint:null},fields:[]};
test('compatibility reports keep evidence separate from configuration and detect stale writes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'compatibility-'));try{const project=path.join(dir,'project');await mkdir(project);
 await writeFile(path.join(project,'forms.json'),JSON.stringify({forms:[form]}));
 await writeFile(path.join(project,'platform-support.json'),JSON.stringify({plugins:[{id:'cf7',name:'Contact Form 7',status:'unverified',routes:['/contact/']}]}));
 await writeFile(path.join(project,'redirect-report.json'),JSON.stringify({rules:[{cloudflare:'http-rule',static:'html-fallback'}],issues:[{reason:'fixture'}]}));
 let report=await compatibilityReport(dir);assert.deepEqual(report.redirects,{httpRules:1,staticFallbacks:1,issues:1});assert.equal(report.plugins[0].status,'unverified');assert.equal(report.pendingConfiguration,false);
 await saveFormSettings(dir,{id:form.id,revision:0,endpoint:'https://service.example/contact',format:'json'});
 report=await compatibilityReport(dir);assert.equal(report.pendingConfiguration,true);assert.equal(report.forms[0].delivery.format,'json');assert.equal(report.forms[0].status,'requires-connection');
 await assert.rejects(saveFormSettings(dir,{id:form.id,revision:0,endpoint:'/contact'}),/Settings changed/);
 await assert.rejects(saveFormSettings(dir,{id:'unknown',revision:1,endpoint:'/contact'}),/Unknown form/);
 await assert.rejects(saveFormSettings(dir,{id:form.id,revision:1,endpoint:'javascript:alert(1)'}),/HTTPS/);
 await writeFile(path.join(project,'form-delivery-report.json'),JSON.stringify({configurationRevision:1,pages:[{forms:[{id:form.id,status:'configured'}]}]}));assert.equal((await compatibilityReport(dir)).pendingConfiguration,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('compatibility UI escapes source text, saves explicit settings and requests cache-only rebuild',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({viewport:{width:390,height:844}});const id='a'.repeat(48);let revision=0,posted,rebuild,redirectPosted;
 const html=await readFile(new URL('../app/index.html',import.meta.url),'utf8'),js=await readFile(new URL('../app/compatibility.js',import.meta.url),'utf8');
 await page.route('http://builder.test/**',async route=>{const pathname=new URL(route.request().url()).pathname;const json=(value,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(value)});
 if(pathname.endsWith('/compatibility'))return json({available:true,revision,pendingConfiguration:revision>0,redirectImport:{fingerprint:'fixture',count:0},plugins:[{name:'<script>bad()</script>',status:'unverified',routeCount:1}],components:[],seoIssues:[],forms:[form]});
 if(pathname.endsWith('/redirects')){redirectPosted=route.request().postDataJSON();return json({pendingConfiguration:true});}
 if(pathname.endsWith('/forms')){posted=route.request().postDataJSON();revision++;return json({revision});}
 if(pathname.endsWith('/rebuild')){rebuild=route.request().postDataJSON();return json({error:'Fixture stops before rebuilding'},409);}
 if(pathname==='/style.css')return route.fulfill({contentType:'text/css',body:await readFile(new URL('../app/style.css',import.meta.url),'utf8')});
 if(pathname==='/')return route.fulfill({contentType:'text/html; charset=utf-8',body:html.replace(/<script[^>]*>[\s\S]*?<\/script>/g,'')});return route.fulfill({body:''});});
 await page.goto('http://builder.test/');await page.addScriptTag({content:js});await page.evaluate(id=>{document.querySelector('#result').hidden=false;document.dispatchEvent(new CustomEvent('hosting-build',{detail:{id}}));},id);
 await page.locator('#compatibility-panel').evaluate(el=>{el.open=true;for(let p=el;p;p=p.parentElement)p.hidden=false;});
 await page.waitForFunction(()=>document.querySelector('#compatibility-status').textContent==='Compatibility report loaded.');assert.equal(await page.locator('#compatibility-plugins script').count(),0);
 await page.locator('#compatibility-panel').screenshot({path:'/tmp/cloner-compatibility-mobile.png'});
 assert.equal(await page.locator('#compatibility-panel').evaluate(el=>el.scrollWidth<=el.clientWidth),true);
 await page.locator('#redirect-import-file').setInputFiles({name:'redirects.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({redirects:[]}))});await page.getByRole('button',{name:'Import redirect rules'}).click();await page.waitForFunction(()=>document.querySelector('#redirect-import-file').files.length===0);assert.deepEqual(redirectPosted,{data:{redirects:[]},fingerprint:'fixture'});
 await page.locator('#delivery-form-test').fill('https://service.example/contact');await page.getByRole('button',{name:'Save form settings'}).click();await page.waitForFunction(()=>document.querySelector('#compatibility-status').textContent.includes('Settings saved'));
 assert.equal(posted.endpoint,'https://service.example/contact');await page.locator('#compatibility-rebuild').click();await page.waitForFunction(()=>document.querySelector('#compatibility-status').textContent.includes('Fixture stops'));assert.deepEqual(rebuild,{retryAssets:false});
 }finally{await browser.close();}
});

test('builder API serves compatibility and persists form settings for completed jobs', {timeout:20000},async()=>{
 const {spawn}=await import('node:child_process'),{once}=await import('node:events'),net=await import('node:net');
 const freePort=async()=>{const server=net.createServer();server.listen(0,'127.0.0.1');await once(server,'listening');const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;};
 const dir=await mkdtemp(path.join(tmpdir(),'compat-api-')),id='b'.repeat(48),port=await freePort(),preview=await freePort(),origin='http://127.0.0.1:'+port;let server;
 try{
  await mkdir(path.join(dir,id,'project'),{recursive:true});await writeFile(path.join(dir,id,'job.json'),JSON.stringify({id,url:'https://example.test',status:'complete',options:{}}));await writeFile(path.join(dir,id,'project/forms.json'),JSON.stringify({forms:[form]}));
  server=spawn(process.execPath,['app/server.mjs'],{cwd:new URL('..',import.meta.url).pathname,env:{...process.env,PORT:String(port),PREVIEW_PORT:String(preview),MIGRATION_DATA_DIR:dir},stdio:'ignore'});
  let ready=false;for(let i=0;i<80;i++){try{if((await fetch(origin+'/api/jobs/'+id+'/compatibility')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.equal(ready,true);
  let result=await fetch(origin+'/api/jobs/'+id+'/forms',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({id:form.id,revision:0,endpoint:'/send',format:'multipart'})});assert.equal(result.status,200);
  const imported={redirects:[{url:'/old/',enabled:true,title:'Rule description '.repeat(400)}]};const redirectResponse=await fetch(origin+'/api/jobs/'+id+'/redirects',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({data:imported,fingerprint:redirectImportFingerprint({redirects:[]})})});assert.equal(redirectResponse.status,200);
  const report=await(await fetch(origin+'/api/jobs/'+id+'/compatibility')).json();assert.equal(report.revision,1);assert.equal(report.pendingConfiguration,true);assert.equal(report.forms[0].delivery.endpoint,'/send');
 }finally{if(server&&server.exitCode===null){const exited=once(server,'exit');server.kill('SIGTERM');await exited;}await rm(dir,{recursive:true,force:true});}
});

test('redirect imports detect stale writes and remain pending until rebuilt',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'redirect-import-'));try{
  const project=path.join(dir,'project');await mkdir(project);const initial=await compatibilityReport(dir);
  await assert.rejects(saveRedirectImport(dir,{fingerprint:initial.redirectImport.fingerprint,data:{redirects:[null]}}),/JSON export/);
  const data={redirects:[{url:'/old/',enabled:true}],groups:[]};await saveRedirectImport(dir,{fingerprint:initial.redirectImport.fingerprint,data});
  assert.equal((await compatibilityReport(dir)).pendingConfiguration,true);
  await assert.rejects(saveRedirectImport(dir,{fingerprint:initial.redirectImport.fingerprint,data}),/changed/);
  await writeFile(path.join(project,'redirect-report.json'),JSON.stringify({importFingerprint:redirectImportFingerprint(data),rules:[],issues:[]}));
  assert.equal((await compatibilityReport(dir)).pendingConfiguration,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
