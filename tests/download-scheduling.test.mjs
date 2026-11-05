import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {DownloadQueue} from '../engine/download-queue.mjs';
import {SafeNetwork} from '../engine/network.mjs';
import {extract} from '../engine/extract.mjs';
import {localize} from '../engine/assets.mjs';
import {runWithAutoResume} from '../app/auto-resume.mjs';

test('shared queue enforces global and host limits and frees slots after failures',async()=>{
 const queue=new DownloadQueue({concurrency:4,perHost:2});let active=0,peak=0;const counts={},peaks={};
 await Promise.all(Array.from({length:20},(_,i)=>queue.run(i%2?'a':'b',async()=>{
  const host=i%2?'a':'b';active++;counts[host]=(counts[host]||0)+1;peak=Math.max(peak,active);peaks[host]=Math.max(peaks[host]||0,counts[host]);
  await new Promise(r=>setTimeout(r,5));counts[host]--;active--;if(i===3)throw Error('fixture');
 }).catch(e=>assert.equal(e.message,'fixture'))));
 assert.equal(peak,4);assert.deepEqual(peaks,{b:2,a:2});assert.equal(queue.active,0);assert.equal(queue.pending.length,0);
});
test('network coalesces requests and rate-limit response stops queued work',async()=>{
 let requests=0;
 const server=http.createServer((req,res)=>{requests++;if(req.url==='/robots.txt')return res.end('User-agent: *\nAllow: /');setTimeout(()=>{if(req.url==='/limited'){res.writeHead(429,{'retry-after':'120'});res.end('wait');}else res.end('ok');},10);});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{
  const n=new SafeNetwork({fixtureOrigins:[origin],perHost:1,pauseOnOutage:true});
  const results=await Promise.all(Array.from({length:10},()=>n.get(origin+'/same')));
  assert.ok(results.every(x=>x.body.toString()==='ok'));assert.equal(requests,2);
  await assert.rejects(n.get(origin+'/limited'),e=>e.code==='SOURCE_UNAVAILABLE'&&e.retryAfterMs===120000);
  const before=requests;await assert.rejects(n.get(origin+'/other'),{code:'SOURCE_UNAVAILABLE'});assert.equal(requests,before);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('resume skips completed page transformations and cached CSS, retaining monotonic progress',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'resume-localization-'));
 const make=i=>extract('<html><head><link rel="stylesheet" href="/theme.css"></head><body><main><img src="/'+i+'.svg"></main></body></html>','https://example.org/'+i);
 const originals=[make(1),make(2)],model={source:'https://example.org/',pages:structuredClone(originals),media:[],warnings:[],metrics:{}};
 const saved=new Map();let state,fail=true;const calls=[];
 const network={text:async url=>{calls.push(url);return 'main{display:grid}';},get:async url=>{calls.push(url);if(fail&&url.endsWith('2.svg'))throw Object.assign(Error('budget fixture'),{code:'CRAWL_BUDGET'});return {status:200,headers:{'content-type':'image/svg+xml'},body:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')};}};
 try {
  await assert.rejects(localize(model,network,dir,{concurrency:1,onPage:async p=>saved.set(p.url,structuredClone(p)),onCheckpoint:async(_m,_p,s)=>{state=structuredClone(s);}}),/budget fixture/);
  assert.equal(saved.size,1);const first=JSON.stringify(saved.get(originals[0].url));
  model.pages=originals.map(p=>saved.get(p.url)||structuredClone(p));fail=false;calls.length=0;let progress;
  await localize(model,network,dir,{concurrency:1,savedState:state,onCheckpoint:async(_m,p)=>{progress=p;}});
  assert.deepEqual(calls,['https://example.org/2.svg']);assert.equal(JSON.stringify(model.pages[0]),first);assert.equal(progress.completedPages,2);assert.equal(model.media.length,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('source pause honors Retry-After and resumes the same checkpoint without a budget restart',async()=>{
 let calls=0;const delays=[],modes=[];
 const result=await runWithAutoResume(async({resume})=>{modes.push(resume);if(++calls===1)throw Object.assign(Error('busy'),{code:'SOURCE_UNAVAILABLE',retryAfterMs:120000});return 'done';},{disk:async()=>1e12,fingerprint:async()=>'',sleep:async ms=>delays.push(ms)});
 assert.equal(result,'done');assert.deepEqual(delays,[120000]);assert.deepEqual(modes,[false,true]);
});

test('robots outages use the same bounded source retry without granting crawl permission',async()=>{
 let attempts=0,requests=[],state={};
 const server=http.createServer((req,res)=>{requests.push(req.url);if(req.url==='/robots.txt'){res.statusCode=++attempts===1?503:200;res.end('User-agent: *\nDisallow: /private');}else res.end('OK');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{let rounds=0;const value=await runWithAutoResume(async()=>{rounds++;const network=new SafeNetwork({fixtureOrigins:[origin],pauseOnOutage:true});return network.get(origin+'/');},{state,disk:async()=>1e12,fingerprint:async()=>'',sleep:async()=>{assert.deepEqual(requests,['/robots.txt']);}});assert.match(state.lastSourceError.message,/robots\.txt/);assert.equal(value.status,200);assert.equal(rounds,2);assert.deepEqual(requests,['/robots.txt','/robots.txt','/']);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
