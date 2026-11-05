import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {extract,clean} from '../engine/extract.mjs';
import {localize} from '../engine/assets.mjs';
import {SafeNetwork} from '../engine/network.mjs';
import {sanitizeSvg} from '../engine/svg.mjs';

test('responsive styles retain media conditions and text coverage excludes embedded CSS',()=>{
 const p=extract('<html><head><link rel="stylesheet" href="/mobile.css" media="(max-width:767px)"></head><body><main><style>.anything{color:red}</style><h1>Actual content</h1></main></body></html>','https://example.org/');
 assert.equal(p.sourceContentText,'Actual content');
 assert.equal(p.styleSources[0].media,'(max-width:767px)');
});
test('failed assets do not consume successful asset capacity; comma image URLs and SVG remain usable',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'import-reliability-'));
 const calls=[];
 const network={text:async()=>Array.from({length:510},(_,i)=>`.flag${i}{background:url(/denied/${i})}`).join('')+'.logo{background:url(/logo.svg)}',get:async url=>{calls.push(url);return url.includes('/denied/')?{status:403}:{status:200,headers:{'content-type':url.endsWith('.svg')?'image/svg+xml':'image/png'},body:Buffer.from(url.endsWith('.svg')?'<svg viewBox="0 0 20 20"><path d="M0 0L20 20"/></svg>':'png')};}};
 const p=extract('<html><head><link rel="stylesheet" href="/mobile.css" media="(max-width:767px)"></head><body><main><img src="/fallback.png" srcset="/cdn/f=auto,w=390/a.png 390w, /cdn/f=auto,w=1440/a.png 1440w"></main></body></html>','https://example.org/');
 const model={pages:[p],warnings:[],media:[],metrics:{}};
 try{await localize(model,network,dir);assert.ok(calls.includes('https://example.org/cdn/f=auto,w=1440/a.png'));assert.ok(calls.includes('https://example.org/cdn/f=auto,w=390/a.png'));assert.equal(model.media.length,4);assert.match(p.styles[0],/^@media \(max-width:767px\)/);assert.ok(model.media.some(m=>m.type==='image/svg+xml'));assert.ok(!model.warnings.includes('Asset budget reached'));}finally{await rm(dir,{recursive:true,force:true});}
});
test('SVG preserves geometry but cannot load active content or external resources',()=>{
 const source='<svg viewBox="0 0 24 24"><script>alert(1)</script><foreignObject><iframe src="/x"/></foreignObject><use href="https://evil.test/a"/><path onclick="evil()" fill="url(https://evil.test/a)" d="M0 0L24 24"/><use href="#local"/></svg>';
 for(const output of [sanitizeSvg(source),clean(source)]){assert.match(output,/viewBox="0 0 24 24"/);assert.match(output,/d="M0 0L24 24"/);assert.doesNotMatch(output,/script|iframe|onclick|evil.test|foreignObject/);assert.match(output,/href="#local"/);}
});
test('concurrent robots checks share permission lookup and retry denied-origin failures',async()=>{
 let count=0;const server=http.createServer((req,res)=>{if(req.url==='/robots.txt'){count++;res.writeHead(302,{location:'/rules.txt'});res.end();}else if(req.url==='/rules.txt')setTimeout(()=>res.end('User-agent: *\nAllow: /'),30);else res.end('ok');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try{const n=new SafeNetwork({fixtureOrigins:[origin]});const results=await Promise.all(Array.from({length:8},(_,i)=>n.text(origin+'/'+i)));assert.equal(results.length,8);assert.equal(count,1);}finally{await new Promise(r=>server.close(r));}
 const n=new SafeNetwork();n.address=async()=>({});let raw=0;n.raw=async()=>{raw++;return {status:503};};await assert.rejects(n.allowed(new URL('https://example.org/')),/Cannot establish robots permission/);await assert.rejects(n.allowed(new URL('https://example.org/other')),/Cannot establish robots permission/);assert.equal(raw,2);assert.equal(n.robots.has('https://example.org'),false);
});
test('video remains a styled static poster without remote playback',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'poster-'));
 const p=extract('<html><body><main><video class="hero" src="/movie.webm" poster="/cover.webp"><source src="/other.mp4"><img src="/cover.webp"></video></main></body></html>','https://example.org/');
 const model={pages:[p],media:[],warnings:[],metrics:{}};
 try{await localize(model,{get:async()=>({status:200,headers:{'content-type':'image/webp'},body:Buffer.from('poster')}),text:async()=>''},dir);assert.match(p.content,/<video class="hero" poster="\/assets\/media\//);assert.doesNotMatch(p.content,/movie.webm|other.mp4|<source/);assert.ok(p.dynamic.some(x=>x.includes('poster')));}finally{await rm(dir,{recursive:true,force:true});}
});
test('legitimate sites can retain more than 500 images within network budgets',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'many-images-'));
 const p=extract('<html><body><main>'+Array.from({length:510},(_,i)=>`<img src="/image-${i}.png">`).join('')+'</main></body></html>','https://example.org/');
 const model={pages:[p],media:[],warnings:[],metrics:{}};
 try{await localize(model,{get:async()=>({status:200,headers:{'content-type':'image/png'},body:Buffer.from('png')}),text:async()=>''},dir);assert.equal(model.media.length,510);assert.doesNotMatch(p.content,/missing-image/);}finally{await rm(dir,{recursive:true,force:true});}
});
test('malformed but recoverable CSS retains complete layouts and filters active resources',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'css-recovery-'));
 const p=extract('<html><head><link rel="stylesheet" href="/style.css"></head><body><main>Content</main></body></html>','https://example.org/');
 const model={pages:[p],media:[],warnings:[],metrics:{}};
 try{await localize(model,{text:async()=>'.hero{position:absolute;\\n}.title{font-size:80px;color:white;}@import "https://bad.test/a";.bad{width:expression(evil())}',get:async()=>{throw Error('Blocked');}},dir);assert.match(p.styles[0],/position:absolute/);assert.match(p.styles[0],/font-size:80px/);assert.doesNotMatch(p.styles[0],/expression|@import/);assert.ok(model.warnings.some(w=>w.includes('Recovered malformed')));}finally{await rm(dir,{recursive:true,force:true});}
});
test('percent-encoded SVG and embedded WOFF fonts localize without active SVG content',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'embedded-media-'));
 const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><script>evil()</script><path d="M0 0L24 24"/></svg>');
 const p=extract('<html><head><style>.icon{background:url("'+svg+'")}@font-face{font-family:icon;src:url("data:application/font-woff;charset=utf-8;base64, d09GRg==")}</style></head><body><main>Content</main></body></html>','https://example.org/');
 const model={pages:[p],media:[],warnings:[],metrics:{}};
 try{await localize(model,{},dir);assert.equal(model.media.length,2);const media=model.media.find(m=>m.type==='image/svg+xml');assert.doesNotMatch(await readFile(path.join(dir,path.basename(media.path)),'utf8'),/script|evil/);assert.match(p.styles[0],/\.svg/);assert.match(p.styles[0],/\.woff/);}finally{await rm(dir,{recursive:true,force:true});}
});
test('asset safety boundary interrupts instead of silently replacing remaining images',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'asset-resume-'));const html='<html><body><main><img src="/one.png"><img src="/two.png"></main></body></html>';
 const model={pages:[extract(html,'https://example.org/')],media:[],warnings:[],metrics:{}};let calls=0;
 try{await assert.rejects(localize(model,{get:async()=>{if(++calls>1)throw Object.assign(Error('budget'),{code:'CRAWL_BUDGET'});return{status:200,headers:{'content-type':'image/png'},body:Buffer.from('one')};}},dir),/budget/);assert.equal(model.media.length,1);
 model.pages=[extract(html,'https://example.org/')];const resumed=[];await localize(model,{get:async url=>{resumed.push(url);return{status:200,headers:{'content-type':'image/png'},body:Buffer.from('two')};}},dir);assert.deepEqual(resumed,['https://example.org/two.png']);assert.equal(model.metrics.missingImages,0);}finally{await rm(dir,{recursive:true,force:true});}
});

