import {readFile,readdir,lstat,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {SafeNetwork} from '../engine/network.mjs';

export const providerOK = value => ['github','cloudflare'].includes(value);
const segment = value => encodeURIComponent(value);
export const accountOK = value => /^[a-f0-9]{32}$/i.test(value || '');
export function siteName(value,provider){
 if(typeof value!=='string'||!(provider==='github'?/^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/:/^[a-z0-9][a-z0-9-]{0,57}[a-z0-9]$|^[a-z0-9]$/).test(value)||value.includes('..'))throw Error('Use a simple site name with letters, numbers and hyphens.');
 return value;
}
export function providerAPI(provider,token,fetcher=fetch){
 if(!providerOK(provider))throw Error('Unknown hosting provider');
 return async(route,method='GET',body)=>{
  const response=await fetcher((provider==='github'?'https://api.github.com':'https://api.cloudflare.com/client/v4')+route,{method,redirect:'error',headers:{authorization:`Bearer ${token}`,'content-type':'application/json','user-agent':'WebsiteCloner/0.1',...(provider==='github'?{accept:'application/vnd.github+json','x-github-api-version':'2022-11-28'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Object.assign(Error(`${provider==='github'?'GitHub':'Cloudflare'} returned ${response.status}. Check account permissions and the selected site.`),{statusCode:response.status});
  if(response.status===204)return null;
  const data=await response.json();
  if(provider==='cloudflare'&&!data.success)throw Error('Cloudflare rejected the request. Check token permissions and site configuration.');
  if(provider==='cloudflare'&&Array.isArray(data.result)&&data.result_info)Object.defineProperty(data.result,'pagination',{value:data.result_info});
  return provider==='cloudflare'?data.result:data;
 };
}
export async function listAll(api,route,perPage=100){
 const result=[];let previous=null;
 for(let page=1;;page++){
  const rows=await api(`${route}${route.includes('?')?'&':'?'}per_page=${perPage}&page=${page}`);
  if(!Array.isArray(rows))throw Error('Provider returned an invalid list');
  const signature=JSON.stringify(rows.map(r=>r.id||r.full_name||r.name));
  if(rows.length&&signature===previous)throw Error('Provider repeated a page of results. Retry account discovery.');
  previous=signature;result.push(...rows);const info=rows.pagination;
  if(!rows.length||info?.total_pages&&page>=info.total_pages||Number.isFinite(info?.total_count)&&result.length>=info.total_count)return result;
  if(!info?.total_pages&&!Number.isFinite(info?.total_count)&&rows.length<(info?.per_page||perPage))return result;
 }
}
export async function connectAccount(provider,token,fetcher){
 if(typeof token!=='string'||token.length<10||token.length>2048||/[\s\x00-\x1f]/.test(token))throw Error('Enter a valid provider API token.');
 const api=providerAPI(provider,token,fetcher);
 if(provider==='github'){const user=await api('/user');return {label:user.login,login:user.login};}
 const accounts=(await listAll(api,'/accounts',50)).map(a=>({id:a.id,name:a.name})).filter(a=>accountOK(a.id));
 if(!accounts.length)throw Error('No Cloudflare accounts are available. Grant Account Settings Read and Cloudflare Pages Edit on your account.');
 return {label:accounts.map(a=>a.name).join(', '),accounts};
}
export async function listSites(provider,connection,account,fetcher){
 const api=providerAPI(provider,connection.token,fetcher);
 if(provider==='github')return (await listAll(api,'/user/repos?affiliation=owner,collaborator,organization_member')).filter(r=>!r.archived&&r.permissions?.admin).map(r=>({id:r.full_name,name:r.full_name,private:r.private}));
 if(!connection.accounts.some(a=>a.id===account))throw Error('Select a connected Cloudflare account.');
 return (await listAll(api,`/accounts/${account}/pages/projects`,10)).filter(p=>!p.source).map(p=>({id:p.name,name:p.name}));
}
export async function createSite(provider,connection,input,fetcher){
 const name=siteName(input.name,provider),api=providerAPI(provider,connection.token,fetcher);
 if(provider==='github'){const r=await api('/user/repos','POST',{name,private:false,auto_init:true,description:'Published with Website Cloner'});return {id:r.full_name,name:r.full_name};}
 if(!connection.accounts.some(a=>a.id===input.account))throw Error('Select a connected Cloudflare account.');
 const p=await api(`/accounts/${input.account}/pages/projects`,'POST',{name,production_branch:'main'});return {id:p.name,name:p.name};
}
export const pagesBranch='website-cloner-pages';
export async function destination(provider,connection,input,fetcher){
 const api=providerAPI(provider,connection.token,fetcher);
 if(provider==='github'){
  if(!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(input.site||'')||input.site.includes('..'))throw Error('Select a repository.');
  const repo=await api('/repos/'+input.site);if(!repo.permissions?.admin)throw Error('Repository administration access is required to configure Pages.');
  // Never overwrite an existing unmanaged branch, including a repository's default branch.
  if(repo.default_branch===pagesBranch)throw Error('Choose a repository whose default branch is not website-cloner-pages.');
  let pages=null;try{pages=await api(`/repos/${input.site}/pages`);}catch(e){if(e.statusCode!==404)throw e;}
  const url=pages?.html_url||`https://${repo.owner.login}.github.io/${repo.name.toLowerCase()===`${repo.owner.login.toLowerCase()}.github.io`?'':repo.name+'/'} `;
  const parsed=new URL(url.trim());
  // GitHub reports HTTP while a new Pages certificate is provisioning.
  // Build for HTTPS; live verification must still pass with a valid certificate.
  if(parsed.protocol==='http:')parsed.protocol='https:';
  if(parsed.protocol!=='https:'||parsed.username||parsed.password)throw Error('Invalid Pages URL');
  return {site:repo.full_name,url:parsed.href,basePath:parsed.pathname.replace(/\/$/,''),pagesExists:Boolean(pages),branch:pagesBranch,defaultBranch:repo.default_branch};
 }
 if(!connection.accounts.some(a=>a.id===input.account))throw Error('Select a connected Cloudflare account.');
 siteName(input.site,'cloudflare');
 const project=await api(`/accounts/${input.account}/pages/projects/${segment(input.site)}`);
 if(project.source)throw Error('Choose a Direct Upload project; Git-connected Cloudflare projects are not supported.');
 if(!/^[a-z0-9.-]+\.pages\.dev$/.test(project.subdomain||''))throw Error('Cloudflare returned an invalid site domain');
 return {site:project.name,account:input.account,url:`https://${project.subdomain}/`,basePath:'',branch:project.production_branch||'main'};
}
export async function outputFiles(root,provider){
 const files=[];let total=0;
 async function walk(dir,prefix=''){
  for(const name of await readdir(dir)){const relative=prefix+name,file=path.join(dir,name),info=await lstat(file);
   if(info.isSymbolicLink())throw Error('Publishing does not follow symbolic links.');
   if(info.isDirectory()){if(name==='.git'||name==='node_modules')throw Error('Unexpected private directory in generated output.');await walk(file,relative+'/');}
   else if(info.isFile()){
    if(/^\.env(?:\.|$)/.test(name)||name==='_worker.js'||name==='_routes.json')throw Error('Unexpected executable or credential file in static output.');
    if(info.size>(provider==='cloudflare'?25*1024*1024:100*1024*1024))throw Error(`File exceeds ${provider} upload limit: ${relative}`);
    total+=info.size;files.push({file,relative,size:info.size});
   }
  }
 }
 await walk(root);if(!files.some(f=>f.relative==='index.html'))throw Error('Generated site has no index.html');
 if(provider==='cloudflare'&&files.length>20000)throw Error('Cloudflare Direct Upload supports at most 20,000 files.');
 if(provider==='github'&&total>1024**3)throw Error('GitHub Pages site exceeds 1 GiB.');return files;
}
export async function uploadGithub(output,target,connection,run,event,fetcher){
 const api=providerAPI('github',connection.token,fetcher),repo='/repos/'+target.site;
 // Initialize an empty repository before using Git's object/ref API.
 try{await api(`${repo}/git/ref/heads/${segment(target.defaultBranch)}`);}catch(e){
  if(e.statusCode!==404&&e.statusCode!==409)throw e;
  await api(`${repo}/contents/.website-cloner-initialized`,'PUT',{message:'Initialize repository for Website Cloner',content:Buffer.from('Website Cloner publishing repository\n').toString('base64')});
 }
 let parent=null;
 try{parent=(await api(`${repo}/git/ref/heads/${pagesBranch}`)).object.sha;}catch(e){if(e.statusCode!==404)throw e;}
 if(parent){
  let marker;try{marker=await api(`${repo}/contents/.website-cloner.json?ref=${pagesBranch}`);}catch{throw Error('Existing publish branch is not managed by Website Cloner.');}
  if(marker.type!=='file'||JSON.parse(Buffer.from(marker.content,'base64').toString()).managedBy!=='website-cloner')throw Error('Existing publish branch is not managed by Website Cloner.');
 }
 await writeFile(path.join(output,'.nojekyll'),'');
 await writeFile(path.join(output,'.website-cloner.json'),JSON.stringify({managedBy:'website-cloner'}));
 const parsed=new URL(target.url);if(!parsed.hostname.endsWith('.github.io'))await writeFile(path.join(output,'CNAME'),parsed.hostname+'\n');
 const files=await outputFiles(output,'github'),tree=[];
 for(let i=0;i<files.length;i++){
  const f=files[i],blob=await api(`${repo}/git/blobs`,'POST',{encoding:'base64',content:(await readFile(f.file)).toString('base64')});tree.push({path:f.relative,mode:'100644',type:'blob',sha:blob.sha});
  if(i%20===0||i===files.length-1)await event(`Uploading files: ${i+1}/${files.length}`,{uploaded:i+1,total:files.length});
 }
 const t=await api(`${repo}/git/trees`,'POST',{tree});
 const commit=await api(`${repo}/git/commits`,'POST',{message:`Website Cloner ${run.id}`,tree:t.sha,parents:parent?[parent]:[]});
 if(parent)await api(`${repo}/git/refs/heads/${pagesBranch}`,'PATCH',{sha:commit.sha,force:false});
 else await api(`${repo}/git/refs`,'POST',{ref:`refs/heads/${pagesBranch}`,sha:commit.sha});
 await api(`${repo}/pages`,target.pagesExists?'PUT':'POST',{build_type:'legacy',source:{branch:pagesBranch,path:'/'}});
 // A ref push normally triggers Pages; explicitly request a build as well.
 try{await api(`${repo}/pages/builds`,'POST');}catch(e){if(e.statusCode!==409)throw e;}
 return {commit:commit.sha};
}
export async function providerReady(provider,connection,target,run,fetcher){
 const api=providerAPI(provider,connection.token,fetcher);
 if(provider==='github'){
  let builds;try{builds=await api(`/repos/${target.site}/pages/builds?per_page=100`);}catch(e){if(e.statusCode===404)return false;throw e;}const build=builds.find(b=>b.commit===run.commit);
  if(build?.status==='errored')throw Error('GitHub Pages build failed. Check the repository Pages settings and build logs.');
  return build?.status==='built';
 }
 const deployments=await api(`/accounts/${target.account}/pages/projects/${segment(target.site)}/deployments?env=production&per_page=10`);
 const d=deployments.find(d=>d.deployment_trigger?.metadata?.commit_hash===run.id);
 if(d?.latest_stage?.status==='failure'||d?.latest_stage?.status==='canceled')throw Error('Cloudflare deployment failed. Check the project deployment logs.');
 if(d)run.providerDeploymentId=d.id;
 return d?.latest_stage?.status==='success';
}
export async function verifyLive(url,id,network=new SafeNetwork({maxRequests:12,maxBytes:12_000_000})){
 const u=new URL(url);if(u.protocol!=='https:'||u.username||u.password)throw Error('Invalid live URL');
 const marker=await network.raw(new URL(`cloner-deploy-${id}.txt`,u).href,0,true);
 if(marker.status!==200||marker.body.toString().trim()!==id)return false;
 const home=await network.raw(u.href,0,true);return home.status===200&&/html/i.test(home.headers['content-type']||'');
}
