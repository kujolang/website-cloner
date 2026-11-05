import test from'node:test';import assert from'node:assert/strict';import{load}from'cheerio';import{applyProductTaxonomies}from'../scripts/product-taxonomies.mjs';
const context={source:'https://source.test/',lookups:{productcats:{1:{name:'Original',url:'https://source.test/category/original/'},2:{name:'New & Good',url:'https://source.test/category/new/'}}},routes:[{source:'https://source.test/category/original/',route:'/category/original/'},{source:'https://source.test/category/new/',sourceRoute:'/category/new/',route:'/categories/new/'}],bindings:[]};
const record=ids=>({collection:'products',meta:{product:{},taxonomies:{productcats:ids}}});
const html='<div class="summary"><div class="product_meta"><span class="posted_in">Kategorie: <a class="term" href="/category/original/" rel="tag">Original</a></span></div></div>';
test('native term edits preserve source label/styling and follow renamed local archives and deployment prefixes',()=>{
 const $=load(html);assert.deepEqual(applyProductTaxonomies($,record([2,1,2]),{...context,base:'/preview'}),[]);assert.equal($('.posted_in').text(),'Kategorie: New & Good, Original');assert.deepEqual($('.posted_in a').map((_,a)=>$(a).attr('href')).get(),['/preview/categories/new/','/preview/category/original/']);assert.equal($('.term').length,2);assert.equal($('.term').first().attr('rel'),'tag');
 const empty=load(html);applyProductTaxonomies(empty,record([]),context);assert.equal(empty('.posted_in').length,0);
});
test('missing archives and unknown terms report issues without retaining old destinations',()=>{
 const $=load(html);const issues=applyProductTaxonomies($,record([2,99]),{...context,routes:context.routes.slice(0,1)});assert.equal(issues.length,2);assert.equal($('.posted_in [href]').length,0);assert.match($('.posted_in').text(),/New & Good/);const unknown=load(html);assert.equal(applyProductTaxonomies(unknown,record([99]),context).length,1);assert.equal(unknown('.posted_in').length,0);
});
test('ambiguous groups and nested markup do not guess a taxonomy',()=>{
 const $=load(html),other={...context,lookups:{...context.lookups,other:context.lookups.productcats}};assert.ok(applyProductTaxonomies($,{meta:{product:{},taxonomies:{productcats:[2],other:[1]}}},other).length>=1);assert.equal($('.posted_in a').text(),'Original');const nested=load(html.replace('<a class','<b><a class').replace('</a>','</a></b>'));assert.equal(applyProductTaxonomies(nested,record([2]),context).length,1);
});

test('omitted native relationships remove sampled terms and missing presentation groups are reported',()=>{
 const $=load(html);assert.deepEqual(applyProductTaxonomies($,{collection:'products',meta:{product:{},taxonomies:{}}},context),[]);assert.equal($('.posted_in').length,0);
 const missing=load('<div class="summary"><div class="product_meta"></div></div>');assert.match(applyProductTaxonomies(missing,record([2]),context)[0],/No captured/);
});

test('categories and tags bind independently and nonlocal term URLs never become active links',()=>{
 const $=load(html.replace('</div></div>','<span class="tagged_as">Tags: <a href="/tag/first/">First</a></span></div></div>'));
 const ctx={...context,lookups:{...context.lookups,producttags:{1:{name:'First',url:'https://source.test/tag/first/'},2:{name:'Second',url:'https://source.test/tag/second/'}}},routes:[...context.routes,{route:'/tag/first/'},{route:'/tag/second/'}]};
 assert.deepEqual(applyProductTaxonomies($,{collection:'products',meta:{product:{},taxonomies:{productcats:[2],producttags:[2]}}},ctx),[]);assert.equal($('.tagged_as a').attr('href'),'/tag/second/');assert.equal($('.posted_in a').attr('href'),'/categories/new/');
 for(const url of ['javascript:alert(1)','https://other.test/category/new/','https://user:pass@source.test/category/new/']){const bad=load(html),issues=applyProductTaxonomies(bad,record([2]),{...context,lookups:{productcats:{...context.lookups.productcats,2:{name:'Unsafe',url}}}});assert.equal(bad('.posted_in [href]').length,0);assert.equal(issues.length,1);}
});

test('source path segments matching deployment prefixes and Unicode routes stay intact',()=>{
 const $=load(html.replace('/category/original/','/preview/preview/category/original/'));const ctx={source:context.source,base:'/preview',lookups:{productcats:{1:{name:'Old',url:'https://source.test/preview/category/original/'},2:{name:'Café',url:'https://source.test/preview/catégorie/café/'}}},routes:[{route:'/preview/catégorie/café/'}]};assert.deepEqual(applyProductTaxonomies($,record([2]),ctx),[]);assert.equal($('.posted_in a').attr('href'),'/preview/preview/catégorie/café/');
});
