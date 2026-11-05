import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {chromium} from 'playwright';
import {semanticExport} from '../scripts/semantic-export.mjs';
import {navigationRuntime} from '../engine/navigation.mjs';
import {applyComponents} from '../scripts/component-export.mjs';

function compile(body,policy="default-src 'none'; style-src 'unsafe-inline'; script-src 'none'"){
 const $=load(`<html><head><meta http-equiv="Content-Security-Policy" content="${policy}"></head><body>${body}</body></html>`);
 semanticExport($);const applied=applyComponents($);return {html:$.html(),applied};
}
const legacyTabs=`<style>.elementor-tab-content{display:none}.elementor-tab-mobile-title{display:none}@media(max-width:500px){.elementor-tab-desktop-title{display:none}.elementor-tab-mobile-title{display:block}}</style>
<div class="elementor-tabs"><div role="tablist"><div class="elementor-tab-title elementor-tab-desktop-title elementor-active" role="tab" data-tab="1" aria-controls="panel-1">One</div><div class="elementor-tab-title elementor-tab-desktop-title" role="tab" data-tab="2" aria-controls="panel-2">Two</div></div>
<div><div class="elementor-tab-title elementor-tab-mobile-title" data-tab="1">One mobile</div><div id="panel-1" class="elementor-tab-content" data-tab="1">First</div><div class="elementor-tab-title elementor-tab-mobile-title" data-tab="2">Two mobile</div><div id="panel-2" class="elementor-tab-content" data-tab="2" style="display:grid" aria-hidden="true"><a href="#">Second</a></div></div></div>`;
const accordion=`<div class="elementor-accordion"><div class="elementor-accordion-item"><div class="elementor-tab-title elementor-active" aria-expanded="true" aria-controls="a-one"><a href="#">Question one</a></div><div id="a-one" class="elementor-tab-content">Answer one</div></div><div class="elementor-accordion-item"><div class="elementor-tab-title" aria-expanded="false" aria-controls="a-two">Question two</div><div id="a-two" class="elementor-tab-content" style="display:none">Answer two</div></div></div>`;

test('unused adapters add zero scripts; selected CSP hashes are exact and not unsafe-inline',()=>{
 assert.equal(compile('<p>Plain content</p>').applied.length,0);
 assert.equal(load(compile('<p>Plain content</p>').html)('script').length,0);
 const {html,applied}=compile(legacyTabs);assert.deepEqual(applied.map(a=>a.id),['tabs']);
 const $=load(html),policy=$('meta').attr('content');assert.ok(policy.includes(applied[0].hash));assert.ok(!/script-src[^;]*unsafe-inline/.test(policy));assert.ok(!/script-src[^;]*'none'/.test(policy));
 applyComponents($);assert.equal($('script[data-cloner-component]').length,1);
});
test('script-src-elem receives hashes too',()=>{
 const {html,applied}=compile(accordion,"default-src 'none'; script-src 'none'; script-src-elem 'none'");
 const policy=load(html)('meta').attr('content');assert.equal(policy.split(applied[0].hash).length,3);
});
test('legacy Elementor tabs work under CSP on desktop and mobile, with synchronized titles and native geometry',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{
 for(const width of [1440,390]){
  const p=await browser.newPage({viewport:{width,height:900}});
  await p.setContent(compile(legacyTabs).html);
  const controls=p.locator(width===390?'.elementor-tab-mobile-title':'.elementor-tab-desktop-title');
  assert.equal(await p.locator('#panel-1').isVisible(),true);assert.equal(await p.locator('#panel-2').isVisible(),false);
  await controls.nth(1).click();assert.equal(await p.locator('#panel-2').isVisible(),true);assert.equal(await p.locator('#panel-1').isVisible(),false);
  assert.equal(await p.locator('#panel-2').evaluate(e=>getComputedStyle(e).display),'grid');
  assert.equal(await p.locator('#panel-2').getAttribute('aria-hidden'),'false');
  assert.equal(await p.locator('#panel-2 a').getAttribute('tabindex'),null);
  assert.equal(await p.locator('[data-tab="2"][role=tab][aria-selected=true]').count(),2);
  await controls.nth(1).press('Home');assert.equal(await p.locator('#panel-1').isVisible(),true);
  await controls.first().press('ArrowRight');assert.equal(await p.locator('#panel-2').isVisible(),true);
  assert.equal(await p.locator('#panel-1').evaluate(e=>e.inert),true);await p.close();
 }
 }finally{await browser.close();}
});
test('accordion handles exclusive expansion, collapse, keyboard focus and no double native button activation',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const p=await browser.newPage();await p.setContent(compile(accordion).html);
 const titles=p.locator('.elementor-tab-title');await titles.nth(1).click();assert.equal(await p.locator('#a-one').isVisible(),false);assert.equal(await p.locator('#a-two').isVisible(),true);
 await titles.nth(1).press('Space');assert.equal(await p.locator('#a-two').isVisible(),false);
 await titles.nth(1).press('Home');assert.equal(await titles.first().evaluate(e=>e===document.activeElement),true);
 await titles.first().press('Enter');assert.equal(await p.locator('#a-one').isVisible(),true);
 await p.setContent(compile('<div data-migration-accordion="multiple"><button aria-controls="one" aria-expanded="false">First</button><div id="one">Answer</div><button aria-controls="two" aria-expanded="true">Second</button><div id="two">Other</div></div>').html);
 await p.locator('button').first().press('Enter');assert.equal(await p.locator('#one').isVisible(),true);assert.equal(await p.locator('#two').isVisible(),true);
 }finally{await browser.close();}
});
test('nested generic tabs are independent and native details need no adapter',async()=>{
 const fixture='<div data-migration-tabs><div role="tablist"><button role="tab" aria-controls="outer-one">First</button><button role="tab" aria-controls="outer-two">Second</button></div><div role="tabpanel" id="outer-one"><div data-migration-tabs><div role="tablist"><button role="tab" aria-controls="inner-one">Inner first</button><button role="tab" aria-controls="inner-two">Inner second</button></div><div role="tabpanel" id="inner-one">Alpha</div><div role="tabpanel" id="inner-two">Beta</div></div></div><div role="tabpanel" id="outer-two">Other</div></div>';
 const browser=await chromium.launch({channel:'chrome'});try{const p=await browser.newPage();await p.setContent(compile(fixture).html);
 await p.getByRole('tab',{name:'Inner second',exact:true}).click();assert.equal(await p.locator('#inner-two').isVisible(),true);assert.equal(await p.locator('#outer-one').isVisible(),true);
 await p.getByRole('tab',{name:'Second',exact:true}).click();assert.equal(await p.locator('#outer-two').isVisible(),true);assert.equal(await p.locator('#outer-one').isVisible(),false);
 }finally{await browser.close();}
 assert.equal(compile('<details><summary>Question</summary>Answer</details>').applied.length,0);
});

