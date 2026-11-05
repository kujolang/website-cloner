import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {runMigration} from '../app/migration-runner.mjs';import {runWithAutoResume,canAutoResume} from '../app/auto-resume.mjs';
test('stop terminates worker and its descendant without deleting saved checkpoints',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'migration-stop-'));try{
 const worker=path.join(dir,'worker.mjs');await writeFile(worker,`import {spawn} from 'node:child_process';import {writeFileSync} from 'node:fs';process.once('message',({dir})=>{writeFileSync(dir+'/checkpoint.json','saved');spawn(process.execPath,['-e',"setInterval(()=>require('fs').appendFileSync(process.argv[1],'x'),20)",dir+'/ticks'],{stdio:'ignore'});process.send({event:{stage:'working'}});setInterval(()=>{},1000);});`);
 const controller=new AbortController();let ready;const started=new Promise(r=>ready=r);const running=runMigration('https://example.com',dir,{}, {worker,signal:controller.signal,event:()=>ready()});await started;for(let i=0;i<100;i++){try{await readFile(dir+'/ticks');break;}catch{await new Promise(r=>setTimeout(r,20));}}controller.abort();await assert.rejects(running,e=>e.code==='USER_STOPPED');const ticks=await readFile(dir+'/ticks','utf8');await new Promise(r=>setTimeout(r,100));assert.equal(await readFile(dir+'/ticks','utf8'),ticks);assert.equal(await readFile(dir+'/checkpoint.json','utf8'),'saved');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('stop interrupts disk waiting and cannot automatically resume',async()=>{
 const controller=new AbortController();let attempts=0;
 await assert.rejects(runWithAutoResume(async()=>attempts++,{dir:'.',signal:controller.signal,fingerprint:async()=>'',disk:async()=>0,sleep:()=>new Promise(()=>{}),publish:async()=>controller.abort()}),e=>e.code==='USER_STOPPED');assert.equal(attempts,0);assert.equal(canAutoResume({status:'cancelled',options:{autoResume:false}}),false);
});
test('worker completion returns the persisted report',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'migration-worker-'));try{const worker=path.join(dir,'worker.mjs');await writeFile(worker,`import {writeFileSync} from 'node:fs';process.once('message',({dir})=>{writeFileSync(dir+'/report.json',JSON.stringify({status:'verified'}));process.send({done:true},()=>process.exit(0));});`);assert.deepEqual(await runMigration('https://example.com',dir,{}, {worker}),{report:{status:'verified'}});}finally{await rm(dir,{recursive:true,force:true});}
});
test('progress callback failure terminates its worker and rejects the job instead of crashing the server',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'migration-progress-error-'));
 try {
  const worker=path.join(dir,'worker.mjs');await writeFile(worker,`process.once('message',()=>{process.send({event:{stage:'capture'}});setInterval(()=>{},1000);});`);
  const error=Object.assign(Error('checkpoint disk full'),{code:'ENOSPC'});
  await assert.rejects(runMigration('https://example.com',dir,{}, {worker,event:()=>{throw error;}}),e=>e===error);
 } finally {await rm(dir,{recursive:true,force:true});}
});
