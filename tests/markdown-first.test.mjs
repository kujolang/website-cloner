import {load} from 'cheerio/slim';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import YAML from 'yaml';
import {generate} from '../engine/generate.mjs';import {extract} from '../engine/extract.mjs';import {run} from '../engine/pipeline.mjs';import {parseContent} from '../scripts/source-project.mjs';
function model(){const source='https://markdown.example/';const pages=[1,2].map(n=>({...extract(`<html><head><title>Story ${n}</title></head><body class="single-post"><header>Site</header><main><article id="post-${n}"><h1>Story ${n}</h1><div class="entry-content"><p class="lead">Paragraph ${n} with <strong>meaning</strong>.</p><h2 id="details">Details</h2><ul><li>First</li><li>Second</li></ul></div><aside>Author ${n}</aside></article></main><footer>Footer</footer></body></html>`,source+'story-'+n+'/'),styles:[]}));return {source,identity:{title:'Site'},navigation:[],pages,media:[],warnings:[],metrics:{},design:{text:'#111',background:'#fff',accent:'#222',contentWidth:1000,spacing:24,navigation:'source'}};}
test('emphasis, escaped brackets and inline code survive native Markdown conversion',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-literals-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Release</title></head><body class="single-post"><main><div class="entry-content"><h2><em><a href="https://example.org/">Kim Parsell</a></em></h2><h3>[5.0.59]</h3><p>Use <code>load_textdomain()</code> and <em>not</em> this.</p><p><span class="review-author"><a href="https://example.org/author">Reviewer</a></span> <span class="star">*</span> <span class="star">*</span></p></div></main></body></html>',m.source),styles:[]}];
  await generate(m,dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
  const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('h2 em a').text(),'Kim Parsell');assert.equal($('h3').text(),'[5.0.59]');assert.equal($('code').text(),'load_textdomain()');assert.equal($('p em').text(),'not');assert.equal($('.review-author a').text(),'Reviewer');assert.equal($('.star').text(),'**');assert.ok(!$('.review-author').text().includes('<a'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Markdown is the sole canonical content, shared layouts bind frontmatter, and native SSG receives real prose',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-first-'));try{
  const m=model();await generate(m,dir);const routes=JSON.parse(await readFile(path.join(dir,'routes.json'))),first=routes[0],second=routes[1];
  const file='content/'+first.collection+'/'+first.slug+'.md',other='content/'+second.collection+'/'+second.slug+'.md';
  let a=parseContent(await readFile(path.join(dir,file),'utf8'),file),b=parseContent(await readFile(path.join(dir,other),'utf8'),other);
  assert.equal(a.meta.content_template,b.meta.content_template);assert.match(a.body,/Paragraph 1 with \*\*meaning\*\*/);assert.ok(!a.body.includes('<'));
  await assert.rejects(readFile(path.join(dir,file.replace('.md','.html'))));await assert.rejects(readFile(path.join(dir,file.replace('.md','.json'))));
  a.meta.title='New title';a.body=a.body.replace('Paragraph 1','Edited paragraph');await writeFile(path.join(dir,file),'---\n'+YAML.stringify(a.meta)+'---\n\n'+a.body);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
  const html=await readFile(path.join(dir,'output/story-1/index.html'),'utf8');assert.match(html,/<h1\b[^>]*>New title<\/h1>/);assert.match(html,/<p class="lead">Edited paragraph/);assert.match(html,/<h2\b[^>]*id="details"[^>]*>Details<\/h2>/);assert.ok(!html.includes('MIGRATION_SLOT_'));
  assert.match(await readFile(path.join(dir,'.ssg-content/'+first.collection+'/'+first.slug+'.md'),'utf8'),/Edited paragraph/);
  const templates=await readdir(path.join(dir,'.ssg-templates'));assert.ok(!templates.includes('post-'+first.slug+'.html'));assert.ok(!templates.includes('page-'+first.slug+'.html'));
  const report=JSON.parse(await readFile(path.join(dir,'content-source-report.json')));assert.equal(report.htmlSnapshotFallback,false);assert.equal(report.sharedContentTemplates,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('complex layouts keep prose in Markdown, rich components explicit, and missing sections fail instead of dropping content',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-components-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Complex</title></head><body><main><div class="columns"><section style="width:50%"><h2>First area</h2><p>First text</p></section><section><h2>Second area</h2><p>Second text</p><table><tr><th>Plan</th><th>Cost</th></tr><tr><td>Pro</td><td>10</td></tr></table></section></div></main></body></html>',m.source),styles:[]}];await generate(m,dir);
  const file=path.join(dir,'content/pages/home.md'),{meta,body}=parseContent(await readFile(file,'utf8'),file);assert.match(body,/<!-- content-slot:first-area -->/);assert.match(body,/<!-- content-slot:second-area -->/);assert.match(body,/First text/);assert.match(body,/Second text/);assert.ok(!body.includes('<table'));assert.ok(!meta.components);assert.ok(!meta.layout_values);const data=JSON.parse(await readFile(path.join(dir,meta.layout_data)));assert.equal(Object.keys(data.components).length,1);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const html=await readFile(path.join(dir,'output/index.html'),'utf8');assert.match(html,/class="columns"/);assert.match(html,/<table>/);assert.match(html,/First text/);assert.match(html,/Second text/);
  const legacy=body.replace(/<!-- content-slot:([a-z0-9-]+) -->/g,(_,name)=>'<!-- content-slot:'+data.content_slots.find(slot=>slot.name===name).key+' -->');
  await writeFile(file,'---\n'+YAML.stringify(meta)+'---\n\n'+legacy);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
  assert.equal(await readFile(path.join(dir,'output/index.html'),'utf8'),html,'legacy slot aliases retain the same output');
  await writeFile(file,'---\n'+YAML.stringify(meta)+'---\n\n'+body.replace(/<!-- content-slot:[a-z0-9-]+ -->/,''));
  await assert.rejects(run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000}),/content slot/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('inline emphasis, actions and prose preserve their DOM boundaries without paragraph wrappers',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-inline-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Inline</title></head><body><main><article><div class="entry-content"><div class="ns-buttons"><a href="https://example.com/share">Share</a></div><h1><mark class="gradient">A better way</mark> to care.</h1><div class="actions"><a class="button" href="https://example.com/contact/">Contact us</a></div><p>First paragraph.</p><p>Second paragraph.</p><p><strong><strong>Nested emphasis.</strong></strong></p><hr class="divider"><p><strong>Drew Barton<br></strong>Founder &amp; CEO</p><p>Last paragraph. <a href="https://example.com/help" title="Help guide">Help</a><img src="/assets/empty.png" title="Chart" alt="Chart"></p></div></article></main></body></html>',m.source),styles:[]}];await generate(m,dir);
  const file=path.join(dir,'content/pages/home.md'),{body}=parseContent(await readFile(file,'utf8'),file);assert.ok(!body.includes('Share'));assert.match(body,/First paragraph\.\n\nSecond paragraph\./);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const html=await readFile(path.join(dir,'output/index.html'),'utf8');assert.match(html,/<mark class="gradient">A better way<\/mark> to care\./);const $=load(html,null,false);assert.equal($('.actions > a.button').text(),'Contact us');assert.equal($('.actions > a.button').attr('href'),'https://example.com/contact/');assert.equal($('.actions > p').length,0);assert.match(html,/<strong><strong>Nested emphasis\.<\/strong><\/strong>/);assert.match(html,/<hr class="divider">/);assert.ok(!html.includes('<mark class="gradient"><p>'));assert.equal($('a[title="Help guide"]').attr('href'),'https://example.com/help');assert.equal($('img[title="Chart"]').attr('src'),'/assets/empty.png');assert.match(html,/<strong>Drew Barton<br><\/strong>Founder &amp; CEO/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('optional attributes and inactive links share layouts without splitting prose',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-family-'));try{
  const m=model();m.pages=[1,2].map(n=>({...extract(`<html><head><title>Story ${n}</title></head><body class="single-post"><main><article ${n===1?'id="post-1"':''}><h1>Story ${n}</h1><div class="entry-content"><p ${n===1?'class="lead"':''}>One paragraph with <a ${n===1?'href="https://outside.example/"':'aria-disabled="true" data-migration-unavailable="/uncaptured/"'}>a link</a> and its ending.</p></div></article></main></body></html>`,m.source+'story-'+n+'/'),styles:[]}));
  await generate(m,dir);const report=JSON.parse(await readFile(path.join(dir,'content-source-report.json')));assert.equal(report.sharedContentTemplates,1);assert.equal(report.pagesUsingSharedTemplates,2);
  const files=await readdir(path.join(dir,'content/posts'));
  for(const name of files.filter(n=>n.endsWith('.md'))){const content=parseContent(await readFile(path.join(dir,'content/posts',name),'utf8'),name);assert.ok(!content.body.includes('content-slot:'));assert.match(content.body,/One paragraph with \[a link\]/);}
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
  const one=load(await readFile(path.join(dir,'output/story-1/index.html'),'utf8')),two=load(await readFile(path.join(dir,'output/story-2/index.html'),'utf8'));
  assert.equal(one('article').attr('id'),'post-1');assert.equal(two('article').attr('id'),undefined);assert.equal(two('.entry-content a').attr('href'),undefined);assert.equal(two('.entry-content a').attr('aria-disabled'),'true');assert.equal(two('.entry-content p').text(),'One paragraph with a link and its ending.');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('article figures and rich blocks remain one editable Markdown flow',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-flow-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Story</title></head><body class="single-post"><main><article><h1>Story</h1><div class="entry-content"><p>Before <span class="accent">image</span>.</p><figure class="wp-block-image"><a href="https://outside.example/photo"><img src="/assets/photo.webp" width="400" alt="  Photo&#10; with whitespace  "></a></figure><p>After image.</p><table><tr><td>Cell</td></tr></table><p>After table.</p></div></article></main></body></html>',m.source),styles:[]}];await generate(m,dir);
  const file=path.join(dir,'content/posts/home.md'),{body}=parseContent(await readFile(file,'utf8'),file);assert.ok(!body.includes('content-slot:'));assert.match(body,/!\[Photo with whitespace\]/);assert.match(body,/\{\{component:component1\}\}/);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('figure.wp-block-image > a > img').attr('width'),'400');assert.equal($('figure.wp-block-image > a > img').attr('alt'),'Photo with whitespace');assert.equal($('span.accent').text(),'image');assert.equal($('table td').text(),'Cell');assert.equal($('figure p, p table').length,0);assert.ok(!$.html().includes('{{component:'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('ordered and nested list structure remains editable without native flattening',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-lists-'));try{
  const m=model();m.pages=[{...extract('<html><body><main><blockquote><p>Quote introduction</p><ul><li>Quoted requirement</li></ul><p>Quote ending</p></blockquote><ol start="3"><li><strong>First item</strong><ul><li>Nested one</li><li>Nested two</li></ul></li><li>Second item</li></ol></main></body></html>',m.source),styles:[]}];await generate(m,dir);
  const route=JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8'))[0],file='content/'+route.collection+'/'+route.slug+'.md';const text=await readFile(path.join(dir,file),'utf8');assert.match(text,/\*\*First item\*\*/);assert.match(text,/Nested one/);assert.doesNotMatch(text,/<(?:ol|ul|li)/);
  await writeFile(path.join(dir,file),text.replaceAll('Nested one','Edited nested item'));
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('blockquote').length,1);assert.equal($('blockquote > ul > li').text(),'Quoted requirement');assert.equal($('blockquote > p').length,2);assert.equal($('ol').attr('start'),'3');assert.equal($('ol > li').length,2);assert.equal($('ol > li > ul > li').length,2);assert.equal($('ol > li > ul > li').first().text(),'Edited nested item');assert.equal($('ol > li > strong').text(),'First item');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('responsive line breaks retain source word separators without adding spaces to tight breaks',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-responsive-br-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Hero</title></head><body><main><h1>Helping Businesses <br><mark>Grow &amp; Compete</mark> with <br>the Big Guys</h1><p>email <br>subscribers</p><p>One<br>Two</p><p>Third<br> fourth</p></main></body></html>',m.source),styles:[]}];
  await generate(m,dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
  const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));$('br').remove();
  assert.equal($('h1').text(),'Helping Businesses Grow & Compete with the Big Guys');
  assert.deepEqual($('main p').map((_,el)=>$(el).text()).get(),['email subscribers','OneTwo','Third fourth']);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('source spacers and CSS-only ornaments stay in layouts rather than disappearing from Markdown',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-spacers-'));try{
 const m=model();m.pages=[{...extract('<html><head><title>Spacers</title></head><body><main><div class="entry-content"><p>First paragraph</p><p>&nbsp;</p><p>Second paragraph <span class="ornament"></span> ending.</p><p class="empty"></p></div></main></body></html>',m.source),styles:[]}];
 await generate(m,dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
 const html=await readFile(path.join(dir,'output/index.html'),'utf8'),$=load(html);assert.equal($('.entry-content > p').length,4);assert.equal($('.entry-content > p').eq(1).text(),'\u00a0');assert.equal($('.ornament').length,1);assert.equal($('.empty').length,1);
 const body=parseContent(await readFile(path.join(dir,'content/pages/home.md'),'utf8'),'home').body;assert.match(body,/First paragraph/);assert.match(body,/Second paragraph/);assert.doesNotMatch(body,/class="(?:empty|ornament)"/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('an empty popup main cannot steal the real role-main prose',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'role-main-'));try{
 const m=model();m.pages=[{...extract('<html><head><title>Contractor</title></head><body id="root-theme" data-page-alias="home"><main id="popup"><div></div></main><div role="main" id="real"><div class="builder-text"><h1>Concrete</h1><p>Our team builds durable driveways.</p></div></div></body></html>',m.source),styles:[]}];
 assert.equal(m.pages[0].mainId,'real');delete m.pages[0].sourceHTML;await generate(m,dir);const file=path.join(dir,'content/pages/home.md');const parsed=parseContent(await readFile(file,'utf8'),file);assert.match(parsed.body,/Our team builds durable driveways/);
 await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000});const rendered=await readFile(path.join(dir,'output/index.html'),'utf8');assert.match(rendered,/<body[^>]*id="root-theme"/);assert.match(rendered,/data-page-alias="home"/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('redundant spans disappear from Markdown without moving neighbouring presentation',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'lean-spans-'));try{
 const m=model();m.pages=[{...extract('<html><head><title>Readable</title></head><body><main><p><span><span>Plain prose</span></span> and <span style="color:#123456">styled prose</span>.</p></main></body></html>',m.source),styles:[]}];await generate(m,dir);
 const file=path.join(dir,'content/pages/home.md'),body=parseContent(await readFile(file,'utf8'),file).body;assert.match(body,/Plain prose and/);assert.doesNotMatch(body,/<span>/);
 await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('p span').length,1);assert.equal($('p span').text(),'styled prose');assert.match($('p span').attr('style'),/#123456/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('responsive summary hooks survive the full native Markdown and shared-template build',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-summary-'));try{const m=model();m.pages=[{...extract('<html><head><title>Summary</title></head><body><main><span width="0"><span>Editable first line<br>Editable second line</span><span style="position:fixed;visibility:hidden;top:0;left:0">... <a href="/details">Read</a></span></span></main></body></html>',m.source),styles:[]}];await generate(m,dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('[data-migration-truncate-lines="2"] > [data-migration-truncate-content="true"]').length,1);assert.equal($('[data-migration-truncate-suffix="true"] a').text(),'Read');assert.match($('[data-migration-truncate-content]').text(),/Editable first line/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('mixed icon lists retain one structural list and editable telephone destinations',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-icon-list-'));try{const m=model();m.pages=[{...extract('<html><head><title>Contact</title></head><body><main><ul class="inline-contact"><li><svg viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg><span>Company</span></li><li><a href="mailto:hello@example.test">Email</a></li><li><a href="tel:+123456789">Call us</a></li></ul><p>Ordinary editable prose.</p></main></body></html>',m.source),styles:[]}];await generate(m,dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('ul.inline-contact > li').length,3);assert.equal($('ul ul').length,0);assert.equal($('a').last().attr('href'),'tel:+123456789');const file=path.join(dir,'content/pages/home.md');let md=await readFile(file,'utf8');assert.match(md,/Ordinary editable prose/);md=md.replace('tel:+123456789','tel:+198765432');await writeFile(file,md);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});assert.equal(load(await readFile(path.join(dir,'output/index.html'),'utf8'))('a').last().attr('href'),'tel:+198765432');}finally{await rm(dir,{recursive:true,force:true});}
});

test('FAQ text uses Markdown and shared layouts while plain primary headings bind frontmatter',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-faq-'));try{
 const m=model();m.pages=[1,2].map(n=>({...extract(`<html><head><title>Search title ${n}</title></head><body><main><h1>Page ${n}</h1><section class="faq"><details class="question"><summary><span class="question-label">Question ${n}?</span></summary><div class="answer"><p>Answer ${n} with <strong>emphasis</strong>.</p></div></details></section></main></body></html>`,m.source+'faq-'+n+'/'),styles:[]}));await generate(m,dir);
 const file=path.join(dir,'content/pages/faq-1.md');let {meta,body}=parseContent(await readFile(file,'utf8'),file);assert.equal(meta.title,'Page 1');assert.equal(meta.seo_title,'Search title 1');assert.match(body,/Question 1\?/);assert.match(body,/Answer 1 with \*\*emphasis\*\*/);assert.doesNotMatch(body,/<details|<summary|<div|<span/);
 const report=JSON.parse(await readFile(path.join(dir,'content-source-report.json')));assert.equal(report.components,0);assert.equal(report.sharedContentTemplates,1);
 meta.title='Edited page';body=body.replace('Question 1?','Edited question?').replace('Answer 1','Edited answer');await writeFile(file,'---\n'+YAML.stringify(meta)+'---\n\n'+body);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
 const $=load(await readFile(path.join(dir,'output/faq-1/index.html'),'utf8'));assert.equal($('h1').text(),'Edited page');assert.equal($('title').text(),'Search title 1');assert.equal($('details.question > summary > span').text(),'Edited question?');assert.equal($('.answer > p').text(),'Edited answer with emphasis.');assert.equal($('.answer strong').text(),'emphasis');
 }finally{await rm(dir,{recursive:true,force:true});}
});


test('standalone inline wrappers beside prose retain their boundary after authoring',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-inline-boundary-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Guide</title></head><body><main><h1>Guide</h1><div class="entry-content"><span><span><a href="https://example.org/">Home</a></span> » <span aria-current="page">Guide</span></span><h2>Details</h2><p>Editable prose.</p></div></main></body></html>',m.source),styles:[]}];
  await generate(m,dir);const file=path.join(dir,'content/pages/home.md');const parsed=parseContent(await readFile(file,'utf8'),file);assert.match(parsed.body,/Editable prose/);await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body.replace('Editable prose.','Revised prose.'));
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('.entry-content > span').length,1);assert.equal($('.entry-content > p').length,1);assert.equal($('.entry-content > p').text(),'Revised prose.');assert.equal($('.entry-content > span a').text(),'Home');assert.equal($('.entry-content > span p').length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('interactive list labels stay editable without inserting layout whitespace',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'control-list-'));
 try{
  const m=model();m.pages=[{...extract('<html><head><title>Gallery</title></head><body><main><h1>Gallery</h1><ul class="filters"><li data-filter="*">All</li><li data-filter=".wood">Wood</li></ul><p>Body copy.</p></main></body></html>',m.source),styles:[]}];
  await generate(m,dir);const route=JSON.parse(await readFile(path.join(dir,'routes.json')))[0],file=path.join(dir,'content',route.collection,route.slug+'.md');let text=await readFile(file,'utf8');assert.doesNotMatch(text,/- +All/);text=text.replace(/\nWood\n/,'\nTimber\n');await writeFile(file,text);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('.filters > li').last().text(),'Timber');assert.equal($('.filters')[0].children.filter(n=>n.type==='text').length,0);assert.equal($('.filters > li').last().attr('data-filter'),'.wood');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('plain control label spans remain shared structure while their text stays editable',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'control-label-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Gallery</title></head><body><main><h1>Gallery</h1><button class="filter"><span>All items</span><i class="chevron"></i></button></main></body></html>',m.source),styles:[]}];await generate(m,dir);
  const route=JSON.parse(await readFile(path.join(dir,'routes.json')))[0],file=path.join(dir,'content',route.collection,route.slug+'.md');let text=await readFile(file,'utf8');assert.ok(text.includes('All items'));await writeFile(file,text.replace('All items','All products'));
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('.filter > span').text(),'All products');assert.equal($('.filter > i.chevron').length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('mixed standalone emphasis and paragraphs retain source flow without splitting adjacent paragraphs',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-mixed-flow-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Questions</title></head><body><main><section id="question"><strong class="question">A question?</strong><p class="answer">An answer.</p></section><section id="prose"><p>First paragraph.</p>\n<p>Second paragraph.</p></section></main></body></html>',m.source),styles:[]}];
  await generate(m,dir);const file=path.join(dir,'content/pages/home.md');let md=await readFile(file,'utf8');assert.match(md,/\*\*A question\?\*\*/);const parsed=parseContent(md,file);parsed.body=parsed.body.replace('A question?','Edited question?').replace('An answer.','Edited answer.');await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));
  assert.deepEqual($('#question').children().map((_,node)=>node.name).get(),['strong','p']);assert.equal($('#question > strong').text(),'Edited question?');assert.equal($('#question > p').text(),'Edited answer.');
  assert.equal($('#prose > p').length,2);const report=JSON.parse(await readFile(path.join(dir,'content-source-report.json')));assert.equal(report.records[0].slots,3,'Adjacent paragraphs share one Markdown slot');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('linked card figures preserve anchor boundaries without leaking Markdown syntax',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-card-figures-'));try{
  const m=model();m.pages=[{...extract('<html><body><main><div class="cards"><a class="card" aria-disabled="true" data-migration-unavailable="/outside-sample/"><figure class="thumbnail"><img src="/assets/card.webp" alt="Card image"></figure></a><a class="live-card" href="https://outside.example/card"><figure><img src="/assets/second.webp" alt="Second image"></figure></a><p>Editable description.</p></div></main></body></html>',m.source),styles:[]}];
  await generate(m,dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
  const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));
  assert.equal($('.card > figure.thumbnail > img').attr('alt'),'Card image');
  assert.equal($('.card').attr('href'),undefined);assert.equal($('.card').attr('aria-disabled'),'true');
  assert.equal($('.live-card > figure > img').attr('alt'),'Second image');assert.equal($('.live-card').attr('href'),'https://outside.example/card');
  assert.equal($('.card,.live-card').text(),'');assert.equal($('.cards > p').text(),'Editable description.');assert.doesNotMatch($('.cards').text(),/migration-inert-link|\]\(/);
  const file=path.join(dir,'content/pages/home.md'),content=parseContent(await readFile(file,'utf8'),file);assert.match(content.body,/!\[Card image\]/);assert.match(content.body,/Editable description/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('standalone semantic menus stay in reusable presentation while page prose stays Markdown',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-menu-boundary-'));try{
  const m=model();m.pages=[1,2].map(n=>({...extract(`<html><head><title>Page ${n}</title></head><body><main><div role="menubar" class="site-actions"><button role="menuitem">Shared actions</button></div><div role="menu" aria-label="Products" class="popup"><h2>Shared catalog links</h2><ul><li><a role="menuitem" href="/story-2/">Catalog destination</a></li></ul></div><section><h1>Page ${n}</h1><p>Visible page copy ${n} with <strong>editable prose</strong>.</p></section></main></body></html>`,m.source+'story-'+n+'/'),styles:[]}));
  await generate(m,dir);const routes=JSON.parse(await readFile(path.join(dir,'routes.json')));const record=routes.find(r=>r.route==='/story-1/')||routes[0],file=path.join(dir,'content',record.collection,record.slug+'.md');const content=parseContent(await readFile(file,'utf8'),file);
  assert.doesNotMatch(content.body,/Shared catalog links|Catalog destination|Shared actions/);assert.match(content.body,/Visible page copy 1 with \*\*editable prose\*\*/);
  await writeFile(file,'---\n'+YAML.stringify(content.meta)+'---\n\n'+content.body.replace('Visible page copy 1','Edited page copy')+'\n');
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});
  for(const n of [1,2]){const $=load(await readFile(path.join(dir,'output/story-'+n+'/index.html'),'utf8'));assert.equal($('[role=menu] h2').text(),'Shared catalog links');assert.equal($('[role=menu] a').text(),'Catalog destination');assert.equal($('[role=menubar] button').text(),'Shared actions');assert.match($('section p').text(),n===1?/Edited page copy/:/Visible page copy 2/);}
  const report=JSON.parse(await readFile(path.join(dir,'content-source-report.json')));assert.equal(report.sharedContentTemplates,1);assert.equal(report.pagesUsingSharedTemplates,2);const roundtrip=JSON.parse(await readFile(path.join(dir,'template-roundtrip-report.json')));assert.equal(roundtrip.status,'passed');
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('menu-only interfaces preserve long help text without pretending it is missing article prose',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-menu-only-'));try{const m=model(),help='Choose a destination from the menu. '.repeat(5);m.pages=[{...extract('<html><head><title>Choose</title></head><body><main><div role="menu" aria-label="Choose"><p>'+help+'</p><button role="menuitem">Open</button></div></main></body></html>',m.source),styles:[]}];await generate(m,dir);const report=JSON.parse(await readFile(path.join(dir,'content-source-report.json')));assert.equal(report.htmlSnapshotFallback,false);assert.equal(report.records[0].mode,'components-only');const file=path.join(dir,report.records[0].file);const content=parseContent(await readFile(file,'utf8'),file);assert.doesNotMatch(content.body,/Choose a destination/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('styled inline spans in adjacent paragraphs remain one editable prose flow',{timeout:90000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'md-styled-prose-'));try{
  const m=model();m.pages=[{...extract('<html><head><title>Story</title></head><body class="single-post"><main><article><h1>Story</h1><div class="entry-content"><p class="lead"><span class="tone" lang="en">First <strong>important</strong> paragraph.</span></p><p><span style="color: navy">Second paragraph with <a href="https://example.org/">a link</a>.</span></p></div></article></main></body></html>',m.source),styles:[]}];
  await generate(m,dir);const report=JSON.parse(await readFile(path.join(dir,'content-source-report.json')));assert.equal(report.records[0].slots,1);
  const file=path.join(dir,report.records[0].file);const parsed=parseContent(await readFile(file,'utf8'),file);assert.doesNotMatch(parsed.body,/content-slot:/);assert.match(parsed.body,/\*\*important\*\*/);
  await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body.replace('important','updated'));
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:70000,maxBuffer:1e6});const $=load(await readFile(path.join(dir,'output/index.html'),'utf8'));assert.equal($('.entry-content > p').length,2);assert.equal($('p.lead > span.tone').attr('lang'),'en');assert.equal($('p.lead > span.tone > strong').text(),'updated');assert.match($('.entry-content > p:nth-child(2) > span').attr('style'),/^color:\s*navy;?$/);assert.equal($('.entry-content a').attr('href'),'https://example.org/');assert.equal($('span > p').length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
