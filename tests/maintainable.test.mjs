import {spawn} from 'node:child_process';
import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,mkdir,rm,access,cp} from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';import YAML from 'yaml';
import {generate} from '../engine/generate.mjs';import {extract} from '../engine/extract.mjs';import {run} from '../engine/pipeline.mjs';import {parseContent} from '../scripts/source-project.mjs';
const source='https://maintain.example';
function fixture(){
 const card=(id,title)=>`<article class="card post-${id}"><h2><a href="${source}/story-${id}/">${title}</a></h2><a class="wp-block-read-more" href="${source}/story-${id}/">Read More<span class="screen-reader-text">: ${title}</span></a><p class="excerpt">Summary ${id}</p><time datetime="2020-01-0${id}">2020-01-0${id}</time></article>`;
 const page=(route,title,body,classes)=>({...extract(`<html lang="en"><head><title>${title}</title><meta name="description" content="Description"></head><body class="${classes}"><header><nav><a href="/">Home</a><a href="/story-1/">First</a></nav></header><main><h1>${title}</h1>${body}</main><footer>Local footer</footer></body></html>`,source+route),styles:['.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:24px}.card{border:1px solid #ddd}']});
 const pages=[page('/','Home','<div class="grid">'+card(1,'First')+card(2,'Second')+'</div>','home blog'),page('/category/design/','Design','<div class="grid">'+card(1,'First')+card(2,'Second')+'</div>','archive category')];
 pages.push(page('/story-1/','First','<div class="entry-content"><p>Editable first paragraph.</p><h2>Subheading</h2><p>Another paragraph.</p></div>','single-post'));
 pages.push(page('/story-2/','Second','<div class="entry-content"><p>Second paragraph.</p></div>','single-post'));
 const terms=Array.from({length:26},(_,i)=>({id:i+1,name:i===25?'Long '+('taxonomy label '.repeat(15)):i?'Term '+i:'Design',slug:'term-'+i,parent:0,url:source+'/category/'+(i?'term-'+i:'design')+'/'}));
 return {source:source+'/',identity:{title:'Editable site'},navigation:[{label:'Home',url:source+'/'},{label:'First',url:source+'/story-1/'}],design:{text:'#111',background:'#fff',accent:'#222',spacing:24,contentWidth:1000,navigation:'source'},metrics:{},pages,wordpress:{types:[{slug:'post',rest_base:'posts'}],taxonomies:[{slug:'category',rest_base:'categories'}],terms:{category:terms},records:Object.fromEntries([1,2].map(i=>[source+'/story-'+i+'/',{type:'post',id:i,date:'2020-01-0'+i,modified:'2020-02-0'+i,author:'Author',excerpt:'Summary '+i,terms:{categories:terms.map(t=>t.id)}}]))}};
}
test('portable Markdown project rebuilds edited content, source archives, new routes, drafts, aliases and full taxonomies',{timeout:120000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'maintainable-'));
 const build=(...args)=>run(process.execPath,['scripts/build.mjs',...args],{cwd:dir,timeout:100000,maxBuffer:2e6});
 const edit=async(file,fn)=>{const {meta,body}=parseContent(await readFile(path.join(dir,file),'utf8'),file);const changed=fn(meta,body)||body;await writeFile(path.join(dir,file),'---\n'+YAML.stringify(meta)+'---\n\n'+changed+'\n');};
 try{
  await generate(fixture(),dir);await build();
  const unchanged=JSON.parse(await readFile(path.join(dir,'output/maintenance-report.json'),'utf8'));
  assert.deepEqual(unchanged.updated,[],'compact metadata must not treat untouched records as edited');
  const original=JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8')),first=original.find(p=>p.route==='/story-1/'),second=original.find(p=>p.route==='/story-2/');
  const file='content/posts/'+first.slug+'.md';assert.match(await readFile(path.join(dir,file),'utf8'),/Editable first paragraph/);
  const initial=await readFile(path.join(dir,'output/index.html'),'utf8');assert.match(initial,/class="grid"/);assert.match(initial,/Summary 1/);
  const initialIndex=JSON.parse(await readFile(path.join(dir,'output/.well-known/kujo-site-index.json'),'utf8'));
  assert.equal(initialIndex.items.find(p=>p.url==='/story-1/').taxonomies.categories.length,26);assert.ok(initialIndex.items.find(p=>p.url==='/story-1/').taxonomies.categories.at(-1).length>128);
  await edit(file,(meta,body)=>{meta.title='Updated first';meta.excerpt='Updated summary';meta.permalink='/news/renamed.html';return body.replace('Editable first paragraph.','This **Markdown edit** is published.');});
  await writeFile(path.join(dir,'content/posts/new-story.md'),'---\ntitle: Third\npermalink: /news/third/\ndraft: true\ndate: 2025-01-01\ncategories: [1]\n---\n\nNew **native Markdown** content.\n');
  await build();await assert.rejects(access(path.join(dir,'output/news/third/index.html')));
  const article=await readFile(path.join(dir,'output/news/renamed.html'),'utf8');assert.match(article,/<strong>Markdown edit<\/strong>/);assert.match(article,/<h1\b[^>]*>Updated first<\/h1>/);assert.match(article,/entry-content/);
  assert.match(await readFile(path.join(dir,'output/story-1/index.html'),'utf8'),/http-equiv="refresh"/);
  assert.match(await readFile(path.join(dir,'output/index.html'),'utf8'),/Updated summary/);assert.match(await readFile(path.join(dir,'output/index.html'),'utf8'),/Read More<span class="screen-reader-text">: Updated first<\/span>/);
  await build('--drafts');assert.match(await readFile(path.join(dir,'output/news/third/index.html'),'utf8'),/noindex,nofollow/);
  assert.ok(!JSON.parse(await readFile(path.join(dir,'output/.well-known/kujo-site-index.json'),'utf8')).items.some(i=>i.url==='/news/third/'));
  await edit('content/posts/new-story.md',meta=>{meta.draft=false;});await build('--base-path','/repo');
  assert.match(await readFile(path.join(dir,'output/index.html'),'utf8'),/href="\/repo\/news\/third\/"/);
  assert.match(await readFile(path.join(dir,'output/page/2/index.html'),'utf8'),/class="grid"/);
  assert.match(await readFile(path.join(dir,'output/category/design/page/2/index.html'),'utf8'),/Summary 1|Updated summary|Summary 2/);
  await rm(path.join(dir,'content/posts/'+second.slug+'.md'));await build();
  await assert.rejects(access(path.join(dir,'output/story-2/index.html')));await assert.rejects(access(path.join(dir,'output/page/2/index.html')));
  const changed=await readFile(path.join(dir,'output/index.html'),'utf8');assert.ok(!changed.includes('href="/story-2/"'));assert.match(changed,/Third/);
  const report=JSON.parse(await readFile(path.join(dir,'output/maintenance-report.json'),'utf8'));assert.ok(report.updated.includes('/'));
  await run(process.execPath,['scripts/site.mjs','validate'],{cwd:dir,timeout:30000,maxBuffer:2e6});
  await run(process.execPath,['scripts/site.mjs','new','--type','wp-book','--slug','new-book'],{cwd:dir,timeout:10000});assert.match(await readFile(path.join(dir,'content/wp-book/new-book.md'),'utf8'),/draft: true/);
  await writeFile(path.join(dir,'content/posts/bad.md'),'---\ntitle: Bad\npermalink: /../../escape\n---\nContent');await assert.rejects(build(),/Unsafe permalink/);await rm(path.join(dir,'content/posts/bad.md'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('exported commands validate, minify, package deterministically and exercise the local Ability adapter',{timeout:180000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'maintain-tools-'));
 const command=(args,options={})=>run(process.execPath,args,{cwd:dir,timeout:100000,maxBuffer:3e6,...options});
 try{
  await generate(fixture(),dir);
  const config=JSON.parse(await readFile(path.join(dir,'kujo-ssg.json'),'utf8'));config.feed_limit=0;config.posts_per_page=1;
  await writeFile(path.join(dir,'kujo-ssg.yml'),YAML.stringify(config));
  await writeFile(path.join(dir,'static/favicon.svg'),'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16"/></svg>');
  await writeFile(path.join(dir,'static/404.html'),'<!doctype html><html lang="en"><head><title>Custom 404</title></head><body><main><h1>Custom missing page</h1></main></body></html>');
  await writeFile(path.join(dir,'assets/css/test.css'),'.example { color: red; margin: 0; }\n');
  await command(['scripts/build.mjs','--minify'],{env:{...process.env,SSG_ESBUILD_BIN:path.resolve('node_modules/.bin/esbuild')}});
  assert.match(await readFile(path.join(dir,'output/404.html'),'utf8'),/Custom missing page/);
  assert.ok((await readFile(path.join(dir,'output/assets/css/test.css'),'utf8')).length<36);
  await command(['scripts/site.mjs','validate']);
  const preview=spawn(process.execPath,['scripts/site.mjs','serve','--port','0'],{cwd:dir,stdio:['ignore','pipe','pipe']});
  try{const url=await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(Error('Preview startup timeout')),10000);preview.stdout.on('data',chunk=>{const match=/http:\/\/127\.0\.0\.1:\d+/.exec(chunk.toString());if(match){clearTimeout(timeout);resolve(match[0]);}});preview.on('error',reject);});assert.match(await (await fetch(url)).text(),/Home/);assert.equal((await fetch(url+'/content/posts/story-1.md')).status,404);}finally{preview.kill();}
  await command(['scripts/site.mjs','package','--destination','one.tar']);
  await command(['scripts/site.mjs','package','--destination','two.tar']);
  assert.deepEqual(await readFile(path.join(dir,'one.tar')),await readFile(path.join(dir,'two.tar')));
  await command(['scripts/site.mjs','check-tools']);
  await access(path.join(dir,'output-ability/index.html'));await access(path.join(dir,'output-preview/index.html'));
  await mkdir(path.join(dir,'doc-input'));await writeFile(path.join(dir,'doc-input/math.kujo'),'# Adds two numbers.\npub func add(a,b) { return a + b }\n');
  await command(['scripts/site.mjs','docs-import','--target-repo',path.join(dir,'doc-input')]);
  await command(['scripts/build.mjs']);assert.ok(JSON.parse(await readFile(path.join(dir,'output/export-routes.json'),'utf8')).some(p=>p.collection==='reference'));
  await command(['scripts/site.mjs','docs-starter','docs-example']);await access(path.join(dir,'docs-example/scripts/update_docs.kujo'));
  const docConfig=await readFile(path.join(dir,'docs-example/kujo-ssg.yml'),'utf8');await writeFile(path.join(dir,'docs-example/kujo-ssg.yml'),docConfig.replace('minify: true','minify: false'));
  await run(process.env.KUJO_BIN||'kujo',['run','--interpreter','build.kujo','--','--site-url','https://docs.example'],{cwd:path.join(dir,'docs-example'),timeout:100000,maxBuffer:3e6});await access(path.join(dir,'docs-example/output/index.html'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('ambiguous and empty source archives automatically use native listings without manual binding',{timeout:120000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'automatic-archives-'));
 const model=fixture();
 const replacement=extract(`<html><head><title>Design</title></head><body class="archive category"><header>Brand</header><main><h1>Design</h1><p>Editorial introduction</p><section class="no-results not-found"><p>No posts found</p></section></main><aside>Sidebar</aside><footer>Footer</footer></body></html>`,source+'/category/design/');
 model.pages[1]={...replacement,styles:[]};
 try{
  await generate(model,dir);
  const bindings=JSON.parse(await readFile(path.join(dir,'archive-bindings.json'),'utf8'));
  const binding=bindings.bindings.find(b=>b.root==='/category/design/');assert.equal(binding.mode,'native');assert.deepEqual(bindings.unbound,[]);
  const build=()=>run(process.execPath,['scripts/build.mjs','--posts-per-page','1'],{cwd:dir,timeout:100000,maxBuffer:2e6});
  await build();
  let html=await readFile(path.join(dir,'output/category/design/index.html'),'utf8');assert.match(html,/Editorial introduction/);assert.match(html,/migration-native-listing/);assert.match(html,/story-2/);assert.ok(!html.includes('No posts found'));
  await access(path.join(dir,'output/category/design/page/2/index.html'));
  const routes=JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8'));
  for(const p of routes.filter(p=>p.collection==='posts'))await rm(path.join(dir,'content/posts/'+p.slug+'.md'));
  await build();html=await readFile(path.join(dir,'output/category/design/index.html'),'utf8');assert.ok(!html.includes('href="/story-2/"'));assert.ok(!html.includes('migration-native-listing'));assert.match(html,/No posts found/);await assert.rejects(access(path.join(dir,'output/category/design/page/2/index.html')));
  await writeFile(path.join(dir,'content/posts/new.md'),'---\ntitle: Automatically included\npermalink: /new.html\ncategories: [1]\n---\nNew post');
  await writeFile(path.join(dir,'content/posts/other.md'),'---\ntitle: Other category\npermalink: /other/\ncategories: [2]\n---\nOther post');
  await build();html=await readFile(path.join(dir,'output/category/design/index.html'),'utf8');assert.match(html,/href="\/new.html"/);assert.ok(!html.includes('Other category'));
  const report=JSON.parse(await readFile(path.join(dir,'output/maintenance-report.json'),'utf8'));assert.equal(report.status,'passed');assert.equal(report.fallbacks[0].mode,'native');assert.deepEqual(report.unbound,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('equally sized competing grids choose automatic fallback instead of silently binding one',{timeout:30000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ambiguous-grids-'));
 try{
  const model=fixture();
  model.pages[1]={...extract(`<html><body class="archive category"><main><h1>Design</h1><section><article><h2><a href="${source}/story-1/">First</a></h2></article></section><section><article><h2><a href="${source}/story-2/">Second</a></h2></article></section></main></body></html>`,source+'/category/design/'),styles:[]};
  await generate(model,dir);
  const binding=JSON.parse(await readFile(path.join(dir,'archive-bindings.json'),'utf8')).bindings.find(b=>b.root==='/category/design/');assert.equal(binding.mode,'native');
  const html=await readFile(path.join(dir,'content/'+binding.source+'.md'),'utf8');assert.match(html,/Design/);assert.ok(!html.includes('story-1'));assert.ok(!html.includes('story-2'));
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('slash aliases share archive pagination while genuine content collisions remain errors',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'archive-alias-'));
 try{
  const model=fixture();const archive=model.pages[1];model.pages.push({...archive,url:source+'/category/design',route:'/category/design',canonical:source+'/category/design/'});
  await generate(model,dir);
  const file=path.join(dir,'content/posts/story-1.md'),parsed=parseContent(await readFile(file,'utf8'),file);parsed.meta.excerpt='Changed summary';await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n\n'+parsed.body);
  const build=()=>run(process.execPath,['scripts/build.mjs','--posts-per-page','1'],{cwd:dir,timeout:70000,maxBuffer:2e6});
  // Set source card count to one so this fixture exercises a second archive page.
  const bindings=JSON.parse(await readFile(path.join(dir,'archive-bindings.json'),'utf8'));for(const b of bindings.bindings)b.pageSize=1;await writeFile(path.join(dir,'archive-bindings.json'),JSON.stringify(bindings));
  await build();await access(path.join(dir,'output/category/design/page/2/index.html'));
  const routes=JSON.parse(await readFile(path.join(dir,'output/export-routes.json'),'utf8'));assert.equal(routes.filter(p=>p.route==='/category/design/page/2/').length,1);
  await writeFile(path.join(dir,'content/pages/conflict.md'),'---\ntitle: Real page\npermalink: /category/design/page/2/\n---\nDo not overwrite me.');
  await assert.rejects(build(),/Archive pagination conflicts with content/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
