import test from 'node:test';import assert from 'node:assert/strict';import{load}from'cheerio';import{mkdtemp,readFile,writeFile,rm}from'node:fs/promises';import{tmpdir}from'node:os';import path from'node:path';import YAML from'yaml';
import{publicCustomFields,publicFieldSchema,bindCustomFieldText,bindCustomFieldLinks}from'../engine/custom-fields.mjs';import{recordWordpress,discoverCustomFieldSchema}from'../engine/wordpress.mjs';import{extract}from'../engine/extract.mjs';import{generate}from'../engine/generate.mjs';import{run}from'../engine/pipeline.mjs';import{renderBindings,parseContent}from'../scripts/source-project.mjs';
test('exposed ACF data retains nested types and only unique exact text is bound',()=>{
 const row={acf:{heading:'Special offer',price:12.5,available:true,relationship:123,rows:[{name:'Only once'}],duplicate:'Repeated',other:'Repeated'}};const fields=publicCustomFields(row);assert.deepEqual(fields,row.acf);fields.rows[0].name='Changed';assert.equal(row.acf.rows[0].name,'Only once');
 const $=load('<main><p class="offer">Special offer</p><p>Only once</p><p>Repeated</p><p>Repeated</p><nav>Special offer</nav></main>',null,false);const bindings=bindCustomFieldText($,$('main'),row.acf);assert.deepEqual(bindings.map(b=>b.field),['custom_fields.heading','custom_fields.rows.0.name']);assert.equal($('p').first().attr('class'),'offer');assert.equal($('nav').text(),'Special offer');assert.equal($('p').eq(2).text(),'Repeated');
});
test('public REST custom fields reach native frontmatter and drive shared templates after edit',{timeout:60000},async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'cloner-acf-'));
 try{
  const model={source:'https://example.test/',identity:{title:'Portfolio'},navigation:[],design:{},metrics:{},warnings:[],media:[],wordpress:{records:{},types:[],taxonomies:[],terms:{}},pages:[]};
  for(const [index,slug]of ['alpha','beta'].entries()){
   const url=model.source+slug+'/',copy=index?'Beta introduction':'Alpha introduction';
   const p=extract(`<html><head><title>${slug}</title></head><body class="single-work postid-${index+1}"><main><h1>${slug}</h1><p class="intro">${copy}</p><p>Ordinary body copy stays Markdown.</p></main></body></html>`,url);p.styles=[];model.pages.push(p);
   recordWordpress(model,{id:index+1,type:'work',status:'publish',link:url,acf:{intro:copy,enabled:true,quantity:3,links:[{label:'Project',url:'https://outside.example/'}]}},{slug:'work'});
  }
  await generate(model,dir);const routes=JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8'));assert.ok(routes.every(r=>r.collection==='wp-work'));
  const file=path.join(dir,'content/wp-work/'+routes[0].slug+'.md'),{meta,body}=parseContent(await readFile(file,'utf8'),file);assert.equal(meta.custom_fields.enabled,true);assert.equal(meta.custom_fields.quantity,3);assert.match(body,/Ordinary body copy/);assert.ok(meta.custom_field_bindings.some(b=>b.field==='custom_fields.intro'));
  const secondFile=path.join(dir,'content/wp-work/'+routes[1].slug+'.md'),second=parseContent(await readFile(secondFile,'utf8'),secondFile);assert.equal(meta.content_template,second.meta.content_template);
  meta.custom_fields.intro='Edited structured introduction';await writeFile(file,'---\n'+YAML.stringify(meta)+'---\n'+body);
  await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:45000});const html=await readFile(path.join(dir,'output/alpha/index.html'),'utf8'),$=load(html);assert.equal($('.intro').text(),'Edited structured introduction');assert.equal($('h1').first().text(),'alpha');
  const other=load(await readFile(path.join(dir,'output/beta/index.html'),'utf8'));assert.equal(other('.intro').text(),'Beta introduction');const roundtrip=JSON.parse(await readFile(path.join(dir,'template-roundtrip-report.json'),'utf8'));assert.ok(roundtrip.records.every(r=>r.passed));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('public numeric schema binds numbers, excludes ambiguous IDs and formatted values',()=>{
 const fields={budget:1200,relationship:15,unknown:23,formatted:450,rows:[{amount:7.5}],ambiguous:99};
 const schema=publicFieldSchema({type:'object',properties:{budget:{type:['number','null']},relationship:{type:['integer','array','null']},formatted:{type:'number'},rows:{type:'array',items:{type:'object',properties:{amount:{type:'number'}}}},ambiguous:{type:['number','integer']}}});
 const $=load('<main><p>1200</p><p>15</p><p>23</p><p>$450</p><p>7.5</p><p>99</p></main>',null,false);
 assert.deepEqual(bindCustomFieldText($,$('main'),fields,'custom_fields',schema).map(b=>b.field),['custom_fields.budget','custom_fields.rows.0.amount']);
 assert.equal($('p').eq(1).text(),'15');assert.equal($('p').eq(3).text(),'$450');
 const unsafe=JSON.parse('{"type":"object","properties":{"__proto__":{"type":"number"},"safe":{"type":"number","description":"ignored"}}}');assert.deepEqual(publicFieldSchema(unsafe),{type:['object'],properties:{safe:{type:['number']}}});
});
test('schema discovery is once per exposed type and budget failures remain retryable',async()=>{
 const model={source:'https://example.test/',wordpress:{apiRoot:'https://example.test/wp-json'},warnings:[]},type={slug:'work',rest_base:'works'};let calls=0;
 const network={options:async url=>{calls++;assert.equal(url,'https://example.test/wp-json/wp/v2/works');return {status:200,body:JSON.stringify({schema:{properties:{acf:{type:'object',properties:{budget:{type:'number'}}}}}})};}};
 await discoverCustomFieldSchema(model,network,type,[{acf:{}}]);assert.equal(calls,0);
 await discoverCustomFieldSchema(model,network,type,[{acf:{budget:2}}]);await discoverCustomFieldSchema(model,network,type,[{acf:{budget:3}}]);assert.equal(calls,1);
 delete model.wordpress.fieldSchemas.work;network.options=async()=>{throw Object.assign(Error('budget'),{code:'CRAWL_BUDGET'});};await assert.rejects(discoverCustomFieldSchema(model,network,type,[{acf:{budget:2}}]),{code:'CRAWL_BUDGET'});assert.equal(Object.hasOwn(model.wordpress.fieldSchemas,'work'),false);
 network.options=async()=>({status:403});await discoverCustomFieldSchema(model,network,type,[{acf:{budget:2}}]);assert.deepEqual(model.wordpress.fieldSchemas.work,{});assert.equal(model.warnings.length,1);
});

