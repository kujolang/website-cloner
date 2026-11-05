import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {chromium} from 'playwright';
const root=path.resolve(process.argv[2]||'work/uae'),record=JSON.parse(await readFile(path.join(root,'ultimate-chrome-records.json'))),browser=await chromium.launch({channel:'chrome'}),checks=[];
try{for(const entry of record.pages)for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});page.setDefaultTimeout(8000);await page.goto(entry.url,{waitUntil:'networkidle'});
 const header=page.locator('header').filter({has:page.locator('[data-elementor-id="'+record.templates.header+'"]')}),footer=page.locator('footer').filter({has:page.locator('[data-elementor-id="'+record.templates.footer+'"]')});
 assert.equal(await header.count(),1);assert.equal(await footer.count(),1);assert.match(await header.innerText(),/Workshop Collective/);assert.match(await footer.innerText(),/Shared workshop footer/);
 const file='chrome-'+entry.id+'-'+width+'.png';await page.screenshot({path:path.join(root,file),fullPage:true,animations:'disabled'});
 const widget=header.locator('.elementor-widget-navigation-menu'),toggle=widget.locator('.hfe-nav-menu__toggle'),button=widget.locator('.hfe-has-submenu-container').first(),panel=widget.locator('.sub-menu').first();
 if(await toggle.isVisible())await toggle.click();if(width===1440)await button.hover();else await button.click();await page.waitForFunction(()=>{const p=document.querySelector('header .sub-menu');return p&&getComputedStyle(p).visibility==='visible'&&Number(getComputedStyle(p).opacity)>0;});assert.ok(await panel.isVisible());
 checks.push({url:entry.url,width,header:true,footer:true,menuOpened:true,screenshot:file});await page.close();
}await writeFile(path.join(root,'ultimate-chrome-source-check.json'),JSON.stringify(checks,null,2));console.log(JSON.stringify(checks));}finally{await browser.close();}
