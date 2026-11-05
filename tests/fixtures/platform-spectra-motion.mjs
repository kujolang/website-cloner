// Compare installed Spectra transition geometry at the same animation time.
import assert from 'node:assert/strict';import {writeFile} from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';import {serveStatic} from '../../engine/static.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/spectra');const server=await serveStatic(path.join(root,'project/output'));const browser=await chromium.launch({channel:'chrome'}),results=[];
try {
 for(const width of [1440,390])for(const time of [125,250,375]) {
  const states=[];
  for(const [side,origin] of [['source','http://127.0.0.1:9430'],['rebuilt',server.url]]) {
   const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'no-preference'});
   await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())&&new URL(r.request().url()).origin===origin?r.continue():r.abort());
   assert.equal((await page.goto(origin+'/faq-exclusive/',{waitUntil:'networkidle'})).status(),200);
   const state=await page.evaluate(time=>{
    document.querySelectorAll('.uagb-faq-questions-button')[1].click();
    return [...document.querySelectorAll('.uagb-faq-content')].map(panel=>{
     const animations=panel.getAnimations();for(const a of animations){a.pause();a.currentTime=time;}
     const style=getComputedStyle(panel);return {height:panel.getBoundingClientRect().height,paddingTop:parseFloat(style.paddingTop),paddingBottom:parseFloat(style.paddingBottom),durations:animations.map(a=>a.effect.getTiming().duration)};
    });
   },time);
   for(const panel of state){assert.ok(panel.durations.length,side+' animates');assert.ok(panel.durations.every(ms=>ms===500),side+' timing');}
   states.push(state);await page.close();
  }
  for(let i=0;i<2;i++)for(const property of ['height','paddingTop','paddingBottom'])assert.ok(Math.abs(states[0][i][property]-states[1][i][property])<=1,JSON.stringify({width,time,panel:i,property,states}));
  results.push({width,time,source:states[0],rebuilt:states[1]});
 }
 await writeFile(path.join(root,'spectra-motion-check.json'),JSON.stringify({duration:500,tolerancePx:1,results},null,2));console.log(JSON.stringify({samples:results.length,panels:results.length*2,passed:true}));
}finally{await browser.close();await server.close();}
