// Rebind captured product metadata groups to native taxonomy relationships.
// Labels and anchor styling come from the source; destinations must exist locally.
export function applyProductTaxonomies($,record,{lookups={},bindings=[],routes=[],base='',source}={}){
 if(!record.meta?.product)return [];
 const issues=[],values=record.meta.taxonomies||{},handled=new Set(),keys=[...new Set([...Object.keys(values),...Object.keys(lookups).map(k=>record.collection&&k.startsWith(record.collection+'-')?k.slice(record.collection.length+1):k),...bindings.map(b=>b.filter?.taxonomy).filter(Boolean)])];
 const origins=new Set(routes.flatMap(r=>{try{return[new URL(r.source).origin];}catch{return[];}}));
 try{origins.add(new URL(source).origin);}catch{}
 const pathname=(value,stripBase=false)=>{if(typeof value!=='string'||!value)return null;try{const u=new URL(value,source);if(!/^https?:$/.test(u.protocol)||u.username||u.password||u.search||u.hash||!origins.has(u.origin))return null;let p=u.pathname;if(stripBase&&base&&p.startsWith(base+'/'))p=p.slice(base.length);return p;}catch{return null;}};
 const lookup=key=>lookups[record.collection+'-'+key]||lookups[key]||{};
 const keyFor=href=>{const p=pathname(href,true);if(!p)return[];return keys.filter(key=>Object.values(lookup(key)).some(t=>t&&typeof t==='object'&&pathname(t.url)===p)||bindings.some(b=>b.filter?.taxonomy===key&&pathname(b.root)===p));};
 $('.summary .product_meta .posted_in,.summary .product_meta .tagged_as').each((_,group)=>{
  const node=$(group),anchors=node.find('a[href]');if(!anchors.length)return;
  const matched=[...new Set(anchors.toArray().flatMap(a=>keyFor($(a).attr('href'))))];
  matched.forEach(key=>handled.add(key));
  if(anchors.toArray().some(a=>a.parent!==group)){issues.push('Nested product taxonomy presentation requires a binding');return;}
  if(matched.length!==1){issues.push('Product taxonomy group could not be bound unambiguously');return;}
  const key=matched[0],membership=values[key]??[];handled.add(key);if(!Array.isArray(membership)){issues.push('Product taxonomy membership must be an array: '+key);return;}
  const members=[...new Set(membership.map(String))];if(!members.length){node.remove();return;}
  const contents=node.contents().toArray(),first=contents.indexOf(anchors[0]),last=contents.indexOf(anchors[anchors.length-1]);
  let separator=', ';if(anchors.length>1){const next=contents.indexOf(anchors[1]),between=contents.slice(first+1,next);if(between.every(n=>n.type==='text'))separator=between.map(n=>n.data).join('');}
  const replacements=[];
  for(const id of members){
   const term=lookup(key)[id],label=typeof term==='string'?term:term?.name;
   if(!label){issues.push('Unknown native product term: '+key+'/'+id);continue;}
   const binding=bindings.find(b=>b.filter?.taxonomy===key&&String(b.filter.term)===id&&b.page===1);
   const requested=pathname((typeof term==='object'&&term.url)||binding?.root);
   const route=requested&&routes.find(r=>pathname(r.sourceRoute)===requested||pathname(r.route)===requested);
   const link=$(anchors[0]).clone().removeAttr('id aria-current data-migration-unavailable aria-disabled').text(String(label));
   if(route)link.attr('href',base+route.route);else{issues.push('Native product term has no local archive: '+key+'/'+id);link.removeAttr('href');}
   if(replacements.length)replacements.push(separator);replacements.push($.html(link));
  }
  if(!replacements.length){node.remove();return;}
  $(anchors[0]).before(replacements.map((value,i)=>i%2?value.replace(/&/g,'&amp;').replace(/</g,'&lt;'):value).join(''));
  contents.slice(first,last+1).forEach(n=>$(n).remove());
 });
 for(const [key,membership]of Object.entries(values))if(Array.isArray(membership)&&membership.length&&!handled.has(key))issues.push('No captured product metadata group for taxonomy: '+key);
 return issues;
}
