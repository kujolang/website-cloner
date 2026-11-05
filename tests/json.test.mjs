import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {writeJSON,readJSON} from '../engine/json.mjs';
test('streamed checkpoints retain JSON compatibility and preserve prior file on failed serialization',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'stream-json-')),file=path.join(dir,'model.json');
 try{const model={pages:Array.from({length:12},(_,id)=>({id,html:'é🦊\\\"\n'.repeat(20000)})),nil:null};await writeJSON(file,model);assert.deepEqual(await readJSON(file),model);assert.deepEqual(JSON.parse(await readFile(file,'utf8')),model);const cycle={};cycle.self=cycle;await assert.rejects(writeJSON(file,cycle));assert.deepEqual(await readJSON(file),model);await assert.rejects(access(file+'.tmp'));}finally{await rm(dir,{recursive:true,force:true});}
});
test('concurrent checkpoint writes use isolated temporary files',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'concurrent-json-')),file=path.join(dir,'state.json');
 try {
  const values=Array.from({length:12},(_,id)=>({id,payload:String(id).repeat(100000)}));
  await Promise.all(values.map(value=>writeJSON(file,value)));
  const result=await readJSON(file);assert.deepEqual(result,values[result.id]);
  const {readdir}=await import('node:fs/promises');assert.deepEqual(await readdir(dir),['state.json']);
 } finally {await rm(dir,{recursive:true,force:true});}
});
