import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {writeEditableProject} from '../engine/editable.mjs';
import {metadataFingerprint} from '../scripts/metadata-fingerprint.mjs';

test('large shared presentation bindings live once in templates, not in the aggregate manifest',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'layout-manifest-'));
 try{
  await mkdir(path.join(dir,'content/posts'),{recursive:true});
  await mkdir(path.join(dir,'templates'),{recursive:true});
  await writeFile(path.join(dir,'templates/page-fixture.html'),'{{body}}');
  const routes=Array.from({length:40},(_,i)=>({collection:'posts',slug:'story-'+i,route:'/story-'+i+'/'}));
  const attribute='presentation-'.repeat(1600);
  for(const p of routes){
   const base=path.join(dir,'content/posts',p.slug);
   await writeFile(base+'.json',JSON.stringify({title:p.slug,template:'fixture',date:'2026-01-01',seo_title:p.slug}));
   await writeFile(base+'.html',`<article data-layout="${attribute}"><h1>${p.slug}</h1><p class="lead">Editable prose.</p></article>`);
  }
  await writeEditableProject({routes,metrics:{}},dir);
  const text=await readFile(path.join(dir,'content-layout.json'),'utf8'),manifest=JSON.parse(text);
  assert.ok(text.length<100000,'manifest must not scale with presentation payloads');
  assert.ok(!text.includes(attribute));
  for(const record of Object.values(manifest.records)){
   assert.equal(record.decorations,undefined);
   assert.equal(record.metadata.layout_attributes,undefined);
   assert.equal(record.metadata.content_slots,undefined);
   const data=JSON.parse(await readFile(path.join(dir,record.metadata.layout_data),'utf8'));
   assert.ok(!JSON.stringify(data).includes(attribute));
   assert.ok((await readFile(path.join(dir,record.metadata.content_template),'utf8')).includes(attribute));
   const authored={...record.metadata};delete authored.layout_data;
   const hydrated={...data,...authored};
   assert.equal(metadataFingerprint(hydrated),record.metadataFingerprint);
   hydrated.title='Edited';assert.notEqual(metadataFingerprint(hydrated),record.metadataFingerprint);
  }
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('metadata fingerprints ignore object key order but detect bindings, content metadata and array order',()=>{
 const first={title:'Post',layout_attributes:{root:{class:'card',id:'a'}},tags:['a','b']};
 assert.equal(metadataFingerprint(first),metadataFingerprint({tags:['a','b'],layout_attributes:{root:{id:'a',class:'card'}},title:'Post'}));
 assert.notEqual(metadataFingerprint(first),metadataFingerprint({...first,tags:['b','a']}));
 assert.notEqual(metadataFingerprint(first),metadataFingerprint({...first,layout_attributes:{root:{class:'changed',id:'a'}}}));
});
