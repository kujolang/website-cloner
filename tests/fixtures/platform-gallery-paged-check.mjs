import assert from 'node:assert/strict';import {mkdir,writeFile} from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';import {serveStatic} from '../../engine/static.mjs';import {visualScore,layoutScore} from '../../engine/verify.mjs';import {measure} from '../../engine/capture.mjs';
const root=path.resolve(process.argv[2]||'artifacts/platform/essential-paged'),out=path.join(root,'paged-evidence');await mkdir(out,{recursive:true});const server=await serveStatic(path.join(root,'project/output')),browser=await chromium.launch({channel:'chrome'}),results=[];
try{
 for(const [viewport,width,height]of [['desktop',1440,1000],['mobile',390,844]]){
  const shots={};for(const [side,origin]of [['source','http://127.0.0.1:9431'],['rebuilt',server.url]]){
   for(const scenario of ['more','category','search']){
    const page=await browser.newPage({viewport:{width,height},reducedMotion:'no-preference'});await page.route('**/*',r=>['GET','HEAD'].includes(r.request().method())&&(new URL(r.request().url()).origin===origin||(side==='source'&&['fonts.googleapis.com','fonts.gstatic.com'].includes(new URL(r.request().url()).hostname)))?r.continue():r.abort());await page.goto(origin+'/paged-gallery/',{waitUntil:'networkidle'});await page.evaluate(()=>document.fonts.ready);await page.waitForTimeout(600);
    const cards=page.locator('.eael-filterable-gallery-item-wrap'),controls=page.locator('.eael-filter-gallery-wrapper [data-filter]');
    async function shot(state,expected){await page.waitForFunction(n=>[...document.querySelectorAll('.eael-filterable-gallery-item-wrap')].filter(e=>getComputedStyle(e).display!=='none'&&e.getBoundingClientRect().height>0).length===n,expected,{timeout:10000});await page.waitForTimeout(1800);await page.evaluate(()=>scrollTo(0,0));(shots[state]??=[]).push({image:await page.screenshot({path:path.join(out,`${side}-${viewport}-${state}.png`),fullPage:true,animations:'disabled'}),layout:await measure(page),titles:await cards.evaluateAll(es=>es.filter(e=>getComputedStyle(e).display!=='none').map(e=>e.querySelector('h2,h3,h4')?.textContent?.trim()||e.textContent.trim()))});}
    async function filter(i){if(!await controls.nth(i).isVisible())await page.locator('#fg-filter-trigger').click();await controls.nth(i).click();}
    if(scenario==='more'){await shot('initial',2);await page.locator('.eael-gallery-load-more').click();await shot('more',4);}
    if(scenario==='category'){await filter(2);await shot('lighting',2);await filter(0);await shot('all-three',3);await page.locator('.eael-gallery-load-more').click();await shot('category-more',4);}
    if(scenario==='search'){await page.locator('[name="fg-frontend-search"]').fill('Pendant');await shot('search-unloaded',1);await page.locator('[name="fg-frontend-search"]').fill('');await shot('search-reset',4);}
    await page.close();
   }
  }
  for(const[state,[a,b]]of Object.entries(shots)){assert.deepEqual(b.titles,a.titles,state+' ordered titles');const result={viewport,state,pixel:visualScore(a.image,b.image),layout:layoutScore(a.layout,b.layout)};results.push(result);assert.ok(result.pixel>=.99&&result.layout>=.99,JSON.stringify(result));}
 }
 await writeFile(path.join(root,'paged-check.json'),JSON.stringify({plugin:'Essential Addons 6.8.7',results,scope:'Owned four-card layout_3 fixture: initial batch, load more, category-first ordering and full-gallery search; no source transition parity.'},null,2));console.log(JSON.stringify(results));
}finally{await browser.close();await server.close();}
