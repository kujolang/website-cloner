import test from 'node:test';import assert from 'node:assert/strict';import {normalizeUsage,summarizeUsage,beginUsage,finishUsage} from '../engine/usage.mjs';
test('ChatGPT/Responses and chat-completions cached input is a subset, not extra total',()=>{
 for(const usage of [{input_tokens:100,output_tokens:20,input_tokens_details:{cached_tokens:80}},{prompt_tokens:100,completion_tokens:20,prompt_tokens_details:{cached_tokens:80}},{input_tokens:100,output_tokens:20,cached_input_tokens:80}]){
 const n=normalizeUsage({usage});assert.equal(n.input,100);assert.equal(n.cached,80);assert.equal(n.uncachedInput,20);assert.equal(n.total,120);assert.equal(n.complete,true);
 }
});
test('native cache categories and unknown fields retain their meaning',()=>{
 const n=normalizeUsage({usage:{input_tokens:10,output_tokens:20,cache_read_input_tokens:80,cache_creation_input_tokens:10}});assert.equal(n.input,100);assert.equal(n.uncachedInput,10);assert.equal(n.total,120);
 assert.equal(normalizeUsage().input,null);assert.equal(normalizeUsage({usage:{input_tokens:0,output_tokens:0}}).cached,null);
 assert.equal(normalizeUsage({usage:{input_tokens:100,output_tokens:20},usage_complete:false}).complete,false);
});
test('rejected/failed rounds and resumed receipts preserve usage; unknown totals never become zero',async()=>{
 const m={metrics:{aiCalls:0}},saved=[];const persist=async rounds=>saved.push(structuredClone(rounds));
 const first=await beginUsage(m,{stage:'review',round:1,model:'test'},persist);assert.equal(saved[0][0].status,'pending');
 await finishUsage(m,first,{model:'actual-model',billing_source:'chatgpt_plan',usage:{input_tokens:100,output_tokens:20,cached_input_tokens:80}},'responded',persist);
 await finishUsage(m,first,undefined,'failed',persist);assert.equal(first.tokens.input,100);assert.equal(first.model,'actual-model');assert.equal(first.requestedModel,'test');assert.equal(first.billingSource,'chatgpt_plan');
 const resumed={metrics:{aiUsage:structuredClone(m.metrics.aiUsage)}};
 const second=await beginUsage(resumed,{stage:'review',round:2,model:'test'},persist);await finishUsage(resumed,second,undefined,'failed',persist);
 const sum=summarizeUsage(resumed.metrics.aiUsage);assert.equal(sum.calls,2);assert.equal(sum.input.known,100);assert.equal(sum.input.missing,1);assert.equal(sum.cached.known,80);assert.equal(sum.total.known,120);assert.equal(sum.complete,false);
});
test('legacy aggregate counts survive a resume without inventing per-round cache usage',async()=>{
 const m={metrics:{aiCalls:3,inputTokens:90,outputTokens:12}};const entry=await beginUsage(m,{stage:'review',round:1,model:'test'});await finishUsage(m,entry,{usage:{input_tokens:10,output_tokens:2,cached_input_tokens:0}},'responded');assert.equal(m.metrics.aiCalls,4);assert.equal(m.metrics.inputTokens,100);assert.equal(m.metrics.aiUsage.length,2);assert.equal(m.metrics.cachedInputTokens,null);
});
test('upstream partial-round coverage prevents a complete-usage claim',()=>{
 assert.equal(normalizeUsage({usage:{input_tokens:100,output_tokens:20},provider_rounds:2,usage_reported_rounds:1}).complete,false);
});
