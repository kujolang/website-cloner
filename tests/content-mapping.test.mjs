import {parseContent} from '../scripts/source-project.mjs';
import YAML from 'yaml';
import http from 'node:http';
import {chromium} from 'playwright';
import {fileResponse} from '../engine/static.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {mkdtemp,readFile,rm,mkdir,writeFile} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {discover} from '../engine/extract.mjs';
import {generate} from '../engine/generate.mjs';
import {run} from '../engine/pipeline.mjs';
const origin='https://wp.example';
function network(stop=Infinity){let count=0;const api={
 '/types':{page:{rest_base:'pages'},post:{rest_base:'posts'},book:{rest_base:'library'}},
 '/taxonomies':{category:{rest_base:'categories',types:['post','book']},post_tag:{rest_base:'tags',types:['post']},genre:{rest_base:'genres',types:['book']}},
 '/categories':[{id:4,name:'Design &amp; Code',slug:'design',parent:0,link:origin+'/topics/design/'}],
 '/genres':[{id:12,name:'Technical',slug:'technical',link:origin+'/genre/technical/'}],
 '/tags':[{id:8,name:'Kujo',slug:'kujo',link:origin+'/labels/kujo/'}],
 '/pages':[{id:1,link:origin+'/about/',type:'page',status:'publish'}],
 '/posts':[{id:2,link:origin+'/2020/original-story',type:'post',status:'publish',categories:[4],tags:[8],date:'2020-02-03T10:00:00',excerpt:{rendered:'<p>Post excerpt</p>'},_embedded:{author:[{name:'Test Author'}]}},{id:99,link:origin+'/private/',status:'draft'}],
 '/library':[{id:3,link:origin+'/shop/odd-permalink.html',type:'book',status:'publish',categories:[4],genres:[12]}]
};return {robots:new Map(),async get(url){if(++count>stop)throw Object.assign(Error('budget'),{code:'CRAWL_BUDGET'});const u=new URL(url);const key=u.pathname.replace('/wp-json/wp/v2','');const value=api[key];const isAPI=u.pathname.includes('/wp-json/');const status=isAPI&&!value||u.pathname.endsWith('.xml')?404:200;const body=isAPI?JSON.stringify(value||{}):`<html><head><title>${u.pathname}</title><meta name="description" content="description"></head><body><main><div class="preserved" style="display:grid;grid-template-columns:repeat(2,1fr)"><h1>Original ${u.pathname}</h1><p>Original content</p></div></main></body></html>`;return {url,status,headers:{'x-wp-totalpages':'1'},body:Buffer.from(body)};},async text(url){const r=await this.get(url);if(r.status!==200)throw Error('HTTP '+r.status);return r.body.toString();}};}
test('REST content/term graph resumes and compiles native collections without changing public routes or HTML',{timeout:120000},async()=>{
 let state;await assert.rejects(discover(origin+'/',network(4),{onCheckpoint:async m=>{state=structuredClone(m);}}),/Resume/);
 const model=await discover(origin+'/',network(),{state});
 assert.ok(!model.pages.some(p=>p.url.endsWith('/private/')));
 const post=model.pages.find(p=>p.route==='/2020/original-story'),book=model.pages.find(p=>p.route==='/shop/odd-permalink.html');
 assert.equal(post.wordpress.author,'Test Author');assert.equal(post.contentType,'posts');assert.equal(book.contentType,'wp-book');assert.deepEqual(post.taxonomies,{categories:[4],tags:[8]});
 assert.ok(model.pages.some(p=>p.route==='/topics/design/'));
 model.design={text:'#111',background:'#fff',accent:'#111',contentWidth:1000,spacing:24,navigation:'source'};
 const dir=await mkdtemp(path.join(os.tmpdir(),'mapping-'));
 try{
 await mkdir(path.join(dir,'assets/media'),{recursive:true});
 const featured=PNG.sync.write(new PNG({width:64,height:64}));post.featuredImage='assets/media/aaaaaaaaaaaaaaaaaaaa.png';await writeFile(path.join(dir,post.featuredImage),featured);
 await generate(model,dir);const routes=JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8'));
 const pr=routes.find(r=>r.route===post.route),br=routes.find(r=>r.route===book.route);
 const metadata=parseContent(await readFile(path.join(dir,'content/posts/'+pr.slug+'.md'),'utf8'),'post').meta;assert.equal(metadata.author,'Test Author');
 assert.equal(pr.collection,'posts');assert.equal(br.collection,'wp-book');
 const meta=parseContent(await readFile(path.join(dir,'content/posts',pr.slug+'.md'),'utf8'),'post').meta;assert.deepEqual(meta.categories,[4]);assert.equal(meta.date,'2020-02-03T10:00:00');
 await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:100000,maxBuffer:1e6,env:{...process.env,SITE_URL:'https://new.example/repo',BASE_PATH:'/repo'}});
 const native=JSON.parse(await readFile(path.join(dir,'.ssg-output/.well-known/kujo-site-index.json'),'utf8'));
 assert.ok(native.items.some(i=>i.type==='posts'&&i.slug===pr.slug));assert.ok(native.items.some(i=>i.type==='wp-book'&&i.slug===br.slug));
 const postHTML=await readFile(path.join(dir,'output/2020/original-story/index.html'),'utf8');const og=/property="og:image" content="([^"]+)"/.exec(postHTML)?.[1];assert.ok(og?.startsWith('https://new.example/repo/images/'));assert.ok((await readFile(path.join(dir,'output',new URL(og).pathname.replace('/repo/','')))).length);assert.ok(!postHTML.includes('.ssg-batches'));
 const feed=await readFile(path.join(dir,'output/feed/index.xml'),'utf8');assert.ok(feed.includes('https://new.example/repo/2020/original-story'));assert.ok(feed.includes('Post excerpt'));assert.ok(!feed.includes(pr.slug));
 const index=JSON.parse(await readFile(path.join(dir,'output/.well-known/kujo-site-index.json'),'utf8'));
 const item=index.items.find(i=>i.url===post.route);assert.equal(item.type,'posts');assert.deepEqual(item.taxonomies.categories,['Design & Code']);assert.deepEqual(item.taxonomies.tags,['Kujo']);assert.deepEqual(index.items.find(i=>i.url===book.route).taxonomies['wpgenre'],['Technical']);
 const out=await readFile(path.join(dir,'output/2020/original-story/index.html'),'utf8');assert.match(out,/Original \/2020\/original-story/);assert.match(out,/grid-template-columns:repeat\(2,1fr\)/);assert.match(out,/https:\/\/new.example\/repo\/2020\/original-story/);
 assert.match(await readFile(path.join(dir,'output/shop/odd-permalink.html'),'utf8'),/Original content/);
 const server=http.createServer((req,res)=>fileResponse(res,path.join(dir,'output'),new URL(req.url,'http://local').pathname.replace(/^\/repo/,''),{preview:false}));
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({channel:'chrome',headless:true});
 try{const page=await browser.newPage();await page.addInitScript(()=>Object.defineProperty(document,'modelContext',{value:{registerTool(t){(window.tools ||= {})[t.name]=t;}}}));
 await page.goto(`http://127.0.0.1:${server.address().port}/repo/2020/original-story`);
 const result=await page.evaluate(()=>window.tools.list_content.execute({type:'posts',taxonomy:{categories:['Design & Code']}}));
 assert.equal(result.total_count,1);assert.equal(result.items[0].url,'/repo/2020/original-story');
 const custom=await page.evaluate(()=>window.tools.list_content.execute({type:'wp-book',taxonomy:{'wpgenre':['Technical']}}));assert.equal(custom.total_count,1);
 for(const width of [1440,390]){await page.setViewportSize({width,height:900});assert.equal(await page.locator('.preserved').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length),2);}
 }finally{await browser.close();await new Promise(r=>server.close(r));}

 }finally{await rm(dir,{recursive:true,force:true});}
});

