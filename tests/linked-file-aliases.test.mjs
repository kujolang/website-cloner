import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';
import {localize} from '../engine/assets.mjs';
test('same-site HTTP and www download links localize on HTTPS sites, preserving fragments',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'linked-file-'));try{
 const page={url:'https://example.org/',content:'<a href="http://www.example.org/menu.pdf#page=2">Menu</a>',styles:[],styleSources:[]};
 const model={source:page.url,pages:[page],media:[],warnings:[],metrics:{}};let calls=0;
 await localize(model,{get:async url=>{calls++;assert.equal(url,'http://www.example.org/menu.pdf');return {status:200,headers:{'content-type':'application/pdf'},body:Buffer.from('%PDF-1.4\nfixture')};}},dir);
 assert.equal(calls,1);assert.match(page.content,/href="\/assets\/media\/[a-f0-9]+\.pdf#page=2"/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
