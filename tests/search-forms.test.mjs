import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { extract } from '../engine/extract.mjs';
import { searchRuntime } from '../engine/search.mjs';
import { motionCSP } from '../engine/motion.mjs';
const markup = `<header><form role="search" action="https://source.test/" class="wp-block-search__searchfield-hidden" data-wp-on--submit="unsafe"><input type="search" name="s" aria-hidden="true"><button><svg viewBox="0 0 24 24"><path d="M1 1L9 9"></path></svg></button></form></header><main><div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:28px"><article>One</article><article>Two</article><article>Three</article></div><form method="post" action="https://source.test/send"><input type="hidden" value="secret"><input name="email" value="private"><button>Subscribe</button></form></main>`;
test('search icons and responsive inline grids survive while submission forms remain inert', () => {
 const p=extract(markup,'https://source.test/');
 assert.match(p.header,/data-migration-search="true"/); assert.match(p.header,/<svg/);
 assert.doesNotMatch(p.header,/action=|data-wp-/);
 assert.match(p.content,/grid-template-columns:repeat\(3, 1fr\)/);
 assert.match(p.content,/disabled/); assert.match(p.content,/replacement submission service/);
 assert.doesNotMatch(p.content,/secret|private|action=/);
});
test('local search works at root and prefixed deployment, with safe local results and retry', async () => {
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try { for(const prefix of ['', '/job-id']) {
  const page=await browser.newPage(); let requests=0, fail=true;
  await page.route('**/*',route=>{
   const u=new URL(route.request().url()); assert.equal(u.origin,'http://migration.test');
   if(u.pathname.endsWith('search-index.json')) {requests++; return route.fulfill({status:fail?503:200,contentType:'application/json',body:JSON.stringify([{route:'/story/',title:'Story',text:'Needle content'},{route:'//evil.test',title:'Evil',text:'needle'},{route:'/../escape',title:'Escape',text:'needle'}])});}
   return route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':`default-src 'none'; ${motionCSP}; connect-src 'self'; style-src 'unsafe-inline'; form-action 'none'`},body:`<meta charset="utf-8"><link rel="migration-search-index" href="${prefix}/assets/search-index.json">${extract(markup,'https://source.test/').header}<script>${searchRuntime}</script>`});
  });
  await page.goto('http://migration.test'+prefix+'/');
  assert.equal(requests,0);
  await page.locator('form button').click();
  assert.equal(await page.locator('input').getAttribute('aria-hidden'),'false');
  await page.locator('input').fill('needle'); await page.locator('input').press('Enter');
  await page.getByRole('status').filter({hasText:'could not be loaded'}).waitFor();
  await page.getByText('Close search').click(); fail=false;
  await page.locator('input').press('Enter');
  await page.getByRole('link',{name:'Story',exact:true}).waitFor();
  assert.equal(await page.getByRole('link',{name:'Story',exact:true}).getAttribute('href'),'http://migration.test'+prefix+'/story/');
  assert.equal(await page.getByRole('link',{name:'Evil',exact:true}).count(),0);
  if(prefix) assert.equal(await page.getByRole('link',{name:'Escape',exact:true}).count(),0);
  await page.close();
 }} finally {await browser.close();}
});
test('builder progress stays animated between polls and respects reduced motion', async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true});
 try {
 const page=await browser.newPage(); const html=await readFile('app/index.html','utf8'),css=await readFile('app/style.css','utf8');
 await page.setContent(html.replace(/<script[\s\S]*?<\/script>/g,'')); await page.addStyleTag({content:css});
 await page.evaluate(()=>document.querySelector('#progress').hidden=false);
 assert.equal(await page.locator('#progress [role=progressbar]').getAttribute('aria-valuenow'),null);
 assert.notEqual(await page.locator('#hosting-progress .progress-track>span').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.notEqual(await page.locator('.spinner').evaluate(e=>getComputedStyle(e).animationName),'none');
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.spinner').evaluate(e=>getComputedStyle(e).animationName),'none');
 assert.equal(await page.locator('#hosting-progress .progress-track>span').evaluate(e=>getComputedStyle(e).animationName),'none');
 for(const src of await page.locator('img.ui-icon').evaluateAll(es=>es.map(e=>e.getAttribute('src')))) assert.match(await readFile('app'+src,'utf8'),/<svg/);
 } finally {await browser.close();}
});
