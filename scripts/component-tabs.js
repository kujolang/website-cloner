(()=>{
 const roots='.elementor-tabs,.e-n-tabs,[data-migration-tabs]',groups=[];
 for(const root of document.querySelectorAll(roots)){
  if(root.dataset.migrationTabsReady)continue;
  const scope=roots+',.elementor-accordion,.elementor-toggle,[data-migration-accordion]';
  const controls=[...root.querySelectorAll('[role="tab"],.elementor-tab-title,.e-n-tab-title')].filter(t=>t.closest(scope)===root);
  const panels=[...root.querySelectorAll('[role="tabpanel"],.elementor-tab-content')].filter(p=>p.closest(scope)===root);
  const pairs=controls.map(control=>{
   const id=control.getAttribute('aria-controls');
   const panel=panels.find(p=>id&&p.id===id)||panels.find(p=>control.dataset.tab&&p.dataset.tab===control.dataset.tab);
   return {control,panel};
  }).filter(p=>p.panel);
  if(!pairs.length)continue;
  root.dataset.migrationTabsReady='true';
  const unique=[...new Set(pairs.map(p=>p.panel))];
  const display=new Map(unique.map(p=>[p,p.style.display==='none'?'':p.style.display]));
  pairs.forEach(({control,panel})=>{if(panel.id)control.setAttribute('aria-controls',panel.id);panel.setAttribute('role','tabpanel');});
  const activeClass=root.dataset.migrationActiveClass||(root.matches('.e-n-tabs')?'e-active':'elementor-active'),inactiveClass=root.dataset.migrationInactiveClass;
  function select(panel){
   unique.forEach(p=>{const active=p===panel;p.hidden=!active;p.inert=!active;p.setAttribute('aria-hidden',String(!active));if(active)p.querySelectorAll('[data-migration-hidden-tabindex]').forEach(el=>{const original=el.getAttribute('data-migration-hidden-tabindex');if(original==='absent')el.removeAttribute('tabindex');else el.setAttribute('tabindex',original);el.removeAttribute('data-migration-hidden-tabindex');});p.classList.toggle(activeClass,active);if(inactiveClass)p.classList.toggle(inactiveClass,!active);p.style.removeProperty('display');if(display.get(p))p.style.display=display.get(p);if(!active)p.style.setProperty('display','none','important');else if(getComputedStyle(p).display==='none')p.style.display='block';});
   pairs.forEach(({control,panel:p})=>{const active=p===panel;control.setAttribute('role','tab');control.setAttribute('aria-selected',String(active));control.tabIndex=active||(!panel&&control===pairs[0].control)?0:-1;const item=control.closest('[data-migration-tab-item]');(item&&root.contains(item)?item:control).classList.toggle(activeClass,active);if(inactiveClass)control.classList.toggle(inactiveClass,!active);if(control.hasAttribute('aria-expanded'))control.setAttribute('aria-expanded',String(active));if(control.tagName==='BUTTON')control.type='button';});
   root.dispatchEvent(new CustomEvent('migration:component-change',{bubbles:true}));
  }
  for(const {control,panel} of pairs){
   control.addEventListener('click',e=>{if(e.target.closest('a')||control.tagName==='A')e.preventDefault();select(root.dataset.migrationTabsCollapsible==='true'&&control.getAttribute('aria-selected')==='true'?null:panel);});
   control.addEventListener('keydown',e=>{
    if(e.target!==control)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();select(root.dataset.migrationTabsCollapsible==='true'&&control.getAttribute('aria-selected')==='true'?null:panel);return;}
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    // Separate desktop/mobile title sets and nested tablists by actual visibility.
    const visible=pairs.filter(p=>p.control.getClientRects().length&&getComputedStyle(p.control).visibility!=='hidden');
    const index=visible.findIndex(p=>p.control===control);if(index<0)return;
    const backwards=['ArrowLeft','ArrowUp'].includes(e.key);
    const next=e.key==='Home'?0:e.key==='End'?visible.length-1:(index+(backwards?-1:1)+visible.length)%visible.length;
    e.preventDefault();select(visible[next].panel);visible[next].control.focus();
   });
  }
  select(pairs.find(p=>p.control.getAttribute('aria-selected')==='true'||p.control.classList.contains(activeClass))?.panel||(root.dataset.migrationTabsInitial==='none'?null:unique[0]));
  groups.push({pairs,select});
 }
 function revealHash(){const fragment=location.hash;let id;try{id=decodeURIComponent(fragment.slice(1));}catch{return;}if(!id)return;const target=document.getElementById(id);if(!target)return;let revealed=false;for(const {pairs,select} of groups){const pair=pairs.find(p=>p.control===target||p.panel===target||p.panel.contains(target));if(pair){select(pair.panel);revealed=true;}}if(revealed)requestAnimationFrame(()=>{if(location.hash===fragment&&target.getClientRects().length)target.scrollIntoView({block:'start',behavior:'instant'});});}
 revealHash();window.addEventListener('hashchange',revealHash);
})();
