import {chromium} from 'playwright';
import {serveStatic} from '../../engine/static.mjs';
import {verifyNavigation} from '../../engine/verify-navigation.mjs';
import {writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const root=path.resolve(process.argv[2]||'artifacts/platform/ultimate-installed');
const server=await serveStatic(path.join(root,'project/output'));
const browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 for(const layout of ['horizontal','vertical','expandible'])for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:900}});
  page.setDefaultTimeout(5000);
  await page.goto(server.url+'/menu-'+layout+'/',{waitUntil:'networkidle'});
  const checks=(await verifyNavigation(page)).filter(result=>result.kind==='addon-navigation');
  assert.equal(checks.length,1);
  assert.equal(checks[0].status,'passed',JSON.stringify(checks));
  results.push({layout,width,checks});
  await page.close();
 }
 await writeFile(path.join(root,'ultimate-generic-navigation-check.json'),JSON.stringify(results,null,2));
 console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
