import test from 'node:test';import assert from 'node:assert/strict';import {run} from '../engine/pipeline.mjs';
test('child disk exhaustion reaches automatic resume as ENOSPC',async()=>{await assert.rejects(run(process.execPath,['-e',"console.error('Error: ENOSPC: no space left on device, open output/index.html');process.exit(1)"]),e=>e.code==='ENOSPC');});
test('other child failures keep their exit status',async()=>{await assert.rejects(run(process.execPath,['-e',"console.error('ordinary failure');process.exit(7)"]),e=>e.code===7);});
