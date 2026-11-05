(()=>{
 // Adapt captured horizontal Elementor/Swiper markup without source scripts.
 for(const viewport of document.querySelectorAll('.e-n-carousel.swiper,.elementor-main-swiper')){
  const wrapper=viewport.querySelector(':scope > .swiper-wrapper'),scope=viewport.closest('[data-settings]');if(!wrapper||!scope||viewport.classList.contains('swiper-vertical'))continue;
  let settings;try{settings=JSON.parse(scope.dataset.settings||'{}');}catch{continue;}
  wrapper.querySelectorAll(':scope > .swiper-slide-duplicate').forEach(e=>e.remove());
  const slides=[...wrapper.children].filter(e=>e.classList.contains('swiper-slide'));if(!slides.length)continue;
  const controls=[...scope.querySelectorAll('.elementor-swiper-button-next,.elementor-swiper-button-prev,.swiper-pagination-bullet')].filter(e=>e.closest('[data-settings]')===scope);
  let clones=[],cloneCount=-1;
  let index=Math.max(0,slides.findIndex(e=>e.classList.contains('swiper-slide-active'))),shown=1,step=0;
  const initialGap=parseFloat(slides[0].style.marginRight)||0,reduce=matchMedia('(prefers-reduced-motion: reduce)');
  const bounded=(v,fallback)=>Number.isFinite(Number(v))&&Number(v)>0?Math.min(slides.length,Math.max(1,Number(v))):fallback;
  const render=(animate=false)=>{
   const mobile=innerWidth<=767,tablet=innerWidth<=1024;
   shown=bounded(settings[mobile?'slides_to_show_mobile':tablet?'slides_to_show_tablet':'slides_to_show'],mobile?1:tablet?2:3);
   const gapValue=settings[mobile?'image_spacing_custom_mobile':tablet?'image_spacing_custom_tablet':'image_spacing_custom']?.size;
   const gap=gapValue!==''&&Number.isFinite(Number(gapValue))?Math.max(0,Number(gapValue)):initialGap;
   const width=viewport.clientWidth;if(!width)return;
   const card=(width-gap*(shown-1))/shown;step=card+gap;
   const needed=settings.infinite==='no'?0:Math.ceil(shown)-1;if(needed!==cloneCount){clones.forEach(e=>e.remove());clones=slides.slice(0,needed).map(e=>{const copy=e.cloneNode(true);copy.removeAttribute('id');copy.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));copy.classList.add('swiper-slide-duplicate');wrapper.append(copy);return copy;});cloneCount=needed;}
   if(settings.infinite==='no')index=Math.min(index,Math.max(0,slides.length-Math.ceil(shown)));
   wrapper.style.display='flex';wrapper.style.gap='0px';wrapper.style.transition=animate&&!reduce.matches?'transform 250ms ease':'none';wrapper.style.transform=`translate3d(${(getComputedStyle(viewport).direction==='rtl'?1:-1)*index*step}px,0,0)`;
   [...slides,...clones].forEach((slide,i)=>{slide.style.width=card+'px';slide.style.flexShrink='0';slide.style.marginRight=gap+'px';slide.classList.toggle('swiper-slide-active',i===index);const visible=i>=index&&i<index+shown;slide.inert=!visible;slide.setAttribute('aria-hidden',String(!visible));});
   controls.filter(e=>e.classList.contains('swiper-pagination-bullet')).forEach((e,i)=>{e.classList.toggle('swiper-pagination-bullet-active',i===index);e.setAttribute('aria-current',String(i===index));});
   viewport.dispatchEvent(new CustomEvent('migration:carousel-change',{bubbles:true}));
  };
  const move=n=>{const max=Math.max(0,slides.length-Math.ceil(shown));index=settings.infinite==='no'?Math.min(max,Math.max(0,n)):((n%slides.length)+slides.length)%slides.length;render(true);};
  controls.forEach(e=>{e.setAttribute('role','button');e.tabIndex=0;if(e.tagName==='BUTTON')e.type='button';const bullets=controls.filter(x=>x.classList.contains('swiper-pagination-bullet'));const activate=()=>move(e.classList.contains('swiper-pagination-bullet')?bullets.indexOf(e):index+(e.classList.contains('elementor-swiper-button-next')?1:-1));e.addEventListener('click',activate);e.addEventListener('keydown',event=>{if((event.key==='Enter'||event.key===' ')&&e.tagName!=='BUTTON'){event.preventDefault();activate();}});});
  viewport.addEventListener('keydown',event=>{if(!['ArrowLeft','ArrowRight'].includes(event.key)||/INPUT|TEXTAREA|SELECT/.test(event.target.tagName))return;event.preventDefault();move(index+(event.key==='ArrowRight'?1:-1));});
  let start;viewport.style.touchAction='pan-y';viewport.addEventListener('pointerdown',e=>{if(e.isPrimary)start={x:e.clientX,y:e.clientY};});viewport.addEventListener('pointerup',e=>{if(!start)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy))move(index+(dx<0?1:-1));});viewport.addEventListener('pointercancel',()=>start=null);
  new ResizeObserver(()=>render()).observe(viewport);render();document.fonts?.ready.then(()=>render());
 }
})();
