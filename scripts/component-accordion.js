(()=>{
 const roots='.elementor-accordion,.elementor-toggle,[data-migration-accordion]',groups=[],motion=matchMedia('(prefers-reduced-motion: reduce)');
 for(const root of document.querySelectorAll(roots)){
  if(root.dataset.migrationAccordionReady)continue;
  const scope=roots+',.elementor-tabs,.e-n-tabs,[data-migration-tabs]';
  const controls=[...root.querySelectorAll('[aria-controls][aria-expanded],.elementor-tab-title')].filter(t=>t.closest(scope)===root);
  const pairs=controls.map(control=>{
   const id=control.getAttribute('aria-controls');
   const panel=[...root.querySelectorAll('[id]')].find(p=>id&&p.id===id&&p.closest(scope)===root);
   const item=control.closest('[data-migration-accordion-item]');
   return {control,panel,item:item?.closest(roots)===root?item:null};
  }).filter(p=>p.panel);
  if(!pairs.length)continue;
  root.dataset.migrationAccordionReady='true';
  const display=new Map(pairs.map(({panel})=>[panel,panel.style.display==='none'?'':panel.style.display]));
  const activeClass=root.dataset.migrationActiveClass||'elementor-active';
  const multiple=root.matches('.elementor-toggle')||root.dataset.migrationAccordion==='multiple';
  const initial=pairs.find(({control})=>control.getAttribute('aria-expanded')==='true'||control.classList.contains(activeClass))||(!multiple&&root.matches('.elementor-accordion')&&root.dataset.migrationAccordionInitial!=='closed'?pairs[0]:null);
  const transitions=new Map(),configured=Number(root.dataset.migrationAccordionDuration);
  const duration=Number.isFinite(configured)&&configured>0?configured:0;
  const geometry=panel=>{const style=getComputedStyle(panel);return {height:panel.getBoundingClientRect().height+'px',paddingTop:style.paddingTop,paddingBottom:style.paddingBottom,marginTop:style.marginTop,marginBottom:style.marginBottom};};
  const collapsed={height:'0px',paddingTop:'0px',paddingBottom:'0px',marginTop:'0px',marginBottom:'0px'};
  function set(pair,open,animate=false){
   const prior=transitions.get(pair),changed=pair.control.getAttribute('aria-expanded')!==String(open);
   const moving=animate&&duration&&!motion.matches&&pair.panel.animate&&(changed||prior);
   const visibleDisplay=moving?getComputedStyle(pair.panel).display:null;
   const start=moving&&pair.panel.getClientRects().length?geometry(pair.panel):collapsed;
   prior?.cancel();transitions.delete(pair);

   const {control,panel,item}=pair;control.setAttribute('aria-expanded',String(open));control.classList.toggle(activeClass,open);panel.classList.toggle(activeClass,open);if(item)item.classList.toggle(activeClass,open);
   panel.hidden=!open;panel.inert=!open;panel.setAttribute('aria-hidden',String(!open));if(open)panel.querySelectorAll('[data-migration-hidden-tabindex]').forEach(el=>{const original=el.getAttribute('data-migration-hidden-tabindex');if(original==='absent')el.removeAttribute('tabindex');else el.setAttribute('tabindex',original);el.removeAttribute('data-migration-hidden-tabindex');});panel.style.removeProperty('display');if(display.get(panel))panel.style.display=display.get(panel);if(!open)panel.style.setProperty('display','none','important');else if(getComputedStyle(panel).display==='none')panel.style.display='block';
   if(moving){
    if(!open){panel.hidden=false;panel.style.display=visibleDisplay&&visibleDisplay!=='none'?visibleDisplay:(display.get(panel)||'block');}
    const end=open?geometry(panel):collapsed;
    const animation=panel.animate([{...start,boxSizing:'border-box',overflow:'hidden'},{...end,boxSizing:'border-box',overflow:'hidden'}],{duration,easing:'ease'});
    transitions.set(pair,animation);
    animation.onfinish=()=>{if(transitions.get(pair)!==animation)return;transitions.delete(pair);animation.cancel();if(!open){panel.hidden=true;panel.style.setProperty('display','none','important');}};
   }
  }
  function toggle(pair){const open=pair.control.getAttribute('aria-expanded')!=='true';if(open&&!multiple)pairs.forEach(p=>{if(p!==pair)set(p,false,true);});set(pair,open,true);root.dispatchEvent(new CustomEvent('migration:component-change',{bubbles:true}));}
  for(const pair of pairs){
   const {control}=pair;control.setAttribute('role','button');control.tabIndex=0;if(control.tagName==='BUTTON')control.type='button';
   control.querySelectorAll('a').forEach(a=>a.tabIndex=-1);
   control.addEventListener('click',e=>{e.preventDefault();toggle(pair);});
   control.addEventListener('keydown',e=>{if(e.target!==control)return;if(e.key==='Enter'||e.key===' '){e.preventDefault();toggle(pair);}else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const i=pairs.indexOf(pair);pairs[e.key==='Home'?0:e.key==='End'?pairs.length-1:(i+(e.key==='ArrowDown'?1:-1)+pairs.length)%pairs.length].control.focus();}});
   set(pair,control.getAttribute('aria-expanded')==='true'||control.classList.contains(activeClass)||pair===initial);
  }
  groups.push({pairs,multiple,set});
 }
 function revealHash(){const fragment=location.hash;let id;try{id=decodeURIComponent(fragment.slice(1));}catch{return;}if(!id)return;const target=document.getElementById(id);if(!target)return;let revealed=false;for(const {pairs,multiple,set}of groups){const pair=pairs.find(p=>p.item===target||p.control===target||p.panel===target||p.panel.contains(target));if(pair){if(!multiple)pairs.forEach(p=>set(p,false));set(pair,true);revealed=true;}}if(revealed)requestAnimationFrame(()=>{if(location.hash===fragment&&target.getClientRects().length)target.scrollIntoView({block:'start',behavior:'instant'});});}
 revealHash();window.addEventListener('hashchange',revealHash);
 motion.addEventListener('change',()=>{if(motion.matches)for(const {pairs,set}of groups)for(const pair of pairs)set(pair,pair.control.getAttribute('aria-expanded')==='true');});
})();
