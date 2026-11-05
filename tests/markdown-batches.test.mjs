import test from 'node:test';
import assert from 'node:assert/strict';
import {markdownBatches} from '../scripts/source-project.mjs';
test('native Markdown batches bound UTF-8 JSON size and reuse identical sections across routes',()=>{
 const inputs=Array.from({length:40},(_,i)=>({id:'post/'+i,body:'# Title '+(i%10)+'\n\n'+('é'.repeat(300))}));
 const {batches,aliases,unique}=markdownBatches(inputs,1500);
 assert.equal(unique.length,10);assert.equal(aliases.size,40);assert.ok(batches.length>1);
 for(const batch of batches)assert.ok(Buffer.byteLength(JSON.stringify(batch))<=1500);
 assert.equal(aliases.get('post/30'),'post/0');assert.equal(batches.flat().length,10);
 assert.throws(()=>markdownBatches([{id:'large',body:'x'.repeat(2000)}],1500),/large/);
 assert.deepEqual(markdownBatches([]).batches,[]);
});
