import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright';import {verifyNavigation} from '../engine/verify-navigation.mjs';
test('classic navigation supports external mobile opener and accessible sibling dropdown controls',{timeout:60000},async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'chrome'});
 try{for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
 const page=await browser.newPage({viewport});
 await page.setContent(`<style>.menu-toggle{display:none}.main-nav>ul{display:flex}li{position:relative;list-style:none}a{display:block;padding:20px}.dropdown-menu-toggle{display:inline-block;padding:0 20px}.sub-menu{display:none}.sfHover>.sub-menu,li:hover>.sub-menu{display:block}@media(max-width:600px){.menu-toggle{display:block}.main-nav>ul{display:none}.toggled .main-nav>ul{display:block}.toggled .sub-menu.toggled-on{display:block}}</style><nav class="main-navigation" id="mobile"><button class="menu-toggle" data-nav="main" aria-expanded="false">Menu</button></nav><nav class="main-navigation" id="main"><div class="main-nav"><ul><li class="menu-item-has-children"><a href="/menu/">Menu<span class="dropdown-menu-toggle">⌄</span></a><ul class="sub-menu"><li><a href="/lunch/">Lunch</a></li></ul></li></ul></div></nav>`);
 await page.addScriptTag({content:await readFile(new URL('../vendor/migration-navigation.js',import.meta.url),'utf8')});
 const results=await verifyNavigation(page);assert.ok(results.some(r=>r.kind==='classic-disclosure'));assert.ok(results.every(r=>r.status==='passed'),JSON.stringify(results));
 if(viewport.width===1440){const item=page.locator('li.menu-item-has-children'),button=page.locator('.migration-classic-toggle'),panel=page.locator('.sub-menu');await page.locator('body').click({position:{x:1000,y:500}});await item.hover();assert.equal(await button.getAttribute('aria-expanded'),'true');assert.equal(await panel.evaluate(el=>el.inert),false);await page.mouse.move(1000,500);assert.equal(await panel.isVisible(),false);await item.hover();await button.focus();await page.keyboard.press('Escape');assert.equal(await panel.isVisible(),false);assert.equal(await panel.evaluate(el=>el.inert),true);}
 if(viewport.width===390)assert.ok(results.some(r=>r.kind==='classic-responsive'));
 assert.equal(await page.locator('a button').count(),0);assert.equal(await page.locator('a[href="/menu/"]').count(),1);
 await page.close();
 }}finally{await browser.close();}
});
