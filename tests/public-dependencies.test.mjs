import test from 'node:test';import assert from 'node:assert/strict';
import{publicPackageURL}from'../engine/public-dependencies.mjs';import{SafeNetwork}from'../engine/network.mjs';
test('public package equivalents require an exact official host, version and resource path',()=>{
 assert.equal(publicPackageURL('https://code.ionicframework.com/ionicons/2.0.1/css/ionicons.min.css'),'https://cdn.jsdelivr.net/npm/ionicons@2.0.1/css/ionicons.min.css');
 assert.equal(publicPackageURL('https://code.ionicframework.com/ionicons/2.0.1/fonts/ionicons.woff?v=2.0.1'),'https://cdn.jsdelivr.net/npm/ionicons@2.0.1/fonts/ionicons.woff');
 for(const u of ['https://code.ionicframework.com.evil.test/ionicons/2.0.1/css/ionicons.min.css','https://code.ionicframework.com/ionicons/latest/css/ionicons.min.css','https://code.ionicframework.com/secret','https://code.ionicframework.com/ionicons/2.0.1/css/ionicons.min.css?token=x'])assert.equal(publicPackageURL(u),null);
});
test('alternate public package respects destination permission and never retries source access-denied responses',async()=>{
 const source='https://code.ionicframework.com/ionicons/2.0.1/css/ionicons.min.css';let allowed=[];const n=new SafeNetwork();n.allowed=async u=>{allowed.push(u.hostname);if(u.hostname==='code.ionicframework.com')throw Error('Disallowed by robots.txt')};n.raw=async url=>({status:200,headers:{},body:Buffer.from('font'),url});
 assert.equal((await n.get(source)).status,200);assert.deepEqual(allowed,['code.ionicframework.com','cdn.jsdelivr.net']);assert.equal(n.publicPackageSubstitutions.size,1);
 const blocked=new SafeNetwork();blocked.allowed=async()=>{throw Error('Disallowed by robots.txt')};await assert.rejects(blocked.get(source),/Disallowed/);
 const denied=new SafeNetwork();denied.allowed=async()=>{};denied.raw=async()=>({status:403,body:Buffer.from('denied')});assert.equal((await denied.get(source)).status,403);assert.equal(denied.publicPackageSubstitutions.size,0);
});
