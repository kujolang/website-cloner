import {publicReferenceLinks,fieldRelationships,relationshipIndex} from './custom-relationships.mjs';
import {publicCustomFields,publicFieldSchema} from './custom-fields.mjs';
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
const internalType=type=>['attachment','nav_menu_item','wp_navigation','wp_template','wp_template_part','wp_global_styles','wp_block','wp_font_family','wp_font_face'].includes(type);
const internalTaxonomies=new Set(['nav_menu','wp_theme','wp_template_part_area','wp_pattern_category']);
const text = html => load(String(html || '')).text().trim();
const name = value => String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
export const collectionName = type => type === 'post' ? 'posts' : type === 'page' ? 'pages' : 'wp-' + (name(type) || 'content') + (name(type) === type ? '' : '-' + createHash('sha256').update(type).digest('hex').slice(0,8));
// SSG interprets hyphens in lookup filenames as collection/taxonomy separators.
// Global custom taxonomy keys must therefore use a single collision-safe token.
import {taxonomyName} from '../scripts/wordpress-taxonomy.mjs';
export {taxonomyName};
export function restURL(origin, def, apiRoot = origin + "/wp-json") {
  const ns=def.rest_namespace || 'wp/v2', base=def.rest_base;
  if (!/^[a-zA-Z0-9_/-]+$/.test(ns) || ns.split('/').some(x=>!x||x==='..') || !/^[a-zA-Z0-9_-]+$/.test(base)) throw Error('Invalid WordPress REST endpoint');
  const root=new URL(apiRoot);if(root.origin!==origin || root.search || root.hash)throw Error("Invalid WordPress API origin");
  return `${root.href.replace(/\/$/, "")}/${ns}/${base}`;
}
export async function wordpressCatalog(model, network, origin, save, enqueue) {
  const wp=model.wordpress ||= {records:{},types:[{slug:'page',rest_base:'pages'},{slug:'post',rest_base:'posts'}],taxonomies:[],terms:{},termPages:{},termsDone:[]};
  wp.apiRoot ||= model.wordpressApiRoot || origin+'/wp-json';
  const get=async url=>{const r=await network.get(url);if(r.status!==200)throw Error('HTTP '+r.status);return {data:JSON.parse(r.body),headers:r.headers||{}};};
  if(!wp.catalogDone){
    for(const kind of ['types','taxonomies']) {
      try {
        const {data}=await get(wp.apiRoot+'/wp/v2/'+kind);
        if(!data||Array.isArray(data)||typeof data!=='object')throw Error('Invalid catalog');
        for(const [slug,d] of Object.entries(data)) {
          if(!d?.rest_base || (kind==='types'?internalType(slug):internalTaxonomies.has(slug)) || !/^[a-z][a-z0-9_-]*$/.test(slug) || ['constructor','prototype'].includes(slug))continue;
          try { restURL(origin,d,wp.apiRoot); }
          catch (error) { model.warnings.push(`WordPress ${kind} entry ${slug} skipped: ${error.message}`); continue; }
          const entry={slug,rest_base:d.rest_base,rest_namespace:d.rest_namespace||'wp/v2',types:d.types||[]};
          const list=kind==='types'?wp.types:wp.taxonomies;
          const found=list.findIndex(x=>x.slug===slug);if(found<0)list.push(entry);else list[found]=entry;
        }
      }catch(e){if(['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(e.code))throw e;model.warnings.push(`WordPress ${kind} metadata unavailable: ${e.message}; preserving HTML where accessible.`);}
    }
    for(const [slug,rest_base] of [['category','categories'],['post_tag','tags']])if(!wp.taxonomies.some(t=>t.slug===slug))wp.taxonomies.push({slug,rest_base,types:['post']});
    wp.catalogDone=true;await save();
  }
  for(const tax of wp.taxonomies){
    if(['woocommerce-store-api','events-public-api'].includes(tax.method))continue;
    while(!wp.termsDone.includes(tax.slug)){
      const page=wp.termPages[tax.slug]||1;
      try{
        const {data,headers}=await get(restURL(origin,tax,wp.apiRoot)+`?per_page=100&page=${page}`);
        if(!Array.isArray(data))throw Error('Invalid term list');
        const terms=wp.terms[tax.slug] ||= [];
        if(data.length && data.every(row=>terms.some(t=>t.id===row.id)))throw Error('Repeated term pagination');
        for(const row of data){if(!Number.isInteger(row.id))continue;terms.push({id:row.id,name:text(row.name),slug:row.slug||'',parent:row.parent||0,url:row.link||''});if(row.link)enqueue(row.link);}
        wp.termPages[tax.slug]=page+1;
        const total=Number(headers['x-wp-totalpages']);
        if(!data.length || (total>0?page>=total:data.length<100))wp.termsDone.push(tax.slug);
      }catch(e){if(['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(e.code))throw e;model.warnings.push(`WordPress ${tax.slug} terms incomplete: ${e.message}`);wp.termsDone.push(tax.slug);}
      await save();
    }
  }
  return wp;
}
export async function discoverCustomFieldSchema(model,network,type,rows){
 if(!rows.some(row=>row.acf&&typeof row.acf==='object'&&Object.keys(row.acf).length))return;
 const schemas=model.wordpress.fieldSchemas ||= {};
 if(Object.hasOwn(schemas,type.slug))return;
 if(typeof network.options!=='function')return;
 try{
  const r=await network.options(restURL(new URL(model.source).origin,type,model.wordpress.apiRoot));
  if(r.status!==200)throw Error('HTTP '+r.status);
  const schema=JSON.parse(r.body).schema?.properties?.acf;
  if(!schema||typeof schema!=='object')throw Error('No public ACF schema');
  schemas[type.slug]=publicFieldSchema(schema);
 }catch(error){
  if(['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(error.code))throw error;
  schemas[type.slug]={};model.warnings.push(`Public custom-field schema unavailable for ${type.slug}: ${error.message}; preserving values without numeric bindings.`);
 }
}
export function recordWordpress(model, row, type) {
  if(internalType(type.slug) || (row.type && row.type!==type.slug) || !row.link || (row.status && row.status!=='publish'))return;
  let u;try{u=new URL(row.link,model.source);}catch{return;}const home=new URL(model.source);if(!u.port&&!home.port&&u.hostname.replace(/^www\./,'')===home.hostname.replace(/^www\./,'')){u.host=home.host;u.protocol=home.protocol;}u.hash='';u.searchParams.sort();
  if(u.origin!==new URL(model.source).origin)return;
  const terms={};
  for(const tax of model.wordpress.taxonomies){const ids=row[tax.rest_base] ?? row[tax.slug];if(Array.isArray(ids))terms[taxonomyName(tax.slug)]=ids.filter(Number.isInteger);}
  model.wordpress.records[u.href]={...model.wordpress.records[u.href],sourceURL:u.href,title:text(row.title?.rendered||row.title||''),restReferences:publicReferenceLinks(row,model.source),customFields:publicCustomFields(row),customFieldSchema:model.wordpress.fieldSchemas?.[type.slug]||{},type:type.slug,id:row.id,slug:row.slug||'',date:row.date||'',modified:row.modified||'',excerpt:text(row.excerpt?.rendered),terms:{...model.wordpress.records[u.href]?.terms,...terms},author:text(row._embedded?.author?.[0]?.name),featuredImage:row._embedded?.['wp:featuredmedia']?.[0]?.source_url || model.wordpress.records[u.href]?.featuredImage || ''};
}
export function mapWordpress(model) {
  const wp=model.wordpress ||= {records:{},types:[],taxonomies:[],terms:{}};
  wp.taxonomies ||= [];wp.terms ||= {};
  // Public single-* body classes expose custom types even when REST hides them.
  const inferredType=page=>/(?:^|\s)single-([a-zA-Z0-9_-]+)(?=\s|$)/.exec(page.bodyClass||'')?.[1];
  const byURL=new Map(model.pages.map(p=>{const u=new URL(p.url);u.hash='';return [u.href,p];}));
  const inferredTerms=new Map();
  for(const archive of model.pages){
    const tax=/(?:^|\s)tax-([a-zA-Z0-9_-]+)(?=\s|$)/.exec(archive.bodyClass||'')?.[1];
    const id=/(?:^|\s)term-(\d+)(?=\s|$)/.exec(archive.bodyClass||'')?.[1];
    const slug=/(?:^|\s)term-([a-zA-Z][a-zA-Z0-9_-]*)(?=\s|$)/.exec(archive.bodyClass||'')?.[1];
    if(!tax||!id||!slug)continue;
    const $=load(archive.content||'');const key=taxonomyName(tax);
    if(!wp.taxonomies.some(t=>t.slug===tax))wp.taxonomies.push({slug:tax,types:[],method:'html-fallback'});
    const terms=wp.terms[tax] ||= [];
    if(!terms.some(t=>String(t.id)===id))terms.push({id:Number(id),slug,name:$('h1').first().text().trim()||slug,url:new URL(archive.route.replace(/page\/\d+\/?$/,''),model.source).href,method:'html-fallback'});
    $('article a[href],li.wp-block-post a[href],.post-card a[href],.e-loop-item a[href]').each((_,a)=>{
      let target;try{target=byURL.get(new URL($(a).attr('href'),archive.url).href);}catch{}
      if(!target||!inferredType(target))return;
      const data=inferredTerms.get(target)||{};data[key]=[...new Set([...(data[key]||[]),Number(id)])];inferredTerms.set(target,data);
    });
  }
  const relationshipTargets=relationshipIndex(Object.values(wp.records));
  for(const record of Object.values(wp.records))record.customFieldRelationships=fieldRelationships(record,relationshipTargets);
  let mapped=0;const unresolved=[];
  for(const page of model.pages){
    const u=new URL(page.url);u.searchParams.sort();let record=wp?.records[u.href];
    const sourceId=/(?:^|\s)(?:page-id|postid)-(\d+)(?=\s|$)/.exec(page.bodyClass||'')?.[1];
    if(record&&(internalType(record.type)||(sourceId&&Number(sourceId)!==record.id)))record=null;
    const semanticType=page.htmlMetadata?.documentTypes?.includes('Product')?'product':page.htmlMetadata?.documentTypes?.some(t=>['BlogPosting','NewsArticle','Article'].includes(t))?'post':page.family==='article'?'post':null;
    const type=record?.type || inferredType(page) || (/(?:^|\s)page(?:\s|$)/.test(page.bodyClass||'')?'page':null) || semanticType || 'page';
    page.contentType=collectionName(type);
    page.wordpress=record || {type,method:'html-fallback',date:page.htmlMetadata?.date||'',author:page.htmlMetadata?.author||''};
    page.taxonomies={...(inferredTerms.get(page)||{}),...(record?.terms||{})};
    for(const key of ['categories','tags'])if(!page.taxonomies[key]?.length&&page.htmlMetadata?.[key]?.length)page.taxonomies[key]=page.htmlMetadata[key];
    if(record)mapped++;
    for(const [tax,ids]of Object.entries(page.taxonomies)){
      const definition=wp?.taxonomies.find(t=>taxonomyName(t.slug)===tax);
      const known=wp?.terms[definition?.slug] || [];
      for(const id of ids)if(typeof id==='number'&&!known.some(t=>t.id===id))unresolved.push({route:page.route,taxonomy:tax,id});
    }
  }
  model.contentMapping={restMapped:mapped,htmlFallback:model.pages.length-mapped,collections:[...new Set(model.pages.map(p=>p.contentType))],unresolvedTerms:unresolved};
  if(unresolved.length && !model.warnings.includes('Some WordPress taxonomy IDs could not be resolved; see contentMapping.'))model.warnings.push('Some WordPress taxonomy IDs could not be resolved; see contentMapping.');
}
