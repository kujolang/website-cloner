import test from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';import {load} from 'cheerio';
import {discoverProducts,recordProduct,hasWooCommerce,localProduct} from '../engine/commerce.mjs';import {recordWordpress,taxonomyName} from '../engine/wordpress.mjs';
const product=(id=1)=>({id,name:'Test product '+id,slug:'item-'+id,type:'simple',permalink:'https://store.test/product/item-'+id+'/',sku:'SKU-'+id,prices:{price:'1234',regular_price:'2000',sale_price:'1234',currency_minor_unit:2,currency_code:'USD'},is_in_stock:true,is_purchasable:true,categories:[{id:4,name:'Clothing',slug:'clothing',link:'https://store.test/product-category/clothing/'}],tags:[{id:9,name:'Popular',slug:'popular'}],attributes:[{id:2,name:'Size',taxonomy:'pa_size',terms:[{id:7,name:'Small',slug:'small'}]}],variations:[{id:11,attributes:[{name:'Size',value:'small'}]}],images:[{id:3,src:'https://cdn.test/hero.png',thumbnail:'https://cdn.test/thumb.png',alt:'Product image'}]});
const model=()=>({source:'https://store.test/',pages:[],media:[],warnings:[],wordpress:{records:{},types:[],taxonomies:[],terms:{},apiRoot:'https://store.test/wp-json'}});
test('WooCommerce detection uses asset/markup evidence rather than prose and adds no requests to unrelated sites',async()=>{
 assert.equal(hasWooCommerce('<p>WooCommerce checkout example</p>'),false);assert.equal(hasWooCommerce('<link href="/wp-content/plugins/woocommerce/style.css" rel="stylesheet">'),true);assert.equal(hasWooCommerce('<div class="wp-block-woocommerce-product-collection"></div>'),true);
 let calls=0;await discoverProducts(model(),{get(){calls++;}},{html:'<p>Normal site</p>'});assert.equal(calls,0);
});
test('public Store API pagination checkpoints, resumes after budgets, and respects explicit sampling',async()=>{
 const m=model(),calls=[],queued=[];let budget=true;
 const network={async get(url){calls.push(url);const page=Number(new URL(url).searchParams.get('page'));if(page===2&&budget)throw Object.assign(Error('budget'),{code:'CRAWL_BUDGET'});return{status:200,headers:{'x-wp-totalpages':'2'},body:JSON.stringify(page===1?[product(1),product(2)]:[product(3)])};}};
 const opts={html:'<div class="woocommerce"></div>',enqueue:url=>queued.push(url),save:async()=>{}};
 await discoverProducts(m,network,{...opts,maxPages:1});assert.equal(m.commerce.status,'explicit-sample');assert.equal(m.commerce.page,1);assert.equal(m.commerce.offset,1);
 await assert.rejects(discoverProducts(m,network,opts),e=>e.code==='CRAWL_BUDGET');assert.equal(m.commerce.page,2);budget=false;await discoverProducts(m,network,opts);assert.deepEqual(m.commerce.ids,[1,2,3]);assert.equal(m.commerce.status,'captured');assert.equal(calls.filter(url=>url.endsWith('page=1')).length,2);assert.equal(queued.length,3);
 const count=calls.length;await discoverProducts(m,network,opts);assert.equal(calls.length,count);
});
test('typed snapshots and native terms survive core REST enrichment without guessing money units',()=>{
 const m=model(),row=product();assert.equal(recordProduct(m,row),true);let r=m.wordpress.records[row.permalink];assert.equal(r.product.prices.price,'1234');assert.equal(r.product.prices.currency_minor_unit,2);assert.equal(r.product.is_in_stock,true);assert.equal(r.product.commerce.status,'requires-connection');assert.equal(r.terms[taxonomyName('product_cat')][0],4);
 recordWordpress(m,{id:1,type:'product',link:row.permalink,acf:{subtitle:'Hello'}},{slug:'product'});r=m.wordpress.records[row.permalink];assert.equal(r.product.sku,'SKU-1');assert.equal(r.terms[taxonomyName('product_cat')][0],4);
 const localized=localProduct(r.product,new Map([['https://cdn.test/hero.png','assets/media/hero.png']]));assert.equal(localized.gallery[0].src,'/assets/media/hero.png');assert.equal(localized.gallery[0].thumbnail,null);assert.equal(localized.asset_issues.length,1);assert.equal(recordProduct(m,{...row,permalink:'https://foreign.test/product/'}),false);
});
test('unavailable or repeated public Store responses are reported without trying authenticated endpoints',async()=>{
 for(const status of [401,404,500]){const m=model(),urls=[];await discoverProducts(m,{async get(url){urls.push(url);return{status};}},{html:'<div class="woocommerce"></div>'});assert.equal(m.commerce.status,'incomplete');assert.equal(urls.length,1);assert.match(urls[0],/wc\/store\/v1\/products/);}
 const m=model();await discoverProducts(m,{async get(){return{status:200,headers:{'x-wp-totalpages':'3'},body:JSON.stringify([product()])};}},{html:'<div class="woocommerce"></div>'});assert.equal(m.commerce.status,'incomplete');assert.match(m.commerce.issues[0].error,/Repeated/);
});
test('native product export retains shared templates, typed frontmatter, taxonomy links and editable SKU',{timeout:60000},async()=>{
 const {extract}=await import('../engine/extract.mjs'),{generate}=await import('../engine/generate.mjs'),{run}=await import('../engine/pipeline.mjs'),{parseContent,YAML}=await import('../scripts/source-project.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'woo-export-'));try{
  const m={...model(),identity:{title:'Shop'},navigation:[],design:{},metrics:{}};
  for(const id of [1,2]){const row=product(id);recordProduct(m,row);const p=extract(`<html><head><title>Product ${id}</title></head><body class="single-product postid-${id}"><main class="product"><h1>Product ${id}</h1><div class="summary"><p>SKU: <span class="sku">SKU-${id}</span></p><p>Readable product description.</p></div></main></body></html>`,row.permalink);p.styles=[];m.pages.push(p);}
  await generate(m,dir);assert.equal(JSON.parse(await readFile(path.join(dir,'commerce-report.json'),'utf8')).products.length,2);const routes=JSON.parse(await readFile(path.join(dir,'routes.json'),'utf8'));assert.ok(routes.every(r=>r.collection==='wp-product'));const files=routes.map(r=>path.join(dir,'content/wp-product/'+r.slug+'.md'));const a=parseContent(await readFile(files[0],'utf8'),files[0]),b=parseContent(await readFile(files[1],'utf8'),files[1]);assert.equal(a.meta.content_template,b.meta.content_template);assert.equal(a.meta.product.prices.price,'1234');assert.ok(a.meta.product_bindings.some(b=>b.field==='product.sku'));assert.match(a.body,/Readable product description/);assert.deepEqual(a.meta.taxonomies[taxonomyName('product_cat')],[4]);
  a.meta.product.sku='EDITED-SKU';await writeFile(files[0],'---\n'+YAML.stringify(a.meta)+'---\n'+a.body);await run(process.execPath,['scripts/build.mjs'],{cwd:dir,timeout:45000});assert.equal(load(await readFile(path.join(dir,'output/product/item-1/index.html'),'utf8'))('.sku').text(),'EDITED-SKU');assert.equal(load(await readFile(path.join(dir,'output/product/item-2/index.html'),'utf8'))('.sku').text(),'SKU-2');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('gallery-only media upgrades cached pages once and reuses previously downloaded assets',async()=>{
 const {localize}=await import('../engine/assets.mjs'),{extract}=await import('../engine/extract.mjs'),{mapWordpress}=await import('../engine/wordpress.mjs');
 const dir=await mkdtemp(path.join(tmpdir(),'woo-media-'));try{
  const m={...model(),metrics:{}};recordProduct(m,product());const p=extract('<main><h1>Product</h1></main>',product().permalink);p.assetCheckpointVersion=2;p.productAssetsLocalized=2;m.pages=[p];m.media=[{source:'https://cdn.test/hero.png',path:'assets/media/saved.png'}];mapWordpress(m);
  const requests=[],network={async get(url){requests.push(url);return{status:200,url,headers:{'content-type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=','base64')};}};
  await localize(m,network,dir);assert.deepEqual(requests,['https://cdn.test/thumb.png']);assert.equal(p.productAssetsLocalized,3);await localize(m,network,dir);assert.equal(requests.length,1);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('commerce actions cannot activate via generic form delivery and product navigation stays usable',async()=>{
 const {applyCommerce}=await import('../scripts/commerce-export.mjs'),{applyForms}=await import('../scripts/form-export.mjs');
 const $=load('<form class="cart" id="buy"><button>Buy</button></form><a class="add_to_cart_button product_type_variable" href="/product/shirt/">Select options</a><a href="/?add-to-cart=1">Add</a><form id="contact"><button data-migration-source-disabled="false">Send</button></form>');
 const forms=applyForms($,{route:'/'},[{id:'buy',sourceId:'buy',route:'/',delivery:{endpoint:'/service'}},{id:'contact',sourceId:'contact',route:'/',delivery:{endpoint:'/send'}}]);assert.equal(forms[0].status,'requires-commerce-connection');assert.equal(forms[1].status,'configured');
 const report=applyCommerce($);assert.equal(report.status,'requires-connection');assert.equal($('.cart button').is(':disabled'),true);assert.equal($('.cart').attr('data-cloner-delivery'),undefined);assert.equal($('a').first().attr('href'),'/product/shirt/');assert.equal($('a').last().attr('href'),undefined);assert.equal($('#contact button').is(':disabled'),false);
});

test('public variation snapshots bind only known IDs on the matching product and omit server fields',async()=>{
 const {publicVariationSnapshots}=await import('../engine/commerce.mjs');const p={id:7,variations:[{id:8},{id:9}]};
 const rows=[{variation_id:8,display_price:29,is_in_stock:false,sku:'<b>BLUE</b>',nonce:'secret',price_html:'<script>bad()</script>'},{variation_id:9,display_price:-1,is_in_stock:'yes'},{variation_id:10,display_price:99}];
 const html=`<form class="variations_form" data-product_id="7" data-product_variations='${JSON.stringify(rows)}'></form>`;const snapshots=publicVariationSnapshots(html,p);assert.equal(snapshots.size,2);assert.equal(snapshots.get(8).display_price,29);assert.equal(snapshots.get(8).is_in_stock,false);assert.equal(snapshots.get(8).sku,'BLUE');assert.equal(snapshots.get(8).nonce,undefined);assert.equal(snapshots.get(8).price_html,undefined);assert.equal(snapshots.get(9).display_price,undefined);assert.equal(snapshots.get(9).is_in_stock,undefined);assert.equal(publicVariationSnapshots(html.replace('data-product_id="7"','data-product_id="42"'),p).size,0);assert.equal(publicVariationSnapshots('<form class="variations_form" data-product_id="7" data-product_variations="false"></form>',p).size,0);
});

test('variation-only responsive images upgrade cached product assets once and export only localized paths',async()=>{
 const {productAssetURLs}=await import('../engine/commerce.mjs'),{localize}=await import('../engine/assets.mjs'),{extract}=await import('../engine/extract.mjs'),{mapWordpress}=await import('../engine/wordpress.mjs');
 const row={...product(),images:[],variations:[{id:8,attributes:[{name:'Size',value:'Small'}]}]},variation={variation_id:8,image_id:88,attributes:{attribute_size:'Small'},display_price:10,image:{src:'https://cdn.test/variant-600.png',full_src:'https://cdn.test/variant.png',gallery_thumbnail_src:'https://cdn.test/variant-100.png',srcset:'https://cdn.test/variant-300.png 300w, https://cdn.test/variant-600.png 600w, javascript:bad 1x',src_w:600,src_h:600,alt:'<b>Variant</b>'}};
 const html=`<form class="variations_form" data-product_id="1" data-product_variations='${JSON.stringify([variation])}'></form>`;
 assert.equal(productAssetURLs(row,html).length,4);assert.ok(productAssetURLs(row,html).every(u=>u.startsWith('https://cdn.test/')));
 const dir=await mkdtemp(path.join(tmpdir(),'woo-variation-media-'));try{
  const m={...model(),metrics:{}};recordProduct(m,row);const p=extract('<main><h1>Product</h1>'+html+'</main>',row.permalink);p.sourceHTML=html;p.assetCheckpointVersion=2;p.productAssetsLocalized=true;m.pages=[p];m.media=[{source:'https://cdn.test/variant.png',path:'assets/media/saved.png'}];mapWordpress(m);
  const requests=[],network={async get(url){requests.push(url);return{status:200,url,headers:{'content-type':'image/png'},body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aWZkAAAAASUVORK5CYII=','base64')};}};
  await localize(m,network,dir);assert.equal(requests.length,3);assert.ok(!requests.includes('https://cdn.test/variant.png'));assert.equal(p.productAssetsLocalized,3);await localize(m,network,dir);assert.equal(requests.length,3);
  const mapped=localProduct(m.wordpress.records[row.permalink].product,new Map(m.media.map(i=>[i.source,i.path])),html),image=mapped.variations[0].snapshot.image;assert.equal(image.alt,'Variant');assert.equal(image.full,'/assets/media/saved.png');assert.ok(image.src.startsWith('/assets/media/'));assert.equal(image.sources.length,2);assert.ok(image.sources.every(s=>s.url.startsWith('/assets/media/')));assert.equal(mapped.asset_issues.length,0);
  const missing=localProduct(m.wordpress.records[row.permalink].product,new Map(),html);assert.equal(missing.variations[0].snapshot.image.src,null);assert.ok(missing.asset_issues.some(i=>i.field==='variation.image.src'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Store API gallery responsive sources localize and report missing candidates',()=>{
 const m=model(),row=product();row.images[0].srcset='https://cdn.test/small.png 300w, https://cdn.test/hero.png 1200w';recordProduct(m,row);const p=m.wordpress.records[row.permalink].product;assert.equal(p.gallery[0].sources.length,2);
 const result=localProduct(p,new Map([['https://cdn.test/hero.png','assets/media/hero.png'],['https://cdn.test/thumb.png','assets/media/thumb.png']]));assert.deepEqual(result.gallery[0].sources,[{url:'/assets/media/hero.png',descriptor:'1200w'}]);assert.deepEqual(result.asset_issues,[{id:3,field:'gallery.sources',reason:'asset-not-localized'}]);
});

test('public gallery markup supplies its actual thumbnail and cached responsive candidates',()=>{
 const m=model(),row=product();recordProduct(m,row);const p=m.wordpress.records[row.permalink].product;
 const html='<div class="woocommerce-product-gallery"><div class="woocommerce-product-gallery__image" data-thumb="https://cdn.test/tiny.png"><a href="https://cdn.test/hero.png"><img src="https://cdn.test/display.png" srcset="https://cdn.test/display.png 600w, https://cdn.test/hero.png 1200w"></a></div></div>';
 const media=new Map(['hero','thumb','tiny','display'].map(key=>['https://cdn.test/'+key+'.png','assets/media/'+key+'.webp']));const result=localProduct(p,media,html);
 assert.equal(result.gallery[0].thumbnail,'/assets/media/tiny.webp');assert.equal(result.gallery[0].captured_src,'/assets/media/hero.webp');assert.equal(result.gallery[0].sources.length,2);
});
