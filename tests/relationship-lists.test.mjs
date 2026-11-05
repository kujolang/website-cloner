import test from 'node:test';import assert from 'node:assert/strict';import {load} from 'cheerio';
import {fieldRelationships} from '../engine/custom-relationships.mjs';import {bindRelationshipLists} from '../engine/relationship-lists.mjs';import {renderBindings,nativeRelationshipIndex} from '../scripts/source-project.mjs';
const targets=[{id:1,type:'project',sourceURL:'https://example.test/one/',title:'One',restReferences:{self:'https://example.test/wp-json/wp/v2/projects/1'}},{id:2,type:'page',sourceURL:'https://example.test/two/',title:'Two',restReferences:{self:'https://example.test/wp-json/wp/v2/pages/2'}}];
const record={customFields:{related:[1,2]},customFieldSchema:{properties:{related:{type:['array','null'],items:{type:'integer'}}}},restReferences:{posts:targets.map(t=>t.restReferences.self)}};
function bind(html){const $=load(html,null,false),result=bindRelationshipLists($,$.root(),fieldRelationships(record,targets));return {html:$.html(),...result};}
test('uniform evidenced list uses native IDs to reorder, remove and add targets',async()=>{
 const bound=bind('<ul class="related">\n<li><a href="/one/"><strong>One</strong></a></li>\n<li><a href="/two/"><strong>Two</strong></a></li>\n</ul>');assert.equal(bound.bindings.length,1);assert.equal(bound.templates.size,1);
 const data={custom_fields:{related:[2,3,1]},custom_field_lists:bound.lists,__relationshipRecords:nativeRelationshipIndex([{id:1,type:'project',route:'/one/',title:'One'},{id:2,type:'page',route:'/renamed/',title:'Edited Two'},{id:3,type:'post',route:'/three/',title:'Three & More'}])};
 const rendered=load(await renderBindings(bound.html,data,bound.templates));assert.deepEqual(rendered('a').map((_,n)=>rendered(n).attr('href')).get(),['/renamed/','/three/','/one/']);assert.deepEqual(rendered('strong').map((_,n)=>rendered(n).text()).get(),['Edited Two','Three & More','One']);
 data.custom_fields.related=[];assert.equal(load(await renderBindings(bound.html,data,bound.templates))('li').length,0);data.custom_fields.related=null;assert.equal(load(await renderBindings(bound.html,data,bound.templates))('li').length,0);
 data.custom_fields.related=[99];await assert.rejects(renderBindings(bound.html,data,bound.templates),/not exported/);data.custom_fields.related=[1,1];await assert.rejects(renderBindings(bound.html,data,bound.templates),/Invalid relationship list/);
});
test('mixed shapes, partial lists, IDs and repeated destinations are not inferred',()=>{
 for(const html of ['<ul><li><a href="/one/">One</a></li><li class="different"><a href="/two/">Two</a></li></ul>','<ul><li><a href="/one/">One</a></li><li><a href="/two/">Two</a></li><li>Other content</li></ul>','<ul><li id="one"><a href="/one/">One</a></li><li><a href="/two/">Two</a></li></ul>','<ul><li><a href="/one/">One</a></li><li><a href="/two/">Two</a></li></ul><a href="/one/">Other</a>'])assert.equal(bind(html).bindings.length,0);
 assert.deepEqual(fieldRelationships({...record,restReferences:{posts:[targets[0].restReferences.self]}},targets),{});
});

test('overlapping fields do not arbitrarily claim the same list',()=>{const $=load('<ul><li><a href="/one/">One</a></li><li><a href="/two/">Two</a></li></ul>',null,false),relations=fieldRelationships(record,targets);relations['custom_fields.other']=relations['custom_fields.related'];assert.equal(bindRelationshipLists($,$.root(),relations).bindings.length,0);});
