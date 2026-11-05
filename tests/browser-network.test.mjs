import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {BrowserNetwork,publicBrowserProxy,captureTransport} from '../engine/browser-network.mjs';
import {SafeNetwork} from '../engine/network.mjs';

async function fixture(){
 const seen=[];
 const server=http.createServer((req,res)=>{
   seen.push({url:req.url,method:req.method,cookie:req.headers.cookie});
   if(req.url==='/robots.txt'){res.setHeader('Content-Type','text/plain');return res.end('User-agent: *\nDisallow: /private\n');}
   if(req.url==='/denied'){res.writeHead(202,{'x-amzn-waf-action':'challenge'});return res.end();}
   if(req.url==='/redirect'){res.writeHead(302,{location:'/private'});return res.end();}
   if(req.url==='/chain'){res.writeHead(302,{location:'/chain2'});return res.end();}
   if(req.url==='/chain2'){res.writeHead(302,{location:'/article'});return res.end();}
   if(req.url==='/loop'){res.writeHead(302,{location:'/loop'});return res.end();}
   if(req.url==='/internal'){res.writeHead(302,{location:'http://127.0.0.2/secret'});return res.end();}
   if(req.url==='/download'){res.writeHead(200,{'Content-Type':'application/octet-stream','Content-Disposition':'attachment; filename="test.woff"'});return res.end('font-fixture');}
   if(req.url==='/big'){res.writeHead(200,{'Content-Type':'text/plain','Content-Length':'10000'});return res.end('x'.repeat(10000));}
   if(req.url==='/image'){res.writeHead(200,{'Content-Type':'image/svg+xml'});return res.end('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10"/></svg>');}
   res.setHeader('Content-Type','text/html');res.setHeader('Set-Cookie','fixture=accepted; SameSite=Lax');
   res.end('<!doctype html><html><body><h1>Fixture</h1><img src="/image"><form action="/submit" method="post"><button>Send</button></form></body></html>');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 return {url:'http://127.0.0.1:'+server.address().port,seen,close:()=>new Promise(r=>server.close(r))};
}
test('transport validation is explicit',()=>{assert.equal(captureTransport(),'http');assert.equal(captureTransport('browser'),'browser');assert.throws(()=>captureTransport('stealth'));});
test('browser transport preserves normal session, rules, read-only requests and closes private session',{timeout:60000},async()=>{
 const f=await fixture();let confirmed=0;const events=[];
 const network=new BrowserNetwork({fixtureOrigins:[f.url],headless:true,confirm:async()=>{confirmed++;},event:(...args)=>events.push(args),retryDelayMs:1});
 try{
  await network.initialize(f.url+'/');assert.equal(confirmed,1);assert.equal(events[0][1].browserWaiting,true);
  const response=await network.get(f.url+'/article');assert.equal(response.status,200);assert.match(response.body.toString(),/Fixture/);assert.equal(response.headers['set-cookie'],undefined);
  assert.ok(f.seen.find(r=>r.url==='/article'&&r.cookie==='fixture=accepted'));
  const count=f.seen.length;await network.get(f.url+'/article');assert.equal(f.seen.length,count);
  await assert.rejects(network.get(f.url+'/private'),/Disallowed by robots/);assert.equal(f.seen.some(r=>r.url==='/private'),false);
  await assert.rejects(network.get(f.url+'/redirect'),/Disallowed by robots/);assert.equal(f.seen.some(r=>r.url==='/private'),false);
  await assert.rejects(network.get(f.url+'/internal'),/Private|Fixture exception/);
  await assert.rejects(network.get(f.url+'/loop'),/Redirect limit/);
  assert.equal((await network.get(f.url+'/download')).body.toString(),'font-fixture');
  await assert.rejects(network.get(f.url+'/big',{maxFile:30}),/size limit/);
  const capture=await network.captureContext(),page=await capture.newPage();await page.goto(f.url+'/chain');assert.match(page.url(),/article$/);const deniedPage=await capture.newPage();await assert.rejects(deniedPage.goto(f.url+'/redirect'));assert.equal(f.seen.some(r=>r.url==='/private'),false);await deniedPage.close();await page.goto(f.url+'/');
  const posted=await page.evaluate(()=>fetch('/submit',{method:'POST',body:'blocked'}).then(()=>true,()=>false));assert.equal(posted,false);assert.equal(f.seen.some(r=>r.method==='POST'),false);
  await capture.close();assert.equal(page.isClosed(),true);
  await assert.rejects(network.get(f.url+'/denied'),{code:'BROWSER_ATTENTION'});
  assert.equal(network.outage.code,'BROWSER_ATTENTION');
 }finally{await network.close();await f.close();}
});
test('proxy rejects private destinations before making connections',{timeout:10000},async()=>{
 const network=new SafeNetwork(),proxy=await publicBrowserProxy(network);
 try{
  const result=await new Promise((resolve,reject)=>{const q=http.get(proxy.url,{path:'http://127.0.0.1:4310/api/jobs'},r=>{r.resume();r.on('end',()=>resolve(r.statusCode));});q.on('error',reject);});
  assert.equal(result,403);
  const result2=await new Promise((resolve,reject)=>{const q=http.request(proxy.url,{method:'CONNECT',path:'127.0.0.1:4310'});q.on('connect',(r,s)=>{resolve(r.statusCode);s.destroy();});q.on('error',reject);q.end();});assert.equal(result2,403);
 }finally{await proxy.close();}
});

for(const robotsDenied of [true,false])test(`third-party browser denial (${robotsDenied?'robots':'resource'}) is skipped while source capture continues`,{timeout:60000},async()=>{
 const seen=[];
 const external=http.createServer((req,res)=>{seen.push(req.url);if(!robotsDenied&&req.url==='/robots.txt'){res.setHeader('Content-Type','text/plain');return res.end('User-agent: *\nAllow: /\n');}res.writeHead(403);res.end('Denied');});
 await new Promise(r=>external.listen(0,'127.0.0.1',r));
 const other='http://127.0.0.1:'+external.address().port;
 const f=await fixture(),network=new BrowserNetwork({fixtureOrigins:[f.url,other],headless:true,confirm:async()=>{},pauseOnOutage:true});
 try{
  await network.initialize(f.url+'/');
  if(!robotsDenied){
   const capture=await network.captureContext(),page=await capture.newPage();await page.goto(f.url+'/');
   await assert.rejects(page.addScriptTag({url:other+'/widget.js'}));
   assert.equal(network.outage,null);assert.equal(network.externalFailures.size,1);await capture.close();
  }
  await assert.rejects(network.get(other+'/widget.js'),{code:'EXTERNAL_RESOURCE_UNAVAILABLE'});
  assert.deepEqual(seen,robotsDenied?['/robots.txt']:['/robots.txt','/widget.js']);assert.equal(network.outage,null);const requests=seen.length;
  await assert.rejects(network.get(other+'/another.js'),{code:'EXTERNAL_RESOURCE_UNAVAILABLE'});assert.equal(seen.length,requests);
  assert.equal((await network.get(f.url+'/article')).status,200);
  const c=await network.captureContext(),p=await c.newPage();await p.goto(f.url+'/');
  await p.evaluate(url=>{const s=document.createElement('script');s.src=url;document.body.append(s);},other+'/blocked.js');
  await p.waitForTimeout(200);assert.equal(network.outage,null);assert.equal(seen.length,requests);assert.equal(await p.locator('h1').innerText(),'Fixture');await c.close();
  await assert.rejects(network.get(f.url+'/denied'),{code:'BROWSER_ATTENTION'});assert.equal(network.outage.code,'BROWSER_ATTENTION');
 }finally{await network.close();await f.close();external.closeAllConnections();await new Promise(r=>external.close(r));}
});
