import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {extract,clean,discover} from '../engine/extract.mjs';
import {sanitizeSvg} from '../engine/svg.mjs';
import {localize} from '../engine/assets.mjs';

test('exporter SVG headers and text logos survive while entities and active styles remain blocked',()=>{
 const svg='<?xml version="1.0"?><!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg viewBox="0 0 100 20"><text style="font-family:\'Brand Font\', sans-serif;font-size:20px;fill:#42619a;behavior:url(https://evil.test)">Brand<tspan x="50">.</tspan></text></svg>';
 const output=sanitizeSvg(svg.replace('behavior:url(https://evil.test)','stroke-miterlimit:2'));
 assert.match(output,/<text style="font-family:/);assert.match(output,/<tspan x="50">/);assert.match(output,/fill:#42619a/);assert.doesNotMatch(output,/DOCTYPE|<\?xml/);
 assert.doesNotMatch(sanitizeSvg(svg),/evil.test|behavior/);
 assert.throws(()=>sanitizeSvg('<!DOCTYPE svg [<!ENTITY leak SYSTEM "file:///etc/passwd">]><svg>&leak;</svg>'));
});
test('inline image cropping and focal point survive sanitization without unsafe CSS',()=>{
 const p=extract('<html><body><main><img src="/photo.jpg" style="aspect-ratio:1;object-fit:cover;object-position:25% 40%;width:100%;height:100%;background:url(https://evil.test)"></main></body></html>','https://example.org');
 assert.match(p.content,/object-fit:cover/);assert.match(p.content,/object-position:25% 40%/);assert.doesNotMatch(p.content,/evil.test/);
 assert.doesNotMatch(clean('<img style="object-fit:expression(evil());object-position:url(https://evil.test)">'),/evil/);
});
test('legacy font MIME and utf8 SVG data resources are frozen locally',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'font-mimes-'));
 const p=extract('<html><head><style>@font-face{font-family:Brand;src:url(/brand.ttf);font-weight:100 900}.icon{background:url(\'data:image/svg+xml;utf8,%3Csvg%20viewBox="0%200%201%201"%3E%3Cpath%20d="M0%200L1%201"/%3E%3C/svg%3E\')}</style></head><body><main>Test</main></body></html>','https://example.org/');
 const model={pages:[p],media:[],warnings:[],metrics:{}};
 try{await localize(model,{get:async()=>({status:200,headers:{'content-type':'application/x-font-ttf; charset=binary'},body:Buffer.from([0,1,0,0])})},dir);assert.equal(model.media.length,2);assert.match(p.styles.join(''),/\.ttf/);assert.match(p.styles.join(''),/\.svg/);assert.equal(model.warnings.length,0);}finally{await rm(dir,{recursive:true,force:true});}
});
test('block-theme post links precede navigation/account pages within crawl scope',async()=>{
 const html='<html><body><header><a href="/account">Account</a></header><main><h2 class="wp-block-post-title"><a href="/news-story">Story</a></h2></main></body></html>';
 const network={robots:new Map(),requests:0,maxRequests:100,started:Date.now(),get:async url=>url==='https://example.org/'?{status:200,url,body:Buffer.from(html)}:url.endsWith('/news-story')?{status:200,url,body:Buffer.from('<html><body><main>Story content</main></body></html>')}:{status:404},text:async()=>''};
 const model=await discover('https://example.org/',network,{maxPages:2});assert.deepEqual(model.pages.map(p=>p.route),['/','/news-story']);
});
