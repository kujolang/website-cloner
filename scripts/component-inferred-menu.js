// Recover only unambiguous named popup menus with a source CSS open state.
(()=>{
 const name=el=>(el.getAttribute('aria-label')||el.textContent||'').replace(/\s+/g,' ').trim().toLocaleLowerCase();
 const panels=[...document.querySelectorAll('[role="menu"][aria-hidden][aria-label]')];
 const pairs=[];
 for(const button of document.querySelectorAll('button[aria-haspopup]:not([aria-controls])')){
  if(!['true','menu'].includes(button.getAttribute('aria-haspopup')))continue;
  const label=name(button);if(label.length<3)continue;
  const matches=panels.filter(panel=>!panel.contains(button)&&(' '+name(panel)+' ').includes(' '+label+' '));
  if(matches.length===1)pairs.push({button,panel:matches[0],states:new Set()});
 }
 if(!pairs.length)return;
 function scan(rules){for(const rule of rules){
  if(rule.type===CSSRule.SUPPORTS_RULE&&!CSS.supports(rule.conditionText))continue;
  if(rule.cssRules?.length)scan(rule.cssRules);
  if(!rule.selectorText)continue;
  const candidates=[...rule.selectorText.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map(match=>match[1]).filter(cls=>cls==='open'||cls==='is-open'||cls.endsWith('--open'));
  for(const pair of pairs)for(const cls of candidates){
   if(pair.panel.classList.contains(cls))continue;
   const escaped=cls.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   for(const selector of rule.selectorText.split(',')){
    const compound=selector.trim().split(/[\s>+~]+/).at(-1)||'';
    if(!compound.includes('.'+cls)||selector.includes(':not(.'+cls))continue;
    const without=selector.replace(new RegExp('\\.'+escaped+'(?![\\w-])','g'),'').trim();
    try{if(without&&pair.panel.matches(without)||!without&&cls.endsWith('--open')&&pair.panel.classList.contains(cls.slice(0,-6)))pair.states.add(cls);}catch{}
   }
  }
 }}
 for(const sheet of document.styleSheets)try{scan(sheet.cssRules);}catch{}
 let serial=0;const controls=[];
 for(const {button,panel,states}of pairs){
  if(states.size!==1||pairs.filter(pair=>pair.panel===panel).length!==1)continue;
  const state=[...states][0];if(!panel.id){do{panel.id='cloner-named-menu-'+(++serial);}while(document.querySelectorAll('#'+panel.id).length>1);}
  button.type='button';button.setAttribute('aria-controls',panel.id);
  let open=false,modal=false,overflow={value:'',priority:''};
  const focusable=()=>[...panel.querySelectorAll('a[href],button,input,select,textarea,[tabindex="0"]')].filter(el=>!el.disabled&&!el.closest('[hidden],[inert],[aria-hidden="true"]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden');
  const set=(next,focus=false)=>{
   if(next===open)return;open=next;panel.classList.toggle(state,open);panel.setAttribute('aria-hidden',String(!open));panel.inert=!open;button.setAttribute('aria-expanded',String(open));
   if(open){for(const el of panel.querySelectorAll('[data-migration-hidden-tabindex]')){const saved=el.dataset.migrationHiddenTabindex;if(saved==='absent')el.removeAttribute('tabindex');else el.setAttribute('tabindex',saved);}
    const rect=panel.getBoundingClientRect();modal=getComputedStyle(panel).position==='fixed'&&rect.width>=innerWidth*.9&&rect.height>=innerHeight*.9;
    if(modal){overflow={value:document.documentElement.style.overflow,priority:document.documentElement.style.getPropertyPriority('overflow')};document.documentElement.style.setProperty('overflow','hidden');}
    if(focus)focusable()[0]?.focus();
   }else{if(modal)document.documentElement.style.setProperty('overflow',overflow.value,overflow.priority);modal=false;if(focus)button.focus();}
  };
  panel.inert=true;panel.setAttribute('aria-hidden','true');button.setAttribute('aria-expanded','false');
  button.addEventListener('click',()=>{const next=!open;controls.forEach(control=>{if(control.panel!==panel)control.close();});set(next,true);});
  panel.addEventListener('click',event=>{const closer=event.target.closest('button[aria-label]'),label=closer?name(closer):'';if(/^close(?:\s|$)/i.test(label)&&(label==='close'||(' '+label+' ').includes(' '+name(button)+' '))||event.target===panel)set(false,true);});
  document.addEventListener('keydown',event=>{if(!open)return;if(event.key==='Escape'){event.preventDefault();set(false,true);}else if(event.key==='Tab'&&modal){const items=focusable(),first=items[0],last=items.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}});
  document.addEventListener('pointerdown',event=>{if(open&&!panel.contains(event.target)&&!button.contains(event.target))set(false);});
  controls.push({panel,close:()=>set(false)});
 }
})();
