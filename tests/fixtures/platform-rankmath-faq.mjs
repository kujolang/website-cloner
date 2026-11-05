// Real free-plugin FAQ output; temporary local page is removed in finally.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFile,mkdtemp,rm,writeFile,cp} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {load} from 'cheerio';
import {extract} from '../../engine/extract.mjs';
import {generate} from '../../engine/generate.mjs';
import {run,migrate} from '../../engine/pipeline.mjs';
import {parseContent,YAML} from '../../scripts/source-project.mjs';
const kind=process.argv.find(arg=>arg.startsWith('--kind='))?.slice(7)||'rankmath';assert.ok(['rankmath','yoast'].includes(kind));
const root=path.resolve(process.argv.slice(2).find(arg=>!arg.startsWith('--'))||(kind==='yoast'?'work/yoast-heldout':'work/rm-heldout')),fixture=JSON.parse(await readFile(path.join(root,kind+'-ready.json')));
assert.equal(fixture.authorized,true);assert.equal(new URL(fixture.url).hostname,'127.0.0.1');
const php=code=>execFileSync('php',['-d','error_reporting=22527','-r',`$_SERVER['HTTP_HOST']=$argv[2];require $argv[1].'/wp-load.php';${code}`,path.join(root,'wordpress'),new URL(fixture.url).host],{encoding:'utf8',env:{...process.env,FIXTURE_DB_HOST:'localhost:'+path.join(root,'mysql.sock'),FIXTURE_DB_DIR:path.join(root,'databases',kind)}}).trim();
const dir=await mkdtemp(path.join(tmpdir(),'rankmath-faq-')),slug=path.basename(dir).toLowerCase();let id,result,capture;
const questions=[{id:'fixture-question-one',title:'How are notes published?',content:'An editor reviews every note.',visible:true},{id:'fixture-question-two',title:'Can I update a note?',content:'Yes. Send the editor a correction.',visible:true},{id:'fixture-question-hidden',title:'Hidden draft question',content:'Not public.',visible:false}];
const faqQuestions=(graph,faq)=>faq.mainEntity.map(question=>question['@type']==='Question'?question:graph.find(node=>node['@id']===question['@id']));
const graphOf=$=>JSON.parse($('script[type="application/ld+json"]').first().text())['@graph'];
try{
 const escape=value=>value.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
 // Yoast's installed FAQ save component uses section divs, strong questions and p answers.
 const yoastQuestions=questions.slice(0,2).map(q=>({id:q.id,question:q.title,answer:q.content,jsonQuestion:q.title,jsonAnswer:q.content}));
 const content=kind==='rankmath'?'<!-- wp:rank-math/faq-block '+JSON.stringify({questions})+' /-->':'<!-- wp:yoast/faq-block '+JSON.stringify({questions:yoastQuestions})+' --><div class="schema-faq wp-block-yoast-faq-block">'+yoastQuestions.map(q=>'<div class="schema-faq-section" id="'+escape(q.id)+'"><strong class="schema-faq-question">'+escape(q.question)+'</strong><p class="schema-faq-answer">'+escape(q.answer)+'</p></div>').join('')+'</div><!-- /wp:yoast/faq-block -->';
 const encoded=Buffer.from(JSON.stringify({post_type:'page',post_status:'publish',post_title:'Publication questions',post_name:slug,post_content:content})).toString('base64');
 id=Number(php(`$id=wp_insert_post(wp_slash(json_decode(base64_decode('${encoded}'),true)),true);if(is_wp_error($id))throw new RuntimeException($id->get_error_message());echo $id;`));assert.ok(id>0);
 const url=fixture.url+'/'+slug+'/';const response=await fetch(url);assert.equal(response.status,200);const html=await response.text(),source=load(html);const sourceGraph=graphOf(source);const sourceFAQ=sourceGraph.find(n=>[n['@type']].flat().includes('FAQPage'));
 assert.ok(sourceFAQ,'Installed plugin must emit FAQPage');assert.equal(faqQuestions(sourceGraph,sourceFAQ).length,2);assert.equal(source('#fixture-question-one').length,1);assert.equal(source('#fixture-question-hidden').length,0);
 if(process.argv.includes('--capture')){
  const artifact=path.resolve('artifacts/platform/'+kind+'-faq-visual');
  const migrated=await migrate(url,artifact,{fixtureOrigins:[fixture.url],maxPages:1,aiEnabled:false});
  assert.deepEqual(migrated.report.qualityFailures,[]);
  capture={artifact,status:migrated.report.status,metrics:migrated.report.metrics,visual:migrated.report.visual.map(v=>({route:v.route,viewport:v.viewport,pixelSimilarity:v.pixelSimilarity,layoutSimilarity:v.layoutSimilarity,comparisonError:v.comparisonError})),qualityFailures:migrated.report.qualityFailures};
  await cp(path.join(artifact,'project'),dir,{recursive:true});
 }else{
  const page=extract(html,url);page.styles=[];await generate({source:fixture.url+'/',identity:{title:'Community Journal'},design:{},navigation:[],metrics:{},pages:[page],media:[]},dir);
 }
 const build=()=>run(process.execPath,['scripts/build.mjs','--site-url','https://export.example','--base-path','/faq'],{cwd:dir,timeout:120000});await build();
 const verify=async route=>{
  const $=load(await readFile(path.join(dir,'output',route,'index.html'),'utf8'));const graph=graphOf($);const faq=graph.find(n=>[n['@type']].flat().includes('FAQPage'));assert.ok(faq);const resolved=faqQuestions(graph,faq);assert.equal(resolved.length,2);assert.ok(resolved.every(Boolean),'Every FAQ reference resolves');
  for(const [index,question]of resolved.entries()){
   assert.equal(question.name,questions[index].title);assert.equal(question.acceptedAnswer.text,questions[index].content);assert.ok($('main').text().includes(questions[index].content),'Authored answer must render');
   const address=new URL(question.url);assert.equal(address.origin,'https://export.example');assert.equal(address.pathname,'/faq/'+route+'/');assert.equal($(address.hash).length,1,'Question URL must target a rendered anchor');
  }
  assert.ok(!JSON.stringify(faq).includes(fixture.url));assert.ok(!$('main').text().includes('Hidden draft question'));return faq;
 };
 await verify(slug);
 const records=JSON.parse(await readFile(path.join(dir,'routes.json')));const record=records.find(r=>r.route==='/'+slug+'/');const file=path.join(dir,'content',record.collection,record.slug+'.md');const parsed=parseContent(await readFile(file,'utf8'),file);
 assert.ok(parsed.body.includes('An editor reviews every note.'),'FAQ answer must be in editable content');assert.doesNotMatch(parsed.body,/<(?:div|script|style)\b/i,'Plain FAQ content must not become a page HTML snapshot');
 parsed.body=parsed.body.replace(questions[0].content,'Two editors now review every note.');questions[0].content='Two editors now review every note.';
 parsed.meta.permalink='/edited-faq/';parsed.meta.seo_title='Authored question guide';await writeFile(file,'---\n'+YAML.stringify(parsed.meta)+'---\n'+parsed.body);await build();const changed=await verify('edited-faq');assert.equal(changed.name,'Authored question guide');
 result={fixture,...(capture?{capture}:{}),visibleQuestions:2,hiddenQuestionExcluded:kind==='rankmath',renderedAnchors:true,editableContent:true,relocatedQuestionURLs:true,permalinkAndSEOTitleEdits:true,answerEditsSynchronizeSchema:true,aiCalls:0,scope:'Installed '+kind+' free FAQ block content/schema through native export and route/title edits; no visual or whole-plugin claim'};
}finally{if(id){php(`wp_delete_post(${id},true);`);assert.equal(php(`echo get_post(${id})?'present':'absent';`),'absent');}await rm(dir,{recursive:true,force:true});}
result.fixturePageRemoved=true;await writeFile(path.join(root,'faq-check.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
