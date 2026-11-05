import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from 'cheerio';
import {captureSEO,rewriteSEO,applySEO,seoImageURLs,synchronizeQuestionContent} from '../scripts/seo-export.mjs';
const context={source:'https://source.example/post/',origin:'https://owner.example',base:'/site',routes:[{source:'https://source.example/',route:'/'},{source:'https://source.example/post/',route:'/renamed/'}],assets:[{source:'https://source.example/uploads/logo.png',path:'assets/media/logo.png'}]};
const graph={'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':'https://source.example/#organization',name:'Original business',logo:{'@type':'ImageObject',url:'https://source.example/uploads/logo.png'}},{'@type':'WebPage','@id':'https://source.example/post/#webpage',url:'https://source.example/post/',isPartOf:{'@id':'https://source.example/#organization'},breadcrumb:{'@id':'https://source.example/post/#breadcrumb'}},{'@type':'BreadcrumbList','@id':'https://source.example/post/#breadcrumb',itemListElement:[{'@type':'ListItem',position:1,name:'Home',item:'https://source.example/'}]}]};
for(const plugin of ['yoast-schema-graph','rank-math-schema','aioseo-schema'])test(`${plugin} shares schema preservation and linked-ID rewriting`,()=>{
 const captured=captureSEO(load(`<script type="application/ld+json" class="${plugin}">${JSON.stringify(graph)}</script><meta property="og:title" content="Custom social title"><meta name="twitter:card" content="summary">`));
 const result=rewriteSEO(captured,context),nodes=result.structured[0]['@graph'];
 assert.equal(nodes[0].name,'Original business');assert.equal(nodes[0].logo.url,'https://owner.example/site/assets/media/logo.png');
 assert.equal(nodes[1]['@id'],'https://owner.example/site/renamed/#webpage');assert.equal(nodes[1].isPartOf['@id'],nodes[0]['@id']);
 assert.equal(nodes[2].itemListElement[0].item,'https://owner.example/site/');assert.equal(result.social['og:title'][0],'Custom social title');assert.deepEqual(result.issues,[]);
});
test('invalid JSON is reported and duplicate/conflicting definitions are not emitted twice',()=>{
 const $=load('<script type="application/ld+json">{broken</script>');const source=captureSEO($);assert.equal(source.seo_source_issues[0].kind,'invalid-schema-json');
 const result=rewriteSEO({...source,structured_data:[graph,graph,{'@type':'Organization','@id':'https://source.example/#organization',name:'Conflicting business'}]},context);
 assert.equal(result.structured.length,2);assert.deepEqual(result.structured[1],{'@id':'https://owner.example/site/#organization'});assert.ok(result.issues.some(i=>i.kind==='conflicting-schema-id'));
});
test('source search actions and uncaptured internal destinations are reported without fake local routes',()=>{
 const result=rewriteSEO({structured_data:[{'@type':'WebSite',potentialAction:{'@type':'SearchAction',target:'https://source.example/?s={search_term_string}'},url:'https://source.example/missing/',sameAs:['https://social.example/business']}],social:{'og:image':['https://source.example/missing.jpg']}},context);
 assert.equal(result.structured[0].potentialAction,undefined);assert.equal(result.structured[0].url,undefined);assert.deepEqual(result.structured[0].sameAs,['https://social.example/business']);assert.deepEqual(result.social['og:image'],[]);
 assert.ok(result.issues.some(i=>i.kind==='source-search-action-removed'));assert.equal(result.issues.filter(i=>i.kind==='unmapped-source-url').length,2);
});
test('build uses editable frontmatter schema/social and escapes script closing text',()=>{
 const $=load('<html><head><meta property="og:title" content="Old"><script type="application/ld+json">{"@type":"WebPage","name":"Fabricated"}</script></head><body></body></html>');
 const p={route:'/renamed/',title:'Heading',description:'Description',collection:'posts',date:'2026-10-23',meta:{seo_title:'SEO title',structured_data:[{'@context':'https://schema.org','@type':'Article',headline:'Edited </script><script>alert(1)</script>'}],social:{'og:title':['Edited social title']},author:'Jane'}};
 applySEO($,p,context);assert.equal($('script').length,1);assert.equal($('meta[property="og:title"]').attr('content'),'Edited social title');assert.equal($('meta[name="twitter:title"]').attr('content'),'SEO title');assert.equal($('meta[property="og:url"]').attr('content'),'https://owner.example/site/renamed/');assert.equal($('meta[name="author"]').attr('content'),'Jane');assert.ok(!$('script').text().includes('</script>'));assert.equal(JSON.parse($('script').text()).headline,p.meta.structured_data[0].headline);
});
test('source-free pages retain factual generic schema without a fictional organization',()=>{
 const $=load('<html><head></head><body></body></html>');applySEO($,{route:'/renamed/',title:'Page',description:'Text',meta:{}},context);
 const schema=JSON.parse($('script').text());assert.equal(schema['@type'],'WebPage');assert.equal(schema.name,'Page');assert.equal(schema.publisher,undefined);
});

