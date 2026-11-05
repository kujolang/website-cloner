// Temporarily configure only an authorized loopback fixture; always restore it.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,rm,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {load} from 'cheerio';
import {extract} from '../../engine/extract.mjs';
import {generate} from '../../engine/generate.mjs';
import {run} from '../../engine/pipeline.mjs';
const root=path.resolve(process.argv[2]||'work/yoast-heldout');
const fixture=JSON.parse(await readFile(path.join(root,'yoast-ready.json')));
assert.equal(fixture.authorized,true);assert.equal(new URL(fixture.url).hostname,'127.0.0.1');
const php=code=>execFileSync('php',['-d','error_reporting=22527','-r',`$_SERVER['HTTP_HOST']=$argv[2];require $argv[1].'/wp-load.php';${code}`,path.join(root,'wordpress'),new URL(fixture.url).host],{encoding:'utf8',env:{...process.env,FIXTURE_DB_HOST:'localhost:'+path.join(root,'mysql.sock'),FIXTURE_DB_DIR:path.join(root,'databases/yoast')}}).trim();
const original=JSON.parse(php("echo json_encode(get_option('wpseo_titles'));"));
const dir=await mkdtemp(path.join(tmpdir(),'yoast-person-'));let result;
try{
 php("$o=get_option('wpseo_titles');$o['company_or_person']='person';$o['company_or_person_user_id']=1;update_option('wpseo_titles',$o);");
 const pages=[];const sourceGraphs=[];
 for(const route of ['/','/field-note-02/']){
  const response=await fetch(fixture.url+route);assert.equal(response.status,200);const html=await response.text();const $=load(html);const graph=JSON.parse($('script.yoast-schema-graph').text())['@graph'];
  const person=graph.find(n=>[n['@type']].flat().includes('Person'));assert.ok(person,'Installed source must emit Person');assert.ok(!graph.some(n=>n['@type']==='Organization'),'Person configuration must replace Organization');
  assert.equal(graph.find(n=>n['@type']==='WebSite').publisher['@id'],person['@id']);
  const page=extract(html,fixture.url+route);page.styles=[];pages.push(page);sourceGraphs.push({route,graph,person});
 }
 await generate({source:fixture.url+'/',identity:{title:'Community Journal'},design:{},navigation:[],metrics:{},pages,media:[]},dir);
 await run(process.execPath,['scripts/build.mjs','--site-url','https://export.example','--base-path','/personal'],{cwd:dir,timeout:120000});
 const cases=[];
 for(const {route,person}of sourceGraphs){
  const html=await readFile(path.join(dir,'output',route.slice(1),'index.html'),'utf8');const $=load(html);const graph=JSON.parse($('script[type="application/ld+json"]').first().text())['@graph'];
  const people=graph.filter(n=>[n['@type']].flat().includes('Person'));assert.equal(people.length,1,'Typed identity must survive on '+route);assert.equal(people[0].name,person.name);assert.deepEqual(people[0]['@type'],person['@type']);assert.ok(!graph.some(n=>n['@type']==='Organization'));
  assert.equal(graph.find(n=>n['@type']==='WebSite').publisher['@id'],people[0]['@id']);
  assert.ok(people[0]['@id'].startsWith('https://export.example/personal/'));assert.ok(!JSON.stringify(graph).includes(fixture.url));
  const article=graph.find(n=>['Article','BlogPosting'].includes(n['@type']));if(article)assert.equal(article.author['@id'],people[0]['@id']);
  cases.push({route,personIdentity:true,publisherLinked:true,articleAuthorLinked:Boolean(article),sourceOriginRemoved:true});
 }
 result={fixture,cases,aiCalls:0,scope:'Installed person identity and linked schema through native export at a subdirectory; not visual or whole-plugin acceptance'};
}finally{
 const encoded=Buffer.from(JSON.stringify(original)).toString('base64');php(`update_option('wpseo_titles',json_decode(base64_decode('${encoded}'),true));`);
 assert.deepEqual(JSON.parse(php("echo json_encode(get_option('wpseo_titles'));")),original,'Restore exact source options');await rm(dir,{recursive:true,force:true});
}
result.sourceRestored=true;await writeFile(path.join(root,'person-schema-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
