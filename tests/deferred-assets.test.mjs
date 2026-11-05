import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {promoteDeferredAssets,backgroundURL} from '../engine/deferred-assets.mjs';
import {extract} from '../engine/extract.mjs';
const base='https://example.test/';
test('optimizer image contracts promote responsive sources and retain source geometry',()=>{
 const $=load('<picture><source media="(min-width:800px)" type="image/webp" data-lazy-srcset="/wide.webp 2x"><img class="lazyload" width="400" height="300" data-lazyloaded="1" src="/blank.png" data-lazy-src="/photo.jpg" data-lazy-srcset="/photo.jpg 400w, /large.jpg 800w" data-lazy-sizes="(max-width:600px) 100vw, 400px"></picture>');
 promoteDeferredAssets($,base);
 assert.equal($('img').attr('src'),'/photo.jpg');assert.match($('img').attr('srcset'),/large.jpg/);assert.equal($('img').attr('width'),'400');assert.equal($('img').attr('height'),'300');assert.match($('img').attr('sizes'),/100vw/);assert.equal($('source').attr('type'),'image/webp');assert.equal($('source').attr('media'),'(min-width:800px)');assert.equal($('img').attr('data-lazy-src'),undefined);assert.ok($('img').hasClass('litespeed-loaded'));assert.ok(!$('img').hasClass('lazyload'));
});
test('CSS background values resolve one URL without fabricating requests for CSS expressions',()=>{
 assert.equal(backgroundURL('url("/photo.jpg")',base),base+'photo.jpg');assert.equal(backgroundURL('/photo.jpg',base),base+'photo.jpg');
 for(const value of ['url(javascript:alert(1))','linear-gradient(red,blue)','url(a),url(b)','data:image/png;base64,abc'])assert.equal(backgroundURL(value,base),null);
});
test('deferred styles restore only literal known handlers and retain genuine print styles',()=>{
 const page=extract(`<html><head><link rel="preload" as="style" href="/a.css" onload="this.onload=null;this.rel='stylesheet'"><link rel="stylesheet" href="/b.css" media="print" onload="this.media='all'"><link rel="stylesheet" href="/print.css" media="print"><link rel="preload" as="style" href="/unsafe.css" onload="steal();this.rel='stylesheet'"><link rel="preload" as="style" href="/a.css" onload="this.rel='stylesheet'"></head><body><main><h1>Hello</h1></main></body></html>`,base);
 assert.deepEqual(page.styleSources,[{url:base+'a.css',media:undefined},{url:base+'b.css',media:'all'},{url:base+'print.css',media:'print'}]);assert.equal(page.presentationVersion,41);
});
test('unsafe deferred image values do not replace existing images',()=>{
 const $=load('<img src="/good.png" data-src="javascript:bad" data-srcset="/good.png 1x, javascript:bad 2x">');promoteDeferredAssets($,base);assert.equal($('img').attr('src'),'/good.png');assert.equal($('img').attr('srcset'),undefined);
});
test('optimizer resources download once, localize and survive cache reuse',async()=>{
 const {localize}=await import('../engine/assets.mjs');const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'optimizer-assets-'));
 try{
  const page=extract(`<html><head><link rel="preload" as="style" href="/deferred.css" onload="this.rel='stylesheet'"></head><body><main><h1>Gallery</h1><img data-lazy-src="/photo.png" data-lazy-srcset="/photo.png 1x, /large.png 2x"><div data-bg="url('/photo.png')">Background</div></main></body></html>`,base);
  const calls=[],network={text:async url=>{calls.push(url);return "main{border-radius:12px}";},get:async url=>{calls.push(url);return url.endsWith('.css')?{status:200,headers:{'content-type':'text/css'},body:Buffer.from('main{border-radius:12px}')}:{status:200,headers:{'content-type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')};}};
  const model={source:base,pages:[page],media:[],warnings:[],metrics:{}};
  await localize(model,network,dir);assert.equal(calls.length,3);assert.equal(new Set(calls).size,3);assert.doesNotMatch(page.content,/data-(?:lazy-src|bg)=/);assert.match(load(page.content)('div').attr('style'),/background-image:url\("\/assets\/media\//);assert.match(page.content,/srcset="\/assets\/media\//);assert.ok(page.styles.some(css=>css.includes('border-radius:12px')));
  await localize(model,network,dir);assert.equal(calls.length,3);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('ASCII SVG data URLs localize without network and still sanitize active content',async()=>{
 const {localize}=await import('../engine/assets.mjs');const {mkdtemp,rm,readFile}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=await mkdtemp(join(tmpdir(),'ascii-svg-'));
 try {
  const svg='<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M5 6l5 5 5-5"/><script>alert(1)</script></svg>';
  const url='data:image/svg+xml;charset=US-ASCII,'+encodeURIComponent(svg);
  const page=extract(`<html><head><style>.arrow{background-image:url("${url}")}</style></head><body><main><h1>Icon</h1><img src="${url}" alt="Arrow"></main></body></html>`,base);
  const model={source:base,pages:[page],media:[],warnings:[],metrics:{}};
  await localize(model,{get:()=>{throw Error('Embedded image must not fetch');}},dir,{savedState:{failures:[{url,error:'Unsupported embedded media',retryAfter:Date.now()+300000}]}});
  assert.deepEqual(model.warnings,[]);assert.equal(model.media.length,1);
  const asset=await readFile(join(dir,model.media[0].path.split('/').at(-1)),'utf8');assert.match(asset,/<path/);assert.doesNotMatch(asset,/<script/i);
  assert.match(load(page.content)('img').attr('src'),/^\/assets\/media\/.+\.svg$/);
  assert.ok(page.styles.some(css=>/background-image:url\("\.\.\/media\/.+\.svg"\)/.test(css)));
 }finally{await rm(dir,{recursive:true,force:true});}
});
