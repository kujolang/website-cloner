import test from 'node:test';
import assert from 'node:assert/strict';
import {aiPolicy} from '../engine/ai-policy.mjs';
import {reconstruct} from '../engine/reconstruct.mjs';
test('no AI blocks ambient and explicit inference settings, even when an agent is supplied',async()=>{
 const previous={endpoint:process.env.AI_ENDPOINT,model:process.env.AI_MODEL,fetch:global.fetch};let calls=0;
 process.env.AI_ENDPOINT='http://model.invalid';process.env.AI_MODEL='secret-default';global.fetch=()=>{calls++;throw Error('Unexpected inference');};
 try{for(const options of [{},{aiEnabled:false,ai:{enabled:true,endpoint:'http://other.invalid',modelName:'explicit'},agent:{model:'test'}}]){
 const policy=aiPolicy(options);assert.equal(policy.agent,null);
 const model={pages:[],metrics:{},warnings:[]};await reconstruct(model,policy.ai);
 assert.equal(model.design.method,'deterministic');assert.equal(model.metrics.aiUsage,undefined);
 }assert.equal(calls,0);assert.equal(aiPolicy({aiEnabled:true,agent:{model:'test'}}).agent.model,'test');}
 finally{global.fetch=previous.fetch;for(const [key,value]of [['AI_ENDPOINT',previous.endpoint],['AI_MODEL',previous.model]])if(value===undefined)delete process.env[key];else process.env[key]=value;}
});
