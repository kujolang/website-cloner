import {taxonomyName} from './wordpress-taxonomy.mjs';
const sanitize=value=>String(value??'').replace(/%[a-f0-9]{2}/gi,'').replace(/[^A-Za-z0-9_-]/g,'');
export function termClass(taxonomy,term,id=term?.id){
 let slug=sanitize(term?.slug)||sanitize(id);
 if(/^[-+]?\d+(?:\.\d+)?$/.test(slug)||!slug.replaceAll('-',''))slug=sanitize(id);
 return slug?sanitize((taxonomy==='post_tag'?'tag':taxonomy)+'-'+slug):null;
}
// Recognize exact registered term classes, never every class sharing a prefix.
export function taxonomyClassPlan(mapping={},lookups={}){
 return (mapping.taxonomies||[]).map(({slug})=>{
  const key=taxonomyName(slug),known=new Set((mapping.terms?.[slug]||[]).map(t=>termClass(slug,t)).filter(Boolean));
  for(const [name,terms]of Object.entries(lookups))if(name===key||name.endsWith('-'+key))for(const [id,t]of Object.entries(terms))if(t&&typeof t==='object'){const c=termClass(slug,t,id);if(c)known.add(c);}
  return {slug,key,known};
 });
}
export function applyTaxonomyClasses($,nodes,record,{taxonomyClasses=[],lookups={}}={}){
 const issues=[],members={categories:record.meta?.categories||[],tags:record.meta?.tags||[],...record.meta?.taxonomies};
 nodes.each((_,node)=>{
  let classes=($(node).attr('class')||'').split(/\s+/).filter(Boolean);
  for(const {slug,key,known}of taxonomyClasses){
   if(!classes.some(c=>known.has(c)))continue;
   const values=members[key]||[],lookup=lookups[record.collection+'-'+key]||lookups[key]||{};
   if(!Array.isArray(values)){issues.push('Taxonomy membership must be an array: '+key);continue;}
   const replacement=[];
   for(const id of values){const term=lookup[id],c=term&&typeof term==='object'&&termClass(slug,term,id);if(c)replacement.push(c);else issues.push('Unknown native taxonomy class term: '+key+'/'+id);}
   classes=[...classes.filter(c=>!known.has(c)),...replacement];
  }
  if($(node).attr('class')!==undefined)$(node).attr('class',[...new Set(classes)].join(' '));
 });
 return [...new Set(issues)];
}
