// Captured option inspection only: no cart, inventory request or source submit.
(()=>{
 for(const form of document.querySelectorAll('form[data-cloner-product-options]')){
  let config;try{config=JSON.parse(form.dataset.clonerProductOptions);}catch{continue;}
  const fields=[...form.querySelectorAll('select[name^="attribute_"]')];
  let panel=form.querySelector('.single_variation');if(!panel){panel=document.createElement('div');panel.className='woocommerce-variation single_variation';form.append(panel);}
  panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');
  const initialSKU=form.closest('.product')?.querySelector('.sku'),sku=initialSKU?.textContent;
  const money=value=>{try{return new Intl.NumberFormat(document.documentElement.lang||'en',{style:'currency',currency:config.currency,minimumFractionDigits:config.digits,maximumFractionDigits:config.digits}).format(value);}catch{return String(value);}};
  const showImage=image=>form.dispatchEvent(new CustomEvent('cloner:product-image',{bubbles:true,detail:{productId:config.productId,image}}));
  const update=()=>{
   for(const reset of form.querySelectorAll('.reset_variations'))reset.style.visibility=fields.some(f=>f.value)?'visible':'hidden';
   panel.replaceChildren();if(initialSKU)initialSKU.textContent=sku;
   if(fields.some(f=>!f.value)){panel.hidden=true;showImage(null);return;}
   panel.hidden=false;panel.style.display='';
   const match=config.variations.find(v=>fields.every(f=>Object.hasOwn(v.snapshot.attributes,f.name)&&(v.snapshot.attributes[f.name]===''||v.snapshot.attributes[f.name]===f.value)));
   if(!match){showImage(null);panel.textContent='This combination is unavailable in the captured catalog.';return;}
   const data=match.snapshot;showImage(data.image||null);
   const text=(className,value)=>{const node=document.createElement('div');node.className=className;node.textContent=value;panel.append(node);};
   if(data.variation_description)text('woocommerce-variation-description',data.variation_description);
   const price=document.createElement('div');price.className='woocommerce-variation-price';const priceSpan=document.createElement('span');priceSpan.className='price';price.append(priceSpan);
   const amount=value=>{const node=document.createElement('span');node.className='woocommerce-Price-amount amount';const bdi=document.createElement('bdi');bdi.textContent=money(value);node.append(bdi);return node;};
   if(Number.isFinite(data.display_regular_price)&&data.display_regular_price>data.display_price){const old=document.createElement('del'),sale=document.createElement('ins');old.append(amount(data.display_regular_price));sale.append(amount(data.display_price));priceSpan.append(old,' ',sale);}else priceSpan.append(amount(data.display_price));panel.append(price);
   const availability=document.createElement('div');availability.className='woocommerce-variation-availability';const stock=document.createElement('p');stock.className='stock '+(data.is_in_stock===false?'out-of-stock':'in-stock');stock.textContent=typeof data.availability_text==='string'?data.availability_text:(data.is_in_stock===false?'Out of stock':data.is_in_stock===true?'In stock (captured snapshot)':'Availability not captured');if(stock.textContent)availability.append(stock);panel.append(availability);
   if(initialSKU&&data.sku)initialSKU.textContent=data.sku;
  };
  fields.forEach(field=>field.addEventListener('change',update));
  for(const reset of form.querySelectorAll('.reset_variations')){
   const clear=event=>{event.preventDefault();fields.forEach(f=>{f.value='';});update();fields[0]?.focus();};
   reset.addEventListener('click',clear);reset.addEventListener('keydown',event=>{if(event.key===' '||event.key==='Enter')clear(event);});
  }
  form.addEventListener('submit',event=>event.preventDefault());update();
 }
})();
