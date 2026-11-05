import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import http from 'node:http';
import {localize} from '../engine/assets.mjs';import {extract} from '../engine/extract.mjs';
import {SafeNetwork} from '../engine/network.mjs';
test('legacy WOFF2 and TTF MIME aliases localize and reuse cached fonts',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'font-mime-'));try{
  const page=extract('<html><head><style>@font-face{font-family:Demo;src:url(/demo.woff2)}@font-face{font-family:Other;src:url(/other.ttf)}</style></head><body><main>Text</main></body></html>','https://example.org/');
  const m={pages:[page],media:[],metrics:{},warnings:[]};let calls=0;
  const network={get:async url=>{calls++;return {status:200,headers:{'content-type':url.endsWith('woff2')?'application/font-woff2':'application/font-ttf'},body:Buffer.from(url.endsWith('woff2')?'wOF2fixture':'ttffixture')};}};
  await localize(m,network,dir);assert.equal(m.media.length,2);assert.match(page.styles.join(''),/url\("\.\.\/media\//);assert.ok(!page.styles.join('').includes('none'));
  await localize(m,network,dir,{stylesOnly:true});assert.equal(calls,2);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('robots crawl delay spaces concurrent requests instead of rejecting assets',async()=>{
 const times=[];const server=http.createServer((req,res)=>{if(req.url==='/robots.txt')return res.end('User-agent: *\nCrawl-delay: 0.1\nDisallow: /private');times.push(Date.now());res.end('ok');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{const network=new SafeNetwork({fixtureOrigins:[origin]});await Promise.all([network.get(origin+'/a'),network.get(origin+'/b'),network.get(origin+'/c')]);assert.equal(times.length,3);assert.ok(times[2]-times[0]>=175);await assert.rejects(network.get(origin+'/private'),/Disallowed/);
  network.nextRequest.set(origin,Date.now()+1000);network.maxDurationMs=500;await assert.rejects(network.get(origin+'/d'),e=>e.code==='CRAWL_BUDGET');
 }
 finally{await new Promise(r=>server.close(r));}
});
