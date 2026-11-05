// Installed optimizer presentation and native disclosure parity; local reads only.
import assert from 'node:assert/strict';import {mkdir,readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';import {load} from 'cheerio';
import {serveStatic} from '../../engine/static.mjs';import {visualScore,layoutScore} from '../../engine/verify.mjs';import {measure,revealLazyContent} from '../../engine/capture.mjs';
const litespeed=process.argv.includes('--litespeed');
const root=path.resolve(process.argv[2]||(litespeed?'artifacts/platform/litespeed-installed':'artifacts/platform/autoptimize')),source=litespeed?'http://127.0.0.1:9433':'http://127.0.0.1:9429',out=path.join(root,'optimizer-evidence');await mkdir(out,{recursive:true});
const inline=process.argv.includes('--inline');
const raw=await fetch(source+'/');assert.equal(raw.status,200);const html=await raw.text(),$=load(html);if(litespeed){assert.ok($('link[data-optimized][href*="/litespeed/css/"]').length,'Installed source must serve LiteSpeed optimized CSS');assert.ok($('img[data-lazyloaded][data-src]').length>=2);}else if(inline)assert.ok($('style').toArray().some(e=>$(e).text().includes('FixtureIcons')),'Installed source must inline fixture CSS');else assert.ok($('link[href*="/cache/autoptimize/"]').length,'Installed source must serve optimized CSS');assert.ok(/data-src=/.test(html),'Installed source must expose lazy image markup');
if(inline)assert.ok($('script[defer][src*="autoptimize_single_"]').length,'Installed source must defer uncombined optimized scripts');
const server=await serveStatic(path.join(root,'project/output')),browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 for(const[name,width,height]of[['desktop',1440,1000],['mobile',390,844]]){
  const shots={closed:[],open:[]};
  for(const[side,origin]of[['source',source],['rebuilt',server.url]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});page.setDefaultTimeout(15000);let mutations=0;const missing=[];page.on('response',r=>{if(r.status()>=400)missing.push({url:r.url(),status:r.status()});});
   await page.route('**/*',r=>{if(!['GET','HEAD'].includes(r.request().method())){mutations++;return r.abort();}return new URL(r.request().url()).origin===origin?r.continue():r.abort();});
   assert.equal((await page.goto(origin+'/',{waitUntil:'networkidle'})).status(),200);await page.evaluate(()=>document.fonts.ready);await revealLazyContent(page);await page.evaluate(()=>scrollTo(0,0));
   const styles=await page.locator('.fixture-panel').evaluate(el=>({radius:getComputedStyle(el).borderRadius,background:getComputedStyle(el).backgroundImage,font:getComputedStyle(el.querySelector('.fixture-icon'),'::before').fontFamily,loaded:[...document.fonts].some(font=>font.family==='FixtureIcons'&&font.status==='loaded')}));assert.equal(styles.radius,'20px');assert.ok(styles.background.includes('url('));assert.ok(styles.loaded);assert.ok(styles.font.includes('FixtureIcons'));
   if(litespeed){const image=await page.locator('.fixture-lazy').evaluate(el=>({loaded:el.complete&&el.naturalWidth>0,fit:getComputedStyle(el).objectFit,radius:getComputedStyle(el).borderRadius,height:el.getBoundingClientRect().height}));assert.equal(image.loaded,true);assert.equal(image.fit,'cover');assert.equal(image.radius,'20px');assert.equal(image.height,width<600?180:280);}
   for(const state of ['closed','open']){if(state==='open')await page.locator('details summary').click();assert.equal(await page.locator('details').evaluate(e=>e.open),state==='open');await page.evaluate(()=>scrollTo(0,0));shots[state].push({image:await page.screenshot({path:path.join(out,side+'-'+name+'-'+state+'.png'),fullPage:true,animations:'disabled'}),layout:await measure(page)});}
   assert.equal(mutations,0);assert.deepEqual(missing,[]);await page.close();
  }
  for(const[state,[a,b]]of Object.entries(shots)){const result={viewport:name,state,pixel:visualScore(a.image,b.image),layout:layoutScore(a.layout,b.layout)};results.push(result);assert.ok(result.pixel>=0.99,JSON.stringify(result));}
 }
 await writeFile(path.join(root,'optimizer-check.json'),JSON.stringify({plugin:litespeed?'LiteSpeed Cache 7.9.2':'Autoptimize 3.1.16',aggregatedSourceCSS:true,inlineCSS:inline,lazySourceImages:true,localBackgroundAndIconFont:true,sourceMutations:0,results},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
