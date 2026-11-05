import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';
const root=path.resolve(process.argv[2]||'work/complianz'),ready=JSON.parse(await readFile(path.join(root,'complianz-ready.json'))),origin=ready.url;
assert.equal(new URL(origin).hostname,'127.0.0.1');assert.equal(ready.authorized,true);
const browser=await chromium.launch({channel:'chrome'}),results=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(10000);
 await page.route('**/*',r=>new URL(r.request().url()).origin===origin&&['GET','HEAD'].includes(r.request().method())?r.continue():r.abort());
 assert.equal((await page.goto(origin+'/',{waitUntil:'networkidle'})).status(),200);
 const banner=page.locator('.cmplz-cookiebanner');await banner.waitFor({state:'visible'});assert.ok((await banner.innerText()).includes('Accept'));
 await banner.locator('.cmplz-view-preferences').click();assert.equal(await banner.locator('.cmplz-categories').isVisible(),true);
 await page.screenshot({path:path.join(root,'source-preferences-'+width+'.png'),fullPage:true});
 await banner.locator('.cmplz-deny').click();await banner.waitFor({state:'hidden'});await page.reload({waitUntil:'networkidle'});assert.equal(await banner.isVisible(),false);
 results.push({width,banner:true,preferences:true,reject:true,reloadPersistence:true});await page.close();
 }await writeFile(path.join(root,'source-check.json'),JSON.stringify({plugin:ready.plugins,results,externalDelivery:false},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}
