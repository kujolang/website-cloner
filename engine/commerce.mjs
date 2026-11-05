import {load} from 'cheerio';
import {recordWordpress,taxonomyName} from './wordpress.mjs';
const plain=value=>load(String(value||'')).text().trim();
const fields=(value,keys)=>Object.fromEntries(keys.filter(key=>value?.[key]!==undefined).map(key=>[key,structuredClone(value[key])]));
const imageURL=value=>{try{const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}};
const imageSources=value=>[...String(value||'').matchAll(/(https?:\/\/\S+)\s+([1-9]\d*w|(?:\d+\.)?\d+x)(?:\s*,|$)/g)].map(([,url,descriptor])=>({url:imageURL(url),descriptor})).filter(s=>s.url);
export function hasWooCommerce(html){
 const $=load(html||'');return $('.woocommerce,.woocommerce-page,.wc-block-grid,.wp-block-woocommerce-product-collection,form.cart').length>0||$('script[src],link[href]').toArray().some(el=>/\/plugins\/woocommerce\//i.test($(el).attr('src')||$(el).attr('href')||''));
}
export function recordProduct(model,row){
 if(!Number.isInteger(row.id)||row.id<1||typeof row.permalink!=='string')return false;
 let url;try{url=new URL(row.permalink);if(url.origin!==new URL(model.source).origin||url.search||url.hash||url.username||url.password)return false;}catch{return false;}
 const wp=model.wordpress;recordWordpress(model,{id:row.id,type:'product',link:url.href,slug:row.slug,excerpt:{rendered:row.short_description||row.summary}}, {slug:'product'});
 const record=wp.records[url.href];if(!record)return false;
 for(const [input,tax]of [['categories','product_cat'],['tags','product_tag']]){
  if(!wp.taxonomies.some(t=>t.slug===tax))wp.taxonomies.push({slug:tax,types:['product'],method:'woocommerce-store-api'});
  const terms=wp.terms[tax]||=[];const ids=[];
  for(const term of Array.isArray(row[input])?row[input]:[]){if(!Number.isInteger(term.id))continue;ids.push(term.id);if(!terms.some(t=>t.id===term.id))terms.push({id:term.id,name:plain(term.name),slug:term.slug||'',url:term.link||'',parent:0});}
  record.terms[taxonomyName(tax)]=ids;
 }
 record.product={schema:'woocommerce-public-product/v1',id:row.id,name:plain(row.name),type:row.type||'unknown',sku:row.sku||'',
  prices:fields(row.prices,['price','regular_price','sale_price','price_range','currency_code','currency_symbol','currency_minor_unit','currency_decimal_separator','currency_thousand_separator','currency_prefix','currency_suffix']),
  ...fields(row,['on_sale','is_in_stock','is_purchasable','has_options','sold_individually','low_stock_remaining','average_rating','review_count']),
  attributes:(Array.isArray(row.attributes)?row.attributes:[]).map(a=>fields(a,['id','name','taxonomy','has_variations','terms'])),
  variations:(Array.isArray(row.variations)?row.variations:[]).map(v=>fields(v,['id','attributes'])),
  gallery:(Array.isArray(row.images)?row.images:[]).map(i=>({id:i.id,src:i.src||'',thumbnail:i.thumbnail||'',alt:i.alt||'',name:i.name||'',sources:imageSources(i.srcset)})),
  provenance:{method:'public-store-api',snapshot:true},commerce:{status:'requires-connection',services:['cart','checkout','payments','inventory']}};
 for(const key of ['rating_count','total_sales'])if(Number.isSafeInteger(row[key])&&row[key]>=0){record.product[key]=row[key];(record.product.ordering_provenance||={})[key]='public-store-api';}
 record.featuredImage ||= record.product.gallery[0]?.src||'';return true;
}
export async function discoverProducts(model,network,{html='',save=async()=>{},enqueue=()=>{},maxPages=null}={}){
 if(!model.commerce&&!hasWooCommerce(html))return;
 const state=model.commerce ||= {schema:'woocommerce-discovery/v1',page:1,done:false,ids:[],issues:[],status:'discovering'};
 if(state.done)return;
 const root=new URL(model.wordpress.apiRoot||new URL('/wp-json',model.source));if(root.origin!==new URL(model.source).origin)throw Error('Invalid Store API origin');
 const known=new Set(state.ids);
 // Stable page size keeps a resumed checkpoint on the same API page boundary.
 while(!state.done&&(maxPages==null||known.size<maxPages)){
  const url=root.href.replace(/\/$/,'')+'/wc/store/v1/products?per_page=100&page='+state.page;
  try{
   const response=await network.get(url);if(response.status!==200)throw Error('HTTP '+response.status);
   const rows=JSON.parse(response.body);if(!Array.isArray(rows))throw Error('Invalid public product list');
   if(!state.offset&&rows.length&&rows.every(row=>known.has(row.id)))throw Error('Repeated product pagination');
   let cursor=state.offset||0;
   for(;cursor<rows.length;cursor++){if(maxPages!=null&&known.size>=maxPages)break;const row=rows[cursor];if(recordProduct(model,row)){known.add(row.id);enqueue(row.permalink);}}
   state.ids=[...known];state.offset=cursor;const consumed=cursor===rows.length;
   if(consumed){state.page++;state.offset=0;}
   const total=Number(response.headers?.['x-wp-totalpages']);state.done=consumed&&(!rows.length||(total>0?state.page>total:rows.length<100));
   state.status=state.done?'captured':'discovering';
  }catch(error){if(['CRAWL_BUDGET','SOURCE_UNAVAILABLE','DISK_SPACE','ENOSPC'].includes(error.code))throw error;state.done=true;state.status='incomplete';state.issues.push({page:state.page,error:error.message});model.warnings.push('Public WooCommerce data incomplete: '+error.message);}
  await save();
 }
 if(!state.done&&maxPages!=null)state.status='explicit-sample';
}
export function productAssetURLs(product,html=""){
 if(!product)return [];
 const urls=[];for(const image of product?.gallery||[])for(const value of [image.src,image.thumbnail,...(image.sources||[]).map(s=>s.url)]){try{const u=new URL(value);if(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password)urls.push(u.href);}catch{}}
 for(const snapshot of publicVariationSnapshots(html,product).values())if(snapshot.image)for(const value of [snapshot.image.src,snapshot.image.full,snapshot.image.thumbnail,...snapshot.image.sources.map(s=>s.url)])if(value)urls.push(value);
 return [...new Set(urls)];
}
export function publicVariationSnapshots(html,product){
 const snapshots=new Map();if(!product?.variations?.length)return snapshots;
 const $=load(html||''),known=new Set(product.variations.map(v=>v.id));
 $('form.variations_form[data-product_variations]').each((_,node)=>{
  const form=$(node);if(Number(form.attr('data-product_id'))!==product?.id)return;
  let rows;try{rows=JSON.parse(form.attr('data-product_variations'));}catch{return;}
  if(!Array.isArray(rows))return;
  for(const row of rows){
   if(!row||!known.has(row.variation_id)||snapshots.has(row.variation_id))continue;
   const snapshot={attributes:Object.fromEntries(Object.entries(row.attributes||{}).filter(([key,value])=>/^attribute_[a-zA-Z0-9_%\-]+$/.test(key)&&typeof value==='string')),provenance:{method:'public-product-markup',snapshot:true},price_unit:'major-currency-unit'};
   for(const key of ['display_price','display_regular_price'])if(typeof row[key]==='number'&&Number.isFinite(row[key])&&row[key]>=0)snapshot[key]=row[key];
   for(const key of ['is_in_stock','is_purchasable','variation_is_active','variation_is_visible','backorders_allowed'])if(typeof row[key]==='boolean')snapshot[key]=row[key];
   for(const key of ['sku','variation_description','availability_html'])if(typeof row[key]==='string')snapshot[key==='availability_html'?'availability_text':key]=plain(row[key]);
   if(row.image&&typeof row.image==='object'){
    const safe=imageURL,image=row.image,sources=imageSources(image.srcset);
    snapshot.image={id:Number.isSafeInteger(row.image_id)?row.image_id:null,src:safe(image.src),full:safe(image.full_src||image.url),thumbnail:safe(image.gallery_thumbnail_src||image.thumb_src),alt:plain(image.alt),sources};
    for(const [key,source]of [['width','src_w'],['height','src_h']])if(Number.isFinite(image[source])&&image[source]>0)snapshot.image[key]=image[source];
   }
   snapshots.set(row.variation_id,snapshot);
  }
 });return snapshots;
}
export function publicRatingCount(html,product){
 const $=load(html||''),ratings=$('.summary .woocommerce-product-rating .star-rating');if(ratings.length!==1)return null;
 const root=ratings.closest('.product'),id=root.attr('id');if(id&&/^product-\d+$/.test(id)&&id!=='product-'+product.id)return null;
 const average=ratings.find('strong.rating'),count=ratings.find('span.rating');
 if(average.length!==1||count.length!==1||!/^\d+$/.test(count.text().trim()))return null;
 const value=Number(count.text().trim()),rating=Number(average.text().trim());
 if(!Number.isSafeInteger(value)||value<1||!Number.isFinite(rating)||rating<1||rating>5||rating!==Number(product.average_rating))return null;
 return value;
}
export function localProduct(product,media,html='',dimensions=new Map()){
 if(!product)return undefined;const mapped=structuredClone(product);const ratingCount=publicRatingCount(html,product);if(ratingCount!==null){mapped.rating_count=ratingCount;(mapped.ordering_provenance||={}).rating_count='public-product-rating-markup';}const snapshots=publicVariationSnapshots(html,product);mapped.variations=mapped.variations.map(v=>({...v,...(snapshots.has(v.id)?{snapshot:snapshots.get(v.id)}:{})}));mapped.gallery=mapped.gallery.map(image=>({...image,src:media.has(image.src)?'/'+media.get(image.src):null,thumbnail:media.has(image.thumbnail)?'/'+media.get(image.thumbnail):null,sources:(image.sources||[]).filter(s=>media.has(s.url)).map(s=>({...s,url:'/'+media.get(s.url)}))}));
 const sourceGallery=new Map();
 if(html.includes('woocommerce-product-gallery')){const $=load(html);$('.woocommerce-product-gallery__image a[href]').each((_,a)=>{const img=$(a).find('img').not('.zoomImg').first();sourceGallery.set($(a).attr('href'),{src:img.attr('src'),sources:imageSources(img.attr('srcset')),thumbnail:$(a).closest('.woocommerce-product-gallery__image').attr('data-thumb')});});}
 mapped.gallery.forEach((image,index)=>{const observed=sourceGallery.get(product.gallery[index].src);if(!observed)return;if(!image.sources.length)image.sources=observed.sources.filter(s=>media.has(s.url)).map(s=>({...s,url:'/'+media.get(s.url)}));if(media.has(observed.thumbnail))image.thumbnail='/'+media.get(observed.thumbnail);});
 mapped.asset_issues=product.gallery.flatMap(image=>['src','thumbnail'].filter(key=>image[key]&&!media.has(image[key])).map(key=>({id:image.id,field:key,reason:'asset-not-localized'})));
 for(const image of product.gallery)for(const source of image.sources||[])if(!media.has(source.url))mapped.asset_issues.push({id:image.id,field:'gallery.sources',reason:'asset-not-localized'});
 for(const variation of mapped.variations){const image=variation.snapshot?.image;if(!image)continue;
  const local=(url,field)=>{if(!url)return null;if(media.has(url))return '/'+media.get(url);mapped.asset_issues.push({id:variation.id,field:'variation.image.'+field,reason:'asset-not-localized'});return null;};
  for(const key of ['src','full','thumbnail'])image[key]=local(image[key],key);
  image.sources=image.sources.map(source=>({...source,url:local(source.url,'sources')})).filter(source=>source.url);
 }
 for(const image of [...mapped.gallery,...mapped.variations.map(v=>v.snapshot?.image).filter(Boolean)]){image.captured_src=image.full||image.src;const size=dimensions.get(image.full||image.src);if(size?.width>0&&size?.height>0){image.full_width=size.width;image.full_height=size.height;}}
 return mapped;
}
