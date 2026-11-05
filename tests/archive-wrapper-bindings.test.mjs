import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {load} from 'cheerio';import {writeArchiveBindings} from '../engine/archive-bindings.mjs';
async function bind(html){const dir=await mkdtemp(path.join(tmpdir(),'archive-wrappers-'));try{await mkdir(path.join(dir,'content/pages'),{recursive:true});await writeFile(path.join(dir,'content/pages/blog.html'),html);const model={routes:[{route:'/blog/',collection:'pages',slug:'blog'},...['one','two'].map(slug=>({route:'/'+slug+'/',collection:'posts',slug}))],pages:[{route:'/blog/',bodyClass:'archive'}]};await writeArchiveBindings(model,dir);return {report:JSON.parse(await readFile(path.join(dir,'archive-bindings.json'))),html:await readFile(path.join(dir,'content/pages/blog.html'),'utf8')};}finally{await rm(dir,{recursive:true,force:true});}}
const article=slug=>`<article class="entry"><header><h2><a href="/${slug}/">${slug}</a></h2></header><p>Summary ${slug}</p></article>`;
test('root article siblings bind without adding a layout wrapper or replacing source prose',async()=>{
 const result=await bind(article('one')+article('two'));const b=result.report.bindings[0];assert.notEqual(b.mode,'native');assert.equal(b.rootContainer,true);assert.equal(b.pageSize,2);const $=load(result.html,null,false);assert.equal($.root().children('article').length,2);assert.equal($('[data-migration-record]').length,2);assert.match(result.html,/Summary one/);
});
test('per-card wrapper rows bind as one list while month headings and surrounding controls remain',async()=>{
 const html=`<div class="calendar"><div class="controls">Controls</div><section class="list"><h3>November</h3><div class="row"><div class="date">7</div>${article('one')}</div><h3>December</h3><div class="row"><div class="date">31</div>${article('two')}</div></section></div>`;
 const result=await bind(html),b=result.report.bindings[0];assert.notEqual(b.mode,'native');assert.equal(b.pageSize,2);const $=load(result.html,null,false);assert.equal($('.row[data-migration-record]').length,2);assert.equal($('.list[data-migration-archive]').length,1);assert.match(b.template,/class="date"/);assert.equal($('.list > h3').length,2);assert.equal($('.controls').text(),'Controls');
});
test('equally sized independent grids remain explicitly ambiguous rather than merged',async()=>{
 const result=await bind(`<section>${article('one')}${article('two')}</section><section>${article('one')}${article('two')}</section>`);assert.equal(result.report.bindings[0].mode,'native');
});
test('native root archive rebuild edits titles and creates usable pagination without an extra wrapper',{timeout:60000},async()=>{
 const {extract}=await import('../engine/extract.mjs'),{generate}=await import('../engine/generate.mjs'),{run}=await import('../engine/pipeline.mjs'),{parseContent,YAML}=await import('../scripts/source-project.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'root-archive-export-'));try{
  const source='https://example.test';const make=(route,title,body,classes)=>({...extract(`<html><head><title>${title}</title></head><body class="${classes}"><main><h1>${title}</h1>${body}</main></body></html>`,source+route),styles:[]});
  const pages=[make('/blog/','Blog',article('one')+article('two'),'blog archive'),...['one','two'].map(slug=>make('/'+slug+'/',slug,'<p>Readable article.</p>','single-post'))];
  await generate({source,identity:{title:'Test'},navigation:[],design:{},pages,media:[],warnings:[],metrics:{}},dir);
  const binding=JSON.parse(await readFile(path.join(dir,'archive-bindings.json'))).bindings[0];assert.equal(binding.rootContainer,true);
  const routes=JSON.parse(await readFile(path.join(dir,'routes.json'))),one=routes.find(r=>r.route==='/one/'),file=path.join(dir,'content',one.collection,one.slug+'.md'),content=parseContent(await readFile(file,'utf8'),file);content.meta.title='Updated first';await writeFile(file,'---\n'+YAML.stringify(content.meta)+'---\n'+content.body);
  await writeFile(path.join(dir,'content/posts/third.md'),'---\ntitle: Third\npermalink: /third/\ndate: 2026-01-01\n---\nThird article.');
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:45000});const $=load(await readFile(path.join(dir,'output/blog/index.html'),'utf8'));assert.equal($('main > article').length,2);assert.equal($('main > .migration-pagination').length,1,await readFile(path.join(dir,'output/maintenance-report.json'),'utf8'));assert.equal($('a[rel=next]').attr('href'),'/blog/page/2/');const second=load(await readFile(path.join(dir,'output/blog/page/2/index.html'),'utf8'));assert.equal(second('main > article').length,1);assert.match($.text()+second.text(),/Updated first/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Markdown-only edits update exact full-content archive slots without replacing unmatched summaries',{timeout:60000},async()=>{
 const {extract}=await import('../engine/extract.mjs'),{generate}=await import('../engine/generate.mjs'),{run}=await import('../engine/pipeline.mjs'),{parseContent,YAML}=await import('../scripts/source-project.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'archive-prose-export-'));try{
  const source='https://example.test',make=(route,title,body,cls)=>({...extract(`<html><head><title>${title}</title></head><body class="${cls}"><main><h1>${title}</h1>${body}</main></body></html>`,source+route),styles:[]});
  const card=(slug,body)=>`<article><h2><a href="/${slug}/">${slug}</a></h2><div class="entry-content"><p>${body}</p></div></article>`;
  const pages=[make('/blog/','Blog',card('one','Original authored prose.')+card('two','An intentionally shorter summary.'),'archive'),make('/one/','one','<div class="entry-content"><p>Original authored prose.</p></div>','single-post'),make('/two/','two','<div class="entry-content"><p>Longer original second article content.</p></div>','single-post')];
  await generate({source,identity:{title:'Test'},navigation:[],design:{},pages,media:[],warnings:[],metrics:{}},dir);
  const routes=JSON.parse(await readFile(path.join(dir,'routes.json'))),record=routes.find(r=>r.route==='/one/'),file=path.join(dir,'content',record.collection,record.slug+'.md'),parsed=parseContent(await readFile(file,'utf8'),file);await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body.replace('Original authored prose.','Edited **native** prose.'));
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:45000});const $=load(await readFile(path.join(dir,'output/blog/index.html'),'utf8'));assert.equal($('article').first().find('.entry-content').text(),'Edited native prose.');assert.equal($('article').first().find('.entry-content strong').text(),'native');assert.equal($('article').last().find('.entry-content').text(),'An intentionally shorter summary.');
 }finally{await rm(dir,{recursive:true,force:true});}
});
