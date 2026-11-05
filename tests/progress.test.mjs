import test from "node:test";
import assert from "node:assert/strict";
import { progressWriter } from "../app/progress.mjs";

test("disk failure is retained immediately and surfaced without crashing on an unhandled promise", async () => {
  const error = Object.assign(Error("disk full"), {code:"ENOSPC"});
  const writer = progressWriter(async () => { throw error; });
  writer.record({stage:"capture"});
  await new Promise(resolve => setImmediate(resolve));
  assert.throws(() => writer.record({stage:"build"}), /disk full/);
  await assert.rejects(writer.flush(), /disk full/);
  await writer.settle();
});
test("progress writes finish in order before completion", async () => {
  const stages = [];
  const writer = progressWriter(async value => { stages.push(value.stage); });
  writer.record({stage:"capture"}); writer.record({stage:"build"});
  await writer.flush(); assert.deepEqual(stages,["capture","build"]);
});
test('snapshot coalescing bounds pending writes while preserving the latest full event history',async()=>{
 let release;const blocked=new Promise(resolve=>{release=resolve;});const saved=[];
 const writer=progressWriter(async value=>{saved.push(value);if(saved.length===1)await blocked;},{coalesce:true});
 writer.record({stage:0,events:[0]});
 for(let i=1;i<=1000;i++)writer.record({stage:i,events:Array.from({length:i+1},(_,n)=>n)});
 release();await writer.flush();
 assert.deepEqual(saved.map(x=>x.stage),[0,1000]);assert.equal(saved[1].events.length,1001);
 writer.record({stage:1001,events:[]});await writer.flush();assert.equal(saved.at(-1).stage,1001);
});
test('coalesced failures remain observable and discard pending writes',async()=>{
 let release;const blocked=new Promise(resolve=>{release=resolve;});let calls=0;
 const writer=progressWriter(async()=>{calls++;await blocked;throw Error('disk full');},{coalesce:true});
 writer.record(1);writer.record(2);release();await assert.rejects(writer.flush(),/disk full/);
 assert.equal(calls,1);assert.throws(()=>writer.record(3),/disk full/);await writer.settle();
});
