import test from 'node:test';import assert from 'node:assert/strict';import {discover} from '../engine/extract.mjs';
const origin='https://example.org';
function network({stop=Infinity}={}) {
 let requests=0;
 const n={robots:new Map(),started:Date.now(),maxRequests:Infinity,requests:0,async get(url){
   if(++requests>stop)throw Object.assign(Error('budget'),{code:'CRAWL_BUDGET'});
   const u=new URL(url);let body='',status=200;
   if(u.pathname==='/')body='<html><body><main>Home</main></body></html>';
   else if(u.pathname==='/wp-json/wp/v2/posts'){const p=Number(u.searchParams.get('page'));body=JSON.stringify(Array.from({length:p===3?60:100},(_,i)=>({link:origin+'/post-'+((p-1)*100+i)})));}
   else if(u.pathname==='/wp-json/wp/v2/pages')body='[]';
   else if(u.pathname==='/sitemap.xml')body='<sitemapindex>'+Array.from({length:9},(_,i)=>`<sitemap><loc>${origin}/map${i}.xml</loc></sitemap>`).join('')+'</sitemapindex>';
   else if(/^\/map\d+\.xml$/.test(u.pathname))body=`<urlset><url><loc>${origin}/only-sitemap-${u.pathname.match(/\d+/)[0]}</loc></url></urlset>`;
   else if(u.pathname==='/wp-sitemap.xml')status=404;
   else body='<html><body><main>Page '+u.pathname+'</main></body></html>';
   return {url,status,headers:{},body:Buffer.from(body)};
 },async text(url){const r=await this.get(url);if(r.status!==200)throw Error('HTTP '+r.status);return r.body.toString();}};return n;
}
test('whole-site discovery exhausts REST pagination and every nested sitemap beyond old caps',async()=>{
 const m=await discover(origin+'/',network());assert.equal(m.pages.length,270);assert.equal(m.discovery.queued,0);assert.equal(m.discovery.complete,true);assert.equal(m.discovery.maxPages,null);assert.ok(m.pages.some(p=>p.route==='/post-259'));assert.ok(m.pages.some(p=>p.route==='/only-sitemap-8'));
});
test('resource pause checkpoints the frontier and resumes without losing or duplicating pages',async()=>{
 let state;
 await assert.rejects(discover(origin+'/',network({stop:25}),{onCheckpoint:async m=>{state=structuredClone(m);}}),/Resume/);
 assert.ok(state.pages.length>0);const count=state.pages.length;
 const resumed=await discover(origin+'/',network(),{state});assert.equal(resumed.pages.length,270);assert.ok(resumed.pages.length>count);assert.equal(new Set(resumed.pages.map(p=>p.url)).size,270);assert.equal(resumed.discovery.complete,true);
});
test('mid-REST pause preserves enumeration cursor, and inaccessible pages remain explicit',async()=>{
 let state;await assert.rejects(discover(origin+'/',network({stop:3}),{onCheckpoint:async m=>{state=structuredClone(m);}}),/Resume/);
 const n=network(),get=n.get.bind(n);n.get=async url=>url.endsWith('/post-5')?{status:403,url,body:Buffer.from('')} : get(url);
 const m=await discover(origin+'/',n,{state});assert.equal(m.pages.length,269);assert.equal(m.discovery.complete,false);assert.equal(m.discovery.failures.length,1);assert.match(m.discovery.failures[0].url,/post-5/);
});
test('plain WordPress permalink and archive pagination queries become distinct static routes',async()=>{
 const n=network(), get=n.get.bind(n);n.get=async url=>url===origin+'/'?{url,status:200,body:Buffer.from('<html><body><main><a href="/?p=42">Post</a><a href="/?query-3-page=2">Archive</a><a href="/?s=search">Search</a></main></body></html>')} : url.includes('/wp-json/')?{url,status:404,body:Buffer.from('')} : url.includes('.xml')?{url,status:404,body:Buffer.from('')}:get(url);
 const m=await discover(origin+'/',n);assert.equal(m.pages.length,3);assert.equal(new Set(m.pages.map(p=>p.route)).size,3);assert.ok(m.pages.slice(1).every(p=>p.route.startsWith('/_migration/query/')));
});
test('explicit samples stop enumeration early and retain cap on checkpoint resume',async()=>{
 const n=network(), get=n.get.bind(n), urls=[];n.get=async url=>{urls.push(url);return get(url);};
 const m=await discover(origin+'/',n,{maxPages:150});assert.equal(m.pages.length,150);assert.equal(m.discovery.mode,'explicit-sample');assert.equal(m.discovery.complete,false);assert.ok(!urls.some(u=>u.includes('page=3')||u.includes('map0.xml')));
 const resumed=await discover(origin+'/',network(),{maxPages:150,state:m});assert.equal(resumed.pages.length,150);
});

test('source outages retain REST, sitemap and page cursors for automatic resume',async()=>{
 for(const target of ['/wp-json/wp/v2/types','/wp-json/wp/v2/posts?per_page=100&page=2&_embed=author,wp:featuredmedia','/map3.xml','/post-5']){
  const n=network(),get=n.get.bind(n);let state;
  n.get=async url=>{if(url===origin+target)throw Object.assign(Error('offline'),{code:'SOURCE_UNAVAILABLE'});return get(url);};
  await assert.rejects(discover(origin+'/',n,{onCheckpoint:async m=>{state=structuredClone(m);}}),{code:'SOURCE_UNAVAILABLE'});
  assert.ok(state);assert.ok(!state.discovery.failures.some(f=>f.url===origin+target));
  const resumed=await discover(origin+'/',network(),{state});assert.equal(resumed.pages.length,270);assert.equal(resumed.discovery.complete,true);
 }
});
