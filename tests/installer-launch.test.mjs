import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import net from 'node:net';
import path from 'node:path';
import os from 'node:os';
const run=promisify(execFile);
async function port(){const s=net.createServer();await new Promise(r=>s.listen(0,'127.0.0.1',r));const n=s.address().port;await new Promise(r=>s.close(r));return n;}
test('launcher waits for HTTP readiness, opens configured URL and stops cleanly',{timeout:30000},async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'cloner-launch-'));
 const builder=await port(),preview=await port();
 const env={...process.env,PATH:path.join(root,'bin')+path.delimiter+process.env.PATH,OPEN_RECORD:path.join(root,'opened')};delete env.PORT;delete env.PREVIEW_PORT;
 const command=action=>run(process.execPath,['scripts/launch.mjs',action],{cwd:root,env,timeout:20000});
 try{
  for(const dir of ['scripts','app','bin'])await mkdir(path.join(root,dir));
  for(const file of ['launch.mjs','server-control.mjs'])await copyFile(new URL('../scripts/'+file,import.meta.url),path.join(root,'scripts',file));
  await writeFile(path.join(root,'.env'),`PORT=${builder}\nPREVIEW_PORT=${preview}\n`);
  await writeFile(path.join(root,'app/server.mjs'),`import http from 'node:http';for(const p of [process.env.PORT,process.env.PREVIEW_PORT])http.createServer((q,r)=>r.end('ready')).listen(Number(p),'127.0.0.1');`);
  await writeFile(path.join(root,'bin',process.platform==='darwin'?'open':'xdg-open'),'#!/bin/sh\nprintf "%s" "$1" > "$OPEN_RECORD"\n',{mode:0o755});
  await command('start');
  let opened;for(let i=0;i<20;i++){try{opened=await readFile(env.OPEN_RECORD,'utf8');break;}catch{await new Promise(r=>setTimeout(r,50));}}
  assert.equal(opened,`http://127.0.0.1:${builder}/`);assert.equal((await fetch(opened)).status,200);
  await command('stop');await assert.rejects(fetch(opened));
 }finally{await command('stop').catch(()=>{});await rm(root,{recursive:true,force:true});}
});
