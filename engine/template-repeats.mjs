import {load} from 'cheerio/slim';
import {createHash} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex').slice(0,20);
// Normalize binding names, not markup. Repeated rows remain real shared HTML
// templates with arrays of scalar attributes/content bindings, never HTML blobs.
function scope(html,data) {
 html=html.replace(/\s+/g," ");
 const values={},attributes={},repeats={},keys=new Map();let vi=0,ai=0,ri=0;
 html=html.replace(/MIGRATION_(VALUE_layout_values\.([a-zA-Z0-9]+)|ATTRIBUTES_(attrs\d+)|REPEAT_(repeat\d+)|SLOT_(body\d+)|COMPONENT_(component\d+))_END/g,(token,_,value,attr,repeat,slot,component)=>{
  if(keys.has(token))return keys.get(token);
  let replacement;
  if(attr){const key='attrs'+ai++;attributes[key]=data.layout_attributes[attr];replacement='MIGRATION_ATTRIBUTES_'+key+'_END';}
  else if(repeat){const key='repeat'+ri++;repeats[key]=data.layout_repeats[repeat];replacement='MIGRATION_REPEAT_'+key+'_END';}
  else {const key='value'+(++vi);values[key]=value?data.layout_values[value]:token;replacement='MIGRATION_VALUE_layout_values.'+key+'_END';}
  keys.set(token,replacement);return replacement;
 });
 return {html,layout_values:values,layout_attributes:attributes,layout_repeats:repeats};
}
export function shareRepeats(html,data){
 data.layout_repeats={};const templates=new Map();
 // Temporary attribute placeholders are valid HTML for DOM traversal.
 const $=load(html.replace(/ (MIGRATION_ATTRIBUTES_attrs\d+_END)/g,' data-binding="$1"'),null,false);
 const serialized=node=>$.html(node).replace(/data-binding="(MIGRATION_ATTRIBUTES_attrs\d+_END)"/g,'$1');
 const parents=$('*').toArray().reverse();
 for(const parent of parents){
  const nodes=$(parent).children().toArray();let i=0;
  while(i<nodes.length){const first=nodes[i];let end=i+1;
   if(!['li','article','tr','option','div','section'].includes(first.name)){i++;continue;}
   const item=scope(serialized(first),data),items=[item];
   while(end<nodes.length){const prev=nodes[end-1],next=nodes[end];let between=prev.next,valid=true;while(between&&between!==next){if(between.type!=='text'||between.data.trim())valid=false;between=between.next;}if(!valid)break;
    const candidate=scope(serialized(next),data);if(candidate.html!==item.html)break;items.push(candidate);end++;
   }
   // A single primary article is the page layout, not a repeated card.
   // Keep it visible to semantic family unification instead of hiding a
   // whole post template behind a one-item repeat binding.
   if(items.length>1||['li','tr','option'].includes(first.name)||first.name==='article'&&$(parent).children('article').length>1){
    const file='templates/repeats/repeat-'+hash(item.html)+'.html';templates.set(file,item.html);
    const key='repeat'+Object.keys(data.layout_repeats).length;
    data.layout_repeats[key]={template:file,items:items.map(({html,...bindings})=>bindings)};
    $(first).before('MIGRATION_REPEAT_'+key+'_END');for(const node of nodes.slice(i,end))$(node).remove();
   }
   i=end;
  }
 }
 const result=scope($.html().replace(/data-binding="(MIGRATION_ATTRIBUTES_attrs\d+_END)"/g,'$1'),data);
 return {...result,templates};
}
