import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';import {chromium} from 'playwright';import {applyComponents} from '../scripts/component-export.mjs';
const fixture=(id='gallery',total=4,layout='eael-filter-gallery-grid')=>`<div class="eael-filter-gallery-wrapper" id="${id}"><ul><li data-filter="*" class="active">All</li><li data-filter=".group-a">A</li><li data-filter=".group-b">B</li></ul><div class="eael-filter-gallery-container ${layout}" data-total-gallery-items="${total}" data-gallery-items="unused-source-data" style="position:relative;height:800px">${['a','b','a','b'].map((group,i)=>`<div class="eael-filterable-gallery-item-wrap group-${group}" style="position:absolute;left:300px;top:600px"><a href="#${id}-${i}">Item ${i}</a></div>`).join('')}</div></div>`;
function compile(body){const $=load(`<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'"><style>body{margin:0}.eael-filter-gallery-container{width:900px;max-width:100%}.eael-filterable-gallery-item-wrap{width:33.333333%;height:40px}@media(max-width:500px){.eael-filterable-gallery-item-wrap{width:100%}}</style></head><body>${body}</body></html>`);const selected=applyComponents($);return {html:$.html(),selected};}
test('filter adapter only claims fully captured supported grids',()=>{
 const result=compile(fixture());assert.deepEqual(result.selected.map(c=>c.id),['filter-grid']);assert.equal(load(result.html)('[data-gallery-items]').length,0);
 for(const html of [fixture('partial',5),fixture('unsupported',4,'unsupported-layout'),fixture().replace('.group-a','[onclick]')])assert.equal(compile(html).selected.length,0);
});
test('shared filter grid preserves responsive flow, group isolation and keyboard access',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{for(const width of [1200,390]){
  const page=await browser.newPage({viewport:{width,height:900}});await page.setContent(compile((fixture()+fixture('other')).replaceAll('group-a','bois-éclair')).html);
  const root=page.locator('#gallery'),items=root.locator('[data-migration-filter-item]'),controls=root.locator('[data-filter]'),container=root.locator('[data-migration-filter-items]');
  assert.equal(await container.evaluate(e=>e.getBoundingClientRect().height),width===390?160:80);
  await controls.nth(1).click();assert.equal(await items.evaluateAll(es=>es.filter(e=>!e.hidden).length),2);assert.equal(await items.nth(1).evaluate(e=>e.inert),true);assert.equal(await container.evaluate(e=>e.getBoundingClientRect().height),width===390?80:40);
  assert.equal(await page.locator('#other [data-migration-filter-item]').evaluateAll(es=>es.filter(e=>!e.hidden).length),4);
  await controls.nth(1).press('End');await controls.nth(2).press('Space');assert.equal(await controls.nth(2).getAttribute('aria-pressed'),'true');assert.equal(await items.nth(1).isVisible(),true);
  await controls.nth(2).press('Home');await controls.first().press('Enter');assert.equal(await items.evaluateAll(es=>es.filter(e=>!e.hidden).length),4);
  if(width===1200){await items.evaluateAll(es=>es.forEach((e,i)=>{e.style.height='auto';e.innerHTML='<div style="height:'+([20,60,30,40][i])+'px"></div>';}));assert.deepEqual(await items.evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height)),[20,60,30,40]);assert.equal(await container.evaluate(e=>e.getBoundingClientRect().height),100);}
  await page.close();
 }}finally{await browser.close();}
});
test('masonry uses shortest columns and reflows on filtering, resizing and content changes',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{for(const direction of ['ltr','rtl']){
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  await page.setContent(compile(fixture('gallery',4,'masonry')).html);
  const items=page.locator('[data-migration-filter-item]'),container=page.locator('[data-migration-filter-items]');
  await container.evaluate((e,d)=>e.style.direction=d,direction);await items.evaluateAll(es=>es.forEach((e,i)=>e.style.height=[20,60,30,40][i]+'px'));
  await page.waitForFunction(()=>document.querySelectorAll('[data-migration-filter-item]')[3].style.top==='20px');
  assert.equal(await container.evaluate(e=>e.getBoundingClientRect().height),60);
  const positions=await items.evaluateAll(es=>es.map(e=>({x:e.offsetLeft,y:e.offsetTop})));
  assert.equal(positions[3].x,positions[0].x);assert.equal(positions[3].y,20);assert.equal(positions[1].y,0);assert.ok(direction==='rtl'?positions[0].x>positions[1].x:positions[0].x<positions[1].x);
  await page.locator('[data-filter]').nth(1).click();assert.equal(await container.evaluate(e=>e.getBoundingClientRect().height),30);
  await page.setViewportSize({width:390,height:900});await page.waitForFunction(()=>document.querySelector('[data-migration-filter-items]').getBoundingClientRect().height===50);
  await page.locator('[data-filter]').first().click();assert.equal(await container.evaluate(e=>e.getBoundingClientRect().height),150);
  await items.first().evaluate(e=>e.style.height='70px');await page.waitForFunction(()=>document.querySelector('[data-migration-filter-items]').getBoundingClientRect().height===200);
  await page.close();
 }}finally{await browser.close();}
});
test('masonry encloses margins and padding with either CSS box model, including empty filters',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{for(const boxSizing of ['border-box','content-box']){
  const page=await browser.newPage({viewport:{width:1200,height:900}});
  const markup=fixture('gallery',4,'masonry').replace('</ul>','<li data-filter=".empty">Empty</li></ul>');
  await page.setContent(compile(markup).html);
  const container=page.locator('[data-migration-filter-items]'),items=page.locator('[data-migration-filter-item]');
  await container.evaluate((e,box)=>{Object.assign(e.style,{boxSizing:box,width:box==='border-box'?'944px':'900px',padding:'20px 20px 30px',border:'2px solid'});},boxSizing);
  await items.evaluateAll(es=>es.forEach((e,i)=>Object.assign(e.style,{width:'280px',height:[20,60,30,40][i]+'px',margin:'10px'})));
  await page.waitForFunction(()=>document.querySelector('[data-migration-filter-items]').getBoundingClientRect().height===154);
  assert.deepEqual(await items.evaluateAll(es=>es.map(e=>e.offsetTop)),[30,30,30,70]);
  await page.locator('[data-filter]').last().click();assert.equal(await container.evaluate(e=>e.getBoundingClientRect().height),54);assert.equal(await items.evaluateAll(es=>es.filter(e=>e.inert).length),4);
  await page.locator('[data-filter]').first().click();assert.equal(await container.evaluate(e=>e.getBoundingClientRect().height),154);
  await page.close();
 }}finally{await browser.close();}
});
test('masonry reserves consecutive columns for wider cards',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{
  const page=await browser.newPage({viewport:{width:1200,height:900}});await page.setContent(compile(fixture('gallery',4,'masonry')).html);
  const items=page.locator('[data-migration-filter-item]');await items.evaluateAll(es=>es.forEach((e,i)=>Object.assign(e.style,{width:i===1?'600px':'300px',height:[20,60,30,40][i]+'px'})));
  await page.waitForFunction(()=>document.querySelector('[data-migration-filter-items]').getBoundingClientRect().height===90);
  assert.deepEqual(await items.evaluateAll(es=>es.map(e=>[e.offsetLeft,e.offsetTop])),[[0,0],[300,0],[0,20],[0,50]]);
  await page.locator('[data-filter]').nth(1).click();assert.deepEqual(await items.evaluateAll(es=>es.filter(e=>!e.hidden).map(e=>[e.offsetLeft,e.offsetTop])),[[0,0],[300,0]]);
 }finally{await browser.close();}
});
