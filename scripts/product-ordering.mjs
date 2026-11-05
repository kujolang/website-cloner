import {createHash} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
// Public native catalog data only. Shared manifests contain final exported cards.
function applyInlineProductOrdering($,page,{routes,bindings,base=''}){
 $('[data-cloner-product-ordering]').removeAttr('data-cloner-product-ordering');
 const key=page.collection+'/'+page.slug,binding=bindings.find(b=>b.source===(page.archiveBindingSource||key));
 if(!binding||!$('.woocommerce-ordering select.orderby').length)return {status:'not-applicable'};
 const root=binding.root.replace(/\/+$/,'')+'/',family=bindings.filter(b=>b.root.replace(/\/+$/,'')+'/'===root),keys=new Set(family.map(b=>b.source));
 const pages=routes.filter(p=>keys.has(p.collection+'/'+p.slug)||family.some(b=>b.source===p.archiveBindingSource)).sort((a,b)=>(a.archivePage||family.find(x=>x.source===a.collection+'/'+a.slug)?.page||1)-(b.archivePage||family.find(x=>x.source===b.collection+'/'+b.slug)?.page||1));
 const filter=binding.filter,records=routes.filter(p=>p.meta.product&&!p.meta.draft&&!/\b(noindex|none)\b/i.test(p.robots||'')&&(filter.types?filter.types.includes(p.collection):(p.meta[filter.taxonomy]||p.meta.taxonomies?.[filter.taxonomy]||[]).map(String).includes(String(filter.term))));
 if(!records.length||!pages.length||$('ul.products').length!==1)return {status:'unbound'};
 const items=Object.fromEntries(records.map(p=>[p.collection+'/'+p.slug,{id:p.meta.product.id,sales:p.meta.product.total_sales,price:p.meta.product.prices?.price,min:p.meta.product.prices?.price_range?.min_amount??p.meta.product.prices?.price,max:p.meta.product.prices?.price_range?.max_amount??p.meta.product.prices?.price,ratingCount:p.meta.product.rating_count??(Number(p.meta.product.average_rating)===0?0:undefined),digits:p.meta.product.prices?.currency_minor_unit,currency:p.meta.product.prices?.currency_code,rating:p.meta.product.average_rating,date:p.date}]));
 const values=Object.values(items),supported=['menu_order'];
 if(values.every(p=>[p.min,p.max].every(v=>/^\d+$/.test(String(v)))&&Number.isInteger(p.digits))&&new Set(values.map(p=>p.currency+':'+p.digits)).size===1)supported.push('price','price-desc');
 if(values.every(p=>p.rating!==undefined&&Number.isFinite(Number(p.rating)))&&values.every(p=>values.filter(q=>Number(q.rating)===Number(p.rating)).length===1||Number.isInteger(p.ratingCount)))supported.push('rating');
 if(values.every(p=>Number.isSafeInteger(p.sales)&&p.sales>=0))supported.push('popularity');
 if(values.every(p=>Number.isFinite(Date.parse(p.date))))supported.push('date');
 const config={pages:[...new Set(pages.map(p=>base+p.route))],root:base+(pages[0]?.route||root),items,supported,size:binding.pageSize||20};
 const form=$('.woocommerce-ordering').first();form.removeAttr('action data-cloner-delivery').attr('data-cloner-product-ordering',JSON.stringify(config));
 // Leave disabled until local runtime has validated the exported catalog.
 return {status:'local-ordering',supported,unsupported:form.find('option').map((_,e)=>$(e).attr('value')).get().filter(v=>!supported.includes(v))};
}

export function applyProductOrdering($,page,options){
 const {context,base='',bindings}=options;if(!context)return applyInlineProductOrdering($,page,options);
 $('[data-cloner-product-ordering]').removeAttr('data-cloner-product-ordering');
 const binding=bindings.find(b=>b.source===(page.archiveBindingSource||page.collection+'/'+page.slug));
 if(!binding||!$('.woocommerce-ordering select.orderby').length)return {status:'not-applicable'};
 const family=binding.root.replace(/\/+$/,'')+'/',id=createHash('sha256').update(family).digest('hex').slice(0,24);
 let group=context.get(id),report;
 if(!group){report=applyInlineProductOrdering($,page,options);if(report.status!=='local-ordering')return report;
  const config=JSON.parse($('.woocommerce-ordering').first().attr('data-cloner-product-ordering'));
  group={config,route:'/assets/catalogs/'+id+'.json',pages:new Map(),report};context.set(id,group);
 }
 const config=group.config,number=config.pages.indexOf(base+page.route)+1;
 const descriptor={manifest:base+group.route,root:config.root,size:config.size,supported:config.supported,page:Math.max(1,number)};
 $('.woocommerce-ordering').first().removeAttr('action data-cloner-delivery').attr('data-cloner-product-ordering',JSON.stringify(descriptor));
 return {...group.report,manifest:descriptor.manifest};
}
// Collect final rendered cards after link and commerce safety transformations.
export function collectProductCatalog($,page,{context,base=''}){
 const raw=$('.woocommerce-ordering').first().attr('data-cloner-product-ordering');if(!raw)return;
 const descriptor=JSON.parse(raw);const group=[...context.values()].find(g=>base+g.route===descriptor.manifest);if(!group)return;
 group.pages.set(base+page.route,$('ul.products > [data-migration-record]').toArray().map(node=>({key:$(node).attr('data-migration-record'),html:$.html(node)})));
}
export async function writeProductCatalogs(context,output='output'){
 const report=[];if(context.size)await mkdir(output+'/assets/catalogs',{recursive:true});
 for(const group of context.values()){
  const cards=new Map();for(const page of group.config.pages)for(const card of group.pages.get(page)||[])if(Object.hasOwn(group.config.items,card.key)&&!cards.has(card.key))cards.set(card.key,card.html);
  const missing=Object.keys(group.config.items).filter(key=>!cards.has(key));
  const manifest={schema:'website-cloner-catalog/v1',items:group.config.items,cards:[...cards].map(([key,html])=>({key,html}))};
  const json=JSON.stringify(manifest);await writeFile(output+group.route,json);
  report.push({route:group.route,status:missing.length?'incomplete':'passed',missing,products:cards.size,bytes:Buffer.byteLength(json)});
 }
 return report;
}
