import {readFile} from 'node:fs/promises';import path from 'node:path';
// Replay original captured documents and retained asset bytes. Uncached source
// scripts/styles still go through SafeNetwork; this is not a claim of offline QA.
export function cachedCaptureNetwork(network,pages,media,project){
 const documents=new Map(pages.filter(p=>p.sourceHTML).flatMap(p=>[...new Set([p.url,p.documentURL].filter(Boolean))].map(url=>[url,p.sourceHTML]))),assets=new Map(media.filter(m=>m.source&&m.path).map(m=>[m.source,m])),stats={documents:0,assets:0,fallbacks:0};
 return {stats,get outage(){return network.outage;},async get(url){
  if(documents.has(url)){stats.documents++;return {status:200,headers:{'content-type':'text/html; charset=utf-8'},body:Buffer.from(documents.get(url))};}
  const asset=assets.get(url);
  if(asset&&/^assets\/[a-zA-Z0-9_./-]+$/.test(asset.path)&&!asset.path.split('/').includes('..')){
   try{const body=await readFile(path.join(project,asset.path));stats.assets++;return {status:200,headers:{'content-type':asset.type||'application/octet-stream'},body};}catch(error){if(error.code!=='ENOENT')throw error;}
  }
  stats.fallbacks++;return network.get(url);
 }};
}
