(()=>{
 'use strict';
 // Duda's desktop runtime imposes a 768px canvas even on narrow screens.
 // Scope the responsive fallback to its declared shell and gallery markup.
 if(document.querySelector('body.dmDesktopBody #dm .dmInner')){
  const sizes=new Set([...document.querySelectorAll('[class]')].flatMap(el=>[...el.classList]).filter(c=>/^m-(?:font-)?size-\d{1,3}$/.test(c)));
  const typography=[...sizes].map(c=>{const size=Number(c.split('-').at(-1));return size>=8&&size<=160?'body.dmDesktopBody #dm .'+c+'{font-size:'+size+'px!important}':'';}).join('');
  const style=document.createElement('style');style.textContent=`
  @media(max-width:767px){${typography}body.dmDesktopBody #dm .dmInner{min-width:0!important;width:100%!important}
  body.dmDesktopBody #dm .dmRespColsWrapper{display:flex;flex-wrap:wrap}
  body.dmDesktopBody #dm .dmRespCol.small-12{width:100%!important;max-width:100%!important;flex:0 0 100%;float:none!important}
  body.dmDesktopBody #hamburger-header-container,body.dmDesktopBody #hamburger-header{width:100%!important;max-width:100%!important}
  body.dmDesktopBody #hamburger-header .dmRespColsWrapper{display:flex!important;align-items:center;flex-wrap:nowrap}
  body.dmDesktopBody #dm #hamburger-header .dmRespCol{width:auto!important;min-width:0!important;flex:1}
  body.dmDesktopBody #hamburger-header .empty-column{display:none!important}
  body.dmDesktopBody #hamburger-header a[href^="tel:"],body.dmDesktopBody #hamburger-header a[href^="tel:"] *{white-space:nowrap;font-size:clamp(14px,4vw,20px)!important}
  body.dmDesktopBody #hamburger-header .imageWidget img{max-width:80px!important;max-height:64px!important;width:auto!important;height:auto!important;object-fit:contain}
  [data-migration-gallery-grid]{display:grid!important;grid-template-columns:repeat(var(--cloner-gallery-mobile-columns),minmax(0,1fr));gap:20px}
  [data-migration-gallery-grid]>.photogallery-row,[data-migration-gallery-grid]>.photogallery-row>.photogallery-column{display:contents!important}
  [data-migration-gallery-grid] .photoGalleryThumbs{width:100%!important;min-width:0!important;margin:0!important}
  [data-migration-gallery-grid] .thumbnailInnerWrapper,[data-migration-gallery-grid] .caption-container,[data-migration-gallery-grid] .caption-inner{height:auto!important;max-height:none!important;overflow:visible!important}
  }`;document.head.append(style);
 }
 const focusable='a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]';
 let serial=0;
 document.querySelectorAll('nav').forEach(nav=>{
  const disclosures=[];
  nav.querySelectorAll('button.wp-block-navigation-submenu__toggle,button.wp-block-navigation__submenu-icon').forEach(button=>{
   const item=button.closest('li'),panel=item?.querySelector(':scope > ul');if(!panel)return;
   if(!panel.id)panel.id='migration-submenu-'+(++serial);
   button.type='button';button.setAttribute('aria-controls',panel.id);
   const set=open=>{button.setAttribute('aria-expanded',String(open));panel.hidden=!open;panel.inert=!open;item.classList.toggle('is-menu-open',open);if(open){panel.style.removeProperty('display');panel.style.visibility='visible';panel.style.opacity='1';panel.style.height='auto';panel.style.width='auto';panel.style.overflow='visible';}else {panel.style.setProperty('display','none','important');for(const key of ['visibility','opacity','height','width','overflow'])panel.style.removeProperty(key);}};
   const close=()=>set(false);set(false);disclosures.push({item,button,close});
   button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';for(const other of disclosures)if(other.item!==item&&!other.item.contains(item))other.close();set(open);});
   item.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){event.stopPropagation();event.preventDefault();close();button.focus();}});
   item.addEventListener('focusout',event=>{if(!item.contains(event.relatedTarget))close();});
  });
  document.addEventListener('click',event=>{if(!nav.contains(event.target))disclosures.forEach(d=>d.close());});
  const opener=nav.querySelector('.wp-block-navigation__responsive-container-open'),panel=nav.querySelector('.wp-block-navigation__responsive-container'),closer=panel?.querySelector('.wp-block-navigation__responsive-container-close');
  if(!opener||!panel||!closer)return;
  if(!panel.id)panel.id='migration-navigation-'+(++serial);
  opener.setAttribute('aria-controls',panel.id);opener.setAttribute('aria-expanded','false');
  const dialog=panel.querySelector('.wp-block-navigation__responsive-dialog')||panel;
  let previousOverflow='';
  const close=()=>{panel.classList.remove('is-menu-open','has-modal-open');dialog.removeAttribute('role');dialog.removeAttribute('aria-modal');opener.setAttribute('aria-expanded','false');document.documentElement.style.overflow=previousOverflow;disclosures.forEach(d=>d.close());opener.focus();};
  opener.addEventListener('click',()=>{previousOverflow=document.documentElement.style.overflow;panel.classList.add('is-menu-open','has-modal-open');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');dialog.setAttribute('aria-label',nav.getAttribute('aria-label')||'Navigation');opener.setAttribute('aria-expanded','true');document.documentElement.style.overflow='hidden';closer.focus();});
  closer.addEventListener('click',close);
  panel.addEventListener('keydown',event=>{if(opener.getAttribute('aria-expanded')!=='true')return;if(event.key==='Escape'){event.preventDefault();close();}else if(event.key==='Tab'){const items=[...panel.querySelectorAll(focusable)].filter(e=>!e.closest('[hidden],[inert]')&&e.getClientRects().length);const first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
 });
 // Elementor nested menus retain their source layout and CSS state classes.
 document.querySelectorAll('nav.e-n-menu').forEach(nav=>{
  const toggle=nav.querySelector('.e-n-menu-toggle'),wrapper=nav.querySelector('.e-n-menu-wrapper'),items=[];
  nav.querySelectorAll('.e-n-menu-dropdown-icon[aria-controls]').forEach(button=>{
   const panel=document.getElementById(button.getAttribute('aria-controls')),item=button.closest('.e-n-menu-item');
   if(!panel||!item||!nav.contains(panel))return;
   const set=open=>{button.setAttribute('aria-expanded',String(open));panel.classList.toggle('e-active',open);panel.parentElement.classList.toggle('e-active',open);panel.hidden=!open;panel.inert=!open;};
   const close=()=>set(false);items.push({close});set(false);button.type='button';
   let hover=false;try{hover=JSON.parse(nav.closest('[data-settings]')?.getAttribute('data-settings')||'{}').open_on==='hover';}catch{}
   if(hover){item.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&nav.dataset.layout!=='dropdown'){items.forEach(x=>x.close());set(true);}});item.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&!item.contains(document.activeElement))close();});}

   button.addEventListener('click',()=>{const open=button.getAttribute('aria-expanded')!=='true';items.forEach(x=>x.close());set(open);});
   item.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){event.stopPropagation();event.preventDefault();close();button.focus();}});
   item.addEventListener('focusout',event=>{if(!item.contains(event.relatedTarget))close();});
  });
  const close=()=>{items.forEach(x=>x.close());if(toggle&&wrapper){toggle.setAttribute('aria-expanded','false');if(nav.dataset.layout==='dropdown'){wrapper.hidden=true;wrapper.inert=true;wrapper.style.setProperty('display','none','important');}}};
  if(toggle&&wrapper){
   const sync=()=>{const mobile=getComputedStyle(toggle).display!=='none';nav.dataset.layout=mobile?'dropdown':'horizontal';wrapper.hidden=mobile&&toggle.getAttribute('aria-expanded')!=='true';wrapper.inert=wrapper.hidden;if(wrapper.hidden)wrapper.style.setProperty('display','none','important');else wrapper.style.removeProperty('display');};
   toggle.addEventListener('click',()=>{toggle.setAttribute('aria-expanded',String(toggle.getAttribute('aria-expanded')!=='true'));sync();});
   nav.addEventListener('keydown',event=>{if(event.key==='Escape'&&toggle.getAttribute('aria-expanded')==='true'){event.preventDefault();close();toggle.focus();}});
   window.addEventListener('resize',sync);sync();
  }
  document.addEventListener('click',event=>{if(!nav.contains(event.target))close();});
 });
 // Legacy Elementor mobile navigation uses a separate widget and link tree.
 document.querySelectorAll('.elementor-widget-nav-menu').forEach(widget=>{
  const toggle=widget.querySelector('.elementor-menu-toggle'),panel=widget.querySelector('nav.elementor-nav-menu--dropdown');if(!toggle||!panel)return;
  if(!panel.id)panel.id='migration-menu-'+(++serial);
  toggle.setAttribute('role','button');toggle.tabIndex=0;toggle.setAttribute('aria-controls',panel.id);
  const stretch=()=>{if(!widget.classList.contains('elementor-nav-menu--stretch'))return;const parent=panel.offsetParent||widget,box=parent.getBoundingClientRect();panel.style.width=document.documentElement.clientWidth+'px';panel.style.left=(-box.left)+'px';panel.style.right='auto';};
  window.addEventListener('resize',stretch);
  const set=open=>{toggle.setAttribute('aria-expanded',String(open));toggle.classList.toggle('elementor-active',open);panel.hidden=!open;panel.inert=!open;if(open)panel.style.removeProperty('display');else panel.style.setProperty('display','none','important');panel.style.setProperty('max-height',open?'80vh':'0');panel.style.setProperty('overflow-y','auto');panel.querySelectorAll('a[href]').forEach(a=>a.removeAttribute('tabindex'));if(open)stretch();};set(false);
  toggle.addEventListener('click',()=>set(toggle.getAttribute('aria-expanded')!=='true'));
  toggle.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();toggle.click();}});
  panel.querySelectorAll('li.menu-item-has-children').forEach(item=>{
   const link=item.querySelector(':scope > a'),sub=item.querySelector(':scope > ul');if(!link||!sub)return;
   const button=document.createElement('button');button.type='button';button.className='migration-submenu-toggle';button.setAttribute('aria-label','Expand '+link.textContent.trim());button.textContent='⌄';button.style.cssText='background:transparent;color:inherit;border:0;padding:0.5em;position:absolute;right:0;top:0';item.style.position='relative';link.style.paddingRight='2.5em';link.after(button);
   if(!sub.id)sub.id='migration-submenu-'+(++serial);button.setAttribute('aria-controls',sub.id);
   const expand=open=>{button.setAttribute('aria-expanded',String(open));sub.hidden=!open;sub.inert=!open;sub.style.setProperty('display',open?'block':'none','important');};expand(false);
   button.addEventListener('click',()=>expand(button.getAttribute('aria-expanded')!=='true'));
   item.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){event.stopPropagation();expand(false);button.focus();}});
  });
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'){set(false);toggle.focus();}});
  document.addEventListener('click',event=>{if(!widget.contains(event.target))set(false);});
 });
 // Classic WordPress/GeneratePress navigation uses CSS state classes and
 // may place the mobile opener in a separate header navigation wrapper.
 document.querySelectorAll('nav.main-navigation').forEach(nav=>{
  const menu=nav.querySelector('.main-nav,.unifiednav__container');if(!menu)return;
  const toggles=[...document.querySelectorAll('button.menu-toggle')].filter(b=>b.closest('nav')===nav||b.dataset.nav===nav.id);
  let opener;const disclosures=[];const positionButtons=()=>disclosures.forEach(d=>d.position());
  const closeItems=()=>disclosures.forEach(d=>d.close());
  const setMenu=open=>{nav.classList.toggle('toggled',open);toggles.forEach(b=>{b.setAttribute('aria-expanded',String(open));b.closest('nav')?.classList.toggle('toggled',open);});if(!open)closeItems();else positionButtons();};
  toggles.forEach(button=>button.addEventListener('click',()=>{opener=button;setMenu(button.getAttribute('aria-expanded')!=='true');}));
  menu.querySelectorAll('li.menu-item-has-children,li[data-sub-nav-menu]').forEach(item=>{
   const arrow=item.querySelector(':scope > a > .dropdown-menu-toggle,:scope > a .icon-angle-down'),panel=item.querySelector(':scope > ul');if(!arrow||!panel)return;
   const button=document.createElement('button');button.type='button';button.className='migration-classic-toggle';button.style.cssText='position:absolute;background:transparent;border:0;padding:0;margin:0;z-index:1';item.style.position='relative';arrow.setAttribute('aria-hidden','true');arrow.closest('a').after(button);
   const position=()=>{const a=arrow.getBoundingClientRect(),r=item.getBoundingClientRect();Object.assign(button.style,{left:(a.left-r.left)+'px',top:(a.top-r.top)+'px',width:a.width+'px',height:a.height+'px'});};
   if(!panel.id)panel.id='migration-classic-submenu-'+(++serial);
   button.tabIndex=0;button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-label','Toggle '+item.querySelector(':scope > a').textContent.trim());
   const set=open=>{button.setAttribute('aria-expanded',String(open));item.setAttribute('aria-expanded',String(open));item.classList.toggle('sfHover',open);panel.classList.toggle('toggled-on',open);panel.inert=!open;panel.hidden=!open;if(open){panel.style.setProperty('display',panel.classList.contains('unifiednav__container')?'flex':'block','important');panel.style.visibility='visible';panel.style.opacity='1';panel.style.pointerEvents='auto';panel.querySelectorAll('a[href]').forEach(a=>a.tabIndex=0);positionButtons();}else panel.style.setProperty('display','none','important');};
   let hoverOpened=false;const close=()=>{hoverOpened=false;set(false);};set(false);disclosures.push({item,button,close,position});position();
   button.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();const open=hoverOpened||button.getAttribute('aria-expanded')!=='true';hoverOpened=false;disclosures.filter(d=>d.item!==item&&!d.item.contains(item)).forEach(d=>d.close());set(open);});
   button.addEventListener('keydown',event=>{if(['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();button.click();}});
   item.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){event.preventDefault();event.stopPropagation();close();button.focus();}});
   item.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse'&&toggles.every(b=>getComputedStyle(b).display==='none')){disclosures.filter(d=>d.item!==item&&!d.item.contains(item)).forEach(d=>d.close());set(true);hoverOpened=true;}});
   item.addEventListener('pointerleave',event=>{if(event.pointerType==='mouse'&&!item.contains(document.activeElement))close();});
   item.addEventListener('focusout',event=>{if(!item.contains(event.relatedTarget))close();});
  });
  nav.addEventListener('keydown',event=>{if(event.key==='Escape'&&nav.classList.contains('toggled')){event.preventDefault();setMenu(false);opener?.focus();}});
  document.addEventListener('click',event=>{if(!nav.contains(event.target)&&!toggles.some(b=>b.contains(event.target)))setMenu(false);});
  document.fonts?.ready.then(positionButtons);
  window.addEventListener('resize',()=>{positionButtons();if(toggles.every(b=>getComputedStyle(b).display==='none'))setMenu(false);});
 });
 // Duda/Hibu drawer controls expose their target through aria-controls.
 document.querySelectorAll('button.layout-drawer-hamburger[aria-controls]').forEach(button=>{
  const panel=document.getElementById(button.getAttribute('aria-controls'));if(!panel)return;
  const set=open=>{button.setAttribute('aria-expanded',String(open));panel.setAttribute('aria-hidden',String(!open));panel.hidden=!open;panel.inert=!open;if(open){panel.style.setProperty('display','block','important');panel.style.setProperty('visibility','visible','important');panel.style.setProperty('transform','none','important');panel.style.setProperty('position','fixed');panel.style.setProperty('inset','0 auto 0 0');panel.style.setProperty('z-index','10000');panel.style.setProperty('overflow-y','auto');}else panel.style.setProperty('display','none','important');};
  set(false);button.addEventListener('click',()=>set(button.getAttribute('aria-expanded')!=='true'));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){set(false);button.focus();}});
  document.addEventListener('click',event=>{if(!panel.contains(event.target)&&!button.contains(event.target))set(false);});
 });
 // Scrollable content must be reachable without a pointing device.
 document.querySelectorAll('main *').forEach(el=>{const s=getComputedStyle(el);if(/auto|scroll/.test(s.overflowX)&&el.scrollWidth>el.clientWidth+1&&!el.querySelector(focusable))el.tabIndex=0;});
})();
