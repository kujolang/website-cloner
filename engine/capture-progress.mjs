import {mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readJSON,writeJSON} from './json.mjs';
const filename=url=>createHash('sha256').update(url).digest('hex')+'.json';
export async function saveCaptureProgress(model,page,dir,{networkRequests=0,downloadBytes=0}={}){
 const root=path.join(dir,'capture-pages');await mkdir(root,{recursive:true});
 await writeJSON(path.join(root,filename(page.url)),{schema:1,source:model.source,url:page.url,route:page.route,page,captures:(model.captures||[]).filter(c=>c.route===page.route),renderAll:model.captureRenderAll===true,warnings:(model.warnings||[]).filter(w=>w.startsWith('Capture '+page.route+' '))});
 await writeJSON(path.join(dir,'capture-progress.json'),{source:model.source,renderedPages:model.pages.filter(p=>p.hydratedContent).length,frames:(model.captures||[]).length,networkRequests,downloadBytes});
}
export async function restoreCaptureProgress(model,dir){
 let restored=0;model.captures=[];
 for(let i=0;i<model.pages.length;i++){
  const page=model.pages[i];let saved;
  try{saved=await readJSON(path.join(dir,'capture-pages',filename(page.url)));}catch(error){if(error.code==='ENOENT')continue;throw error;}
  if(saved.schema!==1||saved.source!==model.source||saved.url!==page.url||saved.route!==page.route||saved.page?.url!==page.url||saved.page?.route!==page.route)continue;
  model.pages[i]=saved.page;model.captures.push(...(saved.captures||[]));model.captureRenderAll ||= saved.renderAll===true;
  for(const warning of saved.warnings||[])if(typeof warning==='string'&&!model.warnings.includes(warning))model.warnings.push(warning);
  restored++;
 }
 try{const totals=await readJSON(path.join(dir,'capture-progress.json'));if(totals.source===model.source){model.metrics||={};model.metrics.networkRequests=totals.networkRequests||0;model.metrics.downloadBytes=totals.downloadBytes||0;}}catch(error){if(error.code!=='ENOENT')throw error;}
 return restored;
}
export async function clearCaptureProgress(dir){await rm(path.join(dir,'capture-pages'),{recursive:true,force:true});await rm(path.join(dir,'capture-session.json'),{force:true});await rm(path.join(dir,'capture-progress.json'),{force:true});}
