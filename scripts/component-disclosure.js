(()=>{
 'use strict';const items=[];let serial=0;
 document.querySelectorAll('[data-migration-disclosure]').forEach(root=>{
  const button=root.querySelector('[data-migration-disclosure-button]'),panel=root.querySelector('[data-migration-disclosure-panel]'),trigger=root.querySelector('[data-migration-disclosure-trigger]');if(!button||!panel)return;
  if(!panel.id){let id;do{id='cloner-disclosure-'+(++serial);}while(document.getElementById(id));panel.id=id;}button.type='button';button.setAttribute('aria-controls',panel.id);
  const first=()=>panel.querySelector('a[href],button:not([disabled]),input:not([disabled]),[tabindex="0"]');
  const set=open=>{button.setAttribute('aria-expanded',String(open));panel.hidden=!open;panel.inert=!open;panel.style.setProperty('display',open?(panel.dataset.migrationDisclosureDisplay||'block'):'none','important');root.querySelectorAll('[data-migration-disclosure-open-class]').forEach(el=>{const cls=el.dataset.migrationDisclosureOpenClass;if(/^[a-zA-Z_][a-zA-Z0-9_-]{0,127}$/.test(cls||''))el.classList.toggle(cls,open);});};
  const responsive=root.dataset.migrationDisclosureResponsive==='button';let desktop=false;
  const sync=()=>{if(!responsive)return;const next=getComputedStyle(button).display==='none';if(next===desktop)return;desktop=next;if(desktop){panel.hidden=false;panel.inert=false;panel.style.removeProperty('display');button.setAttribute('aria-expanded','true');}else set(false);};
  const close=()=>{if(!desktop)set(false);};set(false);sync();if(responsive){new ResizeObserver(sync).observe(root);window.addEventListener('resize',sync);}
  items.push({root,close});
  (trigger||button).addEventListener('click',event=>{if(event.target.closest('a'))return;event.preventDefault();const open=button.getAttribute('aria-expanded')!=='true';items.forEach(item=>{if(item.root!==root&&!item.root.contains(root))item.close();});set(open);if(open&&root.dataset.migrationDisclosureFocus==='true')first()?.focus();});
  root.addEventListener('keydown',event=>{if(desktop)return;if(event.key==='Escape'&&button.getAttribute('aria-expanded')==='true'){event.preventDefault();event.stopPropagation();close();button.focus();}else if(event.key==='ArrowDown'&&event.target===button){event.preventDefault();set(true);first()?.focus();}});
 });
 document.addEventListener('click',event=>items.forEach(item=>{if(!item.root.contains(event.target))item.close();}));
 document.addEventListener('focusin',event=>{if(!items.some(item=>item.root.contains(event.target)))items.forEach(item=>item.close());});
})();
