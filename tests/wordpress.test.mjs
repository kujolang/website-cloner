import test from 'node:test';import assert from 'node:assert/strict';
import {mapWordpress,collectionName,taxonomyName} from '../engine/wordpress.mjs';
test('hidden REST custom types and taxonomy memberships use captured public WordPress semantics',()=>{
 const source='https://example.com/';const item={url:source+'faqs/support/',route:'/faqs/support/',bodyClass:'single single-faqs postid-42',content:'<h1>Support</h1>'};
 const archive={url:source+'faq-category/plans/',route:'/faq-category/plans/',bodyClass:'archive tax-faq-categories term-plans term-72',content:'<h1>Plans</h1><ul><li class="wp-block-post"><h2>Support</h2><a class="wp-block-read-more" href="/faqs/support/">Read More</a></li></ul>'};
 const model={source,pages:[item,archive],warnings:[]};mapWordpress(model);assert.equal(item.contentType,collectionName('faqs'));assert.equal(archive.contentType,'pages');assert.deepEqual(item.taxonomies[taxonomyName('faq-categories')],[72]);assert.equal(model.wordpress.terms['faq-categories'][0].name,'Plans');assert.equal(model.contentMapping.unresolvedTerms.length,0);
 mapWordpress(model);assert.equal(model.wordpress.terms['faq-categories'].length,1);assert.deepEqual(item.taxonomies[taxonomyName('faq-categories')],[72]);
});
