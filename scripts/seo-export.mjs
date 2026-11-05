import {synchronizeEventSchema,synchronizeArchiveEventSchema} from './events-export.mjs';
// Shared schema/social conversion, independent of a plugin's brand or domain.
const urlKeys=new Set(['@id','url','contentUrl','thumbnailUrl','image','logo','item','sameAs','mainEntityOfPage','embedUrl']);
const stable=v=>JSON.stringify(v,(_,x)=>x&&typeof x==='object'&&!Array.isArray(x)?Object.fromEntries(Object.entries(x).sort(([a],[b])=>a.localeCompare(b))):x);
export function captureSEO($){
 const structured=[],issues=[];
 $('script[type="application/ld+json"]').each((index,node)=>{
  try{const value=JSON.parse($(node).text());if(value&&typeof value==='object')structured.push(value);else issues.push({kind:'invalid-schema',index});}
  catch{issues.push({kind:'invalid-schema-json',index});}
 });
 const social={};
 $('meta[property],meta[name]').each((_,node)=>{const name=$(node).attr('property')||$(node).attr('name');if(/^(og:|twitter:)/.test(name||'')&&$(node).attr('content')!==undefined)(social[name]??=[]).push($(node).attr('content'));});
 return {structured_data:structured,social,seo_source_issues:issues,seo_content_bindings:captureContentBindings($,structured)};
}

const normalizedText=value=>String(value||'').replace(/\s+/g,' ').trim();
const textBlocks=new Set(['address','article','aside','blockquote','br','dd','div','dl','dt','figcaption','figure','footer','h1','h2','h3','h4','h5','h6','header','hr','li','main','nav','ol','p','pre','section','table','td','th','tr','ul']);
function elementText(nodes){
 const visit=node=>{
  if(node.type==='text')return node.data||'';
  if(['script','style','template'].includes(node.name))return '';
  const text=(node.children||[]).map(visit).join('');
  return textBlocks.has(node.name)?' '+text+' ':text;
 };
 return normalizedText(nodes.toArray().map(visit).join(''));
}
const plainText=(value,$)=>elementText($('<div>').html(String(value||'')));
// Schema vocabulary, not plugin markup, determines which visible fields can bind.
function contentFields(node){
 const types=[node['@type']].flat();
 if(types.includes('Question'))return [['name',node,'name'],['answer',node.acceptedAnswer,'text']];
 if(!types.includes('HowToStep'))return [];
 const fields=[['name',node,'name'],['text',node,'text']];
 if(Array.isArray(node.itemListElement))node.itemListElement.forEach((item,index)=>{
  if(item&&[item['@type']].flat().includes('HowToDirection'))fields.push(['direction-'+index,item,'text']);
 });
 return fields;
}
function captureContentBindings($,documents){
 const bindings=[];
 function walk(value,depth=0){
  if(depth>64)return;
  if(Array.isArray(value)){value.forEach(v=>walk(v,depth+1));return;}
  if(!value||typeof value!=='object')return;
  if(contentFields(value).length){
   let anchor;try{anchor=decodeURIComponent(new URL(value.url||value['@id']).hash.slice(1));}catch{}
   const roots=anchor?$('[id]').filter((_,el)=>$(el).attr('id')===anchor):[];
   if(roots.length===1){
    const root=roots[0],binding={anchor};
    for(const [field,target,key]of contentFields(value)){
     const original=target?.[key];
     if(typeof original!=='string')continue;const expected=plainText(original,$);if(!expected)continue;
     const candidates=$(root).find('*').filter((_,el)=>!$(el).is('script,style')&&elementText($(el))===expected).toArray();
     const outer=candidates.filter(el=>!$(el).parents().toArray().some(parent=>candidates.includes(parent)));
     if(outer.length!==1)continue;
     const path=[];let node=outer[0];while(node!==root){const parent=$(node).parent()[0];if(!parent)break;path.unshift($(parent).children().toArray().indexOf(node));node=parent;}
     if(node===root)binding[field]={path,tag:outer[0].tagName,original};
    }
    if(Object.keys(binding).length>1)bindings.push(binding);
   }
  }
  for(const [key,item]of Object.entries(value))if(key!=='@context')walk(item,depth+1);
 }
 walk(documents);return bindings;
}
export function synchronizeQuestionContent(documents,page,$,canonical){
 const bindings=Array.isArray(page.meta.seo_content_bindings)?page.meta.seo_content_bindings:[];
 function walk(value){
  if(Array.isArray(value))return value.map(walk);
  if(!value||typeof value!=='object')return value;
  const node=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='@context'?item:walk(item)]));
  if(!contentFields(node).length)return node;
  let anchor;try{const url=new URL(node.url||node['@id']);anchor=decodeURIComponent(url.hash.slice(1));url.hash='';if(url.href!==canonical)return node;}catch{return node;}
  const matches=bindings.filter(binding=>binding?.anchor===anchor);if(matches.length!==1)return node;
  const roots=$('[id]').filter((_,el)=>$(el).attr('id')===anchor);if(roots.length!==1)return node;
  for(const [field,target,key]of contentFields(node)){
   const binding=matches[0][field];if(!binding||!target||target[key]!==binding.original||!Array.isArray(binding.path))continue;
   let element=roots;for(const index of binding.path){if(!Number.isSafeInteger(index)||index<0){element=$([]);break;}element=element.children().eq(index);}
   if(element.length!==1||element[0].tagName!==binding.tag)continue;
   const text=elementText(element);if(text&&text!==plainText(binding.original,$))target[key]=text;
  }
  return node;
 }
 return documents.map(walk);
}

