import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import http from 'node:http';import {mkdtemp,rm,readFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const port=async()=>{const server=http.createServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));const n=server.address().port;await new Promise(r=>server.close(r));return n;};
test('browser API requires review, continues without AI and preserves checkpoints on stop',{timeout:180000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'browser-api-')),appPort=await port(),previewPort=await port(),origin='http://127.0.0.1:'+appPort;
 const fixture=http.createServer((req,res)=>{
  if(req.url==='/robots.txt'){res.end('User-agent: *\nAllow: /');return;}
  if(req.url!=='/'){res.writeHead(404);res.end('Not found');return;}
  res.setHeader('Content-Type','text/html');res.end('<!doctype html><html lang="en"><head><title>Browser fixture</title><meta name="description" content="A simple isolated browser capture fixture."><link rel="icon" href="data:,"><style>body{background:white;color:black;margin:24px}main{max-width:600px}h1{font-size:32px}</style></head><body><main><h1>Browser capture fixture</h1><p>This content must remain editable in the native static site export.</p></main></body></html>');
 });await new Promise(r=>fixture.listen(0,'127.0.0.1',r));const source='http://127.0.0.1:'+fixture.address().port;
 const server=spawn(process.execPath,['app/server.mjs'],{env:{...process.env,PORT:String(appPort),PREVIEW_PORT:String(previewPort),MIGRATION_DATA_DIR:dir,FIXTURE_ORIGINS:source},stdio:['ignore','ignore','pipe']});let errors='';server.stderr.on('data',x=>errors+=x);
 const headers={Origin:origin,'Content-Type':'application/json'};
 const post=async(route,data={})=>{const r=await fetch(origin+route,{method:'POST',headers,body:JSON.stringify(data)});return {status:r.status,data:await r.json()};};
 const waitJob=async(id,predicate)=>{const deadline=Date.now()+120000;let last;while(Date.now()<deadline){const job=await(await fetch(origin+'/api/jobs/'+id)).json();last={status:job.status,stage:job.stage};if(predicate(job))return job;if(job.status==='failed')throw Error(job.error);await sleep(300);}throw Error('Job timeout '+JSON.stringify(last)+' '+errors);};
 try{
  for(let i=0;i<100;i++){try{if((await fetch(origin)).ok)break;}catch{}await sleep(100);}
  const started=await post('/api/jobs',{url:source+'/',transport:'browser',modelKey:'',maxPages:1});assert.equal(started.status,202);
  const id=started.data.id;const waiting=await waitJob(id,j=>j.browserWaiting===true);assert.equal(waiting.options.aiEnabled,false);
  assert.equal((await post('/api/jobs/'+id+'/browser-continue')).status,202);
  const done=await waitJob(id,j=>j.status==='complete');assert.equal(done.options.transport,'browser');assert.equal(done.summary.captureTransport,'browser');assert.equal(done.summary.metrics.aiCalls,0);assert.ok(done.summary.pages.length);
  assert.equal((await fetch(done.preview.replace('127.0.0.1:4311','127.0.0.1:'+previewPort))).status,200);
  const next=await post('/api/jobs',{url:source+'/',transport:'browser',maxPages:1});assert.equal(next.status,202);await waitJob(next.data.id,j=>j.browserWaiting===true);
  assert.equal((await post('/api/jobs/'+next.data.id+'/stop')).status,200);
  const stopped=JSON.parse(await readFile(path.join(dir,next.data.id,'job.json')));assert.equal(stopped.status,'cancelled');assert.equal((await post('/api/jobs/'+next.data.id+'/browser-continue')).status,409);
 }finally{server.kill('SIGTERM');await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));fixture.closeAllConnections();await new Promise(r=>fixture.close(r));await rm(dir,{recursive:true,force:true});}
});