test('custom link binding preserves captured routes and accepts safe frontmatter destination edits',async()=>{
 const $=load('<main><a class="brief" href="/contact/">Ask us</a><a href="/other/">Other</a></main>',null,false),fields={brief:{title:'Ask us',url:'https://example.test/contact/'}};
 const {bindings,contexts}=bindCustomFieldLinks($,$('main'),fields,'https://example.test/work/',[]);assert.equal(bindings.length,1);
 const data={custom_fields:fields,custom_field_links:contexts};assert.match(await renderBindings($.html(),data),/href="\/contact\/"/);
 fields.brief.url='https://example.test/team/?ref=project#contact';assert.match(await renderBindings($.html(),data),/href="\/team\/\?ref=project#contact"/);
 fields.brief.url='https://other.example/contact/?a=1&b=2';assert.match(await renderBindings($.html(),data),/other.example\/contact\/\?a=1&amp;b=2/);
 fields.brief.url='javascript:alert(1)';await assert.rejects(renderBindings($.html(),data),/Unsafe custom-field link/);
 fields.brief.url='https://user:pass@example.test/';await assert.rejects(renderBindings($.html(),data),/Unsafe custom-field link/);
 const repeated=load('<main><a href="/contact/">One</a><a href="/contact/">Two</a></main>',null,false);assert.equal(bindCustomFieldLinks(repeated,repeated('main'),{brief:{title:'Ask',url:'/contact/'}},'https://example.test/').bindings.length,0);
});

test('same-destination fields bind only distinguishable labels and target edits retain safe relations',async()=>{
 const $=load('<main><a href="/contact/" rel="nofollow">Sales</a><a href="/contact/">Support</a></main>',null,false),fields={sales:{title:'Sales',url:'/contact/',target:''},support:{title:'Support',url:'/contact/',target:''}};
 const result=bindCustomFieldLinks($,$('main'),fields,'https://example.test/');assert.equal(result.bindings.length,4);
 fields.sales.url='/sales/';fields.sales.target='_blank';fields.support.url='/support/';
 const html=load(await renderBindings($.html(),{custom_fields:fields,custom_field_links:result.contexts}));assert.equal(html('a').first().attr('href'),'/sales/');assert.equal(html('a').first().attr('target'),'_blank');assert.equal(html('a').first().attr('rel'),'nofollow noopener');assert.equal(html('a').last().attr('href'),'/support/');assert.equal(html('a').last().attr('target'),'');
 fields.sales.target='bad" onclick="alert(1)';await assert.rejects(renderBindings($.html(),{custom_fields:fields,custom_field_links:result.contexts}),/Invalid custom-field link target/);
 const duplicate=load('<main><a href="/contact/">Same</a></main>',null,false);assert.equal(bindCustomFieldLinks(duplicate,duplicate('main'),{a:{title:'Same',url:'/contact/'},b:{title:'Same',url:'/contact/'}},'https://example.test/').bindings.length,0);
});
