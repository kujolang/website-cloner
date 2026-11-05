// Named dropdown contracts inside exported menus; retain source CSS states.
(()=>{
 const rules=[];
 function scan(list){for(const rule of list){if(rule.type===CSSRule.SUPPORTS_RULE&&!CSS.supports(rule.conditionText))continue;if(rule.cssRules)scan(rule.cssRules);if(rule.selectorText)rules.push(rule);}}
 for(const sheet of document.styleSheets)try{scan(sheet.cssRules);}catch{}
 function state(el,kind){
  const found=new Set();
  for(const rule of rules){
   if(kind==='show'&&rule.style.visibility!=='visible')continue;
   if(kind==='hide'&&rule.style.visibility!=='hidden'&&rule.style.display!=='none')continue;
   for(const selector of rule.selectorText.split(','))for(const match of selector.matchAll(/\.((?:is-)?(?:visible|hidden|active)|[\w-]+--(?:visible|hidden|active))/g)){
    const cls=match[1];if(!selector.trim().split(/[\s>+~]+/).at(-1).includes('.'+cls)||selector.includes(':not('))continue;
    const without=selector.replaceAll('.'+cls,'');try{if(el.matches(without))found.add(cls);}catch{}
   }
  }
  return found.size===1?[...found][0]:null;
 }
 let serial=0;
 for(const root of document.querySelectorAll('[role="menu"]')){
  const pairs=[];
  for(const trigger of root.querySelectorAll('a[data-mobile-dropdown],button[data-mobile-dropdown],a[data-dropdown-target],button[data-dropdown-target]')){
   if(trigger.matches('[disabled],[aria-disabled="true"],[data-migration-unavailable]')||trigger.hasAttribute('aria-controls')||trigger.closest('[role="menu"]')!==root)continue;
   if(trigger.tagName==='A'&&!['','#'].includes(trigger.getAttribute('href')||''))continue;
   const key=trigger.getAttribute('data-mobile-dropdown')||trigger.getAttribute('data-dropdown-target');
   const matches=[...root.querySelectorAll('[data-dropdown-name]')].filter(el=>el.getAttribute('data-dropdown-name')===key&&el.closest('[role="menu"]')===root);
   const list=trigger.closest('ul,ol,[role="list"]');if(!key||matches.length!==1||!list||list.contains(matches[0]))continue;
   const panel=matches[0],show=state(panel,'show'),hide=state(list,'hide');if(show&&hide)pairs.push({trigger,list,panel,show,hide});
  }
  const backs=[...root.querySelectorAll('button')].filter(el=>el.closest('[role="menu"]')===root&&/^(back|go back)$/i.test((el.getAttribute('aria-label')||el.textContent).trim())&&state(el,'hide'));
  if(!pairs.length||backs.length!==1||new Set(pairs.map(p=>p.panel)).size!==pairs.length||new Set(pairs.map(p=>p.list)).size!==1)continue;
  const back=backs[0],backHide=state(back,'hide'),list=pairs[0].list,listHide=pairs[0].hide;
  const headings=[...root.querySelectorAll('h1,h2,h3,h4,[role="heading"]')].filter(el=>!el.textContent.trim()&&state(el,'show'));
  const heading=headings.length===1?headings[0]:null,headingShow=heading&&state(heading,'show');
  let active=null;
  const restoreTabStops=el=>{for(const node of el.querySelectorAll('[data-migration-hidden-tabindex]')){const saved=node.dataset.migrationHiddenTabindex;if(saved==='absent')node.removeAttribute('tabindex');else node.setAttribute('tabindex',saved);}};
  function reset(focus){const previous=active;active=null;for(const pair of pairs){pair.panel.classList.remove(pair.show);pair.panel.inert=true;pair.panel.setAttribute('aria-hidden','true');pair.trigger.setAttribute('aria-expanded','false');}list.classList.remove(listHide);list.inert=false;list.removeAttribute('aria-hidden');back.classList.add(backHide);back.inert=true;if(heading){heading.classList.remove(headingShow);heading.textContent='';}if(focus)previous?.trigger.focus();}
  for(const pair of pairs){
   if(!pair.panel.id){do{pair.panel.id='cloner-drilldown-'+(++serial);}while(document.querySelectorAll('#'+pair.panel.id).length>1);}
   pair.trigger.setAttribute('aria-controls',pair.panel.id);pair.trigger.setAttribute('aria-expanded','false');if(pair.trigger.tagName==='A')pair.trigger.setAttribute('role','button');else pair.trigger.type='button';
   const open=event=>{event.preventDefault();reset(false);active=pair;list.classList.add(listHide);list.inert=true;list.setAttribute('aria-hidden','true');pair.panel.classList.add(pair.show);pair.panel.inert=false;pair.panel.setAttribute('aria-hidden','false');pair.trigger.setAttribute('aria-expanded','true');back.classList.remove(backHide);back.inert=false;restoreTabStops(pair.panel);if(back.dataset.migrationHiddenTabindex==='absent')back.removeAttribute('tabindex');if(heading){heading.textContent=pair.trigger.textContent.trim();heading.classList.add(headingShow);}back.focus();};
   pair.trigger.addEventListener('click',open);pair.trigger.addEventListener('keydown',event=>{if(pair.trigger.tagName==='A'&&event.key===' '){open(event);}});
  }
  back.type='button';back.addEventListener('click',()=>reset(true));
  root.addEventListener('keydown',event=>{if(active&&event.key==='Escape'){event.preventDefault();event.stopPropagation();reset(true);}},true);
  new MutationObserver(()=>{if(root.getAttribute('aria-hidden')==='true')reset(false);}).observe(root,{attributes:true,attributeFilter:['aria-hidden']});
  reset(false);
 }
})();
