// Render authored image data into HTML before any browser runtime executes.
export function renderProductGallery($,node,images){
 const root=$(node),wrapper=root.find('.woocommerce-product-gallery__wrapper').first();if(!wrapper.length)return false;
 const original=wrapper.children('.woocommerce-product-gallery__image').toArray(),unused=new Set(original);
 const exemplar=original.length?$(original[0]).clone():$('<div class="woocommerce-product-gallery__image"><a><img></a></div>');
 wrapper.find('.clone').remove();wrapper.css({width:'100%',transform:'none',transition:'none'});
 if(wrapper.parent().hasClass('flex-viewport'))wrapper.parent().css({height:'auto',overflow:'hidden'});
 for(const [index,image]of images.entries()){
  const full=image.full||image.src;
  const matched=original.find(el=>unused.has(el)&&($(el).find('a').first().attr('href')===full||$(el).find('img').first().attr('src')===image.src));
  const node=matched||(unused.has(original[index])?original[index]:null),slide=node?$(node):exemplar.clone();unused.delete(node);
  slide.find('.clone').remove();let anchor=slide.find('a').first();if(!anchor.length){anchor=$('<a></a>');slide.prepend(anchor);}let img=anchor.find('img').not('.zoomImg').first();if(!img.length){img=$('<img>');anchor.append(img);}
  const unchanged=anchor.attr('href')===full||img.attr('src')===image.src;
  if(!unchanged)img.closest('picture').find('source').remove();
  anchor.attr('href',full).removeAttr('data-migration-unavailable aria-disabled');
  const candidates=(image.captured_src?image.captured_src===full:image.sources?.some(s=>s.url===full))?image.sources||[]:[];
  img.attr('src',image.src).attr('alt',image.alt||'').css({width:'100%',height:'auto'});
  if(candidates.length)img.attr('srcset',candidates.map(s=>s.url+' '+s.descriptor).join(', '));else img.removeAttr('srcset sizes');
  if(Object.hasOwn(image,'caption'))img.attr('data-caption',image.caption||'');else if(!unchanged)img.removeAttr('data-caption');
  // Do not leave captured large-image/lazy URLs pointing at a prior image.
  img.attr('data-large_image',full).attr('data-src',image.src);
  for(const attr of ['data-lazy-src','data-lazy-srcset','data-srcset'])img.removeAttr(attr);
  for(const [key,dimension]of [['width',image.full_width],['height',image.full_height]]){
   if(Number.isFinite(dimension)&&dimension>0)img.attr('data-large_image_'+key,String(dimension)).attr(key,String(dimension));else if(!unchanged)img.removeAttr('data-large_image_'+key+' '+key);
  }
  img.toggleClass('wp-post-image',index===0);slide.toggleClass('flex-active-slide',index===0).css({display:index===0?'block':'none',width:'100%',float:'none'});
  if(index===0)slide.removeAttr('hidden');else slide.attr('hidden','');
  slide.find('.zoomImg').attr('src',full).removeAttr('srcset').attr('alt','').attr('aria-hidden','true');
  slide.attr('data-thumb',image.thumbnail||image.src).attr('data-thumb-alt',image.alt||'');wrapper.append(slide);
 }
 for(const el of unused)$(el).remove();
 let nav=root.find('.flex-control-thumbs').first();
 if(images.length>1){if(!nav.length){nav=$('<ol class="flex-control-nav flex-control-thumbs"></ol>');root.append(nav);}nav.empty();for(const [index,image]of images.entries()){const thumb=$('<img>').attr('src',image.thumbnail||image.src).attr('alt',image.alt||'Product image '+(index+1));if(index===0)thumb.addClass('flex-active');nav.append($('<li></li>').append(thumb));}}
 else nav.remove();
 const trigger=root.find('.woocommerce-product-gallery__trigger');if(images.length)trigger.attr('href',images[0].full||images[0].src);else trigger.remove();
 root.css('opacity','1');return true;
}
