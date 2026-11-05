import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {extract} from '../engine/extract.mjs';
import {localize} from '../engine/assets.mjs';

const source='https://fixture.example/';
const failedURL=source+'unavailable.svg';
const page=()=>extract('<html><body><main><img src="/unavailable.svg" alt="Unavailable"><img src="/available.svg" alt="Available"></main></body></html>',source);
const response={status:200,headers:{'content-type':'image/svg+xml'},body:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')};
test('an exhausted asset timeout pauses once, survives resume as a visible failure and can recover after cooldown',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'asset-cooldown-'));
 try{
  const model={pages:[page()],media:[],warnings:[],metrics:{}};let state;
  const error=Object.assign(Error('Source transport exhausted'),{code:'SOURCE_UNAVAILABLE',timeoutKind:'idle',retryExhausted:true,failedURL});
  await assert.rejects(localize(model,{get:async url=>{if(url===failedURL)throw error;return response;}},dir,{onCheckpoint:async(_m,_p,s)=>{state=s;}}),e=>e===error);
  assert.equal(state.failures.length,1);
  assert.equal(state.failures[0].url,failedURL);
  assert.ok(state.failures[0].retryAfter>Date.now());
  model.pages=[page()];const calls=[];
  await localize(model,{get:async url=>{calls.push(url);if(url===failedURL)throw Error('Cooldown must not retry unavailable asset');return response;}},dir,{savedState:state});
  assert.ok(!calls.includes(failedURL));
  assert.ok(model.warnings.some(w=>w.includes(failedURL)));
  assert.deepEqual(model.pages[0].assetFailures,['/unavailable.svg']);
  assert.ok(model.metrics.missingImages>0,'failure must remain visible to quality checks');
  state.failures[0].retryAfter=0;model.pages=[page()];const retry=[];
  await localize(model,{get:async url=>{retry.push(url);return response;}},dir,{savedState:state});
  assert.deepEqual(retry,[failedURL]);
  assert.equal(model.metrics.missingImages,0);
  assert.ok(!model.warnings.some(w=>w.startsWith('Asset '+failedURL+':')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

for(const scenario of ['rate-limit','dns','other-request'])test(`asset cooldown does not absorb ${scenario} outages`,async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'asset-global-outage-'));
 try{
  const model={pages:[page()],media:[],warnings:[],metrics:{}};let state;
  const error=Object.assign(Error('Outage'),{code:'SOURCE_UNAVAILABLE',retryExhausted:true,timeoutKind:scenario==='rate-limit'?undefined:scenario==='dns'?'dns':'idle',failedURL:scenario==='other-request'?source+'another.svg':failedURL});
  await assert.rejects(localize(model,{get:async()=>{throw error;}},dir,{onCheckpoint:async(_m,_p,s)=>{state=s;}}),e=>e===error);
  assert.deepEqual(state.failures,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
