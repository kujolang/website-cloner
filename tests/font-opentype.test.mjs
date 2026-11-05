import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {extract} from '../engine/extract.mjs';
import {localize} from '../engine/assets.mjs';

for(const embedded of [false,true])test(`OpenType MIME alias preserves ${embedded?'embedded':'remote'} font bytes and local CSS`,async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'opentype-alias-'));
 try{
  const bytes=Buffer.from('OTTO-local-font-fixture');
  const url=embedded?'data:font/opentype;base64,'+bytes.toString('base64'):'https://fonts.example.org/font';
  const page=extract(`<html><head><style>@font-face{font-family:Example;src:url("${url}") format("opentype")}</style></head><body><main>Example</main></body></html>`,'https://example.org/');
  const model={pages:[page],media:[],metrics:{},warnings:[]};let requests=0;
  const network={get:async()=>{requests++;return {status:200,headers:{'content-type':'Font/OpenType; charset=binary'},body:bytes};}};
  await localize(model,network,dir);
  assert.equal(model.media.length,1,JSON.stringify(model.warnings));
  assert.match(model.media[0].path,/\.otf$/);
  assert.deepEqual(await readFile(path.join(dir,path.basename(model.media[0].path))),bytes);
  assert.match(page.styles.join(''),/\.\.\/media\/[^"\s]+\.otf/);
  assert.ok(!page.styles.join('').includes(url));
  await localize(model,network,dir,{stylesOnly:true});
  assert.equal(requests,embedded?0:1);
  assert.deepEqual(model.warnings,[]);
 }finally{await rm(dir,{recursive:true,force:true});}
});
