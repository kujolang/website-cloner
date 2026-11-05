import assert from 'node:assert/strict';
import path from 'node:path';
import {writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {serveStatic} from '../../engine/static.mjs';
import {stableScreenshot} from '../../engine/capture-stability.mjs';
import {visualScore} from '../../engine/verify.mjs';
const root=path.resolve('artifacts/platform/woocommerce-complete');
let browser,server;
try{
 server=await serveStatic(path.join(root,'project/output'));browser=await chromium.launch({channel:'chrome'});
 const states=[];
 for(const kind of ['source','export']){
  const origin=kind==='source'?'http://127.0.0.1:9427':server.url;
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});const rejected=[];
  await page.route('**/*',r=>{if(r.request().method()!=='GET'||new URL(r.request().url()).origin!==origin){rejected.push({method:r.request().method(),url:r.request().url()});return r.abort();}return r.continue();});
  await page.goto(origin+'/product/workshop-shirt/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);
  const slide=page.locator('.woocommerce-product-gallery__image').first();await slide.scrollIntoViewIfNeeded();await slide.hover({position:{x:100,y:100}});
  await page.waitForFunction(()=>{const z=document.querySelector('.woocommerce-product-gallery__image .zoomImg');return z?.naturalWidth>0&&Number(getComputedStyle(z).opacity)===1;}).catch(async error=>{console.error(kind,await slide.evaluate(e=>({zoom:e.querySelector('.zoomImg')?.getAttribute('style'),hover:matchMedia('(hover: hover)').matches})));throw error;});
  const measurement=await slide.evaluate(e=>{const z=e.querySelector('.zoomImg'),r=e.getBoundingClientRect();return{width:r.width,height:r.height,zoomWidth:z.width,zoomHeight:z.height,left:parseFloat(z.style.left),top:parseFloat(z.style.top),hiddenFromAT:z.getAttribute('aria-hidden')};});
  assert.equal(measurement.width,600);assert.equal(measurement.zoomWidth,1200);assert.ok(Math.abs(measurement.left+100)<2);assert.ok(Math.abs(measurement.top+100)<2);
  const capture=await stableScreenshot(slide,{animations:'disabled'});await writeFile(path.join(root,`hover-${kind}.png`),capture.buffer);
  await page.mouse.move(1400,850);await page.waitForFunction(()=>{const z=document.querySelector('.woocommerce-product-gallery__image .zoomImg');return !z||Number(getComputedStyle(z).opacity)===0;});if(kind==='export')assert.equal(rejected.length,0,JSON.stringify(rejected));
  states.push({kind,measurement,captures:capture.captures,buffer:capture.buffer,rejectedRequests:rejected});await page.close();
 }
 const report={scope:'Installed WooCommerce 11.2.1 standard hover zoom, first product image at desktop, cached native rebuild; no custom zoom or touch parity claim',pixelSimilarity:visualScore(states[0].buffer,states[1].buffer),states:states.map(({buffer,...state})=>state)};
 await writeFile(path.join(root,'hover-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
}finally{await browser?.close();await server?.close();}
