import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {contentSlugs,descriptionSummary,sectionName} from '../engine/authoring.mjs';
import {shareLayoutData} from '../engine/shared-layout.mjs';
import {resolveLayoutData} from '../scripts/source-project.mjs';
test('readable route filenames are stable across discovery order and avoid normalized collisions',()=>{
 const pages=['/','/about/','/a/b/','/a-b/','/café/'].map(route=>({route}));
 const slugs=contentSlugs(pages);assert.equal(slugs[0],'home');assert.equal(slugs[1],'about');assert.equal(slugs[4],'cafe');assert.equal(new Set(slugs).size,pages.length);
 assert.deepEqual(contentSlugs([...pages].reverse()),[...slugs].reverse());
 assert.equal(descriptionSummary('One complete word followed by another',22),'One complete word');
});
test('shared layout data roundtrips, supports one shared edit, and rejects bad references',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'shared-layout-'));try{
 await mkdir(path.join(dir,'templates/data'),{recursive:true});
 const navigation={label:'Navigation',items:Array.from({length:12},(_,i)=>({label:'Link '+i,href:'/page-'+i+'/'}))};
 const rows=[{navigation,title:'One'},{navigation,title:'Two'}],files=rows.map((_,i)=>'templates/data/page-'+i+'.json');
 for(let i=0;i<rows.length;i++)await writeFile(path.join(dir,files[i]),JSON.stringify(rows[i],null,2));
 const report=await shareLayoutData(dir,files);assert.ok(report.afterBytes<report.beforeBytes);
 const shared=JSON.parse(await readFile(path.join(dir,'templates/data/shared.json')));
 for(let i=0;i<rows.length;i++)assert.deepEqual(resolveLayoutData(JSON.parse(await readFile(path.join(dir,files[i]))),shared),rows[i]);
 const key=Object.keys(shared).find(k=>shared[k].label==='Navigation');shared[key].label='Edited menu';
 for(const file of files)assert.equal(resolveLayoutData(JSON.parse(await readFile(path.join(dir,file))),shared).navigation.label,'Edited menu');
 assert.throws(()=>resolveLayoutData({$shared:'missing'},shared),/Missing/);
 assert.throws(()=>resolveLayoutData({$shared:'loop'},{loop:{$shared:'loop'}}),/Circular/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('section names are readable, bounded and unique without colliding with legacy slot keys',()=>{
 const used=new Set();assert.equal(sectionName('Our Story',used),'our-story');assert.equal(sectionName('Our Story',used),'our-story-2');assert.equal(sectionName('body1',used),'body1-2');assert.equal(sectionName('',used),'section');assert.ok(sectionName('x'.repeat(100),used).length<=64);
});
test('generated summaries prefer full sentences without inventing source text',()=>{
 const sentence='Our bakery has served fresh bread and pastries to the local community since 1959.';
 assert.equal(descriptionSummary(sentence+' Come visit the bakery today and discover our long selection of handmade treats.',110),sentence);
 assert.equal(descriptionSummary('Short description.'),'Short description.');
});
test('fallback descriptions use source introduction and preserve explicit metadata',async()=>{
 const {pageDescription}=await import('../engine/authoring.mjs');
 const intro='Our local team repairs heating systems with clear estimates and scheduled service visits.';
 const p={title:'Heating service',content:'<header><p>Repeated navigation boilerplate with enough length to be accidentally used.</p></header><h1>Heating</h1><h4>'+intro+'</h4><form><p>Submission service is unavailable.</p></form>',sourceContentText:'Repeated navigation'};
 assert.equal(pageDescription(p),intro);assert.equal(p.descriptionSource,'generated');assert.equal(pageDescription({...p,descriptionSource:undefined,description:'An explicit source description.'}),'An explicit source description.');assert.equal(pageDescription({title:'Short page',content:'<h1>Short page</h1>'}),'Short page');
});
test('short factual introductions remain useful descriptions without selecting short decorative headings',async()=>{
 const {pageDescription}=await import('../engine/authoring.mjs');
 assert.equal(pageDescription({title:'About',content:'<h1>About</h1><h2>Welcome.</h2><p>Family owned since 1959.</p>'}),'Family owned since 1959.');
 assert.equal(pageDescription({title:'About',content:'<h1>About</h1><nav><p>Buy today.</p></nav><p hidden>Secret copy.</p>'}),'About');
});
