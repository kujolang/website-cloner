import test from 'node:test';import assert from 'node:assert/strict';import{load}from'cheerio';import{productMoney,applyProductPresentation,renderProductResultCount}from'../scripts/product-presentation.mjs';
const prices={price:'1900',regular_price:'2400',currency_minor_unit:2,currency_prefix:'$',currency_suffix:'',currency_decimal_separator:'.',currency_thousand_separator:','};
test('native product amounts preserve minor-unit precision, separators, ranges and escaping',()=>{
 assert.equal(load(productMoney('12345678901234567890',prices)).text(),'$123,456,789,012,345,678.90');assert.equal(load(productMoney('123456',{...prices,currency_prefix:'',currency_suffix:' €',currency_decimal_separator:',',currency_thousand_separator:'.'})).text(),'1.234,56 €');assert.equal(load(productMoney('0',{...prices,currency_minor_unit:0})).text(),'$0');assert.ok(!productMoney('1',{...prices,currency_prefix:'<script>'}).includes('<script>'));
 for(const value of ['1.2','-1','NaN',undefined,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>productMoney(value,prices));
});
test('authoring updates card prices and stock without retaining sampled sale state or product identifiers',()=>{
 const $=load('<li class="product sale instock"><a class="product-link"><span class="onsale">Sale!</span><span class="price">OLD</span></a><a class="add_to_cart_button" data-product_id="9" data-product_sku="OLD" aria-label="Buy old" data-success_message="Old added">Buy</a></li>');
 applyProductPresentation($,{prices:{...prices,price:'3100'},on_sale:false,is_in_stock:false,sku:'NEW'},undefined,{archive:true});assert.equal($('.price').text(),'$31.00');assert.equal($('.onsale').length,0);assert.equal($('.product').hasClass('outofstock'),true);assert.equal($('[data-product_id]').length,0);assert.equal($('.add_to_cart_button').attr('data-product_sku'),'NEW');assert.equal($('.add_to_cart_button').attr('aria-label'),undefined);
 applyProductPresentation($,{prices,on_sale:true},undefined,{archive:true});assert.equal($('.price del').text(),'$24.00');assert.equal($('.price ins').text(),'$19.00');
 const p={prices,on_sale:true};$('.price').html('Preserve original typography');applyProductPresentation($,p,p,{archive:true});assert.equal($('.price').html(),'Preserve original typography');
});
test('detail price edits and variable ranges use shared presentation without rewriting variation panels',()=>{
 const $=load('<div class="summary"><p class="price">OLD</p><form class="variations_form"><span class="price">selected</span></form></div>');applyProductPresentation($,{prices:{...prices,price_range:{min_amount:'1200',max_amount:'2300'}}});assert.equal($('p.price').text(),'$12.00 – $23.00');assert.equal($('form .price').text(),'selected');
});

test('source English product result counts follow native membership and pagination; unknown translations are reported',()=>{
 for(const [total,page,size,expected]of [[3,1,2,'Showing 1–2 of 3 results'],[3,2,2,'Showing 3–3 of 3 results'],[1,1,2,'Showing the single result'],[2,1,2,'Showing all 2 results'],[0,1,2,'']]){const $=load('<p class="woocommerce-result-count">Showing all 2 results</p>');assert.deepEqual(renderProductResultCount($,{total,page,size}),[]);assert.equal($('.woocommerce-result-count').text(),expected);}
 const $=load('<p class="woocommerce-result-count">2 Ergebnisse</p>');assert.equal(renderProductResultCount($,{total:3,page:1,size:2}).length,1);assert.equal($('.woocommerce-result-count').text(),'2 Ergebnisse');
});
