import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {revealLazyContent,measure} from '../engine/capture.mjs';

test('lazy-content capture finishes at the top despite authored smooth scrolling', async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage({viewport:{width:800,height:600}});
  await page.setContent('<style>html{scroll-behavior:smooth}body{margin:0}header{position:sticky;top:0;height:60px}main{height:6000px}</style><header>Navigation</header><main>Content</main>');
  await page.evaluate(()=>scrollTo({top:4000,behavior:'instant'}));
  await revealLazyContent(page);
  assert.equal(await page.evaluate(()=>scrollY),0);
  assert.deepEqual((await measure(page)).scrollPosition,{x:0,y:0});
  await page.waitForTimeout(350);
  assert.equal(await page.evaluate(()=>scrollY),0,'no smooth-scroll animation may still be pending');
  assert.equal(await page.locator('header').evaluate(el=>el.getBoundingClientRect().top),0);
  assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).scrollBehavior),'smooth','preserve the authored scrolling style');
 }finally{await browser.close();}
});
