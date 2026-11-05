import test from 'node:test';import assert from 'node:assert/strict';
import{mkdtemp,mkdir,readFile,rm,writeFile}from'node:fs/promises';import path from'node:path';import os from'node:os';
import{extract}from'../engine/extract.mjs';import{generate}from'../engine/generate.mjs';import{repairSavedModel}from'../engine/repair.mjs';import{writeJSON}from'../engine/json.mjs';import{run}from'../engine/pipeline.mjs';import{serveStatic}from'../engine/static.mjs';
const page=url=>extract('<html><head><title>Original title</title></head><body><main><p>Original factual introduction.</p><img src="/photo.svg"><a href="/rss">RSS</a></main></body></html>',url);
test('targeted repair uses saved assets and verifies outbound redirects without crawling pages',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-saved-'));try{
 const original=page('https://example.org/');const external={...page('https://example.org/out'),canonical:'https://other.example/landing',assetFailures:['/missing.svg']};
 await writeJSON(path.join(dir,'captured-model.json'),{pages:[original,external]});
 const model={source:'https://example.org/',pages:[{...original,assetFailures:['/photo.svg']},external],media:[{source:'https://example.org/photo.svg',path:'assets/media/123.svg',bytes:2}],warnings:[],metrics:{}};
 await mkdir(path.join(dir,'project/assets/media'),{recursive:true});await writeFile(path.join(dir,'project/assets/media/123.svg'),'<svg/>');
 let requests=0;const repaired=await repairSavedModel(model,dir,{get:async()=>{requests++;throw Error('Unexpected download');},head:async()=>({status:200,url:'https://other.example/landing'})});
 assert.equal(requests,0);assert.equal(repaired.metrics.missingImages,0);assert.match(repaired.pages[0].content,/assets\/media\/123.svg/);assert.equal(repaired.pages[1].redirectTarget,'https://other.example/landing');assert.match(repaired.pages[1].robots,/noindex/);assert.ok(JSON.parse(await readFile(path.join(dir,'repair-report.json'))).redirects.length===1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('Unicode export routes serve through decoded paths with source-derived metadata and local feeds',{timeout:60000},async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'unicode-export-'));let server;
 try{const p=page('https://example.org/story-%F0%9F%91%8B/');const model={source:'https://example.org/',identity:{title:'Site'},navigation:[],design:{text:'#111',background:'#fff',accent:'#222',spacing:24,contentWidth:1000,navigation:'source'},metrics:{},pages:[p],media:[]};
 p.content=p.content.replace(/<img[^>]*>/g,'');await generate(model,dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:50000,maxBuffer:2e6});server=await serveStatic(path.join(dir,'output'));const response=await fetch(server.url+p.route);assert.equal(response.status,200);const html=await response.text();assert.match(html,/<h1[^>]*>Original title<\/h1>/);assert.match(html,/meta name="description" content="Original factual introduction/);assert.match(html,/href="\/feed\/index.xml"/);await run(process.execPath,['scripts/site.mjs','validate'],{cwd:dir,timeout:10000,maxBuffer:2e6});
 }finally{await server?.close();await rm(dir,{recursive:true,force:true});}
});

test('discovery preserves outbound redirect routes without importing third-party page content',async()=>{
 const {discover}=await import('../engine/extract.mjs');const source='https://example.org/';
 const network={robots:new Map(),requests:0,maxRequests:100,started:Date.now(),get:async url=>url===source?{status:200,url,body:Buffer.from('<html><body><main><a href="/out">Sponsor</a></main></body></html>')}:url===source+'out'?{status:200,url:'https://sponsor.example/',body:Buffer.from('<html><body>Third party promotional copy<img src="/photo.jpg"></body></html>')}:{status:404,body:Buffer.from('')},text:async()=>''};
 const model=await discover(source,network,{maxPages:2});const page=model.pages.find(p=>p.route==='/out');assert.equal(page.redirectTarget,'https://sponsor.example/');assert.doesNotMatch(page.content,/promotional copy|photo.jpg/);assert.match(page.robots,/noindex/);
});