test('asset workers overlap bounded downloads, share in-flight assets and styles, and serialize checkpoints',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'concurrent-assets-'));
 let active=0,peak=0,writes=0;const calls=new Map();let cssCalls=0;const progress=[];
 const pages=Array.from({length:8},(_,i)=>extract(`<html><head><link rel="stylesheet" href="/shared.css"></head><body><main><img src="/shared.webp"><img src="/${i}.webp"></main></body></html>`,'https://example.org/'+i));
 const model={pages,media:[],warnings:[],metrics:{}};
 const network={get:async url=>{calls.set(url,(calls.get(url)||0)+1);peak=Math.max(peak,++active);await new Promise(r=>setTimeout(r,15));active--;return{status:200,headers:{'content-type':'image/webp'},body:Buffer.from(url)};},text:async()=>{cssCalls++;await new Promise(r=>setTimeout(r,5));return'.logo{background:url(/shared.webp)}';}};
 try{await localize(model,network,dir,{concurrency:3,onCheckpoint:async(_,p)=>{assert.equal(++writes,1);await new Promise(r=>setTimeout(r,2));progress.push(p);writes--;}});
 assert.ok(peak>1);assert.ok(peak<=3);assert.equal(calls.size,9);assert.ok([...calls.values()].every(n=>n===1));assert.equal(cssCalls,1);assert.equal(model.media.length,9);assert.ok(pages.every(p=>!p.content.includes('missing-image')));assert.equal(progress.at(-1).completedPages,8);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('budget pause drains concurrent workers before final checkpoint and resume reuses successes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'concurrent-budget-'));let active=0;const html=i=>`<main><img src="/${i}.webp"></main>`;const pages=()=>[0,1,2].map(i=>extract(html(i),'https://example.org/'+i));const model={pages:pages(),media:[],warnings:[],metrics:{}};
 try{await assert.rejects(localize(model,{get:async url=>{active++;try{await new Promise(r=>setTimeout(r,url.endsWith('0.webp')?5:30));if(url.endsWith('0.webp'))throw Object.assign(Error('budget'),{code:'CRAWL_BUDGET'});return{status:200,headers:{'content-type':'image/webp'},body:Buffer.from(url)};}finally{active--;}}},dir,{concurrency:3}),/budget/);assert.equal(active,0);assert.equal(model.media.length,2);model.pages=pages();const calls=[];await localize(model,{get:async url=>{calls.push(url);return{status:200,headers:{'content-type':'image/webp'},body:Buffer.from(url)};}},dir);assert.deepEqual(calls,['https://example.org/0.webp']);}finally{await rm(dir,{recursive:true,force:true});}
});

test('asset checkpoint records saved work and the active page before that page finishes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'asset-live-progress-'));
 try{
  const p=extract('<html><body><main><img src="/first.svg"><img src="/second.svg"></main></body></html>','https://example.org/last/');
  const model={pages:[p],media:[],warnings:[],metrics:{}};let receipt;
  const network={get:async url=>({status:200,headers:{'content-type':'image/svg+xml'},body:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><title>'+new URL(url).pathname+'</title></svg>')}),text:async()=>''};
  await localize(model,network,dir,{onCheckpoint:async(media,progress)=>{if(!receipt&&media.length)receipt={saved:media.length,...progress};}});
  assert.equal(receipt.completedPages,0);assert.equal(receipt.saved,1);assert.deepEqual(receipt.activePages,['/last/']);assert.equal(model.media.length,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
