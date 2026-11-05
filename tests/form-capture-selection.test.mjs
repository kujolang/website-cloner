import test from 'node:test';import assert from 'node:assert/strict';import {needsRenderedCapture} from '../engine/capture.mjs';
test('form-bearing pages receive rendered appearance capture even when their role already has a sample',()=>{
 assert.equal(needsRenderedCapture({sourceForms:[{provider:'contact-form-7'}]},false,false),true);
 assert.equal(needsRenderedCapture({sourceForms:[{provider:'html'}]},false,false),true);
 assert.equal(needsRenderedCapture({},false,false),false);
 assert.equal(needsRenderedCapture({},true,false),true);
 assert.equal(needsRenderedCapture({},false,true),true);
});
