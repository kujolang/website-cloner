(()=>{
 const dialog=document.querySelector('[data-cloner-consent-dialog]');if(!dialog)return;
 let config;try{config=JSON.parse(dialog.dataset.clonerConsentConfig);}catch{return;}
 const categories=[...new Set(config.services.map(s=>s.category))],banner=document.querySelector('[data-cloner-consent-banner]');
 const embedTargets=new Map([...document.querySelectorAll('[data-cloner-consent-embed]')].map(el=>[el.dataset.clonerConsentEmbed,el]));
 let allowed=new Set(),saved=false,returnFocus=null;
 try{const value=JSON.parse(localStorage.getItem(config.storageKey));if(value?.revision===config.revision&&Array.isArray(value.allowed)){allowed=new Set(value.allowed.filter(c=>categories.includes(c)));saved=true;}}catch{}
 const visible=(el,show)=>{if(!el)return;el.hidden=!show;el.setAttribute('aria-hidden',String(!show));if(show){el.style.removeProperty('display');if(getComputedStyle(el).display==='none')el.style.setProperty('display','block','important');}else el.style.setProperty('display','none','important');};
 const update=()=>{
  dialog.querySelectorAll('input[type=checkbox]').forEach(el=>el.checked=allowed.has(el.name));
  for(const service of config.services){
   for(const el of [embedTargets.get(service.id)].filter(Boolean)){
    if(allowed.has(service.category)){if(!el.querySelector('iframe')){const frame=document.createElement('iframe');frame.src=service.url;frame.title=service.label;frame.loading='lazy';frame.referrerPolicy='no-referrer';frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-presentation');frame.style.cssText='width:100%;height:100%;border:0';el.replaceChildren(frame);}}
    else{const button=document.createElement('button');button.type='button';button.dataset.clonerConsentAction='preferences';button.textContent='Enable '+service.label+' in privacy preferences';el.replaceChildren(button);}
   }
  }
  document.dispatchEvent(new CustomEvent('cloner:consent-change',{detail:{allowed:[...allowed],revision:config.revision}}));
 };
 window.clonerConsent={allows:category=>allowed.has(category),open:()=>open()};
 function open(){returnFocus=document.activeElement;dialog.querySelectorAll('input[type=checkbox]').forEach(el=>el.checked=allowed.has(el.name));if(!dialog.open)dialog.showModal();}
 function close(){if(dialog.open)dialog.close();if(returnFocus?.isConnected)returnFocus.focus();}
 function save(values){allowed=new Set(values);saved=true;let persisted=true;try{localStorage.setItem(config.storageKey,JSON.stringify({revision:config.revision,allowed:[...allowed]}));}catch{persisted=false;}
  update();visible(banner,false);if(persisted)close();else{open();dialog.querySelector('[data-cloner-consent-status]').textContent='Preferences apply for this page only; browser storage is unavailable.';}
 }
 document.addEventListener('keydown',event=>{if(!['Enter',' '].includes(event.key))return;const control=event.target.closest('[data-cloner-consent-action][role=button]');if(!control||control.matches('button,input,select,textarea')||event.key==='Enter'&&control.matches('a[href]'))return;event.preventDefault();control.click();});
 document.addEventListener('click',event=>{const control=event.target.closest('[data-cloner-consent-action]');if(!control)return;event.preventDefault();
  switch(control.dataset.clonerConsentAction){case'details':{const target=document.getElementById(control.getAttribute('aria-controls'));if(target&&dialog.contains(target)){const expanded=control.getAttribute('aria-expanded')!=='true';control.setAttribute('aria-expanded',String(expanded));control.closest('.cky-accordion')?.classList.toggle('cky-accordion-active',expanded);visible(target,expanded);}break;}case'preferences':open();break;case'accept':save(categories);break;case'reject':save([]);break;case'save':save([...dialog.querySelectorAll('input:checked')].map(el=>el.name));break;case'close':close();break;case'dismiss':visible(banner,false);break;}
 });
 dialog.addEventListener('cancel',()=>{if(returnFocus?.isConnected)setTimeout(()=>returnFocus.focus(),0);});
 window.addEventListener('storage',event=>{if(event.key!==config.storageKey)return;try{const next=JSON.parse(event.newValue);allowed=new Set(next?.revision===config.revision&&Array.isArray(next.allowed)?next.allowed.filter(c=>categories.includes(c)):[]);saved=next?.revision===config.revision&&Array.isArray(next.allowed);update();visible(banner,!saved);}catch{allowed.clear();saved=false;update();visible(banner,true);}});
 update();visible(banner,!saved);
})();
