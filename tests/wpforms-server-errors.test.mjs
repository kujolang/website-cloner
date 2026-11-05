import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {chromium} from 'playwright';
import {load} from 'cheerio';
import {extract} from '../engine/extract.mjs';
import {applyForms} from '../scripts/form-export.mjs';

test('WPForms exports select provider error styling only when configured',()=>{
 const html='<main><div class="wpforms-container"><form class="wpforms-form" id="contact"><input type="email" name="email"><button>Send</button></form></div></main>';
 const model=extract(html,'https://example.test/'),contract=model.sourceForms[0];assert.equal(contract.provider,'wpforms');
 let $=load(html);applyForms($,model,[contract]);assert.equal($('form').attr('data-cloner-delivery'),undefined);
 contract.delivery={endpoint:'/send',format:'json'};$=load(html);applyForms($,model,[contract]);assert.equal(JSON.parse($('form').attr('data-cloner-delivery')).feedback,'wpforms');
});

test('WPForms service errors retain styled accessible grouped feedback and recover',async()=>{
 const runtime=await readFile(new URL('../scripts/component-forms.js',import.meta.url),'utf8');let accepted=false,posts=0;
 const server=createServer(async(req,res)=>{if(req.method==='POST'){for await(const chunk of req){}posts++;res.writeHead(accepted?200:422,{'Content-Type':'application/json'});res.end(JSON.stringify(accepted?{ok:true}:{ok:false,errors:{email:'<b>Use another address</b>',topics:'Choose another topic'}}));return;}
 res.setHeader('Content-Type','text/html');res.end(`<div class="wpforms-render-modern"><form data-cloner-delivery='{"endpoint":"/send","format":"json","feedback":"wpforms"}'><div class="wpforms-field"><label for="email">Email</label><p id="hint">Help</p><input id="email" name="email" type="email" value="fixture@example.test" aria-describedby="hint"></div><div class="wpforms-field" id="group"><ul><li><label><input type="checkbox" name="topics" value="a">A</label></li><li><label><input type="checkbox" name="topics" value="b">B</label></li></ul></div><button>Send</button><button type="reset">Reset</button></form></div><script>${runtime}</script>`);});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const browser=await chromium.launch({channel:'chrome'});
 try{for(const width of [1440,390]){accepted=false;const page=await browser.newPage({viewport:{width,height:844}});await page.goto('http://127.0.0.1:'+server.address().port);await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForSelector('em.wpforms-error');assert.equal(await page.locator('em.wpforms-error').count(),2);assert.equal(await page.locator('em.wpforms-error b').count(),0);assert.equal(await page.locator('#group > em.wpforms-error').count(),1);assert.equal(await page.locator('#email').evaluate(e=>e===document.activeElement),true);assert.equal(await page.locator('#email').getAttribute('aria-invalid'),'true');assert.equal(await page.locator('#email').evaluate(e=>e.classList.contains('wpforms-error')),true);
 const ids=await page.locator('[name=topics]').evaluateAll(es=>es.map(e=>e.getAttribute('aria-describedby')));assert.equal(ids[0],ids[1]);assert.ok(ids[0]);await page.locator('#email').fill('other@example.test');assert.equal(await page.locator('#email').getAttribute('aria-describedby'),'hint');assert.equal(await page.locator('#email').getAttribute('aria-invalid'),null);await page.getByRole('button',{name:'Reset',exact:true}).click();assert.equal(await page.locator('em.wpforms-error').count(),0);accepted=true;await page.getByRole('button',{name:'Send',exact:true}).click();await page.waitForFunction(()=>document.querySelector('[role=status]').textContent.includes('accepted'));await page.close();}assert.equal(posts,4);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
});
