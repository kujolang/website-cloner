// Temporarily configure only an authorized loopback fixture; always restore it.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,rm,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {load} from 'cheerio';
import {extract} from '../../engine/extract.mjs';
import {generate} from '../../engine/generate.mjs';
import {parseContent,YAML} from '../../scripts/source-project.mjs';
import {run,migrate} from '../../engine/pipeline.mjs';
const root=path.resolve(process.argv[2]||'work/rm-heldout');
const fixture=JSON.parse(await readFile(path.join(root,'rankmath-ready.json')));
assert.equal(fixture.authorized,true);assert.equal(new URL(fixture.url).hostname,'127.0.0.1');
const php=code=>execFileSync('php',['-d','error_reporting=22527','-r',`$_SERVER['HTTP_HOST']=$argv[2];require $argv[1].'/wp-load.php';${code}`,path.join(root,'wordpress'),new URL(fixture.url).host],{encoding:'utf8',env:{...process.env,FIXTURE_DB_HOST:'localhost:'+path.join(root,'mysql.sock'),FIXTURE_DB_DIR:path.join(root,'databases/rankmath')}}).trim();
const dir=await mkdtemp(path.join(tmpdir(),'rankmath-howto-')),slug=path.basename(dir).toLowerCase();let id,result,capture;
const steps=[{id:'prepare-note',title:'Prepare the note',content:'Collect the facts.',visible:true},{id:'review-note',title:'Review the note',content:'Ask an editor to review.',visible:true},{id:'private-step',title:'Private draft',content:'Not published.',visible:false}];
const graphOf=$=>JSON.parse($('script[type="application/ld+json"]').first().text())['@graph'];
try{
 const content='<!-- wp:rank-math/howto-block '+JSON.stringify({description:'Publish a community note.',hasDuration:true,minutes:'10',steps})+' /-->';
 const encoded=Buffer.from(JSON.stringify({post_type:'page',post_status:'publish',post_title:'Publishing guide',post_name:slug,post_content:content})).toString('base64');
 id=Number(php(`$id=wp_insert_post(wp_slash(json_decode(base64_decode('${encoded}'),true)),true);if(is_wp_error($id))throw new RuntimeException($id->get_error_message());echo $id;`));assert.ok(id>0);
 const url=fixture.url+'/'+slug+'/',response=await fetch(url);assert.equal(response.status,200);const html=await response.text(),source=load(html),howto=graphOf(source).find(n=>n['@type']==='HowTo');
 assert.ok(howto);assert.equal(howto.step.length,2);assert.equal(howto.totalTime,'P0DT0H10M');assert.equal(source('#private-step').length,0);
 if(process.argv.includes('--capture')){
  const artifact=path.resolve('artifacts/platform/rankmath-howto-visual'),migrated=await migrate(url,artifact,{fixtureOrigins:[fixture.url],maxPages:1,aiEnabled:false});
  assert.deepEqual(migrated.report.qualityFailures,[]);
  capture={artifact,status:migrated.report.status,metrics:migrated.report.metrics,visual:migrated.report.visual.map(v=>({route:v.route,viewport:v.viewport,pixelSimilarity:v.pixelSimilarity,layoutSimilarity:v.layoutSimilarity,comparisonError:v.comparisonError})),qualityFailures:migrated.report.qualityFailures};
  await cp(path.join(artifact,'project'),dir,{recursive:true});
 }else{const page=extract(html,url);page.styles=[];await generate({source:fixture.url+'/',identity:{title:'Community Journal'},design:{},navigation:[],metrics:{},pages:[page],media:[]},dir);}
 const build=()=>run(process.execPath,['scripts/build.mjs','--site-url','https://export.example','--base-path','/guide'],{cwd:dir,timeout:120000});await build();
 const verify=async(route,edited=false)=>{
  const $=load(await readFile(path.join(dir,'output',route,'index.html'),'utf8')),data=graphOf($).find(n=>n['@type']==='HowTo');assert.ok(data);assert.equal(data.totalTime,'P0DT0H10M');assert.equal(data.step.length,2);
  for(const [i,step]of data.step.entries()){const u=new URL(step.url);assert.equal(u.origin,'https://export.example');assert.equal(u.pathname,'/guide/'+route+'/');assert.equal($(u.hash).length,1);assert.equal(step.name,steps[i].title);assert.equal(step.itemListElement[0].text,steps[i].content);}
  assert.ok(!JSON.stringify(data).includes(fixture.url));assert.equal($('#private-step').length,0);
  if(edited){assert.ok($('main').text().includes('Verify every fact.'));assert.ok($('main').text().includes('Check the note'));}
 };
 await verify(slug);const routes=JSON.parse(await readFile(path.join(dir,'routes.json'))),record=routes.find(r=>r.route==='/'+slug+'/'),file=path.join(dir,'content',record.collection,record.slug+'.md');const parsed=parseContent(await readFile(file,'utf8'),file);
 assert.ok(parsed.body.includes(steps[0].content));assert.doesNotMatch(parsed.body,/<(?:div|script|style)\b/i);
 parsed.body=parsed.body.replace(steps[0].content,'Verify every fact.').replace(steps[0].title,'Check the note');steps[0].content='Verify every fact.';steps[0].title='Check the note';parsed.meta.permalink='/edited-guide/';await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body);await build();await verify('edited-guide',true);
 result={fixture,...(capture?{capture}:{}),visibleSteps:2,hiddenStepExcluded:true,durationPreserved:true,anchorsRelocated:true,markdownEditsSynchronizeSchema:true,aiCalls:0,scope:'Installed free HowTo text-step native authoring'+(capture?' and three-viewport capture':'')+'; no whole-plugin claim'};
}finally{if(id){php(`wp_delete_post(${id},true);`);assert.equal(php(`echo get_post(${id})?'present':'absent';`),'absent');}await rm(dir,{recursive:true,force:true});}
result.fixturePageRemoved=true;await writeFile(path.join(root,'howto-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
