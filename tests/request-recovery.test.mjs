import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {SafeNetwork} from '../engine/network.mjs';

test('source requests retry transient failures, remain bounded, and do not bypass robots', async()=>{
 let count=0, mode='recover';
 const server=http.createServer((req,res)=>{
  count++;
  if(mode==='deny')return res.end('User-agent: *\nDisallow: /');
  if(mode==='hang')return;
  if(count===1)return req.socket.destroy();
  res.end('ok');
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const origin=`http://127.0.0.1:${server.address().port}`;
 const network=()=>new SafeNetwork({fixtureOrigins:[origin],requestTimeoutMs:200,requestDeadlineMs:500,retryDelayMs:1});
 try{
  assert.equal((await network().raw(origin)).body.toString(),'ok');assert.equal(count,2);
  mode='hang';count=0;
  await assert.rejects(network().raw(origin),e=>e.code==='ETIMEDOUT'&&/after 3 attempts/.test(e.message)&&/idle timeout/.test(e.message));
  assert.equal(count,3);
  mode='deny';count=0;
  await assert.rejects(network().get(origin+'/private'),/Disallowed/);assert.equal(count,1);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('exhausted download diagnostics distinguish a progressing stream from an idle timeout',async()=>{
 let requests=0;
 const server=http.createServer((req,res)=>{requests++;res.writeHead(200);res.write('data');const timer=setInterval(()=>res.write('data'),10);res.on('close',()=>clearInterval(timer));});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
 try{
  const network=new SafeNetwork({fixtureOrigins:[origin],requestTimeoutMs:200,requestDeadlineMs:350,retryDelayMs:1,pauseOnOutage:true});
  await assert.rejects(network.raw(origin+'/?private=hidden'),e=>e.code==='SOURCE_UNAVAILABLE'&&e.timeoutKind==='deadline'&&/deadline timeout/.test(e.message)&&!e.message.includes('private=hidden'));
  assert.equal(requests,3);
  assert.equal(network.outage?.timeoutKind,'deadline');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('failed jobs stay on progress with resume; polling outages reconnect without returning home',async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try{
  const page=await browser.newPage(),id='a'.repeat(48);
  const html=(await readFile('app/index.html','utf8')).replace(/<script[\s\S]*?<\/script>/g,'');
  const js=await readFile('app/client.js','utf8');
  let mode='failed',resumed=false;
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:html});
   if(url.pathname.endsWith('/resume')){resumed=true;mode='outage';return route.fulfill({json:{id}});}
   if(url.pathname===`/api/jobs/${id}`){
    if(mode==='outage'){mode='running';return route.abort();}
    return route.fulfill({json:{id,status:mode,stage:'Inspecting website',error:'Request timeout',options:{aiEnabled:false},events:[]}});
   }
   return route.fulfill({json:{models:[]}});
  });
  await page.goto('http://builder.test/?job='+id);await page.addScriptTag({content:js});
  await page.getByText('Needs attention',{exact:true}).waitFor();
  assert.equal(await page.locator('#submit').isVisible(),false);
  await page.locator('#resume').click();
  await page.getByText('Reconnecting',{exact:true}).waitFor();assert.equal(resumed,true);
  assert.equal(await page.locator('#submit').isVisible(),false);
  await page.getByText('Running',{exact:true}).waitFor();
  assert.equal(await page.locator('#resume').isVisible(),false);
 }finally{await browser.close();}
});

test('redirect chains do not multiply exhausted transport retries',async()=>{
 let requests=0;
 const network=new SafeNetwork({retryDelayMs:1});
 network.rawAttempt=async(url)=>{
  requests++;
  if(url.endsWith('/start'))return network.raw('https://example.org/end',1,true);
  throw Object.assign(Error('timeout'),{code:'ETIMEDOUT'});
 };
 await assert.rejects(network.raw('https://example.org/start'),e=>e.retryExhausted&&/\/end/.test(e.message));
 assert.equal(requests,4);
});