export function createSEOContext({source,origin,base='',routes=[],assets=[]}){
 const urls=new Map();
 for(const p of routes){try{const u=new URL(p.source||p.sourceRoute||p.route,source);urls.set(u.origin+u.pathname+u.search,p.route);}catch{}}
 return {source,origin,base,eventRecords:routes.filter(p=>p.meta?.event&&!/\b(noindex|none)\b/i.test(p.robots||'')),urlMap:urls,mediaMap:new Map(assets.map(a=>[a.source,a.path]))};
}

export function rewriteSEO(meta,context){
 const {source,origin,base='',urlMap:urls,mediaMap:media}=context.urlMap?context:createSEOContext(context);
 const issues=[...(meta.seo_source_issues||[])],sourceURL=new URL(source),target=origin.replace(/\/$/,'')+base;
 function address(value,key){
  if(typeof value!=='string')return value;
  let u;try{u=new URL(value,source);}catch{return value;}
  if(!['https:','http:'].includes(u.protocol)){issues.push({kind:'unsupported-schema-url',key});return undefined;}
  const asset=media.get(u.href)||media.get(u.origin+u.pathname+u.search);
  if(asset)return target+'/'+asset.replace(/^\//,'')+u.hash;
  if(u.origin!==sourceURL.origin)return value;
  const route=urls.get(u.origin+u.pathname+u.search);
  if(route)return target+route+u.hash;
  if(key==='@id')return target+u.pathname+u.search+u.hash;
  issues.push({kind:'unmapped-source-url',url:u.href,key});return undefined;
 }
 // A captured action endpoint is not a working exported service. Preserve
 // external provider actions, but do not rebrand source submissions as local.
 function targetsSource(value,depth=0){
  if(depth>64)return false;
  if(Array.isArray(value))return value.some(v=>targetsSource(v,depth+1));
  if(value&&typeof value==='object')return ['urlTemplate','url','@id'].some(k=>targetsSource(value[k],depth+1));
  if(typeof value!=='string'||!value.trim())return false;
  try{return new URL(value,source).origin===sourceURL.origin;}catch{return false;}
 }
 function visit(value,key='',depth=0){
  if(depth>64){issues.push({kind:'schema-depth-exceeded'});return undefined;}
  if(Array.isArray(value))return value.map(v=>visit(v,key,depth+1)).filter(v=>v!==undefined);
  if(value&&typeof value==='object'){
   if([value['@type']].flat().includes('SearchAction')){issues.push({kind:'source-search-action-removed'});return undefined;}
   const types=[value['@type']].flat(),readAction=types.includes('ReadAction');
   if(!readAction&&(key==='potentialAction'||types.some(t=>typeof t==='string'&&/Action$/.test(t)))&&targetsSource(value.target)){
    issues.push({kind:'source-service-action-removed',action:types.filter(t=>typeof t==='string').join(',')||'untyped'});return undefined;
   }
   return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,k==='@context'?v:visit(v,readAction&&k==='target'||key==='read-target'&&k==='urlTemplate'?'read-target':k,depth+1)]).filter(([,v])=>v!==undefined));
  }
  return urlKeys.has(key)||key==='read-target'?address(value,key):value;
 }
 const ids=new Map(),documents=new Set();
 function deduplicate(value){
  if(Array.isArray(value))return value.map(deduplicate).filter(v=>v!==undefined);
  if(!value||typeof value!=='object')return value;
  // References may carry labels (for example author name + @id). They
  // must not claim an identity before its later typed definition. Preserve
  // untyped contributions; deduplicate only explicit typed definitions.
  if(value['@id']&&[value['@type']].flat().some(type=>typeof type==='string'&&type)){
   const id=value['@id'],previous=ids.get(id);
   if(previous){
    const conflict=Object.entries(value).some(([key,item])=>previous.facts.has(key)&&previous.facts.get(key)!==stable(item));
    if(conflict)issues.push({kind:'conflicting-schema-id',id});
    else for(const [key,item]of Object.entries(value))if(!previous.facts.has(key)){
     previous.facts.set(key,stable(item));
     Object.defineProperty(previous.output,key,{value:key==='@context'?item:deduplicate(item),enumerable:true,configurable:true,writable:true});
    }
    return {'@id':id};
   }
   const output={},facts=new Map(Object.entries(value).map(([key,item])=>[key,stable(item)]));
   ids.set(id,{facts,output});
   for(const [key,item]of Object.entries(value))Object.defineProperty(output,key,{value:key==='@context'?item:deduplicate(item),enumerable:true,configurable:true,writable:true});
   return output;
  }
  return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,key==='@context'?v:deduplicate(v)]));
 }
 const structured=[];
 for(const doc of meta.structured_data||[]){const rewritten=visit(doc);const fingerprint=stable(rewritten);if(documents.has(fingerprint))continue;documents.add(fingerprint);const unique=deduplicate(rewritten);if(unique!==undefined)structured.push(unique);}
 const social={};
 for(const [key,values] of Object.entries(meta.social||{})){
  if(!/^(og:|twitter:)[a-zA-Z0-9_:]+$/.test(key))continue;
  social[key]=[...new Set([values].flat().filter(v=>typeof v==='string').map(v=>/(?:url|image|player|video|audio)(?::url|:secure_url)?$/.test(key)?address(v,'url'):v).filter(v=>v!==undefined))];
 }
 return {structured,social,issues};
}

