import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {waitForFonts} from '../engine/font-readiness.mjs';

test('font readiness waits for completion and bounds a permanently pending font set',async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage();await page.setContent('<main>Typography</main>');await waitForFonts(page);
  await page.evaluate(()=>Object.defineProperty(document.fonts,'ready',{configurable:true,get:()=>new Promise(resolve=>setTimeout(resolve,50))}));await waitForFonts(page,1000);
  await page.evaluate(()=>Object.defineProperty(document.fonts,'ready',{configurable:true,get:()=>new Promise(()=>{})}));
  await assert.rejects(waitForFonts(page,100),/Font readiness timed out.*visual evidence is incomplete/);
  assert.equal(await page.locator('main').textContent(),'Typography');
 }finally{await browser.close();}
});
