// Local catalog gallery; hover zoom activates only from captured source evidence.
(()=>{
 const safe=value=>{try{const u=new URL(value,location.href);return value&&u.origin===location.origin&&/^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
 for(const root of document.querySelectorAll('[data-cloner-product-gallery]')){
  let config;try{config=JSON.parse(root.dataset.clonerProductGallery);}catch{continue;}
  const wrapper=root.querySelector('.woocommerce-product-gallery__wrapper');if(!wrapper)continue;
  const images=config.images||[];if(!images.length)continue;
  const viewport=wrapper.parentElement;
  if(viewport.classList.contains('flex-viewport')){viewport.style.height='auto';viewport.style.overflow='hidden';}
  wrapper.style.width='100%';wrapper.style.transform='none';wrapper.style.transition='none';
  root.querySelectorAll('.zoomImg,.clone').forEach(el=>el.remove());
  let slides=[...wrapper.children].filter(el=>el.classList.contains('woocommerce-product-gallery__image'));
  while(slides.length<images.length){const slide=document.createElement('div');slide.className='woocommerce-product-gallery__image';slide.append(document.createElement('a'));slide.firstChild.append(document.createElement('img'));wrapper.append(slide);slides.push(slide);}
  slides.slice(images.length).forEach(el=>el.remove());slides=slides.slice(0,images.length);
  let nav=root.querySelector('.flex-control-thumbs');if(!nav&&images.length>1){nav=document.createElement('ol');nav.className='flex-control-nav flex-control-thumbs';root.append(nav);}
  let thumbs=nav?[...nav.querySelectorAll('img')]:[];
  if(nav){while(thumbs.length<images.length){const li=document.createElement('li'),img=document.createElement('img');li.append(img);nav.append(li);thumbs.push(img);}thumbs.slice(images.length).forEach(el=>el.parentElement.remove());thumbs=thumbs.slice(0,images.length);nav.hidden=images.length<2;}
  const applyImage=(index,image,replace=false)=>{
   const slide=slides[index],img=slide.querySelector('img'),anchor=slide.querySelector('a');if(!img)return;
   const full=safe(image.full||image.src),candidates=(image.captured_src?safe(image.captured_src)===full:(image.sources||[]).some(s=>safe(s.url)===full))?image.sources||[]:[],src=safe(image.src);if(src&&(replace||!safe(img.getAttribute('src'))))img.src=src;
   if(replace){const sources=candidates.filter(s=>safe(s.url));if(sources.length)img.srcset=sources.map(s=>safe(s.url)+' '+s.descriptor).join(', ');else img.removeAttribute('srcset');}
   for(const [key,value] of [['clonerFullWidth',image.full_width],['clonerFullHeight',image.full_height]]){if(Number.isFinite(value)&&value>0)img.dataset[key]=String(value);else delete img.dataset[key];}
   img.alt=image.alt||'';img.setAttribute('data-caption',image.caption||'');if(replace){for(const [attribute,value]of [['width',image.full_width],['height',image.full_height]]){if(Number.isFinite(value)&&value>0)img.setAttribute(attribute,String(value));else img.removeAttribute(attribute);}}img.style.width='100%';img.style.height='auto';if(anchor&&full)anchor.href=full;
   if(thumbs[index]){const thumb=thumbs[index];thumb.src=safe(image.thumbnail)||src||'';thumb.removeAttribute('srcset');thumb.alt=image.alt||'Product image '+(index+1);thumb.tabIndex=0;thumb.setAttribute('role','button');thumb.setAttribute('aria-label','View '+(image.alt||'product image '+(index+1)));}
  };
  images.forEach((img,i)=>applyImage(i,img,true));
  let current=0;const modifiedSlides=new Set();let clearZoom=()=>{};
  if(config.hoverZoom===true)for(const slide of slides){
   let point,moveZoom=()=>{};
   // WooCommerce's standard zoom uses mouse coordinates, not subpixel pointer coordinates.
   slide.addEventListener('mouseenter',event=>{
    if(event.sourceCapabilities?.firesTouchEvents||!matchMedia('(hover: hover)').matches||slide.hidden)return;
    clearZoom();const source=slide.querySelector('img'),url=safe(slide.querySelector('a')?.href);if(!source||!url)return;
    const zoom=new Image();let cancelled=false;const position=slide.style.position,overflow=slide.style.overflow;
    point={x:event.clientX,y:event.clientY};
    clearZoom=()=>{cancelled=true;zoom.onload=zoom.onerror=null;zoom.remove();slide.style.position=position;slide.style.overflow=overflow;};
    const move=()=>{if(!zoom.isConnected)return;const r=slide.getBoundingClientRect();if(!r.width||!r.height)return;zoom.style.left=(-Math.max(0,Math.min(point.x-r.left,r.width))*(zoom.naturalWidth-r.width)/r.width)+'px';zoom.style.top=(-Math.max(0,Math.min(point.y-r.top,r.height))*(zoom.naturalHeight-r.height)/r.height)+'px';};
    zoom.onload=()=>{if(cancelled)return;const r=slide.getBoundingClientRect();if(zoom.naturalWidth<=r.width)return;
     if(getComputedStyle(slide).position==='static')slide.style.position='relative';slide.style.overflow='hidden';zoom.className='zoomImg';zoom.alt='';zoom.setAttribute('aria-hidden','true');Object.assign(zoom.style,{position:'absolute',opacity:'1',pointerEvents:'none',border:'none',maxWidth:'none',maxHeight:'none',width:zoom.naturalWidth+'px',height:zoom.naturalHeight+'px'});slide.append(zoom);move();};
    zoom.onerror=()=>zoom.remove();zoom.src=url;moveZoom=move;
   });
   slide.addEventListener('mousemove',event=>{point={x:event.clientX,y:event.clientY};moveZoom();});
   slide.addEventListener('mouseleave',()=>{clearZoom();moveZoom=()=>{};});
  }
  const select=index=>{
   clearZoom();current=(index+slides.length)%slides.length;
   slides.forEach((slide,i)=>{const selected=i===current;slide.hidden=!selected;slide.style.display=selected?'block':'none';slide.style.width='100%';slide.style.float='none';slide.classList.toggle('flex-active-slide',selected);});
   thumbs.forEach((thumb,i)=>{thumb.classList.toggle('flex-active',i===current);thumb.setAttribute('aria-pressed',String(i===current));});
   const trigger=root.querySelector('.woocommerce-product-gallery__trigger'),full=slides[current].querySelector('a')?.href;
   if(trigger&&safe(full)){trigger.href=full;if(!root.dataset.clonerProductLightbox){trigger.removeAttribute('aria-haspopup');trigger.removeAttribute('aria-controls');}trigger.setAttribute('aria-label','Open full-size product image');}
  };
  thumbs.forEach((thumb,i)=>{thumb.addEventListener('click',()=>select(i));thumb.addEventListener('keydown',event=>{if(['Enter',' ','ArrowLeft','ArrowRight','Home','End'].includes(event.key)){event.preventDefault();select(event.key==='Home'?0:event.key==='End'?slides.length-1:event.key==='ArrowLeft'?current-1:event.key==='ArrowRight'?current+1:i);thumbs[current].focus();}});});
  root.closest('.product')?.addEventListener('cloner:product-image',event=>{
   if(event.detail?.productId!==config.productId)return;
   const image=event.detail.image;
   // Each selection starts from authored gallery data, so a replacement for one
   // variation cannot leak into another slide or survive Reset.
   for(const i of modifiedSlides)applyImage(i,images[i],true);modifiedSlides.clear();
   if(!image){select(0);return;}
   const full=safe(image.full||image.src);
   const index=images.findIndex(g=>(image.id&&g.id===image.id)||(full&&safe(g.full||g.src)===full));
   if(index>=0){applyImage(index,image,true);modifiedSlides.add(index);select(index);}else if(safe(image.src)){applyImage(0,image,true);modifiedSlides.add(0);select(0);}
  });
  select(0);root.dataset.clonerGalleryReady='true';
 }
})();
