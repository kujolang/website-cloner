import {load} from 'cheerio/slim';
import {htmlMetadata,documentTypes} from './html-metadata.mjs';
import path from 'node:path';
import {stat,readFile,writeFile,mkdir} from 'node:fs/promises';
import {readJSON,writeJSON} from './json.mjs';
import {localize} from './assets.mjs';
import {restorePresentation,restoreSearchWrappers,refreshPresentation} from './presentation.mjs';
import {hash,externalRedirectPage,documentAttributes} from './extract.mjs';
// Repair saved captures only. Discovery/frontier enumeration is never invoked.
export async function repairSavedModel(model,dir,network,event=()=>{},{retryAssets=true}={}){
 // Offline rebuilds still re-localize restored markup, but must never turn a
 // missing cached resource into a source request or a network retry pause.
 const cacheMisses=new Set();
 if(!retryAssets){
  const offline=Object.create(network);
  for(const method of ['get','text','head'])offline[method]=async url=>{cacheMisses.add(url);const error=new Error('Unavailable in saved cache (asset retries disabled): '+url);error.code='CACHE_MISS';throw error;};
  network=offline;
 }
 try{const cache=await readJSON(path.join(dir,'asset-cache.json'));model.media=[...new Map([...(cache.media||[]),...model.media].map(m=>[m.source,m])).values()];}catch(error){if(error.code!=='ENOENT')throw error;}
 const missingCached=[];
 for(const asset of model.media){if(!/^assets\/media\/[a-f0-9]+\.[a-z0-9]+$/.test(asset.path))throw Error('Invalid saved asset path');
   try{if(!(await stat(path.join(dir,'project',asset.path))).isFile())missingCached.push(asset);}catch(error){if(error.code!=='ENOENT')throw error;missingCached.push(asset);}
 }
 const missingURLs=new Set(missingCached.map(m=>m.source));model.media=model.media.filter(m=>!missingURLs.has(m.source));
 const captured=await readJSON(path.join(dir,'captured-model.json'));
 model.generatedRecordHistory=captured.pages.map((p,i)=>({collection:p.contentType||'pages',slug:'page-'+String(i+1).padStart(4,'0')}));
 // Keep only originals needed for recovery; retaining both whole-site models
 // plus DOM trees can exhaust Node's heap on media-heavy sites.
 const savedPages=new Map(model.pages.map(p=>[p.route,p]));
 for(const [index,original]of captured.pages.entries()){
  const saved=savedPages.get(original.route);
  if(saved&&original.sourceHTML){const url=original.documentURL||original.url;saved.documentAttributes=documentAttributes(original.sourceHTML);saved.htmlMetadata={...(original.htmlMetadata||htmlMetadata(original.sourceHTML,url)),documentTypes:documentTypes(original.sourceHTML,url)};}
  if(index%25===0){event('Inspecting cached content types',{pages:index+1,total:captured.pages.length});await new Promise(resolve=>setImmediate(resolve));}
 }
 const originals=new Map(captured.pages.filter(p=>{const saved=savedPages.get(p.route);return saved&&(!saved.sourceHTML||(saved.assetFailures?.length||saved.videoFailures?.length)||missingCached.length);}).map(p=>[p.route,((savedPages.get(p.route)?.assetFailures?.length||savedPages.get(p.route)?.videoFailures?.length)||missingCached.length)?p:{route:p.route,sourceHTML:p.sourceHTML}]));
 captured.pages=[];
 const repairPages=[],replacements=new Map(),redirects=[];
 let lastProgress=0;
 const receipt={schema:'migration-repair/v1',savedAssets:model.media.length,missingCachedAssets:missingCached.length,pagesRetried:[],redirects,unavailable:[]};
 for(const page of model.pages){
  if(page.redirectTarget)redirects.push({route:page.route,target:page.redirectTarget,evidence:page.provenance?.recovery||'verified-redirect',reused:true});
  let external=false;try{external=new URL(page.canonical).origin!==new URL(model.source).origin;}catch{}
  if(retryAssets&&external&&!page.redirectTarget){
   try{let response=await network.head(page.url);if(response.status>=400)response=await network.get(page.url);if(response.status===200&&new URL(response.url).origin!==new URL(model.source).origin){
    const replacement=externalRedirectPage(page.url,response.url);replacements.set(page.route,replacement);redirects.push({route:page.route,target:response.url});continue;
   }receipt.unavailable.push({url:page.url,reason:'Redirect verification returned HTTP '+response.status});}catch(error){if(error.code==='CRAWL_BUDGET')throw error;receipt.unavailable.push({url:page.url,reason:error.message});}
  }
  // Legacy WordPress outbound-link endpoints were captured as foreign pages by
  // older builders. Their saved external canonical is usable as a labeled link,
  // even when the redirect service is down; never apply this to syndicated posts.
  if(external && /^\/linkout\/\d+\/?$/.test(page.route) && !page.redirectTarget){
    const replacement=externalRedirectPage(page.url,page.canonical);
    replacement.provenance.redirectVerified=false;
    replacement.provenance.recovery='saved-external-canonical';
    replacements.set(page.route,replacement);
    redirects.push({route:page.route,target:page.canonical,evidence:'saved-external-canonical',liveVerified:false});
    continue;
  }
  if((retryAssets&&(page.assetFailures?.length||page.videoFailures?.length))||missingCached.some(asset=>[page.content,page.header,page.footer,page.shell,...(page.styles||[])].some(fragment=>fragment?.includes(path.basename(asset.path))))){const original=originals.get(page.route);if(original){original.cachedStyles=Object.fromEntries((page.styleSources||[]).map((entry,i)=>[JSON.stringify(entry),page.styles?.[i]]).filter(([,value])=>value));original.styleSources=page.styleSources;repairPages.push(original);receipt.pagesRetried.push(page.route);}}
 }
 const subset={...model,pages:repairPages};
 if(repairPages.length){event('Repairing missing assets from saved captures', {pages:repairPages.length});await localize(subset,network,path.join(dir,'project/assets/media'),{onCheckpoint:async(media,progress)=>{await writeJSON(path.join(dir,'asset-cache.json'),{media,progress});if(Date.now()-lastProgress>10000){lastProgress=Date.now();event(`Repairing saved assets: ${progress.completedPages}/${progress.totalPages} affected pages; ${media.length} assets saved`);}}});for(const page of repairPages)replacements.set(page.route,page);}
 model.warnings=subset.warnings;
 model.pages=model.pages.map(p=>replacements.get(p.route)||p);
 // Upgrade sanitized checkpoints from saved HTML; reuse known CSS and fetch only newly discovered deferred styles.
 const presentationDir=path.join(dir,'source-html');await mkdir(presentationDir,{recursive:true});
 const upgrades=model.pages.filter(p=>p.presentationVersion!==44);
 receipt.presentation={pages:upgrades.length,restored:0,failures:[]};let next=0,done=0;
 await Promise.all(Array.from({length:Math.min(1,upgrades.length)},async()=>{
  while(next<upgrades.length){const page=upgrades[next++],file=path.join(presentationDir,hash(page.url)+'.html');
   try{let html=page.sourceHTML||originals.get(page.route)?.sourceHTML;
    if(!html)try{html=await readFile(file,'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
    if(!html){const response=await network.get(page.documentURL||page.url);if(response.status!==200)throw Error('HTTP '+response.status);html=response.body.toString();if(!/<html|<body/i.test(html))throw Error('Not HTML');await writeFile(file,html);}
    receipt.presentation.restored+=refreshPresentation(page,html);page.presentationVersion=44;
    // Raw HTML remains in captured-model.json; do not duplicate it in prepared/export models.
    delete page.sourceHTML;
   }catch(error){receipt.presentation.failures.push({route:page.route,error:error.message});}
   if(++done%20===0)event(`Restoring cached presentation: ${done}/${upgrades.length} pages`);
   await new Promise(resolve=>setImmediate(resolve));
  }
 }));
 if(upgrades.length){
  event('Restoring deferred stylesheets from cached page sources');let savedStyleAssets=model.media.length;
  await localize({...model,pages:upgrades},network,path.join(dir,'project/assets/media'),{onCheckpoint:async(media,progress)=>{
   if(media.length!==savedStyleAssets){await writeJSON(path.join(dir,'asset-cache.json'),{media});savedStyleAssets=media.length;}
   if(Date.now()-lastProgress>10000){lastProgress=Date.now();event(`Restoring cached styles: ${progress.completedPages}/${progress.totalPages} pages`);}
  }});
 }
 // Older exports lacked failed stylesheet bodies. Probe each candidate CSS once,
 // and retain only sources containing the exact rejected embedded-asset prefix.
 if(retryAssets&&!Object.keys(model.failedStylesheets||{}).length){
  const prefixes=model.warnings.filter(w=>w.startsWith('Asset data:')&&w.endsWith(': Unsupported embedded media')).map(w=>w.slice(6,w.lastIndexOf(': ')));
  const sources=new Map();
  if(prefixes.length)for(const page of model.pages)for(const [i,entry] of (page.styleSources||[]).entries()){
   if(!page.styles?.[i]?.includes('none'))continue;
   const key=entry.url||JSON.stringify(entry);
   if(sources.has(key))continue;
   try{
    const raw=entry.url?await network.text(entry.url):entry.text;
    sources.set(key,true);
    if(typeof raw==='string'&&prefixes.some(prefix=>raw.includes(prefix))){
     model.failedStylesheets ||= {};
     const localized=entry.media&&entry.media!=='all'?page.styles[i].replace(/^@media [^{]+\{([\s\S]*)\}$/,'$1'):page.styles[i];
     model.failedStylesheets[hash(key+raw)]={base:entry.url||page.documentURL||page.url,owner:entry.url||entry.text,source:raw,localized};
    }
   }catch(error){if(['CRAWL_BUDGET','SOURCE_UNAVAILABLE','ENOSPC','DISK_SPACE'].includes(error.code))throw error;sources.set(key,true);}
  }
 }
 // Retry only saved stylesheet bodies that lost assets; successful media stays cached.
 if(retryAssets&&Object.keys(model.failedStylesheets||{}).length){
  receipt.stylesheetAssets=[];
  for(const [key,saved] of Object.entries(model.failedStylesheets)){
   const affected=model.pages.map(page=>({page,indexes:(page.styles||[]).flatMap((css,i)=>css.includes(saved.localized)&&(!saved.owner||(page.styleSources?.[i]?.url||page.styleSources?.[i]?.text)===saved.owner)?[i]:[])})).filter(target=>target.indexes.length);
   if(!saved.localized||!affected.length)continue;
   const page={url:saved.base,route:'/',styleSources:[{text:saved.source}],styles:[]};
   const retry={...model,pages:[page],failedStylesheets:{}};
   await localize(retry,network,path.join(dir,'project/assets/media'),{stylesOnly:true});
   model.warnings=retry.warnings;
   const replacement=page.styles[0];
   for(const {page:target,indexes} of affected)for(const i of indexes)target.styles[i]=target.styles[i].replaceAll(saved.localized,replacement);
   delete model.failedStylesheets[key];
   for(const [id,value] of Object.entries(retry.failedStylesheets))model.failedStylesheets[id]={...value,owner:saved.owner};
   receipt.stylesheetAssets.push({base:saved.base,pages:affected.length,recovered:!Object.keys(retry.failedStylesheets).length});
  }
 }
 // Rejected font MIME types in older checkpoints left invalid `src: none`.
 // Reprocess only affected style entries; existing media URLs remain cache hits.
 if(retryAssets){
  const fontRepairs=model.pages.filter(page=>(page.styleSources||[]).some((entry,i)=>entry.url&&!page.styles?.[i]?.trim())||(page.styles||[]).some(css=>/@font-face\s*\{[^}]*\bsrc\s*:[^;}]*none/i.test(css)));
  for(const page of fontRepairs)page.cachedStyles=Object.fromEntries((page.styleSources||[]).map((entry,i)=>[JSON.stringify(entry),page.styles?.[i]]).filter(([,css])=>css&&!/@font-face\s*\{[^}]*\bsrc\s*:[^;}]*none/i.test(css)));
  if(fontRepairs.length){event('Repairing missing stylesheets and rejected fonts from saved sources',{pages:fontRepairs.length});await localize({...model,pages:fontRepairs},network,path.join(dir,'project/assets/media'),{stylesOnly:true,onCheckpoint:async(media,progress)=>{
   await writeJSON(path.join(dir,'asset-cache.json'),{media});
   if(Date.now()-lastProgress>10000){lastProgress=Date.now();event(`Repairing cached fonts: ${progress.completedPages}/${progress.totalPages} pages; ${media.length} assets saved`);}
  }});}
 }
 receipt.searchWrappers=0;
 for(const page of model.pages){const html=page.sourceHTML||originals.get(page.route)?.sourceHTML;if(html&&html.includes('<search'))receipt.searchWrappers+=restoreSearchWrappers(page,html);}
 const recovered=new Set(model.media.map(asset=>asset.source.slice(0,180)));
 model.warnings=model.warnings.filter(warning=>!warning.startsWith('Asset ')||!recovered.has(warning.slice(6,warning.indexOf(': ',6))));
 let savedLinkAssets=model.media.length;
 if(retryAssets)await localize(model,network,path.join(dir,'project/assets/media'),{linksOnly:true,onCheckpoint:async media=>{if(media.length!==savedLinkAssets){await writeJSON(path.join(dir,'asset-cache.json'),{media});savedLinkAssets=media.length;}}});
 model.metrics.assetsLocalized=model.media.length;
 model.metrics.missingImages=model.pages.reduce((n,p)=>n+(p.assetFailures?.length||0),0);
 for(const failure of receipt.presentation.failures){const warning='Presentation recovery '+failure.route+': '+failure.error;if(!model.warnings.includes(warning))model.warnings.push(warning);}
 for(const page of model.pages){
  const $=load([page.content,page.header,page.footer,page.shell].filter(Boolean).join(''),null,false),videos=$('video');
  if(videos.length&&videos.toArray().every(el=>/^\/assets\/media\/[^/]+\.(mp4|webm)$/.test($(el).attr('src')||'')||$(el).find('source[src^="/assets/media/"]').length)){
   page.dynamic=(page.dynamic||[]).filter(x=>x!=='Video playback omitted; available poster images retained'&&x!=='Video has no portable source; poster retained');
   model.warnings=model.warnings.filter(x=>x!=='Video source unavailable on '+page.route+'; poster retained');
  }
 }
 receipt.cacheMisses=[...cacheMisses];
 receipt.assetsAdded=model.media.length-receipt.savedAssets;
 receipt.remainingImageReferences=model.metrics.missingImages;
 await writeJSON(path.join(dir,'repair-report.json'),receipt);
 return model;
}
