import {load} from 'cheerio/slim';
import {pageRoute} from './extract.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {taxonomyName,collectionName} from './wordpress.mjs';
export async function writeArchiveBindings(model,project){
 const byRoute=new Map(model.routes.filter(p=>p.collection!=='pages').map(p=>[p.route,p]));
 const terms=new Map();for(const [tax,values]of Object.entries(model.wordpress?.terms||{}))for(const term of values)try{terms.set(pageRoute(term.url),{taxonomy:taxonomyName(tax),term:String(term.id)});}catch{}
 const bindings=[],unbound=[],preserved=[];
 for(const p of model.routes.filter(p=>p.collection==='pages')){
  const source=model.pages.find(page=>page.route===p.route),term=terms.get(p.route.replace(/page\/\d+\/?$/,''));
  if(!term&&!/\b(blog|archive)\b/.test(source?.bodyClass||''))continue;
  const file=`content/${p.collection}/${p.slug}.html`,html=await readFile(path.join(project,file),'utf8'),$=load(html,null,false);
  const parents=new Map();
  const excluded='nav,aside,[role=navigation],.sidebar,.related-posts';
  const inChrome=a=>$(a).closest(excluded).length||($(a).closest('header,footer').length&&!$(a).closest('article,li,.post,.card,.post-card,.e-loop-item').length);
  $('h2 a[href],h3 a[href],h4 a[href],a.wp-block-post-title,a.wp-block-read-more,a:has(h2),a:has(h3),a:has(h4),a:has(img)').each((_,a)=>{
   if(inChrome(a))return;
   const route=$(a).attr('href')?.split('#')[0],record=byRoute.get(route);if(!record)return;
   let node=$(a).closest('article,li,.e-loop-item,.elementor-post,.post,.post-card,.entry,.card');
   if(!node.length){node=$(a).parent();while(node.parent().length&&node.parent()[0].type!=='root'&&node.parent().find('h2 a,h3 a,h4 a').length===1)node=node.parent();}
   if(node.parent().is('li'))node=node.parent();
   // Individual wrapper rows (date tags, media columns, etc.) belong to their
   // card. Climb only while the wrapper still represents one known record.
   while(node.parent().is('div,li')){
    const wrapper=node.parent();if(wrapper.find('h1,nav,aside,[role=navigation]').length)break;
    const records=new Set(wrapper.find('a[href]').toArray().filter(a=>!inChrome(a)).map(a=>byRoute.get($(a).attr('href')?.split('#')[0])).filter(Boolean));
    if(records.size!==1||!records.has(record))break;node=wrapper;
   }
   // Cheerio parent() excludes the fragment root; top-level articles still
   // form a genuine list without requiring a design-changing wrapper element.
   const parent=node[0]?.parent;if(!node.length||!parent)return;
   if(!parents.has(parent))parents.set(parent,new Map());parents.get(parent).set(node[0],record);
  });
  const candidates=[...parents].filter(([,children])=>children.size>=1).sort((a,b)=>b[1].size-a[1].size);
  if(!candidates.length || (candidates.length>1 && candidates[0][1].size===candidates[1][1].size)){
   // Keep the source shell and editorial introductions, but replace uncertain
   // listing fragments with an automatically maintained native SSG listing.
   const id='archive-'+p.slug;
   let scope=$('main,[role=main]').first();if(!scope.length)scope=$.root();
   const linked=new Set();
   scope.find('a[href]').each((_,a)=>{
    if(inChrome(a))return;
    const record=byRoute.get($(a).attr('href')?.split('#')[0]);if(!record)return;
    linked.add(record.collection);
    let node=$(a);
    while(node.parent().length && node.parent()[0]!==scope[0] && node.parent()[0].type!=='root'){
     const parent=node.parent();
     if(parent.find('h1,header,footer,nav,aside').length)break;
     if(parent.find('p').filter((_,el)=>!$(el).closest('article,li,.post,.card,.post-card,.e-loop-item').length).length)break;
     node=parent;
    }
    node.attr('data-migration-obsolete-listing','');
   });
   const explicitType=/(?:^|\s)post-type-archive-([^\s]+)/.exec(source?.bodyClass||'')?.[1];
   const inferred=collectionName(explicitType||'post');
   // A nested WordPress installation may call its homepage `blog` while
   // records elsewhere in the migration belong to a different installation.
   const blogRecords=/\bblog\b/.test(source?.bodyClass||'')&&[...byRoute.values()].some(record=>record.collection===inferred&&record.route.startsWith(p.route));
   const scoped=term||explicitType||blogRecords;
   if(!linked.size&&(!scoped||![...byRoute.values()].some(record=>record.collection===inferred))){
    preserved.push({route:p.route,reason:'Archive has no separately captured native records; editable source rows and pagination retained.'});continue;
   }
   scope.find('[data-migration-obsolete-listing]').remove();
   scope.find('.woocommerce-no-products-found,.no-results.not-found,[data-migration-empty-archive]').attr('data-migration-empty-archive',id);
   scope.append(`<ul class="migration-native-listing" data-migration-archive="${id}"></ul>`);
   const pageMatch=/^(.*\/)page\/(\d+)\/?$/.exec(p.route),root=pageMatch?pageMatch[1]:p.route;
   bindings.push({id,source:p.collection+'/'+p.slug,root,page:pageMatch?Number(pageMatch[2]):1,mode:'native',filter:term||{types:linked.size?[...linked]:[collectionName(/(?:^|\s)post-type-archive-([^\s]+)/.exec(source?.bodyClass||'')?.[1]||'post')]},reason:'Source cards could not be bound reliably; native listing generated automatically.'});
   await writeFile(path.join(project,file),$.html());continue;
  }
  const [parent,children]=candidates[0],id='archive-'+p.slug;
  const rootContainer=parent.type==='root';if(!rootContainer)$(parent).attr('data-migration-archive',id);
  for(const [node,record]of children)$(node).attr('data-migration-record',record.collection+'/'+record.slug);
  const [sample,record]=children.entries().next().value;
  const pageMatch=/^(.*\/)page\/(\d+)\/?$/.exec(p.route),root=pageMatch?pageMatch[1]:p.route;
  const months=$(parent).children('.tribe-events-calendar-list__month-separator'),eventDates=[...children.values()].map(r=>model.wordpress?.records?.[r.source]?.event?.start);
  const eventGrouping=months.length&&eventDates.every(Boolean)?{template:$.html(months[0]),sampleDate:eventDates[0],locale:source?.lang||'en',order:eventDates.length>1&&eventDates[0]>eventDates.at(-1)?'desc':'asc'}:undefined;
  bindings.push({id,eventGrouping,source:p.collection+'/'+p.slug,root,page:pageMatch?Number(pageMatch[2]):1,pageSize:children.size,rootContainer,filter:term||{types:[...new Set([...children.values()].map(r=>r.collection))]},template:$.html(sample),cards:Object.fromEntries([...children].map(([node,item])=>[item.collection+'/'+item.slug,$.html(node)])),sample:record.collection+'/'+record.slug});
  await writeFile(path.join(project,file),$.html());
 }
 await writeFile(path.join(project,'archive-bindings.json'),JSON.stringify({schema:'migration-archive-bindings/v1',bindings,unbound,preserved},null,2));
}
