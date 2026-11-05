import test from 'node:test';import assert from 'node:assert/strict';import{mkdtemp,mkdir,writeFile,readFile,rm}from'node:fs/promises';import os from'node:os';import path from'node:path';import{extract}from'../engine/extract.mjs';import{repairSavedModel}from'../engine/repair.mjs';
test('cache-only presentation upgrades never request missing resources and retain failure evidence',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-offline-'));try{
 await mkdir(path.join(dir,'project/assets/media'),{recursive:true});
 const source='https://example.test/',html='<html><head><link rel="stylesheet" href="/theme.css"></head><body><main><h1>Title</h1><img src="/missing.jpg" alt="Unavailable"><p>Content</p></main></body></html>',page={...extract(html,source),presentationVersion:1,styles:['body{color:red}'],styleSources:[{url:source+'theme.css'}]};
 await writeFile(path.join(dir,'captured-model.json'),JSON.stringify({pages:[page]}));
 let requests=0;const network={get:async()=>{requests++;throw Error('unexpected source request')},text:async()=>{requests++;throw Error('unexpected source request')},head:async()=>{requests++;throw Error('unexpected source request')}};
 const model={source,pages:[structuredClone(page)],media:[],warnings:[],metrics:{}};await repairSavedModel(model,dir,network,()=>{},{retryAssets:false});
 assert.equal(requests,0);assert.ok(model.pages[0].styles.some(css=>css.includes('color:red')));assert.ok(model.pages[0].assetFailures.some(url=>url.endsWith('/missing.jpg')));const receipt=JSON.parse(await readFile(path.join(dir,'repair-report.json'),'utf8'));assert.ok(receipt.cacheMisses.includes(source+'missing.jpg'));
 }finally{await rm(dir,{recursive:true,force:true})}
});
