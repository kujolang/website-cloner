import {load} from 'cheerio';
import {run} from '../engine/pipeline.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {extract,clean,discover} from '../engine/extract.mjs';
import {sanitizeSvg} from '../engine/svg.mjs';
import {localize} from '../engine/assets.mjs';
import {generate} from '../engine/generate.mjs';

test('static links use captured aliases, fragments and local media; uncaptured and dynamic links never fall back to source',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'static-links-'));
 const p=extract('<html><body><header><a href="https://example.org/story?utm_source=test#part">Story</a></header><main><a href="/story/">Alias</a><a href="https://example.org/missing">Missing</a><a href="http://example.org/story">HTTP alias</a><a href="/?s=term">Search</a><a href="#section">Section</a><a href="https://outside.test/news">External</a><a href="/photo.jpg">Photo</a></main></body></html>','https://www.example.org/');
 const model={source:p.url,submittedSource:'https://example.org/',pages:[p,{...p,url:'https://www.example.org/story',route:'/story',content:'<h1>Story</h1>'}],media:[{source:'https://www.example.org/photo.jpg',path:'assets/media/photo.jpg'}],navigation:[],metrics:{},design:{},identity:{title:'Test'}};
 try{await generate(model,dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:60000});const body=load(await readFile(path.join(dir,'output/index.html'),'utf8'))('body').html();const shell=body;assert.match(shell,/href="\/story#part"/);assert.match(body,/href="\/story"/);assert.match(body,/href="#section"/);assert.match(body,/href="\/assets\/media\/photo.jpg"/);assert.match(body,/href="https:\/\/outside.test\/news"/);assert.doesNotMatch(body,/href="(?:https:\/\/(?:www\.)?example.org|\/missing|\/\?s)/);assert.match(body,/data-migration-unavailable="\/missing"/);const coverage=JSON.parse(await readFile(path.join(dir,'link-coverage.json'),'utf8'));assert.deepEqual(coverage.unavailable.map(link=>link.destination).sort(),['/?s=term','/missing']);}finally{await rm(dir,{recursive:true,force:true});}
});
test('captured plain permalinks and archive query pages link to their own local canonical routes',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'query-links-'));const pages=[extract('<html><body><main><a href="/?p=42&utm_source=email#body">Story</a><a href="/?query-3-page=2">Next</a></main></body></html>','https://example.org/'),extract('<html><body><main>Story</main></body></html>','https://example.org/?p=42'),extract('<html><body><main>Archive</main></body></html>','https://example.org/?query-3-page=2')];
 try{await generate({source:pages[0].url,pages,media:[],navigation:[],metrics:{},design:{},identity:{title:'Test'}},dir);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:60000});const body=load(await readFile(path.join(dir,'output/index.html'),'utf8'))('body').html();assert.ok(body.includes('href="'+pages[1].route+'#body"'));assert.ok(body.includes('href="'+pages[2].route+'"'));const routes=JSON.parse(await readFile(path.join(dir,'routes.json')));assert.equal(routes[1].canonicalRoute,pages[1].route);assert.equal(routes[2].canonicalRoute,pages[2].route);}finally{await rm(dir,{recursive:true,force:true});}
});
