// PhotoSwipe's published interface, driven only by localized authored gallery data.
(()=>{
 let active=null,opening=false;
 const local=value=>{try{if(!value)return null;const u=new URL(value,location.href);return u.origin===location.origin&&/^https?:$/.test(u.protocol)?u.href:null;}catch{return null;}};
 for(const gallery of document.querySelectorAll('[data-cloner-product-lightbox]')){
  const dialog=document.getElementById(gallery.dataset.clonerProductLightbox);
  if(!dialog||!window.PhotoSwipe||!window.PhotoSwipeUI_Default)continue;
  const open=async(event)=>{
   const trigger=event.target.closest('.woocommerce-product-gallery__trigger,.woocommerce-product-gallery__image a');
   if(!trigger||!gallery.contains(trigger)||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return;
   event.preventDefault();if(active||opening)return;opening=true;
   const slides=[...gallery.querySelectorAll('.woocommerce-product-gallery__wrapper > .woocommerce-product-gallery__image')];
   const chosen=trigger.closest('.woocommerce-product-gallery__image')||gallery.querySelector('.flex-active-slide');
   const index=Math.max(0,slides.indexOf(chosen));gallery.setAttribute('aria-busy','true');
   let restore=()=>{};
   try{
    const items=await Promise.all(slides.map(slide=>new Promise((resolve,reject)=>{
     const img=slide.querySelector('img'),src=local(slide.querySelector('a')?.href);if(!src){reject(Error('Missing local image'));return;}
     const w=Number(img?.dataset.clonerFullWidth),h=Number(img?.dataset.clonerFullHeight);if(w>0&&h>0){resolve({src,w,h,title:img?.getAttribute('data-caption')||'',alt:img?.alt||'',msrc:img?.currentSrc||src});return;}
     const probe=new Image(),timer=setTimeout(()=>{probe.onload=probe.onerror=null;reject(Error('Local image load timed out'));},10000);
     probe.onload=()=>{clearTimeout(timer);resolve({src,w:probe.naturalWidth,h:probe.naturalHeight,title:img?.getAttribute('data-caption')||'',alt:img?.alt||'',msrc:img?.currentSrc||src});};probe.onerror=()=>{clearTimeout(timer);reject(Error('Local image unavailable'));};probe.src=src;
    })));
    // WooCommerce defaults to immediate opening/closing, also safe for reduced motion.
    const viewer=new PhotoSwipe(dialog,PhotoSwipeUI_Default,items,{index,history:false,shareEl:false,closeOnScroll:false,timeToIdle:0,showAnimationDuration:0,hideAnimationDuration:0,addCaptionHTMLFn(item,el){el.children[0].textContent=item.title;return !!item.title;}});
    const inert=[];let branch=dialog;while(branch.parentElement&&branch!==document.body){for(const sibling of branch.parentElement.children)if(sibling!==branch&&!sibling.inert){sibling.inert=true;inert.push(sibling);}branch=branch.parentElement;}
    const trap=e=>{if(e.key!=='Tab')return;const buttons=[...dialog.querySelectorAll('button:not([disabled]),[href],[tabindex="0"]')].filter(el=>el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');if(!buttons.length){e.preventDefault();dialog.focus();return;}const first=buttons[0],last=buttons.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog)){e.preventDefault();last.focus();}else if(!e.shiftKey&&(document.activeElement===last||document.activeElement===dialog)){e.preventDefault();first.focus();}};
    restore=()=>{dialog.removeEventListener('keydown',trap);inert.forEach(el=>el.inert=false);};
    dialog.addEventListener('keydown',trap);active=viewer;
    const labelImages=()=>dialog.querySelectorAll('.pswp__img').forEach(img=>{const item=items.find(item=>item.src===img.src||item.msrc===img.src);if(item)img.alt=item.alt;});
    viewer.listen('afterChange',labelImages);viewer.listen('imageLoadComplete',labelImages);
    viewer.listen('destroy',()=>{restore();active=null;trigger.focus({preventScroll:true});});
    viewer.init();labelImages();gallery.removeAttribute('data-cloner-lightbox-error');
   }catch(error){restore();active=null;gallery.dataset.clonerLightboxError=error.message;const link=trigger.href;if(local(link))location.assign(link);}
   finally{opening=false;gallery.removeAttribute('aria-busy');}
  };
  gallery.addEventListener('click',open);
  const trigger=gallery.querySelector('.woocommerce-product-gallery__trigger');if(trigger){trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-controls',dialog.id);trigger.setAttribute('role','button');trigger.addEventListener('keydown',event=>{if(event.key===' '){event.preventDefault();trigger.click();}});}
 }
})();
