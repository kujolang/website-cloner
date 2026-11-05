import {readRedirectImport} from './redirect-import.mjs';
import {redirectImportFingerprint} from '../scripts/redirect-export.mjs';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,rename,lstat,rm} from 'node:fs/promises';
import path from 'node:path';
import {formEndpoint} from '../scripts/form-export.mjs';
const locks=new Set();
const fail=(message,statusCode)=>Object.assign(new Error(message),{statusCode});
async function read(project,name,fallback){
 try{const file=path.join(project,name),info=await lstat(file);if(info.isSymbolicLink()||!info.isFile())throw fail('Invalid report file',400);return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}
}
async function projectDir(dir){const project=path.join(dir,'project');const info=await lstat(project);if(!info.isDirectory()||info.isSymbolicLink())throw fail('Invalid project directory',400);return project;}
export async function compatibilityReport(dir){
 const project=await projectDir(dir);
 const [platform,forms,settings,delivery,seo,components,redirects]=await Promise.all([
  read(project,'platform-support.json',null),read(project,'forms.json',{forms:[]}),read(project,'form-settings.json',{revision:0,forms:{}}),read(project,'form-delivery-report.json',{pages:[],configurationRevision:0}),read(project,'seo-preservation-report.json',{pages:[]}),read(project,'component-runtime-report.json',{pages:[]}),read(project,'redirect-report.json',{rules:[],issues:[]})]);
 const issues=new Map();for(const page of seo.pages||[])for(const issue of page.issues||[]){const row=issues.get(issue.kind)||{kind:issue.kind,count:0,routes:new Set()};row.count++;row.routes.add(page.route);issues.set(issue.kind,row);}
 const selected=new Map();for(const page of components.pages||[])for(const item of page.selected||[]){const row=selected.get(item.id)||{id:item.id,pages:0,bytesPerPage:item.bytes};row.pages++;selected.set(item.id,row);}
 const imported=await readRedirectImport(project),fingerprint=redirectImportFingerprint(imported),pendingRedirects=fingerprint!==(redirects.importFingerprint||redirectImportFingerprint({redirects:[]}));
 const formStatus=new Map((delivery.pages||[]).flatMap(p=>(p.forms||[]).map(f=>[f.id,f.status])));
 return {available:!!platform,revision:settings.revision||0,pendingConfiguration:pendingRedirects||(settings.revision||0)!==(delivery.configurationRevision||0),redirectImport:{fingerprint,count:imported.redirects?.length||0,pending:pendingRedirects},
  plugins:(platform?.plugins||[]).map(p=>({id:p.id,name:p.name,status:p.status,routeCount:p.routes?.length||0,requiredConnection:p.requiredConnection,limitation:p.limitation})),
  redirects:{httpRules:redirects.rules.filter(r=>r.cloudflare==='http-rule').length,staticFallbacks:redirects.rules.filter(r=>r.static==='html-fallback'||r.static==='existing-alias').length,issues:redirects.issues.length},
  components:[...selected.values()],seoIssues:[...issues.values()].map(i=>({...i,routes:[...i.routes]})),
  forms:forms.forms.map(f=>({id:f.id,route:f.route,provider:f.provider,status:formStatus.get(f.id)||'requires-connection',delivery:settings.forms?.[f.id]||f.delivery||{endpoint:null},limitations:f.limitations||[]}))};
}
export async function saveFormSettings(dir,input){
 if(locks.has(dir))throw fail('Form settings are being updated',409);locks.add(dir);
 try{
  const project=await projectDir(dir),contracts=await read(project,'forms.json',{forms:[]}),settings=await read(project,'form-settings.json',{revision:0,forms:{}});
  if(!input||!Number.isInteger(input.revision)||input.revision!==(settings.revision||0))throw fail('Settings changed. Refresh and try again.',409);
  if(!contracts.forms.some(f=>f.id===input.id))throw fail('Unknown form',400);
  const format=input.format||'multipart';if(!['multipart','json'].includes(format))throw fail('Unsupported delivery format',400);
  if(input.endpoint!==null&&(typeof input.endpoint!=='string'||input.endpoint.length>2048))throw fail('Invalid endpoint',400);
  let endpoint=null;try{if(input.endpoint)endpoint=formEndpoint(input.endpoint);}catch(e){throw fail(e.message,400);}
  const next={revision:(settings.revision||0)+1,forms:{...settings.forms,[input.id]:{endpoint,format}}};
  const temp=path.join(project,'form-settings.'+randomUUID()+'.tmp');try{await writeFile(temp,JSON.stringify(next,null,2),{flag:'wx'});await rename(temp,path.join(project,'form-settings.json'));}finally{await rm(temp,{force:true});}
  return {revision:next.revision,pendingConfiguration:true};
 }finally{locks.delete(dir);}
}
