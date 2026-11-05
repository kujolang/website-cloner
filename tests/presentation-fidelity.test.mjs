import test from 'node:test';
import assert from 'node:assert/strict';
import {clean} from '../engine/extract.mjs';
import {sanitizeSvg} from '../engine/svg.mjs';
import {chromium} from 'playwright';
test('multiline SVG paths and reusable symbols retain geometry and accessible names',()=>{
 const source='<svg viewBox="0 0 10 10" aria-labelledby="label"><title id="label">Shape</title><defs><symbol id="shape" viewBox="0 0 10 10"><path d="M0,0\n\tL10,0\rL10,10Z"/></symbol></defs><use href="#shape"/><use href="https://evil.test/a.svg#x"/><path onclick="bad()" d="M0 0 L1 1"/></svg>';
 for(const result of [clean(source),sanitizeSvg(source)]){assert.match(result,/d="M0,0  L10,0 L10,10Z"/);assert.match(result,/<symbol/);assert.match(result,/aria-labelledby="label"/);assert.match(result,/href="#shape"/);assert.doesNotMatch(result,/evil|onclick/);}
});
test('sanitized positioning, clipping and responsive text preserve geometry on desktop and phone',async()=>{
 const html='<style>main{position:relative;width:100%;height:300px}.card{width:50%}@media(max-width:600px){.card{width:100%}}</style><main><center><div style="width:80px">Legacy center</div></center><div class="card" style="position:absolute;right:0;top:24px;transform:translateY(8px);white-space:nowrap;border-top:2px solid grey">Card text</div><div id="offscreen" style="position:absolute;top:-10000px;left:0;right:0;opacity:0">Hidden widget</div><span style="display:initial;font-style:italic;text-transform:uppercase">label</span></main>';
 const b=await chromium.launch({channel:'chrome'});try{for(const width of [1440,390]){
 const p=await b.newPage({viewport:{width,height:844}});const measure=()=>p.evaluate(()=>[...document.querySelectorAll('main *')].map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return [r.x,r.y,r.width,r.height,s.opacity,s.whiteSpace,s.fontStyle,s.textTransform]}));
 await p.setContent(html);const before=await measure();await p.setContent(html.slice(0,html.indexOf('</style>')+8)+clean(html.slice(html.indexOf('</style>')+8)));assert.deepEqual(await measure(),before);assert.ok(await p.locator('#offscreen').evaluate(e=>e.getBoundingClientRect().bottom<0));await p.close();
 }}finally{await b.close();}
 assert.doesNotMatch(clean('<div style="top:expression(alert(1));clip:url(https://evil.test);opacity:expression(x)">X</div>'),/expression|evil/);
});