test('legacy WordPress outbound captures recover labeled canonical links without treating syndicated posts as redirects',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-outbound-'));try{
 const outbound={...page('https://example.org/linkout/12'),canonical:'https://sponsor.example/'};
 const syndicated={...page('https://example.org/article'),canonical:'https://publisher.example/article'};
 const model={source:'https://example.org/',pages:[outbound,syndicated],media:[],warnings:[],metrics:{}};await writeJSON(path.join(dir,'captured-model.json'),model);
 const repaired=await repairSavedModel(model,dir,{head:async()=>({status:500}),get:async()=>({status:500})});assert.equal(repaired.pages[0].redirectTarget,'https://sponsor.example/');assert.equal(repaired.pages[0].provenance.redirectVerified,false);assert.equal(repaired.pages[1].redirectTarget,undefined);assert.match(repaired.pages[1].content,/Original factual/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('redirected same-site captures resolve styles against final URL while preserving the requested route',async()=>{
 const {discover}=await import('../engine/extract.mjs');const source='https://example.org/';
 const network={robots:new Map(),requests:0,maxRequests:100,started:Date.now(),get:async url=>url===source?{status:200,url,body:Buffer.from('<html><body><a href="/old">Old</a></body></html>')}:url===source+'old'?{status:200,url:source+'new/',body:Buffer.from('<html><head><link rel="stylesheet" href="theme.css"></head><body><main>Saved article</main></body></html>')}:{status:404,body:Buffer.from('')},text:async()=>''};
 const m=await discover(source,network,{maxPages:2});const p=m.pages.find(p=>p.route==='/old');assert.equal(p.documentURL,source+'new/');assert.equal(p.styleSources[0].url,source+'new/theme.css');assert.equal(p.canonical,source+'new/');
});

test('large legitimate GIF assets use an asset budget and video sources are not counted as missing images',async()=>{
 const {localize}=await import('../engine/assets.mjs');const dir=await mkdtemp(path.join(os.tmpdir(),'repair-media-'));try{
 const p=extract('<html><body><main><img src="/large.gif"><video><source src="/movie.mp4" type="video/mp4"></video></main></body></html>','https://example.org/');const m={pages:[p],media:[],warnings:[],metrics:{}};const urls=[];await localize(m,{get:async(url,options)=>{urls.push(url);assert.equal(options.maxFile,64000000);return{status:200,headers:{'content-type':'image/gif'},body:Buffer.from('GIF89a')};}},dir);assert.deepEqual(urls,['https://example.org/large.gif']);assert.equal(m.metrics.missingImages,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('media-specific size allowance does not bypass aggregate network budgets',async()=>{
 const http=await import('node:http');const {SafeNetwork}=await import('../engine/network.mjs');const bytes=Buffer.alloc(6000000,1);const server=http.createServer((req,res)=>{if(req.url==='/robots.txt'){res.statusCode=404;return res.end();}res.setHeader('Content-Type','image/gif');res.end(bytes);});await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{const n=new SafeNetwork({fixtureOrigins:[origin]});await assert.rejects(n.get(origin+'/default'),e=>e.code==='FILE_SIZE_LIMIT');assert.equal((await n.get(origin+'/media',{maxFile:8000000})).body.length,6000000);const limited=new SafeNetwork({fixtureOrigins:[origin],maxBytes:5000000});await assert.rejects(limited.get(origin+'/media',{maxFile:8000000}),e=>e.code==='CRAWL_BUDGET');}finally{await new Promise(r=>server.close(r));}
});

test('regeneration retires obsolete generated collection records without deleting user content',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-collection-'));try{
 const p=page('https://example.org/out');p.bodyClass='single-post';const m={source:'https://example.org/',identity:{title:'Site'},navigation:[],design:{},metrics:{},pages:[p],media:[]};await generate(m,dir);await writeFile(path.join(dir,'content/posts/custom.md'),'User maintained');p.bodyClass='';await generate(m,dir);await assert.rejects(readFile(path.join(dir,'content/posts/out.md')));assert.equal(await readFile(path.join(dir,'content/posts/custom.md'),'utf8'),'User maintained');assert.match(await readFile(path.join(dir,'content/pages/out.md'),'utf8'),/Original title/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('repair redownloads a missing cached file rather than trusting a stale cache entry',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-missing-file-'));try{
 const original=page('https://example.org/');original.presentationVersion=2;original.sourceHTML=original.sourceHTML.replace('<main', '<main style="--local--columns:4;border-top-width:1px;border-top-color:var(--edge)"');original.sourceHTML=original.sourceHTML.replace('</head>','<link rel="stylesheet" data-pmdelayedstyle="/theme.css"></head>');original.styleSources=[{url:'https://example.org/undefined'}];await writeJSON(path.join(dir,'captured-model.json'),{pages:[original]});const model={source:'https://example.org/',pages:[{...original,styleSources:[{url:'https://example.org/theme.css'}],styles:['.theme{color:red}'],content:original.content.replace('/photo.svg','/assets/media/abc.svg')}],media:[{source:'https://example.org/photo.svg',path:'assets/media/abc.svg',bytes:6}],metrics:{},warnings:[]};const calls=[];
 const result=await repairSavedModel(model,dir,{text:async url=>{calls.push(url);throw Error('Cached CSS should not be fetched');},get:async url=>{calls.push(url);return{status:200,headers:{'content-type':'image/svg+xml'},body:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>')};}});assert.deepEqual(calls,['https://example.org/photo.svg']);assert.equal(result.media.length,1);assert.ok((await readFile(path.join(dir,'project',result.media[0].path))).length>0);assert.equal(JSON.parse(await readFile(path.join(dir,'repair-report.json'))).missingCachedAssets,1);assert.equal(result.pages[0].presentationVersion,extract("<main>Content</main>","https://example.org/").presentationVersion);assert.equal(result.pages[0].sourceHTML,undefined);assert.ok(JSON.parse(await readFile(path.join(dir,'captured-model.json'))).pages[0].sourceHTML);assert.match(result.pages[0].mainStyle,/--local--columns:4/);assert.match(result.pages[0].mainStyle,/border-top-width:1px/);assert.match(result.pages[0].mainStyle,/border-top-color:var\(--edge\)/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('cached rebuild without a prepared snapshot fails before network discovery',async()=>{
 const {migrate}=await import('../engine/pipeline.mjs');const dir=await mkdtemp(path.join(os.tmpdir(),'rebuild-no-snapshot-'));try{await assert.rejects(migrate('https://unreachable.invalid/',dir,{resume:true,rebuild:true}),/Cached rebuild requires a prepared snapshot/);}finally{await rm(dir,{recursive:true,force:true});}
});
test('source-only rebuild preserves optimized media over older download receipts without network',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-optimized-'));try{
  const original=page('https://example.org/');await writeJSON(path.join(dir,'captured-model.json'),{pages:[original]});
  await mkdir(path.join(dir,'project/assets/media'),{recursive:true});await writeFile(path.join(dir,'project/assets/media/abc.webp'),'saved');
  await writeJSON(path.join(dir,'asset-cache.json'),{media:[{source:'https://example.org/photo.svg',path:'assets/media/abc.png',bytes:100}]});
  const optimized={source:'https://example.org/photo.svg',path:'assets/media/abc.webp',bytes:5,optimization:'optimized'};
  const model={source:'https://example.org/',pages:[{...original,assetFailures:['https://example.org/missing.png']}],media:[optimized],metrics:{},warnings:[]};
  const result=await repairSavedModel(model,dir,{get:async()=>{throw Error('Unexpected download');}},()=>{},{retryAssets:false});
  assert.equal(result.media[0].path,optimized.path);assert.equal(result.media[0].optimization,'optimized');assert.equal(result.metrics.missingImages,1);assert.equal(JSON.parse(await readFile(path.join(dir,'repair-report.json'))).pagesRetried.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('cached rebuild retries missing CSS without recrawling or refetching successful styles',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-missing-css-'));
 try {
  const p=extract('<html><head><title>Page</title></head><body><main><p>Content</p></main></body></html>','https://example.org/');
  p.sourceHTML=p.sourceHTML.replace('</head>','<link rel="stylesheet" href="/main.css"><link rel="stylesheet" href="/ok.css"></head>');p.presentationVersion=4;p.styleSources=[{url:'https://example.org/main.css'},{url:'https://example.org/ok.css'}];p.styles=['','.ok{color:red}'];
  await writeJSON(path.join(dir,'captured-model.json'),{pages:[p]});
  const model={source:'https://example.org/',pages:[p],media:[],metrics:{},warnings:['Stylesheet https://example.org/main.css: Request timeout']},calls=[];
  await repairSavedModel(model,dir,{text:async url=>{calls.push(url);return 'main{display:grid}';},get:async()=>{throw Error('Unexpected page or asset request');}});
  assert.deepEqual(calls,['https://example.org/main.css']);
  assert.match(p.styles[0],/display:grid/);assert.equal(p.styles[1],'.ok{color:red}');
  assert.deepEqual(model.warnings,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('cached stylesheet asset recovery reuses saved CSS and media across pages',async()=>{
 const {localize}=await import('../engine/assets.mjs');
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-style-asset-'));
 try {
  const origin='https://example.org/',html='<html><head><link rel="stylesheet" href="/theme.css"></head><body><main><h1>Page</h1></main></body></html>';
  const pages=[extract(html,origin),extract(html,origin+'two/')];
  await writeJSON(path.join(dir,'captured-model.json'),{pages:structuredClone(pages)});
  const model={source:origin,pages,media:[],warnings:[],metrics:{}};
  const svg=Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"><path d="M0 0h20v20H0z"/></svg>');
  await localize(model,{text:async()=>'.missing{background:url(/missing.svg)}.good{background:url(/good.svg)}',get:async url=>({status:url.endsWith('missing.svg')?404:200,headers:{'content-type':'image/svg+xml'},body:svg})},path.join(dir,'project/assets/media'));
  assert.equal(Object.keys(model.failedStylesheets).length,1);assert.equal(model.media.length,1);
  await repairSavedModel(model,dir,{get:async()=>({status:404})});
  assert.equal(Object.keys(model.failedStylesheets).length,1,'unresolved source remains retryable');
  const calls=[];
  await repairSavedModel(model,dir,{text:async()=>{throw Error('Must reuse saved stylesheet');},get:async url=>{calls.push(url);return {status:200,headers:{'content-type':'image/svg+xml'},body:svg};}});
  assert.deepEqual(calls,[origin+'missing.svg']);assert.equal(Object.keys(model.failedStylesheets).length,0);assert.deepEqual(model.warnings,[]);
  assert.ok(pages.every(p=>!p.styles[0].includes('background:none')));
  const before=calls.length;await repairSavedModel(model,dir,{get:async()=>{throw Error('Must reuse repaired assets');}});assert.equal(calls.length,before);
  assert.equal(JSON.parse(await readFile(path.join(dir,'repair-report.json'))).assetsAdded,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('legacy rejected embedded CSS is recovered once without fetching successful media',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-legacy-svg-'));
 try {
  const origin='https://example.org/',url='data:image/svg+xml;charset=US-ASCII,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20"/>');
  const p=extract('<html><head><link rel="stylesheet" href="/theme.css"></head><body><main><h1>Page</h1></main></body></html>',origin);
  await writeJSON(path.join(dir,'captured-model.json'),{pages:[structuredClone(p)]});
  p.styles=['.icon{background:none}'];const model={source:origin,pages:[p],media:[],warnings:[`Asset ${url.slice(0,180)}: Unsupported embedded media`],metrics:{}};const calls=[];
  await repairSavedModel(model,dir,{text:async requested=>{calls.push(requested);return `.icon{background:url("${url}")}`;},get:async()=>{throw Error('No media or page download allowed');}});
  assert.deepEqual(calls,[origin+'theme.css']);assert.equal(model.media.length,1);assert.deepEqual(model.warnings,[]);assert.match(p.styles[0],/media\/.+\.svg/);
  await repairSavedModel(model,dir,{text:async()=>{throw Error('Recovered CSS should not fetch again');},get:async()=>{throw Error('No download');}});
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('identical failed declarations retain their own stylesheet asset identity',async()=>{
 const {localize}=await import('../engine/assets.mjs');const dir=await mkdtemp(path.join(os.tmpdir(),'repair-style-identity-'));
 try {
  const origin='https://example.org/',pages=['a','b'].map(name=>extract(`<html><head><link rel="stylesheet" href="/${name}.css"></head><body><main><h1>${name}</h1></main></body></html>`,origin+name+'/'));
  await writeJSON(path.join(dir,'captured-model.json'),{pages:structuredClone(pages)});
  const model={source:origin,pages,media:[],warnings:[],metrics:{}};
  await localize(model,{text:async url=>`.icon{background:url(${url.replace('.css','.svg')})}`,get:async()=>({status:404})},path.join(dir,'project/assets/media'));
  assert.equal(pages[0].styles[0],pages[1].styles[0]);
  await repairSavedModel(model,dir,{get:async url=>({status:200,headers:{'content-type':'image/svg+xml'},body:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${url.endsWith('a.svg')?20:30}" height="20"/>`)})});
  for(const [i,name] of ['a','b'].entries())assert.ok(pages[i].styles[0].includes(model.media.find(m=>m.source===origin+name+'.svg').path.split('/').at(-1)));
  assert.notEqual(pages[0].styles[0],pages[1].styles[0]);assert.equal(Object.keys(model.failedStylesheets).length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('cached calendar settings upgrade from original HTML without requesting source pages',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'calendar-settings-upgrade-'));try{
  const url='https://example.org/events/',original=extract('<html><head><title>Events</title></head><body><div role="main" data-js="tribe-events-view"><script data-js="tribe-events-view-data">{"start_of_week":"6","date_formats":{"compact":"d/m/Y"},"slug":"list","url":"https://example.org/events/","next_url":"https://example.org/events/page/2/","events":[1,2]}</script><div class="tribe-events-calendar-list"><article class="tribe-events-calendar-list__event-row">One</article><article class="tribe-events-calendar-list__event-row">Two</article></div></div></body></html>',url);original.presentationVersion=35;const saved=structuredClone(original);delete saved.sourceHTML;for(const key of ['content','shell'])saved[key]=saved[key].replace(/ data-migration-calendar-(?:week-start|compact-format|list)="[^"]*"/g,'');
  await writeJSON(path.join(dir,'captured-model.json'),{pages:[original]});let requests=0;const unexpected=async()=>{requests++;throw Error('Unexpected source request');};const model=await repairSavedModel({source:url,pages:[saved],media:[],metrics:{},warnings:[]},dir,{get:unexpected,head:unexpected,text:unexpected});assert.equal(requests,0);assert.equal(model.pages[0].presentationVersion,41);assert.match(model.pages[0].shell+model.pages[0].content,/data-migration-calendar-list=/);assert.match(model.pages[0].shell+model.pages[0].content,/pageSize[^0-9]*2/);assert.match(model.pages[0].shell+model.pages[0].content,/data-migration-calendar-week-start="6"/);assert.match(model.pages[0].shell+model.pages[0].content,/data-migration-calendar-compact-format="dd\/MM\/yyyy"/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('saved FAQ captures upgrade content bindings without source requests',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-faq-'));try{
  const url='https://example.org/faq/';const schema={'@type':'FAQPage',mainEntity:[{'@type':'Question',url:url+'#question',name:'Question?',acceptedAnswer:{'@type':'Answer',text:'Original answer. Next step.'}}]};
  const html='<html><head><title>FAQ</title><script type="application/ld+json">'+JSON.stringify(schema)+'</script></head><body><main><section id="question"><h2>Question?</h2><div><p>Original answer.</p><p>Next step.</p></div></section></main></body></html>';
  const original=extract(html,url),saved={...original,presentationVersion:39,sourceSEO:{...original.sourceSEO,seo_content_bindings:[]}};delete saved.sourceHTML;
  await writeJSON(path.join(dir,'captured-model.json'),{pages:[original]});let requests=0;const reject=async()=>{requests++;throw Error('Unexpected source request');};
  const model=await repairSavedModel({source:url,pages:[saved],media:[],metrics:{},warnings:[]},dir,{get:reject,head:reject,text:reject});
  assert.equal(requests,0);assert.equal(model.pages[0].presentationVersion,41);assert.equal(model.pages[0].sourceSEO.seo_content_bindings.length,1);assert.ok(model.pages[0].sourceSEO.seo_content_bindings[0].answer);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('cached HowTo steps acquire authored schema bindings without re-fetching pages',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'repair-howto-'));try{
  const url='https://example.org/guide/',schema={'@type':'HowTo',step:[{'@type':'HowToStep',url:url+'#step',name:'Prepare',itemListElement:[{'@type':'HowToDirection',text:'Collect facts.'}]}]};
  const html='<html><head><title>Guide</title><script type="application/ld+json">'+JSON.stringify(schema)+'</script></head><body><main><section id="step"><h3>Prepare</h3><p>Collect facts.</p></section></main></body></html>';
  const original=extract(html,url),saved={...original,presentationVersion:40,sourceSEO:{...original.sourceSEO,seo_content_bindings:[]}};delete saved.sourceHTML;
  await writeJSON(path.join(dir,'captured-model.json'),{pages:[original]});let requests=0;const reject=async()=>{requests++;throw Error('Unexpected source request');};
  const model=await repairSavedModel({source:url,pages:[saved],media:[],metrics:{},warnings:[]},dir,{get:reject,head:reject,text:reject});
  assert.equal(requests,0);assert.equal(model.pages[0].presentationVersion,41);const binding=model.pages[0].sourceSEO.seo_content_bindings[0];assert.equal(binding.anchor,'step');assert.ok(binding.name);assert.ok(binding['direction-0']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
