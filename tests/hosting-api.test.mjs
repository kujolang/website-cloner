import test from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
test('hosting HTTP boundary keeps credentials private and requires origin plus publish confirmation',{timeout:30000},async()=>{
 const data=await mkdtemp(path.join(os.tmpdir(),'cloner-host-api-')),port=44320,origin=`http://127.0.0.1:${port}`,job='a'.repeat(48);let child;
 try{await mkdir(path.join(data,job));await writeFile(path.join(data,job,'job.json'),JSON.stringify({id:job,status:'complete',url:'https://example.org/'}));child=spawn(process.execPath,['app/server.mjs'],{env:{...process.env,PORT:String(port),PREVIEW_PORT:'44321',MIGRATION_DATA_DIR:data},stdio:'ignore'});
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/hosting')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 const get=await (await fetch(origin+'/api/hosting')).json();assert.deepEqual(get,{github:{connected:false},cloudflare:{connected:false}});
 const post=(route,payload,requestOrigin=origin)=>fetch(origin+route,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json'},body:JSON.stringify(payload)});
 assert.equal((await post('/api/hosting/github/connect',{token:'not-sent'},'https://example.org')).status,403);
 const invalid=await post('/api/hosting/github/connect',{token:'short'});assert.equal(invalid.status,400);assert.match((await invalid.json()).error,/valid provider/);
 const publish=await post(`/api/jobs/${job}/deploy`,{provider:'github',site:'person/site'});assert.equal(publish.status,400);assert.match((await publish.json()).error,/Confirm/);
 assert.deepEqual(await (await fetch(origin+`/api/jobs/${job}/deploy`)).json(),{deployments:[]});
 assert.equal((await fetch(origin+'/api/deployments/'+'f'.repeat(40))).status,404);
 assert.equal((await post('/api/hosting/github/disconnect',{})).status,200);
 }finally{if(child?.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await exited;}await rm(data,{recursive:true,force:true});}
});
