import assert from 'node:assert/strict';import {load} from 'cheerio';import {chromium} from 'playwright';
import {extract} from '../../engine/extract.mjs';import {applyForms} from '../../scripts/form-export.mjs';import {applyComponents} from '../../scripts/component-export.mjs';
const url='http://127.0.0.1:9422/request/',response=await fetch(url);assert.equal(response.status,200);
const page=extract(await response.text(),url),contract=page.sourceForms.find(f=>f.provider==='wpforms');assert.ok(contract);assert.equal(contract.fields.length,8);
const confirm=contract.fields.find(f=>f.matchesFieldIndex!==undefined);assert.ok(confirm);assert.equal(contract.fields.filter(f=>f.requiredGroup).length,2);
const $=load('<html><head></head><body>'+page.content+'</body></html>');contract.delivery={endpoint:'/deliver',format:'multipart'};assert.equal(applyForms($,page,[contract])[0].status,'configured');applyComponents($);
const browser=await chromium.launch({channel:'chrome'});try{
 const tab=await browser.newPage();let posts=0;
 await tab.route('**/*',async route=>{if(route.request().url()==='https://fixture.test/deliver'){posts++;assert.doesNotMatch(route.request().postData(),/nonce|wpforms\[token\]|wpforms\[id\]/);await route.fulfill({contentType:'application/json',body:'{"ok":true}'});}else if(route.request().url()==='https://fixture.test/request/')await route.fulfill({contentType:'text/html',body:$.html()});else await route.abort();});
 await tab.goto('https://fixture.test/request/');const field=f=>tab.locator('[data-migration-field-index="'+f.sourceIndex+'"]'),valid=()=>tab.locator('form.wpforms-form').evaluate(f=>f.checkValidity());
 for(const f of contract.fields){if(f.type==='text')await field(f).fill('Fixture');if(f.type==='email')await field(f).fill('fixture@example.test');if(f.type==='textarea')await field(f).fill('Fixture request');if(f.type==='select')await field(f).selectOption('North');}
 assert.equal(await valid(),false);await field(contract.fields.find(f=>f.requiredGroup)).check();assert.equal(await valid(),true);
 await field(confirm).fill('different@example.test');assert.equal(await valid(),false);await field(confirm).fill('fixture@example.test');assert.equal(await valid(),true);
 await tab.locator('form.wpforms-form button[type=submit]').click();await tab.waitForFunction(()=>document.querySelector('form.wpforms-form [role=status]')?.textContent.includes('accepted'));assert.equal(posts,1);
 console.log(JSON.stringify({provider:'wpforms',version:'2.0.3',sourceHTTP:200,fields:8,requiredCheckboxGroup:true,emailConfirmation:true,interceptedSubmissions:posts,sourceSubmissions:0,aiCalls:0,scope:'Installed Lite public markup through extraction and configured browser delivery',limitations:['Pro conditional logic, multistep and uploads not verified','Full clone, visual comparison and held-out configurations pending']}));
}finally{await browser.close();}
