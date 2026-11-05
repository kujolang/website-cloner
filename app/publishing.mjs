import {mkdir,readFile,writeFile,rename,readdir,cp,rm,lstat} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {providerOK,connectAccount,listSites,createSite,destination,outputFiles,uploadGithub,providerReady,verifyLive} from './publishing-providers.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
export async function command(file,args,{cwd,env,timeout=900000}={}){
 return new Promise((resolve,reject)=>{
  const child=spawn(file,args,{cwd,env,stdio:['ignore','pipe','pipe'],detached:process.platform!=='win32'});let output='';
  const kill=()=>{try{if(process.platform!=='win32')process.kill(-child.pid,'SIGKILL');else child.kill('SIGKILL');}catch{}};
  const exitHandler=()=>kill();process.once('exit',exitHandler);
  const timer=setTimeout(kill,timeout);const collect=chunk=>{output=(output+chunk.toString()).slice(-12000);};child.stdout.on('data',collect);child.stderr.on('data',collect);
  child.once('error',reject);child.once('close',(code)=>{clearTimeout(timer);process.removeListener('exit',exitHandler);if(code===0)resolve(output);else reject(Error('Deployment command failed or timed out. Check provider permissions, upload limits, and build requirements.'));});
 });
}
function cleanEnv(){return {PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,CI:'true',...(process.env.KUJO_BIN?{KUJO_BIN:process.env.KUJO_BIN}:{}),...(process.env.CWEBP_BIN?{CWEBP_BIN:process.env.CWEBP_BIN}:{})};}
export async function prepareOutput(source,folder,target,event){
 await event('Preparing a separate copy for this hosting URL');
 await cp(source,folder,{recursive:true,filter:async(src)=>{
  if((await lstat(src)).isSymbolicLink())throw Error('Publishing does not follow project symbolic links.');
  const rel=path.relative(source,src),top=rel.split(path.sep)[0];return !['output','.ssg-output','.ssg-content','.ssg-templates','.git','node_modules'].includes(top)&&!path.basename(src).startsWith('.env');
 }});
 const configPath=path.join(folder,'kujo-ssg.json');const config=JSON.parse(await readFile(configPath,'utf8'));config.site_url=target.url;config.base_path=target.basePath;config.output='output';await writeFile(configPath,JSON.stringify(config));
 await event('Building for '+target.url);
 await command(process.execPath,['scripts/build.mjs'],{cwd:folder,env:{...cleanEnv(),SITE_URL:target.url,BASE_PATH:target.basePath||'/'}});
 return path.join(folder,'output');
}
export async function createPublishing({data,fetcher=fetch,build=prepareOutput,runner=command,verify=verifyLive,wait=sleep,attempts=90,pollMs=10000}={}){
 const storage=path.join(data,'.publishing');await mkdir(storage,{recursive:true,mode:0o700});
 const connections=new Map(),runs=new Map(),activeJobs=new Set();let active=null,accountBusy=false;
 const save=async(run)=>{const file=path.join(storage,run.id+'.json');await writeFile(file+'.tmp',JSON.stringify(run),{mode:0o600});await rename(file+'.tmp',file);};
 for(const file of await readdir(storage)){if(!/^[a-f0-9]{40}\.json$/.test(file))continue;try{const run=JSON.parse(await readFile(path.join(storage,file),'utf8'));if(run.id+'.json'!==file)continue;if(run.status==='running'){run.status='interrupted';run.error='Builder restarted. The provider may have received the upload. Reconnect and check the deployment before publishing again.';await save(run);}runs.set(run.id,run);await rm(path.join(storage,run.id),{recursive:true,force:true});}catch{}}
 function connected(provider){const c=connections.get(provider);if(!c)throw Error('Connect your own '+provider+' account first.');return c;}
 function safeConnection(c){if(!c)return {connected:false};const {token,...safe}=c;return {connected:true,...safe};}
 const status=()=>Object.fromEntries(['github','cloudflare'].map(p=>[p,safeConnection(connections.get(p))]));
 async function accountAction(action){if(active||accountBusy)throw Error('Wait for the current hosting operation to finish.');accountBusy=true;try{return await action();}finally{accountBusy=false;}}
 async function publish(job,input){
  if(active||accountBusy)throw Error('Another hosting operation is running.');
  if(job.status!=='complete')throw Error('Wait for the migration to finish before publishing.');
  if(!providerOK(input.provider)||input.confirmed!==true)throw Error('Confirm the public destination before publishing.');
  const connection=connected(input.provider);
  if(!/^[a-f0-9]{48}$/.test(job.id))throw Error('Invalid migration');
  const id=randomBytes(20).toString('hex');const run={id,jobId:job.id,provider:input.provider,status:'running',stage:'Checking destination',events:[],createdAt:new Date().toISOString(),liveVerified:false};
  active=id;activeJobs.add(job.id);runs.set(id,run);
  const event=async(stage,counts={})=>{run.stage=stage;Object.assign(run,counts);run.events.push({stage,at:new Date().toISOString()});run.events=run.events.slice(-100);await save(run);};
  try{await save(run);}catch(e){active=null;activeJobs.delete(job.id);throw e;}
  const folder=path.join(storage,id);
  void (async()=>{
   try{
    const target=await destination(input.provider,connection,input,fetcher);run.target=target;await event('Destination confirmed: '+target.site);
    const output=await build(path.join(data,job.id,'project'),folder,target,event);
    await writeFile(path.join(output,`cloner-deploy-${id}.txt`),id+'\n');
    await outputFiles(output,input.provider);
    if(input.provider==='github')Object.assign(run,await uploadGithub(output,target,connection,run,event,fetcher));
    else {
     await event('Uploading files to Cloudflare Pages');
     const uploadCwd=path.join(folder,'.upload-runner');await mkdir(uploadCwd);await writeFile(path.join(uploadCwd,'empty.env'),'');
     await runner(process.execPath,[path.join(root,'node_modules/wrangler/bin/wrangler.js'),'--env-file',path.join(uploadCwd,'empty.env'),'pages','deploy',output,'--project-name',target.site,'--branch',target.branch,'--commit-hash',id,'--commit-message','Website Cloner '+id,'--commit-dirty=false'],{cwd:uploadCwd,env:{...cleanEnv(),HOME:uploadCwd,XDG_CONFIG_HOME:path.join(folder,'.config'),CLOUDFLARE_API_TOKEN:connection.token,CLOUDFLARE_ACCOUNT_ID:target.account,WRANGLER_SEND_METRICS:'false',WRANGLER_LOG_PATH:path.join(folder,'.wrangler-logs')}});
    }
    await event('Waiting for the provider to finish this deployment');
    for(let attempt=0;attempt<attempts;attempt++){
     if(await providerReady(input.provider,connection,target,run,fetcher)){
      await event('Verifying the published homepage and deployment marker');
      let live=false;try{live=await verify(target.url,id);}catch{}
      if(live){run.liveVerified=true;run.url=target.url;run.finishedAt=new Date().toISOString();await event('Published and verified');return;}
     }
     await wait(pollMs);
    }
    throw Error('Verification timed out. The upload may be live, but this exact deployment could not be verified. Check your provider dashboard before retrying.');
   }catch(e){run.error=String(e.message).split(connection.token).join('[redacted]');await event('Publishing needs attention').catch(()=>{});}
   finally{await rm(folder,{recursive:true,force:true}).catch(()=>{});const final={...run,status:run.liveVerified?'complete':'failed',finishedAt:new Date().toISOString()};await save(final).catch(()=>{});Object.assign(run,final);activeJobs.delete(job.id);active=null;}
  })();
  return {...run};
 }
 return {
  activeJobs,status,publish,
  connect:(provider,token)=>accountAction(async()=>{const identity=await connectAccount(provider,token,fetcher);connections.set(provider,{token,...identity});return safeConnection(connections.get(provider));}),
  disconnect:provider=>accountAction(async()=>{connections.delete(provider);return {connected:false};}),
  sites:async(provider,account)=>listSites(provider,connected(provider),account,fetcher),
  create:(provider,input)=>accountAction(()=>createSite(provider,connected(provider),input,fetcher)),
  get:id=>{const run=runs.get(id);if(!run)throw Object.assign(Error('Deployment not found'),{statusCode:404});return {...run};},
  history:jobId=>[...runs.values()].filter(r=>r.jobId===jobId).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).map(r=>({...r})),
 };
}
