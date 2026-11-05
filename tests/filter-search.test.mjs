import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';import {chromium} from 'playwright';import {applyComponents} from '../scripts/component-export.mjs';import {extract} from '../engine/extract.mjs';
const fixture=(total=2)=>`<main><div class="eael-filter-gallery-wrapper"><button id="fg-filter-trigger"><span>All</span></button><ul class="fg-layout-3-filter-controls"><li data-filter="*" class="active">All</li><li data-filter=".wood">Wood</li></ul><form class="fg-layout-3-search-box" action="https://example.com/submit"><input name="fg-frontend-search"></form><div class="eael-filter-gallery-container eael-filter-gallery-grid" data-total-gallery-items="${total}"><div class="eael-filterable-gallery-item-wrap wood" data-search-categories="Furniture">Oak chair</div><div class="eael-filterable-gallery-item-wrap light" data-search-categories="Lighting">Lamp [brass]</div></div><div id="eael-fg-no-items-found" style="display:none">No Items Found</div></div></main>`;
test('only complete captured gallery search avoids a delivery contract',()=>{
 const page=extract(fixture(),'https://example.com/gallery/');assert.equal(page.sourceForms.length,0);assert.ok(!page.dynamic.some(x=>x.includes('Form submission')));
 assert.equal(extract(fixture().replace('.wood','[bad]'),'https://example.com/gallery/').sourceForms.length,1);
 const partial=extract(fixture(3),'https://example.com/gallery/');assert.equal(partial.sourceForms.length,1);assert.ok(partial.dynamic.some(x=>x.includes('Form submission')));
});
test('local gallery search combines categories, handles literal punctuation and prevents submission',async()=>{
 const $=load('<html><head></head><body>'+fixture()+'</body></html>');applyComponents($);const browser=await chromium.launch({channel:'chrome'});try{
  const page=await browser.newPage();await page.setContent($.html());const input=page.locator('[data-migration-filter-search]'),items=page.locator('[data-migration-filter-item]'),empty=page.locator('[data-migration-filter-empty]');
  const toggle=page.locator('[data-migration-filter-toggle]');await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');await toggle.press('Escape');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await input.fill('FURNITURE');assert.deepEqual(await items.evaluateAll(es=>es.filter(e=>!e.hidden).map(e=>e.textContent)),['Oak chair']);
  await input.fill('[brass]');assert.equal(await items.nth(1).isVisible(),true);await page.locator('[data-filter]').nth(1).click();assert.equal(await empty.isVisible(),true);assert.equal(await items.evaluateAll(es=>es.filter(e=>e.inert).length),2);
  await input.fill('');assert.equal(await items.first().isVisible(),true);assert.equal(await empty.isVisible(),false);await input.press('Enter');assert.equal(page.url(),'about:blank');
 }finally{await browser.close();}
});

test('saved gallery presentation drops the obsolete delivery contract and advisory',async()=>{
 const {refreshPresentation}=await import('../engine/presentation.mjs');const page=extract(fixture(),'https://example.com/gallery/');page.sourceForms=[{id:'legacy',fields:[]}];page.dynamic=['WordPress AJAX','Form submission needs a replacement service; appearance retained with disabled controls'];refreshPresentation(page,fixture());assert.equal(page.sourceForms.length,0);assert.deepEqual(page.dynamic,['WordPress AJAX']);assert.doesNotMatch(page.content,/data-migration-form-disabled/);
});
