const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const keys=(text,re)=>[...new Set([...text.matchAll(re)].map(m=>m[1]))];
const describe=text=>({attributes:keys(text,/MIGRATION_ATTRIBUTES_(attrs\d+)_END/g),values:keys(text,/MIGRATION_VALUE_layout_values\.(value\d+)_END/g),repeats:keys(text,/MIGRATION_REPEAT_(repeat\d+)_END/g),regions:keys(text,/MIGRATION_REGION_(region\d+)_END/g)});

// Move genuinely invariant markup back into readable shared HTML. Only fields
// equal at every use qualify; title/date and other authored metadata stay dynamic.
export function templateInvariants(files){
 const descriptions=new Map(),constants=new Map();
 const info=file=>{if(!descriptions.has(file)){if(!files.has(file))throw Error('Unknown template '+file);descriptions.set(file,describe(files.get(file)));}return descriptions.get(file);};
 function collect(file,data,depth=0){
  if(depth>100)throw Error('Template nesting too deep');
  const refs=info(file);if(!constants.has(file))constants.set(file,new Map());const entries=constants.get(file);
  for(const [field,names]of [['layout_attributes',refs.attributes],['layout_values',refs.values]])for(const key of names){
   const value=data[field]?.[key],id=field+'.'+key,serialized=JSON.stringify(value);
   if(!entries.has(id))entries.set(id,{value,serialized});else if(entries.get(id)?.serialized!==serialized)entries.set(id,null);
  }
  for(const key of refs.regions)for(const item of data.layout_regions?.[key]||[])collect(item.template,{...data,...item.bindings},depth+1);
  for(const key of refs.repeats){const block=data.layout_repeats?.[key];if(block)for(const item of block.items)collect(block.template,{...data,...item},depth+1);}
 }
 function apply(){
  let attributes=0,values=0;
  for(const [file,entries]of constants){let text=files.get(file);
   for(const [id,entry]of entries){if(!entry||entry.value===undefined)continue;const [field,key]=id.split('.');
    if(field==='layout_attributes'){
     if(!entry.value||typeof entry.value!=='object'||Object.values(entry.value).some(v=>String(v).includes('MIGRATION_')))continue;
     text=text.replaceAll('MIGRATION_ATTRIBUTES_'+key+'_END',()=>Object.entries(entry.value).map(([k,v])=>k+'="'+esc(v)+'"').join(' '));attributes++;
    }else{
     if(typeof entry.value!=='string'&&typeof entry.value!=='number')continue;
     // Slot/component tokens remain dynamic at the Markdown insertion stage.
     if(String(entry.value).includes('MIGRATION_')&&!/^MIGRATION_(?:SLOT_body\d+|COMPONENT_component\d+)_END$/.test(entry.value))continue;
     text=text.replaceAll('MIGRATION_VALUE_layout_values.'+key+'_END',()=>esc(entry.value));values++;
    }
   }
   files.set(file,text);
  }
  descriptions.clear();return {staticAttributeBindings:attributes,staticTextBindings:values};
 }
 function prune(file,data,depth=0){
  if(depth>100)throw Error('Template nesting too deep');const refs=info(file),next={layout_attributes:{},layout_values:{},layout_repeats:{},layout_regions:{}};
  for(const key of refs.attributes)next.layout_attributes[key]=data.layout_attributes[key];
  for(const key of refs.values)next.layout_values[key]=data.layout_values[key];
  for(const key of refs.regions)next.layout_regions[key]=data.layout_regions[key].map(item=>({template:item.template,bindings:prune(item.template,{...data,...item.bindings},depth+1)}));
  for(const key of refs.repeats){const block=data.layout_repeats[key];next.layout_repeats[key]={template:block.template,items:block.items.map(item=>prune(block.template,{...data,...item},depth+1))};}
  return next;
 }
 return {collect,apply,prune};
}
