import {inferFieldNumber} from '../scripts/custom-field-numbers.mjs';
// Preserve exposed REST values without guessing whether numeric IDs represent
// images, relationships, prices, or ordinary numbers. Private schemas are absent.
export function publicCustomFields(row){
 return row.acf&&typeof row.acf==='object'&&!Array.isArray(row.acf)?structuredClone(row.acf):{};
}
// Keep only type structure from public schemas; never store arbitrary schema code.
export function publicFieldSchema(schema,depth=0){
 if(!schema||typeof schema!=='object'||depth>12)return {};
 const out={},types=(Array.isArray(schema.type)?schema.type:[schema.type]).filter(t=>['object','array','string','number','integer','boolean','null'].includes(t));
 if(types.length)out.type=types;
 if(schema.properties&&typeof schema.properties==='object'&&!Array.isArray(schema.properties)){
  out.properties={};for(const [key,value]of Object.entries(schema.properties))if(/^[a-zA-Z0-9_]+$/.test(key)&&!['__proto__','constructor','prototype'].includes(key))out.properties[key]=publicFieldSchema(value,depth+1);
 }
 if(schema.items&&typeof schema.items==='object'&&!Array.isArray(schema.items))out.items=publicFieldSchema(schema.items,depth+1);
 return out;
}
export function bindCustomFieldText($,root,fields,namespace='custom_fields',schema={},formats=null){
 const values=new Map(),texts=new Map(),bindings=[],numbers=[],formattedPaths=new Set();
 function visit(value,path,definition){
  if(value&&typeof value==='object'){for(const [key,child]of Object.entries(value))if(/^[a-zA-Z0-9_]+$/.test(key)&&!['__proto__','constructor','prototype'].includes(key))visit(child,path+'.'+key,Array.isArray(value)?definition?.items:definition?.properties?.[key]);}
  else if(typeof value==='number'&&Number.isFinite(value)&&definition?.type?.includes('number')&&!definition.type.some(t=>!['number','null'].includes(t))){numbers.push({value,path});const text=String(value),paths=values.get(text)||[];paths.push(path);values.set(text,paths);}
  else if(typeof value==='string'&&value.trim()&&!/[<>]/.test(value)){const paths=values.get(value)||[];paths.push(path);values.set(value,paths);}
 }
 visit(fields,namespace,schema);
 root.find('*').addBack().each((_,element)=>{
  const el=$(element);if(el.closest('nav,header,footer,form,script,style,svg,table,h1').length)return;
  el.contents().filter((_,node)=>node.type==='text'&&values.has(node.data)).each((_,node)=>{const list=texts.get(node.data)||[];list.push(node);texts.set(node.data,list);});
 });
 if(formats){
  const candidates=[];
  root.find('*').addBack().each((_,element)=>{const el=$(element);if(el.closest('nav,header,footer,form,script,style,svg,table,h1').length)return;el.contents().filter((_,node)=>node.type==='text').each((_,node)=>{if(values.has(node.data))return;for(const number of numbers){const format=inferFieldNumber(node.data,number.value);if(format)candidates.push({...number,node,format});}});});
  for(const item of candidates)formattedPaths.add(item.path);
  for(const item of candidates){if(texts.get(String(item.value))?.length)continue;if(candidates.filter(c=>c.path===item.path).length!==1||candidates.filter(c=>c.node===item.node).length!==1)continue;
   formats[item.path]=item.format;item.node.data='MIGRATION_VALUE_'+item.path+'_END';for(let parent=item.node;parent;parent=parent.parent){parent.migrationCustomField=true;if(parent===root[0])break;}bindings.push({field:item.path,evidence:'Unique lossless formatting of public schema-number'});
  }
 }
 for(const [value,paths]of values){const nodes=texts.get(value)||[];if(paths.length!==1||nodes.length!==1||formattedPaths.has(paths[0]))continue;
  const node=nodes[0];node.data='MIGRATION_VALUE_'+paths[0]+'_END';
  for(let parent=node;parent;parent=parent.parent){parent.migrationCustomField=true;if(parent===root[0])break;}
  bindings.push({field:paths[0],evidence:'Unique exact public field text match'});
 }
 return bindings;
}

// Bind only unique, recognizable link objects to a unique captured anchor.
// Matching uses already-localized HTML; captured destinations are retained.
export function bindCustomFieldLinks($,root,fields,source,routes=[]){
 const candidates=new Map(),bindings=[],contexts={},routeMap=new Map();
 for(const route of routes)try{const url=new URL(route.source);url.hash='';routeMap.set(url.href,route.route);}catch{}
 const local=value=>{try{const u=new URL(value,source),home=new URL(source);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)return null;if(u.origin!==home.origin)return u.href;const route=routeMap.get(u.href.split('#')[0]);return (route||u.pathname+u.search)+u.hash;}catch{return null;}};
 function visit(value,path){
  if(!value||typeof value!=='object')return;
  if(!Array.isArray(value)&&typeof value.url==='string'&&typeof value.title==='string'){
   const href=local(value.url);if(href){const list=candidates.get(href)||[];list.push({path:path+'.url',url:value.url,title:value.title,target:value.target});candidates.set(href,list);}
  }
  for(const [key,child]of Object.entries(value))if(/^[a-zA-Z0-9_]+$/.test(key)&&!['__proto__','constructor','prototype'].includes(key))visit(child,path+'.'+key);
 }
 visit(fields,'custom_fields');
 const anchors=new Map();
 root.find('a[href]').addBack('a[href]').each((_,node)=>{if($(node).closest('nav,header,footer,form').length)return;const href=local($(node).attr('href'));if(href){const nodes=anchors.get(href)||[];nodes.push(node);anchors.set(href,nodes);}});
 for(const [href,entries]of candidates){
  const matches=anchors.get(href)||[],selected=[];
  for(const entry of entries){
   const options=entries.length===1&&matches.length===1?matches:matches.filter(node=>$(node).text().trim()===entry.title.trim());
   if(options.length===1)selected.push({entry,node:options[0]});
  }
  for(const {entry,node}of selected){
   if(selected.filter(match=>match.node===node).length!==1)continue;
   const {path,url,target}=entry;contexts[path]={source,capturedURL:url,capturedHref:$(node).attr('href')};$(node).attr('href','MIGRATION_LINK_'+path+'_END');
   if(typeof target==='string'&&['','_blank','_self','_parent','_top'].includes(target)&&($(node).attr('target')||'')===target){
    const key=path.replace(/\.url$/,'.target');$(node).attr('target','MIGRATION_LINKTARGET_'+key+'_END');
    const rel=new Set(($(node).attr('rel')||'').split(/\s+/).filter(Boolean));rel.add('noopener');$(node).attr('rel',[...rel].join(' '));
    bindings.push({field:key,evidence:'Public link target matches captured anchor target'});
   }
   for(let parent=node;parent;parent=parent.parent){parent.migrationCustomField=true;if(parent===root[0])break;}
   bindings.push({field:path,evidence:'Unique public link destination and, when needed, label match'});
  }
 }
 return {bindings,contexts};
}
