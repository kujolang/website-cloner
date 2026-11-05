import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {runWithAutoResume,checkpointProgress,canAutoResume} from '../app/auto-resume.mjs';
const budget=()=>Object.assign(Error('budget'),{code:'CRAWL_BUDGET'});
const defaults={disk:async()=>10e9,sleep:async()=>{},fingerprint:async()=>''};
test('budget pauses repeatedly resume the same checkpoint with progress and immutable AI settings',async()=>{
 let count=0;const resumes=[],states=[],state={},options={aiEnabled:false,agent:null};
 const result=await runWithAutoResume(async({resume})=>{resumes.push(resume);assert.equal(options.aiEnabled,false);if(++count<6)throw budget();return 'complete';},{...defaults,state,fingerprint:async()=>String(count),publish:async(status,s)=>states.push({status,...s})});
 assert.equal(result,'complete');assert.deepEqual(resumes,[false,true,true,true,true,true]);assert.equal(state.retries,5);assert.equal(states.filter(s=>s.reason==='resource-budget').length,5);
});
test('three budget failures without saved progress stop; other errors never retry',async()=>{
 let calls=0;await assert.rejects(runWithAutoResume(async()=>{calls++;throw budget();},defaults),e=>e.code==='AUTO_RESUME_STALLED');assert.equal(calls,3);
 for(const code of ['EACCES','FILE_SIZE_LIMIT','HTTP_403']){calls=0;await assert.rejects(runWithAutoResume(async()=>{calls++;throw Object.assign(Error('stop'),{code});},defaults),e=>e.code===code);assert.equal(calls,1);}
});
test('disk waits do not invoke the migration until space is available; ENOSPC increases required headroom',async()=>{
 let free=64e6,calls=0,sleeps=0;const states=[];
 const result=await runWithAutoResume(async({resume})=>{calls++;if(calls===1){assert.equal(resume,false);free=500e6;throw Object.assign(Error('full'),{code:'ENOSPC'});}assert.equal(resume,true);return 1;},{...defaults,disk:async()=>free,sleep:async()=>{sleeps++;free=10e9;},publish:async(status,state)=>states.push({status,...state})});
 assert.equal(result,1);assert.equal(calls,2);assert.equal(sleeps,2);assert.ok(states.some(s=>s.reason==='disk-space'&&s.requiredFreeBytes===628e6));
});
test('persisted waiting jobs resume on startup; permanent and stalled failures do not',()=>{
 for(const status of ['running','waiting'])assert.equal(canAutoResume({status,options:{autoResume:true}}),true);
 for(const errorCode of ['CRAWL_BUDGET','ENOSPC'])assert.equal(canAutoResume({status:'failed',errorCode,options:{autoResume:true}}),true);
 for(const errorCode of ['AUTO_RESUME_STALLED','EACCES'])assert.equal(canAutoResume({status:'failed',errorCode,options:{autoResume:true}}),false);
 assert.equal(canAutoResume({status:'running',options:{autoResume:false}}),false);
 assert.equal(canAutoResume({status:'complete',errorCode:'ENOSPC',options:{autoResume:true}}),false);
});
test('checkpoint fingerprint ignores timestamps and failed attempts but tracks saved media and crawl cursors',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'resume-progress-'));try{
 const a=await checkpointProgress(dir);await writeFile(path.join(dir,'asset-cache.json'),JSON.stringify({media:[],updatedAt:'new',progress:{attempts:7}}));assert.equal(await checkpointProgress(dir),a);
 await writeFile(path.join(dir,'asset-cache.json'),JSON.stringify({media:[{bytes:12}]}));const b=await checkpointProgress(dir);assert.notEqual(b,a);
 await writeFile(path.join(dir,'resume-progress.json'),JSON.stringify({pages:0,rest:{posts:2}}));const c=await checkpointProgress(dir);assert.notEqual(c,b);await writeFile(path.join(dir,'capture-progress.json'),JSON.stringify({renderedPages:2,frames:3}));assert.notEqual(await checkpointProgress(dir),c);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('real bounded downloads automatically finish without refetching saved assets',async()=>{
 const {createServer}=await import('node:http'),{localize}=await import('../engine/assets.mjs'),{SafeNetwork}=await import('../engine/network.mjs');
 const counts=new Map(),server=createServer((req,res)=>{if(req.url==='/robots.txt'){res.statusCode=404;return res.end();}counts.set(req.url,(counts.get(req.url)||0)+1);res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>');});await new Promise(r=>server.listen(0,'127.0.0.1',r));const dir=await mkdtemp(path.join(os.tmpdir(),'auto-resume-assets-')),source='http://127.0.0.1:'+server.address().port;let media=[],attempts=0;
 try{await runWithAutoResume(async()=>{attempts++;const model={source,pages:[{url:source,route:'/',content:Array.from({length:8},(_,i)=>`<img src="${source}/${i}.svg">`).join(''),css:[],inlineCss:[]}],media:[...media],warnings:[],metrics:{}};try{await localize(model,new SafeNetwork({fixtureOrigins:[source],maxRequests:4}),dir,{onCheckpoint:async saved=>{media=[...saved];await writeFile(path.join(dir,'asset-cache.json'),JSON.stringify({media}));}});}finally{media=model.media;}},{dir,disk:defaults.disk,sleep:defaults.sleep});assert.ok(attempts>1);assert.equal(media.length,8);assert.equal(counts.size,8);assert.ok([...counts.values()].every(n=>n===1));}
 finally{await new Promise(r=>server.close(r));await rm(dir,{recursive:true,force:true});}
});
