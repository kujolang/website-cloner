import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,readFile} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {extract,hash} from '../engine/extract.mjs';
import {localize} from '../engine/assets.mjs';
import {migrate} from '../engine/pipeline.mjs';
import {writeJSON,readJSON} from '../engine/json.mjs';

for(const scenario of ['current','legacy','wrong-route','unknown-version'])test(`pipeline localized checkpoint resume: ${scenario}`,async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'localized-resume-'));
 try{
  const source='https://checkpoint.example/';
  const page=extract('<html><head><title>Checkpoint</title></head><body><main><h1>Already captured</h1><img src="/image.svg" alt="Example"></main></body></html>',source);
  const model={source,pages:[page],media:[],warnings:[],metrics:{},captures:[],discovery:{queued:0}};
  await writeJSON(path.join(dir,'captured-model.json'),model);
  const mediaDir=path.join(dir,'project/assets/media');await mkdir(mediaDir,{recursive:true});
  await localize(model,{get:async()=>({status:200,headers:{'content-type':'image/svg+xml'},body:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')})},mediaDir);
  assert.equal(page.assetCheckpointVersion,2);
  page.content=page.content.replace('<h1>','<h1 data-checkpoint-only="preserved">');
  if(scenario==='legacy')page.assetCheckpointVersion=1;
  if(scenario==='wrong-route')page.route='/other/';
  if(scenario==='unknown-version')page.assetCheckpointVersion=999;
  await mkdir(path.join(dir,'localized-pages'));
  const checkpoint=path.join(dir,'localized-pages',hash(page.url)+'.json');
  await writeJSON(checkpoint,{version:1,page});
  const failedStylesheets={background:{base:source,owner:source,source:'.hero{background:url(missing.svg)}',localized:'.hero{background:none}'}};
  await writeJSON(path.join(dir,'asset-cache.json'),{media:model.media,warnings:[],failedStylesheets});
  const before=await readFile(checkpoint);
  const reached=Error('Reached reconstruction after asset resume');
  await assert.rejects(migrate(source,dir,{resume:true,aiEnabled:false,event:stage=>{if(stage==='Rebuilding templates')throw reached;}}),error=>error===reached);
  const restored=(await readJSON(checkpoint)).page;
  if(scenario==='current')assert.deepEqual(await readFile(checkpoint),before,'completed page should not be localized and checkpointed again');
  if(['current','legacy'].includes(scenario))assert.match(restored.content,/data-checkpoint-only="preserved"/);
  else assert.doesNotMatch(restored.content,/data-checkpoint-only/,'incompatible checkpoints must not replace captured content');
  assert.equal(restored.assetCheckpointVersion,2);
  assert.equal(restored.route,'/');
  assert.deepEqual((await readJSON(path.join(dir,'asset-cache.json'))).failedStylesheets,failedStylesheets,'resume must preserve missing CSS assets for repair and quality checks');
 }finally{await rm(dir,{recursive:true,force:true});}
});
