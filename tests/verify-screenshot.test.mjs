import test from 'node:test';import assert from 'node:assert/strict';
import {verificationScreenshot} from '../engine/verify-screenshot.mjs';
test('visual verification retries rasterization timeout once with a separate deadline',async()=>{
 let attempts=0;const timeout=Object.assign(Error('raster timeout'),{name:'TimeoutError'});
 const result=await verificationScreenshot({screenshot:async options=>{assert.equal(options.timeout,30000);assert.equal(options.animations,'disabled');if(++attempts===1)throw timeout;}},'proof.png');
 assert.equal(result.retries,1);assert.equal(attempts,2);
 attempts=0;await assert.rejects(verificationScreenshot({screenshot:async()=>{attempts++;throw timeout;}},'proof.png'),/raster timeout/);assert.equal(attempts,2);
 attempts=0;await assert.rejects(verificationScreenshot({screenshot:async()=>{attempts++;throw Error('closed');}},'proof.png'),/closed/);assert.equal(attempts,1);
});

test('verification matches saved full-page scope while old captures retain viewport compatibility',async()=>{
 const options=[];const page={screenshot:async o=>options.push(o)};
 await verificationScreenshot(page,'old.png');await verificationScreenshot(page,'new.png',{fullPage:true});
 assert.equal(options[0].fullPage,false);assert.equal(options[1].fullPage,true);
});
