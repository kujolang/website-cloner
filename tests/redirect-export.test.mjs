import test from 'node:test';import assert from 'node:assert/strict';import http from 'node:http';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {redirectPlan,exportRedirects} from '../scripts/redirect-export.mjs';import {SafeNetwork} from '../engine/network.mjs';
const rule=(url,target,extra={})=>({url,action_type:'url',action_code:301,action_data:{url:target},match_type:'url',match_data:{source:{flag_query:'ignore',flag_case:false,flag_trailing:false,flag_regex:false}},enabled:true,...extra});
const options={source:'https://old.example/',routes:[{route:'/new/',sourceRoute:'/previous/'}],base:'/site'};
test('owner Redirection export maps native moves, orders overrides and reports unsupported semantics',()=>{
 const plan=redirectPlan({...options,observed:[{from:'https://old.example/old/',to:'https://old.example/else/',status:302}],imported:{groups:[{id:3,enabled:false}],redirects:[rule('/old/','/previous/'),rule('/disabled/','/new/',{group_id:3}),rule('/rx/(.*)','/new/',{regex:true}),rule('/exact/','/new/',{match_data:{source:{flag_query:'exact'}}}),rule('/login/','/new/',{match_type:'login'}),rule('/bad/','javascript:alert(1)'),rule('/dup/','/new/'),rule('/dup/','/else/')]}});
 assert.deepEqual(plan.rules.map(r=>r.from),['/old/','/dup/']);assert.equal(plan.rules[0].publicDestination,'/site/new/');assert.equal(plan.rules[0].publicSource,'/site/old/');
 for(const reason of ['disabled-rule','regex-case-or-trailing-match-not-supported','query-matching-requires-server-rule','conditional-or-non-redirect-action','Unsafe target','conflicting-rule'])assert.ok(plan.issues.some(i=>i.reason===reason),reason);
});
test('cycles, upstream cycles, missing destinations and unsafe paths never become rules',()=>{
 const imported={redirects:[rule('/a/','/b/'),rule('/b/','/a/'),rule('/up/','/a/'),rule('/missing/','/not-captured/'),rule('/../escape','/new/'),rule('/%2e%2e/escape','/new/'),rule('/%2fescape','/new/'),rule('//evil.test/a','/new/'),rule('/valid/','https://outside.example/ok'),rule('/chain/','/valid/')]};
 const plan=redirectPlan({...options,imported});assert.deepEqual(plan.rules.map(r=>r.from),['/valid/','/chain/']);assert.equal(plan.issues.length,8);
});
test('redirect graph handles a large chain without recursive stack growth',()=>{
 const plan=redirectPlan({...options,imported:{redirects:Array.from({length:10000},(_,i)=>rule('/r'+i+'/',i===9999?'/new/':'/r'+(i+1)+'/'))}});assert.equal(plan.rules.length,10000);
});
test('hosting output uses HTTP rules and truthful static fallbacks without overwriting routes',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'redirect-host-'));try{
  const report=await exportRedirects({...options,output:dir,imported:{redirects:[rule('/old/','/previous/'),rule('/new/','https://outside.example/'),rule('/method/','/new/',{action_code:308}),rule('/assets/a','/new/'),rule('/external/','https://outside.example/?q=%22#ok')]}});
  const rules=await readFile(path.join(dir,'_redirects'),'utf8');assert.match(rules,/\/site\/old\/ \/site\/new\/ 301/);assert.match(rules,/\/site\/method\/ \/site\/new\/ 308/);assert.doesNotMatch(rules,/assets|\/site\/new\/ https/);
  assert.match(await readFile(path.join(dir,'old/index.html'),'utf8'),/url=\/site\/new\//);assert.equal(report.rules.find(r=>r.from==='/method/').static,'not-exported');assert.ok(report.issues.some(i=>i.reason==='existing-or-reserved-route'));
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('network returns each observed redirect with its actual status without another request',async()=>{
 let requests=0;const server=http.createServer((req,res)=>{requests++;if(req.url==='/robots.txt')return res.end('User-agent: *\nAllow: /');if(req.url==='/a'){res.writeHead(301,{location:'/b'});return res.end();}if(req.url==='/b'){res.writeHead(307,{location:'/done'});return res.end();}res.end('done');});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
 try{const n=new SafeNetwork({fixtureOrigins:[origin]});const result=await n.get(origin+'/a');assert.equal(result.body.toString(),'done');assert.deepEqual(result.redirects,[{from:origin+'/a',to:origin+'/b',status:301},{from:origin+'/b',to:origin+'/done',status:307}]);assert.equal(requests,4);await n.get(origin+'/a');assert.equal(requests,4);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
test('standalone native rebuild imports owner rules and recreates them after a permalink edit',{timeout:60000},async()=>{
 const {extract}=await import('../engine/extract.mjs'),{generate}=await import('../engine/generate.mjs'),{run}=await import('../engine/pipeline.mjs'),{parseContent,YAML}=await import('../scripts/source-project.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'redirect-build-'));try{
  const p=extract('<html><head><title>New</title></head><body><main><h1>New</h1><p>Public page.</p><a href="/observed/">Observed alias</a></main></body></html>','https://old.example/new/');p.styles=[];p.documentURL=p.url;
  await generate({source:'https://old.example/',identity:{title:'Redirects'},navigation:[],design:{},metrics:{},pages:[p,{...p,url:'https://old.example/observed/',route:'/observed/',documentURL:p.url}],media:[],observedRedirects:[{from:'https://old.example/observed/',to:'https://old.example/new/',status:302}]},dir);
  await writeFile(path.join(dir,'redirects.import.json'),JSON.stringify({redirects:[rule('/legacy/','/new/')]}));
  const routes=JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8')),file=path.join(dir,'content/pages/'+routes[0].slug+'.md'),{meta,body}=parseContent(await readFile(file,'utf8'),file);meta.permalink='/moved/';await writeFile(file,'---\n'+YAML.stringify(meta)+'---\n'+body);
  await run(process.execPath,['scripts/build.mjs','--base-path','/project'],{cwd:dir,timeout:45000});const text=await readFile(path.join(dir,'output/_redirects'),'utf8');assert.match(text,/\/project\/legacy\/ \/project\/moved\/ 301/);assert.match(text,/\/project\/observed\/ \/project\/moved\/ 302/);assert.match(text,/\/project\/new\/ \/project\/moved\/ 301/);
  assert.match(await readFile(path.join(dir,'output/legacy/index.html'),'utf8'),/\/project\/moved\//);const report=JSON.parse(await readFile(path.join(dir,'redirect-report.json'),'utf8'));assert.match(await readFile(path.join(dir,'output/moved/index.html'),'utf8'),/href="\/project\/moved\/" data-migration-redirect="\/observed\/"/);assert.equal(routes.length,1);assert.equal(report.rules.length,3);assert.equal(report.issues.length,0);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Cloudflare declaration and count limits are reported rather than emitted as invalid rules',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'redirect-limits-'));try{
  const report=await exportRedirects({...options,output:dir,imported:{redirects:[rule('/'+ 'x'.repeat(1100),'/new/'),...Array.from({length:2001},(_,i)=>rule('/file'+i+'.pdf','/new/'))]}});
  assert.equal((await readFile(path.join(dir,'_redirects'),'utf8')).trim().split('\n').length,2000);assert.equal(report.issues.filter(i=>i.reason==='cloudflare-rule-limit').length,2);assert.ok(report.issues.some(i=>i.reason==='static-path-exceeds-filesystem-limit'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('explicit enabled state matches Redirection despite a stale disabled group status',()=>{
 const plan=redirectPlan({...options,imported:{groups:[{id:7,status:'disabled'}],redirects:[rule('/enabled/','/new/',{group_id:7}),rule('/disabled/','/new/',{group_id:7,enabled:false}),rule('/unknown/','/new/',{group_id:7,enabled:undefined})]}});assert.deepEqual(plan.rules.map(r=>r.from),['/enabled/']);assert.ok(plan.issues.some(i=>i.reason==='group-status-conflicts-with-enabled-rule'));
});
test('rule-only plugin exports retain explicit enabled state and report truly missing state',()=>{
 const plan=redirectPlan({...options,imported:{redirects:[rule('/enabled/','/new/',{group_id:3}),rule('/unknown/','/new/',{group_id:3,enabled:undefined})]}});assert.deepEqual(plan.rules.map(r=>r.from),['/enabled/']);assert.ok(plan.issues.some(i=>i.reason==='missing-group-state'));
});

test('static navigation resolves local redirect chains without changing authored or dynamic links',async()=>{
 const {load}=await import('cheerio'),{applyRedirectNavigation}=await import('../scripts/redirect-export.mjs');
 const routes=[{route:'/new/'},{route:'/real/'}],plan=redirectPlan({source:'https://old.example/',routes,observed:[{from:'/old/',to:'/new/',status:308},{from:'/chain/',to:'/old/',status:307},{from:'/real/',to:'/new/',status:301},{from:'/outside/',to:'https://outside.example/',status:301}]});
 const $=load('<a data-migration-unavailable="/old/" aria-disabled="true">Old</a><a href="/site/chain/">Chain</a><a href="/real/">Authored</a><a href="/outside/">External target</a><a href="/old/?q=1">Query</a><a href="/old/" data-migration-dynamic="true">Action</a>');
 assert.deepEqual(applyRedirectNavigation($,plan,{routes,source:'https://old.example/',base:'/site'}),[{from:'/old/',to:'/new/'},{from:'/chain/',to:'/new/'}]);
 assert.equal($('a').eq(0).attr('href'),'/site/new/');assert.equal($('a').eq(0).attr('aria-disabled'),undefined);
 assert.equal($('a').eq(2).attr('href'),'/real/');assert.equal($('a').eq(3).attr('href'),'/outside/');assert.equal($('a').eq(4).attr('href'),'/old/?q=1');assert.equal($('a').eq(5).attr('href'),'/old/');
});
