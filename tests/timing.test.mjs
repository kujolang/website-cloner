import test from 'node:test';
import assert from 'node:assert/strict';
import {startTiming,timingSnapshot,transitionTiming} from '../app/timing.mjs';
test('migration time separates waits, freezes on completion and excludes offline resume gaps',()=>{
 let t=startTiming(null,1000);t=transitionTiming(t,'waiting',5000);
 assert.equal(t.workMs,4000);t=transitionTiming(t,'running',8000);assert.equal(t.waitMs,3000);
 const saved=timingSnapshot(t,10000);assert.equal(saved.workMs,6000);
 t=startTiming(saved,100000);t=transitionTiming(t,'complete',102000);
 assert.equal(t.workMs,8000);assert.equal(t.waitMs,3000);assert.deepEqual(timingSnapshot(t,999999),t);
 assert.equal(startTiming(null,200000).workMs,0);
});
