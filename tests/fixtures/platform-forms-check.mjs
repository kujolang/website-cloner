// Installed CF7 public HTML -> shared contract -> exported browser validation.
// All submission traffic is intercepted; the source receives GET requests only.
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {enrichForms} from '../../engine/form-validation.mjs';
import {extract} from '../../engine/extract.mjs';
import {applyForms} from '../../scripts/form-export.mjs';
import {applyComponents} from '../../scripts/component-export.mjs';
const url='http://127.0.0.1:9421/quote/';
const response=await fetch(url);assert.equal(response.status,200);
const source=await response.text(),page=extract(source,url),contracts=page.sourceForms;
assert.equal(contracts.length,1);const contract=contracts[0];assert.equal(contract.provider,'contact-form-7');
assert.equal(contract.fields.find(f=>f.name==='agreement').required,true);
assert.equal(contract.fields.filter(f=>f.requiredGroup==='services[]').length,2);
assert.equal(contract.fields.find(f=>f.name==='attachment').accept,'.pdf,.txt');
await enrichForms({source:url,pages:[page]},{get:async url=>{const r=await fetch(url);return {status:r.status,body:await r.text()};}});
assert.equal(contract.fields.find(f=>f.name==='attachment').maxFileBytes,2097152);
contract.delivery={endpoint:'/deliver',format:'multipart'};
const $=load('<html><head></head><body>'+page.content+'</body></html>');
assert.equal(applyForms($,page,contracts)[0].status,'configured');applyComponents($);
const browser=await chromium.launch({channel:'chrome'});
try{
 const tab=await browser.newPage();let submissions=0;
 await tab.route('**/*',async route=>{
  if(route.request().url()==='https://fixture.test/deliver'){submissions++;assert.doesNotMatch(route.request().postData(),/_wpcf7/);await route.fulfill({contentType:'application/json',body:'{"ok":true}'});}
  else if(route.request().url()==='https://fixture.test/quote/')await route.fulfill({contentType:'text/html',body:$.html()});
  else await route.abort();
 });
 await tab.goto('https://fixture.test/quote/');
 const valid=()=>tab.locator('form').evaluate(form=>form.checkValidity());
 await tab.locator('[name="work-email"]').fill('fixture@example.test');await tab.locator('[name=quantity]').fill('2');await tab.locator('[name="preferred-date"]').fill('2027-06-01');await tab.locator('[name=region]').selectOption('North');
 assert.equal(await valid(),false);
 await tab.locator('[name=agreement]').check();assert.equal(await valid(),false);
 await tab.locator('[name="services[]"]').nth(1).check();assert.equal(await valid(),true);
 await tab.locator('[name=region]').selectOption('');assert.equal(await valid(),false);await tab.locator('[name=region]').selectOption('North');
 await tab.locator('[name=attachment]').setInputFiles({name:'too-large.txt',mimeType:'text/plain',buffer:Buffer.alloc(2097153)});assert.equal(await valid(),false);
 await tab.locator('[name=attachment]').setInputFiles({name:'bad.exe',mimeType:'application/octet-stream',buffer:Buffer.from('invalid')});assert.equal(await valid(),false);
 await tab.locator('[name=attachment]').setInputFiles({name:'good.txt',mimeType:'text/plain',buffer:Buffer.from('fixture')});assert.equal(await valid(),true);
 await tab.locator('[type=submit]').click();await tab.waitForFunction(()=>document.querySelector('form [role=status]').textContent.includes('accepted'));assert.equal(submissions,1);
 await tab.locator('[name="services[]"]').nth(1).uncheck();assert.equal(await valid(),false);
 console.log(JSON.stringify({plugin:'contact-form-7',version:'6.2.3',sourceHTTP:200,fields:contract.fields.length,requiredChoiceGroup:true,requiredAcceptance:true,fileSizeValidation:true,fileTypeValidation:true,interceptedDelivery:submissions,sourceSubmissions:0,aiCalls:0,limitations:['Unsupported SWV rules are reported; delivery service must validate independently','Conditional logic and additional configurations not verified']}));
}finally{await browser.close();}
