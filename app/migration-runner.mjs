import {fork,execFileSync} from 'node:child_process';
import {readJSON} from '../engine/json.mjs';
import path from 'node:path';
export const stoppedError=()=>Object.assign(Error('Migration stopped. Saved checkpoints are retained.'),{code:'USER_STOPPED'});
const children=new Set();
function terminate(child){
 if(!child.pid)return;
 try{if(process.platform==='win32')execFileSync('taskkill',['/pid',String(child.pid),'/T','/F'],{stdio:'ignore'});else process.kill(-child.pid,'SIGKILL');}catch(error){if(error.code!=='ESRCH')child.kill('SIGKILL');}
}
const cleanup=()=>{for(const child of children)terminate(child);};
process.once('exit',cleanup);
for(const signal of ['SIGTERM','SIGINT'])process.once(signal,()=>{cleanup();process.exit(0);});
export async function runMigration(url,dir,options,{signal,event=()=>{},onControl=()=>{},worker=new URL('./migration-worker.mjs',import.meta.url)}={}){
 signal?.throwIfAborted();
 await new Promise((resolve,reject)=>{
  const child=fork(worker,[],{detached:process.platform!=='win32',stdio:['ignore','inherit','inherit','ipc'],serialization:'advanced'});children.add(child);
  onControl({continueBrowser:()=>child.connected&&child.send({browserContinue:true})});
  let error,done=false;
  const stop=()=>{error=stoppedError();terminate(child);};signal?.addEventListener('abort',stop,{once:true});
  child.on('message',message=>{
   if(signal?.aborted||error)return;
   try {
    if(message.event)event(message.event.stage,message.event.counts);
    if(message.error)error=Object.assign(Error(message.error.message),{code:message.error.code,retryAfterMs:message.error.retryAfterMs,requiredFreeBytes:message.error.requiredFreeBytes});
    if(message.done)done=true;
   } catch(e) {error=e;terminate(child);}
  });
  child.once('error',e=>{error=e;});
  child.once('close',()=>{children.delete(child);signal?.removeEventListener('abort',stop);if(signal?.aborted)reject(stoppedError());else if(error||!done)reject(error||Error('Migration worker exited before completion'));else resolve();});
  if(signal?.aborted)stop();else child.send({url,dir,options});
 });
 return {report:await readJSON(path.join(dir,'report.json'))};
}
