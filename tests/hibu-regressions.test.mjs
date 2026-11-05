import test from 'node:test';import assert from 'node:assert/strict';import {readFile,mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {chromium} from 'playwright';import {extract} from '../engine/extract.mjs';import {localize} from '../engine/assets.mjs';import {verifyNavigation} from '../engine/verify-navigation.mjs';
test('lazy images and background candidates become local static assets',async()=>{
 const source='https://example.com/';const p=extract('<html><body><main><p>Gallery</p><img data-src="/large.png"><a data-background-image="/large.png">Photo</a></main></body></html>',source);assert.match(p.content,/src="\/large.png"/);
 const dir=await mkdtemp(path.join(os.tmpdir(),'lazy-assets-'));try{
 const model={source,pages:[p],media:[],warnings:[],metrics:{}};await localize(model,{get:async()=>({status:200,headers:{'content-type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')})},dir);
 assert.match(p.content,/src="\/assets\/media\//);assert.match(p.content,/background-image:url\(/);assert.doesNotMatch(p.content,/data-background-image/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('unified menus keep parent links and expose keyboard dropdown and drawer controls',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{const page=await browser.newPage();
 await page.setContent(`<style>li{position:relative;list-style:none}a{display:block;padding:10px}.icon-angle-down{display:inline-block;width:20px;height:20px}nav ul ul{display:none}.sfHover>ul{display:block}</style><button class="layout-drawer-hamburger" aria-controls="drawer">Menu</button><div id="drawer">Drawer contents</div><nav class="main-navigation unifiednav"><ul class="unifiednav__container"><li data-sub-nav-menu="true"><a href="/about">About<span class="icon-angle-down">⌄</span></a><ul><li><a href="/faqs">FAQ</a></li></ul></li></ul></nav>`);
 await page.addScriptTag({content:await readFile(new URL('../vendor/migration-navigation.js',import.meta.url),'utf8')});const checks=await verifyNavigation(page);assert.ok(checks.some(x=>x.kind==='drawer-responsive'));assert.ok(checks.some(x=>x.kind==='classic-disclosure'));assert.ok(checks.every(x=>x.status==='passed'),JSON.stringify(checks));assert.equal(await page.locator('a[href="/about"]').count(),1);
 }finally{await browser.close();}
});

test('source hide attributes keep form labels and titles in their original presentation',async()=>{
 const {clean}=await import('../engine/extract.mjs');assert.match(clean('<h3 hide="true">Internal form title</h3><label hide="true">NAME</label>',{forms:true}),/hide="true"/);
});

test('inline theme colour variables survive without admitting executable CSS',async()=>{
 const {clean}=await import('../engine/extract.mjs');
 const html=clean('<p style="color:var(--color_1)">White</p><p style="color:var(--brand, #fff)">Fallback</p><p style="color:var(--bad, url(https://evil.test))">Blocked</p>');
 assert.match(html,/color:var\(--color_1\)/);assert.match(html,/color:var\(--brand, #fff\)/);assert.doesNotMatch(html,/evil\.test/);
});
test('embedded TrueType MIME aliases localize as fonts',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'embedded-font-'));try{
 const source='https://example.com/';const bytes=Buffer.from([0,1,0,0,0,0,0,0]);
 const urls=['application/x-font-ttf;charset=utf-8','font/truetype'].map(type=>'data:'+type+';base64,'+bytes.toString('base64'));
 const p=extract('<html><head><style>'+urls.map((url,i)=>'@font-face{font-family:test'+i+';src:url("'+url+'")}').join('')+'</style></head><body><main><p>Font</p></main></body></html>',source);
 const model={source,pages:[p],media:[],warnings:[],metrics:{}};await localize(model,{get:async()=>{throw Error('No network needed')}},dir);
 assert.ok(model.media.some(m=>JSON.stringify(m).includes('.ttf')));assert.ok(!model.warnings.some(w=>w.includes('Unsupported embedded')),model.warnings.join('\n'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('cached presentation upgrades recover stripped colour variables from saved HTML',async()=>{
 const {restorePresentation}=await import('../engine/presentation.mjs');const html='<html><body><main><p id="body"><span style="color:var(--color_1)">White text</span></p></main></body></html>';
 const page=extract(html,'https://example.com/');page.content=page.content.replace(' style="color:var(--color_1)"','');page.presentationVersion=4;
 assert.ok(restorePresentation(page,html)>0);assert.match(page.content,/color:var\(--color_1\)/);assert.equal(extract(html,'https://example.com/').presentationVersion,41);
});

test('saved HTML parser upgrades rebuild lazy presentation using existing assets',async()=>{
 const {refreshPresentation}=await import('../engine/presentation.mjs');const dir=await mkdtemp(path.join(os.tmpdir(),'refresh-gallery-'));
 try{const html='<html><body><main><p>Gallery</p><a data-background-image="/photo.png">Photo</a></main></body></html>';const page=extract(html,'https://example.com/');page.content='<p>Stale layout</p>';page.assetCheckpointVersion=1;
 refreshPresentation(page,html);assert.equal(page.assetCheckpointVersion,undefined);const model={source:page.url,pages:[page],media:[{source:'https://example.com/photo.png',path:'assets/media/12345678901234567890.png'}],warnings:[],metrics:{}};
 await localize(model,{get:async()=>{throw Error('Existing photo must not be downloaded')}},dir);assert.match(page.content,/background-image:url/);assert.doesNotMatch(page.content,/Stale layout/);assert.equal(model.warnings.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('CSS icon escapes and local SVG fragments survive while escaped executable declarations do not',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'icon-css-'));try{
 const p=extract('<html><head><style>.icon::before{content:"\\e123"}.bad{background:u\\72l(https://evil.test)}.shape{filter:url(#shadow)}.empty{background:url("")}</style></head><body><main>Icons</main></body></html>','https://example.com/');
 const model={source:p.url,pages:[p],media:[],warnings:[],metrics:{}};await localize(model,{get:async()=>{throw Error('No external request expected')}},dir);
 assert.match(p.styles.join(''),/content:"\\e123"/);assert.match(p.styles.join(''),/url\(#shadow\)/);assert.doesNotMatch(p.styles.join(''),/evil\.test/);assert.equal(model.warnings.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('rendered zero-size beacons are excluded without dropping visible images',()=>{
 const p=extract('<html><body><main><p>Public content</p><img src="/tracking" width="0" height="0"><img src="/photo.png" width="100" height="100"></main></body></html>','https://example.com/');assert.doesNotMatch(p.content,/tracking/);assert.match(p.content,/photo.png/);
});
test('unquoted stylesheet imports use checked network requests and preserve media',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'css-import-'));try{
 const p=extract('<html><head><style>@import url(//cdn.example.com/theme.css) screen;</style></head><body><main>Text</main></body></html>','https://example.com/');const seen=[];const model={source:p.url,pages:[p],media:[],warnings:[],metrics:{}};await localize(model,{text:async url=>{seen.push(url);return '.child{color:red}';}},dir);assert.deepEqual(seen,['https://cdn.example.com/theme.css']);assert.match(p.styles.join(''),/@media screen/);assert.match(p.styles.join(''),/color:red/);assert.equal(model.warnings.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
