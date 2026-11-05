import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';import {chromium} from 'playwright';
import {applyComponents} from '../scripts/component-export.mjs';import {semanticExport} from '../scripts/semantic-export.mjs';
const tabs=(id='ea',inner='Second body',classes='eael-tab-auto-active eael-tab-toggle')=>`<div class="eael-advance-tabs ${classes}" id="${id}"><div class="eael-tabs-nav"><ul role="tablist"><li id="${id}-one" class="eael-tab-item-trigger active-default" role="tab" aria-controls="${id}-one-tab">First</li><li id="${id}-two" class="eael-tab-item-trigger" role="tab" aria-controls="${id}-two-tab">Second</li></ul></div><div class="eael-tabs-content"><div class="eael-tab-content-item active-default" id="${id}-one-tab">First body</div><div class="eael-tab-content-item" id="${id}-two-tab" style="display:grid">${inner}</div></div></div>`;
const faq=(id='faq',multiple=false,inner='Second answer')=>`<div class="wp-block-uagb-faq uagb-faq-layout-accordion uagb-faq-expand-first-true" data-faqtoggle="${!multiple}" id="${id}"><div class="uagb-faq-child__outer-wrap"><div class="uagb-faq-item" id="${id}-one"><div class="uagb-faq-questions-button"><span>First question</span><span class="uagb-icon-active">-</span><span class="uagb-icon">+</span></div><div class="uagb-faq-content"><a href="#answer">First answer</a></div></div></div><div class="uagb-faq-child__outer-wrap uagb-faq-item" id="${id}-two"><div class="uagb-faq-questions-button">Second question<span class="uagb-icon-active">-</span><span class="uagb-icon">+</span></div><div class="uagb-faq-content" style="display:grid">${inner}</div></div></div>`;
function compile(body){const $=load(`<html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'"><style>.eael-tab-content-item:not(.active),.uagb-faq-content{display:none}.uagb-icon-active{display:none}.uagb-faq-item-active>.uagb-faq-questions-button .uagb-icon-active{display:inline}.uagb-faq-item-active>.uagb-faq-questions-button .uagb-icon{display:none}</style></head><body>${body}</body></html>`);semanticExport($);const selected=applyComponents($);return {html:$.html(),selected};}
test('addon normalization selects existing runtimes, keeps markup and supplies unique accessible relationships',()=>{
 const {html,selected}=compile(tabs()+faq());assert.deepEqual(selected.map(s=>s.id),['tabs','accordion']);const $=load(html);assert.equal($('.eael-tab-content-item').length,2);assert.equal($('.uagb-faq-item').length,2);
 for(const node of $('.uagb-faq-questions-button')){const control=$(node),panel=$('[id]').filter((_,p)=>$(p).attr('id')===control.attr('aria-controls'));assert.equal(panel.length,1);assert.equal(panel.attr('aria-labelledby'),control.attr('id'));}
 assert.equal(compile('<div class="wp-block-uagb-faq"><div class="uagb-faq-content">Grid answer</div></div>').selected.length,0);
});
test('Essential Addons tabs preserve active classes, collapse mode, geometry and mobile keyboard operation',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{for(const width of [1440,390]){const page=await browser.newPage({reducedMotion:'reduce',viewport:{width,height:900}});await page.setContent(compile(tabs()).html);
 const controls=page.locator('.eael-tab-item-trigger');await controls.nth(1).click();assert.equal(await page.locator('#ea-two-tab').isVisible(),true);assert.equal(await page.locator('#ea-two-tab').evaluate(el=>getComputedStyle(el).display),'grid');assert.match(await controls.nth(1).getAttribute('class'),/active/);
 await controls.nth(1).press('Space');assert.equal(await page.locator('#ea-two-tab').isVisible(),false);assert.equal(await controls.first().getAttribute('tabindex'),'0');await controls.first().press('End');assert.equal(await page.locator('#ea-two-tab').isVisible(),true);assert.equal(await page.locator('#ea-one-tab').evaluate(el=>el.inert),true);await page.close();}}
 finally{await browser.close();}
});
test('Spectra FAQ supports both wrapper structures, exclusive/multiple states, icons and keyboard without affecting inner groups',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({reducedMotion:'reduce',viewport:{width:390,height:900}});await page.setContent(compile(faq('outer',false,faq('inner',true))).html);
 const outer=page.locator('#outer'),titles=outer.locator(':scope > .uagb-faq-child__outer-wrap > .uagb-faq-questions-button, :scope > .uagb-faq-child__outer-wrap > .uagb-faq-item > .uagb-faq-questions-button');
 assert.equal(await page.locator('#outer-one > .uagb-faq-content').isVisible(),true);await titles.nth(1).click();assert.equal(await page.locator('#outer-one > .uagb-faq-content').isVisible(),false);assert.equal(await page.locator('#outer-two > .uagb-faq-content').isVisible(),true);assert.equal(await page.locator('#outer-two > .uagb-faq-questions-button .uagb-icon-active').isVisible(),true);
 await page.locator('#inner-two > .uagb-faq-questions-button').press('Enter');assert.equal(await page.locator('#inner-one > .uagb-faq-content').isVisible(),true);assert.equal(await page.locator('#inner-two > .uagb-faq-content').isVisible(),true);assert.equal(await page.locator('#outer-two > .uagb-faq-content').isVisible(),true);
 await titles.nth(1).press('Home');assert.equal(await titles.first().evaluate(el=>el===document.activeElement),true);await titles.first().press('Enter');assert.equal(await page.locator('#outer-two > .uagb-faq-content').isVisible(),false);
 }finally{await browser.close();}
});
test('initial and changed URL fragments reveal nested tab and accordion panels safely',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({reducedMotion:'reduce'});const {html}=compile(tabs('ea',faq('deep')));await page.route('https://fixture.test/**',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto('https://fixture.test/#deep-two');assert.equal(await page.locator('#ea-two-tab').isVisible(),true);assert.equal(await page.locator('#deep-two > .uagb-faq-content').isVisible(),true);
 await page.evaluate(()=>location.hash='ea-one');await page.waitForFunction(()=>document.querySelector('#ea-one-tab').hidden===false);assert.equal(await page.locator('#ea-two-tab').isVisible(),false);await page.evaluate(()=>location.hash='%E0%A4%A');await page.waitForTimeout(50);assert.equal(await page.locator('#ea-one-tab').isVisible(),true);
 }finally{await browser.close();}
});
test('Essential Addons without an active default can start fully collapsed and source ready flags cannot suppress initialization',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({reducedMotion:'reduce'});const html=compile(tabs('idle','Body','').replaceAll('active-default','').replace('id="idle"','id="idle" data-migration-tabs-ready="true"')).html;await page.setContent(html);assert.equal(await page.locator('[role=tabpanel]:visible').count(),0);await page.locator('#idle-one').press('Enter');assert.equal(await page.locator('#idle-one-tab').isVisible(),true);}finally{await browser.close();}
});
test('standalone SSG export initializes addon components after shared-template compilation',{timeout:60000},async()=>{
 const {mkdtemp,readFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),path=await import('node:path'),{extract}=await import('../engine/extract.mjs'),{generate}=await import('../engine/generate.mjs'),{run}=await import('../engine/pipeline.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'addon-native-'));let browser;try{
  const p=extract('<html><head><title>Components</title></head><body><main><h1>Components</h1>'+tabs()+faq()+'</main></body></html>','https://fixture.test/');p.styles=[];
  await generate({source:p.url,identity:{title:'Components'},navigation:[],design:{},metrics:{},media:[],pages:[p]},dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:45000});
  const html=await readFile(path.join(dir,'output/index.html'),'utf8');browser=await chromium.launch({channel:'chrome'});const page=await browser.newPage({reducedMotion:'reduce'});await page.route('https://fixture.test/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('https://fixture.test/');await page.locator('#ea-two').click();assert.equal(await page.locator('#ea-two-tab').isVisible(),true);await page.locator('#faq-two .uagb-faq-questions-button').click();assert.equal(await page.locator('#faq-two .uagb-faq-content').isVisible(),true);assert.equal(await page.locator('#faq-one .uagb-faq-content').isVisible(),false);
  const report=JSON.parse(await readFile(path.join(dir,'component-runtime-report.json'),'utf8'));assert.deepEqual(report.pages[0].selected.map(s=>s.id),['tabs','accordion']);
 }finally{if(browser)await browser.close();await rm(dir,{recursive:true,force:true});}
});
test('mixed nesting keeps Elementor tab controls out of the surrounding accordion adapter',async()=>{
 const inner='<div class="elementor-tabs"><div role="tablist"><div class="elementor-tab-title elementor-active" role="tab" aria-controls="mixed-one">Tab one</div><div class="elementor-tab-title" role="tab" aria-controls="mixed-two">Tab two</div></div><div class="elementor-tab-content" role="tabpanel" id="mixed-one">One</div><div class="elementor-tab-content" role="tabpanel" id="mixed-two">Two</div></div>';
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({reducedMotion:'reduce'});await page.setContent(compile(faq('parent',false,inner)).html);await page.locator('#parent-two>.uagb-faq-questions-button').click();await page.getByRole('tab',{name:'Tab two'}).click();assert.equal(await page.locator('#mixed-two').isVisible(),true);assert.equal(await page.locator('#parent-two>.uagb-faq-content').isVisible(),true);assert.equal(await page.getByRole('tab',{name:'Tab two'}).getAttribute('aria-expanded'),null);}finally{await browser.close();}
});
test('fragment navigation scrolls revealed content into view across nested component families',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({reducedMotion:'reduce',viewport:{width:390,height:700},reducedMotion:'reduce'});
 const disclosure='<div data-migration-details="single"><details><summary>First details</summary><p>Other content</p></details><details><summary>Second details</summary><p id="deep-anchor">Linked destination</p></details></div>';
 const html=compile('<div style="height:1800px">Before</div>'+tabs('jump',faq('faqjump',false,disclosure))+'<div style="height:1000px">After</div>').html;
 await page.route('https://fixture.test/**',route=>route.fulfill({contentType:'text/html',body:html}));await page.goto('https://fixture.test/#deep-anchor');
 await page.waitForFunction(()=>{const el=document.getElementById('deep-anchor'),r=el.getBoundingClientRect();return r.height>0&&r.top>=0&&r.bottom<=innerHeight;},{},{timeout:3000});
 assert.equal(await page.locator('#deep-anchor').evaluate(el=>el.closest('details').open),true);assert.equal(await page.locator('#faqjump-one>.uagb-faq-content').isVisible(),false);
 for(let round=0;round<4;round++){
 await page.evaluate(()=>{location.hash='jump-one';});await page.waitForFunction(()=>document.getElementById('jump-one-tab').hidden===false);await page.evaluate(()=>{scrollTo(0,0);location.hash='deep-anchor';});
 await page.waitForFunction(()=>{const r=document.getElementById('deep-anchor').getBoundingClientRect();return r.height>0&&r.top>=0&&r.bottom<=innerHeight;},{},{timeout:3000});
 }
 }finally{await browser.close();}
});
test('accordion motion follows declared timing, reverses safely and honors reduced motion',async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try {
  const page=await browser.newPage({viewport:{width:390,height:900},reducedMotion:'no-preference'});
  await page.setContent(compile(faq().replace('style="display:grid"','')).html);
  await page.addStyleTag({content:'.uagb-faq-content{display:flex;padding:20px}'});
  const controls=page.locator('.uagb-faq-questions-button'),panel=page.locator('#faq-two > .uagb-faq-content');
  await controls.nth(1).click();
  const during=await panel.evaluate(e=>{const a=e.getAnimations()[0];a.pause();a.currentTime=250;return {duration:a.effect.getTiming().duration,height:e.getBoundingClientRect().height,frames:a.effect.getKeyframes(),hidden:e.hidden,inert:e.inert};});
  assert.equal(during.duration,500);assert.equal(during.hidden,false);assert.equal(during.inert,false);assert.ok(during.height>0);assert.equal(during.frames[0].height,'0px');assert.notEqual(during.frames[1].height,'0px');
  await controls.nth(1).click();assert.equal(await panel.getAttribute('aria-hidden'),'true');
  assert.equal(await panel.evaluate(e=>getComputedStyle(e).display),'flex');
  await controls.nth(1).click();await panel.evaluate(async e=>{const a=e.getAnimations()[0];a.finish();await a.finished;});
  assert.equal(await panel.isVisible(),true);assert.equal(await panel.evaluate(e=>e.getAnimations().length),0);assert.equal(await panel.evaluate(e=>e.style.overflow),'');
  await controls.nth(1).click();await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>{const p=document.querySelector('#faq-two > .uagb-faq-content');return p.hidden&&p.getAnimations().length===0;},{},{timeout:3000});
  assert.equal(await panel.isVisible(),false);assert.equal(await panel.evaluate(e=>e.getAnimations().length),0);
  await controls.nth(1).click();assert.equal(await panel.isVisible(),true);assert.equal(await panel.evaluate(e=>e.getAnimations().length),0);
 }finally{await browser.close();}
});
