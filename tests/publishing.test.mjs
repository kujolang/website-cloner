import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,readdir,symlink} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {createPublishing} from '../app/publishing.mjs';
import {connectAccount,listSites,createSite,destination,uploadGithub,providerReady,verifyLive,outputFiles,pagesBranch} from '../app/publishing-providers.mjs';
const token='own-user-token-12345',account='a'.repeat(32),jobId='b'.repeat(48);
const response=(data,status=200)=>new Response(JSON.stringify(data),{status});
function githubMock(){const calls=[];let committed=false;return {calls,fetcher:async(url,o)=>{const u=new URL(url),p=u.pathname,b=o.body?JSON.parse(o.body):null;calls.push({p,method:o.method,body:b,auth:o.headers.authorization});
 if(p==='/user')return response({login:'person'});
 if(p==='/user/repos'&&o.method==='GET')return response([{full_name:'person/site',permissions:{admin:true},private:false},{full_name:'other/no',permissions:{admin:false}}]);
 if(p==='/user/repos')return response({full_name:'person/'+b.name});
 if(p==='/repos/person/site')return response({owner:{login:'person'},name:'site',full_name:'person/site',default_branch:'main',permissions:{admin:true}});
 if(p.endsWith('/pages'))return o.method==='GET'?response({},404):response({});
 if(p.endsWith('/git/ref/heads/main'))return response({object:{sha:'main-sha'}});
 if(p.endsWith('/git/ref/heads/'+pagesBranch))return response({},404);
 if(p.endsWith('/git/blobs'))return response({sha:'blob'});
 if(p.endsWith('/git/trees'))return response({sha:'tree'});
 if(p.endsWith('/git/commits')){committed=true;return response({sha:'new-commit'});}
 if(p.endsWith('/git/refs'))return response({});
 if(p.endsWith('/pages/builds'))return response(o.method==='POST'?{}:[{commit:'old',status:'built'},...(committed?[{commit:'new-commit',status:'built'}]:[])]);
 throw Error('Unexpected '+o.method+' '+url);
 }};}