test('schema and social image discovery deduplicates media without fetching schema contexts or actions',()=>{
 const urls=seoImageURLs({social:{'og:image':['/photo.jpg'],'twitter:image':['/photo.jpg']},structured_data:[{'@context':'https://schema.org','@type':'Organization',logo:{'@type':'ImageObject',url:'/logo.png'},potentialAction:{target:'/submit'},image:['/photo.jpg','https://cdn.example/cover.webp']}]},'https://source.example/');
 assert.deepEqual(urls,['https://source.example/photo.jpg','https://source.example/logo.png','https://cdn.example/cover.webp']);
});

test('asset checkpoint upgrades collect metadata-only images once and reuse saved media',async()=>{
 const {mkdtemp,mkdir,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path');
 const {localize}=await import('../engine/assets.mjs'),{extract}=await import('../engine/extract.mjs');
 const dir=await mkdtemp(join(tmpdir(),'cloner-seo-media-'));
 try{
  await mkdir(join(dir,'project'),{recursive:true});
  const p=extract('<head><meta property="og:image" content="/cover.png"><script type="application/ld+json">{"@type":"Organization","logo":"https://source.example/logo.png"}</script></head><main>Content</main>','https://source.example/');
  p.assetCheckpointVersion=1;
  const model={source:p.url,pages:[p],media:[{source:'https://source.example/cover.png',path:'assets/media/saved.png'}],warnings:[],metrics:{}};
  const requests=[],network={get:async url=>{requests.push(url);return {url,headers:{'content-type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=','base64')};}};
  await localize(model,network,dir);assert.deepEqual(requests,['https://source.example/logo.png']);assert.equal(p.assetCheckpointVersion,2);
  await localize(model,network,dir);assert.equal(requests.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('public ReadAction targets follow relocated routes including EntryPoint templates',()=>{
 const source={structured_data:[{'@type':'WebPage',potentialAction:[{'@type':'ReadAction',target:['https://source.example/post/',{'@type':'EntryPoint',urlTemplate:'https://source.example/post/'}]},{'@type':'ReadAction',target:'https://source.example/missing/'}]}]};const r=rewriteSEO(source,context),actions=r.structured[0].potentialAction;assert.equal(actions[0].target[0],'https://owner.example/site/renamed/');assert.equal(actions[0].target[1].urlTemplate,'https://owner.example/site/renamed/');assert.equal(actions[1].target,undefined);assert.ok(r.issues.some(i=>i.kind==='unmapped-source-url'));
});

test('unchanged captured page schema fields follow authored metadata without overwriting custom graph facts',async()=>{
 const {synchronizePageMetadata}=await import('../scripts/seo-export.mjs');const canonical='https://owner.example/post/',page={meta:{seo_title:'Edited SEO',title:'Edited heading',description:'Edited description'},saved:{metadata:{seo_title:'Original SEO',title:'Original heading',description:'Original description'}}};
 const documents=[{'@graph':[{'@type':'WebPage','@id':canonical+'#webpage',name:'Original SEO',description:'Original description'},{'@type':'Organization','@id':'https://owner.example/#organization',name:'Original SEO'},{'@type':'WebPage',url:'https://owner.example/other/',name:'Original SEO'},{'@type':'BlogPosting',url:canonical,headline:'Manually curated headline'}]}];const result=synchronizePageMetadata(documents,page,canonical)[0]['@graph'];assert.equal(result[0].name,'Edited SEO');assert.equal(result[0].description,'Edited description');assert.equal(result[1].name,'Original SEO');assert.equal(result[2].name,'Original SEO');assert.equal(result[3].headline,'Manually curated headline');assert.equal(documents[0]['@graph'][0].name,'Original SEO');
});

test('captured social defaults follow authored metadata while custom social text remains independent',()=>{
 const $=load('<html><head></head><body></body></html>'),baseline={seo_title:'Original SEO',description:'Original description',social:{'og:title':['Original SEO'],'twitter:title':['Custom card'],'og:description':['Original description']}};
 const page={route:'/renamed/',title:'Heading',description:'Changed description',meta:{...baseline,seo_title:'Changed SEO',description:'Changed description'},saved:{metadata:baseline}};applySEO($,page,context);assert.equal($('meta[property="og:title"]').attr('content'),'Changed SEO');assert.equal($('meta[property="og:description"]').attr('content'),'Changed description');assert.equal($('meta[name="twitter:title"]').attr('content'),'Custom card');
});

test('article edits synchronize exact captured facts on the current route only',async()=>{
 const {synchronizePageMetadata}=await import('../scripts/seo-export.mjs');
 const baseline={title:'Original',description:'Before',date:'2026-01-01',last_updated:'2026-02-01'};
 const page={saved:{metadata:baseline},meta:{title:'Edited',description:'After',date:'2026-03-01',last_updated:'2026-04-01'}};
 const article={'@type':['Article','BlogPosting'],'@id':'https://owner.example/post/#article',headline:'Original',description:'Before',datePublished:'2026-01-01',dateModified:'2026-02-01'};
 const [changed,independent]=synchronizePageMetadata([article,{...article,'@id':'https://owner.example/other/#article'}],page,'https://owner.example/post/');
 assert.equal(changed.headline,'Edited');assert.equal(changed.description,'After');assert.equal(changed.datePublished,'2026-03-01');assert.equal(changed.dateModified,'2026-04-01');assert.equal(independent.headline,'Original');
 assert.deepEqual(synchronizePageMetadata([article],{meta:page.meta},'https://owner.example/post/'),[article]);
});

test('article schema supports captured SEO title defaults and independent custom titles',async()=>{
 const {synchronizePageMetadata}=await import('../scripts/seo-export.mjs');const canonical='https://owner.example/post/';
 const page={saved:{metadata:{title:'Heading',seo_title:'Search title'}},meta:{title:'Edited heading',seo_title:'Edited search title'}};
 const docs=[{'@type':'BlogPosting',url:canonical,headline:'Search title',name:'Search title'},{'@type':'Article',url:canonical,headline:'Custom headline',name:'Custom name'}];
 const result=synchronizePageMetadata(docs,page,canonical);assert.equal(result[0].headline,'Edited search title');assert.equal(result[0].name,'Edited search title');assert.equal(result[1].headline,'Custom headline');assert.equal(result[1].name,'Custom name');
});

test('source service actions are reported and removed instead of pointing to WordPress',()=>{
 const meta={structured_data:[{'@type':'Article',potentialAction:[{'@type':'CommentAction',target:['https://source.example/post/#respond']},{'@type':'BuyAction',target:{'@type':'EntryPoint',urlTemplate:'/checkout?product={id}'}},{target:{url:'/submit'}},{'@type':'ReserveAction',target:'https://booking.example/reserve'},{'@type':'ReadAction',target:'https://source.example/post/'}]}]};
 const result=rewriteSEO(meta,context),actions=result.structured[0].potentialAction;
 assert.equal(actions.length,2);assert.equal(actions[0].target,'https://booking.example/reserve');assert.equal(actions[1].target,'https://owner.example/site/renamed/');assert.equal(result.issues.filter(i=>i.kind==='source-service-action-removed').length,3);assert.ok(!JSON.stringify(result.structured).includes('source.example'));
 assert.equal(meta.structured_data[0].potentialAction.length,5,'source evidence stays unchanged');
});

 test('annotated author references do not discard later typed identity definitions',()=>{
 const id='https://source.example/#person';
 const person={'@type':['Person','Organization'],'@id':id,name:'Fixture author',description:'Full identity'};
 const article={'@type':'Article','@id':'https://source.example/post/#article',author:{'@id':id,name:'Fixture author'},publisher:{'@id':id}};
 const input={'@graph':[article,person]};
 const result=rewriteSEO({structured_data:[input]},context);
 const nodes=result.structured[0]['@graph'];
 assert.deepEqual(nodes[1]['@type'],['Person','Organization']);assert.equal(nodes[1].description,'Full identity');
 assert.equal(nodes[0].author['@id'],nodes[1]['@id']);assert.equal(nodes[0].author.name,'Fixture author');
 assert.ok(!result.issues.some(i=>i.kind==='conflicting-schema-id'));
 const reversed=rewriteSEO({structured_data:[{'@graph':[person,article]}]},context);
 assert.equal(reversed.structured[0]['@graph'][1].author.name,'Fixture author');
 assert.deepEqual(input['@graph'][1],person,'source graph remains unchanged');
 });

test('compatible typed identity fragments retain later facts without duplicating definitions',()=>{
 const id='https://source.example/#person';
 const partial={'@type':'Person','@id':id,name:'Fixture author'};
 const full={...partial,description:'Full biography',sameAs:['https://social.example/fixture']};
 for(const definitions of [[partial,full],[full,partial]]){
  const result=rewriteSEO({structured_data:definitions},context);
  assert.equal(result.structured[0].description,'Full biography');
  assert.deepEqual(result.structured[0].sameAs,['https://social.example/fixture']);
  assert.deepEqual(result.structured[1],{'@id':'https://owner.example/site/#person'});
  assert.ok(!result.issues.some(i=>i.kind==='conflicting-schema-id'));
 }
 const conflict=rewriteSEO({structured_data:[partial,{...full,name:'Different author'}]},context);
 assert.equal(conflict.structured[0].name,'Fixture author');assert.equal(conflict.structured[0].description,undefined,'Do not merge facts from a conflicting identity');
 assert.ok(conflict.issues.some(i=>i.kind==='conflicting-schema-id'));
 assert.equal(partial.description,undefined);
});

test('FAQ schema follows proven visible content but preserves explicit overrides and ambiguous anchors',()=>{
 const question={'@type':'Question',url:'https://source.example/post/#question',name:'Original question',acceptedAnswer:{'@type':'Answer',text:'Original answer'}};
 const dom=load('<main><section id="question"><h3>Original question</h3><div><p>Original answer</p></div></section></main><script type="application/ld+json">'+JSON.stringify({'@type':'FAQPage',mainEntity:[question]})+'</script>');
 const meta=captureSEO(dom);assert.equal(meta.seo_content_bindings.length,1);
 dom('h3').text('Edited question');dom('section div').text('An answer with <literal> text');
 const documents=rewriteSEO(meta,context).structured;const canonical='https://owner.example/site/renamed/';
 const changed=synchronizeQuestionContent(documents,{meta},dom,canonical)[0].mainEntity[0];
 assert.equal(changed.name,'Edited question');assert.equal(changed.acceptedAnswer.text,'An answer with <literal> text');
 documents[0].mainEntity[0].acceptedAnswer.text='Explicit schema answer';
 assert.equal(synchronizeQuestionContent(documents,{meta},dom,canonical)[0].mainEntity[0].acceptedAnswer.text,'Explicit schema answer');
 dom('main').append('<section id="question"><h3>Other question</h3></section>');
 assert.equal(synchronizeQuestionContent(documents,{meta},dom,canonical)[0].mainEntity[0].name,'Original question');
 assert.equal(synchronizeQuestionContent(documents,{meta},dom,'https://owner.example/site/other/')[0].mainEntity[0].name,'Original question');
});

test('rich FAQ authoring keeps paragraph, list and line-break word boundaries in schema',()=>{
 const original='<p>Read the <a href="/guide/">guide</a>.</p><p>Then contact us.</p>';
 const question={'@type':'Question',url:'https://source.example/post/#rich',name:'What next?',acceptedAnswer:{'@type':'Answer',text:original}};
 const dom=load('<main><section id="rich"><h3>What next?</h3><div>'+original+'</div></section></main><script type="application/ld+json">'+JSON.stringify({'@type':'FAQPage',mainEntity:[question]})+'</script>');
 const meta=captureSEO(dom);assert.ok(meta.seo_content_bindings[0].answer);
 dom('section div').html('<p>Read the <strong>new</strong> guide.</p><ul><li>Call us.</li><li>Email us.</li></ul><p>Office hours:<br>Weekdays.</p>');
 const docs=rewriteSEO(meta,context).structured;
 const result=synchronizeQuestionContent(docs,{meta},dom,'https://owner.example/site/renamed/');
 assert.equal(result[0].mainEntity[0].acceptedAnswer.text,'Read the new guide. Call us. Email us. Office hours: Weekdays.');
 assert.equal(docs[0].mainEntity[0].acceptedAnswer.text,original,'Captured graph remains unchanged');
});

test('HowTo step bindings follow direct text and multiple directions without overwriting schema edits',()=>{
 const step={'@type':'HowToStep',url:'https://source.example/post/#step',name:'Prepare',itemListElement:[{'@type':'HowToDirection',text:'Gather facts.'},{'@type':'HowToDirection',text:'Review facts.'}]};
 const direct={'@type':'HowToStep',url:'https://source.example/post/#direct',text:'Send the note.'};
 const dom=load('<main><section id="step"><h3>Prepare</h3><p>Gather facts.</p><p>Review facts.</p></section><section id="direct"><p>Send the note.</p></section></main><script type="application/ld+json">'+JSON.stringify({'@type':'HowTo',step:[step,direct]})+'</script>');
 const meta=captureSEO(dom);assert.equal(meta.seo_content_bindings.length,2);
 dom('h3').text('Verify');dom('#step p').first().text('Gather sources.');dom('#step p').last().text('Review sources.');dom('#direct p').text('Publish the note.');
 const docs=rewriteSEO(meta,context).structured,canonical='https://owner.example/site/renamed/';
 const result=synchronizeQuestionContent(docs,{meta},dom,canonical)[0].step;
 assert.equal(result[0].name,'Verify');assert.deepEqual(result[0].itemListElement.map(d=>d.text),['Gather sources.','Review sources.']);assert.equal(result[1].text,'Publish the note.');
 docs[0].step[0].itemListElement[0].text='Explicit authored direction';
 assert.equal(synchronizeQuestionContent(docs,{meta},dom,canonical)[0].step[0].itemListElement[0].text,'Explicit authored direction');
 dom('#step').remove();assert.equal(synchronizeQuestionContent(docs,{meta},dom,canonical)[0].step[0].name,'Prepare','Missing anchors must not guess a new target');
 assert.equal(step.name,'Prepare');
});
