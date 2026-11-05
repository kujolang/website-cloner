import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {capture} from '../engine/capture.mjs';import {extract} from '../engine/extract.mjs';
test('capture initializes source presentation but blocks mutation requests and rejects missing styles', {timeout:120000},async()=>{
 const url='https://capture.example/';const html='<html><head><link rel="stylesheet" href="/theme.css"></head><body><main style="min-height:2000px"><p id="proof">Before</p></main><script>document.getElementById("proof").textContent="After initialization";document.body.classList.add("initialized");document.querySelector("link").href="/hydrated.css";fetch("/submit",{method:"POST",body:"no"});addEventListener("scroll",()=>{if(!window.requested){window.requested=true;fetch("/widget").then(r=>r.text()).then(t=>document.querySelector("main").insertAdjacentHTML("beforeend","<p>"+t+"</p>"));}});</script></body></html>';
 const dir=await mkdtemp(path.join(os.tmpdir(),'capture-ready-'));try{
 let broken=false;const requests=[];const network={get:async u=>{requests.push(u);if(u.endsWith('/widget')){await new Promise(r=>setTimeout(r,300));return {status:200,headers:{'content-type':'text/plain'},body:Buffer.from('Late review')}}return {status:broken&&u.endsWith('.css')?503:200,headers:{'content-type':u.endsWith('.css')?'text/css':'text/html'},body:Buffer.from(u.endsWith('.css')?'body{font-family:sans-serif}':html)};}};
 const model=()=>({source:url,identity:{},pages:[extract(html,url)],warnings:[],metrics:{}});
 const first=model(),progress=[];await capture(first,network,dir,{onEvent:(stage,data)=>progress.push(data.captureProgress)});assert.deepEqual(progress.map(p=>p.viewport),["desktop","tablet","mobile"]);assert.ok(progress.every(p=>p.route==="/"&&p.candidate===1&&p.totalCandidates===1));assert.equal(first.captures.length,3);assert.equal(requests.filter(u=>u===url).length,3,'each viewport initializes its own responsive document');assert.ok(first.pages[0].styleSources.some(s=>s.url===url+'hydrated.css'));assert.equal(first.pages[0].hydratedStyles,true);assert.equal(first.pages[0].hydratedContent,true);assert.match(first.pages[0].content,/After initialization/);assert.match(first.pages[0].content,/Late review/);assert.match(first.pages[0].bodyClass,/initialized/);assert.doesNotMatch(first.pages[0].content,/<script/);assert.equal(first.metrics.extraBrowserPages,0);assert.ok(first.captures.every(c=>c.measurements.elements.some(e=>e.text==='After initialization')));assert.ok(!requests.some(u=>u.includes('/submit')));
 broken=true;const second=model();await capture(second,network,dir);assert.equal(second.captures.length,0);assert.ok(second.warnings.every(w=>w.includes('stylesheet capture incomplete')));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('failed source baselines do not suppress local navigation/a11y verification',async()=>{
 const {verificationPlan}=await import('../engine/verify.mjs');const plan=verificationPlan({capturePlan:[{route:'/',role:'home'},{route:'/about',role:'default-page'}],captures:[{route:'/',viewport:{name:'desktop'},file:'home-desktop.png'}]});assert.equal(plan.length,6);assert.equal(plan.filter(x=>x.missingSource).length,5);assert.equal(plan[0].file,'home-desktop.png');
});

test('persistent background traffic does not discard a rendered source baseline',{timeout:60000},async()=>{
 const url='https://polling.example/',html='<html><body><main><h1>Ready content</h1></main><script>fetch("/poll")</script></body></html>',dir=await mkdtemp(path.join(os.tmpdir(),'capture-poll-'));
 const network={get:async u=>u.endsWith('/poll')?new Promise(()=>{}):{status:200,headers:{'content-type':'text/html'},body:Buffer.from(html)}};
 const model={source:url,identity:{},pages:[extract(html,url)],warnings:[],metrics:{}};
 try{await capture(model,network,dir);assert.equal(model.captures.length,3);assert.match(model.pages[0].content,/Ready content/);assert.ok(model.warnings.some(w=>w.includes('did not settle')));}finally{await rm(dir,{recursive:true,force:true});}
});
