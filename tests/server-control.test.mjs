import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
const run=promisify(execFile);
const listen=s=>new Promise(r=>s.listen(0,'127.0.0.1',()=>r(s.address().port)));
const close=s=>new Promise(r=>s.close(r));
test('managed lifecycle is idempotent, restarts both listeners, and refuses unrelated processes',{skip:process.platform==='win32',timeout:30000},async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'builder-lifecycle-'));
 const a=net.createServer(),b=net.createServer();const port=await listen(a),preview=await listen(b);await close(a);await close(b);
 const env={...process.env,PORT:String(port),PREVIEW_PORT:String(preview)};
 const command=action=>run(process.execPath,['scripts/server-control.mjs',action],{cwd:root,env,timeout:15000});
 const state=()=>readFile(path.join(root,'.data/server-process.json'),'utf8').then(JSON.parse);
 try{
  await mkdir(path.join(root,'scripts'));await mkdir(path.join(root,'app'));
  await copyFile(new URL('../scripts/server-control.mjs',import.meta.url),path.join(root,'scripts/server-control.mjs'));
  await writeFile(path.join(root,'app/server.mjs'),`import http from 'node:http';for(const port of [process.env.PORT,process.env.PREVIEW_PORT])http.createServer((q,r)=>r.end('ready')).listen(Number(port),'127.0.0.1');`);
  await command('start');const first=(await state()).pid;await command('start');assert.equal((await state()).pid,first);
  await command('restart');assert.notEqual((await state()).pid,first);
  for(const p of [port,preview]){const r=await fetch('http://127.0.0.1:'+p);assert.equal(await r.text(),'ready');}
  await command('stop');await command('stop');
  for(const p of [port,preview])await assert.rejects(fetch('http://127.0.0.1:'+p));
  await writeFile(path.join(root,'.data/server-process.json'),JSON.stringify({pid:process.pid}));
  assert.match((await command('stop')).stdout,/no unrelated process/);assert.doesNotThrow(()=>process.kill(process.pid,0));
  const foreign=net.createServer();await new Promise(r=>foreign.listen(port,'127.0.0.1',r));
  try{await assert.rejects(command('start'),e=>e.stderr.includes('occupied'));assert.equal(foreign.listening,true);}finally{await close(foreign);}
 }finally{await command('stop').catch(()=>{});await rm(root,{recursive:true,force:true});}
});