test('carousel and truncation no longer inflate every navigation script',()=>{
 assert.ok(!navigationRuntime.includes('swiper-slide-duplicate'));
 assert.ok(!navigationRuntime.includes('data-migration-truncate-content'));
 const carousel=compile('<div class="elementor-main-swiper"></div>');
 assert.deepEqual(carousel.applied.map(a=>a.id),['carousel']);
 const truncation=compile('<span data-migration-truncate-lines="2">Text</span>');
 assert.deepEqual(truncation.applied.map(a=>a.id),['truncation']);
 assert.ok(carousel.applied[0].bytes>0);assert.ok(truncation.applied[0].bytes>0);
});

test('classic uninitialized accordion opens first panel while toggle and explicit closed defaults remain closed',async()=>{
 const raw=accordion.replace('elementor-tab-title elementor-active','elementor-tab-title').replace('aria-expanded="true"','aria-expanded="false"');
 const browser=await chromium.launch({channel:'chrome'});try{for(const [html,open]of[[raw,true],[raw.replace('class="elementor-accordion"','class="elementor-toggle"'),false],[raw.replace('class="elementor-accordion"','class="elementor-accordion" data-migration-accordion-initial="closed"'),false]]){const p=await browser.newPage();await p.setContent(compile(html).html);assert.equal(await p.locator('#a-one').isVisible(),open);assert.equal(await p.locator('#a-two').isVisible(),false);await p.close();}}finally{await browser.close();}
});

test('native details groups preserve single/multiple modes, nested isolation and keyboard activation',async()=>{
 const group=(id,mode)=>`<div id="${id}" data-migration-details="${mode}"><details open><summary>First</summary><p>One</p></details><details><summary>Second</summary><p>Two</p></details></div>`;
 const fixture=group('single','single')+group('multiple','multiple')+`<div data-settings='{"max_items_expended":"multiple"}'><div class="e-n-accordion"><details><summary>Plugin</summary>Content</details></div></div>`;
 const compiled=compile(fixture);assert.deepEqual(compiled.applied.map(a=>a.id),['details']);assert.equal(load(compiled.html)('.e-n-accordion').attr('data-migration-details'),'multiple');
 const browser=await chromium.launch({channel:'chrome'});try{
  const page=await browser.newPage();await page.setContent(compiled.html);
  await page.locator('#single summary').nth(1).click();await page.waitForTimeout(50);
  assert.equal(await page.locator('#single details').first().evaluate(e=>e.open),false);
  assert.equal(await page.locator('#single summary').nth(1).getAttribute('aria-expanded'),'true');
  await page.locator('#single summary').nth(1).press('Home');assert.equal(await page.locator('#single summary').first().evaluate(e=>e===document.activeElement),true);
  await page.locator('#single summary').first().press('Enter');await page.waitForTimeout(50);
  assert.equal(await page.locator('#single details').first().evaluate(e=>e.open),true);assert.equal(await page.locator('#single details').nth(1).evaluate(e=>e.open),false);
  await page.locator('#multiple summary').nth(1).click();await page.waitForTimeout(50);assert.equal(await page.locator('#multiple details[open]').count(),2);
  await page.setContent(compile(`<div data-migration-details="single"><details open><summary>Outer</summary>${group('inner','single')}</details><details><summary>Other</summary>Other</details></div>`).html);
  await page.locator('#inner summary').nth(1).click();await page.waitForTimeout(50);assert.equal(await page.locator('#inner').evaluate(e=>e.parentElement.open),true);assert.equal(await page.locator('#inner details[open]').count(),1);
 }finally{await browser.close();}
});
