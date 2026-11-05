import {formatFieldNumber} from './custom-field-numbers.mjs';
import {taxonomyClassPlan,applyTaxonomyClasses} from './taxonomy-classes.mjs';
export {applyTaxonomyClasses};
import {inheritedArchivePresentation} from './archive-presentation.mjs';
import {applyProductPresentation,renderProductResultCount} from './product-presentation.mjs';
import {renderSliderSequences} from './slider-authoring.mjs';
import {renderComponentMedia} from './component-media.mjs';
import {normalizeEventDates,renderEventDates,formatEventValue,eventFormat} from './event-presentation.mjs';
import {nativeMarkdownInput,restoreNativeHeadings} from './markdown-compat.mjs';
import {metadataFingerprint} from './metadata-fingerprint.mjs';
import {load} from 'cheerio/slim';
import YAML from 'yaml';
import {readFile,writeFile,readdir,mkdir,stat,realpath,rm} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
export {load,YAML};
const run=promisify(execFile),hash=s=>createHash('sha256').update(s).digest('hex');
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function optionalJSON(file,fallback){try{return JSON.parse(await readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return fallback;throw e;}}
export function routeSafe(route){
 if(typeof route!=='string'||!route.startsWith('/')||/[\\?#\x00-\x20]/.test(route)||route.includes('//'))throw Error('Unsafe permalink: '+route);
 for(const part of route.split('/')){const d=decodeURIComponent(part);if(d==='.'||d==='..'||/[\/\\\x00-\x1f]/.test(d))throw Error('Unsafe permalink: '+route);}
 if(/^\/(?:assets|images|\.well-known)(?:\/|$)/.test(route)||['/sitemap.xml','/robots.txt','/llms.txt','/export-routes.json','/archive-manifest.json','/feed/index.xml'].includes(route))throw Error('Reserved output route: '+route);
 return route;
}
export async function readConfig(){for(const file of ['kujo-ssg.yml','kujo-ssg.yaml','kujo-ssg.json']){try{return YAML.parse(await readFile(file,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;}}throw Error('Missing SSG configuration');}
export function parseContent(text,file){
 const match=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
 if(!match)throw Error('Missing or unclosed frontmatter: '+file);
 const meta=YAML.parse(match[1]);if(!meta||typeof meta!=='object'||Array.isArray(meta))throw Error('Invalid frontmatter: '+file);
 return {meta,body:text.slice(match[0].length).trim()};
}
export async function within(file){const root=await realpath('.'),resolved=await realpath(file);if(!resolved.startsWith(root+path.sep))throw Error('Source path escapes project: '+file);return file;}
export function resolveLayoutData(value,shared,trail=new Set()){
 if(!value||typeof value!=='object')return value;
 if(Object.hasOwn(value,'$shared')){
  const id=value.$shared;
  if(Object.keys(value).length!==1||typeof id!=='string'||!Object.hasOwn(shared,id))throw Error('Missing shared layout binding: '+id);
  if(trail.has(id))throw Error('Circular shared layout binding: '+id);
  return resolveLayoutData(shared[id],shared,new Set([...trail,id]));
 }
 return Array.isArray(value)?value.map(v=>resolveLayoutData(v,shared,trail)):Object.fromEntries(Object.entries(value).map(([k,v])=>[k,resolveLayoutData(v,shared,trail)]));
}
export async function readLayoutData(file){
 const data=JSON.parse(await readFile(await within(file),'utf8'));
 const shared=await optionalJSON('templates/data/shared.json',{});
 return resolveLayoutData(data,shared);
}
export async function loadProject(cfg){
 const original=await optionalJSON('routes.json',[]),layout=await optionalJSON('content-layout.json',{records:{}});
 const canonical=['migration-content/v1','migration-content/v2'].includes(layout.schema),sourceV2=layout.schema==='migration-content/v2',routes=[],drafts=[],allMetadata={};
 const dirs=await readdir('content',{withFileTypes:true});
 for(const dir of dirs){if(!dir.isDirectory()||!/^[a-z][a-z0-9-]*$/.test(dir.name))continue;
  for(const name of (await readdir('content/'+dir.name)).sort()){
   if(!name.endsWith(canonical?'.md':'.json'))continue;
   const slug=name.replace(/\.(?:md|json)$/,''),file=`content/${dir.name}/${slug}`;
   if(!/^[a-z0-9-]+$/.test(slug))throw Error('Use a lowercase slug for '+file);
   await within(file+(canonical?'.md':'.json'));
   const old=original.find(p=>p.slug===slug&&p.collection===dir.name)||{},saved=layout.records[file];
   let meta,body='',fragment;
   if(canonical){({meta,body}=parseContent(await readFile(file+'.md','utf8'),file));
    // Compatibility for older editors: accept JSON changes only while frontmatter is unchanged.
    const legacy=sourceV2?null:await optionalJSON(file+'.json',null);
    if(saved&&legacy&&JSON.stringify(legacy)!==JSON.stringify(saved.legacyMetadata)){
     if(JSON.stringify(meta)!==JSON.stringify(saved.metadata))throw Error('Conflicting Markdown and legacy JSON edits: '+file);
     meta={...meta,...legacy};
    }
    if(!sourceV2&&saved&&hash(body)===saved.bodyHash)fragment=await readFile(await within(file+'.html'),'utf8');
   }else meta=JSON.parse(await readFile(file+'.json','utf8'));
   if(sourceV2&&meta.layout_data){
    if(!/^templates\/data\/[a-z0-9-]+\.json$/.test(meta.layout_data))throw Error('Unsafe layout data path: '+file);
    const data=await readLayoutData(meta.layout_data);
    const authored={...meta};delete authored.layout_data;
    // Only presentation fields may be loaded from the sidecar; authored fields win.
    meta={...(data.layout_regions?{layout_regions:data.layout_regions}:{}),layout_repeats:data.layout_repeats||{},layout_attributes:data.layout_attributes||{},layout_values:data.layout_values||{},components:data.components||{},content_slots:data.content_slots||[],...authored};
   }
   if(saved&&saved.metadata.seo_title===saved.metadata.title&&meta.title!==saved.metadata.title&&meta.seo_title===saved.metadata.seo_title)meta.seo_title=meta.title;
   const permalink=routeSafe(meta.permalink||old.route||('/'+(dir.name==='pages'||(dir.name==='posts'&&cfg.posts_at_root!==false)?'':dir.name+'/')+slug+'/'));
   const record={...old,slug,collection:dir.name,route:permalink,canonicalRoute:permalink===old.route?old.canonicalRoute:permalink,title:meta.title||slug,description:meta.description||'',date:meta.date||'',excerpt:meta.excerpt||'',robots:meta.robots||old.robots||'',bodyClass:old.bodyClass||'',meta,body,fragment,file,saved,sourceRoute:old.route,styleSlug:old.slug||original.find(r=>r.collection===dir.name)?.slug||original[0]?.slug};
   allMetadata[file]=meta;
   if(meta.draft===true||meta.status==='draft'){drafts.push(record);if(!process.argv.includes('--drafts')&&process.env.SSG_DRAFTS!=='1')continue;record.robots='noindex,nofollow';record.meta={...meta,draft:false};}
   if(routes.some(p=>p.route===permalink))throw Error('Duplicate permalink: '+permalink);
   routes.push(record);
  }
 }
 const lookups={};
 for(const name of await readdir('content'))if(/\.ya?ml$/.test(name))lookups[name.replace(/\.ya?ml$/,'')]=YAML.parse(await readFile(await within('content/'+name),'utf8'))||{};
 for(const p of routes){p.taxonomies={};for(const [name,values]of Object.entries({categories:p.meta.categories||[],tags:p.meta.tags||[],...p.meta.taxonomies})){
  if(!Array.isArray(values))throw Error('Taxonomy must be an array: '+p.file+' '+name);
  const lookup=lookups[p.collection+'-'+name]||lookups[name]||{};
  p.taxonomies[name]=[...new Set(values.map(value=>String(lookup[value]?.name??lookup[value]??value)))];
 }}
 const taxonomyClasses=taxonomyClassPlan(await optionalJSON('wordpress-mapping.json',{}),lookups);
 return {routes,drafts,original,canonical,lookups,sourceV2,taxonomyClasses};
}
// Kujo read_file has an 8 MiB limit. Bound UTF-8 JSON batches and render
// identical Markdown once, retaining every original slot/route in the result.
export function markdownBatches(inputs,limit=4*1024*1024){
 const unique=new Map(),aliases=new Map(),batches=[];let batch=[],bytes=2;
 for(const input of inputs){
  const key=hash(input.body);if(unique.has(key)){aliases.set(input.id,unique.get(key).id);continue;}
  unique.set(key,input);aliases.set(input.id,input.id);
  const native=nativeMarkdownInput([input])[0],size=Buffer.byteLength(JSON.stringify(native))+1;
  if(size+2>limit)throw Error('Markdown section exceeds native render batch size: '+input.id);
  if(bytes+size>limit){batches.push(batch);batch=[];bytes=2;}
  batch.push(native);bytes+=size;
 }
 if(batch.length)batches.push(batch);
 return {batches,aliases,unique:[...unique.values()]};
}
async function renderNativeMarkdown(inputs){
 const {batches,aliases,unique}=markdownBatches(inputs),raw={};
 try{
  for(const batch of batches){
   await writeFile('.markdown-input.json',JSON.stringify(batch));
   await run(process.env.KUJO_BIN||'kujo',['run','--interpreter','scripts/render-markdown.kujo'],{timeout:600000,maxBuffer:1e6});
   const output=JSON.parse(await readFile('.markdown-output.json','utf8'));
   for(const item of batch){if(typeof output[item.id]!=='string')throw Error('Markdown rendering failed: '+item.id);raw[item.id]=output[item.id];}
  }
 }finally{await rm('.markdown-input.json',{force:true});await rm('.markdown-output.json',{force:true});}
 const rendered=restoreNativeHeadings(raw,unique);
 return Object.fromEntries([...aliases].map(([id,original])=>[id,rendered[original]]));
}
export async function prepareContent(project){
 for(const p of project.routes)if(p.meta.event&&p.saved)p.meta.event=normalizeEventDates(p.meta.event,p.saved?.metadata.event);
 if(project.sourceV2){await prepareMarkdownSources(project);refreshEventPresentation(project);return;}
 const needs=project.routes.filter(p=>p.fragment===undefined&&project.canonical);
 if(needs.length){
  const raw=new Map();
  const input=needs.map(p=>({id:p.file,body:p.body.replace(/^```\{=html\}\r?\n([\s\S]*?)^```\s*$/gm,(_,html)=>{const key='RAWBLOCK'+hash(html);raw.set(key,html);return '\n\n'+key+'\n\n';})}));
  const rendered=await renderNativeMarkdown(input);
  for(const p of needs){let html=rendered[p.file];if(typeof html!=='string')throw Error('Markdown rendering failed: '+p.file);
   for(const [key,block]of raw)html=html.replaceAll('<p>'+key+'</p>',block);
   let wrapper=p.saved?await readFile(await within(p.saved.wrapper),'utf8'):'MIGRATION_MARKDOWN_BODY';
   p.fragment=wrapper.replace('MIGRATION_MARKDOWN_BODY',html);
  }
 }
 for(const p of project.routes){
  if(p.fragment===undefined)p.fragment=await readFile(await within(p.file+'.html'),'utf8');
  const $=load(p.fragment,null,false);
  // Keep source wrapper/design while propagating title and date edits.
  if(p.saved&&p.meta.title!==p.saved.metadata.title)$('h1').first().text(p.meta.title);
  if(p.saved&&p.meta.date!==p.saved.metadata.date)$('time[datetime]').first().attr('datetime',p.meta.date).text(p.meta.date);
  p.fragment=$.html();
 }
 refreshEventPresentation(project);
}
function refreshEventPresentation(project){
 for(const p of project.routes)if(p.meta.event){const $=load(p.fragment,null,false),locale=p.meta.lang||p.lang||'en';const baseline=p.saved?.metadata.event||project.routes.find(r=>r.saved?.metadata.event&&r.meta.content_template===p.meta.content_template&&eventFormat($('.tribe-event-date-start').first().text(),r.saved.metadata.event.start,locale))?.saved.metadata.event;if(!p.saved)p.meta.event=normalizeEventDates(p.meta.event,baseline);p.eventPresentationIssues=renderEventDates($,p.meta.event,baseline,{locale});p.fragment=$.html();}
}
export function refreshLinks(html,project){
 const $=load(html,null,false),newByFile=new Map(project.routes.map(p=>[p.collection+'/'+p.slug,p]));
 const moves=new Map(project.original.map(old=>[old.route,newByFile.get(old.collection+'/'+old.slug)?.route||null]));
 $('a[href]').each((_,el)=>{let href=$(el).attr('href');if(!href.startsWith('/')||href.startsWith('//'))return;const boundary=href.search(/[?#]/),target=boundary<0?href:href.slice(0,boundary),suffix=boundary<0?'':href.slice(boundary);if(!moves.has(target))return;const to=moves.get(target);if(to)$(el).attr('href',to+suffix);else $(el).replaceWith($('<span>').html($(el).html()));});
 return $.html();
}

export async function refreshSourceArchives(project,cfg){
 const binding=await optionalJSON('archive-bindings.json',{bindings:[],unbound:[]});
 const diagnostics=[...binding.unbound];
 const records=project.routes.filter(p=>p.collection!=='pages'&&!/\b(noindex|none)\b/i.test(p.robots));
 const byKey=new Map(project.routes.map(p=>[p.collection+'/'+p.slug,p]));
 const saved=await optionalJSON('content-layout.json',{records:{}});
 // Captured template provenance survives deletion/drafting of its sample content.
 const capturedSamples=new Map(project.original.map(p=>[p.collection+'/'+p.slug,{...p,saved:saved.records['content/'+p.collection+'/'+p.slug]}]));
 const stable=value=>JSON.stringify(value,(_,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
 const changed=records.some(p=>!p.saved||(project.sourceV2&&p.saved.bodyHash&&hash(p.body.trim()).slice(0,p.saved.bodyHash.length)!==p.saved.bodyHash)||(p.saved.metadataFingerprint
  ?metadataFingerprint(p.meta)!==p.saved.metadataFingerprint
  :stable(p.meta)!==stable(p.saved.metadata)))||Object.keys(saved.records).filter(k=>!k.startsWith('content/pages/')).some(k=>!byKey.has(k.slice('content/'.length)));
 if(!changed&&!binding.bindings.some(b=>b.mode==='native'))return {status:diagnostics.length?'needs-review':'passed',updated:[],unbound:diagnostics};
 const updated=[],fallbacks=[],inherited=[];
 let nativeCards={};
 if(binding.bindings.some(b=>b.mode==='native')){
  const inputs=records.map(p=>({slug:p.collection+'/'+p.slug,route:p.route,title:p.title,excerpt:p.excerpt||p.description||'',image:p.meta.featured_image?'/'+p.meta.featured_image.replace(/^\//,''):'',tags:p.taxonomies?.tags||[]}));
  await writeFile('.archive-input.json',JSON.stringify(inputs));
  try{await run(process.env.KUJO_BIN||'kujo',['run','--interpreter','scripts/render-archive-cards.kujo'],{timeout:120000,maxBuffer:1e6});nativeCards=JSON.parse(await readFile('.archive-cards.json','utf8'));}
  finally{await rm('.archive-input.json',{force:true});await rm('.archive-cards.json',{force:true});}
  for(const input of inputs){if(typeof nativeCards[input.slug]!=='string')throw Error('Native archive card missing');nativeCards[input.slug]=nativeCards[input.slug].replace(/(<a\b[^>]*\bhref=)"[^"]*"/g,(_,prefix)=>prefix+'"'+esc(input.route)+'"');}
 }
 // Slash aliases identify one archive family and must not independently claim
 // its pagination routes. Prefer the record matching the saved canonical route.
 const rootKey=root=>root==='/'?'/':root.replace(/\/+$/,'');
 const roots=new Map();
 for(const b of binding.bindings.filter(b=>b.page===1)){
  const key=rootKey(b.root),record=byKey.get(b.source),previous=roots.get(key);
  if(!previous||record?.canonicalRoute===record?.route)roots.set(key,b);
 }
 const presentationRecords=new Map(binding.bindings.map(b=>{const p=byKey.get(b.source);return [b.source,{fragment:p?.fragment,bodyClass:p?.bodyClass,source:p?.source}];}));
 for(const savedBindingRoot of roots.values()){
  let bindingRoot=savedBindingRoot;
  if(!changed&&bindingRoot.mode!=='native')continue;
  const family=binding.bindings.filter(b=>rootKey(b.root)===rootKey(bindingRoot.root)),rootPage=byKey.get(bindingRoot.source);if(!rootPage)continue;
  const filter=bindingRoot.filter;
  let members=records.filter(p=>filter.types?filter.types.includes(p.collection):[...(p.meta[filter.taxonomy]||p.meta.taxonomies?.[filter.taxonomy]||[])].map(String).includes(String(filter.term)));
  const sortKey=bindingRoot.eventGrouping?'event-start':cfg.sort_by||'date',direction=bindingRoot.eventGrouping?(bindingRoot.eventGrouping.order==='desc'?-1:1):cfg.sort_order==='asc'?1:-1;
  members.sort((a,b)=>direction*(sortKey==='event-start'?String(a.meta.event?.start||'').localeCompare(String(b.meta.event?.start||'')):sortKey==='date'?((Date.parse(a.date)||0)-(Date.parse(b.date)||0)):String(a.meta[sortKey]||'').localeCompare(String(b.meta[sortKey]||'')))||a.route.localeCompare(b.route));
  const presentation=members.length?inheritedArchivePresentation(bindingRoot,binding.bindings,presentationRecords):null;
  if(presentation?.issue)diagnostics.push({route:rootPage.route,reason:presentation.issue});
  else if(presentation){bindingRoot={...bindingRoot,mode:undefined,rootContainer:false,template:presentation.template,cards:presentation.cards,sample:presentation.sample,pageSize:presentation.pageSize,presentationContainer:presentation.containerHTML,presentationBefore:presentation.beforeHTML,inheritedFrom:presentation.source};inherited.push({route:rootPage.route,source:presentation.source});}
  const size=Math.max(1,Number(bindingRoot.pageSize)||Number(cfg.posts_per_page)||20),count=Math.max(1,Math.ceil(members.length/size));
  const pageURL=n=>n===1?bindingRoot.root:bindingRoot.root.replace(/\/?$/,'/')+'page/'+n+'/';
  // Retire old pagination routes when membership shrinks; source files remain editable.
  for(const b of family.filter(b=>b.page>count)){const item=byKey.get(b.source);if(item)project.routes.splice(project.routes.indexOf(item),1);}
  for(let page=1;page<=count;page++){
   const b=(page===1?bindingRoot:family.find(b=>b.page===page))||bindingRoot;
   let p=byKey.get(b.source);
   if(page!==b.page){if(project.routes.some(record=>record.route===pageURL(page)))throw Error('Archive pagination conflicts with content: '+pageURL(page));p={...rootPage,slug:rootPage.slug+'-archive-'+page,route:pageURL(page),canonicalRoute:pageURL(page),styleSlug:rootPage.slug,generatedSourceArchive:true,archiveBindingSource:bindingRoot.source,archivePage:page,sourceRoute:undefined,meta:{...rootPage.meta,aliases:[],permalink:pageURL(page)}};project.routes.push(p);}
   const $=load(p.fragment,null,false);
   // Native content templates include the site shell. Resolve the original
   // fragment root through its marked cards instead of appending outside main.
   const rootParents=b.rootContainer?[...new Set($('[data-migration-record]').toArray().filter(node=>Object.hasOwn(b.cards||{},$(node).attr('data-migration-record'))).map(node=>node.parent))]:[];
   let container=b.rootContainer?(rootParents.length===1?$(rootParents[0]):$()):$('[data-migration-archive="'+b.id+'"]');
   if(container.length!==1){diagnostics.push({route:p.route,reason:'Archive binding container missing'});continue;}
   const selected=members.slice((page-1)*size,page*size);
   if(b.inheritedFrom&&selected.length){const replacement=$(b.presentationContainer).attr('data-migration-archive',b.id);container.replaceWith(replacement);container=replacement;if(b.presentationBefore)container.before(b.presentationBefore);$('[data-migration-empty-archive="'+b.id+'"]').remove();}
   let lastMonth;
   const cards=selected.map(record=>{
    if(b.mode==='native')return nativeCards[record.collection+'/'+record.slug];
    const key=record.collection+'/'+record.slug,originalCard=b.cards?.[key];
    const card=load(originalCard||b.template,null,false),sample=originalCard?record:(byKey.get(b.sample)||capturedSamples.get(b.sample)),sampleRoute=sample?.sourceRoute||sample?.route;
    card('[class]').each((_,el)=>card(el).attr('class',(card(el).attr('class')||'').split(/\s+/).filter(c=>!/^post-\d+$/.test(c)).join(' ')));
    card('[data-migration-record]').attr('data-migration-record',record.collection+'/'+record.slug);
    diagnostics.push(...applyTaxonomyClasses(card,card('[data-migration-record]'),record,project).map(issue=>({route:record.route,issue})));
    card('[id]').removeAttr('id');
    card('a[href]').each((_,el)=>{const a=card(el),href=a.attr('href')?.split('#')[0];if(href===sampleRoute||a.closest('h2,h3,h4').length){a.attr('href',record.route);if(!a.find('img,picture,svg').length&&(a.closest('h2,h3,h4').length||a.hasClass('wp-block-post-title')||a.text().trim()===sample?.title))a.text(record.title);else if(a.hasClass('wp-block-read-more'))a.find('.screen-reader-text').text(': '+record.title);}});
    card('h2,h3,h4').each((_,el)=>{const h=card(el);if(!h.find('a').length)h.text(record.title);});
    applyProductPresentation(card,record.meta.product,originalCard?record.saved?.metadata.product:undefined,{archive:true});
    const content=card('.entry-content,.wp-block-post-content');
    if(content.length===1){const fingerprint=hash(content.text().replace(/\s+/g,' ').trim()).slice(0,20),slots=(sample?.saved?.slots||[]).filter(slot=>slot.textHash===fingerprint);if(slots.length===1&&record.renderedSlots?.[slots[0].key]!==undefined)content.html(record.renderedSlots[slots[0].key]);}
    const excerpt=card('.entry-summary,.excerpt,.elementor-post__excerpt,.wp-block-post-excerpt__excerpt').first();if(excerpt.length)excerpt.text(record.excerpt||record.description||'');
    if(record.meta.event){const baseline=(originalCard?record:sample)?.saved?.metadata.event;for(const issue of renderEventDates(card,record.meta.event,baseline,{locale:b.eventGrouping?.locale||'en'}))diagnostics.push({route:p.route,record:record.route,reason:issue});}
    else card('time').attr('datetime',record.date).text(record.date?record.date.slice(0,10):'');
    card('.author-name,.wp-block-post-author-name').text(record.meta.author||'');
    if(record.meta.featured_image){card('picture source').remove();card('img').first().attr('src','/'+record.meta.featured_image.replace(/^\//,'')).removeAttr('srcset').removeAttr('sizes').attr('alt',record.title);}
    else if(!originalCard||record.saved?.metadata.featured_image)card('picture,img').remove();
    let header='';
    if(b.eventGrouping&&record.meta.event){const month=record.meta.event.start.slice(0,7);if(month!==lastMonth){const group=load(b.eventGrouping.template,null,false),label=group('time').first(),spec=eventFormat(label.text(),b.eventGrouping.sampleDate,b.eventGrouping.locale||'en');if(spec){label.text(formatEventValue(record.meta.event.start,spec,b.eventGrouping.locale||'en'));header=group.html();}else diagnostics.push({route:p.route,reason:'Unsupported event month header format'});lastMonth=month;}}
    return header+card.html();
   }).join('');
   if(b.mode==='native'){
    container.empty();fallbacks.push({route:p.route,mode:'native',reason:b.reason});
    if(selected.length)$('[data-migration-empty-archive="'+b.id+'"]').remove();else container.remove();
    if(selected.length&&!$('style[data-migration-listing]').length)container.before('<style data-migration-listing>.migration-native-listing{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:2rem;list-style:none;padding:0}.migration-native-listing .listing-card-image{width:100%;aspect-ratio:16/9;object-fit:cover}.migration-native-listing .listing-card{min-width:0}.migration-pagination{display:flex;gap:1rem;flex-wrap:wrap}</style>');
   }
   if(b.eventGrouping)container.children('.tribe-events-calendar-list__month-separator').remove();
   const old=container.children('[data-migration-record]');
   if(old.length){old.first().before(cards);old.remove();}else container.append(cards);
   const pagination=$('.pagination,.nav-links,.wp-block-query-pagination').first();
   const nav=`<nav class="migration-pagination" aria-label="Pagination">${page>1?`<a rel="prev" href="${esc(pageURL(page-1))}">Previous</a>`:''} <span>Page ${page} of ${count}</span> ${page<count?`<a rel="next" href="${esc(pageURL(page+1))}">Next</a>`:''}</nav>`;
   if(pagination.length)pagination.replaceWith(nav);else if(count>1){if(b.rootContainer)container.append(nav);else container.after(nav);}
   for(const reason of renderProductResultCount($,{total:members.length,page,size}))diagnostics.push({route:p.route,reason});
   p.fragment=$.html();updated.push(p.route);
   for(const alias of family.filter(item=>item.page===page&&item.source!==b.source)){
    const record=byKey.get(alias.source);if(record){record.fragment=p.fragment;updated.push(record.route);}
   }
  }
 }
 return {status:diagnostics.length?'needs-review':'passed',updated,unbound:diagnostics,fallbacks,inherited};
}

// Every v2 build renders authored Markdown. Saved HTML is never consulted.
async function prepareMarkdownSources(project){
 const relationshipRecords=nativeRelationshipIndex(project.routes.map(p=>({type:p.meta.wordpress_type,id:p.meta.wordpress_id,route:p.route,title:p.title})));
 const inputs=[],parts=new Map(),templateCache=new Map(),inlineMarkup=new Map();
 for(const p of project.routes){
  const slots=p.meta.content_slots||p.saved?.slots||[{key:'body1',inline:false}];
  if(!Array.isArray(slots)||slots.some(s=>!/^body\d+$/.test(s.key))||new Set(slots.map(s=>s.key)).size!==slots.length)throw Error('Invalid content slots in '+p.file);
  let sections=new Map();
  if(slots.length<=1)sections.set(slots[0]?.key||'body1',p.body);
  else {
   const names=new Map();
   for(const slot of slots){for(const name of new Set([slot.key,slot.name].filter(Boolean))){if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)||names.has(name))throw Error('Invalid or duplicate content slot name in '+p.file);names.set(name,slot.key);}}
   const pattern=/^<!-- content-slot:([a-z0-9-]+) -->\s*$/gm;
   const matches=[...p.body.matchAll(pattern)];
   if(matches.length&&p.body.slice(0,matches[0].index).trim())throw Error('Content before the first content slot in '+p.file);
   if(matches.length!==slots.length||new Set(matches.map(m=>m[1])).size!==slots.length)throw Error('Missing or duplicate content slot in '+p.file);
   for(let i=0;i<matches.length;i++){const key=names.get(matches[i][1]);if(!key||sections.has(key))throw Error('Unknown or duplicate content slot in '+p.file);sections.set(key,p.body.slice(matches[i].index+matches[i][0].length,matches[i+1]?.index).trim());}
  }
  parts.set(p.file,{slots,sections});
  for(const slot of slots){if(!sections.has(slot.key))throw Error('Missing content slot '+slot.key+' in '+p.file);const body=protectInlineMarkup(sections.get(slot.key),inlineMarkup);inputs.push({id:p.file+'/'+slot.key,body});}
  p.nativeBody=[...sections.values()].join('\n\n').replace(/\{\{component:component\d+\}\}/g,'');
 }
 const rendered=await renderNativeMarkdown(inputs);
 for(const p of project.routes){
  const {slots}=parts.get(p.file);
  let template=p.meta.content_template?await readFile(await within(p.meta.content_template),'utf8'):null;
  if(!template){p.fragment=rendered[p.file+'/body1'];continue;}
  // Resolve data before Markdown is inserted so authored text is not interpreted as template syntax.
  template=await renderBindings(template,{...p.meta,__relationshipRecords:relationshipRecords},templateCache);
  const componentValues={};
  for(const [key,file]of Object.entries(p.meta.components||{})){
   if(!/^templates\/components\/[a-zA-Z0-9_-]+\.html$/.test(file))throw Error('Unsafe component path');
   componentValues[key]=renderComponentMedia(await readFile(await within(file),'utf8'),p.meta.component_media?.[key]);
  }
  template=template.replace(/MIGRATION_COMPONENT_([a-zA-Z0-9]+)_END/g,(_,key)=>{if(componentValues[key]===undefined)throw Error('Missing component '+key+' in '+p.file);return componentValues[key];});
  const values={};
  for(const slot of slots){let html=rendered[p.file+'/'+slot.key];if(typeof html!=='string')throw Error('Markdown rendering failed: '+p.file);
   html=html.replace(/MIGRATIONINLINE[a-f0-9]+END/g,key=>inlineMarkup.get(key)||key);
   const $=load(html,null,false);
   for(const d of slot.decorations||p.saved?.decorations?.[slot.key]||[]){const el=$(d.tag).eq(d.index);if(el.length){for(const [key,value]of Object.entries(d.attrs))el.attr(key,value);if(d.removeHref)el.removeAttr('href');if(d.wrapContents){for(const attrs of [...d.wrapContents].reverse()){const wrapper=$('<span></span>').attr(attrs);wrapper.append(el.contents());el.append(wrapper);}}if(d.wrapFigure){const wrapper=$('<figure></figure>').attr(d.wrapFigure),target=el.parent().is('a')?el.parent():el,parent=target.parent();if(parent.is('p')&&parent.contents().filter((_,n)=>n.type!=='text'||n.data.trim()).length===1){parent.replaceWith(wrapper);wrapper.append(target);}else{target.before(wrapper);wrapper.append(target);}}}}
   values[slot.key]=(slot.prefix||'')+(slot.inline&&$.root().children().length===1&&$('p').length===1?$('p').html():$.html())+(slot.suffix||'');
  }
  p.renderedSlots=values;
  p.fragment=template.replace(/MIGRATION_SLOT_(body\d+)_END/g,(_,key)=>{if(values[key]===undefined)throw Error('Unknown content slot '+key+' in '+p.file);return values[key];});
  p.fragment=p.fragment.replace(/<p>\s*\{\{component:(component\d+)\}\}\s*<\/p>|\{\{component:(component\d+)\}\}/g,(_,a,b)=>{const key=a||b;if(componentValues[key]===undefined)throw Error('Unknown component '+key);return componentValues[key];});
  p.fragment=renderSliderSequences(p.fragment,p.meta.slider_sequences);
 }
}

// WordPress post IDs share one namespace across posts, pages and custom types.
// Duplicate authored identities are ambiguous, even if their content types differ.
export function nativeRelationshipIndex(records){
 const index=new Map();
 for(const record of records){
  if(!record.type||!Number.isSafeInteger(record.id)||record.id<1)continue;
  index.set(record.id,index.has(record.id)?null:record);
 }
 return index;
}
function relationshipTarget(data,key){
 const value=key.split('.').reduce((v,k)=>v?.[k],data);
 if(!Number.isSafeInteger(value)||value<1)throw Error('Invalid relationship target ID: '+key);
 const target=data.__relationshipRecords?.get(value);
 if(!target)throw Error('Relationship target is not exported or is ambiguous: '+key);
 return target;
}

export async function renderBindings(template,data,cache=new Map(),depth=0){
 if(depth>100)throw Error('Template nesting too deep');
 const regions=[...template.matchAll(/MIGRATION_REGION_(region\d+)_END/g)];
 // Render regions first: their scoped placeholders must never be interpreted
 // with the parent's bindings. Final Markdown insertion still happens last.
 const regionValues=new Map();
 for(const match of regions){
  const items=data.layout_regions?.[match[1]];
  if(!Array.isArray(items))throw Error('Missing template region '+match[1]);
  let result='';
  for(const item of items){
   if(!/^templates\/partials\/[a-z0-9-]+\.html$/.test(item.template)||!item.bindings||typeof item.bindings!=='object')throw Error('Invalid template region binding');
   if(!cache.has(item.template))cache.set(item.template,await readFile(await within(item.template),'utf8'));
   result+=await renderBindings(cache.get(item.template),{...data,...item.bindings},cache,depth+1);
  }
  regionValues.set(match[0],result);
 }

 template=template.replace(/MIGRATION_ATTRIBUTES_(attrs\d+)_END/g,(_,key)=>{
  const attrs=data.layout_attributes?.[key];if(!attrs||typeof attrs!=='object')throw Error('Missing layout attributes '+key);
  return Object.entries(attrs).map(([name,value])=>{if(!/^[a-zA-Z_:][a-zA-Z0-9_.:-]*$/.test(name))throw Error('Invalid attribute name');return name+'="'+esc(value)+'"';}).join(' ');
 });
 // Clearing an explicitly nullable relationship removes only its bound anchor.
 // Keep surrounding design/content: the capture cannot prove broader conditions.
 const clearedRelationships=Object.entries(data.custom_field_links||{}).filter(([key,context])=>context.kind==='post-relationship'&&context.nullable===true&&key.split('.').reduce((v,k)=>v?.[k],data)===null);
 if(clearedRelationships.some(([key])=>template.includes('MIGRATION_LINK_'+key+'_END'))){
  const $=load(template,null,false),tokens=new Set(clearedRelationships.map(([key])=>'MIGRATION_LINK_'+key+'_END'));
  $('a[href]').each((_,node)=>{if(tokens.has($(node).attr('href')))$(node).remove();});
  template=$.html();
 }
 template=template.replace(/MIGRATION_LINKTARGET_([a-zA-Z0-9_.]+?)_END/g,(_,key)=>{
  const value=key.split('.').reduce((v,k)=>v?.[k],data);
  if(!['','_blank','_self','_parent','_top'].includes(value))throw Error('Invalid custom-field link target '+key);
  return esc(value);
 });
 template=template.replace(/MIGRATION_LINK_([a-zA-Z0-9_.]+?)_END/g,(_,key)=>{
  const value=key.split('.').reduce((v,k)=>v?.[k],data),context=data.custom_field_links?.[key];
  if(context?.kind==='post-relationship'){return esc(relationshipTarget(data,key).route);}
  if(typeof value!=='string'||!context)throw Error('Missing custom-field link '+key);
  let url;try{url=new URL(value,context.source);}catch{throw Error('Invalid custom-field link '+key);}
  if(!['http:','https:','mailto:','tel:'].includes(url.protocol)||url.username||url.password)throw Error('Unsafe custom-field link '+key);
  if(value===context.capturedURL)return esc(context.capturedHref);
  const source=new URL(context.source);return esc(url.origin===source.origin?url.pathname+url.search+url.hash:url.href);
 });
 template=template.replace(/MIGRATION_RELATIONTITLE_([a-zA-Z0-9_.]+?)_END/g,(_,key)=>esc(relationshipTarget(data,key).title));
 template=template.replace(/MIGRATION_VALUE_([a-zA-Z0-9_.]+?)_END/g,(_,key)=>{
  const value=key.split('.').reduce((v,k)=>v?.[k],data);if(value===undefined)throw Error('Missing layout value '+key);return esc(data.custom_field_numbers?.[key]?formatFieldNumber(value,data.custom_field_numbers[key]):value);
 });
 const relationLists=[...template.matchAll(/MIGRATION_RELATIONLIST_([a-zA-Z0-9_.]+?)_END/g)];
 for(const match of relationLists){
  const key=match[1],definition=data.custom_field_lists?.[key];let ids=key.split('.').reduce((v,k)=>v?.[k],data);
  if(ids===null&&definition?.nullable)ids=[];
  if(!definition||!/^templates\/repeats\/relationship-[a-f0-9]+\.html$/.test(definition.template)||!Array.isArray(ids)||ids.some(id=>!Number.isSafeInteger(id)||id<1)||new Set(ids).size!==ids.length)throw Error('Invalid relationship list: '+key);
  if(![definition.prefix,definition.suffix,definition.separator].every(value=>typeof value==='string'&&!/\S/.test(value)))throw Error('Invalid relationship list spacing: '+key);
  if(!cache.has(definition.template))cache.set(definition.template,await readFile(await within(definition.template),'utf8'));
  const items=[];for(const id of ids)items.push(await renderBindings(cache.get(definition.template),{...data,relationship_item:id,custom_field_links:{...data.custom_field_links,relationship_item:{kind:'post-relationship'}}},cache,depth+1));
  template=template.replace(match[0],()=>definition.prefix+items.join(definition.separator)+definition.suffix);
 }
 const matches=[...template.matchAll(/MIGRATION_REPEAT_(repeat\d+)_END/g)];
 for(const match of matches){const block=data.layout_repeats?.[match[1]];
  if(!block||!/^templates\/repeats\/repeat-[a-f0-9]+\.html$/.test(block.template)||!Array.isArray(block.items))throw Error('Invalid repeat binding');
  if(!cache.has(block.template))cache.set(block.template,await readFile(await within(block.template),'utf8'));
  const source=cache.get(block.template);let result='';
  for(const item of block.items)result+=await renderBindings(source,{...data,...item},cache,depth+1);
  template=template.replace(match[0],()=>result);
 }
 for(const [key,value]of regionValues)template=template.replaceAll(key,()=>value);
 return template;
}

export function protectInlineMarkup(body,markup){
 let fence=null;
 return body.split('\n').map(line=>{
  const marker=/^ {0,3}(`{3,}|~{3,})/.exec(line);
  if(marker){if(!fence)fence=marker[1];else if(marker[1][0]===fence[0]&&marker[1].length>=fence.length)fence=null;return line;}
  if(fence||/^(?: {4}|\t)/.test(line))return line;
  const protect=tag=>{const key='MIGRATIONINLINE'+hash(tag)+'END';markup.set(key,tag);return key;};
  line=line.replace(/<a href="(tel:[+()0-9 .-]+)">(.*?)<\/a>/gi,(_,href,content)=>protect('<a href="'+href+'">')+content+protect('</a>'));
  return line.replace(/(`+)[^`]*?\1|\\[!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]|<\/?(?:br|span|mark|small|sup|sub|abbr|kbd)\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi,tag=>{
   if(tag.startsWith('`')){const ticks=/^`+/.exec(tag)[0];tag='<code>'+esc(tag.slice(ticks.length,-ticks.length))+'</code>';}else if(tag.startsWith('\\'))tag=esc(tag.slice(1));const key='MIGRATIONINLINE'+hash(tag)+'END';markup.set(key,tag);return key;
  });
 }).join('\n');
}