const fakeBuild=async(source,folder,target,event)=>{await event('Fixture destination build');await mkdir(path.join(folder,'output'),{recursive:true});await writeFile(path.join(folder,'output/index.html'),'<h1>'+target.url+'</h1>');return path.join(folder,'output');};
async function terminal(service,id){for(let i=0;i<200;i++){const run=service.get(id);if(run.status!=='running')return run;await new Promise(r=>setTimeout(r,5));}throw Error('Run did not settle');}
test('own GitHub connection, site creation and dedicated-branch publishing require exact deployment + live marker',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'cloner-host-')),mock=githubMock();
 try{const service=await createPublishing({data:dir,fetcher:mock.fetcher,build:fakeBuild,verify:async(url,id)=>{assert.equal(url,'https://person.github.io/site/');assert.equal(id.length,40);return true;},wait:async()=>{},attempts:2});
 const identity=await service.connect('github',token);assert.equal(identity.login,'person');assert.equal(JSON.stringify(service.status()).includes(token),false);
 assert.equal((await service.sites('github')).length,1);assert.equal((await service.create('github',{name:'new-site'})).id,'person/new-site');
 await assert.rejects(service.publish({id:jobId,status:'complete'},{provider:'github',site:'person/site'}),/Confirm/);
 const r=await service.publish({id:jobId,status:'complete'},{provider:'github',site:'person/site',confirmed:true});await assert.rejects(service.disconnect('github'),/Wait/);
 const done=await terminal(service,r.id);assert.equal(done.status,'complete',done.error);assert.equal(done.liveVerified,true);assert.equal(service.activeJobs.size,0);
 assert.ok(mock.calls.every(c=>c.auth==='Bearer '+token));assert.equal(mock.calls.find(c=>c.p.endsWith('/git/trees')).body.base_tree,undefined);
 assert.equal(mock.calls.find(c=>c.p.endsWith('/git/refs')).body.ref,'refs/heads/'+pagesBranch);assert.ok(!mock.calls.some(c=>c.method==='PATCH'&&c.p.endsWith('/heads/main')));
 const stored=await readFile(path.join(dir,'.publishing',r.id+'.json'),'utf8');assert.ok(!stored.includes(token));assert.ok(!(await readdir(path.join(dir,'.publishing'))).includes(r.id));
 await service.disconnect('github');assert.equal(service.status().github.connected,false);
 const restart=await createPublishing({data:dir});assert.equal(restart.get(r.id).url,done.url);assert.equal(restart.status().github.connected,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Cloudflare connection scopes, Direct Upload and exact commit verification use only supplied credentials',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'cloner-cf-'));let deploymentId,received;
 const fetcher=async(url,o)=>{const p=new URL(url).pathname;assert.equal(o.headers.authorization,'Bearer '+token);let data;
 if(p.endsWith('/accounts'))data=[{id:account,name:'My account'}];
 else if(p.endsWith('/projects'))data=o.method==='POST'?{name:'new-site'}:[{name:'site'},{name:'git-site',source:{type:'github'}}];
 else if(p.endsWith('/projects/site'))data={name:'site',subdomain:'site.pages.dev',production_branch:'main'};
 else if(p.endsWith('/deployments')){assert.equal(new URL(url).searchParams.get('per_page'),'10');data=[{id:'old',deployment_trigger:{metadata:{commit_hash:'old'}},latest_stage:{status:'success'}},{id:'exact',deployment_trigger:{metadata:{commit_hash:deploymentId}},latest_stage:{status:'success'}}];}
 else throw Error(url);return response({success:true,result:data});};
 try{const service=await createPublishing({data:dir,fetcher,build:fakeBuild,runner:async(file,args,options)=>{received={file,args,options};deploymentId=args[args.indexOf('--commit-hash')+1];},verify:async()=>true,wait:async()=>{},attempts:2});
 await service.connect('cloudflare',token);assert.equal((await service.sites('cloudflare',account)).length,1);await assert.rejects(service.sites('cloudflare','f'.repeat(32)),/Select/);
 const r=await service.publish({id:jobId,status:'complete'},{provider:'cloudflare',site:'site',account,confirmed:true}),done=await terminal(service,r.id);assert.equal(done.status,'complete',done.error);assert.equal(done.providerDeploymentId,'exact');assert.equal(received.options.env.CLOUDFLARE_API_TOKEN,token);assert.equal(received.options.env.CLOUDFLARE_ACCOUNT_ID,account);assert.ok(received.args.some(a=>a.endsWith('node_modules/wrangler/bin/wrangler.js')));assert.equal(received.options.env.AI_API_KEY,undefined);assert.deepEqual(received.args.slice(1,3),['pages','deploy']);assert.match(received.args.at(-1),/^--env-file=.+empty\.env$/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('old provider success or an old live marker cannot mark this deployment verified',async()=>{
 assert.equal(await providerReady('github',{token},{site:'person/site'},{commit:'new'},async()=>response([{commit:'old',status:'built'}])),false);
 assert.equal(await providerReady('cloudflare',{token},{site:'site',account},{id:'new'},async()=>response({success:true,result:[{deployment_trigger:{metadata:{commit_hash:'old'}},latest_stage:{status:'success'}}]})),false);
 assert.equal(await verifyLive('https://site.pages.dev/','new',{raw:async()=>({status:200,body:Buffer.from('old'),headers:{'content-type':'text/html'}})}),false);
 let calls=0;assert.equal(await verifyLive('https://site.pages.dev/','new',{raw:async()=>({status:200,body:Buffer.from(++calls===1?'new':'<html>'),headers:{'content-type':'text/html'}})}),true);
 await assert.rejects(verifyLive('http://127.0.0.1/','new'),/Invalid/);
});
test('publish failures are persisted, secrets redacted, locks and staging released; restarts do not republish',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'cloner-fail-'));const mock=githubMock();
 try{const s=await createPublishing({data:dir,fetcher:mock.fetcher,build:async()=>{throw Error('Do not leak '+token);}});await s.connect('github',token);
 const r=await s.publish({id:jobId,status:'complete'},{provider:'github',site:'person/site',confirmed:true}),done=await terminal(s,r.id);assert.equal(done.status,'failed');assert.ok(!JSON.stringify(done).includes(token));assert.equal(s.activeJobs.size,0);
 await writeFile(path.join(dir,'.publishing',r.id+'.json'),JSON.stringify({...done,status:'running'}));const restart=await createPublishing({data:dir});assert.equal(restart.get(r.id).status,'interrupted');assert.equal(restart.status().github.connected,false);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('output guard rejects symlinks and credentials; target selection rejects traversal',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'cloner-files-'));try{await writeFile(path.join(dir,'index.html'),'x');await writeFile(path.join(dir,'.env'),'secret');await assert.rejects(outputFiles(dir,'github'),/credential/);await rm(path.join(dir,'.env'));await symlink('/tmp',path.join(dir,'linked'));await assert.rejects(outputFiles(dir,'cloudflare'),/symbolic/);await assert.rejects(destination('github',{token},{site:'../..'}),/Select/);}finally{await rm(dir,{recursive:true,force:true});}
});
test('existing unmanaged publish branches are refused before upload; API errors do not expose tokens',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'cloner-branch-'));try{await writeFile(path.join(dir,'index.html'),'ok');let uploads=0;
 const fetcher=async(url,o)=>{if(url.includes('/git/ref/'))return response({object:{sha:'existing'}});if(url.includes('/contents/'))return response({},404);if(url.includes('/git/blobs'))uploads++;throw Error('Unexpected upload');};
 await assert.rejects(uploadGithub(dir,{site:'person/site',defaultBranch:'main'},{token},{id:'x'},async()=>{},fetcher),/not managed/);assert.equal(uploads,0);
 await assert.rejects(connectAccount('github',token,async()=>response({message:token},401)),e=>!e.message.includes(token)&&/401/.test(e.message));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('provider readiness without a matching live marker times out without claiming success',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'cloner-timeout-')),mock=githubMock();try{const s=await createPublishing({data:dir,fetcher:mock.fetcher,build:fakeBuild,verify:async()=>false,wait:async()=>{},attempts:2});await s.connect('github',token);const r=await s.publish({id:jobId,status:'complete'},{provider:'github',site:'person/site',confirmed:true});const done=await terminal(s,r.id);assert.equal(done.status,'failed');assert.equal(done.liveVerified,false);assert.equal(done.url,undefined);assert.match(done.error,/Verification timed out/);}finally{await rm(dir,{recursive:true,force:true});}
});
test('Cloudflare account enumeration obeys its 50-row limit and follows returned pagination',async()=>{
 const calls=[];
 const identity=await connectAccount('cloudflare',token,async url=>{const u=new URL(url);calls.push(u);assert.equal(u.searchParams.get('per_page'),'50');const page=Number(u.searchParams.get('page'));return response({success:true,result:[{id:String(page).padStart(32,'0'),name:'Account '+page}],result_info:{page,per_page:1,total_count:2,total_pages:2}});});
 assert.equal(calls.length,2);assert.equal(identity.accounts.length,2);
});

