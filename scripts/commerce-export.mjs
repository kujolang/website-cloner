import {applyProductPresentation} from './product-presentation.mjs';
import {renderProductGallery} from './product-gallery-markup.mjs';
// Static catalogs must not pretend to run transactions on the source backend.
export const commerceFormSelector='form.cart,form.woocommerce-checkout,.woocommerce form.checkout';
export function applyCommerce($,product,base='',baseline){
 applyProductPresentation($,product,baseline);
 const local=value=>typeof value==='string'&&value.startsWith('/assets/media/')?base+value:null;
 const image=value=>{if(!value)return null;const mapped={...value,src:local(value.src),captured_src:local(value.captured_src),full:local(value.full||value.src),thumbnail:local(value.thumbnail),sources:(value.sources||[]).map(s=>({...s,url:local(s.url)})).filter(s=>s.url)};if(mapped.captured_src&&mapped.captured_src!==mapped.full){delete mapped.full_width;delete mapped.full_height;}return mapped;};
 $('[data-cloner-product-gallery],[data-cloner-product-lightbox]').removeAttr('data-cloner-product-gallery data-cloner-product-lightbox');
 let galleries=0;
 if(Array.isArray(product?.gallery))$('.woocommerce-product-gallery').each((_,node)=>{const hoverZoom=$(node).find('.zoomImg').length>0;const images=product.gallery.map(image).filter(g=>g?.src);if(!renderProductGallery($,node,images)||!images.length)return;$(node).attr('data-cloner-product-gallery',JSON.stringify({productId:product.id,images,hoverZoom}));galleries++;});
 let lightboxes=0;const dialog=$('.pswp').filter((_,el)=>$(el).find('.pswp__container .pswp__item').length===3&&$(el).find('.pswp__ui').length).first();
 if(galleries&&dialog.length){if(!dialog.attr('id'))dialog.attr('id','cloner-product-lightbox');dialog.attr('role','dialog').attr('aria-modal','true').attr('aria-hidden','true').attr('tabindex','-1');if(!dialog.attr('aria-label'))dialog.attr('aria-label','Full screen product image');$('[data-cloner-product-gallery]').attr('data-cloner-product-lightbox',dialog.attr('id'));lightboxes=galleries;}
 $('form[data-cloner-product-options]').removeAttr('data-cloner-product-options');
 const forms=$(commerceFormSelector);let controls=0;const disabled=new Set();
 const disable=(_,node)=>{if(disabled.has(node))return;disabled.add(node);const el=$(node);el.removeAttr('href').removeAttr('formaction').attr('aria-disabled','true').attr('data-cloner-commerce','requires-connection').attr('title','Purchases require a connected commerce service.');if(el.is('button,input,select,textarea'))el.attr('disabled','disabled');controls++;};
 forms.each((_,node)=>{const form=$(node);form.removeAttr('action').removeAttr('data-cloner-delivery').attr('data-cloner-commerce','requires-connection').attr('aria-description','Purchases require a connected commerce service. This catalog is a captured snapshot.');form.find('button,input,select,textarea').each(disable);form.find('.migration-form-notice').text('Purchases require a connected commerce service. This catalog is a captured snapshot.');});
 $('.ajax_add_to_cart,.single_add_to_cart_button,[name="add-to-cart"],a.product_type_external,.wc-block-cart__submit-button,.wc-block-components-checkout-place-order-button').each(disable);
 $('a[href],a[data-migration-unavailable]').each((index,node)=>{try{const u=new URL($(node).attr('href')||$(node).attr('data-migration-unavailable'),'https://static.invalid');if(u.searchParams.has('add-to-cart')||u.searchParams.has('wc-ajax'))disable(index,node);}catch{}});
 let optionForms=0;
 if(product?.type==='variable')$('form.variations_form').each((_,node)=>{
  const form=$(node);if(Number(form.attr('data-product_id'))!==product.id)return;
  const variations=(product.variations||[]).map(v=>({...v,snapshot:v.snapshot?{...v.snapshot,image:image(v.snapshot.image)}:undefined})).filter(v=>v.snapshot?.attributes&&v.snapshot.variation_is_visible!==false&&v.snapshot.variation_is_active!==false&&Number.isFinite(v.snapshot.display_price));
  if(!variations.length)return;
  const fields=form.find('select[name^="attribute_"]');if(!fields.length)return;
  form.attr('data-cloner-product-options',JSON.stringify({productId:product.id,variations,currency:product.prices?.currency_code||'',digits:product.prices?.currency_minor_unit??2}));
  fields.filter('[data-show_option_none="yes"]').each((_,field)=>{const first=$(field).find('option').first();if(first.length&&!Object.hasOwn(first[0].attribs,'value'))first.attr('value','');});
  fields.removeAttr('disabled aria-disabled data-cloner-commerce title tabindex');
  form.find('.reset_variations').attr('role','button').attr('tabindex','0');
  form.removeAttr('data-product_variations');optionForms++;
 });
 return {optionForms,galleries,lightboxes,galleryStatus:lightboxes?'selection-and-photoswipe-local':galleries?'selection-only-fullscreen-pending':'none',status:forms.length||controls?'requires-connection':'no-transaction-controls',forms:forms.length,controls};
}
