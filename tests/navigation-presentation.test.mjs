import test from 'node:test';import assert from 'node:assert/strict';import {chromium} from 'playwright';import {load} from 'cheerio';
test('contrast repair preserves a large decorative initial on zero-size text',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{
  const page=await browser.newPage();
  await page.setContent(`<html data-migration-contrast="repair"><style>body{background:white}h1{font-size:0;color:#f86368}h1::first-letter{font-size:300px}</style><h1>Security</h1><script>${navigationRuntime}</script>`);
  assert.equal(await page.locator('h1').getAttribute('data-migration-contrast-adjusted'),null);
  assert.equal(await page.locator('h1').evaluate(e=>getComputedStyle(e).color),'rgb(248, 99, 104)');
 }finally{await browser.close();}
});
import {clean} from '../engine/extract.mjs';import {restorePresentation} from '../engine/presentation.mjs';import {semanticExport} from '../scripts/semantic-export.mjs';import {navigationRuntime,navigationHash} from '../engine/navigation.mjs';
test('safe presentation survives sanitizing; executable styles do not',()=>{const html=clean('<div style="border-top-left-radius:20px;background:linear-gradient(180deg,rgb(0,8,37) 0%,rgb(15,24,72) 100%);box-shadow:var(--shadow);background-image:url(javascript:bad)">x</div>');assert.match(html,/border-top-left-radius:20px/);assert.match(html,/linear-gradient/);assert.doesNotMatch(html,/javascript|background-image/);const p={content:'<div class="card" style="padding:10px">Saved content</div>'};assert.equal(restorePresentation(p,'<div class="card" style="padding:10px;border-top-left-radius:20px">Saved content</div>'),1);assert.match(p.content,/radius:20px/);assert.equal(restorePresentation(p,'<div class="card" style="padding:5px">New unrelated content</div>'),0);});
test('semantic export names empty links, keeps hidden overlays out of tab order and demotes secondary headings',()=>{const $=load('<main><h1>A</h1><h1>B</h1><a href="/b/"></a><a href="/b/" aria-hidden="true"> </a></main>');semanticExport($,new Map([['/b/','B']]));assert.equal($('h1').length,1);assert.equal($('[aria-level=2]').text(),'B');assert.equal($('a').first().attr('aria-label'),'B');assert.equal($('a').last().attr('tabindex'),'-1');});
test('local navigation works with CSP, keyboard escape and mobile focus return',async()=>{const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage();await p.setContent(`<meta http-equiv="Content-Security-Policy" content="script-src '${navigationHash}'"><style>nav ul ul{display:flex}</style><p id="contrast" style="color:rgb(33,165,0);background:rgb(230,255,224)">Low contrast text</p><nav><button class="wp-block-navigation__responsive-container-open">Open</button><div class="wp-block-navigation__responsive-container"><button class="wp-block-navigation__responsive-container-close">Close</button><ul><li><button class="wp-block-navigation-submenu__toggle">Services</button><ul><li><a href="#x">X</a></li></ul></li></ul></div></nav><script>${navigationRuntime}</script>`);const t=p.locator('.wp-block-navigation-submenu__toggle');assert.equal(await t.getAttribute('aria-expanded'),'false');assert.equal(await p.locator('nav ul ul').isVisible(),false);assert.equal(await p.locator('#contrast').getAttribute('data-migration-contrast-adjusted'),null);await t.click();assert.equal(await p.locator('nav ul ul').isVisible(),true);assert.equal(await t.getAttribute('aria-expanded'),'true');await p.keyboard.press('Escape');assert.equal(await t.getAttribute('aria-expanded'),'false');await p.locator('.wp-block-navigation__responsive-container-open').click();assert.equal(await p.locator('[aria-modal=true]').count(),1);await p.keyboard.press('Escape');assert.equal(await p.locator('[aria-modal=true]').count(),0);}finally{await b.close();}});
test('heading normalization rewrites selectors without changing CSS values or URLs',async()=>{const {headingCSS}=await import('../engine/semantic-css.mjs');const css=headingCSS('h1, main > h1.title { background:url(/h1/banner.png); --label:h1; font-size:3rem }');assert.match(css,/:is\(h1,div:where/);assert.match(css,/url\(\/h1\/banner.png\)/);assert.match(css,/--label:h1/);});
test('query pagination receives unique metadata while its captured static route stays fixed',async()=>{
 const {generate}=await import('../engine/generate.mjs'),{extract}=await import('../engine/extract.mjs'),{mkdtemp,readFile,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),path=await import('node:path');
 const dir=await mkdtemp(path.join(tmpdir(),'query-seo-'));try{const source='https://example.org/',p={...extract('<html><head><title>News</title><meta name="description" content="Updates "></head><body><main><h1>News</h1></main></body></html>',source+'news/?query-2-page=3'),styles:[]},route=p.route;await generate({source,identity:{title:'News'},navigation:[],pages:[p],media:[],warnings:[],metrics:{},design:{text:'#111',background:'#fff',accent:'#222',spacing:24,contentWidth:1000,navigation:'source'}},dir);const {default:YAML}=await import('yaml');const meta=YAML.parse((await readFile(path.join(dir,'content/pages/'+JSON.parse(await readFile(path.join(dir,'routes.json')))[0].slug+'.md'),'utf8')).split('---')[1]);assert.equal(meta.title,'News');assert.equal(meta.seo_title,'News — Page 3');assert.equal(meta.description,'Updates Page 3.');assert.equal(p.route,route);}finally{await rm(dir,{recursive:true,force:true});}
});

test('source colour fidelity is default and contrast repair requires explicit opt-in',async()=>{
 const browser=await chromium.launch({channel:'chrome'});try{
  const context=await browser.newContext();
  const page=await context.newPage();
  const markup=mode=>`<html ${mode?'data-migration-contrast="repair"':''}><body style="background:#8f7c7c"><a href="#" style="color:rgb(30,115,190)">Source link</a><p style="color:#666">Source description</p><script>${navigationRuntime}</script></body></html>`;
  await page.setContent(markup(false));
  assert.equal(await page.locator('a').evaluate(e=>getComputedStyle(e).color),'rgb(30, 115, 190)');
  assert.equal(await page.locator('p').evaluate(e=>getComputedStyle(e).color),'rgb(102, 102, 102)');
  assert.equal(await page.locator('[data-migration-contrast-adjusted]').count(),0);
  const {default:AxeBuilder}=await import('@axe-core/playwright');
  const audit=await new AxeBuilder({page}).withRules(['color-contrast']).analyze();
  assert.ok(audit.violations.some(v=>v.id==='color-contrast'),'preserving colours must not hide contrast failures from the audit');
  await page.setContent(markup(true));
  assert.equal(await page.locator('a').getAttribute('data-migration-contrast-adjusted'),'true');
  assert.notEqual(await page.locator('a').evaluate(e=>getComputedStyle(e).color),'rgb(30, 115, 190)');
 }finally{await browser.close();}
});
test('page-builder main landmarks and heading levels preserve source elements',()=>{
 const $=load('<body><div data-elementor-type="wp-post"><h1>Title</h1><h4 class="lead">Introduction</h4><h6>Detail</h6><h2>Next section</h2><div role="region" aria-label="Carousel"></div><div role="region" aria-label="Carousel"></div><h5 aria-level="4">Author level</h5></div></body>');semanticExport($);
 assert.equal($('[data-elementor-type]').attr('role'),'main');assert.equal($('h4.lead').attr('aria-level'),'2');assert.equal($('h6').attr('aria-level'),'3');assert.equal($('h2').attr('aria-level'),undefined);assert.equal($('h5').attr('aria-level'),'4');assert.deepEqual($('[role=region]').map((_,e)=>$(e).attr('aria-label')).get(),['Carousel 1','Carousel 2']);semanticExport($);assert.equal($('[role=main]').length,1);
});
test('archive landmarks repair missing skip targets and source-equivalent icon names',()=>{
 const $=load('<body><a class="skip-link" href="#content">Skip to content</a><a href="tel:123.456"> </a><a href="#popup">Schedule estimate</a><a href="#popup"><svg></svg></a><div data-elementor-type="archive"><h1>News</h1><p>Stories</p></div></body>');semanticExport($);assert.equal($('[role=main]').attr('id'),'migration-main');assert.equal($('[role=main]').attr('tabindex'),'-1');assert.equal($('.skip-link').attr('href'),'#migration-main');assert.equal($('a[href="tel:123.456"]').attr('aria-label'),'Call 123.456');assert.equal($('a[href="#popup"]').last().attr('aria-label'),'Schedule estimate');
});
test('responsive heading repair ignores hidden headings and preserves explicit source levels',async()=>{
 const {readFile}=await import('node:fs/promises');const b=await chromium.launch({channel:'chrome'});try{const p=await b.newPage({viewport:{width:390,height:844}});const $=load('<style>@media(max-width:600px){.desktop{display:none}}</style><h1>Title</h1><h3 class="desktop">Desktop section</h3><h5>Visible section</h5><h4 aria-level="4">Explicit</h4>');semanticExport($);await p.setContent($.html());await p.addScriptTag({content:await readFile(new URL('../vendor/migration-accessibility.js',import.meta.url),'utf8')});await p.waitForFunction(()=>document.querySelector('h5').getAttribute('aria-level')==='2');assert.equal(await p.locator('h4').getAttribute('aria-level'),'4');await p.setViewportSize({width:1000,height:844});await p.waitForFunction(()=>document.querySelector('h5').getAttribute('aria-level')==='3');}finally{await b.close();}
});

test('main page heading takes priority over branding and hidden headings',()=>{
 for(const root of ['main','div data-elementor-type="wp-page"']){
  const end=root.startsWith('div')?'div':'main';const $=load(`<body><header><h1 class="brand">Studio</h1></header><${root}><h1 hidden>Hidden</h1><h1 class="title">Our work</h1><h1>Another section</h1></${end}></body>`);semanticExport($);
  assert.equal($('h1').length,1);assert.equal($('h1').text(),'Our work');assert.equal($('.brand').attr('data-migration-source-heading'),'h1');assert.equal($('.brand').attr('role'),'heading');assert.equal($('.brand').attr('aria-level'),'2');assert.equal($('main,[role=main]').length,1);semanticExport($);assert.equal($('h1').text(),'Our work');
 }
});


test('main fallback excludes shared chrome while keeping article headers intact',()=>{
 for(const wrapper of ['page','content']){
  const $=load(`<body><div id="${wrapper}"><header role="banner">Brand</header><article id="post"><header><h1>Post title</h1></header><p>Content</p><footer>Author</footer></article><footer role="contentinfo">Site footer</footer></div></body>`);
  semanticExport($);assert.equal($('#'+wrapper).attr('role'),undefined);assert.equal($('#post').attr('role'),'main');assert.equal($('[role=main] [role=banner],[role=main] [role=contentinfo]').length,0);semanticExport($);assert.equal($('[role=main]').length,1);
 }
 const $=load('<div id="content"><header role="banner">Brand</header><div data-elementor-type="wp-page"><h1>Title</h1><p>Content</p></div><footer role="contentinfo">Footer</footer></div>');semanticExport($);assert.equal($('#content').attr('role'),undefined);assert.equal($('[data-elementor-type]').attr('role'),'main');
});

test('generated headings stay inside main and prefixed skip links resolve',()=>{
 for(const element of ['main','div role="main"']){
  const end=element.startsWith('div')?'div':'main';const $=load(`<body><a class="hfe-skip-link" href="#absent">Skip</a><a class="custom-skip-link" href="#existing">Valid target</a><div id="existing"></div><${element}><p>Page text</p></${end}></body>`);
  semanticExport($,new Map(),'Title <text>');assert.equal($('body > h1').length,0);assert.equal($('main,[role=main]').children().first()[0].tagName,'p');assert.equal($('main,[role=main]').find('h1').text(),'Title <text>');assert.equal($('.hfe-skip-link').attr('href'),'#migration-main');assert.equal($('.custom-skip-link').attr('href'),'#existing');assert.equal($('#migration-main').attr('tabindex'),'-1');semanticExport($,new Map(),'Title');assert.equal($('h1').length,1);
 }
});

test('synthetic headings preserve main direct-child boundaries',()=>{
 const $=load('<body><main><div class="source-content"><p>Content</p></div></main></body>');semanticExport($,new Map(),'Page title');assert.equal($('main').children().length,1);assert.equal($('.source-content > h1.migration-primary-heading').length,1);assert.equal($('.source-content').children().first()[0].tagName,'p');
});
