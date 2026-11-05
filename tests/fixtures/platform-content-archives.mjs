// Edit/add native CPT content in a disposable copy of a full installed capture.
import assert from 'node:assert/strict';
import {mkdtemp,cp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {load} from 'cheerio';
import {parseContent,YAML} from '../../scripts/source-project.mjs';import {run} from '../../engine/pipeline.mjs';
const source=path.resolve(process.argv[2]||'artifacts/platform/content-complete/project'),dir=await mkdtemp(path.join(tmpdir(),'installed-content-archives-'));
try{
 await cp(source,dir,{recursive:true,filter:entry=>!['output','.ssg-output','.ssg-content','.ssg-templates'].includes(path.basename(entry))});
 const routes=JSON.parse(await readFile(path.join(dir,'routes.json'))),chair=routes.find(r=>r.route==='/work/studio-chair/');assert.ok(chair);
 const file=path.join(dir,'content',chair.collection,chair.slug+'.md'),before=await readFile(file,'utf8'),parsed=parseContent(before,file);
 parsed.meta.title='Edited Studio Chair';parsed.meta.excerpt='An edited archive description.';await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body);
 const added=structuredClone(parsed.meta);added.title='Studio Table';added.permalink='/work/studio-table/';delete added.wordpress_id;added.custom_fields.project_summary='A new table authored locally.';added.custom_fields.project_budget=800;added.custom_fields.project_link.title='Ask about the table';
 await writeFile(path.join(dir,'content',chair.collection,'studio-table.md'),'---\n'+YAML.stringify(added)+'---\n'+parsed.body.replace('This body copy stays editable.','A new Markdown-authored project.'));
 await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:120000});
 const results=[];
 for(const route of ['/work/','/disciplines/furniture/']){
  const first=await readFile(path.join(dir,'output',route,'index.html'),'utf8'),second=await readFile(path.join(dir,'output',route,'page/2/index.html'),'utf8');const $=load(first+second);const links=$('h2 a,h3 a,.entry-title a').map((_,e)=>({title:$(e).text().trim(),href:$(e).attr('href')})).get();
  assert.ok(links.some(l=>l.title==='Edited Studio Chair'&&l.href==='/work/studio-chair/'),JSON.stringify({route,links}));assert.ok(links.some(l=>l.title==='Studio Table'&&l.href==='/work/studio-table/'),JSON.stringify({route,links}));assert.ok($('article').filter((_,e)=>$(e).find('a[href="/work/studio-table/"]').length).text().includes('A new Markdown-authored project.'));results.push({route,paginationPages:2,links});
 }
 const detail=load(await readFile(path.join(dir,'output/work/studio-table/index.html'),'utf8'));assert.equal(detail('.project-summary').text(),'A new table authored locally.');assert.equal(detail('.project-budget').text(),'800');assert.ok(detail.text().includes('A new Markdown-authored project.'));
 assert.equal(await readFile(path.join(source,'content',chair.collection,chair.slug+'.md'),'utf8'),before);
 console.log(JSON.stringify({status:'passed',archives:results,addedNativeRecord:true,sharedTemplate:added.content_template,sourceMutated:false,aiCalls:0}));
}finally{await rm(dir,{recursive:true,force:true});}
