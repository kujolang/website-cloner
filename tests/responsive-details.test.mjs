import test from 'node:test';import assert from 'node:assert/strict';import{readFile}from'node:fs/promises';import{chromium}from'playwright';
test('responsive details follow source media queries without resetting user toggles or ordinary FAQs',async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});try{
 const p=await b.newPage({viewport:{width:390,height:800}});
 await p.setContent('<style>summary{cursor:pointer}@media(min-width:1152px){.responsive>summary{cursor:text!important}}.ordinary>summary{cursor:text}</style><details class="responsive" open><summary>Products</summary><p>Links</p></details><details class="ordinary" open><summary>FAQ</summary><p>Answer</p></details><details class="responsive" data-migration-responsive-details="preserve" open><summary>Preserve</summary></details>');
 await p.addScriptTag({content:await readFile(new URL('../scripts/component-responsive-details.js',import.meta.url),'utf8')});
 const state=()=>p.locator('details').evaluateAll(es=>es.map(e=>e.open));assert.deepEqual(await state(),[false,true,true]);
 await p.locator('.responsive summary').first().click();assert.deepEqual(await state(),[true,true,true]);
 await p.setViewportSize({width:500,height:800});assert.equal((await state())[0],true,'same mobile range keeps user choice');
 await p.setViewportSize({width:1200,height:800});await p.waitForFunction(()=>getComputedStyle(document.querySelector('.responsive summary')).cursor==='text');assert.equal((await state())[0],true);
 await p.locator('.responsive summary').first().click();assert.equal((await state())[0],true,'static desktop heading cannot collapse');
 await p.setViewportSize({width:390,height:800});await p.waitForFunction(()=>!document.querySelector('.responsive').open);assert.equal((await state())[0],false);
 await p.locator('.responsive summary').first().focus();await p.keyboard.press('Enter');assert.equal((await state())[0],true,'native keyboard toggle remains available');
 }finally{await b.close();}
});

test('responsive adapter is selected only for open unmanaged details and receives a CSP hash',async()=>{
 const {load}=await import('cheerio/slim');const {applyComponents}=await import('../scripts/component-export.mjs');
 const $=load('<html><head><meta http-equiv="Content-Security-Policy" content="script-src &apos;none&apos;"></head><body><details open><summary>Products</summary>Links</details></body></html>');
 const applied=applyComponents($);assert.deepEqual(applied.map(a=>a.id),['responsive-details']);assert.equal($('script[data-cloner-component="responsive-details"]').length,1);assert.match($('meta').attr('content'),/sha256-/);
 const skipped=load('<body><details data-migration-responsive-details="preserve" open><summary>Keep</summary></details><details><summary>Native</summary></details></body>');assert.deepEqual(applyComponents(skipped),[]);
});
