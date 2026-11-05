import {readFile,writeFile,mkdir,readdir,stat,cp,access,rm} from 'node:fs/promises';
import {watch,createReadStream} from 'node:fs';
import {spawn} from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readLayoutData,load,readConfig,loadProject,routeSafe,within,YAML,optionalJSON,parseContent} from './source.mjs';
import {checkAgentExport} from './check-agent-export.mjs';
const command=process.argv[2]||'help',args=process.argv.slice(3);
const flag=(name,fallback)=>{const index=args.indexOf(name);return index<0?fallback:args[index+1];};
const run=(cmd,argv,options={})=>new Promise((resolve,reject)=>{const p=spawn(cmd,argv,{stdio:'inherit',...options});p.on('error',reject);p.on('exit',code=>code===0?resolve():reject(Error(cmd+' exited '+code)));});
const cfg=await readConfig(),output=flag('--output',cfg.output||'output');
function outputPath(value){if(!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(value)||/^(?:content|templates|assets|scripts|tools|abilities|kennel_packages)(?:\/|$)/.test(value))throw Error('Unsafe output directory');return value;}
outputPath(output);
async function validate(){
 const manifest=await optionalJSON(output+'/export-routes.json',null);if(!manifest)throw Error('Build the site first');
 const index=await optionalJSON(output+'/.well-known/kujo-site-index.json',null);if(!index)throw Error('Missing WebMCP index');
 const base=new URL(index.site.url).pathname.replace(/\/$/,'');
 await checkAgentExport(output,manifest,base);
 const errors=[],warnings=[];
 for(const record of manifest){
  const file=path.join(output,record.route.endsWith('/')||!path.posix.extname(record.route)?decodeURIComponent(record.route)+'/index.html':decodeURIComponent(record.route)),html=await readFile(file,'utf8'),$=load(html);
  const headings=$('h1').length,baseline=1;
  if(!$('head > title').text()||!$('html').attr('lang')||headings<1||headings>Math.max(1,baseline))errors.push(record.route+': title/language/heading contract');

  for(const el of $('a[href],img[src],link[href],script[src]')){
   const href=$(el).attr('href')||$(el).attr('src');if(!href?.startsWith('/')||href.startsWith('//'))continue;
   let route=decodeURIComponent(href.split(/[?#]/)[0]);if(base&&route.startsWith(base+'/'))route=route.slice(base.length);
   if(route.split('/').includes('..')){errors.push('Escaping reference '+href);continue;}
   const target=path.join(output,route);const exists=await stat(target).catch(()=>null);
   if(!exists||(exists.isDirectory()&&!(await stat(path.join(target,'index.html')).catch(()=>null))))errors.push(record.route+': missing '+href);
  }
 }
 for(const file of ['sitemap.xml','robots.txt','llms.txt','feed/index.xml'])await access(output+'/'+file);
 const result={status:errors.length?'failed':warnings.length?'passed-with-source-warnings':'passed',pages:manifest.length,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
 await writeFile('validation-report.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(errors.length)throw Error('Export validation failed; see validation-report.json');
}
if(command==='validate')await validate();
else if(command==='new'){
 const collection=flag('--type','posts'),slug=flag('--slug','');if(!/^[a-z][a-z0-9-]*$/.test(collection)||!/^[a-z0-9-]+$/.test(slug))throw Error('Use --type posts|pages|collection --slug lowercase-name');
 const permalink=routeSafe(flag('--permalink','/'+(collection==='pages'||collection==='posts'?'':collection+'/')+slug+'/'));
 const title=flag('--title',slug.replaceAll('-',' '));await mkdir('content/'+collection,{recursive:true});
 let newLayoutData=null;
 let meta={title,permalink,draft:true,date:new Date().toISOString(),description:'',template:'native',categories:[],tags:[]},body='Write your content here.';
 const role=flag('--layout',collection==='posts'?'single-post':collection==='pages'?'default-page':'single-'+collection.replace(/^wp-/,''));
 const layout=await optionalJSON('content-layout.json',{records:{}});
 const candidates=Object.entries(layout.records).filter(([file,r])=>file.startsWith('content/'+collection+'/')&&r.metadata.template_role===role).sort((a,b)=>a[1].slots.length-b[1].slots.length||a[0].localeCompare(b[0]));
 if(args.includes('--layout')&&!candidates.length)throw Error('No captured template for '+role+' in '+collection);
 if(candidates.length){
  const [file,record]=candidates[0],sample=parseContent(await readFile(await within(file+'.md'),'utf8'),file);
  const data=await readLayoutData(sample.meta.layout_data);
  meta={...sample.meta,...meta,template:'migration',seo_title:title,canonical:'',wordpress_id:null,author:'',featured_image:'',excerpt:'',last_updated:'',layout_data:'templates/data/'+collection+'-'+slug+'.json'};
  newLayoutData=data;
  const slots=data.content_slots||[];
  body=slots.length<=1?'Write your content here.':slots.map((slot,i)=>'<!-- content-slot:'+(slot.name||slot.key)+' -->\n\n'+(i===0?title:'Write this section here.')).join('\n\n');
  console.log('Using shared '+role+' template; '+slots.length+' editable content sections.');
 }
 await writeFile(`content/${collection}/${slug}.md`,'---\n'+YAML.stringify(meta)+'---\n\n'+body+'\n',{flag:'wx'});
 try{if(newLayoutData)await writeFile(meta.layout_data,JSON.stringify(newLayoutData,null,2),{flag:'wx'});}catch(error){await rm(`content/${collection}/${slug}.md`);throw error;}
 console.log('Created draft '+collection+'/'+slug+'.md');
}else if(command==='serve'||command==='dev'){
 if(command==='dev')await run(process.execPath,['scripts/build.mjs','--drafts']);
 const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.woff2':'font/woff2','.xml':'application/xml','.txt':'text/plain'};
 const server=http.createServer(async(req,res)=>{try{let pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);const base=cfg.base_path||'';if(base&&pathname.startsWith(base+'/'))pathname=pathname.slice(base.length);if(pathname.includes('\\')||pathname.split('/').includes('..'))throw Error('Invalid route');let file=path.join(output,pathname);await within(file);if((await stat(file)).isDirectory())file=path.join(file,'index.html');await access(file);res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');createReadStream(file).pipe(res);}catch{res.statusCode=404;res.end('Not found');}});
 server.listen(Number(flag('--port','8080')),'127.0.0.1',()=>console.log('Preview http://127.0.0.1:'+server.address().port));
 if(command==='dev'){let timer,running=false,pending=false;const rebuild=async()=>{if(running){pending=true;return;}running=true;try{await run(process.execPath,['scripts/build.mjs','--drafts']);}catch(e){console.error(e.message);}finally{running=false;if(pending){pending=false;rebuild();}}};
  for(const directory of ['content','templates','assets','static']){await mkdir(directory,{recursive:true});watch(directory,{recursive:true},()=>{clearTimeout(timer);timer=setTimeout(rebuild,250);});}
  for(const file of ['kujo-ssg.json','kujo-ssg.yml','kujo-ssg.yaml','navigation.json','menus.json','archive-bindings.json'])if(await stat(file).catch(()=>null))watch(file,()=>{clearTimeout(timer);timer=setTimeout(rebuild,250);});
 }
}else if(command==='docs-import'){
 await run(process.env.KUJO_BIN||'kujo',['run','--interpreter','tools/ssg/scripts/docgen_ssg_bridge.kujo','--','--ssg-root',process.cwd(),'--content-out','content/reference','--skip-build','--skip-validation',...args]);
 await cp('tools/ssg/starters/docs-site/templates/page-docs.html','templates/page-docs.html');
 await mkdir('assets/css',{recursive:true});await cp('tools/ssg/starters/docs-site/assets/css/style.css','assets/css/docs.css');
 console.log('Documentation Markdown imported; run npm run build.');
}else if(command==='docs-starter'){
 const destination=args[0];if(!destination||await stat(destination).catch(()=>null))throw Error('Supply a new destination directory');await cp('tools/ssg/starters/docs-site',destination,{recursive:true});
 await cp('build.kujo',path.join(destination,'build.kujo'));
 await mkdir(path.join(destination,'scripts'),{recursive:true});
 for(const file of ['package.json','package-lock.json'])await cp('tools/ssg/'+file,path.join(destination,file));
 for(const file of ['docgen_ssg_bridge.kujo','docgen_reduce.py','docs_search_index.kujo','docs_search_index.py','update_docs.kujo','validate-generated-output.sh','test_helpers.sh'])await cp('tools/ssg/scripts/'+file,path.join(destination,'scripts',file));
 await cp('scripts/source.mjs',path.join(destination,'scripts/source.mjs'));
 await writeFile(path.join(destination,'scripts/build-docs.mjs'),`import {readConfig} from './source.mjs';import {spawnSync} from 'node:child_process';const cfg=await readConfig();const r=spawnSync(process.env.KUJO_BIN||'kujo',['run','--interpreter','build.kujo','--','--site-url',process.env.SITE_URL||cfg.site_url],{stdio:'inherit'});process.exit(r.status??1);`);
 const pkg=JSON.parse(await readFile(path.join(destination,'package.json'),'utf8'));pkg.scripts={...pkg.scripts,build:'node scripts/build-docs.mjs',serve:'kujo serve output --port 8080'};await writeFile(path.join(destination,'package.json'),JSON.stringify(pkg,null,2));
 console.log('Created '+destination);
}else if(command==='check-tools')await run(process.env.KUJO_BIN||'kujo',['run','--interpreter','tests/ability_pack_tests.kujo']);
else if(command==='package'){
 await validate();const destination=flag('--destination','website.tar');if(!/^[a-zA-Z0-9_-]+\.tar$/.test(destination))throw Error('Use a local .tar filename');
 await run('python3',['scripts/package-export.py',destination]);
}else console.log('Commands: new, validate, serve, dev, package, docs-import, docs-starter, check-tools');
