import test from 'node:test';import assert from 'node:assert/strict';import{load}from'cheerio/slim';import{semanticExport}from'../scripts/semantic-export.mjs';
test('title-only controls gain accessible labels without overriding authored labels',()=>{
 const $=load('<main><h1>Labels</h1><select id="language" title=" Choose language "><option>English</option></select><input id="query" title="Search"><textarea title="Comment"></textarea><label for="named">Your name</label><input id="named" title="Help"><label>Email<input id="email" title="Help"></label><select id="aria" title="Help" aria-label="Region"></select><input id="reference" title="Help" aria-labelledby="named"><input id="hidden" type="hidden" title="Internal"><input id="none"><input id="blank" title="   "></main>');
 semanticExport($);assert.equal($('#language').attr('aria-label'),'Choose language');assert.equal($('#query').attr('aria-label'),'Search');assert.equal($('textarea').attr('aria-label'),'Comment');
 for(const id of ['named','email','reference','hidden','none','blank'])assert.equal($('#'+id).attr('aria-label'),undefined,id);
 assert.equal($('#aria').attr('aria-label'),'Region');assert.equal($('#language').attr('title'),' Choose language ');const once=$.html();semanticExport($);assert.equal($.html(),once);
});

test('title-only language selector passes the browser label rule after semantic export',async()=>{
 const {chromium}=await import('playwright');const {default:AxeBuilder}=await import('@axe-core/playwright');const b=await chromium.launch({channel:'chrome',headless:true});try{
 const context=await b.newContext();const p=await context.newPage();const html='<main><h1>Language</h1><select title="Choose language"><option>English</option></select></main>';
 await p.setContent(html);const before=await new AxeBuilder({page:p}).withRules(['label-title-only']).analyze();assert.equal(before.violations.length,1);
 const $=load(html);semanticExport($);await p.setContent($.html());const after=await new AxeBuilder({page:p}).withRules(['label-title-only']).analyze();assert.equal(after.violations.length,0);assert.equal(await p.getByRole('combobox',{name:'Choose language'}).count(),1);
 }finally{await b.close()}
});
