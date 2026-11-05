import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';import {load} from 'cheerio';
import {mapWordpress,recordWordpress} from '../engine/wordpress.mjs';import {localize} from '../engine/assets.mjs';import {semanticExport} from '../scripts/semantic-export.mjs';
test('internal REST types and conflicting IDs cannot override a captured public page',()=>{
 const page={url:'https://example.com/menu/',route:'/menu/',bodyClass:'page page-id-36',family:'page',content:'<h1>Menu</h1>'},m={source:'https://example.com/',pages:[page],warnings:[],wordpress:{records:{[page.url]:{type:'wp_navigation',id:24756}},types:[],taxonomies:[],terms:{}}};mapWordpress(m);assert.equal(page.contentType,'pages');assert.equal(page.wordpress.type,'page');
 m.wordpress.records[page.url]={type:'post',id:99};mapWordpress(m);assert.equal(page.contentType,'pages');
 m.wordpress.records={};recordWordpress(m,{link:page.url,id:36,type:'page'}, {slug:'wp_navigation'});assert.equal(Object.keys(m.wordpress.records).length,0);
 recordWordpress(m,{link:page.url,id:36,type:'page'}, {slug:'page'});mapWordpress(m);assert.equal(page.wordpress.id,36);
});
test('transient media failures retry while cached assets and permanent 404s do not',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'migration-retry-'));try{
 const calls=new Map(),body=Buffer.from('%PDF-1.4\n%%EOF');const network={get:async url=>{const count=(calls.get(url)||0)+1;calls.set(url,count);if(url.endsWith('menu.pdf')&&count===1)throw Error('Request timeout');return {status:url.endsWith('missing.pdf')?404:200,headers:{'content-type':'application/pdf'},body};}};
 const m={source:'https://example.com/',media:[{source:'https://example.com/saved.pdf',path:'assets/media/saved.pdf'}],metrics:{},warnings:[],pages:[{url:'https://example.com/',content:'<a href="/menu.pdf">Menu</a><a href="/saved.pdf">Saved</a><a href="/missing.pdf">Missing</a>',styles:[]}]};
 await localize(m,network,dir,{linksOnly:true});assert.equal(calls.get('https://example.com/menu.pdf'),2);assert.equal(calls.get('https://example.com/missing.pdf'),1);assert.equal(calls.has('https://example.com/saved.pdf'),false);assert.match(m.pages[0].content,/href="\/assets\/media\//);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('attachment image links use source heading and repeated navigation landmarks have names',()=>{
 const $=load('<nav></nav><nav class="mobile-menu"></nav><aside><h2>Contact</h2></aside><aside><h2>Payment methods</h2></aside><main><article><h1>Italian coffee</h1><a href="/coffee.jpg"><img alt=""></a></article></main>');semanticExport($);assert.equal($('aside').first().attr('aria-label'),'Contact');assert.equal($('a').attr('aria-label'),'Italian coffee');assert.equal(new Set($('nav').map((_,e)=>$(e).attr('aria-label')).get()).size,2);
});

test('failed robots checks and transient HTTP responses are retried without bypassing permission',async()=>{
 const {SafeNetwork}=await import('../engine/network.mjs');const n=new SafeNetwork({fixtureOrigins:['http://127.0.0.1']});let robots=0,assets=0;
 n.raw=async url=>{if(url.endsWith('/robots.txt')){if(++robots===1)throw Error('Request timeout');return {status:200,body:Buffer.from('User-agent: *\nDisallow: /private')};}return {status:++assets===1?503:200,body:Buffer.from('ok')};};
 await assert.rejects(n.get('http://127.0.0.1/image.jpg'),/timeout/);assert.equal((await n.get('http://127.0.0.1/image.jpg')).status,503);assert.equal((await n.get('http://127.0.0.1/image.jpg')).status,200);assert.equal(robots,2);assert.equal(assets,2);await assert.rejects(n.get('http://127.0.0.1/private'),/Disallowed/);
});

test('empty archives use distinct source titles for descriptions without inventing attachment copy',async()=>{
 const {repairDuplicateDescriptions}=await import('../engine/metadata.mjs');const pages=[{title:'Blog',content:'<h1>Nothing found</h1>',description:'Nothing found.'},{title:'Category: News',content:'<h1>Nothing found</h1>',description:'Nothing found.'},{title:'Coffee',content:'<h1>Coffee</h1>',description:'Coffee'},{title:'Coffee',content:'<h1>Coffee</h1>',description:'Coffee'}];assert.equal(repairDuplicateDescriptions(pages).length,2);assert.match(pages[0].description,/^Blog/);assert.equal(pages[2].description,'Coffee');
});