test('pending GitHub Pages certificates target HTTPS without weakening live verification',async()=>{
 const mock=githubMock();
 const fetcher=async(url,o)=>url.endsWith('/pages')?response({html_url:'http://demo.example.com/'}):mock.fetcher(url,o);
 const target=await destination('github',{token},{site:'person/site'},fetcher);
 assert.equal(target.url,'https://demo.example.com/');assert.equal(target.basePath,'');
 for(const html_url of ['ftp://demo.example.com/','http://user:password@demo.example.com/']){
  await assert.rejects(destination('github',{token},{site:'person/site'},async(url,o)=>url.endsWith('/pages')?response({html_url}):mock.fetcher(url,o)),/Invalid Pages URL/);
 }
});

test('Cloudflare project listing stays within supported page sizes and follows pagination',async()=>{
 const calls=[];const sites=await listSites('cloudflare',{token,accounts:[{id:account}]},account,async url=>{const u=new URL(url);calls.push(u);assert.equal(u.searchParams.get('per_page'),'10');const page=Number(u.searchParams.get('page'));return response({success:true,result:[{name:'site-'+page}],result_info:{page,per_page:1,total_count:2,total_pages:2}});});
 assert.equal(calls.length,2);assert.deepEqual(sites.map(x=>x.name),['site-1','site-2']);
});
