import test from 'node:test';
import assert from 'node:assert/strict';
import {withoutRedirectCopies} from '../engine/redirect-pages.mjs';
const source='https://site.test/';
const page=(route,document=route)=>({url:source+route,documentURL:source+document,route:'/'+route});
const edge=(from,to,status=301)=>({from:source+from,to:source+to,status});
test('observed chains drop copied documents but preserve authored destinations and input',()=>{
 const model={source,pages:[page('new/'),page('old/','new/'),page('chain/','new/')],observedRedirects:[edge('old/','new/'),edge('chain/','old/',307)]};
 assert.deepEqual(withoutRedirectCopies(model).pages,[model.pages[0]]);assert.equal(model.pages.length,3);
});
test('missing targets, query redirects, cycles and unproven canonical differences retain content',()=>{
 for(const observedRedirects of [[],[edge('old/','new/?q=1')],[edge('old/','loop/'),edge('loop/','old/')]]) {
 const model={source,pages:[page('new/'),page('old/','new/')],observedRedirects}; assert.equal(withoutRedirectCopies(model).pages.length,2);
 }
 const model={source,pages:[page('old/','new/')],observedRedirects:[edge('old/','new/')]};assert.equal(withoutRedirectCopies(model).pages.length,1);
});
