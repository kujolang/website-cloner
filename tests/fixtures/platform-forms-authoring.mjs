// Rebuild the actual installed-plugin export in an isolated copy.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import {load} from 'cheerio';import {chromium} from 'playwright';
import {parseContent,YAML} from '../../scripts/source-project.mjs';
import {run} from '../../engine/pipeline.mjs';
const source=path.resolve(process.argv[2]||'artifacts/platform/forms/project');
const original=await readFile(path.join(source,'forms.json'),'utf8');
const dir=await mkdtemp(path.join(tmpdir(),'installed-form-authoring-'));
try{
 await cp(source,dir,{recursive:true,filter:entry=>!['output','.ssg-output','.ssg-content','.ssg-templates'].includes(path.basename(entry))});
 for(const file of ['form-export.mjs','component-forms.js'])await cp(path.resolve('scripts',file),path.join(dir,'scripts',file));
 const config=JSON.parse(original),form=config.forms.find(f=>f.route==='/quote/');assert.ok(form);assert.equal(form.fields.find(f=>f.name==='attachment').maxFileBytes,2097152);
 form.delivery={endpoint:'/test-delivery',format:'multipart'};form.fields.find(f=>f.name==='attachment').maxFileBytes=8;form.fields.find(f=>f.name==='work-email').name='reply_to';form.fields.find(f=>f.name==='reply_to').label='Reply email address';
 form.fields.find(f=>f.name==='region').options.push({value:'east',label:'Eastern region'});
 await writeFile(path.join(dir,'forms.json'),JSON.stringify(config));
 const contentFile=path.join(dir,'content/pages/quote.md'),parsed=parseContent(await readFile(contentFile,'utf8'),contentFile);parsed.meta.title='Edited quote request';parsed.body=parsed.body.replace('Local fixture only. No messages are delivered.','Edited Markdown form introduction.');await writeFile(contentFile,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body);
 await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:120000});
 const html=await readFile(path.join(dir,'output/quote/index.html'),'utf8'),$=load(html);
 assert.equal($('h1').text().trim(),'Edited quote request');assert.match($('main').text(),/Edited Markdown form introduction/);
 assert.equal($('[name=reply_to]').length,1);assert.match($('[name=reply_to]').closest('label').text(),/Reply email address/);assert.equal($('[name=attachment]').attr('data-cloner-max-file-bytes'),'8');assert.equal($('option[value=east]').text(),'Eastern region');assert.equal($('script[data-cloner-component=forms]').length,1);
 const originalHTML=load(await readFile(path.join(source,'output/quote/index.html'),'utf8'));assert.equal(originalHTML('script[data-cloner-component=forms]').length,0);assert.equal(originalHTML('input[type=submit]').is(':disabled'),true);
 const browser=await chromium.launch({channel:'chrome'});try{
  const tab=await browser.newPage();let posts=0;
  await tab.route('**/*',async route=>{if(route.request().url()==='https://fixture.test/test-delivery'){posts++;assert.match(route.request().postData(),/name="reply_to"/);assert.doesNotMatch(route.request().postData(),/_wpcf7/);await route.fulfill({contentType:'application/json',body:'{"ok":true}'});}else if(route.request().url()==='https://fixture.test/quote/')await route.fulfill({contentType:'text/html',body:html});else await route.abort();});
  await tab.goto('https://fixture.test/quote/');await tab.locator('[name=reply_to]').fill('fixture@example.test');await tab.locator('[name=quantity]').fill('2');await tab.locator('[name="preferred-date"]').fill('2027-06-01');await tab.locator('[name=region]').selectOption('east');await tab.locator('[name=agreement]').check();await tab.locator('[name="services[]"]').first().check();
  await tab.locator('[name=attachment]').setInputFiles({name:'too-big.txt',mimeType:'text/plain',buffer:Buffer.alloc(9)});assert.equal(await tab.locator('form.wpcf7-form').evaluate(f=>f.checkValidity()),false);
  await tab.locator('[name=attachment]').setInputFiles({name:'small.txt',mimeType:'text/plain',buffer:Buffer.from('small')});assert.equal(await tab.locator('form.wpcf7-form').evaluate(f=>f.checkValidity()),true);
  await tab.locator('.wpcf7 input[type=submit]').click();await tab.waitForFunction(()=>document.querySelector('.wpcf7 form [role=status]')?.textContent.includes('accepted'));assert.equal(posts,1);
 }finally{await browser.close();}
 assert.equal(await readFile(path.join(source,'forms.json'),'utf8'),original);
 console.log(JSON.stringify({status:'passed',scope:'Actual exported standalone build with edited form definitions and intercepted delivery',sourceMutated:false,sourceSubmissions:0,aiCalls:0,configuredDelivery:true,markdownAndFrontmatter:true,authoredMaxFileBytes:8,renamedField:'reply_to',editedLabel:'Reply email address',addedChoice:'east'}));
}finally{await rm(dir,{recursive:true,force:true});}
