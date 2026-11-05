import {spawn,execFileSync} from 'node:child_process';
import {mkdir,readFile,writeFile,unlink,open} from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import os from 'node:os';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const entry=path.join(root,'app/server.mjs'),state=path.join(root,'.data/server-process.json');
try{process.loadEnvFile(path.join(root,'.env'));}catch(e){if(e.code!=='ENOENT')throw e;}
const port=Number(process.env.PORT||4310),previewPort=Number(process.env.PREVIEW_PORT||4311);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function owned(pid){
 if(!Number.isInteger(pid)||pid<=1)return false;
 try{return execFileSync('ps',['-p',String(pid),'-o','command='],{encoding:'utf8'}).trim()===`${process.execPath} --env-file-if-exists=.env ${entry}`;}catch{return false;}
}
async function saved(){try{return JSON.parse(await readFile(state,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
async function free(port){return new Promise((resolve,reject)=>{const s=net.createServer();s.once('error',reject);s.listen(port,'127.0.0.1',()=>s.close(resolve));});}
async function stop(){
 const record=await saved();if(!record){console.log('Builder is not managed/running.');return;}
 if(!owned(record.pid)){await unlink(state);console.log('Removed stale builder state; no unrelated process was stopped.');return;}
 process.kill(-record.pid,'SIGTERM');
 for(let i=0;i<100&&owned(record.pid);i++)await sleep(100);
 if(owned(record.pid))throw Error('Builder did not stop within 10 seconds; it was not force-killed.');
 await unlink(state);console.log('Builder and preview server stopped.');
}
async function start(){
 const record=await saved();if(record&&owned(record.pid)){console.log(`Builder already running: http://127.0.0.1:${port}/`);return;}
 try{await free(port);await free(previewPort);}catch{throw Error(`Port ${port} or ${previewPort} is occupied. Stop the existing foreground server first; no unrelated process was stopped.`);}
 const log=await open(path.join(root,'.data/server.log'),'a');
 const env={...process.env,PATH:path.join(os.homedir(),'.local/bin')+path.delimiter+process.env.PATH};
 const child=spawn(process.execPath,['--env-file-if-exists=.env',entry],{cwd:root,env,detached:true,stdio:['ignore',log.fd,log.fd]});
 await new Promise((resolve,reject)=>{child.once('spawn',resolve);child.once('error',reject);});child.unref();await log.close();
 await writeFile(state,JSON.stringify({pid:child.pid,startedAt:new Date().toISOString(),port,previewPort},null,2)+'\n');
 for(let i=0;i<100;i++){
  if(!owned(child.pid))throw Error('Builder exited. See .data/server.log.');
  try{const r=await fetch(`http://127.0.0.1:${port}/`,{signal:AbortSignal.timeout(500)});await r.body?.cancel();if(r.ok){console.log(`Builder running: http://127.0.0.1:${port}/\nLogs: .data/server.log`);return;}}catch{}
  await sleep(100);
 }
 throw Error('Builder started but is not ready yet. See .data/server.log; use npm stop to stop it.');
}
await mkdir(path.join(root,'.data'),{recursive:true});
// Serialize lifecycle commands so concurrent starts cannot overwrite process ownership.
let lock;
try{
 const action=process.argv[2];if(!['start','restart','stop'].includes(action))throw Error('Usage: node scripts/server-control.mjs start|restart|stop');
 lock=await open(state+'.lock','wx');
 if(action==='restart'||action==='stop')await stop();
 if(action!=='stop')await start();
}catch(e){console.error(e.code==='EEXIST'?'Another lifecycle command is running. If interrupted, remove .data/server-process.json.lock and retry.':e.message);process.exitCode=1;}
finally{if(lock){await lock.close();await unlink(state+'.lock');}}
