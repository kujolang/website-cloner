import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {load} from 'cheerio/slim';
import {writeArchiveBindings} from '../engine/archive-bindings.mjs';
test('image-only archive cards retain their source grid and pagination',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'archive-images-'));try{
  await mkdir(path.join(dir,'content/pages'),{recursive:true});
  await writeFile(path.join(dir,'content/pages/photos.html'),'<main><ul><li><a href="/photo/"><img src="/photo.webp" alt="Lake"></a></li></ul><nav class="pagination">1 2 3 … 49</nav></main>');
  await writeArchiveBindings({pages:[{route:'/photos/',bodyClass:'archive'}],routes:[{route:'/photos/',collection:'pages',slug:'photos'},{route:'/photo/',collection:'photos',slug:'photo'}]},dir);
  const {bindings}=JSON.parse(await readFile(path.join(dir,'archive-bindings.json')));assert.equal(bindings[0].mode,undefined);assert.match(bindings[0].template,/<img/);
  assert.equal(load(await readFile(path.join(dir,'content/pages/photos.html'),'utf8'))('nav').text(),'1 2 3 … 49');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('article headers bind the whole list card without deleting excerpts',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'archive-headers-'));try{
  await mkdir(path.join(dir,'content/pages'),{recursive:true});
  const html='<main><ul>'+[1,2,3].map(n=>`<li><article><header><h2><a href="/story-${n}/">Story ${n}</a></h2></header><section><p>Excerpt ${n}</p><a href="/story-${n}/">Read Post</a></section></article></li>`).join('')+'</ul></main>';
  await writeFile(path.join(dir,'content/pages/blog.html'),html);
  await writeArchiveBindings({pages:[{route:'/blog/',bodyClass:'archive'}],routes:[{route:'/blog/',collection:'pages',slug:'blog'},...[1,2].map(n=>({route:`/story-${n}/`,collection:'posts',slug:`story-${n}`}))]},dir);
  const {bindings}=JSON.parse(await readFile(path.join(dir,'archive-bindings.json')));
  assert.equal(bindings[0].mode,undefined);assert.match(bindings[0].template,/^<li/);assert.match(bindings[0].cards['posts/story-1'],/Excerpt 1/);
  const actual=await readFile(path.join(dir,'content/pages/blog.html'),'utf8');for(const n of [1,2,3])assert.ok(actual.includes('Excerpt '+n));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Gutenberg unlinked titles and Read More anchors retain source cards and pagination size',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'archive-readmore-'));try{
  await mkdir(path.join(dir,'content/pages'),{recursive:true});
  await writeFile(path.join(dir,'content/pages/blog.html'),'<main><ul class="wp-block-post-template">'+[1,2].map(n=>`<li class="wp-block-post"><h2 class="wp-block-post-title">Story ${n}</h2><a class="wp-block-read-more" href="/story-${n}/">Read More</a></li>`).join('')+'</ul></main>');
  const model={pages:[{route:'/blog/',bodyClass:'blog'}],routes:[{route:'/blog/',collection:'pages',slug:'blog'},...[1,2].map(n=>({route:`/story-${n}/`,collection:'posts',slug:`story-${n}`}))]};await writeArchiveBindings(model,dir);
  const {bindings}=JSON.parse(await readFile(path.join(dir,'archive-bindings.json')));assert.equal(bindings.length,1);assert.equal(bindings[0].pageSize,2);assert.notEqual(bindings[0].mode,'native');assert.equal(Object.keys(bindings[0].cards).length,2);assert.match(bindings[0].template,/wp-block-post-title/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('a static WordPress homepage is not replaced by an archive fallback',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'static-home-'));try{
  await mkdir(path.join(dir,'content/pages'),{recursive:true});const html='<main><h1>Welcome</h1><a href="/post/">Featured story</a></main>';await writeFile(path.join(dir,'content/pages/home.html'),html);
  await writeArchiveBindings({wordpress:{terms:{post_tag:[{id:5,url:'https://example.com/?tag=popular'}]}},pages:[{route:'/',bodyClass:'home wp-singular page'}],routes:[{route:'/',collection:'pages',slug:'home'},{route:'/post/',collection:'posts',slug:'post'}]},dir);
  assert.deepEqual(JSON.parse(await readFile(path.join(dir,'archive-bindings.json'))).bindings,[]);assert.equal(await readFile(path.join(dir,'content/pages/home.html'),'utf8'),html);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('uncaptured archive records never fall back to unrelated collections',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'archive-uncaptured-'));try{
  await mkdir(path.join(dir,'content/pages'),{recursive:true});const html='<main><ul><li><a aria-disabled="true" data-migration-unavailable="/photo/"><img src="/photo.webp" alt="Lake"></a></li></ul><nav>1 2 3 … 49</nav></main>';await writeFile(path.join(dir,'content/pages/photos.html'),html);
  await writeArchiveBindings({pages:[{route:'/photos/',bodyClass:'home blog'}],routes:[{route:'/photos/',collection:'pages',slug:'photos'},{route:'/news/story/',collection:'posts',slug:'story'}]},dir);
  const report=JSON.parse(await readFile(path.join(dir,'archive-bindings.json')));assert.deepEqual(report.bindings,[]);assert.equal(report.preserved.length,1);assert.equal(await readFile(path.join(dir,'content/pages/photos.html'),'utf8'),html);
 }finally{await rm(dir,{recursive:true,force:true});}
});