test('unavailable REST metadata falls back without invented categories',async()=>{
 const n=network(),get=n.get.bind(n);n.get=async url=>url.includes('/wp-json/')?{url,status:403,headers:{},body:Buffer.from('denied')}:get(url);
 const m=await discover(origin+'/',n);assert.equal(m.pages[0].contentType,'pages');assert.deepEqual(m.pages[0].taxonomies,{});assert.ok(m.warnings.some(w=>w.includes('metadata unavailable')));
});
test('WordPress API discovery supports subdirectory installs',async()=>{
 const n=network(),get=n.get.bind(n);n.get=async url=>{
 if(url===origin+'/')return {url,status:200,headers:{},body:Buffer.from('<html><head><link rel="https://api.w.org/" href="/blog/wp-json/"></head><body><main>Home</main></body></html>')};
 if(url.includes('/blog/wp-json/')){const r=await get(url.replace('/blog/wp-json/','/wp-json/'));return {...r,url};}
 if(url.includes('/wp-json/'))return {url,status:404,body:Buffer.from('')};return get(url);
 };
 const m=await discover(origin+'/',n);assert.equal(m.wordpress.apiRoot,origin+'/blog/wp-json');assert.equal(m.pages.find(p=>p.route==='/shop/odd-permalink.html').contentType,'wp-book');
});
test('plain category and tag archive URLs enter the static route map',async()=>{
 const n=network(),get=n.get.bind(n);n.get=async url=>{
 const u=new URL(url);if(u.pathname.endsWith('/categories'))return {url,status:200,headers:{},body:Buffer.from(JSON.stringify([{id:4,name:'Design',link:origin+'/?cat=4'}]))};
 if(u.pathname.endsWith('/tags'))return {url,status:200,headers:{},body:Buffer.from(JSON.stringify([{id:8,name:'Kujo',link:origin+'/?tag=kujo'}]))};return get(url);
 };
 const m=await discover(origin+'/',n);const archives=m.pages.filter(p=>p.url.includes('?cat=')||p.url.includes('?tag='));assert.equal(archives.length,2);assert.ok(archives.every(p=>p.route.startsWith('/_migration/query/')));assert.equal(new Set(archives.map(p=>p.route)).size,2);
});

