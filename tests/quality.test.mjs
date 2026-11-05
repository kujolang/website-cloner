import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {verify,layoutScore} from '../engine/verify.mjs';
test('layout correspondence ignores source indentation but still penalizes missing or shifted boxes',()=>{
 const box={tag:'NAV',x:0,y:0,width:500,height:50,text:'About\n\tNews\n\tHosting'};
 assert.equal(layoutScore({elements:[box]},{elements:[{...box,text:'AboutNewsHosting'}]}),1);
 assert.equal(layoutScore({elements:[box]},{elements:[{...box,text:'Different navigation'}]}),0);
 assert.ok(layoutScore({elements:[box]},{elements:[{...box,text:'AboutNewsHosting',y:100}]})<1);
 const old={...box,text:'WordPress.org'+ ' '.repeat(70)+'Showcas'};
 assert.equal(old.text.length,90);
 assert.equal(layoutScore({elements:[old]},{elements:[{...box,text:'WordPress.org ShowcasePluginsThemesHosting'}]}),1);
});
test('a packaged site with missing text and screenshots fails quality rather than passing',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'quality-'));
 try{
  await mkdir(path.join(dir,'output'));
  await writeFile(path.join(dir,'output/index.html'),'<html><head><title>Example</title><link rel="canonical" href="https://example.org/"><meta name="description" content="Example"></head><body>Only one word</body></html>');
  await writeFile(path.join(dir,'output/sitemap.xml'),'');await writeFile(path.join(dir,'output/robots.txt'),'');
  const model={source:'https://example.org/',warnings:[],metrics:{},captures:[],pages:[{route:'/',family:'home',dynamic:[],sourceContentText:'This important article was entirely lost during migration',sourceArticleCount:1,title:'Example',description:'Example'}]};
  await mkdir(path.join(dir,'output/alias'));
  await writeFile(path.join(dir,'output/alias/index.html'),'<html><head><title>Example</title><link rel="canonical" href="https://example.org/"><meta name="description" content="Example"></head><body>Alias</body></html>');
  model.pages.push({...model.pages[0],route:'/alias/',sourceContentText:'Alias',sourceArticleCount:0});
  model.pages[0].content='<p>This important article was entirely lost during migration</p><img src="/assets/missing-photo.webp" alt="Photo"><ol><li>Lost item</li></ol>';
  model.pages[0].assetFailures=['https://images.example/missing.jpg','https://images.example/missing.jpg'];
  model.failedStylesheets={background:{base:model.source,source:'.hero{background:url(missing.webp)}',localized:'.hero{background:none}'}};
  await writeFile(path.join(dir,'routes.json'),JSON.stringify([{route:'/'},{route:'/alias/',canonicalRoute:'/'}]));
  const report=await verify(model,dir,path.join(dir,'evidence'));
  assert.equal(report.pages.find(p=>p.route==='/alias/').canonical,true);
  assert.equal(report.status,'failed-quality-checks');
  assert.equal(report.pages[0].imagesPreserved,false);assert.equal(report.pages[0].listsPreserved,false);
  assert.deepEqual(report.pages[0].missingImageSources,['/assets/missing-photo.webp']);
  assert.ok(report.qualityFailures.some(x=>x.includes('Content')));
  assert.ok(report.qualityFailures.some(x=>x.includes('visual')));
  assert.ok(report.qualityFailures.some(x=>x.includes('Stylesheet assets')));
  assert.equal(report.metrics.stylesWithMissingAssets,1);
  assert.equal(report.pages[0].missingImages,2);
  assert.deepEqual(report.pages[0].imageDownloadFailures,[{source:'https://images.example/missing.jpg',occurrences:2}]);
  assert.deepEqual(report.pages[1].imageDownloadFailures,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('responsive layout matching skips hidden duplicates but still penalizes moved or missing content',()=>{
 const visible={tag:'H1',text:'Same title',x:20,y:100,width:300,height:50};
 const source={elements:[{...visible,width:0,height:0,x:0,y:0},visible]};
 assert.equal(layoutScore(source,{elements:[{...visible,width:0,height:0,x:0,y:0},visible]}),1);
 assert.ok(layoutScore(source,{elements:[{...visible,y:900}]})<.7);
 assert.equal(layoutScore(source,{elements:[{...visible,width:0,height:0}]}),0);
});

test('portable builds normalize source headings and validation rejects introduced regressions',{timeout:90000},async()=>{
 const {generate}=await import('../engine/generate.mjs'),{extract}=await import('../engine/extract.mjs'),{run}=await import('../engine/pipeline.mjs'),{readFile}=await import('node:fs/promises');
 const dir=await mkdtemp(path.join(os.tmpdir(),'source-headings-'));try{
  const source='https://example.org/';const p={...extract('<html lang="en"><head><title>Source</title></head><body><main><h1>Source title</h1><h1>Source duplicate</h1><p>Content</p></main></body></html>',source),styles:[]};
  await generate({source,identity:{title:'Source'},navigation:[],pages:[p],media:[],warnings:[],metrics:{},design:{text:'#111',background:'#fff',accent:'#222',spacing:24,contentWidth:1000,navigation:'source'}},dir);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000});await run(process.execPath,['scripts/site.mjs','validate'],{cwd:dir,timeout:10000});
  const result=JSON.parse(await readFile(path.join(dir,'validation-report.json')));assert.equal(result.status,'passed');assert.equal(result.warnings.length,0);
  const file=path.join(dir,'output/index.html'),html=await readFile(file,'utf8');await writeFile(file,html.replace('</main>','<h1>Introduced duplicate</h1></main>'));await assert.rejects(run(process.execPath,['scripts/site.mjs','validate'],{cwd:dir,timeout:10000}),/Export validation failed/);
  await writeFile(file,html.replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/g,''));await assert.rejects(run(process.execPath,['scripts/site.mjs','validate'],{cwd:dir,timeout:10000}),/Export validation failed/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('dimension mismatch retains independent accessibility and navigation evidence',async()=>{
 const {PNG}=await import('pngjs');const dir=await mkdtemp(path.join(os.tmpdir(),'quality-dimensions-'));
 try{
  await mkdir(path.join(dir,'output'),{recursive:true});await mkdir(path.join(dir,'evidence/source'),{recursive:true});
  await writeFile(path.join(dir,'output/index.html'),'<html><head><title>Example</title></head><body><main><h1>Example</h1><img src="missing.png"></main></body></html>');
  await writeFile(path.join(dir,'evidence/source/home-desktop.png'),PNG.sync.write(new PNG({width:1,height:1})));
  const model={source:'https://example.org/',warnings:[],metrics:{},captures:[{route:'/',file:'home-desktop.png',viewport:{name:'desktop',width:800,height:600},measurements:{elements:[]}}],pages:[{route:'/',family:'home',dynamic:[],sourceContentText:'Example',sourceArticleCount:0,title:'Example',description:'Example'}]};
  const report=await verify(model,dir,path.join(dir,'evidence'));const result=report.visual.find(v=>v.viewport==='desktop');
  assert.equal(result.error,'Screenshot dimensions differ');assert.ok(result.a11y.some(a=>a.id==='image-alt'));assert.ok(Array.isArray(result.navigation));assert.ok(result.measurements);assert.equal(report.status,'failed-quality-checks');
 }finally{await rm(dir,{recursive:true,force:true});}
});
