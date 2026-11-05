// ACF advertises public post relations through REST links; IDs alone are not evidence.
export function publicReferenceLinks(row,source){
 const safe=href=>{try{const u=new URL(href);return u.origin===new URL(source).origin&&!u.username&&!u.password&&!u.search&&!u.hash?u.href:null;}catch{return null;}};
 return {self:safe(row._links?.self?.[0]?.href),posts:(Array.isArray(row._links?.['acf:post'])?row._links['acf:post']:[]).map(link=>safe(link?.href)).filter(Boolean)};
}
export function relationshipIndex(records){
 const targets=new Map();
 for(const record of records){const url=record.restReferences?.self;if(url)targets.set(url,targets.has(url)?null:record);}
 return targets;
}
export function fieldRelationships(record,records){
 const result={},targets=records instanceof Map?records:relationshipIndex(records);
 function visit(value,schema,path){
  if(value&&typeof value==='object'&&!Array.isArray(value)){for(const [key,child]of Object.entries(value))if(/^[a-zA-Z0-9_]+$/.test(key)&&!['__proto__','prototype','constructor'].includes(key))visit(child,schema?.properties?.[key],path+'.'+key);return;}
  const ids=Array.isArray(value)?value:[value];
  if(!ids.length||new Set(ids).size!==ids.length||ids.some(id=>!Number.isSafeInteger(id)||id<1)||!schema?.type?.includes('array')||!schema.items?.type?.includes('integer'))return;
  if(!Array.isArray(value)&&!schema.type.includes('integer'))return;
  const relations=[];
  for(const id of ids){const matches=[...new Set(record.restReferences?.posts||[])].map(url=>targets.get(url)).filter(r=>r?.id===id);if(matches.length!==1)return;relations.push({type:matches[0].type,id,source:matches[0].sourceURL,title:matches[0].title,method:'public-acf-post-link-and-schema'});}
  result[path]=Array.isArray(value)?{many:true,items:relations,nullable:schema.type.includes('null')}:{...relations[0],nullable:schema.type.includes('null')};
 }
 visit(record.customFields,record.customFieldSchema,'custom_fields');return result;
}
export function bindRelationshipLinks($,root,relationships){
 const bindings=[],contexts={};
 for(const [field,relation]of Object.entries(relationships||{})){
  if(relation.many)continue;
  const matches=root.find('a[href]').filter((_,node)=>{if($(node).closest('nav,header,footer,form').length)return false;try{const u=new URL($(node).attr('href'),relation.source),source=new URL(relation.source);return u.origin===source.origin&&u.pathname===source.pathname&&!u.search&&!u.hash;}catch{return false;}});
  if(matches.length!==1||Object.values(relationships).filter(r=>r.source===relation.source).length!==1)continue;
  const anchor=matches.first();anchor.attr('href','MIGRATION_LINK_'+field+'_END');contexts[field]={kind:'post-relationship',type:relation.type,nullable:relation.nullable===true};
  const title=anchor.contents().filter((_,node)=>node.type==='text'&&node.data.trim()===relation.title);if(title.length===1){title[0].data='MIGRATION_RELATIONTITLE_'+field+'_END';title[0].migrationCustomField=true;}
  for(let parent=anchor[0];parent;parent=parent.parent){parent.migrationCustomField=true;if(parent===root[0])break;}
  bindings.push({field,evidence:relation.method});
 }
 return {bindings,contexts};
}
