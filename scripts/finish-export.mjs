import {inspectMenus,renderMenu,refreshMenuCurrentState,remapMenuURL} from './menu-authoring.mjs';
import {readFile,writeFile,readdir,stat,lstat,cp,mkdir,rm} from 'node:fs/promises';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {load,esc,optionalJSON,routeSafe,within} from './source.mjs';
const run=promisify(execFile);
export function checkOutputName(name){if(!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(name)||/^(?:content|templates|assets|static|scripts|tools|abilities|kennel_packages)(?:\/|$)/.test(name))throw Error('Unsafe output directory');return name;}
export async function walk(root){let files=[];for(const entry of await readdir(root,{withFileTypes:true})){const file=path.join(root,entry.name);if(entry.isSymbolicLink())throw Error('Symlinks are not portable: '+file);if(entry.isDirectory())files.push(...await walk(file));else files.push(file);}return files;}
export async function applyNavigation(html,project,base,route){
 const current=await optionalJSON('navigation.json',[]),original=await optionalJSON('navigation-baseline.json',current),$=load(html);
 const moved=new Map(project.original.map(p=>[p.route,project.routes.find(r=>r.collection===p.collection&&r.slug===p.slug)?.route]));
 const authored=await optionalJSON('menus.json',{schema:'website-cloner-menus/v1',menus:{}});
 if(authored.schema!=='website-cloner-menus/v1'||!authored.menus||typeof authored.menus!=='object'||Array.isArray(authored.menus))throw Error('Invalid menus.json');
 let discovered=false;const edited=new Set(),stateMenus=new Set();
 for(const menu of inspectMenus($,base,moved)){
  if(!Object.hasOwn(authored.menus,menu.id)){authored.menus[menu.id]={items:menu.items};discovered=true;}
  else if(JSON.stringify(authored.menus[menu.id].items)!==JSON.stringify(menu.items)){renderMenu($,menu,authored.menus[menu.id].items,{base,moved});edited.add(menu.nav);}
  const changedRoute=nodes=>nodes.some(n=>remapMenuURL(n.url,moved)!==n.url||n.children&&changedRoute(n.children));
  if(edited.has(menu.nav)||changedRoute(menu.items))stateMenus.add(menu.nav);
 }
 if(discovered)await writeFile('menus.json',JSON.stringify(authored,null,2)+'\n');
 const items=current.filter(n=>n.url).map(n=>({...n,url:moved.has(n.url)?moved.get(n.url):n.url})).filter(n=>n.url);
 const href=n=>n.url.startsWith('/')&&!n.url.startsWith('//')?base+n.url:n.url;
 $('[data-migration-navigation]').html(items.map(n=>`<a href="${esc(href(n))}">${esc(n.label)}</a>`).join(' '));
 if(JSON.stringify(current)!==JSON.stringify(original)){
  $('header nav').each((_,nav)=>{
   if(edited.has(nav))return;
   for(const old of original){const matched=$(nav).find('a').filter((_,a)=>$(a).attr('href')===base+old.url||$(a).text().trim()===old.label);const now=items.find(n=>n.url===old.url)||items[original.indexOf(old)];if(now)matched.attr('href',href(now)).text(now.label);else matched.remove();}
   for(const item of items.slice(original.length))$(nav).append(`<a href="${esc(href(item))}">${esc(item.label)}</a>`);
  });
 }
 for(const nav of stateMenus)refreshMenuCurrentState($,nav,{route,base});
 return $.html();
}
export async function aliases(routes,base,site){
 const fileKey=value=>{const route=decodeURIComponent(value);return (route.endsWith('/')||!path.posix.extname(route)?route.replace(/\/?$/,'/')+'index.html':route);};
 const extra=[],taken=new Set(routes.map(p=>fileKey(p.route)));
 const runtime=/<script data-kujo-webmcp>[\s\S]*?<\/script>/.exec(await readFile('templates/layout.html','utf8'))?.[0]||'';
 for(const p of routes){const values=[...(p.meta?.aliases||[]),...(p.sourceRoute&&p.sourceRoute!==p.route?[p.sourceRoute]:[])];if(!Array.isArray(p.meta?.aliases||[]))throw Error('aliases must be an array');
  for(const raw of new Set(values)){const alias=routeSafe(raw);if(fileKey(alias)===fileKey(p.route))continue;if(taken.has(fileKey(alias)))throw Error('Alias conflicts with route: '+alias);taken.add(fileKey(alias));
   const dest='output'+fileKey(alias);await mkdir(path.dirname(dest),{recursive:true});
   await writeFile(dest,`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,follow"><meta http-equiv="refresh" content="0;url=${esc(base+p.route)}"><title>${esc(p.title)}</title><link rel="canonical" href="${esc(site+base+p.route)}"><link rel="kujo-site-index" href="${base}/.well-known/kujo-site-index.json"></head><body><main><h1>${esc(p.title)}</h1><a href="${esc(base+p.route)}">Continue</a></main>${runtime}</body></html>`);
   extra.push({route:alias,collection:'pages',robots:'noindex,follow',canonicalRoute:p.route,generatedAlias:true});
  }
 }
 return extra;
}
export async function finishExport(cfg,base){
 if(await stat('static').catch(()=>null))for(const file of await walk('static')){
  const relative=path.relative('static',file);if(/^(?:\.well-known[\/\\]|feed[\/\\]|sitemap\.xml$|robots\.txt$|llms\.txt$|export-routes\.json$|archive-manifest\.json$)/.test(relative))throw Error('Reserved static output: '+relative);
  const dest=path.join('output',relative);if(await stat(dest).catch(()=>null)&&!['404.html','favicon.svg','favicon.ico'].includes(relative)&&!relative.startsWith('assets/'))throw Error('Static file collides with generated content: '+relative);
  await mkdir(path.dirname(dest),{recursive:true});await cp(file,dest);
 }
 const favicon=(await stat('output/favicon.svg').catch(()=>null))?'favicon.svg':(await stat('output/favicon.ico').catch(()=>null))?'favicon.ico':null;
 if(favicon)for(const file of await walk('output'))if(file.endsWith('.html')){const html=await readFile(file,'utf8');if(!/rel=["'](?:shortcut )?icon["']/.test(html))await writeFile(file,html.replace('</head>',`<link rel="icon" href="${base}/${favicon}"></head>`));}
 if(cfg.minify){
  let binary=process.env.SSG_ESBUILD_BIN;
  if(!binary){const candidate=path.resolve('node_modules/.bin/esbuild');if(await stat(candidate).catch(()=>null))binary=candidate;}
  if(!binary)throw Error('Minification requires npm install (pinned esbuild 0.28.2) or SSG_ESBUILD_BIN.');
  const version=await run(binary,['--version']);if(version.stdout.trim()!=='0.28.2')throw Error('Use pinned esbuild 0.28.2');
  for(const file of await walk('output/assets'))if(/\.(css|js)$/.test(file)&&!file.endsWith('.min.js')&&!file.endsWith('.min.css')){
   const temp=file+'.minifying';await run(binary,[file,'--minify-whitespace','--legal-comments=inline','--outfile='+temp],{timeout:120000,maxBuffer:1e6});await cp(temp,file);await rm(temp);
  }
 }
 await writeFile('output/.migration-output','Generated; edit content/templates/assets instead.\n');
 const destination=cfg.output==='.ssg-output'?'output':cfg.output||'output';checkOutputName(destination);
 if(destination!=='output'){
  if(await stat(destination).catch(()=>null)){await within(destination);if(!(await stat(destination+'/.migration-output').catch(()=>null)))throw Error('Refusing to replace an unmarked output directory');}
  await rm(destination,{recursive:true,force:true});await cp('output',destination,{recursive:true});
 }
}
