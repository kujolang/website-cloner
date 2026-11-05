import {load} from 'cheerio/slim';
import {createHash} from 'node:crypto';
const digest=s=>createHash('sha256').update(s).digest('hex').slice(0,12);
const token=/MIGRATION_(?:VALUE_[a-zA-Z0-9_.]+?|ATTRIBUTES_attrs\d+|REPEAT_repeat\d+|SLOT_body\d+|COMPONENT_component\d+)_END/g;
const blank=()=>({layout_values:{},layout_attributes:{},layout_repeats:{},layout_regions:{}});
const voids=new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
const literal=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const shape=n=>['text','comment'].includes(n.type)?n.type:n.name;

// Unify structure, not rendered HTML. Optional/reordered sections become arrays
// of shared blocks, while the common ancestors remain in the named role template.
export function compileTemplateFamilies(variants){
 const files=new Map(),plans=new Map(),roots=new Map(),chrome={header:[],footer:[]},chromeCache={};
 for(const v of variants){
  const $=load(v.html.replace(/ (MIGRATION_ATTRIBUTES_attrs\d+_END)/g,' data-binding="$1"'),null,false);
  const visit=(n,inContent=false)=>{n.variant=v;n.owner=$;const ref=/MIGRATION_ATTRIBUTES_(attrs\d+)_END/.exec(n.attribs?.['data-binding']||'')?.[1],attrs=v.sample?.layout_attributes?.[ref];
   const kind=!inContent&&(['header','footer'].includes(n.name)?n.name:/(?:^|\s)site-footer(?:\s|$)/.test(attrs?.class||'')?'footer':null);
   if(kind){n.chromeKind=kind;chrome[kind].push(n);}
   for(const c of n.children||[])visit(c,inContent||!!kind||['main','article'].includes(n.name));};
  const nodes=$.root().contents().toArray();for(const n of nodes)visit(n);roots.set(v.id,nodes);
 }
 function store(html,label){
  const chromeLabel=['header','footer'].includes(label);
  const same=[...files].find(([file,value])=>file.startsWith('templates/partials/')&&!chromeLabel&&!/\/(?:header|footer)\.html$/.test(file)&&value===html);if(same)return same[0];
  if(chromeLabel){const file='templates/partials/'+label+'.html';files.set(file,html);return file;}
  const file='templates/partials/'+label.replace(/[^a-z0-9-]/g,'-').slice(0,80)+'-'+digest(html)+'.html';files.set(file,html);return file;
 }
 function compile(sequences,label,skipChrome=false){
  const bindings=sequences.map(blank);let ai=0,vi=0,ri=0,gi=0;
  const bind=(texts,indices)=>{
   const parts=texts.map(s=>s.split(token)),tokens=texts.map(s=>s.match(token)||[]);
   if(parts.some(p=>JSON.stringify(p)!==JSON.stringify(parts[0]))||tokens.some(t=>t.length!==tokens[0].length))return null;
   let result=literal(parts[0][0]);
   for(let i=0;i<tokens[0].length;i++){
    const refs=tokens.map(t=>t[i]),kinds=refs.map(t=>t.split('_')[1]);if(kinds.some(k=>k!==kinds[0]))return null;
    const kind=kinds[0];let replacement;
    if(kind==='ATTRIBUTES'){const key='attrs'+ai++;indices.forEach((ix,j)=>bindings[ix].layout_attributes[key]=refs[j]);replacement='MIGRATION_ATTRIBUTES_'+key+'_END';}
    else if(kind==='REPEAT'){const key='repeat'+ri++;indices.forEach((ix,j)=>bindings[ix].layout_repeats[key]=refs[j]);replacement='MIGRATION_REPEAT_'+key+'_END';}
    else if(kind==='VALUE'&&refs.some(t=>/^MIGRATION_VALUE_(?:custom_fields|product)\./.test(t))&&!refs.every(t=>t===refs[0]))return null;
    else if(kind==='VALUE'&&refs.every(t=>t===refs[0])&&!refs[0].startsWith('MIGRATION_VALUE_layout_values.'))replacement=refs[0];
    else {const key='value'+(++vi);indices.forEach((ix,j)=>bindings[ix].layout_values[key]=refs[j]);replacement='MIGRATION_VALUE_layout_values.'+key+'_END';}
    result+=replacement+literal(parts[0][i+1]);
   }
   return result;
  };
  const region=(lists,indices,partLabel,individual=false)=>{
   const key='region'+gi++,groups=new Map(),items=lists.map(()=>[]);
   for(let i=0;i<lists.length;i++)for(const n of lists[i]){
    const attr=/MIGRATION_ATTRIBUTES_(attrs\d+)_END/.exec(n.attribs?.['data-binding']||'')?.[1],attrs=n.variant.sample?.layout_attributes?.[attr];
    const semantic=/(?:^|[-_\s])(hero|team|portfolio|product|gallery|pricing|testimonial|faq|contact|grid|card)(?=[-_\s]|$)/i.exec((attrs?.class||'')+' '+(attrs?.id||''))?.[1]?.toLowerCase();
    const hint=shape(n)+(semantic?'-'+semantic:''),group=individual?hint+'-'+digest(n.type==='text'?n.data:serialize(n)):hint;
    if(!groups.has(group))groups.set(group,[]);groups.get(group).push({node:n,index:i});
   }
   const lookup=new Map();
   for(const [group,entries]of groups){
    const compiled=compile(entries.map(e=>[e.node]),partLabel+'-'+group,skipChrome);
    const file=store(compiled.html,partLabel+'-'+group.replace(/-[a-f0-9]{12}$/,''));
    entries.forEach((e,i)=>lookup.set(e.node,{template:file,bindings:compiled.bindings[i]}));
   }
   lists.forEach((list,i)=>items[i]=list.map(n=>lookup.get(n)));
   indices.forEach((ix,i)=>bindings[ix].layout_regions[key]=items[i]);
   return 'MIGRATION_REGION_'+key+'_END';
  };
  function merge(nodes,indices){
   if(nodes.every(n=>n.type==='comment'))return nodes.every(n=>n.data===nodes[0].data)?'<!--'+nodes[0].data+'-->':region(nodes.map(n=>[n]),indices,label+'-comment',true);
   if(!skipChrome&&nodes.every(n=>n.chromeKind)&&nodes.every(n=>n.chromeKind===nodes[0].chromeKind)){
    const name=nodes[0].chromeKind;
    if(!chromeCache[name]){const c=compile(chrome[name].map(n=>[n]),name,true);chromeCache[name]={file:store(c.html,name),plans:new Map(chrome[name].map((n,i)=>[n,c.bindings[i]]))};}
    const key='region'+gi++,c=chromeCache[name];indices.forEach((ix,i)=>bindings[ix].layout_regions[key]=[{template:c.file,bindings:c.plans.get(nodes[i])}]);return 'MIGRATION_REGION_'+key+'_END';
   }
   if(nodes.every(n=>n.type==='text')){
    const result=bind(nodes.map(n=>n.data),indices);
    if(result!==null)return result;
    return region(nodes.map(n=>[n]),indices,label+'-text',true);
   }
   if(nodes.some(n=>n.type==='text')||nodes.some(n=>n.name!==nodes[0].name))return region(nodes.map(n=>[n]),indices,label+'-block');
   const n=nodes[0],attrs=nodes.map(n=>n.attribs?.['data-binding']||'');
   const attribute=bind(attrs,indices);if(attribute===null)throw Error('Incompatible attribute binding');
   const open='<'+n.name+(attribute?' '+attribute:'')+'>';
   return open+(voids.has(n.name)?'':children(nodes.map(n=>n.children||[]),indices)+'</'+n.name+'>');
  }
  function children(lists,indices){
   if(lists.every(list=>list.length===lists[0].length&&list.every((n,i)=>shape(n)===shape(lists[0][i]))))return lists[0].map((_,i)=>merge(lists.map(l=>l[i]),indices)).join('');
   return region(lists,indices,label+'-section');
  }
  return {html:children(sequences,sequences.map((_,i)=>i)),bindings};
 }
 function serialize(n){return n.owner.html(n).replace(/data-binding="(MIGRATION_ATTRIBUTES_attrs\d+_END)"/g,'$1');}
 const roles=[...new Set(variants.map(v=>v.role))].sort();
 for(const role of roles){const group=variants.filter(v=>v.role===role),result=compile(group.map(v=>roots.get(v.id)),role);const file='templates/content/'+role+'.html';files.set(file,result.html);group.forEach((v,i)=>plans.set(v.id,{file,plan:result.bindings[i]}));}
 return {files,plans};
}

export function projectTemplateBindings(plan,source){
 const value=ref=>{
  const match=/^MIGRATION_(VALUE_(.+)|ATTRIBUTES_(attrs\d+)|REPEAT_(repeat\d+))_END$/.exec(ref);
  if(!match)return ref;
  const result=match[2]?match[2].split('.').reduce((v,k)=>v?.[k],source):match[3]?source.layout_attributes?.[match[3]]:source.layout_repeats?.[match[4]];
  if(result===undefined)throw Error('Missing source binding '+ref);return result;
 };
 return {layout_values:Object.fromEntries(Object.entries(plan.layout_values).map(([k,v])=>[k,value(v)])),layout_attributes:Object.fromEntries(Object.entries(plan.layout_attributes).map(([k,v])=>[k,value(v)])),layout_repeats:Object.fromEntries(Object.entries(plan.layout_repeats).map(([k,v])=>[k,value(v)])),layout_regions:Object.fromEntries(Object.entries(plan.layout_regions).map(([k,items])=>[k,items.map(item=>({template:item.template,bindings:projectTemplateBindings(item.bindings,source)}))]))};
}
