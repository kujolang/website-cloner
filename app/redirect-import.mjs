import {readFile,writeFile,rename,rm,lstat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {redirectImportFingerprint} from '../scripts/redirect-export.mjs';
const locks=new Set();
const fail=(message,statusCode=400)=>Object.assign(Error(message),{statusCode});
export async function readRedirectImport(project) {
 const file=path.join(project,'redirects.import.json');
 try {const info=await lstat(file);if(!info.isFile()||info.isSymbolicLink())throw fail('Invalid redirect import file');return JSON.parse(await readFile(file,'utf8'));}
 catch(e){if(e.code==='ENOENT')return {redirects:[]};throw e;}
}
export async function saveRedirectImport(dir,input){
 if(locks.has(dir))throw fail('Redirect settings are being updated',409);locks.add(dir);
 try {
  const project=path.join(dir,'project'),info=await lstat(project);
  if(!info.isDirectory()||info.isSymbolicLink())throw fail('Invalid project directory');
  const previous=await readRedirectImport(project);
  if(input?.fingerprint!==redirectImportFingerprint(previous))throw fail('Redirect settings changed. Refresh and try again.',409);
  const data=input.data;
  if(!data||!Array.isArray(data.redirects)||data.groups!==undefined&&!Array.isArray(data.groups)||[...data.redirects,...(data.groups||[])].some(r=>!r||typeof r!=='object'||Array.isArray(r)))throw fail('Choose a Redirection JSON export containing redirects and optional groups arrays');
  const normalized={redirects:data.redirects,groups:data.groups||[]};
  const temp=path.join(project,'redirects.'+randomUUID()+'.tmp');
  try{await writeFile(temp,JSON.stringify(normalized,null,2),{flag:'wx'});await rename(temp,path.join(project,'redirects.import.json'));}finally{await rm(temp,{force:true});}
  return {fingerprint:redirectImportFingerprint(normalized),pendingConfiguration:true};
 }finally{locks.delete(dir);}
}
