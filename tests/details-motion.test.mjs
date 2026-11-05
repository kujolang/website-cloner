import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';import{chromium}from'playwright';import{applyComponents}from'../scripts/component-export.mjs';
function html(duration){const $=load(`<html><body><div data-settings='{"max_items_expended":"one","n_accordion_animation_duration":{"size":${duration},"unit":"ms"}}'><div class="e-n-accordion"><details style="overflow:visible"><summary>One</summary><p style="height:100px">First</p></details><details><summary>Two</summary><p style="height:100px">Second</p></details></div></div></body></html>`);applyComponents($);return $.html();}
test('declared details transitions preserve timing, reverse safely, restore styles and respect reduced motion',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{
  const page=await browser.newPage({reducedMotion:'no-preference'});await page.setContent(html(400));
  const finish=()=>page.evaluate(async()=>{for(const item of document.querySelectorAll('details'))for(const animation of item.getAnimations()){animation.finish();await animation.finished;}});
  const active=await page.locator('details').first().evaluate(e=>{e.querySelector('summary').click();const a=e.getAnimations()[0];a.pause();a.currentTime=200;return {duration:a.effect.getTiming().duration,frames:a.effect.getKeyframes().map(f=>f.height),expanded:e.querySelector('summary').getAttribute('aria-expanded')};});
  assert.equal(active.duration,400);assert.notEqual(active.frames[0],active.frames[1]);assert.equal(active.expanded,'true');
  // Advance the browser timeline explicitly: background rendering can suspend
  // animation frames even while wall-clock timers and input keep progressing.
  await page.locator('summary').first().dispatchEvent('click');await finish();
  await page.waitForFunction(()=>!document.querySelector('details').open,{},{timeout:3000});assert.equal(await page.locator('details').first().evaluate(e=>e.style.overflow),'visible');
  await page.locator('summary').first().press('Enter');await finish();
  await page.waitForFunction(()=>{const e=document.querySelector('details');return e.open&&!e.getAnimations().length;},{},{timeout:3000});
  await page.locator('summary').nth(1).click();await finish();
  await page.waitForFunction(()=>{const [a,b]=document.querySelectorAll('details');return !a.open&&b.open&&!a.getAnimations().length&&!b.getAnimations().length;},{},{timeout:3000});
  await page.emulateMedia({reducedMotion:'reduce'});await page.locator('summary').first().click();
  await page.waitForFunction(()=>{const e=document.querySelector('details');return e.open&&!e.getAnimations().length;},{},{timeout:3000});
  await page.setContent(html(0));await page.locator('summary').first().click();assert.equal(await page.locator('details').first().evaluate(e=>e.open),true);assert.equal(await page.locator('details').first().evaluate(e=>e.getAnimations().length),0);
 }finally{await browser.close();}
});

test('changing reduced motion settles an in-flight details transition at its requested state',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{
  const page=await browser.newPage({reducedMotion:'no-preference'});await page.setContent(html(4000));
  const item=page.locator('details').first(),control=page.locator('summary').first();
  for(const open of [true,false]){
   await page.emulateMedia({reducedMotion:'no-preference'});await control.click();
   await item.evaluate(e=>{const a=e.getAnimations()[0];a.pause();a.currentTime=100;});
   await page.emulateMedia({reducedMotion:'reduce'});
   await page.waitForFunction(open=>{const e=document.querySelector('details');return e.open===open&&e.getAnimations().length===0;},open,{timeout:3000});
   assert.equal(await item.evaluate(e=>e.style.overflow),'visible');assert.equal(await item.evaluate(e=>e.style.height),'');assert.equal(await control.getAttribute('aria-expanded'),String(open));
  }
  await control.click();assert.equal(await item.evaluate(e=>e.open),true);assert.equal(await item.evaluate(e=>e.getAnimations().length),0);
 }finally{await browser.close();}
});
