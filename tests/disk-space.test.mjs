import test from 'node:test';import assert from 'node:assert/strict';
import {diskRequirement,checkDiskSpace,startupFreeBytes} from '../engine/disk-space.mjs';
import {runWithAutoResume,canAutoResume} from '../app/auto-resume.mjs';
test('small migrations start below 2GB; stage estimates scale with real media',async()=>{
 assert.equal(startupFreeBytes,256e6);await checkDiskSpace('.', {disk:async()=>600e6});
 const small={pages:Array.from({length:10},()=>({content:'a'.repeat(50000)})),media:[{bytes:44e6}]};
 assert.ok(diskRequirement(small)<300e6);await checkDiskSpace('.',{model:small,disk:async()=>600e6});
 const large={...small,media:[{bytes:2e9}]};assert.ok(diskRequirement(large)>4e9);
 await assert.rejects(checkDiskSpace('.',{model:large,disk:async()=>600e6}),e=>e.code==='DISK_SPACE'&&e.requiredFreeBytes>4e9);
});
test('measured disk pauses retain checkpoint and resume without a fixed gigabyte increase',async()=>{
 let calls=0,free=600e6;const states=[];const state={requiredFreeBytes:2e9};
 const result=await runWithAutoResume(async({resume})=>{if(++calls===1)throw Object.assign(Error('need output room'),{code:'DISK_SPACE',requiredFreeBytes:700e6});assert.equal(resume,true);return 'done';},{state,disk:async()=>free,fingerprint:async()=>'',sleep:async()=>{free=750e6},publish:async(status,s)=>states.push({status,...s})});
 assert.equal(result,'done');assert.equal(calls,2);assert.equal(states.filter(s=>s.status==='waiting').length,1);assert.ok(states.some(s=>s.requiredFreeBytes===700e6));assert.equal(canAutoResume({status:'failed',errorCode:'DISK_SPACE',options:{autoResume:true}}),true);
});
test('worker transports measured disk requirement back to the same-job resume controller',async()=>{
 const {mkdtemp,writeFile,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {runMigration}=await import('../app/migration-runner.mjs');const dir=await mkdtemp(tmpdir()+'/disk-worker-');
 try{const worker=dir+'/worker.mjs';await writeFile(worker,"process.once('message',()=>process.send({error:{message:'More room needed',code:'DISK_SPACE',requiredFreeBytes:712000000}},()=>process.exit(1)));");await assert.rejects(runMigration('https://example.com',dir,{}, {worker}),e=>e.code==='DISK_SPACE'&&e.requiredFreeBytes===712000000);}finally{await rm(dir,{recursive:true,force:true});}
});
