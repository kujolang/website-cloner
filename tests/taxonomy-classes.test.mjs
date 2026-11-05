import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';import {taxonomyName}from '../engine/wordpress.mjs';import{taxonomyClassPlan,applyTaxonomyClasses,termClass}from '../scripts/taxonomy-classes.mjs';
for(const slug of ['category','post_tag','product_cat','portfolio_type'])test('native membership updates '+slug,()=>{
 const key=taxonomyName(slug),lookups={[key]:{1:{slug:'old'},2:{slug:'new'}}},mapping={taxonomies:[{slug}],terms:{[slug]:[{id:1,slug:'old'}]}},old=termClass(slug,{slug:'old'}),fresh=termClass(slug,{slug:'new'}),$=load(`<article class="custom ${old} category-layout"><aside class="${old}"></aside></article>`);
 const record={collection:'posts',meta:{[key]:[2],taxonomies:{[key]:[2]}}};
 assert.deepEqual(applyTaxonomyClasses($,$('article'),record,{lookups,taxonomyClasses:taxonomyClassPlan(mapping,lookups)}),[]);
 assert.equal($('article').hasClass(old),false);assert.equal($('article').hasClass(fresh),true);assert.equal($('article').hasClass('category-layout'),true);assert.equal($('aside').hasClass(old),true);
});
test('edited slugs, removed membership, collection lookup and unknown terms',()=>{
 const mapping={taxonomies:[{slug:'category'}],terms:{category:[{id:1,slug:'old'}]}},lookups={categories:{1:{slug:'global'}},'posts-categories':{1:{slug:'edited'}}},project={lookups,taxonomyClasses:taxonomyClassPlan(mapping,lookups)};
 const $=load('<article class="category-old custom"></article>');
 assert.deepEqual(applyTaxonomyClasses($,$('article'),{collection:'posts',meta:{categories:[1]}},project),[]);assert.equal($('article').attr('class'),'custom category-edited');
 assert.deepEqual(applyTaxonomyClasses($,$('article'),{collection:'posts',meta:{categories:[99]}},project),['Unknown native taxonomy class term: categories/99']);assert.equal($('article').attr('class'),'custom');
 $('article').attr('class','category-old custom');applyTaxonomyClasses($,$('article'),{meta:{}},project);assert.equal($('article').attr('class'),'custom');
});
test('WordPress sanitization uses ID for encoded, numeric and dash-only slugs',()=>{for(const slug of ['%e6%97%a5','123','---',''])assert.equal(termClass('product_cat',{slug,id:7}),'product_cat-7');assert.equal(termClass('post_tag',{slug:'café',id:8}),'tag-caf');});
test('does not invent a family on elements without captured taxonomy classes',()=>{const $=load('<article class="layout"></article>');applyTaxonomyClasses($,$('article'),{meta:{categories:[1]}},{lookups:{categories:{1:{slug:'new'}}},taxonomyClasses:taxonomyClassPlan({taxonomies:[{slug:'category'}],terms:{category:[{id:1,slug:'new'}]}})});assert.equal($('article').attr('class'),'layout');});