test('native archives and RSS span batches, preserve source archives, filter noindex, and rebuild from edited metadata',{timeout:120000},async()=>{
 const model=await discover(origin+'/',network());
 const original=model.pages.find(p=>p.route==='/2020/original-story');
 for(let i=0;i<24;i++){
  const url=origin+'/story-'+i+'/',p={...structuredClone(original),url,route:'/story-'+i+'/',canonical:url,title:'Story '+i};
  model.pages.push(p);model.wordpress.records[url]={...structuredClone(original.wordpress),id:100+i,date:`2025-01-${String(i+1).padStart(2,'0')}T12:00:00`};
 }
 model.pages.at(-1).robots='noindex,follow';
 model.design={text:'#111',background:'#fff',accent:'#111',contentWidth:1000,spacing:24,navigation:'source'};
 const dir=await mkdtemp(path.join(os.tmpdir(),'archives-'));
 try{
  await mkdir(path.join(dir,'assets/media'),{recursive:true});
  const image='assets/media/aaaaaaaaaaaaaaaaaaaa.png';await writeFile(path.join(dir,image),PNG.sync.write(new PNG({width:64,height:64})));
  for(const p of model.pages.filter(p=>p.contentType==='posts'))p.featuredImage=image;
  await generate(model,dir);
  const build=()=>run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:100000,maxBuffer:1e6,env:{...process.env,SITE_URL:'https://new.example/repo',BASE_PATH:'/repo',SSG_BATCH_SIZE:'7',SSG_WORKERS:'4'}});
  await build();
  for(const p of model.pages.filter(p=>p.featuredImage)){
   const html=await readFile(path.join(dir,'output',p.route,'index.html'),'utf8'),image=/property="og:image" content="([^"]+)"/.exec(html)?.[1];assert.ok(image?.includes('/images/'));assert.ok((await readFile(path.join(dir,'output',new URL(image).pathname.replace('/repo/','')))).length);
  }
  const manifest=JSON.parse(await readFile(path.join(dir,'output/archive-manifest.json'),'utf8'));
  const posts=manifest.archives.find(a=>a.title==='posts');assert.equal(posts.members.length,24);assert.equal(posts.pages,2);assert.ok(!posts.members.includes('/story-23/'));
  const archiveTitles=await Promise.all([posts.route,posts.route+'page/2/'].map(async route=>/<title>(.*?)<\/title>/.exec(await readFile(path.join(dir,'output'+route,'index.html'),'utf8'))[1]));assert.equal(new Set(archiveTitles).size,2);
  const category=manifest.archives.find(a=>a.title==='categories: Design & Code');assert.equal(category.members.length,25);assert.ok(category.members.includes('/shop/odd-permalink.html'));
  const {load}=await import('cheerio');
  let allCards=[];
  for(const route of [posts.route,posts.route+'page/2/']){
   const html=await readFile(path.join(dir,'output',route,'index.html'),'utf8'),$=load(html);
   allCards.push(...$('.listing-card-title a').map((i,e)=>$(e).attr('href')).get());
   assert.ok(html.includes('data-kujo-webmcp'));assert.ok(!html.includes('page-000'));
  }
  assert.equal(new Set(allCards).size,24);assert.ok(allCards.every(x=>x.startsWith('/repo/')));assert.ok(allCards.includes('/repo/2020/original-story'));
  const customArchive=manifest.archives.find(a=>a.title==='wpgenre: Technical');assert.deepEqual(customArchive.members,['/shop/odd-permalink.html']);
  const customHTML=await readFile(path.join(dir,'output',customArchive.route,'index.html'),'utf8');assert.match(customHTML,/href="\/repo\/shop\/odd-permalink\.html"/);
  assert.match(await readFile(path.join(dir,'output/topics/design/index.html'),'utf8'),/Original content/);
  const feed=load(await readFile(path.join(dir,'output/feed/index.xml'),'utf8'),{xmlMode:true});
  assert.equal(feed('item').length,20);assert.equal(feed('item link').first().text(),'https://new.example/repo/story-22/');assert.ok(!feed('item link').map((i,e)=>feed(e).text()).get().some(x=>x.endsWith('story-23/')));
  const routes=JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8'));
  const p=routes.find(p=>p.route==='/story-22/'),file=path.join(dir,'content/posts',p.slug+'.md');
  const {meta:metadata,body}=parseContent(await readFile(file,'utf8'),file);metadata.title='Edited native title';metadata.excerpt='Edited native excerpt';metadata.categories=[];await writeFile(file,'---\n'+YAML.stringify(metadata)+'---\n\n'+body);
  await build();
  const rebuilt=await readFile(path.join(dir,'output',posts.route,'index.html'),'utf8');assert.match(rebuilt,/Edited native title/);assert.match(rebuilt,/Edited native excerpt/);
  const updated=JSON.parse(await readFile(path.join(dir,'output/archive-manifest.json'),'utf8'));assert.equal(updated.archives.find(a=>a.title==='categories: Design & Code').members.length,24);
 }finally{await rm(dir,{recursive:true,force:true});}
});
