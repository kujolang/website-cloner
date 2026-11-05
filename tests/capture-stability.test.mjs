import test from 'node:test';
import assert from 'node:assert/strict';
import {PNG} from 'pngjs';
import {stableScreenshot} from '../engine/capture-stability.mjs';
const frame = (value,width=1) => {const png=new PNG({width,height:1});png.data.fill(value);return PNG.sync.write(png);};
const page = frames => ({screenshot:async options=>{assert.equal(options.path,undefined);return frames.shift();}});
test('capture stability requires consecutive identical decoded pixels without a reference image',async()=>{
 const a=frame(10),b=frame(11);const result=await stableScreenshot(page([a,b,b]),{path:'unused.png'});
 assert.equal(result.captures,3);assert.equal(result.samples.length,3);assert.deepEqual(result.buffer,b);
 assert.equal((await stableScreenshot(page([a,a]))).captures,2);
});
test('changing dimensions or pixels fail explicitly at the bounded limit and retain evidence',async()=>{
 await assert.rejects(stableScreenshot(page([frame(10),frame(11),frame(10)])),/did not stabilize/);
 await assert.rejects(stableScreenshot(page([frame(10),frame(10,2),frame(11,2)])),error=>error.samples.length===3&&/did not stabilize/.test(error.message));
 for(const maxCaptures of [1,6,NaN,2.5])await assert.rejects(stableScreenshot(page([]),{maxCaptures}),/two to five/);
 await assert.rejects(stableScreenshot({screenshot:async()=>{throw Error('browser closed');}}),/browser closed/);
});
