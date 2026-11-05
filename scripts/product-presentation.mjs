const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function productMoney(value,prices){
 const digits=prices.currency_minor_unit;
 if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('Unsafe numeric product price; use a minor-unit string');
 if(!Number.isInteger(digits)||digits<0||digits>6||!/^\d{1,30}$/.test(String(value??'')))throw Error('Invalid product price or currency precision');
 const raw=BigInt(value).toString().padStart(digits+1,'0');
 const integer=digits?raw.slice(0,-digits):raw,fraction=digits?raw.slice(-digits):'';
 const decimal=prices.currency_decimal_separator??'.',thousands=prices.currency_thousand_separator??',';
 const amount=integer.replace(/\B(?=(\d{3})+(?!\d))/g,()=>String(thousands))+(digits?String(decimal)+fraction:'');
 const prefix=prices.currency_prefix??prices.currency_symbol??'',suffix=prices.currency_suffix??'';
 const affix=value=>{const text=escape(value),symbol=escape(prices.currency_symbol);return symbol&&text.includes(symbol)?text.replace(symbol,`<span class="woocommerce-Price-currencySymbol" dir="auto">${symbol}</span>`):text;};
 return `<span class="woocommerce-Price-amount amount"><bdi>${affix(prefix)}${escape(amount)}${affix(suffix)}</bdi></span>`;
}
export function applyProductPresentation($,product,baseline,{archive=false}={}){
 if(!product)return;
 const root=archive?$('li.product,article.product').first():$('.summary.entry-summary,.summary').first();if(!root.length)return;
 if(product.prices&&(JSON.stringify(product.prices)!==JSON.stringify(baseline?.prices)||product.on_sale!==baseline?.on_sale)){
  const p=product.prices;let html;
  if(p.price_range?.min_amount!=null&&p.price_range?.max_amount!=null)html=productMoney(p.price_range.min_amount,p)+' – '+productMoney(p.price_range.max_amount,p);
  else if(product.on_sale===true&&p.regular_price!=null&&p.regular_price!==p.price)html='<del>'+productMoney(p.regular_price,p)+'</del> <ins>'+productMoney(p.price,p)+'</ins>';
  else html=productMoney(p.price,p);
  root.find('.price').filter((_,el)=>!$(el).closest('.variations_form').length).first().html(html);
 }
 const productRoot=archive?root:root.closest('.product');
 if(product.on_sale===false)(archive?root.find('.onsale'):productRoot.children('.onsale')).remove();productRoot.toggleClass('sale',product.on_sale===true);
 if(typeof product.is_in_stock==='boolean')productRoot.toggleClass('instock',product.is_in_stock).toggleClass('outofstock',!product.is_in_stock);
 if(archive){
  root.find('[data-product_sku]').attr('data-product_sku',product.sku||'');
  root.find('[data-product_id]').each((_,el)=>{if(Number.isInteger(product.id)&&product.id>0)$(el).attr('data-product_id',String(product.id));else $(el).removeAttr('data-product_id');});
  root.find('[data-success_message]').removeAttr('data-success_message');
  // Purchase actions are disconnected by the export; do not retain another product's spoken label.
  root.find('.add_to_cart_button').removeAttr('aria-label aria-describedby');
 }
}

export function renderProductResultCount($,{total,page,size}){
 const issues=[];
 $('.woocommerce-result-count').each((_,el)=>{
  const node=$(el),text=node.text().replace(/\s+/g,' ').trim();
  if(!/^Showing (?:all \d+ results|the single result|\d+\s*[–-]\s*\d+ of \d+ results)$/.test(text)){issues.push('Product result-count wording requires a localized template');return;}
  if(!total){node.remove();return;}
  node.text(total===1?'Showing the single result':total<=size?`Showing all ${total} results`:`Showing ${(page-1)*size+1}–${Math.min(page*size,total)} of ${total} results`);
 });
 return issues;
}
