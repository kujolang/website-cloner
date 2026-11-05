import assert from 'node:assert/strict';
import path from 'node:path';
import {readFile,writeFile,rm,copyFile}from'node:fs/promises';
import{load}from'cheerio';
import{parseContent,YAML}from'../../scripts/source-project.mjs';
import{run}from'../../engine/pipeline.mjs';
const root=path.resolve('artifacts/platform/woocommerce-complete'),project=path.join(root,'project'),original=path.join(project,'content/wp-product/product-studio-mug.md'),added=path.join(project,'content/wp-product/local-bowl.md'),before=await readFile(original,'utf8');
const generator=await readFile(path.resolve('engine/generate.mjs'),'utf8');
for(const match of generator.matchAll(/\["(scripts\/[^"\n]+|vendor\/export-source\.mjs)", "([^"\n]+)"\]/g))await copyFile(path.resolve(match[1]),path.join(project,match[2]));
try{
 const bowl=parseContent(before,original);bowl.meta.title='Locally Authored Bowl';bowl.meta.seo_title=bowl.meta.title;bowl.meta.permalink='/product/local-bowl/';bowl.meta.canonical='http://127.0.0.1:9427/product/local-bowl/';delete bowl.meta.wordpress_id;delete bowl.meta.product.id;bowl.meta.product.name=bowl.meta.title;bowl.meta.product.sku='LOCAL-BOWL';
 await writeFile(added,'---\n'+YAML.stringify(bowl.meta)+'---\n'+bowl.body);await rm(original);
 await run(process.execPath,['scripts/build.mjs'],{cwd:project,timeout:120000});
 const checked=[];
 for(const route of ['shop','product-category/workshop-goods']){
  const $=load(await readFile(path.join(project,'output',route,'index.html'),'utf8'));const card=$('li.product').filter((_,el)=>$(el).find('h2').text()==='Locally Authored Bowl');assert.equal(card.length,1);
  const links=card.find('a.woocommerce-LoopProduct-link');assert.equal(links.length,1,'product wrapper must remain a working link after deleting sample');assert.equal(links.attr('href'),'/product/local-bowl/');assert.equal(card.find('a[href*="studio-mug"]').length,0);checked.push(route);
 }
 const result={deletedSample:'wp-product/product-studio-mug',sharedTemplate:bowl.meta.content_template,checked,wrapperLinksPreserved:true,aiCalls:0};await writeFile(path.join(root,'deleted-sample-check.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
}finally{await writeFile(original,before);await rm(added,{force:true});await run(process.execPath,['scripts/build.mjs'],{cwd:project,timeout:120000});}
