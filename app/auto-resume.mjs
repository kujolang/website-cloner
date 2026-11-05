import {freeBytes,startupFreeBytes,diskReserveBytes} from '../engine/disk-space.mjs';
export {freeBytes} from '../engine/disk-space.mjs';
import {readJSON} from '../engine/json.mjs';
import path from 'node:path';
export const minimumFreeBytes=startupFreeBytes;
// Counts/cursors from durable checkpoints, not timestamps or requests attempted.
export async function checkpointProgress(dir){
 const read=async name=>{try{return await readJSON(path.join(dir,name));}catch(e){if(e.code==='ENOENT')return {};throw e;}};
 const [crawl,assets,capture]=await Promise.all([read('resume-progress.json'),read('asset-cache.json'),read('capture-progress.json')]);
 return JSON.stringify({crawl,capture:{renderedPages:capture.renderedPages||0,frames:capture.frames||0},assets:assets.media?.length||0,completedPages:assets.progress?.completedPages||0,bytes:(assets.media||[]).reduce((n,a)=>n+(a.bytes||0),0)});
}
export function canAutoResume(job){return job.options?.autoResume===true&&(['running','waiting'].includes(job.status)||(job.status==='failed'&&['CRAWL_BUDGET','ENOSPC','DISK_SPACE','SOURCE_UNAVAILABLE'].includes(job.errorCode)));}
export async function runWithAutoResume(attempt,{dir,resume=false,state={},publish=async()=>{},fingerprint=()=>checkpointProgress(dir),disk=()=>freeBytes(dir),sleep=ms=>new Promise(r=>setTimeout(r,ms)),signal,now=Date.now,retryDelay=5000,diskDelay=30000}={}){
 state.retries ||= 0;state.stalled ||= 0;if(state.diskPolicyVersion!==2){state.requiredFreeBytes=minimumFreeBytes;state.diskPolicyVersion=2;}
 state.requiredFreeBytes ||= minimumFreeBytes;
 const check=()=>{if(signal?.aborted)throw Object.assign(Error("Migration stopped. Saved checkpoints are retained."),{code:"USER_STOPPED"});};
 check();let previous=await fingerprint();
 const waiting=async(reason,delay)=>{state.reason=reason;state.nextAttemptAt=new Date(now()+delay).toISOString();await publish('waiting',state);await new Promise((resolve,reject)=>{const abort=()=>reject(Object.assign(Error('Migration stopped'),{code:'USER_STOPPED'}));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();Promise.resolve(sleep(delay)).then(resolve,reject).finally(()=>signal?.removeEventListener('abort',abort));});check();};
 while(true){
  check();
  while(await disk()<state.requiredFreeBytes)await waiting('disk-space',diskDelay);
  check();delete state.nextAttemptAt;delete state.reason;await publish('running',state);
  try{return await attempt({resume});}
  catch(error){
   if(error.code==='DISK_SPACE'){
    state.requiredFreeBytes=Math.max(diskReserveBytes,Number(error.requiredFreeBytes)||minimumFreeBytes);
    resume=true;continue;
   }
   if(error.code==='ENOSPC'){
    // Repeated disk failures need additional headroom, not a tight retry loop.
    state.requiredFreeBytes=Math.max(state.requiredFreeBytes+diskReserveBytes,(await disk())+diskReserveBytes);
    resume=true;continue;
   }
   if(error.code==='SOURCE_UNAVAILABLE'){
    state.lastSourceError={message:error.message,at:new Date(now()).toISOString()};
    const current=await fingerprint();
    state.sourceRetries=current===previous?(state.sourceRetries||0)+1:1;previous=current;
    if(state.sourceRetries>5)throw Object.assign(Error('Source remains unavailable after five automatic retries. Saved pages and assets are retained; resume when the source responds.'),{code:'SOURCE_UNAVAILABLE_EXHAUSTED'});
    resume=true;await waiting('source-unavailable',Math.max(Math.min(3600000,Number(error.retryAfterMs)||0),Math.min(300000,30000*state.sourceRetries)));continue;
   }
   if(error.code!=='CRAWL_BUDGET')throw error;
   const current=await fingerprint();state.stalled=current===previous?state.stalled+1:0;previous=current;
   if(state.stalled>=3)throw Object.assign(Error('Automatic resume stopped after three budget pauses without checkpoint progress. Inspect the source or resource limits, then resume.'),{code:'AUTO_RESUME_STALLED'});
   state.retries++;resume=true;await waiting('resource-budget',retryDelay);
  }
 }
}
