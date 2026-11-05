import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {extract} from '../engine/extract.mjs';
import {publicFormContracts} from '../engine/form-contract.mjs';
import {applyForms,formEndpoint} from '../scripts/form-export.mjs';
import {applyComponents} from '../scripts/component-export.mjs';
const source='<html><body><main><div class="wpcf7"><form id="contact" action="https://old.example/send"><label>Email<input type="email" name="email" required></label><input type="hidden" name="_nonce" value="secret"><label>Message<textarea name="message"></textarea></label><input type="file" name="attachment"><label><input type="checkbox" name="interests" value="news">News</label><label><input type="checkbox" name="interests" value="events">Events</label><button type="submit">Send</button></form></div></main></body></html>';
function fixture({endpoint='/deliver',format='json'}={}){
 const p=extract(source,'https://site.example/contact/'),contracts=publicFormContracts(load(source),p.route);contracts[0].delivery={endpoint,format};
 const $=load('<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; connect-src \'self\'; script-src \'none\'; form-action \'none\'"></head><body>'+p.shell.replace('MIGRATION_CONTENT_SLOT_7c3e',p.content)+'</body></html>');
 const results=applyForms($,{route:p.route},contracts),components=applyComponents($);return {html:$.html(),results,components,contracts};
}
test('only configured captured forms activate, and hidden tokens stay disabled',()=>{
 const {html,results,components}=fixture(),$=load(html);
 assert.equal(results[0].status,'configured');assert.deepEqual(components.map(c=>c.id),['forms']);
 assert.equal($('input[name=email]').is(':disabled'),false);assert.equal($('button').is(':disabled'),false);assert.equal($('input[type=hidden]').is(':disabled'),true);assert.equal($('input[type=hidden]').attr('value'),undefined);assert.equal($('.migration-form-notice').length,0);assert.doesNotMatch($('form').attr('aria-description')||'',/unavailable/);
 const disconnected=fixture({endpoint:null});assert.equal(disconnected.results[0].status,'requires-connection');assert.deepEqual(disconnected.components,[]);assert.equal(load(disconnected.html)('button').is(':disabled'),true);
});
test('endpoint config rejects executable/credential URLs and expands only connect CSP',()=>{
 for(const url of ['javascript:alert(1)','http://remote.example/send','https://user:secret@remote.example/send','//remote.example/send','/\\remote.example'])assert.throws(()=>formEndpoint(url));
 const {html}=fixture({endpoint:'https://service.example/send'});const csp=load(html)('meta[http-equiv]').attr('content');assert.match(csp,/connect-src[^;]*https:\/\/service.example/);assert.match(csp,/form-action 'none'/);
});
test('configured form submits once, validates, reports explicit acceptance, and handles failed or unconfirmed replies',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{
  const p=await browser.newPage();const requests=[];let response={status:200,body:{ok:true}};
  await p.route('https://site.example/**',async route=>{
   if(route.request().url().endsWith('/deliver')){requests.push(JSON.parse(route.request().postData()));await route.fulfill({status:response.status,contentType:'application/json',body:JSON.stringify(response.body)});}
   else await route.fulfill({contentType:'text/html',body:fixture().html});
  });
  await p.goto('https://site.example/contact/');await p.getByRole('button',{name:'Send'}).click();assert.equal(requests.length,0);
  await p.locator('[name=email]').fill('person@example.test');await p.locator('[name=message]').fill('Test message');
  await p.getByRole('button',{name:'Send'}).click();await p.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('accepted'));
  assert.deepEqual(requests,[{email:'person@example.test',message:'Test message'}]);assert.equal(await p.locator('form').getAttribute('aria-busy'),null);
  await p.evaluate(()=>{const form=document.querySelector('form');form.requestSubmit();form.requestSubmit();});await p.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('accepted'));assert.equal(requests.length,2);
  for(const reply of [{status:200,body:{ok:false}},{status:200,body:{message:'Email sent'}},{status:500,body:{ok:true}}]){
   response=reply;await p.getByRole('button',{name:'Send'}).click();await p.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('could not be confirmed'));assert.equal(await p.getByRole('button',{name:'Send'}).isEnabled(),true);
  }
 }finally{await browser.close();}
});
test('multipart preserves repeated fields and files without captured source tokens',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{
  const p=await browser.newPage();let submitted='';await p.route('https://site.example/**',async route=>{
   if(route.request().method()==='POST'){submitted=route.request().postData();await route.fulfill({contentType:'application/json',body:'{"ok":true}'});}
   else await route.fulfill({contentType:'text/html',body:fixture({format:'multipart'}).html});
  });await p.goto('https://site.example/contact/');await p.locator('[name=email]').fill('person@example.test');await p.locator('[name=interests]').nth(0).check();await p.locator('[name=interests]').nth(1).check();await p.locator('[name=attachment]').setInputFiles({name:'test.txt',mimeType:'text/plain',buffer:Buffer.from('fixture upload')});await p.getByRole('button',{name:'Send'}).click();await p.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('accepted'));assert.match(submitted,/name="email"/);assert.doesNotMatch(submitted,/_nonce|secret/);assert.match(submitted,/filename="test.txt"/);assert.match(submitted,/fixture upload/);assert.equal((submitted.match(/name="interests"/g)||[]).length,2);
 }finally{await browser.close();}
});