test('inline background images enter checked localization without losing crop rules',async()=>{
 const {extract}=await import('../engine/extract.mjs');const {localize}=await import('../engine/assets.mjs');const {mkdtemp,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');
 const p=extract('<main><p>Photo</p><div style="background-image:url(/photo.png);background-size:cover;background-position:center"></div><div style="background-image:url(javascript:evil)"></div></main>','https://example.com/');
 assert.match(p.content,/data-background-image="https:\/\/example.com\/photo.png"/);assert.match(p.content,/background-size:cover/);assert.doesNotMatch(p.content,/javascript/);
 const dir=await mkdtemp(tmpdir()+'/background-proof-');try{const seen=[];await localize({source:p.url,pages:[p],media:[],warnings:[],metrics:{}},{get:async u=>{seen.push(u);return{status:200,headers:{'content-type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64')}}},dir);assert.deepEqual(seen,['https://example.com/photo.png']);assert.match(p.content,/background-image:url\(/);assert.doesNotMatch(p.content,/https:\/\/example.com/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('verification initializes below-fold lazy images before full-page evidence',async()=>{
 const {revealLazyContent}=await import('../engine/capture.mjs');const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage({viewport:{width:390,height:844}});let loaded=false;
 await p.route('https://fixture.example/**',async route=>{loaded=true;await route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="red"/></svg>'});});
 await p.setContent('<main style="height:9000px">Top</main><img loading="lazy" src="https://fixture.example/badge.svg" width="100" height="100">');assert.equal(loaded,false);await revealLazyContent(p);assert.equal(loaded,true);assert.equal(await p.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0),true);assert.equal(await p.evaluate(()=>scrollY),0);
 }finally{await b.close();}
});


test('SVG colour tokens remain source-coloured without permitting external paint servers',()=>{
 const svg='<svg style="fill:var(--color_1);stroke:var(--stroke, #fff)"><path d="M0 0L1 1"/></svg>';
 for(const html of [clean(svg),sanitizeSvg(svg)]){assert.match(html,/fill:var\(--color_1\)/);assert.match(html,/stroke:var\(--stroke, #fff\)/);}
 assert.doesNotMatch(clean('<svg style="fill:var(--bad,url(https://evil.test))"></svg>'),/evil/);
});

test('disabled-form notice stays accessible without changing desktop or mobile row geometry',async()=>{
 const{extract}=await import('../engine/extract.mjs');const{readFile}=await import('node:fs/promises');const css=await readFile(new URL('../vendor/migration-search.css',import.meta.url),'utf8');
 const html='<main><div style="display:flex;align-items:center"><h1>Headline</h1><form><input placeholder="Name"><button>Send</button></form></div></main>';const b=await chromium.launch({channel:'chrome'});try{for(const width of[1440,390]){const p=await b.newPage({viewport:{width,height:844}});await p.setContent(html);const before=await p.locator('h1').boundingBox();const model=extract(html,'https://example.com/');await p.setContent('<style>'+css+'</style>'+model.shell.replace('MIGRATION_CONTENT_SLOT_7c3e',model.content));assert.deepEqual(await p.locator('h1').boundingBox(),before);const form=p.locator('form');assert.match(await form.getAttribute('title'),/unavailable/);assert.match(await form.getAttribute('aria-description'),/replacement submission/);assert.equal(await form.locator(':scope > *').count(),2);assert.equal(await p.locator('button').isDisabled(),true);await p.close();}}finally{await b.close();}
});

test('inert legacy layout attributes keep source CSS selectors working without preserving execution',async()=>{
 const html='<div dmtemplateid="Hamburger" layout-main="row" has-shadow="true" onclick="alert(1)"><div class="panel">Content</div></div>';
 const result=clean(html);assert.match(result,/dmtemplateid="Hamburger"/);assert.match(result,/layout-main="row"/);assert.match(result,/has-shadow="true"/);assert.doesNotMatch(result,/onclick/);
 const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage();await p.setContent('<style>.panel{position:relative}[dmtemplateid*=amburger] .panel{position:static}[layout-main=row]{padding-top:93px}[has-shadow=true]{border-radius:12px}</style>'+result);assert.equal(await p.locator('.panel').evaluate(e=>getComputedStyle(e).position),'static');assert.equal(await p.locator('[layout-main]').evaluate(e=>getComputedStyle(e).paddingTop),'93px');assert.equal(await p.locator('[has-shadow]').evaluate(e=>getComputedStyle(e).borderRadius),'12px');}finally{await b.close();}
});

test('captured form paint survives disabling without changing the source or enabling submission',async()=>{
 const {renderedDocument}=await import('../engine/form-appearance.mjs');const{extract}=await import('../engine/extract.mjs');
 const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage();await p.setContent('<style>input,textarea,select,button{color:rgb(23,45,67);background-color:rgb(249,248,247);border-color:rgb(12,34,56);opacity:.9}</style><main><form action="/submit" method="post"><input placeholder="Name"><textarea></textarea><select><option>Choose</option></select><button>Send</button><input disabled></form><form role="search"><input type="search"></form></main>');const before=await p.content();const paint=()=>p.locator('form:first-child input:not([type=search])').first().evaluate(e=>{const s=getComputedStyle(e);return[s.color,s.backgroundColor,s.borderTopColor,s.opacity];});const expected=await paint();const snapshot=await renderedDocument(p);assert.equal(await p.content(),before);const model=extract(snapshot,'https://example.test/');await p.setContent(model.shell.replace('MIGRATION_CONTENT_SLOT_7c3e',model.content));assert.deepEqual(await paint(),expected);assert.equal(await p.locator('form').first().getAttribute('action'),null);assert.equal(await p.locator('form').first().locator('input').first().isDisabled(),true);assert.equal(await p.locator('input[type=search]').getAttribute('style'),null);}finally{await b.close();}
});


test('rendered file control paint does not add a border to a borderless source field',async()=>{
 const {renderedDocument}=await import('../engine/form-appearance.mjs');const{extract}=await import('../engine/extract.mjs');const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage();await p.setContent('<style>input{border:3px solid black}input[type=file]{border:none}</style><main><form method="post"><input type="file"></form></main>');const snapshot=await renderedDocument(p),model=extract(snapshot,'https://example.test/');await p.setContent('<style>input{border:3px solid black}</style>'+model.content);assert.equal(await p.locator('input').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px');}finally{await b.close();}
});

test('inert choice controls retain captured pseudo paint without freezing configured checked states',async()=>{
 const {renderedDocument}=await import('../engine/form-appearance.mjs'),{extract}=await import('../engine/extract.mjs'),{applyForms}=await import('../scripts/form-export.mjs'),{load}=await import('cheerio');const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage();const css='input::after{content:"✓";opacity:0}input:checked::after{opacity:1}input:disabled::after{opacity:.5!important}';await p.setContent('<style>'+css+'</style><main><form method="post"><input type="checkbox" name="choice"><button>Send</button></form></main>');const model=extract(await renderedDocument(p),'https://example.test/'),$=load('<html><head><style>'+css+'</style></head><body>'+model.content+'</body></html>');applyForms($,model,model.sourceForms);await p.setContent($.html());assert.equal(await p.locator('input').evaluate(e=>getComputedStyle(e,'::after').opacity),'0');model.sourceForms[0].delivery={endpoint:'/deliver'};applyForms($,model,model.sourceForms);await p.setContent($.html());await p.locator('input').check();assert.equal(await p.locator('input').evaluate(e=>getComputedStyle(e,'::after').opacity),'1');}finally{await b.close();}
});

test('layout measurements match rendered text rather than inline script or hidden metadata',async()=>{
 const {measure}=await import('../engine/capture.mjs');const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage();await p.setContent('<main><script type="application/json">{"source":"metadata"}</script><span hidden>Hidden metadata</span><h1>Visible heading</h1><p>Visible text.</p></main>');const source=await measure(p);await p.setContent('<main><migration-script hidden></migration-script><h1>Visible heading</h1><p>Visible text.</p></main>');const rebuilt=await measure(p);assert.equal(source.elements.find(e=>e.tag==='MAIN').text,'Visible heading Visible text.');assert.equal(source.elements.find(e=>e.tag==='MAIN').text,rebuilt.elements.find(e=>e.tag==='MAIN').text);}finally{await b.close();}
});


test('physical border longhands retain block section geometry and source colours',async()=>{
 const css='<style>:root{--edge:#adadad}section{border-style:solid;border-width:0;padding:30px}section + section{margin-top:20px}</style>';
 const html='<section style="border-top-width:1px;border-top-color:var(--edge);border-right-width:2px;border-right-color:red;border-bottom-width:3px;border-bottom-color:blue;border-left-width:4px;border-left-color:green">Section</section><section>Following section</section>';
 const browser=await chromium.launch({channel:'chrome'});try{for(const width of [1440,390]){const page=await browser.newPage({viewport:{width,height:900}});const measure=()=>page.locator('section').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {x:r.x,y:r.y,width:r.width,height:r.height,borders:['Top','Right','Bottom','Left'].map(side=>[s['border'+side+'Width'],s['border'+side+'Color']])};}));await page.setContent(css+html);const before=await measure();await page.setContent(css+clean(html));assert.deepEqual(await measure(),before);await page.close();}}finally{await browser.close();}
 assert.doesNotMatch(clean('<div style="border-top-color:url(https://evil.test);border-left-width:expression(alert(1));border-bottom-color:var(--x,url(https://evil.test))">X</div>'),/evil|expression/);
});

test('configured controls restore proven capture paint while preserving authored styles and later edits',async()=>{
 const {renderedDocument}=await import('../engine/form-appearance.mjs'),{extract}=await import('../engine/extract.mjs'),{applyForms}=await import('../scripts/form-export.mjs'),{load}=await import('cheerio');const b=await chromium.launch({channel:'chrome'});
 try{const p=await b.newPage();const css='input{border:1px solid gray}input.error{border-color:red}input:disabled{color:gray}';await p.setContent('<style>'+css+'</style><main><form id="paint" method="post"><input id="normal" name="normal"><input id="authored" name="authored" style="border-color:green!important"><input id="edited" name="edited"><button>Send</button></form></main>');const model=extract(await renderedDocument(p),'https://example.test/'),$=load('<html><head><style>'+css+'</style></head><body>'+model.content+'</body></html>');const paint=JSON.parse($('#normal').attr('data-migration-control-paint'));assert.equal(paint['border-top-color'].value,'');applyForms($,model,model.sourceForms);assert.ok($('#normal').attr('data-migration-control-paint'));$('#edited').css('border-top-color','blue');model.sourceForms[0].delivery={endpoint:'/deliver'};applyForms($,model,model.sourceForms);$('input').addClass('error');const {readFile}=await import('node:fs/promises');const runtime=await readFile(new URL('../scripts/component-forms.js',import.meta.url),'utf8');await p.setContent($.html()+'<script>'+runtime+'</script>');assert.equal(await p.locator('#normal').evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(255, 0, 0)');assert.equal(await p.locator('#authored').evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(0, 128, 0)');assert.equal(await p.locator('#edited').evaluate(e=>getComputedStyle(e).borderTopColor),'rgb(0, 0, 255)');
 }finally{await b.close();}
});
