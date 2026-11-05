import {chromium} from 'playwright';import {mkdir,writeFile,readFile} from 'node:fs/promises';import path from 'node:path';
import {serveStatic} from '../../engine/static.mjs';import {visualScore,layoutScore} from '../../engine/verify.mjs';import {measure,revealLazyContent} from '../../engine/capture.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/forms'),out=path.join(root,'form-evidence');await mkdir(out,{recursive:true});
const sourceOrigin=new URL(JSON.parse(await readFile(path.join(root,'captured-model.json'),'utf8')).source).origin,routes=process.argv.slice(3).length?process.argv.slice(3):['/contact/','/quote/'];
const server=await serveStatic(path.join(root,'project/output')),browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 for(const route of routes)for(const [name,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  const shots=[],measures=[],controls=[];
  for(const [side,origin]of [['source',sourceOrigin],['rebuilt',server.url]]){
   const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});
   await page.route('**/*',route=>['GET','HEAD'].includes(route.request().method())?route.continue():route.abort());
   const response=await page.goto(origin+route,{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await revealLazyContent(page);
   shots.push(await page.screenshot({path:path.join(out,route.split('/')[1]+'-'+side+'-'+name+'.png'),fullPage:true,animations:'disabled'}));measures.push(await measure(page));controls.push(await page.locator('form input:not([type=hidden]):not([type=search]),form textarea,form select').evaluateAll(elements=>elements.map(el=>{const r=el.getBoundingClientRect();return {name:el.name,width:r.width,height:r.height,x:r.x,y:r.y,disabled:el.disabled};})));
   if(response.status()!==200)throw Error('HTTP '+response.status());await page.close();
  }
  let pixelSimilarity=null,comparisonError=null;try{pixelSimilarity=visualScore(...shots);}catch(error){comparisonError=error.message;}
  results.push({route,viewport:name,pixelSimilarity,comparisonError,layoutSimilarity:layoutScore(...measures),controls});
 }
 await writeFile(path.join(root,'forms-visual.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({controls,...r})=>r)));
}finally{await browser.close();await server.close();}
