import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';
import {extract} from '../engine/extract.mjs';
import {localize} from '../engine/assets.mjs';
import {captureGalleryItems} from '../engine/gallery-data.mjs';
import {load} from 'cheerio';

test('opaque MIME font responses require a known font signature',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'opaque-font-'));
 try{const page=extract('<html><head><style>@font-face{font-family:example;src:url(/font.woff2)}</style></head><body><main>Text</main></body></html>','https://example.test/');
 for(const valid of [true,false]){const model={source:page.url,pages:[structuredClone(page)],media:[],warnings:[],metrics:{}};await localize(model,{get:async()=>({status:200,headers:{'content-type':'binary/octet-stream'},body:Buffer.from(valid?'wOF2font-data':'<html>not-a-font</html>')})},dir);assert.equal(model.media.some(m=>m.path.endsWith('.woff2')),valid);if(!valid)assert.ok(model.warnings.length);}
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('known booking action becomes a public HTTPS link without copying executable handlers',()=>{
 const p=extract('<main><a onclick="HCPWidget.openModal()">Book</a><iframe src="https://book.housecallpro.com/book/Example/public-id"></iframe></main>','https://example.test/');assert.match(p.content,/href="https:\/\/book.housecallpro.com\/book\/Example\/public-id"/);assert.doesNotMatch(p.content,/onclick/);
 const bad=extract('<main><a onclick="HCPWidget.openModal()">Book</a><iframe src="https://evil.test/book/Example/public-id"></iframe></main>','https://example.test/');assert.doesNotMatch(bad.content,/href="https:\/\/evil/);
});
test('hydrated hosted galleries keep card order and adapt columns without a fixed desktop canvas',async()=>{
 const $=load('<body class="dmDesktopBody"><div id="dm"><div class="dmInner"><div class="dmPhotoGallery" data-desktop-columns="3" data-mobile-columns="2"><div class="layout-container"><div class="photogallery-row"><div class="photogallery-column">'+[1,2,3,4].map(n=>`<div class="photoGalleryThumbs">Card ${n}</div>`).join('')+'</div></div></div></div></div></div></body>');captureGalleryItems($);
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent('<style>.dmInner{min-width:768px!important}.photogallery-column{display:grid;grid-template-columns:repeat(3,1fr)}</style>'+$.html());await page.addScriptTag({content:await readFile(new URL('../vendor/migration-navigation.js',import.meta.url),'utf8')});assert.deepEqual(await page.locator('.photoGalleryThumbs').allTextContents(),['Card 1','Card 2','Card 3','Card 4']);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=390));const boxes=await page.locator('.photoGalleryThumbs').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().toJSON()));assert.equal(boxes[0].top,boxes[1].top);assert.ok(boxes[2].top>boxes[0].top);await page.setViewportSize({width:1440,height:900});const desktop=await page.locator('.photoGalleryThumbs').evaluateAll(xs=>xs.map(x=>x.getBoundingClientRect().top));assert.equal(desktop[0],desktop[2]);
 }finally{await browser.close();}
});
test('clicking a hover-opened unified menu keeps it open and keyboard reachable',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage();await page.setContent('<style>li{list-style:none}.icon-angle-down{display:inline-block;width:24px;height:24px}ul ul{display:none}</style><nav class="main-navigation"><ul class="unifiednav__container"><li data-sub-nav-menu="true"><a href="/about">About<span class="icon-angle-down">v</span></a><ul><li><a tabindex="-1" href="/areas">Areas</a></li></ul></li></ul></nav>');await page.addScriptTag({content:await readFile(new URL('../vendor/migration-navigation.js',import.meta.url),'utf8')});await page.getByRole('button',{name:'Toggle Aboutv'}).click();assert.equal(await page.getByRole('button').getAttribute('aria-expanded'),'true');assert.ok(await page.getByRole('link',{name:'Areas'}).isVisible());assert.equal(await page.getByRole('link',{name:'Areas'}).getAttribute('tabindex'),'0');await page.getByRole('button').press('Escape');assert.equal(await page.getByRole('button').getAttribute('aria-expanded'),'false');
 }finally{await browser.close();}
});

test('mobile hosted captions grow with text and drawer exposes its open state',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage({viewport:{width:390,height:844}});await page.setContent('<body class="dmDesktopBody"><div id="dm"><div class="dmInner"><div data-migration-gallery-grid style="--cloner-gallery-mobile-columns:2"><div class="photoGalleryThumbs"><div class="thumbnailInnerWrapper" style="height:71px;overflow:hidden"><div class="caption-container" style="height:71px"><span class="caption-inner" style="display:block;height:71px;overflow:hidden">'+('Readable caption text '.repeat(30))+'</span></div></div></div></div></div></div><button class="layout-drawer-hamburger" aria-controls="drawer">Menu</button><div id="drawer" aria-hidden="true">Navigation</div></body>');await page.addScriptTag({content:await readFile(new URL('../vendor/migration-navigation.js',import.meta.url),'utf8')});assert.ok(await page.locator('.caption-inner').evaluate(el=>el.clientHeight>=el.scrollHeight));await page.getByRole('button',{name:'Menu'}).click();assert.equal(await page.locator('#drawer').getAttribute('aria-hidden'),'false');await page.getByRole('button',{name:'Menu'}).press('Escape');assert.equal(await page.locator('#drawer').getAttribute('aria-hidden'),'true');
 }finally{await browser.close();}
});
