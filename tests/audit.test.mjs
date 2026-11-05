import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {auditProject,outputFile} from '../engine/audit.mjs';import {extract} from '../engine/extract.mjs';
test('document title excludes SVG accessibility titles',()=>{assert.equal(extract('<html><head><title>Actual title</title></head><body><main><svg><title>Logo</title></svg>Text</main></body></html>','https://example.org/').title,'Actual title');});
test('audit distinguishes missing local routes, remote out-of-scope links, noindex and malformed schema',async()=>{const dir=await mkdtemp(path.join(os.tmpdir(),'audit-'));try{await mkdir(path.join(dir,'output'));await writeFile(path.join(dir,'routes.json'),JSON.stringify([{route:'/',slug:'home'}]));await writeFile(path.join(dir,'kujo-ssg.json'),JSON.stringify({site_url:'https://example.org/'}));await writeFile(path.join(dir,'output/robots.txt'),'User-agent: *\nAllow: /');await writeFile(path.join(dir,'output/sitemap.xml'),'<urlset><url><loc>https://example.org/</loc></url></urlset>');await writeFile(path.join(dir,'output/index.html'),'<html lang="en"><head><title>Example</title><meta name="robots" content="NOINDEX"><link rel="canonical" href="https://wrong.example/"></head><body><h1>Example</h1><a href="/missing/">Broken</a><a href="https://example.org/outside/">Not captured</a><a aria-disabled="true" data-migration-unavailable="/excluded">Excluded</a><script type="application/ld+json">{invalid}</script><img src="/assets/missing.png"></body></html>');const r=await auditProject(dir,{performance:false});for(const code of ['canonical-mismatch','sitemap-indexability','invalid-jsonld','missing-alt','broken-internal-link','uncaptured-internal-destination'])assert.ok(r.issues.some(i=>i.code===code),code);assert.equal(r.issues.filter(i=>i.code==='broken-internal-link').length,1);assert.equal(r.pages[0].indexable,false);assert.equal(r.unavailable.INP,'NOT AVAILABLE — DATA ACCESS REQUIRED');assert.throws(()=>outputFile(dir,'/../secret'));}finally{await rm(dir,{recursive:true,force:true});}});

test('indexed audit preserves repeated-edge counts, graph depth, orphan and duplicate metadata findings',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'audit-graph-'));
 try{
  const routes=['/','/middle/','/leaf/','/orphan/'];
  await mkdir(path.join(dir,'output'),{recursive:true});
  await writeFile(path.join(dir,'routes.json'),JSON.stringify(routes.map((route,i)=>({route,slug:'page-'+i}))));
  await writeFile(path.join(dir,'kujo-ssg.json'),JSON.stringify({site_url:'https://example.org/'}));
  await writeFile(path.join(dir,'output/robots.txt'),'User-agent: *\nAllow: /');
  await writeFile(path.join(dir,'output/sitemap.xml'),'<urlset>'+routes.map(route=>'<url><loc>https://example.org'+route+'</loc></url>').join('')+'</urlset>');
  for(const route of routes){
   const file=outputFile(path.join(dir,'output'),route);await mkdir(path.dirname(file),{recursive:true});
   const links=route==='/'?'<a href="/middle/">First</a><a href="/middle/">Second</a><a href="https://other.example/">External</a>':route==='/middle/'?'<a href="/leaf/">Leaf</a><a href="/">Home</a>':'';
   await writeFile(file,`<html lang="en"><head><title>${route==='/'||route==='/leaf/'?'Shared':'Unique '+route}</title><meta name="description" content="Description ${route}"><link rel="canonical" href="https://example.org${route}"></head><body><h1>Page</h1>${links}</body></html>`);
  }
  const result=await auditProject(dir,{performance:false}), byRoute=new Map(result.pages.map(p=>[p.route,p]));
  assert.equal(byRoute.get('/').internal_outbound_links,2);assert.equal(byRoute.get('/').external_outbound_links,1);
  assert.equal(byRoute.get('/middle/').internal_inbound_links,2);
  assert.equal(byRoute.get('/middle/').page_depth,1);assert.equal(byRoute.get('/leaf/').page_depth,2);
  assert.equal(byRoute.get('/orphan/').page_depth,null);assert.ok(byRoute.get('/orphan/').orphan);
  assert.deepEqual(result.issues.filter(i=>i.code==='duplicate-title').map(i=>i.route),['/','/leaf/']);
 }finally{await rm(dir,{recursive:true,force:true});}
});
