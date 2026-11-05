import test from 'node:test';
import assert from 'node:assert/strict';
import {SafeNetwork} from '../engine/network.mjs';

for(const kind of ['timeout','rate-limit','dns'])test(`external ${kind} is isolated, remembered and does not stop source`,async()=>{
 const n=new SafeNetwork({sourceOrigin:'https://source.test/',pauseOnOutage:true,retryDelayMs:1});
 let attempts=0;n.address=async u=>{if(kind==='dns'&&u.hostname==='external.test')throw Object.assign(Error('DNS timeout'),{code:'ETIMEDOUT'});};
 n.rawAttempt=async url=>{if(url.startsWith('https://external.test')){attempts++;if(kind==='timeout')throw Object.assign(Error('timeout'),{code:'ETIMEDOUT',timeoutKind:'idle'});return {status:429,headers:{},body:Buffer.alloc(0),url};}return {status:200,headers:{},body:Buffer.from(''),url};};
 await assert.rejects(n.get('https://external.test/widget.js'),{code:'EXTERNAL_RESOURCE_UNAVAILABLE'});
 assert.equal(n.outage,null);assert.equal(n.externalFailures.size,1);
 const before=attempts;await assert.rejects(n.get('https://external.test/other.js'),{code:'EXTERNAL_RESOURCE_UNAVAILABLE'});assert.equal(attempts,before);
 assert.equal((await n.get('https://source.test/article')).status,200);
});
test('source outage still stops subsequent source requests',async()=>{
 const n=new SafeNetwork({sourceOrigin:'https://source.test/',pauseOnOutage:true});n.address=async()=>{};
 n.rawAttempt=async url=>({status:503,headers:{},body:Buffer.alloc(0),url});
 await assert.rejects(n.get('https://source.test/'),{code:'SOURCE_UNAVAILABLE'});assert.equal(n.outage.code,'SOURCE_UNAVAILABLE');
 await assert.rejects(n.get('https://other.test/'),{code:'SOURCE_UNAVAILABLE'});
});
