(()=>{
 for(const root of document.querySelectorAll('[data-cloner-smart-slider]')){
  let config;try{config=JSON.parse(root.dataset.clonerSmartSlider);}catch{continue;}
  const track=root.querySelector('.n2-ss-slider-4'),canvas=root.querySelector('.n2-ss-slider-3'),backgrounds=root.querySelector('.n2-ss-slide-backgrounds');
  const slides=[...root.querySelectorAll('.n2-ss-slide[data-slide-public-id]')].filter(el=>el.closest('[data-cloner-smart-slider]')===root);
  if(config?.version!==1||config.type!=='simple'||config.responsive?.type!=='auto'||!track||!canvas||!slides.length)continue;
  const base=config.responsive.base;if(!(base?.slideWidth>0&&base.slideHeight>0))continue;
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),bgs=new Map([...root.querySelectorAll('.n2-ss-slide-background[data-public-id]')].map(el=>[el.dataset.publicId,el]));
  let index=Math.max(0,slides.findIndex(el=>el.classList.contains('n2-ss-slide-active'))),animations=[],timer,deadline=0,remaining=null,paused=Number(config.autoplay?.start)===0,focused=false;
  const playingMedia=new Set();
  const own=el=>el.closest('[data-cloner-smart-slider]')===root;
  const controls=[...root.querySelectorAll('.nextend-arrow-next,.nextend-arrow-previous,[data-slide-public-id]')].filter(el=>own(el)&&!el.matches('.n2-ss-slide')&&!el.closest('.n2-ss-slide'));
  const pair=i=>[slides[i],bgs.get(slides[i].dataset.slidePublicId)].filter(Boolean);
  const state=()=>{slides.forEach((slide,i)=>{const active=i===index;slide.classList.toggle('n2-ss-slide-active',active);slide.inert=!active;for(const el of pair(i)){el.hidden=!active;el.setAttribute('aria-hidden',String(!active));el.style.transform='translate3d(0,0,0)';el.style.opacity='1';}});controls.forEach(el=>{if(el.dataset.slidePublicId)el.setAttribute('aria-selected',String(el.dataset.slidePublicId===slides[index].dataset.slidePublicId));});};
  const stop=()=>{if(timer!==null&&timer!==undefined)remaining=Math.max(0,deadline-performance.now());clearTimeout(timer);timer=null;};
  const schedule=()=>{stop();if(Number(config.autoplay?.enabled)!==1||paused||reduce.matches||focused||document.hidden||playingMedia.size||animations.length||slides.length<2)return;const slideDuration=Number(slides[index].dataset.slideDuration),duration=slideDuration>0?slideDuration*1000:Number(config.autoplay.duration);if(!Number.isFinite(duration)||duration<=0)return;const delay=remaining===null?duration:remaining;deadline=performance.now()+delay;timer=setTimeout(()=>{timer=null;if(paused||reduce.matches||focused||document.hidden||playingMedia.size){schedule();return;}remaining=null;go(index+(Number(config.autoplay.reverse)===1?-1:1));},Math.min(delay,2147483647));};
  const policy=(pause,resume)=>{if(paused){if(resume)paused=false;}else if(pause)paused=true;schedule();};
  function go(next){const old=index;if(!config.carousel&&config.carousel!==undefined)next=Math.max(0,Math.min(slides.length-1,next));else next=(next+slides.length)%slides.length;if(next===old)return;
   stop();remaining=null;animations.forEach(a=>a.cancel());animations=[];index=next;state();const duration=reduce.matches?0:Math.max(0,Math.min(10000,Number(config.animation?.duration)||0));
   if(duration&&['horizontal','vertical','fade'].includes(config.animation?.type)){
    const direction=next===0&&old===slides.length-1?1:old===0&&next===slides.length-1?-1:Math.sign(next-old),vertical=config.animation.type==='vertical',fade=config.animation.type==='fade';
    const move=n=>`translate3d(${vertical?0:n+'%'},${vertical?n+'%':0},0)`;
    for(const [i,enter] of [[old,false],[next,true]])for(const el of pair(i)){el.hidden=false;const frames=fade?[{opacity:enter?0:1},{opacity:enter?1:0}]:[{transform:move(enter?direction*100:0)},{transform:move(enter?0:-direction*100)}];animations.push(el.animate(frames,{duration,easing:config.animation.ease==='linear'?'linear':'cubic-bezier(.25,.46,.45,.94)',fill:'both'}));}
    const current=animations;Promise.all(current.map(a=>a.finished.catch(()=>{}))).then(()=>{if(animations!==current)return;current.forEach(a=>a.cancel());animations=[];state();schedule();});
   }schedule();root.dispatchEvent(new CustomEvent('cloner:slide-change',{detail:{index,id:slides[index].dataset.slidePublicId}}));
  }
  const resize=()=>{const width=root.clientWidth;if(!width)return;let device='desktopPortrait';for(const [name,queries] of Object.entries(config.responsive.mediaQueries||{})){if(Array.isArray(queries)&&queries.some(q=>typeof q==='string'&&matchMedia(q).matches)){device=name.replace(/portrait$/,'Portrait').replace(/landscape$/,'Landscape');}}
   for(const name of ['desktopPortrait','desktopLandscape','tabletPortrait','tabletLandscape','mobilePortrait','mobileLandscape'])root.classList.toggle('n2-ss-'+name,name===device);root.dataset.deviceMode=device;
   const size=config.responsive.sizes?.[device],height=size?.customHeight&&Number(size.height)>0?Number(size.height):width*base.slideHeight/base.slideWidth;
   canvas.style.height=height+'px';for(const el of [track,backgrounds].filter(Boolean)){el.style.width=width+'px';el.style.height=height+'px';el.style.position=el===backgrounds?'absolute':'relative';el.style.inset='0';}
   for(const slide of slides){slide.style.width=width+'px';slide.style.height=height+'px';slide.style.position='absolute';slide.style.inset='0';}
  };
  root.addEventListener('click',event=>{const el=event.target.closest('.nextend-arrow-next,.nextend-arrow-previous,[data-slide-public-id]');if(!el||!controls.includes(el))return;event.preventDefault();if(el.classList.contains('nextend-arrow-next'))go(index+1);else if(el.classList.contains('nextend-arrow-previous'))go(index-1);else{const next=slides.findIndex(s=>s.dataset.slidePublicId===el.dataset.slidePublicId);if(next>=0)go(next);}});
  root.addEventListener('keydown',event=>{if(event.target.matches('input,textarea,select')||event.target.isContentEditable)return;const control=event.target.closest('[role=button]');if(['Enter',' '].includes(event.key)&&controls.includes(control)&&!control.matches('button,a[href]')){event.preventDefault();control.click();}else if(config.controls?.keyboard&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();go(index+(event.key==='ArrowRight'?1:-1));}});
  if(config.controls?.touch==='horizontal'){let start;root.style.touchAction='pan-y';root.addEventListener('pointerdown',e=>{if(e.isPrimary&&e.button===0&&!e.target.closest('a,button,input,select,textarea,[role=button]'))start={x:e.clientX,y:e.clientY,id:e.pointerId};});root.addEventListener('pointerup',e=>{if(!start||start.id!==e.pointerId)return;const dx=e.clientX-start.x,dy=e.clientY-start.y;start=null;if(Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.2)go(index+(dx<0?1:-1));});root.addEventListener('pointercancel',()=>start=null);}
  root.addEventListener('click',()=>policy(Number(config.autoplay?.pause?.click)===1,Number(config.autoplay?.resume?.click)===1));
  for(const event of ['enter','leave'])root.addEventListener('mouse'+event,()=>policy(config.autoplay?.pause?.mouse===event,config.autoplay?.resume?.mouse===event));
  root.addEventListener('play',event=>{if(Number(config.autoplay?.pause?.mediaStarted)===1){playingMedia.add(event.target);schedule();}},true);
  for(const event of ['ended','pause'])root.addEventListener(event,e=>{playingMedia.delete(e.target);if(event==='ended'&&Number(config.autoplay?.resume?.mediaEnded)===1&&Number(config.autoplay?.pause?.mediaStarted)!==1)paused=false;schedule();},true);
root.addEventListener('focusin',()=>{focused=true;stop();});root.addEventListener('focusout',e=>{if(!root.contains(e.relatedTarget)){focused=false;schedule();}});document.addEventListener('visibilitychange',schedule);reduce.addEventListener('change',schedule);
  new ResizeObserver(resize).observe(root);window.addEventListener('resize',resize);resize();state();schedule();root.dataset.clonerSmartSliderReady='true';
 }
})();