export function synchronizePageMetadata(documents,page,canonical){
 const baseline=page.saved?.metadata;if(!baseline)return documents;
 const pageTypes=new Set(['WebPage','AboutPage','ContactPage','CollectionPage','FAQPage','ItemPage','ProfilePage','QAPage','SearchResultsPage']);
 const articleTypes=new Set(['Article','BlogPosting','NewsArticle','TechArticle','ScholarlyArticle']);
 const local=value=>{try{const u=new URL(value);u.hash='';return u.href===canonical;}catch{return false;}};
 const bind=(node,key,field)=>{if(typeof baseline[field]==='string'&&baseline[field]&&node[key]===baseline[field]&&typeof page.meta[field]==='string')node[key]=page.meta[field];};
 function visit(value){
  if(Array.isArray(value))return value.map(visit);
  if(!value||typeof value!=='object')return value;
  const node=Object.fromEntries(Object.entries(value).map(([key,item])=>[key,key==='@context'?item:visit(item)]));
  const types=[node['@type']].flat(),ownPage=local(node.url)||local(node['@id']);
  if(ownPage&&types.some(t=>pageTypes.has(t))){bind(node,'name','seo_title');bind(node,'description','description');}
  if(ownPage&&types.some(t=>articleTypes.has(t))){bind(node,'headline',node.headline===baseline.title?'title':'seo_title');bind(node,'name',node.name===baseline.seo_title?'seo_title':'title');bind(node,'description','description');bind(node,'datePublished','date');bind(node,'dateModified','last_updated');}
  return node;
 }
 return documents.map(visit);
}
export function applySEO($,page,context){
 const converted=rewriteSEO(page.meta,context),canonical=context.origin.replace(/\/$/,'')+(context.base||'')+(page.canonicalRoute||page.route);
 $('script[type="application/ld+json"]').remove();
 let documents=converted.structured.length?converted.structured:[{'@context':'https://schema.org','@type':page.collection==='posts'?'BlogPosting':'WebPage',name:page.title,headline:page.title,url:canonical,...(page.date?{datePublished:page.date}:{}),...(page.meta.last_updated?{dateModified:page.meta.last_updated}:{}),...(page.meta.author?{author:{'@type':'Person',name:page.meta.author}}:{})}];
 documents=synchronizePageMetadata(documents,page,canonical);
 documents=synchronizeQuestionContent(documents,page,$,canonical);
 if(!page.meta.event&&$('[data-migration-record]').length&&context.eventRecords?.length){const visible=new Set($('[data-migration-record]').map((_,node)=>$(node).attr('data-migration-record')).get()),archive=synchronizeArchiveEventSchema(documents,context.eventRecords,visible,context.origin,context.base);documents=archive.documents;converted.issues.push(...archive.issues);}
 const eventSchema=synchronizeEventSchema(documents,page,canonical);documents=eventSchema.documents;converted.issues.push(...eventSchema.issues);
 for(const doc of documents)$('head').append('<script type="application/ld+json">'+JSON.stringify(doc).replaceAll('<','\\u003c')+'</script>');
 const defaults={'og:title':[page.meta.seo_title||page.title],'og:description':[page.description||''],'og:url':[canonical],'twitter:card':['summary_large_image'],'twitter:title':[page.meta.seo_title||page.title],'twitter:description':[page.description||'']};
 const social={...defaults,...converted.social};
 // Source defaults follow their authored metadata; independent social copy stays explicit.
 const baseline=page.saved?.metadata;
 if(baseline)for(const [key,field]of [['og:title','seo_title'],['twitter:title','seo_title'],['og:description','description'],['twitter:description','description']]){const captured=baseline.social?.[key];if(Array.isArray(captured)&&captured.length===1&&captured[0]===baseline[field]&&social[key]?.length===1&&social[key][0]===captured[0]&&typeof page.meta[field]==='string')social[key]=[page.meta[field]];}
 // Current route is authoritative for social URL even after a permalink edit.
 social['og:url']=[canonical];
 $('meta[property],meta[name]').each((_,node)=>{const key=$(node).attr('property')||$(node).attr('name');if(Object.hasOwn(social,key))$(node).remove();});
 for(const [key,values] of Object.entries(social))for(const value of values){const node=$('<meta>');node.attr(key.startsWith('og:')?'property':'name',key).attr('content',value);$('head').append(node);}
 for(const [key,value] of Object.entries({'article:published_time':page.date,'article:modified_time':page.meta.last_updated,'author':page.meta.author})){if(!value)continue;const property=key==='author'?'name':'property';$('meta').filter((_,el)=>$(el).attr(property)===key).remove();$('head').append($('<meta>').attr(property,key).attr('content',value));}
 return converted.issues;
}

export function seoImageURLs(meta,source){
 const found=new Set();
 const add=value=>{if(typeof value!=='string')return;try{const u=new URL(value,source);if(['https:','http:'].includes(u.protocol))found.add(u.href);}catch{}};
 for(const [key,values] of Object.entries(meta.social||{}))if(/^(og:image(?::(?:url|secure_url))?|twitter:image(?::src)?)$/.test(key))for(const value of [values].flat())add(value);
 function walk(value,key='',depth=0){
  if(depth>64)return;
  if(Array.isArray(value)){value.forEach(v=>walk(v,key,depth+1));return;}
  if(value&&typeof value==='object'){
   if(['image','logo','thumbnail'].includes(key)||[value['@type']].flat().includes('ImageObject')){add(value.url);add(value.contentUrl);}
   for(const [k,v] of Object.entries(value))if(k!=='@context')walk(v,k,depth+1);
  }else if(['image','logo','thumbnailUrl'].includes(key))add(value);
 }
 walk(meta.structured_data);return [...found];
}
