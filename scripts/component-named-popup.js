// Named menu panels whose source CSS also requires an ancestor open state.
(()=>{
 const triggers=[...document.querySelectorAll('button[data-dropdown-trigger][aria-haspopup]:not([aria-controls])')].filter(el=>!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&['true','menu'].includes(el.getAttribute('aria-haspopup')));
 if(!triggers.length)return;
 const rules=[];function scan(list){for(const rule of list){if(rule.type===CSSRule.SUPPORTS_RULE&&!CSS.supports(rule.conditionText))continue;if(rule.cssRules)scan(rule.cssRules);if(rule.selectorText)rules.push(rule.selectorText);}}
 for(const sheet of document.styleSheets)try{scan(sheet.cssRules);}catch{}
 function ancestorState(panel,trigger){
  const candidates=[];const previous=panel.getAttribute('aria-hidden');panel.setAttribute('aria-hidden','false');
  try{for(const selectors of rules)for(const selector of selectors.split(',')){
   if(!/\[aria-hidden\s*=\s*["']?false/.test(selector)||selector.includes(':not('))continue;
   for(const match of selector.matchAll(/\.((?:is-[\w-]*open)|[\w-]+--open)(?![\w-])/g)){
    const without=selector.slice(0,match.index)+selector.slice(match.index+match[0].length);
    try{if(!panel.matches(without))continue;}catch{continue;}
    const rest=selector.slice(match.index+match[0].length),boundary=rest.search(/[\s>+~]/),prefix=(selector.slice(0,match.index)+(boundary<0?rest:rest.slice(0,boundary))).trim();
    for(let root=panel.parentElement;root&&root!==document.body;root=root.parentElement){try{if(root.contains(trigger)&&root.matches(prefix)&&!candidates.some(c=>c.root===root&&c.state===match[1]))candidates.push({root,state:match[1]});}catch{}}
   }
  }}finally{panel.setAttribute('aria-hidden',previous);}
  return candidates.length===1?candidates[0]:null;
 }
 const pairs=[];for(const trigger of triggers){const key=trigger.getAttribute('data-dropdown-trigger'),panels=[...document.querySelectorAll('[role="menu"][aria-hidden][data-dropdown-name]')].filter(el=>el.getAttribute('data-dropdown-name')===key);if(!key||panels.length!==1)continue;const panel=panels[0],source=ancestorState(panel,trigger);if(source)pairs.push({trigger,panel,...source});}
 let serial=0;const groups=new Map();
 for(const pair of pairs){if(pairs.filter(p=>p.panel===pair.panel).length!==1)continue;if(!groups.has(pair.root))groups.set(pair.root,[]);groups.get(pair.root).push(pair);}
 for(const [root,group]of groups){
  if(new Set(group.map(pair=>pair.state)).size!==1)continue;
  const state=group[0].state;let active=null,mode=null,timer;
  const items=panel=>[...panel.querySelectorAll('a[href],button,[role="menuitem"]')].filter(el=>!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&!el.closest('[hidden],[inert],[aria-hidden="true"]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  function close(focus=false){clearTimeout(timer);if(!active)return;const old=active;active=null;mode=null;old.panel.setAttribute('aria-hidden','true');old.panel.inert=true;old.trigger.setAttribute('aria-expanded','false');root.classList.remove(state);if(focus)old.trigger.focus();}
  function open(pair,focus=false,last=false){clearTimeout(timer);if(active!==pair){close();active=pair;mode=focus?"activate":"hover";root.classList.add(state);pair.panel.inert=false;pair.panel.setAttribute('aria-hidden','false');pair.trigger.setAttribute('aria-expanded','true');for(const el of pair.panel.querySelectorAll('[data-migration-hidden-tabindex]')){const saved=el.dataset.migrationHiddenTabindex;if(saved==='absent')el.removeAttribute('tabindex');else el.setAttribute('tabindex',saved);}}
   if(focus)mode="activate";const links=items(pair.panel);links.forEach((el,index)=>el.tabIndex=index===0?0:-1);if(focus)(last?links.at(-1):links[0])?.focus();
  }
  for(const pair of group){
   if(!pair.panel.id){do{pair.panel.id='cloner-named-popup-'+(++serial);}while(document.querySelectorAll('#'+pair.panel.id).length>1);}
   pair.trigger.type='button';pair.trigger.setAttribute('aria-controls',pair.panel.id);pair.trigger.setAttribute('aria-expanded','false');pair.panel.setAttribute('aria-hidden','true');pair.panel.inert=true;
   pair.trigger.addEventListener('click',()=>active===pair&&mode!=="hover"?close(true):open(pair,true));
   pair.trigger.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')open(pair);});
   pair.trigger.addEventListener('keydown',event=>{if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();open(pair,true,event.key==='ArrowUp');}});
   pair.panel.addEventListener('keydown',event=>{if(active!==pair)return;const links=items(pair.panel),index=links.indexOf(document.activeElement);let next;if(event.key==='ArrowDown')next=(index+1)%links.length;else if(event.key==='ArrowUp')next=(index-1+links.length)%links.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=links.length-1;if(next!==undefined&&links.length){event.preventDefault();links.forEach((el,i)=>el.tabIndex=i===next?0:-1);links[next].focus();}});
  }
  root.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();event.stopPropagation();close(true);}});
  root.addEventListener('pointerenter',()=>clearTimeout(timer));root.addEventListener('pointerleave',()=>{timer=setTimeout(()=>{if(!root.contains(document.activeElement))close();},120);});
  root.addEventListener('focusout',()=>{setTimeout(()=>{if(active&&!root.contains(document.activeElement))close();},0);});
  document.addEventListener('pointerdown',event=>{if(active&&!root.contains(event.target))close();});
  window.addEventListener('resize',()=>{if(active&&!active.trigger.getClientRects().length)close();});
 }
})();
