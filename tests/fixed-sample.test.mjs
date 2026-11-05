import test from 'node:test';
import assert from 'node:assert/strict';
import {discover} from '../engine/extract.mjs';
test('fixed URL sample fetches fresh pages without expanding its frontier',async()=>{
 const origin='https://sample.test',requests=[];
 const network={robots:new Map(),async get(url){requests.push(url);return {url,status:[origin+'/',origin+'/chosen/'].includes(url)?200:404,headers:{},body:Buffer.from('<html><body><main><h1>Fresh source</h1><a href="/outside/">Outside sample</a></main></body></html>')};}};
 const sampleUrls=[origin+'/',origin+'/chosen/'];
 const model=await discover(origin+'/',network,{sampleUrls});
 assert.deepEqual(model.pages.map(p=>p.url),sampleUrls);assert.ok(!requests.includes(origin+'/outside/'));assert.ok(!requests.includes(origin+'/sitemap.xml'));assert.equal(model.discovery.mode,'fixed-url-sample');assert.deepEqual(model.discovery.sampleUrls,sampleUrls);
 assert.ok(model.pages.every(p=>p.sourceHTML.includes('Fresh source')));
 requests.length=0;await discover(origin+'/',network,{sampleUrls});assert.ok(requests.includes(origin+'/chosen/'),'independent run downloads again');
 await assert.rejects(discover(origin+'/',network,{sampleUrls:['https://other.test/']}),/same-origin/);
});