test('export owner can configure delivery and rename a field then rebuild the standalone SSG project', {timeout:60000},async()=>{
 const {mkdtemp,readFile,writeFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {generate}=await import('../engine/generate.mjs'),{run}=await import('../engine/pipeline.mjs');
 const dir=await mkdtemp(join(tmpdir(),'cloner-form-export-'));
 try{
  const p=extract(source,'https://site.example/contact/');p.styles=[];
  await generate({source:'https://site.example/',identity:{title:'Forms'},navigation:[],design:{},metrics:{},pages:[p],media:[]},dir);
  const file=join(dir,'forms.json'),config=JSON.parse(await readFile(file,'utf8'));config.forms[0].delivery={endpoint:'/deliver',format:'json'};config.forms[0].fields.find(f=>f.name==='email').name='reply_to';await writeFile(file,JSON.stringify(config));
  await writeFile(join(dir,'form-settings.json'),JSON.stringify({revision:1,forms:{[config.forms[0].id]:{endpoint:'/configured',format:'json'}}}));
  await run(process.execPath,['scripts/build.mjs','--base-path','/preview'],{cwd:dir,timeout:45000});
  const html=await readFile(join(dir,'output/contact/index.html'),'utf8'),$=load(html);
  assert.equal($('input[name=reply_to]').length,1);assert.equal($('input[name=reply_to]').is(':disabled'),false);assert.equal($('script[data-cloner-component=forms]').length,1);
  assert.equal(JSON.parse($('form').attr('data-cloner-delivery')).endpoint,'/preview/configured');
  const report=JSON.parse(await readFile(join(dir,'form-delivery-report.json'),'utf8'));assert.equal(report.pages[0].forms[0].status,'configured');assert.equal(report.configurationRevision,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('configured delivery restores the source accessible description relationships',()=>{
 const original=source.replace('<form id="contact"','<p id="help">Original instructions</p><form aria-describedby="help" aria-description="Original description" id="contact"');const p=extract(original,'https://site.example/contact/'),contracts=publicFormContracts(load(original),p.route),$=load(p.content);contracts[0].delivery={endpoint:'/deliver',format:'json'};assert.match($('form').attr('aria-description'),/unavailable.*Original instructions/);assert.equal($('form').attr('aria-describedby'),undefined);applyForms($,{route:p.route},contracts);assert.equal($('form').attr('aria-description'),'Original description');assert.equal($('form').attr('aria-describedby'),'help');assert.equal($('form').attr('data-migration-source-describedby'),undefined);
});

test('shared choice validation handles inverted acceptance, disabled options and reset',async()=>{
 const {readFile}=await import('node:fs/promises');const runtime=await readFile(new URL('../scripts/component-forms.js',import.meta.url),'utf8');
 const browser=await chromium.launch({channel:'chrome'});try{
  const page=await browser.newPage();await page.setContent(`<form data-cloner-delivery='{"endpoint":"/send"}'><input type="checkbox" name="a" data-cloner-required-group="group"><input type="checkbox" name="b" data-cloner-required-group="group" disabled checked><input type="checkbox" name="inverse" data-cloner-must-uncheck="true"><button type="reset">Reset</button></form>`);await page.addScriptTag({content:runtime});
  const valid=()=>page.locator('form').evaluate(f=>f.checkValidity());assert.equal(await valid(),false);
  await page.locator('[name=a]').check();assert.equal(await valid(),true);
  await page.locator('[name=inverse]').check();assert.equal(await valid(),false);
  await page.locator('[name=inverse]').uncheck();assert.equal(await valid(),true);
  await page.getByRole('button',{name:'Reset'}).click();await page.waitForFunction(()=>!document.querySelector('form').checkValidity());
 }finally{await browser.close();}
});

test('configured select preserves an empty placeholder value and editable option definitions',()=>{
 const original=source.replace('<input type="file" name="attachment">','<select name="region" required><option value="">Choose</option><option value="north">North</option></select>');
 const p=extract(original,'https://site.example/contact/'),contracts=publicFormContracts(load(original),p.route),$=load(p.content);contracts[0].delivery={endpoint:'/deliver'};
 const select=contracts[0].fields.find(f=>f.name==='region');select.options[1].label='Northern region';select.options[1].disabled=true;
 applyForms($,p,contracts);assert.equal($('option').first().attr('value'),'');assert.equal($('option').last().text(),'Northern region');assert.equal($('option').last().is('[disabled]'),true);
});

test('configured CF7 replaces the source acceptance submit lock with local validation',()=>{
 const original=source.replace('<button type="submit">Send</button>','<input class="wpcf7-submit" type="submit" value="Send" disabled>');const p=extract(original,'https://site.example/contact/'),contracts=publicFormContracts(load(original),p.route),$=load(p.content);assert.equal($('input[type=submit]').is(':disabled'),true);contracts[0].delivery={endpoint:'/deliver'};applyForms($,p,contracts);assert.equal($('input[type=submit]').is(':disabled'),false);
});

test('authored field labels update nested text while preserving controls and styling',()=>{
 const original=source.replace('<label>Email<input','<label><span class="label-text">Email</span><input');const p=extract(original,'https://site.example/contact/'),contracts=publicFormContracts(load(original),p.route),$=load(p.content);contracts[0].delivery={endpoint:'/deliver'};contracts[0].fields.find(f=>f.name==='email').label='Reply email';applyForms($,p,contracts);assert.equal($('.label-text').text(),'Reply email');assert.equal($('input[name=email]').length,1);
});
test('complex authored labels remain intact and report an ambiguous binding',()=>{
 const original=source.replace('<label>Email<input','<label>Email <strong>required</strong><input');const p=extract(original,'https://site.example/contact/'),contracts=publicFormContracts(load(original),p.route),$=load(p.content);contracts[0].delivery={endpoint:'/deliver'};contracts[0].fields.find(f=>f.name==='email').label='Reply address';const result=applyForms($,p,contracts);assert.equal($('strong').text(),'required');assert.ok(result[0].authoringIssues.some(i=>i.field==='email'));
});

test('disconnected form definitions stay editable without activating delivery',()=>{
 const p=extract(source,'https://site.example/contact/'),contracts=publicFormContracts(load(source),p.route),$=load(p.content);contracts[0].fields.find(f=>f.name==='email').label='Updated email label';const result=applyForms($,p,contracts);assert.equal(result[0].status,'requires-connection');assert.match($('label').first().text(),/Updated email label/);assert.equal($('input[name=email]').is(':disabled'),true);assert.equal($('button').is(':disabled'),true);assert.equal($('form').attr('data-cloner-delivery'),undefined);
});

test('select authoring preserves source optgroup structure and option classes',()=>{
 const original=source.replace('<input type="file" name="attachment">','<label>Region<select name="region"><optgroup label="North"><option class="region-choice" value="a">A</option></optgroup></select></label>');const p=extract(original,'https://site.example/contact/'),contracts=publicFormContracts(load(original),p.route),$=load(p.content);contracts[0].fields.find(f=>f.name==='region').options[0].label='Changed';applyForms($,p,contracts);assert.equal($('optgroup option.region-choice').text(),'Changed');assert.equal($('optgroup').attr('label'),'North');
});

test('shared confirmation validation follows edits to either field and safely rejects missing references',async()=>{
 const {readFile}=await import('node:fs/promises');const runtime=await readFile(new URL('../scripts/component-forms.js',import.meta.url),'utf8');const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage();await page.setContent(`<form data-cloner-delivery='{"endpoint":"/send"}'><input name="primary" data-migration-field-index="0"><input name="confirm" data-cloner-match-index="0"></form>`);await page.addScriptTag({content:runtime});const valid=()=>page.locator('form').evaluate(f=>f.checkValidity());await page.locator('[name=primary]').fill('same');assert.equal(await valid(),false);await page.locator('[name=confirm]').fill('same');assert.equal(await valid(),true);await page.locator('[name=primary]').fill('changed');assert.equal(await valid(),false);await page.locator('[name=primary]').evaluate(e=>e.remove());await page.locator('[name=confirm]').fill('changed');assert.equal(await valid(),false);}finally{await browser.close();}
});
test('required choice groups ignore disabled fieldsets while preserving first-legend controls',async()=>{
 const {readFile}=await import('node:fs/promises'),runtime=await readFile(new URL('../scripts/component-forms.js',import.meta.url),'utf8');const browser=await chromium.launch({channel:'chrome'});
 try{const page=await browser.newPage();await page.setContent(`<form data-cloner-delivery='{"endpoint":"/send"}'><fieldset disabled><legend>Options <input name="legend" type="checkbox" data-cloner-required-group="choices"></legend><input name="inactive" type="checkbox" checked data-cloner-required-group="choices"></fieldset><input name="active" type="checkbox" data-cloner-required-group="choices"></form>`);await page.addScriptTag({content:runtime});
 assert.equal(await page.locator('[name=inactive]').evaluate(e=>e.disabled),false);assert.equal(await page.locator('form').evaluate(e=>e.checkValidity()),false);
 await page.locator('[name=legend]').check();assert.equal(await page.locator('form').evaluate(e=>e.checkValidity()),true);await page.locator('[name=legend]').uncheck();assert.equal(await page.locator('form').evaluate(e=>e.checkValidity()),false);await page.locator('[name=active]').check();assert.equal(await page.locator('form').evaluate(e=>e.checkValidity()),true);
 assert.deepEqual(await page.locator('form').evaluate(e=>[...new FormData(e).keys()]),['active']);
 }finally{await browser.close();}
});
