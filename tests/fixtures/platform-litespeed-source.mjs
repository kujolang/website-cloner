import assert from 'node:assert/strict';import {readFile,writeFile} from 'node:fs/promises';import path from 'node:path';import {load} from 'cheerio';
const root=path.resolve(process.argv[2]||'work/lscache'),ready=JSON.parse(await readFile(path.join(root,'litespeed-ready.json'))),origin=ready.url;
assert.equal(new URL(origin).hostname,'127.0.0.1');assert.equal(ready.authorized,true);
const response=await fetch(origin+'/');assert.equal(response.status,200);const html=await response.text(),$=load(html);
const lazy=$('img[data-lazyloaded][data-src]');assert.ok(lazy.length>=2);assert.ok(lazy.toArray().every(el=>$(el).attr('src').startsWith('data:')));
const css=$('link[rel=stylesheet][data-optimized]').attr('href');assert.ok(css.includes('/litespeed/css/'));
const style=await fetch(css);assert.equal(style.status,200);const text=await style.text();assert.match(text,/fixture-panel/);assert.match(text,/icons\.woff2/);assert.match(text,/background\.png/);
const images=[];for(const el of lazy){const url=new URL($(el).attr('data-src'),origin);assert.equal(url.origin,origin);const image=await fetch(url);assert.equal(image.status,200);images.push(url.pathname);}
const result={plugin:ready.plugins,optimizedStylesheet:css,lazyImages:images,relativeFontAndBackground:true,cloudServices:false,serverCache:false};await writeFile(path.join(root,'source-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
