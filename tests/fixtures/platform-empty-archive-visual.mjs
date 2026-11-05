import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,copyFile}from'node:fs/promises';
import {execFileSync}from'node:child_process';
import {chromium}from'playwright';
import {serveStatic}from'../../engine/static.mjs';
import {stableScreenshot}from'../../engine/capture-stability.mjs';
import {visualScore}from'../../engine/verify.mjs';
import {parseContent,YAML}from'../../scripts/source-project.mjs';
import {run}from'../../engine/pipeline.mjs';
const root=path.resolve('artifacts/platform/woocommerce-complete'),project=path.join(root,'project'),source='http://127.0.0.1:9427',file=path.join(project,'content/wp-product/product-studio-mug.md'),before=await readFile(file,'utf8');
const php=code=>execFileSync('php',['-r',"$_SERVER['HTTP_HOST']='127.0.0.1:9427';require $argv[1].'/wp-load.php';"+code,path.resolve('work/woo/wordpress')],{encoding:'utf8',env:{...process.env,FIXTURE_DB_HOST:'localhost:'+path.resolve('work/woo/mysql.sock'),FIXTURE_DB_DIR:path.resolve('work/woo/databases')}}).trim();
let browser,server,sourceTerms;
try{
 sourceTerms=JSON.parse(php("echo json_encode(wp_get_object_terms(20,'product_cat',['fields'=>'ids']));"));assert.ok(Array.isArray(sourceTerms));
 php("$r=wp_set_object_terms(20,[17],'product_cat');if(is_wp_error($r))throw new Exception($r->get_error_message());wc_delete_product_transients(20);");
 const parsed=parseContent(before,file);parsed.meta.taxonomies.wpproductcat4b55febb=[17];await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body);
 const generator=await readFile('engine/generate.mjs','utf8');for(const match of generator.matchAll(/\["(scripts\/[^"\n]+|vendor\/export-source\.mjs)", "([^"\n]+)"\]/g))await copyFile(path.resolve(match[1]),path.join(project,match[2]));
 await run(process.execPath,['scripts/build.mjs'],{cwd:project,timeout:120000});server=await serveStatic(path.join(project,'output'));browser=await chromium.launch({channel:'chrome'});
 const comparisons=[];
 for(const width of [1440,390]){
  const states=[];
  for(const kind of ['source','export']){
   const origin=kind==='source'?source:server.url,page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});const rejected=[];
   await page.route('**/*',r=>{if(r.request().method()!=='GET'||new URL(r.request().url()).origin!==origin){rejected.push(r.request().url());return r.abort();}return r.continue();});
   const response=await page.goto(origin+'/product-category/uncategorized/',{waitUntil:'networkidle'});assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);
   const measurements=await page.evaluate(()=>{const rect=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,text:e.textContent.trim()};};return{grid:rect('ul.products'),card:rect('li.product'),count:rect('.woocommerce-result-count'),sort:rect('.woocommerce-ordering'),title:rect('h1'),height:document.documentElement.scrollHeight};});
   const shot=await stableScreenshot(page,{fullPage:true,animations:'disabled'});await writeFile(path.join(root,`empty-archive-${kind}-${width}.png`),shot.buffer);states.push({kind,measurements,rejected,buffer:shot.buffer});await page.close();
  }
  let pixelSimilarity=null,comparisonIssue;try{pixelSimilarity=visualScore(states[0].buffer,states[1].buffer);}catch(error){comparisonIssue=error.message;}
  comparisons.push({width,pixelSimilarity,comparisonIssue,states:states.map(({buffer,...s})=>s)});
 }
 const report={scope:'Owned WooCommerce empty category populated through native membership; full-page desktop/mobile source comparison',comparisons,aiCalls:0};await writeFile(path.join(root,'empty-archive-visual-check.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));for(const c of comparisons)assert.deepEqual(c.states[1].measurements,c.states[0].measurements,'archive geometry and controls must follow source at '+c.width);
}finally{await browser?.close();await server?.close();if(sourceTerms)php("wp_set_object_terms(20,"+JSON.stringify(sourceTerms)+",'product_cat');wc_delete_product_transients(20);");await writeFile(file,before);await run(process.execPath,['scripts/build.mjs'],{cwd:project,timeout:120000});}
