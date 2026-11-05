import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import os from 'node:os';import path from 'node:path';
import {load} from 'cheerio/slim';
import {compileTemplateFamilies,projectTemplateBindings} from '../engine/template-family.mjs';
import {templateRole} from '../engine/template-roles.mjs';
const run=promisify(execFile);
const runtime=new URL('../scripts/source-project.mjs',import.meta.url).href;
const canonical=html=>load(html,null,false).html();

test('semantic families preserve varied DOM, reuse site chrome, and propagate shared edits',{timeout:30000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'semantic-family-'));
 const variants=[
  {id:'a',role:'default-page',html:'<header MIGRATION_ATTRIBUTES_attrs0_END><nav>MIGRATION_VALUE_layout_values.value1_END</nav></header><main><section><h1>MIGRATION_VALUE_title_END</h1><p>MIGRATION_SLOT_body1_END</p></section><aside>Aside</aside></main><footer>Footer</footer>'},
  {id:'b',role:'default-page',html:'<header MIGRATION_ATTRIBUTES_attrs2_END><nav>MIGRATION_VALUE_layout_values.value2_END</nav></header><main><section><h1>MIGRATION_VALUE_title_END</h1><p>MIGRATION_SLOT_body1_END</p></section><section><h2>More</h2><div><img MIGRATION_ATTRIBUTES_attrs3_END></div></section></main><footer>Footer</footer>'},
  {id:'c',role:'single-product',html:'<header MIGRATION_ATTRIBUTES_attrs0_END><nav>MIGRATION_VALUE_layout_values.value1_END</nav></header><main><article><h1>MIGRATION_VALUE_title_END</h1><div>MIGRATION_SLOT_body1_END</div></article></main><footer>Footer</footer>'},
 ];
 const data=[{title:'One',layout_values:{value1:'Menu'},layout_attributes:{attrs0:{class:'site-header'}},layout_repeats:{}},{title:'Two',layout_values:{value2:'Menu'},layout_attributes:{attrs2:{class:'site-header alt'},attrs3:{src:'/photo.webp',style:'object-fit:cover;border-radius:12px'}},layout_repeats:{}},{title:'Product',layout_values:{value1:'Menu'},layout_attributes:{attrs0:{class:'site-header'}},layout_repeats:{}}];
 try{
  const compiled=compileTemplateFamilies(variants);assert.equal([...compiled.files.keys()].filter(f=>f.startsWith('templates/content/')).length,2);
  assert.equal([...compiled.files.keys()].filter(f=>/\/header(?:-|\.)/.test(f)).length,1);
  for(const [f,html]of compiled.files){await mkdir(path.dirname(path.join(dir,f)),{recursive:true});await writeFile(path.join(dir,f),html);}
  const rows=variants.map((v,i)=>({original:v.html,template:compiled.plans.get(v.id).file,originalData:data[i],data:{...data[i],...projectTemplateBindings(compiled.plans.get(v.id).plan,data[i])}}));
  await writeFile(path.join(dir,'rows.json'),JSON.stringify(rows));
  const render=async()=>JSON.parse((await run(process.execPath,['--input-type=module','-e',`import {renderBindings} from ${JSON.stringify(runtime)};import {readFile} from 'node:fs/promises';const rows=JSON.parse(await readFile('rows.json'));console.log(JSON.stringify(await Promise.all(rows.map(async r=>({old:await renderBindings(r.original,r.originalData),next:await renderBindings(await readFile(r.template,'utf8'),r.data)})))));`],{cwd:dir})).stdout);
  for(const r of await render())assert.equal(canonical(r.next),canonical(r.old));
  const header=[...compiled.files.keys()].find(f=>/\/header(?:-|\.)/.test(f));await writeFile(path.join(dir,header),(await readFile(path.join(dir,header),'utf8')).replace('<nav>','<nav aria-label="Shared navigation">'));
  for(const r of await render())assert.match(r.next,/aria-label="Shared navigation"/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('role detection recognizes native custom types, shop and taxonomies without treating URL words as content types',()=>{
 const role=p=>templateRole({url:'https://example.com/x/',route:'/x/',...p},'https://example.com/').role;
 assert.equal(role({url:'https://example.com/',route:'/'}),'home');
 assert.equal(role({url:'https://example.com/?p=5',route:'/query-p-5/',wordpress:{type:'post'}}),'single-post');
 assert.equal(role({url:'https://example.com/?cat=4',route:'/query-cat-4/',bodyClass:'archive category'}),'category');
 assert.equal(role({url:'https://example.com/?paged=2',route:'/query-paged-2/',bodyClass:'home blog paged'}),'archive');
 assert.equal(role({bodyClass:'archive category category-design'}),'category');
 assert.equal(role({bodyClass:'archive tax-project_type'}),'taxonomy-project-type');
 assert.equal(role({bodyClass:'archive post-type-archive-product'}),'shop');
 assert.equal(role({wordpress:{type:'post'}}),'single-post');
 assert.equal(role({wordpress:{type:'product'}}),'single-product');
 assert.equal(role({wordpress:{type:'portfolio'}}),'single-portfolio');
 assert.equal(role({wordpress:{type:'work'}}),'single-work');
 assert.equal(role({bodyClass:'archive post-type-archive-work'}),'archive-work');
 assert.equal(role({url:'https://example.com/about-products/',route:'/about-products/'}),'default-page');
 assert.equal(role({url:'https://example.com/blog/',route:'/blog/',content:'<h1>Blog</h1><p>Coming soon</p>'}),'default-page');
 assert.equal(role({url:'https://example.com/blog/',route:'/blog/',content:'<h2><a href="/one/">One</a></h2><h2><a href="/two/">Two</a></h2>'}),'archive');
});

test('export uses named post/product/work roles and new posts inherit the shared design',{timeout:90000},async()=>{
 const {generate}=await import('../engine/generate.mjs'),{extract}=await import('../engine/extract.mjs'),{parseContent}=await import('../scripts/source-project.mjs');
 const dir=await mkdtemp(path.join(os.tmpdir(),'semantic-export-')),source='https://roles.example/';
 const definitions=[['story-one','single-post','Post one'],['story-two','single-post','Post two'],['widget','single-product','Widget'],['case-study','single-work','Case study']];
 const pages=definitions.map(([slug,cls,title],i)=>({...extract(`<html><head><title>${title} — Site name</title></head><body class="${cls}"><header><nav>Shared navigation</nav></header><main><article class="${cls}"><h1>${title}</h1><div class="entry-content"><p class="lead">Editable ${title}.</p></div>${i===1?'<aside class="related">Related</aside>':''}</article></main><div class="site-footer"><section>Shared footer widgets</section><footer>Footer</footer></div></body></html>`,source+slug+'/'),styles:[]}));
 pages.push({...pages[0],url:source+'story-copy/',route:'/story-copy/'});
 const model={source,identity:{title:'Roles'},navigation:[],pages,media:[],warnings:[],metrics:{},design:{text:'#111',background:'#fff',accent:'#222',contentWidth:1000,spacing:24,navigation:'source'}};
 try{
  await generate(model,dir);
  const catalog=JSON.parse(await readFile(path.join(dir,'template-catalog.json')));assert.deepEqual(catalog.roles.map(r=>r.role).sort(),['single-post','single-product','single-work']);
  assert.equal(catalog.roles.find(r=>r.role==='single-post').records,3);
  assert.ok(catalog.reusedConversions>=1);
  assert.ok(catalog.sourceAliases.some(a=>a.route==='/story-copy/'&&a.target==='/story-one/'));
  assert.ok(catalog.readable.staticAttributeBindings>0);
  assert.match(await readFile(path.join(dir,'templates/content/single-post.html'),'utf8'),/class="single-post"/);
  const post=parseContent(await readFile(path.join(dir,'content/posts/story-one.md'),'utf8'),'post');assert.equal(post.meta.content_template,'templates/content/single-post.html');assert.equal(post.meta.title,'Post one');assert.equal(post.meta.seo_title,'Post one — Site name');
  assert.match(await readFile(path.join(dir,'templates/partials/footer.html'),'utf8'),/Shared footer widgets/);
  assert.ok(!(await readFile(path.join(dir,'templates/content/single-post.html'),'utf8')).includes('Shared footer widgets'));
  await run(process.execPath,['scripts/site.mjs','new','--type','posts','--slug','new-post','--title','New post'],{cwd:dir});
  const created=parseContent(await readFile(path.join(dir,'content/posts/new-post.md'),'utf8'),'new');assert.equal(created.meta.content_template,post.meta.content_template);assert.equal(created.meta.template_role,'single-post');assert.notEqual(created.meta.layout_data,post.meta.layout_data);assert.equal(created.meta.draft,true);assert.ok(!created.body.includes('Editable Post one'));
  await run(process.execPath,['scripts/build.mjs','--drafts'],{cwd:dir,timeout:70000,maxBuffer:2e6});
  const $=load(await readFile(path.join(dir,'output/new-post/index.html'),'utf8'));assert.equal($('article.single-post').length,1);assert.equal($('h1').text(),'New post');assert.match($('.entry-content').text(),/Write your content here/);
  assert.equal(load(await readFile(path.join(dir,'output/story-one/index.html'),'utf8'))('aside.related').length,0);
  assert.equal(load(await readFile(path.join(dir,'output/story-two/index.html'),'utf8'))('aside.related').length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('invariant markup stays readable without freezing variable fields or interpreting replacement strings',async()=>{
 const {templateInvariants}=await import('../engine/template-invariants.mjs');
 const file='templates/content/default-page.html',files=new Map([[file,'<main MIGRATION_ATTRIBUTES_attrs0_END><h1>MIGRATION_VALUE_title_END</h1><p>MIGRATION_VALUE_layout_values.value1_END</p></main>']]);
 const hoist=templateInvariants(files),one={title:'One',layout_attributes:{attrs0:{class:'card',title:'$&'}},layout_values:{value1:'First'}},two={...one,title:'Two',layout_values:{value1:'Second'}};
 hoist.collect(file,one);hoist.collect(file,two);hoist.apply();
 assert.match(files.get(file),/class="card" title="\$&amp;"/);assert.match(files.get(file),/MIGRATION_VALUE_title_END/);assert.match(files.get(file),/MIGRATION_VALUE_layout_values.value1_END/);
 assert.deepEqual(hoist.prune(file,one).layout_attributes,{});assert.equal(hoist.prune(file,two).layout_values.value1,'Second');
});

test('visual capture planning includes every detected template role, including more than five custom types',async()=>{
 const {captureSamples}=await import('../engine/capture.mjs');
 const pages=['post','product','portfolio','work','book','event'].map(type=>({url:'https://example.com/'+type+'/',route:'/'+type+'/',bodyClass:'single-'+type,family:'article',content:'<h1>Item</h1>'}));
 const model={source:'https://example.com/',pages,warnings:[]};const plan=captureSamples(model);
 assert.equal(plan.length,6);assert.deepEqual(plan.map(p=>p.captureRole),['single-post','single-product','single-portfolio','single-work','single-book','single-event']);
});
test('starting from an inner URL does not turn a post, product or landing page into a home template',async()=>{
 const {templateRole}=await import('../engine/template-roles.mjs');
 for(const [route,type,expected] of [['/event/concert/','tribe_events','single-tribe-events'],['/product/item/','product','single-product'],['/story/','post','single-post'],['/lp/service/','page','default-page']]){
  const url='https://example.com'+route;assert.equal(templateRole({route,url,wordpress:{type}},url).role,expected);
 }
 assert.equal(templateRole({route:'/subsite/',url:'https://example.com/subsite/',bodyClass:'home page',wordpress:{type:'page'}},'https://example.com/subsite/').role,'home');
 assert.equal(templateRole({route:'/',url:'https://example.com/'},'https://example.com/event/concert/').role,'home');
});
